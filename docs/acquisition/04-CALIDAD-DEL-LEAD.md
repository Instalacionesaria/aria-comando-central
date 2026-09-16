# Acquisition · La calidad del lead: calificado, tramos de ICP y afinidad

> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.
> Las cifras marcadas **(medido el 2026-09-16)** son de este documento, tomadas contra producción
> con `node --env-file=.env.supabase scripts/supabase.mjs leer`, sobre los **184 contactos con
> `alta_en_el_crm` en los últimos 14 días**.

**Esto es lo que separa a Acquisition de un panel de anuncios.** Un panel de anuncios sabe cuánto
costó cada lead; esta pantalla pretende saber cuáles de esos leads sirven. Todo lo que dibuja de
calidad cuelga de dos cosas: una etapa llamada **calificado** y un puntaje llamado **afinidad ICP**.
La primera no está definida en ninguna parte del sistema —las pantallas que la usan la definen
distinto, **cinco lecturas**, y la del código que ya corre contra la base la pone al revés que las
demás—; el segundo se calcula con una fórmula de pesos `100/60/25` que **nadie justificó en ningún
archivo del repositorio ni en el maquetado original del que se portó**.

Y hay una buena noticia que el prototipo no sabía: **el puntaje de ICP existe de verdad en la base,
continuo, entero, de 0 a 100, en 180 de 184 contactos** (medido el 2026-09-16). Lo que no existe es
el corte que lo parte en tres tramos.

---

## 0 · Las dos cosas que este documento separa

| | **El calificado** | **La afinidad ICP** |
|---|---|---|
| Qué responde | ¿este lead merece una cita? | ¿cuánto se parece a nuestro cliente ideal? |
| Dónde vive en el prototipo | `acquisition.js:94`, un conteo | `acquisition.js:98`, un puntaje de 25 a 100 |
| Quién lo decide | nadie: cinco lecturas distintas en el producto (A4-18) | una fórmula sin autor (A4-13) |
| Qué hay hoy en la base | ninguna marca positiva; sí un vocabulario de **rechazo** medido | **«Puntaje \| ICP»**, `NUMERICAL`, 180 de 184 |

El prototipo las trata como una sola cadena: los calificados salen de los agendados y después se
reparten en tramos de ICP. Son dos decisiones distintas y hay que poder tomarlas por separado —hoy
están anudadas por un defecto concreto, que está en A4-07.

---

## 1 · El calificado

### A4-01 · El calificado es la última etapa que Acquisition publica, y el departamento se corta ahí

- **Rastro:** `lib/aios/acquisition.js:210` · `components/views/AcquisitionView.jsx:94-100`
- **Estado:** requisito de alcance, no de dato.

La tabla por campaña corta sus columnas de etapa buscando `agendados` por nombre
(`c.stages.slice(0, c.stages.indexOf('agendados') + 1)`), y la cabecera lo repite en la leyenda
`'hasta calificado'` (`:244`). La pantalla lo dice con todas las letras: **«Los totales llegan hasta
calificados, que es donde termina la responsabilidad de pauta»**. El §18.8 lo confirma desde el otro
lado: Acquisition no declara qué anuncio es el mejor para el negocio.

El requisito que esto fija es el alcance: **la cadena de Acquisition termina en el calificado y
nunca sigue hasta la venta.** Lo que pasa después —asistió, compró, cuánto— es de Sales, y mezclarlo
acá produce exactamente la conclusión que el §18.8 prohíbe.

### A4-02 · El calificado se deriva del agendado, no del contacto

- **Rastro:** `lib/aios/acquisition.js:94`
- **Fórmula del prototipo:** `o.calificados = Math.round(o.agendados * cap(c.calif * w.mod))`
- **Estado:** no existe. No hay marca de calificación en la base. Ver §4.

La calificación es la etapa **siguiente** al agendamiento. Toda la pantalla es coherente con eso: el
bloque de calificados cuelga de la etapa `agendados` y de ninguna otra (`:174`), su línea de
contexto toma la etiqueta de esa etapa (`:180`), y la columna `% calif.` de la tabla divide por
agendados (`:235`).

**La consecuencia hay que decirla porque es lo que se malinterpreta solo:** un calificado es un
subconjunto de los agendados, así que la tasa de calificación **no se puede comparar con una tasa
sobre contactos**. Un 61 % de calificación no significa que 61 de cada 100 leads sirven: significa
que 61 de cada 100 citas sirven.

### A4-03 · La tasa de calificación se mide por campaña, no por embudo ni por sistema

- **Rastro:** `lib/aios/acquisition.js:22, :24, :26, :28, :30, :32, :34` (el campo `calif`)
- **Estado:** no existe; los siete valores son inventados.

Los siete literales van de `.52` a `.72`, y dos campañas del mismo embudo tienen tasas distintas
(`Prospecting A` `.61` contra `Prospecting B` `.54`, las dos en `leadform`). Eso es el requisito:
**la calidad es un atributo de la campaña y comparar campañas del mismo embudo en esta métrica es
para lo que existe la pantalla.** Si la tasa fuera del embudo, la tabla por campaña no tendría
columna que mostrar.

