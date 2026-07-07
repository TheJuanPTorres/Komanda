-- Amplía el CHECK de pedido_eventos con dos tipos nuevos de la Parte 1:
-- 'correccion_solicitada' y 'correccion_rechazada'. SQLite no permite ALTER de
-- un CHECK, así que se reconstruye la tabla preservando los datos (mismo patrón
-- que 003 con usuarios). La bitácora sigue siendo solo-inserción; esto solo
-- amplía los tipos válidos. El migrador corre con foreign_keys OFF.
CREATE TABLE pedido_eventos_nueva (
  id         INTEGER PRIMARY KEY,
  pedido_id  INTEGER NOT NULL REFERENCES pedidos(id),
  tipo       TEXT    NOT NULL CHECK (tipo IN (
               'creado',
               'item_agregado',
               'item_reducido',
               'item_eliminado',
               'nota_editada',
               'cancelado',
               'cobrado',
               'correccion_solicitada',
               'correccion_rechazada'
             )),
  detalle    TEXT    NOT NULL DEFAULT '{}',
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pedido_eventos_nueva (id, pedido_id, tipo, detalle, usuario_id, creado_en)
  SELECT id, pedido_id, tipo, detalle, usuario_id, creado_en FROM pedido_eventos;

DROP TABLE pedido_eventos;
ALTER TABLE pedido_eventos_nueva RENAME TO pedido_eventos;

CREATE INDEX idx_eventos_pedido ON pedido_eventos(pedido_id);
CREATE INDEX idx_eventos_tipo_fecha ON pedido_eventos(tipo, creado_en);
