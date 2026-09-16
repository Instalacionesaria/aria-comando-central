# Lo que NO es un requisito

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
> **Este documento es el inverso de los otros ocho: enumera lo que el prototipo dibuja y el
> sistema real NO tiene que construir.** Cada entrada dice qué hacía el andamio en la maqueta,
> por qué no se implementa, y —cuando lo hay— qué requisito revela al quitarlo.

**Este archivo existe para que nadie implemente el simulacro.**

El prototipo de Acquisition se comporta como una pantalla de verdad: responde al selector de
fechas, dibuja flechas verdes y rojas, cambia los números al cambiar el período y nunca muestra un
`NaN`. Esa verosimilitud no es un accidente — está fabricada por seis o siete mecanismos concretos
que un sistema real no necesita y que, copiados, producirían una pantalla peor que la de hoy:
conteos verdaderos con economía inventada. Hoy nadie puede confundirse; con la mitad portada, sí.

**El andamiaje de este módulo se cuenta.** Son **58 literales numéricos** en `CAMPS`
(`lib/aios/acquisition.js:20-35`), **15** en `PERIODS` (`:37-38`), **7** nombres de campaña,
**2** alertas escritas en el JSX (`components/views/AcquisitionView.jsx:110-141`), **9** frases de
recomendación con **2** umbrales (`lib/aios/acquisition-plan.js:7-28`), **4** fechas por omisión
(`AcquisitionView.jsx:68, :72, :85, :89`) y **14** contactos falsos en el cajón que abre cualquier
cifra de la pantalla (`lib/aios/leads-group.js:14-28`). Ninguno de esos números es un requisito.

Y hay una regla que atraviesa todo el documento: **un literal de andamiaje puede estar señalando
un requisito real, y confundirlos en cualquiera de las dos direcciones arruina el trabajo.** El
tope de 0,94 no es un requisito —nadie pidió topar tasas al 94 %— pero recuerda que quien hizo la
maqueta sabía que una tasa de paso no puede dar 100 %. Cuando pasa eso, está dicho en el renglón
**Lo que revela**.

---

## 1 · Cómo se distingue un andamio de un requisito

Tres preguntas, en este orden, y la primera que dé «sí» decide:

**1 · ¿Un sistema con datos reales necesitaría este mecanismo?** Si la respuesta es no —un hash de
una fecha, un multiplicador constante, un tope estético—, es andamiaje y se **borra**, no se
reemplaza. No hay una versión «real» de `seedMod`: hay una consulta.

**2 · ¿El número es el dato, o el número es la forma?** `icp:{a:.32, m:.44, b:.24}` es andamiaje en
sus tres valores y requisito en su forma: el sistema real sí tiene que repartir a los calificados
en tramos y publicar el reparto. Los 21 números se tiran; la estructura queda. Lo mismo con las
siete campañas de `CAMPS`: los 58 números se tiran, la idea de que la campaña es la fila del
sistema y lleva su economía encima queda.

**3 · ¿El mecanismo tapa un caso que con datos reales es información?** Entonces no sólo es
andamiaje: es andamiaje **peligroso**, porque su versión portada borraría una señal. Es el caso del
tope de 0,94 y el del piso de 1 en la etapa de entrada.

Y una comprobación que no se puede saltear: **antes de declarar que algo es andamiaje, hay que
ejecutar la aritmética del archivo.** Dos de las piezas que el inventario daba por «tapas»
—`cap` y `Math.max(1, …)`— resultaron no recortar nunca nada con los literales que el propio
archivo trae. Está medido abajo, en A9-05 y A9-06.

---

## 2 · Los generadores de variación: de dónde salen realmente los números

Ninguno de los cuatro mide nada.

### A9-01 · `seedMod`: el hash del texto de una fecha convertido en multiplicador

- **Dónde:** `lib/aios/acquisition.js:47-51`, usado en `:79-80`.
- **Qué hacía:** recorre los caracteres de la cadena `'2026-07-01'`, acumula `h*31 + código` módulo
  997 y devuelve `0.88 + (h % 25)/100`, o sea un número entre **0,88 y 1,12** en pasos de 0,01. Ese
  número entra como `w.mod` en `:91`, `:92` y `:94`, y es lo que hace que elegir otro rango de
  fechas devuelva otras cifras.
- **Por qué no se implementa:** no es un dato que se reemplace, **es un generador que se borra**.
  Un sistema real no necesita un hash de una fecha: necesita leer el gasto de Meta y contar
  contactos con `alta_en_el_crm` entre dos fechas. No hay una versión correcta de esta función.
- **Lo que revela —y es lo que hace que la maqueta engañe—:** el resultado tiene que ser
  **determinista y estable**. El mismo rango consultado dos veces da lo mismo; dos rangos distintos
  dan cifras distintas. `seedMod` cumple esas dos propiedades a la perfección, y por eso la pantalla
  se comporta exactamente como se comportaría una real. Es el andamio más engañoso del módulo
  precisamente porque hace bien lo único que un observador puede verificar sin abrir el código.

### A9-02 · Los multiplicadores `m` y `pm` de `PERIODS`: la fábrica de flechas

- **Dónde:** `lib/aios/acquisition.js:37-38`. Quince números: tres por período.
- **Qué hacía:** `m` escala el período actual y `pm` el de comparación. Con los períodos fijos, las
  flechas verdes y rojas salen del cociente de esos dos números.
- **Por qué no se implementa:** no es una medición, es una constante. Una flecha «▲ 8 %» que sale de
  que `p7.m / p7.pm = 1.04 / .97` es fijo.
- **Y hay un efecto que conviene ver medido, porque es peor que «las flechas son falsas».** El
  modificador se aplica **en cada eslabón de la cadena**: una vez en la entrada (`:91`), otra en
  cada tasa de paso (`:92`) y otra en la calificación (`:94`). Los volúmenes quedan proporcionales a
  `mod¹, mod², mod³…`, así que el cociente contra el período de comparación se **compone**.
  Ejecutando la aritmética del archivo, esto es lo que la pantalla dibuja hoy con «7 días»:

  | KPI | valor | flecha |
  |---|---|---|
  | Inversión | $2,415 | `=` |
  | Contactos | 262 | ▲ 8 % |
  | Clics a landing VSL | 97 | ▲ 17 % |
  | Agendados | 36 | ▲ 20 % |
  | Calificados | 21 · $115 por calificado | ▲ 31 % |

  Con «30 días»: ▲ 6 %, ▲ 15 %, ▲ 25 %, ▲ 32 %. **La flecha crece con la profundidad de la etapa
  porque el multiplicador se elevó a una potencia más, no porque la calificación haya mejorado.**
  En Booking directo, que tiene una etapa más, los calificados van con `mod⁵`. El resultado es que
  la métrica que la pantalla marca como la importante —Calificados— es también la que muestra
  siempre el movimiento más dramático.
