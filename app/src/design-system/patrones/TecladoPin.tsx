// Teclado numérico propio para el PIN del admin (nunca el teclado del sistema).
import { Delete, Check } from 'lucide-react';

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  onEnter?: () => void;
  longitud?: number;
}

export function TecladoPin({ valor, onCambio, onEnter, longitud = 4 }: Props) {
  function pulsar(digito: string) {
    if (valor.length < longitud) onCambio(valor + digito);
  }
  function borrar() {
    onCambio(valor.slice(0, -1));
  }

  return (
    <div className="pat-pin">
      <div className="pat-pin__puntos">
        {Array.from({ length: longitud }).map((_, i) => (
          <span key={i} className={`pat-pin__punto ${i < valor.length ? 'pat-pin__punto--lleno' : ''}`} />
        ))}
      </div>
      <div className="pat-pin__teclas">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pat-pin__tecla" onClick={() => pulsar(d)}>
            {d}
          </button>
        ))}
        <button className="pat-pin__tecla pat-pin__tecla--accion" onClick={borrar} aria-label="Borrar">
          <Delete size={24} strokeWidth={2.25} />
        </button>
        <button className="pat-pin__tecla" onClick={() => pulsar('0')}>
          0
        </button>
        <button
          className="pat-pin__tecla pat-pin__tecla--accion"
          onClick={() => onEnter?.()}
          aria-label="Entrar"
        >
          <Check size={24} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
