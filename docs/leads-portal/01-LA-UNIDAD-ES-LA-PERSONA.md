# La unidad es la persona

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional y de la **medición
> LP-0 contra producción, hecha el 2026-09-27 a las 00:10 UTC** (el 26 a las 19:10 en Lima), sólo con
> consultas agregadas y sin un solo dato personal. Cada requisito lleva el `archivo:línea` del que
> sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** En LP-6 `lib/aios/leads-portal.js` se borra
> y sus citas fallan al resolverse; `components/views/ContactsView.jsx` se reescribe y sus citas
> siguen resolviendo y muestran otra cosa. LP-7 reapunta las dos clases, como pasó en `docs/sales/`.
> Las dos citas a `lib/aios/leads-group.js` de este archivo son anteriores a la línea 56 y LP-6 no las
> mueve.

**Si se lee un solo archivo de esta carpeta, es éste.** Todo lo demás —las tarjetas, la rejilla, la
ficha, los permisos— sale de dos decisiones que están acá: que **la fila es una persona**, y que de
cada persona se dicen **tres cosas y no dos**: sí, no, o no se sabe.

---

## 1 · La fila es una persona

### LP01-01 · Una fila por contacto, y cada cifra es una cuenta de filas

**Rastro** · La maqueta ya lo hacía bien: dibuja una tarjeta por contacto
(`aios-command-center_1.html:4757-4758`), y cada tarjeta de arriba cuenta contactos, no citas
(`n = g.length`, `aios-command-center_1.html:4709`).

**Qué pide** · La fila es una fila de `negocio.contactos`. No es la cita ni el resultado: tres citas
son una persona que agendó, y dos ventas son una persona que compró (`LP02-06`). Por eso el
predicado de «agendó» es un `exists` sobre el contacto y no un `join` con `count`, que haría pesar
doble a quien tiene dos citas (`lib/negocio/citasAlcanzables.ts:122-124`). La diferencia no es
teórica: el 2026-09-20, 226 citas alcanzables eran 201 contactos
(`lib/negocio/citasAlcanzables.ts:28-30`).

Las cinco tarjetas **no tienen origen propio**: cuentan por tramo las mismas filas que la rejilla
dibuja (`LP09-04`), y los cuatro tramos suman la cohorte exacta (`LP03-03`). Medido el 2026-09-27, a
30 días: 51 + 83 + 117 + 35 = **286**.

### LP01-02 · Es la única pantalla que cuenta personas y, en la misma respuesta, dice cuáles

Las demás pantallas que publican cifras tienen otra unidad, o cuentan personas sin decir cuáles:

| pantalla | qué es una fila | rastro |
|---|---|---|
| Acquisition | el anuncio: el costo por anuncio y el monitor de atribución | `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:16-18` |
| Creative | la pieza, por el nombre del creativo | `lib/negocio/calidadDelCreativo.ts:19-21` |
| Conversion | la familia de recorrido | `lib/negocio/recorrido.ts:48-55` |
| Conversation | la conversación: audita chats | `docs/sales/13-EL-CONTRASTE.md:49-50` |
| Sales | el eslabón y el closer; su cadena cuenta contactos, pero publica cuántos, no cuáles | `docs/sales/00-MAPA.md:126-127` |
| Closer y Setter | la persona, pero la de un territorio, y un closer vinculado ve sólo sus asignados | `lib/negocio/alcanceDelCloser.ts:25-28` |

**Qué pide** · Que la cifra y su lista salgan **de la misma respuesta**. Es el requisito que
Acquisition dejó escrito para el cajón de contactos, y que el cajón nunca cumplió: una cifra y su
lista que no comparten origen se pueden contradecir sin que nada falle
(`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:448-451`). El cajón recibe un conteo y fabrica la
lista repitiendo catorce personas inventadas (`lib/aios/leads-group.js:31-37@c4cf2a8`). Esta pestaña, en
cambio, tiene la cohorte entera en el navegador (`LP04-01`), así que tocar una tarjeta filtra la
rejilla de al lado (`LP03-15`) en vez de abrir un cajón (`LP03-14`).

Es lo único que la pestaña agrega que ninguna otra tiene, y no es un cálculo: Leads Portal no
calcula ningún dato propio (`LP08-01`). Lo que agrega es **la persona puesta al lado de la cifra que
la cuenta**.

### LP01-03 · Que la fila sea una persona es también el riesgo, y ordena lo que viaja

