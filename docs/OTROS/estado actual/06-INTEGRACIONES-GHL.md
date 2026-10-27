# Las integraciones con proveedores: GoHighLevel, Meta directo y el cron que les habla
> Corte: **2026-10-18**, con el código de producción, el commit `972972e` (2026-10-15; migraciones hasta la `078`,
> comprobado ese día en `migraciones.migraciones_aplicadas`). En local hay ocho commits más, `693a383..dc84cb2`, del
> modelo de datos multiempresa (Fase 0, migraciones `079` a `084`), construidos y **sin subir**: no tocan ningún archivo
> de `lib/ghl/`, `lib/meta/`, `lib/http/`, del cron ni de los colectores; lo que de ellos toca esta sección va marcado
> «construido en local, sin subir» (§ 7). Las cifras nuevas se midieron en producción el **2026-10-18 entre las 15:34 y
> las 15:40 UTC**, con `scripts/supabase.mjs leer`, sólo conteos y agregados: ninguna fila con datos de una persona y
> ninguna credencial (de las credenciales se contaron columnas no nulas). Las del corte anterior —2026-09-28 entre las
> 17:50 y las 18:20 UTC, re-medidas el 2026-09-29 hasta las 00:30— siguen donde no se volvieron a medir, y lo dicen.
> Donde una cifra cambió están las dos, con su fecha. Cada afirmación lleva su `archivo:línea` o la consulta que la
> produjo; lo que no se pudo verificar está dicho como pendiente. Para ubicar lo nombrado, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior se lee con
> `git show 972972e:"docs/OTROS/estado actual/06-INTEGRACIONES-GHL.md"`.

> **Construido en local, sin subir (2026-10-26) · Meta directo, M1 a M7 (migraciones `101` a `104`).** Los anuncios, las
> campañas, las métricas y el gasto se leen de la Marketing API de Meta con «Conectar con Meta», y la lectura por el Ad
> Manager de GoHighLevel se retiró, con su cuadre y su relleno (§ 3, § 9 y § 11 describen producción al corte). Todo en
> `docs/OTROS/produccion/META-DIRECTO.md`.

> **ICP en cuadrantes (2026-10-26, local, sin subir).** El ICP del lead dejó de ser el puntaje de 0 a 100: es el cuadrante que manda el CRM —Prioriza, Valida, Financia o Descarta— en `contactos.cuadrante` (la `105`), y ningún número del ICP se muestra. Lo que esta foto dice del puntaje, de los tramos 75 y 50 y del cero describe la versión anterior; sus citas quedaron fijadas a `@bf2de85` o a `@ddba683`. Los requisitos: `docs/leads-portal/15-EL-CUADRANTE-DEL-ICP.md`. El catálogo guarda el `fieldKey` de cada campo (`campos_del_crm.clave`) y el del cuadrante se reconoce por `contact.cuadrante_de_clasificacion`; un catálogo sin ninguna clave se relee ya; la sincronización escribe el cuadrante y reclasifica desde lo guardado; `score` se sigue escribiendo y nadie lo lee.

> **Desde el corte del 2026-09-28**
>
> - **2026-09-30 · `fd553b7`, `4365cc9`** — AQ-1 y AQ-3 de Acquisition: el colector de anuncios llama a
>   `estructuraDeAnuncios` y guarda los nombres y el estado de las campañas en `negocio.campanas` (migración `065`).
> - **2026-10-03 · `97fc905`** — las funciones de Vercel corren en São Paulo (`gru1`), al lado de la base
>   (`vercel.json:3-5`).
> - **2026-10-05 · `d715b2a`** — la tarea `senales` del cron, al minuto 23 (migración `072`). No le habla a ningún
>   proveedor de datos: mide sobre la base y redacta con la llave de IA.
> - **2026-10-07 · `22ec755`** — la `076`: **el gasto de toda la cuenta de Meta**, y no sólo de las campañas que
>   aparecían en la atribución. Nacen `negocio.gasto_de_la_cuenta`, `negocio.lecturas_de_gasto`, la tarea
>   `anuncios_relleno` al minuto 53, la serie de la cuenta por tramos de 20 días y el total de una campaña por rango.
>   `serieDeLaCuenta` deja de estar sin llamador.
> - **2026-10-11 · `90439cf`, `d9c10e5`, `253cc79`** — la `077`: la miniatura del anuncio de cada contacto, con
>   `GET /contacts/{id}` dentro de la tarea `contactos` (hasta 50 por pasada, sólo contactos con `adId`).
> - **2026-10-15 · `cce2d56`** — **Meta directo**, M-1: `lib/meta/graph.ts` (el cliente de sólo lectura),
>   `lib/meta/conexion.ts` y «Probar conexión» en Ajustes › Credenciales. `pedirExterno` pasa el `error.code` numérico.
> - **2026-10-15 · `972972e`** — Meta directo, M-2 a M-4: `lib/meta/anuncios.ts`, `lib/negocio/recolectarActivos.ts`, la
>   tarea `activos` al minuto 37 y la `078` (`negocio.activos_de_anuncio`). Está en producción y **dormido**: ninguna
>   empresa cargó el token de Meta (0 de 13, medido el 2026-10-18), así que la tarea se sella `saltada` cada hora.
> - **2026-10-16 · `693a383..dc84cb2`** — Fase 0 del modelo de datos, **construida en local, sin subir**: entre otras
>   cosas, la bandeja de entrada única para lo crudo de todos los proveedores (`081`, § 7).

Comando Central habla hoy con **dos proveedores de datos de marketing**. Con GoHighLevel, por **18 operaciones sobre 17
rutas** de la API v2, en los ocho archivos de `lib/ghl/` (3.379 líneas por `wc -l`; eran 3.278), y desde el 2026-10-07
**las 18 tienen llamador**: la serie de la cuenta y la estructura de la cuenta, que el 2026-09-28 no lo tenían, son ahora
la referencia del gasto. Con **Meta directo** (Graph API), por un cliente nuevo de sólo lectura en `lib/meta/` que se usa
para dos cosas: probar la conexión desde Ajustes y traer la miniatura de cada anuncio cada hora. **Meta está dormido**:
ninguna empresa cargó su token. El cron pasó de **ocho tareas a doce** (§ 3), y el piso medido de la única empresa
conectada es de **1.568 llamadas por día a GoHighLevel** —era 1.432—, más la búsqueda del relleno del gasto cuando un día
no cuadra.

Las cinco mediciones que deciden dónde invertir:

1. **La cuenta sí gastó después del 2026-09-13, y la foto anterior no lo vio.** Decía que no había gasto desde el
   2026-09-14 y que el negocio estaba con la adquisición apagada: eran sólo las 13 campañas que el colector pedía. Desde la
   `076`, `negocio.gasto_de_la_cuenta` guarda el total diario de la cuenta entera: **703,38 entre el 2026-09-14 y el
   2026-10-18, en 22 días con gasto**, el último el **2026-10-14** (medido el 2026-10-18). Y lo de antes era más del
   doble de lo que la foto contaba: **6.397,27** del 2026-08-18 al 2026-09-13 en la cuenta, contra los 3.511,28 de las
   campañas atribuidas. Hoy la suma por anuncio cuadra con la cuenta al centavo salvo un día (§ 9).

2. **El contrato de etiquetas conoce 32 nombres; nuestros 624 contactos cargan 80.** Eran 63 sobre 594 el 2026-09-28. La
   partición entre conocidas y desconocidas no se volvió a contar; las tres familias que deciden algo siguen creciendo:
   `cita_cancelada` en 120 contactos (eran 114), `lead_meta_ads` en 233 (228), y `venta_ganada` en **2** (1) sin que
   `negocio.resultados` tenga una sola venta (medido el 2026-10-18).

3. **De los campos personalizados, 212 en 26 carpetas** (eran 195 en 25), y una carpeta borrada a la que se le sigue
   pidiendo el nombre una vez por día (medido el 2026-10-18). El reparto por carpeta y los valores guardados son del
   2026-09-28 y no se volvieron a medir (§ 5).

4. **De los siete eventos de webhook declarados, sigue llegando uno solo**: `mensaje.entrante`, 342 filas y 354 entregas
   desde el 2026-08-29 (eran 327 y 339); 15 desde el 2026-09-28. Los otros seis, **cero**, igual que el 2026-09-15 (§ 7).

5. **Ya hay asistencias en el calendario: `showed` en 3 de 368 citas** (eran 0 de 333), con 20 `noshow` (eran 15). Es
   poco, pero el estado existe y llega por el barrido (§ 8). `negocio.resultados` sigue en 7 filas, ninguna venta,
   ninguna desde el 2026-09-09.

Sobre la pregunta del dueño —¿hace falta conectar el API de Meta?—: **para el costo, no, y la respuesta es más firme que el
2026-09-28**: el costo de toda la cuenta llega por GoHighLevel y cuadra con el Administrador de anuncios (§ 9). **Para el
creativo, sí, y está construido**: el 2026-10-15 se dejó listo el camino directo a Meta para la miniatura y el post de cada
anuncio, porque GoHighLevel sólo da la imagen de 3 de 526 contactos pedidos. Falta que una persona del equipo genere el
token y lo cargue (`docs/creative/17-CONECTAR-META-PASO-A-PASO.md`). Lo que sigue sin llegar por ninguna vía construida es
el video fino: cuartiles, retención y placement.

---

## 1 · Cómo se midió esto, y qué NO prueba

Todas las cifras salen de una de tres fuentes, y están marcadas:

- **consulta**: `node --env-file=.env.supabase scripts/supabase.mjs leer "…"` contra producción, el
  2026-10-18 entre las 15:34 y las 15:40 UTC (y, donde lo dice, el 2026-09-28 entre las 17:50 y las 18:20 UTC). Es el
  único camino que ve filas.
- **archivo:línea**: una medición que ya estaba escrita en el código, con su fecha.
- **commit**: una medición que quedó en un mensaje de commit (`git show <hash>`).

Este informe **no llamó a GoHighLevel ni a Meta**: todo lo que dice de los proveedores sale de lo que nuestra base
guardó o de mediciones fechadas del código. Lo que sólo se contesta llamando está en la § 10.

Los «§» con decimales (§ 5.3, § 9.7, § 10.7, § 16.2…) son del documento de requisitos que la foto
del 2026-09-15 ya citaba así; los «§» enteros, de la 1 a la 11, son secciones de este archivo.

### El alcance real

| Hecho | Consulta | 2026-09-15 | 2026-09-28 | 2026-10-18 |
|---|---|---|---|---|
| Organizaciones en el sistema | `select count(*) from identidad.organizaciones` | 15 | 13 | **13** |
| Con fila de credenciales | `select count(*) … organizaciones_credenciales` | 4 | 5 | 5 |
| Con token del CRM cargado | `count(crm_token_cifrado)` | **1** | **1** | **1** |
| Con `crm_estado = 'activa'` | `group by crm_estado` | 1 (3 `ausente`) | 1 (4 `ausente`) | no re-medido |
| **Con token de Meta cargado** (nuevo) | `count(meta_token_cifrado)` · `count(meta_cuenta_id)` | — | — (las columnas nacen en la `064`, el 2026-09-29) | **0 · 0** |
| Con llave de IA · con llave de tl;dv | `count(ia_clave_cifrada)` · `count(tldv_clave_cifrada)` | — | no medido | 5 · 1 |
| Activas | `count(*) … organizaciones where activa` | 12 | 11 | **11** |
| Organizaciones con sellos del cron | sellos por tarea en `negocio.tareas_programadas` | 13 | 11 | **11 en cada una de las 12 tareas** |
| Organizaciones con contactos | `count(distinct org_id) from negocio.contactos` | **1** | **1** | no re-medido |
| Contactos | `count(*) from negocio.contactos` | 584 | 594 | **624** (36 congelados) |

**Un sello no es una organización barrida**, y la foto anterior los confundió al rotular la fila
«que el cron barre». El cron toma sólo las activas (`app/api/cron/route.ts:187`, desde `f17a464`,
2026-08-26), y un sello desaparece cuando se borra la organización (`on delete cascade`,
`db/migraciones/014_tareas_programadas.sql:46`), no cuando se desactiva. Con 12 activas el
2026-09-15 (medido ese día a las 17:24 UTC por la foto anterior de Conversation), el 13 sólo cierra
si al menos una organización ya inactiva conservaba sellos de antes: **el cron barría 12, no 13**.
Cuál era no se puede re-medir: hoy ninguna inactiva conserva sellos, así que aquélla se borró
después o se reactivó. El 2026-09-28 coincidían: las 11 con sellos eran las 11 activas, cada una con sello en las
ocho tareas de entonces (medido a las 23:56 UTC). El 2026-10-18 hay 11 sellos en cada una de las **doce** tareas.

