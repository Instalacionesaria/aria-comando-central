# Conversation — el front original, con los datos reales

> Requisitos nuevos del **2026-10-10**, pedidos por el usuario: la pestaña vuelve al front del prototipo
> —`aios-command-center_1.html`, sección `#v-conversation`— **con la estética al 100 %**, y se llena con lo que el
> backend junta hoy. Es el camino de Acquisition (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`),
> Conversion (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`) y Sales
> (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), con lo que el usuario pidió en la segunda ronda de Sales
> desde el primer día: **es un tablero**. Prefijo `CN1-`. Formato: Qué es / Fórmula / Rastro / Estado. Lo construido
> hasta hoy está en `00-LO-QUE-SE-HIZO.md`.

---

## 1 · Qué se pidió, y las decisiones que lo ordenan

**El prototipo** (`aios-command-center_1.html:2865-2929`, y su JS en `aios-command-center_1.html:5734-6288`) dibuja:

- **el encabezado**: «Conversation», la bajada «Dos misiones, cuatro agentes · agendar y hacer que asistan», un
  selector de dos modos —Estado y Agentes—, el botón «Plan de acción» sin oyente, «vs los 7 días previos», el
  segmentado Hoy / 7 días / 30 días —con la clave inválida `mes`— y la píldora «Personalizado»;
- **tres paneles de cifras**: Lead Flow, Appointment Flow y «De qué está hecho el grupo que asistió», por ICP;
- **el modo Estado**: dos tarjetas, la de Lead Flow con su cadena de cuatro pasos y la de Appointment Flow con la
  suya de tres y tres bloques —las salidas antes de la llamada, la asistencia por calidad y de dónde viene la cita—;
- **el modo Agentes**: cuatro tarjetas —Lead Flow texto y voz, Appointment Flow texto y voz—, la lista «Qué
  corregir» y cajones con chats y prompts.

Todas las cifras están escritas a mano y varias no cierran entre sí: los asistentes por ICP suman 74 contra 138, el
agente de texto de Lead Flow dice 58 % de agendados sobre 346 cuando la cadena dice 121. Tiene nombres de personas,
que no se copian a ninguna parte.

Sus reglas siguen en `app/aios.css`: el bloque de Conversation (`app/aios.css:1728-1856`), `.iss*`
(`app/aios.css:1901-1924`), `.org-*` (`app/aios.css:1933-1941`), `.cs-view` (`app/aios.css:1944`) y `.pn*`
(`app/aios.css:1948-1975`).

### Decidido por el usuario el 2026-10-10

| tema | decisión | requisito |
|---|---|---|
| Los modos | **Estado y Agentes, como el prototipo**, con los datos de los flujos. **Auditoría y Prompts siguen aparte**, como hoy: dos modos más, fuera del diseño del prototipo | CN1-03, CN1-13 |
| El tercer panel | **El grupo que agendó, por ICP**: la asistencia está marcada en 0 citas | CN1-08 |
| Las flechas | **Ninguna**, como Sales | CN1-04 |
| El «Plan de acción» | **Sí, con el plan real** del detector | CN1-14 |
| Debajo de un «—» y los avisos | **Una línea corta**; los avisos y las notas los da el agente de Conversation, como pidió el usuario en la segunda ronda de Sales | CN1-05 |

### Tomado por defecto, y que se confirma en la revisión de este documento (§ 6)

| tema | lo que se toma | pregunta |
|---|---|---|
| Las ventanas | **Rodantes, como hoy**, con los cuatro períodos del sistema | `CN1-P01` |
| El piso | **Toda tasa de la pantalla lleva el piso de 10**, también las que hoy no lo tienen | `CN1-P02` |
| Las tarjetas de agente | Cifras del flujo, no del agente, con su desvío declarado; las de voz, «—» | `CN1-P03` |
| De dónde viene la cita | «Conversaron antes» y «Se agendaron solos», de lo que ya mide la cadena del lead | `CN1-P04` |
| Lo que el prototipo no tenía | Debajo, una fila «Lo demás, en cifras»: la respuesta, fuera de horario, el precall y el sentimiento | `CN1-P05` |
| Los cajones y «Qué corregir» | Sin cajones en Agentes; «Qué corregir · {N} por resolver» lleva al modo Auditoría | `CN1-P06` |

