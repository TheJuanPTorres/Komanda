import type { CSSProperties } from 'react';

interface Props {
  ancho?: number | string;
  alto?: number | string;
  radio?: string;
}

// Bloque de carga con pulso suave (NUNCA spinners).
export function Skeleton({ ancho = '100%', alto = 16, radio }: Props) {
  const estilo: CSSProperties = {
    width: ancho,
    height: alto,
    ...(radio ? { borderRadius: radio } : {})
  };
  return <div className="ds-skeleton" style={estilo} aria-hidden="true" />;
}
