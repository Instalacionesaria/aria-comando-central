# F10 · Sales › Closing

> Sin detector (`D-24`): la cadena de cierre, la cancelación por closer y el ciclo ya son conclusiones con
> denominador, y el cerebro las lee. Cuando haya ventas, el cerebro calcula ROAS y CAC.

| campo | valor |
|---|---|
| Tipo | OPERA, atendido por el cerebro |
| Lugar en el front | Sales › Closing, y su caja del pie |
| Estado | **Herramientas del cerebro** (AG5) |
| Modelo | El del cerebro |
| Permisos | `tablero.ver`, la capacidad de su sección |

## Lo que el cerebro lee acá

`dinero_del_mes`, `cancelacion_de_citas`, `cadena_de_cierre`, `ciclo_hasta_la_cita`, `cierre_por_closer` y
`motivos_de_no_venta`, con los mismos argumentos que la lectura de la pantalla (`lib/negocio/lecturaDeSales.ts:213-220`); y `economia_del_negocio` si la persona ve
también Acquisition.

## Requisitos

- **AG-F10-1 · El dinero es del mes calendario y es venta reportada**, no un pago verificado, y lo dice
  siempre (Arq:267-288; `docs/OTROS/estado actual/11-EXECUTIVE.md:443-476`).
- **AG-F10-2 · ROAS, CAC y costo por venta** los calcula `economia_del_negocio` con la misma función de gasto
  que Acquisition (C7-07, A7-08). Con cero ventas: «no hay dato suficiente», diciendo que las ventas se
  registran en Sales › Closer.
- **AG-F10-3 · La diferencia de cancelación entre closers** se contesta con cifras y su piso; un closer bajo
  el piso se cuenta y no se compara.

## Sugerencias en la caja del pie

«¿Dónde se corta la cadena de cierre?», «¿Qué closer cancela más?», «¿Cuánto tarda la gente en llegar a la
cita?».

## Qué dato falta

Ventas y asistencias registradas: hoy hay cero de las dos.
