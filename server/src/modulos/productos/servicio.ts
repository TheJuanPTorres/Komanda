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
