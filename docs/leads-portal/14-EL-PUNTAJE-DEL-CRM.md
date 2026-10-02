# Leads Portal · El puntaje del CRM: qué es, de dónde viene y cómo se corta

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional, de lo que ya midieron
> Acquisition y Creative, y de una **medición propia contra producción**, agregada y sin datos
> personales, hecha el **2026-09-27 a las 00:10 UTC**. Cada requisito lleva su `archivo:línea`. Las
> citas a `lib/aios/` y a `components/views/ContactsView.jsx` son exactas al 2026-09-26 y se reapuntan
> en LP-7.
>
> El documento funcional está en `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`, fuera del
> repositorio; las citas `§ N:línea` son a ese archivo.

---

## 0 · En una línea

**Esta pestaña no calcula ningún ICP. Clasifica en cuatro tramos un número que calcula GoHighLevel,
que ya se guarda, y cuyo cero no significa lo que parece.** Todo este archivo es la letra chica de esa
frase.

Un aviso de nombres antes de empezar, antes de que confunda a alguien: en este repositorio «ICP» nombra
también a la pantalla **ICP & Oferta** de Fundaciones, que es un documento sobre el cliente ideal y no
un puntaje por contacto. No se cruzan en ninguna tabla
(`docs/acquisition/04-CALIDAD-DEL-LEAD.md:358-361`).

---

## 1 · Qué es «Puntaje | ICP»

### LP14-01 · Un número del CRM, de 0 a 100, que ya se guarda en `contactos.score`

- **Quién lo calcula:** GoHighLevel, en el campo personalizado **«Puntaje | ICP»**, de tipo
  numérico. Vive en la carpeta «Contact», que es del grupo `calificacion`
  (`lib/ghl/contrato.ts:319-322`). Qué reglas usa el CRM para calcularlo **no está en este
  repositorio**: nosotros recibimos el resultado.
- **Cómo llega:** en la misma respuesta de contactos que ya trae todo lo demás. Se guarda crudo en
  `contactos.campos_del_crm` desde la migración `039`, y desde el 2026-09-21 la sincronización lo
  deriva a `contactos.score` sin ninguna llamada nueva (`lib/negocio/sincronizar.ts:395-403`).
- **Cuál campo es:** está designado a mano por identificador en `CAMPO_DEL_PUNTAJE`
  (`lib/ghl/contrato.ts:305`), porque no se puede deducir: el grupo `calificacion` tiene 17 campos y
  cualquiera de las preguntas del cuestionario daría un «puntaje» plausible y falso
  (`lib/ghl/contrato.ts:288-291`).
- **Qué se acepta:** un entero de 0 a 100; cualquier otra cosa se guarda como `null`
  (`lib/negocio/sincronizar.ts:524-530`), y la columna es `smallint` con `check between 0 and 100`
  desde la migración `055` (`lib/datos/esquema.ts:352`).
- **Qué significa el nulo:** que el CRM no lo trae para ese contacto. **No es un cero**
  (`lib/datos/esquema.ts:355-356`).

