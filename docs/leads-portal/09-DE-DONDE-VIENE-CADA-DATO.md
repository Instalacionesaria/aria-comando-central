# De dónde viene cada dato, y su cobertura medida

> Medición propia contra **producción**, hecha el **2026-09-27 a las 00:10 UTC** (el 26 a las 19:10
> en Lima) con `scripts/supabase.mjs leer`, que es la única vía que ve las filas. **Sólo consultas
> agregadas**: de la base no salió ni un nombre, ni un correo, ni un teléfono. Es la medición de LP-0.
>
> Cada cifra lleva al pie la consulta que la produjo. Son los fragmentos de la consulta de la
> medición, separados para poder correrlos de a uno; el resultado anotado es el que dio la consulta
> entera. **Donde una cifra no se midió, se dice**, y la consulta que la mediría va igual: una
> cobertura sin medir escrita como si estuviera medida es el defecto que esta carpeta existe para no
> cometer.
>
> Todo lo de este archivo describe a **ARIA**, la única organización con contactos (`LP09-13`).

---

## 0 · El encabezado de todas las consultas

```sql
with org as (select id from identidad.organizaciones where slug = 'aria'),
     c   as (select * from negocio.contactos where org_id = (select id from org))
```

Las consultas de abajo se escriben **a continuación de esas dos líneas** y no las repiten. Las que
leen citas agregan una tercera:

```sql
   , ci  as (select * from negocio.citas where org_id = (select id from org))
```

---

## 1 · Qué lee la pestaña

### LP09-01 · Diez tablas que ya existen, y ninguna columna nueva

| tabla | qué aporta a la pestaña | dónde nace |
|---|---|---|
| `negocio.contactos` | la persona: alta, puntaje, territorio, etiquetas, atribución, campos del CRM, asignado, país, teléfono y correo | `db/migraciones/011_negocio_closer_setter.sql:58`; le agregan columnas la `013`, la `034`, la `039` y la `048`, y la `055` cambia el tipo de `score` (`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:70-76`) |
| `negocio.citas` | agendó, asistió, plantón | `db/migraciones/011_negocio_closer_setter.sql:170`, más `asistio` en `db/migraciones/049_si_se_presento_a_la_cita.sql:46-47` |
| `negocio.resultados` | vendió y el monto | `db/migraciones/011_negocio_closer_setter.sql:373` |
| `negocio.mensajes` | el conteo de mensajes de la ficha (`LP09-11`); las fechas del último están en `contactos` | `db/migraciones/011_negocio_closer_setter.sql:217` |
| `negocio.campos_del_crm` | qué pregunta es cada clave de `contactos.campos_del_crm` | `db/migraciones/039_campos_del_crm.sql:124` |
| `negocio.carpetas_del_crm` | a qué grupo va cada carpeta de campos | `db/migraciones/039_campos_del_crm.sql:75` |
| `negocio.closer_asignado` | el puente entre el asignado del CRM y un closer nuestro | `db/migraciones/020_closer_asignado.sql:56` |
| `identidad.usuarios` | el nombre de ese closer, que `closersDeLaEmpresa` trae con un `innerJoin` (`lib/negocio/alcanceDelCloser.ts:83`) | `db/migraciones/002_organizaciones_y_usuarios.sql:72` |
| `negocio.anuncios` | el nombre del anuncio cuando `adId` cruza | `db/migraciones/050_lo_que_costo_cada_anuncio.sql:83`; la llave es `meta_anuncio_id` (`:93`) y el nombre, `nombre` (`:105`) |
| `negocio.tareas_programadas` | si el barrido está al día (`frescuraDe`, `lib/negocio/frescura.ts:108`) | `db/migraciones/014_tareas_programadas.sql:41` |

**Requisito:** la pestaña se construye sobre estas diez y **ninguna etapa agrega una columna ni
una sincronización nueva**. Es la decisión del 2026-09-26 —el universo son los contactos que ya se
guardan— y es también lo que la medición permite: todo lo que la maqueta dibuja y tiene fuente ya
está en estas tablas; lo que no está, no está en ninguna (`LP09-12`).

---

## 2 · El universo y la cohorte

### LP09-02 · 593 contactos, y 24 que no entran en ninguna ventana

| qué | cuántos |
|---|---|
| contactos | **593** |
| territorio `closer` | 287 |
| territorio `setter` | 281 |
| sin territorio (congelados) | 25 |
| sin `alta_en_el_crm` | **24, los 24 congelados** |
| última alta | 2026-09-25 14:53 UTC |
| última sincronización | 2026-09-27 00:00 UTC |

```sql
select (select count(*) from c) contactos,
       (select jsonb_object_agg(coalesce(territorio, 'congelado'), n)
          from (select territorio, count(*) n from c group by 1) x) por_territorio,
       (select count(*) from c where alta_en_el_crm is null) sin_alta,
       (select jsonb_object_agg(coalesce(territorio, 'congelado'), n)
          from (select territorio, count(*) n from c where alta_en_el_crm is null group by 1) x) sin_alta_por_territorio,
       (select max(alta_en_el_crm) from c) ultima_alta,
       (select max(sincronizado_el) from c) ultima_sincronizacion;
-- 593 · {closer 287, setter 281, congelado 25} · 24 · {congelado 24} · 2026-09-25 14:53 · 2026-09-27 00:00
```

La cohorte se arma con `alta_en_el_crm` —el `dateAdded` del CRM, no `creado_el`, que es cuándo lo
vio nuestro barrido (`db/migraciones/048_de_donde_vino_el_lead.sql:59-63`)—. Un contacto sin alta
no cae en ninguna ventana, **ni siquiera en «Todo»**.

**Requisito:** los 24 sin alta **se declaran en la cobertura** de la respuesta (`sinAlta`), no se
descartan en silencio. Son pocos y son todos congelados, pero la regla no depende de eso: una
cohorte que pierde filas sin decirlo no suma el universo, y nadie tendría cómo notarlo.

