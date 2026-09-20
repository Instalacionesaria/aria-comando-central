# Conversion — mapa de los requisitos

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y —como en
> Creative— de una **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el
> `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como
> requisito.
> El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el 2026-09-15, más las
> mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

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

## Qué es esta carpeta

La pestaña Conversion existe, se dibuja entera y no tiene una sola cifra real: **763 líneas** —648 de
`lib/aios/conversion.js` y 115 de `components/views/ConversionView.jsx`— que fabrican un recorrido de
cinco pasos, tres paneles de cabecera, seis cajones de detalle, un bloque de alarma y un modal de plan
de acción. **Cero peticiones de red**: `conversion.js` no tiene una sola sentencia `import`, ni
`fetch`, ni `await`.

El motor entero son **dieciocho números**:

```js
const CV = {
  all:     {sesiones:866, vsl:604, form:308, agenda:225, calificados:141, gracias:198},
  mobile:  {sesiones:612, vsl:398, form:181, agenda:118, calificados:64,  gracias:101},
  desktop: {sesiones:254, vsl:206, form:127, agenda:107, calificados:77,  gracias:97},
};
```

`lib/aios/conversion.js:10-14`. Todo número de la pantalla es `CV[dispositivo][paso] ×
FACTOR[periodo]` (`:15`) redondeado, o un literal suelto. El propio archivo lo admite en la línea de
al lado: *«datos por dispositivo y periodo — reemplazar por la consulta real»* (`:9`).

No hay ninguna ruta de servidor detrás: `ls app/api/` devuelve **diecinueve carpetas y ninguna es
`conversion`**, y la sección se declara con `sinOperacionesTodavia: true`
(`lib/autorizacion/secciones.ts:264-270`).

**Y sin embargo, esa maqueta es la especificación.** Alguien decidió que la pantalla mostrara el
recorrido como cinco pasos con su caída entre uno y otro, que cada paso se pudiera abrir para ver su
evidencia, que hubiera una banda de «lo esperado» contra la que comparar, y que las fugas se
ordenaran por cuánta gente cuestan. Esas decisiones están tomadas, aunque los números que las
ilustran sean falsos. Esta carpeta las extrae, las numera y les pone al lado el estado del dato que
cada una va a necesitar.

Esto **no** es un plan de construcción: no propone orden de trabajo ni estima esfuerzo. Es la lista
de lo que el sistema real tiene que calcular, con el rastro de dónde salió cada cosa.

---

## Lo que hace a esta carpeta distinta de las dos anteriores

### 1 · El documento funcional casi no habla de este departamento

`CC_Arquitectura_Funcional.md` tiene **1.651 líneas y siete menciones** de Conversion como
departamento (`:8`, `:146`, `:171`, `:1111`, `:1383`, `:1425`, `:1546`). **Una sola** dice algo que
Conversion afirma:

> **Conversion:** La finalización del formulario es baja. — `§ 18.11`, `:1425`

Y el `§ 17:1111` lo declara **pendiente de especificación**, junto con Sales, Business y Executive.
No hay KPIs, ni umbrales, ni responsables, ni límite entre sus dos submódulos.

Acquisition tenía un `§ 18` entero, con diecinueve subsecciones. Creative heredaba de ahí —el
`§ 18.12` y el `§ 18.15`—. **Conversion no hereda de ninguna parte**, así que el prototipo pesa acá
más que en las dos pantallas anteriores, y el `10-LO-QUE-PIDE-EL-DOCUMENTO.md` es el archivo más
corto de la carpeta por un motivo que no es descuido.

### 2 · El embudo que este departamento existe para medir cambió de ruta

Medido el 2026-09-20. El `2026-08-31` el tráfico dejó de pasar por la landing:

| época | contactos | landing con VSL | widget de reserva directo |
|---|---|---|---|
| agosto y antes | 349 | **203 (58 %)** | 84 (24 %) |
| **septiembre** | 241 | **31 (13 %)** | **105 (44 %)** |

El recorrido del `§ 1:28-39` —`Anuncio → Landing → VSL → Formulario → Lead calificado`— **ya no es
por donde pasa la gente**. Eso no invalida los requisitos del prototipo: los reordena. Está entero en
`01-LOS-DOS-RECORRIDOS.md` y en el `14`.

### 3 · Tres instrumentos se apagaron el mismo día, y no se rompieron

`Form Landing VSL` deja de escribirse el 2026-08-31. Los dos campos del VSL dejan de escribirse el
2026-08-30. El host de la URL cambia de familia la semana del 2026-08-31. **Es el mismo hecho visto
por tres ventanas**: cambió la ruta, no los medidores. Salvo el VSL, que además está roto por su
cuenta — ver abajo.

---

## La distinción que decide si esta carpeta sirve

La misma que usaron Acquisition y Creative.

**REQUISITO** es una decisión de producto que sobrevive al borrado de los datos falsos: qué se mide,
sobre qué población, con qué corte, en qué orden se muestra. **ANDAMIAJE** es lo que existe sólo para
que la maqueta tenga algo que dibujar: los valores, los nombres propios, los generadores de
variación.

La regla práctica: **si la pieza se puede reemplazar por una consulta, es requisito; si hay que
borrarla, es andamiaje; y si al borrarla queda un hueco con forma, la forma es el requisito.**

El caso difícil propio de esta carpeta: **una fuente que la pantalla declara conectada y no
existe.** Los chips `Clarity` y `VTurb` del encabezado (`components/views/ConversionView.jsx:22-31`)
llevan el punto de «fuente viva» y son **cadenas de texto en el JSX**. No hay integración, ni
credencial, ni variable de entorno, ni tabla. No es andamiaje —no está ahí para dar un número— y no
es requisito —nadie decidió integrarlos—: es una **afirmación falsa en pantalla**, y va al `09`.

---

## Los otros documentos

### Del PROTOTIPO — lo que la maqueta dibuja

| Archivo | Prefijo | Título |
|---|---|---|
| `01-LOS-DOS-RECORRIDOS.md` | `CV1-` | La unidad, el corte del 2026-08-31 y por qué hay dos caminos |
| `02-METRICAS.md` | `CV2-` | Catálogo de métricas |
| `03-EL-RECORRIDO.md` | `CV3-` | Los cinco pasos, la banda de «lo esperado» y la caída entre pasos |
| `04-LOS-CAJONES.md` | `CV4-` | Los seis detalles por paso, y la rama que nadie puede abrir |
| `05-PERIODOS-Y-PISOS.md` | `CV5-` | Las cuatro ventanas, el corte de época y el piso que sube |
| `06-EL-PLAN-DE-ACCION.md` | `CV6-` | Las 47 frases, las once fricciones y cuáles tienen fuente |
| `07-LO-QUE-ENTREGA-Y-RECIBE.md` | `CV7-` | El deslinde con Acquisition, Creative, Conversation y Sales |
| `08-DE-DONDE-VIENE-CADA-DATO.md` | `CV8-` | De dónde viene cada dato, y su cobertura medida |
| `09-LO-QUE-NO-ES-UN-REQUISITO.md` | `CV9-` | El andamiaje, y la lista de borrado |

### Del DOCUMENTO FUNCIONAL

| Archivo | Prefijo | Título |
|---|---|---|
| `10-LO-QUE-PIDE-EL-DOCUMENTO.md` | `CV10-` | Las siete menciones, las tres entidades y la traza del § 5.2 |
| `11-LOS-DOS-SUBMODULOS.md` | `CV11-` | Landing Intelligence y VSL Intelligence |
| `12-QUIEN-VE-QUE.md` | `CV12-` | El documento no nombra responsables de Conversion |

### Los cruces

| Archivo | Título |
|---|---|
| `13-EL-CONTRASTE.md` | El prototipo contra el documento contra lo medible hoy |
| `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md` | **La medición del 2026-09-20 contra producción.** Es a la vez fuente y corrección |

**Si se va a leer uno solo, que sea el `14`.** No porque sea el más importante para el producto, sino
porque es el que cambia lo que ya estaba escrito: `docs/estado actual/03-CONVERSION.md:32` afirma que
de las cinco cosas que Acquisition le debe a Conversion según el `§ 18.16`, *«ninguna llega hoy»*, y
nombra «Landing page views» entre las inexistentes. **Eso dejó de ser cierto el 2026-09-19**: llega,
por anuncio y por día, en `negocio.metricas_de_anuncio.acciones`.

Si un nombre de archivo de estas tablas no está en la carpeta, **manda la carpeta**. Cada requisito se
cita por su número completo —`CV2-07`, `CV8-12`— desde cualquier documento.

### La convención de las citas cortas, y dónde muerde

Una cita corta —`` `:398` ``— hereda el archivo de la mención anterior. Es cómoda y **falla en
silencio**: el 2026-09-20, al agregarle a `conversion.js` las dos líneas del `import` de la etapa 0,
**133 citas de esta carpeta quedaron corridas**, y doce de ellas no se pudieron corregir
automáticamente porque su antecedente era otro archivo. Se corrigieron a mano y **se escribieron
explícitas**.

La regla que queda: **una cita corta sólo se usa cuando la mención con archivo está en el mismo
párrafo.** En una tabla, en una lista o después de nombrar otro archivo, va el nombre completo.

---

## Por qué el prefijo es `CV` y no `C`

`C` es de Creative (`C1-01`, `C2-07`). `CV` es además el prefijo que el propio prototipo usa en todo:
la constante `CV` (`conversion.js:10`), los contenedores `#cvStats`, `#cvInfo`, `#cvWorst`,
`#cvJourney`, `#cvAlarm`, la variable `cvPeriod` (`:141`) y las funciones `cvRenderStats`,
`cvRenderJourney`, `cvRenderAll`.

