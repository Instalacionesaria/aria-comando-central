# La arquitectura de los agentes

> Qué tipos de agente hay, cómo hace una llamada al modelo cualquiera de ellos, qué piezas comunes viven en
> `lib/agentes/`, qué tablas nacen y dónde termina lo nuevo y empieza lo que ya existe. Requisitos `AG-01` a
> `AG-15`.

---

## De dónde sale

- `D-01`, `D-02`, `D-03`, `D-15`, `D-26` y `D-30` de `00-MAPA.md`.
- Arq, que no habla de «agentes por herramienta» sino de departamentos de inteligencia que consumen las
  conclusiones de los otros sin recalcularlas, y que dice que sus componentes «pueden implementarse como
  agentes, servicios o funciones» (Arq:1175).
- El código: los cinco módulos que hoy arman llamadas al modelo (`lib/fundaciones/generacion.ts`,
  `conversacion.ts`, `relleno.ts`, `lib/auditor/modelo.ts`, `lib/analizadores/nucleo/anthropic.ts`) y el
  único cliente saliente, `pedirExterno` (`lib/http/cliente.ts:339`).

---

## AG-01 · Cinco tipos de agente

| tipo | quién | ¿llama al modelo? | dónde vive en el front |
|---|---|---|---|
| **CREA** | Research y Marketing: el entrevistador de ICP & Oferta y Funnel (existe), el Espía (existe), Copywriter (sólo diseño), Content Studio (sólo diseño), el Plan de prospección (existe, sin agente conversacional) | sí | la herramienta misma |
| **MIDE** (detector) | Acquisition (piloto), Creative Insights, Conversion, Conversation (el auditor que ya existe, traducido) | **no para detectar**: reglas. Sí, con Sonnet 5.5, para **redactar** el Plan de acción cuando hay llave | la tarjeta de Señales y el botón «Plan de acción» de su pantalla |
| **OPERA** | Sales: el Brief del closer (agente por contacto); el Setter y el Closer se atienden con el cerebro en la caja del pie, con el alcance de su pantalla; Llamadas de venta son agregados | el Brief sí; los agregados de Llamadas no (la categoría de cada objeción la pone Haiku una vez, al analizar) | Mi Día del Closer y la ficha; la caja del pie |
| **RETIENE** | Client Success: los agregados de Llamadas de onboarding (sin modelo) y Seguimiento de clientes (sólo diseño) | no en la v1 | la caja del pie |
| **EL CEREBRO** | el agente global, `executive` en el código | sí | el chat del Inicio, la caja del pie, CONVERSACIONES |

La detección es siempre por reglas. El modelo **nunca decide si algo es una señal**: redacta, ordena,
responde o crea. Cuándo llama al modelo cada agente lo dice su ficha.

## AG-02 · Un solo proveedor y un solo camino

Anthropic, por HTTP directo y sin SDK, **siempre** por `pedirExterno` (`lib/http/cliente.ts:339`). ADR-0305
permite `fetch(` sólo en tres archivos —`lib/http/cliente.ts`, `lib/deteccion/aviso.ts` y
`scripts/supabase.mjs` (`pruebas/codigo/30-portero.test.ts:569-573`)— y prohíbe `EventSource`. Ningún
archivo nuevo de este plan, ni siquiera el guion de evaluación, llama a `fetch(`.

## AG-03 · La llave es de cada empresa

ADR-0908: no hay `ANTHROPIC_API_KEY` en el entorno ni llave de ARIA para los clientes. La llave se resuelve
con `resolverLlaveDeIa` (`lib/credenciales/resolver.ts:401`), que devuelve la falta con nombre
(`sin_llave_de_ia`, `llave_de_ia_ilegible`). Sin llave, **todo lo que sale de reglas funciona igual**
(señales, Plan de acción armado con plantillas, Reunión con texto fijo, comentario de la cabecera, agregados
de llamadas) y lo que necesita el modelo se deshabilita diciendo por qué (`D-02`).

Bajo delegación (alguien de ARIA mirando a un cliente) la llave sería la del cliente: por eso todo lo que
gasta se apaga ahí (`D-17`, `T-25`).

## AG-04 · El ciclo de una llamada

1. **El portero**: `exigir(peticion, capacidades, PANTALLA)` (`lib/autorizacion/portero.ts:167`).
2. **Identidad, en la ruta**: la llave (`conIdentidad`), y el estado de las integraciones sólo si la persona
   tiene `credenciales.ver`.
