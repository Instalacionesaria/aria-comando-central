# Acquisition · Catálogo de métricas

> **`lib/aios/acquisition.js` YA NO EXISTE.** Se borró el 2026-09-16 junto con
> `acquisition-plan.js`, y con ellos los 58 literales inventados que esta carpeta documenta. Las
> citas `acquisition.js:N` de abajo **siguen siendo correctas como referencia histórica** —el
> archivo y sus líneas están en el historial de git— y ésa es toda su función acá: este documento
> nunca describió lo que hay, describió lo que la maqueta dibujaba para sacar de ahí los requisitos.
>
> **Y `components/views/AcquisitionView.jsx` se reescribió el mismo día**: pasó de 148 líneas a 60,
> así que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la
> línea 60 fallan al resolverse, y se ven. Las **once** que apuntan a las líneas 27-63 —el segmentado
> de período y el selector de rango— **siguen resolviendo y muestran otra cosa**, que es peor: una
> línea corrida no falla. Las once describen controles que ya no existen; el porqué de cada uno está
> en la cabecera del archivo nuevo.
>
> Lo que sí hay hoy es `components/acquisition/PanelDeAcquisition.jsx` con dos cifras medidas: el
> costo por anuncio (`lib/negocio/costoDelAnuncio.ts`) y el monitor de atribución del § 18.14
> (`lib/negocio/calidadDeLaAtribucion.ts`). Nada de lo demás está construido.

> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.

**Tres niveles de agregación, dos ventanas por consulta.** Este documento
dice qué número tiene que poder dar Acquisition, con qué fórmula, en qué unidad y **sobre qué
población**.

---

## 0 · Cómo se lee una ficha

Cada requisito trae seis campos. El que decide si el requisito sirve es **Población**: dos métricas
con la misma fórmula y distinta población son dos métricas distintas, y la mitad de los errores
posibles de esta pantalla son un denominador tomado de la población equivocada.

| Campo | Qué dice |
|---|---|
| **Qué es** | La definición, en una línea. |
| **Fórmula** | Lo que el sistema real tiene que calcular. Cuando el prototipo calcula otra cosa, se dice aparte. |
| **Unidad** | Contactos, dinero, proporción, días o conteo de entidades. |
| **Población** | El conjunto sobre el que se mide, y su filtro. |
| **Rastro** | El `archivo:línea` del que sale: del prototipo, o del resto del sistema cuando el prototipo no lo tiene. |
| **Estado** | Ya está / está incompleto / no existe y de dónde tiene que venir, según `01-ACQUISITION.md`. |

**La ventana de referencia de todo este documento** son los **233 contactos con `alta_en_el_crm`
entre 2026-09-01 y 2026-09-13** (`01-ACQUISITION.md` §4). Cuando una cifra sale de sumar la tabla de
reparto por anuncio de ese informe y no de una medición propia, está dicho.

---

## 1 · Las nueve reglas que valen para todas las métricas

### A2-01 · Toda métrica se calcula sobre una ventana de fechas, y toda consulta produce DOS ventanas

**Qué es** · No existe una cifra de Acquisition sin ventana. `windows()` devuelve siempre
`{a:{días,…}, b:{días,…}, note}`: la ventana consultada y la de comparación, aunque después se decida
no mostrar la comparación.
**Unidad** · Dos pares de fechas y una frase.
**Población** · No aplica: es la regla que define la población de todo lo demás.
**Rastro** · `lib/aios/acquisition.js:59-83`, con los tres caminos: histórico (`:60-63`), atajo de
duración fija (`:64-67`) y rango libre (`:68-82`). Los tres devuelven la misma forma, así que
`build()` no sabe de dónde vino la ventana.
**Estado** · La mitad es reproducible hoy: la cohorte se arma con `alta_en_el_crm` entre dos fechas.
La otra mitad no tiene contra qué compararse — **531 de 559 contactos (95,0 %) caen en los últimos
45 días** (`01-ACQUISITION.md` §3.3).

### A2-02 · La ventana incluye el día inicial y el día final

**Qué es** · Del 1 al 21 de julio son **21 días**, no 20. El `+ 1` no es un ajuste, es la definición.
**Fórmula** · `días(a,b) = round((b − a) / 86.400.000) + 1`
**Unidad** · Días enteros.
**Población** · La ventana misma.
**Rastro** · `lib/aios/acquisition.js:45`.
**Estado** · Decisión de cálculo, no de dato. La misma convención tiene que usarse al armar la
ventana de comparación (`shift(a1, da)`, `:72`) o las dos quedan desfasadas un día.

### A2-03 · La ventana de comparación por defecto es contigua, anterior y de igual duración

**Qué es** · Si la ventana A va de X a Y y dura `da` días, la ventana B termina en `X−1` y empieza en
`X−da`. No se solapan y miden lo mismo por construcción.
**Fórmula** · `b2 = X − 1 día` · `b1 = X − da días` · `db = da`
**Unidad** · Un par de fechas.
**Población** · La misma cohorte, corrida hacia atrás.
**Rastro** · `lib/aios/acquisition.js:53-57` (`shift`) y `:71-73`. El modo lo elige el usuario
(`components/views/AcquisitionView.jsx:76-83`): «Periodo anterior» o «Otro periodo».
**Estado** · Calculable, sin nada contra qué calcularlo todavía. Medido: el rango por defecto de la
vista (2026-07-01 → 2026-07-21) trae **3 contactos** y el de comparación (2026-06-01 → 2026-06-21)
trae **0** (`01-ACQUISITION.md` §3.9).

### A2-04 · El periodo es un atajo de duración conocida o un rango libre, por el mismo eje

**Qué es** · Un solo campo de estado lleva los cinco valores que circulan: `p1`, `p7`, `p30`, `hist` y
`custom`. `custom` no es un atajo: lo escribe el selector global de fechas y `windows()` lo trata como
el tercer caso.
**Unidad** · Un valor de estado.
**Población** · No aplica.
**Rastro** · `lib/aios/acquisition.js:39` (defecto `p7`), `:60`, `:64`, `:267`;
`components/views/AcquisitionView.jsx:28-38` (los tres botones) y `:39-46` (la píldora).
**Estado** · Las ventanas de 1, 7 y 30 días son medibles con `alta_en_el_crm`. **`PERIODS.pmes`
(`:38`) dura 12 días y no tiene botón que lo seleccione**: o falta en la interfaz o es código muerto.

### A2-05 · El rango consultable tiene piso de 1 día y techo de 365

**Qué es** · El sistema acota la duración en vez de confiar en los campos de fecha: un rango invertido
o de cero días no llega al cálculo.
**Fórmula** · `da = max(1, min(365, días(a1,a2)))`
**Unidad** · Días.
**Población** · La ventana.
**Rastro** · `lib/aios/acquisition.js:69` y `:75`. El 365 coincide con `hist.d` (`:38`): el rango libre
no puede pedir más que el histórico.
**Estado** · Decisión de producto. El fallback `|| 21` (`:69`) es andamiaje —veintiún
días es el largo del rango por defecto de la vista (`AcquisitionView.jsx:68, :72`)— y hay que
tirarlo: un sistema real pide las fechas, no inventa una ventana.

### A2-06 · La pantalla escribe qué está comparando contra qué, y avisa cuando las duraciones no coinciden

**Qué es** · Cuando la ventana no es evidente por el control, se escribe: `'21d vs 21d · base
2026-06-10 → 2026-06-30'`. Si las dos duraciones difieren, se agrega ` · ⚠ periodos de distinta
duración`.
**Fórmula** · `nota = da + 'd vs ' + db + 'd · base ' + b1 + ' → ' + b2 + aviso`
**Unidad** · Texto.
**Población** · Las dos ventanas.
**Rastro** · `lib/aios/acquisition.js:62`, `:66`, `:77`, `:81`, escrito en `:260`.
**Estado** · El aviso importa más de lo que parece: comparar 21 días contra 30 sin decirlo produce un
delta que es en su mayor parte la diferencia de duración y se lee como crecimiento. El sistema **no
lo bloquea** —comparar un mes contra el mismo mes del año pasado es legítimo— pero lo dice en la
misma línea. En modo «Periodo anterior» el aviso no puede dispararse, porque `db = da` (`:72`).
A esta nota se le suma una obligación que el prototipo no tiene y la base sí impone: ninguna cohorte
armada con `alta_en_el_crm` tiene historia antes del despliegue, y **toda pantalla que la use tiene
que decir desde cuándo mide** (regla 6 del §6 de `01-ACQUISITION.md`).

### A2-07 · El modelo tiene tres niveles y se calcula una sola vez por ventana

