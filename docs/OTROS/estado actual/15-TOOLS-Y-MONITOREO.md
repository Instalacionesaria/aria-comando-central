# Tools, el Panel de Monitoreo y el de Incidentes
> Corte: **2026-10-18**, con el código de producción, el commit `972972e` (2026-10-15; migraciones hasta la `078`). En
> local hay ocho commits más, `693a383..dc84cb2`, del modelo de datos multiempresa (Fase 0, migraciones `079` a `084`),
> construidos y **sin subir**: ninguno toca un archivo de Tools, del Panel de Monitoreo ni del de Incidentes. Las cifras
> de producción se midieron el **2026-10-18 entre las 15:34 y las 15:40 UTC**, con `scripts/supabase.mjs leer` y sólo
> conteos y agregados: de la base no salió un nombre, un correo, un teléfono, un texto de búsqueda ni un identificador de
> empresa. Las empresas se nombran «la principal», «empresa A», «empresa B» y «empresa C», en el orden de su primer
> scrapeo. Lo que no se volvió a medir lleva su fecha y lo dice. Ninguna pantalla se miró en el navegador para este
> corte: lo que «dibujaría» cada bloque está calculado desde la base con las cuentas del código. Cada afirmación lleva
> su `archivo:línea`. Para ubicar lo nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión
> anterior —el corte del 2026-09-28, con su bloque «Desde el corte del 2026-09-15»— se lee con
> `git show 972972e:"docs/OTROS/estado actual/15-TOOLS-Y-MONITOREO.md"`.

> **Desde el corte del 2026-09-28**
>
> - **2026-10-01 · `c936b24`, `46c5556`, `60f5d81`** — un fallo del modelo dice qué pasó, a quién le toca y trae una
>   referencia; nace el **Panel de Incidentes** (`negocio.incidentes`, migración `067`), y los dos paneles que miran a
>   todas las empresas pasan a un grupo propio del menú, «Administración».
> - **2026-10-01 a 2026-10-02 · `b532a78`, `40f699a`, `624a941`, `1b1799e`** — la nueva estructura (E9 a E12): nace la
>   pestaña **Scraper** de Tools; la barra lateral por departamentos; Tools y Analizadores pierden su barra propia y sus
>   pestañas las dibuja la cabecera de cada departamento; Ajustes › Usuarios ofrece las pestañas por departamento.
> - **2026-10-02 · `8fa9bd3`, `cdb858b`** — la franja del saldo habla en créditos («1 lead = 1 crédito») y el Espía pasa a
>   llamarse «Espía a tus competidores».
> - **2026-10-02 · `096751d`, `6b35169`, `857dd68`** — la segunda edición (F1 a F3): Radar, Funnel y Leads como grupos
>   con sub-pestañas; Monitoreo e Incidentes en el engranaje, con la ceja «MENÚ DE LA CUENTA»; la caja del cerebro al pie.
> - **2026-10-03 · `821a915`, `6ef4183`, `ac390c6`, `bb389e6`** — el Scraper de Facebook deja la búsqueda por URL; el
>   Espía guarda su historial (`negocio.analisis_del_espia`, migración `068`, y la ruta `GET /api/tools/busquedas-del-espia`);
>   **un solo Espía**: el paso 1 del Scraper de Facebook elige entre las búsquedas del Espía.
> - **2026-10-04 · `cd851b3`, `5d60371`** — el Espía registra su uso en `negocio.uso_de_ia` (AG2) y Tools habla con tú
>   (AG3, prueba `202`).
> - **2026-10-05 · `13723a0`, `5f15c01`** — el cerebro: dos herramientas de Tools (`leads_del_scraper` y `espia`), la
>   ruta `app/api/tools/cerebro/route.ts` y la caja del pie habilitada (AG6 y AG7).
> - **2026-10-08 · `82ba9e7`** — Client OS: otra sección `soloDesdeLaPrincipal`; el Panel de Monitoreo deja de ser la
>   única.
> - **El Panel de Monitoreo no cambió**: ningún commit toca `components/monitoreo/`, `app/api/monitoreo/` ni
>   `lib/monitoreo/` desde el corte anterior.
> - **El uso creció poco.** Trabajos 16 → **26**, leads 2.200 → **2.343**, monederos 3 → **4**, empresas que scrapean
>   3 → **4**. El último scrapeo es del 2026-10-10 (medido el 2026-10-18).

**Construidas, con datos reales, y con poco uso.** En toda la historia hay **26 scrapeos de 4 empresas** —la principal y
tres clientes— sobre 11 dadas de alta; 10 son posteriores al 2026-09-28 (9 de la principal y 1 de una empresa nueva) y
ninguno es posterior al 2026-10-10. LinkedIn sigue sin una sola corrida, y la medición de duración sigue escribiendo en una
tabla que no existe. El Espía es ahora la herramienta más usada —11 de los 26 trabajos— y la única que guarda lo que la IA
dijo de cada búsqueda: hay 2 análisis guardados. El Panel de Monitoreo sigue con sus dos columnas de plata en «—» porque
**ninguna empresa tiene precio cargado**, y el Panel de Incidentes, abierto desde el 2026-10-01, registró **un** incidente,
sin revisar.

---

## 1 · Qué son, y dónde quedaron en la navegación

**Tools** es «las herramientas de la operación, que heredan de tu ICP y tu oferta»
(`components/views/ToolsView.jsx:99-101`): lo que se hace *después* del método, no una pieza de él
(`lib/fundaciones/herramientas.ts:663-665`). Tiene capacidades propias, `tools.ver` y `tools.editar`
(`db/arranque/001_catalogo.sql:98-99`), y no reusa `fundaciones.*` a propósito: darle Tools a alguien le daría también ICP
& Oferta (`lib/autorizacion/secciones.ts:410-413`).

