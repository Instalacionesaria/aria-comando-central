-- El vínculo de un closer es por cliente, segunda mitad: CERRAR. La clave por cliente pasa a ser LA clave.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C5 · G2, 2026-10-20)
--
-- La `096` EXPANDIÓ: la clave (org_id, cuenta_id, usuario_id) y el único del vínculo por cliente, junto a las viejas.
-- Mientras convivan, la clave vieja (org_id, usuario_id) sigue siendo única: una persona no puede tener fila en dos
-- clientes, y el closer de dos clientes no se puede vincular en el segundo. Esta migración CIERRA, igual que la `092`:
--
--   · la clave primaria pasa a ser la del cliente, armada con el índice de la `096` (`using index`), que pasa a
--     llamarse como la clave: no se construye dos veces;
--   · el único de la `034` (un usuario del CRM por EMPRESA) se va: era la regla de una sola subcuenta, y ahora es por
--     cliente (el índice de la `096`);
--   · y el índice no único (org_id, cuenta_id) de la `082` se va también: es un prefijo de la clave nueva, que ya lo
--     sirve. Ninguna prueba ni consulta lo nombra (comprobado el 2026-10-20).
--
-- **Va después de G2 desplegado**: el `asignarCloser` anterior escribe con `on conflict (org_id, usuario_id)`, y sin
-- ese único cada designación sería un 42P10. Por lo mismo, una vez aplicada no se vuelve a un despliegue anterior a G2,
-- ni con un rollback de Vercel. Ninguna lectura dependía de la clave.
--
-- Reaplicable: el paso de la clave mira primero cómo está, y uno ya hecho no se repite; los `drop index` llevan
-- `if exists`. Ninguna clave foránea apunta a la clave de esta tabla (comprobado en `pg_constraint` el 2026-10-20).
-- `cuenta_id` es not null desde la `083`, que es lo que `using index` exige de una clave primaria. Ninguna de las dos
-- migraciones puede fallar por datos: la clave vieja y el único viejo son más estrictos que los nuevos.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.closer_asignado'::regclass and conname = 'closer_asignado_pkey'))
     = 'PRIMARY KEY (org_id, usuario_id)' then
    alter table negocio.closer_asignado drop constraint closer_asignado_pkey;
    alter table negocio.closer_asignado
      add constraint closer_asignado_pkey primary key using index closer_asignado_por_cliente;
  end if;
end $$;

-- Un usuario del CRM por EMPRESA era la regla de una sola subcuenta. Ahora es por cliente (el índice de la 096).
drop index if exists negocio.closer_por_usuario_del_crm;

-- Prefijo de la clave nueva: la clave lo sirve.
drop index if exists negocio.closer_asignado_por_cuenta;

comment on table negocio.closer_asignado is
  'Los closers de la empresa y su vínculo con el CRM: una fila por persona y cliente (el nivel 3). Ser closer = tener alguna fila; el vínculo en un cliente = crm_usuario_id de la fila de ese cliente (nulo o sin fila = sin vincular ahí). El tope de tres cuenta personas (lib/negocio/closer.ts).';
comment on column negocio.closer_asignado.crm_usuario_id is
  'El usuario de GoHighLevel de la subcuenta de ESTE cliente: los contactos de este cliente con ese crm_asignado_a son de esta persona. Nulo = designado y sin vincular en este cliente.';
comment on constraint closer_asignado_pkey on negocio.closer_asignado is
  'Una fila por persona y cliente: el vínculo con el usuario del CRM es de cada subcuenta (el nivel 3, C5 · G2).';

-- Orden en producción: 096 → desplegar G2 → 097, como 090 → C3 → 092. Comprobación previa sólo por tranquilidad, con
-- `supabase.mjs leer` (el migrador no ve filas): ninguna fila de closer_asignado fuera de la cuenta por omisión de su
-- empresa (hoy cada empresa tiene un solo cliente).
