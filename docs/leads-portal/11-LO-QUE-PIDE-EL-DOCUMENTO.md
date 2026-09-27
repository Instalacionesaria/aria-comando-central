# Lo que pide el documento funcional: un perfil de dieciocho renglones, y ninguna pestaña

> Barrido de `CC_Arquitectura_Funcional.md` (**1.650 líneas**, verificado con `wc -l`), hecho el
> **2026-09-26**. El documento **no vive en el repositorio**: está en
> `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`. Las citas `§ N:NNN` de esta carpeta son
> a ese archivo.
>
> Las coberturas son de la medición de LP-0 contra producción, **2026-09-27 00:10 UTC**, con sus
> consultas en `09-DE-DONDE-VIENE-CADA-DATO.md`. Donde una cifra no se midió, se dice.

---

## 1 · Lo primero: el documento no tiene una pestaña de leads

### LP11-01 · Tiene una entidad y un perfil, no una pantalla

La palabra «portal» aparece **cero veces** en las 1.650 líneas. «Leads Portal» es un nombre del
prototipo (`components/views/ContactsView.jsx:11`), no del documento.

Lo que el documento sí tiene son dos cosas, y las dos son de la **capa de datos compartida** (§ 5), no
de un departamento:

- una entidad, **«Lead Profile»**, primera de la lista del `§ 5.1:205`;
- un perfil, **«Perfil resumido del lead»**, que es el `§ 5.3:240-265` entero.

**Requisito que sale de ahí:** la pestaña es **la ventana de una persona a la capa compartida**, no
un departamento de Inteligencia con su propia lectura. No interpreta ni recomienda —no tiene a quién
recomendarle, el documento no le da voz—; muestra el perfil y dice qué partes de él no existen. Por
eso el botón «Plan de acción» (`components/views/ContactsView.jsx:18-23`) no tiene detrás ningún
requisito del documento: ver `07-EL-PLAN-DE-ACCION.md`.

---

## 2 · El § 5.3, renglón por renglón

### LP11-02 · Los dieciocho renglones, con qué se cumplen hoy

`§ 5.3:242` abre con la regla: *«El perfil del lead puede mostrar datos resumidos, mientras los
eventos históricos permanecen en tablas separadas.»* Y `:244` dice *«Puede incluir»*, no «debe»: el
documento da un techo, no un piso.

