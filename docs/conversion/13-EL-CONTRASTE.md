# El prototipo contra el documento contra lo medible hoy

> Este archivo **no agrega requisitos**: cruza los que ya están. Cada fila se cita por su número
> completo. Medición propia del 2026-09-20.

---

## 1 · Las tres fuentes no coinciden, y eso es el mapa

| | el prototipo dibuja | el documento pide | se puede hoy |
|---|---|---|---|
| **La unidad** | sesiones (`CV1-01`) | `Landing Session`, `VSL Session`, `Form Submission` (`CV10-04`) | **contactos** — ninguna de las tres entidades existe |
| **El recorrido** | una cadena de cinco pasos (`CV3-01`) | la misma cadena (`CV10-06`) | **dos recorridos alternativos** (`CV1-04`) |
| **El denominador** | visitas a la landing (`CV2-12`) | no lo define | la cohorte de contactos |
| **El VSL** | curva de retención con 89 literales (`CV4-04`) | *«cuando exista tracking individual verificable»* × 2 (`CV10-10`) | **nada: 79 escrituras, 79 ceros** (`CV11-04`) |
| **El formulario** | abandono campo por campo (`CV4-05`) | *«la finalización del formulario es baja»* (`CV10-02`) | **los tres estados, hasta el 2026-08-31** (`CV2-04`) |
| **El responsable** | `Kevin · técnico` (`CV6-08`) | no lo nombra (`CV12-01`) | — |
| **Las fuentes** | `Clarity` y `VTurb`, con punto de conectadas (`CV9-03`) | no las menciona | **ninguna de las dos existe** |

**Donde las tres coinciden, hay requisito firme.** Donde el prototipo va solo, hay que decidir. Donde
el documento va solo, hay que construir. Donde sólo la medición va, hay un hallazgo que nadie había
pedido — y ése es el caso de `CV14-01`.

---

## 2 · Lo que las tres fuentes piden y se puede

### CV13-01 · La finalización del formulario

El prototipo la dibuja (`Empiezan el form`, `conversion.js:194-196`), el documento la nombra en la
única frase que le atribuye a Conversion (`:1427`), y está medida: **64,8 %, con 35,2 % de
abandono**. Es la métrica más firme de la carpeta.

### CV13-02 · El agendamiento como último paso

El prototipo lo dibuja (`Agendan`), el documento lo pone como final del recorrido (`§ 1:36`,
`§ 9.2:476`), y `negocio.citas` es la única fuente propia, viva y completa del departamento.

### CV13-03 · La caída entre pasos, en personas

El prototipo la publica (`CV3-06`), el documento la pide implícitamente al exigir que cada
recomendación muestre *«qué se detectó, qué datos la respaldan»* (`§ 2.6:106-114`), y se puede
calcular sobre cualquier par de etapas de la misma población.

---

## 3 · Lo que el prototipo pide solo, y hay que decidir

### CV13-04 · El corte por dispositivo

El prototipo lo hace filtro de primera clase y guarda bandas distintas por dispositivo. El documento
no lo menciona para Conversion. **Se puede derivar** del `userAgent` (121 de 162 citas), pero el
cohorte de escritorio son 14 y cualquier segundo corte cae bajo el piso (`CV2-P02`).

### CV13-05 · La banda de «lo esperado»

El prototipo la inventa con 24 literales y una metodología que no ejecuta. El documento no define
ningún umbral para Conversion. **La forma es requisito, el umbral no está calibrado** (`CV2-P01`).

### CV13-06 · El plan de tres acciones

El prototipo lo arma con un coeficiente de recuperación del 45 % que nadie midió (`CV6-06`). El
documento pide medición de impacto (`§ 14:1003-1018`) pero no un estimador previo. **O se calibra y
se declara, o se publica la pérdida sin la recuperación.**

---

## 4 · Lo que el documento pide solo, y no está construido

### CV13-07 · La traza `visitor_id → session_id`

`§ 5.2:228-235` y `§ 16.2:1095-1096`. **Cero coincidencias en todo el repositorio.** Es el eslabón
que convertiría a Conversion de un departamento de contactos en uno de sesiones.

### CV13-08 · El historial de reproducción

