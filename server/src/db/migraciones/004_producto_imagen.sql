-- Foto del producto: ruta relativa servida por el backend (nullable).
-- Las imágenes viven en server/data/imagenes/{id}.webp; aquí solo la ruta.
ALTER TABLE productos ADD COLUMN imagen TEXT;
