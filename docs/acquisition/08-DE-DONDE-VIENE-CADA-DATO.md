# De dónde viene cada dato

> **`lib/aios/acquisition.js` YA NO EXISTE.** Se borró el 2026-09-16 junto con
> `acquisition-plan.js`, y con ellos los 58 literales inventados que esta carpeta documenta. Las
> citas `acquisition.js:N` de abajo **siguen siendo correctas como referencia histórica** —el
> archivo y sus líneas están en el historial de git— y ésa es toda su función acá: este documento
> nunca describió lo que hay, describió lo que la maqueta dibujaba para sacar de ahí los requisitos.
>
> **Y `components/views/AcquisitionView.jsx` se reescribió el mismo día**: pasó de 148 líneas a 60,
> así que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la
> línea 60 fallan al resolverse, y se ven. Las **once** que apuntan a las líneas 27-63 —el segmentado
> de período y el selector de rango— **siguen resolviendo y muestran otra cosa**, que es peor: una
> línea corrida no falla. Las once describen controles que ya no existen; el porqué de cada uno está
> en la cabecera del archivo nuevo.
>
> Lo que sí hay hoy es `components/acquisition/PanelDeAcquisition.jsx` con dos cifras medidas: el
> costo por anuncio (`lib/negocio/costoDelAnuncio.ts`) y el monitor de atribución del § 18.14
> (`lib/negocio/calidadDeLaAtribucion.ts`). Nada de lo demás está construido.

> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale, o dice que no lo tiene.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.
> **Las coberturas de este documento se volvieron a medir contra producción el 2026-09-16 a las
> 15:46 UTC**, una por una, y donde la medición nueva contradice al informe manda la nueva. Las
> diferencias están listadas en el § 6.

**De los 40 datos de este inventario, 12 sólo los puede dar el API de Marketing de Meta — una
integración que nunca se conectó, ni en esta plataforma ni en la anterior.** No se rompió: no se
hizo. `public.closer_meta_metricas` tiene la forma exacta que el §18.4 pide y **0 filas**;
`public.closer_meta_crudo`, **0 filas**; `public.closer_org_config` tiene 3 filas y **0 no nulos** en
`meta_ad_account_id` y en `meta_token_cifrado`; y un `grep` de esos tres nombres sobre los `.ts`,
`.js`, `.jsx`, `.mjs` y `.sql` del repositorio devuelve **cero coincidencias**.

Los otros 28 se reparten así: **13 se pueden medir hoy** contra `negocio.*`, **6 están guardados en
el CRM y no los lee ninguna pantalla** —y tres de esos campos dejaron de escribirse a fines de
agosto—, y **9 no tienen origen decidido**: no falta la integración, falta la decisión.

Los 12 de Meta no están repartidos al azar: **son todos los de dinero**. La Inversión, el costo de
cada una de las diez etapas, el costo por calificado del embudo, el de cada campaña y el global, el
subtítulo del quinto KPI y el umbral de «$110» del plan de acción salen todos del mismo dato que no
existe. Por eso el riesgo de esta pantalla no es quedarse corta: es reconstruirla leyendo contactos
reales y dejar el dinero saliendo de `CAMPS[i].invD` (`lib/aios/acquisition.js:21-33`), que produce
conteos verdaderos con costos inventados — peor que el prototipo de hoy, porque hoy nadie puede
confundirse.

---

## 1 · Cómo se midió

Todas las cifras de este documento salen de `node --env-file=.env.supabase scripts/supabase.mjs
leer "…"`, que va por la Management API. El rol que contesta es `supabase_read_only_user` —lo
devuelve `current_user`—, así que son lecturas y no pueden escribir nada.

**La ventana es de 14 días y la cohorte se arma con `alta_en_el_crm`**, que es cuándo entró el lead
al CRM, no con `creado_el`, que es cuándo lo vio nuestro barrido. Es la regla 6 del §6 de
`01-ACQUISITION.md` y la que respeta `lib/negocio/atribucionDelLead.ts:137`. Medido el 2026-09-16:
**184 contactos con `alta_en_el_crm` y 206 con `creado_el`** — 22 de diferencia que son latencia de
ingesta.

Los 14 días y el piso de 10 no son elección de este documento: son `DIAS_DE_LA_TASA = 14` y
`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:310` y `:300`), y usar otros produciría
filas que no suman contra las cifras que el resto del sistema ya publica.

```sql
-- la ventana, y la diferencia entre las dos columnas de fecha
select count(*) filter (where alta_en_el_crm >= now() - interval '14 days') as por_alta,
       count(*) filter (where creado_el      >= now() - interval '14 days') as por_creado,
       count(*) filter (where alta_en_el_crm is null)                       as sin_alta,
       count(*)                                                            as total
from negocio.contactos;
-- 2026-09-16 15:46 UTC: 184 · 206 · 25 · 585
```

**Los 25 contactos con `alta_en_el_crm` nula son un requisito por sí solos**:
toda cohorte armada con esa columna los descarta en silencio, y los 25 tienen `creado_el`. Una
pantalla que diga «184 contactos» sin decir que hay 25 que no puede fechar afirma una cobertura que
no tiene.

---

## 2 · Grupo A · Lo que ya está en `negocio.*`

Trece datos. Se pueden leer hoy, con una consulta, sin llamar a nadie.