| línea | el documento pide | con qué se cumple | cobertura (2026-09-27) | ¿se cumple? |
|---|---|---|---|---|
| `:246` | `lead_id` | `contactos.id` | 593 de 593 | **sí** |
| `:247` | `ghl_contact_id` | `contactos.ghl_contact_id`, `not null` (`db/migraciones/011_negocio_closer_setter.sql:67`) | 593 de 593 | **en el dato sí; no se dibuja** (`LP11-03`) |
| `:248` | Datos básicos | nombre, teléfono, correo, país | nombre 593 · país 569 · teléfono y correo **sin medir en LP-0**; el plan anota 558 y 590 del 2026-09-26, sin consulta versionada (`09 § LP09-P05`) | **sí**, con lo que dice `LP11-04` |
| `:249` | Fuente de origen | `atribucion_primera->>'sessionSource'` | 552 | **sí** |
| `:250` | Campaña, ad set, anuncio y creativo de origen | `campaign` · `utmMedium` y `utmTerm` · `adId` · `utmContent` | 271 · 507 y 273 · 213 · 505 | **a medias** (`LP11-05`) |
| `:251` | First-touch attribution | `contactos.atribucion_primera` (`db/migraciones/048_de_donde_vino_el_lead.sql:100-101`) | por clave, en `09 § LP09-08` | **sí**, por lista blanca |
| `:252` | Last-touch attribution | `contactos.atribucion_ultima` (`db/migraciones/048_de_donde_vino_el_lead.sql:103-104`) | sin medir en LP-0 | **sólo como «Llegó por»** (`LP11-05`, `LP11-P01`) |
| `:253` | Respuestas de Meta Lead Ads, cuando aplique | carpeta «📁 Score \| ICP Lead Form (Meta)» (`lib/ghl/contrato.ts:325-326`) | respuestas: **sin medir**, ni por carpeta ni sin el puntaje (`09 § LP09-P02`) | **el campo sí; la cobertura, sin medir** (`LP11-06`) |
| `:254` | Respuestas del formulario de la landing, después de completarlo | carpeta «📁 Score \| ICP Nuevo» (`lib/ghl/contrato.ts:323-324`) y el estado «Form Landing VSL» | estado: 121 · 87 · 39 · 346 vacío; respuestas: **sin medir**, porque el 475 incluye al puntaje (`09 § LP09-P02`) | **el campo sí, con corte; la cobertura de las respuestas, sin medir** (`LP11-06`) |
| `:255` | ICP score | `contactos.score` | 471, y 47 de ellos en 0 | **sí** |
| `:256` | Segmento de ICP | el tramo, derivado del puntaje con 75 y 50 | 108 · 158 · 158 · 169 sin calificar | **sí**, por decisión (`LP11-07`) |
| `:257` | Estado del funnel | no hay columna: se deriva | — | **derivado** (`LP11-08`) |
| `:258` | % máximo visto del VSL, cuando haya tracking individual verificable | «VSL % máximo visto», cuyas 79 escrituras fueron 0 y que no escribe desde el 2026-08-30 | — | **no**: hueco (`LP11-10`) |
| `:259` | % máximo visto del video precall, ídem | «Video Pre-Call», un tramo y no un porcentaje | 222 con valor, 180 en el estado inicial | **a medias** (`LP11-10`; en la ficha por `LP05-11`) |
| `:260` | Cita | `negocio.citas` | 292 con alguna; alcanzable, **sin medir** | **sí** (`LP11-09`) |
| `:261` | Asistencia | `citas.asistio` | `true` 0 · `false` 0 | **el campo sí, el dato no** |
| `:262` | Resultado de venta | `resultados.salida` | 7 resultados, 0 ventas | **el campo sí, el dato no** |
| `:263` | Monto reportado por el closer | `resultados.monto` | 0 montos | **el campo sí, el dato no** |

Y el párrafo que cierra la sección:

| línea | el documento pide | ¿se cumple? |
|---|---|---|
| `:265` | que la reproducción no se guarde **sólo** como valor fijo en el contacto: historial, y un resumen en el perfil | **no** (`LP11-11`) |

**Resumen:** de los dieciocho, **ocho se cumplen con dato medido** —uno de ellos, `ghl_contact_id`,
sin dibujarse—, **dos tienen el campo y la cobertura sin medir** —las respuestas de Meta y las de la
landing; del segundo sí está medido el estado del formulario—, tres tienen el campo y no el dato
—asistencia, venta, monto—, tres están a medias —el origen publicitario, el último toque y el
precall—, uno se deriva —el estado del funnel— y uno es un hueco —el VSL—. El párrafo final no se
cumple.

---

## 3 · Lo que se cumple, y cómo

### LP11-03 · Los dos identificadores (`§ 5.3:246-247`)

`lead_id` es `contactos.id`, y es **la llave de la ficha**: la ruta de detalle la recibe por id, y un
id que no es de la empresa responde 404. La maqueta abría la ficha **por nombre**
(`lib/aios/leads-portal.js:292-297`), y con 593 personas reales un nombre no es una llave. Ver
`12-QUIEN-VE-QUE.md`.

`ghl_contact_id` existe en las 593 filas y **no se dibuja**. Su único uso en pantalla sería armar el
enlace a GoHighLevel, y la decisión del 2026-09-26 es que no hay enlace: en el Closer se quitó a
pedido y el campo que lo armaba se fue con él (`lib/negocio/fila.ts:468-469` lo sigue leyendo con un
comentario que todavía habla de ese enlace; hoy sólo lo usa el refresco contra el CRM al abrir la
ficha). La ficha de esta pestaña no refresca contra el CRM, así que tampoco lo necesita. El dato
cumple el documento; la pantalla no lo usa.

