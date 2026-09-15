# Conversation Intelligence
> Corte: **2026-09-15**. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

**Construido y funcionando.**

Es el único de los cinco departamentos de Inteligencia que está construido de verdad: 21 cifras salen hoy de `negocio.*` y del auditor con su denominador y su piso al lado, el prototipo inventado se borró entero, y lo que falta está declarado en pantalla — aunque una de las seis declaraciones de falta es falsa y los números que Executive publica EN NOMBRE de este departamento siguen siendo inventados.

---

## 1 · Qué pide el documento

**§8 — Misión.** Conversation Intelligence supervisa, analiza y mejora las conversaciones automatizadas. Dos módulos, cada uno con agente de texto, agente de voz y Supervisor: **Lead Flow** (conseguir la cita) y **Appointment Flow** (que asista).

**§9 — Lead Flow.** Misión: convertir contactos sin cita en citas, guiándolos a la landing VSL sin agendar dentro de la conversación (§9.1). Recorrido de diez pasos, de «contacto sin cita» a «cita agendada» (§9.2). KPI principal **Booking Rate**, con el denominador declarado explícitamente — contactos gestionados, que respondieron, que abrieron el enlace o que visitaron la landing (§9.3). §9.5 pide un **trigger link** que separe enlace enviado / abierto / landing visitada / formulario iniciado / formulario completado / cita agendada, «para identificar el punto real de pérdida». §9.6 lista los datos consumibles: básicos (`lead_id`, `ghl_contact_id`, teléfono, correo, **zona horaria**, idioma, fecha de creación, estado del funnel), **atribución** (campaña, ad set, anuncio, creativo, UTM first-touch, UTM last-touch, landing de origen), calificación previa (respuestas de Meta Lead Ads) e **historial conversacional** (mensajes, llamadas, audios, videos, objeciones, **sentimiento**, intentos, última interacción, apertura del trigger link). §9.7 pide veinte KPIs: contact/response/link sent/link open/landing visit/form start/form completion/booking rate, tiempo hasta el primer intento, hasta la primera respuesta, hasta el envío del enlace y hasta el agendamiento, intentos promedio, conversaciones abandonadas, agendamientos por agente / por canal / **por fuente y anuncio**, sentimiento, tasa de errores y tasa de intervención humana.

**§10 — Appointment Flow.** Misión: convertir citas en asistencias (§10.1). KPI principal **Show Rate** (§10.3). §10.5 pide perfil del lead, respuestas del formulario de la landing, **ICP score y segmento ICP**, `appointment_id`, fecha/hora/zona, closer asignado, **tiempo entre agendamiento y cita**, estado de confirmación, cancelaciones, reagendamientos, anuncio de origen y el consumo del VSL y del video precall «cuando exista tracking individual verificable». §10.6 define tres ramas para el precall: no vio / vio parcialmente / completó. §10.7 pide dieciséis KPIs: show, confirmation, cancellation, reschedule y no-show rate; tiempo entre agendamiento y cita; show rate **por ICP, por anuncio, por closer, según anticipación, según consumo del VSL y según consumo del precall**; respuesta a recordatorios; sentimiento; intervención humana; errores.

**§11 — Supervisor.** No conversa: evalúa. §11.2 le exige contexto completo —módulo, canal, objetivo, **prompt completo activo, versión del prompt**, estrategia, herramientas, restricciones, datos disponibles, contexto del contacto, historial, resultado esperado y real— porque sin eso no distingue error de ejecución de error de diseño. §11.3: dos evaluaciones separadas (cumplimiento del agente / calidad del prompt). §11.4: vocabulario `issue_source` de seis valores (`agent_execution`, `prompt_design`, `missing_tool`, `missing_data`, `workflow_configuration`, `external_failure`). §11.6: cuatro categorías de error (Contexto, Estrategia, Comunicación, Operación) con sus subcasos. **§11.7** exige guardar un resultado estructurado de dieciséis campos: `conversation_id`, `module`, `agent_type`, `agent_id`, `objective`, `outcome`, `sentiment`, `effectiveness_score`, `issue_detected`, `issue_source`, `error_category`, `severity`, `evidence`, `recommended_fix`, `confidence`, `prompt_version`, `analysis_date` — «no se debe guardar únicamente un párrafo libre». §11.8: el supervisor **no** modifica prompts automáticamente; propone problema/causa/cambio/evidencia/impacto/conversaciones afectadas/confianza, y un humano publica una versión nueva. Cada conversación debe conservar la versión del prompt usada.

**§12 — Recomendaciones locales**, que van al responsable del área sin necesitar aprobación de Executive para ser visibles.

**§13 — Responsables:** de Lead Flow, de Appointment Flow, de automatización conversacional, técnico y gerencia, cada uno con sus reportes, alertas, conversaciones problemáticas, errores, recomendaciones, tareas y estado.

**§14 — Medición de impacto:** cada cambio registra problema, hipótesis, métrica principal y secundarias, segmento, línea base, fecha, responsable, periodo, resultado, variables externas y decisión, con estados Propuesta → Aprobada → Asignada → En progreso → Implementada → En medición → Validada/Iterar/Revertir, y el sistema debe diferenciar correlación de causalidad.

**§15 — Lo que entrega a Executive:** salud de los dos flujos, booking rate, link open rate, landing visit rate, form completion rate, show rate, principales errores, principales objeciones, sentimiento, agentes con bajo desempeño, conversaciones críticas, recomendaciones, tareas, resultados de cambios, **datos faltantes**, riesgos y oportunidades.

**§16 — Estado y roadmap.** §16.1 da por existentes los dos flujos, los agentes de texto y voz, el supervisor, la auditoría de llamadas de venta, la integración con GHL y la posibilidad de Meta. §16.2 pone como **prioridad técnica inmediata, antes de construir Business, Creative y Executive**, validar la trazabilidad Anuncio → Landing → Sesión → VSL → Formulario → Contacto GHL → ICP → Cita → Asistencia → Venta, con ocho pruebas: capturar UTMs y `meta_ad_id`; generar `visitor_id`/`session_id`; asociarlos al contacto; implementar trigger link; **validar tracking individual del VSL**; **validar tracking individual del precall**; conectar contacto-cita-asistencia-venta; y mantener historial de prompts y análisis.

**§17 — Pendientes:** los otros cuatro departamentos de Inteligencia todavía no tienen especificación detallada. Conversation sí la tiene, y por eso es el contraste.

---

## 2 · Qué hay hoy en pantalla

La pantalla es la sección `conversation` (`lib/autorizacion/secciones.ts`, grupo «Inteligencia»), la dibuja `components/views/ConversationView.jsx:43` y todo el cuerpo es `components/conversation/PanelDeConversation.jsx` (675 líneas). **Cuatro pestañas planas** (`PanelDeConversation.jsx:71-76`): Lead Flow · Appointment Flow · Auditoría · Prompts. Una sola lectura alimenta las cuatro: `GET /api/auditoria` (`app/api/auditoria/route.ts:79-94`) trae en una transacción la pantalla del auditor, los prompts, y las cinco familias de cifras. El reloj recarga cada 60 s sólo con la pantalla a la vista (`PanelDeConversation.jsx:181-183`, `CADENCIA.inteligencia`).

Aviso de alcance que vale para todo lo que sigue: **hay 12 empresas activas de 15 (`identidad.organizaciones`), 4 tienen llave de IA, 1 tiene el identificador del agente en el CRM y 1 tiene token de CRM** — y **una sola organización tiene datos de negocio: 584 contactos, 317 citas, 5 843 mensajes**. Medido el 2026-09-15 02:28 UTC. Todas las cifras de abajo son de esa organización; en las otras once la pantalla dibuja el freno `POR_QUE_NO_AUDITA` (`lib/auditor/vista.ts:196-206`) y cifras vacías.

── **PESTAÑA LEAD FLOW** ──

Módulos: `lib/negocio/indicadoresDelLead.ts` (306 líneas), `lib/negocio/atribucionDelLead.ts` (263) y `lib/auditor/sentimiento.ts` (200). Cohorte única: contactos con `alta_en_el_crm` en 14 días = **233** (`indicadoresDelLead.ts:120`).

