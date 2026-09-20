# Catálogo de métricas

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el 2026-09-15, más las
> mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 0 · Cómo se lee una ficha

| Campo | Qué dice |
|---|---|
| **Qué es** | la pregunta que contesta, en una frase |
| **Fórmula** | numerador y denominador, explícitos |
| **Unidad** | porcentaje, conteo, proporción, duración |
| **Población** | **sobre quién** se calcula |
| **Rastro** | de dónde sale el requisito: `archivo:línea` |
| **Estado** | si se puede construir hoy, y con qué cobertura medida |

Y cuando corresponde, **Piso**: cuántas observaciones hacen falta antes de publicar la cifra.

**El que decide si el requisito sirve es Población**: dos cifras con la misma fórmula y distinta
población son dos cifras distintas, y ésa es la forma más barata de publicar un número falso sin que
nada falle.

---

## 1 · Las ocho reglas que valen para todas las métricas de este departamento

1. **Los ceros son tres.** No hay campo · el campo dice cero · el medidor no reportó. Un campo cuyo
   censo tiene un solo valor distinto **no es una medición: es una alarma**
   (`docs/estado actual/03-CONVERSION.md:215`).
2. **Ninguna serie cruza el 2026-08-31 sin decirlo** (`03-CONVERSION.md:219`). Ver `CV1-06`.
3. **Los hosts no se suman** (`03-CONVERSION.md:238`). Siete hosts, cinco cosas distintas.
4. **La fuente es el último toque**, no el primero (`03-CONVERSION.md:242`). Ver `CV1-02`.
5. **Ninguna tasa cuyo denominador se defina por haber convertido** (`03-CONVERSION.md:230`).
   Ver `CV1-05`.
6. **El piso es del denominador**, no del total: `PISO_DE_UNA_TASA = 10`
   (`lib/negocio/indicadoresDeCitas.ts:300`). Y acá hay que subirlo — ver `CV5-05`.
7. **Ningún identificador de GoHighLevel escrito a mano.** `campoPorNombre()`
   (`lib/negocio/camposDelCrm.ts:307-320`) es la única puerta, y devuelve `null` —no cero— si alguien
   renombra el campo (`03-CONVERSION.md:254`).
8. **El agendamiento sale de `negocio.citas`**, con el mismo `exists` sobre `ghl_calendario_id` que
   usan los otros cuatro módulos, o las pantallas no suman igual. Ver `CV2-09`.

---

## 2 · El reparto por recorrido — lo que sí se puede publicar hoy

### CV2-01 · Contactos por familia de recorrido

**Qué es** · Por dónde entró cada persona: la landing con VSL, el widget de reserva directo, el
formulario nativo de Meta, o ningún rastro.
**Fórmula** · Conteo de contactos, agrupado por la familia del host de `atribucion_ultima->>'url'`.
**Unidad** · Conteo, y su proporción sobre la cohorte.
**Población** · Contactos con `alta_en_el_crm` en la ventana. **Todos**, incluidos los que no traen
URL — ésos son su propia fila, no un descarte.
**Rastro** · `conversion.js:8-12` (el prototipo cuenta sesiones por dispositivo); regla 5 de
`03-CONVERSION.md:238`; medición `CV14-03`.
**Estado** · **Construible hoy.** `atribucion_ultima->>'url'` está en **475 de 590** contactos
(80,5 %). Es la cifra que contesta la pregunta más grande que la pantalla puede hacerse hoy, y
ninguna otra pantalla la publica.

### CV2-02 · Tasa de agenda por recorrido

**Qué es** · De los que entraron por cada camino, cuántos llegaron a tener una cita alcanzable.
**Fórmula** · Contactos de la familia con al menos una cita alcanzable / contactos de la familia.
**Unidad** · Proporción.
**Población** · Contactos con `alta_en_el_crm` en la ventana, por familia.
**Piso** · `PISO_DE_UNA_TASA`, **sobre el denominador de cada familia**, no sobre la cohorte total.
**Rastro** · `conversion.js:195-197` dibuja `Agendan` sobre visitas; `03-CONVERSION.md:142`.
**Estado** · **Construible hoy**, con el `exists` de `costoDelAnuncio.ts:341-344`. Cuidado con el
piso: en septiembre la familia `landing` son 31 contactos y cualquier segundo corte cae debajo.

### CV2-03 · La cobertura del recorrido

