# El contrato de señales

> Una sola tabla, `negocio.senales`, para todos los detectores; su ciclo de vida; la gravedad y la
> confianza; los umbrales provisionales y firmes; el Plan de acción de cada departamento y la tarea diaria
> que los produce. Requisitos `AG-20` a `AG-39`.

---

## De dónde sale

- `D-09`, `D-10`, `D-11`, `D-22` y `D-23` de `00-MAPA.md`.
- La alerta de 14 campos de Arq §18.13, transcripta en `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:127-161`.
- Los requisitos de forma que Acquisition ya escribió para sus señales (A6-01 a A6-24,
  `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`), los de Creative (C11, C6), los de Conversion (CV6) y
  los contratos de entrega (A7, CV7, C7, S8, LP08).
- Arq §2.3 y §18.10: lo que toca presupuesto, varias áreas o la estrategia lo valida Executive.

---

## AG-20 · La tabla `negocio.senales`

Una fila por señal. Entre corchetes, el campo de la alerta de Arq que cubre.

| grupo | columnas |
|---|---|
| Identidad | `org_id`, `id` [alert_id], `creada_el` [created_at] |
| Origen | `departamento` (`acquisition`, `creative`, `conversion`, `conversation`), `detector`, `regla` (el código del catálogo de umbrales, por ejemplo `ACQ-CPL-SOSTENIDO`) |
| Entidad | `entidad_tipo` [entity_type], de un juego cerrado (`AG-21`); `entidad_id` [entity_id], texto |
| Medida | `metrica` [metric], `linea_base` [baseline], `valor_actual` [current_value], `cambio_pct` [change_percentage], `muestra` (el denominador, A6-01), `ventana` (`7d` o `30d`), `periodo_desde` y `periodo_hasta` [period_start, period_end], `datos_desde` (desde cuándo hay datos, A6-03) |
| Juicio | `gravedad` [severity], `confianza` [confidence], `causas_posibles` text[] [possible_causes], `revision_recomendada` [recommended_review] |
| Contrato | `perdida_contactos` (A6-11), `destino_departamento` (A6-21), `requiere_validacion_ejecutiva` (A6-22), `umbral` jsonb (el valor con que se calculó, en foto, y si era provisional), `evidencia` jsonb (en foto, `AG-28`), `issue_source` (sólo Conversation, `AG-37`) |
| Vida | `estado` (`AG-23`), `huella`, `ultima_deteccion_el`, `vista_el`, `vista_por`, `cerrada_el`, `cerrada_por`, `motivo_cierre`, `condicion_apagada_el` |

Escritor único: `lib/agentes/senales/escritura.ts`. Migración `072`.

## AG-21 · El juego cerrado de entidades

`campana`, `conjunto` (ad set), `anuncio`, `pieza` (el creativo), `funnel`, `par_de_etapas`
(`funnel:etapa>etapa`, A6-09), `familia_de_entrada` (Conversion), `patron` (Conversation), `agente` (el
agente del CRM que audita Conversation), `closer`, `llamada`, `empresa`. La entidad es **siempre un
identificador, nunca un nombre** (A6-05): el nombre se resuelve al mostrar.

## AG-22 · La huella y la reconciliación diaria

- La **huella** es `departamento · regla · entidad_tipo · entidad_id · ventana`.
- Cada pasada diaria **reconcilia**: lo que detecta y ya existe actualiza `ultima_deteccion_el`; lo nuevo
  inserta una fila; lo que existía y no se detectó cambia de estado según `AG-23`.
- Hay un índice único parcial por huella entre las filas que **bloquean**: `abierta`, `vista`,
  `sin_medicion`, y también `descartada` y `resuelta` **mientras su condición siga cumpliéndose**
  (`condicion_apagada_el is null`).

Con eso, **una señal descartada no renace cada mañana**: mientras la regla siga dando lo mismo, la pasada
actualiza la descartada y no crea otra. Cuando una pasada deja de detectarla se anota
`condicion_apagada_el`; si después vuelve, es un hecho nuevo y nace una fila nueva. Lo mismo si **la gravedad
sube** (por ejemplo de media a crítica) sobre una descartada o resuelta: es un cambio material, la decisión
deja de bloquear y nace una fila nueva. Sobre una viva no hay decisión que respetar: se actualiza y, si estaba
`vista`, vuelve a `abierta` sin la marca, porque lo que alguien vio era menos grave (AG8,
`lib/agentes/senales/escritura.ts`).

## AG-23 · El ciclo de vida

