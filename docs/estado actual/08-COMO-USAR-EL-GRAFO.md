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

**Tamaño del corte del 2026-09-15:** 549 archivos (511 de código, 38 documentos), ~1,06 M palabras →
**3687 nodos, 9500 aristas, 218 comunidades**.

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
| `ok()` / `rechazo()` | 144 / 123 | Las dos únicas formas de responder de una ruta |

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
determinista y gratis (AST); la semántica sólo corre sobre documentos nuevos o modificados.

---

## Lo que el grafo NO garantiza, y hay que saberlo

**892 aristas cuelgan de un extremo que no existe.** El diagnóstico de salud lo reportó en la
construcción del 2026-09-15. La causa es el desajuste de identificadores entre las dos extracciones:
el AST nombra un símbolo de una forma y la extracción semántica lo nombra de otra, así que la arista
apunta a un nodo fantasma.

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
