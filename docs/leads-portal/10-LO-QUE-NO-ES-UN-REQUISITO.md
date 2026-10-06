# Lo que NO es un requisito, y la lista de borrado

> Medición propia sobre el código de la maqueta, hecha el **2026-09-26** y contada valor por valor
> con el método de `LP10-01`, más la medición agregada contra producción del **2026-09-27 a las
> 00:10 UTC** (el 26 a las 19:10 en Lima), sin un solo dato personal. Cada afirmación lleva su
> `archivo:línea`.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** Éste es el archivo que dice qué borra LP-6,
> así que es el primero cuyas citas se rompen: las de `lib/aios/leads-portal.js` y
> `aios-command-center_1.html:5710-5730` fallan al resolverse y las ve
> `pruebas/codigo/101-las-citas-de-los-documentos.test.ts`; las de
> `components/views/ContactsView.jsx`, las de `lib/aios/leads-group.js` posteriores a la línea 56,
> las de `lib/aios/index.js` y las de `scripts/paridad.mjs` **siguen resolviendo y muestran otra
> cosa**. LP-7 las reapunta al prototipo,
> `aios-command-center_1.html:4585-4904`, o a la cabecera de la vista nueva.

**Un requisito** es una pregunta que la pestaña tiene que poder contestar, y sobrevive al borrado.
**El andamiaje** es la forma concreta en que la maqueta finge contestarla. Es la distinción de
`docs/acquisition/00-MAPA.md:46-87`, y acá hace casi todo el trabajo: de las maquetas que quedan en
la aplicación, ésta es la única que dibuja una ficha por **persona**, con teléfono y correo.

---

## 1 · El censo

### LP10-01 · El recuento, con un método que se puede repetir

**Método** · Se cuenta un **valor literal** por cada cadena entre comillas simples, cada número
suelto y cada `null`, fuera de los comentarios y fuera de las plantillas de HTML (que se cuentan
aparte, porque llevan el marcado y no los datos). **Una plantilla sale entera, con lo que haya dentro
de sus `${…}`**: un literal escrito en una interpolación no cuenta. Un teléfono es **un** valor, no
cuatro números.

`lib/aios/leads-portal.js`, 324 líneas:

| bloque | líneas | valores | qué es |
|---|---|---|---|
| formato y colores | `aios-command-center_1.html:4587-4588` | 6 | el `$` y la configuración regional `en-US` de los montos, y cuatro colores por tramo |
| **`LEADS`** | `aios-command-center_1.html:4590-4664` | **391** | 251 cadenas · 137 números · 3 nulos. **Quince personas por 23 campos = 345, más la ficha completa de la primera, 46** |
| **el relleno** | `aios-command-center_1.html:4666-4683` | **75** | fabrica la ficha de las otras catorce a partir de su tramo (`LP10-04`) |
| rótulos de estado y tramo | `aios-command-center_1.html:4685-4687` | 10 | vocabulario |
| estado del filtro | `aios-command-center_1.html:4688-4701` | 8 | código |
| las tarjetas | `aios-command-center_1.html:4703-4745` | 26 | y 3 plantillas |
| la rejilla | `aios-command-center_1.html:4747-4783` | 8 | y 5 plantillas |
| la ficha | `aios-command-center_1.html:4785-4870` | 20 | y 10 plantillas |
| la puerta global | `aios-command-center_1.html:4872-4878` | 1 | |
| los oyentes | `aios-command-center_1.html:4880-4903` | 25 | ids y eventos |
| **total** | | **570** | **466 de ellos en los dos bloques de datos** |

**Lo que depende del criterio y lo que no.** Si los literales de dentro de las `${…}` se contaran,
las tres filas con plantillas subirían a 32, 24 y 83, y el total a 655 (en `lib/aios/leads-group.js`,
de 108 a 109). **Los dos bloques de datos no
cambian**, porque no tienen una sola plantilla: 391 + 75 = 466 con cualquiera de los dos criterios, y
es esa cifra —y la de `POOL`, abajo— la que sostiene el argumento.

