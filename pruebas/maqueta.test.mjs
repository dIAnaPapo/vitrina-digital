// =========================================================
// Pruebas de la maqueta de Arquitectura (Ronda 2 · Bloque C)
// 1. Adelanto en computadora: giro limitado, sin zoom, puntos «Disponible en…», QR.
// 2. iPhone: los puntos se leen completos en 3D (Quick Look no los muestra).
// 3. AR propia en MODO DE PRUEBA (?arprueba=1, sin cámara): tutorial, colocar,
//    girar con un dedo, botones, «Ver interior», escala 1:1, doble toque, salir.
// 4. Ficha: etiqueta «Proyecto de ejemplo», créditos y visor de planos con zoom.
// Correr: cd pruebas → npm test
// =========================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { levantarServidor } from './servidor.mjs';

let servidor, navegador;
const captura = (nombre) => new URL(`./capturas/${nombre}`, import.meta.url).pathname.slice(1);
const ID = 'casa-moderna';

before(async () => {
  servidor = await levantarServidor();
  navegador = await chromium.launch({ channel: 'chrome' });
  await mkdir(new URL('./capturas/', import.meta.url), { recursive: true });
});
after(async () => { await navegador?.close(); servidor?.cerrar(); });

async function abrir(ruta, opciones = { viewport: { width: 1440, height: 900 } }) {
  const contexto = await navegador.newContext(opciones);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.goto(servidor.url + ruta);
  await pagina.waitForFunction(() => document.getElementById('visor')?.loaded, null, { timeout: 60000 });
  return { pagina, contexto, errores };
}

