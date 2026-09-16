# Señales y Plan de acción

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

**Esta es la parte del prototipo donde alguien ya decidió qué hacer con los números.** Son dos
señales de una frase y nueve recomendaciones en cuatro grupos: **cinco cifras entre las once
afirmaciones, y un solo umbral accionable**. Todo lo demás de la pantalla muestra; esto juzga.

Y el juicio está mal calibrado de una forma que se puede comprobar sin salir del prototipo: **las
dos señales y las nueve recomendaciones se escribieron a mano contra unos números que el propio
módulo no produce.** Reproduciendo `build()` con el período por omisión (`p7`, `acquisition.js:39`)
—siete días, modificador 1,04— la pantalla dibuja para «Prospecting B» una afinidad ICP de **43 %** y
para «Retargeting 90d» una de **25 %**; la señal 1 afirma **54 %** contra **72 %**, en la dirección
contraria. El umbral de **$110** del plan se escribe al lado de un costo por calificado de
**$147** para la campaña que el plan manda escalar. No son errores de tipeo: son la consecuencia
de escribir un juicio sin denominador, que es exactamente lo que este documento convierte en
requisito.

---

## 1 · La regla que las gobierna a todas

Esta sección va primera porque las once afirmaciones que siguen no valen nada sin ella, y porque no
hay que inventarla: **el sistema ya la aplica en producción y la tiene escrita con
su motivo.**

### A6-01 · Toda señal y toda recomendación viaja con el conteo sobre el que se calculó

Una señal dice sobre cuántos casos se midió, en la misma línea donde dice qué detectó. No en el
detalle, no al abrir la evidencia: en la señal.

- **Rastro:** por ausencia. `components/views/AcquisitionView.jsx:118-120` y `:134-136` — los dos
  diagnósticos son texto y ninguno trae un denominador. La señal 1 dice «Sus calificados promedian
  54 % de afinidad» sin decir cuántos calificados; la señal 2 dice «Una parte de quienes completan
  el formulario» sin decir cuántos son ni qué parte.
- **El defecto concreto que evita, medido dentro del prototipo:** los calificados de Prospecting B
  en el período por omisión son **dos**. Con dos calificados, el reparto en tres tramos
  (`acquisition.js:96-97`) da `icpA=0, icpM=1, icpB=1`, y la afinidad ponderada da
  `(0·100 + 1·60 + 1·25) / 2 = 42,5 %`, que la tabla dibuja como **43 %**. La misma campaña, con las
  mismas proporciones `icp:{a:.19,m:.44,b:.37}` aplicadas sin redondear, da **54,65 %**. **Doce
  puntos de diferencia producidos por redondear dos personas**, y el 54 % de la señal es el segundo
  número, el que la pantalla nunca muestra.
- **Estado:** la regla ya existe y es del sistema, no de esta pantalla. `PISO_DE_UNA_TASA = 10` en
  `lib/negocio/indicadoresDeCitas.ts:300`, con su motivo escrito ahí mismo: *«una tasa sobre dos
  eventos no es una tasa — es un número que se mueve cincuenta puntos con el próximo registro»*.
  La aplican `lib/negocio/atribucionDelLead.ts:158`, `lib/negocio/consumoDelPrecall.ts:231` y
  `lib/auditor/sentimiento.ts:127`.

### A6-02 · Por debajo de diez casos la señal se cuenta y no se publica

El piso es del **denominador de la señal**, no del volumen de la pantalla. Una señal sobre la
afinidad ICP de una campaña se mide sobre los calificados de esa campaña; con menos de diez, la
señal no sale.

- **Rastro:** `lib/negocio/indicadoresDeCitas.ts:300` (la constante) y `lib/aios/conversion.js:79-84`
  (la forma ya dibujada en otro departamento): un arreglo `MINOR` con el comentario *«por debajo del
  umbral de impacto: no se muestran, se cuentan»*. El arreglo está declarado y **no se renderiza en
  ninguna parte** —un `grep` de `MINOR` sobre `conversion.js` da una sola línea, la declaración—, así
  que la idea está escrita y la pantalla que la escribió tampoco la implementó.
- **Qué hace con las que no llegan:** las cuenta. `atribucionDelLead.ts:179-183` ya fijó el
  tratamiento para su caso equivalente: *«El conteo sí va, para que las filas sumen la cohorte»*, y
  `tasa: null`. Una señal que no llega al piso es un renglón «N señales por debajo del umbral», no
  un silencio.
- **Estado, medido:** con el piso de 10 sobre la ventana de 14 días, de los 7 anuncios de la ventana
  **sólo 3 llegan** (109, 44 y 17 contactos); los otros cuatro tienen 1 o 2
  (`01-ACQUISITION.md` §6 regla 5). Una señal por anuncio puede hablar de tres anuncios, no de siete.

### A6-03 · La señal dice sobre qué ventana se calculó, y desde cuándo hay datos

- **Rastro:** por contraste. El plan declara su ventana en el subtítulo —«Acquisition · tres funnels
  · periodo seleccionado» (`lib/aios/acquisition-plan.js:6`)— y **no la respeta**: el cuerpo es una
  cadena fija (`:7-28`) que no recibe el estado del módulo. Las dos señales del JSX no declaran
  ventana ninguna.
