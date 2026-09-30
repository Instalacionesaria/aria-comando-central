# Acquisition Intelligence
> Corte: **2026-09-28**, medido contra producción entre las 18:05 y las 18:40 UTC con
> `node --env-file=.env.supabase scripts/supabase.mjs leer`. Cada afirmación lleva su archivo:línea
> o la consulta que la produjo. Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

**Construido desde el 2026-09-16 — mide gasto real, y lo que mide hoy es una pauta apagada.**

La maqueta de 302 líneas se borró el 2026-09-16 y la pestaña publica dos cifras reales: lo que costó
cada anuncio, leído de Meta **a través del Ad Manager de GoHighLevel y sin conectar Meta**, y el
monitor de atribución del § 18.14. Hay **3.511,28 de gasto guardado desde el 2026-08-18**, en 63
de los 79 anuncios que conoce, pero el último día con gasto es el **2026-09-13** y el último
contacto que trae anuncio entró ese mismo día a las 05:13 UTC. En la ventana por omisión la
pantalla dice «Del 30 ago al 28 sep» sobre 1.974,93 que se gastaron en quince días, y nada en ella
lo advierte (medido el 2026-09-28). De los 25 KPI del § 18.7 dibuja ocho; Creative publica otros
tres con la misma tabla, y aproxima dos más con el hook rate y la caída del CTR (§ 2). Lo que queda
roto es de cuatro clases: **«Hoy» significa dos ventanas distintas en la misma pantalla**, el
monitor acusa como faltante una UTM que llega con otro nombre (`campaign`, 250 de 264 sesiones), la
nota «Entregó N días» cuenta días sin una sola impresión, y Executive sigue publicando en nombre del
departamento una inversión de 8.525 para siete días sin entrega: lo medido es «sin dato», no «$0».

> **Desde el corte del 2026-09-15**
>
> - **Dejó de ser maqueta** (`be5ba97`, 2026-09-16). Se borraron `lib/aios/acquisition.js` (302
>   líneas, 58 literales) y `lib/aios/acquisition-plan.js` (33); entraron la ruta, el panel y el
>   cliente de lectura, y la sección perdió `sinOperacionesTodavia` (§ 2).
> - **El gasto llegó sin conectar Meta** (`3d96e8c`, 2026-09-16). La foto anterior cerraba con
>   «conectar Meta es trabajo de integración (app de Meta, token de larga duración, revisión de
>   app, un recolector diario) y no de diseño de datos». **Era falso**: GoHighLevel expone el Ad
>   Manager y el token del CRM lo alcanza (`lib/ghl/anuncios.ts:4-25`). Entraron las migraciones
>   050 y 051 y el colector diario `lib/negocio/recolectarAnuncios.ts`.
> - **Las dos cifras** (`7f6235c`, 2026-09-16): `costoDelAnuncio` y `calidadDeLaAtribucion`. El
>   relleno inicial hizo 390 llamadas y guardó 2.360 filas de 79 anuncios: 3.511,28 en 30 días.
> - **Una revisión adversarial** (`be7ef03` y `c1093f4`, 2026-09-18) encontró 54 defectos: el
>   colector estaba atascado en producción, el CPL dividía 31 días de gasto entre 30 de leads —de
>   ahí la ventana anclada al día— y faltaba el índice `(org_id, alta_en_el_crm)` (migración 052).
> - **La carpeta de requisitos** (`df0d1c1`, `8102ad4`, `c8494e6`, 2026-09-16): nacen los catorce
>   documentos de `docs/acquisition/`; se corrige que el ad set «llega sólo como nombre» (llega como
>   `utmTerm`) y que `mediumId` fuera el ad set (es el formulario o el calendario).
> - **El desglose de acciones** (`7660d2a`, `741f27d`, 2026-09-19; migración 053): hook rate, link
>   CTR y vistas de la landing llegaban desde el primer día. **Los publica Creative, no esta
>   pantalla.**
> - **Afuera**: el hallazgo que Conversion le mandaba se fue con `0add4cc` (2026-09-20) y la frase
>   del Plan de acción de Leads Portal con `aed4f27` (2026-09-26). Executive no cambió (§ 3).
> - **Y el dato cambió solo**: desde el 2026-09-14 la pauta no gasta y no entra ningún lead pago
>   (§ 4). No es un cambio del código; la base no dice si fue una pausa deliberada.

---

## 1 · Qué pide el documento

El § 18 vive fuera del repositorio, en `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`
(1.650 líneas; el § 18 va de la 1.124 a la 1.650, comprobado el 2026-09-28). La ruta que daba la
foto anterior, `Downloads\AIOS\AIOS_Arquitectura_Funcional_v0.2.md`, ya no existe. La carpeta
`docs/acquisition/` lo resume con detalle y acá sólo va lo que la foto necesita:

- **Misión y límite (§ 18.1, § 18.8, § 18.10).** Explica qué pasa dentro de Meta; no decide qué
  anuncio genera más dinero, porque eso cruza ICP, agendas, ventas y revenue. Nueve «no es
  responsable de» y nueve acciones que requieren validación ejecutiva
  (`docs/acquisition/12-QUIEN-DECIDE-QUE.md:10`, `:69`).