**Desde la nueva estructura, Tools ya no es una pantalla con una barra: son seis entradas en tres departamentos.** La
sección y sus permisos no cambiaron; lo que cambió es por dónde se entra (`lib/autorizacion/departamentos.ts:86-118`):

| departamento | entrada de la barra | sub-pestaña | pestaña de Tools |
|---|---|---|---|
| Research | Radar | Espía a tus competidores · Scraper | `espia` · `scraper` |
| Marketing | Funnel | Tu landing · Tu VSL | `landing` · `vsl` |
| Sales | Leads | De Radar · Plan de prospección (junto a «De GHL», que es el Leads Portal, y «Todos», Próximamente) | `mis-leads` · `prospeccion` |

Una sub-pestaña se ve por su propia sección, así que «Leads» cruza el Leads Portal y Tools sin abrirle a nadie una puerta
que el servidor le cierra (`lib/autorizacion/departamentos.ts:58-73`; commit `096751d`). La pestaña la toma la pantalla cuando se le pide
(`components/views/ToolsView.jsx:57-59`), y la cabecera del departamento dibuja las sub-pestañas en una segunda fila. En
Ajustes › Usuarios, la casilla «Tools» dice lo que abre: seis entradas en tres departamentos (commit `1b1799e`).

**El Panel de Monitoreo** es «la pantalla con la que ARIA mira a sus clientes: cuántos scrapeos hizo cada empresa y con qué
scraper» (`lib/autorizacion/secciones.ts:433-435`). Una sola capacidad, `monitoreo.ver`, de lectura
(`db/arranque/001_catalogo.sql:103-104`, `:125`), y la bandera `soloDesdeLaPrincipal`
(`lib/autorizacion/secciones.ts:462`). **El Panel de Incidentes** (2026-10-01) muestra los fallos del modelo de IA de
todas las empresas, con `incidentes.ver` y la misma bandera (`lib/autorizacion/secciones.ts:467-474`). Los dos van en el
grupo «Administración» del menú (`lib/autorizacion/secciones.ts:463`, `:473`) y, en la barra nueva, en el engranaje del pie
junto a Ajustes (`lib/autorizacion/departamentos.ts:127-130`), con la ceja «MENÚ DE LA CUENTA»
(`lib/autorizacion/departamentos.ts:142-145`).

**Ya no es la única sección con `soloDesdeLaPrincipal`.** Desde el 2026-10-01 la lleva Incidentes y desde el 2026-10-08
Client OS (`lib/autorizacion/secciones.ts:472`, `:495`). El comentario de Monitoreo decía al corte «la única»
(`lib/autorizacion/secciones.ts:438`); desde el 2026-10-18 (`65669f4`) dice que fue la primera y que hoy son tres.

**Ninguna de las tres pantallas está en el prototipo** (`aios-command-center_1.html`): Tools es la primera pantalla
creada de cero en el proyecto (`components/views/ToolsView.jsx:3-5`); el Panel de Monitoreo viene del «Panel de Control»
de ARIA-brain (`app/api/monitoreo/route.ts:9-13`), y el de Incidentes es un pedido del equipo
(`components/views/IncidentesView.jsx:3-8`). Por eso no están en `scripts/paridad.mjs`, cuya lista `VISTAS` está vacía
desde el 2026-09-26 (`scripts/paridad.mjs:140-153`). El documento funcional (fuera del repositorio) tampoco las tiene:
del 2026-09-28, no se volvió a buscar.

---

## 2 · Qué hay hoy en pantalla

### Tools

Una envoltura que monta el componente de Fundaciones con un catálogo propio: las tres herramientas (Prospección, el VSL y
la Landing) y tres vistas, el Espía, el Scraper y Mis Leads (`components/views/ToolsView.jsx:40-83`). El VSL y la Landing
comparten almacén y herencia con ICP & Oferta y están en [12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md); el análisis del Espía
como insumo de Creative, en [02-CREATIVE.md](02-CREATIVE.md); el envío de leads a GoHighLevel, en
[06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md). Acá va lo que es sólo de Tools: el scraping y el Espía.

**La franja del saldo** va arriba de las dos pestañas que gastan créditos, Prospección y el Scraper, y sólo con Tools a la
vista; lleva una `key` por pestaña, así que relee el saldo en cada visita (`components/views/ToolsView.jsx:36-38`,
`:106-111`). Dice disponibles, de regalo, usados y comprados (`components/tools/SaldoDeLeads.jsx:55-67`), con la
aritmética de `lib/tools/saldo.ts:47-64`, y desde el 2026-10-02 habla en créditos: «1 lead = 1 crédito»
(`components/tools/SaldoDeLeads.jsx:57-58`). No se dibuja para un monedero sin límite
(`components/tools/SaldoDeLeads.jsx:47`).

**Prospección en Frío** (Sales › Leads › Plan de prospección) no usa el panel genérico: pinta dos de sus cuatro campos
—canal y tono— y pone en su lugar el extractor de leads (`components/tools/PanelProspeccion.jsx:7-11`). Scrapear no genera
el plan ni generar el plan scrapea: son dos gastos distintos (`components/tools/PanelProspeccion.jsx:28-32`). No tiene
agente conversacional (`lib/fundaciones/herramientas.ts:831-837`, `:850-852`).

