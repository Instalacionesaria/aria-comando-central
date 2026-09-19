# Creative Intelligence
> Corte: **2026-09-15**. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

> **CORRECCIÓN del 2026-09-19 — esta pantalla se construyó, y dos de las afirmaciones de abajo eran falsas.**
>
> `lib/aios/creative.js` **ya no existe**: se borró junto con sus 201 literales, y lo reemplazan
> `app/api/creative/route.ts` y `components/creative/PanelDeCreative.jsx`, que publican el ICP y la
> agenda por pieza, el hook rate y las tasas de enlace, y la caída del CTR.
>
> **Dos correcciones de fondo, medidas:**
>
> 1. El § 5 dice *«De Meta, y es la mitad entera del § 18.12: ninguna de las nueve existe»* y que
>    *«buscando `facebook`/`graph.facebook`/`meta_ads` en el código no aparece ningún cliente del API
>    de Meta»*. Lo segundo era cierto y lo primero no se sigue de ello: **GoHighLevel expone el Ad
>    Manager de Meta**, y su endpoint por anuncio devuelve un desglose de acciones que da el hook
>    rate, el link CTR, la landing page view rate y el click-to-landing. **Cuatro de los nueve
>    indicadores del § 18.12 se construyen hoy.** El error fue el que este mismo informe ya había
>    nombrado en otro contexto: un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el
>    proveedor.
>
> 2. El § 3.7 y la regla 10 dan por construible la **fatiga por frecuencia**. No lo es, y no por el
>    proveedor: la frecuencia no se puede agregar a lo largo de días ni de anuncios. Lo que sí se
>    construye es la caída del CTR, que es la otra mitad del indicador.
>
> Lo que este informe midió y **sigue en pie**: las diez reglas del § 6 —la unidad es el creativo, el
> mismo creativo en varios anuncios, TOFU contra BOFU, la normalización, los dos caminos, el campo
> «Anuncio» peor que el jsonb, el piso y la ventana, «sin creativo» como grupo, `alta_en_el_crm`, y
> lo que Creative no calcula— son todas correctas y están convertidas en requisitos numerados en
> `docs/creative/`. Y los cuatro huecos que declara —cuartiles, tiempo medio visto, placement y el
> activo creativo— están confirmados uno por uno, con el código de error de cada intento, en
> `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`.

**Prototipo completo — pantalla entera con datos inventados.** *(Era cierto hasta el 2026-09-19; ver la corrección de arriba.)*

La pantalla está completa y no tiene ni un dato real: las 450 líneas de `lib/aios/creative.js` dibujan ocho piezas inventadas con nombre, guion y curva de retención fabricada — y mientras tanto la base ya guarda, con nombre de creativo, 233 contactos de los últimos 14 días que permitirían un ranking real por calidad de lead (ICP 27,5 vs 74,1 según el creativo) sin conectar nada nuevo.

---

## 1 · Qué pide el documento

El documento se contradice, y la contradicción es el hecho central de este departamento.

**Lo declara departamento propio, cinco veces.** El §3 (línea 147 del `.md`) lo pone en la Capa de Inteligencia junto a los otros cinco. El §4, el organigrama (línea 175), lo cuelga directo de Executive Intelligence, hermano de Acquisition y de Conversation — y es el ÚNICO de los seis sin submódulos: Acquisition tiene «Meta Ads», Conversion tiene «Landing» y «VSL», Conversation tiene «Lead Flow» y «Appointment Flow»; Creative va solo. El §2.3 (línea 88) le da derecho propio a recomendar: «Creative Intelligence puede recomendar crear variantes de un anuncio». El §5.1 (línea 209) le da entidad propia en la capa de datos, `Creative Profile`. El §7 (línea 366) lo hace responsable de una subtarea de Team Execution: «Revisar coherencia con el hook ganador. Responsable: Creative Intelligence / responsable creativo». Y el §16.2 (línea 1078) lo nombra entre los tres que se construyen DESPUÉS de validar la trazabilidad: «Antes de construir Business, Creative y Executive Intelligence, debe validarse la trazabilidad».

**Y lo declara pendiente de especificar.** El §17 (línea 1112) lo lista entre las áreas que «tienen visión general, pero todavía requieren especificación detallada», junto con Sales, Conversion, Business, Executive y Team Execution. No tiene ni una sección propia en las 1.650 líneas del documento. El encabezado (línea 8) repite lo mismo — aunque ese encabezado está desactualizado: también lista Acquisition como pendiente y Acquisition tiene diecinueve subsecciones.

**Lo único detallado está adentro de Acquisition.** El §18.3 (línea 1169) mete un «Creative Performance Analyzer» en la estructura interna de Acquisition Intelligence, y el §18.12 (líneas 1433-1447) lo describe: analiza *retención inicial, CTR, CPL, caídas de retención, fatiga, frecuencia, formato, duración y placement*. Nueve indicadores, todos de Meta. El §18.15 (línea 1512) va más lejos y ya le dibuja la pantalla al «Responsable creativo» adentro de Acquisition: ve «Anuncios con mejor retención, Creativos fatigados, Hooks con mejor comportamiento, Solicitudes de nuevas variantes».

**Pero el documento resuelve su propia contradicción, en una sola línea.** El §18.12 cierra (línea 1447): «No reemplaza a Creative Intelligence, que interpreta hook, body, CTA, guion y nuevas variantes». El corte no es por pantalla: es por FUENTE DEL DATO. Lo que se puede medir con los números que devuelve Meta —retención, CTR, CPL, fatiga, frecuencia, formato, duración, placement— es de Acquisition. Lo que exige leer la PIEZA —el gancho, el cuerpo, el llamado a la acción, el guion, y proponer variantes nuevas— es de Creative. Y el §18.16 (líneas 1535-1545) escribe el caño entre los dos: Acquisition le entrega a Creative Intelligence «rendimiento por anuncio, retención, CTR, fatiga, frecuencia, formato, placement, tendencia histórica». Un departamento que recibe un contrato de datos formal de otro departamento no es una pestaña de ese otro.

