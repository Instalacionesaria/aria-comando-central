# Conversation Intelligence
> Corte: **2026-10-18**. Producción está en el commit `972972e` (migraciones hasta la `078`); el código de esta
> sección es el de `d297289` (CN-5), y lo que vino después no la cambió (ver el bloque de abajo). En local hay ocho
> commits más, `693a383..dc84cb2`, del modelo de datos multiempresa (Fase 0, migraciones `079` a `084`), **construidos
> y sin subir**: lo que tocan de esta sección va al final de § 2, como «construido en local, sin subir». Las cifras de
> producción son de tres fechas y cada una lo dice: las del **2026-10-18**, medidas para este corte con
> `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados); las del **2026-10-10**, de
> `docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2; y las del **2026-09-28**, de la foto de ese día.
> Lo que no se volvió a medir lo dice. La pantalla se miró en el navegador el 2026-10-10 (CN-5), en el preview local y
> con una respuesta sintética: lo que «dibuja» cada bloque con los datos de producción está deducido del código y de
> la medición. Las ventanas son rodantes (`now()` menos los días): lo que depende de la hora vale para el día de su
> medición. Cada afirmación lleva su `archivo:línea`. Para ubicar lo nombrado, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del 2026-10-10— se lee con
> `git show 972972e:"docs/OTROS/estado actual/04-CONVERSATION.md"`, y la del 2026-09-28, con sus mediciones por hora y
> los avisos contados uno por uno, con `git show 2421d49:"docs/OTROS/estado actual/04-CONVERSATION.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-10.** La pestaña vuelve al marcado de
`aios-command-center_1.html:2865-2929`: tres paneles, el modo **Estado** con las dos tarjetas de flujo y el modo
**Agentes** con las cuatro tarjetas de agente, y debajo una fila con lo que la pantalla anterior medía y el
prototipo no tenía. El supervisor sigue entero en dos modos más, **Auditoría** y **Prompts**, con su estética de
siempre. Todo sale de una sola lectura del servidor, `lecturaDeConversation`, con el piso de 10 en toda tasa, y cada
«—» dice por qué en una línea: el resto lo explica el agente de Conversation. **Lo que cambió desde el 2026-10-10 es
el volumen, no el código**: a 30 días entraron **25 contactos** (58 el 2026-10-10) y agendaron **19 (76 %)**; en los
últimos 7 días entró **1**. Hubo **40 citas** a 30 días y **ninguna con la asistencia marcada** en toda la historia
(368 citas). El gasto de la cuenta de Meta fue de 1,20 en los últimos 7 días, con el último día con gasto el
2026-10-14 (todo medido el 2026-10-18). El sentimiento de Appointment Flow sigue bajo el piso: **6 juzgadas** a 30
días.

> **Desde el corte del 2026-10-10**
>
> - **2026-10-10 · `d297289`** — CN-5: la comparación medida contra el prototipo, los anchos y la foto; «Qué corregir
>   · {N} por resolver» pasa a contar por código, como agrupa Auditoría. La foto anterior decía que faltaba CN-5: está
>   hecha y subida.
> - **2026-10-11 · `90439cf`** — CF-1 de Creative: la tarea `contactos`, una de las cinco de las que vive esta
>   pantalla, suma la pasada de miniaturas de los contactos (`lib/negocio/barrido.ts:1046-1047`). No cambia lo que
>   cuenta Conversation; su sello puede llevar ahora el motivo de una pasada de miniaturas cortada.
> - **2026-10-11 · `2415e25`** — CF-3 de Creative: `app/inteligencia-estetica.css` se borra entera, cuando Creative
>   sale por el mismo camino que Conversation; la prueba 251 deja de mirarla.
> - **2026-10-12 · `f59cf44`** — «CONVERSACIONES: borrar un hilo desde la barra» es la lista de hilos del cerebro en la
>   barra lateral (`components/cerebro/ConversacionesDeLaBarra.jsx`), no esta sección: no toca ningún archivo de
>   Conversation.
> - **2026-10-15 · `972972e`** — Meta M-2 a M-4, el commit de producción: la tarea nueva `activos` es de Creative y no
>   entra entre las de esta pantalla (`lib/agentes/executive/adaptadores/plataforma.ts:38`).
> - **2026-10-16 · `693a383..dc84cb2`** — la Fase 0 del modelo de datos, **construida en local y sin subir**: la
>   cuenta en todas las tablas que lee esta pantalla (ver el final de § 2).
>
> **Del corte del 2026-09-28 al del 2026-10-10**
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
>   sus clasificados y «Qué corregir» contando patrones (anexo CN-4 del doc 01).

---

## 1 · Qué pide el documento

El documento funcional no vive en el repositorio. El código lo llama `AIOS_Arquitectura_Funcional_v0.2.md`
(`lib/autorizacion/secciones.ts:302`). El resumen de abajo es el de la foto del 2026-09-28, cotejado ese día contra
ese archivo local, y no se volvió a cotejar:

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
`docs/conversation/00-LO-QUE-SE-HIZO.md`. La revisión del usuario en producción sigue pendiente (riesgo 25).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:317-339`: clave `conversation`, grupo «Inteligencia», capacidad
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

