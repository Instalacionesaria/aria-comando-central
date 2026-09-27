# Leads Portal · Catálogo de métricas

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional y de una **medición
> propia contra producción**, agregada y sin un solo dato personal, hecha el **2026-09-27 a las
> 00:10 UTC** (el 26 por la tarde en Lima). Cada requisito lleva el `archivo:línea` del que sale. Lo
> que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** `lib/aios/leads-portal.js` (324 líneas) se
> borra en LP-6 y `components/views/ContactsView.jsx` se reescribe; en LP-7 esas citas se reapuntan,
> como pasó en `docs/sales/` y `docs/conversion/`. Hasta entonces, cada `leads-portal.js:N` de abajo
> muestra lo que dice.
>
> El documento funcional no vive en el repositorio: está en
> `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`, y las citas `§ N:línea` son a ese archivo.

---

## 0 · Cómo se lee una ficha

| Campo | Qué dice |
|---|---|
| **Qué es** | la pregunta que contesta, en una frase |
| **Fórmula** | numerador y denominador, explícitos |
| **Unidad** | conteo, proporción, porcentaje, dinero |
| **Población** | **sobre quién** se calcula |
| **Rastro** | de dónde sale el requisito: `archivo:línea` |
| **Estado** | si se puede construir hoy, y con qué cobertura medida |
| **Piso** | cuántas observaciones hacen falta antes de publicar la cifra, o por qué no lleva |

> El que decide si el requisito sirve es **Población**. Esta pestaña tiene cinco tarjetas que se
> leen como una fila de números comparables, y lo son sólo si las cinco miden sobre la misma cohorte
> y la misma unidad. Dos cifras con la misma fórmula y distinta población son dos cifras distintas.

---

## 1 · Las diez reglas que valen para todas las métricas de esta pestaña

1. **La unidad es la persona, nunca la cita.** Tres citas son una persona que agendó. El predicado
   de «agendó» es un `exists` sobre el contacto justamente por eso
   (`lib/negocio/citasAlcanzables.ts:115-127`), y la diferencia no es teórica: 226 citas alcanzables
   eran 201 contactos el 2026-09-20 (`lib/negocio/citasAlcanzables.ts:28-30`).
2. **Una sola cohorte para las cinco tarjetas y para la rejilla**: los contactos con
   `alta_en_el_crm` dentro de la ventana. Cada cifra por tramo es un subconjunto de esa cohorte y de
   ninguna otra. La ventana y sus bordes están en `06-PERIODOS-Y-PISOS.md`.
3. **El tramo se deriva del puntaje en el momento de consultar, y no se guarda.** La maqueta lo
   guarda al lado del puntaje y por eso se contradice: dos filas con el mismo 79 caen en tramos
   distintos (`lib/aios/leads-portal.js:43` y `:63`), el defecto que ya señaló
   `docs/acquisition/04-CALIDAD-DEL-LEAD.md:514-518`. Los cortes están en `14-EL-PUNTAJE-DEL-CRM.md`.
4. **Los cuatro tramos suman la cohorte exacta, y «Todos» no se calcula por separado.** Es la regla
   de apartar sin esconder (`07-REGLAS-TRANSVERSALES.md:106`): si la suma no da, se ve.