**Y el prototipo tiene la dirección del cálculo al revés.** Acá la tasa es el dato de entrada y el
volumen se deriva de ella; en un sistema real se cuentan los dos volúmenes —agendados y
calificados— y **la tasa es el cociente**. El día que se porte, esta línea se invierte.

### A4-04 · `% calif.` es calificados sobre agendados

- **Rastro:** `lib/aios/acquisition.js:235` (tabla) · `:180` (tarjeta del embudo)
- **Fórmula:** `% calif. = calificados / agendados`
- **Estado:** calculable el día que exista la marca de calificación; **el denominador ya existe**.
  El informe midió 163 citas alcanzables en su ventana (`01-ACQUISITION.md` §4). Lo que falta es el
  numerador.

La misma proporción aparece dos veces con dos redacciones: en la tabla como columna `% calif.` y en
la tarjeta como **«{X}% de {etiqueta de la etapa}»**, que nombra su base en la misma frase. Esa
segunda forma es la que hay que conservar: un 54 % suelto no dice 54 % de qué, y en una pantalla
donde conviven tasas
sobre la etapa anterior y sobre la etapa de entrada (`S.rate`, `:168-171`), un porcentaje sin base
declarada se lee contra la base equivocada.

### A4-05 · Todo costo por calificado es la inversión ENTERA dividida por los calificados

- **Rastro:** `lib/aios/acquisition.js:120` (global) · `:201` (embudo) · `:181` (línea del bloque) ·
  `:236` (campaña)
- **Fórmula:** `costo por calificado = inversión de la ventana / calificados de la ventana`
- **Estado:** **incalculable hoy.** No hay una sola columna de gasto poblada en esta base
  (`01-ACQUISITION.md` §3.2).

Cuatro lugares, un solo criterio. El global **no es el promedio de los tres embudos**: es el
cociente de los dos totales (`g.cq = g.calificados ? g.inv / g.calificados : 0`), que es lo único
que un presupuesto puede leer. Y se publica pegado al volumen que lo produce —es el subtítulo del
KPI de Calificados (`:150`), no un KPI propio—, lo que evita que alguien compare costos sin ver
cuántos calificados los respaldan.

Es también el umbral del único consejo accionable de la pantalla: **«mientras el costo por
calificado se mantenga bajo $110»** (`lib/aios/acquisition-plan.js:21`). De dónde sale ese $110 no
está escrito en ninguna parte.

### A4-06 · Sin denominador no hay cifra: se dibuja una raya, nunca un cero

- **Rastro:** `lib/aios/acquisition.js:180, :181, :201, :235, :236`
- **Estado:** requisito de forma, ya resuelto en el prototipo. **Con una excepción, que es un
  defecto — ver A4-14.**

Cinco cocientes de calidad llevan la misma guarda `v ? … : '—'`. Es la regla de los dos ceros dicha
en código (`01-ACQUISITION.md` §6, regla 11): **una cifra que no se puede calcular no se dibuja como
cero**, porque un cero de costo por calificado se lee como «salió gratis» cuando significa «no hubo
calificados».

### A4-07 · Cada cifra de calificados abre la lista de los contactos que la componen

- **Rastro:** `lib/aios/acquisition.js:150` (KPI) · `:177-178` (tarjeta) · `:231-232` (tabla) ·
  contrato en `lib/aios/leads-group.js:79-85`
- **Estado:** el drill-down funciona contra un `POOL` de 14 contactos inventados
  (`leads-group.js:14-29`).

Las tres cifras de calificados llevan `data-leads`, `data-n` y `data-sub`, y son las tres únicas de
toda la pantalla que además llevan **`data-seg="alto"`**. El requisito es que **ningún conteo de
calificados sea un número sin cohorte detrás**.

**Y acá está el nudo entre las dos mitades de este documento, que es un defecto y no una decisión.**
Esas mismas tres cifras están dibujadas al lado de una barra que reparte a los calificados en
**tres** tramos (`:182`, `:238`). El drill-down filtra a **uno**: `sample()` se queda sólo con los
contactos cuyo puntaje cae en el tramo pedido (`leads-group.js:31-37`, con el corte de `:10`). O sea
que un usuario que vea «9 calificados» con una barra de tres colores y haga clic, recibe una lista
de los de tramo alto solamente. **O «calificado» significa «ICP alto» —y entonces la barra de tres
tramos no describe a los calificados— o son dos cosas distintas y el filtro está mal.** El prototipo
no lo decide, y hay que decidirlo antes de portarlo.

### A4-08 · Cuando no hay con qué comparar, la celda lo dice

- **Rastro:** `lib/aios/acquisition.js:234`
- **Estado:** requisito de honestidad, y es el único punto del módulo que llena el hueco.

`delta(...) || 'sin comparación'` en la celda de calificados. Los otros siete puntos de llamada de
`delta` dejan el espacio vacío, y un espacio vacío se lee como «no cambió» cuando significa «no hay
período anterior». La celda de calificados es la que lo escribe; el requisito es que **lo escriban
todas**.

