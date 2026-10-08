# Setter y Closer

> Corte: **2026-09-28**. Las cifras de producción se midieron ese día a partir de las 18:03 UTC; las
> de la ficha (§ 2.5) y la re-medición de las ventanas que ruedan (§ 5.6), entre las 23:58 UTC del 28
> y las 00:02 UTC del 29 (19:02 del 28 en Lima). Todas con consultas de sólo lectura y sólo agregados,
> sobre la organización `aria` —las otras doce de la base tienen cero contactos y cero citas—. Cada
> afirmación lleva su archivo:línea o la consulta que la produjo. Lo que no se pudo verificar está
> dicho como pendiente, no omitido. Una verificación posterior (00:15 a 00:25 UTC del 29) re-midió
> las cifras principales; donde el reloj ya las había movido, van las dos horas.
>
> Archivo nuevo. La foto del 2026-09-15 no tenía informe de estas dos pestañas: las nombraba de paso
> en [05-SALES.md](05-SALES.md) y [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md). Cuando una cifra de
> esos dos cambió, acá van las dos, cada una con su fecha.

**Construido — en producción desde el 2026-08-24, y sin un solo registro desde el 2026-09-09.**

Son las dos únicas pestañas del producto donde una persona escribe el hecho comercial, y el
instrumento está entero: Avanzar guarda resultado, etapa, nota, tarea, cita y asistencia en una sola
transacción. Producción tiene **7 resultados en toda su historia** —del 2026-08-30 al 2026-09-09—,
**0 ventas, 0 montos y 0 de 333 citas con la asistencia registrada** (medido el 2026-09-28). Los
siete son anteriores a la pregunta «¿se presentó?», que existe desde el 2026-09-14 21:49 UTC, y desde
entonces pasaron 15 citas que Avanzar podía cerrar (a las 18 h UTC del corte; 16 a las 23:58) sin que
se registrara ninguna. Eso es lo que deja el show rate de Conversation en «—» y los dos últimos
eslabones de la cadena de Sales en 4 y 0 sobre la base entera (3 y 0 en los 30 días con que abre).

---

## 1 · Qué pide el documento

El documento funcional (`CC_Arquitectura_Funcional.md`) **no está en disco**, ni en este repositorio
ni en los hermanos, así que lo que sigue sale del inventario que `docs/sales/` hizo de él, línea por
línea. Si tiene una sección propia de Setter o de Closer **no está verificado**; lo más cercano que
ese inventario registra es «Team Execution», que el encabezado declara pendiente de especificar
(`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:16`). Lo que sí le pide al closer es un dato, no una
pantalla:

- **§ 5.4**, «Registro actual de ventas»: la fuente de verdad comercial es un registro manual del
  closer, con dos preguntas —si compró y cuánto— y la advertencia de que son ventas reportadas, no
  pagos verificados (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:105-128`).
- **§ 5.3**: el perfil del lead lleva «Asistencia», «Resultado de venta» y «Monto reportado por el
  closer» (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:133-134`).
