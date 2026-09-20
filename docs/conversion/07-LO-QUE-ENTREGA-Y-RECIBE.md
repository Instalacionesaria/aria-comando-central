# El deslinde con Acquisition, Creative, Conversation y Sales

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

> **`lib/aios/conversion.js` YA NO EXISTE.** Se borró el 2026-09-20, y con él las 655 líneas con
> 530 literales inventados y 47 frases de guion que esta carpeta documenta. Las citas
> `conversion.js:N` de abajo **siguen siendo correctas como referencia histórica** —el archivo y sus
> líneas están en el historial de git— y ésa es toda su función: este documento nunca describió lo
> que hay, describió lo que la maqueta dibujaba, para sacar de ahí los requisitos.
>
> **Y `components/views/ConversionView.jsx` se reescribió el mismo día**: pasó de 115 líneas a 79, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 79 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/conversion/PanelDeConversion.jsx` con dos bloques medidos: el reparto
> de la cohorte por camino de entrada (`lib/negocio/recorridoDelLead.ts`) y el abandono del
> formulario de la landing (`embudoDelFormulario.ts`), más los cinco huecos declarados. La
> clasificación vive en `lib/negocio/recorrido.ts` y la ruta en `app/api/conversion/route.ts`.


---

## 1 · Lo que Acquisition le debe

### CV7-01 · Las cinco del § 18.16, remedidas

**Rastro** · `CC_Arquitectura_Funcional.md:1546-1552`.

| lo que promete | estado al 2026-09-20 |
|---|---|
| Campaña y anuncio de origen | **llega**, en `contactos.atribucion_primera` (`adId`, `campaign`, `utmContent`) |
| Calidad del tráfico | **no está definida**: el documento no dice qué es |
| CTR | **llega**, por anuncio y por día, en `negocio.metricas_de_anuncio` |
| **Landing page views** | **llega desde el 2026-09-19** — ver `CV7-02` |
| Diferencias por audiencia y placement | **no llega**: `groupBy` de GoHighLevel sólo acepta `day\|week\|month`; el resto da 422 (`docs/creative/14-…md`) |

### CV7-02 · `landingPageView` llega, y corrige lo publicado

**Estado** · `docs/estado actual/03-CONVERSION.md:32` afirma que de las cinco *«ninguna llega hoy»* y
nombra «Landing page views» entre las inexistentes. **Dejó de ser cierto el 2026-09-19**: el desglose
de acciones de Meta trae `landingPageView` por anuncio y por día, se guarda en
`negocio.metricas_de_anuncio.acciones` (migración `053`) y ya se publica en
`lib/negocio/rendimientoDelCreativo.ts:96` como «Vistas de la landing».

**Con dos límites que hay que decir al usarlo:**

1. **Es agregado de Meta, por anuncio y por día.** No es una sesión, no es un visitante, y **no se
   puede cruzar con un contacto**. Sirve para comparar anuncios entre sí, no para contar gente.
2. **Su cobertura es del 63 %** de las filas anuncio-día con entrega (150 de 240, remedido el
   2026-09-19). Viaja con su par `diasConLaClave / diasConEntrega` o la tasa sale baja, plausible y
   falsa — el defecto que `rendimientoDelCreativo.ts:16-30` documenta entero.

**Requisito**: si Conversion lo usa, lo **consume** de `rendimientoDelCreativo`, no lo recalcula. Es
el `§ 2.4:94-99`.

---

## 2 · Lo que le debe a Creative

### CV7-03 · Dos videos distintos, y el deslinde importa

**Rastro** · Regla 7 del departamento, `03-CONVERSION.md:246`: *«Creative mide retención del
ANUNCIO, Conversion la del VSL. Son dos videos.»*

**Estado** · Creative mide `videoView` de Meta —las reproducciones del anuncio— y lo publica como
hook rate con su cobertura (`rendimientoDelCreativo.ts:86`). Conversion mediría la retención del
**VSL de la landing**, que es otro video, otra población y otro medidor. **Hoy no puede** (`CV14-07`).

Y en la otra dirección: los cuartiles de video de Meta (25/50/75/100) **no llegan** —`fields` es un
enum cerrado de once valores y el resto da 422—, así que Creative tampoco tiene la curva. Los dos
departamentos tienen el mismo hueco por dos motivos distintos.

### CV7-04 · El puente es el nombre del creativo

**Estado** · Ver `CV1-08`: de los 104 contactos en la landing propia, **89 traen `utm_content`** y
sólo **4** traen `adId`. Conversion cruza con Creative por `llaveDelCreativo()`
(`lib/negocio/creativo.ts:44`) y **no escribe una segunda normalización**.

---

## 3 · Lo que le debe a Conversation

### CV7-05 · Tres de los KPIs de Conversion están listados como KPIs de Lead Flow

**Rastro** · `§ 9.7:609-611` lista `Landing visit rate`, `Form start rate` y `Form completion rate`
entre los KPIs de **Lead Flow**.

**Estado** · Es el solapamiento más grande de la carpeta y **el documento no lo desempata**. Las dos
lecturas son defendibles: Lead Flow guía al contacto hacia la landing y necesita saber si llegó;
Conversion mide qué pasa dentro de ella. Ver `CV1-P02`.

**Requisito provisional**: se construye en Conversion, **se declara el solapamiento en pantalla**, y
si Conversation lo publica algún día, uno consume al otro. Lo que no puede pasar es que los dos lo
calculen: serían dos tasas del mismo hecho con poblaciones distintas, que es el defecto que este
proyecto ya pagó dos veces.

### CV7-06 · El trigger link es de Lead Flow y su rastro vive en la columna de Conversion

**Rastro** · `§ 9.5:529-549` define los seis estados del trigger link. Medido en
`docs/estado actual/09-DEUDA-ABIERTA.md:177`: `Trigger Link` vale **29 de 584** en
`atribucion_ultima` y **0 de 584** en `atribucion_primera`.

**Estado** · El trigger link es el instrumento de **Lead Flow** —él lo envía— pero su huella queda en
la columna que **Conversion** lee. O sea que Conversion puede decirle a Conversation cuántos de sus
enlaces se abrieron, que es justo lo que el `§ 9.5:540` pide: *«identificar el punto real de
pérdida»*.

**Requisito**: la familia `redirección de trigger link` es una de las del censo por host (`CV14-03`)
y se publica aparte, no dentro de `widget`.

---

## 4 · Lo que le debe a Sales y a Appointment Flow

### CV7-07 · El precall NO es de Conversion

Ver `CV1-09`, `CV2-14` y `CV4-07`. Está construido en `lib/negocio/consumoDelPrecall.ts` y pertenece
al `§ 10.6`. El prototipo lo dibuja en el paso «Gracias»; se va con el borrado.

### CV7-08 · «Calificada» es de Business/Sales, y su insumo ya existe

**Rastro** · Cuatro de las seis `Lectura` del prototipo dicen `Corresponde a Sales`
(`conversion.js:478`, `:502`, `:519`) o `Corresponde a Conversation` (`:548`).
**Estado** · El ICP ya se resuelve en `lib/negocio/calidadDelCreativo.ts:61` con 344 de 344 contactos
de treinta días. **Conversion lo consume**; la definición de «calificada» —dónde está el corte— no es
suya: `docs/creative/08-DE-DONDE-VIENE-CADA-DATO.md:158` la deja como pregunta abierta con cuatro
pantallas candidatas.

---

## 5 · Lo que Conversion entrega

### CV7-09 · A Executive

- Por dónde entra la gente hoy, con su reparto y su cobertura.
- La tasa de finalización del formulario, y su abandono.
- **El cambio de ruta del 2026-08-31**, que ninguna otra pantalla publica y que es el hallazgo más
  grande del departamento.
- Los huecos declarados, con su motivo y su fecha.

### CV7-10 · A Acquisition

Qué hace el tráfico **después** del clic, por familia de recorrido. Es la contrapartida del
`§ 18.11:1419-1431`, el caso 3: *«Acquisition: el anuncio C tiene CTR alto y CPC bajo. **Conversion:
la finalización del formulario es baja.** Executive: revisar la coherencia entre anuncio, landing y
VSL.»*

**Con la salvedad medida**: hoy los dos lados casi no se cruzan. De los 247 contactos con el embudo
del formulario, **cero traen `adId`**; de los 211 con `adId`, ninguno trae el campo. Son dos épocas
distintas (`CV14-01`). El cruce se hace por nombre de creativo o no se hace.

---

## Correcciones al inventario

### CV7-11 · `03-CONVERSION.md:32` quedó viejo en un punto

Afirma que de las cinco cosas del `§ 18.16` *«ninguna llega hoy»*. **Una llega desde el 2026-09-19**
(`CV7-02`). El resto del diagnóstico de ese archivo sigue en pie, y sus nueve reglas son la ley de
esta carpeta.

---

## Preguntas abiertas

### CV7-P01 · ¿Qué es «calidad del tráfico»?

El `§ 18.16:1550` la lista entre las cinco cosas que Acquisition le debe a Conversion, y **el
documento no la define en ninguna parte**. Puede ser el ICP promedio por anuncio —que ya publica
Creative—, la tasa de rebote —que no existe—, o la proporción que llega a la landing —que sí se puede
medir—. Sin definición, no se puede construir ni reclamar.
