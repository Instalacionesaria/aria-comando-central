# La maqueta contra el documento contra lo que se puede medir hoy

> Las tres columnas, pieza por pieza. **Maqueta:** `components/views/ContactsView.jsx` (101 líneas),
> `lib/aios/leads-portal.js` (324), `lib/aios/leads-group.js` (89) y el bloque
> `aios-command-center_1.html:5710-5730`; la primera línea de cada archivo dice de qué líneas del
> prototipo `aios-command-center_1.html` viene. **Documento:**
> `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`, 1.650 líneas, fuera del repositorio; las
> citas `§ N:línea` son a ese archivo. **Medición:** producción, **2026-09-27 a las 00:10 UTC** (el 26
> a las 19:10 en Lima), sólo agregados, con sus consultas en `09-DE-DONDE-VIENE-CADA-DATO.md`.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** En LP-6 `lib/aios/leads-portal.js` se borra
> y sus citas fallan al resolverse; también fallan las de `lib/aios/period-controls.js`, porque al
> sacar el bloque de las líneas 41 a 61 el archivo queda más corto que ellas. Las de
> `components/views/ContactsView.jsx`, que se reescribe, siguen resolviendo y muestran otra cosa. Y
> las de `lib/aios/index.js` y `scripts/paridad.mjs`, que LP-6 edita (`LP10-10`), se corren: siguen
> resolviendo y muestran otra cosa, sin que ninguna prueba lo vea, salvo que el archivo quede más
> corto que la cita, y entonces fallan. Las dos citas a `lib/aios/leads-group.js` son anteriores a la
> línea 56 y LP-6 no las mueve. LP-7 reapunta todas al prototipo o a la cabecera de la vista nueva.

La última columna de las tablas `LP13-01` y `LP13-02` dice qué pasa con la pieza, con una de cuatro
palabras: **se construye** (y en qué etapa), **hueco declarado** (se dibuja el lugar y se dice por
qué está vacío), **se va** (era andamiaje, o una decisión la deja fuera de la pantalla) o **deuda**
(nadie la construye todavía, y queda nombrada). Las tablas de más abajo tienen otras columnas.

---

## LP13-01 · Las tarjetas, la rejilla y los controles

