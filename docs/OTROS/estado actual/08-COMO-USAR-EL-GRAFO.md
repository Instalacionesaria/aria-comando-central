# Cómo ubicar cualquier cosa: el grafo de conocimiento

> Corte: **2026-10-18** para el documento, con el grafo del **2026-10-11**: `graphify-out/graph.json`
> de las 18:19, construido sobre el commit `253cc79` (su campo `built_at_commit`) y no rehecho desde
> entonces. `graphify-out/` no está versionado (está en el `.gitignore`): cada máquina tiene el suyo, y
> éste describe el de la máquina donde se escribió. Se reconstruye, no se edita a mano. Toda cifra del
> grafo sin otra fecha se midió el 2026-10-16 sobre ese archivo, que el 2026-10-18 seguía siendo el mismo, y **todas están en la tabla de la
> § 1**, que es lo único que se retoca en cada re-extracción. Fuera de la tabla quedan lo que
> imprimieron los comandos de ejemplo de la § 3, corridos el 2026-10-16 sobre este mismo grafo, y
> cifras que no son del grafo (del repositorio, del disco y de la caché), cada una con su fuente.
>
> **Lo que el grafo no tiene**: todo lo que entró después de `253cc79`. Borrar un hilo de
> CONVERSACIONES (`f59cf44`, 2026-10-12); la miniatura por la pieza del anuncio (`66d88de`) y Meta M-1
> a M-4 (`cce2d56` y `972972e`, 2026-10-15: `lib/meta/`, `lib/negocio/recolectarActivos.ts` y la
> migración `078`); y, sólo en local y sin subir, el modelo de datos multiempresa: los ocho commits del
> 2026-10-16 (migraciones `079` a `084`) y la carpeta `docs/modelo de datos/`, todavía sin versionar.
> Creative CF-5 **sí** está: sus commits (`fefffa1` y `f598d7d`) son anteriores a `253cc79`. Tampoco
> tiene las versiones de hoy de esta carpeta: los 18 archivos están en el grafo con su texto del
> 2026-10-11, y 14 ya habían cambiado el 2026-10-18, a mitad de esta reescritura (fila «Lo que cambió en disco
> después del grafo»). Cómo se pone al día y qué cuesta, en la § 3.

### Desde el corte del 2026-09-29

- **El grafo se rehízo entero el 2026-10-11**, no con un `update`: 1085 archivos, todos extraídos de
  nuevo (`graph.json` a las 18:19, el informe y los nombres a las 18:21, `manifest.json` y
  `cost.json` a las 18:22). Pasó de 6854 nodos, 19569 aristas y 244 comunidades a 7999, 22107 y 353.
- **El grafo final del 2026-09-29 ya no está en disco.** La corrida completa no dejó carpeta de
  respaldo (§ 3), así que las diferencias de la § 1 se miden contra la copia más cercana que quedó,
  `.graphify_pre_ast.json` (el 2026-09-29 antes del AST completo), y las cifras del 2026-09-29 de la
  columna «Antes» son las que publicó el corte anterior, no re-medibles.
- **Ya no hay documentos sin sello**: los 43 que quedaron así a propósito el 2026-09-29 se extrajeron
  en la corrida completa, y las 1085 entradas de `manifest.json` tienen su `semantic_hash`.
- **Los nodos dios son los mismos seis primeros**, más conectados; los dos documentos de esta carpeta
  que se habían metido en los diez salieron, y entró el de trazabilidad de la especificación (§ 2).
- **Esta carpeta quedó en el grafo con menos de la mitad de nodos** (343 contra 734): la extracción
  del 2026-10-11 la partió en menos conceptos.
- **El nodo fundido de un par tipo/función ahora suele llevar el nombre de la función**, no el del
  tipo, y los pares contados pasaron de 30 a 69 (§ 3).
- **Los tres caminos de ejemplo de `graphify path` siguen cruzando por documentos**, por otros nodos
  (§ 3).
- Citas reapuntadas al código de hoy: `datos()` y `conOrganizacion()` bajaron en `contexto.ts` con el
  paso 1 del modelo de datos (`d424d8b`), `pedirExterno()` en `cliente.ts` con Meta M-1, y `ok()` y
  `rechazo()` una línea en `respuesta.ts`. Los conteos con `grep` de la § 2, re-medidos.
- **Un cuarto cuidado antes de actualizar**: guardar el grafo de hoy, porque los pasos del skill no
  dejan respaldo (§ 3, punto 4).

Esta carpeta nombra decenas de archivos, funciones y tablas. El grafo es la forma de encontrarlos sin
leer el repositorio entero, y de ver **qué toca qué** antes de cambiar algo. Sirve para ubicar; lo que
contesta se confirma contra el código (§ 5), y más todavía con un grafo de hace una semana. El índice
de la carpeta es [00-MAPA.md](00-MAPA.md).

---

## 1. Qué hay construido, y cuánto mide

| Salida | Qué es |
|---|---|
| `graphify-out/graph.json` | El grafo crudo, para consultarlo desde código. Trae también 46 hiperaristas (`hyperedges`, relaciones de grupo) |
| `graphify-out/GRAPH_REPORT.md` | El informe: nodos dios, conexiones sorprendentes, ciclos de importación, hiperaristas, las comunidades con su nombre, huecos y preguntas sugeridas |
| `graphify-out/graph.html` | La vista interactiva, sin servidor. **Dibuja comunidades, no nodos**, un punto por comunidad, porque el grafo pasa el tope de la vista (`MAX_NODES_FOR_VIZ`, 5000, en `graphify/exporters/html.py`, que se sube con la variable `GRAPHIFY_VIZ_NODE_LIMIT`; no probado). La copia del 2026-09-17 todavía dibuja sus nodos uno por uno (fila «Vista de `graph.html`») |
| `graphify-out/manifest.json` | Qué archivo se extrajo con qué hash: lo que permite re-extraer sólo lo que cambió |
| `graphify-out/.graphify_labels.json` | Los nombres de las 353 comunidades, del 2026-10-11, y a su lado una firma `.sig` que sigue siendo del 2026-09-15 (§ 3) |
| `graphify-out/.rotulos_heredados.json` y `.rotulos_nuevos.json` | Del **2026-09-29**, no del último agrupamiento: los 154 nombres heredados y los 90 rotulados de aquel día. La corrida del 2026-10-11 no los reescribió |
| `graphify-out/.graphify_old.json` | El grafo de la mañana del 2026-09-28, su única copia: el paso de actualización del skill lo escribe antes de fusionar y lo borra al terminar (§ 3, punto 3). La corrida completa del 2026-10-11 no lo tocó |
| `graphify-out/.graphify_pre_ast.json` | El grafo del 2026-09-29 antes del AST completo: su única copia, y hoy la más cercana al corte anterior |
| `graphify-out/.graphify_incremental.json` | La última detección incremental, del **2026-09-29**: 775 archivos y 72 nuevos o cambiados. Vieja: la corrida completa no la reescribió |
| `graphify-out/cost.json` | Los tokens de cada corrida; las del 2026-09-28 y las dos del 2026-09-29 llevan una nota (`nota`), la del 2026-10-11 no |
| `graphify-out/AAAA-MM-DD/` | Cortes viejos guardados (§ 3) |

