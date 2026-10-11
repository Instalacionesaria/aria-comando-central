-- Lo que GoHighLevel devuelve del anuncio de un contacto sólo cuando se lo pide por separado.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ UNA TABLA Y NO UNA CLAVE MÁS EN `atribucion_primera`
--
-- Medido el 2026-10-11 (`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, § 2): `GET /contacts/{id}` trae en
-- `attributionSource` un `videoUrl` —la imagen del anuncio por el que llegó el contacto—, más `photoUrl`, `postId` e
-- `igSid`. `POST /contacts/search`, que es lo que usa la sincronización, no los trae. Y la sincronización PISA
-- `atribucion_primera` en cada pasada (`lib/negocio/sincronizar.ts`): una clave sumada ahí se borraría a los diez
-- minutos. Por eso lo que trae el pedido por contacto vive aparte, con cuándo se leyó.
--
-- Una fila por contacto pedido, también cuando GoHighLevel no tenía nada que devolver (`encontrado = false` o las
-- cuatro columnas en NULL): es lo que evita volver a pedir el mismo contacto en cada pasada.
--
-- La escribe sólo `lib/negocio/miniaturaDelContacto.ts` (la prueba 253).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.miniaturas_del_contacto (
  org_id uuid not null references identidad.organizaciones(id),
  contacto_id uuid not null,
  -- `false` = GoHighLevel no devolvió el contacto: un 404, una respuesta sin contacto, o un rechazo de ese contacto
  -- (un 403 o un 4xx que no sea el cupo; desde CF-4, `lib/negocio/miniaturaDelContacto.ts`). No se vuelve a pedir.
  encontrado boolean not null,
  -- Las cuatro claves, tal como llegan. NULL = la respuesta no la traía.
  video_url text,
  photo_url text,
  post_id text,
  ig_sid text,
  leido_el timestamptz not null default now(),
  primary key (org_id, contacto_id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade
);

alter table negocio.miniaturas_del_contacto drop constraint if exists miniaturas_del_contacto_https;
alter table negocio.miniaturas_del_contacto add constraint miniaturas_del_contacto_https
  check ((video_url is null or (video_url like 'https://%' and length(video_url) <= 2000))
     and (photo_url is null or (photo_url like 'https://%' and length(photo_url) <= 2000)));

comment on table negocio.miniaturas_del_contacto is
  'Lo que GET /contacts/{id} de GoHighLevel trae del anuncio de un contacto y POST /contacts/search no: videoUrl, photoUrl, postId e igSid. Una fila por contacto pedido, tambien sin dato. La escribe solo lib/negocio/miniaturaDelContacto.ts (077).';

drop policy if exists aislamiento on negocio.miniaturas_del_contacto;
select negocio.aplicar_aislamiento('negocio.miniaturas_del_contacto');
