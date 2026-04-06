
// Хранилище данных
let user = JSON.parse(localStorage.getItem('massage_user')) || null;
let bookings = {}; 
let currentWeekOffset = 0;
let selectedDate = null;
let selectedTime = null;
let subscription = null;


// Проверка на админа (по паролю или по особому телефону)

const ADMIN_PHONES = ['+79954801080'];
const ADMIN_PASSWORD_HASH = '7d117401bd9810300f9368b9efc3377c4897927dc9baeb020a8c291a2d0ca6b1'; // Ты можешь поменять на свой пароль
let isAdminMode = false;
let adminLoginAttempts = 0;;


// Функция проверки пароля
async function verifyAdminPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === ADMIN_PASSWORD_HASH;
}

function checkAdminAccess() {
    // Если телефон пользователя в списке админов
    if (user && ADMIN_PHONES.includes(user.phone)) {
        // Показываем кнопку админа, но требуем пароль для активации
        showAdminButton();
    }
}

function showAdminButton() {
    const adminBtn = document.getElementById('admin-btn');
    adminBtn.style.opacity = '1';
    adminBtn.style.background = '#d4a574';
    adminBtn.style.color = 'white';
    adminBtn.style.borderRadius = '50%';
    adminBtn.style.width = '40px';
    adminBtn.style.height = '40px';
    adminBtn.style.border = 'none';
    adminBtn.style.cursor = 'pointer';
    adminBtn.title = 'Вход для мастера';
    
    // Клик по кнопке - запрос пароля
    adminBtn.addEventListener('click', requestAdminPassword);
}

async function requestAdminPassword() {
    if (isAdminMode) {
        showAdminPanel();
        return;
    }
    
    const password = prompt('🔐 Введите пароль мастера:', '');
    
    const isValid = await verifyAdminPassword(password);
    if (isValid) {
        adminLoginAttempts = 0;
        isAdminMode = true;
        showAdminPanel();
        
        localStorage.setItem('massage_admin_auth', JSON.stringify({
            phone: user.phone,
            expires: Date.now() + (24 * 60 * 60 * 1000)
        }));
        
        const adminBtn = document.getElementById('admin-btn');
        adminBtn.style.background = '#10b981';
        adminBtn.title = 'Режим мастера активен';
    } else {
        adminLoginAttempts++;
        alert(`Неверный пароль! Попытка ${adminLoginAttempts}/3`);
        
        if (adminLoginAttempts >= 3) {
            const adminBtn = document.getElementById('admin-btn');
            adminBtn.style.display = 'none';
            alert('Доступ заблокирован на 5 минут');
            setTimeout(() => {
                adminBtn.style.display = 'block';
                adminLoginAttempts = 0;
            }, 5 * 60 * 1000);
        }
    }
}

// Проверка при загрузке приложения
function checkSavedAdminAuth() {
    try {
        const saved = localStorage.getItem('massage_admin_auth');
        if (saved) {
            const auth = JSON.parse(saved);
            if (auth.phone === user.phone && auth.expires > Date.now()) {
                isAdminMode = true;
                console.log('✅ Админ-сессия восстановлена');
            } else {
                localStorage.removeItem('massage_admin_auth');
            }
        }
    } catch (e) {
        console.warn('Ошибка проверки админ-сессии:', e);
    }
}

function enableAdminMode() {
    isAdminMode = true;
    
    // Показываем видимую кнопку админа
    const adminBtn = document.getElementById('admin-btn');
    adminBtn.style.opacity = '1';
    adminBtn.style.background = '#d4a574';
    adminBtn.style.color = 'white';
    adminBtn.style.borderRadius = '50%';
    adminBtn.style.width = '40px';
    adminBtn.style.height = '40px';
    adminBtn.style.border = 'none';
    adminBtn.style.cursor = 'pointer';
    adminBtn.title = 'Режим мастера';
    
    // Добавляем функционал долгого нажатия для выхода
    let pressTimer;
    adminBtn.addEventListener('mousedown', () => {
        pressTimer = setTimeout(showAdminPanel, 2000); // 2 секунды
    });
    
    adminBtn.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
    });
    
    adminBtn.addEventListener('touchstart', () => {
        pressTimer = setTimeout(showAdminPanel, 2000);
    });
    
    adminBtn.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });
    
    // Или просто клик для панели
    adminBtn.addEventListener('click', showAdminPanel);
}


// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker зарегистрирован успешно: ', registration.scope);
        
        // Проверка обновлений
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Найдено обновление Service Worker');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Новая версия доступна, можно показать уведомление
              console.log('Новая версия доступна! Обновите страницу.');
            }
          });
        });
      })
      .catch(err => {
        console.log('Ошибка регистрации Service Worker: ', err);
      });
  });
  
  // Показываем кнопку "Установить" для PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const installPromptEvent = e;
    
    // Можно показывать кнопку установки когда нужно
    // Например, после успешной записи
    window.showInstallPrompt = () => {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Пользователь установил PWA');
        }
        window.installPromptEvent = null;
      });
    };
    
    window.installPromptEvent = installPromptEvent;
  });
}


function showRegistrationModal() {
    // Удаляем старую модалку если есть
    const oldModal = document.getElementById('registration-modal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'registration-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <i class="fas fa-user-plus"></i>
                <h3>Привет!</h3>
            </div>
            <p style="margin-bottom: 20px; color: #8b7355;">Давайте познакомимся</p>
            
            <div class="form-group">
                <label>Как вас зовут?</label>
                <input type="text" id="user-name" placeholder="Ваше имя" autocomplete="off">
            </div>
            
            <div class="form-group">
                <label>Телефон</label>
                <input type="tel" id="user-phone" placeholder="+7 999 123-45-67" autocomplete="off">
            </div>
            
            <div class="modal-footer">
                <button id="register-btn" class="btn-primary">Продолжить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Прямой обработчик без формы
    const btn = document.getElementById('register-btn');
    const nameInput = document.getElementById('user-name');
    const phoneInput = document.getElementById('user-phone');
    
    const saveUser = () => {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        if (!name || !phone) {
            alert('Заполните оба поля');
            return;
        }
        
        // Простая валидация
        if (name.length < 2) {
            alert('Имя слишком короткое');
            return;
        }
        
        // Нормализуем телефон
        let cleanPhone = phone.replace(/[^0-9+]/g, '');
        if (!cleanPhone.startsWith('+')) {
            cleanPhone = '+7' + cleanPhone.replace(/^[78]/, '');
        }
        
        user = { name: name, phone: cleanPhone };
        localStorage.setItem('massage_user', JSON.stringify(user));
        
        modal.remove();
        initApp();
    };
    
    btn.onclick = saveUser;
    
    // Enter на полях
    nameInput.onkeypress = (e) => { if (e.key === 'Enter') saveUser(); };
    phoneInput.onkeypress = (e) => { if (e.key === 'Enter') saveUser(); };
}

function showWelcomeMessage(name) {
    const welcome = document.createElement('div');
    welcome.className = 'welcome-message';
    welcome.innerHTML = `
        <div>Привет, ${name}! Теперь запись займет 2 клика</div>
    `;
    welcome.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #d4a574 0%, #b89370 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        z-index: 1000;
        box-shadow: 0 5px 15px rgba(212, 165, 116, 0.3);
        animation: slideDown 0.5s ease;
    `;
    
    document.body.appendChild(welcome);
    
    setTimeout(() => {
        welcome.remove();
    }, 3000);
}




// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    // updateStats();
});


// Обновление текущей даты в шапке
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('current-date').textContent = 
        now.toLocaleDateString('ru-RU', options);
}

// Рендеринг недели от текущего дня
function renderWeek() {
    const weekGrid = document.getElementById('week-grid');
    weekGrid.innerHTML = '';
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Начинаем с сегодняшнего дня
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + (currentWeekOffset * 7));
    
    // Заголовок недели
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const weekTitle = currentWeekOffset === 0 
        ? 'Эта неделя' 
        : `Неделя с ${formatDate(startDate, 'short')}`;
    
    document.getElementById('week-title').textContent = weekTitle;
    
    // Генерация 7 дней начиная с сегодня/начала недели
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dateStr = formatDate(date, 'input');
        const isToday = isSameDay(date, now);
        const isPast = date < today && !isToday;
        
        // Больше не считаем записи - показываем только доступность
        const hasBookings = Object.values(bookings).some(booking => {
            // Проверяем разными способами
            const bookingDate = booking.date;
            return bookingDate === dateStr;
        });
        
        const dayCard = document.createElement('div');
        dayCard.className = `day-card ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`;
        
        // Если день прошедший, делаем его неактивным
        if (isPast) {
            dayCard.innerHTML = `
                <div class="day-name">${getDayName(date)}</div>
                <div class="day-number">${date.getDate()}</div>
                <div style="font-size: 11px; color: #b89370; margin-top: 3px;">
                    <i class="fas fa-lock"></i>
                </div>
            `;
        } else {
            // Просто показываем день, без счетчиков
            dayCard.innerHTML = `
                <div class="day-name">${getDayName(date)}</div>
                <div class="day-number">${date.getDate()}</div>
                ${hasBookings ? `
                    <div style="font-size: 11px; color: #d4a574; margin-top: 3px;">
                        <i class="fas fa-user-check"></i>
                    </div>
                ` : ''}
            `;
            
            dayCard.addEventListener('click', () => selectDay(dateStr, date));
        }
        
        weekGrid.appendChild(dayCard);
    }
}

// Выбор дня
function selectDay(dateStr, date) {
    selectedDate = dateStr;
    
    // Переключаем вид
    document.getElementById('week-view').classList.add('hidden');
    document.getElementById('day-view').classList.remove('hidden');
    
    // Показываем выбранную дату
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('selected-date').textContent = 
        date.toLocaleDateString('ru-RU', options);
    
    // Рендерим слоты времени
    renderTimeSlots();
}

// Рендеринг слотов времени (10:00 - 20:00)
// Рендеринг слотов времени (10:00 - 20:00)
function renderTimeSlots() {
    const slotsContainer = document.getElementById('time-slots');
    slotsContainer.innerHTML = '';
    
    const now = new Date();
    const todayStr = formatDate(now, 'input');
    const isToday = selectedDate === todayStr;
    
    const normalizeTime = (timeStr) => {
        if (!timeStr) return null;
        const hour = timeStr.split(':')[0];
        return `${hour.padStart(2, '0')}:00`;
    };
    
    // Находим все записи на выбранную дату
    const dateBookings = Object.entries(bookings)
        .filter(([key, booking]) => {
            const keyDate = key.split('_')[0];
            return keyDate === selectedDate || booking.date === selectedDate;
        })
        .map(([key, booking]) => ({
            key: key,
            time: normalizeTime(booking.time || key.split('_')[1]),
            ...booking
        }));
    
    // Генерация слотов с 10:00 до 20:00
    for (let hour = 10; hour < 20; hour++) {
        const time = `${hour.toString().padStart(2, '0')}:00`;
        const booking = dateBookings.find(b => b.time === time);
        
        const isPast = isToday && hour <= now.getHours();
        
        const slot = document.createElement('div');
        
        // Определяем класс в зависимости от статуса
        let statusClass = 'free';
        let showCancelBtn = false;
        
        if (booking) {
            if (booking.status === 'confirmed') {
                statusClass = 'confirmed';
            } else if (booking.status === 'pending') {
                statusClass = 'pending';
                // Показываем кнопку отмены только для текущего пользователя
                if (user && booking.phone === user.phone) {
                    showCancelBtn = true;
                }
            }
        }
        
        slot.className = `time-slot ${statusClass} ${isPast ? 'past' : ''}`;
        
        if (booking) {
            slot.innerHTML = `
                <div class="time">${time}</div>
                <div class="booking-info">
                    <div class="client-name">${booking.name}</div>
                    <div class="service">${booking.service}</div>
                    ${booking.status === 'pending' ? '<div class="status-badge pending">⏳ Ожидает</div>' : ''}
                </div>
                ${showCancelBtn ? `<button class="cancel-btn">Отменить</button>` : ''}
            `;
            
            if (showCancelBtn) {
                const cancelBtn = slot.querySelector('.cancel-btn');
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cancelMyBooking(booking.key || `${selectedDate}_${time}`, booking.phone);
                });
            }
        } else {
            slot.innerHTML = `
                <div class="time">${time}</div>
                <div class="booking-info">
                    <div>Свободно</div>
                </div>
                ${!isPast ? `<button class="book-btn">Записаться</button>` : ''}
            `;
            
            if (!isPast) {
                const bookBtn = slot.querySelector('.book-btn');
                bookBtn.addEventListener('click', () => openBookingModal(time));
            }
        }
        
        slotsContainer.appendChild(slot);
    }
}

// Функция отмены записи клиентом
async function cancelMyBooking(key, phone) {
    if (!confirm('Отменить запись?')) return;
    
    const [date, time] = key.split('_');
    
    try {
        await bookingAPI.cancelMyBooking(date, time, phone);
        
        // Обновляем локальные данные
        delete bookings[key];
        
        // Обновляем интерфейс
        renderTimeSlots();
        renderWeek();
        
        showMessage('❌ Запись отменена', '#ef4444');
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

function showMessage(text, color) {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 12px;
        border-radius: 10px;
        text-align: center;
        z-index: 1000;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
}

// Открытие модального окна записи
function openBookingModal(time) {
    selectedTime = time;
    
    const modal = document.getElementById('booking-modal');
    modal.classList.remove('hidden');
    
    const date = new Date(selectedDate);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = date.toLocaleDateString('ru-RU', options);
    
    // Автоматически заполняем данные пользователя
    document.getElementById('modal-title').innerHTML = `
        <div style="font-size: 14px; color: #8b7355; margin-bottom: 5px;">
            ${user.name} (${user.phone})
        </div>
        <div>${dateStr} в ${time}</div>
    `;
    
    // Скрываем поля ввода (но оставляем в DOM для отправки)
    const form = document.getElementById('booking-form');
    form.style.display = 'none';
    
    // Показываем подтверждение
    const confirmDiv = document.createElement('div');
    confirmDiv.id = 'booking-confirm';
    confirmDiv.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 15px;"></div>
            <h3 style="color: #5c4b37; margin-bottom: 10px;">Всё верно?</h3>
            <div style="background: #f9f3e9; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <div><strong>Клиент:</strong> ${user.name}</div>
                <div><strong>Телефон:</strong> ${user.phone}</div>
                <div><strong>Время:</strong> ${dateStr} в ${time}</div>
                <div style="margin-top: 10px;">
                    <select id="quick-service" style="width: 100%;">
                        <option>Общий массаж</option>
                        <option>Массаж спины</option>
                        <option>Расслабляющий</option>
                    </select>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="button" id="cancel-quick" class="btn-secondary">
                    Отмена
                </button>
                <button type="button" id="confirm-booking" class="btn-primary">
                    <i class="fas fa-check"></i> Записаться!
                </button>
            </div>
        </div>
    `;
    
    form.parentNode.insertBefore(confirmDiv, form);
    
    // Обработчики для новой кнопки
    document.getElementById('confirm-booking').addEventListener('click', saveQuickBooking);
    document.getElementById('cancel-quick').addEventListener('click', closeModal);
}

async function saveQuickBooking() {
    const service = document.getElementById('quick-service').value;
    const serviceRegex = /^[А-ЯЁа-яё\s\-\d]+$/;
    if (!serviceRegex.test(service)) {
        alert('Название услуги содержит недопустимые символы');
        return;
    }
    
    try {
        // СОХРАНЯЕМ ВРЕМЯ В ОТДЕЛЬНУЮ ПЕРЕМЕННУЮ
        const bookingTime = selectedTime; // ← сохраняем до закрытия
        
        const bookingData = {
            date: selectedDate,
            time: bookingTime,
            name: user.name,
            phone: user.phone,
            service: service
        };
        
        // Сохраняем в Supabase
        const newBooking = await bookingAPI.createBooking(bookingData);
        
        // Обновляем локальную копию
        const key = `${selectedDate}_${bookingTime}`;
        bookings[key] = newBooking;
        
        // Обновляем интерфейс
        renderTimeSlots();
        renderWeek();
        
        showSuccessMessage();
        closeModal();
        
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
        console.error('Ошибка сохранения:', error);
    }
}

async function initApp() {
    // Убираем ранний return, сначала проверяем пользователя
    updateCurrentDate();
    
    // Если нет пользователя - показываем регистрацию и ждём
    if (!user) {
        console.log('Нет пользователя, показываем регистрацию');
        // Регистрация уже показывается через showRegistrationModal() при загрузке
        return; // Выходим, регистрация обработает остальное
    }
    
    try {
        // Загружаем данные из API
        bookings = await bookingAPI.getAllBookings();
        console.log('Загружено записей:', Object.keys(bookings).length);
        
        renderWeek();
        
        // Подписываемся на изменения
        if (bookingAPI.subscribeToChanges) {
            subscription = bookingAPI.subscribeToChanges(async () => {
                console.log('Обновляем данные...');
                bookings = await bookingAPI.getAllBookings();
                renderWeek();
                if (selectedDate) renderTimeSlots();
            });
        }
        
        checkSavedAdminAuth();
        checkAdminAccess();
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        bookings = {};
    }
}

// Измените DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Показываем регистрацию если нет пользователя
    if (!user) {
        showRegistrationModal();
    } else {
        initApp();
    }
});

