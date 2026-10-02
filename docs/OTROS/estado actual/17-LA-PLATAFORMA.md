# La plataforma: cómo entran los datos, dónde viven y qué los vigila
> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **22:01 y las 22:12
> UTC** (`now()` de la base), con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió
> un nombre, un correo ni un teléfono, y de las credenciales sólo si están cargadas o no. El estado
> de GitHub (protección de rama, corridas de la CI) se leyó con `gh` en modo lectura a las ~22:05
> UTC. Cada afirmación lleva su archivo:línea, su commit o la consulta que la produjo.
> Una verificación adversarial re-midió las cifras principales el mismo día entre las 22:25 y las
> 22:30 UTC: coinciden, salvo los contadores que el cron movió en el medio (se dice dónde).
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15**
>
> - **La foto anterior no tenía este archivo.** La plataforma estaba repartida: el costo de las
>   llamadas y los avisos en [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md), la RLS forzada y el
>   orden migración-push en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), y la deuda de
>   frescura en [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md). Acá se junta lo que está debajo de las
>   pantallas; el detalle de GoHighLevel sigue siendo de 06 y el del grafo, de 08.
> - **De 3 horarios y 6 tareas a 5 horarios y 9 tareas.** En el árbol de `93a1341` (la foto
>   anterior) `vercel.json` tenía `*/10`, `3 * * * *` y `17 6 * * *`. Se sumaron `anuncios` al horario
>   diario (`3d96e8c`, 2026-09-16), `analizadores` al minuto 41 (`35665f2`, 2026-09-23) y
>   `reintentos` a las 10:07 UTC (`a434f98`, 2026-09-23).
> - **Trece migraciones, de la `050` a la `062`**, con ocho tablas nuevas. El repositorio tenía 49
>   el 2026-09-15; hoy tiene 62, y producción tiene las 62 aplicadas. Las trece se aplicaron antes del
>   push que llevaba su código (§ 4).
> - **La suite pasó de 1.746 a 2.273 pruebas**, y de 137 a 178 archivos (§ 5). Después del corte, al cerrar
>   la nueva estructura el 2026-10-02, eran 2.445 pruebas en 198 archivos, corridas en las tres zonas.
> - **La compuerta de paridad se quedó sin vistas**: `contacts`, la última, salió el 2026-09-26
>   (`aed4f27`).
> - **Lo que no cambió:** `main` sigue sin protección de rama, y el 2026-09-21 dos corridas rojas de
>   la CI llegaron igual a `main` (§ 5 y § 10).

**Construido y corriendo.**

Un solo punto de entrada —`GET /api/cron`— recibe los cinco horarios de Vercel y reparte nueve
tareas. Medido el 2026-09-28: las ocho tareas que dejan sello **corrieron** en la única empresa con
token del CRM y se **saltearon con su motivo** en las otras diez activas —88 sellos, 8 tareas × 11
empresas—. Los datos de negocio viven en 29 tablas de `negocio` con RLS forzada, y **todo el volumen
es de una sola empresa**: 594 contactos, 333 citas, 6.110 mensajes, 3.318 filas de costo por anuncio.
Lo que más le falta a la plataforma no es código: es **la protección de rama**, sin la cual el rojo
de la CI no frena el despliegue, y **un rastro durable de la sonda de aislamiento**, la única señal
de seguridad activa del sistema, que no deja sello.

---

## 1 · Qué hay: las piezas y dónde viven

| pieza | dónde | qué hace |
|---|---|---|
| El disparador | `vercel.json` | cinco entradas `crons`, todas a `/api/cron`, distinguidas sólo por el horario |
| El punto de entrada | `app/api/cron/route.ts` | autentica, resuelve las empresas y sus llaves, llama al orquestador |
| El orquestador | `lib/negocio/barrido.ts` | qué tareas toca cada horario, en qué orden, con qué presupuesto; sella |
| Las tareas | `lib/negocio/`, `lib/auditor/`, `lib/analizadores/`, `lib/deteccion/` | una por módulo (§ 2.4) |
| El aviso del CRM | `app/api/avisos/crm/route.ts` | el webhook de GoHighLevel; un solo evento llega (§ 2.5) |
| Los disparos manuales | cuatro rutas de `app/api/` | el reloj y los botones del Closer, el Setter y la Agenda, y la sonda a mano; aparte, `GET /api/control`, que nada llama (§ 2.6) |
| La frescura | `lib/negocio/frescura.ts` | convierte el sello en un aviso de pantalla (§ 3) |
| La capa de datos | `lib/datos/contexto.ts`, `lib/datos/capa.ts` | la transacción por organización y la de identidad (§ 4) |
| La base | `db/arranque/`, `db/migraciones/`, `db/sembrado/`, `db/controles/`, `db/vigilancia/` | roles, 62 migraciones, siembra, sonda |
| La suite | `pruebas/`, `scripts/pruebas.mjs` | 178 archivos, 2.273 pruebas (§ 5) |
| La CI | `.github/workflows/verificar.yml` | build, tipos, base desde cero y suite en cada push y cada PR |
| El despliegue | `docs/OTROS/produccion/DESPLIEGUE.md` | el guion y el registro; Vercel despliega por push |
| La paridad | `scripts/paridad.mjs` | compara la app contra `aios-command-center_1.html`; hoy sin vistas (§ 6) |
| El grafo | `graphify-out/` | para ubicar; su detalle es de [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) |
| La lectura de producción | `scripts/supabase.mjs` | `leer` va con `read_only: true` (§ 9) |

---

## 2 · Cómo entran los datos: un cron, cinco horarios, nueve tareas

### 2.1 · El punto de entrada

- **Es un GET que escribe, y no hay otra.** Vercel dispara los cron con GET y el tipo del cron no
  tiene método; un `POST` recibiría un 405 y el cron no correría nunca, sin nada rojo
  (`app/api/cron/route.ts:9-13`). Las corridas duplicadas, que Vercel admite, las frena el candado
  del pulso (`app/api/cron/route.ts:19-21`).
- **La autenticación.** Sin `CRON_SECRET` responde 403 y lo grita en el registro, no en el cuerpo
  (`app/api/cron/route.ts:97-110`); la cabecera trae el prefijo `Bearer ` como parte del valor y se
  compara con `timingSafeEqual` (`app/api/cron/route.ts:84-91`, `:112-114`). Nunca se autoriza por el
  user agent (`app/api/cron/route.ts:44-45`).
- **Vive bajo `/api/`** porque `proxy.ts` redirige todo lo demás a `/entrar`, y una respuesta 3xx
  da la corrida por terminada sin rastro (`app/api/cron/route.ts:49-54`); lo ata
  `pruebas/codigo/99-cron.test.ts:269`.
- **`maxDuration = 300`**, declarado en la ruta y no en `vercel.json` (`app/api/cron/route.ts:81`,
  prueba en `pruebas/codigo/99-cron.test.ts:252`).
- **La fase de identidad va primero y se cierra antes del bucle**: lista las empresas, se queda con
  las activas (`app/api/cron/route.ts:147`) y resuelve en la misma transacción sus tres accesos —al
  CRM, al auditor y a los Analizadores— (`app/api/cron/route.ts:140-162`).
