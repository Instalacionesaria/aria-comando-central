# Sales · Catálogo de métricas

> **Las citas a `SalesView.jsx` apuntan al encabezado que documenta lo borrado, no al marcado.** La maqueta se fue el 2026-09-21 con `components/sales/PanelDeSales.jsx`; su encabezado enumera cada pieza eliminada con la medición que la desmiente.

> Requisitos derivados del prototipo de Sales, de la especificación funcional, y de una **medición
> propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea` del que
> sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.

---

## 0 · Cómo se lee una ficha

| Campo | Qué dice |
|---|---|
| **Qué es** | la pregunta que contesta, en una frase |
| **Fórmula** | numerador y denominador, explícitos |
| **Unidad** | porcentaje, conteo, proporción, duración |
| **Población** | **sobre quién** se calcula |
| **Rastro** | de dónde sale el requisito: `archivo:línea` |
| **Estado** | si se puede construir hoy, y con qué cobertura medida |

Y **`Piso`** cuando corresponde: cuántas observaciones hacen falta antes de publicar la cifra.

> El que decide si el requisito sirve es **Población**: dos cifras con la misma fórmula y distinta
> población son dos cifras distintas, y ésa es la forma más barata de publicar un número falso sin
> que nada falle.

---

## 1 · Las nueve reglas que valen para todas las métricas de este departamento

Las doce del departamento están medidas en `docs/estado actual/05-SALES.md:159-197`. Éstas son las
que gobiernan el catálogo.

1. **Una venta del closer y una del setter NO se suman, nunca.** `venta` va a la etapa `ganado`;
   `venta_chica` **no** (`lib/negocio/etapas.ts:86-94`). Son dos negocios de tamaños distintos: *«una
   venta chica de $497 dibujada en la misma columna que un cierre de $12.000 no es un detalle»*.
2. **Venta ≠ acuerdo sin pago.** Sólo una es dinero cobrado (`lib/negocio/dineroDelMes.ts:79-85`). Filtrar
   «tiene monto» en vez de `salida = 'venta'` mete el acuerdo en el revenue y da un número más grande
   y creíble.
3. **Es venta REPORTADA, no pago verificado.** El `§ 5.4:288` lo exige por escrito, y el rótulo va
   pegado a la cifra, no en un pie.
4. **El piso es del DENOMINADOR.** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:300`),
   aplicado a lo que va abajo de la raya, nunca al total ni a la fila.
5. **Los cuatro estados del cero**, y acá deciden si alguien cobra: no hay closer configurado · no
   hay resultados · hay resultados y ninguna venta · hay ventas sin monto
   (`lib/negocio/comision.ts:14-28`).
6. **El denominador de la asistencia lleva `asistio is not null`.** Una cita sin responder no es una
   ausencia.
7. **Sales no deduce la asistencia desde la salida.** Nunca. Ver `01-LA-VENTA-NO-EXISTE.md`, `S1-08`.
8. **Un resultado es un INTENTO del closer, no una cita.** No hay uno por cita ni una por resultado.
9. **El filtro «alcanzable y no descartada» es del sistema**, no de esta pantalla. Se comparte, no se
   copia (`lib/negocio/indicadoresDeCitas.ts:313-315`).

---

## 2 · El dinero — que Sales CONSUME, no calcula

### S2-01 · Cobrado del mes

**Qué es** · Cuánto dinero se registró como cobrado en el mes en curso.
**Fórmula** · `sum(monto)` sobre `resultados` con `salida = 'venta'` y `creado_el >= date_trunc('month', …)`.
**Unidad** · Dinero.
**Población** · Los resultados registrados por los closers configurados de la empresa.
**Rastro** · `SalesView.jsx:14-18` («Revenue reportado», `$55,200`); `§ 5.4:271-274`;
`lib/negocio/dineroDelMes.ts:132-152`.
**Estado** · **Se consume** de `lib/negocio/dineroDelMes.ts`, que se extrajo de `inicio.ts` para
que la regla exista una sola vez. Vale `0` medido o `—` según haya o no resultados en el mes, y con
cero closers configurados dice otra cosa que con closers y sin resultados: son dos textos porque
mandan a hacer dos cosas opuestas. Ver `08-LO-QUE-ENTREGA-Y-RECIBE.md`.

