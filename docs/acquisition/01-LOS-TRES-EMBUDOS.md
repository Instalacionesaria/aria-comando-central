# Los tres embudos y sus etapas

> **`lib/aios/acquisition.js` YA NO EXISTE.** Se borró el 2026-09-16 junto con
> `acquisition-plan.js`, y con ellos los 58 literales inventados que esta carpeta documenta. Las
> citas `acquisition.js:N` de abajo **siguen siendo correctas como referencia histórica** —el
> archivo y sus líneas están en el historial de git— y ésa es toda su función acá: este documento
> nunca describió lo que hay, describió lo que la maqueta dibujaba para sacar de ahí los requisitos.
>
> **Y `components/views/AcquisitionView.jsx` se reescribió el mismo día**: pasó de 148 líneas a 60,
> así que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la
> línea 60 fallan al resolverse, y se ven. Las **once** que apuntan a las líneas 27-63 —el segmentado
> de período y el selector de rango— **siguen resolviendo y muestran otra cosa**, que es peor: una
> línea corrida no falla. Las once describen controles que ya no existen; el porqué de cada uno está
> en la cabecera del archivo nuevo.
>
> Lo que sí hay hoy es `components/acquisition/PanelDeAcquisition.jsx` con dos cifras medidas: el
> costo por anuncio (`lib/negocio/costoDelAnuncio.ts`) y el monitor de atribución del § 18.14
> (`lib/negocio/calidadDeLaAtribucion.ts`). Nada de lo demás está construido.

> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.

**El requisito estructural del departamento no son tres embudos: es que haya varios, de largo
distinto, y que cada uno nombre sus propias etapas.**

`FUNNELS` (`lib/aios/acquisition.js:5-18`) es un diccionario de recorridos, y lo recorren con
`Object.keys` `build` (`:102`), `renderFunnels` (`:162`) y `renderTables` (`:208`). Que sean tres es
andamiaje; que el número sea una dimensión y no una constante es el requisito. Y el que decide la
forma del modelo es el tercero: **«Booking directo» tiene cuatro etapas y los otros dos tienen
tres**, así que ninguna implementación con columnas fijas `contactos/clics/agendados` puede
representarlo.

`clics` aparece en los tres embudos y un clic no queda registrado en ninguna parte de esta base
(`01-ACQUISITION.md:262`).

---

## 1 · Los tres recorridos, tal como están declarados

`lib/aios/acquisition.js:5-18`. La columna «clave» es lo que une la cadena de cálculo; la etiqueta y
el nombre de costo cambian con el embudo.

**`leadform` — «Lead form ads»** · entra en `contactos`, tres etapas

| # | clave | etiqueta (`:8`) | costo (`:9`) |
|---|---|---|---|
| 0 | `contactos` | Leads | CPL |
| 1 | `clics` | Clics a landing VSL | C/clic |
| 2 | `agendados` | Agendados | C/agendado |

**`profile` — «Profile funnel»** · entra en `contactos`, tres etapas

| # | clave | etiqueta (`:12`) | costo (`:13`) |
|---|---|---|---|
| 0 | `contactos` | DMs | C/DM |
| 1 | `clics` | Clics a landing VSL | C/clic |
| 2 | `agendados` | Agendados | C/agendado |

**`booking` — «Booking directo»** · entra en `contactos`, **cuatro** etapas

| # | clave | etiqueta (`:16`) | costo (`:17`) |
|---|---|---|---|
| 0 | `contactos` | Contactos | C/contacto |
| 1 | **`forms`** | **Completaron form** | **C/form** |
| 2 | `clics` | Clics a landing VSL | C/clic |
| 3 | `agendados` | Agendas | C/agenda |

Tres claves de etapa (`contactos`, `clics`, `agendados`) más una exclusiva (`forms`). Siete etiquetas
distintas y siete nombres de costo distintos para esas cuatro claves.

**Los caminos reales no son éstos.** En la ventana de 14 días, `atribucion_primera->>'medium'` da
tres valores que no son tres embudos: `facebook`, `calendar` y `External Form`
(`01-ACQUISITION.md:87`). Cruzado con `sessionSource`, son dos caminos de pauta y una cola orgánica:
`facebook`+`Paid Social`, que casi siempre trae `adId`; `calendar`+`Paid Social`, que trae
`campaignId` y **0 `adId`**; y una cola sin pauta (`01-ACQUISITION.md:187-189`). Ninguno se llama como
los del prototipo, y son dos y medio, no tres.

---

## 2 · El modelo de recorridos

### A1-01 · El modelo admite varios recorridos de entrada a la vez, y el número es una dimensión