- **El defecto concreto:** el umbral de $110 del plan (`acquisition-plan.js:21`) se cumple o no según
  el período que esté elegido. Reproduciendo `build()`, el costo por calificado de «Retargeting 90d»
  es **$147 en `p7`** y **$105 en `p30`**. La misma frase, con el mismo umbral, dice «sube el
  presupuesto» o «no lo subas» según un botón que el modal no lee.
- **Estado:** la obligación es más fuerte de lo que el prototipo supone. La regla 6 del §6 de
  `01-ACQUISITION.md`: ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del
  despliegue, y toda pantalla que la use tiene que decir desde cuándo mide. Medido el 2026-09-15,
  **531 de 559 contactos (95,0 %) caen en los últimos 45 días**.

### A6-04 · La fila «sin anuncio» se cuenta en las señales y no compite en ellas

Ninguna señal compara una campaña o un anuncio contra el segmento sin atribución.

- **Rastro:** por ausencia en el modelo. `acquisition.js:20-35` — las siete campañas de `CAMPS`
  cubren el 100 % de los contactos del prototipo, así que la fila «sin anuncio» no existe y ninguna
  señal puede tropezarse con ella.
- **El defecto concreto, medido:** los **57 contactos sin `adId` agendan 47 veces, 82,5 %**, la tasa
  más alta de toda la tabla, contra el 44 % del anuncio de mayor volumen (`01-ACQUISITION.md` §6
  regla 7). Una señal que compare tasas de agendamiento entre entidades declara ganador a «ninguno».
  Lo que hay detrás es el hecho técnico de que el widget de calendario no pasa el `adId`.
- **Estado:** el criterio ya está escrito en `lib/negocio/atribucionDelLead.ts:179-183`. Se hereda
  tal cual: el conteo va, la tasa no.

### A6-05 · La entidad de una señal es un identificador, nunca un nombre

- **Rastro:** `AcquisitionView.jsx:116` («Prospecting B») y `:132` («Booking directo») — las dos
  señales nombran su entidad con un literal de texto, que es lo mismo que hace `CAMPS` al
  identificar la campaña por `n` (`acquisition.js:21-33`).
- **El defecto concreto, medido, y afecta a esta señal en particular:** «El app» tiene **dos `adId`
  distintos** (`120249633901550467` con 44 contactos y `120249792217700467` con 2) y «economia us
  latino» otros dos (17 y 2) — `01-ACQUISITION.md` §6 regla 1. Y la medición de afinidad ICP del
  §3.5 del mismo informe está agrupada **por nombre**: publica «El app» 45,8 sobre **46** contactos,
  que son exactamente 44 + 2, y «economia us latino» 27,5 sobre **19**, que son 17 + 2. **La fusión
  ya ocurrió en la única medición de ICP que existe**, y es justo la métrica de la señal 1.
- **Consecuencia para la señal:** una señal de «cae la afinidad» sobre un nombre fusionado no puede
  distinguir una caída del anuncio viejo del arranque del anuncio nuevo de la campaña del 12 de
  septiembre — que es precisamente lo que un media buyer necesita ver.

---

## 2 · Señal 1, transcripta y desarmada

### 2.1 · El literal

- **Rastro:** `components/views/AcquisitionView.jsx:110-125`
- **Severidad:** `warn`. Ícono `↓` en un cuadro de 24 px con fondo `rgb(var(--c-warn) / .14)` y color
  `var(--warn)` (`:111-113`). No hay clase de severidad: el color va escrito en el `style` de cada
  señal.
- **Título:** «Cae la afinidad ICP en Prospecting B»
- **Diagnóstico:** «Sus calificados promedian 54% de afinidad frente al 72% del retargeting, con
  costo por calificado más alto.»
- **Acción:** `<span className="ev">Ver evidencia</span>` (`:122-124`).

### A6-06 · La señal declara métrica, valor y base de comparación en la misma frase

«54 % de afinidad frente al 72 % del retargeting» trae las tres cosas: **qué se mide** (afinidad ICP
de los calificados), **cuánto da en la entidad señalada** y **contra qué cifra se la juzga**. Es el
esqueleto de la señal y hay que conservarlo: sin la tercera parte, un 54 % no dice si está bien o mal.

- **Rastro:** `AcquisitionView.jsx:119`.
- **La métrica existe en el módulo:** es `o.icp` de `acquisition.js:98` por campaña y `t.icp` de
  `:111` por embudo, y se dibuja en la columna «Afinidad ICP» (`:237`) y en el bloque de calificados
  (`:181`).
- **Estado:** la métrica es la única de la señal que se puede calcular hoy, y con mejor dato que el
  inventado. «Puntaje | ICP» está poblado en **229 de 233** contactos de la ventana; agrupado por
  nombre de anuncio va de 27,5 («economia us latino», 19 contactos) a 73,9 («Evoluciona native», 31)
  — `01-ACQUISITION.md` §3.5. Lo que no existe es el segundo término del «con costo por calificado
  más alto»: no hay una sola columna de gasto poblada en esta base (§5.1).

### A6-07 · La comparación de esta señal es entre entidades, no entre períodos — y el verbo tiene que decirlo

Ésta es la regla que produciría la señal 1, y la primera decisión que el prototipo tiene mal.