1. **Agendaron (booking rate, §9.3)** — `PanelDeConversation.jsx:308-312` — **52,8 %**, denominador «123 de 233». Piso: ninguno; sólo es `null` con cohorte 0 (`indicadoresDelLead.ts:173`). Numerador: contactos con al menos una cita de `ghl_calendario_id is not null`, **sin** exigir que la cita ya haya ocurrido (`:142-145`).
2. **Respondieron** — `:313-319` — **61,2 %**, «139 de 227 escritos». Denominador propio: los que recibieron al menos un saliente, no la cohorte.
3. **Tardamos en escribir** — `:320-328` — **2,3 min** (p50), detalle «9 de cada 10, antes de 5,4 min» (p90). Sobre 227 contactos. Percentiles, no promedio (`indicadoresDelLead.ts:62-67`).
4. **Tardan en contestar** — `:329-339` — **6,2 min** (p50), detalle «9 de cada 10, antes de 6,3 h» (p90 = 376,7 min). Sobre 139. El p90 es **60,5 veces** el p50, medido hoy.
5. **Nota de conteos** — `:344-351` — «**6** no recibieron ningún mensaje nuestro y **88** recibieron y todavía no contestaron».
6. **Tres notas de alcance fijas** — `:357-367` — que la cifra mide si el contacto contestó y **no a quién**, y que la cohorte se arma por fecha de entrada al CRM.
7. **Aviso de latencias** — `:368` — activo hoy: 88 pendientes > 1 (`indicadoresDelLead.ts:294-306`).
8. **Aviso de cohorte** — `:369` — activo hoy: 6 sin escribir > 1 (`:265-281`).
9. **De dónde vinieron · Por fuente** — `:391` — **Paid Social 51,1 % · 112 de 219**; **«Otras» — · 11 de 14** (sin tasa, por debajo del piso de 10). `direct traffic` (8) y `social media` (6) caen ahí.
10. **De dónde vinieron · Por campaña** — `:392` — **«NUEVA ERA | TOFU | LEADS | LATAM+USA | 01-09-26» 43,3 % · 74 de 171**; **«Nueva Era | Bofu | Agendas | Latam+usa | 28-08-26» 87,2 % · 34 de 39**; **«Otras» — · 15 de 23**. La agrupación es en minúscula y la etiqueta que se muestra es `min()` del valor crudo (`atribucionDelLead.ts:124-127`).
11. **Fuera de horario** — `:399-405` — **50 de 128** primeros mensajes salieron antes de las 8 o después de las 21 **en la zona del contacto**; 100 de los 228 contactos escritos no traen zona y no entran ni como dentro ni como fuera (`atribucionDelLead.ts:210-239`, umbrales `DESDE=8`/`HASTA=21` en `:72-73`).
12. **Aviso de atribución** — `:407` — activo: hay filas en «Otras» (`atribucionDelLead.ts:248-263`).
13. **Sentimiento de Lead Flow** — `:493-522` — **se dibuja con todo en cero**: «Quedaron molestos —», «Neutrales 0», «Positivas 0», porque `juzgadas = 0` pero el aviso no es nulo. El aviso dice: «Este agente todavía no tiene ninguna conversación juzgable en 14 días. No es que los contactos estén conformes: es que no hubo suficientes intercambios suyos para auditar.» Medido: `chat_pre_agenda` tiene **5 análisis y los 5 son no auditables** (`sentimiento.ts:146-157`).

── **PESTAÑA APPOINTMENT FLOW** ──

Módulos: `lib/negocio/indicadoresDeCitas.ts` (476) y `lib/negocio/consumoDelPrecall.ts` (293). Ventana: citas con `inicio_el` en los últimos 14 días **y ya ocurridas**; se excluyen las congeladas (`ghl_calendario_id is null`) y las de contactos descartados.

14. **Cancelación** — `:532-536` — **33,3 % · 25 de 75**.
15. **Reagendadas** — `:537-541` — **9,3 % · 7 de 75**.
16. **Se reserva con** — `:542-549` — **2,1 días** (mediana 49,7 h), detalle «sobre 74 de 75». Denominador propio, declarado.
17. **No-show** — `:550-556` — **2 reportados**. Es un **conteo y no una tasa**, a propósito (`indicadoresDeCitas.ts:83-93`). Sale de `negocio.resultados` (2 `no_show` y 4 `seguimiento` en la ventana), no del calendario.
18. **Se presentaron** — `:557-564` — **«—»**, porque `conAsistencia = 0`. Medido: **`negocio.citas.asistio` está poblado en 0 de 317 filas**. El aviso de al lado (`:598`) dice: «Nadie registró todavía si el contacto se presentó, en ninguna de las 75 citas de los últimos 14 días. Se pregunta al cerrar el intento en Avanzar…».
19. **Confirmaron** — `:565-573` — **75,8 % · 47 de 62 contactos**. Único de la fila que sale del CRM: campo `Confirmación Agendamiento` resuelto por nombre (`indicadoresDeCitas.ts:171` + `campoPorNombre`), `campo_id = R91VXxD5gkFeGSVva7ts`, tipo SINGLE_OPTIONS. Denominador **contactos**, no citas: hay 139 contactos con cita en la ventana y 62 tienen el campo respondido. Sin aviso hoy (62 ≥ 10).
20. **Nota de descartados** — `:581-588` — «No se cuentan **75** citas de contactos que ya habían sido rechazados, que cancelan el **92,0 %**». Sin esa separación la tasa publicada sería **62,7 %** sobre 150 citas en vez de 33,3 % sobre 75.
21. **Aviso de citas congeladas** — `:600` — activo: **12** citas de la ventana con `ghl_calendario_id` nulo quedan fuera.
22. **Precall · Registró reproducción (§10.6)** — `:457-461` — **21,4 % · «9 de 42 clasificados»**. Censo hoy en la ventana: `Sin abrir (0%)` 25, `Nada` 8, `-20%` 4, sin campo 3, `1–25%` 3, `76–100%` 3, `40-60%` 2, `Clic a link` 2, `Accede: sin reproducir` 1, `26–50%` 1 → 52 contactos, 49 con campo, 33 sin reproducción, 6 parcial, 3 completo, **7 sin rama**.
23. **Precall · Llegaron a la llamada** — `:470` — **52 contactos**.
24. **Precall · desglose fino** — `:464-469` — **NO se dibuja**: `detalleSePublica` exige que las dos ramas pasen el piso de 10 y hoy son 6 y 3 (`consumoDelPrecall.ts:239`).
25. **Aviso del precall** — `:478` — activo con tres partes: 3 de 52 sin campo; 7 sin clasificar; y el desglose fino oculto.
26. **Sentimiento de Appointment Flow** — `:505-511` — **Quedaron molestos 27,3 % · «3 de 11 juzgadas»**; **Neutrales 5**; **Positivas 3**. Denominador: análisis `auditable = true` **y** `disparo <> 'mejora'` en 14 días (`sentimiento.ts:89-93`).

── **PESTAÑA AUDITORÍA (el Supervisor del §11)** ──

`lib/auditor/pantalla.ts` + `components/auditoria/PanelDeAuditoria.jsx` (520 líneas). Dos tarjetas, una por agente de `AGENTES` (`lib/auditor/veredicto.ts:52`). **Estas cifras NO tienen ventana: cuentan toda la historia** (`pantalla.ts:196-239`), al revés que las 26 de arriba.

27. **Tarjeta LeadFlow** — 0 auditables · 0 verdes / 0 amarillos / 0 rojos · «5 conversaciones miradas, 5 sin poder juzgar · sin prompt cargado».
28. **Tarjeta AppFlow** — **34 auditables** · **16 verdes / 16 amarillos / 2 rojos** · «41 conversaciones miradas, 7 sin poder juzgar · sin prompt cargado · **2 en la cola de urgentes**».
29. **Patrones abiertos: 5, con 20 casos** (`agruparPorPatron`, `lib/auditor/vista.ts:90-122`), ordenados por cantidad: `ignora_pedido_reagendar` ×9 (rojo), `recordatorio_fecha_inconsistente` ×5 (rojo), `presiona_asistencia_con_duda` ×3 (rojo), `no_lee_confirmacion_previa` ×2 (amarillo), `no_leyo_a_medias` ×1 (amarillo). Los 20 hallazgos son de `chat_post_agenda` y **ninguno está resuelto**.
30. **Contador de la pestaña Auditoría: «5»** (`PanelDeConversation.jsx:212`).
31. **Lista de conversaciones auditadas**: 46 filas totales, tope 50 (`pantalla.ts:50`), así que no se corta.

── **PESTAÑA PROMPTS** ──

32. **Contador «2»** (`PanelDeConversation.jsx:213-215`): **`negocio.prompts_del_agente` tiene 0 filas**, así que los dos agentes están sin prompt de referencia. `negocio.versiones_del_prompt` también tiene **0 filas**. El propio panel aclara que ese prompt es «de referencia: **no** es el prompt que corre en el CRM» (`PanelDeAuditoria.jsx:448`).

── **LO QUE LA PANTALLA DECLARA COMO FALTANTE, VERIFICADO CONTRA LA BASE** ──

`FLUJOS[*].falta` (`PanelDeConversation.jsx:84-88` y `:94-127`). Seis renglones:

**L1 · «El recorrido hasta la landing» → PARCIALMENTE FALSA.** Dice que «enlace enviado, enlace abierto, visita y formulario **no se registran en ninguna parte**». Comprobado contra la base, no contra el código: · *Enlace enviado / abierto*: cierto, no hay nada — busqué en las 170 filas de `negocio.campos_del_crm` por `%trigger%`, `%clic%`, `%click%`, `%abri%`, `%visit%`, `%session%` y lo único que aparece es `Clic a Video Pre-Call`, que es del precall, no de la landing. · *Visita*: parcialmente falso — existe `Last Landing URL` (`rU9mqLWhY3PlNaMWxIiw`, TEXT) en **99 de los 233** contactos de la ventana (42,5 %), y `atribucion_primera->>'url'` en 55 de 233. Es una URL de atribución, no un evento de visita verificado. · *Formulario*: **FALSO como está escrito.** Existe el campo **`Form Landing VSL`** (`XqOfGEWle6fay7hPuvWp`, SINGLE_OPTIONS), poblado en **247 de 584 contactos**, con exactamente el vocabulario que el §9.5 pide separar: **`Agendado` 121 · `Form incompleto sin agendar` 87 · `Form completo sin agendar` 39**. Eso es form-start, form-completion y booking en un solo campo. **Dejó de escribirse el 2026-08-31 00:57 UTC**: 243 de los 295 contactos de agosto lo tienen y **0 de los 236 de septiembre**. Por eso hoy no se puede calcular sobre la ventana — pero la conclusión correcta no es «no existe», es «una automatización del CRM se apagó hace quince días», que manda a hacer algo completamente distinto.

