# Etapa 2 — El aislamiento entre organizaciones

`aplicar_aislamiento()`, la primera tabla de negocio, el contexto por petición con
variable de transacción, la capa fina que inyecta la organización en las escrituras, y
las pruebas arquitectónicas que leen el código fuente.

```bash
npm run db:reset && npm test
```

**94 pruebas, 94 pasan, ~13 s.**

## El criterio de cierre, que `EJECUCION` llama el más importante del proyecto

> "Con dos organizaciones sembradas y **conectando con el rol real de la aplicación**, una
> consulta desde A no devuelve ni una fila de B; sin organización en contexto no se ve
> nada; el rol de identidad **lanza permiso denegado** al tocar negocio; y el rol del
> inquilino lanza al tocar sesiones."
>
> "Correr estas pruebas con el rol propietario las hace pasar todas **sin que nada esté
> protegido**."

Verificado, y también desde `db.mjs verificar`, que es lo que corre en cada `db:reset`:

```
alfa: ve 1 fila(s) de control, 0 ajena(s)
beta: ve 1 fila(s) de control, 0 ajena(s)
principal: ve 1 fila(s) de control, 0 ajena(s)
migrador (propietario, forzado) ve 0 organizaciones
```

## Estado de las once filas de `PRUEBAS.md`, más dos locales

| ADR | Regla | Prueba |
| --- | --- | --- |
| `ADR-0201` ⛔ | Ninguna consulta corre sin organización activa | `base/30-aislamiento` |
| `ADR-0202` ⛔ | Toda operación abre el contexto de su organización | `codigo/10-arquitectura` |
| `ADR-0203` | Un solo lugar crea el cliente de base | `codigo/10-arquitectura` |
| `ADR-0204` ⛔ | Los roles no pueden saltear las políticas | `base/10-migraciones` |
| `ADR-0205` ⛔ | Sin organización en contexto, no se ve nada de negocio | `base/30-aislamiento` |
| `ADR-0206` ⛔ | Con la organización A no se ve ni una fila de la B | `base/30-aislamiento` |
| `ADR-0207` ⛔ | La escotilla no llega a las tablas de negocio | `base/30-aislamiento` |
| `ADR-0208` ⛔ | El dominio del inquilino no llega a la identidad | `base/30-aislamiento` |
| `ADR-0209` | Ninguna operación cruza los dos dominios sin decirlo | `codigo/10-arquitectura` |
| `ADR-0210` | Los rellenos de datos tocan filas de verdad | `base/30-aislamiento` |
| `ADR-0211` | Solo los archivos autorizados usan el acceso sin filtro | `codigo/10-arquitectura` |

Y dos que **no están en `PRUEBAS.md`**, descubiertas midiendo en esta etapa. `EJECUCION`
§ 6 pide reportarlas, no callarlas — y `cobertura.mjs` ahora las lista aparte como
*reglas locales* para que no vivan solo en un comentario:

| ADR | Regla | Prueba |
| --- | --- | --- |
| `ADR-0212` ⛔ | Toda tabla de negocio tiene la forma que cierra las dos verificaciones que no pasan por RLS | `base/31-forma-de-las-tablas` |
| `ADR-0213` ⛔ | Una conexión que vuelve al agrupador con la organización puesta se detecta | `base/32-el-agrupador-devuelve-limpio` |

## Los tres cables trampa que dispararon

Vale registrarlo porque es la prueba de que el mecanismo funciona, no una anécdota: al
crear la primera tabla de negocio y la fase `verificar`, **tres afirmaciones que puse en
etapas anteriores se pusieron en rojo solas**.

1. **`ADR-0108`**: la Etapa 1 afirmaba *"hoy no hay ninguna tabla de negocio"* para que su
   bucle no pasara en vacío. Apareció `control_aislamiento` y falló. Ahora el bucle
   verifica que el inquilino tiene las cuatro operaciones sobre toda tabla de negocio, y
   que el rol de identidad **no tiene ninguna**.
2. **`ADR-0211`**: `scripts/db.mjs` alcanzó `conIdentidad(` sin estar autorizado.
3. **`ADR-0209`**: el mismo archivo pasó a tocar los dos dominios.

Las dos últimas exigieron agregarlo a `pruebas/apoyo/autorizados.ts` **a mano, con su
justificación escrita**. Que sea molesto es el punto: *"agregarla tiene que ser un acto
deliberado que aparece en un cambio que alguien revisa, en vez de una decisión que se toma
sola a las dos de la mañana con un 'solo esta vez'"* (`04` § 4).

