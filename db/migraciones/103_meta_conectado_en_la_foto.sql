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
--   · `meta_en_el_crm` (la 099) se renombra `meta_leido`: «Campañas leídas de Meta», recomendado y MEDIDO con el sello
--     de su pasada de anuncios o su gasto en la ventana (`metaLeidoDe`, `lib/cartera/medicion.ts`). Dice si la lectura
--     anda, no si se conectó.
--
-- Cambian de significado `meta`, `configurada` y `faltan` del cliente, y `cuentas_configuradas` y `configurada` de la
-- empresa: el contrato sube a 3 y sus comentarios —el diccionario que lee el agente— dicen lo de hoy.
--
-- Sin relleno: las fotos de antes quedan con su contrato (1 o 2). Reaplicable: el renombre mira si la columna vieja
-- existe, y cada comentario reemplaza al anterior.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'negocio' and table_name = 'foto_de_las_cuentas' and column_name = 'meta_en_el_crm') then
    alter table negocio.foto_de_las_cuentas rename column meta_en_el_crm to meta_leido;
  end if;
end $$;

comment on column negocio.foto_de_las_cuentas.meta is
  'Tiene Meta conectado (desde el contrato 3, requerido): al menos una cuenta publicitaria asignada al cliente y leída por una conexión activa de «Conectar con Meta». De ahí salen sus costos, sus campañas y sus anuncios. Hasta el contrato 2 era la conexión directa con un token pegado, sólo para las miniaturas.';
comment on column negocio.foto_de_las_cuentas.meta_leido is
  'Sus campañas se están leyendo de Meta (recomendado, contrato 3): el sello de su pasada de anuncios corrió sin que Meta rechazara la conexión, o, sin sello, hay gasto suyo en la ventana. Nulo = todavía no se sabe. Hasta el contrato 2 se llamaba meta_en_el_crm y decía si su GoHighLevel tenía Meta vinculado.';
comment on column negocio.foto_de_las_cuentas.configurada is
  'Activo y con toda la lista de chequeo requerida en verde: CRM conectado, calendario, zona no UTC, nicho confirmado, datos de las últimas 24 horas y Meta conectado (este último, desde el contrato 3; en el 2 era Meta vinculado en su GoHighLevel).';
comment on column negocio.foto_de_las_cuentas.faltan is
  'Los pasos de la lista de chequeo que faltan, por clave (crm, calendario, zona, nicho, datos, meta, meta_leido, aviso). Lo que no se pudo medir no está: no se acusa.';
comment on column negocio.foto_de_las_cuentas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: configurada exige meta_en_el_crm, y faltan suma esa clave. 3: configurada exige meta (Meta conectado), meta_en_el_crm pasa a llamarse meta_leido y es recomendado.';
comment on column negocio.foto_de_las_empresas.contrato is
  'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna. 1: la de la 089. 2: un cliente configurado exige Meta vinculado en su GoHighLevel. 3: un cliente configurado exige Meta conectado (cambian cuentas_configuradas y configurada).';
comment on column negocio.foto_de_las_empresas.cuentas_configuradas is
  'Clientes activos, no de prueba, con toda la lista de chequeo requerida en verde (lib/cartera/pasos.ts): desde el contrato 3, también Meta conectado.';
