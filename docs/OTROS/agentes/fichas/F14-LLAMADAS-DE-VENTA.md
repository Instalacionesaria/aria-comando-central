# F14 · Sales › Llamadas de venta

> Agregados sin modelo sobre lo que los Analizadores ya analizan, más el vínculo de cada llamada con su
> contacto y su closer (`D-20`). La categoría de cada objeción la pone Haiku una vez, al analizar.

| campo | valor |
|---|---|
| Tipo | OPERA (agregados) |
| Lugar en el front | Sales › Llamadas de venta; alimenta al cerebro, a la Reunión de hoy, al Brief y, cuando exista, a Copywriter |
| Estado | **Hecho** en AG11, el 2026-10-05. La pantalla de las llamadas no cambia por dentro: lo leen el cerebro y, después, la Reunión y el Brief |
| Modelo | Ninguno para los agregados. `claude-haiku-4-5-20251001` para la categoría de cada objeción |
| Permisos | `analizadores.ver`, la capacidad de su sección |
| Código | `lib/analizadores/objeciones.ts` (y el juego en `lib/analizadores/categorias.ts`), `lib/negocio/vinculoDeLlamadas.ts`, `lib/negocio/llamadasDeVenta.ts`; la herramienta `llamadas_de_venta` en `lib/agentes/executive/adaptadores/analizadores.ts` |
| Tabla | `negocio.objeciones_clasificadas` (`073`) |

## La categoría de cada objeción (`T-18`)

- La objeción que hoy guarda el análisis es texto libre. **Haiku la clasifica una vez**, en la tarea del
  analizador, en un juego cerrado: **precio, momento, decisor, confianza, encaje, otra**. Las categorías son
  provisionales y se pueden cambiar sin rehacer nada.
- **Por reconciliación**: la pasada clasifica las que todavía no tienen categoría, así una que falló se
  reintenta sola.
- Se guarda la categoría, el modelo y la fecha. **La cobertura viaja** con todo agregado: «36 de 38
  objeciones clasificadas».
- **Una pedida por llamada**, con todas sus objeciones, en el cuarto paso de la tarea del analizador: después
  de descubrir, drenar y completar fichas, con el tiempo que sobre. Con la llave rechazada o el proveedor
  saturado se corta. El uso queda con el agente `objeciones`.
- **El texto no se copia**: la fila nombra la objeción por su posición y por la huella (`md5`) de su texto. Si la
  llamada se vuelve a analizar y el texto cambia, la categoría vieja deja de valer y se clasifica de nuevo;
  quien cuenta junta por posición **y** huella, así que una fila vieja no cuenta.
- De la respuesta vale sólo un índice pedido, una categoría del juego y el primero de cada índice; lo demás se
  descarta y esa objeción se pide en la corrida siguiente.

## El vínculo (`T-19`)

Se calcula **al leer**, sin tabla nueva y sin un segundo escritor de las tablas del analizador:

1. por el correo del prospecto contra el contacto;
2. si no, por una cita del contacto a ±12 horas de la reunión, con el organizador como closer. **Sólo si es
   una**: con dos contactos citados en esas horas no hay forma de saber cuál era, y la llamada cuenta como
   **ambigua**, sin vínculo.

Y dice siempre **cuántas no casan**, con su motivo. «Llamadas sin usar» quiere decir **sin vínculo** (`D-20`).

## Qué produce

| agregado | para quién |
|---|---|
| Objeciones por categoría, con su frecuencia en la ventana y en la anterior | el cerebro, la Reunión (`REU-OBJECION-FRECUENTE`), el Brief, Copywriter |
| Puntaje por closer, con su piso | el cerebro |
| Llamadas sin vínculo | el cerebro, la Reunión (`REU-LLAMADAS-SIN-VINCULO`) |
| Las frases citables de cada objeción: la frase, el minuto, el enlace a tl;dv y si la llamada se ganó | **sólo** a quien tiene `analizadores.ver`, dentro de la evidencia (`D-20`) |

## Requisitos

- **AG-F14-1 · «Crece» sólo con piso**: una categoría «crece» si la ventana anterior tiene 10 o más llamadas
  analizadas y la categoría aparece la mitad más de veces que en ella; si no, `crece` es nulo y se publica el
  conteo. Con «completo» no hay ventana anterior.
- **El closer va por su nombre**, el de quien organizó la reunión; el correo no viaja (`D-17`). Su puntaje
  promedio, sólo con 10 llamadas o más.
- **AG-F14-2 · Ninguna transcripción viaja al cerebro**: sólo categorías, conteos y, con `analizadores.ver`,
  las frases citables.

## Sugerencias en la caja del pie

«¿Qué objeción aparece más?», «¿Qué closer tiene mejor puntaje?», «¿Cuántas llamadas no se pueden vincular a
un contacto?».

## Qué dato falta

Que las llamadas digan si se ganaron: hoy casi ninguna termina en una venta registrada.
