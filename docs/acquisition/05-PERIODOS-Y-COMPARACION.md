# El período y la comparación
> Requisitos derivados del prototipo de Acquisition, no de una especificación escrita.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho
> como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/01-ACQUISITION.md`, medido el 2026-09-15.

El control de período es la pieza donde una pantalla de métricas miente más barato. No hace falta
equivocarse en una fórmula: alcanza con cambiar la ventana. Las cifras siguen siendo correctas una
por una, la pantalla no falla, y lo que cambió no es el negocio sino cuánto del negocio está
guardado. Este proyecto ya pagó esa cuenta dos veces —la tasa de cancelación que «subía hacia el
presente» y el booking rate que «se degradaba» al mirar más atrás— y las dos veces el culpable fue
el mismo: **la cobertura del dato no es constante en el tiempo, y el control no lo decía**
(`docs/estado actual/07-REGLAS-TRANSVERSALES.md:583-587`).

El prototipo de Acquisition trae la maquinaria de período casi entera y bien pensada: dos ventanas
por consulta, una regla de comparación central, un umbral de planicie, un eje para las métricas
donde bajar es bueno, y una advertencia cuando las duraciones no coinciden. Trae también defectos
que no hay que portar y un requisito que le falta. Este documento separa una cosa de la otra.

**Lo que hay que tener presente al leer:** en Acquisition, el período no elige una muestra más
grande. Elige **otra población con otra cobertura**. Medido el 2026-09-15, `adId` —la clave sin la
cual no hay tabla por anuncio— está en **176 de 233 contactos (75,5 %)** dentro de la ventana de 14
días (`01-ACQUISITION.md:175`) y en **213 de 584 (36,5 %)** sobre el total histórico
(`07-REGLAS-TRANSVERSALES.md:557`). Apretar «histórico» duplica el volumen y parte al medio la
atribución. Ningún control del prototipo dice eso.

---

## 1 · Qué ofrece el prototipo, y qué parte de eso es requisito

El estado de la pantalla tiene cuatro ejes y dos son de período (`lib/aios/acquisition.js:39`):

```js
const S = { period:'p7', rate:'step', cmp:'prev', open:{...} };
```

`S.period` y `S.cmp`. Todo lo demás —las dos ventanas, los deltas, la nota, las advertencias— se
deriva de esos dos valores más los cuatro campos de fecha.

### A5-01 · El período es un solo eje de estado, con dos formas: atajo de duración conocida o rango libre

**Rastro:** `lib/aios/acquisition.js:39`, `:60`, `:64`, `:68`, `:267`; `components/views/AcquisitionView.jsx:28-38` y `:39-46`.

Por `S.period` circulan cinco valores: `p1`, `p7`, `p30`, `hist` y `custom`. Los cuatro primeros son
claves de `PERIODS` (`:37-38`); `custom` **no lo es** — lo escribe el selector global de fechas
(`:267`) y `windows()` lo atiende como el tercer caso (`:68`). Los tres caminos devuelven la misma
forma, así que `build()` no sabe de dónde vino la ventana.

El requisito es la unión: **el atajo y el rango libre entran por la misma variable y salen por la
misma función**. Con dos ejes separados —uno para el segmentado y otro para el calendario— hay un
estado donde los dos están puestos y nada dice cuál manda; es exactamente el defecto A5-10.

**Estado:** el sistema real ya tiene resuelta la mitad de atajos y le falta el rango libre.
`lib/negocio/periodo.ts:37` define `ClaveDePeriodo = 'hoy' | '7d' | '30d' | 'completo'`, una lista
cerrada de cuatro, y `periodoDe()` (`:188`) devuelve `null` —o sea **rechazar**— ante cualquier
clave que no esté. No hay equivalente de `custom` en ese vocabulario.

### A5-02 · Todo período se resuelve a un número de días, y ese número entra en el cálculo

**Rastro:** `lib/aios/acquisition.js:37-38` (`PERIODS[x].d`), `:62`, `:66`, `:69`, `:88`, `:91`.

`p1:{d:1}`, `p7:{d:7}`, `p30:{d:30}`, `hist:{d:365}`. La duración sale del período, viaja dentro de
`w.days` y se usa en el cálculo. La pantalla no tiene un modo «período» y otro «rango»: tiene un
modo con la duración como parámetro.

**Andamiaje:** los valores de `m`/`pm` que acompañan a cada duración y la
multiplicación `invD * w.days` de `:88`, que extrapola desde un gasto diario constante. Un sistema
real suma días; no multiplica un promedio por la cantidad de días.

**Andamiaje que se delata solo:** `pmes:{d:12}` dura **doce días**. Y es inalcanzable: un `grep` de
`pmes` sobre todo el repositorio da **dos coincidencias, las dos son la misma línea** — el módulo
(`acquisition.js:38`) y el maquetado original (`aios-command-center_1.html:5377`). Ningún botón, ni
en la vista ni en el HTML, produce ese valor. Es código muerto.

**Estado:** `lib/negocio/periodo.ts:83-96` guarda las cuatro duraciones reales, incluida
`DIAS_DE_TODO = 3650` (`:52`) para «completo», con el motivo escrito: un centinela `null` obligaría
a que cada consulta bifurque su `where`, «son nueve `where` en cuatro archivos, y el día que alguien
agregue el décimo se le olvida la rama del nulo».

### A5-03 · El juego de atajos es una lista cerrada, escrita una sola vez

**Rastro:** `components/views/AcquisitionView.jsx:28-38` (tres botones: `p1`, `p7`, `p30`);
`lib/aios/acquisition.js:37-38` (cinco claves); `lib/negocio/periodo.ts:83-96` (las cuatro reales).

Hoy hay **listas de períodos distintas en el mismo producto**, y ninguna coincide con otra:

| Dónde | Claves |
| --- | --- |
| La vista de Acquisition (`AcquisitionView.jsx:28-38`) | `p1`, `p7`, `p30` |
| El módulo de Acquisition (`acquisition.js:37-38`) | `p1`, `p7`, `p30`, `pmes`, `hist` |
| Executive (`lib/aios/executive.js:15-21`) | `hoy`, `7d`, `mes`, `tri`, `hist` |
| El vocabulario real del sistema (`lib/negocio/periodo.ts:37`) | `hoy`, `7d`, `30d`, `completo` |

El requisito no es cuántos botones hay: es que **la lista viva en un solo archivo y viaje a los dos
lados**, el que dibuja los botones y el que valida lo que llega. El motivo está escrito en
`periodo.ts:20-23`: «con la lista escrita dos veces, agregar un período es tocar dos archivos, y el
día que se toque uno solo el botón nuevo manda una clave que el servidor rechaza — o peor, el
servidor acepta una que ningún botón produce». `pmes` es la segunda mitad de esa frase ya ocurrida.

**Estado:** resuelto para Conversation y sin usar en Acquisition. `lib/autorizacion/secciones.ts`
declara la sección con `sinOperacionesTodavia: true` y `ls app/api/` no devuelve ninguna carpeta
`acquisition` (`01-ACQUISITION.md:60`): no hay servidor al que mandarle la clave todavía.

### A5-04 · El botón encendido describe la ventana que se calculó, no la que se pidió

**Rastro:** `lib/aios/acquisition.js:273-284`, comparado con `lib/aios/conversion.js:630-631`,
`lib/aios/creative.js:435-436` y `lib/aios/executive.js:168-169`.

El manejador del segmentado de Acquisition cambia `S.period`, apaga la píldora del calendario y
vuelve a dibujar. **No enciende el botón que se apretó.** Los otros tres departamentos sí: los tres
hacen `remove('on')` sobre todos y `add('on')` sobre el que recibió el clic.

El defecto es comprobable en tres clics: elegir un rango en el calendario apaga los tres botones
(`lib/aios/datepicker.js:116-117`, que busca el contenedor `.ch-period` — el mismo `div` de
`AcquisitionView.jsx:27`); después, apretar «30 días» recalcula las cifras y **deja el segmentado
apagado**. La pantalla queda mostrando treinta días sin que nada diga que son treinta.

Es el mismo defecto que `lib/negocio/periodo.ts:101-103` ya cerró del otro lado: se eligió treinta
como valor por omisión y no catorce porque «catorce no está entre los cuatro botones, y un valor por
omisión que ningún botón produce deja el segmentado sin nada encendido».

### A5-05 · El rango libre tiene piso y techo, y el sistema los impone

**Rastro:** `lib/aios/acquisition.js:69` y `:75`.

```js
const da = Math.max(1, Math.min(365, dayDiff(a1, a2) || 21));
```

Las dos ventanas pasan por el mismo recorte. El techo de 365 coincide con `hist.d` (`:38`): el rango
libre no puede pedir más que el período histórico.

**Requisito:** existe una ventana máxima consultable y el sistema la aplica en vez de confiar en los
campos de fecha. **Andamiaje:** que el techo sea 365 y sobre todo el fallback `|| 21`, que es el
largo del rango que la vista trae por defecto (`AcquisitionView.jsx:68` y `:72`). Ver A5-07: ese
fallback tapa dos casos que no son el mismo.

### A5-06 · La ventana incluye los dos extremos

**Rastro:** `lib/aios/acquisition.js:45`.

```js
const dayDiff = (a,b) => (!a || !b) ? 0 : Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
```

El `+ 1` no es un ajuste: es la definición. Del 1 al 21 de julio son **21 días**, no 20. Y la misma
convención tiene que usarse al armar el período de comparación (`shift(a1, da)`, `:72`) o las dos
ventanas quedan corridas un día.

**Está confirmada por el otro extremo del sistema:** los atajos del calendario compartido cuentan
igual — «Últimos 7 días» es `a.setDate(a.getDate()-6)` y «Últimos 30 días» es `-29`
(`lib/aios/datepicker.js:20-21`). Dos módulos independientes con la misma aritmética; eso la vuelve
convención y no casualidad.

### A5-07 · Un rango inválido se rechaza, no se corrige en silencio

**Rastro:** `lib/aios/acquisition.js:69`, comparado con `lib/aios/period-controls.js:20`.

El prototipo no rechaza nada, y produce dos resultados distintos según cuánto esté invertido el
rango. Los dos son comprobables a mano:

| Lo que se escribe en los campos | Lo que calcula `windows()` | Qué se ve |
| --- | --- | --- |
| `2026-07-21` → `2026-07-01` (invertido 20 días) | `dayDiff` = **−19** → `min(365,−19)` = −19 → `max(1,−19)` = **1** | La nota dice «1d vs 1d» |
| `2026-07-02` → `2026-07-01` (invertido 1 día) | `dayDiff` = **0**, que es falsy → `0 \|\| 21` = **21** | La nota dice «21d vs 21d» |
| Campo vacío | `dayDiff` = 0 → **21** | La nota dice «21d vs 21d» |

Un día de diferencia en el error de tipeo cambia la ventana de uno a veintiún días, y la pantalla
dibuja las dos con la misma cara. **El `|| 21` colapsa dos hechos distintos —«no hay fechas» y
«las fechas están al revés»— en el mismo número**, que es la regla de los dos ceros
(`07-REGLAS-TRANSVERSALES.md:110-150`) aplicada a una duración.

**El sistema ya tiene la conducta correcta escrita al lado:** el otro control de rango del mismo
producto rechaza el rango invertido y no hace nada (`lib/aios/period-controls.js:19-20`):

```js
const f = new Date(ins[0].value+'T00:00:00'), t = new Date(ins[1].value+'T23:59:59');
if(f > t) return;
```

### A5-08 · Los cortes de día se calculan en una zona horaria declarada

**Rastro:** `lib/aios/acquisition.js:53-57`.

```js
function shift(dateStr, days){
  const d = new Date(dateStr);          // parsea en UTC
  d.setDate(d.getDate() - days);        // opera en hora local
  return d.toISOString().slice(0, 10);  // serializa en UTC
}
```

Hoy funciona porque el desfase entra y sale igual: con UTC−5, `shift('2026-07-01', 1)` da
`'2026-06-30'`, que es lo correcto. Deja de funcionar en cuanto el desfase cambie entre las dos
operaciones — un cruce de horario de verano corre la ventana un día, y el resultado sigue pareciendo
una fecha válida.

**El requisito es que la zona sea del sistema y no del navegador de quien mira.** El resto del
producto ya lo resolvió al revés que este módulo: `07-REGLAS-TRANSVERSALES.md:299-303` verifica por
`grep` que los cinco módulos de cifras tengan **cero `Date.now()` y cero `new Date()`** y quince usos
de `now()` de PostgreSQL, «la única forma de que el *ahora* sea el mismo reloj que escribió las
filas». Y `lib/negocio/periodo.ts:70-76` explica por qué «Hoy» son las últimas 24 horas y no el día
del calendario: «elegirla mal es un defecto que este proyecto ya conoce: la suite corre en
`America/Lima`, `UTC` y `Asia/Tokyo` justamente porque una cifra que cambia según dónde esté el
servidor es indistinguible de una cifra correcta».

Nótese que el calendario compartido **sí** se defiende: construye cada día con
`new Date(b.dataset.d + 'T12:00:00')` (`lib/aios/datepicker.js:97`), al mediodía, para que ningún
desfase lo corra de día. `shift()` no tiene esa defensa.

### A5-09 · El rango vive en el estado, y el cálculo se alimenta del estado

**Rastro:** `lib/aios/acquisition.js:44`, usado en `:68` y `:74`; escritura muerta en `:268`.

```js
const val = id => document.getElementById(id).value;
```

`windows()` no lee el rango guardado en `S`: lee los cuatro campos de fecha directo del documento. Y
el manejador del calendario global guarda `S.from` y `S.to` (`:268`): nadie los lee nunca.

El resultado es la ruta de estado más rota del módulo, y se recorre en dos clics: el usuario abre la
píldora, elige «Últimos 7 días», el rótulo cambia a «10 sep – 16 sep», la barra de fechas aparece
mostrando `2026-07-01 → 2026-07-21` **y los números son los del 1 al 21 de julio**. El calendario
mueve el rótulo y no mueve una sola cifra.

**Requisito:** el rango es parte del estado y el cálculo se alimenta del estado, no del DOM. Con el
cálculo leyendo el documento, el estado y las cifras pueden divergir sin que nada falle — que es
justo lo que pasa hoy.

### A5-10 · Un solo control de rango por pantalla, y con un dueño

**Rastro:** `components/views/AcquisitionView.jsx:39-46` (la píldora) y `:64-92` (la barra);
`lib/aios/acquisition.js:258` y `:266-272`.

Conviven dos controles que hacen lo mismo. La píldora abre el calendario compartido y su manejador
pone `S.period = 'custom'` (`:267`), lo que **hace aparecer la barra de fechas** (`:258`), que trae
sus propios cuatro campos con sus propios valores por omisión. Los dos controles compiten por el
mismo eje y hoy sólo el segundo mueve las cifras (A5-09).

Hay además un tercer control fantasma: `lib/aios/period-controls.js:33-34` registra un manejador sobre
`#acqCustomBtn` y **ese elemento no existe** — ni en `AcquisitionView.jsx` ni en el maquetado
original. El `grep` devuelve dos coincidencias y las dos son el manejador, ninguna es un botón.