**Qué implica para el producto, con lo medido abajo:** hoy no se puede construir ninguna de las dos mitades. La mitad de Acquisition es imposible porque no hay una sola cifra de Meta en la base (`public.closer_meta_metricas`: 0 filas). La mitad de Creative es imposible porque no hay una sola pieza guardada — ni un video, ni un copy, ni una miniatura, ni un guion nuestro vive en ninguna de las 21 tablas de `negocio`. Lo único que la base SÍ permite hoy es una tercera cosa que el documento no le asigna a ninguno de los dos: ordenar los creativos por la CALIDAD DEL LEAD que traen, que es exactamente la pregunta que el §18.1 dice que Acquisition no puede contestar solo («No decide por sí solo qué anuncio genera más dinero para el negocio»).

---

## 2 · Qué hay hoy en pantalla

**La pantalla.** `components/views/CreativeView.jsx` (99 líneas) es sólo el maquetado: encabezado «Creative — Qué funciona, qué no, y por qué» (líneas 14-21), un botón «Plan de acción» (líneas 24-29), tres botones de periodo (líneas 31-40) y seis contenedores vacíos —`statRow`, `sortSeg`, `goodGrid`, `badGrid`— que llena JavaScript. No hace un solo pedido al servidor.

**El módulo.** `lib/aios/creative.js`, 450 líneas, arrancado por `lib/aios/index.js:29`. Dibuja, en este orden: una fila de seis cifras de resumen (`renderStats`, línea 142), un selector de criterio de orden con cinco opciones (`SORT`, línea 103), y la biblioteca partida en dos bloques —«Funciona» y «No funciona»— por si la pieza está por encima o por debajo del PROMEDIO del criterio elegido (`renderLibrary`, línea 188). Cada tarjeta muestra seis métricas (`DIRECTA_GRID`, línea 123). Al hacer clic se abre un cajón (`openCre`, línea 279) con: ficha de la pieza, seis cifras, una curva de retención dibujada en SVG, y el guion del video con las líneas donde «se cae la retención» marcadas en rojo.

**Que no tiene operaciones de servidor está declarado.** `lib/autorizacion/secciones.ts:249-254`: la sección `creative` lleva `sinOperacionesTodavia: true` y su capacidad es `tablero.ver`, la misma que comparten otras seis pantallas. Nada en la interfaz le avisa a quien mira que lo que ve es inventado: el menú le pone el mismo galón (`menu: { galon: true }`, línea 253) que a ICP & Oferta, que sí es real.

**El comparador con lo que ya se hizo bien.** `components/views/ConversationView.jsx:1-36` documenta qué se llevó el borrado del prototipo equivalente —«559 líneas de las cuales unas 180 eran literales inventados… cuatro agentes con nombre de persona»— y cierra con la frase que define el estándar del proyecto: «Nada de eso se reemplazó por otra cifra: se reemplazó por qué falta para calcularla». Creative sigue del otro lado de esa línea.

---

## 3 · Lo que está hardcodeado

**13 juego(s) de datos inventados.**

### 3.1 · `ADS`: ocho piezas completas con identificador, nombre, formato, ángulo, dolor, estado, duración y siete métricas cada una. Los nombres son «Owner Hook», «Founder Story», «Social Proof», «Results Demo», «VSL Cold», «Quick Win», «Pain Point», «Comparison». Los formatos son un vocabulario inventado de seis valores (UGC, Talking Head, Carrusel, B-Roll, VSL, Estático) y los ángulos otro de seis (Dolor, Autoridad, Prueba social, Contrarian, Curiosidad, Comparación). De los 64 valores numéricos, 9 son nulos a propósito (las tres piezas que no son video no tienen duración, hook ni retención) y 55 se dibujan.

- **Dónde:** `lib/aios/creative.js:6-23`
- **Finge ser:** La biblioteca de creativos de la empresa con su rendimiento. En la base, los creativos reales de los últimos 14 días son nueve y se llaman «agendamiento - yaping», «El app», «Evoluciona native», «economia us latino», «agendamiento - yaping - 23/07», «link_in_bio», «el modelo está roto», «agendamiento - yaping1» y el literal sin expandir «{{ad.name}}» — leídos de `negocio.contactos.atribucion_primera->>'utmContent'`.
- **¿Se puede reemplazar hoy?** Parcialmente, y es el reemplazo más valioso del departamento. La LISTA de piezas sí: `utmContent` viene en 220 de 233 contactos de la ventana (94,4 %), con nueve nombres distintos. `calificados` y `agendas` sí, con cambio de definición (ver abajo). `alcance`, `frecuencia`, `hookRate`, `retention` y `avgWatch` NO: son métricas de entrega de Meta y en la base hay cero filas de Meta. `format`, `angle`, `pain` y `duration` NO: no hay ninguna tabla que guarde la pieza, sólo su nombre.

### 3.2 · `CLICKS`: cinco líneas de tiempo de clics a la landing por segundo del video, seis puntos cada una — 30 pares de números.

- **Dónde:** `lib/aios/creative.js:26-32`
- **Finge ser:** Clics a la web por momento del video, con su pico. Sería `landing page views` cruzado con el tracking individual del VSL.
- **¿Se puede reemplazar hoy?** No. Requiere dos cosas que no existen: métrica de clic por segundo (sólo la da Meta, 0 filas en la base) y tracking individual del VSL. Medido: «VSL % máximo visto» y «VSL segundos vistos» existen en 79 de 584 contactos, todos con alta entre el 2026-08-11 y el 2026-08-30, y los 79 valen exactamente `0` en los dos campos. No es «79 personas vieron 0 %»: es un medidor que reportó cero y después dejó de escribir. En la ventana de 14 días: 0 de 233.

