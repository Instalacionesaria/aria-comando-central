-- ═══════════════════════════════════════════════════════════════════════════════
-- 061 · `postgres` DEJA DE PODER ESCRIBIR EN LAS TABLAS DE LOS ANALIZADORES
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Deshace la `060`, que existía solo para la copia única del historial de ARIA Brain
-- (`scripts/copias/historial-analizador.sql`). La copia ya corrió en producción: lo dicen sus
-- verificaciones de pares, que abortan la transacción entera si falta una sola fila.
--
-- Por qué no se deja: `postgres` tiene `rolbypassrls`, así que un `insert` suyo en estas tablas no
-- pasa por la RLS de ninguna empresa. Nada del código lo usa —la aplicación escribe como
-- `app_inquilino`, las migraciones como `migrador`—, y un permiso que nadie usa es solo una puerta
-- más. Queda el `select` que ya tenía antes de la `060`.
--
-- Correr la copia otra vez después de esto falla con «permission denied», que es lo correcto: es
-- idempotente, pero no tiene que volver a hacer falta.

revoke insert on
  negocio.analizador_prospectos,
  negocio.analizador_llamadas,
  negocio.analizador_transcripciones,
  negocio.analizador_analisis,
  negocio.analizador_fichas,
  negocio.analizador_lapidas
from postgres;
