# Sales Intelligence
> Corte: **2026-09-28**. Cada afirmación lleva su `archivo:línea` o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido. Las cifras de producción son de
> consultas de sólo lectura con los mismos predicados que el código, no de abrir la pantalla. Las
> ventanas son rodantes: lo que depende de la hora vale para el 2026-09-28 hacia las 20:00 UTC.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

**Construido el 2026-09-21 — la pantalla mide, y lo que mide es que nadie registra.**

La maqueta de 23 números inventados y un nombre real se borró el 2026-09-21 y la reemplazó una
pantalla que calcula en el servidor. Lo que esa pantalla encuentra no cambió desde el corte anterior:
`negocio.resultados` sigue con **7 filas, cero ventas y cero montos**, y la última se registró el
2026-09-09 — diecinueve días sin un solo resultado nuevo (medido el 2026-09-28). La primera señal de
una venta en todo el producto apareció fuera del registro: un contacto lleva en el CRM la etiqueta
`venta_ganada` y no tiene ningún resultado en nuestra base (§ 5). Executive, mientras tanto, sigue
dibujando 11 ventas y un cierre del 31 % en nombre de este departamento.

> **Desde el corte del 2026-09-15** (este archivo se había medido el 2026-09-16 13:54 UTC)
>
> - **La carpeta de requisitos**: `docs/sales/`, quince archivos, prefijo `S` — `8a0368a`, 2026-09-20.
> - **El dinero del mes sale de `inicio.ts`** a `lib/negocio/dineroDelMes.ts`, sin cambio de
>   comportamiento, para que Sales y el Inicio del Closer compartan la función — `68e0e16`, 09-20.
> - **Los predicados de cita en un solo lugar**: `lib/negocio/citasAlcanzables.ts`; el filtro
>   «alcanzable» estaba copiado en nueve módulos — `1164984`, 09-21.
> - **La cadena de cierre** (`cadenaDeCierre.ts`, `d72c4ef`), **el ciclo alta → primera cita**
>   (`cicloHastaLaCita.ts`, `fd273a1`) y **la tabla por closer** (`cierrePorCloser.ts`, `371c0c5`,
>   que corrigió la brecha de «26 puntos» entre closers a 14 sobre todo el pasado), 09-21.
> - **La ruta** `app/api/sales/route.ts` y la bandera `sinOperacionesTodavia` bajada — `c109ebd`.
> - **Se va la maqueta**: `SalesView.jsx` de 231 a 82 líneas (el commit dice 83), entra
>   `components/sales/PanelDeSales.jsx`, y la hoja de Inteligencia pasa a alcanzar `#v-sales`
>   (171 reglas no lo hacían) — `1c875ac`, 09-21. Los documentos al día — `b31755b`, 09-21.
> - Después, fuera de Sales y con efecto acá: `contactos.score` pasa a guardar el «Puntaje | ICP»
>   (`e350a47`, migración `055`, 09-21); los **Analizadores HT** auditan llamadas de venta desde el
>   09-23 (`05534de`, `35665f2`); Leads Portal comparte con la cadena `citaCerrable` y `tieneVenta`
>   (`d97848e`, 09-26) y borra su botón «Plan de acción» (`aed4f27`, 09-26).
> - **Lo que no cambió**: `negocio.resultados` (7 filas, la última del 09-09), `citas.asistio` (nulo
>   en todas), `negocio.llamadas` (0 filas) y las cinco piezas de Executive que hablan por Sales.
> - **Lo que apareció en los datos**: la etiqueta `venta_ganada` en 1 contacto, sin resultado propio.

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
  cliente compró?» y «Monto vendido», con los campos sugeridos `sale_status`, `sale_amount`,
  `sale_currency`, `reported_by_closer_id`, `reported_at`, `opportunity_id` y
  `sale_source = closer_reported`, y la advertencia de la línea 288: son «ventas reportadas por el
  closer y no necesariamente pagos verificados» (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:125-128`).
- **§5.3** (líneas 260-263): el perfil del lead lleva «Asistencia», «Resultado de venta» y «Monto
  reportado por el closer». **§10.7** (línea 759) pide «Show rate por closer».
- **§16.1** (línea 1072) declara «Auditoría de llamadas de venta» como capacidad EXISTENTE y
  **§16.2** (línea 1101) pone entre sus pruebas sugeridas «Conectar contacto, cita, asistencia y venta
  reportada» (`docs/sales/11-LO-QUE-PIDE-EL-DOCUMENTO.md:152-160`).

El deslinde que la carpeta de requisitos saca de todo esto —Sales genera el hecho, Business lo
interpreta, y la tasa de cierre es de Business— está en `docs/sales/08-LO-QUE-ENTREGA-Y-RECIBE.md:8`
y `:79`. El documento no cambió desde el corte anterior. Lo que cambió es que **la competencia del
§2.3 la ejerce hoy, en parte, otra sección**: el analizador HT evalúa al closer en cinco fases
(`docs/OTROS/analizadores/ANALIZADORES.md:11-17`), fuera de Sales y sin enganche con su cadena (§ 5).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:319-325`: clave `sales`, capacidad `tablero.ver`, y el
comentario de las líneas 322-323 fecha la baja de la bandera el 2026-09-21. La vista se registra en
`components/CommandCenter.jsx:44`, y **todas las vistas visibles se montan a la vez**
(`components/CommandCenter.jsx:81-92`): el panel pide `/api/sales` una vez al cargar la página
aunque nadie abra Sales (`components/sales/PanelDeSales.jsx:63-65`); lo que sí está atado a la
visibilidad es el refresco cada 60 s (`components/sales/PanelDeSales.jsx:70-72`,
`lib/cadencia.ts:90`). `components/views/SalesView.jsx` es hoy una cáscara de 82 líneas: el
encabezado (líneas 1-52) enumera lo borrado con la medición que lo desmiente, y la bajada pasó a
«Hasta dónde llega la cadena, y dónde se corta» (`components/views/SalesView.jsx:72`).

**La ruta.** `app/api/sales/route.ts:71-132`, un solo `GET`: pide `tablero.ver` al portero (`:75`),
**rechaza** con 400 un período que no está en la lista en vez de corregirlo (`:84-85`), corre todo en
una transacción por organización (`:87-115`) y lee la lista de closers una sola vez para el dinero y
para la tabla (`:92`). El sujeto del dinero es la empresa o `nadie`, nunca N+1 por closer
(`:100-103`). La respuesta lleva las tres ventanas y los huecos con su fecha (`:117-131`).

**Los módulos**, todos consumidos por esa ruta:

| módulo | qué calcula | dueño |
|---|---|---|
| `lib/negocio/dineroDelMes.ts` | cobrado, ventas y acuerdos del mes calendario | compartido con el Inicio del Closer |
| `lib/negocio/indicadoresDeCitas.ts` | la tasa de cancelación (`tasaDeCancelacion`, línea 321) | Conversation; Sales es su segundo consumidor |
| `lib/negocio/cadenaDeCierre.ts` | cinco eslabones con el CONTACTO como unidad | Sales |
| `lib/negocio/cicloHastaLaCita.ts` | p50 y p90 del alta a la primera cita; el promedio no viaja | Sales |
| `lib/negocio/cierrePorCloser.ts` | una fila por closer configurado, dos ejes, concentración | Sales |
| `lib/negocio/citasAlcanzables.ts` | los predicados de cita que todos comparten | compartido |
| `lib/negocio/ventasDelContacto.ts` | qué es que una persona haya comprado | compartido con Leads Portal |
| `lib/negocio/alcanceDelCloser.ts` | `closersDeLaEmpresa()`, las filas de la tabla (líneas 77-95) | Closer |
| `lib/negocio/ventanasDeSales.ts`, `huecosDeSales.ts`, `vistaDeSales.ts` | textos de ventana, huecos, lector del navegador | Sales |

**Lo que dibuja**, en el orden de `components/sales/PanelDeSales.jsx`, con lo que daría hoy. Las
cifras las reproduje el 2026-09-28 en SQL con los predicados de cada módulo, a 30 días —el período
con que abre la pantalla (`components/sales/PanelDeSales.jsx:42`, `lib/negocio/periodo.ts:109`)— y
con «Completo»; **no las leí de la pantalla**.

| bloque | líneas del panel | a 30 días | con «Completo» |
|---|---|---|---|
| Dinero del mes, **arriba del selector**: el selector no lo gobierna | `:79`, `:190-237` | septiembre: cobrado $0 · 0 ventas · 0 acuerdos | igual (no depende del período) |
| Cobertura: contactos con fecha de alta / citas que caen en una fila | `:246-310` | 570 de 594 · 95 de 106 | 570 de 594 · 127 de 142 |
| La cadena, en contactos (citas al lado) | `:319-349` | 277 → 139 (155) → 46 (56) → 3 → **0** | 570 → 200 (228) → 77 (91) → 4 → **0** |
| Cancelación | `:358-393` | **34,9 %** (37 de 106) | 39,4 % (56 de 142) |
| Del alta a la primera cita | `:402-441` | p50 2,3 d · p90 6,1 d, sobre 139 de 277 | p50 2,9 d · p90 10,4 d, sobre 200 de 570 |
| Por closer (tres filas, en el orden en que salen) | `:454-525` | 22 · 66 · 7 citas; cancelación 23 % · 33 % · bajo el piso | 22 · 97 · 8; 23 % · 39 % · bajo el piso |
| Lo que la pantalla no puede medir | `:537-557` | cinco huecos «medidos el 21 de septiembre» | igual |

Los ceros del dinero son **ceros medidos**: hay 6 resultados de closers en septiembre en la zona de la
organización (`America/Lima`) y ninguno es `venta`, así que `dineroDelMes` publica `0` y no `—`
(`lib/negocio/dineroDelMes.ts:162`). El rótulo del §5.4 va pegado a la cifra, no en un pie:
`components/sales/PanelDeSales.jsx:208-214`, y la cadena lo repite en su aviso
(`lib/negocio/cadenaDeCierre.ts:355-358`).

El aviso de la cadena dice hoy, a 30 días, que **43 de 46 contactos tuvieron una cita que ya ocurrió y
nadie registró qué pasó** (con «Completo», 73 de 77; el 2026-09-21 eran 71 de 75,
`lib/negocio/cadenaDeCierre.ts:6-16`), y que 24 de 594 contactos no tienen fecha de alta y no entran
en ninguna cohorte (`lib/negocio/cadenaDeCierre.ts:343-351`). El rótulo de ese eslabón dice que son
«exactamente las citas que el botón Avanzar ofrece cerrar» (`lib/negocio/cadenaDeCierre.ts:90`), y
no es del todo así: Avanzar sólo ofrece las de los últimos 14 días (`lib/negocio/citasParaCerrar.ts:60`
y `:71`; la ficha la llama sin ese argumento, `app/api/contactos/[id]/route.ts:151`), y la cadena
no pone ventana a la cita. De esos 46 contactos, hoy sólo 8 tienen una cita que Avanzar todavía
ofrece (10 de 56 citas, medido el 2026-09-28). A los otros 38 se les puede registrar un resultado,
pero ya no la asistencia de esa cita.

**La tabla por closer.** Tres filas, una por closer configurado y vinculado (3 de 3 con vínculo al
CRM, medido el 2026-09-28), en orden de designación y nunca por tasa; el de más citas sale segundo y
no último, como dice su comentario (`lib/negocio/cierrePorCloser.ts:227-236`). Las columnas son dos
ejes que no se leen como embudo (`lib/negocio/cierrePorCloser.ts:503-507`): personas y citas por el
asignatario del CRM, «Registró» por quien cargó el resultado. A 30 días, en ese orden, el de 22 citas
registró 5, el de 66 registró 0 y el de 7 registró 2 — la inversión que la etapa 6 midió
(`lib/negocio/cierrePorCloser.ts:43-50`). La columna «Plantón» (0 · 14 · 1) sale del calendario y no
entra en ninguna tasa (`lib/negocio/cierrePorCloser.ts:153-160`). **La tabla muestra el nombre real
de cada closer** (`components/sales/PanelDeSales.jsx:499`), a propósito: es una evaluación de
desempeño y la trata como tal (`lib/negocio/cierrePorCloser.ts:11-13`).

**La concentración, y la pista del 85 %.** `docs/sales/02-METRICAS.md` dice dos cosas de `S2-12`:
«85 %» en el índice (`docs/sales/02-METRICAS.md:266`) y «32 de 51 (62,7 %)» en el cuerpo
(`docs/sales/02-METRICAS.md:210`). **La del cuerpo es la que describe lo construido**: el código
divide las CITAS del closer más grande por las citas de las filas
(`lib/negocio/cierrePorCloser.ts:386-389`) y el 62,7 % es esa cuenta a 14 días el 2026-09-21. El
85 % es la sonda del 2026-09-20 sobre CONTACTOS asignados —213 de 250, en el texto original de
`8a0368a`— que el índice no actualizó cuando `b31755b` corrigió el cuerpo. Sigue siendo cierto
como otra pregunta (215 de 252 contactos asignados a closers, 85,3 %, medido el 2026-09-28), pero
ninguna pantalla lo calcula. Y **ninguno de los dos
es lo que la pantalla muestra**: 14 días no es un botón (`lib/negocio/periodo.ts:83-96`). Lo que se
ve hoy es **69,5 % a 30 días** (66 de 95) y 76,4 % con «Completo» (97 de 127); con el umbral de
`0.6` (`lib/negocio/cierrePorCloser.ts:92`) el aviso de concentración está encendido. Ojo: el
62,7 % de la concentración no tiene nada que ver con el 62,7 % de cancelación que `9931f4d` corrigió
(`app/api/sales/route.ts:107-108`); son dos cifras distintas con el mismo valor.

**Ventanas y pisos.** Tres ventanas en una pantalla, y viajan descritas
(`lib/negocio/ventanasDeSales.ts:39-52`): el MES calendario en la zona de la empresa para el dinero
(`lib/negocio/dineroDelMes.ts:105`); la COHORTE de contactos dados de alta en N días para la cadena y
el ciclo (`lib/negocio/cadenaDeCierre.ts:169`); las CITAS ocurridas en N días para la cancelación y
la tabla (`lib/negocio/cierrePorCloser.ts:250-251`). Todas rodantes (`now() - N días`). El piso es
`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`) sobre el denominador: por fila en
la tabla (`lib/negocio/cierrePorCloser.ts:403-407`) y sobre los medidos en el ciclo
(`lib/negocio/cicloHastaLaCita.ts:144-146`). **La cancelación de cabecera no tiene piso**: su tasa es
`null` sólo con cero citas (`lib/negocio/indicadoresDeCitas.ts:67-68` y `:429`), y el panel la
dibuja con cualquier denominador (`components/sales/PanelDeSales.jsx:366-369`). Con «7 días», a las
20:00 UTC del 2026-09-28, publicaba **40 % sobre 5 citas**; a las 22:00, 33,3 % sobre 6. Ver § 7.

