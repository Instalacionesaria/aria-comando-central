# El «Plan de acción»: cuatro frases, ninguna sostenible hoy, y el botón se borra

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional y de una **medición
> propia contra producción**, agregada y sin un solo dato personal, hecha el **2026-09-27 a las
> 00:10 UTC** (el 26 a las 19:10 en Lima). Cada afirmación lleva su `archivo:línea`. Lo que no se
> pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** LP-6 borra el bloque
> `aios-command-center_1.html:5710-5730`: esas citas fallan al resolverse y las ve
> `pruebas/codigo/101-las-citas-de-los-documentos.test.ts`. Las de
> `components/views/ContactsView.jsx` son peores: el archivo se reescribe con una cabecera larga, así
> que **siguen resolviendo y muestran otra cosa**. LP-7 reapunta las dos clases al prototipo,
> `aios-command-center_1.html:5710-5730` y `:3034`, que no cambia.

`aios-command-center_1.html:3034` dibuja un botón `◈ Plan de acción` con `id="lpPlanBtn"`.
A diferencia del de Sales, que no tenía ni un oyente (`docs/sales/07-EL-PLAN-DE-ACCION.md:15-18`),
**éste está cableado**: `aios-command-center_1.html:5711-5712` lo busca y le cuelga un clic que escribe
cuatro frases en el modal compartido `#recoModal` y lo abre.

Y es **el último plan de acción cableado de la aplicación**. Acquisition, Creative, Conversion y
Sales ya borraron el suyo, cada uno con su motivo escrito en la cabecera de la vista nueva
(`components/views/AcquisitionView.jsx:21`, `components/views/CreativeView.jsx:19`,
`components/views/ConversionView.jsx:39`, `components/views/SalesView.jsx:31`). Con LP-6 no queda
ninguno.

---

## 1 · El censo

### LP07-01 · Cuatro frases escritas a mano, en un bloque de veintiún líneas que no lee ningún dato

**Rastro** · `aios-command-center_1.html:5710-5730`, portado literal de
`aios-command-center_1.html:5710-5730`.

El manejador no recibe nada: no lee `LEADS`, ni el período, ni el tramo elegido. Escribe un
subtítulo fijo, `'Leads Portal · calidad de la base'` (`aios-command-center_1.html:5713`), una cadena
de HTML fija en `#recoBody` (`:5714-5727`), y enciende el velo y el modal (`:5728-5729`).

| # | grupo | frase | línea |
|---|---|---|---|
| 1 | «Lo que dice la data» | «El **ICP alto** es el 22% del volumen pero produce el 61% de las ventas.» | `aios-command-center_1.html:5717` |
| 2 | «Lo que dice la data» | «Los contactos que vieron más del 60% del VSL califican **4 de cada 5** veces.» | `aios-command-center_1.html:5718` |
| 3 | «Haz más de esto» | «Prioriza el contacto inmediato con ICP sobre 80: son los que cierran.» | `aios-command-center_1.html:5722` |
| 4 | «Para otras áreas» | «Qué campañas traen ICP alto se decide en **Acquisition**.» | `aios-command-center_1.html:5726` |

**Estado** · **Ninguna de las cuatro sale de un cálculo, y ninguna se puede sostener hoy.** Las
fichas de abajo dicen por qué, una por una.

Los tres encabezados de grupo son tres de los cuatro que usaba el plan de Acquisition —falta
«Ajusta o pausa esto»— (`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:400`). Son vocabulario,
no contenido.

**Comparado con las otras pantallas:**

| pantalla | frases detrás del botón | con fuente | dónde está contado |
|---|---|---|---|
| Creative | 12 | 2 | `docs/sales/07-EL-PLAN-DE-ACCION.md:22-26` |
| Conversion | 47 | 0 | ídem |
| Sales | 0 | — | ídem |
| Acquisition | 9 | una publicable hoy y otra en parte | `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:486-489` |
| **Leads Portal** | **4** | **0** | esta ficha |

El más chico de los cuatro que tenían contenido. Y dos de sus cuatro frases **contradicen los datos
inventados de su propia maqueta** (ver `LP07-02` y `LP07-04`): ni siquiera eran coherentes con el
decorado.

---

## 2 · Frase por frase

### LP07-02 · «El ICP alto es el 22 % del volumen pero produce el 61 % de las ventas»

