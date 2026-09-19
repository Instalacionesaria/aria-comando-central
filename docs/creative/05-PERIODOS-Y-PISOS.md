# El período, el piso y las citas congeladas

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

> Requisitos derivados de `lib/aios/creative.js:91-102` y `components/views/CreativeView.jsx:30-49`,
> contra el vocabulario real de `lib/negocio/periodo.ts`.
> Las mediciones de sesgo de ventana son de `docs/estado actual/02-CREATIVE.md:225-228`, del 2026-09-16.

---

## 1 · El control de período del prototipo está roto en dos sentidos

### C5-01 · La vista y el módulo no están de acuerdo sobre qué período está activo

**Qué es** · `components/views/CreativeView.jsx:35` marca **«7 días»** con `className="on"`, pero
`lib/aios/creative.js:91` arranca con `period = {preset:'hist'}`.
**Estado** · **Al abrir, el botón dice «7 días», la biblioteca muestra las ocho piezas —incluida una
de hace 140 días— y la barra de abajo dice «histórico».** Tres afirmaciones y dos se contradicen.

### C5-02 · El botón «Hoy» no existe en el mapa de presets

**Qué es** · `CreativeView.jsx:32` emite `data-p="hoy"`, y el mapa de `creative.js:94` es
`({'7d':7,'mes':30,'tri':90,'hist':Infinity})[preset] ?? Infinity`.
**Estado** · `'hoy'` cae al `?? Infinity`: **«Hoy» e «histórico» devuelven exactamente lo mismo**, y
`periodLabel()` (`:99-102`) cae al literal genérico `'periodo'`. Las dos listas divergieron en ambos
sentidos: `tri` y `hist` tienen entrada y **no tienen botón**; `hoy` tiene botón y **no tiene
entrada**.

> Ése es el argumento entero para no tener dos listas. Un preset que no existe no falla: devuelve
> todo.

### C5-03 · El vocabulario de ventanas es el del sistema, y es uno solo

**Fórmula** · `lib/negocio/periodo.ts:83-96` define `PERIODOS`: **Hoy** (1 día, con el matiz «las
últimas 24 horas, no el día del calendario»), **7 días**, **30 días** y **Completo**
(`DIAS_DE_TODO = 3650`). `PERIODO_POR_OMISION = '30d'` (`:109`).
**Estado** · Se reusa entero. Los cuatro presets escritos a mano en `creative.js:94` se borran.
**Y `periodoDe()` RECHAZA un período que no existe, no lo corrige** — es lo contrario del `?? Infinity`
del prototipo, y es la corrección que Acquisition ya hizo.

### C5-04 · El selector de rango personalizado se borra

**Qué es** · `components/views/CreativeView.jsx:42-49` dibuja un botón «Personalizado» con
`data-datepick="cre"`.
**Estado** · **Andamiaje.** El mismo motivo que escribió `components/views/AcquisitionView.jsx:21-26`:
el vocabulario cerrado de `periodo.ts` es el del sistema, y un rango libre obliga a que cada cifra con
piso y cada aviso de cobertura se vuelvan a razonar para una ventana arbitraria.

---

## 2 · El piso

### C5-05 · El piso es `PISO_DE_UNA_TASA = 10`, y es del denominador

**Rastro** · `lib/negocio/indicadoresDeCitas.ts:300`. Ver `C2-01`.
**Estado** · **Y está medido cuántas piezas lo superan, que es lo que decide si la pantalla sirve.**
Medido el 2026-09-18, ventana de 30 días: de **18 piezas con contactos, 6 superan el piso** —
`agendamiento - yaping` (112), `agendamiento - yaping - 23/07` (65), `el app` (59),
`evoluciona native` (39), `economia us latino` (26) y `link_in_bio` (14).

> Las otras doce tienen entre 1 y 5 contactos. **La tabla es correcta y tiene doce filas con la tasa
> en `null`.** Eso no es un defecto —es la regla de los dos ceros funcionando— pero es una decisión
> de maquetado que hay que tomar a conciencia: doce filas con guiones se leen como un error.

### C5-06 · El piso de las tasas con denominador de IMPRESIONES es otro, y no está calibrado