- **Seis componentes (§ 18.3)**: Meta Data Collector, tres analizadores (campaña, creativo,
  audiencia), Anomaly & Fatigue Detector y Attribution Monitor
  (`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:9`).
- **Datos de Meta (§ 18.4)** en dos listas —dimensiones y métricas diarias—, guardados «por fecha
  para permitir comparaciones históricas» (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:65`).
- **La regla que hace honesto al departamento (§ 18.5)**: puede informar sobre Meta con la
  atribución incompleta, pero no presentar como definitivas conclusiones sobre citas, ventas o
  revenue. Y no recalcula revenue, CAC ni ROAS (§ 18.6).
- **25 KPI en cinco grupos (§ 18.7)** (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:140-166`).
- **La alerta de catorce campos (§ 18.13)** y **los siete puntos del Attribution Monitor
  (§ 18.14)** (`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:148`, `:182`).
- **Tres vistas por rol (§ 18.15)** y el reporte para Executive (§ 18.17), cuyo ejemplo dice «91 %
  de leads con meta_ad_id válido».
- **Diez pendientes técnicos (§ 18.19)** (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:189-202`).
  Contra el código de hoy: el 1 (confirmar campos) está medido uno por uno en
  `lib/ghl/anuncios.ts:62-74`; el 2 (frecuencia) es una pasada diaria a las 06:17 UTC con relectura
  de dos días (`lib/negocio/barrido.ts:242-246`, `lib/negocio/recolectarAnuncios.ts:59`); el 3
  (guardar por día) es `negocio.metricas_de_anuncio`, con llave `(org_id, meta_anuncio_id, fecha)`
  (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:230-232`); el 5 (UTM) lo mide el monitor, con
  el defecto del § 7, riesgo 3; el 6 y el 7 están medidos en la pantalla, salvo las ventas, que no
  existen; el 4 tiene los dos toques pero no su historia; el 8, el 9 y el 10 no tienen nada
  construido —el 10 porque no quedó ninguna recomendación que separar—.

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:241-249`: clave `acquisition`, capacidad
`tablero.ver`, grupo «Inteligencia», y ya sin `sinOperacionesTodavia` —la bandera se fue en el mismo
commit que la ruta, porque `ADR-0304` la verifica en las dos direcciones (`:245-247`)—.

**La ruta.** `app/api/acquisition/route.ts`, 64 líneas. Llama al portero con `tablero.ver` (`:42`),
valida el período contra la lista cerrada y **rechaza** lo que no está (`:48-49`), y hace **una sola
lectura** con las dos cifras dentro de `conOrganizacion` (`:51-54`): el comentario explica que la
tabla dibujada antes que su cobertura mostraría durante unos segundos la afirmación que el § 18.5
prohíbe (`:17-22`). Devuelve la clave del período que contestó (`:56-63`).

**La vista y el cliente.** `components/views/AcquisitionView.jsx` (59 líneas) sólo pone el
encabezado y monta el panel; la bajada cambió a «Qué costó cada anuncio, y cuánto vale esa cifra»
(`:49`) porque la vieja —«y cuáles sirven»— era la conclusión que el § 18.1 prohíbe (`:46-48`). Lo
que se quitó y no debe volver está escrito en `:19-29`. `lib/negocio/vistaDeAcquisition.ts:41-53`
pide y no calcula nada.

**El panel.** `components/acquisition/PanelDeAcquisition.jsx`, 410 líneas, tres bloques en este
orden (`Cuerpo`, `:205-216`):

1. **«Lo que costó la pauta»** (`Gasto`, `:219-259`): la ventana GUARDADA —«Del X al Y, que es lo
   que hay guardado»— (`:234-238`), el gasto total con su denominador «en N anuncios de M»
   (`:248-254`) y el aviso del costo, siempre a la vista (`:256`).
2. **«Cuánto vale lo que dice esta pantalla»** (`Atribucion`, `:272-324`): cinco barras, cada una
   sobre su propia población y con «cuantos de sobre» al pie (`:303-305`); la de UTM marcada
   «menos es mejor» (`:292-296`); el aviso grave (`:309`); y los dos puntos del § 18.14 que esta vía
   no puede medir, dibujados con su motivo (`:315-321`). Va **antes** de la tabla (`:209-212`).
3. **«Por anuncio»** (`Tabla`, `:340-410`): siete columnas —Anuncio, Gasto, CPM, CTR, Leads, CPL,
   Agenda— (`:363-371`), ordenadas por gasto con la frase «Ése no es el orden del negocio»
   (`:354-358`); doce filas a la vista y el resto detrás de un botón que dice cuántas faltan (`:51`,
   `:403-407`); la tasa de agenda con su denominador al lado (`:395-398`).

**Ventanas y pisos.** Cuatro botones de `lib/negocio/periodo.ts:83-96`, 30 días por omisión
(`:109`). El reloj recarga sólo con la pestaña a la vista (`PanelDeAcquisition.jsx:87-89`). El
costo usa **días de calendario terminando hoy** (`lib/negocio/costoDelAnuncio.ts:34-65`: el gasto
por `:82-84`, y los leads y la cobertura con su propia copia, `:346` y `:368`); el monitor usa
**ventanas móviles de 24 horas** (`lib/negocio/calidadDeLaAtribucion.ts:116`, `:130`, `:142`) —ver
§ 7, riesgo 2—. El piso es `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`): la
tasa de agenda es nula por debajo (`costoDelAnuncio.ts:213`) y también las proporciones del monitor
(`calidadDeLaAtribucion.ts:246`); el CPL se publica con un solo lead, a propósito
(`costoDelAnuncio.ts:139-148`). El umbral que declara una cobertura incompleta es
`COBERTURA_SUFICIENTE = 0.9`, **elegido sin medir contra nada** y así dicho
(`calidadDeLaAtribucion.ts:73-80`).

**Lo que dibuja hoy, a 30 días.** Reconstruido con SQL equivalente a las cuatro consultas de
`costoDelAnuncio` y las tres de `calidadDeLaAtribucion`, el 2026-09-28 entre las 18:05 y las 18:25
UTC; la ventana del monitor es móvil y corre con la hora. **Nadie abrió la pantalla con sesión
para este corte** (no se levantan servidores en este trabajo), así que esto es lo que el código
produce sobre esos datos, no lo que se vio:

- **Encabezado**: «Del 30 ago al 28 sep, que es lo que hay guardado» y **1.974,93 en 26 anuncios de
  79**. Aviso grave, el de cobertura: «77 de 276 contactos de esta ventana no traen anuncio…»
  (`costoDelAnuncio.ts:479-490`).
- **Monitor** (a esa hora): contactos que conservan el anuncio **71,8 % · 199 de 277**; citas
  **39 % · 82 de 210**; ventas **— · 0 de 0**; contactos que conservan la campaña **90,6 % · 251 de
  277** (sin consecuencia, pasa el 0,9); sesiones con UTM incompletas **100 % · 264 de 264**. El
  aviso grave elegido es el de UTM: «`utmCampaign` no llega en NINGUNA de las 264 sesiones»
  (`calidadDeLaAtribucion.ts:224-236`, `:284-298`).
- **Tabla**: 79 filas, 26 con gasto, **4 con tasa de agenda** (leads ≥ 10). Las cinco primeras, sin
  nombre: 564,22 de gasto · CPM 6,94 · CTR 2,36 % · 109 leads · CPL 5,18 · 44 % (48/109); 554,05 ·
  0 leads; 313,70 · 44 leads · CPL 7,13 · 45,5 %; 167,97 · 0 leads; 162,38 · 17 leads · CPL 9,55 ·
  35,3 %. **Tres de esas cinco son idénticas a las que `7f6235c` publicó el 2026-09-16**: después
  del 13 no se gastó nada más. Las otras dos eran 564,26 y 200,03 y bajan porque la ventana arranca
  el 30 de agosto; la primera de entonces (744,58) gastó todo antes. 13 anuncios gastaron sin leads, y
  ese aviso no sale: va antes el de cobertura, y sale uno solo (`costoDelAnuncio.ts:421-425`, `:492-496`).
- **«Hoy» y «7 días»**: 79 filas con 0 leads y todo lo demás en guion; encabezado «—» en 0 anuncios
  de 79; **ningún aviso de costo** (la cobertura tiene 1 y 3 contactos, bajo el piso) y el monitor con
  todas sus proporciones nulas.
- **«Completo»**: 3.511,28 en 63 anuncios de 79, desde el 18 de agosto; cobertura **213 de 570**:
  24 de los 594 contactos no tienen `alta_en_el_crm` y no entran en ninguna ventana.

**KPI del § 18.7 que esta pantalla publica: ocho de veinticinco** —spend, CPM, CTR, leads, CPL,
leads por anuncio (la misma columna), citas atribuidas por anuncio (la columna Agenda cuenta
contactos que agendaron, no citas) y porcentaje de contactos con `meta_ad_id`—. El CPC se calcula y
no se dibuja; las impresiones se suman y no se dibujan. Creative publica con la misma tabla link CTR,
landing page view rate, click-to-landing, la caída del CTR (`fatigaDelCreativo.ts:1`) y un hook rate
que no se sabe si es el de tres segundos (`lib/negocio/rendimientoDelCreativo.ts:243-248`, `:599-602`).

**Pruebas.** `pruebas/base/99-costo-del-anuncio.test.ts` (13 casos, con base),
`pruebas/base/99-anuncios.test.ts` (10), `pruebas/codigo/99-anuncios.test.ts` (22),
`pruebas/codigo/98-cliente-de-anuncios.test.ts` (18) y `pruebas/codigo/100-lead-no-es-una-tasa.test.ts`
(2), contados con `grep` el 2026-09-28. **No se corrieron para este corte**: la suite usa una sola
base local y otros trabajos corren en paralelo. `calidadDeLaAtribucion` no tiene archivo propio: la
ejercitan cuatro de los trece casos de `pruebas/base/99-costo-del-anuncio.test.ts:318-440`.

---

## 3 · Lo que era maqueta y qué la reemplazó

La foto del 2026-09-15 contaba doce juegos de datos inventados. Los números de la primera columna
son los de su § 3, para que las referencias desde `docs/acquisition/` sigan encontrando el tema.

Todo lo borrado se fue en `be5ba97` (2026-09-16), salvo donde se dice otro commit.

| § vieja | Qué era | Qué hay en su lugar |
|---|---|---|
| 3.1 | `FUNNELS`, tres embudos | nada; las puertas de entrada reales están medidas en § 4 |
| 3.2 | `CAMPS`, siete campañas, 58 literales | la tabla por anuncio, con gasto de Meta |
| 3.3 | `PERIODS`, multiplicadores fijos | cuatro períodos cerrados, **sin comparación** |
| 3.4 | `seedMod()`, un hash de la fecha | nada, y no hace falta |
| 3.5 | afinidad ICP en tres tramos | ICP por pieza, en Creative (`lib/negocio/calidadDelCreativo.ts:1`) |
| 3.6 | el tope `Math.min(.94, v)` | `PISO_DE_UNA_TASA`: nulo bajo 10, sin techo |
| 3.7 | dos «Señales» en el JSX | nada (`components/views/AcquisitionView.jsx:28-29`; § 5.4) |
| 3.8 | modal «Plan de acción» | nada (`components/views/AcquisitionView.jsx:21-23`) |
| 3.9 | rango de julio por defecto | 30 días (`components/views/AcquisitionView.jsx:24-26`) |
| 3.10 | ficha de Executive, «312 contactos» | **sigue igual** (abajo) |
| 3.11 | conflicto «a $19» | **sigue**, corrido a otras líneas (abajo) |
| 3.12 | hallazgo de Conversion, chat, Leads Portal | se fueron dos de los tres (abajo) |

**Lo que Executive y el chat todavía inventan EN NOMBRE de Acquisition**, contra lo medido el
2026-09-28:

- **La ficha del departamento** (`lib/aios/executive.js:178-181`): estado `warn`, «312 contactos ·
  +9% vs semana pasada», y un hallazgo sobre una campaña «Prospecting B» que no existe. Medido: 3
  contactos con `alta_en_el_crm` en los últimos 7 días, ninguno con anuncio.
- **La inversión y todo lo que cuelga de ella** (`lib/aios/executive.js:16-20`, la tarjeta en
  `:114-116`, el costo por venta en `:124-126`, el margen sobre ads en `:96`): 8.525 a 7 días y
  34.100 al mes. Medido: **sin dato a 7 días, no 0** (del 22 al 28, 553 filas con gasto nulo) y
  1.974,93 a 30. ROAS y costo por venta: cálculos que el § 18.6 le quita, y no hay ventas que dividir.
- **El paso «Contactos» del embudo ejecutivo** declara dueño a Acquisition (`lib/aios/executive.js:23`),
  y Leads Portal «le entrega» qué campañas traen el ICP que cierra (`:201`).
- **El conflicto «Acquisition y Conversion se contradicen»** (`lib/aios/executive-panel.js:17-21`):
  «el contacto más barato del mes, a $19». La foto anterior lo citaba en las líneas 12-15; el bloque
  se corrió. El CPL real más bajo con al menos 10 leads, a 30 días, es 3,25 (13 leads).
- **Las tres preguntas del chat** (`lib/aios/executive-chat.js:19`): «¿Qué campaña escalo?» es
  justo lo que el § 18.10 no deja decidir solo.
- **La tarjeta del mapa ejecutivo** (`components/views/ExecutiveView.jsx:236-248`): «Campañas y
  tráfico · 2 a revisar», con el punto ámbar. El «2» está escrito en el marcado.
- **Lo que se fue.** El hallazgo de Conversion con `loss:48` desapareció con `lib/aios/conversion.js`
  (`0add4cc`, 2026-09-20). La frase 4 del Plan de acción de Leads Portal —«qué campañas traen ICP
  alto se decide en Acquisition»—, que la foto anterior citaba en la línea 56 de
  `lib/aios/period-controls.js`, salió con `aed4f27` el 2026-09-26: hoy sólo vive en el prototipo
  `aios-command-center_1.html` (su línea 5726), y la salida está anotada en
  `lib/aios/period-controls.js:41-45`.

---

## 4 · Datos que ya tenemos, re-medidos el 2026-09-28

Una sola organización tiene contactos y métricas (`count(distinct org_id)` = 1 en `negocio.contactos`
y en `negocio.metricas_de_anuncio`). La lectura va como `postgres`, que salta la política de fila,
así que los conteos son totales y no recortes.

**La serie de Meta, que la foto anterior daba por inexistente.** `negocio.metricas_de_anuncio` tiene
**3.318 filas de 79 anuncios en 42 fechas, del 2026-08-18 al 2026-09-28**: una fila por anuncio y
por día aunque no haya entregado. Con `gasto` no nulo, 304 (263 mayores que cero y 41 en 0,00); con
impresiones, alcance y frecuencia, 266; con el desglose de acciones, 275 (`videoView` 224,
`linkClick` 171, `landingPageView` 151). La foto del 2026-09-15 no halló **ninguna columna con datos
de Meta poblada** en `negocio`, `public` ni `identidad`; dejó de serlo el 2026-09-16. Siguen en cero,
como entonces, `public.closer_meta_metricas` y `public.closer_org_config`, de la plataforma anterior.

**El gasto, día por día.** Total guardado **3.511,28**, idéntico al que `7f6235c` midió el
2026-09-16. Del 8 al 12 de septiembre la pauta gastaba entre 100,59 y 163,85 por día; el 13, 15,09.
Después del 13 hay 1.185 filas y **ninguna con gasto ni impresiones mayores que cero**, pero no son
«0,00»: **13 tienen `gasto = 0`** (7 anuncios, 2 a 4 por día, todas del 14 al 17, con impresiones
nulas) y **1.172 tienen `gasto` nulo** —el proveedor omitió la clave: «no entregó», no «costó
cero» (regla 2 del § 6 y [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 3)—; **desde
el 18, las 869 filas son nulas**. Último día con gasto mayor que cero: 2026-09-13 (medido el
2026-09-28 sobre `negocio.metricas_de_anuncio`, todas las organizaciones).

**La dimensión.** `negocio.anuncios`: 79 anuncios, **32 nombres distintos** (21 nombres repetidos,
hasta seis anuncios con el mismo), 12 campañas. `meta_conjunto_id` está en **59 de 79**, con 11
valores; el 2026-09-18 estaba en 2 de 79 (`be7ef03`: 77 de 79, vacío) y desde entonces el
`coalesce` de `lib/negocio/recolectarAnuncios.ts:402` conserva lo que llega. **Ninguna línea del
sistema lee esa columna**: `grep` en `lib/`, `app/` y `components/` sólo da su escritura y su tipo.

**El colector.** La tarea `anuncios` selló el 2026-09-28 a las 06:20 UTC `corrio`, **40 llamadas**,
motivo «3 par(es) (campaña, día) sin datos» (el texto sale de `lib/negocio/barrido.ts:789`); las otras
diez organizaciones, `saltada · sin_token`. La última lectura de una fila es de las 06:20:13. Que los
tres pares sean los tres días de `888888`, el valor de prueba que devuelve HTTP 500
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:32-35`), es lo esperable, **no verificado**: el
motivo no nombra la campaña. Pide 13 campañas, las que aparecen en nuestra atribución
(`recolectarAnuncios.ts:261-320`); 1 contacto lleva `888888`.