La pantalla tiene un motor de comparación temporal: `delta(cur, prev, invert)`
(`acquisition.js:124-134`), que calcula ventana A contra ventana B y se llama en **ocho** puntos
(`:146`, `:147`, `:148`, `:149`, `:150`, `:179`, `:188`, `:234`). **Ninguno de los ocho es la
afinidad ICP.** No hay flecha sobre la columna «Afinidad ICP» en ninguna parte de la pantalla: el
módulo no compara afinidad contra el período anterior.

El título dice «**Cae** la afinidad», que es un verbo de cambio en el tiempo. El diagnóstico compara
contra **otra campaña en el mismo período**. Son dos ejes distintos y la señal usa uno en el título y
el otro en la evidencia.

- **Comprobado contra el propio modelo:** reproduciendo `build(w.a)` y `build(w.b)` para `p7`
  (`acquisition.js:261-263`), la afinidad de Prospecting B es **25 % en la ventana de comparación** y
  **43 % en la actual**. En el eje temporal **sube dieciocho puntos**. La señal afirma que cae.
- **Y en el eje transversal la dirección también está invertida:** en el período por omisión la
  pantalla dibuja Prospecting B en **43 %** y Retargeting 90d en **25 %** — el 25 % es el piso
  aritmético de la fórmula de pesos, al que cae toda campaña cuyo único calificado quede en el tramo
  bajo. La señal afirma 54 % contra 72 %.

**La regla, entonces, se escribe eligiendo el eje:** una señal de afinidad ICP compara la entidad
contra las demás entidades del mismo embudo en la misma ventana, **o** contra sí misma en la ventana
anterior, y el verbo del título nombra el eje elegido. «Cae» exige el segundo y el prototipo entrega
el primero.

### A6-08 · La métrica que agrava va con su cifra o no va

«con costo por calificado más alto» es una segunda métrica sin número: dice una dirección y no dice
cuánto, ni más alto que qué.

- **Rastro:** `AcquisitionView.jsx:119`, tercer inciso del diagnóstico.
- **El defecto concreto:** el módulo sí calcula esa cifra —`inv/calificados` en `acquisition.js:236`
  para la campaña y `:201` para el embudo— y al ponerla se ve que la afirmación es ambigua.
  Reproducido en `p7`: Prospecting B da **$168** por calificado; «Retargeting 90d», la campaña contra
  la que se compara, da **$147**; y la más barata de las siete es «Remarketing web» con **$66,5**.
  Prospecting B es la más cara del embudo Lead form ads y la más cara de las siete **empatada** con
  «Remarketing interacción», también $168. «Más alto» sin cifra tapa el empate.
- **Estado:** **incalculable hoy.** El numerador es gasto y no existe (§3.2 y §5.1 de
  `01-ACQUISITION.md`). Toda señal que use costo por calificado espera a que Meta esté conectado.

### 2.2 · Los umbrales de la señal 1

| cifra | dónde está escrita | qué es |
|---|---|---|
| 54 % | `AcquisitionView.jsx:119` | valor de afinidad de la entidad señalada. **Escrito**, y es `0,19·100 + 0,44·60 + 0,37·25 = 54,65` sobre las proporciones de `acquisition.js:24` sin redondear — un valor que la pantalla nunca dibuja |
| 72 % | `AcquisitionView.jsx:119` | valor de la entidad de referencia. **Escrito**, y es `0,45·100 + 0,39·60 + 0,16·25 = 72,4` sobre `acquisition.js:26`, también sin redondear |
| 100 / 60 / 25 | `acquisition.js:98` | los pesos que convierten los tres tramos en la métrica. **Escritos**, y sin origen de negocio: imponen un **piso de 25 %** a la escala |
| 75 / 50 | `lib/aios/leads-group.js:10` | los cortes alto/medio/bajo. **Escritos, pero fuera de Acquisition**: los pone el cajón de contactos |
| cuántos puntos de diferencia disparan la señal | — | **hay que decidirlo.** La señal enseña una brecha de 18 puntos y no dice que 18 sea el umbral |
| cuánto más alto es «más alto» | — | **hay que decidirlo** |
| qué separa `warn` de `crit` | — | **hay que decidirlo.** Las dos señales son `warn` y no hay ninguna otra en la pantalla |

---

## 3 · Señal 2, transcripta y desarmada

### 3.1 · El literal

- **Rastro:** `components/views/AcquisitionView.jsx:126-141`
- **Severidad:** `warn`. Ícono `↻`, mismo fondo y mismo color que la señal 1 (`:127-129`).
- **Título:** «Fuga entre formulario y landing VSL en Booking directo»
- **Diagnóstico:** «Una parte de quienes completan el formulario no llega a ver la VSL. Es el salto
  más caro de los tres funnels.»
- **Acción:** `<span className="ev">Ver evidencia</span>` (`:138-140`).

### A6-09 · La segunda clase de señal compara dos etapas contiguas dentro de un embudo

La señal 1 compara entidades; ésta compara **eslabones**. El título nombra las dos etapas por su
etiqueta —«formulario» es `labels.forms` = «Completaron form» y «landing VSL» es `labels.clics` =
«Clics a landing VSL», `acquisition.js:16`— y el embudo que las contiene.

- **Rastro:** `AcquisitionView.jsx:132`, contra `acquisition.js:15-16`.
- **Requisito de modelo que esto impone:** la entidad de esta señal es un **par ordenado de etapas
  dentro de un embudo**, no una campaña. El §18.13 pide `entity_type` / `entity_id` y este caso
  necesita dos identificadores, no uno.
