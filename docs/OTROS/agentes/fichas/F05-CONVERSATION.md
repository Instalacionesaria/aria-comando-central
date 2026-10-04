# F05 · Systems › Conversation

> El auditor de los agentes del CRM ya existe y se conserva entero. Lo nuevo es que sus hallazgos se traducen
> a la tabla común de señales, con la taxonomía `issue_source` de Arq, y que su pantalla gana la tarjeta de
> Señales y el botón «Plan de acción».

| campo | valor |
|---|---|
| Tipo | MIDE. El auditor es el Supervisor de Arq, que «no es un agente conversacional» (Arq:793-801) |
| Lugar en el front | Systems › Conversation (Auditoría y Prompts) |
| Estado | **El auditor existe** y no cambia. La traducción a señales **se construye** en AG13 |
| Modelo | El auditor, `claude-sonnet-5`, sin cambio. La traducción, ninguno |
| Permisos | Todo con `auditor.ver`, la capacidad de su sección. Resolver señales: `senales.resolver` con la pantalla `conversation` |
| Código | `lib/auditor/*` (no cambia); `lib/agentes/detectores/conversation.ts` (nuevo) |

## Qué lee

Los hallazgos del auditor de 14 días (`negocio.hallazgos`), por agente del CRM (LeadFlow y AppFlow) y por
patrón.

## Qué produce

Una señal por agente y patrón, con su muestra, su `issue_source` (`02`, `AG-37`) y su evidencia como ids de
conversaciones, **nunca citas**: las conversaciones son de los leads del cliente.

## Lo que no cambia

- El cuerpo y el modelo del auditor (`D-15`), y su voz hasta que se evalúe (`D-26`).
- Que el auditor sea el único escritor de `negocio.hallazgos`.
- Que **una persona aprueba y publica** cualquier cambio de prompt: el auditor propone (Arq:933-949).
- Que el auditor actúa sobre el CRM cuando el veredicto es rojo (la nota y la etiqueta que pausa al agente):
  es lo que ya hacía, no una acción nueva de esta fase.

## Lo que se suma antes, en AG2

El uso de cada análisis en `uso_de_ia` y sus fallos en Incidentes, agregados por corrida y situación.

## El Plan de acción

Por agente del CRM y por patrón, con su `issue_source` y la revisión recomendada; ordenado por gravedad (rojo,
después amarillo) y por cuántas conversaciones toca.

## Sugerencias en la caja del pie

«¿Qué está haciendo mal LeadFlow?», «¿Qué patrón se repite más esta semana?», «¿Cuántas citas se cancelan?».

## Fuera

La auditoría de los agentes de voz (`D-23`): `negocio.llamadas` no tiene filas para auditar.

## Qué dato falta

`missing_tool`, `workflow_configuration` y `external_failure` no tienen fuente hoy en el auditor.
