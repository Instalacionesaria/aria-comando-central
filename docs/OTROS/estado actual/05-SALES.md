# Sales Intelligence
> Corte: **2026-10-09**, con el código de `51b5d25`. Las cifras de producción son de dos fechas y cada una lo
> dice: las del **2026-10-09**, medidas para `docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` (§ 2) con
> `scripts/supabase.mjs leer` (sólo lectura, sólo agregados); y las del **2026-09-28**, de la foto anterior, que no
> se re-midieron. Para este corte no se leyó producción. Las ventanas son rodantes: lo que depende de la hora vale
> para el día de su medición. Cada afirmación lleva su `archivo:línea`. Para ubicar lo nombrado, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior se lee con
> `git show 51b5d25:"docs/OTROS/estado actual/05-SALES.md"`, y la del corte del 2026-09-28 con
> `git show 861b5f0:"docs/OTROS/estado actual/05-SALES.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-09.** La pestaña —«Closing» en el menú— vuelve al
marcado de `aios-command-center_1.html:2931-2995`: las cuatro cifras, la tabla de closers y los motivos de no venta,
y debajo una tarjeta más con lo que la pantalla anterior medía. Todo sale de una sola lectura del servidor,
`lecturaDeSales`, y cada «—» dice por qué. El titular no cambió: **nadie registra**. `negocio.resultados` sigue con
**7 filas, ninguna venta y ningún monto**, y la última es del 2026-09-09 (medido el 2026-10-09): un mes sin un solo
resultado. La asistencia está marcada en **0 de 363** citas.

> **Desde el corte del 2026-09-28**
>
> - **2026-10-01 · `4e9a242`** — E7 de la nueva estructura: la maqueta del Executive se va, y con ella las 11
>   ventas y el 31 % de cierre que dibujaba en nombre de Sales.
> - **2026-10-02 · `624a941`** — E11: la cabecera del departamento; con ella a la vista, `app/departamentos.css`
>   oculta el título y la bajada de las pantallas del prototipo.
> - **2026-10-04 a 10-05 · `ce8ff6e`, `13723a0`, `5f15c01`** — AG5 a AG7 de los agentes: el cerebro y sus seis
>   herramientas de Sales.
> - **2026-10-07 · `2f12fad`** — el comentario de la cabecera en Sales: las citas sin registrar, en el Closer y en
>   Llamadas de venta.
> - **2026-10-09 · `4d2ae65`** — SA-0: el usuario decide volver al front del prototipo con los datos reales, y
>   nacen `docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` (requisitos `S15-01` a `S15-17`) y
>   `docs/OTROS/futuro/lo-que-sales-no-mide.md`.
> - **2026-10-09 · `48ee16d`** — SA-1: `lib/negocio/motivosDeNoVenta.ts`, el monto por closer y
>   `lib/negocio/lecturaDeSales.ts`.
> - **2026-10-09 · `a39a732`** — SA-2: la ruta y el cerebro sobre la lectura única; herramienta nueva
>   `motivos_de_no_venta`.
> - **2026-10-09 · `2ad23f2`** — SA-3: la pantalla nueva y `app/sales.css`; `#v-sales` sale de
>   `app/inteligencia-estetica.css` y la sección deja la estética de operación.
> - **2026-10-09 · `51b5d25`** — SA-4: la revisión adversarial; tres motivos nuevos para un «—» y la mitad del
>   cierre para el cerebro.

---

## 1 · Qué pide el documento

El documento funcional no vive en el repositorio (`docs/sales/00-MAPA.md:47-48`) y nunca especifica
Sales Intelligence: el §17 («Secciones pendientes», línea 1110) lo lista como área que tiene visión
general y requiere especificación. Las siete menciones, enteras, están en
`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:9-22`. Lo que importa para esta foto:

- **§4 Organigrama** (líneas 163-192): Sales cuelga de Executive sin submódulos; en Team Execution
  hay un «Responsable de Ventas» (línea 190) que el documento no vuelve a nombrar
  (`docs/sales/12-QUIEN-VE-QUE.md:34`). El §3 le asigna en la capa de datos «ventas y revenue
  reportado».
