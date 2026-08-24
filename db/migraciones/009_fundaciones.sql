-- ADR-0002 — Las migraciones son versionadas y se aplican igual en todos lados.
-- ADR-0302 — El permiso se pregunta por capacidad, nunca por nombre de rol.
-- ADR-0303 — Todo rol asignable tiene al menos una pantalla.
--
-- Etapa 9 · Fundaciones: las siete herramientas de la pantalla `icp` (ICP & Oferta).
--
-- Esta migración es CORTA a propósito, y eso dice algo sobre la etapa: las siete
-- herramientas no traen ni una tabla de negocio, porque su estado NO vive en esta base.
-- Vive en el almacén de ARIA-brain, compartido con el hub mientras el hub siga en pie
-- (la decisión, con lo que cuesta, está escrita en `lib/fundaciones/almacen.ts` y en
-- `docs/ETAPA-9.md`).
--
-- Así que acá hay exactamente dos cosas: las dos capacidades nuevas, y la columna que
-- dice a qué alumno del hub corresponde cada organización.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · Las dos capacidades
--
-- DOS y no una, con el criterio del 03 § 2: "¿existe un rol plausible que necesite A y
-- no B?". Sí, y es el caso normal: un coach abre el avatar y la oferta de un alumno para
-- preparar el kickoff, y no tiene por qué poder gastarle tokens generando de nuevo.
-- Ver es leer siete documentos; editar es gastar dinero de la organización.
--
-- El catálogo de `lib/autorizacion/capacidades.ts` se cruza con esta tabla EN LAS DOS
-- DIRECCIONES por una prueba de base: agregar acá y olvidar allá (o al revés) rompe la
-- suite. Es a propósito — una errata en una capacidad no falla como errata, rechaza a
-- todo el mundo con 403 y el síntoma que llega es "la pantalla está vacía".
-- ═════════════════════════════════════════════════════════════════════════════

-- ── POR QUÉ ACÁ NO HAY NINGÚN `insert`, Y ANTES SÍ ──────────────────────────
--
-- Esta migración tenía los tres `insert` que cargaban esas dos capacidades y las
-- repartían. **No funcionaban, y no fallaban tampoco** — que es la peor de las dos
-- combinaciones:
--
--   · el `insert into identidad.permisos` era RECHAZADO por política. `force row level
--     security` desde la migración 003 y sin política para `migrador`. Eso sí abortaba,
--     y con él la migración entera: `db:reset` moría acá y se llevaba las 158 pruebas de
--     base de un tirón, porque ninguna podía construir la base.
--
--   · y los dos `insert … select … from identidad.roles r, identidad.permisos p` tienen
--     un modo de falla peor todavía. Corridos por un rol sin política de LECTURA sobre
--     esas tablas, los dos `select` devuelven cero filas, así que el `insert` **entra
--     cero filas y reporta éxito**. Ni un error. El resultado es que ningún rol recibe
--     la capacidad, o sea 403 en la pantalla `icp` para todo el mundo, y el síntoma que
--     llega es "la pantalla está vacía".
--
-- Las dos capacidades y su reparto viven ahora en `db/arranque/001_catalogo.sql`, que
-- corre con la credencial de nivel clúster —la única que omite RLS— en la fase
-- `node scripts/db.mjs catalogo`, después de migrar. Ese archivo explica en su encabezado
-- las siete salidas que se midieron y por qué se descartaron las otras seis.
--
-- Lo que queda de esta migración es la columna, que es lo que una migración sí puede
-- hacer.

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · El vínculo con el alumno del hub
--
-- Va en `organizaciones_credenciales` y no en `organizaciones`, y la razón es que es de
-- la MISMA CLASE que `crm_cuenta_id` y `pagos_comercio_id`: el identificador de esta
-- organización en una cuenta de un servicio externo. La fila de credenciales es donde
-- vive "cómo se conecta esta organización con afuera".
--
-- NO lleva sufijo `_cifrado`, y eso es una afirmación, no un olvido: es un UUID en la
-- base de otro sistema, no un secreto. Lo que protege el trabajo del alumno es que la
-- llave de servicio del almacén nunca sale del servidor. Cifrarlo daría la impresión
-- contraria — que este valor es lo que protege algo.
--
-- Nulo significa "esta organización no tiene Fundaciones", y la pantalla lo dice con su
-- propio código (`sin_alumno_vinculado`). Sin valor por omisión: uno cualquiera dejaría a
-- una organización leyendo y ESCRIBIENDO el trabajo del alumno de otra.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.organizaciones_credenciales
  add column fundaciones_cliente_id text;

-- Único: dos organizaciones apuntando al mismo alumno del hub significa que las dos
-- escriben sobre el mismo documento, y la última gana sin dejar rastro. No hay un caso
-- legítimo para eso, y el día que aparezca va a necesitar su propia decisión.
--
-- Un índice único parcial y no una restricción: `null` tiene que poder repetirse —la
-- mayoría de las organizaciones no van a tener Fundaciones—, y en PostgreSQL un único
-- ordinario ya permite varios nulos, pero el `where` lo deja explícito y más chico.
create unique index organizaciones_credenciales_alumno_unico
  on identidad.organizaciones_credenciales (fundaciones_cliente_id)
  where fundaciones_cliente_id is not null;