- **Estado:** de las dos etapas que la señal compara, **ninguna existe.** No hay tabla de eventos de
  formulario en `negocio.*` —21 tablas revisadas una por una— y un clic no queda registrado en
  ninguna parte de esta base (`01-ACQUISITION.md` §5.3). El único rastro es «Last Landing URL» (99 de
  233), que dice dónde cayó quien **ya** se convirtió en contacto, nunca cuántos la vieron. Es la
  señal más lejos de poder emitirse de las dos.

### A6-10 · «El salto más caro» nombra dos cantidades distintas y hay que elegir una antes de publicarlo

Ésta es la regla que produciría la señal 2, y no se puede escribir sin resolver una ambigüedad que
el módulo hace visible.

El módulo calcula el costo de una etapa como **la inversión entera del embudo dividida por el
volumen de esa etapa** (`acquisition.js:190` en la tarjeta, `:225` en la tabla). Con esa definición,
«el salto más caro» admite dos lecturas y **dan respuestas opuestas**. Reproducido en `p7`:

| lectura | qué mide | resultado |
|---|---|---|
| **(a) el costo unitario de la etapa de llegada** | `inv / clics` | Booking directo **$37,10**, Lead form ads $26,83, Profile funnel $15,60 → la señal **acierta** |
| **(b) el incremento de costo que produce el salto** | `inv/v_i − inv/v_{i−1}` | Profile clics→agendados **+$62,40**, Lead form clics→agendados +$59,86, Lead form contactos→clics +$16,30, **Booking forms→clics +$14,62** → la señal **se equivoca** |

Y hay una tercera cosa que la señal insinúa y no es ninguna de las dos: «fuga» sugiere una tasa de
paso mala. Medida, Booking retiene 20 de 33 entre formulario y landing, **60,6 %**.

**La regla, entonces:** una señal de fuga declara si «caro» es el costo unitario de la etapa o el
incremento del salto, y publica la cifra. Sin esa declaración, la misma frase es verdadera y falsa
al mismo tiempo sobre los mismos números.

Y una nota de por qué la lectura (a) engaña aunque dé «verdadero»: el C/clic de Booking directo es el
más alto **porque ese embudo tiene una etapa más** (`forms`, `acquisition.js:15`), así que su
inversión se reparte entre menos clics. La cifra alta describe la forma del embudo, no una fuga.

### A6-11 · La señal de fuga lleva su pérdida, contada en personas

«Una parte de quienes completan el formulario» es la única cantidad del diagnóstico, y no es una
cantidad.

- **Rastro:** `AcquisitionView.jsx:135`. El diagnóstico de la señal 2 **no trae ninguna cifra**,
  contra las dos que trae el de la señal 1 (`:119`). Dos señales de la misma tarjeta con dos
  contratos distintos.
- **La forma completa ya existe en el sistema, en otro departamento:** los hallazgos de Conversion
  (`lib/aios/conversion.js:43-78`) traen `loss`, la pérdida **en contactos**, y el que Conversion le
  dirige a Acquisition la trae también: `loss:48` (`conversion.js:62-64`). Acquisition recibe señales
  con pérdida cuantificada y emite señales sin ella.
- **Requisito:** la pérdida se publica en la unidad del departamento receptor —contactos, no
  porcentaje— porque es lo que permite ordenar las señales por impacto, que es lo que
  `conversion.js:312` ya hace con `b.loss - a.loss`.

### 3.2 · Los umbrales de la señal 2

| cifra | dónde está escrita | qué es |
|---|---|---|
| ninguna | `AcquisitionView.jsx:134-136` | el diagnóstico entero no tiene un solo número |
| qué tasa de paso es una «fuga» | — | **hay que decidirlo** |
| qué define «caro» | — | **hay que decidirlo**, y la decisión cambia el resultado (ver A6-10) |
| cuánta pérdida hace que la señal se publique | — | **hay que decidirlo**, con el piso de A6-02 encima |

---

## 4 · La forma del objeto de señal, que las dos comparten

### A6-12 · Cinco partes por señal, y el encabezado renuncia a recomendar

Las dos señales tienen exactamente la misma estructura, y es el contrato:

1. **Severidad**, expresada como color e ícono (`AcquisitionView.jsx:111`, `:127`).
2. **Título** con la entidad nombrada (`:116`, `:132`).
3. **Diagnóstico** en una frase (`:119`, `:135`).
4. **Acción de evidencia** (`:122`, `:138`).
5. El encabezado de la tarjeta: «**Señales detectadas** · *sin recomendación automática*» (`:105-108`).

La quinta parte es un requisito de producto, no una etiqueta: **el bloque describe lo que detectó y
no dice qué hacer.** Lo accionable vive en el modal del plan, detrás de un clic deliberado. Es la
separación que el §18.9 / §18.10 pide entre recomendación operativa y decisión ejecutiva, y la
pantalla la implementa como dos lugares distintos.

- **Detalle de implementación que importa al portarlo:** la severidad no es un dato, es CSS escrito
  a mano en cada señal. Las clases `.sig`, `.si`, `.st-t`, `.st-d` y `.ev` viven en
  `app/aios.css:585-590` y un `grep` de `className="sig"` sobre `lib/` y `components/` devuelve
  **exactamente dos líneas, las dos de esta pantalla**. Es un bloque de estilo escrito para un solo
  departamento; no hay un componente de señal compartido del que colgarse.
