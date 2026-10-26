# Creative — el front original del prototipo, con los datos reales

> Requisitos del **2026-10-11**, pedidos por el usuario: volver la pestaña Creative al front del prototipo
> (`aios-command-center_1.html`), llenado con lo que el sistema ya mide, como se hizo con Acquisition, Conversion, Sales
> y Conversation. Prefijo `CF1-`; las etapas son `CF-0` a `CF-5` (`CR-` lo usa `15-LA-MINIATURA-Y-EL-VIDEO.md`).
> Mismo formato que el resto de la carpeta: Qué es / Fórmula / Rastro / Estado. Desde el primer día rige la regla
> de la segunda ronda de Sales (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, `S15-18`): es un tablero; las
> explicaciones las da el agente de Creative.

---

## 1 · Lo que se decidió

**El usuario, el 2026-10-11:**

| tema | decisión |
|---|---|
| «Funciona / No funciona» | los dos grupos del prototipo, pero **cada pieza contra el promedio de SU etapa** (TOFU, MOFU, BOFU), y la tarjeta muestra la etapa |
| «Calificados» | los contactos de **ICP alto**: puntaje de 75 o más, el tramo «alto» de `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85@ddba683`) |
| La miniatura | el **«Video Url» de la primera atribución** del contacto, medido y usado: la imagen en la tarjeta y en la ficha; el clic abre Facebook o Instagram |
| Completar la atribución | **una pasada con tope**: hasta 50 contactos por pasada, primero los más recientes, con `GET /contacts/{id}`; se activa al subir |
| Los bloques de la pantalla anterior | **como Sales**: abajo «Lo demás, en cifras»; la fatiga además como marca en la tarjeta; el detalle por pieza en la ficha |

**Por qué contra la etapa.** Con un solo promedio, la pieza BOFU —la que habla con quien ya conoce la oferta— levanta
la vara y manda a «pausar o iterar» a las TOFU, que traían el 65 % del volumen en la medición de septiembre
(`03-LA-BIBLIOTECA.md`, `C3-05`). La etapa sale del nombre de la campaña (`etapaDelNombre`,
`lib/negocio/creativo.ts:79`), como ya hacían la pantalla anterior y el detector (`CRE-ICP-POR-PIEZA`).

---

## 2 · El mapa, y lo que se midió

### Del prototipo al dato

| lugar del prototipo | dato | fuente | estado |
|---|---|---|---|
| Encabezado: «Creative», «Qué funciona, qué no, y por qué», «Plan de acción», el segmentado | el título, la bajada, el plan real del detector y los cuatro períodos | `BotonDelPlan`, `lib/negocio/periodo.ts` | real |
| Tira: Calificados | contactos de ICP alto que trajo cada pieza, sumados | `calidadDelCreativo` (`lib/negocio/calidadDelCreativo.ts:142`) más el tramo | real |
| Tira: Agendas | contactos que agendaron | `calidadDelCreativo` | real |
| Tira: Hook rate | `videoView` sobre impresiones, con su piso | `rendimientoDelCreativo` (`lib/negocio/rendimientoDelCreativo.ts:325`) | real |
| Tira: Retención | — | sin fuente por esta vía (`lib/negocio/rendimientoDelCreativo.ts:147`) | «—» |
| Tira: Alcance | **impresiones** (desvío) | `rendimientoDelCreativo` | real |
| Tira: Frecuencia | impresiones sobre alcance, pesada por impresiones | `metricas_de_anuncio`, como `frecuenciaPorAnuncio` (`lib/agentes/detectores/creative.ts:144`) | real |
| Barra «Ordenar por» | Calificados, Agendas, Hook rate, Impresiones | el servidor | real |
| Grupos «Funciona» / «No funciona» | contra el promedio de la etapa | el servidor | real |
| Tarjeta: miniatura | `videoUrl` de la primera atribución | `negocio.miniaturas_del_contacto`, completada con `GET /contacts/{id}` | real desde CF-1 |
| Tarjeta: «Activo / Pausado» | **«Entregando» / «Sin entrega»** (desvío) | impresiones en los últimos 3 días | real |
| Tarjeta: formato y ángulo | **la etapa** (desvío) | `etapaDelNombre` | real |
| Ficha | la pieza abierta | todo lo de arriba, más el gasto, el CTR, el link CTR, la landing y los anuncios | real o «—» |
| Modal de recomendaciones | el plan real del detector | `lib/agentes/plan/creative.ts` | real |

### La medición del 2026-10-11 (producción, sólo lectura, sólo conteos, con el OK del usuario)

