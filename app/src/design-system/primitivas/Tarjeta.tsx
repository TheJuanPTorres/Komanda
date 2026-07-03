import type { HTMLAttributes } from 'react';

export function Tarjeta({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ds-tarjeta ${className}`.trim()} {...resto} />;
}
