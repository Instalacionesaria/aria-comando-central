-- Lo que costó cada anuncio, por día: las dos tablas que hacen posible Acquisition sin conectar Meta.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA CARPETA `docs/acquisition/` CIERRA CON UNA FRASE QUE ESTA MIGRACIÓN DESMIENTE
--
-- `13-EL-CONTRASTE.md` § 5: *«`public.closer_org_config` tiene 3 filas, 0 con `meta_ad_account_id`
-- y 0 con `meta_token_cifrado`. Sin esa credencial no hay Meta Data Collector, y sin colector no
-- hay ninguno de los otros cuatro componentes ni veintidós de los veinticinco KPI.»*
--
-- La credencial que falta **no hace falta**. GoHighLevel expone una API de Ad Manager
-- (`/ad-publishing/facebook/…`) que devuelve el gasto de Meta, y **el token que ya usamos la
-- alcanza**: la subcuenta está vinculada al Business Manager y las campañas se lanzan desde ahí.
-- Es el mismo error que la `048` documentó para las UTM — el dato no está ausente, está sin pedir.
--
-- Sondeado de sólo lectura contra la subcuenta real el 2026-09-16, con el token de
-- `identidad.organizaciones_credenciales.crm_token_cifrado`:
--
--     GET /ad-publishing/facebook/integration      200 · connected · act_1349863156073553
--     GET /ad-publishing/facebook/entity           200 · 61 campañas, 200 conjuntos, 402 anuncios
--     GET /ad-publishing/facebook/reporting        200 · serie diaria de la cuenta, con CPM
--     GET /ad-publishing/facebook/reporting/list   200 · métricas POR ANUNCIO, con el adId de Meta
--
-- ── EL CRUCE ESTÁ PROBADO, NO SUPUESTO ─────────────────────────────────────
--
-- Toda esta migración se apoya en que el identificador de anuncio que devuelve GoHighLevel sea EL
-- MISMO que la `048` ya guarda en `negocio.contactos.atribucion_primera`. Medido el 2026-09-16:
--
--     adId        nuestros 15 · en GHL 402 · CRUZAN 15 (100 %)
--     utmTerm     nuestros  9 · en GHL 200 · CRUZAN  9 (100 %)   ← el conjunto de anuncios
--     campaignId  nuestros 14 · en GHL  61 · CRUZAN 12 (86 %)
--
-- Y los dos `campaignId` que no cruzan **no son campañas**: `{{campaign.id}}`, una plantilla de
-- GoHighLevel que nunca se expandió (3 contactos), y `888888`, un valor de prueba (1 contacto).
-- Pedirle métricas a `888888` devuelve **HTTP 500**, no un 404 — así que el colector tiene que
-- tolerar el fallo de UNA campaña sin abortar la pasada, y por eso el filtro de la Etapa C es por
-- lista de campañas conocidas y no por «lo que haya en la atribución».
--
-- Verificación al nivel de las MÉTRICAS, que es más fuerte que la de los identificadores: pedidas
-- las 13 campañas para el 2026-09-10, los **15 de 15** anuncios nuestros aparecen en el reporte, y
-- la suma del gasto de nuestras campañas (163,85) no se pasa del gasto de la cuenta (262,07).
--
-- ── `utmTerm` ES EL IDENTIFICADOR DEL CONJUNTO, Y HAY UN DOCUMENTO QUE DICE LO CONTRARIO ──
--
-- `docs/estado actual/06-INTEGRACIONES-GHL.md` afirma que el conjunto de anuncios llega sólo como
-- nombre, y sobre eso construye una de las tres razones para conectar Meta. Los 9 valores distintos
-- de `utmTerm` cruzan 9 de 9 contra los conjuntos de GoHighLevel. El documento hay que corregirlo.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ── LO QUE NO VIENE POR ESTA VÍA, DICHO ACÁ PARA QUE NADIE LO BUSQUE DOS VECES ──
--
-- Las **seis métricas de video** del § 18.7 (reproducciones, cuartiles 25/50/75/100, tiempo medio
-- de reproducción, retención de tres y seis segundos), `link clicks`, `link CTR` y
-- `landing page views`. Con ellas caen el analizador de creativos del § 18.12 y la vista entera del
-- responsable creativo del § 18.15. Está aceptado como hueco, y estas tablas se diseñaron para que
-- una segunda fuente pueda rellenar **sólo** el video sin rehacer nada: son columnas que se agregan.
--
-- Y el **estado de entrega por anuncio** tampoco: medido, `/entity` devuelve `status` y
-- `effectiveStatus` a nivel de campaña, sólo `effectiveStatus` a nivel de conjunto, y **ninguno de
-- los dos a nivel de anuncio**. Por eso no hay columna de estado en `negocio.anuncios`: una columna
-- que nunca se puede llenar es peor que su ausencia, porque parece un dato que falta cargar.


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · LA DIMENSIÓN: QUÉ ANUNCIO ES CADA IDENTIFICADOR
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Existe para una sola cosa: que un `adId` de dieciocho dígitos se pueda nombrar. Sin ella, la
-- pantalla publica `120249633901580467` y nadie sabe de qué anuncio habla.
--
-- ── DE DÓNDE SALE, Y POR QUÉ NO DE `/entity` ───────────────────────────────
--
-- `/entity?entityType=AD` devuelve 402 anuncios y es **una lista plana**: `name`, `adId`,
-- `adAccountId`, `locationId`. **Sin conjunto y sin campaña.** O sea que la jerarquía NO se puede
-- reconstruir desde ahí, y eso es lo que decide el diseño del colector: la dimensión se llena desde
-- `/reporting/list`, que es la misma llamada que trae las métricas y sí trae `adsetId`,
-- `campaignId` y `objective`. Una llamada, no dos.
--
-- Consecuencia buscada: sólo entran los anuncios de las campañas que nos trajeron alguien. Los 402
-- de la cuenta no tienen por qué estar acá, y no están.
create table if not exists negocio.anuncios (
  -- Sin `on delete cascade` hacia la organización, como las ocho tablas de la `011` y la `047`:
  -- borrar una empresa se frena antes en `contactos`, con el mensaje que ya está escrito para eso.
  org_id uuid not null references identidad.organizaciones(id),

  -- El identificador nativo de Meta. **`text` y no `bigint`**, y no es indiferencia por el tipo:
  -- los identificadores de Meta son opacos —hoy entran en 64 bits, mañana no tiene por qué— y
  -- sobre todo así es como ya está guardado del otro lado del cruce, dentro del JSONB de
  -- `atribucion_primera`. Dos tipos distintos para la misma llave obligarían a castear en cada
  -- unión, y un casteo que falla en una fila aborta la consulta entera.
  meta_anuncio_id text not null,

  -- Los dos padres. `meta_conjunto_id` es lo que la `048` guarda como `utmTerm`, y es el ÚNICO
  -- lugar del sistema donde eso queda dicho con su nombre verdadero.
  --
  -- Nulables los dos aunque el proveedor los mande hoy: el patrón de la `048` —clave ausente ⟹ no
  -- se escribe— vale igual acá, y una columna `not null` convertiría un cambio del proveedor en un
  -- aborto de la pasada del cron en vez de en una fila incompleta.
  meta_conjunto_id text,
  meta_campana_id  text,

  -- El nombre que se dibuja. Es lo único que esta tabla existe para dar.
  nombre text not null,

  -- `OUTCOME_LEADS`, `OUTCOME_ENGAGEMENT`, … **Sin `check` de vocabulario**, por la misma razón que
  -- la `047` no se lo pone a `que_paso`: sería una copia del catálogo de otro sistema y, el día que
  -- Meta agregue un objetivo, abortaría la transacción del cron en vez de ensuciar una fila. Un
  -- catálogo ajeno no puede ser lo que frena la ingesta.
  objetivo text,

  -- Cuándo lo vimos por última vez. La dimensión se reescribe entera en cada pasada, así que este
  -- sello dice hasta cuándo el nombre estuvo confirmado — y un anuncio que dejó de aparecer queda
  -- con su sello viejo en vez de desaparecer, que es lo correcto: sus métricas históricas siguen
  -- necesitando nombre.
  sincronizado_el timestamptz not null default now(),

  -- Sin identificador propio. La llave natural YA es única y ya empieza por `org_id`, que es lo que
  -- la `008` exige; agregar un uuid obligaría a una búsqueda extra en cada inserción de métrica
  -- para no duplicar, y esa búsqueda es justo lo que una llave natural evita.
  primary key (org_id, meta_anuncio_id)
);