**Rastro:** `lib/aios/acquisition.js:5-18`, recorrido en `:102`, `:162`, `:208`.

Un contacto entra al sistema por uno de varios recorridos, y cada recorrido se describe con cuatro
cosas: un nombre para mostrar, una lista ordenada de etapas, una etiqueta por etapa y un nombre de
costo por etapa. El cálculo lee los recorridos del diccionario y no conoce su número: agregar o
quitar un embudo no toca ninguna fórmula.

**Estado:** parcialmente, y con otra forma. Los caminos medibles hoy son los dos de pauta del §1. El
corte existe y es barato —`medium` está en toda la cohorte de la ventana
(`01-ACQUISITION.md:87`)—; lo que no existe es la correspondencia con estos tres nombres.

### A1-02 · Las etapas de un recorrido son una lista ORDENADA, y el orden es el cálculo

**Rastro:** `lib/aios/acquisition.js:7`, `:11`, `:15`; derivación en `:92`; tasas en `:168-169` y `:220`.

El orden no es presentación. La cadena se deriva por índice contra `cfg.stages[k-1]` (`:92`), la tasa
paso a paso se calcula contra `c.stages[i-1]` (`:168`) y la acumulada contra `c.stages[0]` (`:169`).
El recorrido se guarda como secuencia, no como un juego de columnas: **una tabla con columnas
`contactos/clics/agendados` no puede representar `forms`**, que sólo tiene un embudo.

### A1-03 · Los recorridos tienen distinta cantidad de etapas, y eso es deliberado

**Rastro:** `lib/aios/acquisition.js:15-17` (la etapa `forms`); consecuencias en `:104-105`, `:114`, `:211`.

«Completaron form», con su costo «C/form», existe únicamente en Booking directo. El código está
construido alrededor de ese hecho en tres lugares distintos, lo que descarta que sea un descuido:

- el acumulador del embudo se inicializa recorriendo **sus propias** etapas (`:105`), así que cada
  total suma exactamente las etapas que ese embudo tiene y ninguna más;
- el gran total se inicializa con cinco campos y `forms` **no está** entre ellos (`:114`);
- el ancho de la grilla de la tabla se arma con `.repeat(stages.length)` (`:211`), así que la tabla de
  Booking directo tiene una columna más que las otras dos sin que nada se toque.

El defecto que esto evita es concreto: con un esquema fijo, la etapa propia de un embudo se pierde o
se rellena con ceros.

**Estado:** ver A1-08 y la pregunta abierta P-02. `forms` es la única etapa cuya fuente **existió y se
apagó**, no la única que nunca existió.

### A1-04 · Cada recorrido tiene exactamente una etapa de entrada: la primera, y es la única sin tasa

**Rastro:** `lib/aios/acquisition.js:90-91`; se refleja en `:166` («punto de entrada»), `:218`
(«entrada») y `:169` (es la base de la tasa acumulada).

`k === 0` es el caso especial de toda la cadena: el volumen se toma directo y no se deriva de nada,
porque no hay etapa anterior de la cual salir. Es también la base contra la que se miden todas las
demás en modo acumulado y el denominador del ancho de todas las barras (`:163`).

**Estado:** existe. La cohorte se arma con `alta_en_el_crm` —cuándo entró el lead al CRM— y no con
`creado_el`: la cohorte queda más chica, y la diferencia es latencia de ingesta
(`01-ACQUISITION.md:162`). Con esa columna llega la obligación que la regla 6 del §6 impone: ninguna
cohorte armada así tiene historia antes del despliegue, y la pantalla **tiene que decir desde cuándo
mide**.

### A1-05 · `agendados` es una etapa obligatoria de todo recorrido

**Rastro:** `lib/aios/acquisition.js:210`, `:174`, `:94`.

Varios puntos buscan esa etapa **por nombre**, no por posición: el corte de columnas de la tabla
(`c.stages.indexOf('agendados') + 1`, `:210`), el bloque de calificados que sólo cuelga de ella
(`s === 'agendados'`, `:174`) y el cálculo de calificados (`o.agendados`, `:94`). Un embudo sin esa
etapa devuelve `slice(0, 0)` —cero columnas de etapa en su tabla— y `o.agendados` indefinido.

**Comprobado, y corrige al inventario:** ese `slice` **hoy no recorta nada**. `agendados` es la última
etapa de los tres embudos, así que el corte devuelve la lista entera en los tres casos. Su fuerza no
es la de un recorte sino la de una restricción: el día que un embudo declare una etapa posterior a la
cita, la tabla deja de mostrarla sin que nadie lo decida.