**Los contactos.** 594 en total (584 el 2026-09-15). Con `adId`, **213**; con `campaignId`, **358**;
15 anuncios distintos: **las tres cifras son las mismas que midió `3d96e8c` el 2026-09-16**. Por
semana de `alta_en_el_crm`: 175 (desde el 31 ago, 133 con anuncio), 89 (desde el 7 sep, 66), **4, 3
y 1** en las tres semanas siguientes, **ninguno con anuncio ni con campaña ni `Paid Social`**. El
último contacto con `adId` o `campaignId` entró el **2026-09-13 a las 05:13 UTC**. La ingesta sí
anda: `max(creado_el)` es del 28 a las 13:50 UTC y 569 de 594 contactos se tocaron en la hora previa
a las 18:05 UTC. Meta y el CRM coinciden: no hay pauta en las 13 campañas que se piden (§ 5.10).

**La cobertura por puerta, sobre los 358 con campaña**: `facebook`/`instagram` **213 de 213** con
`adId`, `External Form` **0 de 98**, `calendar` **0 de 47**. Idéntica a la de `3d96e8c`. Sobre todos
los contactos, 4 de los 217 de `facebook`/`instagram` no traen `adId` (tampoco campaña).

**La ventana de 30 días** (desde el 30 de agosto): 276 contactos por día de calendario, 277 por 24
horas móviles; 199 con `adId` en las dos, y con campaña 250 y 251. Citas con `inicio_el` en 30 días
móviles: 210, 82 con anuncio. `negocio.resultados`: **7 filas y 0 ventas**, igual que el 2026-09-15.

