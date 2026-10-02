# La rejilla y los filtros

> Requisitos derivados de la maqueta de Leads Portal y de la **medición LP-0 contra producción,
> hecha el 2026-09-27 a las 00:10 UTC** (el 26 por la tarde en Lima), sólo con consultas agregadas.
> Cada requisito lleva el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho como
> pregunta abierta, no como requisito.
>
> **Las citas a `lib/aios/leads-portal.js` son a la maqueta tal como está hoy.** En LP-6 ese archivo
> se borra, y en LP-7 estas citas se reapuntan. También las de `components/views/ContactsView.jsx`,
> que se reescribe en LP-6, y las de `lib/aios/leads-group.js`, que LP-6 edita. Esas dos no fallan al
> resolverse: siguen dentro de rango y muestran otra cosa, así que la prueba 101 no las atrapa y LP-7
> las reapunta a mano.

Debajo de las cinco tarjetas, la maqueta dibuja una barra de controles y una rejilla de tarjetas, una
por contacto:

| pieza | marcado | lógica |
|---|---|---|
| buscador | `aios-command-center_1.html:3045-3048` | `aios-command-center_1.html:4899-4901` |
| filtro de tramo «ICP» | `aios-command-center_1.html:3049-3056` | `aios-command-center_1.html:4880-4888` |
| filtro de «Etapa» | `aios-command-center_1.html:3058-3064` | `aios-command-center_1.html:4889-4893` |
| contador | `aios-command-center_1.html:3065` | `aios-command-center_1.html:4777-4778` |
| rejilla | `aios-command-center_1.html:3068` | `aios-command-center_1.html:4748-4783` |

El filtrado de la maqueta está en `visibles()` (`aios-command-center_1.html:4690-4701`) más el filtro de
tramo de `aios-command-center_1.html:4750`.

---

## 0 · Lo que está mal en la maqueta

Nada de esto es un requisito. Son las afirmaciones falsas o los riesgos que la pantalla nueva no
puede heredar.

1. **El buscador mira un campo que no anuncia.** El texto de ayuda dice «nombre, campaña o creative»
   (`aios-command-center_1.html:3047`), pero el filtro también busca en la fuente
   (`aios-command-center_1.html:4696`).
2. **Sólo pasa a minúsculas; no quita tildes** (`aios-command-center_1.html:4900`). Buscar «martin» no
   encuentra a «Martín».
3. **El contador muestra la clave interna.** Escribe `ICP ${lpSeg}` (`aios-command-center_1.html:4778`),
   y para «Sin calificar» eso sale «ICP nc».
4. **Cada tarjeta abre la ficha por su posición en un arreglo** (`aios-command-center_1.html:4758` y
   `aios-command-center_1.html:4780-4782`), no por un identificador.
5. **El nombre se mete en el HTML sin escapar.** La rejilla entera se arma con una plantilla de texto
   asignada a `innerHTML` (`aios-command-center_1.html:4757-4775`), y el nombre va crudo
   (`aios-command-center_1.html:4761`). Con nombres inventados no pasa nada. Con 593 nombres que
   escribió cualquiera en un formulario, un nombre con marcado se ejecutaría en el navegador de quien
   mira.
6. **El paso apagado se lee como «no».** El progreso «Agendó › Asistió › Vendió» tiene dos estados,
   encendido o apagado (`aios-command-center_1.html:4751-4755`). Ver `LP04-08`.
7. **El bloque de dinero inventa un proceso.** Dice «facturado», «en proceso», «califica al agendar»
   o «sin cita» (`aios-command-center_1.html:4771-4772`).
8. **Se dibuja todo de una vez**, sin tope (`aios-command-center_1.html:4757`).

---

## 1 · La lista

### LP04-01 · La rejilla muestra la cohorte del período, una tarjeta por persona

- **Rastro:** la maqueta dibuja siempre los mismos 15 (`aios-command-center_1.html:4590-4664`).
- **Qué pide:** la rejilla muestra la misma cohorte que las tarjetas de arriba (`LP03-01`): los
  contactos con alta en la ventana. Una tarjeta por persona, aunque tenga varias citas.
