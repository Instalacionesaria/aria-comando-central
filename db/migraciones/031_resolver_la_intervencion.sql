-- La cola roja: la nota del auditor, y RESOLVER.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · UN TERCER ORIGEN PARA LAS NOTAS, Y NO ES COSMÉTICO
--
-- `negocio.notas.autor_id` admite nulo **solo para las importadas**: el endpoint de notas del CRM no
-- devuelve autor, así que ahí el nulo significa «no se sabe quién la escribió». Y `origen` existe
-- justamente para que ese nulo no mienta — lo dice el comentario de la columna: *«esto distingue
-- "importada sin autor" de "escrita acá"»*.
--
-- La nota del auditor **no tiene autor**: no la escribió una persona. Con los dos valores de hoy hay
-- que elegir entre dos mentiras:
--
--   · `plataforma` con `autor_id` nulo → una nota escrita acá por nadie, que es un estado que la
--     columna fue creada para hacer imposible;
--   · `importada` → la nota se leería como **traída del CRM**, y entonces el día que alguien mire
--     por qué el CRM tiene notas que no puso, la respuesta va a estar mal.
--
-- El tercer valor es la única salida honesta: la escribió esta plataforma, y la escribió una máquina.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · RESOLVER, Y POR QUÉ NO ALCANZA CON CERRAR LOS HALLAZGOS
--
-- Resolver una intervención es cerrar los hallazgos abiertos y quitarle las etiquetas al CRM. Con eso
-- solo, queda un agujero de hasta diez minutos y uno permanente:
--
--   · **El de diez minutos.** La cola roja entra por las etiquetas de NUESTRA caché, y la caché se
--     refresca cuando el barrido relee los contactos. Entre resolver y ese barrido, el contacto sigue
--     en la cola: alguien ya lo atendió y la pantalla sigue pidiendo que lo atiendan.
--
--   · **El permanente.** Un veredicto rojo **puede no tener ningún hallazgo** —la intervención y el
--     hallazgo son dos salidas independientes, que es la separación que este módulo entero vino a
--     hacer— y entonces no hay nada que marcar como resuelto. Ese contacto no sale de la cola nunca.
--
-- Por eso la resolución se anota **en el análisis**, que es donde vive la intervención. Y eso da algo
-- más, que la pantalla del técnico va a necesitar: **«resuelto por un humano» y «el patrón está
-- arreglado» son dos estados distintos.** Un vendedor puede resolver el caso puntual y la falla del
-- agente sigue exactamente donde estaba.
--
-- ── Y LA COLUMNA ES UNA FECHA, NO UNA BANDERA ──────────────────────────────
--
-- Igual que `hallazgos.resuelto_el` y que `tareas.completada_el`: **abierto es la ausencia de una
-- fecha**. Con un booleano, la cola dependería de que alguien lo apague, y además se perdería cuándo
-- se resolvió — que es lo único que después permite medir cuánto tarda alguien en tomar una urgencia.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · EL TERCER ORIGEN ────────────────────────────────────────────────────
--
-- Se reemplaza la restricción en vez de agregar otra: dos `check` sobre la misma columna se cumplen
-- los dos, así que dejar el viejo puesto haría que `auditor` siguiera siendo rechazado y el síntoma
-- sería una migración aplicada que no cambió nada. Es la misma nota de la 021 y de la 030.
alter table negocio.notas
  drop constraint notas_origen_check;

alter table negocio.notas
  add constraint notas_origen_check
  check (origen in ('plataforma', 'importada', 'auditor'));

comment on column negocio.notas.origen is
  'De dónde salió la nota. `plataforma` = la escribió una persona acá y `autor_id` dice quién; '
  '`importada` = vino del CRM, que no devuelve autor; `auditor` = la escribió el auditor de IA, que '
  'no es una persona. Los tres se distinguen porque el nulo de `autor_id` significa algo distinto en '
  'cada uno.';

-- ── 2 · LA RESOLUCIÓN, EN EL ANÁLISIS ───────────────────────────────────────
alter table negocio.analisis_del_agente
  -- Abierto = sin fecha. Ver el encabezado.
  add column if not exists resuelto_el timestamptz,
  add column if not exists resuelto_por uuid;

-- La clave foránea va aparte de las columnas: `add column if not exists` no admite una restricción de
-- tabla al lado, y esta migración tiene que poder reaplicarse — es la regla que la 024 dejó escrita y
-- que una prueba hace cumplir corriendo el archivo dos veces.
alter table negocio.analisis_del_agente
  drop constraint if exists analisis_resuelto_por_fk;

alter table negocio.analisis_del_agente
  add constraint analisis_resuelto_por_fk
  foreign key (org_id, resuelto_por) references identidad.usuarios (org_id, id);

-- Quién resolvió **solo si se resolvió**. Al revés no hace falta prohibirlo: una resolución sin
-- persona es legítima el día que la resuelva un proceso, y hoy no ocurre.
alter table negocio.analisis_del_agente
  drop constraint if exists analisis_resuelto_por_con_fecha;

alter table negocio.analisis_del_agente
  add constraint analisis_resuelto_por_con_fecha
  check (resuelto_el is not null or resuelto_por is null);

-- La consulta de la cola roja: las intervenciones ABIERTAS de la empresa. Es la misma forma que
-- `hallazgos_abiertos` y por el mismo motivo — el índice completo ordenaría por fecha sobre todos los
-- análisis, y las intervenciones sin resolver son un puñado.
create index if not exists intervenciones_abiertas
  on negocio.analisis_del_agente (org_id, contacto_id)
  where intervencion and resuelto_el is null;