- **§ 10.3 y § 10.7**: el show rate y el show rate por closer, como KPI de Appointment Flow, o sea de
  Conversation (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:71`,
  `docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:80`).

La especificación de las pantallas vino del repositorio hermano `aria-project-closer-setter`, y se
nombra sin línea porque está fuera de éste: `docs/05-CLOSER.md` pide cuatro pestañas, un cockpit con
Ventas, Acuerdos, Calls del mes, **Show rate** y Comisión, y Avanzar como «el único registro de
resultados» con seis salidas; `docs/06-SETTER.md` describe el espejo pre-agenda y, en su tabla de
simetría, le asigna al closer una cola exclusiva: **«Registro pendiente (calls sin resultado)»**. Esa
cola no se construyó (§ 5.5).

---

## 2 · Qué hay hoy en pantalla

### 2.1 · La declaración, y las dos capacidades

Las dos pestañas están en el grupo «Operación», cada una con su capacidad de lectura propia:
`setter.ver` y `closer.ver` (`lib/autorizacion/secciones.ts:338-361`). Que un closer no vea la
pestaña del setter depende, en el diseño, de que no compartan capacidad; en producción los roles
dan las dos a todos, y lo que recorta es la lista de secciones (§ 2.4). Las **cuatro**
sub-pestañas del closer piden `closer.ver`, no una capacidad cada una, porque dos llamadas de la
misma pantalla con capacidades distintas dejan una parte vacía sin que se note
(`lib/autorizacion/secciones.ts:345-349`; la Agenda lo repite en
`app/api/closer/agenda/route.ts:57-60`).

La ficha del contacto y Avanzar no son de ninguna de las dos: se abren desde las dos pestañas, y
sólo desde ellas (§ 2.5). Las nueve rutas bajo `app/api/contactos/` —la ficha y sus cinco
pestañas, Avanzar, resolver una intervención y la sincronización de contactos— se declaran sin
pantalla y piden capacidades propias —`contactos.ver`, `contactos.avanzar`, `contactos.resolver`,
`contactos.comentar` (`lib/autorizacion/secciones.ts:561-601`)—; enviar desde el compositor del chat
pide `conversaciones.responder` y no `contactos.ver` (`app/api/contactos/[id]/mensajes/route.ts:102`).

### 2.2 · El Setter

`components/views/SetterView.jsx`, 355 líneas. Cuatro sub-pestañas en el mismo orden que el closer
—Inicio · Mi Día · Pipeline · Contactos (`components/views/SetterView.jsx:142-147`)— y seis colas en
Mi Día: urgentes, buzón, oportunidades chicas, estancadas, seguimientos de hoy y completadas
(`components/views/SetterView.jsx:87-119`). Cuatro rutas bajo `app/api/setter/`, las cuatro con
`setter.ver`: `mi-dia` (GET, trae colas, cockpit y las dos comisiones en una sola respuesta,
`app/api/setter/mi-dia/route.ts:44-70`), `pipeline` y `contactos` (GET) y `meta` (PATCH). La
respuesta de Mi Día declara `llamadasAlCrm: 0` (`app/api/setter/mi-dia/route.ts:87-90`).

### 2.3 · El Closer

`components/views/CloserView.jsx`, 404 líneas. Inicio · Mi Día · Pipeline · Agenda
(`components/views/CloserView.jsx:47-52`). Seis rutas bajo `app/api/closer/`, todas con `closer.ver`:
`mi-dia` (colas + cockpit + comisión, `app/api/closer/mi-dia/route.ts:50-135`), `agenda`, `pipeline`,
`meta` (PATCH), `agenda/refrescar` (POST, con `maxDuration = 300`,
`app/api/closer/agenda/refrescar/route.ts:50`) y `contactos`. **Esta última no la llama ninguna
pantalla**: la lista de contactos salió de Mi Día y el Closer no tiene sub-pestaña Contactos; un
`grep` de `closer/contactos` fuera de `app/api` sólo la encuentra en un comentario
(`components/negocio/ListaDeContactos.jsx:9`) y en tres pruebas.

**De quién son los leads** lo decide un solo módulo, y no es un permiso: `todo` para quien no es
closer o es closer sin vincular a un usuario del CRM, `mio` para el closer vinculado
(`lib/negocio/alcanceDelCloser.ts:25-38`). Quien administra puede mirar como uno de ellos, y el
servidor sólo lo atiende si el alcance propio es `todo` (`lib/negocio/alcanceDelCloser.ts:138-147`).

**Lo que cuesta mirarlas.** Leer las pantallas no llama al CRM
(`app/api/closer/mi-dia/route.ts:5`); lo que sí corre, con la pestaña a la vista, es un reloj de 10 s
que dispara la ingesta de mensajes y recarga las colas (`components/views/CloserView.jsx:173-186`,
`lib/cadencia.ts:40`). Los contactos entran solos cada diez minutos por el cron
(`lib/negocio/barrido.ts:202-206`).

### 2.4 · Quién ve qué, medido el 2026-09-28

Los **15 usuarios activos** tienen `closer.ver`, `setter.ver` y `contactos.avanzar` por su rol (9
administradores, 2 superadministradores, 4 de rol restringido). Lo que recorta las pestañas es la
lista de secciones de los cuatro restringidos: los cuatro tienen Closer y tres también Setter. Hay
**3 closers designados**, los tres vinculados al CRM (`negocio.closer_asignado`, 3 filas); dos tienen
rol restringido —uno de ellos ve también el Setter— y el tercero tiene un rol sin restricción.

La cartera del territorio closer se reparte así entre los tres, sin nombres: **210, 25 y 11
contactos, y 41 sin asignar** (de 287); las citas alcanzables, por el asignado de cada cita y con
las canceladas adentro, 125, 63 y 11, y 33 sin closer (de 232). La concentración ya estaba medida el
2026-09-01 —135 de 152 contactos apuntaban al usuario del CRM que la empresa usa como cuenta del
agente de IA (`components/closer/QuienEsElCloser.jsx:23-27`)—, y sigue igual: re-medido el
2026-09-29 a las 00:15 UTC, el grupo de 210 apunta al usuario que
`identidad.organizaciones_credenciales.crm_agente_usuario_id` declara como el del agente, y ese
mismo usuario del CRM es el vínculo de uno de los tres closers designados.

### 2.5 · La ficha del contacto

`components/negocio/Ficha.jsx`, 1.432 líneas, con sus lecturas en `lib/negocio/ficha.ts`, 740. Es un
panel lateral que se superpone y no navega, y un solo componente para toda la aplicación
(`components/negocio/Ficha.jsx:3-16`). Se abre desde seis lugares, todos de estas dos pestañas: Mi
Día, Pipeline y Agenda del closer (`components/closer/MiDia.jsx:440`,
`components/closer/Pipeline.jsx:313`, `components/closer/Agenda.jsx:554`), y el mismo Mi Día, el
mismo Pipeline y la lista de Contactos del setter (`components/views/SetterView.jsx:33-39`,
`components/negocio/ListaDeContactos.jsx:424`). **No se abre desde Conversation ni desde la
auditoría**, aunque tres comentarios digan que sí (`components/negocio/Ficha.jsx:13-14`,
`lib/autorizacion/secciones.ts:572-573`, `lib/autorizacion/secciones.ts:586-587`): ningún archivo
de `components/conversation/` ni de `components/auditoria/` la importa, y la lista de la auditoría
abre un patrón, no un contacto (`components/auditoria/PanelDeAuditoria.jsx:298`). Leads Portal tiene
su propia ficha, `components/leads-portal/FichaDelLead.jsx`, que es otro componente.

El encabezado es sólo estado, y su única acción es Avanzar (`components/negocio/Ficha.jsx:1076-1078`,
`components/negocio/Ficha.jsx:1197`): «Ver en GHL» y «Agendar» funcionaban y se quitaron para que el
trabajo no termine en el CRM (`components/negocio/Ficha.jsx:1056-1073`). Al abrirse pide
`GET /api/contactos/[id]` (`components/negocio/Ficha.jsx:578`) y cada pestaña pide su ruta cuando se
la abre (`components/negocio/Ficha.jsx:658`); sólo el Chat tiene reloj, las otras cuatro se piden una
vez y se quedan (`components/negocio/Ficha.jsx:31-35`). Las cinco pestañas, en su orden
(`components/negocio/Ficha.jsx:94-100`), con lo que hay en la base, medido el 2026-09-28 a las 23:58
UTC sobre toda la tabla:

| pestaña | qué muestra | de dónde lee | cuánto hay |
|---|---|---|---|
| Chat | los mensajes de WhatsApp y SMS, con su frescura, y el compositor | `negocio.mensajes` (`lib/negocio/ficha.ts:209-225`) | 6.110 mensajes; **2** escritos desde el compositor, el último el 2026-09-07, y 0 desde la `049` |
| Llamada | las llamadas de la plataforma de voz | `negocio.llamadas` (`lib/negocio/ficha.ts:342-349`) | **0**: la tabla no tiene escritor (`lib/ghl/entrega.ts:230`) y la pestaña lo dice (`lib/negocio/ficha.ts:122-124`) |
| Perfil | Detalles, Origen, Calificación e Interacciones (`components/negocio/Ficha.jsx:106-111`): los datos del contacto y los campos del CRM de las carpetas elegidas | `negocio.contactos` y `negocio.carpetas_del_crm` (`lib/negocio/ficha.ts:451-472`) | 571 de 594 contactos traen campos del CRM (medido el 2026-09-29 00:00 UTC) |
| Historial | resultados, seguimientos, citas y notas en una línea de tiempo; los mensajes no entran (`lib/negocio/ficha.ts:572-573`) | `negocio.resultados`, `tareas`, `citas` y `notas` (`lib/negocio/ficha.ts:575-628`) | 7 resultados, 4 tareas, 333 citas y 7 notas en toda la base |
| Notas | el hilo de notas, con su autor, y un campo para escribir una | `negocio.notas` (`lib/negocio/ficha.ts:397-399`) | **7**: 4 escritas desde la aplicación, la última el 2026-09-07, y 3 del auditor de IA |

**El compositor.** Envía por `POST /api/contactos/[id]/mensajes`
(`app/api/contactos/[id]/mensajes/route.ts:95-102`), que va al CRM con `POST /conversations/messages`
(`app/api/contactos/[id]/mensajes/route.ts:148`, `lib/ghl/conversaciones.ts:419-427`) —un endpoint
que el propio código declara no medido, porque medirlo manda un mensaje real
(`lib/ghl/conversaciones.ts:413`)— y guarda el mensaje con `origen = 'propio'`
(`app/api/contactos/[id]/mensajes/route.ts:233`); después pasa por `sellarSiEsDelSetter`
(`app/api/contactos/[id]/mensajes/route.ts:257`), el sello que hoy está en 0 de 594 (§ 4.5). En toda
la historia salieron por acá **2 mensajes**, contra miles por el CRM (§ 5.4). Las notas se escriben
con otra capacidad, `contactos.comentar` (`app/api/contactos/[id]/notas/route.ts:84`), y quedan con
`origen = 'plataforma'` (`app/api/contactos/[id]/notas/route.ts:127`).

**Los enlaces rápidos.** El compositor ofrece un menú que pide a `/api/enlaces-rapidos`
(`components/negocio/Ficha.jsx:636`) y filtra por el territorio del contacto
(`components/negocio/Ficha.jsx:883-889`), con la sala y el reagendar de la cita adelante cuando el
servidor los manda (`components/negocio/Ficha.jsx:891-936`); elegir uno pega sólo la URL en el
borrador (`components/negocio/Ficha.jsx:950-952`). Se agregan y se borran desde el Inicio de cada
pestaña (`components/closer/Inicio.jsx:239`, `components/setter/Inicio.jsx:281`,
`components/negocio/EnlacesRapidos.jsx:138`, `components/negocio/EnlacesRapidos.jsx:162`).
`negocio.enlaces_rapidos` tiene **10 filas, las 10 del territorio closer y 0 del setter**, de una
sola organización (medido el 2026-09-28 a las 23:58 UTC). La ficha de un contacto del setter —282 de
594 (§ 4.6)— abre el menú sin ningún enlace configurado; sólo le quedan los dos de su cita, si la
tiene.

**Dos rastros más de otro sistema en los comentarios**, fuera de las cinco familias de § 3.4: las
aperturas desde la auditoría (arriba) y el encabezado de `lib/negocio/ficha.ts`, que dice que cinco
de sus seis tablas están vacías y que hay 239 contactos (`lib/negocio/ficha.ts:6-8`). Hoy la única
vacía es `negocio.llamadas`, y hay 594 contactos.

---

## 3 · Lo que está hardcodeado

**Ningún juego de datos inventados. Seis rastros.**

La maqueta se fue el 2026-08-24 (commit `9ef7ecc`, «Closer y Setter dejan de inventar datos»): un
cockpit con 20 llamadas y 95 % de asistencia, meses de facturación inventada, citas con nombres de
personas (`components/views/CloserView.jsx:5-15`), y en el Setter 222 líneas de JSX estático
(`components/views/SetterView.jsx:6-16`). Lo que queda no inventa cifras, pero seis cosas dicen algo
que ya no es cierto o que nadie volvió a medir.

### 3.1 · La tasa de asistencia del Inicio del closer es un `null` escrito a mano

- **Dónde:** `lib/negocio/inicio.ts:165-170`. La tarjeta la dibuja en
  `components/closer/Inicio.jsx:186-187`.
- **Qué dice:** «Todavía no se puede calcular», siempre. El comentario que lo justifica —«Hoy no hay
  ninguna cita leída»— es falso desde que el barrido llena `negocio.citas` (`lib/negocio/inicio.ts:54-61`;
  333 filas el 2026-09-28).
- **Por qué importa:** el día que un closer registre asistencias, **su propio cockpit seguirá
  diciendo «—»**. La cifra existe en otro módulo —`tasaDeAsistencia`, con su piso
  (`lib/negocio/indicadoresDeCitas.ts:453-456`)— y el Inicio no la pide. El documento hermano pide
  esa tarjeta.

### 3.2 · «Con cita agendada» sale de una etiqueta sin fecha, con el calendario ya leído

`lib/negocio/inicio.ts:41-53` lo cuenta con la etiqueta `cita_agendada` y deja escrito que «el día que
se lea el calendario» pasará a ser del mes. El calendario ya se barre cada hora
(`lib/negocio/barrido.ts:214-218`) y `negocio.citas` tiene fecha en sus 333 filas, pero el indicador
sigue en la etiqueta: **88 contactos del territorio closer** la llevan, medido el 2026-09-28, sin
decir de cuándo.

### 3.3 · Una medición del 2026-09-14 impresa como texto fijo

Avanzar le dice al closer que el campo de asistencia del CRM «está vacío en 1049 de 1052 citas»
(`components/negocio/Avanzar.jsx:389-392`), y el aviso de Conversation repite «3 de 1052»
(`lib/negocio/indicadoresDeCitas.ts:494-496`). Es una medición de la subcuenta del 2026-09-14
(`db/migraciones/049_si_se_presento_a_la_cita.sql:49-50`), **no re-medida**, en un texto que no dice
su fecha.

### 3.4 · Comentarios que afirman lo contrario del código

Un comentario falso es un defecto de primera clase, y en estas dos pestañas hay cinco familias:

- **«Seis de sus siete salidas».** Lo dicen `lib/ghl/contrato.ts:414`,
  `lib/negocio/salidasDelSetter.ts:18`, `app/api/contactos/[id]/avanzar/route.ts:458-459` y
  `app/api/contactos/[id]/avanzar/route.ts:473` («sus siete declaran etiqueta»). El catálogo tiene
  **seis** salidas (`lib/negocio/salidas.ts:69`) y **cinco** apagan el agente, como dice la propia
  tabla (`lib/ghl/contrato.ts:385-387`, `lib/ghl/contrato.ts:396-403`).
- **«Todavía no se escriben: Avanzar es el paso siguiente»** (`lib/ghl/contrato.ts:382`), sobre las
  etiquetas que Avanzar manda desde el 2026-08-26 (commit `39bade3`). Y en el cockpit, «mientras
  Avanzar no exista» (`lib/negocio/inicio.ts:110-111`).
- **«`closer_asignado` tiene `org_id` como clave primaria entera»**, o sea un closer por empresa, en
  cinco lugares: `lib/negocio/comisionDelSetter.ts:18-20`, `lib/negocio/inicioDelSetter.ts:6-7`,
  `app/api/setter/mi-dia/route.ts:57-58`, `components/setter/Inicio.jsx:10-11` y
  `components/setter/PorcentajesDelSetter.jsx:15-16`. La clave es `(org_id, usuario_id)` desde la
  `034` (`db/migraciones/034_varios_closers.sql:61`, aplicada el 2026-09-01), y hay tres filas.
- **«NO hay sincronización automática de contactos»** (`components/views/CloserView.jsx:395-401`).
  Hay: el comentario es del commit `28c6937` (2026-08-27 16:58, hora de Lima); `contactos` entró al
  barrido diario esa misma noche (`f6d09a0`, 21:42) y al horario de diez minutos
  (`lib/negocio/barrido.ts:202-206`) con `2e8ce81`, el 2026-08-28.
- **«Las ÚNICAS dos con una capacidad de lectura propia»** (`lib/autorizacion/secciones.ts:340`).
  Analizadores pide `analizadores.ver` desde el 2026-09-23 (`lib/autorizacion/secciones.ts:373-378`).

### 3.5 · «Las vencidas NO desaparecen», y desaparecen a medianoche

`lib/negocio/miDia.ts:83-86` cita la regla —una cita que pasó sin Avanzar sigue en la lista, porque
«si desapareciera, el closer perdería de vista exactamente la cita que tiene pendiente de
registrar»—, pero la consulta sólo trae las citas **de hoy** (`lib/negocio/miDia.ts:104-105`). A las
00:00 de Lima la cita sin registrar sale de Mi Día, y no vuelve a ninguna cola (§ 5.5).

### 3.6 · Nombres de personas reales en el código público

El repositorio es público. `components/views/CloserView.jsx:11` conserva el nombre completo de un
closer —el encabezado de la maqueta que se borró—, y `lib/ghl/contrato.ts:44` y
`lib/ghl/contrato.ts:94` nombran a un contacto de la subcuenta. No se reproducen acá.

---

## 4 · Qué registra el closer, y cuánto hay

### 4.1 · Lo que escribe Avanzar, en una transacción

`lib/negocio/avanzar.ts` es el único escritor de resultados (`lib/negocio/avanzar.ts:1-16`), y todo
entra junto o no entra:

| escritura | dónde | línea |
|---|---|---|
| el resultado: salida, rol, monto, forma de pago, detalle, nota, quién, clave de intento, cita | `negocio.resultados` | `lib/negocio/avanzar.ts:174-197` |
| la etapa, que mueve el Pipeline | `negocio.contactos.etapa` | `lib/negocio/avanzar.ts:228-232` |
| **si se presentó**, sobre la cita elegida y sólo si es de ese contacto | `negocio.citas.asistio` | `lib/negocio/avanzar.ts:245-252` |
| el sello del setter, si corresponde | `negocio.contactos` | `lib/negocio/avanzar.ts:266` |
| la nota, también en el hilo de la ficha | `negocio.notas` | `lib/negocio/avanzar.ts:268-282` |
| cierra los seguimientos abiertos | `negocio.tareas` | `lib/negocio/avanzar.ts:309-314` |
| el recordatorio nuevo, salvo que lo persiga el CRM | `negocio.tareas` | `lib/negocio/avanzar.ts:328-351` |

Después, y fuera de la transacción, la ruta le manda las etiquetas al CRM; su fallo no deshace nada
y la respuesta lo dice aparte (`app/api/contactos/[id]/avanzar/route.ts:329-336`).

### 4.2 · Las salidas

El territorio **del contacto** decide el vocabulario, no el rol de quien registra
(`app/api/contactos/[id]/avanzar/route.ts:257-280`).

- **Closer, seis** (`lib/negocio/salidas.ts:82-201`): `venta` (pide monto y forma de pago: Contado,
  Splitwise, Buy Now Pay Later, Cuotas), `acuerdo_sin_pago` (pide monto), `seguimiento` (nivel de
  interés y dos modos: lo retoma la persona o lo persigue la serie del CRM), `no_interesa` (motivo),
  `no_show` (qué pasó) y `nurture` (de dónde viene).
- **Setter, cinco** (`lib/negocio/salidasDelSetter.ts:54-158`): `agendo`, `venta_chica` (pide monto),
  `seguimiento` (tres modos), `no_califica` y `nurture`.

### 4.3 · La asistencia

Desde la `049`, aplicada el **2026-09-14 21:49:52 UTC** (`migraciones.migraciones_aplicadas`), la
cita tiene `asistio` y el resultado tiene `cita_id`
(`db/migraciones/049_si_se_presento_a_la_cita.sql:46-47`,
`db/migraciones/049_si_se_presento_a_la_cita.sql:65-66`). Nulo es
«nadie lo dijo», distinto de `false` (`db/migraciones/049_si_se_presento_a_la_cita.sql:43-45`).

Qué citas ofrece Avanzar para preguntar: las que **ya empezaron, no están canceladas, son
alcanzables** y cayeron en los **últimos 14 días** (`lib/negocio/citasParaCerrar.ts:58-71`; la ficha
la llama sin argumento en `app/api/contactos/[id]/route.ts:151`). Con una sola candidata viene
elegida y la respuesta es obligatoria; con dos o más, el selector arranca en «No es sobre ninguna de
estas citas» (`components/negocio/Avanzar.jsx:86`, `components/negocio/Avanzar.jsx:337`), y
registrar sin elegir
está permitido (`components/negocio/Avanzar.jsx:168`). Con `no_show` la respuesta la da la salida:
se guarda `false` sin preguntar (`components/negocio/Avanzar.jsx:128-129`).

### 4.4 · El monto

`numeric(12,2)`, nulo cuando la salida no lo pide y **nunca cero por omisión**
(`db/migraciones/011_negocio_closer_setter.sql:394-395`). El servidor lo exige en las salidas que lo
piden, lo rechaza negativo y lo guarda como texto con dos decimales para no perder centavos
(`app/api/contactos/[id]/avanzar/route.ts:398-407`). No hay columna de moneda en `negocio.resultados`.

### 4.5 · Las cifras

Medido el 2026-09-28 contra producción; la columna del medio es la de la foto anterior cuando la
tenía.

| hecho | tabla | foto anterior | 2026-09-28 |
|---|---|---|---|
| resultados registrados | `negocio.resultados` | 7 (2026-09-16) | **7** |
| — del setter | `rol = 'setter'` | 0 | **0** |
| — por salida | `salida` | seguimiento 4 · no_show 2 · no_interesa 1 | igual |
| — ventas, acuerdos sin pago y ventas chicas | `salida` | 0 | **0** |
| — con monto | `monto` | 0 | **0** |
| — con cita enganchada | `cita_id` | 0 | **0** |
| — personas que registraron | `registrado_por` | 2 | 2 |
| — primero y último | `creado_el` | 2026-08-30 · 2026-09-09 | igual |
| citas con asistencia | `negocio.citas.asistio` | 0 de 321 (2026-09-16) | **0 de 333** |
| notas escritas desde la plataforma | `negocio.notas`, `origen = 'plataforma'` | no medido | 4, la última del 2026-09-07 |
| recordatorios | `negocio.tareas` | no medido | 4 (1 cerrado), el último del 2026-09-07 |
| mensajes enviados desde el chat de la aplicación | `negocio.mensajes`, `origen = 'propio'` | no medido | **2**, el último del 2026-09-07 |
| sellos del setter | `contactos.sello_setter_id` | no medido | 0 de 594 |
| porcentajes de comisión | `negocio.comisiones` | 3 de closer al 10 %, meta nula | igual; **0 filas de setter** |

La última escritura de una persona en cualquiera de estas tablas es del **2026-09-09**. Cuántas
veces se abrió Avanzar sin registrar **no se puede saber**: la clave de intento nace con cada
apertura pero sólo se guarda al registrar (`components/negocio/Avanzar.jsx:90-107`).

### 4.6 · La cartera y el calendario

- **Contactos:** 594 (585 el 2026-09-16): 287 del territorio closer (280), 282 del setter (280) y 25
  sin territorio (25). Con etapa escrita por un Avanzar, **6** —los mismos de la foto anterior—.
  Altas en el CRM en los últimos 7 días: 3.
- **Citas:** 333 (321 el 2026-09-16), del 2026-08-12 al 2026-10-01; 2 todavía por ocurrir a las
  18 h UTC del corte, 1 a las 23:58. Estado
  del calendario: `cancelled` 166 (160), `confirmed` 152 (146), `noshow` 15 (15) y `showed`
  **ninguna**. Los cambios de estado a `noshow` que la tabla registra son 12, todos de `confirmed`,
  todos entre el 2026-09-15 y el 2026-09-18; ninguno después.
- **Pipeline del closer**, todo el territorio y sin congelados, recalculado a mano en SQL con la regla
  de `lib/negocio/etapas.ts:222-261`: Agendado 228 · No-show 53 · Seguimiento 3 · Ganado 1 · Nurture 1 ·
  Descalificado 1. Clasificados por un Avanzar, 6; por una etiqueta del CRM, 53; por nada, 228
  (`lib/negocio/pipeline.ts:136-141` los cuenta así y la pantalla lo muestra).

---

## 5 · Por qué está casi vacío, y a quién deja sin dato

### 5.1 · Los siete resultados son anteriores a la pregunta

El último resultado es del **2026-09-09 20:08 UTC** y la `049` se aplicó el **2026-09-14 21:49 UTC**.
Ninguno de los siete pudo escribir `cita_id` ni `asistio`: cuando se registraron, ni la columna ni la
pregunta existían. Eso contesta la pregunta que `docs/sales/01-LA-VENTA-NO-EXISTE.md:148-157` dejó
**abierta** («¿por qué se guardaron sin la cita?»), y corrige su medición
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:126-140`): que cinco de los siete «tenían una cita ofrecible en
ese momento» no puede ser, porque en ese momento Avanzar no ofrecía ninguna.

