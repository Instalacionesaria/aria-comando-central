-- El link manual de una pieza de Creative: el respaldo del video (docs/creative/15, C15-06).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- QUÉ ES, Y POR QUÉ POR PIEZA Y NO POR ANUNCIO
--
-- La miniatura y el video de cada anuncio van a salir de Meta directo (`15`, `C15-08`). Para la pieza
-- cuyo video Meta no entregue, alguien puede pegar el link del post o del reel, y la pantalla lo
-- ofrece como «Ver en Facebook / Instagram». Es un ENLACE: nunca se reproduce ni se embebe.
--
-- Es por PIEZA porque así lo carga una persona: mira la pieza en Creative, que es un nombre, y no
-- sabe cuál de sus hasta seis anuncios es cuál. Y porque la pieza es la unidad de la pantalla
-- (`lib/negocio/creativo.ts`).
--
-- ── LA PIEZA SE GUARDA NORMALIZADA, Y LA BASE LO HACE CUMPLIR ───────────────
--
-- La pieza es `lower(btrim(nombre))` del anuncio, y esa expresión existe UNA vez en el código:
-- `llaveDelCreativo`. El `check` de abajo es la misma expresión, así que una fila con «Hook 1» y otra
-- con «hook 1 » no pueden coexistir como dos piezas: la segunda ni se guarda. Sin esto, un link
-- cargado con la mayúscula del nombre original quedaría huérfano sin ningún error — la pantalla lo
-- buscaría por la llave normalizada y no lo encontraría.
--
-- ── `https://`, Y ACÁ ADEMÁS DE EN LA RUTA ─────────────────────────────────
--
-- La ruta valida de verdad —parsea la URL y exige un host de Facebook o Instagram,
-- `lib/negocio/urlExterna.ts`— y devuelve un motivo legible. El `check` es lo único que también
-- cubre una escritura que no pase por la ruta, y es el mismo criterio que `035_enlaces_de_pago.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.enlaces_de_pieza (
  org_id uuid not null references identidad.organizaciones(id),

  -- La llave de la pieza: el nombre del anuncio, normalizado. Ver el encabezado.
  pieza text not null,

  url text not null,

  actualizado_el   timestamptz not null default now(),
  -- `null` cuando lo cargó un rol de plataforma mirando otra organización: la foránea compuesta
  -- exige un usuario de ESTA organización (`autorDelCambio`, `lib/autorizacion/sesion.ts`).
  actualizado_por  uuid,

  primary key (org_id, pieza),

  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);

alter table negocio.enlaces_de_pieza drop constraint if exists enlaces_de_pieza_pieza_normalizada;
alter table negocio.enlaces_de_pieza add constraint enlaces_de_pieza_pieza_normalizada
  check (pieza = lower(btrim(pieza)) and pieza <> '');

alter table negocio.enlaces_de_pieza drop constraint if exists enlaces_de_pieza_https;
alter table negocio.enlaces_de_pieza add constraint enlaces_de_pieza_https
  check (url like 'https://%' and length(url) <= 500);

drop policy if exists aislamiento on negocio.enlaces_de_pieza;
select negocio.aplicar_aislamiento('negocio.enlaces_de_pieza');