comment on table negocio.anuncios is
  'Que anuncio de Meta es cada meta_anuncio_id, para poder nombrarlo en pantalla. Se llena desde /ad-publishing/facebook/reporting/list de GoHighLevel, no desde Meta. Solo entran los anuncios de campanas que trajeron algun contacto.';

comment on column negocio.anuncios.meta_conjunto_id is
  'El conjunto de anuncios. Es el MISMO valor que contactos.atribucion_primera->>''utmTerm'': 9 de 9 cruzan, medido el 2026-09-16.';

comment on column negocio.anuncios.sincronizado_el is
  'Ultima pasada que confirmo este anuncio. Un anuncio que dejo de aparecer NO se borra: sus metricas historicas siguen necesitando nombre.';

-- `create policy` NO tiene `if not exists`, y `aplicar_aislamiento` hace uno. Sin este `drop`
-- previo, correr este archivo sobre una base que ya lo tiene muere con **42710** y —como Kysely mete
-- todas las pendientes en UNA transacción— se lleva puestas a las demás. Es exactamente el defecto
-- que la `024` pagó en producción y que `10-migraciones.test.ts` cierra para `add constraint`.
--
-- Las ocho llamadas de la `011` no lo tienen porque son anteriores a esa regla y están aplicadas y
-- registradas en todas las bases. Desde la `024` la regla es reaplicar sin morir, y vale igual para
-- una política que para una restricción.
drop policy if exists aislamiento on negocio.anuncios;
select negocio.aplicar_aislamiento('negocio.anuncios');


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · EL HECHO: CUÁNTO COSTÓ ESE ANUNCIO ESE DÍA
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Grano diario, que es lo que el § 18.4 exige literalmente —*«las métricas deben guardarse por
-- fecha para permitir comparaciones históricas»*— y lo que permite que CUALQUIER ventana se arme
-- sumando, sin volver a llamar al proveedor.
--
-- ── EL GRANO DIARIO ES UNA RESTRICCIÓN DEL PROVEEDOR, NO UNA PREFERENCIA ───
--
-- `groupBy=day` funciona en `/reporting` y **se ignora** en `/reporting/list`. Medido el
-- 2026-09-16 sobre la campaña `120249590301010467`: el rango 09-10→09-12 devuelve diez filas con
-- `spend 24,3`, y 09-11→09-11 devuelve diez filas con `spend 6,23`. O sea que un rango da el TOTAL
-- del rango por anuncio, no una fila por día. Guardar por fecha obliga a una llamada por día.
create table if not exists negocio.metricas_de_anuncio (
  org_id uuid not null references identidad.organizaciones(id),

  meta_anuncio_id text not null,

  -- `date` y no `timestamptz`: el proveedor entrega `dateStart`/`dateStop` como día calendario de
  -- la zona de la cuenta publicitaria, no como un instante. Guardarlo como marca de tiempo
  -- obligaría a elegir una hora que el dato no tiene, y toda zona horaria que se aplicara después
  -- movería el gasto de un día al otro. Es el mismo criterio por el que la suite corre en tres
  -- zonas: lo que no es un instante no se guarda como instante.
  fecha date not null,

  -- ── LAS SIETE MÉTRICAS, Y POR QUÉ LAS SIETE SON NULABLES ─────────────────
  --
  -- **Ésta es la decisión más importante del archivo.** Medido el 2026-09-16: cuando un anuncio NO
  -- entregó ese día, el proveedor **omite las siete claves enteras**. La fila que devuelve es:
  --
  --     {"name":"bofu - agendamiento - yaping - 23/07","adId":"120249254688910467",
  --      "objective":"OUTCOME_LEADS","campaignId":"120249254209020467",
  --      "revenue":"0.00","sales":"0","leads":"0","averageRevenue":"0.00"}
  --
  -- Ni `spend`, ni `impressions`, ni `clicks`, ni `ctr`, ni `cpc`, ni `reach`, ni `frequency`.
  --
  -- O sea que el proveedor YA distingue los dos ceros, y escribir `0` donde mandó nada sería
  -- destruir esa distinción en la única capa que puede conservarla. «No entregó» y «entregó y
  -- costó cero» son hechos distintos: el primero no debe entrar en el denominador de ningún
  -- promedio, y el segundo sí.
  --
  -- `numeric` y no `double precision` en todas: el gasto es dinero y suma cientos de filas por
  -- ventana, y el error de coma flotante que eso acumula aparece como centavos que no cierran
  -- contra el total de la cuenta — el mismo total contra el que la Etapa C comprueba la suma.
  gasto        numeric(14, 4),
  impresiones  bigint,
  clics        bigint,
  alcance      bigint,

  -- Las tres derivadas que el proveedor manda ya calculadas. Se guardan **además** de los
  -- ingredientes, no en su lugar: `ctr` y `cpc` se pueden recalcular, `frecuencia` no siempre
  -- (alcance puede faltar), y guardar lo que el proveedor dijo permite detectar el día que su
  -- cálculo y el nuestro difieran, en vez de tapar la diferencia recalculando en silencio.
  ctr        numeric(10, 6),
  cpc        numeric(12, 6),
  frecuencia numeric(10, 6),

  -- ── LO QUE DELIBERADAMENTE NO SE GUARDA ──────────────────────────────────
  --
  -- `/reporting/list` devuelve también `leads`, `sales`, `revenue` y `averageRevenue`, y NINGUNO
  -- entra acá. La razón es una medición, no una preferencia: **`leads` es el conteo de contactos
  -- de GoHighLevel, no el de Meta.** Comparados los cuatro anuncios de la campaña
  -- `120249633901590467` en cuatro días contra `negocio.contactos`, el 2026-09-16:
  --
  --     16 de 16 coincidencias EXACTAS (19=19, 3=3, 5=5, 6=6, 1=1, y once ceros)
  --
  -- Guardarlo sería guardar una copia de lo que ya sabemos contar, con la garantía de que algún
  -- día las dos cifras difieran y nadie sepa cuál manda.
  --
  -- Y tiene una consecuencia que hay que decir de frente porque contradice al documento: el § 18.7
  -- pide *«diferencia entre leads reportados por Meta y leads identificados en la base»*, y **por
  -- esta vía ese KPI no existe** — la diferencia es cero por construcción. Hacen falta las dos
  -- poblaciones, y acá hay una sola. Son 15 de los 25 KPI, no 16.

  -- Cuándo se leyó esta fila. **Meta corrige datos hacia atrás**, así que dos lecturas de la misma
  -- ventana pueden dar cifras distintas sin que nada falle. El colector reescribe con `on conflict`
  -- y este sello es lo único que permite decir *desde cuándo* es cierto lo que la pantalla muestra.
  sincronizado_el timestamptz not null default now(),

  -- La llave es el grano. `(org_id, meta_anuncio_id, fecha)` es lo que hace que el colector pueda
  -- correr dos veces sobre el mismo día sin duplicar, y `org_id` primero es lo que la `008` exige.
  primary key (org_id, meta_anuncio_id, fecha),

  -- Con `org_id` de los dos lados, que es la comprobación 5 de `aplicar_aislamiento`: una foránea
  -- sin la organización permitiría que una métrica apunte al anuncio de otro inquilino, y la
  -- política de fila no la alcanzaría para desmentirlo.
  --
  -- `on delete cascade`: si el anuncio se va, sus métricas no le sobreviven a nadie.
  foreign key (org_id, meta_anuncio_id)
    references negocio.anuncios (org_id, meta_anuncio_id) on delete cascade
);