### 5.2 · Desde que existe la pregunta: quince citas, cero registros

Entre el 2026-09-14 21:49 UTC y las 18 h UTC del corte hubo **28 citas alcanzables que ya
ocurrieron: 13 canceladas y 15 cerrables** (a las 23:58, las ofrecibles eran 16; § 5.8). Las 15
caen todavía dentro de los 14 días que Avanzar ofrece. Resultados registrados en ese lapso: **0**.
De las 15, **11 son del único closer que usó la aplicación** después de la `049` y 4 de los otros
dos; ninguna quedó sin closer.

### 5.3 · Dos de los tres closers no volvieron a entrar

De los tres closers, **uno** inició sesión después de la `049` (24 inicios hasta las 18:03 UTC del
corte y 25 a las 00:20 del 29, en `identidad.auditoria_accesos`), y es también el único con una
sesión que siguió viva después del 2026-09-21. Los otros dos no iniciaron sesión: la última sesión de
uno venció el 2026-09-14 a las 20:19 UTC, antes de la `049`, y la del otro el 2026-09-21 a las 14:58
UTC, sin renovarse. La medición tiene un punto ciego que hay que decir: la sesión se renueva por
siete días sólo cuando le queda menos de uno (`lib/autorizacion/sesion.ts:389-390`), así que un uso
aislado del segundo entre el 14 y el 20 de septiembre podría no haber dejado rastro. **No
verificado** con un registro de uso por pantalla, porque no hay.

