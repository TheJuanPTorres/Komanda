// Pantalla bloqueante: si el admin tiene un PIN corto heredado, debe definir
// uno nuevo de al menos 6 dígitos antes de poder operar. Cubre toda la app.
import { useState } from 'react';
import { ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Tarjeta, TecladoPin } from '../../design-system/index.js';
import './acceso.css';

export function CambiarPinObligatorio() {
  const cambiarPinAdmin = useStore((s) => s.cambiarPinAdmin);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    if (pin.length < 6) {
      setError('El PIN nuevo debe tener al menos 6 dígitos.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await cambiarPinAdmin(pin);
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
          <p>Por seguridad, define un PIN de administrador de al menos 6 dígitos.</p>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <div className="acceso__seccion">PIN nuevo (mínimo 6 dígitos)</div>
        <TecladoPin
          valor={pin}
          longitud={6}
          onCambio={(v) => {
            setError('');
            setPin(v);
          }}
          onEnter={guardar}
        />
        <Boton flujo bloque disabled={ocupado || pin.length < 6} onClick={guardar}>
          Guardar PIN
        </Boton>
      </Tarjeta>
    </div>
  );
}