### LP09-03 · La cohorte en las cuatro ventanas

| ventana | contactos |
|---|---|
| hoy (24 h) | **0** |
| 7 días | **3** |
| 30 días | **286** |
| todo | **569** (= 593 − 24) |

```sql
select (select count(*) from c where alta_en_el_crm >= now() - interval '1 day')     hoy_24h,
       (select count(*) from c where alta_en_el_crm >= now() - interval '7 days')    d7,
       (select count(*) from c where alta_en_el_crm >= now() - interval '30 days')   d30,
       (select count(*) from c where alta_en_el_crm >= now() - interval '3650 days') completo;
-- 0 · 3 · 286 · 569
```

Dos cosas que esta tabla no es:

- **No es un barrido caído.** La última sincronización es de diez minutos antes de la medición. Las
  ventanas cortas están casi vacías porque casi no entra gente desde que se pausaron las campañas,
  el 2026-09-14 (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:178-191`). La
  pantalla tiene que poder decir «no hay altas» y distinguirlo de «no hay dato»: por eso viaja la
  frescura al lado.
- **No es la ventana anclada al día.** La medición usa la ventana rodante del plan —`now()` menos
  N días—, y `ventanaDeLaCohorte` (`lib/negocio/recorrido.ts:197-199`) ancla al día calendario. Qué
  forma usa la pestaña se decide en `06-PERIODOS-Y-PISOS.md`; si se cambia, estas cifras se
  vuelven a medir con la otra forma.

---

## 3 · La tabla: cada dato de la pantalla, con su origen

La maqueta se cita para decir **qué pieza de la pantalla** es, no porque su valor sea un requisito:
los literales son andamiaje y su censo está en `10-LO-QUE-NO-ES-UN-REQUISITO.md`.

### LP09-04 · La tarjeta de la rejilla

La tarjeta de cada lead está en `aios-command-center_1.html:4757-4775`. Lo que el plan manda en cada
fila de la lista, y de dónde sale:

| dato | en la maqueta | de dónde sale | cobertura (2026-09-27) |
|---|---|---|---|
| Nombre | `aios-command-center_1.html:4761` | `contactos.nombre`, `not null` (`db/migraciones/011_negocio_closer_setter.sql:69`); un contacto sin nombre no entra (`lib/negocio/sincronizar.ts:348-351`) | 593 de 593, por construcción |
| Campaña | `aios-command-center_1.html:4762`, primera mitad | `atribucion_primera->>'campaign'` | **271** de 593 |
| Creativo | `aios-command-center_1.html:4762`, segunda mitad | `atribucion_primera->>'utmContent'`, que es la llave del creativo de Creative (`lib/negocio/calidadDelCreativo.ts:21-24`) | **505** de 593 |
| Puntaje | `aios-command-center_1.html:4764-4767` | `contactos.score`, entero de 0 a 100 (`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:70-76`) | **471** con valor; 47 de ellos en 0 |
| Tramo | `aios-command-center_1.html:4766` | derivado del puntaje con los cortes 75 y 50, **nunca guardado** | ver `LP09-06` |
| Territorio | no se dibuja | `contactos.territorio` (`db/migraciones/011_negocio_closer_setter.sql:88`) | 287 · 281 · 25 sin territorio |
| Descartado | no se dibuja | etiquetas contra `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`), en minúscula | **121** |
| Agendó | `aios-command-center_1.html:4752` | `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:128-134`) | **sin medir con este predicado**: `LP09-07` |
| Asistió | `aios-command-center_1.html:4752` | `citas.asistio` | `true` en 0 · `false` en 0 |
| Plantón | no se dibuja | `marcadaComoPlanton` (`lib/negocio/citasAlcanzables.ts:111-113`) | 15 personas |
| Vendió | `aios-command-center_1.html:4752`, `:4771-4772` | un resultado con `salida = 'venta'` | **0** |
| Monto | `aios-command-center_1.html:4770-4771` («facturado») | suma de `resultados.monto` de esas ventas (`db/migraciones/011_negocio_closer_setter.sql:394-395`) | **0** montos en toda la base |
| Alta | en la ficha, «hace 2 h» (`aios-command-center_1.html:4790-4791`) | `contactos.alta_en_el_crm` (`db/migraciones/048_de_donde_vino_el_lead.sql:68-72`) | 569 de 593 |

Las cinco tarjetas de arriba (`aios-command-center_1.html:4704-4731`) **no tienen origen propio**:
cuentan filas de esta lista por tramo. Lo que dibujen tiene que salir de sumar estas columnas, o la
tarjeta y la rejilla pueden contradecirse sin que nada falle.

**Requisito:** ninguna columna de esta lista es teléfono, correo, atribución cruda ni un campo del
CRM. La lista blanca y su motivo están en `12-QUIEN-VE-QUE.md`.

### LP09-05 · La ficha, sección por sección

La ficha de la maqueta está en `aios-command-center_1.html:4804-4863`. Se recorre en su orden.

**Acciones y contacto**

| dato | en la maqueta | de dónde sale | cobertura (2026-09-27) |
|---|---|---|---|
| Llamar | `aios-command-center_1.html:4807`, sin manejador | `contactos.telefono` (`db/migraciones/011_negocio_closer_setter.sql:70`) como `tel:` | **558** de 593, medido en LP-3 (`LP09-P05`) |
| Email | `aios-command-center_1.html:4808`, sin manejador | `contactos.email` (`db/migraciones/011_negocio_closer_setter.sql:71`) como `mailto:` | **590** de 593, medido en LP-3 (`LP09-P05`) |
| ↗ GHL | `aios-command-center_1.html:4809`, `:4865-4866` | — | se borra: sin enlace a GoHighLevel (`12-QUIEN-VE-QUE.md`) |
| Teléfono, Email | `aios-command-center_1.html:4862` | las mismas dos columnas | sólo en la ficha |
| Closer asignado | `aios-command-center_1.html:4862` | `crm_asignado_a` cruzado con `negocio.closer_asignado` y el nombre de `closersDeLaEmpresa` (`lib/negocio/alcanceDelCloser.ts:77-95`) | `LP09-10` |
| País | no está | `contactos.pais` (`db/migraciones/048_de_donde_vino_el_lead.sql:128-129`) | **569** |
| Sincronizado | no está | `contactos.sincronizado_el` | la última, 2026-09-27 00:00 UTC |

**Recorrido** (`aios-command-center_1.html:4813-4821`)

| paso | en la maqueta | de dónde sale | cobertura |
|---|---|---|---|
| Entró | `aios-command-center_1.html:4815` | alta, campaña y creativo | 569 con alta |
| «Vio el VSL» | `aios-command-center_1.html:4816` | **se reemplaza** por «Llegó por»: `familiaDelRecorrido` (`lib/negocio/recorrido.ts:139-167`) | sin medir en LP-0 (`LP09-P03`) |
| El VSL | `aios-command-center_1.html:4816`, `:4830-4838` | no hay dato: hueco declarado (`LP09-12`) | — |
| Agendó · closer | `aios-command-center_1.html:4817` | `tieneCitaAlcanzable` y el closer asignado | `LP09-07`, `LP09-10` |
| Asistió | `aios-command-center_1.html:4818` | `citas.asistio`; el plantón, aparte | 0 · 0 |
| Compró | `aios-command-center_1.html:4819` | venta y monto | 0 |

**Formulario y calificación**

| dato | en la maqueta | de dónde sale | cobertura |
|---|---|---|---|
| Las nueve preguntas | `aios-command-center_1.html:4823-4828`, inventadas | el grupo `calificacion` de `perfilDeLaFicha` (`lib/negocio/ficha.ts:459-538`) | `LP09-09` |
| «8/8 campos» y «Formulario completado» | `aios-command-center_1.html:4823`, `:4858` | no hay conteo de campos; lo más cercano es el estado «Form Landing VSL» (`lib/negocio/recorrido.ts:208-215`) | `LP09-09` |
| ICP Score | `aios-command-center_1.html:4857` | `contactos.score` | 471 |
| Fit score, Intent score | `aios-command-center_1.html:4857` | **no existen** | hueco |
| Video precall | `aios-command-center_1.html:4832` | «Video Pre-Call», del grupo `interacciones` (`lib/ghl/contrato.ts:327-329`) | `LP09-09` |

**Interacciones** (`aios-command-center_1.html:4840-4844`, y el relleno de `:4680-4682`)

| dato | de dónde sale | cobertura |
|---|---|---|
| último mensaje entrante y saliente | `ultimo_entrante_el`, `ultimo_saliente_el` (`db/migraciones/011_negocio_closer_setter.sql:130-132`) | `LP09-11` |
| desde cuándo se leyó la historia | `mensajes_desde_el` (`db/migraciones/013_ingesta_de_mensajes.sql:134`) | `LP09-11` |
| las citas y los resultados | `negocio.citas`, `negocio.resultados` | `LP09-07` |

**Parámetros de publicidad** (`aios-command-center_1.html:4846-4854`)

| rótulo | de dónde sale | cobertura | viaja |
|---|---|---|---|
| Plataforma (`:266`) | lo más cercano es `sessionSource`, que es el origen de la sesión y no la plataforma | 552 | sí |
| Campaña (`:266`) | `campaign` | 271 | sí |
| Conjunto (`:266`) | `utmMedium`, que es el **nombre** del conjunto; y `utmTerm`, que es su **id** (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:95-96`) | 507 · 273 | sí, los dos |
| Creative (`:267`) | `utmContent` | 505 | sí |
| Ubicación, Posición (`:267`) | no existen (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:304`) | — | hueco |
| Objetivo (`:268`) | `negocio.anuncios.objetivo` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:115`), vía `adId` | 213 cruzan; con el objetivo cargado, **sin medir** (la columna admite nulo) | **fuera de la lista blanca** (`LP05-P02`) |
| Costo del lead (`:268`) | no existe por persona | — | hueco |
| Dispositivo, Ciudad (`:269`) | sólo derivables de `userAgent` y de `ip` | 331 · 331 | **no**: hueco (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:238`) |
| Punto de captura (`:270`) | el host de `url` y de `referrer` | 331 · 66 | sólo el host |
| utm_source (`:271`) | `utmSource` | 510 | sí |
| utm_medium (`:271`) | `utmMedium` | 507 | sí |
| utm_campaign (`:272`) | **la clave `utmCampaign` no está en el primer toque de ningún contacto**: el nombre de la campaña vive en `campaign`. En el último toque tampoco aparece: medido en LP-3 (`LP09-P05`) | 0 en el primer toque | — |
| utm_content (`:272`) | `utmContent` | 505 | sí |

---

## 4 · Las mediciones, una por una

### LP09-06 · El puntaje, los tramos y los ceros

`contactos.score` lo escribe la sincronización (`lib/negocio/sincronizar.ts:421`) desde el campo que
`CAMPO_DEL_PUNTAJE` designa (`lib/ghl/contrato.ts:305`), con `puntajeDelCrm`
(`lib/negocio/sincronizar.ts:524-530`): un valor fuera de 0-100 o no entero entra como nulo. **El
cero no se colapsa a nulo** (`lib/negocio/sincronizar.ts:412-420`): los dos ceros se guardan
distintos y la decisión de contarlos juntos es nuestra, en la pantalla.

| tramo | todo el universo | 30 días |
|---|---|---|
| ICP alto (≥ 75) | 108 | 51 |
| ICP medio (50-74) | 158 | 83 |
| ICP bajo (1-49) | 158 | 117 |
| Sin calificar (nulo o 0) | **169** = 122 nulos + 47 ceros | 35 |
| **total** | 593 | 286 |

```sql
, tramo as (
  select c.id,
         case when c.score is null or c.score = 0 then 'sin_calificar'
              when c.score >= 75 then 'alto' when c.score >= 50 then 'medio' else 'bajo' end as t
    from c)
select (select jsonb_object_agg(t, n) from (select t, count(*) n from tramo group by 1) x) por_tramo,
       (select jsonb_object_agg(t, n) from (select tr.t, count(*) n from tramo tr join c on c.id = tr.id
                                             where c.alta_en_el_crm >= now() - interval '30 days' group by 1) x) d30_por_tramo,
       (select count(*) from c where score is null) nulos,
       (select count(*) from c where score = 0) ceros;
-- {alto 108, medio 158, bajo 158, sin_calificar 169} · {alto 51, medio 83, bajo 117, sin_calificar 35} · 122 · 47
```

Los 47 ceros, por semana de alta, y los recientes:

| semana de alta | ceros |
|---|---|
| 2026-08-17 | 3 |
| 2026-08-24 | 23 |
| 2026-08-31 | 21 |
| **últimos 14 días** | **0** |

```sql
select (select jsonb_object_agg(s, n) from (
          select to_char(date_trunc('week', alta_en_el_crm), 'YYYY-MM-DD') s, count(*) n
            from c where score = 0 group by 1 order by 1) x) ceros_por_semana,
       (select count(*) from c where score = 0 and alta_en_el_crm >= now() - interval '14 days') ceros_14_dias;
-- {2026-08-17 3, 2026-08-24 23, 2026-08-31 21} · 0
```

Y el cruce con la etiqueta `icp_rechazado`, que es un descarte que pone una persona en el CRM:

| tramo | con `icp_rechazado` |
|---|---|
| alto | **0** |
| medio | 22 |
| bajo | 45 |
| sin calificar | 1 |

```sql
-- con el encabezado y el `tramo` de la consulta anterior
select jsonb_object_agg(t, n) from (
  select tr.t, count(*) n from tramo tr join c on c.id = tr.id
   where exists (select 1 from unnest(c.etiquetas) e where lower(e) = 'icp_rechazado') group by 1) x;
-- {medio 22, bajo 45, sin_calificar 1}; alto no aparece: 0
```

**Requisitos que salen de acá:**

- El tramo **se deriva en el momento** y no se guarda. Es el requisito que ya dejó escrito
  Acquisition al ver dos leads de la maqueta con el mismo puntaje en tramos distintos
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:514-518`).
- Los ceros **se cuentan como sin calificar y se dice**: la respuesta separa `sinPuntaje` (122) de
  `enCero` (47). Y viaja `cerosRecientes`, que hoy vale 0: si aparece un cero en los últimos 14 días,
  la pantalla avisa, porque entonces el grupo dejó de ser el lote cerrado de agosto.
