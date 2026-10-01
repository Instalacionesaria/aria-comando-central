# ARIA · Brandbook v2.0 (reglas para el código)

Brandbook completo (fuente de verdad, para personas): https://claude.ai/artifact/693rtTpgCPd8o4nTcfQzyt
Este archivo resume solo lo que afecta al código. Si algo contradice al brandbook, manda el brandbook.

## Archivos de esta carpeta

| Archivo | Para qué |
|---|---|
| `tokens.json` | Todos los tokens (color por tema, tipografía, espacios, radios, sombra). Fuente para herramientas. |
| `tokens.css` | Los mismos tokens como variables CSS. Es lo que importa la app. Generado: no editar a mano. |
| `assets/logos/` | Wordmark oscuro (principal), claro y monocromos. |
| `assets/mascota/` | La mascota en sus 8 estados + versión sticker (SVG). |
| `mascota/aria-mascot.js` | Web component `<aria-mascot>` con estados y mirada que sigue el cursor. `demo.html` lo muestra. |

## Tres reglas que no se negocian

1. **Un solo símbolo: la mascota** (el orb con dos ojos). No existe un orb sin cara salvo como versión mínima, por debajo de 48px (el componente la aplica solo).
2. **La mascota da personalidad; las ilustraciones de línea explican.** Nunca van en la misma tarjeta.
3. **El rojo señala, nunca identifica.** `--alert` solo para lo incorrecto, un problema o una incidencia. Lo que es marca o "lo correcto" va en `--accent`.

## Color (modo producto, oscuro por defecto)

- Fondos: `--bg` página · `--bg-alt` secciones y paneles · `--surface-raised` campos · `--surface-active` ítem activo.
- Líneas: `--line` hairline de 1px · `--line-strong` borde de botón secundario y chips.
- Texto: `--ink` principal · `--ink-2` secundario · `--ink-3` atenuado (mínimo para texto) · `--ink-4` **solo decorativo**, nunca para texto que haya que leer.
- Un solo acento: `--accent` (cian). `--accent-2` (violeta) solo como detalle puntual.
- Estados: `--accent` activo · `--signal` atención y la etiqueta «VISTA DE EJEMPLO» (las dos señales que no son error) · `--alert` incidencia.
- Proporción: ~90% grises, ~8% `--ink`, ~2% acento.
- **Nunca escribas un hex en un componente.** Usa siempre la variable.

## Superficies

- Sin sombras ni degradados en tarjetas o textos. La estructura se dibuja con bordes de 1px `--line`.
- Única sombra: `--glow-orb` (halo bajo la mascota o la ventana de producto).
- Radios: `--radius-sm` 12px campos · `--radius-md` 18px ventanas · `--radius-lg` 20px tarjetas · `--radius-pill` botones y chips.

## Tipografía

- `--font-sans`: Geist. `--font-mono`: Geist Mono (etiquetas, cifras, muestras de datos; nunca párrafos).
- Titulares en dos líneas: la primera en peso 200, la segunda en 500, `letter-spacing: -0.035em`.
- Cuerpo en peso 300 sobre oscuro.
- Carga: en esta aplicación, `next/font/google` (`Geist` y `Geist_Mono`, con las variables `--font-geist-sans` y
  `--font-geist-mono`, en `app/layout.js`), no el paquete `geist`: el porqué está en ese archivo. Otros → Google
  Fonts (Geist 200–600, Geist Mono 400–500).

## Componentes base

- **Botón primario:** fondo `--ink`, texto `--on-ink`, 50px, `--radius-pill`, flecha → al final. Uno por vista.
- **Botón secundario:** transparente, borde 1px `--line-strong`, texto `--ink-2`.
- **Chip:** borde `--line-strong`, texto 13px `--ink-2`, 30px de alto.
- **Tarjeta:** `--bg-alt`, borde `--line`, `--radius-lg`, sin sombra.
- **Foco visible:** anillo de 2px `--accent`.
- CTA canónico de la web: "Solicitar acceso".

## Mascota

```html
<script src="/brand/mascota/aria-mascot.js"></script>
<aria-mascot size="210" follow></aria-mascot>          <!-- portada, asistente, login -->
<aria-mascot size="56" state="hallazgo"></aria-mascot>  <!-- respuesta con dato -->
```

- Estados: `neutral`, `pensando`, `escuchando`, `hallazgo`, `celebra`, `alerta`, `cargando`, `sin-conexion`. Elige el estado por lo que pasa, no por decoración.
- `follow`: los ojos siguen el cursor (solo ojos; 9% X / 6% Y; suavizado; vuelve al centro a los 3 s; parpadea; respeta `prefers-reduced-motion`).
- Una mascota por pantalla. No se estira, no cambia de color, no lleva accesorios.
- En React/Next: `'use client'`, importar el script una vez (p. ej. en el layout) y usar `<aria-mascot>` como elemento; en TS declara el tipo en `JSX.IntrinsicElements`.

## Voz en la interfaz

Frases cortas, con dato y honestas. Si no hay dato suficiente, se dice. Ejemplos: «Tengo un dato.» · «Esto necesita una decisión tuya.» · «Perdí la conexión con GoHighLevel. No voy a inventar números mientras tanto.» Las cifras llevan su muestra en mono («muestra: 84 llamadas»). Sin emojis.

## Al escribir código

**Nunca escribas un hex en un componente.** Siempre la variable. Los tokens salen de `brand/tokens.json` y
llegan al CSS por dos caminos, y ninguno se edita a mano: `public/brand/tokens.css` (exportado del
brandbook) y `app/brand/tokens-scope.css` (generado por `node scripts/marca.mjs`). Si hace falta un valor
nuevo, cambia el brandbook y se vuelve a exportar.

Estas reglas estaban en `CLAUDE.md`, que dejó de versionarse en `main` (`c0eeb71`): viven acá porque
este archivo sí se versiona.

## Estado de la migración

La aplicación **ya usa la marca** en su tipografía, su paleta y sus superficies desde las etapas 4 y 5 de
la nueva estructura (`docs/OTROS/nueva-estructura/06-LAS-ETAPAS.md`). Lo hizo cambiando valores de los
tokens de `app/temas.css`, no las pantallas, así que los tokens de esta carpeta siguen en la capa `marca`,
debajo de los de la aplicación. Lo que queda, pantalla por pantalla, está en `MIGRACION.md`.

La aplicación extiende la marca en tres cosas, y cada una está escrita en `app/temas.css` y vigilada por
`pruebas/codigo/188-la-paleta-de-la-marca.test.ts`:

- **los colores con significado que la marca no trae**: un verde de éxito apagado y doce colores de etapa
  del pipeline, todos con menos croma que el cian;
- **el borde de control**: `--line-strong` es el `#3A4456` que la nota de `line-strong` pide «si el borde
  debe leerse solo», porque sin sombras siempre es el caso;
- **el chat de la ficha**, que imita a WhatsApp y usa sus colores.
