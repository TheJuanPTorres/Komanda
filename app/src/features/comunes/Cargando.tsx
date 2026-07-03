// Pantalla de carga con la marca (pulso del logo, nunca spinner).
import logo from '../../design-system/logo.svg';
import { Skeleton } from '../../design-system/index.js';
import './comunes.css';

export function Cargando() {
  return (
    <div className="carga">
      <img className="carga__logo" src={logo} alt="PARE Y COMA" />
      <Skeleton ancho={160} alto={14} radio="var(--radio-pill)" />
    </div>
  );
}