### 3.3 · `DM`: ocho pares [DMs recibidos, conversaciones abiertas], 16 números.

- **Dónde:** `lib/aios/creative.js:34`
- **Finge ser:** Mensajes directos generados por cada pieza (el tramo MOF del embudo).
- **¿Se puede reemplazar hoy?** No hace falta decidirlo: **estos 16 números no se dibujan nunca**. `CRIT.dm` (línea 82) sólo es alcanzable si el criterio de orden vale `dm`, y `SORT` (línea 103) tiene cinco criterios y `dm` no está entre ellos. Es dato inventado muerto.

### 3.4 · `SALES`: ocho pares [inversión, cierres], 16 números. Suman $18.700 de inversión y 27 cierres. De ahí se deriva `a.cpv` (costo por venta), línea 42.

- **Dónde:** `lib/aios/creative.js:36`
- **Finge ser:** Inversión publicitaria y ventas cerradas por creativo, o sea el CPA por pieza.
- **¿Se puede reemplazar hoy?** No, y por dos motivos independientes. Uno: `negocio.resultados` tiene **7 filas en toda la base** y **ninguna** con `salida = 'venta'` (el vocabulario real, `lib/negocio/comision.ts:112`); las siete son 4 `seguimiento`, 2 `no_show`, 1 `no_interesa`. En la ventana de 14 días hay 4 resultados y cero ventas. Dos: la inversión sólo la sabe Meta. Además `cpv` y `spend` tampoco se dibujan nunca — aparecen una sola vez cada uno en el archivo, en su propia asignación.

### 3.5 · `IX`: ocho números de interacciones (reacciones + comentarios + compartidos + guardados).

- **Dónde:** `lib/aios/creative.js:46`
- **Finge ser:** Interacción social por pieza.
- **¿Se puede reemplazar hoy?** No, y tampoco se dibuja nunca: `interacciones` aparece dos veces en el archivo, el comentario y la asignación. Es dato de Meta, 0 filas.

### 3.6 · `REACH`: ocho valores de alcance, de 11.500 a 41.200 personas.

- **Dónde:** `lib/aios/creative.js:50`
- **Finge ser:** Personas únicas alcanzadas por cada pieza. Sí se dibuja: en la tarjeta, en el resumen y en el cajón.
- **¿Se puede reemplazar hoy?** No. Es `reach` de Meta (§18.7, «Entrega y costo»). `public.closer_meta_metricas` tiene la columna `alcance` declarada y **0 filas**.

### 3.7 · `FREQ`: ocho valores de frecuencia, de 1,2 a 2,6.

- **Dónde:** `lib/aios/creative.js:54`
- **Finge ser:** Impresiones ÷ alcance. Es la señal de fatiga del §18.12 y del §18.13. Sí se dibuja.
- **¿Se puede reemplazar hoy?** No. Ni impresiones ni alcance existen en la base. `closer_meta_metricas` tiene `impresiones` y `alcance` declaradas y vacías.

### 3.8 · `AGE`: ocho antigüedades en días (3, 6, 15, 28, 45, 70, 95, 140) que se convierten en fecha de publicación restándolas de `Date.now()`.

- **Dónde:** `lib/aios/creative.js:58-59`
- **Finge ser:** La fecha de lanzamiento de cada pieza. Alimenta el filtro de periodo y el «Publicado» del cajón.
- **¿Se puede reemplazar hoy?** No como fecha de lanzamiento del anuncio (eso es de Meta). Sí como sustituto útil: la fecha del PRIMER contacto atribuido a ese creativo, con `min(alta_en_el_crm)` — que dice desde cuándo la pieza trae gente, no desde cuándo está activa. Son dos hechos distintos y hay que rotularlo como el segundo.

### 3.9 · `TRANSCRIPT`: el guion completo de cinco videos, seis líneas con marca de tiempo cada uno — 30 líneas de texto escritas a mano. Incluyen frases en primera persona como «Hace tres años cerré mi agencia. Estaba quebrado» y «Semana 3: primer cierre de cinco cifras».

- **Dónde:** `lib/aios/creative.js:62-68`
- **Finge ser:** La transcripción real de los videos de la empresa, con su marca de tiempo.
- **¿Se puede reemplazar hoy?** No. No existe ninguna tabla que guarde el guion, el copy ni el archivo de una pieza propia. (Sí existe transcripción de LLAMADAS — el campo del CRM «Transcripcion de Elevenlabs» y `negocio.llamadas.resumen` — pero es de las llamadas de venta, no de los anuncios, y es de Sales/Conversation.)

### 3.10 · La curva de retención NO es un dato: es una fórmula. Siete puntos interpolados a partir de dos números inventados — `[[0,100],[0.10,hookRate],[0.25,hookRate-8],[0.45,(hookRate+retention)/2],[0.65,retention+6],[0.85,retention+2],[1,retention]]` — con la misma forma para todas las piezas. `dropSeconds` (línea 256) recorre esa curva y marca como «caída de atención» cualquier tramo que pierda 12 puntos; `transcriptBlock` (línea 263) marca con «↓ retención» las líneas del guion que caen cerca de esos segundos.

- **Dónde:** `lib/aios/creative.js:208-232 (curva), 256-262 (caídas), 263-278 (guion marcado)`
- **Finge ser:** La curva de retención real del video y el punto exacto del guion donde la gente se va. Es el elemento más accionable de la pantalla: le dice a una persona qué frase de su video reescribir.
- **¿Se puede reemplazar hoy?** No, y es lo más urgente de sacar. La forma de la curva está escrita a mano e idéntica para las ocho piezas: dos números inventados producen un diagnóstico de guion que parece medido. El dato real sería la retención por cuartil de Meta (`video_25/50/75/100`, columnas ya declaradas en `public.closer_meta_metricas` y vacías) — que además da cuatro puntos, no una curva continua, así que ni con Meta conectado se podría dibujar esta curva.