**La cohorte que usaba la foto anterior** (alta del 1 al 13 de septiembre) tiene hoy **237
contactos, 178 con `adId` y 220 con campaña**; el 2026-09-15 eran 233, 176 y 217. La diferencia es
latencia de ingesta: contactos de esos días que el barrido trajo después.

**El ad set.** `utmTerm` está en **274 de 594** contactos con 10 valores numéricos distintos (y uno
que no lo es); en la ventana de 30 días, en **51 de 276 con 3 valores**. La foto del 2026-09-15
decía «39 de 233 y un solo ad set» sobre su ventana de 14 días: la cobertura sigue siendo baja y ya
no es un único valor. 6 de los 10 cruzan con un `meta_conjunto_id` de la dimensión.

**Primer y último toque.** `atribucion_ultima` trae `adId` en 87 de 594; un solo contacto cambió de
anuncio entre los dos toques. Para Acquisition manda `atribucion_primera`, y es la que leen
`costoDelAnuncio.ts:331` y `calidadDeLaAtribucion.ts:96`.

**Del 2026-09-15, no re-medidos**: los campos del CRM resueltos por nombre («Puntaje | ICP» 229 de
233, «Last Landing URL» 99, siete campos del catálogo en cero, cuatro de ellos de video) y las once
landings. Esta pantalla ya no los consume; el ICP por pieza lo lee Creative.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

