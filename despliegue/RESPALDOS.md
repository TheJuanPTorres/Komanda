# Respaldos y restauración

El respaldo es un único archivo `pos-YYYY-MM-DD.tar.gz` que contiene:

- `pos.db` — copia **consistente** de la base (hecha con `VACUUM INTO`, segura
  aunque el servidor esté corriendo en modo WAL).
- `imagenes/` — las fotos de producto.

## Cómo se generan

- **Automático (cron):** `server/scripts/respaldar.ts` corre cada día a las
  **3:00 am hora del negocio** (lo instala `instalar-vps.sh`). Guarda en
  `/var/respaldos/pos/` y conserva los **últimos 14**.
  Manual: `cd /opt/pos && npm run respaldar -w @pos/server`
  (destino configurable con `RUTA_RESPALDOS`).
- **Bajo demanda (admin):** `GET /api/admin/respaldo` genera y **descarga** el
  respaldo del momento en un solo archivo (solo admin, limitado a 6/hora).

## Restauración — paso a paso (probado)

> Detén la app antes de restaurar para que nadie escriba en la base a la vez.

```bash
# 1) Detén el servidor
pm2 stop pos-server

# 2) Ubícate en la carpeta de datos y respalda lo actual por las dudas
cd /opt/pos/server/data
mv pos.db pos.db.antes-de-restaurar 2>/dev/null || true
mv imagenes imagenes.antes-de-restaurar 2>/dev/null || true

# 3) Extrae el respaldo elegido (ajusta la fecha) directo en la carpeta de datos
tar -xzf /var/respaldos/pos/pos-2026-07-06.tar.gz -C /opt/pos/server/data

# 4) Verifica que la base abre y está íntegra
sqlite3 /opt/pos/server/data/pos.db "PRAGMA integrity_check;"   # → ok

# 5) Ajusta el dueño (la app corre como el usuario 'pos') y arranca
chown -R pos:pos /opt/pos/server/data
pm2 start pos-server

# 6) Comprueba la salud
curl -s http://127.0.0.1:3000/api/salud    # → {"ok":true,"uptime":...}
```

Si algo sale mal, los originales quedaron como `*.antes-de-restaurar`.

## Verificación de que el respaldo sirve (recomendado periódicamente)

```bash
# Extrae en una carpeta temporal y comprueba integridad SIN tocar producción
mkdir -p /tmp/prueba-restore && \
tar -xzf /var/respaldos/pos/pos-YYYY-MM-DD.tar.gz -C /tmp/prueba-restore && \
sqlite3 /tmp/prueba-restore/pos.db "PRAGMA integrity_check; SELECT COUNT(*) FROM productos;"
rm -rf /tmp/prueba-restore
```
