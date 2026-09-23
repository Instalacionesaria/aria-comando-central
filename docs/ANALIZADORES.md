# Analizadores HT y OB

> Fuente: el paquete `aria-ia-brain/app-next/docs/migracion-analizadores/` (15 documentos y sus
> anexos), contrastado contra el código de Comando Central y contra producción el **2026-09-22**.
> Las decisiones las tomó Fabio ese mismo día.

## Qué es

ARIA Brain analiza las reuniones de tl;dv con **dos compuertas**:

1. un clasificador barato (Haiku) decide si la reunión es **HT** (venta high ticket), **OB**
   (onboarding) u **OTRO**, mirando solo los primeros 6.000 caracteres;
2. el análisis (Sonnet) puede **vetarla** con `{"match": false}` si, con la transcripción entera,
   resulta que no era lo que el clasificador creyó.

De ahí salen dos informes: el de **HT** evalúa al closer en cinco fases y deja una **ficha del
prospecto** aparte; el de **OB** arma el perfil de arranque del cliente.

Comando Central los tiene en la sección **Analizadores**, debajo de Closer, con dos pestañas
internas: **HT** y **OB**. Se construye HT completo primero y OB después.

## Las decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Tablas propias** `negocio.analizador_*`, por `org_id` | Es el corte que Fundaciones ya hizo el 2026-09-07 (`docs/ETAPA-9.md:340-377`): el cliente de Comando Central no tiene cuenta en ARIA Brain, y las tablas de Brain no existen en la base local, así que nada de lo que dependa de ellas se puede probar. |
| 2 | **El historial se copia una vez** a la organización `aria` | 107 de las 108 llamadas son de una sola cuenta tl;dv, y todos sus organizadores son @ariaia.com: es el historial comercial de la propia ARIA. La llamada restante (1 OB manual de otra cuenta) no se copia. |
| 3 | **ARIA Brain sigue corriendo** y el doble trabajo está aceptado | Comando Central no apaga ni escribe nada de Brain; eso se hace a mano cuando se decida. Después de la copia **Comando Central no lee nada de Brain**, así que apagarlo no pide ningún cambio acá. |
| 4 | **Todas las empresas**, cada una con sus llaves | Dentro de una empresa, quien tenga la pestaña ve todas sus llamadas. |
| 5 | **Una sola casilla** «Analizadores» en permisos | Como Conversation con Auditoría y Prompts. |
| 6 | **Quien tiene la pestaña, analiza** | `analizadores.ver` para mirar, `analizadores.editar` para gastar; las dos van a los tres roles. |
| 7 | **La llave de Anthropic es la de la empresa** | La misma que usan el auditor y el ICP, vía `resolverLlaveDeIa`. Para ARIA comparten límites y factura; en Brain lo pagaba la llave de la cuenta del alumno. |
| 8 | **Se guardan los tokens; el costo espera a la tarifa confirmada** | Ver «La tarifa» abajo. |
| 9 | **Las reuniones OTRO se guardan sin mostrar su texto** | Son reuniones internas del equipo (19 en el historial). La transcripción se guarda solo para poder reencaminarla. |

### Las que se tomaron por defecto

- **OB se registró en el clasificador desde el día 1, y se analiza desde OB-2 (2026-09-23).** Si
  en la fase HT solo hubiera existido HT, cada respuesta «OB» del clasificador se habría guardado
  como OTRO —el motor devuelve OTRO para todo tipo no registrado (`engine.ts:173-174`)— y el
  descarte por identificador externo la habría sellado para siempre. Durante la fase HT las OB
  esperaban en PENDING. Una sola constante, `TIPOS_QUE_SE_ANALIZAN`, decide qué se analiza, y sigue
  siendo el interruptor: sacar un tipo de ahí lo deja clasificándose y esperando, sin gastar.
- **Los identificadores del núcleo portado siguen en inglés** (`lib/analizadores/nucleo/`). Son el
  contrato con el modelo —los nombres de campo del esquema van en el prompt— y con el JSON ya
  guardado en las 107 llamadas. Traducirlos cambiaría los prompts y dejaría el historial ilegible.
  Mismo criterio que `ETAPA-9.md:344` para Fundaciones. Todo lo nuevo va en español.
