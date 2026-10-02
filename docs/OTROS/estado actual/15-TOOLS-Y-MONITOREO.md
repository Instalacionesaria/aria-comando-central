# Tools y Panel de Monitoreo
> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **22:05 y las 22:12
> UTC**, con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió un nombre, un correo,
> un teléfono ni un identificador de empresa. Una revisión las volvió a medir antes de las 22:30
> UTC, con los mismos resultados. Las empresas se nombran «la principal», «empresa A» y
> «empresa B», en el orden de sus scrapeos. Cada afirmación lleva su archivo:línea o la consulta que
> la produjo. Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15**
>
> - **La foto anterior no tenía este archivo.** Como pantallas, las nombraba una sola vez, en el
>   mapa del producto de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) («Operación
>   (Setter, Closer, Tools, Monitoreo)»); fuera de eso, [02-CREATIVE.md](02-CREATIVE.md) describía
>   el Espía de Anuncios —que vive en Tools— y [01-ACQUISITION.md](01-ACQUISITION.md) y
>   [03-CONVERSION.md](03-CONVERSION.md) listaban `tools` y `monitoreo` entre las carpetas de
>   `app/api/`. Ninguna cifra de scraping ni del panel. Las dos ya estaban construidas: Tools
>   desde el 2026-08-26 (`78e76f3`) y el Panel de Monitoreo desde el 2026-08-29 (`166984e`).
> - **Tools, tres commits.** `a6d8f48` (2026-09-22): el agente conversacional de Tools firma con el
>   usuario real para el histórico (`app/api/tools/conversar/route.ts:34-37`). `d6b1f90`
>   (2026-09-23): una generación pasa de 5 a 10 minutos de techo
>   (`app/api/tools/generar/route.ts:23-28`). `9697c9f` (2026-09-23): se empieza a medir cuánto
>   tarda cada scrapeo, desde el proxy (`lib/tools/medicion.ts:17-19`). **Esa medición no mide
>   nada**: la tabla que escribe no existe en producción (§ 6).
> - **Monitoreo, ningún commit.** El último es `67ebf3e`, del 2026-09-09, la estética de operación.
> - **Los volúmenes crecieron poco.** Contra el censo de Supabase del 2026-09-21 (un documento
>   local, fuera del repositorio; § 6): trabajos 13 → **16**, leads 2.147 → **2.200**, monederos
>   2 → **3**. Desde el 2026-09-24 no se disparó ningún scrapeo.

**Construidas las dos, con datos reales, y casi sin uso.** En toda la historia hay **16 scrapeos
de 3 empresas** —la principal y dos clientes— sobre 11 dadas de alta, y ninguno después del
2026-09-23 (medido el 2026-09-28). La herramienta que da nombre a Tools, **el plan de Prospección
en Frío, no la generó nadie**: 0 de las 10 filas del almacén la tienen. El Panel de Monitoreo lo
ven **3 personas**, y sus dos columnas de plata —ingreso y margen— salen «—» en las once filas
porque **ninguna empresa tiene precio cargado**. Y la medición de duración que entró el 23 de
septiembre escribe en una tabla que no existe, cuya migración no está en el repositorio.

---

## 1 · Qué son, y por qué no están en el prototipo

**Tools** es «las herramientas de la operación, que heredan de tu ICP y tu oferta»
(`components/views/ToolsView.jsx:99-101`): lo que se hace *después* del método, no una pieza de él
(`lib/fundaciones/herramientas.ts:663-665`). Tiene capacidades propias, `tools.ver` y
`tools.editar` (`db/arranque/001_catalogo.sql:98-99`), y no reusa `fundaciones.*` a propósito:
darle Tools a alguien le daría también ICP & Oferta (`lib/autorizacion/secciones.ts:394-397`).

**El Panel de Monitoreo** es «la pantalla con la que ARIA mira a sus clientes: cuántos scrapeos
hizo cada empresa y con qué scraper» (`lib/autorizacion/secciones.ts:410-413`). Tiene una sola
capacidad, `monitoreo.ver`, de lectura (`db/arranque/001_catalogo.sql:103-104`, `:125`), y es **la
única sección con `soloDesdeLaPrincipal`** (`lib/autorizacion/secciones.ts:415`, `:439`). Las dos
van en el grupo Operación, después de Setter, Closer y Analizadores
(`lib/autorizacion/secciones.ts:339-441`).

**Ninguna de las dos está en el prototipo.** `aios-command-center_1.html` tiene diez vistas
—acquisition, closer, contacts, conversation, conversion, creative, executive, icp, sales y
setter— y ninguna es `v-tools` ni `v-monitoreo` (conteo de `id="v-…"` en el archivo, hecho hoy).
Tools es la primera pantalla creada de cero en el proyecto (`components/views/ToolsView.jsx:3-5`);
el panel viene del «Panel de Control» de ARIA-brain, que leía el hub y se borró al portarlo
(`app/api/monitoreo/route.ts:9-13`).