- **Viaja entera:** la cohorte llega completa al navegador y los filtros corren ahí (LP-2). Tiene un
  tope de 5000 filas con la marca `truncado`.
- **Medido:** **286** a 30 días y **569** en «completo».

### LP04-02 · Se ordena por alta, la más reciente primero, con un desempate estable

- **Rastro:** la maqueta usa el orden del arreglo inventado.
- **Qué pide:** orden por `alta_en_el_crm` descendente y, a igualdad, por identificador. Hace falta
  un orden estable por dos motivos: «Mostrar más» tiene que agregar las 60 siguientes y no repetir
  ni saltear a nadie, y la recarga del reloj no puede reordenar lo que ya está a la vista. Es una
  decisión de esta carpeta; ver `LP04-P01`.

### LP04-03 · Se dibujan de a 60, con «Mostrar más»

- **Rastro:** la maqueta dibuja la lista entera (`aios-command-center_1.html:4757`).
- **Qué pide:**
  - se dibujan las primeras 60 tarjetas y el botón «Mostrar más» agrega 60 más;
  - **los filtros y la búsqueda corren sobre la cohorte entera, no sobre las 60 dibujadas.** Un
    filtro que mirara sólo lo dibujado diría «ninguno» de alguien que está en la tarjeta 61;
  - cambiar un filtro o la búsqueda vuelve a las primeras 60.
- El contador dice cuándo se ve menos de lo que hay. Es la regla de A7-29
  (`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:456-461`). Ver `LP04-15`.

### LP04-04 · Si la lista llegó recortada, el buscador y el contador lo dicen

- **Rastro:** `buscarLead.ts` ya resolvió el mismo caso. Filtrar en la pantalla sólo es honesto si
  la pantalla tiene todo, porque si no *«un "ningún contacto coincide" pasaría a significar "no está
  entre los primeros 5.000"»* (`lib/negocio/buscarLead.ts:16-24`).
- **Qué pide:** con `truncado`, el contador y el estado vacío de la búsqueda dicen que la lista está
  incompleta. Hoy no se alcanza, porque la empresa tiene 593 contactos, pero la guarda va igual.

---

## 2 · Qué lleva cada tarjeta

### LP04-05 · Nombre, alta, «campaña · creativo», puntaje con su tramo, estado y progreso

- **Rastro:** la tarjeta de la maqueta (`aios-command-center_1.html:4758-4774`): nombre, «campaña ·
  creative», el puntaje con su tramo, el bloque de dinero y el progreso.
- **Qué pide, pieza por pieza:**
  - **Nombre**, como texto. React lo escapa; nunca pasa por `innerHTML`.
  - **La fecha de alta**, corta. La maqueta no la muestra en la tarjeta, pero la lista se ordena por
    ella (`LP04-02`), y un orden sin su clave a la vista no se puede leer.
  - **«campaña · creativo»**, del **primer toque**: `atribucion_primera ->> 'campaign'` y
    `->> 'utmContent'`. «Creativo» es `utmContent` porque es la llave de pieza que usa Creative: la
    llave es el nombre del creativo (`lib/negocio/calidadDelCreativo.ts:21`), y se arma sobre
    `utmContent` (`lib/negocio/calidadDelCreativo.ts:198`). En la tarjeta se muestra el texto tal como llega; la
    normalización de Creative es para agrupar, no para mostrar. Una mitad vacía se dibuja «—».
    **Nunca se inventa un origen**, como el «Orgánico» de la maqueta (`aios-command-center_1.html:4632`).
  - **El puntaje y su tramo.** El número, **0 incluido**, más el rótulo de `TRAMOS`: «ICP alto»,
    «ICP medio», «ICP bajo» o «Sin calificar». Sin puntaje se dibuja «—» con «Sin calificar». Un 0 se
    dibuja «0» con «Sin calificar», igual que en la ficha. Reemplaza al «SIN CALIF.» y a las
    mayúsculas de `aios-command-center_1.html:4764-4767`.
  - **Dos marcas, sólo cuando corresponden:**
    - **descartado**: tiene alguna etiqueta de `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`),
      comparada en minúscula (`lib/ghl/contrato.ts:228-229`). **Medido: 121 personas**;
    - **congelado**: el contacto ya no se refresca. Son **25** en el universo.
