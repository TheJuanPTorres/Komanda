// CLI: aplica las migraciones pendientes y termina. Uso: npm run migrar
import { migrar } from './migrador.js';

migrar();
process.exit(0);
