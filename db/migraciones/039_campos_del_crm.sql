-- Los campos personalizados de GoHighLevel: sus valores por contacto, y el catálogo que los nombra.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LOS VALORES YA VENÍAN EN LA RESPUESTA. NO SE MIRABAN.
--
-- La pestaña Perfil mostraba seis campos y un aviso que decía que la calificación de verdad
-- *«vive en GoHighLevel y todavía no se lee»*. Era cierto y era caro: a qué se dedica el lead,
-- cuántos clientes tiene, cuánto factura y si vio el video pre-call son los datos con los que un
-- closer decide qué decir, y estaban a una pestaña del navegador de distancia.
--
-- Medido el 2026-09-07 contra la subcuenta real: **los dos endpoints que este proyecto ya llama
-- devuelven `customFields`**. `POST /contacts/search` —el de la sincronización— trajo 24 valores en
-- el primer contacto, y `GET /contacts/{id}` —el que cuesta abrir una ficha— trajo 27 del mismo
-- contacto, **con la misma forma** `[{id, value}]`.
--
-- O sea que leerlos cuesta **cero llamadas nuevas**. Es el mismo hallazgo que `lib/ghl/cliente.ts`
-- documenta para `assignedTo`, y cumple la condición que `sincronizar.ts` repite: *«no haciendo más
-- llamadas sino aprovechando las que ya hacemos»*.
--
-- ── Y QUE LAS DOS FORMAS SEAN IGUALES ES LO QUE HACE ESTO SEGURO ───────────
--
-- Si `GET /contacts/{id}` no trajera `customFields`, cada apertura de ficha llamaría a `guardar()`
-- con la lista vacía y **borraría** lo que la sincronización había traído. El defecto no habría
-- fallado en ninguna parte: los campos aparecerían al sincronizar y se irían al abrir la ficha, que
-- es justo cuando alguien los mira. Se midió antes de escribir una línea, y está descartado.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ HACEN FALTA DOS TABLAS Y NO UNA
--
-- La respuesta del contacto trae `[{id, value}]` y **nada más**: ni el nombre del campo, ni a qué
-- carpeta pertenece. Eso vive en el catálogo de la subcuenta, que es otra llamada
-- (`GET /locations/{loc}/customFields`, 170 campos en 24 carpetas).
--
-- Y ahí aparece la división que manda sobre el diseño: hay datos que son **de GoHighLevel** —el
-- nombre del campo, su tipo, su posición, en qué carpeta está— y datos que son **nuestros** —qué
-- carpetas se muestran, en qué grupo del Perfil caen, y con qué etiqueta corta—. Mezclarlos en una
-- sola tabla significa que refrescar el catálogo pisa las decisiones, y el síntoma sería que la
-- pantalla se vacía sola después de una sincronización.
--
--   `negocio.carpetas_del_crm`  las carpetas, y **nuestra** decisión de cuáles se muestran.
--   `negocio.campos_del_crm`    el espejo del catálogo de GoHighLevel, campo por campo.
--
-- ── `grupo` NULO = NO SE MUESTRA, Y ES EL LADO CORRECTO DEL QUE FALLAR ─────
--
-- Una carpeta nueva en GoHighLevel nace **invisible**. Al revés —mostrar todo salvo lo prohibido—
-- una carpeta que alguien cree en el CRM para una prueba aparecería sola en la pantalla del closer,
-- con datos internos, sin que nadie hiciera nada. Es la misma política que `sePuedeMandar()` en
-- `lib/ghl/contrato.ts`: lo que no está en la lista no existe.
--
-- Las cuatro que sí se muestran se siembran al final de este archivo.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · LOS VALORES, CRUDOS Y POR IDENTIFICADOR ────────────────────────────
--
-- Un mapa `{"<id del campo en GHL>": "<valor>"}`. Crudo y por id, por el mismo motivo por el que
-- `etiquetas` se guarda crudo (migración 011): *«guardarlas crudas es lo que permite derivar sin
-- volver a preguntarle a GHL»*. Si mañana se agrega una quinta carpeta al Perfil, los valores ya
-- están acá y no hay que resincronizar 152 contactos para verlos.
--
-- `jsonb` y no `text` — al revés que `avisos_del_crm`, y por el motivo contrario: allá la huella es
-- sobre los bytes exactos y `jsonb` los normaliza, acá lo que se quiere es justamente poder
-- preguntar por una clave sin parsear la fila entera.
--
-- `not null default '{}'` y no nulable: un contacto sin campos y un contacto que nunca se
-- sincronizó se distinguen por `sincronizado_el`, que ya existe. Dos formas de decir «no sé» en la
-- misma fila es una de más.
alter table negocio.contactos
  add column if not exists campos_del_crm jsonb not null default '{}'::jsonb;