**El Scraper** (Research › Radar › Scraper, desde el 2026-10-01) envuelve el mismo extractor de Prospección sin copiarlo, con
la tabla de lo que trae; sin `tools.editar` no lo dibuja (`components/tools/VistaDelScraper.jsx:3-21`, `:43-58`). El
extractor tiene tres pestañas —Google Maps, Facebook y LinkedIn— (`components/tools/Scraper.jsx:676-678`), valida antes de
llamar el mínimo de 72 leads de Maps y lo demás que el backend cobra aunque devuelva cero
(`components/tools/Scraper.jsx:7-16`, `lib/tools/scrapers.ts:61`), sondea cada cinco segundos **sin techo**
(`components/tools/Scraper.jsx:88-108`) y al montarse retoma lo que está en vuelo (`components/tools/Scraper.jsx:115-137`).
**Facebook cambió dos veces el 2026-10-03:** dejó la opción de pegar una URL de la Ad Library (commit `821a915`) y su paso
1 ya no busca: **elige entre las búsquedas del Espía** (`components/tools/Scraper.jsx:386`, `:543`), con un enlace para
espiar una nueva (`components/tools/Scraper.jsx:593`). La fuente `facebook-ads` sigue existiendo en el servidor, en
Monitoreo y en Mis Leads, porque hay corridas viejas con ese nombre (commit `821a915`).

**El Espía a tus competidores** (Research › Radar) busca anuncios por nicho y país y, con un botón aparte, le pide a la IA
los hooks y ángulos. Desde el 2026-10-03:

- **trae 60 o 1.000 anuncios**, a elección: 60 para mirar el nicho, 1.000 para sacar contactos después
  (`components/tools/anuncios.jsx:27-32`). El servidor manda lo que llega, con 60 por omisión
  (`app/api/tools/scrape/route.ts:57`, `:145`);
- **guarda su historial**: «Búsquedas anteriores» lista las de la organización, hasta 30, con país, cuántos anuncios trajo
  y si tiene análisis (`components/tools/EspiaDeAnuncios.jsx:273`, `lib/tools/historial-del-espia.ts:22-79`). Reabrir una no
  vuelve a pagar Apify: los anuncios se leen del trabajo por la ruta del sondeo (`lib/tools/historial-del-espia.ts:11-13`).
  Al volver a la pestaña sin nada corriendo, se abre la última búsqueda terminada con anuncios
  (`components/tools/EspiaDeAnuncios.jsx:139-141`);
- **guarda el análisis**, uno por búsqueda, en `negocio.analisis_del_espia`: volver a analizar reemplaza el anterior
  (`db/migraciones/068_el_analisis_del_espia.sql:11-26`, `lib/tools/historial-del-espia.ts:99-125`). Si guardar falla, el
  análisis igual se entrega (commit `6ef4183`);
- **«Sacar contactos de estos anunciantes →»** abre el Scraper con esa búsqueda ya elegida
  (`components/tools/EspiaDeAnuncios.jsx:330-342`), por `sessionStorage` y un evento (`lib/tools/del-espia-al-scraper.ts:3-20`);
- y dos notas «Próximamente»: «Enviar hallazgos a Copywriter» y «Dream 100» (`components/tools/EspiaDeAnuncios.jsx:401-406`).

**Mis Leads** (Sales › Leads › De Radar) es el historial de lo scrapeado, con envío al CRM. Desde el 2026-10-03 no tiene el
filtro «Espía», que salía siempre vacío: el Espía trae anuncios, no contactos (commit `6ef4183`).

**El punto de «hay un scraping corriendo»** va en Radar, que con un trabajo en vuelo abre la sub-pestaña que lo retoma: las
búsquedas de anuncios, el Espía; las demás, el Scraper (`lib/tools/scrapers.ts:455-467`).

**Las rutas**, todas con `PANTALLA = 'tools'`:

| ruta | capacidad | qué hace | rastro |
|---|---|---|---|
| `POST /api/tools/scrape` | `tools.editar` | arranca un trabajo en el backend y anota el inicio | `app/api/tools/scrape/route.ts:227-263` |
| `GET /api/tools/scrape?trabajo=` | `tools.ver` | sondea un trabajo y anota el fin | `app/api/tools/scrape/route.ts:182-218` |
| `GET /api/tools/trabajos` | `tools.ver` | los trabajos en vuelo, de la base, tope 20 | `app/api/tools/trabajos/route.ts:49`, `:58`, `:64-96` |
| `GET /api/tools/busquedas-del-espia` **(nueva)** | `tools.ver` | las búsquedas del Espía, o con `?trabajo=` su análisis guardado | `app/api/tools/busquedas-del-espia/route.ts:20-28` |
| `GET /api/tools/leads` | `tools.ver` | el historial, de a 100, por fuente y búsqueda | `app/api/tools/leads/route.ts:51`, `:57-134` |
| `POST /api/tools/leads/enviar` | `tools.editar` | hasta 100 leads por id al flujo de n8n; desde el nivel 3 (en local), con el token y la subcuenta del cliente elegido | `app/api/tools/leads/enviar/route.ts:80`, `:106-109` |
| `GET /api/tools/saldo` | `tools.ver` | el monedero de la empresa, desglosado | `app/api/tools/saldo/route.ts:19-48` |
| `POST /api/tools/espia` | `tools.editar` | el análisis con IA de una búsqueda del Espía | `app/api/tools/espia/route.ts:41-47` |
| `GET`, `POST`, `DELETE /api/tools/cerebro` **(nueva)** | `tools.ver` · `cerebro.usar` | la caja del cerebro de esta pantalla | `app/api/tools/cerebro/route.ts:1-9` |
| `estado`, `generar`, `conversar`, `rellenar` | ver / editar | las gemelas de Fundaciones | [12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md) |

