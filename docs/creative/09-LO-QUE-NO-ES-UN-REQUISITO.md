# Lo que NO es un requisito

> **`lib/aios/creative.js` YA NO EXISTE.** Se borró el 2026-09-19, y con él los 201 literales
> inventados que esta carpeta documenta. Las citas `creative.js:N` de abajo **siguen siendo
> correctas como referencia histórica** —el archivo y sus líneas están en el historial de git— y ésa
> es toda su función: este documento nunca describió lo que hay, describió lo que la maqueta dibujaba
> para sacar de ahí los requisitos.
>
> **Y `components/views/CreativeView.jsx` se reescribió el mismo día**: pasó de 99 líneas a 70, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 70 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/creative/PanelDeCreative.jsx` con tres bloques medidos: el ICP y la
> agenda por pieza (`lib/negocio/calidadDelCreativo.ts`), el hook rate y las tasas de enlace
> (`rendimientoDelCreativo.ts`) y la caída del CTR (`fatigaDelCreativo.ts`).

> Inventario del andamiaje de `lib/aios/creative.js` (450 líneas) y
> `components/views/CreativeView.jsx` (99 líneas), con la lista de borrado y **lo que hay que hacer
> antes de borrar**.
>
> La regla: si la pieza se puede reemplazar por una consulta, es requisito; si hay que borrarla, es
> andamiaje; y si al borrarla queda un hueco con forma, la forma es el requisito. El caso donde esa
> regla se rompe a propósito está en `00-MAPA.md` y es la curva de retención.

---

## 1 · Los 201 literales numéricos

### C9-01 · El inventario, bloque por bloque

| constante | líneas | qué finge | números |
|---|---|---|---:|
| `ADS` | `6-23` | ocho piezas con formato, ángulo, dolor, estado, duración, calificados, agendas, hook rate, retención, tiempo medio visto y CTR | **44** (+12 `null`) |
| `CLICKS` | `26-32` | clics por segundo del video, para cinco piezas | **60** |
| `DM` | `34` | mensajes directos por pieza | **16** |
| `SALES` | `36` | inversión y cierres por pieza | **16** |
| respaldo de `clickWeb` | `40` | `{'15':28,'04':15,'06':11}` | **3** |
| `IX` | `46` | interacciones | **8** |
| `REACH` | `50` | alcance, de 11.500 a 41.200 | **8** |
| `FREQ` | `54` | frecuencia, de 1,2 a 2,6 | **8** |
| `AGE` | `58` | antigüedad en días: 3, 6, 15, 28, 45, 70, 95, 140 | **8** |
| `TRANSCRIPT` | `62-68` | marcas de tiempo de 30 frases de guion | **30** |
| | | **total** | **201** |

Más **30 frases de guion** en primera persona (`:63-67`), **16 colores hex** en ocho degradados, y los
**siete coeficientes** de la curva de retención (`:212`, `:258`).

Para comparación, `components/acquisition/PanelDeAcquisition.jsx:10` documenta que
`lib/aios/acquisition.js` tenía **302 líneas y 58 literales**. Creative tiene 450 y 201.

### C9-02 · La mitad de esos números no llega nunca a la pantalla

**103 de los 201** se calculan y no se dibujan: los 60 de `CLICKS`, los 16 de `DM`, los 16 de `SALES`,
los 8 de `IX` y los 3 del respaldo de `clickWeb`. Y con ellos:

| cosa | dónde | por qué está muerta |
|---|---|---|
| `clicksBlock()` | `:233-255` | **nunca se llama** — una sola ocurrencia en el archivo |
| `PRIMARY` | `:116-118` | definida, nunca usada |
| `SECONDARY` | `:119-122` | ídem |
| `DIRECTA_FOOT = []` | `:127` | arreglo vacío, nunca usado |
| `fmtK` | `:77` | definida, nunca usada |
| `CRIT.dm`, `CRIT.clickWeb`, `CRIT.cierres` | `:82`, `:84`, `:85` | **no están en `SORT`** (`:103`), o sea inalcanzables |
| `CRIT[*].stage` (`TOF`/`MOF`/`BOF`) | `:80-89` | se define y nunca se lee |
| `avgWatch`, `ctr` | `:8-22` | 16 números que no se dibujan |
| `spend`, `cierres`, `cpv`, `dmRecibidos`, `interacciones` | `:41-47` | se calculan y no se dibujan |
| la marca «pico de clics» de la curva | `:218-221` | `openCre` llama `retentionCurve(ad, false)` (`:316`), que la apaga siempre |

**Esto es información, no trivia.** Un módulo donde la mitad del andamiaje ya no llega a la pantalla
dice que la maqueta se editó varias veces sin limpiar, y que **`CRIT` describe una versión anterior de
la pantalla** con ocho criterios de orden en lugar de cinco. Las tres etapas del embudo que `stage`
declara son la huella de esa versión.

### C9-03 · Los nombres propios de las ocho piezas

`Owner Hook`, `Founder Story`, `Social Proof`, `Results Demo`, `VSL Cold`, `Quick Win`, `Pain Point`,
`Comparison` — con sus formatos (`UGC`, `Talking Head`, `Carrusel`, `B-Roll`, `VSL`, `Estático`), sus
ángulos (`Dolor`, `Autoridad`, `Prueba social`, `Contrarian`, `Curiosidad`, `Comparación`) y sus
dolores (*«No consigue clientes premium»*, *«Pierde plata en ads»*…).

**Los vocabularios de formato y ángulo NO son andamiaje del todo**: son la prueba de que alguien
decidió que la pieza se clasifica por esas dos dimensiones. Ése es el requisito. Los seis valores de
cada uno son inventados, y los reales están **codificados en el nombre** de las piezas de verdad
(`C4-09`).

---

## 2 · Las catorce personas inventadas, que es lo más grave

### C9-04 · Creative abre un panel de contactos falsos desde 18 cifras

**Qué es** · `lib/aios/creative.js:159` y `:175` emiten `data-leads`, `data-n`, `data-seg="alto"` y
`data-sub="Creative"`. El escucha está en `lib/aios/leads-group.js:78-80`.
**Rastro** · El `POOL` de `lib/aios/leads-group.js:14-29` son **catorce filas con nombre de persona o
empresa, puntaje de ICP, origen del tipo `'Campaign 04 · Creative 12'`, estado y monto vendido** —
María López, Pablo Herrera, Carlos Méndez, Grupo Meridian, Diego Paredes, TechNova, Daniela Soto,
Karla Núñez, Rodrigo Vega, Lucía Fernández, Andrea Salas, Iván Torres, Estudio Vera, Marcos Ruiz.
Cinco marcadas `'Vendido'` con montos de $4.500 a $9.600. Cada fila lleva un botón que abre
`https://app.gohighlevel.com/`.