- La divergencia con Creative **se declara**: su ICP promedio por pieza sí promedia los ceros
  (`lib/negocio/calidadDelCreativo.ts:218`). Las dos cifras están bien por separado y miden cosas
  distintas; lo que no puede pasar es que alguien las compare sin saberlo. El detalle, en
  `14-EL-PUNTAJE-DEL-CRM.md`.

### LP09-07 · Citas, asistencia, plantón y venta, por persona

| qué, contado por PERSONA | cuántas |
|---|---|
| con alguna cita | **292** |
| con alguna cita de un contacto que no está congelado | 278 |
| con citas, y todas canceladas | 146 |
| con `asistio = true` | **0** |
| con `asistio = false` | **0** |
| con una cita pasada, no cancelada y sin asistencia registrada | 145 |
| con un plantón del calendario (`estado_ghl = 'noshow'`) | 15 |
| con una venta | **0** |

```sql
, cita as (
  select ci.*, (ci.estado_ghl is distinct from 'cancelled') as no_cancelada,
         exists (select 1 from negocio.contactos x
                  where x.id = ci.contacto_id and x.territorio is not null) as de_contacto_vivo
    from ci)
select (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id)) con_alguna_cita,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id and cita.de_contacto_vivo)) de_contacto_vivo,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id)
                                 and not exists (select 1 from cita where cita.contacto_id = c.id and cita.no_cancelada)) solo_canceladas,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id and cita.asistio is true)) asistio_true,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id and cita.asistio is false)) asistio_false,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id and cita.inicio_el < now()
                                                and cita.no_cancelada and cita.asistio is null)) pasada_sin_registro,
       (select count(*) from c where exists (select 1 from cita where cita.contacto_id = c.id and cita.estado_ghl = 'noshow')) planton,
       (select count(*) from c where exists (select 1 from negocio.resultados r
                                              where r.contacto_id = c.id and r.salida = 'venta')) con_venta;
-- 292 · 278 · 146 · 0 · 0 · 145 · 15 · 0
```