- **La llave de tl;dv va en Ajustes › Credenciales**, cifrada como `ia_clave_cifrada`. Ponerla dentro
  de Analizadores haría que la pestaña pidiera una capacidad de credenciales que su sección no
  declara (ADR-0304).

## El defecto de fases que trae el origen

`normalizeHt` pasa la fase de cada puntaje por `asEnum`, y `asEnum` **convierte a mayúsculas** antes
de comparar. La lista de fases está **en minúsculas**. Ninguna fase coincide nunca, y todas caen al
valor por omisión.

Medido en producción: **las 170 fases de las 34 HT analizadas dicen `apertura_rapport`**. El informe
muestra «Apertura» cinco veces.

Se corrige en `lib/analizadores/nucleo/ht.ts` y se sube la versión a `rubric.es.md@v8.1`. La
pantalla rotula cada fase **por su campo** cuando las fases vienen distintas (v8.1), **por su
posición** solo cuando son cinco y todas iguales (el historial v8), «Fase N» cuando no hay forma de
saberlo, y una nota cuando el análisis no trae ninguna. Rotular siempre por posición no es seguro: el
esquema no obliga a devolverlas en orden —la rúbrica las enumera y nada más—. Medido después de la
copia: 34 de las 37 HT dicen `apertura_rapport` en las cinco, y 3 no traen ninguna fase.

## La tarifa

La única fuente de precio de Sonnet 5 es un comentario del código de Brain: *«$2/$10 hasta
31/08/2026; luego sube a $3/$15»*, y su tabla sigue en $2/$10. No está verificado contra la
facturación.

Por eso `CONFIRMED_RATES` (`lib/analizadores/nucleo/pricing.ts`) está vacía y el costo es **nulo, no
cero**: un `0` diría «este análisis no
costó nada». Se guardan los cuatro contadores —entrada, salida, **escritura y lectura de caché**—, y
Brain ignora los dos últimos aunque el sistema del análisis se marca para cachear: con los tokens
guardados, el costo se puede calcular hacia atrás el día que la tarifa se confirme.

## Lo que el paquete dice y el código no

1. **«Ninguna otra transformación»** (MANIFIESTO) no es cierto acá: los anexos no compilan bajo
   `noUncheckedIndexedAccess`, importan sin `.ts`, usan `fetch` —restringido a `lib/http/cliente.ts`
   por ADR-0305— y leen el modelo de variables de entorno.
2. **«Misma base, mismas tablas»** (02 §0) reintroduce la dependencia de Brain que Fundaciones quitó.
3. **El hito «leer las 108» en una prueba Base** no es realizable: la suite Base corre contra la base
   local, donde las tablas de Brain no existen.
4. **`ARCHIVOS_AUTORIZADOS`** no marca «un `where` escrito a mano»: es la lista de los archivos que
   llaman a `conIdentidad(`, y rechaza entradas muertas.
5. **Sumar una tarea al cron** pide también la migración del check de `tareas_programadas`: sin ella
   `sellar()` falla y solo queda en el registro.
6. **El contrato de error `{ok:false, error}` con 402** es incompatible con el front: `pedir()` solo
   lee `codigo` y `detalle`.
7. **El análisis manual no genera la ficha** en el origen, y la sincronización no filtra por tipo: los
   humos 5 y 9 del paquete describen otra cosa.
8. **`client_keys` tiene 2 filas**, no «ninguna tercera» (10 §7); y son 8 tablas en `public`, no 7
   (7 `aria_brain_analyzer_*` más `aria_brain_client_keys`).
9. **`negocio.llamadas` ya existe** (las llamadas del CRM): de ahí el prefijo `analizador_`.

## Etapas

Cada etapa cierra con sus pruebas, y cada prueba nueva se vio roja con su mutación antes de
quedar. En una línea cada una:

| Etapa | Qué | Estado |
|---|---|---|
| HT-0 | este documento | hecha |
| HT-1 | el núcleo portable, sin red ni base | hecha · `pruebas/codigo/170` |
| HT-2 | el transporte a Anthropic y a tl;dv por `pedirExterno` | hecha · `pruebas/codigo/171` |
| HT-3 | las seis tablas (`056`) y la capa de datos | hecha · `pruebas/base/170` · en producción |
| HT-4 | la llave de tl;dv en Ajustes (`057`) | hecha · `pruebas/base/171` · en producción |
| HT-5 | descubrir, analizar y la ficha, con un modelo falso | hecha · `pruebas/base/172` |
| HT-6 | la tarea programada (`058`), cada hora y sola en su horario | hecha · `pruebas/base/173` · en producción |
| HT-7 | la sección, las capacidades (`059` y el catálogo) y la API | hecha · `pruebas/base/174` · en producción |
| HT-8 | la pantalla básica | hecha · `pruebas/codigo/172` · humo con login hecho el 2026-09-23 |
| HT-9 | la copia del historial y el encendido | hecha el 2026-09-23: copia verificada, llave de tl;dv cargada, la tarea corre · falta el hito de 24 h |
| HT-10 | observación, y la comparación con Brain en las reuniones que analizaron los dos | en curso · ver § «La observación» |
| OB-1 | la calibración: qué son en realidad las 44 reuniones que el clasificador llamó OB | hecha el 2026-09-23 · ver § «OB-1» |
| OB-2 | habilitar el análisis OB, con la rúbrica tal cual | hecha el 2026-09-23 · `pruebas/base/172`, `173` y `174` |
| OB-3 | la pantalla de detalle OB y los rótulos «No es HT» / «No es OB» | hecha el 2026-09-23 · `pruebas/codigo/172` y `147` · humo con login hecho |
| OB-4 | observación, y la comparación con Brain | en curso · ver § «La observación» |

### Lo que la construcción encontró

- **El motor no necesitó una costura nueva para probarse sin gastar.** Las pruebas reemplazan
  `globalThis.fetch`, como ya hace la del auditor (`pruebas/codigo/116`): el transporte pasa por
  `pedirExterno` y ahí se intercepta.
- **El análisis y su DONE van en una transacción**, y la mutación que lo prueba es partirlos en dos:
  tragar el error dentro de la misma transacción no alcanza para producir un DONE sin informe,
  porque PostgreSQL aborta todo lo que sigue.
- **`commercialTerms.duration` de la ficha no es un dato duro**: es la duración del programa
  ofrecido. La de la reunión se llama `durationSec` en todo el núcleo.
- **`SENTINELAS` pasó de `Set` a arreglo** por ADR-0703: la prueba de publicación mira la forma, y
  un `Set` en el nivel superior de un módulo del servidor se puede llenar desde cualquier petición.
- **La tarea no usa el presupuesto compartido del cron** (`PRESUPUESTO_MS`, 180 s) sino la función
  entera menos el margen (`FIN_PARA_LOS_ANALIZADORES_MS`, 285 s). Con 180 s menos lo gastado en
  descubrir, nunca quedaría una ventana de 150 s para un análisis: la guardia lo rechazaría en todas
  las corridas y las pendientes no se drenarían jamás, sin que nada fallara.
- **Las reglas de la pantalla van en `app/closer.css`**, no en `operacion-estetica.css`: esa hoja es
  la de lo compartido y su prueba exige que cada selector alcance a todas las pantallas de operación.
- **La pestaña interna del detalle se llama `vendedor` en el código**, aunque diga «Closer»:
  `30-portero` prohíbe `=== 'closer'` por la forma, porque así es como se cuela una comparación con
  un nombre de rol.

### Lo que encontró la revisión, antes del primer push

Una revisión adversarial de las etapas 0 a 8 encontró defectos que las pruebas no veían porque no
fallan: se ven en la factura o en un sello limpio. Cada uno quedó con su prueba, vista roja con su
mutación (23 mutaciones, las 23 mueren).

- **Un análisis se podía pagar dos veces.** Los drenados recorren una foto de las pendientes durante
  minutos, y la toma aceptaba DONE: una llamada que otra corrida terminó en el medio se volvía a
  analizar. Ahora la toma exige el estado y el tipo en que se vio la llamada (`tomarParaAnalizar`),
  y reanalizar una DONE se pide diciéndolo (`{ esperado: 'DONE' }` en la ruta).