- **Estado:** no hay dónde guardar una señal de Acquisition. `negocio.hallazgos` es la tabla de
  alertas del sistema y es de Conversation: sus 20 filas tienen `contacto_id` poblada y sus columnas
  son `analisis_id`, `agente`, `patron`, `criterio`, `fragmento_prompt`. Una señal de Acquisition es
  sobre una campaña, un ad set o un anuncio, y **no existe el par `entity_type` / `entity_id`** que
  el §18.13 pide (`01-ACQUISITION.md` §5.4).

### A6-13 · La severidad es un juego cerrado, y hoy no se ejerce

- **Rastro:** las dos señales de Acquisition son `warn`. El juego completo está en otros
  departamentos: `lib/aios/executive-panel.js:6-34` usa `crit`, `warn`, `ok` e `info`, y
  `lib/aios/conversion.js:43-78` usa `critica`, `alta` y `media` en un campo `sev` separado del
  `color`. **Son dos vocabularios distintos para lo mismo dentro del mismo sistema.**
- **Requisito:** Acquisition publica severidad en el mismo vocabulario que Executive lee, porque
  Executive dibuja el estado del departamento con tres valores —`st:'warn'` en
  `lib/aios/executive.js:178`— y un conteo de asuntos abiertos escrito en el SVG del organigrama
  («2 a revisar», `components/views/ExecutiveView.jsx:236-247`).
- **Pregunta abierta:** qué regla convierte las señales abiertas en ese color y en ese conteo.
  Ningún archivo la escribe.

---

## 5 · «Ver evidencia»: el requisito que el prototipo enuncia y no implementa

### A6-14 · Toda señal muestra las filas que la produjeron

- **Rastro:** `AcquisitionView.jsx:122-124` y `:138-140` — `<span className="ev">Ver evidencia</span>`,
  dos veces, sin ningún atributo de datos y sin ningún `id`.
- **Comprobado:** un `grep` de `className="ev"` y de cualquier escuchador sobre `.ev` en `lib/`,
  `components/` y `app/` devuelve **esas dos líneas y ningún manejador**. El CSS sí está y sí lo
  promete: `app/aios.css:590` le da `color: var(--accent)` y **`cursor: pointer`**. La pantalla
  dibuja un control que se ve clicable, cambia el cursor al pasar por encima y no hace nada.
- **No es un olvido del porteo:** el maquetado original trae las mismas dos líneas sin cablear
  (`aios-command-center_1.html:2733` y `:2739`). Nació así.
- **Y no es la norma del sistema:** el «Ver evidencia →» de Conversion **sí funciona**. Se dibuja en
  `lib/aios/conversion.js:327` dentro de un bloque con `data-step`, y `bindSteps()`
  (`conversion.js:567-574`) engancha `#v-conversion [data-step]` a `openStep()`, que abre el cajón
  con el detalle de ese paso. Acquisition es la única señal de la aplicación cuyo botón de evidencia
  no lleva a ninguna parte.

### A6-15 · La evidencia de una señal de Acquisition son dos cosas distintas, y una de las dos ya tiene contrato

Las dos señales piden evidencias de naturaleza distinta, y hay que decirlo porque el prototipo tiene
una resuelta y la otra no:

- **Señal 1 (afinidad ICP de una campaña)** → la evidencia son **contactos**. El contrato existe y
  está en uso en esta misma pantalla: cuatro atributos —`data-leads` (título),
  `data-n` (conteo), `data-seg` (tramo de ICP) y `data-sub` (contexto)— que un delegado global en
  `document` convierte en el cajón de contactos (`lib/aios/leads-group.js:79-85`, emitidos en
  `acquisition.js:153-154`, `:177-178`, `:186-187`, `:223-224`, `:231-232`). La señal 1 tendría que
  emitirlos y no emite ninguno.
- **Señal 2 (un salto entre dos etapas de un embudo)** → la evidencia **no son contactos**: es la
  tarjeta del embudo con las dos etapas resaltadas, o la tabla de campañas filtrada a ese embudo.
  El patrón ya está implementado para otra cosa en `lib/aios/executive-panel.js:58-62`: un bloque
  «Dónde está la evidencia» con `data-jump`, que cierra el panel y navega a la sección.

**Requisito:** el destino de «Ver evidencia» es la cohorte cuando la señal es sobre personas y la
entidad de pantalla cuando la señal es sobre una etapa o una campaña. Los dos mecanismos existen; lo
que falta es que la señal declare cuál le corresponde.

### A6-16 · Lo que el drill-down manda hoy es un número, y una evidencia necesita la cohorte

- **Rastro:** `acquisition.js:153` pasa `data-n="' + Math.round(k[4]) + '"` — un **conteo**. Y
  `leads-group.js:31-36` fabrica la lista reciclando un `POOL` de 14 contactos inventados
  (`out.push(base[i % base.length])`) con tope de 40 filas.
- **Requisito:** una cifra que abre su evidencia manda **qué contactos son**, no cuántos. Lo que sí
  es requisito de forma y ya está decidido: el tope de filas, el rótulo «mostrando X de N» cuando la
  lista se recorta (`leads-group.js:43-44`), el puntaje ICP por contacto, el salto a GoHighLevel y el
  pie «Ver los N en Leads Portal →» que navega y preselecciona el tramo (`:60-70`).
