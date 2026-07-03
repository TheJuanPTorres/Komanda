// Configuración de PM2 para producción.
// Arranca el servidor ya compilado (server/dist/index.js). El servidor aplica
// las migraciones pendientes solo al arrancar, así que no hay paso extra.
//
// Puesta en marcha (una vez):
//   npm run build
//   npm run seed                      (solo la primera vez, crea admin+datos)
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup           (para que reviva al reiniciar la máquina)
//
// Definir el secreto de sesión (una vez, MUY recomendado en producción):
//   pm2 set pos-server:JWT_SECRET "una-clave-larga-y-secreta"
module.exports = {
  apps: [
    {
      name: 'pos-server',
      cwd: './server',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      // Reinicia si se cae, con pausa creciente para no golpear en bucle.
      restart_delay: 2000,
      time: true, // agrega timestamp a los logs
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0'
        // JWT_SECRET: definir con `pm2 set` (ver arriba), no aquí.
        // HTTPS_KEY / HTTPS_CERT: rutas a los certificados si se usa HTTPS
        // (necesario para la PWA en celulares por la red local).
      }
    },
    {
      // Lector de pagos (Fase 7). OPCIONAL: sin las variables IMAP_* arranca en
      // modo "sin configurar" y no hace nada. Definir las credenciales del buzón
      // como variables de entorno del sistema antes de `pm2 start` (ver
      // OPERACION.md), no en este archivo (son secretas).
      name: 'pos-lector',
      cwd: './lector',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '150M',
      restart_delay: 5000,
      time: true,
      env: {
        NODE_ENV: 'production'
        // IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_USER, IMAP_PASS, IMAP_BUZON
        // LECTOR_REMITENTE, LECTOR_INTERVALO_MS
        // LECTOR_PATRON_MONTO, LECTOR_PATRON_REF (ajustar al formato del banco)
      }
    }
  ]
};
