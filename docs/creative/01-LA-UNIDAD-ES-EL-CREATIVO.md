# La unidad es el creativo, no el anuncio

> Requisitos derivados del prototipo (`lib/aios/creative.js`) y de las diez reglas propias de
> `docs/estado actual/02-CREATIVE.md` § 6, con las mediciones nuevas del 2026-09-18 contra producción.
> Las de cobertura del lado del contacto son del 2026-09-15 salvo donde se remidió.
>
> Éste es el documento que decide si los demás sirven. Si la clave de agrupación está mal, todas las
> cifras de `02-METRICAS.md` están mal y ninguna falla.

---

## 1 · La unidad, y lo que costaba equivocarse

### C1-01 · La unidad de análisis es la PIEZA, no el anuncio

**Qué es** · Creative ordena piezas de contenido. Acquisition ordena anuncios. Son dos preguntas
distintas y las contesta la misma tabla con dos agrupaciones distintas.
**Fórmula** · La fila de Creative agrupa todos los `meta_anuncio_id` que comparten pieza.
**Unidad** · Conteo de piezas.
**Población** · Los anuncios de `negocio.anuncios` de la organización.
**Rastro** · `lib/aios/creative.js:6-23` — el prototipo ya lo asume: sus ocho filas son piezas
(`Owner Hook`, `Founder Story`, `Social Proof`…) y no anuncios. `docs/estado actual/02-CREATIVE.md`
regla 1 y 2.
**Estado** · **Medido y confirmado el 2026-09-18.** `negocio.anuncios` tiene **79 anuncios que son 32
piezas distintas** por nombre. **21 de las 32 corren en más de un `meta_anuncio_id`**, hasta **6**.

> Lo que esto cuesta si se ignora: la cabecera de Acquisition dice «en 12 anuncios de 79» para una
> ventana de 30 días. Agrupando por pieza, los que gastaron son **28 de 32**. Es el mismo dinero y
> una fotografía distinta — no porque una esté mal, sino porque la pregunta es otra. Acquisition
> pregunta «qué anuncio costó qué»; Creative pregunta «qué pieza hay que volver a producir».

### C1-02 · La misma pieza vive en varios anuncios, y ése es el hecho que justifica el departamento

**Qué es** · Un creativo se lanza en varios ad sets, y cada combinación es un `adId` distinto con sus
propias métricas diarias.
**Población** · Las 21 piezas con más de un anuncio.
**Rastro** · `docs/estado actual/02-CREATIVE.md:211`; medición propia del 2026-09-18.
**Estado** · Medido. Ejemplos reales: `Estancada` en 5 anuncios, `manifiesto horz` en 5,
`Evoluciona native` en 5, `agendamiento - yaping - 23/07` en 6.

### C1-03 · «Sin creativo» es un grupo, no un descarte

**Qué es** · Los contactos que llegaron sin nombre de pieza forman una fila propia de la tabla, con su
conteo, y no se filtran.
**Fórmula** · `utmContent` nulo o vacío ⟹ fila «sin creativo».
**Población** · La cohorte entera: la suma de todas las filas tiene que dar el total de contactos.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 8.
**Estado** · Medido. De 589 contactos, **84 no traen `utmContent`** y, de los que sí, hay un grupo que
no corresponde a ningún anuncio de Meta (`C1-06`). Descartarlos haría que la tabla no sumara la
cohorte y que nadie lo notara.

---

## 2 · Los dos puentes entre el lado de Meta y el lado del lead

Creative necesita cruzar dos hechos que viven en tablas distintas y con identificadores distintos: lo
que Meta dice que pasó con la pieza (`negocio.anuncios` + `negocio.metricas_de_anuncio`) y lo que pasó
con la gente que llegó por ella (`negocio.contactos`).

### C1-04 · El puente por NOMBRE, que es el que se usa

**Qué es** · `lower(trim(contactos.atribucion_primera->>'utmContent'))` contra
`lower(trim(anuncios.nombre))`.
**Unidad** · Proporción de contactos que cruzan.
**Población** · Los 505 contactos que traen `utmContent`.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 1.
**Estado** · **Medido el 2026-09-18: 21 de 31 nombres cruzan, y son 477 de 505 contactos (94,5 %).**