---

## 2 · Las dos ventanas

### A5-11 · Toda consulta produce dos ventanas y una frase que las explica

**Rastro:** `lib/aios/acquisition.js:59-83`.

`windows()` devuelve siempre `{ a:{days,mod}, b:{days,mod}, note }`. **No hay ningún camino por el
que la pantalla calcule una sola ventana**: el período de comparación existe incluso en los dos
casos donde después se decide no mostrar el delta (`hist` y `p1`, ver A5-15). Los tres caminos
—histórico (`:60-63`), atajo (`:64-67`) y rango libre (`:68-82`)— devuelven la misma forma, así que
`build()` no sabe de dónde vino su ventana.

**Estado:** la mitad es reproducible hoy y la otra mitad no tiene contra qué. La cohorte se arma con
`alta_en_el_crm` entre dos fechas (`01-ACQUISITION.md:162`, regla 6 del §6) y eso funciona; lo que
no hay es historia anterior. Medido el 2026-09-15 con `group by date_trunc('month', alta_en_el_crm)`:
**531 de 559 contactos (95,0 %) caen en los últimos 45 días**, con 28 en total antes de agosto de
2026 y ningún contacto entre septiembre y noviembre de 2025 (`01-ACQUISITION.md:99`).

### A5-12 · El modelo se calcula una vez por ventana, y los tres bloques leen el mismo objeto

