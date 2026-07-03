// Etiquetas de presentación para pedidos.

/** Turno de barra como "B-01", "B-02"… */
export function turnoBarra(turno: number | null): string {
  if (turno === null) return 'B-—';
  return `B-${String(turno).padStart(2, '0')}`;
}

/** Cuenta total de unidades (suma de cantidades) de un pedido. */
export function contarUnidades(items: { cantidad: number }[]): number {
  return items.reduce((acc, it) => acc + it.cantidad, 0);
}

/** Etiquetas legibles para las categorías de gasto. */
export const ETIQUETA_CATEGORIA_GASTO: Record<string, string> = {
  insumos: 'Insumos',
  servicios: 'Servicios',
  nomina: 'Nómina',
  otros: 'Otros'
};

/** Etiqueta legible del método de pago/gasto. */
export function etiquetaMetodo(metodo: string): string {
  return metodo === 'qr_breb' ? 'QR Bre-B' : 'Efectivo';
}