**Qué afirma** · Dos porciones del mismo tramo: la de contactos y la de ventas.

**La mitad del volumen se puede calcular hoy, y no da 22 %.** Medido el 2026-09-27:

| población | ICP alto | total | porción |
|---|---|---|---|
| el universo entero | 108 | 593 | **18,2 %** |
| el universo, sin «Sin calificar» | 108 | 424 | **25,5 %** |
| la cohorte de 30 días | 51 | 286 | **17,8 %** |
| la cohorte de 30 días, sin «Sin calificar» | 51 | 251 | **20,3 %** |

Ninguna da 22, y la tabla muestra lo que la frase esconde: **el denominador decide la cifra**. Con o
sin los 169 «Sin calificar» —122 sin puntaje y 47 en cero— la misma pregunta pasa de 18 a 25 %. Una
porción sin su denominador escrito al lado no es un requisito (`LP03-09` fija cuál es el de la
tarjeta).

**La mitad de las ventas no se puede calcular.** Cero personas con una venta registrada y cero montos
cargados en toda la base (medición del 2026-09-27). El 61 % de cero no existe, y Sales ya lo declara
como hueco con su fecha (`lib/negocio/huecosDeSales.ts:49-56`).

**Y contradice a su propia maqueta dos veces, y a la de Executive una:**

- las tarjetas de la maqueta dibujan el tramo alto como **5 de 15, un 33 %**
  (`aios-command-center_1.html:4709-4715`), con cinco `seg:'alto'` en `:4591`, `:4608`, `:4612`, `:4628` y `:4644`;
- las tres ventas inventadas son las tres de tramo alto (`:4592`, `:4609`, `:4645`): **100 %**, no 61;
- la ficha de Leads Portal en Executive dice «312 contactos · 78 de ICP alto», que es **25 %**
  (`lib/aios/executive.js:199`), y en la línea siguiente **repite la frase del 22 y el 61**
  (`:200`). Ver `LP08-13`: esa ficha no se dibuja en ninguna parte.

Tres cifras distintas para la misma porción —22, 25 y 33— entre las dos maquetas, y ninguna es la
medida.

### LP07-03 · «Los que vieron más del 60 % del VSL califican 4 de cada 5 veces»

**Qué afirma** · Que ver el VSL predice la calificación.

**Le faltan las dos mitades.**

1. **El VSL por persona no reporta.** El campo existe —`VSL % máximo visto`— y su último dato es del
   **2026-08-30** (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:18`); y además estaba
   roto desde antes (`:22-23`): el único valor que llegó a guardar es `0` (el detalle está en
   `docs/estado actual/06-INTEGRACIONES-GHL.md`, § «Y el hallazgo que contradice lo que se creía»).
   La ficha del lead lo declara como hueco (`LP05-10`).
2. **«Califican» no está definido.** Hay cinco definiciones de «calificado» en el producto y ninguna
   coincide con otra (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:495-501`). Esta pestaña, por decisión
   del 2026-09-26, no usa la palabra: dice «ICP alto», porque «no calificado» es una etiqueta de
   descarte del CRM (`lib/ghl/contrato.ts:236`).

**La trampa, que hay que dejar escrita porque el dato existe y tienta:** el campo «Video Pre-Call»
sí tiene porcentajes por persona —medido el 2026-09-27: `76–100%` 12, `51–75%` 4, `40-60%` 2,
entre otros—. **Es otro video**: el del precall, que es posterior al agendamiento
(`C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md:583-588`), no el VSL de la landing; y sus
tramos ni siquiera son coherentes: `40-60%` y `51–75%` se superponen, así que «más del 60 %» no se
puede contar con ellos. Usarlo acá daría una frase plausible y falsa, que es el
mismo modo de fallo que Sales dejó escrito para los campos de facturación
(`docs/sales/00-MAPA.md:149-152`). El precall tiene su lugar en la ficha, rotulado como lo que es
(`LP05-11`).

**Y no es original de esta pantalla.** Copia un cajón de Conversion del prototipo —«Vieron más del 60%
del VSL · Califican 4 de cada 5» (`aios-command-center_1.html:4457-4458`)— que en el port vivía en una
rama inalcanzable (`docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:88-92`) y se borró con Conversion
en el commit `0add4cc`.

