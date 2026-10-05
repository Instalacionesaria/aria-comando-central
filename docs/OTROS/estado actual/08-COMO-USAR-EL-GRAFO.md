# Cómo ubicar cualquier cosa: el grafo de conocimiento

> Corte: **2026-09-29** para el grafo; el resto de la carpeta es del 2026-09-28. El grafo se rehízo
> tres veces sobre el commit `1c55149`: la mañana del 2026-09-28, cuando reemplazó al del 2026-09-17
> —que a su vez había pisado el del 2026-09-15 que describía la foto anterior (§ 3)—; el 2026-09-29,
> al extraer esta carpeta reescrita y todavía sin commit; y ese mismo día, con un AST completo del
> código que corrigió lo que la extracción anterior había perdido (§ 3). El de ahora es el último
> (`graphify-out/graph.json` de las 10:10). Se reconstruye, no se edita a mano. Toda cifra sin otra
> fecha se midió el 2026-09-29 sobre ese archivo, con el comando que la acompaña.
>
> **Los 18 archivos de esta carpeta ya están en el grafo** (fila «Esta carpeta en el grafo» de la
> § 1), en la versión que tenían al extraerlos: la de este archivo, la de 00, la de 09 y la de 17 son
> las de antes de retocar estas cifras, y el próximo `update` las vuelve a pedir. Lo que quedó afuera a
> propósito son 43 documentos de otras carpetas de `docs/`, que siguen en el grafo con su versión de la
> mañana (fila «Sin extraer, a propósito»). **Todas las cifras del grafo —lo que se mide sobre
> `graph.json` y sus copias— están en la tabla de la § 1**, y en cada re-extracción se retocan ahí y en
> ningún otro lugar. Fuera de la tabla quedan lo que los comandos de ejemplo de la § 3 imprimieron el
> 2026-09-29, que también puede cambiar, y cifras que no son del grafo (del repositorio, de la
> detección de cambios y de la caché), cada una con su fuente.

Esta carpeta nombra decenas de archivos, funciones y tablas. El grafo es la forma de encontrarlos sin
leer el repositorio entero, y de ver **qué toca qué** antes de cambiar algo. Sirve para ubicar; lo que
contesta se confirma contra el código (§ 5). El índice de la carpeta es [00-MAPA.md](00-MAPA.md).

---

## 1. Qué hay construido, y cuánto mide

| Salida | Qué es |
|---|---|
| `graphify-out/graph.json` | El grafo crudo, para consultarlo desde código |
| `graphify-out/GRAPH_REPORT.md` | El informe: nodos dios, conexiones sorprendentes, las comunidades con su nombre, huecos y preguntas sugeridas |
| `graphify-out/graph.html` | La vista interactiva, sin servidor. **Hoy dibuja comunidades, no nodos**, un punto por comunidad, porque el grafo pasó el tope de nodos de la vista (`MAX_NODES_FOR_VIZ` en `graphify/exporters/html.py`, que se sube con la variable `GRAPHIFY_VIZ_NODE_LIMIT`; no probado). La copia del 2026-09-17 todavía dibuja sus nodos uno por uno (fila «Vista de `graph.html`») |
| `graphify-out/manifest.json` | Qué archivo se extrajo con qué hash: lo que permite re-extraer sólo lo que cambió |
| `graphify-out/.graphify_labels.json` | Los nombres de las comunidades, y a su lado una firma `.sig` que hoy está vieja (§ 3) |
| `graphify-out/.rotulos_heredados.json` y `.rotulos_nuevos.json` | De dónde salió cada nombre del último agrupamiento: los heredados del corte anterior y los que rotuló un subagente (§ 3) |
| `graphify-out/.graphify_old.json` | El grafo de la mañana del 2026-09-28, su única copia: el paso de actualización del skill lo escribe antes de fusionar y lo borra al terminar (§ 3, punto 3) |
| `graphify-out/.graphify_pre_ast.json` | El grafo del 2026-09-29 antes del AST completo, recién extraída esta carpeta: su única copia (§ 3, punto 3) |
| `graphify-out/cost.json` | Los tokens de cada corrida; las tres últimas llevan una nota (`nota`) |
| `graphify-out/AAAA-MM-DD/` | Cortes viejos guardados (§ 3) |

**Las cifras del corte.** Todas en esta tabla, porque se retocan juntas en cada re-extracción. La
columna «Antes» lleva los otros dos cortes de estos dos días —el 2026-09-29 antes del AST completo
(«tras la carpeta») y la mañana del 2026-09-28— y los del 2026-09-17 y el 2026-09-15:

| Qué | 2026-09-29, final (este corte) | Antes | De dónde sale |
|---|---|---|---|
| Nodos | **6854** | 6481 tras la carpeta · 5902 la mañana del 2026-09-28 · 4164 el 2026-09-17 · 3875 en la foto del 2026-09-15 | `g.nodes.length` |
| Aristas | **19569** | 19218 tras la carpeta · 16324 la mañana del 2026-09-28 · 10264 el 2026-09-17 · 9709 el 2026-09-15 | `g.links.length` |
| Comunidades | **244**: 154 heredaron el nombre de la comunidad de «tras la carpeta» con la que comparten más miembros (índice de Jaccard ≥ 0,5; cada una de una comunidad distinta) y 90 las rotuló un subagente. Ninguna se llama como su nodo central; 70 tienen exactamente los mismos miembros que una de «tras la carpeta», y 71 que una de la mañana | 230 tras la carpeta (150 heredadas de la mañana por el mismo método y 80 rotuladas) · 275 la mañana del 2026-09-28, las 275 rotuladas por subagentes · 280 el 2026-09-17 · 228 el 2026-09-15, las 228 con el nombre del nodo central según la foto | valores distintos de `community`; nombres en `.graphify_labels.json`, contra `label_communities_by_hub` (`graphify/cluster.py`); Jaccard contra las comunidades de `.graphify_pre_ast.json` y de `.graphify_old.json` |
| Firma `.sig` de los nombres | **0 de las 244** comunidades de hoy coinciden con su firma guardada | 0 de las 230 tras la carpeta · 0 de las 275 la mañana del 2026-09-28. La firma es del 2026-09-15: 228 firmas, una por comunidad de aquel corte | `community_member_sigs` (`graphify/cluster.py`) sobre `graph.json`, contra `.graphify_labels.json.sig` (§ 3) |
| Nodos con una conexión o ninguna | **1760 de 6854 = 25,68 %** (13 con cero, 1747 con una) | 1359 de 6481 = 20,97 % (13 con cero) tras la carpeta · 1565 de 5902 = 26,52 % (19 con cero) la mañana del 2026-09-28 · 1591 de 4164 = 38,21 % (34 con cero) el 2026-09-17 · 1552 de 3875 = 40,05 % (20 con cero) el 2026-09-15, no re-medible (§ 3) | el primer comando de la § 5 |
| — de dónde sale el cambio | contra «tras la carpeta», **+401**: entraron 384 nodos y los 384 tienen una conexión o ninguna; salieron 11, 5 de ellos con una o ninguna; y de los que siguen, 17 ganaron conexiones y 39 las perdieron. Contra la mañana, **+195**: de los 959 que entraron, 252 (226 menciones de ADR por archivo y 26 de esta carpeta); salieron 7, los 7 con una o ninguna; y de los que siguen, 87 ganaron y 37 perdieron | tras la carpeta contra la mañana, −206: de los 158 que salieron, 148; de los 737 que entraron, 30; y de los que siguen, 90 ganaron conexiones —72 de esta carpeta y 18 menciones de ADR que absorbieron a sus homónimas— y 2 las perdieron | el mismo conteo sobre las copias, cruzado por `id` |
| — los mismos, por tipo de nodo | código 1090 de 3779 (28,8 %) · conceptos 576 de 1826 (31,5 %) · racionales 88 de 1097 (8,0 %) · documentos 6 de 152 (3,9 %) | tras la carpeta: código 1103 de 3779 (29,2 %) · conceptos 162 de 1453 (11,1 %) · racionales 88 de 1097 (8,0 %) · documentos 6 de 152 (3,9 %). La mañana del 2026-09-28: código 1161 de 3771 (30,8 %) · conceptos 314 de 1122 (28,0 %) · racionales 84 de 875 (9,6 %) · documentos 6 de 134 (4,5 %). El 2026-09-17: código 927 de 2965 (31,3 %) · conceptos 546 de 745 (73,3 %) · racionales 107 de 391 (27,4 %) · documentos 11 de 63 (17,5 %) | el mismo conteo, agrupado por `file_type` |
| — los que el informe llama *isolated* | **1302 de 4769 = 27,30 %**: los 1760 menos 370 nodos-archivo y 88 racionales. El denominador son los 6854 nodos menos los 988 nodos-archivo y los 1097 racionales | 887 de 4382 = 20,24 % tras la carpeta · 1066 de 4012 = 26,57 % la mañana del 2026-09-28 | el filtro de *Knowledge Gaps* de `graphify/report.py`, corrido con las funciones de graphify (§ 5) |
| Aristas colgantes | **0 de 19569** | 0 en `.graphify_pre_ast.json`, en `.graphify_old.json` y en los cuatro cortes guardados | el segundo comando de la § 5 |
| Diferencia contra el 2026-09-17 | **+3171 y −481 nodos; +10268 y −963 aristas** | +3140 y −823 nodos, +10504 y −1550 aristas tras la carpeta · +2447 y −709 nodos, +7493 y −1433 aristas la mañana del 2026-09-28 | nodos por `id` contra la copia de `graphify-out/2026-09-28/`; arista = par de extremos sin orden más su relación |
| Diferencia contra la mañana del 2026-09-28 | **+959 y −7 nodos; +3481 y −236 aristas** | +737 y −158 nodos, +3165 y −271 aristas tras la carpeta | lo mismo, contra `.graphify_old.json` |
| Diferencia contra «tras la carpeta» | **+384 y −11 nodos; +742 y −391 aristas**: lo que cambió el AST completo | — | lo mismo, contra `.graphify_pre_ast.json` |
| — los nodos que entraron desde la mañana | 733 de esta carpeta (18 documentos, 485 conceptos, 222 racionales y 8 de código) y 226 menciones de ADR por archivo, de 123 archivos de código: 127 de `app/`, 62 de `pruebas/`, 21 de `lib/`, 13 de `components/` y 3 de `scripts/` y la raíz | los 2447 de la mañana contra el 2026-09-17: por carpeta, 472 de `lib/`, 216 de `pruebas/`, 110 de `components/`, 58 de `app/`, 25 de `db/`, 1538 de `docs/` y 28 de `scripts/` y la raíz · por tipo, 876 de código, 798 conceptos, 661 racionales y 112 documentos | `source_file` y `file_type` de cada `id` nuevo |
| — los nodos que salieron desde la mañana | 7, todos menciones de ADR con un `id` sin archivo (`docref_adr_0505`…), que el AST completo reemplazó por una por archivo; ninguno de un archivo que ya no exista | los 709 de la mañana contra el 2026-09-17: 126 de esta carpeta con su ruta vieja · 331 de otros documentos de `docs/`, 300 de ellos de archivos que ya no existen en esa ruta (movidos a `docs/OTROS/` o borrados) · 127 de `app/` · 62 de `pruebas/` · 31 de `lib/` · 13 de `components/` · 19 de `scripts/` y la raíz | `source_file` de cada `id` que ya no está, contra `fs.existsSync` |
| — las menciones de ADR | **461 nodos** con 75 nombres, de 225 archivos: 432 con el archivo en el `id`, uno por cada ADR que nombra cada archivo de código, y 29 sin él. 430 de los 432 tienen una conexión o ninguna | 88 tras la carpeta (48 con el archivo en el `id`) · 242 la mañana del 2026-09-28 (206) · 418 el 2026-09-17 (389), siempre con los mismos 75 nombres: las pasadas incrementales los fueron fundiendo con su homónimo | nodos con nombre `ADR-NNNN`, por la forma de su `id` |
| — las aristas desde la mañana | entraron 2949 que tocan esta carpeta, 228 de menciones de ADR y 304 entre archivos de código que la mañana no tenía (215 llamadas, 45 referencias, 31 importaciones y 13 llamadas indirectas) · salieron 228 de menciones de ADR (las que ahora van a su nodo por archivo y las de los 7 que salieron), 3 importaciones de `lib/aios/index.js` que ahora son llamadas indirectas entre los mismos nodos, 4 referencias a constantes cuyo nombre existe en dos archivos (`PESTANAS`, `ZONAS`, `LINEAS`) y 1 relación semántica entre `docs/OTROS/analizadores/ANALIZADORES.md` y `ob.ts` | tras la carpeta contra la mañana: entraron 2914 que tocan esta carpeta y 251 de menciones fundidas · salieron esas 251, 19 de los 11 archivos de código re-extraídos (fila siguiente) y 1 relación semántica | la misma comparación, por el `source_file` y el nombre de cada extremo |
| Aristas de los 11 archivos de código re-extraídos hacia otros archivos | **recuperadas**: las 19 que había perdido la extracción de esa pasada (17 llamadas y 2 referencias a tipos) están todas. Las llamadas que salen de esos 11 hacia otro archivo son 31, y 9 de ellas van a `datos()`, desde `cadenaDeCierre.ts`, `calidadDelCreativo.ts`, `recorrido.ts` y `recorridoDelLead.ts` | 10 tras la carpeta, y las 10 iban a otro de los mismos 11 · 27 la mañana del 2026-09-28 | aristas `calls` y `references` con un extremo en esos 11 archivos y el otro en otro archivo |
| Llamadas entre archivos de código | **1787**. A `conIdentidad()` la llaman 91 funciones: entre ellas vuelven a estar 15 que la llamaban el 2026-09-17 y la mañana del 2026-09-28 no tenía | 1555 tras la carpeta · 1571 la mañana del 2026-09-28 · 1400 el 2026-09-17. A `conIdentidad()`: 69 · 69 · 84 | aristas `calls` entre nodos de código de archivos distintos |
| Esta carpeta en el grafo | **734 nodos** de sus 18 archivos (de 26 en éste a 61 en `07-REGLAS-TRANSVERSALES.md`), con 2958 aristas y en 113 de las 244 comunidades. Uno, «Estado actual · 01-ACQUISITION», ya estaba la mañana del 2026-09-28, con 12 aristas y colgado de `docs/acquisition/00-MAPA.md`, y conservó su `id` | los mismos 734, con 2923 aristas, tras la carpeta · 0 la mañana del 2026-09-28 · 127 el 2026-09-17, con la ruta vieja `docs/estado actual/` (de ellos salieron 126, y 1 conservó su `id` bajo otro documento) | `source_file` |
| Nodos dios, en aristas por nodo | `datos()` 331 · `conOrganizacion()` 314 · `exigir()` 195 · `ok()` 174 · `conIdentidad()` 173 · `rechazo()` 155 · el documento de las reglas transversales de esta carpeta 88 · `cerrarClientes()` 86 · el documento de Acquisition de esta carpeta 84 · `cerrarTodo()` 82 | en el mismo orden: tras la carpeta, 322 · 312 · 190 · 174 · 151 · 155 · 88 · 86 · 84 · 82. La mañana del 2026-09-28, 329 · 308 · 188 · 173 · 149 · 154 · no existía · 85 · 12 · 81, con el catálogo de métricas de Acquisition (76) y `pedir()` (71) en el noveno y el décimo lugar; hoy son el 11.º (78) y el 12.º (73). El 2026-09-17, 289 · 260 · 164 · 146 · 157 · 127 para los seis primeros, `cerrarClientes()` 67, `cerrarTodo()` 63 y `pedir()` 56. La foto del 2026-09-15 publicó 278 · 254 · 162 · 144 · 157 · 125 para esos seis | *God Nodes* de `GRAPH_REPORT.md`, lo mismo que `god_nodes` (`graphify/analyze.py`); los cortes anteriores, grado sobre la copia guardada |
| Nodos-archivo más conectados | `contexto.ts` 182 · `capa.ts` 176, fuera de la lista de nodos dios | los mismos 182 y 176 tras la carpeta y la mañana del 2026-09-28 | grado sobre `graph.json` |
| Vista de `graph.html` | **244 puntos**, uno por comunidad (el tope de la vista es de 5000 nodos) | 230 puntos tras la carpeta · 275 la mañana del 2026-09-28 · 4164 nodos, uno por uno, en la copia del 2026-09-17 | `RAW_NODES` de los dos `graph.html` |
| Cortes guardados en `graphify-out/` | — | `2026-08-20/` 359 nodos · `2026-08-21/` 918 · `2026-09-15/` 3687 nodos, 9500 aristas y 218 comunidades (corte del 2026-09-14) · `2026-09-28/` 4164 nodos, 10264 aristas y 280 comunidades (corte del 2026-09-17) · y dos copias que no son carpetas: `.graphify_old.json`, 5902 nodos, 16324 aristas y 275 comunidades (la mañana del 2026-09-28), y `.graphify_pre_ast.json`, 6481, 19218 y 230 (tras la carpeta) | `graph.json` de cada carpeta y las dos copias (§ 3) |
| Corpus que ve graphify | 775 archivos (641 de código, 134 documentos), ~1,62 M palabras | 767 (641 + 126), ~1,57 M palabras, la mañana del 2026-09-28 · 557 (514 + 43), ~1,12 M palabras, del 2026-09-15, no re-medido | `graphify-out/.graphify_incremental.json` |
| Entradas de `manifest.json` | 775, una por archivo del corpus; 43 **sin sello**: con el `semantic_hash` vacío. El AST completo no lo reescribió: es de las 09:40 | 757 la mañana del 2026-09-28: los 767 del corpus menos los 10 de esta carpeta | `manifest.json` |
| Archivos con al menos un nodo | 773 de los 775 del corpus (los otros dos son `.claude/launch.json` y `.claude/settings.local.json`, de configuración); ninguno de ellos falta en el disco y ninguno tiene ruta absoluta | 773 tras la carpeta · 755 la mañana del 2026-09-28 | `source_file` distintos contra `fs.existsSync` |
| Re-extraído el 2026-09-29 | en dos pasos: los 18 de esta carpeta con 5 subagentes y 11 archivos de código por AST (29 de los 72 que la detección dio por nuevos o cambiados: 11 de código y 61 documentos), y después los 641 archivos de código por AST, fusionados con el grafo | 233 archivos de código por AST y 97 documentos con 10 subagentes, la mañana del 2026-09-28 | las notas de las dos corridas en `cost.json`; `.graphify_incremental.json` y `.graphify_detect.json` |
| Tokens del 2026-09-29 | 1.479.338 de entrada (~1,48 M) en dos corridas: 1.365.067 de la extracción de esta carpeta —1.251.037 de los cinco subagentes y el resto, 114.030, del rotulador de sus 80 comunidades, que la nota de la corrida dice incluir— y 114.271 del rotulador de las 90 comunidades del AST completo, que en sí no gastó tokens | 2.248.224 la mañana del 2026-09-28, el total de sus subagentes sin partir · 746.727 el 2026-09-17 | `cost.json`; los cinco subagentes, en `.uso_trozos.json` |
| Sin extraer, a propósito | los otros 43 de los 61 documentos detectados, todos de fuera de esta carpeta: siguen con su versión de la mañana y sin sello, para que el próximo `update` los pida (§ 3) | los 10 que tenía esta carpeta al detectar, la mañana del 2026-09-28: 107 documentos nuevos o cambiados, 97 extraídos | `.graphify_incremental.json` y `manifest.json` |
| Pares tipo/función fundidos en un nodo | **30**, 29 en `lib/` y 1 en `pruebas/`; cada par es un solo nodo (§ 3) | 30 tras la carpeta y la mañana del 2026-09-28 | declaraciones buscadas en `lib/`, `app/`, `components/`, `pruebas/` y `scripts/`, cruzadas con los nodos |
| Aristas entre `lib/auditor/vista.ts` y `app/api/auditoria/route.ts` | **0**: el salto por HTTP no es arista (§ 3) | 0 tras la carpeta y la mañana del 2026-09-28 | aristas cuyos extremos tienen esos `source_file` |
| Nodos de los archivos de credenciales | `lib/credenciales/resolver.ts` 32 · `cifrado.ts` 6 · `refresco.ts` 7 · `scripts/credenciales.mjs` 6 (§ 6) | 30 · 5 · 6 · 6 tras la carpeta · 32 · 6 · 6 · 6 la mañana del 2026-09-28: lo que se mueve son menciones de ADR | `source_file` |

