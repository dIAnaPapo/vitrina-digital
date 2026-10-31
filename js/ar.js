// =========================================================
// ar.js — lógica de la experiencia de realidad aumentada
//
// Qué hace, en orden:
//   1. Lee el id del proyecto de la URL y busca sus datos en el JSON.
//   2. Le pasa el modelo 3D a <model-viewer>.
//   3. Crea un botón (hotspot) por cada punto de información.
//   4. Escucha los eventos de la AR para guiar a la persona
//      («busca una superficie», «toca para colocar», etc.).
//   5. Conecta el asistente «Pregúntale a la maqueta».
//   6. Si el proyecto es un video ("tipo": "video"), carga la pantalla de cine (ar-video.js).
// =========================================================

import { cargarDatos, leerParametro } from './datos.js';
import { responder } from './asistente.js';

const visor = document.getElementById('visor');
const estado = document.getElementById('estado');
const tarjeta = document.getElementById('tarjeta-info');
const asistente = document.getElementById('asistente');
const botonAsistente = document.getElementById('abrir-asistente');

let proyecto = null;
let enAR = false;

// ---------------------------------------------------------
// 1. Datos del proyecto
// ---------------------------------------------------------
try {
  const datos = await cargarDatos();
  proyecto = datos.proyectos.find(p => p.id === leerParametro('id'));
  if (!proyecto?.ar) throw new Error('Este proyecto no tiene experiencia AR');
} catch (e) {
  document.getElementById('titulo').textContent = 'Proyecto no disponible en AR';
  visor.hidden = true;
  console.error(e);
  throw e;   // detiene el resto del script
}

const esVideo = proyecto.ar.tipo === 'video';

document.title = `${proyecto.titulo} en AR · Vitrina Digital Ecotec`;
document.getElementById('titulo').textContent = proyecto.titulo;
document.getElementById('escala').textContent = esVideo
  ? `Pantalla de cine · ${proyecto.ar.escala}`
  : `Maqueta · escala ${proyecto.ar.escala}`;
document.getElementById('volver').href = `proyecto.html?id=${encodeURIComponent(proyecto.id)}`;

// ---------------------------------------------------------
// 2. Modelo 3D
//    GLB para todos. En iPhone, model-viewer convierte el GLB a USDZ
//    automáticamente; si quieres más calidad, exporta un .usdz y ponlo en "modeloIOS".
// ---------------------------------------------------------
visor.alt = proyecto.ar.alt;
if (esVideo) {
  // Solo WebXR: es la única AR que puede reproducir el video dentro de la cámara.
  // (Scene Viewer y Quick Look mostrarían una pantalla quieta, sin video ni sonido.)
  visor.setAttribute('ar-modes', 'webxr');
  visor.setAttribute('camera-orbit', '0deg 80deg auto');
}
// Vista inicial del visor 3D (opcional): "ángulo horizontal, ángulo vertical, distancia"
if (proyecto.ar.camara) visor.setAttribute('camera-orbit', proyecto.ar.camara);
if (proyecto.ar.modeloIOS) visor.setAttribute('ios-src', proyecto.ar.modeloIOS);
visor.src = proyecto.ar.modelo;

visor.addEventListener('progress', (e) => {
  document.getElementById('progreso').style.width = `${Math.round(e.detail.totalProgress * 100)}%`;
});

visor.addEventListener('load', () => {
  // canActivateAR = ¿este dispositivo puede abrir la AR?
  if (!visor.canActivateAR) document.getElementById('aviso-sin-ar').hidden = false;
});

visor.addEventListener('error', () => {
  mostrarEstado('No se pudo cargar el modelo 3D. Revisa la ruta en el JSON.', 0);
});

// ---------------------------------------------------------
// 3. Puntos de información (hotspots)
//    model-viewer reconoce cualquier hijo con slot="hotspot-ALGO"
//    y lo mueve para que siga la posición 3D de data-position (en metros).
// ---------------------------------------------------------
proyecto.ar.puntos.forEach((punto, i) => {
  const boton = document.createElement('button');
  boton.className = 'punto';
  boton.type = 'button';
  boton.slot = `hotspot-${punto.id}`;
  boton.dataset.position = punto.posicion;
  boton.dataset.normal = punto.normal;
  boton.dataset.visibilityAttribute = 'visible';   // añade data-visible cuando no está tapado
  boton.dataset.id = punto.id;
  boton.setAttribute('aria-label', `Punto ${i + 1}: ${punto.titulo}`);
  boton.innerHTML = `${i + 1}<span class="punto-etiqueta" aria-hidden="true">${punto.titulo}</span>`;
  boton.addEventListener('click', () => abrirPunto(punto.id));
  visor.appendChild(boton);
});

function abrirPunto(id, textoAlternativo, tipo = 'Punto de información') {
  const punto = proyecto.ar.puntos.find(p => p.id === id);
  resaltar(id);
  document.getElementById('info-tipo').textContent = tipo;
  document.getElementById('info-titulo').textContent = punto ? punto.titulo : proyecto.titulo;
  document.getElementById('info-texto').textContent = limpiar(textoAlternativo ?? punto.texto);
  asistente.hidden = true;
  tarjeta.hidden = false;
  botonAsistente.hidden = true;
}

