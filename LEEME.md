# Terreno Broaster POS – versión web

Misma aplicación, sin Electron. Un servidor Node pequeño (Express + SQLite) sirve la web y guarda en `data/TerrenoBroaster.db`.
Peso de `node_modules`: ~35 MB (antes ~700 MB).

## Iniciar
1. Instalar Node.js 16 o superior (https://nodejs.org).
2. Primera vez: `npm install`  (o doble clic en `iniciar.bat`, que lo hace solo).
3. `npm start` y abrir http://localhost:3000

Desde otro equipo/tablet de la misma red: http://IP-DEL-PC:3000

## Opciones (variables de entorno)
- `PORT=8080`                       cambia el puerto
- `POS_USER=admin POS_PASS=clave`   pide usuario y clave (recomendado si se publica en internet)
- `DATA_DIR=D:\datos`               carpeta donde vive la base de datos

## Estructura
- `server.js`   API + base de datos (reemplaza main.js y preload.js)
- `public/`     la aplicación (index.html, renderer.js, styles.css, api-web.js, sidebar.js, img/, vendor/)
- `data/`       TerrenoBroaster.db y `backups/` (respaldo automático diario, últimos 14)

## Notas
- Bootstrap, jQuery, Chart.js, FontAwesome y Owl Carousel están en `public/vendor`: funciona sin internet.
- Las exportaciones CSV/Excel se descargan por el navegador (carpeta Descargas).
- Las imágenes de platos que se suben desde "Platos" se guardan en `public/img`.
- Si lo subes a un hosting, necesita Node y disco persistente para `data/`.
