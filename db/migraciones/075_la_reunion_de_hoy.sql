-- La Reunión de hoy: los temas del día de cada empresa (AG15 de los agentes;
-- `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-70 a AG-76).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- UNA FILA POR EMPRESA Y DÍA, CON TODOS LOS CANDIDATOS
--
-- La pasada diaria (la tarea `senales`, después de los detectores) guarda **todos** los temas candidatos,
-- ordenados, cada uno con su sección de origen, su etiqueta, su evidencia (ids y cifras) y su propio texto. No
-- guarda tres: los tres se eligen al leer, **después** de quitar lo de las secciones que la persona no ve
-- (AG-73). Guardar tres antes de filtrar dejaría con menos tarjetas a quien tiene secciones restringidas.
--
-- `redaccion` es lo que el modelo ordenó y redactó, ya validado, o nula sin llave o sin respuesta: entonces
-- valen el orden de las reglas y los textos de plantilla. `corrio_el` es la hora que dice la cinta (AG-76).
-- La fila existe también sin temas: dice que la pasada corrió y no hubo nada. Escritor único:
-- `lib/agentes/reunion/guardar.ts`.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.reuniones_del_dia (
  org_id uuid not null references identidad.organizaciones(id),
  -- El día local de la empresa.
  dia date not null,
  temas jsonb not null check (jsonb_typeof(temas) = 'array'),
  redaccion jsonb,
  corrio_el timestamptz not null default now(),
  primary key (org_id, dia)
);

comment on table negocio.reuniones_del_dia is
  'Los temas candidatos de la Reunión de hoy, por empresa y día local, con su texto y su evidencia; los tres se eligen al leer, después de filtrar por persona. La escribe sólo lib/agentes/reunion/guardar.ts.';

drop policy if exists aislamiento on negocio.reuniones_del_dia;
select negocio.aplicar_aislamiento('negocio.reuniones_del_dia');