- **Lo que revela:** el período de comparación es una **segunda ventana que se calcula con la misma
  cadena** (`build(w.b)`, `:261-263`), no un campo guardado junto al actual. Esa forma sí se
  conserva. Lo que no se conserva es que la variación venga dada.

### A9-03 · `hist` compara contra sí mismo

- **Dónde:** `lib/aios/acquisition.js:38` — `hist:{d:365, m:1.00, pm:1.00}`.
- **Qué hacía:** es el único período donde `m === pm`.
- **Lo que revela:** el requisito real está escrito aparte y correctamente en `:125`. **El histórico
  no compara**, y la forma honesta de decirlo es devolver vacío, no devolver un cero que se lee como
  «no cambió».

### A9-04 · `pmes`: un período de 12 días que ningún botón puede seleccionar

- **Dónde:** `lib/aios/acquisition.js:38` — `pmes:{d:12, m:1.06, pm:.99}`.
- **Qué hacía:** nada. El segmentado de la vista sólo ofrece `p1`, `p7` y `p30`
  (`components/views/AcquisitionView.jsx:29, :32, :35`), y el maquetado original tampoco tenía un
  cuarto botón (`aios-command-center_1.html:2690`). **`pmes` es inalcanzable desde cualquier
  camino de la interfaz.**
- **Por qué no se implementa:** es código muerto, y además delatado: se llama «mes» y dura **doce
  días**.
- **Lo que revela:** nada sobre el negocio. Sí sobre el port: el módulo se copió literal del
  maquetado —verificado línea por línea contra `aios-command-center_1.html:5342-5640`— **incluido lo
  que ya estaba muerto ahí**. Quien reconstruya la pantalla no tiene que decidir si conserva `pmes`:
  tiene que decidir qué atajos de período ofrece, y ésa es una pregunta de producto, no una
  herencia.

---

## 3 · Las dos tapas que no tapan nada

Las dos aparecen en los inventarios como «guardados estéticos». Ejecutada la aritmética del
archivo, **ninguna de las dos se dispara nunca**. Eso las hace más interesantes, no menos.

### A9-05 · El tope `cap = v => Math.min(.94, v)`

- **Dónde:** `lib/aios/acquisition.js:86`, aplicado en `:92` (toda tasa de paso) y `:94` (la tasa de
  calificación).
- **Qué hacía:** recortar al 94 % cualquier tasa después de multiplicarla por `w.mod`.
- **Medido, y contradice lo que el inventario afirma:** con los 16 valores de `r` del archivo (el
  mayor es `.80`, en «Remarketing web · Agendamiento», `:34`), los 7 de `calif` (el mayor es `.72`,
  `:26`) y el rango completo de `w.mod` —los diez multiplicadores de `PERIODS` más los 25 valores
  posibles de `seedMod`, máximo 1,12—, el producto más grande que la cadena puede producir es
  **0,8960** para una tasa de paso y **0,8064** para la calificación. **`cap` nunca recorta nada.**
  No es una tapa: es una tapa que no llega a tocar el borde.
- **Por qué no se implementa:** nadie pidió topar tasas al 94 %, y **taparlas es exactamente lo
  contrario de lo que hay que hacer**. Está medido en `01-ACQUISITION.md` §3.6 y en la regla 7 del
  §6: el segmento «(sin adId)» de la ventana agenda **47 de 57 = 82,5 %**, la tasa más alta de toda
  la tabla, muy por encima del 44 % del anuncio de mayor volumen. Esa cifra alta es la señal más
  importante de la pantalla —dice que el widget de calendario no pasa el `adId`, no que la pauta
  convierta peor— y un tope la habría aplanado hacia el resto en vez de dejarla asomar.
- **Lo que revela:** quien hizo la maqueta **sabía que una tasa de paso no puede dar 100 %**, y
  escribió un guardado para eso. La conclusión correcta es la contraria a la que sacó: una tasa real
  sí puede acercarse a 100 %, y el trabajo es explicar por qué —qué categorías junta esa fila, qué
  hecho técnico la produce— no recortarla. El guardado que sí hace falta no es un tope: es un piso
  de denominador (`PISO_DE_UNA_TASA = 10`, `lib/negocio/indicadoresDeCitas.ts:300`) y una fila que
  se cuenta pero no compite (`lib/negocio/atribucionDelLead.ts:179-183`).

### A9-06 · El piso `Math.max(1, …)` en la etapa de entrada

- **Dónde:** `lib/aios/acquisition.js:91`.
- **Qué hacía:** impedir que la primera etapa de una campaña dé cero.
- **Medido:** el `entD` más chico del archivo es **1,6** (`:25`), el `w.days` más chico es 1 y el
  `w.mod` más chico es 0,88. El mínimo que `Math.round(entD · days · mod)` puede devolver es
  **exactamente 1**. **El piso tampoco se dispara nunca.**
- **Por qué no se implementa:** porque su versión portada sí se dispararía, y taparía un dato. **Un
  cero real es información** —una campaña apagada, un anuncio sin entrega, un embudo sin tráfico— y
  la pantalla tiene que poder mostrarlo. Medido: cuatro de los siete anuncios de la ventana tienen 1
  o 2 contactos (`01-ACQUISITION.md` §6, regla 5), y con el piso de 10 sólo tres pueden publicar
  tasa.
- **Lo que revela —y es lo que hay que diseñar antes de portar—:** el piso de 1 garantiza que
  `base` nunca sea 0, y por eso **la pantalla nunca se probó con un embudo vacío**. Con `base = 0`
  el comportamiento del código ya es el correcto —todas las barras de proporción quedan en 0 %
  (`:165`, `:189`) y todas las tasas caen al guion `'—'` (`:171`)— pero **no hay estado vacío
  diseñado** para una tarjeta de embudo, una tabla o el bloque de calificados. Ese estado vacío es
  trabajo nuevo, y hoy no existe porque el andamio impedía llegar a él.

---

## 4 · Los 58 números de `CAMPS`

### A9-07 · Las siete campañas y sus 58 literales

- **Dónde:** `lib/aios/acquisition.js:20-35`. Cinco campañas aportan 8 números y dos aportan 9:
  inversión diaria (`invD`), entradas diarias (`entD`), tasas de paso (`r`, dos o tres), tasa de
  calificación (`calif`) y tres proporciones de ICP.
- **Qué hacía:** el inventario completo de campañas activas de Meta con su economía.
- **Por qué no se implementa:** los 58 números no salen de ningún lado. Y el inventario real no se
  les parece: en la ventana hay **4 `campaignId` distintos y 7 `adId` distintos**, no siete
  campañas parejas de tres embudos (`01-ACQUISITION.md` §4).
