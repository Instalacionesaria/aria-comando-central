# La plataforma: cómo entran los datos, dónde viven y qué los vigila
> Corte: **2026-10-18**, con el código de producción, `972972e` (migraciones hasta la `078`). Las cifras de producción
> son de dos fechas y cada una lo dice: las del **2026-10-18**, re-medidas para esta foto entre las 15:41 y las 16:12
> UTC (`now()` de la base) con `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados, con el OK del
> usuario): de la base no salió un nombre, un correo ni un teléfono, y de las credenciales sólo si están cargadas o
> no; y las del **2026-09-28**, de la foto anterior, que se conservan para comparar o porque no se volvieron a medir,
> y lo dicen. **GitHub no se volvió a leer** para esta foto (protección de rama, corridas de la CI): esas cifras son
> del 2026-09-28. En local hay ocho commits más, `693a383..dc84cb2`, del modelo de datos multiempresa: la Fase 0,
> construida y **sin subir**, esperando la aprobación de un ingeniero; va aparte, en el § 11. Cada afirmación lleva su
> `archivo:línea`, su commit o la consulta que la produjo. Lo que no se pudo verificar está dicho como pendiente, no
> omitido. Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La
> versión anterior, con sus anexos del 2026-10-04, se lee con `git show 972972e:"docs/OTROS/estado actual/17-LA-PLATAFORMA.md"`.

> **Desde el corte del 2026-09-28**
>
> - **Dieciséis migraciones, de la `063` a la `078`, aplicadas en producción** entre el 2026-09-30 y el 2026-10-15,
>   con veinte tablas nuevas en `negocio`: de 29 a **49** (§ 4).
> - **De 5 horarios y 9 tareas a 8 horarios y 12 tareas.** `senales` al minuto 23 (`d715b2a`, 2026-10-05),
>   `anuncios_relleno` al 53 (`22ec755`, 2026-10-07) y `activos` al 37 (`972972e`, 2026-10-15); y la pasada de
>   miniaturas de los contactos, dentro de `contactos` cada diez minutos (`90439cf`, 2026-10-11) (§ 2).
> - **2026-10-03 · `97fc905`** — las funciones de Vercel corren en São Paulo (`gru1`), al lado de la base
>   (`vercel.json:3-5`).
> - **2026-10-04 · `d75f3be`, `cd851b3`** — el uso de la IA: `negocio.uso_de_ia`, una fila por llamada al modelo
>   (`069`), y los incidentes que ya no retienen a la persona (`070`) (§ 4).
> - **2026-10-12 y 2026-10-13** — la limpieza de Supabase: se borraron, con respaldo, las tablas de dos aplicaciones de
>   análisis retiradas y las de la plataforma anterior, Closer v1; las de ARIA Brain pasaron a un esquema de respaldo
>   (§ 4).
> - **2026-10-16 · `693a383..dc84cb2`, construido en local, sin subir** — la Fase 0 del modelo de datos
>   multiempresa: migraciones `079` a `084` y dos fases nuevas de `scripts/db.mjs` (§ 11).
> - **La suite pasó de 2.273 a 3.055 pruebas** con la base de producción (mensaje de `d424d8b`), y a 3.074 con la
>   Fase 0 (mensaje de `dc84cb2`) (§ 5).
> - **Lo que no cambió:** `main` sigue sin protección de rama según la última lectura (2026-09-28), y la sonda sigue sin
>   dejar sello.

**Construido y corriendo.**

Un solo punto de entrada —`GET /api/cron`— recibe los **ocho** horarios de Vercel y reparte **doce** tareas. Medido el
2026-10-18: las once tareas que dejan sello tienen **121 sellos**, 11 tareas × las 11 empresas activas; en la única
empresa con token del CRM corren todas menos `activos`, que espera un token de Meta que nadie cargó, y en las otras
diez se saltean con su motivo, salvo `senales`, que corre en las once porque mide sobre nuestra base. Los datos de
negocio viven en **49 tablas de `negocio` con RLS forzada** y **todo el volumen sigue siendo de una sola empresa**:
624 contactos, 368 citas, 6.478 mensajes, 4.918 filas de costo por anuncio. La base la comparten otras plataformas,
distinguidas por el esquema; desde la limpieza del 2026-10-12/13, en `public` quedan sólo 27 tablas, ninguna de las
dos aplicaciones retiradas ni de Closer v1. Lo que más le falta a la plataforma sigue sin ser código: **la protección
de rama**, sin la cual el rojo de la CI no frena el despliegue, y **un rastro durable de la sonda de aislamiento**.

---

## 1 · Qué hay: las piezas y dónde viven

| pieza | dónde | qué hace |
|---|---|---|
| El disparador | `vercel.json` | ocho entradas `crons`, todas a `/api/cron`, distinguidas sólo por el horario; región `gru1` |
| El punto de entrada | `app/api/cron/route.ts` | autentica, resuelve las empresas y sus llaves, llama al orquestador |
| El orquestador | `lib/negocio/barrido.ts` | qué tareas toca cada horario, en qué orden, con qué presupuesto; sella |
| Las tareas | `lib/negocio/`, `lib/auditor/`, `lib/analizadores/`, `lib/agentes/detectores/`, `lib/deteccion/` | una por módulo (§ 2.4) |
| El aviso del CRM | `app/api/avisos/crm/route.ts` | el webhook de GoHighLevel; un solo evento llega (§ 2.5) |
| Los disparos manuales | cuatro rutas de `app/api/` | el reloj y los botones del Closer, el Setter y la Agenda, y la sonda a mano; aparte, `GET /api/control`, que nada llama (§ 2.6) |
| La frescura | `lib/negocio/frescura.ts` | convierte el sello en un aviso de pantalla y, desde AG15, en el comentario de la cabecera (§ 3) |
| La capa de datos | `lib/datos/contexto.ts`, `lib/datos/capa.ts` | la transacción por organización y la de identidad (§ 4) |
| La base | `db/arranque/`, `db/migraciones/`, `db/sembrado/`, `db/controles/`, `db/vigilancia/` | roles, 78 migraciones en producción (84 en local), siembra, sonda |
| La suite | `pruebas/`, `scripts/pruebas.mjs` | 264 archivos en `972972e` (§ 5) |
| La CI | `.github/workflows/verificar.yml` | build, tipos, base desde cero y suite en cada push y cada PR |
| El despliegue | `docs/OTROS/produccion/DESPLIEGUE.md` | el guion y el registro; Vercel despliega por push |
| La paridad | `scripts/paridad.mjs` | retirada desde el 2026-10-01 (§ 6) |
| El grafo | `graphify-out/` | para ubicar; su detalle es de [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) |
| La lectura de producción | `scripts/supabase.mjs` | `leer` va con `read_only: true` (§ 9) |

---

## 2 · Cómo entran los datos: un cron, ocho horarios, doce tareas

### 2.1 · El punto de entrada

- **Es un GET que escribe, y no hay otra.** Vercel dispara los cron con GET; un `POST` recibiría un 405 y el cron no
  correría nunca, sin nada rojo (`app/api/cron/route.ts:9-13`). Las corridas duplicadas las frena el candado del pulso
  (`app/api/cron/route.ts:19-21`).
- **La autenticación.** Sin `CRON_SECRET` responde 403 y lo grita en el registro, no en el cuerpo
  (`app/api/cron/route.ts:110-123`); la cabecera se compara con `timingSafeEqual` (`app/api/cron/route.ts:97-104`). Nunca
  se autoriza por el user agent (`app/api/cron/route.ts:44-45`).
- **Vive bajo `/api/`** porque `proxy.ts` redirige todo lo demás a `/entrar`, y una respuesta 3xx da la corrida por
  terminada sin rastro (`app/api/cron/route.ts:49-54`); lo ata `pruebas/codigo/99-cron.test.ts:269`.
- **`maxDuration = 300`**, declarado en la ruta y no en `vercel.json` (`app/api/cron/route.ts:94`, prueba en
  `pruebas/codigo/99-cron.test.ts:252`).
- **La fase de identidad va primero y se cierra antes del bucle**: lista las empresas, se queda con las activas
  (`app/api/cron/route.ts:187`) y resuelve en la misma transacción sus accesos —al CRM, al auditor y a los
  Analizadores—, más la llave de IA sólo en el horario de `senales` y el token de Meta sólo en el de `activos`
  (`app/api/cron/route.ts:155-158`, `app/api/cron/route.ts:180-210`).
- **Devuelve el reporte completo**, no un `{ ok: true }` (`app/api/cron/route.ts:212-232`). Lo que sobrevive es el
  sello de `negocio.tareas_programadas`.

### 2.2 · Los ocho horarios

Del mapa `HORARIOS` (`lib/negocio/barrido.ts:176-406`), indexado por la cadena literal del horario:

| horario (UTC) | en Lima | tareas, en orden | umbral de atraso | desde |
|---|---|---|---|---|
| `*/10 * * * *` | cada 10 min | `contactos` (con la pasada de miniaturas), `mensajes`, `auditoria` | 80 min | antes del 2026-09-15; miniaturas el 2026-10-11 |
| `3 * * * *` | al minuto 3 | `citas`, `sonda` | 180 min | antes del 2026-09-15 |
| `17 6 * * *` | 01:17 | `mejora`, `anuncios` | 3.000 min | `anuncios` el 2026-09-16 |
| `41 * * * *` | al minuto 41 | `analizadores` | 180 min | 2026-09-23 |
| `7 10 * * *` | 05:07 | `reintentos` | 2.940 min | 2026-09-23 |
| `23 * * * *` | al minuto 23; a cada empresa, una vez por día después de las 6:00 de su zona | `senales` | 2.940 min | 2026-10-05 |
| `53 * * * *` | al minuto 53 | `anuncios_relleno` | 180 min | 2026-10-07 |
| `37 * * * *` | al minuto 37 | `activos` | 180 min | 2026-10-15 |

Están en `lib/negocio/barrido.ts:248-252`, `:252-256`, `:289-293`, `:308-312`, `:336-340`, `:367-371`, `:323-327` y
`:351-355`, y en `vercel.json:6-39`. Lima está en UTC−5 todo el año (`lib/negocio/barrido.ts:340-341`). Los minutos
no son adorno: dos horarios en el mismo minuto se frenan por el candado y uno queda `frenada` sin trabajar
(`lib/negocio/barrido.ts:254-257`, `lib/negocio/barrido.ts:278-280`), y cada horario nuevo eligió el suyo entre los
libres (`lib/negocio/barrido.ts:329-330`, `lib/negocio/barrido.ts:357-358`). Las pruebas atan el mapa a la
configuración:

- cada horario de `vercel.json` tiene entrada en `HORARIOS` y cada entrada está en `vercel.json`
  (`pruebas/codigo/99-cron.test.ts:80`, `:92`);
- el umbral es al menos `2 × cadencia + 60` (`lib/negocio/barrido.ts:167-174`, prueba en
  `pruebas/codigo/99-cron.test.ts:104`); `senales` dispara cada hora pero su cadencia es diaria, y su umbral es el de
  una tarea diaria (`lib/negocio/barrido.ts:365-370`);
- un horario ausente o desconocido corre **todas** las tareas y lo dice con `horarioDesconocido`
  (`lib/negocio/barrido.ts:610-620`, prueba en `pruebas/codigo/99-cron.test.ts:227`);
- el relleno corre sólo en su horario, cada hora (`3bd2d58:pruebas/codigo/99-cron.test.ts:354`).

El plan de Vercel es **Pro, confirmado el 2026-08-28** (`lib/negocio/barrido.ts:186`); con Hobby, un horario más
frecuente que uno diario hace fallar el despliegue (`lib/negocio/barrido.ts:180-182`).

### 2.3 · El bucle

- **Es reconciliación, no una cola** (`lib/negocio/barrido.ts:15-24`).
- **La sonda va primero**, en su propio `try/catch` (`lib/negocio/barrido.ts:649-667`).
- **Las empresas van por sello más viejo**, y las que nunca corrieron o quedaron `sin_tiempo`, antes que todas
  (`lib/negocio/barrido.ts:669-705`, `lib/negocio/barrido.ts:1287`).
- **El presupuesto es de 180 s** y se mira antes de cada empresa (`lib/negocio/barrido.ts:424`). Es un guardia
  parcial: una sola llamada colgada puede esperar 240 s y Vercel corta la función a los 300
  (`lib/negocio/barrido.ts:411-422`). Los Analizadores y la pasada de los detectores, que corren solos, tienen hasta
  285 s (`lib/negocio/barrido.ts:436`, `lib/negocio/barrido.ts:1000-1004`).
- **Qué credencial pide cada tarea.** `auditoria`, `mejora`, `analizadores`, `reintentos`, `senales` y `activos` no
  piden el token del CRM (`lib/negocio/barrido.ts:764-772`); cada una se saltea con su propio texto si le falta lo suyo
  (`lib/negocio/barrido.ts:779-801`).
- **El sello se escribe siempre**, también si la tarea no corrió, con `on conflict do update` y nunca un `+1`
  (`lib/negocio/barrido.ts:1303-1344`). Los estados son `corrio`, `saltada`, `frenada`, `sin_tiempo` y `fallo`
  (`lib/negocio/barrido.ts:151-152`). La pasada de los detectores es la excepción: a la empresa a la que no le tocaba,
  no la sella (`lib/negocio/barrido.ts:986-1005`).

**Cuánto dura una corrida** se midió el 2026-09-28 (horario `*/10`, 93 s de los 180 del presupuesto, ~75 de la única
empresa con token). **No se volvió a medir**; desde el 2026-10-11 esa misma corrida suma la pasada de hasta 50
miniaturas (`lib/negocio/miniaturaDelContacto.ts:45`, llamada en `lib/negocio/barrido.ts:1094-1098`).

### 2.4 · Las doce tareas

| tarea | módulo | qué hace | llamadas en el último sello de `aria`, 2026-10-18 |
|---|---|---|---|
| `sonda` | `lib/deteccion/sonda.ts:103` | busca filas de una organización de control vistas desde la otra | 0 al proveedor; **no deja sello** |
| `contactos` | `lib/negocio/sincronizar.ts:156` y `lib/negocio/miniaturaDelContacto.ts:159` | trae los contactos por etiqueta de territorio y pide las miniaturas que faltan | 8 |
| `mensajes` | `lib/negocio/ingesta.ts:108` | camina las conversaciones por marca de agua | 1 |
| `auditoria` | `lib/auditor/analisis.ts:332` | audita las conversaciones del agente de IA que avanzaron | 0 inferencias |
| `citas` | `lib/negocio/citas.ts:147` | relee la ventana de −14 a +45 días (`lib/negocio/citas.ts:75`, `:81`) | 11 |
| `mejora` | `lib/auditor/buscarMejora.ts:149` | una mejora de prompt por día y por cliente activo (desde C4; con un solo cliente, por empresa) | 1 inferencia |
| `anuncios` | `3bd2d58:lib/negocio/recolectarAnuncios.ts:511` | el costo diario por anuncio y el gasto de toda la cuenta, vía GoHighLevel | 8 |
| `anuncios_relleno` | `3bd2d58:lib/negocio/rellenarAnuncios.ts:206` | busca qué campaña gastó en los días que no cuadran con la cuenta; con todo cuadrado no llama | 0 |
| `activos` | `lib/negocio/recolectarActivos.ts:195` | la miniatura y el post de cada anuncio, de Meta | `saltada`: sin token de Meta |
| `analizadores` | `lib/analizadores/tarea.ts:75` | descubre, analiza, completa fichas y clasifica objeciones | 2 |
| `reintentos` | `lib/analizadores/tarea.ts:231` | reintenta los análisis fallidos, con tope de 3 (`lib/analizadores/tarea.ts:207`) | 0 |
| `senales` | `lib/agentes/detectores/correr.ts:143` | la pasada diaria de los detectores y el Plan de acción de cada departamento | 8 (las redacciones) |

- **`contactos` va antes de `mensajes`, y eso es corrección, no gusto** (`lib/negocio/barrido.ts:200-204`; prueba en
  `pruebas/codigo/99-cron.test.ts:150`). `auditoria` va después de `mensajes` para no juzgar un transcript incompleto
  (`lib/negocio/barrido.ts:230-235`).
- **`anuncios` relee hoy y los dos días anteriores** (`3bd2d58:lib/negocio/recolectarAnuncios.ts:62`), porque Meta corrige
  hacia atrás (`3bd2d58:lib/negocio/recolectarAnuncios.ts:11-19`). Desde la `076` lee también el gasto de toda la cuenta, y lo
  que no cuadra lo busca el relleno con su propio presupuesto (`lib/negocio/barrido.ts:293-296`,
  `3bd2d58:lib/negocio/rellenarAnuncios.ts:66`). Su detalle es de [01-ACQUISITION.md](01-ACQUISITION.md) y
  [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md).
- **`activos` corre cada hora** porque la URL de la miniatura vence, y sin token se sella `saltada` sin llamar a nadie
  (`lib/negocio/barrido.ts:350-355`). Su detalle es de [02-CREATIVE.md](02-CREATIVE.md).
- **Los Analizadores corren solos y cada hora** (`lib/analizadores/tarea.ts:1-25`); su detalle es de
  [14-ANALIZADORES.md](14-ANALIZADORES.md).
- **La lista de tareas la cierra también la base**: el `check` de `tareas_programadas.tarea` acepta exactamente las
  doce desde la `078` (`db/migraciones/078_el_activo_del_anuncio.sql:65-68`); la `072` y la `076` lo habían ampliado
  antes.

### 2.5 · El aviso del CRM

`POST /api/avisos/crm` es el webhook. La cabecera trae una pimienta global y el secreto de la empresa, y la global se
compara antes de tocar la base (`app/api/avisos/crm/route.ts:17`, `:31`); el evento viaja en `?evento=`
(`app/api/avisos/crm/route.ts:213`); responde **siempre 200** salvo que falle nuestra base
(`app/api/avisos/crm/route.ts:61-70`); y tiene `maxDuration = 10` (`app/api/avisos/crm/route.ts:93`). Hay siete
eventos declarados (`lib/ghl/avisos.ts:65`).

Medido el 2026-10-18:

- **Sigue llegando un solo evento, `mensaje.entrante`**: 342 filas (327 el 2026-09-28).
- El último aviso se procesó el **2026-10-17 a las 06:07 UTC**.
- De los 6.478 mensajes, **318 entraron por el aviso**, **6.158 por la ingesta** y 2 son propios (el 2026-09-28: 303,
  5.805 y 2).

### 2.6 · Los disparos manuales, que siguen vivos

El Closer y el Setter piden la ingesta desde el navegador, cada 10 s mientras la pestaña está a la vista
(`components/views/CloserView.jsx:176`; `components/views/SetterView.jsx:237`, `:242` →
`app/api/mensajes/ingesta/route.ts:85`), la Agenda tiene su botón de refresco (`components/closer/Agenda.jsx:173` →
`app/api/closer/agenda/refrescar/route.ts:86`) y la lista de contactos el suyo
(`components/negocio/ListaDeContactos.jsx:234` → `app/api/contactos/sincronizar/route.ts:84`). Lo que impide que
pestañas y cron se pisen es el pulso: un candado `.forUpdate().skipLocked()` para el reclamo y un alquiler de 10 s
para todo lo demás (`lib/negocio/pulso.ts:12-25`, `:114`; `lib/cadencia.ts:40`). Con varios clientes (el nivel 3,
G4), cada una trae a los clientes activos que su pantalla lee, de a uno, con su token y en su ámbito, con el
presupuesto mirado antes de cada uno salvo el primero; el calendario y la ingesta, con el turno por el sello del
pulso, y la sincronización, en el orden de la sesión (`lib/negocio/traerDeLosClientes.ts:92`).

La cuarta es `POST /api/sonda`, con su propio secreto, `SONDA_TOKEN`, comparado con `timingSafeEqual`
(`app/api/sonda/route.ts:16-17`, `:46-47`). Ninguna entrada de `vercel.json` la llama: la sonda programada corre
dentro de `/api/cron`, al minuto 3, y su encabezado todavía dice que «lo llama una tarea programada»
(`app/api/sonda/route.ts:3`). El despliegue la usa como chequeo a mano (`docs/OTROS/produccion/DESPLIEGUE.md:408`).

**`GET /api/control`**, de la Etapa 3, pide `NINGUNA` capacidad y `SIN_SECCION` (`app/api/control/route.ts:25-26`,
`:35`), lee `control_aislamiento` con `conOrganizacion` (`app/api/control/route.ts:40-46`) y figura entre las rutas sin
pantalla (`lib/autorizacion/secciones.ts:536`). Nada del repositorio llama al manejador (búsqueda del 2026-09-28, no
repetida); las pruebas arman peticiones con ese camino y se las pasan al portero (`pruebas/base/40-portero.test.ts:293`).
Su encabezado dice ser «la sonda que la Etapa 8 necesita» (`app/api/control/route.ts:22-23`), y la sonda programada no
pasa por ella (`lib/deteccion/sonda.ts:119-121`).

---

## 3 · Cómo se sabe si un dato está fresco

**El sello es la única evidencia durable de que el cron corre.** Hay una fila por par (empresa, tarea) en
`negocio.tareas_programadas`; la consulta para mirarla a mano está en `docs/OTROS/produccion/DESPLIEGUE.md:337-352`.

`frescuraDe(tarea)` la convierte en un aviso (`lib/negocio/frescura.ts:116`) con cuatro estados —`nunca`,
`atrasada`, `fallando`, `al_dia`— de los que sólo el último se calla (`lib/negocio/frescura.ts:50-59`). El umbral es
el de los horarios que corren la tarea (`lib/negocio/frescura.ts:72`), y un `fallo` se avisa antes de mirar el umbral
(`lib/negocio/frescura.ts:156`); `saltada`, `frenada` y `sin_tiempo` no se avisan (`lib/negocio/frescura.ts:153-154`).
`frescuraDelAviso()` hace lo mismo con el webhook, con `llega_sin_procesar` y un umbral de 120 minutos
(`lib/negocio/frescura.ts:260-266`, `:282`, `:309`).

**Quién la lee** (búsqueda de `frescuraDe(` en `lib/`, `app/` y `components/`, 2026-10-18): la Agenda del Closer
(`lib/negocio/agenda.ts:364`), el chat de la ficha (`lib/negocio/ficha.ts:303`, `:303`), Leads Portal
(`app/api/leads-portal/route.ts:65-66`), Conversion (`app/api/conversion/route.ts:49`), y desde los agentes: el
**comentario de la cabecera** de cada departamento (`lib/agentes/cabecera.ts:127`, `lib/agentes/cabecera.ts:175`,
`lib/agentes/cabecera.ts:185`), los detectores, que no publican lo que no pueden medir
(`lib/agentes/detectores/creative.ts:123`; Conversion y Conversation, por cliente activo desde C6 · D3,
`lib/agentes/detectores/clientes.ts:68`), y una herramienta del cerebro que lee la frescura de las tareas
(`lib/agentes/executive/adaptadores/plataforma.ts:58`). **Lo que nadie lee es el motivo del sello**:
`ultimo_motivo` sólo lo nombra el tipo del esquema fuera de quien lo escribe (`lib/datos/esquema.ts:790`).

**La frescura por tabla, medida el 2026-10-18 hacia las 15:42 UTC:**

| tabla | marca | valor | lectura |
|---|---|---|---|
| `contactos` | `max(sincronizado_el)` | 15:40:10 | 588 de 624 releídos en la última hora (a las 16:11); los 36 restantes, § 8 |
| `citas` | `max(sincronizado_el)` | 16:03:20 (a las 16:05) | 16 releídas en las últimas 2 h |
| `avisos_del_crm` | `max(procesado_el)` | 2026-10-17 06:07 | ~34 h |
| `anuncios`, `metricas_de_anuncio` | `max(sincronizado_el)` | 06:18 | la pasada diaria de las 06:17; último día con gasto > 0, el **2026-10-14** |
| `analizador_llamadas` | `max(creado_el)` | 2026-10-12 18:41 | ver [14-ANALIZADORES.md](14-ANALIZADORES.md) § 4 |
| `hallazgos` | `max(detectado_el)` | 2026-10-06 16:40 | 27 filas, las 27 sin `resuelto_el` |
| `incidentes` | `max(creado_el)` | 2026-10-05 15:30 | 1 fila |

---

## 4 · La base: esquemas, 49 tablas nuestras, 78 migraciones

**Una base, varias plataformas.** El proyecto de Supabase aloja otras herramientas, y lo nuestro se distingue por el
**esquema**: `identidad`, `negocio` y `migraciones`. Medido en `pg_class` el 2026-10-18:

| esquema | de quién | tablas | RLS forzada | políticas |
|---|---|---|---|---|
| `identidad` | nuestro | 11 (+1 vista) | 11 | 19 |
| `negocio` | nuestro | **49** (29 el 2026-09-28) | **49** | 49, una por tabla |
| `migraciones` | nuestro | 2 | 0 | — |
| `public` | compartido | 27: 6 `aria_cc_*` que leemos, 16 `clientos_*` de una herramienta externa sin repositorio en este proyecto y 5 de bots de otra herramienta | — | — |
| `respaldo_aria_brain` | respaldo | 12, las de ARIA Brain | — | — |
| `aria_leads`, `aria_pool` | ARIA Leads, otro producto | 5 (+1 vista) y 1 | — | — |

**La limpieza del 2026-10-12 y 2026-10-13**, hecha con el OK del usuario y con respaldo fuera de la base (el plan y
el registro están en `docs/OTROS/produccion/PLAN-DE-LA-BASE.md`, local, fuera de git): se borraron las tablas `ht_*`
y `ob_*` de dos aplicaciones de análisis retiradas —**no** las `negocio.analizador_*`, que siguen intactas— y las de
Closer v1, la plataforma anterior (`public.closer_*`, con sus vistas, funciones y tipos); y las de ARIA Brain pasaron
de `public` a `respaldo_aria_brain`. Medido el 2026-10-18: en `public` hay **0** tablas `closer_*`, `ht_*`, `ob_*`,
`aria_brain_*` y `agentforge_*`, y 0 funciones `closer_*`. Antes de cada borrado se comprobó que
`negocio.ingesta_pulso` siguiera avanzando; el 2026-10-18 lo sigue haciendo (§ 7). **Pendientes de seguridad de la
base**: la misma revisión del 2026-10-12 dejó permisos de producción por corregir, revisados ese día, con su plan fuera
del repositorio a propósito.

**Las `aria_cc_*`.** `lib/datos/esquema.ts:2383-2388` tipa seis; en producción hay seis, y no son las mismas:
`aria_cc_scraper_mediciones` **sigue sin existir** (`to_regclass` nulo, 2026-10-18) aunque el código la escribe
(`lib/tools/medicion.ts:65`, `:94`, dentro de un `catch`, `lib/tools/medicion.ts:71-76`), y `aria_cc_icp_oferta`
existe sin estar tipada: la lee un disparador (`lib/fundaciones/estado.ts:50-51`). El detalle es de
[15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md) § 6.

**Cómo se aísla una tabla.** Toda tabla de `negocio` pasa por `negocio.aplicar_aislamiento`, que habilita **y fuerza**
la RLS, revoca `public` y crea una política para `app_inquilino` con `org_id = current_setting('app.org_id')`
(`db/migraciones/008_aislamiento_de_negocio.sql:151-158`). La aplicación pone esa variable con `set_config(…, true)`
dentro de la transacción de `conOrganizacion`, después de comprobar que la conexión llegó limpia, y la vuelve a leer:
si no quedó puesta, lanza (`lib/datos/contexto.ts:123@972972e`, el código de producción). En local, desde `d424d8b`,
pone además `app.cuentas = '*'` con la misma verificación (`lib/datos/contexto.ts:207-208`,
`lib/datos/contexto.ts:222-228`): sin la política nueva de la Fase 0, no cambia nada (§ 11).

**Los roles.** En producción, tres: `migrador`, `app_inquilino` y `app_identidad`, todos `nobypassrls`
(`db/arranque/000_cluster.sql:34`, `:42`, `:51`); medido en `pg_roles` el 2026-10-18: 0 superusuarios y 0 con
`rolbypassrls`, y ninguno de los tres roles nuevos de la Fase 0 existe todavía. Producción es PostgreSQL **17.4**
(`server_version`, 2026-10-18).

**Las migraciones.** 78 filas en `migraciones.migraciones_aplicadas`, la última `078_el_activo_del_anuncio`. Las
dieciséis desde la foto anterior, con la hora de aplicación (de esa tabla) y el commit que las trajo:

| migración | qué | commit | aplicada (UTC) |
|---|---|---|---|
| `063` | el link manual de una pieza de Creative | `1159c43` | 09-30 16:15 |
| `064` | el token de Meta y la cuenta publicitaria, en las credenciales | `ecfbc26` | 09-30 16:15 |
| `065`, `066` | los nombres de las campañas; el funnel de cada una | `fd553b7`, `e77d31f` | 10-01 03:10 |
| `067` | los incidentes del modelo, y la sección `incidentes` | `46c5556` | 10-01 06:31 |
| `068` | el análisis del Espía | `6ef4183` | 10-03 20:18 |
| `069`, `070` | el uso de la IA; el incidente no retiene a la persona | `d75f3be`, `cd851b3` | 10-04 23:21 (hito H1) |
| `071` | las conversaciones, mensajes, preguntas y topes del cerebro | `ce8ff6e` | 10-05 15:24 (H2) |
| `072` | las señales, los planes de acción y los umbrales; la tarea `senales` | `d715b2a` | 10-06 00:13 (H3) |
| `073` | las objeciones clasificadas | `3170786` | 10-06 01:59 |
| `074` | los briefs del closer | `e5d6c98` | 10-06 02:52 |
| `075` | la Reunión de hoy | `d8effd3` | 10-06 17:35 (H5) |
| `076` | el gasto de toda la cuenta; la tarea `anuncios_relleno` | `22ec755` | 10-07 21:28 |
| `077` | la miniatura del contacto | `90439cf` | 10-11 20:43 |
| `078` | los activos de anuncio de Meta; la tarea `activos` | `972972e` | 10-15 22:17 |

Que cada una se aplicó **antes del push** que llevó su código es lo que registra el plan de los agentes para sus
hitos (`docs/OTROS/agentes/08-LAS-ETAPAS.md:16`); la hora de cada push **no se volvió a medir** con `gh` para esta
foto. Las veinte tablas nuevas de `negocio`: `enlaces_de_pieza`, `campanas`, `funnels_de_campana`, `incidentes`,
`analisis_del_espia`, `uso_de_ia`, las cuatro del cerebro, `senales`, `planes_de_accion`, `umbrales`,
`objeciones_clasificadas`, `briefs_del_closer`, `reuniones_del_dia`, `gasto_de_la_cuenta`, `lecturas_de_gasto`,
`miniaturas_del_contacto` y `activos_de_anuncio`. La regla de migrar antes de empujar y sus incidentes están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 8.

**El uso de la IA** (`069`): una fila por llamada al modelo, con sus cuatro contadores, su duración y su resultado, sin
una palabra del prompt ni de la respuesta (`db/migraciones/069_el_uso_de_la_ia.sql:38-77`). La escribe sólo
`lib/agentes/uso.ts`. Medido el 2026-10-18: **208 filas**, todas de `aria`.

---

## 5 · La suite, la CI y el despliegue

### 5.1 · La suite

- **264 archivos de prueba en `972972e`**: 146 en `pruebas/codigo/`, 117 en `pruebas/base/` y 1 en
  `pruebas/construccion/` (178 el 2026-09-28). En local, con la Fase 0, 265 (`pruebas/base/257-el-modelo-fase-0.test.ts`).
- **3.055 pruebas con la base de producción**, según el mensaje de `d424d8b` (2026-10-16), el primer commit de la Fase 0,
  que no toca la base; **3.074 con la Fase 0 entera** (mensaje de `dc84cb2`). Eran 2.273 el 2026-09-28. **No
  re-corrida para esta foto.**
- **El corredor** aborta si la lista sale vacía (`scripts/pruebas.mjs:1-13`, `:82-89`) y corre **de a un archivo**
  porque las pruebas de base comparten una base (`scripts/pruebas.mjs:113-128`).
- **Las tres zonas —`America/Lima`, `UTC` y `Asia/Tokyo`— siguen siendo una práctica, no una máquina**: la CI corre la
  suite una vez, sin fijar `TZ` (`.github/workflows/verificar.yml`). Dos archivos cambian `process.env.TZ` adentro
  (`pruebas/codigo/98-agenda.test.ts:235-239`, `pruebas/base/92-mi-dia.test.ts:816-819`).
- **Las pruebas de agenda que dependen de la hora del día** siguen escritas igual (`pruebas/base/27-agenda.test.ts:218`,
  `:233`, `:676`; `pruebas/base/92-mi-dia.test.ts:473`, `:486`); la 205, que fallaba de mañana, se arregló el 2026-10-07
  (`ae30048`).

### 5.2 · La CI

`verificar` corre en cada push a `main` y en cada PR: `npm ci`, `npm run build`, `npm run tipos`, `npm run db:reset` y
`npm test`, con 20 minutos de tope (`.github/workflows/verificar.yml`). **No se leyó GitHub para esta foto.** La última
lectura, del 2026-09-28, daba 47 corridas verdes y 2 rojas desde el 2026-09-15 —las dos por las pruebas de la hora— y
`main` **sin protección de rama**.

### 5.3 · El despliegue

- **Vercel despliega por push, no por chequeo** (`docs/OTROS/produccion/DESPLIEGUE.md:395`). La protección de rama
  figura como pendiente (`docs/OTROS/produccion/DESPLIEGUE.md:443`).
- **Desde el 2026-10-03 las funciones corren en `gru1`**, São Paulo, la misma región que la base (`vercel.json:3-5`).
- **La protección de despliegue estaba en Standard** (`docs/OTROS/produccion/DESPLIEGUE.md:305-309`), medido el
  2026-08-26 y **no re-medido**. Lo que zanja que el cron corre son los sellos cada diez minutos (§ 7). Que pasarla a
  «All Deployments» lo apague en silencio lo afirma la ruta (`app/api/cron/route.ts:60-61`); no verificado.
- **Cómo se comprueba después de un push**: `docs/OTROS/produccion/DESPLIEGUE.md:399-414`.

---

## 6 · La paridad con el prototipo, y el grafo

**La paridad** se retiró en la etapa E7 de la nueva estructura (2026-10-01): con `VISTAS` y `PASOS` vacías, el guardián
imprime «retirada» y sale 0 (`scripts/paridad.mjs:301-305`). Las pantallas que volvieron al prototipo después
(Acquisition, Conversion, Sales, Conversation, Creative) se compararon en el navegador, etapa por etapa, cada una con
su documento.

**El grafo** es de [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md): sirve para ubicar; nunca prueba que algo no
existe.

---

## 7 · Datos: volúmenes por tabla y última corrida

**Las 49 tablas de `negocio`**, conteo exacto el 2026-10-18 hacia las 15:42 UTC. Cada tabla con filas es de una sola
organización (`count(distinct org_id)` = 1), salvo `control_aislamiento` —las dos de control— y las tres que se
escriben por empresa sin el CRM: `tareas_programadas`, `planes_de_accion` y `reuniones_del_dia`, de las once activas.

| tabla | 2026-10-18 | 2026-09-28 |
|---|---|---|
| `mensajes` | 6.478 | 6.110 |
| `metricas_de_anuncio` | 4.918 | 3.318 |
| `lecturas_de_gasto` | 2.929 | — (nace en la `076`) |
| `planes_de_accion` | 1.152 | — (`072`) |
| `contactos` | 624 | 594 |
| `miniaturas_del_contacto` | 526 | — (`077`) |
| `citas` | 368 | 333 |
| `avisos_del_crm` | 342 | 327 |
| `campos_del_crm` | 212 | 195 |
| `uso_de_ia` | 208 | — (`069`) |
| `reuniones_del_dia` | 143 | — (`075`) |
| `analizador_llamadas`, `analizador_transcripciones` | 135 y 135 | 115 y 115 |
| `anuncios` | 129 | 79 |
| `tareas_programadas` | 121 | 88 |
| `analisis_del_agente` | 102 | 70 |
| `objeciones_clasificadas` | 89 | — (`073`) |
| `analizador_analisis` | 65 | 51 |
| `campanas`, `gasto_de_la_cuenta` | 62 y 62 | — (`065`, `076`) |
| `analizador_prospectos` | 55 | 46 |
| `cambios_de_territorio` | 52 | 12 |
| `analizador_fichas` | 41 | 38 |
| `mensajes_del_executive` | 39 | — (`071`) |
| `senales` | 30 | — (`072`) |
| `hallazgos` | 27 | 24 |
| `carpetas_del_crm` | 26 | 25 |
| `preguntas_del_executive` | 20 | — (`071`) |
| `analizador_lapidas` | 13 | 13 |
| `conversaciones_del_executive` | 12 | — (`071`) |
| `enlaces_rapidos` | 10 | 10 |
| `notas`, `resultados` | 7 y 7 | 7 y 7 |
| `tareas` | 4 | 4 |
| `closer_asignado`, `comisiones`, `ingesta_pulso` | 3, 3 y 3 | 3, 3 y 3 |
| `analisis_del_espia`, `control_aislamiento` | 2 y 2 | — y 2 |
| `incidentes`, `topes_del_executive` | 1 y 1 | — |
| `activos_de_anuncio`, `briefs_del_closer`, `enlaces_de_pieza`, `funnels_de_campana`, `umbrales` | **0** | — |
| `llamadas`, `prompts_del_agente`, `versiones_del_prompt` | **0, 0 y 0** | 0, 0 y 0 |

**`identidad`**, en agregado, el 2026-10-18: 13 organizaciones, 11 activas; 15 usuarios, 119 sesiones, 326 filas de
auditoría de accesos, 42 asignaciones de sección, 3 roles, 38 permisos. De las 11 activas: **1 con token del CRM**,
**5 con llave de IA**, **1 con llave de tl;dv**, **1 con secreto del aviso** y **0 con token de Meta**. El detalle es
de [16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md).

**La última corrida por tarea**, leída el 2026-10-18, en la única empresa con token (`aria`); las otras diez activas
tienen su par en `saltada` con su motivo, salvo `senales`. Ninguna de las 121 filas está en `fallo`, `frenada` ni
`sin_tiempo`, y en `aria` ninguna tiene motivo:

| tarea | última corrida (UTC) | estado | llamadas |
|---|---|---|---|
| `contactos`, `mensajes`, `auditoria` | 15:40 | `corrio` | 8, 1 y 0 |
| `citas` | 15:03 | `corrio` | 11 |
| `analizadores` | 15:41 | `corrio` | 2 |
| `activos` | 15:37 | `saltada` (sin token de Meta) | 0 |
| `anuncios_relleno` | 14:53 | `corrio` | 0 |
| `senales` | 11:23 | `corrio` | 8 |
| `reintentos` | 10:07 | `corrio` | 0 |
| `anuncios`, `mejora` | 06:18 | `corrio` | 8 y 1 |
| `sonda` | — | — | no se sella (§ 8) |

**El pulso de la ingesta** (tres filas, las tres de la misma empresa), el 2026-10-18: `mensajes` 13.106 corridas y
16.921 llamadas desde el 2026-08-26; `citas` 1.227 corridas y 12.318 llamadas; `auditoria` 6.854 corridas y 26
inferencias, con `atrasado = true` (también el 2026-09-28). El 2026-09-28 eran 10.208, 754 y 4.014 corridas.

---

## 8 · Lo que falta

- **La protección de rama en `main`** con `verificar` requerido (§ 5.2).
- **Un rastro durable de la sonda.** `selloMasViejo` y el bucle la dejan fuera del sello a propósito
  (`lib/negocio/barrido.ts:1245`, `lib/negocio/barrido.ts:883-893`), así que su resultado vive sólo en la respuesta
  del cron. `negocio.control_aislamiento` tiene sus dos filas de control.
- **El canal de avisos** (`AVISO_URL`, `AVISO_DESTINO`) figura como pendiente (`docs/OTROS/produccion/DESPLIEGUE.md:241-243`,
  `:444`); sin él, la sonda que detecte una fuga sale como `fallo` en la respuesta del cron
  (`lib/negocio/barrido.ts:656-666`). **No verificado** si hoy está cargado en Vercel.
- **Verificar el certificado de la base.** Las cadenas piden `sslmode=require`, que **cifra y no verifica el
  certificado** (`docs/OTROS/produccion/DESPLIEGUE.md:596-616`, `:623-632`); el guardia sólo exige que haya `sslmode`
  (`lib/datos/anfitrion.ts:204-208`, `:233-235`).
- **Leer el motivo del sello.** Desde AG15 las pantallas dicen si una tarea nunca corrió, falló o está atrasada, pero
  una llave rechazada que deja la tarea en `corrio` con motivo no la dice ninguna (§ 3).
- **Las tres zonas en la CI**, y el arreglo de las pruebas que dependen de la hora (§ 5.1).
- **La espera externa corta para el camino del cron** (`lib/negocio/barrido.ts:419-422`).
- **Los contactos congelados siguen afirmando una frescura que no tienen, y crecen.** `congelarLosQueYaNoEstan` pone
  `territorio = null` sin tocar `sincronizado_el` (`lib/negocio/sincronizar.ts:307-315`): medido el 2026-10-18, **36 de
  624** sin territorio y sin releer, con sellos entre el 2026-08-24 y el 2026-10-09 (25 de 594 el 2026-09-28).
- **Ocho tablas sin una fila**: las tres de siempre (`llamadas`, `prompts_del_agente`, `versiones_del_prompt`) y cinco
  nuevas que esperan su primer uso —`activos_de_anuncio` (Meta), `briefs_del_closer`, `enlaces_de_pieza`,
  `funnels_de_campana` y `umbrales`—.
- **Una segunda empresa con datos.** El cron recorre once y trabaja en una; toda cifra de volumen y de costo de esta
  foto describe a una sola cuenta.

---

## 9 · Reglas de la plataforma

1. **Reconciliación, no cola** (`lib/negocio/barrido.ts:22-24`, `3bd2d58:lib/negocio/recolectarAnuncios.ts:11-19`).
2. **El sello se escribe siempre, y con `on conflict`, nunca con `+1`** (`lib/negocio/barrido.ts:1293-1344`).
3. **Un horario desconocido corre todo y lo dice** (`lib/negocio/barrido.ts:604-609`).
4. **Umbral ≥ 2 × cadencia + 60**, y el mapa de horarios es bidireccional con `vercel.json`
   (`lib/negocio/barrido.ts:159-174`).
5. **`contactos` antes de `mensajes`, `auditoria` después**, en el mismo horario (`lib/negocio/barrido.ts:200-208`).
6. **Dos horarios no comparten minuto**, o uno queda `frenada` sin trabajar.
7. **La migración va antes del push**, y se pregunta qué **toca** la columna nueva: ver
   [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). La comprobación es comparar `select max(name) from
   migraciones.migraciones_aplicadas` con `ls db/migraciones | tail -1`; **hoy da `078` contra `084`**, y no es un
   olvido: las seis de la Fase 0 esperan su aprobación y su orden (§ 11).
8. **Producción se lee sólo con `scripts/supabase.mjs leer`**, que manda `read_only: true`
   (`scripts/supabase.mjs:21-23`, `:71`). Los roles de la aplicación ven **cero filas sin error** fuera de
   `conOrganizacion`.
9. **Un secreto se compara con `timingSafeEqual`, y nunca se autoriza por el user agent**
   (`app/api/cron/route.ts:33-45`, `app/api/avisos/crm/route.ts:102-112`).
10. **La suite corre de a un archivo, contra una sola base, sin nadie más usándola**; y en tres zonas antes de empujar,
    por práctica (§ 5.1).
11. **Lo nuestro se distingue por el esquema.** Ninguna tabla nuestra vive en `public`; antes de cualquier DDL fuera de
    `identidad` y `negocio`, el objeto es de otra plataforma (§ 4).

---

## 10 · Riesgos

1. **El rojo no frena.** Rama sin protección y despliegue por push (§ 5.2), según la última lectura.
2. **El modo de fallar del cron es el silencio.** Fuera del sello no hay nada, y la sonda ni siquiera deja sello (§ 8).
   Lo que mejoró: desde AG15 la cabecera de cada departamento dice si su tarea nunca corrió, falló o está atrasada.
3. **El presupuesto de la corrida de diez minutos.** Medido el 2026-09-28 en 93 s de 180 con una sola empresa; desde
   el 2026-10-11 suma la pasada de miniaturas. Una segunda empresa de tamaño parecido lo acercaría al tope: es una
   inferencia, no una medición.
4. **Una llamada colgada pasa el tope de la función** (`lib/negocio/barrido.ts:411-422`).
5. **Un cambio de configuración de Vercel apaga el cron sin error** (`app/api/cron/route.ts:56-61`; § 5.3).
6. **Nueve de once empresas activas en `UTC`.** La pasada de los detectores corre a cada empresa después de las 6:00 de
   su zona (`lib/negocio/barrido.ts:365-370`): para esas nueve, a la 1 de la madrugada de Lima. Hoy no tienen datos.
7. **La base compartida.** La limpieza dejó en `public` una herramienta externa viva sin repositorio y tablas de bots
   ajenos; un DDL hecho sin mirar el esquema apaga un producto que nadie está mirando. Y quedan los pendientes de
   seguridad del 2026-10-12 (§ 4).
8. **Documentos y comentarios que ya no dicen la verdad**, verificados hoy contra el código o la base:
   - `docs/OTROS/produccion/DESPLIEGUE.md:254-255` dice que `vercel.json` declara **un** cron diario, y `:356-357` que
     ponerse al día lleva «≈23 días con el cron diario». Hay ocho horarios y doce tareas. El mismo documento dice que
     los registros «en Hobby duran una hora» (`docs/OTROS/produccion/DESPLIEGUE.md:339`) y lista como pendiente «la
     tarea horaria de la sonda» (`:444`), que corre al minuto 3.
   - `app/api/sonda/route.ts:3` dice que a esa ruta «lo llama una tarea programada»; ninguna entrada de `vercel.json`
     la llama.
   - `lib/negocio/barrido.ts:79` hablaba de «las cinco» tareas; `TAREAS` tiene doce (`lib/negocio/barrido.ts:95-114`).
     **Cerrado el 2026-10-18 (`65669f4`)**: hoy dice «Las doce».
   - `lib/negocio/barrido.ts:520` y `app/api/cron/route.ts:196-198` dicen que «solo una empresa de cinco tiene llave de
     IA, y todas las que trabajan tienen token del CRM»; hoy 5 de las 11 activas tienen llave de IA y 1 tiene token.
   - `app/api/cron/route.ts:228-230` describe la retención de registros «en el plan Hobby», y el plan es Pro.
   - `app/api/control/route.ts:22-23` presenta esa ruta como la sonda de la Etapa 8; la sonda programada no la usa.
   - `scripts/comparar-con-brain.sql:26-27` lee una tabla de ARIA Brain que desde el 2026-10-12 ya no está en `public`
     (ver [14-ANALIZADORES.md](14-ANALIZADORES.md) § 5).
9. **Todo el volumen es de una cuenta.** Cualquier cifra de costo, duración o frescura de esta foto cambia de escala
   con la segunda empresa conectada.
10. **La conexión a la base cifra pero no autentica al servidor** (§ 8). Es una debilidad dicha en el propio despliegue
    (`docs/OTROS/produccion/DESPLIEGUE.md:623-632`), no un incidente.

---

## 11 · Construido en local, sin subir: la Fase 0 del modelo de datos multiempresa

**Qué es.** El modelo de datos para que ARIA opere como matriz de muchas agencias: la **organización** sigue siendo la
frontera de la RLS, y se suma la **cuenta** (la subcuenta del CRM) como segunda llave, `cuenta_id`. La propuesta, el
modelo físico, el diccionario y el plan de subida están en `docs/modelo de datos/` (carpeta local, fuera de git); el
plan de subida de esta fase, en `docs/modelo de datos/20-PLAN-DE-SUBIDA-FASE-0.md`.

**Qué está construido**, en ocho commits del 2026-10-16 sobre `main` local, **sin push y sin nada aplicado en
producción** (medido el 2026-10-18: la última migración aplicada es la `078`, no existen los esquemas `catalogo`,
`ingesta` ni `sistema`, ni los roles nuevos):

| commit | paso | qué |
|---|---|---|
| `693a383` | A | el régimen de cada tabla de `negocio`, escrito a mano (`pruebas/apoyo/regimenes-de-negocio.ts`): de una cuenta, de una cuenta o de la organización, o sólo de la organización |
| `d424d8b` | 1 | `conOrganizacion` pone `app.cuentas = '*'` junto a `app.org_id` (`lib/datos/contexto.ts:60`), sin migración |
| `c88b7cf` | 2 | `079`: el esquema `catalogo`, 23 tablas de referencia comunes a todas las empresas (`db/migraciones/079_el_idioma_comun.sql:25`); los roles `ingestor`, `app_ingesta` y `app_analista`, **sin login** (`db/arranque/000_cluster.sql:82-97`) |
| `01baaf2` | 3 | `080`: `identidad.cuentas`, sus credenciales copiadas, `usuarios_cuentas` y `acuerdos`; la fase `cuentas` de `scripts/db.mjs` crea las de hoy |
| `99f6e1e` | 4 | `081`: la bandeja de entrada, esquemas `sistema` e `ingesta`, con la puerta `ingesta.recibir` (`db/migraciones/081_la_bandeja_de_entrada.sql:122`); nada la usa todavía |
| `ce5ed91` | 5a | `082`: `cuenta_id` nulable en 39 tablas de `negocio`, con su puente; la fase `cuenta-en-negocio` rellena las filas de hoy (`scripts/db.mjs:636`) |
| `8ad73f3` | 5b | `083`: `cuenta_id` obligatoria en 26 tablas, las claves «misma cuenta que la madre» y la política por organización **y** cuenta (`db/migraciones/083_la_cuenta_en_negocio_cerrar.sql:1-8`) |
| `dc84cb2` | 6 | `084`: `negocio.eventos`, de sólo agregar y particionada por mes (`db/migraciones/084_los_eventos.sql:117-141`), y las particiones que nacen cerradas |

Las fases nuevas van en el `reset` local, después de sembrar (`scripts/db.mjs:648`). Lo que el diseño validado el
2026-10-14 no había visto y se corrigió al construirlo está escrito en el plan de subida y en los mensajes de cada
commit; el más serio: **una partición de `negocio` no heredaba la RLS de su madre** y, leída directo, mostraba los
eventos de todas las organizaciones; `sistema.crear_particiones` se redefinió para que nazca cerrada
(`db/migraciones/084_los_eventos.sql:22`). La suite completa dio **3.074 de 3.074** con la Fase 0 (mensaje de
`dc84cb2`), con la prueba nueva `pruebas/base/257-el-modelo-fase-0.test.ts`.

**El orden de subida**, según el plan (todo con el OK del usuario y en modo de pedir permiso):

0. **Antes de empezar**: la aprobación del ingeniero, los pendientes de seguridad de la base del 2026-10-12 cerrados y
   una copia de la base del día confirmada.
1. **El código de `app.cuentas`** (`d424d8b`), con su push: sin la política nueva no hace nada.
2. **`079`** y el arranque con los tres roles sin login.
3. **`080`** y, después, la fase `cuentas` (`node --env-file=.env.supabase scripts/db.mjs cuentas`).
4. **`081`**.
5. **`082`**, migrando desde ese commit; **la fase `cuenta-en-negocio`**; y recién después **`083`**. Son dos subidas:
   si la `083` se aplicara antes del relleno, su `set not null` falla y se deshace entera.
6. **`084`**.

Cada paso se comprueba con conteos (filas sin `cuenta_id` en las obligatorias), con `negocio.ingesta_pulso`
avanzando y con el humo de la aplicación; la vuelta atrás de los pasos 5 y 6 es volver a la política de sólo
organización, sin perder datos. **Queda para la Fase 1**: la tarea mensual que cree las particiones —crearlas exige ser
dueño de la tabla madre y el cron corre con los roles de la aplicación—; hasta entonces alcanzan los seis meses que
crea la `084`.

**Lo que cambia para esta foto cuando suba**: `negocio` pasa de 49 a 52 tablas más sus particiones, `identidad` suma
cuatro tablas y una vista, aparecen tres esquemas nuestros (`catalogo`, `ingesta` y `sistema`) y tres roles. Mientras
no suba, nada de esto existe en producción.

## 12 · Construido en local, sin subir: el nivel 3 (los clientes de nuestros clientes)

**Qué es.** Encima de la Fase 0, el back y el front para que cada empresa tenga sus propios clientes (las cuentas) y
para que ARIA los vea a todos en un tablero. Las reglas que suma están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), sección «Construido en local, sin subir: el nivel 3».

**Qué está construido**, en commits del 2026-10-18 al 2026-10-20 sobre `main` local, **sin push y sin nada aplicado en producción**
(cada paso de C5 y C6, con el commit de los arreglos de su revisión):

| commit | paso | qué |
|---|---|---|
| `21556cd` | P0 | los tipos de la Fase 0 en `lib/datos/esquema.ts` |
| `64af614` | P1 | `085`: la cuenta por omisión, una por empresa, y el puente que cae en ella con dos o más clientes |
| `35a853f` | P2 | `conOrganizacion` con un ámbito y la tercera variable, `app.toda_la_organizacion` |
| `143bd13` | P3 | `086`: lo de la organización sólo con la organización entera |
| `35314d6` | P4 | `087`: el cliente final, la sesión con sus cuentas y el paso 3b del portero |
| `0eeeae0` | P5 | las rutas de Leads y Sales, y sus cajas del cerebro, abren su ámbito |
| `a584e6c`, `ba8c149` | P6 | `088`: Ajustes › Clientes en el back, el alta del cliente final y el foco de la sesión |
| `2113dd8`, `a1ba556` | P7 | el selector de cliente, el rótulo del foco y Ajustes › Clientes en el front |
| `0fe13c5` | P8 | `089`: la foto diaria de los negocios y su tarea `foto`, en el horario `29 11 * * *` |
| `8aa321c` | — | los arreglos de una revisión de P0 a P7 (17 hallazgos, ninguno una fuga) |
| `18f61d6` | P9 | la pestaña Negocios, primera de Client Success, sólo del superadministrador |
| `00ccfee` | C1 | `090`: la ingesta en el ámbito de UN cliente, y las claves con el cliente junto a las viejas |
| `69a40fb` | C3 | `091`: cada credencial dice de qué cliente es; el aviso por cliente; Ajustes › Clientes › «Conexión» |
| `742ffee` | C4 | `092`: el cron por cliente (una unidad por cliente activo) y las claves viejas cerradas |
| `ca5fcdc` | — | `093` y los arreglos de dos revisiones del Bloque C: 19 hallazgos de la propia y 34 de los lectores que con dos clientes daban una cifra equivocada |
| `3b26a1c`, `898d6f9` | C5 · G4 | sin migración: la Agenda, el tic de la ingesta y «Traer de GoHighLevel» traen a cada cliente activo con su token y en su ámbito; `medir-mensaje` mide por cliente |
| `4ab6fae`, `8e45088` | C5 · G3 | `094`: la entidad `cliente` de las señales y el funnel en la cuenta de su campaña. La atribución por campaña y las campañas de Acquisition dicen su cliente con varios; un cliente que pauta sin su serie frena los costos, y sólo uno con métricas sin serie frena lo que lee Meta; «sin entrega», la concentración, la escala y el gasto sin crecimiento, por cliente; toda señal de campaña dice su cliente; la serie atrasada mira sólo a los activos, y a uno en pausa se le pide la serie hasta su último día cerrado |
| `3e2d9bf`, `bd7d847` | C5 · G1 | `095`: la clave del link manual pasa a (org, cliente, pieza). La pieza es (cliente, nombre) en la calidad, el rendimiento, la fatiga, la entrega, la miniatura y los activos, con `idDeLaPieza` (el nombre para el principal: las huellas de siempre); con piezas de dos clientes, la tarjeta y la ficha dicen el cliente, «Funciona», la concentración y el ICP comparan dentro de su cliente, y las señales y el cerebro dicen «nombre · cliente», nunca un uuid; la ruta del link valida el cliente con la sesión, y su 404 lo nombra sólo si la sesión ve más de uno |
| `37b8440`, `c669a91`, `f7fbb88` | C5 · G2 | `096`: la clave (org, cliente, persona) y el único del vínculo por cliente, junto a los viejos; `097`: los cierra. El vínculo de un closer con el CRM es de un cliente: «mío» son los pares (cliente, usuario del CRM) en los cinco cortes; Sales y la ficha, por par, y quien trabaja en otro cliente tiene su aviso; el tope sigue en tres personas por empresa; la ruta y la pantalla eligen el cliente (sin él, el principal), y uno ajeno o de baja es 404 |
| `976c914`, `26126b1` | C6 · D1 | sin migración: la agenda, la cabecera de Mi Día, el chat y Leads dicen de qué cliente no está lista la conexión con GoHighLevel y qué hacer, con el texto de su código y sólo del alcance de quien mira; Acquisition y Conversion nombran, después de «Faltan días de gasto.», al cliente que deja el gasto incompleto y por qué (también con el colector atrasado); el alta, la activación, Ajustes › Clientes y la pantalla del vínculo dicen qué closers no ven a un cliente; el tope de tres closers por empresa queda decidido. Con un solo cliente, ninguna respuesta cambia |
| `e9fb8ae`, `f8fbe92` | C6 · D2 | sin migración: «Subir a HighLevel» de Tools manda a n8n el token y la subcuenta del cliente elegido (sin elegir, el principal; uno en pausa es 400, uno ajeno o de baja, 404), y la pantalla muestra el selector sólo con más de un cliente activo; la lista de usuarios del CRM no lee a uno de baja; Tools, esa lista y las cuatro rutas de un contacto dicen la falta de un cliente con su texto; los guiones de medición miden a cada cliente con su token, y con un cliente miden lo mismo (medir-gasto suma S0, si Meta está vinculado); la 277 lista quién pide la de la empresa. Al webhook de n8n viaja el token de cada cliente: un riesgo que decide el usuario (07) |
| `bafb3d7`, `fa3bf28` | C6 · D3 | sin migración: con varios clientes, el ICP, la fuga y el monitor de Acquisition, los patrones de Conversation y las familias y el formulario de Conversion se miden dentro de cada cliente, con el id de siempre para el principal y `<cuenta>:` para otro; el conjunto pasa al freno de Meta; los frenos son por cliente activo —también con los datos de uno solo y otro sin nada, con la anterior del cambio de ruta de su lectura— y el escritor deja sin medición sólo lo del cliente atrasado; la pantalla y el plan dicen de qué cliente es cada señal, nunca con un uuid; la pieza de nombre largo se corta en la señal y ya no hace fallar la pasada de Creative. Con un solo cliente, ninguna huella ni ningún texto cambia |
| `d2dc63a`, `ec2a832` | C6 · D4 | `098`: `campos_del_crm.es_el_puntaje` (uno por cliente, con un índice único parcial) y `carpetas_del_crm.grupo_elegido_el`. Ajustes › Clientes › «Puntaje y Perfil», también para el principal, elige el campo del puntaje y el grupo de cada carpeta; sin elegir, cada subcuenta resuelve lo de antes, id por id. Una sola validación del puntaje (la de la sincronización) también en Creative; al elegir se recalculan todos los contactos del cliente, congelados incluidos; Creative no da «Calificados: 0» al cliente sin campo y lo nombra, también si ninguno a la vista tiene campo (con un solo cliente a la vista, el aviso de siempre); el elegido que ya no está se avisa; el Perfil dice cuando ninguna carpeta se muestra |
| `b727768`, `3f66d89` | C6 · D5 | `099`: `foto_de_las_cuentas.meta_en_el_crm` (nula, sin relleno) y los comentarios de lo que cambió; la foto sube al contrato 2. El paso de Meta de la lista de chequeo pasa a ser «Meta vinculado en su GoHighLevel», requerido, medido con el sello de la pasada del gasto de cada cliente o con su serie; la conexión directa queda como «Miniaturas de Meta», recomendada. Ajustes › Clientes muestra la lista de cada cliente en vivo (`GET /api/admin/cuentas`, que lee de identidad sólo presencias), con qué hacer en cada paso, y Negocios suma «Agregar cliente». Con un solo cliente la lista cambia a propósito: sin Meta en su GoHighLevel, no está configurado |
| `e1d0c7f` | C6 · cierre | `100`: la política de lectura de la `093` pasa a pedir la organización entera; el cliente final lee sólo los closers de sus clientes, y su Sales le da a cada closer un rótulo, `closer-N`, en vez del uuid de la persona. La empresa, entera o enfocada en un cliente, lee y recibe lo de siempre |
| `700ce07` | C6 · cierre | sin migración: la 301 corre la tarea `anuncios` por la ruta del cron con su horario (`17 6 * * *`), con tres clientes y un Ad Manager de GoHighLevel falso que responde a cada token sólo con SU subcuenta y SUS campañas: las campañas, los anuncios, las métricas y la serie de la cuenta quedan en su cliente, y el sello del que no tiene Meta vinculado lo dice |
| `e9d0511` | C6 · cierre (P7) | sin migración: la fase `sembrar-nivel-3` de `scripts/db.mjs`, fuera de `reset` y sólo local, deja la empresa `gamma` con tres clientes (el principal, uno con su Conexión de prueba y uno de prueba), una administradora y un cliente final, y datos sintéticos de los dos primeros; reaplicable, y `quitar-nivel-3` la quita por su slug exacto antes de la suite |
| `c75984c` | C6 · cierre (P10) | sin código: 07 y este documento con todos los commits de C5 y C6 y las decisiones del usuario del 2026-10-20 escritas como tomadas (el tope de tres closers por empresa; el contrato), el tope del mejorador por cliente, y las citas viejas que señaló la auditoría |
| `c743b7a` | C6 · cierre (P10) | sin código: 76 citas de los documentos que audita la 101, casi todas cortas (`:N` después de una cita completa), que el nivel 3 dejó apuntando a otra línea, cada una movida con su contenido comprobado. `reapuntar3.py` sólo mueve la ruta completa y la 101 sólo mira que la línea exista |
| «Nivel 3 · C6 · la siembra, el gasto de punta a punta y lo que el cliente final no lee: los arreglos de su revisión» | C6 · cierre | sin migración: la 302 pide por la ruta, con el foco de la sesión de la empresa en un cliente, que ésta siga recibiendo el id de cada closer (el rótulo es sólo para el cliente final); la cita corta de Sales en `docs/leads-portal/12-QUIEN-VE-QUE.md`, que había quedado en el `GET`, vuelve al `exigir`; y el comentario del horario del mejorador dice el tope por cliente activo |

**Las decisiones del usuario del 2026-10-20**, tomadas: el tope de closers es de **tres por empresa**, para todos sus
clientes (`lib/negocio/closer.ts:238`); los costos de cada cliente salen de SU GoHighLevel con Meta vinculado; Acquisition
no tiene foco por cliente; y **el contrato**: las empresas les avisan a sus clientes que lo que la plataforma recopila
queda en la base de ARIA, que es lo que permite que la foto diaria de los negocios (`089`) guarde cifras por empresa y
por cliente bajo la principal. El detalle, en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), sección «el
nivel 3».

**El cron gana una tarea y un horario.** La tarea `foto` es de la plataforma, como la sonda: corre una vez por
corrida y no por empresa, y se sella bajo la principal (`lib/negocio/barrido.ts:120`). Su horario no descifra ninguna
credencial (`app/api/cron/route.ts:180`), y su umbral de atraso es el de las tareas diarias, 2.940 minutos.

**El orden de subida**, cuando la Fase 0 esté aprobada y cada paso con su OK: la `085` con la fase
`cuenta-por-omision`; desplegar P0 a P2; la `086` con el humo de las pantallas y del cron; la `087` y desplegar P4 y P5;
el catálogo (`cuentas.%` y `negocios.ver`) y desplegar P6 y P7; la `088` y la `089`, y desplegar P8 con el cron nuevo;
desplegar P9. Antes de la `086` hay que comprobar en producción que ningún escritor externo escriba en `negocio` con el
rol del inquilino, y antes de la `087`, hacer un alta externa de humo. Después, el Bloque C: la `090` y C1; la `091`, la
`093` y C3; la `092` **con C3 ya desplegado** (el aviso de C1 escribe con la clave vieja, y desde ahí no se vuelve a un
despliegue anterior a C3); y C4. C5 · G4 (las rutas manuales por cliente) no tiene migración y sube con C4 o
después. C5 · G3: la `094` después de la `093` y antes de desplegar su código (con un segundo cliente, el detector ya
escribe la entidad `cliente`, que sin la `094` el `check` rechaza); con un solo cliente el código anda igual con o sin
ella. La foránea de la `094` no puede fallar en producción: cada empresa tiene un solo cliente. C5 · G1: la `095`
después de la `094` y su código enseguida: entre los dos, «Guardar» el link manual da 42P10 (el `on conflict` de antes
ya no tiene su único), y lo mismo al revés; es un botón de administración, y producción tiene 0 links. C5 · G2: la
`096` después de la `095`, desplegar su código, y la `097` **con G2 ya desplegado**: el `asignarCloser` de antes
escribe con `on conflict (org_id, usuario_id)` y sin ese único daría 42P10, y desde ahí no se vuelve a un despliegue
anterior a G2. Entre G2 y la `097` un closer no se puede vincular en un segundo cliente (la clave vieja lo rechaza);
hoy cada empresa tiene uno. C6 · D1 (los avisos por cliente) no tiene migración: sube con su código después de G2 y de
G3, cuyos vínculos por cliente y frenos del gasto lee; con un solo cliente por empresa ninguna respuesta cambia.
C6 · D2 (lo que usaba las credenciales de la empresa) tampoco tiene migración: sube con C3 ya desplegado (usa los
resolvedores por cliente) y, antes del primer cliente con subcuenta propia, con el flujo de n8n de Tools revisado
(no guardar el token de cada cliente en el historial de sus ejecuciones). C6 · D3 (las señales por cliente) tampoco
tiene migración: escribe la entidad `cliente` del monitor, así que sube con la `094` aplicada (después de G3), y lee los
sellos por cliente de C4; con un solo cliente por empresa ninguna huella cambia. C6 · D4 (el puntaje y el Perfil por
cliente): la `098` **antes** de su código, que nombra las dos columnas nuevas en la sincronización; con el código de
antes la `098` no cambia nada. Con un solo cliente por empresa y nada elegido, nada cambia, salvo dos cosas que se
miden antes con `supabase.mjs leer`: el tercer «falta» del Perfil de una empresa con catálogo y ninguna carpeta con
grupo, y las cifras de Creative si algún valor del puntaje no es un entero de 0 a 100 (el plan local, paso 8.12).
C6 · D5 (la lista de chequeo): la `099` **antes** de su código —el código nuevo escribe `meta_en_el_crm` en la foto, y
sin la columna la tarea `foto` fallaría—; con el código de antes la `099` no cambia nada (la columna queda nula y los
comentarios sólo se leen). La foto todavía no está en producción, así que nace en el contrato 2.
C6 · los closers del cliente final: la `100` después de la `097` (reemplaza la política de la `093`, y desde la `096` el
cliente final tiene en la política de la tabla las filas de sus clientes), con su código o antes: sola ya cierra la base, y el
código sin ella publica el rótulo igual. Con un solo cliente por empresa el cliente final ve los mismos closers y las
mismas cifras, con el rótulo en lugar del uuid.
La prueba del gasto de punta a punta y la siembra `sembrar-nivel-3` no suben nada: la siembra es sólo local (se niega
fuera de un anfitrión local) y no está en `reset`.

**El cron barre por cliente (C4).** Las tareas de un cliente corren una vez por cliente activo, con sus credenciales
(`app/api/cron/route.ts:242`), y su sello lleva su cliente; las de la empresa —los Analizadores, su reintento, los
detectores— corren una vez, con el sello sin cliente. Un orden global por el sello de cada unidad
(`lib/negocio/barrido.ts:702`) y el presupuesto mirado antes de cada una hacen que ningún cliente ni ninguna empresa se
queden sin correr para siempre. Lo que todavía supone una subcuenta está listado en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), sección «el nivel 3».

---

## Cómo se midió, y lo que no se pudo verificar

**Consultas**, todas con `node --env-file=.env.supabase scripts/supabase.mjs leer`, sólo agregados, el 2026-10-18
entre las 15:41 y las 16:12 UTC:

- esquemas, tablas, vistas, RLS forzada y políticas: `pg_class` × `pg_namespace` y `pg_policies`; las de `public`,
  contadas por prefijo; roles: `pg_roles` filtrado a los seis nombres del modelo; `server_version`;
- un `count(*)` y un `count(distinct org_id)` por cada tabla de `negocio`, con `query_to_xml` sobre `pg_class`;
- `migraciones.migraciones_aplicadas`: `count(*)`, `max(name)`, y `name` con `timestamp` desde la `062`;
- credenciales: `count()` de cada columna, sin leer ningún valor;
- `negocio.tareas_programadas` agrupado por tarea y estado, con la última corrida, las llamadas y si hay motivo;
- `negocio.ingesta_pulso`, sin la columna de organización;
- las marcas de frescura (`max` de `sincronizado_el`, `procesado_el`, `creado_el`, `detectado_el`), los mensajes por
  `origen`, los avisos por `evento` y el último día con gasto;
- `to_regclass` de `public.aria_cc_scraper_mediciones` y de la tabla de Brain en `public`.

**Lo que no se pudo verificar:**

- **Nada de Vercel**: despliegues, registros, variables, la protección de despliegue y la retención de registros.
- **GitHub**: la protección de rama y las corridas de la CI no se volvieron a leer.
- **La suite**: no se corrió para esta foto; las cifras son las de los mensajes de commit.
- **La hora de cada push** de las migraciones `063` a `078`.
- **Por qué el pulso de `auditoria` tiene `atrasado = true`**, que según `lib/auditor/analisis.ts:372` significa que
  quedó cola o hubo un corte.
- **Si algo además del chequeo a mano llama a `POST /api/sonda`**.
