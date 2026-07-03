// Lectura del buzón por IMAP. Trae los correos no leídos (opcionalmente del
// remitente del banco), los entrega ya parseados y los marca como leídos.
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { config } from './config.js';
import type { Correo } from './conciliador.js';

// Revisa el buzón una vez. Llama `onCorreo` por cada correo no leído.
export async function revisarBuzon(onCorreo: (correo: Correo) => void): Promise<number> {
  const cliente = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.user, pass: config.imap.pass },
    logger: false
  });

  let procesados = 0;
  await cliente.connect();
  const lock = await cliente.getMailboxLock(config.imap.buzon);
  try {
    // Criterio: no leídos (y del remitente del banco, si se configuró).
    const criterio: Record<string, unknown> = { seen: false };
    if (config.remitente) criterio.from = config.remitente;

    for await (const mensaje of cliente.fetch(criterio, { source: true, uid: true })) {
      if (!mensaje.source) continue;
      const parsed: ParsedMail = await simpleParser(mensaje.source);
      const asunto = parsed.subject ?? '';
      const cuerpo = parsed.text ?? '';
      onCorreo({
        mensajeId: parsed.messageId ?? null,
        asunto,
        remitente: parsed.from?.text ?? '',
        fecha: parsed.date ?? null,
        // El monto/referencia pueden estar en el asunto o en el cuerpo.
        texto: `${asunto}\n${cuerpo}`
      });
      // Marca el correo como leído para no reprocesarlo.
      await cliente.messageFlagsAdd({ uid: String(mensaje.uid) }, ['\\Seen'], { uid: true });
      procesados++;
    }
  } finally {
    lock.release();
    await cliente.logout();
  }
  return procesados;
}
