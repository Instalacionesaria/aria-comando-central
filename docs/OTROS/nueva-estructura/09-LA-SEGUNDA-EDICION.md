# La segunda edición: pestañas agrupadas, nombres nuevos y lo «Próximamente» del cerebro

> Plan del **2026-10-02**, sobre la estructura que ya está en producción (E0 a E13 de esta carpeta). Un
> diseño nuevo pide cambios más chicos que la primera vez: varias entradas pasan a ser **una sola, con
> sub-pestañas**; otras **cambian de nombre**; y vuelven, como «Próximamente», piezas del cerebro que la
> primera edición no dibujaba. Este documento dice todo lo que se va a hacer **antes de tocar el código**.
> Los requisitos siguen el prefijo `NE-`, desde `NE-37`.

---

## De dónde sale

- **El diseño «Comando Central · Simulación»**, del 2026-10-02: la barra lateral, la cabecera de cada
  departamento, el Inicio y el menú del engranaje, con el contenido de cada pantalla escrito a modo de
  muestra (`[N]`, `[Lead 1]`). Su barra se arma por programa; se leyó entera, departamento por
  departamento y pestaña por pestaña.
- **Lo que hay en el código hoy**, medido el 2026-10-02 sobre `main` en `cdb858b`.

Varias pestañas del diseño **parecen inventadas y no lo son**: son dos o más de las que ya existen, que
pasan a llamarse como una. Las que no se reconocían, y las que existen y el diseño no muestra, se le
preguntaron al usuario; sus respuestas están en «Las decisiones».

## El diseño contra lo que hay hoy

| departamento | en el diseño | hoy | qué es |
|---|---|---|---|
| Research | ICP & Oferta | ICP & Oferta (`icp`), con sus siete pasos y los mismos rótulos | igual |
| Research | **Radar** › Espía de anuncios · Scraper | Espía a tus competidores (`tools` [espia]) + Scraper (`tools` [scraper]) | dos entradas en una |
| Research | — | Mis Leads (`tools` [mis-leads]) | se muda a Sales › Leads › De Radar |
| Systems | Acquisition · Conversion · Conversation | iguales; Conversation con Lead Flow, Appointment Flow, Auditoría y Prompts | igual |
| Marketing | **Creative Insights** | Creative (`creative`) | nombre nuevo |
| Marketing | **Copywriter** (Próximamente) | Bio de Instagram, Guiones TOFU · MOFU · BOFU y Guiones de venta directa, las tres «Próximamente» | tres en una |
| Marketing | **Funnel** › Tu landing · Tu VSL | Tu página (`tools` [landing]) + Tu video de ventas (`tools` [vsl]) | dos entradas en una |
| Marketing | **Content Studio** (Próximamente) | Social Media Posting y Clon de IA, las dos «Próximamente» | dos en una |
| Sales | **Closing** | Sales (`sales`): «Dinero de {mes}», cobrado, ventas registradas, acuerdos sin pagar, la cadena comercial | nombre nuevo |
| Sales | **Leads** › Todos · De GHL · De Radar | Leads Portal (`contacts`) + Mis Leads (`tools` [mis-leads]); «Todos» no existe | dos secciones en una |
| Sales | el botón «Plan de prospección en frío», dentro de Leads | Prospección en frío (`tools` [prospeccion]) | pasa a sub-pestaña de Leads |
| Sales | Setter · Closer | iguales, con las mismas sub-pestañas | igual |
| Sales | **Llamadas de venta** | Analizador HT (`analizadores` [HT]) | nombre nuevo |
| Client Success | **Llamadas de onboarding** · Seguimiento de clientes (Próximamente) | Analizador OB (`analizadores` [OB]) · Seguimiento de clientes | nombre nuevo · igual |

Y fuera de los departamentos:

| pieza | en el diseño | hoy |
|---|---|---|
| La ceja de la cabecera | el nombre del departamento: «RESEARCH» | «RESEARCH · SE INSTALA EN FOUNDATIONS» (`NE-12`) |
| La barra, al lado de cada departamento | cuántas entradas tiene | nada |
| La barra, debajo de los departamentos | CONVERSACIONES, con ejemplos | no se dibuja (`NE-05`) |
| El pie de cada pantalla de departamento | la caja «Pregúntale al cerebro sobre {la pestaña}…» | no se dibuja (`NE-09`) |
| La cabecera de cada departamento | el comentario del cerebro, a la derecha | no se dibuja (`NE-17`, punto 3) |
| El menú del engranaje | cada destino con su subtítulo («Tokens de GHL, integraciones…», «Solo la organización de ARIA») | sólo el nombre |
| Las pantallas del engranaje | una cabecera con ceja «MENÚ DEL ADMIN» | sin cabecera |
| El Inicio | la nota «Reunión de hoy · próximamente. Aquí aparecerán los tres temas del día que detecta el cerebro.» | la nota de que el cerebro llega en una próxima etapa |
| Dentro de Radar | dos tarjetas «Próximamente»: «Enviar hallazgos a Copywriter» y «Dream 100» | dos notas del Espía: «Alimenta tus Creadores de Ads» y «Guarda tu Dream 100» |

## Las decisiones del 2026-10-02

Tomadas por el usuario después de leer la comparación:

| id | tema | decisión |
|---|---|---|
| `NE-37` | Alcance | **Sólo estructura**: las pestañas, sus grupos y sus nombres, la ceja, el contador y el engranaje. El interior de cada pantalla queda como hoy, para la fase de detalles |
| `NE-38` | Leads › «Todos» | **«Próximamente»**: visible y deshabilitada. «De GHL» es el Leads Portal y «De Radar» es Mis Leads |
| `NE-39` | Prospección en frío | **Una sub-pestaña de Leads**, «Plan de prospección», igual por dentro |
| `NE-40` | Los nombres de las sub-pestañas | **Mixto**: «Espía a tus competidores» (el cambio del mismo día se queda) y «Scraper» en Radar; «Tu landing» y «Tu VSL» en Funnel, como el diseño |
| `NE-41` | Dream 100 y Enviar hallazgos | Las dos notas del Espía **toman el nombre y el texto del diseño**, las dos «Próximamente». No se construye nada |
| `NE-42` | El cerebro | **Como «Próximamente»**: CONVERSACIONES en la barra, vacía, con la palabra; y la caja «Pregúntale al cerebro sobre …» al pie de cada pantalla de departamento, deshabilitada como la del Inicio. **El comentario del cerebro de la cabecera sigue sin dibujarse** |
| `NE-43` | La ceja | **Sólo el nombre del departamento**: «RESEARCH», «SYSTEMS», «MARKETING», «SALES», «CLIENT SUCCESS» |
| `NE-44` | El engranaje | **Subtítulos** en el menú —«TOKENS E INTEGRACIONES» en Ajustes, «SOLO {la organización principal}» en el Panel de Monitoreo e Incidentes, sacado del dato— y una **cabecera con una ceja neutra, «MENÚ DE LA CUENTA»**, en esas tres pantallas: el engranaje no es sólo de quien administra |

Y las ya reconocidas, que el usuario confirmó al pedir el plan: Creative pasa a llamarse **Creative
Insights**; Sales (la sección `sales`), **Closing**; Analizador HT, **Llamadas de venta**; Analizador OB,
**Llamadas de onboarding**; las tres «Próximamente» de los guiones, **Copywriter**; Social Media Posting y
Clon de IA, **Content Studio**; Espía y Scraper, **Radar**; Tu página y Tu video de ventas, **Funnel**; y
cada departamento lleva su **contador** en la barra.

Decididas al planificar, corregibles si el usuario dice otra cosa:

- **El contador cuenta las entradas que la persona ve, con las «Próximamente»**: Marketing dice 4, como el
  diseño, aunque dos no abran nada. Un grupo cuenta una vez.
- **En las pantallas del engranaje se oculta el título propio y se conserva la bajada**: la de Ajustes
  dice de qué empresa es la configuración —«Configuración de {la empresa}»—, y quien administra puede
  estar mirando otra: Ajustes › Usuarios crea a la persona en la organización activa. La cabecera dice
  «Ajustes»; la empresa no la dice nadie más.
- **La caja del pie no se dibuja en el teléfono** (`NE-18`: no se diseña nada más para el teléfono), ni en
  el Inicio, que ya tiene la suya, ni en las pantallas del engranaje, como en el diseño.
- **CONVERSACIONES la ve quien ve el Inicio**, como la Reunión de hoy: es el historial de las
  conversaciones del Inicio. Un closer, que ve Sales › Closer y nada más, no la ve.