| El dato · su rastro | Quién lo tiene | Estado hoy | Qué haría falta |
|---|---|---|---|
| **A8-01 · Contactos del período** — la entrada de cada embudo y el segundo KPI · `acquisition.js:90-91`, `:147` | `negocio.contactos.alta_en_el_crm` | **Ya está.** 184 en la ventana de 14 días | Un endpoint que cuente entre dos fechas. Y decir desde cuándo mide |
| **A8-02 · Agendados del período** — la última etapa de los tres embudos y el cuarto KPI · `acquisition.js:149` | `negocio.citas` con `ghl_calendario_id is not null` | **Ya está.** 158 citas alcanzables sobre 144 contactos | Usar el mismo filtro de cita alcanzable que `atribucionDelLead.ts:132-135`, o las filas no suman contra el resto del sistema |
| **A8-03 · La cadena contactos → agendados** — el eslabón que une dos etapas · `acquisition.js:92` | Las dos tablas de arriba | **Ya está.** 103 de 184 agendaron, **56,0 %** | Invertir la dirección del cálculo: acá la tasa es el dato y el volumen se deriva; en el sistema real se cuentan los dos volúmenes y la tasa es el cociente |
| **A8-04 · La afinidad ICP por campaña y por embudo** — la columna «Afinidad ICP» y el «ICP 62%» del bloque de calificados · `acquisition.js:98`, `:111`, `:181`, `:237` | `negocio.contactos.campos_del_crm` → «Puntaje \| ICP» (`NUMERICAL`) | **Ya está, y con mejor dato que el inventado.** 180 de 184 poblados (97,8 %) | Promediar el puntaje continuo. Los pesos 100/60/25 se tiran: imponen un piso de 25 % que nadie pidió |
| **A8-05 · El identificador del anuncio** — la clave de la fila de la tabla · `acquisition.js:20-35` (no lo tiene) | `atribucion_primera->>'adId'` | **Incompleto.** 137 de 184 (74,5 %); **6 anuncios distintos** | Agrupar por `adId` y nunca por nombre: «El app» tiene dos `adId` y «economia us latino» otros dos |
| **A8-06 · El identificador y el nombre de la campaña** — el nombre que encabeza cada fila · `acquisition.js:228` | `atribucion_primera->>'campaignId'` y `->>'campaign'` | **Ya está.** `campaignId` en 169 de 184 (91,8 %), nombre en 171; **3 campañas con id** | Normalizar la caja para agrupar y mostrar una variante tal cual vino (`atribucionDelLead.ts:110-127`), y descartar `{{campaign.id}}` |
| **A8-07 · El nombre del anuncio y el nombre del ad set** — lo que la tabla muestra cuando no hay id · `lib/aios/leads-portal.js:266` («Conjunto») y `:271-272` (`utm_medium`, `utm_content`) | `utmContent` (anuncio) y `utmMedium` (ad set) | **Ya está.** 172 y 174 de 184 | Decir en pantalla que el ad set es un nombre y no un id — un renombre en Meta parte la serie sin que nada falle |
| **A8-08 · El punto de entrada** — el candidato real a «embudo» · `acquisition.js:5-18` | `atribucion_primera->>'mediumId'` | **Ya está, y son cinco, no tres.** 184 de 184 | Decidir si el embudo es el punto de entrada (§ 5, A8-35) |
| **A8-09 · La plataforma del anuncio** — la mitad de «Activa · Meta» · `acquisition.js:229` | `atribucion_primera->>'adSource'` | **Incompleto.** 139 de 184, valor `facebook` en los 139 | Nada. El literal «Meta» se reemplaza por este campo; el «Activa» no (ver A8-23) |
| **A8-10 · La ventana y su período de comparación** — las dos ventanas de `windows()` · `acquisition.js:59-83`, `:71-73` | `alta_en_el_crm` entre dos fechas | **Ya está para 7, 14 y 30 días. No está para «Hoy» ni para el histórico.** 184 contra 177 los 14 días previos; 390 contra 144 los 30 previos; **51 contra 133** en 7 días; **0 hoy** | Que la nota del rango diga desde cuándo hay serie. Y que «Hoy» tenga estado vacío: hoy dibujaría una pantalla en cero |
| **A8-11 · La cohorte detrás de cada cifra** — los cuatro atributos del drill-down · `acquisition.js:153-154`, `leads-group.js:79-85` | `negocio.contactos` (`id`, `nombre`, `ghl_contact_id`, puntaje ICP) | **Ya está.** El panel hoy recicla 14 contactos inventados (`leads-group.js:14-29`) | Que cada cifra mande su cohorte y no un número: hoy viaja `data-n`, un conteo, y el panel lo rellena con una muestra |
| **A8-12 · La zona horaria en la que se cortan los días** — el defecto de `shift` · `acquisition.js:53-57` | `identidad.organizaciones.zona_horaria` | **Ya está y nadie la usa acá.** `America/Lima` para la organización con datos | Cortar las ventanas en la zona declarada. `shift` parsea en UTC, opera en hora local y serializa en UTC: un cruce de horario de verano corre la ventana un día |
| **A8-13 · La fila «sin anuncio»** — la que el modelo del prototipo no admite · `acquisition.js:20-35` | La ausencia de `adId` en la cohorte | **Ya está, y es la fila más importante.** 47 contactos, **38 agendan: 80,9 %**, la tasa más alta de la ventana | El conteo va y la tasa no (`atribucionDelLead.ts:179-183`). Y `CAMPS` no tiene dónde ponerla: toda fila pertenece a una campaña |

### Cómo se midió cada cobertura

