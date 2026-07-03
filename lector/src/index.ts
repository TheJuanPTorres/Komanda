// Lector de pagos (proceso aparte). Revisa el buzón cada cierto tiempo,
// concilia los correos con los pagos QR y escribe en la misma base local.
// Si no hay credenciales IMAP, arranca en modo "sin configurar" y no hace
// nada (así no molesta hasta que se configure el buzón).
import { config, configurado } from './config.js';
import { procesarCorreo, type ResultadoConciliacion } from './conciliador.js';
import { revisarBuzon } from './imap.js';

function log(mensaje: string): void {
  console.log(`[lector ${new Date().toISOString()}] ${mensaje}`);
}

let ejecutando = false;

async function unCiclo(): Promise<void> {
  if (ejecutando) return; // evita solaparse si un ciclo tarda más que el intervalo
  ejecutando = true;
  try {
    const conteo: Record<ResultadoConciliacion, number> = {
      conciliado: 0,
      sin_pago: 0,
      duplicado: 0
    };
    const total = await revisarBuzon((correo) => {
      conteo[procesarCorreo(correo)]++;
    });
    if (total > 0) {
      log(
        `Revisado: ${total} correo(s) — conciliados ${conteo.conciliado}, ` +
          `sin pago ${conteo.sin_pago}, duplicados ${conteo.duplicado}.`
      );
    }
  } catch (err) {
    log(`Error al revisar el buzón: ${(err as Error).message}`);
  } finally {
    ejecutando = false;
  }
}

function main(): void {
  if (!configurado) {
    log('Sin configurar: faltan IMAP_HOST / IMAP_USER / IMAP_PASS. No se revisará ningún buzón.');
    // Mantiene el proceso vivo (para PM2) sin hacer polling.
    setInterval(() => {}, 1 << 30);
    return;
  }

  log(`Iniciado. Revisando ${config.imap.user} cada ${Math.round(config.intervaloMs / 1000)}s.`);
  void unCiclo();
  setInterval(() => void unCiclo(), config.intervaloMs);
}

main();
