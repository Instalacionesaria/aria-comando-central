# Creative — lo que GoHighLevel sí da, y lo que no

> **Medición propia contra la subcuenta real, el 2026-09-18.** Sólo lecturas (`GET`), con el Private
> Integration Token que ya está en `identidad.organizaciones_credenciales.crm_token_cifrado`, base
> `services.leadconnectorhq.com`, cabecera `Version: 2021-07-28`.
>
> Este documento es a la vez **fuente** y **corrección**. Desmiente dos afirmaciones publicadas:
> `lib/ghl/anuncios.ts:41-46` y `db/migraciones/050_lo_que_costo_cada_anuncio.sql:52-58`.
>
> Cada «no» de acá trae el código de error del intento, para que nadie vuelva a sondear una ruta que
> ya devolvió 404.

---

## 1 · Lo que estaba escrito, y por qué era falso

`lib/ghl/anuncios.ts:41-46`, literal:

> «Ninguna métrica de video: reproducciones, cuartiles 25/50/75/100, tiempo medio visto, retención de
> tres y de seis segundos. Tampoco `link clicks`, `link CTR` ni `landing page views`, ni el activo
> creativo. Son las seis del § 18.7 «video y creativo» más dos de «interacción», y el día que hagan
> falta la única fuente es Meta directo.»

La `050:52-58` lo repite y saca la conclusión: *«con ellas caen el analizador de creativos del § 18.12
y la vista entera del responsable creativo del § 18.15»*.

**De las ocho cosas que esa lista declara imposibles, cuatro llegan hoy.** Reproducciones de video,
`link clicks`, `link CTR` y `landing page views` vienen por anuncio y por día, dentro de un campo que
el cliente parsea a `null` y tira.

La afirmación no era descuidada: era una generalización correcta sobre las columnas de primer nivel
de la respuesta, extendida sin comprobar a un campo anidado. Los cuatro «no» restantes —cuartiles,
tiempo medio visto, retención de seis segundos y activo creativo— **siguen siendo ciertos**, y ahora
están medidos uno por uno en la § 4.

---

## C14-01 · `results`: el desglose de acciones de Meta, por anuncio y por día

`GET /ad-publishing/facebook/reporting/list?locationId=…&listType=ads&type=INTEGRATION&campaignId=…&startDate=D&endDate=D`
devuelve un arreglo pelado con una fila por anuncio. Las filas de los anuncios **que entregaron** traen
un campo `results` con el desglose de acciones.

Fila real, del anuncio `120249590300960467` el 2026-09-10 (recortada en `results`):

```json
{"name":"…","adId":"120249590300960467","adAccountId":"act_1349863156073553",
 "objective":"OUTCOME_LEADS","clicks":"28","cpc":"0.622143","ctr":"1.854305",
 "impressions":"1510","spend":"17.42","reach":"1335","frequency":"1.131086",
 "dateStart":"2026-09-10","dateStop":"2026-09-10",
 "promotedObject":{"pixelId":"1249900173340188","customEventType":"SCHEDULE","smartPseEnabled":false},
 "adsetName":"Engagers + IG, FB, Web - 365d","adsetId":"120249590300950467",
 "campaignId":"120249590301010467","revenue":"0.00","sales":"0","leads":"0","averageRevenue":"0.00",
 "results":{"linkClick":"18","landingPageView":"16","omniLandingPageView":"16","videoView":"328",
            "postEngagement":"354","pageEngagement":"354","postReaction":"4",
            "postInteractionGross":"8","postInteractionNet":"8","post":"2",
            "onsiteConversion.postSave":"2","onsiteConversion.postNetSave":"2",
            "onsiteConversion.postNetLike":"4","lead":"1","onsiteWebLead":"1",
            "offsiteConversion.fbPixelLead":"1","initiateCheckout":"2",
            "offsiteConversion.fbPixelInitiateCheckout":"2","onsiteWebInitiateCheckout":"2",
            "omniInitiatedCheckout":"2","offsiteInitiateCheckoutAdd_20SCalls":"2",
            "offsiteConversion.fbPixelCustom":"6","customEventActionsAdd_20SCalls":"5",
            "onsiteConversion.messagingConversationStarted_7d":"1","offsiteLeadAdd_20SCalls":"1"}}
```

**Cómo se midió la cobertura.** 96 llamadas — los 8 días del 2026-09-10 al 2026-09-17 por las 12
campañas que aparecen en `negocio.anuncios` — de las que salieron **31 filas anuncio-día con
métricas**. El porcentaje es sobre esas 31.

