// PM2 para producción en el VPS (Vultr, Ubuntu 24.04, ~1 GB RAM).
// El proceso corre como el usuario de sistema 'pos' (nunca root). Los secretos
// (COOKIE_SECRET, ORIGEN_PERMITIDO, …) viven en /opt/pos/.env y los carga el
// propio proceso; aquí NO se escriben secretos.
//
// Puesta en marcha la hace instalar-vps.sh; a mano sería:
//   cd /opt/pos && pm2 start despliegue/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'pos-server',
      cwd: '/opt/pos/server',
      script: 'dist/index.js',
      // Node 20.6+ carga /opt/pos/.env de forma nativa (sin dependencias).
      // Ahí viven COOKIE_SECRET, ORIGEN_PERMITIDO, RUTA_DATOS, TZ_NEGOCIO, etc.
      node_args: '--env-file=/opt/pos/.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      // VPS de 1 GB: reinicia si el proceso se dispara de memoria.
      max_memory_restart: '400M',
      restart_delay: 2000,
      time: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
