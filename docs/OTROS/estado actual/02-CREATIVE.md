# Creative Insights
> Corte: **2026-10-11**, con el código del commit de CF-5: `a54d80e` más los retoques de esa etapa —el `margin-top: 2px`
> de la tira (`app/creative.css:29`) y los textos que esta foto encontró falsos (riesgos 11 y 12)—. Las cifras de producción son de dos fechas y
> cada una lo dice: las del **2026-10-11**, medidas para `docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2
> con `scripts/supabase.mjs leer` (sólo lectura, sólo conteos, con el OK del usuario); y las del **2026-09-28**, de la
> foto anterior, que no se re-midieron. Para este corte no se leyó producción. La pantalla se miró en el navegador el
> 2026-10-11 (CF-5), en el preview local, contra el prototipo y con una respuesta sintética: lo que «dibuja» cada bloque
> con los datos de producción está deducido del código y de la medición. Las ventanas cuentan días del calendario con
> hoy incluido: lo que depende de la fecha vale para el día de su medición. Cada afirmación lleva su `archivo:línea`.
> Para ubicar lo nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del
> 2026-09-28, con la pantalla propia de tablas y sus mediciones pieza por pieza— se lee con
> `git show a54d80e:"docs/OTROS/estado actual/02-CREATIVE.md"`, y la del 2026-09-15 con
> `git show 93a1341:"docs/estado actual/02-CREATIVE.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-11.** La pestaña vuelve al marcado de
`aios-command-center_1.html:2746-2804`: la tira de seis cifras, «Ordenar por», la biblioteca partida en «Funciona» y
«No funciona» —cada pieza contra el promedio de SU etapa, no contra todas—, la tarjeta de cada pieza con su miniatura y
la ficha; debajo, «Lo demás, en cifras», con lo que la pantalla anterior medía y el prototipo no tenía. Todo sale de una
sola lectura del servidor, `lecturaDeCreative`, con un piso en toda tasa, y cada «—» dice por qué en una línea: el resto
lo explica el agente de Creative. Lo nuevo es la miniatura: GoHighLevel la da sólo pidiendo cada contacto por separado,
y desde el 2026-10-11 una pasada de hasta 50 contactos corre cada diez minutos. Al medir ese día había **0 de 597**
contactos con «Video Url»; esa noche la pasada llevaba 413 pedidos y **sólo 3 traían imagen, de una sola pieza** (riesgo 14). El último día con impresiones de
Meta es el **2026-10-05**: hubo entrega después del 13 de septiembre que la foto anterior daba como el último, y el
2026-10-11 ninguna pieza está «Entregando» (deducido: el estado mira los últimos 3 días).

> **Desde el corte del 2026-09-28**
>
> - **2026-09-29 · `1159c43`, `8fd0afd`** — CR-1 y CR-2: el link manual de cada pieza (`negocio.enlaces_de_pieza`,
>   migración `063`) y el cajón de la pieza con sus anuncios.
> - **2026-09-29 · `ecfbc26`** — CR-3: el token de Meta y la cuenta publicitaria, en Ajustes. Ningún cliente de la API
>   de Meta los usa todavía (§ 5).
> - **2026-10-01 · `4e9a242`** — E7 de la nueva estructura: la maqueta del Executive se va, y con ella lo que publicaba
>   en nombre de Creative (riesgo 8).
> - **2026-10-02 · `624a941`** — E11: la cabecera del departamento; con ella a la vista, `app/departamentos.css` oculta
>   el título y la bajada de las pantallas del prototipo.
> - **2026-10-05 · `13723a0`, `5f15c01`, `ddfec29`** — AG6, AG7 y AG10 de los agentes: las herramientas de Creative del
>   cerebro y su ruta (`app/api/creative/cerebro/route.ts`), y el detector de Creative Insights con sus cuatro reglas,
>   sus señales y el Plan de acción.
> - **2026-10-06 · `fe727e5`** — AG15 (4): el comentario de la cabecera llega con la pantalla.
> - **2026-10-07 · `22ec755`** — `076`: el gasto de toda la cuenta de Meta; la cabecera de Creative avisa si el de las
>   campañas no cuadra con él.
> - **2026-10-11 · `63b8cd1`** — CF-0: el usuario decide volver al front del prototipo con los datos reales. Nacen
>   `docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` (requisitos `CF1-01` a `CF1-19`) y
>   `docs/OTROS/futuro/lo-que-creative-no-mide.md`, con la medición de producción y tres `GET` a GoHighLevel.
> - **2026-10-11 · `90439cf`** — CF-1: `lib/negocio/lecturaDeCreative.ts`, los calificados en `calidadDelCreativo`,
>   `lib/negocio/miniaturaDelContacto.ts` y la migración `077`, colgada de la tarea `contactos`.
> - **2026-10-11 · `1971ab2`** — CF-2: la ruta y el cerebro sobre la lectura; herramienta nueva `creative_en_cifras`.
> - **2026-10-11 · `2415e25`** — CF-3: la pantalla nueva, `components/creative/comun.jsx`,
>   `components/creative/Miniatura.jsx` y `app/creative.css`; la sección deja la estética de operación y
>   `app/inteligencia-estetica.css` se borra.
> - **2026-10-11 · `d9c10e5`, `a54d80e`** — CF-4: la revisión adversarial de cuatro lentes (§ 7 del doc 16) y las citas
>   de Acquisition y Conversion que corrió. Ese mismo día la `077` se aplicó en producción y CF-1 a CF-4 se subieron.
> - **2026-10-11 · CF-5** — la comparación medida con el prototipo (§ 2), los textos que esta foto encontró falsos y
>   esta foto.

---

## 1 · Qué pide el documento

El documento funcional vive fuera del repositorio; `docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md` lo cita literal y
por línea. **No tiene una sección propia de Creative**: todo lo detallado está dentro del § 18, que es el de
Acquisition. El resumen es el de la foto anterior, y no se volvió a cotejar:

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