```sql
-- A8-01, A8-05, A8-06, A8-07, A8-08, A8-09 · cobertura de la atribución de primer toque
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select count(*) as cohorte,
 count(*) filter (where atribucion_primera ? 'mediumId')   as medium_id,
 count(*) filter (where atribucion_primera ? 'adSource')   as ad_source,
 count(*) filter (where atribucion_primera ? 'utmMedium')  as adset_nombre,
 count(*) filter (where atribucion_primera ? 'utmContent') as anuncio_nombre,
 count(*) filter (where atribucion_primera ? 'campaign')   as campana_nombre,
 count(*) filter (where atribucion_primera ? 'campaignId') as campana_id,
 count(*) filter (where atribucion_primera ? 'adId')       as anuncio_id,
 count(*) filter (where atribucion_primera ? 'utmTerm')    as adset_id
from v;
-- 2026-09-16 15:46 UTC: 184 · 184 · 139 · 174 · 172 · 171 · 169 · 137 · 31
```

```sql
-- A8-02, A8-03 · la cadena, con el mismo filtro de cita alcanzable del resto del sistema
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select count(*) as cohorte,
 count(*) filter (where exists (
   select 1 from negocio.citas ci
    where ci.org_id = v.org_id and ci.contacto_id = v.id
      and ci.ghl_calendario_id is not null)) as agendaron
from v;
-- 2026-09-16: 184 · 103   (56,0 %)

select count(*) as citas_alcanzables, count(distinct contacto_id) as contactos,
       count(*) filter (where asistio) as asistio_true
from negocio.citas
where ghl_calendario_id is not null and inicio_el >= now() - interval '14 days';
-- 2026-09-16: 158 · 144 · 0
```

**`asistio` está en 0 de 158, y es un cero de los que hay que distinguir.** No significa que nadie
asistió: significa que nadie lo registró. No afecta a Acquisition —el departamento termina en
calificados (`AcquisitionView.jsx:94-100`)— pero cierra la puerta a validar contra resultado
cualquier definición de «calificado» que se elija (A8-33).

```sql
-- A8-04 · el puntaje ICP, resuelto por nombre y nunca por identificador escrito a mano
with cid as (select campo_id from negocio.campos_del_crm where nombre = 'Puntaje | ICP' limit 1),
v as (select (campos_del_crm ->> (select campo_id from cid))::numeric as icp
        from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select count(*) as cohorte, count(icp) as con_puntaje, round(avg(icp),1) as promedio,
       count(*) filter (where icp >= 75) as alto,
       count(*) filter (where icp >= 50 and icp < 75) as medio,
       count(*) filter (where icp <  50) as bajo
from v;
-- 2026-09-16: 184 · 180 · 48,6 · 37 · 59 · 84
```

```sql
-- A8-05, A8-13 · el reparto por anuncio, con sus agendas
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days'),
cita as (select distinct contacto_id from negocio.citas where ghl_calendario_id is not null)
select coalesce(v.atribucion_primera->>'adId','(sin adId)') as ad_id,
       min(v.atribucion_primera->>'utmContent') as anuncio,
       count(*) as contactos,
       count(*) filter (where c.contacto_id is not null) as agendaron
from v left join cita c on c.contacto_id = v.id group by 1 order by 3 desc;
-- 2026-09-16:
--   120249633901580467 «agendamiento - yaping»   83 / 39   (47,0 %)
--   (sin adId)          «{{ad.name}}»            47 / 38   (80,9 %)
--   120249633901550467 «El app»                  35 / 18   (51,4 %)
--   120249633901570467 «economia us latino»      14 /  6   (42,9 %)
--   120249792217700467 «El app»                   2 /  1
--   120249792217690467 «economia us latino»       2 /  1
--   120249792217680467 «agendamiento - yaping1»   1 /  0
```

**Con el piso de 10, la mayoría de los anuncios cae en «Otras».** El reparto es de cola larga y se mueve con la ventana, así que cuántas filas quedan publicables no es un dato fijo: es una consecuencia del piso y hay que volver a medirlo cada vez. Y la segunda
fila es la que no existe en el modelo del prototipo.

```sql
-- A8-13 · el hueco de atribución tiene forma, y es una sola campaña
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select coalesce(atribucion_primera->>'campaignId','(sin campaignId)') as campana,
       atribucion_primera->>'medium' as medium, count(*) as contactos
from v where not (atribucion_primera ? 'adId') group by 1,2 order by 3 desc;
-- 2026-09-16: 120249590301010467 + calendar 31 · (sin campaignId) + calendar 12 ·
--             (sin campaignId) + facebook 2 · {{campaign.id}} + calendar 1 · External Form 1
```

**31 de los 47 son la campaña BOFU que manda al widget de calendario: la campaña sobrevive y el
anuncio se pierde.** No es un agujero repartido por toda la base, es un hecho técnico de un solo
punto de entrada — y por eso la tasa alta de esa fila no dice que la pauta convierta peor, dice que
la gente que ya conocía la oferta entra directo al calendario.

```sql
-- A8-08 · los puntos de entrada reales: cinco, no tres
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select atribucion_primera->>'medium' as medium, atribucion_primera->>'mediumId' as medium_id,
       count(*) as contactos, count(*) filter (where atribucion_primera ? 'adId') as con_anuncio
from v group by 1,2 order by 3 desc;
-- 2026-09-16: facebook/1565833687804655 114 (112 con adId) · calendar/pZqT3g9LSvGmLxcGSCMs 40 (0)
--             facebook/1564725741812379  25 ( 25)          · calendar/wh97tJkszqbhW9aTy6IL  4 (0)
--             External Form/Aria_IA_Consultative_Survey 1 (0)
```

