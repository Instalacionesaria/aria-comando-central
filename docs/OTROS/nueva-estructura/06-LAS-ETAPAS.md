# Las etapas

> Cada etapa es **un commit**. Antes de cada uno:
>
> - `git pull --rebase` (hay otra persona trabajando en `main` a la vez);
> - el preview detenido;
> - `npm run build` y `npm run tipos`;
> - la suite entera en America/Lima, UTC y Asia/Tokyo.
>
> Toda prueba nueva se ve primero **en rojo** con la mutación que dice su fila. Las etapas grandes pasan
> además por una revisión adversarial. **No hay migraciones.**

## La tabla

| etapa | qué hace | archivos principales | pruebas que cambian o nacen (mutación que las pone en rojo) |
|---|---|---|---|
| **E0 · Documentos** | Esta carpeta. Notas de «después del corte» en `estado actual`, la deuda encontrada y los planes de lo posterior en `futuro/` | `docs/OTROS/nueva-estructura/`, `docs/OTROS/estado actual/00-MAPA.md`, `09-DEUDA-ABIERTA.md`, `docs/OTROS/futuro/` | La carpeta entra a la prueba de las citas, `101` (una cita a una línea que no existe) |
| **E1 · El PR #2** | Integra la marca sin cambiar un píxel (`NE-22`) | `brand/`, `public/brand/`, `app/brand/`, `app/globals.css`, `app/layout.js` | El orden de las capas de CSS (invertir dos); la deriva entre `brand/tokens.json` y la hoja generada (editar un valor a mano) |
| **E2 · La sesión entera** | `app/guardia.tsx` copia todo lo que la ruta de sesión manda. Hoy pierde `puedeBorrarPersonas`, y el botón «Eliminar» de Ajustes › Usuarios no aparece nunca | `app/guardia.tsx`, `app/sesion-contexto.tsx` | Toda clave de la sesión llega al contexto, salvo una lista con motivos (borrar una copia) |
| **E3 · Sólo oscuro** | `NE-23` | `app/tema.ts`, `app/layout.js`, `components/Nav.jsx`, `app/guardia.tsx`, `app/sesion-contexto.tsx`, `app/temas.css` (las reglas del botón y la transición del cambio de tema); se borra `components/BotonDeTema.jsx` | `104`: el atributo del `<html>` lo escribe sólo el servidor, y se barre todo el código del navegador en vez de tres archivos (escribir `colorScheme` desde un componente); `185` suma `tema` a su lista de afuera; nueva `186`: el tema fijo, nadie lee la copia local ni el tema de la sesión y la ruta del tema queda sin llamador (`TEMA = 'claro'`, un guion que lea `aios:tema`, la barra que aplique `sesion.tema`, devolver el botón). Las pruebas que leen los dos bloques de tokens (`104`, `106` y `107`) **siguen como estaban**: el bloque claro queda (`NE-23`) |
| **E4 · Tipografía** | `NE-24` | `app/layout.js`, `app/globals.css`, `app/operacion-estetica.css`, `app/incidentes.css`, `package.json` (sale `geist`), `brand/BRAND.md`, `brand/MIGRACION.md` | `121` lee todas las hojas: las de `app/` con sus subcarpetas y las que `globals.css` importa (un token inexistente en `app/entrar/entrar.css`; renombrar la variable de Geist en el layout); nueva `187`: Geist con el cargador de Next y sin el paquete, primero en la pila, y ninguna hoja ni componente con una letra propia (devolver la pila del sistema a las pantallas de operación, volver a `var(--mono, …)` en Incidentes, `-apple-system` antes de Geist, volver a importar `geist/font/sans`, una letra en línea) |
| **E5 · Paleta y superficies** | `NE-25` a `NE-27` | `app/temas.css`, `app/operacion-estetica.css` y, por la revisión, `app/fundaciones.css`, `app/auditoria.css`, `app/creative.css`, `app/closer.css`, `app/entrar/entrar.css`, `app/globals.css`, `brand/MIGRACION.md`, `brand/BRAND.md` | Nueva `188`: la paleta contra `brand/tokens.json`, cada hex con su canal, un solo acento (todo color de la marca o de la extensión, y la extensión con menos croma que el cian), contraste ≥ 4,5:1 de todo color de texto y de todo relleno, las etapas a ΔE ≥ 0,08, nadie más redefine el tema, las capas que flotan, el fondo liso, los radios y `public/brand/tokens.css` contra el json. `121`: un token que sólo existe en el tema claro no cuenta como definido, y ningún token se define con su nombre. `104`: los dos bloques de operación declaran el mismo conjunto. 21 mutaciones vistas en rojo. `106` sigue exigiendo doce etapas distintas |
| **E6 · Citas** | Reescribe, sólo en documentos, las citas a los archivos que E7 borra o cambia: 224 a los nueve que borra y 36 a los que cambia (`ExecutiveView.jsx`, `lib/aios/index.js`, `lib/aios/shell.js`, `app/armazon.css`), contadas con el patrón de la `101` sobre las carpetas auditadas. Pasan a rangos del prototipo o a «en `<commit>`». **Hecho:** las 224 y las 20 de `ExecutiveView.jsx`, que E7 reescribe entero, se fijaron al commit (`` `archivo:N@c4cf2a8` ``, que `101` no audita: ver la nota al final de esa prueba). Las 16 a `lib/aios/index.js`, `lib/aios/shell.js` y `app/armazon.css` quedaron sin fijar, para que E7 las revisara con el mapa de su diff. **Revisadas en E7:** 12 se fijaron a `@c4cf2a8`, casi todas porque describían lo que E7 borró o reescribió; 3 se reapuntaron, y la de `05-LO-QUE-NO-CAMBIA.md` no se movió | documentos auditados | `101` verde antes y después; verde también con los nueve archivos borrados, y roja con una sola cita sin fijar |
| **E7 · El Inicio** | `NE-29` y `NE-30` | `components/views/ExecutiveView.jsx`, `components/marca/Mascota.jsx`, `lib/saludo.ts`, `lib/negocio/tiempo.ts` (`horaDelDiaEnZona`, al final), `lib/aios/index.js`, `lib/aios/shell.js`, `components/CommandCenter.jsx`, `app/armazon.css`, `scripts/paridad.mjs` (los tres pasos, línea por línea), `lib/autorizacion/secciones.ts` (el nombre, en su línea); se borran los nueve archivos de `NE-30` | Se borra `120`; cambian `90`, `95`, `102`, `103`, `107`, `156`, `162` y `178`; nuevas: `189`, la maqueta se fue (volver a cargar un módulo, un Cmd+K, un clic al menú, una cifra en el Inicio, quitar el `disabled`), y `190`, el saludo usa la zona de la empresa (contar la hora con la del proceso, los cortes, el nombre de pila, la zona inválida). Las citas a lo que se borró se fijaron a `@c4cf2a8`; las demás se reapuntaron |
| **E8 · El modelo** | `lib/autorizacion/departamentos.ts`, puro: los departamentos, sus entradas y la función que reparte `menuVisible()`. La sesión suma `navegacion` y `restringido`. Sin cambio visual. **Hecho:** sin las tres funciones de consulta del plan (la pestaña por omisión, la entrada y la ceja de una sección), que nacen con la etapa que las usa, para no dejar funciones sin llamador; y sin el Scraper, que entra al modelo en E9 junto con su pestaña | `lib/autorizacion/departamentos.ts`, `app/api/auth/sesion/route.ts`, `app/sesion-contexto.tsx`, `app/guardia.tsx` | Nueva `191`, cruzada: toda sección del menú queda ubicada una sola vez (sacar `conversion`, ubicar `closer` dos veces); toda pestaña que se pide existe y toda pestaña tiene su entrada (borrar `mis-leads`, pedir una que no existe); la visibilidad sale sólo de `menu` (sacar el filtro, mostrar una entrada fuera del menú); el orden y las cejas de `NE-12`; la ruta arma la navegación con el mismo menú y el rótulo con el alcance. `185` vigila sola que las dos claves nuevas lleguen al contexto |
| **E9 · La navegación en React** | `irALaVista` acepta la pestaña y la deja pedida; Tools y Analizadores la toman de ahí; las filas del menú son botones de verdad. Nace la pestaña **Scraper** de Tools (`NE-20`), que por ahora se ve en la barra propia de Tools: así existe antes de que la barra lateral de E10 la ofrezca. **Hecho:** el hook se llama `usarPedidoDeVista` (Analizadores ya llamaba «pedido» a sus peticiones); Tools lo atiende porque su catálogo declara `seccion: 'tools'` —la `139` fija la línea de `<Fundaciones>`— y la clave se traduce al `id` con `activaDeLaPestana`; ICP no lee pedidos. En E9 nadie pide todavía una pestaña: la primera en hacerlo es la barra de E10. Se EJECUTAN el almacén de `shell.js`, la decisión del hook (`siguientePedido`) y la traducción; el hook y las dos pantallas que atienden se leen del fuente, porque no hay un renderizador de React en las pruebas. El Scraper envuelve el buscador de Prospección sin el nicho de ICP; la franja del saldo sigue arriba de Tools hasta E11; sin `tools.editar` no se dibuja el buscador. El aspecto de las filas-botón va en la capa `base` de `app/globals.css`, que pierde contra `aios`: medido en Chrome con el CSS compilado y una letra del sistema, la barra queda idéntica píxel a píxel. Por la revisión: en el teléfono el cajón cerrado sale del orden del tabulador (`visibility`, medido); el formulario a mano de Analizadores sigue a la pestaña; el JSDoc de `irALaVista` quedó pegado a la función, para que TypeScript vea la pestaña. Quedan para E10 el punto «scrapeando» dentro del botón (entra a su nombre) y, hasta E11, que la barra de Tools pasa a dos renglones desde unos 1230 px por la pestaña nueva. La deuda del aviso que culpa al rol cuando falla la lectura del estado la comparten el Espía y el Scraper (`15-TOOLS-Y-MONITOREO.md`) | `lib/aios/shell.js`, `lib/vista.ts`, `components/fundaciones/Fundaciones.jsx`, `lib/fundaciones/herramientas.ts` (al final), `components/analizadores/PanelDeAnalizadores.jsx`, `components/Nav.jsx`, `components/TopBar.jsx`, `components/MenuDeUsuario.jsx`, `components/tools/Scraper.jsx` y `components/tools/SaldoDeLeads.jsx` (comentarios), `app/globals.css` (al final), `app/armazon.css` (el cajón), `components/tools/VistaDelScraper.jsx`, `components/views/ToolsView.jsx`, `lib/autorizacion/departamentos.ts` | `91` y `102` cambian donde fijaban el clic del arranque, y la `91` prohíbe además una fila a mano que navegue sin `data-view`; `191` suma el Scraper; `162`, el cajón cerrado fuera del tabulador; `187` deja de prohibir todo bloque `@layer` en `globals.css` y prohíbe que uno contenga la letra; `104` y `107`, sólo sus comentarios; nueva `192`: el pedido se guarda antes de avisar a todos, el número sube siempre, y no queda si la pantalla no existe (ejecutando `shell.js`); la decisión del hook (ejecutándola); nadie ata clics ni marca filas desde el DOM; las filas son botones que navegan; la traducción de la clave; Tools y Analizadores atienden una vez por número en el render, ICP no; el Scraper envuelve el buscador sin copiarlo. Mutaciones vistas en rojo: 23 de la etapa y 21 de la revisión |
| **E10 · La barra lateral** | `NE-11` a `NE-16` y `NE-18`. **Hecho** (decisiones en `01-LA-ESTRUCTURA.md`, «Hecho el 2026-10-02»): la barra de 260 px va de arriba abajo y la de arriba queda sólo en el teléfono, sin miga; se van `GROUP` y el parámetro `nombre` de `irALaVista`, que ya no tenía quién lo dibujara. La entrada abierta sale de la pantalla a la vista y de la pestaña que esa pantalla DIBUJA —Tools y Analizadores la anuncian, sin crear un pedido—, no del último pedido. El punto «scrapeando» va en Espía o Scraper según quién retoma el trabajo, y en la cabecera de Research cerrada, con una región viva fuera de la barra. El engranaje es el único menú de la cuenta, y la ventana de la contraseña se dibuja en el `body`. Medido en Chrome contra el lienzo, con el CSS compilado y las hojas nuevas. **Una revisión adversarial** (cuatro lentes: React, pruebas, verdad de los textos, lo visual) encontró, y quedó arreglado: «Nueva conversación» encogía a 20 px cuando la lista no entraba; la Reunión partía su nombre; los menús cerrados seguían en el tabulador; la píldora «Mirando · …» dejaba seis letras del nombre; la ventana de la contraseña cerraba el cajón al tocarla; quien arrancaba en Tools veía un cuadro con la barra vacía (la suscripción pasó a un efecto de diseño, medido en un arnés con React); y 37 mutaciones que las pruebas dejaban pasar, más dos que la cabecera de la `193` decía atrapar y no atrapaba | `components/Nav.jsx` (reescrito), `components/MenuDeUsuario.jsx`, `components/SelectorDeEmpresa.jsx` (la píldora), `components/TopBar.jsx`, `components/CommandCenter.jsx` (una línea), `lib/aios/shell.js` (sin `GROUP`, la pestaña dibujada, el foco del cajón), `lib/vista.ts`, `lib/autorizacion/departamentos.ts` (`entradaAbierta`), `lib/fundaciones/herramientas.ts` (`pestanaDeLaActiva`), `lib/tools/scrapers.ts` (`pestanaQueLoRetoma`), `components/fundaciones/Fundaciones.jsx` y `components/analizadores/PanelDeAnalizadores.jsx` (anuncian), `app/armazon.css` (también: los desplegables cerrados se esconden), `app/temas.css`; comentarios en `lib/autorizacion/secciones.ts` (en sus líneas), `app/sesion-contexto.tsx`, `app/globals.css` y `lib/cadencia.ts` | `91` (la miga no vuelve, ni con otro nombre; la entrada abre su pestaña; la barra sólo abre lo que manda el servidor), `102` (el nombre sale del dato, también en la barra y en el pie), `162` (toda regla `.app` de la computadora es de una fila, la barra de arriba sólo en el teléfono, el velo no la tapa), `189` (la Reunión de hoy se nombra sólo en su fila de la barra), `192` (la forma de la fila); `123` sigue verde sin cambios; nueva `193`, con ocho pruebas: la barra lee de la sesión sólo `navegacion` y `arranque`, las «Próximamente» y la Reunión no navegan ni cuentan, la entrada abierta sale de lo que se dibuja (ejecutando `entradaAbierta`, `pestanaDeLaActiva` y el almacén, con un pedido real) y abre su departamento, el rótulo sale de `restringido` (ejecutando su expresión), los menús cerrados salen del tabulador y devuelven el foco, la píldora dice la frase entera, el punto va donde el trabajo se vuelve a ver, y la barra se desplaza entera. 84 mutaciones vistas en rojo |
| **E11 · Cabecera y pestañas** | `NE-17` y `NE-19` | `components/CabeceraDeDepartamento.jsx`, `app/departamentos.css`, `components/views/ToolsView.jsx`, `components/analizadores/PanelDeAnalizadores.jsx`, `lib/fundaciones/` (los textos «Tools →») | `104` y `107` suman la hoja nueva; `126` y `139` cambian donde fijaban Tools; nueva: la ceja sale del modelo (escribirla a mano), los títulos propios se ocultan en las dos formas de cabecera, no quedan barras en Tools ni Analizadores, ningún texto de `components/` ni de `lib/fundaciones/` dice «Tools →» |
| **E12 · Ajustes › Usuarios** | `NE-21` | `lib/autorizacion/departamentos.ts`, `app/api/admin/roles/route.ts`, `components/ajustes/Usuarios.jsx` | `101-alcance` no se toca; nueva: cada sección en un solo grupo y su lista de lo que abre (poner Tools en tres grupos) |
| **E13 · Cierre** | Documentos al día, una foto nueva en `estado actual`, la memoria del proyecto y producción | documentos | `101` |

