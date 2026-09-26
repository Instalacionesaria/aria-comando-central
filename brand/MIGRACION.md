# Inventario para migrar a la marca v2

Lo que hay hoy hardcodeado, dónde está y con qué token del brandbook se reemplaza. **Nada de esto
está migrado todavía**: la Fase 1 instaló el sistema sin tocar una sola pantalla. Este archivo es
la lista de trabajo de la Fase 2, que es de a una pantalla por vez.

Medido con un barrido sobre `app/`, `components/` y `lib/` (se excluyen `pruebas/`, `docs/`, `db/`
y el propio `app/brand/`, que ya es el sistema nuevo).

## El tamaño del problema

| Qué | Cuántos |
|---|---|
| Archivos con valores hardcodeados | 17 |
| Literales hex | 263 (**150 distintos**) |
| `rgb()` / `rgba()` | 599 |
| Degradados | 85 |
| `box-shadow` | 92 |
| `font-family` | 43 |

**El número que manda no es el de los hex: son los 599 `rgba()`.** El diseño heredado construye casi
todo con canales sueltos (`--c-acento: 63 242 226`) y los compone al vuelo con `rgb(var(--c-x) / .14)`.
Eso no se reemplaza con una búsqueda: hay que decidir, caso por caso, si esa transparencia era un
color o era una superficie — y en el sistema nuevo casi siempre es una superficie.

## Por pantalla

| Archivo | Pantalla | hex | rgba | grad | sombra | fuente | total |
|---|---|---|---|---|---|---|---|
| `app/aios.css` | Base de las 10 vistas del prototipo | 27 | 337 | 76 | 71 | 15 | **526** |
| `app/temas.css` | Los dos temas (oscuro/claro) | 198 | 31 | 1 | 6 | 0 | **236** |
| `app/operacion-estetica.css` | Closer, Setter, Ajustes, ICP, Tools, Monitoreo, Inteligencia | 0 | 101 | 1 | 7 | 1 | **110** |
| `app/fundaciones.css` | ICP & Oferta | 1 | 51 | 5 | 4 | 8 | **69** |
| `app/closer.css` | Closer (ficha de contacto) | 5 | 40 | 0 | 0 | 1 | **46** |
| `app/entrar/entrar.css` | Login | 22 | 11 | 0 | 2 | 8 | **43** |
| `app/inteligencia-estetica.css` | Los cinco tableros | 0 | 15 | 0 | 0 | 0 | **15** |
| `app/ajustes.css` | Ajustes | 0 | 0 | 2 | 1 | 4 | **7** |
| `app/auditoria.css` | Auditoría de agentes | 0 | 4 | 0 | 0 | 3 | **7** |
| `app/globals.css` | La guarda de sesión | 5 | 0 | 0 | 0 | 2 | **7** |
| `app/armazon.css` | Armazón (menú de cuenta) | 0 | 3 | 0 | 1 | 0 | **4** |
| `lib/fundaciones/exportar.ts` | Exportación a PDF | 3 | 0 | 0 | 0 | 1 | **4** |
| `components/views/ExecutiveView.jsx` | Ejecutivo | 2 | 1 | 0 | 0 | 0 | **3** |
| `lib/aios/executive.js` | Ejecutivo (imperativo) | 0 | 2 | 0 | 0 | 0 | **2** |
| `app/monitoreo.css` | Panel de monitoreo | 0 | 1 | 0 | 0 | 0 | **1** |
| `components/negocio/Comision.jsx` | Comisión | 0 | 1 | 0 | 0 | 0 | **1** |
| `lib/aios/leads-portal.js` | Portal de leads | 0 | 1 | 0 | 0 | 0 | **1** |

## El mapeo que sirve: token viejo → token nuevo

No migres hex por hex. Casi todos los literales entran por uno de estos tokens, así que el trabajo
real es reemplazar **el token**, y los hex caen solos.

### Fondos