**Lo que dibuja**, en el orden del panel, y lo que daba el 2026-10-18 a 30 días —el período con que abre
(`lib/negocio/periodo.ts:109`)—, deducido de la medición de ese día (no leído de la pantalla):

| bloque | dónde | el 2026-10-18, a 30 días |
|---|---|---|
| Panel Lead Flow: «Contactos», con «desde el {fecha}», y «Agendó» con el booking rate | `components/conversation/PanelDeConversation.jsx:293-310` | **25**; **19 · 76 %** |
| Panel Appointment Flow: «Citas totales» y «Asistieron» con la tasa | `components/conversation/PanelDeConversation.jsx:313-330` | **40**; «—», «Nadie marca la asistencia.» |
| Panel «De qué está hecho el grupo que agendó»: Agendaron y Alto · Medio · Bajo con su porción, y «{N} sin calificar» en el título | `components/conversation/PanelDeConversation.jsx:337-353` | 19; alto 1 (5 %) · medio 2 (11 %) · bajo 1 (5 %), 15 sin calificar |
| **Estado** · tarjeta Lead Flow: «contacto a agenda» y la cadena Entraron → Les escribimos → Respondieron → Abrieron la landing → Agendaron | `components/conversation/PanelDeConversation.jsx:412-429` | 76 %; 25 · 20 (80 %) · 12 (48 %) · «—» «Sin enlace con seguimiento.» · 19 (76 %) |
| **Estado** · tarjeta Appointment Flow: «agenda a asistencia», la cadena Citas → Confirmaron → Asistieron, las salidas, la asistencia por calidad y de dónde viene la cita | `components/conversation/PanelDeConversation.jsx:435-463` | «—»; 40 · no medido · «—»; Reprogramaron 5 (13 %), Cancelaron 14 (35 %); una sola línea «Nadie marca la asistencia.» (`components/conversation/PanelDeConversation.jsx:469-495`); el origen, 12 conversaron antes (63 %) y 7 solos (37 %) |
| **Agentes** · cuatro tarjetas: Lead Flow y Appointment Flow, texto y voz | `components/conversation/PanelDeConversation.jsx:523-564` | Lead Flow · texto: **60 % de respuesta** (12 de 20), sentimiento «—» «Sin análisis en esta ventana.»; Appointment Flow · texto: la confirmación, no medida, y sentimiento «—» «Pocos casos para una tasa.» (6 juzgadas); las dos de voz: «—», «Sin llamadas registradas.» |
| **Agentes** · «Qué corregir · {N} por resolver», que lleva al modo Auditoría | `components/conversation/PanelDeConversation.jsx:502-517` | **7 por resolver**: 27 hallazgos abiertos (26 de AppFlow y 1 de LeadFlow) en 7 códigos distintos |
| «Lo demás, en cifras»: Primera respuesta · Primer mensaje fuera de horario · Precall registrado · Molestos | `components/conversation/PanelDeConversation.jsx:570-583` | las tres primeras, no medidas; Molestos «—», «Pocos casos para una tasa.» (6 juzgadas entre los dos flujos) |

**Con «Hoy» y «7 días» la pantalla está casi vacía** (2026-10-18): 1 contacto en 7 días y 4 citas ocurridas, así que
toda tasa queda bajo el piso, «—» con «Pocos casos para una tasa.».

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
(`lib/negocio/lecturaDeConversation.ts:199-205`). Las tarjetas no abren cajón (`app/conversation.css:89-90`).

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
del cerebro (`lib/agentes/executive/adaptadores/conversation.ts:140-142`).

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

