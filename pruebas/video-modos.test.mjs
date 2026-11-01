// =========================================================
// Prueba de los 3 modos del video (Ronda 2 · B2)
// Televisor → Sin televisor → 360° → salir: el video NO se reinicia ni se pausa,
// la letra y los controles siguen, y no hay errores en la consola.
// Correr: cd pruebas → npm test
// =========================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { levantarServidor } from './servidor.mjs';

let servidor, navegador;
const captura = (nombre) => new URL(`./capturas/${nombre}`, import.meta.url).pathname.slice(1);

before(async () => {
  servidor = await levantarServidor();
  navegador = await chromium.launch({ channel: 'chrome' });
  await mkdir(new URL('./capturas/', import.meta.url), { recursive: true });
});
after(async () => { await navegador?.close(); servidor?.cerrar(); });

/** Estado del video y de los materiales del televisor */
const estado = (pagina) => pagina.evaluate(() => {
  const v = window.vitrina.video, visor = document.getElementById('visor');
  const a = (n) => visor.model.getMaterialByName(n)?.pbrMetallicRoughness.baseColorFactor[3];
  return {
    t: v.currentTime, pausado: v.paused, mismoVideo: v === window.__videoInicial,
    modo: document.querySelector('#cine-modos [aria-pressed="true"]')?.dataset.modo,
    televisor: a('mueble'), pantallaTV: a('pantalla'), pantallaLibre: a('pantalla-libre'), halo: a('halo'),
    cineEn: document.getElementById('cine').parentElement.id || document.getElementById('cine').parentElement.tagName,
    capa360: !document.getElementById('cine-360').hidden,
    lienzo360: !!document.querySelector('#cine-360-escena canvas'),
    letraVisible: !document.getElementById('karaoke').hidden
  };
});

for (const dispositivo of [
  { nombre: 'monitor', opciones: { viewport: { width: 1440, height: 900 } } },
  { nombre: 'celular', opciones: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
]) {
  test(`modos del video sin reiniciar (${dispositivo.nombre})`, async () => {
    const contexto = await navegador.newContext(dispositivo.opciones);
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', e => errores.push(e.message));
    pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    await pagina.goto(servidor.url + 'ar.html?id=cuentos-y-espias');
    await pagina.waitForFunction(() => window.vitrina?.ponerModo && !document.getElementById('cine-modos').hidden, null, { timeout: 60000 });
    await pagina.evaluate(() => { window.__videoInicial = window.vitrina.video; });

    // 1. Televisor (inicial) y play
    let e = await estado(pagina);
    assert.equal(e.modo, 'televisor');
    assert.equal(e.televisor, 1);
    assert.equal(e.pantallaLibre, 0);
    await pagina.click('#cine-play');
    await pagina.waitForTimeout(2500);
    const t1 = (await estado(pagina)).t;
    assert.ok(t1 > 1, `el video debería avanzar (t=${t1})`);

    // 2. Sin televisor
    await pagina.click('#cine-modos [data-modo="sin-televisor"]');
    await pagina.waitForTimeout(1200);
    e = await estado(pagina);
    assert.equal(e.modo, 'sin-televisor');
    assert.equal(e.televisor, 0, 'el televisor debe ocultarse');
    assert.equal(e.pantallaTV, 0);
    assert.equal(e.pantallaLibre, 1, 'la pantalla sola debe verse');
    assert.equal(e.halo, 1);
    assert.equal(e.mismoVideo, true, 'debe ser el MISMO video');
    assert.equal(e.pausado, false);
    assert.ok(e.t > t1, 'el video NO debe reiniciarse');
    assert.equal(e.letraVisible, true);
    await pagina.screenshot({ path: captura(`video-${dispositivo.nombre}-sin-televisor.png`) });

    // 3. 360°
    await pagina.click('#cine-modos [data-modo="360"]');
    await pagina.waitForFunction(() => !!document.querySelector('#cine-360-escena canvas'), null, { timeout: 60000 });
    await pagina.waitForTimeout(2000);
    e = await estado(pagina);
    assert.equal(e.capa360, true);
    assert.equal(e.cineEn, 'cine-360-cuerpo', 'la letra y los controles pasan al 360°');
    assert.equal(e.mismoVideo, true);
    assert.equal(e.pausado, false);
    const t3 = e.t;
    await pagina.screenshot({ path: captura(`video-${dispositivo.nombre}-360.png`) });
    // mirar a la izquierda arrastrando
    const caja = await pagina.locator('#cine-360-escena canvas').boundingBox();
    await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 3);
    await pagina.mouse.down();
    await pagina.mouse.move(caja.x + caja.width / 2 + 300, caja.y + caja.height / 3, { steps: 10 });
    await pagina.mouse.up();
    await pagina.waitForTimeout(800);
    await pagina.screenshot({ path: captura(`video-${dispositivo.nombre}-360-girado.png`) });

    // 4. Salir del 360°: vuelve al modo anterior y el video sigue
    await pagina.click('#cine-360-salir');
    await pagina.waitForTimeout(800);
    e = await estado(pagina);
    assert.equal(e.capa360, false);
    assert.equal(e.lienzo360, false, 'la escena 360 se libera al salir');
    assert.equal(e.cineEn, 'visor', 'la letra y los controles vuelven a <model-viewer id="visor">');
    assert.equal(e.modo, 'sin-televisor');
    assert.equal(e.pausado, false);
    assert.ok(e.t > t3);

    // 5. Volver al televisor
    await pagina.click('#cine-modos [data-modo="televisor"]');
    e = await estado(pagina);
    assert.equal(e.televisor, 1);
    assert.equal(e.pantallaLibre, 0);
    assert.equal(e.mismoVideo, true);

    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
