-- ═══════════════════════════════════════════════════════════════════════════════
-- 062 · EL REINTENTO DIARIO DE LOS ANALIZADORES
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Pedido el 2026-09-23: a las 5 de la mañana (hora de Lima), un barrido que reintente las llamadas
-- cuyo análisis falló, sin duplicar nada. El reintento manual sigue igual, con su botón.
--
-- Dos cosas, las dos necesarias para que la tarea nueva exista:
--
--   · `reintentos` en el CHECK del sello del cron (`tareas_programadas`). Sin eso la tarea corre y su
--     `sellar()` falla contra el CHECK, como explica la `058`. Reaplicable: se suelta la restricción
--     antes de reponerla (regla de la `024`).
--
--   · `reintentos_automaticos` en cada llamada: cuántas veces la reintentó el barrido. Tiene un tope
--     (3, `TOPE_DE_REINTENTOS` en `lib/analizadores/tarea.ts`): una llamada que falla siempre igual
--     —una transcripción que el modelo no puede devolver entera, por ejemplo— se pagaría todos los
--     días para siempre. Pasado el tope queda FAILED, para quien lea el error y apriete el botón.

alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores', 'reintentos'));

alter table negocio.analizador_llamadas
  add column if not exists reintentos_automaticos smallint not null default 0
    check (reintentos_automaticos >= 0);
