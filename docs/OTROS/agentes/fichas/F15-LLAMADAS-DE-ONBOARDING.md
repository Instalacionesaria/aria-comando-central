# F15 · Client Success › Llamadas de onboarding

> Agregados sin modelo sobre las llamadas de onboarding que los Analizadores ya analizan: qué esperan los
> clientes y qué señales de riesgo aparecen, para que el cerebro los lea (`D-20`, `D-21`).

| campo | valor |
|---|---|
| Tipo | RETIENE (agregados) |
| Lugar en el front | Client Success › Llamadas de onboarding, y su caja del pie |
| Estado | **Se construye** en AG11, sólo lectura |
| Modelo | Ninguno |
| Permisos | `analizadores.ver` |
| Código | `lib/negocio/llamadasDeOnboarding.ts` |

## Qué produce

| agregado | qué dice |
|---|---|
| Lo que esperan | Las expectativas más frecuentes de los clientes en su onboarding, por conteo |
| Riesgos | Cuántas llamadas traen señales de riesgo, y de qué tipo |
| Estado por cliente | EN RIESGO, ATENCIÓN o AL DÍA, como el Lienzo (pantalla «Client Success · Analizador OB»), contado |

## El vínculo

El mismo de `F14`: por correo y, si no, por cita cercana. Una llamada de onboarding sin vínculo se cuenta
aparte.

## Requisitos

- **AG-F15-1 · Sólo lee** (`D-21`): no escribe al cliente ni al CRM.
- **AG-F15-2 · Ninguna transcripción viaja al cerebro**: conteos y, con `analizadores.ver`, frases citables
  con su minuto.

## Sugerencias en la caja del pie

«¿Qué clientes están en riesgo?», «¿Qué esperan los clientes que entran?».

## Qué dato falta

Volumen: son pocas llamadas de onboarding y de una sola empresa.
