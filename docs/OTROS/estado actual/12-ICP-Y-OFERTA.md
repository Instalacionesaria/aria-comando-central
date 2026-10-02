# ICP & Oferta

> Corte: **2026-09-28**. Archivo nuevo de la carpeta: la foto anterior (2026-09-15) tenía el mapa,
> los cinco departamentos de Inteligencia y cuatro archivos transversales (00 a 09), y ningún
> informe de esta pantalla, así que casi no hay cifras
> viejas propias que comparar; cuando otro documento dejó una fechada, van las dos. Las cifras de
> producción se midieron el 2026-09-28 con `scripts/supabase.mjs leer`, sólo agregados. Cada
> afirmación sobre el código lleva su archivo:línea; lo que no se pudo verificar está dicho como
> pendiente, no omitido. Para ubicar cualquier cosa nombrada acá, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

**Construida — desde el 2026-08-23 (Etapa 9, commit `aa4da8e`), sin un solo dato inventado. Es la
primera pantalla del prototipo que tuvo operaciones de servidor.**

ICP & Oferta genera las siete primeras piezas del método —ficha del negocio, research de mercado en
cinco pasos, avatar, categoría única, oferta, precio y mapa de proceso— con la llave de IA de cada
empresa, y las guarda por organización en la base propia. **Desde el 2026-09-07 no depende de
ARIA-brain para funcionar**, aunque el `README.md` todavía diga que su estado vive en el almacén del
hub. La usan pocas: medido el 2026-09-28, de **11 organizaciones activas** 5 cargaron su llave de IA,
**4 generaron alguna vez un documento** y **2 generaron algo desde el 2026-09-15** (13 de las 24
versiones que hay). Y no hace lo que promete su bajada: nada de lo que produce se cruza con un dato
real del negocio.

---

## 1 · Qué pide el documento

**El documento funcional no especifica esta pantalla.** `CC_Arquitectura_Funcional.md` (fuera del
repositorio, 1.650 líneas) usa «ICP» para otra cosa —el puntaje y el segmento de un lead, en el
perfil resumido del §5.3 (líneas 255-256)— y nombra la oferta sólo como una decisión que otros no
pueden tomar solos: Lead Flow no es responsable de «cambiar la oferta» (§9.8, línea 646) y
Acquisition no puede cambiarla sin validación ejecutiva (§18.10, línea 1378). Ninguna sección
describe un avatar, una categoría única, un precio o un mapa de proceso.

Lo que hace de especificación es otro sistema: **Foundations, del hub ARIA-brain**. La Etapa 9 portó
siete de sus nueve herramientas con sus identificadores, sus metodologías y sus textos
(`docs/OTROS/capa-base/ETAPA-9.md:13-26`); las otras dos —VSL y Landing— entraron después y se
mudaron a la pantalla Tools el 2026-08-31 y el 2026-09-02 (`lib/fundaciones/herramientas.ts:788-811`).
El prototipo `aios-command-center_1.html` tenía acá un marcador «Pendiente de construir»
(`components/views/IcpView.jsx:1-5`).

Y hay una promesa que no viene del hub sino de ese prototipo, en la bajada de la pantalla: «Tu cliente
ideal y tu oferta, y cómo evolucionan con los datos reales» (`components/views/IcpView.jsx:33-35`).
Es lo único que la pantalla dice de sí misma y no cumple; ver § 5.

---

## 2 · Qué hay hoy

**La sección.** `lib/autorizacion/secciones.ts:234-237`: clave `icp`, nombre «ICP & Oferta»,
`capacidadRequerida: 'fundaciones.ver'`, en el grupo `AIOS` del menú junto a Executive y Leads
Portal, con el galón `›`. Su comentario (`lib/autorizacion/secciones.ts:229-233`) dice que es «la
única de las diez sin la bandera» `sinOperacionesTodavia`, y eso ya no es cierto: desde el
2026-09-26 la única que la conserva es `executive` (`lib/autorizacion/secciones.ts:216`,
`lib/autorizacion/secciones.ts:225`).

**La vista.** `components/views/IcpView.jsx:21-45` monta `Fundaciones` con el catálogo
`CATALOGO_ICP` (`components/fundaciones/Fundaciones.jsx:49-77`): siete herramientas, siete rutas y
`soloChat: true`, o sea sin formulario ni selector de modo; todo se le dice al agente, que abre
proponiendo lo que la herramienta hereda (`components/fundaciones/Fundaciones.jsx:53-60`). Fue la
primera vista con estado en React y salió a propósito de `npm run paridad`
(`docs/OTROS/capa-base/ETAPA-9.md:181-195`).

Se monta **al abrir la aplicación, esté activa o no**: `components/CommandCenter.jsx:78-89` dibuja
todas las secciones visibles de una vez, y `Fundaciones` pide su estado al montarse
(`components/fundaciones/Fundaciones.jsx:193-195`). Cada entrada a Comando Central de alguien con la
pestaña lee la fila de su organización, aunque nunca abra ICP & Oferta.

### 2.1 · Las siete piezas del método