O sea que **todo lo que sigue describe UNA subcuenta**. Las otras 10 empresas que el cron recorre
salen `saltada` en `contactos`, `mensajes`, `citas`, `anuncios` y `anuncios_relleno`, con cero llamadas
(consulta sobre `negocio.tareas_programadas` agrupada por tarea y estado, 2026-10-18; el 2026-09-28 se leyó también el
motivo, `sin_token`). Y en `activos`, la tarea de Meta, salen `saltada` **las 11**, porque ninguna cargó el token (§ 11).

### Las tres advertencias que hay que leer antes de las cifras

**1 · El censo de etiquetas NO es el catálogo de la subcuenta.** `negocio.contactos` sólo contiene
contactos que tienen —o tuvieron— `zona_closer` o `zona_setter`. La llamada que lee el catálogo real
(`GET /locations/{loc}/tags`, `lib/ghl/cliente.ts:450`) sólo se dispara **cuando la búsqueda no trae
ningún contacto** (`lib/negocio/sincronizar.ts:248-252`), y trae contactos siempre. Las 63 etiquetas
medidas son **un piso**, no el inventario del CRM.

**2 · Nuestra foto de etiquetas está vencida para los contactos congelados.** El congelamiento pone
`territorio` en nulo y **a propósito no toca `etiquetas`** (`lib/negocio/sincronizar.ts:292-294`).
Medido: de los 25 congelados, **21 siguen cargando una etiqueta de zona** que el CRM ya les sacó (eran
20 de 25). El censo sobrecuenta `zona_closer`/`zona_setter` hasta en 21.

```
territorio   contactos   con zona en la foto   última lectura (UTC)
setter       282         282                   2026-09-28 18:00 o después
closer       287         287                   2026-09-28 18:00 o después
(nulo)        25          21                   la más nueva, 2026-09-17 21:40
```

Desde el 2026-09-15, `negocio.cambios_de_territorio` registró 10 altas, 1 congelamiento y 1
descongelamiento (consulta agrupada por `que_paso`): los 10 contactos nuevos de la tabla de arriba.

**3 · Un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Donde digo
«no llega», lo digo contra la base o contra una medición fechada del código. Y donde digo «nadie lo
lee», es un `grep` y prueba sólo eso: que ningún archivo de `lib/`, `app/` o `components/` lo nombra.

---

## 2 · Las dieciocho operaciones de GoHighLevel, y desde la `076` todas se llaman

Todo el trato directo con GoHighLevel vive en **ocho** archivos de `lib/ghl/` (3.379 líneas por
`wc -l` el 2026-10-18; eran 3.278 el 2026-09-28, y el 2026-09-15 eran siete y 2.669). La base es siempre `https://services.leadconnectorhq.com`
— la v2; `public-api.gohighlevel.com` y `rest.gohighlevel.com/v1` están declarados EOL en
`lib/ghl/cliente.ts:18`.

Cada familia declara **su propia constante `Version`** —cuatro constantes, con **dos valores**
distintos—, y no es descuido: cada familia tiene la suya aunque coincidan. (La foto del 2026-09-15
decía «tres cabeceras distintas»; con tres familias y dos valores, nunca lo fueron.)

| Familia | `Version` | Archivo |
|---|---|---|
| Contactos, etiquetas, campos, usuarios | `2021-07-28` | `lib/ghl/cliente.ts:33` |
| Conversaciones y mensajes | `2021-04-15` | `lib/ghl/conversaciones.ts:49` |
| Calendarios y citas | `2021-04-15` | `lib/ghl/calendarios.ts:114` |
| **Anuncios (nueva)** | `2021-07-28` | `3bd2d58:lib/ghl/anuncios.ts:92` |

### La tabla completa

| # | Operación | Quién la dispara | Frecuencia medida | Archivo |
|---|---|---|---|---|
| 1 | `POST /contacts/search` | cron `contactos`; botón «Sincronizar» | cada 10 min; 1 por página de 100, por etiqueta | `lib/ghl/cliente.ts:293` |
| 2 | `GET /contacts/{id}` | abrir una ficha; el webhook, **sólo si el contacto no está en nuestra base**; **desde el 2026-10-11, la pasada de miniaturas** del cron `contactos` (`lib/negocio/miniaturaDelContacto.ts:115`) | ≈ 65 de los 320 avisos procesados del 2026-08-29 al 2026-09-27 (estimado, § 7); la pasada, hasta 50 por corrida y una sola vez por contacto con `adId`: 526 pedidos guardados al 2026-10-18, el último el 2026-10-11 | `lib/ghl/cliente.ts:545` |
| 3 | `POST /contacts/{id}/tags` | Avanzar; marcar una intervención del auditor (`lib/auditor/intervencion.ts:128`) | 7 resultados en total, ninguno desde el 2026-09-09 | `lib/ghl/cliente.ts:592` |
| 4 | `DELETE /contacts/{id}/tags` | resolver una intervención del auditor | ninguna: **0 de 24** hallazgos resueltos (eran 0 de 20) | `lib/ghl/cliente.ts:638` |
| 5 | `GET /locations/{loc}/tags` | **sólo si la búsqueda trajo cero contactos** | nunca en régimen | `lib/ghl/cliente.ts:450` |
| 6 | `GET /locations/{loc}/customFields` | catálogo de campos | 1 por día (`FRESCURA_MS`, `lib/negocio/camposDelCrm.ts:74`) | `lib/ghl/cliente.ts:717` |
| 7 | `GET /locations/{loc}/customFields/{carpetaId}` | nombre de UNA carpeta | **1 por día para siempre** (ver abajo) | `lib/ghl/cliente.ts:760` |
| 8 | `GET /users/?locationId=` | desplegable de vincular closer | por acción de una persona | `lib/ghl/cliente.ts:493` |
| 9 | `GET /calendars/?locationId=` | cron `citas`; botón «Traer del calendario» | cada hora | `lib/ghl/calendarios.ts:143` |
| 10 | `GET /calendars/events` | ídem, **1 por calendario** | 9 por corrida | `lib/ghl/calendarios.ts:230` |
| 11 | `GET /conversations/search` | cron `mensajes`; reloj del Closer | cada 10 min + hasta 1 cada 10 s con la pestaña a la vista | `lib/ghl/conversaciones.ts:127` |
| 12 | `GET /conversations/{id}/messages` | 1 por conversación nuestra que se movió | tope 6 por ciclo (`lib/negocio/ingesta.ts:71`) | `lib/ghl/conversaciones.ts:232` |
| 13 | `GET /conversations/messages/{id}` | tercera pasada de entregas | 2 por ciclo (`lib/negocio/entregas.ts:53`) | `lib/ghl/conversaciones.ts:294` |
| 14 | `POST /conversations/messages` | enviar desde el chat | por acción de una persona | `lib/ghl/conversaciones.ts:419` |
| 15 | `GET /ad-publishing/facebook/integration` | cron `anuncios` y `anuncios_relleno`, el «paso 0» y **una compuerta**: sin `connected` no se escribe nada | 1 por pasada diaria; el relleno, sólo si hay días pendientes (`3bd2d58:lib/negocio/rellenarAnuncios.ts:280-294`) | `3bd2d58:lib/ghl/anuncios.ts:250` |
| 16 | `GET /ad-publishing/facebook/reporting/list` | cron `anuncios`: un día por llamada, para las campañas candidatas; cron `anuncios_relleno`: **un rango por campaña**, que suma | régimen: 3 por día (1 candidata × 3 días); el relleno, 0 cuando todo cuadra | `3bd2d58:lib/ghl/anuncios.ts:519` (día) y `3bd2d58:lib/ghl/anuncios.ts:553` (rango) |
| 17 | `GET /ad-publishing/facebook/entity` | cron `anuncios`, nivel `CAMPAIGN`, al principio de cada pasada (desde el 2026-09-30) | 1 por página; una página con las 62 campañas | `3bd2d58:lib/ghl/anuncios.ts:327` |
| 18 | `GET /ad-publishing/facebook/reporting` | cron `anuncios` y `anuncios_relleno` (desde el 2026-10-07): **la serie diaria de toda la cuenta**, la referencia del gasto | 3 por pasada diaria (60 días en tramos de 20) | `3bd2d58:lib/ghl/anuncios.ts:621` |

Hasta el 2026-09-28 la 17 y la 18 no tenían llamador, y la 16 se pedía sólo para las 13 campañas que aparecían en nuestra
atribución. **La `076` cambió las tres** (`3bd2d58:lib/negocio/recolectarAnuncios.ts:22-39`): el universo son las campañas de la
cuenta que lista la 17, la referencia es el total diario de la 18, y la 16 se pide de dos maneras —un día para guardar
métricas, un rango para probar con una sola llamada que una campaña no gastó—. Dos restricciones del proveedor que
gobiernan el diseño, medidas el 2026-10-07: la serie **corta en 25 filas sin decirlo**, por eso se pide en tramos de 20
días (`3bd2d58:lib/ghl/anuncios.ts:586-597`), y **omite los días sin gasto**, que dentro de un tramo leído son un cero medido
(`3bd2d58:lib/ghl/anuncios.ts:610-615`). El detalle, en `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:515-547`.

Las 17 rutas son 18 operaciones porque la 3 y la 4 comparten ruta. Las cuatro de anuncios las alcanza
el mismo Private Integration Token que ya usaba el barrido, bajo el alcance `adPublishing`
(`3bd2d58:lib/ghl/anuncios.ts:11-20`, sondeado el 2026-09-16).

Y una URL que **no es API**: el widget de reserva `https://api.leadconnectorhq.com/widget/booking/{calendarId}`
(`lib/ghl/agendar.ts:43`). Sólo se arma como enlace; la de reagendar lleva `?event_id=` y su ausencia
crea una segunda cita en vez de mover la que había (`lib/ghl/agendar.ts:66-76`).

### Una escritura al CRM que no pasa por `lib/ghl/`

Subir leads desde Tools (`app/api/tools/leads/enviar/route.ts`, desde el 2026-08-30, commit
`45bcd6d`) no llama a GoHighLevel: le manda a un flujo de n8n el **token del CRM**, el Location ID,
una etiqueta y hasta 100 leads por envío, y es n8n quien crea los contactos
(`app/api/tools/leads/enviar/route.ts:188-196`; el tope en `app/api/tools/leads/enviar/route.ts:80`
y la etiqueta por omisión, `ARIA`, en `app/api/tools/leads/enviar/route.ts:136`). La foto del
2026-09-15 no la nombraba. Dos cosas que conviene saber: el token sale de nuestro servidor hacia un
tercero —desde el nivel 3 (C6 · D2, en local, sin subir), el del cliente elegido: con uno que no es el principal, el
Private Integration Token de OTRO negocio, y n8n guarda por omisión el cuerpo de cada ejecución en su historial;
antes del primer cliente con subcuenta propia hay que dejar de guardar las ejecuciones de ese flujo (o sacar
`apiToken` de lo guardado), revisar quién ve ese historial y comprobar que el flujo use el `apiToken` y el
`locationId` del cuerpo (07, «Lo que usaba las credenciales de la empresa»)—, y **cuántos envíos se hicieron no se puede medir desde la base**: la ruta no deja registro
en ninguna tabla nuestra.

### Qué se lee y qué se descarta al parsear

**`POST /contacts/search`.** El sobre: sólo `contacts` y `total`. De cada contacto, `ContactoDeGhl`
declara 19 claves (`lib/ghl/cliente.ts:59-161`) y la fila escribe 15 columnas con datos del
contacto, más el sello `sincronizado_el`; dos de ellas son derivadas: `territorio`, de las
etiquetas, y desde el 2026-09-21 `score`, de los campos (§ 6) (`lib/negocio/sincronizar.ts:390-495`).
`locationId` se declara y no se usa. Todo lo que
GoHighLevel mande y la interfaz no declare **se cae ahí mismo, sin error** — el defecto que costó la
atribución hasta la `048` y, un nivel más adentro, el desglose de acciones de Meta hasta la `053`.

Hay evidencia de que el contacto trae mucho más de lo que leemos: el **payload nativo del webhook**
trae una mediana de **189 claves de nivel superior** (entre 16 y 215, sobre los 327 cuerpos de
`negocio.avisos_del_crm`; consulta con `jsonb_object_keys`). No es la misma respuesta que la búsqueda,
así que no prueba qué devuelve `/contacts/search`; sí prueba que el objeto del proveedor es mucho
más ancho que nuestras 19 claves.

**`GET /calendars/events`.** `leerCita` arma 12 campos con 13 claves (`lib/ghl/calendarios.ts:256-282`).
`description` y `notes` vienen **vacías en 402 de 402** y `createdAt` **no existe** — el sello de
reserva se llama `dateAdded` (`lib/ghl/calendarios.ts:81-86`). El estado se lee de
`appointmentStatus` con respaldo a `appoinmentStatus`, sin la `t` que sigue a la `n`, porque el CRM manda los
dos (`lib/ghl/calendarios.ts:265-271`).

