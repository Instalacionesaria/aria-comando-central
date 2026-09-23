-- ═══════════════════════════════════════════════════════════════════════════════
-- 060 · `postgres` PUEDE ESCRIBIR EN LAS SEIS TABLAS DE LOS ANALIZADORES, PARA LA COPIA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- La copia única del historial de ARIA Brain (`scripts/copias/historial-analizador.sql`) lee
-- `public.aria_brain_analyzer_*` y escribe en `negocio.analizador_*`. **El único rol que ve las dos
-- puntas es `postgres`**: es dueño de las tablas de Brain y tiene `rolbypassrls`, así que la RLS
-- forzada de las nuestras no lo frena. Medido el 2026-09-23: ya tiene `select` sobre las seis y le
-- falta `insert`.
--
-- Los otros dos caminos están cerrados, y no por gusto: `migrador` no ve `public.aria_brain_*`, y
-- `app_inquilino` leería CERO filas de Brain sin error, porque esas tablas tienen RLS sin políticas.
--
-- ── Y ES TEMPORAL: LA `061` LO QUITA ─────────────────────────────────────────
--
-- Va en una migración aparte de su revocación a propósito: `db.mjs migrar` aplica todas las
-- pendientes en UNA transacción, así que con las dos juntas el permiso se daría y se quitaría antes
-- de que la copia pudiera usarlo. El orden en producción es 060 → la copia → 061.
--
-- Solo `insert`: la copia no actualiza ni borra nada. Lo corre `migrador`, que es el dueño de las
-- seis tablas y por eso puede otorgar sobre ellas.

grant insert on
  negocio.analizador_prospectos,
  negocio.analizador_llamadas,
  negocio.analizador_transcripciones,
  negocio.analizador_analisis,
  negocio.analizador_fichas,
  negocio.analizador_lapidas
to postgres;