function showSuccessMessage() {
    const success = document.createElement('div');
    success.className = 'success-message';
    success.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-check-circle" style="color: #10b981; font-size: 20px;"></i>
            <div>
                <strong>Запись подтверждена!</strong><br>
                <small>Вы записаны на ${selectedDate} в ${selectedTime}</small>
            </div>
        </div>
    `;
    
    success.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 20px;
        right: 20px;
        background: white;
        color: #5c4b37;
        padding: 15px;
        border-radius: 12px;
        z-index: 1000;
        box-shadow: 0 5px 20px rgba(92, 75, 55, 0.2);
        animation: slideUp 0.5s ease;
    `;
    
    document.body.appendChild(success);
    
    setTimeout(() => {
        success.style.animation = 'slideDown 0.5s ease';
        setTimeout(() => success.remove(), 500);
    }, 3000);
}

// Сохранение записи
async function saveBooking() {
	const serviceRegex = /^[А-ЯЁа-яё\s\-\d]+$/;
	    if (!serviceRegex.test(service)) {
	        alert('Название услуги содержит недопустимые символы');
	        return;
	    }
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const service = document.getElementById('service').value;
    
    if (!name || !phone) {
        alert('Пожалуйста, заполните имя и телефон');
        return;
    }
    
    try {
        const bookingData = {
            date: selectedDate,
            time: selectedTime,
            name: name,
            phone: phone,
            service: service
        };
        
        // Сохраняем в Supabase
        await bookingAPI.createBooking(bookingData);
        
        // Обновляем локальную копию
        const key = `${selectedDate}_${selectedTime}`;
        bookings[key] = bookingData;
        
        showSuccessMessage();
        closeModal();
        
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
        console.error('Ошибка сохранения:', error);
    }
}