Así que son dos causas y no una: dos closers ausentes (4 citas) y uno presente que tampoco registró
(11 citas). Las 4 de los ausentes son, las cuatro, del closer vinculado al usuario del CRM que la
empresa tiene como cuenta del agente de IA (§ 2.4); el otro ausente no tenía ninguna.

### 5.4 · El trabajo pasa en el CRM, y deja rastros que no llegan acá

- **El chat.** Salieron 4.645 mensajes por la ingesta del CRM en toda la historia —233 desde la
  `049`— hasta las 18:03 UTC del corte (4.647 y 235 a las 00:15 del 29), y **2** desde el
  compositor de la aplicación, el último el 2026-09-07.
- **Una venta.** Un contacto del territorio closer lleva la etiqueta `venta_ganada` en el CRM, **sin
  ningún resultado ni en esta base ni en la plataforma anterior**, y con dos citas cerrables dentro de
  la ventana de 14 días, la más reciente del 2026-09-28. Es una venta que existe en el CRM y no en
  `negocio.resultados`. El Pipeline la dibuja en «Ganado», porque sin etapa escrita clasifica por
  etiqueta (`lib/negocio/etapas.ts:258-259`, `lib/negocio/pipeline.ts:119`), mientras el Inicio y
  Sales, que leen resultados (`lib/negocio/dineroDelMes.ts:134-153`), dicen cero ventas. Dos pantallas
  del mismo producto, el mismo contacto, dos respuestas.
