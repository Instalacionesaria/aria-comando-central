-- Las claves con el cliente: el pulso, el gasto, los sellos y los avisos, por (empresa, cliente). EXPANDIR.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Bloque C, Paso C1, 2026-10-18)
--
-- La ingesta pasa a ser de cada cliente (`identidad.cuentas`): cada uno con su subcuenta del CRM y su cuenta de Meta.
-- Cuatro tablas tienen una clave por organización que con dos clientes choca:
--
--   · `ingesta_pulso` (org_id, clave): el candado y la marca de agua de cada ingesta, que son de un cliente;
--   · `gasto_de_la_cuenta` (org_id, fecha): el gasto diario de una cuenta publicitaria, que es de un cliente;
--   · `tareas_programadas` (org_id, tarea): el sello del cron, que es de la empresa (sin cuenta) o de un cliente;
--   · `avisos_del_crm` (org_id, huella): el aviso del CRM, que llega a un cliente.
--
-- Esta migración EXPANDE: agrega las claves nuevas, con el cliente, JUNTO a las viejas, que la `092` cierra cuando todo
-- el código escribe por las nuevas. Mientras conviven, el código de la ingesta trabaja con el cliente por omisión, así
-- que las dos claves dicen lo mismo.
--
-- Los sellos: `tareas_programadas` gana un `id` (su clave primaria en la `092`) y un único con los nulos IGUALES, para
-- que el sello sin cuenta de una tarea de la empresa sea uno solo. Con los nulos distintos, cada corrida agregaría una
-- fila. PostgreSQL 15 o más (producción corre 17).
--
-- Los nombres NO son `<tabla>_por_cuenta`: ése ya lo usa el índice no único de la `082`, y con `if not exists` el
-- único se saltearía en silencio y ningún `on conflict` lo encontraría.
--
-- Las comisiones, `closer_asignado` y `enlaces_de_pieza` NO cambian: son ajustes de la empresa que se escriben con la
-- organización entera, y el puente los deja en el cliente por omisión. El día que sean por cliente, cambian el
-- escritor y la clave juntos.
-- ═════════════════════════════════════════════════════════════════════════════

create unique index if not exists ingesta_pulso_clave_por_cuenta on negocio.ingesta_pulso (org_id, cuenta_id, clave);

create unique index if not exists gasto_de_la_cuenta_dia_por_cuenta on negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha);

create unique index if not exists avisos_del_crm_huella_por_cuenta on negocio.avisos_del_crm (org_id, cuenta_id, huella);

alter table negocio.tareas_programadas add column if not exists id uuid not null default gen_random_uuid();
comment on column negocio.tareas_programadas.id is
  'El identificador del sello. Es la clave primaria desde la 092; la unicidad la da (org_id, cuenta_id, tarea), con los nulos iguales.';

create unique index if not exists tareas_programadas_sello_por_cuenta
  on negocio.tareas_programadas (org_id, cuenta_id, tarea) nulls not distinct;
comment on index negocio.tareas_programadas_sello_por_cuenta is
  'Un sello por (empresa, cliente, tarea); el de una tarea de la empresa va sin cliente, y es uno solo (los nulos son iguales).';
