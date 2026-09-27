# Leads Portal — mapa de los requisitos

> Requisitos derivados de la maqueta de Leads Portal, del documento funcional, de lo que otras
> carpetas ya pidieron para esta pestaña y —como en Creative, Conversion y Sales— de una **medición
> propia contra producción**, hecha el **2026-09-27 a las 00:10 UTC** (el 26 a las 19:10 en Lima)
> sólo con consultas agregadas y sin un solo dato personal. Cada requisito lleva el `archivo:línea`
> del que sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
>
> **Las citas a la maqueta son exactas al 2026-09-26.** En LP-6 se rompen de dos maneras distintas,
> y LP-7 las reapunta: ver § 2.

---

## El estado, en una línea

**Sin construir. Al 2026-09-26 la pestaña es una maqueta que dibuja quince personas inventadas sin
pedirle nada al servidor; todo lo que tiene que mostrar ya se guarda, y lo que más le falta no es un
dato que haya que traer: es que nadie registra una asistencia ni una venta.**

| qué hay hoy | dónde |
|---|---|
| La vista: el encabezado, la barra de controles y los contenedores vacíos | `components/views/ContactsView.jsx`, 101 líneas |
| Las tarjetas, la rejilla y la ficha, con quince personas inventadas | `lib/aios/leads-portal.js`, 324 líneas |
| El cajón «Grupo de contactos», con catorce personas inventadas, doce de ellas repetidas del portal (`LP10-02`) | `lib/aios/leads-group.js`, 89 líneas; su marcado en `components/Overlays.jsx:5-26` |
| El «Plan de acción»: cuatro frases escritas a mano | `lib/aios/period-controls.js:41-61` |
| El cajón donde se dibuja la ficha, que también usa Executive | `components/Overlays.jsx:120-136` |
| La sección, todavía con la bandera `sinOperacionesTodavia` | `lib/autorizacion/secciones.ts:219-227` |

| qué va a haber, según el plan (LP-1 a LP-6) | dónde |
|---|---|
| Los tramos, en un módulo sin imports | `lib/negocio/tramosDelIcp.ts` |
| La cohorte por persona, en una sola sentencia | `lib/negocio/leadsDelPortal.ts` y `ventasDelContacto.ts` |
| La ficha que sólo lee, la atribución por lista blanca y los huecos con fecha | `lib/negocio/fichaDelLeadDelPortal.ts`, `atribucionVisible.ts` y `huecosDelLeadsPortal.ts` |
| Las dos rutas, y la bandera bajada en el mismo commit | `app/api/leads-portal/route.ts` y `app/api/leads-portal/[id]/route.ts` |
| El lector, los filtros, el panel y la ficha | `lib/negocio/vistaDeLeadsPortal.ts`, `filtrosDelPortal.ts` y `components/leads-portal/` |

El plan aprobado está en `C:\Users\USUARIO\.claude\plans\purring-enchanting-dream.md`. **Ninguna
etapa necesita migración**: las tablas que la pestaña lee ya existen (`LP09-01`). La tabla de qué se
construye en cada etapa, y con qué prueba, está en `LP13-04`.

---

## 0 · De dónde sale esta carpeta

### Las cuatro fuentes

| fuente | qué aportó | dónde está documentado |
|---|---|---|
| **El documento funcional** — `CC_Arquitectura_Funcional.md`, 1.650 líneas | **ninguna pantalla**: la palabra «portal» no aparece. Aporta el perfil de dieciocho renglones del § 5.3, siete entidades del § 5.1 y tres menciones del ICP fuera del perfil (§ 9.6, § 10.5 y § 10.7) | `11-LO-QUE-PIDE-EL-DOCUMENTO.md` |
| **La maqueta** — los cinco archivos de la tabla de arriba | la forma: cinco tarjetas, una rejilla con dos filtros y un buscador, una ficha de siete secciones; y 536 valores de dato inventados (`LP10-01`) | `03`, `04`, `05`, `07` y `10` |
| **Lo que otras carpetas ya pidieron para esta pestaña** | el corte y los ceros (`A4-17` a `A4-19`, y las preguntas P-5 y P-6), el contrato del cajón (`A7-24` a `A7-32`), la atribución de la ficha (`A8-07`, `A8-17`, `A8-18` y `A8-29`), la derivación del plan de Acquisition (`A6-21`), el «Agendado» del formulario (`CV14-09`) y los huecos de Sales | `03`, `05`, `07`, `08` y `14` |
| **Las decisiones del usuario del 2026-09-26** | lo que ninguna medición decide: dónde cortar, cómo rotular, quién ve, qué no se enlaza | § 4 de este archivo |

