// =========================================================
// ar-video.js — «VER EN AR» de un proyecto con video (Multimedia)
//
// La AR es una pantalla de cine (modelos/pantalla-cine.glb) sobre la mesa
// que REPRODUCE el video con su audio, y la letra aparece palabra por palabra.
//
// Idea clave: hay UN SOLO <video>. Lo crea model-viewer con createVideoTexture()
// y nosotros lo controlamos (play, pausa, sonido, progreso). Ese mismo video:
//   - se pinta como textura en la pantalla 3D (y dentro de la AR en Android),
//   - suena (así el audio sigue igual al entrar y salir de la AR, sin duplicados),
//   - y en iPhone / celulares sin WebXR se muestra a pantalla completa
//     en un reproductor propio de la página, con la misma letra y botones.
// =========================================================

import { cargarCues, crearKaraoke } from './karaoke.js';
import { registrar } from './metricas.js';

const PREFERENCIA_LETRA = 'vitrina:letra';
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const $ = (id) => document.getElementById(id);

export async function iniciarCine(visor, proyecto) {
  document.body.classList.add('modo-video');
  const cine = $('cine');
  const estacionamiento = $('video-estacionamiento');
  const completo = $('cine-completo');
  cine.hidden = false;

  // ---------- 1. Video como textura de la pantalla ----------
  if (!visor.loaded) await new Promise(r => visor.addEventListener('load', r, { once: true }));
  const material = visor.model.getMaterialByName('pantalla');
  const textura = visor.createVideoTexture(proyecto.video);
  material.pbrMetallicRoughness.baseColorTexture.setTexture(textura);
  const video = textura.source.element;     // el <video> que creó model-viewer
  video.loop = false;
  video.preload = 'auto';
  video.setAttribute('aria-label', `Video del proyecto ${proyecto.titulo}`);
  // Lo dejamos dentro de la página (invisible) para poder moverlo a pantalla completa sin que se pause.
  estacionamiento.append(video);

  // model-viewer lo arranca solo y en silencio. Esperamos a que arranque y lo
  // detenemos en el primer cuadro: así la pantalla no queda en blanco y no hay
  // errores en la consola. La persona decide cuándo reproducir.
  let quiereReproducir = false;
  video.addEventListener('playing', () => { if (!quiereReproducir) video.pause(); }, { once: true });

  // ---------- 2. Controles ----------
  const botonPlay = $('cine-play');
  const botonSonido = $('cine-sonido');
  const botonReiniciar = $('cine-reiniciar');
  const barra = $('cine-progreso');
  const tiempo = $('cine-tiempo');
  const botonLetra = $('cine-letra');
  const botonCompleto = $('cine-completo-abrir');
  const sonidoGrande = $('activar-sonido');

  let sonidoActivo = true;      // la persona quiere sonido (salvo que lo apague)
  let yaReproducido = false;
  let maximoVisto = 0;

  async function reproducir() {
    quiereReproducir = true;
    video.muted = !sonidoActivo;
    try {
      await video.play();
    } catch {
      // El navegador bloqueó el sonido: arrancamos en silencio y ofrecemos activarlo.
      video.muted = true;
      try { await video.play(); } catch { return; }
      sonidoGrande.hidden = false;
    }
    if (!yaReproducido) {
      yaReproducido = true;
      registrar('video_reproducido', { proyecto: proyecto.id, porcentaje: porcentajeVisto() });
    }
    actualizarBotones();
  }

  botonPlay.addEventListener('click', () => (video.paused ? reproducir() : video.pause()));
  botonReiniciar.addEventListener('click', () => { video.currentTime = 0; reproducir(); });
  botonSonido.addEventListener('click', () => {
    sonidoActivo = video.muted;           // si estaba en silencio, ahora suena
    video.muted = !sonidoActivo;
    sonidoGrande.hidden = true;
    actualizarBotones();
  });
  sonidoGrande.addEventListener('click', () => {
    sonidoActivo = true;
    video.muted = false;
    sonidoGrande.hidden = true;
    if (video.paused) reproducir();
    actualizarBotones();
  });

  barra.addEventListener('input', () => {
    if (video.duration) video.currentTime = (barra.value / 1000) * video.duration;
  });

  ['play', 'pause', 'volumechange', 'ended'].forEach(ev => video.addEventListener(ev, actualizarBotones));
  video.addEventListener('timeupdate', actualizarProgreso);
  video.addEventListener('loadedmetadata', actualizarProgreso);
  video.addEventListener('ended', () => {
    registrar('video_completado', { proyecto: proyecto.id, porcentaje: 100 });
  });

  function porcentajeVisto() {
    return video.duration ? Math.round((maximoVisto / video.duration) * 100) : 0;
  }

  function reloj(s) {
    if (!Number.isFinite(s)) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function actualizarProgreso() {
    maximoVisto = Math.max(maximoVisto, video.currentTime);
    const d = video.duration || 0;
    barra.value = d ? Math.round((video.currentTime / d) * 1000) : 0;
    const texto = `${reloj(video.currentTime)} / ${reloj(d)}`;
    tiempo.textContent = texto;
    barra.setAttribute('aria-valuetext', texto.replace(' / ', ' de '));
  }

  function actualizarBotones() {
    const pausado = video.paused || video.ended;
    botonPlay.setAttribute('aria-label', pausado ? 'Reproducir' : 'Pausar');
    botonPlay.dataset.estado = pausado ? 'pausado' : 'reproduciendo';
    botonSonido.setAttribute('aria-pressed', String(!video.muted));
    botonSonido.setAttribute('aria-label', video.muted ? 'Activar sonido' : 'Silenciar');
    botonSonido.dataset.estado = video.muted ? 'silencio' : 'sonido';
  }
  actualizarBotones();
  actualizarProgreso();

  // ---------- 3. Letra sincronizada ----------
  let karaoke = null;
  try {
    const cues = await cargarCues(proyecto.subtitulos);
    karaoke = crearKaraoke(video, cues, $('karaoke'));
  } catch (e) {
    console.warn('No se pudo cargar la letra', e);
    botonLetra.hidden = true;
  }

  function ponerLetra(mostrar, guardar) {
    karaoke?.mostrar(mostrar);
    botonLetra.setAttribute('aria-pressed', String(mostrar));
    botonLetra.querySelector('span').textContent = mostrar ? 'Ocultar letra' : 'Mostrar letra';
    if (guardar) {
      try { localStorage.setItem(PREFERENCIA_LETRA, mostrar ? 'visible' : 'oculta'); } catch { /* modo privado */ }
      registrar(mostrar ? 'letra_mostrada' : 'letra_ocultada', { proyecto: proyecto.id, segundo: Math.round(video.currentTime) });
    }
  }
  let preferencia = 'visible';
  try { preferencia = localStorage.getItem(PREFERENCIA_LETRA) ?? 'visible'; } catch { /* modo privado */ }
  if (karaoke) ponerLetra(preferencia !== 'oculta', false);
  botonLetra.addEventListener('click', () => ponerLetra(!karaoke.visible, true));

  // ---------- 4. Reproductor a pantalla completa (iPhone, Android sin WebXR, computadora) ----------
  const lugarCine = cine.parentElement;            // dentro de <model-viewer>
  let focoAnterior = null;

  function abrirCompleto() {
    focoAnterior = document.activeElement;
    $('cine-completo-video').append(video);         // el MISMO video: sigue sonando sin cortes
    $('cine-completo-cuerpo').append(cine);
    completo.hidden = false;
    document.body.classList.add('cine-abierto');
    $('cine-completo-cerrar').focus();
  }
  function cerrarCompleto() {
    estacionamiento.append(video);
    lugarCine.append(cine);
    completo.hidden = true;
    document.body.classList.remove('cine-abierto');
    focoAnterior?.focus?.();
  }
  botonCompleto.addEventListener('click', abrirCompleto);
  $('cine-completo-cerrar').addEventListener('click', cerrarCompleto);
  completo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarCompleto(); });

  // ¿Este celular puede poner la pantalla en AR (WebXR)? Si no, el botón grande
  // abre el reproductor a pantalla completa con un aviso amable.
  const sustituto = $('abrir-cine');
  const aviso = $('cine-completo-aviso');
  if (!visor.canActivateAR) {
    sustituto.hidden = false;
    if (esIOS) {
      aviso.textContent = 'En iPhone la AR de Apple (Quick Look) no reproduce video, así que lo ves aquí con su letra. La pantalla de cine sobre la mesa funciona en Android con Chrome.';
      $('aviso-sin-ar').textContent = 'En iPhone el video se ve a pantalla completa con su letra. La pantalla de cine en AR funciona en Android con Chrome.';
    } else {
      aviso.textContent = 'Este dispositivo no puede abrir la AR en el navegador, así que ves el video aquí con su letra. La pantalla de cine sobre la mesa funciona en Android con Chrome.';
      $('aviso-sin-ar').textContent = 'Estás viendo la pantalla en 3D. Para ponerla sobre una mesa, abre esta página en Chrome de Android.';
    }
    sustituto.addEventListener('click', () => {
      if (esIOS) registrar('ar_iniciada', { proyecto: proyecto.id, modo: 'pantalla-completa-ios' });
      abrirCompleto();
      if (video.paused) reproducir();
    });
  }

  // En WebXR, tocar los controles NO debe mover la pantalla.
  [cine, sonidoGrande].forEach(el => el.addEventListener('beforexrselect', ev => ev.preventDefault()));

  // Para pruebas desde la consola
  window.vitrina = { ...(window.vitrina ?? {}), video, abrirCompleto, cerrarCompleto };
}
