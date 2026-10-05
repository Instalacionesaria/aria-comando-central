# La superficie de integración con GoHighLevel: qué nos da hoy, qué le tiramos, y qué no nos puede dar
> Corte: **2026-09-28**. Las mediciones de producción son de ese día entre las 17:50 y las 18:20 UTC
> (`now()` de la base devolvió 18:16), con `scripts/supabase.mjs leer` y sólo agregados. Lo que
> corrigió la revisión (medición 1, § 1, § 9 y § 10.3) se re-midió el mismo día a las 23:56 UTC.
> Una verificación posterior re-midió las cifras principales el 2026-09-29 entre las 00:13 y las 00:30
> UTC y coincidieron; lo que agregó o corrigió (el costo del webhook, § 3 y § 7) lleva esa hora.
> Reemplaza a la foto del 2026-09-15 (y a su bloque de asistencia, medido el 2026-09-16). Donde una
> cifra cambió están las dos, con su fecha; lo que no se pudo volver a medir dice «del 2026-09-15, no
> re-medida». Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

Comando Central habla con GoHighLevel por **18 operaciones sobre 17 rutas** de la API v2, todas en
`lib/ghl/`. El 2026-09-15 eran 14 sobre 13: las cuatro nuevas son el Ad Manager de Meta que
GoHighLevel expone, en `lib/ghl/anuncios.ts` (commit `3d96e8c`, 2026-09-16). **Se llaman 16**: dos de
las nuevas, `estructuraDeAnuncios` y `serieDeLaCuenta`, no tienen ningún llamador fuera de su prueba
(búsqueda del 2026-09-28 sobre `lib/`, `app/` y `components/`; **desde el 2026-09-30 son 17**: ver la nota del final). El gasto medido de la única empresa
conectada es un piso de **1.432 llamadas por día** —era 1.392—: cada 10 minutos 7 de contactos y 1 de
mensajes, cada hora 10 de citas, y una vez por día 40 de anuncios; más una por cada aviso de un
contacto que todavía no está en nuestra base (los avisos de contactos conocidos no llaman, § 7) y
una por cada ficha que alguien abre.

Las cinco mediciones que deciden dónde invertir:

1. **Desde el 2026-09-14 no hay gasto en Meta, y el tráfico del negocio se cayó con él.**
   `negocio.metricas_de_anuncio` registra gasto hasta el 2026-09-13 (15,09 ese día, en 4 de sus 79
   filas). En los quince días siguientes las 79 filas diarias siguen llegando —1.185—, pero casi
   ninguna dice «cero»: **1.172 no traen métricas**, la forma del proveedor de decir «no entregó»,
   y sólo **13 informan `gasto = 0`**, todas del 14 al 17 y ninguna con impresiones. Desde el 18
   ninguna fila trae gasto, impresiones, clics ni alcance (medido el 2026-09-28 23:56 UTC; por qué
   no son lo mismo, en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 3). Las altas en
   el CRM de nuestros contactos pasaron de 89 la semana del 2026-09-07 a 4, 3 y 1; los mensajes
   entrantes, de 607 en los 17 días anteriores al 15 a 33 en los 13 posteriores. Es compatible con
   campañas pausadas, no verificado contra Meta. (El 1 es de la semana que empieza el 2026-09-28:
   un solo día.) **Toda cifra de flujo de este informe describe un negocio con la adquisición
   apagada**, y por eso las cifras acumuladas casi no se movieron desde el 2026-09-15.

2. **El contrato de etiquetas conoce 32 nombres; nuestros 594 contactos cargan 63.** Acierta en 19 y
   **desconoce 44** —las mismas 44 del 2026-09-15—, con `lead_meta_ads` en 228 contactos a la cabeza.
   Del lado contrario, 13 declaradas no aparecen (eran 14): `venta_ganada` apareció por primera vez,
   en 1 contacto, sin que `negocio.resultados` tenga una sola venta.

3. **De los 195 campos personalizados, 114 tienen algún valor y 174 están fuera de la pantalla**
   porque su carpeta no tiene grupo — 93 de esos 174 sí tienen datos guardados (5.057 valores). El
   2026-09-15 eran 170 campos, 102 con valor y 149 fuera, 81 de ellos con datos (4.939 valores): los
   25 campos que el CRM agregó cayeron **todos** en carpetas sin grupo. Ahí adentro siguen la carpeta
   entera de atribución de campañas y el campo **«VSL % máximo visto»**, poblado en 79 contactos...
   con el valor literal `0` en los 79.

4. **De los siete eventos de webhook declarados, sigue llegando uno solo**: `mensaje.entrante`, 327
   filas y 339 entregas desde el 2026-08-29 (eran 311 y 320). Los otros seis tienen su URL lista y
   **cero eventos recibidos**, igual que el 2026-09-15.

5. **El cambio de estado de las citas del 2026-09-15 no se repitió.** Aquella tarde doce citas pasaron
   de `confirmed` a `noshow`; en los trece días siguientes pasó **una** más. Los plantones siguen en
   15, `showed` en 0 y `asistio` nulo en 333 de 333.

Sobre la pregunta del dueño: **no hace falta conectar el API de Meta, y la respuesta es más firme que
el 2026-09-15.** Aquella foto decía que Meta aportaría el denominador de costo; desde el 2026-09-16 ese
denominador llega por GoHighLevel, con el token del CRM que ya se usaba, y está guardado:
**3.318 filas** (79 anuncios × 42 días), **3.511,28 de gasto** entre el 2026-08-18 y el 2026-09-13. El
desglose de acciones (reproducciones, clics al enlace, vistas de la landing) llega en la misma
respuesta desde el 2026-09-19, y el conjunto de anuncios como identificador llega en `utmTerm`. Lo
único que sigue exigiendo Meta directo son los cuartiles y la retención del video, el placement y el
activo creativo. Y el orden no cambió: **7 resultados registrados, ninguna venta, ninguno desde el
2026-09-09** — hoy escasea el numerador, y desde el 14 tampoco hay gasto que dividir (§ 9).

---

## 1 · Cómo se midió esto, y qué NO prueba

Todas las cifras salen de una de tres fuentes, y están marcadas:

- **consulta**: `node --env-file=.env.supabase scripts/supabase.mjs leer "…"` contra producción, el
  2026-09-28 entre las 17:50 y las 18:20 UTC. Es el único camino que ve filas.
- **archivo:línea**: una medición que ya estaba escrita en el código, con su fecha.
- **commit**: una medición que quedó en un mensaje de commit (`git show <hash>`).

Este informe **no llamó a GoHighLevel**: todo lo que dice del proveedor sale de lo que nuestra base
guardó o de mediciones fechadas del código. Lo que sólo se contesta llamando está en la § 10.

Los «§» con decimales (§ 5.3, § 9.7, § 10.7, § 16.2…) son del documento de requisitos que la foto
del 2026-09-15 ya citaba así; los «§» enteros, de la 1 a la 10, son secciones de este archivo.

### El alcance real

