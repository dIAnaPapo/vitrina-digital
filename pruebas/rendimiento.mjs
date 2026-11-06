// =========================================================
// rendimiento.mjs — mide la AR propia en la computadora (modo de prueba, sin cámara)
//
// Abre ar.html?id=…&arprueba=1&debug=1 con pantalla de celular (390 × 844, ×3),
// coloca el modelo y le pide a la AR propia que dibuje 60 cuadros girándolo
// (medirCuadros), esperando a que la GPU termine cada uno, a la resolución que
// tendría en el celular (pantalla × 0,75). Mide dos casos:
//   - normal: el modelo recién colocado;
//   - de cerca: agrandado ×3, cuando llena la pantalla (lo más pesado).
// Cada caso se mide 3 veces y se usa el mejor (la computadora tiene «ruido»).
//
// --sw  dibuja con la GPU POR SOFTWARE (SwiftShader). La GPU de la computadora es
//       tanto más rápida que la de un celular que todo da «rápido»; por software
//       el costo de cada píxel y de cada transparencia pesa de verdad, y sirve para
//       comparar ANTES y DESPUÉS. Los FPS reales se miden en el celular con ?debug=1.
//
// --dinamica  compara, en la MISMA página y alternando (así el ruido afecta igual a las dos),
//       la resolución inicial de la AR (75 %) con el mínimo de la resolución dinámica (45 %).
//
// Uso:  cd pruebas  →  node rendimiento.mjs [id … | todos] [--sw] [--dinamica] [--q=tm=0&res=0.6]
// =========================================================
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { levantarServidor } from './servidor.mjs';

const args = process.argv.slice(2);
const sw = args.includes('--sw');
const compararDinamica = args.includes('--dinamica');
// --q=tm=0&transp=0 … agrega interruptores del modo diagnóstico (ver js/ar-propia.js)
const extra = args.find(a => a.startsWith('--q='))?.slice(4) ?? '';
let ids = args.filter(a => !a.startsWith('--'));
const datos = JSON.parse(await readFile(new URL('../data/proyectos.json', import.meta.url), 'utf8'));
// El proyecto de video usa la AR de model-viewer (no la AR propia): no se mide aquí
const conARPropia = datos.proyectos.filter(p => p.ar && p.tipo !== 'video').map(p => p.id);
if (!ids.length) ids = ['casa-moderna'];
if (ids.includes('todos')) ids = conARPropia;

const servidor = await levantarServidor();
const navegador = await chromium.launch({
  channel: 'chrome',
  args: sw ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist']
});

const filas = [];
for (const id of ids) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto(`${servidor.url}ar.html?id=${id}&arprueba=1&debug=1${extra ? "&" + extra : ""}`);
  await pagina.waitForFunction(() => window.vitrina?.arPropia && document.getElementById('visor')?.loaded, null, { timeout: 120000 });
  // Con la GPU por software el adelanto 3D acapara la página: todo se toca por código
  await pagina.evaluate(() => document.getElementById('ver-en-mi-espacio').click());
  await pagina.locator('#capa-ar').waitFor({ state: 'visible', timeout: 120000 });
  await pagina.evaluate(() => document.querySelector('[data-ar="ocultar-tutorial"]').click());
  await pagina.mouse.click(195, 420);                      // colocar
  await pagina.waitForFunction(() => window.vitrina.arPropia.estado().colocada, null, { timeout: 60000 });
  await pagina.waitForTimeout(500);

  // Cada caso se mide 3 veces y se queda el MEJOR: la computadora a veces está ocupada con otra cosa
  const una = (escala, res) => pagina.evaluate(([e, r]) => window.vitrina.arPropia.medirCuadros(60, e, r), [escala, res]);
  const medir = async (escala) => { let mejor = null; for (let i = 0; i < 3; i++) { const r = await una(escala); if (!mejor || r.ms < mejor.ms) mejor = r; } return mejor; };
  await una(1);                                            // calentamiento
  if (compararDinamica) {
    const mejor = { 0.75: [Infinity, Infinity], 0.45: [Infinity, Infinity] };
    for (let i = 0; i < 3; i++) for (const res of [0.75, 0.45]) for (const [k, esc] of [[0, 1], [1, 3]]) {
      mejor[res][k] = Math.min(mejor[res][k], (await una(esc, res)).ms);
    }
    filas.push({ id, mejor });
    console.log(`${id}: 75 % → ${mejor[0.75].map(m => m.toFixed(0)).join(' / ')} ms · 45 % → ${mejor[0.45].map(m => m.toFixed(0)).join(' / ')} ms (normal / de cerca)`);
    await contexto.close();
    continue;
  }
  const normal = await medir(1), cerca = await medir(3);
  if (errores.length) console.log(id, 'errores:', errores);
  filas.push({ id, normal, cerca });
  console.log(`${id}: ${normal.ms.toFixed(1)} ms · de cerca ${cerca.ms.toFixed(1)} ms · ${normal.ancho}×${normal.alto} · ${normal.llamadas} llamadas · ${normal.triangulos} triángulos`);
  await contexto.close();
}

const fps = (ms) => Math.round(1000 / ms);
if (compararDinamica) {
  console.log('\n| Proyecto | 75 % normal (ms) | 45 % normal (ms) | Ahorro | 75 % de cerca | 45 % de cerca | Ahorro |\n|---|---|---|---|---|---|---|');
  const ahorro = (a, b) => `${Math.round((1 - b / a) * 100)} %`;
  for (const { id, mejor } of filas) {
    const [a, b] = [mejor[0.75], mejor[0.45]];
    console.log(`| ${id} | ${a[0].toFixed(0)} | ${b[0].toFixed(0)} | ${ahorro(a[0], b[0])} | ${a[1].toFixed(0)} | ${b[1].toFixed(0)} | ${ahorro(a[1], b[1])} |`);
  }
  await navegador.close(); servidor.cerrar(); process.exit(0);
}
console.log(`\nGPU ${sw ? 'por software (SwiftShader)' : 'de la computadora'} · 60 cuadros girando · resolución de la AR en el celular`);
console.log('| Proyecto | ms por cuadro | «FPS» | De cerca ×3 (ms) | «FPS» de cerca | Llamadas | Triángulos |\n|---|---|---|---|---|---|---|');
for (const { id, normal, cerca } of filas) {
  console.log(`| ${id} | ${normal.ms.toFixed(1)} | ${fps(normal.ms)} | ${cerca.ms.toFixed(1)} | ${fps(cerca.ms)} | ${normal.llamadas} | ${normal.triangulos} |`);
}
await navegador.close();
servidor.cerrar();
