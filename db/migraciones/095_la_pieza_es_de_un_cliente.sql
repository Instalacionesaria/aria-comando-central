-- La pieza de Creative es de un cliente: su link manual pasa de (org_id, pieza) a (org_id, cuenta_id, pieza).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C5 · G1, 2026-10-20)
--
-- La pieza era el nombre del anuncio normalizado (`llaveDelCreativo`). Un nombre no identifica una pieza fuera de su
-- cuenta de Meta: los clientes de una empresa comparten la convención de nombres, y «hook 1» de un cliente no es
-- «hook 1» de otro. Desde este cambio la pieza es (cliente, nombre) en todo Creative, y su link manual también.
--
-- La `090` dejó esta tabla afuera a propósito: «el día que sean por cliente, cambian el escritor y la clave juntos».
-- Es este cambio. El escritor (`lib/negocio/enlaceDeLaPieza.ts`) escribe con `cuenta_id`, y su `on conflict` nombra
-- (org_id, cuenta_id, pieza).
--
-- SIN PERDER FILAS: `cuenta_id` es obligatoria desde la `083`, y cada link está en el único cliente de su empresa (lo
-- puso el puente). Si (org_id, pieza) era única, (org_id, cuenta_id, pieza) también lo es: la clave nueva se arma sin
-- conflicto y no hace falta una fase de datos. Ninguna clave foránea apunta a esta clave.
--
-- REAPLICABLE: la clave se cambia sólo si todavía es la vieja, mirando su definición, como la `092`. Sin
-- `create index if not exists`, porque un nombre ya tomado lo saltearía en silencio.
--
-- EL DESPLIEGUE: va junto con el código que escribe por la clave nueva. Entre los dos, un «Guardar» del link con el
-- código de antes da 42P10, porque su `on conflict (org_id, pieza)` ya no tiene un único que lo respalde; y al revés,
-- el código nuevo sobre la clave vieja, también. Es un botón de administración, y el nivel 3 sale entero.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.enlaces_de_pieza'::regclass and conname = 'enlaces_de_pieza_pkey'))
     = 'PRIMARY KEY (org_id, pieza)' then
    alter table negocio.enlaces_de_pieza drop constraint enlaces_de_pieza_pkey;
    alter table negocio.enlaces_de_pieza add constraint enlaces_de_pieza_pkey primary key (org_id, cuenta_id, pieza);
  end if;
end $$;

comment on constraint enlaces_de_pieza_pkey on negocio.enlaces_de_pieza is
  'Un link por pieza de un cliente (el nivel 3): la pieza es (cliente, nombre), y dos clientes de una empresa pueden tener una pieza con el mismo nombre.';
comment on column negocio.enlaces_de_pieza.pieza is
  'El nombre del anuncio normalizado (llaveDelCreativo). Con cuenta_id es la pieza: un nombre solo no la identifica fuera de su cliente.';