Los 43 documentos sin sello son 12 de `docs/acquisition/`, 9 de `docs/conversion/`, 9 de
`docs/sales/`, 7 de `docs/creative/`, 5 de `docs/leads-portal/` y 1 de `docs/OTROS/especificacion/`.
El informe se regeneró después del AST completo y sigue imprimiendo «29 files» en *Corpus Check*, lo
mismo que `.graphify_detect.json`: lo que la extracción de esta carpeta mandó a extraer (los 11 de
código y los 18 de esta carpeta), no el corpus ni lo detectado (72). Las ~1,62 M palabras de esa
misma línea sí son del corpus entero, y su línea de tokens dice 0, lo que costó el AST.

---

## 2. Los nodos dios: las funciones que sostienen el sistema

Salen del grafo, no de una opinión: son los nodos más conectados, sin contar los nodos-archivo, que
el informe excluye. Van casi en el orden del informe —`ok()` y `rechazo()` comparten fila, y hoy
`conIdentidad()` queda entre las dos—, sin los documentos que se meten entre ellas (abajo); sus
aristas de hoy y de los cortes anteriores están en la fila «Nodos dios» de la tabla de la § 1:

| Función | Dónde vive | Qué significa que esté acá |
|---|---|---|
| `datos()` | `lib/datos/contexto.ts:159` | La capa de datos del inquilino: las lecturas y escrituras de negocio dentro de una organización pasan por el mismo constructor de consultas, que lanza si no hay organización activa (`lib/datos/contexto.ts:151`) |
| `conOrganizacion()` | `lib/datos/contexto.ts:76` | **Toda operación abre el contexto de su organización.** Es la regla `ADR-0202` (`docs/OTROS/especificacion/TRAZABILIDAD.md:55`), y el grafo la confirma: es el segundo nodo más conectado, contando también los nodos-archivo |
| `exigir()` | `lib/autorizacion/portero.ts:167` | El portero: lo nombran 79 de los 82 `route.ts` de `app/api/` (`grep`, 2026-09-28 y otra vez el 2026-09-29); los tres que no son el login, el aviso del CRM y la salud |
| `ok()` / `rechazo()` | `lib/autorizacion/respuesta.ts:313` y `lib/autorizacion/respuesta.ts:324` | La respuesta de éxito y la de rechazo |
| `conIdentidad()` | `lib/datos/capa.ts:125` | El otro contexto: identidad va por su propio camino. Era el único de la lista que había **bajado** desde el 2026-09-17, y ya se sabe por qué: la pasada de la mañana del 2026-09-28 le había perdido llamadas desde otros archivos, y el AST completo se las devolvió (fila «Llamadas entre archivos de código») |
| `cerrarClientes()` | `lib/datos/capa.ts:155` | Cierra los agrupadores de la base (`lib/datos/capa.ts:149`); lo nombran 75 archivos de `pruebas/` |
| `cerrarTodo()` | `pruebas/apoyo/conexiones.ts:65` | Lo mismo del lado del apoyo de pruebas; 81 archivos de `pruebas/` lo nombran |
| `pedir()` | `lib/http/cliente.ts:137` | El cliente del API: toda pantalla lee por acá, y ningún archivo de `components/` ni de `app/` fuera de `app/api/` llama a `fetch`. Su comentario dice ser *«La única función del proyecto que hace una petición HTTP»* (`lib/http/cliente.ts:122`), y ya no lo es: `pedirExterno()` (`lib/http/cliente.ts:329`) y `avisar()` (`lib/deteccion/aviso.ts:94`) también llaman a `fetch` |