```sql
-- A8-10 · las ventanas y su comparación, cada atajo contra la ventana inmediatamente anterior
select count(*) filter (where alta_en_el_crm >= now() - interval '1 day')   as hoy,
       count(*) filter (where alta_en_el_crm >= now() - interval '7 days')  as d7,
       count(*) filter (where alta_en_el_crm >= now() - interval '14 days'
                          and alta_en_el_crm <  now() - interval '7 days')  as d7_previo,
       count(*) filter (where alta_en_el_crm >= now() - interval '14 days') as d14,
       count(*) filter (where alta_en_el_crm >= now() - interval '28 days'
                          and alta_en_el_crm <  now() - interval '14 days') as d14_previo,
       count(*) filter (where alta_en_el_crm >= now() - interval '30 days') as d30,
       count(*) filter (where alta_en_el_crm >= now() - interval '60 days'
                          and alta_en_el_crm <  now() - interval '30 days') as d30_previo,
       max(alta_en_el_crm)::date as ultima_alta, max(sincronizado_el) as ultima_sync
from negocio.contactos;
-- 2026-09-16: 0 · 51 · 133 · 184 · 177 · 390 · 144 · 2026-09-13 · 2026-09-16 15:50 UTC
```

**El dato más incómodo de la medición, y es de hoy: no entra un lead nuevo desde el 2026-09-13**,
mientras el barrido corrió hace seis minutos (`negocio.ingesta_pulso` última corrida 15:41 UTC).
Con los datos de hoy, «Hoy» dibuja cero y «7 días» dibuja 51 contra 133 — **una caída del 62 %**. Y la pantalla no tiene con qué decir si eso es una campaña
pausada o el fin del presupuesto, que es exactamente el dato que falta en A8-23.

---

## 3 · Grupo B · Lo que GoHighLevel tiene y no le pedimos

Seis datos. **No los lee ninguna pantalla.** Tres de esos campos dejaron de escribirse a fines de
agosto, y eso hay que decirlo con la fecha: un campo que existe con 247 valores
y cero en la ventana no es «tenemos el dato», es «lo tuvimos».

| El dato · su rastro | Quién lo tiene | Estado hoy | Qué haría falta |
|---|---|---|---|
| **A8-14 · «Completaron form»** — la etapa `forms` del tercer embudo · `acquisition.js:15-17` | `campos_del_crm` → «Form Landing VSL», con los tres estados del embudo | **Existe y está cortado.** 247 contactos históricos, **0 en la ventana**; el último es del 2026-08-31 | Averiguar qué workflow lo escribía y por qué paró. El campo ya distingue «Form incompleto sin agendar» 87, «Form completo sin agendar» 39 y «Agendado» 121 |
| **A8-15 · La retención del VSL** — lo más cercano a «vio la landing» · sin rastro en el prototipo; §18.7 lo pide | `campos_del_crm` → «VSL % máximo visto» y «VSL segundos vistos» | **El instrumento existe y escribe cero.** 79 contactos cada uno, **valor `0` en los 79**, último 2026-08-30 | Arreglar el medidor de la landing. Es el paso 5 del §16.2 y no depende de GoHighLevel |
| **A8-16 · `Meta Lead ID`** — la llave para el §18.14 · sin rastro en el prototipo | `campos_del_crm` → «Meta Lead ID» | **Ya está.** 87 de 184 en la ventana, 116 históricos | Es el único puente para comparar los leads que Meta reporta contra los que llegaron. Sin el lado de Meta no sirve de nada (A8-30) |
| **A8-17 · Dispositivo y ciudad** — «Dispositivo» y «Ciudad» de la ficha · `leads-portal.js:265-272` | `atribucion_primera->>'userAgent'` y `->>'ip'` | **Incompleto y guardado en crudo.** 45 de 184 | Derivarlos, no mostrarlos: una IP en pantalla es un dato personal que nadie pidió publicar |
| **A8-18 · La landing de entrada** — «Punto de captura» de la ficha · `leads-portal.js:265-272` | `atribucion_primera->>'url'` y «Last Landing URL» | **Incompleto.** 45 y 88 de 184 | Mostrar sólo el host. Seis de los valores son JWT con `contact_id` adentro y otros traen el `fbclid` entero |
| **A8-19 · Oportunidades y pipelines** — candidato a «calificado» · sin rastro en el prototipo | GoHighLevel, `/opportunities` | **No se lo pedimos.** Ninguna de las 14 operaciones toca ese endpoint (`06-INTEGRACIONES-GHL.md:455`) | Comprobar si el token tiene ese alcance. Es la única fuente de «calificado» que no habría que inventar |

### Cómo se midió

```sql
-- A8-14, A8-15, A8-16 · qué hay, cuánto, y hasta cuándo
with k as (select nombre, campo_id from negocio.campos_del_crm
            where nombre in ('Form Landing VSL','VSL % máximo visto','VSL segundos vistos',
                             'Meta Lead ID','Puntaje | ICP'))
select k.nombre,
       count(*) filter (where c.campos_del_crm ? k.campo_id) as historico,
       count(*) filter (where c.campos_del_crm ? k.campo_id
                          and c.alta_en_el_crm >= now() - interval '14 days') as en_la_ventana,
       max(case when c.campos_del_crm ? k.campo_id then c.alta_en_el_crm end)::date as ultimo
from k cross join negocio.contactos c group by k.nombre order by 2 desc;
-- 2026-09-16:
--   Puntaje | ICP        465 · 180 · 2026-09-13
--   Form Landing VSL     247 ·   0 · 2026-08-31
--   Meta Lead ID         116 ·  87 · 2026-09-13
--   VSL segundos vistos   79 ·   0 · 2026-08-30
--   VSL % máximo visto    79 ·   0 · 2026-08-30
```

