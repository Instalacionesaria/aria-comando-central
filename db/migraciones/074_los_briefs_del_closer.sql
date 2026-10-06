-- El Brief del closer: la preparación de cada cita (AG12 de los agentes;
-- `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`, `D-19`).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- UNA FILA POR CITA, Y CAE CON ELLA
--
-- El Brief se genera al abrir la cita y se guarda: no se regenera solo. La fila guarda las cuatro secciones
-- ya validadas (cada dato con su fuente, AG-F13-1), con qué modelo y cuándo, quién lo pidió, si el contacto
-- no tenía formulario (AG-F13-3), y la **huella de lo que leyó**: si el formulario cambió o hay una llamada
-- nueva, la huella de hoy no coincide y la pantalla dice «hay datos nuevos · regenerar» (AG-F13-2).
--
-- Guarda datos de una persona —lo que dijo en su formulario, en palabras del modelo—, así que vive en
-- `negocio`, con el aislamiento de todas, y cae con su cita. Escritor único: `lib/agentes/brief/guardar.ts`.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.briefs_del_closer (
  org_id uuid not null references identidad.organizaciones(id),
  cita_id uuid not null,
  brief jsonb not null,
  sin_formulario boolean not null,
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  modelo text not null,
  generado_el timestamptz not null default now(),
  -- Quién lo pidió. `set null` con la lista de columnas: se borra la persona y el Brief sigue.
  generado_por uuid,
  primary key (org_id, cita_id),
  foreign key (org_id, cita_id) references negocio.citas (org_id, id) on delete cascade,
  foreign key (org_id, generado_por) references identidad.usuarios (org_id, id) on delete set null (generado_por)
);

comment on table negocio.briefs_del_closer is
  'El Brief de cada cita, con la huella de lo que leyó. Cae con su cita. La escribe sólo lib/agentes/brief/guardar.ts.';

drop policy if exists aislamiento on negocio.briefs_del_closer;
select negocio.aplicar_aislamiento('negocio.briefs_del_closer');
