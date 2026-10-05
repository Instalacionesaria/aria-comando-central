# F00 · El cerebro

> El agente global. Contesta en el Inicio y al pie de cada departamento, con herramientas de sólo lectura
> sobre lo que ya mide la plataforma y con las señales guardadas. El diseño entero está en
> `03-EL-CEREBRO.md`; esta ficha lo resume con la plantilla de todas.

| campo | valor |
|---|---|
| Tipo | EL CEREBRO |
| Lugar en el front | El chat del Inicio; la caja «Pregúntale al cerebro sobre …» al pie de cada entrada, con su panel que sube; CONVERSACIONES en la barra |
| Estado | **Se construye**: servidor en AG5 y AG6, pantalla en AG7 |
| Modelo | `claude-sonnet-5-5` |
| Permisos | `cerebro.usar` para preguntar y borrar; la capacidad de cada sección para leer sus herramientas; apagado bajo delegación |
| Código | `lib/agentes/executive/`, `app/api/executive/route.ts`, una ruta `…/cerebro` por sección |
| Tablas | `conversaciones_del_executive`, `mensajes_del_executive`, `topes_del_executive`, `preguntas_del_executive` (`071`) |

## Qué lee

Las herramientas de `03`, `AG-42`, **sólo las de las secciones que la persona ve**, y las señales guardadas
de los departamentos con detector. Nunca una tabla directa: siempre la función que usa la pantalla.

## Qué produce

Respuestas con forma fija (conclusión, cifras con muestra, período, fuente y evidencia, confianza, áreas,
recomendaciones con guardas, «no hay dato suficiente» con qué falta, siguientes pasos), guardadas en el hilo
de quien preguntó.

## Requisitos

- **AG-F00-1 · No inventa.** Una cifra que no está en su evidencia se quita y se dice (`03`, `AG-47`).
- **AG-F00-2 · No recalcula.** Cada herramienta llama a la función de su pantalla con sus mismos argumentos.
- **AG-F00-3 · No ve más que la persona.** Las herramientas ofrecidas salen de las secciones visibles.
- **AG-F00-4 · No crea.** Para escribir un guion o un documento, ofrece «@ agente» o abrir la herramienta
  que crea.
- **AG-F00-5 · No busca en la web.**
- **AG-F00-6 · Dice la ventana.** Toda cifra dice sobre qué período se calculó; el dinero, que es del mes
  calendario y es venta reportada.
- **AG-F00-7 · Las causas son hipótesis.** Nunca un diagnóstico.

## Metodología

No hay un SOP del cual partir. Las reglas que hereda son las de la plataforma: el piso de 10, los dos ceros
(`null` es que nadie lo cargó, `0` es un hecho medido), la cohorte por un hecho de entrada, mediana y
percentiles en vez de promedio, y las propias de Executive (`docs/OTROS/estado actual/11-EXECUTIVE.md:440-473`).

## Sugerencias en el Inicio

«¿Cómo va la semana?», «¿Qué tengo que mirar hoy?», «¿Dónde se pierde la gente entre el anuncio y la cita?».
Las de cada entrada, en su ficha.

## Pruebas y evaluación

Las de AG5, AG6 y AG7 en `08`; las 20 preguntas de `07`, `AG-102`.

## Contratos que cumple

A7-08 (ROAS, margen y costo por venta los calcula Executive), A7-20 a A7-23 (las preguntas de Acquisition,
las áreas de origen, la ventana declarada), S8-06 y LP08-15 (`02`, `AG-36`).

## Qué dato falta

Ventas reportadas para todo lo que es dinero por venta; la trazabilidad hasta la venta que pide Arq §16.2
(`D-07`: se construye igual y lo dice).
