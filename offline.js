/* Uso sin conexión de la app (ver sw.js y offline-files.js)
   - Guarda en segundo plano la interfaz (core) cuando hay conexión.
   - Añade en "Guía de instalación / Instalación" una opción "Usar sin conexión" para guardar
     también los audios y las imágenes de las malas.
   - Muestra un aviso cuando se pierde la conexión y cuando un vídeo no puede cargarse.
   Los textos salen en español o inglés según el atributo lang de la página. */
(function () {
  'use strict';
  var CFG = window.JP_OFFLINE;
  if (!CFG || !('caches' in window)) return;

  var LANG = ((document.documentElement.getAttribute('lang') || 'es').slice(0, 2).toLowerCase() === 'en') ? 'en' : 'es';
  var T = {
    es: {
      offlineBanner: 'Sin conexión. La app sigue funcionando.',
      backOnline: 'Conexión recuperada.',
      videoNeedsNet: 'Este vídeo necesita conexión a Internet.',
      cardName: 'Usar sin conexión',
      cardDesc: 'Guarda audios e imágenes en tu móvil para usar la app sin Internet.',
      title: 'Usar sin conexión',
      sub: 'La app ya se abre sin Internet. Aquí puedes guardar también los audios y las imágenes de las malas para usarlos sin conexión.',
      ui: 'Interfaz de la app', audio: 'Audios', images: 'Imágenes de malas y deidades',
      saved: { f: 'guardada', mp: 'guardados', fp: 'guardadas' }, of: 'de',
      btnAll: 'Descargar todo', btnMore: 'Descargar lo que falta', btnStop: 'Parar',
      downloading: 'Descargando…', stopped: 'Descarga detenida. Puedes continuarla cuando quieras.',
      done: 'Listo: ya puedes usar la app sin conexión.',
      partial: 'Algunos archivos no se pudieron guardar. Inténtalo de nuevo con conexión.',
      needNet: 'Necesitas conexión a Internet para descargar.',
      quota: 'No hay espacio suficiente en el móvil para guardar todo.',
      note: 'Los vídeos de fondo y el vídeo tutorial siguen necesitando conexión. Si puedes, descarga con Wi-Fi: son unos {mb} MB.',
      allSaved: 'Todo está guardado en este móvil.'
    },
    en: {
      offlineBanner: 'You are offline. The app keeps working.',
      backOnline: 'Back online.',
      videoNeedsNet: 'This video needs an Internet connection.',
      cardName: 'Use offline',
      cardDesc: 'Save audio and images on your phone to use the app without Internet.',
      title: 'Use offline',
      sub: 'The app already opens without Internet. Here you can also save the audio and the mala images to use them offline.',
      ui: 'App interface', audio: 'Audio', images: 'Mala and deity images',
      saved: { f: 'saved', mp: 'saved', fp: 'saved' }, of: 'of',
      btnAll: 'Download everything', btnMore: 'Download what is missing', btnStop: 'Stop',
      downloading: 'Downloading…', stopped: 'Download stopped. You can continue whenever you like.',
      done: 'Done: you can now use the app offline.',
      partial: 'Some files could not be saved. Please try again with a connection.',
      needNet: 'You need an Internet connection to download.',
      quota: 'There is not enough space on your phone to save everything.',
      note: 'Background videos and the tutorial video still need a connection. If you can, download on Wi-Fi: it is about {mb} MB.',
      allSaved: 'Everything is saved on this phone.'
    }
  }[LANG];

  var NAMES = CFG.caches || { shell: 'jp-shell-v2', media: 'jp-media-v1', assets: 'jp-assets-v1' };
  function abs(rel) { return new URL(rel, document.baseURI).href; }
  function mb(n) { return Math.max(1, Math.round(n / 1048576)); }

  /* Grupos: cada archivo va a la caché que le toca (la misma que usa sw.js) */
  var GROUPS = {
    core:   { urls: CFG.core || [],   sizes: CFG.coreSz || [],   cache: NAMES.shell },
    images: { urls: CFG.images || [], sizes: CFG.imagesSz || [], cache: NAMES.assets },
    audio:  { urls: CFG.audio || [],  sizes: CFG.audioSz || [],  cache: NAMES.media }
  };

  /* ---------- Estilos ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.jp-off-pill{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translate(-50%,24px);' +
    'z-index:1300;max-width:calc(100% - 28px);padding:12px 18px;border-radius:999px;background:#FDFAFF;color:#2B1050;' +
    'border:2px solid #6B21A8;box-shadow:0 8px 26px rgba(0,0,0,.45);font:700 16px/1.3 Karla,Arial,sans-serif;text-align:center;' +
    'opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease}' +
    '.jp-off-pill.jp-off-on{opacity:1;transform:translate(-50%,0)}' +
    '.jp-help-card-offline{color:#0F3D2E;background:radial-gradient(circle at 90% 0%,rgba(255,255,255,.7) 0%,transparent 55%),' +
    'linear-gradient(135deg,#C9EFD9 0%,#9FDDBB 100%);border:2px solid #fff;box-shadow:0 10px 26px rgba(20,120,80,.26)}' +
    '.jp-help-card-offline .jp-help-card-icon{background:rgba(255,255,255,.8);border:2px solid #fff}' +
    '.jp-off-list{margin:0 0 20px;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}' +
    '.jp-off-list li{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:16px;background:#fff;' +
    'border:2px solid #CDB6EA;font-size:17px;line-height:1.3;color:#2B1050}' +
    '.jp-off-list b{font-weight:800}' +
    '.jp-off-ok{color:#0B6B3F;font-weight:800}' +
    '.jp-off-bar{height:16px;border-radius:999px;background:#E3D6F3;overflow:hidden;margin:6px 0 10px}' +
    '.jp-off-bar>i{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#6B21A8,#86198F);transition:width .25s ease}' +
    '.jp-off-msg{margin:12px 0 0;font-size:17px;line-height:1.45;color:#2B1050;font-weight:700}' +
    '.jp-off-note{margin:18px 0 0;font-size:16px;line-height:1.45;color:#4B3568}' +
    '.jp-off-btn{display:block;width:100%;min-height:60px;padding:14px 18px;border:none;border-radius:18px;font:800 19px/1.2 Karla,Arial,sans-serif;' +
    'color:#fff;background:linear-gradient(135deg,#4C1D95 0%,#6B21A8 55%,#86198F 100%);box-shadow:0 10px 24px rgba(76,29,149,.35);cursor:pointer;' +
    '-webkit-appearance:none;appearance:none}' +
    '.jp-off-btn[disabled]{opacity:.55}' +
    '.jp-off-btn.jp-off-sec{margin-top:12px;color:#3B1A6B;background:#fff;border:2px solid #CDB6EA;box-shadow:none}';
  document.head.appendChild(css);

  /* ---------- Aviso de conexión / avisos breves ---------- */
  var pill = document.createElement('div');
  pill.className = 'jp-off-pill';
  pill.setAttribute('role', 'status');
  pill.setAttribute('aria-live', 'polite');
  var pillTimer = null;
  function showPill(text, ms) {
    pill.textContent = text;
    pill.classList.add('jp-off-on');
    clearTimeout(pillTimer);
    if (ms) pillTimer = setTimeout(function () { pill.classList.remove('jp-off-on'); }, ms);
  }
  function hidePill() { clearTimeout(pillTimer); pill.classList.remove('jp-off-on'); }
  function mountPill() { if (!pill.parentNode) document.body.appendChild(pill); }

  var wasOffline = false;
  function onNet() {
    mountPill();
    if (!navigator.onLine) { wasOffline = true; showPill(T.offlineBanner, 0); }
    else if (wasOffline) { wasOffline = false; showPill(T.backOnline, 2200); preloadCore(); }
    else hidePill();
  }
  window.addEventListener('offline', onNet);
  window.addEventListener('online', onNet);

  /* Los vídeos (fondos, tutorial) no se guardan: si fallan, se avisa en vez de quedarse en blanco */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'VIDEO' && (t.getAttribute('src') || t.currentSrc)) {
      mountPill();
      showPill(T.videoNeedsNet, 4000);
    }
  }, true);

  /* ---------- Estado de lo guardado ---------- */
  function cachedSet(name) {
    return caches.open(name).then(function (c) { return c.keys(); }).then(function (reqs) {
      var s = {};
      reqs.forEach(function (r) { s[r.url] = 1; });
      return s;
    }).catch(function () { return {}; });
  }

  function status() {
    var names = ['core', 'images', 'audio'];
    return Promise.all(names.map(function (n) {
      /* Las imágenes y audios pueden estar en cualquiera de las cachés: se mira en todas */
      return Promise.all([cachedSet(NAMES.shell), cachedSet(NAMES.assets), cachedSet(NAMES.media)]).then(function (sets) {
        var g = GROUPS[n], have = 0, haveBytes = 0, miss = [];
        g.urls.forEach(function (u, i) {
          var a = abs(u);
          if (sets[0][a] || sets[1][a] || sets[2][a]) { have++; haveBytes += (g.sizes[i] || 0); }
          else miss.push(i);
        });
        return { name: n, total: g.urls.length, have: have, missing: miss, bytes: haveBytes };
      });
    })).then(function (arr) {
      var o = {};
      arr.forEach(function (x) { o[x.name] = x; });
      return o;
    });
  }

  /* ---------- Descarga ---------- */
  var job = null;   /* { total, done, stop, running, msg } */

  function fetchAndStore(group, idx) {
    var g = GROUPS[group], url = abs(g.urls[idx]);
    return fetch(url, { headers: { 'x-jp-dl': '1' }, credentials: 'same-origin' }).then(function (r) {
      if (!r || !r.ok || r.status !== 200) throw new Error('http');
      return caches.open(g.cache).then(function (c) { return c.put(url, r); });
    });
  }

  function runQueue(items, concurrency, onItem) {
    /* items: [{group, idx, bytes}] */
    var pos = 0, failed = 0, quota = false;
    return new Promise(function (resolve) {
      var active = 0;
      function next() {
        if (job && job.stop) { if (active === 0) resolve({ failed: failed, quota: quota }); return; }
        if (pos >= items.length) { if (active === 0) resolve({ failed: failed, quota: quota }); return; }
        var it = items[pos++];
        active++;
        function attempt(n) {
          return fetchAndStore(it.group, it.idx).catch(function (err) {
            if (err && err.name === 'QuotaExceededError') { quota = true; throw err; }
            if (n < 1 && navigator.onLine) return attempt(n + 1);
            throw err;
          });
        }
        attempt(0).catch(function () { failed++; if (quota && job) job.stop = true; }).then(function () {
          active--;
          onItem(it);
          next();
        });
      }
      for (var i = 0; i < concurrency; i++) next();
      if (items.length === 0) resolve({ failed: 0, quota: false });
    });
  }

  /* Interfaz: se rellena sola en segundo plano, sin avisos */
  var coreRunning = false;
  function preloadCore() {
    if (coreRunning || !navigator.onLine || !GROUPS.core.urls.length) return;
    if (navigator.connection && navigator.connection.saveData) return;
    coreRunning = true;
    status().then(function (st) {
      var items = st.core.missing.map(function (i) { return { group: 'core', idx: i, bytes: 0 }; });
      return runQueue(items, 3, function () {});
    }).catch(function () {}).then(function () { coreRunning = false; });
  }

  function startDownload(render) {
    if (job && job.running) return;
    if (!navigator.onLine) { job = { running: false, msg: T.needNet }; render(); return; }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    status().then(function (st) {
      var items = [], total = 0;
      ['core', 'images', 'audio'].forEach(function (n) {
        st[n].missing.forEach(function (i) {
          items.push({ group: n, idx: i, bytes: GROUPS[n].sizes[i] || 0 });
          total += GROUPS[n].sizes[i] || 0;
        });
      });
      if (!items.length) { job = { running: false, msg: T.allSaved }; render(); return; }
      job = { running: true, stop: false, total: total || 1, done: 0, msg: T.downloading };
      render();
      return runQueue(items, 3, function (it) { job.done += it.bytes; updateProgress(); }).then(function (res) {
        var stopped = job.stop && !res.quota;
        job.running = false;
        job.msg = res.quota ? T.quota : stopped ? T.stopped : res.failed ? T.partial : T.done;
        render();
      });
    });
  }

  /* ---------- Opción dentro de la ventana de ayuda / instalación ---------- */
  var ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0F5A3D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 4v10"/><path d="M8 10.5l4 4 4-4"/><path d="M5 19h14"/></svg>';

  function addCard() {
    var cards = document.querySelector('.jp-help-cards');
    if (!cards || cards.querySelector('.jp-off-card')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jp-help-card jp-help-card-offline jp-off-card';
    b.innerHTML =
      '<span class="jp-help-card-icon">' + ICON + '</span>' +
      '<span class="jp-help-card-text"><span class="jp-help-card-name">' + T.cardName + '</span>' +
      '<span class="jp-help-card-desc">' + T.cardDesc + '</span></span>' +
      '<span class="jp-help-card-go" aria-hidden="true">&#8250;</span>';
    cards.appendChild(b);
  }

  var viewEl = null;
  function pct() { return job && job.total ? Math.min(100, Math.round(100 * job.done / job.total)) : 0; }

  /* Durante la descarga solo se mueve la barra (no se vuelve a calcular todo cada archivo) */
  function updateProgress() {
    if (!viewEl || !document.body.contains(viewEl)) return;
    var bar = viewEl.querySelector('.jp-off-bar > i');
    var msg = viewEl.querySelector('.jp-off-msg');
    if (bar) bar.style.width = pct() + '%';
    if (msg && job && job.running) msg.textContent = T.downloading + ' ' + pct() + ' %';
  }

  var renderSeq = 0;
  function renderView() {
    if (!viewEl || !document.body.contains(viewEl)) return;
    var seq = ++renderSeq;
    status().then(function (st) {
      if (seq !== renderSeq) return;      /* llegó tarde: ya hay una pantalla más reciente */
      if (!viewEl || !document.body.contains(viewEl)) return;
      function line(label, g, kind) {
        var ok = g.total && g.have >= g.total;
        return '<li><span>' + label + '</span><span>' +
          (ok ? '<span class="jp-off-ok">&#10003; ' + T.saved[kind] + '</span>' : '<b>' + g.have + '</b> ' + T.of + ' ' + g.total) + '</span></li>';
      }
      var missBytes = 0, anyMissing = false;
      ['core', 'images', 'audio'].forEach(function (n) {
        st[n].missing.forEach(function (i) { missBytes += GROUPS[n].sizes[i] || 0; anyMissing = true; });
      });
      var total = (CFG.sizes && (CFG.sizes.core + CFG.sizes.images + CFG.sizes.audio)) || missBytes;
      var running = job && job.running;
      var html =
        '<h2 class="jp-help-title">' + T.title + '</h2>' +
        '<p class="jp-help-sub">' + T.sub + '</p>' +
        '<ul class="jp-off-list">' +
          line(T.ui, st.core, 'f') +
          (st.audio.total ? line(T.audio, st.audio, 'mp') : '') +
          (st.images.total ? line(T.images, st.images, 'fp') : '') +
        '</ul>';
      if (running) {
        html += '<div class="jp-off-bar"><i style="width:' + pct() + '%"></i></div>' +
          '<p class="jp-off-msg">' + T.downloading + ' ' + pct() + ' %</p>' +
          '<button type="button" class="jp-off-btn jp-off-sec" data-off-act="stop">' + T.btnStop + '</button>';
      } else {
        if (anyMissing) {
          var anySaved = (st.audio.have + st.images.have) > 0;
          html += '<button type="button" class="jp-off-btn" data-off-act="go">' +
            (anySaved ? T.btnMore : T.btnAll) + ' (' + mb(missBytes) + ' MB)</button>';
        }
        if (job && job.msg) html += '<p class="jp-off-msg">' + job.msg + '</p>';
        else if (!anyMissing) html += '<p class="jp-off-msg">' + T.allSaved + '</p>';
      }
      html += '<p class="jp-off-note">' + T.note.replace('{mb}', String(mb(total))) + '</p>';
      viewEl.innerHTML = html;
    });
  }

  function openView() {
    var body = document.getElementById('jp-help-body');
    var back = document.getElementById('jp-help-back');
    if (!body) return;
    if (back) back.classList.remove('jp-help-hide');
    body.innerHTML = '<div id="jp-off-view"></div>';
    viewEl = body.firstChild;
    body.scrollTop = 0;
    renderView();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.jp-off-card')) { e.preventDefault(); openView(); return; }
    var act = t.closest('[data-off-act]');
    if (!act) return;
    var a = act.getAttribute('data-off-act');
    if (a === 'go') { job = null; startDownload(renderView); }
    else if (a === 'stop' && job) { job.stop = true; }
  });

  var mo = new MutationObserver(function () { addCard(); });
  function init() {
    mountPill();
    if (!navigator.onLine) onNet();
    mo.observe(document.body, { childList: true, subtree: true });
    addCard();
    /* Con conexión, se guarda la interfaz poco después de abrir la app */
    setTimeout(preloadCore, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
