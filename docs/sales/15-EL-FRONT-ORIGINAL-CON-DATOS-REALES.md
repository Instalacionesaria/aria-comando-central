# Sales — el front original, con los datos reales

> Requisitos nuevos del **2026-10-09**, pedidos por el usuario: la pestaña vuelve al front del prototipo
> —`aios-command-center_1.html`, sección `#v-sales`— **con la estética al 100 %**, y se llena con lo que el
> backend junta hoy. Es el mismo camino que siguieron Acquisition
> (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`) y Conversion
> (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Prefijo `S15-`. Formato de la carpeta: Qué es /
> Fórmula / Rastro / Estado. Este documento **no** reemplaza a los otros catorce: contesta algunas de sus
> preguntas (§ 4) y fija qué dato va en cada lugar del prototipo.

---

## 1 · Qué se pidió, y las decisiones que lo ordenan

El 2026-09-21 la maqueta de Sales se reemplazó por otra pantalla —el dinero del mes, la cobertura, la cadena
de cierre, la cancelación, el ciclo hasta la cita y la tabla por closer, más cinco huecos— con la estética de
operación (`estetica-op`, `components/views/SalesView.jsx:58@a39a732`). Se hizo por una buena razón: la maqueta
dibujaba 23 valores inventados que cerraban entre sí y engañaban (`docs/sales/03-LOS-CUATRO-KPI.md`). Pero con
eso se perdió **la forma** que había pedido el product owner. Hoy esa forma vuelve, con los datos.

**El prototipo de Sales es el más chico de los cinco**, y el único sin una línea de JavaScript propio
(`aios-command-center_1.html:2931-2995`): cada cifra está escrita en el marcado. Son cuatro bloques:

- el encabezado, con «Plan de acción» —sin oyente—, «Hoy · 7 días · 30 días» —sin oyente, y con la clave
  inválida `mes`— y la píldora «Personalizado» (`aios-command-center_1.html:2934-2946`);
- cuatro cifras en `grid-4`: Asistencias, Tasa de cierre, Ventas y Revenue reportado
  (`aios-command-center_1.html:2948-2953`);
- la tarjeta «Closers», con seis columnas (`aios-command-center_1.html:2955-2970`);
- la tarjeta «Motivos de no venta», con su barra por motivo (`aios-command-center_1.html:2972-2992`).

Sus reglas siguen vivas en `app/aios.css`: `.card` (`app/aios.css:511-529`), `.grid-4` (`app/aios.css:532`),
`.stat` (`app/aios.css:536-537`), `.rows`, `.row-i` y `.col-head` (`app/aios.css:540-559`) y `.mini-bar`
(`app/aios.css:569-570`). No hay ninguna regla con `#v-sales`.

### Decidido por el usuario el 2026-10-09

| tema | decisión | requisito |
|---|---|---|
| Las cuatro cifras | **Los rótulos del prototipo.** Asistencias y Tasa de cierre en «—» con su motivo mientras no haya dato; Ventas y Revenue reportado con el dato real **de la ventana elegida** | S15-05 a S15-08 |
| Los motivos de no venta | **Lo que registra el closer** en Avanzar: la salida «No le interesa», con su catálogo real | S15-11 |
| Lo que la pantalla de hoy mide y el prototipo no tenía | **Debajo, con el estilo del prototipo**: la cadena, la cancelación, el ciclo, el dinero del mes y la cobertura | S15-12 |
| El «Plan de acción» | **No se dibuja por ahora**: Sales no tiene detector ni señales | S15-03 |

### Tomado por defecto, y que se confirma en la revisión de este documento (§ 6)

| tema | lo que se toma | por qué | pregunta |
|---|---|---|---|
| Las ventanas | **Rodantes, como hoy**: «Hoy» son las últimas 24 horas, y 7 y 30 días terminan ahora | Sales no lee anuncios, y los días cerrados se anclan a la serie de gasto; `tasaDeCancelacion` la comparten Conversation, Closer y el cerebro | `S15-P01` |
| Las flechas contra la ventana anterior | **Ninguna** | El prototipo de Sales no las tenía | `S15-P02` |
| La tabla de closers | Las columnas del prototipo con lo real: Agendadas, las citas del CRM; Asistieron, «—»; Ventas y Cierre, de lo registrado; Revenue, el monto reportado | El dinero baja a la tabla porque la fila de cifras ya lo publica (S15-08) | `S15-P03` |
| La subfila de cada closer | «{N} contactos asignados» y no «ICP alto asignado» | La asignación por ICP no existe | — |
| La asistencia | **Sólo `asistio`**, lo que marca el closer, y no el «showed» del calendario | El calendario marca algunas citas y no otras: no da denominador | `S15-P04` |
| Los huecos | **Salen de la pantalla** y pasan a `docs/OTROS/futuro/lo-que-sales-no-mide.md` | Como en Conversion (CV15-27) | — |
| Los rótulos | Cuatro desvíos declarados del prototipo | Ver S15-02 | — |

---

## 2 · Qué dato va en cada lugar del prototipo

Medido en producción el **2026-10-09**, con `scripts/supabase.mjs leer`, sólo lectura y sólo agregados, de la
organización que tiene datos.

| lugar del prototipo | dato | fuente | medido |
|---|---|---|---|
| Encabezado | «Sales», «Cierre, closers y motivos de pérdida» y los cuatro períodos de `lib/negocio/periodo.ts:83-96` | — | — |
| Asistencias | las citas ocurridas en la ventana con `asistio` marcado como presente | `negocio.citas.asistio` | **0 de 363** citas con la asistencia marcada: «—», «Nadie marca la asistencia.» |
| Tasa de cierre | ventas sobre intentos de los closers en la ventana, con piso de 10 intentos | `lib/negocio/cierrePorCloser.ts:336-369` | 1 intento en 30 días: «—» |
| Ventas | la suma de las ventas registradas por los closers en la ventana | `lib/negocio/cierrePorCloser.ts:348` | **0** en 30 días (cero medido: hubo 1 resultado); en 7 días, «—» |
| Revenue reportado | la suma del `monto` de esas ventas | `negocio.resultados.monto` | **$0** en 30 días |
| Closers | una fila por closer configurado, sin ranking | `lib/negocio/cierrePorCloser.ts:231` | 3 closers, 2 registraron alguna vez |
| Motivos de no venta | los resultados de «No le interesa» por motivo del catálogo (`lib/negocio/salidas.ts:159-167`), en la ventana | `negocio.resultados.detalle` | 1 en toda la historia, «Otro», del 2026-08-30; ninguno en 30 días |
| La cadena comercial (abajo) | `cadenaDeCierre`, `tasaDeCancelacion`, `cicloHastaLaCita` y `dineroDelMes` | `lib/negocio/lecturaDeSales.ts:246` y `lib/negocio/lecturaDeSales.ts:272-274` | — |

### Lo que la medición del 2026-10-09 agregó

- **`negocio.resultados` sigue con 7 filas**: 1 «No le interesa» de agosto, y 2 «No-show» y 4 «Seguimiento» de
  septiembre. **Ninguna venta, ningún monto y ninguna con su cita.** La última es del 2026-09-09: un mes sin un
  solo registro.
- **Las citas son 363**, del 2026-08-12 al 2026-10-13. Ninguna tiene la asistencia marcada. 19 son plantones del
  calendario, 176 están canceladas, 101 congeladas, y **3 dicen «showed» por primera vez**: el calendario empezó
  a marcar presentes, y nadie lo hizo en Avanzar.
- **En los últimos 30 días**, de 111 citas ya ocurridas: 56 canceladas, 38 confirmadas, 14 plantones y 2 «showed».
- **Los closers son 3**, los tres con su usuario del CRM. **Dos registraron alguna vez**, y en 30 días hay **un
  resultado**.
- **Los contactos son 620**, 24 sin alta. Las altas por semana desde el 2026-08-31: 175, 89, 5, 5, 11 y 6.
- **Ese único resultado de 30 días es del 2026-09-09**: la ventana es rodante y lo alcanzaba por un día. Desde el
  2026-10-10, sin un registro nuevo, Ventas y Revenue dicen «—» también en 30 días, y en la tabla dicen «—» los
  closers sin resultados en la ventana. Los ceros de este documento son los del día de la medición.

---

## 3 · Los requisitos

### S15-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo, y en su orden: `cre-head`, `grid-4` con cuatro
`card` de `stat`, la tarjeta «Closers» y la de «Motivos de no venta». La sección **no lleva `estetica-op`**, y
`#v-sales` sale de los `:is()` de `app/inteligencia-estetica.css`, que hoy la repintan.

**Fórmula** · Lo nuevo —la nota, la tarjeta de abajo, el teléfono— va en una hoja propia, `app/sales.css`, acotada
a `#v-sales`. Es el método de Acquisition (A14-01) y de Conversion (CV15-01).

**Rastro** · El prototipo: `aios-command-center_1.html:2931-2995`. La pantalla anterior:
`components/views/SalesView.jsx:58@a39a732` y `components/sales/PanelDeSales.jsx:42@a39a732`.

**Estado** · Construido el 2026-10-09 (SA-3): `components/views/SalesView.jsx`, `components/sales/PanelDeSales.jsx`
y `app/sales.css`; `#v-sales` salió de `app/inteligencia-estetica.css`. Lo prueba
`pruebas/codigo/249-la-pantalla-de-sales.test.ts`.

### S15-02 · Frases cortas, de una lista cerrada

**Qué es** · Los huecos, los motivos y los estados usan **sólo** estas frases:

| situación | texto |
|---|---|
| cifra o tasa sin dato, o bajo el piso | «—» |
| sección o métrica sin fuente | «Sin dato» |
| la asistencia, en las cifras y en la tabla | «Nadie marca la asistencia.» |
| la asistencia sin ninguna cita en la ventana | «Sin citas en esta ventana.» |
| ventas o revenue sin ningún resultado en la ventana | «Nadie registró en esta ventana.» |
| el revenue, debajo de la cifra | «reportado por el closer» |
| la tasa de cierre bajo el piso de intentos | «Pocos intentos para una tasa.» |
| el revenue con alguna venta sin monto | «Hay ventas sin monto.» |
| la tarjeta de motivos sin ningún motivo en la ventana | «Sin motivos registrados.» |
| los motivos que no casan con el catálogo | «Fuera del catálogo» |
| la tabla, y las cifras de lo registrado, sin closers configurados | «Sin closers configurados.» |
| la cadena con la cohorte vacía | «Sin contactos en este período» |
| la primera carga | «Cargando…» |
| la lectura falló | «No se pudo leer. Reintenta.» |

Lo que el servidor escribe —los avisos de la cadena, de la cancelación, del ciclo y del dinero— va como viene.

**Los desvíos de rótulo, declarados** ·

| en el prototipo | acá | por qué |
|---|---|---|
| la subfila «ICP alto asignado» | «{N} contactos asignados» | la asignación por ICP no existe (`docs/sales/04-LA-TABLA-DE-CLOSERS.md`) |
| «56 llamadas sin cierre» | «{N} sin venta» | se cuentan resultados registrados, no llamadas |
| los motivos «No es quien decide», «Sin necesidad clara», «Pidió tiempo» | los del catálogo: Precio, No es el momento, Competencia, No califica, Otro | `lib/negocio/salidas.ts:159-167`; «Pidió tiempo» es de otra salida |
| las barras de los motivos: las dos primeras en el color de alerta y las otras en gris | las del catálogo en el de alerta y la de fuera del catálogo en gris | el color dice de dónde viene el motivo, no su lugar en la lista |
| «Agendadas» | igual, pero son citas del CRM, no resultados | dos ejes distintos (`docs/sales/04-LA-TABLA-DE-CLOSERS.md`) |

**Estado** · Construido el 2026-10-09 (SA-3): la lista vive en la constante `FRASE` de `components/sales/comun.jsx`,
y `pruebas/codigo/249-la-pantalla-de-sales.test.ts` exige que las dos coincidan en las dos direcciones.

### S15-03 · El encabezado

**Qué es** · «Sales» y la bajada del prototipo, «Cierre, closers y motivos de pérdida», que vuelve: la pantalla
publica otra vez los closers y los motivos. En `.ch-r` va sólo el segmentado.

- **Sin «Plan de acción»**: Sales no tiene detector ni señales (`lib/agentes/senales/tipos.ts:6-7`), y en el
  prototipo el botón no abría nada. Lo que haría falta está en `docs/OTROS/futuro/lo-que-sales-no-mide.md`.
- **Sin «Personalizado»** y sin la clave `mes`: los cuatro períodos del sistema.
- Con la cabecera del departamento a la vista, `app/departamentos.css` oculta el `.ch-l`; como en Sales no hay
  chip, no hace falta devolverlo.

**Estado** · Construido el 2026-10-09 (SA-3).

### S15-04 · Las ventanas

**Qué es** · Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), con 30 días por omisión
(`lib/negocio/periodo.ts:109`). Son **rodantes**: «Hoy» son las últimas 24 horas, como dice su `title`
(`lib/negocio/periodo.ts:84`), que acá se conserva porque es cierto. El botón encendido es el que contestó el
servidor.