Con `scripts/supabase.mjs leer`, sobre la organización de la empresa:

- **El «Video Url» no está en la base.** De 597 contactos, **0** tienen `videoUrl` en `atribucion_primera`; tampoco
  `postId` ni `igSid`. `adId` está en 215 y `utmContent` en 508. Hay **32 piezas** en toda la historia y 9 a 30 días,
  ninguna con una URL.
- **Desde el 2026-09-30 entraron 14 contactos**, casi todos de la campaña de mensajes de Instagram: traen
  `sessionSource`, `medium` y `mediumId`, y sólo uno `adId`.
- **El último día con impresiones de Meta es el 2026-10-05.**

Con tres llamadas `GET` a GoHighLevel, también con el OK del usuario, que imprimieron sólo nombres de campos y hosts:

- **`GET /contacts/{id}` sí trae el «Video Url»**: el contacto más reciente con anuncio devuelve en
  `attributionSource` las claves `videoUrl` (host `www.facebook.com`), `photoUrl` (vacía en ese caso), `postId`,
  `igSid`, `campaign`, `adId` y `mediumId`. El contacto de la campaña de mensajes no las trae.
- **`POST /contacts/search`, que es lo que usa la sincronización** (`lib/ghl/cliente.ts:288`), no las devuelve. Por eso
  la ingesta, que guarda toda clave escalar sin lista blanca (`lib/ghl/cliente.ts:215-225`,
  `lib/negocio/sincronizar.ts:485-490`), no tiene nada que guardar. No es la primera diferencia entre las dos
  respuestas: en los campos del CRM, la búsqueda trae 24 valores y el pedido por contacto 27 (`lib/ghl/cliente.ts:147-148`).

**Consecuencia:** la miniatura necesita una pasada que complete la atribución con `GET /contacts/{id}`
(`contactoPorId`, `lib/ghl/cliente.ts:545`). Es la decisión de la tabla de arriba.

**La pasada, medida** (medido el 2026-10-11 a las 22:10 UTC, con una lectura de sólo conteos y el OK del usuario: la pasada llevaba **413 contactos pedidos** en unas ocho corridas —406 devueltos, 7 no—, **159 pendientes**, y **sólo 3 con imagen**, los tres con «Video Url» en `www.facebook.com` y de **una sola pieza**; ninguna de más de 500 caracteres). **El «Video Url» es raro**: GoHighLevel lo devuelve en muy pocos
contactos, así que casi todas las piezas van a mostrar «Sin miniatura todavía.».

**Por qué tan pocas.** Medido el 2026-10-11 sobre los 456 contactos que la pasada ya había pedido (sólo conteos, con el OK del usuario): GoHighLevel adjunta la imagen del anuncio —el «Video Url», con `postId` e `igSid`— **sólo cuando el contacto entra desde un anuncio de Instagram** (3 de 3, de una campaña MOFU). Los que llegan por el formulario de un anuncio de Facebook —198, todos de anuncios de video TOFU— no la traen; tampoco los que sólo traen `mediumId` —unos 255 de formularios externos y del calendario, cuyo `mediumId` es el del formulario, no el de un anuncio— ni los 8 de Instagram sin anuncio. No depende del mes: las tres imágenes son de agosto, septiembre y octubre. Con eso, el mismo día: la pasada pide sólo los contactos con `adId` —sin él no
llegó ninguna imagen, y cada contacto de formulario costaba un pedido—, y la miniatura de las piezas de Facebook queda
para Meta directo, **postergado por el usuario** el 2026-10-11.

---

## 3 · Los requisitos

### CF1-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo y en su orden: `cre-head`, `cre-stats`, `filterbar`,
los dos `ghead` con su rejilla `cg` de tarjetas `cc`, y la ficha `aside.drawer`. La sección **no lleva `estetica-op`**,
y `#v-creative` sale de `app/inteligencia-estetica.css`, que con eso queda sin nadie que la use y se borra.

**Fórmula** · Lo nuevo va en `app/creative.css`, acotado a `#v-creative` y a `.cr-ficha` para la ficha, que se monta
en `document.body`. **Las reglas del prototipo que faltan se restituyen ahí**: `.cre-stat`, `.cg`, `.cc*`, `.cc-mx`,
`.qb` y `.dw-verdict` se retiraron de `app/aios.css` el 2026-09-19, cuando nadie las dibujaba (también `.tr-line`, que no
vuelve: no hay guion que dibujar). Salen del CSS
en línea del prototipo (`aios-command-center_1.html:558-985`), con los colores pasados a tokens y sin sombras.

