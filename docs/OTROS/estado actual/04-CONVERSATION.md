# Conversation Intelligence
> Corte: **2026-10-10**, con el código de `89d8c19`. Las cifras de producción son de dos fechas y cada una lo
> dice: las del **2026-10-10**, medidas para `docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2 con
> `scripts/supabase.mjs leer` (sólo lectura, sólo conteos); y las del **2026-09-28**, de la foto anterior, que no se
> re-midieron. Para este corte no se leyó producción. La pantalla se miró en el navegador el 2026-10-10 (CN-5), en el
> preview local y con una respuesta sintética armada con las cifras de esa medición: lo que «dibuja» cada bloque con
> los datos de producción está deducido del código y de la medición. Las ventanas son rodantes (`now()` menos los días): lo que
> depende de la hora vale para el día de su medición. Cada afirmación lleva su `archivo:línea`. Para ubicar lo
> nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del 2026-09-28,
> con sus mediciones por hora y los avisos contados uno por uno— se lee con
> `git show 2421d49:"docs/OTROS/estado actual/04-CONVERSATION.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-10.** La pestaña vuelve al marcado de
`aios-command-center_1.html:2865-2929`: tres paneles, el modo **Estado** con las dos tarjetas de flujo y el modo
**Agentes** con las cuatro tarjetas de agente, y debajo una fila con lo que la pantalla anterior medía y el
prototipo no tenía. El supervisor sigue entero en dos modos más, **Auditoría** y **Prompts**, con su estética de
siempre. Todo sale de una sola lectura del servidor, `lecturaDeConversation`, con el piso de 10 en toda tasa, y cada
«—» dice por qué en una línea: el resto lo explica el agente de Conversation. El titular del negocio cambió poco: a
30 días entraron **58 contactos** y agendaron **35 (60 %)**; hubo **56 citas** y **ninguna con la asistencia
marcada** en toda la historia (169 citas; medido el 2026-10-10). El sentimiento de Appointment Flow se apagó como la
foto anterior anunció: **8 juzgadas** a 30 días, bajo el piso.

> **Desde el corte del 2026-09-28**
>
> - **2026-10-01 · `4e9a242`** — E7 de la nueva estructura: la maqueta del Executive se va, y con ella las cifras
>   inventadas que publicaba en nombre de Conversation (riesgo 1).
> - **2026-10-02 · `624a941`** — E11: la cabecera del departamento; con ella a la vista, `app/departamentos.css`
>   oculta el título y la bajada de las pantallas del prototipo.
> - **2026-10-04 · `cd851b3`** — AG2 de los agentes: cada llamada del auditor deja su uso, y sus fallos van al Panel
>   de Incidentes.
> - **2026-10-05 · `13723a0`, `5f15c01`** — AG6 y AG7: el cerebro con sus herramientas de Conversation y su ruta,
>   `app/api/auditoria/cerebro/route.ts`.
> - **2026-10-06 · `8933e20`** — AG13: Conversation en la tabla común de señales; el detector traduce los hallazgos
>   del auditor (`CONV-PATRON-ABIERTO`) y nace el plan de acción.
> - **2026-10-06 · `fe727e5`** — AG15 (4): el comentario de la cabecera llega con la pantalla.
> - **2026-10-10 · `1878f30`** — CN-0: el usuario decide volver al front del prototipo con los datos reales, y nacen
>   `docs/conversation/00-LO-QUE-SE-HIZO.md`, `docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`
>   (requisitos `CN1-01` a `CN1-19`) y `docs/OTROS/futuro/lo-que-conversation-no-mide.md`. Es la primera carpeta de
>   requisitos propia de Conversation.
> - **2026-10-10 · `e1ccf44`** — CN-1: `lib/negocio/lecturaDeConversation.ts`, con el piso en toda tasa.
> - **2026-10-10 · `6f3bdb5`** — CN-2: la ruta y el cerebro sobre la lectura; herramienta nueva
>   `conversation_en_cifras`.
> - **2026-10-10 · `a6e6309`** — CN-3: la pantalla nueva y `app/conversation.css`; `#v-conversation` sale de
>   `app/inteligencia-estetica.css` y la sección deja la estética de operación.
> - **2026-10-10 · `89d8c19`** — CN-4: la revisión adversarial; cuatro motivos nuevos para un «—», el precall sobre
>   sus clasificados y «Qué corregir» contando patrones (anexo CN-4 del doc 01). Falta CN-5: la comparación contra
>   el prototipo, los anchos medidos y la subida.

---

## 1 · Qué pide el documento

El documento funcional no vive en el repositorio. El código lo llama `AIOS_Arquitectura_Funcional_v0.2.md`
(`lib/autorizacion/secciones.ts:293`). El resumen de abajo es el de la foto anterior, cotejado el 2026-09-28 contra ese
archivo local, y no se volvió a cotejar:

- **§8 — Misión.** Supervisar, analizar y mejorar las conversaciones automatizadas. Dos módulos, cada uno con agente de
  texto, agente de voz y Supervisor: **Lead Flow** (conseguir la cita) y **Appointment Flow** (que asista).