### LP11-04 · Los datos básicos (`§ 5.3:248`), y lo que el § 9.6 dice que son

El `§ 5.3` dice «Datos básicos» y no los enumera. **El único lugar donde el documento los enumera es
el `§ 9.6:553-563`**, y es la lista de lo que puede consumir Lead Flow:

| `§ 9.6` | línea | lo que hay |
|---|---|---|
| `lead_id`, `ghl_contact_id` | `:555-556` | los dos, `LP11-03` |
| Nombre | `:557` | `contactos.nombre`, 593 de 593 |
| Teléfono | `:558` | `contactos.telefono`, sin medir en LP-0; el plan anota 558 del 2026-09-26, sin consulta versionada (`09 § LP09-P05`) |
| Correo | `:559` | `contactos.email`, sin medir en LP-0; el plan anota 590 del 2026-09-26, sin consulta versionada (`09 § LP09-P05`) |
| Zona horaria | `:560` | `contactos.zona_horaria_del_lead`: la traían 13 de los 100 contactos más nuevos, medidos el 2026-09-14 en la muestra que dio origen a la columna (`db/migraciones/048_de_donde_vino_el_lead.sql:14-21`); sin medir en LP-0 sobre los 593 |
| Idioma | `:561` | **no existe ninguna columna** |
| Fecha de creación | `:562` | `contactos.alta_en_el_crm`, 569 de 593 — y **no** `creado_el`, que es cuándo lo vio nuestro barrido (`db/migraciones/048_de_donde_vino_el_lead.sql:59-63`) |
| Estado del funnel | `:563` | `LP11-08` |

Dos consecuencias:

- **«Fecha de creación» es el alta en el CRM.** Si la ficha dijera «creado» con `creado_el`, todos
  los contactos de la carga inicial tendrían la misma fecha.
- **Teléfono y correo son las dos únicas menciones de esos datos en todo el documento**, y las dos
  están en la lista de un módulo de agentes que escriben y llaman. El documento no dice quién los ve
  en una pantalla: eso lo decide `12-QUIEN-VE-QUE.md`, y la decisión es que van **sólo en la ficha**.

### LP11-05 · El origen publicitario (`§ 5.3:249-252`)

El documento pide cuatro niveles —campaña, ad set, anuncio, creativo— y dos toques. Lo que hay:

| nivel | clave | contactos | nota |
|---|---|---|---|
| campaña | `campaign` | 271 | el nombre; `campaignId` está en 358 pero ninguna tabla guarda el nombre que le corresponde |
| ad set | `utmMedium` | 507 | **por nombre**: un renombre en Meta parte la serie (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93`) |
| ad set | `utmTerm` | 273 | **el id del conjunto** (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:95-96`) |
| anuncio | `adId` | 213 | los 213 cruzan con `negocio.anuncios` y traen nombre |
| creativo | `utmContent` | 505 | la llave del creativo de Creative (`lib/negocio/calidadDelCreativo.ts:21-24`) |

