# Acquisition — mapa de los requisitos

> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.

## Qué es esta carpeta

La pestaña Acquisition existe, se dibuja entera y no tiene una sola cifra real: **483 líneas**
—302 de `lib/aios/acquisition.js`, 148 de `components/views/AcquisitionView.jsx` y 33 de
`lib/aios/acquisition-plan.js`— que fabrican siete campañas inventadas y las dibujan con cinco
KPIs, tres tarjetas de embudo, tres tablas, dos alertas escritas a mano y un modal de nueve
recomendaciones. No hay ninguna ruta de servidor detrás: `ls app/api/` devuelve diecisiete carpetas
y ninguna es `acquisition`, y la sección se declara con `sinOperacionesTodavia: true`
(`lib/autorizacion/secciones.ts:242-247`).

**Y sin embargo, esa maqueta es la especificación.** Alguien decidió que la pantalla mostrara la
inversión del período, los contactos, los clics, los agendados, los calificados, el costo por
calificado, dos lecturas de la misma tasa y un reparto de afinidad en tres tramos. Esas decisiones
están tomadas, aunque los números que las ilustran sean falsos. Esta carpeta las extrae, las numera
y les pone al lado el estado del dato que cada una va a necesitar.

Esto **no** es un plan de construcción: no propone orden de trabajo ni estima esfuerzo. Es la lista
de lo que el sistema real tiene que calcular, con el rastro de dónde salió cada cosa.

---

## La distinción que decide si esta carpeta sirve

En el prototipo conviven dos clases de literal, y confundirlas arruina el trabajo:

- **REQUISITO** — algo que la pantalla muestra y que un sistema real tiene que calcular: la
  inversión del período, los contactos, los clics, los agendados, los calificados, el costo por
  calificado, las tasas de paso, los tramos de ICP, los deltas contra el período anterior.
- **ANDAMIAJE** — cómo el simulacro fabricó esos números porque no tenía datos: `seedMod()`, que
  convierte el texto de una fecha en un multiplicador entre 0,88 y 1,12 (`acquisition.js:47-51`);
  los multiplicadores `m`/`pm` de cada período (`:37-38`); los 58 literales numéricos de `CAMPS`
  (`:20-35`). **Nada de eso es un requisito.** Un sistema real no necesita un hash de una fecha:
  necesita leer el gasto de Meta y contar contactos entre dos fechas.

El caso difícil, y hay que pensarlo en cada pieza: **un literal de andamiaje puede estar señalando
un requisito real**, y a veces lo señala estando equivocado. Dos ejemplos del propio prototipo:

**1 · El tope de 0,94 — andamiaje entero, y su conclusión correcta es la contraria.**
`const cap = v => Math.min(.94, v)` (`acquisition.js:86`) se aplica a toda tasa de paso y también a la
tasa de calificación (`:92`, `:94`). Nadie pidió topar tasas al 94 %.
Lo que **sí** revela es que quien hizo la maqueta sabía que una tasa de paso no puede dar 100 %.
Pero la conclusión correcta es la opuesta a lo que hizo: una tasa real **sí** puede dar cerca de
100 %, y el trabajo es explicar por qué, no taparla. Está medido: los 57 contactos de la ventana
**sin `adId` agendan 47 veces, el 82,5 %**, la tasa más alta de toda la tabla y muy por encima del
44 % del anuncio de mayor volumen (`01-ACQUISITION.md` §6, regla 7). Esa cifra alta es la señal más
importante de la pantalla —y no dice que el mejor anuncio sea ninguno, dice que el widget de
calendario no pasa el `adId`—.

**2 · `icp:{a,m,b}` — andamiaje en sus VALORES, requisito en su FORMA.**
Cada campaña trae tres proporciones que suman exactamente 1,00 (`acquisition.js:22-34`). Los 21
números son inventados y se borran. Lo que sobrevive es la forma: **el sistema real sí tiene que
partir a los calificados en tramos y publicar el reparto, no sólo un promedio** — es lo que alimenta
`icpBar` (`:136-141`) y la columna «Afinidad ICP» de las tablas (`:214`, `:237-238`). Y sobrevive también un
invariante que el prototipo resuelve bien y hay que conservar: el tramo bajo es el **residuo**
(`o.icpB = Math.max(0, q - o.icpA - o.icpM)`, `:97`), no un tercer redondeo, y por eso los tres
tramos suman siempre los calificados y la barra llena el ancho sin hueco. Lo que **no** sobrevive
es que los tramos vengan dados: el puntaje real del CRM es continuo —«Puntaje | ICP», poblado en
**229 de 233 contactos**— así que dónde cortan los tramos, y si siguen siendo tres, es una
definición de negocio pendiente y está escrita como pregunta abierta, no como requisito.

