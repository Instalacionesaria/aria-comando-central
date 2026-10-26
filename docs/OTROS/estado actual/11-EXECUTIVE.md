# Executive Intelligence: hoy, el Inicio y el cerebro

> Corte: **2026-10-18**, con el código de producción en `972972e`. En local hay ocho commits más
> (`693a383..dc84cb2`, el modelo de datos multiempresa, Fase 0, migraciones `079` a `084`) construidos y **sin
> subir**: lo que de ellos toca esta sección va dicho como «construido en local, sin subir». Las cifras de producción
> se midieron el **2026-10-18** a partir de las 15:39 UTC con `scripts/supabase.mjs leer` (sólo lectura, sólo
> conteos y agregados, con el OK del usuario); las que vienen de la foto anterior llevan su fecha, el 2026-09-28. La
> pantalla no se abrió con sesión para esta foto: lo que «dibuja» sale de leer el código. Cada afirmación lleva su
> `archivo:línea`; una cita fijada a un commit (`archivo:N@sha`) se lee en esa versión. Para ubicar lo nombrado, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La foto anterior —la maqueta del Executive con sus 179
> literales, comparada cifra por cifra contra la base del 2026-09-28— se lee con
> `git show fefffa1:"docs/OTROS/estado actual/11-EXECUTIVE.md"`.

**La maqueta se fue el 2026-10-01; desde el 2026-10-05 hay un cerebro de verdad, y casi nadie le habla.** La sección
conserva su clave `executive` y se llama «Inicio» (`lib/autorizacion/secciones.ts:236-241`): la mascota, el saludo,
una caja para preguntarle al cerebro y, debajo, la Reunión de hoy (`components/views/ExecutiveView.jsx:116-222`). El
cerebro es un modelo con herramientas de sólo lectura que llaman a las mismas funciones que las pantallas, y el
servidor quita toda cifra que no esté en lo que leyó (`lib/agentes/executive/respuesta.ts:1-22`). Medido el
2026-10-18: **12 conversaciones, todas de una sola persona y todas desde el Inicio, con 20 preguntas** (19
respondidas y 1 fallida), la última el 2026-10-12; ninguna desde la caja del pie de un departamento y ninguna desde un
tema de la Reunión. La Reunión de hoy corre cada mañana para 11 empresas y **sólo una tiene temas** (13 días de 13).
Ya no hay cifras inventadas: lo que falta es lo que faltaba antes —asistencia y ventas registradas— y ahora el
Inicio lo dice.