Su propio comentario (`:13`) dice: *«muestra representativa mientras no haya datos reales»*.

**Desde Creative hay 18 puertas a ese panel**: 2 del resumen de cabecera + 2 por cada una de las 8
tarjetas.

**Estado** · **Es lo más grave de la pantalla**, y no por el andamiaje: porque **la forma es un
requisito real**. Que cada cifra se pueda abrir en la lista de contactos que la produjo es lo que el
§ 2.6 pide como explicabilidad, y `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md` lo numeró como
`A7-24`…`A7-32`. Lo que hay que borrar son los catorce nombres; lo que hay que conservar es la puerta,
apuntando a la lista real.

---

## 3 · El control de período

### C9-05 · Los cuatro presets escritos a mano

`{'7d':7,'mes':30,'tri':90,'hist':Infinity}` (`:94`), más `periodLabel()` (`:99-102`) y el
`period = {preset:'hist'}` inicial (`:91`). **Andamiaje entero**: el vocabulario es
`lib/negocio/periodo.ts`. Ver `C5-01` a `C5-04`.

### C9-06 · El botón «Personalizado» y el `#crePill`

`components/views/CreativeView.jsx:42-49`. Andamiaje, por el motivo de
`components/views/AcquisitionView.jsx:21-26`.

### C9-07 · El botón «Plan de acción»

`components/views/CreativeView.jsx:24-29`. Andamiaje **mientras** once de las doce frases no tengan
fuente. Ver `C6-08`.

