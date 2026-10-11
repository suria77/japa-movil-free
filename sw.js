/* Service Worker — la app se abre aunque la red falle o esté bloqueada.
   - La página principal y los recursos se guardan en el móvil y se sirven desde ahí al instante;
     se actualizan en segundo plano cuando hay conexión.
   - Los audios (mp3) se guardan al reproducirlos por primera vez, para poder oírlos sin conexión.
   - /api/* (licencia) y los vídeos nunca se guardan.
   Para forzar que todos los móviles descarguen todo de nuevo, sube el número de VERSION. */
var VERSION = 'v1';
var SHELL = 'jp-shell-' + VERSION;      /* página, imágenes, tipografías, etc. */
var MEDIA = 'jp-media-' + VERSION;      /* audios reproducidos */
var MAX_AUDIO_BYTES = 40 * 1024 * 1024;
var SCOPE_URL = self.registration.scope; /* p. ej. https://japa.dharmaeterno.com/ */

var PRECACHE = [SCOPE_URL, SCOPE_URL + 'manifest.webmanifest', SCOPE_URL + 'img/icon.png'];

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
        if ((k.indexOf('jp-shell-') === 0 && k !== SHELL) || (k.indexOf('jp-media-') === 0 && k !== MEDIA)) {
          return caches.delete(k);
        }
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
  fetch(url).then(function (r) {
    var len = parseInt(r.headers.get('content-length') || '0', 10);
    if (!r.ok || r.status !== 200 || (len && len > MAX_AUDIO_BYTES)) return;
    return caches.open(MEDIA).then(function (c) { return c.put(url, r); });
  }).catch(function () {}).then(function () { delete pendingAudio[url]; });
}

function audioResponse(event) {
  var request = event.request;
  return caches.open(MEDIA).then(function (c) { return c.match(request.url); }).then(function (hit) {
    if (hit) return rangeFromCache(request, hit);
    cacheAudioInBackground(request.url);
    return fetch(request);
  });
}

/* Caché primero, y se refresca en segundo plano */
function staleWhileRevalidate(event, cacheKey) {
  return caches.open(SHELL).then(function (c) {
    return c.match(cacheKey).then(function (hit) {
      var update = fetch(cacheKey === SCOPE_URL ? SCOPE_URL : event.request).then(function (r) {
        if (r && r.ok && r.status === 200 && !r.redirected) c.put(cacheKey, r.clone());
        return r;
      });
      if (hit) {
        event.waitUntil(update.catch(function () {}));
        return hit;
      }
      return update;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;
  if (url.href.indexOf(SCOPE_URL) !== 0) return;
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
