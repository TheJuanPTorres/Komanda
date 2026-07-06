// Utilidades de fecha del servidor. CONVENCIÓN INTACTA: lo ALMACENADO es UTC
// (datetime('now') de SQLite → 'YYYY-MM-DD HH:MM:SS'). La zona horaria solo
// interviene al calcular las FRONTERAS del "día operativo" y al presentar.
//
// El VPS puede vivir en otra zona (EE.UU.); el "día del negocio" se calcula
// SIEMPRE en config.tzNegocio (America/Bogota por defecto), nunca con la hora
// local del servidor ni con date('now') de SQLite. Utilidad central abajo:
// diaOperativo(). Sin librerías: Intl.DateTimeFormat con timeZone alcanza.
import { config } from '../config.js';

/**
 * Día operativo (fecha calendario 'YYYY-MM-DD') en la zona del negocio para un
 * instante dado. Es "hoy" tal como lo vive el negocio: una venta de las 23:30
 * en Colombia pertenece a ese día, aunque en UTC ya sea el día siguiente.
 */
export function diaOperativo(instante: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tzNegocio,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(instante);
}

// Desfase de la zona (en ms) respecto a UTC en un instante dado. Usa Intl, así
// que respeta horario de verano en zonas que lo usen (Colombia no lo usa).
function desfaseMs(instante: Date): number {
  const nombre = new Intl.DateTimeFormat('en-US', {
    timeZone: config.tzNegocio,
    timeZoneName: 'longOffset'
  })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value; // p. ej. "GMT-05:00"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nombre ?? '');
  if (!m) return 0;
  const signo = m[1] === '-' ? -1 : 1;
  return signo * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
}

// Instante UTC (ms) del inicio (00:00 hora del negocio) de un día calendario.
function inicioDiaUtcMs(diaLocal: string): number {
  // Mediodía del día local da un desfase estable (evita bordes de DST).
  const aprox = new Date(`${diaLocal}T12:00:00Z`);
  return Date.parse(`${diaLocal}T00:00:00Z`) - desfaseMs(aprox);
}

// Convierte epoch ms a 'YYYY-MM-DD HH:MM:SS' en UTC (formato de SQLite).
function aFormatoSqlite(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Rango [desde, hasta) del día operativo actual, en cadenas UTC con el formato
 * de datetime('now'), para comparar directo contra creado_en / cerrado_en.
 */
export function rangoDiaOperativo(instante: Date = new Date()): {
  desdeUtc: string;
  hastaUtc: string;
} {
  const inicioMs = inicioDiaUtcMs(diaOperativo(instante));
  return {
    desdeUtc: aFormatoSqlite(inicioMs),
    hastaUtc: aFormatoSqlite(inicioMs + 24 * 60 * 60 * 1000)
  };
}

/**
 * Convierte un rango de días del negocio (YYYY-MM-DD, inclusivos) a los límites
 * UTC [desde, hasta) equivalentes, en formato SQLite. `hasta` es inclusivo: el
 * límite superior es el fin de ese día.
 */
export function rangoUtcDesdeFechas(
  desde: string,
  hasta: string
): { desdeUtc: string; hastaUtc: string } {
  const inicioMs = inicioDiaUtcMs(desde);
  const finMs = inicioDiaUtcMs(hasta) + 24 * 60 * 60 * 1000;
  return { desdeUtc: aFormatoSqlite(inicioMs), hastaUtc: aFormatoSqlite(finMs) };
}
