// Modal de cobro (solo lo abre el admin). Permite cobrar en efectivo (con
// cálculo de vuelto), QR Bre-B (con referencia opcional) o mixto. La suma
// enviada siempre es exactamente el total; el servidor lo vuelve a validar.
import { useState } from 'react';
import type { PagoReq } from '@pos/shared';
import { useStore } from '../../estado/store.js';
import { ErrorApi } from '../../lib/api.js';
import { pesos } from '../../lib/dinero.js';
import { Boton, Campo, Tarjeta } from '../../design-system/primitivas/index.js';
import './cobro.css';

type Metodo = 'efectivo' | 'qr_breb' | 'mixto';

interface Props {
  pedidoId: number;
  total: number;
  onCerrar: () => void;
  onCobrado: () => void;
}

function aEntero(texto: string): number {
  const n = parseInt(texto.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function CobroModal({ pedidoId, total, onCerrar, onCobrado }: Props) {
  const cobrar = useStore((s) => s.cobrar);

  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [recibido, setRecibido] = useState(0); // efectivo recibido (para vuelto)
  const [efectivoMixto, setEfectivoMixto] = useState(0); // parte en efectivo del mixto
  const [referencia, setReferencia] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const vuelto = recibido - total;
  const qrMixto = total - efectivoMixto;

  const puedeConfirmar =
    metodo === 'efectivo'
      ? recibido >= total
      : metodo === 'qr_breb'
        ? true
        : efectivoMixto > 0 && efectivoMixto < total;

  function construirPagos(): PagoReq[] {
    const ref = referencia.trim() || undefined;
    if (metodo === 'efectivo') return [{ metodo: 'efectivo', monto: total }];
    if (metodo === 'qr_breb') return [{ metodo: 'qr_breb', monto: total, referencia_externa: ref }];
    return [
      { metodo: 'efectivo', monto: efectivoMixto },
      { metodo: 'qr_breb', monto: qrMixto, referencia_externa: ref }
    ];
  }

  async function confirmar() {
    if (!puedeConfirmar) return;
    setOcupado(true);
    setError('');
    try {
      await cobrar(pedidoId, construirPagos());
      onCobrado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cobrar.');
      setOcupado(false);
    }
  }

  return (
    <div className="modal__fondo" onClick={() => !ocupado && onCerrar()}>
      <Tarjeta className="cobro" onClick={(e) => e.stopPropagation()}>
        <div className="cobro__total">
          <span>Total a cobrar</span>
          <strong>{pesos(total)}</strong>
        </div>

        {error && <div className="acceso__error">{error}</div>}

        <div className="cobro__metodos">
          {(
            [
              ['efectivo', 'Efectivo'],
              ['qr_breb', 'QR Bre-B'],
              ['mixto', 'Mixto']
            ] as [Metodo, string][]
          ).map(([m, etiqueta]) => (
            <button
              key={m}
              className={`cobro__metodo ${metodo === m ? 'cobro__metodo--activo' : ''}`}
              onClick={() => {
                setMetodo(m);
                setError('');
              }}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="cobro__campos">
          {metodo === 'efectivo' && (
            <>
              <Campo
                etiqueta="Efectivo recibido"
                inputMode="numeric"
                autoFocus
                value={recibido === 0 ? '' : String(recibido)}
                onChange={(e) => setRecibido(aEntero(e.target.value))}
                placeholder={String(total)}
              />
              <div className="cobro__chips">
                <button className="cobro__chip" onClick={() => setRecibido(total)}>
                  Exacto
                </button>
                {[20000, 50000, 100000].map((v) => (
                  <button key={v} className="cobro__chip" onClick={() => setRecibido(v)}>
                    {pesos(v)}
                  </button>
                ))}
              </div>
              {recibido >= total ? (
                <div className="cobro__resumen cobro__resumen--vuelto">
                  <span>Vuelto</span>
                  <strong>{pesos(vuelto)}</strong>
                </div>
              ) : (
                <p className="cobro__nota-falta">
                  Faltan {pesos(total - recibido)} para cubrir la cuenta.
                </p>
              )}
            </>
          )}

          {metodo === 'qr_breb' && (
            <Campo
              etiqueta="Referencia (opcional)"
              value={referencia}
              maxLength={120}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="N.° de comprobante Bre-B"
            />
          )}

          {metodo === 'mixto' && (
            <>
              <Campo
                etiqueta="Monto en efectivo"
                inputMode="numeric"
                autoFocus
                value={efectivoMixto === 0 ? '' : String(efectivoMixto)}
                onChange={(e) => setEfectivoMixto(Math.min(aEntero(e.target.value), total))}
                placeholder="0"
              />
              <div className="cobro__resumen">
                <span>Va por QR Bre-B</span>
                <strong>{pesos(qrMixto > 0 ? qrMixto : 0)}</strong>
              </div>
              <Campo
                etiqueta="Referencia QR (opcional)"
                value={referencia}
                maxLength={120}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="N.° de comprobante Bre-B"
              />
              {!(efectivoMixto > 0 && efectivoMixto < total) && (
                <p className="cobro__nota-falta">
                  El efectivo debe ser mayor a $0 y menor al total.
                </p>
              )}
            </>
          )}
        </div>

        <div className="cobro__acciones">
          <Boton variante="secundario" bloque onClick={onCerrar} disabled={ocupado}>
            Volver
          </Boton>
          <Boton bloque grande onClick={confirmar} disabled={!puedeConfirmar || ocupado}>
            Cobrar
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