---

## 2 · Qué dato va en cada lugar del prototipo

Las cifras de la columna «medido» son del **2026-09-28**, de la foto `docs/OTROS/estado actual/04-CONVERSATION.md`, a
30 días. La medición nueva, del 2026-10-10, va debajo de la tabla.

| lugar del prototipo | dato | fuente | medido el 2026-09-28 |
|---|---|---|---|
| Panel Lead Flow | contactos de la cohorte y cuántos agendaron | `indicadoresDelLead` | 277 contactos, 139 agendaron (50,2 %) |
| Panel Appointment Flow | citas ocurridas y cuántas asistieron | `tasaDeCancelacion` | 106 citas; asistencia sin marcar: «—» |
| Panel del ICP | quienes agendaron, por tramo | `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`) | no medido |
| Tarjeta Lead Flow | el booking rate y la cadena Entraron → Les escribimos → Respondieron → Agendaron | `indicadoresDelLead` | 277 → 270 → 161 → 139 |
| Tarjeta Appointment Flow | Agendaron → Confirmaron → Asistieron, las salidas, la calidad y el origen | `tasaDeCancelacion`, `indicadoresDelLead` | cancelación 34,9 %; asistencia «—» |
| Agentes | dos tarjetas de texto con cifras del flujo y su sentimiento; dos de voz en «—» | los flujos, `sentimientoPorFlujo` | `negocio.llamadas` vacía |
| Lo demás, en cifras | la respuesta (p50), fuera de horario, el precall y el sentimiento molesto | `indicadoresDelLead`, `atribucionDelLead`, `consumoDelPrecall`, `sentimientoPorFlujo` | — |

### Lo que la medición del 2026-10-10 agregó

Medido con el OK del usuario, con `scripts/supabase.mjs leer` (sólo lectura, sólo conteos), en la única organización con
datos, con los predicados de cada módulo:

| ventana | contactos | les escribimos | respondieron | agendaron | ICP de quienes agendaron (alto · medio · bajo · sin calificar) |
|---|---|---|---|---|---|
| 7 días | 7 | 6 | 4 | 4 | 0 · 0 · 0 · 4 |
| 30 días | 58 | 52 | 35 | 35 (60 %) | 7 · 7 · 6 · 15 |
| toda la historia | 596 | 542 | 306 | 300 | 86 · 98 · 78 · 38 |

| ventana | citas ocurridas | canceladas | reprogramadas | con la asistencia marcada |
|---|---|---|---|---|
| 7 días | 12 | 4 | 2 | 0 |
| 30 días | 56 | 15 | 7 | 0 |
| toda la historia | 169 | 63 | 17 | 0 |

- **El sentimiento**: Appointment Flow tiene 8 análisis juzgados en 30 días —1 positivo, 6 neutrales, 1 molesto—, bajo el
  piso de 10, así que va en «—»; Lead Flow no tiene ninguno (sus 4 análisis de 30 días no son auditables).
- **El auditor**: 26 hallazgos abiertos de Appointment Flow en 7 patrones, y 1 de Lead Flow.
- **Lo que esto dice del diseño**: en 7 días casi toda tasa queda bajo el piso, como se esperaba (CN1-04); un cuarto de
  los que agendaron en 30 días no tiene ICP, así que la fila «sin calificar» del panel pesa; y la asistencia sigue sin
  marcarse.
- La confirmación no se midió: es un campo del CRM y se lee en CN-1 con su módulo.
- **Una aproximación de esta medición**: el ICP se contó con los cortes de 75 y 50 en SQL, con el puntaje 0 dentro de
  «bajo». `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`) lo cuenta como «sin calificar», y la pantalla usa esa
  función: puede mover algún contacto de «bajo» a «sin calificar».

---

## 3 · Los requisitos