**Quién la ve.** 13 de los 15 usuarios activos de todas las organizaciones tienen `tablero.ver` y la
sección concedida (los otros 2 tienen un rol con secciones restringidas y no la tienen; medido el
2026-09-28 sobre `identidad.usuarios`, `usuarios_roles`, `roles_permisos` y `usuarios_secciones`).
Cuántos de ellos miran los datos de `aria` depende de la organización efectiva de cada sesión; no
verificado. El 2026-09-16 este archivo contaba 11 usuarios activos, todos con acceso.

---

## 3 · Lo que era maqueta y qué la reemplazó

**La maqueta de Sales ya no existe.** Se borró el 2026-09-21 (`1c875ac`); su inventario completo,
con la medición que desmiente cada pieza, está en el encabezado de
`components/views/SalesView.jsx:1-52` y la lista de borrado en
`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:90`. Lo que había y lo que lo reemplazó:

| lo que dibujaba (hasta el 2026-09-21) | qué hay hoy |
|---|---|
| Cuatro tarjetas: Asistencias 74, Tasa de cierre 24 %, Ventas 18, Revenue reportado $55,200 | el bloque de dinero (cero medido) y la cadena; la tasa de cierre y el revenue van como huecos declarados (`lib/negocio/huecosDeSales.ts:57-62`) |
| Tabla de dos filas: un closer real con su nombre completo, «ICP alto asignado» y 44/31/10/32 %/$31,000; y «Asesor comercial», «ICP medio y bajo», 63/43/8/19 %/$24,200 | la tabla de tres filas del catálogo, con cancelación, plantón y lo registrado; ninguna venta ni revenue por persona |
| «Motivos de no venta»: «56 llamadas sin cierre», Precio 21, No es quien decide 13, Sin necesidad clara 12, Pidió tiempo 10 | hueco declarado: 1 fila `no_interesa` en toda la base, con «Otro» (`lib/negocio/huecosDeSales.ts:71-77`) |
| Selector «Hoy / 7 días / 30 días», cuyo tercer botón mandaba `data-p="mes"` | el segmentado de las cuatro claves de `lib/negocio/periodo.ts:83-96`, que enciende el botón que el servidor contestó |
| Píldora «Personalizado» que abría un calendario sin efecto | nada: un rango libre no es reproducible por ninguna otra pantalla (`components/views/SalesView.jsx:39-41`) |