- **El Inicio suma la nota del diseño sobre la Reunión de hoy**, y conserva el nombre de la empresa en la
  pregunta («¿Qué quieres saber de {la empresa}?», cambio del usuario del mismo día).
- **Una «Próximamente» sigue sin abrirse** (`NE-13`). En el diseño, Copywriter, Content Studio y
  Seguimiento de clientes abren una página que dice qué van a ser; esas frases quedan en `08` para el día
  que se construyan, y mientras tanto la entrada no lleva a una pantalla vacía.
- **La caja de Ajustes › Usuarios dice lo que abre** también cuando abre una sola cosa con otro nombre:
  «Leads Portal» abre Sales › Leads › De GHL, y sin eso la casilla nombraría un lugar que la barra ya no
  muestra.

### Lo que estas decisiones cambian de la primera edición

- `NE-05` decía que la lista de CONVERSACIONES no se dibuja: ahora se dibuja, vacía, como «Próximamente».
  El contador de la Reunión sigue sin dibujarse.
- `NE-09` retiró la barra «Pregúntale…» con la maqueta: vuelve, deshabilitada, en otra forma y en su
  propia área.
- `NE-12` daba la ceja «· SE INSTALA EN …» y decía que las cinco inteligencias conservaban sus nombres:
  la ceja pasa a ser el departamento solo, y dos de las cinco cambian de nombre (Creative y Sales).
- `NE-08` dejaba Prospección en frío en Sales «como hoy»: sigue en Sales, dentro de Leads.

## `NE-45` · Las entradas agrupadas

Un **grupo** es una entrada de la barra que reúne varias sub-pestañas: **Radar** (Research), **Funnel**
(Marketing) y **Leads** (Sales).

- **En la barra es una sola entrada**, con el nombre del grupo, y marcada cuando cualquiera de sus
  sub-pestañas está a la vista. Al tocarla abre **la primera sub-pestaña que la persona ve y que abre
  algo**: nunca una «Próximamente».
- **En la cabecera**, debajo de la fila de entradas del departamento, va **una segunda fila con las
  sub-pestañas del grupo abierto**, como las píldoras del diseño (`subtabs`), con la abierta marcada. Una
  sub-pestaña «Próximamente» se ve deshabilitada y no es un botón. Una entrada que no es un grupo no tiene
  segunda fila.
- **Cada sub-pestaña se ve o no por su propia sección**, igual que una entrada hoy (`NE-16`): la lista
  sigue saliendo de `menuVisible()`, y el modelo sólo la reparte.
- **Un grupo sin ninguna sub-pestaña visible que abra algo no se dibuja**: sus «Próximamente» no lo hacen
  aparecer, por la misma regla que un departamento (`NE-13`).
- **Las pantallas no cambian.** Radar y Funnel son pestañas de Tools, que ya se piden y ya se anuncian
  (`NE-19`, E9 a E11). Lo único nuevo es quién las agrupa.

En el modelo (`lib/autorizacion/departamentos.ts`), las entradas siguen siendo una lista plana, cada una
con su sección y su pestaña, y las de un grupo llevan su nombre. La función que reparte el menú pliega
cada grupo en una entrada con sus sub-pestañas; así la barra sigue abriendo cada entrada con la misma
llamada de hoy, con su sección y su pestaña.

### Las entradas, en orden

| departamento | entradas → sección [pestaña] |
|---|---|
| **Research** | ICP & Oferta → `icp` · **Radar** › Espía a tus competidores → `tools` [espia] · Scraper → `tools` [scraper] |
| **Systems** | Acquisition → `acquisition` · Conversion → `conversion` · Conversation → `conversation` |
| **Marketing** | Creative Insights → `creative` · Copywriter (Próximamente) · **Funnel** › Tu landing → `tools` [landing] · Tu VSL → `tools` [vsl] · Content Studio (Próximamente) |
| **Sales** | Closing → `sales` · **Leads** › Todos (Próximamente) · De GHL → `contacts` · De Radar → `tools` [mis-leads] · Plan de prospección → `tools` [prospeccion] · Setter → `setter` · Closer → `closer` · Llamadas de venta → `analizadores` [HT] |
| **Client Success** | Llamadas de onboarding → `analizadores` [OB] · Seguimiento de clientes (Próximamente) |

## `NE-46` · Leads cruza dos pantallas

