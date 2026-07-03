import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  bloque?: boolean;
  grande?: boolean;
}

export function Boton({
  variante = 'primario',
  bloque = false,
  grande = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  const clases = [
    'ds-boton',
    `ds-boton--${variante}`,
    bloque ? 'ds-boton--bloque' : '',
    grande ? 'ds-boton--grande' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={clases} {...resto} />;
}
