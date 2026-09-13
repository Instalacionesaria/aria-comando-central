-- De dónde salió el mensaje. El campo que el CRM manda y que se tiraba al guardar.
-- ============================================================================
--
-- Es el tercer caso de la misma forma —`ghl_calendario_id` en la `038`, `reservada_el` en la `043`—
-- y el más caro de los tres: **el CRM lo manda, el lector lo lee, y `guardar()` no lo ponía en el
-- `insert`**. La diferencia con los otros dos es que de éste depende toda la atribución.
--
-- ── LO QUE SE PIERDE HOY, Y ESTÁ MEDIDO ─────────────────────────────────────
--
-- `lib/ghl/conversaciones.ts` ya decía que `source` es *«el ÚNICO campo que distingue un mensaje que
-- escribió una persona de uno que disparó una automatización»*. Se usa una sola vez —`autorDe()`
-- decide `persona` si vale `app` y `agente` si no— y después se descarta. O sea que dentro de
-- `autor = 'agente'` quedan colapsados, para siempre y sin forma de separarlos:
--
--   · el agente de IA,
--   · los flujos del CRM (`workflow`),
--   · las campañas y las acciones masivas,
--   · y los envíos por API de esta misma aplicación.
--
-- ── LA MEDICIÓN QUE LO DECIDIÓ ──────────────────────────────────────────────
--
-- Con `scripts/medir-mensaje.mjs`, censo COMPLETO sobre las 518 conversaciones de nuestros
-- contactos —no una muestra—, emparejando cada fila nuestra con su mensaje del CRM por
-- `ghl_mensaje_id`. De las **2.182 filas selladas con el identificador del agente**:
--
--     workflow   1.560   71,5 %   ← flujos de la cuenta, con este usuario como DUEÑO
--     app          417   19,1 %
--     api          205    9,4 %
--
-- **El identificador no discrimina.** Filtrar por él se lleva 1.560 mensajes que disparó un flujo
-- del CRM, y cualquier cifra «por agente» construida sobre ese filtro mezcla al agente con las
-- automatizaciones de la casa — dando un número plausible. La `026` había elegido ese identificador
-- por FRECUENCIA, suponiendo que los salientes sin sellar eran los automáticos; la medición muestra
-- que las automatizaciones están de los dos lados.
--
-- Y los valores medidos son sólo cuatro: `workflow`, `app`, `api` y ausente (las actividades, que no
-- se guardan). `campaign` y `bulk_actions` están en la documentación del tipo y **no aparecieron ni
-- una vez** — o sea que esa lista es del papel, no medida. Por eso la columna es `text` libre y no
-- un `check`: un `check` sobre valores que el proveedor no confirmó rechazaría filas reales el día
-- que mande uno nuevo, y perder el mensaje es peor que guardarlo con un valor que todavía no
-- entendemos.
--
-- ── NULABLE, Y CON UN PISO QUE HAY QUE DECIR ────────────────────────────────
--
-- Las 5.606 filas que ya están no se pueden rellenar desde una migración —regla de la `040`, el
-- migrador ve cero filas bajo RLS forzada— así que nacen nulas. Se llenan por dos caminos: las
-- nuevas al insertarse, y las viejas cuando la ingesta vuelva a pasar por su conversación, gracias
-- al `coalesce` del `on conflict`. Ese segundo camino es lento y parcial: **quien use esta columna
-- para una tasa tiene que tratar el nulo como «no se sabe» y no como «no fue el agente»**, que es
-- justo el cero no medido que este proyecto persigue en todas partes.

alter table negocio.mensajes
  add column if not exists fuente text;

comment on column negocio.mensajes.fuente is
  'El `source` de GoHighLevel: de dónde salió el mensaje (`workflow`, `app`, `api`… medidos). Es lo '
  'ÚNICO que separa al agente de IA de una automatización del CRM: medido, el 71,5 % de los '
  'salientes sellados con el identificador del agente son `workflow`. Nula en las filas anteriores a '
  'esta migración y en las que la ingesta todavía no volvió a ver: el nulo es «no se sabe», nunca '
  '«no fue el agente».';
