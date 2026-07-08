-- Configuración simple del negocio (clave/valor). Por ahora guarda el número de
-- WhatsApp al que el admin comparte el resumen de cierre. Tabla genérica para no
-- migrar por cada ajuste futuro.
CREATE TABLE configuracion (
  clave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
