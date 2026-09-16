# Cómo ubicar cualquier cosa: el grafo de conocimiento

> Construido el **2026-09-15** sobre el repositorio completo. Se reconstruye, no se edita a mano.

Esta carpeta nombra decenas de archivos, funciones y tablas. El grafo es la forma de encontrarlos sin
leer el repositorio entero, y de ver **qué toca qué** antes de cambiar algo.

---

## Qué hay construido

| Salida | Qué es |
|---|---|
| `graphify-out/graph.html` | El grafo interactivo. Se abre en cualquier navegador, sin servidor |
| `graphify-out/GRAPH_REPORT.md` | El informe: nodos dios, conexiones sorprendentes, preguntas sugeridas, y la auditoría de extracción |
| `graphify-out/graph.json` | El grafo crudo, para consultarlo desde código |
| `graphify-out/manifest.json` | Qué archivo se extrajo cuándo — es lo que hace posible el `--update` incremental |

**Tamaño del corte del 2026-09-15:** 557 archivos (514 de código, 43 documentos), ~1,12 M palabras →
**3875 nodos, 9709 aristas, 228 comunidades**.

---

## Los nodos dios: las seis funciones que sostienen el sistema

Salieron del grafo, no de una opinión. Son las más conectadas, y explican la arquitectura mejor que
cualquier diagrama:

| Función | Aristas | Qué significa que esté acá |
|---|---|---|
| `datos()` | 278 | Toda lectura y escritura de negocio pasa por el mismo constructor de consultas |
| `conOrganizacion()` | 254 | **Toda operación abre el contexto de su organización.** Es la regla `ADR-0202`, y el grafo la confirma: es el segundo nodo más conectado del repositorio |
| `exigir()` | 162 | El portero. Ninguna ruta se salta la autorización |
| `conIdentidad()` | 157 | El otro contexto: identidad va por su propio camino |
| `ok()` / `rechazo()` | 144 / 125 | Las dos únicas formas de responder de una ruta |

Si una función nueva **no** toca `conOrganizacion()` o `exigir()`, eso es la señal para mirarla dos
veces.

---

## Cómo usarlo

### Para encontrar algo

```bash
graphify query "dónde se calcula la tasa de cancelación"
```

Recorre el grafo y contesta con los nodos y sus ubicaciones. Es más rápido y más completo que un
`grep`, porque sigue relaciones —quién llama a quién, qué comparte datos con qué— y no sólo texto.

### Para ver qué rompería un cambio

```bash
graphify path "indicadoresDeCitas" "PanelDeConversation"
```

El camino más corto entre dos conceptos. Sirve para ver cuántas capas hay entre un módulo y su
pantalla antes de tocarlo.

### Para entender un módulo que no conocés

```bash
graphify explain "consumoDelPrecall"
```

### Para actualizarlo después de trabajar

```bash
graphify update
```

Re-extrae **sólo** lo que cambió, apoyándose en `manifest.json`. La extracción de código es
determinista y gratis (AST).

`update` **no** necesita `PYTHONIOENCODING`. Es un subcomando que corre entero dentro de Python
(`graphify/cli.py:1870`, `elif cmd == "update":`) y delega en `graphify/watch.py:861`
(`_rebuild_code`): no hay ninguna redirección de shell en su camino. En todo el paquete, el archivo
intermedio que sí se escribe por redirección aparece una sola vez —`graphify/cli.py:2492`— y está
dentro del subcomando `benchmark`.

### Dónde SÍ hace falta `PYTHONIOENCODING=utf-8`

