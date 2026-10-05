# Modelos, uso, topes e incidentes

> Qué modelo usa cada agente, cómo se mide lo que cada llamada consume, cuánto puede preguntar cada persona
> y cada empresa por día, y qué pasa cuando el modelo falla. Requisitos `AG-90` a `AG-99`.

---

## De dónde sale

- `D-15`, `D-16` y `D-30` de `00-MAPA.md`.
- Lo que había al planificar, antes de AG2: tres constantes que valen `claude-sonnet-5` (`lib/fundaciones/generacion.ts:56`,
  `lib/auditor/modelo.ts:62`, `lib/analizadores/nucleo/anthropic.ts:34`) y el clasificador con el alias
  `claude-haiku-4-5` (`lib/analizadores/nucleo/anthropic.ts:37`); sólo los Analizadores guardan sus tokens;
  el costo es `null` porque no hay tarifa confirmada (`lib/analizadores/nucleo/pricing.ts:42`); los fallos
  se clasifican en situaciones `IA-*` (`lib/fundaciones/fallo-del-modelo.ts:72`) y quedan en
  `negocio.incidentes` (`lib/incidentes/registro.ts:32`), pero sólo desde Fundaciones, Tools y el Espía.
  Desde AG2 guardan su uso en `negocio.uso_de_ia` el Espía, el auditor y los Analizadores, y los dos últimos
  también sus incidentes (AG-98).

---

## AG-90 · El modelo de cada agente

Una constante por agente (`D-15`). Las de los agentes nuevos viven en `lib/agentes/modelos.ts`; las de los
que ya existen **se quedan donde están**, con su valor.

| agente | modelo | por qué |
|---|---|---|
| El cerebro | `claude-sonnet-5-5` | responder con herramientas |
| La redacción del Plan de acción | `claude-sonnet-5-5` | redactar |
| La Reunión de hoy | `claude-sonnet-5-5` | ordenar y redactar no es clasificar |
| El Brief del closer | `claude-sonnet-5-5` | crear |
| La categoría de cada objeción | `claude-haiku-4-5-20251001` | clasificar |
| Copywriter (sólo diseño) | `claude-sonnet-5-5`; su constante entra a `lib/agentes/modelos.ts` cuando se construya | crear |
| Fundaciones, el Espía, el auditor | `claude-sonnet-5`, sin cambio | se evalúan después (`D-15`). Pasar a `claude-sonnet-5-5` exige quitar el `tool_choice` forzado del entrevistador, del relleno y del auditor; la 199 lo vigila |
| Los Analizadores | `claude-sonnet-5` y el alias `claude-haiku-4-5`, sin cambio | ídem |

## AG-91 · La lista de modelos válidos

`pruebas/apoyo/modelos-validos.ts:19-26` fija los identificadores aceptados —la usan la 90 y la 199— y suma
`claude-sonnet-5-5` (`claude-haiku-4-5-20251001` ya estaba). La 199 exige que **cada constante de
`lib/agentes/modelos.ts`** esté en esa lista: un identificador mal escrito no falla en ninguna prueba con
`fetch` falseado, falla en producción con `IA-MODELO` en todas las preguntas.

## AG-92 · Antes de la primera llamada real

Se comprueba, **con el OK del usuario**, que la llave de la organización principal alcanza
`claude-sonnet-5-5`: un `GET /v1/models/claude-sonnet-5-5` por `pedirExterno`, sin tokens. Con el mismo OK,
un `POST /v1/messages/count_tokens` (no genera) confirma que esta cuenta rechaza el `tool_choice` forzado con
ese modelo, como dice la referencia de la API. Nunca con la llave de un cliente. Es la tanda `modelo` de
`scripts/evaluar-agentes.mjs` (AG4): `--confirmo 2`.

## AG-93 · El transporte

`lib/agentes/llamada.ts`, sobre `pedirExterno`:

- **la dirección y la versión de la API vienen de un solo lugar**, `lib/agentes/proveedor.ts:19-22`: el
  transporte las importa, y las cinco copias de los módulos que ya existían las ata la 171;
- **un reintento**, sólo si el fallo es pasajero (`esPasajero`, `lib/fundaciones/fallo-del-modelo.ts:182`) y
  llegó temprano —dentro de 90 s y de la mitad de lo que deja la pausa—, con lo que QUEDA del tope; si el
  reintento sale bien, igual queda el incidente marcado `salvado`, como en `generar`;
