# Léxico

`EJECUCION.md` § 6: *"No se inventa. Si un documento describe una tabla, una columna,
un código de respuesta o un nombre de función, se usa **ese**. Los nombres son las
cadenas que buscan las pruebas. **Un sinónimo rompe la prueba sin romper el código,
que es la peor combinación.**"*

Este archivo existe porque el sistema de referencia
(`aria-project-closer-setter`) usa **otro vocabulario** para las mismas cosas, y de
ahí van a salir los ejemplos que se porten. La deriva no es hipotética.

## Las cadenas que buscan las pruebas

| Sistema de referencia | Cadena de la especificación | Identificador acá | Dónde vive |
| --- | --- | --- | --- |
| `createClient(` | `crearCliente(` | `crearCliente(rol)` | `lib/datos/capa.ts`, **único archivo** |
| `dbSinScope()` | `conIdentidad(` | `conIdentidad(fn)` | `lib/datos/capa.ts` |
| `conCredenciales(cred, fn)` | `conOrganizacion(` | `conOrganizacion(orgId, fn)` | `lib/datos/capa.ts` — **Etapa 2** |
| `activar(cred)` | — | **no existe** (ver abajo) | — |
| `exigir(req, res, roles)` | `exigir(` | `exigir(peticion, capacidades)` | `lib/autorizacion/portero.ts` — **Etapa 3** |
| — | `sesionOpcional(` | `sesionOpcional(peticion)` | `lib/autorizacion/portero.ts` |
| — | `resolverSesion(` | `resolverSesion(token)` | `lib/autorizacion/sesion.ts` |
| — | `verificarOrigen(` | `verificarOrigen(peticion)` | `lib/autorizacion/portero.ts` |
| — | `ESTADOS` | `ESTADOS`, `COMUN`, `SIN_SESION_REQUERIDA` | `lib/autorizacion/estados.ts` |
| — | `"ninguna"` | `NINGUNA` | `lib/autorizacion/capacidades.ts` |
| — | `SECCIONES`, `puede(` | `SECCIONES`, `puede(permisos, seccion)` | `lib/autorizacion/secciones.ts` |
| dos clientes HTTP | — | `pedir(` | `lib/http/cliente.ts`, **único archivo** |
| `org_id`, `empresa` | `org_id` | `org_id` | columna, en toda tabla de negocio |
| `super_admin` | `superadministrador` | `superadministrador` | fila de `roles` — **Etapa 1** |
| `closer_*` en `public` | `identidad.*` / `negocio.*` | dos esquemas, sin prefijo | migraciones |

## `activarContexto` no existe — y es una decisión, no un olvido

`EJECUCION.md` § 6 nombra `activarContexto(` entre las cadenas que buscan las
pruebas. **Ese nombre no aparece en ningún otro de los catorce documentos.** Todos
los textos normativos dicen `conOrganizacion(`: el `03` § 6, el `04` § 7, el `08` § 1,
el `09` § 2 y § 3, y la sonda del `10` § 1.

Y EJECUCION se resuelve contra sí mismo: su § 3 cierra la primitiva —*"almacenamiento
local asíncrono, con la primitiva que **envuelve y cierra**"*— y el `04` § 3 nombra las
dos que existen: *entrar* (`enterWith`, no cierra) y *envolver* (`run`, abre, ejecuta
y cierra). `activarContexto` es por construcción la primitiva de *entrar* —el
`activar()` del sistema de referencia— que el § 3 excluyó.

**Decisión confirmada: `conOrganizacion(orgId, fn)` y `conIdentidad(fn)`. No hay
`activarContexto`.** La mención del § 6 es un arrastre del vocabulario de la
plataforma anterior.

Lo que se gana, y conviene que se vea: con una sola primitiva desaparece entero el
defecto *"El contexto que no propaga"* del `07` § 1 — incluida su peor instancia,
*"en los ganchos de preparación de las pruebas, el contexto no queda puesto para las
pruebas. Eso hizo que una limpieza nunca corriera y quedaran filas de prueba **en
producción**"*. El sistema de referencia necesitó las dos primitivas y una prueba que
vigilara cuál usaba cada archivo. Acá la prueba de la Etapa 2 es un solo `grep`.

