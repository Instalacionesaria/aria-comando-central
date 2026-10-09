# Las cinco tarjetas de arriba

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional y de la **medición
> LP-0 contra producción, hecha el 2026-09-27 a las 00:10 UTC** (el 26 por la tarde en Lima), sólo
> con consultas agregadas. Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo
> rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a `lib/aios/leads-portal.js` son a la maqueta tal como está hoy.** En LP-6 ese archivo
> se borra y en LP-7 estas citas se reapuntan al prototipo o al encabezado de la vista nueva, como
> pasó con `SalesView.jsx` en `docs/sales/`. También las de `components/views/ContactsView.jsx`, que
> se reescribe en LP-6, y las de `lib/aios/leads-group.js`, que LP-6 edita. Esas dos no fallan al
> resolverse: siguen dentro de rango y muestran otra cosa, así que la prueba 101 no las atrapa y LP-7
> las reapunta a mano.

`aios-command-center_1.html:4704-4744` arma la fila de tarjetas de arriba de la pestaña. Son cinco: una
por tramo de ICP y una de «Todos». Las dibuja con los 15 contactos inventados de
`aios-command-center_1.html:4590-4664`, sin pedir nada al servidor.

| tarjeta | rótulo en la maqueta | cifra grande | línea de abajo | pie |
|---|---|---|---|---|
| `nc` | «Sin calificar» | conteo | «N% del total · **sin agendar**» | «Aún sin formulario · califican al agendar» |
| `alto` | «Calificado alto» | conteo | «N% del total · N agendados» | «Cierre N% · Revenue $…» |
| `medio` | «Calificado medio» | conteo | igual | igual |
| `bajo` | «**No calificado**» | conteo | igual | igual |
| `all` | «Todos» | total | «N ventas · N agendados» | «Cierre N% · Revenue $…» |

Rastro de la tabla: los rótulos y el orden en `aios-command-center_1.html:4724-4725`, la plantilla de
cada tarjeta en `aios-command-center_1.html:4712-4720` y la de «Todos» en
`aios-command-center_1.html:4725-4731`.

---

## 0 · Lo que está mal en la maqueta, antes de decir qué se construye

Ninguna de estas piezas es un requisito. Se listan porque cada una esconde una afirmación falsa que
la pantalla nueva no puede heredar sin querer.

1. **El período no filtra nada.** Las tarjetas cuentan `const all = LEADS`
   (`aios-command-center_1.html:4705`), y los botones de período sólo cambian de color
   (`aios-command-center_1.html:4894-4898`).