**Por eso tampoco están en `scripts/paridad.mjs`**, y el motivo está escrito en las dos secciones:
esa compuerta compara contra el prototipo, y comparar una pantalla que ahí no existe daría un rojo
permanente, que «no se arregla — se ignora, y con él se ignoran los demás»
(`lib/autorizacion/secciones.ts:399-401`, `:430-432`; lo mismo en
`components/views/MonitoreoView.jsx:3-5`). Hoy la pregunta es además académica: la lista `VISTAS`
de la compuerta quedó vacía el 2026-09-26 (`aed4f27`) y la compuerta no corre en la integración
continua (`scripts/paridad.mjs:140-153`).

**El documento funcional tampoco las tiene.** En `CC_Arquitectura_Funcional.md` (1.650 líneas, en
las descargas del usuario, fuera del repositorio) «Tools», «prospección», «scraping» y «Apify»
aparecen cero veces; «monitorear» aparece dos, como verbo (líneas 1335 y 1485), y «Operación» una,
como categoría de error del supervisor (§ 11.6, línea 899). Las dos pantallas salen de pedidos del
equipo registrados en los commits, no de ese documento.

---

## 2 · Qué hay hoy en pantalla

### Tools

Una envoltura que monta el componente de Fundaciones con un catálogo propio
(`components/views/ToolsView.jsx:40-83`) y, arriba de las pestañas, la franja de saldo
(`components/views/ToolsView.jsx:100-102@40f699a`). A la izquierda de una raya, el recorrido numerado de
herramientas; a la derecha, las vistas (`components/fundaciones/Fundaciones.jsx:453-456@40f699a`):

| pestaña | qué es | rastro |
|---|---|---|
| 1 · Prospección en Frío | el plan de ataque outbound (id 20 del hub) y el extractor de leads | `lib/fundaciones/herramientas.ts:672-766` |
| 2 · Tu video de ventas (VSL) | mudada de ICP & Oferta el 2026-08-31 | `lib/fundaciones/herramientas.ts:788-811` |
| 3 · Tu página | la Landing, mudada el 2026-09-02 | ídem |
| Espía de Anuncios | vista: busca anuncios y extrae hooks con IA | `components/views/ToolsView.jsx:67-74` |
| Mis Leads | vista: el historial de lo scrapeado, con envío al CRM | `components/views/ToolsView.jsx:81` |

> **Después del corte, el 2026-10-01** (nueva estructura, E9): Tools gana una pestaña **Scraper**, entre el
> Espía y Mis Leads, con el mismo extractor de Prospección y la tabla de lo que trae
> (`components/tools/VistaDelScraper.jsx`). Sin `tools.editar` no dibuja el extractor; Prospección sigue
> igual. Ver `docs/OTROS/nueva-estructura/02-DONDE-VA-CADA-PANTALLA.md`, `NE-20`.
>
> **Y el 2026-10-02** (E10): las seis pestañas se abren desde la barra lateral nueva, repartidas en
> Research, Marketing y Sales; el Panel de Monitoreo e Incidentes, desde el engranaje del pie. El punto de
> «hay un scraping corriendo» va en Espía o en Scraper, según dónde se vuelve a ver el trabajo: el Espía
> retoma las búsquedas de anuncios al abrirse, y el Scraper retoma Maps al abrirse y las demás fuentes al
> tocar su pestaña. Con Research cerrado, va en su cabecera.
>
> **Y el 2026-10-02** (E11): Tools ya no tiene barra propia ni la raya, el medidor y la numeración de la
> tabla de arriba: las pestañas las dibuja la cabecera de cada departamento. La franja del saldo va
> arriba de Prospección y del Scraper, y no arriba de todo, y se vuelve a leer en cada visita. Los textos
> del Research que decían «Tools → Mis Leads» dicen «Research › Mis Leads».

El VSL y la Landing comparten almacén y herencia con ICP & Oferta y están descritos en
[12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md); el análisis del Espía, en
[02-CREATIVE.md](02-CREATIVE.md); el envío de leads a GoHighLevel, en
[06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md). Acá va lo que es sólo de Tools: el scraping.

**Prospección en Frío** no usa el panel genérico: pinta dos de sus cuatro campos —canal y tono— y
pone en su lugar un extractor de leads (`components/tools/PanelProspeccion.jsx:7-11`). Scrapear
no genera el plan ni generar el plan scrapea: son dos gastos distintos, leads de un monedero y
tokens de la llave de IA (`components/tools/PanelProspeccion.jsx:28-32`). No tiene agente
conversacional, porque su formulario dispara un gasto que no se puede volver a generar
(`lib/fundaciones/herramientas.ts:831-837`, `:850-852`).

**El extractor** tiene tres pestañas —Google Maps, Facebook, LinkedIn—
(`components/tools/Scraper.jsx:687-689`). Valida antes de llamar el mínimo de 72 leads de Maps,
las tres partes de la localización y el rango de LinkedIn, porque el backend cobra la corrida aunque
devuelva cero (`components/tools/Scraper.jsx:7-16`, `lib/tools/scrapers.ts:61`). Sondea cada
cinco segundos **sin techo**: sigue hasta `COMPLETED`, `FAILED` o `CANCELLED`
(`components/tools/Scraper.jsx:86-106`). Al montarse le pregunta a la base qué hay en vuelo para
esa fuente y lo retoma (`components/tools/Scraper.jsx:113-135`).

