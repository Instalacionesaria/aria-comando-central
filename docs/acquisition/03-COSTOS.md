# El modelo de costos de Acquisition
> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.

La pantalla dibuja **diez cifras de dinero** y las diez descienden de un solo número: `inv`, la inversión de una campaña en la ventana, escrita una única vez en `lib/aios/acquisition.js:88`. Cuatro de esas diez son sumas y **seis son cocientes**: el costo de cada etapa, el costo por calificado del embudo, el de la campaña y el global. No hay una segunda fuente de dinero en el módulo, y no hay ninguna en la base: una búsqueda de columnas por `spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl` sobre los esquemas `negocio`, `public` e `identidad` devuelve tres coincidencias y ninguna es gasto de Meta poblado (`01-ACQUISITION.md:93`).

Este documento dice qué tiene que calcular ese modelo, con qué fórmula, sobre qué denominador y qué escribe cuando el denominador no existe. La mitad de los requisitos son de forma y sobreviven al andamiaje. La otra mitad depende de un dato que **nunca estuvo conectado en ninguna de las dos plataformas** (`01-ACQUISITION.md:256`), y ese es el contenido del §4.

---

## 1 · El dinero tiene un solo origen y diez destinos

### A3-01 · La inversión de una campaña en una ventana es el único dato de dinero que entra al modelo

`lib/aios/acquisition.js:88` — `inv: Math.round(c.invD * w.days)`. Es la única línea del módulo que produce dinero. De ahí sale todo: el acumulado por embudo (`t.inv += r.inv`, `:107`), el gran total (`g.inv += t.inv`, `:117`) y los seis cocientes. Un `grep` de `invD` sobre el archivo devuelve los siete literales de `CAMPS` (`:21, :23, :25, :27, :29, :31, :33`) y **una sola lectura**, la de `:88`.

El requisito es la forma del dato: **la inversión es un atributo de la campaña en la ventana**, no del embudo ni del período. El embudo y el total la reciben sumando y no la calculan.

**Estado:** no existe. `invD` no tiene fuente. Es el «no» más importante del informe de estado (`01-ACQUISITION.md:93`) y el riesgo número uno de esta pantalla (`:306`).

**Andamiaje que hay que borrar:** el producto `invD × days`. Multiplicar un gasto diario constante por el número de días es exactamente lo que un sistema real no puede hacer, y revela por contraste el A3-16: la inversión de una ventana es una **suma de días**, no una extrapolación.

### A3-02 · Los diez sitios de dinero de la pantalla se derivan de `inv`: cuatro sumas y seis cocientes

Las diez llamadas a `cf(...)` del módulo, en orden de aparición:

| # | Línea | Qué dibuja | Expresión | Clase |
|---|---|---|---|---|
| 1 | `:146` | KPI «Inversión» | `g.inv` | suma |
| 2 | `:150` | subtítulo del KPI «Calificados» | `g.cq` | cociente |
| 3 | `:181` | «$X c/u» del bloque de calificados | `t.inv / t.calificados` | cociente |
| 4 | `:190` | costo de cada etapa en la tarjeta | `t.inv / v` | cociente |
| 5 | `:199` | «Inversión» del encabezado del embudo | `t.inv` | suma |
| 6 | `:201` | «Costo / calif.» del encabezado del embudo | `t.inv / t.calificados` | cociente |
| 7 | `:225` | costo de cada etapa en la tabla | `r.inv / v` | cociente |
| 8 | `:230` | columna «Inversión» de la fila | `r.inv` | suma |
| 9 | `:236` | columna «Costo/calif.» de la fila | `r.inv / r.calificados` | cociente |
| 10 | `:244` | resumen de la cabecera plegable | `d.total.inv` | suma |

**El requisito que esto fija:** el dinero entra una vez y se deriva; no hay ninguna cifra de costo que se lea de otro lado ni que se guarde aparte. Cualquier implementación que traiga un CPL desde Meta y a la vez calcule el suyo tiene dos números con el mismo nombre — ver A3-09.

### A3-03 · El dinero se agrega sumando en los tres niveles, y sólo sumando

`:107` (campaña → embudo) y `:117` (embudo → total). No hay ponderación, ni promedio, ni prorrateo. Un embudo cuesta lo que cuestan sus campañas; el total cuesta lo que cuestan los tres embudos.

Es lo que hace legible el aviso que la vista escribe bajo los KPIs (`components/views/AcquisitionView.jsx:94-100`): **«Son volumen y dinero, no tasas»**. Volumen y dinero se suman entre embudos distintos; las tasas no.

---

## 2 · El costo por etapa