- **§2.3** (línea 90), la única competencia que se le atribuye: «puede recomendar coaching para un
  closer». Lo que afecte presupuesto o a varios departamentos sube a Executive.
- **§5.2** (líneas 223-238): la traza termina en `appointment_id → sales_call_id → sale_report_id`,
  los dos eslabones de Sales.
- **§5.4** (líneas 267-288), lo único parecido a una especificación: el closer registra «¿El
  cliente compró?» y «Monto vendido», y la advertencia de la línea 288: son «ventas reportadas por el
  closer y no necesariamente pagos verificados» (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:125-128`).
- **§5.3** (líneas 260-263): el perfil del lead lleva «Asistencia», «Resultado de venta» y «Monto
  reportado por el closer». **§10.7** (línea 759) pide «Show rate por closer».
- **§16.1** (línea 1072) declara «Auditoría de llamadas de venta» como capacidad EXISTENTE y
  **§16.2** (línea 1101) pone entre sus pruebas sugeridas «Conectar contacto, cita, asistencia y venta
  reportada» (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:152-160`).

El deslinde que la carpeta de requisitos saca de todo esto —Sales genera el hecho, Business lo
interpreta, y la tasa de cierre es de Business— está en `docs/sales/08-LO-QUE-ENTREGA-Y-RECIBE.md:8`
y `:79`. Lo que pidió el usuario el 2026-10-09 —la forma del prototipo, con el dato— está en
`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 1, con sus cuatro decisiones y cinco respuestas por
omisión (§ 6 del mismo documento).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:333-338`: clave `sales`, nombre «Closing», capacidad `tablero.ver`.
La vista se registra en `components/CommandCenter.jsx:45` y se dibujan sólo las secciones visibles de la sesión
(`components/CommandCenter.jsx:65-72`). El panel pide `/api/sales` al montarse (`components/sales/PanelDeSales.jsx:75`)
y lo refresca cada 60 s sólo con la pestaña a la vista (`components/sales/PanelDeSales.jsx:100`,
`lib/cadencia.ts:91`). `components/views/SalesView.jsx` es el envoltorio del prototipo, `view-scroll cre-scroll`,
sin `estetica-op` (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, S15-01).

**La ruta.** `app/api/sales/route.ts:75-112`, un solo `GET`: pide `tablero.ver` al portero (`:79`), **rechaza** con
400 un período que no está en la lista en vez de corregirlo (`:88-89`), y llama una vez a `lecturaDeSales` dentro de
la organización (`:96`). La respuesta lleva los bloques de siempre —`ventanas`, `dinero`, `cancelacion`, `cadena`,
`ciclo` y `closers`— y `pantalla`, lo que el front arma (`:110`). Los huecos de `lib/negocio/huecosDeSales.ts` ya no
viajan: cada «—» dice su motivo, y lo que no se mide está en `docs/OTROS/futuro/lo-que-sales-no-mide.md`.

**La lectura.** `lib/negocio/lecturaDeSales.ts` tiene dos mitades puras —`armarCierre`
(`lib/negocio/lecturaDeSales.ts:160`) y `armarSales` (`:209`)— y dos que leen: `lecturaDelCierre` (`:256`), con los
closers, la cancelación, la tabla y los motivos, y `lecturaDeSales` (`:284`), que le suma el dinero, la cadena y el
ciclo. Los closers se leen una vez. Todo lo que va en `pantalla` viaja de 0 a 1; la cancelación de siempre sigue de
0 a 100, porque la comparten Conversation, el Closer y el cerebro.

**Los módulos:**

