# Vitrina Digital en Ecotec · WebAR

Proyecto de Experiencias Inmersivas — Diana Espinoza, Arllys Ramos y Xavier Ponce.

Una placa NFC fuera del aula abre en el celular una galería de proyectos. Desde la ficha de un proyecto, el botón **«Ver en AR»** coloca la maqueta 3D sobre una mesa real, a escala, con 3 puntos de información y un asistente que responde preguntas sobre el proyecto. Sin instalar ninguna app.

---

## 1. El flujo completo (lo que vive la persona)

| Paso | Qué hace la persona | Archivo |
|---|---|---|
| 1 | Acerca el celular a la placa NFC (o escanea el QR) | La placa abre `index.html` |
| 2 | En «Elige una carrera» toca **Arquitectura** o **Multimedia y Producción Audiovisual** (toque 1) | `index.html` |
| 3 | Ve los proyectos de esa carrera y toca uno (toque 2) | `carrera.html?c=arquitectura` |
| 4 | Lee la información del proyecto (ficha) | `proyecto.html?id=mi-casa-mi-futuro` |
| 5 | Toca **VER EN AR** → maqueta en 3D → **Ver en mi espacio** abre la cámara | `ar.html?id=mi-casa-mi-futuro` |
| 6 | Vuelve con la flecha (a la ficha → a su carrera → a todas las carreras) y sigue explorando | — |

Los visitantes **nunca** inician sesión.

**¿Por qué una página por carrera (`carrera.html`) y no una sección que se despliega?** En el celular el botón «atrás» funciona como la persona espera, la dirección se puede compartir o grabar en la placa de un aula (por ejemplo `…/carrera.html?c=arquitectura`) y es fácil medir cuándo se eligió la carrera (hipótesis H1). Los enlaces viejos `index.html?c=…` redirigen solos a `carrera.html?c=…`.