**`GET /conversations/{id}/messages`.** `leerMensaje` (`lib/ghl/conversaciones.ts:333`) lee 11
claves. Se descartan a propósito `type` (número interno), **`attachments`** —en los 128 registros de
llamada medidos, `attachments[0]` es una cadena en 128 de 128: la grabación existe y no se lee
(`lib/ghl/entrega.ts:254`)— y `meta.marketplace`. Antes de escribir, `esUnMensaje` saca los
`TYPE_ACTIVITY_*` (10 de 65 en la muestra, `lib/ghl/entrega.ts:125`) y `esDeUnCanalDelChat` deja pasar
sólo WhatsApp y SMS: sobre las 518 conversaciones del 2026-09-14, descartaba **375 correos, 236 de
Instagram y 128 registros de llamada**, el 10 % del tráfico de nuestros contactos
(`lib/ghl/entrega.ts:225-231`). Del 2026-09-14, no re-medido: es una decisión de producto de ese día.

**`GET /ad-publishing/facebook/reporting/list` (nueva).** Lee 14 claves por fila y guarda 13
(`3bd2d58:lib/ghl/anuncios.ts:484-499`). La que se lee y **no** se guarda es `leads`, que no es el conteo de
Meta sino el nuestro dando un rodeo por el proveedor: 16 de 16 coincidencias el 2026-09-16 y 14 de 15
el 2026-09-19 (`3bd2d58:lib/ghl/anuncios.ts:426-441`). Tampoco entran `sales`, `revenue` ni `averageRevenue`
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:208-223`). Y `results` —el desglose de acciones de
Meta— se tiraba entero hasta el 2026-09-19 porque `numero()` convertía el objeto en nulo; desde
`7660d2a` va a `metricas_de_anuncio.acciones` (`db/migraciones/053_el_desglose_que_ya_llegaba.sql:13-32`).
Medido el 2026-09-28: 275 de las 3.318 filas tenían desglose, y 237 de las 263 filas con gasto mayor que cero; el
2026-10-18, 708 de 4.918.

**`GET /ad-publishing/facebook/reporting` (con llamador desde el 2026-10-07).** Lee gasto, impresiones, clics, CPC, CPM,
alcance y frecuencia por día (`3bd2d58:lib/ghl/anuncios.ts:626`, `:648-657`); se guardan gasto, impresiones y clics. `conversions` y
`costPerConversion` vienen en cero en todo el período y no se leen (`3bd2d58:lib/ghl/anuncios.ts:617-619`).

### El costo de las carpetas, que conviene mirar

`GET /locations/{loc}/customFields/{carpetaId}` se pide sólo para las carpetas **sin nombre
guardado**. Medido el 2026-09-28 y otra vez el 2026-10-18: `select count(*) from negocio.carpetas_del_crm where nombre is null`
→ **1**, igual que el 2026-09-15. Esa carpeta fue borrada en GoHighLevel y responde 404
(`lib/negocio/camposDelCrm.ts:35-42`), así que **se le pide el nombre una vez por día, para siempre**:
la lectura diaria del catálogo cuesta 2 llamadas y no 1 (`lib/negocio/camposDelCrm.ts:78`). Está
documentado como aceptado.

---

## 3 · Lo que cuesta: el cron entero y el presupuesto de llamadas, medido

**El cron pasó de ocho tareas a doce.** Una sola ruta, `/api/cron`, con ocho horarios en `vercel.json`
(`vercel.json:6-38`); la cabecera `x-vercel-cron-schedule` dice cuál disparó (`app/api/cron/route.ts:139`) y `HORARIOS`
dice qué tareas corre cada uno (`lib/negocio/barrido.ts:177-407`). Un horario que no está en el mapa corre **todas**
(`lib/negocio/barrido.ts:611-621`). El orden de ejecución es el de `TAREAS` (`lib/negocio/barrido.ts:96-115`). El cron toma
sólo las empresas activas (`app/api/cron/route.ts:187`) y resuelve el token de Meta sólo en la corrida que trae `activos`
(`8b797c2:app/api/cron/route.ts:154-155`, `:205`). Desde el 2026-10-03 las funciones corren en São Paulo, al lado de la base
(`vercel.json:3-5`, commit `97fc905`).

La columna `ultimas_llamadas` de `negocio.tareas_programadas` guarda lo que costó la última corrida de cada tarea. Para la
única empresa conectada, el 2026-10-18 (entre paréntesis, el 2026-09-28):

| Tarea | Horario (`vercel.json`) | Última corrida (UTC) | Llamadas medidas | Contra quién | Dónde |
|---|---|---|---|---|---|
| `contactos` | `*/10 * * * *` | 15:30 | **8** (7) | GoHighLevel: la búsqueda **y la pasada de miniaturas** | `lib/negocio/barrido.ts:1082-1109` |
| `mensajes` | `*/10 * * * *` | 15:30 | **1** (1) | GoHighLevel | `lib/negocio/barrido.ts:249-253` |
| `auditoria` | `*/10 * * * *` | 15:30 | 0 (0) | el modelo | ídem |
| `citas` | `3 * * * *` | 15:03 | **11** (10) | GoHighLevel: 1 + un calendario más | `lib/negocio/barrido.ts:261-265` |
| `sonda` | `3 * * * *` | — (no deja sello) | 0 | nadie | `lib/negocio/barrido.ts:884-894` |
| `mejora` | `17 6 * * *` | 06:17 | 1 (1) | el modelo | `lib/negocio/barrido.ts:298-302` |
| **`anuncios`** | `17 6 * * *` | 06:18 | **8** (40) | GoHighLevel | `lib/negocio/barrido.ts:285-302` |
| `analizadores` | `41 * * * *` | 14:41 | 2 (4) | tl;dv y el modelo | `lib/negocio/barrido.ts:317-321` |
| **`anuncios_relleno`** (nueva, `076`) | `53 * * * *` | 14:53 | **0** | GoHighLevel, sólo si un día no cuadra | `3bd2d58:lib/negocio/barrido.ts:323-336` |
| `reintentos` | `7 10 * * *` | 10:07 | 0 (0) | el modelo | `lib/negocio/barrido.ts:345-349` |
| **`senales`** (nueva, `072`) | `23 * * * *` | 11:23 | 40, sumadas las 11 empresas | el modelo (la redacción del plan) | `lib/negocio/barrido.ts:376-380` |
| **`activos`** (nueva, `078`) | `37 * * * *` | 14:37 | **0**: `saltada` en las 11, sin token | **Meta** | `lib/negocio/barrido.ts:351-364` |

Las tareas que no le hablan al CRM —`auditoria`, `mejora`, `analizadores`, `reintentos`, `senales` y `activos`— no se
saltean por falta del token de GoHighLevel (`lib/negocio/barrido.ts:765-778`); `activos` se saltea por falta del de Meta,
con su texto (`lib/negocio/barrido.ts:789-796`). Una tarea que corrió y dejó trabajo sin hacer lo dice en el motivo del
sello (`lib/negocio/barrido.ts:1121-1218`): el 2026-10-18 las diez tareas que corrieron para la empresa conectada tenían el
motivo **vacío**, o sea completas (consulta: `ultimo_motivo is null`; los textos no se leyeron).

**Piso diario sólo por el cron, contra GoHighLevel: (8 + 1) × 144 + 11 × 24 + 8 = 1.568 llamadas** (el 2026-09-28 eran
1.432). La diferencia: la tarea `anuncios` bajó de 40 a 8, y `contactos` y `citas` subieron una cada una. Es un piso: los
números de `contactos` y `citas` son los de su última corrida, y el relleno suma cuando hay días que no cuadran. Ni los
Analizadores ni la tarea `senales` le hablan al CRM.

**La tarea `anuncios` cuesta 8, y ahora el comentario y la medición coinciden.** El comentario cuenta «el vínculo, las
campañas y la serie de la cuenta son unas 5 llamadas, más tres por cada campaña candidata», con 8 a 14 por día para las 1
a 3 campañas activas (`lib/negocio/barrido.ts:294-297`); la medición del 2026-10-18 es 1 + 1 + 3 + 1 × 3 = 8. Las
candidatas son las `ACTIVE` y las que gastaron en la última semana (`3bd2d58:lib/negocio/recolectarAnuncios.ts:81-87`, `:594-597`).
El proveedor tarda **4,55 s por llamada** en esta familia (`3bd2d58:lib/negocio/recolectarAnuncios.ts:92-93`) y la pasada tiene su
tope de 120 s, que ahora se comprueba antes de cada llamada (`3bd2d58:lib/negocio/recolectarAnuncios.ts:99-107`). La campaña de
prueba `888888` que devolvía 500 ya no se pide: el universo son las campañas de la cuenta
(`3bd2d58:lib/negocio/recolectarAnuncios.ts:122-128`).

**El relleno del gasto cuesta cero en régimen y cientos la primera vez.** Busca, cada hora, qué campaña gastó en los días
cerrados que no cuadran con la cuenta: un rango por campaña, partido en semanas y en días sólo donde hubo gasto
(`3bd2d58:lib/negocio/rellenarAnuncios.ts:15-22`). La primera vez son cientos de llamadas —61 campañas a unos 3 a 4,5 s—, por eso va
solo en su horario y con su propio fin de reloj, 250 s (`3bd2d58:lib/negocio/barrido.ts:323-331`,
`3bd2d58:lib/negocio/rellenarAnuncios.ts:58-66`); cuando no queda nada pendiente no llama ni al vínculo
(`3bd2d58:lib/negocio/rellenarAnuncios.ts:280-282`). El 2026-10-18 corrió con 0 llamadas.

**La miniatura de cada contacto cuesta una llamada, una sola vez.** Va dentro de `contactos`, después de sincronizar
(`lib/negocio/barrido.ts:1100-1108`): hasta 50 contactos por pasada, sólo los que llegaron con `adId`, con 15 s por pedido y
60 s por pasada (`lib/negocio/miniaturaDelContacto.ts:45-51`, `:75-94`). Al 2026-10-18 había 526 contactos pedidos, el
último el 2026-10-11 22:40 UTC, y 215 contactos con `adId`: la cola está vacía y la pasada sólo pide los nuevos.

A eso se le suman tres caminos que no tienen horario:

- **Una llamada por aviso de un contacto que todavía no conocemos.** Un aviso de mensaje sobre un
  contacto que ya está en `negocio.contactos` **no llama**: toma el territorio de nuestra base; sólo
  el contacto nuevo, y todo aviso de contacto o de cita, se relee con `GET /contacts/{id}`
  (`lib/negocio/avisoDelCrm.ts:215-232` y la condición en `lib/negocio/avisoDelCrm.ts:248`). Estimado el 2026-09-29
  00:25 UTC: de los 320 avisos procesados entre el 2026-08-29 y el 2026-09-27, **65** eran de un contacto cuya fila nació
  después del aviso. Es una estimación por `creado_el`, no un conteo: la llamada no deja registro. No se volvió a estimar.
- **Una llamada por apertura de ficha** (`lib/ghl/cliente.ts:529-543`), deliberada. No medida: no deja registro.
- **El reloj del navegador.** Con el Closer a la vista, el tic de la operación es de 10 s
  (`lib/cadencia.ts:40`) y el candado de `lib/negocio/pulso.ts:114` lo deja pasar una vez por ciclo —
  **techo de 360 llamadas por hora** por esa vía, aunque en régimen la ingesta cuesta 1 por ciclo.

**Las pantallas de los departamentos y el cerebro no agregan ninguna.** Ninguna ruta de `app/api/acquisition`,
`app/api/creative`, `app/api/conversion`, `app/api/conversation`, `app/api/sales`, `app/api/leads-portal` ni
`app/api/executive` importa `lib/ghl/`, `lib/meta/`, `pedirExterno` ni `resolverAccesoAGhl`, y tampoco `lib/agentes/` ni
las lecturas de pantalla de `lib/negocio/` (búsqueda del 2026-10-18): leen lo que el cron ya guardó. Creative lee la
miniatura de la base, la de Meta antes que la del contacto (`lib/negocio/lecturaDeCreative.ts:584-585`). Los únicos que
salen a un proveedor de datos fuera del cron son las rutas de operación del Closer y del Setter, el aviso del CRM, el envío
de leads de Tools y «Probar conexión» de Meta.

### Los techos duros, y quién los cubre con reintentos

- `pedirExterno` hace **un solo `fetch`** (`lib/http/cliente.ts:378-389`) y espera hasta 240 s
  (`lib/http/cliente.ts:250`) contra un `maxDuration` de 300; Vercel no reintenta el cron
  (`lib/negocio/barrido.ts:17`). Los pedidos nuevos acortan la espera: 15 s cada miniatura de contacto
  (`lib/negocio/miniaturaDelContacto.ts:48`) y 20 s cada pedido a Meta (`lib/meta/graph.ts:31`).
- **Desde el 2026-10-15, `pedirExterno` devuelve también el código numérico del error**, si el servicio lo manda en
  `error.code` (`lib/http/cliente.ts:72-80`, `:459-468`). Lo manda Meta, y es lo único que distingue un token vencido de un
  permiso que falta o del cupo; GoHighLevel y Anthropic no lo mandan, y para ellos la respuesta queda igual.
- El código exacto del proveedor al pasarse del límite **sigue sin confirmar**
  (`lib/ghl/cliente.ts:264-266`). **Lo que cambió desde el 2026-09-15:** la familia de anuncios es la
  primera del repositorio que reintenta el `429` — tres veces, esperando 1,2, 2,4 y 4,8 s
  (`3bd2d58:lib/ghl/anuncios.ts:139-169`)—, y a propósito fuera de `pedirExterno`, porque ahí un reintento
  automático podría mandarle dos veces el mismo mensaje a una persona (`3bd2d58:lib/ghl/anuncios.ts:130-132`).
  `Retry-After` sigue sin leerse (`3bd2d58:lib/ghl/anuncios.ts:150-152`). Las otras catorce operaciones siguen
  sin red. La pasada de miniaturas **no reintenta el 429: corta** y deja lo que falta para la siguiente
  (`lib/negocio/miniaturaDelContacto.ts:26-29`), y Meta tampoco reintenta: un cupo agotado corta la pasada de activos y
  la hora siguiente sigue (`lib/negocio/barrido.ts:1180-1195`).

El comparador que el proyecto guarda: la plataforma anterior corrió a ~7 peticiones por minuto y por
pestaña —420 por hora— y GoHighLevel lo toleró (`lib/negocio/barrido.ts:218-221`). Estamos un orden de
magnitud por debajo, también con las tareas nuevas.

---

## 4 · El contrato de etiquetas contra el censo real

`lib/ghl/contrato.ts` declara **32 nombres de etiqueta** distintos, repartidos en territorios, estados
del agente, series de seguimiento, descartes, resultados del closer, resultados del setter y etapas
del setter. No cambió desde el 2026-09-15: lo único que se tocó en ese archivo es el puntaje
(`git diff 93a1341 HEAD --stat -- lib/ghl/` muestra sólo `contrato.ts` y el `anuncios.ts` nuevo), y desde el
2026-09-28 no se tocó (`git diff 861b5f0 972972e -- lib/ghl/contrato.ts`, vacío).

> **Re-medido el 2026-10-18, sólo el total y tres etiquetas:** 80 etiquetas distintas sobre 624 contactos (eran 63 sobre
> 594); `lead_meta_ads` en 233, `cita_cancelada` en 120 y `venta_ganada` en **2**. La partición en conocidas y
> desconocidas y las tablas de abajo son del 2026-09-28 y **no se volvieron a contar**: las 17 etiquetas nuevas pueden
> caer de cualquiera de los dos lados.

El censo de producción, el 2026-09-28:

```sql
select lower(e), count(*) from negocio.contactos ct, unnest(ct.etiquetas) e group by 1 order by 2 desc
```

| | 2026-09-15 | 2026-09-28 |
|---|---|---|
| Etiquetas distintas sobre nuestros contactos | 62 (584) | **63** (594) |
| Etiquetas que el contrato declara | 32 | 32 |
| Que el contrato conoce **y** se usan | 18 | **19** |
| Que existen en el CRM y **el contrato no conoce** | 44 | **44** |
| Que el contrato declara y no aparecen en ningún contacto | 14 | 13 |

Las 19 conocidas, por uso: `zona_setter` 354, `zona_closer` 301, `bot_activado_appflow` 100,
`cita_agendada` 97, `bot_activado_leadflow` 71, `icp_rechazado` 69, `bot_desactivado_postcall` 63,
`rechazado` 55, `noshow` 53, y diez con 1 a 6 contactos cada una.

### Las 44 que el contrato no conoce

Ordenadas por uso, con la cifra del 2026-09-15 entre paréntesis donde cambió. Son el vocabulario real
que el CRM escribe y nosotros guardamos crudo sin interpretar:

| Etiqueta | Contactos | Qué parece ser |
|---|---|---|
| `lead_meta_ads` | **228** | marca de origen Meta — la señal de adquisición más poblada |
| `cita_cancelada` | 114 (111) | el par de `cita_agendada`, que **sí** está en el contrato |
| `[device] - default` | 90 (86) | ruido del canal de WhatsApp |
| `form_vsl_incompleto_sin_agendar` | 87 | etapa del embudo de la landing |
| `form_vsl_completo_sin_agendar` | 64 (62) | etapa del embudo de la landing |
| `not answered` / `answered` | 59 / 55 (58 / 51) | resultado del **agente de voz** |
| `trigger` | 55 | disparador genérico |
| `assistant hangup` / `contact hangup` / `contact declined` | 46 / 30 / 24 (42 / 29 / 24) | cómo terminó la llamada de voz |
| `voicemail reached` | 32 (31) | ídem |
| `dial no answer` / `dial busy` / `dial failed` / `invalid destination` | 16 / 3 / 2 / 3 | resultado del marcador |
| `[whatsapp] - phone device is disconnected` | **16 (10)** | fallo de canal |
| `[whatsapp] - contact is not registered on whatsapp` | 11 | **fallo de canal**, hoy invisible |
| `stop bot` / `stop appflow` | 10 / 2 (10 / 1) | órdenes de apagado que el contrato no lee |
| `agencia ia 60 min` / `ia remarketing 60 min` / `agencia ia` / `ia remarketing` | 9 / 3 / 1 / 2 | campañas o embudos |
| `form precall` / `form_submitted` | 7 / 6 | formularios |
| `cita_cancelada_manualmente` / `cita_reagendada` / `quiere_reagendar` / `reschedule` | 6 / 3 / 2 / 1 | ciclo de vida de la cita |
| `afiliado ghl` / `afiliado ghl pago` / `affiliado ghl cancelado` | 4 / 3 / 4 (3 / 2 / 3) | canal de afiliados |
| once etiquetas sueltas, de 1 a 3 contactos cada una | — | `scalingusa`, `saludo 1`, `saludo 2`, `no show`, `negocio b2b`, `fase 2: en proceso`, `1-1 si tiene presupuesto`, `agenda_en_demostracion`, `[whatsapp] - lead capture`, y dos que llevan el nombre de una persona y no se transcriben |

Tres grupos merecen una decisión, no una lista — los tres del 2026-09-15, y los tres crecieron:

1. **El ciclo de vida de la cita.** `cita_agendada` está en el contrato (`lib/ghl/contrato.ts:171`) y
   `cita_cancelada` —**114 contactos**— no. El ícono 📅 de la fila se apaga sólo por el barrido del
   calendario, que corre cada hora; la etiqueta llegaría en segundos si el webhook de cancelación
   estuviera conectado (§ 7).
2. **El agente de voz.** Las diez etiquetas de llamada suman **270 apariciones sobre 123 contactos**
   (eran 259 apariciones). Es un resultado de llamada ya escrito en el CRM que `negocio.llamadas`
   —**0 filas**, re-medido— podría leer sin una sola llamada nueva a la API. Se decidió el 2026-09-14
   dejar los agentes de voz fuera (`lib/ghl/entrega.ts:213-218`); esta medición dice cuánto cuesta.
3. **Los fallos de canal.** Las dos etiquetas de WhatsApp caído están en **27 contactos** (eran 21) a
   los que no se les puede escribir por ese canal, y la pantalla no lo dice.

Y uno nuevo, chico y que no encaja con nada nuestro: **`venta_ganada` está puesta en 1 contacto**,
y `negocio.resultados` no tiene ninguna fila con `salida = 'venta'` (7 filas: `seguimiento` 4,
`no_show` 2, `no_interesa` 1). Sales cuenta sólo las ventas que registra Avanzar
(`lib/negocio/ventasDelContacto.ts:27`), así que esa etiqueta la puso alguien en el CRM y ninguna
pantalla la ve. Quién y cuándo no se puede saber desde la base: las etiquetas no tienen fecha.

### Las 13 del contrato que no aparecen

Que no estén en el censo **no prueba que no existan en el CRM**: el contrato distingue tres niveles de
confianza, y tres están declaradas `pendiente` justamente porque todavía no se crearon.

| Etiqueta | Confianza declarada | Lectura |
|---|---|---|
| `setter_nuevo`, `setter_en_calificacion`, `setter_calificado` | `pendiente` | **No existen y no se mandan.** `sePuedeMandar` las filtra (`lib/ghl/contrato.ts:598-612`). La fuente de verdad de la etapa es nuestra base (`lib/ghl/contrato.ts:490-514`). |
| `seguimiento_terminado` | `sin_confirmar` | Existe según el contrato; nadie confirmó qué significa. Sólo lectura. |
| `adelanto_ganado` | `confirmado` | Existe y **nunca se escribió**: de 7 resultados registrados, ninguno fue acuerdo sin pago. |
| `bot_activado`, `bot_apagado_manual`, `bot_desactivado_leadflow` | `confirmado` | Declaradas verificadas en la subcuenta, sin uso en nuestros contactos. |
| `seguimiento_recupero`, `seguimiento_para_agendar`, `seguimiento_decision_lt` | `confirmado` | Las series de recontacto. **Ninguna puesta**: el ícono ⏱ está apagado en los 594. |
| `derivado_lt`, `estancado` | constantes sin confianza declarada | Sin uso. `estancado` pinta la cola de estancadas, que por lo tanto está vacía. |

`venta_ganada` salió de esta tabla por el contacto de arriba, no porque la escribiéramos.

### Un hecho del contrato que se movió, y se quedó

`lib/ghl/contrato.ts:43` dice: *«Medido contra la subcuenta real el 2026-08-24: **3 de 238** tienen
las dos»* etiquetas de zona. Sobre los contactos vivos (sin congelados, cuya foto está vencida):

```
2026-09-15   con las dos zonas   64 de 559   (11,4 %)
2026-09-28   con las dos zonas   64 de 569   (11,2 %)
```

De 1,3 % a 11 % en tres semanas, y quieto desde entonces — como casi todo lo que depende de altas
nuevas (ver la medición 1 del encabezado). La regla «gana el closer» (`lib/ghl/contrato.ts:52-55`)
decide el territorio de **64 contactos**. El comentario de la línea 43 sigue con la cifra de agosto.

---

## 5 · Los campos personalizados: 195 definidos, 114 poblados, 174 fuera de la pantalla (2026-09-28)

> **Re-medido el 2026-10-18, sólo el catálogo:** 212 campos en 26 carpetas (eran 195 en 25), y sigue habiendo **1**
> carpeta sin nombre guardado, la borrada (§ 2). Los poblados, el reparto por carpeta y los valores son del 2026-09-28
> y no se volvieron a medir.

### El catálogo

```sql
select count(*), count(distinct carpeta_id) from negocio.campos_del_crm
```

| | 2026-09-15 | 2026-09-28 |
|---|---|---|
| Campos totales | 170 | **195** |
| Carpetas | 24 | **25** |
| Campos con al menos un valor guardado | 102 | **114** |
| Campos sin ningún valor | 68 | 81 |
| Última lectura del catálogo | 2026-09-15 00:00 | 2026-09-28 00:00 |

Hay además **3 identificadores de campo con valores guardados que el catálogo no define** (27, 6 y 1
contacto; eran 28, 7 y 1) — campos borrados en GoHighLevel cuyos valores quedaron en la foto del
contacto. El catálogo no borra lo que desapareció, a propósito (`lib/negocio/camposDelCrm.ts:206-215`).

### El reparto por carpeta, y las que son inalcanzables

Un campo se dibuja en el Perfil sólo si su carpeta tiene `grupo` (`lib/negocio/camposDelCrm.ts:271`).
El grupo se pone **al descubrir la carpeta**, desde `CARPETAS_DEL_PERFIL` (`lib/ghl/contrato.ts:349-361`), que lista cuatro, o cuando llega tarde el nombre de una sin grupo que nadie eligió (`lib/negocio/camposDelCrm.ts:555`);
desde la `098` también lo elige una persona en Ajustes › Clientes (`grupo_elegido_el`), y ningún refresco lo pisa.

| Clase | Carpetas | Campos | Con algún valor | Valores guardados |
|---|---|---|---|---|
| **Con grupo (se muestran)** | 4 | **21** | 21 | 3.316 (eran 3.205) |
| **Sin grupo (no se muestran)** | 21 | **174** | **93** | **5.057** (eran 4.939) |

O sea: **el 60,4 % de los valores que guardamos de GoHighLevel no se dibuja en el Perfil** (era el
60,6 %: 4.939 de 8.144). Dentro de las cuatro con grupo hubo un movimiento que el código registra a
medias: «Contact» pasó de 1 campo a 3 —eso sí quedó escrito, el 2026-09-21, en
`lib/ghl/contrato.ts:350-352`— y «📁 Score | ICP Lead Form (Meta)» de 9 a 7, que no. Son los dos
campos de URL que `ETIQUETAS_CORTAS` rotula «Redes» y «Web»: hoy su carpeta es «Contact» (consulta
sobre `campos_del_crm` por esos dos identificadores). `lib/ghl/contrato.ts:356` todavía dice
«9 campos», y `lib/ghl/contrato.ts:372`, que los siete rotulados son «todos de la carpeta de Meta».

«Inalcanzable» tiene dos sentidos, y hay que separarlos. Para la **pantalla del Perfil**, los 174
están fuera y no hay forma de traerlos sin cambiar `carpetas_del_crm.grupo`. Para el **código de
negocio** existe una salida: `campoPorNombre` (`lib/negocio/camposDelCrm.ts:333`) resuelve un campo
por su nombre **saltándose el filtro de carpetas**. El 2026-09-15 la usaban dos módulos; hoy seis:
`lib/negocio/consumoDelPrecall.ts:159`, `lib/negocio/indicadoresDeCitas.ts:248`,
`lib/negocio/pasosDeConversion.ts:578`, `lib/negocio/embudoDelFormulario.ts:182`,
`lib/negocio/recorrido.ts:258` y `lib/negocio/fichaDelLeadDelPortal.ts:205-207`. El puntaje de Creative ya no: desde la
`098` `campoDelPuntaje` (`lib/negocio/camposDelCrm.ts:529@bf2de85`) busca el «Puntaje | ICP» por su cuenta, cliente por
cliente y sólo si el cliente no eligió el suyo, con el mismo desempate por `campo_id`. De los campos que se
leen así, dos viven en carpetas sin grupo: «Confirmación Agendamiento»
(`lib/negocio/indicadoresDeCitas.ts:208`) y «Form Landing VSL» (`lib/negocio/recorrido.ts:231`). El
precio está escrito: si alguien renombra el campo en el CRM, devuelve `null`.

Las 21 carpetas sin grupo, por tamaño (entre paréntesis, la cifra del 2026-09-15 donde cambió):

| Carpeta | Campos | Con valor |
|---|---|---|
| Additional Info | 39 (28) | 5 |
| Form Funnel Demo | 30 | 25 |
| OLD FIELDS | 12 | 4 |
| 📁 Score \| ICP Versión *(nombre de una persona)* — **nueva** | 12 | 12 |
| Survey \| Survey Calificación ARIA | 10 | 0 |
| **📁 Atribución Campañas** | **10 (8)** | 8 |
| 📁 Score \| ICP (la versión vieja) | 9 | 8 |
| Form \| ScalingUSA \| VSL form | 9 | 6 |
| Form High Ticket | 8 | 0 |
| 📁 Links Sistema | 6 | 6 |
| 📁 Score \| Meta Lead Ads (OLDS) | 5 | 4 |
| Calls *(nombre de una persona)* | 4 | 4 |
| 📁 Resultado Avanzar | 4 | 3 |
| Llamada ElevenLabs | 3 | 2 |
| Lead Scoring | 3 | 0 |
| **VSL VTURB** | **2** | 2 |
| Form Calendario Consultoría | 2 | 0 |
| 📁 Rechazados | 2 | 2 |
| General Info | 2 | 1 |
| Agente de Appointment Flow | 1 | 1 |
| *(carpeta borrada, sin nombre)* | 1 | 0 |

Los 25 campos nuevos son 11 de «Additional Info», 12 de la carpeta nueva y 2 de «📁 Atribución
Campañas» (`Last Ad ID` y `Last UTM Campaign`, los dos en **0 contactos**).

### Lo que está adentro y nadie mira

Los campos sin grupo con más datos guardados (entre paréntesis, 2026-09-15):

| Campo | Carpeta | Contactos con valor | ¿Lo lee alguien? |
|---|---|---|---|
| Hora de Reunion | 📁 Links Sistema | 265 (255) | no |
| Last UTM Source | 📁 Atribución Campañas | **263** (259) | no |
| Link del meets | 📁 Links Sistema | 262 (253) | no |
| Last UTM Medium (Adset) | 📁 Atribución Campañas | **256** (254) | no |
| Form Landing VSL | 📁 Score \| ICP | 247 (247) | **sí, por nombre, desde el 2026-09-20** |
| Fecha de Reunion | 📁 Links Sistema | 220 (211) | no |
| Link reagenda | 📁 Links Sistema | 218 (209) | no |
| Confirmación Agendamiento | 📁 Score \| ICP | 184 (178) | sí, por nombre |
| Last Landing URL | 📁 Atribución Campañas | 183 (173) | no |
| Last UTM Content (Anuncio) | 📁 Atribución Campañas | **159** (158) | no |
| Last Campaign ID | 📁 Atribución Campañas | **142** (143) | no |
| IGSID | 📁 Atribución Campañas | 121 (120) | no |
| Meta Lead ID | 📁 Atribución Campañas | **116** | no |
| Last FB ClickId | 📁 Atribución Campañas | 85 | no |

«¿Lo lee alguien?» es un `grep` del nombre sobre `lib/`, `app/` y `components/`. Las dos carpetas
grandes sin lector son «📁 Atribución Campañas» (1.325 valores), que en buena parte duplica la
atribución nativa que sí se lee (§ 9), y «📁 Links Sistema» (1.369 valores).

**`Form Landing VSL` merece un párrafo propio.** 247 contactos, y su vocabulario es exactamente la
etapa del embudo que el documento pide:

```
Agendado                       121
Form incompleto sin agendar     87
Form completo sin agendar       39
```

El 2026-09-15 este informe decía que ninguna pantalla lo leía. **Cambió**: desde el 2026-09-20
(commit `4da946d`) lo leen por nombre, para Conversion, `lib/negocio/embudoDelFormulario.ts:182` y
`lib/negocio/recorrido.ts:258`, y desde el 2026-09-26, para Leads Portal,
`lib/negocio/fichaDelLeadDelPortal.ts:205`. Y las cifras no se movieron por otro motivo: el campo
dejó de reportar el 2026-08-31, cuando la gente empezó a entrar por el widget y no por la landing
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:16-23`).