**Estado:** existe. 163 citas alcanzables con `inicio_el` en la ventana, sobre 149 contactos, con
`ghl_calendario_id is not null` —el mismo filtro de cita alcanzable que ya usa
`lib/negocio/atribucionDelLead.ts:132-135`—. De ellas, 82 con `adId` (50,3 %) y 133 con `campaignId`
(81,6 %) (`01-ACQUISITION.md:213`).

### A1-06 · La clave de la etapa es interna y estable; la etiqueta es un atributo del recorrido

**Rastro:** `lib/aios/acquisition.js:8`, `:12`, `:16`.

La misma clave `contactos` se muestra como «Leads» en lead form, «DMs» en profile y «Contactos» en
booking. La misma clave `agendados` se muestra como «Agendados» en dos y «Agendas» en el tercero. La
clave es la que une la cadena de cálculo y nunca se muestra; la etiqueta es la que se muestra y nunca
se calcula.

El defecto que evita es el inverso del que parece: si la etiqueta fuera la clave, «Leads» y «DMs»
serían dos etapas distintas y el gran total del §A1-07 no podría sumarlas.

### A1-07 · Las etiquetas se guardan con caja de título y se bajan a minúsculas al vuelo

**Rastro:** `lib/aios/acquisition.js:170-171`, `:180`, `:196`.

Las etiquetas se escriben dentro de frases —«desde leads», «sobre leads», «de agendados», «entra en
contactos»— y en los cuatro puntos se aplica `.toLowerCase()` sobre la etiqueta guardada. O sea: se
guarda una sola forma, la de título, y las frases la bajan.

Conviene decir el resultado, porque es visible en pantalla: `'DMs'.toLowerCase()` da `dms`, así que el
encabezado del segundo embudo lee literalmente **«entra en dms · 2 campañas»**. Una etiqueta con
mayúsculas internas o con sigla se rompe al bajarla.

### A1-08 · Cada etapa de cada recorrido publica un nombre de costo propio, y el vocabulario depende del recorrido

**Rastro:** `lib/aios/acquisition.js:9`, `:13`, `:17`; se dibuja en `:190`.

Siete nombres para cuatro claves: CPL, C/DM, C/contacto, C/form, C/clic, C/agendado, C/agenda. **El
mismo paso se llama «CPL» en lead form y «C/DM» en profile**, y la etapa final es «C/agendado» en dos
embudos y «C/agenda» en el tercero. El nombre del costo es un atributo del embudo, exactamente como la
etiqueta.

**Estado:** no existe ninguno de los siete, porque no existe el numerador. Una búsqueda de columnas por
`spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl` sobre los esquemas
`negocio`, `public` e `identidad` devuelve tres coincidencias y **ninguna es gasto de Meta poblado**:
una meta de ventas, un `ht_budget` de otra plataforma, y las columnas de `public.closer_meta_metricas`,
que tiene **0 filas** (`01-ACQUISITION.md:93`). Tiene que venir del API de Marketing de Meta, por
anuncio/ad set/campaña **y por día**.

---

## 3 · La campaña, y lo que el recorrido agrupa

### A1-09 · La campaña es la fila del modelo, pertenece a un recorrido, y el recorrido determina su forma

**Rastro:** `lib/aios/acquisition.js:20-35` (el arreglo), `:21`, `:23`, `:25`, `:27`, `:29`, `:31`, `:33`
(el campo `f`), `:88` (`FUNNELS[c.f]`), `:103` (`rows.filter(r => r.f === k)`).

`CAMPS` es un arreglo plano: la campaña no cuelga del embudo, **declara** a cuál pertenece. De esa
declaración salen dos cosas distintas y las dos importan: en `:88` decide **qué etapas tiene** esa
campaña, y en `:103` decide **con quiénes se suma**. La consecuencia es la que hace legible la
pantalla: dos campañas del mismo embudo tienen las mismas columnas y se comparan fila contra fila; dos
campañas de embudos distintos no son comparables columna a columna, y por eso viven en tablas
separadas.

**Estado:** el inventario existe, la economía no. En la ventana hay varias campañas, varios anuncios y
**1 solo id de ad set** (`01-ACQUISITION.md:195`). `invD` —la inversión diaria por campaña— no tiene
fuente (A1-08).

### A1-10 · La campaña se identifica por clave, no por nombre

**Rastro:** `lib/aios/acquisition.js:88` (`n:c.n`), usado como identidad en `:223`, `:228`, `:231`.

