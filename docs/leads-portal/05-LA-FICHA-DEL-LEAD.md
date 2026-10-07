# La ficha del lead, sección por sección

> Requisitos derivados de la maqueta de Leads Portal, del § 5.3 del documento funcional
> («Perfil resumido del lead», `C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`, líneas
> 240-265) y de la **medición LP-0 contra producción, hecha el 2026-09-27 a las 00:10 UTC** (el 26
> por la tarde en Lima), sólo con consultas agregadas. Cada requisito lleva el `archivo:línea` del que
> sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a `lib/aios/leads-portal.js` son a la maqueta tal como está hoy.** En LP-6 ese archivo
> se borra, y en LP-7 estas citas se reapuntan. Las citas `§ N:línea` son al documento funcional, que
> no vive en el repositorio.

La maqueta abre la ficha con `openLead` (`aios-command-center_1.html:4786-4870`). La dibuja dentro del
cajón compartido `#drawer` y la arma entera con plantillas de texto. Tiene un encabezado, una fila de
acciones y siete secciones:

| # | sección de la maqueta | líneas | qué pasa con ella |
|---|---|---|---|
| — | encabezado: iniciales, nombre, «ICP · tramo · cuándo · estado» | `aios-command-center_1.html:4787-4792` | **dato real**, con otro estado (`LP05-05`) |
| — | acciones: Llamar · Email · GHL | `aios-command-center_1.html:4806-4810` | `tel:` y `mailto:`; **sin GoHighLevel** (`LP05-06`) |
| 1 | Recorrido | `aios-command-center_1.html:4813-4821` | **dato real** en cinco pasos y **el VSL como hueco** (`LP05-07`) |
| 2 | Formulario de la landing | `aios-command-center_1.html:4823-4828` | **dato real**: el grupo `calificacion` y el estado del formulario (`LP05-08`, `LP05-09`) |
| 3 | Comportamiento en el VSL | `aios-command-center_1.html:4830-4838` | **hueco declarado**, salvo el precall, que **sí es dato real** (`LP05-10`, `LP05-11`) |
| 4 | Interacciones | `aios-command-center_1.html:4840-4844` | **dato real**, sin el texto de los mensajes (`LP05-12`) |
| 5 | Parámetros de publicidad | `aios-command-center_1.html:4846-4854` | **lista blanca** de claves y sólo el host (`LP05-13`); lo demás, **hueco** (`LP05-14`) |
| 6 | Calificación | `aios-command-center_1.html:4856-4859` | **dato real** el puntaje; **fit e intent, hueco** (`LP05-15`) |
| 7 | Contacto | `aios-command-center_1.html:4861-4863` | **dato real**; el closer por su nombre y nunca por su id (`LP05-16`) |

---

## 0 · Cómo se abre, dónde se dibuja y qué no hace

### LP05-01 · La ficha se abre por id y nunca por nombre, y no inventa a nadie

- **Rastro:** la rejilla abre `openLead(LEADS[+el.dataset.lead])`, o sea por posición
  (`aios-command-center_1.html:4780-4782`). Además hay una puerta global, `window.AIOSLeadCard(name)`,
  que busca **por nombre** (`aios-command-center_1.html:4872-4878`). Si no lo encuentra, **copia la
  ficha del primer contacto y le cambia el nombre** (`aios-command-center_1.html:4876-4877`). Con datos
  reales, eso mostraría el teléfono, las respuestas y el recorrido de una persona bajo el nombre de
  otra.
- **Qué pide:** la ficha se pide con el UUID del contacto (`GET /api/leads-portal/[id]`, LP-4). Un id
  que no es UUID, o que es de otra empresa, da 404. Nunca se busca por nombre y **nunca hay un
  relleno**: sin fila no hay ficha. Qué pasa con la puerta global lo decide
  `08-LO-QUE-ENTREGA-Y-RECIBE.md`.

### LP05-02 · Un cajón propio, no `#drawer`