| lo que la maqueta dibuja | lo que el documento pide | lo que la base sostiene hoy | qué pasa |
|---|---|---|---|
| Cinco tarjetas: Sin calificar **3**, «Calificado alto» **5**, «Calificado medio» **6**, «No calificado» **1**, Todos **15** (`aios-command-center_1.html:4723-4731`) | «Segmento de ICP», como renglón del perfil y no como pantalla (`§ 5.3:256`) | a 30 días: ICP alto **51** · medio **83** · bajo **117** · sin calificar **35** = **286** | **se construye** en LP-1 y LP-2 (`LP03-04`) |
| «N % del total» y su barra: **33 %** el tramo alto (`aios-command-center_1.html:4715-4716`) | — | 17,8 % · 29,0 % · 40,9 % · 12,2 % | **se construye** en LP-2; el piso, sin decidir (`LP06-P01`) |
| «N agendados», y «sin agendar» escrito fijo en Sin calificar (`aios-command-center_1.html:4715`) | «Cita» (`§ 5.3:260`) | **292** personas con alguna cita; con el predicado del sistema, **200** de los 569 con alta, medido en LP-2 (`LP09-P01`) | **se construye** en LP-2, con `tieneCitaAlcanzable` también en Sin calificar (`LP03-10`) |
| El filtro «Asistieron» (`aios-command-center_1.html:3062`) | «Asistencia» (`§ 5.3:261`); el «Show rate por ICP» es de Appointment Flow (`§ 10.7:757`) | `asistio` verdadero en **0** personas y falso en **0**; como mucho 145 sin registrar; **15** plantones del calendario | **se construye** en LP-2 y LP-5, y hoy vacío: el conteo viaja y el filtro existe, y dice por qué no tiene a nadie; la tasa no se publica (`LP03-17`, `LP04-14`, `LP11-16`) |
| «3 ventas» en Todos (`aios-command-center_1.html:4728`) | «Resultado de venta» (`§ 5.3:262`) | **0** personas con venta; 7 resultados en toda la base | **se construye** en LP-2, y hoy dibuja 0 (`LP03-11`) |
| «Cierre 60 %» en el tramo alto, sobre cinco personas (`aios-command-center_1.html:4719`) | — | sin ventas no hay tasa | **hueco declarado**: `null` con `sin_ventas_registradas` (`LP02-07`) |
| «Revenue $20,100» en Todos (`aios-command-center_1.html:4730`) y «facturado» en cada persona (`aios-command-center_1.html:4771`) | «Monto reportado por el closer» (`§ 5.3:263`), reportado y no verificado (`§ 5.4:288`) | **0** montos cargados | **hueco declarado**, con el rótulo «monto reportado» (`LP02-08`, `LP03-13`) |
| «Calificado alto», «Calificado medio», «No calificado» (`aios-command-center_1.html:4724`) | — | «no calificado» es una etiqueta de descarte del CRM (`lib/ghl/contrato.ts:236`); en el tramo medio hay **22** con `icp_rechazado` | **se va**: «ICP alto / medio / bajo» (`LP03-06`) |
| «Aún sin formulario · califican al agendar» (`aios-command-center_1.html:4718`) | el ICP es posterior al formulario (`§ 9.6:583-586`) | **169** sin calificar = 122 sin puntaje + 47 en 0 | **se va**: al pie, los dos términos, y el guardián de ceros (`LP03-05`) |
| Una rejilla de quince personas (`aios-command-center_1.html:4757-4775`) | **ninguna lista de leads**: el documento no tiene una pantalla así (`LP12-13`) | **286** a 30 días, **569** en «Completo» | **se construye** en LP-2 y LP-5 (`LP04-01`) |
| El buscador, que no quita tildes y mira un campo que no anuncia (`aios-command-center_1.html:4696`, `:4900`) | — | — | **se construye** en LP-5 con `normalizar` (`LP04-10`) |
| Tres botones de período que no filtran, y «Personalizado» (`aios-command-center_1.html:3036-3037`) | — | **0** hoy · **3** a 7 días · **286** a 30 · **569** en «Completo» | **se construye** en LP-4 y LP-5 con `PERIODOS`; «Personalizado» **se va** (`LP06-02`) |
| «◈ Plan de acción», cuatro frases (`aios-command-center_1.html:5710-5730`) | **nada**: el documento no usa «plan de acción» ni nombra la pestaña (`LP07-P02`) | ninguna de las cuatro se sostiene (`LP07-06`) | **se va** en LP-6 (`LP07-07`) |
| La cifra de cada tarjeta abre el cajón «Grupo de contactos», con catorce personas inventadas (`aios-command-center_1.html:4714`) | — | — | **se va** del portal en LP-6; el cajón queda de Executive (`LP08-10`) |

---

## LP13-02 · La ficha

