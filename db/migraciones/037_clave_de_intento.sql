-- Registrar el mismo resultado dos veces deja de escribir dos.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- EL DEFECTO QUE ESTA COLUMNA CIERRA, Y CUÁNTO COSTABA
--
-- `POST /api/contactos/[id]/avanzar` escribe en dos pasos: primero confirma la transacción, después
-- le avisa a GoHighLevel. Cuando la respuesta no llega —tiempo de espera, wifi caída, un 504 justo
-- al final— quien registró **no puede saber si quedó**, y hasta hoy el cartel le decía «No se
-- registró nada», que era falso. Se arregló el cartel, y quedaba lo de fondo: repetir escribía otra
-- fila.
--
-- Y una fila de más no es un detalle contable. Las comisiones NO están guardadas: se calculan
-- leyendo esta tabla —`lib/negocio/comision.ts` suma el `monto` de las ventas y las cuenta—, así que
-- una VENTA duplicada duplica la base de la comisión y el conteo. Nadie lo reporta, porque el número
-- que sale es plausible.
--
-- ── POR QUÉ UNA CLAVE Y NO UN «NO REPITAS LO IGUAL» ─────────────────────────
--
-- El atajo era rechazar un resultado idéntico al mismo contacto dentro de N segundos. Es una
-- adivinanza: dos llamadas de verdad al mismo contacto el mismo día son un caso legítimo, y ese
-- atajo se tragaría la segunda en silencio. Peor que el problema.
--
-- La clave la genera el NAVEGADOR al abrir «Avanzar», una por apertura. Con eso:
--
--   · reintentar después de un corte es inofensivo — choca contra el índice y el servidor devuelve
--     el resultado que ya estaba, en vez de escribir otro;
--   · cerrar el panel y volver a abrirlo a propósito SÍ registra otra vez, porque eso ya es una
--     decisión de la persona y no un reintento.
--
-- ── NULABLE, Y ESO ES UNA DECISIÓN ──────────────────────────────────────────
--
-- Las filas que ya existen no tienen clave, así que la columna admite nulos y el índice único las
-- deja convivir: en PostgreSQL varios `null` no chocan entre sí. Lo que impide que aparezcan filas
-- nuevas sin clave no es la base, es la ruta, que rechaza una petición sin ella. Está escrito ahí y
-- comprobado en `pruebas/codigo/134-clave-de-intento.test.ts`.
--
-- La alternativa era `not null` con un relleno para las viejas. Se descartó: inventarles una clave a
-- filas históricas es escribir un dato que nunca existió, y `null` dice la verdad — «esta fila se
-- registró antes de que hubiera claves».
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.resultados
  add column if not exists clave_de_intento uuid;

comment on column negocio.resultados.clave_de_intento is
  'La apertura de «Avanzar» que produjo este resultado. Un reintento trae la misma y choca contra '
  '`resultados_clave_de_intento`, así que no escribe una segunda fila. Nulo en las filas anteriores '
  'a esta migración.';

-- POR ORGANIZACIÓN, como todo índice único de este esquema: la política de RLS aísla por `org_id`,
-- y un índice global haría que la clave de una empresa pudiera bloquear el registro de otra.
create unique index if not exists resultados_clave_de_intento
  on negocio.resultados (org_id, clave_de_intento);
