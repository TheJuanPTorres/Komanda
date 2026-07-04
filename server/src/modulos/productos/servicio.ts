// Acceso a datos de categorías y productos para el menú.
import { db } from '../../db/conexion.js';
import type { CategoriaConProductos, MenuAgrupado, Producto } from '@pos/shared';

interface FilaCategoria {
  id: number;
  nombre: string;
  orden: number;
  activo: number;
}

interface FilaProducto {
  id: number;
  categoria_id: number | null;
  nombre: string;
  precio: number;
  costo: number;
  controla_stock: number;
  stock: number;
  stock_minimo: number;
  activo: number;
  imagen: string | null;
  creado_en: string;
  actualizado_en: string;
}

function aProducto(f: FilaProducto): Producto {
  return {
    id: f.id,
    categoria_id: f.categoria_id,
    nombre: f.nombre,
    precio: f.precio,
    costo: f.costo,
    controla_stock: f.controla_stock === 1,
    stock: f.stock,
    stock_minimo: f.stock_minimo,
    activo: f.activo === 1,
    imagen: f.imagen,
    creado_en: f.creado_en,
    actualizado_en: f.actualizado_en
  };
}

/**
 * Devuelve el menú: categorías activas (en orden) cada una con sus productos
 * activos. Es lo que consume la pantalla de tomar pedido.
 */
export function obtenerMenu(): MenuAgrupado {
  const categorias = db
    .prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre')
    .all() as FilaCategoria[];

  const productosPorCategoria = db.prepare(
    'SELECT * FROM productos WHERE activo = 1 AND categoria_id = ? ORDER BY nombre'
  );

  return categorias.map((c): CategoriaConProductos => {
    const productos = (productosPorCategoria.all(c.id) as FilaProducto[]).map(aProducto);
    return { id: c.id, nombre: c.nombre, orden: c.orden, activo: c.activo === 1, productos };
  });
}

/** Busca un producto activo por id (para tomar el snapshot al agregar item). */
export function obtenerProductoActivo(id: number): Producto | undefined {
  const fila = db
    .prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
    .get(id) as FilaProducto | undefined;
  return fila ? aProducto(fila) : undefined;
}

/** Un producto por id sin importar si está activo (para el admin). */
export function obtenerProducto(id: number): Producto | undefined {
  const fila = db.prepare('SELECT * FROM productos WHERE id = ?').get(id) as
    | FilaProducto
    | undefined;
  return fila ? aProducto(fila) : undefined;
}

/** Todos los productos activos (para la administración del catálogo). */
export function listarProductos(): Producto[] {
  const filas = db
    .prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY categoria_id, nombre')
    .all() as FilaProducto[];
  return filas.map(aProducto);
}

/** Actualiza la ruta de la imagen del producto (o la borra con null). */
export function actualizarImagenProducto(id: number, imagen: string | null): void {
  db.prepare(
    "UPDATE productos SET imagen = ?, actualizado_en = datetime('now') WHERE id = ?"
  ).run(imagen, id);
}
