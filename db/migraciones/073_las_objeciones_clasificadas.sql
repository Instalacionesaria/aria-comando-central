-- La categoría de cada objeción de una llamada de venta analizada (AG11 de los agentes;
-- `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`, `T-18`).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ GUARDA, Y QUÉ NO
--
-- El análisis HT guarda cada objeción como texto libre (`analizador_analisis.analisis -> seller -> objections`).
-- Haiku le pone una categoría de un juego cerrado —precio, momento, decisor, confianza, encaje, otra— una vez,
-- en la tarea del analizador, y acá queda la categoría, el modelo y la fecha. **El texto de la objeción no se
-- copia**: sigue viviendo en el análisis, que es su único escritor; esta tabla lo nombra por su posición y por
-- la huella de su texto.
--
-- ── LA HUELLA, Y POR QUÉ ──────────────────────────────────────────────────────
--
-- `huella` = `md5` del texto de la objeción. Si la llamada se vuelve a analizar, las objeciones pueden cambiar
-- de texto o de orden, y una categoría guardada por posición quedaría pegada a otra objeción sin que nada lo
-- diga. Con la huella, la categoría sólo vale mientras el texto sea el mismo: si cambió, la tarea la vuelve a
-- clasificar y la reemplaza.
--
-- ── POR RECONCILIACIÓN ────────────────────────────────────────────────────────
--
-- La tarea clasifica lo que falta —sin fila, o con una huella vieja—, así una clasificación que falló se
-- reintenta sola en la corrida siguiente. Escritor único: `lib/analizadores/objeciones.ts`.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.objeciones_clasificadas (
  org_id uuid not null references identidad.organizaciones(id),
  llamada_id uuid not null,
  -- La posición en `seller.objections`, desde 0.
  indice smallint not null check (indice >= 0),
  huella text not null check (huella ~ '^[0-9a-f]{32}$'),
  categoria text not null check (categoria in ('precio', 'momento', 'decisor', 'confianza', 'encaje', 'otra')),
  modelo text not null,
  clasificada_el timestamptz not null default now(),
  primary key (org_id, llamada_id, indice),
  -- Cae con su llamada, como el análisis del que sale.
  foreign key (org_id, llamada_id) references negocio.analizador_llamadas (org_id, id) on delete cascade
);

comment on table negocio.objeciones_clasificadas is
  'La categoría de cada objeción de una llamada de venta analizada, con la huella de su texto. La escribe sólo lib/analizadores/objeciones.ts.';

drop policy if exists aislamiento on negocio.objeciones_clasificadas;
select negocio.aplicar_aislamiento('negocio.objeciones_clasificadas');
