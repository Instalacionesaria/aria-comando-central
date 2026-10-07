# Analizadores (HT y OB)
> Corte: **2026-09-28, 18:03-18:23 UTC**. Cada afirmación lleva su `archivo:línea` o la consulta que
> la produjo; todas las consultas son de solo lectura y de agregados (`scripts/supabase.mjs leer`).
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Archivo **nuevo**: la foto del 2026-09-15 no tenía esta sección, que nació el 2026-09-23.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15** (`git log --since=2026-09-15`; horas de Lima, las del commit)
>
> - **2026-09-23, nueve commits entre las 11:00 y las 17:34, siete migraciones.**
>   `05534de` HT-0 a HT-5: el núcleo de Brain copiado byte a byte —una prueba fija la huella de cada
>   rúbrica, cada esquema y el prompt del clasificador—, el pipeline, las seis tablas (`056`) y la
>   llave de tl;dv cifrada (`057`); 30 archivos y 6 358 líneas agregadas. Corrige de paso un defecto
>   del origen, `normalizeHt` comparando la fase en mayúsculas contra una lista en minúsculas, y la
>   rúbrica sube a v8.1 (§ 3 y § 4). `35665f2` HT-6 a HT-8: la tarea de cada hora (`058`), la
>   sección con sus dos capacidades (`059`), las siete rutas y la pantalla mínima. `7506742`: lo que
>   encontró una revisión adversarial de las etapas 0 a 8, cada defecto con su prueba vista roja con
>   su mutación, 23 de 23 según el commit —la toma que exige estado y tipo, la llave rota que no
>   deja FAILED, la ficha que espera 10 minutos, el sello que nombra lo que dejó la corrida
>   incompleta (§ 3, 6 y 7)—, más la copia del historial (`scripts/copias/historial-analizador.sql`)
>   y la `060`, que le da a `postgres` el `insert` para correrla. `b056a96` HT-9: la copia hecha en producción —107
>   llamadas, 42 prospectos, 107 transcripciones, 44 análisis, 37 fichas y 13 lápidas, verificada en
>   solo lectura contra el origen (`docs/OTROS/analizadores/ANALIZADORES.md:181-193`)—, la `061`, que
>   le quita ese `insert`, y la nota para las 3 HT copiadas sin ninguna fase
>   (`lib/analizadores/fases.ts:42`). `c5ec09e` OB-1, sólo el documento: las 44 reuniones que el
>   clasificador llamó OB, leídas enteras dos veces por lectores independientes que coincidieron en
>   44 de 44; los 36 vetos eran correctos, sólo 5 eran onboardings y 12 eran ventas que el
>   analizador HT nunca vio (`docs/OTROS/analizadores/ANALIZADORES.md:216-269`). De ahí salen el
>   riesgo «el clasificador pierde ventas» (§ 7) y la clasificación por nombre (§ 1). `dfc406b`: el
>   aviso de página llena, abajo. `0c09549` OB-2 y OB-3: `TIPOS_QUE_SE_ANALIZAN` pasa a HT y OB sin
>   migración (`lib/analizadores/pipeline.ts:73`), entran `DetalleOb.jsx` (333 líneas) y
>   `lib/analizadores/rotulos.ts` (82), y una revisión adversarial encontró 11 defectos distintos,
>   el más visible que el rótulo pasaba por `.toLowerCase()` y la pantalla decía «no es ht ni ob».
>   `70a84c6`: `scripts/medir-analizadores.sql` y `scripts/comparar-con-brain.sql`, atadas por
>   `pruebas/codigo/174-las-mediciones-de-los-analizadores.test.ts` a no escribir, no leer una llave
>   y no sacar datos de una persona; la primera lectura (21:07 UTC) y el humo con login de HT y OB.
>   `a434f98`: la tarea `reintentos` con la `062`, y el documento de la clasificación por nombre.
> - **Lo que corrigió `dfc406b`.** `7506742` hacía que el sello dijera «tl;dv devolvió una página
>   llena» cuando el listado traía 50 reuniones, el tamaño de página, porque no se pide una segunda
>   (`lib/analizadores/nucleo/tldv.ts:138`). La primera corrida real, el 2026-09-23 a las 18:41 UTC,
>   lo desmintió: la página venía llena pero 48 de sus 50 eran anteriores a la ventana de 48 h, así
>   que la cruzaba y no faltaba nada; contando nada más, el sello iba a avisar en todas las corridas
>   de una cuenta con más de 50 reuniones, y un sello que avisa siempre deja de leerse
>   (`lib/analizadores/pipeline.ts:278-288`). Desde entonces el descubrimiento calcula
>   `paginaSinBorde`: llena **y** sin ninguna reunión anterior al corte, y una sin fecha cuenta como
>   adentro (`lib/analizadores/pipeline.ts:289-291`, anunciado en
>   `lib/analizadores/nucleo/tldv.ts:140-143`). La tarea lo pasa como `paginaLlena`
>   (`lib/analizadores/tarea.ts:105`) y solo entonces el sello lo escribe
>   (`lib/negocio/barrido.ts:850-852`). Las dos caras están probadas
>   (`pruebas/base/173-tarea-del-analizador.test.ts:188-210`); que la del caso real se viera roja
>   con la mutación que vuelve a contar lo dice el commit, **no re-corrido para esta foto**. El
>   documento de requisitos lo cuenta en `docs/OTROS/analizadores/ANALIZADORES.md:168-171`. Releído
>   el 2026-09-28 a las 23:57 UTC, después de la ventana de este corte: el sello de `aria` de la
>   corrida de las 23:41 UTC dice `corrio`, sin motivo y sin «página llena», con 1 llamada a
>   proveedores. Si alguna corrida intermedia avisó no se puede saber, porque se guarda solo la
>   última (§ 4); si la página de hoy viene llena, tampoco: exige llamar a tl;dv.
> - **Después, solo documentos y rutas de documentos escritas en comentarios y mensajes**: `302fa04`
>   (2026-09-25), `e630823` y `1c55149` (2026-09-28); qué tocó cada uno, en § 4 («Las migraciones»)
>   y § 7.