**Rastro** · La maqueta dibuja quince personas inventadas, cada una con un teléfono y un correo de
forma real (`LP10-02`). Desde LP-4, la ruta de la pestaña devuelve personas reales. Medido el
2026-09-27, hay 593 en la empresa, y la lista alcanza hasta 569: las que tienen alta, en «Completo»
(`LP02-10`).

**Qué pide** · Lo que el usuario decidió el 2026-09-26 y desarrolla `12-QUIEN-VE-QUE.md`, leído
desde acá:

- la lista lleva **exactamente** catorce claves, y ninguna es de contacto (`LP12-05`);
- el teléfono y el correo van sólo en la ficha, que se pide por id y nunca por nombre (`LP12-07`,
  `LP05-01`);
- la atribución pasa por una lista blanca, y de las direcciones va sólo el host: 286 de 331 traen un
  token adentro (`LP09-08`);
- nada queda guardado en el almacenamiento del navegador (`LP12-09`).

Medido el 2026-09-27: **3** personas ven la pestaña hoy, y las **4** activas de la empresa ya podían
leer cualquier ficha (`LP12-03`). El portal no abre un dato que nadie pudiera ver. Lo que cambia es
que pone hasta 569 personas —todas las que tienen alta, en «Completo»— en una sola lista; las 24 sin
alta no entran en ninguna ventana (`LP02-10`). Y eso es consecuencia directa de que la unidad sea la
persona.

---

## 2 · Los predicados son los del sistema

### LP01-04 · Cinco preguntas por persona, y ninguna es propia de esta pestaña

| predicado | qué pregunta | definición | dónde vive | quién más la usa |
|---|---|---|---|---|
| **entró** | ¿su alta cae en la ventana? | `alta_en_el_crm >= now() - make_interval(days => N)` | la ventana de `lib/negocio/cadenaDeCierre.ts:169` | Sales |
| **agendó** | ¿llegó a tener una cita que el CRM todavía devuelve? | `tieneCitaAlcanzable` | `lib/negocio/citasAlcanzables.ts:135-145` | Sales (`lib/negocio/cadenaDeCierre.ts:204`), Creative (`lib/negocio/calidadDelCreativo.ts:225`), Acquisition y Conversion |
| **asistió** | ¿alguien registró que se presentó? | `citas.asistio`, que carga una persona en Avanzar | `db/migraciones/049_si_se_presento_a_la_cita.sql:43-47` | Sales, que la declara nula con su motivo (`docs/sales/02-METRICAS.md:196-204`) |
| **vendió** | ¿tiene un resultado con salida `venta`? | `salida = 'venta'`; nunca `acuerdo_sin_pago` | `lib/negocio/ventasDelContacto.ts:44-46`; la salida, en `lib/negocio/salidas.ts:84` | Sales |
| **descartado** | ¿la casa lo rechazó en el CRM? | alguna etiqueta de `ETIQUETAS_DE_DESCARTE`, comparada en minúscula | `lib/ghl/contrato.ts:228-238` | Sales, por cita (`lib/negocio/cadenaDeCierre.ts:232`) |

**Qué pide** ·

- **Se importan, no se copian** (`LP08-04`). Los dos que hoy no tienen la forma que esta pestaña
  necesita se agregan en su propio archivo y no en la consulta: `tieneVenta` sale de
  `cadenaDeCierre.ts` a `ventasDelContacto.ts` (`LP02-06`), y el descarte por contacto nace como
  hermano de `descartado`, que pregunta por el contacto **de una cita**
  (`lib/negocio/citasAlcanzables.ts:79-85`, `LP08-04`).
- **El total y los agendados coinciden con la cadena de Sales en la misma ventana**, y la prueba de
  la ruta lo vigila (`LP06-13`, `LP08-03`). Los vendidos no tienen por qué: esta pestaña cuenta a
  cualquier persona con una venta, y la cadena sólo cuenta a quien, además de una venta, tiene una
  cita cerrable y un intento registrado después de ella (`lib/negocio/cadenaDeCierre.ts:207-208`).
  La venta misma no tiene que venir después de la cita: `tieneVenta` no mira fechas
  (`lib/negocio/ventasDelContacto.ts:44-46`). El día que difieran, las dos van a estar bien
  (`LP02-06`).
- **Hay una pantalla que cuenta «agendó» distinto, y está bien escrita.** Lead Flow cuenta cualquier
  cita, congeladas incluidas, porque agendar es el evento y congelarse no lo deshace
  (`lib/negocio/indicadoresDelLead.ts:209-214`). La diferencia viaja como `solo_congeladas`
  (`LP02-03`); cuál de las dos definiciones es la del producto es `LP02-P02`.

### LP01-05 · El único predicado nuevo es una clasificación, no un hecho

