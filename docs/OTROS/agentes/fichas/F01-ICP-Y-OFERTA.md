# F01 · Research › ICP & Oferta

> El entrevistador que ya existe: un solo agente conversacional para las herramientas del método, que
> completa campos y deja que la ruta de siempre genere el documento.

| campo | valor |
|---|---|
| Tipo | CREA |
| Lugar en el front | Research › ICP & Oferta, las 7 herramientas del método |
| Estado | **Existe.** Suma el uso (AG2, después de integrar la rama), recibe el pedido de «@ agente» (AG7) y lo lee el cerebro (AG6). Su voz la cambia la rama `feature/icp-oferta-v2` |
| Modelo | `claude-sonnet-5`, sin cambio (`D-15`) |
| Permisos | `fundaciones.ver` para leer, `fundaciones.editar` para conversar y generar |
| Código | `lib/fundaciones/conversacion.ts` (el entrevistador), `lib/fundaciones/generacion.ts` (la generación), `lib/fundaciones/relleno.ts` |

## Qué lee

Las preguntas de cada herramienta (el catálogo de campos), lo ya respondido, lo heredado de las herramientas
anteriores y el entregable propio. El historial vive en el servidor.

## Qué produce

Respuestas a los campos y, cuando están completos, la generación del documento por la ruta de siempre. Los
documentos quedan en el almacén de Fundaciones (tablas `public.aria_cc_*`, fuera de este repositorio).

## Lo que cambia en esta fase

- **AG-F01-1 · El uso queda registrado** en `negocio.uso_de_ia`: generar, conversar y rellenar.
- **AG-F01-2 · Recibe el pedido de «@ agente».** Elegir ICP & Oferta en el Inicio y escribir un pedido abre la
  herramienta con el pedido cargado en el campo del chat, **sin enviarlo** (`03`, `AG-56`).
- **AG-F01-3 · El cerebro lo lee**: qué entregables hay, qué paso del método falta, extractos acotados del
  ICP y la oferta (herramienta `fundaciones`).
- **AG-F01-4 · Tú neutro**: lo hace la rama `feature/icp-oferta-v2` (`00-MAPA.md`).

## Lo que no cambia

Su cuerpo, su modelo, su herramienta forzada y la regla de que **el agente no genera**: genera la ruta.

## Sugerencias en la caja del pie

«¿Qué paso del método me falta?», «Resume mi oferta en una frase», «¿Qué dice mi ICP de su objeción
principal?».

## Diseño para después

El Lienzo (pantalla «Research · ICP & Oferta») muestra el entregable escribiéndose a la derecha con cada
respuesta, y el código genera al final. Ese cambio y las dos columnas quedan para después (`D-18`).

## Metodología

`lib/fundaciones/skills/*`, copias de las de ARIA-brain.

## Qué dato falta

Nada para esta fase.
