# El «Plan de acción»: doce frases, y cuáles tienen fuente

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

> Requisitos derivados de `lib/aios/creative.js:338-415` (`renderReco`) y del modal de
> `components/Overlays.jsx:99-119`.
>
> El § 2.3 del documento funcional le da a Creative Intelligence el derecho explícito de *«recomendar
> crear variantes de un anuncio»*, así que la existencia del bloque es un requisito. Lo que hay que
> separar es qué frases se sostienen sobre un dato y cuáles no.

---

## 1 · La forma

### C6-01 · Las conclusiones van en un bloque aparte, no mezcladas con las cifras

**Qué es** · Un modal con cuatro grupos de frases, sobre la población y el criterio que la pantalla
está mostrando.
**Rastro** · `lib/aios/creative.js:338-415`; el contenedor en `components/Overlays.jsx:99-119`, con
`<h3>Recomendaciones y conclusiones</h3>`. El subtítulo es
`«Venta directa · por <criterio> · <período>»` (`:343`).
**Estado** · **La forma es requisito y el subtítulo también**: una recomendación que no dice sobre qué
criterio y qué ventana se calculó no se puede discutir. Lo que se borra es el botón que lo abre
mientras las frases no tengan fuente (`C6-08`).

### C6-02 · Los cuatro grupos, y qué pregunta contesta cada uno

**Rastro** · `lib/aios/creative.js:368`, `:377`, `:383`, `:389`. Encabezados literales: **«Lo que dice
la data»**, **«Haz más de esto»**, **«Ajusta o pausa esto»**, **«Ideas para producir»**.
**Estado** · Los dos primeros son requisito; el tercero necesita la corrección de `C3-07` (Creative
propone, no ordena pausar); el cuarto es **generación, no medición** — ver `C6-07a`.

### C6-03 · El vacío ya está bien resuelto

**Rastro** · `lib/aios/creative.js:345`: *«No hay contenido en este periodo. Amplía el rango de fechas
para ver recomendaciones.»*
**Estado** · Requisito. Dice qué falta y qué hacer, que es la forma que el resto del sistema usa.

---

## 2 · Las doce frases, una por una

Transcritas de `lib/aios/creative.js:370-393`, con el estado de su fuente.

### Grupo 1 · «Lo que dice la data»

| # | frase | fuente |
|---|---|---|
| `C6-04a` | *«El {criterio} promedio por pieza es X. N piezas están por encima y M por debajo.»* | **Sí, hoy.** Es el corte de `C3-06`, y con él la frase tiene que decir **dentro de qué etapa** |
| `C6-04b` | *«Formato más efectivo: X (Y prom). El más bajo: Z.»* | **No.** El formato no llega (`C14-07`). Sólo se puede si se decide inferirlo del nombre, que es una pregunta abierta |
| `C6-04c` | *«Ángulo con mejor desempeño: X; el más flojo: Z.»* | **No.** Ídem |
| `C6-04d` | *«Tus ganadores retienen N % del video vs M % los de bajo desempeño.»* | **No.** La retención no existe por ninguna vía (`C14-05`). **Es la frase que hay que borrar primero**: afirma una causa |

### Grupo 2 · «Haz más de esto»

