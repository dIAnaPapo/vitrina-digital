// Paso 2: texturas a WebP + Draco (proceso aparte: junto a la geometría, sharp falla en Windows).
// Uso: node texturas.mjs intermedio.glb salida.glb [texturas=1024]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { draco, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [, , entrada, salida, tex = '1024'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(entrada);
// 5. Texturas a WebP (máx. «tex» px), DE A UNA (en paralelo, sharp falla en Windows)
doc.createExtension(EXTTextureWebP).setRequired(true);
for (const t of doc.getRoot().listTextures()) {
  const img = Buffer.from(t.getImage());
  console.log("procesando", doc.getRoot().listTextures().indexOf(t), t.getMimeType());
  const { width, height } = await sharp(img).metadata();
  const k = Math.min(1, Number(tex) / Math.max(width, height));
  let webp;
  try {
    webp = await sharp(img)
      .resize(Math.round(width * k), Math.round(height * k), { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 80, effort: 5 })
      .toBuffer();
  } catch (e) {
    const m = await sharp(img).metadata();
    const usos = t.listParents().filter(p => p.propertyType === 'Material').map(p => p.getName()).join(', ');
    console.log(`Textura que falla: ${t.getMimeType()} ${m.width}x${m.height} canales ${m.channels} espacio ${m.space} prof ${m.depth} alfa ${m.hasAlpha} · materiales: ${usos} · ${e.message.split('\n')[0]}`);
    throw e;
  }
  t.setImage(new Uint8Array(webp)).setMimeType('image/webp');
  if (t.getURI()) t.setURI(t.getURI().replace(/\.\w+$/, '.webp'));
}

// 6. Compresión Draco de la geometría
io.registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule()
});
await doc.transform(draco({ method: 'edgebreaker' }));
await doc.transform(prune());

let triangulos = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) triangulos += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(`Triángulos: ${Math.round(triangulos)} · mallas: ${doc.getRoot().listMeshes().length} · texturas: ${doc.getRoot().listTextures().length}`);
await io.write(salida, doc);
console.log(`Archivo: ${(statSync(salida).size / 1024 / 1024).toFixed(2)} MB`);