Los demás documentos que describen lo que cambia se actualizan **en la etapa que lo cambia**, no antes:

- `estado actual/11-EXECUTIVE.md`, en E7;
- `15-TOOLS-Y-MONITOREO.md` y `16-AJUSTES-Y-PERMISOS.md`, en E10 a E12;
- `17-LA-PLATAFORMA.md`, en E13: no describe la barra, y lo que E10 le cambia es el conteo de la suite, que
  se rehace en el cierre;
- los `12-QUIEN-VE-QUE.md` de cada departamento, en E10;
- `brand/MIGRACION.md`, en E5.

Un documento que describe lo que todavía no existe es falso.

## El orden, y por qué

- **La marca va antes que la navegación**: el recolor por tokens es de bajo riesgo y no depende del menú.
- **El sólo-oscuro va antes que la paleta**, para que la paleta nueva no se escriba sobre un tema que
  alguien todavía puede tener puesto.
- **El Inicio se retira antes de tocar el menú.** Los módulos de la maqueta navegan haciendo clic en las
  filas del menú viejo; si el menú cambiara primero, esos clics caerían en el vacío sin un solo error.
- **El modelo de departamentos va antes que la barra**, y la navegación pasa a React antes que el diseño
  nuevo. Así cada paso se puede probar sin cambio visual antes del que sí lo tiene.