**Las cifras del corte.** Todas en esta tabla, porque se retocan juntas en cada re-extracción. La
columna «Antes» lleva lo que publicó el corte del 2026-09-29 sobre su grafo final —que ya no está en
disco— y, donde sirve, las copias que sí quedaron:

| Qué | 2026-10-11 (este grafo) | Antes | De dónde sale |
|---|---|---|---|
| Nodos | **7999** | 6854 el 2026-09-29 · 6481 en `.graphify_pre_ast.json` · 5902 la mañana del 2026-09-28 · 4164 el 2026-09-17 · 3875 en la foto del 2026-09-15 | `g.nodes.length` |
| Aristas | **22107**: 21515 `EXTRACTED`, 588 `INFERRED` (confianza media 0,79, según el informe) y 4 `AMBIGUOUS` | 19569 el 2026-09-29 · 19218 · 16324 · 10264 · 9709, en el mismo orden | `g.links.length`, por `confidence` |
| Nodos por tipo | código 5516 · conceptos 1603 · racionales 650 · documentos 217 · imágenes 13 | el 2026-09-29: código 3779 · conceptos 1826 · racionales 1097 · documentos 152 | `file_type` |
| Comunidades | **353**, 271 en el informe y 82 *thin* (menos de tres nodos que no sean de archivo) omitidas. Según las notas de la corrida, 113 heredaron el nombre de una comunidad del 2026-09-29 con Jaccard ≥ 0,5 y 240 las rotularon tres subagentes; ese reparto no quedó en disco. Lo que sí se mide: 121 de los 353 nombres son textualmente uno de los 244 del 2026-09-29, ninguno es el de su nodo central, y hay 349 nombres distintos | 244 el 2026-09-29 (154 heredadas, 90 rotuladas) · 230 en `.graphify_pre_ast.json` · 275 la mañana del 2026-09-28 · 280 el 2026-09-17 · 228 el 2026-09-15 | valores distintos de `community`; nombres en `.graphify_labels.json`, contra `.rotulos_heredados.json` y `.rotulos_nuevos.json` y contra `label_communities_by_hub` (`graphify/cluster.py`) |
| Firma `.sig` de los nombres | **0 de las 353** comunidades coinciden con su firma guardada | 0 de las 244 el 2026-09-29. La firma es del 2026-09-15: 228 firmas, una por comunidad de aquel corte | `community_member_sigs` (`graphify/cluster.py`) sobre `graph.json`, contra `.graphify_labels.json.sig` (§ 3) |
| Nodos con una conexión o ninguna | **2586 de 7999 = 32,33 %** (24 con cero, 2562 con una) | 1760 de 6854 = 25,68 % el 2026-09-29 · 1359 de 6481 = 20,97 % · 1565 de 5902 = 26,52 % · 1591 de 4164 = 38,21 % · 1552 de 3875 = 40,05 % el 2026-09-15, no re-medible (§ 3) | el primer comando de la § 5 |
| — los mismos, por tipo de nodo | código 1670 de 5516 (30,3 %) · conceptos 766 de 1603 (47,8 %) · racionales 138 de 650 (21,2 %) · documentos 12 de 217 (5,5 %) · imágenes 0 de 13 | el 2026-09-29: código 1090 de 3779 (28,8 %) · conceptos 576 de 1826 (31,5 %) · racionales 88 de 1097 (8,0 %) · documentos 6 de 152 (3,9 %) | el mismo conteo, agrupado por `file_type` |
| — las menciones de ADR | **513 nodos** con 75 nombres, de 258 archivos, todos conceptos: 485 con el archivo en el `id` y 28 sin él. **Los 513 tienen una conexión o ninguna**: sin ellos, los nodos de una o ninguna son 2073, y entre los conceptos, 253 de 1090 | 461 el 2026-09-29 (432 con el archivo en el `id`), de 225 archivos, con los mismos 75 nombres | nodos con nombre `ADR-NNNN`, por la forma de su `id` |
| — los que el informe llama *isolated* | **1869 de 5937 = 31,48 %**: los 2586 menos 579 que graphify cuenta como nodos-archivo y 138 racionales. El denominador son los 7999 nodos menos los 1412 que `_is_file_node` (`graphify/analyze.py`) da por nodos-archivo —los de archivo y también las funciones con una sola arista— y los 650 racionales | 1302 de 4769 = 27,30 % el 2026-09-29 | el filtro de *Knowledge Gaps* de `graphify/report.py`, corrido con las funciones de graphify (§ 5) |
| Aristas colgantes | **0 de 22107** | 0 en `.graphify_pre_ast.json`, en `.graphify_old.json` y en los cuatro cortes guardados | el segundo comando de la § 5 |
| Diferencia contra el 2026-09-29 | **no medible**: esa copia no está | — | — |
| Diferencia contra `.graphify_pre_ast.json` | **+3558 y −2040 nodos; +10249 y −7360 aristas** | — | nodos por `id`; arista = par de extremos sin orden más su relación |
| — los nodos que entraron | por carpeta, 928 de `lib/`, 706 de `pruebas/`, 344 de `app/`, 229 de `components/`, 52 de `db/`, 46 de `scripts/`, 33 de `public/`, 19 de `brand/` y 1181 de `docs/` (258 de esta carpeta) · por tipo, 1898 de código, 1171 conceptos, 362 racionales, 114 documentos y 13 imágenes | — | `source_file` y `file_type` de cada `id` nuevo |
| — los nodos que salieron | 1925 de documentos de `docs/`, re-extraídos con otros `id` (650 de esta carpeta, 363 de `docs/acquisition/`, 282 de `docs/leads-portal/`…), 69 de `components/`, 28 de `tools/` y 18 de `pruebas/`, entre otros. 20 eran de 11 archivos que ya no existen | — | `source_file` de cada `id` que ya no está, contra el disco |
| Diferencia contra el 2026-09-17 | **+4604 y −769 nodos** | +3171 y −481 el 2026-09-29 | lo mismo, contra la copia de `graphify-out/2026-09-28/` |
| Llamadas entre archivos de código | **2883**. A `conIdentidad()` la llaman 126 funciones | 1787 el 2026-09-29, y 91 a `conIdentidad()` | aristas `calls` entre nodos de código de archivos distintos |
| Esta carpeta en el grafo | **343 nodos** de sus 18 archivos (de 8 en `02-CREATIVE.md` y `03-CONVERSION.md` a 50 en `07-REGLAS-TRANSVERSALES.md`; 32 de éste): 211 conceptos, 93 racionales, 34 documentos y 5 de código, con 836 aristas y en 65 de las 353 comunidades | 734 nodos, 2958 aristas y 113 de las 244 comunidades el 2026-09-29 | `source_file` |
| Nodos dios, en aristas por nodo | `datos()` 485 · `conOrganizacion()` 436 · `exigir()` 276 · `ok()` 235 · `conIdentidad()` 233 · `rechazo()` 217 · `cerrarClientes()` 122 · `cerrarTodo()` 115 · el documento de trazabilidad de la especificación 88 · `pedir()` 77 | el 2026-09-29: `datos()` 331 · `conOrganizacion()` 314 · `exigir()` 195 · `ok()` 174 · `conIdentidad()` 173 · `rechazo()` 155 · el documento de las reglas transversales de esta carpeta 88 · `cerrarClientes()` 86 · el de Acquisition de esta carpeta 84 · `cerrarTodo()` 82, con `pedir()` 12.º (73). El 2026-09-17, 289 · 260 · 164 · 146 · 157 · 127 para los seis primeros | *God Nodes* de `GRAPH_REPORT.md`, lo mismo que `god_nodes` (`graphify/analyze.py`) |
| Documentos más conectados | el de trazabilidad 88 · el guion de despliegue 58 · el de los analizadores HT y OB 46 · el de las reglas transversales de esta carpeta 45 | el 2026-09-29, el de las reglas transversales 88 y el de Acquisition 84 | grado de los nodos `document` |
| Nodos-archivo más conectados | `contexto.ts` 277 · `capa.ts` 229, fuera de la lista de nodos dios | 182 y 176 el 2026-09-29 | grado sobre `graph.json` |
| Vista de `graph.html` | **353 puntos**, uno por comunidad (el tope de la vista es de 5000 nodos) | 244 puntos el 2026-09-29 · 4164 nodos, uno por uno, en la copia del 2026-09-17 | `RAW_NODES` de los dos `graph.html` |
| Cortes guardados en `graphify-out/` | — | `2026-08-20/` 359 nodos y 453 aristas · `2026-08-21/` 918 y 1679 · `2026-09-15/` 3687 nodos, 9500 aristas y 218 comunidades (corte del 2026-09-14) · `2026-09-28/` 4164, 10264 y 280 (corte del 2026-09-17) · y dos copias que no son carpetas: `.graphify_old.json`, 5902, 16324 y 275 (la mañana del 2026-09-28), y `.graphify_pre_ast.json`, 6481, 19218 y 230 (el 2026-09-29 antes del AST completo). **Ninguna del 2026-09-29 final ni del 2026-10-11** | `graph.json` de cada carpeta y las dos copias (§ 3) |
| Corpus que ve graphify | **1085 archivos** (879 de código, 193 documentos y 13 imágenes), ~2,04 M palabras | 775 (641 de código y 134 documentos), ~1,62 M palabras, el 2026-09-29 | *Corpus Check* de `GRAPH_REPORT.md`; el reparto, `classify_file` (`graphify/detect.py`) sobre `manifest.json` |
| Entradas de `manifest.json` | 1085, una por archivo del corpus; **0 sin sello** | 775, 43 sin sello, el 2026-09-29 | `manifest.json` |
| Archivos con al menos un nodo | **1085 de 1085**; ninguno falta en el disco y ninguno tiene ruta absoluta | 773 de 775 el 2026-09-29 | `source_file` distintos, contra el disco |
| Extraído el 2026-10-11 | todo: los 879 de código por AST en serie, sin pérdida, y los documentos; según las notas de la corrida, 163 sin caché semántica, con 12 subagentes en trozos de hasta ~45 mil palabras, y 1655 aristas semánticas descartadas porque apuntaban a nodos que nadie definió | el 2026-09-29, en dos pasos: los 18 de esta carpeta con 5 subagentes más 11 de código, y después los 641 de código por AST | `manifest.json`; el reparto de documentos y subagentes no quedó en disco |
| Tokens del 2026-10-11 | **2.928.223** de entrada (~2,93 M), en una corrida de 1085 archivos | 1.479.338 el 2026-09-29, en dos corridas · 2.248.224 la mañana del 2026-09-28 · 746.727 el 2026-09-17 | `cost.json`, lo mismo que la línea *Token cost* del informe |
| Lo que cambió en disco después del grafo | **62 archivos del corpus con otro contenido** el 2026-10-18 (30 `.md` —14 de esta carpeta, que se está reescribiendo—, 26 `.ts`, 3 `.jsx`, 1 `.sql`, 1 `.mjs` y 1 `.json`), ninguno borrado, y **~53 nuevos**: 30 de `docs/modelo de datos/` (20 `.md` y 10 `.sql`), 7 migraciones (`078` a `084`), 3 de `lib/meta/`, 5 de `pruebas/`, 2 de `db/arranque/`, `lib/negocio/recolectarActivos.ts`, la ruta y la pantalla de la conexión con Meta, `docs/creative/17-CONECTAR-META-PASO-A-PASO.md` y 2 `.json` | — | md5 de cada archivo contra el `ast_hash` de `manifest.json`; los nuevos, `git ls-files --cached --others --exclude-standard` fuera del manifiesto, con las extensiones del corpus. Aproximado: la detección de graphify puede descartar alguno (los dos `.json`, por ejemplo) |
| Pares tipo/función fundidos en un nodo | **69**, 62 en `lib/` y 7 en `pruebas/`; cada par es un solo nodo, que lleva el nombre de la función en 62 y el del tipo en 7 (§ 3) | 30 el 2026-09-29, con el nombre del tipo en el ejemplo de la § 3 | declaraciones buscadas en `lib/`, `app/`, `components/`, `pruebas/` y `scripts/`, cruzadas con los nodos |
| Aristas entre `lib/auditor/vista.ts` y `app/api/auditoria/route.ts` | **0**: el salto por HTTP no es arista (§ 3) | 0 el 2026-09-29 | aristas cuyos extremos tienen esos `source_file` |
| Nodos de los archivos de credenciales | `lib/credenciales/resolver.ts` 37 · `cifrado.ts` 6 · `refresco.ts` 7 · `scripts/credenciales.mjs` 6 (§ 6) | 32 · 6 · 7 · 6 el 2026-09-29 | `source_file` |

