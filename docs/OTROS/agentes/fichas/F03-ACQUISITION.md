# F03 · Systems › Acquisition — el piloto de los detectores

> El primer detector, con todo lo que Acquisition ya escribió: las señales de A6, las diez detecciones de
> A11-05, el monitor de atribución de A11-06 y el Plan de acción. Vuelven el botón «Plan de acción» y la
> tarjeta de Señales a su pantalla (`D-22`).

| campo | valor |
|---|---|
| Tipo | MIDE (detector) |
| Lugar en el front | Systems › Acquisition: el botón «Plan de acción» junto al selector de período y la tarjeta de Señales al final |
| Estado | **En construcción** (AG9). Hechos: el detector con todas las reglas de la tabla, el plan con plantillas, las capacidades, las rutas, la pantalla (`components/senales/SenalesDelDepartamento.jsx`, compartida con Creative desde AG10) y la redacción con el modelo (`lib/agentes/plan/redaccion.ts`). Falta su evaluación real y el hito H3 |
| Modelo | Ninguno para detectar. `claude-sonnet-5-5` para **redactar** el plan, si hay llave |
| Permisos | Leer: `tablero.ver`. Marcar vista, resolver y descartar: `senales.resolver`. Las de validación ejecutiva: `senales.validar`. Firmar un umbral: `umbrales.firmar` |
| Código | `lib/agentes/detectores/acquisition.ts` (medir y detectar), `lib/agentes/detectores/detector-de-acquisition.ts` (lo que corre la pasada), `lib/agentes/plan/acquisition.ts`, `lib/agentes/senales/lectura.ts`, `app/api/acquisition/senales/route.ts`, `app/api/acquisition/umbrales/route.ts`, y `senales` y `puedeConSenales` en el GET de `app/api/acquisition/route.ts` |

## Qué lee

`lecturaDeAcquisition` —la lectura de `embudosDeAcquisition`, con las cifras crudas de cada campaña en las dos
ventanas— sobre **7 y 30 días cerrados** contra su ventana anterior: la misma función, los mismos días cerrados
y la misma edad de los agendados que la pantalla. Además, el último día con entrega de cada campaña en los
últimos 60 días cerrados; el gasto y las impresiones por campaña, y el gasto y los contactos por conjunto (el
contacto, por su `utmTerm`), en las mismas dos ventanas; y `calidadDeLaAtribucion` sobre los mismos días
cerrados, con una ventana de calendario que la pantalla no usa (ella sigue con la móvil). Detectar es puro
(`detectarEnAcquisition`): recibe lo medido y los umbrales, y devuelve detecciones, lo que quedó bajo el piso y
las reglas que no se pudieron medir. Una regla que necesita lo que la pantalla no tiene —un día sin cerrar
(`faltan_dias`), el gasto incompleto (`sinCostos`)— no se publica: va a «sin medición».

## Las reglas, con su umbral provisional

Todas declaran su denominador y su piso (`02`, `AG-26`). Los valores son **provisionales** (`D-11`): salen
del criterio, no de una serie larga, y el Admin los firma.

