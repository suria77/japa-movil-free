#!/usr/bin/env python3
"""Genera offline-files.js: la lista de archivos que la app puede guardar en el móvil.

Uso (desde la carpeta del repo):   python3 tools/make-offline-list.py
Hay que volver a ejecutarlo si se añaden, quitan o renombran imágenes, audios o fuentes.

 - core:   interfaz (se guarda sola en segundo plano al abrir la app con conexión)
 - images: imágenes de malas, rituales, discos... (se guardan con el botón "Usar sin conexión")
 - audio:  audios (idem)
Los vídeos y los PDF no se incluyen.
"""
import json, os, sys
from urllib.parse import quote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VERSION = 'v2'                      # súbelo (v3, v4...) para obligar a todos los móviles a bajar la interfaz de nuevo
CORE_DIRS = {'img', 'fonts', 'img_deitades_planetas'}
SKIP_DIRS = {'.git', '.github', '.claude', 'functions', 'video', 'pdf', 'tools', 'node_modules'}
IMG_EXT = {'.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.avif'}
FONT_EXT = {'.ttf', '.otf', '.woff', '.woff2'}
AUDIO_EXT = {'.mp3', '.m4a', '.wav', '.ogg', '.aac'}

core, images, audio = [], [], []
core_sz, images_sz, audio_sz = [], [], []
sizes = {'core': 0, 'images': 0, 'audio': 0}

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.'))
    rel_dir = os.path.relpath(dirpath, ROOT)
    top = '' if rel_dir == '.' else rel_dir.split(os.sep)[0]
    for fn in sorted(filenames):
        ext = os.path.splitext(fn)[1].lower()
        rel = fn if rel_dir == '.' else rel_dir.replace(os.sep, '/') + '/' + fn
        size = os.path.getsize(os.path.join(dirpath, fn))
        url = quote(rel)
        if ext in AUDIO_EXT:
            audio.append(url); audio_sz.append(size); sizes['audio'] += size
        elif ext in FONT_EXT or (ext in IMG_EXT and (top == '' or top in CORE_DIRS)):
            core.append(url); core_sz.append(size); sizes['core'] += size
        elif ext in IMG_EXT:
            images.append(url); images_sz.append(size); sizes['images'] += size

cfg = {
    'caches': {'shell': 'jp-shell-' + VERSION, 'media': 'jp-media-v1', 'assets': 'jp-assets-v1'},
    'core': core, 'images': images, 'audio': audio, 'sizes': sizes,
    'coreSz': core_sz, 'imagesSz': images_sz, 'audioSz': audio_sz,
}
out = os.path.join(ROOT, 'offline-files.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('/* Generado por tools/make-offline-list.py — no editar a mano */\n')
    f.write('self.JP_OFFLINE = ' + json.dumps(cfg, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('core %d (%.1f MB) · images %d (%.1f MB) · audio %d (%.1f MB)' % (
    len(core), sizes['core'] / 1e6, len(images), sizes['images'] / 1e6, len(audio), sizes['audio'] / 1e6))
