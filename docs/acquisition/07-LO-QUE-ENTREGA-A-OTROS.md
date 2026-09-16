# Lo que Acquisition entrega a otros

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

**Acquisition no tiene una sola línea de código que hable con otro departamento, y sin embargo ya
firmó cinco contratos.** Los firmaron otros: Executive dibuja su ficha con cuatro campos
(`lib/aios/executive.js:178-181`), le adjudica una etapa del funnel del negocio (`:23`), le pide el
gasto del que cuelgan el ROAS, el margen y el costo por venta (`:39`, `:96`, `:125`), publica un
conflicto suyo con Conversion (`lib/aios/executive-panel.js:12-16`), Conversion le manda un hallazgo
con once campos (`lib/aios/conversion.js:62-64`), el chat ejecutivo le ofrece tres preguntas
(`lib/aios/executive-chat.js:19`) y Leads Portal le adjudica una decisión
(`lib/aios/period-controls.js:56`). Acquisition emite `data-leads` en cinco lugares de su módulo y
no lee nada de nadie: **el único canal que existe de verdad en las dos direcciones es el cajón de
contactos**, y manda un número, no una lista.

Este documento es el contrato hacia afuera. Los requisitos van numerados `A7-nn` para poder citarse.

---

## 1 · La ficha del departamento en Executive

Al pasar el mouse por el nodo del organigrama, Executive dibuja una tarjeta de tres renglones con
títulos fijos. El contenido de esos tres renglones es lo que Acquisition tiene que poder entregar.

### A7-01 · Acquisition publica cuatro campos de ficha: un estado, su número, su hallazgo más caro y su dependencia con otra área

- **Rastro:** `lib/aios/executive.js:178-181` (el objeto), `:222-227` (el render).
- La ficha se arma con `st`, `num`, `find` y `dep`, y los tres renglones llevan título fijo:
  **«Su número»**, **«Lo que más cuesta»**, **«Con otras áreas»**. No hay campo opcional: los seis
  departamentos de `DEPT` (`:177-202`) traen los cuatro. La tarjeta se cachea por nodo
  (`tip.dataset.k`, `:220`), así que la ficha es **un objeto por departamento**, no un fragmento de
  HTML que se recalcule por cada movimiento del mouse.
- **Estado:** el número existe, el resto no. La ventana de 14 días tiene **233 contactos**
  (01-ACQUISITION.md §4), no los 312 escritos. `find` nombra una campaña que no existe y una
  inversión que no está guardada en ninguna tabla (§3.10).

### A7-02 · «Su número» es un conteo de contactos del período, con su variación y el nombre del período de comparación en la misma frase

- **Rastro:** `lib/aios/executive.js:179` — «312 contactos · +9% vs semana pasada».
- El número que Acquisition publica hacia arriba **es un volumen, no dinero ni una tasa**. Es
  coherente con lo que la propia pantalla declara en `components/views/AcquisitionView.jsx:94-100`:
  los totales son volumen y dinero, no tasas. Y la variación viene con el período contra el que se
  midió escrito en palabras, no como un porcentaje suelto: «+9%» sin «vs semana pasada» es un
  número que no se puede verificar.
- **Estado:** el conteo sí. La variación todavía no: **531 de 559 contactos (95,0 %) caen en los
  últimos 45 días** y antes de agosto de 2026 hay 28 en total (§3.3). Hoy la ficha tendría que
  publicar el conteo y decir que no hay período anterior, que es exactamente lo que
  `executive.js:58` ya hace para «hoy» e «histórico».

### A7-03 · «Lo que más cuesta» nombra la entidad, la métrica, el movimiento medido de esa métrica y la pérdida traducida a contactos

- **Rastro:** `lib/aios/executive.js:180` — «Prospecting B baja el ICP alto de 41% a 27% con 22% más
  de inversión · −110 contactos útiles».
- Cuatro piezas en una línea: **entidad** («Prospecting B»), **métrica con sus dos valores**
  (ICP alto, de 41 % a 27 %), **la métrica que agrava** (22 % más de inversión) y **la pérdida
  expresada en contactos**. La pérdida en contactos es la unidad común del sistema: es la misma que
  usa Conversion en `loss` (`lib/aios/conversion.js:64`). Un hallazgo sin pérdida cuantificada no se
  puede ordenar contra los de las otras áreas.
- **Estado:** ninguna de las cuatro piezas es calculable hoy entera. La entidad sí, con la clave
  correcta (`adId`, regla 1 del §6); el ICP por anuncio sí, con el puntaje continuo poblado en
  **229 de 233** contactos (§3.5); la inversión no existe (§3.2); y los «contactos útiles» dependen
  de una definición de calificado que no está tomada.

### A7-04 · «Con otras áreas» nombra al otro departamento y declara la dirección de la dependencia

- **Rastro:** `lib/aios/executive.js:181` — «Necesito que Conversion confirme si ese tráfico convierte
  peor o si es la página». Contraejemplos en la misma lista: `:189` («Entrego a Creative…»), `:201`
  («Entrego a Acquisition qué campañas traen el ICP que cierra»).
- Las seis fichas usan tres verbos: **«Necesito que…»**, **«Entrego a…»** y **«Recibo de…»** (`:185`,
  `:193`). La dirección es parte del dato, no de la redacción: una dependencia que no dice quién debe
  a quién no se puede cerrar, y con dos verbos el campo pierde el tercer caso que el prototipo ya
  tiene.
