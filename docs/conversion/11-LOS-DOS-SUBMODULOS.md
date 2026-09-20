# Landing Intelligence y VSL Intelligence

> Fuente: `CC_Arquitectura_Funcional.md § 4:171-173`, más la medición propia contra producción del
> 2026-09-20. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15.

---

## 1 · Lo que el organigrama declara

### CV11-01 · Dos submódulos, y el documento no los deslinda

```text
├── Conversion Intelligence
│   ├── Landing Intelligence
│   └── VSL Intelligence
```

`§ 4`, `:171-173`. **Es todo lo que dice.** No hay una sección que defina qué le toca a cada uno, ni
qué mide, ni quién lo mira. El `§ 17:1111` lo declara pendiente.

**Y no hay un tercer submódulo para el formulario**, así que el formulario vive dentro de Landing
Intelligence — que es coherente con el `§ 1:18`, donde «Formulario de calificación» es un paso de la
landing.

---

## 2 · Landing Intelligence

### CV11-02 · Qué puede medir hoy

| qué | cobertura | id |
|---|---|---|
| Por dónde entró cada contacto, por familia de host | 475 de 590 (80,5 %) | `CV2-01` |
| La tasa de agenda de cada familia | por familia, con piso | `CV2-02` |
| Los tres estados del formulario | 247 de 590, **cortados el 2026-08-31** | `CV2-04` |
| La tasa de finalización del formulario | **64,8 % medido** | `CV2-05` |
| Las vistas de landing que reporta Meta | 150 de 240 filas anuncio-día | `CV8-09` |

### CV11-03 · Qué NO puede, y por qué

| hueco | motivo medido |
|---|---|
| **Visitantes y sesiones** | no existe ninguna tabla; `visitor_id` y `session_id` dan cero coincidencias en todo el repositorio |
| **La tasa de conversión de la landing** | su denominador se definiría por haber convertido: circular por construcción (`CV1-05`) |
| **Scroll, rage clicks, dead clicks, mapa de calor** | Clarity no está integrado: es una cadena de texto en el JSX (`CV9-03`) |
| **Abandono campo por campo del formulario** | GoHighLevel no expone endpoint de formularios ni de encuestas |
| **Tiempo en página, rebote bajo 3 s** | lo mismo que scroll: sin telemetría |

**De lo que el prototipo dibuja para este submódulo, sobrevive aproximadamente un tercio.**

---

## 3 · VSL Intelligence

### CV11-04 · No se puede construir, y no es por falta de dato

**Medido el 2026-09-20:**

| campo | escrituras | valores distintos |
|---|---|---|
| `VSL % máximo visto` | **79** | **uno: `0`** |
| `VSL segundos vistos` | **79** | **uno: `0`** |
| `Porcentaje de Video Visto` | 0 | — |
| `Video Watch Percentage` | 0 | — |

Última escritura: **2026-08-30**.

**No es un hueco de datos: es un campo que afirma «vio cero».** Setenta y nueve veces, sin una sola
excepción. Un campo vacío se nota; un cero se publica.

Es la regla 1 del departamento en su forma más pura (`docs/estado actual/03-CONVERSION.md:215`):
*«mientras el censo de un campo numérico tenga un solo valor distinto, ese campo no es una medición:
es un indicador de que algo se instaló y no funcionó»*, y se reporta **como alarma, no como cifra**.

El diagnóstico está en `docs/estado actual/06-INTEGRACIONES-GHL.md:313`: el tracking individual del
VSL *«está cableado y no reporta nada»*, y es problema del medidor —vTurb o su integración—, **no de
GoHighLevel**.

### CV11-05 · Decisión del 2026-09-20: hueco declarado, y no se toca vTurb

Con el patrón `fueraDeAlcance` de `lib/negocio/calidadDeLaAtribucion.ts:69`, que **se dibuja** en vez
de omitirse. El texto lleva la medición y su fecha:

> **La retención del VSL** no se puede medir: el campo que la guarda se escribió 79 veces entre el
> 2026-08-11 y el 2026-08-30 y **las 79 dicen cero**. No es que nadie viera el video: es que el
> medidor no reporta. Hace falta arreglar vTurb o su integración, que está fuera de este sistema.

**Por qué se dibuja y no se omite**: el prototipo dibujaba una curva de retención con 89 literales y
dos caídas marcadas al segundo exacto. Quien conozca esa pantalla va a buscarla, y si no está ni se
dice por qué, la lectura razonable es que se rompió. **La diferencia entre un hueco declarado y una
regresión es ese párrafo.**

### CV11-06 · El daño concreto de publicarlo igual

Publicar *«0 % de visionado promedio del VSL»* sería técnicamente cierto y completamente engañoso.
Peor: el prototipo cruza el VSL con la asistencia en dos sitios —*«Vieron menos del 40% del VSL · 31
contactos»* (`conversion.js:496-498`) y *«Vieron más del 60% del VSL · Califican 4 de cada 5»*
(`:522`)—, o sea que un cero universal convertiría a todos los contactos en «riesgo de no-show».

Y el `§ 10.7:761` del documento pide *«Show rate según consumo del VSL»* como KPI de Appointment
Flow: **ese KPI también está bloqueado por este medidor**, en otra pantalla.

---

## 4 · La consecuencia de tener un submódulo muerto

### CV11-07 · Conversion es hoy un departamento y medio

De los dos submódulos que el organigrama le da, uno tiene datos parciales y el otro **ninguno**. Eso
no lo invalida —`Landing Intelligence` solo ya publica cosas que ninguna otra pantalla publica— pero
tiene que estar dicho, porque el organigrama promete dos.

Es el mismo caso que Creative documentó en `docs/creative/12-QUIEN-VE-QUE.md:72-82`: de las cuatro
cosas que el documento le pedía al responsable creativo, dos eran construibles. La diferencia es que
allá el hueco era una métrica; acá es **un submódulo entero**.

---

## Preguntas abiertas

### CV11-P01 · ¿Cuándo vuelve a tener sentido VSL Intelligence?

Hacen falta **dos** cosas y sólo una está en nuestras manos: que el medidor reporte, y que vuelva a
haber gente pasando por la landing. Hoy no se cumple ninguna. Una sonda barata que avise el día que
el campo traiga un valor distinto de cero convertiría la alarma en algo que se apaga solo — está
propuesto y no decidido.

### CV11-P02 · ¿La retención del VSL es de Conversion o de Creative?

La regla 7 del departamento dice que es de Conversion, porque *«Creative mide retención del ANUNCIO,
Conversion la del VSL. Son dos videos»* (`03-CONVERSION.md:246`). Es convincente. Pero el
`§ 18.12:1433-1447` pone el análisis de retención dentro del `Creative Performance Analyzer`, y el
`§ 18.16:1537-1544` hace que Acquisition le entregue «retención» a Creative. **El documento no
distingue los dos videos en ninguna parte.** Mientras los dos estén en cero, la pregunta es teórica.
