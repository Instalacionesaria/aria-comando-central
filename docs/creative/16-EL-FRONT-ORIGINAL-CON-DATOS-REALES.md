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
| «Calificados» | los contactos de **ICP alto**: puntaje de 75 o más, el tramo «alto» de `tramoDelPuntaje` (`lib/negocio/tramosDelIcp.ts:85`) |
| La miniatura | el **«Video Url» de la primera atribución** del contacto, medido y usado: la imagen en la tarjeta y en la ficha; el clic abre Facebook o Instagram |
| Completar la atribución | **una pasada con tope**: hasta 50 contactos por pasada, primero los más recientes, con `GET /contacts/{id}`; se activa al subir |
| Los bloques de la pantalla de hoy | **como Sales**: abajo «Lo demás, en cifras»; la fatiga además como marca en la tarjeta; el detalle por pieza en la ficha |

**Por qué contra la etapa.** Con un solo promedio, la pieza BOFU —la que habla con quien ya conoce la oferta— levanta
la vara y manda a «pausar o iterar» a las TOFU, que traían el 65 % del volumen en la medición de septiembre
(`docs/OTROS/estado actual/02-CREATIVE.md`). La etapa sale del nombre de la campaña (`etapaDelNombre`,
`lib/negocio/creativo.ts:70`), como ya hace la pantalla de hoy y el detector (`CRE-ICP-POR-PIEZA`).

---

## 2 · El mapa, y lo que se midió

### Del prototipo al dato

| lugar del prototipo | dato | fuente | estado |
|---|---|---|---|
| Encabezado: «Creative», «Qué funciona, qué no, y por qué», «Plan de acción», el segmentado | el título, la bajada, el plan real del detector y los cuatro períodos | `BotonDelPlan`, `lib/negocio/periodo.ts` | real |
| Tira: Calificados | contactos de ICP alto que trajo cada pieza, sumados | `calidadDelCreativo` (`lib/negocio/calidadDelCreativo.ts:130`) más el tramo | real |
| Tira: Agendas | contactos que agendaron | `calidadDelCreativo` | real |
| Tira: Hook rate | `videoView` sobre impresiones, con su piso | `rendimientoDelCreativo` (`lib/negocio/rendimientoDelCreativo.ts:318`) | real |
| Tira: Retención | — | sin fuente por esta vía (`lib/negocio/rendimientoDelCreativo.ts:143`) | «—» |
| Tira: Alcance | **impresiones** (desvío) | `rendimientoDelCreativo` | real |
| Tira: Frecuencia | impresiones sobre alcance, pesada por impresiones | `metricas_de_anuncio`, como `frecuenciaPorAnuncio` (`lib/agentes/detectores/creative.ts:129`) | real |
| Barra «Ordenar por» | Calificados, Agendas, Hook rate, Impresiones | el servidor | real |
| Grupos «Funciona» / «No funciona» | contra el promedio de la etapa | el servidor | real |
| Tarjeta: miniatura | `videoUrl` de la primera atribución | `atribucion_primera`, completada con `GET /contacts/{id}` | por construir |
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
  `lib/negocio/sincronizar.ts:443-448`), no tiene nada que guardar. No es la primera diferencia entre las dos
  respuestas: en los campos del CRM, la búsqueda trae 24 valores y el pedido por contacto 27 (`lib/ghl/cliente.ts:147-148`).

**Consecuencia:** la miniatura necesita una pasada que complete la atribución con `GET /contacts/{id}`
(`contactoPorId`, `lib/ghl/cliente.ts:545`). Es la decisión de la tabla de arriba.

---

## 3 · Los requisitos

### CF1-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo y en su orden: `cre-head`, `cre-stats`, `filterbar`,
los dos `ghead` con su rejilla `cg` de tarjetas `cc`, y la ficha `aside.drawer`. La sección **no lleva `estetica-op`**,
y `#v-creative` sale de `app/inteligencia-estetica.css`, que con eso queda sin nadie que la use y se borra.

