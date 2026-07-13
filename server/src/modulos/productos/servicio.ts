// Acceso a datos de categorías y productos para el menú y su administración.
import { db } from '../../db/conexion.js';
import type {
  Categoria,
  CategoriaConProductos,
  GuardarProductoReq,
  MenuAgrupado,
  Producto
} from '@pos/shared';
import { diaOperativo, rangoUtcDesdeFechas } from '../../lib/fechas.js';

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

// ── "Más pedidos" (v1.5-C, Parte 5.1) ──────────────────────────────────────
// Los 6 productos más vendidos (por unidades) de los últimos 14 días operativos,
// contando SOLO pedidos cobrados, y que sigan activos (para poder agregarse).
// El 80% de los pedidos repite los mismos productos: este atajo ahorra casi
// toda la navegación. Cálculo con caché simple de 1 hora (negocio chico).
const CACHE_MAS_PEDIDOS_MS = 60 * 60 * 1000;
const TOPE_MAS_PEDIDOS = 6;
let cacheMasPedidos: { productos: Producto[]; expira: number } | null = null;

function calcularMasPedidos(): Producto[] {
  const hoy = diaOperativo();
  // 14 días operativos incluyendo hoy ⇒ desde el día operativo de hace 13 días.
  const hace13 = diaOperativo(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000));
  const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas(hace13, hoy);

  const filas = db
    .prepare(
      `SELECT pi.producto_id AS id, SUM(pi.cantidad) AS unidades
         FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado = 'cobrado' AND p.cerrado_en >= ? AND p.cerrado_en < ?
        GROUP BY pi.producto_id
        ORDER BY unidades DESC, pi.producto_id`
    )
    .all(desdeUtc, hastaUtc) as Array<{ id: number; unidades: number }>;

  // Conserva el orden de más vendidos, quedándose solo con los que siguen
  // activos (un producto dado de baja no debe ofrecerse). Tope de 6.
  const productos: Producto[] = [];
  for (const f of filas) {
    const p = obtenerProductoActivo(f.id);
    if (p) productos.push(p);
    if (productos.length >= TOPE_MAS_PEDIDOS) break;
  }
  return productos;
}

/** Los productos más vendidos (últimos 14 días), con caché de 1 hora. */
export function masPedidos(): Producto[] {
  if (!cacheMasPedidos || cacheMasPedidos.expira < Date.now()) {
    cacheMasPedidos = { productos: calcularMasPedidos(), expira: Date.now() + CACHE_MAS_PEDIDOS_MS };
  }
  return cacheMasPedidos.productos;
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

// ── Categorías ─────────────────────────────────────────────────────────────

/** Categorías activas (para el formulario de producto). */
export function listarCategorias(): Categoria[] {
  const filas = db
    .prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre')
    .all() as FilaCategoria[];
  return filas.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden, activo: c.activo === 1 }));
}

function categoriaExiste(id: number): boolean {
  return db.prepare('SELECT 1 FROM categorias WHERE id = ? AND activo = 1').get(id) !== undefined;
}

// ── CRUD de productos (admin) ──────────────────────────────────────────────

/** Crea un producto y devuelve el registro creado. */
export function crearProducto(datos: GuardarProductoReq): Producto {
  const info = db
    .prepare(
      `INSERT INTO productos
         (categoria_id, nombre, precio, costo, controla_stock, stock, stock_minimo)
       VALUES (@categoria_id, @nombre, @precio, @costo, @controla_stock, @stock, @stock_minimo)`
    )
    .run({
      categoria_id: datos.categoria_id,
      nombre: datos.nombre,
      precio: datos.precio,
      costo: datos.costo,
      controla_stock: datos.controla_stock ? 1 : 0,
      stock: datos.stock,
      stock_minimo: datos.stock_minimo
    });
  return obtenerProducto(Number(info.lastInsertRowid))!;
}

/** Edita un producto existente (no toca la imagen). */
export function actualizarProducto(id: number, datos: GuardarProductoReq): Producto {
  db.prepare(
    `UPDATE productos SET
       categoria_id = @categoria_id, nombre = @nombre, precio = @precio, costo = @costo,
       controla_stock = @controla_stock, stock = @stock, stock_minimo = @stock_minimo,
       actualizado_en = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    categoria_id: datos.categoria_id,
    nombre: datos.nombre,
    precio: datos.precio,
    costo: datos.costo,
    controla_stock: datos.controla_stock ? 1 : 0,
    stock: datos.stock,
    stock_minimo: datos.stock_minimo
  });
  return obtenerProducto(id)!;
}

/** Desactiva un producto (borrado lógico: activo = 0). Devuelve el registro. */
export function desactivarProducto(id: number): Producto {
  db.prepare("UPDATE productos SET activo = 0, actualizado_en = datetime('now') WHERE id = ?").run(id);
  return obtenerProducto(id)!;
}

/** ¿Existe y está activa la categoría? (para validar en las rutas). */
export function categoriaActiva(id: number): boolean {
  return categoriaExiste(id);
}