| Hecho | Consulta | 2026-09-15 | 2026-09-28 |
|---|---|---|---|
| Organizaciones en el sistema | `select count(*) from identidad.organizaciones` | 15 | **13** |
| Con fila de credenciales | `select count(*) … organizaciones_credenciales` | 4 | 5 |
| Con token del CRM cargado | `count(crm_token_cifrado)` | **1** | **1** |
| Con `crm_estado = 'activa'` | `group by crm_estado` | 1 (3 `ausente`) | 1 (4 `ausente`) |
| Activas | `count(*) … organizaciones where activa` | 12 | **11** |
| Organizaciones con sellos del cron | `count(distinct org_id) from negocio.tareas_programadas` | 13 | 11 |
| Organizaciones con contactos | `count(distinct org_id) from negocio.contactos` | **1** | **1** |
| Contactos | `count(*) from negocio.contactos` | 584 | 594 |

**Un sello no es una organización barrida**, y la foto anterior los confundió al rotular la fila
«que el cron barre». El cron toma sólo las activas (`app/api/cron/route.ts:151`, desde `f17a464`,
2026-08-26), y un sello desaparece cuando se borra la organización (`on delete cascade`,
`db/migraciones/014_tareas_programadas.sql:46`), no cuando se desactiva. Con 12 activas el
2026-09-15 (medido ese día a las 17:24 UTC por la foto anterior de Conversation), el 13 sólo cierra
si al menos una organización ya inactiva conservaba sellos de antes: **el cron barría 12, no 13**.
Cuál era no se puede re-medir: hoy ninguna inactiva conserva sellos, así que aquélla se borró
después o se reactivó. Hoy coinciden: las 11 con sellos son las 11 activas, cada una tiene sello en
las ocho tareas y un sello de los últimos 15 minutos (medido el 2026-09-28 23:56 UTC).

O sea que **todo lo que sigue describe UNA subcuenta**. Las otras 10 empresas que el cron recorre
salen `saltada / sin_token` en `contactos`, `mensajes`, `citas` y `anuncios`, con cero llamadas
(consulta sobre `negocio.tareas_programadas` agrupada por tarea, estado y motivo; en `contactos`,
re-medido a las 23:57 UTC: 10).

### Las tres advertencias que hay que leer antes de las cifras

**1 · El censo de etiquetas NO es el catálogo de la subcuenta.** `negocio.contactos` sólo contiene
contactos que tienen —o tuvieron— `zona_closer` o `zona_setter`. La llamada que lee el catálogo real
(`GET /locations/{loc}/tags`, `lib/ghl/cliente.ts:450`) sólo se dispara **cuando la búsqueda no trae
ningún contacto** (`lib/negocio/sincronizar.ts:232-236`), y trae contactos siempre. Las 63 etiquetas
medidas son **un piso**, no el inventario del CRM.

**2 · Nuestra foto de etiquetas está vencida para los contactos congelados.** El congelamiento pone
`territorio` en nulo y **a propósito no toca `etiquetas`** (`lib/negocio/sincronizar.ts:276-278`).
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

## 2 · Las dieciocho operaciones, y las dieciséis que se llaman

Todo el trato directo con GoHighLevel vive en **ocho** archivos de `lib/ghl/` (3.278 líneas por
`wc -l`; el 2026-09-15 eran siete y 2.669). La base es siempre `https://services.leadconnectorhq.com`
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
| **Anuncios (nueva)** | `2021-07-28` | `lib/ghl/anuncios.ts:92` |

### La tabla completa

| # | Operación | Quién la dispara | Frecuencia medida | Archivo |
|---|---|---|---|---|
| 1 | `POST /contacts/search` | cron `contactos`; botón «Sincronizar» | cada 10 min; 1 por página de 100, por etiqueta | `lib/ghl/cliente.ts:293` |
| 2 | `GET /contacts/{id}` | abrir una ficha; el webhook, **sólo si el contacto no está en nuestra base** | ≈ 65 de los 320 avisos procesados del 2026-08-29 al 2026-09-27 (estimado, § 7); 4 desde el 2026-09-15 | `lib/ghl/cliente.ts:545` |
| 3 | `POST /contacts/{id}/tags` | Avanzar; marcar una intervención del auditor (`lib/auditor/intervencion.ts:128`) | 7 resultados en total, ninguno desde el 2026-09-09 | `lib/ghl/cliente.ts:590` |
| 4 | `DELETE /contacts/{id}/tags` | resolver una intervención del auditor | ninguna: **0 de 24** hallazgos resueltos (eran 0 de 20) | `lib/ghl/cliente.ts:636` |
| 5 | `GET /locations/{loc}/tags` | **sólo si la búsqueda trajo cero contactos** | nunca en régimen | `lib/ghl/cliente.ts:450` |
| 6 | `GET /locations/{loc}/customFields` | catálogo de campos | 1 por día (`FRESCURA_MS`, `lib/negocio/camposDelCrm.ts:66`) | `lib/ghl/cliente.ts:710` |
| 7 | `GET /locations/{loc}/customFields/{carpetaId}` | nombre de UNA carpeta | **1 por día para siempre** (ver abajo) | `lib/ghl/cliente.ts:752` |
| 8 | `GET /users/?locationId=` | desplegable de vincular closer | por acción de una persona | `lib/ghl/cliente.ts:493` |
| 9 | `GET /calendars/?locationId=` | cron `citas`; botón «Traer del calendario» | cada hora | `lib/ghl/calendarios.ts:143` |
| 10 | `GET /calendars/events` | ídem, **1 por calendario** | 9 por corrida | `lib/ghl/calendarios.ts:230` |
| 11 | `GET /conversations/search` | cron `mensajes`; reloj del Closer | cada 10 min + hasta 1 cada 10 s con la pestaña a la vista | `lib/ghl/conversaciones.ts:127` |
| 12 | `GET /conversations/{id}/messages` | 1 por conversación nuestra que se movió | tope 6 por ciclo (`lib/negocio/ingesta.ts:70`) | `lib/ghl/conversaciones.ts:232` |
| 13 | `GET /conversations/messages/{id}` | tercera pasada de entregas | 2 por ciclo (`lib/negocio/entregas.ts:52`) | `lib/ghl/conversaciones.ts:294` |
| 14 | `POST /conversations/messages` | enviar desde el chat | por acción de una persona | `lib/ghl/conversaciones.ts:419` |
| 15 | `GET /ad-publishing/facebook/integration` | cron `anuncios`, el «paso 0» | 1 por día | `lib/ghl/anuncios.ts:250` |
| 16 | `GET /ad-publishing/facebook/reporting/list` | cron `anuncios`, 1 por campaña y por día | 39 por día (13 campañas × 3 días) | `lib/ghl/anuncios.ts:466` |
| 17 | `GET /ad-publishing/facebook/entity` | **nadie** | nunca en producción | `lib/ghl/anuncios.ts:327` |
| 18 | `GET /ad-publishing/facebook/reporting` | **nadie** | nunca en producción | `lib/ghl/anuncios.ts:549` |

