// Toma rápida SIN fotos (velocidad ante todo). Tap en cualquier parte agrega 1.
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  nombre: string;
  precio: number;
  /** Cantidad ya en el pedido (muestra el contador circular). */
  cantidad?: number;
  /** Stock restante si el producto controla stock (badge "QUEDAN n"). */
  stock?: number;
  agotado?: boolean;
  onAgregar?: () => void;
}

export function TarjetaProducto({ nombre, precio, cantidad = 0, stock, agotado = false, onAgregar }: Props) {
  return (
    <button className="pat-producto" disabled={agotado} onClick={onAgregar}>
      {cantidad > 0 && <span className="pat-producto__contador">{cantidad}</span>}

      <span className="pat-producto__nombre">{nombre}</span>

      {agotado ? (
        <span className="pat-producto__badge pat-producto__badge--agotado">Agotado</span>
      ) : stock !== undefined ? (
        <span className="pat-producto__badge pat-producto__badge--stock">Quedan {stock}</span>
      ) : null}

      <span className="pat-producto__precio">{formatearDinero(precio)}</span>
    </button>
  );
}
