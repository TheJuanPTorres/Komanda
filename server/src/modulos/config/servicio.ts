// Configuración del negocio (clave/valor). Ajustes del admin. Por ahora solo el
// número de WhatsApp para compartir el resumen de cierre.
import { db } from '../../db/conexion.js';
import type { ConfigNegocio } from '@pos/shared';

const CLAVE_WHATSAPP = 'whatsapp_cierre';

function leer(clave: string): string | null {
  const fila = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave) as
    | { valor: string }
    | undefined;
  return fila?.valor ?? null;
}

function guardar(clave: string, valor: string | null): void {
  if (valor === null) {
    db.prepare('DELETE FROM configuracion WHERE clave = ?').run(clave);
    return;
  }
  db.prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`
  ).run(clave, valor);
}

export function obtenerConfig(): ConfigNegocio {
  return { whatsapp_cierre: leer(CLAVE_WHATSAPP) };
}

/** Guarda el número de WhatsApp (ya normalizado a dígitos) o lo borra si es null. */
export function guardarWhatsappCierre(numero: string | null): ConfigNegocio {
  guardar(CLAVE_WHATSAPP, numero);
  return obtenerConfig();
}

export function whatsappCierre(): string | null {
  return leer(CLAVE_WHATSAPP);
}
