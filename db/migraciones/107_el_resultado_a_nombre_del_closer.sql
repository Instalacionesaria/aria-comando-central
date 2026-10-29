-- 107 · El resultado a nombre del closer: quien registra y a quién se le acredita pasan a ser dos columnas.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (la fase 2 del selector de closer, 2026-10-29)
--
-- Hasta acá un resultado de Avanzar tenía UNA persona: `registrado_por`. De ella salían la comisión
-- (`lib/negocio/comision.ts`), el cobrado de Inicio (`dineroDelMes.ts`) y la tabla de closers de Sales
-- (`cierrePorCloser.ts`). Medido en producción el 2026-10-29: de los tres closers de la empresa sólo uno entra a la
-- plataforma —el administrador, que además es closer— y los otros dos llevan más de 30 días sin entrar. O sea que las
-- ventas de los otros dos, si alguien las registra, las registra él, y quedaban a SU nombre: su comisión subía, la de
-- ellos quedaba en cero y la tabla de Sales decía que él cerró todo.
--
-- La etapa 8a le dio al supervisor un selector para MIRAR los números de un closer. Ésta deja REGISTRAR a su nombre:
--
--   · `registrado_por` sigue siendo la persona real que apretó el botón. No se toca: es la autoría (y la nota, la
--     tarea y el sello del setter siguen colgando de ella).
--   · `closer_id` es el closer al que se le acredita el resultado. Nula en las filas de antes de esta migración y en
--     las del setter: las métricas leen `coalesce(closer_id, registrado_por)`, así que una fila vieja se sigue
--     acreditando a quien la registró, que es exactamente lo que pasaba.
--
-- QUIÉN LA ESCRIBE: sólo `lib/negocio/avanzar.ts`, con lo que decidió la ruta de Avanzar con la sesión. Un closer que no
-- supervisa registra a su nombre; quien supervisa (`credenciales.editar`) elige el closer, y si no elige se acredita
-- al closer asignado al contacto en el CRM (o a nadie, y entonces cuenta quien registra). Que la persona elegida sea
-- un closer vinculado lo valida la ruta: la base sólo puede garantizar que sea una persona DE ESTA EMPRESA.
--
-- LA CLAVE FORÁNEA lleva `org_id` adentro, como la de `registrado_por` (la `011`): una foránea sin la organización
-- dejaría acreditar a una persona de otro inquilino, y la política de fila no lo desmentiría. `31-forma-de-las-tablas`
-- lo exige de toda tabla de `negocio`. Es `no action`, igual que la de `registrado_por`: borrar a un closer con ventas
-- a su nombre se frena (`lib/administracion/borrado.ts` lo dice en palabras), en vez de mover su comisión en silencio
-- a quien las registró.
--
-- REAPLICABLE: `add column if not exists`, y la restricción con `drop … if exists` antes del `add` (PostgreSQL no
-- tiene `add constraint if not exists`). Sin índice: la tabla tiene decenas de filas y las métricas ya la recorren por
-- `resultados_por_fecha`. Sin relleno: el migrador no ve filas (la RLS forzada), y una fila vieja con la columna nula
-- ya se acredita como antes.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.resultados
  add column if not exists closer_id uuid;

alter table negocio.resultados
  drop constraint if exists resultados_org_id_closer_id_fkey;

alter table negocio.resultados
  add constraint resultados_org_id_closer_id_fkey
  foreign key (org_id, closer_id) references identidad.usuarios (org_id, id);

comment on column negocio.resultados.closer_id is
  'El closer al que se le acredita este resultado (comisión, cobrado, tabla de closers de Sales). Nulo en las filas anteriores a la 107 y en las del setter: las métricas leen coalesce(closer_id, registrado_por). registrado_por sigue siendo quien lo registró de verdad. Lo escribe sólo Avanzar (lib/negocio/avanzar.ts): un closer a su nombre; quien supervisa, a nombre del closer elegido o del asignado al contacto.';
