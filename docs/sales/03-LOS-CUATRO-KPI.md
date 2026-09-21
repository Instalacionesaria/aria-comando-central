# Los cuatro KPI de arriba, y cuál tiene fuente

> Requisitos derivados del prototipo de Sales y de una medición propia contra producción del
> **2026-09-20**. Cada requisito lleva su `archivo:línea`.

`components/views/SalesView.jsx:53-94` dibuja una rejilla de cuatro tarjetas. **Las cuatro cifras son
literales escritos a mano en el JSX**, sin `fetch`, sin estado y sin interpolación.

| rótulo | cifra | línea | fuente hoy |
|---|---|---|---|
| Asistencias | **`74`** | `:60` | **ninguna** |
| Tasa de cierre | **`24%`** | `:70` | **ninguna** |
| Ventas | **`18`** | `:80` | **ninguna** |
| Revenue reportado | **`$55,200`** | `:90` | **ninguna** |

---

## S3-01 · Las cuatro cierran entre sí, y eso las hace peor

No están tiradas al azar. Alguien las calculó:

```
31 + 43 = 74          asistencias = suma de las dos filas de closers
10 +  8 = 18          ventas      = suma de las dos filas
18 / 74 = 24,3 %  ≈   24 %        tasa de cierre = ventas / asistencias
$31.000 + $24.200 = $55.200       revenue = suma de las dos filas
74 − 18 = 56                      y 56 es el «56 llamadas sin cierre» del tercer bloque
21 + 13 + 12 + 10 = 56            y los cuatro motivos suman exactamente eso
```

**La maqueta es aritméticamente consistente de punta a punta.** Quien la audite sumando va a
encontrar que cierra, y va a concluir que los números son reales. Es exactamente el riesgo que
`docs/estado actual/05-SALES.md:201` nombra: *«la pantalla es internamente consistente, y por eso
engaña»*.

---

## S3-02 · «Asistencias» — el requisito sobrevive, la cifra no

**Qué pregunta** · De la gente que agendó, cuánta se presentó.
**Rastro** · `SalesView.jsx:57-61`; `§ 5.3:261` («Asistencia» en el perfil del lead); `§ 10.7:751`
(«Show rate», que el documento asigna a **Appointment Flow**, no a Sales).
**Estado** · **Sin fuente para una tasa.** `citas.asistio` es **NULL en las 327 filas** de la base.
> **Corregido el 2026-09-21.** `citas.asistio` sigue nulo en las 327, pero decir «no hay ninguna
> señal de asistencia» era de más. Censo de `estado_ghl`: **cancelled 163 · confirmed 149 ·
> noshow 15**. El calendario marca el plantón y **nunca** dice que alguien sí apareció —`showed` no
> aparece una sola vez—, así que la señal existe y es asimétrica: sirve como CONTEO y no da
> denominador para un show rate. `cierrePorCloser.noShowDelCalendario` lo publica en su propia
> columna, y no se suma con `asistio`.

La columna
existe desde la migración `049` (2026-09-14) y la escribe el botón Avanzar
(`lib/negocio/avanzar.ts:248`); nadie la ha contestado nunca.

**Lo que se publica en su lugar, y es otra pregunta:** la **tasa de cancelación** — 59,2 % medido. No
dice quién se presentó: dice cuántas citas se cayeron antes de ocurrir. El rótulo tiene que decirlo,
o las dos se confunden.

## S3-03 · «Tasa de cierre» — sin fuente, y además no es de Sales

**Qué pregunta** · De las llamadas que ocurrieron, cuántas terminaron en venta.
**Rastro** · `SalesView.jsx:67-71`.
**Estado** · **Sin fuente, por dos motivos independientes.**

1. El numerador es cero: no hay ventas.
2. **El documento le da la tasa de cierre a Business, no a Sales.** `§ 18.11:1395` pone *«baja tasa de
   cierre y bajo revenue»* en boca de Business, y `§ 18.18:1618` lista *«close rate»* entre las
   métricas que **Business** evalúa. Ver `08-LO-QUE-ENTREGA-Y-RECIBE.md`.

Y aunque existiera: 0 sobre 7 intentos no llega al piso de 10.

## S3-04 · «Ventas» — sin fuente, y es el corazón del departamento

**Rastro** · `SalesView.jsx:77-81`; `§ 5.4:271` (*«¿El cliente compró?»*).
**Estado** · **Cero en toda la base.** Ver `01-LA-VENTA-NO-EXISTE.md`.

**Se consume, no se recalcula.** `lib/negocio/dineroDelMes.ts:149` ya publica este conteo para el Inicio del
Closer. Sales lo toma de ahí o habrá dos cifras del mismo hecho.

## S3-05 · «Revenue reportado» — el rótulo es lo único correcto

**Rastro** · `SalesView.jsx:87-91`; `§ 5.4:272` (*«Monto vendido»*), `§ 5.4:288`.
**Estado** · **Cero montos en las 7 filas.**

**Pero el rótulo del prototipo acierta en algo que hay que conservar: dice «reportado».** El
`§ 5.4:288` lo exige: *«deberá indicar que se trata de ventas reportadas por el closer y no
necesariamente de pagos verificados»*. Y la medición lo respalda: **0 de 5 organizaciones tienen
credencial de pagos cargada**, no hay integración ni tabla de transacciones. Ver `S1-09`.

> Eso convierte una palabra del prototipo en un **requisito**: el texto «reportado por el closer, no
> pago verificado» viaja desde el servidor **pegado a la cifra**, no en un pie que nadie lee.

---

## S3-06 · Lo que reemplaza a los cuatro

No cuatro tarjetas con cuatro cifras sueltas, sino **una cadena** —donde la caída entre eslabones es
la información— más el bloque del dinero con su ventana propia.

| lo que decía la tarjeta | lo que la reemplaza | ficha |
|---|---|---|
| Asistencias `74` | la tasa de **cancelación**, 59,2 %, con otro rótulo | `S2-04` |
| Tasa de cierre `24%` | el eslabón «con intento registrado»: **5 de 91** | `S2-06` |
| Ventas `18` | el último eslabón: **0**, consumido del cockpit | `S2-02` |
| Revenue `$55,200` | `cobrado` del mes, consumido: `—` o `0` medido | `S2-01` |

Y una cifra que el prototipo no tiene y que es la más útil de todas: **86 de 91 citas que ocurrieron
no tienen ningún resultado registrado**. Ver `14-LOS-CINCO-ESLABONES.md`.

---

## S3-07 · El cero y el guion no son lo mismo, y se dibujan distinto

Es la regla 5 del departamento, y acá decide qué ve la pantalla el día que se registre la primera
venta:

| estado | qué se dibuja | cuándo |
|---|---|---|
| no hay ningún closer configurado | **`—`** + «nadie eligió de quién son los números» | `dineroDelMes.ts:164-173` |
| hay closers y ningún resultado en el mes | **`—`** + «nadie registró nada todavía» | `dineroDelMes.ts:162` |
| hay resultados y ninguna venta | **`0` medido**, atenuado, con su denominador al lado | hoy |
| hay ventas sin monto cargado | **`—`** con su propio motivo | `comision.ts:14-28` |

Un `$0` grande y en verde al lado de una cadena de cuatro eslabones afirma que el negocio no vende.
El mismo cero con su denominador —*«0 de 7 intentos registrados terminó en venta»*— dice un hecho.