| módulo | qué calcula | dueño |
|---|---|---|
| `lib/negocio/lecturaDeSales.ts` | las cuatro cifras, la tabla, los motivos y la tarjeta de abajo, con el motivo de cada «—» | Sales |
| `lib/negocio/motivosDeNoVenta.ts` | los «No le interesa» de los closers por motivo del catálogo; lo que no casa, aparte | Sales |
| `lib/negocio/cierrePorCloser.ts` | una fila por closer configurado, dos ejes, con el monto reportado y las ventas sin monto | Sales |
| `lib/negocio/dineroDelMes.ts` | cobrado, ventas y acuerdos del mes calendario | compartido con el Inicio del Closer |
| `lib/negocio/indicadoresDeCitas.ts` | la tasa de cancelación (`tasaDeCancelacion`) | Conversation; Sales es su segundo consumidor |
| `lib/negocio/cadenaDeCierre.ts` | cinco eslabones con el CONTACTO como unidad | Sales |
| `lib/negocio/cicloHastaLaCita.ts` | p50 y p90 del alta a la primera cita; el promedio no viaja | Sales |
| `lib/negocio/alcanceDelCloser.ts` | `closersDeLaEmpresa()`, las filas de la tabla | Closer |
| `lib/negocio/ventanasDeSales.ts`, `vistaDeSales.ts` | los textos de cada ventana; el lector del navegador | Sales |

**Lo que dibuja**, en el orden de `components/sales/PanelDeSales.jsx`, y lo que daba el 2026-10-09 a 30 días —el
período con que abre (`lib/negocio/periodo.ts:109`)—, deducido de la medición de ese día (no leído de la pantalla):

| bloque | dónde | el 2026-10-09, a 30 días |
|---|---|---|
| El encabezado: «Sales», «Cierre, closers y motivos de pérdida» y el segmentado de cuatro períodos | `components/sales/PanelDeSales.jsx:46`, `:133` | con la cabecera del departamento a la vista, sólo el segmentado |
| Asistencias | `components/sales/PanelDeSales.jsx:177` | «—», «Nadie marca la asistencia.» (0 de 363 citas marcadas) |
| Tasa de cierre | igual | «—», «Pocos intentos para una tasa.» (1 intento) |
| Ventas | igual | **0**, cero medido: hubo 1 resultado y ninguna venta |
| Revenue reportado | igual | **$0**, «reportado por el closer» |
| Closers: seis columnas, una fila por closer configurado | `components/sales/PanelDeSales.jsx:221` | 3 filas; la nota de cada una, debajo de la tabla |
| Motivos de no venta, con «{N} sin venta» | `components/sales/PanelDeSales.jsx:265` | «1 sin venta» y «Sin motivos registrados.»: el único «No le interesa» es de agosto |
| La cadena comercial: la cadena, la cancelación, el ciclo, el dinero del mes y la cobertura | `components/sales/PanelDeSales.jsx:305` | no re-medido; el 2026-09-28 la cancelación era 34,9 % y la cadena terminaba en 0 ventas |

**El borde de la ventana.** Ese único resultado de 30 días es del 2026-09-09: la ventana lo alcanzaba por un día.
Desde el 2026-10-10, sin un registro nuevo, Ventas, Revenue y Tasa de cierre dicen «—» con «Nadie registró en esta
ventana.» también a 30 días, y en la tabla, cada fila sin resultados. No es una rotura: es el cero medido que pasa a
ser «no hay medición».

**La tabla por closer.** Tres filas, una por closer configurado y vinculado (3 de 3, medido el 2026-10-09), en orden
de designación y nunca por tasa (`lib/negocio/cierrePorCloser.ts:235-244`). Agendadas y Asistieron cuentan citas del
CRM; Ventas, Cierre y Revenue, lo que cada persona registró (`lib/negocio/cierrePorCloser.ts:516-520`). La subfila
dice «{N} contactos asignados» —la asignación por ICP del prototipo no existe—. **La tabla muestra el nombre real de
cada closer**, a propósito: es una evaluación de desempeño y la trata como tal (`lib/negocio/cierrePorCloser.ts:11-13`).
Los plantones del calendario, que la tabla anterior publicaba como columna, ya no se dibujan.

