-- El vínculo de un closer es por cliente, primera mitad: EXPANDIR. Las claves con el cliente, junto a las viejas.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C5 · G2, 2026-10-20)
--
-- `negocio.closer_asignado` guarda, por persona, UN usuario de GoHighLevel (`crm_usuario_id`, la `034`): los contactos
-- que el CRM le asignó a ese usuario son los de ese closer. Pero los usuarios del CRM son de cada SUBCUENTA, y cada
-- cliente tiene la suya: quien cierra para dos clientes es `uA` en la subcuenta de A y `uB` en la de B (o el mismo id
-- en las dos, si es un usuario de la agencia). Con una fila por persona cabe un solo vínculo, y su «mío» contaba sólo
-- los contactos de A.
--
-- La fila pasa a ser de (persona, cliente): la clave será (org_id, cuenta_id, usuario_id), y un usuario del CRM es de
-- un solo closer DENTRO de cada cliente. La `090` lo dejó escrito para esta tabla: «el día que sean por cliente,
-- cambian el escritor y la clave juntos».
--
-- ── NO HAY NADA QUE COPIAR ──────────────────────────────────────────────────
--
-- Desde la Fase 0 cada fila ya dice su cliente: la fase `cuenta-en-negocio` rellenó las viejas con la única cuenta de
-- su empresa, y el puente (`completar_cuenta`, 085) pone el principal en las que se designan con la empresa entera. El
-- vínculo de hoy YA ES el vínculo en el principal: ni relleno, ni fase, ni una lectura de respaldo.
--
-- ── EN DOS PASOS, COMO LA 090 Y LA 092 ──────────────────────────────────────
--
-- El código anterior escribe con `on conflict (org_id, usuario_id)`, y el de G2 con `on conflict (org_id, cuenta_id,
-- usuario_id)`. Esta migración agrega las claves nuevas como índices únicos SIN soltar las viejas: con la clave vieja
-- puesta cada persona tiene una sola fila, así que las nuevas se cumplen solas y los dos códigos escriben. La `097`
-- cierra, con G2 ya desplegado.
--
-- Los nombres son nuevos a propósito: con `if not exists` y un nombre ya tomado (`closer_asignado_por_cuenta` es el
-- índice no único de la `082`; `closer_por_usuario_del_crm`, el de la `034`), el índice se saltearía en silencio y
-- ningún `on conflict` lo encontraría.
--
-- REAPLICABLE: el índice de la clave se crea sólo mientras la clave primaria sea la vieja. La `097` lo vuelve la clave
-- primaria (`using index`) y con eso le cambia el nombre: reaplicar esta migración después, con un `if not exists`
-- solo, construiría un segundo índice con la misma clave que la primaria.
-- ═════════════════════════════════════════════════════════════════════════════

-- La clave de la fila: una por persona y cliente. La `097` la vuelve la clave primaria.
do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.closer_asignado'::regclass and conname = 'closer_asignado_pkey'))
     = 'PRIMARY KEY (org_id, usuario_id)' then
    create unique index if not exists closer_asignado_por_cliente
      on negocio.closer_asignado (org_id, cuenta_id, usuario_id);
  end if;
end $$;

-- Un usuario del CRM, un closer, dentro de cada cliente. El mismo id en dos subcuentas son dos vínculos: de dos
-- personas, o de la misma. Parcial por lo mismo que la `034`: «sin vincular» no compite.
create unique index if not exists closer_por_usuario_del_crm_en_el_cliente
  on negocio.closer_asignado (org_id, cuenta_id, crm_usuario_id)
  where crm_usuario_id is not null;

comment on index negocio.closer_por_usuario_del_crm_en_el_cliente is
  'Un usuario del CRM es de un solo closer dentro de cada cliente (el nivel 3): el mismo id en dos subcuentas son dos vínculos.';