---

## La cuarta fuente-ley

Además del prototipo, del documento funcional y de la medición propia, esta carpeta obedece a
**`docs/estado actual/03-CONVERSION.md:213-256`**, que tiene **nueve reglas propias del
departamento** medidas el 2026-09-15. Las tres que gobiernan todo lo demás:

1. **Los ceros son tres, no dos.** No hay campo · el campo dice cero · el medidor no reportó.
   *«Mientras el censo de un campo numérico tenga un solo valor distinto, ese campo no es una
   medición: es un indicador de que algo se instaló y no funcionó»*, y se reporta **como alarma, no
   como cifra**.
2. **Nunca mezclar cohortes de antes y después del 2026-08-31.** Y el botón por omisión —`30d`,
   `lib/negocio/periodo.ts:109`— es exactamente el que la viola.
3. **Los hosts no se suman.** Siete hosts, cinco cosas distintas. Una métrica de «visitas a la
   landing» que los sume cuenta cinco poblaciones como si fueran una.

Las otras seis están citadas en el archivo donde muerden.

---

## El estado, en una línea

**Lo que se puede construir hoy, sin conectar nada nuevo:**

- **El reparto de la cohorte por recorrido** — cuánta gente entra por la landing, cuánta directo al
  widget, cuánta por el formulario nativo de Meta y cuánta no deja rastro. Sale de
  `contactos.atribucion_ultima->>'url'`, que está en **475 de 590 contactos** y que **ningún módulo
  del repositorio lee hoy**.
