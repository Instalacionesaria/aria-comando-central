# F07 · Marketing › Copywriter — sólo diseño

> Un solo agente que escribe la bio de Instagram, los guiones TOFU, MOFU y BOFU, los guiones de venta
> directa y las respuestas a objeciones, a partir de lo que la empresa ya construyó en Research y de lo que
> se dice en sus llamadas (`D-18`). No se construye en esta fase (`D-05`).

| campo | valor |
|---|---|
| Tipo | CREA |
| Lugar en el front | Marketing › Copywriter, hoy «Próximamente» |
| Estado | **Sólo diseño** |
| Modelo | `claude-sonnet-5-5` |
| Permisos | Por sección, como hoy (`D-25`); la sección se decide al construirlo |

## Qué lee

- El ICP, la oferta, la categoría y el perfil, del almacén de Fundaciones, con la misma herencia que ya usan
  las herramientas del método.
- El análisis guardado del Espía, cuando llega por «Enviar hallazgos a Copywriter» (`F02`).
- Las objeciones de las llamadas de venta, por categoría y con su frecuencia (`F14`).

## Qué produce

| pieza | metodología que se porta del ARIA anterior |
|---|---|
| La bio de Instagram en 3 versiones, la presentación «Empieza Aquí» y el carrusel para fijar, con una palabra clave que se repite en cada llamada a la acción | `perfil-ig` |
| Guiones de anuncio TOFU, 3 variantes con la estructura de 5 bloques | `guiones/ads-frios` |
| Guiones de remarketing MOFU y BOFU | `guiones/ads-remarketing` |
| Guiones de contenido orgánico (reels, carruseles, stories) | `guiones/sop-contenido` |
| Las respuestas al DM por palabra clave: apertura, respuestas rotativas, el seguimiento de 24 h y **un mapa de instalación** de dónde pegar cada texto en GHL | `responder-solo` |

Las metodologías se portan como las de Fundaciones: copias fieles en `lib/fundaciones/skills/` (o donde viva
Copywriter), para que el diff entre los dos árboles sea legible.

## Requisitos de diseño

- **AG-F07-1 · Para el DM, instrucciones**: Copywriter escribe los textos y el mapa de instalación; **no toca
  GHL** (`D-18`). Configurarlo solo es una acción futura (`01`, `AG-12`).
- **AG-F07-2 · Cada guion dice de dónde sale**: «Tomé los dolores de tu Research; el que más aparece en tus
  llamadas es el 2» (Lienzo, pantalla «Marketing · Guiones»). Si cita una objeción, es la categoría y su
  frecuencia, no la frase de una persona.
- **AG-F07-3 · Si falta un dato, lo marca** («[COMPLETAR]»), como las herramientas del método; no lo inventa.
- **AG-F07-4 · Exige su propia constante de modelo**: hoy `MODELO` es una sola para todas las herramientas
  de Fundaciones (`lib/fundaciones/generacion.ts:56`).

## Entradas desde otros lugares

- El Espía: «Enviar hallazgos a Copywriter» (`F02`).
- El cerebro: «Crear 3 guiones para esta objeción», como siguiente paso de una respuesta sobre objeciones
  (Lienzo, pantalla «Conversación · respuesta con evidencia»).
- «@ agente» en el Inicio, cuando exista.

## Lo que no es de Copywriter

- Producir la imagen o el video de una pieza: es de Content Studio (`F09`, `fabrica-creativos`).
- Las historias y carruseles de feed como secuencia de publicación: Content Studio (`F09`, `historias-posts`).
