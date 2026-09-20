# Los tres instrumentos que se apagaron el mismo día

> Medición propia contra **producción**, hecha el **2026-09-20** con
> `node --env-file=.env.supabase scripts/supabase.mjs leer "…"`, que es la única vía que ve las filas
> —`DATABASE_URL_MIGRADOR` y `DATABASE_URL_INQUILINO` devuelven cero filas **sin error**—.
> Cada cifra de acá se puede reproducir con la consulta que está al pie.
> Es a la vez **fuente** —de acá salen los requisitos de `01` y `02`— y **corrección** de lo ya
> publicado: ver la § 6.

---

## 1 · El titular

Tres instrumentos distintos dejan de reportar en el mismo tramo de días:

| instrumento | último dato |
|---|---|
| `VSL % máximo visto` y `VSL segundos vistos` | **2026-08-30** |
| `Form Landing VSL` | **2026-08-31** |
| El host de la URL, que pasa de landing a widget | la **semana del 2026-08-31** |

**No se rompieron tres medidores.** Cambió la ruta por la que entra la gente, y los tres medían la
ruta vieja. El VSL es la excepción: además de quedarse sin población, **estaba roto desde antes**.

---

## 2 · El embudo se dio vuelta

### CV14-01 · En septiembre el 44 % agenda directo, sin pasar por la landing

Sobre `contactos.atribucion_ultima->>'url'`, clasificando por host:

| época | contactos | landing con VSL | widget de reserva | sin url |
|---|---|---|---|---|
| agosto y antes | 349 | **203 (58 %)** | 84 (24 %) | 55 |
| **septiembre** | 241 | **31 (13 %)** | **105 (44 %)** | 60 |

### CV14-02 · El cambio es abrupto, cae en una semana y se sostiene

| semana | contactos | landing | widget |
|---|---|---|---|
| 2026-08-10 | 117 | 79 (68 %) | 27 |
| 2026-08-17 | 90 | 69 (77 %) | 20 |
| 2026-08-24 | 53 | 39 (74 %) | 8 |
| **2026-08-31** | 175 | **22 (13 %)** | **74 (42 %)** |
| 2026-09-07 | 89 | 14 (16 %) | 39 (44 %) |

De 74 % a 13 % en una semana, y tres semanas sosteniéndose. **No es ruido ni estacionalidad: es una
decisión de ruta.** Por qué se tomó, la base no lo dice — queda como `CV14-P01`.

### CV14-03 · El censo por host: siete hosts, cinco cosas distintas

| host | total | septiembre | qué es |
|---|---|---|---|
| `accelerator.ariaia.com` | 230 | 30 | **la landing con VSL** |
| `calls.ariaia.com` | 143 | 73 | widget de reserva / redirección de trigger link |
| `api.leadconnectorhq.com` | 46 | 32 | widget de reserva de GoHighLevel |
| `www.fbsbx.com` | 23 | 23 | **navegador interno de Facebook** — no es una página nuestra; significa formulario nativo de Meta |
| `precall.ariaia.com` | 20 | 19 | post-agendamiento → **es de Appointment Flow**, no de acá |
| `grow.ariaia.com` | 4 | 1 | otra landing con VSL |
| `trabaja-con-nosotros.ariaia.com` | 4 | 3 | reclutamiento — **no es del embudo comercial** |
| *(sin url)* | 115 | 60 | **no es «desconocido»** — 89 son formulario nativo de Meta y 26 no traen nada, todos de agosto. Ver `CV1-10` |

Es la regla 5 de `docs/estado actual/03-CONVERSION.md:238` medida de nuevo veinte días después y
sobre otra columna: **sigue valiendo, y los repartos cambiaron**. Una métrica de «visitas a la
landing» que sume los siete cuenta cinco cosas distintas.

---

## 3 · La mejor fuente es la que nadie lee

### CV14-04 · `atribucion_ultima` tiene 2,6 veces más cobertura que el campo del CRM

| fuente | contactos con URL | de 590 |
|---|---|---|
| **`contactos.atribucion_ultima->>'url'`** | **475** | **80,5 %** |
| `contactos.atribucion_primera->>'url'` | 329 | 55,8 % |
| el campo del CRM `Last Landing URL` | 180 | 30,5 % |