- **§9 — Lead Flow.** KPI principal **Booking Rate** con su denominador (§9.3); un **trigger link** que separe enlace
  enviado / abierto / landing visitada / formulario / cita (§9.5); lo consumible, con zona horaria, atribución,
  calificación e historial con sentimiento (§9.6); veinte KPIs (§9.7).
- **§10 — Appointment Flow.** KPI principal **Show Rate** (§10.3); ICP score y segmento, closer, confirmación,
  cancelaciones, reagendamientos, VSL y precall (§10.5); tres ramas del precall (§10.6); dieciséis KPIs, seis de ellos
  cortes del show rate (§10.7).
- **§11 — Supervisor.** No conversa: evalúa. El prompt activo y su versión (§11.2), dos evaluaciones separadas
  (§11.3), el vocabulario `issue_source` (§11.4), un resultado estructurado de diecisiete campos (§11.7) y un humano
  que publica el prompt nuevo (§11.8).
- **§12 a §17**: recomendaciones, cinco responsables, la medición de impacto (§14), lo que se entrega a Executive con
  los datos faltantes (§15), y las pruebas de trazabilidad de Anuncio a Venta (§16.2).

Lo que pidió el usuario el 2026-10-10 —la forma del prototipo con el dato, y es un tablero— está en
`docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 1, con cinco decisiones suyas y seis respuestas por
omisión (`CN1-P01` a `CN1-P06`; § 6 del mismo documento). Lo construido antes, con su historia, en
`docs/conversation/00-LO-QUE-SE-HIZO.md`.

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:308-330`: clave `conversation`, grupo «Inteligencia», capacidad
`auditor.ver`. La vista es `components/views/ConversationView.jsx:23-31`, el envoltorio del prototipo
`view-scroll cre-scroll`, **sin `estetica-op`** (CN1-01). El panel recarga cada 60 s sólo con la pestaña a la vista
(`components/conversation/PanelDeConversation.jsx:117-119`, `lib/cadencia.ts:91`).

**La ruta.** `app/api/auditoria/route.ts:54-155`, un solo `GET`: pide `auditor.ver` al portero
(`app/api/auditoria/route.ts:55`), **rechaza** con 400 un período fuera de la lista (`app/api/auditoria/route.ts:63-64`)
y, en una sola transacción, lee la pantalla del técnico, los prompts, `lecturaDeConversation`, las señales y el
comentario de la cabecera (`app/api/auditoria/route.ts:77-101`). La respuesta suma `pantalla`, lo que el tablero arma
(`app/api/auditoria/route.ts:108`); los bloques de siempre —`cancelacion`, `respuesta`, `atribucion`, `precall`,
`sentimiento`— siguen viajando de la misma lectura (`app/api/auditoria/route.ts:139-153`), y de ellos el tablero toma
sólo desde cuándo hay datos. Antes de CN-2 la ruta llamaba a cada función por separado
(`app/api/auditoria/route.ts:80-110@e1ccf44`).

**La lectura.** `lib/negocio/lecturaDeConversation.ts` tiene una mitad pura, `armarConversation`
(`lib/negocio/lecturaDeConversation.ts:167-316`), y otra que lee: compone `indicadoresDelLead`, `tasaDeCancelacion`,
`atribucionDelLead`, `consumoDelPrecall` y `sentimientoPorFlujo` con tres lecturas propias —el ICP de quienes agendaron,
la asistencia por tramo y los patrones abiertos— (`lib/negocio/lecturaDeConversation.ts:402-419`). Todo lo de
`pantalla` viaja de 0 a 1; el navegador multiplica por 100 en un solo lugar (`components/conversation/comun.jsx:78`).

**Los cuatro modos** (`components/conversation/PanelDeConversation.jsx:50-55`): **Estado** y **Agentes** son el
prototipo y llevan el segmentado (`components/conversation/PanelDeConversation.jsx:144-150`); **Auditoría** y
**Prompts** son el supervisor de siempre, `Cuerpo` de `components/auditoria/PanelDeAuditoria.jsx`, dibujado dentro de
un contenedor con `estetica-op` (`components/conversation/PanelDeConversation.jsx:170-184`), sin segmentado: sus
listas cuentan toda la historia. El encabezado lleva «Conversation», la bajada del prototipo, el selector y, a la
derecha, el «Plan de acción» real en los cuatro modos (`components/conversation/PanelDeConversation.jsx:130-152`). Con
la cabecera del departamento a la vista, `app/departamentos.css:208` oculta el título y la bajada. Sin
«Personalizado», sin la clave `mes` y sin «vs los 7 días previos»: no hay flechas (CN1-03, CN1-04).

**Lo que dibuja**, en el orden del panel, y lo que daba el 2026-10-10 a 30 días —el período con que abre
(`lib/negocio/periodo.ts:109`)—, deducido de la medición de ese día (no leído de la pantalla):

