-- Los dos enlaces de una cita: la sala y el reagendado.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ SE PIDIÓ, Y QUÉ FALTABA PARA PODER DARLO
--
-- El menú del `+` del chat manda links configurados por la empresa —los de cobro del closer, los de
-- calendario del setter—. Se pidió que ADEMÁS ofrezca, sin que nadie los cargue, los dos que son de
-- la cita de ese contacto: la sala del meet y el link para reagendar.
--
-- La sala ya estaba: `negocio.citas.sala_url`, que sale del `address` de GoHighLevel. Medido en el
-- primer barrido real: presente en 1029 de 1052 citas, y **vacío en 23** — así que la opción tiene
-- que poder no aparecer.
--
-- El reagendado no estaba, y necesita tres cosas: el dominio del widget, el CALENDARIO de esa cita,
-- y su evento. El evento ya se guarda (`ghl_evento_id`). Las otras dos son estas columnas.
--
-- ── POR QUÉ EL CALENDARIO VA EN LA CITA Y NO ALCANZA EL DE LA EMPRESA ───────
--
-- `identidad.organizaciones_credenciales.crm_calendario_id` existe, pero es UNO y esa subcuenta
-- tiene **nueve calendarios activos** — cuatro `round_robin` y cinco `personal`, medido en
-- `lib/ghl/calendarios.ts`. El barrido lee todos, así que una cita puede no ser del configurado.
-- Usando el de la empresa, el link de reagendar abriría el calendario equivocado: la persona vería
-- horarios de otro closer y reservaría ahí. Se vería como que funciona.
--
-- Y el dato NO hay que ir a buscarlo: `CitaDeGhl.calendarioId` ya se lee de la respuesta del CRM y
-- se tiraba al guardar. Esta columna solo deja de tirarlo.
--
-- ── EL DOMINIO DEL WIDGET, Y UNA MEDICIÓN QUE CORRIGE A OTRA ───────────────
--
-- `lib/ghl/agendar.ts` dice que el dominio blanco del cliente responde 404. Eso se midió sobre
-- `link.<dominio>`, y sigue siendo cierto para ESE host. Pero medido hoy, 2026-09-07, el dominio de
-- reservas propio funciona igual que el de GoHighLevel:
--
--   https://calls.ariaia.com/widget/booking/<cal>?event_id=<ev>     → 200
--   https://api.leadconnectorhq.com/widget/booking/<cal>?event_id=<ev> → 200
--
-- Y con `event_id` el widget devuelve la cita de verdad en los datos de la página —el id del evento
-- y su fecha, junto a `event_address` y `selected_timezone`—, o sea que reagenda en vez de ofrecer
-- una reserva nueva. Sin el parámetro, esos datos no están.
--
-- Es NULABLE y con reserva: sin dominio propio se usa el de GoHighLevel, que está medido y funciona
-- para toda empresa. La reserva es peor pero no rota — mandarle a un prospecto un link que dice
-- `leadconnectorhq.com` le cuenta con qué CRM trabajás.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.citas
  add column if not exists ghl_calendario_id text;

comment on column negocio.citas.ghl_calendario_id is
  'El calendario de GoHighLevel de ESTA cita, que no es necesariamente el configurado en la '
  'empresa: la subcuenta tiene nueve y el barrido lee todos. Es lo que hace que el enlace de '
  'reagendar abra el calendario correcto. Nulo en las citas guardadas antes de esta migración.';

alter table identidad.organizaciones_credenciales
  add column if not exists crm_dominio_reservas text;

comment on column identidad.organizaciones_credenciales.crm_dominio_reservas is
  'El dominio propio del widget de reservas, sin barra final — por ejemplo '
  '«https://calls.ariaia.com». Nulo usa el de GoHighLevel, que funciona igual pero le muestra al '
  'prospecto con qué CRM trabaja la empresa.';
