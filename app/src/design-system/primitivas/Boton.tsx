import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Acciones de flujo (enviar, cobrar…): alto mínimo crítico (56px). */
  flujo?: boolean;
  bloque?: boolean;
}

export function Boton({
  variante = 'primario',
  flujo = false,
  bloque = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  const clases = [
    'ds-boton',
    `ds-boton--${variante}`,
    flujo ? 'ds-boton--flujo' : '',
    bloque ? 'ds-boton--bloque' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={clases} {...resto} />;
}