// Получение записей на дату
function getBookingsForDate(dateStr) {
    return Object.entries(bookings)
        .filter(([key, booking]) => {
            // Проверяем и по ключу и по объекту
            return key.startsWith(dateStr) || booking.date === dateStr;
        })
        .map(([, value]) => value);
}


// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация по неделям
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekOffset--;
        renderWeek();
    });
    
    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekOffset++;
        renderWeek();
    });
    
    // Кнопка "Назад" в дневном виде
    document.getElementById('back-button').addEventListener('click', () => {
        document.getElementById('week-view').classList.remove('hidden');
        document.getElementById('day-view').classList.add('hidden');
    });
    
    // Форма записи
    document.getElementById('booking-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveBooking();
    });
    
    // Кнопки закрытия модального окна
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('close-modal').addEventListener('click', closeModal);
    
    // Закрытие модалки по клику вне ее
    document.getElementById('booking-modal').addEventListener('click', (e) => {
        if (e.target.id === 'booking-modal') {
            closeModal();
        }
    });
    
    // Закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Закрытие модального окна
function closeModal() {
    const modal = document.getElementById('booking-modal');
    modal.classList.add('hidden');
    
    // Восстанавливаем форму на случай следующего открытия
    const form = document.getElementById('booking-form');
    form.style.display = 'block';
    
    // Удаляем блок подтверждения если есть
    const confirmDiv = document.getElementById('booking-confirm');
    if (confirmDiv) {
        confirmDiv.remove();
    }
    
    selectedTime = null;
}

