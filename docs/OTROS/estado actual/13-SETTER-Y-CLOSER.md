# Setter y Closer

> Corte: **2026-10-18**, con el código de producción en `972972e`. En local hay ocho commits más (`693a383..dc84cb2`,
> el modelo de datos multiempresa, Fase 0, migraciones `079` a `084`) construidos y **sin subir**: lo que tocan de
> estas pestañas va dicho como «construido en local, sin subir». Las cifras de producción son de dos fechas y cada una
> lo dice: las del **2026-10-18**, medidas desde las 15:39 UTC con `scripts/supabase.mjs leer` (sólo lectura, sólo
> conteos y agregados, con el OK del usuario), y las del **2026-09-28**, de la foto anterior —medidas desde las 18:03
> UTC, las de la ficha y las ventanas que ruedan entre las 23:58 UTC del 28 y las 00:25 UTC del 29—, cuando no se
> volvieron a medir. Todas sobre producción, donde sólo la organización `aria` tiene contactos y citas. Cada
> afirmación lleva su `archivo:línea` o la consulta que la produjo; lo que no se pudo verificar está dicho como
> pendiente. Las pantallas no se abrieron con sesión para esta foto. La versión anterior se lee con
> `git show 972972e:"docs/OTROS/estado actual/13-SETTER-Y-CLOSER.md"`.

**Construido — en producción desde el 2026-08-24, y sin un solo registro desde el 2026-09-09.**

Son las dos únicas pestañas del producto donde una persona escribe el hecho comercial, y el
instrumento está entero: Avanzar guarda resultado, etapa, nota, tarea, cita y asistencia en una sola
transacción. Producción sigue con **7 resultados en toda su historia** —del 2026-08-30 al 2026-09-09—,
**0 ventas, 0 montos y 0 de 368 citas con la asistencia registrada** (medido el 2026-10-18; eran 0 de 333 el
2026-09-28). Los siete son anteriores a la pregunta «¿se presentó?», que existe desde el 2026-09-14 21:49 UTC, y desde
entonces ocurrieron **38 citas que Avanzar podía cerrar** (eran 15 el 2026-09-28) sin que se registrara ninguna. Lo
nuevo desde el corte es que el producto ya lo dice en voz alta: la cabecera del Closer cuenta las citas que esperan
registro, la Reunión de hoy lo trae como tema todos los días desde el 2026-10-06, y el Brief del closer prepara cada
cita antes de la llamada. **Nada de eso movió el registro**, y el Brief no se generó nunca en producción (§ 2.6).

> **Desde el corte del 2026-09-28**
>
> - **2026-10-02 · `40f699a`** — E10 de la nueva estructura: Setter y Closer pasan a ser entradas de **Sales**
>   (`lib/autorizacion/departamentos.ts:108-109`), con la cabecera del departamento encima (`624a941`).
> - **2026-10-05 · `13723a0`** — AG6 de los agentes: la caja del pie del cerebro en las dos pestañas
>   (`app/api/setter/cerebro/route.ts`, `app/api/closer/cerebro/route.ts`) y sus siete herramientas (§ 2.7).
> - **2026-10-05 · `3170786`** — AG11: las objeciones de las llamadas de venta, clasificadas una vez por Haiku
>   (`073`); son la objeción de respaldo del Brief.
> - **2026-10-05 · `e5d6c98`, `88fb9cd`** — AG12: el Brief del closer (`074`), en la ficha abierta desde una cita y con
>   sus marcas en Mi Día (§ 2.6), y su evaluación real.
> - **2026-10-06 · `d8effd3`** — AG15: la Reunión de hoy, con la regla de las citas sin registrar como tema de
>   «Sales · Closer» (§ 2.8).
> - **2026-10-07 · `2f12fad`** — el comentario de la cabecera en Closer: las citas sin registrar del alcance de quien
>   mira (§ 2.8).
> - **2026-10-08 · `71c71b8`** — CV-1 de Conversion toca `citasAlcanzables.ts`, el predicado que comparten la cadena
>   de Sales y Avanzar; las citas de esta foto a ese archivo se volvieron a verificar.
> - **2026-10-13, en la base, sin commit** — la plataforma anterior (`public.closer_*`) se borró de producción con el
>   OK del usuario y respaldo aparte: el 2026-10-18 no queda ninguna tabla `closer_*` en `public` (§ 5.4).
> - **2026-10-16 · `ce5ed91`, `8ad73f3`** — construido en local, sin subir: la cuenta (`cuenta_id`) entra a
>   `contactos`, `citas`, `notas`, `tareas`, `resultados`, `comisiones`, `closer_asignado` y `briefs_del_closer`, entre
>   otras (`db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:26-28`), y un Brief no puede quedar en otra cuenta que
>   su cita (`db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:65-66`).

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
`setter.ver` y `closer.ver` (`lib/autorizacion/secciones.ts:350-373`). Desde la nueva estructura la barra
las muestra dentro de Sales (`lib/autorizacion/departamentos.ts:108-109`), pero las secciones y sus capacidades no
cambiaron. Que un closer no vea la
pestaña del setter depende, en el diseño, de que no compartan capacidad; en producción los roles
dan las dos a todos, y lo que recorta es la lista de secciones (§ 2.4). Las **cuatro**
sub-pestañas del closer piden `closer.ver`, no una capacidad cada una, porque dos llamadas de la
misma pantalla con capacidades distintas dejan una parte vacía sin que se note
(`lib/autorizacion/secciones.ts:357-361`; la Agenda lo repite en
`app/api/closer/agenda/route.ts:57-60`).

La ficha del contacto y Avanzar no son de ninguna de las dos: se abren desde las dos pestañas, y
sólo desde ellas (§ 2.5). Las nueve rutas bajo `app/api/contactos/` —la ficha y sus cinco
pestañas, Avanzar, resolver una intervención y la sincronización de contactos— se declaran sin
pantalla y piden capacidades propias —`contactos.ver`, `contactos.avanzar`, `contactos.resolver`,
`contactos.comentar` (`lib/autorizacion/secciones.ts:599-639`)—; enviar desde el compositor del chat
pide `conversaciones.responder` y no `contactos.ver` (`app/api/contactos/[id]/mensajes/route.ts:105`).

