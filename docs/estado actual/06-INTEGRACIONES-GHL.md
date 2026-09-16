# La superficie de integración con GoHighLevel: qué nos da hoy, qué le tiramos, y qué no nos puede dar
> Corte: **2026-09-15**, salvo el bloque de asistencia, medido el **2026-09-16 a las 14:06 UTC**
> porque el proveedor empezó a mandar un dato que este informe daba por ausente.
> Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

Comando Central habla con GoHighLevel por **14 operaciones sobre 13 rutas** de la API v2, todas en `lib/ghl/`. El gasto medido de la única empresa conectada es un piso de **1.392 llamadas por día** (cron cada 10 min: 7 de contactos + 1 de mensajes; cada hora: 10 de citas), más una por cada aviso entrante y una por cada ficha que alguien abre.

Las tres mediciones que deciden dónde invertir:

1. **El contrato de etiquetas conoce 32 nombres; nuestros 584 contactos cargan 62.** El contrato acierta en 18 y **desconoce 44**, entre ellas la más frecuente de todas después de las dos de zona: `lead_meta_ads`, en 228 contactos. Del lado contrario, 14 etiquetas declaradas no aparecen en ningún contacto nuestro.

2. **De los 170 campos personalizados, 102 tienen algún valor y 149 están fuera de la pantalla** porque su carpeta no tiene grupo — 81 de esos 149 sí tienen datos guardados (4.939 valores). Ahí adentro están la carpeta entera de atribución de campañas y el campo **«VSL % máximo visto»**, poblado en 79 contactos... con el valor literal `0` en los 79.

3. **De los siete eventos de webhook declarados, sólo uno llegó alguna vez**: `mensaje.entrante`, 311 filas y 320 entregas desde el 2026-08-29. Los otros seis (`cita.agendada`, `cita.cancelada`, `contacto.actualizado`, los dos de zona y `mensaje.saliente`) tienen su URL lista y **cero eventos recibidos**.

Sobre la pregunta del dueño: **no hace falta el API de Meta para atribuir**. GoHighLevel ya entrega el identificador de anuncio de Meta en **213 contactos** (18 dígitos, 15 anuncios distintos) y el de campaña en 358, y el embudo por anuncio ya se calcula hoy: 213 contactos → 79 con cita. Lo que Meta agregaría es el **denominador de costo** (gasto, impresiones, CPM, CTR) y el **activo creativo**, que no existen en ninguna parte del CRM. Y hay un orden: con **3 resultados registrados** sobre esos 213 contactos, hoy escasea el numerador, no el denominador.

---

## Cómo se midió esto, y qué NO prueba

Todas las cifras de este informe salen de una de dos fuentes, y están marcadas:

- **consulta**: `node --env-file=.env.supabase scripts/supabase.mjs leer "…"` contra producción, ejecutada el 2026-09-14/15 con el usuario `supabase_read_only_user`.
- **archivo:línea**: una medición que ya estaba registrada en el código, con su fecha.

### El alcance real

| Hecho | Consulta | Valor |
|---|---|---|
| Organizaciones en el sistema | `select count(*) from identidad.organizaciones` | 15 |
| Con fila de credenciales | `select count(*) … organizaciones_credenciales` | 4 |
| Con token del CRM cargado | `count(crm_token_cifrado)` | **1** |
| Con `crm_estado = 'activa'` | `group by crm_estado` | 1 (las otras 3, `ausente`) |
| Organizaciones que el cron barre | `count(distinct org_id) from negocio.tareas_programadas` | 13 |
| Organizaciones con contactos | `count(distinct org_id) from negocio.contactos` | **1** |

O sea que **todo lo que sigue describe UNA subcuenta**. Las otras 12 empresas que el cron recorre salen `saltada / sin_token` en cada corrida, con cero llamadas al proveedor.

### Las tres advertencias que hay que leer antes de las cifras

**1 · El censo de etiquetas NO es el catálogo de la subcuenta.** `negocio.contactos` sólo contiene contactos que tienen —o tuvieron— `zona_closer` o `zona_setter`. La llamada que lee el catálogo real de la cuenta (`GET /locations/{loc}/tags`, `lib/ghl/cliente.ts:450`) sólo se dispara **cuando la búsqueda no trae ningún contacto** (`lib/negocio/sincronizar.ts:232-236`), y trae contactos siempre. Las 62 etiquetas medidas son **un piso**, no el inventario del CRM.

**2 · Nuestra foto de etiquetas está vencida para los contactos congelados.** El congelamiento pone `territorio` en nulo y **a propósito no toca `etiquetas`** (`lib/negocio/sincronizar.ts`, encabezado de `congelarLosQueYaNoEstan`). Medido: de los 25 congelados, **20 siguen cargando una etiqueta de zona** que el CRM ya les sacó. El censo sobrecuenta `zona_closer`/`zona_setter` hasta en 20.

```
territorio   contactos   con alguna zona en la foto   última lectura
setter       280         280                          2026-09-15 02:30
closer       279         279                          2026-09-15 02:30
(nulo)        25          20                          2026-09-11 20:50
```

**3 · Un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Donde digo «no llega», lo digo contra la base o contra una medición fechada del código. Donde no pude comprobarlo, está en la sección de pendientes.

---

## Las catorce operaciones que se llaman hoy

Todo el trato con GoHighLevel vive en siete archivos de `lib/ghl/` (2.669 líneas). La base es siempre `https://services.leadconnectorhq.com` — la v2; `public-api.gohighlevel.com` y `rest.gohighlevel.com/v1` están declarados EOL en `lib/ghl/cliente.ts:18`.

Hay **tres cabeceras `Version` distintas conviviendo**, y no es descuido: cada familia de la API tiene la suya.

| Familia | `Version` | Archivo |
|---|---|---|
| Contactos, etiquetas, campos, usuarios | `2021-07-28` | `lib/ghl/cliente.ts:33` |
| Conversaciones y mensajes | `2021-04-15` | `lib/ghl/conversaciones.ts:49` |
| Calendarios y citas | `2021-04-15` | `lib/ghl/calendarios.ts:114` |

### La tabla completa