· **El botón «Plan de acción» (`slPlanBtn`)** era un botón muerto: se pintaba, se podía hacer clic y
no pasaba nada, porque ningún código lo enganchaba y no tenía una sola frase detrás. Se borró el
2026-09-21 y queda documentado en `components/views/SalesView.jsx:31-32`. El «Plan de acción» de Leads
Portal (`lpPlanBtn`), el último cableado tras irse los de Creative y Conversion, se fue el 2026-09-26
(`components/views/ContactsView.jsx:16-18`); hoy no queda ningún `PlanBtn` en `lib/`, `app/` ni
`components/` salvo en esos dos comentarios. La cita que este archivo daba para aquel enganche
apuntaba a una línea corrida, como anota `docs/leads-portal/07-EL-PLAN-DE-ACCION.md:290`.

La fila con nombre fue lo más grave de la maqueta —diez ventas y $31,000 atribuidos a una persona
que en la base no tenía ninguna, en una pantalla que esa persona podía abrir— y se fue de la
pantalla. **El nombre no se fue del repositorio**, que es público: sigue escrito en el encabezado de
`components/views/SalesView.jsx:19-20`, en `lib/ghl/calendarios.ts`, `components/negocio/Fila.jsx`,
`components/views/CloserView.jsx`, `pruebas/codigo/91-closer-y-setter.test.ts` y el prototipo
`aios-command-center_1.html` de la raíz, y en cuatro archivos de `docs/sales/` (`02`, `04`, `06` y
`10`), tres de ellos con el apellido de otro closer (`git grep` del 2026-09-28).