| estado | quién lo pone | cuándo |
|---|---|---|
| `abierta` | la pasada | al detectarla |
| `vista` | una persona | al abrir su evidencia (`AG-24`) |
| `resuelta` | una persona, con motivo | lo que había que hacer se hizo |
| `descartada` | una persona, con motivo | no aplica, o ya se sabe y se decidió no actuar |
| `cerrada_sola` | la pasada, sin autor | la fuente se midió y la condición ya no se cumple |
| `sin_medicion` | la pasada, sin autor | **la fuente dejó de llegar**: no se puede afirmar que siga ni que se haya ido |

`sin_medicion` existe para no mentir: si Meta deja de mandar gasto, las señales de costo no «se cierran
solas» —eso afirmaría que la regla dejó de cumplirse cuando en realidad dejó de poder medirse—. Se decide
con la frescura de la tarea que alimenta la regla (`frescuraDe`, `lib/negocio/frescura.ts:112`). Cuando la
fuente vuelve, la señal vuelve a `abierta` o pasa a `cerrada_sola`, según lo que se mida.

## AG-24 · «Vista»

La marca **quien la abre**: al desplegar «Ver evidencia», la pantalla hace un POST explícito
(`accion:'vista'`) con la misma capacidad que resolver. Una lectura (un GET) nunca escribe. Es global (la
primera persona) y queda con autor y fecha. Quien no tiene la capacidad la ve sin marcarla. Bajo delegación
no se marca.

## AG-25 · Quién resuelve y quién valida

- **Las señales locales** las resuelve o descarta quien tenga `senales.resolver` (los tres roles) y vea la
  pantalla del departamento.
- **Las que `requiere_validacion_ejecutiva`** sólo las resuelve o descarta quien tenga `senales.validar`
  (administrador y superadministrador): un `usuario` de Acquisition no puede saltarse la validación que pide
  Arq §2.3.
- Siempre con motivo, autor y fecha. **Bajo delegación se rechaza en el servidor**: escribir un autor de la
  principal dentro de un cliente da `23503` (`docs/OTROS/estado actual/09-DEUDA-ABIERTA.md:871-906`).

## AG-26 · Gravedad y confianza

- **Gravedad**: `critica`, `alta`, `media`, `info` (`D-10`). Cada regla del catálogo dice qué gravedad da y
  por qué.
- **Confianza**: `alta` con 30 o más casos en el denominador; `media` de 10 a 29.
- **Debajo de 10 no hay señal**: se cuenta (A6-02). Es el piso de todo el sistema, `PISO_DE_UNA_TASA = 10`
  (`lib/negocio/indicadoresDeCitas.ts:329`), y **toda regla declara su denominador** (impresiones,
  contactos, citas, llamadas) para que el piso se aplique al denominador correcto.

## AG-27 · Lo que no llega al piso se cuenta

El Plan de acción lleva siempre el renglón «N detecciones por debajo del piso de muestra», con el detalle a
un clic. La fila «sin anuncio» se cuenta y no compite (A6-04).

## AG-28 · La evidencia viaja como foto

La evidencia es lo que produjo la señal (A6-14): las filas, el total, la ventana y los avisos de la función
que midió, guardados en el momento. No se recalcula al mostrarla (C11-05). La pérdida en contactos
(A6-11) es la de **la ventana de la señal**, y la señal la dice («7 días cerrados al 3 de octubre»).

A7-17 pide que la pérdida «se escale con el período que se está mirando». Se cumple así: el detector corre
sobre **7 y 30 días cerrados**, cada señal es de una ventana, y la pantalla muestra las de la ventana
elegida en su selector. «Hoy» y «completo» no comparan contra nada (`lib/negocio/embudosDeAcquisition.ts`
ya lo resuelve así), así que con esas dos la tarjeta dice sobre qué ventanas se calculan las señales.

## AG-29 · La pérdida se cuenta en contactos

Las señales se ordenan por `perdida_contactos` (A6-11, A7-03, CV6-02). Una señal sin pérdida calculable va
después de las que la tienen, y lo dice.

## AG-30 · Dos niveles

- **Local**: se ve en la tarjeta de Señales de la pantalla del departamento y en su Plan de acción.
- **Validación ejecutiva** (`requiere_validacion_ejecutiva`): lo que toca presupuesto, varias áreas o la
  estrategia (A12-03, A6-22). Además de su pantalla, sube a la Reunión de hoy y el cerebro la lee primero.

## AG-31 · El destino

Una señal con `destino_departamento` se ve también en la pantalla receptora, en un bloque «Recibidas de
otras áreas» (A7-15 a A7-18), con la acción escrita aparte del hallazgo (A7-16).

## AG-32 · El Plan de acción, con el formato de cada departamento

Se guarda en `negocio.planes_de_accion`: una fila por empresa, departamento, ventana y día local, **también
cuando está vacía** (el plan vacío dice que se miró y no hubo nada).

