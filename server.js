import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, 'bookings.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'StasKrav/massage-booking';

// Инициализация файла
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    console.log('📁 Создан bookings.json');
}

// Функция сохранения в GitHub (опционально)
async function saveToGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('ℹ️ GitHub токен не настроен, работаем локально');
        return false;
    }
    
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        const encodedContent = Buffer.from(content).toString('base64');
        
        // Пытаемся получить sha файла
        let sha = null;
        try {
            const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            }
        } catch (e) {}
        
        // Сохраняем в GitHub
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Auto-save ${new Date().toISOString()}`,
                content: encodedContent,
                sha: sha
            })
        });
        
        if (putRes.ok) {
            console.log('✅ Бэкап сохранён в GitHub');
            return true;
        }
    } catch (error) {
        console.log('⚠️ Ошибка бэкапа в GitHub:', error.message);
    }
    return false;
}

// Загрузка из GitHub при старте (опционально)
async function loadFromGitHub() {
    if (!GITHUB_TOKEN) return false;
    
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            fs.writeFileSync(DATA_FILE, content);
            console.log('✅ Данные восстановлены из GitHub');
            return true;
        }
    } catch (error) {
        console.log('ℹ️ Не удалось загрузить из GitHub');
    }
    return false;
}

// Загружаем данные при старте (если есть токен)
await loadFromGitHub();

// API endpoints
app.get('/api/bookings', (req, res) => {
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(bookings);
});

app.post('/api/bookings', async (req, res) => {
    const { date, time, name, phone, service } = req.body;
    
    if (!date || !time || !name || !phone) {
        return res.status(400).json({ error: 'Не все поля заполнены' });
    }
    
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const key = `${date}_${time}`;
    
    if (bookings[key]) {
        return res.status(409).json({ error: 'Время уже занято' });
    }
    
    bookings[key] = { date, time, name, phone, service: service || 'Общий массаж' };
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    
    // Бэкап в GitHub (если есть токен)
    await saveToGitHub();
    
    res.json({ success: true });
});

app.delete('/api/bookings/:date/:time', async (req, res) => {
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const key = `${req.params.date}_${req.params.time}`;
    delete bookings[key];
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    
    await saveToGitHub();
    res.json({ success: true });
});

// Корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер на порту ${PORT}`);
    console.log(`📁 Данные: ${DATA_FILE}`);
    console.log(`${GITHUB_TOKEN ? '✅' : '⚠️'} GitHub бэкап ${GITHUB_TOKEN ? 'включён' : 'выключен'}`);
});
