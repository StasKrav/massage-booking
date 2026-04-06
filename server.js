import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// GitHub конфигурация - берем переменные окружения
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'StasKrav/massage-booking';
const GITHUB_FILE_PATH = 'data/bookings.json';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Проверка наличия токена
if (!GITHUB_TOKEN) {
    console.error('❌ ВНИМАНИЕ: GITHUB_TOKEN не установлен!');
    console.error('📌 Добавьте переменную окружения GITHUB_TOKEN в настройках Render');
} else {
    console.log('✅ GitHub токен найден');
    console.log(`📦 Репозиторий: ${GITHUB_REPO}`);
    console.log(`🌿 Ветка: ${GITHUB_BRANCH}`);
}

// Локальный файл как кэш
const LOCAL_DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Инициализируем локальный файл если его нет
if (!fs.existsSync(LOCAL_DATA_FILE)) {
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify({}));
}

// ============ ФУНКЦИИ РАБОТЫ С GITHUB ============

// Функция для загрузки данных из GitHub
async function loadFromGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GitHub токен не настроен, используем локальное хранилище');
        return loadFromLocal();
    }
    
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        console.log(`📥 Загрузка из GitHub: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Massage-Booking-App'
            }
        });
        
        if (response.status === 404) {
            console.log('📁 Файл не найден на GitHub, создаем новый');
            return {};
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error ${response.status}: ${errorText}`);
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
        saveToLocal(bookings);
        return false;
    }
    
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        
        // Получаем текущий файл и его SHA
        let sha = null;
        const getResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Massage-Booking-App'
            }
        });
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
            console.log(`📝 Найден существующий файл, SHA: ${sha.substring(0, 7)}`);
        } else if (getResponse.status !== 404) {
            console.log(`⚠️ Неожиданный ответ при получении файла: ${getResponse.status}`);
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
                branch: GITHUB_BRANCH
            })
        });
        
        if (!putResponse.ok) {
            const errorData = await putResponse.json();
            throw new Error(`GitHub save error ${putResponse.status}: ${JSON.stringify(errorData)}`);
        }
        
        console.log(`✅ Сохранено в GitHub: ${Object.keys(bookings).length} записей`);
        
        // Сохраняем локальную копию
        saveToLocal(bookings);
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в GitHub:', error.message);
        console.log('📁 Сохраняем только локально');
        saveToLocal(bookings);
        return false;
    }
}

// Локальные функции как fallback
function loadFromLocal() {
    try {
        if (fs.existsSync(LOCAL_DATA_FILE)) {
            const data = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
            const bookings = JSON.parse(data);
            console.log(`💾 Загружено локально: ${Object.keys(bookings).length} записей`);
            return bookings;
        }
    } catch (error) {
        console.error('❌ Ошибка локальной загрузки:', error);
    }
    return {};
}

function saveToLocal(bookings) {
    try {
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(bookings, null, 2));
        console.log('💾 Сохранено локально');
    } catch (error) {
        console.error('❌ Ошибка локального сохранения:', error);
    }
}

// Функция очистки старых записей
function cleanOldBookings(bookings) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let cleaned = false;
    const cleanedBookings = {};
    const oldBookings = [];
    
    Object.entries(bookings).forEach(([key, booking]) => {
        const bookingDate = new Date(booking.date);
        bookingDate.setHours(0, 0, 0, 0);
        
        if (bookingDate >= today) {
            cleanedBookings[key] = booking;
        } else {
            cleaned = true;
            oldBookings.push(`${booking.date} ${booking.time} - ${booking.name} (${booking.status || 'confirmed'})`);
        }
    });
    
    if (cleaned) {
        console.log(`🗑️ Удалено старых записей: ${oldBookings.length}`);
        console.log(`✅ Осталось активных записей: ${Object.keys(cleanedBookings).length}`);
    }
    
    return cleanedBookings;
}

// ============ API ============

// API: Получить все записи (все статусы, и клиент и админ видят одинаково)
app.get('/api/bookings', async (req, res) => {
    try {
        let bookings = await loadFromGitHub();
        
        const cleaned = cleanOldBookings(bookings);
        if (JSON.stringify(bookings) !== JSON.stringify(cleaned)) {
            await saveToGitHub(cleaned);
            bookings = cleaned;
        }
        
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

// API: Получить все записи (включая прошлые - для админа)
app.get('/api/bookings/all', async (req, res) => {
    try {
        const bookings = await loadFromGitHub();
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Создать запись (со статусом pending)
app.post('/api/bookings', async (req, res) => {
    try {
        const { date, time, name, phone, service } = req.body;
        
        if (!date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        
        let bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        // Проверяем, не занято ли время (подтвержденные или ожидающие)
        if (bookings[key] && bookings[key].status !== 'rejected') {
            return res.status(409).json({ error: 'Это время уже занято' });
        }
        
        bookings[key] = { 
            date, 
            time, 
            name, 
            phone, 
            service: service || 'Общий массаж',
            status: 'pending',
            createdAt: new Date().toISOString(),
            confirmedAt: null
        };
        
        await saveToGitHub(bookings);
        
        console.log(`📝 Новая заявка (pending): ${date} ${time} - ${name}`);
        
        res.json({ success: true, booking: bookings[key] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Подтвердить запись (админ)
app.patch('/api/bookings/:date/:time/confirm', async (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        const ADMIN_PHONES = ['+79954801080'];
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав' });
        }
        
        let bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        bookings[key].status = 'confirmed';
        bookings[key].confirmedAt = new Date().toISOString();
        
        await saveToGitHub(bookings);
        console.log(`✅ Подтверждена: ${date} ${time} - ${bookings[key].name}`);
        
        res.json({ success: true, booking: bookings[key] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Отменить запись (клиент по телефону)
app.delete('/api/bookings/:date/:time/cancel', async (req, res) => {
    try {
        const { date, time } = req.params;
        const { phone } = req.body;
        
        let bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        // Проверяем, что отменяет тот, кто записывался
        if (bookings[key].phone !== phone) {
            return res.status(403).json({ error: 'Нельзя отменить чужую запись' });
        }
        
        // Если запись еще не подтверждена - удаляем полностью
        if (bookings[key].status === 'pending') {
            delete bookings[key];
            console.log(`🚫 Клиент отменил заявку: ${date} ${time}`);
        } else {
            return res.status(400).json({ error: 'Подтвержденную запись нельзя отменить' });
        }
        
        await saveToGitHub(bookings);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Удалить запись (админ)
app.delete('/api/bookings/:date/:time', async (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        const ADMIN_PHONES = ['+79954801080'];
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав для удаления' });
        }
        
        let bookings = await loadFromGitHub();
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        delete bookings[key];
        await saveToGitHub(bookings);
        
        console.log(`🗑️ Удалена запись: ${date} ${time}`);
        
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
            todayCount: bookingsArray.filter(b => b.date === today && b.status === 'confirmed').length,
            pendingCount: bookingsArray.filter(b => b.status === 'pending').length
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка всех остальных маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📦 GitHub репозиторий: ${GITHUB_REPO}`);
    console.log(`🔑 GitHub токен: ${GITHUB_TOKEN ? '✅ установлен' : '❌ не установлен'}`);
    console.log(`💾 Локальный файл: ${LOCAL_DATA_FILE}`);
    console.log(`🎨 Система подтверждения записей: ВКЛЮЧЕНА\n`);
});
