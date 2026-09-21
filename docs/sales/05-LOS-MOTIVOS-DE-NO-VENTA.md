# Los motivos de no venta: la taxonomía existe, pero es otra

> Requisitos derivados del prototipo de Sales y de una medición propia contra producción del
> **2026-09-20**. Cada requisito lleva su `archivo:línea`.

`components/views/SalesView.jsx:172-225` dibuja el tercer bloque: cuatro barras con un conteo y un
ancho, bajo el rótulo «Motivos de no venta» y la pista «56 llamadas sin cierre» (`:176`).

| motivo | conteo | ancho | línea |
|---|---|---|---|
| Precio | `21` | `38%` | `:182`, `:185`, `:188` |
| No es quien decide | `13` | `23%` | `:193`, `:196`, `:199` |
| Sin necesidad clara | `12` | `21%` | `:204`, `:207`, `:210` |
| Pidió tiempo | `10` | `18%` | `:215`, `:218`, `:221` |

Los cuatro anchos son cada conteo sobre 56, y 21+13+12+10 = 56. Cierra, como todo el resto.

---

## S5-01 · Éste es el bloque con mejor noticia de los tres, y con la trampa más fina

A diferencia de los otros dos, **este bloque SÍ tiene fuente**. El catálogo del closer guarda una
subcategoría por salida, y la escribe `lib/negocio/avanzar.ts` en `resultados.detalle`.

**Pero la taxonomía dibujada no es la del catálogo**, y de las cuatro barras **sólo una coincide**.

---

## S5-02 · El catálogo real

`lib/negocio/salidas.ts` define, por salida, la etiqueta de su subcategoría y sus opciones:

| salida | etiqueta del campo | opciones | línea |
|---|---|---|---|
| `no_interesa` | **Motivo** | Precio · No es el momento · Competencia · No califica · Otro | `:165` |
| `no_show` | Qué pasó | Avisó quiere reagendar · Plantón sin aviso · Falla técnica · Datos incorrectos | `:175` |
| `nurture` | De dónde viene | **Pidió tiempo** · Se enfrió | `:198` |
| `seguimiento` | — | modo manual/automático | `:107` |
| `venta` | Forma de pago | Contado · Splitwise · Buy Now Pay Later · Cuotas | `:91` |
| `acuerdo_sin_pago` | ninguna | — lo que la describe es el monto | `:101` |

### El cruce, barra por barra

| barra del prototipo | ¿está en el catálogo? |
|---|---|
| **Precio** | **sí**, es opción de `no_interesa` |
| No es quien decide | **no existe** en ninguna salida |
| Sin necesidad clara | **no existe**; lo más cercano es «No califica» |
| **Pidió tiempo** | **sí, pero es opción de `nurture`**, no de `no_interesa` |

---

## S5-03 · Y por eso el gráfico del prototipo mezcla dos salidas en una torta

«Pidió tiempo» y «Precio» **no son dos motivos del mismo hecho**. Uno describe a alguien que dijo que
no (`no_interesa`) y el otro a alguien que puede volver (`nurture`) — que son dos etapas distintas del
pipeline (`lib/negocio/etapas.ts:41,45`) y dos acciones distintas para el equipo.

Sumarlos en un reparto de cuatro barras afirma que son cinco maneras de perder la misma venta. **No lo
son: una de ellas no está perdida.**

> **Requisito que sale de acá:** el reparto se calcula **por salida**, y si alguna vez se quieren ver
> juntas, van como dos bloques o como dos series — nunca como una sola torta.

---

## S5-04 · Lo que hay hoy en la base

**Qué es** · El reparto de `resultados.detalle` para `salida = 'no_interesa'`.
**Fórmula** · `count(*)` agrupado por `detalle`.
**Unidad** · Conteo y proporción.
**Población** · Sólo los resultados con esa salida.
**Piso** · `PISO_DE_UNA_TASA`.
**Rastro** · `SalesView.jsx:172-225`; `lib/negocio/salidas.ts:165`.
**Estado** · **La forma es construible; el contenido no llega ni de cerca.**

```
no_interesa     1 fila     detalle = «Otro»
nurture         0 filas
no_show         2 filas    detalle vacío en las dos
```

**Una fila, y con el valor que menos dice.** Un reparto sobre una observación no es un reparto: es una
observación con un gráfico encima.

---

## S5-05 · `detalle` es texto libre, y el agrupador tiene que saberlo

`negocio.resultados.detalle` es **`text`**, sin `check` contra el catálogo. El catálogo vive en el
código (`salidas.ts`) y se valida en la ruta, no en la base.

Dos consecuencias, y las dos son requisitos:

1. **Las filas viejas conservan su texto.** El propio catálogo lo dice al explicar por qué «No-show»
   salió de las opciones de `nurture` (`salidas.ts:194-196`): *«reescribir el pasado para que coincida
   con el catálogo de hoy sería inventar»*. Así que ya hoy puede haber valores que el catálogo actual
   no ofrece.
2. **Los huérfanos se cuentan y se informan, no se fuerzan.** Es el mismo patrón que
   `lib/negocio/consumoDelPrecall.ts:74-85` usa con `-20%` y `Clic a link`. Un agrupador que asuma el
   catálogo **pierde en silencio** todo lo que el CRM o el producto agreguen después.

Y es la regla 12 del departamento (`docs/estado actual/05-SALES.md:195`).

---

## S5-06 · Lo que se dibuja hoy, entonces

Con una sola fila, el bloque **no dibuja el reparto**: dibuja el conteo y dice por qué no hay reparto.
Es la misma decisión que Conversion tomó con su embudo bajo el piso.

Y el hueco declarado que va al lado lleva su medición: *«los motivos existen como vocabulario y se
registran en `resultados.detalle`; hay una sola respuesta en toda la base, del 2026-08-30»*.

### S5-P01 · ¿El CRM guarda motivos de pérdida en otro lado? — **abierta**

`docs/estado actual/05-SALES.md:193` afirma que las opciones del catálogo viven en `resultados.detalle`
**y no en el CRM**. No comprobé si GoHighLevel tiene un campo de «motivo de pérdida» o una etapa de
pipeline que lo exprese, ni si alguna etiqueta lo codifica.

**Por qué importa:** si existe y está poblado, este bloque pasa de «una fila» a construible de verdad,
y sería el único de los tres que no depende de que alguien cambie su conducta.

**Cómo se contesta:** con el censo de `campos_del_crm` filtrado por nombre —el mismo método que
encontró los 13 campos de dinero en cero— y un vistazo a `contactos.etiquetas`.
