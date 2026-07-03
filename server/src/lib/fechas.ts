// Utilidades de fecha del lado servidor.
// La DB guarda las fechas en UTC (datetime('now') → 'YYYY-MM-DD HH:MM:SS').
// Para el turno de barra necesitamos saber qué es "hoy" en Colombia.
// Colombia (America/Bogota) es UTC-5 fijo: no usa horario de verano.

/**
 * Rango [desde, hasta) del día actual de Colombia, expresado como cadenas UTC
 * con el mismo formato que datetime('now') de SQLite, para comparar directo
 * contra la columna creado_en.
 */
export function rangoDiaBogota(ahora: Date = new Date()): {
  desdeUtc: string;
  hastaUtc: string;
} {
  // Fecha calendario (YYYY-MM-DD) tal como se ve en Bogotá.
  const fechaBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(ahora);

  // Inicio del día Bogotá (00:00 -05:00) equivale a las 05:00 UTC del mismo día.
  const inicioUtcMs = new Date(`${fechaBogota}T05:00:00Z`).getTime();
  const finUtcMs = inicioUtcMs + 24 * 60 * 60 * 1000;

  return {
    desdeUtc: aFormatoSqlite(inicioUtcMs),
    hastaUtc: aFormatoSqlite(finUtcMs)
  };
}

// Convierte epoch ms a 'YYYY-MM-DD HH:MM:SS' en UTC (formato de SQLite).
function aFormatoSqlite(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Convierte un rango de fechas de Bogotá (YYYY-MM-DD, inclusivos) a los límites
 * UTC [desde, hasta) equivalentes, en formato SQLite, para filtrar creado_en /
 * cerrado_en. `hasta` es inclusivo: el límite superior es el fin de ese día.
 */
export function rangoUtcDesdeFechas(
  desde: string,
  hasta: string
): { desdeUtc: string; hastaUtc: string } {
  const inicioMs = new Date(`${desde}T05:00:00Z`).getTime(); // 00:00 Bogotá
  const finMs = new Date(`${hasta}T05:00:00Z`).getTime() + 24 * 60 * 60 * 1000; // fin del día
  return { desdeUtc: aFormatoSqlite(inicioMs), hastaUtc: aFormatoSqlite(finMs) };
}

/**
 * Fecha calendario de hoy en Colombia (YYYY-MM-DD). Es el "día del negocio":
 * se usa para gastos.fecha y para la fecha del cierre de caja, de modo que la
 * operación nocturna agrupe en el día correcto (no en el UTC del día siguiente).
 */
export function fechaBogotaHoy(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(ahora);
}
