const CACHE_NAME = 'massage-booking-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэшируем файлы приложения');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов
// Перехват запросов - ИСПРАВЛЕННАЯ ВЕРСИЯ
self.addEventListener('fetch', event => {
  // Пропускаем запросы к API (все методы кроме GET)
  if (event.request.url.includes('/api/') || 
      event.request.method !== 'GET') {
    return; // Не кэшируем API запросы и POST/DELETE
  }

  // Пропускаем запросы к Supabase (если остались)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // Кэшируем только успешные GET-запросы
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          });
      })
  );
});

// Фоновая синхронизация (если понадобится позже)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    console.log('Фоновая синхронизация данных');
    // Здесь будет синхронизация с Supabase
  }
});
