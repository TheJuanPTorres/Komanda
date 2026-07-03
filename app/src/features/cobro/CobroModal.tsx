// Modal de cobro (solo lo abre el admin). Efectivo (con vuelto), QR Bre-B
// (con referencia) o mixto. La suma enviada siempre es exactamente el total;
// el servidor lo vuelve a validar.
import { useState } from 'react';
import type { MetodoPago, PagoReq } from '@pos/shared';
import { useStore } from '../../estado/store.js';
import { ErrorApi } from '../../lib/api.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { Boton, Campo, Chip, Modal, formatearDinero } from '../../design-system/index.js';
import './cobro.css';

type Metodo = MetodoPago | 'mixto';

interface Props {
  pedidoId: number;
  total: number;
  onCerrar: () => void;
  onCobrado: () => void;
}

const METODOS: [Metodo, string][] = [
  ['efectivo', 'Efectivo'],
  ['qr_breb', 'QR Bre-B'],
  ['mixto', 'Mixto']
];

export function CobroModal({ pedidoId, total, onCerrar, onCobrado }: Props) {
  const cobrar = useStore((s) => s.cobrar);

  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [recibido, setRecibido] = useState(0);
  const [efectivoMixto, setEfectivoMixto] = useState(0);
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
    <Modal titulo={`Cobrar ${formatearDinero(total)}`} onCerrar={() => !ocupado && onCerrar()}>
      <div className="cobro">
        {error && <div className="aviso-error">{error}</div>}

        <div className="cobro__metodos">
          {METODOS.map(([m, etiqueta]) => (
            <Chip
              key={m}
              activo={metodo === m}
              onClick={() => {
                setMetodo(m);
                setError('');
              }}
            >
              {etiqueta}
            </Chip>
          ))}
        </div>

        {metodo === 'efectivo' && (
          <>
            <Campo
              etiqueta="Efectivo recibido"
              inputMode="numeric"
              autoFocus
              value={recibido === 0 ? '' : String(recibido)}
              onChange={(e) => setRecibido(aEnteroDesdeTexto(e.target.value))}
              placeholder={String(total)}
            />
            <div className="cobro__chips">
              <Chip onClick={() => setRecibido(total)}>Exacto</Chip>
              {[20000, 50000, 100000].map((v) => (
                <Chip key={v} onClick={() => setRecibido(v)}>
                  {formatearDinero(v)}
                </Chip>
              ))}
            </div>
            {recibido >= total ? (
              <div className="cobro__resumen cobro__resumen--vuelto">
                <span>Vuelto</span>
                <strong>{formatearDinero(vuelto)}</strong>
              </div>
            ) : (
              <p className="cobro__falta">
                Faltan {formatearDinero(total - recibido)} para cubrir la cuenta.
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
              onChange={(e) => setEfectivoMixto(Math.min(aEnteroDesdeTexto(e.target.value), total))}
              placeholder="0"
            />
            <div className="cobro__resumen">
              <span>Va por QR Bre-B</span>
              <strong>{formatearDinero(qrMixto > 0 ? qrMixto : 0)}</strong>
            </div>
            <Campo
              etiqueta="Referencia QR (opcional)"
              value={referencia}
              maxLength={120}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="N.° de comprobante Bre-B"
            />
            {!(efectivoMixto > 0 && efectivoMixto < total) && (
              <p className="cobro__falta">El efectivo debe ser mayor a $0 y menor al total.</p>
            )}
          </>
        )}

        <div className="cobro__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={!puedeConfirmar || ocupado} onClick={confirmar}>
            Cobrar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