**Rastro** · El prototipo: `aios-command-center_1.html:2746-2804`. La pantalla anterior: `components/views/CreativeView.jsx:47@1971ab2`.

**Estado** · Construido el 2026-10-11 (CF-3): `components/creative/PanelDeCreative.jsx`, `components/creative/FichaDelCreativo.jsx`, `components/creative/Miniatura.jsx` y `app/creative.css`;
`components/views/CreativeView.jsx` sin `estetica-op`, y `app/inteligencia-estetica.css` borrada con su import. Prueba `pruebas/codigo/254-la-pantalla-de-creative.test.ts`.

### CF1-02 · Frases cortas, de una lista cerrada

**Qué es** · Los huecos y los estados usan **sólo** estas frases:

| situación | texto |
|---|---|
| cifra o tasa sin dato | «—» |
| el click-to-landing con menos de 10 clics al enlace | «Pocos casos para una tasa.» |
| una acción que GoHighLevel nunca reportó para la pieza (vistas de video en una imagen, la frecuencia sin alcance) | «GoHighLevel no lo reportó.» |
| una tasa sobre impresiones con menos de 1000 | «Pocas impresiones para una tasa.» |
| una pieza sin impresiones en la ventana | «Sin entrega en esta ventana.» |
| lo que GoHighLevel no entrega: la retención, el formato, el ángulo, la duración, el dolor, el guion | «GoHighLevel no lo entrega.» |
| el CRM sin el campo del cuadrante del ICP (desde la `105`; antes, sin el del puntaje) | «El CRM no tiene el campo del cuadrante.» |
| una pieza sin «Video Url» guardado | «Sin miniatura todavía.» |
| la fatiga sin veredicto | «Sin días suficientes para medir el gancho.» |
| sin contactos en la ventana: la cohorte, o una pieza que no trajo ninguno | «Sin contactos en este período» |
| un grupo sin piezas | «Sin piezas en este grupo.» |
| una pieza que es la única de su etapa con valor: va a «Funciona» sin contra quién compararse | «Única de su etapa.» |
| la primera carga | «Cargando…» |
| la lectura falló | «No se pudo leer. Reintenta.» |

**Los desvíos de rótulo, declarados** ·

| en el prototipo | acá | por qué |
|---|---|---|
| «Alcance» | «Impresiones» | GoHighLevel entrega el alcance por día; sumarlo cuenta varias veces a la misma persona |
| «Activo» / «Pausado» | «Entregando» / «Sin entrega» | no se sabe si alguien la pausó; se sabe si tuvo impresiones en los últimos 3 días |
| las etiquetas de formato y ángulo | la etapa: TOFU, MOFU, BOFU o «Sin etapa» | formato y ángulo no tienen fuente (`14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`) |
| «07 — Owner Hook» | el nombre de la pieza | la pieza no tiene número: es el nombre del anuncio |
| «sobre el promedio de {valor} {unidad}» | «sobre el promedio de su etapa» | cada pieza se compara con su etapa |
| «Publicado» | «Primer día con entrega» | no se sabe cuándo se publicó; se sabe cuándo empezó a entregar |
| «Datos del video» | «Datos de la pieza» | la pieza puede no ser un video |
| «Retención del video» y «Guión del video» | «Retención y guion», en «—» | GoHighLevel no entrega ninguna de las dos |
| «venta directa», al lado de «Datos del video» | nada | es el modelo de negocio de la maqueta, no un dato |
| el ▶ / ◧ de la miniatura | nada | no se sabe si la pieza es un video o una imagen |
| «últimos 7 días», «último mes», «histórico» al lado de «{N} piezas» | «hoy», «últimos 7 días», «últimos 30 días», «histórico» | los cuatro períodos del sistema |
| la tira de a tres columnas desde 1180 px | de a seis hasta 760 px | es lo que dibujaba el prototipo: su `.even` le gana a su propio `@media` |
| Formato, Ángulo, Duración y Dolor de «Qué es», con su valor | «—», con la frase en el `title` | la caja es de un renglón; «Retención y guion» la dice entera |
| «Recomendaciones y conclusiones» | «Plan de acción» | es el plan real del detector, con sus grupos |

**Estado** · Construido el 2026-10-11 (CF-3): la lista vive en `FRASE` de `components/creative/comun.jsx`, y la
prueba `pruebas/codigo/254-la-pantalla-de-creative.test.ts` exige que las dos coincidan en las dos direcciones y que cada motivo del servidor tenga la suya.

