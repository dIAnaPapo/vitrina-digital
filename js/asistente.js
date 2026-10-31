// =========================================================
// asistente.js — «Pregúntale a la maqueta» (AA3)
//
// Cómo responde (versión MVP, funciona sin internet extra y sin servidor):
//   1. Normaliza la pregunta (minúsculas, sin tildes, sin signos).
//   2. Compara con cada pasaje del JSON: sus "claves" valen más,
//      las palabras del texto valen menos.
//   3. Devuelve el pasaje con más puntaje y el punto de la maqueta
//      al que está ligado, para resaltarlo.
//   4. Si el puntaje es bajo → «No tengo esa información».
//
// IMPORTANTE: NO inventa nada. Solo devuelve textos que el estudiante
// y el docente cargaron en data/proyectos.json.
//
// FASE 2 (opcional): cambiar puntuar() por búsqueda semántica con
// Transformers.js (ver README, sección «Asistente»). La función
// responder() mantiene la misma forma, así que ar.js no cambia.
// =========================================================

const PALABRAS_VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'y', 'o',
  'que', 'por', 'para', 'con', 'es', 'son', 'se', 'su', 'sus', 'lo', 'le', 'me', 'mi', 'tu',
  'como', 'cual', 'cuales', 'esta', 'este', 'esto', 'tiene', 'hay', 'muy', 'tan', 'mas', 'porque'
]);

const UMBRAL = 2;   // puntaje mínimo para dar una respuesta

export function normalizar(texto = '') {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita tildes
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabras(texto) {
  return normalizar(texto).split(' ').filter(p => p.length > 2 && !PALABRAS_VACIAS.has(p));
}

/** Dos palabras "se parecen" si comparten la raíz (primeras 5 letras): dormitorio ≈ dormitorios. */
function parecidas(a, b) {
  if (a === b) return true;
  const raiz = Math.min(5, a.length, b.length);
  return raiz >= 4 && a.slice(0, raiz) === b.slice(0, raiz);
}

function puntuar(pregunta, pasaje) {
  const preguntaNorm = normalizar(pregunta);
  const palabrasPregunta = palabras(pregunta);
  let puntaje = 0;

  for (const clave of pasaje.claves ?? []) {
    const claveNorm = normalizar(clave);
    if (claveNorm.includes(' ')) {
      if (preguntaNorm.includes(claveNorm)) puntaje += 3;              // frase exacta
    } else if (palabrasPregunta.some(p => parecidas(p, claveNorm))) {
      puntaje += 2;                                                    // palabra clave
    }
  }
  const palabrasPasaje = palabras(pasaje.texto);
  for (const p of palabrasPregunta) {
    if (palabrasPasaje.some(q => parecidas(p, q))) puntaje += 0.5;    // coincidencia en el texto
  }
  return puntaje;
}

/**
 * @param {string} pregunta  lo que escribió la persona
 * @param {Array}  pasajes   proyecto.asistente.pasajes del JSON
 * @returns {{encontrado: boolean, texto: string, punto: string|null}}
 */
export function responder(pregunta, pasajes = []) {
  let mejor = null, mejorPuntaje = 0;
  for (const pasaje of pasajes) {
    const puntaje = puntuar(pregunta, pasaje);
    if (puntaje > mejorPuntaje) { mejor = pasaje; mejorPuntaje = puntaje; }
  }
  if (!mejor || mejorPuntaje < UMBRAL) {
    return {
      encontrado: false,
      texto: 'No tengo esa información sobre este proyecto. Prueba con una de las preguntas sugeridas.',
      punto: null
    };
  }
  return { encontrado: true, texto: mejor.texto, punto: mejor.punto ?? null };
}
