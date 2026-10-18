# Analizadores (HT y OB)
> Corte: **2026-10-18**, con el código de producción, `972972e` (migraciones hasta la `078`). Las cifras de producción
> son de dos fechas y cada una lo dice: las del **2026-10-18**, re-medidas para esta foto entre las 15:41 y las 15:50
> UTC con `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados, con el OK del usuario); y las del
> **2026-09-28**, de la foto anterior, que se conservan para comparar. La pantalla no se miró en el navegador para esta
> foto: lo que dibuja está deducido del código. En local hay ocho commits más, `693a383..dc84cb2`, del modelo de datos
> multiempresa (Fase 0, migraciones `079` a `084`): construidos y **sin subir**, esperando la aprobación de un
> ingeniero; no tocan el código de la sección, y las siete tablas suyas quedan entre las que reciben un `cuenta_id`
> nulable, «de una cuenta o de la organización» (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:128-132`;
> [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 11). Cada afirmación lleva su `archivo:línea` o
> la consulta que la produjo. Lo que no se pudo verificar está dicho como pendiente, no omitido. Para ubicar cualquier
> cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del
> 2026-09-28, con sus anexos— se lee con `git show 972972e:"docs/OTROS/estado actual/14-ANALIZADORES.md"`.

> **Desde el corte del 2026-09-28** (horas de Lima, las del commit)
>
> - **2026-10-01 a 2026-10-02 · `b532a78`, `40f699a`, `624a941`, `096751d`** — la nueva estructura: la sección se
>   abre como Sales › **Llamadas de venta** y Client Success › **Llamadas de onboarding**, y la pantalla perdió su
>   barra HT/OB: la pestaña la elige la navegación (§ 2).
> - **2026-10-04 · `cd851b3`** — AG2 de los agentes: cada llamada al modelo de la clasificación, el análisis y la
>   ficha deja su fila en `negocio.uso_de_ia` (`069`, en producción desde el 2026-10-04) y cada fallo su incidente;
>   un JSON ilegible ya no guarda el comienzo de la respuesta en el error (§ 5 y § 7).
> - **2026-10-05 · `13723a0`** — AG6: la caja del cerebro en el pie de la sección, `app/api/analizadores/cerebro/`, la
>   octava ruta (§ 2).
> - **2026-10-05 · `3170786`** — AG11: la tarea de cada hora suma un cuarto paso, la **categoría de cada objeción**
>   (Haiku, `negocio.objeciones_clasificadas`, migración `073`, en producción desde el 2026-10-06), y las llamadas se
>   leen fuera de la pestaña por primera vez: el cerebro, y después la Reunión, el Brief y Sales (§ 4 y § 6).
> - **2026-10-06 · `fe727e5`** — AG15: el comentario de la cabecera llega con la lista y dice si la tarea nunca corrió,
>   falló o está atrasada (§ 2 y § 7).
> - **2026-10-07 · `5b8b236`** — la evaluación real de la categoría: 20 de 20 objeciones sintéticas, en 4 llamadas a
>   Haiku (`docs/OTROS/agentes/07-LA-EVALUACION.md:333-342`).
> - **2026-10-09 · `ee57d33`, `904968a`** — SA-7 y SA-8: la pantalla de Sales cuenta sus motivos de no venta con las
>   llamadas HT sin cierre y sus objeciones clasificadas (§ 4).
> - **2026-10-12** — la limpieza de Supabase pasó las tablas de ARIA Brain de `public` a un esquema de respaldo; con
>   ellas, `scripts/comparar-con-brain.sql` se quedó sin tabla (§ 5). Las tablas `public.ht_*` y `public.ob_*` que se
>   borraron ese día eran de otra aplicación retirada, no de esta sección: las `negocio.analizador_*` siguen intactas.
> - **2026-10-18** — esta foto: las cifras re-medidas.

**Construido y funcionando desde el 2026-09-23, en una sola empresa y con poco volumen; desde el 2026-10-05 ya no es
una isla.**

Es la única parte del producto que juzga una llamada de venta real: la sección `analizadores` —en la barra, Sales ›
Llamadas de venta y Client Success › Llamadas de onboarding— descubre cada hora las reuniones de tl;dv, las clasifica
en HT, OB u OTRO, las analiza con Sonnet, deja una ficha del prospecto en cada HT y, desde el 2026-10-05, le pone una
categoría a cada objeción. Medido el 2026-10-18, en la organización `aria`: **135 reuniones** —107 copiadas una vez
de ARIA Brain y 28 que Comando Central descubrió por su cuenta—, **54 analizadas** (41 HT y 13 OB), 54 que el propio
análisis vetó, 27 OTRO y **ninguna fallida ni pendiente**. La OB que había fallado el 2026-09-28 la rescató el reintento
de las 5 a la mañana siguiente. La última reunión descubierta es del **2026-10-12**: en los seis días siguientes la
tarea corrió cada hora sin traer ninguna, y si hubo reuniones en tl;dv no se verificó (§ 4). Las **89 objeciones** de
las HT analizadas tienen su categoría, y el precio y la confianza suman 60. Lo que sigue mal: **ninguna de las 41 HT
dice `CERRADA`**; **el motivo del sello no lo dibuja ninguna pantalla**, así que una llave de tl;dv rota sigue
viéndose sólo con SQL; y **la caché que se paga en cada análisis no se relee nunca**: 0 tokens leídos en los 21
análisis propios.

---

## 1 · Qué pide el documento

Analizadores no es uno de los departamentos de Inteligencia de [00-MAPA.md](00-MAPA.md), sino una sección de
Operación que desde la nueva estructura se abre desde dos departamentos. El documento funcional no está en el
repositorio, así que **no se verificó** si le dedica un capítulo; lo que se pidió está escrito en dos documentos del
repo, que no cambiaron desde la foto anterior.