Hasta el 2026-09-21 la columna estaba vacía: Acquisition la midió el 2026-09-16 con cero valores y
el dato vivía sólo en el `jsonb` (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:399-401`). Hoy la leen el
Perfil del closer y del setter (`lib/negocio/ficha.ts:493-502`) y la fila de sus listas
(`components/negocio/Fila.jsx:235-237`). **Esta pestaña es el primer lector que lo corta en tramos.**

El documento funcional pide las dos cosas por separado —«ICP score» y «Segmento de ICP»
(`§ 5.3:255-256`)— y esta pestaña entrega las dos: el puntaje tal cual y su tramo.

### LP14-02 · Se pisa en cada corrida, y el de los congelados deja de moverse

**La columna se pisa en cada sincronización**: el CRM recalcula el puntaje cuando el lead responde el
cuestionario (`lib/datos/esquema.ts:340-343`). Dos consecuencias:

1. **El tramo es el de hoy, no el del día del alta.** «30 días · ICP alto» son los que entraron en
   los últimos 30 días **y hoy** tienen 75 o más. El reparto de una misma ventana puede cambiar sin
   que entre nadie. Se declara en la pantalla (`LP06-14`).
2. **Los congelados no se refrescan** —se ven y no cuestan llamadas
   (`lib/negocio/sincronizar.ts:541-547`)—, así que su puntaje es el del último día que tuvieron
   etiqueta de zona. Son 25, y 24 no tienen alta (medido el 2026-09-27), así que casi no entran en
   ninguna ventana
   (`LP06-07`). La ficha muestra `sincronizadoEl` para que se vea.

Una señal chica de que el recálculo ocurre: el 2026-09-21 el reparto era 75 o más 109 y 1-49 157
(`lib/ghl/contrato.ts:278-280`), y el 2026-09-27 es 108 y 158, con el mismo total de 471 con valor.
No se midió si es el mismo contacto el que cambió de tramo.

### LP14-03 · Dos lecturas del mismo campo, y esta pestaña usa una sola

Hay dos caminos para leer el puntaje, y hoy dan lo mismo:

| quién | de dónde | cómo encuentra el campo | qué acepta |
|---|---|---|---|
| sincronización → `contactos.score` | la columna | por identificador (`lib/ghl/contrato.ts:305`) | entero 0-100 (`lib/negocio/sincronizar.ts:524-530`) |
| Creative | el `jsonb` | por nombre, con `CAMPO_DE_ICP` (`lib/negocio/calidadDelCreativo.ts:62`, `:135`) | cualquier número, decimales incluidos (`lib/negocio/calidadDelCreativo.ts:205-209`) |

Coinciden porque la columna, que sólo acepta enteros de 0 a 100 (`lib/negocio/sincronizar.ts:524-530`),
tenía el 2026-09-27 los mismos 471 valores que el `jsonb` tenía el 2026-09-21
(`lib/ghl/contrato.ts:278-279`). Pero divergen en dos casos que no fallan en ninguna parte: si alguien **renombra** el
campo en el CRM, Creative apaga su columna y la de acá sigue; si llega un **decimal**, Creative lo
promedia y acá es `null`.

**Requisito** · Esta pestaña lee **sólo `contactos.score`**, en un único lugar de la consulta de LP-2,
y nunca el `jsonb`.

---

## 2 · La cobertura, medida

### LP14-04 · 471 de 593 con valor, y 47 de ellos en cero

Medido el 2026-09-27, con los tramos de LP14-05:

| | universo (593) | cohorte de 30 días (286) |
|---|---|---|
| **ICP alto** (75-100) | 108 · 18,2 % | 51 · 17,8 % |
| **ICP medio** (50-74) | 158 · 26,6 % | 83 · 29,0 % |
| **ICP bajo** (1-49) | 158 · 26,6 % | 117 · 40,9 % |
| **Sin calificar** | 169 · 28,5 % | 35 · 12,2 % |
| · sin puntaje (`null`) | 122 | como mucho 14 |
| · en 0 | 47 | al menos 21 |

- **Con valor: 471 de 593 (79,4 %)**; con un valor de 1 a 100, 424 (71,5 %).
- La partición de los 35 de 30 días no se midió directamente. Sale de los ceros por semana de alta
  (LP14-09): los 21 ceros de la semana del 31 de agosto caen enteros dentro de la ventana, que empieza
  el 2026-08-28.
- De ahí sale también que **los nulos son sobre todo de contactos de más de 30 días o sin alta**: al
  menos 108 de los 122 están fuera de la cohorte por omisión.
- Entre el 2026-09-21 y el 2026-09-27 el universo pasó de 590 a 593 y los nulos de 119 a 122
  (`lib/datos/esquema.ts:355`), con los mismos 471 con valor. Por la cuenta, lo más probable es que
  los tres contactos nuevos hayan llegado sin puntaje; no se midió contacto por contacto.

La cobertura del grupo `calificacion` **no sirve para validar esto**: 475 contactos tienen alguna
respuesta en ese grupo, pero el grupo incluye la carpeta del propio puntaje
(`lib/ghl/contrato.ts:319-322`), así que la cifra no separa «respondió el cuestionario» de «tiene
puntaje».

---

## 3 · Los tramos

### LP14-05 · Los cortes decididos: 75 y 50, y el cero afuera

**Decidido por el usuario el 2026-09-26:**

| tramo | clave | puntaje |
|---|---|---|
| ICP alto | `alto` | 75 a 100 |
| ICP medio | `medio` | 50 a 74 |
| ICP bajo | `bajo` | 1 a 49 |
| Sin calificar | `sin_calificar` | `null` **o** 0 |

- **Los cortes 75 y 50 son los de la maqueta**: el único lugar del sistema donde un número se volvía
  tramo es el cajón de contactos, `SEG = v => v >= 75 ? 'alto' : v >= 50 ? 'medio' : 'bajo'`
  (`lib/aios/leads-group.js:10@c4cf2a8`). Acquisition señaló que ese corte **no tenía justificación escrita**
  y que adoptarlo por omisión era adoptar el umbral de otra pantalla sin decidirlo
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:475-487`, `:589-592`). Para esta pestaña ahora está
  decidido, con fecha. Para Acquisition la pregunta P-5 sigue abierta: esta decisión no la cierra por
  ella.
