// =========================================================
// Prueba de la resolución dinámica de la AR propia (js/resolucion.js, Ronda 4)
// Simula cuadros a distintos FPS y revisa cómo cambia la escala.
// Correr: cd pruebas → npm test
// =========================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearResolucionDinamica } from '../js/resolucion.js';

/** Simula `segundos` de cuadros a `fpsDe(escala)` FPS. Devuelve la hora final. */
function simular(r, segundos, fpsDe, t = 1) {
  const fin = t + segundos * 1000;
  while (t < fin) { r.cuadro(t); t += 1000 / fpsDe(r.escala); }
  return t;
}

test('con 60 FPS justos (pantalla de 60 Hz) se queda en la escala inicial', () => {
  const r = crearResolucionDinamica();
  simular(r, 30, () => 60);
  assert.equal(r.escala, 0.83);
});

test('si los FPS caen, baja la resolución hasta volver a 60', () => {
  const r = crearResolucionDinamica();
  // GPU limitada: los FPS crecen cuando hay menos píxeles (escala²)
  const fpsDe = (e) => Math.min(60, 35 / (e * e));   // a 0,83 → 51 FPS
  simular(r, 20, fpsDe);
  assert.ok(r.escala < 0.83, `bajó (${r.escala})`);
  assert.ok(fpsDe(r.escala) >= 58, `vuelve a ~60 FPS (${fpsDe(r.escala).toFixed(1)})`);
  assert.ok(r.escala >= 0.5);
});

test('si sobran FPS (pantalla de 120 Hz), sube la resolución sin pasar de 1', () => {
  const r = crearResolucionDinamica();
  simular(r, 40, (e) => 80 / e);
  assert.ok(r.escala > 0.83, `subió (${r.escala})`);
  assert.ok(r.escala <= 1);
});

test('si bajar la resolución no mejora los FPS (el límite es la cámara), vuelve a la inicial y se fija', () => {
  const r = crearResolucionDinamica();
  simular(r, 15, () => 30);
  assert.equal(r.fija, true);
  assert.equal(r.escala, 0.83);
});