En la reconstrucción **completa**, la que el skill corre paso a paso:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
```

En todo `SKILL.md` hay **una sola** redirección de shell: el paso que detecta archivos imprime su
JSON por salida estándar y lo redirige a `.graphify_detect.json`
(`~/.claude/skills/graphify/SKILL.md:130-138`). Los demás pasos escriben con
`write_text(..., encoding="utf-8")`, y los cinco que vuelven a leer ese archivo lo abren exigiendo
UTF-8 (`:201`, `:247`, `:428`, `:517`, `:578`).

En Windows, cuando la salida va a un archivo en vez de a la consola, Python 3.14 la codifica con la
página de códigos local (`cp1252` acá), no en UTF-8. Y esa salida lleva un carácter no ASCII:
**exactamente uno**, el `·` (U+00B7) del aviso que el propio graphify arma cuando el corpus es
grande — `Large corpus: 560 files · ~… words`. En `cp1252` se escribe como el byte `0xB7`,
que aislado no es UTF-8 válido, así que el primer paso que lo lee corta la corrida con
`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb7`. Reproducido corriendo el paso de
detección con y sin la variable: sin ella el `read_text(encoding="utf-8")` revienta, con ella pasa.

Lo que **no** es el motivo: los acentos de las rutas. En ese punto del pipeline todavía no hay
nombres de nodo —`detect()` devuelve rutas, conteos y avisos— y el repositorio no tiene ni una ruta
con carácter no ASCII (`git ls-files | grep -P '[^\x00-\x7F]'` no devuelve nada). El único carácter
conflictivo es el del aviso, y aparece sólo porque este corpus pasa el umbral de «corpus grande».

### Para recuperar los nombres de las comunidades

Reconstruir **rearma las comunidades desde cero**, y con ellas los nombres. El corte anterior tenía
218 comunidades y las 218 estaban etiquetadas a mano —«Rutas del API y portero», «Autenticación y
segundo factor»—; éste tiene 228 y las 228 se llaman como su nodo más central: `exigir`,
`cerrarClientes`, `43-segundo-factor.test.ts`. Copiar las viejas encima tampoco sirve: la comunidad 0
dejó de ser la misma.

```bash
graphify label
```

Reagrupa y fuerza el reetiquetado aunque ya exista un `.graphify_labels.json` (`graphify/cli.py:1546`
y `:1549`).

Los nombres viejos no se pierden mientras tanto: antes de sobrescribir, graphify copia el grafo a una
carpeta con la fecha del día, y sólo lo hace si costó tokens o si alguien lo etiquetó a mano
(`graphify/export.py:53-63`) — que es exactamente el caso acá. Por eso `graphify-out/2026-09-15/`
guarda el corte del **2026-09-14**, con su `graph.json`, su `GRAPH_REPORT.md` y su
`.graphify_labels.json` (`graphify/export.py:24-32`). La fecha de la carpeta es la del día que la
reconstrucción pisó el grafo, no la del grafo que está adentro.

---

## Lo que el grafo NO garantiza, y hay que saberlo

**1552 de los 3875 nodos tienen una conexión o ninguna — el 40,05 % del grafo** (20 con cero
conexiones y 1532 con exactamente una). Medido sobre el grafo entero con:

```bash
node -e "const g=require('./graphify-out/graph.json');const d={};g.nodes.forEach(n=>d[n.id]=0);g.links.forEach(l=>{d[l.source]++;d[l.target]++});const p=g.nodes.filter(n=>d[n.id]<=1).length;console.log(p,'de',g.nodes.length,'=',(p/g.nodes.length*100).toFixed(2)+'%')"
```

El informe dice otro número —«**1233 isolated node(s)** … These have ≤1 connection»
(`graphify-out/GRAPH_REPORT.md:941-942`)— y no se contradicen: **1233 es ese mismo conjunto después
de filtrar** (`graphify/report.py:255-261`). El porcentaje sobre los 3875 nodos es 40,05 %; el
1233 sólo admite como denominador su propio conjunto filtrado, que el informe no publica.

El informe nombra las dos causas posibles sin decidir entre ellas: aristas que faltan, o componentes
que nadie documentó. La sospecha razonable es el desajuste de identificadores entre las dos
extracciones —el AST nombra un símbolo de una forma y la extracción semántica lo nombra de otra—,
pero eso no está medido.

Lo que sí está medido es que las aristas que existen cierran: las 9709 tienen sus dos extremos entre
los 3875 nodos, **ninguna cuelga**. Comprobado con:

```bash
node -e "const g=require('./graphify-out/graph.json');const ids=new Set(g.nodes.map(n=>n.id));console.log(g.links.filter(e=>!ids.has(e.source)||!ids.has(e.target)).length)"
```

→ `0`. Los tres cortes anteriores guardados en `graphify-out/` (`2026-08-20/`, `2026-08-21/` y
`2026-09-15/`) dan `0` con el mismo comando cambiando la ruta: no hay ningún corte en disco con
aristas colgantes.

Consecuencia práctica: **el grafo sirve para ubicar y para explorar, no para afirmar que algo NO
existe.** Si una consulta no devuelve nada, eso no prueba la ausencia — hay que comprobarlo contra el
código o contra la base. Es la misma disciplina que el resto del proyecto, y por el mismo motivo: ya
se concluyó tres veces que un dato no existía mirando el lugar equivocado.

**Y no reemplaza a la base.** El grafo conoce el código, no los datos. Para cualquier pregunta sobre
cobertura, volumen o vocabulario real, la respuesta sale de una consulta:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select ..."
```

---

## Una nota sobre `.graphifyignore`

El repositorio tiene un `.graphifyignore` que **rescata** `lib/credenciales/` y
`scripts/credenciales.mjs`, que el `.gitignore` escondía por prefijo. Sin él, el grafo quedaba ciego
justo en el resolvedor de credenciales y el cifrado — la parte donde una pregunta sobre seguridad se
responde mal si falta contexto. El motivo completo está en el propio archivo.
