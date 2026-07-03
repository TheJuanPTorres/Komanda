-- Fase 7: notificaciones de pago leídas del correo del banco (lector IMAP).
-- Cada correo procesado se guarda aquí (idempotente por mensaje_id). Si se
-- logra cruzar con un pago QR registrado, queda 'conciliado' y apunta a él;
-- si no, queda 'sin_pago' (un pago que llegó al banco pero no se registró en
-- caja: hay que revisarlo).
CREATE TABLE notificaciones_pago (
  id            INTEGER PRIMARY KEY,
  mensaje_id    TEXT    UNIQUE,           -- Message-ID del correo (evita duplicados)
  asunto        TEXT    NOT NULL DEFAULT '',
  remitente     TEXT    NOT NULL DEFAULT '',
  monto         INTEGER,                  -- extraído del correo (null si no se pudo)
  referencia    TEXT,                     -- referencia/CUS extraída (null si no se pudo)
  fecha_correo  TEXT,                     -- fecha del correo (ISO UTC)
  pago_id       INTEGER REFERENCES pagos(id),
  estado        TEXT    NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'conciliado', 'sin_pago')),
  crudo         TEXT    NOT NULL DEFAULT '', -- texto original, para depurar
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notif_estado ON notificaciones_pago(estado);
CREATE INDEX idx_notif_pago   ON notificaciones_pago(pago_id);
CREATE INDEX idx_notif_fecha  ON notificaciones_pago(creado_en);
