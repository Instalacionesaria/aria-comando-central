-- El carril amarillo: una mejora por día y por empresa, en frío.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- DOS LISTAS CERRADAS QUE SE AMPLÍAN, Y LAS DOS POR LO MISMO
--
-- `tareas_programadas.tarea` y `analisis_del_agente.disparo` son listas cerradas a propósito, y las
-- dos revientan con un `23514` en la primera corrida si este archivo no está. Es exactamente lo que se
-- espera de ellas: la lista se **amplía**, no se abre.
--
-- Ya pasó dos veces —la 021 con `contactos` y la 030 con `auditoria`— y que vuelva a hacer falta es lo
-- que confirma que valían la pena.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EL CARRIL AMARILLO ES UN `disparo` PROPIO Y NO `manual`
--
-- Los cuatro que había dicen **por qué corrió** un análisis: el antirrebote lo alcanzó, una señal lo
-- adelantó, alguien lo pidió, o es una siembra de línea base. El carril amarillo es un quinto motivo
-- de verdad: **nadie lo pidió y nada lo disparó** — es una elección diaria del sistema, en frío, sobre
-- una conversación que el carril rojo ya miró o que nunca va a mirar.
--
-- Meterlo en `manual` diría que lo pidió una persona, y esa columna es lo único que después permite
-- preguntar cuánto de la factura es de cada carril. Con los dos mezclados, esa pregunta no tiene
-- respuesta y el carril que gasta de más no se puede identificar.
--
-- ── Y NO LLEVA COLUMNAS NUEVAS, QUE ES LA PARTE QUE TIENTA ────────────────
--
-- Tienta darle su propia tabla: sus análisis no tienen intervención, no tienen nivel rojo, y su
-- hallazgo lleva un criterio que no está en ninguna de las dos rúbricas. Y sería un error: **la
-- pantalla del técnico los tiene que mostrar juntos**, porque para quien corrige un prompt son la
-- misma cosa — un patrón con su corrección. Dos tablas serían dos consultas, dos agrupamientos y dos
-- lugares donde el contador de casos puede discrepar.
--
-- Lo que los distingue es una columna que ya existe. Eso alcanza.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · LA SEXTA TAREA DEL CRON ─────────────────────────────────────────────
--
-- Se reemplaza la restricción en vez de agregar otra: dos `check` sobre la misma columna se cumplen
-- los dos, así que dejar el viejo puesto haría que `mejora` siguiera siendo rechazada y el síntoma
-- sería una migración aplicada que no cambió nada. Es la misma nota de la 021 y de la 030.
alter table negocio.tareas_programadas
  drop constraint tareas_programadas_tarea_check;

alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora'));

comment on column negocio.tareas_programadas.tarea is
  'Qué tarea del cron. Lista cerrada, ampliada en la 021 con `contactos`, en la 030 con `auditoria` y '
  'en la 033 con `mejora`. Las dos últimas son las únicas que no le hablan al CRM: lo que cuentan en '
  '`ultima_corrida_llamadas` son inferencias pagadas al modelo, no peticiones a GoHighLevel.';

-- ── 2 · EL QUINTO DISPARO ───────────────────────────────────────────────────
alter table negocio.analisis_del_agente
  drop constraint analisis_del_agente_disparo_check;

alter table negocio.analisis_del_agente
  add constraint analisis_del_agente_disparo_check
  check (disparo in ('debounce', 'alarma', 'manual', 'siembra', 'mejora'));

comment on column negocio.analisis_del_agente.disparo is
  'Por qué corrió este análisis. `debounce` = el antirrebote lo alcanzó; `alarma` = una señal del '
  'nivel 0 lo adelantó; `manual` = lo pidió una persona; `siembra` = es una marca de línea base y no '
  'un análisis; `mejora` = lo eligió el carril amarillo, en frío, una vez por día. El quinto es lo '
  'único que después permite preguntar cuánto de la factura es de cada carril.';

-- ── 3 · EL ÍNDICE DEL TOPE ──────────────────────────────────────────────────
--
-- El carril amarillo pregunta «¿cuántos escribí HOY?» antes de mirar nada, en cada corrida y por
-- empresa. Sin índice, esa pregunta recorre todos los hallazgos de la empresa para contar como mucho
-- uno — y es la consulta que decide si se gasta o no, así que corre siempre.
--
-- Parcial por criterio: el tope se cuenta **por criterio y no por severidad**, porque el carril rojo
-- también produce amarillos y contarlos acá bloquearía este carril con trabajo ajeno.
create index if not exists mejoras_del_dia
  on negocio.hallazgos (org_id, detectado_el desc)
  where criterio = 'contexto_no_leido';
