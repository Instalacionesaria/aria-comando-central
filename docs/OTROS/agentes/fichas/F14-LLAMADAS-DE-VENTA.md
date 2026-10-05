# F14 · Sales › Llamadas de venta

> Agregados sin modelo sobre lo que los Analizadores ya analizan, más el vínculo de cada llamada con su
> contacto y su closer (`D-20`). La categoría de cada objeción la pone Haiku una vez, al analizar.

| campo | valor |
|---|---|
| Tipo | OPERA (agregados) |
| Lugar en el front | Sales › Llamadas de venta; alimenta al cerebro, a la Reunión de hoy, al Brief y, cuando exista, a Copywriter |
| Estado | **Se construye** en AG11. La pantalla de las llamadas no cambia por dentro |
| Modelo | Ninguno para los agregados. `claude-haiku-4-5-20251001` para la categoría de cada objeción |
| Permisos | `analizadores.ver`, la capacidad de su sección |
| Código | `lib/analizadores/objeciones.ts`, `lib/negocio/vinculoDeLlamadas.ts`, `lib/negocio/llamadasDeVenta.ts` |
| Tabla | `negocio.objeciones_clasificadas` (`073`) |

## La categoría de cada objeción (`T-18`)

- La objeción que hoy guarda el análisis es texto libre. **Haiku la clasifica una vez**, en la tarea del
  analizador, en un juego cerrado: **precio, momento, decisor, confianza, encaje, otra**. Las categorías son
  provisionales y se pueden cambiar sin rehacer nada.
- **Por reconciliación**: la pasada clasifica las que todavía no tienen categoría, así una que falló se
  reintenta sola.
- Se guarda la categoría, el modelo y la fecha. **La cobertura viaja** con todo agregado: «36 de 38
  objeciones clasificadas».

## El vínculo (`T-19`)

Se calcula **al leer**, sin tabla nueva y sin un segundo escritor de las tablas del analizador:

1. por el correo del prospecto contra el contacto;
2. si no, por una cita del contacto a ±12 horas de la reunión, con el organizador como closer.

Y dice siempre **cuántas no casan**. «Llamadas sin usar» quiere decir **sin vínculo** (`D-20`).

## Qué produce

| agregado | para quién |
|---|---|
| Objeciones por categoría, con su frecuencia en la ventana y en la anterior | el cerebro, la Reunión (`REU-OBJECION-FRECUENTE`), el Brief, Copywriter |
| Puntaje por closer, con su piso | el cerebro |
| Llamadas sin vínculo | el cerebro, la Reunión (`REU-LLAMADAS-SIN-VINCULO`) |
| Las frases citables de cada objeción: la frase, el minuto, el enlace a tl;dv y si la llamada se ganó | **sólo** a quien tiene `analizadores.ver`, dentro de la evidencia (`D-20`) |

## Requisitos

- **AG-F14-1 · «Crece» sólo con piso**: una categoría «crece» si la ventana anterior tiene 10 o más llamadas
  y la sube un 50 % o más; si no, se publica como conteo.
- **AG-F14-2 · Ninguna transcripción viaja al cerebro**: sólo categorías, conteos y, con `analizadores.ver`,
  las frases citables.

## Sugerencias en la caja del pie

«¿Qué objeción aparece más?», «¿Qué closer tiene mejor puntaje?», «¿Cuántas llamadas no se pueden vincular a
un contacto?».

## Qué dato falta

Que las llamadas digan si se ganaron: hoy casi ninguna termina en una venta registrada.