**Las rutas**, todas con `PANTALLA = 'tools'`:

| ruta | capacidad | qué hace | rastro |
|---|---|---|---|
| `POST /api/tools/scrape` | `tools.editar` | arranca un trabajo en el backend y anota el inicio | `app/api/tools/scrape/route.ts:227-263` |
| `GET /api/tools/scrape?trabajo=` | `tools.ver` | sondea un trabajo y anota el fin | `app/api/tools/scrape/route.ts:182-218` |
| `GET /api/tools/trabajos` | `tools.ver` | los trabajos en vuelo, de la base, tope 20 | `app/api/tools/trabajos/route.ts:49`, `:58`, `:64-96` |
| `GET /api/tools/leads` | `tools.ver` | el historial, de a 100, por fuente y búsqueda | `app/api/tools/leads/route.ts:51`, `:57-134` |
| `POST /api/tools/leads/enviar` | `tools.editar` | hasta 100 leads por id al flujo de n8n | `app/api/tools/leads/enviar/route.ts:68`, `:76-79` |
| `GET /api/tools/saldo` | `tools.ver` | el monedero de la empresa, desglosado | `app/api/tools/saldo/route.ts:19-48` |
| `POST /api/tools/espia` | `tools.editar` | el análisis con IA de una búsqueda del Espía | `app/api/tools/espia/route.ts:41-47` |
| `estado`, `generar`, `conversar`, `rellenar` | ver / editar | las gemelas de Fundaciones | [12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md) |

El proxy traduce cada fuente al cuerpo que espera su actor y pone el `org_id` de la sesión en los
cinco (`app/api/tools/scrape/route.ts:85-151`, `:90-93`; el comentario de `:90` todavía dice «las
cuatro»: es del 2026-08-29, `f90fd30`, y el Espía entró el 2026-09-02, `e20f78e`). El Espía
(`ad-spy`) pide 60 anuncios y es la única fuente que no descuenta saldo, según el lado del backend
que este archivo describe (`app/api/tools/scrape/route.ts:57`, `:129-137`).

**La franja de saldo** dice disponibles, de regalo, usados y comprados
(`components/tools/SaldoDeLeads.jsx:55-67`), con la aritmética de `lib/tools/saldo.ts:47-64`. No se
dibuja para un monedero sin límite (`components/tools/SaldoDeLeads.jsx:47`) y dice «Todavía no
usaste leads» sin monedero (`components/tools/SaldoDeLeads.jsx:38-44`). Se lee **una vez**, al
montarse (`components/tools/SaldoDeLeads.jsx:26-34`), y la vista se monta al entrar a la
aplicación junto con todas las demás que la persona ve (`components/CommandCenter.jsx:84-95`).
**Después del corte**, desde la etapa E11 (2026-10-02), la franja se monta sólo con Tools a la vista y
en Prospección o el Scraper, una por pestaña: vuelve a leer el saldo en cada visita a esas dos. Y desde el mismo día dice el saldo en **créditos**, con la equivalencia a la vista: «1 lead = 1 crédito» (la cuenta no cambió).

### El Panel de Monitoreo

La vista monta el panel (`components/views/MonitoreoView.jsx:20-46`). Arriba, las tarjetas
—Scrapeos con sus completados, Leads guardados, Empresas que scrapean de las dadas de alta,
Ingreso mensual con cuántas no tienen precio, Costo de Apify con cuántas corridas quedaron sin
medir, y una por scraper que tenga alguno— (`components/monitoreo/PanelDeMonitoreo.jsx:96-143`).
Abajo, una fila por empresa: scrapeos, las cinco fuentes, leads, disponibles, ingreso, costo y
margen (`components/monitoreo/PanelDeMonitoreo.jsx:224-233`), con «Actualizar» y «Descargar CSV»
(`components/monitoreo/PanelDeMonitoreo.jsx:202-207`). Un clic en la fila reemplaza la tabla por el
detalle: qué buscó esa empresa, trabajo por trabajo, y qué leads le quedaron
(`components/monitoreo/DetalleDeEmpresa.jsx:12-20`), hasta 60 trabajos y de a 100 leads
(`lib/monitoreo/detalle.ts:27`, `:36`).

**Las dos rutas** piden lo mismo, `monitoreo.ver` con `PANTALLA = 'monitoreo'`, y **las dos
vuelven a comprobar la organización principal** en el servidor
(`app/api/monitoreo/route.ts:113-130`, `app/api/monitoreo/[orgId]/route.ts:65-73`). La tabla sale
de un bucle: la lista de empresas de identidad —sin las dos de la sonda de aislamiento,
`lib/administracion/organizaciones.ts:94`— y, por cada una, su contexto abierto como una petición
normal, de a cuatro (`app/api/monitoreo/route.ts:95`, `:150-173`). Se ordena por scrapeos
(`app/api/monitoreo/route.ts:179`). El consumo de cada empresa son tres lecturas en la misma
transacción: trabajos por fuente con su costo, leads y monedero (`lib/monitoreo/consumo.ts:67-112`).

**Lo que dibujaría hoy, calculado desde la base el 2026-09-28** con las mismas cuentas del código.
**No se vio en pantalla** (este trabajo no levanta la aplicación):

