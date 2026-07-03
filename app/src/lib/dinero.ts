// Formateo de dinero. En la DB el dinero es un ENTERO de pesos colombianos
// (sin decimales). Aquí solo se presenta; nunca se hace aritmética con floats.
const formato = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

/** 12000 -> "$ 12.000" */
export function pesos(entero: number): string {
  return formato.format(entero);
}
