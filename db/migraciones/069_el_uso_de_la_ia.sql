-- El uso de la IA: una fila por llamada al modelo, con lo que consumió y ninguna palabra de lo que se dijo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- Plan de los agentes de IA del 2026-10-04 (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`,
-- AG-94, y `D-16` de `00-MAPA.md`). Hasta acá sólo los Analizadores guardaban sus tokens, en su propio
-- registro de análisis; los demás los devolvían o ni los leían, y nadie los guardaba. Esta tabla es la
-- ÚNICA fuente del consumo de IA: dos tablas que midieran lo mismo darían dos verdades.
--
-- La escribe sólo `registrarUso` (`lib/agentes/uso.ts`). La van a leer Ajustes, el uso del día contra
-- los topes de cada empresa, y Monitoreo, desde la principal y empresa por empresa.
--
-- ── UNA FILA POR LLAMADA, NO POR INTENTO ─────────────────────────────────────
--
-- El transporte reintenta sólo después de un rechazo o de una respuesta que no llegó, y ninguno de los
-- dos trae `usage`: una fila por intento sumaría filas sin contadores. El fallo que el reintento salvó
-- queda en `negocio.incidentes` con `salvado`; acá queda la llamada, con su duración entera.
--
-- ── LOS CONTADORES SON NULOS CUANDO NO SE SABE ───────────────────────────────
--
-- Nulos cuando el proveedor no contestó (un rechazo, una conexión cortada): no se sabe qué consumió, y
-- un cero diría que nada. Una respuesta que llegó y no sirvió —truncada, declinada, sin estructura— SÍ
-- trae los suyos: se pagó. Es el criterio de la `056`: nulo es «no se sabe», distinto de 0.
--
-- ── LO QUE NO SE GUARDA ──────────────────────────────────────────────────────
--
-- Ni el prompt ni la respuesta (`ADR-0407`). `ref` es una referencia —el hilo, el análisis o la del
-- incidente— y su largo está acotado para que no se vuelva un texto.
--
-- ── LAS CLAVES FORÁNEAS ──────────────────────────────────────────────────────
--
-- `usuario_id` es `on delete set null`, como la `068` (`T-23` del plan): se borra la persona y el consumo
-- queda, porque es de la organización. Va simple y no compuesta con `org_id`, como en la `067` y la `068`.
-- `org_id` no cascadea: su frase está en `QUE_LO_IMPIDE` (`lib/administracion/borrado.ts`).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.uso_de_ia (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  creado_el timestamptz not null default now(),
  -- Quién consumió. Juego cerrado: la MISMA lista que `AGENTES_DE_USO` (`lib/agentes/uso.ts`), y
  -- `pruebas/base/200-el-uso-de-la-ia.test.ts` compara las dos. Sumar uno es soltar y volver a poner
  -- `uso_de_ia_agente_check` en una migración nueva, como hizo la `067` con las secciones.
  agente text not null constraint uso_de_ia_agente_check check (agente in (
    'executive', 'plan', 'reunion', 'brief', 'objeciones',
    'fundaciones_generar', 'fundaciones_conversar', 'fundaciones_rellenar',
    'espia', 'auditor', 'auditor_mejora',
    'analizador_clasificar', 'analizador_analizar', 'analizador_ficha'
  )),
  -- El identificador que viajó en el cuerpo. Texto libre: lo fija el código de cada agente.
  modelo text not null,
  -- Los cuatro de `usage`. NULL cuando el proveedor no contestó: ver el encabezado.
  tokens_entrada integer,
  tokens_salida integer,
  tokens_escritura_cache integer,
  tokens_lectura_cache integer,
  -- Desde el primer intento hasta la respuesta, reintento y pausa incluidos.
  duracion_ms integer not null check (duracion_ms >= 0),
  -- `ok`, o la situación con que se clasificó el fallo (`lib/fundaciones/fallo-del-modelo.ts`).
  resultado text not null check (resultado = 'ok' or resultado ~ '^IA-[A-Z-]+$'),
  -- Quién pidió. NULL en el cron. Se borra la persona y el consumo queda: es de la organización.
  usuario_id uuid references identidad.usuarios(id) on delete set null,
  -- El hilo, el análisis o la referencia del incidente. Una referencia, nunca un texto.
  ref text check (char_length(ref) <= 64),
  primary key (org_id, id)
);

create index if not exists uso_de_ia_por_fecha on negocio.uso_de_ia (org_id, creado_el desc);

comment on table negocio.uso_de_ia is
  'Lo que consume cada llamada al modelo de IA de una organización: agente, modelo, los cuatro contadores de tokens, duración y resultado. Ningún texto. La escribe sólo lib/agentes/uso.ts.';
comment on column negocio.uso_de_ia.tokens_entrada is
  'Nulo cuando el proveedor no contestó: no se sabe qué consumió, que es distinto de 0. Vale igual para las otras tres columnas de tokens.';

drop policy if exists aislamiento on negocio.uso_de_ia;
select negocio.aplicar_aislamiento('negocio.uso_de_ia');
