// Puente entre los eventos WS del servidor y el store. Se registra una sola
// vez al arrancar la app. El front reacciona a estos eventos; nunca sondea.
import {
  EVENTOS,
  type PedidoActualizadoPayload,
  type PedidoCanceladoPayload,
  type PedidoCobradoPayload,
  type PedidoCreadoPayload
} from '@pos/shared';
import { socket } from '../lib/socket.js';
import { calcularTotal, useStore } from './store.js';

let registrado = false;

export function iniciarTiempoReal(): void {
  if (registrado) return;
  registrado = true;

  const { aplicarPedido, quitarPedidoLocal } = useStore.getState();

  const onCreadoOActualizado = (p: PedidoCreadoPayload | PedidoActualizadoPayload) => {
    aplicarPedido({ pedido: p.pedido, items: p.items, total: calcularTotal(p.items) });
  };

  socket.on(EVENTOS.PEDIDO_CREADO, onCreadoOActualizado);
  socket.on(EVENTOS.PEDIDO_ACTUALIZADO, onCreadoOActualizado);
  socket.on(EVENTOS.PEDIDO_COBRADO, (p: PedidoCobradoPayload) => quitarPedidoLocal(p.pedidoId));
  socket.on(EVENTOS.PEDIDO_CANCELADO, (p: PedidoCanceladoPayload) => quitarPedidoLocal(p.pedidoId));
}