- **El corte del cajón (`SEG`) mandaba el cero y el nulo al tramo bajo.** Con `SEG`, `0 >= 50` es
  falso y `null >= 50` también, así que los dos caen en `'bajo'`. La maqueta de Leads Portal, en
  cambio, ya apartaba el nulo en `nc`, «Sin calificar» (`aios-command-center_1.html:4648-4659`, `:4724`),
  que es lo que Acquisition señala en su P-6 (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:596`). La
  decisión conserva eso y le agrega el 0: el nulo y el 0 van a «Sin calificar» (LP14-09).
- **Los bordes que prueba LP-1:** 0, 1, 49, 50, 74, 75 y 100. Un valor fuera de 0-100 no puede llegar:
  lo impiden la sincronización y el `check` de la columna (LP14-01).
- La consulta de la medición usó exactamente este corte, así que las cifras de este archivo son las
  que la pestaña va a mostrar.

### LP14-06 · El tramo sale de un único punto, y se deriva al consultar

- **Una sola función**, `tramoDelPuntaje(score)`, en `lib/negocio/tramosDelIcp.ts`, sin imports, igual
  que `lib/negocio/periodo.ts:25-34`: la usan el navegador y el servidor. La consulta de LP-2 calcula
  el tramo en SQL **con las mismas constantes** `UMBRAL_ALTO` y `UMBRAL_MEDIO`, y el resumen cuenta las
  filas por tramo sin reclasificarlas.
- **El tramo no se guarda en ninguna columna.** La maqueta lo guarda al lado del puntaje y por eso dos
  filas con el mismo 79 caen en tramos distintos (`aios-command-center_1.html:4624` y `:4644`), el defecto
  de `docs/acquisition/04-CALIDAD-DEL-LEAD.md:514-518`.
- **Por qué importa que sea uno solo.** Appointment Flow también consume el segmento
  (`§ 10.5:719-720`) y el documento pide un show rate por ICP (`§ 10.7:757`). El día que otra pantalla
  lo necesite, importa la misma función; y el día que exista un ICP propio
  (`docs/OTROS/futuro/icp-interno-calculado.md`), cambia la fuente del número y no el corte.
- **La clave del cuarto tramo cambia de nombre.** La maqueta lo llama `nc`
  (`aios-command-center_1.html:3052`, `aios-command-center_1.html:4724`) y así lo pintan sus estilos
  (`app/aios.css:2374-2377`). La clave nueva es `sin_calificar`, y nada fuera de la maqueta usa `nc`.

### LP14-07 · Los rótulos: «ICP alto · ICP medio · ICP bajo · Sin calificar»

La maqueta rotula las tarjetas «Calificado alto», «Calificado medio» y **«No calificado»**
(`aios-command-center_1.html:4724`). Se cambian, por dos motivos medidos:

1. **«no calificado» es una etiqueta de descarte del CRM.** Está en `ETIQUETAS_DE_DESCARTE`
   (`lib/ghl/contrato.ts:236`): es la casa diciendo que ese contacto se rechazó. Rotular así a todo el
   tramo bajo afirmaría que los 158 están descartados, y no lo están. Medido el 2026-09-27: **113 de
   ellos no llevan `icp_rechazado`** (LP14-11); el reparto por tramo de las seis etiquetas de
   descarte no se midió, pero con cualquiera de ellas hay 121 contactos en toda la base, así que aun
   si todos cayeran en este tramo quedarían al menos 37 de los 158 sin ninguna.
2. **«Calificado» ya significa cinco cosas distintas en este producto**, una de ellas al revés de las
   otras (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:489-507`). La misma maqueta usa además
   «Calificado» como estado de la persona (`aios-command-center_1.html:4685-4686`), que coincide con la
   etapa del setter «Calificado sin agendar» (`lib/negocio/etapasDelSetter.ts:48`), la quinta
   acepción de esa lista: un motivo más para no usar la palabra en los tramos.

