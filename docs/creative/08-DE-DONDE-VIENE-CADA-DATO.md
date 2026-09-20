# De dónde viene cada dato, y su cobertura medida

> Todas las cifras de este documento llevan la consulta que las produjo o el `archivo:línea` de donde
> salen. Las mediciones contra producción son del **2026-09-18** salvo donde se indica otra fecha; las
> de la API de GoHighLevel están detalladas en `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`.

---

## 1 · Cómo se midió

**Contra producción**, con el único camino que ve filas:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select …"
```

Es el único: `DATABASE_URL_MIGRADOR` y `DATABASE_URL_INQUILINO` devuelven **cero filas sin error**
porque `negocio.*` tiene RLS forzada por `app.org_id`. La Management API conecta como `postgres`, que
tiene `rolbypassrls`, así que los conteos son totales reales y no recortados por la política de fila.

**Contra la API**, con `GET` y el token que ya está en
`identidad.organizaciones_credenciales.crm_token_cifrado`, descifrado en el proceso con
`CLAVE_MAESTRA`. Ninguna escritura.

---

## 2 · Grupo A · Lo que ya está guardado y se puede leer hoy

| id | dato | dónde vive | cobertura medida |
|---|---|---|---|
| `C8-01` | El nombre de la pieza, lado Meta | `negocio.anuncios.nombre` | **79 anuncios, 32 nombres distintos**, 21 en más de un anuncio |
| `C8-02` | El nombre de la pieza, lado lead | `contactos.atribucion_primera->>'utmContent'` | **505 de 589 contactos (85,7 %)** |
| `C8-03` | El cruce entre los dos | por `lower(btrim(...))` | **21 de 31 nombres · 477 de 505 contactos (94,5 %)** |
| `C8-04` | El `adId` del contacto | `atribucion_primera->>'adId'` | **213 de 589 (36,2 %)**, y los 213 resuelven. 15 `adId` distintos |
| `C8-05` | El conjunto de anuncios | `atribucion_primera->>'utmTerm'` = `anuncios.meta_conjunto_id` | **273 de 589**. La `050:23-43` midió 9 de 9 cruzando |
| `C8-06` | La campaña, y con ella la etapa | `atribucion_primera->>'campaign'` | **93 %**, con el problema de variantes de `C1-09` |
| `C8-07` | Gasto, impresiones, clics, CTR, CPC por anuncio y día | `negocio.metricas_de_anuncio` | **2.528 filas, 2026-08-18 → 2026-09-18**, 79 anuncios, **263 filas con gasto > 0**, 12 campañas, $3.511,28 |
| `C8-08` | El puntaje de ICP | `contactos.campos_del_crm->>'9HXxl5DW6aayQgKUPiOS'` | **344 de 344 contactos de 30 días** — es el campo más poblado de la cohorte |
| `C8-09` | Las citas, para la tasa de agenda | `negocio.citas`, por `contacto_id` | medido por pieza: de 31 % a 77 % |
| `C8-10` | El `pixelId` de la campaña | llega en `promotedObject` y **no se guarda, y está bien que no** | es `1249900173340188` en **todos** los anuncios: una columna con un solo valor no distingue nada. Lo que sí discrimina es el resto de `promotedObject`, medido en `14-…:C14-15b` |

### Cómo se midió cada cobertura

**`C8-03`, el puente** — la consulta, entera:

```sql
with lado_lead as (
  select distinct lower(btrim(atribucion_primera->>'utmContent')) nom
  from negocio.contactos where coalesce(atribucion_primera->>'utmContent','') <> ''
), lado_meta as (
  select distinct lower(btrim(nombre)) nom from negocio.anuncios where coalesce(nombre,'') <> ''
)
select (select count(*) from lado_lead)  as nombres_en_leads,   -- 31
       (select count(*) from lado_meta)  as nombres_en_meta,    -- 32
       (select count(*) from lado_lead l join lado_meta m on m.nom = l.nom) as cruzan;  -- 21
```

**`C8-01`, las piezas contra los anuncios**:

```sql
select count(distinct nombre) creativos,          -- 32
       count(*) anuncios,                         -- 79
       count(*) filter (where ids > 1) en_varios  -- 21
