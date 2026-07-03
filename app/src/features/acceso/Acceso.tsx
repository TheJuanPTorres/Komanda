// Pantalla de acceso: cada mesero toca su nombre; el admin entra con PIN.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Usuario } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Cargando, Tarjeta } from '../../design-system/primitivas/index.js';
import './acceso.css';

export function Acceso() {
  const navegar = useNavigate();
  const entrarMesero = useStore((s) => s.entrarMesero);
  const entrarAdmin = useStore((s) => s.entrarAdmin);

  const [meseros, setMeseros] = useState<Usuario[] | null>(null);
  const [modoAdmin, setModoAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api
      .get<{ meseros: Usuario[] }>('/api/usuarios/meseros')
      .then((r) => setMeseros(r.meseros))
      .catch(() => setMeseros([]));
  }, []);

  async function accederMesero(id: number) {
    setError('');
    setOcupado(true);
    try {
      await entrarMesero(id);
      navegar('/', { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar.');
      setOcupado(false);
    }
  }

  async function accederAdmin() {
    setError('');
    setOcupado(true);
    try {
      await entrarAdmin(pin);
      navegar('/', { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar.');
      setPin('');
      setOcupado(false);
    }
  }

  function teclaPin(t: string) {
    setError('');
    if (t === 'borrar') {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 6) {
      setPin((p) => p + t);
    }
  }

  if (meseros === null) return <Cargando pantalla />;

  return (
    <div className="acceso">
      <Tarjeta className="acceso__tarjeta">
        <div className="acceso__marca">
          <h1>Punto de venta</h1>
          <p>Toca tu nombre para empezar</p>
        </div>

        {error && <div className="acceso__error">{error}</div>}

        {!modoAdmin ? (
          <>
            <div>
              <div className="acceso__seccion-titulo">Meseros</div>
              <div className="acceso__meseros">
                {meseros.map((m) => (
                  <Boton
                    key={m.id}
                    variante="secundario"
                    grande
                    disabled={ocupado}
                    onClick={() => accederMesero(m.id)}
                  >
                    {m.nombre}
                  </Boton>
                ))}
                {meseros.length === 0 && (
                  <p style={{ color: 'var(--color-tinta-suave)' }}>No hay meseros registrados.</p>
                )}
              </div>
            </div>

            <div className="acceso__separador">o</div>

            <Boton variante="fantasma" bloque onClick={() => setModoAdmin(true)}>
              Entrar como administrador
            </Boton>
          </>
        ) : (
          <>
            <div className="acceso__seccion-titulo">PIN de administrador</div>
            <div className="pin__puntos">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`pin__punto ${i < pin.length ? 'pin__punto--lleno' : ''}`} />
              ))}
            </div>
            <div className="pin__teclado">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((t) => (
                <button key={t} className="pin__tecla" onClick={() => teclaPin(t)}>
                  {t}
                </button>
              ))}
              <button className="pin__tecla" onClick={() => teclaPin('borrar')} aria-label="Borrar">
                ⌫
              </button>
              <button className="pin__tecla" onClick={() => teclaPin('0')}>
                0
              </button>
              <button
                className="pin__tecla"
                onClick={accederAdmin}
                disabled={pin.length < 4 || ocupado}
                aria-label="Entrar"
                style={{ color: 'var(--color-acento)' }}
              >
                ✓
              </button>
            </div>
            <Boton
              variante="fantasma"
              bloque
              onClick={() => {
                setModoAdmin(false);
                setPin('');
                setError('');
              }}
            >
              Volver
            </Boton>
          </>
        )}
      </Tarjeta>
    </div>
  );
}
