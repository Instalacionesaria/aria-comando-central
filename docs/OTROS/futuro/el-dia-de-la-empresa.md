# El día de la empresa: las ventanas que se cortan con el día UTC

> **Estado: diagnosticado y diseñado el 2026-10-07; se deja para después por decisión del usuario.** El
> impacto ese día era bajo: de las 11 empresas activas, sólo la principal tenía datos. Este documento guarda el
> diagnóstico y el plan para retomarlo sin repetir el análisis. Lo audita la prueba 101: si una cita se corre,
> se entera la suite.

## El defecto

En producción la sesión de la base está en UTC. Varias ventanas «ancladas al día» usan `current_date` de la
sesión, o un `::date` sin zona, en vez del día local de la empresa (`identidad.organizaciones.zona_horaria`).
Para una empresa en America/Lima (UTC−5), de 19:00 a 24:00 locales `current_date` ya es mañana: la ventana de
30 días pierde el día 29 (sobre la base sembrada de los agentes, 115 contactos en vez de 120).

Dónde, en `current_date`:

- La cohorte por días de calendario hasta hoy, `ventanaDeLaCohorte` (`lib/negocio/recorrido.ts:202`), y sus copias a
  mano en Creative (`lib/negocio/calidadDelCreativo.ts:228`) y en el costo por anuncio
  (`lib/negocio/costoDelAnuncio.ts:355`). Desde el 2026-10-08 Conversion corta con `cohorteEntre`
  (`lib/negocio/recorrido.ts:214-217`), la de Acquisition: días cerrados, pero el borde de cada día sigue en UTC.
- La ventana del gasto (`lib/negocio/costoDelAnuncio.ts:84`), sin tope arriba.
- El período que publican los detectores de Creative y Conversion (`lib/agentes/detectores/creative.ts:106`,
  `lib/agentes/detectores/conversion.ts:122@02d9207`; desde el 2026-10-08 el de Conversion son los días cerrados de
  `bordesDelPeriodo`), y el de Conversation en días UTC de JavaScript
  (`lib/agentes/detectores/conversation.ts:81`).
- El último día cerrado de Acquisition, que desde la `076` se mide sobre la serie de la cuenta
  (`lib/negocio/gastoDeLaCuenta.ts:310` y la cota de atraso de `:317`).

Y dos que se ven directo en pantalla, fuera de las ventanas:

- **Avanzar** (Mi Día de Closer y de Setter): el «hoy» del selector (`components/negocio/Avanzar.jsx:48`, usado como
  `min` en `:482`) y la validación de la ruta (`app/api/contactos/[id]/avanzar/route.ts:218`) son días UTC. De
  19:00 a 24:00 de Lima no se puede poner un seguimiento para hoy: el selector lo esconde y la ruta responde
  `fecha_pasada`, mientras las colas vencen las tareas con el día de la empresa (`lib/negocio/colas.ts:428`).
- El rótulo de la cola desproporcionada (`lib/negocio/periodo.ts:169`) se escribe en UTC, y lo usan Conversation,
  Leads Portal y dos herramientas del cerebro.

Lo que ya lo hace bien, y es el patrón: `lib/agentes/reunion/temas.ts:93` y `lib/negocio/colas.ts:428`.

## El diseño elegido

Se compararon dos diseños con un juez y tres escépticos (un flujo de 9 agentes, sólo de lectura):

- **Elegido: la zona viaja como dato.** Cada función que corta por día recibe la zona de la empresa, que las
  rutas tienen en `contexto.organizacion.zonaHoraria`, el cerebro en `ContextoDeHerramienta.zona` y los
  detectores en `ContextoDelDetector.zona`. Un módulo nuevo de servidor da el «hoy» de la empresa desde el
  `now()` de la transacción, y la columna se compara desnuda (se convierte el límite, para conservar el
  índice). La pantalla, el cerebro y los detectores siguen dando la misma cifra porque toman la zona de la
  misma columna.
- **Descartado: fijar la zona de la transacción** (`set local time zone`). Corría otras 24 ventanas que hoy
  están bien, obligaba a leer identidad en cada transacción del inquilino (contra ADR-0208) y pedía una
  migración.

## El plan, en dos partes

**Parte A, sin riesgo conocido:** Creative con su gasto (la misma cantidad de días que los contactos, como pide
el comentario de `costoDelAnuncio.ts`), los detectores de Creative y Conversation, las herramientas del cerebro de
las pantallas de la Parte A, la ficha del lead y el Brief, el «hoy» de Avanzar y el rótulo de `periodo.ts`.
Conversion pasó a la Parte B el 2026-10-08: ver abajo. Pruebas: una de base
con una empresa en Asia/Tokyo y contactos a ±30 minutos de su medianoche, que con el código de hoy da roja a
cualquier hora, y una de código que prohíba `current_date` y los `::date` sin zona en `lib/` y `app/`.

**Parte B, Acquisition, después de medir:**

- Su último día cerrado convive con el colector de anuncios, que guarda el día de la cuenta publicitaria
  (`lib/negocio/gastoDeLaCuenta.ts:54`: la API no expone esa zona). Medido el 2026-10-07: las sumas por día
  de la serie coinciden al centavo con el Administrador de anuncios en 7 y 30 días, así que el día del
  proveedor es el de la cuenta; su zona sigue sin saberse.
- Los escenarios de Lima y Los Ángeles de la 181 (`pruebas/base/181-embudos-de-acquisition.test.ts:740-741` y
  `:731`) siembran anclados al día UTC y habría que rehacerlos y correrlos de noche: un escéptico mostró que
  con el cambio mecánico se ponen rojos, o quedan verdes sin probar nada, entre las 19:00 y las 24:00 de Lima.
- El «− 3» de la cota de atraso está justificado en días UTC; en días locales el desfase normal es 2.
- **Conversion va con Acquisition.** Desde el 2026-10-08 (CV-3) su pantalla, su detector y sus herramientas del
  cerebro cortan con `bordesDelPeriodo` (`lib/negocio/diasCerrados.ts:82-129`) y `cohorteEntre`
  (`lib/negocio/recorrido.ts:214-217`), los de Acquisition: mover el día de una es mover el de la otra, o se rompe la
  invariante de `pruebas/base/246-pasos-de-conversion.test.ts` (CV15-21 de
  `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). El detector de Acquisition, que lee
  `lecturaDeAcquisition`, también va acá.

## Lo que hay que medir antes

- En producción, con `scripts/supabase.mjs leer`: que la zona de cada empresa sea válida, y la cohorte de 30
  días con las dos expresiones a las 20:00 de Lima.
- En qué zona viene el día del gasto de Meta.
- ~~Que `comoDia` de `lib/negocio/costoDelAnuncio.ts` no corra un día cuando el proceso de Node no está en UTC.~~
  Resuelto con la `076` (2026-10-07): la ventana guardada de Creative sale ahora como texto (`to_char`), y
  `comoDia` se borró.
- La suite entera de día y otra vez entre las 19:00 y las 24:00 de Lima, que es cuando el defecto existe.