**El plan.** El «Plan de acción» es `BotonDelPlan` (`components/senales/SenalesDelDepartamento.jsx:125`) con las
señales que trae la ruta (`components/conversation/PanelDeConversation.jsx:141`): el plan de la pasada de la mañana,
de 7 días con «7 días» y de 30 con los otros tres (`app/api/auditoria/route.ts:76`). El detector tiene una sola regla,
`CONV-PATRON-ABIERTO` (`lib/agentes/detectores/conversation.ts:36-49`): traduce los hallazgos abiertos del auditor,
no mide. La tarjeta de señales sigue en el modo Auditoría.

**El cerebro.** Seis herramientas en `lib/agentes/executive/adaptadores/conversation.ts` —`auditoria_de_agentes`,
`lead_flow`, `atribucion_del_lead`, `consumo_del_precall`, `sentimiento_por_flujo` y `conversation_en_cifras`— y
`cancelacion_de_citas`, que vive con las de Sales (`lib/agentes/executive/adaptadores/sales.ts:144`).
**`conversation_en_cifras`** (`lib/agentes/executive/adaptadores/conversation.ts:133-160`) lee la misma lectura con el
«audita» que resolvió la ruta del cerebro y devuelve su `pantalla` entera, con el motivo de cada «—»; la compara con
la de la ruta, en los cuatro períodos, `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:145`. Las
demás traen los avisos que la pantalla no dibuja. La frescura de las cinco tareas de las que vive la pantalla la da
`frescura` (`lib/agentes/executive/adaptadores/plataforma.ts:38`). Las cinco corrieron el 2026-10-18 dentro de su
horario (medido ese día en `negocio.tareas_programadas`).

**Lo que se midió en el navegador (CN-5, 2026-10-10).** Contra el prototipo servido en local, a 1440 px: los paneles
guardan la proporción (303 · 303 · 503 px contra 315 · 315 · 523, con 1144 px de ancho útil contra 1188), las filas de
las cadenas miden lo mismo (42 y 31 px contra 41 y 30) y los tamaños de letra son iguales. Los paneles miden 13 px
más alto porque la línea de debajo de una cifra se parte en dos renglones, y el selector es más ancho porque tiene
cuatro modos y cuatro períodos. A 1440, 1180, 1125 y 375 px, en los cuatro modos, nada desborda a lo ancho y ninguna
cifra queda cortada; las reglas de los anchos están en `app/conversation.css:103-123`. Las pruebas: `pruebas/codigo/250-lectura-de-conversation.test.ts`,
`pruebas/base/250-lectura-de-conversation.test.ts` y `pruebas/codigo/251-la-pantalla-de-conversation.test.ts`. No se
volvió a mirar en el navegador para este corte.

**Quién la ve.** Los 3 roles de producción llevan `auditor.ver`, y **14 de los 15 usuarios activos** ven la sección:
tienen la capacidad y, si todos sus roles son restringidos, la sección concedida (medido el 2026-10-18). Editar un
prompt pide además `auditor.editar`.

**Construido en local, sin subir: la Fase 0 del modelo de datos** (`693a383..dc84cb2`, 2026-10-16). Todas las tablas
que lee esta pantalla —`contactos`, `citas`, `mensajes`, `hallazgos`, `analisis_del_agente`, `llamadas`— ganan
`cuenta_id` obligatoria y una política por organización Y cuenta
(`db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:8-12`, `db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:99-104`);
`conOrganizacion` pone `app.cuentas = '*'` (`lib/datos/contexto.ts:60`, `lib/datos/contexto.ts:208`), así que la
pantalla vería lo mismo que hoy. Ningún archivo de la sección cambia, y los eventos de la `084` no los escribe nadie
todavía (`db/migraciones/084_los_eventos.sql:14`). Ver riesgo 26.

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
`app/conversation.css` ni `lib/negocio/lecturaDeConversation.ts` (`grep` del 2026-10-10; esos archivos no cambiaron
desde entonces). El comentario que los nombraba para explicar que se habían ido salió de la vista en CN-3; sigue en la
historia (`components/views/ConversationView.jsx:12-33@6f3bdb5`).