**Qué es** · Una ventana entra, un modelo de tres niveles sale: **campaña → embudo → gran total**.
La función es pura de la ventana, no toca la pantalla y se llama idéntica para la ventana actual y la
de comparación.
**Fórmula** · `build(ventana) → { embudos: {clave: {campañas[], total}}, granTotal }`
**Unidad** · Un objeto.
**Población** · Las campañas activas en la ventana.
**Rastro** · `lib/aios/acquisition.js:85-122`, llamada en `:261-263`.
**Estado** · El día que el dato sea real, esta firma es la del endpoint. **Defecto a corregir al
portarlo:** `renderAcq` llama a `build(w.a)` y `build(w.b)` **tres veces cada una** (`:261`, `:262`,
`:263`), una por bloque de render. Con datos inventados es gratis; con datos de servidor son seis
consultas donde alcanzan dos, y seis consultas que pueden devolver cifras distintas entre sí.

### A2-08 · Ninguna cifra tiene decimales, y el dinero lleva moneda declarada

**Qué es** · Tres formateadores mandan en toda la pantalla: volúmenes con separador de miles, dinero
con separador y símbolo, proporciones como entero seguido de `%`.
**Fórmula** · `nf(n) = round(n)` con miles · `cf(n) = símbolo + round(n)` con miles ·
`pf(n) = round(n × 100) + '%'`
**Unidad** · Las tres de la pantalla.
**Población** · Toda cifra publicada.
**Rastro** · `lib/aios/acquisition.js:41-43`.
**Estado** · Consistente con que todas las cifras de `build()` ya vienen redondeadas (`:88`, `:91`,
`:92`, `:94`, `:96`). **Lo que no es requisito es el `$` escrito a mano y el locale `es-MX` de
`cf`** (`:42`): la pantalla afirma pesos mexicanos sin que nadie lo haya declarado, y el resto del
sistema usa otros dos formatos para lo mismo — `en-US` para dinero y `es-PE` para conteos en
`lib/aios/executive.js:31-32`, `en-US` en `lib/aios/leads-group.js:11`. La moneda es **A2-P04**.

### A2-09 · Todo cociente sin denominador se dibuja «—», nunca 0 ni NaN

**Qué es** · Una cifra que no se puede calcular no se dibuja como cero.
**Fórmula** · `v ? cociente : '—'`
**Unidad** · Texto.
**Población** · Toda métrica derivada.
**Rastro** · `lib/aios/acquisition.js:171` (tasa de etapa), `:180` (% de calificados), `:181` («$Y
c/u» del bloque de calificados), `:190` (costo por etapa), `:201` (costo por calificado del embudo),
`:221` (tasa en la tabla), `:225` (costo por etapa en la tabla), `:235` (% calif.), `:236`
(costo/calif.).
**Estado** · Es la regla de los dos ceros dicha en código, y este departamento tiene **tres** ceros
incompatibles que se verían iguales: Meta nunca conectado (`closer_meta_metricas` con 0 filas), un
campo del CRM que nadie llenó («Porcentaje de Video Visto», 0 de 233) y una métrica sin denominador
(ventas por anuncio, con `negocio.resultados` sin ninguna venta) — regla 11 del §6.
**Huecos del prototipo:** se escapan **`g.cq`** (A2-15), que con cero calificados devuelve `0` y se
formatea como `$0` en vez de `—`, y la afinidad ICP (`:98`, `:111`), que devuelve `0` sin
denominador y se publica sin guarda en `:181` y `:237`.

---

## 2 · Los cinco KPI de cabecera

### A2-10 · La fila de cabecera son cinco tarjetas en orden fijo, y todas son sumas

**Qué es** · Arriba de todo van cinco KPI, siempre en este orden: **Inversión · Contactos · Clics a
landing VSL · Agendados · Calificados**. Cada tarjeta tiene cuatro partes: etiqueta, valor grande,
delta contra la ventana de comparación y un subtítulo gris.
**Fórmula** · Cada KPI es la suma de los tres embudos. **Ninguno es un promedio y ninguno es una
tasa.**
**Unidad** · Cuatro en volumen de contactos, uno en dinero.
**Población** · Los tres embudos sumados, en la ventana consultada.
**Rastro** · `lib/aios/acquisition.js:143-158`, el arreglo en `:145-151`; el gran total en `:114-120`.
**Estado** · La regla que justifica que sean sumas está escrita en pantalla y hay que conservarla
literalmente (`components/views/AcquisitionView.jsx:94-100`): «Los totales llegan hasta
**calificados**, que es donde termina la responsabilidad de pauta. Son volumen y dinero, no tasas:
sumar contactos de funnels distintos mide escala, no conversión.» Por eso `g` no lleva ninguna tasa
(`:114`).

### A2-11 · Inversión del periodo

**Qué es** · Cuánto se gastó en pauta en la ventana, sumando los tres embudos.
**Fórmula** · `inversión = Σ gasto(campaña, día)` para toda campaña y todo día de la ventana.
**Unidad** · Dinero.
**Población** · Las campañas activas en la ventana. **No es una población de personas**: de los cinco
KPI, es el único que no se abre en una lista de contactos (A2-45).
**Subtítulo** · «periodo seleccionado».
**Rastro** · `lib/aios/acquisition.js:146`; el cálculo por campaña en `:88`; la suma en `:117`.
**Estado** · **No existe, y es el «no» más importante del informe.** Una búsqueda de columnas en
`information_schema.columns` sobre `negocio`, `public` e `identidad` con el patrón
`spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl` devuelve **tres
coincidencias y ninguna es gasto de Meta poblado** (`01-ACQUISITION.md` §3.2). Tiene que venir del
API de Marketing de Meta, por anuncio/ad set/campaña y **por día** (§18.4). La tabla
`public.closer_meta_metricas` ya tiene la forma exacta (`nivel`, `objeto_id`, `padre_id`, `fecha`,
`gasto`, `impresiones`, `clics`, `cpl`…) y **0 filas**, y ninguna línea de este repositorio la toca:
conectar Meta es integración, no diseño de datos (§5.2).
**El prototipo lo hace al revés** · `inv = round(invD × días)` extrapola desde un gasto diario
constante. Es justo lo que un sistema real no puede hacer, y revela por contraste el requisito:
**la inversión de una ventana es una suma de días, no una extrapolación**.
**Defecto medido, y no es el que parece** · Como `inv` se calcula sin el modificador del periodo
(`:88`) mientras las entradas sí lo llevan (`:91`), con dos ventanas de igual duración la inversión
actual y la anterior son idénticas y el delta cae siempre en el `=` plano. Pero **no está muerto del
todo**: en modo «Otro periodo» con duraciones distintas sí dibuja una flecha, y esa flecha mide la
diferencia de días, no la de gasto. Es el peor de los dos casos.

### A2-12 · Contactos del periodo

**Qué es** · Cuánta gente entró por los tres caminos de adquisición en la ventana.
**Fórmula** · `contactos = Σ contactos(embudo)` sobre los tres embudos, donde cada embudo aporta el
volumen de **su primera etapa**.
**Unidad** · Contactos (entero).
**Población** · Los contactos cuya `alta_en_el_crm` cae dentro de la ventana. **No `creado_el`**: son
233 contra 256 en la ventana de 14 días, y los 23 de diferencia son latencia de ingesta (migración
048 §1, regla 6 del §6).
**Subtítulo** · «entradas de los 3 funnels» — dice explícitamente que son entradas de caminos
distintos.
**Rastro** · `lib/aios/acquisition.js:147`; la entrada de cada embudo en `:90-91`; la suma en `:117`.
**Estado** · **Ya está en la base.** 233 contactos en la ventana de referencia. Lo que no existe es
el corte en tres embudos con esos nombres (A2-16).
**El prototipo lo hace al revés** · `Math.max(1, round(entD × días × mod))`. El piso de 1 tapa un
dato: **un cero real es información** —una campaña apagada, un embudo sin tráfico— y la pantalla
tiene que poder mostrarlo. Con `base = 0` todas las barras quedan en 0 % (`:165`) y todas las tasas
caen al guion, que es el comportamiento correcto y el piso de 1 nunca deja ver.

### A2-13 · Clics a landing VSL

**Qué es** · Cuántos de los que entraron llegaron a la landing con la VSL. Es la etapa que lleva la
misma etiqueta en los tres embudos.
**Fórmula** · `clics = Σ clics(embudo)`, tolerando que un embudo no tenga la clave.
**Unidad** · Contactos (entero) — ver A2-19, que es lo que decide esto.
**Población** · El subconjunto de la cohorte de contactos que registró un clic a la landing dentro de
la ventana.
**Subtítulo** · «los 3 funnels».
**Rastro** · `lib/aios/acquisition.js:148`; la etapa declarada en `:7`, `:11`, `:15`; las etiquetas en
`:8`, `:12`, `:16`; la suma defensiva `(t.clics || 0)` en `:118`.
**Estado** · **Es la métrica que menos existe de todas.** No hay ninguna tabla de tráfico, sesiones ni
eventos de landing en `negocio.*` —21 tablas revisadas una por una— y **un clic no queda registrado
en ninguna parte de esta base** (`01-ACQUISITION.md` §5.3). El rastro de landing que hay son «Last
Landing URL» (99 de 233) y `atribucion_primera->>'url'` (55 de 233), que dicen dónde cayó quien **ya**
se convirtió en contacto, nunca cuántos la vieron. Tiene que venir de analítica de la landing (Meta
Pixel + Conversions API, GA4 o un endpoint propio), y los `link clicks` de Meta no son lo mismo: uno es lo que Meta dice que salió y el otro lo
que llegó. Es **A2-P05**.

