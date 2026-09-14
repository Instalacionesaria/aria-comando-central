-- De dónde vino el lead y cuándo entró: cinco campos que GoHighLevel ya manda y se tiraban.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA PREGUNTA ERA SI HACÍA FALTA CONECTAR META. MEDIDA, LA RESPUESTA ES QUE NO.
--
-- El documento de arquitectura pide, para Lead Flow: campaña de origen, ad set, anuncio, creativo,
-- UTM de primer y último toque, y landing de origen. La respuesta obvia era «hay que conectar el
-- API de Meta» —una app, un token de larga duración y una revisión de app—, y sobre esa suposición
-- se llegó a reportar que `meta_ad_id` y las UTM tenían *«cero coincidencias en todo el
-- repositorio»*. Es cierto como nombre de columna y es ENGAÑOSO como conclusión: el dato no está
-- ausente, está **sin declarar**. Un `grep` sobre nuestro código prueba qué pedimos, nunca qué
-- manda el proveedor.
--
-- Medido con `scripts/medir-contacto.mjs` sobre los 100 contactos más nuevos de la subcuenta real,
-- el 2026-09-14:
--
--     dateAdded                            100 de 100
--     attributionSource                    100 de 100
--     lastAttributionSource                100 de 100
--     country                              100 de 100
--     timezone                              13 de 100
--
-- Y adentro de los dos objetos de atribución:
--
--     attributionSource.sessionSource       98 · medium / mediumId  98
--     lastAttributionSource.sessionSource   91 · medium / mediumId  84
--     attributionSource.utmSource           20 · utmMedium 19 · utmContent 19
--     lastAttributionSource.utmSource        9 · utmMedium  8 · utmContent  8
--     lastAttributionSource.campaignId       7 · adId 5 · adSource 5
--     attributionSource.fbclid / fbc / fbp   3 cada uno
--
-- O sea: el primer toque y el último toque, con UTM, identificador de campaña, identificador de
-- anuncio y las cookies de Meta. La cobertura alta es de sesión y la baja es de anuncio, y eso es
-- lo esperable: sólo los leads que llegaron por un anuncio traen anuncio.
--
-- ── Y QUE EL `GET` TRAIGA LO MISMO ES LO QUE HACE ESTO SEGURO ───────────────
--
-- `guardar()` no corre sólo en el barrido: corre también **al abrir la ficha**, con lo que devuelva
-- `GET /contacts/{id}`. Medido en la misma corrida, sobre el mismo contacto: las cuatro claves que
-- trae la búsqueda las trae también el `GET`. Si no fuera así, abrir una ficha borraría lo que el
-- cron guardó —justo cuando alguien la mira, y sin un solo error—, que es exactamente el defecto
-- que el comentario de `sincronizar.ts` describe para `campos_del_crm`.
--
-- Igual, el escritor usa el patrón de **clave ausente ⟹ no se escribe**. La medición dice que hoy
-- la ficha las refresca; el patrón dice qué pasa el día que deje de hacerlo.
--
-- ── § 1 · NADA DE ESTO SE RELLENA HACIA ATRÁS ──────────────────────────────
--
-- Una migración NO puede sembrar datos por organización: con RLS forzada el migrador ve cero filas
-- y el `update` **reporta éxito sin tocar nada** (regla escrita en la `040`). Así que los 584
-- contactos reciben estas cinco columnas vacías y las pueblan en la pasada siguiente del cron.
-- Está bien y no hay que arreglarlo: GoHighLevel sigue teniendo el dato, y lo manda entero cada
-- vez. Lo que sí importa es que **ninguna cohorte armada con `alta_en_el_crm` tiene historia antes
-- del despliegue**, y toda pantalla que la use tiene que decir desde cuándo mide.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · CUÁNDO ENTRÓ EL LEAD DE VERDAD ─────────────────────────────────────
--
-- `dateAdded`, que hoy se pide y se usa **sólo para ordenar** la búsqueda. Toda cohorte de este
-- sistema se arma con `creado_el`, que es cuándo lo vio NUESTRO barrido — y en la carga inicial es
-- la misma marca para todos, así que «los contactos de esta semana» son los que sincronizamos esta
-- semana y no los que entraron. Las dos columnas conviven a propósito: una dice cuándo entró al
-- CRM y la otra cuándo lo vimos, y la diferencia entre ambas es la latencia de la ingesta.
--
-- Nulable, y no `not null default now()`: un contacto que todavía no se sincronizó y uno que
-- GoHighLevel no fechó tienen que poder distinguirse, y `now()` inventaría una fecha que nadie
-- midió. La regla del `11` § 0 vale igual acá: un nulo significa una sola cosa.
alter table negocio.contactos
  add column if not exists alta_en_el_crm timestamptz;

comment on column negocio.contactos.alta_en_el_crm is
  'El dateAdded de GoHighLevel: cuándo entró el lead al CRM. Distinto de creado_el, que es cuándo lo vio nuestro barrido. Sin relleno hacia atrás.';