**Rastro:** `lib/aios/acquisition.js:85` (la firma) y `:261-263` (las seis llamadas).

```js
renderKpis(build(w.a), build(w.b));
renderFunnels(build(w.a), build(w.b));
renderTables(build(w.a), build(w.b));
```

`build(w)` es una función pura de la ventana: recibe `{days, mod}` y devuelve el modelo de tres
niveles (campaña → embudo → total). Esa firma es la del endpoint el día que el dato sea real. Lo que
no se porta es llamarla seis veces: con datos de servidor son **seis consultas donde alcanzan dos**,
y peor, seis consultas que pueden devolver cifras distintas entre sí si algo se escribe en el medio
— el mismo argumento que `lib/negocio/indicadoresDeCitas.ts:338-340` ya tiene escrito para las dos
poblaciones de la cancelación: «dos consultas podrían ver estados distintos de la tabla […] y
entonces las dos poblaciones de la misma tarjeta no sumarían el total, sin que nada falle».

### A5-13 · El período anterior termina el día antes y dura lo mismo

**Rastro:** `lib/aios/acquisition.js:71-73`, con `shift` en `:53-57`.

```js
b2 = shift(a1, 1); b1 = shift(a1, da); db = da;
```

Si el período A va del día X al día Y y dura `da` días, el período B termina en `X−1` y empieza en
`X−da`. Las dos ventanas son **contiguas, no se solapan y tienen la misma duración por
construcción**. Por eso en modo `prev` la advertencia de duraciones distintas (`:77`) no puede
dispararse nunca: `db` se copia de `da` en la misma línea.