- **La llamada.** **63 contactos**, todos del territorio closer (de 287), llevan
  `bot_desactivado_postcall`, que el sistema lee como «ya tuvo
  la llamada de cierre» (`lib/ghl/contrato.ts:117`) y afirma que la pone la aplicación
  (`lib/ghl/contrato.ts:98-100`). **56 de esos 63 no tienen ningún Avanzar en ninguna de las dos
  plataformas**: la plataforma anterior (`public.closer_avances`, que no es nuestra) tiene 26
  registros, todos entre el 2026-08-09 y el 2026-08-13, y ninguno de venta. Quién puso esas
  etiquetas —un flujo del CRM o una persona— **no está verificado**.
- **La grabación.** Analizadores tiene **38 llamadas de venta (HT) procesadas**, del 2026-07-31 al
  2026-09-24, 2 de ellas después de la `049`; su análisis dice `NO_CERRADA` en 36 e `INDETERMINADO` en
  2. Prueba que las reuniones ocurren. No llega a `citas.asistio`: `negocio.analizador_llamadas` no
  tiene columna que la ate a una cita ni a un contacto de `negocio`.

### 5.5 · El producto no insiste

Cuatro decisiones hacen que no registrar sea el camino de menor esfuerzo. Ninguna rompe una prueba.