**L2 · «El histórico de las tasas por período» → CIERTA.** `negocio.citas.reservada_el` está en 185 de 317 filas, y por semana de `inicio_el`: 2026-08-10 **0 de 24**, 2026-08-17 **0 de 63**, 2026-08-24 11 de 42, 2026-08-31 66 de 76, 2026-09-07 89 de 93, 2026-09-14 **19 de 19**. Y no se van a llenar: `lib/negocio/citas.ts:74` fija `DIAS_ATRAS = 14`, así que el barrido no vuelve a pasar por las viejas.

**L3 · «El agente de voz» → CIERTA.** `negocio.llamadas` tiene **0 filas**, y sus columnas son `org_id, id, externa_id, contacto_id, agente, contestada, inicio_el, duracion_segundos, resumen, creado_el` — **no hay columna de transcripción**. Concuerda con `lib/auditor/veredicto.ts:46-52`, que deja los dos auditores de voz fuera de `AGENTES` por esa misma medición.

**A1 · «La asistencia según el CALENDARIO» → CIERTA en el fondo, con una cifra que esta base no puede confirmar.** Los dos estados de asistencia del calendario: **`showed` en 0 de 317 citas** y **`noshow` en 3 de 317** (el vocabulario completo de `estado_ghl` es `cancelled` 160, `confirmed` 154, `noshow` 3). «Prácticamente vacíos» es exacto. Pero el renglón cita «3 citas de **1052** en todo un año» y `negocio.citas` sólo tiene **317 filas** (de 2026-08-12 a 2026-09-19): ese 1052 es el total de la subcuenta del CRM, medido fuera de esta base, y desde acá no es verificable. Va fechado, así que es honesto; no es reproducible.

**A2 · «CUÁNDO vio el precall» → CIERTA.** `negocio.campos_del_crm` guarda `(org_id, campo_id, nombre, etiqueta_corta, carpeta_id, tipo, posicion, visto_el)` — `visto_el` es de cuándo NUESTRO sistema vio el campo en el catálogo, no de cuándo el contacto lo respondió. Y `contactos.campos_del_crm` es un jsonb plano de valor por `campo_id`, sin marca de tiempo. No hay ningún campo del CRM con fecha de precall: busqué `%video%`, `%vsl%`, `%precall%`, `%pre-call%` y los siete que salen son de porcentaje o de enlace.

**A3 · «El historial de reagendamientos» → CIERTA.** `negocio.citas.reagendada_el` es **una** columna timestamp —un solo movimiento por cita—, poblada en **15 de 317**, 7 en la ventana medida. No hay tabla de historial. Y el cron de citas corre con el horario `3 * * * *` (`vercel.json`), o sea una vez por hora, así que dos movimientos dentro de la misma hora se ven como uno.

── **LO QUE SE BORRÓ** ──

`lib/aios/conversation.js` **ya no existe** (confirmado: el directorio `lib/aios/` tiene 13 archivos y ninguno es ése). Eran 559 líneas, ~180 de literales inventados: un embudo completo (`LEAD0`, `APPT0`, `ORIGEN0`), cuatro agentes con nombre de persona, tres filas de calidad de lead, quince líneas de diálogo de clientes que no existen, seis «incidencias» con diagnósticos que imitaban a un supervisor de IA y catorce líneas de prompt sugerido; 6 de sus 19 constantes estaban muertas. El agente se llamaba **«Sofía»**, un diálogo saludaba a **«Rodrigo»** y **«landing BCL»** —iniciales de un cliente real— aparecía en tres sitios. Todo eso está documentado en `components/views/ConversationView.jsx:12-33`. **Ningún nombre de persona ni de marca real quedó en el código de esta pantalla**: verificado con `grep` sobre `components/conversation/`, `components/auditoria/` y `components/views/ConversationView.jsx` — los tres únicos aciertos de «Sofía», «Rodrigo», «BCL» y «GHL» están dentro de ese comentario que explica que se fueron. Las marcas que sí se ven en pantalla —los dos nombres de campaña de la tabla de atribución— **vienen de la base**, no del código.

---

## 3 · Lo que está hardcodeado

**10 juego(s) de datos inventados.**

### 3.1 · La tarjeta de Conversation en el grafo de departamentos de Executive: `conversation:{t:'Conversation', st:'warn', num:'58% de efectividad en Lead Flow · +3 pts', find:'El agente de voz no reconfirma día y hora en 14 de 22 llamadas · 12 pts menos de asistencia', dep:'Recibo de Conversion los 31 agendados en riesgo de no-show de esta semana'}`

- **Dónde:** `lib/aios/executive.js:190-193`
- **Finge ser:** Lo que el §15 pide que Conversation Intelligence le entregue a Executive: salud de Lead Flow, agentes con bajo desempeño y el hallazgo principal. Es el mismo hallazgo inventado —«En 14 de 22 llamadas»— que se borró de `lib/aios/conversation.js`: sobrevivió acá.
- **¿Se puede reemplazar hoy?** Parcialmente, y hay que decir qué parte NO. El «58 % de efectividad en Lead Flow» se puede reemplazar hoy por el booking rate real (52,8 %, 123 de 233) o por la tasa de respuesta (61,2 %, 139 de 227). El «+3 pts» **no**: no hay línea base, porque `reservada_el` está en 0 de las 87 citas anteriores al 2026-08-24 y no se va a llenar. Y el hallazgo del agente de voz es **indefendible en cualquier forma**: `negocio.llamadas` tiene 0 filas y ninguna columna de transcripción, así que hoy se publica en Executive una cifra sobre 22 llamadas de un agente del que este sistema no tiene un solo registro.

### 3.2 · El paso «Conversaciones» del embudo de Executive, con su serie por período: `conversaciones` 41 / 268 / 1072 / 2787 / 6840 dentro de la constante `F`

- **Dónde:** `lib/aios/executive.js:16-20 (la serie) y :24 (el paso que la lee, `own:'Conversation'`)`
- **Finge ser:** El volumen conversacional que Conversation Intelligence aporta al embudo Contactos → Conversaciones → Visitas landing → Agendamientos → Citas asistidas → Ventas. El módulo calcula con esa serie el cuello de botella (`worst`) y lo pinta en rojo, así que un número inventado decide qué paso se señala como problema.
- **¿Se puede reemplazar hoy?** Sí para el conteo, no para el embudo entero. «Contactos» y «Conversaciones» se pueden medir hoy: en 14 días, 233 contactos entraron al CRM, 227 recibieron al menos un saliente y 139 contestaron. «Agendamientos» también: 123. Lo que NO se puede es el paso «Visitas landing» (ver el renglón L1 de las faltas: el campo del formulario dejó de escribirse el 2026-08-31) ni «Citas asistidas» (`citas.asistio` está en 0 de 317, `estado_ghl='showed'` en 0 de 317). Con dos de los seis pasos vacíos, el cálculo del cuello de botella no se puede reemplazar por uno real: sólo se pueden reemplazar los cuatro pasos que sí tienen dato, y declarar los otros dos.

### 3.3 · Las tres preguntas sugeridas del panel de chat para la pantalla `conversation`: «¿Qué agente necesita ajuste?», «¿Por qué bajó la asistencia?», «¿Qué dicen los leads que no agendan?»

- **Dónde:** `lib/aios/executive-chat.js:22`
- **Finge ser:** Que el asistente de Executive puede contestar sobre este departamento. El objeto `ANSWERS` (`lib/aios/executive-chat.js:30-39`) tiene cinco respuestas y **ninguna es de conversation**: las tres preguntas caen en `default`, que habla de la landing y del móvil.
- **¿Se puede reemplazar hoy?** Sólo una de las tres. «¿Qué agente necesita ajuste?» tiene respuesta medida hoy: AppFlow tiene 16 amarillos y 2 rojos sobre 34 auditables y 5 patrones abiertos con 20 casos; LeadFlow no tiene ni un veredicto (5 análisis, los 5 no auditables). «¿Por qué bajó la asistencia?» **no se puede contestar**: no hay serie de asistencia —`asistio` está en 0 de 317— así que no hay ni nivel ni caída. «¿Qué dicen los leads que no agendan?» tampoco: haría falta leer los transcripts de los 110 contactos que no agendaron, y el auditor sólo juzgó 11 conversaciones de post-agenda en 14 días.

### 3.4 · La tarjeta de cambio «Video de bienvenida en la página de gracias», con «Solo 54% le da play», que cita a Conversation como una de sus dos fuentes de evidencia

