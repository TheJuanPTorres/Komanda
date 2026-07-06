// Prueba de la utilidad de día operativo (zona del negocio).
// Runner nativo: node --import tsx --test. Sin librerías externas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaOperativo, rangoDiaOperativo, rangoUtcDesdeFechas } from './fechas.js';

// Formatea un instante UTC como lo guarda SQLite, para comparar contra el rango.
function comoSqlite(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

test('venta 23:30 hora Colombia pertenece al día operativo colombiano', () => {
  // 2026-07-06 04:30 UTC == 2026-07-05 23:30 en America/Bogota (UTC-5).
  const instante = new Date('2026-07-06T04:30:00Z');

  assert.equal(diaOperativo(instante), '2026-07-05', 'el día operativo es el 5, no el 6 (UTC)');

  const { desdeUtc, hastaUtc } = rangoDiaOperativo(instante);
  assert.equal(desdeUtc, '2026-07-05 05:00:00', 'inicio del día Bogotá = 05:00 UTC');
  assert.equal(hastaUtc, '2026-07-06 05:00:00', 'fin del día Bogotá = 05:00 UTC del día siguiente');

  const venta = comoSqlite('2026-07-06T04:30:00Z'); // '2026-07-06 04:30:00'
  assert.ok(venta >= desdeUtc && venta < hastaUtc, 'la venta cae dentro del rango del día 5');
});

test('medianoche Bogotá (00:30 del 6) ya es día operativo 6', () => {
  // 2026-07-06 05:30 UTC == 2026-07-06 00:30 Bogotá.
  const instante = new Date('2026-07-06T05:30:00Z');
  assert.equal(diaOperativo(instante), '2026-07-06');
});

test('rangoUtcDesdeFechas cubre días inclusivos en hora del negocio', () => {
  const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas('2026-07-01', '2026-07-03');
  assert.equal(desdeUtc, '2026-07-01 05:00:00');
  assert.equal(hastaUtc, '2026-07-04 05:00:00'); // fin inclusivo del día 3
});