### CN1-01 · La estética es la del prototipo, sin capas encima

**Qué es** · Los modos Estado y Agentes se dibujan con las clases del prototipo y en su orden: `cre-head`,
`cs-panels` con tres `.pn`, las dos `.csf` en Estado y las cuatro `.csa` en Agentes. La sección **no lleva
`estetica-op`**, y `#v-conversation` sale de los `:is()` de `app/inteligencia-estetica.css`, que hoy repintan esas
mismas clases.

**Fórmula** · Lo nuevo va en una hoja propia, `app/conversation.css`, acotada a `#v-conversation`. Los modos Auditoría
y Prompts conservan su aspecto de hoy: su contenido va dentro de un contenedor que lleva la estética de operación, y
sus reglas de `app/auditoria.css` no cambian.

**Rastro** · El prototipo: `aios-command-center_1.html:2865-2929`. La pantalla de hoy:
`components/views/ConversationView.jsx:46` y `components/conversation/PanelDeConversation.jsx:95`.

**Estado** · Por construir (CN-3).

### CN1-02 · Frases cortas, de una lista cerrada

**Qué es** · Los huecos y los estados usan **sólo** estas frases:

| situación | texto |
|---|---|
| cifra o tasa sin dato, o bajo el piso | «—» |
| la asistencia, en los paneles y en las tarjetas | «Nadie marca la asistencia.» |
| una tasa con menos de 10 casos | «Pocos casos para una tasa.» |
| el paso de la landing, que no tiene enlace con seguimiento | «Sin enlace con seguimiento.» |
| un agente de voz | «Sin llamadas registradas.» |
| el sentimiento sin análisis en la ventana | «Sin análisis en esta ventana.» |
| la cohorte vacía | «Sin contactos en este período» |
| sin citas en la ventana | «Sin citas en esta ventana.» |
| la primera carga | «Cargando…» |
| la lectura falló | «No se pudo leer. Reintenta.» |

**Los desvíos de rótulo, declarados** ·

| en el prototipo | acá | por qué |
|---|---|---|
| «Contactos sin cita» | «Contactos» | la cohorte de la ventana; los sin cita son la diferencia, y el panel ya dice cuántos agendaron |
| «De qué está hecho el grupo que asistió» | «De qué está hecho el grupo que agendó» | la asistencia está marcada en 0 citas; decisión del usuario |
| el paso «Abrieron» de Lead Flow | igual, en «—» | falta el enlace con seguimiento (`docs/OTROS/futuro/lo-que-conversation-no-mide.md`) |
| «Los rescató Lead Flow» y «Se agendaron solos» | «Conversaron antes» y «Se agendaron solos» | se mide si hubo conversación antes de agendar, no qué agente la tuvo (CN1-10) |
| la cifra grande de cada agente de texto | la respuesta de Lead Flow y la confirmación de Appointment Flow | son cifras del flujo: ningún mensaje dice qué agente lo escribió (CN1-11) |

**Estado** · Por construir (CN-3): la lista vivirá en `FRASE` de `components/conversation/comun.jsx`, y una prueba nueva
exigirá que las dos coincidan en las dos direcciones.

### CN1-03 · El encabezado

**Qué es** · «Conversation» y la bajada del prototipo. El selector de modos con **Estado · Agentes · Auditoría ·
Prompts**: los dos primeros son el prototipo y los dos últimos, la pantalla de hoy. En `.ch-r`, el «Plan de acción»
real (CN1-14) y el segmentado.

- **Sin «Personalizado»**, sin la clave `mes` y **sin «vs los 7 días previos»**: no hay flechas (CN1-04).
- El segmentado vale para Estado y Agentes; en Auditoría y Prompts se comporta como hoy.

**Estado** · Por construir (CN-3).

### CN1-04 · Las ventanas y el piso

**Qué es** · Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), con 30 días por omisión, **rodantes**
como hoy. **Sin comparación** contra la ventana anterior.