| bloque | dónde | el 2026-10-10, a 30 días |
|---|---|---|
| Panel Lead Flow: «Contactos», con «desde el {fecha}», y «Agendó» con el booking rate | `components/conversation/PanelDeConversation.jsx:293-310` | **58**; **35 · 60 %** |
| Panel Appointment Flow: «Citas totales» y «Asistieron» con la tasa | `components/conversation/PanelDeConversation.jsx:313-330` | **56**; «—», «Nadie marca la asistencia.» |
| Panel «De qué está hecho el grupo que agendó»: Agendaron y Alto · Medio · Bajo con su porción, y «{N} sin calificar» en el título | `components/conversation/PanelDeConversation.jsx:337-353` | 35; alto 7 · medio 7 · bajo 6, 15 sin calificar (aproximado: ver § 4) |
| **Estado** · tarjeta Lead Flow: «contacto a agenda» y la cadena Entraron → Les escribimos → Respondieron → Abrieron la landing → Agendaron | `components/conversation/PanelDeConversation.jsx:412-429` | 60 %; 58 · 52 (90 %) · 35 (60 %) · «—» «Sin enlace con seguimiento.» · 35 (60 %) |
| **Estado** · tarjeta Appointment Flow: «agenda a asistencia», la cadena Citas → Confirmaron → Asistieron, las salidas, la asistencia por calidad y de dónde viene la cita | `components/conversation/PanelDeConversation.jsx:435-463` | «—»; 56 · no medido · «—»; Reprogramaron 7 (13 %), Cancelaron 15 (27 %); una sola línea «Nadie marca la asistencia.» (`components/conversation/PanelDeConversation.jsx:469-495`); el origen, no medido |
| **Agentes** · cuatro tarjetas: Lead Flow y Appointment Flow, texto y voz | `components/conversation/PanelDeConversation.jsx:523-564` | Lead Flow · texto: **67 % de respuesta** (35 de 52), sentimiento «—» «Sin análisis en esta ventana.»; Appointment Flow · texto: la confirmación, no medida, y sentimiento «—» «Pocos casos para una tasa.» (8 juzgadas); las dos de voz: «—», «Sin llamadas registradas.» |
| **Agentes** · «Qué corregir · {N} por resolver», que lleva al modo Auditoría | `components/conversation/PanelDeConversation.jsx:502-517` | **8 por resolver**: 7 patrones de AppFlow y 1 de LeadFlow (26 + 1 hallazgos abiertos) |
| «Lo demás, en cifras»: Primera respuesta · Primer mensaje fuera de horario · Precall registrado · Molestos | `components/conversation/PanelDeConversation.jsx:570-583` | las tres primeras, no medidas; Molestos «—», «Pocos casos para una tasa.» (8 juzgadas entre los dos flujos) |

**Las cuatro cifras de abajo** (CN1-12): **la primera respuesta** es la mediana en minutos, con piso de 10 respuestas
y su propia frase, «Pocos casos para una mediana.» (`lib/negocio/lecturaDeConversation.ts:295-300`); **el primer
mensaje fuera de horario** es la porción de primeros mensajes que salieron antes de las 8 o desde las 21 en la zona
del contacto, sobre los escritos con zona (`lib/negocio/lecturaDeConversation.ts:303-306`); **el precall** es la
porción de contactos con cita que registraron haber visto el video, **sobre los que tienen el campo clasificado**, la
base del módulo (`lib/negocio/lecturaDeConversation.ts:308-312`, `lib/negocio/consumoDelPrecall.ts:232`); y **los
molestos** juntan las conversaciones juzgadas de los dos flujos, con el piso sobre la suma
(`lib/negocio/lecturaDeConversation.ts:207-218`). La atribución por fuente y por campaña salió de la pantalla: la
responde el agente.

**Las tarjetas de agente son cifras del flujo, no del agente** (CN1-11): ningún mensaje dice qué agente lo escribió y
la confirmación es un campo del CRM. La de texto de Lead Flow publica la respuesta —respondieron sobre escritos—, con
escritos, respondieron y agendaron debajo; la de Appointment Flow, la confirmación, con citas, confirmaron,
reprogramaron y cancelaron (`lib/negocio/lecturaDeConversation.ts:265-291`). Las de voz no tienen dato
(`lib/negocio/lecturaDeConversation.ts:199-205`). Las tarjetas no abren cajón (`app/conversation.css:88-89`).

**«Qué corregir · {N} por resolver»** cuenta patrones abiertos, uno por código como los agrupa Auditoría
(`lib/negocio/lecturaDeConversation.ts:378-385`), sin ventana, como la pantalla del técnico. Sin auditoría no cuenta:
dice «La empresa no audita sus agentes.» (`lib/negocio/lecturaDeConversation.ts:292`). Ver riesgo 21.

**Los desvíos de rótulo**, declarados en CN1-02: «Contactos» por «Contactos sin cita»; «el grupo que agendó» por «el
grupo que asistió», porque la asistencia está en 0; «Conversaron antes» por «Los rescató Lead Flow», porque se mide si
hubo conversación antes de agendar y no qué agente la tuvo; «Citas» por «Agendados · todos»; «Entraron» por
«Contactados sin cita»; cinco pasos en la cadena de Lead Flow y no cuatro; los tramos Alto, Medio, Bajo y Sin
calificar de `tramoDelPuntaje`; «molesto» por «negativo»; «prompts y conversaciones marcadas», sin «datos inválidos»,
que el auditor no detecta; y la cifra grande de cada agente de texto, que es del flujo.