- **Una llave rota dejaba FAILED a todo lo que tocaba.** El 401 caía en el mismo `catch` que un JSON
  roto, y el drenado seguía con la siguiente. Ahora una llave rechazada, una cuenta sin saldo (un 400
  que solo se distingue por la frase) o el servicio saturado (429, 529) devuelven la llamada a su
  estado —con su error de antes—, cortan el drenado y lo dicen en el sello. El clasificador también
  relanza la cuenta sin saldo, en vez de dejar cada reunión «sin clasificar» para siempre.
- **La llave podía quedar escrita en un error.** `fetch` pone el valor de una cabecera inválida
  entero en su mensaje, y ese mensaje se guardaba en la llamada. Se saca en los dos transportes.
- **Reencaminar dejaba el informe viejo adentro.** Una HT reanalizada que fallaba quedaba FAILED con
  su primer informe, y como una FAILED se mueve, llegaba a OB con un informe de venta. Ahora se
  borran el análisis y la ficha, y una OTRO que pasa a HT u OB recupera su prospecto por el correo.
- **La tarea y la pantalla generaban la misma ficha en paralelo.** La tarea espera ahora
  `MINUTOS_ANTES_DE_LA_FICHA_DE_LA_TAREA` (10) desde el análisis, y una ficha FAILED ya no se
  reintenta sola: se rehace con el botón. Por lo mismo, una llave rota ya no guarda una FAILED.
- **El sello quedaba limpio sin haber traído nada**: con tl;dv caído al listar, con reuniones sin
  clasificar, con el servicio saturado y con una página llena de tl;dv (50, `TLDV_PAGE_SIZE`) que no
  sale de la ventana. Contar no alcanzaba: la primera corrida real trajo una página llena que cruzaba
  el borde, y el sello avisaba en falso. La causa cruda de un proveedor va al registro, no a la
  respuesta del cron (ADR-0704).
- **Una transcripción guardada sin segmentos se mandaba vacía** al modelo. Se vuelve a partir, como
  hacía el origen.
- **Rotular las fases siempre por posición era falso para el v8.1**: el esquema no obliga al orden.
  Ver `lib/analizadores/fases.ts`.
- **La pantalla**: el estado de las llaves se relee cada vez que la pestaña vuelve a la vista, el
  error de una acción ya no lo borra la recarga que la sigue, y una respuesta vieja no pisa a una
  nueva. Y decía que las llaves se cargaban en «Integraciones», una pantalla que no existe.

### El encendido en producción (HT-9), 2026-09-23

Hecho, en este orden:

1. `058`, `059` y `060` con `db.mjs migrar`, **antes** del push (`7506742`).
2. El catálogo con los tres pasos de `docs/DESPLIEGUE.md` § 4b. Antes, en lectura, un simulacro del
   `delete` del reparto: no iba a quitar ninguna asignación. Después: 30 → 32 capacidades, 70 → 76
   asignaciones, los mismos 3 roles y 0 personas sin rol, igual que la base local. Los tres roles
   tienen `analizadores.ver` y `.editar`.
3. La copia (`scripts/copias/historial-analizador.sql`): 107 llamadas, 42 prospectos, 107
   transcripciones, 44 análisis, 37 fichas y 13 lápidas, las mismas cifras que el origen, que no se
   tocó. La verificaron cuatro agentes independientes, en solo lectura: 0 diferencias columna por
   columna en las seis tablas, la misma huella md5 por tabla entre el origen transformado y el
   destino, ninguna fila de otra cuenta de Brain —la OB manual de `553acc01` no está— y lo que la
   aplicación lee coincide con el perfil del origen (HT: 37 analizadas, 26 descartadas; OB: 7
   analizadas, 1 pendiente —la FAILED—, 55 descartadas).
4. La `061`, que le quita a `postgres` el `insert` que le dio la `060`. Medido después: `insert` en
   `false` en las seis tablas; el `select` le queda por `pg_read_all_data`.

Lo que la copia trajo y conviene saber antes de mirar la pantalla:

- **La última reunión que Brain registró es del 2026-09-19.** La tarea de Comando Central mira las
  últimas 48 horas, así que una reunión entre el 19 y el 21 que Brain no haya visto no entra sola:
  se pega a mano.
