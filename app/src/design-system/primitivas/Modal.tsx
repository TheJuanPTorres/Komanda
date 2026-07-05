import type { ReactNode } from 'react';

interface Props {
  abierto?: boolean;
  titulo: string;
  onCerrar?: () => void;
  children?: ReactNode;
  /** Clase extra para la placa (p. ej. "ds-modal--ancho"). */
  className?: string;
  /** Renderiza solo la placa del modal, sin el velo fijo (para el storybook). */
  estatico?: boolean;
}

export function Modal({
  abierto = true,
  titulo,
  onCerrar,
  children,
  className,
  estatico = false
}: Props) {
  if (!abierto) return null;

  const placa = (
    <div
      className={`ds-modal ${className ?? ''}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="ds-modal__titulo">{titulo}</h2>
      {children}
    </div>
  );

  if (estatico) return placa;

  return (
    <div className="ds-modal__fondo" onClick={() => onCerrar?.()}>
      {placa}
    </div>
  );
}