**Lo que Executive inventaba en nombre de este departamento ya no existe**: la maqueta del Executive se retiró el
2026-10-01 (`4e9a242`), y con ella el «58 % de efectividad en Lead Flow», el hallazgo sobre 22 llamadas de un agente
de voz sin una sola fila y el embudo «Conversaciones» (la foto del 2026-09-28 los listaba en su § 3).

**Textos fijos que siguen en los módulos**, ya no a la vista porque los avisos no se dibujan, pero en la respuesta y
en el cerebro: «el CRM tiene ese campo en 3 de 1052 citas», sin fecha, en el aviso de la asistencia
(`lib/negocio/indicadoresDeCitas.ts:514-516`); y los tres valores del precall sin rama nombrados a mano
(`lib/negocio/consumoDelPrecall.ts:283-289`).

---

## 4 · Datos que ya tenemos

Medido el **2026-10-18**, con `scripts/supabase.mjs leer`, sobre la única organización con datos de negocio (1 de las
11 activas), con los predicados de cada módulo; entre paréntesis, lo del 2026-10-10:

| ventana | contactos | les escribimos | respondieron | agendaron | ICP de quienes agendaron (alto · medio · bajo · sin calificar) |
|---|---|---|---|---|---|
| 7 días | 1 (7) | 1 (6) | 1 (4) | 1 (4) | 0 · 0 · 0 · 1 |
| 30 días | 25 (58) | 20 (52) | 12 (35) | 19, 76 % (35, 60 %) | 1 · 2 · 1 · 15 |
| toda la historia | 600 (596) | 545 (542) | 308 (306) | 303 (300) | 86 · 98 · 71 · 48 |

| ventana | citas ocurridas | canceladas | reprogramadas | con la asistencia marcada |
|---|---|---|---|---|
| 7 días | 4 (12) | 2 (4) | 1 (2) | 0 |
| 30 días | 40 (56) | 14 (15) | 5 (7) | 0 |
| toda la historia | 173 (169) | 65 (63) | 18 (17) | 0 |

**El ICP de esta medición es exacto**: se contó con la regla de `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`),
el puntaje 0 en «sin calificar». La del 2026-10-10 lo contaba dentro de «bajo», y la diferencia en toda la historia
—78 a 71 en «bajo», 38 a 48 en «sin calificar», con 3 agendados más— dice que eran 7 contactos. Desde CN-1
Conversation usa el tramo de Leads Portal (`lib/negocio/lecturaDeConversation.ts:326-337`).

**Las citas, todas**: 368, del 2026-08-12 al 2026-10-20, una sola futura; ninguna con `asistio` escrito, 179
canceladas, 101 congeladas, 20 plantones y 3 «showed» del calendario (2026-10-18).

**El auditor** (2026-10-18): 27 hallazgos abiertos —26 de Appointment Flow y 1 de Lead Flow— en **7 códigos
distintos**, y ninguno resuelto en toda la historia. **El sentimiento**: a 30 días, Appointment Flow tiene 6 análisis
juzgados —0 positivos, 5 neutrales, 1 molesto— de 49; Lead Flow, ninguno de 1.

**No se midió ni el 2026-10-10 ni el 2026-10-18**: la confirmación, la mediana de la primera respuesta, el primer
mensaje fuera de horario y el precall. Las cifras del 2026-09-28, como historia y a 30 días: confirmaron 59 de 76
contactos; la primera respuesta, 5,4 min; fuera de horario, 61 de 152; el precall, 10 de 51 clasificados; la
bifurcación, 73 después de contestar y 66 sin contestar. El origen de la cita sí se midió el 2026-10-18 (§ 2).

**Lo guardado que la pantalla no usa**, del 2026-09-28 y no re-medido: el anuncio de primer toque en el 71,8 % de la
cohorte (el corte por anuncio vive en `lib/negocio/costoDelAnuncio.ts`, por los motivos de
`lib/negocio/atribucionDelLead.ts:82-99`); el ad set y las UTM de los dos toques; la zona horaria en 157 de 277, usada
sólo para fuera de horario; el autor de cada saliente —un tercio del agente de IA—; el formulario de la landing, que
dejó de escribirse el 2026-08-31; el clic al precall en 20 contactos; el estado de entrega del mensaje; y el sello del
barrido de las cinco tareas de esta pantalla, que la pantalla no lee (riesgo 22).