El informe pone en el séptimo y el noveno lugar dos nodos que no son funciones, y los dos son
documentos de esta carpeta, extraídos el 2026-09-29: el de las reglas transversales
(`07-REGLAS-TRANSVERSALES.md`) y el de Acquisition (`01-ACQUISITION.md`). Con ellos adentro, los dos
que la mañana del 2026-09-28 cerraban la lista quedaron fuera de los diez: el documento
`Acquisition · Catálogo de métricas` (`docs/acquisition/02-METRICAS.md:1`) y `pedir()`, que sigue en
la tabla por lo que dice de `fetch`. Los grados de los cortes anteriores se midieron sobre las copias
guardadas; los de la foto son los que ella publicó.

Si una función nueva **no** toca `conOrganizacion()` o `exigir()`, eso es la señal para mirarla dos
veces — salvo las rutas públicas y las operaciones de identidad, que la prueba de `ADR-0202` exime
en una lista explícita (`docs/OTROS/especificacion/TRAZABILIDAD.md:55`).

---

## 3. Cómo usarlo

Todo se corre desde la raíz del repositorio. Los tres primeros comandos se corrieron el 2026-09-29
sobre este corte, después del AST completo, y lo que se cuenta de su salida es lo que devolvieron.

### Para encontrar algo

```bash
graphify query "dónde se calcula la tasa de cancelación"
```

Recorre el grafo desde los nodos que casan con la pregunta y contesta con nodos y ubicaciones. Hoy
arranca en cuatro nodos —entre ellos `tasaDeCancelacion()`, `lib/negocio/indicadoresDeCitas.ts:321`—,
encuentra 300 y **muestra 49**: el presupuesto por omisión es de 2000 tokens, la salida avisa el
corte con `[!] TRUNCATED`, y la respuesta puede estar entre lo cortado; `--budget 4000` agranda el
corte, y con él mostró 114 de los mismos 300. Rinde más que un `grep` porque sigue relaciones —quién
llama a quién, qué importa qué—, pero trae ruido: 16 de esos 49 nodos salen de
`docs/OTROS/futuro/icp-interno-calculado.md`, que entró por uno de los cuatro nodos de arranque,
«Un ICP calculado por Comando Central (pendiente, solo documentado)», y otros 9 de esta carpeta, 2
de ellos de este mismo documento. El 2026-09-28, con los mismos cuatro nodos de arranque, encontraba
199 y mostraba 50.