1. **No hay cola de «registro pendiente».** Mi Día tiene cinco colas —urgentes, agenda, buzón,
   seguimientos, completadas (`lib/negocio/miDia.ts:42-47`)—; la cita sin cerrar vive sólo en «Agenda
   de hoy», hasta medianoche (§ 3.5), y **no suma al contador de tareas**: «una cita es un evento, no
   una tarea» (`lib/negocio/miDia.ts:173-185`). El documento hermano pedía esa cola.
2. **Avanzar olvida a los 14 días.** De las **95 citas cerrables** de la base (alcanzables, no
   canceladas, ya ocurridas; la más vieja del 2026-08-24; medido a las 18:03 UTC del corte), **80
   ya no se pueden cerrar con asistencia** desde la aplicación, porque salieron de la ventana de
   `lib/negocio/citasParaCerrar.ts:58-71`. El propio archivo dice que su ventana «es la misma de la
   cifra» (`lib/negocio/citasParaCerrar.ts:27-28`), y no lo es: Conversation abre en 30 días
   (`lib/negocio/periodo.ts:109`), y en esa ventana, sobre su población (sin descartados), a las
   18 h UTC había **69 citas no canceladas y sólo 13 dentro de los 14 días**. La cadena de Sales
   cuenta sus cerrables **sin ventana**
   (`lib/negocio/citasAlcanzables.ts:174-176`), así que afirmar que acusa sobre la misma población que
   Avanzar ofrece (`lib/negocio/cadenaDeCierre.ts:39-44`, `lib/negocio/citasAlcanzables.ts:166-169`)
   es cierto para el resultado y falso para la asistencia.
