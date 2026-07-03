# Guía de operación — POS Local

Sistema de punto de venta que corre **100% en la red del negocio**, sin nube.
Un solo equipo (la "caja": laptop o mini PC) hace de servidor; los meseros
entran desde sus celulares por el navegador.

---

## 1. Requisitos (en la caja)

- **Node.js 20 o superior**.
- **PM2** (para dejarlo corriendo solo): `npm install -g pm2`

## 2. Puesta en marcha (una sola vez)

Desde la carpeta del proyecto:

```bash
npm install          # instala todo
npm run build        # compila servidor y app
npm run seed         # crea el admin (PIN 1234), meseros y productos de ejemplo
pm2 start ecosystem.config.js
pm2 save             # recuerda el proceso
pm2 startup          # que arranque solo al prender la máquina (seguir la instrucción que imprime)
```

Cambia el **secreto de sesión** (recomendado):

```bash
pm2 set pos-server:JWT_SECRET "una-clave-larga-y-secreta-que-solo-tu-sepas"
pm2 restart pos-server
```

> ⚠️ Entra como administrador y **cambia el PIN 1234** por uno propio antes de operar.

## 3. Entrar desde los celulares

1. La caja y los celulares deben estar en el **mismo WiFi**.
2. Averigua la IP de la caja: en Windows, `ipconfig` → "Dirección IPv4"
   (algo como `192.168.0.22`).
3. En el celular, abre el navegador y entra a: **`http://192.168.0.22:3000`**
   (usa la IP de tu caja). Cada mesero toca su nombre; el admin entra con PIN.

## 4. Instalar como app en el celular (PWA)

Para que se instale como app y funcione mejor, el navegador exige **HTTPS**.
Sobre `http://…` funciona como página web normal (se puede "Agregar a
pantalla de inicio" como acceso directo), pero sin modo sin conexión.

Para habilitar HTTPS en la red local (opcional, recomendado si usan mucho el
celular):

1. Instala **mkcert** en la caja y su CA: `mkcert -install`
2. Genera un certificado para la IP de la caja:
   `mkcert 192.168.0.22`  → crea dos archivos `.pem`.
3. Cópialos a `server/certs/` como `cert.pem` y `key.pem`
   (o define las variables `HTTPS_CERT` y `HTTPS_KEY`).
4. `pm2 restart pos-server`. Ahora entra por **`https://192.168.0.22:3000`**.
5. En cada celular, instala la CA de mkcert una vez para que confíe en el
   certificado (mkcert explica cómo). Luego el navegador ofrecerá "Instalar app".

## 5. Respaldos (¡importante!)

Toda la información vive en un solo archivo: `server/data/pos.db`.

Crea una copia consistente con:

```bash
npm run respaldo
```

Deja la copia en `server/data/respaldos/` y conserva las últimas 14.
**Cópialas también a una USB o a otra carpeta de vez en cuando.**

### Agendar el respaldo automático (Windows)

Abre el **Programador de tareas** y crea una tarea que, cada noche, ejecute:

```
Programa:   C:\Program Files\nodejs\node.exe
Argumentos: scripts\respaldo.mjs
Iniciar en: C:\ruta\al\proyecto\server
```

### Restaurar un respaldo

Con el servidor detenido (`pm2 stop pos-server`), reemplaza
`server/data/pos.db` por la copia deseada (renómbrala a `pos.db`) y borra los
archivos `pos.db-wal` y `pos.db-shm` si existen. Luego `pm2 start pos-server`.

## 6. Actualizar el sistema

En la caja:

```bash
npm install
npm run build
pm2 restart pos-server
```

En los celulares/tablets aparecerá un aviso **"Hay una versión nueva ·
Actualizar"**: al tocarlo, se recarga con la versión nueva. Nunca se recarga
solo a mitad de un pedido.

## 7. Reglas del negocio grabadas en el sistema

- **Solo el administrador cobra y cierra pedidos.** Se valida en el servidor.
- El dinero se maneja en pesos enteros (sin centavos).
- El "día" del negocio es el día de Colombia (para turnos, gastos y cierre).
- Al vender se guarda una foto del precio y costo del producto: por eso el
  reporte de margen es fiel aunque después cambien los precios.

## 8. Problemas comunes

- **Un celular no carga**: revisa que esté en el mismo WiFi y que la IP sea la
  correcta. Prueba `http://IP:3000/api/salud` en el navegador de la caja.
- **Se reinició la máquina y no arranca**: `pm2 resurrect` (o revisa
  `pm2 startup`).
- **Ver el estado / logs**: `pm2 status`, `pm2 logs pos-server`.
