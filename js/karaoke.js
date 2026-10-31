// =========================================================
// karaoke.js — la letra aparece PALABRA POR PALABRA al ritmo del video
//
// 1. cargarCues(url): lee el archivo .vtt (subtítulos) y devuelve las líneas
//    con su inicio y fin en segundos y su identificador (verso1-1, coro-3…).
// 2. crearKaraoke(...): en cada cuadro mira video.currentTime y:
//      - muestra la línea activa; cada palabra aparece (fundido + leve subida)
//        repartida a lo largo de la duración de la línea;
//      - deja la línea anterior arriba, más tenue (máximo 2 líneas);
//      - pone la etiqueta de la sección (VERSO 1, PRE-CORO, CORO…);
//      - los cues «credito-*» y «titulo» se ven con estilo de créditos.
// Con «reducir movimiento» activado en el celular, la línea aparece entera.
// =========================================================

/** "00:01:07.100" o "01:07.100" → segundos */
function aSegundos(texto) {
  const partes = texto.trim().split(':').map(Number);
  return partes.reduce((total, p) => total * 60 + p, 0);
}

/** Lee un archivo WebVTT y devuelve [{ id, inicio, fin, texto }] */
export async function cargarCues(url) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${url}`);
  const bloques = (await respuesta.text()).replace(/\r/g, '').split(/\n{2,}/);
  const cues = [];
  for (const bloque of bloques) {
    const lineas = bloque.split('\n').filter(Boolean);
    const i = lineas.findIndex(l => l.includes('-->'));
    if (i === -1) continue;                         // cabecera WEBVTT o NOTE
    const [inicio, fin] = lineas[i].split('-->').map(t => aSegundos(t.trim().split(' ')[0]));
    cues.push({ id: i > 0 ? lineas[i - 1].trim() : '', inicio, fin, texto: lineas.slice(i + 1).join(' ') });
  }
  return cues.sort((a, b) => a.inicio - b.inicio);
}

const NOMBRES = { verso: 'Verso', precoro: 'Pre-coro', coro: 'Coro', puente: 'Puente', intro: 'Intro', final: 'Final' };

/** Del identificador del cue saca la sección: "verso2-3" → "Verso 2", "credito-1" → "Créditos" */
function seccionDe(id = '') {
  if (esCredito(id)) return id.startsWith('titulo') ? 'Título' : 'Créditos';
  const m = id.match(/^([a-z]+?)(\d*)-/i);
  if (!m) return '';
  const nombre = NOMBRES[m[1].toLowerCase()] ?? m[1];
  return m[2] ? `${nombre} ${m[2]}` : nombre;
}

function esCredito(id = '') { return /^(credito|titulo)/i.test(id); }

/**
 * @param {HTMLVideoElement} video
 * @param {Array} cues            lo que devuelve cargarCues()
 * @param {HTMLElement} contenedor  el bloque .karaoke (tiene .karaoke-seccion, .anterior y .actual)
 */
export function crearKaraoke(video, cues, contenedor) {
  const etiqueta = contenedor.querySelector('.karaoke-seccion');
  const lineaAnterior = contenedor.querySelector('.anterior');
  const lineaActual = contenedor.querySelector('.actual');
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

  let indice = -2;          // cue que se está mostrando (-1 = ninguno)
  let palabras = [];        // [{ span, momento }]
  let visible = true;
  let cuadro = 0;

  /** Arma la línea activa: un <span> por palabra con el momento en que debe aparecer. */
  function pintarLinea(cue) {
    lineaActual.textContent = '';
    palabras = [];
    if (!cue) return;
    const trozos = cue.texto.split(/\s+/).filter(Boolean);
    // Las palabras largas tardan más en cantarse: el tiempo se reparte según su largo.
    const pesos = trozos.map(p => p.length + 1);
    const total = pesos.reduce((a, b) => a + b, 0);
    const duracion = (cue.fin - cue.inicio) * 0.85;   // al 85 % del cue la línea ya está completa
    let acumulado = 0;
    trozos.forEach((texto, i) => {
      const span = document.createElement('span');
      span.className = 'palabra';
      span.textContent = texto;
      lineaActual.append(span, i < trozos.length - 1 ? ' ' : '');
      palabras.push({ span, momento: cue.inicio + duracion * (acumulado / total) });
      acumulado += pesos[i];
    });
  }

  function actualizar() {
    const t = video.currentTime;
    // Cue activo = el último que ya empezó. Después del último, la letra se va a los 1,5 s.
    let nuevo = -1;
    for (let i = 0; i < cues.length; i++) if (cues[i].inicio <= t) nuevo = i;
    if (nuevo === cues.length - 1 && t > cues[nuevo].fin + 1.5) nuevo = -1;

    if (nuevo !== indice) {
      indice = nuevo;
      const cue = cues[indice];
      const previo = cues[indice - 1];
      pintarLinea(cue);
      // Línea anterior (tenue). No se mezclan créditos con la letra.
      lineaAnterior.textContent = cue && previo && esCredito(previo.id) === esCredito(cue.id) ? previo.texto : '';
      etiqueta.textContent = cue ? seccionDe(cue.id) : '';
      etiqueta.hidden = !cue || !etiqueta.textContent;
      contenedor.classList.toggle('es-credito', !!cue && esCredito(cue.id));
    }
    const todas = sinMovimiento.matches;
    for (const p of palabras) p.span.classList.toggle('visible', todas || t >= p.momento);
  }

  function bucle() {
    actualizar();
    cuadro = requestAnimationFrame(bucle);
  }

  function mostrar(si) {
    visible = si;
    contenedor.hidden = !si;
    cancelAnimationFrame(cuadro);
    if (si) { indice = -2; bucle(); }
  }

  mostrar(true);
  return { mostrar, get visible() { return visible; } };
}
