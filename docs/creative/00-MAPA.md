# Creative — mapa de los requisitos

> Requisitos derivados del prototipo de Creative, de la especificación funcional § 18, y —lo que
> Acquisition no tuvo— de una **medición propia contra la API de GoHighLevel** hecha el 2026-09-18.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho como
> pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/02-CREATIVE.md`, medido el 2026-09-15, más las
> mediciones nuevas de `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`.
>
> **`lib/aios/creative.js` todavía existe al escribirse esta carpeta.** Son 450 líneas con 201
> literales numéricos inventados y 30 frases de guion, y arranca desde `bootAios()` en cada carga de
> página. Las citas `creative.js:N` describen **lo que la maqueta dibuja**, no lo que el sistema
> calcula. El día que el archivo se borre, esas citas pasan a ser referencia histórica y hay que
> anotarlo acá arriba, como hizo `docs/acquisition/00-MAPA.md`.

## Qué es esta carpeta

La pestaña Creative existe, se dibuja entera y no tiene una sola cifra real: **549 líneas** —450 de
`lib/aios/creative.js` y 99 de `components/views/CreativeView.jsx`— que fabrican ocho piezas
inventadas y las dibujan con seis cifras de cabecera, cinco criterios de orden, una biblioteca
partida en «Funciona / No funciona», un cajón con curva de retención y guion, y un modal de doce
recomendaciones. No hay ninguna ruta de servidor detrás: `ls app/api/` devuelve dieciocho carpetas y
ninguna es `creative`, y la sección se declara con `sinOperacionesTodavia: true`
(`lib/autorizacion/secciones.ts:250-256`).

**Y sin embargo, esa maqueta es la especificación.** Alguien decidió que la pantalla ordenara piezas
por un criterio elegible, las partiera en las que funcionan y las que no, y abriera cada una para
mirar dónde se cae la atención. Esas decisiones están tomadas, aunque los números que las ilustran
sean falsos. Esta carpeta las extrae, las numera y les pone al lado el estado del dato que cada una
va a necesitar.

Esto **no** es un plan de construcción: no propone orden de trabajo ni estima esfuerzo. Es la lista
de lo que el sistema real tiene que calcular, con el rastro de dónde salió cada cosa.

---

## La distinción que decide si esta carpeta sirve

La misma que usó Acquisition, con un caso difícil propio.

**REQUISITO** es una decisión de producto que sobrevive al borrado de los datos falsos: qué se mide,
sobre qué población, con qué corte, en qué orden se muestra. **ANDAMIAJE** es lo que existe sólo para
que la maqueta tenga algo que dibujar: los valores, los nombres propios, los generadores de variación.

La regla práctica: **si la pieza se puede reemplazar por una consulta, es requisito; si hay que
borrarla, es andamiaje; y si al borrarla queda un hueco con forma, la forma es el requisito.**

### El caso difícil de este departamento: la curva de retención

`lib/aios/creative.js:208-232` dibuja una curva de retención del video y marca en rojo las líneas del
guion donde la atención se cae. Aplicando la regla: los valores son andamiaje —salen de interpolar
siete puntos entre dos literales— y el hueco que queda tiene forma, así que la forma sería requisito.

**Y sin embargo no lo es, y es el único lugar de esta carpeta donde la regla se rompe a propósito.**
La curva no es andamiaje sólo en sus valores: lo es **también en su forma**. Los siete puntos son
`[[0,100],[0.10,hookRate],[0.25,hookRate-8],[0.45,(hookRate+retention)/2],[0.65,retention+6],
[0.85,retention+2],[1,retention]]` — o sea que las ocho piezas tienen **la misma curva**, escalada.
Y lo que Meta entrega, el día que se conecte, son **cuatro cuartiles: no una curva continua**, y
cuatro puntos no señalan un segundo del guion.

Así que el requisito que sobrevive no es «dibujar la curva» sino **«decir dónde se cae la
atención»**, y ése hoy no tiene fuente por ninguna vía. Está en `04-LA-FICHA-DEL-CREATIVO.md` con su
prohibición al lado. Es la diferencia entre postergar un requisito y borrarlo.

---

## Los otros documentos

### Del PROTOTIPO — lo que la maqueta dibuja

| Archivo | Prefijo | Título |
|---|---|---|
| `01-LA-UNIDAD-ES-EL-CREATIVO.md` | `C1-` | La unidad de análisis, los dos puentes y el corte por etapa |
| `02-METRICAS.md` | `C2-` | Catálogo de métricas |
| `03-LA-BIBLIOTECA.md` | `C3-` | La biblioteca partida en dos, y los cinco criterios de orden |
| `04-LA-FICHA-DEL-CREATIVO.md` | `C4-` | El cajón, la curva y el guion |
| `05-PERIODOS-Y-PISOS.md` | `C5-` | El período, el piso y las citas congeladas |
| `06-EL-PLAN-DE-ACCION.md` | `C6-` | Las doce recomendaciones, y cuáles tienen fuente |
| `07-LO-QUE-ENTREGA-Y-RECIBE.md` | `C7-` | El deslinde con Acquisition, Conversion, Conversation y Business |
| `08-DE-DONDE-VIENE-CADA-DATO.md` | `C8-` | De dónde viene cada dato, y su cobertura medida |
| `09-LO-QUE-NO-ES-UN-REQUISITO.md` | `C9-` | El andamiaje, y la lista de borrado |

### Del DOCUMENTO FUNCIONAL § 18

| Archivo | Prefijo | Título |
|---|---|---|
| `10-LO-QUE-PIDE-EL-DOCUMENTO.md` | `C10-` | § 18.12, § 18.7 «Video y creativo», § 18.15 |
| `11-EL-ANALIZADOR-Y-EL-DETECTOR.md` | `C11-` | El Creative Performance Analyzer y el Anomaly & Fatigue Detector |
| `12-QUIEN-VE-QUE.md` | `C12-` | La vista del responsable creativo |

### Los cruces

| Archivo | Título |
|---|---|
| `13-EL-CONTRASTE.md` | El prototipo contra el documento contra lo medible hoy |
| `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` | **La medición del 2026-09-18 contra la API real.** Es a la vez fuente y corrección |

**Si se va a leer uno solo, que sea el `14`.** No porque sea el más importante para el producto, sino
porque es el que cambia lo que ya estaba escrito: `lib/ghl/anuncios.ts:41-46` y
`db/migraciones/050_lo_que_costo_cada_anuncio.sql:52-58` **declararon imposible** un conjunto de
métricas que sí llega, por anuncio y por día, en una llamada que el sistema ya hace todos los días.

Si un nombre de archivo de estas tablas no está en la carpeta, **manda la carpeta**. Cada requisito
se cita por su número completo —`C2-07`, `C8-12`— desde cualquier documento.

---

## El estado, en una línea

**Lo que se puede construir hoy, sin conectar nada nuevo y sin una sola llamada adicional a la API:**

| | |
|---|---|
| **Ya está, y está medido** | La lista de piezas y su gasto (32 creativos en 79 anuncios), el ICP promedio por pieza (de 29,2 a 69,2, factor 2,4), la tasa de agenda por pieza (de 31 % a 77 %), y la etapa del embudo leída del nombre de campaña |
| **Llega y se está tirando** | El desglose de acciones de Meta por anuncio y por día: `videoView` (90 % de cobertura), `linkClick` (74 %), `landingPageView` (65 %), `postEngagement` (90 %). Habilita hook rate, link CTR, landing page view rate y click-to-landing. Ver `14` |
| **Se puede calcular pero la base es corta** | La fatiga por caída de CTR: 28 creativos con entrega, 16 con siete días o más, sólo 5 con catorce. La serie empieza el 2026-08-18 porque el colector arrancó ese día |
| **No tiene fuente por esta vía** | Los cuartiles de video, el tiempo medio visto, la retención de seis segundos, el placement y el activo creativo (imagen, video, copy, miniatura). Los cuatro están medidos como imposibles en `14`, con el código de error de cada intento |
| **No es de este departamento** | La retención del VSL (Conversion, y además el medidor está roto), el video precall (Conversation), el revenue y el CAC (Business) |

De las **seis** métricas de «Video y creativo» del § 18.7, dos se pueden dar hoy y cuatro no tienen
fuente. De los **nueve** indicadores del § 18.12, cuatro se pueden dar, dos quedan afuera por
aritmética y tres no tienen fuente.

---

## Alcance: de dónde sale esto, y quién gana en un desacuerdo

Tres fuentes, y el orden de precedencia importa porque **las tres se contradicen entre sí**:

1. **La medición** (`14`) gana siempre. Si el documento pide algo que la API no da, no se puede dar; y
   si el código afirma que algo no llega y llega, el código está mal y hay que corregirlo.
2. **El documento funcional § 18** gana sobre el prototipo. Si la maqueta dibuja un corte que el
   documento no pide, el corte es una decisión de producto que hay que defender o borrar.
3. **El prototipo** es la fuente de las decisiones de producto que nadie escribió en ninguna parte, y
   ésas no están en el documento: qué se ordena, cómo se parte la biblioteca, qué se abre al clicar.

Y una cuarta, que no es fuente pero es ley: **las diez reglas propias de
`docs/estado actual/02-CREATIVE.md` § 6**. Salieron de medir producción y cada una nombra un defecto
concreto. Están convertidas en requisitos numerados a lo largo de `01`, `05` y `08`.
