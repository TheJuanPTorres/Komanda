# POS Local — Contexto del proyecto

## Qué es
Sistema de punto de venta para un negocio de comida rápida en Colombia.
4 mesas físicas + pedidos en barra (nombre del cliente + turno diario B-01, B-02…).
100% local: corre en una laptop/mini PC en la red del negocio, sin nube, sin licencias.
Los auxiliares usan celulares (PWA); el admin usa el equipo de caja o su celular.

## Roles
Dos roles: `admin` y `auxiliar` (el nombre del rol de personal se renombró en
toda la base y el código). Los auxiliares toman pedidos y pueden CORREGIR pedidos
ABIERTOS (bajar cantidades y eliminar items agregados por error); no manejan
dinero. El admin además cobra, cierra y administra.

## Regla de negocio SAGRADA
Solo el rol `admin` puede cobrar y cerrar pedidos. Esta regla se valida SIEMPRE
en el servidor (middleware de rol en el módulo cobros), nunca solo en la UI.

## Stack (no cambiar sin justificación explícita)
- Node.js 20+, TypeScript estricto, Fastify
- SQLite con better-sqlite3 (síncrono, transacciones nativas)
- Socket.IO para tiempo real
- React 18 + Vite + vite-plugin-pwa, Zustand, zod
- Monorepo npm workspaces: shared/ · server/ · app/
- PM2 para producción (ecosystem.config.js en la raíz)

## Convenciones innegociables
- DINERO: siempre enteros (pesos COP, sin decimales). Jamás float.
- FECHAS: TEXT ISO 8601 UTC en DB (datetime('now')); conversión a hora
  de Colombia (America/Bogota) SOLO en la capa de presentación.
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

## Cómo trabajar
- Una fase por vez. Al terminar: verificar que compila, correr las pruebas
  de humo, y proponer el commit con mensaje descriptivo en español.
- Ante ambigüedad de negocio: preguntar, no asumir.
- No agregar dependencias fuera del stack sin proponerlo primero.