- **Medido, de dónde sale cada mitad del origen**, sobre los 593: `campaign` está en **271** (45,7 %)
  y `utmContent` en **505** (85,2 %). La mitad de las tarjetas va a decir «— · creativo», y eso es el
  dato.

### LP04-06 · Sin teléfono, sin correo, sin atribución cruda y sin campos del CRM

- **Rastro:** la maqueta no los dibuja en la tarjeta, pero los tiene en memoria para cada contacto
  (el primero, en `aios-command-center_1.html:4594`). Decisión del usuario del 2026-09-26: teléfono y
  correo, sólo en la ficha.
- **Qué pide:** la lista **ni siquiera los manda al navegador**. Las claves de cada fila son
  exactamente una lista blanca, y la prueba de LP-2 lo vigila: id, nombre, alta, campaña, creativo,
  puntaje, tramo, territorio, descartado, cita, asistencia, plantón, vendió y monto. La prueba de la
  ruta (LP-4) comprueba que la lista no trae teléfono, correo, atribución ni `campos_del_crm`. La
  atribución no se muestra cruda porque *«`referrer` y `url` son direcciones completas y pueden llevar
  el identificador de una persona adentro»* (`lib/datos/esquema.ts:423-424`).
- **Tampoco viaja el texto del último mensaje** (`lib/datos/esquema.ts:381`).

### LP04-07 · El bloque de dinero dice «reportado», y sin venta dice el estado de la cita

- **Rastro:** `aios-command-center_1.html:4769-4773`.
- **Qué pide:**
  - **con venta y monto**: el monto y la palabra «reportado». No «facturado»: el sistema no tiene
    ninguna integración de cobros (`lib/negocio/cadenaDeCierre.ts:353-358`);
  - **con venta sin monto**: «venta sin monto»;
  - **sin venta**: el estado de la cita, que es un hecho: «agendó», «sólo citas congeladas» o «sin
    cita». «En proceso» afirma que algo sigue en curso, y puede ser una cita cancelada hace un mes.
    «Califica al agendar» afirma de dónde sale el puntaje, y no es de ahí.
- **Medido:** **0** montos cargados. Hoy ninguna tarjeta muestra dinero.

### LP04-08 · El progreso «Agendó › Asistió › Vendió» tiene tres estados por paso, no dos

- **Rastro:** `aios-command-center_1.html:4751-4755`: cada paso está encendido o apagado.
- **Por qué dos no alcanzan:** **145** personas tienen una cita pasada, no cancelada y sin la
  asistencia registrada (un techo: se midió sin el filtro de alcanzable, ver `LP02-04`; con el
  predicado exacto son **77**). `asistio`
  es verdadero en **0** y falso en **0**. Con dos estados, esas personas se leerían como «no asistió»
  cuando lo cierto es que nadie lo cargó.
- **Qué pide:**
  - **Agendó:** sí, «sólo citas congeladas» o no. El sí es `tieneCitaAlcanzable`
    (`lib/negocio/citasAlcanzables.ts:135`); el segundo es `cita = 'solo_congeladas'` de `LP02-03`,
    el mismo estado que el bloque de dinero ya distingue (`LP04-07`). Una persona cuya única cita
    está congelada tuvo cita, pero no cuenta en «Agendados» (`LP04-13`) porque esa cita dejó de
    refrescarse. El paso lo dice, en vez de apagarse como si nunca hubiera tenido cita.
  - **Asistió:** sí, no, sin registrar o **no aplica**. Son los cuatro valores de la asistencia de
    `LP02-04` (LP-2). «Sin registrar» exige al menos una cita **cerrable**: alcanzable, no cancelada y
    ya empezada. «No aplica» es el `null`: sin cita, sólo futuras, sólo canceladas o sólo congeladas.
    Así una persona con una sola cita futura no sale «sin registrar». **El plantón del calendario no
    entra en este paso**: va como una marca aparte, «plantón según el calendario». Son dos fuentes de
    la misma pregunta y no se suman (`lib/negocio/citasAlcanzables.ts:105-109`). **Medido: 15
    plantones.**
  - **Vendió:** sí, o «sin venta registrada». Nunca «no compró».