| # | Operación | Quién la dispara | Frecuencia | Archivo |
|---|---|---|---|---|
| 1 | `POST /contacts/search` | cron `contactos`; botón «Sincronizar» | cada 10 min; 1 llamada por página de 100, por etiqueta | `cliente.ts:293` |
| 2 | `GET /contacts/{id}` | abrir una ficha; **cada webhook** | por acción de una persona; 305 veces en 17 días por webhook | `cliente.ts:545` |
| 3 | `POST /contacts/{id}/tags` | Avanzar (closer y setter) | 7 resultados registrados en total | `cliente.ts:590` |
| 4 | `DELETE /contacts/{id}/tags` | resolver una intervención del auditor | ninguna todavía (0 de 20 hallazgos resueltos) | `cliente.ts:636` |
| 5 | `GET /locations/{loc}/tags` | **sólo si la búsqueda trajo cero contactos** | nunca en régimen | `cliente.ts:450` |
| 6 | `GET /locations/{loc}/customFields` | catálogo de campos | 1 por día (`FRESCURA_MS`, `camposDelCrm.ts:66`) | `cliente.ts:710` |
| 7 | `GET /locations/{loc}/customFields/{carpetaId}` | nombre de UNA carpeta | 24 la primera vez, **1 por día para siempre** (ver abajo) | `cliente.ts:752` |
| 8 | `GET /users/?locationId=` | desplegable de vincular closer | por acción de una persona | `cliente.ts:493` |
| 9 | `GET /calendars/?locationId=` | cron `citas`; botón «Traer del calendario» | cada hora | `calendarios.ts:143` |
| 10 | `GET /calendars/events` | ídem, **1 por calendario** | 9 por corrida | `calendarios.ts:230` |
| 11 | `GET /conversations/search` | cron `mensajes`; reloj del Closer | cada 10 min + hasta 1 cada 10 s con la pestaña a la vista | `conversaciones.ts:127` |
| 12 | `GET /conversations/{id}/messages` | 1 por conversación nuestra que se movió | tope 6 por ciclo (`ingesta.ts:70`) | `conversaciones.ts:232` |
| 13 | `GET /conversations/messages/{id}` | tercera pasada de entregas | 2 por ciclo (`entregas.ts:52`) | `conversaciones.ts:294` |
| 14 | `POST /conversations/messages` | enviar desde el chat | por acción de una persona | `conversaciones.ts:419` |

Y una URL que **no es API**: el widget de reserva `https://api.leadconnectorhq.com/widget/booking/{calendarId}` (`lib/ghl/agendar.ts:43`). Sólo se arma como enlace; la de reagendar lleva `?event_id=` y su ausencia crea una segunda cita en vez de mover la que había (`agendar.ts:66-76`).

### Qué se lee y qué se descarta al parsear

**`POST /contacts/search`.** El sobre: sólo `contacts` y `total`. De cada contacto, `ContactoDeGhl` declara 19 claves (`cliente.ts:59-161`) y a la base llegan 13 columnas. `locationId` se declara y **no se usa jamás**. Todo lo que GoHighLevel mande y la interfaz no declare **se cae ahí mismo, sin error** — que es literalmente el defecto que ya se pagó tres veces (`meta_ad_id`, las UTM y el porcentaje de video).

Hay evidencia dura de que el contacto trae mucho más de lo que leemos: el **payload nativo del webhook** del mismo contacto trae **189 claves de nivel superior** (consulta sobre `negocio.avisos_del_crm`), y entre las que parecen del sistema —y no leemos— están `contact_source`, `contact_type`, `full_address`, `user`, `workflow`, `triggerData` y `customData`. No es la misma respuesta que la búsqueda, así que no prueba qué devuelve `/contacts/search`; sí prueba que el objeto contacto del proveedor es mucho más ancho que nuestras 19 claves.

**`GET /calendars/events`.** `leerCita` (`calendarios.ts:256`) lee 12 claves. Lo medido y descartado con motivo: `description` y `notes` vienen **vacías en 402 de 402** (`calendarios.ts:82-83`), y `createdAt` **no existe** — el sello de reserva se llama `dateAdded`. El estado se lee de `appointmentStatus` con respaldo a `appoinmentStatus` (sin la segunda `t`), porque el CRM manda **los dos** con el mismo valor.

**`GET /conversations/{id}/messages`.** `leerMensaje` (`conversaciones.ts:333`) lee 11 claves. Descartados a propósito:
- `type` (número interno del proveedor): se usa `messageType`, que es el nombre en texto.
- **`attachments`**: en los 128 registros de llamada medidos, `attachments[0]` es una cadena en **128 de 128** — la grabación existe y **no se lee** (`entrega.ts:254`).
- `meta.marketplace` (`{appId, appName}`): tampoco.

Y antes de escribir, dos filtros tiran tráfico real: `esUnMensaje` saca los `TYPE_ACTIVITY_*` (**10 de 65** en la muestra, `entrega.ts:125`) y `esDeUnCanalDelChat` deja pasar sólo WhatsApp y SMS. Ese segundo filtro descarta, medido el 2026-09-14 sobre las 518 conversaciones, **375 correos, 236 de Instagram y 128 registros de llamada** — *el 10 % del tráfico de nuestros propios contactos* (`entrega.ts:225-231`). Es una decisión de producto tomada ese día, no un olvido.

### El costo de las carpetas, que conviene mirar

`GET /locations/{loc}/customFields/{carpetaId}` se pide sólo para las carpetas **sin nombre guardado**. Medido: `select count(*) from negocio.carpetas_del_crm where nombre is null` → **1**. Esa carpeta (`SU7G44jzFy1XJKZ7aY31`) fue borrada en GoHighLevel y responde 404 (`camposDelCrm.ts:35-42`), así que **se le va a pedir el nombre una vez por día, para siempre**. Es una llamada diaria desperdiciada y está documentada como aceptada.

---

## Lo que cuesta: el presupuesto de llamadas, medido

La columna `ultimas_llamadas` de `negocio.tareas_programadas` guarda lo que costó la última corrida de cada tarea. Para la única empresa conectada:

| Tarea | Estado | Llamadas medidas | Horario (`vercel.json`) |
|---|---|---|---|
| `contactos` | corrió | **7** | `*/10 * * * *` |
| `mensajes` | corrió | **1** | `*/10 * * * *` |
| `auditoria` | corrió | 0 (al CRM) | `*/10 * * * *` |
| `citas` | corrió | **10** (1 + 9 calendarios) | `3 * * * *` |
| `mejora` | corrió | 1 (al modelo, no al CRM) | `17 6 * * *` |

**Piso diario sólo por el cron: (7 + 1) × 144 + 10 × 24 = 1.392 llamadas.**

A eso se le suman tres caminos que no tienen horario:

- **Una llamada por aviso entrante.** Cada webhook llama a `GET /contacts/{id}` para releer las etiquetas y recalcular el territorio (`lib/negocio/avisoDelCrm.ts:9-18`). Medido: 305 avisos procesados en 17 días, ≈ **18 llamadas/día**.
- **Una llamada por apertura de ficha** (`cliente.ts:529-543`), deliberada: sin ella la ficha diría «el bot está apagado» leyendo una etiqueta de hace días.
- **El reloj del navegador.** Con el Closer a la vista, el tic de la operación es de 10 s (`lib/cadencia.ts:40`) y el candado de `pulso.ts:113` lo deja pasar una vez por ciclo — **techo de 360 llamadas/hora** por esa vía, aunque en régimen la ingesta cuesta 1 llamada por ciclo.

### Los dos techos duros, y que nadie los cubre con reintentos

- `pedirExterno` **no reintenta nunca** (`lib/http/cliente.ts:287-305`). Espera hasta 240 s (`:235`) contra un `maxDuration` de 300, y Vercel no reintenta el cron (`barrido.ts:17-18`).
- El `429` se traduce a `demasiadas_peticiones` y **no se maneja**: no hay respaldo exponencial ni lectura de `Retry-After`. El propio código dice que el código exacto del proveedor al pasarse del límite **no está confirmado** (`cliente.ts:264-266`).

El comparador que el proyecto guarda: la plataforma anterior corrió a ~7 peticiones por minuto y por pestaña —420/hora— y GoHighLevel lo toleró (`barrido.ts:142-145`). Estamos un orden de magnitud por debajo de eso.

---

## El contrato de etiquetas contra el censo real

`lib/ghl/contrato.ts` declara **32 nombres de etiqueta** distintos, repartidos en territorios, estados del agente, series de seguimiento, descartes, resultados del closer, resultados del setter y etapas del setter.

El censo de producción:

```sql
select lower(e), count(*) from negocio.contactos ct, unnest(ct.etiquetas) e group by 1 order by 2 desc
```

| | |
|---|---|
| Etiquetas distintas sobre nuestros 584 contactos | **62** |
| Etiquetas que el contrato declara | 32 |
| Que el contrato conoce **y** se usan | **18** |
| Que existen en el CRM y **el contrato no conoce** | **44** |
| Que el contrato declara y no aparecen en ningún contacto | 14 |

### Las 44 que el contrato no conoce

Ordenadas por uso. Son el vocabulario real que el CRM escribe y nosotros guardamos crudo sin interpretar:

| Etiqueta | Contactos | Qué parece ser |
|---|---|---|
| `lead_meta_ads` | **228** | marca de origen Meta — la señal de adquisición más poblada de todas |
| `cita_cancelada` | 111 | el par de `cita_agendada`, que **sí** está en el contrato |
| `form_vsl_incompleto_sin_agendar` | 87 | etapa del embudo de la landing |
| `[device] - default` | 86 | ruido del canal de WhatsApp |
| `form_vsl_completo_sin_agendar` | 62 | etapa del embudo de la landing |
| `not answered` / `answered` | 58 / 51 | resultado del **agente de voz** |
| `trigger` | 55 | disparador genérico |
| `assistant hangup` / `contact hangup` / `contact declined` | 42 / 29 / 24 | cómo terminó la llamada de voz |
| `voicemail reached` | 31 | ídem |
| `dial no answer` / `dial busy` / `dial failed` / `invalid destination` | 16 / 3 / 2 / 3 | resultado del marcador |
| `[whatsapp] - contact is not registered on whatsapp` | 11 | **fallo de canal**, hoy invisible |
| `stop bot` / `stop appflow` | 10 / 1 | órdenes de apagado que el contrato no lee |
| `[whatsapp] - phone device is disconnected` | 10 | fallo de canal |
| `agencia ia 60 min` / `ia remarketing 60 min` / `agencia ia` / `ia remarketing` | 9 / 3 / 1 / 1 | campañas o embudos |
| `form precall` / `form_submitted` | 7 / 6 | formularios |
| `cita_cancelada_manualmente` / `cita_reagendada` / `quiere_reagendar` / `reschedule` | 6 / 2 / 1 / 1 | ciclo de vida de la cita |
| `afiliado ghl` / `afiliado ghl pago` / `affiliado ghl cancelado` | 3 / 2 / 3 | canal de afiliados |
| `sugerido_a_jorge`, `scalingusa`, `saludo 1`, `saludo 2`, `no show`, `negocio b2b`, `fase 2: en proceso`, `1-1 si tiene presupuesto`, `survey-francisco`, `agenda_en_demostracion`, `[whatsapp] - lead capture` | 1–3 cada una | vocabulario suelto |

Tres grupos merecen una decisión, no una lista:

1. **El ciclo de vida de la cita.** `cita_agendada` está en el contrato (`contrato.ts:171`) y `cita_cancelada` —**111 contactos**— no. El ícono 📅 de la fila se apaga sólo por el barrido del calendario, que corre cada hora; la etiqueta llegaría en segundos si el webhook de cancelación estuviera conectado.
2. **El agente de voz.** `answered`, `not answered`, `assistant hangup`, `contact hangup`, `voicemail reached`, `contact declined` y los cuatro `dial *` suman **259 apariciones**. Es un resultado de llamada que ya está escrito en el CRM y que `negocio.llamadas` —vacía, 0 filas— podría leer sin una sola llamada nueva a la API. Se decidió el 2026-09-14 dejar los agentes de voz fuera (`entrega.ts:213-218`); esta medición dice cuánto cuesta esa decisión.
3. **Los fallos de canal.** `[whatsapp] - contact is not registered on whatsapp` (11) y `[whatsapp] - phone device is disconnected` (10) son 21 contactos a los que **no se les puede escribir por WhatsApp**, y la pantalla no lo dice.

