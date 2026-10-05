# Lo que Leads Portal recibe, lo que entrega, y cómo se retira la maqueta sin romper Executive

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional y de una **medición
> propia contra producción**, agregada y sin un solo dato personal, hecha el **2026-09-27 a las
> 00:10 UTC** (el 26 a las 19:10 en Lima). Cada afirmación lleva su `archivo:línea`. Lo que no se
> pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a la maqueta son exactas al 2026-09-26, y LP-6 las rompe de dos maneras.** Las de
> `lib/aios/leads-portal.js` fallan al resolverse cuando el archivo se borra, y las ve
> `pruebas/codigo/101-las-citas-de-los-documentos.test.ts`. Las de `lib/aios/leads-group.js`
> **posteriores a la línea 56** son peores: LP-6 le saca dos manejadores y el archivo se acorta, así
> que esas citas **siguen resolviendo y muestran otra cosa**. LP-7 tiene que reapuntarlas a mano; lo
> mismo vale para `components/views/ContactsView.jsx`, `lib/aios/index.js`, `scripts/paridad.mjs` y
> `pruebas/codigo/90-fundaciones.test.ts`.

**Leads Portal no calcula ningún dato propio.** Todo lo que va a mostrar ya lo guarda el barrido, y
todo lo que va a contar ya tiene una definición en otra pestaña. Lo que sí tenía, el 2026-09-26, era un contrato con
Executive que nadie escribió: dos globales de `window` y un cajón compartido, por los que una fila
del embudo de Executive terminaba abriendo la ficha inventada de esta pestaña. LP-6 se llevó la ficha y `window.AIOSLeadCard`; el 2026-10-01, la etapa E7 de la nueva estructura borró la maqueta del Executive, y con ella el embudo, el cajón y `window.AIOSLeads`.

---

## 1 · Lo que recibe de la sincronización

### LP08-01 · Lee lo que el barrido ya guarda, y no le pide nada nuevo al CRM

**Rastro** · La tabla `negocio.contactos` en `lib/datos/esquema.ts:328-446`: el puntaje (`:358`),
el asignado del CRM (`:369`), cuándo se sincronizó (`:383`), desde cuándo hay mensajes (`:390`), los
campos del CRM (`:402`), el alta (`:416`), la atribución del primer toque (`:429`) y el país
(`:445`). Las siete tablas de las que sale todo están en `LP09-01`.

**Requisito** · **Sin sincronización nueva y sin columnas nuevas** (decisión del 2026-09-26). El
puntaje ya llega: lo deriva `lib/negocio/sincronizar.ts:421` del mismo mapa de campos que el barrido
normaliza en la línea de arriba, sin una llamada más al proveedor, y **guarda el cero como cero y la
ausencia como nulo** (`lib/negocio/sincronizar.ts:412-420`). Esta pestaña hereda esa distinción y no
la colapsa: el cero cuenta como «Sin calificar» con su motivo (`LP02-09`), no se reescribe.

**Y la ficha no refresca.** La ficha que ya existe, la de las pestañas de operación, refresca el
contacto contra el CRM al abrirse (`app/api/contactos/[id]/route.ts`, su encabezado lo dice en la
línea 23). La de esta pestaña **sólo lee** (`LP05-03`): abrir una ficha no gasta una llamada al
proveedor ni escribe en la base.

**Medido el 2026-09-27:** 593 contactos, todos de ARIA —closer 287 · setter 281 · congelados 25—;
última alta el 2026-09-25 y última sincronización el 2026-09-27 a las 00:00 UTC.

### LP08-02 · La frescura viaja con la cifra, porque la caída del 14 de septiembre es real

**Rastro** · `frescuraDe` (`lib/negocio/frescura.ts:108`) sobre las tareas `'contactos'` y `'citas'`
(`lib/negocio/barrido.ts:56-60`).

**Estado** · Las altas por semana fueron 117, 90, 53, 175 y 89 en las semanas que empiezan del 10 de
agosto al 7 de septiembre, y **4 y 3 desde la del 14** (censo del 2026-09-26). Es real: se pausaron
las campañas, lo confirmó el usuario ese mismo día. Con
3 personas a 7 días, una pantalla sin su frescura no distingue «no entró nadie» de «el barrido se
cayó», y esas dos cosas mandan a hacer cosas opuestas.

