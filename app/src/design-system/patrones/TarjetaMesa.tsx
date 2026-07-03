// La placa vial del sistema. Mesas y barra usan la misma placa.
import { formatearDinero } from './FormatearDinero.js';

export type EstadoMesa = 'libre' | 'ocupada' | 'por_cobrar';

interface Props {
  variante?: 'mesa' | 'barra';
  /** Número de mesa (variante 'mesa'). */
  numero?: number;
  /** Turno de barra, ej. "B-07" (variante 'barra'). */
  turno?: string;
  /** Nombre del cliente (variante 'barra'). */
  cliente?: string;
  estado: EstadoMesa;
  total?: number;
  onClick?: () => void;
}

const ETIQUETA: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  por_cobrar: 'Por cobrar'
};

export function TarjetaMesa({
  variante = 'mesa',
  numero,
  turno,
  cliente,
  estado,
  total,
  onClick
}: Props) {
  const clases = ['pat-mesa', estado !== 'libre' ? `pat-mesa--${estado}` : ''].filter(Boolean).join(' ');

  return (
    <button className={clases} onClick={onClick}>
      {variante === 'mesa' ? (
        <span className="pat-mesa__numero">{numero}</span>
      ) : (
        <span className="pat-mesa__turno">{turno}</span>
      )}

      {variante === 'barra' && cliente && <span className="pat-mesa__cliente">{cliente}</span>}

      <span className="pat-mesa__estado">{ETIQUETA[estado]}</span>

      {estado !== 'libre' && total !== undefined && (
        <span className="pat-mesa__total">{formatearDinero(total)}</span>
      )}
    </button>
  );
}