comment on column negocio.contactos.campos_del_crm is
  'Los campos personalizados de GoHighLevel, crudos: {id del campo: valor}. Los nombra negocio.campos_del_crm.';

-- ── 2 · LAS CARPETAS ───────────────────────────────────────────────────────

create table if not exists negocio.carpetas_del_crm (
  org_id  uuid not null references identidad.organizaciones(id),

  -- El identificador de la carpeta en GoHighLevel: el `parentId` de cada campo.
  carpeta_id  text not null,

  -- ── EL NOMBRE ADMITE NULOS, Y NO ES DEJADEZ ─────────────────────────────
  --
  -- GoHighLevel **no tiene endpoint que liste las carpetas** — se probaron cuatro formas el
  -- 2026-09-07 y las cuatro fallan. El nombre solo se consigue pidiendo la carpeta UNA POR UNA por
  -- su id, así que es la parte más frágil de toda la lectura.
  --
  -- `null` = la carpeta existe y su nombre no se pudo leer. Es un hecho, no un error: el filtro no
  -- depende del nombre —depende de `carpeta_id`— así que una carpeta sin nombre sigue funcionando
  -- perfectamente. Poner el id como nombre de reserva lo habría escondido y habría dibujado
  -- `sVdAfUBdIWUzYedio9NZ` como si fuera un título.
  nombre  text,

  -- ── A QUÉ GRUPO DEL PERFIL VAN SUS CAMPOS. NULO = NO SE MUESTRAN ────────
  --
  -- Ver el encabezado. Los valores son los de `CampoDePerfil['grupo']` en `lib/negocio/ficha.ts`, y
  -- la base los hace cumplir en vez de una lista en el código: es la misma decisión que la 027
  -- escribió para los agentes del auditor, porque dos listas del mismo hecho divergen en silencio.
  grupo  text,

  -- Cuándo se leyó por última vez del CRM. Es lo que evita volver a pedir el nombre de una carpeta
  -- que ya se conoce: sin esta marca, cada sincronización costaría 24 llamadas más.
  visto_el  timestamptz not null default now(),

  -- La organización PRIMERO, como en toda `negocio`: el motivo largo está en la 008.
  primary key (org_id, carpeta_id),

  constraint carpetas_del_crm_grupo
    check (grupo is null or grupo in ('detalles', 'origen', 'calificacion', 'interacciones')),

  -- Un nombre en blanco no es un nombre: se guarda nulo o se guarda algo. Sin esto, una carpeta
  -- con nombre vacío se dibujaría como un título en blanco, indistinguible de un defecto de estilo.
  constraint carpetas_del_crm_nombre_no_vacio
    check (nombre is null or btrim(nombre) <> ''),

  constraint carpetas_del_crm_id_no_vacio
    check (btrim(carpeta_id) <> '')
);

comment on table negocio.carpetas_del_crm is
  'Las carpetas de campos personalizados de GoHighLevel. `grupo` nulo = sus campos no se muestran.';

-- ── 3 · EL CATÁLOGO DE CAMPOS ──────────────────────────────────────────────

create table if not exists negocio.campos_del_crm (
  org_id  uuid not null references identidad.organizaciones(id),

  -- El `id` del campo en GoHighLevel. Es la clave con la que vienen los valores en el contacto.
  campo_id  text not null,

  -- El `name` de GoHighLevel, TAL CUAL. No se recorta ni se limpia: es lo que alguien ve al abrir
  -- el CRM, y tiene que poder cruzarse a ojo.
  nombre  text not null,

  -- ── LA ETIQUETA CORTA, QUE ES NUESTRA ───────────────────────────────────
  --
  -- El `04` § 2 pide la etiqueta corta —«Meta de facturación»— y no la pregunta entera. Los campos
  -- del formulario de Meta llegan con la pregunta completa: *«¿A cuanto quieres llevar tu
  -- facturacion mensual en 6 meses?»*, que en una columna de perfil no entra ni se lee.
  --
  -- `null` = usar `nombre`. La mitad de los campos ya llegan cortos («Clientes activos», «Tipo de
  -- negocio») y ponerles una copia idéntica acá sería un segundo lugar donde equivocarse.
  --
  -- Es NUESTRA, así que **el refresco del catálogo no la pisa**. Es la misma regla que gobierna el
  -- `on conflict` de `guardar()`: lo que decide GoHighLevel se pisa; lo que decidimos acá, no.
  etiqueta_corta  text,

  carpeta_id  text not null,

  -- El `dataType` de GoHighLevel: LARGE_TEXT, RADIO, SINGLE_OPTIONS, TEXT, NUMERICAL… No se usa
  -- para decidir nada todavía. Se guarda porque es la única forma de saber, sin volver a
  -- preguntar, si un campo que empezó a llegar raro cambió de tipo en el CRM.
  tipo  text not null,

  -- El `position` de GoHighLevel, que ordena los campos DENTRO de su carpeta. Es `numeric` y no
  -- `integer` porque llega fraccionario: se midió `12.5`, que es como el CRM inserta un campo
  -- entre otros dos sin renumerar todo.
  posicion  numeric not null default 0,

  visto_el  timestamptz not null default now(),

  primary key (org_id, campo_id),

  -- ── LA CARPETA, CON `org_id` DE LOS DOS LADOS ───────────────────────────
  --
  -- `aplicar_aislamiento` lo exige y explica por qué: la validación de una clave foránea no pasa
  -- por la seguridad a nivel de fila, así que sin el par una fila propia podría apuntar a la
  -- carpeta de otra organización.
  --
  -- El costo es un orden de escritura: la carpeta va antes que sus campos. Es correcto y es
  -- barato — la lectura del catálogo ya trae las dos cosas en la misma corrida.
  foreign key (org_id, carpeta_id) references negocio.carpetas_del_crm (org_id, carpeta_id)
    on delete cascade,

  constraint campos_del_crm_nombre_no_vacio
    check (btrim(nombre) <> ''),
  constraint campos_del_crm_etiqueta_no_vacia
    check (etiqueta_corta is null or btrim(etiqueta_corta) <> ''),
  constraint campos_del_crm_id_no_vacio
    check (btrim(campo_id) <> '')
);

