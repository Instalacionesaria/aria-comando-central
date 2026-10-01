# La marca v2 en toda la app

> La marca la define el sistema «ARIA» (Brandbook v2.0): oscura, con mucho aire, líneas de 1 px y **un solo
> acento**. Nada grita; los datos hablan. Este documento dice cómo llega a la app **sin rediseñar cada
> pantalla todavía** (`NE-03`).

## `NE-22` · Primero, el PR #2

El PR #2 (`feature/brand-v2`, abierto, con el CI en verde) instala la marca en dos capas sin cambiar un
píxel: `brand/tokens.json` como fuente, `public/brand/tokens.css`, los logos y la mascota en
`public/brand/`, la mascota como elemento propio (`<aria-mascot>`, ocho estados, la mirada que sigue el
cursor), una página `/brand` que muestra la marca y la regla de no escribir colores a mano.

Se integra **antes que nada** (`NE-02`), con tres cuidados:

- **El único conflicto es `CLAUDE.md`.** El PR le agrega las reglas de la marca, y en `main` ese archivo
  dejó de versionarse. Se resuelve dejándolo fuera del repositorio y pasando sus reglas a
  `brand/BRAND.md`, que sí se versiona.
- **Se integra en un árbol de trabajo aparte**: `CLAUDE.md` está ignorado, y cambiar de rama en el árbol
  principal lo pisaría.
- **El PR se probó contra un `main` de hace 28 commits.** Se vuelve a correr la suite entera antes de
  publicarlo.

## `NE-23` · Sólo oscuro

El brandbook dice que el tema claro es para documentos y PDFs, no para la app (`NE-06`).

- La app queda **siempre en oscuro**. Sale el botón de tema del pie (`components/BotonDeTema.jsx`).
- **La trampa a evitar**: el guion de arranque lee el tema guardado en el navegador, y la barra aplica el
  de la base. Si sólo se borrara el botón, quien eligió «claro» se quedaría en claro para siempre, sin
  forma de volver. Por eso el tema se **fija** en `oscuro` en el único lugar que lo escribe
  (`app/tema.ts`), y ya no se lee de ningún lado.
- La columna `identidad.usuarios.tema` y la ruta `/api/auth/tema` **quedan dormidas**, sin llamador. Retirar
  la columna exige una migración y no hace falta para esta fase. La ruta de sesión sigue mandando el tema,
  y la guarda lo deja afuera con su motivo (`pruebas/codigo/185-la-sesion-llega-entera.test.ts`).
- Con el botón se van el guion de arranque que leía la copia del navegador, el `suppressHydrationWarning`
  que su escritura obligaba en el `<html>` y la transición de color del cambio de tema. El `<html>` sale del
  servidor con el tema fijo (E3, hecho el 2026-10-01).
- El bloque de tokens del tema claro **queda, dormido y con su paleta de antes**: las pruebas de temas
  leen los dos bloques, y ponerle los valores claros del brandbook se hace el día que un documento
  imprimible lo use (`08-LO-QUE-QUEDA-PARA-DESPUES.md`).

## `NE-24` · Geist

- **Geist y Geist Mono** entran por el cargador de fuentes de Next (`next/font/google`), con nombre de
  variable. El PR las trae por el paquete `geist`, que declara sus variables por su cuenta, sin un
  `variable:` en `app/layout.js`, y la prueba que exige que toda variable de CSS esté definida
  (`pruebas/codigo/121-tokens-de-css.test.ts`) sólo sabe que existen si las lee de ahí. El paquete sale.
- Salen Inter e IBM Plex Mono.
- **Geist va primera** en `--font-ui`. Inter y Plex iban detrás de las letras del sistema, copiado del
  prototipo, así que en una Mac se veía San Francisco y en Windows Inter.
- Las doce pantallas «de operación» tenían su propia pila de fuentes del sistema
  (`app/operacion-estetica.css`). Pasan a la variable de la marca. Y los Incidentes pedían `var(--mono, …)`,
  un token que no existe: se veía la monoespaciada del respaldo. Pasan a `--font-mono`.