2. **El tramo está guardado al lado del puntaje, no derivado de él.** Un contacto inventado tiene 79
   y tramo medio (`aios-command-center_1.html:4624`) y otro tiene 79 y tramo alto
   (`aios-command-center_1.html:4644`). Acquisition ya lo encontró y sacó el requisito: el tramo se
   deriva del puntaje, no se guarda (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:489-518`).
3. **La tasa da 0 cuando no hay denominador, y no tiene piso.**
   `rate = (a,b) => b ? Math.round(a/b*100) : 0` (`aios-command-center_1.html:4707`). Un «0 %» sobre
   cero contactos afirma algo que nadie midió.
4. **La tarjeta «Sin calificar» afirma que nadie agendó.** Escribe «sin agendar» como texto fijo, sin
   contar (`aios-command-center_1.html:4715`).
5. **Y le inventa la causa**: «Aún sin formulario · califican al agendar»
   (`aios-command-center_1.html:4718`). Ver `LP03-05` para lo que dice el dato.
6. **El mismo cero se dibuja de dos maneras.** En un tramo, un revenue en cero sale «—»
   (`aios-command-center_1.html:4719`); en «Todos» sale «$0» (`aios-command-center_1.html:4730`).
7. **La cifra grande abre una lista inventada.** Lleva `data-leads` (`aios-command-center_1.html:4714`),
   y ese atributo lo escucha el panel de grupo (`lib/aios/leads-group.js:78-85@c4cf2a8`), que arma la lista
   repitiendo catorce nombres de muestra (`lib/aios/leads-group.js:14-37@c4cf2a8`). Es el defecto que
   Acquisition describe en A7-28: la cifra y su lista no comparten origen
   (`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:443-454`).
8. **Tocar una tarjeta mezcla la búsqueda con el tramo.** `if(lpQuery === (k==='all'?'':k))`
   (`aios-command-center_1.html:4736`) compara el texto del buscador con la clave del tramo.

---

## 1 · Sobre quién cuentan

### LP03-01 · Las cinco tarjetas cuentan la cohorte del período, no la base entera

- **Rastro:** `aios-command-center_1.html:4705` (cuenta todo), `aios-command-center_1.html:4894-4898` (el
  período no hace nada).
- **Qué pide:** la cohorte son los contactos dados de alta en el CRM dentro de la ventana elegida
  (`alta_en_el_crm`, no `creado_el`). La ventana es la de Sales: `cadenaDeCierre.ts` recorta con
  `alta_en_el_crm >= now() - make_interval(days => N)` (`lib/negocio/cadenaDeCierre.ts:169`). Tiene
  que ser la misma para que el total de «Todos» coincida con la cohorte de Sales. La definición de
  las ventanas vive en `06-PERIODOS-Y-PISOS.md`.
- **Medido:** hoy (24 h) **0** · 7 días **3** · 30 días **286** · completo **569**.
- **Las tarjetas no cambian con la búsqueda ni con el filtro de etapa.** Son los denominadores de la
  pantalla. Lo que reacciona a los filtros es el contador de la rejilla (`04-LA-REJILLA-Y-LOS-FILTROS.md`).
  La maqueta ya lo hace así y eso se conserva.

### LP03-02 · Los contactos sin fecha de alta no entran en ninguna tarjeta, y se dice

- **Rastro:** el patrón ya existe en Sales. El aviso de `cadenaDeCierre.ts` dice *«contacto(s) de la
  empresa no tienen fecha de alta en el CRM … ampliar la ventana no los trae»*
  (`lib/negocio/cadenaDeCierre.ts:343-351`).
- **Medido:** **24** de 593 contactos no tienen `alta_en_el_crm`, y **los 24 están congelados**. Por
  eso «completo» da 569 y no 593.
- **Qué pide:** la nota de cobertura del bloque dice cuántos quedan afuera y por qué. «Completo» no
  los trae.

### LP03-03 · Las cuatro tarjetas de tramo suman la de «Todos», siempre

- **Rastro:** la maqueta no lo garantiza: cada tarjeta filtra `seg` por su cuenta
  (`aios-command-center_1.html:4706`) y el tramo viene escrito a mano en cada contacto.
- **Qué pide:** el tramo de cada persona se calcula **una vez, en la consulta**, a partir del
  puntaje (LP-1 y LP-2). Las tarjetas cuentan esas filas y no vuelven a clasificar. Así la suma
  sale por construcción, no por coincidencia.
- **Medido a 30 días:** 51 + 83 + 117 + 35 = **286**. Las porciones redondeadas a un decimal suman
  99,9 %. Por eso el invariante se vigila sobre los **conteos** y no sobre los porcentajes.

---

## 2 · Los tramos y cómo se llaman

### LP03-04 · Cuatro tramos, con los cortes de la maqueta

- **Rastro:** el corte 75/50 de `lib/aios/leads-group.js:10@c4cf2a8` y los cinco botones de
  `aios-command-center_1.html:3050-3056`. Decisión del usuario del 2026-09-26.
- **Qué pide:** **ICP alto** ≥ 75 · **ICP medio** 50–74 · **ICP bajo** 1–49 · **Sin calificar** =
  sin puntaje **o** puntaje 0. Los umbrales viven en un solo lugar, `lib/negocio/tramosDelIcp.ts`
  (LP-1), y de ahí los toman la consulta, las tarjetas, el filtro y la ficha.
- **Medido sobre los 593:** alto **108** · medio **158** · bajo **158** · sin calificar **169**
  (122 sin puntaje y 47 en cero). **A 30 días:** alto 51 · medio 83 · bajo 117 · sin calificar 35.
- **Lo que esto contesta de Acquisition, y lo que no.** Para esta pestaña, contesta la P-6 de
  Acquisition: los ceros van a un cuarto estado «sin calificar»
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:594-597`). **La P-5 sigue abierta para Acquisition**
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:589-592`). Leads Portal adopta el 75/50 por decisión
  propia. No es un corte validado: los datos proponen también un 60, que es donde la casa deja de
  rechazar (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541`).

