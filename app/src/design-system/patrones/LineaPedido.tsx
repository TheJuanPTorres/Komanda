import { Minus, PencilLine, Plus, Trash2 } from 'lucide-react';
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  cantidad: number;
  nombre: string;
  subtotal: number;
  /** El item tiene una corrección pendiente de aprobación (distintivo ámbar). */
  pendiente?: boolean;
  /** Baja 1 (admin directo). Si falta, no se muestra el botón. */
  onMenos?: () => void;
  /** Sube 1. */
  onMas?: () => void;
  /** Quita la línea completa (admin directo; con confirmación en el contenedor). */
  onEliminar?: () => void;
  /** Auxiliar: abre el flujo de "Solicitar corrección". */
  onSolicitar?: () => void;
}

export function LineaPedido({
  cantidad,
  nombre,
  subtotal,
  pendiente,
  onMenos,
  onMas,
  onEliminar,
  onSolicitar
}: Props) {
  const editable = Boolean(onMenos || onMas || onEliminar || onSolicitar);
  return (
    <div className="pat-linea">
      <span className="pat-linea__cant">{cantidad}×</span>
      <span className="pat-linea__nombre">
        {nombre}
        {pendiente && <span className="pat-linea__pendiente">Corrección pendiente</span>}
      </span>
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
          {onSolicitar && (
            <button
              className="pat-linea__paso pat-linea__paso--solicitar"
              onClick={onSolicitar}
              disabled={pendiente}
              aria-label={`Solicitar corrección de ${nombre}`}
            >
              <PencilLine size={20} strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