---

## 4 · El CSS

### C9-08 · Siete clases del bloque de Creative están VIVAS en otras pantallas

**Comprobado el 2026-09-18, emisor por emisor**, sobre `components/` y `lib/aios/`:

| clase | quién más la emite |
|---|---|
| `.ghead` | `components/views/ConversionView.jsx` |
| `.filterbar` | `ConversionView.jsx` **y** `lib/aios/datepicker.js` |
| `.db-info` | `ConversionView.jsx` |
| `.cls` | `lib/aios/datepicker.js` |
| `.band` | `lib/aios/conversion.js` |
| `.legend` | `lib/aios/conversion.js` **y** `components/views/ExecutiveView.jsx` |
| `.read` | `lib/aios/conversion.js` |

**Ninguna de las siete se toca.** El modo de fallo de equivocarse: `.ghead`, `.filterbar` y `.db-info`
se caen en **Conversion**, `.cls` en el calendario, `.legend` en **Executive**. Nada falla: se ve
distinto y nada lo dice.

> `docs/estado actual/02-CREATIVE.md` nombró sólo `.read` como la excepción. Son siete.

### C9-09 · Las que sí están muertas

Sin ningún emisor fuera de `creative.js`, en `app/aios.css` (bloque `613-1050`):
`.cc` y toda su familia (`.cc-score`, `.cc-foot`, `.cc-media`, `.cc-mx`, `.cc-name`, `.cc-qual`,
`.cc-dur`, `.cc-status`), `.cg`, `.cre-stats`, `.cre-stat`, `.dw-strip`, `.ds`, `.dw-facts`,
`.verdict` y sus nueve variantes, `.stage` y sus tres, `.thumb`, `.retention`, `.bof-mini`,
`.funnels`, `.fn-label`, `.fn-btns`, `.sortseg`, `.sortrow`, `.sortbar`, `.tb-row`, `.tb-lab`,
`.tb-note`, `.pm-sep`, `.pm-custom`, `.pm-lab`, `.db-custom`, `.db-apply`, `.db-arrow`, `.db-label`,
`.fb-div`, `.head-actions`, `.empty li`, `#customWrap`.

Ojo: `.cc*`, `.cg`, `.cre-stats`, `.pill-menu` y `.pm-list` están vivas **hoy** porque `creative.js`
las emite; mueren con él, así que se borran **en el mismo cambio** y no antes.

### C9-10 · Los ocho degradados van en línea y le ganan al tema

`lib/aios/creative.js:178` aplica el degradado como estilo en línea. `app/temas.css:722` y `:749` ya lo
anotan: **un estilo en línea le gana al tema**, así que las miniaturas inventadas no responden al
cambio de tema. Andamiaje, y su ausencia no deja hueco: la miniatura real no existe (`C14-07`).

---

## 5 · La lista de borrado

### C9-11 · Paso 0, bloqueante: mudar los cierres de los overlays

**Antes de borrar nada.** `lib/aios/creative.js:442-445` registra **los únicos** escuchadores que
cierran `#drawer` y `#recoModal`: `recoClose`, `recoScrim`, `scrim`, `dwClose`, más el `Escape`.

Y cuatro módulos los **abren** sin registrar nada: `lib/aios/conversion.js:563` y `:620`,
`lib/aios/executive-panel.js:67` y `:88`, `lib/aios/leads-portal.js:286`,
`lib/aios/period-controls.js:58`. Peor: `executive-panel.js:64` hace literalmente
`document.getElementById('dwClose').click()`.

**Modo de fallo si se omite:** alguien abre «Plan de acción» en Conversion, el modal queda con su velo
sobre toda la aplicación, y **no hay botón, ni velo, ni `Escape` que lo cierre. Sólo recargar. Sin un
error en consola.**

Los cinco se mudan a `lib/aios/shell.js`, que corre primero y es dueño del armazón — **no** a
`components/Overlays.jsx`, porque los otros módulos abren esos overlays imperativamente con
`classList` y un componente React que controle `className` pelearía contra ellos.

> Acquisition no pasó por esto porque `acquisition.js` no era dueño de esos escuchadores. Es la
> diferencia entre las dos migraciones y es la única que puede romper pantallas ajenas.