**El volumen.** Las altas por semana desde el 2026-08-31: 175, 89, 5, 5, 11, 7 y 1 (la semana del 2026-10-12, medido
el 2026-10-18); la última alta es del 2026-10-16 y el último mensaje del 2026-10-17, con las tareas de ingesta al día.
El gasto de toda la cuenta de Meta (`negocio.gasto_de_la_cuenta`, la `076`) fue de 626,06 en 30 días y de 1,20 en 7,
con el último día con gasto el 2026-10-14. La foto del 2026-09-28 decía que ningún anuncio había gastado después del
13 de septiembre: era el gasto de las campañas atribuidas, antes de que la `076` (2026-10-07) leyera la cuenta entera;
la cuenta gastó todas las semanas de septiembre.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Lo que la pantalla no mide, y qué haría falta, está en `docs/OTROS/futuro/lo-que-conversation-no-mide.md`. En resumen,
con la foto del 2026-09-28 donde no se re-midió:

**1 · Los agentes de voz.** `negocio.llamadas` sin filas (2026-10-18) y ningún proceso que la llene. Las llamadas de
los Analizadores son reuniones con el closer, no llamadas de un agente.

**2 · La landing, después del mensaje.** El trigger link del §9.5 no existe: el paso «Abrieron la landing» va en «—».

**3 · La asistencia.** 0 de 368 citas marcadas en toda la historia (2026-10-18). La columna y el escritor existen; lo
que falta es que los closers la marquen. Con ella caen el KPI de Appointment Flow, la asistencia por calidad y los
seis cortes del show rate del §10.7.

**4 · De dónde viene la cita, atribuida al agente.** Ningún mensaje dice qué agente lo escribió: se mide si la persona
conversó antes de agendar, no si el agente la rescató.

**5 · Las escaladas y la intervención humana.** No se registra cuándo una persona toma una conversación.

**6 · El VSL.** En cero en todos los contactos medidos el 2026-09-28; vive en Conversion.

**Y del supervisor (§11, §14, §15)**: el prompt y su versión, con `prompts_del_agente` y `versiones_del_prompt` en 0
filas (2026-10-18); la segunda evaluación del §11.3; `effectiveness_score` y `confidence` del §11.7; y el §14 entero
—ningún hallazgo tiene `resuelto_el` (2026-10-18)—. El `issue_source` del §11.4 no se guarda en los hallazgos, pero
desde AG13 el detector lo deduce al publicar cada señal (`lib/agentes/detectores/conversation.ts:51-56`). El canal
hacia Executive del §15 es hoy la tabla común de señales y el cerebro, no una tarjeta inventada.

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

**15 · La campaña es de un cliente (el nivel 3, C5 · G3).** La atribución por campaña agrupa por (campaña, cliente): dos
campañas homónimas de dos clientes son dos filas, y cada fila dice su cliente cuando las de la ventana son de más de uno
(`lib/negocio/atribucionDelLead.ts:176`, `lib/negocio/atribucionDelLead.ts:213`). La fuente es una categoría de la
empresa y no lleva cliente. Con un solo cliente, o con el foco en uno, la fila y las claves del cerebro son las de
siempre. Ninguna pantalla dibuja hoy esa tabla: viaja en el cuerpo de `GET /api/auditoria` y en la herramienta
`atribucion_del_lead`. Lo exige `pruebas/base/284-acquisition-y-conversation-con-varios-clientes.test.ts:206`.

---

## 7 · Riesgos

Los 25 de la foto del 2026-10-10, con su estado al 2026-10-18, y uno nuevo.

**1 · Executive publicaba cifras inventadas en nombre de Conversation.** **Cerrado** el 2026-10-01 (`4e9a242`).

**2 · Una falta declarada sin censar la base.** La caja de lo que falta decía que el formulario no se registraba, con
el campo en 247 contactos. **Cerrado** con la caja, que se fue en CN-3 (`a6e6309`): el «—» de la landing dice «Sin
enlace con seguimiento.», que es cierto. La regla queda: antes de escribir una falta, censar el catálogo del CRM y
contar en toda la base.

**3 · Confundir «se dejó de escribir» con «el negocio se cayó».** **Abierto, y más agudo.** La cohorte de 30 días pasó
de 277 contactos (2026-09-28) a 58 (2026-10-10) y a 25 (2026-10-18), con 1 en los últimos 7 días. Esta vez no es la
ingesta: las cinco tareas corrieron el 2026-10-18 y el último mensaje es del 2026-10-17. Lo que se ve es que la cuenta
de Meta gastó 1,20 en 7 días. Ninguna cifra de la pantalla dice cuánto entró antes, y sin flechas un booking rate de
76 % sobre 25 contactos se lee igual que uno sobre 277.

