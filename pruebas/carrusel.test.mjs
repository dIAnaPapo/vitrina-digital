// =========================================================
// Prueba del carrusel del hero (Ronda 2 · A1)
// - avanza solo cada 8 s y precarga el siguiente
// - los puntos cambian de proyecto y el nombre lleva a la ficha
// - se pausa con el mouse encima
// - se gira con el dedo (arrastre horizontal), se pausa mientras se gira y retoma
//   4 s después de soltar; el arrastre vertical sigue moviendo la página (Ronda 4)
// - en monitor el visor ocupa todo el ancho del hero (Ronda 4)
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

/** Arrastre con el dedo (eventos táctiles reales de Chrome, respetan touch-action) */
async function arrastrarDedo(pagina, desde, hasta, { soltar = true } = {}) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const punto = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(...desde) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: punto(desde[0] + (hasta[0] - desde[0]) * i / 12, desde[1] + (hasta[1] - desde[1]) * i / 12) });
    await pagina.waitForTimeout(16);
  }
  if (soltar) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return cdp;
}

test('celular: se gira con el dedo, se pausa y retoma al soltar; el scroll vertical sigue funcionando', async () => {
  const { pagina, contexto, errores } = await abrir({ movil: true });
  const caja = await pagina.locator('#carrusel .carrusel-visor').boundingBox();
  const centro = [caja.x + caja.width / 2, caja.y + caja.height / 2];
  const giro = () => pagina.evaluate(() => document.querySelector('#carrusel model-viewer.activo').getCameraOrbit().theta);
  const antes = await giro();
  // Arrastre horizontal: gira el modelo y pausa el carrusel mientras el dedo está apoyado
  const cdp = await arrastrarDedo(pagina, [centro[0] - 120, centro[1]], [centro[0] + 120, centro[1]], { soltar: false });
  assert.ok(Math.abs((await giro()) - antes) > 0.3, 'el arrastre horizontal debe girar el modelo');
  assert.equal(await pagina.evaluate(() => window.vitrina.carrusel.pausado), true, 'pausado mientras se gira');
  assert.equal(await pagina.evaluate(() => scrollY), 0, 'el arrastre horizontal no mueve la página');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pagina.waitForTimeout(2000);
  assert.equal(await pagina.evaluate(() => window.vitrina.carrusel.pausado), true, 'sigue en pausa justo después de soltar');
  await pagina.waitForTimeout(2600);
  assert.equal(await pagina.evaluate(() => window.vitrina.carrusel.pausado), false, 'retoma unos segundos después de soltar');
  // Arrastre vertical sobre el visor: la página hace scroll
  await arrastrarDedo(pagina, [centro[0], centro[1] + 120], [centro[0], centro[1] - 160]);
  await pagina.waitForTimeout(600);
  assert.ok(await pagina.evaluate(() => scrollY) > 50, 'el arrastre vertical debe mover la página');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('monitor: el visor ocupa todo el ancho del hero, detrás de los títulos', async () => {
  const { pagina, contexto } = await abrir();
  const [hero, visor, titulo] = await Promise.all(['.hero-cuerpo', '#carrusel .carrusel-visor', '.hero h1']
    .map(s => pagina.locator(s).boundingBox()));
  assert.equal(Math.round(visor.width), Math.round(hero.width), 'visor a todo el ancho');
  assert.ok(titulo.x + titulo.width <= visor.x + visor.width && titulo.y < visor.y + visor.height, 'el título queda encima del visor');
  // El título se dibuja por encima del modelo (z-index), y el modelo se encuadra en «auto»
  const encima = await pagina.evaluate(() => {
    const h1 = document.querySelector('.hero h1').getBoundingClientRect();
    return document.elementsFromPoint(h1.x + 10, h1.y + 10).findIndex(e => e.matches('.hero h1')) <
      document.elementsFromPoint(h1.x + 10, h1.y + 10).findIndex(e => e.matches('model-viewer'));
  });
  assert.ok(encima, 'el título va por encima del visor');
  await pagina.screenshot({ path: captura('carrusel-monitor-ancho.png') });
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