- **Lo que revela —la forma, que sí queda—:** la campaña es la **fila del sistema**, pertenece a un
  recorrido de entrada y lleva su economía y su calidad de lead encima. Y un requisito por
  contraste: **la clave de la campaña es un identificador, nunca el nombre.** `CAMPS` identifica por
  `n`, un texto, y la regla 1 del §6 de `01-ACQUISITION.md` está medida en contra: «El app» tiene
  DOS `adId` distintos (44 contactos y 2) y «economia us latino» otros dos (17 y 2). Agrupar por
  nombre fusiona anuncios de campañas distintas y **borra el arranque de la campaña nueva del 12 de
  septiembre**, que es justo lo que un media buyer necesita ver.

### A9-08 · `invD × w.days`: la inversión extrapolada, y la flecha muerta del primer KPI

- **Dónde:** `lib/aios/acquisition.js:88`. De ese único valor cuelga **todo** el dinero de la
  pantalla: el costo por etapa (`:190`, `:225`), el costo por calificado de la campaña (`:236`), el
  del embudo (`:201`) y, sumado, el KPI de Inversión y el gran costo por calificado (`:120`).
- **Qué hacía:** producir la inversión de cualquier ventana multiplicando un gasto diario constante
  por el número de días.
- **Por qué no se implementa:** **multiplicar un promedio diario por los días es justo lo que un
  sistema real no puede hacer.** El gasto de una ventana es una **suma de días reales**, y por eso
  el §18.4 exige guardar las métricas por fecha. `public.closer_meta_metricas` ya tiene esa forma
  exacta (`nivel`, `objeto_id`, `padre_id`, `fecha`, `gasto`, `impresiones`, `clics`, `cpl`…) y
  **0 filas**; un grep de esa tabla sobre el código del repositorio da cero coincidencias
  (`01-ACQUISITION.md` §5.2).
- **Y hay un defecto que el andamio produce y que hay que nombrar antes de portar.** Como `inv` se
  calcula **sin** `w.mod`, con cualquier período fijo las dos ventanas duran lo mismo, la inversión
  actual y la anterior son idénticas y el KPI de Inversión nunca dibuja una variación: **la única
  cifra de dinero de la fila de KPIs tiene su flecha estructuralmente muerta.** Pero la afirmación
  de que «nunca se ve un delta distinto de `=`» es falsa en un caso, y es el caso peligroso: con rango
  personalizado y comparación «Otro periodo» de distinta duración, la flecha aparece y **mide
  únicamente el cociente de días**. Medido: 21 días contra 30 da `▼ 30 %` **en rojo**, porque
  `:146` pasa `invert:false` y bajar el gasto se pinta como malo. Con 30 contra 21 se pinta `▲ 43 %`
  **en verde**: gastar más sale como buena noticia, que es exactamente lo que el §18.10 prohíbe
  sugerir en solitario.
- **Lo que revela:** un único valor de inversión por campaña y ventana, del que cuelgan todos los
  costos, **armado sumando días**; y que la Inversión necesita una decisión explícita sobre su
  delta —o se mide por día y se compara de verdad, o se muestra sin flecha como las tres cifras del
  encabezado de embudo (`:199-201`).

### A9-09 · `entD` decimal: 9,2 leads por día

- **Dónde:** `lib/aios/acquisition.js:21, :23, :25, :27, :29, :31, :33`.
- **Qué hacía:** el volumen de entrada de cada campaña, como promedio diario.
- **Por qué no se implementa:** un `entD` decimal sólo tiene sentido como promedio inventado. **Un
  sistema real cuenta contactos enteros por día**, y la ventana se arma sumándolos.
- **Lo que revela:** la forma sí queda, y ya es reproducible. La cohorte se arma con
  `alta_en_el_crm` y no con `creado_el` —233 contra 256 en la ventana de 14 días, 23 de diferencia
  que son latencia de ingesta (migración 048 §1, regla 6 del §6)— y el reparto por anuncio está
  medido: 109 / 57 sin `adId` / 44 / 17 / 2 / 2 / 1 / 1.

### A9-10 · La dirección del cálculo: la tasa es el dato y el volumen se deriva

- **Dónde:** `lib/aios/acquisition.js:92`.
- **Qué hacía:** derivar cada etapa de la anterior aplicándole una tasa escrita a mano.
- **Por qué no se implementa:** **está al revés, y es la inversión más importante al portar.** En el
  sistema real se cuentan los dos volúmenes por separado y la tasa es el cociente.
- **Lo que revela, y hay que decidirlo en vez de forzarlo:** contando los dos lados, **la cadena
  puede no cerrar**. Un contacto puede hacer dos clics; un clic puede no dejar contacto; un
  agendamiento puede llegar sin haber pasado por la landing. El prototipo garantiza por construcción
  que cada etapa sea menor o igual que la anterior, y esa garantía se pierde el día que los números
  se cuenten. Qué se dibuja cuando una etapa supera a la anterior es una pregunta abierta —no un
  requisito— y el andamio la escondía.

### A9-11 · Las 21 proporciones de `icp:{a, m, b}`

- **Dónde:** `lib/aios/acquisition.js:22, :24, :26, :28, :30, :32, :34`. Tres proporciones por
  campaña, que suman exactamente 1,00 en las siete.
- **Qué hacía:** repartir los calificados de cada campaña en tramos de afinidad alta, media y baja.
- **Por qué no se implementan los valores:** son 21 números inventados, y además **los cortes de los
  tramos no están declarados en ninguna parte del módulo**. La pantalla dibuja tres tramos sin decir
  nunca dónde corta.
- **Lo que revela —es el caso difícil en estado puro—:** la **forma** sobrevive y los **valores** no.
  El sistema real sí tiene que repartir a los calificados en tramos y publicar el reparto, no sólo
  un promedio: es lo que alimenta `icpBar` (`:136-141`) y la columna «Afinidad ICP» (`:237-238`), y
  el invariante de `:96-97` está bien resuelto —el tramo bajo es el **residuo**, no un tercer
  redondeo, y por eso los tres tramos suman exactamente los calificados y la barra llena el 100 %
  del ancho sin hueco. Lo que **no** sobrevive es que los tramos vengan dados: el dato de origen
  viene **continuo** —«Puntaje | ICP», poblado en 229 de 233 contactos de la ventana, promedio por
  anuncio de 27,5 a 73,9 (`01-ACQUISITION.md` §3.5)—, así que dónde se corta es una definición de
  negocio pendiente. Y hay una pista que la pantalla ya contiene y se contradice sola: las tres
  cifras de calificados llevan `data-seg="alto"` (`:150`, `:178`, `:232`), y el cajón corta el tramo
  alto en **75** (`lib/aios/leads-group.js:10`). O «calificado» significa «ICP ≥ 75» —y entonces la
  barra de tres tramos no describe a los calificados— o son dos cosas distintas y el filtro está
  mal. El prototipo no lo decide.

