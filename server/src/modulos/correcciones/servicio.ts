// Correcciones con aprobación (v1.5-B). El auxiliar SOLICITA; el admin resuelve.
// Nada se ejecuta sin aprobación. Cada acción registra su evento en la bitácora
// dentro de la misma transacción y emite el evento WS correspondiente.
import { db } from '../../db/conexion.js';
import type { SolicitudCorreccion, TipoCorreccion } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { emisor } from '../../ws/emisor.js';
import { registrarEvento } from '../pedidos/eventos.js';
import {
  ejecutarEliminar,
  ejecutarReducir,
  itemDe,
  obtenerPedido,
  obtenerPedidoConItems
} from '../pedidos/servicio.js';
import { obtenerProducto } from '../productos/servicio.js';
import * as datos from './datos.js';

export { listarPendientes, pendientesDePedido, hayPendientesEnPedido } from './datos.js';

// Emite pedido:actualizado/cancelado y producto:actualizado tras ejecutar.
function emitirTrasEjecutar(pedidoId: number, afectado: number | null, cancelado: boolean): void {
  if (cancelado) {
    emisor.pedidoCancelado({ pedidoId });
  } else {
    const pc = obtenerPedidoConItems(pedidoId);
    if (pc) emisor.pedidoActualizado({ pedido: pc.pedido, items: pc.items });
  }
  if (afectado !== null) {
    const p = obtenerProducto(afectado);
    if (p) emisor.productoActualizado({ producto: p });
  }
}

/** El auxiliar solicita reducir/eliminar una línea de un pedido abierto. */
export function solicitarCorreccion(
  pedidoId: number,
  itemId: number,
  tipo: TipoCorreccion,
  cantidadNueva: number | undefined,
  motivo: string,
  auxiliarId: number
): SolicitudCorreccion {
  let solicitudId = 0;
  const operar = db.transaction(() => {
    const pedido = obtenerPedido(pedidoId);
    if (!pedido) throw errores.pedidoNoEncontrado();
    if (pedido.estado !== 'abierto') throw errores.pedidoNoEditable();
    const item = itemDe(pedidoId, itemId);
    if (!item) throw errores.itemNoEncontrado();
    if (datos.tieneSolicitudPendiente(itemId)) throw errores.solicitudDuplicada();

    let cn: number | null = null;
    if (tipo === 'reducir') {
      if (cantidadNueva === undefined || cantidadNueva < 1 || cantidadNueva >= item.cantidad) {
        throw errores.correccionInvalida('La cantidad nueva debe ser menor a la actual y ≥ 1.');
      }
      cn = cantidadNueva;
    }

    solicitudId = datos.insertarSolicitud({
      pedido_id: pedidoId,
      item_id: itemId,
      tipo,
      cantidad_nueva: cn,
      motivo,
      solicitado_por: auxiliarId
    });
    registrarEvento({
      pedidoId,
      usuarioId: auxiliarId,
      tipo: 'correccion_solicitada',
      detalle: {
        solicitud_id: solicitudId,
        tipo,
        producto_id: item.producto_id,
        nombre: item.nombre_producto,
        cantidad_actual: item.cantidad,
        ...(cn !== null ? { cantidad_nueva: cn } : {}),
        motivo
      }
    });
  });
  operar();
  const solicitud = datos.solicitudCompleta(solicitudId)!;
  emisor.correccionSolicitada({ solicitud });
  return solicitud;
}

/** El admin aprueba: ejecuta la reducción/eliminación real y marca 'aprobada'. */
export function aprobarCorreccion(
  solicitudId: number,
  adminId: number,
  adminNombre: string
): SolicitudCorreccion {
  // Se lee ANTES de ejecutar: si es 'eliminar', el item desaparece.
  const previa = datos.solicitudCompleta(solicitudId);
  let afectado: number | null = null;
  let cancelado = false;
  let pedidoId = 0;

  const operar = db.transaction(() => {
    const s = datos.solicitudPorId(solicitudId);
    if (!s) throw errores.noEncontrado('Esa solicitud no existe.');
    if (s.estado !== 'pendiente') throw errores.solicitudNoPendiente();
    pedidoId = s.pedido_id;
    const pedido = obtenerPedido(s.pedido_id);
    if (!pedido || pedido.estado !== 'abierto') throw errores.pedidoNoEditable();
    const item = itemDe(s.pedido_id, s.item_id);
    if (!item) throw errores.itemNoEncontrado();

    const origen = { solicitud_id: solicitudId, solicitado_por: s.solicitado_por };
    if (s.tipo === 'reducir') {
      afectado = ejecutarReducir(item, s.cantidad_nueva!, adminId, origen);
    } else {
      const r = ejecutarEliminar(item, adminId, origen);
      afectado = r.afectado;
      cancelado = r.cancelado;
    }
    datos.marcarEstado(solicitudId, 'aprobada', adminId);
  });
  operar();

  emitirTrasEjecutar(pedidoId, afectado, cancelado);
  const s2 = datos.solicitudPorId(solicitudId)!;
  const solicitud: SolicitudCorreccion = {
    ...previa!,
    estado: 'aprobada',
    resuelto_por: adminId,
    resuelto_por_nombre: adminNombre,
    resuelto_en: s2.resuelto_en
  };
  emisor.correccionResuelta({ solicitud });
  return solicitud;
}

/** El admin rechaza: marca 'rechazada' y registra el evento. El item queda intacto. */
export function rechazarCorreccion(
  solicitudId: number,
  adminId: number,
  adminNombre: string
): SolicitudCorreccion {
  const previa = datos.solicitudCompleta(solicitudId);
  const operar = db.transaction(() => {
    const s = datos.solicitudPorId(solicitudId);
    if (!s) throw errores.noEncontrado('Esa solicitud no existe.');
    if (s.estado !== 'pendiente') throw errores.solicitudNoPendiente();
    if (!previa) throw errores.itemNoEncontrado();
    datos.marcarEstado(solicitudId, 'rechazada', adminId);
    registrarEvento({
      pedidoId: s.pedido_id,
      usuarioId: adminId,
      tipo: 'correccion_rechazada',
      detalle: {
        solicitud_id: solicitudId,
        tipo: s.tipo,
        producto_id: previa.producto_id,
        nombre: previa.nombre,
        motivo: s.motivo
      }
    });
  });
  operar();
  const s2 = datos.solicitudPorId(solicitudId)!;
  const solicitud: SolicitudCorreccion = {
    ...previa!,
    estado: 'rechazada',
    resuelto_por: adminId,
    resuelto_por_nombre: adminNombre,
    resuelto_en: s2.resuelto_en
  };
  emisor.correccionResuelta({ solicitud });
  return solicitud;
}
