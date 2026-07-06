-- Endurecimiento de seguridad (Fase Nube — internet público).

-- 1) Bandera para forzar la renovación del PIN de admin cuando es corto (< 6).
--    No se puede medir la longitud desde el hash bcrypt, así que se marca al
--    admin existente (PIN sembrado de 4 dígitos): en su próximo login exitoso
--    deberá definir uno de al menos 6 dígitos antes de continuar.
ALTER TABLE usuarios ADD COLUMN debe_cambiar_pin INTEGER NOT NULL DEFAULT 0;
UPDATE usuarios SET debe_cambiar_pin = 1 WHERE rol = 'admin';

-- 2) Intentos fallidos de login por CUENTA (no por IP): el bloqueo persiste
--    aunque el atacante cambie de IP y sobrevive a reinicios del proceso.
--    Solo se registran los fallos; se limpian al entrar correctamente. El
--    conteo se hace sobre una ventana de tiempo (15 min) al momento de validar.
CREATE TABLE intentos_login (
  id         INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_intentos_login ON intentos_login(usuario_id, creado_en);
