-- La quinta tarea del cron: `auditoria`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA MISMA MIGRACIÓN QUE LA 021, POR EL MISMO MOTIVO, Y ESO ES BUENA SEÑAL
--
-- La `014` cerró la lista de tareas a propósito, y su comentario sigue siendo correcto:
--
--     -- Lista CERRADA, al contrario de `ingesta_pulso.clave`, y la asimetría es a propósito: […]
--     -- acá los valores los escribe UN solo archivo —`lib/negocio/barrido.ts`— y un valor que no
--     -- está en la lista es un error de programación que conviene que reviente en la primera corrida.
--
-- Y revienta, que es lo que se espera de ella: sin este archivo, el primer sello de `auditoria` aborta
-- con un `23514`. La restricción hace su trabajo — se amplía la lista, no se abre.
--
-- Ya pasó una vez con `contactos` en la 021, y el que esto vuelva a hacer falta es lo que confirma que
-- la lista cerrada valía la pena: **una tarea nueva no se puede colar sin que alguien la escriba acá.**
--
-- ── EL ORDEN IMPORTA, Y NO ESTÁ EN ESTE ARCHIVO ──────────────────────────────
--
-- `auditoria` tiene que correr **después** de `mensajes` en la misma corrida, y por un motivo directo:
-- el antirrebote del auditor cuenta los mensajes del agente que hay en NUESTRA base. Corriendo antes
-- de la ingesta, contaría los de la corrida anterior — o sea que un contacto con cinco mensajes nuevos
-- se auditaría diez minutos tarde, y con el transcript incompleto.
--
-- Eso lo garantiza el orden de la lista en `HORARIOS` de `lib/negocio/barrido.ts`, con su prueba: la
-- base no puede expresar «esta tarea antes que esa».
--
-- ── Y ES LA PRIMERA TAREA QUE NO LE HABLA AL CRM ────────────────────────────
--
-- Las otras cuatro cuentan peticiones a GoHighLevel en `ultima_corrida_llamadas`. Ésta cuenta
-- **inferencias pagadas al proveedor del modelo**, que es una unidad distinta y más cara. El nombre de
-- la columna no cambia —lo que mide es «cuánto costó esta corrida»— pero conviene tenerlo escrito acá,
-- porque quien sume las columnas de las cinco tareas va a estar sumando peras con manzanas.
-- ═════════════════════════════════════════════════════════════════════════════

-- Se reemplaza la restricción en vez de agregar otra: dos `check` sobre la misma columna se cumplen
-- los dos, así que dejar el viejo puesto haría que `auditoria` siguiera siendo rechazada y el síntoma
-- sería una migración aplicada que no cambió nada. Es la misma nota que dejó la 021.
alter table negocio.tareas_programadas
  drop constraint tareas_programadas_tarea_check;

alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria'));

comment on column negocio.tareas_programadas.tarea is
  'Qué tarea del cron. Lista cerrada, ampliada en la 021 con `contactos` y en la 030 con `auditoria` '
  '— releer las etiquetas, traer los mensajes, barrer el calendario, la sonda de aislamiento, y '
  'auditar a los agentes de IA. `auditoria` es la única que no le habla al CRM: lo que cuenta en '
  '`ultima_corrida_llamadas` son inferencias pagadas al modelo, no peticiones a GoHighLevel.';