### Las 14 del contrato que no aparecen

Que no estén en el censo **no prueba que no existan en el CRM**: el contrato distingue tres niveles de confianza y tres de ellas están declaradas como `pendiente` justamente porque todavía no se crearon.

| Etiqueta | Confianza declarada | Lectura |
|---|---|---|
| `setter_nuevo`, `setter_en_calificacion`, `setter_calificado` | `pendiente` | **No existen y no se mandan.** `sePuedeMandar` las filtra (`contrato.ts:520-534`). El pipeline del setter funciona igual: la fuente de verdad de la etapa es nuestra base. |
| `seguimiento_terminado` | `sin_confirmar` | Existe según el contrato, nadie confirmó qué significa. Sólo lectura. |
| `venta_ganada`, `adelanto_ganado` | `confirmado` | Existen y **nunca se escribieron**: de 7 resultados registrados, ninguno fue venta. |
| `bot_activado`, `bot_apagado_manual`, `bot_desactivado_leadflow` | `confirmado` | Declaradas verificadas en la subcuenta, sin uso en nuestros contactos. |
| `seguimiento_recupero`, `seguimiento_para_agendar`, `seguimiento_decision_lt` | `confirmado` | Las series de recontacto. **Ninguna puesta**: el ícono ⏱ está apagado en los 584. |
| `derivado_lt`, `estancado` | constantes sin confianza declarada | Sin uso. `estancado` pinta la cola de estancadas, que por lo tanto está vacía. |

### Un hecho del contrato que se movió, y mucho

`contrato.ts:41` dice: *«Medido contra la subcuenta real el 2026-08-24: **3 de 238** tienen las dos»* etiquetas de zona. Medido hoy sobre los 559 contactos vivos (excluyendo congelados, cuya foto está vencida):

```
con las dos zonas   64 de 559   (11,4 %)
```

De 1,3 % a 11,4 % en tres semanas. La regla de precedencia «gana el closer» (`contrato.ts:52-55`) dejó de ser una defensa contra un caso raro: hoy decide el territorio de **64 contactos**.

---

## Los campos personalizados: 170 definidos, 102 poblados, 149 fuera de la pantalla

### El catálogo

```sql
select count(*), count(distinct carpeta_id) from negocio.campos_del_crm
```

| | |
|---|---|
| Campos totales | **170** |
| Carpetas | **24** |
| Campos con al menos un valor guardado | **102** |
| Campos sin ningún valor | **68** |
| Última lectura del catálogo | 2026-09-15 00:00 |

Hay además **3 identificadores de campo con valores guardados que el catálogo no define** (28, 7 y 1 contacto) — campos borrados en GoHighLevel cuyos valores quedaron en la foto del contacto. El catálogo no borra lo que desapareció, a propósito (`camposDelCrm.ts:195-204`).

### El reparto por carpeta, y las que son inalcanzables

Un campo se dibuja en el Perfil sólo si su carpeta tiene `grupo` (`camposDelCrm.ts:256`). El grupo se pone **una sola vez, al descubrir la carpeta**, desde `CARPETAS_DEL_PERFIL` (`contrato.ts:279-289`), que lista cuatro.

| Clase | Carpetas | Campos | Con algún valor | Valores guardados |
|---|---|---|---|---|
| **Con grupo (se muestran)** | 4 | **21** | 21 | 3.205 |
| **Sin grupo (no se muestran)** | 20 | **149** | **81** | **4.939** |

O sea: **el 60 % de los valores que guardamos de GoHighLevel no se dibuja en ninguna pantalla.**

Hay que decir una cosa con precisión, porque «inalcanzable» tiene dos sentidos. Para la **pantalla**, los 149 están fuera y no hay forma de traerlos sin cambiar `carpetas_del_crm.grupo`. Para el **código de negocio**, existe una salida: `campoPorNombre` (`camposDelCrm.ts:307`) resuelve un campo por su nombre **saltándose el filtro de carpetas**, y existe exactamente porque «Confirmación Agendamiento» estaba guardado en 178 contactos y era ilegible. Hoy la usan `consumoDelPrecall.ts` y `indicadoresDeCitas.ts`. El precio está escrito: si alguien renombra el campo en el CRM, devuelve `null`.

Las 20 carpetas sin grupo, por tamaño:

| Carpeta | Campos |
|---|---|
| Form Funnel Demo | 30 |
| Additional Info | 28 |
| OLD FIELDS | 12 |
| Survey \| Survey Calificación ARIA | 10 |
| Form \| ScalingUSA \| VSL form | 9 |
| 📁 Score \| ICP (la versión vieja) | 9 |
| Form High Ticket | 8 |
| **📁 Atribución Campañas** | **8** |
| 📁 Links Sistema | 6 |
| 📁 Score \| Meta Lead Ads (OLDS) | 5 |
| Calls Jorge Veramendi | 4 |
| 📁 Resultado Avanzar | 4 |
| Llamada ElevenLabs | 3 |
| Lead Scoring | 3 |
| General Info | 2 |
| 📁 Rechazados | 2 |
| Form Calendario Consultoría | 2 |
| **VSL VTURB** | **2** |
| Agente de Appointment Flow | 1 |
| *(carpeta borrada, sin nombre)* | 1 |

### Lo que está adentro y nadie mira

Los campos sin grupo con más datos guardados:

| Campo | Carpeta | Contactos con valor |
|---|---|---|
| Last UTM Source | 📁 Atribución Campañas | **259** |
| Hora de Reunion | 📁 Links Sistema | 255 |
| Last UTM Medium (Adset) | 📁 Atribución Campañas | **254** |
| Link del meets | 📁 Links Sistema | 253 |
| Form Landing VSL | 📁 Score \| ICP | 247 |
| Fecha de Reunion | 📁 Links Sistema | 211 |
| Link reagenda | 📁 Links Sistema | 209 |
| Confirmación Agendamiento | 📁 Score \| ICP | 178 |
| Last Landing URL | 📁 Atribución Campañas | 173 |
| Last UTM Content (Anuncio) | 📁 Atribución Campañas | **158** |
| Last Campaign ID | 📁 Atribución Campañas | **143** |
| IGSID | 📁 Atribución Campañas | 120 |
| Meta Lead ID | 📁 Atribución Campañas | **116** |
| Last FB ClickId | 📁 Atribución Campañas | 85 |

