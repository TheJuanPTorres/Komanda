// Acceso a datos de solicitudes_correccion (nivel bajo). Solo toca la DB; no
// importa el servicio de pedidos, para evitar ciclos (pedidos/cobros pueden
// usar hayPendientesEnPedido / anular sin arrastrar la lógica de aprobación).
import { db } from '../../db/conexion.js';
import type { EstadoSolicitud, SolicitudCorreccion, TipoCorreccion } from '@pos/shared';

export interface FilaSolicitud {
  id: number;
  pedido_id: number;
  item_id: number;
  tipo: TipoCorreccion;
  cantidad_nueva: number | null;
  motivo: string;
  estado: EstadoSolicitud;
  solicitado_por: number;
  resuelto_por: number | null;
  creado_en: string;
  resuelto_en: string | null;
}

export function solicitudPorId(id: number): FilaSolicitud | undefined {
  return db.prepare('SELECT * FROM solicitudes_correccion WHERE id = ?').get(id) as
    | FilaSolicitud
    | undefined;
}

export function insertarSolicitud(d: {
  pedido_id: number;
  item_id: number;
  tipo: TipoCorreccion;
  cantidad_nueva: number | null;
  motivo: string;
  solicitado_por: number;
}): number {
  const info = db
    .prepare(
      `INSERT INTO solicitudes_correccion
         (pedido_id, item_id, tipo, cantidad_nueva, motivo, solicitado_por)
       VALUES (@pedido_id, @item_id, @tipo, @cantidad_nueva, @motivo, @solicitado_por)`
    )
    .run(d);
  return Number(info.lastInsertRowid);
}

/** ¿El item ya tiene una solicitud pendiente? (máximo una por item). */
export function tieneSolicitudPendiente(itemId: number): boolean {
  return (
    db
      .prepare("SELECT 1 FROM solicitudes_correccion WHERE item_id = ? AND estado = 'pendiente'")
      .get(itemId) !== undefined
  );
}

/** ¿El pedido tiene solicitudes pendientes? (bloqueo de cobro). */
export function hayPendientesEnPedido(pedidoId: number): boolean {
  return (
    db
      .prepare("SELECT 1 FROM solicitudes_correccion WHERE pedido_id = ? AND estado = 'pendiente'")
      .get(pedidoId) !== undefined
  );
}

export function marcarEstado(
  id: number,
  estado: Exclude<EstadoSolicitud, 'pendiente'>,
  resueltoPor: number
): void {
  db.prepare(
    "UPDATE solicitudes_correccion SET estado = ?, resuelto_por = ?, resuelto_en = datetime('now') WHERE id = ?"
  ).run(estado, resueltoPor, id);
}

// Solicitud "completa": junta el contexto del item y del pedido y los nombres.
// El JOIN a pedido_items funciona mientras el item exista (pendiente/rechazada);
// para una aprobación de 'eliminar' se lee ANTES de ejecutar (ver servicio).
const SELECT_COMPLETA = `
  SELECT s.id, s.pedido_id, s.item_id, s.tipo, s.cantidad_nueva, s.motivo, s.estado,
         s.solicitado_por, us.nombre AS solicitado_por_nombre,
         s.resuelto_por, ur.nombre AS resuelto_por_nombre,
         s.creado_en, s.resuelto_en,
         i.producto_id, i.nombre_producto AS nombre, i.cantidad AS cantidad_actual,
         p.tipo AS pedido_tipo, p.mesa_numero, p.turno, p.cliente_nombre
    FROM solicitudes_correccion s
    JOIN pedido_items i ON i.id = s.item_id
    JOIN pedidos p ON p.id = s.pedido_id
    JOIN usuarios us ON us.id = s.solicitado_por
    LEFT JOIN usuarios ur ON ur.id = s.resuelto_por`;

export function solicitudCompleta(id: number): SolicitudCorreccion | undefined {
  return db.prepare(`${SELECT_COMPLETA} WHERE s.id = ?`).get(id) as SolicitudCorreccion | undefined;
}

export function listarPendientes(): SolicitudCorreccion[] {
  return db
    .prepare(`${SELECT_COMPLETA} WHERE s.estado = 'pendiente' ORDER BY s.creado_en`)
    .all() as SolicitudCorreccion[];
}

export function pendientesDePedido(pedidoId: number): SolicitudCorreccion[] {
  return db
    .prepare(`${SELECT_COMPLETA} WHERE s.estado = 'pendiente' AND s.pedido_id = ? ORDER BY s.creado_en`)
    .all(pedidoId) as SolicitudCorreccion[];
}
