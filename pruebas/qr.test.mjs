// =========================================================
// Prueba del QR de la placa (Fase 4)
//
// Abre placa.html en Chrome, DECODIFICA el QR con jsQR y comprueba que
// apunta EXACTAMENTE a la URL pública con ?src=qr. Lo hace con:
//   1. el QR que se ve en la pantalla,
//   2. el PNG descargado,
//   3. el SVG descargado.
// Correr:  cd pruebas  →  npm install  →  npm test
// =========================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { levantarServidor } from './servidor.mjs';
import { URL_PUBLICA, urlDeLaPlaca } from '../js/config.js';

const ESPERADA = 'https://dianapapo.github.io/vitrina-digital/index.html?src=qr';
let servidor, navegador, pagina;
const erroresConsola = [];

/** Decodifica un PNG (Buffer) con jsQR y devuelve el texto del QR. */
function leerQR(png) {
  const { width, height, data } = PNG.sync.read(png);
  const resultado = jsQR(new Uint8ClampedArray(data), width, height);
  assert.ok(resultado, 'jsQR no encontró ningún QR en la imagen');
  return resultado.data;
}

before(async () => {
  servidor = await levantarServidor();
  // channel 'chrome' = usa el Google Chrome instalado (no hace falta descargar navegadores)
  navegador = await chromium.launch({ channel: 'chrome' });
  pagina = await navegador.newPage({ acceptDownloads: true, viewport: { width: 1000, height: 1200 } });
  pagina.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()); });
  pagina.on('pageerror', e => erroresConsola.push(e.message));
  await pagina.goto(servidor.url + 'placa.html');
  await pagina.locator('#qr svg').waitFor();
});

after(async () => {
  await navegador?.close();
  servidor?.cerrar();
});

test('config.js tiene la URL pública correcta', () => {
  assert.equal(URL_PUBLICA, 'https://dianapapo.github.io/vitrina-digital/');
  assert.equal(urlDeLaPlaca('qr'), ESPERADA);
  assert.equal(urlDeLaPlaca('nfc'), 'https://dianapapo.github.io/vitrina-digital/index.html?src=nfc');
});

test('el QR de la pantalla apunta a la URL pública (aunque la placa se abra en local)', async () => {
  assert.ok(pagina.url().startsWith('http://127.0.0.1'), 'la placa se abrió en local');
  const captura = await pagina.locator('#qr svg').screenshot();
  assert.equal(leerQR(captura), ESPERADA);
});

test('la placa muestra las direcciones del QR y del NFC', async () => {
  assert.equal(await pagina.locator('#url-qr').textContent(), ESPERADA);
  assert.equal(await pagina.locator('#url-nfc').textContent(), urlDeLaPlaca('nfc'));
});

test('el PNG descargado es de alta resolución y apunta a la URL pública', async () => {
  const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#descargar-png')]);
  assert.equal(descarga.suggestedFilename(), 'qr-vitrina-digital.png');
  const png = await readFile(await descarga.path());
  const { width } = PNG.sync.read(png);
  assert.ok(width >= 2000, `el PNG mide ${width}px (debe ser ≥ 2000px para imprenta)`);
  assert.equal(leerQR(png), ESPERADA);
});

test('el SVG descargado apunta a la URL pública', async () => {
  const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#descargar-svg')]);
  assert.equal(descarga.suggestedFilename(), 'qr-vitrina-digital.svg');
  const svg = await readFile(await descarga.path(), 'utf8');
  assert.match(svg, /^<svg[^>]+viewBox=/);
  // El SVG se dibuja en una página en blanco y se fotografía para decodificarlo
  const otra = await navegador.newPage();
  await otra.setContent(`<body style="margin:0;background:#fff">${svg.replace(/width="\d+" height="\d+"/, 'width="600" height="600"')}</body>`);
  const captura = await otra.locator('svg').screenshot();
  await otra.close();
  assert.equal(leerQR(captura), ESPERADA);
});

test('la URL del QR abre el inicio sin errores', async () => {
  const inicio = await navegador.newPage();
  const errores = [];
  inicio.on('pageerror', e => errores.push(e.message));
  await inicio.goto(servidor.url + 'index.html?src=qr');
  await inicio.locator('.carrera').first().waitFor();
  assert.equal(await inicio.locator('.carrera').count(), 2, 'deben verse las 2 carreras');
  assert.deepEqual(errores, []);
  await inicio.close();
});

test('la placa no tiene errores en la consola', () => {
  assert.deepEqual(erroresConsola, []);
});
