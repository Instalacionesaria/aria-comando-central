-- El cliente en Acquisition: la señal de un cliente, y el funnel en la cuenta de su campaña (el nivel 3, frente G3).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, 2026-10-19)
--
-- Dos cosas que suponían una sola cuenta de Meta por empresa:
--
--   1. «Sin entrega» es de una cuenta publicitaria, y cada cliente tiene la suya. Con un cliente, la cuenta de la
--      empresa es la de su cliente y la señal sigue siendo de la `empresa`. Con dos o más, la crítica es la del cliente
--      cuyas campañas no entregan aunque las del otro sí: la entidad `cliente` (su id de `identidad.cuentas`), que el
--      juego cerrado de la `072` no tenía (AG-21). La usa también el gasto sin crecimiento agregado por cliente.
--   2. El funnel de una campaña de otro cliente quedaba en el principal: `asignarFunnel` insertaba sin cuenta bajo la
--      empresa entera, y el puente (`085`) ponía el cliente por omisión. El código ahora escribe la cuenta de la campaña;
--      esta foránea hace que la base lo exija: el funnel de una campaña vive en la cuenta de su campaña, como la métrica
--      en la de su anuncio (`083`). Un insert sin cuenta para la campaña de otro cliente falla con `23503` en vez de
--      quedar mal archivado en silencio.
--
-- Con un solo cliente no cambia nada: la entidad nueva no se usa, y el funnel ya está en la única cuenta.
--
-- Si una base LOCAL tiene un funnel mal archivado (asignado antes de este arreglo a la campaña de otro cliente), la
-- foránea falla al migrar, todo en una transacción y sin dejar nada a medias. Se encuentra con
--   select f.org_id, f.meta_campana_id, f.cuenta_id as del_funnel, k.cuenta_id as de_la_campana
--     from negocio.funnels_de_campana f
--     join negocio.campanas k on k.org_id = f.org_id and k.meta_campana_id = f.meta_campana_id
--    where k.cuenta_id <> f.cuenta_id;
-- y se borra y se vuelve a asignar desde la pantalla (la cuenta de una fila no se cambia: `completar_cuenta`).
-- Producción no puede tenerlo: no tiene el nivel 3, y cada empresa tiene un solo cliente.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · La entidad `cliente` en el juego cerrado (molde: el `check` de las tareas en la 089) ───────────────

alter table negocio.senales drop constraint if exists senales_entidad_tipo_check;
alter table negocio.senales add constraint senales_entidad_tipo_check check (entidad_tipo in (
  'campana', 'conjunto', 'anuncio', 'pieza', 'funnel', 'par_de_etapas', 'familia_de_entrada',
  'patron', 'agente', 'closer', 'llamada', 'empresa', 'cliente'));

comment on constraint senales_entidad_tipo_check on negocio.senales is
  'El juego cerrado de entidades (AG-21). cliente = un cliente de la empresa por su id de identidad.cuentas: lo que es de toda una cuenta publicitaria cuando la empresa tiene varios (el nivel 3).';

-- ─── 2 · El funnel, en la cuenta de su campaña (molde: anuncios_cuenta_id_unico de la 083) ─────────────────

-- Sólo si falta: de esta restricción depende la foránea de abajo, y un `drop … if exists` fallaría al reaplicar.
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'campanas_cuenta_id_unico' and conrelid = 'negocio.campanas'::regclass) then
    alter table negocio.campanas add constraint campanas_cuenta_id_unico unique (org_id, cuenta_id, meta_campana_id);
  end if;
end $$;

-- La de la 066 (org_id, meta_campana_id) se queda: dice que la campaña existe. Ésta dice que es la misma cuenta.
alter table negocio.funnels_de_campana drop constraint if exists funnels_de_campana_misma_cuenta_que_la_campana;
alter table negocio.funnels_de_campana add constraint funnels_de_campana_misma_cuenta_que_la_campana
  foreign key (org_id, cuenta_id, meta_campana_id)
  references negocio.campanas (org_id, cuenta_id, meta_campana_id) on delete cascade;

comment on constraint funnels_de_campana_misma_cuenta_que_la_campana on negocio.funnels_de_campana is
  'El funnel de una campaña vive en la cuenta (el cliente) de su campaña: con dos clientes, el puente lo dejaba en el principal (el nivel 3).';