La numeración 1 a 6 es la de la foto anterior, con el estado de hoy.

**1 · De Meta, lo que GoHighLevel no pasa.** Cuartiles de video, tiempo medio visto, retención de
seis segundos, placement, desgloses demográficos, el activo creativo y `meta_creative_id`: `fields`
es un enum cerrado de once valores, `groupBy` sólo acepta día, semana o mes, y `/creatives` da 404
(`lib/ghl/anuncios.ts:62-74`, medido el 2026-09-18 y 2026-09-19). El estado de entrega por anuncio
tampoco existe por esta vía (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:60-63`, 2026-09-16).
La única fuente sería Meta directo, y es la mitad del § 18.12.

**2 · Lo que era «la mejor noticia»** —`public.closer_meta_metricas` diseñada y vacía— dejó de
importar: el destino es `negocio.metricas_de_anuncio`, en nuestro esquema, y está llena.

**3 · El tráfico propio de la landing.** Ninguna tabla de sesiones, visitas o eventos en `negocio`
(29 tablas el 2026-09-28, 21 el 2026-09-15; `information_schema` filtrado por
`sesion|visita|trafico|evento` da 0). Lo que sí llega es `landingPageView` de Meta dentro de
`acciones` (151 filas), y lo usa Creative.

**4 · Alertas estructuradas (§ 18.13).** Ni tabla ni detector de anomalías (la fatiga por caída del
CTR sí existe, y la publica Creative: § 2): 0 columnas `entity_type`/`entity_id` en `negocio`.
`negocio.hallazgos` tiene 24 filas (20 el 2026-09-15) y sigue siendo de Conversation.

**5 · Ventas por anuncio.** Sin denominador: 0 ventas en `negocio.resultados`. El monitor lo dibuja
como «— · 0 de 0» y no como 0 %, que es lo correcto.

**6 · La frecuencia de sincronización de Meta.** Resuelta en forma —una pasada diaria que relee hoy
y dos días atrás y rellena los huecos del resto (`recolectarAnuncios.ts:192-259`)— y **no medida en
fondo**: cuánto tarda esta cuenta en estabilizar sus cifras está declarado sin medir
(`recolectarAnuncios.ts:33-40`), con `sincronizado_el` guardado para poder medirlo.

**7 · La diferencia entre leads de Meta y de la base (§ 18.14).** Fuera de alcance y dibujada así
(`calidadDeLaAtribucion.ts:200-206`): el `leads` del proveedor es nuestro conteo, 16 de 16 el
2026-09-16 (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:210-223`), y `results.lead` suma dos
mecanismos de conteo que no se pueden separar (`741f27d`, 64 filas, 2026-09-19).

