// Genera los íconos de la PWA sin dependencias externas: dibuja un cubierto
// (tenedor + cuchillo) blanco sobre el color de marca y codifica PNG a mano.
// Uso: node scripts/generar-iconos.mjs   (ya deja los .png en public/icons/)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, '../public/icons');
mkdirSync(destino, { recursive: true });

const ACENTO = [232, 72, 28, 255]; // #e8481c (tomate de marca)
const BLANCO = [255, 255, 255, 255];

// ── Lienzo RGBA sencillo ────────────────────────────────────────────────
function crearLienzo(tam, fondo) {
  const datos = new Uint8Array(tam * tam * 4);
  for (let i = 0; i < tam * tam; i++) datos.set(fondo, i * 4);
  return datos;
}

function pintar(datos, tam, x, y, color) {
  if (x < 0 || y < 0 || x >= tam || y >= tam) return;
  datos.set(color, (y * tam + x) * 4);
}

// Rectángulo con esquinas redondeadas (radio r), relleno de un color.
function rectRedondeado(datos, tam, x0, y0, w, h, r, color) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      // Distancia a las esquinas para redondear.
      const dx = x < x0 + r ? x0 + r - x : x > x1 - r ? x - (x1 - r) : 0;
      const dy = y < y0 + r ? y0 + r - y : y > y1 - r ? y - (y1 - r) : 0;
      if (dx * dx + dy * dy <= r * r) pintar(datos, tam, x, y, color);
    }
  }
}

// Dibuja el cubierto centrado, en proporciones relativas al tamaño.
function dibujarCubierto(datos, tam) {
  const u = tam; // unidad = tamaño total
  const anchoDiente = 0.035 * u;
  const rDiente = anchoDiente / 2;

  // Tenedor (izquierda): 3 dientes + mango.
  const cxTenedor = 0.4 * u;
  const dientesY0 = 0.26 * u;
  const dientesAlto = 0.17 * u;
  for (const off of [-0.06, 0, 0.06]) {
    rectRedondeado(
      datos,
      tam,
      cxTenedor + off * u - anchoDiente / 2,
      dientesY0,
      anchoDiente,
      dientesAlto,
      rDiente,
      BLANCO
    );
  }
  // Base que une los dientes.
  rectRedondeado(datos, tam, cxTenedor - 0.08 * u, 0.4 * u, 0.16 * u, 0.055 * u, 0.02 * u, BLANCO);
  // Mango del tenedor.
  rectRedondeado(datos, tam, cxTenedor - 0.028 * u, 0.44 * u, 0.056 * u, 0.3 * u, 0.028 * u, BLANCO);

  // Cuchillo (derecha): hoja + mango en una sola barra redondeada.
  const cxCuchillo = 0.6 * u;
  rectRedondeado(datos, tam, cxCuchillo - 0.03 * u, 0.26 * u, 0.06 * u, 0.48 * u, 0.03 * u, BLANCO);
}

// ── Codificación PNG (RGBA de 8 bits) ───────────────────────────────────
const tablaCrc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = tablaCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);
  return Buffer.concat([largo, tipoBuf, datos, crcBuf]);
}

function codificarPng(datos, tam) {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // color RGBA
  // Scanlines con byte de filtro 0 al inicio de cada fila.
  const crudo = Buffer.alloc((tam * 4 + 1) * tam);
  for (let y = 0; y < tam; y++) {
    crudo[y * (tam * 4 + 1)] = 0;
    for (let x = 0; x < tam * 4; x++) {
      crudo[y * (tam * 4 + 1) + 1 + x] = datos[y * tam * 4 + x];
    }
  }
  const idat = deflateSync(crudo, { level: 9 });
  return Buffer.concat([
    firma,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function generar(nombre, tam) {
  const datos = crearLienzo(tam, ACENTO);
  dibujarCubierto(datos, tam);
  writeFileSync(resolve(destino, nombre), codificarPng(datos, tam));
  console.log(`  ${nombre} (${tam}x${tam})`);
}

console.log('Generando íconos en public/icons/:');
generar('favicon-32.png', 32);
generar('apple-touch-icon.png', 180);
generar('icon-192.png', 192);
generar('icon-512.png', 512);
generar('maskable-512.png', 512);
console.log('Listo.');