**Estado:** la regla es correcta y la base no la soporta todavía. Medido el 2026-09-15, las fechas
por omisión de la vista traen **3 contactos** en el período y **0** en la comparación
(`01-ACQUISITION.md:135`). La conducta de la pantalla en ese hueco es la pregunta abierta P-04.

### A5-14 · La comparación es una decisión del usuario, no una constante

**Rastro:** `components/views/AcquisitionView.jsx:76-83`; `lib/aios/acquisition.js:39` (`cmp:'prev'`
por omisión), `:71-76`, `:259`, `:290-295`.

Dos opciones: «Periodo anterior», que deriva la ventana B del período A, y «Otro periodo», que la lee
de dos campos propios que sólo aparecen con esa opción elegida (`:259`).

Un detalle de forma que sí es requisito: el manejador del segmentado de comparación **sí** mueve la
clase `on` a la opción elegida (`:293`), al revés que el del período (A5-04). Los dos controles de la
misma barra están escritos con criterios opuestos.

---

## 3 · Las reglas de la comparación

Una sola función produce **todas** las flechas de la pantalla, en ocho puntos de llamada verificados
por `grep`: los cinco KPIs (`:146`, `:147`, `:148`, `:149`, `:150`), los calificados de la tarjeta de
embudo (`:179`), cada etapa de la tarjeta (`:188`) y los calificados de cada fila de tabla (`:234`).

```js
function delta(cur, prev, invert){
  if(S.period === 'hist' || S.period === 'p1') return '';   /* Histórico y Hoy: sin comparación */
  if(!prev || !cur) return '';
  const d = (cur - prev) / prev;
  if(!isFinite(d)) return '';
  const good = invert ? d < 0 : d > 0;
  if(Math.abs(d) < .005) return ' <span class="dlt flat">=</span>';
  const cls = good ? 'up' : 'down';
  const ar  = d > 0 ? '▲' : '▼';
  return ' <span class="dlt ' + cls + '">' + ar + ' ' + Math.round(Math.abs(d*100)) + '%</span>';
}
```

### A5-15 · Histórico y Hoy no comparan contra nada

**Rastro:** `lib/aios/acquisition.js:125`, con el mismo comportamiento en `lib/aios/executive.js:58`.

Es la regla más honesta del módulo y **es del sistema, no de la pantalla**: Executive la tiene
escrita aparte con el mismo efecto (`if(exP === 'hist' || exP === 'hoy' || !before) return ''`).

Los dos motivos son distintos y los dos importan:

- **Histórico** no tiene un histórico anterior. Compararlo contra sí mismo es lo que hace el
  andamiaje de `PERIODS.hist = {d:365, m:1.00, pm:1.00}` (`:38`), el único período donde `m === pm`,
  para que toda variación dé exactamente 0. **Un cero no es «no cambió»: es «no hay con qué»**, y la
  forma honesta es devolver vacío, que es lo que `:125` hace y lo que el literal de `:38` disimula.
- **Hoy** está incompleto. Comparar un día a medias contra un día entero produce una caída que es la
  hora del reloj, no el negocio.

La regla devuelve vacío **antes que cualquier otra cosa**, así que ninguno de los ocho puntos de
llamada puede saltársela.

### A5-16 · Sin denominador no hay variación; con numerador en cero, sí la hay

**Rastro:** `lib/aios/acquisition.js:126`.

```js
if(!prev || !cur) return '';
```

La primera mitad es requisito: si el valor de comparación es cero o falta, no hay variación relativa
que publicar, y la respuesta correcta es **no dibujar nada** en vez de dibujar un infinito o un
100 %. El `isFinite` de `:128` es el segundo cinturón.

**La segunda mitad —`!cur`— es un defecto, y se comprueba comparando con el resto del sistema.**
Mata el delta también cuando el valor ACTUAL es cero y el anterior no: una campaña que pasó de 40
agendados a 0 se dibuja como «sin comparación», que es exactamente el caso donde la flecha era
imprescindible. Executive, que escribe la misma regla, **sólo se guarda del denominador**
(`executive.js:58`: `|| !before`). El requisito es guardarse contra el denominador, no contra el
numerador.

**Estado:** esto va a pasar todo el tiempo al principio. Los campos de comparación por omisión de la
vista traen **0 contactos** medidos con `alta_en_el_crm` (`01-ACQUISITION.md:135`).

### A5-17 · La variación se publica como porcentaje de cambio, con el signo en la flecha

**Rastro:** `lib/aios/acquisition.js:127`, `:132-133`.

`d = (cur − prev) / prev`, redondeado a entero para mostrarlo. El valor se dibuja **siempre en
absoluto** (`Math.abs`) y la dirección vive en la flecha, así que nunca aparece un «▼ −18 %» que se
lea dos veces negativo. Es una diferencia relativa y no absoluta: «▲ 4 %», no «+9 contactos».

Nótese que Executive imprime el mismo dato con otra tipografía —`▲ +12%`, con signo y flecha
(`executive.js:62`)—. Son dos escrituras de la misma regla; la del prototipo de Acquisition es la que
no repite el signo.

### A5-18 · Por debajo de medio punto porcentual la pantalla dice «igual» y no dibuja dirección

**Rastro:** `lib/aios/acquisition.js:130`; los tres estados visuales en `app/aios.css:1135-1137`
(`.dlt.up` verde, `.dlt.down` rojo, `.dlt.flat` sin fondo y al 60 % de opacidad).