| lo que la maqueta dibuja | lo que el documento pide | lo que la base sostiene hoy | qué pasa |
|---|---|---|---|
| Encabezado que escribe «ICP null» a quien no tiene puntaje (`aios-command-center_1.html:4791`) | `lead_id` y los datos básicos (`§ 5.3:246`, `:248`) | país en 569; alta en 569; puntaje en 471, 47 de ellos en 0 | **se construye** en LP-3; el 0 viaja con su motivo (`LP05-05`) |
| «✆ Llamar» y «✉ Email» sin manejador; «↗ GHL» a la portada del CRM (`aios-command-center_1.html:4806-4810`, `:4865-4866`) | — | teléfono y correo **sin medir en LP-0**; el plan anota 558 y 590 del 2026-09-26 (`LP09-P05`) | **se construye** en LP-5 con `tel:` y `mailto:`; **GoHighLevel se va** (`LP05-06`) |
| «Vio el VSL», con un porcentaje inventado (`aios-command-center_1.html:4816`) | el VSL, *«cuando exista tracking individual verificable»* (`§ 5.3:258`) | el medidor no reporta desde el 2026-08-30 | **hueco declarado**, y en su lugar «Llegó por» (`LP05-07`) |
| «Formulario de la landing»: nueve preguntas deducidas del tramo y «8/8 campos» (`aios-command-center_1.html:4823-4828`) | las respuestas de Meta y las de la landing (`§ 5.3:253-254`) | **475** con algún valor del grupo `calificacion`, un techo que incluye al puntaje; «Form Landing VSL»: 121 · 87 · 39 · 346 vacío, sin escribirse desde el 2026-08-31 | **se construye** en LP-3: el grupo `calificacion` y el estado del formulario con su corte (`LP05-08`, `LP05-09`) |
| «Comportamiento en el VSL», con «VTurb» como fuente (`aios-command-center_1.html:4830-4838`) | lo mismo, y su historial (`§ 5.3:265`) | ningún dato y ningún historial | **hueco declarado** (`LP05-10`) |
| El video precall como porcentaje (`aios-command-center_1.html:4832`) | el precall, con la misma condición (`§ 5.3:259`) | **222** con valor, 180 de ellos en el estado inicial que el CRM escribe al agendar | **se construye** en LP-3, como texto del CRM (`LP05-11`); falta que el usuario confirme el agregado (`LP11-P02`) |
| Interacciones con «sentimiento positivo» (`aios-command-center_1.html:4603-4607`) | los eventos en tablas separadas, y un resumen en el perfil (`§ 5.3:242`) | 305 con algún mensaje entrante, 484 con alguno saliente, 541 con la historia leída | **se construye** en LP-3: fechas y conteos, sin el texto (`LP05-12`) |
| Once parámetros de publicidad y cuatro UTM (`aios-command-center_1.html:4846-4854`) | origen, campaña, ad set, anuncio y creativo; primer y último toque (`§ 5.3:249-252`) | `sessionSource` 552 · `utmContent` 505 · `campaign` 271 · `adId` 213, que cruzan **los 213** con `negocio.anuncios`; **286** URLs con un token adentro | **se construye** en LP-3, por lista blanca y con sólo el host (`LP05-13`) |
| Ubicación, posición, costo del lead, dispositivo y ciudad (`aios-command-center_1.html:4848-4850`) | — | no existen, o sólo saldrían de la IP y del navegador | **hueco declarado** (`LP05-14`) |
| «Fit score» e «Intent score» (`aios-command-center_1.html:4857`) | — | no existen en ninguna tabla | **hueco declarado** (`LP05-15`) |
| El closer asignado: en cuatro personas, **el nombre de un closer real** (`aios-command-center_1.html:4593`, `:4610`, `:4626`, `:4630`) | — | **253** con asignado en el CRM; **252** cruzan con uno de los 3 closers configurados | **se construye** en LP-3 con `closersDeLaEmpresa`, nunca con el id crudo (`LP05-16`) |
| — | `ghl_contact_id` (`§ 5.3:247`) | en las 593 filas | **se va** de la pantalla, por decisión: el dato queda en la base, pero su único uso sería el enlace al CRM, y no hay enlace (`LP11-03`) |
| — | el último toque como renglón propio (`§ 5.3:252`) | sin medir en LP-0 | **se construye** en LP-3, pero sólo como «Llegó por»; el renglón propio es `LP11-P01` |
| — | el historial de la reproducción (`§ 5.3:265`) | no hay tabla de eventos | **deuda** sin dueño (`LP11-11`, `LP11-P03`) |

---

## LP13-03 · Lo que no está ni en la maqueta ni en el documento, y salió de medir

Como en Sales, las filas que más dicen de esta pantalla no las imaginó ninguna de las otras dos
fuentes.