### Para entender un módulo que no conocés

```bash
graphify explain "consumoDelPrecall"
```

Devuelve el nodo, su comunidad y sus aristas con archivo y línea: diez, entre ellas quién lo importa
—la ruta (`app/api/auditoria/route.ts:40`) y su prueba
(`pruebas/base/153-consumo-del-precall.test.ts:24`)— y a quién llama (`datos()`,
`lib/negocio/consumoDelPrecall.ts:161`). Dos de las diez vienen de este documento, que lo nombra, y
una, la llamada a `campoPorNombre()`, apareció con el AST completo; el 2026-09-28 eran siete. Es la
forma más directa de contestar «quién usa esto».

**Pero el nodo que devuelve es dos cosas fundidas en una.** Se llama `ConsumoDelPrecall` y dice vivir
en la línea 104, que es el **tipo** (`lib/negocio/consumoDelPrecall.ts:104`); las aristas son de la
**función** (`lib/negocio/consumoDelPrecall.ts:136`). graphify pasa los identificadores por
`casefold()` (`normalize_id`, en `graphify/ids.py`), así que un tipo y una función que sólo difieren
en la mayúscula inicial terminan en el mismo nodo. Buscando en `lib/`, `app/`, `components/`,
`pruebas/` y `scripts/` aparecen los pares de la fila «Pares tipo/función fundidos en un nodo» de
la § 1 —`CadenaDeCierre`/`cadenaDeCierre`, `LeadsDelPortal`/`leadsDelPortal`,
`DineroDelMes`/`dineroDelMes`…—, y cada par es un solo nodo en el grafo. Contado buscando
`interface|type|class X` y `function x` o `const x = (` en el mismo archivo; no es un conteo
exhaustivo de todas las formas de declarar.

### Para ver qué rompería un cambio

```bash
graphify path "indicadoresDeCitas.ts" "PanelDeConversation"
```

El camino más corto entre dos nodos. **No es el camino de los datos**, y hay que leerlo sabiendo por
qué. Hoy contesta en 3 saltos y el del medio no es código: es la regla 1 de
`07-REGLAS-TRANSVERSALES.md`, «El silencio», que nombra a los dos archivos. El 2026-09-28, antes de
que esta carpeta entrara, también eran 3 saltos, por otro lado: los dos archivos importan
`periodo.ts`. El camino real es otro: `app/api/auditoria/route.ts:37` importa `tasaDeCancelacion`, y
la pantalla lee esa ruta por HTTP: importa `leerLaPantalla` de `lib/auditor/vista.ts`
(`components/conversation/PanelDeConversation.jsx:75`), que pide `RUTA = '/api/auditoria'`
(`lib/auditor/vista.ts:22`). **Ese salto por HTTP no es una arista**: entre `lib/auditor/vista.ts` y
`app/api/auditoria/route.ts` no hay ninguna (fila de esos dos archivos en la § 1). Otro caso, que no
cambió en ninguno de los tres cortes de estos días:
`graphify path "cadenaDeCierre.ts" "PanelDeSales"` cruza por un nodo de documento
(`Sales · Mapa de los requisitos`), no por código.

El 2026-09-28 había un ejemplo de camino que sí era código:
`graphify path "leadsDelPortal.ts" "PanelDeLeadsPortal"` pasaba por `filtrosDelPortal.ts`, que la
pantalla importa de verdad (`components/leads-portal/PanelDeLeadsPortal.jsx:37`). Hoy, también
después del AST completo, cruza por un nodo de este mismo documento —«graphify path: el camino más
corto, que no es el camino de los datos»—, que nombra a los dos. **Extraer documentos acorta los
caminos**: cada documento que nombra dos archivos los deja a dos saltos, y `path` devuelve el más
corto, no el de código.

La receta para «qué rompe esto», entonces: `graphify explain` sobre la función da las rutas y las
pruebas que la importan; la pantalla de cada ruta se busca por su cadena (`'/api/auditoria'`) con
`grep`. Y los nombres repetidos se escriben con su carpeta, porque a secas `path` y `explain` no
eligen el mismo: el 2026-09-29, igual que el 28, `"vista.ts"` resolvió a `lib/vista.ts` en
`graphify path` y a `lib/auditor/vista.ts` en `graphify explain`. Con `"auditor/vista.ts"` o
`"lib/vista.ts"` los dos dan el mismo nodo.

### Para actualizarlo después de trabajar

```bash
graphify update
```

Re-extrae **sólo el código**, por AST y sin gastar tokens: recorre todo el corpus de código, pero lo
que no cambió sale de la caché del AST. El propio comando lo anuncia («no LLM needed») y delega en
`_rebuild_code` (`graphify/watch.py`). Los documentos no: al terminar, el mismo comando manda a
correr `/graphify --update` para ellos, que es la extracción semántica del skill con subagentes: lo
que se llevó los tokens de esta pasada (fila «Tokens del 2026-09-29» de la § 1). Antes de correr
`update` en esta máquina, tres cosas leídas en el código y en el skill, y **no corridas** hoy:

1. **El AST en paralelo pierde archivos acá**, en silencio: cada archivo cuyo proceso muere sale
   como un aviso (`worker failed for …`) y el grafo se construye igual, más chico. La pasada del
   2026-09-28 lo evitó llamando a `extract(..., parallel=False)`, y el AST completo del 2026-09-29
   no perdió ninguno: los dos archivos del corpus sin nodos son de configuración (fila «Archivos con
   al menos un nodo»). `graphify update` no ofrece esa opción, pero con `GRAPHIFY_MAX_WORKERS=1` el
   extractor renuncia al pool y extrae en serie (`_extract_parallel`, en `graphify/extract.py`).
2. **Pisaría los nombres puestos a mano.** `.graphify_labels.json.sig` es del 2026-09-15, con las
   firmas de aquella agrupación, y **ninguna comunidad de hoy** coincide con la suya (fila «Firma
   `.sig` de los nombres» de la § 1). El guardia de `update` y de `cluster-only`
   (`graphify/watch.py` y `graphify/cli.py`) descarta cada nombre cuya firma no coincide y le pone
   el del nodo central: a todas, también a las heredadas y a las rotuladas el 2026-09-29.