**Los indicadores del § 18.12, al 2026-10-11:** la retención inicial está como hook rate —vistas de video sobre
impresiones—, en la tira, la tarjeta y la ficha; el CTR, en la ficha y en «Lo demás»; la fatiga, como marca «Perdiendo
gancho» en la tarjeta y cuenta en «Lo demás»; la frecuencia, en la tira y la tarjeta, pesada por impresiones. El CPL
sigue sin construirse. Las caídas de retención, el placement, el formato y la duración siguen sin fuente por
GoHighLevel (§ 5). La otra mitad —hook, body, CTA, guion, variantes— exige leer la pieza: hoy llega su **imagen**, y
nada más.

Lo que pidió el usuario el 2026-10-11 —la forma del prototipo con el dato, y es un tablero— está en
`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 1, con cinco decisiones suyas y seis respuestas por omisión
(`CF1-P01` a `CF1-P06`, § 6 del mismo documento).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `lib/autorizacion/secciones.ts:265-277`: clave `creative`, nombre «Creative Insights», grupo
«Inteligencia», capacidad `tablero.ver`. La vista es `components/views/CreativeView.jsx:18-26`, el envoltorio del
prototipo `view-scroll cre-scroll`, **sin `estetica-op`** (CF1-01). El panel recarga cada 60 s sólo con la pestaña a la
vista (`components/creative/PanelDeCreative.jsx:110-112`, `lib/cadencia.ts:91`).

**La ruta.** `app/api/creative/route.ts:52-110`, un solo `GET`: pide `tablero.ver` al portero
(`app/api/creative/route.ts:56`), **rechaza** un período fuera de la lista (`app/api/creative/route.ts:62-63`) y, en una
sola transacción, lee `lecturaDeCreative`, las señales con su plan y el comentario de la cabecera
(`app/api/creative/route.ts:68-84`). La respuesta suma `pantalla`, lo que el tablero arma; `calidad`, `rendimiento`,
`fatiga` y `enlaces` siguen viajando de la misma lectura (`app/api/creative/route.ts:96-100`), y el panel no los lee.
Antes de CF-2 la ruta llamaba a cada módulo por separado (`app/api/creative/route.ts:76-81@90439cf`).

**La lectura.** `lib/negocio/lecturaDeCreative.ts` tiene una mitad pura, `armarCreative`
(`lib/negocio/lecturaDeCreative.ts:232-346`), y otra que lee: compone `calidadDelCreativo`, `rendimientoDelCreativo`,
`fatigaDelCreativo` y los links manuales con dos lecturas nuevas, la entrega de cada pieza y su miniatura
(`lib/negocio/lecturaDeCreative.ts:438-452`). Todo lo de `pantalla` viaja de 0 a 1; el navegador multiplica por 100 en
un solo lugar (`components/creative/comun.jsx:76`). La pieza es el nombre del anuncio normalizado, la misma llave de los
tres módulos (`lib/negocio/creativo.ts:44-46`).

**Lo que dibuja**, en el orden del panel, y lo que se sabe el 2026-10-11 a 30 días —el período con que abre
(`lib/negocio/periodo.ts:109`)—, deducido de la medición de ese día (no leído de la pantalla):

| bloque | dónde | el 2026-10-11, a 30 días |
|---|---|---|
| Encabezado: «Creative», «Qué funciona, qué no, y por qué», el «Plan de acción» real y el segmentado de los cuatro períodos | `components/creative/PanelDeCreative.jsx:117-132` | el título y la bajada, ocultos por la cabecera del departamento (`app/departamentos.css:209`) |
| La tira: Calificados · Agendas · Hook rate · Retención · Impresiones · Frecuencia; la del criterio elegido, marcada | `components/creative/PanelDeCreative.jsx:246-268` | no medido; Retención siempre «—», «GoHighLevel no lo entrega.» |
| La barra: «Ordenar por» —Calificados, Agendas, Hook rate, Impresiones— y «{N} piezas · {período}» | `components/creative/PanelDeCreative.jsx:196-201` | la medición contó 9 piezas a 30 días, con un predicado que no se comprobó contra el de la pantalla |
| «Funciona · sobre el promedio de su etapa» y «No funciona · bajo el promedio — pausar o iterar», con «{N} piezas» | `components/creative/PanelDeCreative.jsx:203-217` | no medido; abre por Agendas (`components/creative/PanelDeCreative.jsx:49`) |
| Cada tarjeta: la miniatura con su estado y, si la fatiga lo dice, «Perdiendo gancho»; el nombre, la etapa y las seis cifras | `components/creative/PanelDeCreative.jsx:350-400` | todas «Sin entrega» (el último día con impresiones es el 2026-10-05); miniaturas, ninguna URL al medir; después, no medido |
| «Lo demás, en cifras»: Gasto · CTR · Link CTR · Landing · Perdiendo gancho «{con} de {sobre}» | `components/creative/PanelDeCreative.jsx:406-434` | no medido |
| La tarjeta de señales, al final | `components/creative/PanelDeCreative.jsx:220` | — |

**La tira y la tarjeta** (CF1-06, CF1-09). Calificados y Agendas son conteos: los contactos de la pieza con un puntaje
de ICP de 75 o más (`lib/negocio/calidadDelCreativo.ts:228`, `lib/negocio/tramosDelIcp.ts:38`) y los que tienen una
cita alcanzable. Hook rate y Frecuencia de la tira son pesados, no el promedio de los promedios: las vistas sobre las
impresiones de los anuncio-día que traían la clave, y la frecuencia de cada pieza pesada con las impresiones de sus días
con frecuencia (`lib/negocio/lecturaDeCreative.ts:308-329`). Retención es siempre «—» con `sin_fuente`
(`lib/negocio/lecturaDeCreative.ts:281`). «Entregando» es haber tenido impresiones en alguno de los últimos 3 días del
calendario, hoy incluido (`lib/negocio/lecturaDeCreative.ts:378-379`). La etapa de la pieza es la de la campaña de la que
más impresiones tuvo; si esa campaña no la dice, la de sus contactos —la de más contactos, y en empate la que va antes
en el embudo— y si no, «Sin etapa» (`lib/negocio/lecturaDeCreative.ts:239-256`, `lib/negocio/lecturaDeCreative.ts:384-404`).
Una pieza entra a la pantalla si EN LA VENTANA trajo contactos, tuvo impresiones o gastó
(`lib/negocio/lecturaDeCreative.ts:258-263`). En la tarjeta, un «—» lleva su frase en el `title`, porque la celda mide
50 px (`components/creative/PanelDeCreative.jsx:391`, `app/creative.css:92`).

**«Funciona» es contra la etapa** (CF1-08). Para el criterio elegido, el servidor calcula el promedio de cada etapa
—pesado en el hook rate, simple en los conteos— y manda las dos listas ya ordenadas, de mayor a menor
(`lib/negocio/lecturaDeCreative.ts:184-229`); el navegador elige cuál dibujar y no ordena nada. Una pieza sin valor, o
de una etapa sin promedio, va a «No funciona» (`lib/negocio/lecturaDeCreative.ts:207-209`; ver riesgo 9). La que es la
única de su etapa con valor va a «Funciona» con la etiqueta «Única de su etapa.»
(`lib/negocio/lecturaDeCreative.ts:211`, `components/creative/PanelDeCreative.jsx:385`). Sin ningún promedio en ninguna
etapa, el subtítulo de «Funciona» dice el del prototipo, «sin datos en este periodo»
(`components/creative/PanelDeCreative.jsx:191`, `components/creative/PanelDeCreative.jsx:206`).

**«Lo demás, en cifras»** (CF1-13): el gasto total del módulo de rendimiento, y el CTR, el link CTR y la landing de la
ventana entera, con el piso de 1000 impresiones; «Perdiendo gancho» cuenta las piezas fatigadas sobre las que **tienen
veredicto**, y sin ninguna dice «Sin días suficientes para medir el gancho.» (`lib/negocio/lecturaDeCreative.ts:337-344`,
`components/creative/PanelDeCreative.jsx:413`).

**La ficha** (CF1-10, `components/creative/FichaDelCreativo.jsx:82-183`): el cajón del prototipo, en un portal sobre
`document.body`, con el veredicto contra la etapa —«✓ Funciona» con su cifra, o «✕ Bajo en…»—
(`components/creative/FichaDelCreativo.jsx:91-97`) y cinco secciones: **La pieza**, con la miniatura grande, «Ver en
Facebook/Instagram» y el editor del link manual (`components/creative/FichaDelCreativo.jsx:104-118`); **Qué es**, con la
etapa, el estado, los anuncios, el primer y el último día con entrega, la pieza, y Formato, Ángulo, Duración y Dolor en
«—» (`components/creative/FichaDelCreativo.jsx:120-134`); **Datos de la pieza**, las seis de la tira más el gasto, el CTR,
el link CTR, la landing y el click-to-landing, con la línea de cada «—» debajo
(`components/creative/FichaDelCreativo.jsx:136-151`); **Retención y guion**, en «—»
(`components/creative/FichaDelCreativo.jsx:153-158`); y **los anuncios de la pieza**, por impresiones, con los últimos
seis dígitos del id (`components/creative/FichaDelCreativo.jsx:160-178`). El foco entra al abrirla, vuelve a la tarjeta al
cerrarla, no sale del cajón con el tabulador, y Escape dentro del campo del link no cierra
(`components/creative/FichaDelCreativo.jsx:49-72`). El editor del link se dibuja con `puedeConfigurarComisiones`
(`components/creative/PanelDeCreative.jsx:179`), que la sesión arma con `credenciales.editar`
(`app/api/auth/sesion/route.ts:141`), lo mismo que pide el servidor (`app/api/creative/enlace/route.ts:60`).

**La miniatura** (CF1-11, CF1-12). La escribe una pasada colgada de la tarea `contactos`, después de sincronizar
(`lib/negocio/barrido.ts:823-827`), que corre cada diez minutos (`lib/negocio/barrido.ts:203-207`). Pide
`GET /contacts/{id}` (`lib/ghl/cliente.ts:545`) para los contactos con `adId` o `mediumId` en su primera atribución que
todavía no se pidieron, de los más recientes a los más viejos, hasta 50 por pasada
(`lib/negocio/miniaturaDelContacto.ts:72-84`), y guarda una fila por contacto pedido —también sin dato, o rechazado por
el CRM— en `negocio.miniaturas_del_contacto` (`db/migraciones/077_la_miniatura_del_contacto.sql:18-32`), sin pisar lo
guardado (`lib/negocio/miniaturaDelContacto.ts:168-175`). Cada pedido espera hasta 15 s y la pasada entera hasta 60
(`lib/negocio/miniaturaDelContacto.ts:40`, `lib/negocio/miniaturaDelContacto.ts:43`); un 429, un 401 o un GoHighLevel que
no contesta la cortan (`lib/negocio/miniaturaDelContacto.ts:118-122`), y el sello de la tarea dice por qué
(`lib/negocio/barrido.ts:900-910`). La miniatura de la pieza es la imagen más frecuente entre sus contactos —el `videoUrl`
o, si no hay, el `photoUrl`—, en empate la del contacto que entró más tarde al CRM, y sólo si su host es de Facebook,
Instagram o el CDN de Meta (`lib/negocio/miniaturaDelContacto.ts:183-207`). El navegador la pide sin `referrer` y con
carga perezosa; sin URL dice «Sin miniatura todavía.», y si la imagen no carga queda el fondo del prototipo
(`components/creative/Miniatura.jsx:11-24`).

**Cada «—» dice por qué, con una frase de una lista cerrada.** Siete motivos
(`lib/negocio/lecturaDeCreative.ts:46-53`), cada uno con su frase (`components/creative/comun.jsx:26-34`), más el «—»
mismo, la miniatura, la fatiga, el grupo vacío, la única de su etapa, la primera carga y el fallo: catorce frases en
`FRASE` (`components/creative/comun.jsx:8-23`), las mismas de la tabla de CF1-02, y
`pruebas/codigo/254-la-pantalla-de-creative.test.ts:227` exige que coincidan en las dos direcciones. Un cero es un cero
medido. Una tasa chica lleva un decimal debajo del 10 % (`components/creative/comun.jsx:86-89`). No se dibujan la
cobertura del puente nombre↔anuncio, los avisos, las ventanas de cada fuente ni la lista de lo que no se puede medir
(CF1-05): viajan en la respuesta y en las herramientas del cerebro, y
`pruebas/codigo/254-la-pantalla-de-creative.test.ts:380` vigila que no vuelvan.

**Los desvíos de rótulo**, declarados en CF1-02: «Impresiones» por «Alcance», porque el alcance diario no se suma;
«Entregando» / «Sin entrega» por «Activo» / «Pausado», porque no se sabe si alguien la pausó; la etapa en lugar de las
etiquetas de formato y ángulo; el nombre de la pieza por su número; «sobre el promedio de su etapa»; «Primer día con
entrega» por «Publicado»; «Datos de la pieza» por «Datos del video»; «Retención y guion» en una sola sección y en «—»;
«Plan de acción» por «Recomendaciones y conclusiones»; y la tira de a seis hasta 760 px, porque eso dibujaba el
prototipo.

**Ventanas y piso.** Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), sin comparación contra la
ventana anterior. Dos poblaciones, con la misma cantidad de días: la COHORTE de contactos por `alta_en_el_crm` para
Calificados y Agendas (`lib/negocio/calidadDelCreativo.ts:238`) y los ANUNCIO-DÍA por fecha para todo lo de Meta
(`lib/negocio/costoDelAnuncio.ts:83-85`). Las dos cuentan días del calendario con hoy incluido, no días cerrados como
Acquisition. Toda tasa sobre impresiones lleva el piso de 1000 (`lib/negocio/rendimientoDelCreativo.ts:69`,
`lib/negocio/lecturaDeCreative.ts:161-167`); el click-to-landing, el de 10 clics al enlace de su módulo
(`lib/negocio/lecturaDeCreative.ts:297-302`). La tira y la tarjeta no dibujan tasas sobre contactos.

**El plan.** El «Plan de acción» es `BotonDelPlan` (`components/senales/SenalesDelDepartamento.jsx:120`) con las señales
que trae la ruta (`components/creative/PanelDeCreative.jsx:125`): el plan de 7 días con «7 días» y el de 30 con «30 días»;
con «Hoy» y «Completo» no hay plan (`app/api/creative/route.ts:67`). El detector tiene cuatro reglas —la caída del CTR,
la concentración del gasto, la frecuencia alta y el ICP de la pieza contra su etapa—
(`lib/agentes/detectores/creative.ts:34-39`) y mide con los mismos tres módulos y los mismos días que la pantalla
(`lib/agentes/detectores/creative.ts:100-107`); el plan las reparte en cuatro grupos
(`lib/agentes/plan/creative.ts:24-29`). El comentario de la cabecera mira la frescura de la tarea `anuncios` y el cuadre
del gasto de las campañas contra el de la cuenta (`lib/agentes/cabecera.ts:122-130`).

**El cerebro.** Cuatro herramientas en `lib/agentes/executive/adaptadores/creative.ts`: `calidad_de_piezas`,
`rendimiento_de_piezas`, `fatiga_de_piezas` y **`creative_en_cifras`**
(`lib/agentes/executive/adaptadores/creative.ts:114-136`), que lee la misma lectura que la ruta y devuelve su `pantalla`
con el motivo de cada «—», **sin las URLs**: cada pieza lleva `conMiniatura` y `conEnlace`, campo por campo por lista
blanca (`lib/agentes/executive/adaptadores/creative.ts:20-36`). La compara con la de la ruta, en los cuatro períodos,
`pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:102`, y con una miniatura y un enlace sembrados
mira que ninguna URL llegue al cerebro (`pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:300`). Las
otras tres traen los avisos que la pantalla no dibuja. La frescura de las tres tareas de las que vive la pantalla la da
`frescura` (`lib/agentes/executive/adaptadores/plataforma.ts:40`).

**Lo que se midió en el navegador (CF-5, 2026-10-11).** Estilos computados del prototipo servido en local contra la
app en el preview, con una respuesta sintética, a 1440, 1180, 1125 y 375 px. **Iguales al prototipo**: el `h2` de 19 px y
la bajada de 12,5 px (`app/aios.css:744-745`); la celda de la tira con relleno de 12 y 14 px, radio 12, rótulo de 11 px,
cifra de 21 px y línea de 10 px (`app/creative.css:31-44`); la píldora de «Ordenar por», 7 y 12 px de relleno y radio 10
(`app/aios.css:620-622`); los encabezados de grupo, con margen de 18 px arriba y 10 abajo y título de 15 px
(`app/aios.css:705`, `app/aios.css:709`); la tarjeta con radio 14 y borde superior de 2 px
(`app/creative.css:58-69`), la miniatura en 16:9 (`app/creative.css:71`), y las seis cifras en tres columnas de celdas de
50 px de alto, con rótulo de 9,5 px y cifra de 15 px (`app/creative.css:89-96`). **Los anchos**: la tira va de a seis a
1440, 1180 y 1125 px, como el prototipo, y de a dos a 375 (`app/creative.css:150-158`); las tarjetas, 4 por fila a 1440
(el prototipo, 3) y 3 a 1180 y 1125 (el prototipo, 2): el área del prototipo es más angosta por su propio armazón, y la
rejilla es la misma (`app/creative.css:56`). A 375 px el prototipo no es usable —queda en 564 px de ancho y la tira se
aplasta a 29 px por celda— y la app no desborda a lo ancho; la ficha ocupa el ancho y sus rejillas van de a dos
(`app/creative.css:159-165`). El foco vuelve a la tarjeta al cerrar con Escape. El título y la bajada del panel no se
ven: los oculta la cabecera del departamento, igual que en Conversation. **No se pudo comprobar** si una imagen real de
`facebook.com/ads/image` carga o pide sesión (`CF1-P06`): no había ninguna en la base local, y no se copian URLs de
producción. Las pruebas: `pruebas/codigo/252-lectura-de-creative.test.ts`, `pruebas/base/252-lectura-de-creative.test.ts`,
`pruebas/base/253-la-miniatura-del-contacto.test.ts` y `pruebas/codigo/254-la-pantalla-de-creative.test.ts`.

**Quién la ve.** Quien tenga `tablero.ver`, la capacidad que comparten siete pantallas
(`app/api/creative/route.ts:53-56`). Cargar el link manual pide además `credenciales.editar`.

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

**Ningún nombre de la maqueta se copió** (CF1-17): `pruebas/codigo/254-la-pantalla-de-creative.test.ts:329` lee del
prototipo los nombres, formatos, ángulos y dolores de las ocho piezas y exige que ninguno aparezca en la vista, el
panel, la ficha, `comun.jsx` ni la miniatura. Los nombres que dibuja la pantalla son de anuncios reales, que son de
piezas y no de personas; esta foto no los copia.

**Lo que Executive inventaba en nombre de Creative ya no existe**: la maqueta del Executive se retiró el 2026-10-01
(`4e9a242`), y con ella las «8 piezas activas» con punto verde, el «hook nuevo» que costaba ventas y la caída del VSL
que Creative «asumía» (la foto anterior los listaba en su § 3, con sus citas fijadas en `c4cf2a8`).

**El galón `›` del menú.** La sección sigue declarando `galon: true` (`lib/autorizacion/secciones.ts:276`), y su
comentario lo defiende citando una línea de la foto anterior (`lib/autorizacion/secciones.ts:272-275`); desde la barra
nueva de la etapa E10 (`40f699a`, 2026-10-02) ninguna línea de `components/`, `app/` ni `lib/` lee `menu.galon` (grep
del 2026-10-11).

---

## 4 · Datos que ya tenemos

**Medido el 2026-10-11**, con `scripts/supabase.mjs leer`, sobre la organización de la empresa
(`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` § 2):

| qué | cuánto |
|---|---|
| contactos | 597 |
| con `videoUrl` en `atribucion_primera` (ni `postId` ni `igSid`) | **0** |
| con `adId` | 215 |
| con `utmContent`, el nombre de la pieza | 508 |
| piezas en toda la historia · a 30 días | 32 · 9, ninguna con una URL |
| contactos que entraron desde el 2026-09-30 | 14, casi todos de la campaña de mensajes de Instagram: traen `sessionSource`, `medium` y `mediumId`, y sólo uno `adId` |
| último día con impresiones de Meta | **2026-10-05** |

Y con tres `GET` a GoHighLevel, que imprimieron sólo nombres de campos y hosts: **`GET /contacts/{id}` trae el «Video
Url»** —en `attributionSource`, `videoUrl` con host `www.facebook.com`, `photoUrl`, `postId` e `igSid`— y
**`POST /contacts/search`, que usa la sincronización, no**. Por eso la ingesta, que guarda toda clave escalar
(`lib/ghl/cliente.ts:215-226`, `lib/negocio/sincronizar.ts:443-448`), no tenía nada que guardar, y la pasada de CF1-11
existe. Las cuatro claves se guardan aparte porque la sincronización pisa `atribucion_primera` en cada pasada
(`db/migraciones/077_la_miniatura_del_contacto.sql:4-10`). **No se midió** cuántas filas escribió la pasada desde que
se subió, ni cuántas trajeron imagen.

**Del 2026-09-28, no re-medido** (la foto anterior, § 4), sobre los 276 contactos de 30 días de entonces: el nombre de
la pieza (`utmContent`) en el 93,1 %, la campaña en el 90,6 %, el `adId` en el 72,1 %; el puntaje «Puntaje | ICP» como
número en 271, 22 de ellos en 0. De Meta por GoHighLevel: 79 anuncios de 12 campañas, que son **32 piezas**, 21 en más
de un anuncio; y sobre las filas anuncio-día con desglose y entrega, `videoView` en el 93,3 %, `linkClick` en el 71,3 %,
`landingPageView` en el 62,5 % y `postEngagement` en el 93,8 %. **Lo que medía la pantalla anterior** ese día, a 30
días: el ICP promedio de las piezas sobre el piso iba de 29,2 a 71,0 (factor 2,4), la tasa de agenda de 31 % a 78 %, y
el click-to-landing de 12,0 % a 91,4 % entre las ocho piezas con tasa. Esas cifras son de un período con la pauta
detenida desde el 2026-09-14; el 2026-10-11 se sabe que volvió a entregar hasta el 2026-10-05, y no se re-midieron.

**El ICP por contacto** se lee del campo del CRM por su nombre exacto (`lib/negocio/calidadDelCreativo.ts:63`); Leads
Portal lee la copia en `contactos.score`. **Las agendas por pieza** salen de `tieneCitaAlcanzable`
(`lib/negocio/citasAlcanzables.ts:135`), con un `exists` y no un `join`: un contacto con dos citas cuenta una vez.

**Lo guardado que la pantalla no dibuja**: la interacción (`postEngagement`), el CPM y el CPC de cada pieza, el ICP
promedio, la tasa de agenda, las congeladas y la cobertura del puente, todo en `calidad` y `rendimiento`; y del
detector, la frecuencia por anuncio de 7 días (`lib/agentes/detectores/creative.ts:129`). El link manual de cada pieza
(`negocio.enlaces_de_pieza`, `db/migraciones/063_el_enlace_de_la_pieza.sql:29`) sí se usa: manda sobre la miniatura en
«Ver en…» (`lib/negocio/lecturaDeCreative.ts:287`). Cuántos hay cargados no se midió.

**El Espía de Anuncios**, en Tools (`components/tools/EspiaDeAnuncios.jsx`, `app/api/tools/espia/route.ts`), pide a la
IA hooks, ángulos y estructuras de copy de anuncios de la competencia (`lib/tools/espia.ts:84-92`). Sigue siendo lo único
del producto que lee el texto de una pieza, y mira hacia afuera.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Lo que la pantalla no mide, y qué haría falta, está en `docs/OTROS/futuro/lo-que-creative-no-mide.md`. En resumen:

**1 · La retención y la curva.** El `fields` de GoHighLevel es un enum cerrado de once valores, y los cuartiles de
video dan 422 (C14-04, C14-05). La cifra «Retención» de la tira y de la tarjeta, y la sección de la ficha, van en «—».
Meta directo daría cuatro cuartiles, no una curva.

**2 · El formato, el ángulo, la duración y el dolor.** Ningún sistema conectado los guarda: del anuncio, GoHighLevel
devuelve cuatro campos (C14-07). Haría falta una convención de nombres de anuncio que los lleve, o un formulario por
pieza.

**3 · El guion y dónde se cae la atención.** No hay transcripción, y la retención en cuartiles no señala un segundo.

**4 · El placement y los desgloses demográficos.** `groupBy` sólo acepta `day`, `week` y `month` (C14-06).

**5 · El video y el copy.** La **imagen** llega desde el 2026-10-11 por `GET /contacts/{id}`; el video y el copy siguen
sin ruta en GoHighLevel (C14-08). La credencial de Meta existe en Ajustes desde
`ecfbc26`, y no hay cliente de la API de Meta en el repositorio: buscando `graph.facebook` en `lib/`, `app/` y `scripts/`
no aparece ninguno (2026-10-11). El plan está en `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.