---

## 2 · Los tres tramos de ICP y la barra que los dibuja

### A4-09 · Los calificados se parten en tres tramos de afinidad, y el reparto se publica

- **Rastro:** `lib/aios/acquisition.js:96-97` (cálculo) · `:182` y `:238` (dibujo)
- **Estado:** la FORMA es requisito; los 21 valores de `icp:{a,m,b}` son andamiaje. El dato de
  origen existe y **tiene otra forma**: es continuo. Ver §4.

El sistema real tiene que poder decir, de los calificados de una campaña, **cuántos son de afinidad
alta, cuántos media y cuántos baja** — no sólo un promedio. Un promedio de 55 % puede ser veinte
leads mediocres o diez excelentes y diez malos, y son dos campañas que se compran distinto.

Lo que es andamiaje son los valores y, sobre todo, **la decisión de que sean tres tramos con cortes
que nadie declaró**. Los 21 literales suman exactamente `1,00` en las siete campañas —verificado uno
por uno—, que es justamente lo que delata que fueron escritos a mano.

### A4-10 · Los tres tramos suman exactamente los calificados: el tercero es el residuo

- **Rastro:** `lib/aios/acquisition.js:96-97`
- **Fórmula:** `icpA = round(q · a)` · `icpM = round(q · m)` · `icpB = max(0, q − icpA − icpM)`
- **Estado:** requisito de invariante, bien resuelto en el prototipo y **hay que conservarlo**.

No son tres redondeos independientes: los dos primeros se calculan y el tercero es lo que sobra. Por
eso `icpA + icpM + icpB === calificados` **siempre**, y por eso la barra llena el 100 % de su ancho
sin hueco. Con tres redondeos sueltos, una campaña con 7 calificados muestra 8 en la barra y el
usuario suma una columna que no cuadra con la de al lado.

**El precio de la regla está medido, y es alto en volúmenes chicos.** Como los dos primeros tramos
redondean hacia abajo con proporciones menores a `0,5`, el residuo se lleva todo. Simulando la
aritmética exacta del módulo en el período por omisión (7 días, `m = 1.04`):

| Campaña | Calificados | A/M/B | Afinidad que dibuja | Afinidad de sus proporciones |
|---|---|---|---|---|
| Prospecting A | 5 | 2/2/1 | 69 % | 64,4 % |
| Prospecting B | 2 | 0/1/1 | **43 %** | 54,7 % |
| Retargeting 90d | 1 | 0/0/1 | **25 %** | 72,4 % |
| Remarketing interacción | 1 | 0/0/1 | **25 %** | 69,4 % |
| Remarketing web | 4 | 2/2/0 | 80 % | 72,8 % |

Con **un** calificado, los tres tramos sólo pueden dar `0/0/1`, `0/1/0` o `1/0/0`, así que la
afinidad sólo puede valer 25, 60 o 100. Y en «Hoy» (`p1`, 1 día) **tres de las siete campañas
muestran 0 % y las otras cuatro muestran 25 %**: la columna entera de calidad se desploma por
aritmética, no por negocio. Un sistema real con el piso de 10 contactos del resto de la casa
(`lib/negocio/indicadoresDeCitas.ts:300`) va a estar en este régimen casi siempre.

### A4-11 · La barra se normaliza sobre la suma de los tres tramos, no sobre los calificados

- **Rastro:** `lib/aios/acquisition.js:136-141`
- **Fórmula:** `p(n) = t ? (n/t)·100 : 0`, con `t = a + m + b`
- **Estado:** requisito, y la guarda `t ? … : 0` es parte de él.

En el prototipo las dos bases coinciden por el invariante de A4-10, pero la función **se protege
sola**: con cero calificados la barra queda vacía en vez de romperse. El día que los tres tramos
salgan de una consulta y puedan no cerrar contra el total, la barra sigue siendo una barra.

Y porque suma 100 % siempre, **es comparable entre filas**: la misma función se usa en la tarjeta del
embudo y en la celda de la tabla, con distinto ancho físico —`.acq-icp-cell .acq-icp { width: 78px }`
(`app/aios.css:1814`)— y el mismo ancho relativo.

### A4-12 · El tramo bajo se pinta con el color del carril vacío

- **Rastro:** `lib/aios/acquisition.js:182` y `:238` · colores en `app/aios.css:1793-1801`
- **Estado:** requisito de forma; el color del tercer tramo es una decisión a revisar.

Cuatro píxeles de alto, tres segmentos, `gap: 2px`. Los tramos alto y medio se pintan con la misma
tinta a dos opacidades —`rgb(var(--c-exec) / 0.75)` y `/ 0.42)`, el dorado de Executive— y el tramo
bajo con **otra** tinta al 13 %: `rgb(var(--c-nube) / 0.13)`, sobre un carril de fondo que es
`rgb(var(--c-nube) / 0.07)`. O sea el mismo azul al 13 % sobre el mismo azul al 7 %.