### A3-04 · Toda etapa de todo embudo publica un costo unitario: **diez ranuras y siete nombres**

`lib/aios/acquisition.js:9, :13, :17` — el diccionario `costs` de cada embudo mapea etapa → nombre del costo. Contadas, son diez ranuras (3 + 3 + 4) con siete nombres distintos, porque `C/clic` aparece en los tres embudos y `C/agendado` en dos.

| # | Embudo | Etapa | Etiqueta en pantalla | Nombre del costo | ¿Existe el denominador hoy? |
|---|---|---|---|---|---|
| 1 | Lead form ads | `contactos` | Leads | **CPL** | el conteo sí (233 en 14 días con `alta_en_el_crm`, `01-ACQUISITION.md:162`); el corte por embudo no |
| 2 | Lead form ads | `clics` | Clics a landing VSL | **C/clic** | **no** — ninguna tabla de tráfico en `negocio.*` (`:260`) |
| 3 | Lead form ads | `agendados` | Agendados | **C/agendado** | sí — 163 citas alcanzables, 82 con `adId` (`:213`) |
| 4 | Profile funnel | `contactos` | DMs | **C/DM** | **no** — «DM» no es una categoría de la base |
| 5 | Profile funnel | `clics` | Clics a landing VSL | C/clic | **no** |
| 6 | Profile funnel | `agendados` | Agendados | C/agendado | sí, con la misma atribución parcial |
| 7 | Booking directo | `contactos` | Contactos | **C/contacto** | el conteo sí; el corte no |
| 8 | Booking directo | `forms` | Completaron form | **C/form** | **no** — sin tabla de eventos de formulario (`:260-262`) |
| 9 | Booking directo | `clics` | Clics a landing VSL | C/clic | **no** |
| 10 | Booking directo | `agendados` | Agendas | **C/agenda** | sí, con la misma atribución parcial |

El §18.7 sólo nombra uno de los siete costos: `CPL`. Los otros los inventó la maqueta — pero siguiendo una regla, que es el A3-05.

### A3-05 · El nombre del costo es un atributo del embudo, y se deriva de lo que la etapa cuenta ahí

La correspondencia es exacta, etiqueta por etiqueta:

- `Leads` → **CPL** · `DMs` → **C/DM** · `Contactos` → **C/contacto**
- `Clics a landing VSL` → **C/clic** (idéntico en los tres, porque la etiqueta es idéntica en los tres)
- `Agendados` → **C/agendado** · `Agendas` → **C/agenda**
- `Completaron form` → **C/form**

**El costo se llama como lo que esa etapa cuenta, en el vocabulario de ese embudo.** La única excepción es `CPL`, y es la única que es un término de la industria y no una construcción del módulo. Diez literales que son una regla y una excepción.

El requisito: la clave de la etapa es interna y estable —es la que une la cadena de cálculo (`:92`)— y **el nombre del costo, como la etiqueta, es un atributo del embudo**. Un modelo con siete columnas fijas de costo no puede representar que el mismo paso se llame `CPL` en un embudo y `C/DM` en otro.

### A3-06 · El costo de una etapa es la inversión ENTERA del alcance dividida por el volumen de esa etapa

`:190` — `c.costs[s] + ' ' + (v ? cf(t.inv/v) : '—')`. `:225` — `sub + ' · ' + (v ? cf(r.inv/v) : '—')`.

Hay que decirlo porque se malinterpreta solo: **`C/clic` no es el gasto del paso contacto→clic dividido por los clics.** Es toda la inversión del alcance dividida por los clics. Es un **costo acumulado**: responde «cuánto me costó cada uno de los que llegaron hasta acá», no «cuánto cuesta este paso».

Consecuencia directa y medida: los cuatro costos de un embudo tienen el mismo numerador y sólo cambian de denominador, así que el costo **crece a lo largo de la cadena**. Corrida la aritmética del módulo sobre 51.627 pares de etapas contiguas (días 1 a 90 × los 25 valores que puede tomar `seedMod`), el costo **nunca decrece**: es estrictamente mayor en 51.521 pares e igual en 106, y esos 106 son los casos donde el redondeo deja dos etapas con el mismo volumen.

En «7 días», el embudo Lead form ads dibuja **CPL $11 · C/clic $27 · C/agendado $87 · C/calif. $141** — la misma inversión de $1.127 cuatro veces, con cuatro denominadores.

### A3-07 · El numerador es el del alcance de la fila: el embudo en la tarjeta, la campaña en la tabla

`:190` usa `t.inv` (total del embudo) y `:225` usa `r.inv` (inversión de la fila). La fila «Total del funnel» pasa por la misma función `row` con `d.total` (`:246`), así que su numerador vuelve a ser `t.inv`.

