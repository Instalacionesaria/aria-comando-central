# F02 · Research › Radar (el Espía y el Scraper)

> El Espía analiza los anuncios de la competencia con el modelo y guarda su análisis; el Scraper encuentra y
> puntúa leads sin modelo. El cerebro lee los dos. «Enviar hallazgos a Copywriter» queda diseñado.

| campo | valor |
|---|---|
| Tipo | CREA (el Espía); el Scraper no usa modelo |
| Lugar en el front | Research › Radar › Espía a tus competidores y Scraper; Sales › Leads › De Radar |
| Estado | **Existe.** Suma el uso (AG2) y tú neutro en sus textos (AG3). «Enviar hallazgos a Copywriter»: **sólo diseño** |
| Modelo | `claude-sonnet-5`, sin cambio |
| Permisos | `tools.ver` para leer; `tools.editar` para analizar (gasta tokens) y para scrapear (gasta saldo) |
| Código | `lib/tools/espia.ts`, `lib/tools/historial-del-espia.ts`, `lib/tools/del-espia-al-scraper.ts` |

## Qué lee

Los primeros anuncios de un trabajo de espionaje, recortados, leídos del servidor con la organización de la
sesión. Sin anuncios no llama al modelo (`lib/tools/espia.ts:150-156`).

## Qué produce

Un análisis en markdown (hooks, ofertas y ángulos, estructuras, ideas), guardado por búsqueda en
`negocio.analisis_del_espia` (`068`) y leído por `analisisDe(trabajo)`.

## Lo que el cerebro lee

- `espia`: las búsquedas y el análisis guardado de una, con el texto recortado.
- `leads_del_scraper`: **sólo agregados** (por fuente, con y sin contacto, enviados al CRM). La ruta de la
  pantalla devuelve filas con correo y teléfono; el cerebro no las ve.

## «Enviar hallazgos a Copywriter» (diseño)

- **AG-F02-1** · Un botón en el análisis del Espía que lleva al Copywriter **el identificador de la
  búsqueda**, no el texto, con el molde de `lib/tools/del-espia-al-scraper.ts:13-19`. Copywriter lee el
  análisis guardado con ese identificador.
- **AG-F02-2** · Copywriter usa los hooks como **materia prima**, citándolos; no los copia como guion.
- Se construye con Copywriter (`F07`).

## Dream 100

Queda para después: no hay diseño.

## Sugerencias en la caja del pie

«¿Qué hooks se repiten en mi nicho?», «¿Cuántos leads me trajo el Scraper este mes?», «¿Cuántos de esos
leads ya están en el CRM?».

## Qué dato falta

El uso real: según Det, el Espía y el Scraper casi no se usan desde el 2026-09-23, y al 2026-10-04 no hay
ningún análisis guardado (la tabla es del día anterior).