### LP03-05 · Los ceros van a «Sin calificar», y la tarjeta dice por qué hay gente ahí

- **Rastro:** el pie inventado «Aún sin formulario · califican al agendar»
  (`aios-command-center_1.html:4718`).
- **Qué dice el dato:** hay dos poblaciones distintas en esa tarjeta, y la maqueta no nombra
  ninguna de las dos.
  - **122 sin puntaje**: el CRM no mandó el campo.
  - **47 en cero**, todos de tres semanas de alta (la del 17-ago 3, la del 24-ago 23, la del 31-ago
    21) y **ninguno en los últimos 14 días**. `sincronizar.ts` guarda el cero como cero porque no se
    sabe si el CRM calculó cero o si su workflow no corrió
    (`lib/negocio/sincronizar.ts:412-420`).
- **Qué pide:** el pie de la tarjeta muestra los dos términos: «sin puntaje N · en 0 N». La
  respuesta los trae como `sinCalificar.sinPuntaje` y `sinCalificar.enCero`.
- **El guardián:** `sinCalificar.cerosRecientes` cuenta los ceros con alta en los últimos 14 días.
  Si deja de valer 0, la pantalla lo avisa. Un cero nuevo querría decir que el CRM volvió a fallar,
  y esa falla se escondería dentro de una tarjeta que ya tiene gente. **Medido: 0.**
- **La divergencia que hay que declarar:** el ICP promedio de Creative **sí** promedia los ceros. Su
  filtro de «parece un número» (`lib/negocio/calidadDelCreativo.ts:209`) deja pasar el `0`, y el
  promedio se calcula sobre eso (`lib/negocio/calidadDelCreativo.ts:218`). Las dos pantallas pueden
  mostrar a los mismos contactos de forma distinta. Esta carpeta no lo arregla: lo dice en el matiz
  de la tarjeta y lo registra `14-EL-PUNTAJE-DEL-CRM.md`.

### LP03-06 · Los rótulos son «ICP alto», «ICP medio», «ICP bajo», «Sin calificar» y «Todos»

- **Rastro:** la maqueta dice «Calificado alto», «Calificado medio» y «No calificado»
  (`aios-command-center_1.html:4724`).
