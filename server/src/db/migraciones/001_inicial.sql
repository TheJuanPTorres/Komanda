CREATE TABLE usuarios (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL UNIQUE,
  rol           TEXT    NOT NULL CHECK (rol IN ('admin', 'mesero')),
  pin_hash      TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categorias (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL UNIQUE,
  orden         INTEGER NOT NULL DEFAULT 0,
  activo        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE productos (
  id             INTEGER PRIMARY KEY,
  categoria_id   INTEGER REFERENCES categorias(id),
  nombre         TEXT    NOT NULL,
  precio         INTEGER NOT NULL CHECK (precio >= 0),
  costo          INTEGER NOT NULL DEFAULT 0,
  controla_stock INTEGER NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  stock_minimo   INTEGER NOT NULL DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_productos_activos ON productos(activo, categoria_id);

CREATE TABLE pedidos (
  id             INTEGER PRIMARY KEY,
  tipo           TEXT    NOT NULL CHECK (tipo IN ('mesa', 'barra')),
  mesa_numero    INTEGER CHECK (mesa_numero BETWEEN 1 AND 4),
  cliente_nombre TEXT,
  turno          INTEGER,
  estado         TEXT    NOT NULL DEFAULT 'abierto'
                 CHECK (estado IN ('abierto', 'cobrado', 'cancelado')),
  mesero_id      INTEGER NOT NULL REFERENCES usuarios(id),
  nota           TEXT    NOT NULL DEFAULT '',
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now')),
  cerrado_en     TEXT,
  cerrado_por    INTEGER REFERENCES usuarios(id),
  CHECK ( (tipo = 'mesa'  AND mesa_numero IS NOT NULL)
       OR (tipo = 'barra' AND turno IS NOT NULL) )
);
CREATE INDEX idx_pedidos_abiertos ON pedidos(estado) WHERE estado = 'abierto';
CREATE INDEX idx_pedidos_fecha    ON pedidos(creado_en);

CREATE TABLE pedido_items (
  id              INTEGER PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id),
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  nombre_producto TEXT    NOT NULL,
  precio_unitario INTEGER NOT NULL,
  costo_unitario  INTEGER NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  agregado_por    INTEGER NOT NULL REFERENCES usuarios(id),
  agregado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_items_pedido ON pedido_items(pedido_id);

CREATE TABLE pagos (
  id                  INTEGER PRIMARY KEY,
  pedido_id           INTEGER NOT NULL REFERENCES pedidos(id),
  metodo              TEXT    NOT NULL CHECK (metodo IN ('efectivo', 'qr_breb')),
  monto               INTEGER NOT NULL CHECK (monto > 0),
  referencia_externa  TEXT,
  verificado          INTEGER NOT NULL DEFAULT 0,
  registrado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX idx_pagos_fecha  ON pagos(creado_en);

CREATE TABLE gastos (
  id             INTEGER PRIMARY KEY,
  concepto       TEXT    NOT NULL,
  categoria      TEXT    NOT NULL DEFAULT 'insumos'
                 CHECK (categoria IN ('insumos', 'servicios', 'nomina', 'otros')),
  monto          INTEGER NOT NULL CHECK (monto > 0),
  metodo         TEXT    NOT NULL DEFAULT 'efectivo'
                 CHECK (metodo IN ('efectivo', 'qr_breb')),
  nota           TEXT    NOT NULL DEFAULT '',
  registrado_por INTEGER NOT NULL REFERENCES usuarios(id),
  fecha          TEXT    NOT NULL DEFAULT (date('now')),
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);

CREATE TABLE cierres_caja (
  id                INTEGER PRIMARY KEY,
  fecha             TEXT    NOT NULL UNIQUE,
  base_inicial      INTEGER NOT NULL DEFAULT 0,
  ventas_efectivo   INTEGER NOT NULL,
  ventas_qr         INTEGER NOT NULL,
  gastos_efectivo   INTEGER NOT NULL,
  efectivo_esperado INTEGER NOT NULL,
  efectivo_contado  INTEGER NOT NULL,
  diferencia        INTEGER NOT NULL,
  num_pedidos       INTEGER NOT NULL,
  nota              TEXT    NOT NULL DEFAULT '',
  cerrado_por       INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en         TEXT    NOT NULL DEFAULT (datetime('now'))
);