**La contradicción entre las dos maquetas ya no es entre dos maquetas.** Para el mismo período de 7
días, hasta el 2026-09-21 `SalesView.jsx` decía 74 asistencias / 18 ventas / $55,200 y
`lib/aios/executive.js:17` dice 36 / 11 / $27,940: casi el doble de asistencias y de revenue, y
nadie lo notaba porque ninguna se calculaba. Hoy Sales calcula —cero ventas registradas en toda la
base— y Executive sigue con sus 11. La contradicción pasó a ser entre una cifra medida y una
inventada, que es peor: la inventada es la más grande y la más creíble.

### 3.1 · Lo que Executive todavía inventa en nombre de Sales

Ninguno de estos archivos cambió en lo que toca a Sales desde el corte anterior (`git log` de los
cuatro desde el 2026-09-15 sólo muestra `0add4cc`, que tocó el panel por Conversion). Los tres
módulos de `lib/aios/` siguen arrancando (`lib/aios/index.js:32-34`).

1. **El embudo ejecutivo**: `asistidas`, `ventas` y `revenue` en `PREVP` y `F`, cinco períodos cada
   uno (`lib/aios/executive.js:8-21`), con los dos últimos pasos declarados `own:'Sales'`
   (`lib/aios/executive.js:27-28`) y «7d» por omisión (`lib/aios/executive.js:30`). Alrededor, cifras
   que sólo existen si existe la venta: una meta de 30 ventas (`lib/aios/executive.js:64`), «meta 8
   semanales» (`:84`), el ticket promedio (`:95`) y el costo por venta (`:124-126`). La meta no
   existe en ninguna parte: `negocio.comisiones.meta_mensual` es nulo en las 3 filas (medido el
   2026-09-28).
2. **La tarjeta de departamento**: «11 ventas · cierre 31%», el hallazgo «37% de las citas no
   califican y ocupan agenda del closer» y la dependencia con Conversion
   (`lib/aios/executive.js:194-197`); Conversion le «entrega» ese 37 % a Sales en `:189`. Y la tarjeta
   de Leads Portal dice «el 22% del volumen es ICP alto pero produce el 61% de las ventas» (`:200`),
   la frase que `components/views/ContactsView.jsx:16-18` da por borrada: se borró del botón de Leads
   Portal, no de Executive.
3. **El nodo del mapa**: `components/views/ExecutiveView.jsx:278-290` rotula a Sales «Closers y
   llamadas» y «cierre 31%», con el punto verde de estado sano (`:281`).
4. **Las tarjetas de reunión y de cambios**: «Sales cierra 7 puntos menos desde el día 8» y «el cierre
   bajó 7» (`lib/aios/executive-panel.js:12-16` y `:33-35`). Una serie diaria de tasa de cierre exige
   ventas fechadas, y hay 0.
5. **El chat**: las tres preguntas sugeridas para Sales (`lib/aios/executive-chat.js:23`), «¿Llegamos
   a las 30 ventas?» (`:18`) y dos respuestas escritas que citan a Sales como fuente, una con «Vas 11
   de 30» (`lib/aios/executive-chat.js:33-36`).

Lo que Sales podría entregarle hoy a Executive en lugar de eso: cero ventas registradas, la
cancelación con su piso, y la proporción de citas ocurridas sin registro. Nada de eso está cableado.

---

## 4 · Datos que ya tenemos

Todo medido el 2026-09-28 con `scripts/supabase.mjs leer`, sobre la única organización con datos de
negocio (`aria`: 7 resultados, 333 citas y 594 contactos son todos suyos).

**`negocio.resultados`: 7 filas, las mismas del corte anterior.** Del 2026-08-30 al 2026-09-09,
6 contactos, 2 personas, las 7 con `rol = 'closer'`. Por salida: `seguimiento` 4, `no_show` 2,
`no_interesa` 1; **`venta` 0, `acuerdo_sin_pago` 0, `venta_chica` 0, `nurture` 0**. Con monto: 0
(suma 0). Con `cita_id`: 0. Filas creadas desde el 2026-09-15: **0**. Las 7 caen todavía en la
ventana de 30 días; la del 2026-08-30 sale de ella el 2026-09-29.

