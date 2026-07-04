// Toma rápida con foto arriba (patrón de tarjeta de la referencia de marca).
// Tap en cualquier parte agrega 1. Sin foto: placeholder con la inicial en
// Bungee sobre --coma-tenue (nunca rompe la grilla ni muestra ícono roto).
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  nombre: string;
  precio: number;
  /** URL de la foto (ruta relativa servida por el backend). Si falta, placeholder. */
  imagen?: string | null;
  /** Cantidad ya en el pedido (muestra el contador circular). */
  cantidad?: number;
  /** Stock restante si el producto controla stock (badge "QUEDAN n"). */
  stock?: number;
  agotado?: boolean;
  onAgregar?: () => void;
}

export function TarjetaProducto({
  nombre,
  precio,
  imagen,
  cantidad = 0,
  stock,
  agotado = false,
  onAgregar
}: Props) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';

  return (
    <button className="pat-producto" disabled={agotado} onClick={onAgregar}>
      <div className="pat-producto__foto">
        {imagen ? (
          <img className="pat-producto__img" src={imagen} alt="" loading="lazy" />
        ) : (
          <span className="pat-producto__inicial" aria-hidden="true">
            {inicial}
          </span>
        )}
        {cantidad > 0 && <span className="pat-producto__contador">{cantidad}</span>}
        {agotado ? (
          <span className="pat-producto__badge pat-producto__badge--agotado">Agotado</span>
        ) : stock !== undefined ? (
          <span className="pat-producto__badge pat-producto__badge--stock">Quedan {stock}</span>
        ) : null}
      </div>

      <span className="pat-producto__nombre">{nombre}</span>
      <span className="pat-producto__precio">{formatearDinero(precio)}</span>
    </button>
  );
}