| departamento | formato | de dónde |
|---|---|---|
| Acquisition | Cuatro grupos en este orden —«Lo que dice la data», «Ajusta o pausa esto», «Haz más de esto», «Para otras áreas»— más «Requiere validación ejecutiva», adonde van las recomendaciones de presupuesto sin cambiar de redacción. Todo superlativo con el ranking que lo sostiene; la escala por costo por **calificado**, no por contacto; cada recomendación, una condición vigente; calculado sobre la ventana que dice mirar | A6-17 a A6-23 |
| Creative | Sus propios grupos en el orden de C6-02 —«Lo que dice la data» (el ICP de una pieza contra su etapa), «Haz más de esto» (vacío mientras ninguna regla mida lo que anda bien), «Ajusta o pausa esto» (la caída del CTR y la frecuencia)— más «Requiere validación ejecutiva» (la concentración del gasto), con el subtítulo que dice criterio y ventana, y el verbo de la medición («está bajo el promedio de su etapa», no «pausá»). «Ideas para producir» no va: generar es de Copywriter | C6-01, C6-02, C6-10 |
| Conversion | Las fugas ordenadas por personas perdidas; sólo las tres primeras bajo «Qué hacer primero»; el bloque «No tocar»; a quién le toca cada fricción; ningún coeficiente de recuperación inventado; ningún nombre de persona | CV6-02 a CV6-08 |
| Conversation | Por agente del CRM y por patrón, con su `issue_source`; el auditor sigue proponiendo y una persona sigue aprobando los cambios de prompt (Arq:933-949) | `AG-37` |

**Con llave**, el modelo (Sonnet 5.5) sólo **redacta** dentro de los huecos de la plantilla. Lo que redacta
pasa por la misma validación que las respuestas del cerebro: una cifra que no está en la evidencia se quita.
**Sin llave**, el plan se arma entero con plantillas.

## AG-33 · Los umbrales

- **El catálogo provisional vive en el código** (`lib/agentes/senales/umbrales.ts`): cada regla con su
  código, su valor, su unidad (`proporcion`, `puntos_porcentuales`, `puntos`, `dias` o `veces`), su denominador,
  su piso, su gravedad y el porqué del valor. En pantalla, cada señal
  calculada con un valor provisional dice «umbral provisional».
- **La firma vive en `negocio.umbrales`**: una fila por empresa y regla, con el valor firme, quién y
  cuándo. La escribe quien tiene `umbrales.firmar` (el Admin, `D-11`), desde la misma tarjeta de Señales.
- **La señal guarda en foto el umbral** con que se calculó.
- Los umbrales de la Reunión de hoy (`04`) entran en el mismo catálogo y se firman igual.

Esto corrige `docs/OTROS/futuro/plan-y-senales-de-acquisition.md`, que decía que los umbrales se aprueban
**antes** de publicar: con `D-11` se publican desde el primer día, marcados, y se firman después.

## AG-34 · El estado del departamento

Para la ficha del departamento (A7-05, A6-13): **crítica** abierta da `crit`; **alta o media** dan `warn`;
sin señales abiertas, `ok`. Va con el conteo de señales abiertas y vistas.

## AG-35 · La tarea diaria `senales`

Una tarea nueva del cron único (`T-12`):

- **Horario** `23 * * * *`: el minuto 23 está libre (los ocupados son `*/10`, 3, 41, 6:17 y 10:07 en
  `vercel.json`).
- **Sólo a las empresas a las que les toca**: las que ya pasaron las **6:00 de su zona**
  (`horaDelDiaEnZona`, `lib/negocio/tiempo.ts:262`) y todavía no tienen la pasada de su día local
  (`diaEnZona`, `:61`). **«Ya corrió» se decide por departamento**: si Creative falló, se reintenta la hora
  siguiente aunque Acquisition haya terminado.
- **A las demás no se las sella.** `sellar` guarda una sola fila por empresa y tarea
  (`lib/negocio/barrido.ts:983`) y la frescura mide su fecha: un sello de «no me tocaba» cada hora haría
  parecer al día una tarea diaria que no corrió. Umbral de frescura de 2.940 minutos —el de una tarea
  diaria, aunque el disparo sea horario—. La única excepción es la primera pasada del día de una empresa sin
  departamentos pendientes, que se sella una vez para que la frescura diga que pasó.
- **No necesita el token del CRM**: entra en la excepción de `lib/negocio/barrido.ts:527-535`, como la auditoría
  y los Analizadores; si no, se sellaría `saltada` en toda empresa sin GHL.
- **Presupuesto propio**, como `FIN_PARA_LOS_ANALIZADORES_MS` (`lib/negocio/barrido.ts:360`): la espera de
  cada llamada al modelo es la menor entre 120 s y lo que quede menos 15 s.
