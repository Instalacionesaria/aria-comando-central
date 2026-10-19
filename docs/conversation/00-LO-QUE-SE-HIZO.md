# Conversation — lo que se hizo hasta el 2026-10-10

> Escrito el **2026-10-10**, al abrir la carpeta. Conversation —Systems › Conversation, `#v-conversation`, la
> capacidad `auditor.ver`— nunca tuvo carpeta de requisitos: hasta hoy la única traducción del documento funcional
> era la foto `docs/OTROS/estado actual/04-CONVERSATION.md` (corte del 2026-09-28), y la ficha de su agente es
> `docs/OTROS/agentes/fichas/F05-CONVERSATION.md`. Este documento junta lo construido, con su historia y dónde vive;
> el siguiente, `01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, dice lo que se va a hacer. Las cifras de producción de
> acá son del 2026-09-28, de la foto, salvo donde se dice otra fecha: **no se re-midieron**.

---

## 1 · Lo que pide el documento funcional

Está resumido en `docs/OTROS/estado actual/04-CONVERSATION.md` § 1: supervisar, analizar y mejorar las conversaciones
automatizadas, con dos módulos —**Lead Flow**, conseguir la cita, y **Appointment Flow**, que asista—, cada uno con un
agente de texto, uno de voz y un supervisor que no conversa sino que evalúa. Los KPI principales son el **Booking
Rate** y el **Show Rate**.

## 2 · La historia, en el orden en que pasó

| fecha | commit | qué |
|---|---|---|
| 2026-08-18 | `a7f8f91` | El port del prototipo: la pantalla era la maqueta de `lib/aios/conversation.js`, con cifras escritas a mano |
| 2026-08-31 | `a411478` a `569b5cc` | El supervisor: el contrato del veredicto, los catorce criterios, la atribución de cada hallazgo, la cola de intervenciones y «la pantalla del técnico» |
| 2026-09-01 | `a436cd0` | La auditoría en dos pestañas, LeadFlow y AppFlow |
| 2026-09-09 | `833fc51` | Los cinco tableros de Inteligencia entran a la estética de operación (`estetica-op`) |
| 2026-09-10 | `f0f09b7` | El supervisor se archiva dentro de Conversation, y la maqueta se borra |
| 2026-09-11 | `f25afc2`, `a4ba7bf` | La cita guarda lo que el CRM le decía, cuándo se reagendó y cuándo se reservó |
| 2026-09-13 | `6e33862` | El historial de los prompts: qué decía, desde cuándo y quién lo cambió |
| 2026-09-14 | `8ee51a5` a `9931f4d` | Las cifras de verdad: Appointment Flow con sus cuatro cifras, el show rate que registra el closer, la confirmación, el booking rate, la atribución, el precall y el sentimiento; la cancelación deja de sumar el descarte propio |
| 2026-09-15 | `13ce499` | Conversation vuelve a ser un tablero: el selector de cuatro períodos, la cadena y la bifurcación |
| 2026-09-16 | `bddb516` | Dos cifras de Lead Flow dejan de describir un caso suelto |
| 2026-09-21 | `1164984`, `8dcb619` | Los predicados de cita en `lib/negocio/citasAlcanzables.ts`; la sección pide `auditor.ver` |
| 2026-10-04 a 10-06 | `cd851b3`, `13723a0`, `5f15c01`, `8933e20`, `fe727e5` | Los agentes: el uso del auditor, el cerebro con sus herramientas, Conversation en la tabla común de señales (el detector y el plan) y el comentario de la cabecera |

## 3 · Lo que había en la pantalla hasta CN-3

(Así era la pestaña cuando se escribió este documento. Desde el 2026-10-10 dibuja el front del prototipo:
`docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`.)

`components/views/ConversationView.jsx` monta el panel con la estética de operación
(`components/views/ConversationView.jsx:46@6f3bdb5`). El panel, `components/conversation/PanelDeConversation.jsx`, tiene
cuatro pestañas:

- **Lead Flow y Appointment Flow**, con el segmentado de los cuatro períodos (`lib/negocio/periodo.ts:83-96`):
  - Lead Flow: la cadena del contacto, los tiempos y la atribución por fuente y por campaña;
  - Appointment Flow: las citas, lo que dice el CRM y lo que dice el closer, el precall y el sentimiento;
  - cada una cierra con su caja de lo que falta, `FLUJOS` (`components/conversation/PanelDeConversation.jsx:95@6f3bdb5`).
- **Auditoría y Prompts**, que dibuja `Cuerpo` de `components/auditoria/PanelDeAuditoria.jsx`: los agentes
  auditados con sus patrones y casos, la tarjeta de señales y el plan, y los prompts de cada agente.

Una sola ruta, `GET /api/auditoria` (`app/api/auditoria/route.ts:112-157@e1ccf44`), compone todo:

| bloque | de dónde sale |
|---|---|
| la cadena del lead | `lib/negocio/indicadoresDelLead.ts:196` |
| la atribución | `lib/negocio/atribucionDelLead.ts:100` |
| las citas, la cancelación, el reagendamiento, la confirmación y la asistencia | `tasaDeCancelacion`, en `lib/negocio/indicadoresDeCitas.ts` |
| el precall | `lib/negocio/consumoDelPrecall.ts:143` |
| el sentimiento por flujo | `lib/auditor/sentimiento.ts:190` |
| la auditoría | `laPantallaDelTecnico`, en `lib/auditor/pantalla.ts` |
| las señales, el plan y el comentario de la cabecera | `lib/agentes/senales/lectura.ts` y `lib/agentes/cabecera.ts` |

Las ventanas son rodantes, `now()` menos los días. El cerebro tiene `lead_flow`, `atribucion_del_lead`,
`consumo_del_precall`, `sentimiento_por_flujo`, `auditoria_de_agentes` y `cancelacion_de_citas`
(`lib/agentes/executive/adaptadores/conversation.ts`). Desde CN-2 la ruta lee esos bloques de una sola lectura,
`lecturaDeConversation`, publica además la `pantalla` que arma, y el cerebro suma `conversation_en_cifras`
(`docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, CN1-15 y CN1-16). El detector tiene una regla, `CONV-PATRON-ABIERTO`
(`lib/agentes/detectores/conversation.ts:36`).