### A9-12 · Los pesos 100 / 60 / 25 de la afinidad ICP

- **Dónde:** `lib/aios/acquisition.js:98` (por campaña) y `:111` (por embudo).
- **Qué hacía:** convertir el reparto en tres tramos en un solo número comparable entre filas, que
  se lee en el bloque de calificados (`:181`) y como columna «Afinidad ICP» en las tablas (`:237`).
- **Por qué no se implementan los pesos:** 100/60/25 no sale de ningún lado del negocio, y **impone
  un defecto que nadie pidió: la afinidad tiene piso de 25 %.** Una campaña con todos sus
  calificados en el tramo bajo da 25 %, nunca 0, así que la columna va de 25 a 100 y no de 0 a 100 —
  y dos campañas malas se ven menos distintas de lo que son.
- **Lo que revela —y es la parte que hay que conservar con cuidado—:** el requisito no es la
  fórmula, es que **exista un escalar único de afinidad por campaña y por embudo**, porque es lo que
  permite ordenar por calidad de lead y no sólo por volumen o costo. Y hay una decisión de agregación
  que el prototipo resuelve bien y que se conserva tal cual: **la afinidad del embudo se RECALCULA
  sobre los tramos agregados** (`:111`), no se promedian las afinidades de sus campañas. Un promedio
  de promedios le daría a una campaña de 3 calificados el mismo peso que a una de 300.

---

## 5 · Los literales de texto

### A9-13 · `'Activa · Meta'`, escrito fijo debajo de cada campaña

- **Dónde:** `lib/aios/acquisition.js:229`. Idéntico en las siete filas.
- **Qué hacía:** dar a cada fila un estado de entrega y un proveedor.
- **Por qué no se implementa:** las siete campañas dicen «Activa» pase lo que pase. **Una campaña
  pausada se dibujaría exactamente igual que una activa**, con sus cifras congeladas y sin ninguna
  marca — que es precisamente el detector «anuncios sin entrega» del §18.13 fallando en silencio.
- **Lo que revela:** dos atributos que ni `CAMPS` ni la base tienen y el §18.4 sí pide: **estado de
  entrega** (`delivery status`) y **proveedor**. El estado de una campaña sólo lo sabe Meta.

### A9-14 · El `$` escrito a mano y el locale `es-MX`

- **Dónde:** `lib/aios/acquisition.js:41-43`.
- **Qué hacía:** formatear todo el dinero de la pantalla.
- **Por qué no se implementa:** el `$` está escrito a mano y el locale es `es-MX`, así que **la
  pantalla afirma pesos mexicanos sin que nadie lo haya declarado**. Meta factura la cuenta en la
  moneda de la cuenta publicitaria, que no aparece en ninguna parte del módulo ni de la base.
- **Y el sistema ya no se pone de acuerdo consigo mismo.** Tres locales conviven entre los módulos
  que publican cifras de Acquisition: `es-MX` acá (`:41-42`), `en-US` en el dinero de Executive
  (`lib/aios/executive.js:31`) y en el del cajón de contactos (`lib/aios/leads-group.js:11`), y
  `es-PE` en los conteos de Executive (`executive.js:32`). El mismo importe se escribiría distinto
  según qué pantalla lo dibuje.
- **Lo que revela:** el requisito es que **el dinero se formatee con una moneda declarada**. El `$`
  literal no es una declaración de moneda: es la ausencia de una.
- **Lo que sí es requisito, y conviene no tirarlo con el resto:** la pantalla **no muestra decimales
  en ninguna parte** —volúmenes con separador de miles, dinero con el mismo formato, tasas como
  entero seguido de `%`— y es coherente con que todas las cifras de `build()` ya vienen redondeadas
  (`:88`, `:91`, `:92`, `:94`, `:96`).

### A9-15 · «histórico · sin comparación» cuando el período es «Hoy»

- **Dónde:** `lib/aios/acquisition.js:270` y `:282`.
- **Qué hacía:** escribir la nota del rango cuando no hay comparación.
- **Por qué no se implementa así:** la **regla** vive en un solo lugar y está bien
  (`:125`: `if(S.period === 'hist' || S.period === 'p1') return ''`), pero el **texto** que la
  acompaña está escrito a mano en dos lugares más y en los dos dice `'histórico · sin comparación'`
  — **incluso cuando el período es `p1`, que es «Hoy» y no histórico**. Al elegir «Hoy» la pantalla
  nombra el período equivocado.
- **Lo que revela:** los dos casos merecen frases distintas porque son motivos distintos. En
  histórico no hay período anterior que tenga sentido; en «Hoy» el día está **incompleto**, y
  comparar un día a medias contra un día entero produce una caída que es la hora del reloj. La regla
  es una sola; el texto que la explica, dos.

---

## 6 · Los andamios de fontanería

Ninguno es un requisito, y varios son defectos reales y comprobables que hay que resolver
antes de portar, no después.

### A9-16 · `val(id)`: el cálculo lee el DOM, y el estado que nadie lee

- **Dónde:** `lib/aios/acquisition.js:44`, usado en `:68` y `:74`.
- **Qué hacía:** `windows()` no lee el estado: lee los cuatro campos de fecha directamente del
  documento con `document.getElementById(id).value`.
- **Por qué no se implementa:** es acoplamiento de maqueta, y **produce un defecto medible**: el
  callback del selector global de fechas guarda `S.from` y `S.to` en `:268` y **nadie los lee
  nunca** — verificado con grep sobre el archivo entero, `S.from` y `S.to` aparecen en esa línea y
  en ninguna otra. El usuario elige un rango en el calendario, ve cambiar la etiqueta de la píldora,
  y **los números que aparecen son los del rango que está en los campos `acqA1`/`acqA2`**.
- **Lo que revela:** hay **dos controles de rango compitiendo** —la píldora del calendario compartido
  y la barra de dos pares de fechas— y hoy sólo el segundo mueve las cifras. El sistema real tiene
  un período por pantalla y ese período tiene un dueño; el cálculo se alimenta del estado, no del
  documento.

### A9-17 · `acqCustomBtn`: un escuchador para un botón que nunca existió

- **Dónde:** `lib/aios/period-controls.js:33`.
- **Qué hacía:** desplegar la barra de rango de Acquisition al pulsar un botón con ese id.
- **Medido, con una precisión que el inventario tenía al revés:** el **escuchador** sí existe en el
  maquetado original (`aios-command-center_1.html:5703`), así que no lo inventó el port. Lo que no
  existe, ni en el repositorio ni en el maquetado, es **el botón**: no hay ningún
  `id="acqCustomBtn"` en ninguna parte.