- **Rastro:** la maqueta enciende `#scrim` y `#drawer` (`aios-command-center_1.html:4867-4869`), que están
  en `components/Overlays.jsx:120-136@c4cf2a8`. **Executive usa el mismo cajón** (`lib/aios/executive-panel.js:81@c4cf2a8`
  y `lib/aios/executive-panel.js:102@c4cf2a8`).
- **Qué pide:** un cajón con id propio, con su velo. Al abrirse, el foco entra en el cajón; Escape lo
  cierra, y al cerrarse el foco vuelve a la tarjeta que lo abrió. Si se compartiera el cajón, dos
  pantallas escribirían en el mismo `#dwBody`.

### LP05-03 · La ficha sólo lee: no refresca contra el CRM ni escribe

- **Rastro:** la ficha del closer sí refresca: su ruta llama a `refrescarUnContacto`, que es *«la
  llamada que cuesta abrir la ficha»* (`lib/negocio/sincronizar.ts:532-562`).
- **Qué pide:** `fichaDelLeadDelPortal` sólo lee. No gasta presupuesto del proveedor ni reescribe el
  territorio. La prueba de LP-3 comprueba que la ficha no escribe. Por eso la ficha muestra cuándo se
  sincronizó el contacto por última vez (`LP05-05`).
- **Lo que eso deja a la vista:** los **25** contactos congelados ya no se refrescan. Su ficha es la
  foto del último día que se vieron, y tiene que decirlo.

### LP05-04 · Nada de la ficha llega al navegador por `innerHTML`

- **Rastro:** toda la ficha es una plantilla de texto asignada a `innerHTML`
  (`aios-command-center_1.html:4788-4789` y `aios-command-center_1.html:4804-4863`).
- **Qué pide:** la ficha se dibuja con React, que escapa lo que muestra. El nombre, las respuestas del
  cuestionario, los nombres de campaña y de anuncio los escribió gente de afuera en un formulario o
  en Meta. Ningún valor del CRM se vuelve enlace: una dirección guardada en un campo se muestra como
  texto. Un enlace armado con un campo del CRM es una puerta a `javascript:`.

---

## 1 · El encabezado

### LP05-05 · Nombre, puntaje con su tramo, país, alta y sincronización

- **Rastro:** `aios-command-center_1.html:4787-4792`. Tres defectos:
  - la meta escribe `ICP ${l.icp}`, que para un contacto sin puntaje (`aios-command-center_1.html:4648`)
    sale «ICP null»;
  - el «cuándo» es un texto relativo inventado;
  - el estado sale de `STLBL` (`aios-command-center_1.html:4685-4686`), que tiene «Calificado» y «Perdido».
    El primero choca con la decisión de rótulos (`LP03-06`) y el segundo no tiene ninguna fuente.
- **Qué pide:**
  - **nombre**;
  - **puntaje y tramo**: «ICP 82 · ICP alto». **Un 0 se escribe «0, se cuenta como sin calificar»**
    y sin puntaje, «sin puntaje · sin calificar». Es la prueba de LP-3: el 0 viaja con su motivo;
  - **país**. Medido: **569** de 593 lo tienen;
  - **alta en el CRM**, con fecha absoluta y relativa. No es `creado_el`: `creado_el` es cuando lo vio
    nuestro barrido (`lib/datos/esquema.ts:403-416`);
  - **sincronizado el**, y para un congelado, que ya no se refresca;
  - **la marca de descartado**, con la etiqueta que lo descartó, si la hay.
- **No hay un «estado» de una palabra.** Hasta dónde llegó la persona lo dice el recorrido
  (`LP05-07`).

---

## 2 · Las acciones

### LP05-06 · Llamar con `tel:` y escribir con `mailto:`, atenuados si falta el dato, y sin GoHighLevel

- **Rastro:** tres botones (`aios-command-center_1.html:4806-4810`). «Llamar» y «Email» **no tienen
  manejador**. «GHL» abre la portada genérica de GoHighLevel, no el contacto
  (`aios-command-center_1.html:4865-4866`).