- sin tiempo antes de empezar es `IA-TIEMPO`, y una llave que no puede ir en una cabecera es `IA-LLAVE`, los
  dos sin pedido; la espera se recorta a un entero;
- truncada es tanto la respuesta que llegó al techo (`max_tokens`) como la que llenó la ventana de contexto
  (`model_context_window_exceeded`): las dos se dicen antes de leer;
- clasifica el fallo, registra el uso y, si falla, el incidente. Una tarea del cron pide
  `los_agrega_quien_llama`: el transporte no escribe el incidente y la tarea los agrega por corrida (`AG-98`);
- **la salida estructurada nunca con una herramienta forzada**: `claude-sonnet-5-5` rechaza `tool_choice`
  `tool` o `any` con un 400. Va por `output_config.format` (un JSON Schema) o por herramientas con
  `strict: true` que el prompt pide usar; `tool_choice` sólo viaja como `auto` o `none`. El modo estricto no admite
  `minimum`/`maximum`, `minLength`/`maxLength` ni restricciones complejas de arreglos;
- no se manda `thinking`: `claude-sonnet-5-5` piensa por omisión y el techo cubre pensamiento y texto. La
  profundidad se gobierna con `esfuerzo` (`output_config.effort`), que el transporte no le manda a Haiku 4.5
  aunque se lo pidan (lo rechaza con un 400);
- `cache_control` en las instrucciones y en la última herramienta, de 5 minutos; opcionalmente, también en la
  cola de la conversación. La vida de una hora no necesita cabecera beta y se decide con los contadores de
  `negocio.uso_de_ia` (AG7).

## AG-94 · `negocio.uso_de_ia`, una fila por llamada

Migración `069`. Columnas: `org_id`, `id`, `creado_el`, `agente` (de un juego cerrado: `executive`, `plan`,
`reunion`, `brief`, `objeciones`, `fundaciones_generar`, `fundaciones_conversar`, `fundaciones_rellenar`,
`espia`, `auditor`, `auditor_mejora`, `analizador_clasificar`, `analizador_analizar`, `analizador_ficha`),
`modelo`, los cuatro contadores (`tokens_entrada`, `tokens_salida`, `tokens_escritura_cache`,
`tokens_lectura_cache`), `duracion_ms`, `resultado` (`ok` o la situación `IA-*`), `usuario_id` (nulo en el
cron; `on delete set null`, como la `068`) y `ref` (el hilo, el análisis o la referencia del incidente).
**Ningún texto.**

- **Una fila por llamada, no por intento**: el primer intento de un reintento es un rechazo o una respuesta
  que no llegó, y nunca trae `usage`.
- **Los contadores son nulos cuando el proveedor no contestó**; cuando contestó y la respuesta no sirvió
  (truncada, declinada, sin estructura) llevan sus valores, con 0 en el contador que faltó: se pagó.

- El único escritor es `registrarUso` (`lib/agentes/uso.ts`), que **nunca lanza**: un fallo al registrar el
  uso no puede tumbar la respuesta que ya se pagó.
- No se llama dentro de una transacción abierta (`01`, `AG-05`).
- **Es la única fuente del consumo de IA.** Las columnas de tokens de los Analizadores siguen siendo parte de
  su registro de análisis, pero quien quiera saber cuánto se consumió lee `uso_de_ia`: dos tablas que miden
  lo mismo darían dos verdades (regla 12).
- La ven: Ajustes, el uso del día de esa empresa contra sus topes (`AG-97`); Monitoreo, sólo desde la
  principal, el uso por empresa.

## AG-95 · El costo

Se calcula con las tarifas confirmadas (`CONFIRMED_RATES`, `lib/analizadores/nucleo/pricing.ts:42`). Mientras
nadie las confirme contra la factura de Anthropic, el costo es `null`, nunca `0`.

## AG-96 · Los topes

- **50 preguntas por persona y 300 por empresa por día**, por omisión (`D-16`). Viven en
  `negocio.topes_del_executive`, una fila por empresa, con quién y cuándo los cambió.
