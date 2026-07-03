interface Props {
  pantalla?: boolean;
}

export function Cargando({ pantalla = false }: Props) {
  if (pantalla) {
    return (
      <div className="ds-cargando--pantalla">
        <div className="ds-cargando" role="status" aria-label="Cargando" />
      </div>
    );
  }
  return <div className="ds-cargando" role="status" aria-label="Cargando" />;
}