Y en los otros tres archivos de la maqueta:

| archivo | valores | de dato |
|---|---|---|
| `lib/aios/leads-group.js` | 108 | **70 en `POOL`** (`lib/aios/leads-group.js:14-29@c4cf2a8`): catorce personas por cinco campos |
| `aios-command-center_1.html:5710-5730` | 9 | **4 frases** dentro de una plantilla (`LP07-01`) |
| `components/views/ContactsView.jsx` | — | **ninguno**: sus 22 textos —contando tres glifos y el `placeholder`— son vocabulario de interfaz |

**El andamiaje de datos, junto: 466 + 70 = 536 valores**, más las cuatro frases.

**Sobre la cifra del plan.** El plan de LP-0 habla de «~508 literales». No se pudo reproducir con
ninguno de los tres métodos probados —tokens numéricos fuera de comentarios: 355; tramos de dígitos:
373; valores: 570— y esta carpeta publica la de arriba **con su método**, que es lo que la vuelve
comprobable. Para comparar con las otras pantallas, que contaron tokens numéricos: **355** en
`lib/aios/leads-portal.js`, 308 de ellos en `LEADS`, contra 538 de Conversion
(`docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:36`) y 67 de Sales
(`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:13`).

### LP10-02 · Quince personas en el portal y catorce en el cajón: diecisiete inventadas

**Rastro** · `LEADS`, una persona por entrada, en `aios-command-center_1.html:4591`, `:4608`, `:4612`, `:4616`,
`:4620`, `:4624`, `:4628`, `:4632`, `:4636`, `:4640`, `:4644`, `:4648`, `:4652`, `:4656` y `:4660`. `POOL`, en
`lib/aios/leads-group.js:15-28@c4cf2a8`.

Las quince del portal, todas inventadas: María López, Pablo Herrera, Carlos Méndez, Daniela Soto,
Lucía Fernández, TechNova, Grupo Meridian, Estudio Vera, Rodrigo Vega, Andrea Salas, Diego Paredes,
Sergio Málaga, Verónica Iparraguirre, Cobra Studio y Karla Núñez. Once parecen personas y cuatro
parecen negocios.

**Doce están en los dos archivos.** Tres sólo en el portal —las tres sin puntaje
(`aios-command-center_1.html:4648`, `:4652`, `:4656`)— y dos sólo en el cajón: Iván Torres y Marcos Ruiz
(`lib/aios/leads-group.js:26@c4cf2a8`, `:28@c4cf2a8`).
**Diecisiete distintas.**

**Cada una de las quince trae un teléfono y un correo** con forma real —prefijo de país, dominios
plausibles—, en el campo `tel` y `mail` de su entrada. Son inventados, y esta carpeta no los copia:
un teléfono con forma real en un documento es un teléfono, lo haya inventado quien lo haya inventado.

**Requisito** · Ninguna vuelve a la interfaz. Hoy la vigilancia de nombres inventados
(`pruebas/codigo/91-closer-y-setter.test.ts:427-465`) ya tenía una de ellas —Andrea Salas, `:441`—, y
LP-6 le agrega las demás (`LP10-10`).

### LP10-03 · El nombre de un closer real, con dos ventas que no existen

**Rastro** · El nombre completo de un closer real en el campo `closer` de cuatro personas
(`aios-command-center_1.html:4593`, `:4610`, `:4626`, `:4630`), y su nombre de pila en una interacción de la
primera (`:4607`).

**Qué le atribuye la maqueta:** las dos primeras ventas inventadas —$4.500 (`:11`) y $9.600
(`:28`)—, una llamada de 48 minutos en la que *«cerró en la llamada»* (`:26`), una persona que
asistió (`:44`) y otra agendada (`:48`). **Medido el 2026-09-27: cero ventas y cero montos en toda la
base.** La pantalla le adjudica a una persona con nombre $14.100 que no vendió.

