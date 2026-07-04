// Arranque de la app: registra el tiempo real, recupera la sesión existente
// (cookie) y muestra el enrutado. Un splash cubre la carga y al terminar sube
// dejando ver el login (o el piso si ya había sesión).
import { useEffect, useState } from 'react';
import { useStore } from './estado/store.js';
import { iniciarTiempoReal } from './estado/tiempoReal.js';
import { Rutas } from './rutas.js';
import { Cargando } from './features/comunes/Cargando.js';
import { Preloader } from './features/preloader/Preloader.js';
import { ActualizacionPWA } from './pwa/ActualizacionPWA.js';

export function App() {
  const cargarSesion = useStore((s) => s.cargarSesion);
  const cargandoSesion = useStore((s) => s.cargandoSesion);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    iniciarTiempoReal();
    cargarSesion();
  }, [cargarSesion]);

  return (
    <>
      {/* La app se prepara por debajo del splash; al subir, ya está lista. */}
      {cargandoSesion ? (
        <Cargando />
      ) : (
        <>
          <Rutas />
          <ActualizacionPWA />
        </>
      )}
      {splash && <Preloader onListo={() => setSplash(false)} />}
    </>
  );
}