**Qué es** · Sobre cuántos contactos de la cohorte se puede decir por dónde entraron.
**Fórmula** · Contactos con `url` en `atribucion_ultima` / contactos de la cohorte.
**Unidad** · Los **dos términos**, siempre, no sólo la proporción.
**Población** · La cohorte entera.
**Rastro** · `§ 18.5:1247` del documento funcional; el patrón `puente` de
`lib/negocio/calidadDelCreativo.ts:291-317`.
**Estado** · **Construible hoy**: 475 de 590 (80,5 %). **No es una muestra al azar** — ver `CV1-P01`.

---

## 3 · El embudo del formulario

### CV2-04 · Los tres estados del formulario

**Qué es** · De los que llegaron al formulario, cuántos lo abandonaron, cuántos lo completaron sin
agendar y cuántos agendaron.
**Fórmula** · Conteo por valor de `Form Landing VSL`, que es un vocabulario cerrado de tres.
**Unidad** · Conteo y proporción.
**Población** · Contactos que traen el campo. **No la cohorte entera**: quien no llegó al formulario
no tiene el campo, y meterlo en el denominador mezclaría dos preguntas.
**Rastro** · `conversion.js:192-194` (`Empiezan el form`); `03-CONVERSION.md:144-146`; medición
`CV14-08`.
**Estado** · **Construible, y la población murió el 2026-08-31.** Medido: `Agendado` 121, `Form
incompleto sin agendar` 87, `Form completo sin agendar` 39. **Cero contactos de septiembre lo
traen.** Va con su `corteDeEpoca` al lado, siempre.

### CV2-05 · Tasa de finalización del formulario

**Qué es** · La única frase que el documento funcional le atribuye a Conversion.
**Fórmula** · (`Agendado` + `Form completo sin agendar`) / contactos con el campo.
**Unidad** · Proporción.
**Población** · Contactos que traen `Form Landing VSL`.
**Piso** · `PISO_DE_UNA_TASA`.
**Rastro** · `CC_Arquitectura_Funcional.md:1425` — *«Conversion: La finalización del formulario es
baja»*. Y el `§ 9.7:611`, donde figura como KPI de **Lead Flow** — ver `CV1-P02`.
**Estado** · **Construible sobre la cohorte histórica.** Medido: **(121 + 39) / 247 = 64,8 %**, o sea
**35,2 % de abandono**. Es la respuesta literal a la frase del documento.

### CV2-06 · Lo que no cae en ninguna rama se cuenta aparte

**Qué es** · Cuántos contactos traen el campo con un valor que no es ninguno de los tres conocidos.
**Fórmula** · Conteo de valores fuera del vocabulario.
**Unidad** · Conteo.
**Población** · Contactos que traen el campo.
**Rastro** · Regla 4 del departamento, `03-CONVERSION.md:234`; el precedente de
`lib/negocio/consumoDelPrecall.ts:74-85` con `-20%`, `Clic a link` y `Accede: sin reproducir`.
**Estado** · **Obligatorio.** `negocio.campos_del_crm` **no guarda las opciones declaradas** de un
campo, así que contar los huérfanos es la única forma de enterarse de que el CRM agregó un cuarto
valor. Hoy son cero, y por eso hay que contarlos: el día que no lo sean, nadie lo va a notar de otra
manera.

---

## 4 · Las cifras del prototipo que NO tienen fuente

### CV2-07 · Un tipo de dato ausente no es un cero

**Qué es** · La regla que separa este catálogo de la maqueta.
**Rastro** · Regla 1, `03-CONVERSION.md:215`.
**Estado** · El caso que lo prueba: `VSL % máximo visto` se escribió **79 veces y las 79 dicen `0`**.
Publicar «0 % de visionado promedio» sería técnicamente cierto y completamente engañoso. Va como
**alarma**, no como cifra. Ver `CV11-04`.

### CV2-08 · Las bandas de «lo esperado» declaran una metodología que no existe

