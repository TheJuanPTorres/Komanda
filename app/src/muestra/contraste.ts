// Cálculo de contraste WCAG 2.1. Se usa en /muestra para verificar que cada
// combinación tinta/superficie del sistema cumple AA (4.5:1 texto normal,
// 3:1 texto grande).

function aRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function canalLineal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

/** Razón de contraste entre dos colores hex (>= 1). */
export function razonContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

export type Veredicto = 'AA' | 'AA grande' | 'insuficiente';

/** Veredicto AA: >=4.5 texto normal, >=3 solo texto grande. */
export function veredictoAA(ratio: number): Veredicto {
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA grande';
  return 'insuficiente';
}