- **Por qué no se conservan:**
  - **«no calificado» es una etiqueta de descarte del CRM** (`lib/ghl/contrato.ts:236`). Rotular así
    al tramo bajo diría que 158 personas fueron descartadas.
  - **«Calificado medio» nombraría calificados a gente que la casa rechazó.** Medido, con la etiqueta
    `icp_rechazado`: bajo **45** · medio **22** · sin calificar **1** · alto **0**.
  - «Calificado» ya significa cinco cosas distintas en este producto
    (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:489-518`). Sumarle una sexta no ayuda.
- **Qué pide:** los rótulos salen de `TRAMOS` (LP-1) y son los mismos en la tarjeta, en el filtro de
  tramo, en el chip de cada tarjeta de la rejilla y en el contador. La maqueta usa una tercera
  forma, «ALTO / MEDIO / BAJO» (`aios-command-center_1.html:4687`), que también se va.

### LP03-07 · El orden de las tarjetas es fijo

- **Rastro:** Sin calificar, alto, medio, bajo y «Todos» al final (`aios-command-center_1.html:4724-4725`).
- **Qué pide:** se conserva ese orden, que vive en `TRAMOS`. **Nunca se ordena por volumen**, por el
  mismo motivo que Conversion da para sus familias: ordenar por volumen haría que la pantalla
  cambiara de forma cada semana (`lib/negocio/recorrido.ts:52-54`).

---

## 3 · Lo que dice cada tarjeta

### LP03-08 · La cifra grande es el número de personas del tramo

- **Rastro:** `n = g.length` (`aios-command-center_1.html:4709`).
- **Qué pide:** la unidad es la **persona**. Alguien con tres citas cuenta una vez. Es la idea de
  `01-LA-UNIDAD-ES-LA-PERSONA.md`.

### LP03-09 · La porción es del total de la cohorte, y con cohorte vacía no hay porción

- **Rastro:** «N% del total» y el ancho de la barra salen de `rate(n, all.length)`
  (`aios-command-center_1.html:4715-4716`).
- **Qué pide:** porción = contactos del tramo / contactos de la cohorte. El texto se redondea; la
  barra usa la proporción exacta. **Con la cohorte en 0 la porción es nula y se dibuja «—»**, no
  «0 %».
- **Medido a 30 días:** alto 17,8 % · medio 29,0 % · bajo 40,9 % · sin calificar 12,2 %. **Hoy
  (24 h) la cohorte es 0**, así que ese período es justamente el caso de la porción nula.

### LP03-10 · «Agendados» es `tieneCitaAlcanzable`, también en «Sin calificar»

- **Rastro:** `agend` en `aios-command-center_1.html:4710`, y el «sin agendar» fijo de la tarjeta
  `nc` en `aios-command-center_1.html:4715`.
- **Qué pide:** la misma definición que el resto del sistema, sin copiarla. El predicado es
  `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:115-145`): una cita cancelada cuenta, una
  congelada no. La unidad es la persona, con `exists` y no con `join`
  (`lib/negocio/citasAlcanzables.ts:122-124`). Es el mismo predicado del eslabón `con_cita` de Sales
  (`lib/negocio/cadenaDeCierre.ts:204`). Por eso los agendados de «Todos» tienen que coincidir con
  los de Sales en la misma ventana, y la prueba de la ruta lo vigila (LP-4).
- **Lo que LP-0 no midió, y hay que decirlo:** la medición contó **292** personas con alguna cita y
  **278** con alguna cita de un contacto no congelado. Las dos cifras son sobre todo el universo y
  **ninguna usa el predicado del código**: la medición distinguió por territorio y no por
  `ghl_calendario_id`. **Con el predicado del código, medido en LP-2 el 2026-09-27 a 30 días:** alto
  40 de 51 · medio 39 de 82 · bajo 48 de 117 · sin calificar 15 de 33, que son 142 de 283
  (`scripts/medir-leads-portal.sql`). En LP-4 se cotejan con Sales.
- **Nota:** **146** personas tienen **sólo** citas canceladas (medido sobre todas sus citas,
  alcanzables o no). Con la definición del sistema esas personas cuentan como agendadas. La tarjeta
  no las separa; ver `LP04-P03`.

### LP03-11 · «Vendidos» cuenta personas con una venta registrada, y un acuerdo sin pago no es venta

- **Rastro:** `vend` (`aios-command-center_1.html:4710`) y «N ventas» de «Todos»
  (`aios-command-center_1.html:4728`).
- **Qué pide:** vendió = tiene al menos un resultado con salida `venta` (`lib/negocio/salidas.ts:84`).
  `acuerdo_sin_pago` no cuenta (`lib/negocio/salidas.ts:96`), por la regla que ya separa el cobrado del
  comprometido (`lib/negocio/dineroDelMes.ts:79-85`). `venta_chica`, la del setter
  (`lib/negocio/etapas.ts:86-94`), tampoco: la venta del closer y la del setter no se suman
  (`docs/sales/02-METRICAS.md:35-37`).
- **Medido:** **0** personas con venta. En toda la base hay 7 resultados: seguimiento 4, no_show 2 y
  no_interesa 1.
- **Se dibuja como conteo, y hoy dibuja 0.** Es un cero medido de ventas *registradas*, igual que el
  último eslabón de Sales.
- **La diferencia con Sales, dicha antes de que alguien la encuentre:** en Sales, `con_venta` exige
  además una cita cerrable y un intento registrado después de ella
  (`lib/negocio/cadenaDeCierre.ts:207-208`). Acá cuenta cualquier venta, que es la definición de
  LP-2. Con cero ventas las dos cifras coinciden. El día que alguien registre una venta sin cita
  cerrable, el portal va a mostrar **más** vendidos que Sales, y va a estar bien. Por eso la prueba
  de coherencia compara el total y los agendados, **no** los vendidos. El matiz lo dice.

### LP03-12 · «Cierre» es vendidos sobre contactos del tramo, con piso 10 y con motivo cuando no hay cifra

- **Rastro:** `rate(vend, n)` (`aios-command-center_1.html:4719`), sobre una función que da 0 sin
  denominador (`aios-command-center_1.html:4707`).
- **Fórmula:** vendidos / contactos del tramo. Es la misma que la maqueta, y hay que leerla bien: de
  cada cien personas del tramo, cuántas compraron.
- **Piso:** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:329`), **sobre el
  denominador** (`lib/negocio/indicadoresDeCitas.ts:325-327`).
