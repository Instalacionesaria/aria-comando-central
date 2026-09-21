# Los cinco eslabones, y dónde se corta cada uno

> **Las citas a `SalesView.jsx` apuntan al encabezado que documenta lo borrado, no al marcado.** La maqueta se fue el 2026-09-21 con `components/sales/PanelDeSales.jsx`; su encabezado enumera cada pieza eliminada con la medición que la desmiente.

> Medición propia contra producción, **2026-09-20**. Una sola organización tiene datos (ARIA).
> Cada cifra lleva la consulta que la produjo en `09-DE-DONDE-VIENE-CADA-DATO.md`.

El `§ 5.2:227-236` del documento funcional describe la trazabilidad como una cadena de ocho eslabones:

```
meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id
                                    → appointment_id → sales_call_id → sale_report_id
```

**Los dos últimos son los de Sales, y son los dos únicos que no existen en nuestro esquema con ningún
nombre.** Este archivo mide lo que sí existe, eslabón por eslabón.

---

## S14-01 · La cadena medida

```
 590  contactos en la base
  ↓   34 %
 201  contactos con al menos una cita alcanzable      (226 citas)
  ↓
  91  citas que ya ocurrieron y no se cancelaron
  ↓   5 %
   5  tienen un resultado registrado después
  ↓
   0  son una venta
```

**Qué es** · Cuántos contactos llegan a cada eslabón que se puede medir.
**Fórmula** · Conteo de contactos distintos que cumplen ese eslabón **y todos los anteriores**.
**Unidad** · Conteo de contactos. El conteo de **citas** viaja al lado como segundo término, nunca
como el número del eslabón.
**Población** · La cohorte de la ventana.
**Rastro** · `§ 5.2:227-236`; `SalesView.jsx:14-18` anota los cuatro KPI que esta cadena reemplazó.
**Estado** · **Construida** en `lib/negocio/cadenaDeCierre.ts`, salvo el último eslabón.

### Por qué la unidad es el contacto en los cuatro

Medido: **226 citas alcanzables son 201 contactos.** Si el primer eslabón cuenta contactos y el
segundo cuenta citas, la caída de 590 a 226 mezcla dos unidades y nadie lo ve. La regla es la misma
que `recorridoDelLead.ts` aplica en Conversion.

### Y por qué la monotonía se garantiza en la consulta, no se supone

`resultados.cita_id` es nulo en las 7 filas, y el esquema permite un resultado sobre un contacto sin
cita. Si el eslabón «con intento» se contara suelto, podría salir **mayor** que el de arriba y la
pantalla dibujaría un embudo que se ensancha. Los que no encajan viajan aparte, en `intentosSinCita`.