- **Dónde:** `lib/aios/executive-panel.js:30-33`
- **Finge ser:** El §14 entero: un cambio con su métrica, su resultado y su estado («Esperar una semana más de datos»), atribuido en parte a este departamento.
- **¿Se puede reemplazar hoy?** No. El §14 no está construido en ninguna forma: `negocio.versiones_del_prompt` tiene **0 filas**, `negocio.prompts_del_agente` tiene **0 filas**, y no existe ninguna tabla de cambios, hipótesis, línea base ni estados. Lo más cercano que hay es `hallazgos.resuelto_el` / `resuelto_por`, que registra que alguien cerró un hallazgo, y hoy está nulo en los 20.

### 3.5 · «3 citas de 1052 en todo un año», dentro del renglón «La asistencia según el CALENDARIO» de `FLUJOS.appflow.falta`

- **Dónde:** `components/conversation/PanelDeConversation.jsx:115`
- **Finge ser:** La cobertura real de los campos de asistencia del CRM. Va fechada —«medido en septiembre de 2026»— que es exactamente lo que la convierte en una medición y no en una afirmación sobre el ahora.
- **¿Se puede reemplazar hoy?** El hecho sí, el denominador no. Desde esta base se puede afirmar hoy: `estado_ghl='showed'` en **0 de 317** citas y `'noshow'` en **3 de 317**. El 1052 es el total de la subcuenta del CRM y `negocio.citas` no lo tiene —sólo guarda 317 citas, desde el 2026-08-12—, así que reemplazarlo por un número derivado de la base cambiaría lo que la frase dice. Está bien resuelto como está: fechado y declarado.

### 3.6 · «las 316 citas que había al medirlo, en septiembre de 2026», en la nota al pie de la tarjeta de cancelación

- **Dónde:** `components/conversation/PanelDeConversation.jsx:592-593`
- **Finge ser:** Que los campos de asistencia del CRM estaban vacíos sobre el total de citas conocido.
- **¿Se puede reemplazar hoy?** Sí, y ya envejeció: hoy `negocio.citas` tiene **317** filas, una más que la cifra escrita. Va fechada, así que no miente — pero es una cadena que hay que reescribir a mano cada vez que alguien quiera actualizarla, sobre una tabla que crece todos los días. Se puede derivar: la consulta de `tasaDeCancelacion` ya recorre esa tabla y podría devolver el conteo con la cifra.

### 3.7 · «el CRM tiene ese campo en 3 de 1052 citas», dentro de `avisoDeLaAsistencia`

- **Dónde:** `lib/negocio/indicadoresDeCitas.ts:441`
- **Finge ser:** La justificación de por qué la asistencia la reporta el closer y no el calendario.
- **¿Se puede reemplazar hoy?** **Éste es el que hay que arreglar, y es el único sin fecha.** Está visible en pantalla ahora mismo —la rama se activa con `conAsistencia === 0`, y hoy es 0— y no dice cuándo se midió, así que se lee como el estado de hoy. Las otras dos cadenas con la misma cifra van fechadas; ésta no. Y el 1052 no es verificable desde esta base, igual que el anterior: lo que sí se puede afirmar acá es 3 de 317 con `estado_ghl='noshow'` y 0 de 317 con `'showed'`.

### 3.8 · Los tres valores sin clasificar nombrados literalmente en el aviso del precall: «-20%», «Clic a link», «Accede: sin reproducir»

- **Dónde:** `lib/negocio/consumoDelPrecall.ts:274-275`
- **Finge ser:** Qué valores del vocabulario del CRM no se pudieron mapear a una rama del §10.6. Se pinta en pantalla hoy, junto al «7 traen un valor que no se puede clasificar».
- **¿Se puede reemplazar hoy?** Sí, y conviene: el conteo (`sinRama = 7`) se calcula, pero los tres NOMBRES están escritos a mano. Hoy coinciden exactamente —en la ventana hay `-20%` ×4, `Clic a link` ×2, `Accede: sin reproducir` ×1 = 7— pero el día que el CRM agregue un valor nuevo al RADIO, el conteo dirá 8 y la frase seguirá nombrando los mismos tres. Los valores ya vienen del `group by` de la consulta (`consumoDelPrecall.ts:161-198`): se pueden pasar al aviso en vez de repetirlos.

### 3.9 · El mapa `RAMA` de valores del precall a las tres ramas del §10.6, y el censo de 10 valores que lo justifica

- **Dónde:** `lib/negocio/consumoDelPrecall.ts:69-102`
- **Finge ser:** El vocabulario del campo RADIO `Video Pre-Call` de este CRM. El censo está fechado el 2026-09-14.
- **¿Se puede reemplazar hoy?** No, y no debería. Es una decisión, no un dato: `negocio.campos_del_crm` guarda el tipo del campo pero **no las opciones declaradas**, así que no hay de dónde derivarlo. Lo verifiqué hoy 2026-09-15 y el censo sigue completo, valor por valor: `Sin abrir (0%)` 131 · `Nada` 43 · `76–100%` 12 · `1–25%` 11 · `-20%` 5 · `51–75%` 4 · `40-60%` 2 · `Clic a link` 2 · `26–50%` 2 · `Accede: sin reproducir` 1. Ningún valor nuevo. Lo que sí es frágil es que la única alarma de un valor nuevo sea el contador `sinRama`.

### 3.10 · Los dos nombres de campo del CRM como constantes de módulo: `CAMPO_DE_CONFIRMACION = 'Confirmación Agendamiento'` y `CAMPO_DEL_PRECALL = 'Video Pre-Call'`, más el valor `CONFIRMO = 'Si'`

- **Dónde:** `lib/negocio/indicadoresDeCitas.ts:171 y :174; lib/negocio/consumoDelPrecall.ts:64`
- **Finge ser:** Configuración de ESTA empresa disfrazada de constante. Los dos archivos lo declaran en su propio comentario: «el día que haya una segunda empresa con otro nombre, esto se muda a una columna de `organizaciones_credenciales`».
- **¿Se puede reemplazar hoy?** Hoy no hace falta y está bien resuelto a medias: el `campo_id` **no** está escrito a mano —se resuelve por nombre contra `negocio.campos_del_crm` con `campoPorNombre`, que es la regla del proyecto— y si el nombre no aparece, la cifra devuelve `null` con un aviso que manda a mirar el CRM, no un cero. El riesgo real es acotado: hay una sola organización con datos. Verificado hoy: los dos nombres resuelven —`R91VXxD5gkFeGSVva7ts` (SINGLE_OPTIONS) y `vnmG6lwG0mnh8JX0t4Pp` (RADIO)— y el valor `Si` está en 47 de los 62 contactos que respondieron el campo en la ventana.


---

## 4 · Datos que YA tenemos

Todo lo de abajo está medido contra producción el **2026-09-15 02:28 UTC**, sobre la única organización con datos (`57e90f8a-…`), y las coberturas son **sobre la ventana de 14 días** —233 contactos de alta en el CRM, 75 citas alcanzables ya ocurridas y no descartadas— salvo donde digo lo contrario.

── **Lo que el documento pide y YA se dibuja** ──

**§9.3 Booking rate** con denominador declarado: 123 de 233 = 52,8 %. **§9.7** contact/response rate (227 escritos, 139 respondieron), tiempo hasta el primer intento (p50 2,3 min, p90 5,4 min, sobre 227), tiempo hasta la primera respuesta (p50 6,2 min, p90 6,3 h, sobre 139), conversaciones sin atender (6 sin ningún mensaje, 88 escritos sin contestar), agendamientos por fuente y por campaña, y sentimiento. **§10.7** cancellation rate (33,3 %), reschedule rate (9,3 %), tiempo entre agendamiento y cita (mediana 2,1 días, sobre 74 de 75), confirmation rate (75,8 %, 47 de 62 contactos), no-show reportado (2, como conteo), consumo del precall (21,4 %, 9 de 42) y sentimiento (27,3 % molestos, 3 de 11). **§10.6** las tres ramas del precall, con la cuarta —«accedió y no reprodujo»— contada aparte porque el documento no la tiene. **§11** el supervisor entero, con 46 análisis, 34 auditables, 16/16/2 y 20 hallazgos abiertos en 5 patrones.

── **Lo que YA está guardado y la pantalla todavía NO usa** ──

Esto es lo que más importa de este informe, porque es trabajo que no hay que negociar con nadie: el dato ya está en la base.

**1 · El anuncio (§9.7 «agendamientos por fuente y anuncio», §10.7 «show rate por anuncio»).** `contactos.atribucion_primera->>'adId'` está poblado en **176 de los 233** contactos de la ventana (75,5 %), con el identificador de Meta tal cual: `120249633901580467` (109 contactos), `120249633901550467` (44), `120249633901570467` (17), y otros cuatro. `adSource` = `facebook` en 178 de 233. La pantalla hoy sólo corta por `sessionSource` y `campaign` (`atribucionDelLead.ts:76-80`). **El booking rate por anuncio se puede construir hoy**, con el mismo `cortePor` que ya existe, cambiando la clave — y dos de los tres anuncios pasan el piso de 10.

**2 · El ad set (§9.6 «Ad set»).** Campo del CRM `Last UTM Medium (Adset)` (`YG26sJ8wg5TFpDtZdlit`, TEXT), en **174 de 233** (74,7 %). También `Last UTM Content (Anuncio)` en 85 de 233, `Last UTM Source` en 178 de 233, `Last Campaign ID` en 79 de 233, `Last FB ClickId` en 39 de 233.

