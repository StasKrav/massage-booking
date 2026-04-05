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
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Инициализируем файл если его нет
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// ============ ФУНКЦИЯ ОЧИСТКИ СТАРЫХ ЗАПИСЕЙ ============
function cleanOldBookings(bookings) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Обнуляем время для корректного сравнения
    
    let cleaned = false;
    const cleanedBookings = {};
    const oldBookings = [];
    
    Object.entries(bookings).forEach(([key, booking]) => {
        const bookingDate = new Date(booking.date);
        bookingDate.setHours(0, 0, 0, 0);
        
        // Оставляем только записи за сегодня и будущие
        if (bookingDate >= today) {
            cleanedBookings[key] = booking;
        } else {
            cleaned = true;
            oldBookings.push(`${booking.date} ${booking.time} - ${booking.name}`);
        }
    });
    
    if (cleaned) {
        console.log(`🗑️ Удалено старых записей: ${oldBookings.length}`);
        oldBookings.forEach(old => console.log(`   - ${old}`));
        console.log(`✅ Осталось активных записей: ${Object.keys(cleanedBookings).length}`);
    }
    
    return cleanedBookings;
}

// Функция для выполнения очистки с сохранением
function performCleanup() {
    try {
        if (!fs.existsSync(DATA_FILE)) return;
        
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const oldCount = Object.keys(bookings).length;
        
        const cleanedBookings = cleanOldBookings(bookings);
        
        if (oldCount !== Object.keys(cleanedBookings).length) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(cleanedBookings, null, 2));
            console.log(`🧹 [${new Date().toLocaleString()}] Очистка выполнена: ${oldCount} -> ${Object.keys(cleanedBookings).length} записей`);
        } else {
            console.log(`✅ [${new Date().toLocaleString()}] Старых записей не найдено. Всего записей: ${oldCount}`);
        }
    } catch (error) {
        console.error('❌ Ошибка при очистке:', error.message);
    }
}

// ============ API ============

// API: Получить все записи (только будущие)
app.get('/api/bookings', (req, res) => {
    try {
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
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

// API: Получить все записи (включая прошлые - для админа)
app.get('/api/bookings/all', (req, res) => {
    try {
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(bookings);
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
        
        let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const key = `${date}_${time}`;
        
        // Проверяем, не занято ли время
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

// API: Удалить запись (только для админа)
app.delete('/api/bookings/:date/:time', (req, res) => {
    try {
        const { date, time } = req.params;
        const { adminPhone } = req.body;
        
        // Простая проверка админа
        const ADMIN_PHONES = ['+79954801080'];
        
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
        
        console.log(`🗑️ Удалена запись: ${date} ${time}`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Ручная очистка (для админа)
app.post('/api/cleanup', (req, res) => {
    try {
        const { adminPhone } = req.body;
        const ADMIN_PHONES = ['+79954801080'];
        
        if (!ADMIN_PHONES.includes(adminPhone)) {
            return res.status(403).json({ error: 'Нет прав' });
        }
        
        performCleanup();
        
        res.json({ success: true, message: 'Очистка выполнена' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Статистика
app.get('/api/stats', (req, res) => {
    try {
        const bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

// Обработка всех остальных маршрутов (для SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ ЗАПУСК СЕРВЕРА ============
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Файл данных: ${DATA_FILE}`);
    console.log(`🧹 Автоочистка старых записей: включена (каждый час)\n`);
    
    // Запускаем очистку при старте сервера
    setTimeout(() => {
        console.log('🧹 Запуск начальной очистки...');
        performCleanup();
    }, 3000); // Через 3 секунды после старта
    
    // Запускаем периодическую очистку каждый час
    setInterval(() => {
        console.log('\n⏰ Запуск плановой очистки...');
        performCleanup();
    }, 60 * 60 * 1000); // 60 минут * 60 секунд * 1000 мс
});