Las 17 rutas son 18 operaciones porque la 3 y la 4 comparten ruta. Las cuatro de anuncios las alcanza
el mismo Private Integration Token que ya usaba el barrido, bajo el alcance `adPublishing`
(`lib/ghl/anuncios.ts:11-20`, sondeado el 2026-09-16). Que la 17 y la 18 no tengan llamador no es un
defecto de datos: la dimensión de anuncios se llena desde la 16, que ya trae conjunto, campaña y
objetivo (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:73-82`). Pero son dos funciones con
prueba propia que describen un camino que no se recorre.

Y una URL que **no es API**: el widget de reserva `https://api.leadconnectorhq.com/widget/booking/{calendarId}`
(`lib/ghl/agendar.ts:43`). Sólo se arma como enlace; la de reagendar lleva `?event_id=` y su ausencia
crea una segunda cita en vez de mover la que había (`lib/ghl/agendar.ts:66-76`).

### Una escritura al CRM que no pasa por `lib/ghl/`

Subir leads desde Tools (`app/api/tools/leads/enviar/route.ts`, desde el 2026-08-30, commit
`45bcd6d`) no llama a GoHighLevel: le manda a un flujo de n8n el **token del CRM**, el Location ID,
una etiqueta y hasta 100 leads por envío, y es n8n quien crea los contactos
(`app/api/tools/leads/enviar/route.ts:144-152`; el tope en `app/api/tools/leads/enviar/route.ts:68`
y la etiqueta por omisión, `ARIA`, en `app/api/tools/leads/enviar/route.ts:106`). La foto del
2026-09-15 no la nombraba. Dos cosas que conviene saber: el token sale de nuestro servidor hacia un
tercero, y **cuántos envíos se hicieron no se puede medir desde la base**: la ruta no deja registro
en ninguna tabla nuestra.

### Qué se lee y qué se descarta al parsear

**`POST /contacts/search`.** El sobre: sólo `contacts` y `total`. De cada contacto, `ContactoDeGhl`
declara 19 claves (`lib/ghl/cliente.ts:59-161`) y la fila escribe 15 columnas con datos del
contacto, más el sello `sincronizado_el`; dos de ellas son derivadas: `territorio`, de las
etiquetas, y desde el 2026-09-21 `score`, de los campos (§ 6) (`lib/negocio/sincronizar.ts:354-452`).
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
(`lib/ghl/anuncios.ts:504-519`). La que se lee y **no** se guarda es `leads`, que no es el conteo de
Meta sino el nuestro dando un rodeo por el proveedor: 16 de 16 coincidencias el 2026-09-16 y 14 de 15
el 2026-09-19 (`lib/ghl/anuncios.ts:426-441`). Tampoco entran `sales`, `revenue` ni `averageRevenue`
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:208-223`). Y `results` —el desglose de acciones de
Meta— se tiraba entero hasta el 2026-09-19 porque `numero()` convertía el objeto en nulo; desde
`7660d2a` va a `metricas_de_anuncio.acciones` (`db/migraciones/053_el_desglose_que_ya_llegaba.sql:13-32`).
Medido hoy: 275 de las 3.318 filas tienen desglose, y 237 de las 263 filas con gasto mayor que cero.

**`GET /ad-publishing/facebook/reporting` (nueva, sin llamador).** Si se usara: `conversions` y
`costPerConversion` vienen en cero en todo el período y no se leen (`lib/ghl/anuncios.ts:545-547`).

### El costo de las carpetas, que conviene mirar

`GET /locations/{loc}/customFields/{carpetaId}` se pide sólo para las carpetas **sin nombre
guardado**. Medido hoy: `select count(*) from negocio.carpetas_del_crm where nombre is null` → **1**,
igual que el 2026-09-15. Esa carpeta fue borrada en GoHighLevel y responde 404
(`lib/negocio/camposDelCrm.ts:35-42`), así que **se le pide el nombre una vez por día, para siempre**:
la lectura diaria del catálogo cuesta 2 llamadas y no 1 (`lib/negocio/camposDelCrm.ts:70`). Está
documentado como aceptado.

---

## 3 · Lo que cuesta: el presupuesto de llamadas, medido

La columna `ultimas_llamadas` de `negocio.tareas_programadas` guarda lo que costó la última corrida de
cada tarea. Para la única empresa conectada, el 2026-09-28:

| Tarea | Estado | Llamadas medidas | Contra quién | Horario (`vercel.json`) |
|---|---|---|---|---|
| `contactos` | corrió 18:01 | **7** | GoHighLevel | `*/10 * * * *` |
| `mensajes` | corrió 18:01 | **1** | GoHighLevel | `*/10 * * * *` |
| `auditoria` | corrió 18:01 | 0 | el modelo | `*/10 * * * *` |
| `citas` | corrió 17:03 | **10** (1 + 9 calendarios) | GoHighLevel | `3 * * * *` |
| `mejora` | corrió 06:18 | 1 | el modelo | `17 6 * * *` |
| **`anuncios`** (nueva) | corrió 06:20 | **40** (1 + 13 × 3) | GoHighLevel | `17 6 * * *` |
| `analizadores` (nueva) | corrió 17:42 | 4 | tl;dv y el modelo | `41 * * * *` |
| `reintentos` (nueva) | corrió 10:07 | 0 | el modelo | `7 10 * * *` |

**Piso diario sólo por el cron, contra GoHighLevel: (7 + 1) × 144 + 10 × 24 + 40 = 1.432 llamadas.**
El 2026-09-15 era 1.392; la diferencia es entera la tarea `anuncios`. Los Analizadores no le hablan
al CRM: ningún archivo de `lib/analizadores/` importa `lib/ghl/`.

**La tarea `anuncios` cuesta 40 y su comentario dice 52.** `lib/negocio/barrido.ts:243-245` cuenta
«trece campañas por cuatro días (hoy más los tres que se releen)», que era cierto cuando
`DIAS_QUE_SE_RELEEN` valía 3. Vale 2 (`lib/negocio/recolectarAnuncios.ts:59`), la ventana son tres
días, y la medición es 1 del vínculo + 13 × 3 = 40. El proveedor tarda **4,55 s por llamada** en esta
familia —390 llamadas en 1.775 s en el relleno del 2026-09-16, `lib/negocio/recolectarAnuncios.ts:81-82`—,
así que la pasada tiene su propio tope de 120 s (`lib/negocio/recolectarAnuncios.ts:94`). Su último
sello dice «3 par(es) (campaña, día) sin datos»: es compatible con `888888`, la campaña de prueba
que devuelve 500 desde siempre (`lib/negocio/recolectarAnuncios.ts:111-116`), en los tres días de la
ventana — **no verificado**: la base guarda la cuenta, no los pares.

A eso se le suman tres caminos que no tienen horario:

- **Una llamada por aviso de un contacto que todavía no conocemos.** Un aviso de mensaje sobre un
  contacto que ya está en `negocio.contactos` **no llama**: toma el territorio de nuestra base; sólo
  el contacto nuevo, y todo aviso de contacto o de cita, se relee con `GET /contacts/{id}`
  (`lib/negocio/avisoDelCrm.ts:153-167` y la condición en `lib/negocio/avisoDelCrm.ts:182`). La foto
  del 2026-09-15 decía «una por aviso», y era falso ya entonces: la condición está desde el primer
  commit del archivo, `f02ea55` (2026-08-28). Estimado el 2026-09-29 00:25 UTC: de los 320 avisos
  procesados entre el 2026-08-29 y el 2026-09-27, **65** eran de un contacto cuya fila nació después
  del aviso —los que pagaron la llamada— y 255 de uno ya guardado; desde el 2026-09-15, 4 de 15. Es
  una estimación por `creado_el`, no un conteo de llamadas: la llamada no deja registro.
- **Una llamada por apertura de ficha** (`lib/ghl/cliente.ts:529-543`), deliberada: sin ella la ficha
  diría «el bot está apagado» leyendo una etiqueta de hace días. No medida: no deja registro.
- **El reloj del navegador.** Con el Closer a la vista, el tic de la operación es de 10 s
  (`lib/cadencia.ts:40`) y el candado de `lib/negocio/pulso.ts:113` lo deja pasar una vez por ciclo —
  **techo de 360 llamadas por hora** por esa vía, aunque en régimen la ingesta cuesta 1 por ciclo.

**Las cinco pestañas que se construyeron desde el 2026-09-15 no agregan ninguna.** Ninguna ruta de
`app/api/acquisition`, `app/api/creative`, `app/api/conversion`, `app/api/sales` ni
`app/api/leads-portal` importa directamente `lib/ghl/` ni `pedirExterno`, y ninguno de los módulos de
`lib/negocio/` que importan resuelve el token del CRM (`resolverAccesoAGhl`) ni llama al cliente
(búsqueda del 2026-09-28): leen lo que el barrido ya guardó. Abrirlas cuesta cero llamadas al
proveedor. (Más abajo en la cadena de imports sí aparece `lib/ghl/`, por constantes y tipos del
contrato; lo que se comprobó es que nada de lo que estas rutas llaman pide la credencial.)

### Los techos duros, y quién los cubre con reintentos

- `pedirExterno` hace **un solo `fetch`** (`lib/http/cliente.ts:344-349`) y espera hasta 240 s
  (`lib/http/cliente.ts:239`) contra un `maxDuration` de 300; Vercel no reintenta el cron
  (`lib/negocio/barrido.ts:17`).
- El código exacto del proveedor al pasarse del límite **sigue sin confirmar**
  (`lib/ghl/cliente.ts:264-266`). **Lo que cambió desde el 2026-09-15:** la familia de anuncios es la
  primera del repositorio que reintenta el `429` — tres veces, esperando 1,2, 2,4 y 4,8 s
  (`lib/ghl/anuncios.ts:139-169`)—, y a propósito fuera de `pedirExterno`, porque ahí un reintento
  automático podría mandarle dos veces el mismo mensaje a una persona (`lib/ghl/anuncios.ts:130-132`).
  `Retry-After` sigue sin leerse (`lib/ghl/anuncios.ts:150-152`). Las otras catorce operaciones siguen
  sin red.

El comparador que el proyecto guarda: la plataforma anterior corrió a ~7 peticiones por minuto y por
pestaña —420 por hora— y GoHighLevel lo toleró (`lib/negocio/barrido.ts:167-170`). Estamos un orden de
magnitud por debajo, también con la tarea nueva.

---

## 4 · El contrato de etiquetas contra el censo real

`lib/ghl/contrato.ts` declara **32 nombres de etiqueta** distintos, repartidos en territorios, estados
del agente, series de seguimiento, descartes, resultados del closer, resultados del setter y etapas
del setter. No cambió desde el 2026-09-15: lo único que se tocó en ese archivo es el puntaje
(`git diff 93a1341 HEAD --stat -- lib/ghl/` muestra sólo `contrato.ts` y el `anuncios.ts` nuevo).

El censo de producción:

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
| `setter_nuevo`, `setter_en_calificacion`, `setter_calificado` | `pendiente` | **No existen y no se mandan.** `sePuedeMandar` las filtra (`lib/ghl/contrato.ts:561-575`). La fuente de verdad de la etapa es nuestra base (`lib/ghl/contrato.ts:459-477`). |
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

## 5 · Los campos personalizados: 195 definidos, 114 poblados, 174 fuera de la pantalla

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
contacto. El catálogo no borra lo que desapareció, a propósito (`lib/negocio/camposDelCrm.ts:195-204`).

### El reparto por carpeta, y las que son inalcanzables

Un campo se dibuja en el Perfil sólo si su carpeta tiene `grupo` (`lib/negocio/camposDelCrm.ts:256`).
El grupo se pone **una sola vez, al descubrir la carpeta**, desde `CARPETAS_DEL_PERFIL`
(`lib/ghl/contrato.ts:318-330`), que lista cuatro.

| Clase | Carpetas | Campos | Con algún valor | Valores guardados |
|---|---|---|---|---|
| **Con grupo (se muestran)** | 4 | **21** | 21 | 3.316 (eran 3.205) |
| **Sin grupo (no se muestran)** | 21 | **174** | **93** | **5.057** (eran 4.939) |

O sea: **el 60,4 % de los valores que guardamos de GoHighLevel no se dibuja en el Perfil** (era el
60,6 %: 4.939 de 8.144). Dentro de las cuatro con grupo hubo un movimiento que el código registra a
medias: «Contact» pasó de 1 campo a 3 —eso sí quedó escrito, el 2026-09-21, en
`lib/ghl/contrato.ts:319-321`— y «📁 Score | ICP Lead Form (Meta)» de 9 a 7, que no. Son los dos
campos de URL que `ETIQUETAS_CORTAS` rotula «Redes» y «Web»: hoy su carpeta es «Contact» (consulta
sobre `campos_del_crm` por esos dos identificadores). `lib/ghl/contrato.ts:325` todavía dice
«9 campos», y `lib/ghl/contrato.ts:341`, que los siete rotulados son «todos de la carpeta de Meta».

«Inalcanzable» tiene dos sentidos, y hay que separarlos. Para la **pantalla del Perfil**, los 174
están fuera y no hay forma de traerlos sin cambiar `carpetas_del_crm.grupo`. Para el **código de
negocio** existe una salida: `campoPorNombre` (`lib/negocio/camposDelCrm.ts:307`) resuelve un campo
por su nombre **saltándose el filtro de carpetas**. El 2026-09-15 la usaban dos módulos; hoy seis:
`lib/negocio/consumoDelPrecall.ts:150`, `lib/negocio/indicadoresDeCitas.ts:228`,
`lib/negocio/calidadDelCreativo.ts:135`, `lib/negocio/embudoDelFormulario.ts:165`,
`lib/negocio/recorrido.ts:235` y `lib/negocio/fichaDelLeadDelPortal.ts:212-214`. De los campos que se
leen así, dos viven en carpetas sin grupo: «Confirmación Agendamiento»
(`lib/negocio/indicadoresDeCitas.ts:208`) y «Form Landing VSL» (`lib/negocio/recorrido.ts:208`). El
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
(commit `4da946d`) lo leen por nombre, para Conversion, `lib/negocio/embudoDelFormulario.ts:165` y
`lib/negocio/recorrido.ts:235`, y desde el 2026-09-26, para Leads Portal,
`lib/negocio/fichaDelLeadDelPortal.ts:212`. Y las cifras no se movieron por otro motivo: el campo
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

El 2026-09-15 este informe decía que `score` estaba «en 0 de 584» y lo ponía entre lo que GoHighLevel
no expone. **Era falso.** El CRM calcula un puntaje —«Puntaje | ICP», un campo `NUMERICAL`— y estaba
guardado en `campos_del_crm` desde la `039`; lo que faltaba era derivarlo, y la columna ni siquiera
podía guardarlo: era `char(1)` con `check` de letras
(`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:6-16`). Desde `e350a47`
(2026-09-21) la columna es `smallint` entre 0 y 100
(`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:70-76`) y la
sincronización la pisa en cada pasada (`lib/negocio/sincronizar.ts:421`). El mismo commit borró dos columnas que
nunca tuvieron escritor, `responsable_id` y `responsable_rol`
(`db/migraciones/054_las_dos_columnas_que_nadie_escribio.sql:54-55`).

```
«Puntaje | ICP» en campos_del_crm   474 de 594
contactos.score con valor           472 de 594   (0 a 100)
los 2 de diferencia                 los dos son congelados: no se releen
```

Cero llamadas nuevas: se deriva de la misma respuesta. El campo está designado a mano en
`lib/ghl/contrato.ts:305` porque no se puede deducir: el grupo `calificacion` tiene 17 campos y uno
solo es el puntaje.

---

## 7 · Los webhooks: siete puertas declaradas, una conectada

`lib/ghl/avisos.ts:65` declara **siete eventos**, cada uno con su URL `…/api/avisos/crm?evento=<nombre>`.
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
| `mensaje.entrante` | **327** (311) | **339** (320) | 320 (305) | 0 | 7 (6) |
| `mensaje.saliente` | 0 | 0 | — | — | — |
| `contacto.zona_closer` | 0 | 0 | — | — | — |
| `contacto.zona_setter` | 0 | 0 | — | — | — |
| `contacto.actualizado` | 0 | 0 | — | — | — |
| `cita.agendada` | 0 | 0 | — | — | — |
| `cita.cancelada` | 0 | 0 | — | — | — |

Primero el 2026-08-29 01:16 UTC, último el 2026-09-27 21:39 UTC. Los 327 tienen
`atribucion = 'coincide'`: cero workflows apuntando a la URL equivocada. Las 12 entregas duplicadas
(339 − 327) las absorbió el `unique (org_id, huella)`.

**El ritmo se cayó, y no es el webhook.** Hasta el 2026-09-14 llegaban ≈ 18 avisos por día (311 en
17 días); desde el 15, 16 en 13 días. Los mensajes entrantes cayeron en la misma proporción —607 en
el primer tramo, 33 en el segundo, consulta sobre `negocio.mensajes` por `direccion = 'entrante'`—, así
que la relación aviso/entrante es la misma (51 % y 48 %). Es el negocio quieto, no la puerta rota.

**Seis de los siete workflows no están configurados en GoHighLevel.** No es un problema de código: las
siete URLs se ofrecen en el panel y el manejador reconoce las siete (`lib/ghl/avisos.ts:127-129`) y
las reparte en dos ramas, mensaje o contacto y cita (`lib/negocio/avisoDelCrm.ts:167-182`); no hay un
`switch` por evento. Lo que falta es pegar
seis URLs en seis workflows. Lo que se gana, por cada uno:

- `cita.agendada` / `cita.cancelada`: el ícono 📅 se actualiza en segundos en vez de esperar el
  barrido horario. El catálogo lo explica: *«una cita cancelada que sigue encendida hace que no
  llame»* (`lib/ghl/avisos.ts:107-110`). Con **166 de 333 citas canceladas** (eran 160 de 321 el
  2026-09-16; la foto anterior escribió «160 de 317», mezclando dos lecturas), es el caso frecuente,
  no el raro.
- `mensaje.saliente`: saca al contacto del Buzón sin esperar el ciclo.
- `contacto.actualizado`: cubre el caso de que un contacto **pierda** sus dos etiquetas de zona — hoy
  eso sólo lo descubre el barrido de contactos, y hay 25 congelados.

### La llamada que el webhook paga, y la que ya no paga

La foto del 2026-09-15 decía que cada aviso procesado hace un `GET /contacts/{id}`, y contaba 305
llamadas. **Era falso**: un aviso de mensaje sobre un contacto que ya está en nuestra base toma el
territorio de la fila y cuesta cero llamadas; sólo el contacto nuevo —la «red de seguridad del
alta»— y los eventos de contacto y de cita releen al proveedor (`lib/negocio/avisoDelCrm.ts:153-167`
y `lib/negocio/avisoDelCrm.ts:182`). Cuando se relee, es para que haya **un solo lugar** que decida
el territorio (`lib/negocio/avisoDelCrm.ts:10-18`). Estimado el 2026-09-29 00:25 UTC: **65 de los 320**
avisos procesados eran de un contacto cuya fila nació después del aviso (§ 3). El payload nativo trae
`tags` en **327 de 327** cuerpos y `attributionSource` en 321, así que esas 65 también se podrían
ahorrar; no recomiendo tocarlo sin resolver antes la duplicación de la decisión de territorio.

### Siete avisos sin procesar y sin motivo

**7 de 327** tienen `procesado_el` nulo **y** `error` nulo (eran 6 de 311; el nuevo es del
2026-09-17). Después de guardar, el manejador escribe `procesado_el` en el camino feliz y `error` en
los demás (`app/api/avisos/crm/route.ts:249-281`). La única rama que deja las dos columnas nulas es
la del cuerpo que no es un objeto JSON (`app/api/avisos/crm/route.ts:246`), y no es ésta: los 7 son
objetos JSON válidos, igual que los 327 (medido el 2026-09-29 00:20 UTC con `jsonb_typeof`). Lo que
queda compatible es que la petición murió entre guardar la fila e interpretarla. Queda como
pendiente (§ 10).

---

## 8 · Qué NO puede dar GoHighLevel — separado de qué sí puede y no le pedimos

El documento pide esta distinción explícitamente, y es la parte que decide dónde invertir.

### Los plantones del calendario: el cambio del 15 no se repitió

El 2026-09-15, entre las 18:04 y las 20:03 UTC, doce citas pasaron de `confirmed` a `noshow`, y la
foto anterior pidió volver a medir antes de construir nada encima. Medido hoy:

```sql
select to_char(estado_cambiado_el at time zone 'UTC','YYYY-MM-DD'),
       lower(estado_anterior_ghl)||'->'||lower(estado_ghl), count(*)
from negocio.citas where estado_cambiado_el is not null group by 1,2 order by 1;
-- 2026-09-28: 09-15 confirmed->noshow 11 · 09-16 confirmed->cancelled 1 · 09-17 noshow->cancelled 1
--             09-18 confirmed->noshow 1 · 09-22 confirmed->cancelled 1

select lower(coalesce(estado_ghl,'(nulo)')), count(*) from negocio.citas group by 1;
-- 2026-09-28: cancelled 166 · confirmed 152 · noshow 15   (2026-09-16: 160 · 146 · 15)
```

Los doce del 15 figuran hoy como once porque `estado_cambiado_el` guarda sólo el **último** cambio de
cada cita (`lib/negocio/citas.ts:408-415`): una de ellas pasó de `noshow` a `cancelled` el 17. En trece
días hubo **un** plantón nuevo con registro. Siguen quince `noshow` —tres que llegaron ya marcados, de
las citas del 2026-09-08 y 09, y doce con registro—. **Es más compatible con una limpieza puntual que
con un flujo permanente**; no verificado del lado del CRM, y con la adquisición apagada casi no hubo
citas nuevas que marcar (16 reservadas desde el 2026-09-15).

Las columnas que la `042` y la `045` dejaron esperando tienen hoy: `inicio_anterior_el` 2 (era 1),
`estado_anterior_ghl` 15 y `estado_cambiado_el` 15 (eran 12 y 12).

**El *show rate* del § 10.7 SIGUE sin poder calcularse.** `noshow` es el complemento, no la cifra:
`estado_ghl = 'showed'` está en **0** y `asistio` en **0 de 333**, así que no hay numerador. La vía
de Avanzar tampoco lo trajo: ningún resultado registrado desde el 2026-09-09.

### A · El proveedor NO lo tiene (o lo tiene vacío)

| Lo que el documento pide | Evidencia |
|---|---|
| **Asistencia a la cita** (§ 5.3, § 10.7 *show rate*) | Hasta el 2026-09-15 los campos existían vacíos: 3 de 1052 citas (`lib/ghl/calendarios.ts:186`). Ese día llegaron doce transiciones a `noshow`, y después una sola (bloque de arriba). `showed` sigue en **0** y `asistio` nulo en **333 de 333**: la escribe una persona en Avanzar y está fuera del `on conflict` del barrido (`lib/negocio/citas.ts:417-427`). |
| **Duración y «contestada» de las llamadas** | Los 128 registros de llamada traen `status = completed` en el 100 % —el estado de la llamada a la API— y **no hay duración en ningún nivel** (`lib/ghl/entrega.ts:242-248`; del 2026-09-14, no re-medido). `negocio.llamadas` sigue con **0 filas** y sin escritor (re-medido). |
| **Transcripción / resumen de llamada** | No existe. Lo único aprovechable es `attachments[0]`, la grabación. Convertirla en resumen es un subsistema, no una columna. |
| **Última actividad entrante/saliente por contacto** | GoHighLevel no documenta una fecha por dirección (`lib/negocio/sincronizar.ts:18-21`). La calcula un disparador nuestro sobre `negocio.mensajes`: `ultimo_entrante_el` en 305 de 594 (eran 299 de 584), `ultimo_saliente_el` en 485 (eran 476). |
| **Etapa del funnel como campo del sistema** | No lo expone: la mueve un workflow. `negocio.contactos.etapa` está en **6 de 594** y la llena nuestro pipeline. (El puntaje salió de esta fila: § 6.) |
| **Listar las carpetas de campos personalizados** | Cuatro formas probadas el 2026-09-07, las cuatro fallan (`lib/ghl/cliente.ts:664-681`). Sólo una por una, por su id. |
| **Filtrar conversaciones por etiqueta** | `GET /conversations/search` **ignora el filtro** y devuelve las 15.808 de la cuenta (`lib/ghl/conversaciones.ts:6-9`). De ahí sale el diseño por marca de agua. |
| **Paginar citas** | `calendarId` es obligatorio y **no acepta `limit`**: todo parámetro desconocido da 422 nombrándolo (`lib/ghl/calendarios.ts:25-45`). El barrido cuesta 1 + N calendarios. |
| ~~**Gasto, impresiones, alcance, CPM, CTR**~~ | **CORREGIDO el 2026-09-16: sí llegan.** La foto anterior buscó campos personalizados con esos nombres, no los encontró y concluyó que no había vía. Es el error de método de la advertencia 3: el Ad Manager de GoHighLevel los devuelve y el token del CRM lo alcanza (`lib/ghl/anuncios.ts:11-25`). Lo que ya está guardado, en la § 9. |
| **Las métricas finas del video** | Cuartiles 25/50/75/100, tiempo medio visto, retención de seis segundos, *thruplay*: `fields` es un enum cerrado de once valores y todo lo demás da 422 (`lib/ghl/anuncios.ts:64-68`). |
| **Placement y desgloses demográficos** | `groupBy` sólo acepta `day`, `week` y `month` (`lib/ghl/anuncios.ts:70`). |
| **El activo creativo** (§ 5.1 *Creative Profile*) | `/entity?entityType=AD` devuelve sólo nombre e identificadores, y `/creatives`, `/videos` y `/posts` dan 404 (`lib/ghl/anuncios.ts:72-74`; el detalle en `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:251-265`). |
| **`visitor_id` / `session_id`** (§ 16.2, pruebas 2 y 3) | No hay campo. Lo más cercano es `gaClientId` (42 contactos, eran 37) y `fbp` (70, eran 63) dentro de la atribución de primer toque (en cualquiera de los dos toques, 57 y 89): identificadores de sesión ajenos. |
| ~~**El ad set como identificador**~~ | **CORREGIDO el 2026-09-16: sí llega**, como `utmTerm`. Esta fila decía que el ad set venía «sólo como nombre», y era falso: los 9 valores distintos de entonces cruzaron **9 de 9** contra los 200 conjuntos de `/entity` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:28-30`; la misma migración nombra el error de esta fila en `db/migraciones/050_lo_que_costo_cada_anuncio.sql:45-49`), y la `050` guarda esa llave con su nombre verdadero en `negocio.anuncios.meta_conjunto_id` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:95-101`). Hoy: `utmTerm` en 274 contactos, 11 valores, 10 de ellos de 18 dígitos y uno de texto que no es un identificador. Contra nuestra dimensión cruzan 6 de 11, pero esa tabla sólo tiene los conjuntos de los anuncios que aparecieron en el reporte y **20 de sus 79 anuncios siguen sin conjunto**; el cruce contra `/entity` no se re-midió porque hoy nadie lo llama. |

### B · Sí lo tiene y no se lo pedimos

| Lo que existe | Evidencia de que existe | Por qué no llega |
|---|---|---|
| **Oportunidades y pipelines** | `TYPE_ACTIVITY_OPPORTUNITY` apareció **6 veces en la muestra de 65 mensajes** (`lib/ghl/entrega.ts:125`). | Ninguna de las 18 operaciones toca `/opportunities`. El § 5.4 pide `opportunity_id` en el registro de venta y no hay de dónde sacarlo. |
| **Correo, Instagram y llamadas** | Medido el 2026-09-14 sobre 518 conversaciones: 375 correos, 236 de Instagram, 128 de llamada. | `esDeUnCanalDelChat` los descarta. **Decisión de producto del 2026-09-14** (`lib/ghl/entrega.ts:213-231`), no una omisión. |
| **El resultado del agente de voz** | 270 apariciones de etiquetas de llamada sobre 123 contactos (§ 4). | El contrato no las conoce. Están crudas en `contactos.etiquetas` y **no las lee nadie**. |
| **El estado del formulario de la landing** | `Form Landing VSL`, 247 contactos, con los tres estados del embudo. | Su carpeta (`📁 Score \| ICP`) no tiene grupo. Desde el 2026-09-20 se lee por nombre (`lib/negocio/recorrido.ts:208`); sigue sin dibujarse en el Perfil. |
| **Confirmación de asistencia** | `Confirmación Agendamiento`, 184 contactos, vocabulario `Si`/`No`. | Misma carpeta sin grupo; se alcanza por `campoPorNombre` y ya se usa. |
| **Los enlaces y horarios de la reunión** | «📁 Links Sistema»: 6 campos, 1.369 valores (`Link del meets` 262, `Link reagenda` 218). | Carpeta sin grupo y ningún archivo nombra sus campos. |
| **La grabación de la llamada** | `attachments[0]` en 128 de 128. | `leerMensaje` no lee `attachments`. |
| **Una venta marcada en el CRM** | `venta_ganada` en 1 contacto (§ 4). | Sales cuenta sólo lo que registra Avanzar. |
| **El catálogo real de etiquetas** | `GET /locations/{loc}/tags` está implementado (`lib/ghl/cliente.ts:450`). | Sólo se llama cuando la búsqueda trae cero contactos. Nunca se ejecutó en régimen. |
| **La estructura y la serie de la cuenta** | `estructuraDeAnuncios` y `serieDeLaCuenta` implementadas y probadas (`lib/ghl/anuncios.ts:327` y `lib/ghl/anuncios.ts:549`). | Sin llamador. La serie de la cuenta es la única vía al **CPM** agregado y a la comprobación «la suma por anuncio no se pasa del total» (`lib/ghl/anuncios.ts:538-544`). **Desde el 2026-09-30 `estructuraDeAnuncios` sí tiene llamador**: ver la nota del final. |

---

## 9 · ¿Hace falta conectar el API de Meta? La respuesta con lo que ya está guardado

**No.** El 2026-09-15 la respuesta era «para atribuir, no; para el costo, todavía no». Hoy es «no»
también para el costo, porque el costo ya llega por GoHighLevel.

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
| `adId` / `campaignId` / `fbclid` en cualquiera de los dos | 219 / 369 / 289 | **219 / 369 / 291** |
| `utmCampaign` | no medido | **0** |

Casi nada se movió, y el motivo es la medición 1: desde el 2026-09-15 entraron 8 contactos nuevos al
CRM y **ninguno trae `adId`**. `utmCampaign` en cero explica un dato que el colector encontró: ningún
contacto puede tener las cinco UTM completas porque falta siempre la misma (commit `7f6235c`). Y el
`adId` no falta al azar: falta por puerta de entrada —formulario y widget de calendario— (commit
`3d96e8c`, medido el 2026-09-16), así que la cobertura del 36 % no es una muestra.

### El costo, en `negocio.metricas_de_anuncio`

```sql
select count(*), count(distinct fecha), min(fecha), max(fecha),
       count(distinct meta_anuncio_id), sum(gasto),
       max(fecha) filter (where gasto > 0)