> La ventana es **mes calendario en la zona de la organización** (`dineroDelMes.ts:105`), y **no** una de
> las cuatro rodantes. Eso no se disimula: el bloque lleva el mes en su propio encabezado. Ver
> `06-PERIODOS-Y-PISOS.md`.

### S2-02 · Ventas del mes

**Qué es** · Cuántas ventas se registraron en el mes.
**Fórmula** · `count(*) filter (where salida = 'venta')`.
**Unidad** · Conteo.
**Población** · La misma que `S2-01`.
**Rastro** · `SalesView.jsx:77-81` (`18`); `lib/negocio/dineroDelMes.ts:149`.
**Estado** · **Se consume.** Medido: **0 en toda la base**.

### S2-03 · Acuerdos sin pagar

**Qué es** · Cuánto hay comprometido y todavía no cobrado.
**Fórmula** · `count(*) filter (where salida = 'acuerdo_sin_pago')`.
**Unidad** · Conteo.
**Población** · La misma.
**Rastro** · `lib/negocio/salidas.ts:96`; `lib/negocio/dineroDelMes.ts:150`.
**Estado** · **Se consume.** Medido: 0. **No suma al cobrado** — regla 2.

---

## 3 · La cadena — lo que Sales sí calcula

### S2-04 · Tasa de cancelación

**Qué es** · De las citas que se agendaron y cuyo horario ya pasó, cuántas se cancelaron antes.
**Fórmula** · citas `cancelled` / citas alcanzables, no descartadas, con horario pasado.
**Unidad** · Porcentaje.
**Población** · Citas alcanzables (`ghl_calendario_id is not null`) de contactos no descartados.
**Piso** · `PISO_DE_UNA_TASA`, sobre el denominador.
**Rastro** · `lib/negocio/indicadoresDeCitas.ts:312`; `SalesView.jsx:57-61` la roza con «Asistencias».
**Estado** · **Construida** en `lib/negocio/indicadoresDeCitas.ts`; Sales es su segundo consumidor y no la recalcula. Medido: **59,2 %** (132 de 223). Es la cifra de
cabecera del departamento. **No se recalcula**: Sales sería su segundo consumidor.

### S2-05 · Ciclo del alta a la primera cita

**Qué es** · Cuántos días pasan entre que el contacto entra al CRM y su primera cita alcanzable.
**Fórmula** · `percentile_cont(0.5)` y `percentile_cont(0.9)` sobre `primera_cita − alta_en_el_crm`.
**Unidad** · Días.
**Población** · Contactos de la cohorte **con** primera cita. Los que no la tienen no son cero ni
infinito: **no entran, y se dicen**.
**Piso** · `PISO_DE_UNA_TASA` sobre la población medida.
**Rastro** · `§ 1:22` («Cierre de venta» como último paso); `lib/negocio/indicadoresDelLead.ts:52-68`
(el precedente de publicar p50 y p90 juntos).
**Estado** · **Construida** en `lib/negocio/cicloHastaLaCita.ts`. Medido: **mediana 2,9 días**, p90 10,6, y el promedio 16,5 — más alto que el p90, así que **no viaja en el tipo**.

> **La media no se publica ni viaja en la respuesta.** Está arrastrada por una cola de 14 contactos.
> Y la cifra lleva su **techo de ventana**: a 7 días la mediana no puede pasar de 7.

### S2-06 · Los eslabones de la cadena

**Qué es** · Cuántos contactos de la cohorte llegan a cada eslabón medible.
**Fórmula** · Conteo de contactos distintos que cumplen ese eslabón **y todos los anteriores**.
**Unidad** · Conteo, con su porción de la cohorte y su porción del eslabón anterior.
**Población** · La cohorte de la ventana.
**Rastro** · `§ 5.2:227-236`; reemplaza los cuatro KPI de `SalesView.jsx:14-18`.
**Estado** · **Construida** en `lib/negocio/cadenaDeCierre.ts`, salvo el último eslabón. Medido: 590 → 201 → 91 → 5 → **0**. Ver
`14-LOS-CINCO-ESLABONES.md`.