El tramo —ICP alto, medio, bajo o sin calificar— es lo único que esta pestaña agrega a la lista, y
no es un hecho del mundo: es un corte nuestro sobre un número que calcula el CRM (`LP14-01`,
`LP14-05`). Por eso vive en un solo módulo, sin imports, del que lo toman la consulta, las tarjetas,
el filtro y la ficha (`LP14-06`). Y por eso **se deriva al consultar** y no se guarda: la maqueta lo
guarda al lado del puntaje, y dos filas con el mismo 79 caen en tramos distintos
(`aios-command-center_1.html:4624` y `:4644`).

Además es el de hoy: el puntaje se pisa en cada corrida, así que «30 días · ICP alto» son los que
entraron en los últimos 30 días y **hoy** tienen 75 o más (`LP06-14`).

---

## 3 · De cada persona se dicen tres cosas: sí, no, no se sabe

### LP01-06 · La maqueta sólo sabe decir sí o no, y donde no sabe escribe «no» o 0

**Rastro** · El modelo de datos de la maqueta tiene dos valores. Cada persona trae `booked`,
`showed` y `sold` como 1 o 0 (`aios-command-center_1.html:4592`, `:4649`), y todo lo que se dibuja sale de
ahí:

- el progreso «Agendó › Asistió › Vendió» tiene dos estados por paso, encendido o apagado
  (`aios-command-center_1.html:4751-4755`);
- la ficha escribe «no agendó», «no asistió» y «sin cierre» a quien no tenga la marca
  (`aios-command-center_1.html:4817-4819`), aunque su cita esté todavía por delante;
- la tasa da 0 cuando no hay denominador (`aios-command-center_1.html:4707`);
- a las tres personas sin puntaje les pone 0 en el VSL, en el precall, en fit y en intent
  (`aios-command-center_1.html:4650-4651`, `:4654-4655` y `:4658-4659`).

Con quince personas inventadas eso no le hace daño a nadie. Con las reales, medido el 2026-09-27,
**145** personas tienen una cita pasada, no cancelada y sin la asistencia registrada (es un techo:
ver `LP02-04`; con el predicado exacto, **77** de los 569 con alta). Con dos valores, esas personas se leerían «no asistió», y lo cierto es que nadie lo
cargó.

**El sistema ya tiene las palabras, en dos lugares.** La columna de asistencia se creó con la regla
escrita: nulo es *«nadie lo dijo todavía»*, `false` es «no se presentó», *«y son distintos»*
(`db/migraciones/049_si_se_presento_a_la_cita.sql:43-45`). Y la sincronización guarda el puntaje 0
como 0 y no como nulo porque **no se sabe** si el CRM calculó cero o si su proceso no corrió
(`lib/negocio/sincronizar.ts:414-420`). Esta pestaña lleva esa misma distinción a cada predicado.

### LP01-07 · La tabla de los tres valores

| predicado | sí | no | no se sabe | medido el 2026-09-27 |
|---|---|---|---|---|
| **entró** en la ventana | su alta cae adentro | su alta cae afuera | **no tiene alta**: ninguna ventana lo alcanza, ni «Completo» (`LP02-10`) | 569 con alta; **24** sin alta, los 24 congelados |
| **agendó** | tiene una cita alcanzable | no tiene ninguna cita | **tuvo cita y sólo le quedan congeladas**: agendó, y el CRM ya no devuelve en qué quedó (`cita: 'solo_congeladas'`, `LP02-03`) | de los 569 con alta, medido en LP-2: **200** sí · **290** no · **79** no se sabe (`LP09-P01`) |
| **asistió** | alguna cita con `asistio = true` | ninguna en `true` y alguna en `false` | **una cita cerrable sin respuesta** (`sin_registrar`, `LP02-04`) | sí **0** · no **0** · no se sabe, como mucho **145** |
| **vendió** | un resultado `venta` | — (ver `LP01-09`) | **sin venta registrada** | sí **0**; las 593, no se sabe |
| **descartado** | alguna etiqueta de descarte | ninguna | — (ver `LP01-11`) | **121** · 472 |

Tres reglas que salen de la tabla:

1. **El «no se sabe» nunca se dibuja como «no».** Tiene su palabra propia —«sin alta», «sólo citas
   congeladas», «sin registrar», «sin venta registrada», «sin calificar»— y es **la misma palabra**
   en la tarjeta, en la rejilla y en la ficha (`LP04-08`, `LP05-07`).