- **Qué pide:**
  - **Llamar** es un enlace `tel:` con el teléfono guardado, y **Escribir** un enlace `mailto:` con el
    correo. Los dos pasan el trabajo al dispositivo: la pestaña no manda nada;
  - sin el dato, el botón queda atenuado y dice por qué;
  - **no hay botón de GoHighLevel.** Es decisión del usuario del 2026-09-26, y la misma que ya se tomó
    en el Closer: el commit `bd26085` quitó «Ver en GHL» a pedido.

---

## 3 · El recorrido

### LP05-07 · Cinco pasos reales y un hueco: Entró, Llegó por, Agendó, Asistió, Compró, y el VSL declarado

- **Rastro:** la maqueta tiene cinco líneas (`aios-command-center_1.html:4813-4821`):
  - «Entró al sistema» (`aios-command-center_1.html:4815`);
  - «Vio el VSL» con un porcentaje inventado (`aios-command-center_1.html:4816`);
  - «Agendó la cita» con el closer (`aios-command-center_1.html:4817`);
  - «Asistió», que escribe «no asistió» a cualquiera que no tenga la marca, **incluso con la cita
    todavía por delante** (`aios-command-center_1.html:4818`);
  - «Compró» (`aios-command-center_1.html:4819`).
- **Qué pide, paso por paso:**
  1. **Entró:** la fecha de alta y «campaña · creativo» del **primer toque**
     (`atribucion_primera`).
  2. **Llegó por:** reemplaza a «Vio el VSL». Es `familiaDelRecorrido`
     (`lib/negocio/recorrido.ts:139-167`), con el título y la explicación de `ROTULOS`
     (`lib/negocio/recorrido.ts:68-94`). **Es el último toque** (`atribucion_ultima`), no el primero
     (`lib/negocio/recorrido.ts:12-15`), y el paso lo rotula así. El § 5.3 pide las dos atribuciones
     (`§ 5.3:251-252`), y «Entró» y «Llegó por» son esas dos.
  3. **Agendó:** la fecha de la primera cita alcanzable. Si todas sus citas están canceladas, el paso
     dice «agendó y canceló». Si sólo tiene citas congeladas, dice que tuvo cita y que ya no se
     refresca.
  4. **Asistió:** tres estados (asistió, no asistió, sin registrar), y nada cuando no hay cita
     cerrable (sin cita, sólo futuras, sólo canceladas o sólo congeladas), que es el `null` de
     `LP02-04`. Así una cita todavía por delante no sale «sin registrar». El plantón del calendario
     va como marca aparte y no se suma (`lib/negocio/citasAlcanzables.ts:105-109`). **Medido:** 0
     personas con asistencia registrada y 145 con cita pasada, no cancelada y sin registro. El 145
     es un techo: se midió sin el filtro de alcanzable (`LP02-04`). Con el predicado exacto, **77**.
  5. **Compró:** si hay una venta registrada, con su monto reportado. Un acuerdo sin pago se muestra
     como tal, «acordó comprar, todavía no pagó» (`lib/negocio/salidas.ts:96-98`), y no como compra.
     En los demás casos, «sin venta registrada». **Medido: 0 ventas.**
  6. **El VSL:** una línea de hueco declarado, con su fecha (`LP05-10`). No desaparece. Quien conoce
     la maqueta lo va a buscar, y si no está ni se dice por qué, la lectura razonable es que se rompió.
- El closer, que la maqueta pone en «Agendó», pasa a la sección de contacto (`LP05-16`).

---

## 4 · El cuestionario

### LP05-08 · «Formulario de la landing» se reemplaza por el grupo `calificacion`, sin denominador inventado

- **Rastro:** nueve preguntas inventadas y «8/8 campos» (`aios-command-center_1.html:4823-4828`). Para
  catorce de los quince contactos, las respuestas **se deducen del tramo**
  (`aios-command-center_1.html:4668-4671`): la facturación depende de `seg`. El cuestionario dice lo que el
  tramo ya decía, y parece confirmarlo.
