// =========================================================
// cine-360.js — modo 360° «cine curvo» del video (Ronda 2 · B2)
//
// El video NO es 360°, así que no se estira en una esfera:
//   - una PANTALLA CURVA gigante enfrente (~140°, como un IMAX) con el video
//     sin deformar (el largo del arco y el alto guardan la proporción 16:9),
//   - un DOMO con los rayos de colores del video, que giran despacio,
//   - un anillo de SILUETAS DE CIUDAD con ventanas encendidas,
//   - CONFETI de colores flotando.
// Se mira como «ventana mágica»: girando el celular (giroscopio) o
// arrastrando con el dedo o el mouse. Usa el MISMO <video> (no se reinicia).
// three.js se descarga solo cuando alguien abre este modo.
// =========================================================

const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

// Colores del universo del video (amarillo, rojo, verde, celeste, azul, naranja)
const PALETA = ['#FFD60A', '#E63946', '#7ED321', '#2EC4F1', '#1D5FD1', '#FF8C1A'];

/**
 * Pide permiso para el giroscopio. En iPhone es OBLIGATORIO hacerlo dentro de un toque:
 * por eso se llama al comienzo del clic, antes de cualquier espera.
 * @returns {Promise<boolean>} true si se puede usar el giroscopio
 */
export function pedirPermisoGiroscopio() {
  const D = window.DeviceOrientationEvent;
  if (!D) return Promise.resolve(false);
  if (typeof D.requestPermission === 'function') {
    return D.requestPermission().then(r => r === 'granted').catch(() => false);
  }
  return Promise.resolve(true);
}

/**
 * Crea la escena 360° dentro de «anfitrion» y la empieza a dibujar.
 * @returns {Promise<{ destruir: Function, usaGiroscopio: () => boolean }>}
 */