En el prototipo la campaña no tiene identificador: `n` es un texto y es lo único que la distingue. Eso
es andamiaje, y es andamiaje que esconde un error de diseño medido en contra. **«El app» tiene dos
`adId` distintos** —`120249633901550467` con 44 contactos y `120249792217700467` con 2—
(`01-ACQUISITION.md:280`). Son los mismos creativos relanzados en la campaña nueva
del 12 de septiembre. Agrupar por nombre los fusiona y **borra el arranque de la campaña nueva**, que
es justo lo que un media buyer necesita mirar. El §18.5 ya lo fija: la relación es por `meta_ad_id`.

Dos reglas del mismo §6 se aplican encima, y las dos son sobre el nombre, no sobre la clave: agrupar
por `lower(...)` y mostrar con `min(...)`, porque en la ventana hay **más nombres de campaña en
minúsculas que ids** (regla 3, `01-ACQUISITION.md:284`); y descartar `not like '{{%'`, porque dos
contactos traen literalmente `{{campaign.id}}` y `{{ad.name}}` sin renderizar (regla 4,
`01-ACQUISITION.md:286`).

### A1-11 · El recorrido agrupa varias campañas y publica su total: los volúmenes se suman, la afinidad se RECALCULA

**Rastro:** `lib/aios/acquisition.js:101-113`; el acumulador en `:104-105`, la suma en `:106-110`, el
recálculo en `:111`.

Inversión, etapas, calificados y los tres tramos de ICP se acumulan sumando. La afinidad del embudo
**no es el promedio de las afinidades de sus campañas**: se vuelve a calcular con la misma fórmula
sobre los tramos ya agregados (`:111`). El defecto que evita se puede medir: un promedio de promedios
le da a una campaña de 3 calificados el mismo peso que a una de 300.

La regla general que hay que conservar al portarlo: **lo que es un conteo se suma; lo que es un
cociente se vuelve a dividir sobre los agregados.** Vale para la afinidad (`:111`), para el costo por
calificado del embudo (`:201`) y para el gran costo por calificado (`:120`).

### A1-12 · El total del recorrido se dibuja siempre; las campañas son el detalle opcional

**Rastro:** `lib/aios/acquisition.js:246` (la llamada está FUERA del condicional de `open`), `:227-229`,
`:39` (el estado inicial).

`row(d.total, pd.total, true)` se concatena siempre; `kids` sólo cuando el embudo está abierto. Con la
tabla plegada se ve únicamente el total; al abrirla aparecen las campañas encima. Y el total pasa por
**la misma función `row`** que las campañas: mismo formato, mismos guardados, misma barra de ICP. No
hay un camino de render distinto para el agregado.

**Estado relevante:** con la regla 5 del §6 —ventana de 14 días y piso de 10 contactos para publicar una
tasa— **sólo 3 anuncios de la ventana llegan al piso** (109, 44 y 17 contactos)
(`01-ACQUISITION.md:288`). La tabla desplegada real tiene tres filas y una «Otras», y el total de
arriba es la cifra que la mayoría va a leer.

### A1-13 · El encabezado del recorrido dice por dónde se entra y cuántas campañas lo alimentan

**Rastro:** `lib/aios/acquisition.js:196`; el conteo se repite en `:229` y `:244`.

«entra en leads · 3 campañas», «entra en dms · 2 campañas», «entra en contactos · 2 campañas». Dos
datos que la pantalla necesita en el mismo renglón: **cuál es la puerta de entrada de ese camino** —que
es la etapa cuya etiqueta cambia entre embudos, A1-06— y **cuántas campañas lo alimentan**. El mismo
conteo aparece tres veces (encabezado de tarjeta, fila de total, resumen de la cabecera plegable), así
que sale de un solo lugar: `m.fn[k].list.length`.

### A1-14 · El gran total sólo suma las etapas que los tres recorridos comparten

**Rastro:** `lib/aios/acquisition.js:114-119`; el aviso en pantalla, `components/views/AcquisitionView.jsx:94-100`.

`g` se inicializa con `{inv, contactos, clics, agendados, calificados}`. **`forms` no está.** La etapa
exclusiva de Booking directo existe en su tarjeta y en su tabla y desaparece del encabezado. Y `g` no
lleva ninguna tasa: sólo volúmenes y dinero.

Esa segunda mitad está enunciada en pantalla y es la que justifica la primera:

> «Los totales llegan hasta **calificados**, que es donde termina la responsabilidad de pauta. Son
> volumen y dinero, no tasas: sumar contactos de funnels distintos mide escala, no conversión.»

O sea: el gran total es una cifra de escala, y por eso puede sumar etapas de embudos distintos. En
cuanto se le pidiera una tasa, la suma dejaría de tener sentido —el denominador serían tres cosas
diferentes—.