### A2-14 · Agendados

**Qué es** · Cuánta gente de la cohorte sacó una cita. Es la última etapa de los tres embudos.
**Fórmula** · `agendados = Σ agendados(embudo)`
**Unidad** · Contactos (entero).
**Población** · Los contactos de la cohorte con **al menos una cita alcanzable** — el filtro
`ghl_calendario_id is not null`, el mismo que ya usa `lib/negocio/atribucionDelLead.ts:132-135`.
**Subtítulo** · «volumen total» — la advertencia de que no es una tasa.
**Rastro** · `lib/aios/acquisition.js:149`; la suma en `:117`.
**Estado** · **Ya está en la base, y hay que elegir cuál de dos cifras es.** El informe publica dos
que responden preguntas distintas: **163 citas alcanzables con `inicio_el` en los últimos 14 días,
sobre 149 contactos** (§4), y el reparto por anuncio de la cohorte, que sumado da **123 de los 233
contactos que agendaron** (48+47+20+6+1+1+0+0, §4). Para la cadena de este departamento manda la
segunda: la cohorte es el denominador y el numerador tiene que ser gente **de esa cohorte**, o el
embudo deja de cerrar. 123 de 233 es **52,8 %** de paso de contactos a agendados.

### A2-15 · Calificados, y su costo por calificado

**Qué es** · El quinto KPI trae dos cifras en una tarjeta: el conteo de calificados y, donde los otros
cuatro llevan una frase, el **costo por calificado global**.
**Fórmula** · `calificados = Σ calificados(embudo)` · `costo por calificado = inversión total /
calificados totales`
**Unidad** · Contactos (entero) y dinero.
**Población** · El subconjunto de los agendados que queda calificado (A2-20).
**Subtítulo** · `'$X por calificado'`.
**Rastro** · `lib/aios/acquisition.js:150`; el cociente en `:120`.
**Estado** · **Doble hueco.** El numerador es gasto, que no existe (A2-11); y «calificado» no está
definido en la base: `negocio.resultados` tiene 7 filas y ninguna venta, y el único puntaje
disponible es «Puntaje | ICP», poblado en **229 de 233** contactos de la ventana. El §18.6 lo lista
como dato que Acquisition **consume** de Business Intelligence, no que calcula. Es **A2-P01**.
**Requisito de forma que hay que conservar** · `g.cq` **no es el promedio** de los costos por
calificado de los tres embudos: es el cociente de los dos totales, que es lo único que un presupuesto
puede leer. Y se presenta **pegado al volumen que lo produce**, no como KPI propio.

---

## 3 · El modelo de embudo

### A2-16 · El sistema admite varios recorridos de entrada simultáneos, cada uno con sus etapas

**Qué es** · Un embudo es un recorrido con nombre, una lista ordenada de etapas, una etiqueta por
etapa y un nombre de costo por etapa. El número de embudos es una **dimensión**, no una constante:
todo el módulo itera las claves del diccionario.
**Unidad** · Conteo de entidades.
**Población** · Los recorridos de entrada declarados.
**Rastro** · `lib/aios/acquisition.js:5-18`; la iteración en `:102`, `:115`, `:162`, `:208`.
**Estado** · **Parcialmente, y con otra forma.** Medido sobre los 233 contactos,
`atribucion_primera->>'medium'` da tres valores que no son tres embudos: `facebook` 178, `calendar`
54, `External Form` 1. Cruzado con `sessionSource`: `facebook`+`Paid Social` **178 contactos, 176 con
`adId` (98,9 %)**, `calendar`+`Paid Social` **41 contactos, 41 con `campaignId`, 0 con `adId`**, y 14
sin pauta. Los caminos reales son **dos y medio** y ninguno se llama como los del prototipo.
**Andamiaje** · Que sean exactamente tres y que se llamen «Lead form ads», «Profile funnel» y
«Booking directo». De dónde sale la pertenencia de una campaña a un embudo es **A2-P06**.

### A2-17 · Las etapas de un embudo son una secuencia ORDENADA, y el orden es el cálculo

**Qué es** · El recorrido se guarda como secuencia por embudo, no como columnas fijas de una tabla.
**Fórmula** · No aplica: es la forma del dato.
**Unidad** · Lista de claves de etapa.
**Población** · Un embudo.
**Rastro** · `lib/aios/acquisition.js:7`, `:11`, `:15`. El orden entra en el cálculo tres veces: la
cadena se deriva contra `stages[k−1]` (`:92`), la tasa paso a paso contra `stages[i−1]` (`:168`) y la
acumulada contra `stages[0]` (`:163`, usada en `:168`).
**Estado** · Consecuencia dura: **un modelo con columnas `contactos/clics/agendados` no puede
representar la etapa `forms`**, que sólo tiene Booking directo (`:15-17`). Esa etapa es también la
que obliga a que el gran total no pueda ser la suma de columnas homogéneas (A2-25).

### A2-18 · La clave de la etapa es interna y estable; la etiqueta es un atributo del embudo

**Qué es** · La misma clave `contactos` se muestra como «Leads» en lead form, «DMs» en profile y
«Contactos» en booking; `agendados` se muestra como «Agendados» en dos y «Agendas» en el tercero.
**Unidad** · Texto.
**Población** · Un embudo.
**Rastro** · `lib/aios/acquisition.js:8`, `:12`, `:16`.
**Estado** · Detalle de forma con consecuencia: las etiquetas se usan **en minúsculas dentro de
frases** —«desde leads», «entra en dms»— en `:170-171` y `:196`, así que se guardan con caja de
título y se bajan al vuelo.

### A2-19 · Cada etapa se cuenta en CONTACTOS, no en eventos

**Qué es** · La unidad de todo volumen de Acquisition es la persona. Un contacto que hace tres clics
suma uno, y un contacto con dos citas suma uno.
**Unidad** · Contactos (entero).
**Población** · Un subconjunto de la cohorte de contactos de la ventana.
**Rastro** · Lo decide el propio prototipo en dos lugares, y no está dicho en ninguna frase: **cada
valor de etapa lleva `data-leads`** y por lo tanto abre una lista de contactos
(`lib/aios/acquisition.js:186-187` en la tarjeta, `:223-224` en la tabla); y **cada etapa se deriva
de la anterior** (`:92`), lo que sólo tiene sentido si las dos cuentan lo mismo.
**Estado** · Es el requisito que resuelve cómo medir «Clics a landing VSL»: tiene que ser un evento
**atribuible a un contacto conocido**, no tráfico anónimo, porque si no, no puede ser subconjunto de
los contactos ni abrir su lista. Y es el que separa las dos cifras de agendados de A2-14: 163 citas
es un conteo de eventos, 123 contactos es el conteo que la cadena necesita.

### A2-20 · `agendados` es obligatoria, es la última etapa que se tabula, y `calificados` cuelga de ella

**Qué es** · El departamento corta en calificados, y calificados se calcula **sobre agendados**, no
sobre contactos.
**Fórmula** · `calificados(campaña) = |agendados de esa campaña que quedan calificados|` — el
prototipo lo hace al revés y deriva el volumen de una tasa de entrada (`:94`, A2-23).
**Unidad** · Contactos (entero).
**Población** · Los agendados de esa campaña o embudo.
**Rastro** · `lib/aios/acquisition.js:94` (el cálculo), `:210` (el corte de la tabla,
`slice(0, indexOf('agendados') + 1)`), `:244` (la leyenda «hasta calificado»), `:180` (el texto dice
explícitamente «de <etiqueta de agendados>»), y el aviso de pantalla en
`components/views/AcquisitionView.jsx:94-100`.
**Estado** · Dos consecuencias medidas en el código. Primera: **`agendados` es obligatoria en todo
embudo**, porque el corte se hace buscándola por nombre y un embudo sin ella devolvería `slice(0,0)`,
o sea ninguna columna. Segunda: hoy el corte **no corta nada** —`agendados` es la última etapa de los
tres embudos (`:7`, `:11`, `:15`)—, así que es una defensa, no un filtro: lo que fija es que ninguna
etapa posterior a la cita entra en la tabla de Acquisition. Qué es un calificado es **A2-P01**.

### A2-21 · La campaña declara a qué embudo pertenece, y esa pertenencia determina su forma

**Qué es** · Cada campaña trae la clave de su embudo, y de ahí sale qué etapas tiene y en qué total
suma.
**Unidad** · Una clave.
**Población** · Una campaña.
**Rastro** · `lib/aios/acquisition.js:21`, `:23`, `:25`, `:27`, `:29`, `:31`, `:33`; usada en `:88`
(`FUNNELS[c.f]` decide las etapas) y `:103` (`rows.filter(r => r.f === k)` arma el total).
**Estado** · Dos campañas del mismo embudo tienen las mismas etapas y son comparables columna a
columna; campañas de embudos distintos no lo son. De dónde sale la pertenencia es **A2-P06**.