3. **Borraría la única copia de la mañana del 2026-09-28.** Ese grafo sólo está en
   `graphify-out/.graphify_old.json`: el paso de actualización del skill copia ahí `graph.json` antes
   de fusionar y lo borra al terminar (`references/update.md` del skill), así que el próximo
   `/graphify --update` lo pisa con el grafo de hoy y después lo borra. `.graphify_pre_ast.json`, la
   copia de «tras la carpeta», no la nombra el skill, pero tampoco la protege nada. El respaldo
   automático, en cambio, ya no amenaza a `graphify-out/2026-09-28/`: usa **una carpeta por día**
   (`backup_if_protected`, en `graphify/export.py`), y la de hoy sería `graphify-out/2026-09-29/`,
   que todavía no existe.

Para el punto 2, la firma se reescribe con la misma función que usa el guardia, desde la raíz y con
un Python que tenga graphify (el de `graphify-out/.graphify_python`). No se corrió la escritura: el
2026-09-29, después del AST completo, se volvió a correr el mismo cálculo sin la última instrucción,
y devolvió una firma por cada comunidad de hoy.

```python
import json
from pathlib import Path
from graphify.cluster import community_member_sigs
g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
c = {}
for n in g['nodes']:
    c.setdefault(n['community'], []).append(n['id'])
Path('graphify-out/.graphify_labels.json.sig').write_text(
    json.dumps({str(k): v for k, v in community_member_sigs(c).items()}), encoding='utf-8')
```

La firma salva sólo las comunidades que el siguiente agrupamiento deje con los mismos miembros:
`update` vuelve a agrupar (`cluster`, en `graphify/watch.py`), y cada comunidad que cambie se
renombra igual con su nodo central, que es lo que el guardia busca. En cada uno de los dos
agrupamientos del 2026-09-29 quedaron con los mismos miembros menos de un tercio (fila
«Comunidades» de la § 1).

Para el 3, alcanza con copiar `.graphify_old.json` y `.graphify_pre_ast.json` a una carpeta propia
antes del próximo `--update`. El nombre de `graphify-out/2026-09-28/` sigue engañando —guarda el
corte del 2026-09-17—, pero ya no corre riesgo.

### Lo que enseñó la pasada del 2026-09-28

- **Un `ast.py` o un `inspect.py` en la carpeta de trabajo rompe graphify.** Un `python -c` —los
  pasos del skill, y cualquier script propio que importe graphify— pone la carpeta actual primera
  en la ruta de módulos (`sys.path[0]` vale `''`), así que el archivo propio tapa al de la biblioteca
  estándar. La pasada lo encontró como un `ImportError` que no nombra al culpable; se reprodujo el
  mismo día al escribir este documento, con un `inspect.py` en la carpeta temporal:
  `graphify/cluster.py` hace `import inspect` y salió un `SyntaxError` desde el archivo ajeno. La
  pista es la última línea del rastro, que muestra la ruta del archivo propio. El comando
  `graphify` no se ve afectado —`graphify explain` corrió bien desde esa misma carpeta—, porque su
  ruta de módulos no empieza en la carpeta actual. Nunca llamar así a un script.
- **Mover un documento de carpeta le borra la caché semántica.** El hash de la caché es el
  contenido **más la ruta relativa** (`file_hash`, en `graphify/cache.py`), así que el mismo texto en
  otra carpeta es otra entrada. La pasada midió 0 aciertos de la caché sobre sus 107 documentos
  nuevos o cambiados (hoy ya no se puede volver a medir: la caché tiene lo extraído), y entre ellos
  están los 20 que el commit `e630823` movió a `docs/OTROS/` sin tocarles una línea —renombres al
  100 %, sin cambios en los commits que siguieron—. Nueve son de esta carpeta y quedaron sin extraer
  a propósito; los otros 11 (de `capa-base/`, `especificacion/`, `futuro/` y `produccion/`) hubo
  que extraerlos de nuevo. Mover es gratis para git y caro para el grafo.
- **`detect_incremental` devuelve rutas absolutas** —las 30 borradas y las 340 nuevas que detectó
  aquella pasada eran `C:\…`, y las 72 nuevas de la del 2026-09-29, que son las que hoy guarda
  `.graphify_incremental.json`, también— y el grafo guarda relativas. La pasada tuvo que pasarle
  `root='.'` a `build_merge` para que podara las borradas. El código trae un respaldo que infiere
  la raíz desde `graphify-out/.graphify_root` (`_infer_merge_root`, en `graphify/build.py`), pero no
  está averiguado por qué no alcanzó: pasarlo explícito es lo seguro. Comprobado sobre el grafo de
  hoy: ningún `source_file` es absoluto ni apunta a un archivo que ya no existe (fila «Archivos con
  al menos un nodo» de la § 1).

### Lo que enseñó la pasada del 2026-09-29

- **Re-extraer por AST un lote chico pierde las aristas hacia archivos de fuera del lote.** La
  extracción de esta carpeta re-extrajo por AST sólo los 11 archivos de código que habían cambiado
  —y sólo en comentarios—, y perdieron 19 aristas hacia otros archivos: las llamadas que quedaron
  iban todas a otro de los mismos 11, y las perdidas, a archivos que no estaban en el lote, como
  `contexto.ts`, donde vive `datos()` (fila «Aristas de los 11 archivos de código re-extraídos» de
  la § 1). **La corrección fue un AST completo**, los 641 archivos de código, que no gasta tokens,
  fusionado con el grafo: las 19 volvieron. Y trajo más de lo que se buscaba: aristas entre archivos
  de código que ni la mañana del 2026-09-28 tenía: aquella pasada también había sido por lote, de
  233 archivos, y es la explicación que cuadra, aunque no se comprobó arista por arista. Entre ellas, las llamadas a `conIdentidad()` que faltaban desde el
  2026-09-17 (fila «Llamadas entre archivos de código»). Después de re-extraer código por AST, lo
  seguro es el AST completo.
- **Las menciones de ADR son una por archivo, y las pasadas incrementales las funden.** El AST
  completo crea un nodo por cada ADR que nombra cada archivo de código, con una sola arista cada uno;
  las pasadas incrementales los venían fundiendo con su homónimo (fila «las menciones de ADR»). Por
  eso volvió a subir la proporción de nodos con una conexión o ninguna, y por eso la del informe
  (*isolated*) es hoy más alta que la mañana (§ 5): no es un grafo peor conectado, son esas
  menciones otra vez sueltas.
