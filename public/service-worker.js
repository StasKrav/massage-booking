const CACHE_NAME = 'massage-booking-v4';
// Убираем app.js и storage.js из кэша, чтобы они всегда были свежими
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
  // app.js и storage.js НЕ кэшируем - всегда загружаем с сервера
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэшируем только статику');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

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

// Пропускаем все запросы к .js файлам, чтобы они всегда были свежими
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Не кэшируем JS файлы и API
  if (url.includes('.js') || 
      url.includes('/api/') || 
      event.request.method !== 'GET') {
    return; // Идём в сеть
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
