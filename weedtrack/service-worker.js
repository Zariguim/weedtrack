// Define um nome e versão para o cache
const CACHE_NAME = 'weedtrack-cache-v1';

// Lista de arquivos para armazenar em cache
const urlsToCache = [
  '/',
  'index.html',
  'WeedtrackFotos.html',
  'WeedtrackMapas.html',
  'BoasVindas.jpeg',
  'Logo.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Evento de 'install': chamado quando o service worker é instalado
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache); // Adiciona todos os nossos arquivos ao cache
      })
  );
});

// Evento de 'fetch': chamado toda vez que a página tenta buscar um arquivo
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se encontrarmos o arquivo no cache, retornamos ele.
        if (response) {
          return response;
        }
        // Se não, buscamos na rede.
        return fetch(event.request);
      })
  );
});