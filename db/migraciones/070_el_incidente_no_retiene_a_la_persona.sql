-- El incidente de la IA ya no impide borrar a la persona que lo tuvo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ
--
-- La `067` dejó `negocio.incidentes.usuario_id` con la acción por omisión (`no action`). Con eso, un solo
-- fallo de la IA —aunque el reintento lo haya salvado y la persona ni lo viera— la volvía imborrable:
-- Ajustes respondía «tuvo fallos de la IA registrados como incidentes» y no había nada que la persona
-- pudiera hacer. El plan de los agentes (`docs/OTROS/agentes/08-LAS-ETAPAS.md`, AG2) lo decidió en la
-- etapa que suma los incidentes del auditor y de los Analizadores, que iban a volverlo más frecuente.
--
-- El incidente es de la organización, como el uso (`069`) y el análisis del Espía (`068`): se borra la
-- persona y el incidente queda, sin quién lo vio. Su frase sale de `QUE_LO_IMPIDE`
-- (`lib/administracion/borrado.ts`), que sólo traduce las claves que todavía frenan un borrado.
--
-- `revisado_por` queda como estaba: quien dio un incidente por revisado sigue frenando su borrado, y la
-- frase «revisó incidentes en el Panel de Incidentes» sigue en la lista.
--
-- Se reemplaza la restricción con el MISMO nombre: la prueba de `QUE_LO_IMPIDE` cruza las claves de la
-- lista con los nombres de `pg_constraint`, y un nombre nuevo dejaría la vieja frase apuntando a nada.
-- `if exists` para que volver a correrla a mano no falle.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.incidentes
  drop constraint if exists incidentes_usuario_id_fkey,
  add constraint incidentes_usuario_id_fkey
    foreign key (usuario_id) references identidad.usuarios(id) on delete set null;

comment on column negocio.incidentes.usuario_id is
  'Quién vio el fallo. NULL cuando el camino no lo sabe (el cron) o cuando la persona se borró: desde la 070 la clave es on delete set null.';