**El tramo bajo es, visualmente, casi el carril vacío.** Es una decisión defendible —la barra se lee
como «cuánto de esto es bueno»— pero conviene saber su precio con los datos reales: aplicando los
cortes que ya existen en el código (75/50, ver A4-17), el tramo bajo son **84 de los 180 contactos
con puntaje** (medido el 2026-09-16). La mitad de la población se dibuja con el color del fondo.

---

## 3 · La fórmula de afinidad, y los pesos que nadie justificó

### A4-13 · Existe un puntaje único de afinidad por campaña y por embudo

- **Rastro:** `lib/aios/acquisition.js:98` (campaña) y `:111` (embudo) · mostrado en `:181` (la línea
  «ICP {N}%» del bloque de calificados) y `:237` (la columna «Afinidad ICP» de la tabla)
- **Estado:** reemplazable hoy, y con mejor dato que el inventado. Ver §4.

La fórmula del prototipo, transcripta tal cual:

```js
o.icp = q ? (o.icpA*100 + o.icpM*60 + o.icpB*25) / q : 0;
```

y en el total del embudo, la misma sobre los tramos agregados:

```js
t.icp = t.calificados ? (t.icpA*100 + t.icpM*60 + t.icpB*25) / t.calificados : 0;
```

**El requisito es que exista un escalar comparable entre filas.** La barra es un histograma y un
histograma no se ordena: para poder decir «esta campaña trae mejores leads que aquélla» hace falta
un número. La guarda `q ? … : 0` también es requisito: sin calificados no hay afinidad.

**Los pesos `100 / 60 / 25` son del prototipo y nadie los justificó.** No hay un comentario, una
constante con nombre ni una nota al lado. Están escritos idénticos en el maquetado original
(`aios-command-center_1.html:5437` y `:5450`), sin explicación tampoco, así que el port es fiel y el
origen es el mismo: se eligieron a ojo. **Un promedio ponderado con pesos elegidos a ojo produce un
número que parece objetivo** — sale con dos decimales, se puede ordenar, se puede comparar entre
campañas y se dibuja en negrita al lado de una barra. Nada de eso lo hace una medición. Queda como
pregunta abierta (P-3), no como requisito.

Y los pesos traen un defecto que nadie pidió: **la afinidad tiene un piso de 25 %.** Una campaña
cuyos calificados estén todos en el tramo bajo da 25, nunca 0, así que la columna «Afinidad ICP» va
de 25 a 100 y no de 0 a 100 — **salvo cuando no hay calificados, que da 0**. La escala real es
`{0} ∪ [25, 100]`, con un hueco entre 0 y 25 que ningún lector puede adivinar y que hace que un 25 %
y un 0 % —«todos malos» y «no hubo»— se vean como vecinos en la misma escala cuando son categorías
distintas.

### A4-14 · La afinidad es la ÚNICA cifra de calidad que dibuja un cero en vez de una raya

- **Rastro:** `lib/aios/acquisition.js:181` y `:237`, contra la guarda de A4-06 en `:180, :201, :235,
  :236`
- **Estado:** defecto del prototipo, comprobado. El requisito es el contrario de lo que hace.

Las dos salidas de la afinidad son `Math.round(t.icp) + '%'` y `Math.round(r.icp) + '%'`, **sin
guarda**. Con cero calificados, `icp` vale 0 por la guarda de `:98`, y la pantalla escribe **«ICP
0 %»** y una barra vacía al lado — mientras la celda de «Costo/calif.» de esa misma fila escribe
«—». La misma fila dice «no se puede calcular» del dinero y «cero» de la calidad, sobre la misma
ausencia de calificados.

### A4-15 · La afinidad del embudo se recalcula sobre los tramos agregados; no se promedian las de sus campañas

- **Rastro:** `lib/aios/acquisition.js:101-111`, y en particular `:111`
- **Estado:** requisito, y es la distinción que salva la pantalla de una cifra falsa.

Inversión, etapas, calificados y los tres tramos se acumulan sumando (`:106-110`); la afinidad **se
vuelve a calcular** con la misma fórmula sobre los tramos ya sumados. Un promedio de promedios le
daría a una campaña de 3 calificados el mismo peso que a una de 300, que es exactamente el error que
hace que un embudo entero parezca mejor por culpa de su campaña más chica.

La regla general que hay que llevarse: **los volúmenes se suman, las proporciones se recalculan.**

### A4-16 · La afinidad se publica como entero seguido de `%`

- **Rastro:** `lib/aios/acquisition.js:181`, `:237`
- **Estado:** requisito de forma, coherente con el resto de la pantalla (`pf`, `:43`).

Ninguna cifra de esta pantalla tiene decimales.

---

## 4 · Qué hay HOY: el puntaje de ICP existe, y es mejor que el inventado

### 4.1 · El vocabulario, medido

