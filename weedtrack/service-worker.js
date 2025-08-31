// Define um nome e versão para o cache
const CACHE_NAME = 'weedtrack-cache-v2'; // ATUALIZADO: Mudei a versão para forçar a atualização

// Lista de arquivos para armazenar em cache
const urlsToCache = [
  // Arquivos Principais
  '/',
  'index.html',
  'WeedtrackFotos.html',
  'WeedtrackMapas.html',
  'manifest.json',

  // Imagens e Ícones
  'BoasVindas.jpeg',
  'Logo.svg',
  'icon-192x192.png',
  'icon-512x512.png',

  // Estilos
  'css/style.css',
  
  // Scripts JavaScript do Projeto
  'js/app.js',
  'js/bula-app.js',
  'js/heatmap-layer.js',
  'js/maps/config.js',
  'js/maps/map-manager.js',
  'js/maps/maps-app.js',
  'js/maps/report-generator.js',
  'js/maps/ui-manager.js',

  // Bibliotecas Externas
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-omnivore@0.3.4/leaflet-omnivore.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.23/dist/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Evento de 'install': chamado quando o service worker é instalado
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, adicionando arquivos essenciais...');
        // Abordagem mais robusta sem 'no-cors'. 
        // Se um arquivo externo falhar, o erro aparecerá no console, facilitando a depuração.
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Falha ao adicionar arquivos ao cache durante a instalação:', error);
      })
  );
});

// Evento de 'fetch': chamado toda vez que a página tenta buscar um arquivo
self.addEventListener('fetch', event => {
  // Ignora requisições que não são GET (como POST para APIs)
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Retorna a resposta do cache se ela existir, senão, busca da rede.
        return cachedResponse || fetch(event.request);
      })
  );
});

// Evento de 'activate': limpa caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});