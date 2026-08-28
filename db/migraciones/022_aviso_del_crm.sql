-- El AVISO DEL CRM: la puerta por la que GoHighLevel nos empuja lo que pasa, en segundos.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ CIERRA, Y CONTRA QUÉ SE COMPARA
--
-- Hoy un mensaje entrante llega por dos vías, las dos de SONDEO:
--
--   · con el Closer a la vista, el reloj de 10 segundos → el mensaje aparece en ~15 s;
--   · sin nadie mirando, el cron de 10 minutos → hasta 10 minutos.
--
-- La segunda es la que importa, porque es la única que corre cuando nadie mira — y es el piso de
-- cualquier cosa que quiera reaccionar sola: el auditor de IA que va a parar bots no puede tardar
-- diez minutos en enterarse de que un cliente se quejó.
--
-- El aviso es la tercera vía y la más rápida: **segundos**, y a coste CERO de llamadas al proveedor
-- cuando el contacto ya está en la caché — el cuerpo del webhook trae el texto del mensaje.
--
-- No reemplaza al sondeo. La plataforma anterior tenía las dos, a propósito y documentado: el aviso
-- trae rápido, el sondeo recoge lo que el aviso perdió (una entrega fallida, un workflow apagado, un
-- despliegue nuestro caído). Se complementan.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- DOS PIEZAS, Y LA PRIMERA ES LA QUE DECIDE DE QUIÉN ES CADA EVENTO
--
-- **(a) `aviso_secreto_hash`** en las credenciales de cada empresa.
--
-- Es la llave de atribución, y ahí está la única divergencia deliberada con la plataforma anterior.
-- Allá el flujo era: parsear el cuerpo → sacar el `locationId` → buscar la empresa → comparar su
-- secreto. O sea que **el cuerpo se parseaba antes de autenticar**, y el propio archivo lo admitía:
-- *«el costo es parsear JSON de alguien que todavía no se autenticó»*.
--
-- El costo real es peor que parsear JSON: obliga a una consulta a `identidad` por cada petición sin
-- autenticar. Y el agrupador de conexiones de `identidad` es `max: 5` y es **el mismo** que usan el
-- portero, las sesiones y el login de TODOS los inquilinos. Cualquiera que descubra la URL puede
-- dejar sin login a todo el mundo con un bucle.
--
-- Acá la empresa sale del SECRETO y no del cuerpo: se busca por el hash de la mitad derecha de la
-- cabecera, con índice único. Eso da tres cosas de una:
--
--   1. el cuerpo NO se parsea antes de autenticar;
--   2. el aislamiento **no depende de que el payload diga la verdad** — un workflow de la empresa A
--      con el `locationId` de B se atribuye a A, que es de quien es el secreto;
--   3. y la mitad IZQUIERDA de la cabecera es una pimienta global que se compara contra una variable
--      de entorno **antes de tocar la base**, así que sin ella la base es inalcanzable.
--
-- **HASH y no `_cifrado`**, a diferencia del token de GHL que vive dos columnas más allá. La
-- diferencia es que el token hay que USARLO —hay que poder descifrarlo para llamar al proveedor— y
-- este secreto solo hay que COMPARARLO: lo presenta quien llama. Nunca necesitamos leerlo, así que un
-- volcado de la base no entrega un secreto usable. El precedente exacto está en
-- `db/migraciones/004_sesiones.sql:18`: `token_hash text not null unique`, con el mismo motivo
-- escrito — «se busca por hash de token ANTES de saber quién es nadie».
--
-- **(b) `negocio.avisos_del_crm`**: la cuarentena.
--
-- Todo cuerpo se guarda CRUDO antes de interpretarlo, y se responde 200 enseguida. Es la decisión más
-- valiosa que la plataforma anterior tomó y hay que copiarla entera: *«el mapeo va a estar mal las
-- primeras veces — eso es lo que hace que se pueda corregir»*. Si el mapeo falla, el evento no se
-- perdió: queda la fila con su error, y se reprocesa.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) El secreto del aviso, por empresa
-- ─────────────────────────────────────────────────────────────────────────────

alter table identidad.organizaciones_credenciales
  add column if not exists aviso_secreto_hash text;

comment on column identidad.organizaciones_credenciales.aviso_secreto_hash is
  'sha256 hex del secreto que GoHighLevel presenta en la cabecera `X-Webhook-Secret`. Es la llave de '
  'ATRIBUCIÓN: la empresa de un aviso sale de acá y no del cuerpo, así que el aislamiento no depende '
  'de que el payload diga la verdad. Se guarda el hash y no el valor porque nunca hay que usarlo, '
  'solo compararlo — mismo motivo que `identidad.sesiones.token_hash`.';

-- ── EL ÍNDICE ÚNICO ES LO QUE VUELVE LA ATRIBUCIÓN INAMBIGUA ────────────────
--
-- Sin él, dos empresas podrían acabar con el mismo secreto —por un copiar y pegar entre workflows— y
-- la búsqueda devolvería dos filas. Ahí no hay forma correcta de elegir: cualquiera de las dos es
-- una fuga. Con el único, ese estado **no se puede alcanzar**: el segundo `update` falla con un
-- 23505 y alguien se entera en el momento, no seis meses después.
--
-- PARCIAL, y esa palabra es la diferencia entre que esto funcione y que no se pueda crear una empresa
-- nueva: sin `where ... is not null`, el segundo nulo colisiona con el primero. Es el defecto cuyo
-- síntoma —«no se puede dar de alta una empresa»— nadie asociaría con el webhook.
create unique index if not exists organizaciones_credenciales_aviso_secreto_unico
  on identidad.organizaciones_credenciales (aviso_secreto_hash)
  where aviso_secreto_hash is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) La cuarentena de avisos