**6 · La miniatura de los contactos sin anuncio.** Una pieza cuyos contactos no traen `adId` ni `mediumId` no se pide
(`lib/negocio/miniaturaDelContacto.ts:76`), y un contacto sin nombre de pieza no aporta su imagen a ninguna
(`lib/negocio/miniaturaDelContacto.ts:191`): para esas, Meta directo o el link manual.

**7 · Los cierres.** Sin ventas registradas no hay CPA, ROAS ni «qué pieza genera más dinero». Según la foto de Sales,
siete resultados y ninguno con monto ([05-SALES.md](05-SALES.md)); no re-medido acá.

**8 · La asistencia.** Según la foto de Conversation, 0 de 169 citas con la asistencia marcada el 2026-10-10
([04-CONVERSATION.md](04-CONVERSATION.md)): del embudo por pieza se mide contacto → cita, y ahí se corta.

**Tres que llegan y no se usan, a propósito**: la frecuencia y el alcance no se suman a lo largo de días ni de anuncios
—la pantalla publica impresiones, y la frecuencia pesada—; `results.lead` cuenta el mismo hecho dos veces (C14-15); y
qué cuenta `videoView` no está documentado (C14-P01). **Los umbrales siguen sin calibrar**: el piso de 1000
impresiones (`lib/negocio/rendimientoDelCreativo.ts:69`), los ocho días de serie
(`lib/negocio/fatigaDelCreativo.ts:53`) y el 20 % de caída (`lib/negocio/fatigaDelCreativo.ts:68`); el § 18.19 los tiene
pendientes.

