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
| 4 | Lee la información del proyecto (ficha) | `proyecto.html?id=casa-moderna` |
| 5 | Toca **VER EN AR** → maqueta en 3D → **Ver en mi espacio** abre la cámara | `ar.html?id=casa-moderna` |
| 6 | Vuelve con la flecha (a la ficha → a su carrera → a todas las carreras) y sigue explorando | — |

Los visitantes **nunca** inician sesión.

**¿Por qué una página por carrera (`carrera.html`) y no una sección que se despliega?** En el celular el botón «atrás» funciona como la persona espera, la dirección se puede compartir o grabar en la placa de un aula (por ejemplo `…/carrera.html?c=arquitectura`) y es fácil medir cuándo se eligió la carrera (hipótesis H1). Los enlaces viejos `index.html?c=…` redirigen solos a `carrera.html?c=…`.

### Diseño
- Mismo lenguaje visual que la referencia: hero con degradado Ecotec, titulares grandes en mayúsculas (Inter Tight), tarjeta blanca + tarjeta translúcida de datos, chips, botones circulares con flecha y tarjetas de carrera y de proyecto con imagen. Sin fondos azul oscuro.
- Colores Ecotec definidos en `css/estilos.css` (`--azul` #0662AE, `--azul-medio` #0489C9, `--celeste` #01B3E6, `--hielo` #DEF1FF y `--degradado`). Si cambias un color ahí, cambia en todo el sitio.
- **Responsive:** se diseñó primero para celular (una columna). Desde 900 px de ancho (monitor) aparece el marco redondeado, el menú, la maqueta en el centro del hero y las dos tarjetas de carrera lado a lado.
- **Carrusel del hero** (`js/carrusel.js`): el visor 3D grande (~60 % del alto en celular, 560 px en monitor) va rotando entre los proyectos cada 8 s con un fundido. Mientras se ve uno, el otro visor **precarga** el siguiente. Tiene nombre y carrera (que llevan a la ficha) y puntos para elegir. Se pausa con el mouse encima o al tocarlo (10 s). Con *reducir movimiento* no cambia ni gira solo.
  - El proyecto de video aparece como el televisor 3D con el **póster** en la pantalla, no con el video: así la portada no descarga 9 MB. La imagen `img/cuentos-y-espias-pantalla.webp` está **volteada verticalmente** a propósito, porque así la pide la textura.
  - Opcional por proyecto en el JSON: `ar.modeloHero` (versión liviana del modelo solo para el carrusel) y `ar.camaraHero` (encuadre).
- **El periodo** («SEMESTRE 2 - 2026» en la tarjeta blanca) sale de un solo lugar: `data/proyectos.json` → `"periodoActual"`.
- **Botón «volver»**: pastilla de 48 px con flecha y texto, arriba a la izquierda en todas las páginas. Carrera → «Todas las carreras». Ficha → «Proyectos de Arquitectura/Multimedia» (usa `nombreCorto` de la carrera para que entre en una línea). AR → «Volver al proyecto».

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
<model-viewer src="modelos/casa-moderna.glb" ar ar-modes="webxr scene-viewer quick-look" ar-placement="floor" camera-controls>
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

#### Tres modos de visualización (selector 📺 Televisor · 🎬 Sin televisor · 🌐 360°)
En los tres siguen la letra palabra por palabra, «Ocultar letra» y los controles. **El video nunca se reinicia**, porque siempre es el mismo `<video>`.

| Modo | Qué es | Cómo funciona |
|---|---|---|
| 📺 **Televisor** | El televisor retro con el video | Igual que antes |
| 🎬 **Sin televisor** | Solo la pantalla 16:9 con bordes redondeados, flotando, con un halo celeste y un reflejo de luz en la mesa | El `.glb` trae las dos versiones y solo se cambia la transparencia de los materiales. Se agranda y achica con los dedos igual que el televisor |
| 🌐 **360°** | «Cine curvo»: una pantalla curva gigante de 120° con el video **sin deformar**, un domo con los rayos de colores del video, siluetas de ciudad con ventanas y confeti | `js/cine-360.js` con three.js (se descarga solo al abrirlo). Se mira girando el celular (giroscopio; en iPhone pide permiso con un toque) o arrastrando con el dedo o el mouse. Funciona en Android, iPhone y computadora |

- Si se elige 360° **dentro de la AR** de Android, primero se cierra la AR y luego se abre el cine curvo; el audio sigue. model-viewer no permite poner una escena envolvente alrededor de la persona dentro de su AR.
- Botón «✕ Salir del 360°»: vuelve al modo anterior.
- En el JSON: `ar.modos` (qué modos se ofrecen) y `ar.modoInicial` (`televisor` o `sin-televisor`). El admin podrá editarlos en la Fase 5.
- Cada cambio se registra como el evento `modo_video` (para las métricas de la Fase 6).

**El modelo de la pantalla** se genera por código: `herramientas/pantalla-glb.js`. Con Node: `node --input-type=module -e "import('./herramientas/pantalla-glb.js').then(m => require('fs').writeFileSync('modelos/pantalla-cine.glb', m.crearPantallaGLB()))"`, o abre `herramientas/generar-pantalla.html` con Live Server y toca «Descargar».

#### Ficha de Multimedia
Solo tiene el video (con subtítulos), los créditos y «Ver la letra completa». El póster (`"portada"` en el JSON) se usa como portada: tarjeta de la carrera, fondo de la ficha y póster del video.

## 4. Estructura de archivos

```
vitrina-digital/
├── index.html          ← lo que abre la placa: hero + «Elige una carrera» (2 tarjetas)
├── carrera.html        ← proyectos de una carrera (?c=arquitectura / ?c=multimedia)
├── proyecto.html       ← información del proyecto + «Ver en AR»
├── ar.html             ← la experiencia AR (model-viewer)
├── placa.html          ← diseño imprimible de la placa (NFC + QR automático)
├── data/
│   └── proyectos.json  ← ★ TODO EL CONTENIDO. Lo único que edita el docente (H4)
├── modelos/
│   ├── casa-moderna.glb        ← maqueta 1:25 optimizada (947 KB, ver sección 7)
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
    ├── config.js       ← URL_PUBLICA (GitHub Pages) y URL de la placa
    ├── carrusel.js     ← carrusel de proyectos del hero
    ├── ar.js           ← lógica de la AR: modelo, puntos, guía, asistente
    ├── ar-propia.js    ← «Ver en mi espacio» de la maqueta con three.js + WebXR (gestos, botones, tutorial)
    ├── visor-planos.js ← galería de planos con visor grande y zoom
    ├── ar-video.js     ← pantalla de cine: video, sonido, controles, pantalla completa y modos
    ├── cine-360.js     ← modo 360° «cine curvo» (three.js, giroscopio)
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

**Proyecto actual: «Casa Moderna», de Madeleine Morales. Es un PROYECTO DE EJEMPLO** (`"ejemplo": true` en el JSON muestra la etiqueta amarilla en la ficha y en la tarjeta).
- **Modelo original:** «Modern Home» por Ciolan-T. Sebastian (Sketchfab, https://skfb.ly/6Yr8Q), licencia **CC BY 4.0**. La licencia **permite modificarlo y mostrarlo** si se nombra al autor, se enlaza la licencia y se indican los cambios; todo eso aparece en la ficha. **Adaptación del modelo:** Diana Espinoza (interiores, mobiliario y planos).
- **Planos:** 9 láminas (A-01 a A-09) en WebP de 2000 px (de 7,7 MB a 664 KB, más miniaturas de ~10 KB). En la ficha, al tocar una se abre el visor grande (`js/visor-planos.js`), que permite pellizcar con dos dedos, usar la rueda del mouse o los botones − / +, tocar dos veces para acercar y pasar de lámina con ‹ ›.
- **Textos:** la descripción, los 3 puntos y el asistente salen de la memoria descriptiva y de los cuadros de áreas, vanos y acabados de los planos. La materia sigue como `[EJEMPLO]`.

### Optimización (C2)
`herramientas/maqueta/optimizar.mjs` (con Node.js):
```bash
cd herramientas/maqueta && npm install
node optimizar.mjs ruta/al/original.glb ../../modelos/casa-moderna.glb 25
```
1. Pasa el modelo, que está en metros reales, a **maqueta 1:25** (59 × 26 cm en planta y 33 cm de alto), centrada y con la base en y = 0.
2. Junta los materiales de color liso en una paleta y une las mallas: de **339 a 6 llamadas de dibujo**, que era lo que hacía lento al celular. **No se simplifican los triángulos**: son solo 12 382 y así el interior queda intacto.
3. Texturas a **WebP**. **Sin Draco ni meshopt**: el archivo ya es chico y así el celular no tiene que descargar un decodificador.

| | Antes | Después |
|---|---|---|
| Peso | 2,1 MB (la casa anterior: 8,1 MB) | **947 KB** |
| Llamadas de dibujo / materiales | 339 / 33 | **6 / 6** |
| Triángulos | 12 382 | 12 382 |
| Tiempo hasta verse con 4G (9 Mbps, medido) | 3,3 s (la casa anterior: 9,8 s) | **1,7 s** |

En la página: mientras carga se ve el **póster** (`img/casa-moderna-render.webp`, una captura del modelo). La luz es el entorno neutro de model-viewer, sin descargas extra, y la sombra se calcula una vez cuando la maqueta está quieta. En la AR propia la sombra es una imagen, así que no hay sombras en tiempo real.

### Adelanto 3D (C3)
La propuesta de valor es **«Ver en mi espacio»**, por eso la vista 3D es solo un adelanto:
- gira sola y despacio, con giro horizontal limitado a ±40° y el ángulo vertical fijo, sin zoom ni desplazamiento;
- al tocar un punto aparece «Disponible en “Ver en mi espacio”»;
- el botón principal es grande, con un brillo que invita a tocarlo, y debajo dice «Ingresa a “Ver en mi espacio” para recorrer la maqueta».

En **computadora** se ve el mismo adelanto con un **QR** («Escanea con tu celular para verla en tu espacio»), que apunta a `URL_PUBLICA/ar.html?id=casa-moderna&src=qr`.
**Excepción en iPhone:** Quick Look no puede mostrar los puntos ni el asistente, así que en iPhone se leen completos en la vista 3D.

### «Ver en mi espacio» con AR propia (C4) — `js/ar-propia.js`
En Android con Chrome se usa una **AR propia con three.js + WebXR**: en la AR de model-viewer los gestos son fijos y un dedo mueve la maqueta en vez de girarla.

| Gesto / botón | Qué hace |
|---|---|
| 1 dedo arrastrando | Gira la maqueta sobre su eje (no la mueve de lugar) |
| 2 dedos pellizcando | Agranda / achica (solo en «Maqueta») |
| 2 dedos arrastrando | Mueve la maqueta sobre la mesa |
| Doble toque | Vuelve al tamaño y la posición de colocación |
| ⟲ ⟳ | Gira 45° con animación |
| − + | Achica / agranda |
| ⊙ Centrar | Lleva la maqueta al punto de la mesa al que apuntas |
| 🏠 Ver interior | Completa → **Sin techo** → **Planta baja**: un corte horizontal a la altura de cada losa (`ar.cortes` en el JSON) |
| Maqueta 1:25 / Escala real 1:1 | En 1:1 la casa mide 14,8 m: apunta al piso, colócala y camina dentro |
| ✕ Salir · ? | Salir · volver a ver el tutorial |

- **Inicio rápido:** three.js y el modelo se **precargan** mientras la persona mira el adelanto. Al entrar aparece «Buscando superficie…», luego una **retícula con la sombra de la casa** donde va a quedar, y un toque la coloca.
- **Tutorial de 3 pasos**, siempre al entrar: avanza solo cada 3 s o con un toque, tiene «Ocultar tutorial» en la esquina y «?» para volver a verlo. Registra `tutorial_ocultado` con el paso.
- Los puntos 1-2-3 siguen a la maqueta y se ven tenues si una pared los tapa; con «Ver interior» desaparecen los que quedan sobre el corte. La tarjeta y el asistente funcionan dentro de la AR.
- **Red de seguridad:** si el celular no soporta WebXR con hit-test y DOM overlay, o si algo falla al iniciar, se abre **automáticamente la AR de model-viewer**.
- **Interruptor para la presentación:**
  - `"configuracion": { "arPropia": false }` en `data/proyectos.json` usa siempre la AR anterior (el admin lo podrá cambiar en la Fase 5);
  - o abre `ar.html?id=casa-moderna&ar=clasica` para forzarla solo en ese celular.
- **iPhone:** Quick Look (AR de Apple). Antes de abrirlo aparece una hoja con sus gestos (arrastrar, girar con dos dedos, pellizcar, cambiar entre «AR» y «Objeto»).
- **Modo de prueba en la computadora:** `ar.html?id=casa-moderna&arprueba=1` abre la misma experiencia sin cámara, con el mouse. Lo usan las pruebas automáticas.

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

### Pruebas automáticas (carpeta `pruebas/`)
- `npm test` corre `qr.test.mjs` (el QR, ver abajo), `maqueta.test.mjs` (adelanto, QR de la maqueta, AR propia en modo de prueba, ficha y visor de planos), `video-modos.test.mjs` (Televisor → Sin televisor → 360° → salir, sin que el video se reinicie, en monitor y celular) y `carrusel.test.mjs`. Este último comprueba que el carrusel avance solo a los 8 s, que los puntos cambien de proyecto, que se pause con el mouse, que con *reducir movimiento* no avance y que el televisor muestre el póster.
- `node capturas.mjs` recorre todas las páginas en **390 px y 1440 px**: revisa que no haya errores en la consola ni scroll horizontal y guarda capturas en `pruebas/capturas/` (no se suben al repositorio).

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

- Modelo 3D original de Arquitectura: [Modern Home](https://skfb.ly/6Yr8Q) por Ciolan-T. Sebastian (Sketchfab), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptación del modelo: Diana Espinoza (interiores, mobiliario y planos); optimizado para celular.
- [three.js](https://threejs.org) 0.170 (licencia MIT): AR propia y modo 360°.
- Logo de la Universidad Ecotec: propiedad de la universidad.

- [model-viewer](https://modelviewer.dev) (Google, licencia Apache 2.0)
- Tipografía Poppins (Google Fonts)