### 2.2 · El Setter

`components/views/SetterView.jsx`, 355 líneas. Cuatro sub-pestañas en el mismo orden que el closer
—Inicio · Mi Día · Pipeline · Contactos (`components/views/SetterView.jsx:142-147`)— y seis colas en
Mi Día: urgentes, buzón, oportunidades chicas, estancadas, seguimientos de hoy y completadas
(`components/views/SetterView.jsx:87-119`). Cuatro rutas bajo `app/api/setter/`, las cuatro con
`setter.ver`: `mi-dia` (GET, trae colas, cockpit y las dos comisiones en una sola respuesta,
`app/api/setter/mi-dia/route.ts:44-70`), `pipeline` y `contactos` (GET) y `meta` (PATCH). La
respuesta de Mi Día declara `llamadasAlCrm: 0` (`app/api/setter/mi-dia/route.ts:87-90`).

### 2.3 · El Closer

`components/views/CloserView.jsx`, 408 líneas. Inicio · Mi Día · Pipeline · Agenda
(`components/views/CloserView.jsx:47-52`). Seis rutas de lectura bajo `app/api/closer/`, todas con `closer.ver`, más
dos que nacieron después del corte: `brief` (§ 2.6) y `cerebro` (§ 2.7). Las seis:
`mi-dia` (colas + cockpit + comisión, y desde AG12 y AG15 las marcas del Brief y el comentario de la cabecera,
`app/api/closer/mi-dia/route.ts:50-175`, `app/api/closer/mi-dia/route.ts:117-126`), `agenda`, `pipeline`,
`meta` (PATCH), `agenda/refrescar` (POST, con `maxDuration = 300`,
`app/api/closer/agenda/refrescar/route.ts:65`) y `contactos`. **Esta última no la llama ninguna
pantalla**: la lista de contactos salió de Mi Día y el Closer no tiene sub-pestaña Contactos; un
`grep` de `closer/contactos` fuera de `app/api` sólo la encuentra en un comentario
(`components/negocio/ListaDeContactos.jsx:9`) y en tres pruebas.

**De quién son los leads** lo decide un solo módulo, y no es un permiso: `todo` para quien no es
closer o es closer sin vincular a un usuario del CRM, `mio` para el closer vinculado
(`lib/negocio/alcanceDelCloser.ts:25-38`). Desde el nivel 3 (C5 · G2, construido en local) el vínculo es de un
cliente: «mío» son los pares (cliente, usuario del CRM), con un solo corte (`lib/negocio/alcanceDelCloser.ts:110`). Con
varios clientes (C6 · D1), la Agenda, la cabecera de Mi Día y el chat de la ficha dicen de qué cliente no se está
leyendo el calendario o los mensajes porque su conexión con GoHighLevel no está lista, y qué hacer, sólo de los
clientes del alcance de quien mira (`lib/negocio/agenda.ts:428`, `lib/agentes/cabecera.ts:174`,
`lib/negocio/ficha.ts:280`); la pantalla del vínculo dice quiénes no están vinculados en el cliente elegido
(`components/closer/QuienEsElCloser.jsx:359`). Quien administra puede mirar como uno de ellos, y el
servidor sólo lo atiende si el alcance propio es `todo` (`lib/negocio/alcanceDelCloser.ts:215-224`).

**Lo que cuesta mirarlas.** Leer las pantallas no llama al CRM
(`app/api/closer/mi-dia/route.ts:5`); lo que sí corre, con la pestaña a la vista, es un reloj de 10 s
que dispara la ingesta de mensajes y recarga las colas (`components/views/CloserView.jsx:173-186`,
`lib/cadencia.ts:40`). Los contactos entran solos cada diez minutos por el cron
(`lib/negocio/barrido.ts:248-252`).

### 2.4 · Quién ve qué

Los **15 usuarios activos** tienen `closer.ver`, `setter.ver`, `contactos.avanzar` y, desde AG5, `cerebro.usar` por su
rol (medido el 2026-10-18). Lo que sigue es del 2026-09-28 y no se volvió a medir, salvo donde se dice: eran 9
administradores, 2 superadministradores y 4 de rol restringido. Lo que recorta las pestañas es la
lista de secciones de los cuatro restringidos: los cuatro tienen Closer y tres también Setter. Hay
**3 closers designados**, los tres vinculados al CRM (`negocio.closer_asignado`, 3 filas, también el 2026-10-18); dos tienen
rol restringido —uno de ellos ve también el Setter— y el tercero tiene un rol sin restricción.

La cartera del territorio closer se reparte así entre los tres, sin nombres: **210, 25 y 11
contactos, y 41 sin asignar** (de 287); las citas alcanzables, por el asignado de cada cita y con
las canceladas adentro, 125, 63 y 11, y 33 sin closer (de 232). La concentración ya estaba medida el
2026-09-01 —135 de 152 contactos apuntaban al usuario del CRM que la empresa usa como cuenta del
agente de IA (`components/closer/QuienEsElCloser.jsx:24-29`)—, y sigue igual: re-medido el
2026-09-29 a las 00:15 UTC, el grupo de 210 apunta al usuario que
`identidad.organizaciones_credenciales.crm_agente_usuario_id` declara como el del agente, y ese
mismo usuario del CRM es el vínculo de uno de los tres closers designados.

### 2.5 · La ficha del contacto