- **Por qué no se implementa:** es un cable suelto que lleva dos generaciones de código sin conectar
  a nada. Se borra con el resto de la fontanería del rango.

### A9-18 · El `!cur` de `delta`: la caída a cero se dibuja como «sin comparación»

- **Dónde:** `lib/aios/acquisition.js:126` — `if(!prev || !cur) return '';`.
- **Qué hacía:** evitar que la función devuelva un infinito o un 100 % cuando falta el período
  anterior.
- **Por qué sólo la mitad se implementa:** el guardado contra `prev` **es requisito** —sin
  denominador no hay variación relativa que publicar, y la respuesta correcta es no dibujar nada—.
  El `!cur` **sobra y es un defecto**: mata el delta también cuando el valor actual es cero y el
  anterior no. Una campaña que pasó de 40 agendados a 0 se dibuja «sin comparación», que es
  exactamente el caso donde la flecha era imprescindible. **El guardado va contra el denominador,
  no contra el numerador.**
- **Estado, y por qué esto va a doler al principio:** el caso `prev = 0` va a ocurrir todo el
  tiempo. Medido, el rango por omisión de la vista (2026-07-01 → 2026-07-21) trae **3 contactos** y
  el de comparación (2026-06-01 → 2026-06-21) trae **0** (`01-ACQUISITION.md` §3.9).

### A9-19 · Los ocho `invert:false`

- **Dónde:** las ocho llamadas a `delta` del módulo: `:146`, `:147`, `:148`, `:149`, `:150`, `:179`,
  `:188`, `:234`. **Son ocho, no nueve** — verificado con grep sobre el archivo.
- **Qué hacía:** el parámetro separa dos ejes que la pantalla necesita mantener separados — **el
  color depende de si el movimiento es bueno y la flecha depende de si es hacia arriba**, y esa
  separación es lo que permite dibujar «▲ 12 %» en rojo para un costo por calificado que subió.
- **Por qué es andamiaje por omisión:** el parámetro es requisito; que **las ocho llamadas lo pasen
  en `false`** no lo es. Hoy no hay una sola métrica invertida en pantalla, aunque el costo por
  calificado, el CPL y el costo por clic son exactamente el caso para el que se escribió. Y una de
  las ocho es un error de lectura que hay que resolver antes de portar: la **Inversión** (`:146`) se
  dibuja **en verde cuando sube**. Gastar más no es bueno por sí mismo — es neutro, y el §18.10
  prohíbe recomendar escalar presupuesto en solitario.

### A9-20 · `(t.clics || 0)`, y el `forms` que no está

- **Dónde:** `lib/aios/acquisition.js:114-119`.
- **Qué hacía:** el gran total `g` se inicializa con cinco campos —`inv`, `contactos`, `clics`,
  `agendados`, `calificados`— y suma los clics con un guardado defensivo.
- **Por qué no se implementa:** el `|| 0` **hoy no protege de nada**: los tres embudos tienen la
  etapa `clics` (`:7`, `:11`, `:15`). Es andamiaje que delata que el autor sabía que las etapas no
  son homogéneas — **y la protección que faltaba era la de `forms`**, que sólo tiene Booking directo
  (`:15-17`) y que desaparece del encabezado sin que nada avise. La etapa existe en su tarjeta y en
  su tabla, y no existe en el total.
- **Lo que revela:** **el total de varios embudos sólo puede sumar lo que todos tienen**, y qué pasa
  con las etapas exclusivas es una decisión que hay que tomar explícitamente. Hoy está tomada por
  omisión. Y el aviso de `components/views/AcquisitionView.jsx:94-100` es parte del mismo requisito
  y hay que conservarlo literal: «sumar contactos de funnels distintos mide escala, no conversión»
  — por eso `g` no lleva ninguna tasa, sólo volúmenes y dinero.

### A9-21 · Seis `build()` por render

- **Dónde:** `lib/aios/acquisition.js:261-263`. `build(w.a)` y `build(w.b)` se llaman tres veces
  cada uno, uno por bloque de render.
- **Qué hacía:** con datos inventados es gratis.
- **Por qué no se implementa:** con datos de servidor son **seis consultas donde hacen falta dos**,
  y peor: seis consultas que pueden devolver cifras distintas entre sí si algo se escribe en el
  medio, con los KPIs contradiciendo a las tarjetas sin que nada falle.
- **Lo que revela:** el modelo se calcula **una vez por ventana** y los tres bloques leen el mismo
  objeto. La firma de `build` ya está lista para eso (`:85`): recibe `{days, mod}` y devuelve el
  modelo de tres niveles —campaña → embudo → total— sin tocar el DOM. **El día que el dato sea real,
  ésa es la firma del endpoint.**

### A9-22 · El fallback `|| 21` y el tope de 365

- **Dónde:** el fallback en `lib/aios/acquisition.js:69`; el tope, en `:69` y `:75`.
- **Qué hacía:** `Math.max(1, Math.min(365, dayDiff(a1,a2) || 21))` — acotar la ventana y, si las
  fechas no se pueden leer, inventar una de veintiún días.
- **Por qué no se implementa el fallback:** los veintiún días son el largo del rango que la vista
  trae por omisión (`AcquisitionView.jsx:68, :72`). **Un sistema real no inventa una ventana cuando
  faltan fechas**: pide las fechas o usa la última válida.
- **Lo que revela:** que sí hace falta declarar un **mínimo y un máximo de ventana consultable** y
  que el sistema los imponga, en vez de confiar en los campos de fecha — un rango invertido o de
  cero días no puede llegar al cálculo. El 365 coincide con `hist.d` (`:38`), o sea que el rango
  libre no puede pedir más que el histórico; que el tope sea 365 y no otro número es andamiaje.
- **Y lo que sí es requisito y está en la misma función:** `dayDiff` cuenta **los dos extremos
  incluidos** (`:45`, el `+ 1`). Un rango 2026-07-01 → 2026-07-21 son **21 días, no 20**, y esa
  misma convención tiene que usarse al armar el período de comparación (`shift(a1, da)`, `:72`) o las
  dos ventanas quedan desfasadas un día.

---

## 7 · Los bloques escritos a mano

### A9-23 · Las dos «Señales detectadas», y el «Ver evidencia» que no está cableado

- **Dónde:** `components/views/AcquisitionView.jsx:110-141`; los botones en `:122-124` y `:138-140`.
- **Qué hacía:** dos alertas completas, con severidad (ícono ámbar sobre `rgb(var(--c-warn) / .14)`),
  título, diagnóstico con cifras y un botón de evidencia. Literales: **«Cae la afinidad ICP en
  Prospecting B — Sus calificados promedian 54% de afinidad frente al 72% del retargeting, con
  costo por calificado más alto»** y **«Fuga entre formulario y landing VSL en Booking directo — Una
  parte de quienes completan el formulario no llega a ver la VSL. Es el salto más caro de los tres
  funnels»**.