**8 · First-touch sobrescrito (§ 18.14).** Los dos toques se guardan, pero se reescriben en cada
pasada: detectar un cambio exige una tabla de cambios que no existe
(`calidadDeLaAtribucion.ts:26-29`).

**9 · Lo que se guarda y no se dibuja.** Alcance y frecuencia por día (no se pueden sumar,
`costoDelAnuncio.ts:115-125`), impresiones, clics y CPC. Y **ningún corte por ad set ni por
campaña** en esta pantalla, aunque `meta_conjunto_id` y `meta_campana_id` están en la dimensión.

**10 · Las campañas que nuestra atribución no nombra.** El colector pide sólo las campañas que
aparecen en `atribucion_primera` (`recolectarAnuncios.ts:266-267`: la cuenta tenía 61 y nosotros 13).
Una campaña nueva cuyos leads entren por formulario o calendario —que no traen campaña, § 4— nunca
se pediría, y su gasto no existiría para esta pantalla. Si hay una campaña así desde el 13 de
septiembre, **no verificado**: desde la base no se puede ver.

**11 · Calificado y costo por calificado.** Dependen de que Business exponga la calificación
(§ 18.7); la decisión de quién define «calificado» sigue abierta.

**12 · La comparación con el período anterior y las flechas.** No existe ninguna.

---

## 6 · Reglas propias

**1 · La clave del anuncio es `adId`, nunca el nombre.** La tabla agrupa por `meta_anuncio_id`
(`costoDelAnuncio.ts:295`); con 79 anuncios y 32 nombres, agrupar por nombre fundiría campañas
distintas. El § 18.5 lo pide así.