export async function crearEscena360(anfitrion, video, { permisoGiroscopio = false } = {}) {
  const THREE = await import(URL_THREE);
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Motor ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  anfitrion.append(renderer.domElement);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(75, 1, 0.1, 200);
  camara.rotation.order = 'YXZ';
  const desechables = [];   // todo lo que hay que liberar al salir
  const guardar = (...cosas) => { desechables.push(...cosas); return cosas[0]; };

  // ---------- 1. Pantalla curva ----------
  // 120° a 10 m: envuelve, pero desde el centro se alcanzan a ver sus bordes y el entorno
  const RADIO = 10;
  const ARCO = THREE.MathUtils.degToRad(120);
  const LARGO = RADIO * ARCO;                 // largo del arco
  const ALTO = LARGO * 9 / 16;                // 16:9 → el video no se deforma
  const CENTRO_Y = 1.2;
  function superficieCurva(radio, arco, alto, segmentos = 96) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segmentos; i++) {
      const a = -arco / 2 + (i / segmentos) * arco;          // de izquierda a derecha
      const x = radio * Math.sin(a), z = -radio * Math.cos(a);
      pos.push(x, CENTRO_Y - alto / 2, z, x, CENTRO_Y + alto / 2, z);
      uv.push(i / segmentos, 0, i / segmentos, 1);           // v = 1 arriba (textura de video)
      if (i < segmentos) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  const texturaVideo = guardar(new THREE.VideoTexture(video));
  texturaVideo.colorSpace = THREE.SRGBColorSpace;
  const pantalla = new THREE.Mesh(
    guardar(superficieCurva(RADIO, ARCO, ALTO)),
    guardar(new THREE.MeshBasicMaterial({ map: texturaVideo, side: THREE.DoubleSide }))
  );
  // Un borde de luz detrás de la pantalla
  const borde = new THREE.Mesh(
    guardar(superficieCurva(RADIO + 0.08, ARCO * 1.035, ALTO * 1.06)),
    guardar(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide }))
  );
  escena.add(borde, pantalla);

  // ---------- 2. Domo con rayos de colores (como el fondo del video) ----------
  const paletaLineal = PALETA.map(c => new THREE.Color(c));  // THREE.Color ya queda en espacio lineal
  const domo = new THREE.Mesh(
    guardar(new THREE.SphereGeometry(80, 64, 32)),
    guardar(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTiempo: { value: 0 }, uPaleta: { value: paletaLineal } },
      vertexShader: `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTiempo;
        uniform vec3 uPaleta[6];
        varying vec3 vDir;
        void main() {
          // rayos que salen del centro de la pantalla (dirección -Z)
          vec3 eje = vec3(0.0, 0.0, -1.0);
          vec3 p = vDir - dot(vDir, eje) * eje;
          float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
          float i = mod(floor(ang * 24.0 + uTiempo * 0.25), 6.0);
          vec3 col = uPaleta[0];
          if (i > 0.5) col = uPaleta[1];
          if (i > 1.5) col = uPaleta[2];
          if (i > 2.5) col = uPaleta[3];
          if (i > 3.5) col = uPaleta[4];
          if (i > 4.5) col = uPaleta[5];
          col *= 0.55;                                            // más suave: la pantalla manda
          float suelo = smoothstep(-0.05, -0.45, vDir.y);         // abajo, un piso morado
          col = mix(col, vec3(0.045, 0.02, 0.09), suelo);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    }))
  );
  escena.add(domo);

  // ---------- 3. Siluetas de ciudad con ventanas ----------
  const aleatorio = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const EDIFICIOS = 64, SUELO = -7, DIST = 34;
  const edificios = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(1, 1, 1)), guardar(new THREE.MeshBasicMaterial({ color: '#1c1433' })), EDIFICIOS);
  const ventanas = new THREE.InstancedMesh(guardar(new THREE.PlaneGeometry(0.5, 0.7)), guardar(new THREE.MeshBasicMaterial({ color: '#FFD60A' })), EDIFICIOS * 6);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), arriba = new THREE.Vector3(0, 1, 0);
  let nVentanas = 0;
  for (let i = 0; i < EDIFICIOS; i++) {
    const ang = (i / EDIFICIOS) * Math.PI * 2 + aleatorio() * 0.04;
    const alto = 4 + aleatorio() * 12, ancho = 2 + aleatorio() * 2.5, dist = DIST + aleatorio() * 6;
    const x = Math.sin(ang) * dist, z = -Math.cos(ang) * dist;
    q.setFromAxisAngle(arriba, -ang);
    m.compose(new THREE.Vector3(x, SUELO + alto / 2, z), q, new THREE.Vector3(ancho, alto, 2));
    edificios.setMatrixAt(i, m);
    // ventanas en la cara que mira al centro
    for (let k = 0; k < 6 && aleatorio() < 0.85; k++) {
      const vx = (aleatorio() - 0.5) * (ancho - 0.8), vy = SUELO + 1 + aleatorio() * (alto - 2);
      const local = new THREE.Vector3(vx, 0, 1.02).applyQuaternion(q);   // justo delante de la cara frontal
      m.compose(new THREE.Vector3(x + local.x, vy, z + local.z), q, new THREE.Vector3(1, 1, 1));
      ventanas.setMatrixAt(nVentanas++, m);
    }
  }
  ventanas.count = nVentanas;
  escena.add(edificios, ventanas);

  // ---------- 4. Confeti ----------
  const N = 700;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 4 + aleatorio() * 24, a = aleatorio() * Math.PI * 2;
    pos.set([Math.sin(a) * r, -6 + aleatorio() * 22, -Math.cos(a) * r], i * 3);
    col.set(paletaLineal[i % paletaLineal.length].toArray(), i * 3);
    vel[i] = 0.4 + aleatorio() * 0.9;
  }
  const geoConfeti = guardar(new THREE.BufferGeometry());
  geoConfeti.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoConfeti.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const confeti = new THREE.Points(geoConfeti, guardar(new THREE.PointsMaterial({ size: 0.28, vertexColors: true })));
  escena.add(confeti);

  // ---------- Mirar alrededor: giroscopio o arrastrar ----------
  let yaw = 0, pitch = 0;                 // con dedo / mouse (radianes)
  let orientacion = null, alfa0 = null;   // datos del giroscopio
  let ultimoEvento = 0;
  const euler = new THREE.Euler(), qDispositivo = new THREE.Quaternion(), qPantalla = new THREE.Quaternion();
  const qAjuste = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));   // la cámara mira por detrás del celular
  const ejeZ = new THREE.Vector3(0, 0, 1), qYaw = new THREE.Quaternion();

  function alGirar(e) {
    if (e.alpha == null) return;
    if (alfa0 == null) alfa0 = e.alpha;   // al empezar, la persona queda mirando la pantalla
    orientacion = e;
    ultimoEvento = performance.now();
  }
  if (permisoGiroscopio) addEventListener('deviceorientation', alGirar);
  const usaGiroscopio = () => performance.now() - ultimoEvento < 1000;

  let arrastre = null;
  const lienzo = renderer.domElement;
  lienzo.style.touchAction = 'none';
  const alBajar = (e) => { arrastre = { x: e.clientX, y: e.clientY }; lienzo.setPointerCapture(e.pointerId); };
  const alMover = (e) => {
    if (!arrastre) return;
    yaw += (e.clientX - arrastre.x) * 0.005;
    if (!usaGiroscopio()) pitch = THREE.MathUtils.clamp(pitch + (e.clientY - arrastre.y) * 0.004, -1.2, 1.2);
    arrastre = { x: e.clientX, y: e.clientY };
  };
  const alSoltar = () => { arrastre = null; };
  lienzo.addEventListener('pointerdown', alBajar);
  lienzo.addEventListener('pointermove', alMover);
  lienzo.addEventListener('pointerup', alSoltar);
  lienzo.addEventListener('pointercancel', alSoltar);

  function orientarCamara() {
    if (orientacion && usaGiroscopio()) {
      const g = THREE.MathUtils.degToRad;
      const anguloPantalla = g(screen.orientation?.angle ?? window.orientation ?? 0);
      euler.set(g(orientacion.beta), g(orientacion.alpha - alfa0), -g(orientacion.gamma), 'YXZ');
      qDispositivo.setFromEuler(euler).multiply(qAjuste).multiply(qPantalla.setFromAxisAngle(ejeZ, -anguloPantalla));
      qYaw.setFromAxisAngle(arriba, yaw);
      camara.quaternion.copy(qYaw).multiply(qDispositivo);
    } else {
      camara.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  }

  // ---------- Tamaño ----------
  function ajustar() {
    const { clientWidth: w, clientHeight: h } = anfitrion;
    renderer.setSize(w, h, false);
    lienzo.style.width = '100%';
    lienzo.style.height = '100%';
    camara.aspect = w / h;
    // En celular vertical se abre más el campo de visión para ver más pantalla
    camara.fov = w < h ? 85 : 78;
    camara.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(anfitrion);
  ajustar();

  // ---------- Animación ----------
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.1);
    if (!sinMovimiento) {
      domo.material.uniforms.uTiempo.value += dt;
      const p = geoConfeti.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] -= vel[i] * dt;
        if (p[i * 3 + 1] < -6) p[i * 3 + 1] = 16;
      }
      geoConfeti.attributes.position.needsUpdate = true;
      confeti.rotation.y += dt * 0.03;
    }
    orientarCamara();
    renderer.render(escena, camara);
  });

  return {
    usaGiroscopio,
    destruir() {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      removeEventListener('deviceorientation', alGirar);
      desechables.forEach(d => d.dispose?.());
      edificios.dispose(); ventanas.dispose();
      renderer.dispose();
      lienzo.remove();
    }
  };
}
