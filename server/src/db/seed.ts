// Datos iniciales para desarrollo/arranque del negocio.
// Uso: npm run seed
// - 1 admin con PIN "1234"
// - 2 meseros de ejemplo (sin PIN, entran por selección de nombre)
// - 3 categorías y 8 productos de comida rápida colombiana (precios en COP)
//
// Idempotente por tabla: si una tabla ya tiene datos, no la vuelve a sembrar.
import { db } from './conexion.js';
import { migrar } from './migrador.js';
import { hashearPin } from '../lib/pin.js';

// Asegura que el esquema exista antes de insertar.
migrar();

function tablaVacia(tabla: string): boolean {
  const fila = db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get() as {
    n: number;
  };
  return fila.n === 0;
}

const sembrar = db.transaction(() => {
  // ── Usuarios ────────────────────────────────────────────────────────────
  if (tablaVacia('usuarios')) {
    const insUsuario = db.prepare(
      'INSERT INTO usuarios (nombre, rol, pin_hash) VALUES (?, ?, ?)'
    );
    insUsuario.run('Administrador', 'admin', hashearPin('1234'));
    insUsuario.run('Carolina', 'mesero', null);
    insUsuario.run('Andrés', 'mesero', null);
    console.log('Usuarios sembrados (admin PIN=1234, 2 meseros).');
  } else {
    console.log('usuarios ya tenía datos: no se toca.');
  }

  // ── Categorías ──────────────────────────────────────────────────────────
  if (tablaVacia('categorias')) {
    const insCategoria = db.prepare(
      'INSERT INTO categorias (nombre, orden) VALUES (?, ?)'
    );
    insCategoria.run('Hamburguesas', 1);
    insCategoria.run('Perros y salchipapas', 2);
    insCategoria.run('Bebidas', 3);
    console.log('Categorías sembradas (3).');
  } else {
    console.log('categorias ya tenía datos: no se toca.');
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  if (tablaVacia('productos')) {
    const idCategoria = (nombre: string): number => {
      const fila = db
        .prepare('SELECT id FROM categorias WHERE nombre = ?')
        .get(nombre) as { id: number } | undefined;
      if (!fila) throw new Error(`Falta la categoría "${nombre}" para el seed.`);
      return fila.id;
    };

    const hamburguesas = idCategoria('Hamburguesas');
    const perros = idCategoria('Perros y salchipapas');
    const bebidas = idCategoria('Bebidas');

    const insProducto = db.prepare(`
      INSERT INTO productos
        (categoria_id, nombre, precio, costo, controla_stock, stock, stock_minimo)
      VALUES
        (@categoria_id, @nombre, @precio, @costo, @controla_stock, @stock, @stock_minimo)
    `);

    // Precios y costos realistas en pesos colombianos (enteros, sin decimales).
    const productos = [
      { categoria_id: hamburguesas, nombre: 'Hamburguesa sencilla', precio: 12000, costo: 5000, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: hamburguesas, nombre: 'Hamburguesa doble carne', precio: 17000, costo: 7500, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: hamburguesas, nombre: 'Hamburguesa con pollo', precio: 15000, costo: 6500, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: perros, nombre: 'Perro caliente', precio: 8000, costo: 3000, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: perros, nombre: 'Perro especial', precio: 11000, costo: 4500, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: perros, nombre: 'Salchipapa mixta', precio: 18000, costo: 7000, controla_stock: 0, stock: 0, stock_minimo: 0 },
      { categoria_id: bebidas, nombre: 'Gaseosa personal 400 ml', precio: 4000, costo: 1800, controla_stock: 1, stock: 48, stock_minimo: 12 },
      { categoria_id: bebidas, nombre: 'Jugo natural en agua', precio: 5000, costo: 2000, controla_stock: 0, stock: 0, stock_minimo: 0 }
    ];

    for (const p of productos) insProducto.run(p);
    console.log(`Productos sembrados (${productos.length}).`);
  } else {
    console.log('productos ya tenía datos: no se toca.');
  }
});

sembrar();
console.log('Seed completado.');
process.exit(0);
