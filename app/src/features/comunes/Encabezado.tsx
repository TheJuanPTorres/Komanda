// Encabezado reutilizable (placa superior). Botón de volver opcional y una
// zona de acciones a la derecha.
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import './comunes.css';

interface Props {
  titulo: string;
  subtitulo?: string;
  onVolver?: () => void;
  acciones?: ReactNode;
}

export function Encabezado({ titulo, subtitulo, onVolver, acciones }: Props) {
  return (
    <header className="enc">
      {onVolver && (
        <button className="enc__volver" onClick={onVolver} aria-label="Volver">
          <ChevronLeft size={24} strokeWidth={2.25} />
        </button>
      )}
      <div className="enc__titulo">
        <strong>{titulo}</strong>
        {subtitulo && <span>{subtitulo}</span>}
      </div>
      {acciones && <div className="enc__acciones">{acciones}</div>}
    </header>
  );
}