3. **Con dos citas o más, la respuesta por omisión es «ninguna».** Ver § 4.3.
4. **El closer nunca ve su show rate.** Aunque registre, su Inicio dice «—» (§ 3.1).

### 5.6 · Lo que eso deja sin dato aguas abajo

**Conversation.** La tasa de asistencia cuenta sólo citas con `asistio is not null`
(`lib/negocio/indicadoresDeCitas.ts:365-379`) y calla por debajo de 10
(`lib/negocio/indicadoresDeCitas.ts:453-456`). Medido el 2026-09-28 a las 18 h UTC con ese mismo
filtro —alcanzables, sin descartados, ya ocurridas—: **106 citas a 30 días y 0 con asistencia**; 17 a
14 días, 142 en «completo». La pantalla dibuja «—» y «asistencia · 0 de 106 cerradas»
(`components/conversation/PanelDeConversation.jsx:620-625`) y el eslabón «Se presentaron» con «nadie
lo registró» (`components/conversation/PanelDeConversation.jsx:650-656`). **No es un 0 %: es un
guion**, y es lo correcto.

Los tres conteos ruedan con el reloj, porque la ventana la calcula la base con `now()`
(`lib/negocio/indicadoresDeCitas.ts:396-397`). Re-medidos con el mismo filtro a las 23:58 UTC dieron
**102 a 30 días, 18 a 14 días y 143 en «completo»**, y 0 con asistencia a 30 días: las más viejas
salieron de los 30 días y una cita más ocurrió (a las 18 h quedaban 2 por ocurrir; a las 23:58, 1).
Las canceladas, 33 de 102 (32,4 %) a 30 días y 56 de 143 (39,2 %) en «completo».
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) midió 103 y 143 a las 22:06, y
[04-CONVERSATION.md](04-CONVERSATION.md) 106 y 142 a las 18 h: todas son ciertas a su hora, y la
explicación está en [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md). Lo que no se mueve es el cero de
asistencia. El 2026-09-15 el mismo denominador era 128 a 30 días
([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md)); bajó porque la ventana rueda y entran menos citas: la
última cita creada en la tabla es del 2026-09-25.

Una advertencia para quien reconstruya estas horas: la verificación de las 00:21 UTC del 29, con el
reloj fijado en 18:03 y en 23:58, da **uno más** a 30 días y en «completo» (107 y 143; 103 y 144),
y las mismas cifras a 14 días y en canceladas. La cuenta de 30 días y la de «completo» de las tres
mediciones del día —las de acá, la de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) y la
de [04-CONVERSATION.md](04-CONVERSATION.md)— son coherentes entre sí. La diferencia es de los
descartados: las alcanzables ya ocurridas a 30 días dan lo mismo (194 a las 18:03, 191 a las 22:06),
pero las de contactos descartados, que esos dos archivos midieron en 88, hoy dan 87. «Descartado» se
decide con las etiquetas **de hoy** del contacto, que el barrido reescribe cada diez minutos, así
que un contacto perdió su etiqueta de descarte después de las 23:58. Cuál y por qué **no se puede
verificar**: la base no guarda el historial de etiquetas.

**Sales.** La cadena (`lib/negocio/cadenaDeCierre.ts`) cuenta como cuarto eslabón a los contactos
con un resultado posterior a su cita (`lib/negocio/cadenaDeCierre.ts:185-191`) y como quinto a los
que tienen una venta. Recalculada el 2026-09-28 con sus mismos predicados:

| ventana | entraron | agendaron | la cita ya ocurrió | alguien registró | venta |
|---|---|---|---|---|---|
| completo, 2026-09-21 (`lib/negocio/cadenaDeCierre.ts:8-12`) | 566 | 197 | 75 | 4 | 0 |
| completo, 2026-09-28 18 h UTC | 570 | 200 | 77 | **4** | **0** |
| completo, 2026-09-28 23:58 UTC | 570 | 200 | 78 | **4** | **0** |
| 30 días, 2026-09-28 18 h UTC (la que abre la pantalla, `app/api/sales/route.ts:84-110`) | 277 | 139 | 46 | **3** | **0** |
| 30 días, re-medida entre las 23:58 UTC del 28 y las 00:02 UTC del 29 | 276 | 139 | 47 | **3** | **0** |

En una semana entraron 4 contactos, 3 agendaron, 2 contactos más tuvieron su cita ya ocurrida (3 a
las 23:58), y el eslabón de registro no se movió. Entre la primera medición de 30 días y la segunda la cohorte bajó de 277 a 276, porque la
ventana rueda con `now()` (`lib/negocio/cadenaDeCierre.ts:169`), y un contacto más tuvo su cita ya
ocurrida; los dos últimos eslabones siguen en 3 y 0. La columna «Plantón» de Sales sale del
calendario y no de Avanzar (`lib/negocio/citasAlcanzables.ts:105-110`), así que es la única de
asistencia que tiene algo: 15 citas en toda la base (alcanzables, sin descartados).

### 5.7 · El setter, entero en cero

282 contactos de territorio setter y **ninguno** con resultado, etapa escrita, sello, ni con las
etiquetas que llenan sus tres colas pasivas —fallo del agente, `derivado_lt`, `estancado`: 0, 0 y 0,
medido el 2026-09-28—. Sin filas de comisión de setter, los dos tramos de su Inicio dicen que nadie
cargó el porcentaje. Del setter no hay ninguna cifra que medir todavía.

### 5.8 · Para volver a medir

