# Creative Insights
> Corte: **2026-10-18**, con el código de producción, `972972e` (migraciones hasta la `078`). Las cifras de producción
> son de tres fechas y cada una lo dice: las del **2026-10-18**, re-medidas para esta foto con
> `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados, con el OK del usuario); algunas del
> **2026-10-16**, de la misma tanda de mediciones, que se dicen con su fecha; y las del **2026-10-11** y el
> **2026-09-28**, de las fotos anteriores, que se conservan para comparar. La pantalla se miró en el navegador por
> última vez el 2026-10-11 (CF-5), en el preview local, contra el prototipo y con una respuesta sintética: lo que
> «dibuja» cada bloque con los datos de producción está deducido del código y de la medición. Las ventanas cuentan
> días del calendario con hoy incluido: lo que depende de la fecha vale para el día de su medición. En local hay ocho
> commits más, `693a383..dc84cb2`, del modelo de datos multiempresa (Fase 0, migraciones `079` a `084`): construidos
> y **sin subir**, esperando la aprobación de un ingeniero; lo que toca a Creative se dice como tal. Cada afirmación
> lleva su `archivo:línea`. Para ubicar lo nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La
> versión anterior —el corte del 2026-10-11, con su anexo del 2026-10-15— se lee con
> `git show 972972e:"docs/OTROS/estado actual/02-CREATIVE.md"`, la del 2026-09-28 con
> `git show a54d80e:"docs/OTROS/estado actual/02-CREATIVE.md"`, y la del 2026-09-15 con
> `git show 93a1341:"docs/estado actual/02-CREATIVE.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-11; y Meta, listo y sin conectar, desde el
2026-10-15.** La pestaña dibuja el marcado de `aios-command-center_1.html:2746-2804`: la tira de seis cifras,
«Ordenar por», la biblioteca partida en «Funciona» y «No funciona» —cada pieza contra el promedio de SU etapa—, la
tarjeta de cada pieza con su miniatura y la ficha; debajo, «Lo demás, en cifras». Todo sale de una sola lectura del
servidor, `lecturaDeCreative`, con un piso en toda tasa, y cada «—» dice por qué en una línea. La miniatura tiene
ahora dos fuentes, en este orden: **Meta**, con el token que la empresa carga en Ajustes —construido el 2026-10-15,
y nadie lo cargó: la tarea `activos` se sella `saltada` y `negocio.activos_de_anuncio` tiene **0 filas** el
2026-10-18—; y **GoHighLevel**, por contacto, que dio imagen a **3 de 526** contactos pedidos, de **2 piezas**. El
último día con impresiones de Meta es el **2026-10-14** —127 impresiones de un solo anuncio, después de nueve días
sin entrega—; el 2026-10-18 ninguna pieza está «Entregando» y la ventana de 30 días tiene **5 piezas**.