### Y el hallazgo que contradice lo que se creía

La carpeta **VSL VTURB** tiene dos campos, re-medidos hoy:

| Campo | Tipo | Contactos con valor | Valores distintos |
|---|---|---|---|
| `VSL % máximo visto` | NUMERICAL | **79** | `0` — uno solo |
| `VSL segundos vistos` | TEXT | **79** | `0` — uno solo |

Esto es una distinción de los dos ceros, y hay que hacerla bien: para **515 contactos no hay dato** (el
campo no está); para **79 el dato dice cero**. Igual que el 2026-09-15, sobre diez contactos más.
El tracking individual del VSL que el § 5.3 pide *«cuando exista tracking individual verificable»*
**está cableado y no reporta nada**. Eso es un problema del medidor —vTurb o su integración—, no de GoHighLevel.
Y desde la foto anterior se sabe algo más: además de reportar cero, **dejó de reportar el
2026-08-30** (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:18`).

Comparado con el precall, donde el mismo error ya se cometió y se corrigió
(`lib/negocio/consumoDelPrecall.ts:1-17`): los dos campos NUMERICAL dedicados al porcentaje
(`Video Watch Percentage`, `Porcentaje de Video Visto`) siguen en **0 de 594**, y el porcentaje real
viaja en las opciones de un RADIO, `Video Pre-Call`, poblado en **222** (eran 213).

---

## 6 · El puntaje: lo que la foto anterior daba por ausente y ya llegaba

> Las cifras de esta sección son del 2026-09-28 y no se volvieron a medir. El código que deriva el puntaje no cambió.

El 2026-09-15 este informe decía que `score` estaba «en 0 de 584» y lo ponía entre lo que GoHighLevel
no expone. **Era falso.** El CRM calcula un puntaje —«Puntaje | ICP», un campo `NUMERICAL`— y estaba
guardado en `campos_del_crm` desde la `039`; lo que faltaba era derivarlo, y la columna ni siquiera
podía guardarlo: era `char(1)` con `check` de letras
(`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:6-16`). Desde `e350a47`
(2026-09-21) la columna es `smallint` entre 0 y 100
(`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:70-76`) y la
sincronización la pisa en cada pasada (`lib/negocio/sincronizar.ts:457`). El mismo commit borró dos columnas que
nunca tuvieron escritor, `responsable_id` y `responsable_rol`
(`db/migraciones/054_las_dos_columnas_que_nadie_escribio.sql:54-55`).

```
«Puntaje | ICP» en campos_del_crm   474 de 594
contactos.score con valor           472 de 594   (0 a 100)
los 2 de diferencia                 los dos son congelados: no se releen
```

Cero llamadas nuevas: se deriva de la misma respuesta. El campo está designado a mano en
`lib/ghl/contrato.ts:313` porque no se puede deducir: el grupo `calificacion` tiene 17 campos y uno
solo es el puntaje.

---

## 7 · Los webhooks: siete puertas declaradas, una conectada

`lib/ghl/avisos.ts:119` declaraba **siete eventos** (desde el 2026-10-27, nueve: `oportunidad.etapa` y `oportunidad.salida`, el 8.º aviso, con escritor `lib/negocio/etapaDelCrm.ts`), cada uno con su URL `…/api/avisos/crm?evento=<nombre>`.
El evento viaja en la URL porque la acción «Webhook estándar» de GoHighLevel manda su payload nativo
y **no permite editar el cuerpo JSON** (`lib/ghl/avisos.ts:19-27`); la autenticación va por la
cabecera `X-Webhook-Secret`.

### Lo que llega de verdad

```sql
select coalesce(evento,'(sin evento)'), count(*), sum(repeticiones),
       count(*) filter (where procesado_el is not null),
       count(*) filter (where error is not null),
       count(*) filter (where procesado_el is null and error is null),
       min(recibido_el), max(visto_ultimo_el)
from negocio.avisos_del_crm group by 1
```

| Evento declarado | Filas | Entregas | Procesados | Con error | Sin nada |
|---|---|---|---|---|---|
| `mensaje.entrante` | **342** (327 el 2026-09-28) | **354** (339) | 335 (320) | 0 | 7 (7) |
| `mensaje.saliente` | 0 | 0 | — | — | — |
| `contacto.zona_closer` | 0 | 0 | — | — | — |
| `contacto.zona_setter` | 0 | 0 | — | — | — |
| `contacto.actualizado` | 0 | 0 | — | — | — |
| `cita.agendada` | 0 | 0 | — | — | — |
| `cita.cancelada` | 0 | 0 | — | — | — |

Medido el 2026-10-18 (entre paréntesis, el 2026-09-28). Primero el 2026-08-29 01:16 UTC, último el 2026-10-17 06:07 UTC;
15 desde el 2026-09-28. Los 342 tienen `atribucion = 'coincide'`: cero workflows apuntando a la URL equivocada. Las 12
entregas duplicadas (354 − 342) las absorbió el `unique (org_id, huella)`. Los otros seis eventos siguen en cero.

**El ritmo se cayó, y no es el webhook.** Hasta el 2026-09-14 llegaban ≈ 18 avisos por día (311 en
17 días); desde el 15, 16 en 13 días. Los mensajes entrantes cayeron en la misma proporción —607 en
el primer tramo, 33 en el segundo, consulta sobre `negocio.mensajes` por `direccion = 'entrante'`—, así
que la relación aviso/entrante es la misma (51 % y 48 %). Es el negocio quieto, no la puerta rota. (Del 2026-09-28; el
ritmo de los mensajes no se volvió a medir. El gasto de esos días sí: hubo, en una campaña que no se recolectaba, § 9.)

**Seis de los siete workflows no están configurados en GoHighLevel.** No es un problema de código: las
siete URLs se ofrecen en el panel y el manejador reconoce las siete (`lib/ghl/avisos.ts:198-200`) y
las reparte en dos ramas, mensaje o contacto y cita (`fe45e33:lib/negocio/avisoDelCrm.ts:169-184`); no hay un
`switch` por evento. Lo que falta es pegar
seis URLs en seis workflows. Lo que se gana, por cada uno:

- `cita.agendada` / `cita.cancelada`: el ícono 📅 se actualiza en segundos en vez de esperar el
  barrido horario. El catálogo lo explica: *«una cita cancelada que sigue encendida hace que no
  llame»* (`lib/ghl/avisos.ts:161-164`). Con **179 de 368 citas canceladas** el 2026-10-18 (166 de 333 el
  2026-09-28), es el caso frecuente, no el raro.
- `mensaje.saliente`: saca al contacto del Buzón sin esperar el ciclo.
- `contacto.actualizado`: cubre el caso de que un contacto **pierda** sus dos etiquetas de zona — hoy
  eso sólo lo descubre el barrido de contactos, y hay 36 congelados (eran 25; medido el 2026-10-18).

### La llamada que el webhook paga, y la que ya no paga

La foto del 2026-09-15 decía que cada aviso procesado hace un `GET /contacts/{id}`, y contaba 305
llamadas. **Era falso**: un aviso de mensaje sobre un contacto que ya está en nuestra base toma el
territorio de la fila y cuesta cero llamadas; sólo el contacto nuevo —la «red de seguridad del
alta»— y los eventos de contacto y de cita releen al proveedor (`lib/negocio/avisoDelCrm.ts:215-232`
y `lib/negocio/avisoDelCrm.ts:248`). Cuando se relee, es para que haya **un solo lugar** que decida
el territorio (`lib/negocio/avisoDelCrm.ts:10-18`). Estimado el 2026-09-29 00:25 UTC: **65 de los 320**
avisos procesados eran de un contacto cuya fila nació después del aviso (§ 3). El payload nativo trae
`tags` en **327 de 327** cuerpos y `attributionSource` en 321, así que esas 65 también se podrían
ahorrar; no recomiendo tocarlo sin resolver antes la duplicación de la decisión de territorio.

### Siete avisos sin procesar y sin motivo

**7 de 327** tienen `procesado_el` nulo **y** `error` nulo (eran 6 de 311; el nuevo es del
2026-09-17). Después de guardar, el manejador escribe `procesado_el` en el camino feliz y `error` en
los demás (`app/api/avisos/crm/route.ts:357-404`). La única rama que deja las dos columnas nulas es
la del cuerpo que no es un objeto JSON (`app/api/avisos/crm/route.ts:353`), y no es ésta: los 7 son
objetos JSON válidos, igual que los 327 (medido el 2026-09-29 00:20 UTC con `jsonb_typeof`). Lo que
queda compatible es que la petición murió entre guardar la fila e interpretarla. Queda como
pendiente (§ 10). El 2026-10-18 siguen siendo **7 de 342**: ninguno nuevo desde el 2026-09-17.

### La bandeja de entrada única: construida en local, sin subir

La Fase 0 del modelo de datos multiempresa (2026-10-16, commit `99f6e1e`, **no subido**: espera la aprobación de un
ingeniero) crea el esquema `ingesta` con una tabla particionada por mes, `ingesta.recibidos`, para guardar **tal cual llegó**
todo lo que mandan los proveedores —GoHighLevel por n8n o por aviso directo, Meta, tl;dv, las landings y otros—, con una
sola puerta, `ingesta.recibir`, que ejecuta sólo un rol que no lee nada (`db/migraciones/081_la_bandeja_de_entrada.sql:1-14`,
`:83-102`). La razón escrita: reprocesar hacia atrás sin volver a pedirle nada al proveedor, y que un error del intérprete no
pierda el dato. **Nada la usa todavía**: `negocio.avisos_del_crm` pasaría a ser una fuente más cuando llegue el normalizador,
en la Fase 1 (`db/migraciones/081_la_bandeja_de_entrada.sql:8-11`). En producción no existe.

---

## 8 · Qué NO puede dar GoHighLevel — separado de qué sí puede y no le pedimos

> Salvo donde dice «2026-10-18», las cifras de esta sección son del 2026-09-28 o anteriores, con su fecha cuando la tienen.

El documento pide esta distinción explícitamente, y es la parte que decide dónde invertir.

### Los plantones del calendario: el cambio del 15 no se repitió

El 2026-09-15, entre las 18:04 y las 20:03 UTC, doce citas pasaron de `confirmed` a `noshow`, y la
foto anterior pidió volver a medir antes de construir nada encima. Medido el 2026-09-28 y otra vez el 2026-10-18:

```sql
select to_char(estado_cambiado_el at time zone 'UTC','YYYY-MM-DD'),
       lower(estado_anterior_ghl)||'->'||lower(estado_ghl), count(*)
from negocio.citas where estado_cambiado_el is not null group by 1,2 order by 1;
-- 2026-09-28: 09-15 confirmed->noshow 11 · 09-16 confirmed->cancelled 1 · 09-17 noshow->cancelled 1
--             09-18 confirmed->noshow 1 · 09-22 confirmed->cancelled 1
-- 2026-10-18, lo nuevo: confirmed->cancelled 10 (del 09-30 al 10-14) · confirmed->noshow 5 (10-05, 10-06,
--             10-08 dos, 10-17) · confirmed->showed 3 (10-06 dos, 10-08)

select lower(coalesce(estado_ghl,'(nulo)')), count(*) from negocio.citas group by 1;
-- 2026-09-28: cancelled 166 · confirmed 152 · noshow 15   (2026-09-16: 160 · 146 · 15)
-- 2026-10-18: cancelled 179 · confirmed 166 · noshow 20 · showed 3
```

Los doce del 15 figuran hoy como once porque `estado_cambiado_el` guarda sólo el **último** cambio de
cada cita (`lib/negocio/citas.ts:410-417`): una de ellas pasó de `noshow` a `cancelled` el 17. En trece
días hubo **un** plantón nuevo con registro. Siguen quince `noshow` —tres que llegaron ya marcados, de
las citas del 2026-09-08 y 09, y doce con registro—. **Es más compatible con una limpieza puntual que
con un flujo permanente**; no verificado del lado del CRM, y con la adquisición apagada casi no hubo
citas nuevas que marcar (16 reservadas desde el 2026-09-15).

**Corregido el 2026-10-18: no era sólo una limpieza.** Desde el 2026-10-05 alguien marca citas en el CRM con regularidad:
cinco `noshow` nuevos y, **por primera vez, tres `showed`** (consulta de arriba). Con 33 citas reservadas desde el
2026-09-28, el estado de asistencia empezó a llegar por el barrido sin que cambiara una línea de código. Quién marca y
con qué criterio no se puede saber desde la base.

Las columnas que la `042` y la `045` dejaron esperando tienen hoy: `inicio_anterior_el` 2 (era 1),
`estado_anterior_ghl` 15 y `estado_cambiado_el` 15 (eran 12 y 12).

**El *show rate* del § 10.7 ya tiene numerador, y todavía no alcanza.** El 2026-09-28 `showed` estaba en 0; el
2026-10-18 está en **3**, contra 20 `noshow`, y `asistio` sigue en **0 de 368**. Tres asistencias no son una tasa. La vía
de Avanzar tampoco lo trajo: ningún resultado registrado desde el 2026-09-09.

### A · El proveedor NO lo tiene (o lo tiene vacío)

| Lo que el documento pide | Evidencia |
|---|---|
| **Asistencia a la cita** (§ 5.3, § 10.7 *show rate*) | **Corregido el 2026-10-18: el proveedor la tiene cuando alguien la marca.** Hasta el 2026-09-15 los campos existían vacíos: 3 de 1052 citas (`lib/ghl/calendarios.ts:186`). Desde el 2026-10-05 llegan `noshow` y `showed` marcados en el CRM: 20 y 3 de 368 (bloque de arriba). `asistio` sigue nulo en **368 de 368**: la escribe una persona en Avanzar y está fuera del `on conflict` del barrido (`lib/negocio/citas.ts:419-429`). |
| **Duración y «contestada» de las llamadas** | Los 128 registros de llamada traen `status = completed` en el 100 % —el estado de la llamada a la API— y **no hay duración en ningún nivel** (`lib/ghl/entrega.ts:242-248`; del 2026-09-14, no re-medido). `negocio.llamadas` sigue con **0 filas** y sin escritor (re-medido). |
| **Transcripción / resumen de llamada** | No existe. Lo único aprovechable es `attachments[0]`, la grabación. Convertirla en resumen es un subsistema, no una columna. |
| **Última actividad entrante/saliente por contacto** | GoHighLevel no documenta una fecha por dirección (`lib/negocio/sincronizar.ts:18-21`). La calcula un disparador nuestro sobre `negocio.mensajes`: `ultimo_entrante_el` en 305 de 594 (eran 299 de 584), `ultimo_saliente_el` en 485 (eran 476). |
| **Etapa del funnel como campo del sistema** | No lo expone: la mueve un workflow. `negocio.contactos.etapa` está en **6 de 594** y la llena nuestro pipeline. (El puntaje salió de esta fila: § 6.) |
| **Listar las carpetas de campos personalizados** | Cuatro formas probadas el 2026-09-07, las cuatro fallan (`lib/ghl/cliente.ts:666-683`). Sólo una por una, por su id. |
| **Filtrar conversaciones por etiqueta** | `GET /conversations/search` **ignora el filtro** y devuelve las 15.808 de la cuenta (`lib/ghl/conversaciones.ts:6-9`). De ahí sale el diseño por marca de agua. |
| **Paginar citas** | `calendarId` es obligatorio y **no acepta `limit`**: todo parámetro desconocido da 422 nombrándolo (`lib/ghl/calendarios.ts:25-45`). El barrido cuesta 1 + N calendarios. |
| ~~**Gasto, impresiones, alcance, CPM, CTR**~~ | **CORREGIDO el 2026-09-16: sí llegan.** La foto anterior buscó campos personalizados con esos nombres, no los encontró y concluyó que no había vía. Es el error de método de la advertencia 3: el Ad Manager de GoHighLevel los devuelve y el token del CRM lo alcanza (`3bd2d58:lib/ghl/anuncios.ts:11-25`). Lo que ya está guardado, en la § 9. |
| **Las métricas finas del video** | Cuartiles 25/50/75/100, tiempo medio visto, retención de seis segundos, *thruplay*: `fields` es un enum cerrado de once valores y todo lo demás da 422 (`3bd2d58:lib/ghl/anuncios.ts:64-68`). |
| **Placement y desgloses demográficos** | `groupBy` sólo acepta `day`, `week` y `month` (`3bd2d58:lib/ghl/anuncios.ts:70`). |
| **El activo creativo** (§ 5.1 *Creative Profile*) | `/entity?entityType=AD` devuelve sólo nombre e identificadores, y `/creatives`, `/videos` y `/posts` dan 404 (`3bd2d58:lib/ghl/anuncios.ts:72-74`; el detalle en `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:251-265`). |
| **`visitor_id` / `session_id`** (§ 16.2, pruebas 2 y 3) | No hay campo. Lo más cercano es `gaClientId` (42 contactos, eran 37) y `fbp` (70, eran 63) dentro de la atribución de primer toque (en cualquiera de los dos toques, 57 y 89): identificadores de sesión ajenos. |
| ~~**El ad set como identificador**~~ | **CORREGIDO el 2026-09-16: sí llega**, como `utmTerm`. Esta fila decía que el ad set venía «sólo como nombre», y era falso: los 9 valores distintos de entonces cruzaron **9 de 9** contra los 200 conjuntos de `/entity` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:28-30`; la misma migración nombra el error de esta fila en `db/migraciones/050_lo_que_costo_cada_anuncio.sql:45-49`), y la `050` guarda esa llave con su nombre verdadero en `negocio.anuncios.meta_conjunto_id` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:95-101`). El 2026-09-28: `utmTerm` en 274 contactos, 11 valores, 10 de ellos de 18 dígitos y uno de texto que no es un identificador. Contra nuestra dimensión cruzan 6 de 11, pero esa tabla sólo tenía los conjuntos de los anuncios que aparecieron en el reporte y **20 de sus 79 anuncios seguían sin conjunto**; el cruce contra `/entity` no se re-midió: desde el 2026-09-30 `/entity` se pide, pero sólo al nivel de campaña. |

### B · Sí lo tiene y no se lo pedimos

| Lo que existe | Evidencia de que existe | Por qué no llega |
|---|---|---|
| **Oportunidades y pipelines** | `TYPE_ACTIVITY_OPPORTUNITY` apareció **6 veces en la muestra de 65 mensajes** (`lib/ghl/entrega.ts:125`). | Ninguna de las 18 operaciones toca `/opportunities`. El § 5.4 pide `opportunity_id` en el registro de venta y no hay de dónde sacarlo. |
| **Correo, Instagram y llamadas** | Medido el 2026-09-14 sobre 518 conversaciones: 375 correos, 236 de Instagram, 128 de llamada. | `esDeUnCanalDelChat` los descarta. **Decisión de producto del 2026-09-14** (`lib/ghl/entrega.ts:213-231`), no una omisión. |
| **El resultado del agente de voz** | 270 apariciones de etiquetas de llamada sobre 123 contactos (§ 4). | El contrato no las conoce. Están crudas en `contactos.etiquetas` y **no las lee nadie**. |
| **El estado del formulario de la landing** | `Form Landing VSL`, 247 contactos, con los tres estados del embudo. | Su carpeta (`📁 Score \| ICP`) no tiene grupo. Desde el 2026-09-20 se lee por nombre (`lib/negocio/recorrido.ts:231`); sigue sin dibujarse en el Perfil. |
| **Confirmación de asistencia** | `Confirmación Agendamiento`, 184 contactos, vocabulario `Si`/`No`. | Misma carpeta sin grupo; se alcanza por `campoPorNombre` y ya se usa. |
| **Los enlaces y horarios de la reunión** | «📁 Links Sistema»: 6 campos, 1.369 valores (`Link del meets` 262, `Link reagenda` 218). | Carpeta sin grupo y ningún archivo nombra sus campos. |
| **La grabación de la llamada** | `attachments[0]` en 128 de 128. | `leerMensaje` no lee `attachments`. |
| **Una venta marcada en el CRM** | `venta_ganada` en 2 contactos el 2026-10-18 (1 el 2026-09-28; § 4). | Sales cuenta sólo lo que registra Avanzar. |
| **El catálogo real de etiquetas** | `GET /locations/{loc}/tags` está implementado (`lib/ghl/cliente.ts:450`). | Sólo se llama cuando la búsqueda trae cero contactos. Nunca se ejecutó en régimen. |
| ~~**La estructura y la serie de la cuenta**~~ | `estructuraDeAnuncios` y `serieDeLaCuenta` (`3bd2d58:lib/ghl/anuncios.ts:327` y `3bd2d58:lib/ghl/anuncios.ts:621`). | **Ya se piden**: la estructura desde el 2026-09-30 y la serie desde el 2026-10-07, que es la referencia del gasto y la única vía al **CPM** agregado (`3bd2d58:lib/ghl/anuncios.ts:604-609`). El CPM se pide y no se guarda: `negocio.gasto_de_la_cuenta` tiene gasto, impresiones y clics (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:23-53`). |