test('adelanto en computadora: limitado, puntos «Disponible en…» y QR a la URL pública', async () => {
  const { pagina, contexto, errores } = await abrir(`ar.html?id=${ID}`);
  const attrs = await pagina.evaluate(() => {
    const v = document.getElementById('visor');
    return { min: v.getAttribute('min-camera-orbit'), max: v.getAttribute('max-camera-orbit'), zoom: v.hasAttribute('disable-zoom'), pan: v.hasAttribute('disable-pan'), gira: v.hasAttribute('auto-rotate') };
  });
  assert.equal(attrs.min, '-15deg 62deg auto');
  assert.equal(attrs.max, '65deg 62deg auto');
  assert.ok(attrs.zoom && attrs.pan && attrs.gira);
  assert.equal(await pagina.locator('#abrir-asistente').isHidden(), true, 'el asistente aparece recién en la AR');
  await pagina.locator('#visor .punto').first().click({ force: true });
  assert.match(await pagina.locator('#info-texto').textContent(), /Disponible en «Ver en mi espacio»/);
  await pagina.locator('#ar-qr svg').waitFor({ timeout: 15000 });
  const png = PNG.sync.read(await pagina.locator('#ar-qr-codigo').screenshot());
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
    `https://dianapapo.github.io/vitrina-digital/ar.html?id=${ID}&src=qr`);
  await pagina.screenshot({ path: captura('maqueta-monitor-adelanto.png') });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('iPhone: los puntos se leen completos en la vista 3D', async () => {
  const { pagina, contexto, errores } = await abrir(`ar.html?id=${ID}`, {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
  });
  await pagina.evaluate(() => window.vitrina.abrirPunto('sala'));
  assert.match(await pagina.locator('#info-texto').textContent(), /muro cortina/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('AR propia (modo de prueba): tutorial, colocar, gestos, botones, interior, 1:1 y salir', async () => {
  const { pagina, contexto, errores } = await abrir(`ar.html?id=${ID}&arprueba=1`, {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
  });
  await pagina.waitForFunction(() => window.vitrina?.arPropia, null, { timeout: 30000 });
  await pagina.locator('#ver-en-mi-espacio').click();
  await pagina.locator('#capa-ar').waitFor({ state: 'visible' });
  const e = () => pagina.evaluate(() => window.vitrina.arPropia.estado());

  // Tutorial: aparece siempre, paso 1
  assert.equal(await pagina.locator('#ar-tutorial').isVisible(), true);
  assert.match(await pagina.locator('.ar-tutorial-paso:not([hidden]) p').textContent(), /Mueve el celular/);
  await pagina.screenshot({ path: captura('maqueta-ar-1-tutorial.png') });
  await pagina.click('[data-ar="ocultar-tutorial"]');
  assert.equal(await pagina.locator('#ar-tutorial').isHidden(), true);

  // Colocar con un toque
  await pagina.waitForTimeout(400);
  await pagina.mouse.click(195, 420);
  await pagina.waitForTimeout(600);
  assert.equal((await e()).colocada, true);
  assert.equal((await e()).visible, true);
  await pagina.screenshot({ path: captura('maqueta-ar-2-colocada.png') });

  // Un dedo arrastrando = girar
  const giro0 = (await e()).giro;
  await pagina.mouse.move(120, 420); await pagina.mouse.down();
  await pagina.mouse.move(280, 420, { steps: 8 }); await pagina.mouse.up();
  assert.ok(Math.abs((await e()).giro - giro0) > 0.5, 'arrastrar con un dedo debe girar la maqueta');

  // Botones: girar 45°, tamaño
  const giro1 = (await e()).giro;
  await pagina.click('[data-ar="izquierda"]');
  assert.ok(Math.abs((await e()).giro - giro1 - Math.PI / 4) < 1e-6);
  await pagina.click('[data-ar="mas"]');
  assert.ok(Math.abs((await e()).escala - 1.25) < 1e-6);

  // Ver interior: completa → sin cubierta → solo planta baja → completa
  await pagina.click('[data-ar="interior"]');
  assert.equal(await pagina.locator('#ar-interior .ar-boton-texto').textContent(), 'Sin techo');
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: captura('maqueta-ar-3-sin-cubierta.png') });
  await pagina.click('[data-ar="interior"]');
  assert.equal(await pagina.locator('#ar-interior .ar-boton-texto').textContent(), 'Planta baja');
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: captura('maqueta-ar-4-planta-baja.png') });
  await pagina.click('[data-ar="interior"]');
  assert.equal((await e()).nivelInterior, 0);

  // Doble toque = tamaño y posición iniciales
  await pagina.mouse.dblclick(195, 300);
  await pagina.waitForTimeout(300);
  assert.equal((await e()).escala, 1);

  // Un punto abre su tarjeta DENTRO de la AR
  await pagina.locator('#ar-puntos .punto:not([hidden])').first().click({ force: true });
  assert.equal(await pagina.locator('#capa-ar #tarjeta-info').isVisible(), true);
  await pagina.click('#cerrar-info');

  // Escala real 1:1: hay que volver a colocar
  await pagina.click('[data-ar="real"]');
  assert.equal((await e()).colocada, false);
  assert.match(await pagina.locator('#ar-estado').textContent(), /piso|Escala real/);
  await pagina.mouse.click(195, 420);
  await pagina.waitForTimeout(300);
  assert.equal((await e()).escala, 25);
  await pagina.click('[data-ar="maqueta"]');

  // ? vuelve a mostrar el tutorial
  await pagina.click('[data-ar="ayuda"]');
  assert.equal(await pagina.locator('#ar-tutorial').isVisible(), true);

  // Salir: todo vuelve a su lugar
  await pagina.click('[data-ar="salir"]');
  assert.equal(await pagina.locator('#capa-ar').isHidden(), true);
  assert.equal(await pagina.evaluate(() => document.getElementById('tarjeta-info').parentElement.id), 'visor');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('ficha: «Proyecto de ejemplo», créditos CC BY y visor de planos con zoom', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto(servidor.url + `proyecto.html?id=${ID}`);
  await pagina.locator('.planos-lista').waitFor();
  assert.equal(await pagina.locator('#sello-ejemplo').isVisible(), true);
  const credito = (await pagina.locator('.credito-modelo').textContent()).replace(/\s+/g, ' ');
  assert.match(credito, /Modelo 3D original: Modern Home por Ciolan-T\. Sebastian \(Sketchfab\), licencia CC BY 4\.0/);
  assert.match(credito, /Adaptación del modelo: Diana Espinoza/);
  assert.equal(await pagina.locator('.plano').count(), 9);
  await pagina.locator('.plano').nth(6).click();
  await pagina.locator('.visor-planos').waitFor({ state: 'visible' });
  await pagina.click('[data-accion="acercar"]');
  const transform = await pagina.locator('.visor-planos img').evaluate(i => i.style.transform);
  assert.match(transform, /scale\(1\.5\)/);
  await pagina.screenshot({ path: captura('ficha-casa-visor-plano.png') });
  await pagina.keyboard.press('Escape');
  assert.equal(await pagina.locator('.visor-planos').isHidden(), true);
  assert.deepEqual(errores, []);
  await contexto.close();
});
