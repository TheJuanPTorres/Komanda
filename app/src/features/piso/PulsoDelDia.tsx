// Franja "Pulso del día" del panel admin: cuatro cifras grandes en vivo. Las
// ventas y # de pedidos vienen del servidor (se refrescan al cobrar por WS);
// los pedidos abiertos y las correcciones pendientes se derivan del store, que
// ya se mantiene al día por tiempo real.
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../estado/store.js';
import { formatearDinero } from '../../design-system/index.js';

export function PulsoDelDia() {
  const navegar = useNavigate();
  const pulso = useStore((s) => s.pulso);
  const abiertos = useStore((s) => s.pedidos.length);
  const correcciones = useStore((s) => s.correcciones.length);

  return (
    <div className="pulso">
      <div className="pulso__celda">
        <span className="pulso__num">{formatearDinero(pulso?.ventas_hoy ?? 0)}</span>
        <span className="pulso__etq">Ventas de hoy</span>
      </div>
      <div className="pulso__celda">
        <span className="pulso__num">{pulso?.pedidos_hoy ?? 0}</span>
        <span className="pulso__etq">Pedidos cobrados</span>
      </div>
      <div className="pulso__celda">
        <span className="pulso__num">{abiertos}</span>
        <span className="pulso__etq">Abiertos ahora</span>
      </div>
      <button
        className={`pulso__celda pulso__celda--accion ${correcciones > 0 ? 'pulso__celda--alerta' : ''}`}
        onClick={() => correcciones > 0 && navegar('/correcciones')}
        disabled={correcciones === 0}
      >
        <span className="pulso__num">{correcciones}</span>
        <span className="pulso__etq">Correcciones</span>
      </button>
    </div>
  );
}
