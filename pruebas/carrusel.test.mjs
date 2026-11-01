// =========================================================
// Prueba del carrusel del hero (Ronda 2 · A1)
// - avanza solo cada 8 s y precarga el siguiente
// - los puntos cambian de proyecto y el nombre lleva a la ficha
// - se pausa con el mouse encima
// - con «reducir movimiento» no avanza solo
// - el televisor muestra el póster en la pantalla
// Correr: cd pruebas → npm test
// =========================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { levantarServidor } from './servidor.mjs';

let servidor, navegador;
const captura = (nombre) => new URL(`./capturas/${nombre}`, import.meta.url).pathname.slice(1);

/** Estado del carrusel visto desde la página */
const estado = (pagina) => pagina.evaluate(() => {
  const c = document.getElementById('carrusel');
  const activo = c.querySelector('model-viewer.activo');
  return {
    actual: window.vitrina.carrusel.actual,
    titulo: c.querySelector('.carrusel-titulo').textContent,
    href: c.querySelector('.carrusel-enlace').getAttribute('href'),
    srcActivo: activo?.src.split('/').pop() ?? null,
    cargados: [...c.querySelectorAll('model-viewer')].filter(v => v.loaded).length,
    punto: [...c.querySelectorAll('.carrusel-puntos button')].findIndex(b => b.getAttribute('aria-current') === 'true')
  };
});

async function abrir({ reducido = false, movil = false } = {}) {
  const contexto = await navegador.newContext({
    reducedMotion: reducido ? 'reduce' : 'no-preference',
    ...(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } })
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.goto(servidor.url + 'index.html');
  // Espera a que el primer modelo esté visible y el siguiente precargado
  await pagina.waitForFunction(() => document.querySelectorAll('#carrusel model-viewer.activo').length === 1 &&
    [...document.querySelectorAll('#carrusel model-viewer')].every(v => v.loaded), null, { timeout: 60000 });
  return { pagina, contexto, errores };
}

before(async () => {
  servidor = await levantarServidor();
  navegador = await chromium.launch({ channel: 'chrome' });
  await mkdir(new URL('./capturas/', import.meta.url), { recursive: true });
});
after(async () => { await navegador?.close(); servidor?.cerrar(); });

test('empieza en el primer proyecto con el siguiente ya precargado', async () => {
  const { pagina, contexto, errores } = await abrir();
  const e = await estado(pagina);
  assert.equal(e.actual, 0);
  assert.equal(e.punto, 0);
  assert.equal(e.cargados, 2, 'los dos visores deben tener su modelo cargado (precarga)');
  assert.match(e.href, /^proyecto\.html\?id=/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('avanza solo a los 8 segundos', async () => {
  const { pagina, contexto } = await abrir();
  const antes = await estado(pagina);
  await pagina.waitForTimeout(9000);
  const despues = await estado(pagina);
  assert.notEqual(despues.actual, antes.actual);
  assert.notEqual(despues.titulo, antes.titulo);
  assert.notEqual(despues.srcActivo, antes.srcActivo);
  await contexto.close();
});

test('los puntos cambian de proyecto y el televisor muestra el póster', async () => {
  const { pagina, contexto } = await abrir({ movil: true });
  await pagina.screenshot({ path: captura('carrusel-celular-1.png') });
  await pagina.click('.carrusel-puntos button[data-i="1"]');
  await pagina.waitForTimeout(1500);
  const e = await estado(pagina);
  assert.equal(e.actual, 1);
  assert.equal(e.punto, 1);
  assert.equal(e.srcActivo, 'pantalla-cine.glb');
  const tienePoster = await pagina.evaluate(() => {
    const tv = document.querySelector('#carrusel model-viewer.activo');
    return tv.model.getMaterialByName('pantalla').pbrMetallicRoughness.baseColorTexture.texture?.source.uri ?? null;
  });
  assert.match(tienePoster ?? '', /cuentos-y-espias-pantalla\.webp/);
  await pagina.screenshot({ path: captura('carrusel-celular-2.png') });
  await contexto.close();
});

test('se pausa con el mouse encima', async () => {
  const { pagina, contexto } = await abrir();
  await pagina.hover('#carrusel .carrusel-visor');
  const antes = await estado(pagina);
  await pagina.waitForTimeout(9000);
  assert.equal((await estado(pagina)).actual, antes.actual, 'con el mouse encima no debe cambiar');
  await contexto.close();
});

test('con «reducir movimiento» no avanza ni gira solo', async () => {
  const { pagina, contexto } = await abrir({ reducido: true });
  const antes = await estado(pagina);
  await pagina.waitForTimeout(9000);
  assert.equal((await estado(pagina)).actual, antes.actual);
  const gira = await pagina.evaluate(() => [...document.querySelectorAll('#carrusel model-viewer')].some(v => v.autoRotate));
  assert.equal(gira, false);
  await contexto.close();
});
