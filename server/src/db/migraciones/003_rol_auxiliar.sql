-- El rol de personal ahora se llama 'auxiliar' (antes tenía otro nombre).
-- SQLite no permite alterar un CHECK: se reconstruye la tabla usuarios.
-- El migrador corre con foreign_keys OFF, así que es seguro reconstruir.

CREATE TABLE usuarios_nueva (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL UNIQUE,
  rol           TEXT    NOT NULL CHECK (rol IN ('admin', 'auxiliar')),
  pin_hash      TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Copia convirtiendo el rol: admin se mantiene; todo lo demás pasa a auxiliar
-- (así no se nombra el valor viejo y funciona aunque ya esté convertido).
INSERT INTO usuarios_nueva (id, nombre, rol, pin_hash, activo, creado_en)
SELECT id, nombre,
       CASE WHEN rol = 'admin' THEN 'admin' ELSE 'auxiliar' END,
       pin_hash, activo, creado_en
FROM usuarios;

DROP TABLE usuarios;
ALTER TABLE usuarios_nueva RENAME TO usuarios;

-- Se renombra la columna del auxiliar en la tabla pedidos.
ALTER TABLE pedidos RENAME COLUMN mesero_id TO auxiliar_id;
