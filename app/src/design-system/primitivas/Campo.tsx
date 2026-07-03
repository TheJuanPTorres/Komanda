import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string;
  /** Mensaje de error; si está presente, el campo se marca en rojo. */
  error?: string;
}

export function Campo({ etiqueta, error, className = '', id, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <div className={`ds-campo ${error ? 'ds-campo--error' : ''}`.trim()}>
      {etiqueta && (
        <label className="ds-campo__etiqueta" htmlFor={idCampo}>
          {etiqueta}
        </label>
      )}
      <input
        id={idCampo}
        className={`ds-campo__control ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...resto}
      />
      {error && <span className="ds-campo__error">{error}</span>}
    </div>
  );
}
