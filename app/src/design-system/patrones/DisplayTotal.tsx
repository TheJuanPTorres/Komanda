// El momento firma: el letrero de neón nocturno de la marca.
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  monto: number;
  etiqueta?: string;
}

export function DisplayTotal({ monto, etiqueta = 'Total' }: Props) {
  return (
    <div className="pat-total">
      <span className="pat-total__etiqueta">{etiqueta}</span>
      <span className="pat-total__monto">{formatearDinero(monto)}</span>
    </div>
  );
}