---

## 9 · ¿Hace falta conectar el API de Meta? Para el costo no; para el creativo, ya está construido

**Para el costo, no.** El 2026-09-15 la respuesta era «para atribuir, no; para el costo, todavía no»; el 2026-09-28, «no»
también para el costo, porque llegaba por GoHighLevel. Desde la `076` (2026-10-07) llega **el de toda la cuenta**, y cuadra.
**Para el creativo —la miniatura y el post de cada anuncio—, sí**, y desde el 2026-10-15 está construido y dormido (§ 11).

### La atribución, en `negocio.contactos`

```sql
select count(*),
  count(*) filter (where atribucion_primera::text <> '{}'),
  count(*) filter (where atribucion_ultima::text  <> '{}'),
  count(*) filter (where atribucion_primera ? 'adId'), count(distinct atribucion_primera->>'adId')
from negocio.contactos
```

| | 2026-09-15 (de 584) | 2026-09-28 (de 594) |
|---|---|---|
| Atribución de **primer toque** no vacía | 544 | **553** |
| Atribución de **último toque** no vacía | 557 | **567** |
| `adId` en el primer toque | 213 · 15 anuncios | **213 · 15 anuncios** |
| `campaignId` en el primer toque | 358 · 14 campañas | **358 · 14** (13 numéricas y `{{campaign.id}}` en 3) |
| `utmTerm` (el conjunto) en el primer toque | no medido | **274 · 11 valores** |
| `adId` / `campaignId` / `fbclid` en cualquiera de los dos | 219 / 369 / 291 | **219 / 369 / 291** |
| `utmCampaign` | no medido | **0** |
| `campaign` (así llega la UTM de campaña) | no medido | no medido; el 2026-10-18, **273** |

