import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Solo para capas realmente elevadas (la sombra vive en los modales). */
  elevada?: boolean;
}

export function Tarjeta({ elevada = false, className = '', ...resto }: Props) {
  const clases = ['ds-tarjeta', elevada ? 'ds-tarjeta--elevada' : '', className]
    .filter(Boolean)
    .join(' ');
  return <div className={clases} {...resto} />;
}