- **Estado:** el par Acquisition↔Leads Portal es **el único cumplible hoy**: el puntaje ICP por
  anuncio está medido y va de 27,5 («economia us latino», 19 contactos) a 73,9 («Evoluciona native»,
  31) (§3.5). Le falta la mitad que lo convierte en decisión: «el ICP que cierra» necesita ventas, y
  `negocio.resultados` tiene 7 filas y ninguna es una venta (§5 punto 5).

### A7-05 · El estado del departamento es un color de tres valores, y va acompañado de un conteo de asuntos abiertos

- **Rastro:** `lib/aios/executive.js:178` (`st:'warn'`), `components/views/ExecutiveView.jsx:239`
  (el círculo del nodo), `:246-247` (el rótulo «2 a revisar»).
- Los valores son `ok`/`warn`/`crit` y se dibujan en **dos lugares distintos**: el punto de la ficha
  y el círculo del nodo. El conteo de asuntos abiertos está escrito aparte, dentro del SVG, junto al
  rótulo «Campañas y tráfico». Los dos se ven desde la pantalla del jefe **sin entrar a la
  pestaña**.
- **Estado:** no existe. No hay tabla donde guardar una alerta de Acquisition: `negocio.hallazgos`
  está atada al contacto —sus 20 filas tienen `contacto_id` poblada— y no tiene el par
  `entity_type`/`entity_id` que hace falta para apuntar a una campaña (§3.7). Sin alertas guardadas
  no hay ni color ni conteo, y hoy los dos están escritos a mano.

---

## 2 · La etapa del funnel y la cifra de la que cuelga la pantalla del jefe

### A7-06 · Acquisition es dueña de la primera etapa del funnel del negocio, y su fila navega a su pantalla

- **Rastro:** `lib/aios/executive.js:23` (`{k:'contactos', t:'Contactos', own:'Acquisition',
  view:'acquisition'}`), render en `:41-53`, navegación en `:139-141`.
- La fila publica cinco columnas: **volumen**, **porcentaje del total**, **tasa de avance desde la
  etapa anterior** (`rates[i-1]`, `:51`; en la fila de Acquisition, que es la primera, el literal
  `100%`), **costo unitario** y el nombre del área dueña. La propiedad es un campo del modelo
  (`own`), no una nota: el rótulo del cuello de botella la lee para decir quién lo trabaja.
- **Estado:** el volumen sí (233 contactos con `alta_en_el_crm`, §4); el costo unitario no, porque
  su numerador es el gasto.

### A7-07 · El número de esa fila y el KPI «Contactos» de la pantalla son el mismo número

- **Rastro:** `lib/aios/executive.js:17` (`contactos:312` para 7 días) contra
  `lib/aios/acquisition.js:147` (`g.contactos`, sumado en `:117`).
- Hoy son dos constantes distintas que nadie cruza: Executive dice 312 y Acquisition deriva el suyo
  de `entD × días × mod`. **Es el requisito de integración más barato de cumplir y el más caro de
  incumplir**: dos pantallas del mismo sistema afirmando dos volúmenes distintos del mismo mes es lo
  que el §7 de 01-ACQUISITION.md llama un sistema que se contradice en la cara del usuario.
- **Estado:** medible hoy, y con la advertencia de la regla 6 del §6: la cohorte se arma con
  `alta_en_el_crm` y no con `creado_el` —233 contra 256 en la misma ventana— así que las dos
  pantallas tienen que usar la misma columna o van a diferir en 23 contactos sin que nada falle.

### A7-08 · Acquisition entrega el gasto crudo; el ROAS, el margen, el costo por venta y el costo de cada etapa los calcula Executive

- **Rastro:** `lib/aios/executive.js:39` (ROAS = `revenue/spend`), `:52` (costo de CADA etapa =
  `spend / volumen de la etapa`), `:96` (margen sobre ads = `revenue − spend`), `:125` (costo por
  venta = `spend / ventas`).
- Executive **no le pide un ROAS a Acquisition: le pide el gasto**. Es el reparto que el §18.8 fija
  —Acquisition no calcula revenue, CAC real ni ROAS real— y convierte al gasto en el dato de
  integración más caro del sistema: varias cifras de la pantalla del jefe caen juntas si falta, el
  mosaico «Inversión» incluido (`:115-116`). Nótese la forma del costo unitario: es el gasto ENTERO
  dividido por el volumen de cada etapa, la misma regla que usa Acquisition en su propia tarjeta
  (`lib/aios/acquisition.js:190`), así que las dos pantallas responden la misma pregunta —cuánto
  costó cada uno de los que llegaron hasta acá— y no dos preguntas parecidas.
- **Estado:** no existe. La búsqueda de columnas por `spend|gasto|invers|budget|presupuest|impres|
  reach|frecuen|cpm|cpc|ctr|cpl` sobre `negocio`, `public` e `identidad` devuelve tres coincidencias
  y **ninguna es gasto de Meta poblado** (§3.2). `public.closer_meta_metricas` tiene la forma exacta
  que hace falta —`nivel`, `objeto_id`, `padre_id`, `fecha`, `gasto`— y **0 filas**, y es de la
  plataforma anterior: un grep sobre todo el repositorio da cero coincidencias (§5 punto 2).

### A7-09 · El cuello de botella del funnel nombra al departamento dueño de la etapa

- **Rastro:** `lib/aios/executive.js:142-147` — «Cuello de botella · **Contactos** · solo avanza N%
  desde … · lo trabaja Acquisition ›».
- El rótulo se arma con `STEPS[worst+1].own`, o sea con el mismo campo de A7-06. Cuando la etapa
  peor es la de Acquisition, la pantalla del jefe **dice su nombre sin que Acquisition publique
  nada**. Es la consecuencia más directa de ser dueño de una etapa: la propiedad se ejerce en
  público aunque el departamento no haya emitido una sola cifra.
