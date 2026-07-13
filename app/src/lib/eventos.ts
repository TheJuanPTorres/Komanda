// Redacción legible de un evento de la bitácora, en un helper compartido:
// la Etapa B (explorador de ventas / reporte de correcciones) lo reutiliza.
import type { DetalleNotaEditada, EventoPedido, TipoEventoPedido } from '@pos/shared';
import { formatearDinero } from '../design-system/index.js';
import { turnoBarra } from './etiquetas.js';

// Normaliza el detalle de 'nota_editada' tolerando la forma heredada
// { nota_antes, nota_despues } de eventos anteriores a v1.5-C.
function leerNotaEditada(
  detalle: DetalleNotaEditada & { nota_antes?: string; nota_despues?: string }
): { campo: 'nota' | 'cliente_nombre'; despues: string } {
  return {
    campo: detalle.campo ?? 'nota',
    despues: (detalle.despues ?? detalle.nota_despues ?? '').trim()
  };
}

// Las correcciones (solicitud, resolución, bajar/quitar) se resaltan en la
// línea de tiempo con el acento de la marca.
export function esCorreccion(tipo: TipoEventoPedido): boolean {
  return (
    tipo === 'item_reducido' ||
    tipo === 'item_eliminado' ||
    tipo === 'correccion_solicitada' ||
    tipo === 'correccion_rechazada'
  );
}

// Describe cómo se cobró, a partir del arreglo de pagos.
function describirPagos(pagos: { metodo: 'efectivo' | 'qr_breb' }[]): string {
  const metodos = pagos.map((p) => (p.metodo === 'qr_breb' ? 'QR Bre-B' : 'efectivo'));
  const unicos = [...new Set(metodos)];
  return unicos.join(' y ');
}

/** Frase legible del evento, con el actor incluido (p. ej. "Yeimy agregó 3 × Empanadas"). */
export function describirEvento(e: EventoPedido): string {
  const quien = e.usuario_nombre;
  switch (e.tipo) {
    case 'creado':
      return e.detalle.tipo_pedido === 'mesa'
        ? `${quien} abrió la Mesa ${e.detalle.mesa_numero}`
        : `${quien} abrió ${turnoBarra(e.detalle.turno ?? null)} · ${e.detalle.cliente_nombre ?? ''}`;
    case 'item_agregado':
      return `${quien} agregó ${e.detalle.cantidad} × ${e.detalle.nombre}`;
    case 'item_reducido':
      return `${quien} bajó ${e.detalle.nombre} de ${e.detalle.cantidad_antes} a ${e.detalle.cantidad_despues}`;
    case 'item_eliminado':
      return `${quien} eliminó ${e.detalle.cantidad_eliminada} × ${e.detalle.nombre}`;
    case 'nota_editada': {
      const { campo, despues } = leerNotaEditada(e.detalle);
      if (campo === 'cliente_nombre') {
        return despues ? `${quien} nombró el pedido “${despues}”` : `${quien} quitó el nombre`;
      }
      return despues ? `${quien} cambió la nota` : `${quien} quitó la nota`;
    }
    case 'cancelado':
      return e.detalle.motivo === 'quedo_vacio'
        ? `${quien} dejó el pedido vacío; se canceló`
        : `${quien} canceló el pedido`;
    case 'cobrado':
      return `${quien} cobró ${formatearDinero(e.detalle.total)} en ${describirPagos(e.detalle.pagos)}`;
    case 'correccion_solicitada':
      return e.detalle.tipo === 'reducir'
        ? `${quien} solicitó bajar ${e.detalle.nombre} a ${e.detalle.cantidad_nueva}`
        : `${quien} solicitó eliminar ${e.detalle.nombre}`;
    case 'correccion_rechazada':
      return `${quien} rechazó la corrección de ${e.detalle.nombre}`;
  }
}
