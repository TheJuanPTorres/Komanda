// Franja mínima del panel admin (v1.5-C, Parte 4): una sola línea con lo
// ACCIONABLE (correcciones pendientes) y lo OPERATIVO (pedidos abiertos). Las
// cifras de ventas viven en /ventas y en Cierre; aquí el piso es protagonista.
// Ambos números se derivan del store, que ya se mantiene al día por WS.
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { useStore } from '../../estado/store.js';

export function PulsoDelDia() {
  const navegar = useNavigate();
  const abiertos = useStore((s) => s.pedidos.length);
  const correcciones = useStore((s) => s.correcciones.length);

  return (
    <div className="pulso">
      <button
        className={`pulso__item pulso__item--corr ${correcciones > 0 ? 'pulso__item--alerta' : ''}`}
        onClick={() => correcciones > 0 && navegar('/correcciones')}
        disabled={correcciones === 0}
      >
        {correcciones > 0 ? (
          <AlertTriangle size={16} strokeWidth={2.5} />
        ) : (
          <ClipboardList size={16} strokeWidth={2.25} />
        )}
        <span className="pulso__num">{correcciones}</span>
        <span className="pulso__etq">
          {correcciones === 1 ? 'corrección pendiente' : 'correcciones pendientes'}
        </span>
      </button>

      <div className="pulso__item">
        <span className="pulso__num">{abiertos}</span>
        <span className="pulso__etq">{abiertos === 1 ? 'pedido abierto' : 'pedidos abiertos'}</span>
      </div>
    </div>
  );
}