En el orden del método, que no es el de los identificadores (`lib/fundaciones/herramientas.ts:775-783`).
Los techos salen de `lib/fundaciones/prompts.ts:62-67` y la herencia declarada, la que la pantalla
muestra como «Hereda de», de `lib/fundaciones/herencia.ts:163-182`; un prompt puede leer más que eso,
como el del ICP, que además lee la ficha (`lib/fundaciones/prompts.ts:199-200`):

| Pestaña | id del hub | Entrega | Techo de salida | Hereda de | Dónde |
|---|---:|---|---:|---|---|
| Tu ficha | 0 | Perfil de Cliente | 8.192 | ninguna herramienta; lee el onboarding | `lib/fundaciones/herramientas.ts:146-193` |
| Research | 1 | Market Research, en cinco pasos | 16.000 por paso | Tu ficha | `lib/fundaciones/herramientas.ts:198-279` |
| ICP | 3 | Avatar Buyer Profile | 16.000 | Research | `lib/fundaciones/herramientas.ts:281-334` |
| Categoría | 2 | Category Architect — 5 Pasos | 8.192 | nicho e ICP | `lib/fundaciones/herramientas.ts:336-365` |
| Oferta | 4 | Oferta Irresistible | 16.000 | nicho, ICP y categoría | `lib/fundaciones/herramientas.ts:367-419` |
| Tu precio | 10 | Pricing Protocol | 16.000 | ICP y oferta | `lib/fundaciones/herramientas.ts:421-469` |
| Mapa | 26 | Mapa de Proceso | 16.000 | ICP, categoría, oferta y precio | `lib/fundaciones/herramientas.ts:471-498` |

- **El Research no es un documento sino cinco encadenados**: segmentos, dolores y dolor crítico,
  quién ya escaló resolviéndolo, modelo de precios y la evaluación que elige el segmento ganador
  (`lib/fundaciones/herramientas.ts:204-208`). Entre el paso 1 y el 2 hace una **mirada al mercado
  real** con los scrapers de Tools —Google Maps, el Espía de Anuncios y las páginas de Facebook de
  esos anunciantes— y los pasos 2 al 5 leen el resumen contado, nunca los registros
  (`lib/fundaciones/mercado.ts:8-21`).
- **Tu ficha hereda de afuera del sistema**: el onboarding que la empresa contestó al inscribirse
  (`lib/fundaciones/prompts.ts:140-156`), que un disparador de la base copia a la columna `intake`
  (`lib/fundaciones/estado.ts:47-55`) y que «Traer del onboarding» vuelve a copiar a pedido
  (`app/api/fundaciones/onboarding/route.ts:7-17`).
- **Once metodologías** (`SKILL.md`) sostienen las siete: seis herramientas más los cinco pasos
  (`lib/fundaciones/prompts.ts:32-53`). Entraron como copias byte a byte de las del hub
  (`docs/OTROS/capa-base/ETAPA-9.md:161-162`), y **hoy seis ya no lo son**, porque se editaron
  acá: Tu ficha recibió el bloque del onboarding (`a058c58`, 2026-09-10), el paso 1 el de la ficha
  (`9065f13`, 2026-09-09) y los pasos 2 al 5 el de la mirada al mercado (`1ab4d5d`, 2026-09-10).
  Las de ICP, Categoría, Oferta, Tu precio y Mapa son idénticas a la copia del hub que hay en esta
  máquina (comparadas el 2026-09-28; que esa copia esté al día no se verificó). Si una no se puede
  leer, la generación responde `metodologia_ilegible` y no genera
  (`docs/OTROS/capa-base/ETAPA-9.md:148-154`). Entran al paquete
  por `outputFileTracingIncludes` de `next.config.mjs`, declarado para la ruta que genera de esta
  pantalla y para la de Tools.
- **El modelo** es `claude-sonnet-5` (`lib/fundaciones/generacion.ts:52`), y sólo el Research lleva
  búsqueda web (`lib/fundaciones/generacion.ts:72`, `lib/fundaciones/generacion.ts:131`).
- Alrededor de las piezas: regenerar con un ajuste (`lib/fundaciones/operaciones.ts:420-422`),
  descargar como Word o PDF (`lib/fundaciones/exportar.ts:1`), las diez últimas versiones por
  herramienta (`lib/fundaciones/almacen.ts:275-276`) y, con el Research completo, un botón que
  construye los pasos 3 a 7 en cadena (`components/fundaciones/PanelResearch.jsx:737-751`).
- **Tools comparte el almacén**: la ruta de estado de cada pantalla llama a la misma función, así
  que el VSL y la Landing heredan de acá lo que ya se generó
  (`lib/fundaciones/herramientas.ts:802-806`).

### 2.2 · Las operaciones de servidor

Siete rutas, ocho manejadores. El trabajo vive en `lib/fundaciones/operaciones.ts`, compartido con
Tools; en cada ruta quedan la capacidad y la resolución de la llave. La excepción es `onboarding`,
que llama desde la propia ruta a la función de la base que copia el formulario
(`app/api/fundaciones/onboarding/route.ts:40-43`):