**Fórmula** · Lo nuevo va en `app/creative.css`, acotado a `#v-creative` y a `.cr-ficha` para la ficha, que se monta
en `document.body`. **Las reglas del prototipo que faltan se restituyen ahí**: `.cre-stat`, `.cg`, `.cc*`, `.cc-mx`,
`.qb`, `.dw-verdict` y `.tr-line` se retiraron de `app/aios.css` el 2026-09-19, cuando nadie las dibujaba. Salen del CSS
en línea del prototipo (`aios-command-center_1.html:558-985`), con los colores pasados a tokens y sin sombras.

**Rastro** · El prototipo: `aios-command-center_1.html:2746-2804`. La pantalla de hoy: `components/views/CreativeView.jsx:47`.

**Estado** · Por construir (CF-3).

### CF1-02 · Frases cortas, de una lista cerrada

**Qué es** · Los huecos y los estados usan **sólo** estas frases:

| situación | texto |
|---|---|
| cifra o tasa sin dato | «—» |
| una tasa sobre contactos con menos de 10 | «Pocos casos para una tasa.» |
| una tasa sobre impresiones con menos de 1000 | «Pocas impresiones para una tasa.» |
| una pieza sin impresiones en la ventana | «Sin entrega en esta ventana.» |
| lo que GoHighLevel no entrega: la retención, el formato, el ángulo, la duración, el dolor, el guion | «GoHighLevel no lo entrega.» |
| el CRM sin el campo del ICP | «El CRM no tiene el puntaje.» |
| una pieza sin «Video Url» guardado | «Sin miniatura todavía.» |
| la fatiga sin veredicto | «Sin días suficientes para medir el gancho.» |
| la cohorte vacía | «Sin contactos en este período» |
| un grupo sin piezas | «Sin piezas en este grupo.» |
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
| «Recomendaciones y conclusiones» | «Plan de acción» | es el plan real del detector, con sus grupos |

**Estado** · Por construir (CF-3): la lista vivirá en `FRASE` de `components/creative/comun.jsx`, y una prueba nueva
exigirá que las dos coincidan en las dos direcciones.

### CF1-03 · El encabezado

**Qué es** · «Creative» y «Qué funciona, qué no, y por qué». En `.ch-r`, el «Plan de acción» real (CF1-14) y el
segmentado con los cuatro períodos del sistema, sin «Personalizado» ni la clave `mes`.

**Estado** · Por construir (CF-3).

### CF1-04 · Los períodos y el piso

**Qué es** · Hoy · 7 días · 30 días · Completo, con 30 días por omisión. Creative cuenta **días cerrados**
(`current_date`), como hoy. Toda tasa lleva su piso: 10 contactos (`PISO_DE_UNA_TASA`) o 1000 impresiones
(`PISO_DE_IMPRESIONES`, `lib/negocio/rendimientoDelCreativo.ts:66`). Bajo el piso, «—» con su frase.

**Estado** · Por construir (CF-1).

### CF1-05 · Sin párrafos en la pantalla

**Qué es** · Cifras con su rótulo y, debajo de un «—», una línea de CF1-02. No se dibujan la cobertura del puente
nombre↔anuncio, los avisos, las ventanas de cada fuente ni la lista de lo que no se puede medir. Viajan igual en la
respuesta y en las herramientas del cerebro: el agente de Creative es quien explica. Lo que haría falta para medir
cada «—» está en `docs/OTROS/futuro/lo-que-creative-no-mide.md`.

**Estado** · Por construir (CF-3).

### CF1-06 · La tira de cifras

**Qué es** · Las seis celdas del prototipo, en su orden: Calificados, Agendas, Hook rate, Retención, Impresiones y
Frecuencia. Las dos primeras son sumas; Hook rate y Frecuencia, el promedio pesado de todas las piezas, no el promedio
de los promedios; Retención, «—». La celda del criterio de orden elegido lleva la marca `.hi` del prototipo.

**Fórmula** · Calificados: los contactos de la pieza con `tramoDelPuntaje` alto, sobre el mismo puntaje que lee
`calidadDelCreativo` (el campo «Puntaje | ICP», `CAMPO_DE_ICP`, `lib/negocio/calidadDelCreativo.ts:62`). Hook rate: la
suma de `videoView` sobre la suma de impresiones de los anuncio-días con la clave. Frecuencia: impresiones sobre
alcance, pesada por impresiones como `frecuenciaPorAnuncio` (`lib/agentes/detectores/creative.ts:129-150`).