**Fórmula** · Las de hoy, sin cambios: las citas por `inicio_el` y los resultados por `creado_el`, desde `now()`
menos los días del período. El dinero del mes va por mes calendario en la zona de la empresa
(`lib/negocio/dineroDelMes.ts:101`).

**La diferencia con Acquisition y Conversion, dicha** · Esas dos cortan «7 días» y «30 días» en días cerrados.
Sales no, por las dos razones de § 1. Es `S15-P01`.

**Estado** · Construido el 2026-09-21; sin cambios.

### S15-05 · Asistencias

**Qué es** · Cuántas citas de la ventana tienen la asistencia marcada como presente.

**Fórmula** · Citas ocurridas en la ventana con `asistio = true`: el `sePresentaron` de `tasaDeCancelacion`, con su
misma población —las citas alcanzables y sin contactos descartados (`lib/negocio/indicadoresDeCitas.ts:397-399`)—. Si ninguna cita de la ventana tiene `asistio`
marcado, «—» con «Nadie marca la asistencia.»: no es cero, porque nadie respondió la pregunta. Sin ninguna cita
en la ventana, «—» con «Sin citas en esta ventana.».

**Qué no es** · No es el «showed» del calendario: el calendario marca algunas citas y no otras, y un conteo sin
denominador no es asistencia (`docs/OTROS/estado actual/05-SALES.md`, regla 7). Es `S15-P04`.

