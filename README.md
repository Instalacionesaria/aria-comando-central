# AIOS — Command Center

Port a Next.js del prototipo `aios-command-center_1.html`.

**Producción:** https://aria-comando-central.vercel.app

Vercel está conectado a este repo: cada push a `main` despliega a
producción y cada rama o PR genera su propia URL de vista previa. El
proyecto vive en el scope `instalacionesariaia-1374s-projects` y Next.js
se detecta solo — no hace falta `vercel.json`.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

No hay `npm run lint`: `next lint` se eliminó en Next 16. Si quieres
linter, hay que montar ESLint o Biome a mano.

## Qué se hizo con el HTML original

El prototipo era un único archivo de 6.689 líneas: CSS con design tokens,
markup de diez vistas y una capa de JavaScript imperativo que pinta el
contenido con `innerHTML` a partir de datos de ejemplo.

El port lo separa **sin reescribir la lógica**, para que el resultado sea
idéntico píxel a píxel y la reactificación pueda hacerse vista por vista
más adelante:

| Capa del original | Dónde vive ahora |
|---|---|
| `<style>` (2.399 líneas) | `app/aios.css`, íntegro y sin tocar |
| `<body>` (908 líneas) | `components/` y `components/views/`, convertido a JSX |
| `<script>` (3.365 líneas) | `lib/aios/`, un módulo por cada IIFE del original |

## Estructura

```
app/
  layout.js          fuentes (next/font), <html lang="es">, metadata
  page.js            monta <CommandCenter />
  globals.css        capas, tokens hacia Tailwind, fuentes
  aios.css           la hoja de estilos original, intacta
components/
  CommandCenter.jsx  'use client' — arma el esqueleto y arranca lib/aios
  IconSprite.jsx     sprite <symbol> de los iconos
  TopBar.jsx  Nav.jsx  SidePanel.jsx  AskBar.jsx  Overlays.jsx
  views/             una por sección del menú
lib/aios/
  index.js           bootAios(): llama a los 15 módulos en el orden original
  datepicker.js  shell.js  creative.js  conversion.js  leads-portal.js
  executive.js  executive-panel.js  executive-chat.js
  acquisition.js  acquisition-plan.js  period-controls.js
  conversation.js  closer.js  closer-contact.js  leads-group.js
```

### Cómo encaja React con la capa imperativa

`CommandCenter` sólo renderiza el esqueleto: los contenedores vacíos
(`#exBrief`, `#acqKpis`, `#lpGrid`…) que el original también tenía en el
HTML. Después de montar, un `useEffect` llama a `bootAios()`, que ejecuta
los quince módulos en el mismo orden en que corrían en el `<script>`. El
orden importa: unos registran callbacks (`window.AIOSDate._cbs`,
`window.AIOSLeadCard`, `window.AIOSLeads`) que otros consumen.

`bootAios()` tiene un guard de una sola ejecución porque los módulos
enganchan listeners en `document` y añaden nodos sueltos al `<body>`; sin
él, el doble montaje de React StrictMode los duplicaría.

**Consecuencia práctica:** el estado de las vistas no está en React. Para
reactificar una vista hay que reescribir su módulo de `lib/aios/` como
componente con estado y quitarlo de la lista de `lib/aios/index.js`.

## Estilos

`app/aios.css` es la única fuente de verdad de los tokens (`--bg`,
`--accent`, `--exec`…). Tailwind v4 está montado encima con dos
precauciones que conviene no deshacer:

1. **Sin preflight.** El reset del diseño (`* { margin:0; padding:0 }`) ya
   hace ese trabajo y el de Tailwind cambiaría tipografías y bordes.
2. **Con prefijo `tw:`.** El diseño usa clases semánticas que colisionan
   con utilidades de Tailwind — `ring`, `hidden` y cualquier otra que
   aparezca en el futuro. Se escribe `tw:flex`, `tw:bg-bg-panel`,
   `tw:text-accent`, `tw:shadow-2`.

Los tokens están expuestos como utilidades vía `@theme inline`, así que
apuntan a la variable CSS en vez de copiar su valor: cambiar `--accent` en
`aios.css` cambia también `tw:text-accent`.

`aios.css` se importa dentro de la capa `aios`. Sin capa, su reset con
selector `*` ganaría a **toda** utilidad de Tailwind, porque el CSS sin
capa tiene prioridad sobre cualquier `@layer`.

## Datos

Todos los números son de ejemplo y viven dentro de los módulos de
`lib/aios/`, tal como en el prototipo. Al conectar datos reales conviene
sacarlos a `lib/data/` primero y dejar los módulos leyendo de ahí.

## Comprobar que no se rompió nada

```bash
npm run dev            # en otra terminal
npm run paridad
```

`scripts/paridad.mjs` abre el prototipo original y la app en paralelo y
compara, vista por vista, la forma del DOM, el texto y la geometría de
cada elemento; después recorre catorce interacciones (calendario, drawers,
modales, ficha de lead, pestañas del closer, Ask Executive, organigrama).
Sale con código 1 si algo difiere.

Es la red de seguridad para reactificar: reescribes un módulo de
`lib/aios/` como componente React y vuelves a pasarlo.

Ruido conocido y ya descontado: los cuatro `circle.pulse` que recorren el
mapa ejecutivo tienen una animación SVG, así que su posición nunca
coincide entre dos capturas — ni siquiera del original consigo mismo.