| tarjeta | valor | pie |
|---|---|---|
| Scrapeos | 16 | 15 completados |
| Leads guardados | 2.200 | en el historial de todas las empresas |
| Empresas que scrapean | 3 | de 11 dadas de alta |
| Ingreso mensual | — | 11 sin precio cargado |
| Costo de Apify | 12,17 USD, que `usd` escribiría «$12.1671» (`lib/monitoreo/panel.ts:84-87`) | 2 corridas sin medir |
| Google Maps · Facebook Ads · Facebook Pages · Espía | 6 · 1 · 4 · 5 | LinkedIn, en 0, no se dibuja (`components/monitoreo/PanelDeMonitoreo.jsx:136`) |

En la tabla, 8 de las 11 filas van en cero y con «sin monedero», y las columnas Ingreso y Margen van
«—» en las once (`lib/monitoreo/panel.ts:96-99`).

**Las pruebas**, contadas por sus `test(` y **no re-corridas hoy** (este trabajo no corre la suite):
`pruebas/codigo/110-monitoreo.test.ts` con 18 casos,
`pruebas/codigo/165-medicion-de-los-scrapeos.test.ts` con 5,
`pruebas/codigo/139-saldo-de-leads.test.ts` con 3, la del Espía,
`pruebas/codigo/126-espia-de-anuncios.test.ts`, con 12, y la de los anunciantes de la pestaña
Facebook, `pruebas/codigo/127-anunciantes-de-facebook.test.ts`, con 11 (hay otra 127,
`127-filas-clicables`, que no es de Tools). Todas son de `pruebas/codigo/`: leen el texto del
código y ninguna toca una tabla del scraper, porque la base local no las tiene (§ 6). Lo que sí
corre contra la base local es la autorización del panel: que lo dé `usuario` con la pestaña y nunca
`administrador` (`pruebas/base/22-los-tres-roles.test.ts:283`) y que el alta con sólo esa pestaña
se acepte en la principal y se rechace en un cliente (`pruebas/base/31-alcance.test.ts:461`).

---

## 3 · Datos que ya tenemos

Todo medido el **2026-09-28** entre las 22:05 y las 22:12 UTC; entre paréntesis, la cifra anterior
con su fecha. Viven en tres tablas de `public` que **escribe el backend de scraping, no este
proyecto**, por PostgREST (`lib/datos/esquema.ts:1294-1296`), y las tres tienen RLS activada y
forzada con una política cada una (consulta a `pg_class` y `pg_policies`, hoy). La cuarta, la de
mediciones, sería nuestra y no existe (§ 6).

**Los trabajos** (`public.aria_cc_scraper_trabajos`), lo que el panel cuenta como «un scrapeo»
(`lib/datos/esquema.ts:1322-1323`):

| qué | 2026-09-28 |
|---|---|
| trabajos | **16** (13 el 2026-09-21, según el censo de Supabase de ese día) |
| por estado | `COMPLETED` 15 · `FAILED` 1 · en vuelo 0 |
| por fuente | Maps 6 · Espía 5 · Facebook Pages 4 · Facebook Ads 1 · **LinkedIn 0** |
| primero · último | 2026-08-30 03:17 UTC · 2026-09-23 16:06 UTC |
| desde el 2026-09-15 | 4: uno de la principal ese día y tres de la empresa B el 23 |
| con costo de Apify | 14 de 16; **12,17 USD** en total; los 2 sin costo son de Maps |
| con `max_leads` en su columna | **0 de 16**; en `results_data`, 1 (`app/api/tools/trabajos/route.ts:72-85`) |
| con `actualizado_el` igual a `created_at` | 11 de 16; los otros 5 difieren en menos de 1 s (el 2026-09-23, según `9697c9f`: 9 de 13 iguales y 4 a menos de 1 s) |

**Por empresa**, en el orden del panel:

| | la principal | empresa A | empresa B |
|---|---|---|---|
| trabajos | 9, los 9 completos | 4, uno fallido (el de Maps) | 3, los 3 completos |
| Maps · Pages · Ads · Espía | 4 · 2 · 1 · 2 | 1 · 1 · 0 · 2 | 1 · 1 · 0 · 1 |
| cuándo | 2026-08-30 al 2026-09-15 | el 2026-09-13 | el 2026-09-23, en 65 segundos |
| leads guardados | 2.047 | 100 | 53 |
| costo de Apify | 10,57 USD, 1 corrida sin medir | 1,02 USD, 1 sin medir | 0,57 USD |
| monedero | sin límite; 1.047 descontados | 400 disponibles, 500 regalados, 100 usados | 447 disponibles, **0 regalados**, 53 usados |

Las otras 8 empresas no tienen ni un trabajo ni monedero. La combinación de la empresa B —un Maps,
un Espía y un Pages en poco más de un minuto— es la que dispara la mirada al mercado del Research
(`components/fundaciones/PanelResearch.jsx:341-379`); la tabla no dice desde qué pantalla se
disparó un trabajo, así que es una coincidencia observada, no un dato.

