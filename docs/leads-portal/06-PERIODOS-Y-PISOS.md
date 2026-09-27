# Leads Portal · Las ventanas, la cohorte y el piso

> Requisitos derivados de la maqueta de Leads Portal y de una **medición propia contra producción**,
> agregada y sin datos personales, hecha el **2026-09-27 a las 00:10 UTC**. Cada requisito lleva su
> `archivo:línea`. Las citas a `components/views/ContactsView.jsx` y a `lib/aios/leads-portal.js` son
> exactas al 2026-09-26 y se reapuntan en LP-7, cuando la maqueta se va.

---

## 1 · El vocabulario de ventanas

### LP06-01 · Las cuatro ventanas del sistema, y ninguna más

`lib/negocio/periodo.ts:83-96` — las mismas cuatro que ya usan las pantallas de Inteligencia:

| clave | etiqueta | días | matiz |
|---|---|---|---|
| `hoy` | Hoy | 1 | «Las últimas 24 horas, no el día del calendario.» |
| `7d` | 7 días | 7 | — |
| `30d` | 30 días | 30 | — |
| `completo` | Completo | 3650 | «Todo lo que hay guardado, que puede ser mucho menos de lo que parece.» |

- **Por omisión, 30 días**: `PERIODO_POR_OMISION = '30d'` (`lib/negocio/periodo.ts:109`).
- **Lo que no está en la lista se rechaza.** `periodoDe()` devuelve `null` ante una clave desconocida
  y la ruta lo convierte en un 400; sólo la ausencia real del parámetro cae en el valor por omisión
  (`lib/negocio/periodo.ts:178-193`). El plan lo exige para `GET /api/leads-portal?periodo=`.
- **El módulo no importa nada, a propósito** (`lib/negocio/periodo.ts:25-34`): lo usan la ruta para
  validar y el panel del navegador para dibujar los botones. Los botones de esta pestaña se dibujan
  mapeando `PERIODOS`, no con una lista escrita a mano.

### LP06-02 · El segmentado de la maqueta: una clave que no existe, otro botón encendido y un calendario que no filtra

`components/views/ContactsView.jsx:25-43` dibuja tres botones y una píldora. Los cuatro controles
están mal de una manera distinta:

| control | qué hace hoy | rastro |
|---|---|---|
| «7 días» | es el que abre encendido, y no es el valor por omisión del sistema | `components/views/ContactsView.jsx:29` |
| «30 días» | manda **`data-p="mes"`**, que no está en `PERIODOS`: `periodoDe('mes')` lo rechazaría | `components/views/ContactsView.jsx:32-34` |
| los tres botones | su oyente sólo mueve la clase `on`; ninguna cifra cambia | `lib/aios/leads-portal.js:313-317` |
| «Personalizado» | abre el calendario, escribe la fecha en la píldora, **apaga los tres botones**, y no filtra nada | `components/views/ContactsView.jsx:36-43`; `lib/aios/datepicker.js:116-117` |

El último es el peor de los cuatro: la pantalla pasa a afirmar un rango elegido mientras sigue
mostrando lo mismo. El calendario busca quién atiende la clave `lp` (`lib/aios/datepicker.js:129`) y
la lista de oyentes nace vacía (`:133`); nadie registra uno.

Es el mismo defecto de la clave `mes` que Sales documentó en su propio segmentado
(`docs/sales/06-PERIODOS-Y-PISOS.md:25-32`).

**Requisito** · Los cuatro botones de `PERIODOS` y nada más. **«Personalizado» se va**: un rango
libre no es ninguna de las cuatro ventanas, y la lista es cerrada (`07-REGLAS-TRANSVERSALES.md:251-253`);
agregar una ventana toca a las cinco pantallas que la comparten
(`docs/conversion/05-PERIODOS-Y-PISOS.md:166-167`).