El CRM ya calcula un puntaje de ICP por contacto. Su nombre exacto es **«Puntaje | ICP»**, tipo
**`NUMERICAL`**, identificador `9HXxl5DW6aayQgKUPiOS`, y vive en `negocio.contactos.campos_del_crm`
—un `jsonb` con clave por identificador de campo—, no en una columna propia.

Medido el 2026-09-16 sobre los 184 contactos de la ventana de 14 días:

| | |
|---|---|
| Contactos con el campo escrito | **180 de 184 — 97,8 %** |
| Forma del valor | **entero**, los 180; ni un decimal, ni un no numérico |
| Rango | **0 a 100** |
| Valores distintos | 65 |
| Promedio | 48,6 — **54,7** excluyendo los 20 ceros, que no son afinidad cero (§4.4) |

Con esto, la afinidad ICP **se puede publicar hoy sin inventar nada**: promediar un puntaje continuo
no necesita cortes ni pesos. Es el mismo criterio que ya dejó escrito `01-ACQUISITION.md` §3.5.

**Por qué son 184 y no los 233 del informe, y por qué importa acá.** La ventana rueda: la del informe
fue 2026-09-01 → 2026-09-13 y ésta es 2026-09-02 → 2026-09-16. Pero además **no entró ni un contacto
al CRM desde el 2026-09-13 05:13 UTC**, mientras el barrido siguió corriendo —`max(sincronizado_el)`
es 2026-09-16 15:40 UTC—. O sea que la ventana avanzó sobre una cola vacía de tres días. Para una
pantalla que promedia calidad sobre una ventana móvil, eso no baja la afinidad, pero sí **diluye
cualquier tasa cuyo denominador sea la ventana**, y la pantalla tiene que poder decir hasta qué
fecha hay datos y no sólo desde cuándo mide (`01-ACQUISITION.md` §6, regla 6).

**Y hay una trampa de nombres que conviene decir antes de que confunda a alguien:** en este
repositorio «ICP» significa dos cosas distintas. La pantalla `icp` de Fundaciones es **ICP & Oferta**
—un documento que describe al cliente ideal, `lib/fundaciones/herramientas.ts:281`—. Lo que
Acquisition necesita es el otro: un **puntaje por contacto**. No se cruzan en ninguna tabla.

### 4.2 · El campo se lee por nombre, y eso tiene un precio declarado

- **Rastro:** `lib/negocio/camposDelCrm.ts:307` (`campoPorNombre`)
- **Estado:** el mecanismo existe y ya lo usan dos cifras de producción
  (`consumoDelPrecall.ts:150`, `indicadoresDeCitas.ts:219`).

Los valores se guardan por identificador para que renombrar un campo en el CRM no congele nada, así
que el nombre es lo único legible que hay. El precio está escrito en el archivo y vale igual para
Acquisition: **si alguien renombra «Puntaje | ICP» en el CRM, la lectura devuelve `null`** — y quien
la consume tiene que poder decir «no sé» en vez de «cero». En esta pantalla, decir cero es decir
«afinidad nula», que es el defecto de A4-14 multiplicado por todos los contactos.

### 4.3 · Hay diez campos de puntaje en el catálogo y sólo uno está poblado

Buscados por nombre en `negocio.campos_del_crm` (`icp`, `puntaje`, `score`) y medidos el
2026-09-16 sobre los 184 contactos de la ventana:

| Campo del CRM | Tipo | Contactos con valor |
|---|---|---|
| **Puntaje \| ICP** | `NUMERICAL` | **180** |
| Pre-Score \| ICP | `SINGLE_OPTIONS` | 0 |
| Pre-Score \| Meta Lead Ads | `SINGLE_OPTIONS` | 0 |
| Puntaje \| Meta Lead Ads | `NUMERICAL` | 0 |
| Puntaje Final | `NUMERICAL` | 0 |
| Puntaje Survey HT | `TEXT` | 0 |
| puntaje_encaje_icp | `NUMERICAL` | 0 |
| puntaje_interaccion | `NUMERICAL` | 0 |
| Lead Score | `SINGLE_OPTIONS` | 0 |
| perfil_icp | `SINGLE_OPTIONS` | 0 |

Son ceros medidos, del segundo tipo de la regla 11 (`01-ACQUISITION.md` §6): **el campo existe en el
catálogo y nadie lo llenó en la ventana**, que no es lo mismo que no existir. Importa para esta
pantalla porque `Puntaje Final` y `puntaje_encaje_icp` son, por el nombre, candidatos a ser la
afinidad que la
pantalla necesita — y hoy no traen nada.

**Y hay una columna vacía que conviene señalar:** `negocio.contactos` tiene una columna `score` y
**cero no nulos en los 585 contactos** (medido el 2026-09-16). El lugar natural del puntaje está
reservado y vacío; el dato vive en el `jsonb`.

### 4.4 · Los ceros del puntaje no son afinidad cero: son un cambio de régimen con fecha

**20 de los 180 valores son exactamente `0`, y es el valor más frecuente de todos.** Antes de
tratarlos como «afinidad nula», su reparto por día (medido el 2026-09-16):