`§ 5.3:265`: *«Los eventos de reproducción no deben guardarse únicamente como un valor fijo en el
contacto»*. Lo que hay es exactamente lo que esa frase prohíbe, y además está en cero.

### CV13-09 · Los seis estados del trigger link

`§ 9.5:529-549`. Hoy se distingue uno —`Trigger Link` en `atribucion_ultima`, 29 de 584— y los otros
cinco no dejan rastro.

---

## 5 · Lo que sólo la medición aporta

### CV13-10 · El cambio de ruta del 2026-08-31

Ni el prototipo ni el documento lo contemplan: los dos describen **un** recorrido. La medición dice
que hay dos y que el mayoritario cambió en una semana (`CV14-01`, `CV14-02`).

**Es el hallazgo más grande de esta carpeta**, no estaba pedido por nadie, y reordena todo lo demás:
cuatro de los cinco pasos del prototipo miden la ruta que el 87 % de la gente ya no usa.

### CV13-11 · La columna que nadie lee

`atribucion_ultima` está poblada en 475 de 590 contactos y **ningún módulo del repositorio la
consulta** (`CV14-04`). El prototipo no sabe que existe; el documento no la nombra. Es la mejor
fuente del departamento y está a la vista desde la migración `048`.

### CV13-12 · El campo del formulario dice 121 y las citas dicen 47

Ni el prototipo ni el documento anticipan que el CRM y el calendario puedan discrepar. Medido,
discrepan por 74 contactos, y 72 de ésos son citas congeladas (`CV14-09`). **Publicar el campo como
fuente de agendamiento habría creado la tercera cifra de agendamiento del producto.**

---

## 6 · El resumen, en tres líneas

- **De los cinco pasos que el prototipo dibuja, uno tiene fuente completa** (`Agenda`), uno la tuvo
  hasta el 2026-08-31 (`Formulario`), uno la tiene parcial (`Landing`) y dos no la tienen (`VSL`,
  `Gracias`).
- **De los dos submódulos que el documento le da, uno no se puede construir** (`VSL Intelligence`).
- **Y lo que sí se puede publicar hoy, ninguna de las dos fuentes lo pidió**: por dónde entra la
  gente, y cuándo cambió.

---

## Preguntas abiertas de esta carpeta, juntas

| id | pregunta |
|---|---|
| `CV1-P01` | ¿Los 115 sin URL son una cuarta familia o un agujero en el denominador? *(`CV14-P03` remite acá)* |
| `CV1-P02` | ¿Quién es el dueño de `form completion rate`, Conversion o Lead Flow? |
| `CV2-P01` | ¿Con qué se calibran las bandas de «lo esperado»? |
| `CV2-P02` | ¿El dispositivo es un corte de primera clase, con 14 de escritorio? |
| `CV3-P01` | ¿El recorrido directo tiene etapas medibles? |
| `CV3-P02` | ¿El paso «Gracias» es de este departamento? |
| `CV4-P01` | ¿Cuántos cajones sobreviven, y son «por paso» o «por población»? |
| `CV5-P01` | ¿Hace falta una quinta ventana, «desde el corte»? |
| `CV6-P01` | ¿Una fricción es una entidad persistida? |
| `CV7-P01` | ¿Qué es «calidad del tráfico»? |
| `CV8-P01` | ¿La URL se puede renderizar, o sólo su host y sus UTM? |
| `CV10-P01` | ¿El paso «Gracias» está en el documento? |
| `CV11-P01` | ¿Cuándo vuelve a tener sentido VSL Intelligence? |
| `CV11-P02` | ¿La retención del VSL es de Conversion o de Creative? |
| `CV12-P01` | ¿Quién es el responsable de Conversion? |
| `CV12-P02` | ¿La pantalla la mira alguien hoy? |
| `CV14-P01` | ¿El cambio de ruta del 2026-08-31 fue deliberado? |
| `CV14-P02` | ¿El widget de reserva deja rastro de algo más que la llegada? |

**Dieciocho preguntas abiertas.** Acquisition tuvo menos y Creative también, y el motivo está en
`CV10-11`: este departamento no tiene especificación. Tres de ellas —`CV14-P01`, `CV12-P01` y
`CV3-P01`— **no se pueden contestar desde la base**: se contestan preguntando.
