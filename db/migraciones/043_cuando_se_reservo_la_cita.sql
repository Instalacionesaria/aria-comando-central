-- Cuándo se RESERVÓ la cita. La columna que la `042` dejó afuera por no estar medida.
-- ============================================================================
--
-- La `042` agregó tres columnas y dejó ésta anotada como pendiente, con el motivo escrito: el
-- campo se llamaba `createdAt` en el enunciado, y `createdAt` **no aparecía ni una vez en el
-- repositorio**. En las dos familias vecinas de la misma API el sello de creación se llama
-- `dateAdded` (contactos y mensajes), así que había dos nombres candidatos y ninguna medición.
--
-- ── AHORA ESTÁ MEDIDO, Y EL RESULTADO ESTÁ EN `lib/ghl/calendarios.ts` ──────
--
-- Contra la subcuenta real, 402 eventos de su calendario principal, con `scripts/medir-cita.mjs`:
--
--   · **`dateAdded`, presente en 402 de 402.** `createdAt` no existe en la respuesta.
--   · **Difiere de `startTime` en 402 de 402**, y es **ANTERIOR en 402 de 402**. Ésa es la
--     comprobación que decide si sirve: si viniera igual a `startTime` sería la hora de la cita con
--     otro nombre, y una tasa «por período» calculada con eso daría exactamente lo mismo que una
--     por fecha de ocurrencia — con la diferencia de que nadie lo notaría.
--
-- ── PARA QUÉ ─────────────────────────────────────────────────────────────────
--
-- Es lo único que permite dar una tasa del embudo POR PERÍODO en vez de acumulada. Sin ella,
-- «cuántos agendaron en los últimos 7 días» no se puede contestar: lo que la tabla sabe es cuándo
-- OCURRE la cita, que es otra pregunta. Es el techo que la pantalla de Conversation declara hoy.
--
-- ── NULABLE, Y CON UN PISO QUE HAY QUE DECIR EN PANTALLA ────────────────────
--
-- Igual que las tres de la `042`: las citas ya guardadas no se pueden rellenar desde una migración
-- —regla de la `040`, el migrador ve cero filas bajo RLS forzada—. Se llena hacia adelante, en el
-- primer barrido que toque cada cita.
--
-- Y ahí está el detalle que no es del esquema sino del producto: durante un tiempo va a haber citas
-- con la columna nula, y **una cifra «por período» que las ignore en silencio miente por omisión**.
-- Hasta que el barrido complete el histórico, cualquier pantalla que use esta columna tiene que
-- decir desde cuándo mide. El barrido recorre una ventana móvil, así que las citas viejas fuera de
-- esa ventana **no se van a completar solas nunca**.

alter table negocio.citas
  add column if not exists reservada_el timestamptz;

comment on column negocio.citas.reservada_el is
  'Cuándo se reservó la cita (`dateAdded` del CRM; medido presente en 402 de 402, y anterior a '
  '`startTime` en 402 de 402). Es lo que permite dar tasas por período en vez de acumuladas. Nula '
  'en las citas sincronizadas antes de esta migración y en las que quedaron fuera de la ventana '
  'del barrido: quien la use tiene que decir desde cuándo mide.';