| Día de alta | En cero |
|---|---|
| 2026-09-02 | 3 |
| 2026-09-03 | **17** |
| 2026-09-04 en adelante | **0** |

**Los ceros se terminan de golpe el 3 de septiembre y no vuelven a aparecer.** Nadie dejó de tener
afinidad un jueves: es el puntuador que todavía no estaba corriendo. Es el mismo patrón que
`lib/negocio/consumoDelPrecall.ts` ya documentó para otro campo —«Sin abrir (0 %)» renombrado a
«Nada» el 2026-09-08, con la advertencia de que ramas distintas dibujarían un derrumbe fantasma—.

Si esos 20 se cuentan como tramo bajo, **la afinidad de los primeros dos días de cualquier ventana
que los toque baja por una razón que no es de negocio**. El cero de este campo es «sin puntuar», no
«puntuó cero».

### 4.5 · El puntaje por anuncio ya se puede medir, y la fila «sin anuncio» vuelve a ganar

Medido el 2026-09-16, por `adId` de `atribucion_primera`, sobre los 184 contactos:

| Anuncio | `adId` | Contactos | ICP prom. | Alto/Medio/Bajo (75/50) | Agendaron |
|---|---|---|---|---|---|
| agendamiento - yaping | …901580467 | 83 | 41,5 | 10 / 26 / 47 | 39 |
| **(sin adId)** | — | **47** | **71,6** | **23 / 15 / 5** | **38** |
| El app | …901550467 | 35 | 45,7 | 3 / 14 / 18 | 18 |
| economia us latino | …901570467 | 14 | 27,5 | 1 / 1 / 12 | 6 |
| El app | …217700467 | 2 | 49,0 | 0 / 1 / 1 | 1 |
| economia us latino | …217690467 | 2 | 38,0 | 0 / 1 / 1 | 1 |
| agendamiento - yaping1 | …217680467 | 1 | 68,0 | 0 / 1 / 0 | 0 |

Los promedios de la columna «ICP prom.» **incluyen los 20 ceros del §4.4, y 18 de esos 20 caen en un
solo anuncio**: sin ellos, «agendamiento - yaping» pasa de 41,5 a **53,0** y se cruza por encima de
«El app» (45,7). Es la primera consecuencia práctica de no decidir qué significa un cero: **cambia el
orden de la tabla.**

**La regla 7 del `01-ACQUISITION.md` §6 vale también para la calidad, y hay que decirlo acá porque la
regla está escrita para las tasas de agendamiento.** La fila sin anuncio no sólo agenda más: tiene
**el mejor ICP de la tabla, treinta puntos por encima del anuncio de mayor volumen** (71,6 contra
41,5), y se lleva **23 de los 37 contactos de tramo alto de toda la ventana**. Dibujada como una fila
más de la columna «Afinidad ICP», esa fila dice que el mejor anuncio es ninguno.
Lo que pasa en realidad es que son en su mayoría los contactos de la
campaña BOFU de retargeting que entran por el widget de calendario —gente que ya conocía la oferta y
cuyo `adId` el widget no pasa—. **El conteo va; la afinidad de esa fila no compite.**

### 4.6 · No hay marca de «calificado», pero sí hay un vocabulario de rechazo, medido y ya en uso

Esto corrige al inventario que encargó este documento: **no es cierto que la base no tenga ninguna
señal de calificación.** Tiene la negativa, es operativa y ya la usa una cifra de producción.

`lib/ghl/contrato.ts:231-238` declara `ETIQUETAS_DE_DESCARTE` con su censo escrito
(`:217-218`), y `lib/negocio/indicadoresDeCitas.ts:322-327` la usa para separar las citas que
cancelaron porque el lead se arrepintió de las que canceló la casa **porque decidió que no
calificaba**. Medido el 2026-09-16 sobre la ventana:

| Etiqueta | Contactos |
|---|---|
| `icp_rechazado` | **62 de 184** |
| `rechazado` | 32 |
| `rechazado_positivo` | 2 |
| `rechazado_negativo` | 1 |

Un tercio de la cohorte lleva escrito que **no** califica por ICP. Eso no es un calificado, pero es
la mitad del par y está disponible hoy.

---

## 5 · El corte por tramos: quién decide hoy quién es alto, medio o bajo

### A4-17 · El único corte escrito en todo el sistema está en el cajón de contactos, y Acquisition no lo declara

- **Rastro:** `lib/aios/leads-group.js:10`
- **Fórmula:** `SEG = v => v >= 75 ? 'alto' : v >= 50 ? 'medio' : 'bajo'`
- **Estado:** el corte existe en código y **no tiene justificación escrita en ninguna parte**.

Acquisition nunca declara un corte: sus tramos vienen dados como proporciones inventadas
(`icp:{a,m,b}`), así que el módulo **jamás toca un puntaje**. El único lugar donde un número se
convierte en tramo es el cajón de contactos, que es de otra pantalla. Cuando el KPI de Calificados
pasa `data-seg="alto"` (`acquisition.js:150`), está adoptando en silencio el 75 de `leads-group.js`.