Es el mismo nombre que dibujaba la maqueta de Sales (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:32`)
y el que la vigilancia ya lista (`pruebas/codigo/91-closer-y-setter.test.ts:442`). Esta carpeta no lo
escribe.

**Y un rótulo que finge un segundo closer:** «Asesor comercial» en otras cuatro
(`aios-command-center_1.html:4614`, `:4618`, `:4638`, `:4646`), incluida la tercera venta inventada, $6.000
(`:4645`). Es el mismo recurso de la maqueta de Sales
(`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:49`).

**Requisito** · El nombre del closer sale de `closersDeLaEmpresa()` o no sale (`LP08-09`,
`LP05-16`).

### LP10-04 · Lo que el relleno fabrica con aritmética sobre otro dato

**Rastro** · `aios-command-center_1.html:4666-4683`, bajo el comentario *«relleno para los contactos de
ejemplo que no traen ficha completa»*.

Es la parte más insidiosa de la maqueta, porque **no escribe números al azar: los deriva de otro
dato**, y un número derivado se ve medido:

| campo de la ficha | cómo lo fabrica | línea |
|---|---|---|
| facturación mensual, tamaño del equipo, urgencia, si decide la compra | **del tramo**: un «alto» factura «$15K–25K / mes» y tiene urgencia «Este mes»; uno «bajo» «Consulta con socio» antes de decidir | `:87-89` |
| dispositivo | **de la paridad del puntaje**: impar es Android, par es iPhone | `:92` |
| costo del lead | **del puntaje módulo 14 y módulo 80**; los tres sin puntaje cuestan exactamente lo mismo, «$12.10», porque `null % 14` vale 0 | `:93` |
| `utm_campaign` y `utm_content` | del nombre de la campaña y del creativo, en minúscula y con guiones bajos | `:94-95` |
| el registro de reproducción del VSL | minutos y segundos calculados del porcentaje visto y del puntaje | `:96-98` |
| las interacciones | «Formulario enviado», un agente de WhatsApp con nombre, el precall, «Appointment Flow» | `:99-101` |

El primero es el más peligroso: **inventa lo que el prospecto dice de sí mismo a partir de su
puntaje**. Es la trampa de `docs/sales/00-MAPA.md:149-152` al revés: allá el dato del prospecto
tentaba como valor de la venta; acá se fabrica el dato del prospecto.

### LP10-05 · Las frases escritas a mano: cuáles son vocabulario y cuáles afirman algo

**Vocabulario** —sobrevive casi tal cual—: «Leads Portal», «Todos», «Sin calificar», «Alto»,
«Medio», «Bajo», «Etapa», «Todas», «Agendados», «Asistieron», «Vendidos», «Hoy», «7 días», «30 días»
(`aios-command-center_1.html:3030-3063`); los pasos «Agendó», «Asistió», «Vendió»
(`aios-command-center_1.html:4752`); «Recorrido», «Interacciones», «Contacto», y el vacío «Ningún
contacto con estos filtros.» (`:4775`).

**Contenido afirmado** —se va—:

| frase | línea | qué afirma |
|---|---|---|
| las cuatro del Plan de acción | `aios-command-center_1.html:5717-5726` | ver `07-EL-PLAN-DE-ACCION.md` |
| «Calificado alto», «Calificado medio», «No calificado» | `aios-command-center_1.html:4724` | que el tramo **es** la calificación; «no calificado» es además una etiqueta de descarte del CRM (`lib/ghl/contrato.ts:236`). Se reemplazan por «ICP alto / medio / bajo» (`LP03-06`) |
| «Aún sin formulario» · «califican al agendar» | `aios-command-center_1.html:4718` | una regla del CRM que nadie midió (`LP02-12`) |
| «facturado» · «en proceso» · «califica al agendar» · «sin cita» | `aios-command-center_1.html:4771-4772` | dinero cobrado y un estado comercial (`LP02-11`) |
| «Comportamiento en el VSL», con **«VTurb»** como fuente | `aios-command-center_1.html:4830` | que el medidor está conectado y reporta. **No reporta desde el 2026-08-30** (`LP05-10`) |
| «Fit score», «Intent score» | `aios-command-center_1.html:4857` | dos puntajes que no existen en ninguna tabla (`LP05-15`) |
| «12 mensajes · sentimiento positivo» | `aios-command-center_1.html:4604` | un análisis de sentimiento que nadie corrió sobre esa persona |
| el registro de reproducción: «Pausó 22 s», «Retrocedió a 01:40», «Clic en agendar» | `aios-command-center_1.html:4601-4602` | un seguimiento segundo a segundo que el sistema nunca tuvo |
| «WhatsApp · Sofía» | `aios-command-center_1.html:4604`, `:4681` | el nombre inventado del agente, el mismo que tenía la maqueta de Conversation (`components/views/ConversationView.jsx:26`) |

**Lo que se afirma sobre el sistema, que es peor que un dato inventado:** «VTurb» en la ficha es el
mismo defecto que los chips de fuente de Conversion (`docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:49-59`):
quien mira concluye que la telemetría está conectada y que los números salen de ahí.

**La bajada, «Cada contacto, de dónde vino y hasta dónde llegó»**
(`aios-command-center_1.html:3031`), sobrevive a medias: «de dónde vino» se puede decir;
«hasta dónde llegó» hoy se detiene, para casi todos, en «agendó» —cero asistencias registradas y
cero ventas, medido el 2026-09-27—.

### LP10-06 · Los controles muertos y los medio muertos

| control | dónde | qué hace |
|---|---|---|
| «◈ Plan de acción» | `aios-command-center_1.html:3034`; `aios-command-center_1.html:5711-5730` | abre un modal con cuatro frases sin fuente (`LP07-01`) |
| el segmentado de período | `aios-command-center_1.html:3036`; `aios-command-center_1.html:4894-4898` | **mueve el resaltado y nada más**: nada de la pantalla depende del período. Su tercer botón manda `data-p="mes"` (`aios-command-center_1.html:3036`), que no está en `PERIODOS` (`lib/negocio/periodo.ts:83-96`) (`LP06-02`) |
| «Personalizado» | `aios-command-center_1.html:3037`; `lib/aios/datepicker.js:124-131@c4cf2a8` | abre el calendario, **no hay callback registrado** para `lp` —`_cbs` nace vacío y nadie lo escribe (`datepicker.js:133@c4cf2a8`)— y al aplicar reescribe el rótulo y **apaga el segmentado** (`:109-121@c4cf2a8`) sin cambiar un dato |
| «✆ Llamar» y «✉ Email» | `aios-command-center_1.html:4807-4808` | **nada**: ningún oyente |
| «↗ GHL» de la ficha | `aios-command-center_1.html:4809`, `:4865-4866` | abre la **raíz** de GoHighLevel, no el contacto; y la decisión es que no haya enlace (`LP05-06`) |
| el número de cada tarjeta | `aios-command-center_1.html:4714` | abre el cajón con personas del `POOL`, no con las de la tarjeta; «Sin calificar» abre tres con puntaje 87, 91 y 82 (`LP08-10`) |
| el clic en una tarjeta | `aios-command-center_1.html:4732-4743` | filtra, y en el camino compara **el texto buscado con la clave del tramo** (`:4736`), una condición que no significa nada |
| el buscador | `aios-command-center_1.html:3047`; `aios-command-center_1.html:4695-4698` | busca sin quitar tildes —«martin» no encuentra «Martín»— y además en el origen, que el `placeholder` no nombra (`LP04-10`) |

Tres son los mismos tres de Sales —botón, segmentado, píldora
(`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:78-86`)—, y el de acá tiene uno más vivo que allá: el
plan sí abre algo.

### LP10-07 · Las contradicciones internas de la maqueta

| defecto | dónde | qué pasa |
|---|---|---|
| mismo puntaje, dos tramos | `aios-command-center_1.html:4624` contra `:4644` | dos personas con 79, una «medio» y otra «alto»: el tramo se **guarda** al lado del puntaje en vez de derivarse (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:514-518`) |
| misma persona, dos tramos | `aios-command-center_1.html:4624` contra `lib/aios/leads-group.js:20@c4cf2a8` | la del 79 «medio» es «alto» en el cajón, que sí deriva con `:10@c4cf2a8` |
| la porción del tramo alto | `aios-command-center_1.html:5717`, `lib/aios/executive.js:199@c4cf2a8`, `aios-command-center_1.html:4715` | 22 %, 25 % y 33 % (`LP07-02`) |
| «ICP null» | `aios-command-center_1.html:4791`, `:4857` | la ficha de las tres sin puntaje escribe la palabra `null`: la plantilla interpola el nulo sin mirarlo |
| la ficha de otra persona | `aios-command-center_1.html:4876-4877` | un nombre que no está abre la ficha de la primera con el nombre cambiado (`LP08-11`) |
| cierre sin piso | `aios-command-center_1.html:4707`, `:4719` | «Cierre 60 %» sobre cinco personas; el piso del sistema es 10 (`LP06-10`) |
| un color fuera del tema | `aios-command-center_1.html:4588` | el de «Sin calificar» es `rgba(148,197,255,.25)`: el canal `--c-nube` escrito a mano (`app/aios.css:17`), que no sigue al tema claro |
| cuatro sentidos de «calificado» | `aios-command-center_1.html:4685`, `:4724`; `aios-command-center_1.html:3052` | un estado comercial, tres rótulos de tramo y un filtro, con la misma palabra |