| Ruta | Capacidad | Qué gasta | `maxDuration` |
|---|---|---|---:|
| `GET` estado | `fundaciones.ver` (`app/api/fundaciones/estado/route.ts:46`) | nada | 300 (`app/api/fundaciones/estado/route.ts:43`) |
| `POST` estado (guarda inputs) | `fundaciones.editar` (`app/api/fundaciones/estado/route.ts:55`) | nada | 300 |
| `POST` generar | `fundaciones.editar` (`app/api/fundaciones/generar/route.ts:30`) | tokens | 600 (`app/api/fundaciones/generar/route.ts:27`) |
| `POST` conversar | `fundaciones.editar` (`app/api/fundaciones/conversar/route.ts:41`) | tokens | 300 (`app/api/fundaciones/conversar/route.ts:38`) |
| `POST` rellenar | `fundaciones.editar` (`app/api/fundaciones/rellenar/route.ts:25`) | tokens, una inferencia corta | 300 (`app/api/fundaciones/rellenar/route.ts:22`) |
| `POST` mercado/preparar | `fundaciones.editar` (`app/api/fundaciones/mercado/preparar/route.ts:27`) | tokens, una inferencia corta | 300 (`app/api/fundaciones/mercado/preparar/route.ts:24`) |
| `POST` mercado | `fundaciones.editar` (`app/api/fundaciones/mercado/route.ts:21`) | nada: cuenta y guarda | sin declarar |
| `POST` onboarding | `fundaciones.editar` (`app/api/fundaciones/onboarding/route.ts:35`) | nada | sin declarar |

Las cuatro que gastan resuelven la llave con `resolverAccesoAFundaciones`
(`lib/credenciales/resolver.ts:362-369`) y están en `ARCHIVOS_AUTORIZADOS` sólo por eso
(`pruebas/apoyo/autorizados.ts:175-181`); las demás abren `conOrganizacion(` como cualquier ruta.

### 2.3 · El Research y sus techos de tiempo

Un paso por petición, para que un fallo en el cuarto no se lleve los tres que ya salieron
(`lib/fundaciones/operaciones.ts:350-354`), y cada paso lee los anteriores del almacén, no del
navegador (`lib/fundaciones/operaciones.ts:361-364`). Quien encadena los cinco y la mirada al mercado
es **la pestaña del navegador** (`components/fundaciones/PanelResearch.jsx:405-416`).

Entre el 2026-09-21 y el 2026-09-23 el Research pasó por cuatro arreglos, todos disparados por la
misma organización cliente, cuyo paso 1 no salía:

1. **`9a3bbd0`** (2026-09-21): el fallo de un paso se escribía dentro de un acordeón que en la primera
   corrida nace cerrado; la persona veía el botón volver a su texto y nada más. Ahora el paso que falla
   se abre (`pruebas/codigo/148-el-error-que-nadie-ve.test.ts:70`). El mismo commit deja escrito un
   segundo camino que **no** arregla: el agente dice «arranco» sin que nada arranque (ver § 7).
2. **`c12a70e`** (2026-09-22): cuando el modelo no contestaba, la causa llegaba entera hasta la última
   capa y ahí se tiraba; la pantalla decía «(sin respuesta)» y el registro del servidor quedaba vacío.
   Ahora las dos ramas dejan línea y llevan su motivo a la pantalla.
3. **`36eb2f6`** (2026-09-23): el registro, ya con la causa, dijo `The operation was aborted due to
   timeout`. El corte era nuestro: 240 s contra Anthropic dentro de una función de 300. Pasó a 280.
4. **`d6b1f90`** (2026-09-23): los tres números subieron juntos. La función de generar va de 300 a
   600 s (`app/api/fundaciones/generar/route.ts:22-27`), el corte contra Anthropic de 280 a 580
   (`lib/http/cliente.ts:277`) y la espera del navegador de 300 a 600 (`lib/http/cliente.ts:115-119`).
   Los 20 s entre 580 y 600 son para guardar la versión antes de responder
   (`lib/http/cliente.ts:264-270`), y una prueba compara los números
   (`pruebas/codigo/90-fundaciones.test.ts:947`).

Sólo `generar` subió. `conversar` y `rellenar` siguen en 300 s con la espera externa por omisión de
240 (`lib/http/cliente.ts:239`), que cabe. **`mercado/preparar` no cabe**: también declara 300 s
(`app/api/fundaciones/mercado/preparar/route.ts:24`), pero su inferencia —el rubro del paso 1, 100
tokens— sale por `generar()` (`lib/fundaciones/operaciones.ts:757-760`), que espera siempre 580 s
(`lib/fundaciones/generacion.ts:140`). Si Anthropic no contesta, corta la plataforma a los 300 y no
nuestro tope, sin mensaje de error; la prueba que vigila la regla mira sólo las dos rutas de generar
(`pruebas/codigo/90-fundaciones.test.ts:969`), y otra fija ese 300 tal cual, sin compararlo con
nada (`pruebas/codigo/133-research-mercado-real.test.ts:323`). Es una inferencia de 100 tokens y
ningún registro citado en los commits muestra que se haya cortado.