### CF1-03 · El encabezado

**Qué es** · «Creative» y «Qué funciona, qué no, y por qué». En `.ch-r`, el «Plan de acción» real (CF1-14) y el
segmentado con los cuatro períodos del sistema, sin «Personalizado» ni la clave `mes`.

**Estado** · Construido el 2026-10-11 (CF-3), en `components/creative/PanelDeCreative.jsx`.

### CF1-04 · Los períodos y el piso

**Qué es** · Hoy · 7 días · 30 días · Completo, con 30 días por omisión. Creative cuenta días del calendario anclados a
`current_date`, **con hoy incluido** (`ventanaDeMetricas`): no son días cerrados como los de Acquisition. Toda tasa lleva su
piso: 10 clics al enlace para el click-to-landing (`PISO_DE_UNA_TASA`) o 1000 impresiones
(`PISO_DE_IMPRESIONES`, `lib/negocio/rendimientoDelCreativo.ts:70`). Bajo el piso, «—» con su frase.

**Estado** · Construido el 2026-10-11 (CF-1): `sobreImpresiones` de `lib/negocio/lecturaDeCreative.ts`.

### CF1-05 · Sin párrafos en la pantalla

**Qué es** · Cifras con su rótulo y, debajo de un «—», una línea de CF1-02. No se dibujan la cobertura del puente
nombre↔anuncio, los avisos, las ventanas de cada fuente ni la lista de lo que no se puede medir. Viajan igual en la
respuesta y en las herramientas del cerebro: el agente de Creative es quien explica. Lo que haría falta para medir
cada «—» está en `docs/OTROS/futuro/lo-que-creative-no-mide.md`.

**Estado** · Construido el 2026-10-11 (CF-3): el panel no lee `calidad`, `rendimiento` ni `fatiga`, sólo la `pantalla`
armada. La prueba `pruebas/codigo/254-la-pantalla-de-creative.test.ts` lo vigila.

### CF1-06 · La tira de cifras

**Qué es** · Las seis celdas del prototipo, en su orden: Calificados, Agendas, Hook rate, Retención, Impresiones y
Frecuencia. Las dos primeras son sumas; Hook rate y Frecuencia, el promedio pesado de todas las piezas, no el promedio
de los promedios; Retención, «—». La celda del criterio de orden elegido lleva la marca `.hi` del prototipo.

**Fórmula** · Calificados: los contactos de la pieza con `tramoDelPuntaje` alto, sobre el mismo puntaje que lee
`calidadDelCreativo` (el campo «Puntaje | ICP», `CAMPO_DE_ICP`, `lib/negocio/calidadDelCreativo.ts:65@bf2de85`). Hook rate: la
suma de `videoView` sobre la suma de impresiones de los anuncio-días con la clave. Frecuencia: impresiones sobre
alcance, pesada por impresiones como `frecuenciaPorAnuncio` (`lib/agentes/detectores/creative.ts:144-169`).

**Estado** · El cálculo, construido el 2026-10-11 (CF-1), en `armarCreative`; el dibujo, el mismo día (CF-3), en `components/creative/PanelDeCreative.jsx`.

### CF1-07 · Ordenar por

**Qué es** · El menú «Ordenar por» del prototipo con cuatro criterios: Calificados, Agendas, Hook rate e Impresiones.
Retención no ordena: no tiene dato. Al lado, «{N} piezas · {período}».

**Fórmula** · El servidor arma, para cada criterio, los dos grupos y su orden; el navegador elige cuál dibujar y **no
ordena nada**.

**Estado** · El cálculo, construido el 2026-10-11 (CF-1), en `armarCreative`; el dibujo, el mismo día (CF-3), en `components/creative/PanelDeCreative.jsx`.

### CF1-08 · «Funciona» y «No funciona», contra la etapa

**Qué es** · Para el criterio elegido, una pieza «funciona» si su valor llega al promedio de las piezas de su etapa con
valor; si no llega, o no tiene valor, «no funciona». Las piezas «Sin etapa» se comparan entre sí. Los dos grupos van de
mayor a menor.

**Fórmula** · El promedio de cada etapa es el pesado (la suma de los numeradores sobre la suma de los denominadores)
para las tasas, y el simple para los conteos. Una etapa con una sola pieza con valor no tiene contra quién compararse: la pieza va
a «Funciona» con la línea «Única de su etapa.» —frase de CF1-02, la respuesta por defecto de `CF1-P03`—.

