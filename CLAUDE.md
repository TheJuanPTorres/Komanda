# POS Local — Contexto del proyecto

## Qué es
Sistema de punto de venta para un negocio de comida rápida en Colombia.
4 mesas físicas + pedidos en barra (nombre del cliente + turno diario B-01, B-02…).
100% local: corre en una laptop/mini PC en la red del negocio, sin nube, sin licencias.
Los auxiliares usan celulares (PWA); el admin usa el equipo de caja o su celular.

## Roles
Dos roles: `admin` y `auxiliar` (el nombre del rol de personal se renombró en
toda la base y el código). Los auxiliares toman pedidos y pueden AGREGAR items
libremente a pedidos ABIERTOS; no manejan dinero. El admin además cobra, cierra,
administra y APRUEBA correcciones.

## Regla de negocio SAGRADA
Solo el rol `admin` puede cobrar y cerrar pedidos. Esta regla se valida SIEMPRE
en el servidor (middleware de rol en el módulo cobros), nunca solo en la UI.

## Correcciones con aprobación (v1.5-B) — INNEGOCIABLE
Los auxiliares NO ejecutan reducciones ni eliminaciones de items: las SOLICITAN.
Nada se ejecuta sin aprobación del admin.
- `solicitudes_correccion` (tipo reducir/eliminar, estado pendiente/aprobada/
  rechazada/anulada). Máximo UNA pendiente por item (409 si ya hay).
- Los endpoints PATCH/DELETE de items son SOLO admin (ejecución directa). El
  auxiliar usa POST /api/pedidos/:id/items/:itemId/correccion (crea la solicitud
  + evento `correccion_solicitada`; el item NO cambia todavía).
- El admin resuelve en /api/correcciones/:id/{aprobar,rechazar}. Aprobar ejecuta
  la reducción/eliminación real (reutiliza ejecutarReducir/ejecutarEliminar de
  pedidos/servicio con `origen`), en UNA transacción; los eventos item_reducido/
  item_eliminado guardan `solicitud_id` y `solicitado_por`, y `usuario_id` es el
  admin ejecutor. Rechazar registra `correccion_rechazada` y deja el item intacto.
- NO se puede cobrar con correcciones pendientes (409 COBRO_CON_PENDIENTES).
- Cancelar un pedido anula ('anulada') sus solicitudes pendientes en la misma tx.

## Stack (no cambiar sin justificación explícita)
- Node.js 20+, TypeScript estricto, Fastify
- SQLite con better-sqlite3 (síncrono, transacciones nativas)
- Socket.IO para tiempo real
- React 18 + Vite + vite-plugin-pwa, Zustand, zod
- Monorepo npm workspaces: shared/ · server/ · app/
- PM2 para producción (ecosystem.config.js en la raíz)

## Convenciones innegociables
- DINERO: siempre enteros (pesos COP, sin decimales). Jamás float.
- FECHAS: TEXT ISO 8601 UTC en DB (datetime('now')). La zona del negocio
  (TZ_NEGOCIO, default America/Bogota) SOLO interviene al calcular fronteras de
  "día operativo" y al presentar. Fronteras SIEMPRE vía la utilidad central
  server/src/lib/fechas.ts (diaOperativo / rangoDiaOperativo / rangoUtcDesdeFechas),
  NUNCA con date('now') del servidor ni con la hora local del VPS.
- BORRADO: lógico (activo = 0) en productos y usuarios. Nunca DELETE físico
  de nada que el historial referencie.
- SNAPSHOTS: pedido_items copia nombre_producto, precio_unitario y
  costo_unitario al momento de la venta. El reporte de margen depende de esto.
- TRANSACCIONES: toda escritura que toque 2+ tablas va en db.transaction().
- VALIDACIÓN: todo body/params de entrada se valida con zod antes de tocar la DB.
- IDIOMA: código (variables, funciones, tablas) y UI en ESPAÑOL.
  Comentarios solo donde el "porqué" no sea obvio.
- ERRORES: respuestas HTTP con forma { error: { codigo, mensaje } };
  mensajes escritos para humanos no técnicos.
- WEBSOCKETS: todo cambio de estado de pedidos/productos emite evento
  tipado definido en shared/src/eventos.ts. El front nunca hace polling.
- BITÁCORA: toda mutación de pedidos registra su evento en pedido_eventos vía
  registrarEvento(), dentro de la misma transacción que la acción. La tabla es
  solo-inserción: prohibido crear endpoints o queries de UPDATE/DELETE sobre
  ella. La historia de un pedido se reconstruye leyendo sus eventos en orden.

## Estructura
shared/src/{types.ts, eventos.ts}
server/src/{index.ts, db/, modulos/{auth,productos,pedidos,cobros,gastos,cierre-caja,reportes}, ws/, lib/}
server/data/pos.db   ← respaldar = copiar este archivo
app/src/{design-system/{tokens.css,primitivas/,patrones/}, features/, lib/, rutas.tsx}

## Fases del proyecto
F1: monorepo + DB + auth + WS base (servidor completo funcional)
F2: piso de mesas/barra + tomar pedido (UI corazón)
F3: flujo de cobro admin (efectivo / QR Bre-B / mixto)
F4: gastos + cierre de caja
F5: reportes (margen por producto, ventas por día/hora)
F6: PWA final, PM2, script de respaldo
F7 (futuro): lector-pagos/ por correo IMAP — el modelo de pagos ya lo contempla
   (campos referencia_externa y verificado).

## Producción (Fase Nube — VPS Vultr)
- El sistema YA NO asume red local: corre en un VPS público (Vultr, Miami,
  Ubuntu 24.04) detrás de Caddy, que termina TLS. SUPUESTO: internet hostil.
- Node corre en HTTP en 127.0.0.1:3000 con trustProxy; Caddy hace HTTPS y
  reverse-proxy. El servidor jamás corre como root (usuario de sistema `pos`).
- Config por entorno validada con zod (server/src/config.ts): en producción,
  si falta COOKIE_SECRET u ORIGEN_PERMITIDO el proceso FALLA EN FRÍO. Ver
  .env.example. Nada de IPs 192.168, http:// sin TLS ni CORS abierto.
- Seguridad: cookies httpOnly+secure+sameSite lax; CORS y Socket.IO estrictos a
  ORIGEN_PERMITIDO; helmet con CSP; rate-limit (global 300/min; admin 5/15min;
  auxiliar 20/min) + bloqueo por cuenta persistido en DB. PIN admin ≥ 6 dígitos
  (cambio forzado si es corto); PIN de auxiliar obligatorio (4 dígitos).
- EMERGENCIA (solo SSH, no expuesto por HTTP): si el bloqueo por cuenta deja al
  admin fuera, `npm run desbloquear -- <nombre>` reinicia sus fallos a 0
  (sin argumento lista las cuentas bloqueadas). Ver despliegue/ACTUALIZAR.md.
- Respaldos: server/scripts/respaldar.ts (VACUUM INTO + tar.gz de imagenes) por
  cron 3:00 am hora del negocio, retención 14; GET /api/admin/respaldo (admin).
- Artefactos en despliegue/: Caddyfile, ecosystem.config.cjs, instalar-vps.sh
  (idempotente), ACTUALIZAR.md, RESPALDOS.md.

## Cómo trabajar
- Una fase por vez. Al terminar: verificar que compila, correr las pruebas
  de humo, y proponer el commit con mensaje descriptivo en español.
- Ante ambigüedad de negocio: preguntar, no asumir.
- No agregar dependencias fuera del stack sin proponerlo primero.