El requisito: **el costo de una etapa se calcula dentro del alcance que lo dibuja**. El costo por clic de una campaña no es el costo por clic de su embudo, y el de un embudo no es el de la pantalla. No hay prorrateos cruzados.

### A3-08 · El costo por etapa crece por construcción hoy, y no va a crecer solo mañana

En el prototipo el crecimiento está garantizado porque cada etapa se deriva de la anterior multiplicando por una tasa topada en 0,94 (`:86, :92`), así que el volumen sólo puede bajar. **En un sistema real las dos etapas se cuentan por separado y la cadena puede no cerrar** — un contacto que hace dos clics produce más clics que contactos, y entonces `C/clic` sale más barato que `CPL`.

El requisito no es forzar la monotonía: es que **la pantalla siga siendo legible cuando no se cumpla**, y que el caso se explique en vez de taparse.

### A3-09 · El CPL de la pantalla se calcula con nuestro denominador; el CPL de Meta es otra cifra y sirve de control

`:190` divide por `t.contactos`, que es nuestro conteo de contactos. Meta entrega su propio `cpl`, calculado sobre **su** conteo de leads — la tabla de referencia `public.closer_meta_metricas` tiene las dos columnas, `leads` y `cpl` (`01-ACQUISITION.md:252`).

Son dos números distintos con el mismo nombre, y el §18.7 pide explícitamente la diferencia entre ambos («diferencia entre leads reportados por Meta y leads identificados en la base»). El requisito: **el CPL que la pantalla publica es el nuestro, y el de Meta se guarda como contraste, nunca como reemplazo.** Y el aviso del §7 del informe de estado aplica entero: un cero en esa diferencia no significa «coinciden», significa que sólo se contó un lado.

---

## 3 · El costo por calificado

### A3-10 · El costo por calificado se publica en cuatro alcances

| Alcance | Línea | Expresión | Cómo se rotula |
|---|---|---|---|
| Global | `:120` → `:150` | `g.inv / g.calificados` | «$115 **por calificado**», como subtítulo del KPI |
| Embudo | `:201` | `t.inv / t.calificados` | «Costo / calif.» en el encabezado |
| Embudo | `:181` | `t.inv / t.calificados` | «$141 **c/u**» en el bloque de calificados |
| Campaña | `:236` | `r.inv / r.calificados` | columna «Costo/calif.» |

Las dos del embudo son **la misma expresión carácter por carácter**, así que la tarjeta muestra el número dos veces y no pueden divergir. Eso es correcto y hay que conservarlo: un solo cálculo, dos lugares donde mirarlo.

**Y una observación de modelo que importa:** `calificados` **no es una etapa**. No está en `stages`, ni en `labels`, ni en `costs` de ningún embudo (`:7-17`); se calcula después del bucle, en `:94`, y su rótulo «Calificados» está escrito a mano en `:176` y `:200`. Es el **undécimo costo** de la pantalla y el único que el modelo no declara — siendo el que decide el presupuesto. El requisito: la calificación es el último eslabón de la cadena y se modela como uno, con su etiqueta y su nombre de costo como los otros diez, o se dice por qué no.

### A3-11 · El costo por calificado global es el cociente de los dos totales, nunca el promedio de los embudos

`:120` — `g.cq = g.calificados ? g.inv / g.calificados : 0`.

Es la única cifra que un presupuesto puede leer. Un promedio de los tres embudos le daría a un embudo de 4 calificados el mismo peso que a uno de 34. Corrida la aritmética del módulo, el error del promedio contra el cociente correcto es:

| Período | Cociente de totales | Promedio de los 3 embudos | Error |
|---|---|---|---|
| 7 días | **$115** | $120 | +4,3 % |
| 30 días | **$126** | $130 | +3,2 % |
| Hoy | **$86** | $97 | **+12,9 %** |

El error crece cuando el volumen baja, que es exactamente cuando la cifra se mira más. La misma regla vale un nivel más abajo: el `Costo / calif.` del embudo (`:201`) se calcula sobre los agregados del embudo (`:104-110`), no promediando sus campañas.

### A3-12 · El costo por calificado va pegado al volumen que lo produce, no como KPI propio

`:150` — el quinto KPI trae dos cifras en una tarjeta: el conteo de calificados grande, y donde los otros cuatro llevan una frase de contexto («periodo seleccionado», «volumen total»), éste lleva **«$X por calificado»**.

El requisito de forma: **el costo no se presenta solo.** Un «$115» sin el «21 calificados» al lado es una cifra que no se puede juzgar; con 21 calificados en siete días, el costo por calificado es una estimación con un denominador de dos dígitos y hay que poder verlo.