### C1-05 · El puente por `adId`, que es exacto y ve un tercio

**Qué es** · `contactos.atribucion_primera->>'adId'` contra `anuncios.meta_anuncio_id`.
**Estado** · **Medido: 213 de 589 contactos traen `adId` (36,2 %), y los 213 resuelven contra un
anuncio real.** Son 15 `adId` distintos.

> **Por qué la clave es el nombre y no el `adId`, aunque el `adId` sea exacto.** El 36,2 % no es una
> muestra al azar: el `adId` llega **si y sólo si** el lead entró por el anuncio, y falta entero en
> las otras dos puertas de entrada — está medido en `lib/negocio/costoDelAnuncio.ts:14-21`
> (`facebook`/`instagram` 213 de 213; `External Form` 0 de 98; `calendar` 0 de 47). Agrupar por
> `adId` no da «una cobertura del 36 %»: da **una población distinta**, y deja 15 anuncios visibles
> de 79, o sea menos de la mitad de las piezas.

### C1-06 · Los nombres que no cruzan no son un defecto: son otra procedencia

**Qué es** · Los 10 nombres que no encuentran anuncio, con su motivo. Suman **28 contactos**.
**Rastro** · Medición del 2026-09-18.
**Estado** ·

| nombre | contactos | qué es |
|---|---:|---|
| `link_in_bio` | 15 | tráfico orgánico del enlace del perfil. No es pauta |
| `{{ad.name}}` | 3 | **la plantilla sin expandir**. Es un defecto del CRM, no un creativo |
| `video2` · `video4` · `video-3` | 5 | nomenclatura vieja, anterior a la convención actual |
| `cta_1709_ia` · `test2anuncio` | 2 | pruebas |
| `agendamientos - ad 2` · `- ad 4` · `- ad 6` | 3 | nomenclatura vieja |

Ninguno es un anuncio de Meta vigente, así que **el 94,5 % no es «lo que se pudo rescatar»: es
prácticamente todo lo que había para rescatar.**

### C1-15 · Los que no cruzan NO son un artefacto de la ventana del colector

**Qué es** · Una hipótesis alternativa que había que descartar antes de fijar la clave: que esos 28
contactos fueran anteriores al **2026-08-18**, que es cuando arrancó el colector. `negocio.anuncios`
se llena sólo con anuncios que aparecieron en la ventana recolectada, así que una pieza apagada antes
de esa fecha no tendría fila aunque hubiera sido un anuncio real. De ser así, el 94,5 % no sería una
propiedad del dato sino **de la ventana del colector**.

**Estado** · **Medido el 2026-09-18, y la hipótesis es falsa.** Los que no cruzan van del 2025-12-20
al 2026-09-18, y **18 de los 28 son posteriores al arranque del colector**. No son piezas viejas que
se perdieron: son tráfico que no viene de un anuncio de Meta, como dice `C1-06`.

> Y un detalle que sale de la misma medición y hay que vigilar: el último contacto que **sí** cruza es
> del 2026-09-13, mientras que los que no cruzan llegan hasta el 2026-09-18. Los cinco días más
> recientes no tienen ni un contacto atribuido a una pieza. Puede ser estacionalidad o puede ser que
> algo se haya cortado; con una ventana de cinco días no se puede decir cuál, y por eso queda anotado
> en vez de interpretado.

### C1-16 · No hace falta un respaldo por `adId` para el lado del contacto

**Qué es** · La pregunta de si algún contacto trae `adId` y **no** trae `utmContent`, en cuyo caso
convendría resolver el nombre desde `negocio.anuncios` para no perderlo.
**Estado** · **Medido: cero contactos.** Las dos claves llegan por la misma puerta de entrada, así
que el respaldo no se escribe. Queda dicho para que no se vuelva a evaluar.

### C1-07 · La cobertura del puente se dibuja ARRIBA de todo ranking

**Qué es** · Cuántos nombres y cuántos contactos cruzan, con la lista de los que no y su motivo.
**Fórmula** · Dos pares: nombres que cruzan / nombres totales, y contactos que cruzan / contactos con
nombre.
**Rastro** · El § 18.5 exige publicar la cobertura al lado de la cifra; el patrón es el de
`lib/negocio/calidadDeLaAtribucion.ts` y su `fueraDeAlcance`, que **se dibuja** en vez de omitirse.
**Estado** · Construible hoy. **Y viaja siempre, no es opcional**: una tabla de piezas con gasto y
gente mezclados, sin decir qué proporción de la gente pudo asociarse, se lee como si fuera completa.