---

## 6 · Reglas propias

Las transversales —el silencio, el piso de 10, los dos ceros— están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). Las de este departamento:

**1 · La unidad es la PIEZA, no el anuncio.** La llave es el nombre normalizado, en un solo lugar
(`lib/negocio/creativo.ts:44-46`). Agrupar por `adId` borraba una campaña entera: el 2026-09-28 los contactos con
`adId` eran exactamente los de TOFU, y ninguno de BOFU lo traía.

**2 · El mismo creativo vive en varios anuncios.** La ficha dice en cuántos (`components/creative/FichaDelCreativo.jsx:125`)
y los lista; es la única mitigación de que dos piezas distintas con el mismo nombre se fundan
(`lib/negocio/calidadDelCreativo.ts:92-100`).

**3 · «Funciona» es contra la etapa, y una etapa no se compara con otra** (CF1-08). El promedio es por etapa
(`lib/negocio/lecturaDeCreative.ts:188-200`), y la etapa se lee del nombre de la campaña por segmento exacto
(`lib/negocio/creativo.ts:53-66`); lo que no la trae es «Sin etapa», un grupo y no una etapa forzada.

**4 · Un «—» dice por qué, y un cero es un cero medido.** Siete motivos (`lib/negocio/lecturaDeCreative.ts:46-53`),
cada uno con su frase de una lista cerrada (CF1-02, `components/creative/comun.jsx:26-34`).