**Las bases de la cadena de Appointment Flow no son la misma** (CN1-10). «Citas» son citas ocurridas de contactos no
descartados. **«Confirmaron» cuenta CONTACTOS** con cita en la ventana, descartados incluidos, y su porción es sobre
los que respondieron el campo del CRM (`lib/negocio/lecturaDeConversation.ts:245-246`,
`lib/negocio/indicadoresDeCitas.ts:245`): el conteo puede no cuadrar con el de las citas, y su barra no es una porción
de ellas. «Asistieron» es sobre las citas con la asistencia marcada. La pantalla no lo dice; lo dice la herramienta
del cerebro (`lib/agentes/executive/adaptadores/conversation.ts:134-136`).

**Cada «—» dice por qué, con una frase de una lista cerrada.** Doce motivos (`lib/negocio/lecturaDeConversation.ts:48-60`),
cada uno con su frase (`components/conversation/comun.jsx:28-41`), más el «—» mismo, la de la mediana, la de la
primera carga y la del fallo: dieciséis frases en `FRASE` (`components/conversation/comun.jsx:8-25`), las mismas de la tabla de CN1-02, y
`pruebas/codigo/251-la-pantalla-de-conversation.test.ts` exige que coincidan en las dos direcciones. Un cero es un
cero medido. No se dibujan avisos, notas de cada cifra ni la caja de lo que falta (CN1-05): viajan en la respuesta y
en las herramientas del cerebro.

**Ventanas y piso.** Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), **rodantes** (`CN1-P01`), sin
comparación contra la ventana anterior. Tres poblaciones en una pantalla, todas con la misma cantidad de días: la
COHORTE de contactos por `alta_en_el_crm` para Lead Flow, el ICP, el origen y las cifras de abajo; las CITAS ocurridas
en la ventana, alcanzables y de no descartados, para Appointment Flow (`lib/negocio/lecturaDeConversation.ts:344-358`);
y los ANÁLISIS del auditor por `analizado_el` para el sentimiento (`lib/auditor/sentimiento.ts:89-93`). «Qué corregir»
no tiene ventana. **Toda tasa lleva el piso de 10 sobre su denominador** (`CN1-P02`): `tasa`
(`lib/negocio/lecturaDeConversation.ts:142-146`) sobre `PISO_DE_UNA_TASA` (`lib/negocio/indicadoresDeCitas.ts:329`),
también el booking rate, la respuesta, la cancelación y el reagendamiento, que los módulos publican sin él; las
porciones del ICP lo llevan sobre el total de quienes agendaron (`lib/negocio/lecturaDeConversation.ts:175-185`), y el
sentimiento sobre los juzgados (`lib/negocio/lecturaDeConversation.ts:155-164`). El piso se aplica en la lectura, no
en las funciones, que comparten otras pantallas.

**El plan.** El «Plan de acción» es `BotonDelPlan` (`components/senales/SenalesDelDepartamento.jsx:120`) con las
señales que trae la ruta (`components/conversation/PanelDeConversation.jsx:141`): el plan de la pasada de la mañana,
de 7 días con «7 días» y de 30 con los otros tres (`app/api/auditoria/route.ts:76`). El detector tiene una sola regla,
`CONV-PATRON-ABIERTO` (`lib/agentes/detectores/conversation.ts:36-49`): traduce los hallazgos abiertos del auditor,
no mide. La tarjeta de señales sigue en el modo Auditoría.

**El cerebro.** Seis herramientas en `lib/agentes/executive/adaptadores/conversation.ts` —`auditoria_de_agentes`,
`lead_flow`, `atribucion_del_lead`, `consumo_del_precall`, `sentimiento_por_flujo` y `conversation_en_cifras`— y
`cancelacion_de_citas`, que vive con las de Sales (`lib/agentes/executive/adaptadores/sales.ts:144`).
**`conversation_en_cifras`** (`lib/agentes/executive/adaptadores/conversation.ts:127-154`) lee la misma lectura con el
«audita» que resolvió la ruta del cerebro y devuelve su `pantalla` entera, con el motivo de cada «—»; la compara con
la de la ruta, en los cuatro períodos, `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:145`. Las
demás traen los avisos que la pantalla no dibuja. La frescura de las cinco tareas de las que vive la pantalla la da
`frescura` (`lib/agentes/executive/adaptadores/plataforma.ts:37`).

