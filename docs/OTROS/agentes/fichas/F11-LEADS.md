# F11 · Sales › Leads (Todos, De GHL, De Radar, Plan de prospección)

> Sin agente propio (`D-24`): el cerebro lee la cohorte de GHL y los agregados del Scraper. El Plan de
> prospección ya existe como herramienta que crea. «Todos» queda diseñado.

| campo | valor |
|---|---|
| Tipo | Sin agente; el Plan de prospección es CREA y ya existe |
| Lugar en el front | Sales › Leads y sus cuatro pestañas |
| Estado | **Herramientas del cerebro** (AG5 y AG6). «Todos»: **sólo diseño** |
| Modelo | El del cerebro; el Plan de prospección, `claude-sonnet-5` sin cambio |
| Permisos | De GHL: `tablero.ver` (la sección `contacts`). De Radar y Plan de prospección: `tools.ver` / `tools.editar` |

## Lo que el cerebro lee acá

- **De GHL**: `cohorte_de_leads`, con la fila de 14 claves y sin teléfono ni correo, como la pantalla
  (`app/api/leads-portal/route.ts:57`); los huecos de la pantalla.
- **De Radar**: `leads_del_scraper`, sólo agregados.

## El Plan de prospección

Ya existe como herramienta del método que genera, **sin agente conversacional a propósito**: gasta créditos
del monedero. Suma el registro del uso (AG2).

## «Todos» (diseño)

- **AG-F11-1** · La unión deduplicada de De GHL y De Radar, con la cifra por ICP y «Subir a HighLevel».
- **AG-F11-2** · Quien ve sólo una de las dos secciones ve sólo su mitad, y la pantalla lo dice.
- No tiene agente: el cerebro la lee con las dos herramientas.

## Sugerencias en la caja del pie

«¿Cuántos leads de alto ICP entraron este mes?», «¿Cuántos agendaron?», «¿Cuántos leads del Scraper no
están en el CRM?».

## Qué dato falta

Abrir Leads con contexto desde una respuesta del cerebro (por ejemplo, el tramo alto de ICP) espera a que el
portal acepte un filtro (LP08-P02). Hasta entonces, el botón abre la pestaña sin filtro y lo dice.
