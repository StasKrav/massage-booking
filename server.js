import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Функция получения сегодняшней даты по МОСКОВСКОМУ времени
function getTodayMsk() {
    const now = new Date();
    // Сдвигаем на +3 часа (Москва)
    const mskTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    return mskTime.toISOString().split('T')[0];
}

// Функция очистки старых записей (по МОСКОВСКОМУ времени)
function cleanOldBookings(bookings) {
    const todayMsk = getTodayMsk();
    
    const cleanedBookings = {};
    let deletedCount = 0;
    
    Object.entries(bookings).forEach(([key, booking]) => {
        // Сравниваем даты как строки
        if (booking.date < todayMsk) {
            deletedCount++;
            // Пропускаем - удаляем
        } else {
            cleanedBookings[key] = booking;
        }
    });
    
    if (deletedCount > 0) {
        console.log(`🗑️ Удалено старых записей: ${deletedCount}`);
        console.log(`✅ Осталось записей: ${Object.keys(cleanedBookings).length}`);
    }
    
    return cleanedBookings;
}

// API: Получить все записи
app.get('/api/bookings', (req, res) => {
    try {
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // Автоматическая очистка при каждом запросе
        const cleaned = cleanOldBookings(bookings);
        if (JSON.stringify(bookings) !== JSON.stringify(cleaned)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(cleaned, null, 2));
            bookings = cleaned;
        }
        
        const todayMsk = getTodayMsk();
        const filtered = {};
        
        Object.entries(bookings).forEach(([key, booking]) => {
            if (booking.date >= todayMsk) {
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
        
        if (!date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // Сначала очищаем старые
        bookings = cleanOldBookings(bookings);
        
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
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
        
        console.log(`📝 Новая запись: ${date} ${time} - ${name}`);
        
        res.json({ success: true, booking: bookings[key] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Удалить запись (админ)
app.delete('/api/bookings/:date/:time', (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        const ADMIN_PHONES = ['+79954801080'];
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав для удаления' });
        }
        
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const key = `${date}_${time}`;
        
        if (!bookings[key]) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        
        delete bookings[key];
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
        
        console.log(`🗑️ Удалена запись: ${date} ${time}`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Получить все записи (для админа)
app.get('/api/bookings/all', (req, res) => {
    try {
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Остальные маршруты
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🕐 Пермское время сейчас: ${new Date(new Date().getTime() + (5 * 60 * 60 * 1000)).toISOString().replace('T', ' ').slice(0, 19)}`);
    console.log(`🧹 Автоочистка: записи за прошедшие дни удаляются автоматически\n`);
});
