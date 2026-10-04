# Modelos, uso, topes e incidentes

> Qué modelo usa cada agente, cómo se mide lo que cada llamada consume, cuánto puede preguntar cada persona
> y cada empresa por día, y qué pasa cuando el modelo falla. Requisitos `AG-90` a `AG-99`.

---

## De dónde sale

- `D-15`, `D-16` y `D-30` de `00-MAPA.md`.
- Lo que hay hoy: tres constantes que valen `claude-sonnet-5` (`lib/fundaciones/generacion.ts:54`,
  `lib/auditor/modelo.ts:60`, `lib/analizadores/nucleo/anthropic.ts:33`) y el clasificador con el alias
  `claude-haiku-4-5` (`lib/analizadores/nucleo/anthropic.ts:36`); sólo los Analizadores guardan sus tokens;
  el costo es `null` porque no hay tarifa confirmada (`lib/analizadores/nucleo/pricing.ts:42`); los fallos
  se clasifican en situaciones `IA-*` (`lib/fundaciones/fallo-del-modelo.ts:72`) y quedan en
  `negocio.incidentes` (`lib/incidentes/registro.ts:32`), pero sólo desde Fundaciones, Tools y el Espía.

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
| Copywriter (sólo diseño) | `claude-sonnet-5-5` | crear |
| Fundaciones, el Espía, el auditor | `claude-sonnet-5`, sin cambio | se evalúan después (`D-15`) |
| Los Analizadores | `claude-sonnet-5` y el alias `claude-haiku-4-5`, sin cambio | ídem |

## AG-91 · La lista de modelos válidos

`pruebas/codigo/90-fundaciones.test.ts:638-643` fija los identificadores aceptados; suma
`claude-sonnet-5-5` (`claude-haiku-4-5-20251001` ya está). Una prueba nueva exige que **cada constante de
`lib/agentes/modelos.ts`** esté en esa lista: un identificador mal escrito no falla en ninguna prueba con
`fetch` falseado, falla en producción con `IA-MODELO` en todas las preguntas.

## AG-92 · Antes de la primera llamada real

Se comprueba, **con el OK del usuario**, que la llave de la organización principal alcanza
`claude-sonnet-5-5`: un `GET /v1/models/claude-sonnet-5-5` por `pedirExterno`, sin tokens. Nunca con la
llave de un cliente.

## AG-93 · El transporte

`lib/agentes/llamada.ts`, sobre `pedirExterno`:

- **la dirección y la versión de la API vienen de un solo lugar**: hoy cada módulo las repite y una prueba
  afirma que coinciden (`lib/auditor/modelo.ts:18`); el transporte nuevo las importa, no las copia;
- **un reintento**, sólo si el fallo es pasajero (`esPasajero`, `lib/fundaciones/fallo-del-modelo.ts:166`) y
  llegó temprano; si el reintento sale bien, igual queda el incidente marcado `salvado`, como en `generar`;
- clasifica el fallo, registra el uso y, si falla, el incidente;
- la salida estructurada, con una herramienta forzada, que es la forma de la casa;
- `cache_control` en las instrucciones y en las definiciones de herramientas.

## AG-94 · `negocio.uso_de_ia`, una fila por llamada

Migración `069`. Columnas: `org_id`, `id`, `creado_el`, `agente` (de un juego cerrado: `executive`, `plan`,
`reunion`, `brief`, `objeciones`, `fundaciones_generar`, `fundaciones_conversar`, `fundaciones_rellenar`,
`espia`, `auditor`, `auditor_mejora`, `analizador_clasificar`, `analizador_analizar`, `analizador_ficha`),
`modelo`, los cuatro contadores (`tokens_entrada`, `tokens_salida`, `tokens_escritura_cache`,
`tokens_lectura_cache`), `duracion_ms`, `resultado` (`ok` o la situación `IA-*`), `usuario_id` (nulo en el
cron; `on delete set null`, como la `068`) y `ref` (el hilo, el análisis o la referencia del incidente).
**Ningún texto.**

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
- **Se cuentan las preguntas**, o sea los mensajes de la persona. La pregunta se **reserva** en la misma
  transacción corta que mira el tope, bajo `select … for update` sobre la fila de topes de la empresa (la
  casa bloquea filas, como `lib/negocio/pulso.ts`), así dos preguntas en paralelo no pasan juntas el 50.
- **Una pregunta que falla no cuenta**: su reserva se libera.
- **No cuentan**: abrir un tema de la Reunión, generar el Brief al abrir una cita, la redacción del plan
  del cron. **Sí cuenta** regenerar el Brief a mano.
- Al llegar al tope, el cerebro pasa al estado `tope` (`03`, `AG-52`) y dice a qué hora se renueva.

## AG-97 · Ajustar los topes

`app/api/admin/cerebro/route.ts`, con `PANTALLA='credenciales'` como las demás rutas de Ajustes: el GET pide
`credenciales.ver` y el PUT `credenciales.editar`, así que los ajusta el Admin (el rol `usuario` no tiene
`credenciales.%`). La pantalla muestra el uso del día contra los topes. Bajo delegación se puede ajustar,
con autor nulo (`05`, `AG-82`).

## AG-98 · Incidentes

- **Todo fallo de un agente** pasa por `clasificarFallo` y queda en `negocio.incidentes` (`D-30`). En AG2 se
  suman el auditor y los Analizadores, que hoy no registran.
- **Agregados por corrida y situación** en las tareas del cron: el auditor corre cada 10 minutos con hasta
  20 inferencias, y un proveedor caído no puede llenar el panel con una fila por conversación.
- Las situaciones `IA-*` que ya existen alcanzan; el `check` de la tabla admite cualquier `IA-…`
  (`db/migraciones/067_los_incidentes.sql`). El `origen` suma `executive`, `plan`, `reunion`, `brief`,
  `objeciones`, `auditor` y `analizador`.

## AG-99 · El uso en el cron

Sin persona: `usuario_id` nulo. La tarea `senales` registra el uso de la redacción del plan y de la Reunión;
la del analizador, el de la clasificación de objeciones.

---

## Lo que no se pudo verificar

- La tarifa de `claude-sonnet-5-5`. Hasta confirmarla contra la factura, el costo es `null`.

## Preguntas abiertas

Ninguna para el usuario.