Con esta píldora se va la única visible que abre el calendario de `lib/aios/datepicker.js` —la de
Executive está `hidden` (`components/views/ExecutiveView.jsx:62`)—, y con el botón del Plan de acción
se va el único que abre `#recoModal` (`lib/aios/period-controls.js:59-60`). Los dos quedan sin quién
los abra: el plan lo anota como deuda y no se borran en esta etapa.

### LP06-03 · El botón encendido es el que contestó el servidor

`components/creative/PanelDeCreative.jsx:89-90` resuelve el mismo problema con
`valor={pantalla?.periodo ?? periodo}`, y la regla está escrita en `07-REGLAS-TRANSVERSALES.md:293`.
La respuesta de esta pestaña trae el `periodo` que atendió, y el botón encendido sale de ahí, no del
estado local. **Defecto que evita:** una petición rechazada, o una lenta que llega después de otra,
deja el botón diciendo una ventana y las cifras de otra.

---

## 2 · La cohorte

### LP06-04 · La cohorte se arma con el alta en el CRM, en ventana móvil

**Fórmula** · `alta_en_el_crm >= now() - make_interval(days => N)`, con `N` el `dias` del período.

Tres decisiones dentro de esa línea, cada una con su defecto conocido:

1. **`alta_en_el_crm` y no `creado_el`.** `creado_el` es cuándo nuestro barrido vio al contacto, y
   239 contactos comparten la marca de la carga inicial: en cuanto una ventana la tocaba, la cohorte
   saltaba de golpe sin que entrara nadie (`07-REGLAS-TRANSVERSALES.md:234-239`). El plan exige una
   prueba con su mutación para esto en LP-2.
2. **No el territorio.** El territorio es consecuencia de agendar: filtrar por él da una tasa que es
   una tautología (`07-REGLAS-TRANSVERSALES.md:216-222`). Por eso la cohorte incluye a los tres
   territorios.
3. **Móvil, no anclada al día.** Es la regla general del sistema y la que usa la cadena de Sales,
   con el motivo escrito: no toca ninguna columna `date` (`lib/negocio/cadenaDeCierre.ts:46-55`,
   `:168`). Esta pestaña tampoco: contactos, citas y resultados son `timestamptz`.

> **Y por eso sus «30 días» no son los de Creative.** Creative ancla la ventana al día
> (`lib/negocio/calidadDelCreativo.ts:228`, `current_date - make_interval(days => dias - 1)`) porque
> cruza con el gasto, que sí es una fecha. Las dos ventanas difieren en hasta un día de altas en el
> borde de atrás. **No se comparan los conteos por tramo de esta pestaña con los de Creative
> esperando igualdad**: la comparación que tiene que dar exacta es con la cadena de Sales, que usa el
> mismo predicado (`LP06-13`).

### LP06-05 · Treinta días por omisión, y hoy es la única ventana con volumen que no es «Completo»

Medido el 2026-09-27:

| ventana | cohorte |
|---|---|
| `hoy` | **0** |
| `7d` | **3** |
| `30d` | **286** |
| `completo` | 569 |

El motivo del valor por omisión ya está escrito: treinta es el único de los cuatro que da
denominador a las tasas con piso (`lib/negocio/periodo.ts:101-104`). En esta pestaña se ve más que en
ninguna: **la maqueta abría en «7 días»** (`components/views/ContactsView.jsx:29`), que hoy dibujaría
tres personas repartidas en cuatro tarjetas.

Lo que se paga es sabido y también está escrito: más allá de catorce días crece la proporción de
citas congeladas (`lib/negocio/periodo.ts:106-107`). Ver `LP06-12`.

### LP06-06 · Los extremos de la cohorte viajan, y «Completo» no es historia

La respuesta trae en `cohorte`:

| campo | qué es | medido el 2026-09-27 |
|---|---|---|
| `desde` | el alta **más vieja que la ventana alcanzó**, no el borde de la ventana | — |
| `hasta` | el alta más nueva de la cohorte | — |
| `ultimaAlta` | el alta más nueva **de toda la empresa**, sin ventana | 2026-09-25 14:53 UTC |
| `sinAlta` | los contactos que no entran en ninguna ventana | 24 |