## Sinónimos prohibidos

Ninguno de éstos puede aparecer en el código. Cuando exista la prueba de la Etapa 2,
los va a buscar sobre el código **sin comentarios**, excluyendo `pruebas/`:

`dbSinScope` · `activar(` · `activarContexto` · `super_admin` · `empresa_id` ·
`createClient` · `set role`

## Nombres de la base

| Cosa | Nombre |
| --- | --- |
| Esquemas | `identidad`, `negocio`. **`comun` no se crea** |
| Roles | `migrador`, `app_inquilino`, `app_identidad` |
| Variable de transacción | `app.org_id` |
| Contabilidad de migraciones | `public.migraciones_aplicadas`, `public.migraciones_candado` |

## `exigir(` cambió de firma, y el motivo importa más que el cambio

El `03` § 5 escribe `exigir(peticion, respuesta, capacidadesRequeridas)` con el contrato
*"devuelve nulo y ya respondió"*, y lo defiende con un argumento que hay que leer entero
antes de tocarlo:

> *"Devuelve nulo y ya respondió, en vez de lanzar una excepción o devolver un resultado
> con dos ramas. Eso obliga a escribir la línea de salida, y **olvidarse no abre la
> operación**: rompe en cuanto se usa el contexto. Un portero que devolviera un booleano se
> podría ignorar en silencio."*

**Esa firma no es implementable en el App Router.** Un manejador de ruta no recibe un
objeto `respuesta` que se pueda escribir: devuelve una `Response`. No hay a quién
responderle desde adentro del portero.

Así que cambia la firma y **se conserva la propiedad**:

```ts
const ctx = await exigir(peticion, ['usuarios.ver']);
if (ctx instanceof Response) return ctx;   // el portero ya armó la respuesta
```

Olvidarse de esa línea no abre la operación: `ctx.permisos` sobre un `Contexto | Response`
es **error de compilación**, porque `Response` no tiene `permisos`. Es más fuerte que la
versión del documento —ahí olvidarse rompe en tiempo de ejecución, acá no compila— y
conserva lo esencial: no hay forma de ignorar el resultado en silencio.

Las dos salidas que parecen naturales y **no** se toman: lanzar una excepción (el mismo
§ 5 la descarta, y un `catch` de más arriba la volvería un 500 sin código), y devolver
`{ ok, contexto }` (es el defecto que el § 5 nombra: *"quien escriba `si no contexto:
devolver` sobre la forma nueva NUNCA corta, porque un objeto siempre es verdadero"*).

La cadena que buscan las pruebas sigue siendo `exigir(`.

## `ESTADOS`, no `RUTAS_PERMITIDAS`

El mismo diccionario tiene dos nombres en los dos documentos normativos: el `03` § 5 lo
llama `RUTAS_PERMITIDAS`, el `09` § 5 lo llama `ESTADOS`, **con el mismo contenido**. Gana
el `09` por número más alto, y `EJECUCION` § 4 refuerza: del `09` dice que *"la lista blanca
de la § 5 se aplica literalmente"*.

`COMUN` y `SIN_SESION_REQUERIDA` solo existen en el `03`, y se conservan: la fila de
`PRUEBAS` de la Etapa 4 (*"comparando **sin** el conjunto común"*) depende de que `COMUN`
exista como constante propia.

## Las rutas llevan el prefijo `/api`

El `03` § 5 y el `09` § 5 escriben `GET /auth/sesion`. En el App Router el camino real de
`app/api/auth/sesion/route.ts` **es** `/api/auth/sesion`, y el portero compara contra el
camino real. Escribirlas sin el prefijo haría que ninguna coincidiera nunca — y como el
resultado de no coincidir es *rechazar*, el síntoma sería que nadie puede salir de un
estado restringido: falla cerrado, pero bloquea a todo el mundo.