2. **El «sí» de agendó no dice que la cita siga en pie.** Una cancelada cuenta (`LP02-03`), y medido
   el 2026-09-27 hay **146** personas que sólo tienen citas canceladas (una aproximación, contada
   sobre todas sus citas y con una sola grafía de cancelada). Si se marcan aparte es `LP02-P03`.
3. **Dos fuentes de la misma respuesta no se suman.** El calendario marcó **15** plantones: son un
   «no» del proveedor, no nuestro, y viajan aparte sin convertir un «no se sabe» en «no» (`LP02-05`,
   `lib/negocio/citasAlcanzables.ts:105-109`). Si el barrido debería escribirlos como
   `asistio = false` es una pregunta que Sales dejó abierta
   (`docs/sales/01-LA-VENTA-NO-EXISTE.md:181-183`).

### LP01-08 · «No aplica» no es un cuarto valor: es que la pregunta no se hizo

La asistencia viaja con cuatro valores, y el cuarto es `null`: no hay nada que registrar, porque la
persona no tiene cita, o sólo tiene citas futuras, canceladas o congeladas (`LP02-04`). No es una
respuesta. Preguntar si alguien se presentó a una cita de mañana es pedir un pronóstico, y
preguntarlo de una cancelada es preguntar por algo que no ocurrió: son dos de las tres condiciones
con las que Avanzar decide qué cita ofrece cerrar (`docs/sales/01-LA-VENTA-NO-EXISTE.md:119-124`).

**Qué pide** · «No aplica» se dibuja **vacío**: ni «sin registrar» ni «no» (`LP05-07`, paso 4).
Confundirlo con «no se sabe» acusaría de no registrar a quien nunca tuvo nada que registrar, y por
eso `sin_registrar` exige las mismas tres condiciones que la cita cerrable de la cadena de Sales
(`lib/negocio/citasAlcanzables.ts:174-176`).

### LP01-09 · Vendió tiene «sí» y «no se sabe»; su «no» está vacío a propósito

Para Sales, un resultado es *«un INTENTO del closer, no una cita»* (`docs/sales/02-METRICAS.md:51`).
Esta carpeta lee de ahí algo más, y es lectura suya, no de Sales: un intento tampoco es un
desenlace, porque ninguna de las salidas registradas que no son venta le cierra la puerta a una
venta futura. Medido el 2026-09-27: 7 resultados en toda la base —seguimiento 4, no_show 2,
no_interesa 1— y **ninguna venta**.

**Qué pide** ·

- la pestaña nunca escribe «no compró»: escribe «sin venta registrada» (`LP04-08`);
- con cero ventas en la empresa, el cierre de un tramo es `null` con `sin_ventas_registradas`, no
  «0 %» (`LP02-07`). Un 0 % convertiría el «no se sabe» de un tramo entero en un «no»: es lo que
  Sales escribe del revenue, un «$0» que *«afirmaría que no se vendió nada»*
  (`lib/negocio/huecosDeSales.ts:60-61`).

Si algún resultado debería contar como un «no» es `LP01-P01`.

### LP01-10 · «Sin calificar» es el «no se sabe» del puntaje, y por eso el 0 está adentro

El puntaje no es sí o no: es un número. Su «no se sabe» son dos cosas distintas, y las dos van a
«Sin calificar» por decisión del usuario del 2026-09-26 (`LP14-05`, `LP14-09`):

- **el nulo**: el CRM no mandó el campo. Medido el 2026-09-27: **122**;
- **el 0**: el CRM no dice si calculó cero o si su proceso no corrió
  (`lib/negocio/sincronizar.ts:414-417`). Medido: **47**, todos de tres semanas de alta —3 en la del
  17 de agosto, 23 en la del 24, 21 en la del 31— y **ninguno en los últimos 14 días**.

Leer ese 0 como un puntaje bajo es colapsar el tercer valor en el segundo, y es lo que hacía el
único corte escrito en el sistema: con `SEG`, el nulo y el 0 caen los dos en `'bajo'`
(`lib/aios/leads-group.js:10@c4cf2a8`, `LP14-05`). El documento funcional apunta para el mismo lado: para él
el ICP es posterior al formulario, así que un lead sin puntaje no es uno de puntaje bajo, es uno que
todavía no llegó a ese paso (`LP11-14`).

**Qué pide** · Los dos «no se sabe» viajan **separados**, `sinPuntaje` y `enCero`, porque tienen
motivos distintos, y suman el tramo (`LP02-09`). El guardián `cerosRecientes` avisa si aparece un 0
nuevo, porque la regla sale de un régimen medido y puede dejar de ser cierta (`LP14-10`).

### LP01-11 · Descartado es sí o no, es un atributo de la fila, y es de la última sincronización