**Estado** · El cálculo, construido el 2026-10-09 (SA-1): `asistencias` de `armarSales`, en `lib/negocio/lecturaDeSales.ts`; el dibujo, construido el 2026-10-09 (SA-3). Hoy, «—».

### S15-06 · Tasa de cierre

**Qué es** · Ventas sobre intentos de los closers en la ventana.

**Fórmula** · Σ ventas / Σ intentos de las filas de `cierrePorCloser` (`lib/negocio/cierrePorCloser.ts:336-369`).
Un intento es un resultado registrado por el closer. Con menos de `PISO_DE_UNA_TASA` (10) intentos, «—» con
«Pocos intentos para una tasa.»; sin ninguno, «Nadie registró en esta ventana.»; sin closers configurados, «Sin
closers configurados.».

**Estado** · El cálculo, construido el 2026-10-09 (SA-1): `tasaDeCierre` de `armarSales`; el dibujo, construido el 2026-10-09 (SA-3). Hoy, «—»: un intento en 30 días.

### S15-07 · Ventas

**Qué es** · Las ventas registradas por los closers en la ventana. Sólo la salida `venta`: la `venta_chica` del
setter es otra cosa y no se suma.

**Fórmula** · Σ `ventas` de las filas. Sin ningún resultado de los closers en la ventana, «—» con «Nadie registró
en esta ventana.»; sin closers configurados, «Sin closers configurados.»; con resultados y sin ventas, **0**, que
es un cero medido. Es la misma distinción de
`dineroDelMes` (`lib/negocio/dineroDelMes.ts:156-186`).

