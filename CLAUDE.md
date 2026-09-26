@AGENTS.md

# Marca

**Antes de construir o modificar cualquier interfaz, leé `brand/BRAND.md`.** Es el resumen de lo
que el Brandbook v2.0 le exige al código; si algo lo contradice, manda el brandbook.

**Nunca escribas un hex en un componente.** Siempre la variable. Los tokens salen de
`brand/tokens.json` y llegan al CSS por dos caminos, ninguno de los cuales se edita a mano:
`public/brand/tokens.css` (exportado del brandbook) y `app/brand/tokens-scope.css` (generado por
`node scripts/marca.mjs`). Si hace falta un valor nuevo, cambia el brandbook y volvé a exportar.

## Las tres reglas que no se negocian

1. **Un solo símbolo: la mascota** — el orb con dos ojos. No existe un orb sin cara salvo como
   versión mínima por debajo de 48px, y eso lo aplica el componente solo.
2. **La mascota da personalidad; las ilustraciones de línea explican.** Nunca en la misma tarjeta.
3. **El rojo señala, nunca identifica.** `--alert` es para lo incorrecto, un problema o una
   incidencia. Lo que es marca o «lo correcto» va en `--accent`.

## Estado de la migración

La aplicación **todavía no está migrada**: los tokens de marca viven en la capa `marca`, que pierde
contra `aios.css` y `temas.css` a propósito, así que ninguna pantalla cambió. Los valores reales
sólo se aplican bajo `[data-marca="v2"]`, y hoy eso es únicamente `/brand`.

El inventario de lo que falta migrar, pantalla por pantalla y con el token de reemplazo de cada
valor hardcodeado, está en `brand/MIGRACION.md`. La migración es de a una pantalla por vez, y cada
pantalla migrada **sale de la lista `VISTAS` de `scripts/paridad.mjs`** —deja de coincidir con el
prototipo a propósito— con el motivo escrito en el `docs/ETAPA-N` de su etapa.
