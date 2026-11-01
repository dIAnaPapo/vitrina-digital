// =========================================================
// ar-propia.js — «Ver en mi espacio» con three.js + WebXR (Android)
//
// Por qué una AR propia: en la AR de model-viewer los gestos son fijos
// (un dedo MUEVE la maqueta). Aquí los gestos son los que pidió el equipo:
//   - 1 dedo arrastrando  → girar la maqueta sobre su eje
//   - 2 dedos pellizcando → agrandar / achicar
//   - 2 dedos arrastrando → moverla sobre la mesa
//   - doble toque         → volver al tamaño y la posición de colocación
// Botones: ⟲ ⟳ girar 45° · − + tamaño · ⊙ centrar · Ver interior (cortes)
//          · «Maqueta 1:25» / «Escala real 1:1» · ✕ Salir · ? tutorial.
//
// Carga rápida: three.js y el modelo se PRECARGAN mientras la persona ve el
// adelanto 3D; la sombra es una imagen (no sombras en tiempo real).
// Red de seguridad: si algo falla al iniciar, iniciar() devuelve false y
// ar.js abre la AR de model-viewer.
// Modo de prueba (?arprueba=1): la misma experiencia sin cámara, con el mouse,
// para revisarla en la computadora.
// =========================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { diagnosticoActivo, crearDiagnostico } from './diagnostico.js';

/** ¿Este navegador puede abrir AR con WebXR? (Chrome en Android con ARCore) */
export async function soportaARPropia() {
  if (!window.isSecureContext || !navigator.xr?.isSessionSupported) return false;
  try { return await navigator.xr.isSessionSupported('immersive-ar'); } catch { return false; }
}

const $ = (sel, raiz = document) => raiz.querySelector(sel);

/**
 * @param {object} opciones
 *   proyecto      datos del proyecto (ar.modelo, ar.puntos, ar.cortes, ar.escalaNumero)
 *   capa          elemento raíz del DOM overlay (#capa-ar)
 *   compartidos   elementos de la página que se usan también dentro de la AR (tarjeta, asistente)
 *   alTocarPunto  función(id) que abre la tarjeta del punto
 *   registrar     función de métricas
 *   modoPrueba    true = sin cámara (computadora)
 */