**El techo de una corrida completa**, sumando las constantes: cinco pasos de hasta 600 s son 50
minutos, y cada trabajo de scraping se sondea hasta 120 veces cada 5 s, o sea 10 minutos
(`components/fundaciones/PanelResearch.jsx:281-290`), con las páginas de Facebook corriendo
**después** del Espía y no en paralelo (`lib/fundaciones/mercado.ts:64-69`). Si la pestaña se cierra,
la cadena se corta; los pasos ya salidos quedan guardados.

**Lo que muestran los datos después del arreglo**, medido el 2026-09-28 (el commit `9a3bbd0`
identifica a esa organización como la que había generado cinco herramientas el 18 y el 20 de
septiembre, y la base tiene una sola así): tiene **1 paso del Research de 5** y ninguna mirada al
mercado. El commit la midió con cero pasos el 2026-09-22, así que ese paso se guardó después;
cuándo exactamente no se puede saber, porque las salidas del Research se guardan sin fecha
(`lib/fundaciones/almacen.ts:301-308`). Una de las dos organizaciones con el Research completo (5
de 5, dada de alta el 2026-09-10) generó el 2026-09-23 ICP, Categoría, Oferta, Tu precio y Mapa en
ocho minutos, en el orden del método: la huella de la cadena de los pasos 3 a 7, o de cinco
«Continuar al paso N» seguidos. Desde la base no se distinguen.

### 2.4 · El chat con el agente, y su histórico

**Un solo agente para todas las herramientas con formulario**, que saca las preguntas del catálogo
(`lib/fundaciones/conversacion.ts:16-34`) y contesta siempre por una herramienta forzada que devuelve
el mensaje y el estado completo de las respuestas (`lib/fundaciones/conversacion.ts:36-41`). Techo de
1.500 tokens por turno (`lib/fundaciones/conversacion.ts:86`), el modelo ve los últimos 20 turnos
(`lib/fundaciones/conversacion.ts:100`) y la versión del agente es la 2
(`lib/fundaciones/version-del-agente.ts:9`). El historial no viaja por el navegador
(`lib/fundaciones/operaciones.ts:458-467`), y si se genera o no lo decide el servidor, no el modelo
(`lib/fundaciones/operaciones.ts:713-720`, `lib/fundaciones/conversacion.ts:499-513`). La misma
lógica sirve a Tools por su ruta gemela (`app/api/fundaciones/conversar/route.ts:18-20`).

La conversación viva es **un casillero por herramienta en `tool_chats`, que se reescribe entero en
cada turno** (`lib/fundaciones/estado.ts:30-46`). Tres commits del 2026-09-22, a pedido del equipo
por el reporte de las empresas, son de acá y cambiaron qué quiere decir «se guardó»:

- **`60844ac`**: refrescar la pestaña borraba lo conversado. Los paneles reabrían el chat en cada
  montaje mientras la herramienta no tuviera entregable, y la reapertura guardaba una conversación
  vacía encima. Ahora se reabre sólo con un gesto, y la pregunta es si la persona escribió algo, no
  cuántos mensajes hay (`lib/fundaciones/estado.ts:207-209`). El commit midió la huella en
  producción: la organización principal tenía nueve conversaciones de un solo mensaje, el saludo.
- **`a6d8f48`**: el histórico. `public.aria_cc_fundaciones_mensajes`, una fila por mensaje, que sólo
  se agrega (`lib/fundaciones/historico.ts:11-13`); archivar nunca lanza y corre después de guardar
  el turno (`lib/fundaciones/historico.ts:17-21`, `lib/fundaciones/almacen.ts:357-374`). La tabla la
  crea la migración 019 de otra serie, corrida a mano; no está en este repositorio.
- **`1e41fa7`**: una revisión adversarial encontró dos puertas más —cambiar de pestaña y el pedido de
  «Continuar al paso N» que el Research nunca consumía— y que el histórico se llenaba de saludos. Desde
  ahí sólo se archiva lo que tiene un turno de la persona (`lib/fundaciones/historico.ts:201-217`), en
  su propia transacción (`lib/fundaciones/historico.ts:169-171`).

**El histórico no tiene lector.** En `lib/`, `app/` y `components/` la única consulta sobre la tabla
es el `insert` (`lib/fundaciones/historico.ts:234`); la pantalla «las conversaciones de esta empresa»
que el propio archivador anuncia (`lib/fundaciones/historico.ts:206-208`) no existe. Reabrir ya no
borra en la base, pero la persona sigue sin poder ver la conversación anterior.

### 2.5 · La relación con ARIA-brain, hoy

**Dicen cosas opuestas el `README.md` y `docs/OTROS/analizadores/ANALIZADORES.md:26`, y el código le
da la razón al segundo.** El `README.md`, en su apartado «ICP & Oferta es la excepción», afirma que el
estado «vive en el almacén de ARIA-brain», que no está en esta base y que el aislamiento no lo cubre.
Eso fue cierto del 2026-08-23 al 2026-09-07. El commit `b0a983b` lo cortó:

- el almacén lee y escribe `public.aria_cc_foundations`, una fila por organización, con RLS forzada
  y la política por `app.org_id` (`lib/fundaciones/almacen.ts:14-24`, `lib/fundaciones/almacen.ts:71`);