**Hay que decir una diferencia de vocabulario entre dos carpetas de este repositorio.** Acquisition
rotuló `utmContent` como el nombre del **anuncio** (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93`,
del 2026-09-16), y dos días después Creative lo adoptó como el nombre de la **pieza**, porque los
anuncios de `negocio.anuncios` son muchas menos piezas que ids (`lib/negocio/calidadDelCreativo.ts:21-24`).
Esta carpeta sigue a Creative, que es la decisión más reciente y la que ya publica una pantalla: en
la ficha, «Creativo» es `utmContent` y «Anuncio» es el nombre que sale por `adId`. **Son dos filas
distintas y no se funden en una**, porque la del anuncio falta en 380 contactos y la del creativo en
88.

**Primer toque:** va, por lista blanca. **Último toque:** hoy la pestaña lo usa para una sola cosa,
«Llegó por» —`familiaDelRecorrido` lee el host de `atribucion_ultima`
(`lib/negocio/recorrido.ts:125-127`)—, y no muestra sus UTM. El documento lo pide como renglón propio:
`LP11-P01`.

### LP11-06 · Las respuestas (`§ 5.3:253-254`)

El grupo `calificacion` junta tres carpetas (`lib/ghl/contrato.ts:318-326`): la del formulario de la
landing, la del formulario de Meta, y «Contact», que tiene el puntaje y dos URLs. `perfilDeLaFicha`
(`lib/negocio/ficha.ts:459-538`) ya las agrupa **por significado y no por formulario**, que es lo que
el documento necesita: el lead pudo entrar por cualquiera de las dos puertas, y la misma pregunta
existe en las dos (`lib/negocio/ficha.ts:437-443`).

El `§ 5.3:254` dice **«después de completarlo»**, y el estado del formulario dice que no todos lo
completaron:

| «Form Landing VSL» | contactos |
|---|---|
| Agendado | 121 |
| Form completo sin agendar | 39 |
| **Form incompleto sin agendar** | **87** |
| vacío | 346 |

**Requisito:** las respuestas se muestran **con el estado del formulario al lado**. Ochenta y siete
personas dejaron el formulario a medias; sus respuestas parciales, dibujadas sin ese rótulo, se leen
como un formulario completo. Y el estado lleva su corte: el campo **no se escribe desde el
2026-08-31** (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:114`), así que «vacío» en un
contacto de septiembre no es «no llenó el formulario».

Cuántos contestaron las preguntas propiamente dichas **no está medido**: el 475 de LP-0 cuenta al
puntaje como una respuesta (`09 § LP09-P02`).

### LP11-07 · ICP score y segmento (`§ 5.3:255-256`)

El puntaje lo calcula el CRM —«Puntaje | ICP», 0 a 100— y llega a `contactos.score` por la
sincronización (`lib/negocio/sincronizar.ts:421`). El documento no dice quién lo calcula: dice que
existe. Que el sistema lo calcule por su cuenta, con las respuestas del formulario, **queda a
futuro** y se documenta en `docs/futuro/icp-interno-calculado.md`.

El segmento **no es un dato que venga**: es un corte que alguien decide. La decisión del 2026-09-26
es la de la maqueta —ICP alto ≥ 75, ICP medio 50-74, ICP bajo 1-49, «Sin calificar» sin puntaje o en
0—, con los rótulos «ICP alto / medio / bajo» y no «Calificado alto / Calificado medio / No
calificado» (`lib/aios/leads-portal.js:143`), porque «no calificado» es una etiqueta de descarte del
CRM (`lib/ghl/contrato.ts:236`). Acquisition ya había dejado anotado que el corte 75/50 no tiene
justificación escrita (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:475-487`) y que los datos sugerían
otros dos candidatos (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:520-559`): **la decisión de adoptarlo
es del usuario, y esta carpeta la registra como decisión, no como hallazgo**.

### LP11-08 · El estado del funnel (`§ 5.3:257`)

No hay una columna que lo guarde. `contactos.etapa` existe, pero la escribe sólo Avanzar y la
sincronización no la toca (`db/migraciones/011_negocio_closer_setter.sql:95-99`); la etapa del CRM no
llega porque GoHighLevel no la expone (`lib/negocio/sincronizar.ts:27`).

**Requisito:** el estado se **deriva** de los hechos que sí existen —entró, agendó, asistió, vendió,
descartado— y se dibuja como recorrido, no como una etiqueta única. Los rótulos de la maqueta
—«Vendido», «Asistió», «Agendado», «Calificado», «Perdido», «Sin calificar»
(`lib/aios/leads-portal.js:104-105`)— no tienen fuente: «Calificado» choca con el tramo y con el
pipeline del setter (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:489-507`), y «Perdido» no lo registra
nadie. Y el «Agendado» del formulario **no** es el agendamiento
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:158-170`).