-- ─────────────────────────────────────────────────────────────────────────────

create table negocio.avisos_del_crm (
  -- `on delete cascade` por el mismo motivo que `ingesta_pulso` y `tareas_programadas`: es
  -- contabilidad derivada que nadie escribió a mano y que ninguna pantalla puede vaciar. Bloqueando
  -- el borrado, la empresa quedaría imborrable para siempre sin ninguna acción que lo resuelva.
  org_id uuid not null references identidad.organizaciones(id) on delete cascade,
  id     uuid not null default gen_random_uuid(),

  -- ── LA HUELLA: sha256 hex del cuerpo CRUDO, byte por byte ────────────────
  --
  -- Es la idempotencia. GoHighLevel **admite entregas duplicadas** —lo dice su documentación y es
  -- por lo que el cron de este repositorio está escrito como reconciliación y no como cola— así que
  -- el mismo aviso puede llegar dos veces.
  --
  -- Sobre el cuerpo y no sobre un identificador del proveedor, y eso es deliberado: la acción Webhook
  -- estándar de GHL **no manda `messageId`** (medido en la plataforma anterior), así que un
  -- identificador propio habría que fabricarlo — y dos mensajes distintos del mismo contacto
  -- colisionaban con el esquema fabricado que allá se usó primero, y el segundo se descartaba como
  -- «duplicado». El cuerpo entero no tiene ese problema: dos mensajes distintos son dos cuerpos
  -- distintos.
  huella text not null,

  -- Del parámetro de la URL (`?evento=mensaje.entrante`). **NULO es la trampa**, y hay que decirlo:
  -- si alguien pega la URL base sin el parámetro, GHL entrega, nosotros guardamos, respondemos 200 y
  -- el aviso queda sin interpretar. Es el único error silencioso que la plataforma anterior documentó
  -- de su propio panel. Por eso `procesado_el` tiene lector — ver el monitor de frescura.
  evento text,

  -- El cuerpo CRUDO, `text` y no `jsonb`: la huella es sobre estos bytes, y `jsonb` normaliza el
  -- orden de las claves y los espacios, así que el mismo cuerpo daría dos huellas distintas según
  -- por dónde entró.
  cuerpo text not null,
  bytes  int  not null,

  -- ── LA ATRIBUCIÓN SE COMPARA, NO SE USA PARA RUTEAR ─────────────────────
  --
  -- La empresa ya salió del secreto. Este campo guarda si el `locationId` del cuerpo COINCIDE con la
  -- subcuenta de esa empresa, y sirve para darse cuenta de un workflow mal copiado — no para decidir
  -- de quién es el evento. Los cuatro valores:
  --
  --   coincide     · el cuerpo dice la misma subcuenta que la credencial
  --   ausente      · el cuerpo no trae identificador de subcuenta en ninguna de las tres formas
  --   discordante  · trae otro. Es un workflow apuntando a la URL equivocada, y se ve
  --   ilegible     · el cuerpo no es JSON. Se guarda IGUAL: descartarlo perdería la única
  --                  evidencia de que el proveedor cambió de forma
  atribucion text not null check (atribucion in ('coincide','ausente','discordante','ilegible')),

  -- Cuántas veces llegó el MISMO cuerpo, y cuándo la última. Con `do nothing` a secas una entrega
  -- repetida sería invisible; con esto se puede ver que un workflow está disparando de más.
  repeticiones    int         not null default 1,
  recibido_el     timestamptz not null default now(),
  visto_ultimo_el timestamptz not null default now(),

  -- Cuándo se INTERPRETÓ. Nulo = llegó y no se pudo mapear, que es un estado distinto de «no llegó»
  -- y lleva a otra investigación. Tiene lector: `frescuraDelAviso`.
  procesado_el timestamptz,
  -- Por qué no se pudo. Nulo cuando salió bien: un motivo inventado para el caso bueno haría que el
  -- campo dejara de significar algo.
  error text,

  -- `org_id` PRIMERO en la clave: es lo que `negocio.aplicar_aislamiento` exige, y su `raise
  -- exception` aborta la migración si se escribe al revés. Falla el despliegue de la base, no una
  -- prueba.
  primary key (org_id, id),
  constraint avisos_del_crm_huella_por_org unique (org_id, huella)
);

-- Para el panel: los últimos avisos de esta empresa.
create index avisos_del_crm_recientes on negocio.avisos_del_crm (org_id, recibido_el desc);

-- Y los que NO se pudieron interpretar. Índice parcial porque son pocos y se consultan siempre
-- juntos: es la consulta del monitor, la que distingue «no llega» de «llega y se descarta».
create index avisos_del_crm_sin_procesar on negocio.avisos_del_crm (org_id, recibido_el desc)
  where procesado_el is null or error is not null;

select negocio.aplicar_aislamiento('negocio.avisos_del_crm');

comment on table negocio.avisos_del_crm is
  'Cuarentena de avisos de GoHighLevel: todo cuerpo se guarda crudo ANTES de interpretarlo y se '
  'responde 200 enseguida, así que un mapeo equivocado no pierde el evento. La empresa la pone el '
  'secreto de la cabecera, nunca el cuerpo.';
