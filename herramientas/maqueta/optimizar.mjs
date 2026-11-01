// =========================================================
// optimizar.mjs — prepara el modelo de Arquitectura para el celular
//
// Uso:  cd herramientas/maqueta  →  npm install  →
//       node optimizar.mjs ruta/al/original.glb ../../modelos/casa-moderna.glb 25
//
// Qué hace, en orden:
//   1. Pasa el modelo (en metros reales) a MAQUETA: lo centra, deja la base en y = 0
//      y lo divide por la escala (25 → maqueta 1:25 de unos 59 cm de ancho).
//      La AR propia lo vuelve a multiplicar ×25 para «Escala real 1:1».
//   2. Reduce las «llamadas de dibujo» (lo que más pone lento a un celular):
//      une materiales de color liso en una paleta (palette) y junta las mallas
//      que comparten material (join). El modelo ya es liviano en triángulos,
//      así que NO se simplifica: el interior queda intacto.
//   3. Pasa las texturas a WebP (máx. 1024 px; las chicas se quedan como están).
//   4. Sin compresión Draco/meshopt: el archivo queda chico y así el celular
//      no tiene que descargar un decodificador antes de mostrarlo.
// =========================================================
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, palette, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [, , entrada, salida, escala = '25'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(entrada);
const raiz = doc.getRoot();
const escena = raiz.getDefaultScene();

function medir(titulo) {
  let tri = 0;
  for (const m of raiz.listMeshes()) for (const p of m.listPrimitives()) tri += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const primitivas = raiz.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  console.log(`${titulo}: ${Math.round(tri)} triángulos · ${primitivas} llamadas de dibujo · ${raiz.listMaterials().length} materiales · ${raiz.listTextures().length} texturas`);
}
medir('ANTES');

// 1. Maqueta: centrada, base en y = 0, dividida por la escala
const b = getBounds(escena);
const s = 1 / Number(escala);
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
const maqueta = doc.createNode('maqueta').setScale([s, s, s]).setTranslation([-cx * s, -b.min[1] * s, -cz * s]);
for (const hijo of escena.listChildren()) { escena.removeChild(hijo); maqueta.addChild(hijo); }
escena.addChild(maqueta);
const b2 = getBounds(escena);
console.log(`Maqueta 1:${escala}: ${(b2.max[0] - b2.min[0]).toFixed(3)} × ${(b2.max[1] - b2.min[1]).toFixed(3)} × ${(b2.max[2] - b2.min[2]).toFixed(3)} m · base y=${b2.min[1].toFixed(4)}`);
console.log(`Centro original (para convertir coordenadas reales): x=${cx.toFixed(3)} z=${cz.toFixed(3)} · y mínima=${b.min[1].toFixed(3)}`);

// 2. Menos llamadas de dibujo
await doc.transform(dedup(), prune(), flatten(), weld(), palette({ min: 2 }), join(), dedup(), prune());

// 3. Texturas a WebP
doc.createExtension(EXTTextureWebP).setRequired(true);
for (const t of raiz.listTextures()) {
  const img = Buffer.from(t.getImage());
  const { width, height } = await sharp(img).metadata();
  const k = Math.min(1, 1024 / Math.max(width, height));
  const webp = await sharp(img).resize(Math.round(width * k), Math.round(height * k), { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 82, effort: 5 }).toBuffer();
  t.setImage(new Uint8Array(webp)).setMimeType('image/webp');
  if (t.getURI()) t.setURI(t.getURI().replace(/\.\w+$/, '.webp'));
}

medir('DESPUÉS');
await io.write(salida, doc);
console.log(`Peso: ${(statSync(entrada).size / 1024).toFixed(0)} KB → ${(statSync(salida).size / 1024).toFixed(0)} KB`);