```js
if(Math.abs(d) < .005) return ' <span class="dlt flat">=</span>';
```

**El defecto que cierra es el ruido de redondeo de volúmenes enteros.** Con 233 contactos en la
ventana (`01-ACQUISITION.md:162`), un contacto de diferencia es **0,43 %** y sin el umbral se
dibujaría como una tendencia con su flecha y su color.

El umbral se evalúa **antes** de redondear, así que un 0,4 % sale `=` y un 0,6 % sale «▲ 1 %»: el
salto de la etiqueta es más grande que el salto del dato, y eso es deliberado — la alternativa es una
flecha que dice «▲ 0 %».

**Y es la misma regla que Executive, escrita distinto.** `executive.js:59-60` redondea primero y
compara contra cero: `Math.round(d*100) === 0`. Que dos módulos hayan llegado al mismo medio punto
por caminos distintos es lo que convierte al umbral en regla y no en gusto — pero **escrito dos veces
ya diverge**: con 199 contra 200, Acquisition dibuja «▼ 1 %» y Executive dibuja «=» sobre el mismo
dato.

### A5-19 · El color dice si el movimiento es bueno; la flecha dice hacia dónde. Son dos ejes

**Rastro:** `lib/aios/acquisition.js:129` y `:131-132`.

```js
const good = invert ? d < 0 : d > 0;
const cls  = good ? 'up' : 'down';
const ar   = d > 0 ? '▲' : '▼';
```

La flecha sale del signo de `d`; el color sale de `good`. Esa separación es lo que permite dibujar
**«▲ 12 %» en rojo** para un costo por calificado que subió. Sin ella, la única forma de decir que un
costo empeoró es invertir la flecha, y entonces la pantalla dibuja una flecha hacia abajo sobre un
número que subió.

**El parámetro es requisito; que hoy no se ejerza es andamiaje por omisión.** Verificado por `grep`:
las **ocho** llamadas pasan `invert: false`. No hay una sola métrica invertida en pantalla, aunque el
costo por calificado (`:150`, `:201`, `:236`), el CPL y el costo por clic (`:190`, `:225`) son
exactamente el caso para el que se escribió.

**Y una de las ocho es un error de lectura que hay que resolver antes de portar.** La Inversión
(`:146`) pasa `invert:false`, así que **gastar más se dibuja en verde**. Gastar más no es bueno por
sí mismo: es neutro. Y el §18.10 del documento funcional prohíbe explícitamente recomendar escalar
presupuesto en solitario (`01-ACQUISITION.md:32` y regla 10 del §6, `:298`).

### A5-20 · Comparar dos ventanas de distinta duración lleva advertencia, en la misma línea

**Rastro:** `lib/aios/acquisition.js:77`, escrita en la nota de `:81` y dibujada en `:260`.

```js
const warn = db !== da ? ' · ⚠ periodos de distinta duración' : '';
```

**El defecto que cierra:** comparar 21 días contra 30 sin decirlo produce un delta que es en su mayor
parte la diferencia de duración, y se lee como crecimiento. Treinta días contra veintiuno son un
43 % más de ventana; un negocio plano se dibujaría «▲ 43 %».

**La decisión de producto es no bloquear.** Hay casos legítimos —un mes contra el mismo mes del año
anterior, un lanzamiento de diez días contra el trimestre— así que el sistema compara igual y lo dice
en la misma línea donde dice qué está comparando. Un bloqueo mandaría al usuario a rehacer la
comparación afuera, sin aviso ninguno.

Por construcción, **la advertencia sólo puede dispararse en modo «Otro periodo»**: en modo «Periodo
anterior» `db` se copia de `da` (A5-13).

### A5-21 · La nota dice qué se está comparando contra qué

**Rastro:** `lib/aios/acquisition.js:62`, `:66`, `:81`, dibujada en `:260`.

Tres formas: `'histórico completo'`, cadena vacía para los atajos, y para el rango libre
`'21d vs 21d · base 2026-06-10 → 2026-06-30'` más la advertencia de A5-20.

**Requisito: cuando la ventana no es evidente por el control, se escribe.** El «21d vs 21d» es lo que
permite leer un delta sin ir a mirar los campos de fecha.

**Cuatro defectos de este renglón, los cuatro comprobables, y hay que arreglarlos al portar:**

1. **La nota vive dentro de la barra de rango, que está oculta salvo en `custom`.** `:258` hace
   `acqRange.classList.toggle('off', S.period !== 'custom')` y `app/aios.css:1745` define
   `.acq-range.off { display: none }`. El `<span id="acqRangeNote">` está adentro
   (`AcquisitionView.jsx:91`). O sea: **en «Histórico» la nota dice `'histórico completo'` dentro de
   un contenedor invisible.** La única nota que alguien llega a ver es la del rango libre.
2. **Los dos textos escritos a mano se pisan solos.** `:270` escribe
   `'histórico · sin comparación'` (o la etiqueta del calendario) y `:282` escribe lo mismo para
   `p1` — y los dos llaman a `renderAcq()` a continuación, que en `:260` sobrescribe el renglón con
   `w.note`. **Ninguno de los dos textos llega a verse jamás.**
3. **El que sí se vería nombra el período equivocado.** `:282` escribe «histórico» cuando el período
   es `p1`, que es «Hoy».
4. **La atenuación de la barra se aplica a un elemento oculto y no se limpia.** `:280` pone
   `opacity: .45` sobre `.acq-range` cuando el período es `p1` — pero con `p1` la barra ya está en
   `display:none`. Y el manejador del calendario (`:266-272`) no la restaura, así que apretar «Hoy»
   y después elegir un rango deja la barra visible al 45 % de opacidad.

**Y acá se suma una obligación que el prototipo no tiene y la base sí impone:** la regla 6 del §6 de
`01-ACQUISITION.md:290` —«ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del
despliegue, y toda pantalla que la use **tiene que decir desde cuándo mide**»—. Esta nota es el lugar
donde va. Ver A5-24.