**`Form Landing VSL` merece un párrafo propio.** 247 contactos, y su vocabulario es exactamente la etapa del embudo que el documento pide:

```
Agendado                       121
Form incompleto sin agendar     87
Form completo sin agendar       39
```

Eso es *form start rate* y *form completion rate* del §9.7, ya escrito por el CRM, en un campo que ninguna pantalla lee.

### Y el hallazgo que contradice lo que se creía

La carpeta **VSL VTURB** tiene dos campos:

| Campo | Tipo | Contactos con valor | Valores distintos |
|---|---|---|---|
| `VSL % máximo visto` | NUMERICAL | **79** | `0` — uno solo |
| `VSL segundos vistos` | TEXT | **79** | `0` — uno solo |

Esto es una distinción de los dos ceros, y hay que hacerla bien: para **505 contactos no hay dato** (el campo no está); para **79 el dato dice cero**. El tracking individual del VSL que el §5.3 pide *«cuando exista tracking individual verificable»* **está cableado y no reporta nada**. Eso es un problema del medidor —vTurb o su integración—, no de GoHighLevel, y es una tarde de trabajo, no un proyecto.

Comparado con el precall, donde el mismo error ya se cometió y se corrigió (`consumoDelPrecall.ts:1-17`): los dos campos NUMERICAL dedicados al porcentaje (`Video Watch Percentage`, `Porcentaje de Video Visto`) están en **0 de 584**, y el porcentaje real viaja metido en las opciones de un RADIO, `Video Pre-Call`, poblado en **213**.

---

## Los webhooks: siete puertas declaradas, una conectada

`lib/ghl/avisos.ts:65` declara **siete eventos**, cada uno con su URL `…/api/avisos/crm?evento=<nombre>`. El evento viaja en la URL porque la acción «Webhook estándar» de GoHighLevel manda su payload nativo y **no permite editar el cuerpo JSON** (`avisos.ts:19-27`); la autenticación va por la cabecera `X-Webhook-Secret`.

### Lo que llega de verdad

```sql
select coalesce(evento,'(sin evento)'), count(*), sum(repeticiones),
       count(*) filter (where procesado_el is not null),
       count(*) filter (where error is not null),
       min(recibido_el), max(visto_ultimo_el)
from negocio.avisos_del_crm group by 1
```

| Evento declarado | Filas | Entregas | Procesados | Con error |
|---|---|---|---|---|
| `mensaje.entrante` | **311** | **320** | 305 | 0 |
| `mensaje.saliente` | 0 | 0 | — | — |
| `contacto.zona_closer` | 0 | 0 | — | — |
| `contacto.zona_setter` | 0 | 0 | — | — |
| `contacto.actualizado` | 0 | 0 | — | — |
| `cita.agendada` | 0 | 0 | — | — |
| `cita.cancelada` | 0 | 0 | — | — |

Primero el 2026-08-29 01:16 UTC, último el 2026-09-14 18:07 UTC. Los 311 tienen `atribucion = 'coincide'`: el `location.id` del cuerpo coincide con el de la empresa que puso el secreto — cero workflows apuntando a la URL equivocada.

Promedio de 18 avisos por día, con picos de 44 (2026-09-02) y valles de 2. Las 9 entregas duplicadas (320 − 311) las absorbió el `unique (org_id, huella)`.

**Seis de los siete workflows no están configurados en GoHighLevel.** No es un problema de código: las siete URLs se ofrecen en el panel y el manejador tiene el `case` de las siete. Lo que falta es pegar seis URLs en seis workflows. Lo que se gana, por cada uno:

- `cita.agendada` / `cita.cancelada`: el ícono 📅 se actualiza en segundos en vez de esperar el barrido horario. El propio catálogo lo explica: *«una cita cancelada que sigue encendida hace que no llame»* (`avisos.ts:107-110`). Con **160 de 317 citas canceladas**, es el caso frecuente, no el raro.
- `mensaje.saliente`: saca al contacto del Buzón sin esperar el ciclo.
- `contacto.actualizado`: cubre el caso de que un contacto **pierda** sus dos etiquetas de zona — hoy eso sólo lo descubre el barrido de contactos, y hay 25 congelados.

### La llamada que el webhook paga y podría no pagar

Cada aviso procesado hace un `GET /contacts/{id}` para releer etiquetas y recalcular territorio (`avisoDelCrm.ts:9-18`). El motivo está escrito y es bueno: que haya **un solo lugar** que decida el territorio. Pero el payload nativo ya trae `tags` y `attributionSource` (medido sobre un cuerpo real de 189 claves), así que son **305 llamadas en 17 días** que el cuerpo del propio aviso podría ahorrar. No recomiendo tocarlo sin resolver antes la duplicación de la decisión de territorio; lo dejo medido.

### Seis avisos sin procesar y sin motivo

6 de 311 tienen `procesado_el` nulo **y** `error` nulo. Los seis traen `contact_id`, los seis corresponden a contactos que están en nuestra base, y los seis traen texto de mensaje (24–68 caracteres). El manejador (`app/api/avisos/crm/route.ts:255-283`) escribe `procesado_el` en el camino feliz y `error` en **todos** los demás, así que **ninguna rama deja las dos columnas nulas**: la única explicación compatible es que la petición murió entre guardar la fila e interpretarla. No pude determinar la causa desde la base; queda como pendiente.

---

## Qué NO puede dar GoHighLevel — separado de qué sí puede y no le pedimos

El documento pide esta distinción explícitamente, y es la parte que decide dónde invertir.

### Los plantones del calendario pasaron de 3 a 15, y por primera vez se ve el cambio

El 2026-09-15, entre las **18:04:07 y las 20:03:54 UTC**, doce citas pasaron de `confirmed` a
`noshow`. Es el **único** cambio de estado que `negocio.citas.estado_cambiado_el` registró desde que
la columna existe: antes de esa tarde estaba nula en las 317 filas.