Es el único grupo cuyas sub-pestañas viven en **dos secciones distintas**: «De GHL» es la pantalla del
Leads Portal (`#v-contacts`, con `tablero.ver`) y «De Radar» y «Plan de prospección» son pestañas de Tools
(`#v-tools`). Tocar una sub-pestaña de la otra sección cambia de pantalla, con la misma navegación que la
barra.

Por eso cada sub-pestaña se ve por su sección y no por la del grupo:

| si la persona tiene… | ve en Sales › Leads… | y Leads abre… |
|---|---|---|
| `contacts` y `tools` | Todos (Próximamente) · De GHL · De Radar · Plan de prospección | De GHL |
| sólo `contacts` | Todos (Próximamente) · De GHL | De GHL |
| sólo `tools` | Todos (Próximamente) · De Radar · Plan de prospección | De Radar |
| ninguna de las dos | nada: Leads no se dibuja | — |

Si una sub-pestaña se mostrara por la sección de otra, la persona tocaría una puerta que el servidor le
cierra.

## `NE-47` · Los nombres nuevos

- **Creative Insights y Closing** son el nombre de su sección, en `lib/autorizacion/secciones.ts`, y se
  cambian ahí, cada uno en su línea (`NE-33`: a ese archivo no se le agregan ni se le quitan líneas). Ese
  nombre es también el de su casilla en Ajustes › Usuarios.
- **Los demás** —Radar, Funnel, Leads y sus sub-pestañas, Llamadas de venta, Llamadas de onboarding,
  Copywriter, Content Studio— son nombres de entradas, y viven en la tabla de departamentos.
- **Las claves no cambian**: `creative`, `sales`, `contacts`, `tools`, `analizadores`, sus pestañas, los
  `id` de las vistas y los valores de la base (`05-LO-QUE-NO-CAMBIA.md`). No hay migraciones.
- **Los títulos que cada pantalla trae por dentro no cambian**: están ocultos debajo de la cabecera
  (`NE-17`) y son de la fase de detalles.

## `NE-48` · La ceja y el contador

- **La ceja** de la cabecera es el nombre del departamento en mayúsculas, en mono. La tabla de `NE-12`
  cambia con el código, en la misma etapa: la prueba de los departamentos la compara.
- **El contador** va a la derecha del nombre de cada departamento en la barra, en mono y en el tono
  atenuado, y cuenta las entradas que esa persona ve en él (un grupo, una vez; las «Próximamente»,
  también). Para el lector de pantalla, el número va con su palabra: «2 entradas».

## `NE-49` · El engranaje

- **El menú** dice, debajo de cada destino, su subtítulo en mono: «TOKENS E INTEGRACIONES» en Ajustes, y
  «SOLO {nombre de la organización principal}» en el Panel de Monitoreo e Incidentes. El «sólo» sale de la
  regla que ya los esconde fuera de la organización principal (`soloDesdeLaPrincipal`), y el nombre, de la
  organización de la sesión cuando ésa es la principal. Un rol de plataforma los ve también mirando una
  empresa cliente, y la sesión trae la que mira: ahí dice «SOLO LA ORGANIZACIÓN PRINCIPAL» (lo encontró la
  revisión de F2). Escribir el nombre de la empresa a mano es lo que `lib/autorizacion/secciones.ts` pide
  no hacer.
- **Las tres pantallas** llevan la cabecera de los departamentos, con la ceja «MENÚ DE LA CUENTA» —la
  misma frase que el menú y que el grupo de Ajustes › Usuarios—, el nombre del destino como título y sin
  fila de pestañas. Ajustes conserva sus pestañas propias (`NE-17`).
- **No son de ningún departamento**: la barra no marca ninguna entrada ni abre ningún acordeón, como hoy.

## `NE-50` · Lo «Próximamente» del cerebro

Tres piezas, ninguna con datos, ninguna que responda, ninguna con ejemplos escritos a mano:

1. **CONVERSACIONES**, en la barra, debajo de los departamentos: el rótulo mono y, debajo, «Próximamente».
   Sin lista y sin acción.
2. **La caja del pie**: «Pregúntale al cerebro sobre {la entrada abierta}…», deshabilitada como la del
   Inicio, con la misma nota de que el cerebro llega en una próxima etapa. Va en su propia área de la
   rejilla, debajo del cuerpo: dentro del cuerpo les taparía el pie a las pantallas de operación, por lo
   mismo que la cabecera va en la suya (E11). No se llama como la barra que se retiró, para que la prueba
   que impide que esa vuelva siga valiendo.