`components/negocio/Ficha.jsx`, 1.440 líneas, con sus lecturas en `lib/negocio/ficha.ts`, 740. Es un
panel lateral que se superpone y no navega, y un solo componente para toda la aplicación
(`components/negocio/Ficha.jsx:3-16`). Desde AG12, cuando se abre desde una cita del Closer —Mi Día o la Agenda— suma
una sexta pestaña, **Brief**, que va primera y se abre sola (`components/negocio/Ficha.jsx:102-104`,
`components/negocio/Ficha.jsx:496-497`, `components/negocio/Ficha.jsx:507`); ver § 2.6. Se abre desde seis lugares, todos de estas dos pestañas: Mi
Día, Pipeline y Agenda del closer (`components/closer/MiDia.jsx:440`,
`components/closer/Pipeline.jsx:313`, `components/closer/Agenda.jsx:574`), y el mismo Mi Día, el
mismo Pipeline y la lista de Contactos del setter (`components/views/SetterView.jsx:33-39`,
`components/negocio/ListaDeContactos.jsx:433`). **No se abre desde Conversation ni desde la
auditoría**, aunque tres comentarios digan que sí (`components/negocio/Ficha.jsx:13-14`,
`lib/autorizacion/secciones.ts:610-611`, `lib/autorizacion/secciones.ts:624-625`): ningún archivo
de `components/conversation/` ni de `components/auditoria/` la importa, y la lista de la auditoría
abre un patrón, no un contacto (`components/auditoria/PanelDeAuditoria.jsx:295`). Leads Portal tiene
su propia ficha, `components/leads-portal/FichaDelLead.jsx`, que es otro componente.

El encabezado es sólo estado, y su única acción es Avanzar (`components/negocio/Ficha.jsx:1087-1089`,
`components/negocio/Ficha.jsx:1208`): «Ver en GHL» y «Agendar» funcionaban y se quitaron para que el
trabajo no termine en el CRM (`components/negocio/Ficha.jsx:1067-1084`). Al abrirse pide
`GET /api/contactos/[id]` (`components/negocio/Ficha.jsx:587`) y cada pestaña pide su ruta cuando se
la abre (`components/negocio/Ficha.jsx:667`); sólo el Chat tiene reloj, las otras cuatro se piden una
vez y se quedan (`components/negocio/Ficha.jsx:31-35`). Las cinco pestañas de siempre, en su orden
(`components/negocio/Ficha.jsx:94-100`), con lo que hay en la base, medido el 2026-09-28 a las 23:58
UTC sobre toda la tabla (al pie, lo re-medido el 2026-10-18):

| pestaña | qué muestra | de dónde lee | cuánto hay |
|---|---|---|---|
| Chat | los mensajes de WhatsApp y SMS, con su frescura, y el compositor | `negocio.mensajes` (`lib/negocio/ficha.ts:216-238`) | 6.110 mensajes; **2** escritos desde el compositor, el último el 2026-09-07, y 0 desde la `049` |
| Llamada | las llamadas de la plataforma de voz | `negocio.llamadas` (`lib/negocio/ficha.ts:365-372`) | **0**: la tabla no tiene escritor (`lib/ghl/entrega.ts:230`) y la pestaña lo dice (`lib/negocio/ficha.ts:124-126`) |
| Perfil | Detalles, Origen, Calificación e Interacciones (`components/negocio/Ficha.jsx:106-111`): los datos del contacto y los campos del CRM de las carpetas que se muestran | `negocio.contactos` y `negocio.carpetas_del_crm` (`lib/negocio/ficha.ts:474-496`) | 571 de 594 contactos traen campos del CRM (medido el 2026-09-29 00:00 UTC) |
| Historial | resultados, seguimientos, citas y notas en una línea de tiempo; los mensajes no entran (`lib/negocio/ficha.ts:596-597`) | `negocio.resultados`, `tareas`, `citas` y `notas` (`lib/negocio/ficha.ts:599-652`) | 7 resultados, 4 tareas, 333 citas y 7 notas en toda la base |
| Notas | el hilo de notas, con su autor, y un campo para escribir una | `negocio.notas` (`lib/negocio/ficha.ts:420-422`) | **7**: 4 escritas desde la aplicación, la última el 2026-09-07, y 3 del auditor de IA |

Re-medido el 2026-10-18: **6.478 mensajes**, de los que siguen siendo **2** los escritos desde el compositor (el último,
el 2026-09-07); 368 citas; 7 notas, 4 de ellas desde la aplicación; 4 tareas; 7 resultados. Nadie escribió nada desde
la ficha desde el 2026-09-07.

**El compositor.** Envía por `POST /api/contactos/[id]/mensajes`
(`app/api/contactos/[id]/mensajes/route.ts:98-105`), que va al CRM con `POST /conversations/messages`
(`app/api/contactos/[id]/mensajes/route.ts:151`, `lib/ghl/conversaciones.ts:419-427`) —un endpoint
que el propio código declara no medido, porque medirlo manda un mensaje real
(`lib/ghl/conversaciones.ts:413`)— y guarda el mensaje con `origen = 'propio'`
(`app/api/contactos/[id]/mensajes/route.ts:236`); después pasa por `sellarSiEsDelSetter`
(`app/api/contactos/[id]/mensajes/route.ts:260`), el sello que hoy está en 0 de 594 (§ 4.5). En toda
la historia salieron por acá **2 mensajes**, contra miles por el CRM (§ 5.4). Las notas se escriben
con otra capacidad, `contactos.comentar` (`app/api/contactos/[id]/notas/route.ts:84`), y quedan con
`origen = 'plataforma'` (`app/api/contactos/[id]/notas/route.ts:127`).

**Los enlaces rápidos.** El compositor ofrece un menú que pide a `/api/enlaces-rapidos`
(`components/negocio/Ficha.jsx:645`) y filtra por el territorio del contacto
(`components/negocio/Ficha.jsx:894-900`), con la sala y el reagendar de la cita adelante cuando el
servidor los manda (`components/negocio/Ficha.jsx:902-947`); elegir uno pega sólo la URL en el
borrador (`components/negocio/Ficha.jsx:961-963`). Se agregan y se borran desde el Inicio de cada
pestaña (`components/closer/Inicio.jsx:239`, `components/setter/Inicio.jsx:281`,
`components/negocio/EnlacesRapidos.jsx:138`, `components/negocio/EnlacesRapidos.jsx:162`).
`negocio.enlaces_rapidos` tiene **10 filas, las 10 del territorio closer y 0 del setter**, de una
sola organización (medido el 2026-09-28 a las 23:58 UTC; igual el 2026-10-18). La ficha de un contacto del setter —282 de
594 (§ 4.6)— abre el menú sin ningún enlace configurado; sólo le quedan los dos de su cita, si la
tiene.

