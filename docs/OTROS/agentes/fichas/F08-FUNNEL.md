# F08 · Marketing › Funnel (Tu landing y Tu VSL)

> El mismo entrevistador de ICP & Oferta, sólo por chat, para la landing y el guion del VSL. Suma, en
> diseño, la precall y el VSL de gracias (`D-18`).

| campo | valor |
|---|---|
| Tipo | CREA |
| Lugar en el front | Marketing › Funnel › Tu landing y Tu VSL |
| Estado | **Existe.** Suma el uso (AG2, después de integrar la rama `feature/icp-oferta-v2`) y recibe el pedido de «@ agente» (AG7). La precall y el VSL de gracias: **sólo diseño** |
| Modelo | `claude-sonnet-5`, sin cambio |
| Permisos | `tools.ver` para leer; `tools.editar` para conversar y generar |
| Código | El de `F01`, con las herramientas de `lib/fundaciones/herramientas.ts` que son sólo chat |

## Qué lee y qué produce

Lo mismo que `F01`: preguntas, lo heredado (la landing hereda del VSL) y el documento generado por la ruta de
siempre. La landing produce el «Prompt para AI Studio».

## Lo que cambia en esta fase

- **AG-F08-1** · El uso queda registrado.
- **AG-F08-2** · Recibe el pedido de «@ agente», cargado sin enviar.
- **AG-F08-3** · El cerebro lee su estado (qué documentos hay), no su texto entero.

## La precall y el VSL de gracias (diseño)

| pieza | qué es | metodología que se porta |
|---|---|---|
| Tu precall | El guion del video que el prospecto recibe después de agendar y antes de la llamada, para llegar caliente y no faltar. Los entregables salen siempre de la oferta heredada | `precall` |
| Tu VSL de gracias | El guion del video de la página de gracias, para que el prospecto se presente a la llamada recién agendada | `vsl-gracias` |

Las dos persiguen lo mismo que mide Sales: que la gente se presente. Cuando haya asistencia registrada, el
cerebro podrá cruzar «tiene precall» con la asistencia; hoy no hay asistencias registradas.

## Sugerencias en la caja del pie

«¿Qué le falta a mi VSL?», «¿Mi landing usa la oferta actual?».

## Qué dato falta

El uso real: Det registra cero versiones de la landing en producción.
