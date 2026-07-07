// Datos iniciales / catálogo real del negocio.
// Uso: npm run seed
// - 1 admin con PIN "1234" y 2 auxiliares (sin PIN, entran por nombre)
// - Catálogo real: ESPECIALIDADES y BEBIDAS (precios en COP, costo 0)
//
// IDEMPOTENTE por fila (por nombre): se puede correr sobre una base ya
// sembrada sin duplicar; inserta solo lo que falte. El catálogo demo anterior
// (hamburguesas/perros) se desactiva con borrado lógico si aún existe.
import { db } from './conexion.js';
import { migrar } from './migrador.js';
import { hashearPin } from '../lib/pin.js';

// Asegura que el esquema exista antes de insertar.
migrar();

interface ProductoSeed {
  categoria: string;
  nombre: string;
  precio: number;
  controla_stock: 0 | 1;
  stock: number;
  stock_minimo: number;
}

// Menú real del negocio. costo = 0 en todos: el admin lo completará.
const CATEGORIAS: { nombre: string; orden: number }[] = [
  { nombre: 'ESPECIALIDADES', orden: 1 },
  { nombre: 'BEBIDAS', orden: 2 }
];

const PRODUCTOS: ProductoSeed[] = [
  // ESPECIALIDADES (no controlan stock)
  { categoria: 'ESPECIALIDADES', nombre: 'Pasteles', precio: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Empanadas carne y pollo', precio: 2000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Papa carne y pollo', precio: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Papa mixta', precio: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Papa huevo entero', precio: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Arepa mixta', precio: 4000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Marranitas', precio: 4000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Flautas', precio: 4000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  { categoria: 'ESPECIALIDADES', nombre: 'Juan Valerios', precio: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
  // BEBIDAS (controlan stock). Stock inicial de arranque; el admin lo ajusta.
  { categoria: 'BEBIDAS', nombre: 'Gaseosa mini plástica', precio: 2000, controla_stock: 1, stock: 24, stock_minimo: 6 },
  { categoria: 'BEBIDAS', nombre: 'Gaseosa personal plástica', precio: 4000, controla_stock: 1, stock: 24, stock_minimo: 6 },
  { categoria: 'BEBIDAS', nombre: 'Gaseosa personal 350 ml', precio: 3000, controla_stock: 1, stock: 24, stock_minimo: 6 },
  { categoria: 'BEBIDAS', nombre: 'Gaseosa litro', precio: 5000, controla_stock: 1, stock: 12, stock_minimo: 3 },
  { categoria: 'BEBIDAS', nombre: 'Gaseosa 1.5 L', precio: 7000, controla_stock: 1, stock: 12, stock_minimo: 3 },
  { categoria: 'BEBIDAS', nombre: 'Gaseosa 2 L', precio: 12000, controla_stock: 1, stock: 12, stock_minimo: 3 },
  { categoria: 'BEBIDAS', nombre: 'Agua personal', precio: 3000, controla_stock: 1, stock: 24, stock_minimo: 6 }
];

// Categorías del catálogo demo anterior, a desactivar si existen.
const CATEGORIAS_DEMO = ['Hamburguesas', 'Perros y salchipapas', 'Bebidas'];

const sembrar = db.transaction(() => {
  // ── Usuarios (idempotente por nombre) ───────────────────────────────────
  const existeUsuario = db.prepare('SELECT 1 FROM usuarios WHERE nombre = ?');
  // Todos nacen con debe_cambiar_pin=1: el PIN sembrado es solo para el primer
  // acceso; en producción el primer login OBLIGA a definir un PIN real (admin
  // ≥ 6 dígitos, auxiliar 4). Así no queda ningún PIN de fábrica en internet.
  const insUsuario = db.prepare(
    'INSERT INTO usuarios (nombre, rol, pin_hash, debe_cambiar_pin) VALUES (?, ?, ?, 1)'
  );
  const usuarios: [string, 'admin' | 'auxiliar', string][] = [
    ['Administrador', 'admin', hashearPin('123456')],
    ['Carolina', 'auxiliar', hashearPin('1111')],
    ['Andrés', 'auxiliar', hashearPin('2222')]
  ];
  let nuevosUsuarios = 0;
  for (const [nombre, rol, pin] of usuarios) {
    if (!existeUsuario.get(nombre)) {
      insUsuario.run(nombre, rol, pin);
      nuevosUsuarios++;
    }
  }
  console.log(`Usuarios: ${nuevosUsuarios} nuevo(s). PIN inicial admin=123456, aux=1111/2222; TODOS deben cambiarlo al primer login.`);

  // ── Categorías reales (idempotente por nombre; reactiva si estaba oculta) ─
  const idCategoria = (nombre: string): number => {
    const fila = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre) as
      | { id: number }
      | undefined;
    if (fila) {
      db.prepare('UPDATE categorias SET activo = 1, orden = ? WHERE id = ?').run(
        CATEGORIAS.find((c) => c.nombre === nombre)!.orden,
        fila.id
      );
      return fila.id;
    }
    const orden = CATEGORIAS.find((c) => c.nombre === nombre)!.orden;
    const info = db
      .prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)')
      .run(nombre, orden);
    return Number(info.lastInsertRowid);
  };
  const idsCategoria = new Map(CATEGORIAS.map((c) => [c.nombre, idCategoria(c.nombre)]));

  // ── Productos reales (idempotente por nombre) ───────────────────────────
  const existeProducto = db.prepare('SELECT 1 FROM productos WHERE nombre = ?');
  const insProducto = db.prepare(`
    INSERT INTO productos
      (categoria_id, nombre, precio, costo, controla_stock, stock, stock_minimo)
    VALUES
      (@categoria_id, @nombre, @precio, 0, @controla_stock, @stock, @stock_minimo)
  `);
  let nuevosProductos = 0;
  for (const p of PRODUCTOS) {
    if (existeProducto.get(p.nombre)) continue;
    insProducto.run({
      categoria_id: idsCategoria.get(p.categoria)!,
      nombre: p.nombre,
      precio: p.precio,
      controla_stock: p.controla_stock,
      stock: p.stock,
      stock_minimo: p.stock_minimo
    });
    nuevosProductos++;
  }
  console.log(`Productos: ${nuevosProductos} nuevo(s) del catálogo real.`);

  // ── Desactivar catálogo demo anterior (borrado lógico) ──────────────────
  // Solo toca las categorías demo conocidas; nunca las reales.
  let desactivados = 0;
  for (const nombre of CATEGORIAS_DEMO) {
    if (CATEGORIAS.some((c) => c.nombre === nombre)) continue; // por si acaso
    const cat = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre) as
      | { id: number }
      | undefined;
    if (!cat) continue;
    const r1 = db.prepare('UPDATE productos SET activo = 0 WHERE categoria_id = ? AND activo = 1').run(cat.id);
    db.prepare('UPDATE categorias SET activo = 0 WHERE id = ?').run(cat.id);
    desactivados += r1.changes;
  }
  if (desactivados > 0) console.log(`Catálogo demo desactivado: ${desactivados} producto(s).`);
});

sembrar();
console.log('Seed completado.');
process.exit(0);