**Estado** · El cálculo, construido el 2026-10-09 (SA-1): `ventas` de `armarSales`; el dibujo, construido el 2026-10-09 (SA-3). El 2026-10-09, 0 en 30 días y «—» en 7.

### S15-08 · Revenue reportado

**Qué es** · El monto que los closers reportaron de esas ventas. Debajo, «reportado por el closer»: no es pago
verificado.

**Fórmula** · La suma de `monto` de los resultados `venta` de los closers en la ventana, con la misma distinción
que Ventas. Con alguna venta sin monto, «—» con «Hay ventas sin monto.»: sumarla como cero publicaría un monto más
chico que el reportado (`ventasSinMonto` de `cierrePorCloser`, por fila). El color es el del prototipo, `var(--exec)`, por una clase de `app/sales.css` y no en línea.

**Estado** · El cálculo, construido el 2026-10-09 (SA-1): `revenue` de `armarSales`, que suma el `montoDeVentas` nuevo de cada fila de `cierrePorCloser`; el dibujo, construido el 2026-10-09 (SA-3). El 2026-10-09, $0 en 30 días.

### S15-09 · La tabla de closers

**Qué es** · Las seis columnas del prototipo, una fila por closer configurado y **sin ranking**: el orden es el
del catálogo.

| columna | dato | fuente |
|---|---|---|
| Closer | el nombre del catálogo de la empresa; debajo, «{N} contactos asignados» | `closersDeLaEmpresa()` |
| Agendadas | las citas de sus contactos en la ventana, por el eje del CRM | `lib/negocio/cierrePorCloser.ts:231` |
| Asistieron | sus citas con `asistio` presente; sin ninguna marcada, «—» | igual |
| Ventas | sus ventas registradas | `lib/negocio/cierrePorCloser.ts:348` |
| Cierre | ventas sobre intentos, con el piso **por fila** | `lib/negocio/cierrePorCloser.ts:369` |
| Revenue | el monto reportado de sus ventas | `montoDeVentas`, nuevo en SA-1 |

