// =========================================================
// Pruebas de los 4 proyectos nuevos (Ronda 3 · Bloque F)
// 1. Ficha de cada uno: etiqueta de ejemplo, galería (planos o GDD) con visor, créditos.
// 2. AR propia en modo de prueba: colocar, puntos 1-2-3, cortes de «Ver interior»
//    y textos con «el escenario» en los proyectos de Multimedia. Guarda capturas.
// 3. Capacidad: las carreras dicen «3 proyectos» y el carrusel tiene 6 puntos.
// 4. Ronda 4: datos confirmados por el equipo, Delivery Rush a 1:12 y, en los 5 modelos,
//    cámara con near de 1 cm y pellizco de ×0,2 a ×8.
// Correr: cd pruebas → npm test
// =========================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { levantarServidor } from './servidor.mjs';

let servidor, navegador;
const captura = (nombre) => new URL(`./capturas/${nombre}`, import.meta.url).pathname.slice(1);
const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const PROYECTOS = [
  { id: 'oficina', ejemplo: true, galeria: 8, cortes: ['Sin techo', 'Planta baja'], credito: /dasy444 \(Sketchfab\), licencia Sketchfab Standard/ },
  { id: 'london', ejemplo: true, galeria: 10, cortes: ['Piso 12', 'Lobby'], credito: /99\.Miles \(Sketchfab\), licencia CC BY 4\.0/ },
  { id: 'deliveryrush', ejemplo: false, galeria: 12, documento: true, cortes: ['Sin vigas', 'Muros bajos'], escenario: true, credito: /Modelado en Blender · Desarrollado en Unreal Engine 5/ },
  { id: 'cafeteria', ejemplo: false, galeria: 0, cortes: ['Sin plafón'], escenario: true, credito: /diseños propios de la vitrina/ }
];

before(async () => {
  servidor = await levantarServidor();
  navegador = await chromium.launch({ channel: 'chrome' });
  await mkdir(new URL('./capturas/', import.meta.url), { recursive: true });
});
after(async () => { await navegador?.close(); servidor?.cerrar(); });

async function abrir(ruta, opciones = CELULAR) {
  const contexto = await navegador.newContext(opciones);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.goto(servidor.url + ruta);
  return { pagina, contexto, errores };
}