**3 · Las UTM first-touch y last-touch (§9.6).** Dentro de `atribucion_primera`: `utmSource` 224 de 233, `utmMedium` 222, `utmContent` 220, `utmTerm` 39, `campaignId` 217, `fbclid` 42, `fbc`/`fbp` 49, `gaClientId` 33. Dentro de `atribucion_ultima`: `sessionSource` 233 de 233, `url` 173, `medium` 166, `utmSource` 89, `campaign` 83, `adId` 59. **Las dos atribuciones —primer toque y último toque— están completas y sólo se lee la primera.**

**4 · El ICP score (§10.5 «ICP score», §10.7 «show rate por ICP»).** Campo del CRM `Puntaje | ICP` (`9HXxl5DW6aayQgKUPiOS`, NUMERICAL) poblado en **229 de los 233** contactos de la ventana (**98,3 %**), con valores continuos de 0 a ~100 bien repartidos (0 ×20, 20 ×13, 45 ×9, 26 ×8, 33 ×8, 48 ×6, 54 ×6, 58 ×6, 23 ×6, …). Es la cobertura más alta de todo lo que revisé, y el departamento no la toca. Con ella se puede cortar hoy **el booking rate por tramo de ICP** y, cuando haya asistencia, el show rate por ICP. **Aviso de los dos ceros:** 20 contactos traen el valor `"0"`, que puede ser «puntuó cero» o «se creó el campo y nadie lo llenó». Antes de publicar un tramo hay que decidir qué es ese 0, y no adivinarlo. Los otros campos de la familia están vacíos en la ventana: `perfil_icp` 0 de 233, `Pre-Score | ICP` 0 de 233, `Pre-Score | Meta Lead Ads` 0 de 233 (23 de 584 en total) — así que **el «segmento ICP» del §10.5 no está; el score sí**.

**5 · La zona horaria del contacto (§9.6, §10.5).** `contactos.zona_horaria_del_lead` en 304 de 584; en la ventana, 128 de los 228 contactos escritos (56 %). Ya se usa para el aviso de fuera de horario y **para nada más**: habilita cortar cualquier tasa por zona, y el §10.7 pide «show rate según anticipación» que necesita horas locales.

**6 · Quién escribió cada mensaje saliente.** `mensajes.autor_ghl_usuario_id` y `organizaciones_credenciales.crm_agente_usuario_id = '0peGoq7VvFqnDGA7gxtX'` coinciden. En la ventana, de 1 184 mensajes salientes: **368 son del agente de IA (31,1 %)**, 623 no traen autor (52,6 %) y 193 son de otro usuario (16,3 %). Por contacto: 67 de 233 recibieron al menos un mensaje del agente, 164 al menos uno sin autor y 34 al menos uno de otra persona. **La nota de la pantalla que dice «todavía no se distingue un mensaje del agente de uno de un flujo del CRM» (`PanelDeConversation.jsx:357-359`) es demasiado pesimista**: se distingue en un tercio de los mensajes. Lo que es cierto es que una tasa de respuesta AL AGENTE hoy se calcularía sobre 67 de 227 contactos, y hay que decirlo así, no decir que no se puede.

**7 · El campo del formulario de la landing (§9.5, §9.7 form start/completion rate).** `Form Landing VSL`, 247 de 584 contactos, con vocabulario `Agendado` 121 / `Form incompleto sin agendar` 87 / `Form completo sin agendar` 39. **Dejó de escribirse el 2026-08-31 00:57 UTC** y está en 0 de los 233 de la ventana. Ver el bloque de riesgos.

**8 · El estado del envío del mensaje.** `mensajes.estado_entrega`, `estado_entrega_familia`, `fallo_del_canal`, `estado_entrega_el` existen; `fuente` (`workflow` 157, `app` 56, `api` 10 de 4 415 salientes) permite separar automatización de conversación en el 5 % de los mensajes. Es la materia prima de la «tasa de errores» del §9.7 y del §10.7, hoy sin dibujar.

**9 · El clic al precall.** `Clic a Video Pre-Call` en 20 contactos, los 20 con valor `Si`; de ésos, **9 tienen `Video Pre-Call` todavía en `Sin abrir (0%)`** y 3 en `Nada`. Es evidencia directa de que el medidor del video no reporta lo que el medidor del clic sí vio, y es la razón por la que la tarjeta se rotula «Registró reproducción» y no «Vio el video» (`PanelDeConversation.jsx:440-447`).

---

## 5 · Datos que faltan, y de dónde tendrían que venir

── **Falta en el CRM (GoHighLevel): hay que pedirle a alguien que lo configure** ──

**1 · El trigger link del §9.5 — enlace enviado y enlace abierto.** No existe en ninguna forma: busqué las 170 filas de `negocio.campos_del_crm` por `%trigger%`, `%clic%`, `%click%`, `%abri%`, `%visit%`, `%session%` y el único acierto es `Clic a Video Pre-Call`, que es del video, no de la landing. No es un campo que se agregue: es un redirector con un token por contacto, un sistema aparte. **Sin él, cuatro de los ocho KPIs del §9.7 —link sent rate, link open rate, landing visit rate y tiempo hasta el envío del enlace— no tienen de dónde salir.** Y el §16.2 lo pone como su prueba 4.

**2 · `Form Landing VSL` volvió a apagarse.** No es un dato que falte: es un dato que se dejó de escribir. Último contacto con el campo: **2026-08-31 00:57 UTC**. 243 de 295 en agosto, **0 de 236 en septiembre**. Es una automatización del CRM, no nuestra. Restaurarla devuelve el form start rate y el form completion rate del §9.7 en el día, con el vocabulario ya definido.

**3 · El tracking individual del VSL (§10.5, §10.7 «show rate según consumo del VSL», §16.2 prueba 5) se escribió y midió cero.** Existen `VSL % máximo visto` (`qOTfHR3dfX6fqO4M0nvI`, NUMERICAL) y `VSL segundos vistos` (`JZNURcXun6AHF74dsyBe`, TEXT), poblados en **79 de 584 contactos** — y **los 79 traen `0` en los dos campos**. Ésta es la distinción de los dos ceros en su forma más cara: no es «no hay dato», es «el dato dice cero, 79 veces seguidas», lo cual no describe a 79 personas que no vieron nada sino a un medidor que nunca reportó. Último escrito: 2026-08-30 23:52 UTC, o sea que además se apagó el mismo fin de semana que el formulario. **La prueba 5 del §16.2 se puede dar por FALLADA con evidencia, no por pendiente.**

**4 · La fecha del consumo del precall (§10.6).** El valor está (213 de 584, 81 de 233 en la ventana) pero no hay cuándo, ni en `campos_del_crm` —que sólo guarda tipo, carpeta y `visto_el`, que es de nuestro catálogo— ni en ningún campo con fecha. Sin ella, un `76–100%` no se distingue de un valor que el CRM escribió al agendar: evidencia de que escribe al agendar, las 13 citas futuras del momento de la medición ya tenían el campo puesto, 11 en «sin reproducción».

**5 · La asistencia según el calendario.** `estado_ghl='showed'` en **0 de 317** citas y `'noshow'` en **3 de 317**. El §10.3 pone el show rate como KPI PRINCIPAL de Appointment Flow y hoy **no se puede calcular por ninguna de las dos vías**: ni por el calendario (0 de 317) ni por el reporte del closer (`citas.asistio` en **0 de 317**, la migración `049` es reciente y una migración no puede rellenar hacia atrás). Con eso caen también los seis cortes del §10.7 que cuelgan del show rate: por ICP, por anuncio, por closer, según anticipación, según VSL y según precall.

**6 · El segmento ICP (§10.5).** `perfil_icp`, `Pre-Score | ICP` y `Lead Score` están en **0 de 233** en la ventana. El puntaje numérico sí está (229 de 233), así que el segmento se podría derivar por tramos — pero eso sería una decisión de negocio nuestra, no un dato del CRM, y hay que tomarla explícitamente.

── **Falta en Meta: no hay ninguna conexión** ──

**7 · Nada del §18 llega acá.** Lo que Conversation necesita de Meta es sólo el nombre legible del anuncio y del ad set para rotular sus cortes; el `adId` ya lo trae GoHighLevel en la atribución (176 de 233). O sea que **el corte por anuncio no depende de conectar Meta**: depende de leer una clave que ya está guardada. Ésta es la misma trampa que ya costó tres veces en este proyecto —`meta_ad_id`, las UTM y el porcentaje de video visto—, y es la cuarta vez que aparece.

── **Falta en la landing: no hay instrumentación** ──

**8 · `visitor_id` y `session_id` (§16.2, pruebas 2 y 3).** No existe ninguna columna ni campo con esos nombres ni con esa forma. Lo más cercano es `atribucion_primera->>'url'` (55 de 233 en la ventana) y `Last Landing URL` (99 de 233), que son URLs de atribución, no sesiones. **La cadena Anuncio → Landing → Sesión → VSL del §16.2 está cortada en «Sesión»**, y con el VSL midiendo cero, dos eslabones seguidos.

── **Falta como registro propio nuestro: son tablas que hay que construir** ──

