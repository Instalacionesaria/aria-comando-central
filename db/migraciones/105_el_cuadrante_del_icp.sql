-- 105 · El cuadrante del ICP: el puntaje del lead deja de ser un número y pasa a ser una de cuatro palabras.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decidido por el usuario el 2026-10-26, `docs/leads-portal/15-EL-CUADRANTE-DEL-ICP.md`)
--
-- Hasta acá el ICP de un lead era «Puntaje | ICP», un número de 0 a 100 que el CRM calcula, guardado en
-- `contactos.score` (la `055`) y cortado en 75 y 50 por `lib/negocio/tramosDelIcp.ts`. Desde la reunión del
-- 2026-10-26 el CRM lo calcula de otra forma y manda una de cuatro palabras en el campo `contact.cuadrante_de_clasificacion`:
--
--     Prioriza (el nivel alto) · Valida y Financia (el medio) · Descarta (el bajo, y además un descarte)
--
-- Medido el mismo día con `scripts/medir-cuadrante.mjs` en la subcuenta de ARIA: el campo es `RADIO`, sus opciones son
-- exactamente esas cuatro, y lo traían 2 de los 100 contactos más nuevos (los dos, «Descarta»).
--
-- ── LA COLUMNA YA EXISTE: LA PUSO LA `084` ──────────────────────────────────
--
-- El modelo de datos de la Fase 0 ya declaró `contactos.cuadrante` (la `084`), con clave foránea a
-- `catalogo.cuadrantes` (la `079`: prioriza, valida, financia y descarta; sin cuadrante = NULL), nula «hasta que el
-- normalizador la escriba». Ésta no agrega otra: la sincronización empieza a escribirla con la palabra del CRM, ya como clave del
-- catálogo, y la clave foránea es la que impide que un valor con otra caja o con espacios llegue a una consulta que
-- compara exacto. `score` se queda como está —se sigue escribiendo y nadie lo lee—, por decisión del usuario.
--
-- ── LA CLAVE DEL CAMPO, Y NO SU NOMBRE NI SU ID ─────────────────────────────
--
-- Lo único nuevo: `campos_del_crm.clave`, el `fieldKey` de GoHighLevel, que `camposPersonalizados()` leía y tiraba.
-- El id del campo cambia de subcuenta en subcuenta y el nombre lo edita cualquiera; la clave se elige al crear el campo
-- y no se edita (medido el 2026-10-21). Con ella el campo del cuadrante se reconoce solo en cada cliente, sin elegirlo
-- a mano. Y no por nombre parecido: la subcuenta de ARIA tiene OTRO campo, `contact.cuadrante` («cuadrante»:
-- Prioridad, Educar, Nutrir, Descartar), que no es éste.
--
-- `clave` es de GoHighLevel, así que el refresco del catálogo la pisa, como `nombre` y `tipo`. Nula en las filas de
-- antes de esta migración: el catálogo las relee solo (`estaFresco` no da por fresco un catálogo sin ninguna clave).
--
-- REAPLICABLE: `if not exists`. Sin relleno: el migrador no ve filas (la RLS forzada), y lo que haya que llenar lo llena
-- la sincronización desde lo ya guardado (`recalcularLosCuadrantes`).
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.campos_del_crm add column if not exists clave text;

comment on column negocio.campos_del_crm.clave is
  'El fieldKey de GoHighLevel (contact.algo): la identidad del campo entre subcuentas, que no cambia al renombrarlo. '
  'Es de GoHighLevel: el refresco del catálogo la pisa. NULL = la fila es de antes de la 105 y el catálogo se relee.';

comment on column negocio.contactos.cuadrante is
  'El cuadrante VIGENTE. Desde la 105 lo escribe lib/negocio/sincronizar.ts con el campo '
  'contact.cuadrante_de_clasificacion del CRM (prioriza, valida, financia o descarta) y se pisa en cada corrida; cada '
  'cambio queda en negocio.clasificaciones y en un evento cuadrante_cambiado, que escribe un disparador de esta tabla '
  '(la 106). NULL = Sin clasificar. Reemplaza a score en todas las pantallas.';
