// Convierte lo que escribe el usuario en un entero de pesos (COP sin decimales).
// Descarta cualquier caracter que no sea dígito.
export function aEnteroDesdeTexto(texto: string): number {
  const n = parseInt(texto.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}
