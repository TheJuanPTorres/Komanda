// Configuración central del servidor, leída del entorno y validada con zod.
//
// SUPUESTO DE ESTA FASE: producción es un VPS público (Vultr) detrás de Caddy
// (que termina TLS). Internet hostil. En producción, si falta una variable
// obligatoria el proceso FALLA EN FRÍO con un mensaje claro (no arranca inseguro).
// En desarrollo hay defaults cómodos para trabajar en local.
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const aqui = dirname(fileURLToPath(import.meta.url));

// Raíz del paquete server/ (tanto en src/ con tsx como en dist/ compilado,
// este archivo vive un nivel por debajo de la raíz del paquete).
export const RAIZ_SERVER = resolve(aqui, '..');

const esProduccion = process.env.NODE_ENV === 'production';

// Defaults SOLO para desarrollo: en producción estas variables son obligatorias.
const DEV = {
  cookieSecret: 'desarrollo-secreto-de-cookies-min-32-chars-xx',
  origenPermitido: 'http://localhost:5173'
};

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Secreto para firmar el JWT de sesión (viaja en cookie httpOnly). ≥ 32 chars.
  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET debe tener al menos 32 caracteres.')
    .default(DEV.cookieSecret),

  // Origen público permitido (CORS + Socket.IO). Ej: https://pos.midominio.com
  ORIGEN_PERMITIDO: z
    .string()
    .url('ORIGEN_PERMITIDO debe ser una URL http(s) válida.')
    .default(DEV.origenPermitido),

  // Carpeta de datos persistentes (base + imágenes + …).
  RUTA_DATOS: z.string().default(resolve(RAIZ_SERVER, 'data')),

  // Zona horaria del NEGOCIO (no la del servidor). Fronteras de "día operativo".
  TZ_NEGOCIO: z.string().default('America/Bogota')
});

// En producción no se aceptan los defaults de secretos: deben venir del entorno.
function exigirEnProduccion(env: NodeJS.ProcessEnv): void {
  if (!esProduccion) return;
  const faltantes: string[] = [];
  if (!env.COOKIE_SECRET) faltantes.push('COOKIE_SECRET');
  if (!env.ORIGEN_PERMITIDO) faltantes.push('ORIGEN_PERMITIDO');
  if (faltantes.length > 0) {
    console.error(
      `\n[CONFIG] Faltan variables obligatorias en producción: ${faltantes.join(', ')}.\n` +
        `Definilas en el entorno (ver .env.example) antes de arrancar. El proceso no continuará.\n`
    );
    process.exit(1);
  }
}

function cargar() {
  exigirEnProduccion(process.env);
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`\n[CONFIG] Variables de entorno inválidas:\n${detalle}\n`);
    process.exit(1);
  }
  return r.data;
}

const env = cargar();

const rutaDatos = isAbsolute(env.RUTA_DATOS) ? env.RUTA_DATOS : resolve(RAIZ_SERVER, env.RUTA_DATOS);

export const config = {
  entorno: env.NODE_ENV,
  puerto: env.PORT,
  host: env.HOST,

  cookieSecret: env.COOKIE_SECRET,
  origenPermitido: env.ORIGEN_PERMITIDO,
  tzNegocio: env.TZ_NEGOCIO,

  // Nombre de la cookie httpOnly que transporta el JWT.
  cookieSesion: 'pos_sesion',
  // Duración de la sesión.
  sesionHoras: 12,

  // Carpeta de datos y sus rutas derivadas. POS_DB permite apuntar la base a
  // otro archivo (útil en pruebas/seed); si no, vive dentro de RUTA_DATOS.
  rutaDatos,
  rutaDb: process.env.POS_DB ?? join(rutaDatos, 'pos.db'),
  rutaImagenes: join(rutaDatos, 'imagenes'),

  // Estáticos del front (app/dist) para servir en producción.
  rutaAppDist: resolve(RAIZ_SERVER, '..', 'app', 'dist'),

  version: process.env.npm_package_version ?? '0.1.0'
} as const;

export const enProduccion = config.entorno === 'production';