**Ventanas y pisos.** Cuatro ventanas en una pantalla: el MES calendario en la zona de la empresa para el dinero
(`lib/negocio/dineroDelMes.ts:105`); la COHORTE de contactos dados de alta en N días para la cadena y el ciclo
(`lib/negocio/cadenaDeCierre.ts:169`); las CITAS ocurridas en N días para la asistencia, la cancelación y las
columnas del CRM de la tabla (`lib/negocio/cierrePorCloser.ts:258-259`); y lo REGISTRADO en N días —los resultados
por `creado_el`— para Ventas, Revenue, la tasa de cierre, las columnas de lo registrado y los motivos. Todas
rodantes. Las tres primeras viajan descritas (`lib/negocio/ventanasDeSales.ts:39-52`); la cuarta no tiene texto
propio, y la nota de la tabla dice que sus dos ejes cuentan distinto. El piso es `PISO_DE_UNA_TASA = 10`
(`lib/negocio/indicadoresDeCitas.ts:329`) sobre el denominador: la tasa de cierre de arriba y la de cada fila, y el
ciclo. **La cancelación sigue sin piso**: su tasa es `null` sólo con cero citas
(`lib/negocio/indicadoresDeCitas.ts:449`), y la tarjeta de abajo la dibuja con su decimal sobre cualquier
denominador. Ver § 7.

**El cerebro.** Siete herramientas de Sales (`lib/agentes/executive/adaptadores/sales.ts`). `cierre_por_closer` —que
suma las cuatro cifras con su motivo— y `motivos_de_no_venta` leen la mitad del cierre de la misma lectura; el dinero
del mes, la cadena, el ciclo y la cancelación llaman a la misma función con los mismos argumentos
(`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, S15-14); y `economia_del_negocio` cruza las ventas del mes
con la inversión de Acquisition, para quien ve las dos secciones. Lo prueba `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts` en las cuatro ventanas.

**Quién la ve.** 13 de los 15 usuarios activos tenían `tablero.ver` y la sección concedida el 2026-09-28; no
re-medido.

---

## 3 · Lo que era maqueta y qué la reemplazó

**La maqueta de Sales se fue dos veces, y la segunda volvió su forma.** El 2026-09-21 (`1c875ac`) se borró entera:
dibujaba 23 valores escritos a mano que cerraban entre sí, uno al lado del nombre de una persona real
(`components/views/SalesView.jsx:8-10@a39a732`). La reemplazó un tablero propio con la estética de operación. El
2026-10-09 volvió la forma del prototipo y se quedó el dato:

| lo que dibujaba la maqueta | qué hay hoy |
|---|---|
| Asistencias 74, Tasa de cierre 24 %, Ventas 18, Revenue reportado $55,200 | las cuatro, con los rótulos del prototipo; cada «—» con su motivo y cada cero, medido |
| Tabla de dos filas: un closer real con su nombre, «ICP alto asignado» y 44/31/10/32 %/$31,000; y «Asesor comercial», 63/43/8/19 %/$24,200 | una fila por closer configurado, con las seis columnas del prototipo y lo registrado de cada uno; «{N} contactos asignados» |
| «Motivos de no venta»: «56 llamadas sin cierre», Precio 21, No es quien decide 13, Sin necesidad clara 12, Pidió tiempo 10 | los del catálogo de «No le interesa», con «{N} sin venta»; lo que no casa, en «Fuera del catálogo» |
| Selector «Hoy / 7 días / 30 días», cuyo tercer botón mandaba `data-p="mes"` | el segmentado de las cuatro claves de `lib/negocio/periodo.ts:83-96`, que enciende el botón que el servidor contestó |
| Píldora «Personalizado» y botón «Plan de acción» (`slPlanBtn`), sin oyente | nada: Sales no tiene detector, y un rango libre no lo reproduce ninguna otra pantalla (S15-03) |

Los desvíos de rótulo y de color están declarados en S15-02 del doc 15: «{N} contactos asignados», «{N} sin venta»,
los motivos del catálogo, «Agendadas» como citas del CRM y el color de las barras por su origen.

**El nombre de la maqueta sigue en el repositorio**, que es público: en el prototipo `aios-command-center_1.html`,
`lib/ghl/calendarios.ts`, `components/negocio/Fila.jsx`, `components/views/CloserView.jsx`,
`pruebas/codigo/91-closer-y-setter.test.ts` y cinco documentos de `docs/` (`git grep` del 2026-10-09). Salió de
`components/views/SalesView.jsx` el 2026-10-09; las versiones viejas del archivo lo conservan en la historia.

**La contradicción con Executive ya no existe**: su maqueta se retiró el 2026-10-01 (`4e9a242`), y con ella las 11
ventas, el 31 % de cierre y las cuatro tarjetas que hablaban por Sales (la foto anterior las listaba en su § 3.1).

---

## 4 · Datos que ya tenemos

Medido el 2026-10-09 salvo donde se dice otra fecha, con `scripts/supabase.mjs leer`, sobre la organización que tiene
datos de negocio (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2).

**`negocio.resultados`: 7 filas, las mismas desde el 2026-09-09.** 1 «No le interesa» de agosto, con el motivo
«Otro»; 2 «No-show» y 4 «Seguimiento» de septiembre. **Ninguna venta, ningún monto y ninguna con su cita.**

**El esquema de la venta existe y mapea casi 1:1 contra el §5.4**
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:65-78`): `salida`, `monto numeric(12,2)`, `forma_pago`, `registrado_por`,
`creado_el`, y `cita_id` desde la `049`. Faltan la moneda y un `opportunity_id` que se ingiera. Desde SA-4, una venta
con el monto nulo no suma como cero: la cuenta `ventasSinMonto`, y deja el revenue en «—».