**Estado** · Por construir (CF-1, CF-3).

### CF1-07 · Ordenar por

**Qué es** · El menú «Ordenar por» del prototipo con cuatro criterios: Calificados, Agendas, Hook rate e Impresiones.
Retención no ordena: no tiene dato. Al lado, «{N} piezas · {período}».

**Fórmula** · El servidor arma, para cada criterio, los dos grupos y su orden; el navegador elige cuál dibujar y **no
ordena nada**.

**Estado** · Por construir (CF-1, CF-3).

### CF1-08 · «Funciona» y «No funciona», contra la etapa

**Qué es** · Para el criterio elegido, una pieza «funciona» si su valor llega al promedio de las piezas de su etapa con
valor; si no llega, o no tiene valor, «no funciona». Las piezas «Sin etapa» se comparan entre sí. Los dos grupos van de
mayor a menor.

**Fórmula** · El promedio de cada etapa es el pesado (la suma de los numeradores sobre la suma de los denominadores)
para las tasas, y el simple para los conteos. Una etapa con una sola pieza no tiene contra quién compararse: la pieza va
a «Funciona» con la línea «Única de su etapa.» —frase que entra a CF1-02 si se confirma la pregunta `CF1-P03`—.

**Estado** · Por construir (CF-1).

### CF1-09 · La tarjeta de pieza

**Qué es** · La tarjeta `cc` del prototipo: la miniatura 16:9 (CF1-12) con su estado, «Entregando» o «Sin entrega»; el
nombre de la pieza; la etiqueta de la etapa; las seis métricas de la tira, por pieza; y la marca «Perdiendo gancho»
cuando la fatiga tiene veredicto y la pieza está fatigada. Al tocarla se abre la ficha.

**Fórmula** · «Entregando»: la pieza tuvo impresiones en alguno de los últimos 3 días. La fatiga sale de
`fatigaDelCreativo` (`lib/negocio/fatigaDelCreativo.ts:131`): `fatigado === true`.

**Estado** · Por construir (CF-1, CF-3).

### CF1-10 · La ficha de la pieza

**Qué es** · El `aside.drawer` del prototipo, con su veredicto («✓ Funciona…» o «✕ Bajo en…», contra la etapa) y estas
secciones:

| sección | qué lleva |
|---|---|
| La pieza | la miniatura grande, «Ver en Facebook/Instagram» si hay `videoUrl` o enlace manual, y el editor del enlace manual de hoy |
| Qué es | Etapa, Estado, Anuncios, Primer día con entrega, Pieza; Formato, Ángulo, Duración y Dolor en «—» |
| Datos de la pieza | las seis de la tira, más el gasto, el CTR, el link CTR, la landing y el click-to-landing |
| Retención y guion | «—» con «GoHighLevel no lo entrega.» |
| Los anuncios | los anuncios de la pieza, por impresiones (`anunciosDeLaPieza`, `lib/negocio/rendimientoDelCreativo.ts:263`) |

Conserva lo que la ficha de hoy ya resuelve: el portal en `document.body`, el foco y Escape
(`components/creative/FichaDelCreativo.jsx`).

**Estado** · Por construir (CF-1, CF-3).

### CF1-11 · Completar la atribución

**Qué es** · Una pasada que pide `GET /contacts/{id}` a GoHighLevel y suma a `atribucion_primera` las claves que
`POST /contacts/search` no trae: `videoUrl`, `photoUrl`, `postId` e `igSid`.

**Fórmula** · Sólo contactos con anuncio (`adId` o `mediumId` en la atribución) a los que les falta la clave y que no
se intentaron todavía; **hasta 50 por pasada**, primero los más recientes; sin pisar las claves que ya hay; un
contacto que GoHighLevel no devuelve se marca para no volver a pedirlo en cada pasada. Ninguna llamada real en la suite:
la prueba simula el cliente.

**Estado** · Por construir (CF-1). Se activa al subir, con el OK del usuario.

### CF1-12 · La miniatura

**Qué es** · La imagen de la pieza en la tarjeta y en la ficha. Al tocar «Ver en Facebook/Instagram», el link se abre
en una pestaña nueva. Sin `videoUrl`, el fondo del prototipo con «Sin miniatura todavía.».