- para generar hace falta la llave de IA y nada más: `sin_alumno_vinculado` desapareció
  (`lib/credenciales/resolver.ts:337-344`);
- una prueba falla si el almacén vuelve a nombrar el hub
  (`pruebas/codigo/130-foundations-sin-hub.test.ts:25-31`), y `docs/OTROS/capa-base/ETAPA-9.md:340-345`
  da por superado todo lo que ese documento decía del almacén compartido;
- fuera de comentarios, ninguna línea de `lib/fundaciones/`, `app/api/fundaciones/` ni
  `components/fundaciones/` nombra `aria_brain_client_state` ni `sin_alumno_vinculado`, ni lee una
  variable de entorno (grep del 2026-09-28), y en producción `aria_cc_foundations` tiene la RLS
  activa y forzada con una sola política, por `app.org_id` (catálogo leído el 2026-09-28).

Lo que queda del hub, y **nada de esto corre en ejecución**:

- **El proyecto de Supabase.** `public` se comparte con otras plataformas, entre ellas ARIA-brain, y
  el prefijo `aria_cc_` es lo que dice de quién es cada tabla (`lib/datos/esquema.ts:1430-1436`).
- **Los nombres, como contrato.** Los identificadores de herramienta son los del hub
  (`lib/fundaciones/herramientas.ts:11-16`), los campos del JSON siguen en inglés
  (`lib/fundaciones/estado.ts:11-17`) y las metodologías nacieron como copias, de las que seis ya
  se apartaron (§ 2.1).
- **Los datos copiados una vez.** La organización principal (`aria`) conserva lo que la migración 011
  trajo del hub: siete versiones bajo las claves 101 a 105 fechadas el 2026-07-24 —el historial por
  paso del Research del hub, el módulo `mrSteps.ts` de ARIA-brain—, una versión de Tu ficha del mismo
  día y el `deep_research` (medido el 2026-09-28). Ninguna herramienta de acá usa las claves 101 a
  105: el lector tolerante las carga y cada versión nueva las vuelve a escribir tal cual
  (`lib/fundaciones/almacen.ts:285-291`).
- **La columna `fundaciones_cliente_id`**, sin lectores en la aplicación. Sólo la escribe
  `scripts/altas-high-ticket.mjs:280-296`, y en producción la tiene 1 organización: la principal
  (medido el 2026-09-28).
- **Comentarios que siguen diciendo lo contrario**, además del `README.md`:
  `app/api/fundaciones/rellenar/route.ts:21` y su gemela `app/api/tools/rellenar/route.ts:21`
  («leer el almacén del hub»),
  `app/api/tools/scrape/route.ts:30-32` («el vínculo sigue haciendo falta para Fundaciones»),
  `lib/tools/scrapers.ts:16-19` («la identidad es la del hub», que contradice a la ruta que el mismo
  comentario cita, `app/api/tools/scrape/route.ts:26-28`) y
  `components/fundaciones/Fundaciones.jsx:21-22` («falta el vínculo»).

La mirada al mercado tampoco pasa por el hub: va por el proxy de Tools a un backend de scraping
externo, con el `org_id` de la sesión (`app/api/tools/scrape/route.ts:72-75`,
`app/api/tools/scrape/route.ts:90-93`).

---

## 3 · Lo que está hardcodeado

**Cero juegos de datos inventados.** Ninguna cifra de la pantalla está escrita a mano: lo que dibuja
sale del almacén o del modelo. Lo que sí está fijo en el código, y decide qué pasa, es:

- **La promesa de la bajada**, heredada del prototipo: «cómo evolucionan con los datos reales»
  (`components/views/IcpView.jsx:33-35`). Nada evoluciona con datos reales; ver § 5.
- **Los topes de gasto de la mirada al mercado**: 100 negocios de Maps
  (`lib/fundaciones/mercado.ts:72-73`), 100 páginas de Facebook (`lib/fundaciones/mercado.ts:173-178`)
  y 300 anuncios del Espía, que no descuentan saldo al cliente (`lib/fundaciones/mercado.ts:75-82`).
- **Las once metodologías** y sus techos de tokens (§ 2.1), y las diez versiones por herramienta.

---

## 4 · Datos que YA tenemos

Todo lo de esta sección se midió el 2026-09-28 contra producción, sobre
`public.aria_cc_foundations`, `public.aria_cc_fundaciones_mensajes`, `identidad.*` y
`negocio.contactos`, sólo con conteos.

**Cuántas empresas la usan.** El embudo, por organización:

| | Organizaciones |
|---|---:|
| Existen | 13, 11 activas |
| Tienen fila en el almacén | 10, todas activas |
| … con el onboarding copiado (`intake`) | 10 de 10 |
| Cargaron su llave de IA | 5, todas con fila |
| Generaron alguna vez un documento | 4 |
| Tienen el Research completo (5 de 5 pasos) | 2 |
| Tienen la mirada al mercado guardada | 2 |
| Conversaron con el agente (un turno de la persona en el chat vivo) | 3 |
| Generaron algo desde el 2026-09-15 | 2 |