3. **La nota del Inicio** sobre la Reunión de hoy, con el texto del diseño.

El comentario del cerebro de la cabecera **sigue sin dibujarse**: es una frase sobre los datos de la
empresa, y escrita a mano sería una cifra inventada con otra forma (`NE-17`).

## `NE-51` · Las notas del Espía

Las dos notas «Próximamente» del Espía pasan a decir lo del diseño:

| hoy | después |
|---|---|
| «Alimenta tus Creadores de Ads» — envía los patrones a Ads Fríos y Remarketing | «Enviar hallazgos a Copywriter» — «Próximamente: los hooks que encontraste pasan directo a tus guiones.» |
| «Guarda tu Dream 100» — sigue a los competidores clave | «Dream 100» — «Próximamente: guarda las cuentas que quieres seguir de cerca.» |

## `NE-52` · Los textos que nombran lugares

Mis Leads se muda, y los textos que la nombran por su lugar mienten el día de la mudanza:

- los que dicen «Research › Mis Leads», en el panel de Research y en lo que el agente de ICP lee
  (`lib/fundaciones/mercado.ts` y `lib/fundaciones/herramientas.ts`), y la bajada del Scraper, que
  decía sólo «Mis Leads», pasan a sacar el lugar de la tabla de departamentos (`lugarDe`), como ya lo
  hace la barra de pasos de ICP con el VSL: «Sales › Leads › De Radar»;
- el vacío de Mis Leads dice que se llena desde Prospección: pasa a nombrar también el Scraper, que
  guarda ahí desde E9;
- los comentarios que dicen dónde vive una pestaña, en el mismo commit.

La prueba que impide que algo mande a «Tools →» (`194`) sigue valiendo, y suma «Research › Mis Leads».

## Lo que no cambia

Lo de `05-LO-QUE-NO-CAMBIA.md`, entero: las claves, los permisos, las rutas y la base. Además:

- **quién ve qué**, salvo lo que se ve agrupado: ninguna persona ve una pantalla que hoy no ve, ni deja de
  ver una que hoy ve;
- **el interior de cada pantalla** (`NE-37`);
- **el orden de las etapas de la primera edición**: esta edición va encima, sin tocar lo que no nombra.

## Las etapas

Cada etapa es un commit. Antes de cada uno: `npm run build`, `npm run tipos` y la suite entera en
America/Lima, UTC y Asia/Tokyo. Toda prueba nueva se ve primero **en rojo** con la mutación que dice su
fila, y F1 y F2 pasan además por una revisión adversarial.