- **Estado:** calculable en cuanto existan los dos volúmenes de cada paso. Hoy la etapa de
  Acquisition es la primera y por construcción nunca puede ser el cuello (`rates` empieza en la
  segunda, `:37`): Acquisition sólo aparece como cuello si otra etapa se le adelanta, cosa que el
  índice no permite. **El dueño de la primera etapa nunca es señalado por este rótulo.**

### A7-10 · Subir la inversión se pinta en rojo

- **Rastro:** `lib/aios/executive.js:116` — `dl(d.spend, prev.spend, true)`, con `good = inv ? diff<0
  : diff>0` en `:61`.
- Executive pasa **`invert = true`** para el gasto: si la inversión sube, la flecha sale roja.
  Acquisition, con la misma regla y el mismo parámetro, pasa **`false`** en su KPI de Inversión
  (`lib/aios/acquisition.js:146`, con `good = invert ? d < 0 : d > 0` en `:129`): si la inversión
  sube, la flecha sale verde. **Las dos pantallas del mismo sistema pintan el mismo movimiento del
  mismo número con colores opuestos.** El requisito no es elegir un color: es que la dirección
  «buena» de una métrica sea un atributo de la métrica y viva en un solo lugar, porque hoy vive
  duplicada en dos módulos y las dos copias ya divergieron.
- **Estado:** el defecto es de código y no de datos, y se puede arreglar antes de que llegue el
  gasto. Vale la pena hacerlo antes: el §18.10 prohíbe recomendar escalar presupuesto en solitario,
  y una flecha verde por gastar más es esa recomendación dicha sin palabras.

---

## 3 · La tarjeta de conflicto con Conversion

Es el caso interesante del sistema: **dos departamentos que miran el mismo anuncio y concluyen lo
contrario**, sin que ninguno de los dos se equivoque.

> «Acquisition lo escala porque trae el contacto más barato del mes, a $19. Conversion muestra que
> ese tráfico convierte tres veces peor que el resto. **Ambas métricas son correctas.**»
> — `lib/aios/executive-panel.js:14`

### A7-11 · Un conflicto se publica con seis piezas: severidad, clase y cuántas áreas toca, el relato con las dos cifras que se contradicen, la frase que valida a las dos, la evidencia navegable por área y la pregunta a decidir

- **Rastro:** `lib/aios/executive-panel.js:12-16` (el objeto), `:49-69` (el cajón que abre),
  `:36-44` (la fila de la lista).
- Las seis piezas son `sev`, `sub`, `d`, la frase «Ambas métricas son correctas» dentro de `d`, `ev`
  y `ask`. El subtítulo tiene una gramática fija —**«contradicción · 2 áreas»**— que la distingue de
  los otros dos tipos del mismo feed: «cadena · Creative → Conversion → Sales» (`:8`) y «patrón ·
  Conversion» (`:18`). Un conflicto es, por forma, el tipo que nombra un número de áreas en vez de
  una secuencia.
- El cajón dibuja tres secciones con títulos fijos: **«Qué pasó»**, **«Qué hay que decidir»** y
  **«Dónde está la evidencia»** (`:54`, `:56`, `:58`). La pregunta a decidir no es una recomendación:
  «Definir si el costo por contacto o el costo por cita calificada manda en las decisiones de
  escala» es una decisión de negocio devuelta al jefe, no una acción sugerida a un área. Es el §18.10
  respetado en la estructura y no sólo en la redacción.

### A7-12 · Para que ese conflicto se detecte solo, Acquisition publica su costo por contacto **por anuncio** y **por la misma ventana** con la que Conversion publica su tasa

Éste es el requisito derivado, y se sostiene en tres condiciones que hoy no se cumplen ninguna.

- **Misma entidad.** La tarjeta señala «Prospecting B», un nombre. Acquisition identifica sus
  campañas por `n`, un texto (`lib/aios/acquisition.js:21-34`), y Conversion identifica su fuga como
  «Concentrado en una sola campaña» sin nombrarla (`lib/aios/conversion.js:63`). **Dos cifras que no
  cuelgan de la misma clave no se contradicen: se ignoran.** La clave tiene que ser `adId` —y
  `campaignId` para el nivel de arriba—, nunca el nombre: en la ventana, «El app» tiene DOS `adId`
  distintos (`120249633901550467` con 44 contactos y `120249792217700467` con 2) y «economia us
  latino» otros dos (regla 1 del §6). Agrupado por nombre, el conflicto se declara sobre una entidad
  que no existe.
- **Misma ventana.** La contradicción es «el contacto más barato **del mes**» contra una tasa de
  conversión que Conversion calcula sobre su propio período (`FACTOR`, `lib/aios/conversion.js:13`).
  Dos ventanas distintas producen contradicciones espurias y ocultan las reales. La ventana del resto
  del sistema son **14 días** (`lib/negocio/indicadoresDeCitas.ts:310`).
- **Métricas emparejadas y declaradas.** El conflicto no se detecta comparando dos métricas
  cualesquiera: se detecta porque **una es de costo por entrada y la otra de rendimiento por
  entrada**, y la barata resulta peor. La forma mínima que Acquisition tiene que exponer por anuncio
  es el par `{clave, ventana, contactos, costo_por_contacto}`, y el detector cruza eso con
  `{clave, ventana, tasa}` del otro lado. Es literalmente el caso 1 del §18.11 —CPL bajo con ventas
  bajas— convertido en consulta.
