import { Minus } from 'lucide-react';
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  cantidad: number;
  nombre: string;
  subtotal: number;
  onQuitar?: () => void;
}

export function LineaPedido({ cantidad, nombre, subtotal, onQuitar }: Props) {
  return (
    <div className="pat-linea">
      <span className="pat-linea__cant">{cantidad}×</span>
      <span className="pat-linea__nombre">{nombre}</span>
      <span className="pat-linea__sub">{formatearDinero(subtotal)}</span>
      {onQuitar && (
        <button className="pat-linea__quitar" onClick={onQuitar} aria-label={`Quitar ${nombre}`}>
          <Minus size={24} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