**9 · Tres de los dieciséis campos del §11.7 no existen en ningún lado.** Cotejé la lista contra `negocio.analisis_del_agente` (23 columnas) y `negocio.hallazgos` (18): están `module` (→ `agente`), `sentiment` (→ `sentimiento`), `issue_detected` (→ las filas de `hallazgos`), `error_category` (→ `categoria`), `severity` (→ `severidad`), `evidence` (→ `evidencia`, `evidencia_agente`, `evidencia_contacto`), `recommended_fix` (→ `correccion`), `prompt_version` (→ `prompt_hash`, 16 caracteres del sha256 del texto), `analysis_date` (→ `analizado_el`) y `conversation_id` a medias (→ `contacto_id`: no hay entidad «conversación», la conversación es el hilo del contacto). **Faltan `issue_source`, `effectiveness_score` y `confidence`** — verificado con `grep` sobre `lib/`, `components/` y `app/`: ni el vocabulario del §11.4 (`agent_execution`, `prompt_design`, `missing_tool`, `missing_data`, `workflow_configuration`, `external_failure`) ni las palabras `effectiveness` ni `confidence` aparecen en una sola línea. **Y `issue_source` es el que más duele**, porque es exactamente la pregunta del §11.3: hoy el sistema detecta el fallo pero no dice si la culpa fue del agente, del prompt, de una herramienta que no tiene o de un dato que le faltaba. También falta `agent_type` (texto/voz), que hoy está implícito en el prefijo `chat_` porque los dos de voz no existen, y `objective`.

**10 · Las dos evaluaciones separadas del §11.3.** Hay una sola: el auditor juzga el cumplimiento del agente. La calidad del prompt no se evalúa — y no podría, porque los prompts no están cargados.

**11 · El prompt y su versión (§11.2, §11.8).** `negocio.prompts_del_agente`: **0 filas**. `negocio.versiones_del_prompt`: **0 filas**. La maquinaria de versionado existe entera —la migración `046` crea el archivo de versiones con `vigente_desde`, `reemplazada_el`, `puesta_por`, `sacada_por` y `que_siguio in ('otra_version','nada')`— y nunca se usó. Así que el §11.2 le exige al supervisor «prompt completo activo» y «versión del prompt» y hoy no recibe ninguno de los dos: audita a ciegas sobre qué se le pidió al agente. Además el propio panel avisa que ese prompt sería «de referencia: **no** es el prompt que corre en el CRM» (`PanelDeAuditoria.jsx:448`), así que ni cargándolo se cierra el §11.2 del todo.

**12 · El §14 entero.** No hay tabla de cambios, hipótesis, línea base, periodo de medición, variables externas ni los ocho estados. Lo único cercano es `hallazgos.resuelto_el`/`resuelto_por`, nulo en los 20 abiertos.

**13 · El §13, los cinco roles.** Hoy la pantalla se abre con `tablero.ver` y las pestañas del supervisor exigen `auditor.ver` en el servidor (`app/api/auditoria/route.ts:70`). No hay «responsable de Lead Flow» ni «responsable de Appointment Flow» como roles distintos, ni tareas con fecha límite y estado.

**14 · El §12, las recomendaciones locales.** Hay correcciones por patrón (`hallazgos.correccion`, `fragmento_prompt`, `prompt_seccion`), que es la forma que el §12 pide para «ajustar un prompt». No hay un canal hacia Executive: lo que Executive muestra de Conversation es inventado (ver `hardcodeado`).

**15 · El agente de voz completo.** `negocio.llamadas`: **0 filas**, y sus diez columnas no incluyen transcripción. Con eso caen el §9.4 «agente de voz», el §10.4 «agente de voz» y el §16.1, que da la voz por existente.

**16 · El histórico.** Ninguna cifra de este departamento puede mirar más de 14 días sin mentir: `citas.reservada_el` está en 0 de las 87 citas anteriores al 2026-08-24 y el barrido tiene `DIAS_ATRAS = 14` (`lib/negocio/citas.ts:74`), así que no vuelve. Sin línea base no hay «+3 pts», no hay §14 y no hay nada del §16.2 prueba 8 salvo la tabla vacía.

---

## 6 · Reglas propias de este departamento

── **Los dos vocabularios del supervisor NO se pueden mezclar** ──

`lib/auditor/veredicto.ts` declara **dos rúbricas distintas de siete criterios cada una, y sólo comparten uno**. Post-agenda (`:97-113`): `frustracion_no_manejada`, `abandono_de_conversacion`, `promesa_incorrecta`, `no_es_lo_que_busca`, `insiste_sin_entender`, `fuera_de_alcance_sin_salida`, `dato_faltante`. Pre-agenda (`:134-150`): `calificacion_saltada`, `presiono_a_quien_no_califica`, `sin_salida_alternativa`, … y `dato_faltante`, el único compartido. El archivo lo dice con la razón: «abandonó la conversación» en post-agenda es dejar colgada una cita; en pre-agenda el contacto todavía no agendó, y el daño caro no es perder a quien iba a comprar sino **agendar a quien no puede comprar**. Auditar pre-agenda con la rúbrica de post-agenda «no da un resultado peor: da uno convincente y falso, y encima gastando». Cualquier cifra que agregue los dos agentes en un promedio rompe esto.

── **El nivel se DERIVA, no se le cree al modelo** ──

`nivelDerivado` (`veredicto.ts:259`): sin auditar → `null`; con intervención → `rojo` (es la definición); con hallazgos → `amarillo`; sin hallazgos → `verde`, salvo que el modelo pida amarillo. La base tiene `rojo ⟺ pide intervención` como restricción de tabla, así que un modelo que devuelva «amarillo» con intervención tumbaría la escritura entera **con la inferencia ya pagada**. Derivar convierte un error del modelo en una fila correcta.

── **Los pisos y las ventanas, y de qué defecto sale cada número** ──

**`PISO_DE_UNA_TASA = 10`** (`indicadoresDeCitas.ts:272`): por debajo de diez eventos en el DENOMINADOR **no se publica un porcentaje**, se publica el conteo. El número sale de un defecto ya pagado: el no-show medía 2 eventos en 14 días, y una tasa sobre dos eventos se mueve cincuenta puntos con el próximo registro; con diez se mueve diez, que sigue siendo mucho pero ya no es absurdo. Hoy lo aplican seis cifras: tasa de asistencia (0 respuestas → «—»), tasa de confirmación (62 ≥ 10 → 75,8 %), tasa de descartados (75 ≥ 10 → 92,0 %), precall binario (42 ≥ 10 → 21,4 %), precall fino (6 y 3 → oculto), sentimiento (11 ≥ 10 → 27,3 %) y las filas de atribución (8 y 6 → «Otras»). **El piso es del denominador, no del total**: con 75 citas y 3 respuestas la muestra son 3, y quien contesta esas tres no es una muestra al azar de las 75.

**`DIAS_DE_LA_TASA = 14`** (`indicadoresDeCitas.ts:282`): catorce y no treinta, porque la ventana trasera del barrido son catorce días (`citas.ts:74`). **«Una ventana más vieja no es una muestra más grande»**: cuanto más atrás mira una cifra, mayor es la proporción de citas congeladas. La evidencia: la tasa de cancelación subía hacia el presente —61,9 % a 7 días, 60,1 % a 14, 52,9 % a 30, 50,6 % en total— y eso parecía una tendencia. No lo era: las 101 citas congeladas cancelan al 30,7 % contra 60,3 % de las alcanzables.

── **La cohorte de Lead Flow: por `alta_en_el_crm`, sin filtro de territorio** ──

Dos decisiones, las dos con su precio medido. **Por `alta_en_el_crm` y no por `creado_el`** (`indicadoresDelLead.ts:120`), porque `creado_el` es cuándo lo vio nuestro barrido: la carga inicial del 2026-08-24 marcó 239 contactos con la misma fecha, y el día que la ventana de 14 días la tocara, la cohorte saltaría de 260 a 499 de golpe sin que entrara un solo lead. **Y sin filtro de territorio**, porque el territorio es consecuencia de agendar: sobre `territorio='setter'` el booking rate daba 2 de 280, que es una tautología. El precio se dice en voz alta: la tasa de respuesta baja de 68,1 % a 60,9 % porque la cohorte deja de excluir a quienes agendaron, y entre ellos hay 59 que agendaron **sin escribirnos nunca**. **Una sola cohorte para las cuatro cifras**, para que «61,2 % contesta» y «52,8 % agenda» se puedan cruzar.

── **Las tres exclusiones de Appointment Flow, y ninguna se suma en silencio** ──

**1 · Las congeladas**, `ghl_calendario_id is null`: anteriores a la migración `038`, el CRM ya no devuelve sus eventos. 12 en la ventana, 87 en total. Se declaran en el aviso. **2 · Las de contactos descartados**: `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`) = `icp_rechazado`, `rechazado`, `rechazado_positivo`, `rechazado_negativo`, `no calificado`, `descalificado`, comparadas **en minúscula sobre `unnest`** porque GoHighLevel no garantiza la caja. Cancelan al 92,0 % porque las cancela el flujo de descarte de la casa, no el lead; sumarlas le atribuye al negocio el trabajo de su propio filtro y publicaba 62,7 % donde el negocio tiene 33,3 %. **3 · Las futuras**, `inicio_el < now()`, **sólo para la cancelación y el precall, NO para el booking rate**: agendar es el evento, y que la cita no haya ocurrido no lo deshace; copiarlo al booking rate borraría a los que ya agendaron para los próximos días y lo bajaría de 52,8 % a ~48,7 %.

