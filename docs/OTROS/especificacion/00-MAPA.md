# La relación con la especificación

Los tres documentos que atan este repositorio a la especificación del repositorio hermano: su grafo,
la matriz de reglas y el léxico. Estaban sueltos en la raíz de `docs/` y se juntaron acá el
2026-09-28, sin cambiarles el nombre ni una línea.

| documento | qué es | quién lo mantiene |
|---|---|---|
| `GRAFO.md` | El grafo de conocimiento en el proceso: el puente `ADR-SSRR` entre la especificación y el código, por qué no se instalaron los ganchos de graphify y cómo consultarlo sin romperlo | a mano |
| `TRAZABILIDAD.md` | La matriz regla ↔ identificador ↔ prueba: el diccionario de los `ADR-NNNN` que cita el código | **generado**: `node tools/graphify/spec-overlay.mjs --trazabilidad`, que lo escribe en esta carpeta. No se edita a mano |
| `LEXICO.md` | Los nombres que exigen las pruebas y los sinónimos prohibidos | a mano, y lo hace cumplir `pruebas/codigo/10-arquitectura.test.ts` |

**El grafo del código tiene una guía más nueva.** `GRAFO.md` es del 2026-08-21 y sus tamaños del grafo
de código quedaron viejos. La guía vigente para consultar el grafo del código es
`docs/OTROS/estado actual/08-COMO-USAR-EL-GRAFO.md`, con corte del grafo del 2026-09-29.