### LP11-09 · Cita, asistencia, venta y monto (`§ 5.3:260-263`)

Los cuatro campos existen y los cuatro están conectados. Tres **no tienen datos**:

- **Cita** — 292 personas con alguna. Cuántas con una cita alcanzable, que es el «agendó» de todas
  las pantallas, **no se midió en LP-0** (`09 § LP09-P01`).
- **Asistencia** — `citas.asistio` vale `true` en 0 personas y `false` en 0. Lo único que hay es el
  plantón del calendario, en 15, y viaja aparte.
- **Resultado de venta** — 7 resultados en toda la base, ninguno `venta`.
- **Monto reportado por el closer** — 0 montos. El rótulo del documento es exacto y se conserva:
  *reportado por el closer*, que es lo que el `§ 5.4:288` exige que se diga.

**Requisito:** los tres vacíos se dibujan como **«sin registrar»**, no como cero ni como «no». Una
ficha que diga «no asistió» de alguien cuya asistencia nadie cargó afirma un hecho que no ocurrió.

---

## 4 · Lo que no se cumple, y se declara

### LP11-10 · El VSL y el precall (`§ 5.3:258-259`)

Los dos renglones llevan la misma condición: *«cuando exista tracking individual verificable»*. El
documento ya previó que podía no haberlo.

