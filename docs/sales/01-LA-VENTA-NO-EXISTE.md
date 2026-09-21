# La venta no existe, y la maquinaria para registrarla está entera

> Requisitos derivados del prototipo de Sales, de la especificación funcional, y de una **medición
> propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea` del que
> sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.

**Si se lee un solo archivo de esta carpeta, es éste.**

Las otras cuatro pantallas de Inteligencia tenían el dato y les faltaba la pantalla. Acá faltan las
dos cosas — pero por un motivo distinto del que parece, y la diferencia decide el plan entero.

---

## 1 · La medición, y no admite lectura amable

### S1-01 · La venta

**Qué es** · Una fila de `negocio.resultados` con `salida = 'venta'`.
**Fórmula** · `count(*) filter (where salida = 'venta')`.
**Unidad** · Conteo.
**Población** · Toda la base, sin filtro de ventana ni de organización.
**Rastro** · `lib/negocio/salidas.ts:84`; `§ 5.4:267-288` del documento funcional.
**Estado** · **CERO. En toda la base, desde siempre.**

```
negocio.resultados          2026-09-20
─────────────────────────────────────────
filas totales                          7
organizaciones distintas               1
con monto                              0
con cita enganchada                    0
─────────────────────────────────────────
seguimiento                            4
no_show                                2
no_interesa                            1
venta                                  0   ← 
acuerdo_sin_pago                       0   ← 
```

Las siete filas van del **2026-08-30 al 2026-09-09**. Todas con `rol = 'closer'`.

### S1-02 · Las dos salidas que llevan dinero nunca se usaron

El catálogo del closer tiene **seis** salidas y **dos piden monto**
(`lib/negocio/salidas.ts:82-201`):

| salida | nombre | pide monto | subcategoría | usada en producción |
|---|---|---|---|---|
| `venta` | Venta | **sí** | Forma de pago: Contado · Splitwise · Buy Now Pay Later · Cuotas | **0** |
| `acuerdo_sin_pago` | Acordó comprar | **sí** | ninguna — lo que la describe es el monto | **0** |
| `seguimiento` | Seguimiento | no | modo manual/automático | 4 |
| `no_interesa` | No le interesa | no | Motivo: Precio · No es el momento · Competencia · No califica · Otro | 1 |
| `no_show` | No-show | no | Qué pasó: Avisó quiere reagendar · Plantón sin aviso · Falla técnica · Datos incorrectos | 2 |
| `nurture` | Nurture | no | De dónde viene: Pidió tiempo · Se enfrió | 0 |

**Las dos que llevan dinero son exactamente las dos que nadie tocó.**

---

## 2 · Y no falta nada técnico. Ésa es la parte incómoda

Lo que hace a Sales distinta de Creative y de Conversion es que **acá el instrumento está construido,
probado, enchufado y funcionando.**

### S1-03 · La columna existe, con el tipo correcto

`negocio.resultados.monto numeric(12,2)` (`db/migraciones/011_negocio_closer_setter.sql:395`), y el
esquema entero mapea casi 1:1 contra los campos que el `§ 5.4:278-286` sugiere:

| lo que pide el documento | la columna que existe |
|---|---|
| `sale_status` | `salida` |
| `sale_amount` | `monto` |
| `reported_by_closer_id` | `registrado_por` |
| `reported_at` | `creado_el` |
| `opportunity_id` | `cita_id` (el eslabón que el documento llama `sales_call_id`) |
| `sale_source = closer_reported` | implícito: es la única fuente que hay |
| `sale_currency` | **no existe**, y es una decisión escrita (`024_ingreso_por_empresa.sql:56-59`) |

### S1-04 · El escritor funciona y es único

`lib/negocio/avanzar.ts` es el **único** escritor de `negocio.resultados` (`:181-193`). Valida que una
venta traiga monto (`salidas.ts:79`, `pideMonto`) y guarda la forma de pago en su propia columna.
Tiene pruebas de base: `pruebas/base/26-avanzar.test.ts`, `pruebas/base/97-closer-avanzar.test.ts`.

### S1-05 · Y el consumidor ya publica el dinero, hoy, en una pantalla viva

`lib/negocio/inicio.ts :: cockpitDelMes` publica `cobrado`, `ventas` y `acuerdos` en el Inicio del
Closer, con la disciplina completa:

- `Indicador { valor: number | null; falta?: string }` (`inicio.ts:26-31`), porque *«un `$0` donde
  nadie cargó montos afirma "no vendiste nada". Es falso»* (`inicio.ts:16-17`);
- **dos motivos de nulo distintos, con textos distintos**: nadie configurado contra nadie registró
  (`inicio.ts:205-216`);
- `acuerdo_sin_pago` **no suma** al cobrado (`inicio.ts:36-45`).

> **Conclusión de las tres fichas anteriores:** el cuello de botella de Sales **no es técnico**. La
> tabla, el escritor, el validador, el agregador y la pantalla que lo muestra existen y funcionan. Lo
> que falta es que alguien lo use.

---

## 3 · El hueco de la asistencia es atribuible, no misterioso

### S1-06 · El vínculo resultado ↔ cita

**Qué es** · `resultados.cita_id`, el eslabón que el `§ 5.2:234` llama `sales_call_id`.
**Estado** · **Nulo en las 7 filas.**
**Rastro** · `db/migraciones/049_si_se_presento_a_la_cita.sql:65-66`.

### S1-07 · La asistencia

**Qué es** · `citas.asistio boolean`: si la persona se presentó.
**Estado** · **NULL en las 327 citas.** La columna existe desde la migración `049` (2026-09-14).
**Rastro** · `db/migraciones/049:46-47`; escritor en `lib/negocio/avanzar.ts:248`.

### S1-08 · Y acá está el hallazgo: no es que Avanzar no lo ofrezca

`lib/negocio/citasParaCerrar.ts` existe **exactamente** para ofrecerle al closer la cita sobre la que
contestar «¿se presentó?». Sus tres condiciones, cada una con su motivo escrito (`:16-26`):

1. **ya empezó** — preguntar por una cita de mañana es pedir un pronóstico;
2. **no está cancelada** — nadie faltó a algo que no ocurrió;
3. **alcanzable** — el mismo filtro que la cifra, o la respuesta cae en filas que nadie mira.

**Medido el 2026-09-20, resultado por resultado:**

| fecha | salida | ¿tenía una cita ofrecible en ese momento? |
|---|---|---|
| 2026-08-30 | `no_interesa` | no — su única cita estaba fuera de la ventana |
| 2026-09-03 | `seguimiento` | **sí, 2** |
| 2026-09-03 | `seguimiento` | no — sus 3 citas estaban canceladas o por venir |
| 2026-09-04 | `seguimiento` | **sí, 2** |
| 2026-09-07 | `seguimiento` | **sí, 1** |
| 2026-09-07 | `no_show` | **sí, 1** |
| 2026-09-09 | `no_show` | **sí, 1** |

**Cinco de los siete tenían una cita ofrecible y se guardaron sin engancharla.** Incluidos **los dos
`no_show`**: alguien registró «no apareció» como salida mientras la columna de asistencia de esa cita
quedaba nula.

> Y eso es exactamente el defecto que la regla 7 del departamento anticipa
> (`docs/estado actual/05-SALES.md:181`): **Sales no puede deducir la asistencia desde la salida.**
> El propio catálogo documenta por qué se sacó «No-show» de las opciones de `nurture`
> (`lib/negocio/salidas.ts:183-196`): *«con eso, cualquier inferencia "salida distinta de `no_show`
> ⟹ apareció" contaba ese caso como asistencia — un show rate inflado sin que nada fallara»*.

### S1-P01 · ¿Por qué se guardaron sin la cita? — **abierta**

La medición dice **qué** pasó. No dice si Avanzar no la ofreció por algún motivo que no vimos, o si
el closer la salteó porque el paso es opcional.

**Por qué importa:** si es lo primero, hay un defecto de producto detrás del hueco de asistencia y
arreglarlo desbloquea una cifra. Si es lo segundo, es adopción, y ninguna pantalla lo arregla.

**Cómo se contesta:** mirando el panel de Avanzar con uno de esos contactos, o preguntándole a quien
registró.

---

## 4 · Lo que tampoco existe, y con la búsqueda que lo comprueba

### S1-09 · El cobro verificado

**Estado** · **No existe, y no puede existir hoy.** `identidad.organizaciones_credenciales` tiene
`pagos_clave_cifrada` y `pagos_comercio_id` (`006_segundo_factor_y_credenciales.sql:87,93`), y
**están en 0 de 5 organizaciones**. Nadie las consume salvo el formulario que las guarda
(`app/api/admin/credenciales/route.ts:91`) y el resolvedor que las descifra
(`lib/credenciales/resolver.ts:199`). No hay llamada a ningún proveedor, ni webhook, ni tabla de
transacciones.

**Consecuencia que va en pantalla:** el día que haya una `venta` con monto, «cobrado» seguirá
significando *«alguien tipeó que cobró»*. El `§ 5.4:288` lo exige por escrito: *«deberá indicar que
se trata de ventas reportadas por el closer y no necesariamente de pagos verificados»*.

### S1-10 · El valor del trato — **el hueco que tienta**

**Estado** · Los campos de dinero **del trato** están en **0 de 590 contactos**: «Forma de pago
venta», «Método de pago», «Cuota Inicial», «Cuotas», «Estado del Producto», y los tres de tipo
`MONETORY` de la subcuenta.

**Pero el CRM sí tiene dinero cargado, y es de otro:**

| campo | contactos con valor | de quién habla |
|---|---|---|
| «Disposición e inversión» | **216** | del prospecto |
| «Meta de facturación 6 meses» | **216** | del prospecto |
| «Ticket promedio mensual por cliente» | **209** | del prospecto |
| «Clientes activos» | 138 | del prospecto |

La distribución del primero, que es el más cercano a un valor de trato:

| valor | contactos |
|---|---|
| Podría, con algo de esfuerzo | 66 |
| Sí, con capital propio | 60 |
| No en este momento | 59 |
| Sí, con tarjeta o financiamiento | 31 |

> **Ninguno de estos cuatro campos puede entrar en una cifra de revenue.** Son de **cualificación**:
> lo que el prospecto dice que factura, no lo que le vendimos. Publicar «Ticket promedio» como valor
> de la venta daría un revenue plausible y completamente falso — y *plausible* es lo que lo hace
> peligroso. Es el único de los seis huecos donde el dato existe y está al alcance de la mano.

### S1-11 · La llamada de venta

**Estado** · `negocio.llamadas` tiene **0 filas**. Cero grabaciones, cero transcripciones, cero
auditoría de llamadas de venta.

**Y esto contradice al documento:** el `§ 16.1:1072` declara *«Auditoría de llamadas de venta»* entre
las capacidades **EXISTENTES**. Hoy la auditoría que existe cubre Conversation, no Sales. Ver
`13-EL-CONTRASTE.md`.

---

## 5 · Lo que SÍ se puede medir, y tiene señal

Que no haya ventas no deja al departamento sin nada que decir. Al contrario: **lo que la cadena sí
alcanza es donde está el problema.**

### S1-12 · La proporción que le habla al problema real

```
 91  citas que ya ocurrieron, alcanzables y no canceladas
  5  tienen un resultado registrado después
```

**86 de 91 no tienen ninguno.** Ésa es la única cifra de esta pantalla que hoy puede cambiar una
conducta, y por eso el bloque de la cadena la pone a la vista en vez de esconderla en un pie.

El detalle completo está en `14-LOS-CINCO-ESLABONES.md`.

---

## 6 · Las tres reglas que esta medición impone al diseño

1. **El cero se dibuja distinto del guion, y los dos existen.** Con resultados en el mes y ninguna
   venta, `cobrado` es un **`0` medido**; sin ningún resultado es **`—`** con su motivo
   (`inicio.ts:192`). Colapsarlos es el defecto que `comision.ts:14-28` ya enumeró.
2. **La asistencia sale de `citas.asistio` y de ningún otro lado.** Nunca de la salida. Ver `S1-08`.
3. **El dinero no se recalcula.** `lib/negocio/inicio.ts` es el dueño del hecho «venta»; Sales lo
   consume. Ver `08-LO-QUE-ENTREGA-Y-RECIBE.md`.