-- ── 2 · EL PRIMER TOQUE Y EL ÚLTIMO ────────────────────────────────────────
--
-- `attributionSource` y `lastAttributionSource`, crudos, por el mismo motivo por el que
-- `campos_del_crm` se guarda crudo: guardarlos enteros es lo que permite derivar mañana sin
-- volver a preguntarle a GoHighLevel.
--
-- **`jsonb` y no ocho columnas planas.** La tentación es `utm_source text`, `ad_id text`, y así
-- ocho veces. La medición dice que `adId` viene en 5 de 100 y `campaignId` en 7 de 100: serían
-- ocho columnas casi siempre nulas, y cada campo nuevo que GoHighLevel agregue —ya trae
-- `gaClientId`, `fbc`, `fbp`, `mediumId`— sería otra migración. El objeto entero se guarda una vez
-- y lo normaliza `atribucionDelContacto` en el cliente.
--
-- **Dos columnas y no una.** El documento pide primer toque Y último toque, y son distintos: en la
-- medición `attributionSource.utmSource` viene en 20 contactos y `lastAttributionSource.utmSource`
-- en 9. Mezclarlos en una sola columna perdería justo la pregunta que se quiere contestar —«por
-- dónde llegó» contra «por dónde volvió»—, y ninguna de las dos se podría reconstruir después.
--
-- `not null default '{}'` igual que `campos_del_crm`: un contacto sin atribución y uno que nunca se
-- sincronizó se distinguen por `sincronizado_el`, que ya existe.
--
-- ── LO QUE HAY ADENTRO NO SE MUESTRA CRUDO ─────────────────────────────────
--
-- `referrer` y `url` son direcciones completas y pueden llevar el identificador de una persona
-- adentro. Guardarlos está bien —es dato del lead en la base de su propio inquilino, igual que su
-- teléfono— pero **ninguna pantalla los renderiza tal cual**. Por eso el guion que midió esto
-- imprime la forma y nunca el valor.
alter table negocio.contactos
  add column if not exists atribucion_primera jsonb not null default '{}'::jsonb;

alter table negocio.contactos
  add column if not exists atribucion_ultima jsonb not null default '{}'::jsonb;

comment on column negocio.contactos.atribucion_primera is
  'attributionSource de GoHighLevel, crudo: el PRIMER toque (utm, campaña, anuncio, fbclid). No se muestra crudo: puede llevar urls con identificadores.';

comment on column negocio.contactos.atribucion_ultima is
  'lastAttributionSource de GoHighLevel, crudo: el ÚLTIMO toque. No se muestra crudo: puede llevar urls con identificadores.';

-- ── 3 · DÓNDE ESTÁ EL LEAD ─────────────────────────────────────────────────
--
-- `timezone` viene en **13 de 100** y aun así vale declararlo, porque hoy la única zona horaria del
-- sistema es la de la EMPRESA: un «primer contacto a las 9 de la mañana» puede estar saliendo a las
-- 3 de la madrugada del lead, y nada en esta base permite hoy darse cuenta. Con 13 de 100 no se
-- construye una métrica; se construye una advertencia cuando se sabe.
--
-- `country` viene en 100 de 100 y es el que hace útil al anterior: con país hay zona aproximada
-- aunque `timezone` falte.
--
-- Los dos nulables y sin `check`: el vocabulario es ajeno. Una lista cerrada de países convertiría
-- un valor nuevo en un error que aborta la transacción y con ella el ciclo entero — es la misma
-- razón por la que `estado_entrega` no lo tiene (migración `040`).
alter table negocio.contactos
  add column if not exists zona_horaria_del_lead text;

alter table negocio.contactos
  add column if not exists pais text;

comment on column negocio.contactos.zona_horaria_del_lead is
  'La zona horaria del CONTACTO segun GoHighLevel (13 de 100 la traen). La zona de la empresa vive en identidad.organizaciones.';

comment on column negocio.contactos.pais is
  'El pais del contacto segun GoHighLevel. Sin check: el vocabulario es ajeno y un valor nuevo no puede abortar el ciclo.';

-- ── 4 · NINGÚN ÍNDICE, TODAVÍA ─────────────────────────────────────────────
--
-- No se crea ninguno: no hay una sola consulta escrita que filtre por estas columnas. El día que
-- una cohorte se arme por `alta_en_el_crm` hará falta `(org_id, alta_en_el_crm)`, y ese día se
-- agrega con la consulta que lo justifica al lado. Un índice sin consumidor es peso en cada
-- escritura del barrido —584 contactos cada 10 minutos— a cambio de nada.
--
-- Y tampoco hace falta `aplicar_aislamiento`: no se crea ninguna tabla. `negocio.contactos` ya
-- tiene su política, y las columnas nuevas quedan cubiertas por ella.