- **Los nombres se heredan por miembros, no por número.** Cada agrupamiento nuevo trae otras
  comunidades con otra numeración, y el 2026-09-29 hubo dos. En los dos, cada comunidad se comparó
  con las del corte anterior por el índice de Jaccard —miembros en común sobre miembros en total—:
  las que tienen una comunidad vieja con Jaccard ≥ 0,5 heredaron su nombre, cada una de una
  comunidad distinta, y sólo las demás hubo que rotularlas con un subagente (`.rotulos_heredados.json`
  y `.rotulos_nuevos.json`, que guardan las del último; cuántas, en la fila «Comunidades» de la § 1).
  Medido después: las heredadas son exactamente las que pasan el umbral. Qué nombre tenía cada
  comunidad de los cortes anteriores no quedó en disco, así que no se puede comprobar que cada una
  lleve el de su pareja. El guardia de la firma, en cambio, exige los mismos miembros bajo el mismo
  número (punto 2 de arriba).
- **43 documentos quedaron sin sello a propósito.** Son los que la detección dio por cambiados fuera
  de esta carpeta, y cambiaron en el lugar, sin agregar ni quitar líneas: 660 líneas reescritas contra
  `1c55149`, sobre todo para reapuntar o fechar lo que citaban de esta carpeta, y con eso alguna cifra
  (en bytes, 37 de los 43 sí cambiaron de largo). Quedaron en el grafo con su versión de la mañana.
  Con sello, el grafo daría esa versión por vigente; sin él —`semantic_hash` vacío en su entrada de
  `manifest.json`— `detect_incremental` (`graphify/detect.py`) los cuenta como cambiados, y el
  próximo `update` los vuelve a pedir.

### Dónde hace falta `PYTHONIOENCODING=utf-8`, y dónde no

**Los subcomandos de `graphify` no la necesitan.** Al arrancar, el propio CLI reconfigura su salida
estándar y la de errores a UTF-8 (`_run_cli`, en `graphify/__main__.py`), así que `query`,
`explain`, `path` y `update` escriben bien aunque la salida vaya a un archivo. Comprobado de nuevo
el 2026-09-29, sobre el grafo final: `graphify query "trazabilidad regla identificador prueba"` sin
la variable y redirigido a un archivo escribió la flecha `↔`, que la página de códigos local no
tiene, y terminó con código 0. Ponerla no hace daño.

