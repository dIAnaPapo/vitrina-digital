// =========================================================
// visor-planos.js — galería de planos con visor grande (tipo lightbox)
//
// - Tocar una miniatura abre el plano en grande.
// - Zoom: pellizcar con dos dedos, rueda del mouse, botones − / + o doble toque.
// - Con el plano agrandado, se arrastra con un dedo para recorrerlo.
// - Flechas ‹ › (o las del teclado) para pasar de plano; Esc o ✕ para cerrar.
// - Accesible: es un diálogo, el foco va al botón Cerrar y vuelve a la miniatura.
// - Sirve también para documentos (por ejemplo, las páginas de un GDD): estilo "documento".
// =========================================================

const MIN = 1, MAX = 6;
const TEXTOS = {
  planos: { ampliado: 'Plano ampliado', cerrar: 'Cerrar el plano', anterior: 'Plano anterior', siguiente: 'Plano siguiente' },
  documento: { ampliado: 'Página ampliada', cerrar: 'Cerrar la página', anterior: 'Página anterior', siguiente: 'Página siguiente' }
};

export function crearVisorPlanos(planos, estilo = 'planos') {
  const t = TEXTOS[estilo] ?? TEXTOS.planos;
  const capa = document.createElement('div');
  capa.className = 'visor-planos';
  capa.hidden = true;
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', t.ampliado);
  capa.innerHTML = `
    <div class="visor-planos-barra">
      <p class="visor-planos-titulo" aria-live="polite"></p>
      <button type="button" class="visor-boton" data-accion="cerrar" aria-label="${t.cerrar}">✕</button>
    </div>
    <div class="visor-planos-lienzo"><img alt="" draggable="false"></div>
    <div class="visor-planos-controles">
      <button type="button" class="visor-boton" data-accion="anterior" aria-label="${t.anterior}">‹</button>
      <button type="button" class="visor-boton" data-accion="alejar" aria-label="Alejar">−</button>
      <button type="button" class="visor-boton" data-accion="acercar" aria-label="Acercar">+</button>
      <button type="button" class="visor-boton" data-accion="siguiente" aria-label="${t.siguiente}">›</button>
    </div>
    <p class="visor-planos-ayuda">Pellizca con dos dedos o toca dos veces para acercar</p>`;
  document.body.append(capa);

  const lienzo = capa.querySelector('.visor-planos-lienzo');
  const img = capa.querySelector('img');
  const titulo = capa.querySelector('.visor-planos-titulo');
  let actual = 0, escala = 1, x = 0, y = 0, origen = null;
  const punteros = new Map();
  let distanciaInicial = 0, escalaInicial = 1, ultimoToque = 0;

  function aplicar() {
    // No dejar que el plano se salga demasiado de la pantalla
    const r = lienzo.getBoundingClientRect();
    const limX = (r.width * (escala - 1)) / 2, limY = (r.height * (escala - 1)) / 2;
    x = Math.max(-limX, Math.min(limX, x));
    y = Math.max(-limY, Math.min(limY, y));
    img.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
  }
  function zoom(nueva) { escala = Math.max(MIN, Math.min(MAX, nueva)); if (escala === 1) { x = 0; y = 0; } aplicar(); }

  function mostrar(i) {
    actual = (i + planos.length) % planos.length;
    const p = planos[actual];
    img.src = p.src;
    img.alt = p.alt;
    titulo.textContent = `${p.titulo} · ${actual + 1} de ${planos.length}`;
    escala = 1; x = 0; y = 0; aplicar();
  }

  let volverA = null;
  function abrir(i, desde) {
    volverA = desde ?? document.activeElement;
    mostrar(i);
    capa.hidden = false;
    document.body.classList.add('visor-abierto');
    capa.querySelector('[data-accion="cerrar"]').focus();
  }
  function cerrar() {
    capa.hidden = true;
    document.body.classList.remove('visor-abierto');
    volverA?.focus?.();
  }

  capa.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'cerrar') cerrar();
    if (accion === 'anterior') mostrar(actual - 1);
    if (accion === 'siguiente') mostrar(actual + 1);
    if (accion === 'acercar') zoom(escala * 1.5);
    if (accion === 'alejar') zoom(escala / 1.5);
  });
  capa.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
    if (e.key === 'Tab') {   // el foco no se escapa del diálogo
      const botones = [...capa.querySelectorAll('button')];
      const i = botones.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); botones.at(-1).focus(); }
      else if (!e.shiftKey && i === botones.length - 1) { e.preventDefault(); botones[0].focus(); }
    }
  });
  lienzo.addEventListener('wheel', (e) => { e.preventDefault(); zoom(escala * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });

  // Gestos: un dedo arrastra (si hay zoom), dos dedos pellizcan, doble toque alterna el zoom
  lienzo.addEventListener('pointerdown', (e) => {
    lienzo.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      distanciaInicial = Math.hypot(a.x - b.x, a.y - b.y);
      escalaInicial = escala;
    } else {
      origen = { x: e.clientX - x, y: e.clientY - y };
      const ahora = performance.now();
      if (ahora - ultimoToque < 300) zoom(escala > 1 ? 1 : 2.5);
      ultimoToque = ahora;
    }
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      zoom(escalaInicial * Math.hypot(a.x - b.x, a.y - b.y) / distanciaInicial);
    } else if (escala > 1 && origen) {
      x = e.clientX - origen.x; y = e.clientY - origen.y; aplicar();
    }
  });
  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size === 1) { const [p] = punteros.values(); origen = { x: p.x - x, y: p.y - y }; }
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  return { abrir, cerrar };
}
