import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Путь к файлу с записями
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Инициализируем файл если его нет
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// API: Получить все записи
app.get('/api/bookings', (req, res) => {
    try {
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

// API: Создать запись
app.post('/api/bookings', (req, res) => {
    try {
        const { date, time, name, phone, service } = req.body;
        
        // Валидация
        if (!date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const key = `${date}_${time}`;
        
        // Проверяем, не занято ли время
        if (bookings[key]) {
            return res.status(409).json({ error: 'Это время уже занято' });
        }
        
        bookings[key] = { date, time, name, phone, service: service || 'Общий массаж' };
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
        
        res.json({ success: true, booking: bookings[key] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Удалить запись (только для админа)
app.delete('/api/bookings/:date/:time', (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        // Простая проверка админа (можно улучшить)
        const ADMIN_PHONES = ['+79954801080']; // Ваш телефон
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав для удаления' });
        }
        
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        delete bookings[key];
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка всех остальных маршрутов (для SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
