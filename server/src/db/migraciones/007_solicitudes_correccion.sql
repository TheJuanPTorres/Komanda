-- Correcciones con aprobación del admin (v1.5-B). Los auxiliares ya NO ejecutan
-- reducciones/eliminaciones directamente: las SOLICITAN y el admin resuelve.
-- Nada se ejecuta sin aprobación.
CREATE TABLE solicitudes_correccion (
  id              INTEGER PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id),
  item_id         INTEGER NOT NULL REFERENCES pedido_items(id),
  tipo            TEXT    NOT NULL CHECK (tipo IN ('reducir', 'eliminar')),
  cantidad_nueva  INTEGER,          -- solo tipo 'reducir'; NULL en eliminar
  motivo          TEXT    NOT NULL DEFAULT '',
  estado          TEXT    NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'anulada')),
  solicitado_por  INTEGER NOT NULL REFERENCES usuarios(id),
  resuelto_por    INTEGER REFERENCES usuarios(id),
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
  resuelto_en     TEXT
);

-- Índice parcial: consultas de pendientes (badge del admin, bloqueo de cobro).
CREATE INDEX idx_solic_pendientes ON solicitudes_correccion(estado)
  WHERE estado = 'pendiente';