Acá no hay «no se sabe»: la ausencia de una etiqueta de descarte es la respuesta del CRM, no un
vacío. Medido el 2026-09-27: **121** personas con alguna de las seis etiquetas.

**Qué pide** ·

- **no saca a nadie de la cohorte**: se marca en la fila y la persona cuenta en su tramo, como la
  cadena de Sales cuenta a todos en su cohorte y en «llegaron a agendar»
  (`lib/negocio/cadenaDeCierre.ts:200-204`, `LP04-05`);
- **no mueve el tramo, y el tramo no lo absorbe**: son dos hechos distintos. Medido con
  `icp_rechazado`: ICP alto 0 · medio 22 · bajo 45 · sin calificar 1 (`LP14-11`);
- **de los 25 congelados es una foto**: sus etiquetas ya no se refrescan, y la ficha muestra cuándo se
  sincronizó cada uno por última vez (`LP05-03`, `LP05-05`).

---

## 4 · Lo que esto le pide a las cifras

### LP01-12 · Una tarjeta cuenta los «sí», y el «no se sabe» viaja al lado con su número

- Agendados, asistieron y vendidos cuentan a las personas en «sí».
- Al lado, siempre con su número: `solo_congeladas` (`LP02-03`), las personas `sin_registrar` en el
  aviso (`LP02-04`), `sinPuntaje` y `enCero` (`LP02-09`) y `sinAlta` (`LP02-10`).
- **La tasa de asistencia se calcula sobre los «sí» y los «no», sin los «no se sabe».** Es la regla
  de Sales: su denominador lleva `asistio is not null` (`docs/sales/02-METRICAS.md:48-49`). Acá ese
  denominador serían las citas con la asistencia respondida, que hoy son cero, y por eso no se
  publica (`LP03-17`); tampoco le corresponde: el show rate por ICP es de Appointment Flow
  (`LP11-16`).
- **El cierre es la excepción, y a propósito.** Vendió no tiene «no» (`LP01-09`): con la regla de la
  asistencia, su denominador estaría vacío para siempre. Por eso el cierre es vendidos sobre los
  **contactos del tramo**, con los «no se sabe» adentro —de cada cien personas del tramo, cuántas
  tienen una venta registrada—, y lleva dos resguardos: el piso de 10 sobre los contactos
  (`bajo_el_piso`), y `null` con `sin_ventas_registradas` mientras la empresa no tenga ninguna venta
  registrada, que es el caso de hoy (`LP02-07`, `LP03-12`). Sin el segundo, un 0 % convertiría en
  «no» el «no se sabe» de un tramo entero (`LP01-09`).

### LP01-13 · La ficha es la misma lista de predicados, leída de corrido

El recorrido de la ficha —Entró, Llegó por, Agendó, Asistió, Compró, y el VSL como hueco declarado
(`LP05-07`)— son los predicados de `LP01-04` en el orden en que ocurren, con los valores de
`LP01-07` y con las mismas palabras. «Llegó por» es la excepción: no contesta sí o no, es la familia
de recorrido de Conversion (`lib/negocio/recorrido.ts:139`).

La bajada de la maqueta lo resume en una frase, «Cada contacto, de dónde vino y hasta dónde llegó»
(`aios-command-center_1.html:3031`). Medido el 2026-09-27, la segunda mitad se detiene, para
casi todos, en «agendó»: cero asistencias registradas y cero ventas (`LP10-05`). La pestaña lo dice
así, en vez de dibujar «no asistió» y «no compró».

---

## Preguntas abiertas

### LP01-P01 · ¿Algún resultado es un «no» de venta?

`no_interesa` trae un motivo —Precio, No es el momento, Competencia, No califica u Otro— y se lee
como un «no». Si el producto decide que cierra la pregunta, «vendió» gana un «no» y la ficha podría
escribir algo más que «sin venta registrada». En contra: para Sales un resultado es un intento del
closer, no una cita (`docs/sales/02-METRICAS.md:51`); esta carpeta lo lee además como un intento y
no un desenlace (`LP01-09`), y hoy ese «no» se apoyaría en **una** fila. Es una decisión de Sales
antes que de esta pestaña, y mientras no se tome la pestaña escribe «sin venta registrada».

Las otras preguntas que esta idea levanta ya están escritas donde nacen, y no se repiten acá: qué
definición de «agendó» es la del producto (`LP02-P02`), si quien sólo tiene citas canceladas se marca
aparte (`LP02-P03`), y si el plantón del calendario debería escribirse como `asistio = false`
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:181-183`).