**Los leads** (`public.aria_cc_scraper_leads`): **2.200** (2.147 el 2026-09-21); 153 desde el
2026-09-15; el último, 2026-09-23 16:07 UTC. Ninguno huérfano: los 2.200 apuntan a uno de los 16
trabajos, y 10 trabajos dejaron leads. Por el trabajo que los trajo:

| fuente del trabajo | leads | con correo | con teléfono | sin correo ni teléfono |
|---|---|---|---|---|
| Facebook Pages | 1.081 | 651 | 542 | 362 |
| Facebook Ads | 1.000 | 0 | 0 | **1.000** |
| Google Maps | 119 | 76 | 116 | 1 |
| Espía | 0 | — | — | — |

Los 1.000 de Facebook Ads son **un solo trabajo** del 2026-08-31, el paso que descubre anunciantes
(`lib/tools/scrapers.ts:317-318`): se guardan con la misma etiqueta `facebook` que los contactos de
Pages (`lib/monitoreo/fuentes.ts:31-34`) y ninguno trae un dato de contacto. En la principal, lo
descontado del monedero (1.047) es exactamente lo guardado menos esos 1.000; en las empresas A y B
lo descontado coincide con lo guardado. Es coherente con que ni Ads ni el Espía descuenten; el
backend que lo decide no es de este repositorio.

**Los monederos** (`public.aria_cc_scraper_monedero`): **3** (2 el 2026-09-21), uno sin límite, el
de la principal (`lib/datos/esquema.ts:1396`). Nadie tiene leads comprados:
`leads_adicionales_pagados` vale 0 en los tres.

**Cuánto tarda un scrapeo, aproximado.** La medición que lo iba a decir no existe (§ 6), pero hay un
sustituto: la hora del último lead insertado menos la de creación del trabajo. Sobre los 10 trabajos
con leads: Maps, 5 trabajos entre 60 y 224 s (mediana 141); Facebook Ads, 174 s; **Facebook Pages,
35, 184, 1.280 y 1.525 s**. Los dos largos son los de más leads —511 y 424, de la principal, del 31
de agosto y el 2 de septiembre— e insertaron en 4 y 3 tandas. Es una cota inferior de la duración,
no la duración: no ve lo que el actor tardó después de su último lead, ni los trabajos sin leads.

**Las herramientas de IA de Tools.** En el almacén (`public.aria_cc_foundations`, 10 filas), **0
filas** tienen perfil o historial de Prospección (id 20), del VSL (5) o de la Landing (6); las
claves presentes son seis de las siete de Fundaciones (0, 2, 3, 4, 10, 26; el Research, id 1,
guarda aparte) y, sólo en el historial, 101 a 105. Coincide con las «0 versiones» de
[12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md) § 4.

**Quién ve qué**, sólo conteos, sobre los 15 usuarios activos:

| qué | 2026-09-28 |
|---|---|
| con `tools.ver` · con `tools.editar` | 15 · 15 |
| **ven Tools** | **14**, en 10 empresas: los 4 con el rol restringido `usuario` necesitan la pestaña concedida y 3 la tienen |
| con `monitoreo.ver` | 6: 4 en la principal y 2 en otras empresas, que por el reparto sólo pueden tenerla por `usuario` |
| **ven el Panel de Monitoreo** | **3**: `superadministrador` 2 · `usuario` con la pestaña concedida 1 |
| concesiones de la pestaña `monitoreo` | 1, en la principal; 0 fuera de ella |
| empresas con precio mensual cargado | **0 de 13** (11 en el panel y las 2 de la sonda) |

---

## 4 · Datos que faltan, y de dónde tendrían que venir

| hueco | dónde se nota | de dónde tendría que venir | hoy |
|---|---|---|---|
| **La duración de cada scrapeo** | ningún lado la dibuja; era para decidir si los 10 minutos alcanzan (`lib/tools/medicion.ts:6-8`) | `public.aria_cc_scraper_mediciones`, que llena el proxy (`lib/datos/esquema.ts:1406-1415`) | **la tabla no existe** en producción, y la migración «020 de `/migraciones`» que la crearía no está en el repositorio (§ 6) |
| **El ingreso y el margen por empresa** | Monitoreo, dos columnas y una tarjeta | el precio mensual, a mano en Ajustes → Empresas (`db/migraciones/024_ingreso_por_empresa.sql:11-12`, `lib/monitoreo/fuentes.ts:91-97`) | 0 de 13 empresas lo tienen |
| El costo de 2 corridas | Monitoreo, «2 corridas sin medir» | el backend, que consulta Apify y escribe `costo_usd` (`lib/datos/esquema.ts:1365-1370`) | 14 de 16 medidas; los 2 huecos son de Maps |
| El tope pedido de un trabajo | un trabajo retomado sin él no dice cuánto se pidió (`app/api/tools/trabajos/route.ts:74-77`) | la columna `max_leads`, que el backend no escribe (`app/api/tools/trabajos/route.ts:72-78`) | se lee de `results_data`, donde lo tiene 1 de los 16 trabajos |
| Cuántos lotes se subieron al CRM | ningún lado | un registro que la ruta de envío no deja | ver [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) |
| El costo de IA por empresa | no hay columna, a propósito (`app/api/monitoreo/route.ts:23-25`) | los tokens de las generaciones, que ninguna tabla guarda por empresa | sin cambio |
| Qué pantalla disparó un trabajo | la mirada al mercado y el extractor se ven iguales | una columna de origen en la tabla del backend | no existe |