**El esquema de la venta existe y mapea casi 1:1 contra el §5.4**
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:65-78`): `salida`, `monto numeric(12,2)`, `forma_pago`,
`registrado_por`, `creado_el`, y `cita_id` desde la `049`. Faltan la moneda (sin decisión propia: ver
el hueco 6 en § 5) y un `opportunity_id` que se ingiera.

**Los catálogos de desenlace.** `lib/negocio/salidas.ts:82` define las seis salidas del closer; las
dos que piden monto son `venta` (`lib/negocio/salidas.ts:84`) y `acuerdo_sin_pago` (`:96`). El
motivo de `no_interesa` es Precio · No es el momento · Competencia · No califica · Otro
(`lib/negocio/salidas.ts:165`); «Pidió tiempo» es de `nurture` (`lib/negocio/salidas.ts:198`).
`lib/negocio/salidasDelSetter.ts:54` define las cinco del setter, con `venta_chica` en la línea 75.
El detalle, con la ocupación de cada salida, está en `docs/sales/01-LA-VENTA-NO-EXISTE.md:42-56`.

**La maquinaria de dinero está escrita, probada y consumida por dos pantallas.**
`lib/negocio/dineroDelMes.ts:132-153` suma `monto` sólo donde `salida = 'venta'` (línea 143) y cuenta
los acuerdos aparte (líneas 149-150); `lib/negocio/comision.ts:102-115` hace lo mismo por persona.
Los dos distinguen el `0` medido del `—` (`lib/negocio/dineroDelMes.ts:162` y `:164-173`).

**La comisión**: 3 filas en `negocio.comisiones`, las 3 `tipo = 'closer'` al 10,00 %, con
`meta_mensual` nulo en las 3. **El vínculo closer ↔ CRM**: 3 filas en `negocio.closer_asignado`, las
3 con `crm_usuario_id`. Las dos cifras son iguales a las del 2026-09-16.

**Las citas: 333** (321 el 2026-09-16, 327 el 2026-09-21), del 2026-08-12 al 2026-10-01; 232
alcanzables y **101 congeladas**. Estado del CRM sobre las 333: `cancelled` 166, `confirmed` 152,
`noshow` 15 (las 15 alcanzables), `showed` **0**. `asistio` no nulo: **0 de 333**. La última cita se
creó el 2026-09-25, y sólo 12 se crearon desde el 2026-09-16. Pasadas, alcanzables y de contactos no
descartados: 106 en 30 días, 142 en toda la base (88 más son de contactos descartados).

**Los contactos: 594** (585 el 2026-09-16), 570 con fecha de alta, 253 con asignatario en el CRM
(252 de ellos asignados a uno de los tres closers), 287 del territorio `closer`. **El ingreso se
desplomó**: altas por semana desde el 2026-08-31, 175 · 89 · 4 · 3 · 1 (la última, en curso). Sólo
8 contactos entraron
desde el 2026-09-14; `docs/sales/14-LOS-CINCO-ESLABONES.md:96-98` lo atribuye a la pauta apagada
desde esa fecha (no re-medido acá). Con «7 días» la cohorte de la cadena son 3 contactos.

**El ICP ya no vive sólo en el JSON del CRM.** Desde la `055` (aplicada el 2026-09-21,
`db/migraciones/055_el_score_era_una_letra_y_el_crm_manda_un_numero.sql:9-16`), `contactos.score`
guarda el «Puntaje | ICP»: **472 de 594 contactos** con valor (el campo del CRM, en 474). El
2026-09-16 este archivo decía que `score` era nulo en las 585 filas; era cierto de la letra que la
columna guardaba entonces. Los tramos (alto desde 75, medio desde 50) existen desde el 2026-09-26 en
`lib/negocio/tramosDelIcp.ts:37-41`, para Leads Portal.

**La etapa del contacto** está poblada en 6 de 594: `seguimiento` 3, `no_show` 2, `descalificado` 1.
Ninguno en `ganado`.

**Las llamadas de venta, por primera vez.** Los Analizadores (sección `analizadores`, capacidad
`analizadores.ver`) guardan 115 llamadas con su transcripción en `negocio.analizador_llamadas`, de
una sola organización: 38 HT analizadas, 9 HT vetadas, 10 OB analizadas, 37 OB vetadas, 1 OB fallida
y 20 «OTRO». Las HT van del 2026-07-31 al 2026-09-24; 13 analizadas son de los últimos 30 días; 28
de las 115 traen enlace a la grabación. El informe HT evalúa al closer y trae además un **resultado
de la llamada que decide el modelo leyendo la transcripción** (`lib/analizadores/nucleo/ht.ts:133-138`),
guardado en `negocio.analizador_analisis.resultado` (`lib/analizadores/datos.ts:290`): de las 38,
**`NO_CERRADA` 36, `INDETERMINADO` 2, `CERRADA` 0**. Es la segunda fuente independiente que no
encuentra ninguna venta, y no es un registro: es una lectura.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Los huecos que la pantalla declara viven en `lib/negocio/huecosDeSales.ts:48-85`, con
`MEDIDO_EL = '21 de septiembre de 2026'` escrito a mano (`lib/negocio/huecosDeSales.ts:46`). Los
re-medí hoy uno por uno.

**1 · La venta misma.** Sigue sin existir bajo ningún nombre (medido el 2026-09-28):
· `negocio.resultados`: 0 filas `venta` o `acuerdo_sin_pago`, 0 montos.
· Campos del CRM resueltos por NOMBRE en `negocio.campos_del_crm`: «Forma de pago venta»,
«forma_de_pago», «Método de pago», «Cuota Inicial», «Cuotas», «Cuota 2», «Cuota 3», «Cuota 4»,
«Estado del Producto», «Política de Pagos», «Etapa del Lead» y «Lead Score»: **0 de 594 contactos**
cada uno.
· Oportunidades del CRM: no se ingieren.
· **Etiquetas: una venta marcada en el CRM que nuestra base no tiene.** El censo con
`vent|compr|pag|cliente|clos|gan|cerr|deal|win` devuelve hoy `zona_closer` (301, es territorio),
`afiliado ghl pago` (3, otra cosa) y **`venta_ganada` en 1 contacto**, que el censo del 2026-09-16
no traía. Es la etiqueta que nuestro contrato escribe al registrar una `venta`
(`lib/ghl/contrato.ts:397`). Ese contacto se dio de alta después del 2026-09-16, está asignado a un
closer, tiene 2 citas ya ocurridas y no canceladas, y **0 resultados** en `negocio.resultados`: no
la escribió Avanzar, la puso alguien en el CRM. Quién y cuándo, no verificado — la lista de
etiquetas no trae fecha. Por código, el Pipeline del Closer lo manda a `ganado` por esa etiqueta
(`lib/negocio/etapas.ts:222-261`, la vía 2), mientras Sales y Leads Portal cuentan 0 ventas porque
leen `resultados` (`lib/negocio/ventasDelContacto.ts:44-46`); no lo verifiqué en pantalla. Las
demás etiquetas de desenlace del contrato: `seguimiento` 3, `descalificado` 1, `noshow` 53,
`adelanto_ganado` 0 y `nurture_appflow` **1**, también sin ningún `nurture` en `resultados`.
· El analizador HT: 0 llamadas `CERRADA` de 38 (§ 4).
El hueco que tienta sigue ahí: «Ticket promedio mensual por cliente» tiene valor en **212 de 594**
contactos (209 el 2026-09-20), y es lo que el prospecto dice que factura, no lo que le vendimos
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:202-229`). La venta tiene que venir del registro del closer en
Avanzar, como dice el §5.4, y ese registro no tiene ninguna.

**2 · La asistencia.** `citas.asistio` nulo en las 333 citas y `resultados.cita_id` nulo en las 7.
La columna existe desde la `049` (`db/migraciones/049_si_se_presento_a_la_cita.sql:46-47` y
`:65-66`), aplicada en producción el 2026-09-14 21:49 UTC (re-medido hoy en
`migraciones.migraciones_aplicadas`), y la escribe `lib/negocio/avanzar.ts:248`. Medido el
2026-09-20: 5 de los 7 resultados tenían una cita ofrecible y se guardaron sin engancharla
(`docs/sales/01-LA-VENTA-NO-EXISTE.md:126-140`; no re-medido). Lo único que hay es el lado negativo
del calendario: 15 citas `noshow` y ninguna `showed`, que la tabla publica como conteo
(`lib/negocio/citasAlcanzables.ts:111-113`). Si el barrido debería escribir `asistio = false` con un
`noshow` es la pregunta abierta `S1-P02` (`docs/sales/01-LA-VENTA-NO-EXISTE.md:159`). La etiqueta
`noshow` está en 53 contactos (52 el 2026-09-16), pero es de contacto y no de cita.

