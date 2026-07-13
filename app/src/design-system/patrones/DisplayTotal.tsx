// El momento firma: el letrero de neón nocturno de la marca.
import { formatearDinero } from './FormatearDinero.js';

interface Props {
  monto: number;
  etiqueta?: string;
  /** Versión compacta (una línea): para la franja sticky de la toma. */
  compacto?: boolean;
}

export function DisplayTotal({ monto, etiqueta = 'Total', compacto = false }: Props) {
  return (
    <div className={`pat-total ${compacto ? 'pat-total--compacto' : ''}`.trim()}>
      <span className="pat-total__etiqueta">{etiqueta}</span>
      <span className="pat-total__monto">{formatearDinero(monto)}</span>
    </div>
  );
}