---

## 2. Los nodos dios: las funciones que sostienen el sistema

Salen del grafo, no de una opinión: son los nodos más conectados, sin contar los nodos-archivo, que
el informe excluye. Van en el orden del informe, sin el documento que se mete entre ellas (abajo); sus
aristas de hoy y de los cortes anteriores están en la fila «Nodos dios» de la tabla de la § 1. Las
líneas son las del código de hoy: donde el archivo cambió después del 2026-10-11, el grafo todavía
dice la vieja (para `datos()`, `L159`).

| Función | Dónde vive | Qué significa que esté acá |
|---|---|---|
| `datos()` | `lib/datos/contexto.ts:257` | La capa de datos del inquilino: las lecturas y escrituras de negocio dentro de una organización pasan por el mismo constructor de consultas, que lanza si no hay organización activa (`lib/datos/contexto.ts:299`) |
| `conOrganizacion()` | `lib/datos/contexto.ts:156` | **Toda operación abre el contexto de su organización.** Es la regla `ADR-0202` (`docs/OTROS/especificacion/TRAZABILIDAD.md:55`), y el grafo la confirma: es el segundo nodo más conectado, contando también los nodos-archivo |
| `exigir()` | `lib/autorizacion/portero.ts:168` | El portero: lo nombran 108 de los 111 `route.ts` de `app/api/` (`grep`, 2026-10-16; eran 79 de 82 el 2026-09-29); los tres que no son el login, el aviso del CRM y la salud |
| `ok()` / `rechazo()` | `lib/autorizacion/respuesta.ts:339` y `lib/autorizacion/respuesta.ts:350` | La respuesta de éxito y la de rechazo |
| `conIdentidad()` | `lib/datos/capa.ts:125` | El otro contexto: identidad va por su propio camino. Hasta el 2026-09-29 era el que más llamadas había perdido entre pasadas por lote; con la corrida completa la llaman 126 funciones (fila «Llamadas entre archivos de código») |
| `cerrarClientes()` | `lib/datos/capa.ts:155` | Cierra los agrupadores de la base (`lib/datos/capa.ts:149`); lo nombran 111 archivos de `pruebas/` (`grep`, 2026-10-16) |
| `cerrarTodo()` | `pruebas/apoyo/conexiones.ts:66` | Lo mismo del lado del apoyo de pruebas; 117 archivos de `pruebas/` lo nombran (`grep`, 2026-10-16) |
| `pedir()` | `lib/http/cliente.ts:148` | El cliente del API: toda pantalla lee por acá, y ningún archivo de `components/` ni de `app/` llama a `fetch`. Su comentario dice ser *«La única función del proyecto que hace una petición HTTP»* (`lib/http/cliente.ts:133`), y no lo es: `pedirExterno()` (`lib/http/cliente.ts:350`) y `avisar()` (`lib/deteccion/aviso.ts:94`) también llaman a `fetch`. Son las tres llamadas a `fetch` del código de `lib/`, `app/` y `components/` (`grep` sin comentarios, 2026-10-16) |