| código | qué detecta | umbral provisional | piso | gravedad | entidad | va a |
|---|---|---|---|---|---|---|
| `ACQ-SIN-ENTREGA` | Una campaña activa que entregó en los últimos 60 días cerrados y lleva 2 o más sin entregar. Es un estado y no una comparación: se mide igual en las dos ventanas (con «gastaba en la ventana anterior», una pauta parada hace 15 días no daba nada en 7 días). La pausada no cuenta; la de estado desconocido, sí | 2 días | no es una tasa; exige los días cerrados al día | **crítica** si no entrega ninguna activa; alta si alguna sí | campaña, o empresa si son todas | Lo que dice la data |
| `ACQ-CPL-SOSTENIDO` | El costo por contacto sube contra la ventana anterior | +30 % (alta desde +60 %) | 10 contactos en las dos ventanas | media o alta | campaña | Ajusta o pausa esto |
| `ACQ-CPM-ABRUPTO` | El CPM sube contra la ventana anterior | +40 % | 1.000 impresiones en las dos | media | campaña | Lo que dice la data |
| `ACQ-GASTO-SIN-CRECIMIENTO` | El gasto sube y los contactos no | gasto +25 % y contactos sin subir | 10 contactos en la anterior | media | empresa o campaña | Ajusta o pausa esto |
| `ACQ-CONCENTRACION` | Una campaña se lleva casi todo el gasto | 60 % o más, con 3 o más campañas con gasto | no es una tasa | media | campaña | **Requiere validación ejecutiva** |
| `ACQ-CAMBIO-BRUSCO-CONJUNTO` | Un conjunto cambia de golpe su gasto o su costo por contacto; se nombra el cambio más grande de los dos. Sólo en la ventana de 7 días | ±50 % en 7 días cerrados | 10 contactos | media | conjunto | Lo que dice la data |
| `ACQ-ICP-ENTRE-CAMPANAS` | La afinidad con el ICP de una campaña está muy por debajo de su funnel | 15 puntos bajo el promedio | 10 calificados | media | campaña | Ajusta o pausa esto |
| `ACQ-ESCALA-POR-CALIFICADO` | Una campaña consigue calificados mucho más baratos que el resto | costo por calificado ≤ 0,8 × el de la empresa en la ventana | 10 calificados | info | campaña | **Requiere validación ejecutiva** (escalar es presupuesto) |
| `ACQ-FUGA-ENTRE-ETAPAS` | Un par de etapas contiguas pierde mucha más gente que el mismo par en los otros funnels | 15 puntos bajo | 10 en la etapa de origen | media | par de etapas | Lo que dice la data, o Para otras áreas si la etapa es de otro |
| `ACQ-ATRIBUCION-*` | Los cinco puntos del monitor (abajo), con su cifra y lo que deja de valer por ella. Las UTM cuentan lo roto: su cobertura es lo que queda entero. Un punto sin denominador —hoy, las ventas— no se mide | cobertura bajo 0,90 (`COBERTURA_SUFICIENTE`, `lib/negocio/calidadDeLaAtribucion.ts:80`) | 10 en el denominador de cada punto | media | empresa | Lo que dice la data |

Valores relativos y no en moneda a propósito: el `$110` del prototipo no declaraba su moneda
(`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md:551-580`).

## A6 · Requisito por requisito

| requisito | cómo se cumple |
|---|---|
| A6-01 · el conteo viaja con la señal | columna `muestra` |
| A6-02 · bajo 10 se cuenta y no se publica | el piso de cada regla y el renglón del plan |
| A6-03 · la ventana y desde cuándo hay datos | `ventana`, `periodo_desde`, `periodo_hasta`, `datos_desde` |
| A6-04 · la fila «sin anuncio» no compite | se cuenta aparte y nunca es entidad de una señal |
| A6-05 · la entidad es un id | `entidad_id`; el nombre se resuelve al mostrar |
| A6-06 · métrica, valor y base en la misma frase | la plantilla de cada regla |
| A6-07 · el verbo dice si compara entidades o períodos | dos familias de plantillas: «está por debajo de…» (entre entidades) y «subió … contra la semana anterior» (entre períodos) |
| A6-08 · la métrica que agrava va con su cifra o no va | la validación de la redacción |
| A6-09 · la fuga entre dos etapas contiguas | `ACQ-FUGA-ENTRE-ETAPAS`, **sólo para los pares con dato en las dos puntas**. Los pares que tocan la etapa `forms`, que hoy es siempre `null`, quedan postergados; si en AG9 no queda ningún par con dato, la regla entera se declara postergada |
| A6-10 · «el salto más caro» elige una cantidad | se elige **personas**, no costo |
| A6-11 · la fuga lleva su pérdida en personas | `perdida_contactos` |
| A6-12 · cinco partes y el encabezado que renuncia a recomendar | la tarjeta: «Señales detectadas · sin recomendación automática» |
| A6-13 · la severidad es un juego cerrado | `02`, `AG-26` y `AG-34` |
| A6-14 · toda señal muestra sus filas | «Ver evidencia» |
| A6-15 · la evidencia es la cohorte o la pantalla | si la señal es sobre personas, la cohorte; si es sobre una etapa, la pantalla con el período |
| A6-16 · la evidencia necesita la cohorte, no un número | la evidencia guarda los ids de los contactos |
| A6-17 · cuatro grupos en orden | el plan |
| A6-18 · un superlativo con su ranking | la validación de la redacción lo quita si falta |
| A6-19 · se escala por costo por calificado | `ACQ-ESCALA-POR-CALIFICADO`; nunca por costo por contacto |
| A6-20 · cada recomendación, una condición vigente | el plan se arma sólo con señales abiertas o vistas del día |
| A6-21 · «Para otras áreas» con destinatario | `destino_departamento` |
| A6-22 · lo de presupuesto cambia de grupo | «Requiere validación ejecutiva» |
| A6-23 · el plan se calcula sobre la ventana que dice mirar | una fila de plan por ventana |
| A6-24 · el modal abierto no se declara oculto | `components/Ventana.jsx`, sin `aria-hidden` mientras está abierto |