**Lo que se midió en el navegador (CN-5, 2026-10-10).** Contra el prototipo servido en local, a 1440 px: los paneles
guardan la proporción (303 · 303 · 503 px contra 315 · 315 · 523, con 1144 px de ancho útil contra 1188), las filas de
las cadenas miden lo mismo (42 y 31 px contra 41 y 30) y los tamaños de letra son iguales. Los paneles miden 13 px
más alto porque la línea de debajo de una cifra se parte en dos renglones, y el selector es más ancho porque tiene
cuatro modos y cuatro períodos. A 1440, 1180, 1125 y 375 px, en los cuatro modos, nada desborda a lo ancho y ninguna
cifra queda cortada; las reglas de los anchos están en `app/conversation.css:102-122`. Las pruebas: `pruebas/codigo/250-lectura-de-conversation.test.ts`,
`pruebas/base/250-lectura-de-conversation.test.ts` y `pruebas/codigo/251-la-pantalla-de-conversation.test.ts`.

**Quién la ve.** Los 3 roles de producción llevaban `auditor.ver` el 2026-09-28; no re-medido. Editar un prompt pide
además `auditor.editar`.

---

## 3 · Lo que era maqueta y qué la reemplazó

**La maqueta se fue el 2026-09-10 y su forma volvió el 2026-10-10.** `lib/aios/conversation.js` se borró en `f0f09b7`:
559 líneas, unas 180 de literales inventados —un embudo, cuatro agentes con nombre de persona, quince líneas de
diálogo y seis «incidencias» que imitaban a un supervisor—. La reemplazó un tablero propio de cuatro pestañas planas
con la estética de operación (`components/conversation/PanelDeConversation.jsx:87-92@6f3bdb5`), con el porqué de cada
cifra detrás de un ícono y una caja de lo que falta por flujo (`components/conversation/PanelDeConversation.jsx:95@6f3bdb5`).
El 2026-10-10 volvió el marcado del prototipo y se quedó el dato:

| lo que dibujaba el prototipo | qué hay hoy |
|---|---|
| Selector Estado · Agentes, «Plan de acción» sin oyente, «vs los 7 días previos», Hoy / 7 días / 30 días con la clave inválida `mes`, y «Personalizado» | Estado · Agentes · Auditoría · Prompts; el plan real; el segmentado de los cuatro períodos del sistema; sin comparación ni rango libre |
| Tres paneles con cifras a mano, y «De qué está hecho el grupo que asistió», cuyos asistentes por ICP sumaban 74 contra 138 | los tres paneles con la cohorte, las citas y el ICP de quienes agendaron, por `tramoDelPuntaje` |
| La cadena de Lead Flow de cuatro pasos y la de Appointment Flow de tres, con sus tres bloques | cinco pasos en Lead Flow, con la landing en «—»; la de Appointment Flow con sus bloques, la asistencia en «—» |
| Cuatro agentes con nombre de persona; el de texto de Lead Flow, 58 % de agendados sobre 346 cuando la cadena decía 121 | cuatro tarjetas sin nombres, con cifras del flujo declaradas como tales; las de voz en «—» |
| «Qué corregir» con una lista de correcciones y cajones con chats y prompts | «Qué corregir · {N} por resolver», que lleva a Auditoría; sin cajones (`CN1-P06`) |

Las cifras del prototipo están en `docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 1. **Ningún nombre
del prototipo se copió** (CN1-17): los tres nombres que la maqueta tenía —un agente, un saludo y las iniciales de un
cliente— no aparecen en `components/conversation/`, `components/auditoria/`, `components/views/ConversationView.jsx`,
`app/conversation.css` ni `lib/negocio/lecturaDeConversation.ts` (`grep` del 2026-10-10). El comentario que los
nombraba para explicar que se habían ido salió de la vista en CN-3; sigue en la historia
(`components/views/ConversationView.jsx:12-33@6f3bdb5`).

**Lo que Executive inventaba en nombre de este departamento ya no existe**: la maqueta del Executive se retiró el
2026-10-01 (`4e9a242`), y con ella el «58 % de efectividad en Lead Flow», el hallazgo sobre 22 llamadas de un agente
de voz sin una sola fila y el embudo «Conversaciones» (la foto anterior los listaba en su § 3).

**Textos fijos que siguen en los módulos**, ya no a la vista porque los avisos no se dibujan, pero en la respuesta y
en el cerebro: «el CRM tiene ese campo en 3 de 1052 citas», sin fecha, en el aviso de la asistencia
(`lib/negocio/indicadoresDeCitas.ts:514-516`); y los tres valores del precall sin rama nombrados a mano
(`lib/negocio/consumoDelPrecall.ts:283-289`).

---

## 4 · Datos que ya tenemos

Medido el 2026-10-10, con `scripts/supabase.mjs leer`, sobre la única organización con datos de negocio, con los
predicados de cada módulo (`docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2):

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

**El ICP de esa medición es aproximado**: se contó en SQL con los cortes de 75 y 50 y el puntaje 0 dentro de «bajo», y
la pantalla usa `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`), que lo cuenta como «sin calificar»
(`lib/negocio/lecturaDeConversation.ts:326-337`): algún contacto puede pasar de «bajo» a «sin calificar». Desde CN-1
Conversation usa el tramo de Leads Portal, que la foto anterior daba como guardado y sin usar.