El informe pone en el noveno lugar un nodo que no es función: el documento de trazabilidad de la
especificación (`docs/OTROS/especificacion/TRAZABILIDAD.md`), que liga cada regla con su
identificador y su prueba. Los dos documentos de esta carpeta que el 2026-09-29 estaban séptimo y
noveno quedaron fuera de los diez: el de las reglas transversales tiene hoy 45 aristas y el de
Acquisition, 10 nodos en total (fila «Esta carpeta en el grafo»). `pedir()` volvió a la lista, en el
décimo lugar.

Si una función nueva **no** toca `conOrganizacion()` o `exigir()`, eso es la señal para mirarla dos
veces — salvo las rutas públicas y las operaciones de identidad, que la prueba de `ADR-0202` exime
en una lista explícita (`docs/OTROS/especificacion/TRAZABILIDAD.md:55`).

---

## 3. Cómo usarlo

Todo se corre desde la raíz del repositorio. Los tres primeros comandos se corrieron el 2026-10-16
sobre este grafo, y lo que se cuenta de su salida es lo que devolvieron.

### Para encontrar algo

```bash
graphify query "dónde se calcula la tasa de cancelación"
```

Recorre el grafo desde los nodos que casan con la pregunta y contesta con nodos y ubicaciones. Hoy
arranca en cuatro nodos —`Cancelacion`, `tasa()`, `tasaDeCancelacion()`
(`lib/negocio/indicadoresDeCitas.ts:341`) y uno que se llama como el documento
`docs/OTROS/futuro/icp-interno-calculado.md` pero vive en `10-LEADS-PORTAL.md` de esta carpeta, que lo
nombra—, encuentra 256 y **muestra 65**: el presupuesto por omisión es de 2000 tokens, la salida avisa
el corte con `[!] TRUNCATED`, y la respuesta puede estar entre lo cortado; `--budget 4000` agranda el
corte, y con él mostró 132 de los mismos 256. Rinde más que un `grep` porque sigue relaciones —quién
llama a quién, qué importa qué—, pero trae ruido: de los 65, 14 salen de documentos, 6 de ellos del de
`futuro/` que entró por uno de los cuatro nodos de arranque, y 3 de esta carpeta; ninguno de éste. El
2026-09-29, con el mismo primer nodo de arranque de `futuro/`, encontraba 300 y mostraba 49.

