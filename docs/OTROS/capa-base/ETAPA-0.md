# Etapa 0 — Infraestructura

Corredor de pruebas, integración continua, herramienta de migraciones, y una base
PostgreSQL que se levanta desde cero con un comando, con los tres roles, los dos
esquemas y las organizaciones sembradas.

```bash
npm run db:reset
```

Local: `docker compose up -d` lo hace solo desde `db:reset`. Hace falta Docker
Desktop corriendo, y un `.env.local` — `node scripts/credenciales.mjs --escribir`.

## Estado de las tres filas ⛔

| ADR | Regla | Prueba | Estado |
| --- | --- | --- | --- |
| `ADR-0001` | Las pruebas corren en cada cambio y **pueden bloquear** | `pruebas/codigo/00-el-corredor-bloquea.test.ts` | **Parcial — ver abajo** |
| `ADR-0002` | Las migraciones son versionadas y se aplican igual en todos lados | `pruebas/base/10-migraciones.test.ts` | Pasa |
| `ADR-0003` | Hay dos organizaciones con datos distintos en desarrollo | `pruebas/base/11-sembrado.test.ts` | Pasa |

37 pruebas, 37 pasan, ~5 s.

### `ADR-0001` está implementada pero **inerte**, y lo honesto es decirlo

El workflow pone la corrida en **rojo**. Que el rojo **bloquee** necesita dos cosas
más, que no son código:

1. una regla de protección de rama en `main` con `verificar` como chequeo
   **requerido**, y
2. que el trabajo llegue por **pull request**.

Y pesa más de lo normal acá porque **Vercel está conectado a este repo**: Vercel
despliega **por push, no por chequeo**. Hoy el repo tiene 2 commits, los dos directos
a `main`. Sin esas dos piezas, un commit con las pruebas en rojo se publica en
producción igual.

`PRUEBAS.md` sobre este innegociable: *"Sin esto, nada de lo demás existe. Solo se
cree que existe."* Por eso no está tildada.

## Qué quedó implementado

| Pieza | Dónde |
| --- | --- |
| Controlador + constructor encadenable | `pg` 8.23.0 + `kysely` 0.29.5, ambos exactos |
| Corredor de pruebas | `node:test` de Node 24, cero dependencias, vía `scripts/pruebas.mjs` |
| Integración continua | `.github/workflows/verificar.yml` |
| Base local | `docker-compose.yml` — Postgres 18, efímero, sin volumen nombrado |
| Los tres roles | `db/arranque/000_cluster.sql` (objetos de **clúster**, superusuario) |
| Los dos esquemas + permisos por omisión | `db/migraciones/001_esquemas_y_permisos.sql` |
| `organizaciones` y `usuarios` con sus políticas | `db/migraciones/002_organizaciones_y_usuarios.sql` |
| Corredor de migraciones con sus compuertas | `lib/datos/migrador.ts` |
| La capa de datos | `lib/datos/capa.ts` — **único** archivo con `crearCliente(` |
| Hash de contraseñas | `lib/datos/hash.ts` — `scrypt`, parámetros dentro del hash |
| El sembrado | `db/sembrado/organizaciones.ts` — escribe por `conIdentidad()` |

## Lo que la compuerta del controlador decidió

`EJECUCION` § 5 pide correrla *"antes de nada"*. Pasó, y de paso resolvió tres cosas
que estaban abiertas:

1. **`kysely` + `pg` sostienen transacciones interactivas** con variable de alcance de
   transacción sobre una conexión fijada, verificado con `pg_backend_pid()` dentro y
   fuera de la transacción. El diseño es implementable.
2. **El casteo desnudo `current_setting(...)::uuid` LANZA** sobre la cadena vacía.
   Está afirmado, no comentado, así que nadie puede borrar el
   `nullif(btrim(...), '')` de una política sin que una prueba se ponga roja.