**4 · Los ceros del VSL.** **Abierto**, sin consecuencia en pantalla: el VSL no se dibuja.

**5 · El show rate no tiene ninguna vía abierta.** **Abierto**: 0 de 368 citas marcadas (2026-10-18). Una tasa sin
`asistio is not null` diría que no viene nadie.

**6 · Dos ventanas en la misma pantalla.** **Abierto.** Auditoría ya es un modo aparte, sin segmentado. Pero en
Agentes, «Qué corregir · {N}» cuenta patrones de toda la historia (`lib/negocio/lecturaDeConversation.ts:373-385`)
debajo de tarjetas que miden la ventana elegida, y nada lo dice: con «Hoy», «7 por resolver» al lado de tarjetas en
«—».

**7 · El sentimiento de Appointment Flow se apagó.** **Sigue así**: 6 juzgadas a 30 días el 2026-10-18 (8 el
2026-10-10), y la tarjeta dice «—» con «Pocos casos para una tasa.». Es correcto, y se puede leer como que el auditor
dejó de funcionar: la tarea `auditoria` corrió el 2026-10-18.

**8 · El supervisor audita sin saber qué se le pidió al agente.** **Abierto**; prompts y versiones en 0 filas
(2026-10-18).

**9 · El vocabulario del CRM se mueve y la única alarma es un contador.** **Abierto**: el aviso del precall sigue
nombrando a mano los tres valores sin rama (`lib/negocio/consumoDelPrecall.ts:283-289`).

**10 · La comparación entre fuentes que el módulo prohíbe.** **Sin cambios desde el 2026-10-10**: la atribución por
fuente y por campaña salió de la pantalla (CN1-12). Sigue en `atribucion_del_lead`
(`lib/agentes/executive/adaptadores/conversation.ts:86-103`), con tasas nulas bajo el piso; el riesgo lo corre el agente
al compararlas.

**11 · La agrupación de campañas.** **Abierto**, y sólo en el cerebro: la misma campaña partida en dos filas y un
valor que era el nombre de una persona, escondidos en «Otras» por el piso (2026-09-28, no re-medido).

**12 · La respuesta es de la conversación, no del agente.** **Abierto, y expuesto**: es la cifra grande de la tarjeta
«Lead Flow · Texto» (`lib/negocio/lecturaDeConversation.ts:268`). El desvío está declarado (CN1-02, CN1-11), pero la
pantalla no tiene dónde decirlo: lo dice el agente.

**13 · El censurado de las latencias.** **Abierto**: «Primera respuesta» es la mediana de los que contestaron, y el
aviso que cuenta a los que no (`lib/negocio/indicadoresDelLead.ts:436-448`) no se dibuja.

**14 · La guarda `>= 0` excluye filas sin decirlo.** **Abierto**, sin cambios (`lib/negocio/indicadoresDelLead.ts:331-339`).

**15 · Convertir la bifurcación en un escalón.** **Abierto.** La cadena de Lead Flow termina en «Agendaron», después de
«Respondieron», como en el prototipo. Ninguna porción miente —todas son sobre la cohorte
(`lib/negocio/lecturaDeConversation.ts:232-239`)—, pero la forma se lee como embudo y agendar no es un subconjunto de
responder: el 2026-10-18, a 30 días, 19 agendaron y 12 respondieron. La bifurcación vive en «De dónde viene la cita»,
sobre los que agendaron (`lib/negocio/lecturaDeConversation.ts:260-263`), y la suma la fija la prueba de la regla 7.

**16 · Tasas sin piso sobre uno a cinco casos.** **Cerrado en la pantalla** en CN-1 (`e1ccf44`). Las funciones siguen
sin piso (`lib/negocio/indicadoresDeCitas.ts:449`), y Sales dibuja la cancelación con ellas.

**17 · La atribución y el booking rate dejaron de contar lo mismo.** **Abierto**: la atribución sigue con el filtro de
cita alcanzable bajo un comentario que dice que es el mismo que el booking rate
(`lib/negocio/atribucionDelLead.ts:158-161`). Ya no se ve en pantalla, pero sí en el cerebro: en «Completo», el
2026-09-28, las filas sumaban 200 agendados y el booking rate decía 279.