**Estado** · Construido el 2026-10-11 (CF-1): `agrupar`, en `lib/negocio/lecturaDeCreative.ts`, arma los dos grupos de cada criterio con su promedio por etapa y las piezas únicas de su etapa. **Desde el nivel 3** (C5 · G1, en local), con piezas de dos clientes o más cada pieza se compara con las de su etapa EN SU CLIENTE —como la señal del ICP—, y la única es la única de su etapa en su cliente; `promediosPorCliente` trae esos promedios y `promedioPorEtapa` queda como el de todas. Con un cliente, lo de siempre.

### CF1-09 · La tarjeta de pieza

**Qué es** · La tarjeta `cc` del prototipo: la miniatura 16:9 (CF1-12) con su estado, «Entregando» o «Sin entrega»; el
nombre de la pieza; la etiqueta de la etapa; las seis métricas de la tira, por pieza; y la marca «Perdiendo gancho»
cuando la fatiga tiene veredicto y la pieza está fatigada. Al tocarla se abre la ficha.

**Fórmula** · «Entregando»: la pieza tuvo impresiones en alguno de los últimos 3 días. La fatiga sale de
`fatigaDelCreativo` (`lib/negocio/fatigaDelCreativo.ts:133`): `fatigado === true`. En la tarjeta, una cifra en «—» lleva su
frase en el `title` y no debajo: la celda mide 50 px, como en el prototipo, y la línea no entra; la ficha la dibuja
debajo.

**Estado** · El cálculo, construido el 2026-10-11 (CF-1), en `armarCreative`; el dibujo, el mismo día (CF-3), en `components/creative/PanelDeCreative.jsx`. **Desde el nivel 3** (C5 · G1, en local), la pieza es (cliente, nombre): se dibuja su `nombre`, y con piezas de dos clientes o más el cliente va en una línea propia debajo, con puntos suspensivos —en la fila de las etiquetas lo recortaban la etapa y «Única de su etapa.»—; el `title` del nombre dice «nombre · cliente». Con un cliente, la tarjeta es la de siempre.

### CF1-10 · La ficha de la pieza

**Qué es** · El `aside.drawer` del prototipo, con su veredicto («✓ Funciona…» o «✕ Bajo en…», contra la etapa) y estas
secciones:

| sección | qué lleva |
|---|---|
| La pieza | la miniatura grande, «Ver en Facebook/Instagram» si hay `videoUrl` o enlace manual, y el editor del enlace manual de hoy (desde el nivel 3, el de la pieza en su cliente, y sólo en un cliente que la sesión ve) |
| Qué es | Etapa, Estado, Anuncios, Primer día con entrega, Último día con entrega, Pieza (y Cliente, con piezas de dos clientes o más); Formato, Ángulo, Duración y Dolor en «—» |
| Datos de la pieza | las seis de la tira, más el gasto, el CTR, el link CTR, la landing y el click-to-landing |
| Retención y guion | «—» con «GoHighLevel no lo entrega.» |
| Los anuncios | los anuncios de la pieza, por impresiones (`anunciosDeLaPieza`, `lib/negocio/rendimientoDelCreativo.ts:270`) |

Conserva lo que la ficha anterior ya resolvía: el portal en `document.body`, el foco y Escape
(`components/creative/FichaDelCreativo.jsx`). Desde CF-4, además, el foco vuelve a la tarjeta al cerrar, el tabulador no
sale del cajón y Escape dentro del campo del link no cierra.

**Estado** · El cálculo, construido el 2026-10-11 (CF-1), en `armarCreative`; el dibujo, el mismo día (CF-3), en `components/creative/FichaDelCreativo.jsx`.

### CF1-11 · Completar la atribución

**Qué es** · Una pasada que pide `GET /contacts/{id}` a GoHighLevel y guarda en `negocio.miniaturas_del_contacto` las
claves que `POST /contacts/search` no trae: `videoUrl`, `photoUrl`, `postId` e `igSid`.

**Fórmula** · Sólo contactos con anuncio (`adId` en la atribución; hasta el 2026-10-11 también `mediumId`, ver § 2) a los que les falta la clave y que no
se intentaron todavía; **hasta 50 por pasada**, primero los más recientes; cada contacto se guarda una sola vez, y lo
guardado no se pisa. Un contacto que GoHighLevel no devuelve —un 404, o un rechazo de ese contacto como un 403— se marca
para no volver a pedirlo en cada pasada. La pasada se corta, y lo que faltó se pide en la siguiente, ante un 429, un
401, un GoHighLevel que no contesta o el tiempo: cada pedido espera hasta 15 segundos y la pasada entera hasta 60, para
no comerse el tiempo de `mensajes` y `auditoria`, que van después en la misma corrida (CF-4). Ninguna llamada real en la suite:
la prueba simula el cliente.