## La verificación adversarial, y qué encontró

Las pruebas de arriba las escribí yo, y `EJECUCION` § 8 advierte que estos defectos *"no
fallan"*. Así que antes de cerrar la etapa corrí cinco verificaciones **independientes**
cuyo trabajo era **romper** el aislamiento —no confirmarlo—, cada una por una vía
distinta: SQL directo contra la política, la capa de aplicación, el plugin de inyección,
el agrupador de conexiones, y cruzar por el dominio de identidad.

**Cómo leer el resultado, sin adornarlo.** Una de las cinco declaró ruptura. Ninguno de
los hallazgos alcanzó la gravedad que disparaba la etapa de refutación, así que *"cero
confirmados"* significa **"ninguno llegó a media o más"**, no *"se refutaron cinco"*. Es
una distinción que cambia lo que uno puede afirmar.

### Lo que aguantó — que es la parte que vale

Los negativos son el resultado, no el relleno. Todo esto se intentó y **falló cerrado**:

- **Sin contexto**, 0 filas. Con `app.org_id` en cadena vacía —el valor de reposo tras el
  primer `set_config`—, 0 filas. Con texto que no es uuid, la política **lanza**. Los tres
  modos de falla son cerrados, y el tercero además es ruidoso.
- **Escrituras cruzadas** por los siete caminos que el plugin no reescribe (SQL crudo,
  `update`, `insert … select`, `MERGE`, el `doUpdateSet` de un `on conflict`, org_id como
  expresión cruda, multi-fila): **todas** detenidas por el `with check`. Ni una llegó.
- **El agrupador**: ~4450 iteraciones. 3200 corridas concurrentes de `conOrganizacion` con
  organizaciones mezcladas sobre `max: 5`, con las cinco conexiones físicas sirviendo las
  tres organizaciones cada una —reuso cruzado real y confirmado por pid—: **0 fugas**. Una
  transacción que lanza a mitad, seguida de otra organización en la conexión reciclada: 0
  fugas. Guardar la transacción y usarla después del cierre: Kysely lanza *"Transaction is
  already committed"*.
- **Columnas no otorgadas** de `identidad.usuarios` (`password_hash`, `intentos_fallidos`,
  `bloqueado_hasta`) por **doce** vías indirectas —`select *`, `to_jsonb(u)`,
  `row_to_json(u)`, la referencia de fila completa `select u from usuarios u`, `json_agg`,
  `max()`, `order by`, `where … is not null`, `update … returning`, `set nombre =
  password_hash`—: las doce, *permiso denegado*. PostgreSQL 18 exige privilegio sobre
  **todas** las columnas para cualquier referencia de fila completa, así que el permiso por
  columna es hermético. Y `pg_stats` de `identidad.usuarios` devuelve 0 filas.
- **Escalada**: `app_inquilino` no es miembro de ningún rol con privilegios, no existe ni
  una función `security definer` en ninguno de los dos esquemas, y la única vista es
  `security_invoker`. `app_identidad` no tiene `USAGE` sobre `negocio`, y el truco del
  `search_path` con nombre sin calificar da *relation does not exist*.

### Lo que sí rompió, y ya está arreglado

**Tres de las cinco verificaciones, por separado, encontraron lo mismo** — y es la clase
de hallazgo que más vale, porque el defecto estaba **en mi propio comentario**: la
migración 008 explicaba que *"las verificaciones de unicidad NO PASAN por la seguridad a
nivel de fila"* y por eso acotaba `unique (marca)` a `unique (org_id, marca)`… dejando
`id uuid primary key`, que es un índice único **global**, o sea exactamente el mismo canal
que el comentario decía estar cerrando.

Y al medirlo apareció la mitad grande, que ninguna de las cinco había buscado: **hay dos
verificaciones que no pasan por RLS, no una.** La otra es la **clave foránea**.

```
Montaje A — clave primaria global, FK simple (la forma ingenua):
  padre propio (alfa): ¿el padre es visible desde alfa? sí -> ACEPTADO
  padre AJENO  (beta): ¿el padre es visible desde alfa? NO  -> ACEPTADO   ← acá

Montaje B — clave primaria (org_id, id), FK compuesta:
  padre AJENO  (beta): rechazado: viola la restricción «sonda_hijo_c_org_id_padre_id_fkey»
```

El inquilino de alfa insertó una fila propia que **apunta a una fila de beta que no puede
ver**. La validación de una clave foránea corre con los privilegios del **dueño** de la
tabla referida, así que la política del inquilino no participa. Eso ya no es un canal
lateral de un bit: es una fila de alfa que **depende** de una fila de beta — un borrado en
beta que falla por una referencia invisible, un informe de alfa que cuenta algo de beta.