from negocio.metricas_de_anuncio
```

| | 2026-09-28 |
|---|---|
| Filas | **3.318** = 79 anuncios × 42 días |
| Ventana guardada | 2026-08-18 → 2026-09-28 |
| Gasto total | **3.511,28**, en la moneda de la cuenta publicitaria, que la base no guarda |
| Último día con gasto mayor que cero | **2026-09-13** |
| Filas con gasto informado (no nulo) | 304 · mayor que cero, 263 · en cero, 41 (13 después del 13) |
| Filas con desglose de acciones | 275 |

Es la misma cifra del relleno del 2026-09-16 (commit `7f6235c`): **no se sumó un centavo desde
entonces**. Los anuncios no dejaron de existir —el proveedor sigue devolviendo las 79 filas por día,
con las métricas ausentes, que es la forma de «no entregó»
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:176-190`)—: dejaron de entregar. Medido el
2026-09-28 23:56 UTC sobre las 1.185 filas posteriores al 13: 1.172 sin gasto, impresiones, clics ni
alcance, 13 con `gasto = 0` informado —7 anuncios, del 14 al 17, las 13 sin impresiones— y ninguna
con gasto distinto de cero; desde el 18, las 79 de cada día vienen vacías. El 0 es del proveedor, no
nuestro: `numero` sólo devuelve un número cuando el proveedor lo mandó, y nulo cuando omitió la
clave (`lib/ghl/anuncios.ts:172-177`). O sea que «sin gasto desde el 14» es exacto; «gasto en cero
desde el 14» no lo es: después del 17 no hay un cero que leer, hay silencio.