comment on table negocio.metricas_de_anuncio is
  'Cuanto costo cada anuncio cada dia. Las siete metricas son NULABLES a proposito: el proveedor OMITE las claves cuando el anuncio no entrego, y un 0 en su lugar destruiria la diferencia entre no entrego y entrego gratis.';

comment on column negocio.metricas_de_anuncio.sincronizado_el is
  'Cuando se leyo. Meta corrige hacia atras, asi que la misma ventana puede dar cifras distintas en dos lecturas sin que nada falle.';

-- ── EL ÍNDICE QUE SÍ TIENE CONSULTA ────────────────────────────────────────
--
-- La pregunta de la pantalla es siempre «el gasto de esta organización en esta ventana», y recién
-- después se agrupa por anuncio. La clave primaria arranca por `meta_anuncio_id`, así que no sirve
-- para recortar por ventana: haría un recorrido completo antes de filtrar por fecha.
--
-- Este índice pone la fecha segunda, que es el orden en que la consulta pregunta. Un segundo índice
-- por campaña esperaría una consulta que todavía no existe.
create index if not exists metricas_de_anuncio_por_ventana
  on negocio.metricas_de_anuncio (org_id, fecha, meta_anuncio_id);

-- `create policy` NO tiene `if not exists`, y `aplicar_aislamiento` hace uno. Sin este `drop`
-- previo, correr este archivo sobre una base que ya lo tiene muere con **42710** y —como Kysely mete
-- todas las pendientes en UNA transacción— se lleva puestas a las demás. Es exactamente el defecto
-- que la `024` pagó en producción y que `10-migraciones.test.ts` cierra para `add constraint`.
--
-- Las ocho llamadas de la `011` no lo tienen porque son anteriores a esa regla y están aplicadas y
-- registradas en todas las bases. Desde la `024` la regla es reaplicar sin morir, y vale igual para
-- una política que para una restricción.
drop policy if exists aislamiento on negocio.metricas_de_anuncio;
select negocio.aplicar_aislamiento('negocio.metricas_de_anuncio');


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · LO QUE ESTE ARCHIVO **NO** PUEDE HACER
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Rellenar. Con RLS forzada el migrador ve cero filas y un `insert` con `select` sobre
-- `negocio.contactos` leería vacío y reportaría éxito sin escribir nada — es la regla que la `040`
-- dejó escrita y que la `049` repitió. Las dos tablas nacen vacías.
--
-- El relleno inicial de 30 días es trabajo de la Etapa C, desde la aplicación y con organización en
-- contexto. Y hasta que corra, **toda cifra de costo tiene que decir desde cuándo mide**: ninguna
-- ventana anterior al primer día recolectado tiene gasto, y una pantalla que muestre cero ahí
-- estaría afirmando que no se gastó nada.
