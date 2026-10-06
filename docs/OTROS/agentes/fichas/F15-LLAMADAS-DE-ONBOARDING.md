# F15 · Client Success › Llamadas de onboarding

> Agregados sin modelo sobre las llamadas de onboarding que los Analizadores ya analizan: qué esperan los
> clientes y qué señales de riesgo aparecen, para que el cerebro los lea (`D-20`, `D-21`).

| campo | valor |
|---|---|
| Tipo | RETIENE (agregados) |
| Lugar en el front | Client Success › Llamadas de onboarding, y su caja del pie |
| Estado | **Hecho** en AG11, el 2026-10-05, sólo lectura |
| Modelo | Ninguno |
| Permisos | `analizadores.ver` |
| Código | `lib/negocio/llamadasDeOnboarding.ts`; la herramienta `llamadas_de_onboarding` en `lib/agentes/executive/adaptadores/analizadores.ts` |

## Qué produce

| agregado | qué dice |
|---|---|
| Lo que esperan | **No se cuenta**: la meta de cada cliente es texto libre, y dos metas parecidas escritas distinto contarían como dos. Se lista por cliente, y el aviso lo dice |
| Riesgos | Cuántas llamadas traen señales de riesgo, y de qué tipo |
| Estado por cliente | EN RIESGO, ATENCIÓN o AL DÍA, como el Lienzo (pantalla «Client Success · Analizador OB»), contado, por la última llamada del cliente en la ventana. La regla es provisional y está escrita en el código, no en el modelo: EN RIESGO si el análisis dice arranque bloqueado o compromiso bajo; ATENCIÓN si está a medias o trae alguna señal de riesgo; AL DÍA si no |

## El vínculo

El mismo de `F14`: por correo y, si no, por cita cercana. Una llamada de onboarding sin vínculo se cuenta
aparte.

## Requisitos

- **AG-F15-1 · Sólo lee** (`D-21`): no escribe al cliente ni al CRM.
- **AG-F15-2 · Ninguna transcripción viaja al cerebro**: conteos, el estado y la meta de cada cliente. Las
  frases citables de onboarding quedan para después: el análisis OB trae momentos clave, no objeciones con su
  evidencia.
- **El cliente va por su empresa**, y si no la dijo, sin nombre: el nombre del titular y su correo son datos de
  una persona (`D-17`).

## Sugerencias en la caja del pie

«¿Qué clientes están en riesgo?», «¿Qué esperan los clientes que entran?».

## Qué dato falta

Volumen: son pocas llamadas de onboarding y de una sola empresa.