### 3.11 · El «Plan de acción»: doce frases de recomendación generadas por `renderReco` a partir de las constantes anteriores. Dice cosas como «Produce más [formato] con ángulo [ángulo] — es tu combinación más rentable», «Apunta a videos de ~Ns, que es la duración de tus ganadores», «En los videos flojos la atención cae a N %. Acorta la intro y ve directo al dolor» y «Toma el mejor momento de [pieza] (~0:45) y conviértelo en un short independiente».

- **Dónde:** `lib/aios/creative.js:338-415`
- **Finge ser:** Las recomendaciones locales del §2.3 y la explicabilidad del §2.6. El texto está redactado como si derivara de datos —cita promedios, cuenta piezas por encima y por debajo— y deriva de literales.
- **¿Se puede reemplazar hoy?** Parcialmente. La forma del cálculo es correcta y reutilizable: agrupar por una dimensión, promediar y comparar. Lo que falta son las dimensiones: hoy agrupa por `format` y `angle`, que no existen en la base. Con lo que hay se podría agrupar por creativo, por adset (`utmMedium`, 222 de 233) y por campaña, y comparar ICP promedio y tasa de agenda. Las frases sobre duración, intro, hook y «mejor momento del video» hay que borrarlas: no hay fuente.

### 3.12 · Catorce personas y empresas con nombre completo, puntaje de ICP, origen («Campaign 04 · Creative 12») y monto vendido: María López, Pablo Herrera, Carlos Méndez, Grupo Meridian, Diego Paredes, TechNova, Daniela Soto, Karla Núñez, Rodrigo Vega, Lucía Fernández, Andrea Salas, Iván Torres, Estudio Vera, Marcos Ruiz. Cinco de ellas con estado «Vendido» y montos de $4.500 a $9.600. Cada fila lleva un botón que abre GoHighLevel.

- **Dónde:** `lib/aios/leads-group.js:14-30 (el módulo se arranca en lib/aios/index.js:38); la pantalla Creative es una de sus entradas, por los atributos `data-leads` de lib/aios/creative.js:159 y :175`
- **Finge ser:** La lista de contactos detrás de una cifra. Desde Creative hay **18 puertas** a este panel: «Calificados» y «Agendas» del resumen, más las mismas dos en cada una de las ocho tarjetas. Al abrirla desde «Calificados» el módulo filtra el `POOL` a ICP ≥ 75 (`SEG`, línea 10) y muestra a esas personas como si fueran los leads calificados de esa pieza concreta. El propio archivo se delata en la línea 13: «muestra representativa mientras no haya datos reales».
- **¿Se puede reemplazar hoy?** Sí, y es lo más grave de la pantalla porque son nombres con forma de cliente y montos de venta atribuidos. Los contactos reales por creativo están: 109 para «agendamiento - yaping», 46 para «El app», 31 para «Evoluciona native», 19 para «economia us latino» en la ventana de 14 días, con nombre, teléfono y `ghl_contact_id` en `negocio.contactos`. Es el mismo defecto que ya se pagó una vez: `ConversationView.jsx:15` cuenta que el módulo borrado tenía «cuatro agentes con nombre de persona», y `:26-27` que «landing BCL» —iniciales de un cliente— «aparecía en tres sitios».

### 3.13 · El filtro de periodo miente en dos sentidos distintos. (a) El botón «7 días» nace marcado (`className="on"`) pero el estado interno arranca en `hist`: al abrir la pantalla el botón dice «7 días» y la biblioteca muestra las ocho piezas, incluida una de hace 140 días, con la etiqueta «histórico» al lado. (b) El botón «Hoy» manda el valor `hoy`, que no está en el mapa de presets; el `?? Infinity` lo convierte en «todo» y la etiqueta cae al literal «periodo». «Hoy» y «histórico» devuelven exactamente las mismas ocho piezas.

- **Dónde:** `components/views/CreativeView.jsx:31-40 (los botones) contra lib/aios/creative.js:91 (`period = {preset:'hist'}`) y :94 (`({'7d':7,'mes':30,'tri':90,'hist':Infinity})[period.preset] ?? Infinity`)`
- **Finge ser:** Un control de periodo funcionando. Además el mapa tiene dos presets sin botón (`tri`, `hist`) y los botones tienen uno sin entrada en el mapa (`hoy`): las dos listas divergieron.
- **¿Se puede reemplazar hoy?** Sí, y hay que hacerlo con el vocabulario de ventanas del proyecto, no con el del maquetado. Las ventanas viven en un solo lugar —`PERIODOS`, `lib/negocio/periodo.ts:83-96`— y son cuatro: **Hoy, 7 días, 30 días y Completo**, con 30 días por omisión (`PERIODO_POR_OMISION`, `lib/negocio/periodo.ts:109`), que es con lo que abre Conversation (`components/conversation/PanelDeConversation.jsx:146`). De los cuatro presets del maquetado sólo `7d` es uno de ésos, con la misma clave y los mismos días (`lib/negocio/periodo.ts:85` contra `lib/aios/creative.js:94`); `tri` y `hist` no existen en el sistema y `mes` es el que se llama `30d`. Para las cifras de Creative las cuatro ventanas son legítimas, incluida la de 30: su unidad es el CONTACTO y la cohorte se arma con `alta_en_el_crm`, que no envejece. Lo que sí hay que vigilar es la ventana de las cifras de CITAS —«Completo» no agrega ni una cita alcanzable sobre «30 días», agrega 24 congeladas— y eso está medido en la regla 7 del §6.


---

## 4 · Datos que YA tenemos

Todo lo que sigue está medido contra producción el 2026-09-15, con `node --env-file=.env.supabase scripts/supabase.mjs leer`. La ventana es `alta_en_el_crm >= now() - interval '14 days'`: **233 contactos**. La base entera tiene 584 contactos, 559 con `alta_en_el_crm`.

