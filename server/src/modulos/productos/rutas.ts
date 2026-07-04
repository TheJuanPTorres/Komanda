// Rutas de productos. Lectura del menú para tomar pedidos (cualquier sesión);
// administración del catálogo e imágenes solo para admin.
import type { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import type { MenuAgrupado, Producto } from '@pos/shared';
import { config } from '../../config.js';
import { errores } from '../../lib/errores.js';
import { requiereRol, requiereSesion } from '../auth/middleware.js';
import { emisor } from '../../ws/emisor.js';
import {
  actualizarImagenProducto,
  listarProductos,
  obtenerMenu,
  obtenerProducto
} from './servicio.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Tipos de imagen aceptados y tamaño máximo (5 MB).
const TIPOS_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function rutasProductos(app: FastifyInstance): Promise<void> {
  // GET /api/menu — categorías activas con sus productos activos.
  app.get('/api/menu', { preHandler: requiereSesion }, async () => {
    return { menu: obtenerMenu() satisfies MenuAgrupado };
  });

  // GET /api/productos — catálogo completo (admin).
  app.get('/api/productos', { preHandler: requiereRol('admin') }, async () => {
    return { productos: listarProductos() satisfies Producto[] };
  });

  // POST /api/productos/:id/imagen — subir/cambiar la foto (admin, multipart).
  app.post('/api/productos/:id/imagen', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const producto = obtenerProducto(id);
    if (!producto) throw errores.noEncontrado('Ese producto no existe.');

    const archivo = await req.file({ limits: { fileSize: MAX_BYTES } });
    if (!archivo) throw errores.imagenInvalida('No llegó ninguna imagen.');
    if (!TIPOS_OK.has(archivo.mimetype)) {
      throw errores.imagenInvalida('La imagen debe ser JPG, PNG o WEBP.');
    }

    let entrada: Buffer;
    try {
      entrada = await archivo.toBuffer();
    } catch {
      // Fastify lanza si se supera fileSize durante la lectura.
      throw errores.imagenInvalida('La imagen supera el tamaño máximo (5 MB).');
    }
    if (archivo.file.truncated) {
      throw errores.imagenInvalida('La imagen supera el tamaño máximo (5 MB).');
    }

    // Redimensiona a máx 800px de ancho (sin agrandar) y convierte a webp.
    mkdirSync(config.rutaImagenes, { recursive: true });
    const nombre = `${id}.webp`;
    const destino = join(config.rutaImagenes, nombre);
    try {
      await sharp(entrada)
        .rotate() // respeta la orientación EXIF
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(destino);
    } catch {
      throw errores.imagenInvalida('No se pudo procesar la imagen.');
    }

    // Ruta pública con parámetro de versión para saltar la caché del navegador.
    const ruta = `/imagenes/${nombre}?v=${Date.now()}`;
    actualizarImagenProducto(id, ruta);

    const actualizado = obtenerProducto(id)!;
    emisor.productoActualizado({ producto: actualizado });
    return { producto: actualizado };
  });

  // DELETE /api/productos/:id/imagen — quitar la foto (admin).
  app.delete('/api/productos/:id/imagen', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const producto = obtenerProducto(id);
    if (!producto) throw errores.noEncontrado('Ese producto no existe.');

    rmSync(join(config.rutaImagenes, `${id}.webp`), { force: true });
    actualizarImagenProducto(id, null);

    const actualizado = obtenerProducto(id)!;
    emisor.productoActualizado({ producto: actualizado });
    return { producto: actualizado };
  });
}
