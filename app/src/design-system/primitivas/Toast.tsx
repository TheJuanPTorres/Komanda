import type { ReactNode } from 'react';

type Tono = 'neutro' | 'exito' | 'pare' | 'coma';

interface Props {
  tono?: Tono;
  children: ReactNode;
  /** Posición estática en el flujo (para el storybook). Por defecto va fija abajo. */
  estatico?: boolean;
}

export function Toast({ tono = 'neutro', children, estatico = false }: Props) {
  const clases = [
    'ds-toast',
    tono !== 'neutro' ? `ds-toast--${tono}` : '',
    estatico ? 'ds-toast--estatico' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={clases} role="status">
      {children}
    </div>
  );
}