**Tener fila no es usar la pantalla.** 6 de las 10 no tienen ni una versión, ni un paso del Research,
ni un turno de la persona (5 sin llave de IA y 1 con llave): lo único que guardan es el onboarding,
que copia un disparador de la base sin que nadie abra la pestaña (`lib/fundaciones/estado.ts:47-55`).
La migración 014 que lo crea no está en este repositorio, pero su función sí está en el catálogo de
producción (leída el 2026-09-28): `aria_cc_tg_onboarding_a_la_ficha`, disparada en cada `insert`
y cada `update` de `aria_cc_icp_oferta`, hace `insert … on conflict (org_id) do update`, o sea que
**crea la fila** si no existe. Un censo de Supabase del 2026-09-21, que está en disco pero fuera de
lo versionado (no va a GitHub, por decisión del 2026-09-23), contaba 9 filas en
`aria_cc_foundations` y 8 en `aria_cc_icp_oferta`; el 2026-09-28 son 10 y 10.

**Las versiones generadas**, por herramienta:

| Herramienta | Organizaciones | Versiones |
|---|---:|---:|
| Tu ficha | 4 | 9 |
| ICP | 3 | 5 |
| Categoría | 3 | 3 |
| Oferta | 3 | 3 |
| Tu precio | 2 | 2 |
| Mapa | 2 | 2 |
| **Total** | 4 | **24** |

- **13 de las 24 son del 2026-09-17 al 2026-09-25**, de dos organizaciones dadas de alta el 2026-09-10
  y el 2026-09-17 (7 y 6). Las 11 anteriores: 1 del 2026-07-24, que vino del hub; 4 entre el 28 y el
  31 de agosto; 6 entre el 3 y el 13 de septiembre. La última es del 2026-09-25.
- **La organización principal tiene 9 y la última es del 2026-09-04**: desde el 2026-09-15 no generó
  nada, y el histórico no registra ningún turno suyo.
- **El Research**, que guarda en `market_research.outputs` y no en el historial: 4 organizaciones con
  al menos un paso, con 5, 5, 2 y 1. Si los cinco de la principal se generaron acá o vinieron del hub
  no se puede saber: los pasos no llevan fecha.
- **Ninguna de las 24 versiones lleva procedencia** (`sources`); las siete copiadas del hub, sí.
- **VSL, Landing y Prospección —de Tools, pero herederas de acá— tienen 0 versiones** en las 10 filas.

**Las conversaciones.** El chat vivo tiene 29 conversaciones en 5 filas, con 89 mensajes; sólo **7
tienen un turno de la persona**, en 3 organizaciones. El histórico tiene **101 filas en 29
conversaciones** de 5 organizaciones, 36 escritas por la persona y 12 firmadas con su usuario:

- **25 conversaciones (73 mensajes) son la siembra de la migración 019**: las que no tienen ni un
  mensaje firmado. Los 73 mensajes son la cifra que el commit `a6d8f48` da para el `tool_chats` del
  2026-09-22. Todos los mensajes de cada una llevan una misma hora, del 2026-09-12 al 2026-09-22 a
  las 05:20 UTC, anterior al commit que trajo la tabla (18:32 UTC de ese día), así que ese
  `creado_el` no es cuándo se escribieron. **21 de las 25 son un saludo
  suelto**, justo lo que el filtro de `1e41fa7` impide archivar desde entonces.
- **La aplicación archivó 4 conversaciones desde el 2026-09-22**, 28 filas, las cuatro con turnos de
  la persona. La última fila es del 2026-09-25 a las 04:34 UTC.
- Por herramienta: Research 53 filas, Tu ficha 30, ICP 6, Categoría 3, Oferta, Tu precio y Mapa 2
  cada una, y 3 de Tools (VSL 1, Landing 2). La más larga tiene 17 mensajes.

**Quién puede entrar.** 15 usuarios activos; **los 15 tienen `fundaciones.ver` y
`fundaciones.editar`**, y 14 ven la pestaña: 4 tienen el rol restringido `usuario`, y a 3 de ellos
les concedieron `icp` en `identidad.usuarios_secciones`. Están en 10 organizaciones. Los 15 tienen
además `tools.editar`, que la mirada al mercado también necesita (§ 6).

