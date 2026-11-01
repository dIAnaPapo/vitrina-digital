// =========================================================
// carrusel.js — el visor 3D del hero va rotando entre los proyectos
//
// Cómo funciona:
//   - Hay DOS <model-viewer> superpuestos. Mientras uno se ve, el otro
//     PRECARGA el proyecto siguiente; al cambiar se cruzan con un fundido (600 ms).
//   - Cambia cada 8 s. Se pausa si la persona pasa el mouse, toca o enfoca el carrusel.
//   - Puntos indicadores para elegir un proyecto. Nombre y carrera llevan a la ficha.
//   - Con «reducir movimiento»: no cambia solo ni gira; solo con los puntos.
//   - Proyecto de video: el televisor 3D muestra el PÓSTER (no el video de 9 MB),
//     para que la portada cargue rápido.
// =========================================================

import { escapar, iconos } from './datos.js';

const INTERVALO = 8000;       // ms entre proyectos
const FUNDIDO = 600;          // ms del fundido (igual que en CSS)
const PAUSA_TACTIL = 10000;   // tras tocarlo en el celular, espera 10 s antes de seguir

/**
 * @param {HTMLElement} raiz       el <section class="carrusel">
 * @param {Array} proyectos        proyectos publicados con "ar"
 * @param {Array} carreras         para mostrar el nombre de la carrera
 */
export function crearCarrusel(raiz, proyectos, carreras) {
  if (!proyectos.length) { raiz.hidden = true; return; }

  const [a, b] = raiz.querySelectorAll('model-viewer');
  const enlace = raiz.querySelector('.carrusel-enlace');
  const textoCarrera = raiz.querySelector('.carrusel-carrera');
  const textoTitulo = raiz.querySelector('.carrusel-titulo');
  const contPuntos = raiz.querySelector('.carrusel-puntos');
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

  let visible = a, oculto = b;
  let actual = 0;
  let cambiando = false;
  let pausadoMouse = false, pausadoTacto = false, pausadoFoco = false;
  let temporizador = 0, temporizadorTacto = 0;
  const cargado = new Map();   // visor → índice del proyecto que tiene cargado

  raiz.querySelector('.carrusel-enlace .circulo').innerHTML = iconos.flecha;

  // ---------- Puntos indicadores ----------
  contPuntos.innerHTML = proyectos.map((p, i) =>
    `<button type="button" data-i="${i}" aria-label="Ver ${escapar(p.titulo)}"></button>`).join('');
  contPuntos.hidden = proyectos.length < 2;
  contPuntos.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-i]');
    if (!boton) return;
    enlace.setAttribute('aria-live', 'polite');    // si lo elige la persona, se anuncia
    mostrar(Number(boton.dataset.i)).then(programar);
  });

  function pintarTexto() {
    const p = proyectos[actual];
    const carrera = carreras.find(c => c.id === p.carrera);
    textoCarrera.textContent = carrera?.nombre ?? '';
    textoTitulo.textContent = p.titulo;
    enlace.href = `proyecto.html?id=${encodeURIComponent(p.id)}`;
    contPuntos.querySelectorAll('button').forEach((boton, i) =>
      boton.setAttribute('aria-current', String(i === actual)));
  }

  // ---------- Cargar un proyecto en un visor ----------
  async function cargar(visor, i) {
    if (cargado.get(visor) === i) return;
    const p = proyectos[i];
    cargado.set(visor, i);
    visor.alt = p.ar.alt;
    // Cámara más cerca que «auto» para que el modelo llene el visor (se puede ajustar por proyecto con "camaraHero")
    visor.cameraOrbit = p.ar.camaraHero ?? (p.ar.tipo === 'video' ? '-25deg 80deg 96%' : '30deg 62deg 80%');
    visor.autoRotate = !sinMovimiento.matches;
    visor.src = p.ar.modeloHero ?? p.ar.modelo;
    await new Promise((listo) => {
      const fin = () => { visor.removeEventListener('load', fin); visor.removeEventListener('error', fin); listo(); };
      visor.addEventListener('load', fin);
      visor.addEventListener('error', fin);
    });
    // Televisor: el póster va en la pantalla (imagen ya volteada para la convención de glTF)
    if (p.ar.tipo === 'video' && p.ar.pantallaHero && visor.model) {
      const material = visor.model.getMaterialByName('pantalla');
      if (material) {
        try {
          const textura = await visor.createTexture(p.ar.pantallaHero);
          material.pbrMetallicRoughness.baseColorTexture.setTexture(textura);
        } catch (e) { console.warn('No se pudo poner el póster en el televisor', e); }
      }
    }
  }

  // ---------- Cambiar al proyecto i (fundido) ----------
  async function mostrar(i) {
    if (i === actual && cargado.get(visible) === i) return;
    if (cambiando) return;
    cambiando = true;
    await cargar(oculto, i);
    oculto.classList.add('activo');
    oculto.removeAttribute('aria-hidden');
    visible.classList.remove('activo');
    visible.setAttribute('aria-hidden', 'true');
    [visible, oculto] = [oculto, visible];
    actual = i;
    pintarTexto();
    cambiando = false;
    // Cuando terminó el fundido, el visor escondido precarga el siguiente
    setTimeout(() => cargar(oculto, (actual + 1) % proyectos.length), FUNDIDO + 50);
  }

  // ---------- Avance automático y pausas ----------
  function programar() {
    clearTimeout(temporizador);
    const pausado = pausadoMouse || pausadoTacto || pausadoFoco;
    if (pausado || sinMovimiento.matches || proyectos.length < 2) return;
    temporizador = setTimeout(async () => {
      enlace.setAttribute('aria-live', 'off');     // cambio automático: no se anuncia
      await mostrar((actual + 1) % proyectos.length);
      programar();
    }, INTERVALO);
  }

  raiz.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { pausadoMouse = true; programar(); } });
  raiz.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { pausadoMouse = false; programar(); } });
  raiz.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    pausadoTacto = true;
    programar();
    clearTimeout(temporizadorTacto);
    temporizadorTacto = setTimeout(() => { pausadoTacto = false; programar(); }, PAUSA_TACTIL);
  });
  raiz.addEventListener('focusin', () => { pausadoFoco = true; programar(); });
  raiz.addEventListener('focusout', () => { pausadoFoco = false; programar(); });
  sinMovimiento.addEventListener('change', () => {
    [a, b].forEach(v => { v.autoRotate = !sinMovimiento.matches; });
    programar();
  });

  // ---------- Inicio ----------
  pintarTexto();
  b.setAttribute('aria-hidden', 'true');
  // Los modelos se descargan DESPUÉS de que la página terminó de cargar (las carreras
  // aparecen primero, hipótesis H1). Con «ahorro de datos» no se descargan.
  const empezar = async () => {
    if (navigator.connection?.saveData) return;
    await cargar(visible, 0);
    visible.classList.add('activo');
    if (proyectos.length > 1) cargar(oculto, 1);
    programar();
  };
  document.readyState === 'complete' ? empezar() : addEventListener('load', empezar, { once: true });

  // Para pruebas desde la consola
  return { mostrar, get actual() { return actual; } };
}