El `(t.clics || 0)` de `:118` es un guardado que hoy **no protege de nada**: los tres embudos tienen
`clics`. Es la huella de que el autor sabía que las etapas no son homogéneas, puesta en la etapa
equivocada: la que necesitaba la protección es `forms`, y lo que recibió fue la omisión.

### A1-15 · La comparación entre ventanas empareja campañas por clave, no por posición

**Rastro:** `lib/aios/acquisition.js:240` (`row(r, pd.list[i], false)`), `:88` (`i:i`), `:234` (el guardado).

Éste es un requisito que el prototipo tiene **al revés**, y no está en el
inventario. La tabla empareja la campaña de la ventana actual con la de la ventana de comparación **por
índice de arreglo**: `d.list.map((r, i) => row(r, pd.list[i], ...))`. Con `CAMPS` fijo funciona, porque
las dos listas son la misma en el mismo orden. Con datos reales no: el conjunto de campañas cambia
entre ventanas —la campaña `120249792217660467` arrancó el 12 de septiembre y no existe en la ventana
anterior—, y emparejar por posición compara el delta de una campaña contra el de otra.

El propio módulo ya escribió la mitad de la solución y no la usó: `:88` guarda `o.i` en cada fila y
**ningún punto del archivo lo lee**. Lo que hay que guardar en su lugar es la clave del anuncio o de la
campaña (A1-10), y emparejar por ella.

El guardado de `:234` —`pr ? pr.calificados : 0`— muestra que el autor previó listas de largo distinto:
cuando la ventana anterior tiene menos campañas, `pd.list[i]` es `undefined` y la celda escribe «sin
comparación» en vez de romperse. Ese comportamiento es correcto y hay que conservarlo: **una campaña que
no existía en la ventana anterior no tiene delta, y lo dice.**

---

## 4 · Los dos modos de tasa

### A1-16 · La misma cadena se lee de dos maneras, y las dos son derivaciones, no dos métricas

**Rastro:** `lib/aios/acquisition.js:39` (`rate:'step'` por defecto), `:168-171` (tarjetas), `:220-221`
(tablas); el control en `components/views/AcquisitionView.jsx:51-63`.

| modo | denominador | fórmula |
|---|---|---|
| `step` (por defecto) | la etapa **inmediatamente anterior** | `v / t[stages[i-1]]` |
| `cum` | la **etapa de entrada** del embudo | `v / t[stages[0]]` |

Ninguno de los dos guarda nada: son dos divisiones sobre los mismos volúmenes. El requisito es que
existan los dos, y la razón es que responden preguntas distintas que no se pueden contestar con una
sola cifra: **paso a paso dice dónde se cae la gente; acumulada dice cuánta queda.** Una campaña puede
tener el mejor paso de clic a agenda del embudo y la peor tasa acumulada, y con un solo modo esas dos
campañas se ven iguales.

**Comprobado, y vale para dimensionar el control:** en un embudo de tres etapas el interruptor cambia
**exactamente un número**. Para `i = 1` los dos denominadores son la etapa de entrada, así que el
porcentaje es el mismo y sólo cambian las palabras; sólo `agendados` se recalcula. En Booking directo,
que tiene cuatro etapas, cambian dos (`clics` y `agendados`). El modo acumulado recién empieza a
aportar en la tercera etapa — que es otra forma de decir que **el modo importa en proporción al largo
del embudo**, y que en un embudo de tres pasos casi todo el valor está en el rótulo.

### A1-17 · El texto de la tasa nombra la base contra la que se calculó

**Rastro:** `lib/aios/acquisition.js:169-171`.

`step` escribe **«… desde leads»**; `cum` escribe **«… sobre leads»**. La preposición distingue el
modo y el sustantivo nombra el denominador, tomado de la etiqueta del embudo (A1-06, A1-07). El defecto
que evita es el más común de un embudo: **mostrar un porcentaje sin decir de qué**, que en una pantalla
con dos modos y cuatro etapas produce dos lecturas incompatibles del mismo número.

La etapa de entrada no lleva tasa y lo dice con dos palabras distintas según dónde esté: «punto de
entrada» en la tarjeta (`:166`) y «entrada» en la tabla (`:218`).

### A1-18 · El modo de tasa se aplica a la vez en las tarjetas y en las tablas

**Rastro:** `lib/aios/acquisition.js:168` (tarjeta) y `:220` (tabla), los dos leyendo `S.rate`; el
re-render completo en `:256-264`.

Hay un solo interruptor y gobierna las dos representaciones. No existe un modo de tarjeta y otro de
tabla: sería posible leer dos porcentajes distintos arriba y abajo para la misma etapa de la misma
campaña, y la pantalla estaría mostrando dos verdades sin decir que son dos.