**Los dos ejes, dichos** · Agendadas y Asistieron cuentan citas del CRM; Ventas, Cierre y Revenue cuentan lo que
la persona registró. La nota de la tabla, que escribe el servidor, lo dice.

**Sin datos de personas en este documento ni en las pruebas** · Las filas muestran los nombres del catálogo de la
empresa, como la pantalla de hoy. Acá se habla de «closer 1, 2 y 3».

**Estado** · Las filas, construidas el 2026-10-09 (SA-1): `closers.filas` de `armarSales`, cada columna con su motivo; el dibujo, construido el 2026-10-09 (SA-3).

### S15-10 · El encabezado de la tarjeta de motivos

**Qué es** · «Motivos de no venta», con el `hint` «{N} sin venta»: los resultados de los closers en la ventana
cuya salida no es una venta.

**Estado** · El conteo, construido el 2026-10-09 (SA-1): `motivos.sinVenta` de `armarSales`; el dibujo, construido el 2026-10-09 (SA-3).

### S15-11 · Los motivos de no venta

**Qué es** · Una fila por motivo del catálogo de «No le interesa» —Precio · No es el momento · Competencia · No
califica · Otro (`lib/negocio/salidas.ts:159-167`)— con su conteo y una barra con su porción.

**Fórmula** · Resultados `no_interesa` de los closers en la ventana, agrupados por `detalle`. Un `detalle` que no
está en el catálogo cuenta en «Fuera del catálogo», que es su propia fila y no se reparte. La porción es sobre el
total de motivos, calculada en el servidor. Los motivos en cero no llevan fila. Sin ninguno, la tarjeta dice «Sin
motivos registrados.».

**Qué no es** · No son las objeciones que el modelo clasifica en las llamadas analizadas: son de una llamada, no de
una pérdida, y piden otra capacidad. Tampoco los campos del CRM: `docs/sales/05-LOS-MOTIVOS-DE-NO-VENTA.md` mide
que no los hay.

**Estado** · El cálculo, construido el 2026-10-09 (SA-1): `lib/negocio/motivosDeNoVenta.ts`; el dibujo, construido el 2026-10-09 (SA-3). Hoy: 1 en toda la historia, ninguno en 30 días.

### S15-12 · La cadena comercial, abajo

**Qué es** · Lo que la pantalla de hoy mide y el prototipo no tenía, en una tarjeta más con el estilo del
prototipo (`card`, `card-head`, `rows`, `row-i`):