```sql
-- A8-14 · y qué dice, que es lo que lo convierte en la etapa `forms`
with k as (select campo_id from negocio.campos_del_crm where nombre = 'Form Landing VSL' limit 1)
select c.campos_del_crm ->> (select campo_id from k) as valor, count(*) as contactos,
       min(c.alta_en_el_crm)::date as desde, max(c.alta_en_el_crm)::date as hasta
from negocio.contactos c where c.campos_del_crm ? (select campo_id from k)
group by 1 order by 2 desc;
-- 2026-09-16: Agendado 121 (2025-12-20 → 2026-08-30)
--             Form incompleto sin agendar 87 (2026-08-11 → 2026-08-31)
--             Form completo sin agendar   39 (2026-08-03 → 2026-08-28)
```

El inventario `01-ACQUISITION.md` cuenta «Form Landing VSL» entre los siete campos con cero en la
ventana, y es cierto: cero en la ventana. Lo que no dice
es que **fuera de la ventana hay 247 valores, y que son exactamente la cadena `forms` → `agendados`
que el tercer embudo dibuja** — 87 que empezaron el formulario y no lo terminaron, 39 que lo
terminaron y no agendaron, 121 que agendaron. La etapa que el prototipo inventa con `r:{forms:.36}`
(`acquisition.js:32`) tuvo un medidor real durante agosto. No hay que construirlo: hay que averiguar
por qué se apagó.

Y `grep -rn "Form Landing VSL"` sobre `lib`, `app` y `components` devuelve **cero coincidencias**:
ninguna pantalla lo lee.

---

## 4 · Grupo C · Lo que sólo puede dar Meta

Doce datos. GoHighLevel no tiene el gasto ni la entrega —cero campos personalizados con esos
nombres entre los 170 (`06-INTEGRACIONES-GHL.md:446`)— y la landing tampoco.

| El dato · su rastro | Quién lo tiene | Estado hoy | Qué haría falta |
|---|---|---|---|
| **A8-20 · La inversión por campaña y por día** — el primer KPI, y el único origen de dinero del módulo · `acquisition.js:88`, `:146` | Meta, `/insights` con `time_increment=1` | **No existe.** Cero columnas de gasto en el esquema `negocio` | Una tabla diaria con `nivel`, `objeto_id`, `padre_id`, `fecha`, `gasto`, en `negocio.*`. El grano es campaña×día o la inversión de una ventana es una extrapolación y no una suma |
| **A8-21 · El costo unitario de cada etapa** — CPL, C/DM, C/contacto, C/form, C/clic, C/agendado, C/agenda · `acquisition.js:9`, `:13`, `:17`, `:190`, `:225` | Derivado de A8-20 | **No existe.** Los siete cuelgan del gasto | Nada más que A8-20. Y decir que es un costo acumulado: es la inversión ENTERA del embudo dividida por el volumen de la etapa, no el gasto del paso |
| **A8-22 · El costo por calificado** — el subtítulo del quinto KPI, la estadística del embudo y una columna de la tabla · `acquisition.js:120`, `:150`, `:201`, `:236` | Derivado de A8-20 y A8-33 | **Doble hueco.** Falta el numerador (gasto) y falta la definición del denominador | A8-20 y A8-33. Es la métrica sobre la que el plan de acción fija su único umbral |
| **A8-23 · El estado de entrega** — el «Activa» de «Activa · Meta» · `acquisition.js:229` | Meta, `delivery status` de la campaña | **No existe.** Las siete campañas del prototipo dicen «Activa» siempre | Es el detector «anuncios sin entrega» del §18.13. Sin él, la caída del 62 % que se mide hoy (A8-10) no se puede explicar en pantalla |
| **A8-24 · El objetivo de la campaña** — uno de los tres candidatos a definir el embudo · `acquisition.js:21-33` (`c.f`, asignado a mano) | Meta, `objective` | **No existe** | Ver A8-35: es una de las tres formas de decidir a qué embudo pertenece una campaña |
| **A8-25 · El presupuesto y las fechas de inicio y fin** — lo que el §18.4 pide para leer la inversión en contexto · sin rastro en el prototipo | Meta | **No existe** | Distinguir «gastó poco» de «tiene poco presupuesto», que es la diferencia entre una alerta y un hecho |
| **A8-26 · El identificador del ad set** — la clave del corte por conjunto · `acquisition.js:20-35` (no lo tiene) | Meta, `adset_id` | **Casi no existe.** `utmTerm` en **31 de 184**, y es **un solo ad set** | Hoy el corte por ad set sólo se puede hacer por nombre (174 de 184) y hay que decirlo en pantalla. La atribución de GHL **no trae `adSetId`**: los 20 claves del objeto están inventariadas y no está |
| **A8-27 · Impresiones, alcance, frecuencia, CTR, CPM, CPC** — el §18.7 «entrega y costo» entero · sin rastro en el prototipo | Meta | **No existe** | El mismo recolector de A8-20. Sin frecuencia contra CTR en el tiempo no hay detector de fatiga, que es una de las tres preguntas que el chat ejecutivo ya ofrece (`executive-chat.js:19`) |
| **A8-28 · Los clics de enlace** — la mitad de «Clics a landing VSL» · `acquisition.js:8`, `:12`, `:16` | Meta, `link_clicks` | **No existe** | Y aunque llegue, no es la etapa: un clic en el anuncio no es una vista de la VSL. Ver A8-32 |
| **A8-29 · El creativo, el formato y el placement** — «Creative», «Ubicación» y «Posición» de la ficha del contacto · `leads-portal.js:265-272` | Meta | **No existe.** Cero campos con `%creativ%` en el CRM | El §5.1 lo llama *Creative Profile*; sin él, Creative Intelligence no tiene qué mirar |
| **A8-30 · Los leads que Meta reporta** — el §18.14 y el §18.13 · sin rastro en el prototipo | Meta, `results` | **No existe, y el cero engaña.** Falta un lado de la comparación | Cruzar contra «Meta Lead ID» (A8-16). Reportar hoy «no hay diferencia» sería el peor de los ceros: se leería como que la atribución está sana |
| **A8-31 · La moneda de la cuenta publicitaria** — el `$` escrito a mano de `cf` · `acquisition.js:42` | Meta, `account_currency` | **No existe en ninguna parte.** No hay columna de moneda en `identidad.organizaciones` ni en ningún otro lado | Declarar la moneda y formatear con ella. Hoy `cf` antepone `$` y formatea en `es-MX`: la pantalla **afirma pesos mexicanos** sin que nadie lo haya decidido |