**18 · Diez de las once empresas activas verían esta pantalla vacía.** **Abierto**: 1 de las 11 organizaciones
activas tiene contactos y análisis del auditor (2026-10-18). Sin auditoría, el sentimiento y «Qué corregir» dicen «La
empresa no audita sus agentes.»; las cifras de los flujos dependen de `negocio.*`.

**19 · `desde` sin año.** **Cerrado** en CN-4 (`89d8c19`): la fecha lleva el año cuando no es el de hoy
(`components/conversation/comun.jsx:91-97`).

**20 · Dos comentarios decían que la sección pide `tablero.ver`.** **Cerrado** en CN-3 (`a6e6309`):
`lib/autorizacion/secciones.ts:314-316` y `components/views/ConversationView.jsx:16-18`.

**21 · Los patrones se agrupan sin mirar el agente.** **Abierto** (`CN1-P07`: la auditoría no cambia).
`agruparPorPatron` junta por código (`lib/auditor/vista.ts:106-138`) y cada tarjeta se queda con los patrones cuyo
caso más reciente es suyo (`components/auditoria/PanelDeAuditoria.jsx:150`). «Qué corregir» cuenta igual, por código
(`lib/negocio/lecturaDeConversation.ts:381`): en CN-4 contaba por agente y código, y se corrigió en CN-5. **La foto
anterior se contradecía**: su tabla publicaba «8 por resolver» (7 patrones de AppFlow y 1 de LeadFlow), que es la
cuenta vieja; por código son 7, porque el patrón de LeadFlow comparte código con uno de AppFlow (medido el
2026-10-18, con los mismos 27 hallazgos abiertos).

**22 · La pantalla no avisa si su dato está viejo.** **Abierto** (`CN1-P08`): la pantalla sigue sin decirlo, y el
comentario de la cabecera no mira la frescura para Conversation (`lib/agentes/cabecera.ts:125`). Lo dice el cerebro
con `frescura`, que cubre las cinco tareas de esta pantalla (`lib/agentes/executive/adaptadores/plataforma.ts:38`), y el
detector pasa a «sin medición» si el auditor no está al día (`lib/agentes/detectores/conversation.ts:27-28`). Con el
barrido caído, «Hoy» y «7 días» se vaciarían igual que un embudo sin entrada —que es lo que pasa hoy, con el barrido
al día (riesgo 3)—, y sólo lo distingue quien le pregunte al agente.

**23 · «Confirmaron» no es una porción de «Citas».** **Abierto** (CN1-10): cuenta contactos, descartados incluidos, y
su barra es sobre los que respondieron el campo. En la misma cadena que «Citas», el conteo puede no cuadrar con el de
las citas, y la pantalla no lo explica: lo dice el agente.

**24 · «Molestos» junta los dos flujos.** **Abierto** (CN1-12). La ruta de antes de CN-2 sostenía lo contrario: uno
por agente, porque mezclarlos da un promedio que no describe a ninguno (`app/api/auditoria/route.ts:93-95@e1ccf44`).
Hoy no se nota —Lead Flow no tiene juzgadas, así que la cifra es la de Appointment Flow sola—; el día que las tenga, la
fila de abajo y las tarjetas de agente dirán cosas distintas.

**25 · La pantalla no se vio con los datos de producción.** **Abierto**: CN-5 la midió con una respuesta sintética, y
la revisión del usuario en producción sigue pendiente.

**26 · La Fase 0 vacía la pantalla si sube en el orden equivocado.** **Nuevo**, construido en local y sin subir. La
`083` pone en las tablas que lee esta pantalla una política que exige `app.cuentas`, y sin la variable no se ve nada
(`db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:8-12`). La variable la pone `conOrganizacion` desde el Paso 1
(`lib/datos/contexto.ts:208`): si la `083` llegara a producción antes que ese código, la pantalla diría cero contactos
y cero citas sin ningún error, que es justo el cero que esta sección distingue de «no hay medición».

**El cuello de botella de Conversation no es técnico**: la pantalla está, con todo lo que el sistema mide, y sigue sin
poder llenarse la asistencia, la voz, la landing y la atribución de la cita al agente. Y desde la semana del
2026-10-12 casi no entra nadie a quien medir.
