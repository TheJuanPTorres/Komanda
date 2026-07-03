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
    }
  ]
};
