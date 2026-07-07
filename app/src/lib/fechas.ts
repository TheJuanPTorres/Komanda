// Presentación de fechas. La DB guarda UTC ('YYYY-MM-DD HH:MM:SS'); aquí se
// convierte a hora de Colombia solo para mostrar.
const horaBogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit'
});

// Interpreta la cadena UTC de SQLite como fecha real (agregando la Z).
function comoFecha(utc: string): Date {
  return new Date(utc.replace(' ', 'T') + 'Z');
}

/** '2026-07-02 13:05:00' (UTC) -> '08:05 a. m.' (hora Bogotá) */
export function hora(utc: string): string {
  return horaBogota.format(comoFecha(utc));
}

const fechaHoraBogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const fechaLargaBogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit'
});

/** '2026-07-02 13:05:00' (UTC) -> '02 jul, 08:05 a. m.' (hora Bogotá) */
export function fechaHora(utc: string): string {
  return fechaHoraBogota.format(comoFecha(utc));
}

/** Versión larga para la ficha: 'miércoles, 02 de julio, 08:05 a. m.' */
export function fechaLarga(utc: string): string {
  return fechaLargaBogota.format(comoFecha(utc));
}