### A5-22 · Cuando no hay delta, se dice; el hueco vacío se lee como «no hubo cambio»

**Rastro:** `lib/aios/acquisition.js:234`.

```js
(delta(r.calificados, pr ? pr.calificados : 0, false) || 'sin comparación')
```

Es el **único** de los ocho puntos de llamada que llena el hueco. Los otros siete (`:146-150`, `:179`,
`:188`) dejan el espacio en blanco, y un espacio en blanco donde a veces hay una flecha se lee como
«no hay cambio» cuando significa «no hay con qué comparar».

Es la regla de los dos ceros (`07-REGLAS-TRANSVERSALES.md:110-150`) aplicada a la comparación: «no
hay dato» y «el dato dice cero» mandan a hacer cosas distintas. Y es la regla del silencio con su
matiz (`07:26-46`): el silencio vale cuando es el caso normal; acá el vacío es el caso normal durante
las primeras semanas —comparación contra 0 contactos (`01-ACQUISITION.md:135`)— así que callarse
ocho veces por pantalla no informa, entrena a no mirar.

**El requisito es que la ausencia de delta se declare una vez por cifra comparable, no una sola vez
en una celda de tabla.**

---

## 4 · Lo que el prototipo no tiene y hace falta: la cobertura cambia con la ventana

### A5-23 · Cada período declara la cobertura del dato en ESE período

