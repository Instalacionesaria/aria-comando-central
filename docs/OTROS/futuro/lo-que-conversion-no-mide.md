# Lo que Conversion no mide, y qué haría falta para medirlo

> Escrito el **2026-10-08**, al volver la pestaña al front del prototipo
> (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Hasta ese día la pantalla dibujaba un bloque
> al final, «Lo que esta pantalla no puede medir», con cinco huecos y su motivo. Con el front del prototipo
> **cada hueco queda en su lugar**: la tarjeta o la celda dice «—» o «Sin dato», y este documento dice por
> qué y qué haría falta. Es el plan de lo que falta, escrito para retomarlo mucho después.

---

## 1 · El VSL: la retención, el play y el CTA

**Dónde se dibujaría** · La celda «Dan play al VSL» del panel «Landing y VSL», la tarjeta 02 VSL con
«Visto promedio» y «Llegan al CTA», y su cajón con la curva de retención.

**Por qué no hay dato** · El campo que guarda la retención se escribió 79 veces, entre el 2026-08-11 y el
2026-08-30, y las 79 dicen cero (`lib/negocio/embudoDelFormulario.ts:117-127`). No es que nadie viera el
video: el medidor no reporta. Los otros dos campos de porcentaje de video están en 0 de 590.

**Qué haría falta** · Arreglar vTurb o su integración con el CRM, que está fuera de este sistema. Y conviene
que sean **eventos con fecha** y no un campo por contacto que se sobrescribe: un campo `% máximo visto` con 79
ceros es exactamente el dato que hoy no sirve (riesgo 10 de
`docs/OTROS/estado actual/03-CONVERSION.md:520-522`).

## 2 · Las sesiones, los visitantes y el dispositivo

**Dónde se dibujaría** · La «Visitas» original del panel 1, el comportamiento del cajón de Landing y el
filtro «Dispositivo: Todos · Móvil · Escritorio».

**Por qué no hay dato** · No existe ninguna tabla de sesiones ni de eventos de página. Un visitante que no se
convierte en contacto no deja rastro, así que la unidad de Conversion es el contacto. El dispositivo se podría
derivar del `userAgent`, pero el 2026-10-08 venía en **47 de los 106 contactos** de 30 días, y el corte de
escritorio quedaría bajo el piso de diez (`docs/conversion/02-METRICAS.md:316-323`).

**Qué haría falta** · Instrumentar la landing con eventos de página, con un identificador de visita que se
pueda unir al contacto cuando se registra. Con eso vuelven las visitas, la tasa de conversión de la landing y
el dispositivo, sin cambiar la base de los porcentajes de los pasos de personas.

## 3 · El mapa de calor, el scroll y los clics muertos

**Dónde se dibujaría** · El cajón de Landing: «Comportamiento», «Mapa de calor» y «Grabaciones».

**Por qué no hay dato** · Clarity no está integrado: no hay credencial, ni variable de entorno, ni tabla. En
la maqueta era una cadena de texto con el punto de «fuente conectada».

**Qué haría falta** · Integrar Clarity, o la herramienta que la reemplace, con una credencial por empresa,
como las demás integraciones.

## 4 · La tasa de conversión de la landing

**Dónde se dibujaría** · El porcentaje de la tarjeta de Landing, si su base fueran visitas.

**Por qué no hay dato** · Su denominador tendría que ser la gente registrada **al llegar**, y la dirección se
registra **al convertir**: 124 de 590 contactos la traen con origen «calendar» (medido el 2026-09-20). Una tasa
sobre esa población divide «agendó» por un denominador definido en parte por haber agendado.

**Qué haría falta** · Lo mismo que el punto 2: eventos de visita anteriores al registro.

## 5 · El abandono pregunta por pregunta del formulario

**Dónde se dibujaría** · El cajón de Formulario: «Dónde se abandona, campo por campo», «Tiempo medio»,
«Reintentos» y «Errores de validación».

**Por qué no hay dato** · GoHighLevel no expone ningún endpoint de formularios ni de encuestas, y el
formulario de la landing dejó de escribirse el 2026-08-31. Lo único que hay son los tres estados del campo
`Form Landing VSL`, que la pantalla sí dibuja, con su corte.

**Qué haría falta** · Instrumentar el formulario con un evento por pregunta, y que la landing vuelva a recibir
tráfico. Hasta entonces la tarjeta dice «Sin dato desde el 31 ago.».

## 6 · La página de gracias

**Dónde se dibujaría** · La tarjeta 05 Gracias, con «Dan play al video» y «Video visto».

**Por qué no hay dato** · Lo que el prototipo llamaba «video de bienvenida» es el precall, y es de Appointment
Flow. Su consumo ya lo mide `lib/negocio/consumoDelPrecall.ts`, con su población y su piso, para otra
pantalla. Conversion no publica una segunda versión (`docs/conversion/02-METRICAS.md:267-272`).

**Qué haría falta** · Decidir si este paso es de Conversion (`docs/conversion/03-EL-RECORRIDO.md:160-165`). Si
lo es, contar quién llegó a la página de gracias, que hoy sólo se aproxima por la dirección del precall.

## 7 · «Qué pasa después» del cajón de Agenda

**Dónde se dibujaría** · El cajón de Agenda: la asistencia esperada y el riesgo de no-show.

**Por qué no hay dato** · Las dos cifras del prototipo cruzaban el consumo del VSL con la asistencia, y el VSL
está en cero (punto 1). La asistencia sola ya la publica `lib/negocio/indicadoresDeCitas.ts`.

**Qué haría falta** · El punto 1.

## 8 · Las bandas de «lo esperado»

**Dónde se dibujaría** · La `jband` de cada tarjeta, con su zona y su marca, y el contador «N pasos bajo lo
esperado».

**Por qué no hay dato** · Los 24 números de la maqueta eran inventados, y su metodología —p25 a p75 de 90
días— no se ejecuta. Noventa días de historia cruzan el corte del 2026-08-31, así que el histórico propio no
sirve todavía como línea base (`docs/conversion/02-METRICAS.md:308-314`).

**Qué haría falta** · Noventa días de una sola ruta, o un valor elegido a mano con su justificación al lado y
declarado como no calibrado. Mientras tanto la pantalla dibuja la banda vacía y no afirma «en rango».