**Dos rastros más de otro sistema en los comentarios**, fuera de las cinco familias de § 3.4: las
aperturas desde la auditoría (arriba) y el encabezado de `lib/negocio/ficha.ts`, que dice que cinco
de sus seis tablas están vacías y que hay 239 contactos (`lib/negocio/ficha.ts:6-8`). Hoy la única
vacía es `negocio.llamadas`, y hay 624 contactos (2026-10-18).

### 2.6 · El Brief del closer (nuevo desde el corte)

Una preparación de la llamada, por cita, en cuatro secciones —quién es, qué dijo, la objeción probable y una
pregunta para abrir—; cada dato lleva su estado, su fuente y la cita que lo sostiene, y el código degrada a
«ambiguo» lo «detectado» cuya cita no está en su fuente (`lib/agentes/brief/brief.ts:1-19`). Si lo que dijo la persona
no alcanza, la objeción probable es la más frecuente de las llamadas de la empresa, **marcada como tal**
(`lib/agentes/brief/brief.ts:9-10`). Lo genera `claude-sonnet-5-5` (`lib/agentes/modelos.ts:45-46`).

- **Dónde.** En la ficha abierta desde una cita del Closer (§ 2.5), y como marca en la agenda de Mi Día: «BRIEF
  LISTO» y «SIN FORMULARIO» (`components/closer/MiDia.jsx:181-187`), que arma el servidor sin modelo
  (`app/api/closer/mi-dia/route.ts:117-121`).
- **Cuándo.** Al abrir la pestaña, una vez, si no hay uno guardado y se puede
  (`components/closer/BriefDeLaCita.jsx:88-92`). Regenerarlo a mano cuenta para el tope del cerebro; generarlo al abrir,
  no (`app/api/closer/brief/route.ts:18-19`, `app/api/closer/brief/route.ts:106-111`).
- **Quién.** Leer el guardado pide `closer.ver`; generarlo, `cerebro.usar`
  (`app/api/closer/brief/route.ts:47`, `app/api/closer/brief/route.ts:82`). Es **más estricto que la ficha**: la cita
  tiene que ser de un contacto del territorio closer y, para un closer con «mío», de uno suyo; si no, 404
  (`app/api/closer/brief/route.ts:12-14`, `lib/agentes/brief/entrada.ts:12-16`). Bajo delegación o sin llave no se
  genera, y la pantalla dice por qué en vez de ofrecer un botón que falla (`app/api/closer/brief/route.ts:62-69`).
- **Lo que no viaja al modelo**: el teléfono y el correo del contacto (`lib/agentes/brief/entrada.ts:18-20`).
- **Dónde se guarda**: `negocio.briefs_del_closer`, uno por cita, con la huella de lo que leyó; si el formulario o la
  llamada cambian, la pantalla avisa que hay datos nuevos (`db/migraciones/074_los_briefs_del_closer.sql:16-27`,
  `app/api/closer/brief/route.ts:74-75`).

**En producción, 0 Briefs** y **0 llamadas del agente `brief`** en `negocio.uso_de_ia` (medido el 2026-10-18): desde
el 2026-10-05 nadie abrió en producción la ficha de una cita desde el Closer con el Brief en condiciones de generarse.
La evaluación real de AG12 se hizo contra la base sembrada local, no contra producción. Las objeciones clasificadas
que el Brief usa de respaldo sí existen: **89** en `negocio.objeciones_clasificadas` (2026-10-18).

### 2.7 · El cerebro en Setter y Closer (nuevo desde el corte)

Cada pestaña tiene su caja «Pregúntale al cerebro sobre …» al pie, con su ruta
(`app/api/setter/cerebro/route.ts`, `app/api/closer/cerebro/route.ts`), y el cerebro tiene herramientas de las dos:
tres del Setter y cuatro del Closer, con las mismas funciones y los mismos argumentos que sus rutas
(`lib/agentes/executive/adaptadores/setter.ts:1-6`, `lib/agentes/executive/adaptadores/closer.ts:1-9`). Del Setter
**viajan sólo los conteos**, porque sus filas son contactos con teléfono y correo
(`lib/agentes/executive/adaptadores/setter.ts:4-6`); del Closer, sin el selector «ver como» y con el alcance de quien
pregunta, y de la agenda las horas y el estado de cada cita sin el contacto ni la sala
(`lib/agentes/executive/adaptadores/closer.ts:3-9`). En producción, **ninguna conversación con el cerebro salió de la
caja del pie** de ninguna sección (2026-10-18; ver [11-EXECUTIVE.md](11-EXECUTIVE.md)).

### 2.8 · Las citas sin registrar, dichas en dos lugares (nuevo desde el corte)

- **La cabecera del Closer** dice cuántas citas de los últimos 14 días ya ocurrieron y esperan que se registre si el
  prospecto se presentó (`lib/agentes/cabecera.ts:145-150`), con el alcance de quien mira y el mismo predicado y la
  misma ventana con que Avanzar ofrece cerrarlas (`lib/agentes/cabecera.ts:152-167`). La pide `mi-dia`
  (`app/api/closer/mi-dia/route.ts:122-125`) y la pantalla se la entrega a la cabecera
  (`components/views/CloserView.jsx:97-98`). Sin modelo. El Setter no tiene nada medible y calla
  (`lib/agentes/cabecera.ts:22-23`).