## La verificación

- **Pruebas**: lo de arriba, en las tres zonas, en cada commit.
- **En el navegador**: el login lo hace el usuario (nunca se escribe una contraseña). Con los datos de
  muestra sembrados en la base local, se sacan capturas antes y después de cada etapa visual:
  - el inicio, cada departamento y el engranaje;
  - a 1440 px y a 375 px;
  - la consola sin errores del arranque;
  - **una entrada del menú que no lleva a ningún lado cuenta como falla**.
- **Con un usuario restringido**, que el usuario crea en la base local:
  - un closer ve sólo Sales › Closer;
  - quien tiene Tools ve Research, Marketing y Sales;
  - desde una empresa que no es la principal no aparecen Monitoreo ni Incidentes.
- **Qué estado sobrevive**: empezar un chat de ICP, pasar a otro departamento y volver; y el recorrido
  Research › Scraper → Marketing › Tu página → Research › Scraper, con un escaneo en vuelo y con uno ya
  terminado (`NE-35`).

## La publicación, por hitos

Cada push lo aprueba el usuario:

| hito | etapas | qué se mira en producción |
|---|---|---|
| 0 | E0 | La carpeta, que el usuario revisa antes de que se toque código |
| 1 | E1 a E5 | La marca y el recolor: todas las pantallas, con login |
| 2 | E6 y E7 | El Inicio honesto |
| 3 | E8 a E13 | La navegación nueva entera, con un usuario restringido |

Después de cada push:

- el CI verde, el despliegue de Vercel listo y `/api/salud`;
- el humo con login del usuario.

**Reversión**: `git revert` de los commits, en orden inverso. Ninguna etapa toca la base, así que revertir
el código basta.
