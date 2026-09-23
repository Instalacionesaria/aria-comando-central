-- ═══════════════════════════════════════════════════════════════════════════════
-- 057 · LA LLAVE DE tl;dv DE CADA EMPRESA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Los Analizadores descubren las reuniones en tl;dv con la llave de la cuenta de la empresa. En ARIA
-- Brain vivía en su propia tabla (`aria_brain_analyzer_tldv`), en texto plano y por alumno del hub.
-- Acá es una credencial más, en la fila de credenciales de la empresa y cifrada igual que la llave de
-- IA: la carga una persona en Ajustes › Credenciales, y ninguna respuesta la devuelve.
--
-- ── POR QUÉ UNA COLUMNA Y NO UNA TABLA ───────────────────────────────────────
--
-- Porque es la misma clase de dato que `ia_clave_cifrada` y `pagos_clave_cifrada` —un secreto de la
-- empresa para un servicio ajeno— y esas tres ya se resuelven en una sola función
-- (`resolverCredenciales`), que es la que decide qué se muestra de un secreto. Una tabla aparte sería
-- un segundo lugar donde descifrar, y el respaldo implícito tendría dos lugares donde aparecer.
--
-- El `grant` de `app_identidad` sobre esta tabla es a nivel de TABLA (`006`), así que alcanza la
-- columna nueva sin tocar nada.
--
-- ── Y TIENE QUE ESTAR EN PRODUCCIÓN ANTES DEL CÓDIGO ─────────────────────────
--
-- `resolverCredenciales` nombra la columna en su `select`. Si el código llega antes que la columna,
-- Ajustes › Credenciales da 500 a todas las empresas, no solo a las que usan Analizadores.

alter table identidad.organizaciones_credenciales
  add column if not exists tldv_clave_cifrada text;

comment on column identidad.organizaciones_credenciales.tldv_clave_cifrada is
  'La llave de la API de tl;dv de la empresa, cifrada con CLAVE_MAESTRA como ia_clave_cifrada. Sin ella los Analizadores no descubren reuniones, pero el analisis de una transcripcion pegada a mano funciona igual.';