- **Estado:** de las tres condiciones, la clave existe (`adId` en 176 de 233, 80,4 % sobre los
  contactos de pauta, §4), la ventana existe (14 días con `alta_en_el_crm`) y **el costo por contacto
  no existe**, porque no hay gasto. Con lo que hay se puede detectar media contradicción: el volumen
  y la tasa de agendamiento por anuncio son medibles; el lado del dinero no.

### A7-13 · Un conflicto necesita que las dos cifras sigan publicadas con su definición al lado, porque la salida no es que una gane

- **Rastro:** `lib/aios/executive-panel.js:14` («Ambas métricas son correctas») y `:16` (la pregunta).
- La tarjeta **no resuelve** la contradicción y no marca a un ganador: publica las dos, afirma que
  las dos son correctas y devuelve la decisión. Eso impone un requisito sobre Acquisition que es
  fácil de perder al implementar: **su costo por contacto no se puede reemplazar por el costo por
  calificado** cuando aparece el conflicto. Si Acquisition dejara de publicar el costo por contacto
  porque «el que manda es el otro», la contradicción desaparecería de la pantalla del jefe sin
  haberse resuelto — y la decisión de `ask` es precisamente cuál de los dos manda.
- **Estado:** la pantalla ya publica los dos costos en la misma fila de tabla: `Costo/calif.` en
  `lib/aios/acquisition.js:236` y el costo de la etapa de entrada en `:225`. La estructura está; lo
  que falta es el numerador.

### A7-14 · La evidencia de un conflicto es una lista de destinos navegables, uno por área implicada

- **Rastro:** `lib/aios/executive-panel.js:15` (`ev:[['Acquisition','acquisition'],['Conversion',
  'conversion']]`), render en `:58-62`, navegación en `:63-66`.
- Cada elemento es un par **nombre visible + clave de vista**, y el botón dice «Ir ▸». La navegación
  cierra el cajón y hace clic en la fila del menú, o sea que **respeta el alcance por persona**: si
  quien mira no tiene la fila de Acquisition, el salto no ocurre en vez de llevarlo a una pantalla
  que no le corresponde. Es el mismo patrón que el chat ejecutivo usa para sus fuentes
  (`lib/aios/executive-chat.js:99-102`).
- **Estado:** cumplible hoy — es navegación, no dato. La sección `acquisition` existe en
  `lib/autorizacion/secciones.ts:242-247` con `capacidadRequerida: 'tablero.ver'`.

---

## 4 · Los hallazgos que entran

### A7-15 · Acquisition recibe hallazgos de otros departamentos con once campos

- **Rastro:** `lib/aios/conversion.js:62-64` — el único hallazgo del sistema dirigido hoy a
  Acquisition.

```
{step:'sesiones', ic:'⏱', color:'warn', sev:'media',
 t:'Rebote antes de 3 segundos',
 d:'Concentrado en una sola campaña. El tráfico llega sin contexto de la oferta.',
 loss:48, dev:'Todos', to:'Acquisition', state:'visto', age:'hace 2 días'}
```

- Los campos y lo que significa cada uno: **`step`** la etapa del emisor donde ocurre, **`ic`** el
  ícono, **`color`** el color de la señal, **`sev`** una de cuatro severidades
  (`critica|alta|media|menor`, `:42`), **`t`** el título, **`d`** el diagnóstico, **`loss`** la
  pérdida en contactos, **`dev`** el segmento donde ocurre, **`to`** el destinatario, **`state`** el
  ciclo (`nuevo|visto`) y **`age`** la antigüedad. Un hallazgo entrante sin destinatario y sin estado
  no se puede trabajar: son los dos campos que lo convierten en una bandeja y no en una lista de
  lectura.
- **Estado:** no hay dónde guardarlo. `negocio.hallazgos` es la tabla de Conversation: 20 filas,
  todas con `contacto_id` poblada, columnas `analisis_id`, `agente`, `patron`, `criterio`,
  `fragmento_prompt` (§3.7). Falta el par `entity_type`/`entity_id` del §18.13 y falta el
  destinatario.

### A7-16 · El hallazgo entrante viaja con su acción concreta, escrita aparte

- **Rastro:** `lib/aios/conversion.js:97-105` (el mapa `ACTIONS`), la entrada de Acquisition en
  `:104` — «Alinear el mensaje del anuncio con el encabezado de la landing».
- La acción **no está dentro del objeto del hallazgo**: vive en un mapa tecleado por el título
  (`ACTIONS[x.t] || x.t`, `:600`). La separación es deliberada y conviene conservarla: el hallazgo
  describe lo que se midió y la acción dice qué hacer, y son dos cosas que se revisan por separado
  —**seis de los once hallazgos de Conversion tienen acción y cinco no**, y el que no la tiene cae a
  mostrar su propio título. Un hallazgo sin acción sigue siendo válido; una acción sin hallazgo no.

### A7-17 · La pérdida viene en contactos y se escala con el período que se está mirando

- **Rastro:** `lib/aios/conversion.js:311` y `:578` — `loss: Math.round(x.loss * f)`, con `f =
  FACTOR[cvPeriod]`.
- La pérdida **no es un número fijo del hallazgo: es una cifra de la ventana**. El mismo hallazgo
  vale 48 contactos en un período y otra cosa en otro. Para Acquisition eso significa que un hallazgo
  recibido no se puede archivar con su pérdida congelada: la pérdida se recalcula cada vez que se
  mira, contra la ventana que se está mirando.
- **Estado:** el `FACTOR` del prototipo es un multiplicador inventado, pero el requisito de forma
  sobrevive entero — es la misma exigencia del §18.4 de guardar las métricas por fecha para poder
  rehacer cualquier ventana.