- Hecho el 2026-10-01 (E4). Lo vigila `pruebas/codigo/187-la-letra-de-la-marca.test.ts`.
- El cuerpo del texto queda en peso 400 a 13 px: la escala de la marca pone 300 sólo desde 16 px.
- La firma tipográfica —el titular en dos líneas, peso 200 y después 500— se usa en el armazón (el saludo
  del inicio). En las pantallas, en la fase de detalles.

## `NE-25` · La paleta, cambiando valores y no nombres

Toda la app ya pinta con tokens (`var(--…)`), así que el recolor es **cambiar los valores de los tokens**
del tema oscuro (`app/temas.css`), no tocar las pantallas. El mapa, token de hoy → token de la marca:

| token de hoy | valor nuevo | token de la marca |
|---|---|---|
| `--bg`, `--bg-sunk`, `--bg-fondo` | `#04060A` | `bg` |
| `--bg-panel` y sus parientes de fondo | `#070A10` | `bg-alt` |
| `--bg-raise` | `#0A0F18` | `surface-raised` |
| `--bg-float` | `#0D1420` | `surface-active` |
| `--line` / `--line-strong` | `#151B26` / `#242C3A` | `line` / `line-strong` |
| `--txt`, `--txt-dim`, `--txt-faint` | `#F2F5F9`, `#AAB3C1`, `#7F8A9B` | `ink`, `ink-2`, `ink-3` |
| `--accent` y su familia | `#8FE3FF` | `accent` |
| texto sobre el acento | `#04060A` | `on-ink` |
| `--crit` (incidencia) | `#FF8C7A` | `alert` |
| `--dev` (violeta, detalle) | `#B9A6FF` | `accent-2` |