- **El día es el de la empresa**: se cuenta desde la medianoche de su zona.
- **Se cuentan las preguntas** en un registro propio, `negocio.preguntas_del_executive`, una fila por
  pregunta y sin texto, que **no cuelga de los hilos**: borrar un hilo no devuelve sus preguntas al tope (la
  primera versión contaba los mensajes, que caen con su hilo, y borrar los hilos reiniciaba el tope; lo
  encontró la revisión de AG5). La pregunta se **reserva** en la misma transacción corta que mira el tope,
  bajo `select … for update` sobre la fila de topes de la empresa (la casa bloquea filas, como
  `lib/negocio/pulso.ts`), así dos preguntas en paralelo no pasan juntas el 50.
- **Una pregunta que falla sin que el proveedor conteste no cuenta.** Una que falla **después de pagarse**
  —truncada, declinada, sin la forma de `responder`— **sí** cuenta: si no, una pregunta hecha para no
  llegar nunca a la forma costaría seis rondas y se podría repetir sin límite.
- **Una reserva vence a los diez minutos**: si la plataforma corta la función antes de marcar la pregunta,
  esa reserva no ocupa un lugar hasta la medianoche.
- **No cuentan**: abrir un tema de la Reunión, generar el Brief al abrir una cita, la redacción del plan
  del cron. **Sí cuenta** regenerar el Brief a mano.
- Al llegar al tope, el cerebro pasa al estado `tope` (`03`, `AG-52`) y dice a qué hora se renueva.

## AG-97 · Ajustar los topes

`app/api/admin/cerebro/route.ts`, con `PANTALLA='credenciales'` como las demás rutas de Ajustes: el GET pide
`credenciales.ver` y el PUT `credenciales.editar`, así que los ajusta el Admin (el rol `usuario` no tiene
`credenciales.%`). La pantalla muestra el uso del día contra los topes. Bajo delegación se puede ajustar,
con autor nulo (`05`, `AG-82`).

Hecho en AG7: la ruta, `fijarTopes` y `topesDeLaEmpresa` en `lib/agentes/executive/topes.ts` (su único
escritor), y la tarjeta en Ajustes › Credenciales (`components/ajustes/TopesDelCerebro.jsx`). Los dos topes
van juntos, enteros entre 1 y `TOPE_MAXIMO` (5.000), y el de una persona no pasa al de la empresa. La prueba
es la 218.

## AG-98 · Incidentes

- **Todo fallo de un agente** pasa por `clasificarFallo` y queda en `negocio.incidentes` (`D-30`). Desde AG2
  también el auditor y los Analizadores, que antes no registraban.
- **Agregados también al sincronizar los Analizadores**: lo aprieta una persona, pero clasifica hasta cuarenta
  reuniones de una vez. El incidente lleva quién lo vio. Analizar una llamada o pedir su ficha desde la
  pantalla anota uno por fallo, como Fundaciones.
- **El `donde` de un incidente agregado dice el paso y cuántas** llamadas de la corrida fallaron así («la
  clasificación de una reunión de tl;dv · 3 llamadas de esta corrida»), y lo técnico es el del primero. El
  primero se escribe en el acto y el número se le pone al terminar: una corrida cortada por la plataforma
  deja al menos ese.
- **Agregados por corrida y situación** en las tareas del cron: el auditor corre cada 10 minutos con hasta
  20 inferencias, y un proveedor caído no puede llenar el panel con una fila por conversación. Los agentes
  nuevos que corren en el cron llaman al transporte con `los_agrega_quien_llama` (`AG-93`).
- Las situaciones `IA-*` que ya existen alcanzan; el `check` de la tabla admite cualquier `IA-…`
  (`db/migraciones/067_los_incidentes.sql`). El `origen` suma `executive`, `plan`, `reunion`, `brief`,
  `objeciones`, `auditor` y `analizador`.

## AG-99 · El uso en el cron

Sin persona: `usuario_id` nulo. La tarea `senales` registra el uso de la redacción del plan y de la Reunión;
la del analizador, el de la clasificación de objeciones.

---

## Lo que no se pudo verificar

- La tarifa de `claude-sonnet-5-5`. Hasta confirmarla contra la factura, el costo es `null`.
- Que esta cuenta rechace el `tool_choice` forzado con `claude-sonnet-5-5`: lo dice la referencia de la API, no
  está medido. Se confirma con `count_tokens` y el OK del usuario (`AG-92`).
- Desde qué tamaño se cachean las instrucciones de cada modelo: un prefijo corto no se cachea y no falla. Se
  mide en AG7 con los contadores de caché de `negocio.uso_de_ia`.

## Preguntas abiertas

Ninguna para el usuario.