### A3-13 · El costo por calificado es la cifra de decisión, y la pantalla ya lo marca

`:200-201` — de las tres estadísticas del encabezado del embudo, dos llevan la clase `key`, que las pinta en el color de acento (`app/aios.css:1767` y `:1876`): **Calificados** y **Costo / calif.** La que no la lleva es **Inversión**. La tesis del departamento en tres números, con las dos que importan resaltadas: cuántos buenos salieron y a cómo salió cada uno.

Lo confirma el modal: la única recomendación accionable con umbral de toda la pantalla es «Sube el presupuesto de retargeting mientras el costo por calificado se mantenga bajo $110» (`lib/aios/acquisition-plan.js:21`), y el freno del otro grupo enuncia la regla de negocio completa: «Deja de escalar Prospecting B **por costo por contacto**: su costo por calificado es el más alto» (`:16`). **La decisión de escala se toma por costo por calificado, no por costo por contacto.**

**Estado:** el §18.7 pide `cost per qualified lead` como KPI, así que la métrica está especificada. Pero el §18.10 prohíbe que Acquisition recomiende en solitario duplicar presupuesto, reducir inversión o escalar por CPL, y esas dos líneas del plan son literalmente lo prohibido, **en dos grupos distintos** (`01-ACQUISITION.md:129`). Al reconstruirlo, las dos cambian de lugar, no de redacción.

### A3-14 · Ninguna cifra de dinero abre la lista de contactos

`:146` pasa `0` como quinto campo del KPI de Inversión, y `:153` sólo emite `data-leads` cuando ese campo es distinto de cero. Ninguna de las diez cifras de `cf(...)` lleva los atributos del cajón de contactos; los llevan los volúmenes.

El requisito, y está bien resuelto: **el dinero no se explica con una lista de personas.** Un «$115 por calificado» no se abre en 21 fichas, porque el 115 no es una propiedad de esas 21 fichas sino del gasto que las produjo.

---

## 4 · La dependencia dura: el gasto

### A3-15 · Ninguna cifra de los §2 y §3 se puede calcular hoy

Medido contra la base, no contra el código. Una búsqueda de columnas en `information_schema.columns` sobre `negocio`, `public` e `identidad` con el patrón `spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl|adset|ad_id|campaign|anuncio|creativ|meta_` devuelve **trece filas y ninguna es un dato de Meta poblado** (`01-ACQUISITION.md:244`). Acotada al patrón de dinero puro, son tres coincidencias: `negocio.comisiones.meta_mensual` (una meta de ventas, no Meta), `public.aria_brain_clientes.ht_budget` (de otra plataforma) y las columnas de `public.closer_meta_metricas`, **que tiene 0 filas** (`:93`).

El cero es un cero real y no un cero de RLS: la lectura va como `postgres` con `rolbypassrls` (`:254`).

**Lo que esto significa para este documento:** de los cocientes y sumas que los §2 y §3 especifican, **ninguno es calculable**. No es que estén incompletos: no tienen numerador.

Y el riesgo asociado está escrito y es el primero del informe (`:306`): reconstruir la pantalla leyendo contactos reales y dejar el costo saliendo de `CAMPS[i].invD` produce **conteos verdaderos con costos inventados**, que es peor que la pantalla de hoy — porque hoy nadie puede confundirse, y entonces sí.

### A3-16 · El gasto se guarda por objeto y por día

El §18.4 lo cierra con una exigencia de forma: «las métricas deben guardarse por fecha para permitir comparaciones históricas», y el §18.19 punto 3 lo repite como pendiente.

El requisito: el gasto se guarda con grano **objeto × día** —campaña, ad set y anuncio—, no como total de una ventana. Es lo que permite que la inversión de cualquier período se arme **sumando días** en vez de extrapolando, que es lo que hace `:88` y no se puede hacer con datos reales. Y es lo que hace posible el A3-17.

### A3-17 · El recolector reescribe días ya guardados

**Los insights de Meta se corrigen hacia atrás durante días** (`01-ACQUISITION.md:274`). Un recolector que sólo inserte «lo de ayer» guarda cifras que Meta después cambia, y la pantalla publica un costo por calificado de la semana pasada que ya no es el que Meta reporta.

El requisito: la ingesta de gasto es **idempotente sobre una ventana de relectura**, no un `insert` incremental. Es la contracara del A3-16: guardar por día no sirve de nada si los días no se pueden rehacer.

### A3-18 · El gasto llega con su moneda declarada