- **la cadena de cierre**: los cinco eslabones, del contacto a la venta (`lib/negocio/cadenaDeCierre.ts:66`);
- **la cancelación**: canceladas sobre citas ocurridas (`lib/negocio/indicadoresDeCitas.ts:341`);
- **el ciclo hasta la cita**: la mediana y el p90 del alta a la primera cita (`lib/negocio/cicloHastaLaCita.ts:97`);
- **el dinero del mes**: cobrado, ventas y acuerdos del mes calendario, con el nombre del mes
  (`lib/negocio/dineroDelMes.ts:101`);
- **la cobertura**: cuántos contactos tienen alta y cuántas citas caen en una fila de closer.

Cada sección con su aviso del servidor.

**Estado** · Los cálculos, construidos el 2026-09-21; la tarjeta, el 2026-10-09 (SA-3): «La cadena comercial», con
cinco secciones —la cadena, la cancelación, el ciclo, el dinero del mes y la cobertura—.

### S15-13 · El servidor calcula; el navegador dibuja

**Qué es** · Una sola lectura, `lecturaDeSales`, compone los módulos y entrega todo hecho y **de 0 a 1**: la
cancelación de `tasaDeCancelacion` viaja de 0 a 100 (`lib/negocio/indicadoresDeCitas.ts:449`) y se convierte en la
lectura, no en la función, que la comparten Conversation y Closer. El navegador multiplica por 100 en un solo
lugar, y deja de calcular proporciones y anchos de barra (la pantalla anterior las calculaba:
`components/sales/PanelDeSales.jsx:249@a39a732`).

**La respuesta crece, no cambia** · Siguen `periodo`, `ventanas`, `dinero`, `cancelacion`, `cadena`, `ciclo` y
`closers`, este último con el monto reportado de cada fila (`montoDeVentas`, y `ventasSinMonto`). Se agrega
`pantalla`, lo que el front arma: `cifras` (las cuatro de la fila), `closers` (las filas de la tabla, cada columna
con su motivo), `motivos` y `comercial` (las coberturas, la cancelación de 0 a 1 y el ciclo). Los eslabones de la
cadena, el dinero del mes y el texto de cada ventana, la tarjeta de abajo los lee de sus bloques de siempre, que ya
viajan hechos. `huecos` salió de la respuesta con el front, en SA-3; el módulo
`lib/negocio/huecosDeSales.ts` queda, porque Leads Portal comparte tres de sus huecos.

**Estado** · Construido el 2026-10-09: la lectura en SA-1 (`lib/negocio/lecturaDeSales.ts`, con `armarSales` pura) y
la ruta en SA-2, que la llama una vez (`app/api/sales/route.ts:95-97`). `huecos` salió en SA-3.

### S15-14 · El cerebro lee lo mismo

**Qué es** · Las herramientas de Sales (`lib/agentes/executive/adaptadores/sales.ts:31`) dicen lo mismo que la
pantalla. Las dos que publican lo que la pantalla ARMA leen la mitad del cierre de la lectura,
`lecturaDelCierre`, que es la que la ruta usa: `cierre_por_closer`, que suma las cuatro `cifras` y el monto de cada
fila, y la nueva `motivos_de_no_venta`. La mitad del cierre lee los closers, la cancelación, la tabla y los motivos,
sin la cadena, el ciclo ni el dinero, que esas dos no publican. Las demás —el dinero del mes, la cadena, el ciclo y
la cancelación— llaman a la misma función con los mismos argumentos que la lectura. Lo que el cerebro dice de una cifra es lo que la pantalla dibuja.

**Estado** · Construido el 2026-10-09 (SA-2). Lo prueban `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts`
en las cuatro ventanas y `pruebas/base/213-las-herramientas-del-cerebro.test.ts` con sus claves.

### S15-15 · Sin datos personales

**Qué es** · La pantalla no dibuja nada de un contacto: ni nombres de prospectos, ni el texto libre de un
resultado. Del `detalle` sólo se usa su motivo cuando casa con el catálogo; lo demás se cuenta, no se muestra. No
vuelven los `data-leads`.

