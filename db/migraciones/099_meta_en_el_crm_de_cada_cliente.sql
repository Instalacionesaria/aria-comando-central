-- La foto de cada cliente dice si su GoHighLevel tiene Meta vinculado, y su lista de chequeo lo exige (contrato 2).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C6 · D5, 2026-10-20)
--
-- Los costos de cada cliente salen de SU GoHighLevel con Meta vinculado (la decisión del usuario del 2026-10-20): la
-- pasada del gasto (`anuncios`) lee la serie del Ad Manager de su subcuenta, y sin el vínculo no lee nada y lo deja
-- escrito en su sello. Un cliente así deja a toda su empresa sin costos en Acquisition, y la lista de chequeo lo daba
-- por «configurado»: su paso de Meta miraba la conexión DIRECTA con Meta, que sólo trae las miniaturas.
--
-- Desde acá la lista tiene los dos (`lib/cartera/pasos.ts`), y la foto —el contrato del agente— también:
--   · `meta_en_el_crm`, nueva: Meta vinculado en su GoHighLevel, REQUERIDO. Se mide con el sello de su pasada del gasto
--     o con su serie de gasto (`metaEnElCrmDe`, `lib/cartera/medicion.ts`); nulo = todavía no se sabe;
--   · `meta`, la de siempre: la conexión directa con Meta, recomendada, que ahora se llama «Miniaturas de Meta».
-- Con eso cambian de significado `configurada` y `faltan` del cliente, y `cuentas_configuradas` y `configurada` de la
-- empresa: el contrato sube a 2 (`lib/cartera/contrato.ts`), y sus comentarios —el diccionario que lee el agente—
-- dicen lo de hoy. La 271 exige que el comentario de `faltan` nombre exactamente las claves de la lista.
--
-- Sin relleno: las fotos de antes quedan con nulo (no se midió) y con su `contrato` = 1. Reaplicable: la columna con
-- `if not exists`, y cada comentario reemplaza al anterior.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.foto_de_las_cuentas add column if not exists meta_en_el_crm boolean;

comment on column negocio.foto_de_las_cuentas.meta_en_el_crm is
  'Su GoHighLevel tiene Meta vinculado, que es de donde salen sus costos (requerido desde el contrato 2). Lo dice el sello de su pasada del gasto (anuncios), y sin ese sello, su serie de gasto en la ventana. Nulo = todavía no se sabe (o no se midió): no cuenta como que falta.';
comment on column negocio.foto_de_las_cuentas.meta is
  'Tiene la conexión directa con Meta (su token y su cuenta publicitaria): trae las miniaturas y los activos de los anuncios. Recomendada, no requerida. No es de donde salen los costos: eso es meta_en_el_crm.';
comment on column negocio.foto_de_las_cuentas.configurada is
  'Activo y con toda la lista de chequeo requerida en verde: CRM conectado, calendario, zona no UTC, nicho confirmado, datos de las últimas 24 horas y Meta vinculado en su GoHighLevel (este último, desde el contrato 2).';
comment on column negocio.foto_de_las_cuentas.faltan is
  'Los pasos de la lista de chequeo que faltan, por clave (crm, calendario, zona, nicho, datos, meta_en_el_crm, meta, aviso). Lo que no se pudo medir no está: no se acusa.';
comment on column negocio.foto_de_las_cuentas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: configurada exige meta_en_el_crm, y faltan suma esa clave.';
comment on column negocio.foto_de_las_empresas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: un cliente configurado exige Meta vinculado en su GoHighLevel (cambian cuentas_configuradas y configurada).';
comment on column negocio.foto_de_las_empresas.cuentas_configuradas is
  'Clientes activos, no de prueba, con toda la lista de chequeo requerida en verde (lib/cartera/pasos.ts): desde el contrato 2, también Meta vinculado en su GoHighLevel.';