**El otro ICP.** `negocio.contactos` tiene 594 contactos con 472 puntajes del CRM, todos de una sola
organización (eran 471 de 590 el 2026-09-21, `lib/datos/esquema.ts:316-318`). De las 3
organizaciones con avatar generado, sólo la principal tiene contactos puntuados.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · El cruce con los datos reales, que es lo que la bajada promete.** Ningún módulo de
`lib/fundaciones/` consulta una tabla de `negocio`: lo único que lee es su almacén y, para la mirada
al mercado, las tablas del scraper (`lib/fundaciones/almacen.ts:211-226`,
`lib/fundaciones/operaciones.ts:793-826`). El avatar describe al cliente ideal; el puntaje del CRM,
`negocio.contactos.score` (`lib/datos/esquema.ts:339-343`), califica a cada lead. Son dos «ICP» que
no se cruzan en ninguna tabla (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:358-361`,
`docs/OTROS/futuro/icp-interno-calculado.md:35-37`). Y aunque se escribiera el cruce, hoy tendría con
qué sólo en una organización de las diez con fila.

**2 · La procedencia de cada versión.** El campo `sources` se lee y no se escribe
(`lib/fundaciones/estado.ts:64-67`, `docs/OTROS/capa-base/ETAPA-9.md:217-220`): 0 de 24. Sin él no
hay forma de avisar «tu Oferta se generó con un ICP que ya cambiaste».

**3 · La fecha.** La de una versión es un texto en formato `es-PE` con el reloj del servidor, sin
zona (`lib/fundaciones/almacen.ts:377-380`), y las salidas del Research no llevan ninguna. Cuándo
corrió cada paso sólo lo dice el registro de Vercel, que esta foto no leyó.

**4 · Una pantalla para el histórico.** La tabla existe y se llena; nadie la lee (§ 2.4).

**5 · Un tope de gasto.** No hay (`lib/fundaciones/operaciones.ts:317-318`,
`docs/OTROS/capa-base/ETAPA-9.md:223-225`): un paso del Research son hasta 16.000 tokens con búsqueda
web, y la cadena de los pasos 3 a 7 son cinco generaciones de la llave de la organización.

**6 · El DDL de sus dos tablas.** Ni `aria_cc_foundations` ni `aria_cc_fundaciones_mensajes` las crea
una migración de este repositorio, y para la primera una prueba impide que alguna lo haga
(`pruebas/codigo/130-foundations-sin-hub.test.ts:105-135`). La consecuencia que esa misma prueba
anota: la tabla **no existe en la base local**, así que ICP & Oferta no puede guardar nada en una
máquina de desarrollo.

**7 · La investigación profunda y el lenguaje de campo del Research** se leen si vinieron del hub y
no se pueden generar desde acá (`docs/OTROS/capa-base/ETAPA-9.md:221-222`).

---

## 6 · Reglas propias de esta pantalla

**1 · Los identificadores son los del hub y no se renumeran.** Son la llave posicional del almacén:
renumerar rompe la herencia sin que nada falle (`lib/fundaciones/herramientas.ts:11-16`). Y los campos
del JSON no se traducen (`lib/fundaciones/estado.ts:11-17`).

**2 · Leer no necesita la llave; generar la necesita, y sin respaldo al entorno.** Una
`ANTHROPIC_API_KEY` global facturaría el consumo de todas a una
(`lib/credenciales/resolver.ts:325-334`); sin llave se ve todo y no se genera
(`lib/credenciales/resolver.ts:359-360`), y las dos faltas —`sin_llave_de_ia` y
`llave_de_ia_ilegible`— se dicen por separado (`lib/credenciales/resolver.ts:388-405`).

**3 · Ver y editar son dos capacidades**, porque editar es gastar dinero de la organización
(`docs/OTROS/capa-base/ETAPA-9.md:108-111`). Hoy no separan a nadie: los 15 usuarios activos tienen
las dos (§ 4).

**4 · Nada que decida el contexto de un prompt viaja por el navegador**: el `org_id` sale de la sesión
(`lib/fundaciones/almacen.ts:41`), los pasos anteriores del Research y el historial del chat se leen
del almacén (`lib/fundaciones/operaciones.ts:361-364`, `lib/fundaciones/operaciones.ts:458-467`), y
los números del mercado se cuentan en el servidor (`lib/fundaciones/mercado.ts:15-21`).

**5 · Quien espera espera menos que quien ejecuta.** 580 s de corte contra Anthropic dentro de 600 s
de función, con la versión guardada antes de responder (`lib/http/cliente.ts:264-274`). Si uno sube,
sube primero el `maxDuration`. Hoy la incumple `mercado/preparar`, y ninguna prueba lo ve (§ 2.3).

**6 · Los inputs se guardan antes de generar**, salga como salga la generación
(`lib/fundaciones/operaciones.ts:424-427`), y un turno del chat que falla no guarda nada, ni siquiera
lo que escribió la persona (`lib/fundaciones/operaciones.ts:469-474`).

**7 · Un saludo suelto no es una conversación.** La misma función decide si el chat se reabre y si se
archiva (`lib/fundaciones/estado.ts:207-209`, `lib/fundaciones/historico.ts:214-216`).

**8 · El Research es la única que exige sus campos**, porque sus criterios se buscan en la web y un
criterio vacío no deja un `[COMPLETAR]` sino un research genérico que se ve bien
(`lib/fundaciones/herramientas.ts:117-133`). La ciudad es opcional pero se pregunta antes de arrancar,
tiene que tener zona, ciudad y país, y la salida explícita es «sin datos reales»
(`lib/fundaciones/herramientas.ts:237-250`, `lib/fundaciones/mercado.ts:88`,
`lib/fundaciones/mercado.ts:122-124`).

**9 · La mirada al mercado gasta saldo del monedero y usa las puertas de Tools.** Hasta 200 leads por
Research, para que de los 500 de regalo le queden al menos 300 a la empresa
(`lib/fundaciones/mercado.ts:173-178`); pide confirmación antes de gastar, con el saldo a la vista
(`components/fundaciones/PanelResearch.jsx:308-316`), y la arranca el navegador con las funciones de
Tools (`components/fundaciones/PanelResearch.jsx:258-260`). Por eso pide
`tools.editar` (`app/api/tools/scrape/route.ts:228`) y, a un rol restringido, también la pestaña
Tools concedida (`lib/autorizacion/portero.ts:248-252`). Sin eso el Research corre y la mirada no: la
pantalla dice «No se pudo buscar en Google Maps» con el motivo del rechazo
(`components/fundaciones/PanelResearch.jsx:327-330`). Hoy no le pasa a nadie: los 15 usuarios activos
tienen `tools.editar`, y los 3 de rol restringido con la pestaña `icp` concedida tienen también
`tools` concedida (medido el 2026-09-28). Un paso 1 nuevo borra la mirada anterior
(`lib/fundaciones/operaciones.ts:388-397`).

---

## 7 · Riesgos

**El agente puede anunciar que arrancó sin que nada arranque.** Es el camino que `9a3bbd0` dejó dicho
y no cerró, y ningún commit posterior lo tocó. Las instrucciones le piden al modelo que, en el mismo
turno en que marca `listo`, escriba «una línea avisando que arranca»
(`lib/fundaciones/conversacion.ts:348-352`); el servidor guarda ese mensaje siempre
(`lib/fundaciones/operaciones.ts:705-710`) y decide aparte si se genera
(`lib/fundaciones/operaciones.ts:713-720`). Cuando lo veta —una respuesta cambió en ese turno, o falta
la ciudad—, o cuando el modelo escribe «arranco» sin marcar `listo`, la persona lee que arrancó y no
pasa nada. En el caso que originó el commit, preguntó tres veces y recibió tres veces la misma
confirmación falsa; desde la base no se distingue de un paso que falló.

**El Research vive en una pestaña abierta.** Hasta 50 minutos de pasos más la mirada (§ 2.3), todo
orquestado por el navegador. Cerrar la pestaña corta la cadena sin aviso del lado del servidor, y
lo que quede es un Research a medias que se ve igual que uno que falló. Hoy hay dos así: 1 y 2 pasos
de 5.

**Una documentación que manda a buscar en el lugar equivocado.** Quien lea el `README.md` para
diagnosticar ICP & Oferta va a buscar el estado en la tabla del hub, que ya no se lee. Y la va a
encontrar: `public.aria_brain_client_state` sigue en el mismo `public`, con 51 filas (medido el
2026-09-28), así que lo que vea ahí es un estado viejo que parece vigente, no un error. Cinco
comentarios del código dicen lo mismo (§ 2.5).

**Dos tablas que nadie migra desde acá.** Su forma la decide otra serie de migraciones que se corre a
mano, sin pruebas que la comprueben, y la del almacén no existe en la base local (§ 5). Un cambio de
columna en producción rompe la pantalla sin que ninguna prueba de este repositorio lo vea. Y viven en un
`public` que comparten otras plataformas: un DDL hecho sin mirar el esquema toca un producto ajeno.

**La misma palabra para dos cosas.** «ICP» es el avatar de esta pantalla y el puntaje del CRM que
usan Leads Portal, Acquisition y Creative (`docs/OTROS/futuro/icp-interno-calculado.md:3-4`,
`lib/negocio/calidadDelCreativo.ts:62`). Una métrica «ICP por anuncio» construida sobre el avatar, o
un avatar evaluado contra el puntaje, mezcla dos hechos que no se cruzan (§ 5).

**Un corte de tiempo que es de la plataforma y no nuestro.** En `mercado/preparar` la espera (580 s)
es mayor que la función (300 s), así que un Anthropic lento termina en un corte sin mensaje, en el
único paso de la mirada al mercado que va antes de pedir la confirmación (§ 2.3). Si pasa, el
Research sigue y la mirada se omite como «no se pudo preparar la búsqueda».

**Gasto sin techo, y un techo que no es de esta pantalla.** No hay tope por organización (§ 5).
Según `lib/http/cliente.ts:254-257` la cuenta de Vercel tiene un presupuesto de 200 dólares que corta
al llegar; si es así, corta la aplicación entera y no sólo esta pantalla. No verificado en este corte.

**Un histórico que ya nació con ruido.** 21 de sus 29 conversaciones son saludos sueltos de la siembra,
fechados a una hora que no es la del mensaje (§ 4). La pantalla que lo muestre tiene que filtrarlos
con la misma regla que el archivador, o va a mostrar las conversaciones de verdad enterradas debajo.

**Lo que se puede construir hoy, y lo que no.**
SÍ, hoy: mostrar el histórico que ya existe, con el filtro de `hayTurnosDeLaPersona`; escribir
`sources` al generar —el lector ya lo acepta (`lib/fundaciones/almacen.ts:194-197`), aunque ninguna
pantalla lo usa todavía—; y corregir el `README.md` y los cinco comentarios.
NO, hoy: el cruce del avatar con leads reales para 9 de las 10 organizaciones con fila, porque no
tienen contactos en `negocio`; y decir cuándo corrió cada paso del Research, porque no se guardó.