`lib/aios/acquisition.js:42` — `cf = n => '$' + Math.round(n).toLocaleString('es-MX')`. El `$` está escrito a mano y el locale es mexicano, así que **la pantalla afirma pesos mexicanos sin que nadie lo haya declarado**. Meta factura la cuenta en la moneda de la cuenta publicitaria, que no aparece en ninguna parte del módulo ni de la base.

Peor: el sistema ya formatea dinero de dos maneras. `acquisition.js:42` usa `es-MX`; `lib/aios/executive.js:31` usa `'$' + ... en-US`. Dos locales en dos archivos para la misma cifra — y el gasto de Acquisition entra en el ROAS, el costo por venta y el margen sobre ads de Executive (`executive.js:39, :96, :116, :125`).

El requisito: **el dinero se formatea con la moneda del dato, declarada junto al dato.** El `$` literal no es una declaración de moneda.

Nota de esquema: en la tabla de referencia `public.closer_meta_metricas`, **ninguna columna es la moneda** (`01-ACQUISITION.md:252`).

### A3-19 · El numerador y el denominador se atribuyen a la misma entidad — y la cobertura cae a lo largo de la cadena

Éste es el requisito que ningún literal del prototipo insinúa, porque sus siete campañas cubren el 100 % de sus contactos. Con datos reales no es así, y está medido.

El gasto de Meta viene completo en los tres niveles. Los denominadores no:

| Denominador | Cobertura a nivel **anuncio** | Cobertura a nivel **campaña** |
|---|---|---|
| Contactos de la ventana (233) | 176 con `adId` — **75,5 %** | 217 con `campaignId` — **93,1 %** |
| Citas alcanzables (163) | 82 con `adId` — **50,3 %** | 133 con `campaignId` — **81,6 %** |

(`01-ACQUISITION.md:174-175` y `:213`.)

Dividir un gasto completo por un denominador incompleto **sobrestima el costo por el inverso de la cobertura**. A nivel anuncio, el CPL sale un **32,5 %** más caro de lo que es, y el C/agendado un **98,8 %** más caro — casi el doble. A nivel campaña, **7,4 %** y **22,6 %**.

**Y el sesgo empeora a lo largo de la cadena**, porque la atribución se pierde donde más se necesita: el costo por calificado cuelga de agendados (`:94`), así que hereda el peor de los cuatro. Es exactamente el orden inverso al que conviene.

El requisito: **el costo se publica al grano en el que la atribución cierra**, y cuando no cierra se dice la cobertura junto a la cifra. El §18.5 ya puso el freno general —«no debe presentar como definitivas conclusiones sobre citas, ventas o revenue cuando la trazabilidad sea insuficiente»— y el §18.7 pide el porcentaje de contactos con `meta_ad_id` como métrica publicable. Esta pantalla no lo dibuja en ninguna parte, y sin ese renglón toda la columna de costos se lee como si cubriera el 100 %.

### A3-20 · La fila sin anuncio tiene gasto desconocido, no gasto cero

De los 233 contactos de la ventana, **57 no traen `adId`** y agendan 47 veces (`01-ACQUISITION.md:292`). No son contactos gratis: en su mayoría son los 41 de la campaña BOFU de retargeting, que sí tiene gasto — sólo que el widget de calendario no pasa el identificador del anuncio, así que el gasto vive a nivel campaña y la fila se dibuja a nivel anuncio.

Si esa fila se arma con el gasto del anuncio, su gasto es 0 y **sus cuatro costos salen `$0`** — un cero técnicamente correcto (no hay gasto de anuncio que cargarle) que en pantalla se lee como el mejor rendimiento de la tabla.

El requisito: **el costo de una fila sin atribución es desconocido, y desconocido se escribe con guion, no con `$0`.** Es la regla de los dos ceros (`07-REGLAS-TRANSVERSALES.md:110`) aplicada al dinero, y encaja con el criterio que el departamento ya tiene escrito para esa fila: el conteo va, la tasa no (`lib/negocio/atribucionDelLead.ts:179-183`).

### A3-21 · El denominador de «Clics a landing VSL» no lo trae Meta

Es la etapa que aparece en los tres embudos (`:7, :11, :15`) y la que menos existe: no hay tabla de tráfico, sesiones ni eventos de landing en `negocio.*` —21 tablas revisadas una por una— y **un clic no queda registrado en ninguna parte de esta base** (`01-ACQUISITION.md:260-262`).

Conectar Meta no lo resuelve. La tabla de referencia trae `clics`, que es *todos* los clics del anuncio, no `link_clicks` ni `landing_page_views`, que en Meta son tres números distintos — y ninguno de los dos últimos está entre sus columnas (`:252`). Además, dos de los tres embudos no tienen clic de Meta que contar: el de perfil entra por DM y el de agendamiento por el widget de calendario.

