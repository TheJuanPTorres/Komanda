// El auxiliar solicita una corrección (reducir cantidad o eliminar) de una
// línea. No ejecuta nada: crea una solicitud pendiente que el admin resuelve.
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { PedidoItem, TipoCorreccion } from '@pos/shared';
import { ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Campo, Chip, Modal } from '../../design-system/index.js';
import './correcciones.css';

const MOTIVOS = ['Se digitó de más', 'Cliente cambió de opinión', 'Salió mal'];

export function SolicitarCorreccionModal({
  pedidoId,
  item,
  onCerrar
}: {
  pedidoId: number;
  item: PedidoItem;
  onCerrar: () => void;
}) {
  const solicitarCorreccion = useStore((s) => s.solicitarCorreccion);
  const puedeReducir = item.cantidad > 1;
  const [tipo, setTipo] = useState<TipoCorreccion>(puedeReducir ? 'reducir' : 'eliminar');
  const [cantidadNueva, setCantidadNueva] = useState(Math.max(1, item.cantidad - 1));
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function enviar() {
    setOcupado(true);
    setError('');
    try {
      await solicitarCorreccion(pedidoId, item.id, {
        tipo,
        cantidad_nueva: tipo === 'reducir' ? cantidadNueva : undefined,
        motivo: motivo.trim() || undefined
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo enviar la solicitud.');
      setOcupado(false);
    }
  }

  return (
    <Modal titulo="Solicitar corrección" onCerrar={() => !ocupado && onCerrar()}>
      <div className="solc">
        {error && <div className="aviso-error">{error}</div>}
        <p className="solc__item">
          {item.cantidad}× {item.nombre_producto}
        </p>

        <div className="pedit__grupo">
          <span className="ds-campo__etiqueta">Qué hacer</span>
          <div className="pedit__chips">
            {puedeReducir && (
              <Chip activo={tipo === 'reducir'} onClick={() => setTipo('reducir')}>
                Bajar cantidad
              </Chip>
            )}
            <Chip activo={tipo === 'eliminar'} onClick={() => setTipo('eliminar')}>
              Eliminar
            </Chip>
          </div>
        </div>

        {tipo === 'reducir' && (
          <div className="pedit__grupo">
            <span className="ds-campo__etiqueta">Nueva cantidad</span>
            <div className="solc__stepper">
              <button
                className="pat-linea__paso"
                disabled={cantidadNueva <= 1}
                onClick={() => setCantidadNueva((n) => Math.max(1, n - 1))}
                aria-label="Menos"
              >
                <Minus size={20} strokeWidth={2.25} />
              </button>
              <span className="solc__cant">{cantidadNueva}</span>
              <button
                className="pat-linea__paso"
                disabled={cantidadNueva >= item.cantidad - 1}
                onClick={() => setCantidadNueva((n) => Math.min(item.cantidad - 1, n + 1))}
                aria-label="Más"
              >
                <Plus size={20} strokeWidth={2.25} />
              </button>
              <span className="solc__de">de {item.cantidad}</span>
            </div>
          </div>
        )}

        <div className="pedit__grupo">
          <span className="ds-campo__etiqueta">Motivo (opcional)</span>
          <div className="pedit__chips">
            {MOTIVOS.map((m) => (
              <Chip key={m} activo={motivo === m} onClick={() => setMotivo(motivo === m ? '' : m)}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
        <Campo
          etiqueta="O escribe el motivo"
          value={motivo}
          maxLength={120}
          placeholder="Ej: el cliente pidió sin cebolla"
          onChange={(e) => setMotivo(e.target.value)}
        />

        <div className="pedit__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={ocupado} onClick={enviar}>
            Enviar solicitud
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