from (select nombre, count(distinct meta_anuncio_id) ids from negocio.anuncios group by 1) t;
```

**`C8-08`, el ICP** — y hay una trampa que costó una medición equivocada: `campos_del_crm` está
indexado por **id de GoHighLevel**, así que buscar por el nombre del campo devuelve cero y **no
falla**. El id vigente se resuelve con `campoPorNombre('Puntaje | ICP')`
(`lib/negocio/camposDelCrm.ts:307`), contra `negocio.campos_del_crm`. Ver `C2-17` y el riesgo de los
diez campos con nombre parecido.

---

## 3 · Grupo B · Lo que llega de GoHighLevel y se está tirando

| id | dato | cobertura | qué habilita |
|---|---|---|---|
| `C8-11` | `results.videoView` | **90 %** de las filas anuncio-día con entrega | Hook rate (`C2-10`) |
| `C8-12` | `results.linkClick` | **74 %** | Link CTR (`C2-11`) |
| `C8-13` | `results.landingPageView` | **65 %** | Landing page view rate y click-to-landing (`C2-12`, `C2-13`) |
| `C8-14` | `results.postEngagement` | **90 %** | Tasa de interacción (`C2-14`) |
| `C8-15` | `results.lead` | **48 %** | Posiblemente el KPI del § 18.14 punto 4 — ver `C14-P02` |
| `C8-16` | Señales sociales (`postReaction`, `postSave`, `comment`, `like`) | 6 % a 61 % | Se guardan, no se publican (`C2-15`) |

### Cómo se midió la ausencia de uso

`lib/ghl/anuncios.ts:405` hace `resultadosDeMeta: numero(o.results)`. `results` es un **objeto** y
`numero()` (`:141`) devuelve `null` para todo lo que no sea número o cadena, así que el campo es
**`null` siempre** — hasta el 2026-09-18, cuando el campo pasó a llamarse `acciones` y a leerse con
un desenvolvedor que cuenta lo ilegible en vez de escribir cero.

Y `negocio.metricas_de_anuncio` no tenía columna donde guardarlo. **Hoy sí**, y esta lista estaba
sin actualizar a doce líneas de la sección que describe cómo se creó (`C8-18`, acá abajo):

> `org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia,
> **`acciones`**, sincronizado_el`

La columna `acciones` la creó la migración `053`, y es de la que salen el hook rate y las tres tasas
de enlace — o sea la mitad de las cifras que este departamento publica.

### C8-17 · Y no cuesta ninguna llamada nueva

El colector ya pide `/reporting/list?listType=ads` una vez por campaña y por día, en la tarea
`anuncios` del cron de las `17 6 * * *` (`lib/negocio/barrido.ts:222`). **El desglose viene en esa
misma respuesta.**

### C8-18 · El desglose se guarda en una columna `jsonb`, no en columnas ni en una tabla hija

**Qué es** · `alter table negocio.metricas_de_anuncio add column acciones jsonb`.
**Por qué no columnas** · Son ~45 tipos observados, con cobertura del 90 % al 3 %, y el catálogo es de
Meta. Cada tipo nuevo sería una migración y, mientras no la haya, **se descarta en silencio** — que es
el defecto que esto viene a arreglar. La `050:112-114` ya decidió lo mismo para `objetivo`: *«Un
catálogo ajeno no puede ser lo que frena la ingesta.»* Y la `048:80-84` lo decidió para
`atribucion_primera` con el argumento literal: *«serían ocho columnas casi siempre nulas, y cada campo
nuevo que GoHighLevel agregue sería otra migración»*.
**Por qué no una tabla hija** · Dos razones, y la primera es decisiva:

1. **Multiplica el grano.** Las impresiones son **una** fila por (anuncio, día); las acciones serían
   **15-25**. Unirlas para dividir multiplica el denominador y el hook rate sale ~20 veces más chico y
   perfectamente creíble. `lib/negocio/costoDelAnuncio.ts:157-164` documenta ese defecto **para este
   mismo par de tablas**: *«no falla: devuelve un número más grande»*.
2. **Costo de escritura.** El colector ya consume ~164 s del presupuesto de 120 s en su tramo fijo de
   tres días (12 campañas × 4,55 s medidos). Veinte inserciones más por anuncio-día encenderían
   `atrasado` en todas las pasadas, y *«un aviso que aparece siempre es uno que nadie lee»*.

**Los dos ceros se conservan con la presencia de la clave**, no con la existencia de una fila:
`acciones ? 'videoView'`. Ese operador ya está en producción en cinco lugares
(`costoDelAnuncio.ts:307,327`; `calidadDeLaAtribucion.ts:96,114,126`).

**Tres estados, y hay que declararlos en el `comment on column`**: `null` = no se leyó; `{}` = el
proveedor mandó el desglose vacío; clave ausente = ese tipo no ocurrió, **que no es cero**.

**Sin `not null default '{}'`**, al revés que la `048`: las ~2.500 filas ya guardadas no se vuelven a
leer nunca —`diasQuePedir` sólo repide los días **sin ninguna fila**— así que un `'{}'` las haría
afirmar «Meta mandó un desglose vacío», que es una mentira sobre 2.500 filas.

**La normalización a números va en el escritor.** Un `(acciones->>'videoView')::numeric` sobre un valor
de texto lanza `22P02` y **se lleva puesta la consulta entera, no una fila**. El lector parsea con
`numero()`, descarta lo ilegible y **lo cuenta** — mismo idioma que `ilegibles`.

---

## 4 · Grupo C · Lo que sólo puede dar Meta directo

| id | dato | cómo se midió la ausencia |
|---|---|---|
| `C8-19` | Cuartiles 25/50/75/100 | `fields` es enum cerrado de 11 valores; `video_p25_watched_actions` y 30 candidatos más dan **422** (`C14-05`) |
| `C8-20` | Tiempo medio visto, retención de 6 s, thruplay | ídem |
| `C8-21` | Placement, edad, género, dispositivo, plataforma, país | `groupBy` sólo acepta `day\|week\|month`; todo lo demás **422** (`C14-06`) |
| `C8-22` | El activo creativo: imagen, video, copy, título, miniatura, `meta_creative_id` | `/entity?entityType=AD` devuelve **cuatro campos**; `/creatives`, `/videos`, `/posts` dan **404**; `listType=creatives` da **422** (`C14-07`, `C14-08`) |
| `C8-23` | Formato y duración | no vienen en ninguna respuesta. Sólo están **codificados en el nombre** |
| `C8-24` | El estado de entrega del anuncio | `/entity` no lo da a nivel de anuncio. Por eso `negocio.anuncios` **no tiene la columna**, a propósito (`050:60-63`) |

**Y el diseño ya está preparado para recibirlos.** La `050:52-58` lo escribió: *«estas tablas se
diseñaron para que una segunda fuente pueda rellenar **sólo** el video sin rehacer nada: son columnas
que se agregan»*. Cuando lleguen, van como **columnas tipadas** y no dentro del `jsonb`: dos
procedencias, dos formas.

---

## 5 · Grupo D · Lo que no tiene origen decidido

| id | dato | por qué no tiene origen |
|---|---|---|
| `C8-25` | La definición de «calificado» | No existe en el sistema. El corte en tramos de ICP es una pregunta abierta con cuatro pantallas candidatas |
| `C8-26` | Los umbrales de fatiga y anomalía | **El § 18.19 lo declara pendiente**: «Definir umbrales iniciales de anomalía y fatiga» |
| `C8-27` | El piso de impresiones de las tasas de Meta | No hay valor justificado (`C2-P01`) |
| `C8-28` | El ángulo y el formato derivados del nombre | Sería una decisión de producto, no una lectura (`C4-09`) |
| `C8-29` | Las «solicitudes de nuevas variantes» del § 18.15 | Es una entidad persistida y no hay tabla ni flujo (`C6-P01`) |

---

## 6 · Lo que esta medición corrige de lo ya publicado

### C8-30 · `lib/ghl/anuncios.ts:41-46` afirma lo contrario de lo medido

Declara imposibles ocho cosas; **cuatro llegan hoy** (`C8-11` a `C8-14`). Es documentación de código
vivo, no registro histórico, así que **se reescribe**.

### C8-31 · `db/migraciones/050:52-58` saca una conclusión que ya no vale

Concluye que *«caen el analizador de creativos del § 18.12 y la vista entera del responsable creativo
del § 18.15»*. Caen **en parte**: de los nueve indicadores del § 18.12, cuatro se pueden construir.
**La migración no se edita** —una migración aplicada es registro histórico— y la corrección vive en el
encabezado de la que agregue la columna.

### C8-32 · El campo de ICP se llamaba distinto en la medición anterior

`docs/estado actual/02-CREATIVE.md` lo midió como «Puntaje | ICP» el 2026-09-15 y sigue siendo ése
(`9HXxl5DW6aayQgKUPiOS`). Pero el catálogo del CRM tiene **diez** campos con nombre parecido, y uno de
ellos es `Pre-Score | ICP`. Al resolver por nombre hay que fijar el literal exacto y **decirlo cuando
no se encuentra**, en vez de publicar ceros.

### C8-33 · La hipótesis de que el puente falla por la ventana del colector es falsa

Se planteó que los 28 contactos que no cruzan fueran anteriores al 2026-08-18, en cuyo caso el 94,5 %
sería una propiedad de la ventana y no del dato. **Medido: 18 de los 28 son posteriores.** No son
piezas viejas perdidas: es tráfico que no viene de un anuncio. Ver `C1-15`.

---

## 7 · Preguntas abiertas

### C8-P01 · Si la cobertura de `videoView` está repartida al azar entre piezas

El 90 % es global. Una pieza estática **nunca** tendrá `videoView`, y eso no es una laguna de
cobertura: es un hecho sobre la pieza. Si la ausencia se concentra en las piezas que no son video, el
hook rate de ésas tiene que salir **nulo y no bajo**, y la cobertura hay que publicarla **por pieza**.
Se contesta agrupando la cobertura por creativo, con los datos que ya se van a recolectar.

### C8-P02 · Por qué los cinco días más recientes no tienen contactos atribuidos

Medido: el último contacto que cruza es del **2026-09-13**, y los que no cruzan llegan al **09-18**.
Con cinco días no se puede distinguir estacionalidad de algo que se cortó. Queda anotado.

### C8-P03 · Si `results.lead` es la población de Meta o la nuestra

Decide si el KPI «diferencia entre leads de Meta y leads en la base» del § 18.7 revive. La `050`
lo declaró muerto midiendo el campo `leads` de primer nivel; `results.lead` es otro campo y en la fila
medida valen `0` y `1` respectivamente. Se contesta comparando las dos columnas **después** de
guardarlas. Ver `C14-P02`.