«ICP alto» dice lo único que el tramo sabe: dónde cae el puntaje. No dice si la persona califica.

### LP14-08 · Otros cortes que circulan, y no son éste

| corte | qué es | rastro |
|---|---|---|
| **60** | el techo del rechazo: el 2026-09-16 la casa no rechazaba por ICP a nadie de 60 o más (0 de 67), y el máximo rechazado era 59 | `docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541` |
| **75** | donde saltaba el agendamiento: 75,7 % en el tramo alto contra ~51-53 % en medio y bajo | `docs/acquisition/04-CALIDAD-DEL-LEAD.md:543-555` |
| **80** | una frase inventada del Plan de acción: «Prioriza el contacto inmediato con ICP sobre 80» | `aios-command-center_1.html:5722` |
| ninguno | Creative no corta: promedia | `lib/negocio/calidadDelCreativo.ts:218` |

El de 80 no es un requisito: es una de las frases del Plan de acción, cuyo censo está en
`07-EL-PLAN-DE-ACCION.md`. La frase de al lado —«el ICP alto es el 22 % del volumen pero produce el
61 % de las ventas» (`aios-command-center_1.html:5717`)— tampoco: con cero ventas no se puede calcular.
Lo que sí se puede medir es la primera mitad, y no da 22: **18,2 %** en el universo y **17,8 %** a 30
días.

---

## 4 · Los 47 ceros

### LP14-09 · Son «sin calificar», y se cuentan aparte

**El dato.** 47 de los 471 valores son exactamente 0. Por semana de alta, medido el 2026-09-27:

| semana del | ceros |
|---|---|
| 2026-08-17 | 3 |
| 2026-08-24 | 23 |
| 2026-08-31 | 21 |
| últimos 14 días | **0** |

Es el mismo grupo que la sincronización describe —todos entre el 21 de agosto y el 3 de septiembre,
con menos etiquetas que el resto, ninguno reciente— y **el CRM no dice si calculó cero o si su
proceso no corrió** (`lib/negocio/sincronizar.ts:412-420`). Acquisition lo leyó el 2026-09-16 como
un cambio de régimen: los ceros se terminan de golpe el 3 de septiembre, y el cero de este campo es
«sin puntuar», no «puntuó cero» (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:403-421`).

**La decisión (2026-09-26):** el 0 cuenta como **«Sin calificar»**, igual que el nulo. Contesta para
esta pestaña la pregunta P-6 de Acquisition —¿cuarto estado o fuera del denominador?— eligiendo el
cuarto estado (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:594-597`).

**Lo que la decisión NO hace:**

- **No toca la columna.** El 0 sigue guardado como 0 y el nulo como nulo
  (`lib/negocio/sincronizar.ts:419-420`). La clasificación es nuestra y vive en `tramoDelPuntaje`.
- **No junta los dos ceros en la respuesta.** `sinPuntaje` y `enCero` viajan separados, y suman el
  tramo (`LP02-09`).