- **Por qué no se implementan:** las cifras son inventadas, la campaña que nombran no existe, y el
  «salto más caro» se apoya en un costo que no se puede calcular. Y el botón **no está cableado a
  nada**: verificado con grep, `className="ev"` aparece exactamente en esas dos líneas de
  `components/` y no hay ningún escuchador sobre `.ev` en `lib/aios/` — ni siquiera el delegado de
  `data-leads` que el resto de la pantalla sí usa.
- **Lo que revela, y es bastante:** la **forma** de la alerta está casi completa y hay que
  conservarla — severidad, entidad afectada, métrica con su valor actual y su comparación, y una
  segunda métrica que agrava. Son además **dos tipos distintos** de alerta: la primera compara una
  campaña contra otra en la misma métrica; la segunda compara **etapas contiguas dentro de un
  embudo** y la califica por costo. Y el rótulo de la cabecera es una decisión de producto que vale
  más que las dos alertas juntas: **«sin recomendación automática»** — el bloque describe lo que
  detectó y no dice qué hacer; lo accionable vive detrás de un clic deliberado. El botón sin cablear
  es un requisito enunciado y no implementado: **toda señal tiene que poder mostrar en qué se
  basa.** Estado: no hay dónde guardarla. `negocio.hallazgos` es la tabla de Conversation —sus 20
  filas tienen `contacto_id` poblada— y no existe el par `entity_type`/`entity_id` que el §18.13
  pide para apuntar a una campaña, un ad set o un anuncio (`01-ACQUISITION.md` §3.7 y §5.4).

### A9-24 · Las nueve frases del «Plan de acción» y sus dos umbrales

- **Dónde:** `lib/aios/acquisition-plan.js:7-28`.
- **Qué hacía:** escribir **la misma cadena de nueve recomendaciones en cada clic**, repartidas en
  cuatro grupos. El handler no recibe el estado del módulo, no lee las cifras de `build()` y no se
  regenera al cambiar el período — pero su subtítulo dice «periodo seleccionado» (`:6`). **Quien
  mueva las fechas ve KPIs distintos y el mismo plan, con los mismos umbrales.**
- **Por qué no se implementan:** las nueve frases dependen de un costo por calificado que hoy no se
  puede calcular. Los dos únicos números del modal —**«afinidad ICP de 43 %»** (`:11`) y **«mientras
  el costo por calificado se mantenga bajo $110»** (`:21`)— no tienen origen, y el primero
  **contradice a la señal de la pantalla**: la alerta dice 54 % sobre la misma campaña
  (`AcquisitionView.jsx:119`). Dos cifras distintas para el mismo hecho, a dos pantallazos de
  distancia.
- **Y dos de las nueve son literalmente lo que el §18.10 prohíbe decidir en solitario** —«Deja de
  escalar Prospecting B» (`:16`) y «Sube el presupuesto de retargeting…» (`:21`)— **y están en
  grupos distintos**. Si se reconstruye, esas dos tienen que cambiar de lugar, no de redacción
  (`01-ACQUISITION.md` §6, regla 10).
- **Lo que revela:** la forma de los **cuatro grupos con semántica propia** —lectura, freno, empuje,
  derivación a otra área—, cada recomendación con su entidad, su métrica y, cuando es accionable, su
  umbral y su condición. Y lo único del modal que sobrevive entero es el cuarto grupo (`:26-27`):
  **«La fuga de formulario a landing pertenece a Conversion»** y **«La afinidad ICP de cada campaña
  se cruza en Leads Portal»**. Es el único lugar de la pantalla donde Acquisition declara los
  límites de su jurisdicción, que es el §18.16 dibujado.

### A9-25 · Las cuatro fechas por omisión de 2026-07

- **Dónde:** `components/views/AcquisitionView.jsx:68, :72, :85, :89` — período 2026-07-01 →
  2026-07-21, comparación 2026-06-01 → 2026-06-21.
- **Qué hacía:** un rango de trabajo plausible.
- **Por qué no se implementan:** **caen en el desierto anterior al despliegue.** Medido con la
  columna que esta pantalla tiene que usar, el rango por omisión devuelve **3 contactos** y el de
  comparación **0** (`01-ACQUISITION.md` §3.9). Una pantalla real abriría prácticamente en cero y
  contra un cero, y se leería como rota. Es el andamio con la ventana de riesgo más corta: es lo
  primero que rompe el día que la pantalla lea datos.
- **Lo que revela:** el rango por omisión es una **decisión**, y tiene que derivarse de la fecha de
  corte de los datos. Y con ella viene la obligación que el prototipo no tiene y la base sí impone
  (regla 6 del §6): ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del despliegue,
  y **toda pantalla que la use tiene que decir desde cuándo mide**. La nota del rango (`:91`, escrita
  en `acquisition.js:260`) es el lugar donde va.

### A9-26 · El `POOL` de catorce contactos del cajón

- **Dónde:** `lib/aios/leads-group.js:14-28`, servido por `sample()` en `:31-37`.
- **Qué hacía:** cualquier cifra de Acquisition con `data-leads` abre un cajón que lista contactos.
  Esos contactos son **catorce literales que se reciclan cíclicamente** (`out.push(base[i %
  base.length])`) hasta llenar el conteo pedido, con tope de 40 filas.
- **Por qué no se implementa:** son catorce personas inventadas con nombre, puntaje, campaña, estado
  y monto de venta.
- **Y hay un detalle que sólo se ve cruzando los dos archivos, y que hace al cajón peor que el resto
  del andamiaje:** el vocabulario de campañas del `POOL` **no coincide con el de `CAMPS`**. Las
  filas dicen «Campaign 04 · Creative 12», «Prospecting B · Creative 07», «Retargeting · Creative
  12». Así que al hacer clic en los calificados de «Prospecting A · Lead Ads» el cajón lista
  contactos atribuidos a «Campaign 04», que no es ninguna de las siete campañas de la pantalla que
  lo abrió. **La pantalla se contradice consigo misma a un clic de distancia.**
- **Lo que revela —y es un requisito de contrato, no de dato—:** el drill-down manda hoy **un número
  y un segmento, no una cohorte** (`:79-85`: `data-leads` el título, `data-n` el conteo, `data-seg`
  el tramo, `data-sub` el contexto). Un sistema real tiene que mandar **qué contactos son**, no
  cuántos. Lo que sí se conserva de la forma: el tope de filas, el «mostrando X de N» cuando la
  lista se recorta, el puntaje ICP por contacto, el salto a GoHighLevel y el pie «Ver los N en Leads
  Portal →» que navega y preselecciona el tramo. Y una regla que el prototipo aplica en el KPI de
  Inversión: **es una cifra sin `data-leads`** (`:146` le pasa `0` en el quinto campo). El dinero
  no se explica con una lista de personas.

