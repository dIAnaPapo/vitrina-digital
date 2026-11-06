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
 * @param extra    función opcional que devuelve un texto más (por ejemplo, la resolución dinámica)
 */
export function crearDiagnostico(capa, renderer, perfil = '', extra = null) {
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
        `Resolución ${resolucion()}${extra ? ' · ' + extra() : ''}`,
        `Cámara ${seg(hitos.camara)} · Mesa ${seg(hitos.superficie)}`,
        `Colocada ${seg(hitos.colocada)}${hitos.manual != null ? ' (Colocar aquí)' : ''}`
      ].join('\n');
      ventana = ahora;
      cuadros = js = peor = 0;
    }
  };
}

/**
 * Para la AR de model-viewer (proyecto de video, o ?ar=clasica): no tenemos su motor 3D, así que
 * se cuentan los cuadros de la sesión WebXR envolviendo XRSession.requestAnimationFrame.
 * El panel va dentro de <model-viewer>, que es lo que se ve sobre la cámara.
 */
export function medirARDeModelViewer(visor) {
  if (typeof XRSession === 'undefined') return;
  const panel = document.createElement('pre');
  panel.className = 'ar-diagnostico';
  panel.setAttribute('aria-hidden', 'true');
  panel.hidden = true;
  visor.append(panel);
  const original = XRSession.prototype.requestAnimationFrame;
  let cuadros = 0, ventana = 0, ultimo = 0, peor = 0;
  XRSession.prototype.requestAnimationFrame = function (callback) {
    return original.call(this, (tiempo, frame) => {
      const ahora = performance.now();
      if (!ventana) { ventana = ahora; panel.hidden = false; panel.textContent = 'AR de model-viewer\nMidiendo…'; }
      if (ultimo && ahora - ultimo < 1000) peor = Math.max(peor, ahora - ultimo);
      ultimo = ahora;
      cuadros++;
      if (ahora - ventana >= 500) {
        const s = (ahora - ventana) / 1000;
        panel.textContent = `AR de model-viewer · FPS ${Math.round(cuadros / s)}\nCuadro ${(s * 1000 / cuadros).toFixed(1)} ms (peor ${Math.round(peor)})`;
        ventana = ahora; cuadros = 0; peor = 0;
      }
      callback(tiempo, frame);
    });
  };
}