**El auditor**: 26 hallazgos abiertos de Appointment Flow en 7 patrones y 1 de Lead Flow. **El sentimiento**: a 30
días, Appointment Flow tiene 8 análisis juzgados —1 positivo, 6 neutrales, 1 molesto—; Lead Flow, ninguno: sus 4
análisis de 30 días no son auditables.

**No se midió el 2026-10-10**: la confirmación, el origen de la cita, la mediana de la primera respuesta, el primer
mensaje fuera de horario y el precall. Las cifras del 2026-09-28, como historia y a 30 días: confirmaron 59 de 76
contactos; la primera respuesta, 5,4 min; fuera de horario, 61 de 152; el precall, 10 de 51 clasificados; la
bifurcación, 73 después de contestar y 66 sin contestar.

**Lo guardado que la pantalla no usa**, del 2026-09-28 y no re-medido: el anuncio de primer toque en el 71,8 % de la
cohorte (el corte por anuncio vive en `lib/negocio/costoDelAnuncio.ts`, por los motivos de
`lib/negocio/atribucionDelLead.ts:76-93`); el ad set y las UTM de los dos toques; la zona horaria en 157 de 277, usada
sólo para fuera de horario; el autor de cada saliente —un tercio del agente de IA—; el formulario de la landing, que
dejó de escribirse el 2026-08-31; el clic al precall en 20 contactos; el estado de entrega del mensaje; y el sello del
barrido de las cinco tareas de esta pantalla, que la pantalla no lee (riesgo 22).

**El volumen.** El 2026-09-28 la cohorte de 30 días eran 277 contactos y ningún anuncio había gastado después del 13
de septiembre; el 2026-10-10 son 58. No se re-midió el gasto.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Lo que la pantalla no mide, y qué haría falta, está en `docs/OTROS/futuro/lo-que-conversation-no-mide.md`. En resumen,
con la foto del 2026-09-28 donde no se re-midió:

**1 · Los agentes de voz.** `negocio.llamadas` sin filas y ningún proceso que la llene. Las llamadas de los
Analizadores son reuniones con el closer, no llamadas de un agente.

**2 · La landing, después del mensaje.** El trigger link del §9.5 no existe: el paso «Abrieron la landing» va en «—».

**3 · La asistencia.** 0 de 169 citas marcadas en toda la historia (2026-10-10). La columna y el escritor existen; lo
que falta es que los closers la marquen. Con ella caen el KPI de Appointment Flow, la asistencia por calidad y los
seis cortes del show rate del §10.7.

**4 · De dónde viene la cita, atribuida al agente.** Ningún mensaje dice qué agente lo escribió: se mide si la persona
conversó antes de agendar, no si el agente la rescató.

**5 · Las escaladas y la intervención humana.** No se registra cuándo una persona toma una conversación.

**6 · El VSL.** En cero en todos los contactos medidos el 2026-09-28; vive en Conversion.

**Y del supervisor (§11, §14, §15)**, de la foto anterior: el prompt y su versión, con las dos tablas en 0 filas el
2026-09-28; la segunda evaluación del §11.3; `effectiveness_score` y `confidence` del §11.7; y el §14 entero —ningún
hallazgo tenía `resuelto_el`—. El `issue_source` del §11.4 no se guarda en los hallazgos, pero desde AG13 el detector lo
deduce al publicar cada señal (`lib/agentes/detectores/conversation.ts:51-56`). El canal hacia Executive del §15 es
hoy la tabla común de señales y el cerebro, no una tarjeta inventada.

---

## 6 · Reglas propias

Las transversales —el silencio, el piso de 10, los dos ceros— están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). Las de este departamento:

**1 · Un «—» dice por qué, y un cero es un cero medido.** Doce motivos (`lib/negocio/lecturaDeConversation.ts:48-60`),
y cada uno dice por qué falta ESA cifra: «sin contactos» al lado de «Contactos 50» sería falso
(`lib/negocio/lecturaDeConversation.ts:45-46`). La frase sale de una lista cerrada (CN1-02).

**2 · Toda tasa de la pantalla lleva el piso de 10 sobre su denominador**, en la lectura y no en las funciones
compartidas (`lib/negocio/lecturaDeConversation.ts:142-146`).

**3 · El servidor calcula; el navegador dibuja.** Todo viaja de 0 a 1 y se multiplica por 100 en un solo lugar
(`components/conversation/comun.jsx:78`). Lo que dice el cerebro de una cifra es lo que se dibuja (CN1-16).

**4 · Es un tablero: cifras con su rótulo, y la explicación es del agente** (CN1-05).

**5 · Las tarjetas de agente son del flujo, y se declara** (CN1-11). Ningún mensaje dice qué agente lo escribió.

**6 · Ningún dato de una persona en Estado y Agentes** (CN1-17): ni nombres, ni chats, ni frases. Auditoría conserva lo
que muestra, con su permiso, y al cerebro no viajan los casos ni las conversaciones
(`lib/agentes/executive/adaptadores/conversation.ts:4-7`).