---

## 3 · La normalización, que no es cosmética

### C1-08 · El nombre de la pieza se normaliza a minúsculas y sin espacios de borde

**Fórmula** · `lower(btrim(x))`, en **los dos lados del puente y en un solo lugar del código**.
**Rastro** · Medición: `Evoluciona native` (en `negocio.anuncios`) y `evoluciona native` (en
`utmContent`) son la misma pieza y sin normalizar salen como dos.
**Estado** · Construible. **El predicado tiene que vivir en una sola función** — repetirlo en cada
consulta es cómo dos cifras de la misma pantalla terminan con dos definiciones de «la misma pieza»,
que es la regla 12 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md`.

### C1-09 · El nombre de campaña se normaliza a MAYÚSCULAS antes de agrupar

**Qué es** · La etapa del embudo se lee del nombre de campaña, y ese nombre llega con variantes.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 4.
**Estado** · **El defecto sigue vivo, remedido el 2026-09-18.** En la ventana de 30 días:

```
171 contactos   NUEVA ERA | TOFU |  LEADS | LATAM+USA | 01-09-26
 43 contactos   NUEVA ERA | BOFU | AGENDAS | LATAM+USA | 28-08-26
  2 contactos   NUEVA ERA | BOFU | AGENDAS | LATAM USA | 28-08-26      ← la misma campaña
 21 contactos   NUEVA ERA | TOFU |  LEADS | LATAM+USA | 31-08-26
  2 contactos   NUEVA ERA | TOFU |  LEADS | LATAM+USA | 31-08-26 V3