| Hoy | Valor | Brandbook | Valor | Nota |
|---|---|---|---|---|
| `--bg` | `#03050a` | `--bg` | `#04060A` | Fondo de página. |
| `--bg-fondo` | `#030509` | `--bg` | `#04060A` | Duplicado histórico de `--bg`. |
| `--bg-sunk` | `#05080f` | `--bg` | `#04060A` | El brandbook no tiene «hundido»: la profundidad se dibuja con borde, no con fondo. |
| `--bg-hondo` | `#06090f` | `--bg-alt` | `#070A10` | Es el `#06090f` del pedido. |
| `--bg-panel` | `#080d15` | `--bg-alt` | `#070A10` | Paneles y secciones. |
| `--bg-raise` | `#0c121c` | `--surface-raised` | `#0A0F18` | Campos de entrada. |
| `--bg-cajon` | `#0d1420` | `--surface-active` | `#0D1420` | **Coincide exacto.** |
| `--bg-float` / `--bg-flota` | `#111826` / `#101825` | `--surface-active` | `#0D1420` | Dos nombres para lo mismo; se unifican. |

### Líneas y texto

| Hoy | Valor | Brandbook | Valor |
|---|---|---|---|
| `--line` | `rgb(170 212 255 / 0.15)` | `--line` | `#151B26` |
| `--line-strong` | `rgb(170 212 255 / 0.28)` | `--line-strong` | `#242C3A` |
| `--txt` | `#eaf2fb` | `--ink` | `#F2F5F9` |
| `--txt-dim` | `#a6b8ce` | `--ink-2` | `#AAB3C1` |
| `--txt-faint` | `#93a4bb` | `--ink-3` | `#7F8A9B` |

`--ink-4` (`#4F5968`) no tiene equivalente hoy y **no se usa para texto**: es decorativo. Si al migrar
aparece texto que quedaría por debajo de `--ink-3`, el problema es la jerarquía, no el color.

### Acentos y estados — acá hay decisiones, no reemplazos

| Hoy | Valor | Brandbook | Valor | Qué cambia de verdad |
|---|---|---|---|---|
| `--accent` | `#3ff2e2` | `--accent` | `#8FE3FF` | **Cambia el tono.** El acento pasa de verde-cian a cian claro. Es el cambio más visible de toda la migración. |
| `--etapa-agendado` | `#35e0d2` | `--accent` | `#8FE3FF` | El `#35e0d2` del pedido, 9 ocurrencias. |
| `--accent-alto` | `#78fff0` | `--accent` | `#8FE3FF` | El brandbook tiene **un solo** acento: las variantes alto/hondo desaparecen. |
| `--accent-hondo` | `#23b3a8` | `--accent` | `#8FE3FF` | Ídem. |
| `--dev` | `#9a8bff` | `--accent-2` | `#B9A6FF` | Violeta, «sólo como detalle puntual». |
| `--exec` | `#ffc554` | `--signal` | `#E0C073` | Atención. |
| `--warn` | `#ff9550` | `--signal` | `#E0C073` | Se funde con el anterior: el brandbook tiene un solo nivel de atención. |
| *(dorado suelto)* | `#e8b64c` | `--signal` | `#E0C073` | El `#e8b64c` del pedido, 4 ocurrencias. |
| `--crit` | `#ff6a6a` | `--alert` | `#FF8C7A` | Incidencia. |
| `--sobre-acento` | `#04121a` | `--on-ink` | `#04060A` | Texto sobre relleno. |

**`--ok` (`#55eb8c`) no tiene reemplazo, y es la decisión pendiente más importante.** El brandbook no
tiene un verde de éxito: su regla 3 dice que *el rojo señala y `--accent` es «lo correcto»*. O sea
que todo lo que hoy es verde de «salió bien» pasaría a cian. Hay que confirmarlo antes de migrar la
primera pantalla que lo use, porque afecta al Pipeline, a las colas del Closer y a los cinco
tableros a la vez.

Lo mismo con los **14 colores de etapa** (`--c-etapa-nuevo`, `--c-etapa-ganado`, `--c-etapa-no-show`…):
el brandbook no contempla una paleta categórica. O se declaran como extensión documentada del
sistema, o las etapas pasan a distinguirse por texto y borde en vez de por color.

