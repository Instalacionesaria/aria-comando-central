-- El índice por `alta_en_el_crm`, que la `048` dejó escrito como deuda y hoy tiene tres consumidores.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA `048` NO SE OLVIDÓ: DECIDIÓ ESPERAR, Y DIJO CUÁNDO
--
-- Su sección 4 se llama «NINGÚN ÍNDICE, TODAVÍA» y dice por qué:
--
--   *«No se crea ninguno: no hay una sola consulta escrita que filtre por estas columnas. El día
--    que una cohorte se arme por `alta_en_el_crm` hará falta `(org_id, alta_en_el_crm)`, y ese día
--    se agrega con la consulta que lo justifica al lado. Un índice sin consumidor es peso en cada
--    escritura del barrido —584 contactos cada 10 minutos— a cambio de nada.»*
--
-- Ese día llegó. Las consultas que lo justifican, las tres escritas después de la `048`:
--
--     lib/negocio/costoDelAnuncio.ts      `leadsPorAnuncio`      y `coberturaDeAdId`
--     lib/negocio/calidadDeLaAtribucion.ts  los cinco puntos del § 18.14
--     lib/negocio/atribucionDelLead.ts    `cortePor` y `fueraDeHorario`
--
-- Las cinco recortan por `alta_en_el_crm >= <una ventana>` y agrupan después. Sin índice, cada una
-- recorre los contactos de la organización enteros antes de filtrar.
--
-- ── Y EL COSTO DE ESCRITURA QUE LA `048` TEMÍA SIGUE AHÍ, MEDIDO ───────────
--
-- Es real y hay que ponerlo al lado del beneficio: el barrido hace `on conflict do update` sobre los
-- 584 contactos cada diez minutos, y cada índice más es trabajo en cada una de esas filas.
--
-- Lo que lo hace valer la pena ahora y no antes es que **son cinco lecturas y no cero**, y que dos
-- de ellas están en el camino de una pantalla que alguien abre y espera. La columna además **no la
-- toca el `do update`** —`alta_en_el_crm` se escribe una vez, en el alta— así que el índice no se
-- reordena en las pasadas del cron: sólo crece con los contactos nuevos.
--
-- ── POR QUÉ NO LLEVA `include` NI ES PARCIAL ──────────────────────────────
--
-- Sin `include`: las cinco consultas leen columnas distintas después de filtrar —`atribucion_primera`
-- entera en tres de ellas, que es un `jsonb`— y un índice que las cubriera sería casi una copia de
-- la tabla.
--
-- Sin `where`: no hay ningún subconjunto estable que se pueda excluir. `contactos_buzon` sí es
-- parcial porque su pregunta sólo existe para los que tienen `ultimo_entrante_el`; acá la ventana se
-- mueve todos los días y cualquier corte quedaría viejo.
-- ═════════════════════════════════════════════════════════════════════════════

-- `org_id` primero, que es lo que la `031` exige de toda forma de esta base y lo que hace que la
-- lectura vaya directo a las filas de una organización en vez de recorrerlas todas antes de filtrar.
-- `desc` en la fecha: las cinco consultas piden una ventana que TERMINA hoy, así que el extremo por
-- el que entran es el más nuevo.
create index if not exists contactos_por_alta
  on negocio.contactos (org_id, alta_en_el_crm desc);

comment on index negocio.contactos_por_alta is
  'La cohorte por fecha de alta. Consumidores: costoDelAnuncio, calidadDeLaAtribucion y atribucionDelLead. Lo prometio la migracion 048 seccion 4.';