- **Devuelve el reporte completo**, no un `{ ok: true }` (`app/api/cron/route.ts:164-174`). Pero ese
  cuerpo sólo sirve para depurar a mano: lo que sobrevive es el sello de `negocio.tareas_programadas`.

### 2.2 · Los cinco horarios

Del mapa `HORARIOS` (`lib/negocio/barrido.ts:194-278`), indexado por la cadena literal del horario:

| horario (UTC) | en Lima | tareas, en orden | umbral de atraso | desde |
|---|---|---|---|---|
| `*/10 * * * *` | cada 10 min | `contactos`, `mensajes`, `auditoria` | 80 min | antes del 2026-09-15 |
| `3 * * * *` | al minuto 3 | `citas`, `sonda` | 180 min | antes del 2026-09-15 |
| `17 6 * * *` | 01:17 | `mejora`, `anuncios` | 3.000 min | `mejora` antes; `anuncios` el 2026-09-16 |
| `41 * * * *` | al minuto 41 | `analizadores` | 180 min | 2026-09-23 |
| `7 10 * * *` | 05:07 | `reintentos` | 2.940 min | 2026-09-23 |

Lima está en UTC−5 todo el año (`lib/negocio/barrido.ts:270-271`). Los minutos 3, 17, 41 y 7 no son
adorno: dos horarios en el mismo minuto se frenan por el candado y uno queda `frenada` sin trabajar
(`lib/negocio/barrido.ts:200-203`, `:258-259`). Cuatro pruebas atan el mapa a la configuración:

- cada horario de `vercel.json` tiene entrada en `HORARIOS` y cada entrada está en `vercel.json`
  (`pruebas/codigo/99-cron.test.ts:80`, `:92`);
- el umbral es al menos `2 × cadencia + 60`, para que perder una corrida no grite
  (`lib/negocio/barrido.ts:113-120`, prueba en `pruebas/codigo/99-cron.test.ts:104`);
- un horario ausente o desconocido corre **todas** las tareas y lo dice con `horarioDesconocido`,
  nunca «no hacer nada» (`lib/negocio/barrido.ts:389-399`, prueba en
  `pruebas/codigo/99-cron.test.ts:227`).

El plan de Vercel es **Pro, confirmado el 2026-08-28** (`lib/negocio/barrido.ts:132`); con Hobby, un
horario más frecuente que uno diario hace fallar el despliegue (`lib/negocio/barrido.ts:126-128`).

### 2.3 · El bucle

- **Es reconciliación, no una cola.** Vercel no reintenta y admite corridas perdidas y duplicadas;
  nada se acumula ni se incrementa, y el orden se decide cada vez por el sello más viejo
  (`lib/negocio/barrido.ts:15-24`).
- **La sonda va primero**, en su propio `try/catch`: es la única señal de seguridad y cuesta cero
  llamadas (`lib/negocio/barrido.ts:420-438`).
- **Las empresas van por sello más viejo**, y las que nunca corrieron o quedaron `sin_tiempo`, antes
  que todas (`lib/negocio/barrido.ts:440-453`, `:844`). Sin la segunda regla, la que se queda sin
  tiempo se sellaría última y volvería al fondo de la fila para siempre.
- **El presupuesto es de 180 s** y se mira antes de cada empresa (`lib/negocio/barrido.ts:308`). Es un
  guardia parcial: una sola llamada colgada puede esperar 240 s y Vercel corta la función a los 300
  (`lib/negocio/barrido.ts:295-306`). Los Analizadores, que corren solos, tienen hasta 285 s
  (`lib/negocio/barrido.ts:320`).
- **El sello se escribe siempre**, también si la tarea no corrió, con `on conflict do update` y nunca
  un `+1` (`lib/negocio/barrido.ts:875-909`). Los estados son `corrio`, `saltada`, `frenada`,
  `sin_tiempo` y `fallo`; los tres del medio son normales (`lib/negocio/barrido.ts:97-98`,
  `lib/negocio/frescura.ts:154-155`).

**Cuánto dura una corrida, medido en los sellos de la de las 22:10 UTC del 2026-09-28** (horario
`*/10`): van de las 22:10:16 a las 22:11:49, **93 s de los 180 del presupuesto**. Cada una de las diez
empresas sin token se sella en ~1,7 s; la única con token tomó ~75 s, casi todo en `contactos` (su
sello llegó 70 s después de terminar la empresa anterior). Consulta: primer y último sello de
`contactos`, `mensajes` y `auditoria` por empresa, sin slugs.

### 2.4 · Las nueve tareas

| tarea | módulo | qué hace | llamadas en la última corrida (sello de `aria`) |
|---|---|---|---|
| `sonda` | `lib/deteccion/sonda.ts:103` | busca filas de una organización de control vistas desde la otra; avisa si hay fuga | 0 al proveedor; **no deja sello** |
| `contactos` | `lib/negocio/sincronizar.ts:157` | trae los contactos por etiqueta de territorio | 7 |
| `mensajes` | `lib/negocio/ingesta.ts:106` | camina las conversaciones por marca de agua | 1 |
| `auditoria` | `lib/auditor/analisis.ts:316` | audita las conversaciones del agente de IA que avanzaron | 0 inferencias |
| `citas` | `lib/negocio/citas.ts:146` | relee la ventana de −14 a +45 días (`lib/negocio/citas.ts:74`, `:80`) | 10 |
| `mejora` | `lib/auditor/buscarMejora.ts:135` | una mejora de prompt por día y por empresa | 1 inferencia |
| `anuncios` | `lib/negocio/recolectarAnuncios.ts:565` | el costo diario por anuncio, vía GoHighLevel | 40 |
| `analizadores` | `lib/analizadores/tarea.ts:66` | descubre reuniones en tl;dv, analiza pendientes, completa fichas | 1 |
| `reintentos` | `lib/analizadores/tarea.ts:195` | reintenta los análisis fallidos, con tope de 3 (`lib/analizadores/tarea.ts:171`) | 0 |

- **`contactos` va antes de `mensajes`, y eso es corrección, no gusto.** La ingesta descarta la
  conversación de un contacto que no está en `negocio.contactos` y avanza la marca de agua sobre ella:
  si el contacto se sincronizara después, sus mensajes quedarían debajo de la marca para siempre
  (`lib/negocio/barrido.ts:146-150`; prueba en `pruebas/codigo/99-cron.test.ts:150`). `auditoria` va
  después de `mensajes` para no juzgar un transcript incompleto (`lib/negocio/barrido.ts:176-181`).
