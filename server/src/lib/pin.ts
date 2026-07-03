// Hash y verificación del PIN de administrador con bcrypt.
// El PIN nunca se guarda en claro: solo su hash (columna pin_hash).
import bcrypt from 'bcryptjs';

const RONDAS = 10;

export function hashearPin(pin: string): string {
  return bcrypt.hashSync(pin, RONDAS);
}

export function verificarPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}