> **Desde el corte del 2026-10-11**
>
> - **2026-10-11 · `f598d7d`** — CF-5: la pasada de miniaturas, medida en producción (riesgo 14).
> - **2026-10-11 · `253cc79`** — la pasada pide sólo los contactos con `adId`
>   (`lib/negocio/miniaturaDelContacto.ts:20-25`, `lib/negocio/miniaturaDelContacto.ts:84`).
> - **2026-10-15 · `66d88de`** — la imagen de un contacto va a la pieza de su ANUNCIO, y sólo sin anuncio a la de su
>   `utmContent` (`lib/negocio/miniaturaDelContacto.ts:195-209`).
> - **2026-10-15 · `cce2d56`** — Meta M-1: el cliente de lectura `lib/meta/graph.ts`, la prueba de tres pasos
>   `lib/meta/conexion.ts` y el botón «Probar conexión» en Ajustes › Credenciales.
> - **2026-10-15 · `972972e`** — Meta M-2 a M-4: la migración `078` (`negocio.activos_de_anuncio`, aplicada a
>   producción ese día), la lectura por lotes `lib/meta/anuncios.ts`, el escritor `lib/negocio/recolectarActivos.ts`,
>   la tarea horaria `activos` al minuto 37, la miniatura y el post de Meta antes que los de los contactos
>   (`lib/negocio/lecturaDeCreative.ts:372-381`), y la guía `docs/creative/17-CONECTAR-META-PASO-A-PASO.md`.
> - **2026-10-16 · `693a383..dc84cb2`, construido en local, sin subir** — la Fase 0 del modelo de datos:
>   `anuncios`, `metricas_de_anuncio`, `miniaturas_del_contacto`, `enlaces_de_pieza` y `activos_de_anuncio` reciben
>   `cuenta_id` (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:123-127`). Ninguno de los ocho commits toca
>   `lib/negocio/`, `lib/meta/`, `components/` ni `app/`.
> - **2026-10-18** — esta foto: las cifras re-medidas, y el anexo del 2026-10-15 integrado.
> - **2026-10-20 · nivel 3, C5 · G1, construido en local, sin subir** — la pieza es (cliente, nombre): su identificador
>   lleva el cliente cuando no es del principal (`lib/negocio/idDeLaPieza.ts:58`), el link manual es de (cliente,
>   pieza) (`095`) y, con piezas de dos clientes, la tarjeta dice el cliente y «Funciona» compara dentro de cada uno
>   (07, «La pieza de Creative es (cliente, nombre)»). Con un solo cliente, la pantalla es la de esta foto.

---

## 1 · Qué pide el documento

El documento funcional vive fuera del repositorio; `docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md` lo cita literal y
por línea. **No tiene una sección propia de Creative**: todo lo detallado está dentro del § 18, que es el de
Acquisition. El resumen es el de la foto del 2026-09-28, y no se volvió a cotejar:

- **§ 18.12** — el Creative Performance Analyzer: nueve indicadores y un límite, *no reemplaza a Creative
  Intelligence, que interpreta hook, body, CTA, guion y nuevas variantes* (C10-01).
- **§ 18.7** — seis KPI de «video y creativo» y dos de «interacción» que también son de la pieza (C10-02).
- **§ 18.15** — lo que ve el responsable creativo: mejor retención, creativos fatigados, hooks con mejor
  comportamiento, solicitudes de variantes (C10-04).
- **§ 18.13** el detector de fatiga; **§ 5.1** la entidad `Creative Profile`; **§ 2.3** el derecho a recomendar
  variantes; **§ 18.16** el contrato que Acquisition le entrega (C10-05 a C10-08).
- **§ 2.5** — un anuncio con bajo CTR puede valer si trae mejor ICP (C10-09). Es la razón de que el orden sea elegible,
  y en el front del prototipo lo es: cuatro criterios (§ 2).
- **§ 16.2** pone a Creative después de validar la trazabilidad, **§ 18.19** deja pendientes los umbrales y **§ 17**
  admite que Creative no está especificado (C10-10 a C10-12).

**Los indicadores del § 18.12, al 2026-10-18:** la retención inicial está como hook rate —vistas de video sobre
impresiones—, en la tira, la tarjeta y la ficha; el CTR, en la ficha y en «Lo demás»; la fatiga, como marca «Perdiendo
gancho» en la tarjeta y cuenta en «Lo demás»; la frecuencia, en la tira y la tarjeta, pesada por impresiones. El CPL
sigue sin construirse. Las caídas de retención, el placement, el formato y la duración siguen sin fuente (§ 5). La
otra mitad —hook, body, CTA, guion, variantes— exige leer la pieza: hoy llega su **imagen**, de pocas piezas, y nada
más; Meta daría la imagen de todas, no el guion.

Lo que pidió el usuario el 2026-10-11 —la forma del prototipo con el dato, y es un tablero— está en
`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 1, con cinco decisiones suyas y seis respuestas por omisión
(`CF1-P01` a `CF1-P06`, § 6 del mismo documento). Lo de Meta, en `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md` § 3: el
2026-10-15 el usuario pidió dejarlo listo para que el encargado lo conecte, con las miniaturas y sin el video.

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:274-286`: clave `creative`, nombre «Creative Insights», grupo
«Inteligencia», capacidad `tablero.ver`. La vista es `components/views/CreativeView.jsx:18-26`, el envoltorio del
prototipo `view-scroll cre-scroll`, **sin `estetica-op`** (CF1-01). El panel recarga cada 60 s sólo con la pestaña a la
vista (`components/creative/PanelDeCreative.jsx:116-118`, `lib/cadencia.ts:91`).

**La ruta.** `app/api/creative/route.ts:52-110`, un solo `GET`: pide `tablero.ver` al portero
(`app/api/creative/route.ts:56`), **rechaza** un período fuera de la lista (`app/api/creative/route.ts:62-63`) y, en una
sola transacción, lee `lecturaDeCreative`, las señales con su plan y el comentario de la cabecera
(`app/api/creative/route.ts:68-84`). La respuesta suma `pantalla`, lo que el tablero arma; `calidad`, `rendimiento`,
`fatiga` y `enlaces` siguen viajando de la misma lectura (`app/api/creative/route.ts:96-100`), y el panel no los lee.
Antes de CF-2 la ruta llamaba a cada módulo por separado (`app/api/creative/route.ts:76-81@90439cf`).

**La lectura.** `lib/negocio/lecturaDeCreative.ts` tiene una mitad pura, `armarCreative`
(`lib/negocio/lecturaDeCreative.ts:315-460`), y otra que lee: compone `calidadDelCreativo`, `rendimientoDelCreativo`,
`fatigaDelCreativo` y los links manuales con tres lecturas más —la entrega de cada pieza, la miniatura de los
contactos y, desde el 2026-10-15, lo leído de Meta— (`lib/negocio/lecturaDeCreative.ts:576-593`). Todo lo de
`pantalla` viaja de 0 a 1; el navegador multiplica por 100 en un solo lugar (`components/creative/comun.jsx:76`). La
pieza es el nombre del anuncio normalizado, la misma llave de los tres módulos (`lib/negocio/creativo.ts:53-55`), en el
cliente de sus anuncios o de sus contactos (el nivel 3): su `clave` es el nombre si es del principal —con un cliente,
siempre— y `<cuenta>:<nombre>` si es de otro (`lib/negocio/idDeLaPieza.ts:58`).

**Lo que dibuja**, en el orden del panel, y lo que se sabe el 2026-10-18 a 30 días —el período con que abre
(`lib/negocio/periodo.ts:109`)—, deducido de la medición de ese día (no leído de la pantalla):

| bloque | dónde | el 2026-10-18, a 30 días |
|---|---|---|
| Encabezado: «Creative», «Qué funciona, qué no, y por qué», el «Plan de acción» real y el segmentado de los cuatro períodos | `components/creative/PanelDeCreative.jsx:123-138` | el título y la bajada, ocultos por la cabecera del departamento (`app/departamentos.css:209`) |
| La tira: Calificados · Agendas · Hook rate · Retención · Impresiones · Frecuencia; la del criterio elegido, marcada | `components/creative/PanelDeCreative.jsx:254-276` | no medida cifra por cifra; Retención siempre «—», «GoHighLevel no lo entrega.»; las impresiones de todos los anuncio-día de la ventana suman 54.466 |
| La barra: «Ordenar por» —Calificados, Agendas, Hook rate, Impresiones— y «{N} piezas · {período}» | `components/creative/PanelDeCreative.jsx:202-207` | **5 piezas**: 2 con contactos y 3 con entrega o gasto, contadas con una consulta que reproduce el filtro de la lectura (el 2026-10-16, 6) |
| «Funciona · sobre el promedio de su etapa» y «No funciona · bajo el promedio — pausar o iterar», con «{N} piezas» | `components/creative/PanelDeCreative.jsx:209-223` | no medido; abre por Agendas (`components/creative/PanelDeCreative.jsx:52`) |
| Cada tarjeta: la miniatura con su estado y, si la fatiga lo dice, «Perdiendo gancho»; el nombre, la etapa y las seis cifras | `components/creative/PanelDeCreative.jsx:361-417` | todas «Sin entrega» (el 2026-10-16 una estaba «Entregando», por el 2026-10-14); una de las 5 piezas tiene miniatura, de los contactos |
| «Lo demás, en cifras»: Gasto · CTR · Link CTR · Landing · Perdiendo gancho «{con} de {sobre}» | `components/creative/PanelDeCreative.jsx:423-451` | no medido |
| La tarjeta de señales, al final | `components/creative/PanelDeCreative.jsx:226` | — |

**La tira y la tarjeta** (CF1-06, CF1-09). Calificados y Agendas son conteos: los contactos de la pieza con un puntaje
de ICP de 75 o más (`lib/negocio/calidadDelCreativo.ts:248`, `lib/negocio/tramosDelIcp.ts:38`) y los que tienen una
cita alcanzable. Hook rate y Frecuencia de la tira son pesados, no el promedio de los promedios: las vistas sobre las
impresiones de los anuncio-día que traían la clave, y la frecuencia de cada pieza pesada con las impresiones de sus días
con frecuencia (`lib/negocio/lecturaDeCreative.ts:422-443`). Retención es siempre «—» con `sin_fuente`
(`lib/negocio/lecturaDeCreative.ts:372`). «Entregando» es haber tenido impresiones en alguno de los últimos 3 días del
calendario, hoy incluido (`lib/negocio/lecturaDeCreative.ts:494-495`). La etapa de la pieza es la de la campaña de la que
más impresiones tuvo; si esa campaña no la dice, la de sus contactos —la de más contactos, y en empate la que va antes
en el embudo— y si no, «Sin etapa» (`lib/negocio/lecturaDeCreative.ts:331-349`, `lib/negocio/lecturaDeCreative.ts:505-530`).
Una pieza entra a la pantalla si EN LA VENTANA trajo contactos, tuvo impresiones o gastó
(`lib/negocio/lecturaDeCreative.ts:351-361`). En la tarjeta, un «—» lleva su frase en el `title`, porque la celda mide
50 px (`components/creative/PanelDeCreative.jsx:408`, `app/creative.css:99`).

**«Funciona» es contra la etapa** (CF1-08). Para el criterio elegido, el servidor calcula el promedio de cada etapa
—pesado en el hook rate, simple en los conteos— y manda las dos listas ya ordenadas, de mayor a menor
(`lib/negocio/lecturaDeCreative.ts:233-312`); el navegador elige cuál dibujar y no ordena nada. Una pieza sin valor, o
de una etapa sin promedio, va a «No funciona» (`lib/negocio/lecturaDeCreative.ts:280-282`; ver riesgo 9). La que es la
única de su etapa con valor va a «Funciona» con la etiqueta «Única de su etapa.»
(`lib/negocio/lecturaDeCreative.ts:284`, `components/creative/PanelDeCreative.jsx:402`). Sin ningún promedio en ninguna
etapa, el subtítulo de «Funciona» dice el del prototipo, «sin datos en este periodo»
(`components/creative/PanelDeCreative.jsx:197`, `components/creative/PanelDeCreative.jsx:212`).

**«Lo demás, en cifras»** (CF1-13): el gasto total del módulo de rendimiento, y el CTR, el link CTR y la landing de la
ventana entera, con el piso de 1000 impresiones; «Perdiendo gancho» cuenta las piezas fatigadas sobre las que **tienen
veredicto**, y sin ninguna dice «Sin días suficientes para medir el gancho.» (`lib/negocio/lecturaDeCreative.ts:451-458`,
`components/creative/PanelDeCreative.jsx:430`).

**La ficha** (CF1-10, `components/creative/FichaDelCreativo.jsx:88-200`): el cajón del prototipo, en un portal sobre
`document.body`, con el veredicto contra la etapa —«✓ Funciona» con su cifra, o «✕ Bajo en…»—
(`components/creative/FichaDelCreativo.jsx:97-103`) y cinco secciones: **La pieza**, con la miniatura grande, «Ver en
Facebook/Instagram» y el editor del link manual (`components/creative/FichaDelCreativo.jsx:110-124`); **Qué es**, con la
etapa, el estado, los anuncios, el primer y el último día con entrega, la pieza, y Formato, Ángulo, Duración y Dolor en
«—» (`components/creative/FichaDelCreativo.jsx:126-141`); **Datos de la pieza**, las seis de la tira más el gasto, el CTR,
el link CTR, la landing y el click-to-landing, con la línea de cada «—» debajo
(`components/creative/FichaDelCreativo.jsx:143-158`); **Retención y guion**, en «—»
(`components/creative/FichaDelCreativo.jsx:160-175`); y **los anuncios de la pieza**, por impresiones, con los últimos
seis dígitos del id (`components/creative/FichaDelCreativo.jsx:177-195`), todavía sin la miniatura de cada anuncio. El
foco entra al abrirla, vuelve a la tarjeta al cerrarla, no sale del cajón con el tabulador, y Escape dentro del campo
del link no cierra (`components/creative/FichaDelCreativo.jsx:55-78`). El editor del link se dibuja con
`puedeConfigurarComisiones` (`components/creative/PanelDeCreative.jsx:185`), que la sesión arma con
`credenciales.editar` (`app/api/auth/sesion/route.ts:142`), lo mismo que pide el servidor
(`app/api/creative/enlace/route.ts:89`).

**La miniatura, y de dónde sale** (CF1-11, CF1-12, C15-08). Por pieza manda **Meta**: la miniatura vigente y el post
leídos con el token de la empresa, y sólo si Meta no tiene, la de los contactos
(`lib/negocio/lecturaDeCreative.ts:372-376`). Para «Ver en…», el link manual manda sobre las dos, después el post de
Meta y después la imagen de los contactos (`lib/negocio/lecturaDeCreative.ts:379-381`,
`lib/negocio/lecturaDeCreative.ts:400`). Sin token, Meta no aporta nada y la pantalla es la de los contactos.

- **La de los contactos** la escribe una pasada colgada de la tarea `contactos`, después de sincronizar
  (`lib/negocio/barrido.ts:1094-1098`), que corre cada diez minutos (`lib/negocio/barrido.ts:248-252`). Pide
  `GET /contacts/{id}` (`lib/ghl/cliente.ts:545`) para los contactos con `adId` en su primera atribución que
  todavía no se pidieron, de los más recientes a los más viejos, hasta 50 por pasada
  (`lib/negocio/miniaturaDelContacto.ts:80-92`), y guarda una fila por contacto pedido —también sin dato, o rechazado
  por el CRM— en `negocio.miniaturas_del_contacto` (`db/migraciones/077_la_miniatura_del_contacto.sql:18-32`), sin
  pisar lo guardado (`lib/negocio/miniaturaDelContacto.ts:180-187`). Cada pedido espera hasta 15 s y la pasada entera
  hasta 60 (`lib/negocio/miniaturaDelContacto.ts:48`, `lib/negocio/miniaturaDelContacto.ts:51`); un 429, un 401 o un
  GoHighLevel que no contesta la cortan (`lib/negocio/miniaturaDelContacto.ts:126-130`), y el sello de la tarea dice
  por qué (`lib/negocio/barrido.ts:1150-1160`). La miniatura de la pieza es la imagen más frecuente entre sus contactos
  —el `videoUrl` o, si no hay, el `photoUrl`—, en empate la del contacto que entró más tarde al CRM, y sólo si su host
  es de Facebook, Instagram o el CDN de Meta (`lib/negocio/miniaturaDelContacto.ts:190-193`,
  `lib/negocio/miniaturaDelContacto.ts:227-235`). La pieza de un contacto
  sale de su anuncio —el `adId` cruzado con `negocio.anuncios`— y sólo sin anuncio de su `utmContent`
  (`lib/negocio/miniaturaDelContacto.ts:195-209`): los contactos que traen la imagen entran por un anuncio de
  Instagram y llegan sin UTMs.
- **La de Meta** la escribe la tarea `activos`, cada hora en el minuto 37 (`lib/negocio/barrido.ts:359-363`), y sin
  token se sella `saltada` sin llamar a nadie (`lib/negocio/barrido.ts:745-749`). Con token, pide los anuncios que
  nunca se leyeron, los leídos hace más de un día y aquellos cuya miniatura vence en las próximas seis horas, primero
  los que entregaron hace menos (`lib/negocio/recolectarActivos.ts:97-115`), hasta 200 por pasada y 90 s
  (`lib/negocio/recolectarActivos.ts:26`, `lib/negocio/recolectarActivos.ts:29`). Lee por lotes de 50, primero el
  anuncio y después su creativo, con la miniatura pedida a 640 px (`lib/meta/anuncios.ts:3-7`,
  `lib/meta/anuncios.ts:16`, `lib/meta/anuncios.ts:19`), y guarda una fila por anuncio —también sin miniatura, con su
  motivo— en `negocio.activos_de_anuncio` (`db/migraciones/078_el_activo_del_anuncio.sql:21-38`), con el vencimiento
  de la firma `oe` del CDN (`lib/negocio/recolectarActivos.ts:52-60`). Una miniatura vencida no viaja, y una pieza
  con varios anuncios toma la del que más impresiones tuvo (`lib/negocio/recolectarActivos.ts:148-184`).

El navegador la pide sin `referrer` y con carga perezosa; sin URL dice «Sin miniatura todavía.», y si la imagen no
carga queda el fondo del prototipo (`components/creative/Miniatura.jsx:11-24`).

**«Probar conexión», en Ajustes › Credenciales** (M-1, 2026-10-15). Debajo del token y la cuenta de Meta
(`components/ajustes/Credenciales.jsx:418`), un botón llama a `POST /api/admin/credenciales/meta`, que pide
`credenciales.editar` (`app/api/admin/credenciales/meta/route.ts:22-31`) y prueba, sin guardar nada, tres pasos en
orden: el token, la cuenta publicitaria y la lectura de los últimos 25 anuncios con cuántos traen miniatura
(`lib/meta/conexion.ts:37-73`). El cliente de Meta sólo hace `GET` y lleva el token en la cabecera, nunca en la URL
(`lib/meta/graph.ts:12-15`, `lib/meta/graph.ts:87-110`); el error de Meta se traduce a seis motivos con un texto propio
(`lib/meta/graph.ts:45`, `lib/meta/graph.ts:66-81`). Nadie lo apretó con un token real.

**Cada «—» dice por qué, con una frase de una lista cerrada.** Siete motivos
(`lib/negocio/lecturaDeCreative.ts:53-60`), cada uno con su frase (`components/creative/comun.jsx:26-34`), más el «—»
mismo, la miniatura, la fatiga, el grupo vacío, la única de su etapa, la primera carga y el fallo: catorce frases en
`FRASE` (`components/creative/comun.jsx:8-23`), las mismas de la tabla de CF1-02, y
`pruebas/codigo/254-la-pantalla-de-creative.test.ts:233` exige que coincidan en las dos direcciones. Un cero es un cero
medido. Una tasa chica lleva un decimal debajo del 10 % (`components/creative/comun.jsx:86-89`). No se dibujan la
cobertura del puente nombre↔anuncio, los avisos, las ventanas de cada fuente ni la lista de lo que no se puede medir
(CF1-05): viajan en la respuesta y en las herramientas del cerebro, y
`pruebas/codigo/254-la-pantalla-de-creative.test.ts:403` vigila que no vuelvan.

**Los desvíos de rótulo**, declarados en CF1-02: «Impresiones» por «Alcance», porque el alcance diario no se suma;
«Entregando» / «Sin entrega» por «Activo» / «Pausado», porque no se sabe si alguien la pausó; la etapa en lugar de las
etiquetas de formato y ángulo; el nombre de la pieza por su número; «sobre el promedio de su etapa»; «Primer día con
entrega» por «Publicado»; «Datos de la pieza» por «Datos del video»; «Retención y guion» en una sola sección y en «—»;
«Plan de acción» por «Recomendaciones y conclusiones»; y la tira de a seis hasta 760 px, porque eso dibujaba el
prototipo.

**Ventanas y piso.** Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), sin comparación contra la
ventana anterior. Dos poblaciones, con la misma cantidad de días: la COHORTE de contactos por `alta_en_el_crm` para
Calificados y Agendas (`lib/negocio/calidadDelCreativo.ts:258`) y los ANUNCIO-DÍA por fecha para todo lo de Meta
(`lib/negocio/costoDelAnuncio.ts:83-85`). Las dos cuentan días del calendario con hoy incluido, no días cerrados como
Acquisition y Conversion. Toda tasa sobre impresiones lleva el piso de 1000 (`lib/negocio/rendimientoDelCreativo.ts:70`,
`lib/negocio/lecturaDeCreative.ts:210-216`); el click-to-landing, el de 10 clics al enlace de su módulo
(`lib/negocio/lecturaDeCreative.ts:410-415`). La tira y la tarjeta no dibujan tasas sobre contactos.

**El plan.** El «Plan de acción» es `BotonDelPlan` (`components/senales/SenalesDelDepartamento.jsx:132`) con las señales
que trae la ruta (`components/creative/PanelDeCreative.jsx:131`): el plan de 7 días con «7 días» y el de 30 con «30 días»;
con «Hoy» y «Completo» no hay plan (`app/api/creative/route.ts:67`). El detector tiene cuatro reglas —la caída del CTR,
la concentración del gasto, la frecuencia alta y el ICP de la pieza contra su etapa—
(`lib/agentes/detectores/creative.ts:44-49`) y mide con los mismos tres módulos y los mismos días que la pantalla
(`lib/agentes/detectores/creative.ts:112-119`); el plan las reparte en cuatro grupos
(`lib/agentes/plan/creative.ts:24-29`). El comentario de la cabecera mira la frescura de la tarea `anuncios`
(`lib/agentes/cabecera.ts:110`) y el cuadre del gasto de las campañas contra el de la cuenta
(`lib/agentes/cabecera.ts:123-131`); no mira `activos`.

**El cerebro.** Cuatro herramientas en `lib/agentes/executive/adaptadores/creative.ts`: `calidad_de_piezas`,
`rendimiento_de_piezas`, `fatiga_de_piezas` y **`creative_en_cifras`**
(`lib/agentes/executive/adaptadores/creative.ts:164-189`), que lee la misma lectura que la ruta y devuelve su `pantalla`
con el motivo de cada «—», **sin las URLs**: cada pieza lleva `conMiniatura` y `conEnlace`, campo por campo por lista
blanca (`lib/agentes/executive/adaptadores/creative.ts:29-62`). La compara con la de la ruta, en los cuatro períodos,
`pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:102`, y con una miniatura y un enlace sembrados
mira que ninguna URL llegue al cerebro (`pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:300`). Las
otras tres traen los avisos que la pantalla no dibuja. La frescura de las tareas de las que vive la pantalla la da
`frescura`, con cuatro: `contactos`, `anuncios`, `anuncios_relleno` y, desde el 2026-10-15, `activos`
(`lib/agentes/executive/adaptadores/plataforma.ts:41`, `lib/negocio/frescura.ts:104`).

**Lo que se midió en el navegador (CF-5, 2026-10-11).** Estilos computados del prototipo servido en local contra la
app en el preview, con una respuesta sintética, a 1440, 1180, 1125 y 375 px. **Iguales al prototipo**: el `h2` de 19 px y
la bajada de 12,5 px (`app/aios.css:744-745`); la celda de la tira con relleno de 12 y 14 px, radio 12, rótulo de 11 px,
cifra de 21 px y línea de 10 px (`app/creative.css:31-44`); la píldora de «Ordenar por», 7 y 12 px de relleno y radio 10
(`app/aios.css:620-622`); los encabezados de grupo, con margen de 18 px arriba y 10 abajo y título de 15 px
(`app/aios.css:705`, `app/aios.css:709`); la tarjeta con radio 14 y borde superior de 2 px
(`app/creative.css:58-69`), la miniatura en 16:9 (`app/creative.css:71`), y las seis cifras en tres columnas de celdas de
50 px de alto, con rótulo de 9,5 px y cifra de 15 px (`app/creative.css:96-103`). **Los anchos**: la tira va de a seis a
1440, 1180 y 1125 px, como el prototipo, y de a dos a 375 (`app/creative.css:157-165`); las tarjetas, 4 por fila a 1440
(el prototipo, 3) y 3 a 1180 y 1125 (el prototipo, 2): el área del prototipo es más angosta por su propio armazón, y la
rejilla es la misma (`app/creative.css:56`). A 375 px el prototipo no es usable —queda en 564 px de ancho y la tira se
aplasta a 29 px por celda— y la app no desborda a lo ancho; la ficha ocupa el ancho y sus rejillas van de a dos
(`app/creative.css:166-172`). El foco vuelve a la tarjeta al cerrar con Escape. El título y la bajada del panel no se
ven: los oculta la cabecera del departamento, igual que en Conversation. **No se pudo comprobar** si una imagen real de
`facebook.com/ads/image` carga o pide sesión (`CF1-P06`): no había ninguna en la base local, y no se copian URLs de
producción. Desde entonces la pantalla no se volvió a mirar en el navegador.

**Las pruebas**, contadas por `grep` el 2026-10-18: 15 en `pruebas/codigo/252-lectura-de-creative.test.ts`, 5 en
`pruebas/base/252-lectura-de-creative.test.ts`, 7 en `pruebas/base/253-la-miniatura-del-contacto.test.ts`, 17 en
`pruebas/codigo/254-la-pantalla-de-creative.test.ts`, y las de Meta: 6 en
`pruebas/codigo/255-la-conexion-con-meta.test.ts`, 8 en `pruebas/codigo/256-los-activos-de-meta.test.ts` y 4 en
`pruebas/base/256-los-activos-de-meta.test.ts`.

**Quién la ve.** Quien tenga `tablero.ver`, la capacidad que comparten siete pantallas
(`app/api/creative/route.ts:53-56`). Cargar el link manual, y cargar o probar el token de Meta, piden además
`credenciales.editar`.

---

## 3 · Lo que era maqueta y qué la reemplazó

**La maqueta se fue el 2026-09-19 y su forma volvió el 2026-10-11.** `lib/aios/creative.js` se borró en `3287f74`: 450
líneas con ocho piezas inventadas, cada una con formato, ángulo, dolor, curva de retención y guion. La reemplazó una
pantalla propia con la estética de operación (`components/views/CreativeView.jsx:47@1971ab2`): la cobertura del puente,
una tabla de gente por etapa, otra de la subasta, la fatiga y la lista de lo que no se puede medir
(`components/creative/PanelDeCreative.jsx:198-224@1971ab2`). El 2026-10-11 volvió el marcado del prototipo y se quedó el
dato:

| lo que dibujaba el prototipo | qué hay hoy |
|---|---|
| «Plan de acción» (`components/views/CreativeView.jsx:24-29@833fc51`), que abría doce frases, diez sin fuente (`components/views/CreativeView.jsx:19-23@1971ab2`) | el plan real del detector, de 7 o de 30 días |
| «7 días» encendido, la clave inválida `mes` y «Personalizado» (`components/views/CreativeView.jsx:30-49@833fc51`) | el segmentado de los cuatro períodos del sistema, sin rango libre |
| La tira con los promedios de los promedios de ocho piezas (`lib/aios/creative.js:148-155@833fc51`) | sumas y tasas pesadas, con piso, y Retención en «—» |
| «Alcance» | «Impresiones»: el alcance diario no se suma |
| «Funciona / No funciona» contra el promedio de TODAS las piezas (`lib/aios/creative.js:188-195@833fc51`) | contra el promedio de su etapa: con etapas mezcladas la pieza BOFU mandaba a pausar a las TOFU, que traían el 65 % del volumen en septiembre (`components/views/CreativeView.jsx:34-37@1971ab2`) |
| Tarjetas con número, formato, ángulo, «Activo / Pausado» y un ▶ | el nombre de la pieza, la etapa, «Entregando / Sin entrega», la miniatura real y ningún ▶ |
| La ficha con «Datos del video», la curva de retención y el guion marcado en rojo | «Datos de la pieza»; retención y guion en «—» |

**Lo que la pantalla de antes medía y no volvió como bloque**: el ICP promedio por pieza, la tasa de agenda, el
click-to-landing por pieza en una tabla, la interacción, la cobertura del puente y la lista de lo que no se puede medir.
El click-to-landing está en la ficha; el ICP promedio y la tasa de agenda, en `calidad_de_piezas` del cerebro y en la
regla del ICP del detector; la cobertura y los huecos, en la respuesta. «Sin creativo» —los contactos sin nombre de
pieza— era una fila de la tabla de gente y hoy no se dibuja (riesgo 10).

**Ningún nombre de la maqueta se copió** (CF1-17): `pruebas/codigo/254-la-pantalla-de-creative.test.ts:352` lee del
prototipo los nombres, formatos, ángulos y dolores de las ocho piezas y exige que ninguno aparezca en la vista, el
panel, la ficha, `comun.jsx` ni la miniatura. Los nombres que dibuja la pantalla son de anuncios reales, que son de
piezas y no de personas; esta foto no los copia.

**Lo que Executive inventaba en nombre de Creative ya no existe**: la maqueta del Executive se retiró el 2026-10-01
(`4e9a242`), y con ella las «8 piezas activas» con punto verde, el «hook nuevo» que costaba ventas y la caída del VSL
que Creative «asumía» (la foto del 2026-09-28 los listaba en su § 3, con sus citas fijadas en `c4cf2a8`).

**El galón `›` del menú.** La sección sigue declarando `galon: true` (`lib/autorizacion/secciones.ts:285`), y su
comentario lo defiende citando una línea de la foto del 2026-09-28, ya fijada a su commit
(`lib/autorizacion/secciones.ts:281-284`); desde la barra nueva de la etapa E10 (`40f699a`, 2026-10-02) ninguna línea de
`components/`, `app/` ni `lib/` lee `menu.galon` (grep del 2026-10-18).

---

## 4 · Datos que ya tenemos

**Medido el 2026-10-18**, con `scripts/supabase.mjs leer`, sobre la organización de la empresa —la única con
contactos—, y al lado lo del 2026-10-11 (`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2):

