# F12 · Sales › Setter

> El «setter de IA» que el producto nombra es LeadFlow, el agente del CRM, y ya lo supervisa el auditor de
> Conversation (`D-21`). El agente de esta pantalla es el cerebro en la caja del pie, con el alcance de la
> pantalla.

| campo | valor |
|---|---|
| Tipo | OPERA, atendido por el cerebro |
| Lugar en el front | Sales › Setter (Inicio, Mi Día, Pipeline), y su caja del pie |
| Estado | **Herramientas del cerebro** (AG6) |
| Modelo | El del cerebro |
| Permisos | `setter.ver`, la capacidad de su sección |

## Lo que el cerebro lee acá

Con los mismos argumentos que las rutas de la pantalla:

- `colas_del_setter`: las seis colas, **del territorio entero**, como la pantalla
  (`app/api/setter/mi-dia/route.ts:53`); conteos y la lista sin teléfono ni correo.
- `inicio_del_setter`: su cockpit y **su** comisión del mes (`app/api/setter/mi-dia/route.ts:67-68`).
- `pipeline_del_setter`: conteos por etapa.

## Requisitos

- **AG-F12-1 · Sólo lee** (`D-21`): no responde mensajes, no mueve contactos, no etiqueta.
- **AG-F12-2 · La comisión es sólo la propia.**
- **AG-F12-3 · LeadFlow no es este agente.** Si la pregunta es sobre lo que hace el bot del CRM, la respuesta
  sale de las herramientas de Conversation, y sólo si la persona ve Conversation.

## Sugerencias en la caja del pie

«¿A quién tengo que responder primero?», «¿Cuántos seguimientos vencen hoy?», «¿Cuánto llevo de comisión?».