**3 · La llamada de venta.** `negocio.llamadas` sigue con **0 filas**. Lo que cambió es que la
auditoría que el §16.1 da por existente ahora existe a medias: 38 llamadas HT analizadas (§ 4). Pero
**no están enganchadas a nada de Sales**: la llamada se ata a un prospecto identificado por correo
(`db/migraciones/056_tablas_del_analizador.sql:34-44` y `:55-91`), sin `contacto_id` ni `cita_id` ni
`resultado_id`; ni `lib/negocio/` ni la ruta de Sales leen `analizador_*` (búsqueda del 2026-09-28).
Una sonda mía por correo: de las 47 HT (38 analizadas, 9 vetadas) 31 traen correo y 26 casan con un
contacto (22 de 24 entre las analizadas); el código no hace ese cruce, y hacerlo es una decisión.

**4 · Los eslabones del §5.2.** `sale_report_id` es `resultados.id` y existe sin ninguna venta.
`sales_call_id` no tiene tabla propia: `negocio.llamadas` está vacía y las llamadas analizadas no
tienen vínculo con la cita. El tramo `appointment_id → sale_report_id` se abrió el 2026-09-14 con
`resultados.cita_id` y ninguna fila lo recorre todavía.

**5 · La asignación de contactos por ICP.** El subtítulo «ICP alto asignado / ICP medio y bajo» de la
maqueta no tenía fuente, y sigue sin tenerla: los tramos existen desde el 2026-09-26
(`lib/negocio/tramosDelIcp.ts:37-41`), la asignación existe (`closer_asignado`, 3 filas), pero
ninguna tabla, columna, constante ni campo del CRM asigna un closer por tramo. Y los datos no muestran
un reparto de hecho: de los contactos asignados a cada closer, son ICP alto 71 de 215 (33 %), 9 de 26
(35 %) y 4 de 11 (36 %), medido el 2026-09-28.

**6 · La moneda y la meta.** No hay columna de moneda en `negocio.resultados`, y la decisión que cita
`docs/sales/01-LA-VENTA-NO-EXISTE.md:78` es de otra columna (`024_ingreso_por_empresa.sql:56-62`). Y
`meta_mensual` es nulo en las 3 comisiones: la meta de 30 ventas de Executive inventa el denominador.

**7 · El cobro verificado.** Ninguna integración de pagos: 0 de las 5 filas de credenciales tienen
clave de pagos, sobre 13 organizaciones (medido el 2026-09-28). El hueco dice «0 de 5 organizaciones»
(`lib/negocio/huecosDeSales.ts:64-68`): el 5 son las filas de credenciales, no las organizaciones,
que ya eran 12 el 2026-09-20. El cero es cierto; el denominador no es el que nombra.

**8 · Los motivos de pérdida.** 1 fila `no_interesa` en toda la base, con «Otro». En el CRM, «Motivo
de descalificación» en 3 contactos, «Nivel de interés seguimiento» en 1 y «Razón de no-show» en 2
(de 594, medido el 2026-09-28). No se construyó a propósito (`docs/sales/02-METRICAS.md:225-226`).
Si el CRM guarda motivos en otro lado es `S5-P01` (`docs/sales/05-LOS-MOTIVOS-DE-NO-VENTA.md:118`).

---

## 6 · Reglas propias de este departamento

**1 · Una venta del closer y una venta del setter NO se suman. Nunca.**
Está escrita con su motivo en `lib/negocio/etapas.ts:86-94`: el mapa `ETAPA_DE_LA_SALIDA`
(`lib/negocio/etapas.ts:76-84`) tenía las nueve salidas y mandaba `venta_chica` a `ganado`, y el
texto que quedó dice que una venta chica de $497 en la misma columna que un cierre de $12.000 son
«dos negocios sumados en un número». Hoy lo cumplen el código de Sales por clave exacta
(`lib/negocio/cierrePorCloser.ts:335-337`) y el predicado compartido
(`lib/negocio/ventasDelContacto.ts:27`). Si el setter registra su primera `venta_chica`, un
`sum(monto)` sin filtro de salida infla el revenue del closer y no falla nada.

**2 · Una venta y un acuerdo sin pago son dos hechos distintos, y solo uno es dinero.**
«Lo COBRADO del mes. Cobrado real, no prometido — son dos cosas distintas y solo una va acá», y el
acuerdo tiene su propio indicador (`lib/negocio/dineroDelMes.ts:78-84`; hasta el 2026-09-20 vivía en
`inicio.ts`, `68e0e16`). `ETAPA_DE_LA_SALIDA` los separa también: `venta → ganado`,
`acuerdo_sin_pago → cierre`, «plata comprometida y no cobrada» (`lib/negocio/etapas.ts:78`). El
cobrado de Sales es la suma de `venta` y nada más.

**3 · Es venta REPORTADA, no pago verificado. El §5.4 lo exige por escrito** (línea 288 del
documento). Sales produce ese dato, así que el rótulo nace acá; hoy va pegado a la cifra
(`components/sales/PanelDeSales.jsx:208-214`). Ninguna cifra de revenue de este departamento puede
presentarse sin él, y ninguna «CERRADA» del analizador puede reemplazarlo: es la lectura de un
modelo, no un reporte del closer.

**4 · El piso de 10 y la ventana, y el piso es del DENOMINADOR.**
`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`) y `DIAS_DE_LA_TASA = 14`
(`lib/negocio/indicadoresDeCitas.ts:319`). El encabezado del piso trae la regla que más le importa a
Sales: con 151 citas y 3 respuestas la muestra son 3, y **el closer que cierra sus intentos no es el
mismo que no los cierra** (`lib/negocio/indicadoresDeCitas.ts:305-307`). Ése es el sesgo que va a
tener cualquier tasa de cierre de Sales: los closers que registran no son una muestra al azar.