**Requisito** · La respuesta trae `frescura` y la pantalla la dibuja junto a los huecos. Y los 25
congelados **ya no se refrescan**: la ficha muestra cuándo se sincronizó cada persona por última vez
(`LP05-05`).

---

## 2 · Lo que recibe de otras pestañas

### LP08-03 · De Sales: la cohorte y «agendó» dan los mismos números que la cadena

**Rastro** · `lib/negocio/cadenaDeCierre.ts:169` arma la ventana con
`alta_en_el_crm >= now() - make_interval(days => N)`, rodante y no anclada al día, con el motivo
escrito en `:46-55`; y cuenta «con cita» con `tieneCitaAlcanzable` (`:204`).

**Requisito** · La cohorte de esta pestaña es **la misma expresión** y «agendó» es **el mismo
predicado**. La ruta llama a `cadenaDeCierre` dentro del mismo `conOrganizacion` y la prueba de LP-4
exige que el total y los agendados coincidan (`LP06-13`). Si dos pestañas publican cuántas personas
entraron en 30 días y cuántas agendaron, **y no coinciden, ninguna falla**: el defecto sólo se ve
poniéndolas una al lado de la otra.

### LP08-04 · Del sistema: los predicados se importan, no se copian

| qué | de dónde | por qué no se recalcula |
|---|---|---|
| cita alcanzable, cancelada, plantón | `lib/negocio/citasAlcanzables.ts:54`, `:64`, `:111` | los importan ya Sales, Conversion, Creative y Acquisition |
| «agendó» por persona | `lib/negocio/citasAlcanzables.ts:135` | estaba copiado ocho veces (`:118-120`); ya no |
| el descarte por etiqueta | `lib/ghl/contrato.ts:231-238`, en minúscula | la lista existe una vez; medido: 121 personas descartadas por etiqueta |
| el piso de una tasa | `lib/negocio/indicadoresDeCitas.ts:309` | es el mismo 10 que importan Acquisition, Creative, Conversion y Sales |
| las ventanas y la de omisión | `lib/negocio/periodo.ts:83-96`, `:109` | `periodoDe` (`:188`) rechaza lo que no está en la lista, como el `mes` del tercer botón de la maqueta (`LP06-02`) |

El descarte tiene un matiz que LP-2 resuelve: el predicado que existe, `descartado`
(`lib/negocio/citasAlcanzables.ts:79-85`), pregunta por el contacto **de una cita**. Esta pestaña
necesita preguntar por el contacto a secas, así que el plan agrega uno hermano sobre la misma lista,
en el mismo archivo, en vez de escribir la comparación en la consulta.

### LP08-05 · De Sales: la venta, el revenue y el cierre llegan como huecos

**Rastro** · `lib/negocio/huecosDeSales.ts:48-85`, con su fecha en `:46`.

**Requisito** · Mientras Sales declare que no hay ninguna venta registrada, esta pestaña no dibuja un
«Revenue» ni un «Cierre N %» por tramo como hacía la maqueta: el cierre viaja `null` con el motivo
`sin_ventas_registradas` y el monto dice «reportado» (`LP03-12`, `LP03-13`). Medido el 2026-09-27:
0 personas con venta, 0 montos cargados. Un «$0» afirmaría que no se vendió nada, y lo que pasa es
que nadie lo registró — es la misma frase de `lib/negocio/huecosDeSales.ts:60-61`.

### LP08-06 · De Conversion: el camino de entrada y el formulario, consumidos

**Rastro** · `familiaDelRecorrido` (`lib/negocio/recorrido.ts:139`), que reemplaza al «Vio el VSL»
de la ficha; el campo y los estados del «Form Landing VSL» (`:208-217`) y su último día (`:234`).

**Requisito** · Se consumen, no se reescriben. La ficha dice por dónde llegó la persona con la misma
clasificación que Conversion usa para contar a todos (`LP05-07`, `LP05-09`).

**Un detalle que LP-3 resolvió al exportar el helper de host:** `hostDeLaUltima`
(`lib/negocio/recorrido.ts:125-127`) estaba atado a `atribucion_ultima ->> 'url'`, y la ficha
necesita el host de la `url` y del `referrer` **del primer toque** (`LP05-13`). Ahora la expresión
vive en `hostDe` (`lib/negocio/recorrido.ts:306-315`), con la columna y la clave como parámetros, y
`hostDeLaUltima` la llama: lo que Conversion calcula no cambió.

### LP08-07 · De Acquisition: la atribución, por lista blanca

