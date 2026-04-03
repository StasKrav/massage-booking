import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

const DATA_FILE = 'bookings.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'StasKrav/massage-booking';

// Инициализация файла
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Функция сохранения в GitHub
async function saveToGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ Нет GitHub токена, данные только локально');
        return;
    }
    
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        const encodedContent = Buffer.from(content).toString('base64');
        
        // Получаем текущий файл из GitHub (чтобы получить sha)
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        let sha = null;
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }
        
        // Обновляем или создаём файл
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Auto-save bookings ${new Date().toISOString()}`,
                content: encodedContent,
                sha: sha
            })
        });
        
        if (putRes.ok) {
            console.log('✅ Данные сохранены в GitHub');
        } else {
            console.error('❌ Ошибка сохранения в GitHub:', await putRes.text());
        }
    } catch (error) {
        console.error('❌ GitHub save error:', error);
    }
}

// Функция загрузки из GitHub при запуске
async function loadFromGitHub() {
    if (!GITHUB_TOKEN) return;
    
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (res.ok) {
            const data = await res.json();
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            fs.writeFileSync(DATA_FILE, content);
            console.log('✅ Данные загружены из GitHub');
        }
    } catch (error) {
        console.log('ℹ️ GitHub файл не найден, создаём новый');
    }
}

// Загружаем данные при старте
await loadFromGitHub();

// API endpoints
app.get('/api/bookings', (req, res) => {
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(bookings);
});

app.post('/api/bookings', async (req, res) => {
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const key = `${req.body.date}_${req.body.time}`;
    
    if (bookings[key]) {
        return res.status(409).json({ error: 'Время уже занято' });
    }
    
    bookings[key] = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    
    // Сохраняем в GitHub
    await saveToGitHub();
    
    res.json({ success: true });
});

app.delete('/api/bookings/:date/:time', async (req, res) => {
    const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const key = `${req.params.date}_${req.params.time}`;
    delete bookings[key];
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    
    // Сохраняем в GitHub
    await saveToGitHub();
    
    res.json({ success: true });
});

// Периодическое сохранение (каждые 5 минут)
setInterval(async () => {
    await saveToGitHub();
    console.log('🔄 Периодическое сохранение в GitHub');
}, 5 * 60 * 1000);

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