**1 · El nombre del creativo, que es la unidad de este departamento.** Está en `negocio.contactos.atribucion_primera`, un `jsonb` crudo de GoHighLevel. Cobertura en la ventana:

    utmContent (nombre del creativo)   220 de 233   94,4 %
    utmMedium  (nombre del adset)      222 de 233   95,3 %
    mediumId   (NO es el adset — ver abajo) 233 de 233  100,0 %
    campaign   (nombre de campaña)     217 de 233   93,1 %
    campaignId                         217 de 233   93,1 %
    adId       (el meta_ad_id del §18.5) 176 de 233  75,5 %
    fbclid                              42 de 233   18,0 %
    atribucion_primera vacía              0 de 233    0,0 %

Nueve creativos distintos, siete `adId` distintos, seis cadenas de campaña.

> **CORRECCIÓN del 2026-09-16 · `mediumId` no es el identificador del ad set.** Esta tabla lo
> rotulaba así y es falso: medido, `mediumId` es el id del FORMULARIO, del calendario o del lead
> form — `vsl_lead_scoring_survey` (240 contactos), `1565833687804655` (114) y
> `pZqT3g9LSvGmLxcGSCMs` (57). Ninguno de los tres tiene forma de identificador de ad set.
>
> El identificador del ad set sí llega, y es **`utmTerm`**: 9 valores distintos, los 9 numéricos de
> 18 dígitos, y 9 de 9 cruzan contra los conjuntos que devuelve el Ad Manager de GoHighLevel.
> `db/migraciones/050` lo guarda con ese nombre en `negocio.anuncios.meta_conjunto_id`.
>
> El error no era inocuo: un corte por creativo agrupado por `mediumId` habría juntado todo lo que
> entra por el mismo formulario y lo habría llamado «el mismo ad set». En la base entera: 503 de 584 con `utmContent` (86,1 %), 213 con `adId` (36,5 %), 30 creativos distintos y 15 anuncios distintos desde el 2025-08.

**2 · El ICP por contacto, que es la mejor métrica que este departamento puede dar hoy.** El campo del CRM **«Puntaje | ICP»** (resuelto por nombre con `campoPorNombre`, `lib/negocio/camposDelCrm.ts`) está en **229 de 233 (98,3 %)** de la ventana. La columna `negocio.contactos.score` está en **0 de 233** — los dos ceros: la columna existe vacía, el dato vive en el CRM. Promedio por creativo, sobre la ventana:

    evoluciona native      74,1   (n=31)
    el app                 45,8   (n=46)
    agendamiento - yaping  42,7   (n=109)
    economia us latino     27,5   (n=19)

Un factor 2,7 entre el mejor y el peor. Esto es publicable hoy y es exactamente lo que el §18.6 pide («ICP promedio por anuncio») y lo que el §2.5 defiende («Un anuncio con bajo CTR puede seguir siendo valioso si genera mejores ICP»).

**3 · Las agendas por creativo.** Cruzando con `negocio.citas` por `contacto_id`, en la ventana y aplicando el piso del proyecto (`PISO_DE_UNA_TASA = 10`, `lib/negocio/indicadoresDeCitas.ts:300`):

    BOFU · evoluciona native        31 contactos · 26 con cita · 83,9 %
    TOFU · el app                   46 contactos · 21 con cita · 45,7 %
    TOFU · agendamiento - yaping   109 contactos · 48 con cita · 44,0 %
    TOFU · economia us latino       19 contactos ·  7 con cita · 36,8 %
    (sin creativo)                  13 contactos · 10 con cita · 76,9 %

Cuatro creativos con nombre superan el piso; los otros cinco (8, 3, 2, 1 y 1 contactos) no, y su tasa tiene que salir nula, no cero.

**4 · La estructura de campaña y adset.** `campaign`, `campaignId`, `utmMedium`, `mediumId` y `sessionSource` vienen con la cobertura de arriba. Permiten separar TOFU de BOFU y agrupar por conjunto de anuncios — el §18.16 pide «diferencias por audiencia y placement» y la audiencia (el adset) está al 95,3 %.

**5 · La tabla de métricas de Meta ya existe, con el esquema del §18.4.** `public.closer_meta_metricas` —de la plataforma anterior, esquema `public`— declara exactamente: `nivel, objeto_id, nombre, padre_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, cpm, leads, cpl, video_reproducciones, video_25, video_50, video_75, video_100`. Y `public.closer_meta_crudo` guarda el payload crudo por nivel y rango de fechas. **Las dos tienen 0 filas** y ninguna está declarada en `lib/datos/esquema.ts`, así que ningún código nuestro las lee ni las escribe. No hay que diseñar el modelo: hay que llenarlo.

**6 · Investigación de creativos de la competencia, real y andando.** El «Espía de Anuncios» (`components/tools/EspiaDeAnuncios.jsx`, `lib/tools/espia.ts`, ruta `app/api/tools/espia/route.ts`) consulta la Meta Ad Library por nicho/marca/página vía Apify y después le pide a la IA los patrones: «Hooks/ganchos más usados (primeras líneas que detienen el scroll)», «Ofertas y ángulos recurrentes», «Estructuras de copy», «3-5 ideas accionables» (`lib/tools/espia.ts:79-88`). Es la única capacidad creativa real del producto, vive en Tools y mira hacia AFUERA: analiza los anuncios de otros, nunca los propios.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**De Meta, y es la mitad entera del §18.12.** Ninguna de las nueve métricas que el §18.12 le pide al Creative Performance Analyzer existe en la base: retención inicial, CTR, CPL, caídas de retención, fatiga, frecuencia, formato, duración y placement. Ni las del §18.7 «Video y creativo»: three-second view rate, retención de seis segundos, 25/50/75/100 %, average watch time, hook retention proxy, fatigue trend. Medido: `public.closer_meta_metricas` 0 filas, `public.closer_meta_crudo` 0 filas. Y no hay integración: buscando `facebook`/`graph.facebook`/`meta_ads` en el código no aparece ningún cliente del API de Meta — las rutas `app/api/closer/meta/route.ts` y `app/api/setter/meta/route.ts` son de «meta» como OBJETIVO de comisión, no de Meta la empresa. Falta una app de Meta, un token de larga duración y un cargador que escriba por día (§18.4: «Las métricas deben guardarse por fecha»).

