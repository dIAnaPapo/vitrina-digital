// =========================================================
// capturas.mjs — recorre las páginas en celular (390 px) y monitor (1440 px)
//
// Para cada página: revisa que no haya errores en la consola ni scroll
// horizontal, y guarda una captura en pruebas/capturas/.
// Correr:  cd pruebas  →  node capturas.mjs        (o: node capturas.mjs index.html)
// =========================================================
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { levantarServidor } from './servidor.mjs';

const PAGINAS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'index.html', 'carrera.html?c=arquitectura', 'carrera.html?c=multimedia',
  'proyecto.html?id=casa-moderna', 'proyecto.html?id=cuentos-y-espias',
  ...['oficina', 'london', 'deliveryrush', 'cafeteria'].flatMap(id => [`proyecto.html?id=${id}`, `ar.html?id=${id}`]),
  'ar.html?id=casa-moderna', 'ar.html?id=cuentos-y-espias', 'placa.html'
];
const ANCHOS = [
  { nombre: 'celular', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { nombre: 'monitor', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
];

const servidor = await levantarServidor();
const navegador = await chromium.launch({ channel: 'chrome' });
await mkdir(new URL('./capturas/', import.meta.url), { recursive: true });
let fallas = 0;

for (const ancho of ANCHOS) {
  const contexto = await navegador.newContext(ancho);
  for (const ruta of PAGINAS) {
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    pagina.on('pageerror', e => errores.push(e.message));
    await pagina.goto(servidor.url + ruta, { waitUntil: 'load' });
    await pagina.waitForTimeout(ruta.startsWith('index') || ruta.startsWith('ar') ? 6000 : 2000);
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const archivo = `${ancho.nombre}-${ruta.replace(/[?=&.]/g, '_')}.png`;
    await pagina.screenshot({ path: new URL(`./capturas/${archivo}`, import.meta.url).pathname.slice(1), fullPage: !ruta.startsWith('ar'), timeout: 60000 });
    const ok = errores.length === 0 && desborde <= 0;
    if (!ok) fallas++;
    console.log(`${ok ? '✔' : '✖'} ${ancho.nombre.padEnd(8)} ${ruta.padEnd(36)} desborde ${desborde}px · errores ${errores.length}${errores.length ? ' → ' + errores.join(' | ') : ''}`);
    await pagina.close();
  }
  await contexto.close();
}
await navegador.close();
servidor.cerrar();
console.log(fallas ? `\n${fallas} página(s) con problemas` : '\nTodo bien: sin errores ni desbordes.');
process.exitCode = fallas ? 1 : 0;