### LP04-09 · Cada tarjeta es un botón que abre la ficha por su id

- **Rastro:** hoy es un `div` con `onclick` que abre por posición
  (`aios-command-center_1.html:4758` y `aios-command-center_1.html:4780-4782`).
- **Qué pide:** un control de verdad, alcanzable con el teclado, que abre la ficha con el UUID de la
  persona (`05-LA-FICHA-DEL-LEAD.md`). **Ningún enlace a GoHighLevel en la tarjeta.** El panel de grupo
  ponía uno en cada fila (`lib/aios/leads-group.js:51-56@c4cf2a8`), y la decisión del 2026-09-26 los saca.

---

## 3 · La búsqueda

### LP04-10 · Busca por nombre, campaña y creativo, sin tildes y sin mayúsculas

- **Rastro:** el texto de ayuda (`aios-command-center_1.html:3047`) y el filtro que busca también
  en la fuente y no quita tildes (`aios-command-center_1.html:4696` y `aios-command-center_1.html:4900`).
- **Qué pide:**
  - **tres campos:** nombre, `campaign` y `utmContent`;
  - **la fuente no**, por el motivo que `buscarLead.ts` ya escribió: la mitad de la cartera comparte
    fuente, así que escribir «meta» devolvería casi todo y parecería que filtró
    (`lib/negocio/buscarLead.ts:32-36`);
  - **el teléfono y el correo tampoco**, porque no están en la lista (`LP04-06`). Por eso se reutiliza
    `normalizar` (`lib/negocio/buscarLead.ts:43-60`) y **no** `coincide`, que sí mira el correo y el
    teléfono (`lib/negocio/buscarLead.ts:86-103`);
  - sin tildes y sin mayúsculas: «martin» encuentra a «Martín». Es la prueba de LP-5;
  - **cero llamadas**: se filtra en el navegador sobre la cohorte que ya llegó, por el mismo
    razonamiento de `lib/negocio/buscarLead.ts:4-14`.
- El texto de ayuda dice «creativo», no «creative».

### LP04-11 · La búsqueda, el tramo y la etapa se combinan

- **Rastro:** la maqueta los aplica uno detrás de otro (`aios-command-center_1.html:4690-4701` y
  `aios-command-center_1.html:4750`), o sea, como intersección.
- **Qué pide:** lo mismo. Una persona aparece sólo si cumple los tres.

---

## 4 · El filtro de tramo

### LP04-12 · Todos · Sin calificar · ICP alto · ICP medio · ICP bajo, con el mismo estado que las tarjetas

- **Rastro:** los cinco botones de `aios-command-center_1.html:3050-3056`, que hoy dicen «Alto»,
  «Medio» y «Bajo», y su sincronización con las tarjetas (`aios-command-center_1.html:4880-4888`).
- **Qué pide:**
  - los rótulos salen de `TRAMOS` (`LP03-06`);
  - **«Sin calificar» incluye a los que valen 0.** Es la otra mitad de la prueba de LP-5;
  - encender un tramo acá enciende su tarjeta arriba, y al revés. Es un solo estado (`LP03-15`).
- **Preseleccionar el tramo desde otra pantalla no es parte de esta etapa.** El panel de grupo lo
  hacía apretando el botón por su selector, y Acquisition lo describe como requisito en A7-31
  (`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:476-483`). LP-6 sacó ese clic; en su lugar quedó el
  comentario que dice por qué (`lib/aios/leads-group.js:65-68@c4cf2a8`). Si vuelve, entra por la puerta que defina `08-LO-QUE-ENTREGA-Y-RECIBE.md`, no por un
  selector del DOM.

---

## 5 · El filtro de etapa

### LP04-13 · Todas · Agendados · Asistieron · Vendidos, con las definiciones del resto del sistema

- **Rastro:** `aios-command-center_1.html:3059-3064`; en la maqueta, cada etapa es una marca
  independiente (`aios-command-center_1.html:4692-4694`).