```

`LATAM+USA` contra `LATAM USA` parte la campaña BOFU en **43 + 2**. Normalizar mayúsculas no alcanza
para este caso —el signo `+` no es una mayúscula—, así que la regla se cumple leyendo **el segmento de
etapa** y no el nombre entero: ver `C1-10`.

---

## 4 · El corte por etapa, que es una prohibición

### C1-10 · La etapa se lee del segmento del nombre de campaña, y se dice que se lee de ahí

**Qué es** · `TOFU`, `MOFU`, `BOFU` o «sin etapa».
**Fórmula** · Los nombres de campaña vienen en segmentos separados por `|`. La etapa es el segmento
que, en mayúsculas, coincide con uno de los tres literales. Lo que no coincide **no se fuerza a
ninguna rama**: cae en «sin etapa» y se cuenta aparte.
**Población** · Los contactos con `campaign` no vacío — 93 % de la cohorte.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 3.
**Estado** · **Construible hoy, medido.** En la ventana de 30 días: TOFU 197 contactos en 3 variantes
de campaña, BOFU 45 en 2, MOFU 1. Y fuera del vocabulario: `{{CAMPAIGN.NAME}}` (2, la plantilla sin
expandir), `IG-DM` (2), `JORGEVERAMENDI` (1).

**La pantalla tiene que decir de dónde sale la etapa.** Es una lectura de una convención de nombres
que nadie garantiza; el día que alguien nombre una campaña sin el segmento, esa campaña cae en «sin
etapa» y el usuario tiene que poder entender por qué.

### C1-11 · TOFU y BOFU no se comparan. Nunca, en ninguna cifra de conversión

**Qué es** · Una prohibición, no una métrica. Las piezas de etapas distintas no entran en la misma
lista ordenada ni en el mismo promedio.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 3.
**Estado** · **Y está medido lo que cuesta romperla.** En la ventana de 30 días:

| pieza | etapa | contactos | tasa de agenda |
|---|---|---:|---:|
| `evoluciona native` | **BOFU** | 39 | **77 %** |
| `agendamiento - yaping - 23/07` | TOFU | 65 | 57 % |
| `agendamiento - yaping` | TOFU | 112 | 43 % |
| `el app` | TOFU | 59 | 39 % |
| `economia us latino` | TOFU | 26 | 31 % |

El prototipo parte la biblioteca por el **promedio** del criterio elegido
(`lib/aios/creative.js:188-197`). Con estos números, el 77 % del BOFU levanta el promedio y manda a
«No funciona · pausar o iterar» a las piezas TOFU que traen **el 85 % del volumen**. La pantalla
recomendaría pausar lo que alimenta el embudo. Ver `03-LA-BIBLIOTECA.md`.

### C1-12 · Dos caminos de adquisición conviven bajo la misma pieza

**Qué es** · Algunos contactos entraron por un formulario de Meta (Lead Ads) y otros por la landing.
Los de Lead Ads **nunca vieron la landing ni el VSL**.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 5; medido allí: «Meta Lead ID» en 89 de 233
(38,2 %), «Last Landing URL» en 99 de 233 (42,5 %); `agendamiento - yaping` tenía 43 de formulario y
21 con landing sobre 109.
**Estado** · Construible. **Existe para que nadie divida una métrica de landing por el total de la
pieza**: el denominador de cualquier cifra de landing son los contactos que pasaron por ella, no
todos.

---

## 5 · El riesgo que la clave elegida introduce, y cómo se detecta

### C1-13 · Un renombre en Meta parte el histórico, y nada falla

**Qué es** · `negocio.anuncios.nombre` es **estado actual** de Meta; `utmContent` es una **foto** del
momento de captura del lead. No se mueven juntos.
**Rastro** · `lib/negocio/recolectarAnuncios.ts:344-346`, literal: *«El nombre NO se protege con
`coalesce`: es `not null` en la tabla, así que nunca puede llegar nulo, y si el anuncio se renombra en
Meta queremos el nombre nuevo.»*
**Estado** · La decisión es correcta para **nombrar un anuncio** y se vuelve un corte de histórico al
grano de la pieza. La secuencia:

1. Alguien renombra la pieza en Meta.
2. La pasada siguiente reescribe `anuncios.nombre` para todos sus `adId`. Como
   `metricas_de_anuncio` no guarda nombre, **todo el gasto histórico se muda al nombre nuevo**.
3. Los contactos ya guardados conservan el nombre viejo, para siempre.
4. La pantalla dibuja **dos filas con pinta de completas**: una con toda la gente y sin gasto, otra
   con todo el gasto y sin gente.

La evidencia de que `utmContent` no se re-resuelve son los **3 contactos con `{{ad.name}}` sin
expandir**: si GoHighLevel volviera a resolver esa plantilla contra Meta, se habrían arreglado solos.

### C1-14 · La detección es barata y se publica

**Qué es** · Una pieza con gasto y **cero contactos**, o una que desaparece de la tabla entre dos días.
**Estado** · Construible hoy. **Hay que distinguirla de la explicación equivocada que ya está
escrita**: `costoDelAnuncio.ts` publica el aviso *«N anuncios gastaron sin que ningún contacto los
mencione. Puede ser que no trajeran a nadie, o que la atribución se haya perdido»*. Con un renombre,
las dos explicaciones son falsas y la tercera no está en la lista.

### C1-P02 · Si conviene guardar el nombre anterior

La alternativa es que `negocio.anuncios` recuerde el nombre previo (`nombre_anterior`,
`renombrado_el`) y que el puente canonice el viejo al vigente. Cuesta dos columnas nulas y un `case`
en el `on conflict` que ya existe, y cierra el modo de fallo en vez de sólo detectarlo.

**No está decidido, y hay un dato que falta para decidirlo:** si esta cuenta renombró alguna vez un
anuncio. No hay historia con qué contestarlo, así que la protección sería precautoria. Queda abierta.

### C1-P03 · Dos piezas distintas con el mismo nombre se funden y nada lo dice

Es el reverso exacto de `C1-02`: como 21 de 32 nombres corren en varios anuncios **a propósito**, no
hay forma en estos datos de distinguir «una pieza en seis anuncios» de «dos piezas que alguien llamó
igual». La única mitigación honesta es publicar el conteo de anuncios como columna de la fila: una
pieza que salta de 2 a 7 anuncios de una semana a la otra se ve.

*(`C1-P01` y `C1-P04` se cerraron midiendo, y están arriba como `C1-15` y `C1-16`.)*