El arreglo es uno y cierra las dos: **`primary key (org_id, id)` en toda tabla de negocio,
y toda clave foránea entre tablas de negocio lleva `org_id` de los dos lados.** Y regala
un tercer efecto que vale más que los dos anteriores: con la clave primaria compuesta,
`id` deja de ser único por sí solo, así que `references control_aislamiento(id)` **no se
puede ni declarar**. La base rechaza la forma ingenua antes de que nadie tenga que
acordarse.

Dónde vive la exigencia: **dentro de `aplicar_aislamiento()`**, que ya era el paso
obligatorio de toda tabla de negocio. Cinco condiciones, y **previene** en vez de
detectar: la migración se rechaza dentro de su propia transacción. Comprobado revirtiendo
el arreglo —`reset` se detiene en `[migrar]` y nombra los dos problemas—.

La prueba de catálogo existe **además**, y no es redundante: cubre lo único que la función
no puede ver, que es un índice único o una clave foránea agregados por un `alter table`
**posterior** a la llamada.

### Dos más, de las que solo una era mía

**El invariante que no vive en la base.** Todo el alcance de transacción se apoya en que
la conexión vuelva al agrupador con su transacción **cerrada** — y eso la base no lo
controla. Medido: con `release()` sin `commit` ni `rollback`, el siguiente préstamo
devolvió el **mismo backend**, con la transacción abierta, `app.org_id` todavía puesto, y
leyó las filas de la organización anterior. Hoy no es alcanzable —Kysely siempre cierra
antes de devolver, y no hay un `pool.connect()` manual en `lib/`— pero es el invariante
más fácil de romper sin darse cuenta, y su modo de fallar es el peor que hay: datos de
otro inquilino, sin una sola excepción. Ahora `conOrganizacion` **lee la variable antes de
ponerla** y lanza si la conexión trae estado. Cuesta un viaje de ida y vuelta. La prueba
envenena una conexión a propósito y comprueba que la próxima llamada lo **grita**.

**`datos()` entrega la transacción cruda**, así que código de negocio podía correr
`set_config('app.org_id', <otra>, true)` sobre ella y quedar leyendo otra organización
mientras `organizacionActual()` seguía diciendo la primera. No es un salto de la política
—la base hace exactamente lo que le pidieron— pero convierte el contexto en una
*sugerencia*, y una revisión no lo ve. No hacía falta prohibir el SQL crudo: alcanza con
que **un solo archivo pueda poner esa variable**, afirmado como búsqueda en el código. Es
el complemento exacto de `ADR-0203`: si `crearCliente(` vive en un solo lugar, `app.org_id`
también.

### El riesgo residual, dicho de frente

Dos verificaciones lo señalaron por separado y **no se arregla con código**, así que queda
escrito acá: todos los inquilinos comparten **un** rol de base y **una** credencial, y lo
único que los separa es `app.org_id`, que la propia conexión puede fijar a cualquier valor.
Es el modelo estándar de RLS por variable de sesión y es correcto —dentro de un `app.org_id`
fijo el aislamiento es total, en lectura y en escritura—, pero tiene tres consecuencias que
hay que aceptar:

1. Cualquier inyección de SQL que llegue a emitir `SET` convierte una fuga en compromiso
   total entre organizaciones.
2. Los uuid de organización son **capacidades de facto**: no pueden aparecer como
   identificadores públicos.
3. La credencial de `app_inquilino` vale tanto como toda la base de negocio.

A favor del diseño, y verificado: desde adentro el rol **no puede enumerar** uuid de otras
organizaciones — las diez tablas de identidad tienen RLS forzado y sus políticas para
`app_inquilino` están acotadas a `app.org_id`. Toda explotación necesita un uuid conseguido
por otra vía.

## Decisiones tomadas que **no estaban escritas**

1. **`negocio.control_aislamiento` como primera tabla de negocio.** El criterio de cierre
   necesita una tabla con filas de dos organizaciones, y cuál sea el modelo de datos del
   producto todavía no está decidido — inventarlo sería inventar. Pero el `10` § 1 ya
   describe esta tabla: la sonda de la Etapa 8 usa *"dos organizaciones de control, con una
   fila marcada cada una"* sobre una *"tabla de control"*. Así que existe en la
   especificación, sirve ahora y sirve después.