**Estado** · Construido el 2026-10-11 (CF-1): `lib/negocio/miniaturaDelContacto.ts` (`completarMiniaturas`), colgado de la
tarea `contactos` del barrido (`lib/negocio/barrido.ts`), que corre cada diez minutos. Lo que vuelve se guarda en
`negocio.miniaturas_del_contacto` —migración `077`— y no en `atribucion_primera`, porque la sincronización la pisa en cada
pasada. Un 429 o una credencial rechazada cortan la pasada, y el sello de la tarea lo dice. Prueba
`pruebas/base/253-la-miniatura-del-contacto.test.ts`, con GoHighLevel simulado. **Se activa al subir, con el OK del
usuario, y la `077` va a producción antes del push.**

### CF1-12 · La miniatura

**Qué es** · La imagen de la pieza en la tarjeta y en la ficha. Al tocar «Ver en Facebook/Instagram», el link se abre
en una pestaña nueva. Sin `videoUrl`, el fondo del prototipo con «Sin miniatura todavía.».

**Fórmula** · De los contactos de la pieza, la imagen más frecuente —el `videoUrl`, o el `photoUrl` si no hay—; empate,
la del contacto que entró más tarde al CRM. Se valida con las dos listas de hosts de `lib/negocio/urlExterna.ts` —la de
publicaciones (`enlaceDePublicacion`) y la del CDN de Meta (`medioPermitido`)—, con el tope de largo de la tabla (2000);
un host fuera de las listas no viaja. En el
navegador, `<img>` con `referrerPolicy="no-referrer"` y `loading="lazy"`; si la imagen no carga, el fondo del
prototipo, sin romper la tarjeta.

**Estado** · La elección, construida el 2026-10-11 (CF-1): `miniaturasDeLasPiezas`, en `lib/negocio/miniaturaDelContacto.ts`. El
dibujo, el mismo día (CF-3): `components/creative/Miniatura.jsx`, en la tarjeta y en la ficha.

### CF1-13 · Lo demás, en cifras

**Qué es** · Lo que la pantalla anterior medía y el prototipo no tenía, en una fila de cifras debajo de los grupos: el
gasto total, el CTR, el link CTR, la landing y las piezas perdiendo gancho sobre las que tienen veredicto.

**Estado** · El cálculo, construido el 2026-10-11 (CF-1), en `armarCreative`; el dibujo, el mismo día (CF-3), en `components/creative/PanelDeCreative.jsx`.

### CF1-14 · El plan de acción y las señales

**Qué es** · «Plan de acción» abre el plan real de la pasada de la mañana (`BotonDelPlan`,
`components/senales/SenalesDelDepartamento.jsx`): el de 7 días con «7 días» y el de 30 con «30 días»; con «Hoy» y
«Completo» no hay plan, y el botón lo dice. La tarjeta de señales queda al final de la pestaña, como en Conversion.

**Estado** · Construido el 2026-10-11 (CF-3), en `components/creative/PanelDeCreative.jsx`.

### CF1-15 · El servidor calcula; el navegador dibuja

**Qué es** · Una sola lectura nueva, `lecturaDeCreative`, compone `calidadDelCreativo`, `rendimientoDelCreativo`,
`fatigaDelCreativo` y `enlacesDeLasPiezas`, más los calificados por pieza y la miniatura, y entrega lo que la pantalla
arma, **de 0 a 1**, con el motivo de cada «—». Tiene una mitad pura, probada sin base, y otra que lee, como
`lib/negocio/lecturaDeConversation.ts`. La ruta `app/api/creative/route.ts` suma `pantalla`; los bloques de antes siguen
viajando. El navegador multiplica por 100 en un solo lugar.

**Estado** · La lectura, construida el 2026-10-11 (CF-1): `lib/negocio/lecturaDeCreative.ts`, con `armarCreative` pura y `entregaDeLasPiezas`, que
lee la entrega de cada pieza —impresiones, clics y acciones de la ventana sobre los anuncio-día con cada clave, la
frecuencia pesada, la etapa de la campaña con más impresiones y los días con entrega de toda la historia—. Los
calificados salen de `calidadDelCreativo` (`calificados`). Pruebas `pruebas/codigo/252-lectura-de-creative.test.ts` y
`pruebas/base/252-lectura-de-creative.test.ts`. La ruta, construida el 2026-10-11 (CF-2): `app/api/creative/route.ts` lee
`lecturaDeCreative(periodo.dias)` y publica `pantalla`; `calidad`, `rendimiento`, `fatiga` y `enlaces` siguen viajando,
de la misma lectura.