| qué | 2026-10-11 | 2026-10-18 |
|---|---|---|
| contactos | 597 | 624, 24 de ellos sin alta en el CRM |
| con `videoUrl` en `atribucion_primera` | **0** | **0** |
| con `adId` | 215 | 215; ninguno queda por pedir a la pasada |
| con `utmContent`, el nombre de la pieza | 508 | 508 |
| filas de `negocio.miniaturas_del_contacto` | — | **526**: 3 con imagen, 516 devueltas sin imagen y 7 que el CRM no devolvió; la última leída el 2026-10-11 (medido el 2026-10-16) |
| piezas con miniatura de los contactos | ninguna | **2**, las tres imágenes en `www.facebook.com`, de 190 caracteres o menos; 1 de ellas en la ventana de 30 días |
| filas de `negocio.activos_de_anuncio` | — (la tabla nace el 2026-10-15) | **0**; la tarea `activos`, `saltada` en las 11 empresas, la última vez el 2026-10-18 |
| links manuales cargados (`negocio.enlaces_de_pieza`) | no medido | 0 |
| piezas a 30 días | 9, con un predicado que no se comprobó | **5** (el 2026-10-16, 6) |
| piezas en toda la historia | 32 | 75 nombres de anuncio, 71 con alguna impresión, en 129 anuncios de 28 campañas; la consulta del 2026-10-11 no está escrita y las dos cifras no se comparan |
| último día con impresiones de Meta | **2026-10-05** | **2026-10-14**, 127 impresiones de un solo anuncio; nada del 2026-10-06 al 10-13 ni del 10-15 al 10-18 |
| contactos de 30 días del calendario | — | 25, y 23 de ellos sin `utmContent` |