- **El VSL: no hay tracking verificable.** Hay un medidor cableado cuyas **79 escrituras fueron
  todas 0**, y que no escribe desde el 2026-08-30; un cero que se publica es peor que un vacío que
  se nota (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:16-20`, `:127-138`). La condición del documento
  no se cumple, así que el renglón **no se dibuja**: va como hueco declarado. La maqueta dibujaba
  porcentaje, llegada al CTA y un registro de VTurb segundo a segundo
  (`lib/aios/leads-portal.js:249-257`): las tres cosas son andamiaje.
- **El precall: hay algo, y no es un porcentaje máximo.** «Video Pre-Call» es un campo de opciones
  con tramos —«1–25%», «76–100%»…— en 222 contactos. Pero **180 de esos 222** son «Sin abrir (0%)» o
  «Nada», que son el estado inicial que el CRM escribe al agendar, no una medición de que la persona
  no vio nada (`lib/negocio/consumoDelPrecall.ts:22-33`). O sea que es verificable **cuando dice que
  vio algo**, y no lo es cuando dice que no. **Entra en la ficha con ese rótulo**: lo decidió
  `LP05-11` (`05-LA-FICHA-DEL-LEAD.md`), como texto del CRM y nunca como número. Lo que queda
  abierto, confirmar ese agregado al plan, está en `LP11-P02`.

### LP11-11 · La historia de la reproducción (`§ 5.3:265`)

*«Los eventos de reproducción no deben guardarse únicamente como un valor fijo en el contacto. Debe
conservarse su historial y exponer un resumen en el perfil.»*

**Hoy se guarda exactamente como el documento dice que no.** El VSL y el precall viven dentro de
`contactos.campos_del_crm`, que la sincronización **reescribe entero** en cada pasada
(`lib/negocio/sincronizar.ts:392-394`). No hay tabla de eventos de reproducción, ni una fila por
visionado, ni una fecha. Lo que la ficha puede mostrar del precall es la última foto.

**No se arregla en esta pestaña.** Conservar la historia es una tabla nueva y un escritor nuevo, y
esta pestaña se construye sin columnas nuevas (`09 § LP09-01`). Se declara: la ficha dice que el
valor es el último que mandó el CRM, y la deuda queda nombrada en `LP11-P03`.

### LP11-12 · La primera frase sí se cumple (`§ 5.3:242`)

*«…mientras los eventos históricos permanecen en tablas separadas.»* Las citas, los mensajes y los
resultados están en `negocio.citas`, `negocio.mensajes` y `negocio.resultados`, y el perfil muestra
**su resumen**: la ficha de la pestaña trae conteos y fechas de mensajes, sin su texto, y la lista de
citas y de resultados. Es el reparto que el documento describe, y es también el que hace que la
ficha no se vuelva una segunda pantalla de conversación.

---

## 5 · El § 5.1: las entidades

### LP11-13 · De diecisiete entidades, la pestaña toca siete, y cuatro tienen tabla

`§ 5.1:203-221`. Las que la pestaña toca, y qué hay detrás de cada una:

| entidad | línea | qué hay | tabla |
|---|---|---|---|
| Lead Profile | `:205` | la fila de `negocio.contactos` y lo que la ficha arma alrededor | **sí** |
| Ad Profile | `:208` | nombre y objetivo del anuncio, por `adId`, en 213 contactos | **sí**, `negocio.anuncios` |
| Landing Session | `:210` | una URL de primer toque y otra de último, sin sesión | **no**: dos claves de un JSON |
| VSL Session | `:211` | nada verificable (`LP11-10`) | **no** |
| Form Submission | `:212` | el estado del formulario y las respuestas, sin fecha de envío | **no**: campos sueltos del CRM |
| Appointment | `:214` | `negocio.citas` | **sí** |
| Sale Report | `:216` | `negocio.resultados`, sin ninguna venta | **sí** |

Las otras diez —Campaign, Ad Set y Creative Profile, Conversation, Sales Call, y las cinco de la
capa de inteligencia y ejecución (`:217-221`)— no las toca esta pestaña. Campaign y Ad Set Profile
existen como un nombre y un id sueltos en la atribución (`LP11-05`), no como perfiles.

**Consecuencia:** tres de las siete entidades que la ficha dibuja **no son entidades en la base**:
son campos de otra fila. Eso limita lo que la ficha puede decir —no hay «cuándo envió el formulario»,
ni «cuántas veces abrió la landing»— y la ficha no lo simula.

---

## 6 · Lo que dicen otras tres secciones

### LP11-14 · El § 9.6: lo que todavía no existe no es «bajo» (`§ 9.6:575-588`)

*«Lead Flow no puede consumir antes de que existan: respuestas del formulario de la landing VSL, ICP
calculado con ese formulario, datos del video precall, información posterior al agendamiento.»*

Es una regla para los agentes de Lead Flow, no un permiso de pantalla. Pero dice algo que la
pestaña tiene que respetar: **para el documento, el ICP es posterior al formulario**. Un lead que
todavía no tiene puntaje no es un lead de puntaje bajo: es uno que todavía no llegó al paso donde se
calcula.

**Requisito:** «Sin calificar» es **un estado aparte**, con su propia tarjeta, y nunca se suma al
tramo bajo. Hoy son 169: 122 sin puntaje y 47 en 0. Los ceros no están en la condición del
documento —tienen un valor— pero son un lote cerrado de agosto sin ninguno en los últimos catorce
días, y la decisión es contarlos con los que no tienen puntaje, **diciéndolo** (`09 § LP09-06`).

Y una cosa que la maqueta afirmaba sin fuente: *«Aún sin formulario · califican al agendar»*
(`lib/aios/leads-portal.js:137`). Para 47 de los 169 no describe lo que hay —tienen un puntaje, que
vale 0—, y para ninguno hay un dato que diga que calificarán al agendar. Es andamiaje.

### LP11-15 · El § 10.5: el segmento lo consume otro módulo (`§ 10.5:718-720`)

Appointment Flow consume *«Respuestas del formulario de la landing»*, *«ICP score»* y *«Segmento
ICP»*. El segmento, entonces, **no es de esta pestaña**: es un dato de la capa compartida que por lo
menos dos consumidores leen.

**Requisito:** el corte vive **en un solo lugar**, sin imports, para el navegador y el servidor
—`lib/negocio/tramosDelIcp.ts`, en LP-1— y la consulta de la pestaña lo usa en vez de repetir los
números. Hoy el 75/50 está escrito en `lib/aios/leads-group.js:10`, y el día que Appointment Flow
publique un segmento con otro corte, las dos pantallas dirían tramos distintos del mismo lead sin
que nada falle.

### LP11-16 · El § 10.7: el «show rate por ICP» no se puede (`§ 10.7:757`)

El documento lo pone entre los KPIs de Appointment Flow. La pestaña tiene exactamente lo necesario
para calcularlo —el tramo y la asistencia de cada persona— **salvo la asistencia**: 0 respuestas en
toda la base.

**Requisito:** la pestaña **no publica una tasa de asistencia por tramo**, ni con piso ni sin él. Las
tarjetas pueden contar cuántos del tramo tienen la asistencia sin registrar, y dicen por qué no hay
tasa. Cuando haya respuestas, la tasa es de Appointment Flow y la pestaña la consume, no la inventa.

---

## 7 · Lo que la maqueta dibuja y el documento no pide

### LP11-17 · Seis cosas sin renglón en el § 5.3

| en la maqueta | dónde | qué pasa |
|---|---|---|
| Fit score e Intent score | `lib/aios/leads-portal.js:276` | no están en el documento ni en la base: se van |
| Costo del lead | `lib/aios/leads-portal.js:268` | no está en el `§ 5.3`; no existe por persona: hueco |
| Dispositivo y ciudad | `lib/aios/leads-portal.js:269` | no están en el `§ 5.3`; sólo saldrían de la IP y el navegador, que no viajan |
| Ubicación y posición | `lib/aios/leads-portal.js:267` | no están en el `§ 5.3`; Meta no está conectado |
| El salto «↗ GHL» | `lib/aios/leads-portal.js:228` | no está en el documento; se va por decisión |
| El monto como protagonista de la tarjeta, «facturado» | `lib/aios/leads-portal.js:188-192` | el documento pide el monto **reportado**, en el perfil; hoy 0 |

Ninguno de los seis es un requisito del documento. Los que la medición no puede sostener se declaran
como hueco —porque alguien que conoce la maqueta los va a buscar—; los que se van por decisión se
anotan en `10-LO-QUE-NO-ES-UN-REQUISITO.md`.

---

## Preguntas abiertas

### LP11-P01 · ¿La ficha muestra el último toque como renglón propio?

El `§ 5.3:252` lo pide, la columna existe (`atribucion_ultima`) y su cobertura **no se midió en
LP-0** (`09 § LP09-P05`). Hoy la pestaña sólo saca de ahí la familia de «Llegó por». Mostrar también
sus UTM es la misma lista blanca aplicada a otra columna. En contra: dos bloques de UTM casi iguales
en la misma ficha se leen mal, y Conversion ya advirtió que confundirlos hace que un departamento
mida cero y lo reporte como ausencia (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:86-88`).

