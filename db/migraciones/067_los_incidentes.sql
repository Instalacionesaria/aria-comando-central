-- Los incidentes: cada vez que el modelo de IA falla para una organización, una fila.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- Pedido de Kevin el 2026-10-01: *«un panel de incidentes, que solo lo pueda ver yo… caso que algo
-- haya dado error, en alguna cuenta de nuestros clientes»*. Hasta acá un fallo dejaba una línea en
-- los registros de Vercel y nada más, así que la única forma de enterarse era que el cliente
-- escribiera «falló otra vez».
--
-- La fila la escribe `lib/incidentes/registro.ts`, desde el mismo punto que deja la línea de
-- registro (`lib/fundaciones/fallo-del-modelo.ts`), así que los dos dicen lo mismo y con la misma
-- referencia. Por ahora solo los fallos del modelo: es lo único clasificado.
--
-- ── EN `negocio`, CON `org_id` Y AISLADA ─────────────────────────────────────
--
-- Es un dato DE una organización —qué le falló a ella— y se escribe dentro de su contexto, igual
-- que cualquier otra fila de negocio. Quien cruza organizaciones es la ruta del panel, en un bucle
-- que abre el contexto de cada una (como `app/api/monitoreo/route.ts`), no una consulta.
--
-- ── LO QUE NO SE GUARDA ──────────────────────────────────────────────────────
--
-- Ni el prompt ni la respuesta (`ADR-0407`). `tecnico` es lo que dijo el proveedor o la red: un
-- código, un número y una frase sobre la PETICIÓN, nunca datos de terceros.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.incidentes (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  creado_el timestamptz not null default now(),
  -- La que vio la persona en pantalla. Corta y no única globalmente: sirve para buscar.
  ref text not null,
  situacion text not null check (situacion ~ '^IA-[A-Z-]+$'),
  -- `generar`, `conversar`, `rellenar`, `espia`.
  origen text not null,
  -- «Research paso 1», «herramienta 3». NULL cuando el camino no lo sabe.
  donde text,
  -- Quién lo vio. NULL cuando el camino no lo sabe (el Espía, por ejemplo).
  usuario_id uuid references identidad.usuarios(id),
  tecnico text not null,
  -- El reintento automático lo arregló: la persona no vio nada. Se guarda igual, para ver si el
  -- proveedor falla seguido aunque nadie se queje.
  salvado boolean not null default false,
  revisado_el timestamptz,
  revisado_por uuid references identidad.usuarios(id),
  primary key (org_id, id)
);

create index if not exists incidentes_por_fecha on negocio.incidentes (org_id, creado_el desc);

comment on table negocio.incidentes is
  'Cada fallo del modelo de IA de una organización, con la misma referencia que vio la persona y que quedó en el registro del servidor. La escribe lib/incidentes/registro.ts; la lee el Panel de Incidentes.';
comment on column negocio.incidentes.salvado is
  'true cuando el reintento automático lo arregló y la persona no vio el error.';

drop policy if exists aislamiento on negocio.incidentes;
select negocio.aplicar_aislamiento('negocio.incidentes');

-- La pestaña nueva, para que sea expresable como alcance. Concederla a una persona restringida no
-- le da el panel: el rol `usuario` no tiene `incidentes.ver` (ver `db/arranque/001_catalogo.sql`).
alter table identidad.usuarios_secciones
  drop constraint if exists usuarios_secciones_seccion_check;

alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer', 'analizadores', 'tools', 'monitoreo',
    'incidentes'
  ));