**Rastro** · `docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:93` (A8-07), `:238-239` (A8-17 y
A8-18), `:304` (A8-29).

**Requisito** · La ficha muestra las claves que Acquisition ya dijo que se pueden mostrar, con sus
rótulos, y **nunca** la IP, el navegador, el `fbclid` ni una clave desconocida (`LP05-13`). Medido
el 2026-09-27: 286 direcciones traen un token adentro, así que de `url` y `referrer` va sólo el host;
y los 213 `adId` que hay **cruzan los 213** con `negocio.anuncios`, así que el anuncio se nombra por
su nombre y no por un número.

### LP08-08 · De Creative: nada, y tres divergencias que se declaran

Creative publica el ICP promedio por creativo (`components/creative/PanelDeCreative.jsx:374`). Esta
pestaña publica tramos por persona. **Las dos cifras no se reconcilian, y ninguna está mal:**

| | Creative | Leads Portal |
|---|---|---|
| el cero | **se promedia**: el filtro numérico acepta `0` (`lib/negocio/calidadDelCreativo.ts:209`) y entra al `avg` (`:218`) | **no entra en ningún tramo con puntaje**: es «Sin calificar» |
| de dónde lee el puntaje | del campo crudo, **buscado por nombre** (`lib/negocio/calidadDelCreativo.ts:62`, `:135`) | de `contactos.score`, derivado **por identificador** (`lib/ghl/contrato.ts:305`) |
| la ventana | anclada al día (`lib/negocio/calidadDelCreativo.ts:228`), porque cruza con el gasto | rodante, como Sales (`LP08-03`) |

Hoy los dos caminos leen el mismo campo —el comentario de `lib/negocio/calidadDelCreativo.ts:59` y la
constante de `lib/ghl/contrato.ts:305` nombran el mismo identificador—. **El día que alguien renombre
«Puntaje | ICP» en el CRM, Creative pierde el ICP y esta pestaña no**, y ninguna de las dos falla.

**Requisito** · Esta pestaña no publica un «ICP promedio». Si algún día reparte los tramos por
campaña o por creativo, lo dice al lado: *«los ceros cuentan como sin calificar; en Creative se
promedian»*.

### LP08-09 · Del alcance del closer: el nombre del asignado, o nada

**Rastro** · `closersDeLaEmpresa` (`lib/negocio/alcanceDelCloser.ts:77`).

**Requisito** · El nombre del closer sale de ahí o no sale; un asignado que no cruza no se muestra
como identificador crudo (`LP05-16`). Medido el 2026-09-27: 253 personas con asignado en el CRM y 252
que cruzan con uno de los 3 closers configurados. Es la regla que la maqueta rompía escribiendo a
mano el nombre de un closer real (`LP10-03`).

---

## 3 · El contrato con Executive, que nadie escribió

### LP08-10 · El cajón «Grupo de contactos» es de todo el sistema y lo arma un módulo de esta pestaña

**Rastro** · El marcado en `components/Overlays.jsx:5-26@c4cf2a8`; el módulo en `lib/aios/leads-group.js`,
que se publica como `window.AIOSLeads` (`lib/aios/leads-group.js:5@c4cf2a8`) y escucha **cualquier**
`[data-leads]` del documento (`lib/aios/leads-group.js:79-85@c4cf2a8`).

**Quién lo abre hoy** · Medido el 2026-09-26 sobre `components/` y `lib/`, hay **dos emisores** de
`data-leads` y ninguno más:

- `lib/aios/executive.js:49@c4cf2a8`, la columna de cifras del embudo del negocio —sin `data-seg`—;
- `aios-command-center_1.html:4714`, el número de cada una de las cuatro tarjetas de tramo.

Los cinco sitios de Acquisition que `A7-25` contó se fueron con su módulo el 2026-09-16
(`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:3-4`), y ninguno de los paneles nuevos de
Inteligencia emite el atributo. **Después de LP-6 queda uno solo: Executive** (`LP03-14`).

**Lo que dibuja, y por qué no es una lista de nadie:**

- **catorce personas inventadas** (`lib/aios/leads-group.js:14-29@c4cf2a8`), repetidas hasta cuarenta filas
  para llenar cualquier conteo (`:31-37@c4cf2a8`), con tres montos en dólares (`:15@c4cf2a8`, `:16@c4cf2a8`, `:19@c4cf2a8`);