### CF1-16 · El cerebro lee lo mismo

**Qué es** · Se suma `creative_en_cifras`, que lee la misma lectura y devuelve la `pantalla`. Las herramientas de antes
(`calidad_de_piezas`, `rendimiento_de_piezas`, `fatiga_de_piezas`) siguen trayendo los avisos que la pantalla no dibuja.
Las URLs no viajan: cada pieza lleva `conMiniatura` y `conEnlace` en lugar de la miniatura y el enlace.

**Estado** · Construido el 2026-10-11 (CF-2): `creative_en_cifras` y `pantallaParaElCerebro`, en
`lib/agentes/executive/adaptadores/creative.ts`. La prueba `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts`
compara la herramienta con la `pantalla` de la ruta en los cuatro períodos, y con una miniatura y un enlace sembrados
mira que ninguna URL llegue al cerebro.

### CF1-17 · Sin datos personales

**Qué es** · La pantalla no dibuja nada de una persona: los nombres son de piezas, que son nombres de anuncios. Las
cifras de contactos son conteos. Del prototipo no se copia ningún nombre.

**Estado** · Construido el 2026-10-11 (CF-3). La prueba `pruebas/codigo/254-la-pantalla-de-creative.test.ts` lee del prototipo los nombres, formatos, ángulos y dolores de la maqueta y exige que ninguno vuelva.

### CF1-18 · El teléfono

**Qué es** · A 375 px la tira va de a dos, la rejilla de a una tarjeta y la ficha ocupa el ancho. La página no desliza
a lo ancho.

**Estado** · Construido el 2026-10-11 (CF-3) y medido el mismo día (CF-5): a 375 px la tira va de a dos, las tarjetas
de a una y la ficha ocupa el ancho, sin desborde a lo ancho; a 1440, 1180 y 1125 px la tira va de a seis, como el
prototipo. La foto `docs/OTROS/estado actual/02-CREATIVE.md` § 2 trae la comparación entera.

### CF1-19 · Los textos que pasan a ser falsos se corrigen en la misma etapa

- El encabezado de la vista y el del panel.
- Los comentarios de `app/aios.css` y `app/temas.css` que hablan de las clases de Creative.
- `15-LA-MINIATURA-Y-EL-VIDEO.md`, que decía que GoHighLevel no entrega la miniatura: la entrega por otra lectura.
- La foto `docs/OTROS/estado actual/02-CREATIVE.md`, reescrita en CF-5.

**Estado** · Hecho en CF-0 a CF-5: la foto 02 se reescribió el 2026-10-11.

---

## 4 · Lo que esto contesta de la foto 02

| riesgo de `docs/OTROS/estado actual/02-CREATIVE.md` | respuesta |
|---|---|
| 1 · la pantalla describe un período que terminó y no lo dice | cada pieza dice «Entregando» o «Sin entrega»; el agente da la última fecha con impresiones |
| 3 · el CTR bajo el piso sale como un guion pelado | toda cifra en «—» lleva su línea (CF1-02) |
| 8 · Executive publica un Creative sano | cerrado el 2026-10-01: la maqueta del Executive se retiró |

---

## 5 · Cómo se construye

| etapa | qué | estado |
|---|---|---|
| CF-0 | Esta carpeta al día, `docs/OTROS/futuro/lo-que-creative-no-mide.md` y la medición de producción con el OK del usuario | **hecho el 2026-10-11** |
| CF-1 | El servidor: `lecturaDeCreative`, los calificados por pieza, la miniatura y la pasada que completa la atribución | **hecho el 2026-10-11**: pruebas 252 (código y base) y 253; 26 mutaciones muertas; la `077` |
| CF-2 | La ruta y el cerebro sobre la lectura | **hecho el 2026-10-11**: pruebas 213, 214, 215 y la ventana en la 252 |
| CF-3 | El front sobre el marcado del prototipo, `app/creative.css`, y `app/inteligencia-estetica.css` borrada | **hecho el 2026-10-11**: prueba 254; 104, 107, 146 y 251 al día |
| CF-4 | La revisión adversarial, las mutaciones y la suite entera | **hecho el 2026-10-11**: cuatro lentes; ver § 7 |
| CF-5 | La comparación contra el prototipo, los anchos, la subida y la foto 02 | **hecho el 2026-10-11**: medida en los cuatro anchos; la foto 02 reescrita; queda `CF1-P06` (§ 6) |