### A7-18 · Hoy el hallazgo se dibuja en la pantalla del que lo emite, nunca en la del destinatario: Acquisition no tiene bandeja

- **Rastro:** `lib/aios/conversion.js:326`, `:383` y `:601` — las tres veces el texto es **«lo
  resuelve Acquisition»**, y las tres están dentro del render de Conversion. Un grep de
  `to:'Acquisition'` da una sola coincidencia (`:64`) y ninguna en `lib/aios/acquisition.js`.
- El campo `to` existe, se muestra y **no llega a destino**. La pantalla de Acquisition no tiene
  ningún bloque de entrada: su única lista es «Señales detectadas»
  (`components/views/AcquisitionView.jsx:103-142`), que son dos alertas propias escritas a mano. El
  requisito que esto expone es el que falta implementar: **el destinatario de un hallazgo lo ve en su
  propia pantalla**, con su estado y su antigüedad, o el campo `to` es una etiqueta decorativa.
- **Estado:** es un hueco de interfaz, no de datos. Se puede construir antes de que exista una sola
  cifra real, porque lo único que necesita es la tabla de alertas con destinatario.

### A7-19 · Los dos botones de evidencia de las señales propias no están cableados a nada

- **Rastro:** `components/views/AcquisitionView.jsx:122-124` y `:138-140`
  (`<span className="ev">Ver evidencia</span>`).
- Un grep de `className="ev"` y de cualquier escuchador sobre `.ev` en `lib/`, `components/` y `app/`
  devuelve **exactamente esas dos líneas y ningún manejador**; lo único que existe es el
  `cursor: pointer` de `app/aios.css:590`. Es un requisito enunciado por la maqueta y no
  implementado: **toda señal tiene que poder mostrar en qué se basa**, y la evidencia de Acquisition
  no puede ser la lista de contactos sin más, porque una anomalía de CPM o de frecuencia no se
  explica con personas.
- **Comparar con** `lib/aios/executive-panel.js:58-66`, donde la misma idea sí está implementada: una
  lista de destinos navegables con su clave de vista. Es el patrón que le falta a estas dos señales.

---

## 5 · Las preguntas que la pantalla tiene que poder contestar

### A7-20 · Tres preguntas exactas, y aparecen sólo cuando la pantalla abierta es Acquisition

- **Rastro:** `lib/aios/executive-chat.js:19`, servidas en `:61-62`.
  1. **«¿Qué campaña escalo?»**
  2. **«¿Cuál trae el ICP que cierra?»**
  3. **«¿Hay fatiga en algún anuncio?»**
- Son tres capacidades comprometidas en público: comparar campañas por una métrica de escala, cruzar
  anuncio × ICP × cierre, y detectar fatiga. Nótese que la primera pregunta es **justo la decisión
  que el §18.10 prohíbe tomar en solitario**: «¿qué campaña escalo?» sólo se puede contestar
  entregando las cifras y la comparación, no con un nombre.
- **Estado, una por una.** La segunda tiene la mitad: el ICP por anuncio está medido y va de 27,5 a
  73,9 (§3.5), y le falta el cierre —cero ventas registradas (§5 punto 5)—. La primera necesita
  gasto. **La tercera es la que más lejos está**: la fatiga es frecuencia contra CTR en el tiempo, y
  ni frecuencia, ni CTR, ni serie diaria existen (§3.12).

### A7-21 · Sin sugerencias propias no se muestra ninguna, y el motivo está escrito en el código

- **Rastro:** `lib/aios/executive-chat.js:58-62` — `(SUGG[v] || [])`, con el comentario que explica
  por qué no hay fallback: «Una sugerencia de otra pantalla es peor que ninguna: se lee como si el
  panel supiera de ésta».
- Es un requisito de honestidad ya resuelto y que conviene no romper al implementar: si Acquisition
  no puede contestar una pregunta, la respuesta correcta es no ofrecerla, no ofrecerla y fallar.

### A7-22 · Una respuesta trae su texto y la lista de áreas de las que salió, navegables

- **Rastro:** `lib/aios/executive-chat.js:30-39` (el mapa `ANSWERS`), render en `:96-102`.
- Cada respuesta es `{t, src}`, donde `src` es una lista de pares nombre + clave de vista, la misma
  forma que la evidencia del panel ejecutivo (A7-14). **Ninguna de las cuatro respuestas tiene a
  Acquisition como fuente**: las cuatro citan Conversion, Creative, Sales y Leads Portal, y
  `'acquisition'` no aparece en ningún `src`. La pantalla ofrece tres preguntas que el panel no sabe
  contestar con datos de Acquisition — y como `pick()` (`:77-83`) cae en `ANSWERS.default` cuando no
  reconoce el texto, las tres preguntas de Acquisition hoy devuelven **la respuesta de Conversion
  sobre el paso de landing a agendamientos**.
- **Estado:** el defecto es de código. Cuando Acquisition tenga cifras, lo que tiene que publicar
  para este panel es la terna `{respuesta, cifras que la sostienen, áreas de origen}`.

### A7-23 · El panel declara con qué pantalla y con qué período está respondiendo

- **Rastro:** `lib/aios/executive-chat.js:52-57` — `askScope`, `askCtx` y `askCtxP`, que lee el botón
  de período activo con `'#exPeriod button.on, #cvDateSeg button.on, .db-seg button.on'`.
- `document.querySelector` devuelve el primero del documento que cumpla cualquiera de los tres, y
  Executive se dibuja antes que Acquisition (`components/CommandCenter.jsx:79`) con su propio `.on`
  escrito en el JSX (`components/views/ExecutiveView.jsx:55`): el panel escribe el período de
  Executive, no el de esta pantalla. Cae a `'periodo actual'` cuando no encuentra ninguno. El
  requisito, hoy sin cumplir: cualquier respuesta sobre Acquisition viene con la ventana con que se
  calculó escrita al lado.

