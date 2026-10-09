# Leads Portal
> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **18:03 y las 18:14
> UTC**, con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió un nombre, un correo
> ni un teléfono. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15**
>
> - **La foto anterior no tenía este archivo.** Leads Portal no es de Inteligencia sino del grupo
>   AIOS, y la carpeta no le dedicaba ninguna sección: lo nombraba en el mapa del producto de
>   [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) (en su versión de `93a1341`, el párrafo
>   «El mapa del producto») y, al pasar, en tres piezas de la maqueta que citaban
>   [01-ACQUISITION.md](01-ACQUISITION.md), [03-CONVERSION.md](03-CONVERSION.md) y
>   [05-SALES.md](05-SALES.md) de ese commit (la decisión que le adjudicaba a Acquisition, las
>   cadenas `Clarity` y `VTurb` del módulo y el botón `lpPlanBtn`). Ese día la pestaña era una
>   maqueta: en el árbol de `93a1341`, `lib/aios/leads-portal.js` tenía 324 líneas y la sección
>   `contacts` llevaba `sinOperacionesTodavia` (línea 225 de `lib/autorizacion/secciones.ts` en ese
>   commit).
> - **2026-09-26, ocho commits, ninguna migración.** `b796229` LP-0, la carpeta de requisitos
>   `docs/leads-portal/` (quince archivos) medida contra producción y el ICP interno a futuro;
>   `b04fb6c` LP-1, los tramos; `d97848e` LP-2, la cohorte por persona; `db120a1` LP-3, la ficha que
>   sólo lee; `3c361a1` LP-4, las dos rutas y la bandera bajada; `02f70e7` LP-5, el panel, los
>   filtros y la ficha; `aed4f27` LP-6, se borra la maqueta; `4fc9e43` LP-7, el README, una
>   actualización fechada de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), dos líneas de
>   `docs/leads-portal/12-QUIEN-VE-QUE.md` y el comentario de `secciones.ts`.
> - **2026-09-28, sólo documentos.** `e630823` mudó `docs/futuro/` y esta carpeta a `docs/OTROS/`, y
>   `1c55149` reapuntó las rutas; en el código de la pestaña eso tocó sólo tres comentarios, en
>   `citasAlcanzables.ts` y `tramosDelIcp.ts` (`git show 1c55149`). Ninguna línea ejecutable cambió
>   después de `4fc9e43`; lo que el árbol de trabajo tiene sin commit en `citasAlcanzables.ts`,
>   `cadenaDeCierre.ts` y `secciones.ts` a la hora de este corte también son comentarios (`git diff`).
> - **Lo que queda del lado del usuario:** la prueba de humo con sesión iniciada y tres preguntas
>   abiertas —`LP05-P02`, `LP08-P01`, `LP04-P01`— (§ 5).

**Construido — desde el 2026-09-26.**

La pestaña dibuja la cohorte real: a 30 días, que es como abre, son **277 personas** —sin calificar
29 · ICP alto 50 · ICP medio 81 · ICP bajo 117— y **139 agendaron**, contadas con los mismos
predicados que Sales, Creative y Conversion. Lo que más le falta no es un dato que haya que traer:
**0 asistencias registradas en 333 citas y 0 ventas en toda la base**, así que el cierre y el monto
se dibujan «—» con su motivo. Y la ventana por omisión se está vaciando: **desde el 2026-09-14
entraron 8 contactos**, y a mediados de octubre «30 días» va a quedar debajo del piso de 10 si la
pauta sigue pausada.

---

## 1 · Qué pide el documento

**El documento funcional no tiene esta pantalla.** La palabra «portal» aparece cero veces en sus
1.650 líneas; lo que tiene es una entidad, «Lead Profile» (§ 5.1, línea 205), y el «Perfil resumido
del lead» (§ 5.3, líneas 240-265), los dos de la capa de datos compartida y no de un departamento
(`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:17-24`). El documento vive fuera del repositorio,
en las descargas del usuario (`docs/leads-portal/00-MAPA.md:58-59`).

- **§ 5.3, dieciocho renglones** —identificadores, datos básicos, origen publicitario, primer y
  último toque, respuestas de Meta y de la landing, ICP score y segmento, estado del funnel, VSL,
  precall, cita, asistencia, venta y monto reportado—. La carpeta los recorre uno por uno con su
  cobertura (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:42-61`). El párrafo que cierra la
  sección pide conservar el historial de la reproducción, y **no se cumple**: el VSL y el precall
  viven en `contactos.campos_del_crm`, que la sincronización reescribe entero
  (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:239-251`).
- **§ 9.6** (líneas 575-588): para Lead Flow el ICP es posterior al formulario, así que un lead sin
  puntaje no es «bajo» y va aparte (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:291-308`).
- **§ 10.5** (líneas 718-720): el segmento lo consume también Appointment Flow, así que el corte
  tiene que vivir en un solo lugar (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:310-320`).
