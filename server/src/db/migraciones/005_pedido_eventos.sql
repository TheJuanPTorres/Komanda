-- Bitácora inmutable de eventos de pedido (v1.5, Etapa A).
-- Cada mutación de un pedido escribe aquí un evento. Es SOLO-INSERCIÓN:
-- prohibido UPDATE o DELETE sobre esta tabla. La historia de un pedido se
-- reconstruye leyendo sus eventos en orden. No se generan eventos retroactivos
-- para pedidos anteriores a esta migración.
CREATE TABLE pedido_eventos (
  id         INTEGER PRIMARY KEY,
  pedido_id  INTEGER NOT NULL REFERENCES pedidos(id),
  tipo       TEXT    NOT NULL CHECK (tipo IN (
               'creado',
               'item_agregado',
               'item_reducido',
               'item_eliminado',
               'nota_editada',
               'cancelado',
               'cobrado'
             )),
  detalle    TEXT    NOT NULL DEFAULT '{}',
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_eventos_pedido ON pedido_eventos(pedido_id);
CREATE INDEX idx_eventos_tipo_fecha ON pedido_eventos(tipo, creado_en);