comment on table negocio.campos_del_crm is
  'Espejo del catálogo de campos personalizados de GoHighLevel. Lo que se muestra lo decide la carpeta.';

-- La lectura del Perfil entra por acá: los campos de un contacto se buscan por sus carpetas.
create index if not exists campos_del_crm_por_carpeta
  on negocio.campos_del_crm (org_id, carpeta_id, posicion);

-- ── 4 · EL AISLAMIENTO ─────────────────────────────────────────────────────
--
-- El `drop policy if exists` va antes porque `aplicar_aislamiento` hace `create policy` a secas:
-- sobre una base que ya tiene la política, la migración moriría con un `42710` y —lo que importa—
-- **revertiría todas las migraciones pendientes de esa corrida**. Es la regla de reaplicabilidad
-- que la 024 escribió y que `pruebas/base/10-migraciones` comprueba.
drop policy if exists aislamiento on negocio.carpetas_del_crm;
select negocio.aplicar_aislamiento('negocio.carpetas_del_crm');

drop policy if exists aislamiento on negocio.campos_del_crm;
select negocio.aplicar_aislamiento('negocio.campos_del_crm');

-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · POR QUÉ LAS CUATRO CARPETAS **NO** SE SIEMBRAN ACÁ
--
-- La primera versión de este archivo terminaba con un `insert … select … from
-- identidad.organizaciones where es_principal` que ponía las cuatro. **Se aplicó a producción y
-- escribió cero filas, sin error.** Vale la pena dejar medido por qué, porque el mismo atajo va a
-- tentar a cualquiera que quiera sembrar datos por empresa:
--
--   · `identidad.organizaciones` tiene `force row level security` y sus políticas son para
--     `app_identidad` y `app_inquilino`. El migrador es el DUEÑO de la tabla, y `force` alcanza
--     también al dueño: sin política propia, **ve cero filas**. Medido el 2026-09-07.
--   · No puede esquivarlo: `rolsuper` y `rolbypassrls` en falso, y `set role app_identidad` le
--     responde `permission denied to set role`. Verificado contra la base real.
--   · Y aunque tuviera el identificador, tampoco podría escribir: `aplicar_aislamiento` deja estas
--     tablas con RLS forzada y una sola política, la de `app_inquilino`.
--
-- O sea que **ninguna migración de este proyecto puede sembrar datos por organización**, y el
-- síntoma es el peor posible: un `insert` que no inserta nada y una migración que informa éxito.
-- Es la explicación de algo que ya estaba a la vista y nadie había escrito — la 035 tampoco sembró
-- en SQL los diez enlaces de ARIA.
--
-- ── DÓNDE VIVE LA DECISIÓN, ENTONCES ──────────────────────────────────────
--
-- En `lib/ghl/contrato.ts`, con el resto de los literales de GoHighLevel, y la aplica la primera
-- lectura del catálogo —que corre como `app_inquilino`, dentro de `conOrganizacion(`—. Es el mismo
-- lugar donde ya viven los nombres de etiqueta, y por la misma razón que ese archivo declara: **un
-- solo lugar donde mirar** cuando algo no llega.
--
-- Se aplica SOLO al descubrir una carpeta por primera vez. Una carpeta que ya tiene fila conserva
-- su `grupo`, incluso si alguien lo puso en nulo a mano para esconderla: una decisión tomada en
-- producción no se revierte sola porque el código traiga otra opinión.
-- ═════════════════════════════════════════════════════════════════════════════
