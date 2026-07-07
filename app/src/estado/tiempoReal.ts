// Puente entre los eventos WS del servidor y el store. Se registra una sola
// vez al arrancar la app. El front reacciona a estos eventos; nunca sondea.
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
import { socket } from '../lib/socket.js';
import { calcularTotal, useStore } from './store.js';

let registrado = false;

export function iniciarTiempoReal(): void {
  if (registrado) return;
  registrado = true;

  const {
    aplicarPedido,
    quitarPedidoLocal,
    aplicarProducto,
    aplicarCorreccion,
    resolverCorreccionLocal,
    quitarCorreccionesDePedido
  } = useStore.getState();

  const onCreadoOActualizado = (p: PedidoCreadoPayload | PedidoActualizadoPayload) => {
    aplicarPedido({ pedido: p.pedido, items: p.items, total: calcularTotal(p.items) });
  };

  // Al cobrar, el admin refresca el Pulso del día (ventas y # de pedidos).
  const refrescarPulsoAdmin = () => {
    const { sesion, cargarPulso } = useStore.getState();
    if (sesion?.rol === 'admin') cargarPulso().catch(() => {});
  };

  socket.on(EVENTOS.PEDIDO_CREADO, onCreadoOActualizado);
  socket.on(EVENTOS.PEDIDO_ACTUALIZADO, onCreadoOActualizado);
  socket.on(EVENTOS.PEDIDO_COBRADO, (p: PedidoCobradoPayload) => {
    quitarPedidoLocal(p.pedidoId);
    refrescarPulsoAdmin();
  });
  socket.on(EVENTOS.PEDIDO_CANCELADO, (p: PedidoCanceladoPayload) => {
    quitarPedidoLocal(p.pedidoId);
    // Al cancelarse, sus solicitudes pendientes quedaron anuladas.
    quitarCorreccionesDePedido(p.pedidoId);
  });
  socket.on(EVENTOS.PRODUCTO_ACTUALIZADO, (p: ProductoActualizadoPayload) => aplicarProducto(p.producto));

  // Correcciones: admin y auxiliar ven todo en vivo.
  socket.on(EVENTOS.CORRECCION_SOLICITADA, (p: CorreccionSolicitadaPayload) => {
    aplicarCorreccion(p.solicitud);
  });
  socket.on(EVENTOS.CORRECCION_RESUELTA, (p: CorreccionResueltaPayload) => {
    resolverCorreccionLocal(p.solicitud.id);
    // Aviso al auxiliar que la solicitó cuando el admin la resuelve.
    const { sesion, mostrarAviso } = useStore.getState();
    if (sesion && sesion.id === p.solicitud.solicitado_por && sesion.rol === 'auxiliar') {
      const verbo = p.solicitud.estado === 'aprobada' ? 'aprobó' : 'rechazó';
      mostrarAviso(`El admin ${verbo} tu corrección de ${p.solicitud.nombre}.`);
    }
  });
}