**De la landing y del VSL, y esto es peor que faltar: dejó de venir.** El §18.12 pide «caídas de retención» y el §16.2 pide «Validar tracking individual del VSL». Medido sobre los 584:

    VSL % máximo visto        79 de 584 · los 79 valen «0» · última alta 2026-08-30
    VSL segundos vistos       79 de 584 · los 79 valen «0» · misma cohorte
    Form Landing VSL         247 de 584 · última alta 2026-08-31
    Porcentaje de Video Visto   0 de 584
    Video Watch Percentage      0 de 584

En la ventana de 14 días los cinco están en **0 de 233**. Los dos primeros son el caso de los dos ceros en su forma más cara: el campo existe, se escribió 79 veces entre el 11 y el 30 de agosto, **y todas las veces escribió cero**, que es un medidor roto y no 79 personas que no vieron nada. Y «Form Landing VSL» venía en 247 contactos y se cortó el 31 de agosto. Hay que averiguar qué se apagó antes de prometer retención de VSL.

Ojo con un falso positivo cercano: **«Video Pre-Call»** sí viene, 81 de 233 en la ventana, y trae el porcentaje adentro del vocabulario de un RADIO (`lib/negocio/consumoDelPrecall.ts:9-17`). **No sirve para Creative**: es el video que se manda DESPUÉS de agendar, es el §10.6 y es de Conversation Intelligence. Usarlo como «retención del creativo» mezclaría dos videos distintos en dos momentos distintos del embudo.

**De la pieza misma, y esto no lo arregla conectar Meta.** No existe en ninguna de las 21 tablas de `negocio` ni un video, ni un copy, ni una miniatura, ni un guion, ni un formato, ni una duración, ni un ángulo de un anuncio PROPIO. Lo único que la base sabe de un creativo es su nombre (`utmContent`) y su identificador (`adId`). El §18.12 le reserva a Creative Intelligence «hook, body, CTA, guion y nuevas variantes» — cinco cosas que exigen leer la pieza, y la pieza no está guardada. Falta la entidad `Creative Profile` del §5.1: no existe como tabla.

**Del cierre, que es lo que haría comparables a dos creativos.** `negocio.resultados` tiene **7 filas en toda la base** y **cero** con `salida = 'venta'`. El registro manual del closer del §5.4 existe como mecanismo pero casi no tiene historia. Sin ventas no hay CPA, ni ROAS, ni «qué creativo genera más dinero» — que es justo lo que el §18.1 dice que hay que cruzar.

**De la asistencia.** `negocio.citas.asistio` está en **0 no nulos** para todos los creativos de la ventana: la columna es nueva y no hay relleno hacia atrás. Así que del embudo por creativo hoy se puede medir contacto → cita, y ahí se corta.

**De dónde tendría que venir cada cosa:** Meta (todo el bloque de entrega, costo, video y fatiga, más formato, duración y placement); la landing (el tracking individual del VSL, que además hay que reparar); un repositorio de piezas nuevo (el archivo del creativo y su guion, para la mitad interpretativa); y el registro manual del closer (las ventas). De GoHighLevel ya viene todo lo que puede venir — la atribución está al 94,4 % y nadie tiene que pedir nada más.

---

## 6 · Reglas propias de este departamento

**1 · La unidad es el CREATIVO, no el anuncio — y agrupar por `adId` borra una campaña entera.** Medido en la ventana: `adId` está en 176 de 233 (75,5 %). Ese 24,5 % que falta **no es ruido repartido**: los 176 son el 100 % de las dos campañas TOFU (171 + 5) y los 57 que faltan son el 100 % de la campaña BOFU (39 contactos, ni uno con `adId`) más 18 de orgánico y directo. Si la pantalla agrupa por `adId`, la campaña BOFU —la de mejor ICP (74,1) y mejor tasa de agenda (83,9 %)— desaparece de la pantalla sin que nada falle. La clave de agrupación tiene que ser `utmContent` (94,4 %), con `adId` como enriquecimiento cuando esté.

**2 · El mismo creativo vive en varios anuncios, y ésa es la premisa del departamento.** «El app» aparece bajo dos `adId` distintos (`120249633901550467` y `120249792217700467`) y «economia us latino» también. Un ranking por anuncio partiría la misma pieza en dos filas con la mitad del volumen cada una. Es literalmente lo que separa a Creative de Acquisition: Acquisition ordena anuncios, Creative ordena piezas.

**3 · TOFU y BOFU no se comparan. Nunca, en ninguna cifra de conversión.** Los creativos BOFU llegan a 83,9 % de tasa de agenda y los TOFU a 36,8-45,7 %. No es que el creativo BOFU sea el doble de bueno: es que le habla a gente que ya interactuó (el adset se llama «Engagers + IG, FB, Web - 365d»). Ponerlos en la misma lista ordenada por agendas —que es exactamente lo que hace `renderLibrary` hoy con su partición «Funciona / No funciona» por el promedio— manda a pausar todos los TOFU. La etapa se lee del nombre de la campaña, y hay que decir que se lee de ahí.

