// =========================================================
// imagenes.mjs — planos y documentos a WebP para la galería de la ficha
//
// Uso:  cd herramientas/maqueta  →  node imagenes.mjs
// Por cada lámina genera:
//   img/<proyecto>/<nombre>.webp       2000 px de ancho (se lee en el visor con zoom)
//   img/<proyecto>/<nombre>-mini.webp  480 px (miniatura de la galería)
// Los originales (PNG/JPG grandes) se quedan en _material/ y no se publican.
// =========================================================
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'node:fs';

const MATERIAL = '../../../_material/3_proyectos/';
const grupos = [
  { carpeta: 'deliveryrush', origen: 'multimedia', patron: /^DELIVERYRUSH_GDD_(\d+)\.jpg$/, nombre: (m) => `gdd-${m[1].padStart(2, '0')}` },
  { carpeta: 'oficina', origen: 'arquitectura', patron: /^Oficinaejemplo3-(\d+)_(.+)\.png$/, nombre: (m) => `O-${m[1]}_${m[2]}` },
  { carpeta: 'london', origen: 'arquitectura', patron: /^Ejemplo4London-(\d+)_(.+)\.png$/, nombre: (m) => `L-${m[1]}_${m[2]}` }
];

for (const g of grupos) {
  const destino = `../../img/${g.carpeta}/`;
  mkdirSync(destino, { recursive: true });
  let antes = 0, despues = 0;
  for (const archivo of readdirSync(MATERIAL + g.origen).sort()) {
    const m = g.patron.exec(archivo);
    if (!m) continue;
    const entrada = MATERIAL + g.origen + '/' + archivo;
    const nombre = g.nombre(m);
    await sharp(entrada).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(`${destino}${nombre}.webp`);
    await sharp(entrada).resize({ width: 480 }).webp({ quality: 70, effort: 5 }).toFile(`${destino}${nombre}-mini.webp`);
    antes += statSync(entrada).size;
    despues += statSync(`${destino}${nombre}.webp`).size + statSync(`${destino}${nombre}-mini.webp`).size;
  }
  console.log(`${g.carpeta}: ${(antes / 1048576).toFixed(1)} MB → ${(despues / 1024).toFixed(0)} KB`);
}