### S2-07 · Cobertura de la cadena

**Qué es** · Sobre cuánto de la cohorte se puede decir algo, y cuánto queda fuera.
**Unidad** · Los **dos términos**, siempre, no sólo la proporción.
**Población** · La cohorte entera.
**Rastro** · `§ 18.5` del documento funcional; el patrón `puente` de
`lib/negocio/calidadDelCreativo.ts:291-317`.
**Estado** · **Obligatoria al lado de las tres de arriba.** Medido: 101 de 327 citas son congeladas y
no entran en ningún eslabón.

---

## 4 · Por closer — la única competencia que el documento le atribuye

### S2-08 · Citas por closer

**Qué es** · Cuántas citas alcanzables corresponden a los contactos de cada closer.
**Fórmula** · Conteo de citas alcanzables y no descartadas, agrupadas por el asignatario **del
contacto**.
**Unidad** · Conteo.
**Población** · Citas de la ventana. **La fila «sin asignar» no se descarta.**
**Rastro** · `SalesView.jsx:19-24` («Agendadas»); `§ 2.3:90`.
**Estado** · **Construido** en `lib/negocio/cierrePorCloser.ts`. Medido a 14 días: 32 · 13 · 6 · 1 (sin asignar).

> Se cuentan por el asignatario del **contacto**, no por `citas.crm_asignado_a`, aunque esa columna
> exista. El producto ya lo decidió: *«la cita no tiene dueño propio: es del contacto»*
> (`lib/negocio/agenda.ts:285-287`). Contar por la columna de la cita haría que el mismo closer vea N
> en Agenda y M en Sales, **y las dos pantallas estarían bien**.

### S2-09 · Tasa de cancelación por closer

**Qué es** · Qué porción de las citas de cada closer se cancela.
**Fórmula** · `cancelled` / citas de esa persona.
**Unidad** · Porcentaje.
**Piso** · `PISO_DE_UNA_TASA`, **sobre el denominador de cada fila, no sobre el total**.
**Rastro** · `SalesView.jsx:19-24` («Cierre»); `§ 2.3:90`.
**Estado** · **Construida** en `lib/negocio/cierrePorCloser.ts`, y es el hallazgo del departamento
— más chico de lo que decía la primera medición.

A 14 días, que es la ventana por omisión de la pantalla:

| asignatario | citas | canceladas | |
|---|---|---|---|
| Quiroz | 32 | 9 | **28,1 %** |
| Veramendi | 13 | 3 | **23,1 %** |
| Gabriel | **6 — bajo el piso** | 2 | — |
| *sin asignar* | 1 | 0 | — |

**5 puntos de diferencia entre las dos filas que superan el piso**, y 14 si se mira todo el pasado.
La versión anterior de esta ficha decía 69,1 % contra 42,6 %: esa sonda contaba descartados y metía
los `noshow` entre los cancelados. Ver `04-LA-TABLA-DE-CLOSERS.md § S4-05` y la pregunta abierta
`S4-P01`, que es la que decide si esa diferencia dice algo del closer.

### S2-10 · Intentos registrados por closer

**Qué es** · Cuántos resultados registró cada persona en la ventana.
**Fórmula** · `count(*)` sobre `resultados` por `registrado_por`.
**Unidad** · Conteo, con su reparto por salida.
**Población** · **Otro eje**: lo que la persona registró, no lo que le asignaron. Ver la nota de
`inicio.ts:123-125` — cruzarlos daría los contactos de quien registró.
**Estado** · **Construida** en `lib/negocio/cierrePorCloser.ts`, columna «Registró». Medido: 7 en total, de 2 personas, y **sólo 2 en la ventana de 14 días**.

### S2-11 · Tasa de asistencia por closer

**Qué es** · De las citas de esa persona con la asistencia respondida, cuántas se presentaron.
**Fórmula** · `asistio = true` / `asistio is not null`.
**Población** · Citas **con la asistencia respondida**. Regla 6.
**Estado** · **NULA, con su motivo**, y al lado el conteo de plantones del calendario (`noshow`, 15
en toda la base), que es otra fuente y no entra en esta tasa.
`citas.asistio` es nulo en las 327. No es cero: es que nadie
contestó. Ver `S1-07`.