- **Qué pide:** tres predicados independientes, no una cadena:
  - **Agendados** = `tieneCitaAlcanzable`. Una persona que sólo tiene citas canceladas **entra**.
    Medido: **146** personas tienen sólo citas canceladas, contando todas sus citas, alcanzables o no;
  - **Asistieron** = asistencia registrada como «asistió». **Medido: 0**;
  - **Vendidos** = tiene una venta registrada (`LP03-11`). **Medido: 0**.
- Los conteos de cada etapa por tramo vienen en la respuesta (LP-4). La pantalla no los recalcula
  con otra definición.

### LP04-14 · Una etapa vacía dice por qué está vacía

- **Rastro:** la maqueta tiene un solo texto para cualquier vacío: «Ningún contacto con estos
  filtros.» (`aios-command-center_1.html:4775`).
- **Qué pide:** hay que distinguir «no existe el dato» de «ninguno coincide»:
  - **Asistieron** vacío porque nadie registró asistencia. Lo dice con la medición del momento, y
    agrega que el calendario marcó plantones aparte;
  - **Vendidos** vacío porque no hay ninguna venta registrada. Es el mismo hueco que Sales declara
    (`lib/negocio/huecosDeSales.ts:49-56`);
  - una búsqueda o un tramo sin coincidencias mantiene el texto genérico.
  Hoy los dos primeros casos son los de cualquier período.

---

## 6 · El contador

### LP04-15 · «N de M contactos», con los filtros por su nombre y el recorte cuando lo hay

- **Rastro:** `aios-command-center_1.html:4777-4778`.
- **Qué pide:**
  - **N** es lo que queda después de los filtros y **M** la cohorte del período;
  - con más de 60, agrega «mostrando X»;
  - nombra el tramo y la etapa activos por su rótulo, nunca por su clave;
  - con `truncado`, dice que la lista está incompleta (`LP04-04`).

---

## 7 · Lo que aguanta una recarga, y el teléfono

### LP04-16 · El reloj recarga los datos sin tocar la búsqueda, los filtros ni lo ya mostrado

- **Rastro:** plan de LP-5: `usarReloj(…, CADENCIA.inteligencia)`, y una recarga no vacía la pantalla.
- **Qué pide:** la recarga periódica conserva el texto buscado, el tramo, la etapa y cuántas
  tarjetas se estaban mostrando. Cambiar de período también conserva los filtros, pero vuelve a las
  primeras 60.

### LP04-17 · A 375 px la rejilla es una columna y los controles no desbordan

- **Rastro:** la barra de la maqueta es una sola fila con dos segmentados y el buscador
  (`aios-command-center_1.html:3044-3066`).
- **Qué pide:** a 375 px la rejilla pasa a una columna y la barra se acomoda en varias líneas, sin
  scroll horizontal. Las reglas quedan acotadas a `#v-contacts` (LP-5).

---

## 8 · Preguntas abiertas

### LP04-P01 · ¿El orden es por alta o por puntaje?

`LP04-02` ordena por alta, la más reciente primero, porque es la pregunta de todos los días: «¿quién
entró?». La otra lectura razonable es por puntaje, de mayor a menor: «¿a quién llamo primero?». Con
las campañas pausadas desde mediados de septiembre (cohorte de 7 días: **3**), el orden por alta
muestra primero a gente de hace semanas. Es igual de cierto, pero menos útil para priorizar.

### LP04-P02 · ¿Hace falta un filtro para ocultar a los descartados?

**121** personas tienen alguna etiqueta de descarte. Hoy se ven en la rejilla con su marca
(`LP04-05`) y cuentan en su tramo. Un filtro «ocultar descartados» es barato, porque el campo ya
viaja. Pero cambia lo que significa el contador: «N de M» dejaría de ser sobre la cohorte entera.

### LP04-P03 · ¿La tarjeta distingue a quien sólo tiene citas canceladas?

**146** de las **292** personas con alguna cita sólo tienen citas canceladas (medido sobre todas sus
citas). Con la definición del sistema cuentan como «agendó», y el paso «Agendó» les sale encendido.
Una marca «canceló» sería más fiel a lo que pasó. Pero exige que la fila traiga un estado de cita más
fino que el de LP-2, que hoy sólo separa «alcanzable» de «sólo congeladas». Es la misma pregunta que
`LP02-P03`, y se contesta una sola vez.