El requisito: **el denominador de `C/clic` es instrumentación de la landing** (Meta Pixel + Conversions API, GA4 o un endpoint propio), y es un sistema aparte del gasto. Tres de los diez costos de la tabla del A3-04 dependen de él.

### Qué cuesta traer el gasto

La noticia buena del informe de estado es que esto es **trabajo de integración y no de diseño de datos** (`01-ACQUISITION.md:256`). El esquema ya está pensado: `public.closer_meta_metricas` tiene exactamente la forma que el §18.4 pide —`nivel`, `objeto_id`, `nombre`, `padre_id`, `fecha`, `gasto`, `impresiones`, `clics`, `alcance`, `ctr`, `cpc`, `cpm`, `leads`, `cpl`, `video_reproducciones`, `video_25/50/75/100`, `sincronizado_el`— con jerarquía campaña→ad set→anuncio y grano diario.

Con dos precisiones que cambian el trabajo:

1. **Esa tabla es de la plataforma anterior.** Vive en `public.closer_*`; lo nuestro es el esquema `negocio.*`. Un `grep` de `closer_meta_metricas`, `meta_ad_account_id` y `meta_token_cifrado` sobre todos los `.ts`, `.tsx`, `.js`, `.mjs` y `.sql` del repositorio da **cero coincidencias** (`:254`) — verificado de nuevo hoy, sigue en cero. No es una tabla que se llene: es un diseño de referencia que se copia al esquema propio.
2. **A ese diseño le faltan tres cosas para esta pantalla**: la moneda (A3-18), `link_clicks`/`landing_page_views` (A3-21) y la frecuencia.

Las piezas del trabajo, entonces: una app de Meta con permiso de lectura de anuncios aprobada por App Review; un token de larga duración por organización, cifrado —los dos huecos ya existen en `public.closer_org_config`, que tiene 3 filas y **0 no nulos** en `meta_ad_account_id` y `meta_token_cifrado` (`:252`)—; una tabla en `negocio.*` con el grano del A3-16 más las tres columnas que faltan; un recolector diario idempotente con ventana de relectura (A3-17); y las dos decisiones que no son técnicas: la moneda y el grano de atribución del A3-19.

---

## 5 · La regla del denominador cero

El módulo tiene una regla de tres ramas, y se puede enunciar exactamente: **el guardado depende de dónde se escribe el cociente, no de qué mide.**

### A3-22 · Todo cociente escrito para una persona lleva un guion cuando el denominador es cero — **nueve sitios**

| Línea | Qué | Guardado |
|---|---|---|
| `:171` | tasa de una etapa en la tarjeta | `bb ? ... : '—'` |
| `:180` | «% de agendados» del bloque de calificados | `v ? ... : '—'` |
| `:181` | «$X c/u» del bloque de calificados | `t.calificados ? ... : '—'` |
| `:190` | costo de la etapa en la tarjeta | `v ? ... : '—'` |
| `:201` | «Costo / calif.» del encabezado | `t.calificados ? ... : '—'` |
| `:221` | tasa de la celda de tabla | `bb ? ... : '—'` |
| `:225` | costo de la etapa en la tabla | `v ? ... : '—'` |
| `:235` | «% calif.» de la fila | `r.agendados ? ... : '—'` |
| `:236` | «Costo/calif.» de la fila | `r.calificados ? ... : '—'` |

**Cinco de los nueve son dinero** (`:181, :190, :201, :225, :236`) y cuatro son tasas. No hay un solo `NaN` ni `Infinity` posible en estos nueve puntos.

Es la regla de los dos ceros dicha en código (`07-REGLAS-TRANSVERSALES.md:110`): **una cifra que no se puede calcular no se dibuja como cero**, porque `$0 por agendado` y «no hubo agendados» mandan a hacer cosas opuestas.

### A3-23 · Todo cociente que se dibuja como ancho de barra lleva cero

`:137` (`icpBar`: `t ? (n/t)*100 : 0`) y `:165` (la barra de proporción de la etapa: `base ? (v/base)*100 : 0`).

Y está bien: **un ancho de 0 % es el dibujo honesto de «nada que mostrar»**, mientras que un guion no es un ancho. Las dos ramas son coherentes con la misma regla; lo que cambia es que una barra vacía no afirma una cantidad.

### A3-24 · Todo cociente que se guarda en el modelo lleva cero — y ahí la regla se rompe

Dentro de `build()` hay exactamente **tres** cocientes, y los tres están guardados con `: 0` en vez de con un guion:

| Línea | Qué | Se dibuja en | Qué escribe con denominador cero |
|---|---|---|---|
| `:120` | `g.cq = g.calificados ? g.inv / g.calificados : 0` | `:150` | **«$0 por calificado»** |
| `:98` | `o.icp = q ? (...) / q : 0` | `:237` | **«0 %»** de afinidad |
| `:111` | `t.icp = t.calificados ? (...) : 0` | `:181` | **«ICP 0 %»** |

El primero es el grave: `cf(0)` devuelve `'$0'`, así que el KPI de Calificados escribe **«$0 por calificado»** cuando se gastó dinero y no salió ninguno — exactamente el revés de la verdad, en la cifra con la que se decide escalar.

**Por qué pasa:** el guardado está donde se *calcula*, no donde se *escribe*. En `:120` no existe la noción de guion, y para cuando `:150` formatea el número ya no puede distinguir «cero porque no hubo calificados» de «cero porque no hubo gasto».

**El requisito:** el guardado va donde se escribe la cifra, y lo que el modelo devuelve cuando no puede dividir es **la ausencia** —nulo, no cero— para que el render decida cómo se dibuja. Los nueve sitios del A3-22 lo hacen bien porque calculan y escriben en el mismo lugar; los tres del A3-24 no.

**Por qué nadie lo vio:** con los siete literales de `CAMPS` el caso es inalcanzable. Barridos todos los días de 1 a 3 y los 25 valores posibles de `seedMod`, el mínimo de calificados globales que el prototipo puede producir es **2**, nunca 0. El andamiaje esconde el defecto que el dato real va a encontrar el primer día — y va a encontrarlo pronto: cuatro de los siete anuncios de la ventana medida tienen 1 o 2 contactos (`01-ACQUISITION.md:288, :312`).

### A3-25 · El guion dice que no se puede calcular; el dinero gastado se dice en la misma fila

Corrida la aritmética del prototipo en el período «Hoy», la fila de Prospecting B dibuja: `Inversión $48` · `CPL $12` · `C/clic $48` · `C/agendado —` · `Costo/calif. —`.

Los dos guiones son correctos: sin agendados no hay costo por agendado. Pero **lo que hay que saber es que los $48 se gastaron igual y no compraron ninguna agenda**, y eso el guion no lo dice. Lo dice la columna de Inversión, que está en la misma fila y no lleva guardado (`:230`).

El requisito: **el guion es la respuesta correcta y no es la respuesta completa.** La inversión se publica siempre —es una suma, no un cociente, y su cero es un cero medido— y es la que convierte «no se puede calcular» en «se gastó esto y no produjo nada».

---

## 6 · Lo que los propios números del prototipo desmienten

Corrida la aritmética de `build()` tal como está (`acquisition.js:85-122`) para los tres períodos del selector, la pantalla se contradice con lo que la pantalla dice de sí misma. No son requisitos: son la prueba de que los umbrales del plan son literales de maqueta y no se pueden portar.

**1 · El umbral de $110 del plan ya está violado por la cifra que la pantalla dibuja.** El plan dice «Sube el presupuesto de retargeting mientras el costo por calificado se mantenga bajo $110» (`acquisition-plan.js:21`). En el período por omisión, **7 días**, la campaña «Retargeting 90d» muestra **$147**. En 30 días muestra $105 y en «Hoy» muestra un guion. El umbral se cumple o no se cumple según el botón de período que esté apretado, y el plan es texto fijo que no sabe cuál es.

**2 · «El retargeting produce los calificados más baratos» es falso contra la propia tabla.** Ordenadas por costo por calificado en 7 días: Remarketing web $67 · Público frío $95 · Reel de autoridad $126 · Prospecting A $129 · **Retargeting 90d $147** · Prospecting B $168 · Remarketing interacción $168. Es el quinto de siete. En 30 días es el segundo, detrás de Remarketing web.

**3 · La señal y el plan dan dos cifras distintas para la misma campaña, y la pantalla le da la razón al plan.** El plan dice que Prospecting B tiene «afinidad ICP de 43 %» (`acquisition-plan.js:11`) y la señal dice que sus calificados «promedian 54 %» (`AcquisitionView.jsx:119`). En 7 días la pantalla dibuja **43 %**.

**4 · La señal compara contra un 72 % que la pantalla dibuja como 25 %.** «Frente al 72 % del retargeting» (`AcquisitionView.jsx:119`): en 7 días, «Retargeting 90d» muestra **ICP 25 %** — el piso de la fórmula `(icpA*100 + icpM*60 + icpB*25) / q` (`:98`). Y su reparto ICP declarado es de los más altos de las siete (`icp.a = .45`, `:26`). Con **1 solo calificado**, los dos redondeos de `:96` dan cero y el residuo de `:97` manda ese único calificado al tramo bajo, así que una de las mejores campañas del modelo publica la peor afinidad de la pantalla.