export function crearARPropia({ proyecto, capa, compartidos = [], alTocarPunto, alEntrar = () => {}, alSalir = () => {}, registrar = () => {}, modoPrueba = false }) {
  const ESCALA_REAL = proyecto.ar.escalaNumero ?? 25;
  const cortes = proyecto.ar.cortes ?? [];
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer, escena, camaraPrueba, pivote, modelo, sombra, reticula, raycaster;
  let plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  let precarga = null;
  let diag = null;                                   // modo diagnóstico (?debug=1)
  let sesion = null, referencia = null, fuenteHit = null;
  let hayHit = false, colocada = false, tamano = 'maqueta';
  const puntoHit = new THREE.Vector3();
  const inicial = { posicion: new THREE.Vector3(), giro: 0 };
  let giroObjetivo = 0, escalaObjetivo = 1, posicionObjetivo = null;
  let nivelInterior = 0;
  let cuadroN = 0, relojAnterior = 0;
  const botonesPunto = new Map();
  const lugaresOriginales = new Map();

  const el = {
    gestos: $('#ar-gestos', capa), puntos: $('#ar-puntos', capa), estado: $('#ar-estado', capa),
    tutorial: $('#ar-tutorial', capa), interior: $('#ar-interior', capa), compartidos: $('#ar-compartidos', capa)
  };

  // ---------------------------------------------------------
  // Precarga: three.js ya está importado; aquí se baja el modelo y se arma la escena.
  // ---------------------------------------------------------
  function precargar() {
    precarga ??= (async () => {
      const gltf = await new GLTFLoader().loadAsync(proyecto.ar.modelo);
      escena = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.localClippingEnabled = true;          // para «Ver interior»
      renderer.xr.enabled = true;
      // Luz: un entorno suave calculado una sola vez + una luz direccional (sin sombras en tiempo real)
      const pmrem = new THREE.PMREMGenerator(renderer);
      escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      escena.add(new THREE.HemisphereLight(0xffffff, 0xdde8ff, 0.6));
      const sol = new THREE.DirectionalLight(0xffffff, 1.2);
      sol.position.set(1, 2, 1.5);
      escena.add(sol);

      // Maqueta dentro de un «pivote» que se mueve, gira y escala
      pivote = new THREE.Group();
      pivote.visible = false;
      modelo = gltf.scene;
      modelo.traverse(o => {
        if (o.isMesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { m.clippingPlanes = [plano]; m.side = THREE.DoubleSide; });
        }
      });
      pivote.add(modelo);
      const caja = new THREE.Box3().setFromObject(modelo);
      const tam = caja.getSize(new THREE.Vector3());
      sombra = sombraFalsa(tam.x * 1.25, tam.z * 1.7);
      pivote.add(sombra);
      escena.add(pivote);

      // Retícula: anillo + la sombra de la casa donde va a aparecer
      reticula = new THREE.Group();
      const anillo = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const centro = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x01b3e6 }));
      const fantasma = sombraFalsa(tam.x * 1.25, tam.z * 1.7, 0.6);
      fantasma.name = 'fantasma';
      reticula.add(fantasma, anillo, centro);
      reticula.visible = false;
      escena.add(reticula);

      raycaster = new THREE.Raycaster();
      crearBotonesPunto();
      // Compilar los materiales ahora (y no al abrir la cámara) para que el primer cuadro sea rápido
      camaraPrueba = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 100);
      renderer.compile(escena, camaraPrueba);
      if (diagnosticoActivo()) diag = crearDiagnostico(capa, renderer, 'Versión del Bloque C');
      return true;
    })();
    return precarga;
  }

  /** Sombra de contacto falsa: un degradado radial en una imagen (cuesta casi nada). */
  function sombraFalsa(ancho, fondo, opacidad = 0.55) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 128;
    const ctx = lienzo.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lienzo), transparent: true, opacity: opacidad, depthWrite: false }));
    m.position.y = 0.002;
    m.renderOrder = -1;
    return m;
  }

  // ---------------------------------------------------------
  // Puntos 1-2-3 (botones HTML que siguen a la maqueta)
  // ---------------------------------------------------------
  function crearBotonesPunto() {
    el.puntos.innerHTML = '';
    proyecto.ar.puntos.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'punto';
      b.dataset.id = p.id;
      b.setAttribute('aria-label', `Punto ${i + 1}: ${p.titulo}`);
      b.innerHTML = `${i + 1}<span class="punto-etiqueta" aria-hidden="true">${p.titulo}</span>`;
      b.addEventListener('click', () => { registrar('punto_tocado', { proyecto: proyecto.id, punto: p.id }); alTocarPunto(p.id); });
      el.puntos.append(b);
      botonesPunto.set(p.id, { boton: b, local: new THREE.Vector3(...p.posicion.split(' ').map(Number)) });
    });
  }

  function resaltar(id) {
    botonesPunto.forEach(({ boton }, clave) => boton.classList.toggle('activo', clave === id));
  }

  // ---------------------------------------------------------
  // Iniciar / salir
  // ---------------------------------------------------------
  async function iniciar() {
    const tocado = performance.now();
    try {
      await precargar();
      diag?.empezar(tocado);
      if (modoPrueba) {
        document.body.append(renderer.domElement);
        renderer.domElement.className = 'ar-prueba-lienzo';
        renderer.xr.enabled = false;
        hayHit = true;
        puntoHit.set(0, 0, 0);
        camaraPrueba.position.set(0, 0.6, 1.15);
        camaraPrueba.lookAt(0, 0.08, 0);
      } else {
        // La capa HTML debe estar visible ANTES de pedir la sesión: es la que WebXR dibuja sobre la cámara
        capa.hidden = false;
        sesion = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test', 'dom-overlay'],
          optionalFeatures: ['light-estimation'],
          domOverlay: { root: capa }
        });
        sesion.addEventListener('end', alTerminar);
        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(sesion);
        referencia = renderer.xr.getReferenceSpace();
        const espacioVista = await sesion.requestReferenceSpace('viewer');
        fuenteHit = await sesion.requestHitTestSource({ space: espacioVista });
      }
    } catch (e) {
      console.warn('AR propia no disponible, se usará la de model-viewer:', e);
      try { await sesion?.end(); } catch { /* ya terminada */ }
      sesion = null;
      capa.hidden = true;
      return false;
    }
    entrar();
    registrar('ar_iniciada', { proyecto: proyecto.id, modo: modoPrueba ? 'propia-prueba' : 'propia' });
    return true;
  }

  function entrar() {
    // Los elementos compartidos (tarjeta, asistente) pasan a la capa de la AR
    compartidos.forEach(n => { lugaresOriginales.set(n, [n.parentNode, n.nextSibling]); el.compartidos.append(n); });
    capa.hidden = false;
    document.body.classList.add('ar-propia-activa');
    colocada = false; pivote.visible = false; tamano = 'maqueta'; nivelInterior = 0;
    el.puntos.hidden = true;
    escalaObjetivo = 1; pivote.scale.setScalar(1);
    marcarTamano(); marcarInterior();
    mostrarEstado('Buscando superficie… Mueve el celular despacio apuntando a la mesa.');
    mostrarTutorial(0);
    relojAnterior = performance.now();
    renderer.setAnimationLoop(cuadro);
    alEntrar();
  }

  async function salir() {
    if (sesion) { try { await sesion.end(); } catch { alTerminar(); } }
    else alTerminar();
  }

  function alTerminar() {
    renderer?.setAnimationLoop(null);
    fuenteHit?.cancel?.();
    fuenteHit = null; sesion = null;
    if (modoPrueba) renderer?.domElement.remove();
    capa.hidden = true;
    document.body.classList.remove('ar-propia-activa');
    cerrarTutorial(false);
    lugaresOriginales.forEach(([padre, siguiente], n) => padre.insertBefore(n, siguiente));
    lugaresOriginales.clear();
    alSalir();
  }

  // ---------------------------------------------------------
  // Cada cuadro
  // ---------------------------------------------------------
  function camaraActual() {
    if (modoPrueba) return camaraPrueba;
    const c = renderer.xr.getCamera();
    return c.cameras?.[0] ?? c;
  }

  function cuadro(tiempo, frame) {
    const ahora = performance.now();
    if (diag && hayHit) diag.hito('superficie');
    const dt = Math.min((ahora - relojAnterior) / 1000, 0.1);
    relojAnterior = ahora;

    if (frame && fuenteHit) {
      const resultados = frame.getHitTestResults(fuenteHit);
      hayHit = resultados.length > 0;
      if (hayHit) puntoHit.setFromMatrixPosition(new THREE.Matrix4().fromArray(resultados[0].getPose(referencia).transform.matrix));
    }
    // Retícula (antes de colocar): sigue a la superficie detectada
    reticula.visible = hayHit && !colocada;
    if (reticula.visible) {
      reticula.position.copy(puntoHit);
      reticula.getObjectByName('fantasma').scale.setScalar(tamano === 'real' ? ESCALA_REAL : 1);
      if (el.estado.dataset.fase === 'buscando') mostrarEstado(tamano === 'real' ? 'Apunta al piso y toca para colocar la casa a escala real.' : 'Toca para colocar la maqueta.', 0, 'colocar');
    } else if (!hayHit && !colocada && el.estado.dataset.fase !== 'buscando') {
      mostrarEstado('Buscando superficie… Mueve el celular despacio apuntando a la mesa.');
    }

    // Animaciones suaves de giro, tamaño y posición
    const k = sinMovimiento ? 1 : Math.min(1, dt * 10);
    pivote.rotation.y += (giroObjetivo - pivote.rotation.y) * k;
    const s = pivote.scale.x + (escalaObjetivo - pivote.scale.x) * k;
    pivote.scale.setScalar(s);
    if (posicionObjetivo) {
      pivote.position.lerp(posicionObjetivo, k);
      if (pivote.position.distanceTo(posicionObjetivo) < 0.0005) posicionObjetivo = null;
    }

    // «Ver interior»: corte horizontal a la altura elegida (en el mundo)
    const corte = nivelInterior > 0 ? cortes[nivelInterior - 1].altura : null;
    plano.constant = corte == null ? 1e6 : pivote.position.y + corte * pivote.scale.y;

    // En WebXR three.js usa la cámara del celular; la cámara que se pasa aquí solo cuenta en el modo de prueba
    renderer.render(escena, camaraPrueba);
    el.puntos.hidden = !colocada;          // los puntos aparecen recién con la maqueta colocada
    if (colocada) moverBotonesPunto();
    cuadroN++;
    diag?.cuadro(performance.now() - ahora);
  }

  const v = new THREE.Vector3(), haciaPunto = new THREE.Vector3();
  function moverBotonesPunto() {
    const camara = camaraActual();
    const { clientWidth: w, clientHeight: h } = capa;
    const revisarOcultos = cuadroN % 6 === 0;
    modelo.updateMatrixWorld();
    botonesPunto.forEach(({ boton, local }) => {
      v.copy(local).applyMatrix4(modelo.matrixWorld);
      const cortado = v.y > plano.constant + 0.0001;
      const mundo = v.clone();
      v.project(camara);
      const fuera = v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      boton.hidden = fuera || cortado;
      if (boton.hidden) return;
      boton.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      if (revisarOcultos) {
        // ¿Hay una pared entre la cámara y el punto? → se ve más tenue
        const origen = new THREE.Vector3().setFromMatrixPosition(camara.matrixWorld);
        haciaPunto.subVectors(mundo, origen);
        const distancia = haciaPunto.length();
        raycaster.set(origen, haciaPunto.normalize());
        raycaster.far = distancia;
        const golpe = raycaster.intersectObject(modelo, true).find(g => g.point.y <= plano.constant);
        boton.toggleAttribute('data-visible', !golpe || golpe.distance > distancia - 0.004 * pivote.scale.x);
      }
    });
  }

  // ---------------------------------------------------------
  // Colocar y restablecer
  // ---------------------------------------------------------
  function colocar() {
    const camara = camaraActual();
    const posCam = new THREE.Vector3().setFromMatrixPosition(camara.matrixWorld);
    pivote.position.copy(puntoHit);
    // La fachada (lado +Z de la maqueta) queda mirando a la persona
    giroObjetivo = Math.atan2(posCam.x - puntoHit.x, posCam.z - puntoHit.z);
    pivote.rotation.y = giroObjetivo;
    escalaObjetivo = tamano === 'real' ? ESCALA_REAL : 1;
    pivote.scale.setScalar(escalaObjetivo);
    pivote.visible = true;
    colocada = true;
    diag?.hito('colocada');
    inicial.posicion.copy(pivote.position);
    inicial.giro = giroObjetivo;
    mostrarEstado(tamano === 'real' ? 'Casa colocada a escala real. Camina para recorrerla.' : 'Maqueta colocada. Gira con un dedo, pellizca para el tamaño y acércate para ver los detalles.', 4000);
    registrar('ar_colocada', { proyecto: proyecto.id, modo: tamano });
    if (el.tutorial.dataset.paso !== undefined && !el.tutorial.hidden && Number(el.tutorial.dataset.paso) < 2) mostrarTutorial(2);
  }

  function restablecer() {
    if (!colocada) return;
    posicionObjetivo = inicial.posicion.clone();
    giroObjetivo = inicial.giro;
    escalaObjetivo = tamano === 'real' ? ESCALA_REAL : 1;
    mostrarEstado('Tamaño y posición iniciales.', 1800);
  }

  // ---------------------------------------------------------
  // Gestos (capa invisible sobre la cámara)
  // ---------------------------------------------------------
  const punteros = new Map();
  let inicioGesto = null, ultimoToque = 0;
  const ndc = new THREE.Vector2();

  /** Punto de la mesa (plano horizontal de la maqueta) bajo una posición de la pantalla */
  function puntoEnLaMesa(x, y) {
    const r = el.gestos.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camaraActual());
    raycaster.far = Infinity;
    const mesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pivote.position.y);
    return raycaster.ray.intersectPlane(mesa, new THREE.Vector3());
  }

  el.gestos.addEventListener('pointerdown', (e) => {
    el.gestos.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      inicioGesto = { t: performance.now(), x: e.clientX, y: e.clientY, movido: false };
    } else if (punteros.size === 2 && colocada) {
      const [a, b] = [...punteros.values()];
      inicioGesto = {
        ...inicioGesto, movido: true, dos: true,
        distancia: Math.hypot(a.x - b.x, a.y - b.y), escala: escalaObjetivo,
        mesa: puntoEnLaMesa((a.x + b.x) / 2, (a.y + b.y) / 2), posicion: pivote.position.clone()
      };
      posicionObjetivo = null;
    }
  });

  el.gestos.addEventListener('pointermove', (e) => {
    const previo = punteros.get(e.pointerId);
    if (!previo) return;
    const actual = { x: e.clientX, y: e.clientY };
    punteros.set(e.pointerId, actual);
    if (!colocada || !inicioGesto) return;
    if (punteros.size === 1 && !inicioGesto.dos) {
      const dx = actual.x - previo.x;
      if (Math.abs(e.clientX - inicioGesto.x) > 8) inicioGesto.movido = true;
      giroObjetivo += (dx / el.gestos.clientWidth) * Math.PI * 1.3;
      pivote.rotation.y = giroObjetivo;
    } else if (punteros.size === 2 && inicioGesto.dos) {
      const [a, b] = [...punteros.values()];
      if (tamano === 'maqueta') {
        escalaObjetivo = THREE.MathUtils.clamp(inicioGesto.escala * Math.hypot(a.x - b.x, a.y - b.y) / inicioGesto.distancia, 0.25, 4);
        pivote.scale.setScalar(escalaObjetivo);
      }
      const ahora = puntoEnLaMesa((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (ahora && inicioGesto.mesa) {
        pivote.position.x = inicioGesto.posicion.x + (ahora.x - inicioGesto.mesa.x);
        pivote.position.z = inicioGesto.posicion.z + (ahora.z - inicioGesto.mesa.z);
      }
    }
  });

  function finGesto(e) {
    punteros.delete(e.pointerId);
    if (punteros.size > 0 || !inicioGesto) return;
    const fueToque = !inicioGesto.movido && !inicioGesto.dos && performance.now() - inicioGesto.t < 350;
    inicioGesto = null;
    if (!fueToque) return;
    if (!colocada) { if (hayHit) colocar(); return; }
    const ahora = performance.now();
    if (ahora - ultimoToque < 320) { restablecer(); ultimoToque = 0; } else ultimoToque = ahora;
  }
  el.gestos.addEventListener('pointerup', finGesto);
  el.gestos.addEventListener('pointercancel', finGesto);
  // Tocar la capa de la AR nunca debe disparar el «select» de WebXR: los toques los manejamos nosotros
  capa.addEventListener('beforexrselect', (e) => e.preventDefault());

  // ---------------------------------------------------------
  // Botones
  // ---------------------------------------------------------
  capa.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-ar]')?.dataset.ar;
    if (!accion) return;
    if (accion === 'salir') salir();
    if (accion === 'ayuda') mostrarTutorial(0);
    if (accion === 'ocultar-tutorial') cerrarTutorial(true);
    if (!colocada && ['izquierda', 'derecha', 'menos', 'mas', 'interior'].includes(accion)) {
      mostrarEstado('Primero coloca la maqueta: toca la pantalla cuando veas el anillo.', 2500);
      return;
    }
    if (accion === 'izquierda') giroObjetivo += Math.PI / 4;
    if (accion === 'derecha') giroObjetivo -= Math.PI / 4;
    if (accion === 'mas' && tamano === 'maqueta') escalaObjetivo = Math.min(4, escalaObjetivo * 1.25);
    if (accion === 'menos' && tamano === 'maqueta') escalaObjetivo = Math.max(0.25, escalaObjetivo / 1.25);
    if ((accion === 'mas' || accion === 'menos') && tamano === 'real') mostrarEstado('En escala real el tamaño es fijo (1:1).', 2200);
    if (accion === 'centrar') {
      if (!colocada) return;
      if (hayHit) posicionObjetivo = puntoHit.clone();
      else mostrarEstado('Apunta a la mesa para centrar la maqueta.', 2200);
    }
    if (accion === 'interior') { nivelInterior = (nivelInterior + 1) % (cortes.length + 1); marcarInterior(); }
    if (accion === 'maqueta' || accion === 'real') cambiarTamano(accion);
  });

  function cambiarTamano(nuevo) {
    if (nuevo === tamano) return;
    tamano = nuevo;
    marcarTamano();
    // Se vuelve a colocar: en escala real conviene apuntar al piso, no a la mesa
    colocada = false;
    pivote.visible = false;
    escalaObjetivo = tamano === 'real' ? ESCALA_REAL : 1;
    mostrarEstado(tamano === 'real' ? 'Escala real 1:1 (la casa mide 14,8 m). Apunta al piso y toca para colocarla.' : 'Maqueta 1:25. Apunta a la mesa y toca para colocarla.', 0, 'buscando');
  }

  function marcarTamano() {
    capa.querySelectorAll('[data-ar="maqueta"], [data-ar="real"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ar === tamano)));
  }
  function marcarInterior() {
    const nombres = ['Completa', ...cortes.map(c => c.nombre)];
    el.interior.querySelector('.ar-boton-texto').textContent = nombres[nivelInterior];
    el.interior.setAttribute('aria-label', `Ver interior: ${nombres[nivelInterior]}`);
    el.interior.setAttribute('aria-pressed', String(nivelInterior > 0));
  }

  // ---------------------------------------------------------
  // Mensaje de estado
  // ---------------------------------------------------------
  let temporizadorEstado = 0;
  function mostrarEstado(texto, duracion = 0, fase) {
    clearTimeout(temporizadorEstado);
    el.estado.textContent = texto;
    el.estado.hidden = false;
    el.estado.dataset.fase = fase ?? (texto.startsWith('Buscando') ? 'buscando' : 'otro');
    if (duracion) temporizadorEstado = setTimeout(() => { el.estado.hidden = true; }, duracion);
  }

  // ---------------------------------------------------------
  // Tutorial de 3 pasos (aparece SIEMPRE al entrar)
  // ---------------------------------------------------------
  let temporizadorTutorial = 0;
  const pasos = [...el.tutorial.querySelectorAll('.ar-tutorial-paso')];
  function mostrarTutorial(paso) {
    clearTimeout(temporizadorTutorial);
    el.tutorial.hidden = false;
    el.tutorial.dataset.paso = paso;
    pasos.forEach((p, i) => { p.hidden = i !== paso; });
    el.tutorial.querySelectorAll('.ar-tutorial-puntos span').forEach((s, i) => s.classList.toggle('activo', i === paso));
    // Avanza solo cada 3 s; después del último paso se cierra solo
    temporizadorTutorial = setTimeout(() => (paso < pasos.length - 1 ? mostrarTutorial(paso + 1) : cerrarTutorial(false)), 3000);
  }
  function cerrarTutorial(porLaPersona) {
    clearTimeout(temporizadorTutorial);
    if (porLaPersona && !el.tutorial.hidden) registrar('tutorial_ocultado', { proyecto: proyecto.id, paso: Number(el.tutorial.dataset.paso) + 1 });
    el.tutorial.hidden = true;
  }
  el.tutorial.querySelector('.ar-tutorial-tarjeta').addEventListener('click', () => {
    const paso = Number(el.tutorial.dataset.paso);
    paso < pasos.length - 1 ? mostrarTutorial(paso + 1) : cerrarTutorial(false);
  });

  return {
    precargar, iniciar, salir, resaltar,
    get activa() { return !capa.hidden; },
    // Solo lectura, para las pruebas automáticas
    estado: () => ({ colocada, tamano, nivelInterior, giro: giroObjetivo, escala: escalaObjetivo, visible: !!pivote?.visible })
  };
}