### A1-19 · La barra del embudo NO sigue al modo de tasa: se mide siempre contra la entrada

**Rastro:** `lib/aios/acquisition.js:163` (`base = t[c.stages[0]]`), `:165` y `:189` (el ancho).

El ancho de cada barra es `(v / base) * 100`, con `base` siempre la etapa de entrada, sin importar
`S.rate`. Al cambiar de modo **el dibujo se queda quieto y sólo cambia el texto**. Es deliberado y
conviene conservarlo: si la barra siguiera al modo, «paso a paso» dibujaría todas las etapas casi
llenas —cada una es un porcentaje alto de la anterior— y el embudo dejaría de parecer un embudo. La
forma del recorrido es una cosa; la lectura de la tasa es otra.

---

## 5 · Lo que de esta sección NO es requisito

- **Que sean tres y que se llamen así.** «Lead form ads», «Profile funnel» y «Booking directo» son
  nombres de maqueta. Los caminos medidos son dos y medio y ninguno se llama así (§1).
- **Los 58 literales de `CAMPS`** (`:20-35`) y los siete nombres de campaña genéricos. La forma —una
  fila por campaña, con su embudo, su economía y su calidad encima— es requisito; los números no.
- **`PERIODS.pmes`** (`:38`). Dura **12 días** y **no hay ningún botón que lo seleccione**: la vista
  sólo ofrece `p1`, `p7` y `p30` (`AcquisitionView.jsx:29`, `:32`, `:35`). Es código
  muerto o un período que falta en la interfaz.
- **`seedMod`** (`:47-51`) y los multiplicadores `m`/`pm`. No se reemplazan: se borran.
- **El tope `cap = v => Math.min(.94, v)`** (`:86`). Nadie pidió topar tasas al 94 %. Lo que revela es
  que el autor sabía que una tasa de paso no puede dar 100 %; lo que hay que hacer es lo contrario de
  lo que hizo. Está medido: el segmento «(sin adId)» tiene **la tasa de agenda más alta de toda la
  tabla**, y esa cifra alta es la señal más importante de la pantalla
  (`01-ACQUISITION.md:117`, regla 7 del §6). Un tope la habría borrado.
- **El piso `Math.max(1, ...)` de la etapa de entrada** (`:91`). Impide que un embudo entre en cero, y
  un cero real es información: una campaña apagada, un camino sin tráfico. Peor, tapa el
  comportamiento correcto: con `base = 0` las barras quedan en 0 % y las tasas caen al guion de `—`,
  que es exactamente lo que hay que dibujar y el piso de 1 nunca deja ver.
- **La DIRECCIÓN del cálculo** (`:92`). Acá la tasa es el dato de entrada y el volumen se deriva. En el
  sistema real se cuentan los dos volúmenes y la tasa es el cociente — con una consecuencia que hay que
  decidir y no forzar: **la cadena puede no cerrar.** Un contacto que hace dos clics produce más clics
  que contactos, y `cap` no existe para tapar eso.

---

## 6 · Preguntas abiertas

### P-01 · De dónde sale «Clics a landing VSL» — y si le pertenece a Acquisition

Es la etapa que el prototipo pone en **los tres** recorridos (`:8`, `:12`, `:16`) y la que menos
existe: no hay ninguna tabla de tráfico, sesiones ni eventos de landing en `negocio.*` —21 tablas
revisadas una por una— y un clic no queda registrado en ninguna parte de esta base
(`01-ACQUISITION.md:258-262`). Pero la pregunta no es sólo de dónde sale el dato. Son tres preguntas, y
el prototipo ya contestó dos de ellas **en otra pantalla**:

**(a) Quién es el dueño.** `lib/aios/conversion.js:35-39` declara la cadena de Conversion:
`sesiones` «Landing» → `vsl` «VSL» → `form` «Formulario» → `agenda` «Agenda» → `gracias` «Gracias». Y
`lib/aios/executive.js:25` asigna la etapa «Visitas landing» a **Conversion**, no a Acquisition. El
propio plan de acción de Acquisition lo repite: «La fuga de formulario a landing pertenece a
**Conversion**» (`lib/aios/acquisition-plan.js:26`). O sea: el sistema ya decidió que la landing es de
otro departamento, y Acquisition dibuja una etapa de landing dentro de sus tres embudos.

