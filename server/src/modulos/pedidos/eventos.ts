// Bitácora inmutable de eventos de pedido (v1.5, Etapa A).
//
// registrarEvento() es la ÚNICA forma de escribir en pedido_eventos y la usan
// todos los flujos que mutan un pedido. Regla innegociable: se llama DENTRO de
// la misma transacción better-sqlite3 que la acción que origina el evento.
//
// Nota sobre la firma: en better-sqlite3 no existe un objeto de transacción que
// pasar; la atomicidad la da ejecutar la escritura sincrónicamente dentro del
// closure de db.transaction(). Por eso registrarEvento no recibe un `tx`: basta
// con invocarla dentro de ese closure (todas las escrituras de ese closure son
// una sola transacción). El detalle se valida con zod antes de insertar.
import { db } from '../../db/conexion.js';
import { z } from 'zod';
import type { EventoContenido, EventoPedido, TipoEventoPedido } from '@pos/shared';

// ── Esquemas zod del `detalle`, uno por tipo (respetan los contratos) ──────

const itemInicial = z.object({
  producto_id: z.number().int().positive(),
  nombre: z.string(),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().int().min(0)
});

const esquemasDetalle = {
  creado: z.object({
    tipo_pedido: z.enum(['mesa', 'barra']),
    mesa_numero: z.number().int().optional(),
    cliente_nombre: z.string().optional(),
    turno: z.number().int().optional(),
    items_iniciales: z.array(itemInicial)
  }),
  item_agregado: z.object({
    producto_id: z.number().int().positive(),
    nombre: z.string(),
    cantidad: z.number().int().positive(),
    precio_unitario: z.number().int().min(0)
  }),
  item_reducido: z.object({
    producto_id: z.number().int().positive(),
    nombre: z.string(),
    cantidad_antes: z.number().int().positive(),
    cantidad_despues: z.number().int().positive(),
    stock_devuelto: z.number().int(),
    // Presentes solo si la reducción vino de aprobar una solicitud.
    solicitud_id: z.number().int().positive().optional(),
    solicitado_por: z.number().int().positive().optional()
  }),
  item_eliminado: z.object({
    producto_id: z.number().int().positive(),
    nombre: z.string(),
    cantidad_eliminada: z.number().int().positive(),
    monto_eliminado: z.number().int().min(0),
    stock_devuelto: z.number().int(),
    solicitud_id: z.number().int().positive().optional(),
    solicitado_por: z.number().int().positive().optional()
  }),
  nota_editada: z.object({
    campo: z.enum(['nota', 'cliente_nombre']),
    antes: z.string(),
    despues: z.string()
  }),
  cancelado: z.object({
    motivo: z.enum(['manual', 'quedo_vacio']),
    total_al_cancelar: z.number().int().min(0)
  }),
  cobrado: z.object({
    total: z.number().int().min(0),
    pagos: z.array(z.object({ metodo: z.enum(['efectivo', 'qr_breb']), monto: z.number().int().positive() }))
  }),
  correccion_solicitada: z.object({
    solicitud_id: z.number().int().positive(),
    tipo: z.enum(['reducir', 'eliminar']),
    producto_id: z.number().int().positive(),
    nombre: z.string(),
    cantidad_actual: z.number().int().positive(),
    cantidad_nueva: z.number().int().positive().optional(),
    motivo: z.string()
  }),
  correccion_rechazada: z.object({
    solicitud_id: z.number().int().positive(),
    tipo: z.enum(['reducir', 'eliminar']),
    producto_id: z.number().int().positive(),
    nombre: z.string(),
    motivo: z.string()
  })
} as const satisfies Record<TipoEventoPedido, z.ZodType>;

const insertar = db.prepare(
  'INSERT INTO pedido_eventos (pedido_id, tipo, detalle, usuario_id) VALUES (?, ?, ?, ?)'
);

/**
 * Registra un evento en la bitácora. DEBE llamarse dentro del closure de
 * db.transaction() de la acción que lo origina (así comparten transacción: si
 * la acción falla, no queda evento; si el evento falla, la acción se revierte).
 * Valida el `detalle` con zod según el `tipo` antes de escribir.
 */
export function registrarEvento(
  evento: { pedidoId: number; usuarioId: number } & EventoContenido
): void {
  const esquema = esquemasDetalle[evento.tipo];
  const detalleValido = esquema.parse(evento.detalle);
  insertar.run(evento.pedidoId, evento.tipo, JSON.stringify(detalleValido), evento.usuarioId);
}

// ── Lectura ────────────────────────────────────────────────────────────────

interface FilaEvento {
  id: number;
  pedido_id: number;
  tipo: TipoEventoPedido;
  detalle: string;
  usuario_id: number;
  usuario_nombre: string;
  creado_en: string;
}

/** Eventos de un pedido en orden cronológico, con el nombre del usuario. */
export function listarEventos(pedidoId: number): EventoPedido[] {
  const filas = db
    .prepare(
      `SELECT e.id, e.pedido_id, e.tipo, e.detalle, e.usuario_id,
              u.nombre AS usuario_nombre, e.creado_en
         FROM pedido_eventos e
         JOIN usuarios u ON u.id = e.usuario_id
        WHERE e.pedido_id = ?
        ORDER BY e.id`
    )
    .all(pedidoId) as FilaEvento[];

  return filas.map((f) => ({
    id: f.id,
    pedido_id: f.pedido_id,
    tipo: f.tipo,
    detalle: JSON.parse(f.detalle),
    usuario_id: f.usuario_id,
    usuario_nombre: f.usuario_nombre,
    creado_en: f.creado_en
    // El cast asegura la unión discriminada tipo↔detalle en el consumidor.
  })) as EventoPedido[];
}
