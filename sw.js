/* Service Worker — la app se abre aunque la red falle o esté bloqueada.
   - La página principal, las tipografías y las imágenes de la interfaz se guardan en el móvil
     y se sirven desde ahí al instante; se actualizan en segundo plano cuando hay conexión.
   - Los audios y las imágenes de malas se guardan al usarlos, o todos de golpe con el botón
     "Usar sin conexión" (ver offline.js).
   - /api/* (licencia) y los vídeos nunca se guardan.
   La lista de archivos sale de offline-files.js (lo genera tools/make-offline-list.py).
   Para forzar que todos los móviles descarguen la interfaz de nuevo, sube VERSION en offline-files.js. */
try { importScripts('offline-files.js'); } catch (e) {}
var CFG = self.JP_OFFLINE || {};
var CN = CFG.caches || { shell: 'jp-shell-v2', media: 'jp-media-v1', assets: 'jp-assets-v1' };
var SHELL = CN.shell;     /* página, interfaz, tipografías (se renueva con VERSION) */
var MEDIA = CN.media;     /* audios (permanente, no se borra al actualizar) */
var ASSETS = CN.assets;   /* imágenes de malas y demás (permanente) */
var MAX_AUDIO_BYTES = 60 * 1024 * 1024;
var SCOPE_URL = self.registration.scope; /* p. ej. https://japa.dharmaeterno.com/ */

var PRECACHE = [SCOPE_URL, SCOPE_URL + 'manifest.webmanifest', SCOPE_URL + 'img/icon.png',
                SCOPE_URL + 'offline.js', SCOPE_URL + 'offline-files.js'];

/* Rutas (relativas) que van a la caché permanente de imágenes */
var ASSET_SET = {};
(CFG.images || []).forEach(function (p) { ASSET_SET[new URL(p, SCOPE_URL).href] = 1; });

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      /* Uno a uno: si falta alguno, no se cancela la instalación */
      return Promise.all(PRECACHE.map(function (u) {
        return fetch(u, { cache: 'reload' }).then(function (r) {
          if (r && r.ok && !r.redirected) return c.put(u, r);
        }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        /* Solo se borran las versiones antiguas de la interfaz; audios e imágenes se conservan */
        if (k.indexOf('jp-shell-') === 0 && k !== SHELL) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAudio(url) { return /\.(mp3|m4a|wav|ogg|aac)$/i.test(url.pathname); }
function isVideo(url) { return /\.(mp4|webm|mov|m4v)$/i.test(url.pathname); }

/* Responde a una petición con Range (los <audio> la usan) a partir del archivo completo guardado */
function rangeFromCache(request, full) {
  var h = request.headers.get('range');
  var m = h && /bytes=(\d*)-(\d*)/.exec(h);
  if (!m) return Promise.resolve(full);
  return full.arrayBuffer().then(function (buf) {
    var size = buf.byteLength;
    var start = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
    var end = (m[1] === '' || m[2] === '') ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
    if (isNaN(start) || start >= size || end < start) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': String(end - start + 1),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

var pendingAudio = {};
function cacheAudioInBackground(url) {
  if (pendingAudio[url]) return;
  pendingAudio[url] = true;
  fetch(url, { headers: { 'x-jp-dl': '1' } }).then(function (r) {
    var len = parseInt(r.headers.get('content-length') || '0', 10);
    if (!r.ok || r.status !== 200 || (len && len > MAX_AUDIO_BYTES)) return;
    return caches.open(MEDIA).then(function (c) { return c.put(url, r); });
  }).catch(function () {}).then(function () { delete pendingAudio[url]; });
}

function audioResponse(event) {
  var request = event.request;
  /* Se busca en todas las cachés: así sirve también los audios descargados con el botón */
  return caches.match(request.url).then(function (hit) {
    if (hit) return rangeFromCache(request, hit);
    cacheAudioInBackground(request.url);
    return fetch(request);
  });
}

/* Caché primero, y se refresca en segundo plano */
function staleWhileRevalidate(event, cacheKey) {
  var target = ASSET_SET[cacheKey] ? ASSETS : SHELL;
  return caches.match(cacheKey).then(function (hit) {
    var update = fetch(cacheKey === SCOPE_URL ? SCOPE_URL : event.request).then(function (r) {
      if (r && r.ok && r.status === 200 && !r.redirected) {
        var copy = r.clone();
        caches.open(target).then(function (c) { c.put(cacheKey, copy); });
      }
      return r;
    });
    if (hit) {
      event.waitUntil(update.catch(function () {}));
      return hit;
    }
    return update;
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;
  if (url.href.indexOf(SCOPE_URL) !== 0) return;
  if (req.headers.has('x-jp-dl')) return;         /* descargas del botón "Usar sin conexión": las gestiona la página */
  if (isVideo(url)) return;                       /* los vídeos van siempre por red */

  if (isAudio(url)) { event.respondWith(audioResponse(event)); return; }

  if (req.mode === 'navigate') {
    /* Cualquier apertura de la app usa la misma página guardada */
    event.respondWith(staleWhileRevalidate(event, SCOPE_URL));
    return;
  }
  if (req.headers.has('range')) return;
  event.respondWith(staleWhileRevalidate(event, req.url));
});
