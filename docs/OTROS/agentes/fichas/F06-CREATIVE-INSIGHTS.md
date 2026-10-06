# F06 · Marketing › Creative Insights

> El segundo detector, con el mismo molde que Acquisition: las detecciones que son de la pieza (C11-04) y su
> Plan de acción con el formato C6.

| campo | valor |
|---|---|
| Tipo | MIDE (detector) |
| Lugar en el front | Marketing › Creative Insights: el botón «Plan de acción» y la tarjeta de Señales |
| Estado | **Hecho** en AG10, el 2026-10-05: el detector, el plan, las rutas y la pantalla. Corre en la misma pasada diaria que Acquisition |
| Modelo | Ninguno para detectar. `claude-sonnet-5-5` para redactar el plan, si hay llave (la misma redacción que Acquisition, `lib/agentes/plan/redaccion.ts`) |
| Permisos | Los de `F03`, con la pantalla `creative`: `senales.resolver`, `senales.validar` y `umbrales.firmar` |
| Código | `lib/agentes/detectores/creative.ts` (medir y detectar), `lib/agentes/detectores/detector-de-creative.ts` (para la pasada), `lib/agentes/plan/creative.ts` (el formato del plan sobre `lib/agentes/plan/comun.ts`) |

## Qué lee

Lo mismo que su pantalla, con los mismos argumentos (`app/api/creative/route.ts:75-77`): la calidad, el
rendimiento y la fatiga de cada pieza, sobre los mismos días que la pantalla. Esas ventanas llegan hasta hoy
—`ventanaDeMetricas` y la cohorte de contactos— y no son de días cerrados como las de Acquisition: una señal
calculada sobre otra ventana diría otra cifra que la que se ve.

Lo único que no lee la pantalla es la **frecuencia de cada anuncio** (`metricas_de_anuncio.frecuencia`): en los
7 días de la ventana, pesada por impresiones y sólo con los días que la traen. El promedio simple le daría a un
día de cien impresiones el peso de uno de diez mil.

## Las reglas, con su umbral provisional

| código | qué detecta | umbral provisional | piso | gravedad | entidad |
|---|---|---|---|---|---|
| `CRE-CAIDA-DE-CTR` | El CTR de una pieza cae entre la primera y la segunda mitad de su serie, con veredicto de la fatiga | −25 % (la pantalla avisa desde −20 %) | 1.000 impresiones en cada mitad y 8 días de serie: sin eso, la fatiga no da veredicto | media | pieza |
| `CRE-CONCENTRACION` | Una pieza se lleva una porción grande del gasto | 35 % o más | no es una tasa; 3 o más piezas con gasto | media, **requiere validación ejecutiva** | pieza |
| `CRE-FRECUENCIA-ALTA` | Un anuncio se muestra demasiadas veces a la misma persona | 3 veces o más, sólo en 7 días | 1.000 impresiones | media | anuncio |
| `CRE-ICP-POR-PIEZA` | El ICP de una pieza está muy por debajo del promedio de las piezas **de su etapa** (C3-06, C7-10) | 15 puntos | 10 calificados con puntaje | media | pieza |

- **El ICP se compara dentro de la etapa, nunca entre etapas** (C3-06): una pieza de captación no compite con
  una de cierre. El promedio es el de las piezas —«el ICP promedio por pieza es X» (C6-04a)—, no el de los
  contactos. La fila sin etapa o sin creativo no entra en ningún promedio, y una etapa con una sola pieza no
  compara. Una pieza que está baja en dos etapas es **una** señal, la de la caída más grande: la huella es de la
  pieza.
- **La frecuencia es la única regla semanal**: en 30 días no se mide, ni como señal ni como «sin medición».
- **La pieza no tiene otro identificador que su nombre normalizado** (`lib/negocio/creativo.ts`); el del anuncio
  es el de Meta, y su nombre se resuelve al mostrar (`lib/agentes/senales/lectura.ts`).
- **Lo que no se puede medir no se publica**: sin la lectura de anuncios al día (`frescuraDe('anuncios')`), la
  caída del CTR, la concentración y la frecuencia van a «sin medición»; sin el campo de ICP en el CRM, el ICP
  por pieza.

**Lo que no es de Creative** (C11-04, por grano): el gasto sin entrega, el CPM, el CPL, el gasto sin
crecimiento, la concentración por campaña y los cambios por conjunto son de Acquisition (`F03`). Creative no
publica señales de campaña ni de conjunto.

## El Plan de acción

Con el formato que Creative escribió (C6-01, C6-02): el subtítulo dice el criterio y la ventana; el verbo es
el de la medición («está … por debajo del promedio de las piezas de su etapa», «bajó … entre la primera y la
segunda mitad»), no una orden (C6-10). **«Ideas para producir» no va**: generar es de Copywriter (`F07`).

| grupo | qué va |
|---|---|
| Lo que dice la data | el ICP de una pieza contra su etapa (C6-04a) |
| Haz más de esto | nada todavía: ninguna regla mide lo que anda bien. Se guarda vacío y la pantalla no lo dibuja |
| Ajusta o pausa esto | la caída del CTR y la frecuencia alta |
| Requiere validación ejecutiva | la concentración del gasto en una pieza: es presupuesto |

## La pantalla

- **El botón «Plan de acción»** en la barra de `components/creative/PanelDeCreative.jsx`, junto al período, y
  **la tarjeta de Señales** después de la fatiga. Son el mismo componente que Acquisition
  (`components/senales/SenalesDelDepartamento.jsx`), con su hoja `app/senales.css`: lo que cambia por
  departamento es el nombre, que sus ventanas no son de días cerrados y que sus señales no calculan gente
  perdida.
- Rutas gemelas de las de Acquisition: `app/api/creative/senales/route.ts` (vista, resolver, descartar) y
  `app/api/creative/umbrales/route.ts` (firmar). El GET de `app/api/creative/route.ts` suma `senales` y
  `puedeConSenales`.

## Sugerencias en la caja del pie

«¿Qué pieza está cansada?», «¿Qué pieza trae gente más parecida a mi ICP?», «¿Cuánto del gasto se lleva una
sola pieza?».

## Pruebas

- **226** (código): el grano, cada regla con su umbral y su piso, el ICP dentro de la etapa, «sin medición», y el
  plan con sus grupos y sus frases.
- **227** (base): la frecuencia pesada por impresiones, su ventana, el cruce entre empresas, la frescura y el
  nombre del anuncio y de la pieza al mostrar.
- **228** (base): las rutas de Creative, gemelas de la 224.
- **223** (base): en la pasada diaria, sobre la base sembrada, Creative corre junto a Acquisition, no publica
  nada y su plan dice qué no pudo medir.

## Contratos que cumple

C6-01, C6-02, C6-09, C6-10, C11-04, C11-05, C7-09, C7-10.

## Qué dato falta

Gasto nuevo: todo lo que mide Creative describe un período que terminó el 2026-09-13. La serie corta hace
que la fatiga tenga pocas piezas con veredicto, por eso su umbral es provisional.
