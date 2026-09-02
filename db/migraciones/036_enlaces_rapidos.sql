-- Los links rápidos dejan de ser solo del closer: cada zona tiene los suyos.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA 035 SE LLAMÓ `enlaces_de_pago`, Y ESE NOMBRE DURÓ UN DÍA
--
-- Nació para el closer, donde los diez links son de cobro: Stripe y WHOP. Se pidió lo mismo para el
-- setter, y ahí **no son pagos**: el setter agenda, así que lo que manda es el calendario, un video,
-- una página de casos. Una tabla llamada `enlaces_de_pago` guardando el link de un calendario es la
-- clase de mentira barata de escribir y cara de descubrir — alguien la lee dentro de seis meses y
-- asume semántica de cobro que no está.
--
-- Se renombra ahora porque hoy cuesta una migración y diez filas en una sola empresa. En cualquier
-- otro momento cuesta más.
--
-- ── LO QUE **NO** SE PUEDE RENOMBRAR, Y HAY QUE SABERLO ────────────────────
--
-- `identidad.auditoria_accesos` es de SOLO INSERCIÓN —`identidad.evitar_mutacion()` lo hace
-- cumplir—, así que las filas escritas el 2026-09-02 conservan `enlace_de_pago_creado` para
-- siempre. De acá en adelante se escribe `enlace_rapido_creado`. Quien consulte el registro por
-- cambios de links tiene que buscar los DOS nombres, y por eso queda dicho en
-- `lib/autenticacion/auditoria.ts` al lado del tipo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA UNICIDAD PASA A SER POR MENÚ, Y ESO ES UN ARREGLO
--
-- Era `unique (org_id, url)`: una dirección, una vez por empresa. Con dos zonas eso prohíbe algo
-- legítimo — el mismo link de calendario ofrecido en las dos —, y lo prohíbe con un error que
-- nombra un índice y no explica nada.
--
-- El duplicado que hace daño sigue siendo el mismo: **dos entradas del MISMO menú apuntando al mismo
-- lado**. Se ven distintas, hacen lo mismo, y quien elige no puede notarlo. Eso es
-- `(org_id, territorio, url)`.
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- TODO ESTO ES REAPLICABLE, Y ES UNA REGLA DEL PROYECTO
--
-- Desde la 024: *«una migración con `add constraint` es REAPLICABLE»*, y `pruebas/base/10-migraciones`
-- lo comprueba. El motivo es concreto: sobre una base que ya tiene la restricción —porque alguien
-- aplicó el SQL a mano arreglando algo— el corredor muere con un `42710` y **revierte todas las
-- migraciones pendientes de esa corrida**, incluidas las que no tienen nada que ver.
--
-- Un renombre tiene el mismo problema con otro código: sobre una tabla ya renombrada, `rename to`
-- falla con `42P01`. Por eso cada paso pregunta antes.
-- ═════════════════════════════════════════════════════════════════════════════

do $renombrar_la_tabla$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'negocio' and c.relname = 'enlaces_de_pago'
  ) then
    alter table negocio.enlaces_de_pago rename to enlaces_rapidos;
  end if;
end $renombrar_la_tabla$;

-- Las restricciones NO se renombran solas con la tabla. Dejarlas con el nombre viejo tiene un costo
-- concreto y no estético: `lib/administracion/borrado.ts` traduce el nombre de la clave foránea que
-- bloqueó un borrado a palabras del negocio, y `pruebas/base/23-editar-y-borrar` cruza ese
-- diccionario contra `pg_constraint`. Un nombre que miente ahí sale como un mensaje genérico.
do $renombrar_las_restricciones$
declare
  v record;
begin
  for v in select * from (values
      ('enlaces_de_pago_pkey',                        'enlaces_rapidos_pkey'),
      ('enlaces_de_pago_org_id_fkey',                 'enlaces_rapidos_org_id_fkey'),
      ('enlaces_de_pago_org_id_actualizado_por_fkey', 'enlaces_rapidos_org_id_actualizado_por_fkey'),
      ('enlaces_de_pago_https',                       'enlaces_rapidos_https'),
      ('enlaces_de_pago_nombre_no_vacio',             'enlaces_rapidos_nombre_no_vacio'),
      ('enlaces_de_pago_monto_no_vacio',              'enlaces_rapidos_monto_no_vacio'),
      ('enlaces_de_pago_descripcion_no_vacia',        'enlaces_rapidos_descripcion_no_vacia'),
      ('enlaces_de_pago_url_no_vacia',                'enlaces_rapidos_url_no_vacia')
    ) as p(viejo, nuevo)
  loop
    if exists (
      select 1 from pg_constraint
       where conrelid = 'negocio.enlaces_rapidos'::regclass and conname = v.viejo
    ) then
      execute format('alter table negocio.enlaces_rapidos rename constraint %I to %I', v.viejo, v.nuevo);
    end if;
  end loop;
end $renombrar_las_restricciones$;

-- ── LA ZONA A LA QUE PERTENECE CADA LINK ──────────────────────────────────
--
-- Los mismos dos valores que `negocio.contactos.territorio`, y no un vocabulario nuevo: es lo que
-- permite que el menú de la ficha se resuelva sin traducir nada — el contacto ya dice de qué zona es.
--
-- `not null` con un valor por omisión que después SE QUITA. El default existe solo para llenar las
-- filas que ya están: los diez de ARIA son de cobro y son del closer. Dejarlo puesto haría que un
-- `insert` que se olvide de la zona caiga en el closer en silencio, y ahí el link aparecería en el
-- menú equivocado sin que nada falle.
alter table negocio.enlaces_rapidos add column if not exists territorio text not null default 'closer';
alter table negocio.enlaces_rapidos alter column territorio drop default;

-- El vocabulario lo hace cumplir la base y no una lista en el código. Es la misma decisión que la
-- 027 escribió para los agentes del auditor: dos listas del mismo hecho divergen en silencio.
alter table negocio.enlaces_rapidos drop constraint if exists enlaces_rapidos_territorio;
alter table negocio.enlaces_rapidos add constraint enlaces_rapidos_territorio
  check (territorio in ('closer', 'setter'));

-- ── Y LA UNICIDAD, QUE AHORA ES POR MENÚ ──────────────────────────────────
--
-- Ver el encabezado. Se cae la vieja y entra la de tres columnas; `aplicar_aislamiento` exige que
-- todo índice único lleve `org_id` adentro, y ésta lo lleva primero.
alter table negocio.enlaces_rapidos drop constraint if exists enlaces_de_pago_url_unica;
alter table negocio.enlaces_rapidos drop constraint if exists enlaces_rapidos_url_unica;
alter table negocio.enlaces_rapidos add constraint enlaces_rapidos_url_unica
  unique (org_id, territorio, url);

-- El menú de una zona se lee entero en cada apertura de ficha, y son dos zonas por empresa. Con el
-- índice, esa lectura no recorre los links de la otra.
create index if not exists enlaces_rapidos_por_zona
  on negocio.enlaces_rapidos (org_id, territorio, orden);

-- El régimen de aislamiento sobrevive al renombre —la política se llama `aislamiento` y cuelga de la
-- tabla, no de su nombre— pero se vuelve a pedir igual: es la única forma de que las comprobaciones
-- de `aplicar_aislamiento` corran contra la tabla COMO QUEDÓ. La restricción única nueva es
-- justamente una de las cosas que esa función verifica.
drop policy if exists aislamiento on negocio.enlaces_rapidos;
select negocio.aplicar_aislamiento('negocio.enlaces_rapidos');