- **Estado:** la mitad de esa ficha se puede llenar hoy —«Puntaje | ICP» en 229 de 233, origen por
  `atribucion_primera`— y la otra mitad no: costo del lead, ubicación, posición, objetivo y creativo
  salen de Meta y no existen.

---

## 6 · El Plan de acción: nueve recomendaciones en cuatro grupos

El modal es compartido con los otros departamentos; su título es fijo, «Recomendaciones y
conclusiones» (`components/Overlays.jsx:99-118`). Acquisition escribe el subtítulo y el cuerpo
(`lib/aios/acquisition-plan.js:5-31`).

### A6-17 · Cuatro grupos con semántica propia, en este orden

- **Rastro:** `acquisition-plan.js:8-28`.
- **Los cuatro:** «Lo que dice la data» (sin clase, 3 ítems) · «Ajusta o pausa esto»
  (`reco-group bad`, 2) · «Haz más de esto» (`reco-group good`, 2) · «Para otras áreas»
  (`reco-group idea`, 2).
- **Requisito:** el orden es lectura → freno → empuje → derivación, y el freno va **antes** del
  empuje. Es la misma prioridad que la tarjeta de señales enuncia al renunciar a recomendar: primero
  lo que está roto.
- **Detalle de forma que se sostiene solo:** el `<b>` marca la **entidad** de cada recomendación, y
  aparece en 3 de 3 ítems del primer grupo y en 2 de 2 del cuarto, y en **ninguno** de los cuatro
  ítems de los dos grupos de acción. Los grupos que describen nombran su sujeto; los que mandan, no.

### 6.1 · Grupo 1 — «Lo que dice la data» (`acquisition-plan.js:9-13`)

| # | literal | umbral | estado |
|---|---|---|---|
| 1 | «El **retargeting** produce los calificados más baratos y con mayor afinidad ICP, pero es el funnel con menos volumen.» (`:10`) | ninguno; tres superlativos | **incalculable** (dos de los tres dependen del gasto) |
| 2 | «**Prospecting B** trae contactos baratos con afinidad ICP de 43%, la mitad que el retargeting.» (`:11`) | **43 %**, y «la mitad» implica **86 %** | incalculable |
| 3 | «El salto más caro de los tres funnels está entre **formulario y landing VSL** en Booking directo.» (`:12`) | ninguno | incalculable; repite la señal 2 |

**A6-18 · Un superlativo se publica con el ranking que lo sostiene.** El ítem 1 afirma tres
superlativos sobre la misma entidad y los tres se pueden comprobar contra el propio modelo en `p7`:

- «los calificados más baratos»: «Retargeting 90d» da **$147** por calificado. La más barata de las
  siete es «Remarketing web» con **$66,5**, y también son más baratas «Público frío» ($95,2),
  «Reel de autoridad» ($126) y «Prospecting A» ($128,8).
- «mayor afinidad ICP»: la pantalla la dibuja en **25 %**, el piso de la escala. La mayor es
  «Remarketing web» con 80 %.
- «es el funnel con menos volumen»: «Retargeting 90d» es una **campaña**, no un embudo
  (`acquisition.js:25`, `f:'leadform'`). El plan usa las dos palabras como sinónimos.

**El ítem 2 es el único número del plan que sí sale del modelo**, y esto es lo interesante: **43 %
es exactamente lo que `build()` calcula** para Prospecting B en el período por omisión. Y es el
mismo campo del que la señal 1 dice 54 %. **Dos afirmaciones sobre la misma métrica de la misma
campaña, en la misma pantalla, con once puntos de diferencia**, porque una salió del cálculo y la
otra de las proporciones sin redondear. La regla A6-01 es lo que impide que eso vuelva a pasar: con
dos calificados, ninguna de las dos cifras se publica.

Y la coletilla «la mitad que el retargeting» implica un retargeting en 86 %, que no es ninguna de
las siete campañas bajo ninguna de las dos lecturas: la ponderada da 72,4 y la dibujada 25.

### 6.2 · Grupo 2 — «Ajusta o pausa esto» (`acquisition-plan.js:14-18`)

| # | literal | umbral | estado |
|---|---|---|---|
| 4 | «Deja de escalar Prospecting B por costo por contacto: su costo por calificado es el más alto.» (`:16`) | «el más alto», sin cifra | incalculable |
| 5 | «Revisa el paso de formulario a landing en Booking directo antes de subir inversión ahí.» (`:17`) | ninguno | incalculable |

**A6-19 · La regla de negocio que da sentido a toda la pantalla está en el ítem 4: la escala se
decide por costo por calificado, no por costo por contacto.** No es una recomendación, es el
criterio; es lo que justifica que la cadena de los tres embudos termine en calificados
(`acquisition.js:94`, `:210`) y lo que la nota bajo los KPIs enuncia al usuario
(`AcquisitionView.jsx:94-100`). Es también la pregunta que Executive pone sobre la mesa como decisión
pendiente: *«Definir si el costo por contacto o el costo por cita calificada manda en las decisiones
de escala»* (`lib/aios/executive-panel.js:16`). **La pantalla la da por respondida y el panel
ejecutivo la da por abierta.**

**Comprobado:** «su costo por calificado es el más alto» es cierto dentro de su embudo y **empatado**
fuera de él: en `p7`, Prospecting B da $168 y «Remarketing interacción» da $168 también. Un
superlativo que en realidad es un empate — el defecto que A6-18 evita.