- **Qué pide:**
  - **el grupo `calificacion` de `perfilDeLaFicha`** (`lib/negocio/ficha.ts:459`), agrupado por
    significado y no por formulario (`lib/negocio/ficha.ts:434-444`). Sus carpetas son tres
    (`lib/ghl/contrato.ts:318-326`): la del puntaje, «Score | ICP Nuevo» y «Score | ICP Lead Form
    (Meta)». Así entran las dos cosas que el § 5.3 pide por separado: las respuestas de Meta Lead Ads
    y las de la landing (`§ 5.3:253-254`);
  - **un campo vacío no se muestra.** `poner` ya lo descarta (`lib/negocio/ficha.ts:481-487`);
  - **sin «N de M».** Son dos formularios con preguntas distintas y casi nadie contesta los dos —6
    personas, medido en LP-3—: un «5 de 17» diría que faltan doce respuestas que la persona nunca tuvo
    delante;
  - **el puntaje aparece una sola vez**, en la sección de calificación. Hoy saldría dos veces: como
    «Calificación» (`lib/negocio/ficha.ts:502`) y como el propio campo del CRM, que vive en una de las
    carpetas del grupo (`lib/ghl/contrato.ts:319-322`);
  - **un campo sin grupo no aparece.** Es la prueba de LP-3. Medido: **174** campos del catálogo no
    tienen grupo, contra **17** del grupo `calificacion` en **3** carpetas;
  - los valores se muestran como texto (`LP05-04`).
- **Medido, con una advertencia:** **475** contactos tienen algún valor en el grupo `calificacion`.
  **Esa cifra es un techo, no la cobertura del cuestionario:** el grupo incluye el campo del puntaje,
  que por sí solo está en 471. **Medido en LP-3 (2026-09-27): 336 contestaron alguna pregunta**, 219
  el formulario de la landing y 123 el de Meta (`LP09-P02`).

### LP05-09 · El estado del «Form Landing VSL» va al lado, con su corte del 31 de agosto

- **Rastro:** la maqueta dice «Formulario completado» con un «8/8» (`aios-command-center_1.html:4858`).
- **Dónde está el dato:** en el campo `Form Landing VSL` (`lib/negocio/recorrido.ts:208`), con un
  vocabulario cerrado de tres valores (`lib/negocio/recorrido.ts:211-215`). **No está en el grupo
  `calificacion`:** vive en la carpeta vieja «Score | ICP», que quedó fuera del perfil a propósito
  (`lib/ghl/contrato.ts:262-265`). Se lee por nombre con `campoPorNombre`
  (`lib/negocio/camposDelCrm.ts:307-319`), como ya hace Conversion
  (`lib/negocio/recorrido.ts:234-245`).
- **Medido:** Agendado **121** · Form incompleto sin agendar **87** · Form completo sin agendar **39**
  · vacío **346**. **No se escribe desde el 2026-08-31**
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:16-20`).
- **Qué pide:** el valor, tal como lo escribe el CRM, con la fecha del corte al lado. El corte **se
  detecta, no se escribe en el código**: sale de `ultimoDiaDelFormulario`
  (`lib/negocio/recorrido.ts:219-245`). Un vacío de alguien que entró después del corte no quiere
  decir «no completó»: quiere decir que el campo ya no se escribe, y la ficha lo dice así.
- **Su «Agendado» es un estado del formulario, no la fuente del agendamiento.** Conversion lo midió:
  121 contactos con `Agendado` contra 47 con una cita alcanzable, y la diferencia son sobre todo
  citas congeladas (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:158-172`, CV14-09).
  El paso «Agendó» de `LP05-07` sale **siempre** de las citas (`tieneCitaAlcanzable`), nunca de este
  campo. Una ficha puede mostrar «Agendado» en el formulario y, en el recorrido, «tuvo cita y ya no
  se refresca». No es una contradicción, y el rótulo del formulario lo aclara: es lo que escribió el
  formulario, no si hay cita.