### LP11-P02 · ¿Se confirma el precall en la ficha, como lo agregó `LP05-11`?

El dato está en 222 contactos, y 180 de ellos están en el estado inicial (`LP11-10`). **El plan no
lo pone en la ficha ni en la lista de huecos, y esta carpeta ya lo agregó:** `LP05-11`
(`05-LA-FICHA-DEL-LEAD.md`) lo pone en la ficha como el texto del CRM, con «el CRM no registró
reproducción» para el estado inicial, y dice él mismo que el plan de LP-3 no lo nombraba.
`LP07-03` (`07-EL-PLAN-DE-ACCION.md`) lo da por hecho: *«El precall tiene su lugar en la ficha»*.

**Manda `LP05-11`**, y esta pregunta ya no es cuál de tres salidas, sino si el usuario confirma ese
agregado al plan. Las otras dos —declararlo como hueco junto al VSL, o dejarlo afuera porque
Conversion lo da como dato de Appointment Flow
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:115`)— sólo vuelven si no lo
confirma. **Confirma el usuario.**

### LP11-P03 · ¿Quién construye la historia de reproducción del `§ 5.3:265`?

No es de esta pestaña (`LP11-11`). Pero hoy no es de nadie: ni Conversion, ni Conversation, ni el
plan del Leads Portal la tienen. Queda nombrada acá para que no se pierda.
