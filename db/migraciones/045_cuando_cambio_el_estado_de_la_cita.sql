-- Cuándo cambió de estado la cita. El vecino que la 042 dejó pisándose.
-- ============================================================================
--
-- La 042 puso tres reglas cuidadas en el `on conflict` de `negocio.citas`, y a tres líneas de
-- distancia `estado_ghl` se seguía pisando plano. O sea que la tabla sabe que una cita ESTÁ
-- cancelada y no sabe **cuándo se canceló ni qué era antes** — exactamente el defecto que
-- `inicio_anterior_el` cierra para la hora, en la columna de al lado y sin que nadie lo notara.
--
-- ── POR QUÉ IMPORTA, Y NO ES SIMETRÍA ───────────────────────────────────────
--
-- Es el dato que separa dos hechos que hoy se ven iguales: una cita que se canceló **el día que se
-- reservó** y una que se canceló **una hora antes de empezar**. La primera es ruido de agenda; la
-- segunda es un plantón anunciado, y es justo lo que el agente de Appointment Flow existe para
-- evitar. Con una sola columna de estado, las dos son «cancelled» y cualquier tasa las suma.
--
-- Medido el 2026-09-13 en producción: **160 de 316 citas canceladas**, el 50,6 %. Es el único
-- indicador de Appointment Flow con volumen real, y hoy no se puede fechar ninguna de las 160.
--
-- ── LA GUARDA, QUE ES LO MISMO QUE APRENDIÓ LA 042 ──────────────────────────
--
-- El barrido corre una vez por hora sobre las mismas citas. Sin el `case when ... is distinct
-- from`, cada pasada copiaría el estado a `estado_anterior_ghl` y pondría `estado_cambiado_el` en
-- ahora, y entonces **todas las citas parecerían haber cambiado de estado recién**. La cifra
-- resultante no sería un dato del negocio: sería el reloj del cron.
--
-- `is distinct from` y no `<>` por el mismo motivo que la 042: `estado_ghl` **sí es nulable** acá
-- —es «el CRM no lo dijo»— así que con `<>` un nulo daría nulo, el `case` caería al `else`, y la
-- transición «sin estado → cancelada» no se registraría nunca. A diferencia de la 042, esta
-- diferencia SÍ se puede ejercitar con una prueba, y se ejercita.
--
-- ── NULABLES, Y EL PISO DE SIEMPRE ──────────────────────────────────────────
--
-- Las 316 citas que ya están nacen con las dos columnas nulas y una migración no las puede
-- rellenar —regla de la 040: el migrador ve cero filas bajo RLS forzada—. Se llenan hacia adelante
-- y sólo cuando una cita CAMBIE de estado; una que ya está cancelada y no se toca más no se llena
-- nunca. El nulo es «no se sabe cuándo», nunca «no cambió».

alter table negocio.citas
  add column if not exists estado_anterior_ghl text,
  add column if not exists estado_cambiado_el  timestamptz;

comment on column negocio.citas.estado_anterior_ghl is
  'El estado que la cita tenía antes del último cambio. Nulo = nunca cambió de estado desde que la '
  'guardamos, o es anterior a esta migración. Ver `estado_cambiado_el`.';

comment on column negocio.citas.estado_cambiado_el is
  'Cuándo cambió de estado por última vez. Es lo que separa una cita cancelada el día que se reservó '
  'de una cancelada una hora antes de empezar — hoy las dos son «cancelled» y toda tasa las suma. '
  'Nula en las citas anteriores a esta migración y en las que no cambiaron de estado desde entonces: '
  'el nulo es «no se sabe cuándo», nunca «no cambió».';