---

## 8 · Los nombres propios

### A9-27 · Las siete campañas inventadas, y el precedente que este proyecto ya pagó

Las siete campañas del prototipo se llaman **«Prospecting A · Lead Ads»**, **«Prospecting B · Lead
Ads»**, **«Retargeting 90d · Lead Ads»**, **«Reel de autoridad · DM»**, **«Remarketing interacción ·
DM»**, **«Público frío · Agendamiento»** y **«Remarketing web · Agendamiento»**
(`lib/aios/acquisition.js:21-34`). Los tres embudos se llaman «Lead form ads», «Profile funnel» y
«Booking directo» (`:6`, `:10`, `:14`).

**Ninguno de esos nombres puede sobrevivir al port, y el motivo no es estético.**

**Primero, lo que está bien y conviene decir porque era la sospecha razonable:** el prototipo **no
expone nombres reales**. Un `grep -niE "yaping|nueva era|ariaia|zyra|evoluciona|tofu|bofu|latam"`
sobre `acquisition.js`, `acquisition-plan.js` y `AcquisitionView.jsx` da **cero coincidencias**
(`01-ACQUISITION.md` §2). Los siete nombres son inventos genéricos. El riesgo está al revés, y llega
el día que se conecte el dato: las campañas de verdad se llaman «NUEVA ERA | TOFU | LEADS |
LATAM+USA | 01-09-26» y los anuncios «agendamiento - yaping», «El app», «economia us latino»,
«Evoluciona native».

**Segundo, el precedente.** Este proyecto ya pagó una vez por un nombre propio escrito a mano en una
pantalla de departamento. `lib/aios/conversation.js` eran 559 líneas de las cuales unas 180 eran
literales inventados, y entre ellos **el agente se llamaba «Sofía», un diálogo saludaba a «Rodrigo»,
y «landing BCL» —iniciales de un cliente real— aparecía en tres sitios**. El módulo entero se borró;
el porqué está documentado en `components/views/ConversationView.jsx:12-33` y en
`docs/estado actual/04-CONVERSATION.md:128`, que además deja constancia de la verificación posterior:
«**Ningún nombre de persona ni de marca real quedó en el código de esta pantalla**», comprobado con
grep, y «las marcas que sí se ven en pantalla —los dos nombres de campaña de la tabla de
atribución— **vienen de la base**, no del código».

Ésa es la regla, y sale de ese precedente: **un nombre propio que se ve en pantalla viene de la
base. Si está en el código, es un defecto.** El mismo archivo registra la regla hermana, con su
precio: está prohibido nombrar un agente a mano en una ruta, porque en la plataforma anterior la
base aceptaba cuatro agentes y el código validaba contra una lista de dos, y los patrones «no se
podían cerrar ni medir su reincidencia» (`04-CONVERSATION.md:401`). Y una tercera, que también
aplica acá: `pruebas/codigo/91-closer-y-setter.test.ts` prohíbe nombrar al proveedor en texto que se
pinta **«porque lo van a ver clientes»**.

**Tercero, y es lo que hace que borrar `CAMPS` no alcance:** el nombre inventado **ya se escapó del
módulo**. Medido con grep sobre `lib/`, `components/` y `app/`, «Prospecting B» aparece hoy en
**ocho archivos**:

| archivo:línea | qué dice |
|---|---|
| `lib/aios/acquisition.js:23` | la campaña en `CAMPS` |
| `components/views/AcquisitionView.jsx:116` | la señal «Cae la afinidad ICP en Prospecting B» |
| `lib/aios/acquisition-plan.js:11, :16` | dos de las nueve recomendaciones |
| `lib/aios/executive.js:180` | la ficha del departamento en la pantalla del jefe |
| `lib/aios/executive-panel.js:12, :28` | la tarjeta de conflicto y un cambio registrado |
| `lib/aios/executive-chat.js:33` | una de las cuatro respuestas del chat ejecutivo |
| `lib/aios/leads-group.js:16, :17, :20, :25, :28` | cinco contactos del cajón |
| `lib/aios/leads-portal.js:27, :31, :43, :59` | cuatro fichas de contacto |

Son **17 apariciones en 8 archivos**, contadas con `grep -ro "Prospecting B"` sobre `lib/`,
`components/` y `app/`. **Borrar `CAMPS` deja dieciséis vivas en otros siete archivos** — y cuatro
de ellas están en la pantalla del jefe, que es donde una cifra inventada se
lee como la verdadera. Es exactamente el riesgo que `01-ACQUISITION.md` cierra en su §7: «arreglar
la pantalla de Acquisition y dejar esas cuatro como están produce un sistema que se contradice
consigo mismo en la cara del usuario».

**Lo que revela:** los nombres inventados no son decoración del prototipo, son **la forma en que el
prototipo se propagó**. La limpieza no es del archivo, es del grafo de archivos que lo citan. Y el
requisito que queda en pie es el de A9-07 y la regla 1 del §6 de `01-ACQUISITION.md`: la fila se
identifica por `adId`/`campaignId` y se **muestra** con el nombre que vino de la base, normalizando
la caja para agrupar y mostrando una variante tal cual vino (`lib/negocio/atribucionDelLead.ts:124-127`),
descartando las etiquetas `{{campaign.name}}` sin renderizar que dos contactos de la ventana traen
de verdad (regla 4).

---

## 9 · La lista de borrado

Lo que desaparece del módulo, con su cuenta. Nada de esto se reemplaza por otra cifra: se reemplaza
por la consulta que la produce o por el estado vacío que la explica.

