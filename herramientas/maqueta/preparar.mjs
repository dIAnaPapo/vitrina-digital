// =========================================================
// preparar.mjs — recetas de optimización de cada proyecto (usa optimizar.mjs)
//
// Uso:  cd herramientas/maqueta  →  npm install  →  node preparar.mjs deliveryrush
//       (o: cafeteria, oficina, london, todos)
// Cada receta genera dos archivos en modelos/:
//   <id>.glb        la maqueta para la ficha y «Ver en mi espacio»
//   <id>-hero.glb   versión liviana (< 1 MB) para el carrusel del inicio
// Los originales se leen de _material/ (fuera del sitio, no se publican).
// =========================================================
import { optimizar } from './optimizar.mjs';
import { reemplazarTexturasCafeteria } from './texturas-cafeteria.mjs';

const MATERIAL = '../../../_material/3_proyectos/';
const MODELOS = '../../modelos/';

const recetas = {
  // DeliveryRush (Virtual Games): mapa del nivel 1, convertido de FBX con FBX2glTF.
  // Diorama sin techo; se quitan las guías del diseño de nivel (no se ven en el juego).
  deliveryrush: {
    entrada: MATERIAL + 'multimedia/DeliveryRush_Mapa_RamosyPonce.glb',
    escala: 24,
    quitar: /^(CEILING_|GUIDE_|MK_)/,
    simplificar: { nodos: /^(PROP_|DEC_|KIT_Props|FRIDGE_|PAC_)/, ratio: 0.15, error: 0.05, planas: true },
    meshopt: true,
    hero: { quitar: /^(CEILING_|GUIDE_|MK_|PROP_|DEC_|KEYPAD_|ARCH_Ceiling)/, simplificarTodo: { ratio: 0.5 }, maxTextura: 512 }
  },
  // Cafetería M3D (Modelado 3D): las imágenes de internet se cambian por propias (ver texturas-cafeteria.mjs)
  cafeteria: {
    entrada: MATERIAL + 'multimedia/Modelo3D_ArllysRamos.glb',
    escala: 22,
    antes: reemplazarTexturasCafeteria,
    meshopt: true,
    hero: { antes: reemplazarTexturasCafeteria, simplificarTodo: { ratio: 0.5 }, maxTextura: 512 }
  },
  oficina: {
    entrada: MATERIAL + 'arquitectura/Ejemplo3_Oficina.glb',
    escala: 30,
    meshopt: true,
    hero: { simplificarTodo: { ratio: 0.4 }, maxTextura: 256, soloColor: true }
  },
  london: {
    entrada: MATERIAL + 'arquitectura/london_skyscraper_ejemplo4.glb',
    escala: 400,
    maxTextura: 512,
    soloColor: true,
    // Fachadas e interiores de los pisos: a 1:400 un error de 0,5 % (≈ 2 mm en la maqueta) no se ve
    simplificar: { nodos: /^(Building_Facade|Interior_Top|Glass_Generic|Top_Piece)/, ratio: 0.4, error: 0.005, planas: true },
    meshopt: true,
    hero: { quitar: /^(Lobby_|Furniture|Interior_Blinds|Color_Pallete)/, simplificar: undefined, simplificarTodo: { ratio: 0.2, error: 0.03, planas: true }, maxTextura: 256 }
  }
};

const pedidos = process.argv[2] === 'todos' ? Object.keys(recetas) : process.argv.slice(2);
if (!pedidos.length) console.log(`Uso: node preparar.mjs <${Object.keys(recetas).join('|')}|todos>`);
for (const id of pedidos) {
  const r = recetas[id];
  if (!r) { console.error(`No existe la receta «${id}»`); continue; }
  const { hero, ...principal } = r;
  console.log(`\n===== ${id} =====`);
  await optimizar({ ...principal, salida: `${MODELOS}${id}.glb` });
  if (hero) {
    console.log(`--- ${id} (versión liviana para el carrusel) ---`);
    await optimizar({ ...principal, ...hero, salida: `${MODELOS}${id}-hero.glb`, meshopt: true });
  }
}