**5 · Toda tasa lleva su piso**, en la lectura: 1000 impresiones para las tasas sobre impresiones, 10 clics al enlace
para el click-to-landing (`lib/negocio/lecturaDeCreative.ts:161-167`).

**6 · El servidor calcula; el navegador dibuja.** Todo viaja de 0 a 1 y se multiplica por 100 en un solo lugar
(`components/creative/comun.jsx:76`); los grupos y su orden llegan hechos. Lo que el cerebro dice de una cifra es lo
que se dibuja (CF1-16).

**7 · Es un tablero: cifras con su rótulo, y la explicación es del agente** (CF1-05).

**8 · La tira suma y pesa; no promedia promedios** (`lib/negocio/lecturaDeCreative.ts:308-329`).

**9 · Ningún dato de una persona en la pantalla, y ninguna URL en el cerebro** (CF1-17, CF1-16). Los nombres son de
piezas; las cifras de contactos son conteos; el cerebro sabe si hay miniatura, no cuál
(`lib/agentes/executive/adaptadores/creative.ts:31-32`).

**10 · Una imagen de afuera, sólo de hosts conocidos y sin decir de dónde se la mira.** Las listas de hosts son
cerradas y exactas (`lib/negocio/urlExterna.ts:43-56`); la imagen se pide sin `referrer`
(`components/creative/Miniatura.jsx:17`).