function resaltar(id) {
  visor.querySelectorAll('.punto').forEach(b => b.classList.toggle('activo', b.dataset.id === id));
  // En modo 3D (no AR) la cámara gira hacia el punto para que se vea claro.
  const punto = proyecto.ar.puntos.find(p => p.id === id);
  if (punto && !enAR) {
    const [x, y, z] = punto.posicion.split(' ');
    visor.cameraTarget = `${x}m ${y}m ${z}m`;
  }
}

function cerrarTarjeta() {
  tarjeta.hidden = true;
  botonAsistente.hidden = false;
  visor.querySelectorAll('.punto').forEach(b => b.classList.remove('activo'));
  if (!enAR) visor.cameraTarget = 'auto auto auto';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
document.getElementById('cerrar-info').addEventListener('click', cerrarTarjeta);

// ---------------------------------------------------------
// 4. Guía durante la AR
//    Estos eventos son los que hacen que la experiencia se "sienta" bien:
//    la persona siempre sabe qué hacer.
// ---------------------------------------------------------
visor.addEventListener('ar-status', (e) => {
  switch (e.detail.status) {
    case 'session-started':          // se abrió la cámara (WebXR en Android)
      enAR = true;
      visor.cameraTarget = 'auto auto auto';
      mostrarEstado('Buscando una superficie…', 0);
      break;
    case 'object-placed':            // la maqueta ya está sobre la mesa
      mostrarEstado(esVideo
        ? '¡Listo! Toca ▶ para ver el video. Arrastra para mover la pantalla, pellizca para cambiar el tamaño.'
        : '¡Listo! Camina alrededor y toca los puntos numerados. Arrastra para mover, pellizca para cambiar el tamaño.', 6000);
      break;
    case 'not-presenting':           // salió de la AR
      enAR = false;
      ocultarEstado();
      break;
    case 'failed':
      enAR = false;
      mostrarEstado('No se pudo abrir la AR en este celular. Puedes seguir viendo la maqueta en 3D.', 6000);
      break;
  }
});

visor.addEventListener('ar-tracking', (e) => {
  if (e.detail.status === 'not-tracking') {
    mostrarEstado('Se perdió la superficie. Apunta otra vez a la mesa con buena luz.', 0);
  } else {
    ocultarEstado();
  }
});

let temporizador;
function mostrarEstado(texto, duracion) {
  clearTimeout(temporizador);
  estado.textContent = texto;
  estado.hidden = false;
  if (duracion) temporizador = setTimeout(ocultarEstado, duracion);
}
function ocultarEstado() { estado.hidden = true; }

// En WebXR, tocar la pantalla mueve la maqueta. Esto evita que tocar un
// botón, la tarjeta o el asistente la mueva por accidente.
visor.querySelectorAll('.punto, .tarjeta-info, .asistente, .boton-asistente, .estado-ar')
  .forEach(el => el.addEventListener('beforexrselect', ev => ev.preventDefault()));

// ---------------------------------------------------------
// 5. Asistente «Pregúntale a la maqueta»
// ---------------------------------------------------------
const datosAsistente = proyecto.asistente;
if (!datosAsistente) {
  botonAsistente.hidden = true;
} else {
  const contSugeridas = document.getElementById('sugeridas');
  datosAsistente.sugeridas.forEach(texto => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.addEventListener('click', () => preguntar(texto));
    contSugeridas.appendChild(b);
  });

  botonAsistente.addEventListener('click', () => {
    tarjeta.hidden = true;
    asistente.hidden = false;
    botonAsistente.hidden = true;
    botonAsistente.setAttribute('aria-expanded', 'true');
    // no se enfoca el input automáticamente para que no salte el teclado en la AR
  });
  document.getElementById('cerrar-asistente').addEventListener('click', () => {
    asistente.hidden = true;
    botonAsistente.hidden = false;
    botonAsistente.setAttribute('aria-expanded', 'false');
  });
  document.getElementById('form-pregunta').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('pregunta');
    if (input.value.trim()) preguntar(input.value.trim());
    input.value = '';
    input.blur();
  });
}

function preguntar(pregunta) {
  const r = responder(pregunta, datosAsistente.pasajes);
  abrirPunto(r.punto, r.texto, `Respuesta · «${pregunta}»`);
  if (!r.punto) document.getElementById('info-titulo').textContent = r.encontrado ? proyecto.titulo : 'Sin información';
  hablar(r.texto);
}

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(limpiar(texto));
  voz.lang = 'es-ES';
  speechSynthesis.speak(voz);
}

/** Quita la marca [EJEMPLO] al mostrar o leer textos de ejemplo. */
function limpiar(texto = '') { return texto.replace('[EJEMPLO]', '').trim(); }

// Para pruebas desde la consola del navegador
window.vitrina = { proyecto, abrirPunto, preguntar };

// ---------------------------------------------------------
// 6. Proyecto con video → pantalla de cine con letra sincronizada
// ---------------------------------------------------------
if (esVideo) {
  const { iniciarCine } = await import('./ar-video.js');
  iniciarCine(visor, proyecto).catch((e) => {
    console.error(e);
    mostrarEstado('No se pudo preparar el video. Revisa tu conexión e intenta de nuevo.', 0);
  });
}
