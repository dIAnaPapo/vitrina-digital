// =========================================================
// datos.js — funciones compartidas por todas las páginas.
// Lee data/proyectos.json (el contenido que edita el docente).
// =========================================================

let cache = null;

/** Descarga el JSON una sola vez y lo guarda en memoria. */
export async function cargarDatos() {
  if (cache) return cache;
  const respuesta = await fetch('data/proyectos.json', { cache: 'no-cache' });
  if (!respuesta.ok) throw new Error('No se pudo leer data/proyectos.json');
  cache = await respuesta.json();
  return cache;
}

/** Devuelve las carreras en el orden que eligió el docente (campo "orden"). */
export function carrerasOrdenadas(datos) {
  return [...datos.carreras].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

/** Imagen de portada de un proyecto: "portada" del JSON, o la primera imagen de su galería. */
export function portadaDe(p) {
  return p.portada ?? p.imagenes?.[0]?.src ?? '';
}

/** «1 proyecto» / «2 proyectos» */
export function textoProyectos(n) {
  return `${n} proyecto${n === 1 ? '' : 's'}`;
}

/** Lee un parámetro de la URL. Ej.: proyecto.html?id=casa-moderna → leerParametro('id') = 'casa-moderna' */
export function leerParametro(nombre) {
  return new URLSearchParams(window.location.search).get(nombre);
}

/** Escapa texto antes de meterlo en HTML (evita romper la página con comillas o <). */
export function escapar(texto = '') {
  return String(texto)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Muestra un mensaje de error amable dentro de <main>. */
export function mostrarError(mensaje) {
  const main = document.querySelector('main');
  main.innerHTML = `<div class="alerta"><p role="alert">${escapar(mensaje)}</p><p><a href="index.html">Volver a los proyectos</a></p></div>`;
}

/** Íconos SVG de línea (heredan el color del texto). */
const trazo = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const iconos = {
  flecha: `<svg viewBox="0 0 24 24" ${trazo} aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>`,
  arquitectura: `<svg viewBox="0 0 24 24" ${trazo} aria-hidden="true"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>`,
  multimedia: `<svg viewBox="0 0 24 24" ${trazo} aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>`,
  ar: `<svg viewBox="0 0 24 24" ${trazo} aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>`,
  nfc: `<svg viewBox="0 0 24 24" ${trazo} aria-hidden="true"><path d="M6 8.5a5 5 0 0 1 0 7M9.5 6a9 9 0 0 1 0 12M13 3.5a13 13 0 0 1 0 17"/></svg>`};