**Estado** · El servidor, construido el 2026-10-09: el texto libre de un motivo no viaja en la respuesta (lo prueba
`pruebas/base/166-la-ruta-de-sales.test.ts`); la pantalla no dibuja nada de un contacto, construido el 2026-10-09
(SA-3, `pruebas/codigo/249-la-pantalla-de-sales.test.ts`).

### S15-16 · El teléfono

**Qué es** · A 375 px las cuatro cifras van de a dos, las tablas deslizan a lo ancho como en Acquisition y la
tarjeta de abajo apila sus secciones. Lo nuevo va en `app/sales.css`.

**Estado** · Construido el 2026-10-09 (SA-3) y mirado a 375 px con una pantalla sintética: las cifras de a dos, la
tabla de closers desliza y la página no. Medido otra vez en SA-5, a 1440, 1180, 1125 y 375 px: la página no desliza
a lo ancho en ninguno, y a 375 px la cifra y la porción de cada eslabón van en un renglón.

### S15-17 · Los textos que pasan a ser falsos se corrigen en la misma etapa

- **`MEDIDO_EL`** de los huecos (`lib/negocio/huecosDeSales.ts:53`): la pantalla deja de dibujarlos.
- **Los encabezados** de la vista, del panel y de la ruta.
- **El comentario de `.grid-4`** en `app/inteligencia-estetica.css`, que dice que Sales lo emite.
- **Las cifras vencidas de esta carpeta**, que se anotan al final de cada documento (§ 4).

**Estado** · Hecho del 2026-10-09 (SA-0 a SA-3): el comentario de los huecos dice que la pantalla ya no los
dibuja; los encabezados de la vista, del panel y de la ruta describen el front del prototipo; el de `.grid-4` se fue
con su regla; y las citas a la pantalla anterior quedaron fijadas al commit donde existía.

---

## 4 · Lo que esto contesta de los otros documentos

| pregunta | respuesta |
|---|---|
| `S1-P01`: por qué 5 de los 7 resultados se guardaron sin cita | los 7 son anteriores a la `049`, que agregó la cita al resultado (`docs/OTROS/estado actual/13-SETTER-Y-CLOSER.md`) |
| `S1-P02`: por qué `asistio` está vacío | nadie la marca en Avanzar; desde el 2026-10-09 el calendario marca 3 «showed», y la pantalla no los toma como asistencia (S15-05, `S15-P04`) |
| `S5-P01`: si el CRM guarda motivos en otro lado | no se usan: los motivos salen de Avanzar (S15-11) |
| `S13-P01`: las dos maquetas | sin objeto desde que la maqueta de Executive se retiró, el 2026-10-01 |
| S10, la lista de borrado | vuelven los cuatro bloques con datos; siguen fuera «Plan de acción», «Personalizado», `mes` y los nombres literales |

---

## 5 · Cómo se construye

| etapa | qué | estado |
|---|---|---|
| SA-0 | Este documento, las correcciones al final de los otros, `docs/OTROS/futuro/lo-que-sales-no-mide.md` y la medición del 2026-10-09 | **hecho el 2026-10-09**, revisado por el usuario |
| SA-1 | El servidor: `motivosDeNoVenta`, el monto por closer, las cuatro cifras y `lecturaDeSales`, con sus pruebas | **hecho el 2026-10-09**: `pruebas/codigo/248-lectura-de-sales.test.ts` y `pruebas/base/248-lectura-de-sales.test.ts`, 18 mutaciones muertas |
| SA-2 | La ruta y el cerebro sobre la lectura única | **hecho el 2026-10-09**: `pantalla` en la respuesta, `motivos_de_no_venta` en el cerebro, 11 mutaciones muertas |
| SA-3 | El front sobre el marcado del prototipo, `app/sales.css` y la prueba 249 | **hecho el 2026-10-09**: 24 mutaciones muertas; mirado a 1440 y 375 px |
| SA-4 | La revisión adversarial, las mutaciones y la suite entera | **hecho el 2026-10-09**: cuatro lentes; ver el anexo al final |
| SA-5 | La comparación contra el prototipo, los anchos, la subida y la foto `docs/OTROS/estado actual/05-SALES.md` | **hecho el 2026-10-09**, salvo la revisión del usuario en producción: la letra (tamaño, peso y espaciado), los rellenos, los radios y los espacios, medidos en los dos, coinciden; la familia de la letra es la de la marca, Geist, como en Conversion, y sube cada renglón alrededor de 1 px; las cifras son más altas por la frase de debajo (S15-02); las seis columnas guardan la proporción del prototipo en todos los anchos, y a igual ventana son más anchas porque el armazón de la aplicación deja más lugar al contenido —el prototipo a 1440 px mide lo mismo que la pantalla a 1180—; la foto, reescrita |

