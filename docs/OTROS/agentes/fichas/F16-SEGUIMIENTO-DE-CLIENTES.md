# F16 · Client Success › Seguimiento de clientes — sólo diseño

> El avance de cada cliente, sus alertas de riesgo y las oportunidades de renovación y recompra. No se
> construye en esta fase (`D-05`, `D-21`).

| campo | valor |
|---|---|
| Tipo | RETIENE |
| Lugar en el front | Client Success › Seguimiento de clientes, hoy «Próximamente» |
| Estado | **Sólo diseño** |
| Modelo | Ninguno para detectar; el del cerebro para contestar |

## De qué se alimentaría

- Las llamadas de onboarding (`F15`): lo que el cliente espera y sus riesgos.
- El avance del método de cada cliente en Fundaciones (qué pasos completó).
- Los indicadores de la garantía que Det propone, que **no tienen fuente** todavía.

## Qué produciría

Señales con el mismo contrato que los detectores (`02`): un cliente que se queda quieto en el método, un riesgo
de una llamada de onboarding sin seguimiento, una renovación que se acerca. Serían de un departamento nuevo
en la tabla común, `client_success`.

## Requisitos de diseño

- **AG-F16-1 · Sólo lee y recomienda**: escribirle al cliente es una acción futura (`01`, `AG-12`).
- **AG-F16-2 · Sales y Client Success tienen menos método detrás** (Det:274-275): las reglas se escriben con
  el equipo antes de construir.

## Lo que falta decidir cuando se construya

Qué es «avance» para cada programa, qué es una renovación y de dónde sale su fecha, y qué indicadores de la
garantía se miden.
