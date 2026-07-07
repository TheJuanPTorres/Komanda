// Navegación del administrador, con iconos, disponible en el encabezado de
// TODAS las pantallas de admin para poder saltar entre secciones sin volver al
// piso. Resalta la sección actual. Los auxiliares solo ven "Salir".
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardList, Lock, LogOut, Package, ShoppingBag, Users, Wallet } from 'lucide-react';
import { useStore } from '../../estado/store.js';
import { Boton } from '../../design-system/index.js';

const SECCIONES = [
  { ruta: '/ventas', etiqueta: 'Ventas', Icono: ShoppingBag },
  { ruta: '/productos', etiqueta: 'Productos', Icono: Package },
  { ruta: '/auxiliares', etiqueta: 'Auxiliares', Icono: Users },
  { ruta: '/gastos', etiqueta: 'Gastos', Icono: Wallet },
  { ruta: '/reportes', etiqueta: 'Reportes', Icono: BarChart3 },
  { ruta: '/cierre', etiqueta: 'Cierre', Icono: Lock }
] as const;

export function NavAdmin() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const sesion = useStore((s) => s.sesion);
  const salir = useStore((s) => s.salir);
  const pendientes = useStore((s) => s.correcciones.length);

  return (
    <nav className="nav-admin">
      {sesion?.rol === 'admin' && pendientes > 0 && (
        <Boton
          variante="secundario"
          className={`nav-admin__item nav-admin__item--correcciones ${pathname.startsWith('/correcciones') ? 'nav-admin__item--activo' : ''}`}
          onClick={() => navegar('/correcciones')}
        >
          <ClipboardList size={18} strokeWidth={2.25} />
          <span className="nav-admin__txt">Correcciones</span>
          <span className="nav-admin__badge">{pendientes}</span>
        </Boton>
      )}
      {sesion?.rol === 'admin' &&
        SECCIONES.map(({ ruta, etiqueta, Icono }) => {
          const activo = pathname.startsWith(ruta);
          return (
            <Boton
              key={ruta}
              variante="secundario"
              className={`nav-admin__item ${activo ? 'nav-admin__item--activo' : ''}`}
              aria-current={activo ? 'page' : undefined}
              onClick={() => navegar(ruta)}
            >
              <Icono size={18} strokeWidth={2.25} />
              <span className="nav-admin__txt">{etiqueta}</span>
            </Boton>
          );
        })}
      <Boton variante="fantasma" className="nav-admin__item" onClick={() => salir()}>
        <LogOut size={18} strokeWidth={2.25} />
        <span className="nav-admin__txt">Salir</span>
      </Boton>
    </nav>
  );
}