**Lo que queda del lado del usuario:** cargar el precio mensual de las empresas que pagan, si el
panel tiene que decir margen; y decidir si la medición de duración sigue —aplicar la migración que
crea la tabla y traerla al repositorio— o se retira. Fuera de esta carpeta, ninguna de las dos
figura como pendiente en `docs/` (búsqueda de `aria_cc_scraper_mediciones` y `precio_mensual` en
los documentos versionados, hoy: las únicas menciones son una consulta y una nota de que la
columna existe, en `docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:369` y `:448`).

---

## 5 · Reglas propias de estas dos pantallas

**1 · El navegador nunca habla con el backend de scraping, y la empresa sale de la sesión.** El
backend lleva un monedero por organización; si el navegador lo llamara, bastaría mandar otro
identificador para gastarle los leads a otra empresa (`app/api/tools/scrape/route.ts:9-12`). El
`org_id` va en el cuerpo de las cinco fuentes y en la consulta del sondeo, y el backend filtra por
él (`app/api/tools/scrape/route.ts:90-93`, `:192-199`).

**2 · Gastar pide editar; mirar pide ver.** Arrancar un scraping, analizar anuncios, generar y subir
leads piden `tools.editar`; sondear, listar lo que está en vuelo, el historial y el saldo piden
`tools.ver` (`app/api/tools/scrape/route.ts:178-183`, `:220-228`,
`app/api/tools/leads/route.ts:53-58`).

**3 · Lo que dice el backend viaja tal cual.** Su 403 por saldo agotado y su 404 pasan a la pantalla:
es una excepción deliberada a `ADR-0704`, porque «se te acabaron los leads» es lo único accionable
(`app/api/tools/scrape/route.ts:34-39`). Y sin URL del backend no hay valor de reserva: se dice
(`app/api/tools/scrape/route.ts:67-75`).

**4 · Lo que está en vuelo se le pregunta a la base, no a la memoria del componente ni al backend.**
Cambiar de pestaña ya no pierde un scraping pagado (`app/api/tools/trabajos/route.ts:17-31`).

**5 · Las tablas del scraper se leen dentro de `conOrganizacion(` y sin `where` de empresa.** La RLS
es la protección, y un filtro visible taparía cuál es (`app/api/tools/saldo/route.ts:4-6`,
`lib/monitoreo/consumo.ts:107-110`, `app/api/tools/leads/route.ts:22-25`).

**6 · Este proyecto no escribe en las tablas del backend.** Declara sólo las columnas que lee, porque
una columna declarada de más es una que Kysely deja escribir (`lib/datos/esquema.ts:1328-1331`). La
única tabla nuestra es la de mediciones, y la llena sólo `lib/tools/medicion.ts`
(`lib/datos/esquema.ts:1407-1415`).

**7 · Medir no puede romper un scrapeo.** Las dos funciones corren después de tener la respuesta del
backend, no lanzan nunca y van en su propia transacción (`lib/tools/medicion.ts:26-30`); el fin se
anota una sola vez (`lib/tools/medicion.ts:82-84`).

**8 · El panel tiene tres mitades.** La capacidad `monitoreo.ver`, que `usuario` recibe por
derivación; la pestaña concedida, porque `usuario` restringe por sección; y ser de la organización
principal (`lib/autorizacion/secciones.ts:415-424`, `db/arranque/001_catalogo.sql:362-387`). La
tercera se mide sobre la organización **propia**, no la que se está mirando, para que conmutar no
apague el panel (`lib/autorizacion/secciones.ts:111-118`, `:755-760`). El formulario de Usuarios no
ofrece la casilla fuera de la principal (`components/ajustes/Usuarios.jsx:144`). `administrador` no
tiene la capacidad, porque ahí no hay segunda mitad (`db/arranque/001_catalogo.sql:442-466`), y el
catálogo aborta si `usuario` pierde la capacidad o deja de restringirse
(`db/arranque/001_catalogo.sql:735-754`).

**9 · El panel cruza empresas con un bucle, no con una consulta.** Un `group by org_id` bajo RLS
devuelve una fila; las otras dos salidas —una función `security definer` o un rol sin RLS— dejan la
barrera sólo en el código (`lib/monitoreo/consumo.ts:6-35`). De a cuatro, para dejar libre una
conexión del agrupador (`app/api/monitoreo/route.ts:83-95`).

**10 · Un cero que no es cero no se dibuja como cero.** Una empresa que no se pudo leer va «Sin leer»
y los totales lo avisan (`lib/monitoreo/fuentes.ts:98-107`,
`components/monitoreo/PanelDeMonitoreo.jsx:148-154`); sin monedero es «sin monedero», no 0; un costo
o un precio que falta es «—», y el margen es `null` si falta cualquiera de los dos lados
(`lib/monitoreo/panel.ts:96-99`); en el CSV, «sin leer» en cada número
(`lib/monitoreo/panel.ts:104-111`).

**11 · Un scrapeo fallido también cuenta.** Se disparó y costó una corrida; esconderlo haría que una
empresa con el scraper roto se vea como una que no lo usa (`lib/monitoreo/fuentes.ts:52-56`).