3. **`has_table_privilege` NO ve los permisos por columna.** Eso decide una fila ⛔ de
   la Etapa 1: tal como está escrita en `PRUEBAS.md` (*"`has_table_privilege` por
   tabla"*), **fallaría sobre código correcto** en `identidad.usuarios`, que tiene
   `grant select (id, org_id, nombre, email, activo)`. Se implementa la versión del
   `09` § 4 —el bucle acotado al esquema `negocio`— más aserciones de
   `has_column_privilege` que confirman que `password_hash`, `intentos_fallidos` y
   `bloqueado_hasta` **no** son alcanzables por `app_inquilino`.

## Decisiones tomadas que **no estaban escritas**

`EJECUCION` § 6 pide este apartado al cerrar cada etapa: *"es donde aparecen las
decisiones que nadie tomó a propósito."*

1. **`kysely@0.29.5` + `pg@8.23.0`**, `node:test`, y migraciones `.sql` aplicadas
   verbatim con un `MigrationProvider` propio. Los documentos piden las propiedades,
   no los paquetes. Kysely es el único candidato con un transformador de AST global
   —el gancho donde la Etapa 2 va a inyectar la organización— y suma **cero**
   dependencias transitivas. Drizzle quedó descartado por un motivo verificable:
   `drizzle-kit` arrastra `esbuild`, que **sí** tiene guion de instalación.
2. **TypeScript acotado**: `strict`, `allowJs`, `checkJs: false`. Los 16 módulos de
   `lib/aios/*.js` y los `.jsx` quedan intactos. El motivo decisivo: los archivos que
   se van a portar del sistema de referencia son TS estricto, y transcribirlos a
   mano sería una transformación con tasa de error no nula **justo en los archivos
   donde un error es una lectura entre inquilinos**.
3. **`"type": "module"` en `package.json`.** Verificado antes: el repo no tiene ni un
   `require(`, `module.exports`, `exports.` ni `__dirname`. Sin esto, Node reparsea
   cada `.ts` con una advertencia en cada corrida.
4. **`migrationTableSchema: 'public'`.** Por omisión Kysely crea su tabla en el primer
   esquema del `search_path`, y `migrador` tiene `identidad, negocio` — la
   contabilidad nacería **dentro de `identidad`** y la prueba de catálogo de la
   Etapa 1 fallaría sobre la tabla de la propia herramienta.
5. **La fila de PRUEBAS Etapa 1 sobre el esquema de catálogos se REESCRIBE apuntando a
   `public`.** Sin `comun`, el agujero por exclusión se muda ahí. El valor de esa fila
   —que `PRUEBAS.md` llama *"la más valiosa del documento entero"*— nunca fue `comun`:
   era *el esquema que la prueba de RLS excluye*. Ya está escrita y verde.
6. **`TABLAS_COMPARTIDAS` es el conjunto vacío.** No hay esquema `comun` ni tablas sin
   dueño. Es la versión más fuerte posible de esa prueba; queda dicho para que nadie
   la "arregle" agregando algo.
7. **Las migraciones usan nombres calificados** (`create table identidad.organizaciones`),
   al revés de lo que pide el `01` § 0. Motivo: el `09` § 6 nombra la ruta de búsqueda
   mal puesta como el mecanismo real por el que una tabla nace en el esquema
   equivocado, y el `search_path` por rol solo aplica a sesiones abiertas **después**
   del `alter role`. El corredor lo hace cumplir. El código de la aplicación **sí**
   escribe sin calificar.
8. **Los tres `search_path` pierden `comun`.** Un `search_path` que nombra un esquema
   inexistente no da error: se ignora en silencio, que es peor que uno roto.
9. **`PRUEBAS.md` § Etapa 0 dice "tres esquemas"; `EJECUCION` § 5 dice "los dos
   esquemas".** Gana EJECUCION por la regla de precedencia del § 4. Se reporta, no se
   pregunta.
10. **`grant create on database` para `migrador`**, además de `connect`: sin eso
    `create schema` falla con *permission denied for database*. Y **`grant usage,
    create on schema public to migrador`**, porque desde PostgreSQL 15 nadie salvo el
    dueño de la base tiene `CREATE` sobre `public`.
11. **El nombre de la base y las tres contraseñas se sustituyen en
    `000_cluster.sql`** desde el entorno, citados con `escapeLiteral` /
    `escapeIdentifier`. `alter role … password $1` no acepta parámetros —la misma
    limitación que `SET`— y `grant … on database` exige un nombre literal. Nunca hay
    una contraseña escrita en un archivo.
12. **TRES organizaciones sembradas, no dos.** El criterio literal pide dos y dos
    alcanza, pero el cierre de la Etapa 1 necesita que fallen las tres cosas —borrar
    al fundador, desactivar la principal, asignar el rol de plataforma a un usuario de
    un cliente— y eso exige una principal **más** dos clientes. Con solo dos, una
    tendría que ser la principal, y las pruebas de aislamiento de la Etapa 2
    compararían la principal contra un cliente, cuyo usuario es el superadministrador
    con `orgEfectiva` conmutable: el peor fixture posible para la prueba más
    importante del proyecto. *"Las dos organizaciones sembradas"* son `alfa` y `beta`.
13. **El sembrado crea usuarios CON credenciales**, lo que obliga a escribir
    `lib/datos/hash.ts` en la Etapa 0 —código de la Etapa 4—. Alternativa disponible:
    usuarios sin credenciales, que la restricción permite, a cambio de resembrar
    después.
14. **Un usuario con `es_admin_principal`**, en la organización principal. Hace que el
    `npm run db:sembrar` local sea incompatible con el guion de arranque de la Etapa 5
    (*"un solo disparo"*) — correcto: a una base de desarrollo se la siembra, no se la
    arranca.
15. **El sembrado se niega a correr contra un anfitrión que no sea local**, salvo
    `ARIA_SEMBRADO_FORZADO=1`. Escribe usuarios con una contraseña de desarrollo
    conocida. Se eligió el guard de anfitrión antes que una bandera obligatoria en
    cada corrida, para que `db:reset` siga siendo **un** comando: una bandera que hay
    que pasar siempre es una bandera que alguien va a guionizar.
16. **`--test-concurrency=1`.** Todas las pruebas de base comparten una base y varias
    enumeran objetos globales (esquemas, tablas de `public`, roles). En paralelo, un
    objeto que otra prueba crea y borra aparece en esa enumeración y la falla depende
    del orden — que es como se aprende a volver a correr la suite hasta que da verde.
    Ya pasó una vez durante esta etapa: la sonda de permisos creaba una tabla en
    `public` mientras la prueba de catálogo enumeraba `public`. Ahora es temporal.
17. **La Etapa 7b se adelantó a la Etapa 0**: `.npmrc` con `ignore-scripts=true` y
    `save-exact=true`, y **todas** las versiones exactas —incluidos los cuatro `^`
    preexistentes de `react`, `react-dom`, `tailwindcss` y `playwright`—, para que la
    regla nazca satisfecha en vez de fallar sobre una condición preexistente. Su
    contenido es infraestructura de esta semana, y dejarla en 7b significaría que el
    servidor de construcción corre dependencias sin fijar y con guiones habilitados
    **durante todo el proyecto**, mientras sostiene `CLAVE_MAESTRA`.
18. **La lista de excepciones de guiones de instalación tiene UNA entrada, no cero:**
    `node_modules/fsevents`, que es solo de macOS y opcional. Con `ignore-scripts=true`
    ningún guion corre de todos modos; la comprobación del lockfile sirve para avisar
    cuando entra un paquete **nuevo** con guion.
19. **`.gitattributes` con `eol=lf`** para `.sql`, `.ts`, `.mts`, `.mjs`, `.yml` — y
    normalización `\r\n` → `\n` antes de mirar contenido en el corredor. Verificado:
    `core.autocrlf = true` y los 48 archivos del repo están en CRLF en el disco
    mientras git guarda LF. No está en ningún documento y muerde el día uno. **No** se
    puso un `* text=auto eol=lf` global, para no renormalizar los archivos que ya
    existen.
20. **`next-env.d.ts` y `*.tsbuildinfo` van al `.gitignore`.** `next-env.d.ts` importa
    de `.next/types/`, así que `tsc --noEmit` **exige un build previo** — de ahí el
    orden en la integración: `build` → `tipos`.
21. **`NODE_TEST_CONTEXT` se borra al lanzar un corredor hijo.** Verificado: Node se la
    pone a todo archivo de prueba que corre como subproceso, y un `node --test` que la
    hereda **sale 0 aunque sus pruebas fallen**. Sin borrarla, la prueba que sostiene
    el innegociable nº 1 no verificaría nada de lo que dice. Queda afirmado como
    prueba, no como comentario.
22. **El envoltorio de pruebas aborta si la lista de archivos está vacía.**
    Verificado: `node --test` con un patrón que no coincide con nada **sale 0**. Un
    glob mal escrito dejaría la integración verde con cero pruebas.
23. **El entorno lo carga el proceso hijo del corredor**, no el guion de npm, para que
    `node scripts/pruebas.mjs` funcione igual que `npm test`.
24. **La lista de autorizados de `set role` tiene una entrada**,
    `lib/datos/migrador.ts` — el archivo que **prohíbe** la cadena la contiene, en un
    literal de expresión regular que quitar comentarios no exime. Con comprobación de
    entradas muertas, porque una lista blanca sin eso es un permiso permanente.
25. **`db:reset` cruza los dos dominios** —migrar como `migrador`, sembrar como
    `app_identidad`— y entre dominios **no hay atomicidad** (`09` § 6). Aceptable
    porque es idempotente por destrucción, porque `verificar` es una fase aparte que
    comprueba el **efecto**, y porque nunca imprime un "listo" liso: dice qué fases
    completó.
26. **La integración no usa ni un secreto de GitHub**: genera las contraseñas en el
    propio trabajo, porque la base vive y muere ahí. De paso cumple la nota del
    `09` § 2 — la contraseña de `migrador` no está en el entorno de la aplicación.
27. **No se implementa agrupador de conexiones** en ningún entorno de la Etapa 0. Pero
    el modo del agrupador **no** es solo un problema de escala —modo sentencia rompe el
    alcance de transacción sin avisar— así que sí se implementó la defensa que no
    cuesta nada: la **lectura de vuelta** de `set_config`, que falla si el agrupador
    está en modo sentencia. Más la búsqueda en CI que prohíbe `set_config(…, false)`,
    `set session` y `set role`.
28. **La imagen de Postgres se fija por versión mayor (`postgres:18-alpine`, hoy
    18.6), no por parche.** El requisito de paridad es contra el proveedor
    administrado, que todavía no existe: fijar un parche ahora sería precisión falsa.
29. **Postponed a propósito:** el registro de sumas de comprobación de migraciones
    (detectaría una migración editada después de aplicada), `revoke connect on
    database … from public`, `engine-strict=true`, y fijar la imagen por digest.

## Decisiones registradas ahora, implementadas después

Cuestan una frase hoy y una reescritura más adelante.

1. **`scripts/paridad.mjs` no se retira.** Va a fallar por diseño en cuanto exista una
   puerta de autenticación, pero retirar la única compuerta que el repo tiene hoy en
   la misma etapa que construye su reemplazo deja una ventana sin compuerta. Plan:
   montar el prototipo en `app/(prototipo)/prototipo/page.js` con `notFound()` en
   producción, apuntar `PARIDAD_URL` ahí, y borrar las aserciones de cada vista en el
   **mismo** PR que reactifica su módulo — con un guard que imprime "retirada" y sale 0
   cuando `VISTAS` queda vacío. Sin eso, la compuerta se pone roja para siempre y todo
   el mundo aprende a ignorarla.
2. **La arquitectura queda fijada como cliente → manejador de ruta → portero → capa
   fina → base.** Los módulos de `lib/aios/*` corren en el cliente (los arranca un
   `useEffect` en `components/CommandCenter.jsx`), así que solo pueden obtener datos
   por `fetch`; combinado con la prohibición de `'use server'` de `EJECUCION` § 2, no
   queda otra forma. Es lo que hace **completa** la prueba de la Etapa 3.
3. **Un cambio de inquilino tiene que recargar la página.** `bootAios()` tiene guard de
   una sola ejecución y los módulos guardan estado en `window.AIOS*`, así que después
   de cambiar `orgEfectiva` los números ya pintados sobreviven. Y el cartel permanente
   del `04` § 8 lo renderiza React, no un módulo de aios, o desaparece en la primera
   navegación del lado del cliente.
4. **Nunca un respaldo implícito a datos de ejemplo.** Es estructuralmente idéntico al
   `??` del `07` § 1 que ya costó que una organización escribiera en la cuenta externa
   de otra: *"un cero medido y un cero por falta de datos se muestran distinto"*.
5. **Un solo cliente HTTP**, `lib/data/cliente.ts`, escrito mientras la cuenta de
   `fetch(` es cero. La fila de la Etapa 3 *"un rechazo por permiso no se muestra como
   'no hay datos'"* solo es escribible si hay exactamente un cliente que probar.
6. **Nada de `proxy.js` ni `middleware.js`.** En Next 16.3 `middleware.js` está
   deprecado y renombrado a `proxy.js`; el proxy corre en **cada** ruta, incluidas las
   prefetcheadas, su propia documentación dice que *"no debería usarse como solución
   completa de sesión o autorización"*, y un `AsyncLocalStorage` abierto ahí **no
   llega** al manejador. El portero va en los manejadores de ruta.
7. **`'use server'` no tiene interruptor de configuración** — solo `allowedOrigins` y
   `bodySizeLimit`. Una acción exportada *"es alcanzable por un POST directo"* aunque
   nadie la importe. La prohibición de `EJECUCION` § 2 es enforceable **solo por
   grep**, y ese grep tiene que matchear directivas en línea. **No está en `PRUEBAS`:
   hay que agregar la fila.** El repo la pasa hoy.
8. **Los manejadores de ruta no se cachean por omisión** en esta configuración, así que
   el *"nada se cachea"* del § 2 es el comportamiento por defecto. Se sostiene con: no
   activar `cacheComponents`, una búsqueda que prohíbe el vocabulario de caché bajo
   `app/api/**`, y un único helper de respuesta con `no-store`.

## Pendientes que no son código

1. **Protección de rama en `main`** con `verificar` requerido, y trabajo por pull
   request. Sin eso, `ADR-0001` es inerte (arriba).
2. **Proveedor de PostgreSQL administrado.** Se vuelve bloqueante al cierre de la
   Etapa 2. Debería pasar por la habilidad `vercel:marketplace` (`discover` antes de
   recomendar). Requisitos duros: transacciones interactivas por TCP · **poder crear
   tres roles con contraseña y `search_path` por rol** (filtro duro) · agrupador en
   **modo transacción** con un punto de acceso por rol, nunca modo sesión ni sentencia ·
   **la región de las funciones de este proyecto de Vercel**, que ya está fijada y hay
   que consultar · volcado de roles aparte · ningún rol de aplicación con `bypassrls`
   ni superusuario, y ninguna "clave de servicio" que saltee las políticas · sin modelo
   de clave pública para el navegador · paridad de versión mayor con el contenedor
   local.
3. **Quién sostiene la credencial de `migrador` en producción** — política, no técnica.
   Ya decidido por diseño: esa variable **no** se agrega al proyecto de Vercel.
4. **`EJECUCION.md` está sin trackear en git** en el repo de la especificación
   (`?? docs/migracion/EJECUCION.md`). El documento que manda sobre los otros trece
   existe solo en una máquina.
5. **Instalar el CLI de Vercel** (`npm i -g vercel`) para consultar la región.