**Lo que NO empezó ese día es el `noshow`, y la distinción importa.** Las otras tres citas en
`noshow` —las que este informe ya publicaba— siguen sin registro de cambio, o sea que llegaron ya
marcadas: son del **2026-09-08 y el 09**, una semana antes. El calendario venía marcando plantones;
lo que cambió el 15 es el volumen y que ahora se ve la TRANSICIÓN.

```sql
select case when estado_cambiado_el is null then 'llegó ya marcada' else 'cambió con registro' end origen,
       count(*), min(inicio_el)::date, max(inicio_el)::date
from negocio.citas where lower(coalesce(estado_ghl,'')) = 'noshow' group by 1;
-- 2026-09-16 14:06 UTC: llegó ya marcada 3 (2026-09-08 · 09-09) · cambió con registro 12 (09-05 · 09-14)
```

```sql
select lower(coalesce(estado_anterior_ghl,'(nulo)'))||' -> '||lower(coalesce(estado_ghl,'(nulo)')) cambio,
       count(*), min(estado_cambiado_el) primero, max(estado_cambiado_el) ultimo
from negocio.citas where estado_cambiado_el is not null group by 1 order by 2 desc;
-- 2026-09-16 14:06 UTC: confirmed -> noshow · 12 · 2026-09-15 18:04:07 · 2026-09-15 20:03:54

select lower(coalesce(estado_ghl,'(nulo)')), count(*) from negocio.citas group by 1;
-- 2026-09-16 14:06 UTC: cancelled 160 · confirmed 146 · noshow 15   (este informe publicaba 3)
```

**Tres cosas, y ninguna de más:**

**1 · La señal del calendario dejó de ser anecdótica.** Con tres casos no había nada que hacer; con
quince, la vía del CRM empieza a competir con la única que había —lo que reporta una persona al
cerrar el intento en Avanzar—, que es de otra población y no se puede sumar con ésta.

**2 · Dos columnas que este informe y `09-DEUDA-ABIERTA.md` listan como escritas y sin nadie que las
lea acaban de recibir su primer dato.** Estaban ahí desde la `042` esperando exactamente esto:

```sql
select count(*) filter (where inicio_anterior_el is not null) inicio_anterior,
       count(*) filter (where estado_anterior_ghl is not null) estado_anterior,
       count(*) filter (where estado_cambiado_el is not null) estado_cambiado
from negocio.citas;
-- 2026-09-16 14:06 UTC: 1 · 12 · 12
```

La tercera, `inicio_anterior_el`, tiene **una** fila: una cita a la que le movieron la hora. Sigue
sin volumen para nada, pero ya no es cero — que es la diferencia entre «no se escribe» y «se escribe
poco», y este proyecto la paga cada vez que la confunde.

**3 · El *show rate* del §10.7 SIGUE sin poder calcularse, y conviene decir por qué** para que la
novedad no se lea como más de lo que es. `noshow` es el complemento, no la cifra: `asistio` está en
**0 de 321** y `estado_ghl = 'showed'` en **0**, así que no hay numerador. Quince casos tampoco pasan
el piso de diez sobre un denominador que nadie definió todavía — ¿las citas del período, las
confirmadas, las que ya ocurrieron? Esa decisión no se tomó.

Lo que corresponde es **volver a medirlo dentro de una semana** antes de construir nada encima: doce
transiciones en dos horas y ninguna después pueden ser el comienzo de un flujo permanente o una
limpieza que alguien corrió una vez a mano.

```sql
-- volver a correr el 2026-09-23 y comparar contra los 15 de arriba
select count(*) filter (where lower(coalesce(estado_ghl,'')) = 'noshow') noshow,
       count(*) filter (where lower(coalesce(estado_ghl,'')) = 'showed') showed,
       count(*) filter (where asistio is not null) con_asistio,
       max(estado_cambiado_el) ultimo_cambio
from negocio.citas;
```

### A · El proveedor NO lo tiene (o lo tiene vacío)

| Lo que el documento pide | Evidencia |
|---|---|
| **Asistencia a la cita** (§5.3 «Asistencia», §10.7 *show rate*) | **Está cambiando, y hay que mirarlo** — ver el bloque de abajo. Hasta el 2026-09-15 los campos existían vacíos: `showed`/`noshow` poblados en **3 de 1052 citas** (`calendarios.ts:186`). Desde entonces GoHighLevel empezó a mandar `noshow`. Lo que sigue igual es `showed`, en **0**, y `asistio`, nulo en **321 de 321** — por eso la escribe una persona en Avanzar y está fuera del `on conflict` del barrido (`citas.ts:417-427`). |
| **Duración y «contestada» de las llamadas** | Las 128 registros de llamada traen `status = completed` en el 100 % — es el estado de la llamada a la API, no si alguien atendió — y **no hay duración en ningún nivel, ni en `meta`** (`entrega.ts:243-248`). `negocio.llamadas` sigue con **0 filas** y sin escritor. |
| **Transcripción / resumen de llamada** | No existe. Lo único aprovechable es `attachments[0]`, la grabación, en 128 de 128. Convertirla en resumen es un subsistema, no una columna. |
| **Última actividad entrante/saliente por contacto** | GoHighLevel no documenta una fecha por dirección; lo más cercano, `lastActivity`, no distingue dirección (`sincronizar.ts:17-22`). Lo calcula un disparador nuestro sobre `negocio.mensajes`: `ultimo_entrante_el` poblado en 299 de 584, `ultimo_saliente_el` en 476. |
| **Etapa del funnel como campo del sistema** | No lo expone: la mueve un workflow. `negocio.contactos.etapa` está poblada en **6 de 584** y la llena nuestro pipeline; `score` en **0 de 584**. |
| **Listar las carpetas de campos personalizados** | Cuatro formas probadas contra la subcuenta real el 2026-09-07, las cuatro fallan (`cliente.ts:664-681`). Sólo se puede pedir una por una por su id. |
| **Filtrar conversaciones por etiqueta** | `GET /conversations/search` **ignora el filtro** y devuelve las 15.808 de la cuenta (`conversaciones.ts:6-9`). De ahí sale todo el diseño por marca de agua. |
| **Paginar citas** | `calendarId` es obligatorio (422 sin él) y **no acepta `limit`**: cualquier parámetro desconocido devuelve 422 nombrándolo (`calendarios.ts:25-45`). El costo del barrido es 1 + N calendarios, y crece con los calendarios, no con las citas. |
| **Gasto, impresiones, alcance, CPM, CTR** | Cero campos personalizados con esos nombres entre los 170 (consulta `ilike '%spend%' or '%cost%' or '%gasto%' or '%cpm%' or '%ctr%' or '%impres%'` → sólo devuelve preguntas de formulario sobre presupuesto del lead). No hay ninguna otra vía. |
| **El activo creativo** (§5.1 *Creative Profile*) | Cero campos con `%creativ%`. La atribución llega con `adId` pero sin imagen, video ni copy. |
| **`visitor_id` / `session_id`** (§16.2, pruebas 2 y 3) | No hay campo. Lo más cercano es `gaClientId` (37 contactos) y `fbp`/`fbc` (63) dentro de la atribución. Es un identificador de sesión ajeno, no nuestro. |
| **El ad set como identificador** | La atribución trae `adId` y `campaignId`, **no `adSetId`**. El ad set llega sólo como **nombre**, en `utmMedium` y en el campo `Last UTM Medium (Adset)` — 13 valores distintos, de 6 a 44 caracteres. |

