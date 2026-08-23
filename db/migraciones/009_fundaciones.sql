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

insert into identidad.permisos (clave, descripcion) values
  ('fundaciones.ver',    'Ver el trabajo de Fundaciones: ficha, research, ICP, categoría, oferta, precio y mapa'),
  ('fundaciones.editar', 'Generar y editar los entregables de Fundaciones (consume tokens de la organización)');

-- El superadministrador recibe todo. La prueba "el rol de plataforma tiene TODAS las
-- capacidades cargadas en la tabla" lo verifica, y sin estas dos líneas fallaría — que
-- es exactamente lo que tiene que pasar cuando alguien agrega una capacidad y se olvida
-- de repartirla.
insert into identidad.roles_permisos (rol_id, permiso)
  select r.id, p.clave
    from identidad.roles r, identidad.permisos p
   where r.clave = 'superadministrador'
     and p.clave in ('fundaciones.ver', 'fundaciones.editar');

-- El administrador, todo lo de su organización. Misma regla que la migración 003: todo
-- salvo `organizaciones.%`.
insert into identidad.roles_permisos (rol_id, permiso)
  select r.id, p.clave
    from identidad.roles r, identidad.permisos p
   where r.clave = 'administrador'
     and p.clave in ('fundaciones.ver', 'fundaciones.editar');

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