Y catorce días **no es la ventana de ninguna pantalla, sino el valor por omisión de una función.**
`lib/negocio/periodo.ts` declara la lista CERRADA de cuatro ventanas —`hoy` 1 día, `7d`, `30d` y
`completo` con `DIAS_DE_TODO = 3650` (`lib/negocio/periodo.ts:52` y `lib/negocio/periodo.ts:83-96`)—
con `PERIODO_POR_OMISION = '30d'` porque catorce no está entre los botones
(`lib/negocio/periodo.ts:98-109`). `DIAS_DE_LA_TASA` sigue vivo como argumento por omisión de más
de una docena de funciones de `lib/negocio/` y `lib/auditor/` (búsqueda del 2026-09-28), entre ellas
las cuatro que llama Sales, y la ruta de Sales se lo pisa en las cuatro con la ventana pedida
(`app/api/sales/route.ts:109-112`); lo que no está en la lista se RECHAZA con un 400
(`lib/negocio/periodo.ts:188-193`; `app/api/sales/route.ts:85`). Ya construida, se cumple dentro de
Sales: **los cuatro módulos reciben la misma ventana**. Fuera de Sales no: `citasParaCerrar`, que
decide qué cita ofrece Avanzar para responder la asistencia, se queda con sus catorce
(`lib/negocio/citasParaCerrar.ts:60`), así que la cadena y Avanzar miran dos poblaciones (§ 2). Y el
código y los documentos de Sales siguen llamando «la ventana por omisión» a catorce días (§ 7).

**5 · Los dos ceros, y acá deciden si alguien cobra.**
`lib/negocio/comision.ts:14-28` enumera los cuatro estados que ningún número de Sales puede
colapsar: (1) sin porcentaje → `null` con motivo; (2) porcentaje en 0 a propósito → `0` medido;
(3) sin ningún resultado propio este mes → `null` con motivo; (4) con resultados y sin ventas → `0`
medido. «Un `?? 0` en cualquier punto de la cadena convierte (1) y (3) en (2) y (4)», y ni el tipo
ni el motor avisan. Hoy el dinero de Sales está en el estado (4) —6 resultados en septiembre, ninguna
venta— y el 2026-10-01 pasa solo al (3) si nadie registra nada (ver § 7).

**6 · El denominador de una tasa de asistencia lleva `asistio is not null`.**
`lib/negocio/indicadoresDeCitas.ts:365-374`: como el nulo es el caso normal, sin ese filtro «la tasa
diría que no se presenta casi nadie. Sería una cifra plausible, alarmante y falsa». La tabla por
closer lo repite por fila (`lib/negocio/cierrePorCloser.ts:269-273`). Con 0 de 333 citas con
asistencia, ese denominador es cero y la tasa es `null`.

**7 · «No-show» ya no es una opción de detalle de `nurture`, y no es un recorte.**
`lib/negocio/salidas.ts:185-197`: la opción se sacó porque «cualquier inferencia "salida de closer
distinta de `no_show` ⟹ apareció" contaba ese caso como asistencia — un show rate inflado sin que
nada fallara». Sales NO puede deducir asistencia a partir de la salida. Tiene que leer
`citas.asistio`, y el plantón del calendario va aparte, como conteo.

**8 · Un resultado es un INTENTO del closer, no una cita.**
`lib/negocio/indicadoresDeCitas.ts:120-128` declara el no-show reportado como conteo y no como tasa
porque «un resultado es un intento del closer, que no es lo mismo» que una cita. Y lo registrado es
de OTRO EJE que lo asignado: `resultados.registrado_por` contra `contactos.crm_asignado_a`, que en
esta base dan vuelta la tabla si se cruzan (`lib/negocio/cierrePorCloser.ts:37-50`). Hasta que
`resultados.cita_id` se llene no hay forma de cruzar citas y resultados.

**9 · El filtro de citas «alcanzables y no descartadas» es del sistema, no de una pantalla.**
Alcanzable = `ghl_calendario_id is not null` (`lib/negocio/citasAlcanzables.ts:54-56`); descartado =
el contacto tiene alguna de `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`, vía
`lib/negocio/citasAlcanzables.ts:79-85`). Vive en un solo archivo desde el 2026-09-21 porque estaba
copiado en nueve módulos (`lib/negocio/citasAlcanzables.ts:11-14`). El commit `9931f4d` ya pagó no
aplicarlo: «62,7 % era mitad descarte propio». Hoy, sobre las citas pasadas y alcanzables de 30 días,
el filtro aparta 88 de 194. Y la carpeta de requisitos volvió a pagarlo: su 59,2 % de cabecera no
lleva el filtro (§ 7).

**10 · Los identificadores del CRM se resuelven por NOMBRE, nunca a mano.**
Toda medición de campos de este informe pasó por `negocio.campos_del_crm`. El motivo está en
`lib/negocio/salidas.ts:73-77`: de 17 claves curadas, **7 ya no existen en la subcuenta**, y
escribir un campo que no existe se responde con un 200 y no hace nada.

**11 · Las opciones del catálogo hoy se guardan en `resultados.detalle` y NO se escriben al CRM.**
Misma fuente (`lib/negocio/salidas.ts:73-77`). Si Sales quiere leer motivos de pérdida, los lee de
`detalle`, no del campo «Motivo de descalificación» del CRM (3 de 594 contactos con valor, medido el
2026-09-28). Lo que sí viaja al CRM es la etiqueta de la salida (`lib/ghl/contrato.ts:396-403`).

**12 · `resultados.detalle` es texto libre en la base y las filas viejas conservan su texto.**
Reescribir el pasado para que coincida con el catálogo de hoy «sería inventar»
(`lib/negocio/salidas.ts:196-197`). Un agrupador de motivos tiene que tolerar valores que ya no están
en el catálogo: la única fila `no_interesa` de hoy dice «Otro», que sí está, pero cuando el catálogo
cambie las filas viejas no se van a mover, y un agrupador cerrado las pierde en silencio.

---

## 7 · Riesgos

**Una maqueta internamente consistente, y por eso engaña: pasó en Sales y sigue en Executive.**
La de Sales cerraba perfecto —31+43 = 74 asistencias, 10+8 = 18 ventas, $31,000+$24,200 = $55,200,
18/74 ≈ 24 %, 74−18 = 56 sin cierre, y las cuatro barras sumaban 56
(`components/views/SalesView.jsx:8-10`)—; el 2026-09-16 once usuarios activos tenían acceso a ella.
Se borró el 2026-09-21.
**Executive tiene la misma propiedad y sigue en pie** (§ 3.1): sus 11 ventas, 36 asistidas y $27,940
de 7 días son coherentes entre sí, y ahora conviven con una pantalla que mide cero.

**Poner una persona real al lado de un número inventado.** La maqueta atribuía por nombre diez ventas
y $31,000 que la base no respaldaba a un closer que podía abrir la pantalla; cualquier coaching,
comisión o comparación tomada mirando esa fila estaba tomada sobre ficción, y el daño no es un número
mal calculado: es una evaluación de desempeño. La fila inventada se fue el 2026-09-21. Quedan dos
cosas: la tabla nueva **sí** pone nombres reales al lado de números —medidos, con piso y con el
aviso de concentración— y los ven 13 usuarios; y el nombre de la maqueta sigue escrito en seis
archivos fuera de `docs/` y cuatro de `docs/sales/` de un repositorio público (la lista, en § 3).