3. **Inquilino, transacción corta**: el hilo, el tope bajo candado de fila y la reserva de la pregunta.
4. **El bucle del modelo, fuera de toda transacción.** Cada herramienta abre su propia
   `conOrganizacion(orgEfectiva, …)` corta, **en serie**.
5. **La validación** de la respuesta contra su evidencia (`T-07`).
6. **Inquilino, transacción corta**: la respuesta, la evidencia y el uso.
7. **La respuesta** a la pantalla.

Cualquier fallo del modelo pasa por `clasificarFallo` (`lib/fundaciones/fallo-del-modelo.ts:72`) y queda
como incidente. Una pregunta que falla libera su reserva: no consume tope.

## AG-05 · Ninguna transacción abierta mientras se espera al modelo

`conOrganizacion` abre una transacción (`lib/datos/contexto.ts:76`) y el grupo de conexiones tiene un
máximo de 5 (`lib/datos/capa.ts:83`). Una transacción abierta durante una llamada de dos minutos retiene una
conexión de cinco. Es la regla que ya siguen los Analizadores (`lib/analizadores/datos.ts:26-28`) y el
entrevistador (`conversarConElAgente`, `lib/fundaciones/operaciones.ts:578`, que lee, llama y guarda en tres
pasos separados). Tampoco `registrarUso` se llama dentro de una transacción abierta.

## AG-06 · La capa común, `lib/agentes/`

| archivo | qué hace | etapa |
|---|---|---|
| `modelos.ts` | La constante de modelo de cada agente nuevo (`D-15`) | AG1 |
| `llamada.ts` | El transporte: arma el pedido, lo manda por `pedirExterno`, reintenta una vez si el fallo es pasajero, clasifica, registra uso e incidente. Importa la dirección y la versión de la API de un solo lugar | AG1 |
| `uso.ts` | `registrarUso`, el único escritor de `negocio.uso_de_ia`. Nunca lanza | AG1 |
| `executive/` | El cerebro: `herramientas.ts` (el catálogo y qué se ofrece a quién), `adaptadores/*.ts` (uno por herramienta, con su proyección), `prompt.ts`, `respuesta.ts` (el esquema `responder` y la validación), `contexto.ts` (el contexto de la pantalla), `preguntar.ts` (la orquestación del ciclo de `AG-04`), `conversaciones.ts` (único escritor de sus dos tablas), `topes.ts` | AG5, AG6 |
| `senales/` | `escritura.ts` (único escritor de `negocio.senales`, con la huella y la reconciliación), `lectura.ts`, `umbrales.ts` (el catálogo provisional en código y la lectura de las firmas) | AG8 |
| `plan/` | Un armador por departamento, cada uno con el formato que ese departamento escribió (A6, C6, CV6), y la redacción con el modelo validada contra la evidencia | AG9 en adelante |
| `detectores/` | `acquisition.ts`, `creative.ts`, `conversion.ts`, `conversation.ts` (puros: reciben lo medido y devuelven señales) y `correr.ts` (la pasada diaria por empresa) | AG8 en adelante |
| `reunion.ts`, `cabecera.ts` | La Reunión de hoy y el comentario de la cabecera | AG15 |
| `brief/` | El Brief del closer | AG12 |
| `traspaso.ts` | Del lado del navegador: lleva un pedido de una pantalla a otra, con el molde de `lib/tools/del-espia-al-scraper.ts:13-19` | AG7 |

Las funciones que miden **no se mudan**: siguen en `lib/negocio/` y el cerebro las consume.

## AG-07 · Las tablas nuevas

Todas en `negocio`, con `org_id`, con `negocio.aplicar_aislamiento` (RLS habilitada, forzada y con
política) y con un solo archivo que las escribe. La plantilla es la `068`
(`db/migraciones/068_el_analisis_del_espia.sql:24`, `:32`).

| migración | tablas | escritor | etapa |
|---|---|---|---|
| `069` | `uso_de_ia` | `lib/agentes/uso.ts` | AG1 |
| `070` | `conversaciones_del_executive`, `mensajes_del_executive`, `topes_del_executive` | `lib/agentes/executive/conversaciones.ts` y `topes.ts` | AG5 |
| `071` | `senales`, `planes_de_accion`, `umbrales`; y el `check` de `tareas_programadas` suma `senales` | `lib/agentes/senales/escritura.ts`, `lib/agentes/plan/*` (por un solo módulo de escritura), `lib/agentes/senales/umbrales.ts` | AG8 |
| `072` | `objeciones_clasificadas` | `lib/analizadores/objeciones.ts` | AG11 |
| `073` | `briefs_del_closer` | `lib/agentes/brief/guardar.ts` | AG12 |
| `074` | `reuniones_del_dia` | `lib/agentes/reunion.ts` | AG15 |