Y los resultados de toda la base:

```sql
select jsonb_object_agg(coalesce(salida, 'null'), n)
  from (select salida, count(*) n from negocio.resultados where org_id = (select id from org) group by 1) x;
-- {seguimiento 4, no_show 2, no_interesa 1}
select count(*) from negocio.resultados where org_id = (select id from org) and monto is not null;
-- 0
```

**La cifra que falta, y hay que decirlo antes que nada: «agendó» no está medido con el predicado
que la pestaña va a usar.** La medición llamó «alcanzable» a la cita de un contacto con territorio,
y el código llama alcanzable a otra cosa: `ghl_calendario_id is not null`
(`lib/negocio/citasAlcanzables.ts:54-56`), la cita que el barrido todavía puede refrescar. Son dos
preguntas distintas, así que **el 278 no es el «agendó» de la pestaña** y no se publica como tal.
Tampoco lo es el 292, que cuenta las citas congeladas. La cifra con el predicado exacto se midió en
LP-2, y está en `LP09-P01`.

Dos diferencias más de la sonda contra el código, que no cambian la conclusión pero hay que
anotarlas: la sonda da por cancelada sólo `'cancelled'`, y el código usa la lista
`ESTADOS_CANCELADOS` (`lib/ghl/calendarios.ts:192`), que agrega `'canceled'` y `'cancelada'`.