- **Cuándo es nula, en este orden:**
  1. **`sin_ventas_registradas`**: la empresa no tiene **ninguna** venta registrada. Es lo que pasa
     hoy en las cinco tarjetas. Se evalúa sobre la empresa y no sobre el tramo por el motivo de
     `huecosDeSales.ts`: *«Un "$0" acá afirmaría que no se vendió nada, que es distinto de que nadie
     lo haya registrado»* (`lib/negocio/huecosDeSales.ts:57-62`). Un «ICP alto: 0 %» mientras nadie
     registra ventas se lee como «el tramo alto no compra».
  2. **`bajo_el_piso`**: el tramo tiene menos de 10 contactos. A 7 días la cohorte entera son 3.
- **Fuera de esos dos casos, la tasa se publica**, 0 % incluido. Si hay ventas en la empresa y
  ninguna en un tramo con 10 o más contactos, ese 0 % sí está medido.
- La respuesta trae la cifra y su `porQueSinCierre` (LP-4). La tarjeta dibuja «—» con el motivo al
  pasar o tocar.

### LP03-13 · «Monto reportado» en lugar de «Revenue», y un nulo no es $0

- **Rastro:** «Revenue» en `aios-command-center_1.html:4719` (con «—» para el cero) y en
  `aios-command-center_1.html:4730` (con «$0» para el cero).
- **Por qué cambia el rótulo:** el documento funcional pide, en el perfil del lead, el *«Monto
  reportado por el closer»* (`§ 5.3:263`). Sales ya escribe al pie de su cadena que una venta es la
  que el closer reportó, *«no un pago verificado»* (`lib/negocio/cadenaDeCierre.ts:353-358`).
  «Revenue» promete dinero cobrado, y este sistema no tiene ninguna integración de cobros.
- **Fórmula:** suma de `monto` de los resultados `venta` de las personas del tramo. El acuerdo sin
  pago no entra.
- **Tres estados, y ninguno se colapsa en otro:**
  - nulo con `sin_ventas_registradas`: no hay ventas en la empresa. Es el caso de hoy (**0 montos
    cargados**);
  - nulo con `ventas_sin_monto`: hay ventas y ninguna tiene monto;
  - la suma, en cualquier otro caso.
  Un `?? 0` en cualquier punto de la cadena convierte los dos primeros en un cero falso. El
  comentario de `comision.ts` describe ese mismo defecto (`lib/negocio/comision.ts:26-27`).
- **El formato de la maqueta es andamiaje:** `'$'+n.toLocaleString('en-US')`
  (`aios-command-center_1.html:4587`). La tabla de resultados guarda el monto y ninguna moneda
  (`lib/datos/esquema.ts:806-818`).

### LP03-14 · Las tarjetas no emiten `data-leads`

- **Rastro:** `aios-command-center_1.html:4714`; el escuchador global en `lib/aios/leads-group.js:78-85@c4cf2a8`.
- **Qué pide:** ninguna cifra del panel nuevo lleva `data-leads`. Si lo llevara, abriría el panel de
  grupo, que hoy fabrica la lista con un conteo (`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:443-454`).
  En esta pestaña no hace falta ese panel: **la lista de cada cifra ya está en la misma pantalla**, y
  tocar la tarjeta la filtra (`LP03-15`). Es un drill-down donde la cifra y su lista salen de la misma
  respuesta, que es lo que A7-28 pedía. Lo que pasa con `leads-group.js` se decide en
  `08-LO-QUE-ENTREGA-Y-RECIBE.md`.