| hallazgo | medido | qué hace la pestaña |
|---|---|---|
| Los 47 puntajes en 0 son un lote cerrado de tres semanas de alta, de fines de agosto y comienzos de septiembre | 3 · 23 · 21 por semana de alta (las que empiezan el 17, el 24 y el 31 de agosto: del 17 de agosto al 6 de septiembre), **0** en los últimos 14 días; la sincronización los ubica entre el 21 de agosto y el 3 de septiembre (`lib/negocio/sincronizar.ts:414-416`) | los cuenta como «sin calificar», los separa en `enCero` y los vigila con `cerosRecientes` (`LP14-09`, `LP14-10`) |
| Hay contactos que ninguna ventana alcanza | **24** de 593 sin alta, los 24 congelados | los declara en `sinAlta` (`LP02-10`) |
| La entrada de gente se cortó el 14 de septiembre | 117, 90, 53, 175 y 89 altas por semana del 10 de agosto al 7 de septiembre, y 4 y 3 desde entonces (censo del 2026-09-26); cohorte de 7 días: **3** | distingue «no hay tráfico» de «el barrido no pasa» con la frescura y `ultimaAlta` (`LP06-08`), y sabe que «30 días» se va a vaciar (`LP06-09`) |
| La mitad de quienes tuvieron cita sólo tienen canceladas | **146** de 292, con `'cancelled'` como única grafía y sobre todas sus citas: una aproximación | cuentan como agendados, como en todo el sistema; si se marcan aparte es `LP02-P03` |
| El tramo alto nunca está rechazado por ICP | **0** de 108 con `icp_rechazado`; 22 en medio y 45 en bajo | el descarte viaja como atributo de la fila, no como tramo (`LP14-11`) |
| El `adId` siempre cruza | **213 de 213** con `negocio.anuncios` | el anuncio se nombra por su nombre (`LP08-07`) |
| Casi todas las direcciones de entrada llevan un identificador | **286** de 331 | de `url` y `referrer`, sólo el host (`LP09-08`) |
| Nadie nuevo gana acceso a un dato personal | 3 personas ven la pestaña; las 4 activas ya podían leer cualquier ficha | la tabla se le muestra al usuario antes de LP-4 (`LP12-03`, `LP12-04`) |

---

## LP13-04 · Qué se construye, etapa por etapa

Del plan aprobado (`C:\Users\USUARIO\.claude\plans\purring-enchanting-dream.md`). **Ninguna etapa
necesitó migración**: las tablas que la pestaña lee ya existían (`LP09-01`). **Las seis se
construyeron el 2026-09-26**, cada una con su prueba vista en rojo por mutación antes de quedar, y la
suite en verde en `America/Lima`, `UTC` y `Asia/Tokyo`.

