-- ═══════════════════════════════════════════════════════════════════════════════
-- 058 · LA TAREA `analizadores` EN EL SELLO DEL CRON
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- El barrido sella cada (empresa, tarea) en `negocio.tareas_programadas`, y la columna `tarea` tiene
-- un CHECK con la lista cerrada de las que existen. Sin esta migración, la tarea nueva corre y su
-- `sellar()` falla contra el CHECK: el error queda en el registro y la pantalla de monitoreo no se
-- entera nunca de que los Analizadores existen. Es el mismo patrón que la `051` para `anuncios`.
--
-- Reaplicable: se suelta la restricción antes de reponerla (regla de la `024`).

alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores'));
