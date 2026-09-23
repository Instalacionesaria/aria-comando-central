# Clasificar las reuniones por su nombre

> **Estado:** pendiente. Se construye cuando esté el mapa completo de nombres de reunión → tipo.
> Pedido el 2026-09-23, después de la calibración OB-1 (`docs/ANALIZADORES.md` § «OB-1»).

## Qué se quiere

Hoy cada reunión nueva de tl;dv pasa por un clasificador (Haiku) que lee el título y los primeros
6000 caracteres de la transcripción y decide **HT** (venta high ticket), **OB** (onboarding) u
**OTRO**. La idea es que el tipo salga **del nombre de la reunión**: los formatos de reunión del
equipo ya dicen qué son, y algunos ya están mapeados. Con el mapa completo, el clasificador deja de
hacer falta para las reuniones que tengan un nombre reconocido.

## Por qué: lo que midió OB-1

Dos lecturas independientes de las 44 reuniones que el clasificador llamó OB coincidieron en las 44:

- solo **5 eran onboardings de verdad**;
- **12 eran ventas** (5 primeras llamadas y 7 seguimientos) que el analizador HT nunca vio;
- 20 eran sesiones de entrega, implementación o soporte con clientes que ya estaban dentro.

El PRIMER PASO de cada rúbrica vetó bien todo eso —ninguna quedó mal analizada—, pero las 12 ventas
se perdieron para HT. Las causas que se ven en el código están en `docs/ANALIZADORES.md`; la que importa
acá es que **el clasificador se equivoca justo donde el título ya sabía la respuesta**:

- varias ventas tenían «Discovery Call» en el título, que el prompt del clasificador llama señal
  FUERTE de HT, y aun así fueron a OB;
- otras tenían un título con el formato de la sesión de venta («… CONSULTING SESIÓN»);
- muchas no traían invitados, así que la otra pista del prompt —el dominio de los correos— no existía.

Un mapa de nombres corta ese error de raíz, y además no cuesta: no hay que llamar a ningún modelo
para leer un título.

## Cómo podría quedar

### El mapa

Una tabla por empresa, porque cada una nombra sus reuniones a su manera:

| Columna | Qué es |
|---|---|
| `org_id` | la empresa (RLS forzada, como todas las tablas del analizador) |
| `patron` | el texto a buscar en el título |
| `tipo` | `HT`, `OB` u `OTRO` |
| `prioridad` | para cuando dos patrones casan con el mismo título: gana la más alta |
| `activo` | para apagar una regla sin borrarla |

Nombre tentativo: `negocio.analizador_reglas_de_titulo`, con su migración, su prueba de aislamiento
(como la prueba 9 del plan) y su lugar en `lib/datos/esquema.ts`.

### Cómo se compara un título con un patrón

- sin distinguir mayúsculas ni tildes («Sesión» = «sesion»), y con los espacios repetidos colapsados;
- «el título **contiene** el patrón», que es lo que una persona entiende al escribir una regla. Nada
  de expresiones regulares en la pantalla: un error ahí no se ve hasta que clasifica mal;
- si casan varias reglas, gana la de mayor prioridad; con la misma prioridad, la más larga (es la
  más específica).

### Dónde entra en el pipeline

En `descubrir` (`lib/analizadores/pipeline.ts`), **antes** de pedir la transcripción y antes del
clasificador:

1. Si el título casa con una regla → ese es el tipo. No se llama a Haiku.
2. Si no casa con ninguna → lo que se decida (ver «Decisiones pendientes»): el clasificador de hoy
   como respaldo, o guardarla como OTRO para que alguien la mueva a mano.

El resto no cambia: una HT u OB queda PENDING y la tarea la analiza; el PRIMER PASO de la rúbrica
sigue pudiendo decir «No es HT» / «No es OB», y la reunión queda en Descartadas con su motivo.

Guardar de qué salió el tipo (`regla` o `clasificador`) en la llamada deja medir después qué parte
cubre el mapa.

### La pantalla

Una lista editable de reglas (patrón, tipo, prioridad, activa) en la pestaña Analizadores, detrás de
`analizadores.editar`. Con una vista previa: al escribir un patrón, cuántas de las reuniones ya
guardadas casarían y con qué tipo, para ver el efecto antes de guardarla.

## Validarlo antes de encenderlo, sin gastar

Los títulos de todas las reuniones ya están en `negocio.analizador_llamadas`, y para 44 de ellas hay
una respuesta verificada (OB-1). Así que el mapa se puede probar **entero contra el historial** antes
de tocar el pipeline:

1. Correr el mapa sobre los títulos guardados (una consulta de solo lectura, como
   `scripts/medir-analizadores.sql`).
2. Para las 44 de OB-1: ¿el mapa acierta el tipo real? En particular, ¿recupera las 12 ventas y deja
   en OB los 5 onboardings?
3. Para el resto: ¿cuántas quedan sin regla? Esas son las que seguirían dependiendo del respaldo.

Con eso se decide si el mapa está completo antes de que clasifique una sola reunión nueva.

## Decisiones pendientes

1. **El mapa de nombres.** Lo tiene el equipo; es la condición para empezar.
2. **Qué pasa con un título que no casa con ninguna regla**: el clasificador de hoy como respaldo
   (lo más seguro mientras el mapa se completa), u OTRO para mover a mano.
3. **El historial**: ¿se reclasifica con el mapa? Por ejemplo, las 12 ventas que hoy están en
   Descartadas de la pestaña OB. Reclasificarlas las deja PENDING en HT y la tarea las analiza: cuesta
   un análisis cada una. El 2026-09-23 se decidió dejarlas como están; el mapa podría reabrirlo.
4. **Quién edita las reglas**: quien tenga la pestaña (`analizadores.editar`, lo mismo que analizar) o
   solo un administrador.

## Lo que NO cambia

- Las rúbricas de HT y OB, y su PRIMER PASO. Una reunión mal nombrada sigue pudiendo salir «No es HT».
- Las llamadas pegadas a mano: ahí el tipo lo elige la persona.
- `TIPOS_QUE_SE_ANALIZAN`: sigue decidiendo qué tipos se analizan.

## Pruebas que va a necesitar

- la comparación ignora mayúsculas y tildes, y gana la regla de mayor prioridad (código);
- un título que casa no llama al clasificador: el contador de la red falsa queda en cero (base);
- un título que no casa sigue el camino decidido en la decisión 2 (base);
- lo que escribe una empresa en sus reglas no lo ve otra (base, aislamiento);
- la vista previa no escribe nada (base).