**11 · Cada contacto se pide una sola vez.** Lo pedido queda en la tabla aunque no traiga nada o el CRM rechace ese
contacto; sólo lo que no se pudo pedir —un 5xx, el cupo, la credencial, un GoHighLevel que no contesta— se vuelve a pedir
(`lib/negocio/miniaturaDelContacto.ts:110-123`). La tabla tiene un solo escritor
(`pruebas/base/253-la-miniatura-del-contacto.test.ts:224`).

**12 · Lo que Creative NO calcula.** El gasto se consume del módulo de rendimiento, que lo toma de `costoDelAnuncio`; el
conteo de contactos sale de contactos nuestros y no de `results.lead`; la retención del VSL es de Conversion, y el
revenue y el CAC, de Business.

**13 · Una cifra por contacto se cuenta por contactos, no por sus citas**: un `exists` compartido y no un `join`
(`lib/negocio/calidadDelCreativo.ts:229-235`, `lib/negocio/citasAlcanzables.ts:135`).

**14 · La ventana es una palabra de una lista cerrada**, y lo que no está se rechaza
(`app/api/creative/route.ts:59-63`).

---

## 7 · Riesgos

Los 8 de la foto anterior, con su estado al 2026-10-11, y siete nuevos.

**1 · La pantalla describía un período que terminó, y no lo decía.** **Cambió.** Cada tarjeta dice «Entregando» o «Sin
entrega» (`lib/negocio/lecturaDeCreative.ts:276`), la ficha dice el último día con entrega
(`components/creative/FichaDelCreativo.jsx:130`), y la cabecera avisa si la lectura de los anuncios está vieja o si el
gasto no cuadra con el de la cuenta (`lib/agentes/cabecera.ts:122-130`). Lo que sigue sin decirse es la fecha de las
cifras de la tira: el 2026-10-11 dibuja las impresiones de 30 días con todas las piezas «Sin entrega» (deducido). Si la pauta no
vuelve, desde el 2026-11-04 la ventana de 30 días no tiene ningún día con entrega (deducido de
`lib/negocio/costoDelAnuncio.ts:83-85` y del último día medido).