**Publicar una tasa con menos de 10 eventos, y ya está pasando en la cifra de cabecera.** La
cancelación no aplica el piso (`lib/negocio/indicadoresDeCitas.ts:429`) y el panel la dibuja siempre
que haya una cita: con «7 días», **40 % sobre 5 citas** a las 20:00 UTC y 33,3 % sobre 6 dos horas
después. `docs/sales/02-METRICAS.md:104` le atribuye a esta cifra un piso que la función no tiene. Las
demás tasas de la pantalla sí lo aplican.

**La cifra de cabecera de la carpeta de requisitos no es la de la pantalla.** `docs/sales/` publica
«59,2 % de cancelación (132 de 223)» como hallazgo del departamento
(`docs/sales/14-LOS-CINCO-ESLABONES.md:72-83`, `docs/sales/00-MAPA.md:128`) y le pone la población
«no descartados» (`docs/sales/02-METRICAS.md:103-106`). Reconstruido hoy: 223 son TODAS las citas
alcanzables ocurridas hasta el 2026-09-20 y 132 sus canceladas, **con los descartados adentro**; con
el filtro, el mismo corte da 54 de 136 (39,7 %). Es el defecto de la regla 9 otra vez, en el
documento que la enuncia. La pantalla nunca dibujó ese número: hoy dice 34,9 % a 30 días y 39,4 % con
«Completo».

**Cifras con fecha que envejecen escritas en el código.** `MEDIDO_EL` es un literal
(`lib/negocio/huecosDeSales.ts:46`), y el hueco del pago dice «0 de 5 organizaciones» con 13
existentes. `lib/negocio/cierrePorCloser.ts:30-33` y `:88-91` llaman «ventana por omisión» a 14 días
(y `:202` da su 0,627 a 14) cuando la pantalla abre en 30; lo mismo `docs/sales/02-METRICAS.md:173` y
`docs/sales/00-MAPA.md:133-135`. El «5 puntos de diferencia» entre closers es de esa ventana que
ningún botón produce; a 30 días hoy son 10,6 (33,3 % contra 22,7 %, sobre 66 y 22 citas).

**El 1 de octubre el dinero cambia de estado sin que nadie haga nada.** Hoy es `$0` medido porque hay
6 resultados en septiembre. Desde el 2026-10-01 00:00 en Lima no habrá ninguno en el mes y el bloque
pasa a `—` con «Todavía no se registró ningún resultado este mes»
(`lib/negocio/dineroDelMes.ts:164-165`). Es correcto, y quien lo vea puede leerlo como una rotura.

**Confundir «nadie registró la asistencia» con «nadie asistió».** Una tasa de asistencia sobre las
333 citas sin `asistio is not null` da 0 % y dispara una crisis que no existe. La tabla lo evita por
fila (`lib/negocio/cierrePorCloser.ts:269-273`); una cifra nueva que no use los predicados
compartidos puede no evitarlo.

**Sumar `venta_chica` con `venta`, o lo prometido con lo cobrado.** Hoy dan cero porque no hay
ninguna de las cuatro salidas, así que el defecto entraría sin síntomas. `dineroDelMes`,
`cierrePorCloser` y `ventasDelContacto` lo hacen bien; una implementación que no los use lo va a
hacer mal.

**Deducir la asistencia a partir de la salida.** Los dos `no_show` registrados tienen su cita con
`asistio` nulo; un mutante que infiriera asistencia publicaría «0 % sobre 2», plausible y falso
(`lib/negocio/cierrePorCloser.ts:56-61`).

**La cadena señala citas que Avanzar ya no ofrece.** El aviso «nadie registró qué pasó» es la cifra
de esta pantalla que más puede mover una conducta, y a 30 días 38 de sus 46 contactos tienen la
cita fuera de los 14 días en que Avanzar la ofrece para responder la asistencia (§ 2). Quien lo lea
y vaya a cerrar esas citas no las va a encontrar en el panel; el resultado sí lo puede cargar.

**Dos pantallas, dos respuestas a «¿hubo una venta?».** El contacto con `venta_ganada` (§ 5) es una
venta para el Pipeline del Closer, que clasifica por etiqueta cuando nadie escribió la etapa
(`lib/negocio/etapas.ts:222-261`), y no lo es para Sales, Leads Portal ni el dinero del mes, que
leen `negocio.resultados`. Las dos lecturas están bien escritas; la que falta es el registro en
Avanzar, que es lo único que le pone monto. Si la costumbre es marcar la venta en el CRM, el hueco
central de este departamento no es de adopción del producto sino de dónde se anota.

**Tomar el resultado del analizador como venta.** Es el hueco que tienta del mes: `CERRADA` /
`NO_CERRADA` está en 38 llamadas, con fecha y cerca del closer. Es lo que un modelo leyó en una
transcripción, no lo que el closer reportó, y no está atado a ningún contacto ni cita. Sumarlo a la
cadena daría un cierre plausible con otra definición adentro.

**Cablear identificadores del CRM a mano, y el `?? 0`.** Siete de diecisiete claves curadas ya no
existen y una escritura a un campo inexistente devuelve 200. Y un `?? 0` en cualquier punto colapsa
«nadie cargó nada» con «el resultado es cero», que acá decide cuánto cobra una persona.

**Lo que se puede construir hoy, y lo que no.** Lo que la foto anterior daba por construible se
construyó: la tabla por closer con citas reales y tres filas, el cero medido con su rótulo, la
cancelación compartida, la cadena y el ciclo. Sigue sin poder construirse: tasa de cierre (0 ventas),
asistencia y show rate (0 de 333 con `asistio`), motivos de pérdida (1 fila), revenue, la llamada de
venta enganchada a la cita, y la asignación por ICP (la regla no existe). **El cuello de botella de
Sales sigue sin ser técnico**: la pantalla está, el escritor está (`lib/negocio/avanzar.ts:248`), la
comisión está configurada al 10 % para los tres closers, y en diecinueve días no se registró un solo
resultado en Avanzar —aunque una venta sí se marcó en el CRM—. Hasta que eso cambie, cualquier cifra
de ventas o de revenue con monto que dibuje este producto, en Sales o en Executive, no tiene de dónde
salir.