---

## 6 · El drill-down: cada cifra abre la lista de contactos que la produjo

### A7-24 · El contrato son cuatro atributos de datos sobre la cifra, y un solo escuchador global

- **Rastro:** `lib/aios/acquisition.js:153-154` (la emisión), `lib/aios/leads-group.js:79-85` (el
  escuchador).
- Los cuatro: **`data-leads`** el título del cajón, **`data-n`** el conteo, **`data-seg`** un tramo de
  ICP con el que preseleccionar, **`data-sub`** la línea de contexto. El escuchador es un delegado en
  `document` que hace `e.target.closest('[data-leads]')`, o sea vale para **cualquier cifra de
  cualquier pantalla** sin registrar nada. Acquisition escribe tres valores distintos de `data-sub`:
  `'Acquisition · los 3 funnels'` (`:154`), `'Acquisition · ' + nombre del embudo` (`:178`, `:187`) y
  `'Acquisition'` a secas en las tablas (`:224`, `:232`).

### A7-25 · Cinco sitios de emisión, y son los que definen qué cifras se pueden abrir

- **Rastro:** `lib/aios/acquisition.js:153` (los KPIs), `:177` (los calificados de la tarjeta de
  embudo), `:186` (cada etapa de la tarjeta), `:223` (cada celda de etapa de la tabla), `:231` (los
  calificados de cada fila de la tabla). Son las **cinco** apariciones de `data-leads` en el módulo.
- Traducido a pantalla: **cuatro de los cinco KPIs**, las diez etapas de las tres tarjetas, los tres
  bloques de calificados, y en cada tabla desplegada una celda por etapa y fila más la de
  calificados. El requisito no es «nueve cifras»: es que **ningún volumen de Acquisition sea un
  número sin lista detrás**, ni en el encabezado, ni en las tarjetas, ni en las tablas, ni en la fila
  de total.
- **Estado:** de los volúmenes que hoy abren lista, **contactos y agendados son reproducibles**
  (233 contactos con `alta_en_el_crm`; 163 citas alcanzables con `ghl_calendario_id is not null`
  sobre 149 contactos, §4), **clics no existe en ninguna tabla** (§5 punto 3) y **calificados no
  está definido**.

### A7-26 · La inversión es el único KPI que no abre lista, y está bien

- **Rastro:** `lib/aios/acquisition.js:146` (quinto campo `0`) y `:153` (`k[4] ? … : ''`).
- El quinto elemento del arreglo del KPI es el conteo, y la Inversión pasa `0`, así que el
  condicional no emite ningún atributo. **El dinero no se explica con una lista de personas.** La
  misma regla se cumple sola en el resto de la pantalla: los costos por etapa (`:190`, `:225`), el
  costo por calificado (`:201`, `:236`) y la afinidad ICP (`:237`) tampoco llevan `data-leads`.

### A7-27 · Los calificados abren filtrados al tramo alto de ICP, y el corte vive fuera de Acquisition

- **Rastro:** `data-seg="alto"` en `lib/aios/acquisition.js:150`, `:178` y `:232`; el corte en
  `lib/aios/leads-group.js:10` — `SEG = v => v >= 75 ? 'alto' : v >= 50 ? 'medio' : 'bajo'`.
- Las tres cifras de calificados —el KPI, la del embudo y la de cada fila de tabla— son las únicas
  que llevan segmento. El corte **no está declarado en ninguna parte de Acquisition**: lo pone el
  cajón. Lo que hay que decidir es si Acquisition lo adopta como propio.
- **Contradicción de la propia pantalla:** la misma cifra que se abre filtrada al tramo alto está
  dibujada al lado de una barra que reparte a **esos mismos calificados en tres tramos**
  (`icpBar`, `:136-141`, usada en `:182` y `:238`). O «calificado» significa «ICP ≥ 75» —y entonces la
  barra de tres tramos no describe a los calificados— o son dos cosas distintas y el filtro está mal.
  El prototipo no lo decide.
- **Estado:** aplicable hoy. «Puntaje | ICP» está poblado en **229 de 233** contactos de la ventana
  (§3.5), así que el corte 75/50 se puede aplicar sin inventar nada. Lo que falta es la definición de
  calificado, no el puntaje.

### A7-28 · El contrato manda un conteo, no una cohorte, y ése es el requisito que falta

- **Rastro:** `lib/aios/leads-group.js:83` — `open({ n: +el.dataset.n || 0, seg: …, title: …, sub: … })`,
  y `sample(n, seg)` en `:31-37`, que rellena la lista repitiendo un `POOL` de catorce contactos
  inventados (`out.push(base[i % base.length])`).
- El cajón recibe **cuántos**, no **cuáles**, y por eso puede fabricar la lista. Un sistema real
  manda la cohorte o el filtro que la produce. Es el requisito más importante de esta sección y el
  que decide si el drill-down es real: hoy una cifra y su lista **no comparten origen**, así que la
  lista puede contradecir al número sin que nada falle.
- **Estado:** el filtro que produce cada cohorte es escribible hoy para dos de las cinco cifras:
  contactos de la ventana por anuncio (`alta_en_el_crm` entre dos fechas + `atribucion_primera->>'adId'`)
  y agendados (join con `negocio.citas` y `ghl_calendario_id is not null`).

### A7-29 · El cajón dice cuándo está mostrando menos de lo que contó