5. **El piso es del DENOMINADOR.** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`),
   con su motivo en `:300-307`. Se aplica a lo que va abajo de la raya de cada tasa, no al total.
6. **Los dos ceros no colapsan** (`07-REGLAS-TRANSVERSALES.md:110-112`). `null` es «no hay de qué
   decirlo» y `0` es un hecho medido. La maqueta los colapsa en una línea: su `rate` devuelve `0`
   cuando el denominador es cero (`lib/aios/leads-portal.js:126`).
7. **Vender es tener un resultado con salida `venta`.** No lo es un acuerdo sin pago
   (`lib/negocio/dineroDelMes.ts:79-84`) ni una venta chica del setter
   (`lib/negocio/etapas.ts:86-94`). Y es venta **reportada por el closer**, no pago verificado
   (`lib/negocio/cadenaDeCierre.ts:353-358`).
8. **La asistencia no se deduce ni se mezcla.** La que registra Avanzar (`citas.asistio`) y el
   plantón que marca el calendario viajan cada una con su nombre y nunca en el mismo denominador
   (`lib/negocio/citasAlcanzables.ts:105-109`).
9. **Un contacto descartado no sale de la cohorte: se marca.** La cadena de Sales cuenta a todos en
   su cohorte y en «llegaron a agendar» (`lib/negocio/cadenaDeCierre.ts:200-204`), y la ruta de esta
   pestaña tiene que coincidir con ella (regla 10). Descartar es un atributo de la fila, no un filtro
   de la tarjeta.
10. **El total y los agendados coinciden con la cadena de Sales en la misma ventana.** Es la prueba
    de coherencia del plan para LP-4: mismo predicado de cohorte (`lib/negocio/cadenaDeCierre.ts:169`)
    y mismo predicado de agendado (`:204`). Si una de las dos pantallas cambia su definición, la
    prueba se pone roja en vez de dejar dos cifras que no cuadran.

---

## 2 · La cohorte y su reparto

### LP02-01 · Contactos de la cohorte

**Qué es** · Cuántas personas entraron al CRM en la ventana, en total y por tramo de puntaje.
**Fórmula** · `count(*)` sobre `negocio.contactos` con
`alta_en_el_crm >= now() - make_interval(days => N)`, agrupado por el tramo del puntaje. «Todos» es
la suma de los cuatro tramos.
**Unidad** · Conteo de personas.
**Población** · Los contactos de la empresa con alta dentro de la ventana, **de cualquier
territorio** —closer, setter o congelado— y descartados incluidos. La cohorte se arma con un hecho
de entrada y no con el territorio, que es consecuencia de agendar
(`07-REGLAS-TRANSVERSALES.md:216-222`).
**Rastro** · `lib/aios/leads-portal.js:128` (`n = g.length`, por tramo) y `:146` (`all.length`, la
tarjeta «Todos»); el mismo predicado que `lib/negocio/cadenaDeCierre.ts:169`.
**Estado** · **Construible hoy, sin migración.** Medido el 2026-09-27:

| ventana | contactos |
|---|---|
| `hoy` | 0 |
| `7d` | 3 |
| `30d` *(por omisión)* | **286** |
| `completo` | 569 |

A 30 días, por tramo: **ICP alto 51 · ICP medio 83 · ICP bajo 117 · Sin calificar 35**, que suman
286. Solo `aria` tiene contactos: 593 en total, de los que 569 tienen alta (LP02-10).
**Piso** · No lleva: un conteo se publica siempre. Con la cohorte en cero, la cifra es `0` y el
aviso dice que no entró nadie, no que falte el dato —la frase ya existe en
`lib/negocio/cadenaDeCierre.ts:309-314`—.

### LP02-02 · Porción del total, por tramo

**Qué es** · Qué parte de la cohorte cae en cada tramo.
**Fórmula** · contactos del tramo / contactos de la cohorte.
**Unidad** · Proporción de 0 a 1 en la respuesta; la pantalla la redondea a porcentaje entero y la
usa también para el ancho de la barra.
**Población** · La cohorte de la ventana.
**Rastro** · `lib/aios/leads-portal.js:134-135` (`rate(n, all.length)% del total`, y la barra con el
mismo número).
**Estado** · **Construible hoy.** A 30 días: 17,8 % · 29,0 % · 40,9 % · 12,2 %. Viaja `null`
—no `0`— con la cohorte vacía, como `porcionDeLaCohorte` de Sales
(`lib/negocio/cadenaDeCierre.ts:273-275`). Las cuatro porciones suman 1 antes de redondear; después
de redondear pueden sumar 99 o 101, y eso no se corrige a mano.
**Piso** · **Sin decidir.** La cadena de Sales no le pone piso a su porción; con la cohorte de 7
días (3 contactos) eso publica tercios. Ver `LP06-P01`.

---

## 3 · Hasta dónde llegó cada persona, por tramo

### LP02-03 · Agendados

**Qué es** · Cuántas personas del tramo llegaron a tener al menos una cita que el CRM todavía
devuelve.
**Fórmula** · `count(*) filter (where tieneCitaAlcanzable('contactos'))`.
**Unidad** · Conteo de personas.
**Población** · Los contactos del tramo en la cohorte.
**Rastro** · `lib/aios/leads-portal.js:129` y `:134` («N agendados»); el filtro «Agendados» de
`components/views/ContactsView.jsx:83-85`; el predicado en `lib/negocio/citasAlcanzables.ts:128-134`.
**Estado** · **Construible hoy**, y es el mismo predicado que usan Sales
(`lib/negocio/cadenaDeCierre.ts:204`), Creative (`lib/negocio/calidadDelCreativo.ts:225`) y
Conversion. Tres consecuencias de la definición, las tres a propósito:

- **Una cita cancelada cuenta.** El predicado pregunta por la existencia de una cita alcanzable, no
  por su estado.
- **Una cita congelada no cuenta.** Su estado dejó de refrescarse (`lib/negocio/citasAlcanzables.ts:45-56`).
  La persona cuya única cita está congelada viaja marcada aparte, con `cita: 'solo_congeladas'`, y el
  resumen publica cuántas son (ver abajo).
- **La tarjeta «Sin calificar» cuenta sus agendados como las demás.** La maqueta escribe «sin
  agendar» en esa tarjeta sin mirar nada (`lib/aios/leads-portal.js:134`). No tener puntaje no dice
  nada sobre haber agendado.

**Lo que la medición de LP-0 dice y lo que no.** Tiene, el 2026-09-27, **292 personas con alguna cita** (cualquier
cita, congeladas incluidas) y 278 con una cita de un contacto no congelado. **Ninguna de las dos es
esta cifra**: la segunda aproxima «alcanzable» por el territorio del contacto y no por
`ghl_calendario_id`, que es lo que mira el predicado. La última medición con este predicado exacto es
la de Sales: **197 de 566** contactos con alta, el 2026-09-21 (`lib/negocio/cadenaDeCierre.ts:6-9`).
La cifra de esta pestaña se verifica en LP-4 contra la cadena, en la misma ventana.

> **Y hay una pantalla que cuenta distinto, y está bien escrita.** Lead Flow cuenta «agendaron» por
> la **existencia** de cualquier cita, congeladas incluidas, con el argumento escrito de que agendar
> es el evento y congelarse no lo deshace (`lib/negocio/indicadoresDelLead.ts:209-236`). Medido
> por ellos el 2026-09-16, a 30 días: 197 con su definición contra 175 con la de acá, y 22 personas
> de diferencia (`lib/negocio/indicadoresDelLead.ts:223-227`). O sea que en la misma ventana Lead
> Flow y esta pestaña van a dar dos «agendados» distintos. **La diferencia viaja** —el conteo de
> `solo_congeladas`, como Lead Flow publica el suyo (`:252-256`)— para que se vea en vez de
> descubrirse restando. Ver `LP02-P02`.

**Piso** · No lleva: es un conteo.

### LP02-04 · Asistieron

**Qué es** · Cuántas personas del tramo tienen registrado que se presentaron a su llamada.
**Fórmula** · `count(*) filter (where asistencia = 'asistio')`, con la asistencia de cada persona en
**cuatro valores**, en este orden:

| valor | cuándo |
|---|---|
| `asistio` | alguna cita de la persona tiene `citas.asistio = true` |
| `no_asistio` | ninguna en `true` y alguna en `false` |
| `sin_registrar` | ninguna con valor, y al menos una cita **cerrable**: alcanzable, no cancelada y ya empezada |
| `null` | no hay nada que registrar: sin cita, sólo futuras, sólo canceladas o sólo congeladas |

**Unidad** · Conteo de personas.
**Población** · Los contactos del tramo.
**Rastro** · El filtro «Asistieron» de `components/views/ContactsView.jsx:86-88` y su condición en
`lib/aios/leads-portal.js:112`; `§ 5.3:261` («Asistencia»).
**Estado** · **La forma sí; el contenido hoy vale cero.** Medido el 2026-09-27, en toda la base:
`asistio` es `true` en 0 personas y `false` en 0. Y **145 personas** tienen una cita ya pasada, no
cancelada y sin registro, medido sin el filtro de alcanzable y con `'cancelled'` como única grafía
de cancelada (`lib/ghl/calendarios.ts:192` tiene tres). Por eso es un **techo** de `sin_registrar`
y no la cifra: con la tabla de arriba, quien sólo tiene citas pasadas congeladas, o canceladas con
otra de esas grafías, queda en `null`, y la cifra real es ≤ 145. **Con el predicado exacto, medido
en LP-2 el mismo día: 77** en «Completo» y **47** a 30 días (`scripts/medir-leads-portal.sql`).

> **`09-DE-DONDE-VIENE-CADA-DATO.md` lo cuenta de otra manera, y hay que decirlo.** `LP09-07` llama
> «sin cita» al cuarto estado y cuenta a las 145 enteras como las que la pantalla dibuja en «sin
> registrar». Con esta tabla, el cuarto valor no es sólo «sin cita» —también lo tienen quienes sólo
> tienen citas futuras, canceladas o congeladas— y las 145 son el techo. Vale esta tabla, porque es
> la que usa las condiciones de «cerrable» (ver abajo); la cifra exacta se mide con ese predicado,
> igual que los agendados de `LP09-P01`.

Por eso un «0 asistieron» **no es «no se presentó nadie»**: es que nadie lo registró. Cuando haya
personas en `sin_registrar`, el aviso lo dice con su número, igual que la cadena de Sales avisa de las
citas que ocurrieron sin que nadie registrara qué pasó (`lib/negocio/cadenaDeCierre.ts:321-327`).

Dos decisiones de la tabla, con su motivo:

- **`sin_registrar` usa las tres condiciones de «cerrable»** de `lib/negocio/citasAlcanzables.ts:163-165`,
  que son las de la cita que Avanzar ofrece cerrar (`lib/negocio/cadenaDeCierre.ts:41-44`). Si esta pestaña acusara de no
  registrar sobre otra población, estaría acusando a gente a la que nunca se le pidió.
- **`asistio` y `no_asistio` leen cualquier cita de la persona**, congelada o no. La columna es
  nuestra —la escribe Avanzar (`lib/negocio/citasAlcanzables.ts:92`)—, no del CRM, así que congelarse
  no la vuelve vieja.

**No se publica una tasa de asistencia**, y el conteo viaja por tramo pero no se dibuja en las
tarjetas (`LP03-17`): lo usa el filtro de etapa. El denominador de una tasa serían las citas con la
asistencia respondida, y hoy son cero.
**Piso** · No lleva: es un conteo.

### LP02-05 · Plantón del calendario

**Qué es** · Si la persona tiene alguna cita que el calendario marcó como plantón.
**Fórmula** · `exists` de una cita de la persona con `marcadaComoPlanton` (`estado_ghl = 'noshow'`).
**Unidad** · Sí o no por persona.
**Población** · La persona, en su fila y en su ficha.
**Rastro** · `lib/negocio/citasAlcanzables.ts:87-113`; `lib/negocio/huecosDeSales.ts:28-30`.
**Estado** · **Construible hoy.** Medido el 2026-09-27: **15 personas** en toda la base. Es la única señal de
asistencia que existe, y es asimétrica: el lado negativo se observa y el positivo no
(`lib/negocio/citasAlcanzables.ts:96-100`).

**Nunca se suma con `asistencia`**: no convierte un `sin_registrar` en `no_asistio`, ni entra en el
conteo de LP02-04. Viaja por persona (`plantón`, en la fila), no como una tarjeta.
**Piso** · No lleva.

### LP02-06 · Vendidos

**Qué es** · Cuántas personas del tramo compraron.
**Fórmula** · `count(*) filter (where tieneVenta)`, donde `tieneVenta` es que exista un resultado de
esa persona con `salida = 'venta'`, de cualquier fecha y con o sin cita. Estaba escrito dentro de la cadena de Sales hasta LP-2, que
lo sacó a `lib/negocio/ventasDelContacto.ts:44-46`; la cadena lo importa, sin cambiar lo que
calcula.
**Unidad** · Conteo de personas: dos ventas de la misma persona cuentan una.
**Población** · Los contactos del tramo.
**Rastro** · `lib/aios/leads-portal.js:129` (`vend`); el filtro «Vendidos» de
`components/views/ContactsView.jsx:89-91`; `§ 5.3:262` («Resultado de venta»).
**Estado** · **La forma sí; hoy vale 0.** Medido el 2026-09-27: 0 personas con venta. Los resultados que existen
son seguimiento 4, no_show 2 y no_interesa 1, los mismos siete que `lib/negocio/huecosDeSales.ts:9-11`
contó el 2026-09-21.

> **No es el último eslabón de la cadena de Sales.** La cadena cuenta la venta sólo si la persona
> tiene una cita cerrable y un intento registrado después (`lib/negocio/cadenaDeCierre.ts:206-208`),
> porque su trabajo es que el embudo sea monótono. Esta pestaña cuenta la venta de la persona sin
> esas condiciones. Hoy las dos valen 0; el día que alguien registre una venta sin cita, esta cifra
> va a ser mayor que la de Sales **y las dos van a estar bien**. Por eso la prueba de coherencia
> compara el total y los agendados, y no los vendidos.

**Piso** · No lleva: es un conteo.

---

## 4 · La tasa y el dinero

### LP02-07 · Cierre

**Qué es** · De cada cien personas del tramo, cuántas compraron.
**Fórmula** · vendidos del tramo / contactos del tramo.
**Unidad** · Porcentaje.
**Población** · **Los contactos del tramo**: ni los agendados ni las citas. Es una conversión de
lead a venta, y el rótulo lo dice.
**Piso** · `PISO_DE_UNA_TASA` sobre los contactos del tramo.
**Rastro** · `lib/aios/leads-portal.js:138` (`rate(vend, n)`) y `:149` (la tarjeta «Todos»);
`lib/negocio/huecosDeSales.ts:57-62`.
**Estado** · **`null` hoy, con motivo.** El valor sale del primer caso que se cumpla, en el mismo
orden que `LP03-12`:

| orden | caso | valor | `porQueSinCierre` |
|---|---|---|---|
| 1 | la empresa no tiene **ninguna** venta registrada en toda la base, no sólo en la ventana | `null` | `sin_ventas_registradas` |
| 2 | el tramo tiene menos de 10 contactos, cero incluido | `null` | `bajo_el_piso` |
| 3 | todo lo demás | vendidos / contactos, **cero incluido** | `null` |

El caso 1 es el de hoy, y está escrito así para **no contradecir a Sales**: su hueco dice que no hay
ninguna venta que sumar y que un número ahí afirmaría otra cosa (`lib/negocio/huecosDeSales.ts:49-62`).
La maqueta, con su `rate`, dibujaría «Cierre 0%» en cada tarjeta sin ventas. Si el caso 1 se mide en
la empresa o en la ventana es la pregunta `LP03-P02`; hoy dan lo mismo.

El cero del caso 3 sí es un hecho: la base tiene ventas y ninguna es de este tramo.

> **No es la «tasa de cierre» del documento.** Aquélla es de Business, y Sales, al descartarla, la
> leyó sobre intentos: «0 ventas sobre 7 intentos» (`docs/sales/02-METRICAS.md:237-241`). Ésta es
> por persona y sobre todos los contactos del tramo.
> Con el mismo nombre en dos pantallas, el rótulo tiene que decir la población. Si el rótulo sigue
> siendo «Cierre» es la pregunta `LP03-P01`.

### LP02-08 · Monto reportado

**Qué es** · Cuánto dinero reportaron los closers por las ventas de las personas del tramo.
**Fórmula** · `sum(resultados.monto)` de los resultados con `salida = 'venta'` de las personas del
tramo.
**Unidad** · Dinero, tal como el closer lo cargó.
**Población** · Los resultados `venta` de los contactos del tramo. **`acuerdo_sin_pago` no entra**
(`lib/negocio/salidas.ts:96`; `lib/negocio/dineroDelMes.ts:79-84`).
**Rastro** · `lib/aios/leads-portal.js:130` y `:138` (por tramo), `:149` (Todos) y `:189-191` (cada
tarjeta de la rejilla); `§ 5.3:263` («Monto reportado por el closer»).
**Estado** · **`null` hoy, con el mismo motivo que LP02-07.** Medido el 2026-09-27: 0 montos
cargados en toda la base. Tres requisitos:

- **El rótulo es «monto reportado»**, nunca «Revenue» (`lib/aios/leads-portal.js:138`) ni
  «facturado» (`:190`). Este sistema no tiene integración de cobros y la cifra es lo que el closer
  dijo (`lib/negocio/cadenaDeCierre.ts:353-358`).
- **Un `$0` no reemplaza a un `null`.** La maqueta dibuja el mismo hecho de dos maneras en la misma
  pantalla: la tarjeta de un tramo sin ventas dice «—» (`lib/aios/leads-portal.js:138`) y la tarjeta
  «Todos» dice `money(revT)`, o sea «$0» (`:149`).
- **Una venta sin monto no se suma como cero.** Si hay ventas y ninguna trae monto, el valor es
  `null` con `ventas_sin_monto`, como en `LP03-13`; si sólo algunas lo traen, se suman ésas y el aviso
  dice cuántas faltan. Es la misma regla de no colapsar estados que `lib/negocio/comision.ts:14-27`
  aplica a la comisión: un `?? 0` en cualquier punto convierte ese nulo en un cero falso
  (`lib/negocio/comision.ts:26-27`).

**Piso** · No lleva, porque no es una tasa. Pero no viaja solo: al lado va el conteo de vendidos del
mismo tramo.

---

## 5 · Lo que la pestaña dice de sí misma

### LP02-09 · Sin calificar, partido en tres

**Qué es** · De las personas del tramo «Sin calificar», cuántas no tienen puntaje y cuántas lo tienen
en 0; y si apareció un 0 reciente que obligue a revisar la regla.
**Fórmula** ·

- `sinPuntaje` = contactos de la cohorte con `score is null`;
- `enCero` = contactos de la cohorte con `score = 0`;
- `sinPuntaje + enCero` = contactos del tramo «Sin calificar», **siempre**;
- `cerosRecientes` = contactos **de la empresa** con `score = 0` y alta en los últimos 14 días,
  **sin la ventana**.

**Unidad** · Conteos.
**Población** · Las dos primeras, la cohorte; la tercera, la empresa entera.
**Rastro** · `lib/aios/leads-portal.js:67-78` (los «nc» de la maqueta son los de `icp:null`) y
`:136-137` («Aún sin formulario · califican al agendar»); `lib/negocio/sincronizar.ts:412-420` (el
cero no se colapsa a nulo); `docs/acquisition/04-CALIDAD-DEL-LEAD.md:594-597` (la pregunta P-6,
que esta pestaña contesta).
**Estado** · **Construible hoy.** Medido el 2026-09-27 sobre los 593: **169 sin calificar = 122
nulos + 47 ceros**. Los ceros por semana de alta: 3 en la del 17-ago, 23 en la del 24-ago, 21 en la
del 31-ago, y **0 en los últimos 14 días**.

A 30 días son 35 sin calificar, y **al menos 21 son ceros**: los 21 de la semana del 31-ago tienen
alta posterior al 2026-08-28, que es donde empieza esa ventana. La medición no parte los 35
directamente; la cuenta sale de las dos cifras de arriba.

**Por qué `cerosRecientes` se mide sin la ventana.** Es un guardián, no una cifra del período: si se
midiera dentro de la cohorte, el aviso aparecería con «30 días» y desaparecería con «7 días» para el
mismo 0. Es el mismo motivo por el que la cadena de Sales mide su cobertura sin la ventana
(`lib/negocio/cadenaDeCierre.ts:241-242`). Qué dice el aviso cuando se enciende está en
`14-EL-PUNTAJE-DEL-CRM.md`.

**La explicación de la maqueta no es un requisito.** «Aún sin formulario · califican al agendar»
afirma dos cosas que nada medido sostiene: que el que no tiene puntaje no llenó el formulario, y que
lo va a tener al agendar.
**Piso** · No lleva: son conteos.

### LP02-10 · Cobertura: los que no tienen alta

**Qué es** · Cuántos contactos de la empresa no pueden entrar en ninguna ventana porque no tienen
`alta_en_el_crm`.
**Fórmula** · `count(*)` de contactos con `alta_en_el_crm is null`, en toda la empresa y sin
ventana. Viaja como `cohorte.sinAlta`.
**Unidad** · Conteo, siempre con su total al lado.
**Población** · La empresa entera.
**Rastro** · `lib/negocio/cadenaDeCierre.ts:124-137` (el campo) y `:343-351` (el aviso).
**Estado** · **Construible hoy.** Medido el 2026-09-27: **24 de 593 (4,0 %)**, y los 24 son
congelados. Ninguna
ventana los recupera, ni «Completo»: por eso «Completo» cuenta 569 = 593 − 24. Cuando es mayor que
cero, el aviso lo dice con la frase de la cadena, que ya distingue «no entró en esta ventana» de «no
entra en ninguna».
**Piso** · No lleva.

---

## 6 · Lo que la maqueta dibuja y NO se construye

### LP02-11 · «Revenue» por tramo y «facturado» por persona

**Rastro** · `lib/aios/leads-portal.js:138`, `:149`, `:189-191`.
**Estado** · **No, con ese nombre.** Lo reemplaza LP02-08, con su rótulo y sus nulos.

### LP02-12 · «Aún sin formulario · califican al agendar»

**Rastro** · `lib/aios/leads-portal.js:136-137`.
**Estado** · **No.** Lo reemplaza LP02-09: la tarjeta «Sin calificar» lleva las mismas cifras que las
otras tres, más su partición en `sinPuntaje` y `enCero`.

### LP02-13 · Los porcentajes sin denominador

**Rastro** · `lib/aios/leads-portal.js:126` —`rate = (a,b) => b ? Math.round(a/b*100) : 0`—, que
alimenta la porción, el cierre y el ancho de las barras.
**Estado** · **No.** Cada una de esas cifras tiene su `null` con motivo en LP02-02 y LP02-07.

---

## 7 · Preguntas abiertas

### LP02-P01 · ¿Se publica la tasa de agenda por tramo?

La maqueta dibuja agendados como conteo y nunca como tasa. Pero es la única cifra en la que los
tramos se separaron alguna vez: medido por Acquisition el 2026-09-16, el tramo alto agendaba 75,7 %
y medio y bajo 50,8 % y 53,1 %, indistinguibles entre sí
(`docs/acquisition/04-CALIDAD-DEL-LEAD.md:543-555`). Con cero ventas, es lo único que hoy puede decir
si el corte en 75 separa algo. El plan no la incluye en la respuesta; agregarla es una tasa más, con
el mismo piso.

### LP02-P02 · ¿Qué definición de «agendó» es la del producto?

Esta pestaña usa la de Sales, Creative y Conversion —cita alcanzable— por decisión del plan, y Lead
Flow usa la existencia de cualquier cita (`lib/negocio/indicadoresDelLead.ts:209-236`). Las dos
tienen su argumento escrito y las dos están bien. Mientras convivan, la diferencia viaja
(`solo_congeladas`); la pregunta es si alguna vez deberían converger, y en cuál.

### LP02-P03 · ¿El agendado que sólo tiene citas canceladas se distingue?

Medido el 2026-09-27: de las 292 personas con alguna cita, **146 sólo tienen canceladas** (con
`estado_ghl = 'cancelled'` exacto y sobre todas las citas, congeladas incluidas, así que es una
aproximación). Con la definición de LP02-03, cuentan como agendados. Son la mitad de las personas
con alguna cita en toda la base. Qué parte de los agendados representan no se midió —LP-2 midió los
agendados, 200 en «Completo», pero no los partió por cancelación— y la tarjeta no lo dice. ¿Se marca como `cita` aparte, igual que `solo_congeladas`? Es la misma pregunta
que `LP04-P03` hace desde la rejilla, y se contesta una sola vez.

---

## 8 · Índice del catálogo

| id | métrica | ¿construible hoy? |
|---|---|---|
| `LP02-01` | Contactos de la cohorte | **sí** — 286 a 30 días |
| `LP02-02` | Porción del total por tramo | **sí** — el piso está sin decidir |
| `LP02-03` | Agendados | **sí** — cuenta canceladas, no congeladas |
| `LP02-04` | Asistieron | **la forma sí** — hoy 0, y no es «nadie asistió» |
| `LP02-05` | Plantón del calendario | **sí** — 15 personas, por fila |
| `LP02-06` | Vendidos | **la forma sí** — 0 |
| `LP02-07` | Cierre | **no** — `null` con `sin_ventas_registradas` |
| `LP02-08` | Monto reportado | **no** — `null`, 0 montos cargados |
| `LP02-09` | Sin calificar: sin puntaje, en cero, ceros recientes | **sí** — 122 · 47 · 0 |
| `LP02-10` | Cobertura: sin alta | **sí** — 24 de 593 |
| `LP02-11` | «Revenue» y «facturado» | **no**, con ese nombre |
| `LP02-12` | «Aún sin formulario · califican al agendar» | **no** |
| `LP02-13` | Porcentajes sin denominador | **no** |