---

## 2 · Lo que parece andamiaje y es requisito

### LP10-08 · La forma se queda; los valores se van

Borrar la maqueta no borra las preguntas que hacía. Sobreviven, con su ficha en otro archivo:

- **las cinco tarjetas por tramo**, con su porción y sus agendados (`03-LAS-CINCO-TARJETAS.md`). El
  corte 75/50 lo decidió el usuario el 2026-09-26, y **su única escritura en código es
  `lib/aios/leads-group.js:10@c4cf2a8`, que se queda con Executive**: LP-1 lo escribe en su módulo, no lo
  importa de la maqueta (`LP08-14`);
- **la rejilla con su progreso «Agendó › Asistió › Vendió»** (`aios-command-center_1.html:4751-4755`),
  con la asistencia ahora en cuatro estados (`LP04-08`);
- **el contador «N de M contactos»** (`aios-command-center_1.html:4777-4778`), que es la regla de
  `A7-29` (`LP04-15`);
- **el vacío que dice por qué está vacío** (`:4775`, `LP04-14`);
- **la búsqueda por nombre, campaña y creativo** (`LP04-10`);
- **las secciones de la ficha** —recorrido, cuestionario, interacciones, publicidad, calificación,
  contacto—, cada una llena con dato real o declarada como hueco (`05-LA-FICHA-DEL-LEAD.md`);