## 4 · Los agentes, en los datos

- **Son dos claves**: `chat_pre_agenda`, que se muestra como «LeadFlow», y `chat_post_agenda`, que se muestra como
  «AppFlow». Ningún mensaje dice qué agente lo escribió: el agente sale del territorio del contacto.
- **Los de voz no tienen ningún dato**: `negocio.llamadas` está vacía y nada la llena.
- **Lo de los flujos es del negocio entero**: la cadena del lead, las citas y la confirmación —un campo del CRM— no
  se le pueden atribuir a un agente.

## 5 · Lo que la foto del 2026-09-28 midió

A 30 días, el 2026-09-28 (`docs/OTROS/estado actual/04-CONVERSATION.md` § 2):

- **la cadena del lead**: 277 entraron, a 270 les escribimos, 161 respondieron; el booking rate, 50,2 % (139 de 277);
- **la cancelación**: 34,9 %;
- **la asistencia**: sin marcar, así que el show rate es un hueco;
- **la auditoría**: 70 análisis y 6 patrones con 24 casos;
- **los prompts**: ninguno cargado.

El negocio estaba casi quieto: ningún anuncio gastó después del 13 de septiembre, y entraron 8 contactos en quince
días.

## 6 · Lo que la foto dejó señalado

Los riesgos de `docs/OTROS/estado actual/04-CONVERSATION.md` § 7 que seguían abiertos y que el front nuevo toca:

- **tasas sin piso** sobre 1 a 5 casos (riesgo 16): el booking rate, la respuesta, la cancelación y el
  reagendamiento no lo aplicaban. Cerrado en CN-1: la lectura de la pantalla les pone el piso;
- **la pantalla no dice si su dato está viejo** (riesgo 22);
- **un hallazgo de LeadFlow se dibuja en la tarjeta de AppFlow** (riesgo 21);
- **dos comentarios dicen `tablero.ver`** cuando la sección pide `auditor.ver` (riesgo 20). Cerrado en CN-3.

El primer riesgo de la foto —Executive publicaba cifras inventadas en nombre de Conversation— se cerró el 2026-10-01,
cuando la maqueta del Executive se retiró (`4e9a242`).
