// Cliente HTTP hacia la API. Entiende la forma de error del servidor
// { error: { codigo, mensaje } } y la convierte en una excepción con el
// mensaje listo para mostrarle a una persona.
import type { ErrorResp } from '@pos/shared';

export class ErrorApi extends Error {
  readonly codigo: string;
  readonly estado: number;
  constructor(codigo: string, mensaje: string, estado: number) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.estado = estado;
  }
}

async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const resp = await fetch(url, {
    credentials: 'same-origin',
    headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opciones
  });

  // 204 o cuerpo vacío.
  const texto = await resp.text();
  const cuerpo = texto ? JSON.parse(texto) : null;

  if (!resp.ok) {
    const err = (cuerpo as ErrorResp | null)?.error;
    throw new ErrorApi(
      err?.codigo ?? 'ERROR',
      err?.mensaje ?? 'No se pudo completar la acción.',
      resp.status
    );
  }
  return cuerpo as T;
}

export const api = {
  get: <T>(url: string) => pedir<T>(url),
  post: <T>(url: string, datos?: unknown) =>
    pedir<T>(url, { method: 'POST', body: datos === undefined ? undefined : JSON.stringify(datos) }),
  patch: <T>(url: string, datos?: unknown) =>
    pedir<T>(url, { method: 'PATCH', body: datos === undefined ? undefined : JSON.stringify(datos) }),
  put: <T>(url: string, datos?: unknown) =>
    pedir<T>(url, { method: 'PUT', body: datos === undefined ? undefined : JSON.stringify(datos) }),
  delete: <T>(url: string) => pedir<T>(url, { method: 'DELETE' })
};
