-- 108 · La baja en el CRM: un contacto o una cita que GoHighLevel borró queda MARCADO, nunca borrado.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (las filas viejas, 2026-10-29)
--
-- Medido en producción el 2026-10-29: 41 contactos congelados que nadie relee (el más viejo, 65,7 días sin leer) y 4
-- citas dentro de la ventana del barrido que dejaron de releerse a la vez que su contacto. O GoHighLevel las borró, o
-- las devuelve con `deleted: true` y el barrido las salteaba: en los dos casos la fila se quedaba con su último estado
-- para siempre y las cifras la contaban como viva.
--
-- La decisión del usuario: MARCAR, no borrar. Borrar un contacto arrastraría en cascada sus mensajes, sus notas y sus
-- resultados —un trabajo que sí ocurrió—. Así que una columna nula con la fecha en que se vio la baja:
--
--   · `negocio.contactos.baja_en_el_crm`: la pone un 404 de `GET /contacts/{id}` (la relectura de los congelados de
--     `lib/negocio/sincronizar.ts` y el refresco de la ficha). SÓLO un 404: otro rechazo no dice nada del contacto.
--   · `negocio.citas.baja_en_el_crm`: la pone el barrido de `lib/negocio/citas.ts` cuando la cita ya guardada vuelve
--     con `deleted: true`, o cuando falta en un barrido completo y su GET lo confirma (404 o `deleted: true`).
--
-- Las dos las vuelve a nulo `guardar()` si el CRM la devuelve viva. Ninguna escribe eventos: la baja es la columna
-- con su fecha (la `332` sigue con un solo escritor de `negocio.eventos`, la `106`).
--
-- QUIÉN LA LEE: `alcanzable()` de `lib/negocio/citasAlcanzables.ts` deja afuera las citas con baja (salen de todas las
-- cifras); los contactos con baja siguen contando como entradas en las cohortes y salen de las colas de trabajo.
--
-- REAPLICABLE: `add column if not exists` e índices parciales con `if not exists` y nombres nuevos (comprobado contra
-- `pg_index`: ningún índice de `negocio` se llama así). Sin relleno: el migrador no ve filas (la RLS forzada) y una
-- columna nula es exactamente «no se vio ninguna baja».
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.contactos add column if not exists baja_en_el_crm timestamptz;
comment on column negocio.contactos.baja_en_el_crm is
  'Cuándo se vio que GoHighLevel ya no tiene este contacto (un 404 de GET /contacts/{id}, la 108). Nula = vigente. No se borra la fila: sigue contando como entrada en las cohortes y sale de las colas de trabajo. La vuelve a nulo la sincronización si el CRM lo devuelve.';

alter table negocio.citas add column if not exists baja_en_el_crm timestamptz;
comment on column negocio.citas.baja_en_el_crm is
  'Cuándo se vio que GoHighLevel borró esta cita (vino con deleted: true, o faltó en un barrido completo y su GET dio 404 o deleted, la 108). Nula = vigente. Una cita con baja no es alcanzable: sale de todas las cifras. La vuelve a nulo el barrido si el CRM la devuelve.';

-- La relectura de los congelados busca los congelados SIN baja, por su última lectura: un índice parcial chico (hoy
-- 41 filas de 640) que la consulta usa tal cual.
create index if not exists contactos_congelados_por_releer
  on negocio.contactos (org_id, sincronizado_el)
  where territorio is null and baja_en_el_crm is null;
comment on index negocio.contactos_congelados_por_releer is
  'La relectura de los congelados (108, lib/negocio/sincronizar.ts releerLosCongelados): congelados sin baja, el de lectura más vieja primero.';
