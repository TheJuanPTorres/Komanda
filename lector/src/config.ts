// Configuración del lector de pagos. Todo por variables de entorno.
// Si faltan los datos de IMAP, el lector arranca en modo "sin configurar":
// no intenta conectarse a ningún buzón (útil hasta tener las credenciales).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));

// Por defecto lee/escribe la MISMA base de datos local que el servidor.
const rutaDbDefecto = resolve(aqui, '..', '..', 'server', 'data', 'pos.db');

const imapHost = process.env.IMAP_HOST ?? '';
const imapUser = process.env.IMAP_USER ?? '';
const imapPass = process.env.IMAP_PASS ?? '';

export const config = {
  rutaDb: process.env.POS_DB ?? rutaDbDefecto,

  imap: {
    host: imapHost,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: (process.env.IMAP_SECURE ?? 'true') !== 'false',
    user: imapUser,
    pass: imapPass,
    buzon: process.env.IMAP_BUZON ?? 'INBOX'
  },

  // Filtra correos por remitente (el del banco). Vacío = no filtra.
  remitente: process.env.LECTOR_REMITENTE ?? '',

  // Cada cuánto revisa el buzón.
  intervaloMs: Number(process.env.LECTOR_INTERVALO_MS ?? 60_000),

  // Ventana (horas) para cruzar por monto cuando no hay referencia.
  ventanaHoras: Number(process.env.LECTOR_VENTANA_HORAS ?? 24),

  // Patrones para extraer del correo. Ajustables al formato del banco.
  patronMonto: process.env.LECTOR_PATRON_MONTO ?? '\\$\\s*([\\d.,]+)',
  patronReferencia:
    process.env.LECTOR_PATRON_REF ?? '(?:referencia|ref\\.?|cus)\\s*[:#]?\\s*([A-Za-z0-9-]{4,})'
} as const;

// ¿Hay datos suficientes para conectarse al buzón?
export const configurado = Boolean(imapHost && imapUser && imapPass);