- **Primero guarda, después redacta**: las señales y el plan armado con plantillas se guardan sin modelo;
  la redacción es una mejora que, si no llega, deja el plan de plantillas.
- **Si el dato de anuncios del día no se recolectó todavía** (la tarea `anuncios` corre a las 6:17 UTC), el
  detector de Acquisition no publica señales de costo: dice «dato no recolectado». Si no, una empresa al
  este de UTC tendría una falsa «sin entrega» crítica todas las mañanas.
- **Las llaves de IA se resuelven sólo en la corrida del minuto 23**, no en cada corrida del cron.
- La Reunión de hoy se arma en la misma pasada, **después** de los detectores (`04`).

## AG-36 · Lo que la tabla común hace con los contratos ya escritos

| contrato | cómo se cumple |
|---|---|
| A7-01 a A7-05, la ficha del departamento | El estado sale de `AG-34`. «Lo que más cuesta» es la señal con más `perdida_contactos`. «Con otras áreas» sale de `destino_departamento`, con los verbos Necesito, Entrego y Recibo. «Su número» (A7-02) lo da la herramienta del cerebro de ese departamento: la ficha no se dibuja en ninguna pantalla en la v1 |
| A7-08, ROAS, CAC y costo por venta | La herramienta `economia_del_negocio` del cerebro (`03`) |
| A7-11 a A7-14, conflicto entre áreas | Se diseña una señal de clase `conflicto` con la evidencia de cada área. **No se construye**: falta que Acquisition publique su costo por contacto por anuncio en la misma ventana que la tasa de Conversion (A7-12) |
| A7-15 a A7-19 | `destino_departamento` y el bloque «Recibidas de otras áreas» |
| CV7-09 | Lo que Conversion entrega a Executive: sus señales de validación ejecutiva |
| CV7-04 y CV7-10, el cruce con Acquisition | **Postergado**: el cruce es por nombre de creativo y ningún contacto con formulario trae `adId`. Una señal no puede usar un nombre como entidad (`AG-21`) |
| C7-09 y C7-10 | La señal del ICP por pieza (ficha F06) |
| S8-06 | Sales no tiene detector: la cadena, la cancelación por closer y el ciclo son herramientas del cerebro |
| LP08-15 | La cohorte por tramo es una herramienta del cerebro. «Abrir con contexto» hacia Leads queda bloqueado por LP08-P02 (el portal no acepta filtro) |

## AG-37 · Conversation: la traducción a `issue_source`

El auditor no cambia (`D-23`). En la pasada diaria, `lib/agentes/detectores/conversation.ts` lee los
hallazgos de 14 días y publica **una señal por agente del CRM y por patrón**, con su muestra y su evidencia
(ids, nunca citas). La traducción a la taxonomía de Arq (Arq:846-854):

| hallazgo del auditor | `issue_source` |
|---|---|
| `comportamiento` con un fragmento del prompt señalado | `prompt_design` |
| `comportamiento` sin fragmento | `agent_execution` |
| `base_conocimiento` o `informacion_adicional` | `missing_data` |

`missing_tool`, `workflow_configuration` y `external_failure` se declaran «sin fuente hoy», y un hallazgo sin
categoría no lleva `issue_source`: no se inventa una fuente. La gravedad: rojo da `alta`, amarillo da `media`. El
auditor sigue siendo el único escritor de `negocio.hallazgos` (lo mira `pruebas/codigo/234`). Hecho en AG13: los
hallazgos son los abiertos de la ventana de la señal, 7 o 30 días, no los de 14 días.

## AG-38 · Lo que la tabla no hace

- No decide: `revision_recomendada`, nunca una acción (A11-05).
- No guarda texto libre de personas (mensajes, transcripciones): sólo ids y cifras.
- No reemplaza a `negocio.hallazgos` ni a los análisis de los Analizadores: los lee.

## AG-39 · La acción propuesta, reservada

Cuando lleguen las acciones (`D-03`), una recomendación podrá traer una acción con su ciclo: `propuesta` →
`aprobada` (quién, cuándo) → `ejecutada` (resultado, quién, cuándo) o `rechazada` (motivo). Ni la tabla ni
la capacidad existen todavía (`01`, `AG-12`).

---

## Lo que no se pudo verificar

- Cuántas señales daría hoy cada regla sobre producción. Con el negocio detenido desde el 2026-09-13, la
  primera señal real de Acquisition va a ser «sin entrega»; la base sembrada (`07`) es la que prueba el resto.

## Preguntas abiertas

Ninguna para el usuario. Los valores provisionales de cada regla están en su ficha y se firman con `D-11`.