**Requisitos que salen de acá:**

- **Agendó es `tieneCitaAlcanzable`**, la misma definición que Acquisition, Creative, Conversion y
  Sales, y por eso una persona con todas sus citas canceladas **sí** agendó. La que sólo tiene citas
  congeladas no, y viaja marcada aparte (`cita: 'solo_congeladas'`).
- **La asistencia son cuatro estados** —asistió, no asistió, sin registrar, sin cita— y hoy, medido,
  todo lo que tiene cita cae en «sin registrar». Las 145 personas con una cita pasada sin registro
  son el techo; con el predicado exacto, medido en LP-2, son **77** en «Completo», y ésas son las
  que la pantalla dibuja como «sin registrar» y no como «no asistió» (`LP02-04`).
- **El plantón del calendario viaja aparte y no se suma a la asistencia.** Son dos fuentes de la
  misma pregunta y sólo una es nuestra (`lib/negocio/citasAlcanzables.ts:105-110`).
- **Vendió y monto valen cero medido**, y el cierre por tramo es nulo con su motivo, no «0 %»: es la
  misma lectura que Sales, que declara el revenue y la tasa de cierre como hueco porque *«un "$0"
  acá afirmaría que no se vendió nada»* (`lib/negocio/huecosDeSales.ts:57-62`).

### LP09-08 · La atribución: veinte claves, y cuáles viajan

`atribucion_primera` guarda **todas** las claves escalares que manda el CRM, tal como vienen
(`lib/ghl/cliente.ts:215-225`). O sea que la columna tiene datos que no son de publicidad: la IP y
el navegador de la persona.

