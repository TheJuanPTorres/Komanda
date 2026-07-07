// Pantalla bloqueante: en el primer login (o si el PIN es de fábrica), cada
// usuario debe definir su PIN real antes de operar. Admin: ≥ 6 dígitos;
// auxiliar: 4. Cubre toda la app.
import { useState } from 'react';
import { ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Tarjeta, TecladoPin } from '../../design-system/index.js';
import './acceso.css';

export function CambiarPinObligatorio() {
  const sesion = useStore((s) => s.sesion);
  const cambiarMiPin = useStore((s) => s.cambiarMiPin);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const esAdmin = sesion?.rol === 'admin';
  const longitud = esAdmin ? 6 : 4; // admin: mínimo 6 (pad de 6); auxiliar: 4 exacto
  const listo = esAdmin ? pin.length >= 6 : pin.length === 4;

  async function guardar() {
    if (!listo) {
      setError(esAdmin ? 'El PIN debe tener al menos 6 dígitos.' : 'El PIN es de 4 dígitos.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await cambiarMiPin(pin);
      // Al bajar la bandera en el store, esta pantalla se desmonta sola.
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el PIN.');
      setPin('');
      setOcupado(false);
    }
  }

  return (
    <div className="acceso acceso--overlay">
      <Tarjeta className="acceso__tarjeta">
        <div className="acceso__marca">
          <h1>Actualiza tu PIN</h1>
          <p>
            Por seguridad, define tu PIN {esAdmin ? 'de administrador (mínimo 6 dígitos)' : '(4 dígitos)'}.
          </p>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <div className="acceso__seccion">PIN nuevo</div>
        <TecladoPin
          valor={pin}
          longitud={longitud}
          onCambio={(v) => {
            setError('');
            setPin(v);
          }}
          onEnter={guardar}
        />
        <Boton flujo bloque disabled={ocupado || !listo} onClick={guardar}>
          Guardar PIN
        </Boton>
      </Tarjeta>
    </div>
  );
}
