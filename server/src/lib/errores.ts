// Manejo uniforme de errores. Todas las respuestas de error del servidor
// tienen la forma { error: { codigo, mensaje } } y los mensajes están
// escritos para humanos no técnicos (los verá el cajero/auxiliar).
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ErrorResp } from '@pos/shared';

/**
 * Error de negocio con código estable y estado HTTP. Lanzar esto desde
 * cualquier ruta/servicio; el manejador global le da la forma correcta.
 */
export class ErrorApp extends Error {
  readonly estado: number;
  readonly codigo: string;

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.codigo = codigo;
  }
}

export const errores = {
  noAutenticado: () =>
    new ErrorApp(401, 'NO_AUTENTICADO', 'Debes iniciar sesión para continuar.'),
  sinPermiso: () =>
    new ErrorApp(403, 'SIN_PERMISO', 'No tienes permiso para hacer esta acción.'),
  pinIncorrecto: () =>
    new ErrorApp(401, 'PIN_INCORRECTO', 'El PIN no es correcto.'),
  usuarioInvalido: () =>
    new ErrorApp(400, 'USUARIO_INVALIDO', 'El usuario seleccionado no es válido.'),
  noEncontrado: (mensaje = 'No se encontró lo que buscabas.') =>
    new ErrorApp(404, 'NO_ENCONTRADO', mensaje),
  pedidoNoEncontrado: () =>
    new ErrorApp(404, 'PEDIDO_NO_ENCONTRADO', 'Ese pedido ya no existe.'),
  pedidoNoAbierto: () =>
    new ErrorApp(409, 'PEDIDO_NO_ABIERTO', 'Ese pedido ya no está abierto.'),
  pedidoNoEditable: () =>
    new ErrorApp(403, 'PEDIDO_NO_EDITABLE', 'Este pedido ya se cobró o canceló; no se puede corregir.'),
  itemNoEncontrado: () =>
    new ErrorApp(404, 'ITEM_NO_ENCONTRADO', 'Ese producto ya no está en el pedido.'),
  productoNoDisponible: () =>
    new ErrorApp(400, 'PRODUCTO_NO_DISPONIBLE', 'Ese producto ya no está disponible.'),
  cobroVacio: () =>
    new ErrorApp(400, 'COBRO_VACIO', 'No se puede cobrar un pedido sin productos.'),
  montoNoCuadra: () =>
    new ErrorApp(400, 'MONTO_NO_CUADRA', 'La suma de los pagos no coincide con el total del pedido.'),
  cajaYaCerrada: () =>
    new ErrorApp(409, 'CAJA_YA_CERRADA', 'La caja de hoy ya fue cerrada.'),
  imagenInvalida: (mensaje = 'La imagen no es válida.') =>
    new ErrorApp(400, 'IMAGEN_INVALIDA', mensaje),
  nombreEnUso: () =>
    new ErrorApp(409, 'NOMBRE_EN_USO', 'Ya hay alguien con ese nombre. Usa uno diferente.'),
  demasiadosIntentos: () =>
    new ErrorApp(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'),
  pinCorto: (min: number) =>
    new ErrorApp(400, 'PIN_CORTO', `El PIN debe tener al menos ${min} dígitos.`),
  auxiliarSinPin: () =>
    new ErrorApp(403, 'AUXILIAR_SIN_PIN', 'Aún no tienes PIN. Pídele al administrador que te asigne uno.'),
  solicitudDuplicada: () =>
    new ErrorApp(409, 'SOLICITUD_DUPLICADA', 'Ya hay una corrección pendiente para ese producto.'),
  correccionInvalida: (mensaje = 'La corrección solicitada no es válida.') =>
    new ErrorApp(400, 'CORRECCION_INVALIDA', mensaje),
  solicitudNoPendiente: () =>
    new ErrorApp(409, 'SOLICITUD_NO_PENDIENTE', 'Esa solicitud ya fue resuelta.'),
  cobroConPendientes: () =>
    new ErrorApp(
      409,
      'COBRO_CON_PENDIENTES',
      'Hay correcciones pendientes en este pedido. Resuélvelas antes de cobrar.'
    )
};

export function responderError(
  reply: FastifyReply,
  estado: number,
  codigo: string,
  mensaje: string
): void {
  const cuerpo: ErrorResp = { error: { codigo, mensaje } };
  void reply.status(estado).send(cuerpo);
}

// Alias interno corto usado en este módulo.
const responder = responderError;

/**
 * Manejador global de errores de Fastify. Traduce ErrorApp, errores de
 * validación de zod y fallos inesperados a la forma estándar.
 */
export function registrarManejadorErrores(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ErrorApp) {
      responder(reply, error.estado, error.codigo, error.message);
      return;
    }

    if (error instanceof ZodError) {
      const primero = error.issues[0];
      const mensaje = primero ? primero.message : 'Datos inválidos.';
      responder(reply, 400, 'DATOS_INVALIDOS', mensaje);
      return;
    }

    // Errores del propio Fastify (p. ej. body JSON malformado) traen statusCode.
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      responder(reply, error.statusCode, 'SOLICITUD_INVALIDA', 'La solicitud no es válida.');
      return;
    }

    // Cualquier otra cosa es un fallo nuestro: log completo, mensaje genérico.
    app.log.error(error);
    responder(reply, 500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intenta de nuevo.');
  });
}
