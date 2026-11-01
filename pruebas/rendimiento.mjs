// =========================================================
// rendimiento.mjs — mide la AR propia en la computadora (modo de prueba, sin cámara)
//
// Abre ar.html?id=…&arprueba=1&debug=1 con pantalla de celular (390 × 844, ×3)
// y la CPU 4 veces más lenta (para parecerse a un celular de gama media),
// coloca la maqueta, la gira con el dedo durante unos segundos y lee el panel
// de diagnóstico. La GPU de la computadora es mucho más rápida que la de un
// celular: los FPS reales hay que medirlos en el celular con ?debug=1.
//
// Uso:  cd pruebas  →  node rendimiento.mjs [id-del-proyecto]
// =========================================================
import { chromium } from 'playwright';
import { levantarServidor } from './servidor.mjs';

const id = process.argv[2] ?? 'casa-moderna';
const servidor = await levantarServidor();
const navegador = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const pagina = await contexto.newPage();
const errores = [];
pagina.on('pageerror', e => errores.push(e.message));

const cdp = await contexto.newCDPSession(pagina);
await pagina.goto(`${servidor.url}ar.html?id=${id}&arprueba=1&debug=1`);
await pagina.waitForFunction(() => window.vitrina?.arPropia && document.getElementById('visor')?.loaded, null, { timeout: 60000 });
await pagina.waitForTimeout(1500);                       // termina la precarga
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await pagina.locator('#ver-en-mi-espacio').click();
await pagina.locator('#capa-ar').waitFor({ state: 'visible' });
await pagina.click('[data-ar="ocultar-tutorial"]');
await pagina.waitForTimeout(500);
await pagina.mouse.click(195, 420);                      // colocar

// Girar con un dedo durante ~4 s (lo que más hace la persona)
const inicio = Date.now();
while (Date.now() - inicio < 4000) {
  await pagina.mouse.move(120, 420); await pagina.mouse.down();
  await pagina.mouse.move(280, 420, { steps: 20 }); await pagina.mouse.up();
}
await pagina.waitForTimeout(700);
const panel = await pagina.locator('.ar-diagnostico').textContent();
console.log(`\n== ${id} (CPU ×4, 390 × 844 @3x) ==\n${panel}`);
if (errores.length) console.log('Errores:', errores);

await navegador.close();
servidor.cerrar();