**12 · Mis Leads y el detalle del panel no se reúsan.** Uno lee la empresa de la sesión y el otro la
de la URL, con otra autorización; un componente que decide de quién son los datos según quién lo
monta es cómo se filtra un inquilino (`components/monitoreo/PanelDeMonitoreo.jsx:18-23`).

**13 · Al CRM se mandan identificadores, no leads.** Los datos salen de la base filtrados por RLS y
el token nunca pasa por el navegador (`app/api/tools/leads/enviar/route.ts:7-19`, `:119-126`).

---

## 6 · Riesgos

**La medición de duración no mide, y nada lo dice en voz alta.** `public.aria_cc_scraper_mediciones`
no existe en producción (`to_regclass`, hoy). Los comentarios la atribuyen a «la migración 020 de
`/migraciones`» (`lib/datos/esquema.ts:1409`, `lib/tools/medicion.ts:19`), y esa carpeta **no está
en el repositorio ni lo estuvo nunca** (`git log --all` sobre `migraciones/` sin resultados); el
commit `9697c9f` tocó cuatro archivos y ninguno es una migración. Y la `020` que este repositorio
sí tiene es otra cosa: `db/migraciones/020_closer_asignado.sql`. Tampoco existe en el repositorio
`migraciones/006_aria_cc_scraper.sql`, que citan nueve comentarios en ocho archivos
(`lib/datos/esquema.ts:1304`, `app/api/tools/scrape/route.ts:19`,
`components/tools/MisLeads.jsx:12-14`, entre otros): el censo de Supabase del 2026-09-21 ya lo
había dicho, que las crea «la serie de otro servicio». Ese censo es un documento local, excluido
del repositorio en `.git/info/exclude`, así que no se cita por línea. El código hace lo que
promete —el scrapeo sigue igual y queda una línea en el registro por intento
(`lib/tools/medicion.ts:32-33`)—, así que el costo es silencioso: **3 trabajos corrieron después
del commit, el 2026-09-23 desde las 16:05 UTC, y ninguno quedó medido**. Si esa versión ya
estaba desplegada a esa hora y si el registro tiene esas líneas: no verificado, no leí los
registros del servidor. Sobre la tabla, la prueba 165 sólo comprueba que esté declarada en
`esquema.ts` (`pruebas/codigo/165-medicion-de-los-scrapeos.test.ts:101-103`), no que exista.

**La pregunta que la medición iba a contestar ya tiene una respuesta aproximada, y es «sí».** Por el
sustituto de § 3, dos de los diez trabajos con leads pasaron de los diez minutos, los dos de Facebook
Pages. En Tools no rompe nada, porque el sondeo no tiene techo; en el Research sí: espera 120
intentos de cinco segundos (`components/fundaciones/PanelResearch.jsx:281-284`) y después da el
trabajo por caído mientras el actor sigue corriendo y descontando. El Research pide como mucho 100
páginas de Facebook (`lib/fundaciones/mercado.ts:180-184`), y el trabajo de Pages de 100 leads tardó
184 s; si alguna mirada al mercado pasó de los diez minutos: no verificado.

**La franja le diría «53 comprados» a una empresa que no compró nada.** El monedero de la empresa B
tiene `leads_regalados = 0` con 447 gratuitos y 53 usados. `desglosarSaldo` toma como regalo el
mayor entre los dos (`lib/tools/saldo.ts:51`), así que el regalo consumido da 0 y los 53 usados
pasan a «comprados» (`lib/tools/saldo.ts:53-55`): la franja diría 447 disponibles · 447 de regalo ·
53 usados · 53 comprados, cuando, por la aritmética de la fila (447 + 53, 0 pagados), fueron 500
de regalo y ninguna compra. Calculado a mano desde el código y la fila, no visto en pantalla. La
prueba cubre el monedero sin `leads_regalados` sólo con cero usados
(`pruebas/codigo/139-saldo-de-leads.test.ts:48-49`). Y la fila contradice a
`lib/datos/esquema.ts:1399-1402` («lo escribe el backend al abrir el monedero»): el monedero se
abre con el primer scraping (`app/api/tools/saldo/route.ts:8-10`), y el de la empresa B tiene
`creado_el` el 2026-09-23 a las 16:05 UTC, menos de un segundo antes de su primer trabajo; la
columna ya existía —el de la empresa A, abierto el 2026-09-13, tiene 500— y su valor por omisión
es 0 (`information_schema`, medido el 2026-09-28). O sea que el backend no la escribió y quedó el
valor por omisión. Por qué: no verificado, el backend no es de este repositorio.

