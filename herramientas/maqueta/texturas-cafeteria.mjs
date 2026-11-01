// =========================================================
// texturas-cafeteria.mjs — cambia las imágenes de internet de la Cafetería por imágenes propias
//
// El modelo original usa imágenes que no son del equipo:
//   - la pared: un damero descargado de iStock (istockphoto-520861969)
//   - los 3 cuadros: una ilustración de Marilyn Monroe, una foto de guitarra
//     y la foto de los Beatles en Abbey Road
// Publicarlas en la web puede infringir derechos de autor, así que en la versión
// del sitio se reemplazan por imágenes generadas aquí, del mismo tamaño y estilo
// (blanco y negro). El archivo original de la estudiante no se modifica.
// =========================================================
import sharp from 'sharp';

/** Damero propio con el mismo número de cuadros y la misma posición que el original. */
async function dameroIgual(original) {
  const { data, info } = await sharp(original).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const valor = (x, y) => data[y * w + x] > 128;
  // Bordes del damero en la fila y la columna del centro
  const cortes = (n, leer) => { const c = []; for (let i = 1; i < n; i++) if (leer(i) !== leer(i - 1)) c.push(i); return c; };
  const enX = cortes(w, x => valor(x, h >> 1)), enY = cortes(h, y => valor(w >> 1, y));
  const paso = (c, n) => (c.length > 1 ? (c[c.length - 1] - c[0]) / (c.length - 1) : n);
  const px = paso(enX, w), py = paso(enY, h);
  const ox = enX[0] ?? 0, oy = enY[0] ?? 0;
  const blancoEnCentro = valor(w >> 1, h >> 1);
  const celda = (x, y) => Math.floor((x - ox) / px) + Math.floor((y - oy) / py);
  const paridadCentro = ((celda(w >> 1, h >> 1) % 2) + 2) % 2;
  const salida = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const blanco = (((celda(x, y) % 2) + 2) % 2 === paridadCentro) === blancoEnCentro;
    salida.fill(blanco ? 0xf2 : 0x14, (y * w + x) * 3, (y * w + x) * 3 + 3);
  }
  console.log(`  Damero propio: ${w}×${h} px, cuadros de ${px.toFixed(1)}×${py.toFixed(1)} px`);
  return sharp(salida, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** Tres cuadros abstractos en blanco y negro, al estilo de una cafetería de los 50. */
const cuadros = [
  // 1. Disco de vinilo
  (w, h) => `<rect width="${w}" height="${h}" fill="#f2f2f2"/>
    <circle cx="${w / 2}" cy="${h * 0.45}" r="${w * 0.4}" fill="#111"/>
    ${[0.34, 0.29, 0.24, 0.19].map(r => `<circle cx="${w / 2}" cy="${h * 0.45}" r="${w * r}" fill="none" stroke="#3a3a3a" stroke-width="${w * 0.006}"/>`).join('')}
    <circle cx="${w / 2}" cy="${h * 0.45}" r="${w * 0.12}" fill="#f2f2f2"/>
    <circle cx="${w / 2}" cy="${h * 0.45}" r="${w * 0.02}" fill="#111"/>
    <rect x="${w * 0.15}" y="${h * 0.86}" width="${w * 0.7}" height="${h * 0.025}" fill="#111"/>`,
  // 2. Malteada con pajilla
  (w, h) => `<rect width="${w}" height="${h}" fill="#111"/>
    <path d="M${w * 0.3} ${h * 0.38} L${w * 0.7} ${h * 0.38} L${w * 0.6} ${h * 0.8} L${w * 0.4} ${h * 0.8} Z" fill="#f2f2f2"/>
    <ellipse cx="${w / 2}" cy="${h * 0.36}" rx="${w * 0.22}" ry="${h * 0.06}" fill="#f2f2f2"/>
    <circle cx="${w / 2}" cy="${h * 0.27}" r="${w * 0.06}" fill="#f2f2f2"/>
    <rect x="${w * 0.56}" y="${h * 0.12}" width="${w * 0.03}" height="${h * 0.24}" transform="rotate(15 ${w * 0.575} ${h * 0.24})" fill="#f2f2f2"/>
    <rect x="${w * 0.36}" y="${h * 0.82}" width="${w * 0.28}" height="${h * 0.03}" fill="#f2f2f2"/>`,
  // 3. Rayas y estrella
  (w, h) => `<rect width="${w}" height="${h}" fill="#f2f2f2"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${(i * h) / 9}" width="${w}" height="${h / 18}" fill="#111"/>`).join('')}
    <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.3}" fill="#f2f2f2" stroke="#111" stroke-width="${w * 0.02}"/>
    <polygon points="${estrella(w / 2, h / 2, w * 0.22, w * 0.09)}" fill="#111"/>`
];
function estrella(cx, cy, r1, r2) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export async function reemplazarTexturasCafeteria(doc) {
  for (const t of doc.getRoot().listTextures()) {
    const mats = t.listParents().filter(p => p.propertyType === 'Material').map(m => m.getName());
    const [w, h] = t.getSize();
    if (/istockphoto/i.test(t.getName())) {
      t.setImage(new Uint8Array(await dameroIgual(Buffer.from(t.getImage())))).setMimeType('image/png').setName('damero-propio');
    }
    const n = mats.map(m => /^cuadro (\d)/.exec(m)?.[1]).find(Boolean);
    if (n) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${cuadros[n - 1](w, h)}</svg>`;
      t.setImage(new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer())).setMimeType('image/png').setName(`cuadro-propio-${n}`);
      console.log(`  Cuadro ${n}: imagen propia (${w}×${h})`);
    }
  }
}