### 6.3 · Grupo 3 — «Haz más de esto» (`acquisition-plan.js:19-23`)

| # | literal | umbral | estado |
|---|---|---|---|
| 6 | «Sube el presupuesto de retargeting mientras el costo por calificado se mantenga bajo $110.» (`:21`) | **$110**, moneda no declarada | incalculable |
| 7 | «Replica la segmentación de Prospecting A en los otros dos funnels.» (`:22`) | ninguno | incalculable |

**A6-20 · El $110 es el único umbral accionable de toda la pantalla, y viene con la forma completa
de una regla.** Trae los tres elementos que hacen falta: **una métrica** (costo por calificado), **un
operador** (por debajo de) y **una acción condicionada** («**mientras** se mantenga»). Esa forma es
el requisito: una recomendación accionable se escribe como condición vigente, no como orden puntual,
para que deje de valer sola cuando la métrica cruce el umbral.

**Y el umbral demuestra por qué A6-03 es obligatorio:** reproducido, el costo por calificado de
«Retargeting 90d» es **$147 en `p7`** —el período por omisión, el que el usuario ve al abrir— y
**$105 en `p30`**. La recomendación se lee al lado de una cifra que la contradice en un período y la
confirma en el otro, y el modal no sabe cuál está elegido.

**La moneda no está declarada en ninguna parte.** `cf` antepone un `$` escrito a mano y formatea en
`es-MX` (`acquisition.js:42`), Executive usa `en-US` para dinero (`lib/aios/executive.js:31`), y Meta
factura en la moneda de la cuenta publicitaria. Un umbral de dinero sin moneda no es un umbral.

### 6.4 · Grupo 4 — «Para otras áreas» (`acquisition-plan.js:24-27`)

| # | literal | umbral | estado |
|---|---|---|---|
| 8 | «La fuga de formulario a landing pertenece a **Conversion**.» (`:26`) | ninguno | **publicable hoy** |
| 9 | «La afinidad ICP de cada campaña se cruza en **Leads Portal**.» (`:27`) | ninguno | **publicable en parte** |

**A6-21 · Acquisition declara los límites de su jurisdicción y entrega el hallazgo con destinatario
nombrado.** Es el §18.16 dibujado y es el único grupo del modal que sobrevive entero al andamiaje:
no depende de ninguna cifra que falte. El destinatario es un departamento con nombre, igual que el
`to:'Acquisition'` con el que Conversion le manda su hallazgo a esta pantalla
(`lib/aios/conversion.js:64`).

**El ítem 9 tiene su contraparte escrita desde el otro lado**, lo que lo convierte en un contrato y
no en una opinión: la ficha de Leads Portal en Executive dice «Entrego a Acquisition qué campañas
traen el ICP que cierra» (`lib/aios/executive.js:201`) y el plan de Leads Portal cierra con «Qué
campañas traen ICP alto **se decide en Acquisition**» (`lib/aios/period-controls.js:56`).

**Nota que hay que resolver al portarlo:** la fuga que el ítem 8 entrega a Conversion es **la misma**
que la señal 2 reporta como propia (`AcquisitionView.jsx:132`). Un hallazgo no puede estar en los dos
lados: o Acquisition lo detecta y lo deriva, o lo detecta Conversion. Si lo deriva, la señal tiene
que decir a quién.

### A6-22 · Las dos recomendaciones de presupuesto cambian de grupo, no de redacción

Los ítems 4 («deja de escalar») y 6 («sube el presupuesto») son literalmente lo que el §18.10
prohíbe emitir en solitario: duplicar o reducir presupuesto, apagar anuncios, mover presupuesto,
declarar ganador, escalar únicamente por CPL.

- **Rastro:** `acquisition-plan.js:16` y `:21`, contra la regla 10 del §6 de
  `01-ACQUISITION.md`.
- **El problema no es el texto, es el lugar:** hoy están repartidas en dos grupos distintos —una en
  «Ajusta o pausa esto» y otra en «Haz más de esto»— como si fueran acciones del mismo rango que las
  demás. Hacen falta cinco grupos, no cuatro: el quinto es «Requiere validación ejecutiva», y las dos
  se mudan ahí con su redacción intacta.

### A6-23 · El plan se calcula sobre la ventana que dice mirar

- **Rastro:** `acquisition-plan.js:6` promete «periodo seleccionado» y `:7-28` es una cadena fija que
  no recibe el estado del módulo, no lee `build()` y no se regenera al cambiar el período.
- **El defecto concreto:** el usuario mueve las fechas, ve KPIs distintos y el mismo plan con los
  mismos umbrales. El caso medido está en A6-20: la recomendación del $110 se invierte entre `p7` y
  `p30` y el texto no cambia.
- **Qué sobrevive del texto fijo:** la forma de los cuatro grupos (A6-17) y el grupo de derivación
  (A6-21). Las siete recomendaciones restantes son plantillas con huecos: entidad, métrica, valor,
  comparación y —cuando son accionables— umbral y condición.

### A6-24 · El modal abierto no se declara oculto

- **Rastro:** `acquisition-plan.js:29-30` pone las clases `on` en `#recoScrim` y `#recoModal` y **no
  toca `aria-hidden`**. `components/Overlays.jsx:99-102` declara el modal con `aria-hidden="true"`,
  así que queda abierto y marcado como invisible para lectores de pantalla.