**Los catálogos de desenlace.** `lib/negocio/salidas.ts:82` define las seis salidas del closer; las dos que piden
monto son `venta` (`lib/negocio/salidas.ts:84`) y `acuerdo_sin_pago` (`:96`). El motivo de `no_interesa` es Precio ·
No es el momento · Competencia · No califica · Otro (`lib/negocio/salidas.ts:165`), y es lo que agrupa
`motivosDeNoVenta`; «Pidió tiempo» es de `nurture` (`lib/negocio/salidas.ts:198`).

**La maquinaria de dinero está escrita, probada y consumida por dos pantallas.** `lib/negocio/dineroDelMes.ts:132-153`
suma `monto` sólo donde `salida = 'venta'` y cuenta los acuerdos aparte; distingue el `0` medido del `—`, y separa
«no hay closers» de «nadie registró» (`lib/negocio/dineroDelMes.ts:164-173`).

**Las citas: 363**, del 2026-08-12 al 2026-10-13. Ninguna con la asistencia marcada. 19 son plantones del calendario,
176 están canceladas, 101 congeladas, y **3 dicen «showed» por primera vez**: el calendario empezó a marcar
presentes, y nadie lo hizo en Avanzar. En los últimos 30 días, de 111 ya ocurridas: 56 canceladas, 38 confirmadas, 14
plantones y 2 «showed».

**Los contactos: 620**, 24 sin alta. Las altas por semana desde el 2026-08-31: 175, 89, 5, 5, 11 y 6.

**Los closers: 3**, los tres con su usuario del CRM; dos registraron alguna vez. La comisión, al 10 % para los tres y
sin meta mensual (medido el 2026-09-28).

**Las llamadas de venta.** Los Analizadores guardaban 115 llamadas el 2026-09-28; de las 38 HT analizadas,
`NO_CERRADA` 36, `INDETERMINADO` 2 y `CERRADA` 0 (`lib/analizadores/nucleo/ht.ts:133-138`). Es una lectura de un
modelo, no un registro del closer; no re-medido.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Lo que la pantalla no mide, y qué haría falta para medirlo, está en `docs/OTROS/futuro/lo-que-sales-no-mide.md`. En
resumen, con la foto del 2026-09-28 donde no se re-midió:

**1 · La venta misma.** 0 filas `venta` o `acuerdo_sin_pago` en `negocio.resultados`, 0 montos (2026-10-09). Los
campos del CRM que podrían traerla están vacíos en todos los contactos, las oportunidades no se ingieren, y el
2026-09-28 un contacto llevaba en el CRM la etiqueta `venta_ganada` sin ningún resultado en la base: alguien la marcó
en el CRM y no en Avanzar. «Ticket promedio mensual por cliente» tiene valor en cientos de contactos y es lo que el
prospecto dice que factura, no lo que le vendimos (`docs/sales/01-LA-VENTA-NO-EXISTE.md:202-229`).