Aplicados a los datos reales (medido el 2026-09-16, sobre los 180 con puntaje): **alto 37 (20,6 %),
medio 59 (32,8 %), bajo 84 (46,7 %)**.

### A4-18 · «Calificado» ya significa cinco cosas distintas en este producto, y una de ellas es la contraria

Esto no es un detalle de vocabulario: es lo primero que hay que resolver, porque las cinco
definiciones producen cinco números distintos que hoy se publican en pantallas que se enlazan entre
sí.

| Dónde | Qué significa «calificado» | Rastro |
|---|---|---|
| **Acquisition** | una fracción de los **agendados**, por campaña | `acquisition.js:94` |
| **Acquisition, al abrir el cajón** | los de **ICP ≥ 75** | `acquisition.js:150, :178, :232` + `leads-group.js:10` |
| **Leads Portal** | los tramos de ICP **son** la calificación: alto = «Calificado alto», medio = «Calificado medio», **bajo = «No calificado»**, sin puntaje = «Sin calificar» | `leads-portal.js:143` |
| **Conversion** | `0,63` de las **citas**, constante única para todas | `conversion.js:163-166` |
| **Pipeline del setter (código real, no prototipo)** | **«Calificado sin agendar»**: califica y **todavía no agendó** | `lib/negocio/etapasDelSetter.ts:48` |

La última es la que da vuelta el modelo. En el sistema operativo —el que ya corre contra la base— el
recorrido del setter es `nuevo → en_calificacion → calificado → … → agendado`, con el comentario
escrito al lado: *«La columna caliente: califica y todavía no agendó»*. **El calificado es anterior
al agendado.** En Acquisition es posterior (A4-02). Son dos poblaciones que casi no se solapan, con
el mismo nombre, en el mismo producto.

Dos detalles más, medidos, que muestran lo desordenado que está el vocabulario:

- **Conversion parte las citas en «Calificadas» y «No calificadas» y les asigna `data-seg` `alto` y
  `bajo`** (`conversion.js:208-210`). El tramo **medio no aparece en ninguno de los dos cajones**:
  los dos conteos suman todas las citas, pero las dos listas que abren no cubren a nadie del medio.
- **El propio dato de la maqueta de Leads Portal se contradice:** `TechNova` tiene `icp:79` y
  `seg:'medio'` (`leads-portal.js:43`), mientras `Diego Paredes` tiene `icp:79` y `seg:'alto'`
  (`:63`). Dos contactos con el mismo puntaje en tramos distintos, porque el tramo está **guardado**
  al lado del puntaje en vez de derivarse de él. El requisito que eso revela: **el tramo se deriva
  del puntaje en el momento de dibujar, y no se guarda.**

### A4-19 · Los datos ya proponen dos cortes candidatos, y no son los que el código usa

Ninguno de estos es un requisito —el corte es una decisión de negocio, no una consulta—, pero
llegan medidos y conviene que estén sobre la mesa cuando alguien la tome.

**Candidato 1: 60, el techo del rechazo.** Cruzando el puntaje con la etiqueta `icp_rechazado`
(medido el 2026-09-16, 180 contactos con puntaje):

| Tramo del puntaje | Contactos | Con `icp_rechazado` | % |
|---|---|---|---|
| 0 (sin puntuar, §4.4) | 20 | 0 | 0 % |
| 10–19 | 7 | 5 | 71,4 % |
| 20–29 | 24 | 13 | 54,2 % |
| 30–39 | 16 | 11 | 68,8 % |
| 40–49 | 17 | 12 | 70,6 % |
| 50–59 | 29 | 21 | 72,4 % |
| **60 y más** | **67** | **0** | **0 %** |

**La casa nunca rechaza por ICP a un contacto de 60 o más: cero de 67.** Y debajo de 60 rechaza a
dos de cada tres. El puntaje máximo de un contacto rechazado es **59**. O sea que ya hay un corte
operando, lo puso alguien, no está escrito en ningún archivo de este repositorio y **no es el 75 del
código**.

**Candidato 2: 75, donde salta el agendamiento.** Con el corte que sí está escrito:

| Tramo (75/50) | Contactos | Agendaron | Tasa |
|---|---|---|---|
| Alto (≥ 75) | 37 | 28 | **75,7 %** |
| Medio (50–74) | 59 | 30 | 50,8 % |
| Bajo (< 50) | 64 | 34 | 53,1 % |
| Cero (sin puntuar) | 20 | 7 | 35,0 % |

El tramo alto agenda 25 puntos por encima del medio y 23 por encima del bajo — **y medio y bajo son
indistinguibles entre sí** (50,8 contra 53,1, sobre 59 y 64 contactos). Eso es un argumento contra
los tres tramos tanto como a favor del 75: en agendamiento, los datos de hoy sostienen **dos**
grupos, no tres.

Los dos candidatos no coinciden, y eso también es información: **60 es donde la casa deja de
rechazar y 75 es donde el lead empieza a agendar distinto.** Son dos preguntas distintas y pueden
tener dos respuestas distintas.