Regla práctica que sale de los dos: **si la pieza se puede reemplazar por una consulta, es
requisito; si hay que borrarla, es andamiaje; y si al borrarla queda un hueco con forma, la forma
es el requisito.**

---

## Los otros documentos

| Archivo | Prefijo | Título |
|---|---|---|
| [01-LOS-TRES-EMBUDOS.md](01-LOS-TRES-EMBUDOS.md) | `A1-` | Los tres embudos y sus etapas |
| [02-METRICAS.md](02-METRICAS.md) | `A2-` | Acquisition · Catálogo de métricas |
| [03-COSTOS.md](03-COSTOS.md) | `A3-` | El modelo de costos de Acquisition |
| [04-CALIDAD-DEL-LEAD.md](04-CALIDAD-DEL-LEAD.md) | `A4-` | Acquisition · La calidad del lead: calificado, tramos de ICP y afinidad |
| [05-PERIODOS-Y-COMPARACION.md](05-PERIODOS-Y-COMPARACION.md) | `A5-` | El período y la comparación |
| [06-SENALES-Y-PLAN-DE-ACCION.md](06-SENALES-Y-PLAN-DE-ACCION.md) | `A6-` | Señales y Plan de acción |
| [07-LO-QUE-ENTREGA-A-OTROS.md](07-LO-QUE-ENTREGA-A-OTROS.md) | `A7-` | Lo que Acquisition entrega a otros |
| [08-DE-DONDE-VIENE-CADA-DATO.md](08-DE-DONDE-VIENE-CADA-DATO.md) | `A8-` | De dónde viene cada dato |
| [09-LO-QUE-NO-ES-UN-REQUISITO.md](09-LO-QUE-NO-ES-UN-REQUISITO.md) | `A9-` | Lo que NO es un requisito |

**Y la otra mitad, que no sale del prototipo sino del DOCUMENTO FUNCIONAL § 18.** Los cuatro de abajo
se escribieron después, con el documento a la vista, y piden bastante más que lo que la maqueta
dibuja: los seis componentes internos, veinticinco KPI contra los tres del prototipo, y un esquema de
alerta de catorce campos.

| Archivo | Prefijo | Título |
|---|---|---|
| [10-LO-QUE-PIDE-EL-DOCUMENTO.md](10-LO-QUE-PIDE-EL-DOCUMENTO.md) | `A10-` | Misión, alcance, datos de Meta y los 25 KPI del § 18.7 |
| [11-LOS-SEIS-COMPONENTES.md](11-LOS-SEIS-COMPONENTES.md) | `A11-` | La estructura interna, las alertas y el monitor de atribución |
| [12-QUIEN-DECIDE-QUE.md](12-QUIEN-DECIDE-QUE.md) | `A12-` | Responsabilidades, validación ejecutiva y las tres vistas por rol |
| [13-EL-CONTRASTE.md](13-EL-CONTRASTE.md) | — | **El prototipo contra el documento: qué falta, qué sobra y qué se contradice** |

Si se va a leer uno solo, que sea el `13`: es el que dice qué se puede construir hoy y qué está
bloqueado, y no agrega requisitos — compara los que ya están.

Si un nombre de archivo de la tabla no está en la carpeta, manda la carpeta.

Cada requisito se cita por su número completo —`A2-07`, `A4-12`— desde cualquier documento.

---

## El estado, en una línea

Este mapa no cuenta requisitos: los numera cada documento y el total se mueve con ellos. Cuenta el
piso, que es lo que decide qué se puede construir. **Debajo de todo lo que Acquisition dibuja hay
catorce datos distintos: cinco ya están en la base, cuatro están y llegan incompletos, tres esperan
a que se conecte Meta y dos no tienen origen decidido.**

**Ya están (5).** Contactos por fecha, con la cohorte armada con `alta_en_el_crm` y no con `creado_el`
—233 contra 256 en la ventana de 14 días, y los 23 de diferencia son latencia de ingesta—; agendados,
163 citas alcanzables sobre 149 contactos con `ghl_calendario_id is not null`; el puntaje ICP por
contacto, 229 de 233; el `campaignId`, 217 de 233; y los nombres del anuncio y del ad set, que llegan
en `utmContent` y `utmMedium` —cuyo nombre dice «medio» y cuyo contenido es el nombre del ad set—.

