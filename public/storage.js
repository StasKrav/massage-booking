// storage.js - версия для Render.com

const API_URL = '/api';

const bookingAPI = {
    async getAllBookings() {
        try {
            const response = await fetch(`${API_URL}/bookings`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            const data = await response.json();
            console.log('✅ Загружено записей:', Object.keys(data).length);
            return data;
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            return {};
        }
    },
    
    async createBooking(bookingData) {
        try {
            const response = await fetch(`${API_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сохранения');
            }
            
            const result = await response.json();
            
            // Уведомление о новой записи
            this.notifyNewBooking(bookingData);
            
            return result.booking;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw error;
        }
    },
    
    async deleteBooking(date, time, adminPhone) {
        try {
            const response = await fetch(`${API_URL}/bookings/${date}/${time}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPhone })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка удаления');
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw error;
        }
    },
    
    notifyNewBooking(booking) {
        // Звук
        this.playSound();
        
        // Визуальное уведомление
        if (Notification.permission === 'granted') {
            new Notification('📅 Новая запись!', {
                body: `${booking.name} - ${booking.time}, ${booking.service}`,
                icon: '/icons/icon-192.png'
            });
        }
        
        // Мигание заголовка вкладки
        let originalTitle = document.title;
        let count = 0;
        const interval = setInterval(() => {
            document.title = count % 2 === 0 ? '🔔 НОВАЯ ЗАПИСЬ!' : originalTitle;
            count++;
            if (count > 6) clearInterval(interval);
        }, 500);
        setTimeout(() => clearInterval(interval), 3000);
        
        // Тост-уведомление
        this.showToast(`🔔 ${booking.name} записался на ${booking.time}`);
    },
    
    playSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log('🔔');
        }
    },
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #5c4b37;
                color: white;
                padding: 12px 20px;
                border-radius: 12px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">
                ${message}
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },
    
    subscribeToChanges(callback) {
        // Для Render используем простой polling
        let lastData = null;
        const interval = setInterval(async () => {
            try {
                const currentData = await this.getAllBookings();
                if (JSON.stringify(currentData) !== JSON.stringify(lastData)) {
                    callback();
                    lastData = currentData;
                }
            } catch (error) {
                console.error('Ошибка проверки:', error);
            }
        }, 10000); // Проверяем каждые 10 секунд
        
        return { unsubscribe: () => clearInterval(interval) };
    }
};

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

window.bookingAPI = bookingAPI;
console.log('✅ API для Render готов');