Y una quinta cosa que no es fuente de requisitos sino **el árbitro**: la medición contra producción,
con cada consulta al pie de su cifra en `09-DE-DONDE-VIENE-CADA-DATO.md`.

> **El documento no vive en el repositorio.** Está en `C:\Users\USUARIO\Downloads\`. Las citas
> `§ N:línea` de esta carpeta son a ese archivo, verificado con `wc -l` = 1.650.

### Quién gana cuando dos fuentes no coinciden

1. **La medición gana sobre la maqueta y sobre el documento**, como en Sales: cuando se
   contradicen, gana lo que la base puede sostener (`docs/sales/00-MAPA.md:43-45`). La maqueta llama
   «Calificado medio» a un tramo con 22 personas rechazadas por ICP (`LP03-06`); el documento pide el
   porcentaje visto del VSL, y el medidor no reporta desde el 2026-08-30 (`LP11-10`). En los dos casos
   manda la base.
2. **Las decisiones del usuario deciden lo que la medición no puede decidir**, y se registran como
   decisión, no como hallazgo (`LP11-07`). La medición puede decir dónde separa un corte; elegirlo es
   otra cosa (`LP14-05`). Si un dato nuevo contradice la premisa de una decisión —un puntaje 0
   reciente, por ejemplo—, la pestaña **avisa y no reclasifica**: cambiar la regla es una decisión, no
   un efecto del aviso (`LP14-10`).
3. **Lo que otra carpeta ya pidió para esta pestaña se sostiene, salvo que esta carpeta diga por
   escrito que lo cambia, y por qué.** `LP08-14` lo hace punto por punto con `A7-24` a `A7-32`.
4. **Entre esta carpeta y el plan, o entre dos de sus archivos**, manda el que midió o el que
   enumeró, y se dice. Son tres: las dos primeras las notó el propio archivo; la tercera la encontró
   este mapa, y ningún archivo se editó para esconderla.

| tema | qué dicen distinto | manda | por qué |
|---|---|---|---|
| El cuarto estado de la asistencia, y las 145 | `LP09-07` llama «sin cita» al cuarto estado y cuenta a las 145 como las que se dibujan «sin registrar»; `LP02-04` dice que el cuarto es «no aplica» y que 145 es un techo | `LP02-04` | usa las condiciones de la cita cerrable, y el propio `02` lo dice |
| El video precall en la ficha | el plan de LP-3 no lo nombra; `LP05-11` lo agrega | `LP05-11`, con la confirmación del usuario pendiente | `LP11-P02` |
| Cuántas tablas lee la pestaña | `LP08-01` remite a «las siete tablas» de `LP09-01`, que enumera **diez** | `LP09-01` | es el que las enumera, una por una, con su migración |

---

## 1 · Los quince archivos

| archivo | qué contesta |
|---|---|
| `00-MAPA.md` | éste: el estado, las fuentes, quién gana, el prefijo, las citas y el índice |
| **`01-LA-UNIDAD-ES-LA-PERSONA.md`** | **el que hay que leer si se lee uno solo.** La fila es una persona, los predicados son los del sistema, y de cada persona se dice sí, no o no se sabe |
| `02-METRICAS.md` | el catálogo: trece fichas con qué es, fórmula, unidad, población, rastro, estado y piso |
| `03-LAS-CINCO-TARJETAS.md` | las tarjetas por tramo: sobre quién cuentan, cómo se llaman y qué dice cada línea |
| `04-LA-REJILLA-Y-LOS-FILTROS.md` | la lista de personas, la búsqueda, el filtro de tramo, el de etapa y el contador |
| `05-LA-FICHA-DEL-LEAD.md` | la ficha, sección por sección: qué se llena con dato real y qué queda como hueco declarado |
| `06-PERIODOS-Y-PISOS.md` | las cuatro ventanas, la cohorte por el alta, la caída del 14 de septiembre y el piso |
| `07-EL-PLAN-DE-ACCION.md` | las cuatro frases del botón, ninguna sostenible hoy, y por qué el botón se borra |
| `08-LO-QUE-ENTREGA-Y-RECIBE.md` | lo que consume de otras pestañas, y cómo se retira la maqueta sin romper Executive |
| `09-DE-DONDE-VIENE-CADA-DATO.md` | el origen y la cobertura de cada campo, con la consulta de cada medición |
| `10-LO-QUE-NO-ES-UN-REQUISITO.md` | el censo de la maqueta —536 valores de dato, diecisiete personas inventadas— y la lista de borrado |
| `11-LO-QUE-PIDE-EL-DOCUMENTO.md` | el § 5.3 renglón por renglón, las entidades del § 5.1, y lo que el documento no tiene |
| `12-QUIEN-VE-QUE.md` | la regla de acceso, a quién alcanza hoy, qué va en la lista y qué sólo en la ficha |
| `13-EL-CONTRASTE.md` | la maqueta contra el documento contra lo medible: qué se construye en LP-1 a LP-6 y qué se dibuja como hueco |
| **`14-EL-PUNTAJE-DEL-CRM.md`** | qué es «Puntaje \| ICP», los cortes 75 y 50, los 47 ceros y el cruce con el rechazo |

Fuera de la carpeta, pedido con el mismo plan: `docs/futuro/icp-interno-calculado.md`, un ICP
calculado por Comando Central que **sólo se documenta**.

---

## 2 · Cómo se citan los requisitos

**El prefijo de esta pestaña es `LP`.** Comprobado el 2026-09-26: `A` es Acquisition, `C` Creative,
`CV` Conversion y `S` Sales, y ningún documento fuera de esta carpeta usa un identificador
`LP<nn>-<nn>`.

El identificador es `LP<archivo>-<nn>`, con **dos cifras para el archivo**: `LP02-01` vive en
`02-METRICAS.md` y `LP14-10` en `14-EL-PUNTAJE-DEL-CRM.md`. El plan escribía `LP<n>-<nn>`; las dos
cifras están para que ningún requisito se lea como una etapa: **`LP-4` es la etapa de las rutas;
`LP04-04` es un requisito de la rejilla.** Los identificadores son estables y se citan entre
archivos. Este mapa no lleva requisitos propios.

Las preguntas abiertas van como `### LP<archivo>-P01 · …`, **en el archivo donde nacen**, como en
Sales (`docs/sales/00-MAPA.md:83-84`). Cuando dos archivos llegan a la misma pregunta, lo dicen y
se contesta una sola vez: `LP02-P03` y `LP04-P03`; `LP05-P02` y `LP09-P04`; `LP14-P04` y
`LP02-P01`.

