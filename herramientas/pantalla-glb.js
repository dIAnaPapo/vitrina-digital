// =========================================================
// pantalla-glb.js — genera modelos/pantalla-cine.glb por código
//
// Es un televisor retro (como el del video «Cuentos y Espías»):
//   pie + cuello + mueble azul Ecotec + marco negro + pantalla 16:9 + 2 antenas.
// Medidas en METROS (lo que usa model-viewer y la AR):
//   - Pantalla: 0,60 m × 0,3375 m (16:9, igual que el video 1920×1080)
//   - El origen (0,0,0) está en la BASE del pie → se apoya sobre la mesa.
// La pantalla usa un material llamado "pantalla" sin iluminación
// (KHR_materials_unlit) para que el video se vea con sus colores reales.
// ar.js le pone el video encima con createVideoTexture().
//
// Cómo volver a generarlo: abre herramientas/generar-pantalla.html
// con Live Server y toca «Descargar pantalla-cine.glb».
// =========================================================

const ANCHO_PANTALLA = 0.60;
const ALTO_PANTALLA = ANCHO_PANTALLA * 9 / 16;   // 0,3375 m

/** Color #RRGGBB (sRGB) → factor lineal que pide glTF */
function color(hex, alfa = 1) {
  const lineal = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(hex.slice(1), 16);
  return [lineal(n >> 16 & 255), lineal(n >> 8 & 255), lineal(n & 255), alfa];
}

/** Caja centrada en el origen: 6 caras con sus normales y UV (24 vértices). */
function caja(ancho, alto, fondo) {
  const [x, y, z] = [ancho / 2, alto / 2, fondo / 2];
  // Cada cara: normal y sus 4 esquinas en sentido antihorario visto desde fuera
  const caras = [
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]]
  ];
  const posiciones = [], normales = [], uvs = [], indices = [];
  caras.forEach(([normal, esquinas], i) => {
    esquinas.forEach(p => { posiciones.push(...p); normales.push(...normal); });
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { posiciones, normales, uvs, indices };
}

/** Rectángulo mirando hacia +Z. UV con v=1 arriba (convención de las texturas de video). */
function rectangulo(ancho, alto) {
  const [x, y] = [ancho / 2, alto / 2];
  return {
    posiciones: [-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0],
    normales: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3]
  };
}

/** Rotación sobre el eje Z (en grados) como cuaternión [x, y, z, w]. */
function giroZ(grados) {
  const r = grados * Math.PI / 180 / 2;
  return [0, 0, Math.sin(r), Math.cos(r)];
}