**Están e incompletos (4).** El `adId`, en 176 de 233 contactos (75,5 %) y en 82 de 163 citas
(50,3 %), con el hueco concentrado en quien entra por el widget de calendario. El id de ad set, en 39
de 233 y correspondiente a **un solo** ad set: el corte por ad set hoy sólo se puede hacer por nombre.
La serie histórica contra la que comparar: **95 % de los contactos caen en los últimos 45 días**, así
que el modo «Periodo anterior» abre comparando contra casi nada. Y el camino de entrada:
`atribucion_primera->>'medium'` da `facebook` 178, `calendar` 54 y `External Form` 1 — dos caminos y
medio, ninguno con el nombre de un embudo del prototipo.

**Esperan a Meta (3).** El gasto por anuncio y por día, los clics del anuncio y el estado de entrega
de la campaña. Ninguno está a medias: una búsqueda de columnas por
`spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl` sobre `negocio`,
`public` e `identidad` devuelve tres coincidencias y ninguna es gasto poblado.
`public.closer_meta_metricas` tiene exactamente la forma que hace falta —`nivel`, `objeto_id`,
`padre_id`, `fecha`, `gasto`, `impresiones`, `clics`, `cpl`…— y **0 filas**, y es de la plataforma
anterior: ningún archivo de código del repositorio la nombra. Es el dato más caro del departamento,
porque de él cuelgan KPIs de la pantalla y, fuera de la pantalla, el ROAS, el costo por venta y el
margen sobre ads que Executive publica (`lib/aios/executive.js:96, :116, :125`).

**Sin origen decidido (2).** Qué cuenta como «calificado» —el prototipo lo fabrica como una tasa
sobre agendados (`acquisition.js:94`) y después lo abre filtrado a ICP alto, y en la base no hay
ninguna marca de calificación ni forma de validarla contra resultado, porque `negocio.resultados`
tiene 7 filas y cero ventas—; y los eventos de la landing: formulario completado y vista de la VSL.
No hay tabla de tráfico, sesiones ni eventos de landing en `negocio.*`: son 21 tablas, revisadas una
por una.

---

## Alcance: de dónde sale esto, y quién gana en un desacuerdo

Todo lo que hay acá sale de **leer el prototipo**. No sale del documento funcional, que es la
especificación real del departamento —el §18, diecinueve subsecciones— y que **vive fuera del
repositorio**.

**Donde los dos digan cosas distintas, gana el documento, y hay que ir a buscarlo.** Ya hay dos
desacuerdos medidos, y los dos importan:

- El prototipo dibuja **«Clics a landing VSL» como una sola etapa** en los tres embudos
  (`acquisition.js:8, :12, :16`). El §18.7 pide dos cosas que no son la misma: `link CTR` /
  `click-to-landing rate`, que es lo que Meta dice que salió del anuncio, y `landing page view rate`,
  que es lo que llegó a la página. La etapa única del prototipo esconde esa diferencia.
- El plan de acción dice **«Sube el presupuesto de retargeting mientras el costo por calificado se
  mantenga bajo $110»** en el grupo «Haz más de esto» (`acquisition-plan.js:21`), y «Deja de escalar
  Prospecting B» en «Ajusta o pausa esto» (`:16`). El §18.10 lista las dos como acciones que
  requieren validación ejecutiva, no como recomendación directa al media buyer. Al portarlo, esas
  dos frases **cambian de grupo, no de redacción**.

Tres cosas más que se comprobaron leyendo el código y conviene saber antes de abrir cualquiera de
los otros documentos:

- **`delta` se llama en ocho puntos, no nueve** (`acquisition.js:146, :147, :148, :149, :150, :179,
  :188, :234`), y **las ocho pasan `invert:false`**. El parámetro que permite pintar de verde una
  métrica que baja existe y no se ejerce ni una vez, aunque el costo por calificado, el CPL y el
  costo por clic son exactamente el caso para el que se escribió.
- **El sistema ya se contradice a sí mismo sobre la inversión.** Acquisition dibuja el gasto en
  verde cuando sube (`acquisition.js:146`, `invert:false`); Executive, con el mismo dato, lo dibuja
  al revés (`lib/aios/executive.js:116`, `dl(d.spend, prev.spend, true)`). Una de las dos pantallas
  está mal y hay que decidir cuál.
- **`(t.clics || 0)` en `:118` no protege de nada**: los tres embudos declaran `clics`. La clave que
  el gran total no tolera es `forms`, que sólo tiene Booking directo y que `g` no inicializa
  (`:114`) — o sea, la etapa propia del tercer embudo existe en su tarjeta y en su tabla y
  desaparece del encabezado, por omisión y no por decisión.

Y una cosa que esta carpeta **no** hizo: nadie abrió la pantalla con sesión iniciada. Todo lo que
afirma sobre lo que se dibuja sale de leer el código.