**El vínculo con Meta se pregunta cada día y la respuesta no queda en ninguna parte.** El colector
llama a `integracionDeAnuncios` al empezar para distinguir «Meta desconectado» de «no se invirtió»
(`lib/negocio/recolectarAnuncios.ts:137-148` y `lib/negocio/recolectarAnuncios.ts:622-627`), pero
`motivoDeLoIncompleto` (`lib/negocio/barrido.ts:813-887`) no lee `vinculo`,
`negocio.tareas_programadas` no guarda el resumen, y ningún otro archivo lo nombra. Que hoy haya 79 filas por día es compatible con el vínculo
activo —sin vínculo el proveedor devuelve vacío (`lib/ghl/anuncios.ts:246-248`)—; que esté
`connected` no se pudo verificar desde la base.

### El embudo por anuncio, ya con su costo

Cruzando `atribucion_primera->>'adId'` con `negocio.citas` y con la suma de `gasto` de cada anuncio:

| Anuncio (`adId`, últimos dígitos) | Contactos | Con cita | Citas | Canceladas | Gasto 08-18 → 09-13 |
|---|---|---|---|---|---|
| …580467 | 109 | 48 | 51 | 41 | 564,22 |
| …550467 | 44 | 20 | 20 | 17 | 313,70 |
| …570467 | 17 | 6 | 6 | 6 | 162,38 |
| …400467 | 13 | 2 | 2 | 0 | 42,20 |
| *…11 anuncios más* | 30 | 3 | 3 | 2 | 152,37 |
| **Total con anuncio** | **213** | **79** | **82** (83) | **66** (64) | **1.234,87** |
| Sin anuncio | 381 (371) | 213 (203) | 251 (235) | 100 (96) | — |