| etapa | qué hace | archivos principales | pruebas que cambian o nacen (mutación que las pone en rojo) |
|---|---|---|---|
| **F0 · Documentos** | Este documento, su lugar en el índice y lo que no entra en `08` | `docs/OTROS/nueva-estructura/` | `101` (una cita a una línea que no existe) |
| **F1 · El modelo, los nombres y los textos** | `NE-45` a `NE-47`, `NE-51` y `NE-52`, la ceja de `NE-48` y la fila de sub-pestañas de la cabecera. **Hecho** el 2026-10-02. La fila de sub-pestañas entró acá y no en F2: con los grupos plegados y sin ella, el Scraper, Tu VSL, De Radar y el Plan de prospección no se abrían desde ningún lado. Por lo mismo, el punto «scrapeando» mira lo que la entrada abre (`queAbre`): Radar abre el Espía, y con la entrada sola un scraping del Scraper quedaba sin punto. La línea de la cabecera pasó a la fila de arriba (`.cd-arriba`), y las píldoras van debajo, como el diseño las pone al principio del cuerpo | `lib/autorizacion/departamentos.ts`, `lib/autorizacion/secciones.ts` (dos nombres, en su línea), `components/Nav.jsx` (el punto), `components/CabeceraDeDepartamento.jsx` y `app/departamentos.css` (la fila de sub-pestañas), `components/ajustes/Usuarios.jsx` (lo que abre), `components/tools/EspiaDeAnuncios.jsx`, `components/tools/MisLeads.jsx`, `components/tools/VistaDelScraper.jsx`, `components/fundaciones/PanelResearch.jsx`, `lib/fundaciones/mercado.ts` y `lib/fundaciones/herramientas.ts` (los textos); comentarios que nombraban lugares en `lib/aios/shell.js`, `components/analizadores/PanelDeAnalizadores.jsx`, `components/fundaciones/Fundaciones.jsx`, `components/tools/anuncios.jsx`, `components/tools/PanelProspeccion.jsx` y `components/views/ToolsView.jsx`; `01-LA-ESTRUCTURA.md`, `02-DONDE-VA-CADA-PANTALLA.md` y `08` | `191` (el orden y las cejas nuevas; toda pestaña de Tools y de Analizadores sigue teniendo su entrada, también dentro de un grupo); `193`, `194`, `195` y `133`, donde fijaban nombres o la forma de una entrada (la `102` no hizo falta tocarla: no fija ninguno de los nombres que cambian); nueva `196`: las sub-pestañas de un grupo van juntas y en un solo departamento (mover el Scraper detrás de Conversation), la barra recibe una entrada por grupo (no plegar), un grupo con sólo «Próximamente» no aparece (Leads sin `contacts` ni `tools`), el grupo abre su primera sub-pestaña que abre algo (abrir «Todos»), cada sub-pestaña se ve por su sección (mostrar «De GHL» con `tools`), la entrada abierta dice el grupo y la sub-pestaña (también con `contacts`, que no tiene pestaña), y `lugarDe` con el grupo; y en la `195`, lo que abre cada casilla con el grupo. **Hecho**: también la `194` con la fila de sub-pestañas (una sola función navega en las dos filas, sus «Próximamente» sin botón, la línea de borde a borde) y la `195` con `diceLoQueAbre`. Una revisión adversarial de cuatro lentes (el modelo, React y lo visual, la verdad de los textos, las pruebas) encontró, y quedó arreglado: con el puntero encima, la píldora abierta perdía la letra (el color del hover le ganaba al de la abierta); su anillo de foco caía sobre su propio fondo; Radar encendía el punto con un scraping del Scraper pero abría el Espía, donde el trabajo no se ve —ahora la entrada con el punto abre la sub-pestaña que lo retoma—; ninguna prueba impedía que una hoja escondiera la fila del grupo, que los textos de los leads volvieran a escribir el lugar a mano, ni que la cabecera escribiera el nombre de una sección; y una docena de comentarios y documentos que nombraban entradas viejas. 53 mutaciones vistas en rojo |
| **F2 · La barra y el engranaje** | `NE-48` (el contador) y `NE-49`. **Hecho** el 2026-10-02: el contador va en mono al lado del nombre, mudo, y el lector oye «2 entradas»; cada destino del engranaje viaja con su ceja, su subtítulo y si sólo se ve desde la principal (lo dice el menú, `soloDesdeLaPrincipal`), y el menú arma «Solo {la organización}» con la sesión; las tres pantallas llevan la cabecera sin fila, y de sus títulos propios se oculta sólo el `h2`. La bajada que queda se dibuja como descripción: la estética de operación la hace título (24 px), y debajo del nombre de la cabecera se leían dos. Una revisión adversarial de tres lentes encontró, y quedó arreglado: mirando a una empresa cliente, un rol de plataforma —que ve Monitoreo e Incidentes desde cualquier empresa— leía «SOLO {el cliente}», porque la sesión trae la organización que se mira; ahora el nombre va sólo si ésa es la principal, y si no, «Solo la organización principal». También comentarios que daban lo del engranaje por pantallas sin cabecera, y el estilo del contador y del subtítulo, que no vigilaba ninguna prueba. 23 mutaciones vistas en rojo | `components/Nav.jsx`, `components/CabeceraDeDepartamento.jsx`, `components/MenuDeUsuario.jsx`, `lib/autorizacion/departamentos.ts` (la ceja y los subtítulos del engranaje), `app/departamentos.css`, `app/armazon.css`, `app/api/auth/sesion/route.ts` si la navegación necesita la regla de la principal | `193`: el contador cuenta lo que se ve (contar las sub-pestañas; no contar las «Próximamente»); `194`: la cabecera del engranaje con la ceja del modelo y sin fila (la ceja a mano; dibujar la fila), la bajada se conserva en el engranaje (ocultarla); el menú: el subtítulo sale del modelo y el «SOLO» de la regla y del nombre de la sesión («SOLO ARIA» a mano; «SOLO» en Ajustes) |
| **F3 · Lo «Próximamente» del cerebro** | `NE-50`. **Hecho** el 2026-10-02: la caja va en una tercera fila de la rejilla, `consulta`, y pregunta sobre la entrada que nombra la cabecera; CONVERSACIONES y la nota del Inicio, como se planeó. La prueba de la caja y de CONVERSACIONES es una nueva, la `197`, y no la `196`, que es de los grupos. Una revisión adversarial de dos lentes encontró, y quedó arreglado: entre 761 y unos 870 px el texto de muestra cortaba el nombre de la entrada a la mitad —ahora es un campo de un renglón con puntos suspensivos, y la palabra «Próximamente» se va por debajo de 1000 px—; la caja y la nota del Inicio aceptaban texto agregado sin que la prueba lo viera; y documentos que daban la barra «Pregúntale…» por no vuelta y la rejilla por de dos filas. 24 mutaciones vistas en rojo | `components/ConsultaAlCerebro.jsx` (nuevo), `components/CommandCenter.jsx`, `components/Nav.jsx`, `components/views/ExecutiveView.jsx`, `app/armazon.css`, `app/departamentos.css` | `162`: la rejilla de la computadora suma el área de la caja y la del teléfono no (quitarla; agregarla al teléfono); `189`: la nota del Inicio puede nombrar la Reunión, sólo esa línea (una tarjeta de Reunión en el Inicio sigue en rojo); nueva `197`: la caja está deshabilitada, no manda nada y nombra la entrada abierta (quitar `disabled`; un `onSubmit`; el nombre a mano), no se dibuja sin departamento, y CONVERSACIONES no navega, no lista nada y sólo la ve quien ve el Inicio |
| **F4 · Cierre** | Los documentos al día, las citas reapuntadas, la memoria y el push, con el OK del usuario | `01`, `02`, `05`, `06`, `07`, `08`, `00-MAPA.md` de esta carpeta —también el recorrido del humo con login, que nombra «Research › Scraper → Marketing › Tu página»—; notas «después del corte» en `estado actual/14`, `15` y `16` y en los `12-QUIEN-VE-QUE.md` que nombran a Creative, Sales, los analizadores o Mis Leads; y la tabla de `docs/OTROS/futuro/permisos-por-herramienta.md`, que dice qué abre hoy cada permiso | `101` |

