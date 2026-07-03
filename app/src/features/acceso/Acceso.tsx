// Pantalla de acceso: cada mesero toca su nombre; el admin entra con PIN.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Usuario } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Tarjeta, TecladoPin } from '../../design-system/index.js';
import { Cargando } from '../comunes/Cargando.js';
import logo from '../../design-system/logo.svg';
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
    if (pin.length < 4) return;
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

  if (meseros === null) return <Cargando />;

  return (
    <div className="acceso">
      <Tarjeta className="acceso__tarjeta">
        <div className="acceso__marca">
          <img className="acceso__logo" src={logo} alt="PARE Y COMA" />
          <h1>Pare y Coma</h1>
          <p>Toca tu nombre para empezar</p>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        {!modoAdmin ? (
          <>
            <div>
              <div className="acceso__seccion">Meseros</div>
              <div className="acceso__meseros">
                {meseros.map((m) => (
                  <Boton
                    key={m.id}
                    variante="secundario"
                    flujo
                    disabled={ocupado}
                    onClick={() => accederMesero(m.id)}
                  >
                    {m.nombre}
                  </Boton>
                ))}
              </div>
              {meseros.length === 0 && (
                <p className="vacio">
                  <strong>Nadie en turno.</strong>
                  Registra los meseros para empezar.
                </p>
              )}
            </div>

            <div className="acceso__separador">o</div>

            <Boton variante="fantasma" bloque onClick={() => setModoAdmin(true)}>
              Entrar como administrador
            </Boton>
          </>
        ) : (
          <>
            <div className="acceso__seccion">PIN de administrador</div>
            <TecladoPin
              valor={pin}
              longitud={4}
              onCambio={(v) => {
                setError('');
                setPin(v);
              }}
              onEnter={accederAdmin}
            />
            <Boton
              variante="fantasma"
              bloque
              disabled={ocupado}
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