2. **El plugin de inyección extiende `OperationNodeTransformer`, no reescribe el nodo
   raíz** — y esto lo encontró una verificación adversarial, no yo. Un INSERT **puede
   vivir dentro de otra consulta**:

   ```sql
   with "nuevo" as (insert into "t" (…) returning "id") select * from "nuevo"
   merge into "t" … when not matched then insert (…) values (…)
   ```

   En los dos casos el nodo raíz **no** es el INSERT, así que un `transformQuery` que solo
   mira `args.node` los deja pasar **sin `org_id`** — exactamente el agujero que el plugin
   existe para tapar. El transformador recorre el árbol entero. Verificado en los dos
   casos.

3. **`org_id: ColumnType<string, string | undefined, never>` y no `Generated<string>`.**
   El tercer parámetro hace que `updateTable(...).set({ org_id })` sea **error de
   compilación**. Con `Generated` queda permitido por los tipos y solo lo detiene la
   política en tiempo de ejecución — y hay un camino que ni eso cubre bien:
   `onConflict(...).doUpdateSet({ org_id: <ajena> })` compila y sale. Mover la columna del
   inquilino de una fila existente no es una operación que este sistema quiera tener
   disponible: es *"cambiarle el dueño a todo lo que hizo"*, que el `05` § 3 dice que
   necesita su propia operación, su propia capacidad y su propia auditoría.

4. **La inyección es incondicional, con una LISTA DE EXENTAS vacía — no una lista de
   permitidas.** Una lista de permitidas falla **abierto**: se agrega una tabla de negocio,
   nadie la anota, y las escrituras salen sin organización, en silencio. Incondicional
   falla **cerrado y ruidoso**: si se inyecta donde no corresponde, la base contesta
   `column "org_id" of relation … does not exist` en el primer INSERT. Y lo que lo hace
   viable es que el cliente de identidad **no lleva el plugin**, así que el transformador
   nunca ve una tabla de identidad.

5. **`INSERT … SELECT` pasa intacto**, y la política lo rechaza si las filas no son de la
   organización activa. No hay literales que reescribir, y reescribir la lista de selección
   sería adivinar (puede ser una unión, puede ya traer `org_id`, el orden importa).
   **Precondición, no detalle:** esto solo es seguro porque toda tabla de negocio recibe una
   política `for all … with check`. `aplicar_aislamiento()` la pone; si alguien creara una
   tabla sin llamarla, el corredor de migraciones la rechaza antes.

6. **`lib/datos/almacen.ts` existe para romper un ciclo, no por gusto de dividir.**
   `capa.ts` necesita leer la organización activa para el plugin, y `contexto.ts` necesita
   el cliente que construye `capa.ts`. Con el almacén aparte el grafo queda
   `almacen ← capa ← contexto`. La alternativa —un registro que `contexto.ts` rellena al
   cargarse— haría que el comportamiento dependiera del **orden de importación**, que es la
   clase de dependencia que no se ve en ninguna revisión y falla en otro entorno.

7. **El sembrado de negocio va por bucle de `conOrganizacion()`, obligatoriamente.** No es
   estilo: `conIdentidad()` usa `app_identidad`, que **no tiene ningún permiso sobre
   `negocio`**. Y es lo que el `09` § 2 prescribe para todo relleno. La primera corrida lo
   demostró al revés: sin la inyección, el insert falló con
   `new row violates row-level security policy` — la única de las cuatro operaciones que
   **avisa**.

8. **`db.mjs verificar` comprueba el aislamiento por el camino real**, con
   `conOrganizacion()`, no con una conexión de conveniencia. Y con una guarda contra el
   falso verde: si menos de dos organizaciones tienen filas, *"nadie ve filas ajenas"* es
   cierto y vacío a la vez.

9. **El corredor de migraciones acepta `aplicar_aislamiento` calificado.** Su rechazo
   exigía `select aplicar_aislamiento(` literal, y la convención del proyecto es calificar.
   Sin el grupo opcional, el rechazo dispararía sobre una migración correcta.

10. **`conOrganizacion` valida el uuid antes de que llegue a la base.** El
    `nullif(btrim(...))::uuid` de la política **lanza** sobre cualquier texto que no sea un
    uuid, y ese error saldría desde el fondo de una consulta de negocio sin decir de dónde
    vino.

11. **El recorrido de fuentes está memoizado, y nunca entra a `node_modules`.** Dos cosas
    medidas: pasarle `'.'` por accidente hizo que una sola prueba tardara **127 segundos**;
    y releer el árbol en cada prueba de código llevó la suite de 6 a **71 segundos**. Con el
    filtro y la caché, 11. El costo real de una suite lenta no es el tiempo: es la suite que
    alguien deja de correr.