### Para entender un módulo que no conoces

```bash
graphify explain "consumoDelPrecall"
```

Devuelve el nodo, su comunidad y sus aristas con archivo y línea: once, todas de código. Quién lo
importa: la lectura de la pantalla (`lib/negocio/lecturaDeConversation.ts:31`), el adaptador de
Conversation del cerebro (`lib/agentes/executive/adaptadores/conversation.ts:20`) y dos pruebas
(`pruebas/base/153-consumo-del-precall.test.ts:24` y
`pruebas/codigo/250-lectura-de-conversation.test.ts:31`). A quién llama: `datos()`
(`lib/negocio/consumoDelPrecall.ts:170`), `campoPorNombre()` (`lib/negocio/consumoDelPrecall.ts:159`)
y `avisoDe()` (`lib/negocio/consumoDelPrecall.ts:251`). Hasta el commit `6f3bdb5` (2026-10-10) la
importaba la ruta de la auditoría (`app/api/auditoria/route.ts:43@e1ccf44`). El 2026-09-29 eran diez, y dos venían de este
documento, que lo nombraba; hoy ninguna. Es la forma más directa de contestar «quién usa esto».

**Pero el nodo que devuelve es dos cosas fundidas en una.** Se llama `consumoDelPrecall` y dice vivir
en la línea 143, que es la **función** (`lib/negocio/consumoDelPrecall.ts:143`); el **tipo**
`ConsumoDelPrecall` (`lib/negocio/consumoDelPrecall.ts:104`) no tiene nodo propio, y sus usos llegan
como aristas de la función: las dos referencias de `lecturaDeConversation.ts`
(`lib/negocio/lecturaDeConversation.ts:132` y `lib/negocio/lecturaDeConversation.ts:396`, las dos
`precall: ConsumoDelPrecall`) y el `import type` de la prueba 250. graphify pasa los identificadores
por `casefold()` (`normalize_id`, en `graphify/ids.py`), así que un tipo y una función que sólo
difieren en la mayúscula inicial terminan en el mismo nodo. El 2026-09-29 este mismo nodo se llamaba
como el tipo y decía vivir en la línea 104; hoy lleva el nombre de la función en 62 de los 69 pares
(fila «Pares tipo/función fundidos en un nodo» de la § 1) —`cadenaDeCierre`, `leadsDelPortal`,
`dineroDelMes`…— y el del tipo en los otros 7 (`Vecino`, `Grupo`, `Paso`…). Cuál gana no está
averiguado. Contado buscando `interface|type|class X` y `function x` o `const x = (` en el mismo
archivo; no es un conteo exhaustivo de todas las formas de declarar.

### Para ver qué rompería un cambio

```bash
graphify path "indicadoresDeCitas.ts" "PanelDeConversation"
```

El camino más corto entre dos nodos. **No es el camino de los datos**, y hay que leerlo sabiendo por
qué. Hoy contesta en 3 saltos y el del medio no es código: es un concepto de `09-DEUDA-ABIERTA.md`
(§ 4), «Show rate vacío», que nombra a los dos archivos. El 2026-09-29 también eran 3 saltos, por la
regla 1 de `07-REGLAS-TRANSVERSALES.md`, y el 2026-09-28, antes de que esta carpeta entrara, por
`periodo.ts`, que importan los dos. El camino real es otro: `app/api/auditoria/route.ts:41` importa
`lecturaDeConversation`, que importa `tasaDeCancelacion` (`lib/negocio/lecturaDeConversation.ts:33`),
y la pantalla lee esa ruta por HTTP: importa `leerLaPantalla` de `lib/auditor/vista.ts`
(`components/conversation/PanelDeConversation.jsx:41`), que pide `RUTA = '/api/auditoria'`
(`lib/auditor/vista.ts:23`). **Ese salto por HTTP no es una arista**: entre `lib/auditor/vista.ts` y
`app/api/auditoria/route.ts` no hay ninguna (fila de esos dos archivos en la § 1). Otro caso, que no
cambió en ningún corte desde el 2026-09-28: `graphify path "cadenaDeCierre.ts" "PanelDeSales"` cruza
por un nodo de documento (`Sales: mapa de los requisitos`, de `docs/sales/00-MAPA.md`), no por código.

El 2026-09-28 había un ejemplo de camino que sí era código:
`graphify path "leadsDelPortal.ts" "PanelDeLeadsPortal"` pasaba por `filtrosDelPortal.ts`, que la
pantalla importa de verdad (`components/leads-portal/PanelDeLeadsPortal.jsx:38`). Desde el 2026-09-29
cruza por un documento: entonces, por un nodo de este mismo documento; hoy, por un racional de
`10-LEADS-PORTAL.md` (§ 6), «Tres valores por paso», que nombra a los dos. **Extraer documentos acorta
los caminos**: cada documento que nombra dos archivos los deja a dos saltos, y `path` devuelve el más
corto, no el de código.

La receta para «qué rompe esto», entonces: `graphify explain` sobre la función da las rutas y las
pruebas que la importan; la pantalla de cada ruta se busca por su cadena (`'/api/auditoria'`) con
`grep`. Y los nombres repetidos se escriben con su carpeta, porque a secas `path` y `explain` no
eligen el mismo: el 2026-10-16, igual que el 2026-09-28 y el 29, `"vista.ts"` resolvió a
`lib/vista.ts` en `graphify path` y a `lib/auditor/vista.ts` en `graphify explain`. Con
`"auditor/vista.ts"` o `"lib/vista.ts"` los dos dan el mismo nodo.