**Sí hace falta en la reconstrucción completa que el skill corre paso a paso**, porque esos pasos son
`python -c` sueltos que no pasan por ese arranque:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
```

En el `SKILL.md` del skill hay **una sola** redirección de la salida estándar a un archivo (las
demás tiran los errores a `$null` o a `/dev/null`, o los pasan a un tubo): el paso que detecta
archivos imprime su JSON y lo redirige a `graphify-out/.graphify_detect.json`; los cinco pasos que
vuelven a leer ese archivo lo abren exigiendo UTF-8. En Windows, cuando la salida va a un archivo, Python
3.14.4 (el de graphify 0.9.30, el instalado) la codifica en `cp1252`, y esa salida lleva un carácter
no ASCII: el `·` (U+00B7) del aviso de corpus grande que el propio graphify arma —hoy
`Large corpus: 775 files · ~1,616,003 words`—. En `cp1252` es el byte `0xB7`, que suelto no es UTF-8
válido, y el primer paso que lo lee corta con
`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb7`. Reproducido el 2026-09-28 con esa misma
línea impresa y releída, con y sin la variable: sin ella revienta, con ella pasa.

Lo que **no** es el motivo: los acentos de las rutas. En ese punto todavía no hay nombres de nodo, y
el repositorio no tiene ninguna ruta con caracteres no ASCII: 0 de las 787 rutas versionadas
(`git -c core.quotepath=off ls-files | grep -P '[^\x00-\x7F]'`, medido el 2026-09-28).

### Los nombres de las comunidades, y dónde quedan los cortes viejos

Reconstruir **rearma las comunidades desde cero**, y con ellas los nombres. La mañana del 2026-09-28
todas se rotularon a mano con subagentes; el 2026-09-29, en los dos agrupamientos, la mayoría heredó
el nombre del corte anterior («Login, segundo factor y contraseña») y al resto lo rotuló un subagente
(«Portero y respuestas de rutas API»; cuántas de cada una, en la fila «Comunidades» de la § 1). No
hay otro camino porque `graphify label` necesita un proveedor de IA configurado y acá no hay: sin él
avisa «no LLM backend configured» (`generate_community_labels`, en `graphify/llm.py`) y deja a cada
comunidad con el nombre de su nodo central (`label_communities_by_hub`, en `graphify/cluster.py`,
que `graphify/cli.py` aplica antes de pedirle nombres al proveedor). Copiar los nombres de un corte
anterior por número tampoco sirve: el número de una comunidad no dice que sea la misma. Por miembros
sí («Lo que enseñó la pasada del 2026-09-29»).

Los cortes que hay en disco, todos sin aristas colgantes (sus tamaños, en la fila «Cortes
guardados» de la § 1):

- `graphify-out/2026-08-20/` y `graphify-out/2026-08-21/`: los dos primeros, con su
  `GRAPH_REPORT.md`, sus nombres y su `manifest.json`.
- `graphify-out/2026-09-15/`: el corte del **2026-09-14** (`graph.json` de ese día, sobre el commit
  `a0e1eb5`), con su `GRAPH_REPORT.md` y sus nombres. La fecha de la carpeta es la del día que la
  reconstrucción pisó el grafo, no la del grafo que está adentro.
- `graphify-out/2026-09-28/`: el corte del **2026-09-17**, con un nombre por comunidad, construido
  sobre el commit `c8494e6`. Tiene `graph.json`, `graph.html`, `.graphify_labels.json` y
  `cost.json`, y **no** tiene `GRAPH_REPORT.md` ni `manifest.json`: no lo escribió el respaldo
  automático, que nunca copia `graph.html` y sí copia el informe.
- `graphify-out/.graphify_old.json`: el grafo de la **mañana del 2026-09-28**, y
  `graphify-out/.graphify_pre_ast.json`, el del **2026-09-29 antes del AST completo**, los dos sobre
  el mismo commit `1c55149` que el de hoy y sin informe ni nombres (de los nombres de entonces sólo
  quedan los que se heredaron). No son carpetas, y corren el riesgo del punto 3 de arriba.

**El corte del 2026-09-15 que describía la foto anterior no está guardado**: lo pisó la
actualización del 2026-09-17 sin dejar carpeta. Por eso su porcentaje de nodos con una conexión o
ninguna no se puede volver a medir.

---

## 4. Qué cambió en el grafo desde el 2026-09-17

Del 2026-09-17 a la mañana del 2026-09-28 entró, sobre todo, lo construido en esas dos semanas, y
más documentos que código; más de la mitad de lo que salió eran nodos de documentos que cambiaron de
ruta —esta carpeta y las que el commit `e630823` llevó a `docs/OTROS/`— o que se borraron (el
desglose, en la columna «Antes» de las filas «los nodos que entraron desde la mañana» y «los nodos
que salieron desde la mañana» de la § 1).

El 2026-09-29 hubo dos cambios. La extracción de esta carpeta trajo casi todos los nodos y las
aristas nuevas del día, y dejó dos daños: fundió menciones de ADR con su homónima y les perdió
aristas a los archivos de código que re-extrajo. El AST completo deshizo los dos y agregó aristas
entre archivos de código que faltaban desde antes (§ 3). Las cifras, contra la mañana, contra el
2026-09-17 y entre los dos pasos del día, en las filas «Diferencia» de la § 1. Medido comparando `id`
contra `.graphify_pre_ast.json`, `.graphify_old.json` y la copia de `graphify-out/2026-09-28/`.

---

## 5. Lo que el grafo NO garantiza, y hay que saberlo

**Uno de cada cuatro nodos, algo más, tiene una conexión o ninguna** (la cifra exacta, la de los
cortes anteriores y la que publicó la foto del 2026-09-15, en la fila «Nodos con una conexión o
ninguna» de la § 1). Medido sobre el grafo entero con:

```bash
node -e "const g=require('./graphify-out/graph.json');const d={};g.nodes.forEach(n=>d[n.id]=0);g.links.forEach(l=>{d[l.source]++;d[l.target]++});const p=g.nodes.filter(n=>d[n.id]<=1).length;console.log(p,'de',g.nodes.length,'=',(p/g.nodes.length*100).toFixed(2)+'%')"
```

**Lo que mueve esa proporción son los conceptos**, que incluyen los nodos que saca la extracción
semántica de los documentos y las menciones de ADR que el AST saca del código. Del 2026-09-17 a la
mañana del 2026-09-28, entre los conceptos, los de una conexión o ninguna pasaron de casi tres de
cada cuatro a menos de un tercio, y entre los racionales, de uno de cada cuatro a uno de cada diez,
mientras los de código casi no se movieron: la cantidad casi no cambió, lo que creció fue el grafo
alrededor. El 2026-09-29 bajó al extraer esta carpeta y volvió a subir con el AST completo, y en los
dos pasos por las menciones de ADR: la extracción de la carpeta las fundió y el AST completo las
volvió a separar, una por archivo y con una sola arista cada una (filas «de dónde sale el cambio» y
«las menciones de ADR» de la § 1). Qué hizo mejor la extracción de documentos no está medido.

El informe dice otro número —«… isolated node(s) … These have ≤1 connection», en su sección
*Knowledge Gaps*— y no se contradicen: **el del informe es ese mismo conjunto después de sacar los
nodos-archivo y los racionales** (el filtro de la sección de huecos, en `graphify/report.py`). El
filtro también dice sacar los «conceptos», pero con la definición de `_is_concept_node`
(`graphify/analyze.py`): nodos sin archivo de origen, o con uno sin extensión. Hoy no hay ninguno
así, y los conceptos de los documentos y las menciones de ADR, que sí tienen su archivo, **siguen
adentro**. Reproducido hoy con las funciones de graphify: el conjunto filtrado queda entero dentro
del conjunto del comando de arriba, y su denominador es el grafo sin nodos-archivo ni racionales,
que el informe no publica (las tres cifras, en la fila «los que el informe llama *isolated*» de la
§ 1).

El informe nombra las dos causas posibles sin decidir entre ellas: aristas que faltan, o componentes
que nadie documentó. Dos huecos sí están medidos, y son de los que un conteo de grado no puede ver
porque les pasan a nodos bien conectados: el salto por HTTP entre una pantalla y su ruta, que no es
arista, y los pares tipo/función fundidos en un solo nodo (los dos en la § 3, y sus cifras en la
§ 1). Un tercero, las aristas que pierde re-extraer por AST un lote chico, quedó medido y corregido
el 2026-09-29 (§ 3). Del resto no hay medición.

Lo que sí está medido es que las aristas que existen cierran: todas tienen sus dos extremos entre
los nodos del grafo, **ninguna cuelga**. Comprobado con:

```bash
node -e "const g=require('./graphify-out/graph.json');const ids=new Set(g.nodes.map(n=>n.id));console.log(g.links.filter(e=>!ids.has(e.source)||!ids.has(e.target)).length)"
```

→ `0`. Los cuatro cortes guardados en `graphify-out/`, `.graphify_old.json` y
`.graphify_pre_ast.json` (§ 3) dan `0` con el mismo comando cambiando la ruta: no hay ningún corte
en disco con aristas colgantes.

Consecuencia práctica: **el grafo sirve para ubicar y para explorar, no para afirmar que algo NO
existe.** Si una consulta no devuelve nada, eso no prueba la ausencia: hay que comprobarlo contra el
código o contra la base. Hasta el 2026-09-29 el ejemplo más a mano era esta misma carpeta, que el
grafo no conocía; ese mismo día, entre la extracción de la carpeta y el AST completo, lo fueron las
llamadas de `cadenaDeCierre.ts` a `datos()`, que existían en el código y no en el grafo. Hoy lo son los 43 documentos sin sello, de los
que el grafo sabe lo que decían la mañana del 2026-09-28.

**Y no reemplaza a la base.** El grafo conoce el código y los documentos, no los datos. Para
cualquier pregunta sobre cobertura, volumen o vocabulario real, la respuesta sale de una consulta de
sólo lectura:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select ..."
```

---

## 6. Una nota sobre `.graphifyignore`

El repositorio tiene un `.graphifyignore` que **rescata** `lib/credenciales/` y
`scripts/credenciales.mjs` de la regla `credenciales*` del `.gitignore`, que los escondía por
prefijo. Sin él el grafo quedaba ciego justo en el resolvedor de credenciales y el cifrado, la parte
donde una pregunta sobre seguridad se responde mal si falta contexto. El motivo completo está en el
propio archivo.

**Desde el 2026-09-23 la mitad de ese rescate está repetida.** El commit `05534de` agregó
`!lib/credenciales/` al propio `.gitignore`, así que git ya no esconde esa carpeta; lo que sigue
escondido es `scripts/credenciales.mjs`: medido el 2026-09-28 con `git check-ignore --no-index -v`,
esa ruta todavía cae en `credenciales*` y las de `lib/credenciales/` ya no. graphify lee los dos
archivos juntos y gana la última regla que casa (`_load_graphifyignore`, en `graphify/detect.py`),
así que la regla de la carpeta debería sobrar; no se probó sacándola. El comentario del
`.graphifyignore` sigue diciendo que el `.gitignore` esconde la carpeta, y eso quedó viejo. Hoy el
grafo ve los cuatro archivos, cada uno con sus nodos (fila «Nodos de los archivos de credenciales»
de la § 1).
