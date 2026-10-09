# Lo que Sales no mide, y qué haría falta para medirlo

> Escrito el **2026-10-09**, al volver la pestaña al front del prototipo
> (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Hasta ese día la pantalla dibujaba un bloque al
> final, «Lo que esta pantalla no puede medir», con cinco huecos fechados el 21 de septiembre
> (`lib/negocio/huecosDeSales.ts:46`). Con el front del prototipo, los huecos que tienen lugar en él quedan
> ahí, con «—» o con su frase. Este documento dice por qué y qué haría falta. **En casi todos el motivo es el
> mismo: la maquinaria existe y nadie registra.**

---

## 1 · La asistencia

**Dónde se dibujaría** · «Asistencias» en la fila de cifras y «Asistieron» en la tabla de closers.

**Por qué no hay dato** · `citas.asistio` lo marca el closer al registrar en Avanzar. El 2026-10-09 estaba
vacío en las 363 citas. El calendario marca algunas como «showed» —3 ese día— y otras como plantón —19—, pero
no todas: un conteo así no tiene denominador.

**Qué haría falta** · Que los closers respondan «¿se presentó?» en Avanzar, o una regla que tome el estado del
calendario como asistencia, decidida por el negocio (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`,
`S15-P04`).

## 2 · La venta, el revenue y la tasa de cierre

**Dónde se dibujaría** · «Ventas», «Revenue reportado» y «Tasa de cierre», en la fila y en la tabla.

**Por qué no hay dato** · Se dibujan, y hoy dicen 0, $0 y «—»: `negocio.resultados` tiene 7 filas y ninguna
venta. La última es del 2026-09-09.

**Qué haría falta** · Registrar cada llamada en Avanzar, con su salida y su monto.

## 3 · El pago verificado

**Dónde se dibujaría** · Al lado del revenue, que hoy dice «reportado por el closer».

**Por qué no hay dato** · Ninguna empresa tiene conectado un medio de pago, y no hay integración que lo traiga.

**Qué haría falta** · Una integración con el procesador de pagos, con credencial por empresa, y una regla para
unir el pago al resultado.

## 4 · La llamada de venta

**Dónde se dibujaría** · Detrás de cada fila de la tabla de closers.

**Por qué no hay dato** · Las llamadas analizadas no se enganchan en el esquema a un contacto, una cita ni un
resultado; el vínculo se calcula al leer, y lo ven quienes tienen la capacidad de los analizadores.

**Qué haría falta** · Guardar el vínculo de la llamada con su cita, y decidir si Sales la puede mostrar.

## 5 · El plan de acción y las señales

**Dónde se dibujaría** · El botón «Plan de acción» del encabezado, y una tarjeta de señales al final.

**Por qué no hay** · Sales no tiene detector (`lib/agentes/senales/tipos.ts:6-7`). En el prototipo el botón no
abría nada.

**Qué haría falta** · Un detector de Sales con sus reglas —por ejemplo, las citas sin registrar o la cancelación
de un closer por encima de la de la empresa—, su plan, sus rutas y su lugar en
`components/senales/SenalesDelDepartamento.jsx`. Es una etapa de los agentes, no de esta pantalla.

## 6 · Los motivos de pérdida del CRM

**Dónde se dibujaría** · Nada: los motivos salen de Avanzar (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`,
S15-11).

**Por qué no** · El 2026-09-28, los campos del CRM que parecen motivos estaban en 3, 2 y 1 contactos de 594, y
son de otra cosa.

**Qué haría falta** · Nada mientras Avanzar sea la fuente. Si el negocio prefiere el CRM, hay que decidirlo antes.
