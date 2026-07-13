// Fila de menú para la toma en móvil (v1.5-C, Parte 2.2): UNA fila por producto.
// [ foto 56×56 | nombre + precio (+ badge de stock) | control de cantidad ].
// Tocar el cuerpo de la fila suma 1. Si el producto no está en el pedido, un
// botón "+" grande; si ya está, un stepper compacto [− cantidad +]. El contador
// hace una micro-animación de escala al cambiar (feedback optimista, Parte 5.4).
import { Minus, Plus } from 'lucide-react';
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  nombre: string;
  precio: number;
  imagen?: string | null;
  /** Cantidad ya en el pedido. */
  cantidad?: number;
  /** Stock restante si el producto controla stock (badge "QUEDAN n"). */
  stock?: number;
  agotado?: boolean;
  /** El item tiene una corrección pendiente (deshabilita el "−"). */
  pendiente?: boolean;
  /** Suma 1 (botón "+" o tap en la fila). */
  onSumar?: () => void;
  /** Baja 1 (admin: reduce; auxiliar: abre "solicitar corrección"). */
  onRestar?: () => void;
}

export function FilaMenu({
  nombre,
  precio,
  imagen,
  cantidad = 0,
  stock,
  agotado = false,
  pendiente = false,
  onSumar,
  onRestar
}: Props) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';
  const enPedido = cantidad > 0;

  return (
    <div className={`fila-menu ${enPedido ? 'fila-menu--activa' : ''}`.trim()}>
      <button
        className="fila-menu__cuerpo"
        onClick={onSumar}
        disabled={agotado}
        aria-label={`Agregar ${nombre}`}
      >
        <span className="fila-menu__foto">
          {imagen ? (
            <img className="fila-menu__img" src={imagen} alt="" loading="lazy" />
          ) : (
            <span className="fila-menu__inicial" aria-hidden="true">
              {inicial}
            </span>
          )}
        </span>
        <span className="fila-menu__datos">
          <span className="fila-menu__nombre">{nombre}</span>
          {/* El tag de stock va en su propia línea, bajo el título: así el texto
              no se desacomoda cuando aparece el stepper (control más ancho). */}
          {agotado ? (
            <span className="fila-menu__badge fila-menu__badge--agotado">Agotado</span>
          ) : stock !== undefined ? (
            <span className="fila-menu__badge fila-menu__badge--stock">Quedan {stock}</span>
          ) : null}
          <span className="fila-menu__precio">{formatearDinero(precio)}</span>
        </span>
      </button>

      <div className="fila-menu__ctrl">
        {!enPedido ? (
          <button
            className="fila-menu__mas"
            onClick={onSumar}
            disabled={agotado}
            aria-label={`Agregar ${nombre}`}
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        ) : (
          <div className="fila-menu__stepper">
            <button
              className="fila-menu__paso fila-menu__paso--menos"
              onClick={onRestar}
              disabled={!onRestar || pendiente}
              aria-label={`Bajar ${nombre}`}
            >
              <Minus size={20} strokeWidth={2.5} />
            </button>
            {/* key={cantidad}: remonta el número para reproducir la animación. */}
            <span key={cantidad} className="fila-menu__cant">
              {cantidad}
            </span>
            <button
              className="fila-menu__paso fila-menu__paso--mas"
              onClick={onSumar}
              disabled={agotado}
              aria-label={`Subir ${nombre}`}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