- **Una HT tiene un análisis vacío** (`ef9c447f-8993-4d9f-87ca-5b831a0d5aec`): 102 tokens de salida
  contra un mínimo de 2918 en las otras 36, sin resumen ni fases. Su «1/10 ROJO» es el valor por
  omisión de `normalizeHt`, no una nota. Viene así de Brain. Se arregla reanalizándola con el botón.
- **Tres HT no traen ninguna fase** (esa y otras dos). La pantalla lo dice con una nota.

La llave de tl;dv de ARIA se pegó ese mismo día, y la corrida de las 18:41 UTC fue la primera real:
descubrió dos reuniones y analizó la HT sin duplicar nada. El humo de la pantalla con login también
se hizo. Queda el hito de 24 h, que se mide con `scripts/medir-analizadores.sql` (§ «La observación»).

## OB-1 · La calibración, 2026-09-23

**La pregunta:** de las 44 reuniones que el clasificador llamó OB en el historial copiado, el análisis
vetó 36 (82 %). ¿Es el PRIMER PASO de OB demasiado estricto —rechaza onboardings reales— o el
clasificador le manda cosas que no lo son? La respuesta decide qué se toca antes de OB-2.

**Cómo se midió:** las 44 transcripciones se leyeron enteras, dos veces, por lectores independientes
con lotes armados distinto (20 en total), cada una juzgada contra `isDescription` e `isNotExamples`
de `lib/analizadores/nucleo/ob.ts` y `ht.ts` —no contra el título ni contra el motivo del modelo—.
Las dos pasadas coincidieron en el tipo real y en el veredicto en **44 de 44**, así que no hizo
falta la tercera lectura prevista para desempatar. Sin datos personales en la salida.

| Lo que el clasificador llamó OB | Cuántas | Qué son en realidad |
|---|---|---|
| vetadas (NOT_MATCH) | 36 | **12 ventas HT** (5 primeras llamadas, 7 seguimientos o negociaciones) · 20 sesiones de entrega, implementación o soporte con clientes que ya estaban dentro · 1 socio o proveedor · 2 otras · 1 transcripción vacía (un saludo de 25 caracteres en una llamada de 13 minutos) |
| aceptadas (DONE) | 7 | 4 onboardings reales · 2 sesiones de entrega de mitad de programa · 1 onboarding en el que el equipo de ARIA es el CLIENTE de un proveedor externo |
| fallida (FAILED) | 1 | un onboarding real: pasó el PRIMER PASO y falló el JSON de la salida |

**Lo que dice:**

1. **El PRIMER PASO de OB no es demasiado estricto.** Los 36 vetos son correctos —ningún onboarding
   real quedó fuera— y el motivo que dio el modelo describe bien la reunión en los 36. Si algo, es
   **laxo**: aceptó 3 de 7 que no son un arranque. La palabra «acompañamiento» de su `isDescription`
   deja pasar una mentoría de mitad de programa, y `isNotExamples` no excluye el caso en que quien
   compró es el propio equipo.
2. **El problema está en el clasificador.** De las 44 que llamó OB, solo 5 son onboardings. Y **12 son
   ventas que el analizador HT nunca vio**: ni Brain ni Comando Central las analizaron como HT. Lo
   que se ve en el código (`buildClassifierSystem`, `lib/analizadores/nucleo/engine.ts`):
   - la categoría OB del clasificador ES el `isDescription` de `ob.ts`, con «arranque/acompañamiento»;
   - la «DISTINCIÓN CLAVE» pone la frontera en la COMPRA, así que cualquier reunión con alguien que
     ya compró cae en OB;
   - la lista de OTRO nombra «soporte» y «coaching genérico», pero no las sesiones de entrega o de
     implementación con un cliente activo, que son 20 de las 36 vetadas.
3. **Una hipótesis, repetida por los lectores y NO medida:** el clasificador solo ve los primeros 6000
   caracteres (`CLASSIFY_PREFIX_CHARS`). En una venta, ese tramo es diagnóstico —el negocio, el nicho,
   las metas—, que se parece a lo que `ob.ts` describe como onboarding; el precio y el cierre llegan
   después. Y muchas de estas reuniones no traen invitados, así que la pista del dominio de correo no
   existía. Medirlo exige reclasificar con un prefijo más largo, que es gastar.