Y del 2026-10-11, con tres `GET` a GoHighLevel que imprimieron sólo nombres de campos y hosts: **`GET /contacts/{id}`
trae el «Video Url»** —en `attributionSource`, `videoUrl` con host `www.facebook.com`, `photoUrl`, `postId` e
`igSid`— y **`POST /contacts/search`, que usa la sincronización, no**. Por eso la ingesta, que guarda toda clave
escalar (`lib/ghl/cliente.ts:215-226`, `lib/negocio/sincronizar.ts:463-468`), no tenía nada que guardar, y la pasada
de CF1-11 existe. Las cuatro claves se guardan aparte porque la sincronización pisa `atribucion_primera` en cada
pasada (`db/migraciones/077_la_miniatura_del_contacto.sql:4-10`).

**Del 2026-09-28, no re-medido** (esa foto, § 4), sobre los 276 contactos de 30 días de entonces: el nombre de la pieza
(`utmContent`) en el 93,1 %, la campaña en el 90,6 %, el `adId` en el 72,1 %; el puntaje «Puntaje | ICP» como número en
271, 22 de ellos en 0. De Meta por GoHighLevel: 79 anuncios de 12 campañas, que eran 32 piezas, 21 en más de un
anuncio; y sobre las filas anuncio-día con desglose y entrega, `videoView` en el 93,3 %, `linkClick` en el 71,3 %,
`landingPageView` en el 62,5 % y `postEngagement` en el 93,8 %. **Lo que medía la pantalla de entonces**, a 30 días:
el ICP promedio de las piezas sobre el piso iba de 29,2 a 71,0 (factor 2,4), la tasa de agenda de 31 % a 78 %, y el
click-to-landing de 12,0 % a 91,4 % entre las ocho piezas con tasa. Esas cifras son de un período con la pauta
detenida desde el 2026-09-14, y no se re-midieron.