── **El vocabulario del precall: dos regímenes y una cuarta categoría** ──

`RAMA` (`consumoDelPrecall.ts:94-102`) manda `Sin abrir (0%)` y `Nada` a la MISMA rama, y no es prolijidad: `Sin abrir (0%)` deja de escribirse de golpe el 2026-09-08 y `Nada` ocupa su lugar sin transición. **Es el mismo valor renombrado**; a ramas distintas, cualquier serie temporal mostraría un derrumbe fantasma ese martes. Tres valores quedan **sin rama a propósito** (7 contactos en la ventana, más que los 3 que completaron): `-20%` puede ser «menos de 20 %» o un error de carga; `Clic a link` describe un clic, no consumo; y **`Accede: sin reproducir` es una CUARTA categoría que el §10.6 no tiene** —«lo abrió y no lo vio»— que para un closer es información distinta de «lo ignoró». Y hay **dos escalas incompatibles conviviendo**: `1–25%` con guion largo (U+2013) y `40-60%` con guion corto. Como rama caen las dos en «parcial», pero **ninguna se puede convertir a número ni promediar con la otra**, y por eso este módulo devuelve ramas y nunca un porcentaje medio de visionado.

── **El denominador del sentimiento: tres poblaciones se ven iguales en esa columna** ──

`analisis_del_agente.sentimiento` es `null` por tres motivos distintos, censo hoy: auditable con disparo ≠ mejora → **20 filas**, las únicas que producen sentimiento; auditable con `disparo = 'mejora'` → **14 filas**, donde el carril de mejora escribe `null` a propósito; y no auditable → **12 filas**, donde nunca se llamó al modelo. Sobre las 46 la distribución diría «43 % sin dato», que sería una afirmación sobre las conversaciones y en realidad es una sobre los carriles del propio auditor. Por eso el denominador son las auditables no-mejora **y viaja al lado**. Un cuarto caso —que el modelo conteste fuera del vocabulario `positivo|neutral|molesto`— se cuenta aparte y hoy es cero: ése sí sería un defecto.

── **El sentimiento es de la CONVERSACIÓN, nunca de la persona** ──

La fila es por `(contacto, agente, analizado_el)`, el transcript puede llegar recortado a las últimas 40 líneas, y el antirrebote garantiza re-auditorías: hay 3 contactos con dos análisis y en dos de ellos el sentimiento difiere. **Consecuencia operativa: se rotula «así estaban las conversaciones juzgadas», nunca como insignia junto al nombre de alguien** — eso convertiría un tramo de chat en un atributo permanente de una persona.

── **Se publica el MOLESTO y no el positivo** ──

`sentimiento.ts:57-64`: es el único accionable. Un contacto molesto es una conversación que alguien tiene que mirar; un positivo no pide nada. Con tres barras, la que decide qué hacer se pierde entre dos que no.

── **La regla del silencio** ──

Un `aviso` es `null` cuando no hay nada que advertir, y entonces la pantalla **no dibuja nada**. Una fracción de cobertura puesta siempre —«184 de 316»— sería una advertencia permanente encima de una cifra correcta, y un aviso que aparece siempre se aprende a ignorar. Por eso `avisoDeAsistencia` y `avisoDeConfirmacion` son **campos propios y no parte de `aviso`**: la asistencia va a estar bajo el piso durante semanas y compartir el renglón apagaría por costumbre el de las citas congeladas, que sí es excepcional.

── **Los dos ceros, escritos como regla** ──

`null` se dibuja como «—» y **nunca como 0 %**. Un 0 % con cero citas afirma «no se cancela ninguna»; un 0 % de asistencia afirma «no viene nadie». La regla aparece seis veces: `tasa`, `tasaDeAsistencia`, `tasaDeConfirmacion`, `horasHastaLaCita`, las latencias y las filas de atribución sin piso. Y del lado contrario, el no-show se publica como **conteo** justamente para no fabricar una tasa.

── **Los campos del CRM se resuelven POR NOMBRE, nunca por identificador a mano** ──

`campoPorNombre` contra `negocio.campos_del_crm`. Si el nombre no está, la cifra devuelve `null` **con un aviso que manda a mirar el CRM** y no un cero: «puede ser que esta empresa no mande precall, o que alguien lo haya renombrado — los dos casos mandan a mirar lugares distintos, y un hueco mudo los confunde».

── **Los contadores cuentan auditables; la lista muestra todo** ──

La única asimetría del supervisor, y está justificada: meter las no auditables en los contadores haría que el porcentaje de verdes bajara cada vez que entra una conversación de dos mensajes, y el técnico leería «el agente empeoró» sobre un agente que no cambió. La lista sí las incluye, con su motivo, porque si no «no se auditó» y «no existe» vuelven a verse iguales.

── **El patrón agrupa en el cliente, y la severidad del patrón es la del PEOR caso** ──

`agruparPorPatron` (`vista.ts:90-122`): el contador **es** `casos.length`, no un número que viaja al lado, así que no puede discrepar de lo que se ve. El orden es por cantidad y no por fecha, porque ordenando por fecha el problema que ocurre quince veces queda mezclado entre los que ocurrieron una. Y **un patrón con catorce amarillos y un rojo es un patrón rojo**.

── **Los portones, del más barato al más caro: «un portón de menos no falla, sólo factura»** ──

Seis, en orden: la empresa (tres motivos, cero consultas) → territorio → agente atendiendo → ya está marcado → el antirrebote → hay líneas DEL AGENTE. El **4** cuenta `mensajes.autor = 'agente'`, que es barato **y miente** (la ingesta marca así todo saliente que no sea de la app); el **5** cuenta lo que la regla de atribución le imputa al agente de IA, y exige el identificador del agente en el CRM. Cinco plantillas de un flujo del CRM pasan el 4 y no el 5. El antirrebote **resta** (`cuántos hay ahora − cuántos había en el último análisis`) en vez de llevar un contador, para que una carga de históricos mueva las dos puntas juntas.

── **El carril de mejora tiene criterio y tope propios** ──

`CRITERIO_DE_LA_MEJORA = 'contexto_no_leido'` y `DISPARO_DE_LA_MEJORA = 'mejora'` (`lib/auditor/mejora.ts:51`, `:55`), una por día y por empresa, en frío, sin interrumpir a nadie. El tope se cuenta **por criterio y no por severidad**, porque el carril rojo también produce amarillos y contarlos bloquearía este carril con trabajo ajeno — le pasó al origen. Existe por una medición: el carril rojo dispara 2 de 40 auditables (5 %), y el agente de pre-agenda **no llega nunca al antirrebote** (entre 0 y 3 mensajes por contacto contra un umbral de 5), así que sin este carril la pantalla del técnico nace vacía.

── **El hash del prompt se recalcula del texto, nunca se lee de la columna** ──

`hashDelPrompt` (`prompts.ts:66`). Decide una cosa concreta —«el prompt cambió desde que se escribió este hallazgo»— y leerlo de la columna tiene el modo de fallo que no se nota: una escritura futura que se olvide de actualizarla deja **todos los hallazgos viejos pasando por vigentes para siempre**, sin error y con la pantalla mostrando correcciones que ya no aplican.

── **Los nombres que se ven son los del CRM, no los internos** ──

`chat_pre_agenda` → **LeadFlow · Zona Setter**; `chat_post_agenda` → **AppFlow · Zona Closer** (`vista.ts:141-159`). El mapeo no se adivina: sale de las etiquetas `bot_activado_leadflow` y `bot_activado_appflow` de `lib/ghl/contrato.ts`. Y la lista sale de `AGENTES`, no escrita a mano, porque un agente nuevo escrito a mano «no aparecería en esta pantalla sin que nada falle». Está prohibido nombrar un agente a mano en una ruta, con un motivo caro: en la plataforma anterior la base aceptaba cuatro agentes y el código validaba contra una lista de dos, y los patrones de voz **no se podían cerrar ni medir su reincidencia**.

── **No se nombra al proveedor en texto que se pinta** ──

`pruebas/codigo/91-closer-y-setter.test.ts` lo prohíbe en el Closer «porque lo van a ver clientes»; la excusa que excluía a esta pantalla —que no tenía datos reales— dejó de aplicar con la mudanza.

---

## 7 · Riesgos

── **1 · El riesgo más caro ya está ocurriendo: Executive publica cifras inventadas EN NOMBRE de este departamento** ──

Mientras esta pantalla mide 21 cifras con su denominador y su piso, `lib/aios/executive.js:190-193` dibuja «58 % de efectividad en Lead Flow · +3 pts» y «El agente de voz no reconfirma día y hora en **14 de 22 llamadas**», y `lib/aios/executive.js:16-20` alimenta el paso «Conversaciones» del embudo con 41/268/1072/2787/6840. Los tres módulos (`initExecutive`, `initExecutivePanel`, `initExecutiveChat`) están vivos en `lib/aios/index.js`. **La aplicación afirma dos cosas distintas sobre el mismo departamento en dos pantallas**, y la inventada es la que ve la gerencia. Peor: el hallazgo de voz habla de 22 llamadas de un agente cuya tabla `negocio.llamadas` tiene **0 filas**. Es exactamente el defecto que el borrado de `lib/aios/conversation.js` vino a arreglar, con el mismo texto, mudado de archivo.