- **Comprobado por contraste:** `lib/aios/conversion.js:622` y `lib/aios/creative.js:348` y `:414`
  sí hacen `setAttribute('aria-hidden','false')` al abrirlo, y `creative.js:419` lo devuelve a
  `true` al cerrar. Acquisition y Leads Portal (`lib/aios/period-controls.js:58-59`) son los dos que
  no lo hacen.

---

## 7 · Los umbrales, juntos

**Escritos en el prototipo** — se heredan o se discuten, pero tienen rastro:

| umbral | dónde | qué gobierna |
|---|---|---|
| 54 % / 72 % | `AcquisitionView.jsx:119` | la brecha de afinidad de la señal 1 |
| 43 % / «la mitad» | `acquisition-plan.js:11` | la misma métrica, en el plan, con otro valor |
| **$110** | `acquisition-plan.js:21` | subir presupuesto de retargeting |
| 0,5 % | `acquisition.js:130` | por debajo, la variación se dibuja «=» y no una flecha |
| 100 / 60 / 25 | `acquisition.js:98` | los pesos de la afinidad; imponen un piso de 25 % |
| 75 / 50 | `lib/aios/leads-group.js:10` | los cortes de tramo ICP — **escritos fuera de Acquisition** |
| 10 | `lib/negocio/indicadoresDeCitas.ts:300` | el piso de publicación de toda tasa del sistema |
| 14 días | `lib/negocio/indicadoresDeCitas.ts:310` | la ventana del resto del sistema |

**Que hay que decidir** — el prototipo los usa sin declararlos:

| qué falta | por qué no se puede sacar del prototipo |
|---|---|
| cuántos puntos de caída de afinidad disparan una señal | la señal 1 muestra una brecha y no dice que sea el umbral |
| cuánto más caro es «más alto» en costo por calificado | la señal 1 y el ítem 4 del plan dicen la dirección, nunca la magnitud |
| qué tasa de paso es una «fuga» | la señal 2 no trae ninguna cifra |
| qué significa «caro» en un salto | dos lecturas posibles, resultados opuestos (A6-10) |
| cuánta pérdida hace publicable una señal | Conversion la cuenta en contactos (`conversion.js:62-64`); Acquisition no la cuenta |
| qué separa `warn` de `crit` | las dos señales son `warn` y no hay una tercera |
| qué convierte las señales abiertas en el estado del departamento y en «2 a revisar» | `executive.js:178` y `ExecutiveView.jsx:236-247` publican los dos valores sin regla |
| en qué moneda está el $110 | tres formatos distintos en el sistema y ninguno declarado |

---

## 8 · Preguntas abiertas

**Qué es un «calificado», porque las dos señales y varias de las recomendaciones cuelgan de
eso.** El prototipo lo deriva de agendados con una tasa por campaña (`acquisition.js:94`) y después
abre su cajón filtrado a ICP alto (`data-seg="alto"`, `:150`, `:178`, `:232`). En la base no hay
marca de calificación: hay un puntaje continuo, «Puntaje | ICP», poblado en 229 de 233 contactos, y
`negocio.resultados` tiene 7 filas y ninguna venta. Y el prototipo se contradice solo: la misma cifra
que se abre filtrada al tramo alto está dibujada al lado de una barra que la reparte en **tres**
tramos (`icpBar`, `:136-141`).

**Si la afinidad ICP que publica una señal es el ponderado de tramos o el promedio del puntaje.** Son
dos cifras distintas para el mismo nombre, y la diferencia ya causó las dos cifras incompatibles de
esta pantalla (54 % y 43 %). Con el puntaje continuo del CRM, el promedio directo no necesita cortes
ni pesos — y el piso de 25 % desaparece.

**Contra qué se compara una señal de afinidad: contra las otras campañas del mismo embudo o contra
la misma campaña en la ventana anterior.** El prototipo usa el verbo de un eje y la evidencia del
otro (A6-07), y el módulo no tiene ninguna comparación temporal de afinidad: `delta` se llama ocho
veces y ninguna sobre `icp`.

**A qué abre «Ver evidencia» en cada una de las dos señales.** Los dos mecanismos existen
—el cajón de contactos (`leads-group.js:79-85`) y el salto a sección (`executive-panel.js:58-62`)—
y ninguno está conectado a `.ev`.

**Dónde se guarda una señal de Acquisition y quién la cierra.** Falta la tabla con
`entity_type` / `entity_id` del §18.13, y falta el ciclo de vida: el hallazgo que Conversion le manda
a Acquisition trae `state:'visto'` y `age:'hace 2 días'` (`conversion.js:64`) y Acquisition no tiene
dónde escribir ninguno de los dos.

**De dónde sale el $110 y en qué moneda.** No tiene origen escrito en ninguna parte del repositorio.

**Si el plan se genera o se declara.** Hoy es doctrina fija con subtítulo dinámico. La forma de los
cuatro grupos sobrevive; las siete recomendaciones calculables necesitan sus umbrales como parámetros
declarados, no como literales en una plantilla.

**Quién es dueño de la fuga formulario → landing.** El ítem 8 del plan la entrega a Conversion y la
señal 2 la reporta como propia (A6-21).

**Qué se dibuja cuando una señal no llega al piso.** El conteo va (A6-02), pero la pantalla no tiene
renglón donde ponerlo: la tarjeta «Señales detectadas» sólo sabe dibujar señales.
