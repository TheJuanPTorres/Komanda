// Formato de dinero colombiano del manual de marca: "$ 4.500".
// Espacio tras el $, punto de miles, SIN decimales. El dinero es entero
// (pesos COP); jamás se usa float. Siempre se muestra en DM Mono + tabular-nums
// (eso lo garantizan las clases que consumen este texto).
export function formatearDinero(entero: number): string {
  const n = Math.round(entero);
  const signo = n < 0 ? '−' : '';
  const conMiles = Math.abs(n).toLocaleString('es-CO'); // 4500 -> "4.500"
  return `${signo}$ ${conMiles}`;
}