| etapa | qué | requisitos de esta carpeta que cumple | la prueba que la cierra |
|---|---|---|---|
| **LP-1** | `lib/negocio/tramosDelIcp.ts`: los umbrales 75 y 50, `TRAMOS` y `tramoDelPuntaje`, sin imports | `LP03-04`, `LP03-06`, `LP03-07`, `LP14-05`, `LP14-06`, `LP14-07` | `pruebas/codigo/175-tramos-del-icp.test.ts`: los bordes 0, 1, 49, 50, 74, 75 y 100 |
| **LP-2** | `lib/negocio/leadsDelPortal.ts` en una sola sentencia; `ventasDelContacto.ts`; el descarte por contacto en `citasAlcanzables.ts` | `LP01-04`, `LP01-07`, `LP02-01` a `LP02-10`, `LP06-04`, `LP06-06`, `LP06-07`, `LP06-10`, `LP14-09`, `LP14-10` | `pruebas/base/175-leads-del-portal.test.ts`, cada caso con su mutación |
| **LP-3** | `fichaDelLeadDelPortal.ts`, que sólo lee; `atribucionVisible.ts`; `huecosDelLeadsPortal.ts`, con `MEDIDO_EL` | `LP05-03`, `LP05-05`, `LP05-07` a `LP05-16`, `LP12-06` | `pruebas/codigo/176-atribucion-visible.test.ts` y `pruebas/base/176-ficha-del-lead-del-portal.test.ts` |
| **LP-4** | `GET /api/leads-portal` y `GET /api/leads-portal/[id]`; la bandera baja y el conteo de `90-fundaciones` pasa de 2 a 1, **en el mismo commit** | `LP06-01`, `LP06-08`, `LP06-13`, `LP12-01`, `LP12-05`, `LP12-07`, `LP12-10`, `LP12-11` | `pruebas/base/177-la-ruta-del-leads-portal.test.ts`, con la coherencia contra la cadena de Sales |
| **LP-5** | el lector, los filtros puros, el panel y la ficha en un cajón propio | `LP01-12`, `LP01-13`, `LP03-01` a `LP03-17`, `LP04-01` a `LP04-17`, `LP05-01`, `LP05-02`, `LP05-04`, `LP05-06`, `LP06-03`, `LP06-11`, `LP12-08`, `LP12-09` | `pruebas/codigo/177-filtros-del-portal.test.ts`, más las generales `147` y `123` |
| **LP-6** | se borran `lib/aios/leads-portal.js` y el bloque del plan de acción; la vista queda como envoltura; el cajón de contactos pasa a Executive; la paridad y la vigilancia de nombres, al día | `LP07-07`, `LP08-10` a `LP08-12`, `LP10-09`, `LP10-10` | `pruebas/codigo/178-la-maqueta-del-leads-portal-se-fue.test.ts` |

La columna de requisitos **no es exhaustiva**: nombra los que cada etapa construye o prueba, y
cuando uno se reparte entre la consulta y la pantalla puede aparecer en una sola de las dos. Los que
son hallazgos, censos o decisiones —la medición de `09`, el censo de `10`, lo que pide el documento—
no tienen etapa.

Tres cosas que la tabla no muestra y hay que tener a la vista:

1. **Antes de LP-4 hay dos mediciones que faltan**: cuántas personas tienen una cita alcanzable
   (`LP09-P01`), que es la cifra contra la que se verifican los agendados de la ruta, y si alguno de
   los tres que ven la pestaña es un closer vinculado (`LP12-P01`). Y la tabla de quién ve se le
   muestra al usuario antes, no después (`LP12-04`).
2. **Al terminar LP-4 la ruta existe y la pantalla todavía es la maqueta**, como pasó en Sales (lo
   dice el plan). Durante ese intervalo la ruta devuelve personas reales y la pestaña sigue dibujando
   las inventadas.
3. **Entre LP-5 y LP-6 hay una costura que el plan no resuelve**: ver `LP13-P01`.

---

## LP13-05 · Qué se dibuja como hueco declarado, y de dónde sale cada uno

No todos los vacíos son del mismo tipo, y cada tipo sale de un lugar distinto:

| qué falta | por qué | de dónde sale el texto | dónde se dibuja |
|---|---|---|---|
| El VSL | el medidor no reporta desde el 2026-08-30 | `huecosDelLeadsPortal.ts`, con su `MEDIDO_EL` (LP-3) | la ficha: el recorrido y la sección del VSL (`LP05-10`) |
| Fit e intent | no existen en ninguna tabla | ídem | la ficha, en la calificación (`LP05-15`) |
| Ubicación y posición | el placement no llega de ningún lado | ídem | la ficha, en publicidad (`LP05-14`) |
| Costo por lead | el gasto es por anuncio y por día, no por persona | ídem | ídem |
| Dispositivo y ciudad | sólo saldrían de la IP y del navegador, que no viajan | ídem | ídem |
| La venta, el cierre y el monto | cero ventas y cero montos en toda la base | **se consumen** de `lib/negocio/huecosDeSales.ts:55-69`; no se reescriben (`LP08-05`) | las tarjetas: cierre y monto en `null`, con su motivo |
| La asistencia | nadie la registra: `true` 0, `false` 0 | **no es un hueco entero**: es `sin_registrar` con su número, y el plantón aparte; Sales tampoco la declara hueco (`lib/negocio/huecosDeSales.ts:35-37`) | el filtro «Asistieron», vacío y con su motivo (`LP04-14`) |
| El historial de la reproducción | no hay tabla de eventos | de ningún lado: es deuda (`LP11-P03`) | la ficha dice que el precall es la última foto que mandó el CRM (`LP11-11`) |