| # | qué se borra | dónde | cuántos literales |
|---|---|---|---|
| A9-01 | `seedMod` | `acquisition.js:47-51, :79-80` | la función entera |
| A9-02 | `m` / `pm` de `PERIODS` | `acquisition.js:37-38` | 10 |
| A9-03 | `hist.m === hist.pm` | `acquisition.js:38` | 2 |
| A9-04 | `pmes` | `acquisition.js:38` | 3 (inalcanzable) |
| A9-05 | `cap(.94)` | `acquisition.js:86` | 1 (nunca se dispara) |
| A9-06 | `Math.max(1, …)` | `acquisition.js:91` | 1 (nunca se dispara) |
| A9-07 | `CAMPS` | `acquisition.js:20-35` | **58** + 7 nombres |
| A9-08 | `invD × w.days` | `acquisition.js:88` | el producto |
| A9-11 | `icp:{a,m,b}` | `acquisition.js:22-34` | 21 (subconjunto de los 58) |
| A9-12 | pesos 100/60/25 | `acquisition.js:98, :111` | 3 (×2) |
| A9-13 | `'Activa · Meta'` | `acquisition.js:229` | 1 |
| A9-14 | el `$` y `es-MX` | `acquisition.js:41-42` | 2 |
| A9-15 | «histórico · sin comparación» | `acquisition.js:270, :282` | 2 |
| A9-16 | `val()` y `S.from`/`S.to` | `acquisition.js:44, :68, :74, :268` | ruta muerta |
| A9-17 | `acqCustomBtn` | `period-controls.js:33` | escuchador huérfano |
| A9-18 | el `!cur` de `delta` | `acquisition.js:126` | 1 condición |
| A9-20 | `(t.clics \|\| 0)` | `acquisition.js:118` | 1 |
| A9-22 | `\|\| 21` (`:69`) y `min(365, …)` | `acquisition.js:69, :75` | 2 |
| A9-23 | las dos señales + `.ev` | `AcquisitionView.jsx:110-141` | 2 alertas |
| A9-24 | el plan de acción | `acquisition-plan.js:7-28` | 9 frases, 2 umbrales |
| A9-25 | las fechas por omisión | `AcquisitionView.jsx:68, :72, :85, :89` | 4 |
| A9-26 | el `POOL` del cajón | `leads-group.js:14-28` | 14 contactos |
| A9-27 | los nombres propios | 8 archivos | 17 apariciones de «Prospecting B» |

**Y lo que NO se borra con ellos**, porque vive en las mismas líneas y es requisito: la forma de
diccionario de recorridos con etapas propias (`:5-18`), `stages` como lista **ordenada** (`:7`,
`:11`, `:15`), la etiqueta por embudo con clave interna estable (`:8`, `:12`, `:16`), el invariante
del tramo residual (`:96-97`), el recálculo de la afinidad sobre los agregados (`:111`), la regla
única de comparación (`:124-134`) con su umbral de 0,5 % (`:130`) y su silencio en Hoy e Histórico
(`:125`), el aviso de duraciones distintas (`:77`), el cierre inclusivo de `dayDiff` (`:45`), la
regla de la ventana anterior contigua (`:53-57`, `:72`), la raya `'—'` en los cocientes sin
denominador, el «sin comparación» de
`:234`, la firma pura de `build` (`:85`) y la nota de alcance de
`components/views/AcquisitionView.jsx:94-100`.

---

## 10 · Correcciones a los inventarios, y lo que quedó como pregunta abierta

**Cinco correcciones, todas medidas contra el código.**

**1 · `cap(.94)` no recorta nunca.** El inventario lo describe como «una tapa para que las tasas
multiplicadas por `w.mod` no pasen del 94 %». Ejecutada la aritmética con los literales del archivo,
el producto máximo posible es **0,8960** para una tasa de paso y **0,8064** para la calificación. El
tope existe, está aplicado en dos sitios y **no toca un solo número**. Ver A9-05.

**2 · `Math.max(1, …)` tampoco se dispara.** El mínimo que `Math.round(entD · days · mod)` puede
devolver con los siete `entD` del archivo es **exactamente 1**. Ver A9-06.

**3 · Son ocho llamadas a `delta`, no nueve.** Uno de los inventarios dice «las nueve llamadas pasan
`false`». Grep sobre `lib/aios/acquisition.js` da ocho: `:146`, `:147`, `:148`, `:149`, `:150`,
`:179`, `:188`, `:234`. Ver A9-19.

**4 · La flecha de Inversión no está muerta en todos los casos.** El inventario dice que «nunca se
ve un delta distinto de `=`». Es cierto para los períodos fijos y para el rango personalizado con
«Periodo anterior», y **falso** para «Otro periodo» con duraciones distintas, donde la flecha
aparece y mide únicamente el cociente de días: 21 contra 30 da `▼ 30 %` en rojo. Ver A9-08.

**5 · `acqCustomBtn`: el escuchador sí existe en el maquetado original.** El inventario dice que ese
id «no existe en ningún archivo del repositorio ni en el maquetado original». El **escuchador** está
en los dos (`aios-command-center_1.html:5703` y `lib/aios/period-controls.js:33`); lo que no existe
en ninguno de los dos es **el botón**. Ver A9-17.

**Y una observación que los inventarios no traen:** «Prospecting B» vive hoy en **ocho archivos con
diecisiete apariciones**, cuatro de ellas en la pantalla del jefe. Borrar `CAMPS` no borra el
nombre. Ver A9-27.

---

**Preguntas abiertas que este documento deja dichas como preguntas, no como requisitos.** Ninguna se
puede contestar leyendo el prototipo, y por eso no hay un requisito numerado para ellas:

- **Qué se dibuja cuando la cadena no cierra.** Contando los dos volúmenes por separado, una etapa
  puede superar a la anterior —un contacto que hace dos clics, un agendamiento que no pasó por la
  landing— y el invariante que el prototipo garantizaba por construcción (A9-10) desaparece. Hay que
  decidirlo, no forzarlo.
- **Qué se dibuja cuando un embudo, una etapa o una campaña está en cero.** El piso de A9-06 impedía
  llegar a ese caso, así que no hay estado vacío diseñado para ninguna de las tres tarjetas, para
  las tablas ni para el bloque de calificados. La raya `'—'` cubre los cocientes y nada más.
- **Dónde cortan los tramos de ICP, y si siguen siendo tres.** La forma es requisito (A9-11) y los
  cortes no están declarados en ninguna parte del módulo. El cajón sí corta, en 75 y 50
  (`leads-group.js:10`), y ese umbral no está escrito en ninguna parte de Acquisition.
- **Si la afinidad se publica como ponderado de tramos o como promedio del puntaje.** Son dos cifras
  distintas para la misma columna, y la primera arrastra un piso de 25 % que nadie pidió (A9-12).
- **En qué moneda.** El `$` de `:42` no es una declaración (A9-14), y tres locales conviven en los
  módulos que publican cifras de este departamento.
- **Qué control de rango manda**, la píldora del calendario o la barra de fechas (A9-16).
- **Qué métricas llevan `invert`**, y si subir la inversión se sigue dibujando en verde (A9-19).
- **Si el gran total suma las etapas exclusivas de un embudo** (A9-20). Hoy la decisión está tomada
  por omisión.
- **Si el Plan de acción se recalcula** con las cifras de la ventana o se acepta como doctrina fija
  del departamento (A9-24). Y en cualquiera de los dos casos, las dos recomendaciones de presupuesto
  cambian de grupo, no de redacción.
- **A qué abre «Ver evidencia»** (A9-23), que es el único control de la pantalla enunciado y no
  cableado.
