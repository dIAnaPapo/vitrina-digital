// =========================================================
// resolucion.js — resolución dinámica de la AR propia (Ronda 4)
//
// Cuenta los cuadros por segundo (en ventanas de medio segundo) y decide qué parte
// de la imagen se dibuja (escala de 0,5 a 1). WebXR dibuja solo esa parte y el
// celular la estira a toda la pantalla («viewport scale»): menos píxeles = más FPS.
//   - Si los FPS bajan de 58 → baja la resolución un 10 % (rápido).
//   - Si sobran (66 FPS o más durante 2 s) → la sube un 5 % (despacio).
//     Con una pantalla de 60 Hz nunca sobran, así que se queda en la inicial.
//   - Después de bajar no vuelve a subir hasta ese nivel enseguida (evita el
//     «sube y baja»); cada 10 s sin problemas se permite intentarlo de nuevo.
//   - Si bajar la resolución no mejora los FPS (3 veces seguidas), el límite no
//     es la GPU (por ejemplo, la cámara va a 30 cuadros): vuelve a la inicial y
//     deja de ajustar.
// No usa three.js: así se prueba con node --test (pruebas/resolucion.test.mjs).
// =========================================================

export function crearResolucionDinamica({ min = 0.5, max = 1, inicial = 0.83, fpsBajo = 58, fpsAlto = 66, ventana = 500 } = {}) {
  let escala = inicial, techo = max, fija = false;
  let desde = 0, cuadros = 0, fps = 0;
  let sobraDesde = 0, techoDesde = 0, fpsAlBajar = 0, sinMejora = 0;
  const redondear = (x) => Math.round(x * 100) / 100;

  return {
    get escala() { return escala; },
    get fps() { return fps; },
    get fija() { return fija; },
    /** Se llama en cada cuadro con la hora (ms). Devuelve true si cambió la escala. */
    cuadro(ahora) {
      if (!desde) { desde = techoDesde = ahora; return false; }
      cuadros++;
      if (ahora - desde < ventana) return false;
      fps = (cuadros * 1000) / (ahora - desde);
      cuadros = 0; desde = ahora;
      if (fija) return false;

      if (fps < fpsBajo) {
        sobraDesde = 0;
        // ¿La bajada anterior no sirvió? (mejoró menos de 2 FPS)
        if (fpsAlBajar && fps < fpsAlBajar + 2) {
          if (++sinMejora >= 3) { fija = true; escala = inicial; return true; }
        } else sinMejora = 0;
        if (escala <= min) return false;
        fpsAlBajar = fps;
        techo = redondear(Math.max(min, escala - 0.05));
        techoDesde = ahora;
        escala = redondear(Math.max(min, escala - 0.1));
        return true;
      }

      fpsAlBajar = 0; sinMejora = 0;
      if (ahora - techoDesde > 10000 && techo < max) { techo = redondear(Math.min(max, techo + 0.05)); techoDesde = ahora; }
      if (fps >= fpsAlto && escala < techo) {
        sobraDesde ||= ahora;
        if (ahora - sobraDesde >= 2000) {
          escala = redondear(Math.min(techo, escala + 0.05));
          sobraDesde = ahora;
          return true;
        }
      } else sobraDesde = 0;
      return false;
    }
  };
}