Y **ningún módulo de `lib/negocio/` consulta `atribucion_ultima`**: las veinte apariciones de
`atribucion_primera|atribucion_ultima` en ese directorio son comentarios o consultas sobre la
**primera** (`atribucionDelLead.ts:142,145`; `calidadDeLaAtribucion.ts:96-140`;
`calidadDelCreativo.ts:197,214,233,321`; `costoDelAnuncio.ts:330`). La columna existe, se puebla y
no tiene lectores.

Eso es exactamente la regla 6 del departamento (`03-CONVERSION.md:242`): *«Acquisition mira el
primer toque —de qué anuncio vino—; Conversion mira el último —por dónde volvió a entrar—.
Confundirlos hace que el departamento mida cero y lo reporte como ausencia.»*

### CV14-05 · El puente con Creative existe, y no es por `adId`

De los 104 contactos cuya última URL es la landing propia:

| qué traen | cuántos |
|---|---|
| `utm_content` **dentro de la URL** | **89** |
| `utmContent` ya en `atribucion_primera` | 93 |
| **`adId`** | **4** |

O sea que Conversion cruza con Creative y con Acquisition **por el nombre del creativo**, que es la
llave de `lib/negocio/creativo.ts` y la misma que Creative usa con el 94,5 % de cobertura. Por `adId`
no cruza: cuatro de ciento cuatro.

---

## 4 · Los campos del CRM, uno por uno

### CV14-06 · El censo, con la distinción que importa

De los 172 campos del catálogo, ocho suenan a landing, VSL o formulario:

| campo | con valor | **≠ cero** | veredicto |
|---|---|---|---|
| `Form Landing VSL` | 247 | 247 | **sirve, y murió el 2026-08-31** |
| `Video Pre-Call` | 219 | 219 | sirve — **pero es de Appointment Flow** |
| `Last Landing URL` | 180 | 180 | sirve, y `atribucion_ultima` lo supera |
| `Clic a Video Pre-Call` | 20 | 20 | de Appointment Flow |
| **`VSL % máximo visto`** | **79** | **0** | **el medidor está roto** |
| **`VSL segundos vistos`** | **79** | **0** | **el medidor está roto** |
| `Porcentaje de Video Visto` | 0 | 0 | definido y nunca escrito |
| `Video Watch Percentage` | 0 | 0 | definido y nunca escrito |

La columna «≠ cero» es la que decide, y es la regla 1 del departamento
(`03-CONVERSION.md:215`): *«mientras el censo de un campo numérico tenga un solo valor distinto,
ese campo no es una medición: es un indicador de que algo se instaló y no funcionó»*.

### CV14-07 · El VSL no es un hueco de datos: es un campo que afirma «vio cero»

Setenta y nueve escrituras. Setenta y nueve ceros. **Ninguna excepción.** Esto es peor que un campo
vacío, porque un campo vacío se nota y un cero se publica. Publicar *«0 % de visionado promedio del
VSL»* sería técnicamente cierto y completamente engañoso.

El diagnóstico está en `docs/estado actual/06-INTEGRACIONES-GHL.md:313`: el tracking individual del
VSL *«está cableado y no reporta nada»*, y es problema del medidor —vTurb o su integración—, no de
GoHighLevel.

**Decisión del 2026-09-20: se declara como hueco en pantalla**, con el patrón `fueraDeAlcance` de
`lib/negocio/calidadDeLaAtribucion.ts:69`, y no se toca vTurb.

### CV14-08 · El formulario sí sirve, y su vocabulario es cerrado

`Form Landing VSL` (`SINGLE_OPTIONS`, `XqOfGEWle6fay7hPuvWp`) tiene tres valores y sólo tres:

| valor | contactos |
|---|---|
| `Agendado` | **121** |
| `Form incompleto sin agendar` | **87** |
| `Form completo sin agendar` | **39** |

Tasa de finalización del formulario: **(121 + 39) / 247 = 64,8 %**. Abandono: **35,2 %**. Es la
respuesta a la única frase que el documento funcional le atribuye a Conversion
(`CC_Arquitectura_Funcional.md:1425`).

`negocio.campos_del_crm` **no guarda las opciones declaradas de un campo**, así que no hay forma de
enterarse si el CRM agrega un cuarto valor salvo contando los que no caen en ninguna rama y
publicándolos — igual que `lib/negocio/consumoDelPrecall.ts` hace con `-20%` y `Clic a link`.

### CV14-09 · Pero su `Agendado` NO es la fuente del agendamiento

| lo que dice el campo | lo que confirma `negocio.citas` |
|---|---|
| `Agendado` en **121** contactos | **119** tienen alguna cita · **47** tienen una cita **alcanzable** · **2** no tienen ninguna |