- **§ 10.7** (línea 757): «show rate por ICP», que no se puede publicar sin asistencias
  (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:322-334`).

Todo lo demás que la pestaña hace sale de otras tres fuentes, y la carpeta dice cuál gana cuando no
coinciden (`docs/leads-portal/00-MAPA.md:46-77`): la **maqueta**, que dio la forma —cinco tarjetas,
una rejilla con dos filtros y un buscador, una ficha de siete secciones—; lo que **otras carpetas**
ya habían pedido para esta pestaña (el contrato del cajón de Acquisition, la atribución de la
ficha, los huecos de Sales); y las **decisiones del usuario del 2026-09-26**
(`docs/leads-portal/00-MAPA.md:204-215`): tramos 75 y 50 con el 0 en «Sin calificar», rótulos «ICP
alto / medio / bajo», la ve quien tenga la pestaña, teléfono y correo sólo en la ficha, sin enlace a
GoHighLevel, la caída de altas del 14 de septiembre es real, y el ICP interno sólo se documenta
(`docs/OTROS/futuro/icp-interno-calculado.md:3-5`).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `contacts`, «Leads Portal», grupo AIOS, con `tablero.ver`
(`lib/autorizacion/secciones.ts:233-241`); la bandera se bajó en LP-4 y el comentario lo dice en
`lib/autorizacion/secciones.ts:236`. Queda una sola sección sin operaciones de servidor,
`executive` (`lib/autorizacion/secciones.ts:227`), y el conteo lo fija
`pruebas/codigo/90-fundaciones.test.ts:1263@22ec755`.
La vista es una envoltura que monta el panel (`components/views/ContactsView.jsx:33-45`), con una
cabecera que dice qué se borró y por qué (`components/views/ContactsView.jsx:1-31`).

**Las dos rutas.**

- `GET /api/leads-portal?periodo=`: pide `tablero.ver` con `PANTALLA = 'contacts'`
  (`app/api/leads-portal/route.ts:35`, `:47`); rechaza un período que no está en la lista en vez
  de corregirlo (`app/api/leads-portal/route.ts:50-54`); dentro de una sola `conOrganizacion` pide la
  cohorte, **la cadena de Sales con el mismo `dias`** y la frescura de contactos y citas
  (`app/api/leads-portal/route.ts:56-66`), y publica la comparación de las dos
  (`app/api/leads-portal/route.ts:69`) junto con tres de los cinco huecos de Sales
  (`app/api/leads-portal/route.ts:44`, `:79`).
- `GET /api/leads-portal/[id]`: la ficha, la única respuesta con teléfono y correo. Misma capacidad
  y misma pantalla que la lista; un id mal formado, inexistente o de otra empresa da el mismo 404
  (`app/api/leads-portal/[id]/route.ts:16-19`, `:36-45`). No refresca contra el CRM ni escribe.

**Los módulos** (todos en `lib/negocio/`):

| módulo | qué hace | rastro |
|---|---|---|
| `leadsDelPortal.ts` | una CTE arma una fila por persona y de ella salen la lista y las cinco tarjetas | `lib/negocio/leadsDelPortal.ts:4-13`, `:276-344` |
| `tramosDelIcp.ts` | el corte 75/50, sin imports, para servidor y navegador | `lib/negocio/tramosDelIcp.ts:38`, `:41`, `:84-89` |
| `citasAlcanzables.ts` | «agendó», «descartado», «cita cerrable», «plantón» | `lib/negocio/citasAlcanzables.ts:111-113`, `:128-134`, `:146-150`, `:207-209` |
| `ventasDelContacto.ts` | «vendió» y el monto reportado; lo importa también Sales | `lib/negocio/ventasDelContacto.ts:44-46`, `lib/negocio/cadenaDeCierre.ts:63` |
| `fichaDelLeadDelPortal.ts` | la ficha, con los mismos fragmentos que la fila | `lib/negocio/fichaDelLeadDelPortal.ts:3-13` |
| `atribucionVisible.ts` | ocho claves del primer toque por lista blanca; de `url` y `referrer`, el host | `lib/negocio/atribucionVisible.ts:51-60` |
| `huecosDelLeadsPortal.ts` | cinco huecos de la ficha, con su fecha | `lib/negocio/huecosDelLeadsPortal.ts:37-77` |
| `filtrosDelPortal.ts` | búsqueda, tramo y etapa, en el navegador | `lib/negocio/filtrosDelPortal.ts:91-98` |
| `vistaDeLeadsPortal.ts` | la lectura desde el navegador; no calcula nada | `lib/negocio/vistaDeLeadsPortal.ts:45-66` |

**Lo que dibuja el panel** (`components/leads-portal/PanelDeLeadsPortal.jsx`), de arriba abajo:

1. El encabezado y el segmentado de período, con **el botón encendido que contestó el servidor**
   (`components/leads-portal/PanelDeLeadsPortal.jsx:103-112`).
2. Los avisos, antes de las cifras: la frescura, la cola de la ventana y el aviso de la cohorte
   (`components/leads-portal/PanelDeLeadsPortal.jsx:275-289`).
3. Cinco tarjetas —Sin calificar, ICP alto, ICP medio, ICP bajo y Todos—: contactos, porción del
   total, agendados, cierre y monto reportado; la de «Sin calificar» parte sus dos poblaciones, y
   tocar una filtra la rejilla (`components/leads-portal/PanelDeLeadsPortal.jsx:176-187`,
   `:288-327`).
4. La barra: buscador por nombre, campaña y creativo; tramo; etapa (Todas · Agendados · Asistieron ·
   Vendidos); contador «N de M» (`components/leads-portal/PanelDeLeadsPortal.jsx:189-246`).
5. La rejilla, de a 60 con «Mostrar más», una tarjeta por persona con **tres estados por paso**
   en «Agendó › Asistió › Vendió» y las marcas de descartado, congelado y plantón
   (`components/leads-portal/PanelDeLeadsPortal.jsx:248-268`, `:334-397`).
6. Los huecos de la venta, que vienen de Sales con su fecha
   (`components/leads-portal/PanelDeLeadsPortal.jsx:402-415`).

**Las cifras que dibuja al abrirse, calculadas desde la base el 2026-09-28** con los predicados del
código (`scripts/medir-leads-portal.sql`, que los copia a mano y lo dice). **No se vieron en
pantalla**: ver el final de esta sección.

| tarjeta | contactos | porción | agendados | cierre | monto reportado |
|---|---|---|---|---|---|
| Sin calificar | 29 (6 sin puntaje · 23 en 0) | 10 % | 13 | — | — |
| ICP alto | 50 | 18 % | 39 | — | — |
| ICP medio | 81 | 29 % | 39 | — | — |
| ICP bajo | 117 | 42 % | 48 | — | — |
| Todos | 277 | — | 139 · «0 vendidos» | — | — |

El cierre y el monto van en «—» con el motivo `sin_ventas_registradas`, porque la empresa no tiene
ninguna venta (`lib/negocio/leadsDelPortal.ts:491-516`). El aviso de la cohorte, con esta medición,
diría dos cosas: que **46 personas** tuvieron una cita que ya debería haber ocurrido sin registro, y
que **24 contactos** no tienen alta y ninguna ventana los trae
(`lib/negocio/leadsDelPortal.ts:542-548`, `:566-571`). En «Completo» suben a 77 las de la cita sin
registro, se agregan las 79 personas con sólo citas congeladas
(`lib/negocio/leadsDelPortal.ts:550-555`) y aparece el aviso de la cola: la ventana arranca el
2025-08-08 y la mitad de los contactos entró después del 2026-08-28 —proporción 0,076, bajo el 0,25
de `lib/negocio/periodo.ts:147`—.

**La ficha** (`components/leads-portal/FichaDelLead.jsx`) se monta en `document.body` con un cajón
propio, `#lpFicha`, y no en el `#drawer` de Executive
(`components/leads-portal/FichaDelLead.jsx:92-128`). Sus secciones: Llamar y Escribir con `tel:` y
`mailto:` saneados, sin enlace a GoHighLevel (`components/leads-portal/FichaDelLead.jsx:36-46`,
`:196-209`); el recorrido Entró · Llegó por · Agendó · Asistió · Compró, con el hueco del VSL
(`:211-253`); el cuestionario y el estado del formulario de la landing con su corte (`:255-279`); el
video precall como texto del CRM (`:281-289`); fechas y conteos de mensajes sin su texto, y las
listas de citas y resultados (`:291-329`); los parámetros de publicidad (`:331-343`); el puntaje con
quién lo calcula (`:345-352`); y teléfono, correo, closer asignado por su nombre y la última
sincronización (`:354-375`).

**Ventanas y pisos.** Las cuatro del sistema —hoy (24 h), 7 días, 30 días, completo— y ninguna más
(`lib/negocio/periodo.ts:83-96`), con 30 días por omisión (`lib/negocio/periodo.ts:109`). La cohorte
es por alta en el CRM, móvil, la misma expresión que la cadena de Sales
(`lib/negocio/leadsDelPortal.ts:300`, `lib/negocio/cadenaDeCierre.ts:169`). El único piso es el del
cierre, `PISO_DE_UNA_TASA = 10` sobre los contactos del tramo
(`lib/negocio/indicadoresDeCitas.ts:329`, `lib/negocio/leadsDelPortal.ts:497`); la porción no lleva
piso (`LP06-P01`, abierta). El guardián de ceros mira 14 días de la empresa, sin la ventana
(`lib/negocio/leadsDelPortal.ts:62`, `:336-339`). La lista viaja entera hasta 5.000 filas
(`lib/negocio/leadsDelPortal.ts:54`) y el reloj recarga cada 60 segundos sólo con la pestaña a la
vista (`components/leads-portal/PanelDeLeadsPortal.jsx:76-80`, `lib/cadencia.ts:91`).

**Las pruebas**, según los mensajes de sus commits y **no re-corridas hoy** (este trabajo no corre la
suite): la 175 de los tramos, en `pruebas/codigo/` (LP-1, sin cifras en su mensaje);
`pruebas/base/175-leads-del-portal.test.ts` con 20 casos y 44 mutaciones muertas (LP-2), las dos
176 —la ficha y la atribución— con 20 pruebas y 31 mutaciones (LP-3), la 177 de la ruta con 13 y
18 (LP-4), la 177 de los filtros con 15 mutaciones (LP-5), y
`pruebas/codigo/178-la-maqueta-del-leads-portal-se-fue.test.ts`, que se pone roja si vuelve una pieza
de la maqueta (14 mutaciones, LP-6). La suite: 2266 × 3 zonas en verde en LP-5; el mensaje de LP-6
anota «Suite 2273 × 3 zonas» sin decir, como los anteriores, que quedó en verde.

**Lo que nadie vio todavía: la pantalla con sesión iniciada y datos reales.** El mensaje de `aed4f27`
dice que se verificó el CSS en el navegador a escritorio, a 375 px y en los dos temas; ninguna cifra
de esta sección se comprobó viéndola dibujada por la aplicación andando. La prueba de humo con
sesión —tarjetas, filtros, búsqueda, ficha, 375 px— es el paso 4 de la verificación del plan
(`docs/leads-portal/13-EL-CONTRASTE.md:240-241`); pide iniciar sesión, así que queda del lado del
usuario, y **no hay en el repositorio ni en los mensajes de commit ningún registro de que se haya
hecho**. El cotejo para ese día es `scripts/medir-leads-portal.sql`
contra lo que muestre la pantalla.

---

## 3 · Lo que era maqueta y qué la reemplazó

La maqueta dibujaba **quince personas inventadas** con teléfono y correo con forma real, y cuatro de
ellas con el nombre completo de un closer real al que le atribuía **dos ventas que no existen**
($14.100 en total); el censo, con un método repetible, da **536 valores de dato inventados** entre
el módulo y el cajón (`docs/leads-portal/10-LO-QUE-NO-ES-UN-REQUISITO.md:26-72`, `:74-119`). Esta
carpeta no copia ninguno de esos datos.

| lo que había | qué lo reemplazó |
|---|---|
| `lib/aios/leads-portal.js`, 324 líneas con `innerHTML`, tramos y tasas calculados en el navegador | `components/leads-portal/` y las rutas; el módulo se borró en `aed4f27` |
| «Calificado alto / medio / No calificado» | «ICP alto / medio / bajo»: «no calificado» es una etiqueta de descarte (`lib/negocio/tramosDelIcp.ts:55-62`) |
| el tramo guardado a mano al lado del puntaje | derivado siempre del puntaje (`lib/negocio/tramosDelIcp.ts:13-16`) |
| «Revenue» y «Cierre N %» por tramo | «monto reportado» y «—» con motivo (`lib/negocio/leadsDelPortal.ts:477-516`) |
| dos estados por paso | tres: «sin registrar» no es «no asistió» (`components/leads-portal/PanelDeLeadsPortal.jsx:337-352`) |
| el botón «Plan de acción», cuatro frases escritas a mano | borrado; la primera frase, medida, no da 22 % sino 17,8 % a 30 días el 2026-09-27 (`docs/leads-portal/07-EL-PLAN-DE-ACCION.md:71-104`); el 2026-09-28, 18,1 %: 50 de 277 |
| la píldora «Personalizado» y un tercer botón que mandaba `mes` | borrados; el período se valida contra la lista (`app/api/leads-portal/route.ts:50-54`) |
| `window.AIOSLeadCard`, que abría una ficha por NOMBRE y, si no la encontraba, la de otra persona | la ficha por id con 404 (`app/api/leads-portal/[id]/route.ts:42-45`) |
| `data-leads` en las tarjetas, que abría el cajón «Grupo de contactos» | tocar la tarjeta filtra la rejilla |
| el salto «↗ GHL» | `tel:` y `mailto:`, sin enlace al CRM |

**Lo que Executive todavía dice en nombre de esta pestaña**, y ninguno de sus tres sitios se tocó en
LP-6 porque son de Executive (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:267-284`; la foto de
esa pestaña es [11-EXECUTIVE.md](11-EXECUTIVE.md); **después del corte, el 2026-10-01**, los tres se fueron con la maqueta del Executive, en la etapa E7 de la nueva estructura):

- **La ficha de departamento** «312 contactos · 78 de ICP alto», «El 22% del volumen es ICP alto
  pero produce el 61% de las ventas» y «Entrego a Acquisition qué campañas traen el ICP que cierra»
  (`lib/aios/executive.js:198-201@c4cf2a8`). **No se dibuja**: se lee al pasar sobre un nodo del mapa
  (`lib/aios/executive.js:218@c4cf2a8`) y los cinco nodos son de Inteligencia, ninguno `contacts`
  (`components/views/ExecutiveView.jsx:236@c4cf2a8`, `:250@c4cf2a8`, `:264@c4cf2a8`, `:278@c4cf2a8`, `:292@c4cf2a8`). Medido hoy: 108 de
  594 son ICP alto en toda la base, y ventas no hay.
- **El chat ejecutivo** ofrece tres preguntas de esta pestaña (`lib/aios/executive-chat.js:24@c4cf2a8`) y su
  respuesta por omisión, con «$15,000» de revenue potencial, cita a Leads Portal como fuente
  (`lib/aios/executive-chat.js:31-32@c4cf2a8`).
- **El cajón «Grupo de contactos»** sigue abriéndose desde las seis cifras del embudo de Executive
  (`lib/aios/executive.js:49@c4cf2a8`) con **catorce personas inventadas** y tres montos en dólares
  (`lib/aios/leads-group.js:14-29@c4cf2a8`), y su pie promete «Ver los N en Leads Portal →» y navega a esta
  pestaña (`lib/aios/leads-group.js:60-64@c4cf2a8`). Desde «Contactos» a 7 días promete 312
  (`lib/aios/executive.js:17@c4cf2a8`, `:30@c4cf2a8`); la pestaña abre en 30 días con 277, y a 7 días tiene 3
  (medido el 2026-09-28). Es `LP08-P01`, abierta (§ 5); **después del corte, el 2026-10-01**, resuelta con el borrado del cajón.
- El corte 75/50 **existe dos veces**: en `lib/negocio/tramosDelIcp.ts:38-41` y en el `SEG` del cajón
  (`lib/aios/leads-group.js:10@c4cf2a8`), que no se toca por la compuerta de paridad
  (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:310-315`). **Después del corte, el 2026-10-01**: el cajón se borró con la maqueta del Executive, y su `SEG` con él.

---

## 4 · Datos que ya tenemos

Todo re-medido el **2026-09-28** entre las 18:03 y las 18:14 UTC; entre paréntesis, la cifra de la
carpeta de requisitos con su fecha. Todo es de ARIA, que sigue siendo **la única organización con
contactos**: `negocio.contactos` tiene filas de una sola `org_id`.

**El universo** (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:59-81`):

| qué | 2026-09-28 | 2026-09-27 00:10 UTC |
|---|---|---|
| contactos | **594** | 593 |
| territorio closer · setter · congelados | 287 · 282 · 25 | 287 · 281 · 25 |
| sin alta en el CRM | 24, los 24 congelados | 24, los 24 congelados |
| última alta | 2026-09-28 13:37 UTC | 2026-09-25 14:53 UTC |
| última sincronización | 2026-09-28 18:00 UTC | 2026-09-27 00:00 UTC |

Frescura, a las 18:06 UTC: la tarea de contactos había corrido hacía 4 minutos y la de citas hacía
2, las dos en `corrio`. Las altas por semana desde el lunes 31 de agosto: **175 · 89 · 4 · 3 · 1**
(la última, en curso); **8 desde el 2026-09-14**, cuando se pausaron las campañas
(`docs/leads-portal/06-PERIODOS-Y-PISOS.md:152-175`).

**La cohorte por ventana** (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:91-106`, `:622-640`):

| ventana | contactos | agendaron | sólo congeladas | sin registrar | plantón | descartados |
|---|---|---|---|---|---|---|
| hoy | **1** (0) | 0 | 0 | 0 | 0 | 1 |
| 7 días | 3 (3) | 2 (3, LP-2) | 0 | 0 (1, LP-2) | 0 | 2 |
| 30 días | **277** (286 LP-0; 283 LP-2) | **139** (142, LP-2) | 0 | 46 (47) | 13 (13) | 106 |
| completo | 570 (569) | 200 (200) | 79 (79) | 77 (77) | 15 (15) | 115 |

«LP-2» es la medición del 2026-09-27 a las 02:06 UTC con los predicados del código; la de LP-0, de
las 00:10, no medía «agendó» con el predicado exacto
(`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:342-348`).
La ventana de 30 días es móvil, así que su borde de atrás corre: la baja de 283 a 277 no es gente
que se fue, es gente que salió de la ventana. Y «sin registrar» sube sola cuando empieza una cita:
re-medido con la misma consulta el 2026-09-29 a las 00:15 UTC, a 30 días daba 276 contactos (salió
uno con puntaje 0) y «sin registrar» 47 · 78 en «Completo» · 1 a 7 días, porque una cita empezó
entre las dos mediciones. Al cotejar la pantalla, las cifras de esta tabla valen sólo para el corte.

**Los tramos** (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:222-250`); entre paréntesis, la
cifra de LP-0 en las dos primeras columnas y la de LP-2 en la tercera:

| tramo | toda la base | 30 días | agendaron a 30 días |
|---|---|---|---|
| Sin calificar (nulo o 0) | 169 = 122 nulos + 47 ceros (igual) | 29 (35) | 13 de 29 (15 de 33) |
| ICP alto (≥ 75) | 108 (108) | 50 (51) | 39 de 50 (40 de 51) |
| ICP medio (50-74) | 158 (158) | 81 (83) | 39 de 81 (39 de 82) |
| ICP bajo (1-49) | **159** (158) | 117 (117) | 48 de 117 (48 de 117) |

Contactos con puntaje: **472** (471). Ceros en los últimos 14 días: **0** (0), así que el guardián
sigue apagado. Hecha la cuenta, la agenda a 30 días es **78,0 % en ICP alto, 48,1 % en medio y
41,0 % en bajo**, los tres sobre el piso; **la pantalla no la publica**: es `LP02-P01`, abierta
(`docs/leads-portal/02-METRICAS.md:399-406`), y es lo único que hoy diría si el corte separa algo
(`docs/leads-portal/14-EL-PUNTAJE-DEL-CRM.md:360-366`).

**Asistencia, plantón y venta.** Citas: **333** (327 el 2026-09-21,
`lib/negocio/citasAlcanzables.ts:92`), 232 alcanzables; `cancelled` 166 · `confirmed` 152 · `noshow`
15. `citas.asistio` con dato: **0 de 333**. Personas con alguna cita: 292 (292); con todas sus citas
canceladas: 146 (146, el 2026-09-27). A 30 días,
**92 de los 139 agendados** tienen todas sus citas alcanzables canceladas —la ficha lo dice
«agendó y canceló» (`lib/negocio/fichaDelLeadDelPortal.ts:176-182`); la tarjeta, no— y 75 de los
139 llevan una etiqueta de descarte. Resultados: **7** —seguimiento 4, no_show 2, no_interesa 1—, 0
con monto, 0 con la cita enganchada, el último del 2026-09-09: los mismos siete que
`lib/negocio/huecosDeSales.ts:49-56` contó el 2026-09-21. **Ninguna venta en la base.**

**El descarte y el rechazo por ICP** (`docs/leads-portal/14-EL-PUNTAJE-DEL-CRM.md:264-290`): 122
contactos con alguna etiqueta de descarte (121). Con `icp_rechazado`, 69 (68): alto 0 · medio 22 ·
bajo **46** (45) · sin calificar 1. **El techo de 59 sigue en pie**: el puntaje más alto entre los
rechazados es 59, ninguno de los 202 contactos con 60 o más está rechazado, y 68 de los 223 con 1
a 59 sí. Contesta con fecha lo que `LP14-P02` dejaba abierto
(`docs/leads-portal/14-EL-PUNTAJE-DEL-CRM.md:347-352`).

**La ficha**, sobre los 594, con la cifra del 2026-09-27 entre paréntesis
(`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:709-712`, `:656-661`;
`docs/leads-portal/05-LA-FICHA-DEL-LEAD.md:90`, `:263`, `:286-293`, `:383-384`): teléfono 559 (558) ·
correo 591 (590) · país 570 (569) · campaña 272 (271) · creativo 506 (505) · `adId` 213 (213), **los
213 cruzan** con `negocio.anuncios` · respondieron el cuestionario 337 (336) · historia de mensajes
leída 542 (541) · asignado en el CRM 253 (253), 252 cruzan con uno de los 3 closers configurados
(252). «Form Landing VSL»: Agendado 121 · incompleto 87 · completo sin agendar 39 · vacío 347 (346),
y el alta más nueva con valor es del 2026-08-31. «Video Pre-Call»: 222 con valor, 180 de ellos en el
estado inicial que escribe el CRM al agendar (222 y 180). La atribución cruda trae `ip` en 332
contactos (331), y por eso viaja por lista blanca.

**Quién ve hoy la pestaña**, sólo conteos, con la consulta de
`docs/leads-portal/12-QUIEN-VE-QUE.md:94-116`:

| qué | 2026-09-28 | 2026-09-27 02:26 UTC |
|---|---|---|
| usuarios activos de ARIA | 4: `usuario` 2 · `superadministrador` 2 | 4, igual |
| **ven la pestaña** | **3**: `superadministrador` 2 · `usuario` 1 | 3 |
| con `closer.ver`, `setter.ver` o `contactos.ver` | 4 | 4 |
| concesiones de `contacts` en ARIA | 1 | — |
| de los que la ven, **closers vinculados a un usuario del CRM** | **2**: `superadministrador` 1 · `usuario` 1 | sin medir (`LP12-P01`) |

Nadie nuevo recibió la pestaña desde LP-4 (`docs/leads-portal/12-QUIEN-VE-QUE.md:145-156`). La
última fila es nueva: `LP12-P01` la dejó «sin medir»
(`docs/leads-portal/12-QUIEN-VE-QUE.md:341-361`) y hoy vale 2. Qué significa, en § 7.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**Los huecos que declara el código**, cada uno con la fecha de su medición:

| hueco | dónde se dibuja | medido el | de dónde tendría que venir | hoy |
|---|---|---|---|---|
| El VSL | ficha, recorrido | 27-sep (`lib/negocio/huecosDelLeadsPortal.ts:37`, `:40-48`) | el medidor del video de la landing, que el tráfico dejó de atravesar el 2026-08-31 ([03-CONVERSION.md](03-CONVERSION.md)) | re-medido: 79 contactos con «VSL % máximo visto», **0 distintos de 0**; el alta más nueva con valor, 2026-08-30 |
| Fit e intent | ficha, calificación | 27-sep (`lib/negocio/huecosDelLeadsPortal.ts:49-55`) | ningún lado: el único puntaje es el del CRM; el ICP propio está sólo documentado | sin cambio |
| Ubicación y posición del anuncio | ficha, publicidad | 27-sep (`lib/negocio/huecosDelLeadsPortal.ts:56-62`) | Meta, con el desglose por ubicación que la sincronización de anuncios no trae | no re-medido |
| El costo del lead | ficha, publicidad | 27-sep (`lib/negocio/huecosDelLeadsPortal.ts:63-69`) | un modelo que reparta el gasto diario por anuncio: no sería un dato | sin cambio |
| El dispositivo y la ciudad | ficha, publicidad | 27-sep (`lib/negocio/huecosDelLeadsPortal.ts:70-76`) | sólo de la IP y el navegador, que no se muestran por privacidad | sin cambio |
| La venta · el revenue y el cierre · el pago verificado | panel, abajo | 21-sep (`lib/negocio/huecosDeSales.ts:46`, `:49-69`), consumidos de Sales (`app/api/leads-portal/route.ts:44`) | el registro manual del closer en Avanzar; el pago, una integración de cobros que no existe | re-medido: 7 resultados, 0 ventas, 0 montos. La credencial de pagos «en 0 de 5 organizaciones» es del 2026-09-21, no re-medida |

**Lo que no es un hueco entero, y no se colapsa en uno:** la asistencia es `sin_registrar` con su
número —46 personas a 30 días y 77 en «Completo» el 2026-09-28—, y el plantón del calendario
viaja aparte (`lib/negocio/citasAlcanzables.ts:105-113`). La tiene que escribir una persona en Avanzar; el CRM
no la trae. La **historia de la reproducción** que pide el § 5.3 exige una tabla y un escritor
nuevos, y quién los construye es `LP11-P03`. El **ICP calculado por Comando Central** espera los pesos
del equipo (`docs/OTROS/futuro/icp-interno-calculado.md:325-333`); el día que exista, cambia de dónde
sale el número y no el corte (`lib/negocio/tramosDelIcp.ts:14-16`).

**Lo que queda del lado del usuario**, además de la prueba de humo de § 2:

- **`LP05-P02`** — ¿entran `medium`, `campaignId`, `adSource` y el objetivo del anuncio a la lista
  blanca? Ninguno es personal (`docs/leads-portal/05-LA-FICHA-DEL-LEAD.md:400-409`). La carpeta decía
  que cuántos traen el objetivo cargado «no se midió»: medido hoy, **213 de los 213** cuyo `adId`
  cruza. `medium` 553 (552), `campaignId` 358 (358), `adSource` 214 (214). Hoy la lista son ocho
  claves (`lib/negocio/atribucionVisible.ts:46-60`).
- **`LP08-P01`** — ¿el pie del cajón de Executive sigue llevando a Leads Portal? Promete una cifra
  inventada y el destino muestra otra; las tres salidas tienen costo, y cambiar el texto pone roja
  la compuerta de paridad (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:350-369`). **Después del corte, el 2026-10-01**: resuelta, porque el cajón se borró con la maqueta del Executive (nueva estructura, E7).
- **`LP04-P01`** — ¿la rejilla se ordena por alta o por puntaje? Hoy va por alta, la más nueva
  primero, con el id de desempate (`lib/negocio/leadsDelPortal.ts:304-314`); con 8 altas desde el
  14 de septiembre, eso muestra primero a gente de hace semanas
  (`docs/leads-portal/04-LA-REJILLA-Y-LOS-FILTROS.md:289-294`).

El índice de las 37 preguntas de la carpeta —varias ya contestadas por medición, como `LP09-P01`—,
ordenadas por la etapa que no debía empezar sin cada una, está en
`docs/leads-portal/00-MAPA.md:274-312`.

---

## 6 · Reglas propias de este departamento

**1 · La fila es una persona, y la tarjeta y la fila salen de la misma sentencia.** Una CTE decide
tramo, cita, asistencia y venta por persona, y el resumen agrupa por esa columna sin volver a
clasificar a nadie (`lib/negocio/leadsDelPortal.ts:4-13`). «Todos» es la suma de las cuatro, no una
cuenta aparte (`lib/negocio/leadsDelPortal.ts:355-375`).

**2 · Ningún predicado es propio salvo el tramo.** «Agendó», «descartado», «cita cerrable»,
«plantón» y «vendió» vienen de donde ya los usan las otras pestañas
(`lib/negocio/leadsDelPortal.ts:15-20`); el tramo es una clasificación, no un hecho.

**3 · Cohorte y «agendó» son la misma expresión que en Sales, y se comparan en cada respuesta.** Si
no coinciden, se publican las dos cifras y el aviso lo dice, sin elegir
(`lib/negocio/leadsDelPortal.ts:599-623`). **Los vendidos no se comparan**: la cadena exige una cita
cerrable y un intento, esta pestaña no (`lib/negocio/ventasDelContacto.ts:11-14`).

**4 · Tres valores por paso, y el «no se sabe» nunca se escribe «no».** La asistencia es
`asistio`, `no_asistio`, `sin_registrar` o `null` —no había nada que registrar—
(`lib/negocio/leadsDelPortal.ts:72-79`); la venta es «vendió» o «sin venta registrada», nunca «no
compró» (`docs/leads-portal/01-LA-UNIDAD-ES-LA-PERSONA.md:198-213`).

**5 · El 0 del puntaje va a «Sin calificar», pero sigue siendo 0.** Los dos motivos viajan separados
(`lib/negocio/tramosDelIcp.ts:18-25`), y un 0 nuevo **avisa y no reclasifica**
(`lib/negocio/leadsDelPortal.ts:533-540`).

**6 · Los cortes 75 y 50 son una decisión fechada, no un corte validado.** Viven con nombre en un
solo módulo sin imports (`lib/negocio/tramosDelIcp.ts:4-16`, `:27-32`); los datos proponen también
un 60, donde la casa deja de rechazar.

**7 · El cierre tiene dos motivos para no publicarse, en orden:** la empresa no tiene ninguna venta,
o el tramo tiene menos de 10 contactos. Fuera de eso se publica, 0 incluido. **El monto tiene tres
estados** y un nulo nunca es $0 (`lib/negocio/leadsDelPortal.ts:477-516`).

**8 · Venta es la que reportó el closer, y nada más.** Ni `acuerdo_sin_pago` ni `venta_chica`, y
nunca un pago verificado (`lib/negocio/ventasDelContacto.ts:16-21`).

**9 · La lista lleva exactamente catorce claves, y ninguna es un medio de contacto.** Una clave
nueva pone la prueba en rojo aunque no esté prohibida (`lib/negocio/leadsDelPortal.ts:105-129`), y el mapeo va
clave por clave, nunca `...l` (`lib/negocio/leadsDelPortal.ts:377-398`). Teléfono y correo, sólo en
la ficha.

**10 · La atribución se muestra por lista blanca, y de las direcciones sólo el host.** Una clave que
el CRM empiece a mandar mañana no aparece hasta que alguien la decida
(`lib/negocio/atribucionVisible.ts:12-14`).

**11 · La ficha sólo lee, se abre por id, y lo ajeno se ve igual que lo inexistente**
(`lib/negocio/fichaDelLeadDelPortal.ts:3-9`, `:130-136`, `app/api/leads-portal/[id]/route.ts:16-19`).
Nada del CRM se vuelve enlace salvo llamar y escribir
(`components/leads-portal/FichaDelLead.jsx:13-19`).

**12 · Filtrar en el navegador sólo es honesto si llegó todo, y un vacío dice por qué.** «Asistieron»
vacío porque nadie registró no es «ninguno coincide» (`lib/negocio/filtrosDelPortal.ts:4-10`,
`:124-157`).

**13 · Los huecos viajan con la respuesta y con su fecha**, en el lugar donde la maqueta dibujaba el
dato; los de la venta se consumen de Sales y no se reescriben
(`lib/negocio/huecosDelLeadsPortal.ts:11-20`).

---

## 7 · Riesgos

**La ventana por omisión se vacía sola, y pronto.** La de 30 días tiene volumen porque todavía
contiene las semanas del 31 de agosto y del 7 de septiembre (175 y 89 altas); salen de la ventana
entre el 30 de septiembre y el 13 de octubre (`docs/leads-portal/06-PERIODOS-Y-PISOS.md:177-188`).
Con 8 altas desde el 14 de septiembre (medido el 2026-09-28), si la pauta sigue pausada la pestaña va
a abrir con **menos de diez contactos**, todos los tramos debajo del piso, y las cinco tarjetas van
a decir poco. Qué dibujar entonces es
`LP06-P02`, abierta (`docs/leads-portal/06-PERIODOS-Y-PISOS.md:291-298`).

**«Agendados» cuenta a quien canceló, y la tarjeta no lo dice.** A 30 días, 92 de los 139 agendados
tienen todas sus citas alcanzables canceladas; la ficha lo dice «agendó y canceló» y la tarjeta y
el filtro, no. Es la definición del sistema y está bien; leerla como «139 con cita en pie» no.
Distinguirlos es `LP02-P03` = `LP04-P03` (`docs/leads-portal/02-METRICAS.md:415-420`).

**Casi cuatro de cada diez de la ventana están descartados, y cuentan en su tramo.** 106 de 277 a
30 días, 75 de ellos entre los agendados. La rejilla los marca y el contador los incluye; un filtro
para ocultarlos es `LP04-P02`.

**Dos de las tres personas que ven la pestaña ven acá más de lo que ven en Closer.** Están
vinculadas a un usuario del CRM, así que en Closer su alcance es `mio`
(`lib/negocio/alcanceDelCloser.ts:23-28`, `:109-117`); acá ven la cohorte entera —nombre, puntaje,
campaña y estado de los 570 con alta—. No es un dato personal nuevo: las cuatro personas activas ya
podían leer cualquier ficha por `contactos.ver` (`docs/leads-portal/12-QUIEN-VE-QUE.md:84-136`). Pero
la decisión «quien tenga la pestaña» se tomó con esta cifra sin medir, y hoy está medida.

**Cualquier rol con `tablero.ver` y sin `contactos.ver` vería teléfonos y correos, y ninguna prueba
fallaría.** Hoy ningún rol es así; el día que alguien cree uno de sólo tableros, la ficha se los
muestra. Y todo administrador de cualquier empresa ve la pestaña sin concesión
(`docs/leads-portal/12-QUIEN-VE-QUE.md:73-78`, `:363-372`).

**Las cifras de Executive dicen otra cosa en nombre de esta pestaña** —312, 78, 22 % y 61 %— y el
pie de su cajón lleva hasta acá, donde se ve otra cifra (§ 3). Quien compare las dos pantallas va a
pensar que una está rota, y acierta a medias: de las dos mitades, desde LP-5 sólo una es inventada.

**El corte 75/50 vive dos veces.** Si alguien lo cambia en `tramosDelIcp.ts`, el cajón de Executive
sigue cortando en 75 y nada falla (`lib/aios/leads-group.js:10@c4cf2a8`).

**Creative promedia los ceros y esta pestaña los aparta.** Las dos cifras de ICP están bien por
separado y no se reconcilian; el día que alguien renombre «Puntaje | ICP» en el CRM, Creative pierde
el ICP y esta pestaña no (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:127-144`).

**Las fechas de los huecos son literales.** «Medido el 27 de septiembre» y «21 de septiembre» están
escritos en el código (`lib/negocio/huecosDelLeadsPortal.ts:37`, `lib/negocio/huecosDeSales.ts:46`)
y nada los vuelve a medir. La ruta manda los tres huecos de Sales siempre, sin mirar
`hayVentasRegistradas` (`app/api/leads-portal/route.ts:79`): el día que se registre una venta, el
hueco sigue diciendo «No hay ninguna venta registrada» (`lib/negocio/huecosDeSales.ts:52`) con su
fecha vieja hasta que alguien lo edite, mientras la tarjeta ya cuenta la venta.

**Llamado sin ventana, el módulo mide catorce días.** `leadsDelPortal(dias = DIAS_DE_LA_TASA)`
(`lib/negocio/leadsDelPortal.ts:272-275`, `lib/negocio/indicadoresDeCitas.ts:339`): catorce no es
ninguno de los cuatro botones. La ruta siempre pasa `periodo.dias`, así que hoy no pasa; un
consumidor nuevo que lo llame a secas publicaría una cohorte que ninguna pantalla puede reproducir.

**«0 vendidos» en la tarjeta «Todos».** Es un conteo de personas con venta registrada y está medido
(`docs/leads-portal/02-METRICAS.md:229-246`), pero es el único cero de la pantalla sobre la venta,
al lado de un «—» que dice lo mismo con otro motivo
(`components/leads-portal/PanelDeLeadsPortal.jsx:308-310`, `:318-323`).
Leído solo, dice «nadie compró».

**Y el que ordena a los demás: ninguna de estas cifras se vio en la pantalla andando.** Todo lo de
§ 2 sale de la base y del código. La prueba de humo con sesión es la única mirada que puede decir si
el aviso se lee, si las tarjetas caben a 375 px con datos reales y si el «—» se entiende; está
pendiente y es del usuario.