for (const pr of PROYECTOS) {
  test(`ficha de ${pr.id}: etiqueta, galería y créditos`, async () => {
    const { pagina, contexto, errores } = await abrir(`proyecto.html?id=${pr.id}`);
    await pagina.locator('.ficha-grid').waitFor();
    assert.equal(await pagina.locator('#sello-ejemplo').isVisible(), pr.ejemplo, 'etiqueta «Proyecto de ejemplo»');
    assert.match((await pagina.locator('#ficha').textContent()).replace(/\s+/g, ' '), pr.credito);
    assert.equal(await pagina.locator('.plano').count(), pr.galeria);
    if (pr.galeria) {
      assert.equal(await pagina.locator('.planos-lista').evaluate(l => l.classList.contains('documento')), !!pr.documento);
      await pagina.locator('.plano').nth(1).click();
      await pagina.locator('.visor-planos').waitFor({ state: 'visible' });
      assert.match(await pagina.locator('.visor-planos-titulo').textContent(), new RegExp(`2 de ${pr.galeria}`));
      await pagina.keyboard.press('Escape');
    }
    await pagina.screenshot({ path: captura(`ficha-${pr.id}.png`), fullPage: true });
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`AR propia de ${pr.id}: colocar, puntos y «Ver interior»`, async () => {
    const { pagina, contexto, errores } = await abrir(`ar.html?id=${pr.id}&arprueba=1`);
    await pagina.waitForFunction(() => window.vitrina?.arPropia && document.getElementById('visor')?.loaded, null, { timeout: 60000 });
    await pagina.screenshot({ path: captura(`ar-${pr.id}-adelanto.png`) });
    // Los escenarios hablan de «el escenario», no de «la maqueta»
    const textoEntrada = await pagina.locator('.entrar-ar-texto').textContent();
    assert.match(textoEntrada, pr.escenario ? /el escenario/ : /la maqueta/);
    await pagina.locator('#ver-en-mi-espacio').click();
    await pagina.locator('#capa-ar').waitFor({ state: 'visible' });
    await pagina.click('[data-ar="ocultar-tutorial"]');
    await pagina.waitForTimeout(300);
    await pagina.mouse.click(195, 420);
    await pagina.waitForTimeout(800);
    const estado = await pagina.evaluate(() => window.vitrina.arPropia.estado());
    assert.equal(estado.colocada, true);
    assert.match(await pagina.locator('#ar-estado').textContent(), pr.escenario ? /Escenario colocado/ : /Maqueta colocada/);
    assert.equal(await pagina.locator('#ar-puntos .punto').count(), 3);
    await pagina.screenshot({ path: captura(`ar-${pr.id}-colocada.png`) });
    // «Ver interior» recorre los cortes del JSON y vuelve a «Completa»
    for (const [i, nombre] of pr.cortes.entries()) {
      await pagina.click('[data-ar="interior"]');
      assert.equal(await pagina.locator('#ar-interior .ar-boton-texto').textContent(), nombre);
      await pagina.waitForTimeout(500);
      await pagina.screenshot({ path: captura(`ar-${pr.id}-corte-${i + 1}.png`) });
    }
    await pagina.click('[data-ar="interior"]');
    assert.equal((await pagina.evaluate(() => window.vitrina.arPropia.estado())).nivelInterior, 0);
    await pagina.click('[data-ar="salir"]');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('capacidad: cada carrera dice «3 proyectos» y el carrusel tiene 6 puntos', async () => {
  const { pagina, contexto, errores } = await abrir('index.html', { viewport: { width: 1440, height: 900 } });
  await pagina.locator('.carrusel-puntos button').first().waitFor();
  assert.equal(await pagina.locator('.carrusel-puntos button').count(), 6);
  const contadores = await pagina.locator('#carreras .contador').allTextContents();
  assert.deepEqual(contadores.map(t => t.trim().toLowerCase()), ['3 proyectos', '3 proyectos']);
  await contexto.close();
  for (const c of ['arquitectura', 'multimedia']) {
    const r = await abrir(`carrera.html?c=${c}`, { viewport: { width: 1440, height: 900 } });
    await r.pagina.locator('#lista-proyectos .proyecto').first().waitFor();
    assert.equal(await r.pagina.locator('#lista-proyectos .proyecto').count(), 3);
    // Monitor: las 3 tarjetas en una sola fila
    const tops = await r.pagina.locator('#lista-proyectos .proyecto').evaluateAll(t => t.map(e => Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'en monitor van 3 por fila');
    await r.pagina.screenshot({ path: captura(`carrera-${c}-1440.png`), fullPage: true });
    assert.deepEqual(r.errores, []);
    await r.contexto.close();
  }
  assert.deepEqual(errores, []);
});

test('Ronda 4: datos confirmados de Delivery Rush y la Cafetería (sin «por confirmar»)', async () => {
  for (const id of ['deliveryrush', 'cafeteria']) {
    const { pagina, contexto, errores } = await abrir(`proyecto.html?id=${id}`);
    await pagina.locator('.ficha-grid').waitFor();
    const texto = (await pagina.locator('main').textContent()).replace(/\s+/g, ' ');
    assert.match(texto, /Semestre 2 - 2026/i, `${id}: periodo`);
    assert.doesNotMatch(texto, /por confirmar|\[EJEMPLO\]/i, `${id}: sin marcas de ejemplo`);
    if (id === 'deliveryrush') {
      assert.match(texto, /originales del equipo/);
      assert.match(texto, /Escala\s*1:12/i);
    }
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});

for (const id of ['casa-moderna', 'oficina', 'london', 'deliveryrush', 'cafeteria']) {
  test(`Ronda 4 · AR de ${id}: near de 1 cm y pellizco de ×0,2 a ×8`, async () => {
    const { pagina, contexto, errores } = await abrir(`ar.html?id=${id}&arprueba=1`);
    await pagina.waitForFunction(() => window.vitrina?.arPropia && document.getElementById('visor')?.loaded, null, { timeout: 60000 });
    await pagina.locator('#ver-en-mi-espacio').click();
    await pagina.locator('#capa-ar').waitFor({ state: 'visible' });
    await pagina.click('[data-ar="ocultar-tutorial"]');
    await pagina.mouse.click(195, 420);
    await pagina.waitForFunction(() => window.vitrina.arPropia.estado().colocada);
    const e = await pagina.evaluate(() => window.vitrina.arPropia.estado());
    assert.ok(e.cerca <= 0.01, `near = ${e.cerca} m`);
    assert.deepEqual(e.zoom, [0.2, 8]);
    // «+» hasta el tope: llega a ×8 y no lo pasa
    for (let i = 0; i < 12; i++) await pagina.click('[data-ar="mas"]');
    assert.equal((await pagina.evaluate(() => window.vitrina.arPropia.estado())).escala, 8);
    await pagina.waitForTimeout(800);
    await pagina.screenshot({ path: captura(`ar-${id}-zoom-8.png`) });
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