El 2026-10-18 se volvió a contar el `adId` del primer toque: **215 de 624**. Ese día también se contaron las claves de la
UTM, para corregir el monitor de atribución (`65669f4`): de 519 contactos con alguna UTM, `utmCampaign` en 0 y
`campaign` en 273, 272 junto con `utmSource`; contando las dos claves, las cinco completas son 56 y la que menos llega es
`utmTerm`. El monitor buscaba sólo `utmCampaign`, y desde ese commit reconoce las dos
(`lib/negocio/calidadDeLaAtribucion.ts:91-106`). El resto de la tabla no se re-midió. El
`adId` no falta al azar: falta por puerta de entrada —formulario y widget de calendario— (commit `3d96e8c`, medido el
2026-09-16), y por eso la campaña de mensajes que gastó desde el 2026-09-30 no aparecía en la atribución: sus contactos
llegan sin `campaignId` (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:6-10`).

### El costo, en `negocio.metricas_de_anuncio` y `negocio.gasto_de_la_cuenta`

| | 2026-09-28 | 2026-10-18 |
|---|---|---|
| Campañas que el colector pide | 13, las de la atribución | **las de la cuenta**: 62 en `negocio.campanas` |
| Filas por anuncio y día | 3.318 = 79 anuncios × 42 días | **4.918**, de **129** anuncios |
| Ventana guardada | 2026-08-18 → 2026-09-28 | 2026-08-18 → 2026-10-18 |
| Gasto sumado por anuncio | 3.511,28 | **7.100,17** |
| Gasto de la cuenta (`gasto_de_la_cuenta`, nueva) | — | **7.100,65**, en 62 días |
| Del 2026-08-18 al 2026-09-13 | 3.511,28 (sólo las 13 campañas) | **6.397,27** en la cuenta; 6.396,79 por anuncio |
| Del 2026-09-14 al 2026-10-18 | «sin gasto» | **703,38**, en 22 días con gasto |
| Último día con gasto | 2026-09-13 | **2026-10-14** |
| Días que no cuadran, declarados residuo | — | **1**, el 2026-08-24 (los 0,48 de diferencia) |
| Pares (campaña, día) ya leídos | — | 2.929, de ellos 2.072 ceros probados con un rango |
| Filas con desglose de acciones | 275 | 708 |

Todas las cifras de la última columna, medidas el 2026-10-18. Los importes están en la moneda de la cuenta publicitaria,
que la base no guarda.

**La foto anterior se equivocó en dos cosas, y las dos por la misma causa: miraba sólo las 13 campañas de la
atribución.** Decía que no había gasto desde el 2026-09-14 y que lo exacto era «sin gasto desde el 14»; la cuenta gastó
703,38 desde entonces. Y daba 3.511,28 como el gasto del período anterior; la cuenta gastó 6.397,27. La `076` lo explica
con la medición que la motivó: el 2026-10-07 la app decía 0 en 7 días y 865,58 en 30, y el Administrador de anuncios de
la misma cuenta decía 200,19 y 2.234,55 (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:6-10`). Lo que sí era cierto:
desde el 2026-09-18 las filas de esas 13 campañas venían sin métricas —estaban pausadas— y un vacío del proveedor no es un
cero (`3bd2d58:lib/ghl/anuncios.ts:172-177`).