- `desde` y `hasta` son `min` y `max` sobre las filas alcanzadas, como en la cadena de Sales
  (`lib/negocio/cadenaDeCierre.ts:232-235`): con los bordes de la ventana, la pantalla diría «últimos
  30 días» sobre una base que arranca hace tres.
- `ultimaAlta` es el que contesta, con la cohorte vacía, **cuándo entró el último**. Sin él, «Hoy: 0»
  no dice si es una mañana tranquila o dos semanas sin tráfico (`LP06-08`).
- **«Completo» lleva el aviso de la cola.** Su `desde` puede ser un caso suelto con el grueso de la
  cohorte semanas después: medido el 2026-09-16 en los contactos, la mitad de «completo» había
  entrado en el último 4,9 % del tramo que va del más viejo a hoy (`lib/negocio/periodo.ts:132-137`).
  La frase ya existe —`avisoDeLaCola`, `lib/negocio/periodo.ts:158-176`— y Lead Flow la usa sobre la
  misma tabla (`lib/negocio/indicadoresDelLead.ts:297-303`). **Se reutiliza, no se reescribe.**

### LP06-07 · Los que no tienen alta no entran en ninguna ventana, y se dice

Medido el 2026-09-27: **24 de 593 contactos no tienen `alta_en_el_crm`, y los 24 son congelados.** No entran en
ninguna cohorte de ninguna pantalla, ni con «Completo» (`lib/negocio/cadenaDeCierre.ts:128-134`).

**Requisito** · `sinAlta` se mide sobre la empresa entera y sin ventana, viaja siempre, y cuando es
mayor que cero el aviso lo dice. La ficha métrica es `LP02-10` en `02-METRICAS.md`.

Una consecuencia chica y concreta: de los 25 congelados, **sólo uno** tiene alta, así que a los
efectos de esta pestaña «de cualquier territorio» significa casi siempre closer o setter.

---

## 3 · La caída del 14 de septiembre

### LP06-08 · Es real, y la pantalla tiene que poder decir que no hay tráfico

**Medido.** El censo semanal de altas del 2026-09-26: **117, 90, 53, 175 y 89** en las semanas del 10
de agosto al 7 de septiembre, y **4 y 3** en las del 14 y el 21 de septiembre. La cohorte de 7 días,
el 2026-09-27, es de 3.

