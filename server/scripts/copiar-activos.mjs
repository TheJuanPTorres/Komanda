// Copia los activos que tsc no incluye en el build (los .sql de migraciones)
// desde src/ a dist/, conservando la estructura de carpetas.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const origen = resolve(aqui, '../src/db/migraciones');
const destino = resolve(aqui, '../dist/db/migraciones');

if (!existsSync(origen)) {
  console.error(`No se encontró la carpeta de migraciones: ${origen}`);
  process.exit(1);
}

// Limpia el destino antes de copiar: si en src se renombró o borró una
// migración, no debe quedar una copia huérfana en dist que el server intente
// aplicar (eso rompería el arranque).
rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, { recursive: true });
console.log(`Migraciones copiadas a ${destino}`);
