// Servidor estático mínimo para las pruebas: sirve la carpeta del sitio en un puerto libre.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.vtt': 'text/vtt'
};

export async function levantarServidor() {
  const servidor = createServer(async (pedido, respuesta) => {
    const ruta = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    const archivo = normalize(join(RAIZ, ruta === '/' ? 'index.html' : ruta));
    if (!archivo.startsWith(normalize(RAIZ))) { respuesta.writeHead(403).end(); return; }
    try {
      const datos = await readFile(archivo);
      respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' }).end(datos);
    } catch {
      respuesta.writeHead(404).end();
    }
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${servidor.address().port}/`, cerrar: () => servidor.close() };
}
