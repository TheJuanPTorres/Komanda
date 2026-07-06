# Actualizar el POS en producción (VPS)

Orden seguro: **respaldo → git pull → build → migraciones → reload**. Si algo
falla, tienes el respaldo del paso 1 para volver atrás (ver `RESPALDOS.md`).

Conéctate por SSH y ejecuta como el usuario `pos` (nunca root para la app):

```bash
# 0) Entra como 'pos'
sudo -iu pos
cd /opt/pos

# 1) Respaldo previo (por si la migración sale mal)
node --env-file=/opt/pos/.env --import tsx server/scripts/respaldar.ts

# 2) Traer los cambios
git pull --ff-only

# 3) Instalar dependencias (si cambiaron) y compilar
npm ci
npm run build

# 4) Migraciones: corren solas al arrancar el servidor. Si quieres aplicarlas
#    antes de recargar (recomendado), hazlo explícito:
node --env-file=/opt/pos/.env server/dist/db/migrar.js

# 5) Recargar sin downtime perceptible
pm2 reload pos-server

# 6) Verificar
curl -s http://127.0.0.1:3000/api/salud    # → {"ok":true,"uptime":...}
pm2 status
```

## Reversión rápida

```bash
git log --oneline -5           # ubica el commit anterior
git checkout <commit-anterior> # o: git reset --hard <commit-anterior>
npm ci && npm run build
pm2 reload pos-server
```

Si una migración corrompió datos, restaura desde el respaldo del paso 1
siguiendo `RESPALDOS.md` (detén la app, extrae el `.tar.gz`, arranca).

> Nota: `instalar-vps.sh` es idempotente; también puedes re-ejecutarlo tras un
> `git pull` para reinstalar todo de forma consistente (no borra la base ni el
> `.env` existentes).