---

## 6 · Preguntas abiertas

Cada una tiene una respuesta tomada por defecto, que es la que se construye si nadie dice otra cosa.

| id | pregunta | lo que se toma |
|---|---|---|
| `S15-P01` | ¿Las ventanas siguen rodantes, o pasan a días cerrados como Acquisition y Conversion? | rodantes (S15-04) |
| `S15-P02` | ¿Flechas contra la ventana anterior? | ninguna, como el prototipo |
| `S15-P03` | ¿El revenue baja a la tabla de closers? | sí, el monto reportado de cada uno (S15-09) |
| `S15-P04` | ¿Asistencias toma el «showed» del calendario? | no: sólo `asistio` (S15-05) |
| `S15-P05` | ¿Sales tiene, más adelante, un detector con su plan? | queda en `docs/OTROS/futuro/lo-que-sales-no-mide.md` |

---

## Anexo · La revisión de SA-4 (2026-10-09)

Cuatro lentes independientes leyeron lo construido en SA-0 a SA-3 —el servidor, el front, los documentos y las
pruebas— y cada hallazgo se comprobó contra el código antes de corregirlo. Lo que cambió:

- **Tres motivos nuevos para un «—»** (S15-02): sin closers configurados las cifras de lo registrado dicen «Sin
  closers configurados.» y no «Nadie registró»; sin citas en la ventana, la asistencia dice «Sin citas en esta
  ventana.»; y una venta sin monto deja el revenue en «—» con «Hay ventas sin monto.» en vez de sumarla como cero
  (`ventasSinMonto`, nuevo en cada fila de `cierrePorCloser`).
- **El revenue se suma en centavos**: la suma de las filas en JavaScript dejaba colas de coma flotante en lo que
  lee el cerebro.
- **El cerebro lee la mitad del cierre** (S15-14): `cierre_por_closer` y `motivos_de_no_venta` corrían la lectura
  entera, la cadena, el ciclo y el dinero incluidos, que no publican.
- **El front**: la cancelación con su decimal, como la publica `tasaDeCancelacion` y la dibuja Conversation; la
  nota de cada closer, a la vista y no sólo en un `title`; los roles de tabla, fila y celda; la línea entre las
  secciones de la tarjeta de abajo venga lo que venga antes; el «—» del revenue sin el color de un monto; y en el
  teléfono, la cifra y la porción de cada eslabón sin partirse. El color de las barras es un desvío del prototipo, y
  quedó declarado.
- **Las pruebas**: el revenue de la ventana contra el del mes, `venta_chica` y `acuerdo_sin_pago` con monto, una
  fila con intentos y sin ventas, cada motivo con SU frase, el formato de cada cifra y de cada columna, y ningún
  orden ni recorte en todo el panel. La asistencia de la base 248 mira una cita marcada de verdad.
- **Los textos**: la ventana de los motivos y «{N} sin venta» comparten ventana pero no cuentan lo mismo; «Pidió
  tiempo» sí existe, en `nurture`; tres citas fijadas al commit equivocado; y los ceros de este documento llevan su
  fecha, porque el único resultado de 30 días estaba en el borde de la ventana.

Lo que se revisó y se sostuvo: las ventanas de cada cifra, el `in ()` vacío, que `venta_chica` no cuente, la escala
de la cancelación, el piso, el closer sin vínculo, que el texto libre no viaje, las guardas de carga y que sacar
`#v-sales` de la hoja de Inteligencia no movió a Creative ni a Conversation.

La 215 compara al cerebro con la pantalla, que leen la misma lectura: lo que protege es que el período y la zona
lleguen igual a las dos, no que la cifra sea correcta. La corrección la miran la 248 de código y la de base.
