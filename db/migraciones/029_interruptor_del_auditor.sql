-- El interruptor del auditor, por empresa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ UNA COLUMNA PROPIA Y NO «BORRARLE EL IDENTIFICADOR DEL AGENTE»
--
-- Apagar el auditor de una cuenta ya se podía: se vacía `crm_agente_usuario_id` y sin él no se
-- audita nada. **Y es la forma equivocada de hacerlo**, por dos motivos:
--
--   1 · Confunde dos hechos distintos. `crm_agente_usuario_id is null` significa *«no sabemos con qué
--       usuario del CRM habla el agente»*, y `auditor_activo = false` significa *«sabemos, y no
--       queremos auditar»*. Con una sola columna, la pantalla no puede decir cuál de los dos es, y
--       quien la mire va a tratar de arreglar el que no está roto.
--
--   2 · Apagar DESTRUYE la configuración. Volver a encender exige que alguien vuelva a averiguar el
--       identificador en el CRM y lo escriba de nuevo — o sea que apagar por un rato es una operación
--       que se paga al volver, y por eso nadie la usa.
--
-- Lo que este interruptor compra es exactamente lo que faltaba: **apagar una cuenta que ya está
-- auditando, sin desplegar y sin perder nada.**
--
-- ── NACE ENCENDIDO, Y ESO NO ENCIENDE NINGÚN GASTO ─────────────────────────
--
-- `default true`. Tienta lo contrario —que gastar sea explícito— y sería un valor por omisión que no
-- protege nada: el gasto lo habilita `crm_agente_usuario_id`, que **una persona tiene que escribir a
-- mano** en la pantalla de credenciales. Una empresa nueva no audita aunque esto esté en `true`.
--
-- Y `not null default false` tendría un costo real: el día que alguien configure el identificador, el
-- auditor seguiría apagado sin que nada lo dijera, y el síntoma sería *«configuré el agente y no pasa
-- nada»* — un estado donde el sistema pide una acción que ya se hizo.
--
-- ── DÓNDE VIVE, Y POR QUÉ ACÁ Y NO EN `organizaciones` ─────────────────────
--
-- Al lado de `crm_agente_usuario_id`, que es la otra mitad de la configuración del auditor, y de
-- `ia_clave_cifrada`, que es la que se paga. Las tres se leen juntas en el mismo momento: antes de
-- barrer una empresa. En `identidad.organizaciones` estaría separada de las dos cosas con las que
-- siempre se lee, y el barrido tendría que abrir una consulta más para preguntar algo que ya tenía a
-- mano.
--
-- **No es un secreto**, así que no lleva sufijo `_cifrado` — igual que `crm_cuenta_id`,
-- `crm_calendario_id` y `crm_agente_usuario_id`.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.organizaciones_credenciales
  add column if not exists auditor_activo boolean not null default true;

comment on column identidad.organizaciones_credenciales.auditor_activo is
  'Interruptor del auditor de IA para esta empresa (migración 029). Nace encendido: lo que habilita '
  'el gasto es `crm_agente_usuario_id`, que una persona escribe a mano. Apagarlo detiene el análisis '
  'sin borrar la configuración.';