### Diseño
- Mismo lenguaje visual que la referencia: hero con degradado Ecotec, titulares grandes en mayúsculas (Inter Tight), tarjeta blanca + tarjeta translúcida de datos, chips, botones circulares con flecha y tarjetas de carrera y de proyecto con imagen. Sin fondos azul oscuro.
- Colores Ecotec definidos en `css/estilos.css` (`--azul` #0662AE, `--azul-medio` #0489C9, `--celeste` #01B3E6, `--hielo` #DEF1FF y `--degradado`). Si cambias un color ahí, cambia en todo el sitio.
- **Responsive:** se diseñó primero para celular (una columna). Desde 900 px de ancho (monitor) aparece el marco redondeado, el menú, la maqueta en el centro del hero y las dos tarjetas de carrera lado a lado.
- En el inicio, la maqueta destacada gira sola: así la persona entiende desde el primer segundo que hay contenido 3D/AR.

### Modelo de negocio (B2B) y por qué implementarlo
El cliente es la universidad. El modelo tiene dos etapas:
1. **Etapa 1 · Prototipo gratis para Ecotec**, junto con los resultados de la prueba de usabilidad con 5 usuarios.
2. **Etapa 2 · Implementación:** un **pago único** por instalación y capacitación, más una **suscripción anual** que cubre hosting, licencia, soporte y actualizaciones.

Cuatro motivos para implementarlo:
- **Visibilidad:** el trabajo de los estudiantes se ve desde fuera del aula, a cualquier hora.
- **Multiformato:** maquetas 3D, video, imágenes y texto en un mismo lugar.
- **Actualizable:** cada semestre se cambia el contenido sin reimprimir nada.
- **Orientación vocacional:** los visitantes y colegiales entienden qué se hace en cada carrera.

## 2. Cómo se siente la experiencia AR, momento a momento

Esto es lo que hace que la AR "se sienta" bien: la persona **siempre sabe qué hacer**.

1. **Entra a la página AR.** Ve la maqueta en 3D sobre un fondo claro. Puede girarla con el dedo. Ya ve los 3 puntos numerados latiendo (invitan a tocarlos).
2. **Toca «Ver en mi espacio».** Se abre la cámara.
3. **Busca la superficie.** Aparece un celular animado moviéndose de lado a lado con el texto *«Apunta a una mesa o al piso y mueve el celular despacio»*. (Es el `slot="ar-prompt"`).
4. **La maqueta aparece sobre la mesa,** con sombra en la superficie, como si estuviera ahí. Mensaje: *«¡Listo! Camina alrededor y toca los puntos numerados…»*.
5. **Explora:** camina alrededor, se acerca, arrastra para moverla, pellizca para cambiar el tamaño.
6. **Toca un punto (1, 2 o 3):** el punto se ilumina y aparece una tarjeta abajo con la explicación.
7. **Pregúntale a la maqueta:** toca el botón, elige una pregunta sugerida o escribe la suya. La respuesta aparece en la tarjeta, **se lee en voz alta** y **se resalta el punto** de la maqueta al que se refiere.
8. Si se pierde el rastreo (poca luz, se movió rápido): *«Se perdió la superficie. Apunta otra vez a la mesa con buena luz»*.

## 3. Cómo funciona por dentro

Todo el AR lo hace **`<model-viewer>`**, un componente web gratuito de Google. Se carga con una sola línea en `ar.html`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>
```

y se usa como una etiqueta HTML:

```html
<model-viewer src="modelos/mi-casa-mi-futuro.glb" ar ar-modes="webxr scene-viewer quick-look" ar-placement="floor" camera-controls>
  <button slot="hotspot-ventanal" data-position="-0.08 0.07 0.096" data-normal="0 0 1">1</button>
</model-viewer>
```

- **`ar`** activa la realidad aumentada.
- **`ar-modes`** decide qué tecnología usar según el celular (ver tabla de abajo).
- **`ar-placement="floor"`** busca superficies horizontales: mesa o piso.
- **Los puntos de información** son botones HTML normales con `slot="hotspot-…"`. `data-position` es la coordenada 3D en **metros** dentro del modelo. model-viewer los mueve para que sigan a la maqueta cuando la giras o caminas alrededor.
- **Eventos** que usa `js/ar.js` para guiar a la persona: `ar-status` (`session-started`, `object-placed`, `failed`, `not-presenting`) y `ar-tracking` (`tracking` / `not-tracking`).

### Qué pasa en cada celular

| Dispositivo | Tecnología AR | Puntos y asistente dentro de la AR |
|---|---|---|
| Android con Chrome (con ARCore / "Servicios de Google Play para RA") | **WebXR** dentro del navegador | ✅ Sí, todo se ve encima de la cámara |
| Android sin WebXR | Scene Viewer (app de Google) | ❌ Solo la maqueta |
| iPhone con Safari | **Quick Look** (AR nativa de Apple) | ❌ Solo la maqueta (Apple no permite HTML encima) |
| Computadora | Solo visor 3D | ✅ Puntos y asistente en 3D |

**Importante para la presentación y la validación:** en iPhone la maqueta sí aparece sobre la mesa, a escala y se puede rodear, pero los puntos y el asistente se usan **en la vista 3D** (antes o después de entrar a la AR). Es una limitación de iOS, no del proyecto. Regístrenlo como hallazgo en la métrica de compatibilidad.

### AR del proyecto de Multimedia: pantalla de cine con letra
`ar.html?id=cuentos-y-espias` coloca sobre la mesa un **televisor retro** (`modelos/pantalla-cine.glb`, pantalla 16:9 de 60 cm de ancho) que **reproduce el video con su audio**. La letra aparece **palabra por palabra** al ritmo de la canción, leída de `videos/cuentos-y-espias.es.vtt`.

- **Un solo video para todo.** model-viewer crea el `<video>` con `createVideoTexture()`. `js/ar-video.js` lo controla y `js/karaoke.js` dibuja la letra. Como es el mismo video, el sonido sigue igual al entrar y salir de la AR y nunca suena dos veces.
- **Controles:** reproducir/pausar, sonido sí/no, reiniciar, barra de progreso, **Ocultar letra / Mostrar letra** (se recuerda en el celular) y pantalla completa.
- **Sonido:** los navegadores no dejan sonar un video solo. El video arranca cuando la persona toca ▶, con sonido. Si el navegador igual lo bloquea, arranca en silencio y aparece el botón grande **«🔊 Activar sonido»**.
- **Letra:** la etiqueta muestra la sección (VERSO 1, PRE-CORO, CORO…). Los créditos van con otro estilo. Se ven como máximo 2 líneas: la actual y la anterior, más tenue. Si el celular tiene activado *reducir movimiento*, cada línea aparece entera.
- **Para cambiar los tiempos de la letra:** edita `videos/cuentos-y-espias.es.vtt` (formato `00:00:07.400 --> 00:00:10.800`). El identificador de cada línea (`verso1-1`, `coro-3`, `credito-1`…) decide su sección.

| Dispositivo | Qué ve la persona |
|---|---|
| Android con Chrome (WebXR) | La pantalla de cine sobre la mesa, con video, sonido, letra y controles encima de la cámara |
| iPhone | **Limitación de Apple:** Quick Look no reproduce video. Al tocar «Ver con la letra» se abre un **reproductor propio a pantalla completa** con la misma letra animada y los mismos botones, y un aviso amable |
| Android sin WebXR / computadora | Vista 3D con el video en el televisor, y «Ver con la letra» a pantalla completa |

> En iPhone no hay hoy una alternativa mejor sin instalar apps: Safari no tiene WebXR para AR, y Quick Look (USDZ) no admite texturas de video. Las plataformas de WebAR de pago (por ejemplo 8th Wall) podrían hacerlo, pero cuestan dinero y dependen de un servicio externo.

**El modelo de la pantalla** se genera por código: abre `herramientas/generar-pantalla.html` con Live Server y toca «Descargar». El código está en `herramientas/pantalla-glb.js`.

## 4. Estructura de archivos

```
vitrina-digital/
├── index.html          ← lo que abre la placa: hero + «Elige una carrera» (2 tarjetas)
├── carrera.html        ← proyectos de una carrera (?c=arquitectura / ?c=multimedia)
├── proyecto.html       ← información del proyecto + «Ver en AR» + «Escuchar ficha»
├── ar.html             ← la experiencia AR (model-viewer)
├── placa.html          ← diseño imprimible de la placa (NFC + QR automático)
├── data/
│   └── proyectos.json  ← ★ TODO EL CONTENIDO. Lo único que edita el docente (H4)
├── modelos/
│   ├── mi-casa-mi-futuro.glb   ← maqueta de referencia optimizada (8 MB, ver sección 7)
│   └── pantalla-cine.glb       ← televisor retro para la AR de Multimedia (generado por código)
├── videos/
│   ├── cuentos-y-espias.mp4    ← video 720p (9 MB, H.264 + AAC)
│   └── cuentos-y-espias.es.vtt ← letra con tiempos (subtítulos)
├── herramientas/       ← generador del .glb de la pantalla (no es parte del recorrido)
├── img/                ← imágenes de las fichas (de ejemplo, reemplazar)
├── css/
│   ├── estilos.css     ← estilos generales (colores Ecotec)
│   └── ar.css          ← estilos de la página AR
└── js/
    ├── datos.js        ← lee el JSON (compartido)
    ├── ar.js           ← lógica de la AR: modelo, puntos, guía, asistente
    ├── ar-video.js     ← pantalla de cine: video, sonido, controles, pantalla completa
    ├── karaoke.js      ← letra palabra por palabra sincronizada con el video
    ├── metricas.js     ← registro anónimo de eventos (se conecta a Supabase en la Fase 6)
    └── asistente.js    ← «Pregúntale a la maqueta»
```

No hay que instalar nada (sin npm, sin compilar). Son archivos estáticos.

## 5. Correrlo en VS Code

1. Abre la carpeta `vitrina-digital` en VS Code (**File → Open Folder**).
2. Instala la extensión **Live Server** (de Ritwick Dey).
3. Clic derecho en `index.html` → **Open with Live Server**. Se abre en `http://127.0.0.1:5500`.

> ⚠️ No abras `index.html` con doble clic (`file://…`): el navegador bloquea la lectura del JSON. Siempre con Live Server.

En la computadora verás todo el flujo y la maqueta en 3D con sus puntos y el asistente. **La AR solo funciona en el celular.**

## 6. Probarlo en tu celular (necesita HTTPS)

El celular solo abre la cámara para AR si la página está en **HTTPS**. Dos caminos:

### Opción A — rápida, para desarrollar (puerto reenviado de VS Code)
1. Con Live Server corriendo, abre el panel **Ports** (Puertos) en VS Code (abajo, junto a Terminal).
2. **Forward a Port** → escribe `5500`. Te pedirá iniciar sesión con GitHub.
3. Clic derecho sobre el puerto → **Port Visibility → Public**.
4. Copia la dirección `https://…devtunnels.ms` y ábrela en el celular.

### Opción B — definitiva, para la placa y la prueba con usuarios (GitHub Pages, gratis)
1. Sube la carpeta a un repositorio de GitHub (desde VS Code: ícono **Source Control → Publish to GitHub**).
2. En GitHub: **Settings → Pages → Branch: main / root → Save**.
3. En 1–2 minutos tendrás `https://TU-USUARIO.github.io/vitrina-digital/`. **Esa es la URL que va en la placa NFC.**
4. Cada semestre: se edita `data/proyectos.json`, se sube el cambio, y la placa sigue igual.

(Netlify Drop también sirve: arrastras la carpeta a app.netlify.com/drop y te da una URL HTTPS.)

## 7. La maqueta de Arquitectura

**Modelo actual (de referencia):** «Modern Coastal Hillside Villa» por Visthétique (Sketchfab, https://skfb.ly/pKVRs), con licencia **CC BY 4.0**. Esa licencia obliga a nombrar al autor, enlazar la licencia e indicar los cambios, y eso ya aparece en la ficha. El original (113 MB, 949 mil triángulos) **no se sube al repositorio**.

Cómo se optimizó (scripts en `herramientas/maqueta/`, con Node.js):
1. `optimizar.mjs`: quita el auto, los árboles del borde del lote y la grifería, que mide menos de 1 cm a esta escala. Escala la maqueta a **68 × 51 cm** en planta y 16 cm de alto, centrada y con la base en y = 0, y une y simplifica la geometría (de 949 mil a 229 mil triángulos y de 210 a 37 mallas).
2. `texturas.mjs`: pasa las texturas a **WebP de máximo 1024 px** y comprime la geometría con **Draco**. Resultado: **8 MB**.

```bash
cd herramientas/maqueta && npm install
node optimizar.mjs ruta/al/original.glb intermedio.glb 0.68 0.25 0.002
node texturas.mjs intermedio.glb ../../modelos/mi-casa-mi-futuro.glb 1024
```
> Son dos pasos separados a propósito: en Windows, `sharp` (texturas) falla si corre en el mismo proceso que la geometría pesada.

Los 3 puntos están sobre partes reales de esta casa: **terraza sobre la cochera** (adelante), **ventanales hacia la piscina** y **piscina** (atrás). Sus textos siguen marcados `[EJEMPLO]` hasta tener la ficha real de la estudiante. La escala «aprox. 1:60» es una estimación hecha a partir del tamaño del auto y de las puertas del modelo.

En el inicio, la maqueta se descarga **después** de que la página terminó de cargar (y no se descarga con «ahorro de datos»), para que las carreras aparezcan rápido.

### Para usar el modelo propio de la estudiante

1. **Exportar desde Blender:** File → Export → **glTF 2.0** → Format: **glTF Binary (.glb)**. Marca *Apply Modifiers*, deja *+Y Up*.
2. **Escala:** model-viewer trabaja en **metros**. Para una maqueta 1:50 de una casa de 15 m de ancho, el modelo debe medir 0,30 m. En Blender, escala el objeto y aplica la escala (Ctrl+A → Scale). Coloca el **origen en la base** del modelo (para que se apoye sobre la mesa y no quede flotando ni enterrado).
3. **Peso:** que el `.glb` pese **menos de 10 MB** (ideal 2–5 MB). Para comprimirlo, arrástralo a **gltf.report** y usa la opción de compresión, o reduce texturas a 1024 px.
4. Guárdalo en `modelos/` y cambia la ruta en el JSON: `"modelo": "modelos/tu-archivo.glb"`.
5. **Ubicar los 3 puntos:** abre **modelviewer.dev/editor**, arrastra tu `.glb`, entra a la pestaña de *Hotspots*, haz clic en el modelo donde quieres cada punto y copia los valores `data-position` y `data-normal` al JSON (`"posicion"` y `"normal"`).

## 8. La placa: QR (hoy) y NFC (después)

**La dirección pública está en un solo lugar:** `js/config.js` → `URL_PUBLICA = 'https://dianapapo.github.io/vitrina-digital/'`.

- **QR (método principal por ahora).** `placa.html` lo genera a partir de `URL_PUBLICA`, así que apunta al sitio publicado **aunque abras la placa en tu compu**. Abre `…/index.html?src=qr`. El `?src=qr` sirve para que las métricas (Fase 6) sepan que la visita llegó por el QR.
- **Descargas para imprenta:** botones «Descargar QR (PNG)», de unos 2.000 px, y «Descargar QR (SVG)», vectorial. Los dos traen el margen blanco reglamentario de 4 módulos y corrección de errores media (M).
- **Imprimir la placa:** botón «Imprimir placa» o Ctrl+P (10 × 15 cm). La zona punteada «Acerca tu celular» queda para el chip.
- **NFC (más adelante):** la placa muestra la dirección `…/index.html?src=nfc` con un botón «Copiar». Compra etiquetas **NTAG213 o NTAG215**, instala **NFC Tools** → Escribir → Añadir un registro → URL → pega la dirección → Escribir, y acerca la etiqueta. Pégala detrás de la zona punteada.

### Prueba automática del QR
`pruebas/qr.test.mjs` abre `placa.html` en Chrome y **decodifica** con jsQR el QR de la pantalla, el PNG y el SVG descargados. Comprueba que los tres apuntan exactamente a `https://dianapapo.github.io/vitrina-digital/index.html?src=qr`, que esa URL abre el inicio y que no hay errores en la consola.

```bash
cd pruebas
npm install      # solo la primera vez
npm test
```

## 9. El asistente «Pregúntale a la maqueta»

Archivo: `js/asistente.js`. Datos: `asistente.pasajes` en el JSON.

- Cada pasaje es una frase corta de la ficha, ligada a un punto de la maqueta (`"punto": "ventanal"`) o a ninguno (`null`), con sus palabras `claves`.
- Cuando la persona pregunta, se normaliza el texto (sin tildes ni signos), se compara con las claves y el texto de cada pasaje, y se devuelve el que más coincide. Reconoce variaciones: *dormitorio* ≈ *dormitorios*.
- Si nada coincide lo suficiente: *«No tengo esa información…»*. **Nunca inventa**: solo devuelve lo que cargaron el estudiante y el docente.
- La respuesta se muestra, se lee en voz alta (`speechSynthesis`, viene en el navegador) y resalta el punto en la maqueta.
- No usa servidor, no guarda datos de nadie, no usa cámara ni micrófono para la IA.

**Fase 2 (búsqueda semántica con Transformers.js):** reemplazar la función `puntuar()` por una comparación de *embeddings* con `@huggingface/transformers`. La función `responder()` devuelve lo mismo, así que `ar.js` no cambia. Ojo: los modelos multilingües pesan ~100 MB, demasiado para un celular frente a un aula; por eso el MVP usa palabras clave.

## 10. Qué editar para cada proyecto (guía para el docente — H4)

Abrir `data/proyectos.json` y, dentro de `"proyectos"`, copiar un bloque `{ … }` y cambiar:

- En `"carreras"`: `nombre`, `descripcion`, `icono` (`arquitectura` o `multimedia`) y `orden` (1 = primera tarjeta del inicio)
- `id` (sin espacios ni tildes: `mi-proyecto`), `carrera` (`arquitectura` o `multimedia`)
- `titulo`, `ubicacion`, `estudiante`, `materia`, `periodo`, `descripcion`
- `imagenes` (ruta + texto alternativo, que describe la imagen para lectores de pantalla)
- `ar`: `null` si no tiene AR, o el bloque con modelo y puntos
- Borrar todas las marcas `[EJEMPLO]`

> Consejo: valida el JSON en **jsonlint.com** si la página deja de cargar (casi siempre es una coma de más o de menos).

## 11. Checklist antes de la prueba con 5 usuarios

- [ ] La URL de la placa es HTTPS y abre `index.html`
- [ ] NFC probado en un Android y un iPhone; QR de respaldo funciona
- [ ] La maqueta real carga en menos de ~5 s con datos móviles
- [ ] La maqueta se apoya sobre la mesa (no flota ni se hunde) y tiene tamaño razonable
- [ ] Los 3 puntos están sobre los elementos correctos
- [ ] Las 3 preguntas sugeridas devuelven la respuesta correcta
- [ ] Se borraron todos los `[EJEMPLO]`
- [ ] Mesa con buena luz y superficie con textura (el vidrio y las mesas blancas brillantes cuestan detectarse)

## Créditos técnicos

- Modelo 3D de referencia: [Modern Coastal Hillside Villa](https://skfb.ly/pKVRs) por Visthétique (Sketchfab), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modificado: sin auto, sin árboles del borde ni grifería, geometría simplificada y texturas optimizadas.
- Logo de la Universidad Ecotec: propiedad de la universidad.

- [model-viewer](https://modelviewer.dev) (Google, licencia Apache 2.0)
- Tipografía Poppins (Google Fonts)
