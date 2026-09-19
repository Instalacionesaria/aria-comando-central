# La biblioteca partida en dos, y los cinco criterios de orden

> Requisitos derivados de `lib/aios/creative.js:103-204` y de `components/views/CreativeView.jsx:55-92`.
> El prototipo todavía existe al escribirse esto; las citas describen lo que la maqueta dibuja.

---

## 1 · La decisión de producto que hay debajo

### C3-01 · La pantalla ORDENA piezas por un criterio elegible

**Qué es** · La pieza no tiene un puntaje único. La pantalla deja elegir por qué criterio ordenar, y
todo lo demás —la partición, la cabecera, el veredicto de cada tarjeta— se recalcula sobre ese
criterio.
**Rastro** · `lib/aios/creative.js:103` (`SORT`), `:104` (el criterio inicial), `:130-139`
(`renderSort`), `:188-204` (`renderLibrary`).
**Estado** · **Requisito, y es la decisión central de la pantalla.** Sobrevive entera al borrado de
los datos falsos: lo que cambia es la lista de criterios (`C3-02`) y el corte (`C3-05`).

> Por qué importa que sea elegible y no fijo: una pieza puede traer mucha gente y mala gente, o poca y
> muy buena. El § 2.5 del documento lo dice: *«Un anuncio con bajo CTR puede seguir siendo valioso si
> genera mejores ICP, más ventas o mayor revenue.»* Un puntaje único escondería justo eso.

### C3-02 · Los cinco criterios del prototipo, y qué queda de ellos

**Rastro** · `lib/aios/creative.js:103`: `['calificados','agendas','hookRate','retention','alcance']`,
con `agendas` por omisión (`:104`). Las etiquetas salen de `CRIT` (`:80-89`).

| criterio del prototipo | estado |
|---|---|
| `calificados` | **se reemplaza** por el ICP promedio (`C2-09`, `C2-16`): no hay definición de «calificado» en el sistema |
| `agendas` | **queda**, y es el mejor candidato a criterio por omisión (`C2-18`) |
| `hookRate` | **queda**, construible al guardar el desglose (`C2-10`) |
| `retention` | **se borra**: no tiene fuente por ninguna vía (`C14-05`) |
| `alcance` | **se borra**: no se agrega (`C2-05`) |

Y `CRIT` declara tres criterios más —`dm`, `clickWeb`, `cierres` (`:82`, `:84`, `:85`)— que **no están
en `SORT`**, o sea que están definidos y son inalcanzables. Son andamiaje: ver
`09-LO-QUE-NO-ES-UN-REQUISITO.md`.

### C3-03 · Los criterios nuevos que la medición habilita

`linkCtr`, `landingPageViewRate` y `cpl` no existen en el prototipo y son ordenables con el mismo
mecanismo. **Lo que no se puede ordenar es una cifra que viaja `null` para la mayoría de las piezas**:
un orden por hook rate con 27 de 32 piezas en `null` es una lista de cinco elementos con veintisiete
huecos, y la pantalla tiene que decirlo en vez de dibujarla.

---

## 2 · La partición, que es donde está el defecto más caro

### C3-04 · La biblioteca se parte en «Funciona» y «No funciona»

**Qué es** · Dos rejillas, con encabezado propio y conteo.
**Rastro** · `components/views/CreativeView.jsx:75-92`; `lib/aios/creative.js:188-204`.
**Rótulos literales** · «Funciona» / «No funciona»; el subtítulo del bloque malo es **«bajo el
promedio — pausar o iterar»** (`:197`); el del bueno, «sobre el promedio de X unidades» (`:196`); el
conteo, «N piezas» (`:198-199`); el vacío, «Sin piezas en este grupo.» (`:205`).
**Estado** · **La forma es requisito** —partir en dos manda a hacer algo, que es más que ordenar— y
**el corte es un defecto**.

### C3-05 · El corte por el PROMEDIO invierte el veredicto cuando se mezclan etapas

**Qué es** · El prototipo parte por el promedio del criterio elegido sobre las piezas visibles.
**Rastro** · `lib/aios/creative.js:188-197`.
**Estado** · **Con los datos reales, la pantalla recomendaría pausar lo que alimenta el embudo.**
Medido el 2026-09-18, ventana de 30 días, ordenando por tasa de agenda:

| pieza | etapa | contactos | tasa |
|---|---|---:|---:|
| `evoluciona native` | **BOFU** | 39 | 77 % |
| `agendamiento - yaping - 23/07` | TOFU | 65 | 57 % |
| `agendamiento - yaping` | TOFU | 112 | 43 % |
| `el app` | TOFU | 59 | 39 % |
| `economia us latino` | TOFU | 26 | 31 % |

