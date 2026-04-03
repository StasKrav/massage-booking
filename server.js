import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// РАЗДАЁМ СТАТИКУ ИЗ ПАПКИ public
app.use(express.static(path.join(__dirname, 'public')));

// ПАПКА ДЛЯ ДАННЫХ
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookings.json');

// Создаём папку data если нет
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
    console.log('📁 Создана папка data');
}

// Создаём файл если нет
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    console.log('📁 Создан data/bookings.json');
}

// API endpoints
app.get('/api/bookings', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.json({});
    }
});

app.post('/api/bookings', (req, res) => {
    try {
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
        
        console.log(`✅ Запись сохранена: ${key}`);
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/bookings/:date/:time', (req, res) => {
    try {
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const key = `${req.params.date}_${req.params.time}`;
        
        if (bookings[key]) {
            delete bookings[key];
            fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
            console.log(`✅ Запись удалена: ${key}`);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Корневой маршрут - отдаём index.html из public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Для всех остальных страниц - тоже index.html (для SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Статика: ${path.join(__dirname, 'public')}`);
    console.log(`📁 Данные: ${DATA_FILE}`);
});