### A2-22 · Cuántas campañas alimentan un embudo

**Qué es** · Un conteo que aparece tres veces en pantalla: en el encabezado de la tarjeta («entra en
leads · 3 campañas»), en el resumen de la tabla plegada y en la fila de total.
**Fórmula** · `campañas(embudo) = |campañas con ese embudo y volumen en la ventana|`
**Unidad** · Conteo de entidades.
**Población** · Las campañas del embudo activas en la ventana.
**Rastro** · `lib/aios/acquisition.js:196`, `:229`, `:244`.
**Estado** · **Depende de qué es una fila**, y eso no está decidido: en la ventana hay **4
`campaignId` distintos, 1 solo id de ad set y 7 `adId` distintos** (`01-ACQUISITION.md` §4). Según se
elija, la tabla tiene 4, 1 o 7 filas — y con el piso de 10 contactos (A2-52) sólo **3 de los 7
anuncios** llegan a mostrar tasa. Es **A2-P07**.

---

## 4 · Los volúmenes

### A2-23 · Volumen de una etapa, por campaña

**Qué es** · Cuántos contactos de esa campaña llegaron a esa etapa dentro de la ventana.
**Fórmula real** · `v(campaña, etapa) = |contactos de la cohorte, de esa campaña, que registraron esa
etapa|`
**Unidad** · Contactos (entero).
**Población** · La cohorte de la ventana, filtrada por campaña.
**Rastro** · `lib/aios/acquisition.js:89-93`.
**Estado por etapa, medido** · `contactos` **sí** (233 con `alta_en_el_crm`); `forms` **no** (no hay
tabla de eventos de formulario; §18.6 pide «formularios iniciados» y «completados» y el rastro que
hay es la URL final, en «Last Landing URL» y en `atribucion_primera->>'url'`); `clics` **no** (A2-13); `agendados` **sí** (A2-14).
**El prototipo lo hace al revés, y es la inversión que hay que hacer al portarlo** · Acá la tasa es el
dato de entrada y el volumen se deriva (`o[stages[k]] = round(o[stages[k−1]] × tasa)`, `:92`). En el
sistema real **se cuentan los dos volúmenes por separado y la tasa es el cociente** — con la
consecuencia de que la cadena puede no cerrar, y eso hay que decidirlo, no forzarlo.

### A2-24 · Volumen de una etapa, por embudo

**Qué es** · La suma de sus campañas.
**Fórmula** · `v(embudo, etapa) = Σ v(campaña, etapa)` sobre las campañas del embudo.
**Unidad** · Contactos (entero).
**Población** · La cohorte de la ventana, filtrada por embudo.
**Rastro** · `lib/aios/acquisition.js:101-113`. El acumulador se inicializa recorriendo las etapas de
**ese** embudo (`:105`), así que cada embudo acumula exactamente las suyas y ninguna más.

### A2-25 · El gran total suma sólo las etapas que los tres embudos comparten

**Qué es** · El gran total lleva cinco campos: inversión, contactos, clics, agendados y calificados.
**`forms` no está.** La etapa exclusiva de Booking directo existe en su tarjeta y en su tabla y
desaparece del encabezado.
**Fórmula** · `granTotal(etapa) = Σ v(embudo, etapa)` sólo para las etapas comunes.
**Unidad** · Contactos (entero) y dinero.
**Población** · Los tres embudos sumados.
**Rastro** · `lib/aios/acquisition.js:114-119`.
**Estado** · **Hoy la decisión está tomada por omisión y hay que tomarla a propósito.** El
`(t.clics || 0)` de `:118` es defensivo y no protege de nada —los tres embudos tienen `clics`—: es
andamiaje que delata que el autor sabía que las etapas no son homogéneas, y **la protección que
faltaba era la de `forms`**, que no está. Qué pasa con las etapas exclusivas es **A2-P08**.

### A2-26 · La fila «Total del funnel» se dibuja siempre, abierta o cerrada la tabla

**Qué es** · El agregado del embudo es siempre visible; las campañas son el detalle opcional.
**Rastro** · `lib/aios/acquisition.js:246` (la llamada está **fuera** del condicional de apertura),
`:227-229` (los rótulos), `:39` (por omisión sólo el primer embudo está abierto).
**Estado** · La fila usa **exactamente la misma función** que las filas de campaña, o sea el total
pasa por el mismo formato, los mismos guardados y la misma barra de ICP: no hay un camino de cálculo
distinto para el agregado.

---

## 5 · Las tasas

### A2-27 · Toda etapa publica su tasa en dos lecturas, y las dos salen de la misma cadena

**Qué es** · Un segmentado «Tasa: Paso a paso / Acumulada» cambia el denominador de **toda** la
pantalla a la vez —tarjetas y tablas— sin guardar nada nuevo. Son dos derivaciones del mismo dato, no
dos métricas.
**Fórmula** · paso a paso: `v(etapa) / v(etapa anterior)` · acumulada: `v(etapa) / v(etapa de
entrada)`
**Unidad** · Proporción, redondeada a entero con `%`.
**Población** · El denominador es la población de la etapa que nombra: **la anterior** o **la de
entrada**.
**Rastro** · `lib/aios/acquisition.js:166-172` (tarjetas), `:219-221` (tablas), `:39` (por omisión
`step`); el control en `components/views/AcquisitionView.jsx:51-63`.
**Estado** · Es requisito de producto y no andamiaje: son dos preguntas distintas —dónde se cae y
cuánto queda— y la pantalla se niega a elegir una. Derivable hoy sólo para el paso
contactos→agendados: **123 de 233, 52,8 %** (A2-14).

### A2-28 · La tasa se escribe con el nombre de su denominador

**Qué es** · El texto no dice «38 %», dice **«38 % desde leads»** o **«12 % sobre leads»**. La
etiqueta cambia con el modo y nombra la base contra la que se calculó.
**Fórmula** · `pf(v/base) + (acumulada ? ' sobre ' + etiqueta(entrada) : ' desde ' + etiqueta(anterior))`
**Unidad** · Texto.
**Población** · La que nombra.
**Rastro** · `lib/aios/acquisition.js:169-171`.
**Estado** · Evita el defecto concreto de mostrar un 38 % sin decir 38 % de qué. La etapa de entrada
no lleva tasa: dice **«punto de entrada»** en la tarjeta (`:166`) y **«entrada»** en la tabla
(`:218`).

### A2-29 · Porcentaje de calificados sobre agendados

**Qué es** · Qué fracción de las citas de esa campaña queda calificada. Es la columna «% calif.» y la
primera cifra del bloque de calificados.
**Fórmula** · `% calif. = calificados / agendados`
**Unidad** · Proporción.
**Población** · **Los agendados**, nunca los contactos. Es lo que hace que sea comparable entre
campañas de embudos distintos.
**Rastro** · `lib/aios/acquisition.js:235` (columna de la tabla) y `:180` (línea del bloque de
calificados, que además escribe «de <etiqueta de agendados>»).
**Estado** · Calculable el día que «calificado» esté definido (**A2-P01**). El denominador ya existe.

### A2-30 · La barra de proporción de cada etapa se mide siempre contra la entrada, y NO cambia con el modo de tasa

**Qué es** · El ancho de la barra de una etapa es su porcentaje sobre la **etapa de entrada del
embudo**, pase lo que pase con el segmentado de tasa.
**Fórmula** · `ancho = v(etapa) / v(entrada) × 100`
**Unidad** · Proporción del ancho.
**Población** · La entrada del embudo.
**Rastro** · `lib/aios/acquisition.js:163` y `:165` (tarjeta), `:189` (la barra).
**Estado** · Decisión deliberada que conviene conservar y que es fácil romper al portar: **la forma
del embudo es una cosa y la lectura de la tasa es otra**. Si la barra siguiera al modo, «paso a paso»
dibujaría todas las etapas casi llenas y el embudo dejaría de parecer un embudo.

### A2-31 · El gran total no publica ninguna tasa

**Qué es** · Las cinco cifras de cabecera son volumen y dinero. No hay un «% de conversión global».
**Rastro** · `lib/aios/acquisition.js:114-120` (el objeto del gran total no tiene ningún cociente
salvo `cq`) y la nota de `components/views/AcquisitionView.jsx:94-100`.
**Estado** · Es el requisito que evita el peor gráfico posible de esta pantalla. Ver §9.

---

## 6 · El dinero

### A2-32 · La inversión es un atributo de la campaña en la ventana, y de ella cuelga TODO el dinero

