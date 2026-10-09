# Japa-Móvil Lite (versión gratuita)

Versión gratuita de Japa-Móvil. Se genera a partir de la versión Premium (repo `japa-movil`) con estos bloqueos:

**Abierto:** deidades Ganesha y Shiva · mala Rudraksha · todos los mantras (menos los de los planetas) · fondos en vídeo de Durga (Simhavahini I) y Hanuman (Veera) · tienda · compartir app · guía de instalación (botón "Instalar la app", con el PDF `pdf/Instalacion-Japa-Movil-Lite.pdf`).

**Bloqueado (con candado y aviso para adquirir Premium):** resto de deidades, los 9 planetas, resto de malas, bases de audio, rituales, mantras de planetas y resto de fondos. En los fondos, el aviso incluye un mini reproductor con una vista previa corta (`video/preview/`).

Enlace de compra: https://payhip.com/b/VjqJ4

## Cómo cambiar qué está abierto
En `index.html`, busca el bloque `var FREE = {` y edita las listas `deidades`, `malas` y `fondos`.
Si abres algo nuevo hay que subir también sus archivos desde el repo Premium (por ejemplo, el vídeo completo `video/fondo-xxx.mp4` o las 28 imágenes de la mala).

## Carpetas
- `img/`, `fonts/`, `audio4/` (mantras y campanas), `malas1-3/` (solo Rudraksha)
- `discos/` páginas con reproductor de muestras de la tienda (se cargan al pulsar)
- `video/` fondos abiertos + `video/preview/` clips de 6 s a baja resolución de los fondos bloqueados

## Pendiente
- Fuente Yatra One (título de la imagen de compartir): subir `YatraOne-Regular.ttf` a la carpeta `fonts/`. Hasta entonces se usa una letra de respaldo.