El proxy traduce cada fuente al cuerpo que espera su actor y pone el `org_id` de la sesión en las cinco
(`app/api/tools/scrape/route.ts:85-151`, `:90-93`; el comentario de `:90` todavía dice «las cuatro»). El Espía (`ad-spy`) es
la única fuente que no descuenta saldo, según el lado del backend que este archivo describe
(`app/api/tools/scrape/route.ts:129-137`).

### El cerebro, sobre Tools

Desde el 2026-10-05 la caja «Pregúntale al cerebro sobre …» va al pie de cada pantalla de un departamento y, en Tools,
pregunta a su propia ruta (`components/ConsultaAlCerebro.jsx:3-22`). El cerebro tiene dos herramientas de Tools
(`lib/agentes/executive/adaptadores/tools.ts:21-72`):

- `leads_del_scraper`: **sólo conteos** de los leads de la ventana, por fuente, con y sin forma de contacto; no lee la ruta
  de la pantalla, que devuelve nombres, correos y teléfonos (`lib/agentes/executive/adaptadores/tools.ts:3-6`, `:23-36`);
- `espia`: la lista de búsquedas o el análisis de una, recortado a 4.000 caracteres y **sin datos de contacto**, porque lo
  escribió un modelo sobre anuncios ajenos (`lib/agentes/executive/adaptadores/tools.ts:14`, `:56-70`).

Las dos dicen dónde vive su pestaña con la tabla de departamentos y no a mano (`lib/agentes/executive/adaptadores/tools.ts:16-19`).

### El Panel de Monitoreo

Sin cambios de código desde el corte anterior. La vista monta el panel (`components/views/MonitoreoView.jsx:20-46`). Arriba,
las tarjetas —Scrapeos, Leads guardados, Empresas que scrapean, Ingreso mensual, Costo de Apify y una por scraper que tenga
alguno— (`components/monitoreo/PanelDeMonitoreo.jsx:96-143`); abajo, una fila por empresa
(`components/monitoreo/PanelDeMonitoreo.jsx:224-233`), con «Actualizar» y «Descargar CSV»
(`components/monitoreo/PanelDeMonitoreo.jsx:202-207`), y el detalle de una empresa al hacer clic, hasta 60 trabajos y de a
100 leads (`lib/monitoreo/detalle.ts:27`, `:36`).

**Las dos rutas** piden `monitoreo.ver` y **vuelven a comprobar la organización principal** en el servidor
(`app/api/monitoreo/route.ts:113-130`, `app/api/monitoreo/[orgId]/route.ts:65-73`). La tabla sale de un bucle por empresa, de
a cuatro (`app/api/monitoreo/route.ts:95`, `:150-173`), sin las dos de la sonda
(`lib/administracion/organizaciones.ts:94`). El consumo de cada empresa son tres lecturas: trabajos por fuente con su costo,
leads y monedero (`lib/monitoreo/consumo.ts:67-112`).

**Lo que dibujaría hoy, calculado desde la base el 2026-10-18** con las cuentas del código. **No se vio en pantalla:**

| tarjeta | valor (2026-10-18) | 2026-09-28 |
|---|---|---|
| Scrapeos | **26**, 25 completados | 16, 15 completados |
| Leads guardados | **2.343** | 2.200 |
| Empresas que scrapean | **4** de 11 dadas de alta | 3 de 11 |
| Ingreso mensual | — · 11 sin precio cargado | ídem |
| Costo de Apify | **14,74 USD**, 2 corridas sin medir | 12,17 USD, 2 sin medir |
| Google Maps · Facebook Ads · Facebook Pages · Espía | **8 · 1 · 6 · 11** | 6 · 1 · 4 · 5 |

LinkedIn, en 0, no se dibuja (`components/monitoreo/PanelDeMonitoreo.jsx:136`). En la tabla, 7 de las 11 filas van en cero
y con «sin monedero», e Ingreso y Margen van «—» en las once (`lib/monitoreo/panel.ts:96-99`). El panel sigue rotulando la
fuente `ad-spy` como «Espía de Anuncios»: el cambio de nombre no la alcanzó a propósito (commit `cdb858b`).

### El Panel de Incidentes (nuevo, 2026-10-01)

Cada fallo del modelo de IA de una organización deja una fila en `negocio.incidentes`, con la misma referencia que vio la
persona y que quedó en el registro del servidor; ni el prompt ni la respuesta (`db/migraciones/067_los_incidentes.sql:1-24`,
`:27-47`). La ruta recorre las empresas de a cuatro con `conOrganizacion`, como Monitoreo, y una que no se lee va en
`ilegibles` (`app/api/incidentes/route.ts:24`, `:54-76`); pide `incidentes.ver` y ser de la principal
(`app/api/incidentes/route.ts:42-44`). La capacidad la tiene sólo el superadministrador: la familia `incidentes.%` se les
niega a mano a `usuario` y a `administrador` (`db/arranque/001_catalogo.sql:130-135`, `:425`, `:510`). La pantalla tiene
ventanas de días, «sólo los nuestros» y un color por a quién le toca
(`components/incidentes/PanelDeIncidentes.jsx:3-9`, `:15`, `:32`, `:66`).

**Medido el 2026-10-18:** 1 incidente en toda la base, del 2026-10-05, de situación `IA-PETICION` y origen `executive` (el
cerebro), sin revisar. El comentario de la columna `origen` sólo nombra `generar`, `conversar`, `rellenar` y `espia`
(`db/migraciones/067_los_incidentes.sql:34`): el único incidente real es de otro origen.