- **La Reunión de hoy** del Inicio trae el tema «Sales · Closer»: contactos de la empresa entera, a 30 días, con una
  cita ocurrida y sin registro (`lib/agentes/reunion/temas.ts:188-201`). Salió los 13 días con temas, del 2026-10-06 al
  2026-10-18; su evidencia bajó de **22 de 22** contactos el 2026-10-06 a **14 de 14** desde el 2026-10-12, sin un solo
  registro en el medio: bajó porque la ventana rueda (medido el 2026-10-18). Ver [11-EXECUTIVE.md](11-EXECUTIVE.md).

Las dos cifras no son la misma y está escrito por qué: la de la Reunión, sobre la empresa, le diría a un closer con
alcance propio lo de los demás (`lib/agentes/cabecera.ts:18-22`).

---

## 3 · Lo que está hardcodeado

**Ningún juego de datos inventados. Seis rastros.**

La maqueta se fue el 2026-08-24 (commit `9ef7ecc`, «Closer y Setter dejan de inventar datos»): un
cockpit con 20 llamadas y 95 % de asistencia, meses de facturación inventada, citas con nombres de
personas (`components/views/CloserView.jsx:5-15`), y en el Setter 222 líneas de JSX estático
(`components/views/SetterView.jsx:6-16`). Lo que queda no inventa cifras, pero seis cosas dicen algo
que ya no es cierto o que nadie volvió a medir.

### 3.1 · La tasa de asistencia del Inicio del closer es un `null` escrito a mano

- **Dónde:** `lib/negocio/inicio.ts:163-168`. La tarjeta la dibuja en
  `components/closer/Inicio.jsx:186-187`.
- **Qué dice:** «Todavía no se puede calcular», siempre. El comentario que lo justifica —«Hoy no hay
  ninguna cita leída»— es falso desde que el barrido llena `negocio.citas` (`lib/negocio/inicio.ts:55-62`;
  333 filas el 2026-09-28).
- **Por qué importa:** el día que un closer registre asistencias, **su propio cockpit seguirá
  diciendo «—»**. La cifra existe en otro módulo —`tasaDeAsistencia`, con su piso
  (`lib/negocio/indicadoresDeCitas.ts:473-476`)— y el Inicio no la pide. El documento hermano pide
  esa tarjeta.

### 3.2 · «Con cita agendada» sale de una etiqueta sin fecha, con el calendario ya leído

`lib/negocio/inicio.ts:42-54` lo cuenta con la etiqueta `cita_agendada` y deja escrito que «el día que
se lea el calendario» pasará a ser del mes. El calendario ya se barre cada hora
(`lib/negocio/barrido.ts:260-264`) y `negocio.citas` tiene fecha en sus 333 filas, pero el indicador
sigue en la etiqueta: **88 contactos del territorio closer** la llevan, medido el 2026-09-28, sin
decir de cuándo.

### 3.3 · Una medición del 2026-09-14 impresa como texto fijo

Avanzar le dice al closer que el campo de asistencia del CRM «está vacío en 1049 de 1052 citas»
(`components/negocio/Avanzar.jsx:389-392`), y el aviso de Conversation repite «3 de 1052»
(`lib/negocio/indicadoresDeCitas.ts:514-516`). Es una medición de la subcuenta del 2026-09-14
(`db/migraciones/049_si_se_presento_a_la_cita.sql:49-50`), **no re-medida**, en un texto que no dice
su fecha.

### 3.4 · Comentarios que afirman lo contrario del código

Un comentario falso es un defecto de primera clase, y en estas dos pestañas hay cinco familias:

- **«Seis de sus siete salidas».** Lo dicen `lib/ghl/contrato.ts:445`,
  `lib/negocio/salidasDelSetter.ts:18`, `app/api/contactos/[id]/avanzar/route.ts:464-465` y
  `app/api/contactos/[id]/avanzar/route.ts:479` («sus siete declaran etiqueta»). El catálogo tiene
  **seis** salidas (`lib/negocio/salidas.ts:69`) y **cinco** apagan el agente, como dice la propia
  tabla (`lib/ghl/contrato.ts:416-418`, `lib/ghl/contrato.ts:427-434`).
- **«Todavía no se escriben: Avanzar es el paso siguiente»** (`lib/ghl/contrato.ts:413`), sobre las
  etiquetas que Avanzar manda desde el 2026-08-26 (commit `39bade3`). Y en el cockpit, «mientras
  Avanzar no exista» (`lib/negocio/inicio.ts:111-112`).
- **«`closer_asignado` tiene `org_id` como clave primaria entera»**, o sea un closer por empresa, en
  cinco lugares: `lib/negocio/comisionDelSetter.ts:18-20`, `lib/negocio/inicioDelSetter.ts:6-7`,
  `app/api/setter/mi-dia/route.ts:57-58`, `components/setter/Inicio.jsx:10-11` y
  `components/setter/PorcentajesDelSetter.jsx:15-16`. La clave es `(org_id, usuario_id)` desde la
  `034` (`db/migraciones/034_varios_closers.sql:61`, aplicada el 2026-09-01), y hay tres filas.
- **«NO hay sincronización automática de contactos»** (`components/views/CloserView.jsx:395-401`).
  Hay: el comentario es del commit `28c6937` (2026-08-27 16:58, hora de Lima); `contactos` entró al
  barrido diario esa misma noche (`f6d09a0`, 21:42) y al horario de diez minutos
  (`lib/negocio/barrido.ts:248-252`) con `2e8ce81`, el 2026-08-28.
- **«Las ÚNICAS dos con una capacidad de lectura propia»** (`lib/autorizacion/secciones.ts:352`).
  Analizadores pide `analizadores.ver` desde el 2026-09-23 (`lib/autorizacion/secciones.ts:383-389`).

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
y la respuesta lo dice aparte (`app/api/contactos/[id]/avanzar/route.ts:334-342`).

### 4.2 · Las salidas