### Para actualizarlo después de trabajar

```bash
graphify update
```

Re-extrae **sólo el código**, por AST y sin gastar tokens: recorre todo el corpus de código, pero lo
que no cambió sale de la caché del AST. El propio comando lo anuncia («no LLM needed») y delega en
`_rebuild_code` (`graphify/watch.py`). Los documentos no: al terminar, el mismo comando manda a
correr `/graphify --update` para ellos, que es la extracción semántica del skill con subagentes, y
eso es lo que cuesta tokens.

**Qué hay pendiente hoy, y qué costaría.** Lo que cambió en disco desde el grafo está en la fila «Lo
que cambió en disco después del grafo» de la § 1. Del lado del código —32 archivos cambiados y unos 32
nuevos, entre ellos `lib/meta/`, `recolectarActivos.ts`, las migraciones `078` a `084` y los 10 `.sql`
de `docs/modelo de datos/`—, el AST es gratis. Del lado de los documentos, del orden de 55: los 30 `.md` cambiados y los ~21 nuevos (20 de
`docs/modelo de datos/`), y los 18 de esta carpeta cuando termine su reescritura (14 ya cuentan entre
los 30). Lo que cuestan no se puede anticipar con precisión; las dos referencias que
hay, en `cost.json`, son muy distintas: el 2026-09-29, extraer los 18 de esta carpeta costó 1.365.067
tokens, y el 2026-10-11, extraer 163 documentos sin caché costó 2.928.223. Mover un documento de
carpeta también lo cuenta como nuevo (lo que enseñó la pasada del 2026-09-28, abajo).

Antes de correr `update` en esta máquina, cuatro cosas leídas en el código y en el skill, y **no
corridas** hoy:

1. **El AST en paralelo pierde archivos acá**, en silencio: cada archivo cuyo proceso muere sale
   como un aviso (`worker failed for …`) y el grafo se construye igual, más chico. Las corridas del
   2026-09-28, del 2026-09-29 y del 2026-10-11 lo evitaron extrayendo en serie, y la del 2026-10-11 no
   perdió ninguno: los 1085 archivos del corpus tienen nodos (fila «Archivos con al menos un nodo»).
   `graphify update` no ofrece la opción, pero con `GRAPHIFY_MAX_WORKERS=1` el extractor renuncia al
   pool y extrae en serie (`_extract_parallel`, en `graphify/extract.py`).
2. **Pisaría los nombres puestos a mano.** `.graphify_labels.json.sig` es del 2026-09-15, con las
   firmas de aquella agrupación, y **ninguna comunidad de hoy** coincide con la suya (fila «Firma
   `.sig` de los nombres» de la § 1). El guardia de `update` y de `cluster-only`
   (`graphify/watch.py` y `graphify/cli.py`) descarta cada nombre cuya firma no coincide y le pone
   el del nodo central: a las 353.
3. **Borraría la única copia de la mañana del 2026-09-28.** Ese grafo sólo está en
   `graphify-out/.graphify_old.json`: el paso de actualización del skill copia ahí `graph.json` antes
   de fusionar y lo borra al terminar (`references/update.md` del skill), así que el próximo
   `/graphify --update` lo pisa con el grafo de hoy y después lo borra. `.graphify_pre_ast.json` no
   la nombra el skill, pero tampoco la protege nada.
4. **Nada guarda el grafo de hoy si se actualiza desde el skill.** El respaldo automático
   (`backup_if_protected`, en `graphify/export.py`) copia el grafo a una carpeta del día, y lo llaman
   los subcomandos de `graphify` —`_rebuild_code` lo llama antes de escribir—, pero no los pasos del
   skill, que escriben `graph.json` directamente. La corrida completa del 2026-10-11 se hizo con esos
   pasos, no dejó `graphify-out/2026-10-11/`, y por eso el grafo final del 2026-09-29 se perdió.

Para el punto 2, la firma se reescribe con la misma función que usa el guardia, desde la raíz y con
un Python que tenga graphify (el de `graphify-out/.graphify_python`). No se corrió la escritura: el
2026-10-16 se corrió el mismo cálculo sin la última instrucción, y devolvió una firma por cada una de
las 353 comunidades.

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
renombra igual con su nodo central, que es lo que el guardia busca. Lo que salva más nombres es
heredarlos por miembros después de agrupar («Lo que enseñó la pasada del 2026-09-29», abajo).

Para el 3 y el 4, alcanza con copiar `.graphify_old.json`, `.graphify_pre_ast.json` y el
`graph.json`, el `GRAPH_REPORT.md` y el `.graphify_labels.json` de hoy a una carpeta propia antes del
próximo `--update`. El nombre de `graphify-out/2026-09-28/` sigue engañando —guarda el corte del
2026-09-17—, pero no corre riesgo: el respaldo usa una carpeta por día.

### Lo que enseñó la pasada del 2026-09-28

- **Un `ast.py` o un `inspect.py` en la carpeta de trabajo rompe graphify.** Un `python -c` —los
  pasos del skill, y cualquier script propio que importe graphify— pone la carpeta actual primera
  en la ruta de módulos (`sys.path[0]` vale `''`), así que el archivo propio tapa al de la biblioteca
  estándar. La pasada lo encontró como un `ImportError` que no nombra al culpable; se reprodujo el
  mismo día, con un `inspect.py` en la carpeta temporal: `graphify/cluster.py` hace `import inspect`
  y salió un `SyntaxError` desde el archivo ajeno. La pista es la última línea del rastro, que muestra
  la ruta del archivo propio. El comando `graphify` no se ve afectado —`graphify explain` corrió bien
  desde esa misma carpeta—, porque su ruta de módulos no empieza en la carpeta actual. Nunca llamar
  así a un script, y correr los propios desde una subcarpeta aparte.
- **Mover un documento de carpeta le borra la caché semántica.** El hash de la caché es el
  contenido **más la ruta relativa** (`file_hash`, en `graphify/cache.py`), así que el mismo texto en
  otra carpeta es otra entrada. La pasada midió 0 aciertos de la caché sobre sus 107 documentos
  nuevos o cambiados, y entre ellos estaban los 20 que el commit `e630823` movió a `docs/OTROS/` sin
  tocarles una línea. Mover es gratis para git y caro para el grafo.