**Cómo cuadra ahora.** Un día está completo cuando la suma por anuncio coincide con el total de la cuenta
(`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:12-17`), con una tolerancia de 0,10 (`lib/negocio/gastoDeLaCuenta.ts:34`,
`:61`). Lo ya leído se anota por (campaña, día), y un cero se prueba con una sola llamada por rango
(`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:64-85`). Meta corrige hacia atrás: un total que cambia marca
`cambio_el` y lo leído antes se vuelve a pedir (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:41-43`). Un día que no
cuadra con todo leído se redescubre una vez y, si sigue sin cuadrar, se declara residuo: gasto de la cuenta que ninguna
campaña listada explica, por ejemplo de una campaña borrada (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:45-50`).
Hoy hay uno.

**El vínculo con Meta ya deja rastro, y es una compuerta.** El 2026-09-28 el colector lo preguntaba cada día y no lo guardaba
en ningún lado. Desde la `076`, sin `connected` la pasada no escribe nada —un vacío guardado como cero sería permanente—
(`3bd2d58:lib/negocio/recolectarAnuncios.ts:551-558`), y el sello lo dice: «Meta no está vinculado en GoHighLevel: no se leyó el
gasto» (`3bd2d58:lib/negocio/barrido.ts:1168-1182`). El 2026-10-18 la tarea `anuncios` de la empresa conectada corrió a las 06:18 UTC
con el motivo vacío, o sea que **el vínculo estaba `connected`** (deducido del motivo vacío; el texto no se leyó).

### El embudo por anuncio, con su costo (del 2026-09-29, no re-medido)

Cruzando `atribucion_primera->>'adId'` con `negocio.citas` y con la suma de `gasto` de cada anuncio, el 2026-09-29 00:20 UTC:

| Anuncio (`adId`, últimos dígitos) | Contactos | Con cita | Citas | Canceladas | Gasto 08-18 → 09-13 |
|---|---|---|---|---|---|
| …580467 | 109 | 48 | 51 | 41 | 564,22 |
| …550467 | 44 | 20 | 20 | 17 | 313,70 |
| …570467 | 17 | 6 | 6 | 6 | 162,38 |
| …400467 | 13 | 2 | 2 | 0 | 42,20 |
| *…11 anuncios más* | 30 | 3 | 3 | 2 | 152,37 |
| **Total con anuncio** | **213** | **79** | **82** | **66** | **1.234,87** |
| Sin anuncio | 381 | 213 | 251 | 100 | — |

Los 15 anuncios que nombran nuestros contactos sumaban 1.234,87 de los 3.511,28 que el colector conocía entonces; contra
el gasto real de la cuenta en ese período, 6.397,27, son el 19 %. El resto es gasto de anuncios que ningún contacto nuestro
nombra —por la puerta de entrada de arriba, y porque nuestra base sólo guarda contactos con etiqueta de zona—. *«Agendamientos
por fuente y anuncio»* (§ 9.7) y el CPL por anuncio se pueden construir sin una llamada nueva; el paso 1 de la prueba de
trazabilidad del § 16.2 —*«capturar UTMs y `meta_ad_id`»*— sigue cumplido en 215 contactos.

### Qué agrega Meta directo, exactamente

1. ~~**El denominador de costo**~~ — **llega por GoHighLevel**, de toda la cuenta, con impresiones, clics, alcance, CTR,
   CPC y frecuencia por anuncio y por día. El CPM agregado lo trae la serie de la cuenta (`3bd2d58:lib/ghl/anuncios.ts:604-609`),
   que se pide y no se guarda.
2. ~~**El `adSetId` como identificador**~~ — **llega**, como `utmTerm` (§ 8 A).
3. **La miniatura y el post de cada anuncio** — **construido el 2026-10-15, dormido**: la tarea `activos` lee de Meta el
   creativo de cada anuncio y guarda la miniatura vigente y el enlace al post (§ 11). Por GoHighLevel la única imagen es la
   del contacto que llegó desde un anuncio de Instagram: 3 de 526 contactos pedidos la traen (medido el 2026-10-18).
4. **El video y las métricas finas** — **siguen sin llegar por ninguna vía construida**: el archivo del video, cuartiles,
   tiempo medio visto, retención de seis segundos y los desgloses por ubicación y demografía (`3bd2d58:lib/ghl/anuncios.ts:62-74`).
   El plan dejó el video para después de medir con el primer token real (CR-8 y CR-9,
   `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md:193-204`). Lo que sí llega del lado del video es `videoView`, con 90 % de
   cobertura en su medición del 2026-09-18 (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:66-73`) y una definición
   que GoHighLevel no documenta (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:271-279`).

### La recomendación, con su cifra

**Cargar el token de Meta es un paso de una persona, no de código**: la guía está escrita
(`docs/creative/17-CONECTAR-META-PASO-A-PASO.md`), «Probar conexión» dice en cuál de tres pasos falla, y la tarea ya corre
cada hora. Lo que no conviene es seguir el orden al revés: un ROAS por anuncio se sigue apoyando en el numerador de siempre.

```
contactos con anuncio atribuido      215   (2026-10-18; 213 el 2026-09-29)
  → con cita                          79   (2026-09-29, no re-medido)
  → con resultado registrado            3   (2026-09-29, no re-medido)
```

`negocio.resultados` tiene **7 filas en total**, **ninguna venta y ninguna desde el 2026-09-09** (medido el 2026-10-18).
Con gasto real todos estos días (703,38 desde el 2026-09-14), lo que escasea es el registro de resultados, no el costo ni
la atribución.

El orden que proponía la foto del 2026-09-15, y en qué quedó cada paso al 2026-10-18:

1. **Leer lo que ya está guardado — a medias.** `Form Landing VSL` y `Confirmación Agendamiento` se leen por nombre;
   «📁 Atribución Campañas» y «📁 Links Sistema» siguen sin lector (búsqueda del 2026-09-28).
2. **Conectar los seis webhooks que faltan — no hecho.** Cero eventos de los seis (2026-10-18).
3. **Arreglar el medidor del VSL — no hecho** (del 2026-09-28, no re-medido). No depende de GoHighLevel.
4. **Enseñarle al contrato las etiquetas que no conoce — no hecho.** El contrato sigue en 32 nombres; los contactos cargan
   80 distintas (2026-10-18).
5. **Y recién ahí, Meta — el costo, resuelto por GoHighLevel; el creativo, construido y esperando el token.**

---

## 10 · Pendientes: lo que no pude verificar

Cada uno es un hueco medido, no una suposición.

1. **El catálogo real de etiquetas de la subcuenta nunca se leyó.** `GET /locations/{loc}/tags` sólo
   se llama si la búsqueda trae cero contactos (`lib/negocio/sincronizar.ts:248-252`). Las 80
   etiquetas medidas el 2026-10-18 son las que cargan nuestros 624 contactos: **un piso**. Una sola llamada
   manual lo cerraría.

2. **Siete avisos quedaron sin procesar y sin motivo.** 7 de 342 (2026-10-18), con `procesado_el` y `error` los dos
   nulos. La única rama del manejador que deja ese estado es la del cuerpo ilegible
   (`app/api/avisos/crm/route.ts:353`), y los siete son objetos JSON válidos (§ 7), así que lo
   compatible es que la petición murió entre guardar e interpretar. Hace falta el registro de la función en Vercel de
   esas siete fechas (2026-08-29, 08-31, 09-04, 09-08, 09-09, 09-11 y 09-17).

3. **Las etiquetas de confianza de `entrega.ts` siguen vencidas** (medido el 2026-09-28; no se volvió a medir). El
   catálogo marca `queued` y `failed` como `sin_confirmar` (`lib/ghl/entrega.ts:68-69`). Medido en `negocio.mensajes`,
   columna `estado_entrega`: **`failed` 475 y `queued` 2**. El conteo completo a las 23:57 UTC:
   `delivered` 3.916 (3.914 en la lectura de la tarde), `read` 1.120, `failed` 475, sin estado 375,
   `completed` 120, `sent` 102, `queued` 2.
   **Contra qué se compara el 475.** El 2026-09-15 no hubo una cifra sino tres: la foto anterior
   leyó 430, 432 y 435 fallidos ese día, con mensajes del día todavía entrando; este archivo se quedó
   con la primera y [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) con la de las 18:17 UTC. La columna
   no las separa: la familia `fallido` junta `failed`, `undelivered` y `opt_out`
   (`lib/ghl/entrega.ts:69-79`), pero ni hoy ni en el conteo completo de aquella foto aparece ninguno
   de los otros dos, así que hoy la familia son los mismos 475. El aumento es de 40 a 45 según la
   lectura del 15 que se tome. De los 475, sólo **3** traen el motivo del canal (`fallo_del_canal`):
   eran 3 aquel día, y no creció.

4. **El techo de tasa de GoHighLevel no está medido.** Ni el código que devuelve al pasarse está
   confirmado (`lib/ghl/cliente.ts:264-266`). La familia de anuncios ya reintenta el 429; las otras
   catorce operaciones no, y ninguna lee `Retry-After`. El 2026-10-18 el piso es de ~1.568 llamadas por día para
   una empresa (§ 3); con cinco serían ~7.800, más el relleno del gasto, que la primera vez de cada empresa son
   cientos. **Y el de Meta tampoco**: los códigos de cupo están traducidos (`lib/meta/graph.ts:48-49`) pero nunca se
   recibió uno, porque nunca hubo token.

5. **No pude comprobar el alcance del token sobre `/opportunities`.** Está probado que lee contactos,
   etiquetas, campos, usuarios, calendarios, conversaciones y, desde el 2026-09-16, el Ad Manager
   (`adPublishing`). Si alcanza `/opportunities` sólo se contesta llamando al proveedor, y este
   informe no lo llamó. Si alcanza, el `opportunity_id` del § 5.4 está a una llamada de distancia.

6. ~~**Si Meta sigue vinculado hoy.**~~ **Cerrado por deducción el 2026-10-18.** Desde la `076` el sello de `anuncios`
   dice cuando el vínculo no está `connected` (`3bd2d58:lib/negocio/barrido.ts:1168-1182`), y el de ese día estaba vacío (§ 9).

7. ~~**Por qué no hay gasto desde el 2026-09-14.**~~ **Era falso: hubo** (703,38 hasta el 2026-10-18, § 9). Las 13
   campañas que se pedían sí estaban sin entregar; otra, de mensajes, gastaba y no se pedía. Lo que sigue abierto es
   menor: qué campaña explica el día residuo del 2026-08-24 (0,48), que el relleno ya no busca.

8. **La llamada diaria que se sabe perdida.** La carpeta borrada responde 404 y, con su `nombre`
   nulo, se le vuelve a pedir una vez por día para siempre (`lib/negocio/camposDelCrm.ts:35-42`). Está
   aceptado; lo dejo contado porque nadie lo va a ver en ninguna factura.

9. **Los contactos congelados con etiqueta de zona vencida** (21 de 25 el 2026-09-28; el 2026-10-18 hay 36 congelados y no
   se volvió a contar cuántos conservan la etiqueta). No es un defecto —el congelamiento no
   toca `etiquetas` a propósito— pero toda cifra construida sobre `contactos.etiquetas` incluye hasta
   21 fotos de hasta el 2026-09-17. Quien mida etiquetas debería filtrar por `territorio is not null`
   o decir que no lo hizo; en este informe, las cifras de etiquetas son sobre los 594 salvo donde dice
   «vivos».

10. **Cuántos lotes se subieron al CRM desde Tools.** La ruta que manda leads a n8n
    (`app/api/tools/leads/enviar/route.ts:188-196`) no deja registro en la base.

11. **Si el token de Meta, cuando alguien lo cargue, sirve para lo que se construyó.** Nada de § 11 se ejecutó nunca
    contra Meta con un token real: ni cuánto dura la firma de una miniatura, ni qué tipos de creativo traen imagen, ni el
    costo en llamadas por hora. Es la etapa CR-4 del plan (`docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md:193-204`).

---

## 11 · Meta directo: el segundo proveedor, listo y dormido (desde el 2026-10-15)

**Qué es.** Un cliente de **sólo lectura** de la API Graph de Meta, en `lib/meta/`, que es el único lugar del proyecto que
le habla a Meta (`lib/meta/graph.ts:1-18`). Tres reglas escritas: el token va en la cabecera `Authorization` y **nunca en la
URL** —el cliente lanza si alguien lo pone como parámetro— (`lib/meta/graph.ts:12-13`, `:88`); **sólo `GET`**, con un token
de permisos de lectura (`ads_read`, `pages_read_engagement`, `pages_show_list`), así que no hay forma de que una regresión
cree, pause o gaste (`lib/meta/graph.ts:14-15`); y el error de Meta se traduce a un motivo cerrado —`token`, `permiso`,
`no_existe`, `cupo`, `sin_respuesta`, `otro`— y su mensaje en inglés nunca llega al navegador (`lib/meta/graph.ts:16-17`,
`:44-62`). La versión de la API es `v23.0` (`lib/meta/graph.ts:26`) y cada pedido espera hasta 20 s (`lib/meta/graph.ts:31`).
Para distinguir los motivos hace falta el código numérico del error, que `pedirExterno` empezó a devolver el mismo día (§ 3).

**La credencial.** Dos columnas de `identidad.organizaciones_credenciales`, desde la `064` (2026-09-29): el token cifrado y
la cuenta publicitaria `act_…`. `resolverAccesoAMeta` distingue tres faltas —sin token, token ilegible, sin cuenta— y pide
el token primero (`lib/credenciales/resolver.ts:712-727`, `:741-771`); la cuenta se acepta con o sin el prefijo y se
normaliza (`lib/credenciales/resolver.ts:736-739`). **Medido el 2026-10-18: 0 de 13 empresas tienen el token, y 0 la
cuenta.**

**Las dos operaciones que lo usan:**

| # | Qué | Pedidos a Meta | Quién la dispara | Archivo |
|---|---|---|---|---|
| M1 | **«Probar conexión»**: el token (`GET /me`), la cuenta (`GET /act_…` con nombre, moneda y estado) y los últimos 25 anuncios con su miniatura; no guarda nada | 3 | una persona, desde Ajustes › Credenciales, con `credenciales.editar` | `lib/meta/conexion.ts:37-73`, `app/api/admin/credenciales/meta/route.ts:22-31` |
| M2 | **La tarea `activos`**: el creativo de cada anuncio de `negocio.anuncios`, en dos pasos por lotes de 50 (`?ids=`): el anuncio y su creativo, y la imagen y la miniatura de 640 px | 2 por cada 50 anuncios, más uno por anuncio si un lote trae uno borrado | el cron, al minuto 37 de cada hora | `lib/meta/anuncios.ts:1-12`, `:101-148`; `8b797c2:lib/negocio/recolectarActivos.ts:195-227` |

«Probar conexión» es un `POST` aunque no escribe, para que un enlace o una vista previa no lo disparen, y dice en cuál de
los tres pasos falla con un texto nuestro (`app/api/admin/credenciales/meta/route.ts:1-9`,
`components/ajustes/ConexionConMeta.jsx:3-11`).

**La tarea `activos`** (`lib/negocio/recolectarActivos.ts:1-15`) es reconciliación: pide los anuncios que nunca se leyeron,
los leídos hace más de un día y los que tienen una miniatura que **vence en las próximas seis horas**, primero los que
entregaron hace menos, hasta 200 por pasada y con 90 s de presupuesto (`lib/negocio/recolectarActivos.ts:25-35`,
`:96-114`). La URL de la miniatura del CDN de Meta va firmada y vence: el vencimiento se lee del parámetro `oe`
(`lib/negocio/recolectarActivos.ts:48-60`) y una miniatura vencida no viaja a la pantalla
(`lib/negocio/recolectarActivos.ts:148-184`). Un anuncio de otra cuenta que el token alcance a ver se descarta
(`lib/negocio/recolectarActivos.ts:74-94`). Guarda en `negocio.activos_de_anuncio`, una fila por anuncio leído, también sin
miniatura, con su motivo (`db/migraciones/078_el_activo_del_anuncio.sql:21-49`). Sin token se sella `saltada` con su texto,
sin llamar a nadie (`lib/negocio/barrido.ts:789-796`); un token rechazado, un permiso que falta o el cupo cortan la pasada
y el sello dice qué hacer (`lib/negocio/barrido.ts:1180-1195`). Creative toma la miniatura y el post de Meta antes que los
del contacto (`lib/negocio/lecturaDeCreative.ts:584-585`).

**Medido el 2026-10-18:** `negocio.activos_de_anuncio` tiene **0 filas**, y la tarea `activos` está `saltada` en las 11
empresas activas, la última vez a las 14:37 UTC. Cuesta cero llamadas: corre cada hora, abre la transacción de identidad
para mirar que no hay token, y sella.

**Lo que se encontró al leerlo para esta foto** (los tres, cerrados el mismo 2026-10-18 en `65669f4`):

- **Los textos de error de Meta voseaban**, contra la regla de tú neutro de la aplicación: «Revisá», «Probá», «avisá»
  (`82f863b:lib/meta/graph.ts:69`, `:71`, `:74-75`). Llegan a la pantalla de Ajustes por «Probar conexión»
  (`components/ajustes/ConexionConMeta.jsx:10-11`). La prueba de voseo de Tools (`202`) no mira `lib/meta/`. **Cerrado:**
  hoy dicen «Revisa», «Prueba de nuevo» y «avisa a desarrollo», y la prueba nueva
  `pruebas/codigo/258-la-aplicacion-no-vosea.test.ts` mira `lib/meta/` con el resto de la aplicación.
- **Un comentario y su código no decían lo mismo:** en el paso de la cuenta, el comentario decía que un token válido que
  no encuentra la cuenta «se dice como permiso», y el código lo dice como `no_existe` (`lib/meta/conexion.ts:46-47`).
  **Cerrado:** el comentario dice hoy `no_existe`.
- **El presupuesto de la corrida que nombraba el comentario no era el del barrido:** `recolectarActivos.ts` decía que la
  corrida entera tiene 240 s (`lib/negocio/recolectarActivos.ts:28`) y el barrido usa 180 s (`lib/negocio/barrido.ts:425`).
  Como `activos` corre sola en su horario, los 90 s de la pasada caben en los dos. **Cerrado:** el comentario dice hoy
  180 s y nombra `PRESUPUESTO_MS`.