**El piso** · Toda tasa que la pantalla dibuja lleva el piso de 10 sobre su denominador (`PISO_DE_UNA_TASA`): bajo el
piso, «—» con «Pocos casos para una tasa.». Hoy el booking rate, la respuesta, la cancelación y el reagendamiento no
lo aplican (`docs/OTROS/estado actual/04-CONVERSATION.md`, riesgo 16). Se aplica en la lectura de la pantalla, no en
las funciones, que comparten otras pantallas.

**Estado** · El piso, construido el 2026-10-10 (CN-1): `tasa` de `lib/negocio/lecturaDeConversation.ts`, que calcula cada
proporción desde los conteos, de 0 a 1.

### CN1-05 · Sin párrafos en la pantalla

**Qué es** · Cifras grandes con su rótulo y, debajo de un «—», una línea de CN1-02. No se dibujan los avisos del
servidor, las notas de cada cifra, el texto de cada ventana ni la caja de lo que falta de cada flujo
(`components/conversation/PanelDeConversation.jsx:95`). Viajan igual en la respuesta y en las herramientas del cerebro:
el agente de Conversation es quien explica. Es el `S15-18` de Sales, desde el primer día.

**Estado** · Por construir (CN-3).

### CN1-06 · El panel de Lead Flow

**Qué es** · «Contactos»: la cohorte de la ventana. «Agendó»: cuántos agendaron, con el booking rate debajo.

**Fórmula** · `indicadoresDelLead` (`lib/negocio/indicadoresDelLead.ts:196`): la cohorte y `agendaron`; la tasa con su
piso.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-07 · El panel de Appointment Flow

**Qué es** · «Citas totales»: las citas ocurridas de la ventana. «Asistieron»: las citas con la asistencia marcada
como presente; sin ninguna marcada, «—» con «Nadie marca la asistencia.».

**Fórmula** · `tasaDeCancelacion` (`lib/negocio/indicadoresDeCitas.ts:341`): `citas`, `conAsistencia` y
`sePresentaron`.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-08 · El panel del ICP

**Qué es** · «De qué está hecho el grupo que agendó»: quienes agendaron en la ventana, por tramo de ICP —alto, medio y
bajo, y los sin calificar aparte—, con su porción.

**Fórmula** · La misma cohorte de `indicadoresDelLead`, por `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`), con
los cortes de 75 y 50 (`lib/negocio/tramosDelIcp.ts:38`) y el puntaje 0 como sin calificar: `icpDeLosAgendados`, en
`lib/negocio/lecturaDeConversation.ts`, agrupa los puntajes con la función y no copia sus umbrales en SQL.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-09 · La tarjeta de Lead Flow

**Qué es** · El KPI «% contacto a agenda» —el booking rate— y la cadena de cuatro pasos del prototipo: **Entraron → Les
escribimos → Respondieron → Agendaron**. El paso del prototipo «Abrieron» (la landing) va en «—» con «Sin enlace con
seguimiento.».

**Fórmula** · `indicadoresDelLead`: la cohorte, `escritos`, `respondieron` y `agendaron`, cada uno con su porción de la
cohorte, calculada en el servidor.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-10 · La tarjeta de Appointment Flow

**Qué es** · El KPI «% agenda a asistencia», en «—» mientras nadie marque la asistencia, y la cadena **Agendaron →
Confirmaron → Asistieron**. Debajo, los tres bloques del prototipo:

| bloque | dato | fuente |
|---|---|---|
| Salidas antes de la llamada | Reprogramaron y Cancelaron | `tasaDeCancelacion`: `reagendadas` y `canceladas` |
| Asistencia por calidad | por tramo de ICP, «—» mientras no haya asistencia | `asistenciaPorTramo`, con la población de `tasaDeCancelacion` y sus predicados compartidos |
| De dónde viene la cita | «Conversaron antes» y «Se agendaron solos» | `indicadoresDelLead`: `agendaronTrasResponder` y `agendaronSinResponder` (`lib/negocio/indicadoresDelLead.ts:145` y `:155`) |