**Comentarios en cuatro archivos, y el nombre de una prueba, describen un rol que se retiró el
2026-09-01.** El rol `monitoreo` se retiró en `6de4403` y la capacidad pasó a `usuario` por
derivación (`db/arranque/003_retiro_de_roles.sql:52-62`). Siguen diciendo lo contrario:
`app/api/monitoreo/route.ts:30-35` («la tienen `superadministrador` y un rol propio, `monitoreo`» y
el reparto «le niega `monitoreo.%` a `usuario`») y `:39-40` («asignarle el rol `monitoreo` a una
persona de una empresa cliente»); `db/arranque/001_catalogo.sql:106-118`, que se le niega «a DOS
roles» y va «a un rol propio», contra lo que el mismo archivo dice en `:362-387`;
`lib/autorizacion/secciones.ts:101-104`, contra `:415-420` del mismo archivo; y la prueba del
panel: su encabezado (`pruebas/codigo/110-monitoreo.test.ts:10-12`), dos mensajes de falla
(`:57`, `:159-161`) y el nombre de la prueba de `:342`, «NO se la da a ningún rol de puesto»,
mientras su cuerpo afirma que `usuario` sí la tiene (`:373-378`). Quien lea el encabezado de la ruta
para decidir quién ve el panel va a buscar un rol que no existe. En la misma familia, ya señalado
en [12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md): `lib/tools/scrapers.ts:16-19` sigue diciendo que una
organización sin vínculo con el hub no puede scrapear; y, sin señalar hasta hoy, `:7-9` del mismo
archivo, que el monedero vive en `usuarios_scraper`, de la base ajena donde estaba antes de la
006 (`app/api/tools/scrape/route.ts:19-21`); hoy es `public.aria_cc_scraper_monedero`
(`lib/datos/esquema.ts:1389`, `:1508`). Y
`components/monitoreo/PanelDeMonitoreo.jsx:11-12` dice que `app/monitoreo.css` son
ochenta líneas: hoy son 201.

**«Leads guardados» cuenta 1.363 filas sin forma de contactar a nadie.** De los 2.200, 1.000 son
anunciantes de un único trabajo de Facebook Ads y 363 más no traen ni correo ni teléfono. Mis Leads,
la tarjeta del panel y la columna por empresa los suman igual que un contacto de Maps.

**El panel mide plata con una sola de sus tres columnas.** Sin precio en ninguna empresa, ingreso y
margen son «—» en las once filas; el único número de plata es el costo de Apify. Está bien dicho
—el pie dice «11 sin precio cargado»—, pero hoy el panel no puede decir si alguna empresa es
rentable.

**Ninguna tabla del scraper nace de una migración de este repositorio.** Ni `db/`, ni `scripts/`,
ni `.github/` nombran `aria_cc_` (búsqueda de hoy). La base local de la suite no las tiene, así que
**ninguna prueba ejercita una consulta de Tools o del panel contra una tabla**: las de § 2 leen
texto, y las de `pruebas/base/` sólo prueban la autorización. Y la regla «no escribimos en las
tablas del backend» es una convención de tipos: en producción `app_inquilino` tiene `INSERT`,
`UPDATE` y `DELETE` sobre las tres (`has_table_privilege`, medido el 2026-09-28).

**El panel consulta todas las empresas al entrar a la aplicación, no al abrir la pestaña.** Todas
las vistas visibles se montan juntas (`components/CommandCenter.jsx:84-95`) y el panel carga al
montarse (`components/monitoreo/PanelDeMonitoreo.jsx:68-70`): hoy son 11 transacciones por cada
entrada de las 3 personas que lo ven, y crece con cada empresa. Por lo mismo, la franja de saldo se
lee una vez al montarse (`components/tools/SaldoDeLeads.jsx:10-13`): después de un scraping no se
refresca mientras se mira —`leerSaldo` lo llaman sólo la franja y el Research—. Hasta la etapa E11 se
montaba una vez por carga de página; desde entonces se monta en cada visita a Prospección o al Scraper,
también al pasar de una a otra, así que la deuda se achica a «mientras se mira». No verificado en
pantalla con datos.

**El botón de subir al CRM se ofrece a quien no puede usarlo.** Mis Leads se monta sin
`puedeEditar` (`components/views/ToolsView.jsx:81`) y dibuja el envío siempre
(`components/tools/MisLeads.jsx:392-401`); la ruta pide `tools.editar`
(`app/api/tools/leads/enviar/route.ts:79`). Hoy no le pasa a nadie: los 15 activos tienen
`tools.editar`. El Espía, en cambio, sí recibe la bandera (`components/views/ToolsView.jsx:73`), y desde
la etapa E9 también el Scraper. Los dos la reciben de `Fundaciones.jsx`, que la da falsa también cuando
falló la lectura del estado de Tools: en ese caso el aviso dice que es el rol, y no lo es.

**Dos personas de empresas cliente ya tienen `monitoreo.ver`.** Las separan del panel dos cosas: la
pestaña no concedida y `soloDesdeLaPrincipal`. Las dos están en pie (0 concesiones fuera de la
principal, medido hoy) y el catálogo aborta si la primera se cae; es el diseño, pero conviene saber
que la capacidad sola ya no es la puerta.

**Y el que ordena a los demás: casi no hay uso que medir.** 16 scrapeos entre el 2026-08-30 y el
2026-09-23, 0 desde el 24, LinkedIn nunca, y ningún plan de Prospección generado (medido el
2026-09-28). Las reglas de § 5 están escritas y probadas por texto, pero con estos volúmenes nada
de Tools ni del panel se ejerció lo suficiente para mostrar sus fallas, y ninguna cifra de § 2 se
vio dibujada por la aplicación andando.
