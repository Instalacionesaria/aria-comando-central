-- El puntaje y el Perfil de cada cliente: cuál campo del CRM es su puntaje, y qué carpeta eligió una persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C6 · D4, 2026-10-20)
--
-- El puntaje del lead sale de un campo del CRM, y hasta acá se reconocía solo: por su id en la subcuenta de ARIA
-- (`CAMPO_DEL_PUNTAJE`) o por su nombre exacto, «Puntaje | ICP», en la de cada cliente. Las carpetas del Perfil, igual:
-- por su id o por su nombre al descubrirlas. Un cliente cuya subcuenta no nació del snapshot de ARIA —otros nombres—
-- no tenía puntaje ni Perfil, y nadie podía decir cuál era el suyo. Desde acá se elige, cliente por cliente, en
-- Ajustes › Clientes (`app/api/admin/cuentas/[id]/campos`), y lo de siempre queda como respaldo.
--
-- ── EN EL CATÁLOGO, Y NO EN LAS CREDENCIALES ────────────────────────────────
--
-- La fila del catálogo ya es de la subcuenta (`cuenta_id`, `082`), así que el campo elegido no puede ser de otro
-- cliente ni no existir. Todos los que leen el puntaje corren como inquilino, que ve esta tabla y no
-- `identidad.cuentas_credenciales`. El principal no tiene credenciales propias (son las de la empresa) y es justo el
-- que más puede necesitar elegir. Y la `039` ya separa en estas tablas lo que decide GoHighLevel —se pisa al
-- refrescar— de lo nuestro —`grupo`, `etiqueta_corta`—: las dos columnas nuevas son nuestras y el refresco no las pisa.
--
-- ── «NO ELEGIDO» ES LO DE HOY, Y POR ESO NO HAY RELLENO ─────────────────────
--
-- `false` en todos los campos de una subcuenta = el puntaje se reconoce como hasta acá. Una carpeta con
-- `grupo_elegido_el` nulo = su grupo lo puso el contrato. Así cada fila que ya existe queda exactamente como estaba, y
-- un relleno no hace falta (ni podría ir acá: el migrador no ve filas).
--
-- ── LO QUE NO LLEVA, A PROPÓSITO ────────────────────────────────────────────
--
-- Ningún `check (not es_el_puntaje or tipo = 'NUMERICAL')`. Si GoHighLevel cambia el tipo del campo, el `on conflict`
-- del refresco pisa `tipo` y fallaría con 23514: caería la tarea de contactos de esa subcuenta cada diez minutos. El
-- tipo se valida en la ruta al elegir, y la pantalla avisa si cambió después. Ningún cambio de política ni de
-- permisos: `aplicar_aislamiento` ya le da al inquilino lo que hace falta, y la política por cuenta de la `083` acota
-- la escritura al cliente enfocado.
--
-- REAPLICABLE: las columnas con `if not exists`; el índice se rehace sólo si su definición no es ésta, mirándola
-- como la `092`: un `create index if not exists` con el nombre ya tomado por otra cosa se saltearía en silencio.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · EL CAMPO DEL PUNTAJE, ELEGIDO ──────────────────────────────────────
--
-- Con un valor por omisión constante, desde PostgreSQL 11 no reescribe la tabla.
alter table negocio.campos_del_crm
  add column if not exists es_el_puntaje boolean not null default false;

comment on column negocio.campos_del_crm.es_el_puntaje is
  'El campo que esta subcuenta usa como puntaje del lead (0 a 100), elegido en Ajustes › Clientes. false en todos = se reconoce por id o por nombre (lib/negocio/camposDelCrm.ts). Es nuestra: el refresco del catálogo no la pisa.';

-- Uno por cliente. Parcial: los `false` no compiten. La organización primero, como toda clave de `negocio` (la `008`).
-- No es diferible, así que quien elige apaga el anterior antes de prender el nuevo (`elegirElPuntaje`).
do $$
declare
  esperada constant text :=
    'CREATE UNIQUE INDEX campos_del_crm_un_puntaje_por_cliente ON negocio.campos_del_crm USING btree (org_id, cuenta_id) WHERE es_el_puntaje';
begin
  if coalesce(pg_get_indexdef(to_regclass('negocio.campos_del_crm_un_puntaje_por_cliente')), '') <> esperada then
    drop index if exists negocio.campos_del_crm_un_puntaje_por_cliente;
    create unique index campos_del_crm_un_puntaje_por_cliente
      on negocio.campos_del_crm (org_id, cuenta_id) where es_el_puntaje;
  end if;
end $$;

comment on index negocio.campos_del_crm_un_puntaje_por_cliente is
  'Un solo campo elegido como puntaje por cliente. Dos elecciones al mismo tiempo: la segunda sale 23505, y la ruta la responde 409.';

-- ── 2 · LA CARPETA CUYO GRUPO ELIGIÓ UNA PERSONA ───────────────────────────
alter table negocio.carpetas_del_crm
  add column if not exists grupo_elegido_el timestamptz;

comment on column negocio.carpetas_del_crm.grupo_elegido_el is
  'Nulo = el grupo lo puso el contrato al descubrir la carpeta (por id o por nombre). Con fecha = lo eligió una persona en Ajustes › Clientes, y ningún refresco lo toca.';