**4 · Los nombres de campaña se normalizan en mayúsculas antes de agrupar. Medido.** En la ventana hay **6 cadenas de campaña distintas pero sólo 5 campañas**: «Nueva Era | Bofu | Agendas | Latam+usa | 28-08-26» y «NUEVA ERA | BOFU | AGENDAS | LATAM+USA | 28-08-26» son la misma, escritas distinto, y parten sus 39 contactos en 26 + 13. Los nombres de creativo hoy no tienen ese problema (9 crudos = 9 normalizados), pero la regla tiene que ser la misma para los dos o el día que aparezca una variante nadie lo va a notar.

**5 · Dos caminos de adquisición conviven bajo el mismo creativo.** «Meta Lead ID» está en 89 de 233 (38,2 %) y «Last Landing URL» en 99 de 233 (42,5 %). «agendamiento - yaping» tiene 43 leads de formulario instantáneo de Meta y 21 con landing, de 109. «Evoluciona native» tiene 0 de Meta Lead Ads y 31 con landing. Los de Lead Ads **nunca vieron la landing ni el VSL**: cualquier métrica de landing o de VSL por creativo tiene como denominador sólo a los que pasaron por ahí, no a todos los contactos de la pieza.

**6 · El campo que se LLAMA «Anuncio» es el peor de los dos.** «Last UTM Content (Anuncio)» del catálogo del CRM está en 85 de 233 (36,5 %); el `utmContent` del `jsonb` de atribución está en 220 (94,4 %). Es el mismo dato con cobertura 2,6 veces mejor en el lugar que no lleva el nombre. Es la tercera vez que este proyecto tropieza con lo mismo (`meta_ad_id`, las UTM, el porcentaje de video precall): el nombre del campo no es evidencia de dónde está el dato.