- **No borra el número en la ficha.** El plan pide mostrar el 0 como «0, se cuenta como sin
  calificar». Las listas del closer y del setter lo muestran como «0» a secas
  (`components/negocio/Fila.jsx:237`), y no se contradicen: aquéllas muestran el valor del CRM, ésta
  le agrega la clasificación.

### LP14-10 · El guardián: `cerosRecientes`

La regla «0 = sin puntuar» sale de un régimen **medido**, y el día que aparezca un 0 nuevo puede
dejar de ser cierta. El guardián es lo que hace que eso se vea en vez de pasar en silencio.

- **Qué cuenta:** contactos **de la empresa** con `score = 0` y alta en los últimos 14 días, **sin la
  ventana** del período. Medido hoy: **0**.
- **Por qué sin la ventana:** para que el aviso no se encienda con «30 días» y se apague con «7 días»
  para el mismo contacto (`LP02-09`).
- **Qué hace cuando es mayor que cero:** enciende un aviso que dice que apareció un puntaje 0
  reciente, que la pestaña lo sigue contando como «sin calificar», y que un 0 nuevo puede ser un
  puntaje real o el puntuador del CRM parado, porque el CRM no distingue entre los dos.
- **Qué NO hace:** no reclasifica nada. Cambiar la regla es una decisión, no un efecto del aviso.
- **La prueba que lo cubre (LP-2):** un 0 con alta de hoy enciende el guardián con «7 días» y con
  «Completo»; un 0 de hace 20 días no lo enciende con ninguno. La mutación que la pone roja es medirlo
  dentro de la cohorte.

---

## 5 · El puntaje y el rechazo

### LP14-11 · `icp_rechazado` por tramo: el tramo bajo no es el rechazado

Medido el 2026-09-27 sobre los 593, contactos con la etiqueta `icp_rechazado` (comparada en
minúscula, como `ETIQUETAS_DE_DESCARTE`, `lib/ghl/contrato.ts:228-229`):

| tramo | contactos | con `icp_rechazado` | % |
|---|---|---|---|
| ICP alto | 108 | **0** | 0 % |
| ICP medio | 158 | 22 | 13,9 % |
| ICP bajo | 158 | 45 | 28,5 % |
| Sin calificar | 169 | 1 | 0,6 % |
| **todos** | **593** | **68** | |

Y con **cualquiera** de las seis etiquetas de descarte hay 121 contactos.

Tres lecturas, las tres requisitos:

1. **ICP bajo no es «rechazado por ICP».** 113 de los 158 no llevan la etiqueta. El rótulo del tramo
   no puede decir que lo son (LP14-07). Las otras cinco etiquetas de descarte no se partieron por
   tramo.