- **Rastro:** `lib/aios/leads-group.js:43-44`.
- El contador escribe **«N contactos»** o **«mostrando X de N»** cuando la lista se recorta. Es la
  regla de los dos ceros aplicada al listado: una lista más corta que su cifra lo dice en vez de
  dejar que el lector cuente.

### A7-30 · Cada fila del cajón trae puntaje ICP coloreado por tramo, nombre, «origen · estado», el monto si vendió y un salto a GoHighLevel

- **Rastro:** `lib/aios/leads-group.js:45-53`, el salto en `:54-56`, la ficha del contacto en `:57-59`.
- El origen tiene una gramática fija: **«Campaña · Creative»** (`'Prospecting B · Creative 07'`). Es
  lo mínimo que una fila de esta lista tiene que traer para que abrirla desde Acquisition tenga
  sentido: sin campaña y sin creativo, la lista de una cifra de Acquisition no dice de dónde salió
  cada persona.
- **Estado:** el puntaje sí (229 de 233); el nombre de campaña sí (219 de 233) y el del anuncio
  también (`utmContent`, 220 de 233); **el creativo no existe** —`meta_creative_id` no está en
  ninguna tabla (§5 punto 1)— así que la segunda mitad del «origen» hay que llenarla con el anuncio o
  dejarla fuera. La forma completa de la ficha publicitaria por persona está en
  `lib/aios/leads-portal.js:265-272`: once campos de publicidad y cuatro UTM.

### A7-31 · El pie del cajón navega a Leads Portal y preselecciona el tramo de ICP con el que se abrió

- **Rastro:** `lib/aios/leads-group.js:60-69`; los botones destino en
  `components/views/ContactsView.jsx:58-74` (`data-i` con `all|nc|alto|medio|bajo`).
- El pie dice **«Ver los N en Leads Portal →»** y al pulsarlo cierra el cajón, hace clic en la fila
  del menú de contactos y después en el botón del tramo. El requisito: el drill-down **no termina en
  el cajón**, continúa en la pantalla que sabe de contactos, conservando el filtro. Nótese que
  Acquisition sólo emite `alto`, que es uno de los cinco valores que el destino acepta.

### A7-32 · El escuchador es del sistema: la misma cifra de Acquisition se abre desde la pantalla del jefe, nombrando a Acquisition

- **Rastro:** `lib/aios/executive.js:49` — `data-leads="${s.t}" data-n="${vals[i]}"
  data-sub="Executive · ${s.own}"`, que para la primera etapa produce `data-sub="Executive ·
  Acquisition"`.
- La fila «Contactos» del funnel del negocio abre **el mismo cajón** que el KPI «Contactos» de
  Acquisition, con el mismo contrato de cuatro atributos y otro subtítulo. Es la consecuencia
  práctica de A7-07: si los dos números no coinciden, la contradicción se ve **dentro del mismo
  cajón**, abierto desde dos pantallas distintas.

---

## 7 · Lo que Acquisition declara ante la capa de autorización

### A7-33 · Acquisition se ve con permiso de tablero y declara que todavía no expone ninguna operación

- **Rastro:** `lib/autorizacion/secciones.ts:242-247` — clave `acquisition`,
  `capacidadRequerida: 'tablero.ver'`, `sinOperacionesTodavia: true`, grupo de menú «Inteligencia».
- La bandera es literal y comprobable: `ls app/api/` devuelve 17 carpetas y **ninguna es
  `acquisition`** (§2). El día que la pantalla lea datos, esa bandera y ese endpoint son el primer
  cambio, y con ellos la pregunta de alcance que hoy no existe: **qué campañas puede ver quién**.

### A7-34 · Los dos paneles que Acquisition abre quedan marcados como ocultos para lectores de pantalla

- **Rastro:** `lib/aios/acquisition-plan.js:29-30` contra `lib/aios/conversion.js:622` y
  `lib/aios/creative.js:414`; `lib/aios/leads-group.js:70` contra `components/Overlays.jsx:7`.
- El modal del plan se abre con `classList.add('on')` y **sin** `setAttribute('aria-hidden','false')`,
  que es lo que sí hacen Conversion y Creative sobre el mismo `#recoModal`. El cajón de contactos
  tiene el mismo defecto y es peor, porque lo abren todas las pantallas: `#lgPanel` nace con
  `aria-hidden="true"` en el JSX y **nadie lo cambia nunca**. Los dos paneles quedan abiertos y
  declarados invisibles.

---

## Preguntas abiertas

**Dónde vive la definición de «bueno» de cada métrica.** Executive pinta la inversión que sube en
rojo (`executive.js:116`) y Acquisition en verde (`acquisition.js:146`). Las dos usan la misma regla
con el mismo parámetro y le pasan valores opuestos. Antes de portar hay que decidir si esa dirección
es un atributo de la métrica publicado una sola vez, o si cada pantalla la declara — y en ese caso,
qué pasa cuando divergen, como ya divergieron.

**Qué umbral convierte los hallazgos abiertos en el color del departamento y en el «2 a revisar».**
Executive publica `st` y un conteo (`executive.js:178`, `ExecutiveView.jsx:239`, `:247`) y no dice qué
separa `ok` de `warn` de `crit`. Es un número que se ve desde la pantalla del jefe sin abrir la
pestaña.

**Quién detecta el conflicto y dónde corre.** La tarjeta de `executive-panel.js:12-16` está escrita a
mano. Para que se detecte sola alguien tiene que cruzar la publicación de Acquisition con la de
Conversion, por clave y por ventana. No hay tabla, ni endpoint, ni job donde eso viva.

