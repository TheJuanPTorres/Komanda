// Utilidades de periodos para los reportes, en días de Bogotá (YYYY-MM-DD).

/** Fecha de hoy en Colombia (YYYY-MM-DD). */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/** Resta n días a una fecha YYYY-MM-DD y devuelve otra YYYY-MM-DD. */
export function restarDias(fecha: string, n: number): string {
  // Mediodía UTC evita saltos por zona horaria al formatear.
  const ms = new Date(`${fecha}T12:00:00Z`).getTime() - n * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}
