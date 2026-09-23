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

- **OB se registra en el clasificador desde el día 1, y no se analiza hasta la fase OB.** Si en la
  fase HT solo existiera HT, cada respuesta «OB» del clasificador se guardaría como OTRO —el motor
  devuelve OTRO para todo tipo no registrado (`engine.ts:173-174`)— y el descarte por
  identificador externo la sellaría para siempre: cuando OB llegara, esas reuniones ya no
  entrarían. Registrada, espera en PENDING. Una sola constante, `TIPOS_QUE_SE_ANALIZAN`, decide qué
  se analiza.
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

Se corrige en `lib/analizadores/nucleo/ht.ts`, se sube la versión a `rubric.es.md@v8.1`, y la
pantalla **rotula las fases por su posición** —el esquema fija el orden—, que es lo único que se
lee bien también en las filas v8 copiadas.

## La tarifa

La única fuente de precio de Sonnet 5 es un comentario del código de Brain: *«$2/$10 hasta
31/08/2026; luego sube a $3/$15»*, y su tabla sigue en $2/$10. No está verificado contra la
facturación.

Por eso `TARIFA_CONFIRMADA` es `null` y el costo es **nulo, no cero**: un `0` diría «este análisis no
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
| HT-6 | la tarea programada | |
| HT-7 | la sección, las capacidades y la API | |
| HT-8 | la pantalla básica | |
| HT-9 | la copia del historial y el encendido | |
| HT-10 | observación, y la comparación con Brain en las reuniones que analizaron los dos | |
| OB-1…4 | calibración, habilitar el análisis, la pantalla OB, observación | |

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
