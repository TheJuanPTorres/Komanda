// Eventos de WebSocket (Socket.IO) tipados.
// El front NUNCA hace polling: escucha estos eventos y reacciona.
// Cada cambio de estado de pedidos/productos emite uno de estos eventos.

import type { Pedido, PedidoItem, Producto, SolicitudCorreccion } from './types.js';

// Nombres canónicos de los eventos. Usar SIEMPRE estas constantes,
// nunca literales sueltos, para evitar typos entre servidor y app.
export const EVENTOS = {
  PEDIDO_CREADO: 'pedido:creado',
  PEDIDO_ACTUALIZADO: 'pedido:actualizado',
  PEDIDO_COBRADO: 'pedido:cobrado',
  PEDIDO_CANCELADO: 'pedido:cancelado',
  PRODUCTO_ACTUALIZADO: 'producto:actualizado',
  // Correcciones (v1.5-B): admin y auxiliar ven las solicitudes en vivo.
  CORRECCION_SOLICITADA: 'correccion:solicitada',
  CORRECCION_RESUELTA: 'correccion:resuelta'
} as const;

// ── Payloads de cada evento ──────────────────────────────────────────────

// Un pedido recién abierto (aún puede no tener items).
export interface PedidoCreadoPayload {
  pedido: Pedido;
  items: PedidoItem[];
}

// Cambió algo del pedido: se agregaron/quitaron items, cambió la nota, etc.
export interface PedidoActualizadoPayload {
  pedido: Pedido;
  items: PedidoItem[];
}

// El admin cerró y cobró el pedido.
export interface PedidoCobradoPayload {
  pedidoId: number;
  cerrado_en: string;
  cerrado_por: number;
}

// Se canceló el pedido.
export interface PedidoCanceladoPayload {
  pedidoId: number;
}

// Cambió un producto (precio, stock, activo…). El menú de todos se refresca.
export interface ProductoActualizadoPayload {
  producto: Producto;
}

// Un auxiliar solicitó una corrección (reducir/eliminar) en un pedido abierto.
export interface CorreccionSolicitadaPayload {
  solicitud: SolicitudCorreccion;
}

// El admin resolvió una solicitud (aprobada/rechazada/anulada).
export interface CorreccionResueltaPayload {
  solicitud: SolicitudCorreccion;
}

// Mapa evento -> payload. Sirve para tipar el emisor y los listeners.
export interface EventosPayloads {
  [EVENTOS.PEDIDO_CREADO]: PedidoCreadoPayload;
  [EVENTOS.PEDIDO_ACTUALIZADO]: PedidoActualizadoPayload;
  [EVENTOS.PEDIDO_COBRADO]: PedidoCobradoPayload;
  [EVENTOS.PEDIDO_CANCELADO]: PedidoCanceladoPayload;
  [EVENTOS.PRODUCTO_ACTUALIZADO]: ProductoActualizadoPayload;
  [EVENTOS.CORRECCION_SOLICITADA]: CorreccionSolicitadaPayload;
  [EVENTOS.CORRECCION_RESUELTA]: CorreccionResueltaPayload;
}

export type NombreEvento = (typeof EVENTOS)[keyof typeof EVENTOS];