2. **ICP alto nunca está rechazado por ICP: 0 de 108.** Es coherente con el techo de 59 que Acquisition
   midió el 2026-09-16 (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:538-541`), pero **el techo no se
   volvió a medir**: los 22 rechazados del tramo medio son compatibles con él y no lo prueban. Ver
   `LP14-P02`.
3. **El descarte viaja aparte, como atributo de la fila.** El tramo no absorbe la etiqueta ni la
   etiqueta mueve el tramo: son dos hechos distintos —uno es un número del CRM, el otro es la casa
   decidiendo— y el plan pide `descartado` como campo propio, detectado sin importar mayúsculas.

---

## 6 · La divergencia con Creative

### LP14-12 · Creative promedia el cero; esta pestaña lo aparta

Creative publica un **ICP promedio por pieza** que promedia todos los valores numéricos, **ceros
incluidos** (`lib/negocio/calidadDelCreativo.ts:217-218`), y dibuja al lado el `n` de los que tienen
puntaje, que también los incluye (`components/creative/PanelDeCreative.jsx:374-375`). Esta pestaña no
promedia: clasifica, y el 0 va a «Sin calificar».

El efecto se midió el 2026-09-16: 18 de los 20 ceros de esa ventana caían en un solo anuncio, que
pasaba de **41,5 a 53,0** al sacarlos y cambiaba de lugar en la tabla
(`docs/acquisition/04-CALIDAD-DEL-LEAD.md:437-440`).

**Requisitos:**

- **La divergencia se declara en esta pestaña**, en la nota que explica «Sin calificar»: que el 0
  cuenta como sin calificar acá y que Creative lo promedia.
- **No se arregla Creative desde acá.** Cambiar su promedio es una decisión de Creative (`LP14-P03`).
- **Se va a volver invisible en 30 días, y no por eso deja de existir.** No hay ceros en los últimos
  14 días; cuando la última semana con ceros salga de la ventana —a comienzos de octubre, si no
  aparecen nuevos— el trato del cero dejará de mover las cifras de 30 días de las dos pantallas, y
  las seguirá moviendo en «Completo». La nota se queda igual: la regla es distinta aunque ese día no
  se note.

---

## 7 · Lo que el puntaje no es

### LP14-13 · No es un ICP nuestro, ni fit, ni intent

- La ficha de la maqueta dibuja un «Fit score» y un «Intent score» al lado del ICP
  (`aios-command-center_1.html:4857`). **No existen en la base**: son un hueco declarado, que describe
  `05-LA-FICHA-DEL-LEAD.md`.
- El documento funcional imagina un **«ICP calculado con ese formulario»** —el de la landing— y dice
  que Lead Flow no puede consumirlo antes de que exista (`§ 9.6:583-586`). El puntaje de hoy no es
  ése: lo calcula el CRM con reglas que no están en este repositorio.
- **Un ICP calculado por Comando Central es futuro, y sólo se documenta:**
  `docs/OTROS/futuro/icp-interno-calculado.md` explica qué se quiere, cómo podría quedar y cómo validarlo
  contra los 471 puntajes del CRM. Lo que esta carpeta le deja preparado es LP14-06: el tramo se
  alimenta desde un único punto, así que cambiar la fuente del número no toca la pantalla.

---

## Preguntas abiertas

### LP14-P01 · ¿Qué produce un 0 en el CRM?

La sincronización lo dice sin vueltas: el proveedor no distingue entre «calculó cero» y «el proceso
no corrió» (`lib/negocio/sincronizar.ts:416-417`). La regla de esta pestaña se apoya en que los 47
son del segundo tipo, y lo que la sostiene es la fecha: todos entre el 21 de agosto y el 3 de
septiembre, ninguno después. Quien administra el cálculo en GoHighLevel puede contestarlo de una
vez; hasta entonces, el guardián de LP14-10 es lo único que avisa si deja de ser cierto.

### LP14-P02 · ¿Sigue en pie el techo de 59 del rechazo?

Acquisition midió el 2026-09-16 que nadie de 60 o más estaba rechazado por ICP
(`docs/acquisition/04-CALIDAD-DEL-LEAD.md:538-541`). La medición de hoy sólo dice que en el tramo
alto hay 0 rechazados, no dónde está el máximo. Si el techo sigue en 59, «ICP medio» mezcla dos
poblaciones: la de 50 a 59, que la casa rechaza a veces, y la de 60 a 74, que no rechaza nunca.

### LP14-P03 · ¿Creative adopta la regla del cero?

Si la adopta, su ICP promedio sube en las piezas que tuvieron ceros y las dos pantallas pasan a
contar igual. Si no, la divergencia queda declarada en las dos. La decisión es de Creative, y este
archivo sólo deja escrito que existe.

### LP14-P04 · ¿Los tres tramos separan algo que importe?

El corte 75/50 se adopta sin haberlo validado contra ventas, porque no hay ninguna. Lo único
disponible es el agendamiento, y el 2026-09-16 decía que **medio y bajo eran indistinguibles** (50,8 %
contra 53,1 %) y sólo el alto se separaba (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:552-555`). Si eso
se sostiene sobre la cohorte de esta pestaña, las tarjetas «ICP medio» e «ICP bajo» van a mostrar dos
números que no dicen nada distinto. Medirlo es la pregunta `LP02-P01`.