**Qué es** · Hay un único origen de dinero en el departamento: la inversión por campaña y ventana.
Todos los costos son derivados de ella.
**Fórmula** · `inv(campaña, ventana) = Σ gasto(campaña, día)` · `inv(embudo) = Σ inv(campaña)`
**Unidad** · Dinero.
**Población** · Las campañas activas en la ventana.
**Rastro** · `lib/aios/acquisition.js:88` (se calcula una sola vez por campaña) y de ahí salen el
costo por etapa (`:190`, `:225`), el costo por calificado de la campaña (`:236`), el del embudo
(`:201`), el KPI de inversión y el costo por calificado global (`:120`).
**Estado** · No existe (A2-11). El grano exigido —campaña × día— es el mismo del §18.4 («las métricas
deben guardarse por fecha para permitir comparaciones históricas») y es lo que permite que cualquier
ventana se arme sumando en vez de extrapolando.
**Riesgo de portabilidad, escrito en el informe** · Si alguien reconstruye la pantalla leyendo
contactos reales y deja el costo saliendo del literal del prototipo, el resultado es **conteos
verdaderos con costos inventados — peor que la pantalla de hoy, porque hoy nadie puede confundirse**
(`01-ACQUISITION.md` §7).

### A2-33 · El costo de una etapa es la inversión ENTERA dividida por el volumen de esa etapa

**Qué es** · El costo por clic no es el gasto del paso contacto→clic sobre los clics: es **toda** la
inversión del embudo (o de la campaña) sobre los clics. Es un costo acumulado.
**Fórmula** · `costo(etapa) = inv / v(etapa)`
**Unidad** · Dinero por contacto.
**Población** · El denominador es la población de esa etapa; el numerador es la inversión completa de
la entidad.
**Rastro** · `lib/aios/acquisition.js:190` (tarjeta, numerador `t.inv` del embudo), `:225` (tabla,
numerador `r.inv` de la fila), `:201` y `:236` (costo por calificado).
**Estado** · Hay que decirlo porque se malinterpreta solo: **el costo crece monótonamente a lo largo
de la cadena** —el costo por agendado siempre es mayor que el costo por clic, que siempre es mayor
que el CPL— y eso es correcto, no un error. Es el mismo criterio que usa Executive para el costo
unitario de cada etapa del funnel del negocio (`lib/aios/executive.js:52`). Si es la lectura que se
quiere, o si cada etapa lleva un costo propio, es **A2-P09**.

### A2-34 · Cada etapa de cada embudo publica su costo unitario con nombre propio

**Qué es** · Siete nombres de costo, y el vocabulario depende del embudo: el mismo paso es **CPL** en
lead form y **C/DM** en profile.
**Unidad** · Texto (el nombre) y dinero (el valor).
**Población** · Una etapa de un embudo.
**Rastro** · `lib/aios/acquisition.js:9`, `:13`, `:17`. Los siete: `CPL`, `C/DM`, `C/contacto`,
`C/form`, `C/clic`, `C/agendado`, `C/agenda`. Se renderiza en `:190` y la tabla lo repite en `:225`.
**Estado** · Los siete cuelgan del gasto: **imposible hoy**.

### A2-35 · Costo por calificado, en tres niveles

**Qué es** · La cifra que la pantalla marca como la importante. Aparece como columna de tabla, como
estadística del encabezado de embudo y como subtítulo del KPI de calificados.
**Fórmula** · `costo/calif.(campaña) = inv(campaña) / calificados(campaña)` ·
`costo/calif.(embudo) = inv(embudo) / calificados(embudo)` ·
`costo/calif.(total) = inv total / calificados totales`
**Unidad** · Dinero por contacto.
**Población** · Los calificados de esa entidad.
**Rastro** · `lib/aios/acquisition.js:236` (campaña), `:201` (embudo), `:120` (total), `:181` (la
línea «$Y c/u» del bloque de calificados).
**Estado** · Incalculable hoy, por los dos lados (A2-11 y A2-P01). **Es la métrica que el plan de
acción usa como criterio de escala** —«Deja de escalar Prospecting B por costo por contacto: su costo
por calificado es el más alto» (`lib/aios/acquisition-plan.js:16`)—, o sea que la regla de negocio de
toda la pantalla es: **la decisión de escala se toma por costo por calificado, no por costo por
contacto**. Es también el eje del conflicto que Executive publica en nombre de los dos departamentos
(`lib/aios/executive-panel.js:12-16`).

---

## 7 · La calidad: ICP

### A2-36 · Los calificados se parten en tres tramos de afinidad, y los tres suman exactamente los calificados

**Qué es** · El reparto de los calificados en tramo alto, medio y bajo. La suma de los tres **es** el
total de calificados, por construcción: los dos primeros se calculan con su proporción y el tercero
es el **residuo**.
**Fórmula** · `alto = round(q × pA)` · `medio = round(q × pM)` · `bajo = max(0, q − alto − medio)`
**Unidad** · Contactos (entero).
**Población** · Los calificados de esa campaña o embudo.
**Rastro** · `lib/aios/acquisition.js:96-97`.
**Estado** · El invariante está bien resuelto en el prototipo y **cualquier implementación real tiene
que preservarlo**: con tres redondeos independientes, una campaña con 7 calificados muestra 8 en la
barra. El dato de origen existe y es mejor que el inventado —«Puntaje | ICP», tipo `NUMERICAL`,
poblado en **229 de 233** contactos— pero **viene continuo y los cortes de tramo no están declarados
en ninguna parte de Acquisition**. Los únicos cortes escritos en el sistema son los del cajón de
contactos: `≥ 75` alto, `≥ 50` medio, resto bajo (`lib/aios/leads-group.js:10`). Es **A2-P02**.

### A2-37 · La barra de ICP se normaliza sobre sí misma, así que siempre llena el ancho

**Qué es** · Los tres anchos son proporción de la suma de los tres tramos, no de los calificados del
embudo ni de ninguna otra base.
**Fórmula** · `ancho(n) = t ? n/t × 100 : 0`, con `t = alto + medio + bajo`
**Unidad** · Proporción del ancho.
**Población** · Los tres tramos.
**Rastro** · `lib/aios/acquisition.js:136-141`, usada en `:182` (tarjeta) y `:238` (tabla).
**Estado** · En el prototipo las dos bases coinciden por el invariante de A2-36, pero la función se
protege sola: con cero calificados la barra queda vacía en vez de romperse. **La barra es comparable
entre filas porque siempre suma 100 %**, con el mismo ancho relativo y distinto ancho físico en la
tarjeta y en la celda.

### A2-38 · Afinidad ICP: un escalar por campaña y por embudo, comparable entre filas

**Qué es** · Un número único de calidad de lead, que es lo que permite ordenar campañas por calidad y
no sólo por volumen o costo. Se lee como «ICP 62 %» en la tarjeta y como columna «Afinidad ICP» en la
tabla.
**Fórmula (prototipo)** · `icp = (alto×100 + medio×60 + bajo×25) / calificados`
**Unidad** · Proporción, entera.
**Población** · Los calificados de esa campaña o embudo. Sin calificados el valor es `0`, no `NaN`.
**Rastro** · `lib/aios/acquisition.js:98` (campaña) y `:111` (embudo); mostrado en `:181` y `:237`.
**Estado** · **Reemplazable hoy y con mejor dato.** El puntaje viene continuo y promediarlo directo no
necesita inventar cortes ni pesos. Promedio real por nombre de anuncio, medido: «Evoluciona native»
**73,9** (31 contactos), «agendamiento - yaping - 23/07» 68,6 (8), «link_in_bio» 57,0 (3), «El app»
45,8 (46), «agendamiento - yaping» 42,1 (109) y «economia us latino» **27,5** (19)
(`01-ACQUISITION.md` §3.5).
**Andamiaje con un defecto que nadie pidió** · Los pesos 100/60/25 imponen un **piso de 25 %**: una
campaña con todos sus calificados en el tramo bajo da 25 %, nunca 0 %, así que la columna va de 25 a
100 y no de 0 a 100. Si la afinidad se publica como ponderado de tramos o como promedio del puntaje
—que son dos cifras distintas para la misma columna— es **A2-P03**.

### A2-39 · La afinidad del embudo se RECALCULA sobre los tramos agregados; no es el promedio de sus campañas

**Qué es** · Los volúmenes se suman; la afinidad se vuelve a calcular con la misma fórmula sobre los
tramos ya sumados.
**Fórmula** · `icp(embudo) = (Σalto×100 + Σmedio×60 + Σbajo×25) / Σcalificados`
**Unidad** · Proporción.
**Población** · Los calificados del embudo entero.
**Rastro** · `lib/aios/acquisition.js:111`, contra las sumas de `:106-110`.
**Estado** · **Es la distinción que salva la pantalla de una cifra falsa.** Un promedio de promedios
le daría a una campaña de 3 calificados el mismo peso que a una de 300. La regla vale para cualquier
métrica de calidad que se agregue: **se agregan las poblaciones, no los porcentajes**.

---

## 8 · La comparación

### A2-40 · Toda cifra comparable publica su variación relativa contra la ventana anterior

