import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// GitHub конфигурация
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'StasKrav/massage-booking'; // Ваш репозиторий
const GITHUB_FILE_PATH = 'data/bookings.json';

// Локальный файл как кэш и fallback
const LOCAL_DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Убедимся, что папка data существует локально
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Функция для загрузки данных из GitHub
async function loadFromGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GitHub токен не настроен, используем локальное хранилище');
        return loadFromLocal();
    }
    
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Massage-Booking-App'
            }
        });
        
        if (response.status === 404) {
            // Файл не существует, создаем пустой
            console.log('📁 Файл не найден, создаем новый');
            return {};
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        const bookings = JSON.parse(content);
        console.log(`✅ Загружено из GitHub: ${Object.keys(bookings).length} записей`);
        
        // Сохраняем локальную копию
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(bookings, null, 2));
        
        return bookings;
    } catch (error) {
        console.error('❌ Ошибка загрузки из GitHub:', error.message);
        console.log('📁 Используем локальную копию');
        return loadFromLocal();
    }
}

// Функция для сохранения данных в GitHub
async function saveToGitHub(bookings) {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GitHub токен не настроен, сохраняем локально');
        return saveToLocal(bookings);
    }
    
    try {
        // Сначала получаем текущий файл и его SHA
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const getResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Massage-Booking-App'
            }
        });
        
        let sha = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
        
        // Подготавливаем данные для сохранения
        const content = Buffer.from(JSON.stringify(bookings, null, 2)).toString('base64');
        
        // Сохраняем в GitHub
        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Massage-Booking-App'
            },
            body: JSON.stringify({
                message: `Update bookings - ${new Date().toISOString()}`,
                content: content,
                sha: sha,
                branch: 'main'
            })
        });
        
        if (!putResponse.ok) {
            throw new Error(`GitHub save error: ${putResponse.status}`);
        }
        
        console.log(`✅ Сохранено в GitHub: ${Object.keys(bookings).length} записей`);
        
        // Сохраняем локальную копию
        saveToLocal(bookings);
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в GitHub:', error.message);
        console.log('📁 Сохраняем локально');
        saveToLocal(bookings);
        return false;
    }
}

// Локальные функции как fallback
function loadFromLocal() {
    try {
        if (fs.existsSync(LOCAL_DATA_FILE)) {
            const data = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Ошибка локальной загрузки:', error);
    }
    return {};
}

function saveToLocal(bookings) {
    try {
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(bookings, null, 2));
        console.log('💾 Сохранено локально');
    } catch (error) {
        console.error('Ошибка локального сохранения:', error);
    }
}

// API: Получить все записи
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await loadFromGitHub();
        
        // Фильтруем только будущие записи
        const today = new Date().toISOString().split('T')[0];
        const filtered = {};
        
        Object.entries(bookings).forEach(([key, booking]) => {
            if (booking.date >= today) {
                filtered[key] = booking;
            }
        });
        
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Получить все записи (включая прошлые)
app.get('/api/bookings/all', async (req, res) => {
    try {
        const bookings = await loadFromGitHub();
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Создать запись
app.post('/api/bookings', async (req, res) => {
    try {
        const { date, time, name, phone, service } = req.body;
        
        if (!date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        
        const bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        if (bookings[key]) {
            return res.status(409).json({ error: 'Это время уже занято' });
        }
        
        bookings[key] = { 
            date, 
            time, 
            name, 
            phone, 
            service: service || 'Общий массаж',
            createdAt: new Date().toISOString()
        };
        
        await saveToGitHub(bookings);
        
        res.json({ success: true, booking: bookings[key] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Удалить запись
app.delete('/api/bookings/:date/:time', async (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        const ADMIN_PHONES = ['+79954801080'];
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав для удаления' });
        }
        
        const bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        delete bookings[key];
        await saveToGitHub(bookings);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Статистика
app.get('/api/stats', async (req, res) => {
    try {
        const bookings = await loadFromGitHub();
        const bookingsArray = Object.values(bookings);
        const today = new Date().toISOString().split('T')[0];
        
        const stats = {
            total: bookingsArray.length,
            uniqueClients: new Set(bookingsArray.map(b => b.phone)).size,
            todayCount: bookingsArray.filter(b => b.date === today).length
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Принудительная синхронизация с GitHub
app.post('/api/sync', async (req, res) => {
    try {
        const { adminPhone } = req.body;
        const ADMIN_PHONES = ['+79954801080'];
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав' });
        }
        
        const bookings = await loadFromGitHub();
        await saveToGitHub(bookings);
        
        res.json({ success: true, message: 'Синхронизация выполнена' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка всех остальных маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📦 GitHub репозиторий: ${GITHUB_REPO}`);
    console.log(`🔑 GitHub токен: ${GITHUB_TOKEN ? '✅ установлен' : '❌ не установлен'}`);
});