12. **`conIdentidad<T>(` no contiene la cadena literal `conIdentidad(`.** Un genérico de
    TypeScript rompe la búsqueda literal que pide `EJECUCION` § 6 — no para las llamadas,
    que nunca escriben el genérico, pero sí para la **declaración**. Lo delató la
    comprobación de entradas muertas de la lista blanca. Los patrones toleran el genérico.

13. **Se agregaron tres pruebas de código que `PRUEBAS.md` no tiene**, todas de reglas que
    `EJECUCION` § 2 declara y que sin una búsqueda no son enforceables: ninguna primitiva
    de caché bajo `app/`; ningún `'use server'`; y `cacheComponents` sin activar. La de
    `'use server'` es la que más importa — no hay interruptor de configuración, y una acción
    exportada *"es alcanzable por un POST directo aunque nadie la importe"*.

14. **La forma de la tabla es parte del régimen de aislamiento, no una convención.** Las
    cinco condiciones viven **dentro** de `aplicar_aislamiento()` y no en una guía de
    estilo, porque una convención se olvida en la tabla número doce y esto no avisa. El
    costo, dicho de frente: `id` deja de ser único por sí solo, y toda clave foránea que
    apunte a una tabla de negocio tiene que llevar el par. Eso es exactamente lo que hace
    falta, así que el costo **es** la propiedad.

15. **Se editó la migración 008 en lugar de agregar una 009.** Es legítimo solo porque
    todavía **no hay ninguna base en producción**: el desarrollo se reconstruye entero en
    cada `db:reset`, así que no existe un estado aplicado que difiera del archivo. La
    ventaja de editar es que el archivo sigue siendo **diffeable** contra la doctrina en
    un solo lugar, en vez de quedar con la forma equivocada arriba y el arreglo veinte
    líneas abajo. El día que haya producción, esto cambia: no hay registro de sumas de
    comprobación de migraciones (postergado a propósito en la Etapa 0, decisión 25), así
    que **nada detectaría** la edición de una migración ya aplicada.

16. **`cobertura.mjs` lista las reglas LOCALES** —las que el código cita y `PRUEBAS.md` no
    define—. Van a seguir apareciendo: `EJECUCION` § 2 declara reglas que `PRUEBAS.md`
    nunca convirtió en fila, y una etapa puede descubrir una regla midiendo, como pasó con
    las dos de acá. El riesgo no es que existan: es que sean **invisibles**. Sin la lista,
    una regla local vive en un comentario, nadie la cuenta, y la traza dice que la etapa
    está completa.

## El cable trampa que queda armado para la Etapa 3

`ADR-0202` afirma hoy que **no hay ningún manejador de ruta**. El día que la Etapa 3
escriba el primero, esa afirmación falla y quien la arregle tiene que borrar el conteo a
propósito y dejar que el bucle verifique que abre el contexto. Es el mismo mecanismo que
disparó tres veces en esta etapa: la regla existe **antes** que el código que vigila.

## Lo que la Etapa 2 **no** hace

Ningún manejador de ruta, ningún portero, ningún `exigir(`, ningún login, ninguna sesión,
ningún agrupador de conexiones externo, ningún proveedor administrado. La `orgEfectiva` del
rol de plataforma (`04` § 8) es de la Etapa 3: hoy `conOrganizacion` recibe la organización
directamente porque todavía no hay sesión de donde sacarla.

## Pendientes

1. **Proveedor de PostgreSQL administrado** — ahora sí bloqueante. El `08` § 13 lo pone
   *"antes del primer endpoint que lea datos de un inquilino"*, y ése llega en la Etapa 3.
   Requisitos duros en `docs/ETAPA-0.md`. Debería pasar por la habilidad
   `vercel:marketplace`.
2. **El agrupador en modo transacción, con un punto de acceso por rol.** Nunca modo sesión
   ni sentencia. La defensa que ya está puesta es la **lectura de vuelta** de `set_config`
   en `conOrganizacion`, que falla ruidosamente si algún día hay un agrupador mal
   configurado delante — pero eso detecta, no previene.
3. **Protección de rama en `main`** con `verificar` requerido. Pasa de contabilidad a
   defensa real en la Etapa 3, cuando exista el primer endpoint.
4. **Docker Desktop se cayó dos veces** durante esta sesión, con la suite dando 53 fallas
   de `ECONNREFUSED`. Fallaron ruidosamente, que es lo correcto, pero conviene mirar por qué
   se está cayendo.