### Las pruebas

Contadas por sus `test(` el 2026-10-18 y **no re-corridas**: `pruebas/codigo/110-monitoreo.test.ts` 18,
`pruebas/codigo/165-medicion-de-los-scrapeos.test.ts` 5, `pruebas/codigo/139-saldo-de-leads.test.ts` 3,
`pruebas/codigo/126-espia-de-anuncios.test.ts` 12, `pruebas/codigo/127-anunciantes-de-facebook.test.ts` 10 (eran 11: se fue
la opción de la URL, y ahora exige que no vuelva, commit `821a915`), y la nueva `pruebas/codigo/202-tools-no-vosea.test.ts`
con 3. **Una prueba de base ya ejercita tablas del scraper con filas:** `pruebas/base/213-las-herramientas-del-cerebro.test.ts`
(6 casos) crea `aria_cc_scraper_leads`, `aria_cc_scraper_trabajos` y `aria_cc_foundations` en la base local sólo para la
prueba, con el aislamiento de `negocio`, y las quita al terminar (`pruebas/apoyo/tablas-de-public.ts:1-15`, `:52-66`). Lo
que ejercita son las herramientas del cerebro, no las rutas de Tools ni las del panel. La autorización del panel sigue
probada contra la base local (`pruebas/base/22-los-tres-roles.test.ts:304`, `pruebas/base/31-alcance.test.ts:464`).

---

## 3 · Datos que ya tenemos

Todo medido el **2026-10-18** entre las 15:34 y las 15:40 UTC; entre paréntesis, la cifra del 2026-09-28. Las tres tablas
del scraper viven en `public` y **las escribe el backend de scraping, no este proyecto**, por PostgREST
(`lib/datos/esquema.ts:1604-1606`), con RLS forzada (medido el 2026-09-28; no se volvió a medir). La cuarta, la de
mediciones, sería nuestra y sigue sin existir (§ 6).

**Los trabajos** (`public.aria_cc_scraper_trabajos`), lo que el panel cuenta como «un scrapeo» (`lib/datos/esquema.ts:1633`):

| qué | 2026-10-18 |
|---|---|
| trabajos | **26** (16) |
| por estado | `COMPLETED` 25 · `FAILED` 1 · en vuelo 0 |
| por fuente | Espía 11 (5) · Maps 8 (6) · Facebook Pages 6 (4) · Facebook Ads 1 · **LinkedIn 0** |
| desde el 2026-09-28 | 10: Espía 6, Maps 2, Pages 2 |
| el último | 2026-10-10 00:38 UTC, un Espía |
| con costo de Apify | 24 de 26; **14,74 USD**; los 2 sin costo son de Maps, uno de ellos el fallido |

**Por empresa**, en el orden de su primer scrapeo:

| | la principal | empresa A | empresa B | empresa C (nueva) |
|---|---|---|---|---|
| trabajos | **18** (9) | 4 | 3 | 1, un Espía |
| Maps · Pages · Ads · Espía | 6 · 4 · 1 · 7 | 1 · 1 · 0 · 2 | 1 · 1 · 0 · 1 | 0 · 0 · 0 · 1 |
| desde el 2026-09-28 | 9 | 0 | 0 | 1, el 2026-10-02 |
| leads guardados | **2.190** (2.047) | 100 | 53 | 0 |
| costo de Apify | 12,44 USD | 1,02 USD | 0,57 USD | 0,71 USD |
| monedero | sin límite; 1.190 descontados (1.047) | 400 disponibles, 500 regalados, 100 usados | 447 disponibles, **0 regalados**, 53 usados | 500 disponibles, **0 regalados**, 0 usados |

Las otras 7 empresas no tienen ni un trabajo ni monedero.

**Los leads** (`public.aria_cc_scraper_leads`): **2.343** (2.200); 143 desde el 2026-09-28; el último, 2026-10-07 16:10 UTC. Por
la fuente del trabajo que los trajo:

| fuente del trabajo | leads | con correo | con teléfono | sin correo ni teléfono |
|---|---|---|---|---|
| Facebook Pages | 1.117 (1.081) | 667 | 557 | 376 |
| Facebook Ads | 1.000 | 0 | 0 | **1.000** |
| Google Maps | 226 (119) | 135 | 222 | 1 |
| Espía | 0 | — | — | — |

Los 1.000 de Facebook Ads siguen siendo **un solo trabajo** del 2026-08-31, el paso que descubre anunciantes
(`lib/tools/scrapers.ts:317-318`), guardados con la misma etiqueta `facebook` que los de Pages
(`lib/monitoreo/fuentes.ts:31-34`). En la principal, lo descontado (1.190) es exactamente lo guardado menos esos 1.000; en A
y B coincide con lo guardado.

**Los monederos** (`public.aria_cc_scraper_monedero`): **4** (3), uno sin límite. Nadie tiene leads comprados.

**El Espía.** `negocio.analisis_del_espia` tiene **2** análisis, de una sola empresa, y uno de los dos quedó cortado por el
techo de tokens. `negocio.uso_de_ia` registra **2** llamadas del Espía, las dos `ok`. El Espía trae anuncios y no contactos:
ninguno entra a la tabla de leads.

**Cuánto tarda un scrapeo**: la medición que lo iba a decir no existe (§ 6). El sustituto del corte anterior —el último lead
insertado menos la creación del trabajo— daba, sobre los 10 trabajos con leads de entonces, dos de Facebook Pages por encima
de los diez minutos (1.280 y 1.525 s). Del 2026-09-28; **no se volvió a medir** con los trabajos nuevos.

