-- Cuánto paga cada empresa. El lado del INGRESO del Panel de Monitoreo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ESTE DATO NO EXISTÍA EN NINGÚN LADO, Y HAY QUE DECIR POR QUÉ
--
-- El panel de ARIA-brain ya lo había anotado como su deuda más cara: *"todavía NO hay
-- rentabilidad, y falta dato para calcularla: no se registra cuánto paga cada cliente (eran links
-- de Stripe) ni cuánto cuesta cada lead"*. En Comando Central tampoco estaba: `pagos_clave_cifrada`
-- y `pagos_comercio_id` son CREDENCIALES de un proveedor de pagos por empresa, y nada las consume.
--
-- No hay tabla de facturación, de plan ni de suscripción. Así que el número que falta es uno solo
-- y hay que ponerlo a mano: **cuánto paga esta empresa por mes**.
--
-- ── POR QUÉ VA EN `identidad.organizaciones` Y NO EN `negocio` ──────────────
--
-- Porque es un hecho de la RELACIÓN COMERCIAL entre la plataforma y esa empresa, no de la
-- operación de la empresa. `negocio.*` son los datos que el inquilino produce y consume —sus
-- contactos, sus citas, sus ventas—; esto es lo que nos paga a nosotros, y quien lo edita es el
-- rol de plataforma.
--
-- Y no en `organizaciones_credenciales`, que es donde tienta ponerlo porque esa tabla no la puede
-- leer el inquilino: ahí adentro no hay una credencial, y `app/api/admin/comisiones/route.ts` ya
-- documenta el costo de haber hecho eso una vez — *"la descripción de esa capacidad habla de
-- credenciales y ahora también gobierna sueldos"*.
--
-- ── QUÉ VE EL INQUILINO, Y POR QUÉ NO ES UNA FUGA ──────────────────────────
--
-- `app_inquilino` tiene `select` sobre esta tabla con la política `org_propia_lee`, así que una
-- empresa podría leer SU PROPIO precio. No es una fuga: es lo que paga, ya lo sabe. Lo que la
-- política impide es leer el de otra, y eso sigue en pie.
--
-- El `update` de `app_inquilino` sí es por columna —`grant update (nombre, zona_horaria)` en la
-- migración 002— así que el inquilino **no puede cambiarse el precio**. Esa es la parte que
-- importaba, y no hace falta agregar nada: la columna nueva no entra en ese `grant`.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── NULO NO ES CERO, Y ES LA DECISIÓN DE ESTA MIGRACIÓN ─────────────────────
--
-- `null` = **nadie lo cargó todavía**. `0` = **esta empresa no paga**, que es un hecho medido y
-- legítimo (una cuenta de prueba, un canje, la propia ARIA).
--
-- Colapsarlos en un `default 0` sería el error clásico de esta base de datos: las cuatro empresas
-- de hoy aparecerían pagando cero y el margen se calcularía sobre un ingreso inventado, sin que
-- nada falle. El panel muestra «sin cargar» y NO lo suma al total.
--
-- `numeric(12, 2)` y no `float`: es dinero. Un `double precision` no puede representar 49.99 y el
-- total de veinte empresas termina con colas de centavos que nadie puede explicar. Es la misma
-- forma que `negocio.resultados.monto`.
alter table identidad.organizaciones
  add column if not exists precio_mensual numeric(12, 2);

comment on column identidad.organizaciones.precio_mensual is
  'Cuánto paga esta empresa por mes, en USD. NULL = nadie lo cargó; 0 = no paga. Lo edita el rol '
  'de plataforma desde Ajustes → Empresas. Alimenta el Panel de Monitoreo.';

-- ── UNA SOLA MONEDA, Y ESTÁ ELEGIDA ─────────────────────────────────────────
--
-- No hay columna `moneda`, a propósito. El otro número de la misma fila del panel es el costo de
-- Apify, que **viene en USD y no se puede pedir en otra cosa**. Con dos monedas en la misma tabla,
-- el margen sería una resta entre unidades distintas: un número que se ve bien, se suma bien, y
-- está mal. Si algún día hace falta cobrar en soles, lo que hay que agregar es la conversión —una
-- fecha y un tipo de cambio— no una columna de texto que nadie mira.
alter table identidad.organizaciones
  add constraint organizaciones_precio_no_negativo
  check (precio_mensual is null or precio_mensual >= 0);