── **2 · Declarar que un dato «no existe» sin comprobarlo contra la base, cuarta vez** ──

El renglón `FLUJOS.leadflow.falta[0]` afirma que el formulario «no se registra en ninguna parte» y **`Form Landing VSL` tiene 247 de 584 contactos con el vocabulario exacto que el §9.5 pide**. Es la cuarta repetición del mismo error después de `meta_ad_id`, las UTM y el porcentaje de video visto. El daño no es la frase: es que **manda a construir un trigger link cuando lo que hay que hacer es volver a encender una automatización que se apagó el 2026-08-31**. Y el mismo renglón ya tiene un hermano falso resuelto tres líneas más abajo (`PanelDeConversation.jsx:116-124`), o sea que el patrón está documentado en el propio archivo y volvió a pasar. **Regla para quien siga: antes de escribir una falta nueva, censar `negocio.campos_del_crm` por nombre y contar coberturas por ventana, no sólo `grep` sobre nuestro código.**

── **3 · Confundir «se dejó de escribir» con «no existe»** ──

Tres datos se apagaron el mismo fin de semana y hay que decirlo como apagón, no como ausencia: `VSL segundos vistos` y `VSL % máximo visto` el 2026-08-30 23:52, `Form Landing VSL` el 2026-08-31 00:57. Las dos lecturas mandan a hacer cosas opuestas: «no existe» manda a construir instrumentación; «se apagó» manda a preguntarle a quien tocó el CRM ese sábado. Una cifra que se reactive sola cuando el campo vuelva **saltará de 0 a su valor real de golpe** y se leerá como una mejora del negocio.

── **4 · Los tres ceros del VSL, y por qué el aviso tiene que decir cuál es** ──

`VSL % máximo visto` está poblado en 79 contactos **y los 79 dicen `0`**. Si alguien construye el «show rate según consumo del VSL» del §10.7 sobre eso, va a publicar que **el 100 % de los leads no ve nada del VSL** — una afirmación devastadora sobre el creativo, construida sobre un medidor roto. Lo mismo, más chico, con el ICP: 20 de los 229 puntajes son `"0"`, y publicar un tramo «ICP 0» sin decidir antes si es «puntuó cero» o «nadie lo llenó» mete a esos 20 en el peor cubo de la tabla sin evidencia.

── **5 · El show rate, KPI PRINCIPAL del §10.3, no tiene ninguna vía abierta** ──

Ni el calendario (`showed` 0 de 317, `noshow` 3 de 317) ni el reporte del closer (`citas.asistio` **0 de 317**). Cualquiera que arme una tasa sin `asistio is not null` en el DENOMINADOR va a contar como plantón toda cita que nadie cerró todavía y anunciar que no viene nadie: sería una cifra plausible, alarmante y falsa. El módulo ya lo tiene resuelto (`indicadoresDeCitas.ts:332-346`), pero la trampa reaparece en cada corte nuevo del §10.7.

── **6 · Las dos ventanas conviven en la misma pantalla y nadie lo dice** ──

Las 26 cifras de las dos primeras pestañas miran **14 días**; las tarjetas de la pestaña Auditoría cuentan **toda la historia** (`pantalla.ts:196-239`: no hay `where` de fecha). Quien lea «16 verdes / 16 amarillos / 2 rojos» al lado de «27,3 % molestos en 14 días» va a suponer que hablan del mismo período. No lo hacen, y ninguna etiqueta lo aclara.

── **7 · El sentimiento va a cruzar el piso hacia abajo solo, y se va a leer como una avería** ──

El auditor produce ~1,3 veredictos por día y el pico fue la siembra del 2026-09-01 con 10. Hoy el denominador es 11, apenas encima del piso de 10. **Cuando ese día salga de la ventana, `molestos` pasa de 27,3 % a `null`** y la tarjeta se vuelve un guion sin que cambie nada del negocio. El aviso lo contempla (`sentimiento.ts:158-164`), pero cualquier gráfico o reporte que copie el 27,3 % hoy va a ver un agujero mañana.

── **8 · El supervisor audita sin saber qué se le pidió al agente** ──

`negocio.prompts_del_agente`: 0 filas. `negocio.versiones_del_prompt`: 0 filas. El §11.2 dice literalmente que sin el prompt activo y su versión el supervisor **no puede distinguir error de ejecución de error de diseño** — y hoy no los recibe. Lo que produce es la primera de las dos evaluaciones del §11.3, no las dos; y `elPromptCambio` (`pantalla.ts`) no se enciende nunca porque no hay prompt de hoy contra el que comparar. Cualquier conclusión del tipo «el agente falla» que salga de estos 20 hallazgos está midiendo ejecución sin controlar diseño.

── **9 · El vocabulario del CRM se mueve, y la única alarma es un contador** ──

`noshow` apareció por primera vez el 2026-09-08. `Sin abrir (0%)` se renombró a `Nada` el mismo día. `negocio.campos_del_crm` **no guarda las opciones declaradas de un campo**, así que el día que el RADIO del precall reciba un valor nuevo, la única señal va a ser `sinRama` subiendo — y el aviso va a seguir nombrando los mismos tres valores viejos (`consumoDelPrecall.ts:274-275`). El censo está verificado completo hoy 2026-09-15 (10 valores, los mismos 10 del comentario fechado el 2026-09-14), pero eso es una foto.

── **10 · Una tasa por debajo del piso publicada en cualquier lado revienta el negocio** ──

Está medido lo que pasa: por fuente, «Direct traffic» agenda 7 de 8 (87,5 %) y «Social media» 4 de 6 (66,7 %), contra Paid Social 112 de 219 (51,1 %). Dibujadas como barras al lado dicen que **lo pago es lo que peor convierte** — una conclusión cara construida sobre catorce contactos, donde un lead más mueve «Direct traffic» diez puntos. Lo mismo por campaña: «Nueva Era | Bofu | Agendas» agenda 34 de 39 (87,2 %), y comparada con «NUEVA ERA | TOFU | LEADS» (74 de 171, 43,3 %) parece cuatro veces mejor cuando lo que dice es que una campaña de fondo de embudo agenda más que una de arriba. **La fila «Otras» sin tasa es lo que impide esto, y cualquier exportación que la aplane vuelve a abrirlo.**

── **11 · La agrupación de campañas es en minúscula, y desagruparla parte una campaña en dos** ──

En la ventana hay 7 valores de campaña crudos y 6 normalizados: la misma campaña está escrita de dos formas, una con 32 contactos y otra con 8. Sin `lower()`, los 8 caen bajo el piso y se van a «Otras» aunque su campaña real tenga 40. Además hay un valor **`{{campaign.name}}`** sin expandir en 2 contactos: hoy queda bajo el piso y no se ve, pero el día que sean 10 va a aparecer como si fuera el nombre de una campaña.

── **12 · El conteo de intentos es de la CONVERSACIÓN, no del agente** ──

La tasa de respuesta mide si el contacto contestó, no si contestó al agente. Está declarado en pantalla, pero el dato para afinarlo ya existe en el 31 % de los mensajes (`autor_ghl_usuario_id` = `0peGoq7VvFqnDGA7gxtX` en 368 de 1 184 salientes de la ventana). El riesgo tiene dos filos: publicar la cifra gruesa como «rendimiento del agente» es falso; y publicar la fina sobre 67 de 227 contactos sin decir el denominador también.

── **13 · El censurado de las latencias** ──

Los 88 contactos escritos que todavía no contestaron **no tienen latencia infinita ni cero**: son observaciones incompletas, y meterlos como cualquiera de las dos convierte la mediana en una función de cuándo se abre la pantalla. Y el sesgo va en una dirección concreta y medida: **los que nunca contestan reciben más intentos** (mediana 3 contra 1), así que el grupo que falta no es una muestra al azar del que está. Cualquier promedio de latencia calculado fuera de este módulo va a caer acá.

── **14 · La guarda `>= 0` de las latencias no tiene ejercicio hoy y lo va a tener** ──

En la ventana de 14 días hay **cero** filas con primer saliente anterior al alta; fuera de ella hay **una de −103,9 días**. El día que alguien ensanche la ventana —un número que parece inofensivo— esa sola fila arrastra el resultado, y lo que sale sigue pareciendo razonable.

── **15 · Once de las doce empresas activas verían esta pantalla vacía** ──

4 de 12 tienen llave de IA, **1 tiene el identificador del agente** y **1 tiene token de CRM**. El freno `noAudita` lo dice bien en las tres pestañas desde el commit `a0e1eb5`. Pero las cifras de Lead Flow y Appointment Flow **no dependen del auditor**: se leen de `negocio.*`, y en las once empresas sin token esas tablas están vacías, así que las 26 cifras van a dibujar ceros, guiones y avisos de «no hay nada que medir». **Esta pantalla es real para una empresa, y el informe no debe leerse como que el departamento funciona para la flota.**
