import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  activo?: boolean;
}

export function Chip({ activo = false, className = '', type = 'button', ...resto }: Props) {
  const clases = ['ds-chip', activo ? 'ds-chip--activo' : '', className].filter(Boolean).join(' ');
  return <button type={type} className={clases} aria-pressed={activo} {...resto} />;
}
