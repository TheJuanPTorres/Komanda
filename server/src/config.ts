// Configuración central del servidor, leída del entorno con valores por defecto
// pensados para desarrollo local. En producción, definir JWT_SECRET siempre.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));

// Raíz del paquete server/ (tanto en src/ con tsx como en dist/ compilado,
// este archivo vive un nivel por debajo de la raíz del paquete).
export const RAIZ_SERVER = resolve(aqui, '..');

export const config = {
  entorno: process.env.NODE_ENV ?? 'development',
  puerto: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',

  // Secreto para firmar los JWT de sesión. En producción es OBLIGATORIO
  // pasar uno propio; el default solo sirve para desarrollo.
  jwtSecret: process.env.JWT_SECRET ?? 'pos-local-secreto-desarrollo-cambiar',

  // Nombre de la cookie httpOnly que transporta el JWT.
  cookieSesion: 'pos_sesion',

  // Duración de la sesión.
  sesionHoras: 12,

  // Ruta del archivo SQLite. Respaldar = copiar este archivo.
  rutaDb: process.env.POS_DB ?? resolve(RAIZ_SERVER, 'data', 'pos.db'),

  // Carpeta con los estáticos del front (app/dist) para servir en producción.
  rutaAppDist: resolve(RAIZ_SERVER, '..', 'app', 'dist'),

  // HTTPS opcional: si existen ambos archivos, el servidor arranca en HTTPS.
  // Necesario para que la PWA (service worker) funcione en los celulares por
  // la red local; en localhost (la caja) no hace falta.
  httpsKey: process.env.HTTPS_KEY ?? resolve(RAIZ_SERVER, 'certs', 'key.pem'),
  httpsCert: process.env.HTTPS_CERT ?? resolve(RAIZ_SERVER, 'certs', 'cert.pem'),

  version: process.env.npm_package_version ?? '0.1.0'
} as const;

export const enProduccion = config.entorno === 'production';