- **`detect_incremental` devuelve rutas absolutas** —las 30 borradas y las 340 nuevas que detectó
  aquella pasada eran `C:\…`, y las 72 nuevas de la del 2026-09-29, que son las que todavía guarda
  `.graphify_incremental.json`, también— y el grafo guarda relativas. La pasada tuvo que pasarle
  `root='.'` a `build_merge` para que podara las borradas. El código trae un respaldo que infiere
  la raíz desde `graphify-out/.graphify_root` (`_infer_merge_root`, en `graphify/build.py`), pero no
  está averiguado por qué no alcanzó: pasarlo explícito es lo seguro. Comprobado sobre el grafo de
  hoy: ningún `source_file` es absoluto ni apunta a un archivo que ya no existe (fila «Archivos con
  al menos un nodo» de la § 1).

### Lo que enseñó la pasada del 2026-09-29

- **Re-extraer por AST un lote chico pierde las aristas hacia archivos de fuera del lote.** La
  extracción de esta carpeta re-extrajo por AST sólo los 11 archivos de código que habían cambiado, y
  perdieron 19 aristas hacia otros archivos, como las llamadas a `datos()` desde `cadenaDeCierre.ts`
  (medido ese día). **La corrección fue un AST completo**, los 641 archivos de código, que no gasta
  tokens, fusionado con el grafo: las 19 volvieron, y con ellas aristas entre archivos de código que
  faltaban desde pasadas anteriores, también por lote. Después de re-extraer código por AST, lo seguro
  es el AST completo.
- **Las menciones de ADR son una por archivo, y las pasadas incrementales las funden.** El AST
  completo crea un nodo por cada ADR que nombra cada archivo de código, con una sola arista cada uno;
  las pasadas incrementales los venían fundiendo con su homónimo. Hoy son 513, todos con una conexión
  o ninguna (fila «las menciones de ADR» de la § 1), y explican una quinta parte de los nodos sueltos.
- **Los nombres se heredan por miembros, no por número.** Cada agrupamiento nuevo trae otras
  comunidades con otra numeración. El 2026-09-29, y otra vez el 2026-10-11, cada comunidad se comparó
  con las del corte anterior por el índice de Jaccard —miembros en común sobre miembros en total—: las
  que tienen una comunidad vieja con Jaccard ≥ 0,5 heredaron su nombre, y sólo las demás hubo que
  rotularlas con un subagente (cuántas, en la fila «Comunidades» de la § 1). El guardia de la firma,
  en cambio, exige los mismos miembros bajo el mismo número (punto 2 de arriba).

### Lo que enseñó la corrida del 2026-10-11

Según las notas de la sesión (la memoria del proyecto sobre graphify en esta máquina), contrastadas
con el disco donde se pudo:

- **Una corrida completa de todo el corpus cuesta ~2,9 M tokens**: 2.928.223 en `cost.json`. Se
  repartió en 12 subagentes con trozos de hasta ~45 mil palabras; los 879 archivos de código, por AST
  en serie, no costaron nada.
- **Los subagentes inventan nodos.** 1655 aristas semánticas apuntaban a `id` que nadie definió
  —los subagentes arman el `id` de un archivo citado en vez de usar el que tiene— y se descartaron;
  por eso el grafo de hoy no tiene ninguna colgante. Ese número no quedó en disco.
- **La granularidad de un documento depende de la corrida.** Esta carpeta, extraída otra vez entera,
  quedó en 343 nodos donde el 2026-09-29 tenía 734 (fila «Esta carpeta en el grafo»). Comparar
  cuántos nodos tiene un documento entre dos extracciones no dice cuánto cambió el documento.
- **Nada respaldó el grafo anterior** (punto 4 de arriba).

### Dónde hace falta `PYTHONIOENCODING=utf-8`, y dónde no

**Los subcomandos de `graphify` no la necesitan.** Al arrancar, el propio CLI reconfigura su salida
estándar y la de errores a UTF-8 (`_run_cli`, en `graphify/__main__.py`), así que `query`,
`explain`, `path` y `update` escriben bien aunque la salida vaya a un archivo. Comprobado de nuevo
el 2026-10-16, sobre este grafo: `graphify query "trazabilidad regla identificador prueba"` sin
la variable y redirigido a un archivo escribió la flecha `↔`, que la página de códigos local no
tiene, y terminó con código 0. Ponerla no hace daño.