**`docs/OTROS/analizadores/ANALIZADORES.md`** (343 líneas; contrastado contra código y producción el 2026-09-22).
Qué es (`docs/OTROS/analizadores/ANALIZADORES.md:9-20`): dos compuertas —un clasificador barato (Haiku) que decide HT,
OB u OTRO mirando los primeros 6 000 caracteres, y el análisis (Sonnet) que puede **vetar** con `{"match": false}` si
con la transcripción entera no era lo que se creyó—; de ahí salen dos informes, el HT (el closer en cinco fases, más
la ficha del prospecto aparte) y el OB (el perfil de arranque del cliente). Nueve decisiones
(`docs/OTROS/analizadores/ANALIZADORES.md:22-34`): tablas propias `negocio.analizador_*` por `org_id`; el historial
se copia **una vez** a `aria`; ARIA Brain sigue corriendo y el doble trabajo se acepta; todas las empresas, cada una
con sus llaves; una sola casilla de permisos; `analizadores.ver` para mirar y `analizadores.editar` para gastar, las
dos a los tres roles; la llave de Anthropic es la de la empresa; se guardan los tokens y el costo espera la tarifa
confirmada; y las OTRO se guardan sin mostrar su texto. Tres decisiones por defecto
(`docs/OTROS/analizadores/ANALIZADORES.md:36-50`): OB se clasifica desde el primer día y `TIPOS_QUE_SE_ANALIZAN` es
el interruptor; el núcleo portado sigue en inglés porque es el contrato con el modelo; la llave de tl;dv va en
Ajustes › Credenciales. Las etapas (`docs/OTROS/analizadores/ANALIZADORES.md:100-121`): HT-0 a HT-9 y OB-1 a OB-3
hechas el 2026-09-23; **HT-10 y OB-4 siguen «en curso»**. Y el reintento de las 5, pedido el mismo día
(`docs/OTROS/analizadores/ANALIZADORES.md:323-342`).

**`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md`** (117 líneas): **pendiente**, se construye cuando
esté el mapa completo de nombres de reunión → tipo (`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:3`).
El tipo saldría del título antes de pedir la transcripción y antes del clasificador
(`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:59-72`), se validaría contra el historial sin gastar
(`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:80-92`), y quedan cuatro decisiones abiertas; la primera
es el mapa mismo, que «lo tiene el equipo» (`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:94-103`).

**Lo que agregaron los agentes de IA.** La ficha F14 del plan de los agentes pide contar las objeciones por categoría
y vincular cada llamada con su contacto (`docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`); está construido y
es lo que sacó a la sección de su isla (§ 4 y § 6).

**Y lo que Sales esperaba.** La foto de Sales del 2026-09-16 registró que el documento funcional da por existente la
«Auditoría de llamadas de venta» y que `negocio.llamadas` tenía 0 filas ([05-SALES.md](05-SALES.md)). Analizadores
HT hace esa auditoría, portada de Brain y no construida sobre `negocio.llamadas`, que el 2026-10-18 sigue en **0
filas**; `negocio.resultados` sigue en 7.

---

## 2 · Qué hay hoy en pantalla

La sección se declara en `lib/autorizacion/secciones.ts:376-381` —clave `analizadores`, capacidad
`analizadores.ver`— con su porqué en `lib/autorizacion/secciones.ts:365-375`: debajo de Closer porque «es el mismo
trabajo mirado después», una sola casilla aunque adentro haya dos pestañas, y su propia capacidad porque con
`closer.ver` «cualquier closer leería las transcripciones de todo el equipo». La monta
`components/views/AnalizadoresView.jsx:16-34` («Cada llamada de tl;dv, juzgada») y el cuerpo es
`components/analizadores/PanelDeAnalizadores.jsx` (530 líneas; 511 en la foto anterior), con `DetalleHt.jsx` (408) y
`DetalleOb.jsx` (333) en la misma carpeta.