**2 · El mismo ICP se lee distinto en dos lugares.** **Cambió.** La pantalla ya no dibuja el ICP promedio: «Calificados»
usa el umbral de 75 de los tramos, con el que un cero nunca es alto. Pero `calidadDelCreativo` sigue promediando los
ceros como ceros (`lib/negocio/calidadDelCreativo.ts:225`), Leads Portal los cuenta como «sin calificar»
(`lib/negocio/tramosDelIcp.ts:86`), y con ese promedio decide la regla del ICP del detector, que llega al Plan de
acción. Las dos pantallas leen además dos copias del mismo puntaje.

**3 · El CTR bajo el piso salía como un guion pelado.** **Cerrado** en CF-3 (`2415e25`): toda cifra en «—» lleva su
línea, debajo en la tira y en la ficha (`components/creative/PanelDeCreative.jsx:261-263`,
`components/creative/FichaDelCreativo.jsx:200-208`). En la tarjeta va en el `title`
(`components/creative/PanelDeCreative.jsx:391`), que en un teléfono no se ve.

**4 · «Hoy» dice 24 horas y calcula el día.** **Abierto.** El botón lleva de título el matiz de `PERIODOS`
(`lib/negocio/periodo.ts:84`, `components/creative/PanelDeCreative.jsx:160`), y las dos ventanas son días del calendario
(`lib/negocio/calidadDelCreativo.ts:238`, `lib/negocio/costoDelAnuncio.ts:83-85`). «Entregando» también depende de
`current_date` (`lib/negocio/lecturaDeCreative.ts:379`), y la zona de la sesión de la base no se verificó.

**5 · La misma ventana, escrita muchas veces.** **Abierto, y suma una.** `calidadDelCreativo` repite a mano el predicado
de la cohorte en cuatro lugares (`lib/negocio/calidadDelCreativo.ts:238`, `lib/negocio/calidadDelCreativo.ts:277`,
`lib/negocio/calidadDelCreativo.ts:294`, `lib/negocio/calidadDelCreativo.ts:341`) en vez de usar el que exporta
`lib/negocio/recorrido.ts:201-203`. Y desde CF-1 las impresiones y los clics de cada pieza se suman dos veces sobre las
mismas filas: en el módulo de rendimiento, por `costoDelAnuncio` (`lib/negocio/costoDelAnuncio.ts:295-296`), y en
`entregaDeLasPiezas` (`lib/negocio/lecturaDeCreative.ts:368-369`). Hoy dan lo mismo —las dos con `ventanaDeMetricas`—;
si una cambia su filtro, la ficha y `rendimiento_de_piezas` dirán dos impresiones para la misma pieza.