- **El embudo del formulario, con sus tres estados** — `Agendado` 121, `Form incompleto sin agendar`
  87, `Form completo sin agendar` 39. Es lo único que contesta la única frase que el documento le
  atribuye a Conversion. **Con su corte de época al lado**, porque murió el 2026-08-31.
- **Cuántos agendaron en cada recorrido** — con el mismo `exists` sobre `ghl_calendario_id` que ya
  usan otros cuatro módulos, para que las pantallas sumen igual. **Un conteo y no una tasa**: al
  medirla, la tasa por familia salió circular —dos familias dan 100 % porque su dirección se
  escribió al reservar— y se retiró. Ver `CV2-02`.

**Lo que NO se puede, y se dibuja como hueco declarado:**

- **`VSL Intelligence` entero.** Sus dos campos se escribieron 79 veces y **las 79 dicen `0`**. Los
  otros dos campos de porcentaje de video están en **0 de 590**. No es que falte el dato: el campo
  afirma «vio cero».
- **Sesiones, visitantes y eventos de página.** No existe ninguna tabla, y `visitor_id` y
  `session_id` dan **cero coincidencias en todo el repositorio**.
- **El mapa de calor, el scroll, los rage clicks y los dead clicks.** Clarity no está integrado.
- **La tasa de conversión de la landing.** Su denominador tendría que ser gente registrada **al
  llegar**, y hoy la URL se escribe **al convertir**: la tasa daría casi 100 % por construcción.