**Las herramientas de IA de Tools.** El 2026-09-28 ninguna fila del almacén tenía perfil o historial de Prospección, del VSL ni
de la Landing. **No se volvió a medir.**

**Quién ve qué**, sólo conteos:

| qué | 2026-10-18 | 2026-09-28 |
|---|---|---|
| usuarios activos | 15 | 15 |
| concesiones de la pestaña `tools` | 4 | no medido |
| concesiones de la pestaña `monitoreo` | 1 | 1 |
| concesiones de la pestaña `incidentes` | 0 | — |
| ven el Panel de Monitoreo | no re-medido | 3 (`superadministrador` 2, `usuario` con la pestaña 1) |
| empresas con precio mensual cargado | **0 de 13** | 0 de 13 |

---

## 4 · Datos que faltan, y de dónde tendrían que venir

| hueco | dónde se nota | de dónde tendría que venir | hoy (2026-10-18) |
|---|---|---|---|
| **La duración de cada scrapeo** | ningún lado; era para decidir si los 10 minutos alcanzan (`lib/tools/medicion.ts:6-8`) | `public.aria_cc_scraper_mediciones`, que llena el proxy (`lib/datos/esquema.ts:1717-1725`) | **la tabla sigue sin existir** (`to_regclass` nulo), y su migración no está en el repositorio (§ 6) |
| **El ingreso y el margen por empresa** | Monitoreo, dos columnas y una tarjeta | el precio mensual, a mano en Ajustes › Empresas (`db/migraciones/024_ingreso_por_empresa.sql:11-12`, `lib/monitoreo/fuentes.ts:91-97`) | 0 de 13 |
| El costo de 2 corridas | Monitoreo, «2 corridas sin medir» | el backend, que consulta Apify y escribe `costo_usd` (`lib/datos/esquema.ts:1674-1680`) | 24 de 26 medidas; los 2 huecos son de Maps |
| El tope pedido de un trabajo | un trabajo retomado no dice cuánto se pidió (`app/api/tools/trabajos/route.ts:74-77`) | la columna `max_leads`, que el backend no escribe (`app/api/tools/trabajos/route.ts:72-78`) | se lee de `results_data`; no se volvió a contar |
| Cuántos lotes se subieron al CRM | ningún lado; el cerebro lo dice así (`lib/agentes/executive/adaptadores/tools.ts:24-27`) | un registro que la ruta de envío no deja | ver [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) |
| El costo de IA por empresa | no hay columna en Monitoreo, a propósito (`app/api/monitoreo/route.ts:23-25`) | `negocio.uso_de_ia`, que **desde el 2026-10-04 sí guarda los tokens por empresa** (`db/migraciones/069_el_uso_de_la_ia.sql:38-67`) | el dato existe; el panel no lo lee |
| Qué pantalla disparó un trabajo | la mirada al mercado, el Scraper y el Espía se ven iguales | una columna de origen en la tabla del backend | no existe |

**Lo que queda del lado del usuario:** cargar el precio mensual de las empresas que pagan; decidir si la medición de duración
sigue —aplicar la migración que crea la tabla y traerla al repositorio— o se retira; y decidir si el costo de IA por empresa,
que ya se guarda, entra al panel.

---

## 5 · Reglas propias de estas pantallas

**1 · El navegador nunca habla con el backend de scraping, y la empresa sale de la sesión.** Si el navegador lo llamara,
bastaría mandar otro identificador para gastarle los leads a otra empresa (`app/api/tools/scrape/route.ts:9-12`). El `org_id`
va en el cuerpo de las cinco fuentes y en la consulta del sondeo (`app/api/tools/scrape/route.ts:90-93`, `:192-199`).

**2 · Gastar pide editar; mirar pide ver.** Arrancar un scraping, analizar anuncios, generar y subir leads piden
`tools.editar`; sondear, listar lo que está en vuelo, el historial, las búsquedas del Espía y el saldo piden `tools.ver`
(`app/api/tools/scrape/route.ts:178-183`, `:220-228`, `app/api/tools/leads/route.ts:53-58`,
`app/api/tools/busquedas-del-espia/route.ts:21`).

**3 · Lo que dice el backend viaja tal cual.** Su 403 por saldo agotado y su 404 pasan a la pantalla: «se te acabaron los
leads» es lo único accionable (`app/api/tools/scrape/route.ts:34-39`). Sin URL del backend no hay valor de reserva
(`app/api/tools/scrape/route.ts:67-75`).

**4 · Lo que está en vuelo se le pregunta a la base** (`app/api/tools/trabajos/route.ts:17-31`). Y lo terminado también:
desde el 2026-10-03 el Espía reabre sus búsquedas desde la base, no desde la memoria del componente
(`lib/tools/historial-del-espia.ts:6-13`).

**5 · Las tablas del scraper se leen dentro de `conOrganizacion(` y sin `where` de empresa.** La RLS es la protección
(`app/api/tools/saldo/route.ts:4-6`, `lib/monitoreo/consumo.ts:107-110`, `app/api/tools/leads/route.ts:22-25`); el historial
del Espía, igual (`lib/tools/historial-del-espia.ts:15`).

**6 · Este proyecto no escribe en las tablas del backend.** Declara sólo las columnas que lee
(`lib/datos/esquema.ts:1638-1641`). Las tablas nuestras de Tools son la de mediciones, que no existe
(`lib/datos/esquema.ts:1717-1725`), y desde el 2026-10-03 `negocio.analisis_del_espia`, que no lleva clave foránea al
trabajo porque esa tabla vive en `public` y la escribe el backend (`db/migraciones/068_el_analisis_del_espia.sql:11-13`).