| # | frase | fuente |
|---|---|---|
| `C6-05a` | *«Produce más {formato} con ángulo {ángulo} — es tu combinación más rentable en {criterio}.»* | **No.** Depende de formato y ángulo |
| `C6-05b` | *«Replica el gancho de {pieza} (tu #1 con X).»* | **Parcialmente.** «Cuál es la #1» sí se puede decir, medido y dentro de su etapa. «Replica el gancho» afirma que se sabe qué es el gancho de esa pieza, y no se sabe: el guion no existe (`C4-08`) |
| `C6-05c` | *«Apunta a videos de ~N s, que es la duración de tus ganadores.»* | **No.** La duración no llega (`C14-07`) |

### Grupo 3 · «Ajusta o pausa esto»

| # | frase | fuente |
|---|---|---|
| `C6-06a` | *«Reformula o pausa el formato X y el ángulo Y: rinden bajo el promedio.»* | **No**, y dos veces: formato y ángulo no existen, y «pausa» es una decisión del § 18.10 |
| `C6-06b` | *«Revisa {pieza}; su gancho arranca en N % de hook — prueba abrir con el dolor en los primeros 3 s.»* | **No.** El hook rate sí se podrá medir; la recomendación de **qué poner en los primeros tres segundos** no sale de ningún dato. Es la segunda frase a borrar |
| `C6-06c` | *«En los videos flojos la atención cae a N %. Acorta la intro y ve directo al dolor.»* | **No.** Sale de la curva inventada (`C4-05`) |

### Grupo 4 · «Ideas para producir»

| # | frase | fuente |
|---|---|---|
| `C6-07a` | *«Un {formato} con ángulo {ángulo} atacando el dolor "…".»* | **No.** Tres campos inventados |
| `C6-07b` | *«Variante de {pieza}: mismo gancho, nuevo dolor — "…".»* | **No.** Ídem |
| `C6-07c` | *«Toma el mejor momento de {pieza} (~0:45) y conviértelo en un short independiente.»* | **No.** «El mejor momento» sale de la curva inventada. **El `~0:45` es literalmente una constante** |

**Cuenta final: de las doce frases, una se sostiene hoy con una corrección, una se sostiene a medias,
y diez no tienen fuente.** Nueve de las diez dependen de formato, ángulo, duración o retención — los
cuatro campos que `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` midió como inexistentes.

---

## 3 · Lo que esto obliga

### C6-08 · El botón «Plan de acción» se borra, y el bloque se conserva como forma

**Qué es** · `components/views/CreativeView.jsx:24-29` dibuja `«◈ Plan de acción»`.
**Estado** · **Se borra**, por el mismo motivo escrito en `components/views/AcquisitionView.jsx:21-26`:
*«Un botón que abre recomendaciones con umbrales inventados es peor que no tenerlo.»* Con una sola
frase sostenible de doce, lo que abriría es un modal casi vacío que promete un plan.

Lo que **no** se borra es el requisito: el día que haya tres o cuatro frases medidas —y `C6-04a` más
la fatiga de `C2-24` ya son dos— el bloque vuelve, con su subtítulo de criterio y ventana.

### C6-09 · La recomendación tiene que traer su evidencia

**Qué es** · Cada frase dice sobre qué población y qué ventana se calculó, y se puede abrir.
**Rastro** · El § 2.6 del documento pide explicabilidad; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`
lo numeró como `A6-14`…`A6-16` y anotó que **el prototipo lo enuncia y no lo implementa**.
**Estado** · Es requisito y hoy no está en ninguna de las dos pantallas.

### C6-10 · Ninguna recomendación puede ejecutarse desde el producto

**Qué es** · Creative propone; la persona ejecuta en Meta.
**Rastro** · § 18.10: las decisiones de presupuesto y pausa requieren validación ejecutiva. Decisión
del 2026-09-18: Creative es de **sólo lectura**.
**Estado** · Y hay una consecuencia de maquetado: **el verbo de las frases cambia.** «Pausá esta
pieza» se convierte en «esta pieza está bajo el promedio de su etapa», que es lo que se midió.

### C6-P01 · El § 18.15 pide «solicitudes de nuevas variantes», y eso es una entidad

La vista del responsable creativo incluye *«Solicitudes de nuevas variantes»*. Una solicitud no es una
cifra: **es algo que alguien crea, alguien recibe y alguien cierra**, y tiene que sobrevivir a la
recarga. No hay tabla, no hay flujo y no está decidido si vive en Creative o en el Team Execution del
§ 7. Queda abierta, y no se maqueta un botón que no guarde nada.