**Qué no es** · «Conversaron antes» no dice que el agente rescató a nadie: dice que la persona respondió una
conversación antes de agendar. Atribuirle la cita a un agente pide otra medición
(`docs/OTROS/futuro/lo-que-conversation-no-mide.md`).

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-11 · El modo Agentes

**Qué es** · Las cuatro tarjetas del prototipo, con su rol:

| agente | cifra grande | debajo | sentimiento |
|---|---|---|---|
| Lead Flow · texto | la respuesta: respondieron sobre les escribimos | les escribimos, respondieron, agendaron | el de `leadflow` |
| Lead Flow · voz | «—», «Sin llamadas registradas.» | — | — |
| Appointment Flow · texto | la confirmación de las citas | citas, confirmaron, reprogramaron, cancelaron | el de `appflow` |
| Appointment Flow · voz | «—», «Sin llamadas registradas.» | — | — |

Sobre las tarjetas, una línea «Qué corregir · {N} por resolver», con los patrones abiertos del auditor, que lleva al
modo Auditoría. **Sin cajones**: el detalle por agente vive en Auditoría.

**Qué no es** · Las cifras de las tarjetas de texto son **del flujo, no del agente**: ningún mensaje dice qué agente
lo escribió, y la confirmación es un campo del CRM. Es el desvío declarado en CN1-02; el agente lo explica.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-12 · Lo demás, en cifras

**Qué es** · Lo que la pantalla de hoy mide y el prototipo no tenía, en una fila de cifras con el vocabulario de los
paneles: **la respuesta** (la mediana de la primera respuesta), **fuera de horario** (los envíos fuera de horario),
**el precall** (los que lo vieron entero) y **el sentimiento molesto**. La atribución por fuente y por campaña sale de
la pantalla: la responde el agente.

**Estado** · El cálculo, construido el 2026-10-10 (CN-1), en `armarConversation`; el dibujo, por construir (CN-3).

### CN1-13 · Auditoría y Prompts, aparte

**Qué es** · Los dos modos siguen dibujándose con `Cuerpo` de `components/auditoria/PanelDeAuditoria.jsx`, con su
estética y sus permisos de hoy: `auditor.ver` para mirar y `auditor.editar` para cambiar un prompt. No cambian.

**Estado** · Por construir (CN-3): mudarlos de pestaña a modo sin cambiar lo que dibujan.

### CN1-14 · El plan de acción y las señales

**Qué es** · El botón «Plan de acción» del prototipo abre el plan real de la pasada de la mañana, `BotonDelPlan` de
`components/senales/SenalesDelDepartamento.jsx`, como hoy en Auditoría. La tarjeta de señales sigue en el modo
Auditoría.

**Estado** · Por construir (CN-3).

### CN1-15 · El servidor calcula; el navegador dibuja

**Qué es** · Una sola lectura nueva, `lecturaDeConversation`, compone los módulos de hoy y entrega lo que la pantalla
arma, **de 0 a 1**, con el motivo de cada «—». Tiene una mitad pura, probada sin base, y otra que lee, como
`lib/negocio/lecturaDeSales.ts`. La ruta `app/api/auditoria/route.ts` suma `pantalla`; los bloques de siempre siguen,
porque los leen el modo Auditoría y el cerebro. El navegador multiplica por 100 en un solo lugar.

**Estado** · La lectura, construida el 2026-10-10 (CN-1): `lib/negocio/lecturaDeConversation.ts`, con `armarConversation`
pura, `icpDeLosAgendados`, `asistenciaPorTramo` y `hallazgosAbiertos`. La ruta, por construir (CN-2).

### CN1-16 · El cerebro lee lo mismo

**Qué es** · Las herramientas de hoy ya llaman a las mismas funciones. Se suma `conversation_en_cifras`, que lee la
misma lectura y devuelve lo que la pantalla arma, con el motivo de cada «—» y los avisos que la pantalla no dibuja.

**Estado** · Por construir (CN-2).

### CN1-17 · Sin datos personales

**Qué es** · Los modos Estado y Agentes no dibujan nada de una persona: ni nombres, ni chats, ni frases de una
conversación. Del prototipo no se copia ningún nombre. La auditoría conserva lo que muestra hoy, con su permiso.