**(b) De qué proveedor.** La misma línea de Conversion lo nombra: `src:'Clarity'` para las sesiones y
`src:'VTurb'` para el VSL, y los dos se muestran en pantalla como fuentes conectadas
(`conversion.js:398`, `:400`, `:420`, `:422`; `components/views/ConversionView.jsx:25`, `:29`). Los dos
son cadenas de texto y nada más: ni cliente, ni ruta, ni tabla, ni variable de entorno
(`03-CONVERSION.md:176`). La pantalla afirma dos integraciones que nunca existieron.

**(c) Qué mide exactamente, y si es la misma cosa en los tres embudos.** Acá está el problema que
ninguna de las dos respuestas anteriores resuelve, y está medido: **los leads del formulario nativo de
Meta nunca ven la landing.** «agendamiento - yaping» tiene 43 leads de formulario instantáneo de Meta y
21 con landing, de 109; «Evoluciona native» tiene 0 de Lead Ads y 31 con landing
(`02-CREATIVE.md:205`). El embudo `leadform` es, por definición, el de los que entran sin pasar por la
página — y el prototipo le dibuja una etapa «Clics a landing VSL» en el medio.

Y aunque el dato llegara, seguiría sin alcanzar: Conversion mide la landing **en agregado y por
dispositivo**; Acquisition necesita clics **por campaña**. Son dos cortes distintos del mismo evento, y
sólo el segundo requiere que el clic traiga consigo el anuncio del que vino.

Lo que hay que decidir: si `clics` se cae del embudo `leadform`, si se toma «link clicks» de Meta —que
es un clic en el anuncio, no una vista de la página, y por tanto **no es la misma métrica que
`sesiones` de Conversion**—, o si se instrumenta la landing con atribución de anuncio. Las tres son
respuestas distintas y ninguna es la que hay hoy.

### P-02 · Qué es «Completaron form», y por qué su fuente se apagó el 31 de agosto

**Corrijo al inventario, que dice que no existe.** El campo del CRM «Form Landing VSL» tiene exactamente
el vocabulario que esta etapa necesita —`Form incompleto sin agendar` 87, `Form completo sin agendar`
39, `Agendado` 121— sobre **247 contactos**; su último día es el **2026-08-31** y en la ventana de 14
días son **0** (`03-CONVERSION.md:73`; el cero de la ventana, también en
`01-ACQUISITION.md:230`). No es una fuente que nunca existió: es una que dejó de escribir.

Eso cambia la pregunta. No es «de dónde sacamos formularios completados» sino **qué se apagó el 31 de
agosto**, y hay que mirarlo en GoHighLevel y en la landing, no en esta base — es el mismo pendiente que
`02-CREATIVE.md:248` deja abierto para «VSL % máximo visto», que se cortó un día antes, el 30.

Y queda la distinción de forma: ese campo separa **iniciado** de **completado**, y la cadena de
Conversion mide el que empieza (`form`, «empiezan a llenarlo», `conversion.js:37`) mientras Acquisition
mide el que termina («Completaron form», `:16`). Son dos etapas, no una, y hoy cada departamento eligió
una distinta sin decirlo.

### P-03 · Por qué en Booking directo el formulario va ANTES de la landing

En `booking` el orden declarado es `contactos → forms → clics → agendados` (`:15`): primero completan
el formulario y después hacen clic a la landing con VSL. La cadena de Conversion va al revés —`sesiones`
→ `vsl` → `form`— y la señal escrita a mano en la propia pantalla de Acquisition también: «Fuga entre
formulario y landing VSL en Booking directo · Una parte de quienes completan el formulario no llega a
ver la VSL» (`AcquisitionView.jsx:132-135`).

O sea que el orden es intencional y describe un recorrido real —se agenda primero y se ve el video
después, que es el caso del widget de calendario—, pero es incompatible con el orden que el resto del
sistema asume. Hay que decidir si son dos recorridos genuinamente distintos o si uno de los dos órdenes
está mal, porque de eso depende qué significa «fuga» entre esas dos etapas.

### P-04 · Qué define un recorrido, y de dónde sale la pertenencia de una campaña

`c.f` asigna la campaña a mano (`:21-33`). Las tres opciones son incompatibles entre sí: el **objetivo
de campaña de Meta** (que hoy no tenemos, `01-ACQUISITION.md:246`), el **`mediumId` de GHL** —el
formulario o calendario por el que entró, poblado en toda la cohorte, pero ojo: el mismo `campaignId`
`120249633901590467` aparece con **dos `mediumId` distintos**
(`01-ACQUISITION.md:282`)—, o un **mapeo declarado a mano** que alguien mantiene.

La diferencia es medible: con `medium` salen dos caminos y medio; con `mediumId` sale un reparto más
fino que parte campañas por la mitad.

### P-05 · Cuál es la unidad de la fila: campaña, ad set o anuncio