### B · Sí lo tiene y no se lo pedimos

| Lo que existe | Evidencia de que existe | Por qué no llega |
|---|---|---|
| **Oportunidades y pipelines** | `TYPE_ACTIVITY_OPPORTUNITY` apareció **6 veces en la muestra de 65 mensajes** (`entrega.ts:125`): hay oportunidades vivas en la subcuenta. | Ninguna de las 14 operaciones toca `/opportunities`. El §5.4 pide `opportunity_id` en el registro de venta y no hay de dónde sacarlo. |
| **Correo, Instagram y llamadas** | Medido el 2026-09-14 sobre 518 conversaciones: **375 correos, 236 de Instagram, 128 de llamada** — el 10 % del tráfico de nuestros contactos. | `esDeUnCanalDelChat` los descarta. **Decisión de producto del 2026-09-14** (`entrega.ts:213-231`), no una omisión: de cada fila de `negocio.mensajes` cuelga el disparador del Buzón, y un correo entrante pondría al contacto debiendo respuesta por un canal que la aplicación no puede contestar. |
| **El resultado del agente de voz** | 259 apariciones de etiquetas de llamada (`answered` 51, `not answered` 58, `assistant hangup` 42, `voicemail reached` 31, `contact hangup` 29, `contact declined` 24, `dial *` 24). | El contrato no las conoce. Están guardadas crudas en `contactos.etiquetas` y **no las lee nadie**. |
| **El estado del formulario de la landing** | `Form Landing VSL`, 247 contactos, con los tres estados del embudo. | Su carpeta (`📁 Score \| ICP`) no tiene grupo. |
| **Confirmación de asistencia** | `Confirmación Agendamiento`, 178 contactos, vocabulario `Si`/`No`. | Misma carpeta sin grupo; se alcanza por `campoPorNombre` y ya se usa. |
| **La grabación de la llamada** | `attachments[0]` en 128 de 128. | `leerMensaje` no lee `attachments`. |
| **El catálogo real de etiquetas** | `GET /locations/{loc}/tags` está implementado (`cliente.ts:450`). | Sólo se llama cuando la búsqueda trae cero contactos. Nunca se ejecutó en régimen. |

---

## ¿Hace falta conectar el API de Meta? La respuesta con la atribución que ya está guardada

**Para atribuir un lead a un anuncio, no.** Ya está.

### Lo que hay guardado hoy en `negocio.contactos`

```sql
select count(*),
  count(*) filter (where atribucion_primera::text <> '{}'),
  count(*) filter (where atribucion_ultima::text  <> '{}')
from negocio.contactos
```

| | Contactos | % de 584 |
|---|---|---|
| Atribución de **primer toque** no vacía | **544** | 93,2 % |
| Atribución de **último toque** no vacía | **557** | 95,4 % |

Las claves, contadas una por una sobre la atribución de primer toque:

| Clave | Contactos | Qué es |
|---|---|---|
| `sessionSource` | 544 | `Paid Social` 360, `Social media` 158, `Direct traffic` 24, `CRM UI` 2 |
| `medium` | 544 | `External Form` 244, `facebook` 215, `calendar` 79, `instagram` 2 |
| `utmSource` | 506 | |
| `utmMedium` | 505 | el **ad set, como nombre** — 13 valores distintos |
| `utmContent` | 503 | el **anuncio, como nombre** — 30 valores distintos |
| `campaignId` | **358** | **14 campañas distintas** |
| `fbclid` | 285 | click id de Facebook |
| `campaign` | 270 | nombre de campaña |
| `adSource` | 214 | `facebook` en los 214 |
| **`adId`** | **213** | **15 anuncios distintos, 18 dígitos, numéricos los 213** |
| `fbc` / `fbp` | 63 / 63 | cookies de Meta |
| `gaClientId` | 37 | |

Tomando las dos atribuciones juntas: **`adId` en 219 contactos, `campaignId` en 369, `fbclid` en 289.**

Y el CRM lo guarda **por segunda vez** como campos personalizados, en la carpeta `📁 Atribución Campañas`: `Last UTM Source` 259, `Last UTM Medium (Adset)` 254, `Last UTM Content (Anuncio)` 158, `Last Campaign ID` 143, `Meta Lead ID` **116**, `Last FB ClickId` 85, `IGSID` 120.

### El embudo por anuncio ya se calcula

Cruzando `atribucion_primera->>'adId'` con `negocio.citas`:

| Anuncio (`adId`) | Contactos | Con cita | Citas | Canceladas |
|---|---|---|---|---|
| 120249633901580467 | 109 | 48 | 51 | 39 |
| 120249633901550467 | 44 | 20 | 20 | 17 |
| 120249633901570467 | 17 | 6 | 6 | 6 |
| 120249612287400467 | 13 | 2 | 2 | 0 |
| 120249254739160467 | 8 | 0 | 0 | 0 |
| *…10 anuncios más* | 22 | 3 | 3 | 2 |
| **Total con anuncio** | **213** | **79** | **83** | **64** |
| Sin anuncio | 371 | 203 | 235 | 96 |