```sql
select
 (select count(*) from negocio.resultados) resultados,
 (select count(*) from negocio.resultados where creado_el >= timestamptz '2026-09-14 21:49:52+00') desde_la_049,
 (select count(cita_id) from negocio.resultados) con_cita,
 (select count(asistio) from negocio.citas) citas_con_asistencia,
 (select count(*) from negocio.citas
   where ghl_calendario_id is not null and inicio_el < now()
     and inicio_el >= now() - interval '14 days'
     and lower(coalesce(estado_ghl, '')) <> all (array['cancelled', 'canceled', 'cancelada'])) ofrecibles_hoy;
-- 2026-09-28 18:0x UTC: 7 · 0 · 0 · 0 · 15
-- 2026-09-28 23:58 UTC: resultados 7 y ofrecibles_hoy 16 (los otros tres no se re-midieron)
-- 2026-09-29 00:20 UTC (verificación): 7 · 0 · 0 · 0 · 16
```

---

## 6 · Reglas propias

**1 · Avanzar es el único escritor, y primero va la base.** Con dos caminos que registren, el Inicio,
el Pipeline y la píldora divergen sin fallar (`lib/negocio/avanzar.ts:1-16`). El CRM va después,
porque al revés un fallo de la base dejaría al CRM disparando flujos por un resultado que no existe
(`app/api/contactos/[id]/avanzar/route.ts:4-16`).

**2 · El vocabulario es del territorio del contacto, y la guarda es una sola.** `parDeSalida` es lo
único que impide que un `agendo` del setter pise una venta del closer, y `contactos.etapa` no guarda
historial para deshacerlo (`lib/negocio/salidas.ts:265-292`).

**3 · La asistencia es de la cita y sale de `citas.asistio`, nunca de la salida.** «No-show» salió de
las opciones de `nurture` porque un plantón podía registrarse como nurture y contarse como asistencia
(`lib/negocio/salidas.ts:185-198`). Y la marca `noshow` del calendario **no se suma** con `asistio`:
son dos fuentes y sólo una es nuestra (`lib/negocio/citasAlcanzables.ts:105-110`).

**4 · `asistio` no entra en el `do update` del barrido.** Es la única columna de `citas` que no viene
del CRM; si entrara, cada pasada horaria la volvería a nulo sin error
(`lib/negocio/citas.ts:417-422`).

**5 · Venta, acuerdo sin pago y venta chica son tres hechos.** Cada catálogo manda sus salidas a sus
columnas (`lib/negocio/etapas.ts:76-94`), y lo cobrado suma sólo `venta`
(`lib/negocio/dineroDelMes.ts:139-150`).

**6 · Un cero medido no es un cero sin medir.** Con resultados en el mes y ninguna venta, «0»; sin
ningún resultado, «—» con su motivo (`lib/negocio/dineroDelMes.ts:155-185`). En septiembre de 2026
(hora de Lima) hay 6 resultados, de dos de los tres closers: la vista de empresa y esos dos ven **0
ventas medidas**, y el tercero ve «—». Si octubre empieza sin registros, los tres pasan a «—».

**7 · Una clave por apertura del panel.** Reintentar después de un corte no duplica resultado, nota,
tarea ni comisión (`app/api/contactos/[id]/avanzar/route.ts:156-171`,
`components/negocio/Avanzar.jsx:90-107`).

**8 · El alcance no es un permiso.** Vive en la consulta, y el closer sin vincular ve todo, porque
mostrarle cero le diría «no hay trabajo» (`lib/negocio/alcanceDelCloser.ts:23-38`). La comisión es
de una persona o de nadie, nunca la suma de tres (`app/api/closer/mi-dia/route.ts:111-124`).

---

## 7 · Riesgos

**Leer el vacío como «no vino nadie».** Una tasa calculada sobre las ~100 citas de 30 días (106 a las
18 h UTC del corte, 102 a las 23:58) sin el filtro `asistio is not null` da 0 % y anuncia una
crisis que no existe. El filtro está en el servidor; el riesgo es una cifra nueva que no lo copie.

**Rellenar la asistencia con lo que sí hay.** Las 56 etiquetas `bot_desactivado_postcall` sin
Avanzar y las 38 llamadas de tl;dv son tentadoras, y ninguna es la respuesta de quien estuvo en la
llamada. Si alguna entra, entra como columna aparte con su nombre, como el plantón del calendario, y
nunca en el mismo denominador.

**Registrar hoy lo que pasó hace semanas.** `creado_el` es la hora del registro, no la de la reunión:
la venta que está en el CRM, cargada tarde, cae en el mes en que se carga, y ahí la cuentan el
cobrado y la comisión. Y pasados los 14 días, su cita ya no se ofrece para la asistencia.

**Publicar el Ganado del Pipeline como ventas.** Hoy es 1, y sale de una etiqueta; el Inicio y Sales
dicen 0, y salen de resultados. Sumar las dos fuentes, o elegir la del Pipeline porque es la que
tiene algo, mezcla lo que dijo el CRM con lo que registró una persona.

**Confiar en los comentarios.** Las cinco familias de § 3.4 describen un sistema con un closer por
empresa, siete salidas, sin Avanzar, sin cron de contactos y con sólo dos capacidades de lectura
propias. Quien los lea para decidir, decide sobre otro sistema.

**El nombre real en el código.** § 3.6. En un repositorio público, un comentario es publicación.

**Lo que sí se puede afirmar hoy, y lo que no.** Sí: que el instrumento existe y funciona —la suite
lo cubre (`pruebas/base/26-avanzar.test.ts`) y no se corrió para este informe—, que hay 7 resultados
y 0 ventas registradas, que el calendario marcó 15 plantones y que una venta está en el CRM sin estar
acá. No: ninguna tasa de asistencia ni de cierre, ninguna cifra del setter, y por qué dos closers
dejaron de entrar. El cuello de botella no es técnico, pero tampoco es sólo de adopción: el trabajo
se hace en el CRM y en tl;dv, y la aplicación no retiene la cita que quedó sin cerrar.