### LP03-15 · Tocar una tarjeta filtra la rejilla por su tramo, y tocarla otra vez o tocar «Todos» lo quita

- **Rastro:** el manejador de `aios-command-center_1.html:4732-4743`, con el defecto de
  `aios-command-center_1.html:4736`. La sincronización con los botones de tramo va en los dos
  sentidos: `aios-command-center_1.html:4739-4740` y `aios-command-center_1.html:4885-4886`.
- **Qué pide:** **un solo estado de tramo**, el mismo que el filtro de tramo de
  `04-LA-REJILLA-Y-LOS-FILTROS.md`. La tarjeta encendida se ve encendida, y el botón correspondiente
  también. Cada tarjeta es un control de verdad: se alcanza con el teclado y dice si está apretada.
  En la maqueta son `div` con `onclick`.

### LP03-16 · Con 3 contactos a 7 días, o 0 hoy, las tarjetas dicen poco y no lo disimulan

- **Medido:** cohorte de 7 días **3**, de hoy **0**. Última alta: **2026-09-25**. Última
  sincronización: **2026-09-27 00:00 UTC**.
- **Por qué es real:** las campañas están pausadas. Lo confirmó el usuario el 2026-09-26. No es un
  barrido caído: la última sincronización es de diez minutos antes de la medición.
- **Qué pide:** a 7 días las cinco tasas quedan bajo el piso; hoy las cinco tarjetas dicen 0 y la
  porción es «—». La pantalla no rellena ni cambia de período sola. El aviso de frescura
  (`06-PERIODOS-Y-PISOS.md`, LP-5) es lo que distingue «no entró nadie» de «no pasó el barrido».

### LP03-17 · La asistencia no va en las tarjetas

- **Rastro:** la maqueta no la dibuja en las tarjetas. El documento pide *«Show rate por ICP»*
  (`§ 10.7:757`), y se lo asigna a Appointment Flow.
- **Medido:** `asistio` es verdadero en **0** personas y falso en **0**. **145** personas tienen una
  cita pasada, no cancelada y sin asistencia registrada. El calendario marcó **15** plantones.
- **Qué pide:** la respuesta trae `asistieron` por tramo, porque lo necesita el filtro de etapa, pero
  **la tarjeta no dibuja una tasa de asistencia**. Hoy esa tasa no tendría denominador: nadie
  contestó. El plantón del calendario viaja aparte y no se suma con `asistio`
  (`lib/negocio/citasAlcanzables.ts:105-109`).

---

## 4 · Preguntas abiertas

### LP03-P01 · ¿«Cierre» o «Venta por contacto»?

La maqueta rotula «Cierre» a vendidos / contactos del tramo. En Sales, «tasa de cierre» es otra
cosa: ventas sobre llamadas, y el documento se la da a Business (`docs/sales/02-METRICAS.md:237-241`).
Con el mismo nombre para dos fórmulas, el día que las dos tengan cifra alguien las va a comparar. La
propuesta es un rótulo que diga la población, como «Venta por contacto», o conservar «Cierre» con el
matiz siempre visible. No cambia nada hoy, porque las cinco valen nulo.

### LP03-P02 · ¿«Sin ventas registradas» se evalúa en toda la empresa o en la ventana?

`LP03-12` lo evalúa sobre la empresa. Así un 0 % en un tramo, con ventas en otros tramos, queda
publicado como cero medido. La otra lectura, «ninguna venta en esta ventana», escondería también el
0 % de una ventana joven cuyas personas todavía no llegaron a la llamada. Las dos se pueden defender;
hoy dan lo mismo porque no hay ninguna venta.

### LP03-P03 · ¿La tarjeta dice cuántos de su tramo están descartados?

Medido: **121** personas tienen alguna etiqueta de descarte, y la de `icp_rechazado` se reparte así:
bajo 45, medio 22, sin calificar 1, alto 0. Hoy cuentan en su tramo como cualquier otra, porque el
universo son todos los contactos guardados. Un «de los cuales N descartados» debajo del conteo haría
visible que el tramo medio tiene gente que la casa rechazó. Pero agrega una sexta línea a una tarjeta
que ya tiene cinco.