### C9-12 · La tabla de borrado

| # | qué se borra | dónde | literales |
|---|---|---|---:|
| 1 | El módulo entero | `lib/aios/creative.js` | **201** |
| 2 | Su entrada en `MODULOS` | `lib/aios/index.js:8`, `:27` | — |
| 3 | Las 18 puertas al panel falso | `creative.js:159`, `:175` | — |
| 4 | El botón «Plan de acción» | `CreativeView.jsx:24-29` | — |
| 5 | El botón «Personalizado» | `CreativeView.jsx:42-49` | — |
| 6 | Las clases muertas de `C9-09` | `app/aios.css:613-1050` | — |
| 7 | Los pasos de paridad | `scripts/paridad.mjs:160-166` | — |

**Y lo que NO se borra, aunque viva en las mismas líneas:** el encabezado invertido
(`.cre-head`, `.cre-desc`, compartido con Acquisition), las siete clases de `C9-08`, el `<section
id="v-creative">` y el `.cl-page`, y los dos overlays de `components/Overlays.jsx`, que son de todos.

### C9-13 · `scripts/paridad.mjs` rompe TRES pasos encadenados, no uno

| paso | línea | qué le pasa |
|---|---|---|
| «drawer de contenido» | `:160-161` | clica `#v-creative .cc[data-cre]`, y la vista nueva no dibuja tarjetas |
| «plan de Creative» | `:162-163` | clica `#recoBtn`, que la vista nueva no tiene |
| «plan de Acquisition» | `:164-166` | **empieza con `p.click('#recoClose')`**: depende de que el paso anterior haya dejado el modal abierto |
| «ficha de lead» | `:167` | **también empieza con `p.click('#recoClose')`**, y depende del anterior |

Es una cadena de cuatro, no dos pasos sueltos: cada uno cierra lo que abrió el previo. Quitar los dos
de Creative sin mirar los otros dos los deja clicando un botón que no está visible. Hay que borrar los
dos primeros **y** quitarle el `#recoClose` inicial al tercero, con el comentario que explique qué
afirmaban.

**Y el precedente ya está en el archivo**: `scripts/paridad.mjs:142` y `:146` cuentan que dos pasos que
miraban `#v-creative` —el disparador y `.cre-stats`— **ya se mudaron a `contacts`** cuando Acquisition
se reescribió, por este mismo motivo. Éstos son los que quedaron.

El comentario de `:155-159` dice que el paso del cajón *«SÍ se queda mirando Creative, y a
propósito… Es la única rendija que queda para comprobar que `creative.js` sigue dando los mismos datos
que el `<script>` original»*. Cuando `creative.js` se va, la rendija no se rompe: **deja de tener algo
que comparar.**

---

## 6 · Las citas que el borrado deja apuntando al vacío

### C9-14 · Hay 20 citas a `creative.js:N`, en cinco archivos

Contadas el 2026-09-18, sin contar esta carpeta:

| archivo | citas |
|---|---:|
| `docs/estado actual/02-CREATIVE.md` | **15** |
| `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md` | 2 |
| `docs/acquisition/04-CALIDAD-DEL-LEAD.md` | 1 |
| `docs/acquisition/05-PERIODOS-Y-COMPARACION.md` | 1 |
| `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md` | 1 |

`docs/DESPLIEGUE.md` nombra el archivo **sin número de línea**, así que no entra en la cuenta: le
alcanza con saber que el módulo ya no está.

**Estado** · Es el defecto exacto que el commit `c8494e6` ya pagó: *«borrar el prototipo dejó 374
citas apuntando a un archivo que ya no está»*. Las citas **siguen siendo correctas como referencia
histórica** —el archivo y sus líneas están en el historial— y lo que hay que agregar es el blockquote
de cabecera que diga que el archivo ya no está, con la fecha.

**Y hay una clase peor**: las que apunten a `CreativeView.jsx` dentro del rango de la vista nueva
**resuelven y muestran otra cosa**. Una línea corrida no falla. Por eso `docs/acquisition/00-MAPA.md`
las separó en dos clases y contó once de la segunda.