**Rastro del requisito:** no está en el prototipo. Sale de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:583-587`
(«D · Concluir una tendencia de un sesgo») y de `lib/negocio/periodo.ts:147` y `:158`
(`COLA_DESPROPORCIONADA` y `avisoDeLaCola`).

**El precedente, medido y ya pagado dos veces en Conversation.** La primera: la tasa de cancelación
subía hacia el presente —61,9 % a siete días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— «y
eso se parece a una tendencia. No lo era»: era la proporción creciente de **citas congeladas** en las
ventanas más largas (`07:585`). La segunda, con el mismo mecanismo y peor: el booking rate de Lead
Flow caía **50,0 % → 44,8 % → 34,1 %** al ensanchar la ventana, y la caída entera era el filtro de
citas congeladas; sin él la serie es **50,0 → 50,4 → 48,2**, casi plana
(`07-REGLAS-TRANSVERSALES.md:198-208`).

La diferencia entre las dos, y es la que convierte esto en requisito del control de período
(`07:587`):

> «entonces había que escribir una consulta para producir el sesgo, y acá **había cuatro botones que
> lo producían en un clic**, sobre la cifra que titula la pestaña. […] un control que ofrece ventanas
> donde la cobertura del dato cambia tiene que declarar ese cambio en cada una de ellas, o está
> invitando a esta conclusión.»

La cifra que lo resume: entre «30 días» y «completo», las citas alcanzables son **205 contra 205** y
las publicables **127 contra 127** — el cuarto botón **no agrega ni una cita que el sistema mire**;
agrega 24 que dejó de mirar (`07:261-268`).

**Y en Acquisition el caso propio ya está medido, no hay que inventarlo.** La dimensión de la que
cuelga la pantalla entera —`adId`, sin la cual no hay tabla por anuncio— tiene esta cobertura:

| Ventana | Contactos | Con `adId` | Cobertura |
| --- | --- | --- | --- |
| 14 días (`01-ACQUISITION.md:175`) | 233 | 176 | **75,5 %** |
| Todo lo guardado (`07-REGLAS-TRANSVERSALES.md:557`) | 584 | 213 | **36,5 %** |

**Ensanchar la ventana duplica el volumen y parte al medio la atribución.** El motivo está escrito y
no es un misterio: la migración 048 no rellena hacia atrás, así que 40 de los 584 contactos tienen
`atribucion_primera` en `{}` y son los que el barrido no volvió a tocar (`01-ACQUISITION.md:217`;
`07:330-334`). Cuanto más atrás mira la ventana, mayor es la proporción de
contactos que entraron antes de que existiera la columna.

La consecuencia en pantalla es directa y cara: una tabla por anuncio a 365 días muestra una fila
«(sin anuncio)» que **crece con la ventana por un motivo técnico**, y esa fila ya agenda al 82,5 % en
catorce días (47 de 57, `01-ACQUISITION.md:117` y regla 7, `:292`), la tasa más alta de la tabla. El
botón «Histórico» la engorda sin que cambie nada del negocio.

**La forma del requisito ya existe en el sistema y se puede copiar.** `lib/negocio/periodo.ts:147`
define `COLA_DESPROPORCIONADA = 0.25` y `:158` la función `avisoDeLaCola`, que compara dónde cae la
mitad de las filas dentro del tramo que la fecha promete:

```
proporción = (ahora − mitad) / (ahora − más viejo)
```

Medido sobre producción el 2026-09-16 (`periodo.ts:136-139`): contactos **7 días 0,801 · 14 días
0,701 · 30 días 0,470 · completo 0,049**. Un cuarto separa los dos grupos con margen de diez veces, y
deja el aviso **apagado** en las citas, que hoy no tienen cola — «el guardián está ahí igual, para el
día que la tenga».

Tres propiedades de esa función son parte del requisito:

1. **La proporción la calcula la base y llega ya hecha**, «es la única forma de que el *ahora* sea el
   mismo reloj que escribió las filas» (`periodo.ts:155-156`).
2. **`null` es el caso normal.** Un matiz que aparece en los cuatro períodos se aprende a ignorar, y
   entonces el que importa tampoco se lee (`periodo.ts:152-153`). Es la regla del silencio
   (`07:26-46`).
3. **La mediana y no el promedio**, por lo mismo que las latencias: una sola fila vieja corre el
   promedio y no puede correr la mediana (`periodo.ts:144-146`).

**Lo que Acquisition tiene que declarar, entonces, es dos cosas y no una**: la cola de la cohorte
—igual que Conversation— y, propio de este departamento, **la cobertura de la dimensión en esa
ventana**. Una tabla por anuncio calculada sobre una ventana donde un tercio de los contactos no
trae anuncio no es la misma tabla que una donde falta un cuarto, aunque las dos se dibujen igual.

### A5-24 · La ventana declara desde cuándo mide, y no con `ahora − días`

**Rastro del requisito:** `01-ACQUISITION.md:290` (regla 6 del §6) y `07-REGLAS-TRANSVERSALES.md:295`.

La fecha que se publica es **la fila más vieja que la ventana alcanzó**, no `now() − dias`. Sin eso,
el período largo invita a leer veintidós días de citas como un año: medido, en Appointment Flow
«completo» arranca **exactamente en el mismo minuto** que «30 días» —2026-08-24 13:00— y los dos
botones coinciden en todo lo que se ve (`07:295`).

**Estado en Acquisition:** obligatorio y no escrito. La regla 6 lo dice sin vueltas: «ninguna cohorte
armada con `alta_en_el_crm` tiene historia antes del despliegue, y toda pantalla que la use tiene que
decir desde cuándo mide». El lugar es la nota de A5-21.

**Y `desde` solo no alcanza**, que es el defecto que `COLA_DESPROPORCIONADA` cerró: en Lead Flow la
fila más vieja es del **8 de agosto de 2025** y aun así el 95 % de los 559 contactos es de las
últimas seis semanas (`periodo.ts:114-118`). «El campo que existe para impedir una lectura falsa
producía exactamente esa lectura.» En Acquisition el número es el mismo: **531 de 559 (95,0 %) en los
últimos 45 días**, 28 contactos repartidos en los doce meses anteriores
(`01-ACQUISITION.md:99`).

### A5-25 · «Histórico» no es la historia, y en este módulo ni siquiera es todo lo guardado

**Rastro:** `lib/aios/acquisition.js:38` (`hist:{d:365}`) y `:60-63`.

El período histórico del prototipo son **365 días**. `alta_en_el_crm` llega hasta el **2025-08-08**,
o sea trece meses (`01-ACQUISITION.md:99`): el botón «Histórico» recorta el propio histórico y no lo
dice. El vocabulario real del sistema resolvió esto con `DIAS_DE_TODO = 3650`
(`lib/negocio/periodo.ts:52`) y el motivo escrito de por qué un número grande y no un centinela.

Y el rótulo tiene su propio matiz obligatorio, que en `periodo.ts:91-94` no es opcional: «completo» es
la palabra que más fácil se lee como «toda la historia del negocio», así que el botón viaja con
*«Todo lo que hay guardado, que puede ser mucho menos de lo que parece»*.

---

## 5 · Tabla de corte: qué es requisito y qué es andamiaje en el control de período

| Pieza | `archivo:línea` | Clase | Qué sobrevive |
| --- | --- | --- | --- |
| `PERIODS[x].d` — la duración | `acquisition.js:37-38` | mixto | La duración como parámetro. Los cinco valores, no |
| `PERIODS[x].m` / `.pm` | `acquisition.js:37-38` | **andamiaje** | Nada del dato. Sí la forma: dos ventanas independientes con la misma cadena |
| `pmes:{d:12}` | `acquisition.js:38` | **andamiaje** | Nada: ningún botón lo produce. Código muerto |
| `hist:{m:1.00, pm:1.00}` | `acquisition.js:38` | **andamiaje** | El truco para que el histórico salga plano. El requisito honesto está en `:125` |
| `S.period` / `S.cmp` | `acquisition.js:39` | requisito | Dos ejes de estado, uno para la ventana y otro para contra qué |
| `dayDiff` con su `+ 1` | `acquisition.js:45` | requisito | El cierre inclusivo es la definición de la ventana |
| `seedMod(str)` | `acquisition.js:47-51` | **andamiaje** | Se borra, no se reemplaza. Revela que el resultado tiene que ser determinista y estable |
| `shift` | `acquisition.js:53-57` | mixto | La regla de la ventana contigua. La aritmética de zonas, no |
| `\|\| 21` y `min(365, …)` | `acquisition.js:69`, `:75` | **andamiaje** | Que haya piso y techo. Los valores y el silencio, no |
| `warn` de duraciones | `acquisition.js:77` | requisito | Entero |
| La nota del rango | `acquisition.js:81`, `:260` | requisito | Entero, más el `desde` que la base obliga |
| `delta()` | `acquisition.js:124-134` | requisito | Entero, menos el `!cur` de `:126` |
| `invert` | `acquisition.js:129` | mixto | El parámetro. Que las ocho llamadas lo pasen en `false`, no |
| `val(id)` leyendo el DOM | `acquisition.js:44` | **andamiaje** | Acoplamiento de maqueta. El cálculo se alimenta del estado |
| Las seis llamadas a `build` | `acquisition.js:261-263` | **andamiaje** | Dos ventanas, dos cálculos, un objeto por bloque |
| Fechas por omisión | `AcquisitionView.jsx:68`, `:72`, `:85`, `:89` | **andamiaje** | Que haya un rango por omisión. Estas cuatro fechas, no: traen 3 y 0 contactos |

---

## 6 · Preguntas abiertas

Lo que el prototipo no permite decidir. Va como pregunta y no como requisito, que es la regla.

**P-01 · Cuál es la lista de períodos, y si Acquisition puede tener una distinta del resto.** El
sistema ya decidió cuatro botones —`hoy`, `7d`, `30d`, `completo` (`lib/negocio/periodo.ts:37`)— con
`30d` por omisión (`:109`). Acquisition ofrece tres (`AcquisitionView.jsx:28-38`), declara cinco
(`acquisition.js:37-38`) y agrega un rango libre que el vocabulario del sistema no tiene. O el rango
libre entra en ese vocabulario —y entonces deja de ser una lista cerrada, con los tres agujeros que
`periodo.ts:6-17` enumera— o Acquisition renuncia a él.

**P-02 · Qué control de rango manda.** La píldora del calendario y la barra de dos pares de fechas
conviven, y hoy sólo la segunda mueve las cifras (A5-09, A5-10). Se queda uno de los dos, o el
calendario escribe en los campos de fecha. Y hay un tercer manejador sobre un botón que no existe
(`period-controls.js:33-34`).

**P-03 · En qué zona horaria se cortan los días.** `shift` parsea en UTC, opera en hora local y
serializa en UTC (`acquisition.js:53-57`). El resto del sistema calcula la ventana en la base
(`07:299-303`) y formatea en la zona de la **organización** (`lib/negocio/tiempo.ts:1-24`, regla 24).
Falta decir cuál de las dos manda para el corte de la ventana de Acquisition.

**P-04 · Qué muestra la pantalla mientras no haya período anterior.** La regla de A5-13 es correcta y
la base no la soporta: 95,0 % de los contactos caen en los últimos 45 días
(`01-ACQUISITION.md:99`), y el rango de comparación por omisión trae **0** (`:135`). ¿La pantalla se
comporta como en «Hoy» e «Histórico» —sin ningún delta y diciéndolo— o dibuja deltas contra una
ventana casi vacía?

**P-05 · Cuál es el rango por omisión.** Las cuatro fechas de `AcquisitionView.jsx:68`, `:72`, `:85`,
`:89` caen antes del despliegue y traen 3 y 0 contactos. El rango por omisión tiene que derivarse de
la fecha de corte de los datos, y eso es una decisión: la última ventana válida, los últimos 30 días,
o los días desde que hay datos.

**P-06 · Qué métricas llevan `invert`.** El parámetro existe y las ocho llamadas lo pasan en `false`
(A5-19). Costo por calificado, CPL y costo por clic son los tres casos donde bajar es bueno. Y la
Inversión es el caso que no es ninguno de los dos: subir no es bueno ni malo, y hoy sale en verde.

**P-07 · Si la Inversión lleva delta.** El KPI lo declara (`:146`) y **no puede moverse**: `inv` se
calcula `Math.round(c.invD * w.days)` (`:88`), sin el modificador del período, así que con dos
ventanas de igual duración el actual y el de comparación son el mismo número y `delta` cae en el «=»
plano de `:130`. La única forma de que la Inversión muestre una flecha en todo el prototipo es que
las dos ventanas duren distinto — o sea, **exactamente cuando la advertencia de A5-20 está
encendida**. Medirla de verdad exige la serie diaria de gasto, que no existe: `public.closer_meta_metricas`
tiene la forma pedida y **0 filas**, y es de la plataforma anterior (`01-ACQUISITION.md:252-256`).

**P-08 · Cuál es la ventana canónica de este departamento y qué pasa con el piso.** El resto del
sistema usa 14 días como ventana de cálculo (`indicadoresDeCitas.ts:310`) y piso de 10
(`:300`); la pantalla ofrece 1, 7, 30 y libre. Con el piso de 10, **sólo 3 de los 7 anuncios de la
ventana de 14 días llegan** (109, 44 y 17 contactos) y los otros cuatro tienen 1 o 2
(`01-ACQUISITION.md:288`). Con «Hoy» no llega ninguno. ¿El piso apaga la tasa y deja el conteo —como
hace `atribucionDelLead.ts:179-183`— o apaga la fila? Y el piso se evalúa **en cada ventana**, porque
cada ventana es un denominador nuevo (`07:305`).

**P-09 · Cómo se declara la cobertura, y dónde.** A5-23 fija que hay que declararla; no fija la forma.
Conversation lo resolvió con una frase única que aparece sólo cuando la proporción cruza
`COLA_DESPROPORCIONADA` (`periodo.ts:147-177`). Acquisition tiene **dos** coberturas que se mueven con
la ventana —la cola de la cohorte y el porcentaje de contactos con `adId`— y hace falta decidir si
van en la misma frase, si el aviso de atribución es permanente (el §18.14 pide publicar ese
porcentaje como KPI, `01-ACQUISITION.md:40`) o si se enciende por umbral como el otro.

**P-10 · Si el Plan de acción respeta el período.** El subtítulo dice «Acquisition · tres funnels ·
**periodo seleccionado**» (`lib/aios/acquisition-plan.js:6`) y el cuerpo son nueve frases fijas
(`:7-28`) que no reciben el estado, no leen las cifras de `build()` y no se regeneran al cambiar la
ventana. Quien mueva las fechas ve KPIs distintos y el mismo plan, con el mismo umbral de $110
(`:21`). O el plan se recalcula con la ventana, o el subtítulo deja de prometerlo.

---

## 7 · Lo que hay que arreglar al portar, en una lista

Ninguno de estos es una opinión: los siete se comprueban abriendo el archivo.

| # | Qué está mal | `archivo:línea` | Requisito que lo cierra |
| --- | --- | --- | --- |
| 1 | El segmentado de período no enciende el botón elegido; los otros tres departamentos sí | `acquisition.js:273-284` contra `conversion.js:630-631` | A5-04 |
| 2 | El calendario global guarda `S.from`/`S.to` y nadie los lee; el cálculo sigue leyendo el DOM | `acquisition.js:268` contra `:68` | A5-09 |
| 3 | Un rango invertido se convierte en 1 día o en 21 sin aviso | `acquisition.js:69` | A5-07 |
| 4 | La nota vive dentro de un contenedor oculto salvo en `custom` | `acquisition.js:258` + `app/aios.css:1745` | A5-21 |
| 5 | Los dos textos «sin comparación» se sobrescriben en la misma pasada y nunca se ven | `acquisition.js:270`, `:282` contra `:260` | A5-21, A5-22 |
| 6 | `delta` mata la flecha cuando el valor actual es cero | `acquisition.js:126` | A5-16 |
| 7 | El KPI de Inversión sube en verde y, además, sólo puede moverse cuando las ventanas duran distinto | `acquisition.js:146` + `:88` | A5-19, P-07 |
