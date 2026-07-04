// Punto de entrada del servidor.
// Fastify (API REST) + Socket.IO (tiempo real) sobre el mismo servidor HTTP.
// Escucha en 0.0.0.0 para ser accesible desde los celulares en la red local.
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SaludResp } from '@pos/shared';
import { config, enProduccion } from './config.js';
import { migrar } from './db/migrador.js';
import { registrarManejadorErrores, responderError } from './lib/errores.js';
import { rutasAuth } from './modulos/auth/rutas.js';
import { rutasUsuarios } from './modulos/auth/rutas-usuarios.js';
import { rutasProductos } from './modulos/productos/rutas.js';
import { rutasPedidos } from './modulos/pedidos/rutas.js';
import { rutasCobros } from './modulos/cobros/rutas.js';
import { rutasGastos } from './modulos/gastos/rutas.js';
import { rutasCierreCaja } from './modulos/cierre-caja/rutas.js';
import { rutasReportes } from './modulos/reportes/rutas.js';
import { iniciarWebsockets } from './ws/servidor.js';

// HTTPS solo si están ambos archivos de certificado (ver config).
const usarHttps = existsSync(config.httpsKey) && existsSync(config.httpsCert);

async function construirServidor() {
  const app = Fastify({
    logger: {
      transport: enProduccion
        ? undefined
        : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    },
    ...(usarHttps
      ? { https: { key: readFileSync(config.httpsKey), cert: readFileSync(config.httpsCert) } }
      : {})
  });

  // Plugins base.
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    // El JWT viaja en la cookie httpOnly; jwtVerify() la lee de aquí.
    cookie: { cookieName: config.cookieSesion, signed: false }
  });
  // Subida de imágenes de producto (máx 5 MB por archivo).
  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  registrarManejadorErrores(app);

  // Sirve las imágenes de producto en /imagenes (carpeta local, sin CDN).
  // decorateReply:false porque el estático del front (más abajo) ya aporta
  // reply.sendFile; no puede declararse dos veces.
  mkdirSync(config.rutaImagenes, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.rutaImagenes,
    prefix: '/imagenes/',
    decorateReply: false
  });

  // ── Rutas de infraestructura ──────────────────────────────────────────
  const arrancado = Date.now();
  app.get('/api/salud', async (): Promise<SaludResp> => {
    return { ok: true, version: config.version, uptime: (Date.now() - arrancado) / 1000 };
  });

  // ── Rutas de negocio ─────────────────────────────────────────────────
  await app.register(rutasAuth);
  await app.register(rutasUsuarios);
  await app.register(rutasProductos);
  await app.register(rutasPedidos);
  await app.register(rutasCobros);
  await app.register(rutasGastos);
  await app.register(rutasCierreCaja);
  await app.register(rutasReportes);

  // ── Estáticos del front (solo si app/dist existe) + fallback SPA ──────
  const hayFront = existsSync(join(config.rutaAppDist, 'index.html'));
  if (hayFront) {
    await app.register(fastifyStatic, { root: config.rutaAppDist, prefix: '/' });
  }

  // Handler de "no encontrado": para GET de páginas (no /api ni /socket.io)
  // devuelve index.html y deja que el router del front resuelva (SPA).
  app.setNotFoundHandler((req, reply) => {
    const esApi = req.url.startsWith('/api') || req.url.startsWith('/socket.io');
    if (hayFront && req.method === 'GET' && !esApi) {
      return reply.sendFile('index.html');
    }
    return responderError(reply, 404, 'RUTA_NO_ENCONTRADA', 'La dirección solicitada no existe.');
  });

  return app;
}

async function main(): Promise<void> {
  // Aplica migraciones pendientes al arrancar (crea la DB si no existe).
  migrar();

  const app = await construirServidor();

  // Socket.IO necesita el servidor HTTP ya creado: ready() lo garantiza.
  await app.ready();
  iniciarWebsockets(app);

  try {
    await app.listen({ port: config.puerto, host: config.host });
    const protocolo = usarHttps ? 'https' : 'http';
    app.log.info(`POS escuchando en ${protocolo}://${config.host}:${config.puerto}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
