// Optimiza «Modern Coastal Hillside Villa» para celular.
// Paso 1 (geometría). Uso: node optimizar.mjs entrada.glb intermedio.glb [ancho_m=0.68] [ratio=0.25] [error=0.002]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, flatten, join, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , entrada, salida, ancho = '0.68', ratio = '0.25', error = '0.002', tex = '1024'] = process.argv;

// Lo que se quita: el auto, los dos «bosques» del borde del lote y la grifería
// (mide menos de 1 cm a escala de maqueta y pesaba ~195 mil triángulos).
const QUITAR = new Set(['Porsche', 'Oak+Tree_260112', 'DogwoodTree.001', 'Faucet1', 'Faucet2']);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(entrada);
const escena = doc.getRoot().getDefaultScene();

// 1. Quitar objetos
let quitados = 0;
escena.traverse(n => { if (QUITAR.has(n.getName())) { n.dispose(); quitados++; } });
console.log('Objetos quitados:', quitados);
await doc.transform(prune());

// 2. Escalar como maqueta: lo más largo en planta = «ancho» metros, centrada, base en y=0
const b = getBounds(escena);
const tam = b.max.map((m, i) => m - b.min[i]);
const s = Number(ancho) / Math.max(tam[0], tam[2]);
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
const maqueta = doc.createNode('maqueta').setScale([s, s, s]).setTranslation([-cx * s, -b.min[1] * s, -cz * s]);
for (const hijo of escena.listChildren()) { escena.removeChild(hijo); maqueta.addChild(hijo); }
escena.addChild(maqueta);
const b2 = getBounds(escena);
console.log(`Maqueta: ${(b2.max[0] - b2.min[0]).toFixed(3)} × ${(b2.max[1] - b2.min[1]).toFixed(3)} × ${(b2.max[2] - b2.min[2]).toFixed(3)} m · base y=${b2.min[1].toFixed(4)} · escala ${s.toExponential(3)}`);

// 3. Dónde quedó cada parte (para ubicar los puntos de información), en metros
const f = (v) => v.map(x => x.toFixed(3)).join(' ');
escena.traverse(n => {
  if (!n.getMesh() && n.listChildren().length === 0) return;
  const nombre = n.getName();
  if (/Water|Glass|Cube\.029|Stair|Door|sunbed|Cube\.0(0|1)\d$|Plane\.00[1-4]$|Cylinder|Bonsai|^Cube$/.test(nombre) && n.listParents().length) {
    const bb = getBounds(n);
    const c = bb.min.map((m, i) => (m + bb.max[i]) / 2);
    console.log(`  ${nombre.padEnd(34)} centro [${f(c)}] min [${f(bb.min)}] max [${f(bb.max)}]`);
  }
});

// 4. Geometría: unir, soldar y simplificar
await doc.transform(
  dedup(),
  flatten(),
  join(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratio), error: Number(error) }),
  prune()
);

let triangulos = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) triangulos += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(`Triángulos: ${Math.round(triangulos)} · mallas: ${doc.getRoot().listMeshes().length} · texturas: ${doc.getRoot().listTextures().length}`);
await io.write(salida, doc);
const { statSync } = await import('node:fs');
console.log(`Archivo: ${(statSync(salida).size / 1024 / 1024).toFixed(2)} MB`);