### S2-12 · Concentración de la asignación

**Qué es** · Qué porción de los contactos asignados se lleva la persona más grande.
**Unidad** · Proporción.
**Estado** · **Construida** como `cierrePorCloser.concentracion`, y obligatoria al lado de la tabla. Se mide sobre las CITAS de las filas y no sobre los contactos, que es la unidad de las tasas que califica: medido a 14 días, **32 de 51 (62,7 %)**.
Sin ella, comparar dos filas de esa tabla es comparar una carrera con una caminata.

---

## 5 · Los motivos de pérdida

### S2-13 · Reparto de motivos de no venta

**Qué es** · Cuando el closer registra que no hubo venta, qué motivo eligió.
**Fórmula** · Conteo de `resultados.detalle` agrupado, con `salida = 'no_interesa'`.
**Unidad** · Conteo y proporción.
**Población** · **Sólo `no_interesa`.** No se mezcla con `nurture`, que es otra salida.
**Piso** · `PISO_DE_UNA_TASA`.
**Rastro** · `SalesView.jsx:25-30`; el catálogo real en `lib/negocio/salidas.ts:165`.
**Estado** · **No se construyó**, y es el único requisito de esta carpeta que quedó afuera a propósito: está declarado como hueco en `lib/negocio/huecosDeSales.ts` en vez de dibujado. Hay **1 sola fila**, con el valor
«Otro». Y **la taxonomía real no es la dibujada**: ver `05-LOS-MOTIVOS-DE-NO-VENTA.md`.

---

## 6 · Lo que el prototipo dibuja y NO se puede construir

### S2-14 · Revenue reportado

**Rastro** · `SalesView.jsx:14-18`, `$55,200`.
**Estado** · **No.** Cero ventas, cero montos. Se consume del cockpit y sale `—` o `0` medido.

### S2-15 · Tasa de cierre

**Rastro** · `SalesView.jsx:67-71`, `24%`.
**Estado** · **No, y además no es de Sales.** El documento se la da a **Business** (`:1395`, `:1618`).
Ver `08-LO-QUE-ENTREGA-Y-RECIBE.md`. Y aunque lo fuera: 0 ventas sobre 7 intentos no llega al piso.

### S2-16 · Asistencias

**Rastro** · `SalesView.jsx:57-61`, `74`.
**Estado** · **No.** `citas.asistio` nulo en las 327. Lo que sí se puede publicar en su lugar es la
tasa de **cancelación** (`S2-04`), que es otra pregunta y hay que rotularla como tal.

---

## 7 · Índice del catálogo

| id | métrica | ¿construible hoy? |
|---|---|---|
| `S2-01` | Cobrado del mes | **se consume** — vale 0 medido |
| `S2-02` | Ventas del mes | **se consume** — 0 |
| `S2-03` | Acuerdos sin pagar | **se consume** — 0 |
| `S2-04` | Tasa de cancelación | **sí** — 59,2 % medido, y ya existe |
| `S2-05` | Ciclo del alta a la primera cita | **sí** — mediana 2,9 días |
| `S2-06` | Los eslabones de la cadena | **sí**, salvo el último |
| `S2-07` | Cobertura de la cadena | **sí** — obligatoria al lado |
| `S2-08` | Citas por closer | **sí** |
| `S2-09` | Tasa de cancelación por closer | **sí** — 28,1 % contra 23,1 % a 14 días |
| `S2-10` | Intentos por closer | **sí** — 7 en total |
| `S2-11` | Tasa de asistencia por closer | **no** — nula con su motivo |
| `S2-12` | Concentración de la asignación | **sí** — 85 % |
| `S2-13` | Motivos de no venta | **la forma sí, el contenido no** — 1 fila |
| `S2-14` | Revenue reportado | **no** |
| `S2-15` | Tasa de cierre | **no**, y es de Business |
| `S2-16` | Asistencias | **no** |