**Qué es** · Una sola regla produce todas las flechas de la pantalla, en **ocho** puntos de llamada.
No es un cálculo repetido en cada render.
**Fórmula** · `d = (actual − anterior) / anterior` → `'▲|▼ ' + round(|d| × 100) + '%'`
**Unidad** · Proporción de cambio, entera.
**Población** · La misma métrica en las dos ventanas.
**Rastro** · `lib/aios/acquisition.js:124-134`. Las ocho llamadas: `:146`, `:147`, `:148`, `:149`,
`:150` (los cinco KPI), `:179` (calificados de la tarjeta), `:188` (cada etapa de la tarjeta), `:234`
(calificados de la fila de tabla).
**Estado** · Se publica como **porcentaje de cambio, no como diferencia absoluta**. El signo va en la
flecha y el valor siempre en absoluto, así que nunca aparece un «▼ −18 %» que se lea dos veces
negativo. La variación de volumen se puede medir; contra qué, hoy no hay (A2-01).
**Corrección al inventario recibido** · Son **ocho** llamadas, no nueve. Verificado con
`grep -n "delta(" lib/aios/acquisition.js`.

### A2-41 · Por debajo de 0,5 % de variación se dibuja «=» y no una dirección

**Qué es** · Un umbral de planicie, comparado **antes** de redondear.
**Fórmula** · `si |d| < 0,005 → '='`
**Unidad** · Proporción.
**Rastro** · `lib/aios/acquisition.js:130`.
**Estado** · Evita el defecto concreto de que el ruido de redondeo de volúmenes enteros pinte
flechas: **con 233 contactos, un contacto de diferencia es 0,43 %** y se dibujaría como una
tendencia. Consecuencia deliberada: un 0,4 % sale `=` y un 0,6 % sale «▲ 1 %» — el salto de la
etiqueta es más grande que el salto del dato.

### A2-42 · La dirección y la bondad del movimiento son dos ejes independientes

**Qué es** · La **flecha** depende de si el movimiento es hacia arriba; el **color** depende de si el
movimiento es bueno. Esa separación es la que permite dibujar «▲ 12 %» en rojo para un costo por
calificado que subió.
**Fórmula** · `bueno = invertida ? d < 0 : d > 0`
**Rastro** · `lib/aios/acquisition.js:129`.
**Estado** · **La forma está y no se ejerce: las ocho llamadas pasan `false`.** Hoy no hay ni una
métrica invertida en pantalla, aunque el costo por calificado, el CPL y el costo por clic son
exactamente el caso para el que se escribió el parámetro. Y una de las ocho es un error de lectura
que hay que resolver antes de portar: **la Inversión (`:146`) se dibuja en verde cuando sube**.
Gastar más no es bueno por sí mismo —es neutro— y el §18.10 prohíbe explícitamente recomendar
escalar presupuesto en solitario. Qué métricas llevan la marca es **A2-P10**.

### A2-43 · «Hoy» e «Histórico» no comparan contra nada, y la pantalla lo dice

**Qué es** · Con el histórico no hay un histórico anterior, y con el día en curso comparar un día a
medias contra un día entero produce una caída que es la hora del reloj. La regla devuelve vacío
**antes** de cualquier otra cosa, así que ninguna de las ocho llamadas puede saltársela.
**Fórmula** · `si periodo ∈ {histórico, hoy} → sin comparación`
**Rastro** · `lib/aios/acquisition.js:125`. La misma regla vive en Executive
(`lib/aios/executive.js:58`), así que es del sistema y no de la pantalla.
**Defecto real y comprobable** · La regla vive en un lugar y **el texto que la acompaña está escrito a
mano en dos más** (`:270` y `:282`), y en los dos dice `'histórico · sin comparación'` — **incluso
cuando el periodo es «Hoy»**, que no es el histórico.

### A2-44 · Sin ventana anterior no hay delta, y el hueco se dice en palabras

**Qué es** · Si la cifra de comparación es cero o falta, no hay variación relativa que publicar: la
respuesta correcta es no dibujar nada en vez de dibujar un infinito o un 100 %. Y donde el hueco es
visible, se **escribe**: «sin comparación».
**Fórmula** · `si !anterior → ''` · el llamador escribe `delta(...) || 'sin comparación'`
**Rastro** · `lib/aios/acquisition.js:126`, `:128` (el `isFinite` como segundo cinturón) y `:234` (el
único punto que llena el hueco con texto).
**Estado** · **Esto va a pasar todo el tiempo al principio** (A2-03: 3 contactos contra 0). Y hay dos
cosas mal en el prototipo que hay que corregir al portarlo. Primera: el guardado se pasa de largo —
mata el delta también cuando el valor **actual** es cero y el anterior no, así que **una campaña que
pasó de 40 agendados a 0 se dibuja como «sin comparación»**, que es exactamente el caso donde más
hace falta la flecha (**A2-P11**). La forma correcta ya está implementada en el mismo sistema:
Executive se guarda **sólo contra el denominador** (`if(... || !before) return ''`,
`lib/aios/executive.js:58`). Segunda: los otros siete puntos de llamada (`:146-150`, `:179`,
`:188`) dejan el espacio **vacío**, que se lee como «no hay cambio» cuando significa «no hay con qué
comparar» — la misma confusión entre los dos ceros que la regla 11 del §6 obliga a distinguir.

---

## 9 · Cada cifra abre su población

### A2-45 · Un volumen de Acquisition tiene que poder abrir la lista de contactos que lo compone

**Qué es** · Cualquier cifra de volumen lleva sus atributos y un clic abre el cajón de contactos:
**título**, **conteo** y **línea de contexto** —el tramo de ICP sólo donde lo hay (A2-47). El
escuchador es un delegado en el documento, o sea que el contrato vale para cualquier cifra de
cualquier pantalla.
**Rastro** · `lib/aios/acquisition.js:153-154` (KPI), `:177-178` (calificados de la tarjeta),
`:186-187` (cada etapa de la tarjeta), `:223-224` (cada celda de etapa de la tabla), `:231-232`
(calificados de la fila); el escuchador en `lib/aios/leads-group.js:79-85`.
**Estado** · Requisito duro: **ningún volumen de Acquisition puede ser un número sin lista detrás**.
Lo que el prototipo **no** pasa es un filtro: manda un número y un segmento, no la cohorte. **Un
sistema real tiene que mandar qué contactos son, no cuántos.** Los valores de contexto que emite hoy
son tres: `'Acquisition · los 3 funnels'` (KPI), `'Acquisition · <nombre del embudo>'` (tarjeta) y
`'Acquisition'` a secas (tabla).

### A2-46 · La inversión es el único KPI que no se abre en personas

**Qué es** · Los cinco KPI llevan drill-down menos Inversión, y los costos tampoco lo llevan en
ninguna parte.
**Rastro** · `lib/aios/acquisition.js:146` (quinto campo `0`) contra `:153`, que sólo emite los
atributos cuando ese campo es distinto de cero.
**Estado** · Está bien y hay que conservarlo: **el dinero no se explica con una lista de contactos**.

### A2-47 · Los calificados se abren filtrados al tramo alto de ICP

**Qué es** · Las tres cifras de calificados —KPI, tarjeta y fila de tabla— son las únicas que llevan
el tramo con el que preseleccionar, y en las tres es `alto`.
**Rastro** · `lib/aios/acquisition.js:150`, `:178`, `:232`; el corte en `lib/aios/leads-group.js:10`.
**Estado** · **El filtro fijo choca con la propia pantalla**: la misma cifra que se abre sólo en tramo
alto está dibujada al lado de una barra que la reparte en **tres** tramos. O «calificado» significa
«ICP ≥ 75» —y entonces la barra de tres tramos no describe a los calificados— o son dos cosas
distintas y el filtro está mal. El prototipo no lo decide: entra en **A2-P01** y **A2-P02**.

---

## 10 · Las dimensiones por las que toda métrica tiene que poder cortarse

### A2-48 · Las cinco dimensiones que el prototipo implementa

| Dimensión | Cardinalidad medida en la ventana | Rastro | Estado |
|---|---|---|---|
| **Embudo** | 3 en el prototipo; 2½ caminos reales (`facebook` 178, `calendar` 54, `External Form` 1) | `acquisition.js:5-18`, `:21-33` | Parcial; la definición es **A2-P06** |
| **Campaña** | 7 inventadas; **4 `campaignId`** reales | `acquisition.js:20-35`, `:103` | El inventario existe, su economía no |
| **Etapa** | 3 o 4 según embudo | `acquisition.js:7, :11, :15` | 2 de 4 etapas medibles |
| **Tramo de ICP** | 3 | `acquisition.js:96-97`, `:136-141` | Puntaje continuo en 229 de 233; cortes sin declarar |
| **Tiempo** | Ventana de N días, con ventana de comparación | `acquisition.js:59-83` | Cohorte por `alta_en_el_crm`; sin historia previa |

### A2-49 · La clave de una campaña es su identificador, nunca su nombre