**Fórmula** · De los contactos de la pieza, el `videoUrl` más frecuente; empate, el más reciente. Se valida con la
lista de hosts de `lib/negocio/urlExterna.ts` (`enlaceDePublicacion`, `:82`); un host fuera de la lista no viaja. En el
navegador, `<img>` con `referrerPolicy="no-referrer"` y `loading="lazy"`; si la imagen no carga, el fondo del
prototipo, sin romper la tarjeta.

**Estado** · Por construir (CF-1, CF-3). Depende de CF1-11.

### CF1-13 · Lo demás, en cifras

**Qué es** · Lo que la pantalla de hoy mide y el prototipo no tenía, en una fila de cifras debajo de los grupos: el
gasto total, el CTR, el link CTR, la landing y las piezas perdiendo gancho sobre las que tienen veredicto.

**Estado** · Por construir (CF-1, CF-3).

### CF1-14 · El plan de acción y las señales

**Qué es** · «Plan de acción» abre el plan real de la pasada de la mañana (`BotonDelPlan`,
`components/senales/SenalesDelDepartamento.jsx`), con «Hoy» y «Completo» como hoy. La tarjeta de señales queda al
final de la pestaña, como en Conversion.

**Estado** · Por construir (CF-3).

### CF1-15 · El servidor calcula; el navegador dibuja

**Qué es** · Una sola lectura nueva, `lecturaDeCreative`, compone `calidadDelCreativo`, `rendimientoDelCreativo`,
`fatigaDelCreativo` y `enlacesDeLasPiezas`, más los calificados por pieza y la miniatura, y entrega lo que la pantalla
arma, **de 0 a 1**, con el motivo de cada «—». Tiene una mitad pura, probada sin base, y otra que lee, como
`lib/negocio/lecturaDeConversation.ts`. La ruta `app/api/creative/route.ts` suma `pantalla`; los bloques de hoy siguen
viajando. El navegador multiplica por 100 en un solo lugar.

**Estado** · Por construir (CF-1, CF-2).

### CF1-16 · El cerebro lee lo mismo

**Qué es** · Se suma `creative_en_cifras`, que lee la misma lectura y devuelve la `pantalla`. Las herramientas de hoy
(`calidad_de_piezas`, `rendimiento_de_piezas`, `fatiga_de_piezas`) siguen trayendo los avisos que la pantalla no dibuja.

**Estado** · Por construir (CF-2).

### CF1-17 · Sin datos personales

**Qué es** · La pantalla no dibuja nada de una persona: los nombres son de piezas, que son nombres de anuncios. Las
cifras de contactos son conteos. Del prototipo no se copia ningún nombre.

**Estado** · Por construir (CF-3).

### CF1-18 · El teléfono

**Qué es** · A 375 px la tira va de a dos, la rejilla de a una tarjeta y la ficha ocupa el ancho. La página no desliza
a lo ancho.

**Estado** · Por construir (CF-3, CF-5).

### CF1-19 · Los textos que pasan a ser falsos se corrigen en la misma etapa

- El encabezado de la vista y el del panel.
- Los comentarios de `app/aios.css` y `app/temas.css` que hablan de las clases de Creative.
- `15-LA-MINIATURA-Y-EL-VIDEO.md`, que decía que GoHighLevel no entrega la miniatura: la entrega por otra lectura.
- La foto `docs/OTROS/estado actual/02-CREATIVE.md`, reescrita en CF-5.

**Estado** · Por construir (CF-0 a CF-5).

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
| CF-1 | El servidor: `lecturaDeCreative`, los calificados por pieza, la miniatura y la pasada que completa la atribución | por hacer |
| CF-2 | La ruta y el cerebro sobre la lectura | por hacer |
| CF-3 | El front sobre el marcado del prototipo, `app/creative.css`, y `app/inteligencia-estetica.css` borrada | por hacer |
| CF-4 | La revisión adversarial, las mutaciones y la suite entera | por hacer |
| CF-5 | La comparación contra el prototipo, los anchos, la subida y la foto 02 | por hacer |

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
| `CF1-P06` | Si la imagen de `facebook.com/ads/image` pide sesión o caduca, ¿se vuelve al fondo del prototipo? | sí, y se mide en CF-5 |