La pantalla dice «N campañas» tres veces (A1-13) y el arreglo se llama `CAMPS`, pero en la ventana hay
varias campañas, varios anuncios y **1 solo id de ad set** (`01-ACQUISITION.md:195`). De la respuesta
depende cuántas filas tenga la tabla — y con el piso de 10 contactos, 3 (A1-12). El corte por ad set
además hoy sólo se puede hacer **por nombre**: el id existe en una minoría de los contactos y
corresponde a un solo ad set, mientras el nombre existe en casi todos y viene en la clave `utmMedium`,
cuyo nombre dice «medio» y cuyo contenido es «Advantage+ ON / America Hispano / 25-65» (regla 2 del §6,
`01-ACQUISITION.md:282`).

### P-06 · Dónde va la fila «sin anuncio», que el modelo de recorridos no admite

En el prototipo toda fila pertenece a una campaña y las siete campañas cubren el 100 % de los
contactos. En la base, **una parte de los contactos no trae `adId`** y ese segmento tiene la tasa de
agenda más alta de la tabla, en su mayoría los contactos de la campaña BOFU que entra por el widget de
calendario, donde la campaña sobrevive y el anuncio se pierde (`01-ACQUISITION.md:188`, regla 7 del §6 en `:292`).

El criterio ya está decidido en `lib/negocio/atribucionDelLead.ts:179-183` —el conteo va, para que las
filas sumen la cohorte; la tasa no va, porque junta categorías distintas— pero **el modelo de esta
pantalla no tiene dónde ponerla**: ni la tarjeta de embudo ni la tabla prevén una fila que se cuente y
no compita. Y hay una pregunta anterior: si esos contactos entran por el calendario, el recorrido al
que pertenecen es `booking`, así que la fila «sin anuncio» **no es transversal a los tres embudos**;
está concentrada en uno.

### P-07 · Si el gran total suma las etapas exclusivas de un recorrido

Hoy la decisión está tomada por omisión: `forms` no está en `g` (A1-14). Las dos salidas son legítimas
y hay que elegir una: publicar el total de `forms` como una cifra del único embudo que la tiene, o
dejarla fuera del encabezado y decir por qué.

### P-08 · Qué se dibuja cuando un recorrido o una etapa está en cero

El `Math.max(1, ...)` de `:91` sólo protege la etapa de entrada: las etapas derivadas sí caen a cero.
Hay guion `—` para los cocientes, pero no hay estado vacío diseñado para una tarjeta de embudo, una
tabla ni el bloque de calificados. Con datos reales, la mayoría de los anuncios de la ventana no llega
al piso de 10 contactos, y un embudo entero puede quedar en cero en una ventana de un día.

---

## 7 · Lo que corregí del inventario al comprobar las fuentes

- **`delta` tiene ocho puntos de llamada, no nueve.** Verificado con grep: `:146`, `:147`, `:148`,
  `:149`, `:150`, `:179`, `:188`, `:234`. El inventario de pantalla dice «las nueve llamadas pasan
  `false`»; el de modelo dice ocho y es el correcto.
- **El `slice(0, indexOf('agendados') + 1)` de `:210` no recorta ninguna columna hoy.** `agendados` es
  la última etapa de los tres embudos. Los dos inventarios lo describen como un corte activo; su
  función real es la restricción de A1-05.
- **El emparejamiento entre la ventana actual y la de comparación es por índice de arreglo** (`:240`) y
  `o.i` (`:88`) se escribe y no se lee nunca. No aparece en ninguno de los tres inventarios, y es el
  requisito A1-15.
- **La etapa `forms` sí tuvo fuente.** El inventario dice «no existe, no hay tabla de eventos de
  formulario». El campo del CRM «Form Landing VSL» trae el vocabulario exacto sobre 247 contactos y se
  apagó el 2026-08-31 (`03-CONVERSION.md:73`). Cambia la pregunta de «de dónde lo sacamos» a «qué se
  apagó».
- **La etapa `clics` ya tiene dueño declarado y proveedores nombrados en el prototipo**, y no es
  Acquisition: Conversion la mide como `sesiones` con `src:'Clarity'` (`conversion.js:35`) y Executive
  le adjudica «Visitas landing» a Conversion (`executive.js:25`). Los inventarios la plantean como una
  elección abierta de tecnología (Meta Pixel, GA4 o endpoint propio) sin registrar que el sistema ya
  asignó el dueño. Y el dato que lo vuelve estructural: **los leads de Lead Ads nunca ven la landing**
  (`02-CREATIVE.md:205`), así que la etapa es imposible en el embudo `leadform` por definición, no por
  falta de instrumentación.
