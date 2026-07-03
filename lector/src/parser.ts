// Extrae monto y referencia del texto de un correo de pago, con patrones
// (regex) configurables para adaptarse al formato de cada banco.
import { config } from './config.js';

export interface Extraido {
  monto: number | null;
  referencia: string | null;
}

// Normaliza un monto colombiano a entero de pesos:
//   "24.000"     -> 24000
//   "$ 1.250.000"-> 1250000
//   "24.000,00"  -> 24000  (se corta en la coma de decimales; COP no usa centavos)
function normalizarMonto(texto: string): number | null {
  const sinDecimales = texto.split(',')[0] ?? '';
  const soloDigitos = sinDecimales.replace(/\D/g, '');
  if (!soloDigitos) return null;
  const n = parseInt(soloDigitos, 10);
  return Number.isNaN(n) ? null : n;
}

export function extraerPago(texto: string): Extraido {
  let monto: number | null = null;
  let referencia: string | null = null;

  try {
    const mMonto = new RegExp(config.patronMonto, 'i').exec(texto);
    if (mMonto?.[1]) monto = normalizarMonto(mMonto[1]);
  } catch {
    // Patrón inválido: se ignora y queda null.
  }

  try {
    const mRef = new RegExp(config.patronReferencia, 'i').exec(texto);
    if (mRef?.[1]) referencia = mRef[1].trim();
  } catch {
    // Igual que arriba.
  }

  return { monto, referencia };
}