Las 12 ventas, para ubicarlas en la pestaña OB (moverlas a HT se decidió que no; ver abajo): `065f808f`, `07f447f0`, `17a2f46a`, `317c9807`, `659cba0d`,
`67ba2bc1`, `6c2d921e`, `98333d60`, `a76e7557`, `b184565b`, `b8e9aea8`, `ed092d82`. Todas con
confianza alta en las dos lecturas salvo `98333d60`, media en las dos.

**Decidido el 2026-09-23**, por quien opera la herramienta:

- **Nada se mueve y la rúbrica no se toca**, ni la de OB ni la de HT. Una reunión que no es lo que su
  analizador espera no desaparece: queda en Descartadas de su pestaña como «No es HT» o «No es OB»,
  con el motivo del modelo. Las 12 ventas quedan así en la pestaña OB.
- **El clasificador queda como está.** A futuro la clasificación va a salir del NOMBRE de la reunión
  —hay formatos de título que ya son de uno u otro tipo, y algunos ya están mapeados—, y con eso el
  resto del clasificador deja de hacer falta. Se actualiza cuando esté el mapa completo.

Con eso OB-2 y OB-3 siguen con la rúbrica tal cual, que es lo que el plan fijaba por defecto.

## La observación (HT-10 y OB-4)

Dos consultas de solo lectura, versionadas para que cada lectura se haga igual y dos días distintos se
puedan comparar. Ninguna imprime datos de una persona: `pruebas/codigo/174` lo exige, junto con que no
escriban ni lean una llave.

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer --archivo scripts/medir-analizadores.sql
node --env-file=.env.supabase scripts/supabase.mjs leer --archivo scripts/comparar-con-brain.sql
```

- **`medir-analizadores.sql`**, por empresa y tipo, solo sobre lo que Comando Central hizo por su
  cuenta (la copia queda afuera por fecha): descubiertas, estados, qué parte «no es» su tipo,
  pendientes y la más vieja, la duración real de cada análisis (`analizado_el - tomada_el`: p50, p90 y
  máximo), los tokens, las fichas, y los que tienen que dar cero —duplicadas, colgadas, análisis sin
  sus cuatro contadores, HT analizadas sin ficha pasada una hora—. Y el sello de la tarea.
- **`comparar-con-brain.sql`**: las reuniones que analizaron los dos, con tipo y puntaje de cada lado,
  y el hito de HT-9 de que ninguna reunión que Brain vio después de la copia falte acá. Solo sirve
  mientras existan las tablas de Brain.

### Primera lectura, 2026-09-23 21:07 UTC

| | HT | OB | OTRO |
|---|---|---|---|
| descubiertas por Comando Central | 1 (no es HT) | 1 (analizada) | 1 |
| duración del análisis | 3 s (un veto) | 34 s | — |
| tokens de salida | 109 | 2 999 | — |
| duplicadas, colgadas, sin contadores | 0 | 0 | 0 |

El sello de las 20:42 dice `corrio`, sin motivo. La OB es la primera que analizó Comando Central.

Dos lecturas no alcanzan para tocar las esperas: el análisis arranca solo con 150 s por delante y
espera hasta 270 s, contra 3 y 34 s medidos. Se ajustan con las semanas de datos que pide el plan.

### Brain no está corriendo, y eso deja sin objeto la comparación

**Brain no registra nada desde el 2026-09-19 10:00**: ni llamadas nuevas ni cambios en las que tiene.
Las reuniones que Comando Central descubrió el 21 y el 23 no están en Brain. O sea que el doble
trabajo que se había aceptado no está ocurriendo, y que la comparación de HT-10 y OB-4 —misma reunión
analizada por los dos— no va a tener datos mientras Brain siga parado. `comparar-con-brain.sql` da hoy
cero reuniones en común.

La única forma de comparar sin Brain es reanalizar acá algunas reuniones del historial copiado y
ponerlas al lado del análisis original, que sigue guardado en las tablas de Brain. Cuesta un análisis
por reunión y reemplaza, en la pantalla, el análisis copiado por el nuevo (v8.1). Es una decisión de
quien opera la herramienta, no se hizo.