| clave | contactos | ¿viaja a la ficha? |
|---|---|---|
| `sessionSource` | 552 | sí |
| `medium` | 552 | no: no está en la lista blanca |
| `mediumId` | 548 | no |
| `utmSource` | 510 | sí |
| `utmMedium` | 507 | sí, rotulado «conjunto, por nombre» |
| `utmContent` | 505 | sí, rotulado «creativo» |
| `campaignId` | 358 | no: `negocio.anuncios` guarda el id de la campaña pero no su nombre (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:101-105`) |
| `ip` | 331 | **nunca** |
| `url` | 331 | **sólo el host** |
| `userAgent` | 331 | **nunca** |
| `fbclid` | 286 | **nunca** |
| `utmTerm` | 273 | sí |
| `campaign` | 271 | sí |
| `adSource` | 214 | no |
| `adId` | 213 | sí, con el nombre del anuncio |
| `fbp` | 69 | **nunca** |
| `fbc` | 66 | **nunca** |
| `referrer` | 66 | **sólo el host** |
| `utmKeyword` | 49 | sí |
| `gaClientId` | 41 | **nunca** |

```sql
select jsonb_object_agg(k, n) from (
  select k, count(*) n from c, jsonb_object_keys(coalesce(atribucion_primera, '{}'::jsonb)) k
   group by 1 order by 2 desc) x;
```

Las direcciones completas llevan identificadores adentro:

| qué | cuántos |
|---|---|
| URLs con un JWT, un `fbclid=`, un `token=` o un `jwt=` adentro | **286** de 331 |
| `adId` que cruza con `negocio.anuncios` | **213 de 213** |
| con país | 569 |

| host de `url` | contactos |
|---|---|
| `accelerator.ariaia.com` | 292 |
| `api.leadconnectorhq.com` | 15 |
| `calls.ariaia.com` | 10 |
| `grow.ariaia.com` | 4 |
| `tunegocio.ariaia.com` | 4 |
| `tunegocioia.com` | 4 |
| `www.fbsbx.com` | 1 |
| una previsualización de `vibepreview.com` | 1 |

```sql
select (select jsonb_object_agg(h, n) from (
          select substring(atribucion_primera->>'url' from '^https?://([^/?#]+)') h, count(*) n
            from c where atribucion_primera ? 'url' group by 1 order by 2 desc limit 12) x) hosts,
       (select count(*) from c where atribucion_primera->>'url' ~* '(eyJ[a-z0-9_-]{10,}|fbclid=|token=|jwt=)') urls_con_token,
       (select count(*) from c where exists (select 1 from negocio.anuncios an
                                              where an.org_id = c.org_id
                                                and an.meta_anuncio_id = c.atribucion_primera->>'adId')) ad_id_que_cruza,
       (select count(*) from c where pais is not null) con_pais;
-- (la tabla de arriba) · 286 · 213 · 569
```

**Requisitos que salen de acá:**

- La atribución pasa por **una lista blanca**, y una clave que no está en ella **no viaja**, sea la
  que sea. Una clave nueva que el CRM empiece a mandar mañana nace invisible, no publicada.
- De `url` y `referrer` va **el host y nada más**: con 286 de 331 URLs cargando un token, mostrar la
  dirección entera es publicar un identificador. La migración lo dejó dicho al guardar la columna
  (`db/migraciones/048_de_donde_vino_el_lead.sql:94-99`).
- El nombre del anuncio sale de `negocio.anuncios` por `adId`, y **los 213 cruzan**: ahí no hay
  pérdida. Sin `adId` no se inventa un nombre.

### LP09-09 · Los campos del CRM: el cuestionario, el formulario y el precall

El catálogo, por grupo:

| grupo | carpetas | campos |
|---|---|---|
| `calificacion` | 3 | 17 |
| `interacciones` | 1 | 4 |
| sin grupo | 21 | **174** |

```sql
select (select jsonb_object_agg(coalesce(grupo, 'sin_grupo'), n)
          from (select grupo, count(*) n from negocio.carpetas_del_crm
                 where org_id = (select id from org) group by 1) x) carpetas,
       (select jsonb_object_agg(coalesce(ca.grupo, 'sin_grupo'), n)
          from (select ca.grupo, count(*) n from negocio.campos_del_crm cc
                  join negocio.carpetas_del_crm ca on ca.org_id = cc.org_id and ca.carpeta_id = cc.carpeta_id
                 where cc.org_id = (select id from org) group by 1) ca) campos;
-- {sin_grupo 21, calificacion 3, interacciones 1} · {sin_grupo 174, calificacion 17, interacciones 4}
```

Las tres carpetas de `calificacion` son las de `lib/ghl/contrato.ts:318-326`: «Contact», con el
puntaje y dos URLs; «📁 Score | ICP Nuevo», el formulario de la landing; y «📁 Score | ICP Lead
Form (Meta)», el mismo cuestionario para quien entra por el formulario de Meta.

**Contactos con alguna respuesta del grupo `calificacion`: 475.** Pero esa cifra **cuenta al propio
puntaje como una respuesta**, porque «Puntaje | ICP» vive en la carpeta «Contact», que es del mismo
grupo (`lib/ghl/contrato.ts:319-322`). Con 471 puntajes, el 475 dice casi nada sobre el cuestionario.
La cobertura de las preguntas propiamente dichas se midió en LP-3: **336**, en `LP09-P02`.

```sql
select count(*) from c where exists (
  select 1 from jsonb_object_keys(coalesce(c.campos_del_crm, '{}'::jsonb)) k
    join negocio.campos_del_crm cc on cc.org_id = c.org_id and cc.campo_id = k
    join negocio.carpetas_del_crm ca on ca.org_id = cc.org_id and ca.carpeta_id = cc.carpeta_id
   where ca.grupo = 'calificacion' and coalesce(c.campos_del_crm->>k, '') <> '');
-- 475
```

El estado del formulario de la landing, «Form Landing VSL»:

| valor | contactos |
|---|---|
| Agendado | 121 |
| Form incompleto sin agendar | 87 |
| Form completo sin agendar | 39 |
| vacío | **346** |

No se escribe desde el 2026-08-31 (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:114`),
y su «Agendado» **no es la fuente del agendamiento**: es un estado del formulario, y la cita la dice
`negocio.citas` (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:158-170`). La pestaña
lo muestra como estado del formulario, con la fecha del corte al lado, y nunca como «agendó».

El video precall, «Video Pre-Call»:

| valor | contactos |
|---|---|
| Sin abrir (0%) | 130 |
| Nada | 50 |
| 76–100% | 12 |
| 1–25% | 11 |
| -20% | 6 |
| 51–75% | 4 |
| Accede: sin reproducir | 3 |
| 26–50% | 2 |
| 40-60% | 2 |
| Clic a link | 2 |
| vacío | **371** |

```sql
select (select jsonb_object_agg(coalesce(v, 'vacio'), n) from (
          select c.campos_del_crm->>cc.campo_id v, count(*) n
            from c join negocio.campos_del_crm cc on cc.org_id = c.org_id and cc.nombre = 'Form Landing VSL'
           group by 1) x) form_landing_vsl,
       (select jsonb_object_agg(coalesce(v, 'vacio'), n) from (
          select c.campos_del_crm->>cc.campo_id v, count(*) n
            from c join negocio.campos_del_crm cc on cc.org_id = c.org_id and cc.nombre = 'Video Pre-Call'
           group by 1) x) video_precall;
```

De los 222 con valor, **180 son «Sin abrir (0%)» o «Nada»**, y esos dos no dicen «no vio el
video»: son el estado inicial que el CRM escribe al agendar (`lib/negocio/consumoDelPrecall.ts:22-33`).
La ficha lo dibuja (`LP05-11`, en `05-LA-FICHA-DEL-LEAD.md`) y lo rotula como lo rotula
Conversation: «el CRM no registró reproducción».

**Requisitos que salen de acá:**

- De `campos_del_crm` a la ficha van **sólo** tres cosas: los campos del grupo `calificacion` —por
  `perfilDeLaFicha`, que ya descarta lo vacío (`lib/negocio/ficha.ts:481-487`)—; el «Video Pre-Call»
  del grupo `interacciones` (`LP05-11`; los otros tres campos de ese grupo son `LP05-P01`); y el
  estado del formulario. **Los 174 sin grupo no viajan**, salvo esa última: ahí están la atribución
  de campañas y los enlaces del sistema (`lib/ghl/contrato.ts:243-245`).
- **La excepción, dicha:** «Form Landing VSL» vive en la carpeta «📁 Score | ICP», que no tiene
  grupo (`docs/OTROS/estado actual/06-INTEGRACIONES-GHL.md:458`; no está en
  `CARPETAS_DEL_PERFIL`, `lib/ghl/contrato.ts:318-330`), y se lee **por nombre**, con
  `CAMPO_DEL_FORMULARIO` (`lib/negocio/recorrido.ts:208`, `:235`). Es el único campo sin grupo que
  viaja, y viaja nombrado, no por pertenecer a una carpeta. La prueba de LP-3 «un campo sin grupo no
  aparece» tiene que dejarlo pasar a él y a ningún otro: un segundo campo sin grupo en la ficha es
  un rojo.
- El puntaje no se cuenta dos veces: si la ficha dibuja el grupo `calificacion` entero, el
  «Puntaje | ICP» aparece como fila del cuestionario **y** como puntaje. Uno de los dos se omite.

### LP09-10 · El closer asignado

| qué | cuántos |
|---|---|
| contactos con `crm_asignado_a` | **253** |
| de ésos, que cruzan con uno de los closers configurados | **252** |
| closers configurados | 3 |

```sql
select (select count(*) from c where crm_asignado_a is not null) con_asignado,
       (select count(*) from c where exists (select 1 from negocio.closer_asignado ca
                                              where ca.org_id = c.org_id and ca.crm_usuario_id = c.crm_asignado_a)) cruza,
       (select count(*) from negocio.closer_asignado where org_id = (select id from org)) configurados;
-- 253 · 252 · 3
```

**Requisito:** el que no cruza —uno— se muestra como «asignado a alguien que no está configurado
como closer», **nunca con el identificador crudo del CRM**. El nombre sale de `closersDeLaEmpresa`
(`lib/negocio/alcanceDelCloser.ts:77-95`), que ya va por la conexión del inquilino.

### LP09-11 · Los mensajes: cuándo, nunca qué

| qué | contactos |
|---|---|
| con un mensaje entrante | 305 |
| con un mensaje saliente | 484 |
| con la historia de mensajes leída | 541 |

```sql
select (select count(*) from c where ultimo_entrante_el is not null) entrante,
       (select count(*) from c where ultimo_saliente_el is not null) saliente,
       (select count(*) from c where mensajes_desde_el is not null) historia_leida;
-- 305 · 484 · 541
```

`ultimo_entrante_el` lo mueve un disparador sobre `negocio.mensajes` (`lib/ghl/entrega.ts:220-221`),
no la sincronización. **Requisito:** a la ficha van las fechas y los conteos. Las fechas están en
`contactos`; el conteo sale de contar filas de `negocio.mensajes` (`LP09-01`), y sólo se da cuando
la historia se leyó (`mensajes_desde_el`), porque antes de eso cero filas no es cero mensajes.
Cuántos mensajes tiene cada contacto **no se midió en LP-0**. `ultimo_entrante_texto`
(`db/migraciones/011_negocio_closer_setter.sql:131`) y el cuerpo de los mensajes **no viajan**: la
conversación entera ya tiene su pantalla, y la pide otra capacidad.

### LP09-12 · Lo que no existe en ninguna tabla

| lo que la maqueta dibuja | por qué no hay | se declara como |
|---|---|---|
| El VSL: visto, CTA y el registro de VTurb (`aios-command-center_1.html:4830-4838`) | sus 79 escrituras fueron todas 0, y no escribe desde el 2026-08-30 (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:16-20`, `:127-138`) | hueco |
| Fit score e Intent score (`aios-command-center_1.html:4857`) | el CRM no los calcula, ni nosotros | hueco |
| Ubicación y posición (`aios-command-center_1.html:4848`) | Meta no está conectado (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:304`) | hueco |
| Costo del lead (`aios-command-center_1.html:4849`) | el gasto es por anuncio y por día, no por persona | hueco |
| Dispositivo y ciudad (`aios-command-center_1.html:4850`) | sólo saldrían de `userAgent` y de la IP, que no viajan | hueco |
| El estado «Calificado» o «Perdido» (`aios-command-center_1.html:4685-4686`) | no hay columna; lo que existe es agendó, asistió, vendió y descartado | se deriva, con otros rótulos |

**Requisito:** cada hueco viaja declarado, con la fecha en que se midió, en el mismo lugar donde la
maqueta dibujaba el dato. Un hueco dicho es una decisión; uno callado es una regresión.

### LP09-13 · Una sola organización tiene datos

La medición de LP-0 se hizo sobre ARIA, y su resumen dice que **es la única con contactos**. Es lo
mismo que ya estaba anotado junto al campo del puntaje (`lib/ghl/contrato.ts:299-300`). Para
repetirlo:

```sql
select o.slug, (select count(*) from negocio.contactos c where c.org_id = o.id) contactos
  from identidad.organizaciones o order by 2 desc;
```

Las demás verían la pestaña vacía con sus avisos, que es lo correcto, y hay que comprobarlo en la
prueba de la ruta.

---

## Preguntas abiertas

### LP09-P01 · ¿Cuántas personas tienen una cita alcanzable? — **medida en LP-2**

**Medido el 2026-09-27 a las 02:06 UTC** con `scripts/medir-leads-portal.sql`, que escribe los predicados del código
—`tieneCitaAlcanzable`, `citaCerrable`, las tres grafías de cancelada— y no los de la sonda de LP-0:

| ventana | contactos | agendaron | sólo congeladas | sin registrar | plantón |
|---|---|---|---|---|---|
| `7d` | 3 | 3 | 0 | 1 | 0 |
| `30d` | 283 | **142** | 0 | 47 | 13 |
| `completo` | 569 | **200** | **79** | 77 | 15 |

`hoy` no tuvo a nadie. Los 30 días dan 283 y no los 286 de LP-0: la ventana es móvil y entre las
dos mediciones pasaron dos horas, así que su borde de atrás corrió; no se midió alta por alta. A 30
días, por tramo: alto 40 de 51 · medio 39 de 82 · bajo 48 de 117 · sin calificar 15 de 33.

Es la cifra de «agendó», y la medición de LP-0 no la tenía (`LP09-07`). Hacía falta **antes de
LP-4**: es la cifra contra la que se contrastan los agendados de la API en la verificación contra
producción (paso 3 de «Verificación de punta a punta» del plan), y la que la prueba de coherencia
con `cadenaDeCierre` —`pruebas/base/177-la-ruta-del-leads-portal.test.ts`, en LP-4— tiene que
reproducir. La prueba compara contra `cadenaDeCierre`, no contra esta cifra; esta cifra es la que
dice si las dos están bien.

```sql
select count(*) filter (where exists (select 1 from negocio.citas x
                                       where x.org_id = c.org_id and x.contacto_id = c.id
                                         and x.ghl_calendario_id is not null)) agendo,
       count(*) filter (where exists (select 1 from negocio.citas x
                                       where x.org_id = c.org_id and x.contacto_id = c.id)
                          and not exists (select 1 from negocio.citas x
                                           where x.org_id = c.org_id and x.contacto_id = c.id
                                             and x.ghl_calendario_id is not null)) solo_congeladas
  from c;
```

### LP09-P02 · ¿Cuántos contestaron el cuestionario, sin contar el puntaje? — **medida en LP-3**

**Medido el 2026-09-27 a las 02:19 UTC: 336 de 593 contestaron alguna pregunta.** Por carpeta,
«📁 Score | ICP Nuevo» (la landing) 219 y «📁 Score | ICP Lead Form (Meta)» 123; como suman 342, **6
personas contestaron los dos**. Dejar afuera la carpeta «Contact» o sólo el campo del puntaje da lo
mismo, 336: los otros dos campos de «Contact» no agregan a nadie. La consulta fue ésta, partida por
carpeta.

El 475 incluye al puntaje (`LP09-09`). La cobertura real del cuestionario se mide dejando afuera la
carpeta «Contact»:

```sql
select count(*) from c where exists (
  select 1 from jsonb_object_keys(coalesce(c.campos_del_crm, '{}'::jsonb)) k
    join negocio.campos_del_crm cc on cc.org_id = c.org_id and cc.campo_id = k
    join negocio.carpetas_del_crm ca on ca.org_id = cc.org_id and ca.carpeta_id = cc.carpeta_id
   where ca.grupo = 'calificacion' and ca.carpeta_id <> 'sVdAfUBdIWUzYedio9NZ'
     and coalesce(c.campos_del_crm->>k, '') <> '');
```

Y la misma consulta por carpeta dice cuántos contestaron el de la landing y cuántos el de Meta.

### LP09-P03 · ¿Cómo se reparte «Llegó por»? — **medida en LP-3, sobre el último toque**

**Medido el 2026-09-27 a las 02:20 UTC, con los hosts de `familiaDelRecorrido`:** landing 234 ·
widget 190 · sin página 90 · sin rastro 27 · Meta, navegador interno 23 · precall 20 · otra 9. En el
último toque no aparece ninguno de los dos hosts de abajo; las 9 de «otra» son una página de empleo
del dominio propio (4) y dos previsualizaciones de `vibepreview.com` (5), las mismas que el
comentario de `HOSTS` ya menciona (`lib/negocio/recorrido.ts:104-105`).

`familiaDelRecorrido` lee el host de **`atribucion_ultima`** (`lib/negocio/recorrido.ts:125-127`),
y la medición de hosts de arriba es sobre **`atribucion_primera`**. Son el último toque y el primero,
y no se reemplazan uno por el otro. Además aparecen dos hosts —`tunegocio.ariaia.com` y
`tunegocioia.com`, 4 contactos cada uno— que no están en la lista de hosts del recorrido
(`lib/negocio/recorrido.ts:107-116`): si también están en el último toque, caen en «Otra página».
Eso no es un error —«otra» es una fila con su conteo— pero hay que verlo antes de publicarlo:

```sql
select lower(substring(atribucion_ultima->>'url' from '://([^/?#:]+)')) host, count(*)
  from c group by 1 order by 2 desc;
```

### LP09-P04 · ¿`adSource` entra en la lista blanca? — el resto es `LP05-P02`

El objetivo del anuncio (la fila «Objetivo» de la maqueta, `aios-command-center_1.html:4849`), `medium`
y `campaignId` ya son una pregunta abierta: `LP05-P02`, en `05-LA-FICHA-DEL-LEAD.md`, que también
dice que se contesta una sola vez. Esta pregunta no la repite; agrega sólo la clave que aquélla no
nombra.

`adSource` está en **214** contactos (primer toque, 2026-09-27) y no es un dato personal: es del
anuncio, no de la persona. No está en la lista blanca del plan. Lo más sensato es contestarla junto
con `LP05-P02`, con la misma regla para las cuatro claves. **Decide el usuario.**

### LP09-P05 · ¿Cuántos contactos tienen teléfono, correo, zona horaria y último toque? — **medida en LP-3**

**Medido el 2026-09-27 a las 02:20 UTC, sobre los 593:** teléfono **558** · correo **590** · zona
horaria **313** · último toque **566**. Las dos primeras confirman las del plan, ahora con consulta. En
el último toque, `utmCampaign` tampoco aparece, igual que en el primero.

La medición de LP-0 no los contó, y los botones «Llamar» y «Email» de la ficha dependen de los dos
primeros. **Teléfono y correo sí tienen una cifra anterior:** el plan aprobado anota 590 con correo
y 558 con teléfono, medidos el 2026-09-26
(`C:\Users\USUARIO\.claude\plans\purring-enchanting-dream.md:10`), pero sin una consulta versionada
al lado. Zona horaria y último toque no tienen ninguna medición sobre el universo de los 593; lo
único que hay de la zona horaria es la muestra de 100 contactos del 2026-09-14 que dio origen a la
columna (`db/migraciones/048_de_donde_vino_el_lead.sql:14-21`).

La consulta de abajo repite las dos primeras con fecha y consulta, y mide las dos que faltan. Para
el último toque, la misma consulta de claves de `LP09-08` sobre `atribucion_ultima` diría además si
`utmCampaign` aparece ahí:

```sql
select count(*) filter (where nullif(btrim(telefono), '') is not null) con_telefono,
       count(*) filter (where nullif(btrim(email), '') is not null)    con_correo,
       count(*) filter (where zona_horaria_del_lead is not null)       con_zona_horaria,
       count(*) filter (where atribucion_ultima <> '{}'::jsonb)        con_ultimo_toque
  from c;
```

```sql
select jsonb_object_agg(k, n) from (
  select k, count(*) n from c, jsonb_object_keys(coalesce(atribucion_ultima, '{}'::jsonb)) k
   group by 1 order by 2 desc) x;
```
