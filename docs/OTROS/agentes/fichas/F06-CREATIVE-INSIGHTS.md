# F06 · Marketing › Creative Insights

> El segundo detector, con el mismo molde que Acquisition: las detecciones que son de la pieza (C11-04) y su
> Plan de acción con el formato C6.

| campo | valor |
|---|---|
| Tipo | MIDE (detector) |
| Lugar en el front | Marketing › Creative Insights: el botón «Plan de acción» y la tarjeta de Señales |
| Estado | **Se construye** en AG10, después del piloto (`D-23`) |
| Modelo | Ninguno para detectar. `claude-sonnet-5-5` para redactar el plan, si hay llave |
| Permisos | Los de `F03`, con la pantalla `creative` |
| Código | `lib/agentes/detectores/creative.ts`, `lib/agentes/plan/creative.ts` |

## Qué lee

Lo mismo que su pantalla, con los mismos argumentos (`app/api/creative/route.ts:63-65`): la calidad, el
rendimiento y la fatiga de cada pieza.

## Las reglas, con su umbral provisional

| código | qué detecta | umbral provisional | piso | gravedad | entidad |
|---|---|---|---|---|---|
| `CRE-CAIDA-DE-CTR` | El CTR de una pieza cae contra la primera mitad de la ventana | −25 % | 1.000 impresiones en cada mitad | media | pieza |
| `CRE-CONCENTRACION` | Una pieza se lleva una porción grande del gasto | 35 % o más | no es una tasa; 3 o más piezas con gasto | media, **requiere validación ejecutiva** | pieza |
| `CRE-FRECUENCIA-ALTA` | Un anuncio se muestra demasiadas veces a la misma persona | frecuencia media de 3 o más en los últimos 7 días cerrados | 1.000 impresiones | media | anuncio |
| `CRE-ICP-POR-PIEZA` | La afinidad con el ICP de una pieza está muy por debajo del promedio (C7-10) | 15 puntos | 10 calificados | media | pieza |

**Lo que no es de Creative** (C11-04, por grano): el gasto sin entrega, el CPM, el CPL, el gasto sin
crecimiento, la concentración por campaña y los cambios por conjunto son de Acquisition (`F03`). Creative no
publica señales de campaña ni de conjunto.

## El Plan de acción

Con el formato que Creative escribió (C6-01, C6-02): el subtítulo dice el criterio y la ventana; el verbo es
el de la medición («está bajo el promedio de su etapa»), no una orden (C6-10). **«Ideas para producir» no
va**: generar es de Copywriter (`F07`).

## Sugerencias en la caja del pie

«¿Qué pieza está cansada?», «¿Qué pieza trae gente más parecida a mi ICP?», «¿Cuánto del gasto se lleva una
sola pieza?».

## Contratos que cumple

C6-01, C6-02, C6-09, C6-10, C11-04, C11-05, C7-09, C7-10.

## Qué dato falta

Gasto nuevo: todo lo que mide Creative describe un período que terminó el 2026-09-13. La serie corta hace
que la fatiga tenga pocas piezas con veredicto, por eso su umbral es provisional.