- **la clave `contacts`** (`lib/autorizacion/secciones.ts:223`) **y el `id="v-contacts"`**
  (`aios-command-center_1.html:3024`).

**El galón del menú se queda** (`lib/autorizacion/secciones.ts:227`; desde la barra nueva de la etapa E10, el 2026-10-02, no se dibuja): el precedente de Sales y
Creative es que el adorno no era lo que estaba mal (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:113-114`).

---

## 3 · La lista de borrado de LP-6

### LP10-09 · Lo que se borra

1. **`lib/aios/leads-portal.js` entero**: 324 líneas, 570 valores, quince personas inventadas con
   sus teléfonos y correos, el nombre de un closer real y la puerta global `window.AIOSLeadCard`.
2. **El bloque del Plan de acción**, `aios-command-center_1.html:5710-5730`. El resto del archivo
   (`lib/aios/period-controls.js:6-14@c4cf2a8` y `:29-31@c4cf2a8`, el abrir y cerrar de `.pill-wrap`) tampoco tiene
   emisor: medido el 2026-09-26 sobre `components/`, `lib/`, `app/`, `pruebas/` y `scripts/`, ninguna
   vista emite `.pill-wrap`; fuera del prototipo sólo lo nombran `app/aios.css` y este mismo archivo,
   y la píldora de esta pestaña no está envuelta en él (`docs/sales/07-EL-PLAN-DE-ACCION.md:77-78`).
   LP-6 no lo borra, porque el plan sólo saca el bloque; queda como deuda con nombre en `LP10-13`, y
   el comentario de `lib/aios/period-controls.js:27@c4cf2a8`, que lo da por vivo, también está mal.
3. **De `components/views/ContactsView.jsx`, todo menos la sección**: la mitad derecha del
   encabezado (`aios-command-center_1.html:3033-3039`) y el cuerpo vacío que la maqueta llenaba
   (`aios-command-center_1.html:3042-3068`). Queda una envoltura fina con `id="v-contacts"`, con
   el panel nuevo adentro y **una cabecera que enumera lo borrado y
   la medición que lo desmiente** —la forma de `components/views/SalesView.jsx`—. Esa cabecera no
   nombra al closer real ni copia un teléfono o un correo.

### LP10-10 · Lo que LP-6 cambió en otros archivos

Hecho en LP-6, fila por fila:

| archivo | qué | por qué |
|---|---|---|
| `lib/aios/index.js` | salieron el `import` y la entrada de `MODULOS`; el comentario de `:1-4` dejó de nombrar `window.AIOSLeadCard`, y `:14-16` dice por qué salió | el `import` de un archivo borrado rompe el build; el comentario justificaría un orden por una global que ya no está |
| `lib/aios/leads-group.js` | salieron el clic de la fila y la preselección del pie, reemplazados por la misma cantidad de líneas de comentario (`:57-59` y `:65-68`); **el texto no se tocó** | la global que llamaba ya no existe; la paridad compara el texto del cajón (`LP08-12`) |
| `scripts/paridad.mjs` | `VISTAS` vacía (`:153`, con su motivo en `:134-152`); salieron los pasos del calendario y de la ficha y el del cajón se mudó a Executive (`:157-170` y `:212`) | la vista ya no es el port literal; la compuerta no se retira porque quedan pasos de Executive (`LP08-12`, punto 6) |
| `pruebas/codigo/90-fundaciones.test.ts` | la prueba de `:1274-1339` exige la lista vacía, que ningún paso nombre `#v-contacts` y que el cajón se abra desde Executive | exigía `['contacts']` exactamente |
| `pruebas/codigo/91-closer-y-setter.test.ts` | `INVENTADOS` (`:425-463`) suma los catorce nombres del portal que faltaban y los dos que sólo están en el cajón; **`AMBITO` (`:479-486`) y `ENFOQUE` (`:516-521`) se ampliaron a `components/leads-portal/` y a `components/views/ContactsView.jsx`** | sin ampliar el alcance, los nombres nuevos se vigilarían **sólo donde nunca estuvieron**: las dos listas miraban Closer, Setter y `components/negocio/`. Lo mismo vale para el barrido de montos (`:503`) |
| `pruebas/codigo/178-la-maqueta-del-leads-portal-se-fue.test.ts` | nueva | que el archivo ya no exista, que no quede `initLeadsPortal` ni `window.AIOSLeadCard`, que la vista no tenga `lpPlanBtn`, `data-datepick` ni `data-leads`, que el panel nuevo no tenga montos literales, y que la ruta de detalle no importe la sincronización |

**Y lo que no es de LP-6 y fue antes, en el commit de la ruta (LP-4):** la bandera
`sinOperacionesTodavia` de `lib/autorizacion/secciones.ts:226` bajó, y el conteo literal de
`pruebas/codigo/90-fundaciones.test.ts:1263` pasó de 2 a 1. `30-portero` la verifica en las dos
direcciones, como pasó en Sales (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:92-94`).

### LP10-11 · Lo que LP-6 NO borra, y por qué

| qué | dónde | por qué se queda |
|---|---|---|
| el cajón «Grupo de contactos» y su módulo | `components/Overlays.jsx:5-26@c4cf2a8`, `lib/aios/leads-group.js` | lo abre el embudo de Executive (`lib/aios/executive.js:49@c4cf2a8`) |
| el cajón `#drawer` | `components/Overlays.jsx:120-136@c4cf2a8` | lo abre Executive (`lib/aios/executive-panel.js:80-81@c4cf2a8`, `:101-102@c4cf2a8`) |
| las reglas `[data-leads]` | `app/aios.css:2366-2370` | Executive sigue emitiendo el atributo |
| las reglas de la sección «LEADS PORTAL» | `app/aios.css:1205-1315` | `app/aios.css` es el port literal y no se toca (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:161-163`); ver `LP10-12` |
| el modal `#recoModal` | `components/Overlays.jsx:98-119@c4cf2a8` | queda inerte; ver `LP07-08` y `LP07-P01` |

### LP10-12 · El CSS se mide emisor por emisor, antes y después

**Medido el 2026-09-26 sobre `components/`, `lib/` y `app/`:**

- **exclusivas de la maqueta** —un solo emisor en todo el árbol—:
  - las emite `components/views/ContactsView.jsx`: `.lp-wrap`, `.icp-cards`, `.lp-bar`,
    `.lp-search`, `.lp-count`, `.lp-grid`, `.tb-lab`, `.fb-div` y `.si`, y las cuatro de la mitad
    derecha del encabezado, `.ch-r`, `.ch-period`, `.reco-btn` y `.rb-ic`, que las otras cinco
    pantallas ya no emiten;
  - las emite `lib/aios/leads-portal.js`: la tarjeta, `.icpc` con sus hijas `.ih`, `.idot`, `.iv`,
    `.is`, `.ib` e `.im` (`aios-command-center_1.html:4712-4717`); la fila, `.lc` y la familia `.lc-*`,
    con el puntaje `.sc-v` y `.sc-l` (`:4765-4766`); de la ficha, `.ld-head`, `.ld-av`, `.ld-actions` y
    `.ld-btn` (`:4789`, `:4806-4809`); y el registro del video, `.vlog`, `.vl` y `.vl-*` (`:4833-4836`).
  
  Sus reglas viven casi todas en `app/aios.css:1205-1315`. Fuera de ese bloque: `.lc`, `.lc-score`,
  `.sc-v` y `.sc-l` también en `app/aios.css:2373-2377` («leads sin calificar»); `.tb-lab` y
  `.fb-div` en `app/aios.css:648`, `:669-670` y `:729`; las cuatro del encabezado en
  `app/aios.css:721`, `:856-864` y `:1698-1709`, y además en `app/inteligencia-estetica.css:91-112`,
  acotadas a las pantallas de Inteligencia, que ya no las emiten;
- **vivas fuera**: de la familia `.ld-*`, sólo `.ld-time`, `.ld-dot`, `.ld-t`, `.ld-m` y `.ld-when`,
  que emite también la ficha de las pestañas de operación (`components/negocio/Ficha.jsx:414-425`);
  y `.kv-box`, `.kv`, `.dw-sec-t`, `.dw-block`, `.dw-empty` y `.r`, que emite la misma ficha. Además,
  `.kv-box`, `.kv`, `.dw-sec-t` y `.r`, el aviso del CRM de Ajustes
  (`components/ajustes/AvisoDelCrm.jsx`); `.dw-sec-t` y `.dw-block`, Executive; y `.dw-empty`, las
  pantallas del Closer. Borrar cualquiera rompería otra pantalla **sin que nada falle**;
- **ninguna hoja tenía una regla bajo `#v-contacts`** hasta LP-5. La pestaña no recibió la estética
  de operación —es del grupo AIOS, no de Inteligencia (`lib/autorizacion/secciones.ts:212`)—, así que
  no había un `:is(…)` que ampliar, como sí lo hubo en Sales
  (`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:144-152`). LP-5 le dio su propia hoja,
  `app/leads-portal.css`, en la capa `components`.

**Requisito** · Después de LP-5 se repite la medición. Las clases que el panel nuevo no reuse quedan
**sin emisor y no se borran de `app/aios.css`**: se anotan con su medición. Y el panel nuevo entra en
`pruebas/codigo/147-lo-que-el-panel-dibuja.test.ts`, que exige que toda clase que dibuja tenga una
regla que alcance a su vista. Ver `LP10-P01`.

### LP10-13 · La deuda que queda después de LP-6, con nombre

LP-6 saca a Leads Portal de la maqueta. **No saca a la maqueta de la aplicación**, y conviene que
nadie lea el commit como si lo hiciera:

1. **Catorce personas inventadas siguen en pantalla, ahora sólo desde Executive**: el `POOL` con tres
   montos en dólares y un salto a GoHighLevel (`lib/aios/leads-group.js:14-29@c4cf2a8`, `:51@c4cf2a8`). Ver `LP10-P02`.
2. **`#recoModal` queda inerte** (`LP07-08`).
3. **El calendario se queda sin quién lo abra**: la única píldora visible era la de esta pestaña; la
   de Executive está `hidden` (`components/views/ExecutiveView.jsx:62@c4cf2a8`).
4. **La fila del cajón queda con cursor de mano y sin clic** (`app/aios.css:2345-2346`), hasta que
   se anule fuera de `app/aios.css` (`LP08-12`, punto 2).
5. **El corte 75/50 existe dos veces** (`LP08-14`).
6. **`window.AIOSLeads` no tiene ningún consumidor**: se publica con `open` y `close`
   (`lib/aios/leads-group.js:5@c4cf2a8`, `:87@c4cf2a8`) y nadie los llama; todo entra por el escuchador delegado.
7. **Executive sigue hablando de Leads Portal con cifras inventadas**: su ficha de departamento, que
   no se dibuja, y el chat, que cita a esta pestaña como fuente (`LP08-13`).
8. **Lo que queda de `lib/aios/period-controls.js` no tiene a quién atender**: el abrir y cerrar de
   `.pill-wrap` (`lib/aios/period-controls.js:6-14@c4cf2a8`, `:29-31@c4cf2a8`) busca una clase que ninguna vista
   emite, y el comentario de `:27@c4cf2a8` dice lo contrario (`LP10-09`, punto 2). Después de LP-6, todo lo
   que el archivo hace es esperar una clase que nadie dibuja.

---

## Preguntas abiertas

### LP10-P01 · ¿Las reglas del panel nuevo van en `app/aios.css`?

El plan de LP-5 las pone en `app/aios.css`, acotadas a `#v-contacts` y con una media query a 375 px.
El precedente dice lo contrario: `app/aios.css` es el port literal del prototipo y no se toca
(`docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md:161-163`), y el commit `bd26085` puso una anulación en
`app/closer.css` por ese mismo motivo. Con la compuerta de paridad sin vistas, el motivo pierde parte
de su fuerza —ya no se compara la geometría de `contacts`—, pero sigue comparando los pasos de
Executive, que usan reglas de la misma hoja. Hay que decidir si la hoja sigue siendo intocable o si
deja de serlo con esta pestaña. **Después del corte, el 2026-10-01**: los pasos de Executive se fueron
con su maqueta y la compuerta quedó retirada (nueva estructura, E7). La hoja se sigue sin tocar, pero
ahora sólo para que un diff contra el prototipo diga qué se desvió.

### LP10-P02 · ¿Las catorce personas del cajón se quedan hasta que Executive se reconstruya?

**Resuelta el 2026-10-01** (nueva estructura, E7): se borraron con la maqueta del Executive, junto con el cajón y el paso de paridad que las sostenía. El plan las deja porque la compuerta de paridad compara el texto del cajón contra el prototipo, y
cambiarlo daría rojo permanente en el paso mudado. Es la misma razón por la que `aios.css` no se
toca, y tiene el mismo costo: **una pantalla que la gente abre sigue mostrando personas y montos
inventados**. `pruebas/codigo/91-closer-y-setter.test.ts:467-479` dejó escrito que vaciar una
pantalla sin tener de dónde traer datos es una decisión de producto; ésta lo es, y Executive
todavía no tiene de dónde traerlos.