**7 · Medir no puede romper un scrapeo, y guardar no puede perder un análisis.** Las funciones de medición no lanzan nunca y
van en su propia transacción (`lib/tools/medicion.ts:26-30`); el fin se anota una sola vez (`lib/tools/medicion.ts:82-84`).
Si guardar el análisis del Espía falla, se entrega igual: ya se pagó (commit `6ef4183`).

**8 · El Panel de Monitoreo tiene tres mitades.** La capacidad `monitoreo.ver`, que `usuario` recibe por derivación; la
pestaña concedida, porque `usuario` restringe por sección; y ser de la organización principal
(`lib/autorizacion/secciones.ts:438-448`, `db/arranque/001_catalogo.sql:399-419`). La tercera se mide sobre la organización
**propia**, no la que se está mirando (`lib/autorizacion/secciones.ts:112-119`). El formulario de Usuarios no ofrece la casilla
fuera de la principal (`components/ajustes/Usuarios.jsx:145`). `administrador` no tiene la capacidad
(`db/arranque/001_catalogo.sql:487-512`), y el catálogo aborta si `usuario` pierde la capacidad o deja de restringirse
(`db/arranque/001_catalogo.sql:775-810`). **El de Incidentes es más simple:** la capacidad es sólo del superadministrador
(`db/arranque/001_catalogo.sql:130-135`), así que conceder la pestaña a un `usuario` no le da el panel.

**9 · Los paneles cruzan empresas con un bucle, no con una consulta.** Un `group by org_id` bajo RLS devuelve una fila
(`lib/monitoreo/consumo.ts:6-35`). De a cuatro (`app/api/monitoreo/route.ts:83-95`); Incidentes copia la forma
(`app/api/incidentes/route.ts:24`, `:58-66`).

**10 · Un cero que no es cero no se dibuja como cero** (`lib/monitoreo/fuentes.ts:98-107`,
`components/monitoreo/PanelDeMonitoreo.jsx:148-154`, `lib/monitoreo/panel.ts:96-99`, `lib/monitoreo/panel.ts:104-111`).

**11 · Un scrapeo fallido también cuenta** (`lib/monitoreo/fuentes.ts:52-56`).

**12 · Mis Leads y el detalle del panel no se reúsan** (`components/monitoreo/PanelDeMonitoreo.jsx:18-23`).

**13 · Al CRM se mandan identificadores, no leads** (`app/api/tools/leads/enviar/route.ts:7-19`, `:161-169`). Desde el
nivel 3 (C6 · D2, en local, sin subir), a un cliente que se elige: el pedido dice `cuentaId`, que tiene que ser un
cliente ACTIVO de la empresa, y sin él va al principal; el token y la subcuenta son los de ese cliente
(`app/api/tools/leads/enviar/route.ts:94`, `:153`). La pantalla muestra el selector sólo con más de un cliente activo
(`components/tools/MisLeads.jsx:400`), y con uno solo el pedido y la respuesta son los de siempre.

**14 · Lo que viaja al cerebro es conteo o texto limpio.** Los leads, contados; el análisis del Espía, recortado y sin datos de
contacto (`lib/agentes/executive/adaptadores/tools.ts:3-6`).

**15 · Tools habla con tú** (prueba `202`, commit `5d60371`).

---

## 6 · Riesgos

**La medición de duración no mide, y nada lo dice en voz alta.** `public.aria_cc_scraper_mediciones` sigue sin existir en
producción (`to_regclass`, medido el 2026-10-18). Los comentarios la atribuyen a «la migración 020 de `/migraciones`»
(`lib/datos/esquema.ts:1719`, `lib/tools/medicion.ts:19`), carpeta que no está en el repositorio; y la `020` que sí está es
otra cosa, `db/migraciones/020_closer_asignado.sql`. Tampoco está `migraciones/006_aria_cc_scraper.sql`, que citan varios
comentarios (`lib/datos/esquema.ts:1614`, `app/api/tools/scrape/route.ts:19`, `components/tools/MisLeads.jsx:12-14`). Desde el
commit que la introdujo corrieron **13 trabajos sin quedar medidos** (3 el 2026-09-23 y los 10 posteriores al 2026-09-28),
porque el código sigue igual cuando la tabla falta (`lib/tools/medicion.ts:32-33`). La prueba 165 sólo comprueba que esté
declarada (`pruebas/codigo/165-medicion-de-los-scrapeos.test.ts:101-103`).

**El Research da por caído un trabajo que sigue corriendo.** Espera 120 intentos de cinco segundos
(`components/fundaciones/PanelResearch.jsx:281-284`), y el sustituto del 2026-09-28 tenía dos Pages de más de diez minutos. Si
alguna mirada al mercado pasó de los diez minutos: no verificado.

**La franja le diría «53 comprados» a una empresa que no compró nada, y ya son dos monederos con la misma forma.** `desglosarSaldo`
toma como regalo el mayor entre `leads_regalados` y lo que queda gratis (`lib/tools/saldo.ts:51`), y lo usado que no cabe en
el regalo pasa a «comprado» (`lib/tools/saldo.ts:53-55`). La empresa B tiene `leads_regalados = 0` con 447 gratuitos y 53
usados: la franja diría 53 comprados. **La empresa C, cuyo monedero se abrió después del corte anterior, también tiene
`leads_regalados = 0`** (con 500 gratuitos y 0 usados): hoy no se nota, y se va a notar con su primer lead. O sea que el
backend sigue sin escribir esa columna al abrir un monedero, contra lo que dice `lib/datos/esquema.ts:1709-1711`. La prueba
cubre el monedero sin regalo sólo con cero usados (`pruebas/codigo/139-saldo-de-leads.test.ts:48-49`).