El promedio de las cinco es 49 %. Caen bajo él **las tres piezas TOFU que traen 197 de los 301
contactos** — el 65 % del volumen —, y la pantalla las rotula «bajo el promedio · pausar o iterar».

Un creativo de BOFU le habla a gente que ya conoce la oferta; uno de TOFU, a desconocidos. **Que el
primero agende más no es una virtud de la pieza: es la etapa.** Por eso la regla 3 de
`docs/estado actual/02-CREATIVE.md` prohíbe compararlos, y por eso el corte tiene que ser **dentro de
la etapa** (`C3-06`).

### C3-06 · El corte se hace DENTRO de cada etapa, y nunca entre etapas

**Fórmula** · Las piezas se agrupan primero por etapa (`C1-10`) y el promedio se calcula por grupo.
Una pieza sin etapa no entra en ningún promedio de otras: forma su propio grupo.
**Estado** · Construible hoy. Es la regla 3 convertida en maquetado.

### C3-P01 · Si el promedio es el corte correcto, aun dentro de la etapa

El promedio es sensible a los extremos y, con cinco piezas, una sola mala lo arrastra. La mediana
partiría siempre por la mitad, que tiene su propio problema: **con la mediana siempre hay piezas en
«No funciona», aunque todas anden bien.**

No hay una respuesta medida. Lo que sí está decidido es que el corte **se declara en pantalla** —el
prototipo ya lo hace, «sobre el promedio de X»— para que nadie lea «No funciona» como un juicio
absoluto.

### C3-07 · «No funciona» no puede decir «pausar»

**Qué es** · El literal del prototipo es «bajo el promedio — **pausar o iterar**».
**Estado** · **La decisión de pausar es del § 18.10 y requiere validación ejecutiva**, y Creative es
de sólo lectura: propone, y la persona ejecuta en Meta. El rótulo tiene que describir el hecho —«bajo
el promedio de su etapa»— y no dar la orden. Es la misma corrección que hizo Acquisition al pasar de
«cuáles sirven» a «cuánto vale esa cifra».

---

## 3 · La tarjeta

### C3-08 · Cada pieza es una tarjeta con su miniatura, su nombre, sus etiquetas y seis cifras

**Rastro** · `lib/aios/creative.js:165-185`.
**Estado** · La forma es requisito. Lo que cambia:

| parte | estado |
|---|---|
| Miniatura con degradado | **andamiaje**: son 16 colores hex escritos a mano (`:8-22`), aplicados **en línea** (`:178`), lo que además le gana al tema (`app/temas.css:749`). La miniatura real no existe (`C14-07`) |
| `▶` / `◧` según sea video | **no hay fuente**: el formato no llega (`C14-07`). Se puede **inferir** que es video si la pieza tiene `videoView`, y eso es honesto porque es lo que se está midiendo |
| Insignia «Activo / Pausado» | **no hay fuente**: `/entity?entityType=AD` no devuelve estado, y `negocio.anuncios` no tiene la columna a propósito (`050:60-63`). Lo que sí se puede decir es **«entregó N de M días de la ventana»**, que es un hecho medido |
| Duración `m:ss` | no hay fuente (`C14-07`) |
| Nombre `id — nombre` | el `id` de dos dígitos es inventado; **el nombre es real** |
| Etiquetas de formato y ángulo | no hay fuente. Están **codificadas en el nombre** — ver `13-EL-CONTRASTE.md` |
| Rejilla de seis cifras | requisito; las seis cambian según `C2-08` |

### C3-09 · La tarjeta tiene que decir en cuántos anuncios corre la pieza

**Qué es** · Una cifra que no existe en el prototipo ni en el documento, y que sostiene la premisa del
departamento.
**Fórmula** · `count(distinct meta_anuncio_id)` de la pieza.
**Estado** · Construible hoy. Medido: 21 de 32 piezas corren en más de un anuncio, hasta 6. **Y es la
única mitigación honesta de `C1-P03`**: una pieza que salta de 2 a 7 anuncios de una semana a la otra
es visible.

---

## 4 · El encabezado de la lista

### C3-10 · La barra dice cuántas piezas hay y de qué período

**Rastro** · `lib/aios/creative.js:202` → `«<b>N</b> piezas · <período>»`;
`components/views/CreativeView.jsx:72`.
**Estado** · Requisito. Con una corrección: tiene que decir **cuántas piezas tienen la cifra por la que
se está ordenando**, no sólo cuántas hay. Ordenar 32 piezas por una cifra que 5 tienen no es ordenar.

### C3-11 · La barra de período se dibuja siempre, incluso sin datos

**Rastro** · `components/acquisition/PanelDeAcquisition.jsx:93`: *«si apareciera con los datos, la
pantalla salta al cargar»*.
**Estado** · Se reusa el patrón.
