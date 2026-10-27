-- La foto de cada cliente dice si tiene Meta conectado, y su lista de chequeo lo exige (contrato 3).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (Meta directo, M4, 2026-10-26)
--
-- Desde Meta directo los costos, las campañas y los anuncios de cada cliente salen de SU conexión con Meta («Conectar
-- con Meta», `101`), y no del Ad Manager de su GoHighLevel. La lista de chequeo (`lib/cartera/pasos.ts`) cambia:
--
--   · `meta` pasa a ser «Meta conectado», REQUERIDO: al menos una cuenta publicitaria asignada al cliente y leída por
--     una conexión activa. Lo dice la configuración en vivo (`lib/cartera/configuracion.ts`);
--   · `meta_leido`, nueva: «Campañas leídas de Meta», recomendado y MEDIDO con el sello de su pasada de anuncios o su
--     gasto en la ventana (`metaLeidoDe`, `lib/cartera/medicion.ts`). Dice si la lectura anda, no si se conectó.
--     Reemplaza a `meta_en_el_crm` (la 099), que queda EN DESUSO y no se renombra: una columna nueva deja convivir al
--     código de antes de Meta directo (que escribe `meta_en_el_crm`) con el de ahora (que escribe `meta_leido`) mientras
--     se sube por tramos.
--
-- Cambian de significado `meta`, `configurada` y `faltan` del cliente, y `cuentas_configuradas` y `configurada` de la
-- empresa: el contrato sube a 3 y sus comentarios —el diccionario que lee el agente— dicen lo de hoy.
--
-- Sin relleno: las fotos de antes quedan con su contrato (1 o 2). Reaplicable: la columna con `if not exists`, y cada
-- comentario reemplaza al anterior.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.foto_de_las_cuentas add column if not exists meta_leido boolean;

comment on column negocio.foto_de_las_cuentas.meta is
  'Tiene Meta conectado (desde el contrato 3, requerido): al menos una cuenta publicitaria asignada al cliente y leída por una conexión activa de «Conectar con Meta». De ahí salen sus costos, sus campañas y sus anuncios. Hasta el contrato 2 era la conexión directa con un token pegado, sólo para las miniaturas.';
comment on column negocio.foto_de_las_cuentas.meta_leido is
  'Sus campañas se están leyendo de Meta (recomendado, contrato 3): el sello de su pasada de anuncios corrió sin que Meta rechazara la conexión, o, sin sello, hay gasto suyo en la ventana. Nulo = todavía no se sabe. Reemplaza a meta_en_el_crm desde el contrato 3.';
comment on column negocio.foto_de_las_cuentas.meta_en_el_crm is
  'EN DESUSO desde el contrato 3: Meta vinculado en su GoHighLevel (contrato 2). El código de hoy no la escribe; quedan las fotos de antes. Lo vigente es meta_leido.';
comment on column negocio.foto_de_las_cuentas.configurada is
  'Activo y con toda la lista de chequeo requerida en verde: CRM conectado, calendario, zona no UTC, nicho confirmado, datos de las últimas 24 horas y Meta conectado (este último, desde el contrato 3; en el 2 era Meta vinculado en su GoHighLevel).';
comment on column negocio.foto_de_las_cuentas.faltan is
  'Los pasos de la lista de chequeo que faltan, por clave (crm, calendario, zona, nicho, datos, meta, meta_leido, aviso). Lo que no se pudo medir no está: no se acusa.';
comment on column negocio.foto_de_las_cuentas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: configurada exige meta_en_el_crm, y faltan suma esa clave. 3: configurada exige meta (Meta conectado), meta_en_el_crm queda en desuso y la reemplaza meta_leido, recomendado.';
comment on column negocio.foto_de_las_empresas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: un cliente configurado exige Meta vinculado en su GoHighLevel. 3: un cliente configurado exige Meta conectado (cambian cuentas_configuradas y configurada).';
comment on column negocio.foto_de_las_empresas.cuentas_configuradas is
  'Clientes activos, no de prueba, con toda la lista de chequeo requerida en verde (lib/cartera/pasos.ts): desde el contrato 3, también Meta conectado.';