- **«Sin calificar» abre tres personas con puntaje 87, 91 y 82.** El filtro compara el tramo de cada
  una contra `'nc'` con una función que sólo devuelve `alto`, `medio` o `bajo` (`:10@c4cf2a8`, `:32@c4cf2a8`); como
  nadie coincide, cae a la lista entera (`:33@c4cf2a8`) y toma las tres primeras;
- **una misma persona inventada cambia de tramo entre los dos archivos**: con puntaje 79 es «medio»
  en el portal (`aios-command-center_1.html:4624`) y «alto» en el cajón (`lib/aios/leads-group.js:20@c4cf2a8`,
  por el corte de `:10@c4cf2a8`);
- cada fila tiene un salto a la **raíz** de GoHighLevel, no al contacto (`:8@c4cf2a8`, `:51@c4cf2a8`, `:54-56@c4cf2a8`);
- y el panel se abre sin cambiar nunca su `aria-hidden="true"` (`components/Overlays.jsx:7@c4cf2a8`,
  `lib/aios/leads-group.js:70@c4cf2a8`), el defecto que `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:507-515`
  ya registró.

**Requisito** · El panel nuevo **no emite `data-leads`** y no abre este cajón (plan de LP-6). El
cajón pasa a ser **maqueta de Executive**, con su texto intacto, porque la compuerta de paridad
compara su `innerText` contra el prototipo (`scripts/paridad.mjs:275-278`).

### LP08-11 · `window.AIOSLeadCard`: Executive la usa sin nombrarla

**Rastro** · Estaba definida sólo en la maqueta, `aios-command-center_1.html:4873-4878` en el
original, y la llamaba sólo el clic de una fila del cajón, con guarda. **Las dos cosas se fueron en
LP-6**: el módulo con la maqueta, y el clic, que dejó en su lugar un comentario
(`lib/aios/leads-group.js:57-59@c4cf2a8`).

**La cadena, entera, como era:** una cifra del embudo de Executive (`lib/aios/executive.js:49@c4cf2a8`) → el
escuchador del cajón (`lib/aios/leads-group.js:79-85@c4cf2a8`) → el clic en una fila →
`window.AIOSLeadCard(nombre)` → `openLead` (`aios-command-center_1.html:4786-4870`), que escribe la ficha
en el `#drawer` compartido (`:4788-4792`, `:4867-4869`). **Executive no la nombra en ninguna parte, y la
usa en cada clic.**

**Y tiene dos defectos que el portal nuevo no puede heredar:**

1. **Identifica a la persona por su nombre visible** (`aios-command-center_1.html:4874`). Dos personas
   con el mismo nombre son la misma; una persona renombrada en el CRM deja de existir.
2. **Si el nombre no está, inventa una ficha.** Toma la primera persona de la lista y le pega el
   nombre pedido (`aios-command-center_1.html:4876-4877`). Las dos personas que sólo están en el cajón
   (`lib/aios/leads-group.js:26@c4cf2a8`, `:28@c4cf2a8`) abren la ficha completa **de otra**: su teléfono, su
   correo, su venta de $4.500 y el nombre del closer real que la maqueta le atribuye
   (`aios-command-center_1.html:4591-4607`).

**Requisito** · La ficha nueva se abre **por id, y un id que no existe o que es de otra empresa da
404** (`LP05-01`, `LP04-09`). No hay puerta global por nombre: `window.AIOSLeadCard` se fue con
`leads-portal.js` en LP-6 y no se reemplazó, y `pruebas/codigo/178-la-maqueta-del-leads-portal-se-fue.test.ts`
se pone roja si alguien la vuelve a definir o a llamar.

### LP08-12 · Cómo se retiró la maqueta sin romper Executive

En orden de dependencia, y **hecho en LP-6** punto por punto. Cada punto dice qué se habría roto si
se hacía mal.

1. **`#drawer` se queda.** Executive lo abre desde los temas de su resumen y de sus cambios y desde
   «Reuniones anteriores» (`lib/aios/executive-panel.js:80-81@c4cf2a8`, `:101-102@c4cf2a8`), y lo cierra el
   armazón. La ficha nueva usa un cajón **con id propio** (`LP05-02`): si reusara `#drawer`, abrir
   una ficha pisaría lo que Executive hubiera escrito ahí, y al revés.