**El ICP por contacto** se lee del campo del puntaje de su cliente: el que eligió en Ajustes › Clientes o, si no, el que
se llama exactamente «Puntaje | ICP» (`lib/negocio/calidadDelCreativo.ts:65`, `lib/negocio/camposDelCrm.ts:529`), con la
validación de la sincronización (`lib/negocio/camposDelCrm.ts:456`); un cliente sin campo no tiene «Calificados» y el
aviso lo nombra, también cuando ninguno a la vista tiene campo; con un solo cliente a la vista, el aviso de siempre
(C6 · D4). Leads Portal lee la copia en `contactos.score`. **Las agendas por pieza** salen de `tieneCitaAlcanzable`
(`lib/negocio/citasAlcanzables.ts:135`), con un `exists` y no un `join`: un contacto con dos citas cuenta una vez.

**Lo guardado que la pantalla no dibuja**: la interacción (`postEngagement`), el CPM y el CPC de cada pieza, el ICP
promedio, la tasa de agenda, las congeladas y la cobertura del puente, todo en `calidad` y `rendimiento`; y del
detector, la frecuencia por anuncio de 7 días (`lib/agentes/detectores/creative.ts:142`). El link manual de cada pieza
(`negocio.enlaces_de_pieza`, `db/migraciones/063_el_enlace_de_la_pieza.sql:29`; de cada cliente desde la `095`) manda sobre la miniatura en «Ver en…»
(`lib/negocio/lecturaDeCreative.ts:400`), y el 2026-10-18 no hay ninguno cargado. De `negocio.activos_de_anuncio`, el
tipo de objeto del creativo y el motivo de cada anuncio sin miniatura (`db/migraciones/078_el_activo_del_anuncio.sql:26-34`)
no viajan a la pantalla.