El territorio **del contacto** decide el vocabulario, no el rol de quien registra
(`app/api/contactos/[id]/avanzar/route.ts:261-284`).

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
la llama sin argumento en `app/api/contactos/[id]/route.ts:155`). Con una sola candidata viene
elegida y la respuesta es obligatoria; con dos o más, el selector arranca en «No es sobre ninguna de
estas citas» (`components/negocio/Avanzar.jsx:86`, `components/negocio/Avanzar.jsx:337`), y
registrar sin elegir
está permitido (`components/negocio/Avanzar.jsx:168`). Con `no_show` la respuesta la da la salida:
se guarda `false` sin preguntar (`components/negocio/Avanzar.jsx:128-129`).

### 4.4 · El monto

`numeric(12,2)`, nulo cuando la salida no lo pide y **nunca cero por omisión**
(`db/migraciones/011_negocio_closer_setter.sql:394-395`). El servidor lo exige en las salidas que lo
piden, lo rechaza negativo y lo guarda como texto con dos decimales para no perder centavos
(`app/api/contactos/[id]/avanzar/route.ts:404-413`). No hay columna de moneda en `negocio.resultados`.

### 4.5 · Las cifras

Contra producción; cada columna con su fecha.

| hecho | tabla | 2026-09-16 | 2026-09-28 | 2026-10-18 |
|---|---|---|---|---|
| resultados registrados | `negocio.resultados` | 7 | **7** | **7** |
| — del setter | `rol = 'setter'` | 0 | **0** | **0** |
| — por salida | `salida` | seguimiento 4 · no_show 2 · no_interesa 1 | igual | no se volvió a desglosar |
| — ventas, acuerdos sin pago y ventas chicas | `salida` | 0 | **0** | **0** |
| — con monto | `monto` | 0 | **0** | **0** |
| — con cita enganchada | `cita_id` | 0 | **0** | **0** |
| — personas que registraron | `registrado_por` | 2 | 2 | 2 |
| — primero y último | `creado_el` | 2026-08-30 · 2026-09-09 | igual | último, 2026-09-09 |
| citas con asistencia | `negocio.citas.asistio` | 0 de 321 | **0 de 333** | **0 de 368** |
| notas escritas desde la plataforma | `negocio.notas`, `origen = 'plataforma'` | no medido | 4, la última del 2026-09-07 | 4 |
| recordatorios | `negocio.tareas` | no medido | 4 (1 cerrado), el último del 2026-09-07 | 4, el último del 2026-09-07 |
| mensajes enviados desde el chat de la aplicación | `negocio.mensajes`, `origen = 'propio'` | no medido | **2**, el último del 2026-09-07 | **2** |
| sellos del setter | `contactos.sello_setter_id` | no medido | 0 de 594 | 0 de 624 |
| porcentajes de comisión | `negocio.comisiones` | 3 de closer al 10 %, meta nula | igual; **0 filas de setter** | 3 de closer, meta nula en las 3, 0 de setter |
| Briefs generados | `negocio.briefs_del_closer` | — | — | **0** |

La última escritura de una persona en cualquiera de estas tablas sigue siendo del **2026-09-09** (2026-10-18). Cuántas
veces se abrió Avanzar sin registrar **no se puede saber**: la clave de intento nace con cada
apertura pero sólo se guarda al registrar (`components/negocio/Avanzar.jsx:90-107`).

### 4.6 · La cartera y el calendario

- **Contactos:** 624 el 2026-10-18 —306 del territorio closer, 282 del setter y 36 sin territorio—; eran 594 el
  2026-09-28 (287, 282 y 25) y 585 el 2026-09-16. Con etapa escrita por un Avanzar, **6**, los mismos desde
  septiembre. Altas en el CRM en los últimos 7 días: 1 (eran 3 el 2026-09-28).
- **Citas:** 368 el 2026-10-18, del 2026-08-12 al 2026-10-20, con 1 por ocurrir; la última creada, del 2026-10-17.
  Eran 333 el 2026-09-28 y 321 el 2026-09-16. Estado del calendario el 2026-10-18: `cancelled` 179, `confirmed` 166,
  `noshow` 20 y **`showed` 3** —las tres de citas desde el 2026-09-28—; el 2026-09-28 eran 166, 152, 15 y ninguna.
  **El calendario marca hoy tres asistencias y la aplicación ninguna**: `showed` es del CRM y no se suma con
  `asistio` (regla 3). Los cambios de estado a `noshow` que la tabla registraba el 2026-09-28 eran 12, todos de
  `confirmed`, entre el 2026-09-15 y el 2026-09-18; no se volvieron a medir.
- **Pipeline del closer** (2026-09-28, no se volvió a calcular), todo el territorio y sin congelados, recalculado a mano en SQL con la regla
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

### 5.2 · Desde que existe la pregunta: quince citas, cero registros (38 el 2026-10-18)

**Re-medido el 2026-10-18:** desde la `049` ocurrieron **38 citas cerrables** y **0 resultados**; 11 caen hoy dentro
de los 14 días que Avanzar ofrece. De las 38, 22 son del 2026-09-28 en adelante. Cómo se reparten entre los closers
no se volvió a medir. Lo que sigue es del 2026-09-28:

Entre el 2026-09-14 21:49 UTC y las 18 h UTC del corte hubo **28 citas alcanzables que ya
ocurrieron: 13 canceladas y 15 cerrables** (a las 23:58, las ofrecibles eran 16; § 5.8). Las 15
caen todavía dentro de los 14 días que Avanzar ofrece. Resultados registrados en ese lapso: **0**.
De las 15, **11 son del único closer que usó la aplicación** después de la `049` y 4 de los otros
dos; ninguna quedó sin closer.

### 5.3 · Dos de los tres closers no volvieron a entrar

**Re-medido el 2026-10-18:** desde el 2026-09-28, **uno** de los tres closers designados inició sesión (25 veces, la
última el 2026-10-15), y en toda la organización iniciaron sesión **dos personas**. Los otros dos closers no entraron.
Lo que sigue es del 2026-09-28:

De los tres closers, **uno** inició sesión después de la `049` (24 inicios hasta las 18:03 UTC del
corte y 25 a las 00:20 del 29, en `identidad.auditoria_accesos`), y es también el único con una
sesión que siguió viva después del 2026-09-21. Los otros dos no iniciaron sesión: la última sesión de
uno venció el 2026-09-14 a las 20:19 UTC, antes de la `049`, y la del otro el 2026-09-21 a las 14:58
UTC, sin renovarse. La medición tiene un punto ciego que hay que decir: la sesión se renueva por
siete días sólo cuando le queda menos de uno (`lib/autorizacion/sesion.ts:458-459`), así que un uso
aislado del segundo entre el 14 y el 20 de septiembre podría no haber dejado rastro. **No
verificado** con un registro de uso por pantalla, porque no hay.

Así que son dos causas y no una: dos closers ausentes (4 citas) y uno presente que tampoco registró
(11 citas). Las 4 de los ausentes son, las cuatro, del closer vinculado al usuario del CRM que la
empresa tiene como cuenta del agente de IA (§ 2.4); el otro ausente no tenía ninguna.

### 5.4 · El trabajo pasa en el CRM, y deja rastros que no llegan acá

- **El chat.** Salieron 4.645 mensajes por la ingesta del CRM en toda la historia —233 desde la
  `049`— hasta las 18:03 UTC del corte (4.647 y 235 a las 00:15 del 29), y **2** desde el
  compositor de la aplicación, el último el 2026-09-07.
- **Una venta, y ahora dos.** El 2026-09-28, un contacto del territorio closer llevaba la etiqueta `venta_ganada` en el
  CRM; el 2026-10-18 son **dos**, y ninguno de los dos tiene un resultado en esta base (0 ventas). El primero, **sin
  ningún resultado ni en esta base ni en la plataforma anterior** (medido el 2026-09-28), y con dos citas cerrables dentro de
  la ventana de 14 días, la más reciente del 2026-09-28. Es una venta que existe en el CRM y no en
  `negocio.resultados`. El Pipeline la dibuja en «Ganado», porque sin etapa escrita clasifica por
  etiqueta (`lib/negocio/etapas.ts:258-259`, `lib/negocio/pipeline.ts:119`), mientras el Inicio y
  Sales, que leen resultados (`lib/negocio/dineroDelMes.ts:138-157`), dicen cero ventas. Dos pantallas
  del mismo producto, el mismo contacto, dos respuestas.
- **La llamada.** **63 contactos** el 2026-09-28 (65 el 2026-10-18), todos del territorio closer (de 287), llevan
  `bot_desactivado_postcall`, que el sistema lee como «ya tuvo
  la llamada de cierre» (`lib/ghl/contrato.ts:117`) y afirma que la pone la aplicación
  (`lib/ghl/contrato.ts:98-100`). **56 de esos 63 no tienen ningún Avanzar en ninguna de las dos
  plataformas**: la plataforma anterior (`public.closer_avances`, que no es nuestra) tenía 26
  registros, todos entre el 2026-08-09 y el 2026-08-13, y ninguno de venta. **Esa tabla ya no existe**: la
  plataforma anterior se borró de producción el 2026-10-13, con respaldo fuera de la base, y el 2026-10-18 no queda
  ninguna tabla `closer_*` en `public`. La comparación con la plataforma anterior ya no se puede repetir contra
  producción. Quién puso esas
  etiquetas —un flujo del CRM o una persona— **no está verificado**.
- **La grabación.** Analizadores tiene **38 llamadas de venta (HT) procesadas**, del 2026-07-31 al
  2026-09-24, 2 de ellas después de la `049`; su análisis dice `NO_CERRADA` en 36 e `INDETERMINADO` en
  2. Prueba que las reuniones ocurren. Desde AG11 cada objeción de esas llamadas lleva su categoría (89 clasificadas
  el 2026-10-18), y el Brief y la Reunión las leen; ninguna llega a `citas.asistio`. No llega a `citas.asistio`: `negocio.analizador_llamadas` no
  tiene columna que la ate a una cita ni a un contacto de `negocio`.

### 5.5 · El producto no insiste

Cuatro decisiones hacen que no registrar sea el camino de menor esfuerzo. Ninguna rompe una prueba. Desde el
2026-10-07 el producto, al menos, **lo dice**: la cabecera del Closer cuenta las citas que esperan registro con la
misma ventana de Avanzar (§ 2.8). Las cuatro siguen en pie:

1. **No hay cola de «registro pendiente».** El comentario de la cabecera cuenta, pero no lista ni abre. Mi Día tiene cinco colas —urgentes, agenda, buzón,
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
   (`lib/negocio/citasAlcanzables.ts:243-245`), así que afirmar que acusa sobre la misma población que
   Avanzar ofrece (`lib/negocio/cadenaDeCierre.ts:39-44`, `lib/negocio/citasAlcanzables.ts:235-238`)
   es cierto para el resultado y falso para la asistencia.
3. **Con dos citas o más, la respuesta por omisión es «ninguna».** Ver § 4.3.
4. **El closer nunca ve su show rate.** Aunque registre, su Inicio dice «—» (§ 3.1).

### 5.6 · Lo que eso deja sin dato aguas abajo

**Conversation.** La tasa de asistencia cuenta sólo citas con `asistio is not null`
(`lib/negocio/indicadoresDeCitas.ts:385-399`) y calla por debajo de 10
(`lib/negocio/indicadoresDeCitas.ts:473-476`). Medido el 2026-09-28 a las 18 h UTC con ese mismo
filtro —alcanzables, sin descartados, ya ocurridas—: **106 citas a 30 días y 0 con asistencia**; 17 a
14 días, 142 en «completo». La pantalla dibuja «—» y «asistencia · 0 de 106 cerradas»
(`components/conversation/PanelDeConversation.jsx:620-625@6f3bdb5`) y el eslabón «Se presentaron» con «nadie
lo registró» (`components/conversation/PanelDeConversation.jsx:650-656@6f3bdb5`). **No es un 0 %: es un
guion**, y es lo correcto.