**2 · Las métricas son nulables y el guion es «no se sabe».** El proveedor omite las claves cuando
el anuncio no entregó, y un 0 en su lugar borraría la diferencia con «entregó gratis»
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:176-190`); `sum` ignora los nulos y devuelve
nulo si todos lo son (`costoDelAnuncio.ts:282-285`). Medido hoy hay un tercer estado que la regla no
previó: **38 filas con gasto 0,00 y sin impresiones**, todas entre el 19 de agosto y el 17 de
septiembre (§ 7, riesgo 4).

**3 · Las derivadas se calculan sobre las sumas**, no promediando las del proveedor
(`costoDelAnuncio.ts:311-316`); alcance y frecuencia no se agregan (`:115-125`).

**4 · Gasto y leads van en dos consultas.** Tienen grano distinto y unirlos multiplica el gasto por
los leads sin fallar (`costoDelAnuncio.ts:185-194`).

**5 · La ventana del costo se ancla al día.** El gasto vive en un `date`; recortarlo con `current_date`
y los leads con `now()` dividía 31 días entre 30 (`costoDelAnuncio.ts:34-65`). Consecuencia
declarada: acá «Hoy» es el día de calendario (`:61-63`). La excepción no alcanzó al monitor.

**6 · La cohorte se arma con `alta_en_el_crm`**, no con `creado_el` (`costoDelAnuncio.ts:346`,
`calidadDeLaAtribucion.ts:116`), con el índice que la 052 agregó para eso
(`db/migraciones/052_el_indice_que_la_048_dejo_debiendo.sql:1-20`).

**7 · La fila «sin anuncio» se cuenta pero no compite.** Hoy se cumple por omisión: la tabla no
tiene fila sin anuncio, y el tamaño del hueco viaja aparte, en `cobertura` y en el monitor
(`costoDelAnuncio.ts:177-181`). Es el mismo criterio que la fila «Otras» sin tasa de
`lib/negocio/atribucionDelLead.ts:195-198`.

**8 · Manda el primer toque.** `atribucion_primera` tiene `adId` en 213 contactos y
`atribucion_ultima` en 87 (§ 4).

**9 · El piso es para proporciones; el CPL se publica con un lead**, porque es un hecho y no una
tasa, y `leads` viaja al lado (`costoDelAnuncio.ts:139-148`, `:212-213`).

**10 · La cobertura va arriba y en la misma respuesta** (`app/api/acquisition/route.ts:17-22`,
`PanelDeAcquisition.jsx:209-212`), con sus dos términos (`costoDelAnuncio.ts:177-181`).

**11 · Un aviso por bloque, elegido por lo que más invalida**: la ventana cortada antes que la
cobertura, y ésta antes que los anuncios que gastaron sin leads (`costoDelAnuncio.ts:421-425`,
`:445-496`).

**12 · El punto invertido se marca**, o una barra llena diría «bien» en cuatro filas y «mal» en una
(`calidadDeLaAtribucion.ts:184-194`, `PanelDeAcquisition.jsx:285-296`).

**13 · Se ordena por gasto, no por CPL, y no se calcula revenue, CAC ni ROAS.** El CPL solo es la
acción que el § 18.10 prohíbe decidir sin validación (`PanelDeAcquisition.jsx:326-339`).

**14 · El colector reconcilia y no olvida.** Pide lo que falta, no lo que sigue a una marca de agua
(`recolectarAnuncios.ts:192-259`), y conserva el conjunto que ya sabía (`:351`).

---

## 7 · Riesgos

**1 · La ventana por omisión describe treinta días de una pauta que gastó en quince.** El
encabezado dice «Del 30 ago al 28 sep» porque `hasta` es el máximo de `fecha` y hay filas —vacías—
de todos los días (`costoDelAnuncio.ts:381-406`); por lo mismo, el aviso de ventana incompleta no
puede dispararse (`:445-466`). Dividir 1.974,93 por 30 da 65,83 por día; el gasto real fue de 131,66
por día durante 15 días y ninguno los otros 15 (casi todas filas nulas, «no entregó»: § 4). Nada en
la pantalla dice «no hay gasto desde el 13».

**2 · «Hoy» son dos ventanas en la misma pantalla.** El botón lleva el matiz «Las últimas 24 horas,
no el día del calendario» (`lib/negocio/periodo.ts:84`, puesto como `title` en
`PanelDeAcquisition.jsx:133`); el costo usa el día de calendario (`costoDelAnuncio.ts:61-63`) y el
monitor 24 horas móviles (`calidadDeLaAtribucion.ts:116`). La ruta afirma que las dos cifras reciben
«LA MISMA ventana» (`app/api/acquisition/route.ts:24-25`): reciben los mismos días, no el mismo
ancla. Medido a 30 días el 2026-09-28: **276 contactos en el aviso del costo y 277 en el monitor**,
en la misma pantalla. Y `periodo.ts:76-77` sigue diciendo que todas las ventanas del sistema son
móviles.

**3 · El monitor acusa una UTM que sí llega.** Busca `utmCampaign` (`calidadDeLaAtribucion.ts:89`),
que **ningún contacto de los 594 trae en toda la historia**; GoHighLevel guarda el nombre de campaña
en `campaign` —250 de las 264 sesiones con UTM de la ventana—, que es la clave que usa
`lib/negocio/atribucionDelLead.ts:97`. Contando `campaign`, 47 de 264 tienen las cinco. El aviso
grave de hoy manda a revisar enlaces que, según la URL de aterrizaje que midió la foto anterior
(con `utm_campaign=` adentro, 2026-09-15), están bien armados.

**4 · «Entregó N días» cuenta días sin impresiones.** `diasConEntrega` cuenta `gasto is not null`
(`costoDelAnuncio.ts:288`) y la nota dice «Entregó N días de la ventana»
(`PanelDeAcquisition.jsx:380-386`). Medido a 30 días: el anuncio de mayor gasto dice 16 y tuvo
impresiones en 12; 14 de los 79 anuncios dan cifras distintas por las dos vías; dos anuncios
figuran con gasto cero y «Entregó» uno o dos días sin una sola impresión. Creative lo corrigió de su
lado contando impresiones (`lib/negocio/rendimientoDelCreativo.ts:216-229`); acá no, y la prueba
sólo siembra días todo nulos o todo llenos, así que el caso «gasto 0,00 sin impresiones» no está
cubierto (`pruebas/base/99-costo-del-anuncio.test.ts:207-220`).

**5 · La tabla no distingue anuncios homónimos.** 21 nombres repetidos, hasta seis filas con el
mismo, y ninguna columna de campaña ni de ad set (`PanelDeAcquisition.jsx:363-371`).

**6 · La cobertura no es al azar, y el aviso que lo explica tapa a otro.** El `adId` llega por
Facebook e Instagram y nunca por formulario ni calendario (§ 4; `costoDelAnuncio.ts:14-21`). El
segundo anuncio por gasto (554,05) no tiene ningún lead atribuido, y 13 gastaron sin leads; su aviso
no aparece porque el de cobertura va antes. Hay que leerlos como «no sabemos», no como «no trajeron».

**7 · Cualquier comparación con Executive.** Executive publica 8.525 de inversión a 7 días y un
conflicto «a $19» (§ 3). Con la pantalla real al lado, una de las dos está mintiendo, y la que
parece oficial es la del jefe.

**8 · El 91 % del § 18.17 es un ejemplo.** El real, a 30 días, es 71,8 % (199 de 277); sobre la base
entera, 35,9 % (213 de 594).

**9 · Mostrar URLs crudas.** Hoy la pantalla no dibuja ninguna. El día que alguien agregue
«landings», la foto anterior midió seis de 99 con un token que lleva el identificador del contacto
adentro (2026-09-15, no re-medido): guardarlas está bien, mostrarlas no.

**10 · Documentos que dicen lo contrario de lo medido.** `docs/acquisition/00-MAPA.md:147-155` sigue
poniendo el gasto entre los que «Esperan a Meta», y su propia cabecera (`:16-18`) dice que el costo
por anuncio ya se mide; lo verdadero es la cabecera. `docs/acquisition/13-EL-CONTRASTE.md:164-170`,
`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:216-217` y
`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:40` siguen poniendo la credencial de Meta como el freno;
`docs/acquisition/13-EL-CONTRASTE.md:53` y `docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:100-103`
dicen que se guarda un solo toque, cuando se guardan dos. El requisito A1-06 remite al «gran total
del §A1-07» (`docs/acquisition/01-LOS-TRES-EMBUDOS.md:169`), y el gran total es A1-14 (`:275`); A1-07
son las etiquetas (`:171`). Y 56 citas `01-ACQUISITION.md:N` de `docs/acquisition/01`, `03` y `05`
(20, 16 y 20, contadas el 2026-09-28) apuntan a líneas de la foto del 2026-09-15: con ésta caen en
otro texto, y la versión que citaban queda en git (`bddb516`, movida por `e630823`). La única de esa
carpeta que cita esta foto, `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:97`, manda al ad set a las
líneas 277-280, que son la cohorte vieja: el párrafo del ad set es el que sigue (§ 4, «El ad set»).

**11 · Comentarios del código que ya no dicen la verdad.** `lib/negocio/barrido.ts:239-241` sigue
contando «cuatro días… 52 llamadas» cuando la relectura bajó a dos días y 39 llamadas
(`lib/negocio/recolectarAnuncios.ts:59`, `:78-79`);
`db/migraciones/053_el_desglose_que_ya_llegaba.sql:34-35` pone el cron a las 17:06 UTC y es a las
06:17 (`lib/negocio/barrido.ts:220`). `lib/negocio/costoDelAnuncio.ts:443-444` justifica el umbral de
dos días con que «el colector pide hoy y los tres anteriores», y pide hoy y los dos anteriores.

Seis citas a `costoDelAnuncio.ts` desde otros módulos quedaron corridas (se da la línea que citan
de ese archivo y dónde está hoy lo citado): `lib/negocio/calidadDelCreativo.ts:162`,
`lib/negocio/rendimientoDelCreativo.ts:116` y `:231` mandan a la 157-164 por el defecto de grano,
que está en `costoDelAnuncio.ts:185-194`; `lib/negocio/fatigaDelCreativo.ts:7` manda a la 88-95 por
el alcance, que está en `costoDelAnuncio.ts:115-125`; `lib/negocio/recorrido.ts:189` manda a la 348
por la ventana de la cohorte, que está en `costoDelAnuncio.ts:346`; y
`lib/negocio/rendimientoDelCreativo.ts:221` manda a la 287, que está en `costoDelAnuncio.ts:288`.

Y `comoDia` (`costoDelAnuncio.ts:409-412`) formatea con `toISOString()` un `date` que el
controlador entrega a medianoche local —el defecto exacto que `recolectarAnuncios.ts:329-333`
documenta—: al este de Greenwich `desde` y `hasta` saldrían un día antes. En producción, que corre en
UTC, no se nota; **leído del código, no ejecutado**.

**12 · La comprobación visual de las cifras no consta.** `be5ba97`, `be7ef03` y `c1093f4` la dejaron
pendiente porque necesitaba contraseña. `00e251d` y `1020412` (2026-09-20) sí abrieron la pantalla en
el navegador, pero para medir el ancho del armazón (de 375 a 1400 px), no para mirar sus cifras.
Este corte tampoco la hizo.

---

> **Después del corte, 2026-09-30.** El usuario decidió volver al front del prototipo, con
> la estética al 100 % y los datos reales: `docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`.
> Cuando se construya, la tabla por anuncio y la tarjeta del monitor salen de la pantalla, y entran
> los tres funnels con la campaña asignada a mano. Lo de arriba describe la pantalla del 2026-09-28.
