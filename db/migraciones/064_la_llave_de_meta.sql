-- ═══════════════════════════════════════════════════════════════════════════════
-- 064 · EL TOKEN DE META DE CADA EMPRESA, Y SU CUENTA PUBLICITARIA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Creative va a leer la miniatura y el video de cada anuncio desde Meta directo
-- (docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md), porque GoHighLevel no los entrega (C14-16 a C14-22).
-- El token es el de un USUARIO DEL SISTEMA del Business Manager de la empresa, con sólo `ads_read`,
-- `pages_read_engagement` y `pages_show_list`: lee, no crea ni gasta. Lo genera una persona con acceso
-- al Business Manager y lo carga en Ajustes › Credenciales; ninguna respuesta lo devuelve.
--
-- ── DOS COLUMNAS, Y UNA NO ES SECRETA ─────────────────────────────────────────
--
-- `meta_token_cifrado` es un secreto: se cifra con CLAVE_MAESTRA, igual que `ia_clave_cifrada` y
-- `tldv_clave_cifrada` (`057`), y se resuelve en la misma función única.
--
-- `meta_cuenta_id` NO es un secreto: es el `act_…` de la cuenta publicitaria, el mismo que se ve en
-- el Administrador de anuncios. Va y viene completo, como `crm_cuenta_id`, porque quien lo carga
-- necesita VERLO para comprobar que puso el correcto. Y existe por lo mismo que un token del CRM
-- necesita su Location ID: un token de Meta puede ver varias cuentas, y sin saber cuál es la de esta
-- empresa, un anuncio de otra cuenta se mostraría como propio (C15-11).
--
-- ── Y TIENE QUE ESTAR EN PRODUCCIÓN ANTES DEL CÓDIGO ─────────────────────────
--
-- `resolverCredenciales` nombra las dos columnas en su `select`. Si el código llega antes, Ajustes ›
-- Credenciales da 500 a todas las empresas. Es la misma advertencia de la `057`.

alter table identidad.organizaciones_credenciales
  add column if not exists meta_token_cifrado text;

alter table identidad.organizaciones_credenciales
  add column if not exists meta_cuenta_id text;

comment on column identidad.organizaciones_credenciales.meta_token_cifrado is
  'El token de un usuario del sistema del Business Manager de la empresa (solo lectura: ads_read, pages_read_engagement, pages_show_list), cifrado con CLAVE_MAESTRA. Sin el, Creative no muestra miniaturas ni videos.';

comment on column identidad.organizaciones_credenciales.meta_cuenta_id is
  'La cuenta publicitaria de Meta de la empresa (act_...). No es un secreto. Un anuncio que Meta devuelva de otra cuenta se descarta.';