> **Desde el corte del 2026-09-28**
>
> - **2026-10-01 · `3c07cc7`** — E0 de la nueva estructura: el plan (`docs/OTROS/nueva-estructura/`), con el Inicio
>   honesto en `04-EL-INICIO.md`.
> - **2026-10-01 · `36bc3bb`** — E6: las citas de los documentos a la maqueta, fijadas a `@c4cf2a8`.
> - **2026-10-01 · `4e9a242`** — E7: el Inicio honesto. Se van los seis módulos de la maqueta (`executive`,
>   `executive-panel`, `executive-chat`, `leads-group`, `datepicker`, `period-controls`), el panel lateral y la barra
>   «Pregúntale a Executive» (`lib/aios/index.js:7-13`). Queda un solo módulo imperativo, el armazón
>   (`lib/aios/index.js:30`).
> - **2026-10-01 y 02 · `4742d74`, `b532a78`, `40f699a`, `624a941`** — E8 a E11: los cinco departamentos, la
>   navegación en React, la barra lateral nueva y la cabecera de cada departamento. El Inicio queda fuera de los
>   departamentos (`lib/autorizacion/departamentos.ts:127-130`).
> - **2026-10-02 · `2c6e2a0`** — el saludo pregunta por la empresa de la sesión (`components/views/ExecutiveView.jsx:60-62`).
> - **2026-10-02 · `e5499d9`..`522c9bc`** — segunda edición F0 a F4: CONVERSACIONES y la caja del pie, como
>   «Próximamente».
> - **2026-10-04 · `db6bc34`** — AG0 de los agentes: el plan (`docs/OTROS/agentes/`), con las decisiones `D-01` a
>   `D-33`.
> - **2026-10-04 · `ce8ff6e`** — AG5: el servidor del cerebro (`app/api/executive/route.ts`), la migración `071` y la
>   capacidad `cerebro.usar`. La bandera `sinOperacionesTodavia` de `executive` baja con esa ruta
>   (`lib/autorizacion/secciones.ts:239`).
> - **2026-10-05 · `13723a0`** — AG6: las herramientas de las demás secciones y una ruta de caja por sección
>   (`app/api/<carpeta>/cerebro/route.ts`), con lo común en `lib/agentes/executive/caja.ts`.
> - **2026-10-05 · `5f15c01`, `b6eed36`, `854a3da`** — AG7: el cerebro en pantalla (el chat del Inicio, la caja del
>   pie con su panel, CONVERSACIONES y los topes en Ajustes) y dos evaluaciones reales.
> - **2026-10-05 y 06 · `d715b2a`..`28d6954`** — AG8 a AG14: las señales (`072`), los detectores de Acquisition,
>   Creative, Conversation y Conversion, las objeciones clasificadas (`073`) y el Brief del closer (`074`).
> - **2026-10-06 · `d8effd3`, `9920648`, `120957b`, `fe727e5`** — AG15: la Reunión de hoy (`075`), en el Inicio, con
>   la redacción del modelo, y el comentario de la cabecera.
> - **2026-10-06 · `9542133`, `75228c5`** — AG16: el cierre del plan de los agentes.
> - **2026-10-07 a 11** — `d0e711c` (la redacción de la Reunión sin la etiqueta en el pedido), `2f12fad` (el
>   comentario de la cabecera en Sales) y las rutas y herramientas del cerebro de los fronts nuevos: `b2dcdf5`
>   (Conversion), `a39a732` (Sales), `6f3bdb5` (Conversation), `1971ab2` (Creative).
> - **2026-10-12 · `f59cf44`** — CONVERSACIONES: borrar un hilo desde la barra, con confirmación.
> - **2026-10-16 · `d424d8b`, `ce5ed91`, `8ad73f3`** — construido en local, sin subir: `conOrganizacion` pone
>   `app.cuentas = '*'` y la `082`/`083` llevan la cuenta a 39 tablas de negocio, entre ellas `reuniones_del_dia`,
>   `senales`, `planes_de_accion` y `uso_de_ia` (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:131`). Las
>   tablas de las conversaciones del cerebro no están en esa lista.

---

## 1 · Qué pide el documento

El documento funcional (`CC_Arquitectura_Funcional.md`, fuera del repositorio) **no especifica Executive**: lo lista
como pendiente en el encabezado (línea 8) y en el § 17 (línea 1114). Lo que hay es una visión general:

- **§ 6 (líneas 292-346).** «Será la puerta de entrada principal del usuario» (línea 294). Once responsabilidades,
  la primera *«recibir conclusiones de todos los departamentos»*; siete piezas de experiencia (Executive Briefing,
  Ask Executive, Priorities, Decisions, Evidence, Initiatives y System Improvement); dos modos de consulta, negocio
  y sistema, y no proponer cambios internos sin evidencia (línea 344).
- **§ 2, los principios.** Valida lo que toque presupuesto o varios departamentos (§ 2.3); un departamento consume
  las conclusiones de otro y **no recalcula** (§ 2.4, línea 98); toda recomendación dice qué datos la respaldan, qué
  confianza tiene y qué dato falta (§ 2.6, líneas 106-114).
- **§ 7 y § 14.** Iniciativas con tareas, siete estados y medición de impacto, distinguiendo correlación de
  causalidad (línea 1032).
- **§ 16.2.** *«Antes de construir Business, Creative y Executive Intelligence, debe validarse la trazabilidad»*
  hasta la venta reportada (línea 1078).

Lo que pasó desde el corte es que el producto escribió su propia especificación encima de ésa: los documentos del
equipo del 2026-09-30 y el lienzo «Departamentos por dentro» (`docs/OTROS/nueva-estructura/00-MAPA.md:9-21`), y las
decisiones del usuario del 2026-10-03 y 04 (`docs/OTROS/agentes/00-MAPA.md:44-77`). Las que gobiernan esta sección:

- **`D-04`**: un solo modelo con herramientas de sólo lectura sobre `lib/negocio`, que además **lee las señales
  guardadas**, y sólo ofrece lo de las pestañas que la persona ve (`docs/OTROS/agentes/00-MAPA.md:48`).
- **`D-12` y `D-13`**: la caja del pie de cada departamento la contesta el cerebro; la Reunión de hoy sale de señales
  y reglas medibles, y el modelo sólo ordena y redacta (`docs/OTROS/agentes/00-MAPA.md:56-57`).
- **`D-16` y `D-17`**: topes de 50 preguntas por persona y 300 por empresa por día; capacidad `cerebro.usar`;
  Conversation sólo con `auditor.ver`; bajo delegación el cerebro se apaga (`docs/OTROS/agentes/00-MAPA.md:60-61`).
- **`D-25`**: fuera de la v1 quedan Iniciativas, Decisiones, Mejora del sistema y el modo sistema
  (`docs/OTROS/agentes/00-MAPA.md:69`). O sea: de las siete piezas del § 6.2 hay dos, Ask Executive (el chat) y un
  Executive Briefing (la Reunión de hoy).

Lo que cada departamento dejó escrito sobre lo que le entrega a Executive sigue en
`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:48`, `docs/creative/07-LO-QUE-ENTREGA-Y-RECIBE.md:145-152`,
`docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:137-143`, `docs/sales/08-LO-QUE-ENTREGA-Y-RECIBE.md:118-127` y
`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:157-329`. Esos contratos se escribieron contra la maqueta; el que
manda hoy es la tabla común de señales (§ 4).

---

## 2 · Qué hay hoy en pantalla

### 2.1 · La sección

`executive`, nombre «Inicio», capacidad `tablero.ver`, sin la bandera (`lib/autorizacion/secciones.ts:236-241`). No
es de ningún departamento: la barra la abre con «Nueva conversación» (`lib/autorizacion/departamentos.ts:120-130`).
Los 15 usuarios activos de producción tienen `tablero.ver` y `cerebro.usar` por su rol (medido el 2026-10-18); quién
ve la pestaña entre los de rol restringido no se volvió a medir.

**El comentario de cabecera de `secciones.ts` mintió del 2026-10-08 al 2026-10-18.** Decía que la lista
`SIN_OPERACIONES_TODAVIA` está vacía desde que `executive` bajó la bandera (`lib/autorizacion/secciones.ts:17-18`),
pero Client OS entró ese día con la bandera puesta (`lib/autorizacion/secciones.ts:486-498`), y la prueba que la mira
espera exactamente `['clientos']` (`pruebas/codigo/90-fundaciones.test.ts:1266`). **Cerrado el 2026-10-18
(`65669f4`)**: hoy dice que queda sólo `clientos`, que es externa, y lo mismo el de `executive` (`:230`).

### 2.2 · El Inicio

`components/views/ExecutiveView.jsx`, 223 líneas. Sin conversación abierta: la mascota, el saludo con la hora de la
**empresa** y no la del navegador (`components/views/ExecutiveView.jsx:56-58`), «¿Qué quieres saber de {empresa}?»
(`components/views/ExecutiveView.jsx:124-127`), la caja y la Reunión de hoy debajo
(`components/views/ExecutiveView.jsx:212-219`). Con una conversación, los turnos ocupan el lugar del saludo
(`components/views/ExecutiveView.jsx:119-120`).

- **La caja** se habilita sólo con el estado `listo` (`components/views/ExecutiveView.jsx:101-103`,
  `components/views/ExecutiveView.jsx:143`); con otro dice por qué, con el mismo texto con que el servidor rechazaría
  la pregunta (`components/views/ExecutiveView.jsx:199-211`). Sin `cerebro.usar` no se dibuja
  (`components/views/ExecutiveView.jsx:106-107`). Enter pregunta y Shift+Enter salta de línea
  (`components/views/ExecutiveView.jsx:152-158`).
- **Borrar y empezar de nuevo**: «Borrar esta conversación» pregunta antes («Sí, borrarla»), y «Nueva conversación»
  (`components/views/ExecutiveView.jsx:161-189`).
- **Lo que no se dibuja**: «@ agente», que abriría las herramientas que crean y espera la rama de ICP & Oferta, y el
  selector de áreas y el «+» (`components/views/ExecutiveView.jsx:28-32`).

### 2.3 · El estado del cerebro

Una unión, nunca un booleano (`lib/agentes/executive/estado.ts:8-20`): `listo`, `sin_permiso`, `delegacion` (está
mirando otra empresa), `sin_datos` (ninguna pestaña que ve tiene herramientas), `sin_llave`, `llave_ilegible` y
`tope`, en ese orden de precedencia (`lib/agentes/executive/estado.ts:31-39`). La llave es la de IA de cada empresa:
en producción la tienen **5 de las 13 organizaciones** (medido el 2026-10-18).

### 2.4 · La Reunión de hoy

Una cinta con la hora de la pasada y hasta tres tarjetas, cada una con su etiqueta, su texto y su origen
(`components/cerebro/ReunionDeHoy.jsx:26-57`); si la pasada corrió y no hay nada para esa persona, lo dice
(`components/cerebro/ReunionDeHoy.jsx:32-33`). Los temas se filtran por las secciones que la persona ve **y recién
después** se cortan en tres (`lib/agentes/reunion/temas.ts:246-250`). Tocar una tarjeta abre el tema como
conversación (`components/cerebro/ReunionDeHoy.jsx:46-52`), sin llamar al modelo y sin contar para el tope
(`app/api/executive/reunion/route.ts:7-13`); sin `cerebro.usar` o bajo delegación se leen y no se abren
(`components/views/ExecutiveView.jsx:215-216`). La barra lateral cuenta los temas de hoy
(`components/views/ExecutiveView.jsx:71-74`, `components/cerebro/ReunionDeLaBarra.jsx:25`).

### 2.5 · Lo que el cerebro tiene fuera del Inicio

- **CONVERSACIONES**, en la barra: los hilos propios de cualquier origen, del más reciente al más viejo; no le pide
  nada al servidor, lee lo que publica el chat del Inicio, y desde el 2026-10-12 cada hilo se borra también desde
  ahí, con confirmación (`components/cerebro/ConversacionesDeLaBarra.jsx:3-14`).
- **La caja del pie** de cada departamento, «Pregúntale al cerebro sobre …», que pregunta a la ruta de la sección
  abierta con el período que está mirando la pantalla, y contesta en un panel que sube
  (`components/ConsultaAlCerebro.jsx:3-25`, `components/cerebro/PanelDelCerebro.jsx:3-11`). En el teléfono no se
  dibuja (`components/ConsultaAlCerebro.jsx:24-25`). Va montada después de `<main>` en el armazón
  (`components/CommandCenter.jsx:118-120`).
- **El comentario de la cabecera** de cada departamento, que sale de reglas sin modelo (`D-12`); en Closer, las citas
  sin registrar de quien mira (`lib/agentes/cabecera.ts:16-23`). Ver [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md).

---

## 3 · Lo que se fue con la maqueta, y lo que quedó de ella

**Nada de lo que el Inicio dibuja está escrito a mano.** El comentario del archivo lo dice y el código lo cumple: lo
que se dibuja de una respuesta lo devolvió el servidor ya validado (`components/views/ExecutiveView.jsx:16-19`), y
la Reunión no trae una cifra ni un tema propios (`components/cerebro/ReunionDeHoy.jsx:6-8`).

Lo que dibujaba la maqueta hasta el 2026-10-01, para quien la busque: un mapa del equipo con puntos de estado
(`components/views/ExecutiveView.jsx:232-305@c4cf2a8`), un funnel de seis etapas de cuatro departamentos que no era un
embudo (`lib/aios/executive.js:22-29@c4cf2a8`), el objetivo del mes «11 / 30 ventas»
(`lib/aios/executive.js:64-85@c4cf2a8`), la «Reunión de hoy» y los «Cambios en curso» con cifras inventadas
(`lib/aios/executive-panel.js:11-39@c4cf2a8`), un chat que elegía entre cuatro respuestas fijas por palabras sueltas
(`lib/aios/executive-chat.js:30-39@c4cf2a8`, `lib/aios/executive-chat.js:77-83@c4cf2a8`) y un cajón que fabricaba
catorce contactos (`lib/aios/leads-group.js:14-37@c4cf2a8`). La foto anterior contó 179 literales numéricos; hoy no
queda ninguno, y la compuerta de paridad que comparaba esos textos contra el prototipo se quedó sin pasos de Executive
(`scripts/paridad.mjs:149-153`, `scripts/paridad.mjs:186-187`).

Lo que **sí** queda del prototipo: la clave `executive` en rutas, tablas y carpetas —en pantalla se dice «el
cerebro»— (`docs/OTROS/agentes/00-MAPA.md:134-135`), y el armazón imperativo de `lib/aios/shell.js`, que el Inicio usa
para ir a Ajustes (`components/views/ExecutiveView.jsx:40`, `components/views/ExecutiveView.jsx:205`).

---

## 4 · De dónde sale cada cosa

### 4.1 · El cerebro

**La ruta del Inicio** (`app/api/executive/route.ts`): el `GET` pide `tablero.ver` y devuelve el estado, los hilos
propios y, sin `?hilo=`, la Reunión como la ve esa persona (`app/api/executive/route.ts:57-76`); el `POST` pregunta y
el `DELETE` borra un hilo propio, los dos con `cerebro.usar` (`app/api/executive/route.ts:78-100`). Un hilo ajeno da
404, como uno que no existe (`app/api/executive/route.ts:91-98`). `maxDuration` 300
(`app/api/executive/route.ts:54-55`). Hay once rutas más, una por sección, con la misma plantilla
(`docs/OTROS/agentes/03-EL-CEREBRO.md:36-38`).

**Una pregunta**: hasta 6 rondas de modelo con un techo de 12.000 tokens cada una
(`lib/agentes/executive/preguntar.ts:44-48`), con `claude-sonnet-5-5` (`lib/agentes/modelos.ts:36-37`) y esfuerzo
`medium` (`lib/agentes/executive/preguntar.ts:233-245`). Las instrucciones son de tú neutro y repiten las reglas de
esta sección: consume y no recalcula, el piso de 10, el dinero es del mes calendario y es venta reportada, las causas
son hipótesis (`lib/agentes/executive/prompt.ts:43-53`).

**Las herramientas**: **36** en el catálogo, contadas el 2026-10-18 (Acquisition 1, Creative 4, Conversion 3,
Conversation 6, Sales 7, Leads Portal 1, Setter 3, Closer 4, Tools 2, ICP & Oferta 1, la plataforma 2, Analizadores
2), reunidas en `lib/agentes/executive/herramientas.ts:43-56`. Cada una llama a la misma función, con los mismos
argumentos, que la ruta de su pantalla, y proyecta por lista blanca (`lib/agentes/executive/herramientas.ts:8-15`).
**Sólo se ofrecen las de las secciones que la persona ve** (`lib/agentes/executive/herramientas.ts:63-79`): así se
cumple que lo de Conversation sea sólo para quien tiene `auditor.ver`, que era la regla 6 de la foto anterior. Viajan
sin `strict`, porque el proveedor admite 20 estrictas y el catálogo pasa de 30
(`lib/agentes/executive/herramientas.ts:81-89`).

**La validación**: cada cifra cita su evidencia y el campo exacto; la que no aparece en ese campo se quita, la
recomendación con un número sin respaldo se quita, y la conclusión con un número sin respaldo se marca y baja la
confianza (`lib/agentes/executive/respuesta.ts:5-20`).

**Los topes**: 50 preguntas por persona y 300 por empresa por día, ajustables por el Admin
(`lib/agentes/executive/topes.ts:32-33`), contados en una tabla aparte bajo candado; una reserva vence a los diez
minutos (`lib/agentes/executive/topes.ts:35-36`).

**Las tablas** (migración `071`, en producción desde el 2026-10-05): `conversaciones_del_executive`, de quien las
escribió, con su origen —Inicio, pie o Reunión— (`db/migraciones/071_las_conversaciones_del_cerebro.sql:41-56`);
`mensajes_del_executive`, con la respuesta validada y la evidencia como identificadores y cifras
(`db/migraciones/071_las_conversaciones_del_cerebro.sql:62-91`); `preguntas_del_executive`, sin texto, para el tope
(`db/migraciones/071_las_conversaciones_del_cerebro.sql:94-106`).

### 4.2 · La Reunión de hoy

**Dos fuentes, y ninguna es el modelo** (`lib/agentes/reunion/temas.ts:5-17`):

1. Las señales que requieren validación ejecutiva de los cuatro detectores, leídas con la misma función que sus
   pantallas (`lib/agentes/reunion/temas.ts:80-85`).
2. Cinco reglas medibles en el catálogo de umbrales: sin entrega, caída de la entrada, citas sin registrar, objeción
   frecuente y llamadas sin vínculo (`lib/agentes/reunion/reglas.ts:7-13`), cada una con su piso
   (`lib/agentes/reunion/temas.ts:146-236`).

La calcula la tarea `senales` del cron, al minuto 23 de cada hora, para las empresas a las que les toca su mañana
(`lib/negocio/barrido.ts:371-379`); la guarda por empresa y día local en `negocio.reuniones_del_dia`
(`db/migraciones/075_la_reunion_de_hoy.sql:18-26`), y con llave el modelo la redacta: la frase que no pasa se descarta
y el tema conserva su plantilla (`lib/agentes/reunion/redaccion.ts:7-20`).

### 4.3 · Lo medido el 2026-10-18

| Hecho | Cifra |
|---|---|
| Conversaciones con el cerebro | **12**, de **1** persona, en 1 empresa; las 12 desde el Inicio, 0 desde la caja del pie, 0 desde la Reunión; la primera del 2026-10-05 y la última actualizada el 2026-10-12 |
| Preguntas | **20**: 19 respondidas y 1 fallida (la del 2026-10-05); mensajes, 39 |
| Llamadas del cerebro al modelo (`uso_de_ia`, agente `executive`) | 38, con 118.670 tokens de entrada y 16.268 de salida; la última del 2026-10-12 |
| Filas de topes | 1 empresa; la fila la crea la primera pregunta (`lib/agentes/executive/topes.ts:53-54`), así que no dice si un Admin los cambió, y eso no se miró |
| Reuniones guardadas | **143**, de 11 empresas, del 2026-10-06 al 2026-10-18; **13 con temas, todas de la misma empresa** y las 13 redactadas; las otras 130 vacías |
| Llamadas de la redacción de la Reunión (`reunion`) | 13 |
| Planes de acción guardados | 1.152 |
| Señales | 30, 13 abiertas |
| Incidentes | 1 en toda la tabla, del cerebro |

Por regla, en los 13 días con temas: el cambio de ruta de Conversion salió los 13 días (30 temas, varios por día),
las citas sin registrar los 13, la concentración de Creative 10, la caída de la entrada 4, la concentración de
Acquisition 2 y la escala por calificado 1. **La objeción frecuente y las
llamadas sin vínculo no salieron nunca.** El 2026-10-18 la Reunión de esa empresa tiene cinco temas: uno de Creative y
el de las citas sin registrar con gravedad media, y tres de Conversion con gravedad informativa; quien ve todo lee los
dos primeros y uno de los de Conversion.

El tema de las citas sin registrar es el hallazgo que la foto anterior decía que «ninguna pantalla le entrega a
Executive»: hoy se lo entrega. Su evidencia, día por día, bajó de **22 de 22** contactos con la cita ocurrida y sin
registrar (2026-10-06) a **14 de 14** (2026-10-12 en adelante): no porque alguien registrara —los resultados siguen
en 7, el último del 2026-09-09—, sino porque la ventana de 30 días rueda y entran menos citas
(`lib/agentes/reunion/temas.ts:188-201`).

---

## 5 · Datos que faltan

**1 · La asistencia y la venta.** Siguen en cero medido: **0 de 368 citas** con la asistencia registrada, **7
resultados** en toda la base, **0 ventas** y **0 montos** (2026-10-18; eran 0 de 333 y 7 el 2026-09-28). Es la
condición previa del § 16.2. Hoy el cerebro tiene con qué decirlo: la herramienta de la economía del mes publica el
retorno y el costo por venta sólo si las dos mitades están enteras, y con cero ventas responde «no hay dato
suficiente» (`lib/negocio/economiaDelNegocio.ts:18-25`). Ver [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md).

**2 · La meta del mes.** `negocio.comisiones.meta_mensual` sigue nula en las **3 de 3** filas (2026-10-18).

**3 · Las señales, para el cerebro.** `D-04` pide que el cerebro lea las señales guardadas, y el diseño tiene la
herramienta `senales_abiertas` (`docs/OTROS/agentes/03-EL-CEREBRO.md:120`). **No está en el catálogo**
(`lib/agentes/executive/herramientas.ts:39-56`): el cerebro no puede contestar «¿qué señales hay abiertas?» aunque la
pantalla de cada departamento las muestre y la Reunión las use.

**4 · Iniciativas, decisiones, cambios en curso.** Fuera de la v1 por `D-25`. No hay tabla.

**5 · La auditoría del agente de voz.** Sigue fuera (`D-23`): el auditor mira sólo los dos agentes de texto
(`lib/auditor/veredicto.ts:52`).

**6 · El día de la empresa.** **11 de las 13 organizaciones** tienen la zona horaria en UTC (medido el 2026-10-18), y
la pasada de la mañana se decide por esa zona. El plan para llevar las ventanas al día local quedó escrito y
postergado, en `docs/OTROS/futuro/el-dia-de-la-empresa.md`.

---

## 6 · Reglas propias

**1 · Consume, no recalcula.** Cada herramienta llama a la misma función que su pantalla
(`lib/agentes/executive/herramientas.ts:8-9`), y la Reunión lee las señales con la función de sus pantallas
(`lib/agentes/reunion/temas.ts:7-9`).

**2 · Una cifra que no está en su evidencia no llega a la persona.** La quita el servidor, no el modelo
(`lib/agentes/executive/respuesta.ts:5-11`).

**3 · Sólo lo de las pestañas que la persona ve**, en las herramientas (`lib/agentes/executive/herramientas.ts:10-13`)
y en los temas de la Reunión (`lib/agentes/reunion/temas.ts:246-250`).

**4 · Bajo delegación el cerebro no responde**, y lo rechaza el servidor, no sólo la pantalla
(`app/api/executive/route.ts:30`, `app/api/executive/reunion/route.ts:28-30`).

**5 · Las conversaciones son de quien las escribió.** Sólo el autor las ve y las borra; un hilo ajeno da 404
(`app/api/executive/route.ts:91-98`).

**6 · El dinero es del mes calendario y es venta reportada**, y debajo de 10 en el denominador no hay porcentaje: las
dos reglas viajan en las instrucciones (`lib/agentes/executive/prompt.ts:49-50`).

---

## 7 · Riesgos

**Un cerebro que casi nadie usa.** Una persona en dos semanas, 20 preguntas, ninguna desde la caja del pie y ninguna
desde un tema de la Reunión (§ 4.3). Las 8 organizaciones de 13 que no tienen llave de IA no pueden usarlo
(§ 2.3). Lo que se construyó para todos está medido sobre una sola cuenta.

**La Reunión vacía en diez de once empresas.** Corre todos los días para 11 y tiene temas en una (§ 4.3): en las demás
el Inicio dice cada mañana que la pasada no encontró nada. Es cierto —no tienen datos—, pero es la pantalla de
entrada.

**Un tema que no baja aunque nadie haga nada, y otro que baja sin que nadie haga nada.** Las citas sin registrar de la
Reunión cuentan contactos de la empresa a 30 días; las de la cabecera de Closer, citas del alcance de quien mira a 14
días (`lib/agentes/cabecera.ts:18-22`). Las dos son ciertas y no coinciden, y la de la Reunión bajó de 22 a 14 sólo
porque la ventana rodó (§ 4.3).

**El cerebro no lee las señales** (§ 5, punto 3), aunque `D-04` lo pida: preguntado por lo que la Reunión le acaba
de mostrar, contesta con lo que leen las herramientas de cada pantalla, no con la señal.

**Un comentario que mentía sobre la lista de pantallas sin operaciones** (§ 2.1): quien lo leyera para decidir si
una pantalla nueva necesita la bandera iba a leer que la lista está vacía. Cerrado el 2026-10-18 (`65669f4`).

**Lo que no se verificó.** El Inicio no se abrió con sesión para esta foto. Las cifras de producción sí están medidas
y son sólo conteos; quién es la persona que usa el cerebro no se miró.