**Qué es** · El hook rate, el link CTR y la landing page view rate dividen por impresiones, no por
eventos contables. Con 100 impresiones, una reproducción mueve un punto entero.
**Estado** · Hace falta un piso propio de impresiones y **no hay ningún valor justificado**. Ver
`C2-P01`.

---

## 3 · La ventana, y su sesgo

### C5-07 · Para Creative, 30 días no es una concesión: es más señal

**Qué es** · Los contactos no envejecen. Una pieza que trajo 40 contactos hace tres semanas trajo 40
contactos, y ampliar la ventana sólo agrega denominador.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 7.
**Estado** · Medido allí: en 14 días **4 piezas** superan el piso; en 30 días, **18 piezas distintas y
6 sobre el piso**. Para las cifras del lado del lead, la ventana ancha es mejor.

### C5-08 · Pero el sesgo de la ventana es de las CITAS, no de los contactos

**Qué es** · Una cita agendada dentro de la ventana puede no haber ocurrido todavía. No es que haya
salido mal: **no pasó**.
**Rastro** · `docs/estado actual/02-CREATIVE.md:225`, medido el 2026-09-16 sobre `negocio.citas`:

| ventana | citas alcanzables | congeladas | proporción |
|---|---:|---:|---:|
| 14 días | 147 | 11 | 7,0 % |
| **30 días** | 206 | **77** | **27,2 %** |
| Completo | 206 | 101 | 32,9 % |

**Y el hallazgo que decide el maquetado**: *«"Completo" no agrega ni una cita alcanzable sobre "30
días" — agrega 24 congeladas.»*

### C5-09 · Publicar a 30 días exige el conteo de congeladas al lado

**Fórmula** · La respuesta lleva, en la misma pasada, cuántas citas de la ventana todavía no
ocurrieron.
**Rastro** · El patrón vive en `lib/negocio/indicadoresDeCitas.ts:345` y `:514-526`.
**Estado** · Construible hoy. **A 30 días, un cuarto de las citas no pasó todavía**: una tasa de
agenda sin ese conteo al lado es una cifra que el lector no puede interpretar.
Y se apaga solo: cuando no hay congeladas, el aviso viaja `null` y la pantalla no dibuja nada
(`C2-06`).

### C5-10 · Hay TRES fechas de inicio distintas en esta pantalla

**Qué es** · No una ventana, tres.

| dato | desde | por qué |
|---|---|---|
| Contactos, ICP, agendas | **2025-08-08** | es la primera alta guardada |
| Gasto, impresiones, clics, CTR | **2026-08-18** | arrancó el colector de anuncios |
| El desglose de acciones | **el día del despliegue** | la columna no existe todavía |

**Estado** · **Cada cifra dice desde cuándo mide.** `costoDelAnuncio` ya lleva `desde`/`hasta` y su
aviso de ventana incompleta; el desglose necesita **los suyos, no los mismos**. Una pantalla que diga
«30 días» mientras el hook rate habla de tres días afirma algo falso sobre el alcance de la cifra, y
es la regla 9 de `02-CREATIVE.md` aplicada a una columna en vez de a una cohorte.

### C5-11 · Las cifras del lead se miden sobre `alta_en_el_crm`

**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 9; el índice que lo sirve es
`contactos_por_alta`, de `db/migraciones/052`.
**Estado** · Construible. Y hay que decirlo, porque la alternativa razonable —la fecha de la cita— daría
otra cohorte y otras cifras.

### C5-12 · El gasto vive en un día de calendario y el lead en un instante

**Qué es** · `negocio.metricas_de_anuncio.fecha` es `date`; `negocio.contactos.alta_en_el_crm` es
`timestamptz`.
**Rastro** · `db/migraciones/050:169-173`: *«el proveedor entrega `dateStart`/`dateStop` como día
calendario de la zona de la cuenta publicitaria, no como instante… lo que no es un instante no se
guarda como instante»*. Y `lib/negocio/costoDelAnuncio.ts:32-63` ya resolvió el corte: las tres
consultas usan la misma ventana anclada al día.
**Estado** · Se reusa el mismo anclaje. Mezclar las dos formas hace que el gasto y los contactos de
«hoy» hablen de dos ventanas que no coinciden, y la diferencia es de horas — invisible y suficiente
para que un CPL no cierre.