---

## 6 · Preguntas abiertas

**P-1 · Qué es un «calificado», y quién lo marca.** Es la métrica que cierra la pantalla —KPI,
encabezado de embudo, bloque bajo agendados, dos columnas de la tabla y el umbral de $110 del plan—
y hoy tiene cinco definiciones incompatibles (A4-18), una de ellas al revés de las otras. Las
opciones sobre la mesa: un corte del puntaje de ICP, una salida registrada por el closer después de
la cita, o una marca que el setter pone antes de agendar. El §18.7 pide el costo por calificado
**«cuando Business Intelligence exponga la calificación»** — así que la decisión no es de esta
pantalla, pero sin ella esta pantalla no tiene su última columna.

**P-2 · Si la calificación se mide sobre agendados o sobre contactos.** El prototipo la mide sobre
agendados (`acquisition.js:94`) y el pipeline del setter la coloca antes de agendar
(`etapasDelSetter.ts:48`). No es una diferencia de redacción: cambia el denominador de `% calif.`, el
alcance del departamento y qué significa el costo por calificado.

**P-3 · De dónde salen los pesos `100 / 60 / 25`.** No hay un comentario, una constante con nombre ni
una nota en el módulo, ni en el maquetado original del que se portó. Con pesos distintos —por
ejemplo `100/50/0`— el mismo reparto da otro número y otro orden de campañas. Y los pesos actuales
imponen un piso de 25 % que nadie pidió (A4-13).

**P-4 · Si la afinidad sigue siendo un ponderado de tramos o pasa a ser el promedio del puntaje.** Son
dos cifras distintas para la misma columna. El puntaje real viene continuo y está en 180 de 184
contactos, así que promediarlo directo **no necesita inventar cortes ni pesos** y no tiene piso. Lo
que se pierde es la barra: un promedio no dice si la campaña trae leads parejos o dos poblaciones
mezcladas.

**P-5 · Dónde se cortan los tramos, y si siguen siendo tres.** Los cortes 75/50 están escritos en
`leads-group.js:10` y nunca en Acquisition; los datos proponen 60 (techo del rechazo) y 75 (salto del
agendamiento), y en agendamiento sostienen dos grupos, no tres (A4-19). Adoptar el 75/50 por
omisión es adoptar un umbral de otra pantalla sin decidirlo.

**P-6 · Qué se hace con los 20 ceros.** Son «sin puntuar» y no «afinidad cero» (§4.4), y hoy caerían
en el tramo bajo, hundiendo la afinidad de los primeros dos días de cualquier ventana que los toque.
¿Van a un cuarto estado «sin calificar» —como el que Leads Portal ya dibuja (`leads-portal.js:143`)—
o se excluyen del denominador?

**P-7 · Qué se dibuja cuando no hay calificados.** Hoy la afinidad escribe «0 %» donde el resto de la
fila escribe «—» (A4-14), y la barra queda vacía al lado. Un 0 % en una escala que empieza en 25 es
imposible de leer.

**P-8 · Si el drill-down de calificados filtra a un tramo o entrega la cohorte entera.** Las tres
cifras de calificados pasan `data-seg="alto"` (A4-07) y están dibujadas al lado de una barra de tres
tramos. Hoy la lista que abre no es la cohorte que la cifra cuenta.

**P-9 · De dónde sale el umbral de $110 del plan.** `acquisition-plan.js:21` condiciona subir
presupuesto a que el costo por calificado se mantenga bajo $110. Es el único umbral accionable de la
pantalla, no tiene origen escrito, y el §18.10 prohíbe emitir esa recomendación en solitario.

**P-10 · Cuál de los números de afinidad del prototipo es el que se quiso decir.** Los que la
pantalla publica sobre la misma campaña no coinciden entre sí: la señal dice **54 %**
(`AcquisitionView.jsx:119`), el plan dice **43 %** (`acquisition-plan.js:11`) y la tabla, en el
período por omisión, dibuja **43 %**. El 54 es el ponderado de las proporciones y el 43 es el
ponderado de los tramos ya redondeados: **son la misma fórmula en dos momentos del cálculo.** Peor:
la misma señal dice que el retargeting está en **72 %** y la tabla lo dibuja en **25 %** (A4-10), y
el plan lo llama el de mayor afinidad mientras la pantalla lo muestra en el piso de la escala. La
frase «la mitad que el retargeting» del plan no es cierta bajo ninguna de las dos lecturas.

**P-11 · Quién es dueño de la definición, entre las pantallas que la publican.** Conversion
calcula sus calificadas con una constante propia y cierra su lectura con «Corresponde a Sales»
(`conversion.js:500, :517`); Creative trae `calificados` por pieza (`creative.js:8, :10, :12`);
Executive publica «ICP alto» como una **proporción** que sube y baja (`executive.js:180`) y Leads
Portal como un **conteo** (`:199`). Cinco pantallas, cinco formas de publicar lo mismo. Mientras no
haya una sola definición, cualquier cruce entre departamentos compara números que no son
comparables.
