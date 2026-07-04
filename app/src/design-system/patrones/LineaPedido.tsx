import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  cantidad: number;
  nombre: string;
  subtotal: number;
  /** Baja 1 (o quita si llega a 0). Si falta, no se muestra el stepper. */
  onMenos?: () => void;
  /** Sube 1. */
  onMas?: () => void;
  /** Quita la línea completa (con confirmación en el contenedor). */
  onEliminar?: () => void;
}

export function LineaPedido({ cantidad, nombre, subtotal, onMenos, onMas, onEliminar }: Props) {
  const editable = Boolean(onMenos || onMas || onEliminar);
  return (
    <div className="pat-linea">
      <span className="pat-linea__cant">{cantidad}×</span>
      <span className="pat-linea__nombre">{nombre}</span>
      <span className="pat-linea__sub">{formatearDinero(subtotal)}</span>

      {editable && (
        <div className="pat-linea__controles">
          {onMenos && (
            <button className="pat-linea__paso" onClick={onMenos} aria-label={`Bajar ${nombre}`}>
              <Minus size={20} strokeWidth={2.25} />
            </button>
          )}
          {onMas && (
            <button className="pat-linea__paso" onClick={onMas} aria-label={`Subir ${nombre}`}>
              <Plus size={20} strokeWidth={2.25} />
            </button>
          )}
          {onEliminar && (
            <button
              className="pat-linea__paso pat-linea__paso--quitar"
              onClick={onEliminar}
              aria-label={`Quitar ${nombre}`}
            >
              <Trash2 size={20} strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
