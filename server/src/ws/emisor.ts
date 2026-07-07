// Emisor tipado de eventos de tiempo real. El resto del servidor NO llama a
// io.emit directamente: usa estas funciones para no equivocarse de evento ni
// de forma del payload. Los nombres y payloads viven en shared/eventos.ts.
import type { Server } from 'socket.io';
import {
  EVENTOS,
  type CorreccionResueltaPayload,
  type CorreccionSolicitadaPayload,
  type PedidoActualizadoPayload,
  type PedidoCanceladoPayload,
  type PedidoCobradoPayload,
  type PedidoCreadoPayload,
  type ProductoActualizadoPayload
} from '@pos/shared';

let io: Server | null = null;

// Lo llama el arranque de WS una vez creado el servidor Socket.IO.
export function registrarIo(servidor: Server): void {
  io = servidor;
}

function emitir<T>(evento: string, payload: T): void {
  // Si aún no hay io (p. ej. en scripts como el seed), no rompemos nada.
  io?.emit(evento, payload);
}

export const emisor = {
  pedidoCreado(payload: PedidoCreadoPayload): void {
    emitir(EVENTOS.PEDIDO_CREADO, payload);
  },
  pedidoActualizado(payload: PedidoActualizadoPayload): void {
    emitir(EVENTOS.PEDIDO_ACTUALIZADO, payload);
  },
  pedidoCobrado(payload: PedidoCobradoPayload): void {
    emitir(EVENTOS.PEDIDO_COBRADO, payload);
  },
  pedidoCancelado(payload: PedidoCanceladoPayload): void {
    emitir(EVENTOS.PEDIDO_CANCELADO, payload);
  },
  productoActualizado(payload: ProductoActualizadoPayload): void {
    emitir(EVENTOS.PRODUCTO_ACTUALIZADO, payload);
  },
  correccionSolicitada(payload: CorreccionSolicitadaPayload): void {
    emitir(EVENTOS.CORRECCION_SOLICITADA, payload);
  },
  correccionResuelta(payload: CorreccionResueltaPayload): void {
    emitir(EVENTOS.CORRECCION_RESUELTA, payload);
  }
} as const;