**El servidor no acota cuántos anuncios pide el Espía.** La ruta manda `Number(p.count) || 60`
(`app/api/tools/scrape/route.ts:145`) y la pantalla ofrece 60 o 1.000 (`components/tools/anuncios.jsx:29-32`); un cuerpo armado
a mano puede pedir cualquier número, y el Espía es justo la fuente que no descuenta saldo
(`app/api/tools/scrape/route.ts:129-137`). Lo que Apify cobre por eso va a la factura y al costo del panel, no al monedero.
No es nuevo (la línea es la misma del 2026-09-28): lo nuevo es que el 1.000 está en la pantalla.

**Comentarios que siguen describiendo el rol `monitoreo`, retirado el 2026-09-01.** El retiro está en
`db/arranque/003_retiro_de_roles.sql:52-62`, y siguen diciendo lo contrario `app/api/monitoreo/route.ts:30-35` y `:39-40`,
`db/arranque/001_catalogo.sql:106-118` (contra el mismo archivo en `:399-419`), `lib/autorizacion/secciones.ts:102-105` (contra
`:438-446`), y la prueba 110 en su encabezado (`pruebas/codigo/110-monitoreo.test.ts:10-12`), dos mensajes de falla (`:57`,
`:163-165`) y el nombre de la prueba de `:346`, mientras su cuerpo afirma que `usuario` sí la tiene (`:377-382`). En la misma
familia: `lib/tools/scrapers.ts:16-19` y `:7-9` describen el hub y `usuarios_scraper`; `components/monitoreo/PanelDeMonitoreo.jsx:11-12`
dice que `app/monitoreo.css` son ochenta líneas, y son 201. **Nuevos desde el corte, cerrados el 2026-10-18 (`65669f4`):**
`lib/autorizacion/secciones.ts:438` decía que Monitoreo es «la única sección con `soloDesdeLaPrincipal`» y ya son tres; el
comentario de Incidentes decía que va en «Operación» (`lib/autorizacion/secciones.ts:467-470`) y va en «Administración»
(`:473`). Hoy los dos dicen lo que hace el código. Los del rol `monitoreo` de arriba no se tocaron y siguen abiertos.

**«Leads guardados» cuenta 1.377 filas sin forma de contactar a nadie.** De los 2.343, 1.000 son anunciantes de un único
trabajo de Facebook Ads y 377 más no traen ni correo ni teléfono (376 de Pages y 1 de Maps). Mis Leads, la tarjeta del panel
y la columna por empresa los suman igual que un contacto de Maps. El cerebro sí los separa (`sinContacto`,
`lib/agentes/executive/adaptadores/tools.ts:34`).

**El panel mide plata con una sola de sus tres columnas**: sin precio en ninguna empresa, el único número de plata es el costo
de Apify, y ahora el costo de IA por empresa existe en `negocio.uso_de_ia` y el panel no lo lee.

**Ninguna tabla del scraper nace de una migración de este repositorio.** La suite las crea sólo para la prueba 213, con las
columnas que este proyecto declara (`pruebas/apoyo/tablas-de-public.ts:1-15`): si el backend cambia una columna, esa prueba
sigue verde. Las rutas de Tools y del panel siguen sin probarse contra una tabla. Y `app_inquilino` tenía `INSERT`, `UPDATE` y
`DELETE` sobre las tres (medido el 2026-09-28; no se volvió a medir).

**Los dos paneles consultan todas las empresas al entrar a la aplicación, no al abrir la pestaña.** Todas las vistas visibles
se montan juntas (`components/CommandCenter.jsx:103-115`) y los dos paneles cargan al montarse
(`components/monitoreo/PanelDeMonitoreo.jsx:68-70`, `components/incidentes/PanelDeIncidentes.jsx:53-55`): son 11
transacciones por panel en cada entrada de quien los ve, y crece con cada empresa. La franja del saldo ya no tiene ese
problema desde E11: se monta en cada visita a Prospección o al Scraper (`components/views/ToolsView.jsx:106-111`).

**El botón de subir al CRM se ofrece a quien no puede usarlo.** Mis Leads se monta sin `puedeEditar`
(`components/views/ToolsView.jsx:81`) y dibuja el envío siempre (`components/tools/MisLeads.jsx:426-435`); la ruta pide
`tools.editar` (`app/api/tools/leads/enviar/route.ts:109`). El Espía y el Scraper sí reciben la bandera
(`components/views/ToolsView.jsx:73`, `:79`), y los dos la heredan falsa también cuando falló la lectura del estado de Tools:
el aviso culpa al rol (`components/tools/VistaDelScraper.jsx:18-21`). Con el nivel 3 (en local), con más de un cliente
activo, también le muestra el selector de cliente.

**Dos personas de empresas cliente tenían `monitoreo.ver`** (medido el 2026-09-28, no re-medido). Las separan del panel la
pestaña no concedida —sigue habiendo 1 sola concesión, medida el 2026-10-18— y `soloDesdeLaPrincipal`.

**Y el que ordena a los demás: el uso sigue siendo chico.** 26 scrapeos en siete semanas, ninguno desde el 2026-10-10,
LinkedIn nunca, 2 análisis del Espía guardados y un incidente. Las reglas de § 5 están escritas y probadas por texto, pero con
estos volúmenes casi nada de Tools ni de los paneles se ejerció lo suficiente para mostrar sus fallas, y ninguna cifra de § 2
se vio dibujada por la aplicación andando.
