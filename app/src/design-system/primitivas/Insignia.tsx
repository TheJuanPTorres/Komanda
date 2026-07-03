import type { HTMLAttributes } from 'react';

type Tono = 'neutro' | 'acento' | 'exito';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tono?: Tono;
}

export function Insignia({ tono = 'neutro', className = '', ...resto }: Props) {
  const modificador = tono === 'neutro' ? '' : `ds-insignia--${tono}`;
  return <span className={`ds-insignia ${modificador} ${className}`.trim()} {...resto} />;
}
