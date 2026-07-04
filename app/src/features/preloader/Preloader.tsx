// Splash de entrada: "KOMANDA" se revela letra por letra (barrido de abajo
// hacia arriba) y luego la placa nocturna sube dejando ver la app.
// Es una intro de marca intencional: se reproduce siempre (el CSS reafirma sus
// tiempos aunque el sistema pida menos movimiento).
import { useEffect, useRef, useState } from 'react';
import './preloader.css';

const PALABRA = 'Komanda';
const STAGGER = 70; // ms entre el arranque de cada letra
const DUR_LETRA = 720; // ms que tarda una letra en subir
const ESPERA = 520; // ms de pausa con la palabra ya formada
const DUR_SALIDA = 1150; // ms que tarda la placa en subir (lento y fluido)

interface Props {
  onListo: () => void;
}

export function Preloader({ onListo }: Props) {
  const [saliendo, setSaliendo] = useState(false);
  const listoLlamado = useRef(false);

  useEffect(() => {
    // Cuándo empezar a subir la placa: tras revelar todas las letras + pausa.
    const finPalabra = (PALABRA.length - 1) * STAGGER + DUR_LETRA;
    const inicioSalida = finPalabra + ESPERA;

    const t1 = setTimeout(() => setSaliendo(true), inicioSalida);
    // Respaldo por si no llega el evento transitionend.
    const t2 = setTimeout(terminar, inicioSalida + DUR_SALIDA + 150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function terminar() {
    if (listoLlamado.current) return;
    listoLlamado.current = true;
    onListo();
  }

  return (
    <div
      className={`preloader ${saliendo ? 'preloader--saliendo' : ''}`}
      role="status"
      aria-label="Cargando Komanda"
      onTransitionEnd={(e) => {
        // Solo cuando termina de subir la placa (no otras transiciones).
        if (saliendo && e.propertyName === 'transform') terminar();
      }}
    >
      <div className="preloader__centro">
        <div className="preloader__palabra" aria-hidden="true">
          {PALABRA.split('').map((letra, i) => (
            <span className="preloader__mascara" key={i}>
              <span className="preloader__letra" style={{ animationDelay: `${i * STAGGER}ms` }}>
                {letra}
              </span>
            </span>
          ))}
        </div>
        <span
          className="preloader__linea"
          aria-hidden="true"
          style={{ animationDelay: `${(PALABRA.length - 1) * STAGGER + 120}ms` }}
        />
      </div>
    </div>
  );
}