### Cómo se midió la ausencia

```sql
-- A8-20 a A8-31 · buscar cualquier columna de dinero o de entrega, en los tres esquemas
select table_schema||'.'||table_name as tabla, column_name
from information_schema.columns
where table_schema in ('negocio','public','identidad')
  and column_name ~* 'spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl|clic|alcance'
order by 1,2;
-- 2026-09-16: 10 filas, y NINGUNA en el esquema `negocio`.
--   public.aria_brain_clientes.ht_budget (texto, otra plataforma)
--   public.closer_meta_metricas: alcance, clics, cpc, cpl, cpm, ctr, gasto, impresiones
--   (public.aria_leads_usuarios.correo_electronico entra por la «ctr» de «electronico»)
```

```sql
-- el esquema para recibirlo ya está pensado, y está vacío
select 'closer_meta_metricas' as t, count(*) from public.closer_meta_metricas
union all select 'closer_meta_crudo', count(*) from public.closer_meta_crudo;
-- 2026-09-16: 0 · 0

select count(*) as filas, count(meta_ad_account_id) as con_cuenta, count(meta_token_cifrado) as con_token
from public.closer_org_config;
-- 2026-09-16: 3 · 0 · 0
```

**El cero es real y no un cero de RLS**: la lectura va por la Management API. Y las dos tablas son de
la **plataforma anterior**, que vive en `public.closer_*`; lo nuestro es el esquema `negocio.*`. Un
`grep -rn "closer_meta_metricas\|meta_ad_account_id\|meta_token_cifrado"` sobre los `.ts`, `.js`,
`.jsx`, `.mjs` y `.sql` del repositorio da **cero coincidencias**: ni una línea de este sistema las
toca.

De ahí sale la única conclusión firme de este grupo: **conectar Meta es trabajo de integración, no de
diseño de datos.** La forma de la tabla ya existe y hay que copiarla a `negocio.*`; lo que falta es
una app de Meta, un token de larga duración, la revisión de la app y un recolector diario. Y una
decisión que el §18.19 punto 2 deja abierta y no es trivial: **los insights de Meta se corrigen hacia
atrás durante días**, así que un recolector que sólo inserte «lo de ayer» guarda cifras que Meta
después cambia.

```sql
-- A8-26 · el inventario completo de claves de la atribución: `adSetId` no está
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days'),
k as (select jsonb_object_keys(atribucion_primera) as clave from v)
select clave, count(*) from k group by 1 order by 2 desc;
-- 2026-09-16, 20 claves: mediumId 184 · sessionSource 184 · medium 184 · utmSource 176 ·
--   utmMedium 174 · utmContent 172 · campaign 171 · campaignId 169 · adSource 139 · adId 137 ·
--   userAgent 45 · url 45 · ip 45 · fbp 39 · fbc 39 · referrer 37 · fbclid 34 · utmTerm 31 ·
--   utmKeyword 29 · gaClientId 27
```

```sql
-- A8-26 · y el id de ad set que sí llega es uno solo
with v as (select * from negocio.contactos where alta_en_el_crm >= now() - interval '14 days')
select count(distinct atribucion_primera->>'utmTerm')  as adsets_por_id,
       count(distinct atribucion_primera->>'utmMedium') as adsets_por_nombre
from v;
-- 2026-09-16: 1 · 4   (el id sólo lo trae la campaña BOFU)
```

```sql
-- A8-31 · no hay columna de moneda en ninguna parte
select nombre, zona_horaria, precio_mensual from identidad.organizaciones where activa;
-- 2026-09-16: ARIA · America/Lima · null   (y once organizaciones más, todas sin moneda)
```

---

## 5 · Grupo D · Lo que no tiene origen decidido

Nueve datos. **La diferencia con el grupo anterior es que acá no falta una integración: falta una
decisión.** Escribirlos como requisitos sería inventar la respuesta; van como preguntas abiertas con
lo que sí está medido.