## A11-05 · Las diez detecciones

| detección | dónde queda |
|---|---|
| 1 · caídas inusuales de CTR | Creative (`F06`): es de la pieza |
| 2 · aumentos abruptos de CPM | `ACQ-CPM-ABRUPTO` |
| 3 · aumento sostenido de CPL | `ACQ-CPL-SOSTENIDO` |
| 4 · frecuencia alta | Creative (`F06`), por anuncio y por día |
| 5 · gasto sin crecimiento proporcional | `ACQ-GASTO-SIN-CRECIMIENTO` |
| 6 · diferencias entre leads de Meta y la base | **postergada**: depende del campo de resultados de Meta (C14-P02) |
| 7 · anuncios sin entrega | `ACQ-SIN-ENTREGA` |
| 8 · concentración excesiva de presupuesto | `ACQ-CONCENTRACION` por campaña; Creative publica la de la pieza |
| 9 · cambios bruscos por conjunto | `ACQ-CAMBIO-BRUSCO-CONJUNTO` |
| 10 · cambios de fase de aprendizaje | **no se puede**: el estado del anuncio no llega |

## A11-06 · El monitor de atribución

Vuelve como señales, **en días de calendario cerrados** y con la misma regla de ventanas que
`embudosDeAcquisition` (`docs/OTROS/futuro/monitor-de-atribucion.md`, § 3), así ninguna pantalla mezcla dos
«7 días». Cada punto publica su cifra y **qué deja de valer por culpa de esa cifra**:

| punto | estado |
|---|---|
| 1 · contactos con identificador de anuncio | `ACQ-ATRIBUCION-CONTACTOS` |
| 2 · citas con anuncio identificado | `ACQ-ATRIBUCION-CITAS` |
| 3 · ventas reportadas con anuncio identificado | `ACQ-ATRIBUCION-VENTAS`: hoy, «no hay dato suficiente» (cero ventas) |
| 4 · diferencia entre leads de Meta y del CRM | **postergado**: necesita el campo de resultados de Meta |
| 5 · sesiones con UTM incompletas | `ACQ-ATRIBUCION-UTM` |
| 6 · first-touch sobrescrito | **no se puede**: la base guarda un solo toque |
| 7 · contactos sin campaña o creativo | `ACQ-ATRIBUCION-SIN-CAMPANA` |

## La pantalla

- **El botón «Plan de acción»** en `components/acquisition/PanelDeAcquisition.jsx:182`, junto al selector de
  período. Abre el plan de la ventana elegida en `components/Ventana.jsx`.
- **La tarjeta de Señales**, al final: el encabezado de A6-12, las señales de la ventana elegida ordenadas por
  gravedad y pérdida, cada una con sus cinco partes, «umbral provisional» cuando corresponde y «Ver
  evidencia» (que la marca vista). Resolver y descartar con motivo; validar sólo para quien tiene
  `senales.validar`; firmar el umbral sólo para quien tiene `umbrales.firmar`.
- Con «hoy» o «completo» elegidos, la tarjeta dice que las señales se calculan sobre 7 y 30 días cerrados.
- Sin llave, el plan se ve igual, armado con plantillas.

## Sugerencias en la caja del pie

Las de A7-20: «¿Qué campaña escalo?», «¿Cuál trae el ICP que cierra?», «¿Hay fatiga en algún anuncio?».

## Pruebas y evaluación

221 (el detector es puro), 222 (el plan) y 223 (sobre la base sembrada: en 7 días, la crítica de «sin
entrega» y el monitor —la mitad de los contactos sin anuncio, las UTM siempre incompletas—; en 30, además, la
concentración de Webinar y la fuga de Remarketing; las ventas, sin medir); F03 en `07`, `AG-102`.

## Contratos que cumple

A6-01 a A6-24, A11-05, A11-06, A12-03 (lo que necesita validación ejecutiva), A7-01 a A7-05 a través de la
tabla común.

## Qué dato falta

Gasto: no hay desde el 2026-09-13, así que la primera señal real va a ser «sin entrega». Ventas, para el
punto 3 del monitor. El campo de resultados de Meta, para el punto 4 y la detección 6.