### Tipografía

| Hoy | Brandbook |
|---|---|
| `--font-ui` → Inter (`next/font/google`) | `--font-sans` → **Geist** |
| `--font-mono` → IBM Plex Mono | `--font-mono` → **Geist Mono** |

**Corrección al pedido:** Space Grotesk y JetBrains Mono **no existen en este repositorio** — cero
ocurrencias. Las familias a reemplazar son Inter e IBM Plex Mono. Ambas ya están cargadas junto a
Geist en `app/layout.js`; la migración consiste en repuntar `--font-ui` y `--font-mono` y **borrar**
las dos cargas viejas de `next/font/google`.

Además, el brandbook manda una regla que hoy no se cumple en ningún titular: **dos líneas, la
primera en peso 200 y la segunda en 500, con `letter-spacing: -0.035em`**. Eso no es un reemplazo de
token: hay que rehacer el markup de cada titular.

### Sombras y degradados — esto es lo que más duele

| Qué | Cuántos | Qué dice el brandbook |
|---|---|---|
| `box-shadow` | 92 | **Se eliminan todos.** La única sombra permitida es `--glow-orb`, y sólo bajo la mascota o la ventana de producto. |
| Degradados | 85 | **Se eliminan todos.** «Sin sombras ni degradados en tarjetas o textos.» |
| `--sh-1`, `--sh-2`, `--sh-3`, `--hair` | — | Desaparecen. La estructura se dibuja con bordes de 1px `--line`. |

Son 177 lugares donde no alcanza con cambiar un valor: hay que **quitar la propiedad y comprobar que
la jerarquía visual se sostiene sola**. En `app/aios.css` están concentrados (76 degradados y 71
sombras de los totales), y es justamente la hoja que no se puede tocar sin sacar su vista de
`paridad`.

## El orden que propongo

De menor a mayor riesgo, para que los primeros pasos enseñen antes de tocar lo caro:

1. **Login** (`app/entrar/entrar.css`, 43) — pantalla aislada, no está en `paridad`, y es donde el
   brandbook pide la mascota con `follow`. Es la prueba de fuego más barata.
2. **Ajustes, Auditoría, Monitoreo, Armazón** (19 en total) — no existen en el prototipo, así que
   `aios.css` no tiene nada que decir sobre ellas y no hay paridad que romper.
3. **Los cinco tableros** (`app/inteligencia-estetica.css`, 15) — ya salieron de `paridad` en su
   etapa.
4. **ICP & Oferta** (`app/fundaciones.css`, 69) — ya está fuera de `paridad` desde la Etapa 9.
5. **Closer y Setter** (`closer.css` + buena parte de `operacion-estetica.css`, ~150).
6. **`app/temas.css`** (236) — el corazón. Cuando llegue acá, casi todo lo anterior ya cambió de
   token y este archivo se reduce en vez de reescribirse.
7. **`app/aios.css`** (526) — lo último, y vista por vista. Cada vista que se migre **sale de la
   lista `VISTAS` de `scripts/paridad.mjs`**, con el motivo escrito en el `docs/ETAPA-N` de su etapa.
   Es la regla que el README ya fija: una vista migrada deja de coincidir con el prototipo a
   propósito, y dejarla en la lista daría un rojo permanente que se ignora — y con él se ignoran
   los demás.

## Lo que no se puede migrar con tokens

- **`lib/fundaciones/exportar.ts`** (3 hex + 1 familia): genera PDF con `jspdf`, que no lee variables
  CSS. Necesita leer `brand/tokens.json` en tiempo de ejecución, y le corresponde el **tema claro**
  del brandbook (`--lesson-*`), que existe justamente para documentos e impresión.
- **`lib/aios/executive.js`** y **`lib/aios/leads-portal.js`**: pintan con `innerHTML` desde la capa
  imperativa. Sus colores se pueden pasar a variables, pero reactificar esas vistas es otra etapa.