El documento a futuro usa `LPF-<nn>` y `LPF-P<nn>`: no vive en esta carpeta y no tiene número de
archivo.

### Las citas

- **El formato** es `archivo:línea` o `archivo:línea-línea`, siempre entre acentos graves.
  `pruebas/codigo/101-las-citas-de-los-documentos.test.ts` las resuelve por sufijo y exige que el
  archivo exista, que la línea no pase del final y que el sufijo no sea ambiguo
  (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:47`, `:75`). Hoy audita sólo
  `docs/sales` (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:37`); el plan de LP-0 le
  agrega esta carpeta.
- **Los nombres `NN-NOMBRE.md` se repiten entre carpetas**, así que una cita con línea a otro
  documento lleva la ruta entera: `docs/sales/00-MAPA.md:43-45`, no `00-MAPA.md` con un número.
  Dentro de la carpeta se cita por identificador, que no se corre cuando un archivo crece.
- **El documento funcional** se cita `§ N:línea`, o con su ruta completa. **El prototipo**,
  `aios-command-center_1.html`, tiene 6.689 líneas y vive en la raíz. La prueba no audita ninguno de
  los dos: el primero está fuera del repositorio, y el segundo es `.html`, una extensión que su patrón
  no reconoce.
- **Una cita a la maqueta dice qué pieza de la pantalla es, no que su valor sea un requisito.** Su
  valor es andamiaje (§ 3).

### Por qué las citas a la maqueta van a romperse, y de qué dos maneras

LP-6 borra `lib/aios/leads-portal.js`, saca el bloque `lib/aios/period-controls.js:41-61`, reescribe
`components/views/ContactsView.jsx` y le quita dos manejadores a `lib/aios/leads-group.js`. Es la
misma operación que ya rompió citas en Sales (`docs/sales/00-MAPA.md:88-99`), y deja dos clases:

- **las que fallan al resolverse, y se ven**: todas las de `lib/aios/leads-portal.js`, y las de
  `period-controls.js` y `leads-group.js` que queden más allá del nuevo final;