| El dato · su rastro | Quién lo tendría | Estado hoy | Qué haría falta |
|---|---|---|---|
| **A8-32 · «Clics a landing VSL»** — la única etapa que aparece en los tres embudos · `acquisition.js:7`, `:11`, `:15` | Nadie hoy | **Es el dato que menos existe.** Ninguna tabla de tráfico, sesiones ni eventos en `negocio.*` — 21 tablas, revisadas una por una | Decidir qué es: los `link clicks` de Meta (lo que salió) o la analítica de la landing (lo que llegó). No son lo mismo y el prototipo los dibuja como una sola cosa. Lo más cercano que existe es A8-15, y escribe cero |
| **A8-33 · Qué es un «calificado»** — donde termina el departamento · `acquisition.js:94`, `AcquisitionView.jsx:94-100` | Una decisión de negocio | **No hay marca de calificación.** Hay un puntaje continuo en 180 de 184 y `negocio.resultados` con 7 filas y **ninguna venta** | Elegir entre un corte del puntaje ICP, una salida de la cita registrada por el closer, o un campo del CRM que nadie llena. No se puede validar contra resultado: `asistio` está en 0 de 158 |
| **A8-34 · Los tres tramos de ICP y dónde cortan** — la barra y la columna · `acquisition.js:96-98`, `:136-141` | Una decisión de negocio | **Los cortes no existen en Acquisition.** El cajón de contactos sí corta, en 75 y 50 (`leads-group.js:10`), y ese umbral no está escrito en ninguna parte de esta pantalla | Adoptar esos cortes o tirar los tramos. Con los 75/50 aplicados a la ventana: 37 alto, 59 medio, 84 bajo. La forma —tres tramos que suman los calificados— sí es requisito |
| **A8-35 · Qué es un embudo** — y de dónde sale la pertenencia de una campaña · `acquisition.js:21-33` (`c.f`, a mano) | Tres candidatos, ninguno elegido | **Los caminos reales son cinco puntos de entrada, no tres embudos.** Dos formularios nativos de Meta (114 + 25), dos calendarios (40 + 4) y un formulario externo (1) | Elegir entre el `mediumId` (existe hoy, 184 de 184), el objetivo de campaña de Meta (A8-24, no existe) o un mapeo a mano que alguien mantiene |
| **A8-36 · Dónde se guarda una señal detectada** — las dos alertas del JSX · `AcquisitionView.jsx:103-142` | Una tabla que no existe | **No hay dónde.** `negocio.hallazgos` tiene 20 filas, **las 20 con `contacto_id`**, y entre sus columnas están `analisis_id`, `agente`, `patron`, `criterio`, `fragmento_prompt`: es la tabla de Conversation | El par `entity_type`/`entity_id` del §18.13. Una alerta de Acquisition es sobre una campaña, un ad set o un anuncio, no sobre un contacto |
| **A8-37 · A qué abre «Ver evidencia»** — el único control enunciado y no cableado · `AcquisitionView.jsx:122-124`, `:138-140` | Una decisión de interfaz | **No abre a nada.** Un `grep` de `className="ev"` da esas dos líneas y ningún escuchador | Decidir si abre la tabla filtrada a la entidad, el cajón de contactos, o la ficha de alerta de A8-36 |
| **A8-38 · El umbral de «$110»** — el único número accionable del plan · `acquisition-plan.js:21` | Una decisión ejecutiva | **Sin origen.** Y en la misma plantilla, la señal dice 54 % de afinidad y el plan dice 43 % sobre la misma campaña | Declarar el umbral como parámetro con dueño. Y cambiar de grupo las dos recomendaciones de presupuesto (`:16` y `:21`): el §18.10 prohíbe emitirlas en solitario |
| **A8-39 · El estado del departamento y el «2 a revisar»** — lo que Executive publica en nombre de Acquisition · `executive.js:178`, `ExecutiveView.jsx:236-247` | Una regla que no está escrita | **Escrito a mano.** `st:'warn'` y «2 a revisar» no cuentan nada | Definir el umbral que separa `ok` de `warn` de `crit`, y que el conteo salga de A8-36 |
| **A8-40 · El resultado comercial por anuncio** — lo que el §18.14 llama «ventas con anuncio identificado» · `executive.js:116`, `:125` | `negocio.resultados`, que existe | **No da cero: no tiene denominador.** 7 filas — 4 `seguimiento`, 2 `no_show`, 1 `no_interesa` — y **ninguna venta** | Volumen de registro. Publicarlo como 0 % afirmaría que ninguna venta tiene anuncio cuando lo que pasa es que no hay ventas |

### Cómo se midió

```sql
-- A8-36 · la tabla de alertas que hay, y de quién es
select count(*) as filas, count(contacto_id) as con_contacto,
       count(*) filter (where agente is not null) as con_agente
from negocio.hallazgos;
-- 2026-09-16: 20 · 20 · (columnas: analisis_id, agente, patron, criterio, fragmento_prompt…)

select column_name from information_schema.columns
where table_schema='negocio' and table_name='hallazgos';
-- 2026-09-16: no existen `entity_type` ni `entity_id`
```

```sql
-- A8-40 · el denominador que no está
select salida, count(*) as n, count(monto) as con_monto from negocio.resultados group by 1;
-- 2026-09-16: seguimiento 4 · no_show 2 · no_interesa 1   (cero ventas, cero montos)
```

```sql
-- A8-33 · y tampoco hay con qué validar una definición contra el resultado de la cita
select count(*) as citas, count(asistio) as con_asistio from negocio.citas;
-- 2026-09-16: 321 · 0
```