**El Espía de Anuncios**, en Tools (`components/tools/EspiaDeAnuncios.jsx`, `app/api/tools/espia/route.ts`), pide a la
IA hooks, ángulos y estructuras de copy de anuncios de la competencia (`lib/tools/espia.ts:84-92`). Sigue siendo lo único
del producto que lee el texto de una pieza, y mira hacia afuera.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Lo que la pantalla no mide, y qué haría falta, está en `docs/OTROS/futuro/lo-que-creative-no-mide.md`; lo que falta de
Meta, en `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md` § 3 y `docs/OTROS/futuro/miniatura-y-video-de-meta.md`. En
resumen:

**1 · La retención y la curva.** El `fields` de GoHighLevel es un enum cerrado de once valores, y los cuartiles de
video dan 422 (C14-04, C14-05). La cifra «Retención» de la tira y de la tarjeta, y la sección de la ficha, van en «—».
Meta directo daría cuatro cuartiles, no una curva, y la lectura de Meta construida no los pide.

**2 · El formato, el ángulo, la duración y el dolor.** Ningún sistema conectado los guarda: del anuncio, GoHighLevel
devuelve cuatro campos (C14-07). Meta guarda el tipo de objeto del creativo (`VIDEO`, `PHOTO`…) en
`negocio.activos_de_anuncio` (`db/migraciones/078_el_activo_del_anuncio.sql:26-27`), que la pantalla no usa; el resto
haría falta en una convención de nombres de anuncio o un formulario por pieza.

**3 · El guion y dónde se cae la atención.** No hay transcripción, y la retención en cuartiles no señala un segundo.

**4 · El placement y los desgloses demográficos.** `groupBy` sólo acepta `day`, `week` y `month` (C14-06).

**5 · La imagen, el video y el copy.** La **imagen** llega por dos caminos: por contacto desde GoHighLevel, desde el
2026-10-11 y sólo para los contactos de un anuncio de Instagram; y desde Meta, construido el 2026-10-15, para todo
anuncio, **cuando alguien cargue el token** siguiendo `docs/creative/17-CONECTAR-META-PASO-A-PASO.md`. Hay cliente de
Meta en el repositorio desde `cce2d56`, de sólo lectura (`lib/meta/graph.ts:1-18`). El **video** y el **copy** siguen
sin ruta: la reproducción es CR-8 y los huecos dinámicos CR-9, postergados el 2026-09-30 hasta medir con el token real
(`docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md` § 3).

**6 · La miniatura de los contactos sin anuncio.** Una pieza cuyos contactos no traen `adId` no se pide
(`lib/negocio/miniaturaDelContacto.ts:84`), y un contacto sin anuncio conocido ni `utmContent` no aporta su imagen a ninguna
(`lib/negocio/miniaturaDelContacto.ts:220`): para esas, Meta directo o el link manual.

**7 · Los cierres.** Sin ventas registradas no hay CPA, ROAS ni «qué pieza genera más dinero». Según la foto de Sales,
siete resultados y ninguno con monto ([05-SALES.md](05-SALES.md)); no re-medido acá.

**8 · La asistencia.** Según la foto de Conversation, 0 de 169 citas con la asistencia marcada el 2026-10-10
([04-CONVERSATION.md](04-CONVERSATION.md)): del embudo por pieza se mide contacto → cita, y ahí se corta.

**Tres que llegan y no se usan, a propósito**: la frecuencia y el alcance no se suman a lo largo de días ni de anuncios
—la pantalla publica impresiones, y la frecuencia pesada—; `results.lead` cuenta el mismo hecho dos veces (C14-15); y
qué cuenta `videoView` no está documentado (C14-P01). **Los umbrales siguen sin calibrar**: el piso de 1000
impresiones (`lib/negocio/rendimientoDelCreativo.ts:70`), los ocho días de serie
(`lib/negocio/fatigaDelCreativo.ts:53`) y el 20 % de caída (`lib/negocio/fatigaDelCreativo.ts:68`); el § 18.19 los tiene
pendientes.

---

## 6 · Reglas propias

Las transversales —el silencio, el piso de 10, los dos ceros— están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). Las de este departamento:

**1 · La unidad es la PIEZA, no el anuncio.** La llave es el nombre normalizado, en un solo lugar
(`lib/negocio/creativo.ts:53-55`). Agrupar por `adId` borraba una campaña entera: el 2026-09-28 los contactos con
`adId` eran exactamente los de TOFU, y ninguno de BOFU lo traía. Lo de Meta, que es por anuncio, se lleva a la pieza
por el nombre del anuncio (`lib/negocio/recolectarActivos.ts:148-160`). Y la pieza es de un cliente (el nivel 3): dos
clientes con un anuncio del mismo nombre tienen dos piezas, cada una con lo suyo (`lib/negocio/lecturaDeCreative.ts:364`).

**2 · El mismo creativo vive en varios anuncios.** La ficha dice en cuántos (`components/creative/FichaDelCreativo.jsx:131`)
y los lista; es la única mitigación de que dos piezas distintas con el mismo nombre se fundan en un cliente
(`lib/negocio/calidadDelCreativo.ts:99-107`); las de dos clientes ya no se funden. «N activos distintos» (`C15-09`) no está construido.

**3 · «Funciona» es contra la etapa, y una etapa no se compara con otra** (CF1-08). El promedio es por etapa
(`lib/negocio/lecturaDeCreative.ts:233-252`) —con piezas de dos clientes o más, por etapa en su cliente
(`lib/negocio/lecturaDeCreative.ts:269`)—, y la etapa se lee del nombre de la campaña por segmento exacto
(`lib/negocio/creativo.ts:62-75`); lo que no la trae es «Sin etapa», un grupo y no una etapa forzada.

**4 · Un «—» dice por qué, y un cero es un cero medido.** Siete motivos (`lib/negocio/lecturaDeCreative.ts:53-60`),
cada uno con su frase de una lista cerrada (CF1-02, `components/creative/comun.jsx:26-34`).

