// Aumenta los tipos de Fastify y @fastify/jwt para que la sesión del usuario
// (payload del JWT) quede tipada en request.user y en el sign/verify.
import type { Sesion } from '@pos/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Sesion; // lo que firmamos
    user: Sesion; // lo que aparece en request.user tras verificar
  }
}