**2 · La asistencia.** `citas.asistio` nulo en las 363 y `resultados.cita_id` nulo en las 7 (2026-10-09). La columna
existe desde la `049` y la escribe `lib/negocio/avanzar.ts:248`. El calendario marca 3 «showed» y 19 plantones, pero
un conteo sin denominador no es asistencia (S15-P04).

**3 · La llamada de venta.** `negocio.llamadas` sin filas, y las llamadas analizadas no están enganchadas a ningún
contacto, cita ni resultado (`db/migraciones/056_tablas_del_analizador.sql:34-44`).

**4 · Los eslabones del §5.2.** `sale_report_id` es `resultados.id` y existe sin ninguna venta; `sales_call_id` no
tiene tabla propia; el tramo `appointment_id → sale_report_id` se abrió con `resultados.cita_id` y ninguna fila lo
recorre.

**5 · La asignación de contactos por ICP.** No existe en ninguna tabla, columna ni campo del CRM, y los datos del
2026-09-28 no mostraban un reparto de hecho.

**6 · La moneda y la meta.** No hay columna de moneda en `negocio.resultados`, y `meta_mensual` es nulo en las tres
comisiones.

**7 · El cobro verificado.** Ninguna integración de pagos. El revenue es siempre «reportado por el closer».

**8 · Los motivos de pérdida, con dato.** La tarjeta existe desde el 2026-10-09 y agrupa lo que el closer registra;
hay 1 fila en toda la historia. Los campos del CRM con motivos están en tres contactos o menos
(`docs/sales/05-LOS-MOTIVOS-DE-NO-VENTA.md:118`).

**9 · El plan y las señales.** Sales no tiene detector (`lib/agentes/senales/tipos.ts:6-7`); el «Plan de acción» del
prototipo no se dibuja hasta que lo tenga.

---

## 6 · Reglas propias de este departamento

**1 · Una venta del closer y una venta del setter NO se suman. Nunca.** Escrita con su motivo en
`lib/negocio/etapas.ts:86-94`. La cumplen el código de Sales por clave exacta (`lib/negocio/cierrePorCloser.ts:346-348`)
y el predicado compartido (`lib/negocio/ventasDelContacto.ts:27`); el monto de cada fila suma sólo `venta`, y la base
248 lo prueba con `venta_chica` y `acuerdo_sin_pago` con monto.

**2 · Una venta y un acuerdo sin pago son dos hechos distintos, y solo uno es dinero.** `lib/negocio/dineroDelMes.ts:78-84`
y `lib/negocio/etapas.ts:78`.

**3 · Es venta REPORTADA, no pago verificado.** El §5.4 lo exige por escrito (línea 288 del documento). El revenue
lleva «reportado por el closer» debajo de la cifra (`components/sales/PanelDeSales.jsx:177`), y el cobrado del mes
también. Ninguna «CERRADA» del analizador puede reemplazarlo: es la lectura de un modelo.

**4 · Un «—» dice por qué, y un cero es un cero medido.** Seis motivos cerrados (`lib/negocio/lecturaDeSales.ts:53`),
cada uno con su frase de la lista de S15-02 (`components/sales/comun.jsx:28`): sin closers, sin citas, sin asistencia
marcada, sin registros en la ventana, bajo el piso y una venta sin monto. Es la regla de los dos ceros de
`lib/negocio/comision.ts:14-28` llevada a la pantalla: un `?? 0` convertiría «nadie registró» en «no se vendió».