**Construido y funcionando desde el 2026-09-23, en una sola empresa y con poco volumen.**

Es la única parte del producto que juzga una llamada de venta real: la sección `analizadores`
(grupo Operación, debajo de Closer; desde el 2026-10-02, en Sales y en Client Success) descubre cada hora las reuniones de tl;dv, las clasifica en HT,
OB u OTRO, las analiza con Sonnet y deja una ficha del prospecto en cada HT. Medido el 2026-09-28 a
las 18:05 UTC, en la organización `aria`: **115 reuniones** —107 copiadas una vez de ARIA Brain y 8
que Comando Central descubrió por su cuenta en cinco días—, **48 analizadas** (38 HT y 10 OB), 46
que el propio análisis vetó, 20 OTRO y **1 fallida**, una OB de hoy a las 17:42 que espera el
reintento de mañana a las 5:07 de Lima. El reintento de las 5 ya rescató las dos que le tocaron, el
24 y el 25. Lo que queda mal no está en el pipeline: **nada fuera de la pestaña lee estos datos**
—22 de las 38 HT analizadas son de personas que están en `negocio.contactos`, y `negocio.llamadas`
sigue en cero filas—; **el sello de las dos tareas no lo dibuja ninguna pantalla**, así que una llave
rota solo se ve con SQL; y **la caché que se paga en cada análisis no se relee nunca**: 47 146 tokens
escritos y 0 leídos en los 7 análisis propios.

---

## 1 · Qué pide el documento

Analizadores no es uno de los departamentos de Inteligencia de [00-MAPA.md](00-MAPA.md), sino una
sección de Operación. El documento funcional no está en el repositorio, así que **no se verificó** si
le dedica un capítulo; lo que se pidió está escrito en dos documentos del repo.

**`docs/OTROS/analizadores/ANALIZADORES.md`** (343 líneas; contrastado contra código y producción el
2026-09-22). Qué es (`docs/OTROS/analizadores/ANALIZADORES.md:9-20`): dos compuertas —un clasificador
barato (Haiku) que decide HT, OB u OTRO mirando los primeros 6 000 caracteres, y el análisis (Sonnet)
que puede **vetar** con `{"match": false}` si con la transcripción entera no era lo que se creyó—; de
ahí salen dos informes, el HT (el closer en cinco fases, más la ficha del prospecto aparte) y el OB
(el perfil de arranque del cliente). Nueve decisiones (`docs/OTROS/analizadores/ANALIZADORES.md:22-34`):
tablas propias `negocio.analizador_*` por `org_id`; el historial se copia **una vez** a `aria`; ARIA
Brain sigue corriendo y el doble trabajo se acepta; todas las empresas, cada una con sus llaves; una
sola casilla de permisos; `analizadores.ver` para mirar y `analizadores.editar` para gastar, las dos
a los tres roles; la llave de Anthropic es la de la empresa; se guardan los tokens y el costo espera
la tarifa confirmada; y las OTRO se guardan sin mostrar su texto. Tres decisiones por defecto
(`docs/OTROS/analizadores/ANALIZADORES.md:36-50`): OB se clasifica desde el primer día y
`TIPOS_QUE_SE_ANALIZAN` es el interruptor; el núcleo portado sigue en inglés porque es el contrato
con el modelo; la llave de tl;dv va en Ajustes › Credenciales. Las etapas
(`docs/OTROS/analizadores/ANALIZADORES.md:100-121`): HT-0 a HT-9 y OB-1 a OB-3 hechas el
2026-09-23; **HT-10 y OB-4 figuran «en curso»**. Y el reintento de las 5, pedido el mismo día
(`docs/OTROS/analizadores/ANALIZADORES.md:323-342`).

**`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md`** (117 líneas): **pendiente**, se
construye cuando esté el mapa completo de nombres de reunión → tipo
(`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:3`). El tipo saldría del título antes de
pedir la transcripción y antes del clasificador
(`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:59-72`), se validaría contra el
historial sin gastar (`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:80-92`), y quedan
cuatro decisiones abiertas; la primera es el mapa mismo, que «lo tiene el equipo»
(`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:94-103`).

**Y lo que Sales esperaba.** La foto de Sales del 2026-09-16 registró que el documento funcional da
por existente la «Auditoría de llamadas de venta» y que `negocio.llamadas` tenía 0 filas
([05-SALES.md](05-SALES.md)). Analizadores HT hace esa auditoría, pero portada de Brain y no
construida sobre `negocio.llamadas`: medido el 2026-09-28, `negocio.llamadas` sigue en **0 filas**, y
`negocio.resultados` en 7 filas con 0 ventas.

---

## 2 · Qué hay hoy en pantalla

La sección se declara en `lib/autorizacion/secciones.ts:363-368` —clave `analizadores`, capacidad
`analizadores.ver`, grupo Operación— con su porqué en `lib/autorizacion/secciones.ts:352-362`:
debajo de Closer porque «es el mismo trabajo mirado después», una sola casilla aunque adentro haya
dos pestañas, y su propia capacidad porque con `closer.ver` «cualquier closer leería las
transcripciones de todo el equipo». La monta `components/views/AnalizadoresView.jsx:16-34` («Cada
llamada de tl;dv, juzgada») y el cuerpo es `components/analizadores/PanelDeAnalizadores.jsx` (527 desde la etapa E11, 541 en la E10, 536 en la E9;
eran 511 líneas), con `DetalleHt.jsx` (408) y `DetalleOb.jsx` (333) en la misma carpeta.

