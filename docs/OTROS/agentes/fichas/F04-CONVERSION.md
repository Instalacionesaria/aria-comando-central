# F04 · Systems › Conversion — especificación para validar

> **Esta ficha espera el OK del usuario** (`D-23`): Conversion no tiene una especificación de agente en Arq
> (Arq:1112 la da por pendiente), así que se escribe acá con el molde de Acquisition y lo que Conversion ya
> dejó escrito en CV6 y CV7. Sólo bloquea AG14.

| campo | valor |
|---|---|
| Tipo | MIDE (detector) |
| Lugar en el front | Systems › Conversion: el botón «Plan de acción» y la tarjeta de Señales |
| Estado | **Especificación a validar**; después se construye en AG14 |
| Modelo | Ninguno para detectar. `claude-sonnet-5-5` para redactar el plan, si hay llave |
| Permisos | Los de `F03`, con la pantalla `conversion` |
| Código | `lib/agentes/detectores/conversion.ts`, `lib/agentes/plan/conversion.ts` |

## Qué lee

Lo mismo que su pantalla, con los mismos argumentos (`app/api/conversion/route.ts:58-60`):

- `recorridoDelLead(dias)`: por cada familia de entrada, cuántos contactos entraron por ahí, qué porción de la
  cohorte son, cuántos agendaron (**un conteo, no una tasa**) y cuántos traen la dirección capturada al
  reservar, que dice cuánto de la fila es circular.
- `embudoDelFormulario(dias)`: los estados del formulario, su cobertura y su finalización (`null` con menos
  de 10).

## Las reglas propuestas

| código | qué detecta | umbral provisional | piso | gravedad | entidad | destino |
|---|---|---|---|---|---|---|
| `CNV-FAMILIA-QUE-NO-AGENDA` | Una familia de entrada agenda mucho menos que la cohorte | 15 puntos bajo la tasa de la cohorte | 10 contactos en la familia y 10 en la cohorte | media | familia de entrada | la que resuelve esa fricción (abajo) |
| `CNV-CAMBIO-DE-RUTA` | La porción de una familia cambia mucho contra la ventana anterior (CV7-09: «el hallazgo más grande del departamento») | 15 puntos | 10 contactos en las dos cohortes | info | familia de entrada | **requiere validación ejecutiva** |
| `CNV-FORMULARIO-ABANDONO` | Mucha gente empieza el formulario y no lo termina | finalización bajo el 50 % | 10 que lo empezaron | media | funnel | Conversion |
| `CNV-FORMULARIO-SIN-DATOS` | El formulario dejó de llegar: lo que la pantalla dice de él no vale para esta ventana | menos del 10 % de la cohorte lo trae | 10 en la cohorte | media | funnel | Conversion |

Tres reglas de cuidado:

- **Las familias circulares no compiten.** Si casi todos los contactos de una familia traen la dirección
  capturada al reservar, «entró por acá» y «reservó acá» son el mismo hecho y su tasa de agenda no dice nada
  del recorrido. Se cuentan y no generan `CNV-FAMILIA-QUE-NO-AGENDA`.
- **La pérdida es lo medido**: los contactos de la familia que no agendaron. Ningún coeficiente de
  recuperación inventado (CV6-06).
- **Ningún nombre de persona** en una señal o en el plan (CV6-08).

## El Plan de acción

- **«Qué hacer primero»**: las tres señales con más pérdida, y sólo tres (CV6-02, CV6-03). El criterio de
  corte se escribe en el subtítulo.
- **«No tocar»**: las familias que agendan igual o mejor que la cohorte, con 10 o más contactos (CV6-04).
- **Cada fricción dice a quién le toca** (CV6-05): la landing y el VSL, a Conversion; lo que pasa en el chat
  después del formulario (Lead Flow), a Conversation; lo que viene del anuncio, a Acquisition.
- Lo que no llega al piso, contado en un renglón.

## Lo que se posterga, y por qué

- **El cruce con Acquisition por creativo** (CV7-04, CV7-10): ninguno de los contactos con formulario trae el
  identificador del anuncio; se cruzan por nombre, y una señal no puede usar un nombre como entidad.
- **El conflicto con Acquisition** (A7-11 a A7-14): falta el costo por contacto por anuncio en la misma ventana.

## Sugerencias en la caja del pie

«¿Por dónde entra la gente?», «¿Dónde se pierde la gente antes de agendar?», «¿Cuánta gente termina el
formulario?».

## Contratos que cumple

CV6-02 a CV6-08, CV7-09 (lo que le entrega a Executive). CV7-10 queda postergado.

## Qué dato falta

El formulario: a 30 días, casi ningún contacto lo trae y se escribió por última vez el 2026-08-31, así que la
primera señal real va a ser `CNV-FORMULARIO-SIN-DATOS`.

## Para validar

1. ¿Las cuatro reglas son las que importan?
2. ¿Los destinos de cada fricción (landing y VSL a Conversion, chat a Conversation, anuncio a Acquisition)?
3. ¿El cambio de ruta sube a validación ejecutiva?
