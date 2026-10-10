# Lo que Conversation no mide, y qué haría falta para medirlo

> Escrito el **2026-10-10**, al volver la pestaña al front del prototipo
> (`docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Cada lugar del prototipo que no tiene dato queda en
> la pantalla con «—» y su línea; este documento dice por qué y qué haría falta. Las cifras son de la foto
> `docs/OTROS/estado actual/04-CONVERSATION.md`, del 2026-09-28, salvo donde se dice otra fecha.

---

## 1 · Los agentes de voz

**Dónde se dibujaría** · Las tarjetas «Lead Flow · voz» y «Appointment Flow · voz» del modo Agentes.

**Por qué no hay dato** · `negocio.llamadas` no tiene filas y ningún proceso la llena: no hay integración con el
proveedor de voz. Las llamadas de venta de los Analizadores son otra cosa: son reuniones con el closer, no llamadas de
un agente.

**Qué haría falta** · Una integración que guarde cada llamada del agente de voz —su flujo, su duración, su resultado— y
que el auditor la evalúe como evalúa los chats.

## 2 · La landing, después del mensaje

**Dónde se dibujaría** · El paso «Abrieron» de la cadena de Lead Flow.

**Por qué no hay dato** · El documento funcional pide un **enlace con seguimiento** (§9.5) que separe enlace enviado,
abierto, landing visitada, formulario empezado y completado. No existe: el agente manda un enlace sin seguimiento.

**Qué haría falta** · Un enlace con un identificador por contacto que la landing registre al abrirse.

## 3 · La asistencia

**Dónde se dibujaría** · «Asistieron» en el panel de Appointment Flow, el KPI «% agenda a asistencia», la cadena y «la
asistencia por calidad».

**Por qué no hay dato** · La asistencia la marca el closer en Avanzar, y no se marca: 0 citas el 2026-09-28 y 0 de 363 el
2026-10-09 (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2). El calendario marca algunas citas como «showed»,
pero un conteo sin denominador no es asistencia.

**Qué haría falta** · Que los closers marquen la asistencia. No es técnico: la columna y el escritor existen.

## 4 · De dónde viene la cita, atribuida al agente

**Dónde se dibujaría** · El bloque «De dónde viene la cita» de Appointment Flow, que hoy dice «Conversaron antes» y «Se
agendaron solos».

**Por qué no hay dato** · Ningún mensaje dice qué agente lo escribió: `mensajes.autor = 'agente'` mezcla al agente de IA
con todo lo automático, y el agente sale del territorio del contacto. Lo que se mide es si la persona respondió una
conversación antes de agendar, no si el agente de Lead Flow la rescató.

**Qué haría falta** · Comparar el momento de la reserva de la cita (`citas.reservada_el`) con los mensajes del usuario del
CRM que es el agente, y decidir qué cuenta como rescate.

## 5 · Las escaladas y la intervención humana

**Dónde se dibujaría** · El desglose de cada tarjeta de agente.

**Por qué no hay dato** · No se registra cuándo una persona toma una conversación del agente.

**Qué haría falta** · Una marca en el CRM o en el mensaje cuando una persona responde en lugar del agente.

## 6 · El VSL

**Dónde se dibujaría** · En ningún lugar del prototipo de Conversation; el documento funcional lo pide entre los cortes
del show rate (§10.7).

**Por qué no hay dato** · El consumo del VSL está en cero en todos los contactos medidos el 2026-09-28.

**Qué haría falta** · Lo dice `docs/OTROS/futuro/lo-que-conversion-no-mide.md`, que es donde vive el VSL.