Los dos últimos son el mismo defecto que el A3-24 y el A3-11: **con denominadores de un dígito, el costo por calificado se dispara y la afinidad se desploma al piso, y ninguna de las dos cifras es una medición del negocio.** Es lo que el piso de 10 del sistema existe para evitar (`lib/negocio/indicadoresDeCitas.ts:300`), y esta pantalla no lo tiene.

---

## 7 · Preguntas abiertas

**¿En qué moneda?** `cf` antepone un `$` escrito a mano y formatea en `es-MX` (`acquisition.js:42`); Executive formatea el mismo dinero en `en-US` (`executive.js:31`). Meta entrega el gasto en la moneda de la cuenta publicitaria, que no está declarada en ninguna parte, y la tabla de referencia no tiene columna para guardarla. Falta decidir qué moneda se muestra y qué pasa cuando la cuenta reporta en otra.

**¿A qué grano se publica el costo?** El A3-19 mide que la atribución cierra al 93,1 % por campaña y al 75,5 % por anuncio sobre contactos, y al 81,6 % y 50,3 % sobre citas. La tabla del prototipo tiene una fila por campaña. Falta decidir si la fila es campaña, ad set o anuncio — y de eso depende si el C/agendado sale 22,6 % o 98,8 % más caro de lo que es.

**¿Qué es un «calificado»?** Es el denominador de la cifra con la que se decide escalar y no está definido en la base. `o.calificados` sale de `agendados × calif` con un literal por campaña (`:94`); lo que hay es un puntaje continuo, «Puntaje | ICP», poblado en 229 de 233 contactos (`01-ACQUISITION.md:111`), y ninguna marca de calificación.

**¿El costo por etapa comparte numerador, o cada paso lleva el suyo?** Hoy los cuatro costos de un embudo son la misma inversión con cuatro denominadores (A3-06), que responde «cuánto costó cada uno de los que llegaron hasta acá». La otra lectura —cuánto cuesta el paso— es otra métrica y no está en el prototipo.

**¿Se publica un piso de volumen para las cifras de dinero?** El sistema tiene `PISO_DE_UNA_TASA = 10` y lo aplica a las tasas (`lib/negocio/indicadoresDeCitas.ts:300`); de los 7 anuncios de la ventana medida, sólo 3 lo alcanzan (`01-ACQUISITION.md:288`). El §6 muestra qué pasa con costos calculados sobre 1 o 2 calificados. Falta decidir si el piso apaga el costo, lo apaga y deja la inversión, o lo publica con la advertencia.

**¿Lleva delta la Inversión?** `:146` lo declara, pero `inv` se calcula sin el modificador del período (`:88`), así que con dos ventanas de la misma duración el actual y el anterior son idénticos y `delta` cae siempre en el «=» plano de `:130`. **El único caso en que ese KPI puede mostrar una flecha es cuando las dos ventanas duran distinto** —sólo alcanzable en modo `custom` + «Otro periodo»— y entonces la flecha es exactamente la razón entre las duraciones, que es el artefacto que la advertencia de `:77` existe para señalar. Comparar el gasto contra el período anterior exige medirlo por día (A3-16); si no, el KPI se muestra sin delta como las tres cifras del encabezado del embudo.

**¿Sube la inversión en verde?** `:146` pasa `invert:false`, así que gastar más se dibuja con flecha verde. Las ocho llamadas a `delta` pasan `false` (`:146-150, :179, :188, :234`) y el parámetro existe precisamente para el caso contrario: costo por calificado, CPL y costo por clic son las tres métricas donde bajar es bueno. Gastar más no es bueno por sí mismo, y el §18.10 prohíbe recomendar escalar presupuesto en solitario.

**¿Cómo se reparte un gasto de campaña entre dos embudos?** El A3-07 exige que el costo se calcule dentro del alcance que lo dibuja, y el A3-20 muestra el caso donde el gasto vive un nivel más arriba que la fila. Si una campaña alimenta dos embudos, falta decidir de quién es ese gasto y contra qué volumen se divide.

**¿Es `calificados` una etapa?** El A3-10 mide que no lo es en el modelo —no está en `stages`, `labels` ni `costs`— y sí lo es en la pantalla, con su volumen, su tasa, su costo y su barra. Falta decidir si se incorpora a la cadena con los otros diez costos o si queda declarado aparte por alguna razón que el prototipo no escribe.