**Qué es** · La zona verde contra la que el prototipo compara cada paso.
**Fórmula del prototipo** · Ninguna: son **24 literales** en `BANDS` (`conversion.js:21-25`).
**Rastro** · El comentario de `conversion.js:18-20` declara la metodología: *«Se calcula con la
mediana de los últimos 90 días: p25 a p75 del propio histórico. Se guarda por dispositivo porque el
comportamiento es muy distinto.»*
**Estado** · **No hay ningún cálculo.** La frase describe un procedimiento que el archivo no ejecuta.
Y aunque se ejecutara, los 90 días cruzarían el corte del 2026-08-31 dos veces. **La forma es el
requisito** —comparar cada cifra contra su propio histórico es una buena idea— pero el umbral hay que
calibrarlo y declarar que no lo está, como hizo Creative con `PISO_DE_IMPRESIONES`
(`lib/negocio/rendimientoDelCreativo.ts:51-66`).

### CV2-09 · «Calificadas» tiene DOS fuentes en la misma pantalla, y dan números distintos

**Qué es** · Cuántas de las citas agendadas valen la pena.
**Fórmula del prototipo** · **Dos, incompatibles.** El panel de cabecera usa
`Math.round(d.agenda * 0.63)` con `const califica = 0.63` (`conversion.js:163-164`); el recorrido y
el cajón usan `CV.calificados` (`:9-11`, leído en `:227` y `:486`).
**Estado** · **Con `hist` la pantalla se contradice a sí misma**: el panel dice **482** calificadas y
el cajón dice **479**; «No calificadas» dice 283 arriba y 286 abajo. Y la Lectura del cajón de Agenda
afirma *«Las 84 restantes»* (`conversion.js:500`), que es un tercer número literal.

**El requisito que sobrevive** es que el ICP del lead califique la cita — y eso **ya existe**:
`lib/negocio/calidadDelCreativo.ts:61` resuelve `Puntaje | ICP` con 344 de 344 contactos de treinta
días. **Conversion lo consume, no lo recalcula** (`§ 2.4` del documento funcional).

Y el `0.94` del comparativo (`conversion.js:165`) no tiene justificación ni comentario en ninguna
parte.

### CV2-10 · Las cifras sin unidad ni denominador

**Qué es** · `Rage clicks 84`, `Dead clicks 37`, `Rebote bajo 3s 48` (`conversion.js:405-407`).
**Estado** · Se pintan como enteros pelados: no dicen si son sesiones, eventos o personas, ni sobre
cuántas. Un entero sin denominador no se puede comparar entre períodos ni entre dispositivos, que es
para lo único que serviría. **Y ninguna de las tres tiene fuente**: Clarity no está integrado
(`CV9-03`).

### CV2-11 · El abandono campo por campo no escala con el período

**Qué es** · La tabla `Nombre 308 · WhatsApp 296 · Facturación mensual 285 (−83) · Tipo de agencia
202 · Objetivo a 90 días 184` (`conversion.js:134-137`, dibujada en `:472`).
**Estado** · **Los cinco números son fijos** y no se multiplican por `FACTOR`, mientras la cabecera
del mismo cajón dice `Lo iniciaron` con `d.form` escalado. Con `hist` la cabecera dice **1.047** y la
tabla arranca en **308**: el embudo de campos contradice su propio encabezado en la misma pantalla.

**El requisito es real y no tiene fuente**: GoHighLevel **no expone endpoint de formularios ni de
encuestas** — ninguna de las catorce operaciones de `lib/ghl/` los toca. Sin instrumentar el
formulario, el abandono por campo no existe.

---

## 5 · Las tasas de cada paso

### CV2-12 · «Dan play al VSL», «Empiezan el form», «Agendan» — todas sobre visitas

**Qué es** · Las tres tasas de la tira de cabecera.
**Fórmula del prototipo** · `pct(d.vsl, d.sesiones)`, `pct(d.form, d.sesiones)`,
`pct(d.agenda, d.sesiones)` (`conversion.js:182-197`). Las tres sobre el mismo denominador.
**Población** · Visitas a la landing.
**Estado** · **El denominador no existe** (`CV1-01`) y, si se aproximara con «contactos con URL de
landing», sería circular (`CV1-05`). De las tres, sólo «Agendan» tiene fuente propia
—`negocio.citas`— y su denominador honesto es la cohorte, no las visitas.

Elegir el mismo denominador para los tres pasos es, además, la decisión correcta **cuando hay un solo
camino**: permite leer la cadena como un embudo. Con dos caminos deja de serlo (`CV1-04`).

### CV2-13 · La caída entre pasos, en personas

