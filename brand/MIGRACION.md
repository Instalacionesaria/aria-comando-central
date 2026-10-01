# Inventario para migrar a la marca v2

Lo que había hardcodeado, dónde está y con qué token del brandbook se reemplaza. La Fase 1 instaló el
sistema sin tocar una sola pantalla. **La tipografía, la paleta y las superficies ya son las de la marca**:
las cambió la nueva estructura, cambiando valores de tokens (ver «Lo que ya se hizo»). Lo que queda es la
fase de detalles, que es de a una pantalla por vez (ver «Lo que queda para la fase de detalles»).

Medido con un barrido sobre `app/`, `components/` y `lib/` (se excluyen `pruebas/`, `docs/`, `db/`
y el propio `app/brand/`, que ya es el sistema nuevo).

La medición es de la base del PR #2, 28 commits antes de entrar a `main` el 2026-10-01. Desde entonces los
conteos se movieron unas unidades —las hojas que `main` sumó, las reglas del botón de tema que salieron
con la aplicación sólo oscura y las pilas de letra que pasaron a Geist—, y la etapa 5 de la nueva estructura los vuelve a medir
(`docs/OTROS/nueva-estructura/06-LAS-ETAPAS.md`).

## Lo que ya se hizo (nueva estructura, etapas 4 y 5, 2026-10-01)

- **La tipografía**: Geist y Geist Mono en toda la aplicación (ver «Tipografía»).
- **La paleta**: el tema oscuro de `app/temas.css` lleva los valores de la marca, token por token, y las
  pantallas de operación dejaron de tener paleta propia. El mapa aplicado está en el comentario de ese
  bloque y en `docs/OTROS/nueva-estructura/03-LA-MARCA.md` (`NE-25` y `NE-26`), y lo exige
  `pruebas/codigo/188-la-paleta-de-la-marca.test.ts`. La tabla de más abajo es la propuesta original;
  donde se decidió distinto, lo dice su última columna.
- **Las superficies**: el fondo es liso (la grilla y la viñeta del prototipo no se generan), los radios
  de las pantallas de operación salen de `--radius-sm` y `--radius-lg`, y los degradados de superficie
  se aplanaron por token donde se pudo.

## Lo que queda para la fase de detalles

Medido en la revisión de la etapa 5 (2026-10-01). Ninguno se arregla cambiando un token.

**Degradados y resplandores**:

- **27 de tinte o resplandor** que no se apagan sin cambiar un color con significado: 25 en `app/aios.css`
  (el `.nav-item.on`, las tarjetas de meta y de ingresos del cockpit, `.icpc.on`, `.lg-open`, `.cw-go`…) y
  2 en `app/fundaciones.css` (la barra de avance y `.fd-btn`). Unos 13 se dibujan.
- **El halo del Inicio** del closer y del setter (`.ck-hero::before`): un disco al 5 % difuminado 100 px.
  La marca no lleva resplandores.
- **Los dos brillos de cabecera** de `--c-brillo` al 2,2 % (`.card-head`, `.acq-fhead`).
- **Degradados de superficie que quedaron curvos**:
  - los 28 de `--bg-raise` a `--bg-panel` o `--bg-hondo` (tarjetas, cajones), en 1,03:1, por no quitarle
    a `--bg-raise` su valor de la marca;
  - los 8 de los menús y modales, de `surface-active` a `bg-alt`, porque su cabecera tiene que
    distinguirse de lo que tapan;
  - los 3 de los botones activos de los segmentados.

  Se aplanan con una regla por superficie.

**Radios**:

- **Los escritos a mano**: 212 en `app/aios.css`, 60 en `app/fundaciones.css`, 44 en
  `app/operacion-estetica.css`, 26 en `app/closer.css` y unos 30 más repartidos.
- **Las píldoras** de botones y chips (la marca: «siempre píldora»).

**Textos por debajo de 4,5:1** que ninguna regla de token alcanza, todos anteriores a la etapa 5:

- los del héroe del Inicio al 40 % y al 30 % del blanco: 3,5 y 2,5:1;
- el texto chico del aviso «formulario traído» (`.fd-onboarding.ok small`): 4,1 a 4,5:1;
- `.org-h em` en Conversation: 3,3:1;
- el subtítulo de una fila congelada (`.md-r.md-fuera .md-sub`): 4,1:1;
- la hora de los mensajes propios del chat (`--chat-meta` sobre `--chat-propia`): 2,6:1. El chat conserva
  los colores de WhatsApp a propósito, así que el arreglo es un token propio para esa hora.

**Campos**: van sobre `--bg-sunk`, que vale lo mismo que la página, con el borde de control (2,0:1). La
marca los pone en `surface-raised`, y la WCAG 1.4.11 pide 3:1 para el límite de un control. Necesita una
regla para los campos, no un token: `--bg-sunk` lo usan unas 60 superficies que no son campos.

**Estados**: hovers que quedaron con un escalón menor que 1,05:1, el más claro `.sc-fila:hover` en el
Scraper.

**`--exec`, lo que no es dinero**: el bloque «Calificados» de Acquisition, las líneas y el rótulo de la
capa ejecutiva del organigrama, dos baldosas del Inicio y el «Histórico completo» del selector de fechas
quedaron en el blanco del dinero. Falta decidir qué color les corresponde.

**Pantallas aparte**:

- `/entrar`: sus literales de la paleta vieja (`app/entrar/entrar.css`).
- Los colores del PDF exportado (`lib/fundaciones/exportar.ts`).
- La chispa de «Ingresos» del cockpit, que rellena con el cian viejo (`lib/aios/executive.js`): se va con
  la maqueta del Executive en la etapa 7.

**El lienzo propio de las pantallas de operación** (`operacion-estetica.css`, «EL LIENZO ES PLANO»): ya no
tapa nada, y quitarlo cambia su geometría.

**Los titulares en dos líneas** (peso 200 y 500).

## El tamaño del problema (la medición original)

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
| `--line-strong` | `rgb(170 212 255 / 0.28)` | *(nota de `line-strong`)* | `#3A4456` |
| `--txt` | `#eaf2fb` | `--ink` | `#F2F5F9` |
| `--txt-dim` | `#a6b8ce` | `--ink-2` | `#AAB3C1` |
| `--txt-faint` | `#93a4bb` | `--ink-3` | `#7F8A9B` |

**`--line-strong` se decidió distinto (E5):** no es el `#242C3A` de la marca sino el `#3A4456` que la
nota de `line-strong` en `tokens.json` pide «si el borde debe leerse solo». Sin sombras, el borde de un
menú, un modal o un campo es siempre lo único que lo separa de lo de atrás.

`--ink-4` (`#4F5968`) no tiene equivalente hoy y **no se usa para texto**: es decorativo. Si al migrar
aparece texto que quedaría por debajo de `--ink-3`, el problema es la jerarquía, no el color.

### Acentos y estados — acá hay decisiones, no reemplazos

| Hoy | Valor | Brandbook | Valor | Qué cambia de verdad |
|---|---|---|---|---|
| `--accent` | `#3ff2e2` | `--accent` | `#8FE3FF` | **Cambia el tono.** El acento pasa de verde-cian a cian claro. Es el cambio más visible de toda la migración. |
| `--etapa-agendado` | `#35e0d2` | *(extensión)* | `#7CB5C5` | **Decidido distinto (E5):** no es el acento. Su conteo es un relleno sólido, igual que la pestaña activa, y con el mismo cian se leería como un control. Comparte el matiz, más oscuro y apagado. |
| `--accent-alto` | `#78fff0` | `--accent` | `#8FE3FF` | El brandbook tiene **un solo** acento: las variantes alto/hondo desaparecen. |
| `--accent-hondo` | `#23b3a8` | `--accent` | `#8FE3FF` | Ídem. |
| `--dev` | `#9a8bff` | `--accent-2` | `#B9A6FF` | Violeta, «sólo como detalle puntual». |
| `--exec` | `#ffc554` | `--ink` | `#F2F5F9` | **Decidido distinto (E5):** lo más visible que pinta es dinero, y el dinero va en blanco (`NE-26`). La atención es `--warn`. |
| `--warn` | `#ff9550` | `--signal` | `#E0C073` | Se funde con el anterior: el brandbook tiene un solo nivel de atención. |
| *(dorado suelto)* | `#e8b64c` | *(extensión)* | `#BBA465` | Era el ámbar de `--etapa-cierre`; quedó en la extensión de las etapas (E5). |
| `--crit` | `#ff6a6a` | `--alert` | `#FF8C7A` | Incidencia. |
| `--sobre-acento` | `#04121a` | `--on-ink` | `#04060A` | Texto sobre relleno. |

**`--ok` (`#55eb8c`) no tenía reemplazo en la marca, y era la decisión pendiente más importante.** El
brandbook no tiene un verde de éxito. Se decidió el 2026-10-01 (`NE-10`, la «extensión sobria»): un verde
apagado, `#94C6A0`, con menos croma que el cian. La misma decisión vale para los otros colores con
significado: atención en `signal`, dinero en `ink` e incidencia en `alert`.

Lo mismo con los **colores de etapa**: el brandbook no contempla una paleta categórica, y **se declararon
como extensión documentada** (E5). Son doce etapas y la cola de «Completadas hoy», apagadas y medidas: croma
menor que el cian, 4,5:1 sobre todas las superficies y ΔE ≥ 0,08 dentro de cada embudo. Los valores están
en `app/temas.css`.

### Tipografía

| Antes | Ahora (brandbook) |
|---|---|
| `--font-ui` → Inter (`next/font/google`) | `--font-ui` → **Geist** |
| `--font-mono` → IBM Plex Mono | `--font-mono` → **Geist Mono** |

**Hecho el 2026-10-01**, en la etapa 4 de la nueva estructura (`docs/OTROS/nueva-estructura/03-LA-MARCA.md`,
`NE-24`). `--font-ui` y `--font-mono` apuntan a Geist y Geist Mono, que se cargan con `next/font/google`
—el paquete `geist` salió, y el porqué está en `app/layout.js`—, y se borraron las cargas de Inter e IBM
Plex Mono. Las pantallas de operación y los Incidentes, que tenían su propia letra, usan la variable.

**Corrección al pedido:** Space Grotesk y JetBrains Mono **no existían en este repositorio** — cero
ocurrencias. Las familias reemplazadas fueron Inter e IBM Plex Mono.

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

> La nueva estructura recoloreó toda la aplicación de una vez, por tokens (etapa 5). Lo que sigue es el
> orden para la fase de detalles.

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