### LP07-04 · «Prioriza el contacto inmediato con ICP sobre 80: son los que cierran»

**Qué afirma** · Un umbral (80) y una causalidad (los de arriba cierran).

- **80 no es ningún corte del sistema.** Los tramos son 75 y 50 (`lib/aios/leads-group.js:10`, y la
  decisión del 2026-09-26). La frase mete un cuarto umbral que nadie decidió; `14-EL-PUNTAJE-DEL-CRM.md`
  lo registra entre los cortes que circulan y lo descarta como requisito.
- **«Son los que cierran» necesita ventas**, y hay cero.
- **Su propia maqueta la desmiente**: una de las tres ventas inventadas es de un puntaje 79
  (`aios-command-center_1.html:4644-4645`), debajo de 80.
- **La mitad accionable —a quién llamar primero— no la decide esta pestaña.** Es una regla de orden
  de trabajo, y la maqueta de Sales inventó otra del mismo tipo, «ICP alto asignado», que tampoco
  existe (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:48`). Dos maquetas, dos reglas de prioridad
  por puntaje, ninguna en el sistema.

### LP07-05 · «Qué campañas traen ICP alto se decide en Acquisition»

**Qué afirma** · No es una cifra: es una **jurisdicción**. Deriva una pregunta a otra pantalla.

Es la única de las cuatro con la forma correcta —el grupo «Para otras áreas» es el que
Acquisition rescató entero (`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:491-495`)— y **aun así
no se sostiene, porque el destino no publica la respuesta**:

- el panel de Acquisition publica el costo por anuncio y el monitor de atribución, y nada más
  (`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:16-18`); no tiene una columna de ICP;
- la única pantalla que hoy cruza el puntaje con el origen es **Creative**, que publica el ICP
  promedio por creativo y etapa (`components/creative/PanelDeCreative.jsx:374`), y con una regla de
  ceros distinta de la de esta pestaña (`LP08-08`).

**Y forma un circuito con el plan de Acquisition.** El ítem 9 del plan que Acquisition borró decía
«La afinidad ICP de cada campaña se cruza en **Leads Portal**»
(`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:489`). Cada pantalla le mandaba la pregunta a la
otra y ninguna la contestaba. `A6-21` leyó ese par como un contrato
(`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:497-500`); **esta carpeta lo lee distinto**: un
contrato en el que las dos partes delegan en la otra es una referencia circular. Y una tercera voz
—la ficha de Executive: «Entrego a Acquisition qué campañas traen el ICP que cierra»
(`lib/aios/executive.js:201`)— agrega una condición, «que cierra», que necesita ventas. Ver
`LP08-P03`.

---

## 3 · Por qué ninguna se sostiene, junto

### LP07-06 · Lo que le falta a cada una, y qué la traería de vuelta

| # | le falta | medido el 2026-09-27 | vuelve si… |
|---|---|---|---|
| 1 | ventas registradas; y un denominador escrito | 0 ventas; la porción de volumen va de 17,8 a 25,5 % según la población | alguien registra ventas, y la porción declara sobre quién se calcula |
| 2 | el VSL por persona; una definición de «califica» | el medidor no reporta desde el 2026-08-30 | se arregla el medidor y alguien define el término — y ese alguien no es esta pestaña |
| 3 | ventas; un umbral decidido | 0 ventas; 80 no es corte de nada | hay ventas y alguien decide que 80 significa algo |
| 4 | un destino que publique la respuesta | Acquisition no publica ICP; Creative sí, por creativo | se decide quién publica «ICP por campaña» (`LP08-P03`) |

**Tres de las cuatro dependen de la venta**, que es exactamente el hueco que Sales declara con fecha
(`lib/negocio/huecosDeSales.ts:49-62`). Publicarlas sería contradecir a la pantalla de al lado con
números inventados.

---

## 4 · El botón se borra

### LP07-07 · Se borra el botón, el bloque que lo cablea y la mitad derecha del encabezado

**Rastro** · El botón en `aios-command-center_1.html:3034`, dentro de `.ch-r`
(`:3033-3039`); el bloque en `aios-command-center_1.html:5710-5730`.

**Requisito** · En LP-6 se van los dos, **en el mismo commit**: borrar sólo el bloque deja un botón
sin oyente —el defecto que Sales tuvo (`docs/sales/07-EL-PLAN-DE-ACCION.md:11-18`)—, y borrar sólo el
botón deja un oyente con una guarda `if(lpPlan)` (`aios-command-center_1.html:5712`) que lo apaga para
siempre y se lee como rama defensiva, que es lo que el propio archivo ya denunció dos veces
(`lib/aios/period-controls.js:15-27`, `:33-39`).

Con él se va la mitad derecha entera del encabezado, igual que en las otras cuatro pantallas: el
segmentado de período y la píldora «Personalizado» también están muertos (`LP10-06`, `LP06-02`), y
el período vive dentro del panel.

**El requisito de fondo no se borra: se posterga, por escrito.** Ver `LP07-09`.

### LP07-08 · Con el botón se va el único que abre `#recoModal`

**Rastro** · `aios-command-center_1.html:5728-5729` es **el único sitio de toda la aplicación** que
enciende `#recoModal`. Medido el 2026-09-26 sobre `components/` y `lib/`: fuera de ese bloque, el
modal sólo aparece en su declaración (`components/Overlays.jsx:98-119`) y en los cierres del armazón
(`lib/aios/shell.js:200-202`, `:273-274`).

**Estado** · Después de LP-6 el modal queda **inerte**: en el árbol, con su título «Recomendaciones y
conclusiones», y sin nadie que lo abra. Sus dos cierres —el velo y la cruz— y el Escape siguen
registrados en el armazón, y no se pueden sacar sin tocar
`pruebas/codigo/156-cierre-de-los-overlays.test.ts:40`, que los exige.

Hay precedente de qué hacer con un nodo inerte: `components/Overlays.jsx:41-54` cuenta por qué se
borró `#resModal` —*«dos modales de resultado en el árbol, uno inerte y otro real»*—. Pero acá no hay
otro real, y el plan de LP-6 no lo toca. Queda como deuda con nombre. Ver `LP07-P01`.

Y un defecto menor que se va solo: el bloque enciende el modal **sin** poner `aria-hidden="false"`,
así que quedaba abierto y declarado invisible para un lector de pantalla
(`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:531-539`).

### LP07-09 · El requisito que queda: si el plan vuelve, cada frase trae su cifra, su población y su destinatario

**Qué sobrevive** · La forma, no el contenido: los grupos con semántica propia y, sobre todo, el de
derivación, que es el que Acquisition rescató entero (`A6-21`).

**Lo que hoy tendría fuente** —y no es una recomendación de esta pestaña—:

- **los 47 puntajes en cero**, todos de contactos que entraron en las semanas del 17, 24 y 31 de
  agosto (3, 23 y 21), y **ninguno en los últimos 14 días**. Es un hecho con destinatario —quien
  opera el cálculo del puntaje en el CRM— y la pestaña ya lo vigila como aviso (`cerosRecientes`,
  `LP02-09`), no como frase;
- **las personas de ICP alto de la ventana que no tienen cita**: se puede calcular con la cohorte de
  LP-2, pero **no se midió** en LP-0, así que acá no lleva cifra;
- **las 145 personas con una cita pasada, no cancelada, sin la asistencia registrada**: es real y
  está medido, pero es el hueco de Sales (`S1-07`), no un hallazgo de esta pestaña. Se consume, no se
  reclama.

**Requisito** · Si algún día vuelve un plan de acción a esta pestaña:

1. cada frase se calcula con la misma consulta que dibuja las tarjetas, no se escribe;
2. cada porción lleva su denominador y su población escritos al lado (`LP07-02`);
3. **ninguna habla de ventas, cierre o revenue mientras `lib/negocio/huecosDeSales.ts` declare la
   venta como hueco**;
4. una derivación nombra a una pantalla que **publica** la respuesta (`LP07-05`).

**Y antes que eso hay una pregunta sin contestar**: si esta pestaña tiene plan de acción en absoluto.
Ver `LP07-P02`.

---

## 5 · Correcciones al inventario

### LP07-10 · Once citas en siete documentos apuntan a este bloque en una línea que no es

Medido el 2026-09-26 con el historial del archivo. Son dos causas distintas y conviene no mezclarlas.

**Una deriva de una línea.** El archivo tuvo un solo cambio de longitud: en el commit `0c93853`
(2026-09-19) el comentario de `lib/aios/period-controls.js:15-27` reemplazó doce líneas de código por
trece y corrió una línea todo lo que viene después. El otro comentario, el de `:33-39`, reemplazó
siete líneas por siete en `be5ba97` y no corrió nada. Las citas escritas antes del 19 quedaron
apuntando **dentro del rango y a otra cosa**, que es la clase de cita rota que ninguna prueba atrapa:

| documento | cita | lo que quiso nombrar | dónde está hoy |
|---|---|---|---|
| `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:32` | línea 56 | la frase 4 | `aios-command-center_1.html:5726` |
| `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:500` | línea 56 | la frase 4 | `aios-command-center_1.html:5726` |
| `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:538` | líneas 58-59 | el encendido del modal | `aios-command-center_1.html:5728-5729` |
| `docs/acquisition/02-METRICAS.md:871` | línea 56 | la frase 4 | `aios-command-center_1.html:5726` |
| `docs/estado actual/01-ACQUISITION.md:73`, `:151` y `:326` | línea 56, las tres | la frase 4 | `aios-command-center_1.html:5726` |
| `docs/creative/04-LA-FICHA-DEL-CREATIVO.md:163` | línea 58 | el encendido del modal | `aios-command-center_1.html:5728-5729` |
| `docs/creative/09-LO-QUE-NO-ES-UN-REQUISITO.md:187` | línea 58 | el encendido del modal | `aios-command-center_1.html:5728-5729` |

**Dos que nacieron desplazadas.** No son deriva: cuando se escribieron ya apuntaban a otra línea.

| documento | cita | lo que quiso nombrar | al escribirse | dónde está hoy |
|---|---|---|---|---|
| `docs/sales/07-EL-PLAN-DE-ACCION.md:18` | línea 38 | la búsqueda de `lpPlanBtn` | 2026-09-20 (`8a0368a`), con `lpPlanBtn` ya en la 42; la 38 caía dentro del comentario de `lib/aios/period-controls.js:33-39`, y en ninguna versión del archivo fue la búsqueda | `aios-command-center_1.html:5711` |
| `docs/estado actual/05-SALES.md:39` | línea 40 | el enganche de `lpPlanBtn` | 2026-09-14 (`93a1341`), con `lpPlanBtn` en la 41: citaba la cabecera del bloque | `aios-command-center_1.html:5711` |

Ninguno de esos archivos se toca desde acá; queda anotado para que LP-7, que reapunta las citas de
esta carpeta, sepa que las de al lado también apuntan mal. La de `docs/sales/` es la única dentro de
una carpeta que audita `pruebas/codigo/101-las-citas-de-los-documentos.test.ts:37`, y pasa: está en
rango.

---

## Preguntas abiertas

### LP07-P01 · ¿Qué se hace con `#recoModal` cuando nadie lo abre?

Tres salidas, y ninguna es de esta carpeta:

1. **se deja inerte**, que es lo que hace el plan de LP-6 y lo que esta ficha anota como deuda;
2. **se borra con sus cierres**, por el precedente de `#resModal` (`components/Overlays.jsx:41-54`),
   cambiando `pruebas/codigo/156-cierre-de-los-overlays.test.ts:40` en el mismo commit;
3. **se reusa**: si Executive se reconstruye con un plan propio, es el contenedor natural.

El riesgo de la primera es el de siempre: un nodo que nadie abre se lee como algo vivo.

### LP07-P02 · ¿Leads Portal tiene plan de acción?

El documento funcional **no nombra a Leads Portal ni una vez**, y tampoco usa «plan de acción»: cero
coincidencias en sus 1.650 líneas (`C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`,
medido el 2026-09-26). Lo más cerca que llega es el § 5.3, «Perfil resumido del lead»
(`C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md:240-265`), que es una ficha, no un
departamento que recomienda. Y la pestaña está en el grupo AIOS, no en Inteligencia
(`lib/autorizacion/secciones.ts:219-227`).

Las cinco pantallas de Inteligencia son departamentos con dominio, y un plan de acción es lo que un
departamento le dice a otro. **Un portal de contactos puede no tener ninguno**, y entonces el
requisito de `LP07-09` no se posterga: desaparece. Es una decisión de producto, y esta carpeta sólo
deja escrito que el documento no la toma.