---

## 5 · El VSL y el precall

### LP05-10 · «Comportamiento en el VSL» es un hueco declarado, con su fecha

- **Rastro:** `aios-command-center_1.html:4830-4838` dibuja tres cosas:
  - el porcentaje visto;
  - «Llegó al CTA», que sale de una regla inventada: más de 60 % visto
    (`aios-command-center_1.html:4831`);
  - una línea de tiempo con minuto y segundo. Para catorce de los quince contactos esa línea **se
    fabrica con aritmética sobre el puntaje** (`aios-command-center_1.html:4677-4679`).
- **Qué dice el dato:** los dos campos de VTurb valen 0 en todos los contactos que los tienen, y no
  reportan desde el **2026-08-30** (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:16-20`).
  Está documentado en `docs/OTROS/estado actual/06-INTEGRACIONES-GHL.md`, § «Y el hallazgo que contradice
  lo que se creía». No existe ningún historial de eventos de reproducción, y el § 5.3 pide
  justamente eso: *«Debe conservarse su historial»* (`§ 5.3:265`). Tampoco existe un dato de «llegó
  al CTA».
- **Qué pide:** la sección se reemplaza por **una** línea de hueco, que sale de
  `huecosDelLeadsPortal.ts` con su `MEDIDO_EL`. Es el mismo patrón que `huecosDeSales.ts`
  (`lib/negocio/huecosDeSales.ts:39-46`). No va un «0 %»: los 0 de VTurb son de un medidor que no
  reporta, no de gente que no vio.

### LP05-11 · El video precall sí tiene dato, y se muestra como el texto del CRM

- **Rastro:** la maqueta lo pone como porcentaje dentro del bloque del VSL
  (`aios-command-center_1.html:4832`) y otra vez en interacciones (`aios-command-center_1.html:4681`).
- **Dónde está el dato:** en `Video Pre-Call` (`lib/negocio/consumoDelPrecall.ts:64`), dentro de la
  carpeta «Interacciones», que es del grupo `interacciones` (`lib/ghl/contrato.ts:327-329`).
- **Medido:** **222** contactos con valor y **371** vacíos. Por valor: Sin abrir (0%) 130 · Nada 50 ·
  76–100% 12 · 1–25% 11 · -20% 6 · 51–75% 4 · Accede: sin reproducir 3 · 26–50% 2 · 40-60% 2 · Clic a
  link 2.
- **Qué pide:**
  - el valor **como texto**, nunca convertido a número. Conviven dos escalas incompatibles
    (`lib/negocio/consumoDelPrecall.ts:87-92`);
  - «Nada» y «Sin abrir (0%)» se leen **«el CRM no registró reproducción»**, no «no vio el video».
    Son el valor inicial que el CRM escribe al agendar (`lib/negocio/consumoDelPrecall.ts:22-33`).
- El § 5.3 lo pide *«cuando exista tracking individual verificable»* (`§ 5.3:259`). Lo que hay es una
  categoría escrita por el CRM, no un porcentaje máximo, y la ficha lo presenta así. **El plan de
  LP-3 no lo nombraba.** Se agrega porque es un dato real que la maqueta ya tenía en pantalla. Ver
  `LP05-P01` para el resto del grupo.

---

## 6 · Las interacciones

### LP05-12 · Conteo y fechas de mensajes, sin su texto; y la lista de citas y la de resultados

- **Rastro:** cinco líneas escritas a mano para el primer contacto (`aios-command-center_1.html:4603-4607`)
  y cuatro de relleno para el resto (`aios-command-center_1.html:4680-4682`). Llevan un «sentimiento
  positivo» que no sale de ningún lado (`aios-command-center_1.html:4604`), un canal con nombre de
  persona, y **el nombre de un closer real** en «Llamada con…» (`aios-command-center_1.html:4607`).
- **Qué pide:**
  - **mensajes:** la fecha del último entrante y la del último saliente
    (`lib/datos/esquema.ts:380-382`). El conteo, sólo cuando la historia se leyó (`mensajes_desde_el`).
    Si no se leyó, la ficha dice «no se leyó su historia», no «nunca escribió»
    (`lib/datos/esquema.ts:384-390`). **Medido:** 305 con algún mensaje entrante, 484 con alguno
    saliente, 541 con la historia leída;
  - **sin el texto.** `ultimo_entrante_texto` (`lib/datos/esquema.ts:381`) no viaja. La conversación
    es del closer y del setter, que ya la ven en su pantalla; el portal cuenta y fecha;
  - **citas:** fecha, estado del calendario (confirmada, cancelada o plantón), si es alcanzable o
    congelada, y la asistencia registrada;
  - **resultados:** la salida por su nombre (`lib/negocio/salidas.ts:82-98`), la fecha y el monto si
    es una venta. **Medido:** 7 resultados en toda la base.
- El «sentimiento» no tiene fuente. No es un hueco: es andamiaje.

---

## 7 · Los parámetros de publicidad

### LP05-13 · Una lista blanca de claves del primer toque, con rótulos; de las direcciones, sólo el host

- **Rastro:** once campos y cuatro UTM (`aios-command-center_1.html:4846-4854`). Para catorce contactos,
  el relleno los fabrica (`aios-command-center_1.html:4672-4676`).
- **Qué pide:** `atribucion_primera` se guarda cruda *«y sin lista blanca»*
  (`lib/datos/esquema.ts:417-429`). Por eso la lista blanca va en la lectura, en
  `atribucionVisible.ts` (LP-3). Medido sobre los 593:

  | clave | rótulo | contactos |
  |---|---|---|
  | `sessionSource` | origen de la sesión | 552 |
  | `utmSource` | fuente | 510 |
  | `utmMedium` | conjunto, por nombre | 507 |
  | `utmContent` | creativo | 505 |
  | `utmTerm` | conjunto, identificador | 273 |
  | `campaign` | campaña | 271 |
  | `adId` | anuncio, con su nombre si cruza | 213 |
  | `utmKeyword` | palabra clave | 49 |
  | `url` | **sólo el host** | 331 |
  | `referrer` | **sólo el host** | 66 |

  Notas sobre la tabla:
  - `utmMedium` es un nombre, no un id, y un renombre en Meta parte la serie. Acquisition pide
    decirlo en pantalla (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93`);
  - `utmTerm` es el identificador del conjunto (`lib/datos/esquema.ts:947`);
  - `adId` se nombra con `negocio.anuncios` (`lib/datos/esquema.ts:944-954`). **Medido: 213 de 213
    cruzan.**
