# F04 · Systems › Conversion — especificación validada

> **El usuario la validó el 2026-10-04, sin cambios** (`D-23`): Conversion no tiene una especificación de agente en Arq
> (Arq:1112 la da por pendiente), así que se escribe acá con el molde de Acquisition y lo que Conversion ya
> dejó escrito en CV6 y CV7. Se construye en AG14.

| campo | valor |
|---|---|
| Tipo | MIDE (detector) |
| Lugar en el front | Systems › Conversion: el botón «Plan de acción» y la tarjeta de Señales |
| Estado | **Especificación validada** el 2026-10-04; **hecho** en AG14 el 2026-10-06 |
| Modelo | Ninguno para detectar. `claude-sonnet-5-5` para redactar el plan, si hay llave |
| Permisos | Los de `F03`, con la pantalla `conversion` |
| Código | `lib/agentes/detectores/conversion.ts`, `detector-de-conversion.ts` (para la pasada), `lib/agentes/plan/conversion.ts`; las rutas `app/api/conversion/senales` y `…/umbrales` |

## Qué lee

Lo mismo que su pantalla, con los mismos argumentos (`app/api/conversion/route.ts:64-78`):

- `recorridoDelLead(dias)`: por cada familia de entrada, cuántos contactos entraron por ahí, qué porción de la
  cohorte son, cuántos agendaron (**un conteo, no una tasa**) y cuántos traen la dirección capturada al
  reservar, que dice cuánto de la fila es circular.
- `embudoDelFormulario(dias)`: los estados del formulario, su cobertura y su finalización (`null` con menos
  de 10).

## Las reglas

| código | qué detecta | umbral provisional | piso | gravedad | entidad | destino |
|---|---|---|---|---|---|---|
| `CNV-FAMILIA-QUE-NO-AGENDA` | Una familia de entrada agenda mucho menos que la cohorte | 15 puntos bajo la tasa de la cohorte | 10 contactos en la familia y 10 en la cohorte | media | familia de entrada | la que resuelve esa fricción (abajo) |
| `CNV-CAMBIO-DE-RUTA` | La porción de una familia cambia mucho contra la ventana anterior (CV7-09: «el hallazgo más grande del departamento») | 15 puntos | 10 contactos en las dos cohortes | info | familia de entrada | **requiere validación ejecutiva** |
| `CNV-FORMULARIO-ABANDONO` | Mucha gente empieza el formulario y no lo termina | finalización bajo el 50 % | 10 que lo empezaron | media | funnel | Conversion |
| `CNV-FORMULARIO-SIN-DATOS` | El formulario dejó de llegar: lo que la pantalla dice de él no vale para esta ventana | menos del 10 % de la cohorte lo trae | 10 en la cohorte | media | funnel | Conversion |

La ventana anterior, para el cambio de ruta, sale de la misma función con el doble de días menos la actual: la
cohorte se corta por días de calendario sin tope superior, así que la de 60 días menos la de 30 son exactamente
los 30 anteriores (la 237 lo compara contra un conteo directo).

Tres reglas de cuidado:

- **Las familias circulares no compiten.** Si casi todos los contactos de una familia traen la dirección
  capturada al reservar, «entró por acá» y «reservó acá» son el mismo hecho y su tasa de agenda no dice nada
  del recorrido. Se cuentan y no generan `CNV-FAMILIA-QUE-NO-AGENDA`.
- **La pérdida es lo medido**: los contactos de la familia que no agendaron. Ningún coeficiente de
  recuperación inventado (CV6-06).
- **Ningún nombre de persona** en una señal o en el plan (CV6-08).
- **«Sin rastro» no compite** en ninguna regla de familias (lo agregó la construcción): no es un recorrido —no
  se sabe por dónde entró nadie— y no le toca a nadie. Sobre la base sembrada, todos los contactos son de esa
  familia y el detector los ponía en «No tocar».
- **A quién le toca, por familia**: la landing, el widget y otra página propia, a Conversion; el formulario
  nativo de Meta («llegó sin abrir una página») y el navegador de Meta, a Acquisition; el precall, a
  Conversation.

## El Plan de acción

- **«Qué hacer primero»**: las tres señales con más pérdida, y sólo tres (CV6-02, CV6-03). El criterio de
  corte se escribe en el subtítulo.
- **«No tocar»**: las familias que agendan igual o mejor que la cohorte, con 10 o más contactos (CV6-04).
- **Cada fricción dice a quién le toca** (CV6-05): la landing y el VSL, a Conversion; lo que pasa en el chat
  después del formulario (Lead Flow), a Conversation; lo que viene del anuncio, a Acquisition.
- Lo que no llega al piso, contado en un renglón; y cuántas fricciones quedaron fuera de las tres primeras, que
  siguen en la tarjeta.
- **«No tocar» no es una señal**: llega al plan como renglón informativo del detector (`informativas`), sin
  reconciliarse ni guardarse en `negocio.senales`.
- La tarjeta nombra cada familia por su rótulo de pantalla («Landing con VSL»); el plan, por la frase.

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

## Validado el 2026-10-04

Las cuatro reglas, los destinos de cada fricción (landing y VSL a Conversion, chat a Conversation, anuncio a
Acquisition) y que el cambio de ruta sube a validación ejecutiva.
