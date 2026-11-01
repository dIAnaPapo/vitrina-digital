// =========================================================
// diagnostico.js — modo diagnóstico de la AR propia (solo con ?debug=1)
//
// Muestra en pantalla, encima de la cámara:
//   FPS · tiempo por cuadro (y el peor) · tiempo de JavaScript por cuadro
//   llamadas de dibujo · triángulos · memoria · resolución de la AR
//   segundos (desde el toque en «Ver en mi espacio») hasta ver la cámara,
//   detectar la mesa y colocar la maqueta
// El texto se actualiza 2 veces por segundo (no en cada cuadro) para no
// cambiar lo que se está midiendo.
// =========================================================

/** ¿La dirección pide el modo diagnóstico? */
export const diagnosticoActivo = () => new URLSearchParams(location.search).get('debug') === '1';

/**
 * @param capa     elemento donde se muestra el panel (la capa HTML de la AR)
 * @param renderer el WebGLRenderer de three.js
 * @param perfil   texto corto que identifica la versión medida
 */
export function crearDiagnostico(capa, renderer, perfil = '') {
  const panel = document.createElement('pre');
  panel.className = 'ar-diagnostico';
  panel.setAttribute('aria-hidden', 'true');
  panel.textContent = `${perfil}
Midiendo…`;
  capa.append(panel);

  let inicio = performance.now(), ventana = inicio, ultimo = 0;
  let cuadros = 0, js = 0, peor = 0;
  let hitos = {};
  const seg = (t) => (t == null ? '—' : `${t.toFixed(1)} s`);

  function resolucion() {
    const l = renderer.xr.isPresenting ? renderer.xr.getBaseLayer() : null;
    const w = l ? (l.framebufferWidth ?? l.textureWidth) : renderer.domElement.width;
    const h = l ? (l.framebufferHeight ?? l.textureHeight) : renderer.domElement.height;
    return `${w}×${h}`;
  }

  return {
    /** Se llama al tocar «Ver en mi espacio»: desde aquí se cuentan los segundos */
    empezar(desde = performance.now()) { inicio = desde; ventana = performance.now(); ultimo = 0; cuadros = js = peor = 0; hitos = {}; },
    /** Marca la primera vez que pasa algo ('camara', 'superficie', 'colocada', 'manual') */
    hito(nombre) { hitos[nombre] ??= (performance.now() - inicio) / 1000; },
    /** Se llama al final de cada cuadro con los ms de JavaScript que tomó */
    cuadro(msJS) {
      const ahora = performance.now();
      if (ultimo) peor = Math.max(peor, ahora - ultimo);
      ultimo = ahora;
      cuadros++;
      js += msJS;
      if (ahora - ventana < 500) return;
      const s = (ahora - ventana) / 1000;
      const { render, memory } = renderer.info;
      const heap = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB JS · ` : '';
      panel.textContent = [
        `${perfil} · FPS ${Math.round(cuadros / s)}`,
        `Cuadro ${(s * 1000 / cuadros).toFixed(1)} ms (peor ${Math.round(peor)}) · JS ${(js / cuadros).toFixed(1)} ms`,
        `Llamadas ${render.calls} · Triángulos ${render.triangles}`,
        `Memoria ${heap}${memory.geometries} geom · ${memory.textures} tex`,
        `Resolución ${resolucion()}`,
        `Cámara ${seg(hitos.camara)} · Mesa ${seg(hitos.superficie)}`,
        `Colocada ${seg(hitos.colocada)}${hitos.manual != null ? ' (Colocar aquí)' : ''}`
      ].join('\n');
      ventana = ahora;
      cuadros = js = peor = 0;
    }
  };
}