`ink-4` (#4F5968) **no se usa para texto**: no alcanza el contraste. El tono más bajo para texto es `ink-3`.

**Las pantallas de operación dejan de tener paleta propia.** Sus bloques de tokens en `temas.css`
redefinían fondos, textos, señales y etapas en tonos zinc. Esas redefiniciones se borraron, y las doce
pantallas heredan la marca como las demás.

**Hecho el 2026-10-01 (E5).** Lo que se decidió al aplicarlo, además de la tabla:

- **Las capas que flotan**: `--bg-flota` (la cabecera de los menús) y `--bg-cajon` (la del modal) van en
  `surface-active` y no con el panel. Sin sombras, lo que separa un menú de la tarjeta de atrás es ser más
  claro. El velo de los modales (`--c-velo`) es negro.
- **El borde que separa**: `--line-strong` no es el `#242C3A` de la marca sino el `#3A4456` que la propia
  marca indica «si el borde debe leerse solo» (`brand/tokens.json`). Con `#242C3A` los bordes de menús,
  modales y campos quedaban más débiles que antes del recolor. Tres campos que usaban la línea decorativa
  pasaron a ésta.
- **Los canales de superficie** (`--c-alto`, `--c-panel`…) se igualaron de a pares para aplanar los
  degradados de `aios.css` sin tocar esa hoja. `--c-violeta` y `--c-txt`, que sólo declaraba el prototipo,
  entraron al tema con los valores de la marca.
- **Los textos atenuados**: `ink-3` es el piso, y tres reglas del prototipo lo atenuaban además con opacidad
  (los rótulos del menú lateral, el tramo del puntaje del Leads Portal y el «=» de «sin variación»). Una
  regla en `temas.css` les devuelve la opacidad entera.
- **Lo que queda del bloque de operación**: 20 tokens que el tema no tiene. Son el héroe del Inicio, los
  íconos de estado, el botón «Unirse», el chat, que **conserva los colores de WhatsApp** porque la imitación
  es su función, y la ficha.

## `NE-26` · Los colores con significado

La marca tiene un solo acento, pero la app usa colores que **significan algo** y que no se pueden perder
(`NE-10`, extensión sobria):

| significado | hoy | pasa a |
|---|---|---|
| éxito, ya hecho | verde vivo | un verde apagado, de croma menor que el cian |
| atención | ámbar | el dorado de la marca (`signal`, `#E0C073`) |
| dinero (comisiones, cobros) | dorado | blanco de la marca (`ink`) |
| incidencia, error | rojo | coral (`alert`, `#FF8C7A`) |
| las 12 etapas del pipeline (Closer y Setter) | 12 colores vivos | 12 tonos apagados, distintos entre sí |

Las etapas **tienen que seguir distinguiéndose**. Hay un setter y un closer mirando su pipeline por color,
y la prueba de las etapas exige doce valores distintos por tema
(`pruebas/codigo/106-etapas-color.test.ts`). La regla nueva es que **ninguna sature más que el cian**: el
cian sigue siendo el único color que llama la atención. Las formas que hoy separan las etapas para quien
no distingue colores se quedan.

Los valores exactos se fijan en la etapa E5, medidos: contraste ≥ 4,5:1 sobre el fondo de las tarjetas para
todo color que lleve texto, y una prueba que compara la paleta con `brand/tokens.json`.

**Hecho el 2026-10-01 (E5).** El verde es `#94C6A0`, y las doce etapas y la cola de «Completadas hoy» están
en `app/temas.css` con lo que se midió: la de más croma (`calificado`) tiene 0,087 contra 0,090 del cian, y
la distancia mínima dentro de cada embudo es ΔE 0,089. **El dinero es `--exec`**, y por eso `--exec` vale
`ink`. Los avisos de atención de `/entrar`, que lo usaban, pasaron a `--warn`. Los usos de `--exec` que no
son dinero quedaron en blanco, y están en el inventario de `brand/MIGRACION.md`.

**La etiqueta «VISTA DE EJEMPLO»** queda reservada al dorado, como dice el token. Hay una contradicción en
el PR (su `BRAND.md` dice «`signal` atención» y su `tokens.json` «solo ese uso»): se resuelve escribiendo en
`BRAND.md` el uso doble decidido acá —atención y vista de ejemplo, las dos señales que no son error—.

## `NE-27` · Lo que se aplana, y lo que queda para los detalles

**En esta fase, sólo por tokens o con una regla:**

- **Fuera la textura de grilla y la viñeta** del fondo (`app/aios.css`): la marca es un fondo liso.
- **Los degradados de las tarjetas se aplanan** igualando los dos tokens de cada degradado. Las pantallas no
  se tocan.
- **Los radios**: 12 px para campos y 20 px para tarjetas, los de la marca, en lugar de 10 y 26.
- **Sin sombras**: ya no hay. La única que la marca permite, el halo de la mascota, la dibuja la mascota
  en SVG.

**Hecho el 2026-10-01 (E5)**: el fondo liso, los radios por token en las pantallas de operación y los
degradados que se aplanan igualando tokens. Los que no se pudieron aplanar sin quitarle a un token su
valor de la marca, y por qué, están en el inventario.

**Para la fase de detalles** (el inventario completo está en `brand/MIGRACION.md`):

- unos cuarenta degradados de tinte y resplandores que no se apagan por tokens;
- los botones en píldora y las cejas mono de cada pantalla;
- los radios escritos a mano dentro de `app/aios.css`;
- la pantalla de entrada (`app/entrar/`) y los colores del PDF exportado.

## `NE-28` · La mascota

- **Una por pantalla**, a 48 px o más; debajo de eso pierde los ojos.
- **En el inicio**: 88 px, con la mirada que sigue al cursor.
- **En la barra lateral va el logotipo**, no la mascota.
- **El comentario del cerebro de la cabecera** (con la mascota a 32 px) no se dibuja todavía (`NE-17`).
- **En React entra por un envoltorio del elemento de la marca**, sin colores ni sombras escritos en el
  componente: los dibuja el elemento.