O sea que *«agendamientos por fuente y anuncio»* (§9.7) y *«show rate por anuncio»* (§10.7) se pueden construir **hoy, sin una llamada nueva a nadie**. El paso 1 de la prueba de trazabilidad del §16.2 —*«capturar UTMs y `meta_ad_id`»*— ya está cumplido en 213 contactos.

### Qué agregaría Meta, exactamente

Tres cosas, y ninguna es la atribución:

1. **El denominador de costo.** Gasto, impresiones, alcance, CPM, CTR, frecuencia. Sin esto no hay CPL, ni CPA, ni ROAS. **No existe en ninguna parte de GoHighLevel** (medido: cero campos con esos nombres entre los 170).
2. **El activo creativo.** Imagen, video, copy, título. Es lo que el §5.1 llama *Creative Profile* y sin lo cual Creative Intelligence no tiene qué mirar. Tampoco existe en el CRM.
3. **El `adSetId` como identificador.** Hoy el ad set llega sólo como nombre de texto en `utmMedium`. Un nombre se puede renombrar en Meta y la serie histórica se parte sin que nada falle; el id no.

### La recomendación, con su cifra

**No conectar Meta todavía, y no porque falte atribución — porque falta el otro lado del cociente.**

```
contactos con anuncio atribuido      213
  → con cita                          79
  → con resultado registrado            3
```

`negocio.resultados` tiene **7 filas en total** (`seguimiento` 4, `no_show` 2, `no_interesa` 1) y **ninguna venta**. Un ROAS por anuncio calculado hoy se apoyaría en 3 hechos. Conectar Meta antes de que el registro de resultados tenga volumen produce exactamente lo que este proyecto persigue en todas partes: un número plausible que contesta otra pregunta.

El orden que las mediciones sugieren, de más barato a más caro:

1. **Leer lo que ya está guardado.** La carpeta `📁 Atribución Campañas` y `Form Landing VSL` tienen 1.075 valores guardados y ninguna pantalla los lee. Costo: poner `grupo` a una carpeta, o una llamada a `campoPorNombre`. Cero llamadas al proveedor.
2. **Conectar los seis webhooks que faltan.** Cero código; seis URLs en seis workflows. Baja la latencia de la cita cancelada de una hora a segundos, sobre 160 citas canceladas de 317.
3. **Arreglar el medidor del VSL.** El campo existe y está poblado en 79 contactos con valor `0` en los 79. Es el paso 5 del §16.2 y no depende de GoHighLevel.
4. **Enseñarle al contrato las 44 etiquetas que no conoce** — o al menos las tres familias que decidieron algo: cancelación de cita (111), resultado del agente de voz (259 apariciones) y fallos de canal de WhatsApp (21 contactos sin canal).
5. **Y recién ahí, Meta**, cuando el registro de ventas tenga con qué dividir el gasto.

---

## Pendientes: lo que no pude verificar

Cada uno de estos es un hueco medido, no una suposición.

1. **El catálogo real de etiquetas de la subcuenta nunca se leyó.** `GET /locations/{loc}/tags` sólo se llama si la búsqueda trae cero contactos (`sincronizar.ts:232-236`). Las 62 etiquetas de este informe son las que cargan nuestros 584 contactos: **un piso**. Puede haber etiquetas en el CRM que ningún contacto de zona tiene. Una sola llamada manual lo cerraría.

2. **Seis avisos quedaron sin procesar y sin motivo.** 6 de 311, con `procesado_el` y `error` los dos nulos. Ninguna rama del manejador deja ese estado (`app/api/avisos/crm/route.ts:255-283`), así que la petición murió entre guardar e interpretar. No se puede diagnosticar desde la base: hace falta mirar el registro de la función en Vercel de esas seis fechas (2026-08-29, 08-31, 09-04, 09-08, 09-09, 09-11).

3. **Las etiquetas de confianza de `entrega.ts` están vencidas.** El catálogo marca `failed` y `queued` como `sin_confirmar` (`entrega.ts:69, :68`). Medido hoy en `negocio.mensajes`: **`failed` 430 y `queued` 2**. Los dos están confirmados por los hechos y el archivo todavía dice que no. (El conteo completo: `delivered` 3.760, `read` 1.055, `failed` 430, sin estado 375, `completed` 120, `sent` 101, `queued` 2.)

4. **El techo de tasa de GoHighLevel no está medido, y no hay red debajo.** `cliente.ts:264-266` dice que ni el código que el proveedor devuelve al pasarse está confirmado. `pedirExterno` **no reintenta nunca** y no lee `Retry-After`. Hoy corremos a ~1.392 llamadas/día para una empresa; con cinco empresas conectadas serían ~7.000, y nadie sabe dónde está el límite.

5. **No pude comprobar el alcance del token.** El Private Integration Token en uso lee contactos, etiquetas, campos, usuarios, calendarios y conversaciones — eso está probado por las llamadas que funcionan. Si tiene alcance sobre `/opportunities` es una pregunta que sólo se contesta llamando al proveedor, y este informe fue de solo lectura contra la base. Si lo tiene, `opportunity_id` del §5.4 está a una llamada de distancia.

6. **La llamada diaria que se sabe perdida.** La carpeta `SU7G44jzFy1XJKZ7aY31` fue borrada en GoHighLevel y responde 404; como su `nombre` es nulo, se le vuelve a pedir una vez por día para siempre (`camposDelCrm.ts:35-42`). Está documentado y aceptado; lo dejo contado porque nadie lo va a ver en ninguna factura.

7. **Los 20 contactos congelados con etiqueta de zona vencida.** No es un defecto —el congelamiento no toca `etiquetas` a propósito— pero significa que cualquier cifra construida sobre `contactos.etiquetas` incluye hasta 20 fotos de hasta el 2026-09-11. Quien mida etiquetas debería filtrar por `territorio is not null` o decir que no lo hizo.

---