Los 72 de diferencia entre 119 y 47 son **citas congeladas**: el CRM ya no devuelve sus eventos, y el
repositorio ya conoce ese caso (regla 4 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:153`).

**Consecuencia de diseño:** el agendamiento de Conversion sale del mismo `exists` con
`ghl_calendario_id is not null` que usan `costoDelAnuncio.ts:341-344`, `calidadDelCreativo.ts:223-226`,
`atribucionDelLead.ts:150-153` e `indicadoresDelLead.ts:243`. Si saliera del campo, esta pantalla
diría 121 donde las otras dicen 47, y **nadie tendría cómo saber cuál de las dos está mal**.

Lo que el campo sí aporta, y ninguna otra pantalla puede dar, es **el abandono del formulario**.

---

## 5 · Dos contextos que no son del departamento y lo condicionan

### CV14-10 · La pauta está apagada desde el 2026-09-14

| día | gasto |
|---|---|
| 2026-09-12 | $100,59 |
| 2026-09-13 | $15,09 |
| 2026-09-14 … 09-17 | **$0,00** |

Y los contactos caen de ~18 diarios (8 al 12 de septiembre) a ~1 desde el 13. **El barrido corre**
—la tarea `contactos` de `negocio.tareas_programadas` dice `corrio` el 2026-09-20 a las 18:31—, así
que no es un defecto de ingesta: no hay tráfico.

**Consecuencia:** las ventanas «Hoy» y «7 días» saldrán vacías. La pantalla tiene que poder decir
**«no hay tráfico»** y no **«no hay dato»**: son dos afirmaciones distintas y sólo una es cierta.

### CV14-11 · El campo del formulario sigue existiendo en el CRM

`negocio.campos_del_crm` lo vio el **2026-09-20**. O sea que nadie lo borró: dejó de escribirse
porque dejó de haber quien pasara por el formulario. Si la landing vuelve, el campo vuelve solo.

---

## 6 · Lo que esta medición corrige de lo ya publicado

### CV14-12 · `03-CONVERSION.md:32` dice que «ninguna» de las cinco cosas del § 18.16 llega, y una llega

El `§ 18.16:1546-1552` enumera lo que Acquisition le debe a Conversion: campaña y anuncio de origen,
calidad del tráfico, CTR, **landing page views**, y diferencias por audiencia y placement.

`docs/estado actual/03-CONVERSION.md:32` (corte del 2026-09-15) afirma que *«ninguna llega hoy»* y
nombra «Landing page views» entre las inexistentes. **Dejó de ser cierto el 2026-09-19**:
`landingPageView` llega en el desglose de acciones de Meta, se guarda en
`negocio.metricas_de_anuncio.acciones` (creada por `db/migraciones/053_el_desglose_que_ya_llegaba.sql`)
y ya se publica en `lib/negocio/rendimientoDelCreativo.ts` como «Vistas de la landing».

**Con dos límites duros que hay que decir al usarlo:** es **por anuncio y por día**, agregado de
Meta — no es una sesión, no es un visitante, y **no se puede cruzar con un contacto**. Y su cobertura
es del **63 %** de las filas anuncio-día con entrega (150 de 240, remedido el 2026-09-19), así que
viaja con su par `diasConLaClave / diasConEntrega` o la tasa sale baja, plausible y falsa.

### CV14-13 · La regla 5 del departamento se remidió sobre otra columna, y cambió de números

`03-CONVERSION.md:238` midió siete hosts sobre la ventana de 14 días: `calls.ariaia.com` 69,
`api.leadconnectorhq.com` 31, `accelerator.ariaia.com` 28, `www.fbsbx.com` 23, `precall.ariaia.com`
18, `grow.ariaia.com` 1, `trabaja-con-nosotros.ariaia.com` 3.

Remedido el 2026-09-20 sobre **toda** la base y sobre `atribucion_ultima`, el reparto es otro
—`accelerator` 230, `calls` 143— porque la ventana de 14 días cae **entera después del corte**. Las
dos mediciones son ciertas y dicen cosas distintas: **es exactamente por qué la regla 2 existe.**

---

## Preguntas abiertas

### CV14-P01 · ¿El cambio de ruta del 2026-08-31 fue deliberado?

La medición dice **qué** pasó, no **por qué**. Si fue una decisión de negocio —mandar el tráfico
directo a agendar—, entonces `Landing Intelligence` mide una ruta que la empresa abandonó, y el
departamento debería pesar distinto sus dos mitades. Si fue un accidente —un enlace que cambió, una
automatización que dejó de escribir—, es un defecto que cuesta dinero y nadie lo ha notado en veinte
días. **La base no puede desempatar esto.** Se contesta preguntando.

### CV14-P02 · ¿El widget de reserva deja rastro de algo más que la llegada?

`calls.ariaia.com` es hoy el recorrido mayoritario (73 de 241 en septiembre) y no sabemos si tiene
etapas medibles: si distingue «abrió el calendario» de «eligió horario» de «confirmó». Si no las
tiene, el recorrido directo es un solo punto y Conversion no puede decir dónde se pierde la gente en
él — que es literalmente su bajada de pantalla. Requiere una sonda propia contra GoHighLevel.

### CV14-P03 · Los 115 sin URL — **contestada el 2026-09-20 en `CV1-10`**

115 de 590 contactos no traen `url` en `atribucion_ultima`. **Son una familia con nombre**: 89 traen
atribución completa y 88 de ésos vienen de Meta sin pisar página —formulario nativo—, y los 26
restantes no traen nada y **son todos anteriores a septiembre**. La medición entera está en `CV1-10`.

Este número apunta allá y **no duplica el enunciado**: dos identificadores para la misma pregunta son
dos preguntas que divergen el día que alguien conteste una.

---

## Cómo reproducir cualquiera de estas mediciones

Todas corren contra producción en lectura. El molde:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "SELECT …"
```

**El reparto por época (`CV14-01`):**

```sql
select case when alta_en_el_crm >= '2026-09-01' then 'septiembre' else 'agosto y antes' end epoca,
       count(*) contactos,
       count(*) filter (where atribucion_ultima->>'url' ilike '%accelerator%'
                           or atribucion_ultima->>'url' ilike '%grow.ariaia%') landing,
       count(*) filter (where atribucion_ultima->>'url' ilike '%calls.ariaia%'
                           or atribucion_ultima->>'url' ilike '%leadconnectorhq%') widget,
       count(*) filter (where atribucion_ultima->>'url' is null) sin_url
  from negocio.contactos group by 1;
```

**El censo por host (`CV14-03`):**

```sql
select coalesce(substring(atribucion_ultima->>'url' from '://([^/?]+)'), '(sin url)') host,
       count(*) total,
       count(*) filter (where alta_en_el_crm >= '2026-09-01') septiembre
  from negocio.contactos group by 1 order by 3 desc, 2 desc;
```

**El censo de campos (`CV14-06`)** — nótese que se une por `org_id`, porque el catálogo es por
empresa:

```sql
with c as (select campo_id, nombre, org_id from negocio.campos_del_crm
            where nombre in ('VSL % máximo visto','VSL segundos vistos','Form Landing VSL',
                             'Last Landing URL','Porcentaje de Video Visto','Video Watch Percentage',
                             'Clic a Video Pre-Call','Video Pre-Call'))
select c.nombre,
       count(*) filter (where nullif(btrim(ct.campos_del_crm->>c.campo_id),'') is not null) con_valor,
       count(*) filter (where nullif(btrim(ct.campos_del_crm->>c.campo_id),'') is not null
                          and btrim(ct.campos_del_crm->>c.campo_id) !~ '^0([.,]0+)?%?$') no_cero
  from c join negocio.contactos ct on ct.org_id = c.org_id
 group by c.nombre order by 2 desc;
```

**El campo contra las citas de verdad (`CV14-09`):**

```sql
with f as (select campo_id, org_id from negocio.campos_del_crm where nombre = 'Form Landing VSL')
select count(*) dicen_agendado,
       count(*) filter (where exists (select 1 from negocio.citas ci
             where ci.org_id=ct.org_id and ci.contacto_id=ct.id)) con_alguna_cita,
       count(*) filter (where exists (select 1 from negocio.citas ci
             where ci.org_id=ct.org_id and ci.contacto_id=ct.id
               and ci.ghl_calendario_id is not null)) con_cita_alcanzable
  from f join negocio.contactos ct on ct.org_id=f.org_id
 where ct.campos_del_crm->>f.campo_id = 'Agendado';
```

**El gasto diario (`CV14-10`):**

```sql
select fecha::text, round(sum(gasto)::numeric,2) gasto
  from negocio.metricas_de_anuncio
 where fecha >= '2026-09-08' and gasto is not null group by 1 order by 1;
```