Los números se vuelven a verificar en cada `pull`: otra persona empuja migraciones a `main`.

## AG-08 · Un escritor por tabla

Lo vigila `pruebas/codigo/111-un-solo-escritor.test.ts`. Cada tabla nueva declara su escritor en la
primera línea de su archivo, como las demás.

## AG-09 · La frontera con lo que ya existe

Fundaciones, el Espía, el auditor y los Analizadores **conservan su cuerpo y su modelo** (`D-15`): cada
módulo arma su propio cuerpo a propósito (`lib/auditor/modelo.ts:18`). Lo único que suman es
`registrarUso` (AG2) y, si les faltan, sus incidentes (`D-30`). La voz cambia en Fundaciones y el Espía
(`D-26`; ver la coordinación con la rama `feature/icp-oferta-v2` en `00-MAPA.md`).

## AG-10 · Respuestas enteras

Sin streaming (`D-16`). La ruta del cerebro declara `maxDuration = 300` y su bucle se da 240 s en total,
así que le quedan 60 para guardar. El navegador espera `ESPERA_DE_RUTA_LARGA_MS` (`lib/http/cliente.ts:119`,
600 s), más que la ruta: nunca abandona una respuesta que todavía puede llegar. Mientras tanto, la mascota
está en `pensando`.

## AG-11 · El agente detecta, no decide

El campo es `recommended_review`, una revisión recomendada, no una acción (A11-05). Ninguna recomendación se
ejecuta desde el producto (C6-10). Las causas son hipótesis, no diagnósticos.

## AG-12 · El lugar reservado para las acciones

`D-03` deja las acciones para después. El contrato las prevé desde ya, para que lleguen sin rehacer nada:

- un siguiente paso puede ser `{tipo:'abrir', …}` (v1) o `{tipo:'accion', accion, parametros, permiso}`
  (reservado);
- la validación de la v1 **rechaza** `accion`;
- el ciclo que tendrá una acción —propuesta, aprobada, ejecutada, con quién y cuándo— queda escrito en
  `02-EL-CONTRATO-DE-SENALES.md`;
- no se crea ninguna tabla ni ninguna capacidad para eso: una capacidad sin puerta es lo que el catálogo le
  reprocha a `roles.administrar`.

Ejemplos de lo que espera ahí: «Recordárselo al closer» (Lienzo, pantalla «Estado especial · no hay dato
suficiente») y «vincular el recurso al DM» (Lienzo, pantalla «Marketing · Guiones»).

## AG-13 · Voz y nombres

- Los prompts nuevos y los textos de pantalla nuevos van en **tú neutro** (`D-26`).
- En pantalla, «el cerebro». En el código, `executive`. La capacidad, `cerebro.usar`.
- La personalidad de la marca: frases cortas y honestas; si no hay dato suficiente, se dice.

## AG-14 · Todo fallo de un agente es un incidente

Fundaciones, Tools y el Espía ya registran (`lib/fundaciones/fallo-del-modelo.ts:152`). En AG2 se suman el
auditor y los Analizadores, **agregados por corrida y por situación**: el auditor corre cada 10 minutos y
un proveedor caído no puede inundar el panel con una fila por conversación.

## AG-15 · Sin datos, no se llama al modelo

Si una herramienta del cerebro, un detector o el Brief no tienen con qué trabajar, no se paga una inferencia
para que el modelo invente algo convincente. Es el criterio de `lib/fundaciones/relleno.ts:227-230` y de
`lib/tools/espia.ts:150-156`. Lo que se muestra entonces es «no hay dato suficiente», con qué falta y dónde
se carga.

---

## Lo que no se pudo verificar

- Que la llave de la organización principal alcance `claude-sonnet-5-5`. Se comprueba con el OK del usuario
  antes de la primera llamada real (`06`).

## Preguntas abiertas

Ninguna: las de arquitectura se contestaron el 2026-10-03 y el 2026-10-04.