Es la regla 11 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:451`: *«una cadena que no es monótona
no es un embudo»*. Acá sí lo es — **por construcción, no por suerte**.

---

## S14-02 · El primer corte: de 590 a 201

**Dos tercios de los contactos nunca tuvieron una cita alcanzable.** No es un defecto de Sales: es el
embudo de Acquisition y Conversation, y Sales lo hereda. Se dibuja porque sin él las cifras de abajo
no tienen denominador honesto.

Y hay un matiz que va al lado: de las 327 citas de la base, **101 no son alcanzables** —
`ghl_calendario_id` nulo, o sea que el CRM ya no devuelve su evento. Son citas **congeladas**, y el
filtro que las aparta es del sistema, no de esta pantalla
(`lib/negocio/indicadoresDeCitas.ts:316-326`).

---

## S14-03 · El segundo corte, que es el hallazgo: 59,2 % de cancelación

De las **223** citas alcanzables cuyo horario ya pasó:

| estado | citas | |
|---|---|---|
| `cancelled` | **132** | **59,2 %** |
| `confirmed` | 76 | 34,1 % |
| `noshow` | 15 | 6,7 % |

**De cada diez citas que se agendaron, casi seis se cancelaron antes de ocurrir.** Es la única cifra
del embudo comercial que hoy se puede medir de punta a punta, y es la que va de cabecera.

### El movimiento semana a semana

| semana | citas | canceladas | confirmadas | no-show |
|---|---|---|---|---|
| 2026-08-24 | 41 | 23 (56 %) | 18 | 0 |
| 2026-08-31 | 66 | 37 (56 %) | 28 | 1 |
| **2026-09-07** | **89** | **59 (66 %)** | 19 | 11 |
| 2026-09-14 | 27 | 13 (48 %) | 11 | 3 |
| 2026-09-21 | 2 | 0 | 2 | 0 |
| 2026-09-28 | 1 | 0 | 1 | 0 |

Dos cosas que hay que leer juntas: **la cancelación subió a 66 % la semana del 7 de septiembre**, y
**el volumen se desploma después** — 27, 2, 1. Lo segundo es la pauta apagada desde el 2026-09-14
(medido en `docs/conversion/14-…`, $0,00 de gasto diario). Lo primero no tiene explicación medida.

> **No se recalcula acá.** `lib/negocio/indicadoresDeCitas.ts:312 :: tasaDeCancelacion` ya existe y
> Sales sería su **segundo** consumidor — hoy sólo la usa `app/api/auditoria/route.ts:97`. Y trae
> gratis la partición de descartados que el commit `9931f4d` ya pagó: sin ella la cifra mezcla el
> descarte propio con la pérdida real.

---

## S14-04 · El tercer corte, y es el que le habla al problema

```
 91  citas ocurridas, alcanzables, no canceladas
 86  SIN ningún resultado registrado después     ← 95 %
  5  con resultado
  0  con asistencia registrada                   ← las 327, ver S1-07
```

**86 de 91.** Esta cifra no describe a los leads: describe al equipo. Y es, de todo lo que esta
pantalla puede publicar, lo único que hoy puede cambiar una conducta.

Por eso el bloque de la cadena la pone a la vista en vez de esconderla en un pie, y por eso el hueco
de la venta se dibuja **con esta medición al lado** — la venta no falta porque el sistema no la
soporte, falta porque la cita que la produciría no se cierra.

---

## S14-05 · El cuarto corte: cero

De los 5 resultados que sí se registraron después de una cita ocurrida: **ninguno es una venta**.
Ver `01-LA-VENTA-NO-EXISTE.md`.

---

## S14-06 · El tiempo: la mediana y la media dicen cosas distintas

**Qué es** · Cuántos días pasan entre el alta del contacto en el CRM y su primera cita alcanzable.
**Unidad** · Días.
**Población** · Los 197 contactos con alta y con primera cita medibles.
**Piso** · `PISO_DE_UNA_TASA = 10` sobre la población medida.
**Estado** · **Construida**, y con una advertencia.

| estadístico | días |
|---|---|
| **mediana** | **2,9** |
| media | 16,5 |
| máximo | 290 |

La distribución explica la brecha:

| cuándo agendó | contactos |
|---|---|
| el mismo día | 31 |
| dentro de la semana | 134 |
| dentro del mes | 18 |
| más de un mes | **14** |

**165 de 197 agendan dentro de la semana, y una cola de 14 arrastra la media de 2,9 a 16,5.** La
mediana es el estadístico honesto; la media describe a la cola y no a la gente.

> Y hay un segundo sesgo que no se ve: **el techo de la ventana**. Con el botón de «7 días», la
> mediana no puede pasar de 7 — sólo entran los que agendaron rápido, así que esa ventana produce
> siempre un ciclo excelente y nada falla. Por eso la cifra viaja con su techo declarado. Ver
> `06-PERIODOS-Y-PISOS.md`.

**Y el nombre importa:** esto mide **alta → primera cita**, no alta → venta. Un rótulo que diga
«ciclo de venta» promete el eslabón que justamente no existe.

---

## S14-07 · Cero contactos con ciclo negativo

Comprobado: ninguna primera cita es anterior al alta del contacto. No hace falta una guarda por datos
corruptos — pero sí una por construcción, porque una cita anterior al alta no es un ciclo y el día que
aparezca no puede entrar como cero.