Entre paréntesis, la cifra del 2026-09-15 donde cambió; el resto, re-medido el 2026-09-29 00:20 UTC.
Los 15 anuncios que nombran nuestros contactos suman 1.234,87 de los 3.511,28 (35 %). El resto es
gasto de los otros 64 anuncios de las mismas **doce** campañas —los 79 anuncios de
`negocio.anuncios` son de 12 campañas distintas; de las trece que el colector pide, una no trae
datos—, que ningún contacto nuestro nombra —en parte por la puerta de entrada de arriba, en parte
porque nuestra base sólo guarda contactos con etiqueta de zona—. O sea que *«agendamientos por fuente y anuncio»* (§ 9.7) y el CPL por anuncio se
pueden construir **hoy, sin una llamada nueva**; el paso 1 de la prueba de trazabilidad del § 16.2
—*«capturar UTMs y `meta_ad_id`»*— sigue cumplido en 213 contactos.

### Qué agregaría Meta directo, exactamente

La foto anterior nombraba tres cosas; dos ya llegan por GoHighLevel.

1. ~~**El denominador de costo**~~ — **llega** (arriba), con impresiones, clics, alcance, CTR, CPC y
   frecuencia por anuncio y por día. El CPM agregado lo daría `serieDeLaCuenta`, que no se llama.
