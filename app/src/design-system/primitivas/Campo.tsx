import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string;
}

export function Campo({ etiqueta, className = '', id, ...resto }: Props) {
  return (
    <label className="ds-campo" htmlFor={id}>
      {etiqueta && <span className="ds-campo__etiqueta">{etiqueta}</span>}
      <input id={id} className={`ds-campo__control ${className}`.trim()} {...resto} />
    </label>
  );
}