**6 · Un `results` con otra forma se tiraría en silencio.** **Abierto**, sin cambios: un arreglo devuelve
`acciones: null` (`lib/ghl/anuncios.ts:209`), y el hook rate, el link CTR y la landing pasarían a «GoHighLevel no lo
reportó.» sin ningún contador.

**7 · Los comentarios citan líneas que se corrieron.** **Abierto.** `lib/negocio/rendimientoDelCreativo.ts:119` y
`lib/negocio/rendimientoDelCreativo.ts:235` mandan a las líneas 158 a 165 de `costoDelAnuncio` por «el defecto de
grano», y `lib/negocio/costoDelAnuncio.ts:158-165` habla de `desde` y `hasta`; `lib/negocio/rendimientoDelCreativo.ts:225`
manda a la 296 por el `gasto is not null`, que está en `lib/negocio/costoDelAnuncio.ts:297`. **Y esta reescritura suma
un caso**: cuatro comentarios de código, una prueba y ocho documentos citan esta foto por línea —por ejemplo
`lib/negocio/calidadDelCreativo.ts:233`, que manda a
`docs/OTROS/estado actual/02-CREATIVE.md:445-448@a54d80e`, y `lib/autorizacion/secciones.ts:272`, que manda a
`docs/OTROS/estado actual/02-CREATIVE.md:225-226@a54d80e`— y desde esta reescritura esas líneas dicen otra cosa.

**8 · Executive publicaba un Creative sano y activo.** **Cerrado** el 2026-10-01 (`4e9a242`).

**9 · «No funciona» junta lo que está bajo el promedio con lo que no tiene dato.** **Nuevo.** Una pieza sin valor para
el criterio va a «No funciona» (`lib/negocio/lecturaDeCreative.ts:207-209`), bajo el rótulo «bajo el promedio — pausar
o iterar» (`components/creative/PanelDeCreative.jsx:214`). Lo heredó del prototipo, que hacía lo mismo
(`lib/aios/creative.js:195@833fc51`), y CF1-08 lo declara. Con hook rate o impresiones, una pieza que sólo trajo
contactos en la ventana se lee como una pieza que hay que pausar.

**10 · La tira no cuenta a los contactos sin pieza.** **Nuevo.** La calidad sin nombre de pieza se salta
(`lib/negocio/lecturaDeCreative.ts:245`), así que Calificados y Agendas suman sólo a los contactos que trajo alguna pieza
(`lib/negocio/lecturaDeCreative.ts:319-320`). El 2026-09-28 eran 19 de 276 sin nombre de pieza, 15 con cita. La
pantalla anterior los dibujaba como una fila; hoy las Agendas de la tira pueden no coincidir con las de Sales o
Conversation, y nada lo dice.

**11 · «Calificados» decía dos cosas.** **Cerrado en CF-5.** En la tira son los contactos de ICP alto
(`lib/negocio/calidadDelCreativo.ts:84-88`); la frase de la regla del ICP del Plan de acción decía «sobre N calificados con
puntaje» para los que traen el puntaje, cualquiera sea (`lib/agentes/detectores/creative.ts:285`). Desde el corte dice
«sobre N contactos con puntaje» (`lib/agentes/plan/creative.ts:57`).

**12 · Textos que la miniatura volvió falsos.** **Cerrado en CF-5.** La lista de lo que GoHighLevel no da decía que la
miniatura no tenía ruta, y viajaba así al cerebro en `rendimiento_de_piezas`
(`lib/agentes/executive/adaptadores/creative.ts:76`); ahora dice que llega por el «Video Url» y sólo para las piezas
cuyos contactos la traen (`lib/negocio/rendimientoDelCreativo.ts:159-163`). El comentario del barrido que lista qué
tareas informan un motivo nombra `contactos` (`lib/negocio/barrido.ts:606-607`), y el detector ya no dice que su
promedio de ICP lo muestra la pantalla (`lib/agentes/detectores/creative.ts:253-256`).

**13 · La miniatura no se vio cargar.** **Nuevo** (`CF1-P06`). No se sabe si la imagen de `facebook.com/ads/image` carga
sin sesión ni cuánto dura. Si no carga, la tarjeta queda con el fondo y sin frase (`components/creative/Miniatura.jsx:16-20`),
distinta de la que dice «Sin miniatura todavía.», y nada cuenta cuántas fallan. Además, sin link manual, «Ver en
Facebook» abre esa misma imagen y no la publicación (`lib/negocio/lecturaDeCreative.ts:272`,
`lib/negocio/lecturaDeCreative.ts:287`).

**14 · La pasada trae muy pocas miniaturas.** **Nuevo.** Corre desde el 2026-10-11 en producción; medido el 2026-10-11 a las 22:10 UTC, con una lectura de sólo conteos y el OK del usuario: la pasada llevaba **413 contactos pedidos** en unas ocho corridas —406 devueltos, 7 no—, **159 pendientes**, y **sólo 3 con imagen**, los tres con «Video Url» en `www.facebook.com` y de **una sola pieza**; ninguna de más de 500 caracteres. Casi
todas las piezas van a decir «Sin miniatura todavía.», y por qué GoHighLevel trae tan pocos «Video Url» no se midió. Los contactos que sólo traen `mediumId` —la campaña de mensajes— también se piden
(`lib/negocio/miniaturaDelContacto.ts:76`), y el único de esa campaña que se pidió a mano el 2026-10-11 no traía las
claves: si es la regla, cada uno cuesta un pedido y queda como «sin dato», una sola vez.

**15 · La pantalla no se vio con los datos de producción.** **Nuevo**: CF-5 la midió con una respuesta sintética; la
revisión del usuario en producción está pendiente. **El cuello de botella de Creative no es técnico**: la pantalla
está, con todo lo que el sistema mide, y la mitad que el § 18.12 le reserva —leer la pieza— sigue sin fuente más allá
de su imagen.
