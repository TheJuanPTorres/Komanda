// Arranque de la app: registra el tiempo real, recupera la sesión existente
// (cookie) y muestra el enrutado. Mientras verifica la sesión, muestra carga.
import { useEffect } from 'react';
import { useStore } from './estado/store.js';
import { iniciarTiempoReal } from './estado/tiempoReal.js';
import { Rutas } from './rutas.js';
import { Cargando } from './design-system/primitivas/index.js';
import { ActualizacionPWA } from './pwa/ActualizacionPWA.js';

export function App() {
  const cargarSesion = useStore((s) => s.cargarSesion);
  const cargandoSesion = useStore((s) => s.cargandoSesion);

  useEffect(() => {
    iniciarTiempoReal();
    cargarSesion();
  }, [cargarSesion]);

  if (cargandoSesion) return <Cargando pantalla />;
  return (
    <>
      <Rutas />
      <ActualizacionPWA />
    </>
  );
}