// Вспомогательные функции
function formatDate(date, type = 'input') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (type === 'input') {
        return `${year}-${month}-${day}`;
    } else if (type === 'short') {
        return `${day}.${month}`;
    }
    return `${day}.${month}.${year}`;
}

function getDayName(date) {
    const days = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    return days[date.getDay()];
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}


function showAdminPanel() {
    const panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.innerHTML = `
        <div class="admin-modal">
            <div class="admin-header">
                <i class="fas fa-user-shield"></i>
                <h3>Панель мастера</h3>
                <button id="close-admin" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="overview">Обзор</button>
                <button class="admin-tab" data-tab="bookings">Все записи</button>
                <button class="admin-tab" data-tab="clients">Клиенты</button>
                <button class="admin-tab" data-tab="settings">Настройки</button>
            </div>
            
            <div class="admin-content">
                <div id="tab-overview" class="admin-tab-content active">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #e8f5e9;">
                                <i class="fas fa-calendar-check" style="color: #4CAF50;"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value" id="total-bookings-admin">0</div>
                                <div class="stat-label">Всего записей</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #e3f2fd;">
                                <i class="fas fa-users" style="color: #2196F3;"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value" id="unique-clients">0</div>
                                <div class="stat-label">Уникальных клиентов</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #fff3e0;">
                                <i class="fas fa-star" style="color: #FF9800;"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value" id="popular-service">-</div>
                                <div class="stat-label">Популярная услуга</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="today-bookings">
                        <h4><i class="fas fa-clock"></i> Сегодня</h4>
                        <div id="today-list"></div>
                    </div>
                    // Ожидающие подтверждения записи
                    const pendingBookings = Object.values(bookings).filter(b => b.status === 'pending');
                    const pendingList = document.getElementById('pending-list') || createPendingList();
                    if (pendingList) {
                        pendingList.innerHTML = pendingBookings.map(booking => `
                            <div class="pending-item" data-date="${booking.date}" data-time="${booking.time}">
                                <div class="time-badge">${booking.time}</div>
                                <div class="booking-details">
                                    <strong>${booking.name}</strong>
                                    <small>${booking.phone}</small>
                                    <div>${booking.service}</div>
                                </div>
                                <div class="pending-actions">
                                    <button class="confirm-pending" style="background:#10b981;">✅</button>
                                    <button class="reject-pending" style="background:#ef4444;">❌</button>
                                </div>
                            </div>
                        `).join('');
                </div>
                
                <div id="tab-bookings" class="admin-tab-content">
                    <div class="admin-actions">
                        <button id="export-btn" class="btn-secondary">
                            <i class="fas fa-file-export"></i> Экспорт в Excel
                        </button>
                    </div>
                    
                    <div class="bookings-list" id="all-bookings-list"></div>
                </div>
                
                <div id="tab-clients" class="admin-tab-content">
                    <div class="clients-list" id="clients-list"></div>
                </div>
                
                <div id="tab-settings" class="admin-tab-content">
                    <div class="backup-section">
                        <h4><i class="fas fa-database"></i> Резервное копирование</h4>
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button id="backup-export" class="btn-secondary">
                                <i class="fas fa-download"></i> Экспорт
                            </button>
                            <button id="backup-import" class="btn-secondary">
                                <i class="fas fa-upload"></i> Импорт
                            </button>
                        </div>
                        <small style="color: #8b7355; margin-top: 10px; display: block;">
                            📁 Все записи хранятся в вашем браузере. Регулярно делайте бэкап!
                        </small>
                    </div>
                    
                    <input type="file" id="backup-file" accept=".json" style="display: none;">
                    
                    <div class="form-group">
                        <label>Услуги</label>
                        <div id="services-list">
                            <div class="service-item">
                                <input type="text" value="Общий массаж">
                                <button class="remove-service"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                        <button id="add-service" class="btn-secondary">
                            <i class="fas fa-plus"></i> Добавить услугу
                        </button>
                    </div>
                    
                    <button id="save-settings" class="btn-primary">
                        <i class="fas fa-save"></i> Сохранить настройки
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Загружаем данные
    loadAdminData();
    
    // Обработчики вкладок
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
    
    // Закрытие панели
    document.getElementById('close-admin').addEventListener('click', () => {
        panel.remove();
    });
    
    // Экспорт в Excel
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    
    // Бэкап
    const backupExport = document.getElementById('backup-export');
    if (backupExport) {
        backupExport.addEventListener('click', () => {
            bookingAPI.exportBookings();
            alert('✅ Бэкап сохранен');
        });
    }
    
    const backupImport = document.getElementById('backup-import');
    if (backupImport) {
        backupImport.addEventListener('click', () => {
            document.getElementById('backup-file').click();
        });
    }
    
    const backupFile = document.getElementById('backup-file');
    if (backupFile) {
        backupFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    await bookingAPI.importBookings(e.target.files[0]);
                    alert('✅ Бэкап восстановлен! Обновите страницу.');
                    location.reload();
                } catch (error) {
                    alert('❌ Ошибка: ' + error);
                }
            }
        });
    }
    
    // Клик вне панели для закрытия
    panel.addEventListener('click', (e) => {
        if (e.target.id === 'admin-panel') {
            panel.remove();
        }
    });

     document.querySelectorAll('.confirm-pending').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = btn.closest('.pending-item');
            const date = item.dataset.date;
            const time = item.dataset.time;
            await bookingAPI.confirmBooking(date, time, user.phone);
            location.reload();
        });
    });
    
    document.querySelectorAll('.reject-pending').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = btn.closest('.pending-item');
            const date = item.dataset.date;
            const time = item.dataset.time;
            await bookingAPI.deleteBooking(date, time, user.phone);
            location.reload();
        });
    });
}

function loadAdminData() {
    // Считаем статистику
    const totalBookings = Object.keys(bookings).length;
    document.getElementById('total-bookings-admin').textContent = totalBookings;
    
    // Уникальные клиенты
    const uniqueClients = new Set(Object.values(bookings).map(b => b.phone)).size;
    document.getElementById('unique-clients').textContent = uniqueClients;
    
    // Популярная услуга
    const services = Object.values(bookings).map(b => b.service);
    const serviceCount = {};
    services.forEach(s => serviceCount[s] = (serviceCount[s] || 0) + 1);
    const popularService = Object.keys(serviceCount).reduce((a, b) => 
        serviceCount[a] > serviceCount[b] ? a : b, 'Нет данных'
    );
    document.getElementById('popular-service').textContent = popularService;
    
    // Записи на сегодня
    const today = formatDate(new Date(), 'input');
    const todayBookings = Object.values(bookings).filter(b => b.date === today);
    
    const todayList = document.getElementById('today-list');
    todayList.innerHTML = todayBookings.map(booking => `
        <div class="today-item">
            <div class="time-badge">${booking.time}</div>
            <div class="booking-details">
                <strong>${booking.name}</strong>
                <small>${booking.service}</small>
            </div>
            <button class="call-btn" onclick="window.location.href='tel:${booking.phone}'">
                <i class="fas fa-phone"></i>
            </button>
        </div>
    `).join('');
    
    // Все записи
    const allBookings = Object.values(bookings)
        .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
    
    const allList = document.getElementById('all-bookings-list');
    allList.innerHTML = allBookings.map(booking => `
        <div class="booking-item">
            <div class="booking-date">
                <div class="booking-day">${new Date(booking.date).getDate()}</div>
                <div class="booking-month">${getMonthName(new Date(booking.date))}</div>
            </div>
            <div class="booking-info">
                <div class="booking-time">${booking.time}</div>
                <div class="booking-client">
                    <strong>${booking.name}</strong>
                    <small>${booking.phone}</small>
                </div>
                <div class="booking-service">${booking.service}</div>
            </div>
            <div class="booking-actions">
                <button class="action-btn call" onclick="window.location.href='tel:${booking.phone}'">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="action-btn delete" onclick="deleteBooking('${booking.date}_${booking.time}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Список клиентов
    const clients = {};
    Object.values(bookings).forEach(booking => {
        if (!clients[booking.phone]) {
            clients[booking.phone] = {
                name: booking.name,
                phone: booking.phone,
                bookings: 0,
                lastVisit: booking.date
            };
        }
        clients[booking.phone].bookings++;
        if (booking.date > clients[booking.phone].lastVisit) {
            clients[booking.phone].lastVisit = booking.date;
        }
    });
    
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = Object.values(clients).map(client => `
        <div class="client-item">
            <div class="client-avatar">
                ${client.name.charAt(0).toUpperCase()}
            </div>
            <div class="client-info">
                <div class="client-name">${client.name}</div>
                <div class="client-phone">${client.phone}</div>
                <div class="client-stats">
                    <span class="client-visits">${client.bookings} посещений</span>
                    <span class="client-last">Последний: ${client.lastVisit}</span>
                </div>
            </div>
            <div class="client-actions">
                <button class="action-btn call" onclick="window.location.href='tel:${client.phone}'">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="action-btn message" onclick="sendSMS('${client.phone}')">
                    <i class="fas fa-sms"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function exportToExcel() {
    const bookingsData = Object.values(bookings)
        .map(b => `${b.date},${b.time},${b.name},${b.phone},${b.service}`)
        .join('\n');
    
    const csv = 'Дата,Время,Имя,Телефон,Услуга\n' + bookingsData;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `записи_массаж_${formatDate(new Date(), 'input')}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
}

async function deleteBooking(key) {
    if (!confirm('Удалить эту запись?')) return;
    
    const [date, time] = key.split('_');
    
    try {
        await bookingAPI.deleteBooking(date, time, user.phone);
        
        // Обновляем локально
        delete bookings[key];
        
        // Обновляем интерфейсы
        if (typeof loadAdminData === 'function') loadAdminData();
        renderWeek();
        if (selectedDate === date) renderTimeSlots();
        
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

function getMonthName(date) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return months[date.getMonth()];
}


// Функция для проигрывания звука
function playNotificationSound() {
  try {
    // Создаем простой звук "динь" с помощью Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Высокий приятный звук
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
  } catch (e) {
    // Fallback - простой бип
    console.log("🔔 Новая запись!");
  }
}

// Альтернативный вариант - используем встроенный звук
function playSimpleSound() {
  try {
    // Создаем короткий звуковой сигнал
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 800;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Если не поддерживается AudioContext
    console.log("🔔");
  }
}

// Запрашиваем разрешение на уведомления
async function requestNotificationPermission() {
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            // Исправлено: isAdminMode вместо adminMode
            if (window.isAdminMode) {
                const permission = await Notification.requestPermission();
                console.log("Разрешение на уведомления:", permission);
            }
        }
    }
}

// Показываем уведомление
function showNewBookingNotification(bookingData) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification("📅 Новая запись на массаж!", {
      body: `${bookingData.name} - ${bookingData.time}, ${bookingData.service}`,
      icon: "/icon.png", // Добавь иконку в проект
      tag: "new-booking" // Группируем уведомления
    });
  }
}