**Después del corte, el 2026-10-02** (nueva estructura, etapa E10): la barra lateral ya no tiene grupos. Las
dos pestañas se abren como Sales › Analizador HT y Client Success › Analizador OB, y la pantalla anuncia la
que dibuja, para que la barra marque la entrada correcta aunque se cambie con su barra HT/OB
(`docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`). La sección y su permiso no cambiaron. Y desde la
etapa E11, el mismo día, la barra HT/OB ya no está: las dos pestañas que «La lista» llama «HT · Venta»
y «OB · Onboarding» son ahora «Analizador HT» y «Analizador OB» en la cabecera de cada departamento, y
la pantalla sólo cambia de una a otra por la navegación. Los botones de sincronizar y de analizar
siguen donde estaban, a la derecha. Con un informe abierto, la pantalla anuncia el tipo del informe, así
que uno de onboarding pegado desde «Analizador HT» se muestra bajo Client Success › Analizador OB.

**Y en la segunda edición, el mismo día**: las dos entradas se llaman Sales › **Llamadas de venta** y
Client Success › **Llamadas de onboarding** (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`,
`NE-47`). La sección, sus pestañas `HT` y `OB` y su permiso no cambiaron.

── **LA LISTA** ──

Dos pestañas, «HT · Venta» y «OB · Onboarding», y tres filtros, Analizadas · Pendientes ·
Descartadas (`components/analizadores/PanelDeAnalizadores.jsx:46-55@40f699a`). Cada filtro es una lista
cerrada de estados (`lib/analizadores/datos.ts:524-528`: DONE; PENDING, ANALYZING y FAILED;
NOT_MATCH), y **las Descartadas de una pestaña son sus vetadas más todas las OTRO**, porque una OTRO
no es de ninguna y se reencamina desde cualquiera (`lib/analizadores/datos.ts:553-555`). Dos botones
arriba: «Sincronizar con tl;dv», deshabilitado sin la llave de tl;dv, y «Analizar transcripción»,
que abre el formulario de la transcripción pegada a mano
(`components/analizadores/PanelDeAnalizadores.jsx:301-312`). Cada fila dice título, fecha, motivo
del descarte o error del fallo, puntaje y estado, y ofrece Ver, Analizar o Reintentar, Mover a la otra
pestaña o a «No es HT ni OB», y Borrar (`components/analizadores/PanelDeAnalizadores.jsx:379-430`).
Sincronizar descubre y después analiza **de a una petición** solo las PENDING; las FAILED no, porque
reintentarlas es una decisión de quien leyó el error
(`components/analizadores/PanelDeAnalizadores.jsx:226-252`).

── **LOS DOS DETALLES** ──

HT tiene dos vistas, Closer y Prospecto (`components/analizadores/DetalleHt.jsx:117-118`); las cinco
fases se rotulan por su campo cuando vienen distintas, por posición cuando son cinco iguales (el
defecto v8 del historial), «Fase N» si no hay forma de saberlo y una nota si no hay ninguna
(`lib/analizadores/fases.ts:41-57`). OB tiene una sola vista y ninguna ficha
(`components/analizadores/DetalleOb.jsx:5-8`). Una vetada dice qué NO es: «No es HT», «No es OB» o
«No es HT ni OB» (`lib/analizadores/rotulos.ts:17-23`).

── **LO QUE LA PANTALLA NO TIENE** ──

Su propio encabezado la declara «lo MÍNIMO que hace funcionar el flujo»
(`components/analizadores/PanelDeAnalizadores.jsx:6-7`). Fuera del número entre paréntesis de cada
filtro (`components/analizadores/PanelDeAnalizadores.jsx:361`), no hay un solo agregado: ni puntaje
medio, ni llamadas por closer, ni tendencia. No hay costo (decisión 8). No hay forma de reanalizar
una DONE desde la pantalla —solo la API lo acepta, y el 2026-09-25 se decidió dejar así la HT de análisis
vacío (`docs/OTROS/analizadores/ANALIZADORES.md:205-209`)—. No hay transcripción: ninguna respuesta
la devuelve (`app/api/analizadores/llamadas/[id]/route.ts:31-32`). Y **no dice si la tarea corrió**:
el panel no llama a `frescuraDe`, cuyos únicos llamadores son `lib/negocio/agenda.ts:352`,
`lib/negocio/ficha.ts:289` y `app/api/leads-portal/route.ts:63-64`.

── **LAS SIETE RUTAS** ──

Leer pide `analizadores.ver`: el estado de las llaves (`app/api/analizadores/estado/route.ts:21`),
la lista (`app/api/analizadores/llamadas/route.ts:22`) y el detalle
(`app/api/analizadores/llamadas/[id]/route.ts:24`). Todo lo que cambia o gasta pide
`analizadores.editar`: reencaminar y borrar (`app/api/analizadores/llamadas/[id]/route.ts:48` y
`app/api/analizadores/llamadas/[id]/route.ts:86`), analizar
(`app/api/analizadores/llamadas/[id]/analizar/route.ts:42`), la ficha
(`app/api/analizadores/llamadas/[id]/ficha/route.ts:33`), la manual
(`app/api/analizadores/manual/route.ts:45`) y sincronizar
(`app/api/analizadores/sincronizar/route.ts:27`). Las cuatro que llaman al modelo declaran
`maxDuration = 300` y trabajan con un reloj de 280 s (`lib/analizadores/rutas.ts:19`).

── **QUIÉN LA VE**, medido el 2026-09-28 ──

Los tres roles del catálogo (`usuario`, `administrador`, `superadministrador`) tienen las dos
capacidades, y los **15 usuarios activos** las tienen por su rol. Pero 4 de los 15 están en `usuario`,
el rol con secciones restringidas, y `identidad.usuarios_secciones` tiene **0 filas** con
`analizadores`: ninguno de esos 4 la ve. Quedan **11 que ven la pestaña: 2 en `aria`**, la única
empresa con llamadas, **y 9 en otras empresas**, donde se abre vacía y con Sincronizar deshabilitado
porque su empresa no tiene llave de tl;dv. La declaración no tiene ninguna bandera que la oculte sin
la llave (`lib/autorizacion/secciones.ts:363-368`).

---

## 3 · Lo que está hardcodeado

**Ningún dato inventado.** Un `grep` de números literales en el texto de los tres componentes de
`components/analizadores/` no devuelve ninguna cifra: solo la escala del puntaje del detalle HT, los
dos `/10` y el rótulo «Para llegar a 10» (`components/analizadores/DetalleHt.jsx:190`,
`components/analizadores/DetalleHt.jsx:209` y `components/analizadores/DetalleHt.jsx:214`), y el
`[00:05]` de ejemplo del formulario manual (`components/analizadores/PanelDeAnalizadores.jsx:517`).
Todo lo demás sale de las seis tablas y del estado de las llaves. Lo que está escrito a mano son
decisiones de operación:

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
| Techo de tokens: análisis y clasificador | 20 000 y 400 | `lib/analizadores/nucleo/anthropic.ts:47-48` |
| Lo que lee el clasificador | 6 000 caracteres | `lib/analizadores/nucleo/engine.ts:50` |
| Fin de la tarea dentro de la función | 285 s | `lib/negocio/barrido.ts:340` |
| Pendientes pedidas por corrida | 10 | `lib/analizadores/tarea.ts:42` |
| Reintentos automáticos por llamada | 3 | `lib/analizadores/tarea.ts:207` |
| Minutos en ANALYZING para darla por colgada | 15 | `lib/analizadores/datos.ts:58` |
| Minutos antes de que la tarea genere una ficha | 10 | `lib/analizadores/datos.ts:893` |
| Tarifas confirmadas | ninguna | `lib/analizadores/nucleo/pricing.ts:42` |
| Versión de la rúbrica HT | `rubric.es.md@v8.1` | `lib/analizadores/nucleo/ht.ts:505` |
| Versión de la rúbrica OB | `rubric.es.md@OB` | `lib/analizadores/nucleo/ob.ts:328` |
| Versión de la ficha | `ficha.es@v1` | `lib/analizadores/nucleo/prospect-card.ts:780` |

Uno de esos números está **escrito dos veces**: los 15 minutos de la colgada vuelven a aparecer en
`components/analizadores/PanelDeAnalizadores.jsx:60-61`, con el comentario «La base usa el mismo».
Ninguna prueba los ata (un `grep` de `MINUTOS_PARA_DARLA_POR_COLGADA` en `pruebas/` no devuelve nada),
a diferencia de los 285 s, que sí están atados a `maxDuration`
(`pruebas/base/173-tarea-del-analizador.test.ts:243`).

---

## 4 · Datos que YA tenemos

Todo medido el 2026-09-28 entre las 18:03 y las 18:23 UTC; a las 18:16 el total seguía en 115 y
las abiertas en 1. Una sola empresa tiene datos: las 115 llamadas son de `aria`, y es la única de las
13 empresas (11 activas) con llave de tl;dv. «Copiada» y «propia» se separan como en
`scripts/medir-analizadores.sql:13-16`: `creado_el` anterior o posterior al 2026-09-23 (la copia
conserva sus fechas de Brain).

**Las llamadas, por tipo y estado** (`negocio.analizador_llamadas`, 115 filas):

| | HT | OB | OTRO | Total |
|---|---|---|---|---|
| Copiadas de Brain | 37 DONE (una pegada a mano) · 7 vetadas | 8 DONE · 36 vetadas | 19 | 107 |
| Descubiertas por Comando Central | 1 DONE · 2 vetadas | 2 DONE · 1 vetada · 1 FAILED | 1 | 8 |
| **Total** | **47** | **48** | **20** | **115** |

Como las cuenta la pantalla (`lib/analizadores/datos.ts:605-621`): **HT 38 analizadas · 0
pendientes · 29 descartadas; OB 10 analizadas · 1 pendiente · 57 descartadas.** El 2026-09-23, recién
copiado, era HT 37 analizadas y 26 descartadas, y OB 7, 1 y 55
(`docs/OTROS/analizadores/ANALIZADORES.md:195-196`). Ninguna reunión de tl;dv se borró desde
entonces: las lápidas siguen en 13. Las otras tablas: 51 análisis (44 copiados + 7
propios), 38 fichas, 46 prospectos (42 el 2026-09-23, `docs/OTROS/analizadores/ANALIZADORES.md:190-191`),
115 transcripciones, 1 sin marcas de tiempo (la pegada a mano), y 37 llamadas sin fecha de la reunión
(todas copiadas; la lista ordena por `coalesce(fecha_de_la_reunion, creado_el)`,
`lib/analizadores/datos.ts:579`). Las vetadas copiadas no tienen fila de análisis: Brain no guardaba
lo que costaba un veto (`db/migraciones/056_tablas_del_analizador.sql:24`).

**Lo que Comando Central hizo por su cuenta: 8 reuniones en cinco días**, creadas el 2026-09-23 a las
18:41 (dos) y 20:41, el 24 a las 01:41 y 21:41, el 25 a las 16:41 y 21:41 y el 28 a las 17:41 UTC:
siempre en el minuto 41, que es el de la tarea. Ninguna el sábado 26 ni el domingo 27. Los 7 análisis
propios son los 6 de esas reuniones que dejaron fila de análisis —la OTRO no se analiza y la FAILED
no deja fila— más la OB copiada que rescató el reintento:

| | Duración (`analizado_el − tomada_el`) | Tokens de salida | Caché escrita / leída |
|---|---|---|---|
| 4 completos (1 HT, 3 OB) | 34, 35, 38 y 48 s | 2 999 a 4 235 | 9 774 por HT, 4 456 por OB / **0** |
| 3 vetos (2 HT, 1 OB) | 3 s cada uno | 101 a 109 | igual / **0** |

En total 107 511 tokens de entrada, 14 511 de salida, **47 146 de escritura de caché y 0 de lectura**;
la única ficha propia sumó 5 437, 3 559, 13 582 y 0. `costo_usd` es nulo en los 51 análisis, como
manda la tarifa sin confirmar (`lib/analizadores/nucleo/pricing.ts:42`). Los cuatro contadores
están completos solo en los 7 propios: en los 44 análisis y las 35 fichas OK copiados, entrada y
salida están y **los dos de caché son nulos**, porque Brain no los guardaba
(`docs/OTROS/analizadores/ANALIZADORES.md:76-78`); medido el 2026-09-29 a las 00:20 UTC, en la
verificación de esta foto. El análisis más largo, 48 s, cabe cinco veces en la espera de 270 s; la
observación de HT-10 y OB-4 quería semanas de datos antes de tocar las esperas
(`docs/OTROS/analizadores/ANALIZADORES.md:302-303`), y hay 4 casos.

La lectura versionada, `scripts/medir-analizadores.sql`, corrida el 2026-09-28 a las 18:10 UTC, da
en las tres filas de `aria` **0 duplicadas, 0 colgadas, 0 análisis propios sin sus cuatro contadores
y 0 HT propias sin ficha pasada una hora** (la consulta mira solo lo propio,
`scripts/medir-analizadores.sql:31-44`), y el sello `corrio · 2026-09-28 17:42 UTC` sin motivo. Es
la segunda lectura que queda escrita; la primera fue la del 2026-09-23 21:07
(`docs/OTROS/analizadores/ANALIZADORES.md:291-300`).

**La tarea de cada hora**, `'41 * * * *'` en `vercel.json` y en `lib/negocio/barrido.ts:265-269`:
en `aria` el último sello es `corrio`, 2026-09-28 17:42 UTC, **4 llamadas a proveedores** —el listado,
una transcripción, una clasificación y un análisis, la cuenta de `lib/analizadores/tarea.ts:188-197`—.
En las otras 10 empresas con sello, `saltada` por falta de la llave de tl;dv. **Que haya corrido cada
hora no está verificado**: el sello es un `on conflict do update` que guarda solo la última corrida
(`lib/negocio/barrido.ts:945-971`); la continuidad se infiere de las 8 reuniones de arriba.

**El reintento de las 5**, `'7 10 * * *'` (`lib/negocio/barrido.ts:278-282`): último sello en `aria`,
`corrio` 2026-09-28 10:07 UTC con 0 llamadas; en las otras 10, `saltada`. **Trabajó dos veces**, y se
ve en `tomada_el`: el **2026-09-24 a las 10:07:47** tomó la OB copiada que había fallado en Brain —la
que el documento anunciaba como «la primera que va a tomar»
(`docs/OTROS/analizadores/ANALIZADORES.md:342`)— y la dejó DONE en 48 s; el **2026-09-25 a las
10:07:48** tomó la HT descubierta el 24 a las 21:41 y la dejó DONE en 38 s; su ficha la generó la
tarea de cada hora a las 10:42:08, como manda el reparto. Si esa HT estaba FAILED o colgada no se
puede saber: las salidas borran el error (`lib/analizadores/datos.ts:297`). **0 llamadas tienen
`reintentos_automaticos` > 0**: el contador sube solo cuando un reintento vuelve a fallar
(`lib/analizadores/tarea.ts:279-283`).

**La única fallida**: una OB descubierta hoy a las 17:41, tomada a las 17:41:42 y FAILED a las
17:42:19 porque el modelo no devolvió JSON legible (hoy `lib/analizadores/nucleo/engine.ts:71`), con 0
reintentos. La toma el barrido del **2026-09-29 a las 10:07 UTC**; no verificado todavía.

**Lo que dicen los informes** (agregados, sin texto): las 38 HT puntúan 1 (una), 3 (4), 4 (11), 5 (9),
6 (9) y 7 (4); **ninguna pasa de 7** y ninguna dice `CERRADA`: 36 `NO_CERRADA` y 2 `INDETERMINADO`. El
1 es la HT de análisis vacío que vino de Brain (102 tokens de salida contra un mínimo de 2 918 en las
otras 37; su 1/10 ROJO es el valor por omisión, `docs/OTROS/analizadores/ANALIZADORES.md:205-207`).
Las fases: 34 v8 con las cinco iguales, 3 v8 sin ninguna y 1 v8.1 con las cinco distintas —la
primera que muestra el arreglo de `lib/analizadores/nucleo/ht.ts:432-436`—. Las 10 OB: 9 `PARCIAL` y
1 `LISTO`. De las 36 fichas OK, la intención de compra «no consta» en 23 y el decisor en 19; 2 fichas
copiadas siguen FAILED desde el 2026-09-08 y el 2026-09-10, porque una ficha FAILED no se reintenta
sola (`lib/analizadores/datos.ts:896-901`).

**El cruce que nadie hace.** 44 de los 46 prospectos tienen correo, y **28 de esos 44 son un contacto
de `negocio.contactos`** de la misma empresa (mismo correo en minúsculas). **22 de las 38 HT
analizadas** son de uno de esos 28. Otras 13 HT analizadas no tienen prospecto.

**Brain sigue parado**: `public.aria_brain_analyzer_calls` tiene 108 filas, la última creada el
2026-09-19 a las 10:00 UTC y la última modificada a las 10:02; 0 desde el 2026-09-20. Es lo mismo que
se midió el 2026-09-23 (`docs/OTROS/analizadores/ANALIZADORES.md:305-315`).

**Las migraciones** `056` a `062` están aplicadas: la `056` y la `057` el 2026-09-22 a las 21:46
UTC, de la `058` a la `060` el 2026-09-23 a las 16:58, la `061` a las 17:29 y la `062` a las 22:34
(`migraciones.migraciones_aplicadas`). El código de la sección que se ejecuta no cambió desde el
commit `a434f98` (2026-09-23 17:34, hora de Lima): `302fa04` (2026-09-25) tocó solo el documento, y
`e630823` y `1c55149` (2026-09-28) reescribieron, en comentarios de `lib/analizadores/`,
`components/analizadores/DetalleOb.jsx`, `lib/negocio/barrido.ts`, `scripts/medir-analizadores.sql`
y una prueba, rutas de documentos que se mudaron a `docs/OTROS/`. En archivos que la sección
comparte cambiaron además la bandera de Leads Portal en `lib/autorizacion/secciones.ts` (`3c361a1`,
2026-09-26), que no toca la declaración de `analizadores`, y la ruta que nombra un mensaje de error de
`app/api/cron/route.ts` (`e630823` y `1c55149`).
Las pruebas: 174 casos en diez archivos, los numerados del 170 al 174 en `pruebas/codigo/` y en
`pruebas/base/` (contados por `test(` al comienzo de línea), **no corridos para esta foto**.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · El costo.** Nulo en los 51 análisis y en las 36 fichas OK, a propósito: la única tarifa de
Sonnet 5 que había era un comentario del código de Brain, nunca verificado contra la facturación
(`docs/OTROS/analizadores/ANALIZADORES.md:68-78`). Tiene que venir de la factura de Anthropic y
cargarse en `CONFIRMED_RATES`. Al corte quedaban dos gastos sin contar: **una FAILED no guarda
tokens** —`terminarConFallo` escribe solo el estado y el error (`lib/analizadores/datos.ts:336-344`)—,
y **el clasificador no guardaba su uso**. **Cerrado en AG2 de los agentes (2026-10-04)**: cada llamada
al modelo —clasificación, análisis y ficha, salga bien o mal— deja una fila en `negocio.uso_de_ia`
(`069`) con sus cuatro contadores, `analizador_clasificar`, `analizador_analizar` o `analizador_ficha`,
y la llamada como referencia (`anotarLaLlamada`, `lib/analizadores/pipeline.ts`); la FAILED sigue sin
tokens en su propia fila. Y el historial no se puede recalcular entero: a los 44 análisis copiados les
faltan los dos contadores de caché (§ 4).

**2 · La historia de las corridas.** `negocio.tareas_programadas` guarda la última de cada (empresa,
tarea) (`lib/negocio/barrido.ts:945-971`), así que no hay forma de contar cuántas corridas hubo, ni
cuántas fallaron, ni cuántas quedaron cortas. Hoy se reconstruye a mano con `creado_el` y `tomada_el`.

**3 · El mapa de nombres de reunión → tipo.** Lo tiene el equipo y es la condición para construir la
clasificación por nombre (`docs/OTROS/futuro/clasificacion-por-nombre-de-reunion.md:94-103`). Sin él,
las 12 ventas que el clasificador mandó a OB siguen en Descartadas de la pestaña OB
(`docs/OTROS/analizadores/ANALIZADORES.md:255-263`); medido hoy, las 36 OB copiadas vetadas siguen
vetadas, es decir que nada se movió.

**4 · El vínculo con el CRM.** `negocio.analizador_prospectos` no tiene `contacto_id`
(`db/migraciones/056_tablas_del_analizador.sql:34-44`): lo único que une una llamada analizada con un
contacto es el correo, y casa en 28 de 44 prospectos. Ninguna tabla ni función lo resuelve: fuera de
`lib/analizadores/`, las tablas `analizador_*` solo se nombran en el esquema (`lib/datos/esquema.ts`)
y en el borrado de una empresa (`lib/administracion/borrado.ts:146-151`).

**5 · La comparación con Brain.** `scripts/comparar-con-brain.sql` da cero reuniones en común porque
Brain no corre desde el 2026-09-19 (`scripts/comparar-con-brain.sql:16-18`). Decidido el 2026-09-23:
no se reanaliza nada para compararlo (`docs/OTROS/analizadores/ANALIZADORES.md:313-315`).

**6 · Qué quiere decir `PARCIAL`.** 9 de las 10 OB lo dicen, y es también el valor que pone
`normalizeOb` cuando el modelo no manda uno válido (`lib/analizadores/nucleo/ob.ts:315`). El esquema
OB no tiene «no se habló» (`lib/analizadores/rotulos.ts:37-39`), así que hoy no se distingue un
arranque parcial de un tema que no se tocó.

---

## 6 · Reglas propias de esta sección

**1 · Dos compuertas, y la segunda manda.** El clasificador decide en qué pestaña cae; el análisis,
con la transcripción entera, puede decir que no era eso y la llamada queda NOT_MATCH con el motivo
(`lib/analizadores/pipeline.ts:456-459`). Una OTRO es siempre NOT_MATCH: lo exige un `check`
(`db/migraciones/056_tablas_del_analizador.sql:85`), y el informe (la columna `analisis`) existe si
y solo si coincidió (`db/migraciones/056_tablas_del_analizador.sql:164`): un veto propio deja su fila
con sus tokens, pero sin informe.

**2 · Nada se paga dos veces.** La toma es un `update` condicional que exige el estado **y el tipo**
en que se vio la llamada (`lib/analizadores/datos.ts:216-240`); la lista es una foto, y una llamada
que otra corrida terminó mientras tanto se saltea. Vale para la tarea, para el reintento y para el
drenado de la pantalla.

**3 · Una llave rota no es un fallo de la llamada.** Una llave rechazada, una cuenta sin saldo o el
servicio saturado devuelven la llamada a su estado, cortan el drenado y no gastan reintentos
(`lib/analizadores/pipeline.ts:476-482`, `lib/analizadores/datos.ts:354-363`).

**4 · El costo es nulo, nunca cero.** Un 0 diría «no costó nada»
(`lib/analizadores/nucleo/pricing.ts:44-58`, `db/migraciones/056_tablas_del_analizador.sql:173-174`).
Los cuatro contadores de tokens se guardan igual, para calcular hacia atrás el día que haya tarifa
(en lo copiado de Brain, solo entrada y salida: § 4).

**5 · Los datos duros vienen del proveedor, nunca del modelo**: fecha, duración, organizador y enlace
salen de tl;dv (`lib/analizadores/pipeline.ts:343-356`). Y **la transcripción no sale de la base**:
ninguna respuesta de la API la devuelve (`lib/analizadores/datos.ts:623`).

**6 · Solos en su horario y con la función entera.** La tarea de cada hora y el reintento corren sin
otras tareas en su minuto y con 285 s, no con el presupuesto compartido de 180 s: con ese, la guardia
rechazaría todo análisis y las pendientes no se drenarían nunca, sin que nada fallara
(`lib/negocio/barrido.ts:252-269` y `lib/negocio/barrido.ts:330-340`); el reintento recibe el mismo
fin de reloj (`lib/negocio/barrido.ts:727-735`).

**7 · Qué hace cada una de las dos tareas, y qué no.** La de cada hora descubre, drena las PENDING,
completa las fichas que nunca se generaron y, desde AG11 de los agentes, clasifica las objeciones que no tienen
categoría (`lib/analizadores/tarea.ts:75-181`). El reintento toma
las FAILED que no agotaron sus tres intentos y las ANALYZING colgadas hace más de 15 minutos
(`lib/analizadores/datos.ts:848-875`); no descubre, no toca las PENDING ni genera fichas
(`lib/analizadores/tarea.ts:224-230`). Una ficha FAILED no la reintenta nadie: se rehace con el botón.

**8 · Borrar deja lápida**, en la misma transacción: sin ella, la siguiente corrida traería la
reunión de vuelta y la pagaría otra vez (`db/migraciones/056_tablas_del_analizador.sql:223-224`).

**9 · Una DONE no se mueve de pestaña, y lo impide el servidor** (`lib/analizadores/datos.ts:475-515`);
lo que se mueve pierde su análisis y su ficha viejos en la misma transacción.

**10 · Ocho reuniones no son una tasa.** `scripts/medir-analizadores.sql` imprime «66,7 % no es HT» y
«25,0 % no es OB», sobre 3 y 4 casos. El piso del proyecto para publicar una tasa es 10
(`lib/negocio/indicadoresDeCitas.ts:309`); acá solo valen conteos.

**11 · La categoría de una objeción es de un juego cerrado, y vale mientras su texto sea el mismo** (AG11 de los
agentes, `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`). Haiku la pone una vez por llamada, en la tarea
de cada hora: precio, momento, decisor, confianza, encaje u otra. Se guarda en `negocio.objeciones_clasificadas`
(`073`) por posición y por la huella del texto; lo que no se pudo clasificar se pide en la corrida siguiente, y
lo que la cuenta nunca esconde es la cobertura.

---

## 7 · Riesgos

**El riesgo principal: la única auditoría de llamadas de venta del sistema es una isla.** Hay 38 HT
juzgadas —puntaje, objeciones, fases en 35 y ficha OK en 36—, y 22 son de contactos que el resto del
producto conoce. Nada las cruza: ni Sales, ni la ficha del contacto, ni Closer. La tabla de llamadas
del CRM, `negocio.llamadas`, sigue con 0 filas mientras las llamadas juzgadas viven al lado (ver
[05-SALES.md](05-SALES.md)). Y un dato que el cruce mostraría y nadie mira: **ninguno de los 38
informes HT dice `CERRADA`**. No está verificado si es el negocio o la rúbrica.

**El sello se escribe y no lo lee nadie.** `motivoDeLoIncompleto` arma frases como «tl;dv rechazó la
llave: hay que volver a cargarla» (`lib/negocio/barrido.ts:835-855`), y el bucle dice que eso «tiene
que poder leerse desde la pantalla de monitoreo sin abrir un registro»
(`lib/negocio/barrido.ts:576-586`). Pero **ningún archivo de `lib/`, `app/` o `components/` lee
`ultimo_motivo`** fuera del que lo escribe, y la pestaña no muestra frescura (sección 2). Con la llave de
tl;dv revocada, la pestaña no avisaría nada hasta que alguien apriete Sincronizar, que sí lo dice
(`app/api/analizadores/sincronizar/route.ts:38-41`); la tarea de cada hora lo escribiría en un sello
que solo se ve con la consulta de `docs/OTROS/produccion/DESPLIEGUE.md:346` o con
`scripts/medir-analizadores.sql:87-89`.
Tampoco la FAILED de hoy aparece en el sello: una fallida no es un motivo
(`lib/negocio/barrido.ts:853-855` cuenta las que quedaron sin tiempo, no las que fallaron).

**La caché se paga y no se usa.** El sistema del análisis va marcado para cachear
(`lib/analizadores/nucleo/anthropic.ts:215`), y cada análisis escribe su caché (9 774 tokens en HT,
4 456 en OB) para que el siguiente la lea. Con un análisis cada varias horas no la lee ninguno:
**0 tokens de lectura en 7 de 7**. Cuánto cuesta no se sabe, porque no hay tarifa; que el contador de
lectura está en cero, sí.

**El gasto que no queda escrito**: el de cada FAILED y el de cada clasificación (sección 5, punto 1).
Una llamada que el modelo contesta mal cuatro veces —la corrida de la hora y los tres reintentos— se
pagaba cuatro veces sin una sola fila de tokens. **Cerrado en AG2 de los agentes**: son cuatro filas
de `negocio.uso_de_ia`, y los fallos van al Panel de Incidentes con `origen = 'analizador'` —uno por
situación, por paso y por corrida en la tarea y al sincronizar (`lib/incidentes/agrupados.ts`), uno por fallo
cuando una persona aprieta Analizar o pide la ficha—.

**El error de una FAILED lleva datos del cliente.** Al corte, el mensaje guardaba los primeros 200
caracteres de la respuesta del modelo, y un informe OB empieza por los datos del cliente. **Cerrado
en AG2 de los agentes** para las fallas nuevas: un JSON ilegible es `sin_estructura` y el error dice
sólo «El modelo no devolvió JSON parseable.» (`runAnalysis`, `lib/analizadores/nucleo/engine.ts`;
prueba `pruebas/codigo/201-el-error-del-analisis.test.ts`). Las FAILED que ya estaban guardadas
conservan su error hasta que se reintenten. Medido: la única FAILED de hoy tiene en su error el nombre de una persona y de su
empresa. Se guarda hasta 500 caracteres (`lib/analizadores/datos.ts:55`), la lista lo devuelve y la
fila lo dibuja (`components/analizadores/PanelDeAnalizadores.jsx:395`). Para quien la ve es su propia
empresa; para quien mida con SQL, **leer `error` es leer datos personales**: esta foto lo leyó una
vez para saber la causa, y por eso lo sabe, y no lo copia.

**El contador de reintentos no vuelve a cero.** Solo se incrementa (`lib/analizadores/datos.ts:878-886`),
y un `grep` de `reintentos_automaticos` en `lib/`, `app/` y `pruebas/` no encuentra ningún reinicio.
Una llamada que agotó sus tres, se rescató con el botón y más adelante vuelve a fallar ya no entra al
barrido. Hoy afecta a 0 llamadas.

**El reintento solo corre donde hay llave de tl;dv** (`lib/negocio/barrido.ts:526-534`), aunque no la
use: una transcripción pegada a mano que falla en una empresa con solo llave de IA no se reintenta
nunca sola. Hoy hay 0 llamadas en otras empresas.

**El clasificador pierde ventas.** De las 44 que llamó OB en el historial, 12 eran ventas que el
analizador HT nunca vio (`docs/OTROS/analizadores/ANALIZADORES.md:241-248`). Siguen en Descartadas de
OB, y hasta que llegue el mapa de nombres una venta nueva puede seguir el mismo camino.

**Nueve personas ven una pestaña vacía.** En las otras empresas la sección aparece, dice «No hay
llamadas en este filtro» y deja Sincronizar deshabilitado con su motivo en el `title`
(`components/analizadores/PanelDeAnalizadores.jsx:301-309`), que en un teléfono no se ve.

**Los documentos de requisitos quedaron atrás de los hechos.**
`docs/OTROS/analizadores/ANALIZADORES.md:116` dice que falta el hito de 24 h,
`docs/OTROS/analizadores/ANALIZADORES.md:117` y `docs/OTROS/analizadores/ANALIZADORES.md:121` dejan
HT-10 y OB-4 «en curso», y `docs/OTROS/analizadores/ANALIZADORES.md:342` anuncia como futuro lo que
el reintento hizo el 2026-09-24. Los tres commits que tocaron ese archivo después no tocaron esas
líneas: `302fa04` corrigió la del análisis vacío, `e630823` lo mudó a `docs/OTROS/` y `1c55149`
cambió tres rutas.

**Lo que se puede hacer hoy, con evidencia.** Leer el sello en la propia pestaña (el dato existe y
se escribe en cada corrida). Cruzar las HT analizadas con `negocio.contactos` por correo: 22 de 38
casan hoy. Y cargar la tarifa en cuanto se confirme: los cuatro contadores de los 7 análisis
propios ya están, y entrada y salida de los 44 copiados (sin la caché, que Brain no guardaba). Lo que
**no** se puede hacer hoy: ninguna tasa (8 reuniones propias), ninguna comparación con Brain (parado),
y la clasificación por nombre (falta el mapa).

---

## Cómo se midió

Con `node --env-file=.env.supabase scripts/supabase.mjs leer "…"`, el único camino que ve las filas
de `negocio.*` en producción, y siempre con agregados. Las formas, para repetirlas:

- Estados: `select tipo||'/'||estado, count(*) from negocio.analizador_llamadas group by 1`, más la
  misma cuenta partida por `creado_el < '2026-09-23'` y por `proveedor`.
- Análisis propios: `analizado_el - tomada_el`, los cuatro contadores de tokens y `version_de_rubrica`
  de `negocio.analizador_analisis` unida a su llamada, con `analizado_el >= '2026-09-23'`.
- Contadores: `count()` de cada uno de los cuatro contadores de tokens en `analizador_analisis` y
  `analizador_fichas`, partido por `analizado_el >= '2026-09-23'` (o `creado_el`, en las fichas).
- Reintentos: `count(*)` por `estado` y `reintentos_automaticos` donde el estado es FAILED o
  ANALYZING, o el contador pasa de 0.
- Sellos: `ultimo_estado`, `ultima_corrida_el`, `ultimo_motivo` y `ultimas_llamadas` de
  `negocio.tareas_programadas` para `analizadores` y `reintentos`.
- Acceso: `count(distinct u.id)` sobre `identidad.usuarios` activos, sus roles, `roles_permisos` con
  `analizadores.%` y `usuarios_secciones` con `analizadores`.
- El cruce: `count(*)` de `negocio.analizador_prospectos` cuyo `email` existe como
  `lower(btrim(email))` en `negocio.contactos` de la misma organización.
- Y `scripts/medir-analizadores.sql` entero, que no imprime datos de nadie.

Ninguna consulta devolvió títulos, nombres, correos, transcripciones ni texto de un informe; los
correos solo se compararon dentro de un `count`. La única que devolvió `error` lo hizo una vez, para
saber por qué falló la OB de hoy, y lo que trajo no se copia acá.
