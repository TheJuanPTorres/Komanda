#!/usr/bin/env bash
# Instalación/actualización de infraestructura del POS en un VPS Vultr
# (Ubuntu 24.04 LTS, ~1 GB RAM). IDEMPOTENTE: correrlo dos veces no rompe nada.
#
# Supone que el repositorio YA está clonado en /opt/pos (la guía humana lo
# clona con un token). Recibe el dominio como parámetro:
#
#   sudo bash /opt/pos/despliegue/instalar-vps.sh pos.midominio.com
#
set -euo pipefail

DOMINIO="${1:-}"
APP_DIR="/opt/pos"
DATA_DIR="${APP_DIR}/server/data"
RESP_DIR="/var/respaldos/pos"
LOG_DIR="/var/log/pos"
USUARIO="pos"
ENV_FILE="${APP_DIR}/.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta como root (sudo)." >&2
  exit 1
fi
if [ -z "${DOMINIO}" ]; then
  echo "Falta el dominio. Uso: sudo bash instalar-vps.sh pos.midominio.com" >&2
  exit 1
fi
if [ ! -d "${APP_DIR}/.git" ]; then
  echo "No encuentro el repo en ${APP_DIR}. Clónalo ahí primero." >&2
  exit 1
fi

echo "==> [1/7] Zona horaria del sistema a America/Bogota"
timedatectl set-timezone America/Bogota

echo "==> [2/7] Swap de 2 GB (si no hay y la RAM es ≤ 2 GB)"
ram_mb="$(free -m | awk '/^Mem:/ {print $2}')"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ] && [ "${ram_mb}" -le 2048 ]; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >>/etc/fstab
  fi
  echo "    swap de 2 GB activo."
else
  echo "    swap ya presente o RAM > 2 GB: nada que hacer."
fi

echo "==> [3/7] Node 20 LTS, Caddy, PM2, usuario de sistema '${USUARIO}'"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades tar openssl

# Node 20 desde NodeSource (solo si falta o es < 20).
node_major="$( (command -v node >/dev/null && node -v | sed 's/v\([0-9]*\).*/\1/') || echo 0 )"
if [ "${node_major}" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Caddy desde su repo oficial (solo si falta).
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' |
    tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

# PM2 global (idempotente).
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# Usuario de sistema sin sudo que corre la app (nunca root).
if ! id "${USUARIO}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${USUARIO}"
fi

# Carpetas de datos/respaldos/logs, propiedad del usuario 'pos'.
mkdir -p "${DATA_DIR}" "${RESP_DIR}" "${LOG_DIR}"
chown -R "${USUARIO}:${USUARIO}" "${APP_DIR}" "${RESP_DIR}" "${LOG_DIR}"

echo "==> [4/7] Cortafuegos (UFW: 22/80/443) y actualizaciones automáticas"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now unattended-upgrades || true

echo "==> [4b] Archivo .env (se crea si no existe; NO se sobrescribe el secreto)"
if [ ! -f "${ENV_FILE}" ]; then
  secreto="$(openssl rand -base64 48 | tr -d '\n')"
  cat >"${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
COOKIE_SECRET=${secreto}
ORIGEN_PERMITIDO=https://${DOMINIO}
RUTA_DATOS=${DATA_DIR}
TZ_NEGOCIO=America/Bogota
EOF
  chown "${USUARIO}:${USUARIO}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "    .env creado con un COOKIE_SECRET nuevo."
else
  echo "    .env ya existe: se respeta (incluido su secreto)."
fi

echo "==> [5/7] Dependencias, build, seed (solo si la base no existe)"
db_existe=0
[ -f "${DATA_DIR}/pos.db" ] && db_existe=1
sudo -u "${USUARIO}" bash -lc "cd '${APP_DIR}' && npm ci && npm run build"
if [ "${db_existe}" -eq 0 ]; then
  echo "    base nueva: sembrando datos iniciales…"
  sudo -u "${USUARIO}" node --env-file="${ENV_FILE}" "${APP_DIR}/server/dist/db/seed.js"
else
  echo "    la base ya existe: NO se siembra (las migraciones corren al arrancar)."
fi

echo "==> [6/7] PM2 en arranque + cron de respaldo (3:00 am hora Bogota)"
sudo -u "${USUARIO}" bash -lc "cd '${APP_DIR}' && pm2 startOrReload despliegue/ecosystem.config.cjs && pm2 save"
# Registra PM2 para revivir al reiniciar la máquina (systemd, usuario 'pos').
env PATH="${PATH}:/usr/bin" pm2 startup systemd -u "${USUARIO}" --hp "/home/${USUARIO}" | tail -1 | bash || true

# Cron del respaldo diario. El sistema está en hora Bogota, así que 03:00 es 3 am.
cat >/etc/cron.d/pos-respaldo <<EOF
# Respaldo diario del POS a las 3:00 am (hora del sistema = America/Bogota).
0 3 * * * ${USUARIO} cd ${APP_DIR} && /usr/bin/node --env-file=${ENV_FILE} --import tsx server/scripts/respaldar.ts >> ${LOG_DIR}/respaldo.log 2>&1
EOF
chmod 644 /etc/cron.d/pos-respaldo

echo "==> [7/7] Caddy con el dominio y recarga"
install -m 644 "${APP_DIR}/despliegue/Caddyfile" /etc/caddy/Caddyfile
# Inyecta el dominio como variable de entorno de Caddy (idempotente).
mkdir -p /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/dominio.conf <<EOF
[Service]
Environment=DOMINIO=${DOMINIO}
EOF
systemctl daemon-reload
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

echo
echo "======================== RESUMEN DE VERIFICACIÓN ========================"
echo "  URL pública      : https://${DOMINIO}"
echo "  Zona horaria     : $(timedatectl show -p Timezone --value)"
echo "  Swap activo      : $(swapon --show --noheadings | awk '{print $1, $3}' | paste -sd' ' - || echo 'ninguno')"
echo "  Node             : $(node -v)"
printf "  PM2              : "; sudo -u "${USUARIO}" pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);console.log(a.map(p=>p.name+'='+p.pm2_env.status).join(', ')||'sin procesos')}catch(e){console.log('n/d')}})" || echo "n/d"
printf "  Caddy            : "; systemctl is-active caddy
echo "  Respaldos        : ${RESP_DIR} (cron 3:00 am)"
echo "  Salud local      : $(curl -s -m 3 http://127.0.0.1:3000/api/salud || echo 'sin respuesta')"
echo "========================================================================="