Los documentos que describen lo que cambia se actualizan **en la etapa que lo cambia**: un documento que
describe lo que todavía no existe es falso.

## Lo que se rompe en silencio

| riesgo | cómo se ve | quién lo vigila |
|---|---|---|
| Una sub-pestaña de Leads se muestra por la sección de otra | la persona toca «De GHL» y la pantalla le da 403 | `196` |
| Un grupo esconde una pestaña | una pestaña de Tools que la persona puede ver y no puede abrir | `191`, también dentro de los grupos |
| Un grupo aparece sólo por su «Próximamente» | Leads con sólo «Todos», que no abre nada | `196` |
| El punto «scrapeando» mira sólo la primera sub-pestaña | un escaneo del Scraper en vuelo sin aviso en la barra | `193` |
| La entrada abierta no encuentra la sub-pestaña | la barra no marca nada y la cabecera no se dibuja estando en Sales › Leads › De Radar | `196` y `193` |
| Un texto sigue diciendo «Research › Mis Leads» | el agente de ICP manda a la persona a un lugar que no existe | `194` y `133` |
| La cabecera del engranaje oculta la bajada | Ajustes deja de decir de qué empresa es la configuración | `194` |
| La caja del pie parece responder | alguien escribe una pregunta y espera | `197` |
| Las citas `archivo:línea` se corren | los documentos mandan a una línea que dice otra cosa | `101` (sólo las que se pasan del final); el resto, con el mapa del diff en cada etapa |

## Lo que no entra

Lo que el diseño cambia **por dentro** de cada pantalla, que es de la fase de detalles, está en
`08-LO-QUE-QUEDA-PARA-DESPUES.md`, «Del diseño de la segunda edición».

## Estado

| etapa | estado |
|---|---|
| F0 · documentos | hecho, 2026-10-02 |
| F1 · el modelo, los nombres y los textos | hecho, 2026-10-02 |
| F2 · la barra y el engranaje | hecho, 2026-10-02 |
| F3 · lo «Próximamente» del cerebro | hecho, 2026-10-02 |
| F4 · cierre | por hacer |
