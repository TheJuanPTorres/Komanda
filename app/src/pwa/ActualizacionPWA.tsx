// Aviso de actualización de la PWA. Cuando el service worker detecta una
// versión nueva, se muestra un aviso y el usuario decide cuándo aplicar la
// actualización (que recarga la app). Así nunca se recarga sola a mitad de
// un pedido.
import { useRegisterSW } from 'virtual:pwa-register/react';
import './actualizacion.css';

export function ActualizacionPWA() {
  const {
    needRefresh: [necesitaActualizar, setNecesitaActualizar],
    updateServiceWorker
  } = useRegisterSW();

  if (!necesitaActualizar) return null;

  return (
    <div className="pwa-toast" role="alert">
      <span>Hay una versión nueva.</span>
      <button className="pwa-toast__actualizar" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
      <button
        className="pwa-toast__cerrar"
        onClick={() => setNecesitaActualizar(false)}
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  );
}