**Qué es** · El `−N` que cada tarjeta publica abajo a la derecha (`conversion.js:286`).
**Fórmula** · `vals[i-1] - vals[i]`.
**Unidad** · Conteo de personas.
**Estado** · **Es la mejor idea del prototipo.** Un porcentaje dice dónde está el problema; una resta
en personas dice **cuánto cuesta**. Se conserva como requisito, y se calcula entre etapas de la misma
población — nunca entre familias de recorrido distintas, que no son etapas.

---

## 6 · Lo que el prototipo mide y pertenece a otro departamento

### CV2-14 · El consumo del video precall

**Estado** · Es el `§ 10.6` —**Appointment Flow**— y ya está construido en
`lib/negocio/consumoDelPrecall.ts` con su población (`:188-196`), su piso (`:230-233`) y su aviso de
campo ausente (`:151-159`). El prototipo lo dibuja en el paso «Gracias» como «video de bienvenida»
(`conversion.js:543-546`). **Conversion no publica su propia versión.** Ver `CV1-09`.

### CV2-15 · `Confirmadas`, `Canceladas` y `Franja preferida`

**Estado** · `conversion.js:487-489`. `Confirmadas` es `agenda × 0.78` con el `0.78` literal;
`Canceladas` es `6%` literal; `Franja preferida` es la cadena `9-11h`. Las tres son de **citas**, o
sea de `lib/negocio/indicadoresDeCitas.ts`, que ya publica la confirmación con
`CAMPO_DE_CONFIRMACION` (`:199`) y la cancelación partida en dos poblaciones (regla 9 de
`07-REGLAS-TRANSVERSALES.md:383`).

---

## 7 · Índice del catálogo

| id | métrica | ¿construible hoy? |
|---|---|---|
| `CV2-01` | Contactos por familia de recorrido | **sí** — 475 de 590 |
| `CV2-02` | Tasa de agenda por recorrido | **sí**, con piso por familia |
| `CV2-03` | Cobertura del recorrido | **sí** — obligatoria al lado de las dos de arriba |
| `CV2-04` | Los tres estados del formulario | **sí sobre el histórico**; cero en septiembre |
| `CV2-05` | Tasa de finalización del formulario | **sí** — 64,8 % medido |
| `CV2-06` | Valores fuera del vocabulario | **sí**, y es obligatorio contarlos |
| `CV2-07` | El VSL | **no** — 79 escrituras, 79 ceros. Va como alarma |
| `CV2-08` | Bandas de «lo esperado» | **la forma sí, el umbral hay que calibrarlo** |
| `CV2-09` | Citas calificadas por ICP | **sí, consumiendo `calidadDelCreativo`** |
| `CV2-10` | Rage clicks, dead clicks, rebote | **no** — Clarity no está integrado |
| `CV2-11` | Abandono campo por campo | **no** — GHL no expone formularios |
| `CV2-12` | Las tres tasas sobre visitas | **no** — el denominador no existe |
| `CV2-13` | Caída entre pasos, en personas | **sí**, dentro de una misma población |
| `CV2-14` | Consumo del precall | **sí, pero es de Appointment Flow** |
| `CV2-15` | Confirmadas / canceladas / franja | **sí, pero son de `indicadoresDeCitas`** |

---

## Preguntas abiertas

### CV2-P01 · ¿Con qué se calibran las bandas de «lo esperado»?

El prototipo declara p25–p75 de los últimos 90 días y no lo calcula. Noventa días de historia
cruzarían el corte del 2026-08-31 **dos veces**, así que el histórico propio no sirve como línea base
hasta que haya noventa días de una sola ruta. Las dos salidas honestas son las de `C2-P01` de
Creative: elegir un valor, escribir su justificación al lado y **declarar que no está calibrado**; o
no publicar la banda y publicar la serie. No hay una tercera.

### CV2-P02 · ¿El «dispositivo» es un corte de primera clase?

El prototipo lo ofrece como filtro permanente (`ConversionView.jsx:66-79`) y guarda bandas distintas
por dispositivo (`conversion.js:21-25`). Medido en `03-CONVERSION.md:156`: el dispositivo **se puede
derivar hoy** del `userAgent`, sobre 162 citas → 107 móvil, 14 escritorio, 41 sin dato. Pero el
cohorte de escritorio son **14**, y la regla 8 del departamento
(`03-CONVERSION.md:250`) dice que cualquier segundo corte cae bajo el piso inmediatamente: *«O se
publica sin desglose, o no se publica.»*
