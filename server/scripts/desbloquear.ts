// Desbloqueo de EMERGENCIA por CLI (solo para quien tiene SSH al servidor).
// NO se expone por HTTP. Salida cuando un atacante re-dispara el bloqueo por
// cuenta del admin cada 15 min desde IPs distintas y no hay sesión activa.
//
// Uso:
//   npm run desbloquear -- <nombre_usuario>   → limpia el bloqueo de esa cuenta
//   npm run desbloquear                        → lista las cuentas bloqueadas
//
// Usa la MISMA lógica que el endpoint de desbloqueo (limpiarIntentos).
import {
  limpiarIntentos,
  listarBloqueadas,
  listarNombres,
  usuarioPorNombre
} from '../src/modulos/auth/servicio.js';

// argv: [node, script, <nombre?>]. npm pasa lo de después de `--` aquí.
const nombre = process.argv[2]?.trim();

if (!nombre) {
  // Sin argumento: listar cuentas bloqueadas y su tiempo restante.
  const bloqueadas = listarBloqueadas();
  if (bloqueadas.length === 0) {
    console.log('No hay cuentas bloqueadas en este momento.');
  } else {
    console.log('Cuentas bloqueadas:');
    for (const c of bloqueadas) {
      console.log(
        `  - "${c.nombre}" (${c.rol}): ${c.fallos} fallos; se libera sola en ~${c.restante_min} min.`
      );
    }
    console.log('\nPara liberar una ya: npm run desbloquear -- <nombre>');
  }
  process.exit(0);
}

const usuario = usuarioPorNombre(nombre);
if (!usuario) {
  console.error(`No existe ningún usuario llamado "${nombre}".`);
  console.error(`Usuarios: ${listarNombres().join(', ')}`);
  process.exit(1);
}

limpiarIntentos(usuario.id);
console.log(`Cuenta "${usuario.nombre}" desbloqueada. Fallos reiniciados a 0.`);
process.exit(0);
