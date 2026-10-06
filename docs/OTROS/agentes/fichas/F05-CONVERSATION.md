# F05 · Systems › Conversation

> El auditor de los agentes del CRM ya existe y se conserva entero. Lo nuevo es que sus hallazgos se traducen
> a la tabla común de señales, con la taxonomía `issue_source` de Arq, y que su pantalla gana la tarjeta de
> Señales y el botón «Plan de acción».

| campo | valor |
|---|---|
| Tipo | MIDE. El auditor es el Supervisor de Arq, que «no es un agente conversacional» (Arq:793-801) |
| Lugar en el front | Systems › Conversation (Auditoría y Prompts) |
| Estado | **El auditor existe** y no cambia. La traducción a señales, **hecha** en AG13 el 2026-10-06 |
| Modelo | El auditor, `claude-sonnet-5`, sin cambio. La traducción, ninguno |
| Permisos | Todo con `auditor.ver`, la capacidad de su sección. Resolver señales: `senales.resolver` con la pantalla `conversation` |
| Código | `lib/auditor/*` (no cambia); `lib/agentes/detectores/conversation.ts` (la traducción), `detector-de-conversation.ts` (para la pasada), `lib/agentes/plan/conversation.ts`; las rutas `app/api/auditoria/senales` y `…/umbrales` |

## Qué lee

Los casos abiertos de la pantalla (`laPantallaDelTecnico`, `lib/auditor/pantalla.ts`), con el texto de su
patrón ya elegido —el del hallazgo más reciente—, por agente del CRM (LeadFlow y AppFlow) y por patrón, y sólo
los detectados dentro de la ventana de la señal: **7 o 30 días**, como los demás detectores (AG-28). Esta ficha
decía 14 días; la ventana de la señal manda. Sin la tarea del auditor al día, la regla va a «sin medición».

## Qué produce

Una señal por agente y patrón (`CONV-PATRON-ABIERTO`, entidad `patron` con id `agente:patron`), con cuántas
conversaciones toca, su `issue_source` (`02`, `AG-37`) y su evidencia como ids de hallazgos y de contactos, **nunca
citas**: las conversaciones son de los leads del cliente. Con algún caso rojo, gravedad `alta`; si no, `media`.
No lleva muestra: no es una tasa, son casos que el auditor ya juzgó uno por uno. El umbral provisional es un caso;
firmado más alto, sólo los patrones que se repiten.

## Lo que no cambia

- El cuerpo y el modelo del auditor (`D-15`), y su voz hasta que se evalúe (`D-26`).
- Que el auditor sea el único escritor de `negocio.hallazgos`.
- Que **una persona aprueba y publica** cualquier cambio de prompt: el auditor propone (Arq:933-949).
- Que el auditor actúa sobre el CRM cuando el veredicto es rojo (la nota y la etiqueta que pausa al agente):
  es lo que ya hacía, no una acción nueva de esta fase.

## Lo que se sumó antes, en AG2 (hecho el 2026-10-04)

El uso de cada análisis en `uso_de_ia` (`auditor` y `auditor_mejora`) y sus fallos en Incidentes, agregados
por corrida y situación (`lib/incidentes/agrupados.ts`); el de la mejora del día, uno solo, sin agrupar.

## El Plan de acción

Por agente del CRM y por patrón, con su `issue_source` y la revisión recomendada; ordenado por gravedad (rojo,
después amarillo) y por cuántas conversaciones toca. Un grupo por agente, con su nombre de pantalla.

## La pantalla

El botón «Plan de acción» en la barra y la tarjeta de Señales al final, **en la pestaña Auditoría**, que es donde
están los patrones. Esa pestaña no tiene selector de período: sus señales son las de 7 días si se eligió 7 en un
flujo, y las de 30 si no, y la tarjeta dice cuál. En la tarjeta cada señal se nombra por su agente; en el plan,
por el título del patrón.

## Sugerencias en la caja del pie

«¿Qué está haciendo mal LeadFlow?», «¿Qué patrón se repite más esta semana?», «¿Cuántas citas se cancelan?».

## Fuera

La auditoría de los agentes de voz (`D-23`): `negocio.llamadas` no tiene filas para auditar.

## Qué dato falta

`missing_tool`, `workflow_configuration` y `external_failure` no tienen fuente hoy en el auditor.