**5 · Toda tasa lleva su piso**, en la lectura: 1000 impresiones para las tasas sobre impresiones, 10 clics al enlace
para el click-to-landing (`lib/negocio/lecturaDeCreative.ts:210-216`).

**6 · El servidor calcula; el navegador dibuja.** Todo viaja de 0 a 1 y se multiplica por 100 en un solo lugar
(`components/creative/comun.jsx:76`); los grupos y su orden llegan hechos. Lo que el cerebro dice de una cifra es lo
que se dibuja (CF1-16).

**7 · Es un tablero: cifras con su rótulo, y la explicación es del agente** (CF1-05).

**8 · La tira suma y pesa; no promedia promedios** (`lib/negocio/lecturaDeCreative.ts:422-443`).

**9 · Ningún dato de una persona en la pantalla, y ninguna URL en el cerebro** (CF1-17, CF1-16). Los nombres son de
piezas; las cifras de contactos son conteos; el cerebro sabe si hay miniatura, no cuál
(`lib/agentes/executive/adaptadores/creative.ts:57-58`).

**10 · Una imagen de afuera, sólo de hosts conocidos y sin decir de dónde se la mira.** Las listas de hosts son
cerradas y exactas (`lib/negocio/urlExterna.ts:43-56`); la imagen se pide sin `referrer`
(`components/creative/Miniatura.jsx:17`). La de Meta pasa por el mismo filtro antes de guardarse
(`lib/negocio/recolectarActivos.ts:83-84`).

**11 · Cada contacto se pide una sola vez.** Lo pedido queda en la tabla aunque no traiga nada o el CRM rechace ese
contacto; sólo lo que no se pudo pedir —un 5xx, el cupo, la credencial, un GoHighLevel que no contesta— se vuelve a pedir
(`lib/negocio/miniaturaDelContacto.ts:118-131`). La tabla tiene un solo escritor
(`pruebas/base/253-la-miniatura-del-contacto.test.ts:228`), y la de Meta también, `recolectarActivos`
(`lib/negocio/recolectarActivos.ts:13-14`).

**12 · Lo que Creative NO calcula.** El gasto se consume del módulo de rendimiento, que lo toma de `costoDelAnuncio`; el
conteo de contactos sale de contactos nuestros y no de `results.lead`; la retención del VSL es de Conversion, y el
revenue y el CAC, de Business.

**13 · Una cifra por contacto se cuenta por contactos, no por sus citas**: un `exists` compartido y no un `join`
(`lib/negocio/calidadDelCreativo.ts:249-255`, `lib/negocio/citasAlcanzables.ts:135`).

**14 · La ventana es una palabra de una lista cerrada**, y lo que no está se rechaza
(`app/api/creative/route.ts:59-63`).

**15 · Meta se lee, nunca se escribe, y el token no viaja en una URL.** Sólo `GET`, con el token en la cabecera
`Authorization` (`lib/meta/graph.ts:12-15`, `lib/meta/graph.ts:102-106`); el mensaje de Meta no llega al navegador, sólo el
motivo y un texto propio (`lib/meta/graph.ts:16-17`). Nueva desde el 2026-10-15.

---

## 7 · Riesgos

Los 16 de la foto anterior, con su estado al 2026-10-18, y uno nuevo.

**1 · La pantalla describía un período que terminó, y no lo decía.** **Cambió.** Cada tarjeta dice «Entregando» o «Sin
entrega» (`lib/negocio/lecturaDeCreative.ts:388`), la ficha dice el último día con entrega
(`components/creative/FichaDelCreativo.jsx:136`), y la cabecera avisa si la lectura de los anuncios está vieja o si el
gasto no cuadra con el de la cuenta (`lib/agentes/cabecera.ts:123-131`). Lo que sigue sin decirse es la fecha de las
cifras de la tira: el 2026-10-18 dibuja las impresiones de 30 días con todas las piezas «Sin entrega» (deducido). El
último día con impresiones pasó del 2026-10-05 al 2026-10-14; si la pauta no vuelve, desde el 2026-11-13 la ventana de
30 días no tiene ningún día con entrega (deducido de `lib/negocio/costoDelAnuncio.ts:83-85` y del último día medido).

**2 · El mismo ICP se lee distinto en dos lugares.** **Abierto, sin cambios.** La pantalla ya no dibuja el ICP
promedio: «Calificados» usa el umbral de 75 de los tramos, con el que un cero nunca es alto. Pero `calidadDelCreativo`
sigue promediando los ceros como ceros (`lib/negocio/calidadDelCreativo.ts:245`), Leads Portal los cuenta como «sin
calificar» (`lib/negocio/tramosDelIcp.ts:86`), y con ese promedio decide la regla del ICP del detector, que llega al Plan
de acción. Las dos pantallas leen además dos copias del mismo puntaje.

**3 · El CTR bajo el piso salía como un guion pelado.** **Cerrado** en CF-3 (`2415e25`): toda cifra en «—» lleva su
línea, debajo en la tira y en la ficha (`components/creative/PanelDeCreative.jsx:269-271`,
`components/creative/FichaDelCreativo.jsx:217-225`). En la tarjeta va en el `title`
(`components/creative/PanelDeCreative.jsx:408`), que en un teléfono no se ve.

**4 · «Hoy» dice 24 horas y calcula el día.** **Abierto.** El botón lleva de título el matiz de `PERIODOS`
(`lib/negocio/periodo.ts:84`, `components/creative/PanelDeCreative.jsx:166`), y las dos ventanas son días del calendario
(`lib/negocio/calidadDelCreativo.ts:258`, `lib/negocio/costoDelAnuncio.ts:83-85`). «Entregando» también depende de
`current_date` (`lib/negocio/lecturaDeCreative.ts:495`): la lectura de sólo lectura de producción corre en UTC (medido el
2026-10-18), la sesión de la aplicación no se verificó, y el día de la empresa quedó para después
(`docs/OTROS/futuro/el-dia-de-la-empresa.md`).

**5 · La misma ventana, escrita muchas veces.** **Abierto.** `calidadDelCreativo` repite a mano el predicado de la
cohorte en cuatro lugares (`lib/negocio/calidadDelCreativo.ts:258`, `lib/negocio/calidadDelCreativo.ts:298`,
`lib/negocio/calidadDelCreativo.ts:315`, `lib/negocio/calidadDelCreativo.ts:366`) en vez de usar el que exporta
`lib/negocio/recorrido.ts:201-203`. Y las impresiones y los clics de cada pieza se suman dos veces sobre las mismas
filas: en el módulo de rendimiento, por `costoDelAnuncio` (`lib/negocio/costoDelAnuncio.ts:302-303`), y en
`entregaDeLasPiezas` (`lib/negocio/lecturaDeCreative.ts:484-485`). Hoy dan lo mismo —las dos con `ventanaDeMetricas`—;
si una cambia su filtro, la ficha y `rendimiento_de_piezas` dirán dos impresiones para la misma pieza.

**6 · Un `results` con otra forma se tiraría en silencio.** **Abierto**, sin cambios: un arreglo devuelve
`acciones: null` (`3bd2d58:lib/ghl/anuncios.ts:209`), y el hook rate, el link CTR y la landing pasarían a «GoHighLevel no lo
reportó.» sin ningún contador.