**Qué es** · El prototipo identifica la campaña por el texto de su nombre, y eso no se puede portar.
**Rastro** · `lib/aios/acquisition.js:21-33` (el campo `n` es la clave de hecho: `:228` lo muestra,
`:223` y `:231` lo mandan al cajón de contactos).
**Estado** · **Medido en contra.** «El app» tiene **dos `adId` distintos** (`…550467` con 44 contactos
y `…700467` con 2) y «economia us latino» otros dos (`…570467` con 17 y `…690467` con 2): son los
mismos creativos relanzados en la campaña nueva del 12 de septiembre. Agrupar por nombre **fusiona
anuncios de campañas distintas y borra el arranque de la campaña nueva**, que es precisamente lo que
un media buyer necesita ver (regla 1 del §6). Dos reglas más van con ésta: **normalizar la caja antes
de agrupar y mostrar una variante tal cual vino** (regla 3, ya aplicada en
`lib/negocio/atribucionDelLead.ts:124-127`), y **descartar las etiquetas sin renderizar**: dos
contactos de la ventana traen literalmente `{{campaign.id}}` (regla 4).

### A2-50 · Las dimensiones que el prototipo insinúa y no implementa

Ninguna de estas es una métrica nueva: son **cortes** por los que las métricas de §2 a §7 tienen que
poder mirarse. Cada una tiene su rastro en el prototipo, que es lo que las hace requisito y no
ocurrencia.

| Dimensión | Dónde está insinuada | Estado |
|---|---|---|
| **Anuncio** (`meta_ad_id`) | El cajón de contactos escribe el origen como «Campaña · Creative» (`leads-group.js:15-28`); la ficha por contacto de Leads Portal lista «Creative» (`leads-portal.js:265-272`) | `adId` en **176 de 233 (75,5 %)**; 7 anuncios distintos. Es la clave que el §18.5 manda usar |
| **Ad set / Conjunto** | «Conjunto» en la ficha por contacto (`leads-portal.js:265-272`) | **Sólo por nombre.** El id existe en 39 de 233 y es **un solo ad set**; el nombre en 222 de 233, y viene en la clave `utmMedium`, que dice «medio» y contiene «Advantage+ ON / America Hispano / 25-65» (regla 2 del §6) |
| **Creativo** | «Creative» en la ficha y en el origen del cajón | No existe `meta_creative_id` en ninguna tabla |
| **Público / audiencia** | El nombre inventado «Público frío» (`acquisition.js:31`) y «Objetivo» en la ficha | No existe. §18.4 lo pide |
| **Plataforma** | `'Activa · Meta'` bajo cada fila de campaña (`acquisition.js:229`) | No existe como columna |
| **Estado de entrega** | La otra mitad de ese mismo literal | **No existe, y su ausencia es un detector perdido**: una campaña pausada se dibuja hoy exactamente igual que una activa, con sus cifras congeladas y sin marca. Es el detector «anuncios sin entrega» del §18.13 |
| **Ubicación y posición** | «Ubicación», «Posición» en la ficha por contacto | No existen |
| **Dispositivo** | «Dispositivo» en la ficha; el hallazgo que Conversion le manda trae `dev:'Todos'` (`conversion.js:64`) | No existe en Acquisition |
| **Landing / punto de captura** | «Punto de captura» en la ficha; la etapa «Clics a landing VSL» | 11 landings distintas medibles desde «Last Landing URL» (99 de 233). **Ojo: no se renderizan crudas** — seis valores son JWT con `contact_id` adentro (§7) |

### A2-51 · La fila «sin anuncio» se cuenta pero no compite

**Qué es** · Una fila que aporta su conteo a la cohorte y **no publica tasa**, porque junta categorías
distintas.
**Unidad** · Contactos (entero), con la tasa explícitamente ausente.
**Población** · Los contactos de la cohorte sin identificador de anuncio.
**Rastro** · El prototipo **no la tiene**: sus siete campañas cubren el 100 % de los contactos, y ni
la tarjeta de embudo ni la tabla prevén una fila que se cuente y no compita. El criterio ya está
escrito en el sistema: `lib/negocio/atribucionDelLead.ts:179-183`, con su motivo.
**Estado** · **Es la regla más importante de este departamento y está medida.** Los **57 contactos sin
`adId` agendan 47 veces, 82,5 %** — la tasa más alta de toda la tabla, contra el 44,0 % (48 de 109)
del anuncio de mayor volumen. Dibujada como una barra al lado de las demás, esa fila dice que **el
mejor anuncio es ninguno**. Lo que pasa en realidad es que son en su mayoría los 41 contactos de la
campaña BOFU de retargeting, gente que ya conocía la oferta y entró directo al calendario: el widget
de calendario no pasa el `adId`. Dónde se dibuja esa fila es **A2-P12**.

### A2-52 · Con menos de diez contactos se publica el conteo y no la tasa

**Qué es** · El piso del sistema para mostrar una proporción.
**Rastro** · `PISO_DE_UNA_TASA = 10` y `DIAS_DE_LA_TASA = 14` en
`lib/negocio/indicadoresDeCitas.ts:300` y `:310`.
**Estado** · **El efecto sobre esta pantalla es severo y hay que aceptarlo**: de los 7 anuncios de la
ventana **sólo 3 llegan al piso** (109, 44 y 17 contactos); los otros cuatro tienen 1 o 2. La tabla
real es de tres filas y una fila «Otras», no de siete (regla 5 del §6). El prototipo no tiene piso
—dibuja tasa para las siete campañas siempre— así que esto es un requisito que entra al portar, no
uno que se conserve. Si el piso apaga la tasa o apaga la fila es **A2-P13**.

---

## 11 · Qué NO es una métrica de Acquisition, aunque aparezca en su pantalla o en su nombre

Cada línea tiene su rastro y su motivo. El motivo nunca es «no nos toca»: es que la cifra se calcula
con datos que este departamento no mide, o que su lectura correcta exige un cruce que le está
prohibido.

1. **ROAS, CAC real y revenue.** El §18.6 y el §18.8 se lo prohíben, y la pantalla del jefe lo
   respeta en el código: Executive **no le pide un ROAS a Acquisition, le pide el gasto**, y con él
   construye el ROAS (`lib/aios/executive.js:116`), el costo por venta (`:125`), el margen sobre ads
   (`:96`) y el costo unitario de cada etapa del funnel del negocio (`:52`). Acquisition entrega el
   insumo crudo; el cruce es de otro.

2. **Ticket promedio y margen sobre ads.** Mismo lugar, mismo motivo (`lib/aios/executive.js:95-96`).

3. **Cualquier tasa del gran total.** El objeto del gran total no lleva ningún cociente salvo el costo
   por calificado (`lib/aios/acquisition.js:114-120`), y la nota de pantalla lo explica: **sumar
   contactos de funnels distintos mide escala, no conversión**
   (`components/views/AcquisitionView.jsx:94-100`).

4. **Citas asistidas, ventas y tasa de cierre.** Son de Sales en el funnel del negocio
   (`lib/aios/executive.js:27-28`), y Acquisition corta en calificados por tres rastros distintos:
   el corte de la tabla (`:210`), la leyenda «hasta calificado» (`:244`) y la nota de pantalla.

5. **Visitas a la landing.** Executive se las asigna a **Conversion**
   (`lib/aios/executive.js:25`). Acquisition mide el **clic** —lo que Meta entrega— y Conversion la
   **visita** —lo que llegó—. Son dos cifras distintas con dos dueños distintos, y confundirlas es lo
   que hace que «Clics a landing VSL» parezca resuelto cuando no lo está.

6. **La fuga entre formulario y landing.** El propio plan de acción la deriva: «La fuga de formulario
   a landing pertenece a **Conversion**» (`lib/aios/acquisition-plan.js:26`). Nótese que la señal 2 de
   la pantalla la reporta como propia (`AcquisitionView.jsx:126-141`): la pantalla se contradice
   consigo misma.

7. **La definición de «calificado» y el puntaje ICP de un contacto.** El §18.6 lista «ICP promedio por
   anuncio» como dato que Acquisition **consume**, y el puntaje lo calcula el CRM («Puntaje | ICP»,
   229 de 233). Acquisition **agrega** ese puntaje por campaña y por embudo (A2-38); no lo define ni
   lo calcula por persona. Los cortes de tramo tampoco son suyos hoy: viven en
   `lib/aios/leads-group.js:10`.

8. **El cruce de campaña contra ventas.** Dos pantallas lo declaran desde los dos lados —«Qué
   campañas traen ICP alto se decide en Acquisition» (`lib/aios/period-controls.js:56`) y «Entrego a
   Acquisition qué campañas traen el ICP que cierra» (`lib/aios/executive.js:201`)— y **la mitad que
   falta es la de ventas**: `negocio.resultados` tiene 7 filas y ninguna es una venta. Acquisition
   recibe ese cruce, no lo produce.

9. **La tasa de la fila «sin anuncio».** Es un conteo, no una tasa, y el motivo está escrito (A2-51).