| tipo de acción | filas | cobertura |
|---|---:|---:|
| `postEngagement` · `pageEngagement` | 28 | **90 %** |
| **`videoView`** | 28 | **90 %** |
| `linkClick` | 23 | **74 %** |
| `postInteractionGross` · `postInteractionNet` | 21 | 68 % |
| **`landingPageView`** · `omniLandingPageView` | 20 | **65 %** |
| `postReaction` · `onsiteConversion.postNetLike` | 19 | 61 % |
| `onsiteConversion.postSave` · `postNetSave` | 15 | 48 % |
| **`lead`** | 15 | **48 %** |
| `offsiteConversion.fbPixelCustom` | 13 | 42 % |
| `offsiteCompleteRegistrationAddMetaLeads` · `offsiteSearchAddMetaLeads` · `offsiteContentViewAddMetaLeads` · `customEventActionsAdd_20SCalls` · `onsiteConversion.leadGrouped` · `onsiteWebLead` · `offsiteConversion.fbPixelLead` · `offsiteLeadAdd_20SCalls` · `post` | 11 | 35 % |
| `comment` · `onsiteConversion.postNetComment` · `onsiteConversion.messagingConversationStarted_7d` | 7 | 23 % |
| `…messagingConversationReplied_7d` · `…totalMessagingConnection` | 4 | 13 % |
| `…postUnlike` · `…messagingUserDepth_2MessageSend` · `…messagingFirstReply` · `…messagingUserDepth_3MessageSend` · `initiateCheckout` · `offsiteConversion.fbPixelInitiateCheckout` · `offsiteInitiateCheckoutAdd_20SCalls` · `onsiteWebInitiateCheckout` · `omniInitiatedCheckout` | 3 | 10 % |
| `like` · `…messagingUserDepth_5MessageSend` | 2 | 6 % |
| `onsiteConversion.viewContent` · `onsiteAppViewContent` · `onsiteWebViewContent` · `onsiteWebAppViewContent` · `omniViewContent` | 1 | 3 % |

**Son ~45 tipos distintos observados, y el catálogo es de Meta.** Puede crecer sin avisar. Ésa es la
razón por la que el desglose no se guarda en columnas: ver `08-DE-DONDE-VIENE-CADA-DATO.md`.

### C14-02 · El mismo campo llega con dos tipos, y hay que leer los dos

A nivel de **cuenta** (`/reporting`) los valores son **números**; a nivel de **anuncio**
(`/reporting/list`) son **cadenas**. Medido el mismo día, la misma cuenta:

```
/reporting          "results":{"linkClick":3250,"videoView":19688,"landingPageView":101}
/reporting/list     "results":{"linkClick":"18","videoView":"328","landingPageView":"16"}
```

`numero()` (`lib/ghl/anuncios.ts:141`) ya aguanta las dos formas. Lo que **no** puede hacer el lector
es escribir cero cuando un valor no se deja leer: tiene que contarlo, por el mismo motivo por el que
`metricasPorAnuncio` cuenta `ilegibles`.

### C14-03 · Hoy se tira, y es un defecto de una línea

`lib/ghl/anuncios.ts:405`:

```ts
resultadosDeMeta: numero(o.results),
```

`results` es un **objeto**. `numero()` (`:141`) devuelve `null` para todo lo que no sea número o
cadena. Así que `resultadosDeMeta` es **`null` siempre, para todos los anuncios, en todas las
llamadas** — y aunque no lo fuera, `negocio.metricas_de_anuncio` no tiene columna donde guardarlo.

**Y el costo de arreglarlo es cero llamadas.** El colector de Acquisition ya pide este endpoint una
vez por campaña y por día, en la tarea `anuncios` del cron de las `17 6 * * *`
(`lib/negocio/barrido.ts:222`). No hace falta pedir nada nuevo: hace falta guardar lo que ya llega.

---

## 2 · El enum de `fields` es cerrado, y por eso el video no se puede pedir

`/reporting` acepta un parámetro `fields`. La hipótesis razonable era que GoHighLevel lo pasara a la
API de Meta, en cuyo caso los cuartiles de video se pedirían por ahí. **No lo pasa.**

Probando campo por campo sobre
`/ad-publishing/facebook/reporting?locationId=…&groupBy=day&type=INTEGRATION&startDate=2026-09-10&endDate=2026-09-12`:

### C14-04 · Los once valores aceptados, y no hay más

```
impressions · clicks · spend · cpc · cpm · reach · frequency · ctr · conversions · results · cost_per_result
```

### C14-05 · Todo lo demás devuelve 422, incluidos los nombres nativos de Meta

Rechazados, con el cuerpo textual
`{"status":422,"message":["each value in fields must be a valid enum value"],"name":"UnprocessableEntityException"}`:

```
video_p25_watched_actions · video_p50_watched_actions · video_p75_watched_actions
video_p100_watched_actions · video_play_actions · video_avg_time_watched_actions
video_thruplay_watched_actions · video_30_sec_watched_actions · videoViews · videoPlays
thruplays · avgWatchTime · hookRate · holdRate · videoP25 · videoP50 · videoP75 · videoP100
inline_link_clicks · inline_link_click_ctr · outbound_clicks · outbound_clicks_ctr
linkClicks · link_clicks · landingPageViews · uniqueClicks · unique_clicks
actions · cost_per_action_type · quality_ranking · engagement_rate_ranking
conversion_rate_ranking · qualityRanking · roas · purchases · revenue · engagement
postEngagement · leads · costPerResult · cpl · leadRate · cpp · objective · adId
adsetId · campaignId · adName · status · effectiveStatus · messagingConversations
```

Y el **control negativo**: `campo_que_no_existe_xyz` da exactamente el mismo 422 con el mismo mensaje,
lo que confirma que la validación es del enum de GoHighLevel y no de Meta.

**Consecuencia:** los cuartiles, el tiempo medio visto y la retención de seis segundos **no se pueden
pedir por esta vía de ninguna forma**. No es que haya que encontrar el nombre correcto del campo: no
hay campo que pedir.

---

## 3 · El enum de `groupBy` también es cerrado, y ahí cae el placement

### C14-06 · Sólo `day`, `week` y `month`

| valor | resultado |
|---|---|
| `day` | **200** · 3 filas para 3 días |
| `week` | **200** · 1 fila |
| `month` | **200** · 1 fila |
| `ad` · `adset` · `campaign` · `creative` · `hour` · `age` · `gender` · `placement` · `platform` · `device` · `country` | **422** `«groupBy must be a valid enum value»` |

**Consecuencia:** no hay ningún desglose demográfico ni de ubicación. El **`Placement`** que pide el
§ 18.12 no tiene fuente por esta vía. Tampoco edad, género, dispositivo, plataforma ni país.

Y ojo con el otro sentido: `groupBy` **existe en `/reporting` y se ignora en `/reporting/list`**. Ya
estaba medido y está escrito en `lib/ghl/anuncios.ts:346-354`: con un rango de tres días devuelve una
fila agregada por anuncio, no tres. El grano diario por anuncio se consigue pidiendo un día por
llamada, que es lo que el colector hace.

---

## 4 · El activo creativo no está, y las rutas que lo tendrían no existen

### C14-07 · `/entity?entityType=AD` devuelve cuatro campos y ninguno es la pieza

`GET /ad-publishing/facebook/entity?locationId=…&type=INTEGRATION&entityType=AD` → **200**, 100
entidades por página. La **unión de claves sobre 80 anuncios** es:

```
name · adId · adAccountId · locationId
```

Nada más. Ni imagen, ni video, ni copy, ni título, ni miniatura, ni `meta_creative_id`, ni estado de
entrega — esto último ya estaba medido y es la razón por la que `negocio.anuncios` no tiene columna de
estado (`050:60-63`).

### C14-08 · Las rutas de creativos no existen

Probadas todas con `?locationId=…`:

| ruta | resultado |
|---|---|
| `/ad-publishing/facebook/integration` | **200** · `status, locationId, pages, pricingModel, fbAdAccountId, fbDefaultPageId` |
| `/ad-publishing/facebook/ad-accounts` | **200** · 93 cuentas |
| `/ad-publishing/facebook/pages` | **200** · 1 página |
| `/ad-publishing/facebook/pixels` | **200** · `items, total` |
| `/ad-publishing/facebook/entity` | 422 sin `entityType` — existe |
| `/ad-publishing/facebook/reporting` · `/reporting/list` | existen |
| **`/ad-publishing/facebook/creatives`** | **404** |
| **`/ad-publishing/facebook/ads`** · **`/campaigns`** · **`/insights`** | **404** |
| `/ad-publishing/facebook/forms` · `/audiences` · `/ad-account` · `/business` · `/instagram-accounts` · `/reporting/summary` | **404** |

Y por `listType` en `/reporting/list`:

| valor | resultado |
|---|---|
| `campaigns` | **200** · 61 campañas · `name, status, campaignId, adAccountId, locationId` |
| `adsets` · `ads` | **200**, y exigen `campaignId` |
| `creatives` · `creative` · `ad_creatives` · `adcreatives` · `videos` · `posts` | **422** `«listType must be a valid enum value»` |

**Consecuencia:** la entidad `Creative Profile` del § 5.1 no se puede llenar por esta vía. Y con ella
no se puede construir la mitad interpretativa que el § 18.12 le reserva a Creative Intelligence
—hook, body, CTA, guion, variantes nuevas—, porque **exige leer la pieza y la pieza no está**.

### C14-09 · Lo que sí apareció y no estaba documentado: `promotedObject` y `adsetName`

Las filas con métricas de `/reporting/list` traen dos campos que el cliente no lee:

- **`promotedObject`** — `{pixelId, customEventType, smartPseEnabled}`. El `pixelId` es el dato que la
  `050` mencionó en su diseño y dejó sin columna. `customEventType` dice qué evento optimiza la
  campaña (`SCHEDULE` en el caso medido), que es contexto real para leer un CPL.
- **`adsetName`** — el nombre del conjunto, que hoy sólo se tiene como identificador.

No son requisitos de esta carpeta; se anotan porque están llegando gratis y alguien va a preguntar.

---

## 5 · Lo que esto cambia, en una tabla

| El § 18.7 pide | Antes se creía | Medido el 2026-09-18 |
|---|---|---|
| Three-second view rate | imposible | **`videoView` / impresiones**, 90 % de cobertura — con la salvedad `C14-P01` |
| Hook retention proxy | imposible | **se puede definir** sobre `videoView` |
| Six-second retention | imposible | imposible, confirmado (`C14-05`) |
| 25/50/75/100 % view rate | imposible | imposible, confirmado (`C14-05`) |
| Average watch time | imposible | imposible, confirmado (`C14-05`) |
| Fatigue trend | imposible | **se puede, por caída de CTR** — no por frecuencia, ver `09-LO-QUE-NO-ES-UN-REQUISITO.md` |
| Link CTR (§ 18.7 «Interacción») | imposible | **`linkClick` / impresiones**, 74 % |
| Landing page view rate | imposible | **`landingPageView` / impresiones**, 65 % |
| Click-to-landing rate | imposible | **`landingPageView` / `linkClick`** |
| Placement (§ 18.12) | no evaluado | imposible, confirmado (`C14-06`) |
| Activo creativo (§ 5.1) | imposible | imposible, confirmado (`C14-07`, `C14-08`) |

---

## Preguntas abiertas

### C14-P01 · Qué cuenta exactamente `videoView`

GoHighLevel no documenta qué empaqueta en esa clave. En la API nativa de Meta, `video_view` son
**reproducciones de tres segundos**, pero acá el valor viene de un intermediario y no hay forma de
confirmarlo desde afuera. Publicarlo rotulado como «three-second view rate» afirma una definición que
nadie escribió.

**Mientras no se confirme, se rotula «reproducciones que Meta contó».** El daño concreto de
equivocarse es que alguien reescriba un gancho por un número que en realidad cuenta ThruPlays.

### C14-P02 · Si `results.lead` es la población de Meta o la nuestra

La `050:208-223` declaró muerto un KPI del § 18.7 —«diferencia entre leads reportados por Meta y leads
identificados en la base»— tras medir que el campo `leads` de primer nivel es **nuestro propio
conteo**: 16 de 16 coincidencias exactas contra `negocio.contactos`.

Pero `results.lead` es otro campo. En la fila medida arriba, `leads` vale `"0"` y `results.lead` vale
`"1"`. **Si `results.lead` resulta ser el conteo de Meta, ese KPI revive** y son 16 de 25, no 15. Se
contesta comparando las dos columnas sobre las filas que ya se van a guardar; no se puede contestar
antes de guardarlas.

### C14-P03 · Si la cobertura de `videoView` está repartida al azar entre piezas

El 90 % es global. Pero una pieza estática **nunca** va a tener `videoView`, y eso no es una laguna de
cobertura: es un hecho sobre la pieza. Si la ausencia se concentra en las piezas que no son video, el
hook rate de esas piezas tiene que salir **nulo y no bajo**, y la cobertura hay que publicarla por
pieza y no global. Se contesta agrupando la cobertura por creativo, con los datos ya recolectados.

### C14-P04 · Si `results` puede llegar como arreglo

La medición muestra un objeto plano `{tipo: valor}`. La API nativa de Meta devuelve las acciones como
**arreglo de `{action_type, value}`**. `numero(o.results)` da `null` con las dos formas, así que el
código actual no distingue y la evidencia que hay es de una sola cuenta. El lector tiene que tolerar
las dos o, como mínimo, contar como ilegible lo que no reconozca — nunca devolver vacío en silencio.

---

## Cómo reproducir cualquiera de estas mediciones

El token se lee de producción y se descifra en el proceso; es el mismo molde que usaron las sondas de
Acquisition:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer \
  "select crm_token_cifrado, crm_cuenta_id from identidad.organizaciones_credenciales where crm_token_cifrado is not null"
```

`CLAVE_MAESTRA` viene de `.env.supabase`; el blob es `nonce:etiqueta:cifrado` en base64, AES-256-GCM.
Las llamadas van con `Authorization: Bearer <token>`, `Version: 2021-07-28`, `Accept: application/json`.

**Todas las mediciones de este documento son `GET`.** No se probó ni una escritura: una escritura toca
pauta activa y dinero real, y la decisión del 2026-09-18 es que Creative sea de sólo lectura — propone,
y la persona ejecuta en Meta.
