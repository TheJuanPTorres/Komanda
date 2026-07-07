// Arranque de la app: registra el tiempo real, recupera la sesión existente
// (cookie) y muestra el enrutado. Un splash cubre la carga y al terminar sube
// dejando ver el login (o el piso si ya había sesión).
import { useEffect, useState } from 'react';
import { useStore } from './estado/store.js';
import { iniciarTiempoReal } from './estado/tiempoReal.js';
import { Rutas } from './rutas.js';
import { Cargando } from './features/comunes/Cargando.js';
import { Preloader } from './features/preloader/Preloader.js';
import { IndicadorConexion } from './features/comunes/IndicadorConexion.js';
import { CambiarPinObligatorio } from './features/acceso/CambiarPinObligatorio.js';
import { ActualizacionPWA } from './pwa/ActualizacionPWA.js';

// El splash es una intro de arranque: se muestra una vez por sesión del
// navegador (no en cada recarga), para que no resulte hostigante al trabajar.
const CLAVE_SPLASH = 'komanda_splash_visto';

export function App() {
  const cargarSesion = useStore((s) => s.cargarSesion);
  const cargandoSesion = useStore((s) => s.cargandoSesion);
  const sesion = useStore((s) => s.sesion);
  const debeCambiarPin = useStore((s) => s.debeCambiarPin);
  const [splash, setSplash] = useState(() => !sessionStorage.getItem(CLAVE_SPLASH));

  useEffect(() => {
    iniciarTiempoReal();
    cargarSesion();
  }, [cargarSesion]);

  const forzarCambioPin = Boolean(sesion) && debeCambiarPin;

  return (
    <>
      {/* La app se prepara por debajo del splash; al subir, ya está lista. */}
      {cargandoSesion ? (
        <Cargando />
      ) : (
        <>
          <Rutas />
          <ActualizacionPWA />
          {/* El aviso de conexión solo aplica con sesión activa (hay socket). */}
          {sesion && <IndicadorConexion />}
          {/* Bloquea la operación hasta renovar un PIN admin corto heredado. */}
          {forzarCambioPin && <CambiarPinObligatorio />}
        </>
      )}
      {splash && (
        <Preloader
          onListo={() => {
            sessionStorage.setItem(CLAVE_SPLASH, '1');
            setSplash(false);
          }}
        />
      )}
    </>
  );
}