10. **El estado `warn` del departamento y el «2 a revisar» del organigrama.** Son un **resumen**, no
    una métrica: `lib/aios/executive.js:178` y `components/views/ExecutiveView.jsx:236-247`. No hay
    ningún umbral escrito que convierta hallazgos abiertos en un color ni en un conteo. Es
    **A2-P14**.

11. **Lo que el §18.7 pide y esta pantalla no dibuja.** CTR, link CTR, CPC, CPM, alcance, frecuencia,
    impresiones, `landing page view rate`, métricas de video y retención, `hook retention proxy` y
    tendencia de fatiga **son de Acquisition según el documento y no están en el prototipo**. No
    entran a este catálogo porque este catálogo sale del prototipo; entran cuando haya una fuente de
    Meta. Se dicen acá para que su ausencia sea una decisión y no un olvido.

---

## 12 · Preguntas abiertas

Ninguna de estas se puede contestar leyendo el prototipo. Están numeradas para poder citarlas.

**A2-P01 · Qué es un «calificado».** Cierra toda la pantalla —KPI, encabezado de embudo, bloque bajo
agendados, dos columnas de la tabla y el umbral de $110 del plan— y el prototipo lo fabrica como una
tasa sobre agendados (`acquisition.js:94`) mientras lo abre filtrado a ICP alto (`:150`). En la base
no hay marca de calificación: hay un puntaje continuo en 229 de 233 y cero ventas contra las cuales
validarlo. ¿Es un corte del puntaje ICP, una salida de `negocio.resultados`, o una marca que pone el
setter?

**A2-P02 · Dónde cortan los tramos de ICP, y si siguen siendo tres.** La forma es requisito
(`acquisition.js:96-98`) y el puntaje viene continuo: por anuncio va de 27,5 a 73,9. Los cortes
75/50 existen pero en otra pantalla (`leads-group.js:10`) y adoptarlos los convierte en una
definición de negocio de Acquisition.

**A2-P03 · Si la afinidad se publica como ponderado de tramos o como promedio del puntaje.** Son dos
cifras distintas para la misma columna, y la primera impone un piso de 25 % que nadie pidió.

**A2-P04 · Qué moneda.** `cf` antepone un `$` escrito a mano y formatea en `es-MX`
(`acquisition.js:42`); el plan fija «$110» (`acquisition-plan.js:21`); Executive usa `en-US` para
dinero y `es-PE` para conteos (`executive.js:31-32`). Meta entrega el gasto en la moneda de la cuenta
publicitaria, que no está declarada en ninguna parte.

**A2-P05 · De dónde sale «Clics a landing VSL».** ¿`link clicks` de Meta —que es un clic en el
anuncio, no una vista de la página—, instrumentación de la landing, o la etapa desaparece del embudo?
Y sea cual sea, A2-19 exige que se pueda atribuir a un contacto.

**A2-P06 · Qué define un embudo y de dónde sale la pertenencia de una campaña.** ¿El objetivo de la
campaña en Meta, el `mediumId` del formulario o calendario de GHL, o un mapeo a mano que alguien
mantiene?

**A2-P07 · Qué es una fila de la tabla.** Campaña, ad set o anuncio: en la ventana hay 4, 1 y 7. De
eso depende el conteo de A2-22 y cuántas filas sobreviven al piso de A2-52.

**A2-P08 · Si el gran total suma las etapas exclusivas de un embudo.** Hoy `forms` desaparece del
encabezado por omisión (`acquisition.js:114`).

**A2-P09 · Si el costo por etapa comparte numerador.** Hoy los siete costos son «inversión entera ÷
volumen de esa etapa» (`:190`), que responde «cuánto me costó cada uno de los que llegaron hasta
acá», no «cuánto cuesta el paso».

**A2-P10 · Qué métricas llevan la marca de «bajar es bueno».** El parámetro existe (`:129`) y las
ocho llamadas pasan `false`. Costo por calificado, CPL y costo por clic son los tres casos. Y hay que
decidir qué hace la Inversión, que hoy sale en verde cuando sube.

**A2-P11 · Qué hace la comparación cuando el valor actual es cero.** Hoy devuelve vacío (`:126`), o
sea que una caída a cero se dibuja «sin comparación».

**A2-P12 · Dónde va la fila «sin anuncio».** ¿Fila sin barra, nota al pie, o bloque propio fuera del
ranking? Son 57 contactos de 233 con la tasa más alta de la ventana.

**A2-P13 · Si el piso de 10 apaga la tasa o apaga la fila.** Con «Hoy» casi ningún anuncio llega al
piso.

**A2-P14 · Qué convierte los hallazgos abiertos en el color y el conteo del departamento.** Executive
publica los dos y no dice el umbral.

**A2-P15 · En qué zona horaria se cortan los días.** `shift` (`acquisition.js:53-57`) parsea en UTC,
opera en hora local y serializa en UTC: un cruce de horario de verano corre la ventana un día. La
ventana tiene que calcularse en una zona **declarada**, no en la del navegador de quien mira.

**A2-P16 · Qué control de rango manda.** La píldora del calendario y la barra de dos pares de fechas
conviven y **sólo la segunda mueve los números**: el callback guarda el rango elegido en el estado
(`acquisition.js:268`) y **nadie lo lee nunca** — `windows()` sigue leyendo los campos de fecha del
documento (`:68`, `:74`). Al lado, `lib/aios/period-controls.js:33` escucha un `#acqCustomBtn` que no
existe en ningún archivo del repositorio ni en el maquetado original: verificado con un `grep` sobre
todo el repo, las únicas apariciones en código son ese `getElementById` y el del HTML original.
Hay **un** periodo por pantalla y tiene que tener **un** dueño.

**A2-P17 · Si Acquisition publica su propia calidad de atribución, y dónde.** El §18.14 la pide y el
prototipo no la dibuja en ninguna parte: no hay KPI ni renglón de «% de contactos con `meta_ad_id`».
Medido: **176 de 233 (75,5 %)** sobre la cohorte, **176 de 219 (80,4 %)** sobre los contactos de
pauta, y **82 de 163 citas (50,3 %)**. Sin ese renglón, toda la pantalla se lee como si cubriera el
100 %. (El §18.17 escribe «91 %»: es un ejemplo del documento, no una medición.)

---

## 13 · Índice del catálogo

Las cifras que Acquisition tiene que poder dar, con su estado. **Unidad**: C = contactos,
$ = dinero, % = proporción, N = conteo de entidades.

| # | Métrica | Fórmula | U | Población | Estado |
|---|---|---|---|---|---|
| A2-11 | Inversión del periodo | Σ gasto(campaña, día) | $ | Campañas de la ventana | **No existe** · Meta API |
| A2-12 | Contactos | Σ entrada(embudo) | C | Cohorte por `alta_en_el_crm` | **Ya está** · 233 |
| A2-13 | Clics a landing VSL | Σ clics(embudo) | C | Cohorte con clic a landing | **No existe** · analítica de landing |
| A2-14 | Agendados | Σ agendados(embudo) | C | Cohorte con cita alcanzable | **Ya está** · 123 de 233 |
| A2-15 | Calificados | Σ calificados(embudo) | C | Agendados que califican | **No existe** · sin definición |
| A2-15 | Costo por calificado global | inv total / calificados totales | $ | Calificados de los 3 embudos | **No existe** · doble hueco |
| A2-23 | Volumen de etapa, por campaña | conteo de contactos en la etapa | C | Cohorte × campaña × etapa | 2 de 4 etapas |
| A2-24 | Volumen de etapa, por embudo | Σ sobre campañas | C | Cohorte × embudo × etapa | 2 de 4 etapas |
| A2-27 | Tasa paso a paso | v(etapa) / v(etapa anterior) | % | La etapa anterior | Sólo contactos→agendados: 52,8 % |
| A2-27 | Tasa acumulada | v(etapa) / v(entrada) | % | La etapa de entrada | Ídem |
| A2-29 | % de calificados | calificados / agendados | % | **Agendados** | Falta el numerador |
| A2-32 | Inversión por campaña / embudo | Σ gasto por día | $ | Campañas de la ventana | **No existe** |
| A2-33 | Costo unitario de etapa | inv / v(etapa) | $ | Denominador: la etapa | **No existe** |
| A2-35 | Costo por calificado | inv / calificados | $ | Calificados de la entidad | **No existe** |
| A2-36 | Reparto en tramos de ICP | alto, medio, residuo | C | Calificados | Puntaje en 229 de 233, cortes sin declarar |
| A2-38 | Afinidad ICP | escalar por campaña y embudo | % | Calificados | **Ya está, con otra forma** · 27,5 a 73,9 |
| A2-22 | Campañas por embudo | conteo | N | Campañas con volumen | Depende de A2-P07 |
| A2-40 | Variación contra la ventana anterior | (actual − anterior) / anterior | % | La misma métrica, dos ventanas | Calculable; sin historia contra la cual |