**5 · El piso de 10, y es del DENOMINADOR.** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:329`). El
closer que registra sus intentos no es una muestra al azar (`lib/negocio/indicadoresDeCitas.ts:325-327`).

**6 · El denominador de una tasa de asistencia lleva `asistio is not null`.** `lib/negocio/indicadoresDeCitas.ts:385-394`,
y la tabla lo repite por fila (`lib/negocio/cierrePorCloser.ts:277-281`). Asistencias es el conteo de los que se
presentaron entre las citas con la asistencia respondida; sin ninguna respondida, «—».

**7 · Sales NO deduce la asistencia de la salida.** `lib/negocio/salidas.ts:185-197`: tiene que leer `citas.asistio`.

**8 · Un resultado es un INTENTO del closer, no una cita, y lo registrado es de OTRO EJE que lo asignado.**
`resultados.registrado_por` contra `contactos.crm_asignado_a`, que en esta base dan vuelta la tabla si se cruzan
(`lib/negocio/cierrePorCloser.ts:37-50`).

**9 · El filtro de citas «alcanzables y no descartadas» es del sistema.** `lib/negocio/citasAlcanzables.ts:54-56` y
`:79-85`.

**10 · Los identificadores del CRM se resuelven por NOMBRE, nunca a mano.** `lib/negocio/salidas.ts:73-77`.

**11 · Los motivos se leen de `resultados.detalle`, y su texto libre no viaja.** Sólo el nombre del motivo cuando casa
con el catálogo; lo demás se cuenta en «Fuera del catálogo» (`lib/negocio/motivosDeNoVenta.ts:50`). La base 166
prueba que un texto libre no sale en la respuesta. Las filas viejas conservan su texto
(`lib/negocio/salidas.ts:196-197`), así que el agrupador tolera valores que ya no están en el catálogo.

---

## 7 · Riesgos

**El borde de la ventana rodante.** El 2026-10-10 las cifras de lo registrado pasan de «0» a «—» a 30 días sin que
nadie haga nada (§ 2). Es correcto, y quien lo vea puede leerlo como una rotura. Lo mismo le pasó al dinero del mes el
2026-10-01: desde ese día dice «—» con «Todavía no se registró ningún resultado este mes»
(`lib/negocio/dineroDelMes.ts:164-165`).

**Una tasa con menos de 10 eventos.** La cancelación no aplica el piso (`lib/negocio/indicadoresDeCitas.ts:449`) y la
tarjeta de abajo la dibuja con su decimal sobre cualquier denominador: con «Hoy» o «7 días», pocas citas mueven la
tasa muchos puntos. Las demás tasas de la pantalla sí tienen piso.

**Poner nombres reales al lado de números.** La tabla lo hace a propósito, con números medidos, sin ranking y con la
nota de cada fila a la vista. Lo que sí sería un defecto es una cifra inventada al lado de un nombre, que es lo que
hacía la maqueta.

**Sumar `venta_chica` con `venta`, lo prometido con lo cobrado, o una venta sin monto como cero.** Hoy dan cero
porque no hay ninguna venta, así que el defecto entraría sin síntomas. Las pruebas 248 de código y de base lo cuidan.

**Confundir «nadie registró la asistencia» con «nadie asistió».** Con 0 de 363 marcadas, una cuenta sin
`asistio is not null` daría 0 % y dispararía una crisis que no existe.

**Tomar el «showed» del calendario o el resultado del analizador como dato de Sales.** Los dos están cerca y tientan:
el calendario empezó a marcar presentes y el analizador clasifica llamadas como `CERRADA`. Ninguno es lo que el closer
reportó; sumarlos daría una asistencia o un cierre plausibles con otra definición adentro (S15-P04).

**Dos pantallas, dos respuestas a «¿hubo una venta?».** El Pipeline del Closer clasifica por etiqueta cuando nadie
escribió la etapa (`lib/negocio/etapas.ts:222-261`); Sales, Leads Portal y el dinero del mes leen `negocio.resultados`.
Si la costumbre es marcar la venta en el CRM, el hueco central de este departamento no es de adopción del producto
sino de dónde se anota.

**Lo que se puede construir hoy, y lo que no.** La pantalla del prototipo está construida con todo lo que el sistema
mide. Sigue sin poder llenarse: la tasa de cierre (0 ventas), la asistencia y el show rate (0 de 363), el revenue
(0 montos), los motivos (1 fila), la llamada de venta enganchada a la cita y la asignación por ICP. **El cuello de
botella de Sales sigue sin ser técnico**: la pantalla está, el escritor está (`lib/negocio/avanzar.ts:248`), la
comisión está configurada, y en un mes no se registró un solo resultado en Avanzar.