2. ~~**El `adSetId` como identificador**~~ — **llega**, como `utmTerm` (§ 8 A).
3. **El activo creativo** — **sigue sin llegar**: imagen, video, copy, título. Es lo que el § 5.1 llama
   *Creative Profile*.
4. **Las métricas finas del video y el placement** — **siguen sin llegar**: cuartiles, tiempo medio
   visto, retención de seis segundos, desgloses por ubicación y demografía (`lib/ghl/anuncios.ts:62-74`).
   Lo que sí llega del lado del video es `videoView`, con 90 % de cobertura —28 de las 31 filas
   anuncio-día con métricas del 2026-09-10 al 2026-09-17, medido el 2026-09-18
   (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:66-73`)— y una definición que GoHighLevel no
   documenta (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:271-279`).

### La recomendación, con su cifra

**No conectar Meta.** Para el costo ya no hace falta, y para lo que sí haría falta —el creativo y el
video fino— el cociente tiene el mismo problema que el 2026-09-15:

```
contactos con anuncio atribuido      213
  → con cita                          79
  → con resultado registrado            3
```

`negocio.resultados` tiene **7 filas en total** (`seguimiento` 4, `no_show` 2, `no_interesa` 1),
**ninguna venta y ninguna desde el 2026-09-09**. Un ROAS por anuncio calculado hoy se apoyaría en 3
hechos, y sin gasto desde el 14 no hay ventana nueva que medir. Conectar Meta antes de que
el registro de resultados tenga volumen produce lo que este proyecto persigue en todas partes: un
número plausible que contesta otra pregunta.

