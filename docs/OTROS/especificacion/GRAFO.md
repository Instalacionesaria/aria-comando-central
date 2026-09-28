# El grafo de conocimiento en el proceso

Dos grafos independientes y un servidor MCP. **No se fusionan**, y eso es deliberado.

| | grafo de la ESPECIFICACIÓN | grafo del CÓDIGO |
| --- | --- | --- |
| Qué | los 14 documentos de `docs/migracion/` | este repositorio |
| Dónde | `…\aria-project-closer-setter\docs\migracion\graphify-out\` | `.\graphify-out\` |
| Tamaño | 538 nodos · 749 aristas · 48 comunidades | 359 nodos · 453 aristas · 26 comunidades |
| Cómo se construye | LLM (una vez) + overlay determinista | AST, **gratis, siempre** |
| Cada cuánto cambia | ~3 veces en todo el proyecto | cada commit |
| Ignorado por git | sí (`graphify-out/` en los dos repos) | sí |

**Por qué no se fusionan:** `graphify merge-graphs` prefija **cada** identificador de
nodo con `<tag>::`, así que los dos corpus quedan como **componentes disjuntos con
cero aristas cruzadas**, y habría que regenerarlo en cada commit. Un servidor MCP
acepta un `project_path` por llamada, así que sirve los dos grafos sin prefijos, sin
paso de sincronización y sin re-agrupar nada.

## El puente entre los dos: `ADR-SSRR`

Lo que sí une los corpus son los identificadores, y el mecanismo es gratis.

El paso AST de graphify reconoce `ADR-NNNN` **dentro de una línea de comentario** de
un `.ts/.tsx/.js/.jsx/.mjs/.cjs` y crea un nodo más una arista
`archivo --cites--> ADR-NNNN` con confianza `EXTRACTED`. Cada `graphify update` lo
refresca. Sin LLM, sin costo, sin quedarse viejo.

```typescript
// ADR-0206, ADR-0207 — Con la organizacion A no se ve ni una fila de la B;
// la escotilla no llega a las tablas de negocio. Tipo: Base. INNEGOCIABLE.
describe('aislamiento entre organizaciones', () => { /* … */ });
```

Tres cosas que hay que saber, verificadas:

- **Tiene que estar en un COMENTARIO.** Un `describe('ADR-0207 …')` **no** se escanea.
- **La forma no es negociable:** el regex es `ADR[- ]?\d{1,5}` o `RFC[- ]?\d{1,5}`.
  `REGLA-E2-07` es invisible.
- **Los comentarios de SQL NO se escanean.** Un `-- ADR-0201` en una migración no
  produce nada. Las migraciones aportan estructura (tablas, disparadores, claves
  foráneas), no trazabilidad.

Los identificadores salen de `PRUEBAS.md` sin intervención de un modelo:
`ADR-SSRR`, SS = etapa, RR = fila de la tabla. **75 reglas, 26 ⛔.** La tabla legible
está en [`TRAZABILIDAD.md`](TRAZABILIDAD.md), generada.

## Los comandos

```bash
node tools/graphify/cobertura.mjs 0
```

```bash
node tools/graphify/spec-overlay.mjs --trazabilidad
```

| Para qué | Comando |
| --- | --- |
| Refrescar el grafo de código (AST, gratis) | `graphify update "C:\PROYECTOS\ARIA\Comando Central"` |
| Cobertura de una etapa | `node tools/graphify/cobertura.mjs <etapa>` |
| Quién cita una regla | `node tools/graphify/cobertura.mjs --adr ADR-0002` |
| Panorama de todas las etapas | `node tools/graphify/cobertura.mjs --todas` |
| Regenerar IDs y trazabilidad | `node tools/graphify/spec-overlay.mjs --trazabilidad` |

**Siempre con la ruta explícita.** `graphify-out/.graphify_root` contenía una ruta
estilo Git-Bash (`/c/PROYECTOS/…`) que no existe para Python en Windows, así que
`graphify update` sin argumento fallaba. Ya está corregida, pero pasar la ruta es la
costumbre segura.

**Y la carpeta de la especificación vive en otro repositorio**
(`Instalacionesaria/aria-project-closer-setter`, público). Los guiones de
`tools/graphify/` la resuelven como repo hermano al lado de éste; si están clonados de
otra forma, `ARIA_ESPEC` la sobreescribe:

```bash
ARIA_ESPEC=/ruta/a/aria-project-closer-setter/docs/migracion node tools/graphify/cobertura.mjs 1
```

## Consultar la especificación

```bash
graphify affected "doc_08" --relation corrects --depth 1 --graph "C:\PROYECTOS\ARIA\aria-project-closer-setter\docs\migracion\graphify-out\graph.json"
```

| Pregunta | Herramienta |
| --- | --- |
| ¿Qué documento corrige a este? | `graphify affected "<doc>" --relation corrects` — **el mejor uso del grafo acá** |
| Todo lo que toca un concepto disperso en varios documentos | `graphify query "<tokens sin acento>"` |
| ¿Qué reglas son de la etapa N y qué prueba las sostiene? | **grep.** `PRUEBAS.md` *es* esa matriz |
| ¿Cuáles son las ⛔? | **grep.** `Select-String -Pattern "⛔"` |
| ¿Qué cerró EJECUCION que otro documento deja abierto? | **ninguna de las dos.** Es una tarea de lectura: `EJECUCION` §2 y §3, en cada etapa |

Dos reglas de consulta, verificadas empíricamente:

- **Tokens SIN ACENTO y de 3+ caracteres.** El tokenizador no quita diacríticos pero
  el comparador sí, así que `autenticación` **nunca** matchea `autenticacion`.
- **Nunca pasar `--context`** en un grafo de documentos: filtra por un atributo que
  las aristas semánticas no tienen, y las borra todas. (El filtro heurístico que se
  dispara con `module/call/import/return/field` es solo inglés, así que una consulta
  en español es inmune por construcción.)
- **Nunca `--directed`.** Medido sobre este grafo: colapsa `query` de 72 nodos a 1,
  porque `G.neighbors()` devuelve solo sucesores. La dirección ya está preservada en
  `_src`/`_tgt` y se ve en las flechas de `explain`, `path` y `query`.

## Acceso de agentes

`graphify-mcp` está configurado en `.claude/settings.local.json` (ignorado por git,
según la convención escrita del repo hermano: los hooks de graphify van en
`settings.local.json`, **no** en `settings.json`, *"que sí está versionado y se le
aplicaría a todo el equipo"*). El grafo de la especificación es el default fijado; el
de código se alcanza pasando `project_path`.

**No se corrió `graphify hook install`** (crearía un `.gitattributes` sin trackear en
la raíz y escribiría dos claves en `.git/config` con una ruta de intérprete específica
de la máquina; además `post-checkout` hace un rebuild completo por cada cambio de
rama). **No se corrió `graphify claude install`** (escribiría `CLAUDE.md`, que está
trackeado, y **crearía** `.claude/settings.json`, que en este repo **no** está
ignorado → archivo trackeado nuevo que aplicaría a todo el equipo).

## Ritual por etapa

- **Antes** — leer la sección de `PRUEBAS.md` de la etapa y `EJECUCION` §2/§3. Fuente
  primaria, no negociable. Después `graphify affected` para el inventario cruzado de
  qué corrige qué.
- **Durante** — `graphify update "<ruta>"` una vez por sesión. Segundos, sin LLM.
- **Al cerrar** — `node tools/graphify/cobertura.mjs <etapa>` y citar las ⛔ que
  falten.

## Costo

La extracción de la especificación se hizo **una vez**: 6 subagentes, ~818k tokens de
salida. Las re-extracciones son gratis en archivos sin cambios (la clave es
`sha256(cuerpo)` + ruta relativa, y los `.md` hashean **solo el cuerpo**, así que
editar frontmatter es un acierto de caché). Las actualizaciones del grafo de código
son **gratis, siempre**.

El backend `claude-cli` —que habría hecho la extracción sin subagentes y sin costo de
API— **falló**: el binario `claude` de esta máquina no está autenticado
(*"Not logged in · Please run /login"*). Tiene su propio almacén de credenciales,
separado de la sesión del asistente. Si se lo autentica, una re-extracción completa
sería `graphify extract "<espec>" --backend claude-cli --mode deep --token-budget 20000`.

**`--mode deep` está comprometido.** Cambiar de modo usa otro namespace de caché y
**re-cobra el corpus entero**.

## Donde el grafo NO ayuda

Vale escribirlo porque el riesgo de este aparato es la confianza mal puesta — el mismo
que `PRUEBAS.md` señala: *"diez documentos aplicados a medias vienen con la confianza
de los diez."*

1. **Cualquier cosa que necesite el texto literal.** `EJECUCION` §6: los nombres **son**
   las cadenas que buscan las pruebas, y *"un sinónimo rompe la prueba sin romper el
   código"*. El grafo guarda **etiquetas**, normalizadas por un modelo. Para nombres,
   grep. Siempre.
2. **La regla de precedencia.** Es una regla sobre cómo leer, no un conjunto de
   aristas.
3. **RLS, grants, `force`, `bypassrls`, políticas, columnas.** El extractor de SQL
   captura tablas, vistas, funciones, claves foráneas y disparadores — **ni
   `CREATE POLICY` ni `GRANT`**. graphify **no puede verificar ni una** de las
   invariantes de catálogo de las Etapas 1 y 2. Ésas se prueban con SQL contra
   `pg_catalog`, y así están escritas.
4. **`cobertura.mjs` es una lista de verificación, no una compuerta.** Prueba que un
   archivo **menciona** el identificador en un comentario. No prueba que la prueba
   exista, corra, ni falle cuando la regla se rompe. **La compuerta es la integración
   continua.**
5. **`god-nodes` sobre el grafo de la especificación.** Saltea los nodos `concept` y
   `rationale`, y un grafo de prosa es casi todo eso. Salida delgada o vacía; no leerle
   significado.
6. **El wiki no es la especificación.** Etiquetas, grados, rutas y nombres de relación
   — los 25 nodos más conectados por comunidad, sin prosa, sin fragmentos, y el
   atributo `rationale` **no se renderiza en ninguna parte** de la cadena. Es un mapa
   sobre los documentos, no un reemplazo. El grafo guarda el puntero; el markdown
   guarda el por qué.