export function crearPantallaGLB() {
  const materiales = [
    { name: 'mueble', pbrMetallicRoughness: { baseColorFactor: color('#0662AE'), metallicFactor: 0, roughnessFactor: 0.45 } },
    { name: 'marco', pbrMetallicRoughness: { baseColorFactor: color('#111418'), metallicFactor: 0, roughnessFactor: 0.3 } },
    { name: 'pie', pbrMetallicRoughness: { baseColorFactor: color('#01B3E6'), metallicFactor: 0, roughnessFactor: 0.5 } },
    { name: 'antena', pbrMetallicRoughness: { baseColorFactor: color('#DEF1FF'), metallicFactor: 0.4, roughnessFactor: 0.35 } },
    { name: 'pantalla', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 },
      extensions: { KHR_materials_unlit: {} } }
  ];

  // Alturas (m), de abajo hacia arriba
  const altoPie = 0.016, altoCuello = 0.05, altoMueble = 0.44, fondoMueble = 0.07;
  const yMueble = altoPie + altoCuello + altoMueble / 2;   // centro del mueble
  const techo = altoPie + altoCuello + altoMueble;          // donde nacen las antenas
  const largoAntena = 0.2, inclinacion = 25;
  const s = Math.sin(inclinacion * Math.PI / 180), c = Math.cos(inclinacion * Math.PI / 180);

  const partes = [
    { nombre: 'pie', material: 2, geo: caja(0.30, altoPie, 0.16), t: [0, altoPie / 2, 0] },
    { nombre: 'cuello', material: 2, geo: caja(0.05, altoCuello, 0.04), t: [0, altoPie + altoCuello / 2, 0] },
    { nombre: 'mueble', material: 0, geo: caja(0.68, altoMueble, fondoMueble), t: [0, yMueble, 0] },
    { nombre: 'marco', material: 1, geo: caja(ANCHO_PANTALLA + 0.02, ALTO_PANTALLA + 0.02, 0.004), t: [0, yMueble, fondoMueble / 2 + 0.002] },
    { nombre: 'pantalla', material: 4, geo: rectangulo(ANCHO_PANTALLA, ALTO_PANTALLA), t: [0, yMueble, fondoMueble / 2 + 0.0045] },
    { nombre: 'antena-izq', material: 3, geo: caja(0.008, largoAntena, 0.008),
      t: [-0.03 - s * largoAntena / 2, techo + c * largoAntena / 2, 0], r: giroZ(inclinacion) },
    { nombre: 'antena-der', material: 3, geo: caja(0.008, largoAntena, 0.008),
      t: [0.03 + s * largoAntena / 2, techo + c * largoAntena / 2, 0], r: giroZ(-inclinacion) }
  ];

  // ---- Empaquetar en un solo búfer binario ----
  const trozos = [], bufferViews = [], accessors = [];
  let largo = 0;
  function agregar(arreglo, tipo, componente, target, conLimites) {
    const datos = componente === 5126 ? new Float32Array(arreglo) : new Uint16Array(arreglo);
    const relleno = (4 - (largo % 4)) % 4;
    if (relleno) { trozos.push(new Uint8Array(relleno)); largo += relleno; }
    bufferViews.push({ buffer: 0, byteOffset: largo, byteLength: datos.byteLength, target });
    trozos.push(new Uint8Array(datos.buffer));
    largo += datos.byteLength;
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[tipo];
    const acc = { bufferView: bufferViews.length - 1, componentType: componente, count: arreglo.length / n, type: tipo };
    if (conLimites) {
      acc.min = [0, 1, 2].map(i => Math.min(...arreglo.filter((_, j) => j % 3 === i)));
      acc.max = [0, 1, 2].map(i => Math.max(...arreglo.filter((_, j) => j % 3 === i)));
    }
    accessors.push(acc);
    return accessors.length - 1;
  }

  const meshes = [], nodes = [];
  for (const p of partes) {
    const attributes = {
      POSITION: agregar(p.geo.posiciones, 'VEC3', 5126, 34962, true),
      NORMAL: agregar(p.geo.normales, 'VEC3', 5126, 34962),
      TEXCOORD_0: agregar(p.geo.uvs, 'VEC2', 5126, 34962)
    };
    const indices = agregar(p.geo.indices, 'SCALAR', 5123, 34963);
    meshes.push({ name: p.nombre, primitives: [{ attributes, indices, material: p.material }] });
    const nodo = { name: p.nombre, mesh: meshes.length - 1, translation: p.t };
    if (p.r) nodo.rotation = p.r;
    nodes.push(nodo);
  }

  const gltf = {
    asset: { version: '2.0', generator: 'Vitrina Digital Ecotec · herramientas/pantalla-glb.js' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ name: 'pantalla-cine', nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials: materiales, accessors, bufferViews,
    buffers: [{ byteLength: largo + ((4 - (largo % 4)) % 4) }]
  };

  // ---- Formato GLB: cabecera + trozo JSON + trozo BIN ----
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const rellenoJson = (4 - (json.length % 4)) % 4;
  json = Uint8Array.from([...json, ...new Array(rellenoJson).fill(0x20)]);
  const largoBin = gltf.buffers[0].byteLength;
  const total = 12 + 8 + json.length + 8 + largoBin;

  const glb = new Uint8Array(total);
  const vista = new DataView(glb.buffer);
  vista.setUint32(0, 0x46546C67, true);           // 'glTF'
  vista.setUint32(4, 2, true);                    // versión
  vista.setUint32(8, total, true);
  vista.setUint32(12, json.length, true);
  vista.setUint32(16, 0x4E4F534A, true);          // 'JSON'
  glb.set(json, 20);
  let pos = 20 + json.length;
  vista.setUint32(pos, largoBin, true);
  vista.setUint32(pos + 4, 0x004E4942, true);     // 'BIN'
  pos += 8;
  for (const t of trozos) { glb.set(t, pos); pos += t.length; }
  return glb;
}