**No es un defecto de ingesta.** El usuario lo confirmó el 2026-09-26: las campañas se pausaron.
Conversion ya lo había medido desde el gasto —la pauta en $0,00 desde el 2026-09-14, con el barrido
corriendo— (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:178-191`). Y la medición de
hoy lo repite: la última alta es del 2026-09-25 y el `sincronizado_el` más nuevo es del 2026-09-27 a
las 00:00 UTC, diez minutos antes de medir. El barrido pasa; no entra gente.

**Requisito** · La pantalla distingue tres situaciones que, dibujadas como rayas, se ven iguales:

| situación | cómo se sabe | qué dice |
|---|---|---|
| **no hay tráfico** | cohorte 0, `frescura` al día, `ultimaAlta` vieja | que no entró nadie y cuándo entró el último |
| **el barrido no pasa** | `frescuraDe('contactos')` en `nunca`, `atrasada` o `fallando` | el aviso de frescura, que manda a mirar otra cosa |
| **falta el dato** | la cohorte tiene gente y el campo no | el hueco, con su medición |

La frescura ya distingue sus estados y los dice en un campo hermano, no dentro del dato
(`lib/negocio/frescura.ts:26-42`, `:50-58`). La frase de la cohorte vacía ya existe en
`lib/negocio/cadenaDeCierre.ts:308-313`. Es el requisito que Conversion escribió para su pantalla
(`docs/conversion/05-PERIODOS-Y-PISOS.md:99-106`), llevado a ésta.

### LP06-09 · Y la ventana por omisión se va a vaciar sola

Cuenta hecha con el censo semanal de arriba: la ventana de 30 días tiene volumen hoy **porque todavía
contiene las dos últimas semanas antes de la pausa** (175 y 89 altas). La semana del 31 de agosto sale
de la ventana entre el 30 de septiembre y el 6 de octubre, y la del 7 de septiembre entre el 7 y el 13
de octubre. Si las campañas siguen pausadas, **desde mediados de octubre «30 días» va a tener menos de
diez contactos** y el cierre va a salir en `null` por el piso (y la porción del total también, si
`LP06-P01` se decide por el piso).

Eso no es un defecto que haya que arreglar: es la ventana móvil haciendo su trabajo. **Lo que sí es
requisito** es que la pantalla lo diga con la frase de «no hay tráfico» y con `ultimaAlta`, en vez de
dibujar cuatro tarjetas con rayas sin explicar por qué. Ver `LP06-P02`.

---

## 4 · El piso

### LP06-10 · `PISO_DE_UNA_TASA`, sobre el denominador de cada tasa

`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`), con el motivo en `:300-307`:
*«con diez, un registro mueve diez puntos, que sigue siendo mucho y ya no es absurdo»*. Y **es del
denominador**, no del total.

De las cifras de `02-METRICAS.md`, sólo una es una tasa con piso decidido:

| cifra | denominador | ¿lleva piso? |
|---|---|---|
| Cierre (`LP02-07`) | contactos del tramo | **sí** |
| Porción del total (`LP02-02`) | contactos de la cohorte | **sin decidir** — `LP06-P01` |
| Contactos, agendados, asistieron, vendidos, sin calificar | — | no: son conteos |
| Monto reportado (`LP02-08`) | — | no: es una suma, y viaja con su conteo de vendidos |

Aplicado a los denominadores medidos el 2026-09-27:

| tramo | `hoy` | `7d` | `30d` | `completo` |
|---|---|---|---|---|
| ICP alto | 0 | ≤ 3 | **51** | — |
| ICP medio | 0 | ≤ 3 | **83** | — |
| ICP bajo | 0 | ≤ 3 | **117** | — |
| Sin calificar | 0 | ≤ 3 | **35** | — |
| Todos | **0** | **3** | **286** | **569** |

A 30 días los cinco pasan el piso; a 7 días no pasa ninguno; con «Hoy» no hay de quién decirlo. La
medición no partió «Completo» por tramo con alta; el universo entero de 593, sí, y está en
`14-EL-PUNTAJE-DEL-CRM.md`.

**Hoy el piso no se ve**, porque el cierre ya sale `null` por `sin_ventas_registradas` antes de
llegar a él (`LP02-07`). Se escribe igual y se prueba igual —el plan tiene el caso en LP-2—, porque
el día que alguien registre la primera venta, el piso es lo único que impide publicar un «100 %»
sobre un tramo de tres personas.

### LP06-11 · Bajo el piso hay conteos, no silencio

La tarjeta bajo el piso **no se borra ni se vacía**: dibuja sus conteos y deja la tasa en raya, con el
motivo. Borrar la tarjeta de un tramo es afirmar que ese tramo no existe
(`docs/sales/06-PERIODOS-Y-PISOS.md:96-97`), y apartar no es esconder
(`07-REGLAS-TRANSVERSALES.md:106`).

---

## 5 · Las citas congeladas y la ventana

### LP06-12 · Cuanto más larga la ventana, más personas con citas que ya no se refrescan

La proporción de citas congeladas crece con la ventana: medido por Creative el 2026-09-15, 7,0 % a
catorce días y 27,2 % a treinta (`lib/negocio/calidadDelCreativo.ts:30-35`). Y Lead Flow midió el
efecto por persona el 2026-09-16: 0 personas con sólo citas congeladas a 7 y 14 días, 22 a 30 y 79 en
«completo» (`lib/negocio/indicadoresDelLead.ts:223-227`).

Como «agendó» no cuenta la cita congelada (`LP02-03`), **cambiar de ventana cambia cuántos de los que
agendaron quedan fuera de la cifra**. Por eso `solo_congeladas` viaja en el resumen y en cada fila, y
el aviso lo dice cuando es mayor que cero. La medición de LP-0 no lo tiene; se mide antes de LP-2
con la consulta de `LP09-P01` y se verifica en LP-4 contra la cadena de Sales.

---

## 6 · Una sola ventana para todo

### LP06-13 · Tarjetas, rejilla y cadena de Sales reciben el mismo `dias`

Es la regla de Sales (`docs/sales/06-PERIODOS-Y-PISOS.md:127-135`) aplicada acá, y tiene tres partes:

1. **La rejilla recibe la misma cohorte que las tarjetas.** Las filas que viajan son tantas como la
   cifra de «Todos», salvo que la cohorte pase el tope de 5000 del plan, y entonces viaja `truncado` y
   el aviso lo dice. Medido el 2026-09-27: a 30 días son 286 filas y como mucho 569 (los 593
   menos los 24 sin alta, que no entran en ninguna ventana), así que hoy el tope no muerde. Cuántas
   se dibujan de a una vez es de `04-LA-REJILLA-Y-LOS-FILTROS.md`.
2. **La cadena de Sales se consulta con el mismo `dias`, en el mismo `conOrganizacion`.** Es lo que
   permite la prueba de coherencia de LP-4: el total y los agendados tienen que coincidir.
3. **Ningún módulo se queda con su valor por omisión.** `cadenaDeCierre` tiene 14 días por omisión
   (`lib/negocio/cadenaDeCierre.ts:165`, `DIAS_DE_LA_TASA`); si la ruta se olvidara de pasarle el
   período, la pantalla dibujaría dos ventanas con un solo botón encendido.

### LP06-14 · El tramo es el de hoy, no el del día del alta

La cohorte se fija por el alta, pero el tramo sale del puntaje **que el contacto tiene ahora**: la
columna se pisa en cada corrida, porque el CRM lo recalcula cuando el lead responde
(`lib/datos/esquema.ts:340-343`). O sea que «30 días · ICP alto» son **los que entraron en los últimos
30 días y hoy tienen 75 o más**. La misma ventana puede dar otro reparto mañana sin que entre nadie.
Se declara en la pantalla y está desarrollado en `14-EL-PUNTAJE-DEL-CRM.md`.

---

## Preguntas abiertas

### LP06-P01 · ¿La porción del total lleva piso?

La cadena de Sales no se lo pone: su `porcionDeLaCohorte` es `null` sólo con la cohorte vacía
(`lib/negocio/cadenaDeCierre.ts:272-274`). Seguir ese precedente es coherente con Sales, y con la
cohorte de 7 días de hoy —3 personas— publica tercios que se mueven 33 puntos con la próxima alta. La
alternativa es tratar la porción como una tasa más: `null` bajo 10 contactos en la cohorte, con los
conteos a la vista. Las dos son defendibles; el plan no decide.

### LP06-P02 · ¿Qué dibuja la pestaña cuando «30 días» se vacíe?

Si la pauta no vuelve, desde mediados de octubre la ventana por omisión tiene menos de diez
contactos (`LP06-09`). Las opciones son dejar que el aviso de «no hay tráfico» haga el trabajo, o
abrir en otra ventana cuando la por omisión quede bajo el piso. La segunda cambia el valor por omisión
según los datos: el mismo clic abriría ventanas distintas en días distintos sin que nada lo explique,
cuando hoy el valor por omisión es uno fijo, `30d` (`lib/negocio/periodo.ts:109`). Conversion dejó abierta la pregunta hermana —una quinta ventana «desde el
corte»— sin decidirla (`docs/conversion/05-PERIODOS-Y-PISOS.md:160-167`).