**7 · Los comentarios citan líneas que se corrieron.** **A medias.** Sigue abierto en el código:
`lib/negocio/rendimientoDelCreativo.ts:120` y `lib/negocio/rendimientoDelCreativo.ts:238` mandan a las líneas 158 a 165
de `costoDelAnuncio` por «el defecto de grano», y `lib/negocio/costoDelAnuncio.ts:163-170` habla de `desde` y `hasta`;
`lib/negocio/rendimientoDelCreativo.ts:228` manda a la 296 por el `gasto is not null`, que está en
`lib/negocio/costoDelAnuncio.ts:304`. **Cerrado** lo de las citas a esta foto: los comentarios que la citaban por línea
quedaron fijados a un commit —`lib/negocio/calidadDelCreativo.ts:253` y `lib/autorizacion/secciones.ts:281`, a
`@63b8cd1`—, y un `git grep` del 2026-10-16 no encontró ninguna cita sin fijar a una línea de esta foto ni de la de
Conversion.

**8 · Executive publicaba un Creative sano y activo.** **Cerrado** el 2026-10-01 (`4e9a242`).

**9 · «No funciona» junta lo que está bajo el promedio con lo que no tiene dato.** **Abierto.** Una pieza sin valor para
el criterio va a «No funciona» (`lib/negocio/lecturaDeCreative.ts:280-282`), bajo el rótulo «bajo el promedio — pausar
o iterar» (`components/creative/PanelDeCreative.jsx:220`). Lo heredó del prototipo, que hacía lo mismo
(`lib/aios/creative.js:195@833fc51`), y CF1-08 lo declara. Con hook rate o impresiones, una pieza que sólo trajo
contactos en la ventana se lee como una pieza que hay que pausar.

**10 · La tira no cuenta a los contactos sin pieza.** **Abierto, y pesa más.** La calidad sin nombre de pieza se salta
(`lib/negocio/lecturaDeCreative.ts:337`), así que Calificados y Agendas suman sólo a los contactos que trajo alguna pieza
(`lib/negocio/lecturaDeCreative.ts:433-434`). El 2026-09-28 eran 19 de 276 sin nombre de pieza; **el 2026-10-18, 23 de
25** contactos de 30 días no traen `utmContent`: la tira cuenta a dos. Las Agendas de la tira no coinciden con las de
Sales o Conversion, y nada lo dice.

**11 · «Calificados» decía dos cosas.** **Cerrado en CF-5.** En la tira son los contactos de ICP alto
(`lib/negocio/calidadDelCreativo.ts:91-95`); la frase de la regla del ICP del Plan de acción decía «sobre N calificados con
puntaje» para los que traen el puntaje, cualquiera sea (`lib/agentes/detectores/creative.ts:328`). Desde el 2026-10-11
dice «sobre N contactos con puntaje» (`lib/agentes/plan/creative.ts:61`).

**12 · Textos que la miniatura volvió falsos.** **Cerrado en CF-5.** La lista de lo que GoHighLevel no da decía que la
miniatura no tenía ruta, y viajaba así al cerebro en `rendimiento_de_piezas`
(`lib/agentes/executive/adaptadores/creative.ts:122`); ahora dice que llega por el «Video Url» y sólo para las piezas
cuyos contactos la traen (`lib/negocio/rendimientoDelCreativo.ts:160-164`). El comentario del barrido que lista qué
tareas informan un motivo nombra `contactos` y `activos` (`lib/negocio/barrido.ts:856-857`), y el detector ya no dice
que su promedio de ICP lo muestra la pantalla (`lib/agentes/detectores/creative.ts:292-297`).

**13 · La miniatura no se vio cargar.** **Abierto** (`CF1-P06`). No se sabe si la imagen de `facebook.com/ads/image`
carga sin sesión ni cuánto dura. Si no carga, la tarjeta queda con el fondo y sin frase (`components/creative/Miniatura.jsx:16-20`),
distinta de la que dice «Sin miniatura todavía.», y nada cuenta cuántas fallan. Además, sin link manual ni post de Meta,
«Ver en Facebook» abre esa misma imagen y no la publicación (`lib/negocio/lecturaDeCreative.ts:379-381`,
`lib/negocio/lecturaDeCreative.ts:400`). Con el token de Meta cargado, abriría el post que da Meta; el 2026-10-18 no hay
ninguno guardado.

**14 · La pasada trae muy pocas miniaturas.** **Abierto, y medido.** Medido el 2026-10-11 a las 22:10 UTC: 413
contactos pedidos y sólo 3 con imagen. GoHighLevel adjunta la imagen del anuncio —el «Video Url», con `postId` e
`igSid`— **sólo cuando el contacto entra desde un anuncio de Instagram**; los que llegan por el formulario de un anuncio
de Facebook —198, todos de anuncios de video TOFU— no la traen, ni los que sólo traen `mediumId` —unos 255 de
formularios externos y del calendario—. Desde `253cc79` la pasada pide sólo los contactos con `adId`. **El 2026-10-18**:
526 filas, las mismas 3 imágenes, ningún contacto con `adId` por pedir y ninguna lectura nueva desde el 2026-10-11 (el
2026-10-16); desde `66d88de` las 3 imágenes alcanzan a **2 piezas** —antes, 1—, y 1 de las 5 piezas de 30 días tiene
miniatura. Casi todas dicen «Sin miniatura todavía.»; la imagen de las piezas de Facebook depende de Meta (riesgo 16).

**15 · La pantalla no se vio con los datos de producción.** **Abierto**: CF-5 la midió con una respuesta sintética, y la
revisión del usuario en producción sigue pendiente el 2026-10-18. **El cuello de botella de Creative no es técnico**: la
pantalla está, con todo lo que el sistema mide, y la mitad que el § 18.12 le reserva —leer la pieza— sigue sin fuente
más allá de su imagen.

**16 · Meta está listo y nadie lo conectó.** **Abierto** desde el 2026-10-15. La tarea `activos` corre cada hora en el
minuto 37 (`lib/negocio/barrido.ts:359`) y, sin token, se sella `saltada` (`lib/negocio/barrido.ts:745`): el
2026-10-18 lo estaba en las 11 empresas, con `negocio.activos_de_anuncio` vacía. Es lo esperado, y hasta que alguien
siga `docs/creative/17-CONECTAR-META-PASO-A-PASO.md` la pantalla no cambia. Nada se midió con un token real: cuánto dura
la firma de una miniatura (`C15-P02`), si la miniatura de 640 px llega de ese tamaño, ni cuántas llamadas cuesta la
pasada. El primer «Probar conexión» y la primera hora de la tarea lo dicen.

**17 · Los textos de Meta en Ajustes voseaban.** **Nuevo, 2026-10-18; cerrado el 2026-10-18 (`65669f4`).** Al corte,
lo que «Probar conexión» le dice a quien carga el token usaba voseo: «Revisá» y «Probá», en los textos de cada falla
(`lib/meta/graph.ts:69`, `lib/meta/graph.ts:72`, `lib/meta/graph.ts:79-80`) y en el del navegador cuando el servidor
no contesta (`components/ajustes/ConexionConMeta.jsx:36`), y la prueba que vigilaba el voseo,
`pruebas/codigo/202-tools-no-vosea.test.ts`, miraba sólo Tools. Hoy esas líneas dicen «Revisa», «Prueba de nuevo» y
«avisa a desarrollo», y `pruebas/codigo/258-la-aplicacion-no-vosea.test.ts` mira `components/`, `lib/` y `app/`
enteros, fuera de Fundaciones. Lo que queda: 38 archivos de otras pantallas que todavía vosean, contados uno por uno
en esa prueba (`pruebas/codigo/258-la-aplicacion-no-vosea.test.ts:27-65`), que pone la suite en rojo si aparece uno nuevo.
