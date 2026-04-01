// storage.js - упрощенная версия
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKxv6N3jx6Gfw122clyQzcf1gOxrYTCULmWe1VbuNtd0QCfdrIxJn2PU5iO3qfZOQY/exec'; // Вставьте сюда новый URL

const bookingAPI = {
    async getAllBookings() {
        try {
            const response = await fetch(`${SCRIPT_URL}?action=get`);
            const data = await response.json();
            
            const bookingsMap = {};
            if (Array.isArray(data)) {
                data.forEach(booking => {
                    const key = `${booking.date}_${booking.time}`;
                    bookingsMap[key] = booking;
                });
            }
            
            console.log('✅ Загружено записей:', Object.keys(bookingsMap).length);
            return bookingsMap;
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Не удалось загрузить расписание. Проверьте интернет.');
            return {};
        }
    },
    
    async createBooking(bookingData) {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Ошибка сохранения');
            }
            
            // Отправляем уведомления
            this.sendNotification(bookingData);
            
            console.log('✅ Запись сохранена');
            return bookingData;
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw new Error(error.message || 'Не удалось сохранить запись');
        }
    },
    
    async deleteBooking(date, time, userPhone) {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date, time, adminPhone: userPhone })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Ошибка удаления');
            }
            
            console.log('✅ Запись удалена');
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw new Error('Не удалось удалить запись');
        }
    },
    
    sendNotification(booking) {
        this.playSound();
        this.showVisualNotification(booking);
        
        if (window.isAdminMode) {
            this.showAdminAlert(booking);
        }
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
            console.log('🔔 Новая запись!');
        }
    },
    
    showVisualNotification(booking) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📅 Новая запись!", {
                body: `${booking.name} - ${booking.time}, ${booking.service}`,
                vibrate: [200, 100, 200]
            });
        }
        
        this.showToast(`🔔 ${booking.name} записался на ${booking.time}`);
    },
    
    showAdminAlert(booking) {
        const originalTitle = document.title;
        let count = 0;
        const interval = setInterval(() => {
            document.title = count % 2 === 0 ? '🔔 НОВАЯ ЗАПИСЬ!' : originalTitle;
            count++;
            if (count > 6) clearInterval(interval);
        }, 500);
        
        setTimeout(() => {
            document.title = originalTitle;
        }, 3000);
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
                font-size: 14px;
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    subscribeToChanges(callback) {
        let lastData = null;
        
        const interval = setInterval(async () => {
            try {
                const currentData = await this.getAllBookings();
                if (JSON.stringify(currentData) !== JSON.stringify(lastData)) {
                    console.log('🔄 Обнаружены изменения');
                    callback();
                    lastData = currentData;
                }
            } catch (error) {
                console.error('Ошибка проверки изменений:', error);
            }
        }, 5000);
        
        return {
            unsubscribe: () => clearInterval(interval)
        };
    }
};

// Добавляем CSS анимации
if (!document.querySelector('#storage-styles')) {
    const style = document.createElement('style');
    style.id = 'storage-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

window.bookingAPI = bookingAPI;
console.log('✅ Google Sheets API готов');