**Estado** · Por construir (CN-3).

### CN1-18 · El teléfono

**Qué es** · A 375 px los paneles se apilan, las tarjetas de flujo y de agente van de a una y la fila de cifras de a
dos. La página no desliza a lo ancho. Lo nuevo va en `app/conversation.css`.

**Estado** · Por construir (CN-3, CN-5).

### CN1-19 · Los textos que pasan a ser falsos se corrigen en la misma etapa

- Los encabezados de la vista, del panel y de la ruta.
- Los dos comentarios que dicen `tablero.ver` cuando la sección pide `auditor.ver`
  (`docs/OTROS/estado actual/04-CONVERSATION.md`, riesgo 20).
- Los comentarios de `app/inteligencia-estetica.css` que nombran a Conversation.
- La foto `docs/OTROS/estado actual/04-CONVERSATION.md`, reescrita en CN-5.

**Estado** · Por construir (CN-0 a CN-5).

---

## 4 · Lo que esto contesta de la foto 04

| riesgo de `docs/OTROS/estado actual/04-CONVERSATION.md` | respuesta |
|---|---|
| 16 · tasas sin piso sobre 1 a 5 casos | toda tasa de la pantalla lleva el piso (CN1-04) |
| 20 · dos comentarios dicen `tablero.ver` | se corrigen (CN1-19) |
| 21 · un hallazgo de LeadFlow en la tarjeta de AppFlow | queda en el modo Auditoría, que no cambia: es una pregunta aparte (`CN1-P07`) |
| 22 · la pantalla no dice si su dato está viejo | el prototipo no tiene chips de fuente; lo dice el agente con la frescura (`CN1-P08`) |

---

## 5 · Cómo se construye

| etapa | qué | estado |
|---|---|---|
| CN-0 | Esta carpeta, `docs/OTROS/futuro/lo-que-conversation-no-mide.md` y la medición de producción con el OK del usuario | **hecho el 2026-10-10**, revisado por el usuario |
| CN-1 | El servidor: `lecturaDeConversation` con sus pruebas | **hecho el 2026-10-10**: `pruebas/codigo/250-lectura-de-conversation.test.ts` y `pruebas/base/250-lectura-de-conversation.test.ts`, 18 mutaciones muertas |
| CN-2 | La ruta y el cerebro sobre la lectura | por hacer |
| CN-3 | El front sobre el marcado del prototipo, `app/conversation.css` y su prueba | por hacer |
| CN-4 | La revisión adversarial, las mutaciones y la suite entera | por hacer |
| CN-5 | La comparación contra el prototipo, los anchos, la subida y la foto 04 | por hacer |

---

## 6 · Preguntas abiertas

Cada una tiene una respuesta tomada por defecto, que es la que se construye si nadie dice otra cosa.

| id | pregunta | por defecto |
|---|---|---|
| `CN1-P01` | ¿Las ventanas siguen rodantes, o pasan a días cerrados como Acquisition y Conversion? | rodantes (CN1-04) |
| `CN1-P02` | ¿Toda tasa de la pantalla lleva el piso de 10? | sí (CN1-04) |
| `CN1-P03` | ¿Las tarjetas de agente muestran cifras del flujo, declaradas como tales? | sí; las de voz, «—» (CN1-11) |
| `CN1-P04` | ¿«De dónde viene la cita» con «Conversaron antes» y «Se agendaron solos»? | sí (CN1-10) |
| `CN1-P05` | ¿La fila «Lo demás, en cifras», con la respuesta, fuera de horario, el precall y el sentimiento? | sí (CN1-12) |
| `CN1-P06` | ¿Sin cajones en Agentes, y «Qué corregir» lleva a Auditoría? | sí (CN1-11) |
| `CN1-P07` | ¿Se corrige el hallazgo de LeadFlow que se dibuja en la tarjeta de AppFlow? | queda fuera de este plan: la auditoría no cambia |
| `CN1-P08` | ¿La pantalla dice si su dato está viejo? | no: lo dice el agente |