**Desde la nueva estructura (2026-10-02)** la barra lateral no tiene grupos: las dos pestañas se abren como Sales ›
**Llamadas de venta** y Client Success › **Llamadas de onboarding** (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`,
`NE-47`). La pantalla no dibuja barra propia: `PESTANAS` ya no lleva nombres
(`components/analizadores/PanelDeAnalizadores.jsx:49`), atiende la pestaña que pide la navegación
(`components/analizadores/PanelDeAnalizadores.jsx:122`) y anuncia la que dibuja —con un informe abierto, la del
informe— para que la barra marque la entrada correcta (`components/analizadores/PanelDeAnalizadores.jsx:138`). La
sección, sus claves `HT` y `OB` y su permiso no cambiaron.

── **LA LISTA** ──

Dos pestañas y tres filtros, Analizadas · Pendientes · Descartadas
(`components/analizadores/PanelDeAnalizadores.jsx:51-55`). Cada filtro es una lista cerrada de estados
(`lib/analizadores/datos.ts:524-528`: DONE; PENDING, ANALYZING y FAILED; NOT_MATCH), y **las Descartadas de una
pestaña son sus vetadas más todas las OTRO**, porque una OTRO no es de ninguna y se reencamina desde cualquiera
(`lib/analizadores/datos.ts:553-555`). Dos botones arriba: «Sincronizar con tl;dv», deshabilitado sin la llave de
tl;dv, y «Analizar transcripción», que abre el formulario de la transcripción pegada a mano
(`components/analizadores/PanelDeAnalizadores.jsx:301-312`). Cada fila dice título, fecha, motivo del descarte o
error del fallo, puntaje y estado, y ofrece Ver, Analizar o Reintentar, Mover a la otra pestaña o a «No es HT ni
OB», y Borrar (`components/analizadores/PanelDeAnalizadores.jsx:379-430`). Sincronizar descubre y después analiza
**de a una petición** sólo las PENDING; las FAILED no, porque reintentarlas es una decisión de quien leyó el error
(`components/analizadores/PanelDeAnalizadores.jsx:226-252`).

── **EL COMENTARIO DE LA CABECERA** (AG15, desde el 2026-10-06) ──

La lista viaja con una línea para la cabecera del departamento (`app/api/analizadores/llamadas/route.ts:34-41`;
`components/analizadores/PanelDeAnalizadores.jsx:99`). Sale de `comentarioDeLasLlamadas`
(`lib/agentes/cabecera.ts:178-184`): primero, si la tarea de cada hora **nunca corrió, falló o está atrasada**
(`lib/agentes/cabecera.ts:74-79`), y si no, una regla de la Reunión de hoy de esa sección; sin nada que decir, calla.
Es la primera vez que la pantalla dice algo de la frescura de su tarea. No dice lo que va en el motivo del sello
(§ 7).

── **LOS DOS DETALLES** ──

HT tiene dos vistas, Closer y Prospecto (`components/analizadores/DetalleHt.jsx:117-118`); las cinco fases se rotulan
por su campo cuando vienen distintas, por posición cuando son cinco iguales (el defecto v8 del historial), «Fase N»
si no hay forma de saberlo y una nota si no hay ninguna (`lib/analizadores/fases.ts:41-57`). OB tiene una sola vista
y ninguna ficha (`components/analizadores/DetalleOb.jsx:5-8`). Una vetada dice qué NO es: «No es HT», «No es OB» o
«No es HT ni OB» (`lib/analizadores/rotulos.ts:17-23`). La categoría de las objeciones **no se dibuja en el detalle**:
la leen el cerebro, la Reunión, el Brief y Sales (§ 4).

── **LO QUE LA PANTALLA NO TIENE** ──

Su propio encabezado la declara «lo MÍNIMO que hace funcionar el flujo»
(`components/analizadores/PanelDeAnalizadores.jsx:6-7`). Fuera del número entre paréntesis de cada filtro
(`components/analizadores/PanelDeAnalizadores.jsx:361`), no hay un solo agregado en la pestaña: ni puntaje medio, ni
llamadas por closer, ni objeciones por categoría. Esos agregados existen desde AG11, pero se los pide al cerebro, no
a esta pantalla (`lib/negocio/llamadasDeVenta.ts:1-5`). No hay costo (decisión 8). No hay forma de reanalizar una
DONE desde la pantalla —sólo la API lo acepta, y el 2026-09-25 se decidió dejar así la HT de análisis vacío
(`docs/OTROS/analizadores/ANALIZADORES.md:205-209`)—. No hay transcripción: ninguna respuesta la devuelve
(`app/api/analizadores/llamadas/[id]/route.ts:31-32`).

── **LAS OCHO RUTAS** ──

Leer pide `analizadores.ver`: el estado de las llaves (`app/api/analizadores/estado/route.ts:21`), la lista
(`app/api/analizadores/llamadas/route.ts:22`) y el detalle (`app/api/analizadores/llamadas/[id]/route.ts:24`). Todo
lo que cambia o gasta pide `analizadores.editar`: reencaminar y borrar (`app/api/analizadores/llamadas/[id]/route.ts:48`
y `app/api/analizadores/llamadas/[id]/route.ts:86`), analizar (`app/api/analizadores/llamadas/[id]/analizar/route.ts:42`),
la ficha (`app/api/analizadores/llamadas/[id]/ficha/route.ts:33`), la manual (`app/api/analizadores/manual/route.ts:45`)
y sincronizar (`app/api/analizadores/sincronizar/route.ts:27`). Las cuatro que llaman al modelo declaran
`maxDuration = 300` y trabajan con un reloj de 280 s (`lib/analizadores/rutas.ts:19`). La octava, desde AG6, es la
caja del cerebro: el `GET` pide `analizadores.ver` y preguntar o borrar un hilo pide `cerebro.usar`
(`app/api/analizadores/cerebro/route.ts:42`, `app/api/analizadores/cerebro/route.ts:54` y
`app/api/analizadores/cerebro/route.ts:67`).

── **QUIÉN LA VE**, medido el 2026-10-18 ──

Igual que el 2026-09-28. Los tres roles tienen las dos capacidades, y los **15 usuarios activos** las tienen por su
rol. Pero 4 de los 15 están en `usuario`, el rol con secciones restringidas, e `identidad.usuarios_secciones` sigue
con **0 filas** de `analizadores`: ninguno de esos 4 la ve. Quedan **11 que ven la pestaña: 2 en `aria`**, la única
empresa con llamadas, **y 9 en otras empresas**, donde se abre vacía y con Sincronizar deshabilitado porque su
empresa no tiene llave de tl;dv. La declaración no tiene ninguna bandera que la oculte sin la llave
(`lib/autorizacion/secciones.ts:376-381`).

---

## 3 · Lo que está hardcodeado

**Ningún dato inventado.** Un `grep` de números literales en el texto de los tres componentes de
`components/analizadores/` no devuelve ninguna cifra: sólo la escala del puntaje del detalle HT, los dos `/10` y el
rótulo «Para llegar a 10» (`components/analizadores/DetalleHt.jsx:190`, `components/analizadores/DetalleHt.jsx:209`
y `components/analizadores/DetalleHt.jsx:214`), y el `[00:05]` de ejemplo del formulario manual
(`components/analizadores/PanelDeAnalizadores.jsx:517`). Todo lo demás sale de las siete tablas y del estado de las
llaves. Lo que está escrito a mano son decisiones de operación:

| Qué | Valor | Dónde |
|---|---|---|
| Tipos que se mandan a Sonnet (el interruptor) | HT y OB | `lib/analizadores/pipeline.ts:73` |
| Tope de reuniones nuevas por corrida | 40 | `lib/analizadores/pipeline.ts:76` |
| Ventana del descubrimiento | 48 h | `lib/analizadores/pipeline.ts:83` |
| Página de tl;dv (no se pide una segunda) | 50 | `lib/analizadores/nucleo/tldv.ts:138` |
| Margen final | 15 s | `lib/analizadores/pipeline.ts:86` |
| Mínimo que tiene que quedar para arrancar un análisis | 150 s | `lib/analizadores/pipeline.ts:92` |
| Esperas del análisis y del clasificador | 270 y 60 s | `lib/analizadores/nucleo/anthropic.ts:43-44` |
| Espera de tl;dv | 30 s | `lib/analizadores/nucleo/tldv.ts:26` |
| Modelo del análisis y de la ficha | `claude-sonnet-5` | `lib/analizadores/nucleo/anthropic.ts:34` |
| Modelo del clasificador | `claude-haiku-4-5` | `lib/analizadores/nucleo/anthropic.ts:37` |
| Modelo de la categoría de las objeciones | `claude-haiku-4-5-20251001` | `lib/agentes/modelos.ts:53` |
| Techo de tokens: análisis y clasificador | 20 000 y 400 | `lib/analizadores/nucleo/anthropic.ts:47-48` |
| Lo que lee el clasificador | 6 000 caracteres | `lib/analizadores/nucleo/engine.ts:50` |
| Las seis categorías de una objeción | precio, momento, decisor, confianza, encaje, otra | `lib/analizadores/categorias.ts:6` |
| Espera de una clasificación de objeciones | 30 s | `lib/analizadores/objeciones.ts:37` |
| Llamadas con objeciones que se miran por corrida | 10 | `lib/analizadores/objeciones.ts:173` |
| Fin de la tarea dentro de la función | 285 s | `lib/negocio/barrido.ts:380` |
| Pendientes pedidas por corrida | 10 | `lib/analizadores/tarea.ts:42` |
| Reintentos automáticos por llamada | 3 | `lib/analizadores/tarea.ts:207` |
| Minutos en ANALYZING para darla por colgada | 15 | `lib/analizadores/datos.ts:58` |
| Minutos antes de que la tarea genere una ficha | 10 | `lib/analizadores/datos.ts:893` |
| Tarifas confirmadas | ninguna | `lib/analizadores/nucleo/pricing.ts:42` |
| Versión de la rúbrica HT | `rubric.es.md@v8.1` | `lib/analizadores/nucleo/ht.ts:505` |
| Versión de la rúbrica OB | `rubric.es.md@OB` | `lib/analizadores/nucleo/ob.ts:328` |
| Versión de la ficha | `ficha.es@v1` | `lib/analizadores/nucleo/prospect-card.ts:780` |
| Horas alrededor de la reunión para vincularla por una cita | ±12 | `lib/negocio/vinculoDeLlamadas.ts:21` |

El juego de categorías está **escrito dos veces**, a propósito y con prueba: en el código
(`lib/analizadores/categorias.ts:6`) y en el `check` de la tabla (`db/migraciones/073_las_objeciones_clasificadas.sql:32`).
Los 15 minutos de la colgada siguen escritos dos veces sin prueba que los ate: vuelven a aparecer en
`components/analizadores/PanelDeAnalizadores.jsx:60-61`, con el comentario «La base usa el mismo» (un `grep` de
`MINUTOS_PARA_DARLA_POR_COLGADA` en `pruebas/` no devuelve nada), a diferencia de los 285 s, que sí están atados a
`maxDuration` (`pruebas/base/173-tarea-del-analizador.test.ts:243`).

---

## 4 · Datos que YA tenemos

Todo medido el 2026-10-18 entre las 15:41 y las 15:50 UTC, salvo lo que dice otra fecha. Una sola empresa tiene
datos: las 135 llamadas son de `aria`, y es la única de las 13 empresas (11 activas) con llave de tl;dv.
«Copiada» y «propia» se separan como en `scripts/medir-analizadores.sql:13-16`: `creado_el` anterior o posterior al
2026-09-23 (la copia conserva sus fechas de Brain).

**Las llamadas, por tipo y estado** (`negocio.analizador_llamadas`, 135 filas; eran 115 el 2026-09-28):

| | HT | OB | OTRO | Total |
|---|---|---|---|---|
| Copiadas de Brain | 37 DONE (una pegada a mano) · 7 vetadas | 8 DONE · 36 vetadas | 19 | 107 |
| Descubiertas por Comando Central | 4 DONE · 5 vetadas | 5 DONE · 6 vetadas | 8 | 28 |
| **Total** | **53** | **55** | **27** | **135** |

Ninguna PENDING, ANALYZING ni FAILED. Como las cuenta la pantalla (`lib/analizadores/datos.ts:605-621`): **HT 41
analizadas · 0 pendientes · 39 descartadas; OB 13 analizadas · 0 pendientes · 69 descartadas.** El 2026-09-28 eran
HT 38, 0 y 29, y OB 10, 1 y 57. Las otras tablas: 65 análisis (44 copiados + 21 propios), 41 fichas (39 OK y las 2
copiadas que siguen FAILED desde el 2026-09-08 y el 2026-09-10), 55 prospectos, 135 transcripciones y 13 lápidas
(ninguna reunión se borró desde el 2026-09-23). Las vetadas copiadas no tienen fila de análisis: Brain no guardaba lo
que costaba un veto (`db/migraciones/056_tablas_del_analizador.sql:24`).

**Lo que Comando Central descubrió desde la foto anterior: 20 reuniones**, por día de creación (UTC): 1 el
2026-09-29, 2 el 30, 1 el 2026-10-01, 3 el 2, 4 el 6, 1 el 7, 4 el 8, 3 el 9 y 1 el 12. Ninguna del 3 al 5 ni del 13
al 18. La última se creó el **2026-10-12 a las 18:41** y el último análisis tomado es del **2026-10-09 a las 21:41**:
la del 12 no fue tomada, así que es una OTRO (deducido: no queda ninguna PENDING). Que la tarea siguió corriendo lo dice su sello (abajo); **si hubo reuniones en tl;dv después
del 12 no se verificó**: exige llamar a tl;dv.

**La única fallida del 2026-09-28**, la OB descubierta a las 17:41 UTC, quedó DONE: una llamada fue tomada el
**2026-09-29 entre las 10:00 y las 10:20 UTC**, la ventana del reintento de las 5 (`count(*)` por `tomada_el`).
**0 llamadas tienen `reintentos_automaticos` > 0**: el contador sube sólo cuando un reintento vuelve a fallar
(`lib/analizadores/tarea.ts:279-283`).

**El uso de la IA, desde que se registra** (`negocio.uso_de_ia`, 208 filas en total; las de esta sección):

| `agente` | llamadas | desde · hasta | resultado | caché leída |
|---|---|---|---|---|
| `analizador_clasificar` | 13 | 2026-10-06 · 2026-10-12 | 13 `ok` | 0 |
| `analizador_analizar` | 9 | 2026-10-06 · 2026-10-09 | 9 `ok` | **0** (61 376 escritos) |
| `analizador_ficha` | 2 | 2026-10-08 | 2 `ok` | **0** (27 164 escritos) |
| `objeciones` | 40 | 2026-10-06 · 2026-10-08 | 40 `ok` | 0 |

La `069` y la `070` se aplicaron el 2026-10-04 a las 23:21 UTC (`migraciones.migraciones_aplicadas`), y la primera
fila de los Analizadores es del 2026-10-06: entre las dos no hubo trabajo. Ninguna fila con un resultado `IA-*`.

**Los análisis propios: 21 filas**, 10 completas y 11 vetos, con **0 tokens de lectura de caché en las 21**. La
caché escrita por los 7 del corte anterior era de 9 774 tokens por HT y 4 456 por OB; el contador de lectura sigue en
cero. `costo_usd` es nulo en los 65 análisis, como manda la tarifa sin confirmar
(`lib/analizadores/nucleo/pricing.ts:42`). En los 44 análisis copiados los dos contadores de caché son nulos, porque
Brain no los guardaba (`docs/OTROS/analizadores/ANALIZADORES.md:76-78`). El análisis más largo sigue siendo de 48 s,
cinco veces dentro de la espera de 270 s; la observación de HT-10 y OB-4 quería semanas de datos antes de tocar las
esperas (`docs/OTROS/analizadores/ANALIZADORES.md:302-303`), y hay 10 completos propios.

**La tarea de cada hora**, `'41 * * * *'` en `vercel.json` y en `lib/negocio/barrido.ts:275-279`: en `aria` el
último sello es `corrio`, 2026-10-18 15:41 UTC, sin motivo y con **2 llamadas a proveedores**; la cuenta es la de
`lib/analizadores/tarea.ts:188-197`, que desde AG11 suma también las pedidas de objeciones. En las otras 10 empresas
activas, `saltada` por falta de la llave de tl;dv. **Que haya corrido cada hora no está verificado**: el sello guarda
sólo la última corrida (`lib/negocio/barrido.ts:1050-1076`).

**El reintento de las 5**, `'7 10 * * *'` (`lib/negocio/barrido.ts:303-307`): último sello en `aria`, `corrio`
2026-10-18 10:07 UTC con 0 llamadas; en las otras 10, `saltada`.

**Lo que dicen los informes** (agregados, sin texto): las 41 HT puntúan 1 (una), 3 (4), 4 (13), 5 (10), 6 (9) y 7
(4); **ninguna pasa de 7** y ninguna dice `CERRADA`: 38 `NO_CERRADA` y 3 `INDETERMINADO`. El 1 es la HT de análisis
vacío que vino de Brain (`docs/OTROS/analizadores/ANALIZADORES.md:205-207`). Las 13 OB: 11 `PARCIAL`, 1 `LISTO` y 1
`BLOQUEADO`, la primera que dice que un arranque está bloqueado.

**Las objeciones** (`negocio.objeciones_clasificadas`, `073`): **89 filas, una por cada objeción con texto de las 41
HT analizadas, en 40 llamadas** —la que falta no tiene objeciones—: cobertura de 89 de 89. Por categoría: precio
**31**, confianza **29**, encaje 18, decisor 6, momento 3 y otra 2. Todas se clasificaron entre el 2026-10-06 y el
2026-10-08, con las 40 llamadas a Haiku de la tabla de arriba: la tarea clasificó el historial en sus primeras
corridas y, desde entonces, cada HT nueva.

**El cruce, que ya se hace.** 52 de los 55 prospectos tienen correo, y **35 de esos 52 son un contacto de
`negocio.contactos`** de la misma empresa (mismo correo en minúsculas). **25 de las 41 HT analizadas** casan por
correo; otras 13 no tienen prospecto. Desde AG11, `vinculosDe` cruza al leer: primero por correo y, si no, por la
**única** cita que empiece a ±12 horas de la reunión (`lib/negocio/vinculoDeLlamadas.ts:1-14`). Cuántas casan por
cita no se midió: el vínculo no se guarda, se calcula al leer.

**Quién lee estos datos fuera de la pestaña**, desde el 2026-10-05 (la foto anterior decía que nadie):

- el **cerebro**, con dos herramientas, una de venta y una de onboarding
  (`lib/agentes/executive/adaptadores/analizadores.ts:29` y `lib/agentes/executive/adaptadores/analizadores.ts:47`),
  sobre `llamadasDeVenta` y `llamadasDeOnboarding`: objeciones por categoría con su cobertura, puntaje por closer con
  piso de 10 y frases citables sólo para quien tiene `analizadores.ver` (`lib/negocio/llamadasDeVenta.ts:7-20`);
- la **Reunión** de cada mañana (`lib/agentes/reunion/temas.ts:104-105`);
- el **Brief** del closer, que trae la ficha de la última llamada vinculada al contacto y las objeciones frecuentes
  (`lib/agentes/brief/entrada.ts:145`, `lib/agentes/brief/entrada.ts:168-169`); en producción
  `negocio.briefs_del_closer` tiene **0 filas** el 2026-10-18;
- y la **pantalla de Sales**, cuyos motivos de no venta son las llamadas HT sin cierre con una objeción de cada
  categoría (`lib/negocio/motivosDeLasLlamadas.ts:1-24`, leído en `lib/negocio/lecturaDeSales.ts:261`).

**Brain sigue parado**, y desde el 2026-10-12 su tabla no está en `public`: la limpieza la pasó al esquema
`respaldo_aria_brain`, donde `analyzer_calls` tiene **108 filas**, la última creada el 2026-09-19 a las 10:00 UTC y
modificada a las 10:02. Es lo mismo que se midió el 2026-09-23 (`docs/OTROS/analizadores/ANALIZADORES.md:305-315`).

**Las migraciones** de la sección son la `056` a la `062` (todas del 2026-09-22 y el 2026-09-23) y la **`073`**,
aplicada el **2026-10-06 a las 01:59 UTC** (`migraciones.migraciones_aplicadas`). Las pruebas propias: las del 170 al
174 de `pruebas/codigo/` y `pruebas/base/`, más `pruebas/codigo/201-el-error-del-analisis.test.ts`,
`pruebas/codigo/229-las-objeciones-y-el-vinculo.test.ts`, `pruebas/base/230-la-categoria-de-las-objeciones.test.ts`
y `pruebas/base/231-las-llamadas-sobre-la-base-sembrada.test.ts`; **no corridas para esta foto**.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · El costo.** Nulo en los 65 análisis y en las 39 fichas OK, a propósito: la única tarifa de Sonnet 5 que había
era un comentario del código de Brain, nunca verificado contra la facturación
(`docs/OTROS/analizadores/ANALIZADORES.md:68-78`). Tiene que venir de la factura de Anthropic y cargarse en
`CONFIRMED_RATES`. **Lo que sí se cerró (AG2, 2026-10-04)**: cada llamada al modelo —clasificación, análisis y ficha,
salga bien o mal— deja su fila en `negocio.uso_de_ia` con sus cuatro contadores (`anotarLaLlamada`,
`lib/analizadores/pipeline.ts:128-165`), y la clasificación cuenta lo que costó también cuando devuelve nulo
(`lib/analizadores/nucleo/engine.ts:225-246`). Una FAILED sigue sin tokens en su propia fila —`terminarConFallo`
escribe sólo el estado y el error (`lib/analizadores/datos.ts:336-344`)—, pero su llamada está en `uso_de_ia`. Y el
historial no se puede recalcular entero: a los 44 análisis copiados les faltan los dos contadores de caché (§ 4).

**2 · La historia de las corridas.** `negocio.tareas_programadas` guarda la última de cada (empresa, tarea)
(`lib/negocio/barrido.ts:1050-1076`), así que no hay forma de contar cuántas corridas hubo, ni cuántas fallaron, ni
cuántas quedaron cortas. Hoy se reconstruye a mano con `creado_el` y `tomada_el`, como el silencio del 13 al 18 (§ 4).

**3 · El mapa de nombres de reunión → tipo.** Lo tiene el equipo y es la condición para construir la clasificación
por nombre (`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:94-103`). Sin él, las 12 ventas que el
clasificador mandó a OB siguen en Descartadas de la pestaña OB (`docs/OTROS/analizadores/ANALIZADORES.md:255-263`);
medido hoy, las 36 OB copiadas vetadas siguen vetadas.

**4 · El vínculo con el CRM, guardado.** `negocio.analizador_prospectos` sigue sin `contacto_id`
(`db/migraciones/056_tablas_del_analizador.sql:34-44`): desde AG11 el vínculo se calcula en cada lectura, por correo
o por una cita única (`lib/negocio/vinculoDeLlamadas.ts:1-14`), y no hay una cifra guardada de cuántas llamadas casan.
El modelo de datos multiempresa deja la fusión de las `analizador_*` para su Fase 5
(`docs/modelo de datos/20-PLAN-DE-SUBIDA-FASE-0.md`, carpeta local fuera de git). Fuera de `lib/analizadores/` y de
los lectores del § 4, las tablas sólo se nombran en el esquema (`lib/datos/esquema.ts`) y en el borrado de una
empresa (`lib/administracion/borrado.ts:170-175`, y la de las objeciones en `lib/administracion/borrado.ts:200`).

**5 · La comparación con Brain.** `scripts/comparar-con-brain.sql` lee `public.aria_brain_analyzer_calls`
(`scripts/comparar-con-brain.sql:26-27`), que desde el 2026-10-12 ya no existe: hoy falla con «relation does not
exist», como su propio encabezado anunciaba para el día en que Brain se borrara (`scripts/comparar-con-brain.sql:10-12`).
Deducido de la medición (`to_regclass` nulo), no corrido. Decidido el 2026-09-23: no se reanaliza nada para comparar
(`docs/OTROS/analizadores/ANALIZADORES.md:313-315`).

**6 · Qué quiere decir `PARCIAL`.** 11 de las 13 OB lo dicen, y es también el valor que pone `normalizeOb` cuando el
modelo no manda uno válido (`lib/analizadores/nucleo/ob.ts:315`). El esquema OB no tiene «no se habló»
(`lib/analizadores/rotulos.ts:37-39`), así que no se distingue un arranque parcial de un tema que no se tocó. Pesa más
que antes: `llamadasDeOnboarding` cuenta a un cliente `PARCIAL` como ATENCIÓN
(`lib/negocio/llamadasDeOnboarding.ts:7-11`).

---

## 6 · Reglas propias de esta sección

**1 · Dos compuertas, y la segunda manda.** El clasificador decide en qué pestaña cae; el análisis, con la
transcripción entera, puede decir que no era eso y la llamada queda NOT_MATCH con el motivo
(`lib/analizadores/pipeline.ts:456-459`). Una OTRO es siempre NOT_MATCH: lo exige un `check`
(`db/migraciones/056_tablas_del_analizador.sql:85`), y el informe (la columna `analisis`) existe si y sólo si
coincidió (`db/migraciones/056_tablas_del_analizador.sql:164`).

**2 · Nada se paga dos veces.** La toma es un `update` condicional que exige el estado **y el tipo** en que se vio la
llamada (`lib/analizadores/datos.ts:216-240`); la lista es una foto, y una llamada que otra corrida terminó mientras
tanto se saltea. Vale para la tarea, para el reintento y para el drenado de la pantalla.

**3 · Una llave rota no es un fallo de la llamada.** Una llave rechazada, una cuenta sin saldo o el servicio saturado
devuelven la llamada a su estado, cortan el drenado y no gastan reintentos (`lib/analizadores/pipeline.ts:476-482`,
`lib/analizadores/datos.ts:354-363`). Y cortan también la clasificación de objeciones, que no arranca si las fichas
ya vieron la llave rechazada (`lib/analizadores/tarea.ts:172-180`).

**4 · El costo es nulo, nunca cero.** Un 0 diría «no costó nada» (`lib/analizadores/nucleo/pricing.ts:44-58`,
`db/migraciones/056_tablas_del_analizador.sql:173-174`). Los cuatro contadores de tokens se guardan igual, para
calcular hacia atrás el día que haya tarifa.

**5 · Los datos duros vienen del proveedor, nunca del modelo**: fecha, duración, organizador y enlace salen de tl;dv
(`lib/analizadores/pipeline.ts:343-356`). Y **la transcripción no sale de la base**: ninguna respuesta de la API la
devuelve (`lib/analizadores/datos.ts:623`).

**6 · Solos en su horario y con la función entera.** La tarea de cada hora y el reintento corren sin otras tareas en
su minuto y con 285 s, no con el presupuesto compartido de 180 s: con ese, la guardia rechazaría todo análisis y las
pendientes no se drenarían nunca, sin que nada fallara (`lib/negocio/barrido.ts:262-279` y
`lib/negocio/barrido.ts:370-380`); el reintento recibe el mismo fin de reloj (`lib/negocio/barrido.ts:784-792`).

**7 · Qué hace cada una de las dos tareas, y qué no.** La de cada hora hace **cuatro pasos**: descubre, drena las
PENDING, completa las fichas que nunca se generaron y clasifica las objeciones sin categoría vigente, en ese orden y
con lo que sobre de reloj (`lib/analizadores/tarea.ts:75-181`). El reintento toma las FAILED que no agotaron sus
tres intentos y las ANALYZING colgadas hace más de 15 minutos (`lib/analizadores/datos.ts:848-875`); no descubre, no
toca las PENDING ni genera fichas (`lib/analizadores/tarea.ts:224-230`). Una ficha FAILED no la reintenta nadie: se
rehace con el botón. Las dos agrupan los fallos del modelo de la corrida en incidentes, uno por situación y por paso
(`lib/analizadores/tarea.ts:82`, `lib/analizadores/tarea.ts:236`).

**8 · Borrar deja lápida**, en la misma transacción: sin ella, la siguiente corrida traería la reunión de vuelta y
la pagaría otra vez (`db/migraciones/056_tablas_del_analizador.sql:223-224`).

**9 · Una DONE no se mueve de pestaña, y lo impide el servidor** (`lib/analizadores/datos.ts:475-515`); lo que se
mueve pierde su análisis y su ficha viejos en la misma transacción.

**10 · Veintiocho reuniones no son una tasa.** El piso del proyecto para publicar una tasa es 10
(`lib/negocio/indicadoresDeCitas.ts:329`), y las propias son 28 repartidas en tres tipos; acá valen conteos. El
puntaje por closer de `llamadasDeVenta` aplica el mismo piso de 10 llamadas (`lib/negocio/llamadasDeVenta.ts:15-16`).

**11 · La categoría de una objeción es de un juego cerrado, y vale mientras su texto sea el mismo.** Haiku la pone
una vez por llamada, en la tarea de cada hora, con todas las objeciones de la llamada juntas
(`lib/analizadores/objeciones.ts:1-22`). Se guarda por posición y por la `md5` del texto, y **el texto no se copia**:
sigue en el análisis (`db/migraciones/073_las_objeciones_clasificadas.sql:5-18`). Lo que no se pudo clasificar se
pide en la corrida siguiente, sin cola aparte; quien cuenta junta por posición **y** huella con el análisis vigente,
y lo que nunca esconde es la cobertura (`lib/negocio/llamadasDeVenta.ts:9-14`).

**12 · El vínculo con un contacto se calcula, no se adivina.** Por correo, o por una cita única en ±12 horas; con dos
contactos citados en esas horas la llamada queda **ambigua**, sin vínculo, y se cuenta aparte
(`lib/negocio/vinculoDeLlamadas.ts:6-14`).

---

## 7 · Riesgos

**El riesgo principal ya no es la isla: es que nadie mira la pestaña con lo que el resto ya sabe.** Hay 41 HT
juzgadas, 89 objeciones clasificadas y 25 llamadas que casan por correo con un contacto. El cerebro, la Reunión, el
Brief y Sales las leen (§ 4), pero la pestaña sigue sin un solo agregado, y la ficha del contacto no muestra su
llamada analizada. Un dato que el cruce muestra y nadie explicó: **ninguno de los 41 informes HT dice `CERRADA`**.
No está verificado si es el negocio o la rúbrica; con `negocio.resultados` en 7 filas y `negocio.llamadas` en 0, no
hay contra qué compararlo.

**El motivo del sello se escribe y no lo lee nadie.** `motivoDeLoIncompleto` arma frases como «tl;dv rechazó la
llave: hay que volver a cargarla» (`lib/negocio/barrido.ts:898-918`), y el bucle dice que eso «tiene que poder leerse
desde la pantalla de monitoreo sin abrir un registro» (`lib/negocio/barrido.ts:632-643`). Ningún archivo de `lib/`,
`app/` o `components/` lee `ultimo_motivo` fuera del que lo escribe (`grep`, 2026-10-18; sólo lo nombra
`lib/datos/esquema.ts`). Desde AG15 la cabecera sí dice si la tarea nunca corrió, falló o está atrasada (§ 2), pero
`frescuraDe` avisa sólo el estado `fallo` (`lib/negocio/frescura.ts:160-163`): con la llave de tl;dv revocada la
tarea se sella `corrio` con su motivo, la cabecera calla y la pestaña no avisa hasta que alguien aprieta
Sincronizar, que sí lo dice (`app/api/analizadores/sincronizar/route.ts:38-41`). El motivo sólo se ve con la
consulta de `docs/OTROS/produccion/DESPLIEGUE.md:346` o con `scripts/medir-analizadores.sql:87-89`.

**Seis días sin reuniones nuevas, y no se puede saber si es normal.** La tarea se selló `corrio`, sin motivo, cada
hora del 2026-10-13 al 2026-10-18 (por el último sello) y no entró ninguna reunión. Puede ser que el equipo no grabó
reuniones, o que tl;dv devuelva un listado que no casa con la ventana de 48 h. El sello no lo distingue y la base no
guarda el historial (§ 5, punto 2).

**La caché se paga y no se usa.** El sistema del análisis va marcado para cachear
(`lib/analizadores/nucleo/anthropic.ts:215`), y cada análisis y cada ficha escriben su caché para que el siguiente la
lea. Con un análisis cada varias horas no la lee ninguno: **0 tokens de lectura en 21 de 21 análisis propios**, y
88 540 tokens escritos en `uso_de_ia` desde el 2026-10-06. Cuánto cuesta no se sabe, porque no hay tarifa.

**El gasto que antes no quedaba escrito, ya queda.** Cerrado en AG2: cada clasificación, análisis, ficha y pedida de
objeciones deja su fila en `negocio.uso_de_ia`, y los fallos van al Panel de Incidentes con `origen = 'analizador'`,
agrupados por corrida en la tarea (`lib/analizadores/tarea.ts:82`). El 2026-10-18 hay **0 filas** con un fallo de
esta sección.

**El error de una FAILED llevaba datos del cliente.** Cerrado en AG2 para las fallas nuevas: un JSON ilegible es
`sin_estructura` y el error dice sólo «El modelo no devolvió JSON parseable.» (`lib/analizadores/nucleo/engine.ts:71`;
prueba `pruebas/codigo/201-el-error-del-analisis.test.ts`). La FAILED del 2026-09-28, la única que guardaba un error
con el nombre de una persona y de su empresa, se reintentó y quedó DONE, y el paso a DONE borra el error
(`lib/analizadores/datos.ts:297`). Se guarda hasta 500 caracteres (`lib/analizadores/datos.ts:55`) y la fila lo
dibuja (`components/analizadores/PanelDeAnalizadores.jsx:395`).

**El contador de reintentos no vuelve a cero.** Sólo se incrementa (`lib/analizadores/datos.ts:878-886`), y un `grep`
de `reintentos_automaticos` en `lib/`, `app/` y `pruebas/` no encuentra ningún reinicio. Una llamada que agotó sus
tres, se rescató con el botón y más adelante vuelve a fallar ya no entra al barrido. Hoy afecta a 0 llamadas.

**El reintento sólo corre donde hay llave de tl;dv** (`lib/negocio/barrido.ts:581-586`), aunque no la use: una
transcripción pegada a mano que falla en una empresa con sólo llave de IA no se reintenta nunca sola. Hoy hay 0
llamadas en otras empresas.

**El clasificador pierde ventas.** De las 44 que llamó OB en el historial, 12 eran ventas que el analizador HT nunca
vio (`docs/OTROS/analizadores/ANALIZADORES.md:241-248`). Siguen en Descartadas de OB, y hasta que llegue el mapa de
nombres una venta nueva puede seguir el mismo camino. Con el Brief y Sales leyendo sólo las HT, una venta mal
clasificada tampoco aparece ahí.

**Nueve personas ven una pestaña vacía.** En las otras empresas la sección aparece, dice «No hay llamadas en este
filtro» (`components/analizadores/PanelDeAnalizadores.jsx:376`) y deja Sincronizar deshabilitado con su motivo en el
`title` (`components/analizadores/PanelDeAnalizadores.jsx:301-309`), que en un teléfono no se ve.

**Los documentos de requisitos quedaron atrás de los hechos.** `docs/OTROS/analizadores/ANALIZADORES.md:116` dice
que falta el hito de 24 h, `docs/OTROS/analizadores/ANALIZADORES.md:117` y `docs/OTROS/analizadores/ANALIZADORES.md:121`
dejan HT-10 y OB-4 «en curso», y `docs/OTROS/analizadores/ANALIZADORES.md:342` anuncia como futuro lo que el
reintento hizo el 2026-09-24. Ningún commit desde el 2026-09-28 tocó ese archivo.

**Lo que se puede hacer hoy, con evidencia.** Leer el motivo del sello en la propia pestaña (el dato existe y se
escribe en cada corrida). Mostrar en la pestaña los agregados que el cerebro ya calcula. Y cargar la tarifa en cuanto
se confirme: los cuatro contadores de los 21 análisis propios y de las 64 llamadas de `uso_de_ia` ya están. Lo que
**no** se puede hacer hoy: ninguna tasa (28 reuniones propias), ninguna comparación con Brain (parado, y su tabla en
un respaldo), y la clasificación por nombre (falta el mapa).

---

## Cómo se midió

Con `node --env-file=.env.supabase scripts/supabase.mjs leer "…"`, el único camino que ve las filas de `negocio.*`
en producción, y siempre con agregados, el 2026-10-18 entre las 15:41 y las 15:50 UTC. Las formas, para repetirlas:

- Estados: `select tipo, estado, count(*) filter (where creado_el < '2026-09-23'), count(*) filter (where creado_el >=
  '2026-09-23') from negocio.analizador_llamadas group by 1, 2`; las altas por día con `date_trunc('day', creado_el)`.
- Conteos por tabla de `analizador_*` y `objeciones_clasificadas`; las fichas por `estado`.
- Uso: `agente`, `resultado`, `count(*)` y las sumas de los cuatro contadores de `negocio.uso_de_ia`, con
  `min`/`max(creado_el)`.
- Análisis propios: `count(*)`, `sum(tokens_lectura_cache)` y `count(*) filter (where coincide)` de
  `negocio.analizador_analisis` con `analizado_el >= '2026-09-23'`; puntajes y resultados agrupados.
- Objeciones: la cobertura, contando las objeciones con texto de las HT DONE (como `objecionesSinClasificar`) unidas a
  su fila por llamada, índice y `md5`; y `categoria`, `count(*)`.
- Sellos: `ultimo_estado`, `ultima_corrida_el`, `ultimas_llamadas` y si hay `ultimo_motivo`, sin leerlo, de
  `negocio.tareas_programadas`.
- Acceso: `count(*)` sobre `identidad.usuarios` activos por rol y por organización principal, y
  `usuarios_secciones` con `analizadores`.
- El cruce: `count(*)` de prospectos y de HT DONE cuyo correo existe como `lower(btrim(email))` en
  `negocio.contactos` de la misma organización.
- Brain: `to_regclass` de la tabla de `public` y `count(*)`, `max(created_at)` y `max(updated_at)` de
  `respaldo_aria_brain.analyzer_calls`.

Ninguna consulta devolvió títulos, nombres, correos, transcripciones, errores ni texto de un informe; los correos
sólo se compararon dentro de un `count`.