**Sí hace falta en la reconstrucción completa que el skill corre paso a paso**, porque esos pasos son
`python -c` sueltos que no pasan por ese arranque, y en cualquier script propio que lea el grafo e
imprima nombres de nodo:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
```

En el `SKILL.md` del skill hay **una sola** redirección de la salida estándar de Python a un archivo
(las demás tiran los errores a `$null` o a `/dev/null`, o los pasan a un tubo, y las dos escrituras de
PowerShell piden UTF-8 explícito): el paso que detecta archivos imprime su JSON y lo redirige a
`graphify-out/.graphify_detect.json`; los cinco pasos que vuelven a leer ese archivo lo abren
exigiendo UTF-8, y el paso final lo borra (por eso hoy no está en disco). En Windows, cuando la salida
va a un archivo, Python 3.14.4 (el de graphify 0.9.30, el instalado, el mismo del 2026-09-29) la
codifica en `cp1252`, y esa salida lleva un carácter no ASCII: el `·` (U+00B7) del aviso de corpus
grande que el propio graphify arma —hoy `Large corpus: 1085 files · ~2,036,571 words`—. En `cp1252`
es el byte `0xB7`, que suelto no es UTF-8 válido, y el primer paso que lo lee corta con
`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb7`. Reproducido el 2026-09-28 con esa misma
línea impresa y releída, con y sin la variable: sin ella revienta, con ella pasa.

Lo que **no** es el motivo: los acentos de las rutas. En ese punto todavía no hay nombres de nodo, y
el repositorio no tiene ninguna ruta con caracteres no ASCII: 0 de las 1142 rutas versionadas
(`git -c core.quotepath=off ls-files | grep -P '[^\x00-\x7F]'`, medido el 2026-10-16).

### Los nombres de las comunidades, y dónde quedan los cortes viejos

Reconstruir **rearma las comunidades desde cero**, y con ellas los nombres. La mañana del 2026-09-28
todas se rotularon con subagentes; el 2026-09-29 y el 2026-10-11, una parte heredó el nombre del
corte anterior («Login, segundo factor y usuarios» es hoy el de la comunidad más grande) y al resto
lo rotuló un subagente (cuántas de cada una, en la fila «Comunidades» de la § 1). No hay otro camino
porque `graphify label` necesita un proveedor de IA configurado y acá no hay: sin él avisa «no LLM
backend configured» (`generate_community_labels`, en `graphify/llm.py`) y deja a cada comunidad con
el nombre de su nodo central (`label_communities_by_hub`, en `graphify/cluster.py`, que
`graphify/cli.py` aplica antes de pedirle nombres al proveedor). Copiar los nombres de un corte
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
  el commit `1c55149` y sin informe ni nombres (de los nombres de entonces sólo quedan los que se
  heredaron). No son carpetas, y corren el riesgo del punto 3 de arriba.

**Dos cortes que se publicaron no están guardados**: el del 2026-09-15 que describía la foto
anterior, que lo pisó la actualización del 2026-09-17 sin dejar carpeta (por eso su porcentaje de
nodos con una conexión o ninguna no se puede volver a medir), y el final del 2026-09-29, que lo pisó
la corrida del 2026-10-11 (punto 4 de arriba). De los dos sólo quedan las cifras que publicaron.

---

## 4. Qué cambió en el grafo desde el 2026-09-29

Del 2026-09-29 al 2026-10-11 el grafo no se actualizó: se rehízo. Entró lo construido en esas dos
semanas —los agentes de IA, los fronts de Conversion, Sales, Conversation y Creative con sus
pruebas, las migraciones hasta la `077`— y salió casi todo lo extraído de documentos, que volvió a
entrar con otros `id`: de los 2040 nodos que salieron contra `.graphify_pre_ast.json`, 1925 eran de
`docs/`, y sólo 20 de archivos que ya no existen (el desglose, en las filas «los nodos que entraron»
y «los nodos que salieron» de la § 1). Por eso la diferencia por `id` exagera lo que cambió en los
documentos: un documento re-extraído sin tocar una línea sale y entra entero.

Lo que no se puede medir es la diferencia exacta con el grafo final del 2026-09-29, porque ya no está
(§ 3). Medido comparando `id` contra `.graphify_pre_ast.json` y contra la copia de
`graphify-out/2026-09-28/`.

---

## 5. Lo que el grafo NO garantiza, y hay que saberlo

**Casi uno de cada tres nodos tiene una conexión o ninguna** (la cifra exacta, la de los cortes
anteriores y la que publicó la foto del 2026-09-15, en la fila «Nodos con una conexión o ninguna» de
la § 1). Medido sobre el grafo entero con:

```bash
node -e "const g=require('./graphify-out/graph.json');const d={};g.nodes.forEach(n=>d[n.id]=0);g.links.forEach(l=>{d[l.source]++;d[l.target]++});const p=g.nodes.filter(n=>d[n.id]<=1).length;console.log(p,'de',g.nodes.length,'=',(p/g.nodes.length*100).toFixed(2)+'%')"
```

**Lo que mueve esa proporción son los conceptos**, que incluyen los nodos que saca la extracción
semántica de los documentos y las menciones de ADR que el AST saca del código. Hoy las menciones de
ADR son 513 de los 2586, todas sueltas por construcción (una arista cada una); sin ellas, los
conceptos de una conexión o ninguna son menos de uno de cada cuatro (fila «las menciones de ADR» de
la § 1). Los de código casi no se movieron entre cortes: entre el 28,8 % y el 31,3 % desde el
2026-09-17. Qué hizo mejor o peor cada extracción de documentos no está medido.

El informe dice otro número —«… isolated node(s)», en su sección *Knowledge Gaps*— y no se
contradicen: **el del informe es ese mismo conjunto después de sacar los nodos-archivo y los
racionales** (el filtro de la sección de huecos, en `graphify/report.py`). Lo que graphify llama
nodo-archivo (`_is_file_node`, en `graphify/analyze.py`) incluye también las funciones con una sola
arista. El filtro también dice sacar los «conceptos», pero con la definición de `_is_concept_node`
(`graphify/analyze.py`): nodos sin archivo de origen, o con uno sin extensión. Hoy no hay ninguno
así, y los conceptos de los documentos y las menciones de ADR, que sí tienen su archivo, **siguen
adentro**. Reproducido el 2026-10-16 con las funciones de graphify: el conjunto filtrado queda entero
dentro del conjunto del comando de arriba, y su denominador es el grafo sin nodos-archivo ni
racionales, que el informe no publica (las tres cifras, en la fila «los que el informe llama
*isolated*» de la § 1).

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
código o contra la base. El ejemplo más a mano hoy es lo que entró después del 2026-10-11: `lib/meta/`
existe desde el 2026-10-15 y en el grafo tiene **0 nodos**, igual que `recolectarActivos.ts`, las
migraciones `078` a `084` y `docs/modelo de datos/`; y los números de línea que el grafo da para los
archivos que cambiaron después ya no son los del código (§ 2).

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
escondido es `scripts/credenciales.mjs`: medido otra vez el 2026-10-16 con
`git check-ignore --no-index -v`, esa ruta todavía cae en `credenciales*` y las de
`lib/credenciales/` ya no. graphify lee los dos archivos juntos y gana la última regla que casa
(`_load_graphifyignore`, en `graphify/detect.py`, que además lee las exclusiones locales de
`.git/info/exclude`), así que la regla de la carpeta debería sobrar; no se probó sacándola. El
comentario del `.graphifyignore` sigue diciendo que el `.gitignore` esconde la carpeta, y eso quedó
viejo. Hoy el grafo ve los cuatro archivos, cada uno con sus nodos (fila «Nodos de los archivos de
credenciales» de la § 1). La ruta nueva de credenciales de Meta (2026-10-15) todavía no está en el
grafo.