Los tres conteos ruedan con el reloj, porque la ventana la calcula la base con `now()`
(`lib/negocio/indicadoresDeCitas.ts:416-417`). Re-medidos con el mismo filtro a las 23:58 UTC dieron
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
| 30 días, 2026-09-28 18 h UTC (la que abre la pantalla, `app/api/sales/route.ts:84-110@48ee16d`) | 277 | 139 | 46 | **3** | **0** |
| 30 días, re-medida entre las 23:58 UTC del 28 y las 00:02 UTC del 29 | 276 | 139 | 47 | **3** | **0** |

**Re-medida el 2026-10-18 a 30 días**, con la consulta de [11-EXECUTIVE.md](11-EXECUTIVE.md) de la foto anterior:
**25 entraron → 19 agendaron → 12 con la cita ya ocurrida**; los dos últimos eslabones valen 0, deducido: los 7
resultados son del 2026-09-09 o antes, fuera de la ventana. La cohorte de 30 días se achicó de 277 a 25 porque desde
el 2026-09-14 casi no entran contactos (28 a 30 días el 2026-10-16, 25 el 2026-10-18).

En una semana entraron 4 contactos, 3 agendaron, 2 contactos más tuvieron su cita ya ocurrida (3 a
las 23:58), y el eslabón de registro no se movió. Entre la primera medición de 30 días y la segunda la cohorte bajó de 277 a 276, porque la
ventana rueda con `now()` (`lib/negocio/cadenaDeCierre.ts:169`), y un contacto más tuvo su cita ya
ocurrida; los dos últimos eslabones siguen en 3 y 0. La columna «Plantón» de Sales sale del
calendario y no de Avanzar (`lib/negocio/citasAlcanzables.ts:106-111`), así que es la única de
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
-- 2026-10-18 15:4x UTC: 7 · 0 · 0 · 0 · 11
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
son dos fuentes y sólo una es nuestra (`lib/negocio/citasAlcanzables.ts:106-111`).

**4 · `asistio` no entra en el `do update` del barrido.** Es la única columna de `citas` que no viene
del CRM; si entrara, cada pasada horaria la volvería a nulo sin error
(`lib/negocio/citas.ts:419-424`).

**5 · Venta, acuerdo sin pago y venta chica son tres hechos.** Cada catálogo manda sus salidas a sus
columnas (`lib/negocio/etapas.ts:76-94`), y lo cobrado suma sólo `venta`
(`lib/negocio/dineroDelMes.ts:143-154`).

**6 · Un cero medido no es un cero sin medir.** Con resultados en el mes y ninguna venta, «0»; sin
ningún resultado, «—» con su motivo (`lib/negocio/dineroDelMes.ts:159-189`). En septiembre de 2026
(hora de Lima) hay 6 resultados, de dos de los tres closers: la vista de empresa y esos dos ven **0
ventas medidas**, y el tercero ve «—». Octubre empezó sin registros —ninguno al 2026-10-18—, así que este mes los
tres y la vista de empresa ven «—» (deducido de la regla, no visto en pantalla).

**7 · Una clave por apertura del panel.** Reintentar después de un corte no duplica resultado, nota,
tarea ni comisión (`app/api/contactos/[id]/avanzar/route.ts:158-173`,
`components/negocio/Avanzar.jsx:90-107`).

**8 · El alcance no es un permiso.** Vive en la consulta, y el closer sin vincular ve todo, porque
mostrarle cero le diría «no hay trabajo» (`lib/negocio/alcanceDelCloser.ts:23-38`). La comisión es
de una persona o de nadie, nunca la suma de tres (`app/api/closer/mi-dia/route.ts:107-117`).

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

**Tres avisos y ningún registro.** La cabecera, la Reunión y las marcas del Brief llegaron entre el 5 y el 7 de
octubre; las citas cerrables desde la `049` pasaron de 15 a 38 y los resultados siguen en 7 (§ 5.2). Agregar más
avisos no es la palanca: el closer que entra no registra, y dos de los tres no entran (§ 5.3).

**Dos cifras de citas sin registrar que no coinciden.** La cabecera cuenta citas a 14 días con el alcance de quien
mira; la Reunión, contactos de la empresa a 30 días (§ 2.8). Las dos son ciertas; quien las compare sin leer de dónde
sale cada una va a creer que una está mal.

**Un `showed` del calendario que tienta.** Hoy el CRM marca tres asistencias y `asistio` ninguna (§ 4.6). Sumarlas
sería mezclar lo que dijo el calendario con lo que dijo el closer (regla 3).

**Un Brief que nadie probó en producción.** Cero generados (§ 2.6): el primer closer que abra una cita va a ser
también la primera prueba real, con la llave de la empresa.

**Confiar en los comentarios.** Las cinco familias de § 3.4 describen un sistema con un closer por
empresa, siete salidas, sin Avanzar, sin cron de contactos y con sólo dos capacidades de lectura
propias. Quien los lea para decidir, decide sobre otro sistema.

**El nombre real en el código.** § 3.6. En un repositorio público, un comentario es publicación.

**Lo que sí se puede afirmar hoy, y lo que no.** Sí: que el instrumento existe y funciona —la suite
lo cubre (`pruebas/base/26-avanzar.test.ts`) y no se corrió para este informe—, que hay 7 resultados
y 0 ventas registradas, que el calendario marcó 20 plantones y 3 asistencias (2026-10-18) y que dos ventas están en el
CRM sin estar acá. No: ninguna tasa de asistencia ni de cierre, ninguna cifra del setter, y por qué dos closers
dejaron de entrar. El cuello de botella no es técnico, pero tampoco es sólo de adopción: el trabajo
se hace en el CRM y en tl;dv, y la aplicación no retiene la cita que quedó sin cerrar.