---

## 6 · Preguntas abiertas

Cada una tiene una respuesta tomada por defecto, que es la que se construye si nadie dice otra cosa.

| id | pregunta | por defecto |
|---|---|---|
| `CF1-P01` | ¿«Impresiones» en lugar de «Alcance»? | sí: el alcance diario no se suma (CF1-02) |
| `CF1-P02` | ¿«Entregando» si hubo impresiones en los últimos 3 días? | sí (CF1-09) |
| `CF1-P03` | Una pieza única en su etapa, ¿va a «Funciona» con la línea «Única de su etapa.»? | sí (CF1-08) |
| `CF1-P04` | ¿«Retención» se queda en la tira, en «—»? | sí: es una cifra del prototipo y su hueco dice por qué |
| `CF1-P05` | ¿La miniatura es el `videoUrl` más frecuente de la pieza? | sí (CF1-12) |
| `CF1-P06` | Si la imagen de `facebook.com/ads/image` pide sesión o caduca, ¿se vuelve al fondo del prototipo? | sí. **Sin medir**: en CF-5 la base local no tenía ninguna y no se copian URLs de producción; se ve en producción cuando la pasada traiga miniaturas |

---

## 7 · Lo que encontró la revisión adversarial (CF-4)

Cuatro lentes independientes —el servidor, el front, los textos y las pruebas— sobre CF-1 a CF-3, cada hallazgo
verificado contra el código antes de corregirlo. Lo que cambió de lo construido:

| lente | lo que estaba mal | cómo quedó |
|---|---|---|
| servidor | la pantalla listaba todas las piezas de la historia en cualquier período: la entrega no tiene ventana en el `where` | entra la pieza que trajo contactos, tuvo impresiones o gastó EN LA VENTANA |
| servidor | «Perdiendo gancho» se contaba sobre todas las piezas (`conVeredicto.sobre`), no sobre las que tienen veredicto | sobre `conVeredicto.con`; sin veredictos, la frase de la fatiga |
| servidor | la pasada de miniaturas podía comerse el tiempo de la corrida: 50 pedidos de hasta 4 minutos, sin corte si GoHighLevel no contestaba | 15 s por pedido, 60 s por pasada, y corte ante un GoHighLevel que no contesta |
| servidor | un 403 de UN contacto cortaba la pasada, y un 4xx fijo se volvía a pedir cada diez minutos para siempre | el rechazo de un contacto se guarda como no devuelto; sólo el 401 corta |
| servidor | una miniatura de más de 500 caracteres se guardaba y no se dibujaba nunca | el tope de la miniatura es el de la tabla (2000) |
| servidor | la frecuencia de la tira pesaba cada pieza con todas sus impresiones, no con las de sus días con frecuencia | `impresionesConFrecuencia` en la entrega |
| servidor | la miniatura desempataba por cuándo se pidió, no por el contacto más nuevo; la etapa de respaldo, por el orden de las filas | por `alta_en_el_crm`; y la etapa que va antes en el embudo |
| servidor | «Entregando» miraba 4 días del calendario | 3, hoy incluido, como `ventanaDeMetricas` |
| servidor | los anuncios sin nombre tenían gasto pero no entrega; el gasto nulo con impresiones decía «Sin entrega» | la misma pieza rotulada en las dos lecturas; `sin_reporte` |
| servidor | `creative_en_cifras` pasaba todo menos las URLs (lista negra) | lista blanca campo por campo (AG-45) |
| front | las tasas chicas se redondeaban a entero: una landing de 0,2 % se leía «0 %» | un decimal debajo del 10 % |
| front | el menú «Ordenar por» cerrado seguía en el orden del tabulador; la ficha no devolvía el foco ni lo retenía | los ítems se dibujan sólo abiertos; el foco vuelve y no sale del cajón |
| front | una recarga atrasada podía devolver el período anterior; una ficha cerrada por una recarga se reabría sola | el período vigente en una referencia; la ficha se olvida |
| front | una respuesta sin `pantalla` tumbaba el panel | «No se pudo leer. Reintenta.» |
| textos | comentarios y documentos que describían la pantalla anterior en presente, citas a la maqueta fijadas en el commit equivocado | corregidos; las citas de la maqueta, en `833fc51` |
| pruebas | 43 de 45 mutaciones nuevas sobrevivían: la ficha, los respaldos, la fila de abajo, el editor del link, la barra de períodos | pruebas 252, 253 y 254 ampliadas; ver la etapa CF-4 |