- **Sólo el host.** **286** direcciones traen un token: un JWT, un `fbclid` o un `token=`. Es lo que
  pide A8-18 (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:239`). Hosts medidos:
  accelerator.ariaia.com 292 · api.leadconnectorhq.com 15 · calls.ariaia.com 10 · el resto, 4 o menos.
- **Nunca viajan:** `ip` (331), `userAgent` (331), `fbclid` (286), `fbp` (69), `fbc` (66),
  `gaClientId` (41), ni una clave desconocida. Es la prueba de LP-3, que usa un JWT de ejemplo.
- **Tampoco viajan hoy, porque la lista es blanca y no negra:** `medium` (552), `mediumId` (548),
  `campaignId` (358) y `adSource` (214). Ver `LP05-P02`.
- **El host se saca con una sola definición.** Es `hostDe` (`lib/negocio/recorrido.ts:306-315`),
  que LP-3 exportó recibiendo la columna y la clave. `hostDeLaUltima`, que era privada y estaba atada
  a `atribucion_ultima ->> 'url'`, pasó a llamarla (`lib/negocio/recorrido.ts:125-127`) y produce el
  mismo SQL, carácter por carácter. Si la ficha sacara el host por su cuenta, el sistema tendría dos
  ideas de qué es un host.

### LP05-14 · Lo que la maqueta dibuja y no existe se declara como hueco, no se deja en blanco

- **Rastro:** los campos de `aios-command-center_1.html:4847-4851`, que para catorce contactos inventa el
  relleno (`aios-command-center_1.html:4672-4676`).
- **Qué pide, campo por campo:**

  | campo de la maqueta | qué es hoy | rastro |
  |---|---|---|
  | Ubicación · Posición | **hueco**: el placement no llega de ningún lado | A8-29, `docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:304` |
  | Costo del lead | **hueco**: el costo es por anuncio y por día (`lib/datos/esquema.ts:1036-1044`); repartirlo entre personas es un modelo, no un dato. La maqueta lo calcula con el puntaje (`aios-command-center_1.html:4674`) | — |
  | Dispositivo · Ciudad | **hueco**: están dentro de `userAgent` e `ip`, que no se muestran. Acquisition pide derivarlos y no mostrarlos (A8-17). La maqueta elige el dispositivo por la paridad del puntaje (`aios-command-center_1.html:4673`) | `docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:238` |
  | Plataforma | **no es un dato aparte**: lo dice `sessionSource`. No se inventa «Meta» | — |
  | Objetivo | **no se muestra hoy**: el objetivo del anuncio existe en `negocio.anuncios` (`lib/datos/esquema.ts:951-952`). Ver `LP05-P02` | — |
  | Punto de captura | **se reemplaza** por el host de `url` y por «Llegó por» (`LP05-07`) | A8-18 |
  | Conjunto · Creative · UTM | **dato real**, por la lista blanca (`LP05-13`); «Creative» es el **nombre** del anuncio, no la pieza (ver la nota) | A8-07, `docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93` |

  **Una diferencia con Acquisition, dicha:** A8-29 da el creativo por inexistente
  (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:304`) porque habla de la pieza: el formato y el
  *Creative Profile*, que no llegan de ningún lado. Lo que esta ficha muestra en «Creative» es el
  nombre que viene en `utmContent`, que A8-07 (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93`)
  llama anuncio y que Creative usa como llave (`lib/negocio/calidadDelCreativo.ts:198`). El rótulo
  no promete más que eso.

  Los huecos salen de `huecosDelLeadsPortal.ts` con su fecha: el VSL, fit e intent, ubicación,
  posición, costo por lead, dispositivo y ciudad.

---

## 8 · La calificación

### LP05-15 · El puntaje con su tramo y quién lo calcula; fit e intent son huecos

- **Rastro:** «ICP Score», «Fit score», «Intent score» y «Formulario completado»
  (`aios-command-center_1.html:4856-4859`). Fit e intent son números inventados para cada contacto; a los
  que no tienen puntaje la maqueta les pone 0 (`aios-command-center_1.html:4651`).
- **Qué pide:**
  - **el puntaje**, que es «Puntaje | ICP» del CRM (`lib/ghl/contrato.ts:268-305`), con su tramo;
  - **quién lo calcula:** el rótulo dice que lo calcula el CRM, no Comando Central. El ICP calculado
    por Comando Central es futuro (`docs/OTROS/futuro/icp-interno-calculado.md`);
  - **el 0**, con su motivo: *«No se sabe si el CRM calculó cero o si su workflow no corrió»*
    (`lib/negocio/sincronizar.ts:412-420`);
  - **la etiqueta de descarte**, si la tiene. Medido con `icp_rechazado`: bajo 45 · medio 22 · sin
    calificar 1 · alto 0;
  - **«Formulario completado»** pasa a ser el estado del `Form Landing VSL` (`LP05-09`);
  - **fit e intent:** una línea de hueco. No existen en ninguna tabla ni en ningún campo.

---

## 9 · El contacto

### LP05-16 · Teléfono y correo sólo acá; el closer asignado por su nombre, nunca por su id

- **Rastro:** «Teléfono», «Email» y «Closer asignado» (`aios-command-center_1.html:4861-4863`). El closer
  de la maqueta es, en varios contactos, **el nombre de un closer real**
  (`aios-command-center_1.html:4593`, `aios-command-center_1.html:4610`, `aios-command-center_1.html:4626` y
  `aios-command-center_1.html:4630`). Es andamiaje y se borra con ella (`10-LO-QUE-NO-ES-UN-REQUISITO.md`).
- **Qué pide:**
  - **teléfono y correo, sólo en la ficha.** Es la decisión del 2026-09-26, y la ruta del detalle es
    la única que los trae (LP-4). La respuesta sale con `no-store`, como toda respuesta con datos de
    un inquilino (`lib/autorizacion/respuesta.ts:314-316`);
  - **el closer asignado:** `crm_asignado_a` es el usuario del CRM, crudo
    (`lib/datos/esquema.ts:359-369`). Se cruza con `closersDeLaEmpresa`
    (`lib/negocio/alcanceDelCloser.ts:77-95`) por `crmUsuarioId`. Si cruza, se muestra el nombre.
    Si no cruza, «asignado en el CRM a alguien que no es un closer configurado». Si no hay
    asignación, «sin asignar en el CRM». **El id crudo no se muestra nunca.** Un closer designado y
    sin vincular tiene `crmUsuarioId` nulo (`lib/negocio/alcanceDelCloser.ts:59-60`) y no puede
    cruzar;
  - **Medido:** **253** contactos tienen `crm_asignado_a`, y **252** cruzan con alguno de los **3**
    closers configurados.
- **Lo que el § 5.3 lista y la ficha no muestra:** `lead_id` y `ghl_contact_id` (`§ 5.3:246-247`). Son
  identificadores. Sirven para enlazar, y no hay enlace (`LP05-06`); no son algo para leer.

---

## 10 · Preguntas abiertas

### LP05-P01 · ¿Se muestran los otros tres campos del grupo `interacciones`?

La carpeta «Interacciones» tiene cuatro campos: la confirmación de asistencia, el video precall y las
dos preguntas de la llamada (`lib/ghl/contrato.ts:327-329`). Medido: el grupo tiene **4** campos en
**1** carpeta. `LP05-11` toma el precall. Los otros tres ya se muestran en la ficha del closer. En el
portal completarían el recorrido: la confirmación de asistencia es justo lo que le falta al paso
«Asistió». Pero LP-0 no midió su cobertura, y el plan de LP-3 no los nombra.

### LP05-P02 · ¿Entran `medium`, `campaignId` y el objetivo del anuncio a la lista blanca?

Ninguno es un dato personal. `medium` está en 552 contactos y `campaignId` en 358. El objetivo existe
para los 213 contactos cuyo `adId` cruza con `negocio.anuncios`; cuántos lo traen cargado no se midió,
y la columna puede ser nula (`lib/datos/esquema.ts:951-952`). Quedaron afuera porque la lista del plan
es la mínima que llena la ficha de la maqueta. `campaignId` sólo serviría para cruzar, y hoy
`negocio.anuncios` no guarda el nombre de la campaña, sólo su id (`lib/datos/esquema.ts:944-954`).
`medium` y el objetivo sí llenarían dos filas que la maqueta tiene: «Plataforma» y «Objetivo».
Para el objetivo, es la misma pregunta que `LP09-P04` (`09-DE-DONDE-VIENE-CADA-DATO.md`), y se
contesta una sola vez.

### LP05-P03 · ¿La ficha muestra las etiquetas crudas del CRM?

`perfilDeLaFicha` las pone en el grupo «origen» (`lib/negocio/ficha.ts:503-505`). Esta ficha sólo
muestra la de descarte (`LP05-05`). Las crudas explican casos raros, como por qué alguien está donde
está. Pero son vocabulario interno del CRM, y en una pestaña que ve más gente que el closer quizás no
corresponde.