El orden que la foto anterior proponía, y en qué quedó cada paso al 2026-09-28:

1. **Leer lo que ya está guardado — a medias.** `Form Landing VSL` y `Confirmación Agendamiento` se
   leen por nombre; «📁 Atribución Campañas» (1.325 valores) y «📁 Links Sistema» (1.369) siguen sin
   lector.
2. **Conectar los seis webhooks que faltan — no hecho.** Cero eventos de los seis. Cero código; seis
   URLs en seis workflows.
3. **Arreglar el medidor del VSL — no hecho.** 79 contactos con `0` en los 79, y sin datos desde el
   2026-08-30. No depende de GoHighLevel.
4. **Enseñarle al contrato las 44 etiquetas que no conoce — no hecho.** Siguen 32 nombres; las tres
   familias que deciden algo crecieron: cancelación (114), agente de voz (270 apariciones), WhatsApp
   caído (27 contactos).
5. **Y recién ahí, Meta — resuelto por otra vía.** El costo llega por GoHighLevel desde el
   2026-09-16. Meta directo queda sólo para el creativo y el video fino.

---

## 10 · Pendientes: lo que no pude verificar

Cada uno es un hueco medido, no una suposición.

1. **El catálogo real de etiquetas de la subcuenta nunca se leyó.** `GET /locations/{loc}/tags` sólo
   se llama si la búsqueda trae cero contactos (`lib/negocio/sincronizar.ts:232-236`). Las 63
   etiquetas de este informe son las que cargan nuestros 594 contactos: **un piso**. Una sola llamada
   manual lo cerraría.

2. **Siete avisos quedaron sin procesar y sin motivo.** 7 de 327, con `procesado_el` y `error` los dos
   nulos. La única rama del manejador que deja ese estado es la del cuerpo ilegible
   (`app/api/avisos/crm/route.ts:246`), y los siete son objetos JSON válidos (§ 7), así que lo
   compatible es que la petición murió entre guardar e interpretar. Hace falta el registro de la función en Vercel de
   esas siete fechas (2026-08-29, 08-31, 09-04, 09-08, 09-09, 09-11 y 09-17).

3. **Las etiquetas de confianza de `entrega.ts` siguen vencidas.** El catálogo marca `queued` y
   `failed` como `sin_confirmar` (`lib/ghl/entrega.ts:68-69`). Medido hoy en `negocio.mensajes`,
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
   catorce operaciones no, y ninguna lee `Retry-After`. Hoy corremos a ~1.432 llamadas por día para
   una empresa; con cinco serían ~7.200.

5. **No pude comprobar el alcance del token sobre `/opportunities`.** Está probado que lee contactos,
   etiquetas, campos, usuarios, calendarios, conversaciones y, desde el 2026-09-16, el Ad Manager
   (`adPublishing`). Si alcanza `/opportunities` sólo se contesta llamando al proveedor, y este
   informe no lo llamó. Si alcanza, el `opportunity_id` del § 5.4 está a una llamada de distancia.

6. **Si Meta sigue vinculado hoy.** El colector lo pregunta cada día y no lo guarda (§ 9). Lo que la
   base permite afirmar es menos: el proveedor devuelve las 79 filas diarias, y sin vínculo devolvería
   vacío.

7. **Por qué no hay gasto desde el 2026-09-14.** Lo compatible con todo lo medido —ningún gasto
   distinto de cero, 13 filas en 0 del 14 al 17 y, desde el 18, las 79 filas diarias sin métricas;
   altas y mensajes que se desploman el mismo día— es que las campañas se pausaron. No se verificó contra Meta ni con quien las maneja.

8. **La llamada diaria que se sabe perdida.** La carpeta borrada responde 404 y, con su `nombre`
   nulo, se le vuelve a pedir una vez por día para siempre (`lib/negocio/camposDelCrm.ts:35-42`). Está
   aceptado; lo dejo contado porque nadie lo va a ver en ninguna factura.

9. **Los 21 contactos congelados con etiqueta de zona vencida.** No es un defecto —el congelamiento no
   toca `etiquetas` a propósito— pero toda cifra construida sobre `contactos.etiquetas` incluye hasta
   21 fotos de hasta el 2026-09-17. Quien mida etiquetas debería filtrar por `territorio is not null`
   o decir que no lo hizo; en este informe, las cifras de etiquetas son sobre los 594 salvo donde dice
   «vivos».

10. **Cuántos lotes se subieron al CRM desde Tools.** La ruta que manda leads a n8n
    (`app/api/tools/leads/enviar/route.ts:144-152`) no deja registro en la base.

---

---

> **Después del corte, 2026-09-30 (AQ-1 de Acquisition).** `estructuraDeAnuncios` dejó de estar sin
> llamador: el colector de anuncios (`lib/negocio/recolectarAnuncios.ts`) la llama en el nivel
> `CAMPAIGN` al final de cada pasada que tiene campañas que pedir, y guarda nombre y estado en
> `negocio.campanas` (migración `065`). Son **17 operaciones que se llaman**, y la pasada diaria de
> anuncios suma una llamada por página de campañas (una, con las 61 de la cuenta). Un fallo de esa
> lectura no tumba la pasada y queda en el sello del cron. `serieDeLaCuenta` sigue sin llamador.