- **las que siguen resolviendo y muestran otra cosa**, que ninguna prueba ve: las de
  `ContactsView.jsx`, que se reescribe con una cabecera larga; las de `leads-group.js` posteriores a
  la línea 56; y las de `lib/aios/index.js`, `scripts/paridad.mjs` y
  `pruebas/codigo/90-fundaciones.test.ts`, que LP-6 también toca.

LP-7 las reapunta al prototipo o a la cabecera de la vista nueva, que va a enumerar lo borrado con la
medición que lo desmiente, con la forma de `components/views/SalesView.jsx`. Hasta entonces, cada
cita a la maqueta muestra lo que dice. Casi todos los archivos lo avisan en su cabecera; `09`, `11` y
`12` citan la maqueta sin ese aviso, y para ellos vale este párrafo.

---

## 3 · Requisito y andamiaje: la distinción que ordena la carpeta

La distinción es la de `docs/acquisition/00-MAPA.md:46-87`, con su regla práctica: si la pieza se
puede reemplazar por una consulta, es requisito; si hay que borrarla, es andamiaje; y si al borrarla
queda un hueco con forma, la forma es el requisito (`docs/acquisition/00-MAPA.md:85-87`).

- **Un requisito** es una pregunta que la pestaña tiene que poder contestar, y sobrevive al borrado
  de la maqueta. *«Cuántas personas de ICP alto entraron en los últimos 30 días, y cuántas agendaron»*
  es un requisito.
- **El andamiaje** es la forma en que la maqueta finge contestarla. «Calificado alto: 5» es
  andamiaje.

Acá la regla carga más que en ninguna otra carpeta, por tres motivos:

1. **El andamiaje son personas.** Diecisiete distintas entre el portal y el cajón —las quince del
   portal, con teléfono y correo de forma real— y el nombre de un closer real con dos ventas que no
   existen (`LP10-02`, `LP10-03`). Esta carpeta no copia ninguno de esos datos.
2. **Parte del andamiaje se deriva de otro dato, y por eso parece medido**: el relleno fabrica lo que
   el prospecto dice de sí mismo a partir de su tramo, y el dispositivo, por la paridad del puntaje
   (`LP10-04`).
3. **La forma sobrevive casi entera**: las cinco tarjetas, la rejilla con su progreso, el contador,
   la búsqueda y las siete secciones de la ficha (`LP10-08`). Lo que cambia es de dónde salen los
   valores, y cuántos estados tiene cada paso (`LP01-07`).

Lo que se borra es el andamiaje. Lo que no tiene fuente se posterga **por escrito y con su
medición**, que es lo que convierte un hueco en un hueco declarado y no en una regresión
(`docs/sales/00-MAPA.md:118-120`).

---

## 4 · Las decisiones del usuario del 2026-09-26

| tema | decisión | dónde se desarrolla |
|---|---|---|
| Universo | los contactos que ya se guardan, sin sincronización nueva | `LP08-01`, `LP09-01` |
| Tramos | ICP alto ≥ 75 · ICP medio 50-74 · ICP bajo 1-49 · «Sin calificar» = sin puntaje o 0 | `LP03-04`, `LP14-05`, `LP14-09` |
| Rótulos | «ICP alto / medio / bajo», no «Calificado…»: «no calificado» es una etiqueta de descarte del CRM (`lib/ghl/contrato.ts:236`) | `LP03-06`, `LP14-07` |
| Quién ve | quien tenga la pestaña: `tablero.ver` y la sección concedida | `LP12-01` a `LP12-04` |
| Teléfono y correo | sólo en la ficha, nunca en la lista | `LP04-06`, `LP05-16`, `LP12-05` |
| GoHighLevel | sin enlace, como en el Closer (commit `bd26085`); llamar con `tel:` y escribir con `mailto:` | `LP05-06`, `LP12-08` |
| La caída de altas desde el 14 de septiembre | es real: se pausaron las campañas | `LP06-08`, `LP08-02` |
| ICP interno | a futuro, calculado por Comando Central; sólo se documenta | `LP14-13` y `docs/futuro/icp-interno-calculado.md` |

---

## 5 · Lo que se construye, y lo que queda como hueco

La tabla completa, pieza por pieza y etapa por etapa, está en `13-EL-CONTRASTE.md`. En corto:

- **Se construye:** la cohorte por persona en las cuatro ventanas (`LP02-01`: 286 a 30 días), su
  reparto en cuatro tramos (`LP03-04`), los agendados con el predicado de todo el sistema
  (`LP02-03`), la rejilla con la búsqueda y los dos filtros (`04`), la ficha con el cuestionario, el
  estado del formulario con su corte, las interacciones sin texto y la atribución por lista blanca
  (`05`), y los avisos de cobertura: `sinAlta`, `sinPuntaje`, `enCero`, `cerosRecientes` y la
  frescura (`LP02-09`, `LP02-10`, `LP06-08`).
- **Se construye, y hoy vale cero o nulo con motivo:** asistieron (0), vendidos (0), el cierre
  (`null`, `sin_ventas_registradas`) y el monto reportado (`null`) (`LP02-04` a `LP02-08`).
- **Se dibuja como hueco declarado, con su fecha:** el VSL, fit e intent, ubicación y posición, el
  costo por lead, el dispositivo y la ciudad (`LP05-10`, `LP05-14`, `LP05-15`).
- **Se va:** el plan de acción (`LP07-07`), los rótulos «Calificado…» (`LP03-06`), el período que no
  filtra y «Personalizado» (`LP06-02`), el enlace al CRM (`LP05-06`), la puerta global que abre una
  ficha por nombre (`LP08-11`) y el cajón de contactos como destino de las tarjetas (`LP03-14`).

---

## 6 · Lo que esta carpeta le corrige al plan, y lo que les discute a otras

Escribirla midiendo obligó a precisar el plan en ocho puntos. Ninguno cambia una decisión del
usuario; todos cambian algo que una etapa tiene que hacer.

| el plan dice | lo que hay | ficha |
|---|---|---|
| «~508 literales» | no se reproduce con ningún método; con uno escrito y repetible son **570 valores** en `lib/aios/leads-portal.js`, 466 de ellos de dato; con los 70 de `POOL` del cajón, **536** valores de dato inventados | `LP10-01` |
| «292 contactos tienen cita» | es cierto, y **no es «agendó»**: cuenta citas congeladas. Con el predicado del sistema, medido en LP-2 el 2026-09-27: **200** de los 569 con alta, y **79** con sólo citas congeladas | `LP09-07`, `LP09-P01` |
| la ficha de LP-3 no nombra el video precall | es un dato real que la maqueta ya dibujaba: entra como el texto del CRM | `LP05-11`, `LP11-P02` |
| la prueba de LP-3: «un campo sin grupo no aparece» | tiene que dejar pasar a «Form Landing VSL», que no tiene grupo y viaja por nombre, y a ningún otro | `LP09-09` |
| LP-3 «exporta el helper de host» de `recorrido.ts` | hoy está atado a `atribucion_ultima ->> 'url'`: hay que parametrizar la columna y la clave, o el sistema tendría dos ideas de qué es un host | `LP05-13`, `LP08-06` |
| LP-5 pone las reglas del panel en `app/aios.css` | el precedente es que esa hoja no se toca | `LP10-P01` |
| LP-6 agrega «los 15 nombres inventados» a la vigilancia de `91-closer-y-setter` | faltan **16**, y sin ampliar el alcance de la prueba se vigilarían sólo donde nunca estuvieron | `LP10-10` |
| LP-5 y LP-6 son dos etapas | en Sales fueron un solo commit; separadas, si LP-5 reemplaza el marcado, la maqueta falla en cada carga sin que se vea | `LP13-P01` |

Hay además una cifra del plan que esta carpeta no repite. No va en la tabla porque no cambia lo que
ninguna etapa hace, y va acá para que no quede corregida en silencio: el plan dice «Hay 6
resultados», medido el 2026-09-26 (`C:\Users\USUARIO\.claude\plans\purring-enchanting-dream.md:12`),
y la medición del 2026-09-27 da **7** —seguimiento 4, no_show 2, no_interesa 1—, con ninguna venta
en las dos (`LP09-07`). Con un día entre una medición y otra, esta carpeta no puede decir si es un
resultado nuevo o una cuenta distinta; cita la suya, con su fecha.

Y cuatro puntos en los que esta carpeta se aparta de otra o la corrige, dichos en el archivo donde lo
hace:

| de dónde | qué decía | lo que dice esta carpeta | ficha |
|---|---|---|---|
| `S12-04`, en `docs/sales/` | que un closer no tiene `tablero.ver` | con los tres roles de hoy, `usuario` lo trae: lo que deja afuera a un closer es la concesión de la sección | `LP12-02` |
| `A6-21`, en `docs/acquisition/` | que el par de derivaciones entre Acquisition y Leads Portal era un contrato | es una referencia circular: cada plan le mandaba la pregunta al otro, y ninguno la contestaba | `LP07-05` |
| `A8-29`, en `docs/acquisition/` | que el creativo no existe | no existe la pieza; el nombre que llega en `utmContent` sí, y es lo que la ficha rotula «Creative» | `LP05-14` |
| ocho documentos de otras carpetas | once citas al bloque del plan de acción | apuntan a una línea que no es; la tabla dice dónde está hoy cada una | `LP07-10` |

---

## 7 · Las preguntas abiertas de toda la carpeta

Viven en el archivo donde nacen. El índice las ordena por **la etapa que no debería empezar sin la
respuesta**; ese orden es una propuesta de este mapa, no del plan.

| antes de | id | pregunta |
|---|---|---|
| **LP-2** | `LP02-P03` = `LP04-P03` | ¿Se marca aparte a quien sólo tiene citas canceladas? Cambia la forma de la fila |
| | `LP06-P01` | ¿La porción del total lleva piso? |
| | `LP03-P02` | ¿«Sin ventas registradas» se evalúa en la empresa o en la ventana? Hoy dan lo mismo |
| | `LP02-P01` = `LP14-P04` | ¿Se publica la tasa de agenda por tramo? Es lo único que hoy diría si el corte separa algo |
| **LP-3** | `LP09-P02`, `LP09-P03`, `LP09-P05` | Tres mediciones que faltan: el cuestionario sin el puntaje, el reparto de «Llegó por», y el teléfono, el correo, la zona horaria y el último toque |
| | `LP05-P01` | ¿Entran los otros tres campos del grupo `interacciones`? |
| | `LP05-P02` = `LP09-P04` | ¿Entran `medium`, `campaignId`, `adSource` y el objetivo del anuncio a la lista blanca? |
| | `LP05-P03` | ¿La ficha muestra las etiquetas crudas del CRM? |
| | `LP11-P01` | ¿El último toque va como renglón propio? |
| | `LP11-P02` | ¿Se confirma el precall en la ficha? |
| **LP-4** | `LP09-P01` | ¿Cuántas personas tienen una cita alcanzable? **Medida en LP-2**: 200 en «Completo», 142 a 30 días |
| | `LP12-P01` | ¿Alguno de los tres que ven la pestaña es un closer vinculado? Se mide y se le muestra al usuario |
| | `LP12-P02` | ¿Se vigila que ningún rol tenga `tablero.ver` sin `contactos.ver`? |
| **LP-5** | `LP13-P01` | ¿LP-5 y LP-6 van en el mismo commit? |
| | `LP03-P01` | ¿«Cierre» o «Venta por contacto»? |
| | `LP03-P03` | ¿La tarjeta dice cuántos de su tramo están descartados? |
| | `LP04-P01` | ¿La lista se ordena por alta o por puntaje? |
| | `LP04-P02` | ¿Hace falta un filtro para ocultar a los descartados? |
| | `LP06-P02` | ¿Qué dibuja la pestaña cuando «30 días» se vacíe? Pasa desde mediados de octubre si la pauta no vuelve |
| | `LP10-P01` | ¿Las reglas del panel nuevo van en `app/aios.css`? |
| **LP-6** | `LP07-P01` | ¿Qué se hace con `#recoModal` cuando nadie lo abre? |
| | `LP08-P01` | ¿El pie del cajón de Executive sigue llevando a Leads Portal? |
| | `LP10-P02` | ¿Las catorce personas del cajón se quedan hasta que Executive se reconstruya? |
| **ninguna etapa** | `LP01-P01` | ¿Algún resultado es un «no» de venta? |
| | `LP02-P02` | ¿Qué definición de «agendó» es la del producto? |
| | `LP07-P02` | ¿Leads Portal tiene plan de acción? |
| | `LP08-P02` | ¿El portal acepta un filtro de entrada desde otra pantalla? |
| | `LP08-P03` | ¿Quién publica «qué campañas traen ICP alto»? |
| | `LP11-P03` | ¿Quién construye el historial de la reproducción? |
| | `LP14-P01` | ¿Qué produce un 0 en el CRM? |
| | `LP14-P02` | ¿Sigue en pie el techo de 59 del rechazo? |
| | `LP14-P03` | ¿Creative adopta la regla del cero? |

Son 37 identificadores en 32 filas: cada uno de los tres pares que se repiten entre dos archivos va
en una sola fila, y las tres mediciones de `09` que faltan antes de LP-3, en otra.