La regla es la de toda la carpeta: un hueco dicho es una decisión, y uno callado es una regresión
(`LP09-12`). Por eso cada hueco se dibuja **donde la maqueta dibujaba el dato**: quien conoce la
maqueta lo va a buscar ahí.

---

## LP13-06 · Donde la maqueta acierta, y se conserva

Cinco cosas, y son las que hacen que esta reescritura sea menos un borrado que una sustitución:

1. **La unidad.** Una tarjeta por persona, con su progreso «Agendó › Asistió › Vendió»
   (`aios-command-center_1.html:4757-4775`). Es la idea de `01-LA-UNIDAD-ES-LA-PERSONA.md`; lo que cambia
   es que cada paso pasa de dos estados a tres (`LP01-07`).
2. **«Sin calificar» como tramo propio.** La maqueta ya apartaba el nulo en su propia tarjeta
   (`aios-command-center_1.html:4648-4659`, `:4724`), cuando el único corte escrito del sistema lo mandaba
   al tramo bajo (`lib/aios/leads-group.js:10@c4cf2a8`). Acquisition lo señaló en su P-6
   (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:594-597`). Se conserva, y se le agrega el 0 (`LP14-09`).
3. **El teléfono y el correo sólo en la ficha.** La rejilla no los dibuja
   (`aios-command-center_1.html:4757-4775`) y la ficha sí (`aios-command-center_1.html:4861-4863`). Lo que
   era una costumbre del marcado pasa a ser un contrato con prueba (`LP12-05`).
4. **Las tarjetas no reaccionan a la búsqueda ni a la etapa.** Son el denominador de la pantalla
   (`LP03-01`).
5. **El contador «N de M»** (`aios-command-center_1.html:4777-4778`), que es la regla de `A7-29`
   (`LP04-15`).

## LP13-07 · Donde el documento no alcanza, y donde acierta contra la producción

**No alcanza en tres cosas:**

- **No tiene esta pestaña.** La palabra «portal» no aparece en sus 1.650 líneas; tiene una entidad y
  un perfil (`LP11-01`). Las tarjetas, la rejilla, los filtros y el período no salen del documento:
  salen de la maqueta, de la medición y de las decisiones del usuario del 2026-09-26.
- **No dice quién ve.** «Permisos y roles» está entre sus secciones pendientes (`§ 17:1119`), y
  ninguno de los grupos de usuarios que describe ve una lista de personas con sus datos de contacto
  (`LP12-13`). La regla de acceso es nuestra y lleva su fecha.
- **Da un techo, no un piso.** El § 5.3 dice *«Puede incluir»* (`§ 5.3:244`), no «debe»
  (`LP11-02`).

**Y acierta donde Sales encontró lo contrario.** En Sales, el documento daba por existente una
auditoría de llamadas que no existía (`docs/sales/13-EL-CONTRASTE.md:45-50`). Acá el documento puso
la condición —*«cuando exista tracking individual verificable»* (`§ 5.3:258-259`)— y la producción no
la cumple: **el documento previó el hueco del VSL**. La única vez que pide algo que la base hace al
revés es el historial de la reproducción, que se guarda como un valor que la sincronización pisa en
cada pasada (`LP11-11`).

## LP13-08 · Donde la maqueta se contradice consigo misma, y con Executive

- **Mismo puntaje, dos tramos:** dos personas con 79, una «medio» y otra «alto»
  (`aios-command-center_1.html:4624` y `:4644`).
- **Misma persona, dos tramos:** la del 79 «medio» del portal es «alto» en el cajón, que sí deriva
  el tramo (`lib/aios/leads-group.js:20@c4cf2a8`).
- **Tres porciones del tramo alto:** 22 % en el plan de acción (`aios-command-center_1.html:5717`);
  «312 contactos · 78 de ICP alto», un 25 %, en la ficha de Executive (`lib/aios/executive.js:199@c4cf2a8`), que en la línea
  siguiente repite el 22 % (`lib/aios/executive.js:200@c4cf2a8`); y 33 % en sus propias tarjetas. La medida
  es **17,8 %** a 30 días (`LP07-02`).
- **«Sin calificar» abre gente calificada:** en el cajón, esa tarjeta abre tres personas con puntaje
  87, 91 y 82 (`LP08-10`).
- **El mismo cero, dos veces:** «—» en la tarjeta de un tramo y «$0» en la de Todos
  (`aios-command-center_1.html:4719`, `:4730`).

El inventario completo está en `LP10-07`.

---

## LP13-09 · El veredicto, en tres líneas

- **La maqueta** acierta en la forma —una persona por fila, «Sin calificar» aparte, el teléfono sólo
  en la ficha— y se equivoca en todo lo que afirma: 536 valores de dato inventados (`LP10-01`),
  personas con teléfono y correo, el nombre de un closer real y cuatro frases sin fuente.
- **El documento** no tiene esta pestaña: tiene un perfil de dieciocho renglones, y pone condiciones
  que la producción hoy no cumple sin fingir que se cumplen.
- **La base** tiene todo lo que hace falta para contar personas por tramo y mostrarlas —593
  contactos, 471 puntajes, la atribución de primer toque— y casi nada de lo que diría si esas
  personas compraron: cero asistencias registradas y cero ventas.

> **Y ésa es la diferencia con Sales.** Allá la medición cambió de qué hablaba el departamento
> (`docs/sales/13-EL-CONTRASTE.md:97-99`). Acá no cambia de qué habla la pestaña —de personas—, sino
> **cuánto puede decir de cada una**: cuándo entró, de dónde, con qué puntaje y si agendó, sí; si
> asistió o si compró, todavía no se sabe, y la pantalla lo dice con esas palabras.

---

## Preguntas abiertas

### LP13-P01 · ¿LP-5 y LP-6 van en el mismo commit?

El plan las separa: LP-5 construye la pantalla y LP-6 borra la maqueta. En Sales fueron una sola: el
commit `1c875ac` («Etapas 8 y 9 de Sales: la maqueta se va…») agregó
`components/sales/PanelDeSales.jsx` y reescribió `components/views/SalesView.jsx` juntos.

**Por qué acá importó, y cómo se resolvió.** Mientras `initLeadsPortal` siguiera en el arranque, buscaba `#lpIcpSeg`,
`#lpStage`, `#lpPeriod` y `#lpSearch` sin ninguna guarda (`aios-command-center_1.html:4880`, `:4889`,
`:4894`, `:4899`). Si el panel de LP-5 reemplaza ese marcado, el módulo falla en cada carga; `bootAios`
atrapa el error y lo escribe en la consola (`lib/aios/index.js:40-46`), así que a la vista no se rompe
nada, que es justo el motivo por el que nadie lo habría notado. Y la compuerta de paridad todavía
comparaba `contacts` contra el prototipo. Por eso LP-5 construyó el panel sin montarlo, y LP-6 lo montó
en el mismo commit que borró el módulo y vació la lista (`scripts/paridad.mjs:153`).

Las tres salidas:

1. **LP-5 y LP-6 en un commit**, como Sales. Es la que no deja una costura, y la que junta el cambio
   más grande de la serie.
2. **LP-5 monta el panel y conserva el marcado viejo hasta LP-6**: durante esa etapa la sección
   dibuja las personas inventadas y las reales, una debajo de la otra.
3. **LP-5 construye y prueba los componentes sin montarlos**: la costura desaparece, pero la prueba
   de humo con login (paso 4 de la verificación del plan) tiene que esperar a LP-6.

**Decide el usuario.**