2. **`window.AIOSLeadCard` se fue, y su único llamador se limpió.** La guarda evitaba el error,
   pero la fila habría quedado **clicable y muda**: el `cursor:pointer` de `.lg-r` vive en
   `app/aios.css:2345-2346`, que no se toca. El clic salió (`lib/aios/leads-group.js:57-59@c4cf2a8` es ahora
   el comentario que lo explica) y el cursor se anuló **fuera** de `app/aios.css`, en
   `app/leads-portal.css:107@c4cf2a8`, con el precedente del commit `bd26085`, que anuló el cursor de los
   iconos de la ficha en `app/closer.css` «porque `aios.css` tiene que seguir comparable contra el
   HTML del prototipo».
3. **El pie del cajón dejó de preseleccionar el tramo.** Buscaba `#lpIcpSeg`, que el panel nuevo no
   tiene; la guarda lo apagaba, y se borró para que no se leyera como rama viva
   (`lib/aios/leads-group.js:65-68@c4cf2a8` es el comentario que quedó). **La navegación a la pestaña se
   quedó** (`:61-64@c4cf2a8`), y con ella una contradicción medida: ver `LP08-P01`.
4. **`initLeadsPortal` salió del arranque**, con su `import` y su entrada de `MODULOS`, y **el
   comentario de arriba dejó de nombrar a `window.AIOSLeadCard`** (`lib/aios/index.js:1-4@c4cf2a8`): afirma
   que el orden de los módulos importa porque unos registran globales que otros usan, y ése era el
   caso que lo justificaba. El motivo de la salida quedó escrito en `lib/aios/index.js:14-16@c4cf2a8`.
5. **El bloque del Plan de acción se fue** (el original, `aios-command-center_1.html:5710-5730`), y
   con él el único que abría `#recoModal` (`LP07-08`).
6. **La compuerta de paridad se reordenó, no se retiró.** `VISTAS` quedó vacía
   (`scripts/paridad.mjs:153`, con su motivo en `:134-152`); salieron los dos pasos del calendario y
   el de la ficha, y **«grupo de contactos» se mudó a Executive**, a `#exFunnel [data-leads]`, al final
   de la cadena (`:212`), con la explicación de los tres en `:157-170`. Como cada paso cierra lo que
   abrió el anterior, el paso mudado ya no empieza cerrando `#dwClose`: viene detrás de «funnel
   ejecutivo». La compuerta **no** quedó retirada: el guardián sólo se dispara con `VISTAS` y `PASOS`
   vacías a la vez (`:301-305`), y quedan «Ask Executive» (`:186-187`), «funnel ejecutivo»
   (`:209-211`) y el mudado.
7. **`pruebas/codigo/90-fundaciones.test.ts:1274-1339`** exigía exactamente `['contacts']`. Ahora exige
   la lista vacía (`:1321-1326`), que ningún paso nombre `#v-contacts` (`:1333`) y que el cajón se abra
   desde el embudo de Executive (`:1334-1338`), con su motivo.
8. **El calendario se queda sin quién lo abra.** La píldora de esta pestaña
   (`aios-command-center_1.html:3037`) es la única visible: la de Executive está `hidden`
   (`components/views/ExecutiveView.jsx:62@c4cf2a8`). Deuda anotada (`LP06-02`, `LP10-13`).

Lo que **no** se toca, porque es de Executive: `lib/aios/leads-group.js` salvo los dos manejadores,
`#lgPanel`, las reglas `[data-leads]` de `app/aios.css:2366-2370` y la emisión de
`lib/aios/executive.js:49@c4cf2a8`.

### LP08-13 · Lo que Executive dice de Leads Portal, y nadie ve o nadie debería creer

Tres sitios de Executive hablan de esta pestaña, y ninguno se toca en LP-6 porque son de Executive.
Quedan declarados para que nadie los lea como una entrega de Leads Portal:

- **Su ficha de departamento** —«312 contactos · 78 de ICP alto», la frase del 22 y el 61, y
  «Entrego a Acquisition qué campañas traen el ICP que cierra» (`lib/aios/executive.js:198-201@c4cf2a8`)—
  **no se dibuja en ninguna parte.** El mapa tiene cinco nodos con `data-node`
  (`components/views/ExecutiveView.jsx:236@c4cf2a8`, `:250@c4cf2a8`, `:264@c4cf2a8`, `:278@c4cf2a8`, `:292@c4cf2a8`) y ninguno es
  `contacts`; la ficha sólo aparece al pasar sobre un nodo (`lib/aios/executive.js:215-219@c4cf2a8`). Es un
  dato escrito para un nodo que no existe.
