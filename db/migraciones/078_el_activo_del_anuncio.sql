-- La miniatura y el post de cada anuncio, leídos de Meta con el token de la empresa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ HACE FALTA (`docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md`, etapa M-2 del 2026-10-15)
--
-- GoHighLevel no tiene el creativo de los anuncios creados en el Business Manager (`docs/creative/14`, C14-16 a C14-22),
-- y la imagen que sí da por contacto (`miniaturas_del_contacto`, 077) llega sólo con los leads de un anuncio de
-- Instagram que abre un DM: medido el 2026-10-15, 3 contactos de 526, una sola pieza con miniatura en 30 días. Meta
-- entrega la miniatura de TODO anuncio, tenga o no contactos, con el token que una persona del equipo carga en Ajustes.
--
-- Una fila por anuncio leído, también sin miniatura (`motivo`): es lo que evita volver a pedirlo en cada pasada.
--
-- ── LA MINIATURA VENCE ──────────────────────────────────────────────────────────
-- Las URLs del CDN de Meta van firmadas, con su vencimiento en el parámetro `oe` (hexadecimal, segundos Unix).
-- `miniatura_caduca_el` lo guarda, y una miniatura vencida no se dibuja: la tarea `activos` corre cada hora y vuelve a
-- pedir las que están por vencer. Así no hace falta saber de antemano cuánto dura la firma (`C15-P02`).
--
-- La escribe sólo `lib/negocio/recolectarActivos.ts` (la prueba 256).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.activos_de_anuncio (
  org_id uuid not null references identidad.organizaciones(id),
  meta_anuncio_id text not null,
  -- El creativo del anuncio en Meta. NULL = el anuncio no se pudo leer (ver `motivo`).
  meta_creativo_id text,
  -- `object_type` del creativo: VIDEO, PHOTO, SHARE, STATUS… Tal como llega.
  tipo_de_objeto text,
  miniatura_url text,
  miniatura_caduca_el timestamptz,
  -- El post del anuncio en Instagram o en Facebook, para «Ver en Facebook/Instagram».
  publicacion_url text,
  -- Por qué no hay miniatura: el anuncio no tiene creativo, es de otra cuenta, Meta no lo encuentra, o el creativo no
  -- trae imagen. NULL = se leyó bien.
  motivo text,
  leido_el timestamptz not null default now(),
  primary key (org_id, meta_anuncio_id),
  foreign key (org_id, meta_anuncio_id) references negocio.anuncios (org_id, meta_anuncio_id) on delete cascade
);

alter table negocio.activos_de_anuncio drop constraint if exists activos_de_anuncio_urls;
alter table negocio.activos_de_anuncio add constraint activos_de_anuncio_urls
  check ((miniatura_url is null or (miniatura_url like 'https://%' and length(miniatura_url) <= 2000))
     and (publicacion_url is null or (publicacion_url like 'https://%' and length(publicacion_url) <= 500)));
alter table negocio.activos_de_anuncio drop constraint if exists activos_de_anuncio_motivo;
alter table negocio.activos_de_anuncio add constraint activos_de_anuncio_motivo
  check (motivo is null or motivo in ('sin_creativo', 'cuenta_ajena', 'no_existe', 'sin_miniatura'));
alter table negocio.activos_de_anuncio drop constraint if exists activos_de_anuncio_vence_con_miniatura;
alter table negocio.activos_de_anuncio add constraint activos_de_anuncio_vence_con_miniatura
  check ((miniatura_url is null) = (miniatura_caduca_el is null));

comment on table negocio.activos_de_anuncio is
  'La miniatura y el post de cada anuncio, leídos de Meta con el token de la empresa (078). Una fila por anuncio leído, también sin miniatura (motivo). La escribe sólo lib/negocio/recolectarActivos.ts.';
comment on column negocio.activos_de_anuncio.miniatura_caduca_el is
  'Cuándo vence la firma de miniatura_url (el parámetro oe del CDN de Meta). Una miniatura vencida no se dibuja; la tarea activos la vuelve a pedir antes.';
comment on column negocio.activos_de_anuncio.publicacion_url is
  'El post del anuncio: el permalink de Instagram o el post de la Página en Facebook. Lo abre «Ver en Facebook/Instagram».';
comment on column negocio.activos_de_anuncio.motivo is
  'Por qué no hay miniatura: sin_creativo, cuenta_ajena (el token ve un anuncio de otra cuenta), no_existe (Meta no lo encuentra) o sin_miniatura (el creativo no trae imagen). NULL = se leyó bien.';

drop policy if exists aislamiento on negocio.activos_de_anuncio;
select negocio.aplicar_aislamiento('negocio.activos_de_anuncio');

-- La tarea horaria que trae los activos de Meta.
alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores', 'reintentos', 'senales', 'anuncios_relleno', 'activos'));
