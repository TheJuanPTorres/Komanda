// Prueba offline del núcleo del lector: parser + conciliador contra la base
// real, SIN conectarse a ningún buzón. Uso: npm run lector:probar
//
// Requiere que el servidor ya haya aplicado las migraciones (tabla
// notificaciones_pago) y que existan pagos QR en la base (del uso normal).
import { db } from './db.js';
import { extraerPago } from './parser.js';
import { procesarCorreo, type Correo } from './conciliador.js';

// Correos de ejemplo con formato tipo Bre-B.
const ejemplos: Correo[] = [
  {
    mensajeId: '<demo-conciliable@banco>',
    asunto: 'Recibiste un pago por Bre-B',
    remitente: 'notificaciones@banco.com',
    fecha: new Date(),
    texto: 'Recibiste un pago por $24.000 a través de Bre-B. Referencia: ABC123. ¡Gracias!'
  },
  {
    mensajeId: '<demo-sin-pago@banco>',
    asunto: 'Pago recibido',
    remitente: 'notificaciones@banco.com',
    fecha: new Date(),
    texto: 'Te llegó un pago por $50.000. Referencia: XYZ999.'
  }
];

console.log('== Extracción (parser) ==');
for (const e of ejemplos) {
  console.log(` "${e.texto.slice(0, 40)}..." ->`, extraerPago(e.texto));
}

console.log('\n== Conciliación ==');
for (const e of ejemplos) {
  console.log(` ${e.mensajeId} -> ${procesarCorreo(e)}`);
}
// Reprocesar el primero debe ser idempotente.
console.log(` ${ejemplos[0]!.mensajeId} (otra vez) -> ${procesarCorreo(ejemplos[0]!)}`);

console.log('\n== notificaciones_pago en la base ==');
const filas = db
  .prepare(
    'SELECT id, monto, referencia, pago_id, estado FROM notificaciones_pago ORDER BY id DESC LIMIT 5'
  )
  .all();
console.table(filas);

process.exit(0);