**7 · La cadena de Lead Flow no es un embudo.** Agendar no exige haber contestado: cada paso es una porción de la
cohorte (`lib/negocio/lecturaDeConversation.ts:232-239`), y la bifurcación suma el total
(`pruebas/base/150-indicadores-del-lead.test.ts:593-597`).

**8 · Agendar es el evento**: el booking rate cuenta cualquier cita, futura o congelada
(`lib/negocio/indicadoresDelLead.ts:209-211`, `lib/negocio/indicadoresDelLead.ts:237-239`); la cancelación necesita
las exclusiones porque pregunta otra cosa.

**9 · El denominador de la asistencia lleva `asistio is not null`** (`lib/negocio/indicadoresDeCitas.ts:385-399`), y la
asistencia por tramo lo repite (`lib/negocio/lecturaDeConversation.ts:350-351`).

**10 · Los dos vocabularios del supervisor no se mezclan.** Post-agenda (`lib/auditor/veredicto.ts:97`) y pre-agenda
(`lib/auditor/veredicto.ts:134`) tienen rúbricas distintas, y cruzarlas da un resultado «convincente y falso»
(`lib/auditor/veredicto.ts:128-129`). El nivel se deriva, no se le cree al modelo (`lib/auditor/veredicto.ts:259`).

**11 · El sentimiento es de la conversación, nunca de la persona** (`lib/auditor/sentimiento.ts:29-31`), y su
denominador son las auditables fuera del carril de mejora (`lib/auditor/sentimiento.ts:89-93`).

**12 · La ventana es una palabra de una lista cerrada**, y lo que no está se rechaza (`lib/negocio/periodo.ts:188-193`).
«Completo» es una ventana grande, no un centinela (`lib/negocio/periodo.ts:52`).

**13 · Los nombres de los agentes son los del CRM** —LeadFlow y AppFlow (`lib/auditor/vista.ts:157-160`)— y la lista
sale de `AGENTES` (`lib/auditor/veredicto.ts:52`). Nombrar un agente a mano está prohibido.

**14 · La severidad del patrón es la del peor caso** (`lib/auditor/vista.ts:126-129`).

---

## 7 · Riesgos

Los 22 de la foto anterior, con su estado al 2026-10-10, y tres nuevos.

**1 · Executive publicaba cifras inventadas en nombre de Conversation.** **Cerrado** el 2026-10-01 (`4e9a242`).

**2 · Una falta declarada sin censar la base.** La caja de lo que falta decía que el formulario no se registraba, con
el campo en 247 contactos. **Cerrado** con la caja, que se fue en CN-3 (`a6e6309`): el «—» de la landing dice «Sin
enlace con seguimiento.», que es cierto. La regla queda: antes de escribir una falta, censar el catálogo del CRM y
contar en toda la base.

**3 · Confundir «se dejó de escribir» con «el negocio se cayó».** **Abierto.** La cohorte de 30 días pasó de 277 a 58
contactos sin que cambie nada de lo que se mide, y ninguna cifra de la pantalla dice cuánto entró antes.

**4 · Los ceros del VSL.** **Abierto**, sin consecuencia en pantalla: el VSL no se dibuja.

**5 · El show rate no tiene ninguna vía abierta.** **Abierto**: 0 de 169 citas marcadas. Una tasa sin
`asistio is not null` diría que no viene nadie.

**6 · Dos ventanas en la misma pantalla.** **Cambió.** Auditoría ya es un modo aparte, sin segmentado. Pero en Agentes,
«Qué corregir · {N}» cuenta patrones de toda la historia (`lib/negocio/lecturaDeConversation.ts:373-385`) debajo de
tarjetas que miden la ventana elegida, y nada lo dice.

**7 · El sentimiento de Appointment Flow se apagaba solo el 2026-10-08.** **Pasó**: 8 juzgadas a 30 días el
2026-10-10, y la tarjeta dice «—» con «Pocos casos para una tasa.». Es correcto, y se puede leer como que el auditor
dejó de funcionar.

**8 · El supervisor audita sin saber qué se le pidió al agente.** **Abierto**; prompts y versiones en 0 filas el
2026-09-28, no re-medido.

**9 · El vocabulario del CRM se mueve y la única alarma es un contador.** **Abierto**: el aviso del precall sigue
nombrando a mano los tres valores sin rama (`lib/negocio/consumoDelPrecall.ts:283-289`).

**10 · La comparación entre fuentes que el módulo prohíbe.** **Cambió**: la atribución por fuente y por campaña salió
de la pantalla (CN1-12). Sigue en `atribucion_del_lead` (`lib/agentes/executive/adaptadores/conversation.ts:81-97`),
con tasas nulas bajo el piso; el riesgo lo corre ahora el agente al compararlas.

**11 · La agrupación de campañas.** **Abierto**, y sólo en el cerebro: la misma campaña partida en dos filas y un
valor que era el nombre de una persona, escondidos en «Otras» por el piso (2026-09-28).

**12 · La respuesta es de la conversación, no del agente.** **Cambió, y quedó más expuesto**: es la cifra grande de la
tarjeta «Lead Flow · Texto» (`lib/negocio/lecturaDeConversation.ts:268`). El desvío está declarado (CN1-02, CN1-11),
pero la pantalla no tiene dónde decirlo: lo dice el agente.