**Dónde se guarda una alerta de Acquisition y quién la cierra.** El §18.13 pide `entity_type` /
`entity_id`, `baseline`, `current_value`, `change_percentage`, `period_start`, `period_end`,
`severity`, `confidence`, `possible_causes`. `negocio.hallazgos` no tiene ninguno de esos y está
atada al contacto (§3.7). Y falta el ciclo: quién marca «visto», como ya trae el hallazgo que
Conversion manda (`conversion.js:64`).

**Dónde ve Acquisition los hallazgos que recibe.** El campo `to` existe y se dibuja en la pantalla
del emisor (`conversion.js:326`, `:383`, `:601`). Acquisition no tiene bandeja. ¿Es un bloque nuevo
en su pantalla, una pestaña del plan de acción, o el mismo bloque de «Señales detectadas» con una
marca de procedencia?

**A qué abre «Ver evidencia» en una señal de Acquisition.** Es el único control de la pantalla
enunciado y no cableado (`AcquisitionView.jsx:122-124`, `:138-140`). La evidencia de una anomalía de
CPM o de frecuencia no es una lista de personas, así que el cajón de contactos no alcanza.

**Si el drill-down manda la cohorte o el filtro.** Hoy manda `data-n`, un entero
(`leads-group.js:83`). Un sistema real manda o la lista de identificadores, o el filtro que la
produce. Son dos contratos distintos: el primero no escala, el segundo obliga a que el filtro sea
expresable en una URL o en un cuerpo de petición.

**Si `data-seg="alto"` es la definición de calificado.** Las tres cifras de calificados se abren
filtradas al tramo alto (`acquisition.js:150`, `:178`, `:232`) y al lado dibujan una barra que las
reparte en tres tramos (`:182`, `:238`). O una cosa o la otra.

**Qué hace Acquisition con la fila «sin anuncio» cuando alguien la abre.** Son 57 contactos de 233
que agendan 47 veces, **82,5 %**, la tasa más alta de la ventana (§3.6, regla 7 del §6). El conteo va
y la tasa no. Pero el cajón sí puede abrirlos: ¿la fila «sin anuncio» tiene `data-leads`, y qué dice
su `data-sub`?

**Qué publica Acquisition sobre su propia calidad de atribución, y hacia dónde.** El §18.14 la pide y
el §18.17 la pone en el reporte a Executive («91 % de leads con meta_ad_id válido»). El prototipo no
la dibuja en ninguna parte: no hay KPI ni renglón. Medido, son **176 de 233 (75,5 %)** sobre la
cohorte y **80,4 %** sobre los contactos de pauta, y **82 de 163 citas (50,3 %)** (§4). Sin ese
renglón, toda la ficha de Acquisition en Executive se lee como si cubriera el 100 %.

**Si el número de campañas activas es un dato que Acquisition entrega.** Executive guarda un `camp`
por período (`executive.js:16-20`: 3, 3, 4, 6, 9) y **no lo dibuja en ninguna parte** — un grep de
`.camp` sobre el módulo devuelve sólo las cinco declaraciones. O la pantalla del jefe muestra cuántas
campañas alimentan el funnel, y entonces Acquisition lo entrega, o el campo se borra.

---

## Correcciones al inventario

Lo que sigue contradice al inventario que acompañaba el encargo. Gana lo leído.

1. **Las llamadas a `delta` en Acquisition son ocho, no nueve.** `lib/aios/acquisition.js:146`,
   `:147`, `:148`, `:149`, `:150`, `:179`, `:188`, `:234`. Las ocho pasan `invert:false`.

2. **Las emisiones de `data-leads` en Acquisition son cinco sitios de código, no «nueve cifras»**:
   `:153`, `:177`, `:186`, `:223`, `:231`. El número de cifras dibujadas es mucho mayor —diez etapas
   de tarjeta más las celdas de tres tablas— y varía con las tablas abiertas.

3. **Executive pasa `invert = true` para el gasto** (`executive.js:116`). El inventario no lo
   registra, y es la contradicción más concreta entre las dos pantallas: mismo número, mismo
   movimiento, colores opuestos (A7-10).

4. **El hallazgo entrante no se dibuja en la pantalla de Acquisition.** El inventario lo describe
   como algo que Acquisition «recibe»; en el código sólo se dibuja dentro de Conversion, como «lo
   resuelve Acquisition» (`conversion.js:326`, `:383`, `:601`). Acquisition no tiene bandeja
   (A7-18).

5. **`loss` se escala con el período** (`conversion.js:311`, `:578`): no es un número fijo del
   hallazgo (A7-17).

6. **El cajón de contactos también queda `aria-hidden="true"` al abrirse**, no sólo el modal del
   plan: `components/Overlays.jsx:7` lo declara y `leads-group.js:70` no lo cambia (A7-34).

7. **Ninguna respuesta del chat tiene a Acquisition como fuente, y además las tres preguntas caen en
   la respuesta por defecto**, que habla del paso de landing a agendamientos de Conversion
   (`executive-chat.js:77-83`). El inventario señala lo primero y no lo segundo.

8. **Acquisition, por ser dueña de la PRIMERA etapa, nunca puede ser señalada como cuello de
   botella**: `rates` se calcula desde la segunda etapa (`executive.js:37`) y `worst+1` nunca apunta
   a la primera (A7-09).

9. **Los conteos del tercer inventario son de otra ventana.** Ese inventario midió el 2026-09-16 y
   reporta 185 contactos, 158 citas, 6 `adId`, 48 sin anuncio con 81,3 % de agendamiento. Este
   documento usa los del informe, medidos el **2026-09-15**: 233 contactos, 163 citas, 7 `adId`,
   57 sin anuncio con 82,5 %. La ventana rueda; la forma no cambia.