**Y el §18.18 tampoco tiene dónde apoyarse.** `negocio.tareas` tiene `org_id`, `id`, `contacto_id`,
`vence_el`, `situacion`, `modo`, `nota`, `completada_el`, `completada_por`, `creada_por`, `creado_el`:
apunta a un contacto y no hay forma de apuntar a una campaña, un ad set o un anuncio.

---

## 6 · Lo que esta medición corrige del inventario

Once diferencias.

**1 · El medidor de la VSL existe y escribe cero.** «VSL % máximo visto» y «VSL segundos vistos»
tienen 79 contactos cada uno y **el valor `0` en los 79**. No es un campo vacío: es un instrumento
roto, que es otro problema y más barato.

**2 · Sí hay período anterior contra el cual comparar, para 7, 14 y 30 días.** El inventario dice que
no lo hay. Medido: **184 contra 177** los 14 días previos y **390 contra 144** los 30 previos. Lo que
no hay es historia más atrás de 45 días, ni «Hoy»: **el último `alta_en_el_crm` es del 2026-09-13**,
tres días atrás, con el barrido corriendo. Hoy la pantalla abriría «Hoy» en cero y «7 días» con una
caída del 62 %.

**3 · No existe la clave `adSetId` en la atribución.** El inventario habla de «el `mediumId` de
entrada» como si fuera la cuenta o el ad set; las 20 claves están inventariadas arriba y `adSetId` no
está. El id de ad set llega por `utmTerm`, en 31 de 184, y es **uno solo**.

**4 · La zona horaria está declarada y la pregunta abierta tiene respuesta.**
`identidad.organizaciones.zona_horaria` es `America/Lima` para la organización con datos. El
requisito se puede escribir en firme: las ventanas se cortan ahí, no en la del navegador.

**5 · La moneda no está en ninguna parte, y lo comprobé por esquema.** `identidad.organizaciones`
tiene `zona_horaria` y `precio_mensual`, y ninguna columna de moneda.

**6 · La cohorte de hoy es 184, no 233 ni 185.** La ventana rueda: el informe midió el 2026-09-13
(233), un inventario el 2026-09-16 temprano (185) y esta medición a las 15:46 UTC (184). La forma no
se mueve; los porcentajes sí, un punto o dos.

**7 · Son 6 anuncios en la ventana, no 7.** «el modelo está roto» (1 contacto) salió de los 14 días.

**8 · La fila «sin anuncio» es 47 contactos y agenda 38: 80,9 %.** El informe publicaba 57 / 47 /
82,5 % con la ventana del 13. Sigue siendo la tasa más alta de la tabla y por el mismo motivo: **31 de
esos 47 son la campaña BOFU** que entra por el calendario.

**9 · `asistio` está nulo en las 321 citas**, no sólo en las de la ventana. Ninguna definición de
«calificado» se puede validar contra el resultado de la cita.

**10 · La etiqueta `{{campaign.id}}` sin renderizar son 1 contacto hoy**, no 2. La basura es la misma
y el filtro `not like '{{%'` hace falta igual.

**11 · El cuarto KPI del inventario de pantalla dice que las «nueve llamadas» de `delta` pasan
`invert:false`.** Son **ocho** (`acquisition.js:146-150`, `:179`, `:188`, `:234`), y el punto se
sostiene entero: ninguna métrica de costo está invertida, así que **la Inversión se dibuja en verde
cuando sube**.

---

## 7 · Preguntas abiertas

Cada una es un hueco medido, y ninguna se puede cerrar leyendo más código.

1. **Por qué dejó de escribirse «Form Landing VSL» el 2026-08-31**, y si el workflow que lo llenaba
   sigue existiendo en GoHighLevel. De la respuesta depende que la etapa `forms` sea un requisito con
   fuente o uno sin ella.

2. **Por qué el medidor de la VSL escribe `0` en los 79 contactos que lo traen.** Es el paso 5 del
   §16.2 y no depende del proveedor.

3. **Por qué no entra un lead nuevo desde el 2026-09-13** con el barrido corriendo. Sin el estado de
   entrega de Meta (A8-23), la pantalla no puede distinguir una campaña pausada de una ingesta rota —
   y las dos se dibujan igual: en cero.

4. **Si el token de GoHighLevel tiene alcance sobre `/opportunities`.** Se contesta con una llamada.
   Si lo tiene, «calificado» (A8-33) tiene una fuente que no hay que inventar.

5. **Qué se hace con los 25 contactos sin `alta_en_el_crm`**: se excluyen y se dice, o se fechan con
   `creado_el` y se marca que la fecha es de ingesta y no de alta.

6. **Qué grano tiene la fila de la tabla**: campaña, ad set o anuncio. Hoy hay 3 campañas con id, **1 solo id
   de ad set** y 6 anuncios, y el piso de 10 deja publicables sólo los de más volumen. De eso depende si la
   tabla tiene 3, 1 o 7 filas antes del piso.

7. **Cada cuánto se recolecta Meta, y qué se hace con las correcciones hacia atrás.** Los insights se
   corrigen durante días; un recolector que sólo inserte «lo de ayer» guarda cifras que Meta cambia
   después. Por eso el §18.4 pide guardar por fecha.

8. **Qué moneda se muestra**, y qué pasa si la cuenta publicitaria reporta en otra que la que el
   negocio factura. Hoy `cf` afirma pesos mexicanos por omisión.

9. **Dónde se guarda una alerta de Acquisition y quién la cierra** (A8-36). Y con qué ciclo: el
   hallazgo que Conversion le manda ya trae `state` y `age` (`conversion.js:62-64`) y Acquisition no
   tiene dónde recibirlos.