**13 · El censurado de las latencias.** **Abierto**: «Primera respuesta» es la mediana de los que contestaron, y el
aviso que cuenta a los que no (`lib/negocio/indicadoresDelLead.ts:436-448`) no se dibuja.

**14 · La guarda `>= 0` excluye filas sin decirlo.** **Abierto**, sin cambios (`lib/negocio/indicadoresDelLead.ts:331-339`).

**15 · Convertir la bifurcación en un escalón.** **Cambió.** La cadena de Lead Flow volvió a terminar en «Agendaron»,
después de «Respondieron», como en el prototipo. Ninguna porción miente —todas son sobre la cohorte
(`lib/negocio/lecturaDeConversation.ts:232-239`)—, pero la forma se lee como embudo y agendar no es un subconjunto de
responder. La bifurcación vive en «De dónde viene la cita», sobre los que agendaron
(`lib/negocio/lecturaDeConversation.ts:260-263`), y la suma la fija la prueba de la regla 7.

**16 · Tasas sin piso sobre uno a cinco casos.** **Cerrado en la pantalla** en CN-1 (`e1ccf44`). Las funciones siguen
sin piso (`lib/negocio/indicadoresDeCitas.ts:449`), y Sales dibuja la cancelación con ellas.

**17 · La atribución y el booking rate dejaron de contar lo mismo.** **Abierto**: la atribución sigue con el filtro de
cita alcanzable bajo un comentario que dice que es el mismo que el booking rate
(`lib/negocio/atribucionDelLead.ts:148-151`). Ya no se ve en pantalla, pero sí en el cerebro: en «Completo», el 2026-09-28, las filas sumaban 200 agendados y el
booking rate decía 279.

**18 · Diez de las once empresas activas verían esta pantalla vacía.** **Abierto**, no re-medido. Sin auditoría, el
sentimiento y «Qué corregir» dicen «La empresa no audita sus agentes.»; las cifras de los flujos dependen de
`negocio.*`.

**19 · `desde` sin año.** **Cerrado** en CN-4 (`89d8c19`): la fecha lleva el año cuando no es el de hoy
(`components/conversation/comun.jsx:91-97`).

**20 · Dos comentarios decían que la sección pide `tablero.ver`.** **Cerrado** en CN-3 (`a6e6309`):
`lib/autorizacion/secciones.ts:305-307` y `components/views/ConversationView.jsx:16-18`.

**21 · Los patrones se agrupan sin mirar el agente.** **Abierto** (`CN1-P07`: la auditoría no cambia).
`agruparPorPatron` junta por código (`lib/auditor/vista.ts:106-138`) y cada tarjeta se queda con los patrones cuyo
caso más reciente es suyo (`components/auditoria/PanelDeAuditoria.jsx:150`). «Qué corregir» cuenta igual, por código
(`lib/negocio/lecturaDeConversation.ts:380`): en CN-4 contaba por agente y código, y un código con casos de los dos
agentes sumaba dos en «{N} por resolver» mientras Auditoría dibujaba uno; se corrigió en CN-5.

**22 · La pantalla no avisa si su dato está viejo.** **Cambió** (`CN1-P08`): la pantalla sigue sin decirlo, y el
comentario de la cabecera no mira la frescura para Conversation (`lib/agentes/cabecera.ts:124`). Lo dice el cerebro
con `frescura`, que cubre las cinco tareas de esta pantalla (`lib/agentes/executive/adaptadores/plataforma.ts:37`), y el
detector pasa a «sin medición» si el auditor no está al día (`lib/agentes/detectores/conversation.ts:27-28`). Con el
barrido caído, «Hoy» y «7 días» se vaciarían igual que un embudo sin entrada, y sólo lo distingue quien le pregunte
al agente.

**23 · «Confirmaron» no es una porción de «Citas».** **Nuevo** (CN1-10): cuenta contactos, descartados incluidos, y su
barra es sobre los que respondieron el campo. En la misma cadena que «Citas», el conteo puede no cuadrar con el de las
citas, y la pantalla no lo explica: lo dice el agente.

**24 · «Molestos» junta los dos flujos.** **Nuevo** (CN1-12). La ruta de antes de CN-2 sostenía lo contrario: uno por
agente, porque mezclarlos da un promedio que no describe a ninguno (`app/api/auditoria/route.ts:93-95@e1ccf44`). Hoy
no se nota —Lead Flow no tiene juzgadas, así que la cifra es la de Appointment Flow sola—; el día que las tenga, la
fila de abajo y las tarjetas de agente dirán cosas distintas.

**25 · La pantalla no se vio con los datos de producción.** **Nuevo**: CN-5 la midió con una respuesta sintética; la
revisión del usuario en producción está pendiente. **El cuello de botella de Conversation no es técnico**: la pantalla está, con todo lo que el
sistema mide, y sigue sin poder llenarse la asistencia, la voz, la landing y la atribución de la cita al agente.