- **`anuncios` relee hoy y los dos días anteriores** (`lib/negocio/recolectarAnuncios.ts:59`), porque
  Meta corrige hacia atrás y la fila se reescribe en vez de ignorarse
  (`lib/negocio/recolectarAnuncios.ts:11-19`); el relleno inicial es de 30 días
  (`lib/negocio/recolectarAnuncios.ts:67`). Su detalle y lo que falta de Meta están en
  [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 9 y en [01-ACQUISITION.md](01-ACQUISITION.md).
- **Los Analizadores corren solos y cada hora** porque un análisis necesita minutos seguidos y en una
  corrida de 300 s entran un descubrimiento y uno o dos análisis (`lib/analizadores/tarea.ts:1-21`).
  Su detalle es de [14-ANALIZADORES.md](14-ANALIZADORES.md).
- **La lista de tareas válidas la cierra también la base**: el `check` de
  `tareas_programadas.tarea` acepta exactamente las nueve desde la `062`
  (`db/migraciones/062_reintentos_de_los_analizadores.sql:22-23`).

El gasto contra GoHighLevel de la única empresa conectada, contado por día, está en
[06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 3.

### 2.5 · El aviso del CRM

`POST /api/avisos/crm` es el webhook. La cabecera trae dos mitades —una pimienta global y el
secreto de la empresa— y la global se compara antes de tocar la base
(`app/api/avisos/crm/route.ts:17`, `:31`); el evento viaja en `?evento=`
(`app/api/avisos/crm/route.ts:192`); responde **siempre 200** salvo que falle nuestra base, porque
GoHighLevel apaga un workflow ante fallos repetidos (`app/api/avisos/crm/route.ts:61-70`); y tiene
`maxDuration = 10` (`app/api/avisos/crm/route.ts:92`). Hay siete eventos declarados
(`lib/ghl/avisos.ts:65`).

Medido el 2026-09-28 22:04 UTC (re-medido a las 22:26, sin cambios):

- **Llega un solo evento, `mensaje.entrante`**: 327 filas y 339 entregas (el 2026-09-15 eran 311 y
  320). Los otros seis, cero, igual que en la foto anterior; el detalle es de
  [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 7.
- **7 avisos sin procesar y sin error**, recibidos entre el 2026-08-29 y el 2026-09-17; ninguno
  desde entonces.
- **3 avisos en los últimos 7 días**; el último se recibió el 2026-09-27 a las 21:39 UTC y se procesó
  dos segundos después. **Después de él no entró ningún mensaje**: 0 entrantes con fecha posterior.
- De los 6.110 mensajes, **303 entraron por el aviso** (13 desde el 2026-09-15), **5.805 por la
  ingesta** (254 desde el 2026-09-15) y 2 son propios.

### 2.6 · Los disparos manuales, que siguen vivos

El cron no es el único que trae datos. El Closer y el Setter piden la ingesta desde el navegador,
cada 10 s mientras la pestaña está a la vista (`components/views/CloserView.jsx:173`, `:183`;
`components/views/SetterView.jsx:237`, `:242` → `app/api/mensajes/ingesta/route.ts:62`), la Agenda
tiene su botón de refresco (`components/closer/Agenda.jsx:173` →
`app/api/closer/agenda/refrescar/route.ts:63`) y la lista de contactos el suyo
(`components/negocio/ListaDeContactos.jsx:234` →
`app/api/contactos/sincronizar/route.ts:64`). Lo que impide que pestañas y cron se pisen es el pulso:
un candado `.forUpdate().skipLocked()` para el reclamo y un alquiler de 10 s para todo lo demás
(`lib/negocio/pulso.ts:12-25`, `:113`; `lib/cadencia.ts:40`).

La cuarta es `POST /api/sonda`, que corre la sonda de aislamiento fuera del cron con su propio secreto,
`SONDA_TOKEN`, comparado con `timingSafeEqual` (`app/api/sonda/route.ts:16-17`, `:46-47`,
`:69`). Ninguna entrada de `vercel.json` la llama: la sonda programada corre dentro de `/api/cron`, al
minuto 3. Su encabezado todavía dice que «lo llama una tarea programada» (`app/api/sonda/route.ts:3`);
el guion del despliegue la usa como chequeo a mano después de un push
(`docs/OTROS/produccion/DESPLIEGUE.md:408`). Si algo más la llama hoy, no lo verifiqué.

Hay otra ruta que se presenta como sonda y ningún archivo de esta carpeta nombraba: **`GET
/api/control`**, de la Etapa 3 (`433ca86`, 2026-08-21). Pide `NINGUNA` capacidad y `SIN_SECCION`
(`app/api/control/route.ts:25-26`, `:35`), así que la atiende cualquier sesión activa, y lee
`control_aislamiento` con `conOrganizacion(contexto.orgEfectiva)`: la cadena entera, del manejador a
la base (`app/api/control/route.ts:10-12`, `:40-46`). Figura entre las rutas sin pantalla
(`lib/autorizacion/secciones.ts:474-476`). **Nada del repositorio llama al manejador** (búsqueda de
`api/control` en `lib/`, `app/`, `components/`, `pruebas/` y `scripts/`, 2026-09-28): las pruebas
arman peticiones con ese camino y se las pasan al portero, sin importar la ruta
(`pruebas/base/40-portero.test.ts:293`, `pruebas/base/42-login.test.ts:729`,
`pruebas/base/50-administracion.test.ts:671`), y la sonda programada no pasa por ella, sino que
repite el camino con `conOrganizacion()` y `datos()` (`lib/deteccion/sonda.ts:119-121`). Su
encabezado dice ser «la sonda que la Etapa 8 necesita» (`app/api/control/route.ts:22-23`), y ya no
describe lo que corre (§ 10). Por la RLS forzada, cada sesión ve sólo las filas de su organización
efectiva, y las dos filas son de las organizaciones de control (§ 7): a una empresa real le
devolvería la lista vacía. Es una deducción del código; que la ruta responda en producción no lo
verifiqué, porque Vercel no está al alcance. No expone datos, pero es superficie sin uso que viaja
en cada push a `main` (§ 5.3).

---

## 3 · Cómo se sabe si un dato está fresco

**El sello es la única evidencia durable de que el cron corre.** Hay una fila por par (empresa,
tarea) en `negocio.tareas_programadas`, escrita siempre; la consulta para mirarla a mano está en
`docs/OTROS/produccion/DESPLIEGUE.md:337-352`.

`frescuraDe(tarea)` la convierte en un aviso de pantalla (`lib/negocio/frescura.ts:108`) con cuatro
estados —`nunca`, `atrasada`, `fallando`, `al_dia`— de los que sólo el último se calla
(`lib/negocio/frescura.ts:50-59`). El umbral es el máximo de los horarios que corren la tarea
(`lib/negocio/frescura.ts:72`), y un `fallo` se avisa antes de mirar el umbral, porque el sello de una
tarea que falla siempre está fresco (`lib/negocio/frescura.ts:157`). `frescuraDelAviso()` hace lo
mismo con el webhook: lee `procesado_el` y no `recibido_el`, cambia `fallando` por
`llega_sin_procesar` —avisos que llegan y no se interpretan, el caso que motivó la función— y tiene
un umbral de 120 minutos (`lib/negocio/frescura.ts:203-209`, `:231`, `:258`).

**Quién la lee** (búsqueda de `frescuraDe(` y `frescuraDelAviso(` en `lib/`, `app/` y `components/`,
2026-09-28):

- la Agenda del Closer, `citas` (`lib/negocio/agenda.ts:352`);
- el chat de la ficha, `mensajes` y el aviso (`lib/negocio/ficha.ts:289`, `:295`);
- Leads Portal, `contactos` y `citas` (`app/api/leads-portal/route.ts:63-64`).

**Quién no:** ninguna pantalla lee el sello de `anuncios`, `auditoria`, `mejora`, `analizadores` ni
`reintentos`. `tareas_programadas` aparece sólo en `lib/negocio/barrido.ts`,
`lib/negocio/frescura.ts`, el tipo del esquema (`lib/datos/esquema.ts:1511`) y un comentario de
`app/api/cron/route.ts:173` (búsqueda en `lib/`, `app/` y `components/`). O sea que si el
colector de anuncios dejara de correr, Acquisition, Creative, Conversion y Sales no lo dirían con un
aviso de frescura; qué fecha de datos muestra cada una es de su propio archivo de esta carpeta.

**La frescura por tabla, medida el 2026-09-28 a las 22:03 UTC:**

| tabla | marca | valor | lectura |
|---|---|---|---|
| `contactos` | `max(sincronizado_el)` | 22:00:30 | 569 de 594 releídos en la última hora; los 25 restantes, § 8 |
| `citas` | `max(sincronizado_el)` | 22:03:50 | 34 de 333 releídas en 2 h: la ventana −14/+45 tiene 30 por `inicio_el` |
| `mensajes` | marca de agua de la ingesta | 21:56:31 | último guardado a las 20:51; último entrante guardado el 2026-09-27 21:41 (enviado 21:39) |
| `avisos_del_crm` | `max(procesado_el)` | 2026-09-27 21:39 | ~24 h: no hubo entrantes desde entonces (§ 2.5) |
| `anuncios`, `metricas_de_anuncio` | `max(sincronizado_el)` | 06:20 | la pasada diaria de las 06:17 |
| `campos_del_crm` | `max(visto_el)` | 00:00:30 | el catálogo se relee como mucho una vez por día (`lib/negocio/camposDelCrm.ts:66`) |
| `analizador_llamadas` | `max(creado_el)` | 17:41 | última reunión descubierta; último análisis, 2026-09-25 21:41 |
| `hallazgos` | `max(detectado_el)` | 2026-09-21 21:12 | 24 filas, las 24 sin `resuelto_el` |

---

## 4 · La base: tres esquemas, 42 tablas, 62 migraciones

**Los esquemas**, medidos en `pg_class` el 2026-09-28:

| esquema | tablas | RLS habilitada | RLS forzada | políticas |
|---|---|---|---|---|
| `identidad` | 11 (+1 vista) | 11 | 11 | 19, 8 de ellas por `app.org_id` |
| `negocio` | 29 | 29 | 29 | 29, una por tabla, las 29 por `app.org_id` |
| `migraciones` | 2 | 0 | 0 | — |

El 2026-09-15 `negocio` tenía 21: las ocho nuevas son `anuncios` y `metricas_de_anuncio` (`050`) y las
seis `analizador_*` (`056`). `lib/datos/esquema.ts` tipa hoy las 40 tablas de `identidad` y `negocio`
(en `93a1341`, 32) y además seis `public.aria_cc_*` que ninguna migración de `db/` crea
(`lib/datos/esquema.ts:1539-1544`; eran cuatro). **No son las seis que hay en producción**
(`to_regclass` y `pg_class`, medido el 2026-09-28 a las 23:57 UTC). Cuatro existen y se leen:
`scraper_trabajos`, `scraper_leads`, `scraper_monedero` (`lib/monitoreo/consumo.ts:71`, `:95`,
`:100`) y `foundations` (`lib/fundaciones/almacen.ts:214`). `fundaciones_mensajes` existe y el código
sólo la escribe (`lib/fundaciones/historico.ts:234`). `aria_cc_scraper_mediciones` **no existe**, y
el código también sólo la escribe (`lib/tools/medicion.ts:65`, `:94`), dentro de un `catch` que deja
fallar cada intento con una línea en el registro (`lib/tools/medicion.ts:71-76`, `:109-114`); el
detalle es de [15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md) § 6. La sexta de producción,
`aria_cc_icp_oferta`, no está tipada: la aplicación no la toca y la lee un disparador de la base
(`lib/fundaciones/estado.ts:50-51`). El resto de `public` es de otras plataformas que comparten el
proyecto —`public.closer_*` es la anterior—, no nuestro.

**Cómo se aísla una tabla.** Toda tabla de `negocio` pasa por `negocio.aplicar_aislamiento`, que
habilita **y fuerza** la RLS, revoca `public` y crea una política `aislamiento` para
`app_inquilino` con `org_id = current_setting('app.org_id')`
(`db/migraciones/008_aislamiento_de_negocio.sql:151-158`). La aplicación pone esa variable con
`set_config(…, true)` dentro de la transacción de `conOrganizacion` y la vuelve a leer: si no quedó
puesta, lanza (`lib/datos/contexto.ts:76`, `:122-124`, `:136`). Lo que una migración no puede hacer
por culpa de la RLS forzada está en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 7.

**Los roles.** Tres, `migrador`, `app_inquilino` y `app_identidad`, todos `nobypassrls`
(`db/arranque/000_cluster.sql:34`, `:42`, `:51`); medido en `pg_roles` sobre esos tres: 0
superusuarios y 0 con `rolbypassrls`. Producción es PostgreSQL 17.4 (`server_version`, re-medido; el registro del
despliegue ya lo decía, `docs/OTROS/produccion/DESPLIEGUE.md:12`), y la base
local, `postgres:17-alpine` en `127.0.0.1:55432` (`docker-compose.yml`).

**Las migraciones.** 62 archivos en `db/migraciones/`; 62 filas en `migraciones.migraciones_aplicadas`,
la última `062_reintentos_de_los_analizadores`. Las trece desde la foto anterior, con la hora de
aplicación (de esa tabla) contra la hora del primer push que llevó su código (la de la corrida de la
CI de ese push, `gh run list`):

| migración | qué | commit | aplicada (UTC) | push (UTC) |
|---|---|---|---|---|
| `050`, `051` | el costo por anuncio y su tarea | `3d96e8c` | 09-16 21:30 | 09-17 14:37 |
| `052` | el índice que la `048` dejó debiendo | `c1093f4` | 09-18 16:52 | 09-18 17:00 |
| `053` | el desglose de acciones que ya llegaba | `7660d2a` | 09-19 14:21 | 09-19 14:23 |
| `054`, `055` | fuera dos columnas sin escritor; el score pasa a número | `e350a47` | 09-21 19:06 y 19:28 | 09-21 19:46 |
| `056`, `057` | las seis tablas del analizador; la llave de tl;dv | `05534de` | 09-22 21:46 | 09-23 17:00 |
| `058`, `059` | la tarea y la sección de los Analizadores | `35665f2` | 09-23 16:58 | 09-23 17:00 |
| `060` | la copia del historial puede escribir | `7506742` | 09-23 16:58 | 09-23 17:00 |
| `061` | la copia del historial ya no escribe | `b056a96` | 09-23 17:29 | 09-23 17:45 |
| `062` | los reintentos de los Analizadores | `a434f98` | 09-23 22:34:27 | 09-23 22:34:58 |

**Trece de trece antes del push**, la más ajustada por unos 30 segundos (la `062`: aplicada a las
22:34:27,6, corrida de la CI creada a las 22:34:58). Re-medido por el verificador: las trece horas de
aplicación y los nueve commits coinciden. La regla y los tres incidentes que la escribieron están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 8; en esta foto no hubo un cuarto.

---

## 5 · La suite, la CI y el despliegue

### 5.1 · La suite

- **178 archivos**: 95 en `pruebas/codigo/`, 82 en `pruebas/base/` —las que necesitan la base local— y
  1 en `pruebas/construccion/`. En `93a1341` eran 74, 62 y 1: 137.
- **2.273 pruebas** según el mensaje de `aed4f27` (2026-09-26), repetido en `e630823` y `1c55149`
  (2026-09-28, sólo documentos). En la foto anterior eran **1.746** (mensaje de `a0e1eb5`, el último
  commit con cifra antes de `93a1341`). **No re-corrida en este corte**: la suite usa una sola base
  local y otros trabajos corrían en paralelo. **Después del corte**, el 2026-10-02, al cerrar la nueva
  estructura (`docs/OTROS/nueva-estructura/`): **2.445 pruebas en 198 archivos** (111 en
  `pruebas/codigo/`, 86 en `pruebas/base/` y 1 en `pruebas/construccion/`), corridas sobre la etapa E12
  en `America/Lima`, `UTC` y `Asia/Tokyo`, las tres en verde.
- **El corredor** enumera los archivos y aborta si la lista sale vacía, porque `node --test` con un
  patrón sin coincidencias sale 0 (`scripts/pruebas.mjs:1-13`, `:82-89`), y corre **de a un archivo**
  porque las pruebas de base comparten una base y enumeran objetos globales
  (`scripts/pruebas.mjs:113-128`).
- **Las tres zonas —`America/Lima`, `UTC` y `Asia/Tokyo`— son una práctica, no una máquina.** Los
  mensajes de commit las declaran («Suite 2273 × 3 zonas en verde»), pero la CI corre la suite **una
  vez**, sin fijar `TZ` (`.github/workflows/verificar.yml`), y ningún guion del repositorio recorre
  las tres. Dos archivos cambian `process.env.TZ` adentro (`pruebas/codigo/98-agenda.test.ts:235-239`,
  `pruebas/base/92-mi-dia.test.ts:816-819`).
- **Cuatro pruebas de agenda dependen de la hora del día.** Siembran una cita en el pasado y la
  buscan en la cola de hoy, y `ZONA` está fijada en el archivo, así que cambiar `TZ` no lo evita
  (mensaje de `1164984`, 2026-09-21, que lo dejó «como trabajo aparte»). Tres siembran «hace 60
  minutos» y fallan en la hora que sigue a la medianoche de Lima (`pruebas/base/27-agenda.test.ts:217`,
  `:232`, `:675`); la cuarta siembra «dos horas atrás» y falla en las dos primeras horas
  (`pruebas/base/92-mi-dia.test.ts:473`, `:486`). Ningún commit tocó después los archivos de
  `pruebas/base/` con «agenda» o «mi día» en el nombre (`git log --since=2026-09-21T06:20`), así que
  lo más probable es que siga; no verificado corriendo, por la prohibición de arriba.

### 5.2 · La CI

`verificar` corre en cada push a `main` y en cada PR: `npm ci`, credenciales efímeras para los tres
roles sin un solo secreto de GitHub, `npm run build`, `npm run tipos`, `npm run db:reset` y `npm
test`, con 20 minutos de tope (`.github/workflows/verificar.yml`). Node sale de `.nvmrc` (24.14.1) y
los guiones de instalación están apagados por `.npmrc`.

Medido con `gh` el 2026-09-28:

- **49 corridas desde el 2026-09-15 05:00 UTC (48 de push y 1 de PR): 47 verdes y 2 rojas.** Las
  rojas son `1164984` y `d72c4ef`, el 2026-09-21 a las 05:54 y 06:15 UTC —00:54 y 01:15 en Lima—, y
  son las pruebas de la hora del día: la primera con las cuatro (4 de 1.923), la segunda sólo con la
  de «dos horas atrás» (1 de 1.937), porque ya había pasado la una de la mañana. Leído con
  `gh run view --log-failed` de cada corrida.
- **La última corrida** es la de `4fc9e43`, verde, el 2026-09-27 a las 03:29 UTC. `HEAD` tiene dos
  commits sin empujar, `e630823` y `1c55149`, los dos sólo de documentos.
- **`main` no tiene protección de rama**: `gh api …/branches/main` devuelve `protected: false`. El
  propio encabezado de `verificar.yml` lo advierte: sin la regla y sin trabajo por PR, el rojo se
  publica igual.

### 5.3 · El despliegue

- **Vercel despliega por push, no por chequeo** (`docs/OTROS/produccion/DESPLIEGUE.md:395`). La
  protección de rama figura como pendiente (`docs/OTROS/produccion/DESPLIEGUE.md:443`), y sigue
  pendiente (§ 5.2). Las dos corridas rojas del 2026-09-21 llegaron a `main`; que Vercel las haya
  publicado **no está verificado** (no hay acceso de lectura a Vercel desde acá), pero es lo que hace
  con cada push.
- **La protección de despliegue está en Standard**: la URL de producción es pública y la generada del
  despliegue va al muro de SSO (`docs/OTROS/produccion/DESPLIEGUE.md:305-309`). Medido el 2026-08-26;
  **no re-medido**. Las dos fuentes no dicen lo mismo sobre adónde pega el cron: el comentario de la
  ruta dice que a la de producción (`app/api/cron/route.ts:59-60`), y el despliegue leyó que Vercel lo
  registró contra la URL generada, la que responde 302 desde afuera
  (`docs/OTROS/produccion/DESPLIEGUE.md:298-301`). Lo que zanja que hoy corre son los sellos cada diez
  minutos (§ 7): es el caso «el disparador pasa la protección» (`docs/OTROS/produccion/DESPLIEGUE.md:314`,
  `:325`). Que pasarla a «All Deployments» lo apague en silencio lo afirma la ruta
  (`app/api/cron/route.ts:60-61`); no verificado.
- **Cómo se comprueba después de un push**, en orden: `/api/salud`, la raíz que redirige a `/entrar`,
  el ingreso, la sonda, el cron con `curl -i` sin seguir redirecciones
  (`docs/OTROS/produccion/DESPLIEGUE.md:399-414`).

---

## 6 · La paridad con el prototipo, y el grafo

**La paridad.** `scripts/paridad.mjs` comparaba cada vista contra `aios-command-center_1.html` en tres
ejes —forma del DOM, texto, geometría—. Con Leads Portal salió la última vista y **`VISTAS` quedó
vacía** (`scripts/paridad.mjs:153`, commit `aed4f27`); quedan tres pasos de Executive, así que la
compuerta no se retira (`scripts/paridad.mjs:147-150@c4cf2a8`). El mismo archivo admite que **hace tiempo que no corre**: no está en la CI,
necesita los navegadores de Playwright instalados a mano y una sesión
(`scripts/paridad.mjs:141-146`). El conteo de la lista lo ata `pruebas/codigo/90-fundaciones.test.ts:1394-1399`.
La geometría no la reemplaza ninguna prueba que lea el fuente (`scripts/paridad.mjs:131`).
**Después del corte, el 2026-10-01**: la compuerta se retiró en la etapa E7 de la nueva estructura. Los tres pasos de Executive se fueron con la maqueta, y con `VISTAS` y `PASOS` vacías el guardián imprime «retirada» y sale 0 (`scripts/paridad.mjs:301-305`).

**El grafo.** Se rehízo por última vez el 2026-09-29 con un AST completo del código, sobre `1c55149` y
esta carpeta todavía sin commit: 6.854 nodos, 19.569 aristas y 244 comunidades rotuladas (la mañana
del 2026-09-28: 5.902, 16.324 y 275; el 2026-09-15: 3.875, 9.709 y 228). Sirve para ubicar; nunca
prueba que algo no existe. Los 18 archivos de esta carpeta ya están adentro, con 734 nodos. Todo
eso, con sus comandos, en [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) § 1 y § 5.

---

## 7 · Datos: volúmenes por tabla y última corrida, medidos el 2026-09-28

**Las 29 tablas de `negocio`**, conteo exacto a las 22:01 UTC. Cada tabla con filas es de una sola
organización (`count(distinct org_id)` = 1), salvo `control_aislamiento` —las dos de control— y
`tareas_programadas` —las once activas—. La columna del 2026-09-15 sale de la foto
anterior —[04-CONVERSATION.md](04-CONVERSATION.md) en la versión que `bddb516` dejó el 2026-09-16,
con cifras medidas el 2026-09-15 a las 17:24 UTC (la de `93a1341` decía 5.843 mensajes a las 02:28),
y [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) para los avisos—; «—» es que la foto no la
midió o la tabla no existía. Re-contadas las 29 por el verificador a las 22:25 UTC: iguales.

| tabla | filas | 2026-09-15 |
|---|---|---|
| `mensajes` | 6.110 | 5.864 |
| `metricas_de_anuncio` | 3.318 | — (nace en la `050`) |
| `contactos` | 594 | 584 |
| `citas` | 333 | 317 |
| `avisos_del_crm` | 327 | 311 |
| `campos_del_crm` | 195 | — |
| `analizador_llamadas`, `analizador_transcripciones` | 115 y 115 | — (nacen en la `056`) |
| `tareas_programadas` | 88 | — |
| `anuncios` | 79 | — (nace en la `050`) |
| `analisis_del_agente` | 70 | — |
| `analizador_analisis` | 51 | — |
| `analizador_prospectos` | 46 | — |
| `analizador_fichas` | 38 | — |
| `carpetas_del_crm` | 25 | — |
| `hallazgos` | 24 | — |
| `analizador_lapidas` | 13 | — |
| `cambios_de_territorio` | 12 | — |
| `enlaces_rapidos` | 10 | — |
| `notas`, `resultados` | 7 y 7 | — |
| `tareas` | 4 | — |
| `closer_asignado`, `comisiones`, `ingesta_pulso` | 3, 3 y 3 | — |
| `control_aislamiento` | 2 | — |
| `llamadas`, `prompts_del_agente`, `versiones_del_prompt` | **0, 0 y 0** | — |

**`identidad`**, en agregado: 13 organizaciones, 11 activas; 15 usuarios, 95 sesiones, 288 filas de
auditoría de accesos, 42 asignaciones de sección, 3 roles, 32 permisos. De las 11 activas: **1 con
token del CRM**, **5 con llave de IA** (4 de ellas sin el identificador del agente, según el motivo de
sus sellos), **1 con llave de tl;dv** y **1 con secreto del aviso**. El 2026-09-15 eran 15
organizaciones, 12 activas, 4 con llave de IA y 1 con token ([04-CONVERSATION.md](04-CONVERSATION.md)
de `93a1341`); **no investigué** qué se dio de baja.

Ese mismo día, la foto anterior de [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) contaba 13
«organizaciones que el cron barre» (la fila sigue en su § 1, rotulada ahora como sellos). No eran 13
barridas: la cifra es `count(distinct org_id)` de `tareas_programadas`,
que cuenta organizaciones **con sello**. El cron se queda con las activas desde el 2026-08-26
(`f17a464`, `app/api/cron/route.ts:147`), y un sello sólo se borra en cascada cuando se borra la
organización (`db/migraciones/014_tareas_programadas.sql:46`): una empresa desactivada conserva los
suyos. Hoy no queda ninguno así: 11 organizaciones con sello, las 11 activas, 0 sellos de
organizaciones inactivas (medido el 2026-09-28 a las 23:57 UTC). Que la 13.ª fuera una organización
ya inactiva con sellos viejos es la lectura que cierra con el código, **no verificada**: sus sellos ya
no están, y `identidad.organizaciones.actualizada_el` no sirve para fechar una baja, porque nada la
escribe después del alta: sólo tiene el valor por omisión
(`db/migraciones/002_organizaciones_y_usuarios.sql:50`).

**La última corrida por tarea**, leída a las ~22:03 UTC, en la única empresa con token (`aria`); las
otras diez activas
tienen su par en `saltada`, con el motivo `sin_token` o la llave que falta. Ninguna de las 88 filas
está en `fallo`, `frenada` ni `sin_tiempo`:

| tarea | última corrida (UTC) | estado | llamadas | motivo |
|---|---|---|---|---|
| `contactos` | 2026-09-28 22:01:40 | `corrio` | 7 | — |
| `mensajes` | 2026-09-28 22:01:44 | `corrio` | 1 | — |
| `auditoria` | 2026-09-28 22:01:46 | `corrio` | 0 | — |
| `citas` | 2026-09-28 21:03:55 | `corrio` | 10 | — |
| `analizadores` | 2026-09-28 21:41:37 | `corrio` | 1 | — |
| `reintentos` | 2026-09-28 10:07:47 | `corrio` | 0 | — |
| `anuncios` | 2026-09-28 06:20:14 | `corrio` | 40 | «3 par(es) (campaña, día) sin datos» |
| `mejora` | 2026-09-28 06:18:04 | `corrio` | 1 | — |
| `sonda` | — | — | 0 | no se sella (§ 8) |

Como el sello guarda sólo la última pasada, «corrio» en la última es la última sincronización
exitosa; no hay historial de corridas en la base.

**El pulso de la ingesta**, que guarda la marca de agua y la contabilidad acumulada (tres filas, las
tres de la misma empresa), re-leído a las 22:27 UTC: `mensajes` 10.208 corridas y 13.744 llamadas
desde el 2026-08-26, marca en 21:56:31; `citas` 754 corridas y 7.444 llamadas, último fallo el
2026-09-15 11:03; `auditoria` 4.014 corridas y 23 inferencias desde el 2026-09-01. La primera
lectura, minutos antes, daba 10.206, 13.742 y 4.012: la diferencia son las dos corridas de diez
minutos del medio.

---

## 8 · Lo que falta

- **La protección de rama en `main`** con `verificar` requerido. Es una configuración de GitHub, no
  código, y es la que convierte el rojo en un freno (§ 5.2).
- **Un rastro durable de la sonda.** `selloMasViejo` y el bucle la dejan fuera del sello a
  propósito (`lib/negocio/barrido.ts:826`, `:459`, `:467`), así que su resultado vive sólo en la
  respuesta del cron. Que corre cada hora **no se puede demostrar desde la base**;
  `negocio.control_aislamiento` tiene sus dos filas de control, creadas el 2026-08-23.
- **El canal de avisos** (`AVISO_URL`, `AVISO_DESTINO`) figura como pendiente en el despliegue
  (`docs/OTROS/produccion/DESPLIEGUE.md:241-243`, `:444`); sin él, `avisar()` lanza y la sonda que
  detecte una fuga sale como `fallo` en la respuesta del cron (`lib/negocio/barrido.ts:427-437`).
  **No verificado** si hoy está cargado en Vercel.
- **Verificar el certificado de la base.** Desde el 2026-08-24 (`86aee3b`) las tres cadenas de
  producción piden `?uselibpqcompat=true&sslmode=require`
  (`docs/OTROS/produccion/DESPLIEGUE.md:596-616`), que **cifra y no verifica el certificado**: protege de que alguien escuche, no de que alguien se
  ponga en el medio. `verify-full` falla contra Supabase, que firma con su propia autoridad, y el
  despliegue lo deja pendiente con esas palabras (`docs/OTROS/produccion/DESPLIEGUE.md:623-632`). El
  guardia `exigirCifradoSiEsRemoto` sólo exige que haya `sslmode` y que no sea `disable` ni `allow`
  (`lib/datos/anfitrion.ts:204-208`, `:233-235`), y su propio mensaje recomienda `require`
  (`lib/datos/anfitrion.ts:239`). `sslrootcert`, `verify-full` y `rejectUnauthorized` no aparecen en
  `lib/`, `app/`, `scripts/` ni `db/` (búsqueda del 2026-09-28). Qué cadena carga hoy Vercel, **no
  verificado**: sus variables no están al alcance, y la base no puede ver si el cliente verifica.
- **Frescura en los tableros.** Acquisition, Creative, Conversion, Sales y Analizadores no dicen cuándo
  corrió por última vez la tarea que los alimenta (§ 3).
- **Las tres zonas en la CI**, y el arreglo de las cuatro pruebas que dependen de la hora (§ 5.1).
- **La espera externa corta para el camino del cron**, que el propio orquestador llama «la mitigación
  de fondo» y no está hecha (`lib/negocio/barrido.ts:303-306`).
- **Los 25 contactos congelados siguen afirmando una frescura que no tienen.**
  `congelarLosQueYaNoEstan` pone `territorio = null` sin tocar `sincronizado_el`
  (`lib/negocio/sincronizar.ts:289-297`): medido el 2026-09-28, son 25 de 594 sin releer en la última
  hora, los 25 sin territorio, con sellos de entre **11,0 y 34,9 días** (el 2026-09-15, 25 de 584,
  entre 3,9 y 21,8 según [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md)).
- **Tres tablas sin una fila**: `llamadas`, `prompts_del_agente` y `versiones_del_prompt`. No
  investigué sus escritores en este corte.
- **Una segunda empresa con datos.** El cron recorre once y trabaja en una; toda cifra de volumen y de
  costo de esta foto describe a una sola cuenta.

---

## 9 · Reglas de la plataforma

1. **Reconciliación, no cola.** Nada se acumula ni se incrementa; cada pasada mira qué falta y lo
   reescribe, y una corrida perdida se arregla en la siguiente (`lib/negocio/barrido.ts:22-24`,
   `lib/negocio/recolectarAnuncios.ts:11-19`).
2. **El sello se escribe siempre, y con `on conflict`, nunca con `+1`.** Es la diferencia entre «no
   tiene token» y «el cron no pasó nunca» (`lib/negocio/barrido.ts:865-909`).
3. **Un horario desconocido corre todo y lo dice.** Nunca «no hacer nada»
   (`lib/negocio/barrido.ts:383-388`).
4. **Umbral ≥ 2 × cadencia + 60**, y el mapa de horarios es bidireccional con `vercel.json`
   (`lib/negocio/barrido.ts:105-120`).
5. **`contactos` antes de `mensajes`, `auditoria` después**, en el mismo horario
   (`lib/negocio/barrido.ts:146-154`, `:172-181`).
6. **Dos horarios no comparten minuto**, o uno queda `frenada` sin trabajar.
7. **La migración va antes del push**, y se pregunta qué **toca** la columna nueva, no sólo qué la
   lee: ver [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). Hoy la comprobación es comparar
   `select max(name) from migraciones.migraciones_aplicadas` con `ls db/migraciones | tail -1`.
8. **Producción se lee sólo con `scripts/supabase.mjs leer`**, que manda `read_only: true` y lo hace
   cumplir el motor (`scripts/supabase.mjs:21-23`, `:71`). Los roles de la aplicación ven **cero
   filas sin error** fuera de `conOrganizacion`: no es una base vacía, es la RLS forzada.
9. **Un secreto se compara con `timingSafeEqual`, y nunca se autoriza por el user agent**
   (`app/api/cron/route.ts:33-45`, `app/api/avisos/crm/route.ts:101-111`).
10. **La suite corre de a un archivo, contra una sola base, sin nadie más usándola**; y en tres zonas
    antes de empujar, por práctica (§ 5.1).

---

## 10 · Riesgos

1. **El rojo no frena.** Rama sin protección y despliegue por push: el 2026-09-21 dos commits con la
   CI en rojo llegaron a `main` (§ 5.2). Esa vez el rojo era de pruebas que dependen de la hora; el
   día que sea un defecto real, llega igual.
2. **Un rojo que se repite enseña a ignorarlo.** Las cuatro pruebas de agenda ponen la CI en rojo en
   cualquier push de la primera hora de la madrugada de Lima, y una de ellas también en la segunda
   (§ 5.1).
3. **El modo de fallar del cron es el silencio.** Fuera del sello no hay nada: la respuesta del cron
   se pierde con el registro y Vercel no alerta por ausencia (`app/api/cron/route.ts:166-173`). La
   sonda ni siquiera deja sello (§ 8).
4. **El aviso del CRM dice algo falso cuando no hay actividad.** Con más de 120 minutos sin un aviso
   procesado, el chat de la ficha dibuja «Los mensajes están entrando por el ciclo de diez minutos, no
   en el momento» (`lib/negocio/frescura.ts:347-356`, pintado en
   `components/negocio/Ficha.jsx:282-285`). Hoy, a las 22:04 UTC, el último aviso tiene ~24 h y
   **después de él no entró ningún mensaje**: el aviso no está atrasado, el negocio está quieto. El
   último día con gasto mayor que cero en `negocio.metricas_de_anuncio` es el 2026-09-13 (medido el
   2026-09-28; hay filas hasta el 28, todas en cero o vacías), compatible con la pauta pausada y no
   verificado contra Meta ([06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 9). El umbral contempla la noche
   (`lib/negocio/frescura.ts:227-229`), no una cuenta sin tráfico.
5. **El presupuesto de la corrida de diez minutos ya está a la mitad con una sola empresa.** 93 s de
   180, 75 de ellos de la única con token (§ 2.3). Una segunda empresa de tamaño parecido lo acercaría
   al tope y la última quedaría `sin_tiempo`; es una inferencia de estas dos mediciones, no una prueba.
6. **Una llamada colgada pasa el tope de la función.** `pedirExterno` espera hasta 240 s, el guardia
   sólo mira antes de cada empresa y Vercel corta a los 300 sin reintentar
   (`lib/negocio/barrido.ts:295-306`).
7. **Un cambio de configuración de Vercel apaga el cron sin error**: la protección a «All
   Deployments», según la ruta y sin medir (`app/api/cron/route.ts:56-61`; § 5.3). Volver a Hobby no
   es silencioso pero es peor: con horarios de menos de un día el despliegue entero falla
   (`lib/negocio/barrido.ts:126-128`).
8. **Documentos y comentarios que ya no dicen la verdad**, verificados hoy contra el código o la base:
   - `docs/OTROS/produccion/DESPLIEGUE.md:254-255` dice que `vercel.json` declara **un** cron diario a
     las 12:00 UTC con tres tareas, y `:356-357` que ponerse al día lleva «≈23 días con el cron
     diario». Hay cinco horarios y nueve tareas desde el 2026-09-23. El mismo documento dice que los
     registros «en Hobby duran una hora» (`docs/OTROS/produccion/DESPLIEGUE.md:339`) y lista como
     pendiente «la tarea horaria de la sonda» (`:444`), que corre al minuto 3 desde antes del
     2026-09-15.
   - `app/api/sonda/route.ts:3` dice que a esa ruta «lo llama una tarea programada»; ninguna entrada
     de `vercel.json` la llama (§ 2.6).
   - `lib/negocio/barrido.ts:68` y `:78` hablan de «las cinco» tareas; `TAREAS` tiene nueve
     (`lib/negocio/barrido.ts:84-95`).
   - `lib/negocio/barrido.ts:239-241` cuenta los anuncios como «cuatro días (hoy más los tres que se
     releen)» y **52 llamadas por día**; se releen dos (`lib/negocio/recolectarAnuncios.ts:59`) y el
     sello de hoy dice 40.
   - `lib/negocio/barrido.ts:370` y `app/api/cron/route.ts:152-154` dicen que «solo una empresa de
     cinco tiene llave de IA, y todas las que trabajan tienen token del CRM»; hoy 5 de las 11 activas
     tienen llave de IA y 1 tiene token (§ 7).
   - `app/api/cron/route.ts:170-172` describe la retención de registros «en el plan Hobby», y el plan
     es Pro desde el 2026-08-28 (`lib/negocio/barrido.ts:132`); cuánto duran en Pro, no lo verifiqué.
   - `scripts/paridad.mjs:36@c4cf2a8` empieza con «UNA.» encima de `const VISTAS = [];`
     (`scripts/paridad.mjs:153@c4cf2a8`). **Corregido el 2026-10-01** (nueva estructura, E7): dice «NINGUNA».
   - `app/api/control/route.ts:22-23` y `lib/autorizacion/secciones.ts:474-475` presentan esa ruta
     como la sonda de la Etapa 8, o como algo que le sirve; la sonda programada no la usa (§ 2.6).
9. **Todo el volumen es de una cuenta.** Cualquier cifra de costo, duración o frescura de esta foto
   cambia de escala con la segunda empresa conectada.
10. **La conexión a la base cifra pero no autentica al servidor.** Con `sslmode=require`, alguien en
    el camino entre Vercel y `sa-east-1` que presente su propio certificado podría leer y alterar el
    tráfico, y nada fallaría (§ 8). Es una debilidad dicha en el propio despliegue
    (`docs/OTROS/produccion/DESPLIEGUE.md:623-632`), no un incidente: no se midió ningún ataque.

---

## Cómo se midió, y lo que no pude verificar

**Consultas**, todas con `node --env-file=.env.supabase scripts/supabase.mjs leer`, sólo agregados, el
2026-09-28 entre las 22:01 y las 22:12 UTC:

- esquemas, tablas, RLS habilitada y forzada: `pg_class` × `pg_namespace`; políticas: `pg_policies`;
  roles: `pg_roles` filtrado a los tres nuestros;
- un `count(*)` por cada una de las 29 tablas de `negocio`, en una sola consulta con subselects;
- `migraciones.migraciones_aplicadas`: `count(*)`, `max(name)`, y `name` con `timestamp` desde la `049`;
- organizaciones y credenciales: `count(*)` con `is not null` sobre las columnas cifradas, sin leer
  ningún valor;
- `negocio.tareas_programadas` agrupado por tarea y estado, y los motivos de `saltada` agrupados;
- `negocio.ingesta_pulso`, sin la columna de organización;
- las marcas de frescura (`max` de `sincronizado_el`, `procesado_el`, `creado_el`, `visto_el`,
  `analizado_el`, `detectado_el`) y los mensajes por `origen` y `direccion`;
- el último día con gasto: `max(fecha)` de `negocio.metricas_de_anuncio` con `gasto > 0`.

GitHub, con `gh` en lectura: `gh api repos/{owner}/{repo}/branches/main`, `gh run list --workflow
verificar.yml --limit 150` y `gh run view <id> --log-failed` de las dos rojas. Git: `git log`,
`git show` y `git merge-base --is-ancestor` para saber qué push llevó cada migración.

**La verificación**, el 2026-09-28 entre las 22:25 y las 22:30 UTC, con el mismo guion y sólo
agregados: los 29 conteos, esquemas, RLS, políticas, roles, versión, credenciales, organizaciones por
tabla, sellos por tarea, la duración de la corrida de las 22:20 (92,7 s, la misma forma que la de las
22:10), los avisos, los mensajes por origen, las marcas de frescura, el pulso y las trece migraciones.
Todo coincidió salvo lo que se corrigió arriba y los contadores que avanzaron con el cron.

**Una lectura más, a las 23:57 UTC**, tras una revisión crítica del mismo día y con el mismo guion:
`to_regclass` de las seis `public.aria_cc_*` tipadas y los nombres de las `aria_cc_*` de `pg_class`
(§ 4); `count(distinct org_id)` de `tareas_programadas`, total y unido a `identidad.organizaciones`
por `activa`, y los sellos de organizaciones inactivas (§ 7). Sin columnas personales.

**Lo que no pude verificar:**

- **Nada de Vercel**: despliegues, registros, variables (`CRON_SECRET`, `AVISO_URL`, las cadenas de
  conexión y su `sslmode`), la protección de despliegue y la retención de registros en Pro. No hay
  acceso de lectura desde acá.
- **La suite**: no se corrió (§ 5.1). Las 2.273 y las tres zonas son las del mensaje de commit.
- **La zona horaria de la máquina de la CI**: `verificar.yml` no fija `TZ`; cuál usa GitHub no lo medí.
- **Por qué el pulso de `auditoria` tiene `atrasado = true`**, que según
  `lib/auditor/analisis.ts:346` significa que quedó cola o hubo un corte; el sello de la misma tarea
  no trae motivo.
- **Qué organizaciones se dieron de baja** entre el 2026-09-15 (15) y hoy (13).
- **Si algo además del chequeo a mano llama a `POST /api/sonda`** (§ 2.6): desde el repositorio no se
  ve ningún llamador, y los registros de Vercel no están al alcance.
- **La hora del push** es la de creación de la corrida de la CI que disparó; un push sin corrida de
  CI no aparecería en esa lista.
