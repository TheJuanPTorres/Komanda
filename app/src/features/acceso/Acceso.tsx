// Pantalla de acceso (internet público): cada persona entra con su PIN.
// El auxiliar toca su nombre y digita su PIN de 4; el admin, su PIN de ≥ 6.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Usuario } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Tarjeta, TecladoPin } from '../../design-system/index.js';
import { Cargando } from '../comunes/Cargando.js';
import logo from '../../design-system/logo.svg';
import './acceso.css';

type Modo = { tipo: 'lista' } | { tipo: 'auxiliar'; aux: Usuario } | { tipo: 'admin' };

export function Acceso() {
  const navegar = useNavigate();
  const entrarAuxiliar = useStore((s) => s.entrarAuxiliar);
  const entrarAdmin = useStore((s) => s.entrarAdmin);

  const [auxiliares, setAuxiliares] = useState<Usuario[] | null>(null);
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api
      .get<{ auxiliares: Usuario[] }>('/api/usuarios/auxiliares')
      .then((r) => setAuxiliares(r.auxiliares))
      .catch(() => setAuxiliares([]));
  }, []);

  function volverALista() {
    setModo({ tipo: 'lista' });
    setPin('');
    setError('');
  }

  function elegirAuxiliar(aux: Usuario) {
    setError('');
    if (!aux.tiene_pin) {
      setError('Este auxiliar aún no tiene PIN. Pídele al administrador que te asigne uno.');
      return;
    }
    setPin('');
    setModo({ tipo: 'auxiliar', aux });
  }

  async function acceder() {
    setError('');
    setOcupado(true);
    try {
      if (modo.tipo === 'admin') {
        // El PIN vigente puede ser corto (heredado): el servidor lo valida.
        // Si es corto, tras entrar se fuerza a definir uno de ≥ 6.
        if (pin.length < 4) throw new ErrorApi('PIN_CORTO', 'Escribe tu PIN.', 400);
        await entrarAdmin(pin);
      } else if (modo.tipo === 'auxiliar') {
        if (pin.length !== 4) throw new ErrorApi('PIN_CORTO', 'El PIN es de 4 dígitos.', 400);
        await entrarAuxiliar(modo.aux.id, pin);
      }
      navegar('/', { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar.');
      setPin('');
      setOcupado(false);
    }
  }

  if (auxiliares === null) return <Cargando />;

  const titulo =
    modo.tipo === 'admin'
      ? 'PIN de administrador'
      : modo.tipo === 'auxiliar'
        ? `PIN de ${modo.aux.nombre}`
        : null;

  return (
    <div className="acceso">
      <Tarjeta className="acceso__tarjeta">
        <div className="acceso__marca">
          <img className="acceso__logo" src={logo} alt="PARE Y COMA" />
          <h1>Pare y Coma</h1>
          <p>Toca tu nombre para empezar</p>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        {modo.tipo === 'lista' ? (
          <>
            <div>
              <div className="acceso__seccion">Auxiliares</div>
              <div className="acceso__auxiliares">
                {auxiliares.map((a) => (
                  <Boton
                    key={a.id}
                    variante="secundario"
                    flujo
                    disabled={ocupado}
                    onClick={() => elegirAuxiliar(a)}
                  >
                    {a.nombre}
                  </Boton>
                ))}
              </div>
              {auxiliares.length === 0 && (
                <p className="vacio">
                  <strong>Nadie en turno.</strong>
                  Registra los auxiliares para empezar.
                </p>
              )}
            </div>

            <div className="acceso__separador">o</div>

            <Boton variante="fantasma" bloque onClick={() => setModo({ tipo: 'admin' })}>
              Entrar como administrador
            </Boton>
          </>
        ) : (
          <>
            <div className="acceso__seccion">{titulo}</div>
            <TecladoPin
              valor={pin}
              longitud={modo.tipo === 'admin' ? 8 : 4}
              onCambio={(v) => {
                setError('');
                setPin(v);
              }}
              onEnter={acceder}
            />
            <Boton variante="fantasma" bloque disabled={ocupado} onClick={volverALista}>
              Volver
            </Boton>
          </>
        )}
      </Tarjeta>
    </div>
  );
}