- **El chat ejecutivo** ofrece tres preguntas en esta pestaña (`lib/aios/executive-chat.js:24@c4cf2a8`). Las
  tres caen en la respuesta por omisión —ninguna tiene las palabras que `pick` busca
  (`lib/aios/executive-chat.js:77-83@c4cf2a8`)—, que es un párrafo sobre Conversion con «$15,000» y cita a
  **Leads Portal como fuente** (`:31-32@c4cf2a8`).
- **El embudo del negocio** dibuja seis cifras, una por paso de `STEPS` (`lib/aios/executive.js:22-29@c4cf2a8`),
  todas con `data-leads` (`lib/aios/executive.js:41-54@c4cf2a8`), y cualquiera abre el cajón; la de «Contactos» vale 312 a 7 días y
  1.248 a 30 (`lib/aios/executive.js:17-18@c4cf2a8`).

---

## 4 · El contrato del cajón, `A7-24` a `A7-32`, punto por punto

### LP08-14 · Qué pasa con cada requisito de Acquisition cuando el portal es real

`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:391-493` escribió el contrato del drill-down cuando
las cifras de Acquisition todavía lo abrían. Esta carpeta lo sostiene, lo cambia o lo deja abierto,
**y dice cuál en cada caso**:

| id | qué pedía | con Leads Portal real |
|---|---|---|
| `A7-24` | cuatro atributos sobre la cifra y un solo escuchador global | **sigue, con un solo emisor**: Executive, sin `data-seg`. El portal deja de emitir |
| `A7-25` | que ningún volumen de Acquisition sea un número sin lista detrás | **sin cumplir, y ya no por la maqueta**: los cinco sitios se fueron con `acquisition.js` y el panel nuevo no abre listas. El destino natural sería esta pestaña: `LP08-P02` |
| `A7-26` | la inversión no abre lista | **se conserva por analogía**: el monto reportado tampoco abre una lista |
| `A7-27` | los calificados abren al tramo alto; el corte vive fuera de Acquisition | **el corte vive fuera, y en dos sitios**: se escribe en un módulo propio en LP-1, sin imports; el de `lib/aios/leads-group.js:10@c4cf2a8` se queda con Executive (ver abajo). **La palabra «calificado» no se usa**: decisión del 2026-09-26 |
| `A7-28` | mandar la cohorte, no un conteo | **sigue abierto**. El portal tiene la cohorte; el cajón de Executive sigue recibiendo un número y fabricando la lista (`lib/aios/leads-group.js:31-37@c4cf2a8`) |
| `A7-29` | decir cuándo se muestra menos de lo contado | **se hereda**: «N de M», de a 60, y la marca de recorte sobre el tope (`LP04-03`, `LP04-04`, `LP04-15`) |
| `A7-30` | puntaje por tramo, nombre, «origen · estado», monto si vendió **y un salto a GoHighLevel** | **todo menos el salto**. Sin enlace al CRM, por decisión: en el Closer se quitó a pedido en el commit `bd26085`, y la ficha llama con `tel:` y escribe con `mailto:` (`LP05-06`). El «origen» es campaña y creativo **por nombre** (`LP04-05`) |
| `A7-31` | el pie navega al portal **y preselecciona el tramo** | **navega, no preselecciona** (plan de LP-6). La consecuencia está en `LP08-P01` |
| `A7-32` | el escuchador es del sistema; Executive abre el mismo cajón | **sigue, y es lo único que queda** |

Y `A7-34` —el `aria-hidden` que nadie cambia— se queda con el cajón, en Executive.

**Una consecuencia de escribir el corte en un módulo nuevo sin retirar el viejo (`A7-27`), que hay
que aceptar por escrito:** después de LP-1 el
75/50 existe **dos veces**: en el módulo nuevo y en `lib/aios/leads-group.js:10@c4cf2a8`, que no se toca por
la paridad. Si alguien cambia el umbral en el módulo, el cajón de Executive sigue cortando en 75. Se
acepta porque el cajón es una maqueta con personas inventadas; el día que Executive se reconstruya,
importa el módulo o no corta.

---

## 5 · Lo que entrega

### LP08-15 · Hoy, a nadie; y lo que podría consumirse, con su condición

Ninguna pantalla lee de Leads Portal, y LP-4 no cambia eso. Lo que produce y otro podría consumir:

- **A Executive, la cohorte por tramo.** Es lo que la fila «Contactos» de su embudo finge
  (`LP08-13`). Pero Executive todavía no tiene operaciones de servidor
  (`lib/autorizacion/secciones.ts:217`), y esa fila también tiene que coincidir con la de
  Acquisition (`A7-07`): **quien la construya consume `cadenaDeCierre` o esta cohorte, no escribe
  una tercera**.
- **A Acquisition y a Creative, nada nuevo.** «Qué campañas traen ICP alto» no se publica acá: la
  pestaña dibuja personas, y el agregado por origen ya lo publica Creative con su regla de ceros
  (`LP08-08`). Ver `LP08-P03`.
- **A Sales, nada.** La dirección es la contraria: el portal consume la cadena (`LP08-03`).

### LP08-16 · Dos fichas de la misma persona, y una sola definición de cada pieza

**Rastro** · La ficha de las pestañas de operación, `components/negocio/Ficha.jsx`, y la de esta
pestaña, que LP-3 arma sobre `perfilDeLaFicha` (`lib/negocio/ficha.ts:459`).

**Requisito** · Quien tenga las dos pestañas va a ver a la misma persona en dos fichas. Pueden
diferir en **qué hacen** —aquélla refresca y escribe notas; ésta sólo lee (`LP05-03`)— pero
**no en qué muestran**: el cuestionario, los mensajes y el closer asignado salen de las mismas
funciones. Es la regla que el proyecto ya escribió en producción: si dos pantallas muestran el mismo
número, comparten la función que lo calcula (`app/api/closer/mi-dia/route.ts:18`).

---

## Preguntas abiertas

### LP08-P01 · ¿El pie del cajón de Executive sigue llevando a Leads Portal?

**Resuelta el 2026-10-01** (nueva estructura, E7): el cajón se borró con la maqueta del Executive, y con él su pie y las seis cifras que lo abrían. Después de LP-6, abierto desde la fila «Contactos» a 7 días, el pie dice **«Ver los 312 en Leads
Portal →»** (`lib/aios/leads-group.js:60@c4cf2a8`, con el 312 de `lib/aios/executive.js:17@c4cf2a8` y el período
inicial de `:30@c4cf2a8`). Desde las otras cinco filas promete **268, 194, 57, 36 u 11** (también
`lib/aios/executive.js:17@c4cf2a8`): conversaciones, visitas, agendamientos, citas asistidas y ventas, que no
son una cuenta de contactos de esta pestaña. Y las seis navegan al mismo portal
(`lib/aios/leads-group.js:61-64@c4cf2a8`), que abre en 30 días con **286 personas**, y que a 7 días —el
período desde el que se abrió el cajón— tiene **3** (medido el 2026-09-27).

Las tres salidas, y ninguna es buena:

1. **se deja la navegación**, que es el plan: el pie promete una cifra y el destino muestra otra;
2. **se le saca el manejador**: el pie queda como un botón que no hace nada, que es el defecto que
   esta carpeta le reprocha a la maqueta;
3. **se cambia el texto**: la compuerta de paridad compara el texto del cajón
   (`scripts/paridad.mjs:277`) y el paso mudado daría rojo permanente.

La contradicción no es nueva —`A7-28` la anunció: una cifra y su lista no comparten origen—, pero
hasta hoy las dos mitades eran inventadas. Desde LP-5 una es real.

### LP08-P02 · ¿El portal acepta un filtro de entrada?

`A7-25` y `A7-28` piden que una cifra de otra pestaña abra **las personas que la produjeron**. El
portal es la única pantalla que puede mostrarlas, y el plan decidió que no reciba nada: ni tramo, ni
período, ni anuncio. Si algún día lo recibe, el contrato es el filtro —expresable en una URL o en el
estado de la vista—, no un conteo ni una lista de nombres; y la pantalla que lo emite tiene que
calcular su cifra con la misma cohorte (`LP08-03`), o el portal va a contradecirla.

### LP08-P03 · ¿Quién publica «qué campañas traen ICP alto»?

El plan de Acquisition le mandaba la pregunta a Leads Portal; el de Leads Portal, a Acquisition
(`LP07-05`). Ninguno la contestaba. Hoy la única pantalla que cruza el puntaje con el origen es
Creative, por creativo y promediando los ceros. Hay que decidir si esa respuesta es de Creative —y
entonces se dice que su ICP es un promedio que incluye ceros—, de Acquisition —que hoy no tiene una
columna de ICP— o de ninguna.