**7 · El piso y la ventana son los del proyecto, no los del maquetado — y el sesgo de la ventana es de las CITAS, no de los CONTACTOS.** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:300`) y `DIAS_DE_LA_TASA = 14` (`lib/negocio/indicadoresDeCitas.ts:310`). El piso rige toda cifra de esta pantalla y no se discute: con la ventana de catorce días, de los nueve creativos sólo cuatro tienen tasa; los otros cinco tienen conteo y `null`, no cero.

La ventana es otra cosa. Que una ventana ancha ensucia la cifra es cierto y está medido — pero vale para uno solo de los dos denominadores que tiene este departamento, y decirlo sin esa distinción le prohíbe a Creative una ventana que le conviene:

- **Las citas SÍ envejecen.** Una cita *congelada* (`ghl_calendario_id is null`) es una que el CRM ya no devuelve: su estado quedó fijo en la foto del día que se cortó la sincronización, y ninguna pasada del barrido lo va a mover. Cuanto más atrás mira la ventana, mayor es la proporción. Medido el 2026-09-15 sobre `negocio.citas` ya ocurridas: 14 días → 147 alcanzables y 11 congeladas (**7,0 %**); 30 días → 206 y 77 (**27,2 %**); completo → 206 y 101 (**32,9 %**). Y el número que cierra la discusión: **«Completo» no agrega ni una cita alcanzable sobre «30 días» — agrega 24 congeladas.** La ventana que hay que evitar en una cifra de citas es «Completo», no la de 30.
- **Los contactos NO envejecen.** La cohorte de contactos se arma con `alta_en_el_crm`, la fecha de alta que devuelve GoHighLevel y que el barrido vuelve a escribir en cada pasada tal como viene (`lib/negocio/sincronizar.ts:449`): no hay estado que se congele, y un contacto de hace veintinueve días vale hoy lo mismo que el día que llegó. La unidad de Creative es el contacto agrupado por `utmContent` (regla 1), así que el ICP por creativo y el conteo de contactos por pieza **no tienen sesgo de ventana**. Para Creative, 30 días no es una concesión: es más señal.

**Cuánta más, medido el 2026-09-16 a las 14:00 UTC.** 14 días → 4 creativos sobre el piso. 30 días → 18 creativos distintos, 6 sobre el piso. Y el caso que lo vuelve concreto: **«agendamiento - yaping - 23/07»**. Con la ventana corta es una pieza sin tasa; con la de 30 es la segunda por volumen. Una ventana angosta no hace a Creative más prudente: le esconde una pieza entera.

**La condición bajo la cual una ventana ancha es aceptable en una cifra de citas:** que el conteo de congeladas viaje AL LADO de la cifra, en la misma respuesta y en la misma pasada, no en una nota al pie ni en la documentación. Es exactamente lo que hace `tasaDeCancelacion`: cuenta las congeladas en la misma consulta que las alcanzables (`lib/negocio/indicadoresDeCitas.ts:345`), las devuelve como campo propio del resultado (`lib/negocio/indicadoresDeCitas.ts:61`) y las dice en su aviso (`avisoDe`, `lib/negocio/indicadoresDeCitas.ts:514-526`): *«No se cuentan N cita(s) de este período: quedaron congeladas y el CRM ya no devuelve sus eventos»*. Una tasa de agenda por creativo a 30 días es publicable con ese aviso al lado; sin él, no. Y el aviso se apaga solo cuando no hay congeladas en la ventana, que es lo que lo hace legible el día que aparece.

**Y los catorce días de `DIAS_DE_LA_TASA` no son una ventana de pantalla.** Son el valor por omisión de una función de citas, y ninguno de los cuatro botones del proyecto los produce: `PERIODOS` (`lib/negocio/periodo.ts:83-96`) ofrece Hoy, 7 días, 30 días y Completo, con 30 por omisión (`lib/negocio/periodo.ts:109`). Cuando Creative deje de ser maqueta, sus botones salen de `PERIODOS` y no de una lista escrita en `creative.js`.

**8 · «Sin creativo» es un grupo, no un descarte.** 13 contactos de la ventana no traen `utmContent` y 10 de ellos agendaron (76,9 %). Esconderlos haría que la suma de la pantalla no diera el total de la empresa. Y dentro de ese grupo hay un caso propio: el literal **`{{ad.name}}`** sin expandir, con su gemelo `{{campaign.name}}` y `{{adset.name}}`, en 2 contactos. Es una plantilla que no se resolvió en el CRM — un hallazgo del Attribution Monitor del §18.14, no un creativo.

**9 · Las cifras de este departamento se miden sobre `alta_en_el_crm`, y hay que decir desde cuándo.** La `048_de_donde_vino_el_lead.sql` lo deja escrito: «ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del despliegue, y toda pantalla que la use tiene que decir desde cuándo mide». Medido: `adId` aparece en 35 contactos de agosto y 178 de septiembre — la diferencia es la ingesta, no el rendimiento de los anuncios.

**10 · Lo que Creative NO calcula.** El §2.1 y el §2.4 lo prohíben explícitamente. El gasto, el CPM, el CTR y la fatiga los produce Acquisition y Creative los CONSUME (§18.16). La retención del VSL es de Conversion (Landing/VSL Intelligence, §4). El video precall es de Conversation (§10.6). El revenue y el CAC son de Business (§18.6: «Acquisition no recalcula revenue, CAC real ni ROAS real»). Si Creative recalcula alguno, dos pantallas del mismo producto van a mostrar dos números distintos para lo mismo.

---

## 7 · Riesgos

**1 · Publicar una recomendación de guion sin curva real.** El riesgo más caro no es una cifra equivocada: es la frase «esta línea de tu video pierde la atención». Hoy sale de una forma de curva idéntica para las ocho piezas (`creative.js:212`), y alguien puede reescribir un video por eso. Aunque se conecte Meta, Meta da cuatro puntos (25/50/75/100 %), no una curva continua: no alcanza para señalar un segundo del guion. Si esa afirmación se mantiene, tiene que decir de qué cuartil sale y nada más.

**2 · Ordenar por `adId` y perder la mejor campaña en silencio.** Medido: los 39 contactos de la campaña BOFU no tienen ni un `adId`. Una pantalla agrupada por anuncio los borra a los tres — y como la pantalla igual muestra piezas, nadie ve que falta nada. Es el defecto que `secciones.ts` describe para la lista paralela: «no divergió en algo visible, divergió en un nombre».

**3 · Comparar TOFU con BOFU y mandar a pausar lo que funciona.** La partición «Funciona / No funciona» de `renderLibrary` (línea 188) usa el PROMEDIO del criterio. Con los datos reales, el 83,9 % del BOFU levanta el promedio y empuja a los tres creativos TOFU —el 74 % del volumen de la ventana— al bloque «No funciona · pausar o iterar» (el literal de la línea 197).

**4 · Tomar el cero de un medidor roto como un cero de comportamiento.** Ya está la trampa puesta: 79 contactos con «VSL % máximo visto» = 0 en agosto. Una pantalla que promedie eso publica «retención del VSL: 0 %» y va a parecer un problema de creativo cuando es un tag que no reporta. La regla de los dos ceros no es una formalidad acá: es la diferencia entre rehacer un video y arreglar un pixel.

**5 · Prometer «cierres por creativo» con siete filas.** `negocio.resultados` tiene 7 filas y cero ventas en toda la base. Cualquier CPA o ROAS por pieza hoy se construiría sobre 0-2 eventos. Con el piso de 10 del proyecto, la respuesta correcta es que no hay cifra — y decirlo, no mostrar un guion.

**6 · Dejar en producción catorce nombres de persona con montos de venta.** `leads-group.js:14-30` se abre desde 18 cifras de esta pantalla. Son nombres inventados que parecen clientes, con «Vendido $9.600» al lado y un botón que abre GoHighLevel. El proyecto ya pagó esto una vez (`ConversationView.jsx:15`: «cuatro agentes con nombre de persona»; `:26-27`: «landing BCL» —iniciales de un cliente—) y tiene una prueba que lo prohíbe en el Closer «porque lo van a ver clientes» (`pruebas/codigo/91-closer-y-setter.test.ts`, que excluye esta pantalla a propósito mientras no tenga datos reales).

**7 · Resolver la contradicción del documento por omisión.** Si Creative se construye como una pestaña más de Acquisition, se pierde la mitad que el §18.12 le reserva explícitamente —hook, body, CTA, guion, variantes— y que ningún otro departamento tiene asignada. Si se construye como departamento con la especificación que hay, se construye sobre el §18.12, que es de Acquisition, y las dos pantallas van a mostrar la misma tabla. El corte defendible con lo medido es por fuente: Acquisition publica lo que dice Meta, Creative publica lo que dice el lead que llegó por cada pieza (ICP y agenda, que hoy se pueden calcular) y lo que dice la pieza misma (cuando exista un repositorio de piezas, que hoy no existe).

**8 · Una cifra por contacto contada por sus citas.** Verificado durante esta medición: cruzar contactos con `negocio.citas` con un `left join` y contar con `count(*)` infla el total —«agendamiento - yaping» pasó de 109 a 112 y «Evoluciona native» de 31 a 36— porque hay contactos con más de una cita. Toda cifra de este departamento cuenta contactos con `count(distinct contacto_id)`.

**Pendientes que no pude verificar:** (a) por qué se cortaron «Form Landing VSL» el 2026-08-31 y «VSL % máximo visto» el 2026-08-30, y si fue el mismo cambio — hay que mirarlo en GoHighLevel y en la landing, no en esta base; (b) si los 20 contactos con «Puntaje | ICP» = 0 de la ventana (20 de 229, 8,7 %) son un puntaje real de cero o el calificador que no corrió; a diferencia del caso del VSL el cero es minoría dentro de una distribución continua, así que probablemente sea real, pero no lo comprobé; (c) si `public.closer_meta_metricas` se llenó alguna vez en la plataforma anterior y se vació, o nunca recibió nada — lo único medido es que hoy tiene 0 filas.
