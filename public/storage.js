// storage.js - С ПОДДЕРЖКОЙ ПОДТВЕРЖДЕНИЯ ЗАПИСЕЙ

const bookingAPI = {
    API_URL: '/api',
    
    async getAllBookings() {
        try {
            const response = await fetch(`${this.API_URL}/bookings`);
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
            const response = await fetch(`${this.API_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сохранения');
            }
            
            const result = await response.json();
            console.log('✅ Заявка создана (ожидает подтверждения):', result);
            
            this.notifyNewBooking(bookingData);
            
            // Обновляем счётчик pending, если определена функция
            if (typeof window.refreshPendingCount === 'function') {
                window.refreshPendingCount();
            }
            
            return result.booking || bookingData;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw error;
        }
    },
    
    async confirmBooking(date, time, adminPhone) {
        try {
            const response = await fetch(`${this.API_URL}/bookings/${date}/${time}/confirm`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPhone })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка подтверждения');
            }
            
            const result = await response.json();
            console.log(`✅ Запись подтверждена: ${date} ${time}`);
            return result;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw error;
        }
    },
    
    async cancelMyBooking(date, time, phone) {
        try {
            const response = await fetch(`${this.API_URL}/bookings/${date}/${time}/cancel`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка отмены');
            }
            
            console.log(`🚫 Заявка отменена: ${date} ${time}`);
            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка:', error);
            throw error;
        }
    },
    
    async deleteBooking(date, time, adminPhone) {
        try {
            const response = await fetch(`${this.API_URL}/bookings/${date}/${time}`, {
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
        this.playSound();
        
        if (Notification.permission === 'granted') {
            new Notification('📅 Новая заявка!', {
                body: `${booking.name} - ${booking.time}, ${booking.service} (ожидает подтверждения)`,
                icon: '/icons/icon-192.png'
            });
        }
        
        this.showToast(`🔔 Новая заявка от ${booking.name} на ${booking.time}`);
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
        toast.innerHTML = `<div style="position:fixed; bottom:20px; right:20px; background:#5c4b37; color:white; padding:12px 20px; border-radius:12px; z-index:10000; animation:slideInRight 0.3s ease;">${message}</div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },
    
    subscribeToChanges(callback) {
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
        }, 10000);
        return { unsubscribe: () => clearInterval(interval) };
    }
};

// Добавляем CSS анимации
if (!document.querySelector('#storage-styles')) {
    const style = document.createElement('style');
    style.id = 'storage-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

window.bookingAPI = bookingAPI;
console.log('✅ API для Render готов (с поддержкой подтверждения записей)');
console.log('API_URL:', bookingAPI.API_URL);
