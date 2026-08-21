# Etapa 3 — Permisos y el portero

El portero, el catálogo de capacidades, las listas blancas por estado de sesión, la
verificación de origen, el único cliente HTTP, y **los primeros cuatro manejadores de ruta
del proyecto**.

```bash
npm run db:reset && npm run tipos && npm test
```

**133 pruebas, 133 pasan.**

## El criterio de cierre

> `EJECUCION` § 5: *"la prueba que recorre los manejadores de ruta y verifica que **todos**
> llaman al portero, salvo la lista explícita de rutas públicas."*

Cumplido, y con una desviación de la letra que hace falta explicar. El `03` § 6 escribe la
prueba como *"afirmar que codigo contiene `exigir(`"*, **a nivel de archivo** — y ahí hay un
agujero concreto: un `route.ts` con `GET` y `POST` donde solo `GET` llama al portero
**pasa**, y el `POST` queda abierto respondiendo 200. La prueba recorre **método por
método**.

## Verificado contra un servidor de verdad

`EJECUCION` § 6 pide lo que no es una prueba: *"nada se marca como terminado sin verificarlo
contra la base"*. Con `next start` y `curl`:

```
GET  /api/salud                      200  cache-control: no-store
GET  /api/usuarios      (sin cookie) 401  {"codigo":"sin_sesion"}
GET  /api/usuarios      (con cookie) 200  solo Ana, la usuaria de alfa
GET  /api/control       (con cookie) 200  solo control-alfa
GET  /api/auth/sesion   (sin cookie) 200  {"autenticado":false}     ← no 401, a propósito
PATCH /api/auth/sesion  (sin Origin) 403  {"codigo":"origen_no_permitido"}
PATCH /api/auth/sesion  (Origin ajeno) 403 {"codigo":"origen_no_permitido"}
PATCH /api/auth/sesion  (Origin propio) 403 {"codigo":"sin_permiso"}  ← ana no es plataforma
DELETE /api/auth/sesion              200  set-cookie: __Host-sesion=; Path=/; HttpOnly;
                                          Secure; SameSite=Lax; Max-Age=0
```

`/api/control` es la primera operación que recorre **la cadena entera** — cliente →
manejador de ruta → portero → contexto de organización → capa fina → política de la base — y
devolvió una sola fila, la de su organización. Hasta ahora la Etapa 2 había demostrado el
aislamiento desde un script y la Etapa 3 el portero con peticiones armadas a mano; nadie
había demostrado que las dos piezas encajan.

Y el `build` marca las cuatro rutas como `ƒ (Dynamic)` sin una sola línea de configuración
de segmento, que es la confirmación de que *"nada se cachea"* es el comportamiento por
omisión y no algo que haya que declarar.

## Estado de las seis filas de `PRUEBAS.md`

| ADR | Regla | Prueba | Estado |
| --- | --- | --- | --- |
| `ADR-0301` ⛔ | Toda operación llama al portero | `codigo/30-portero`, `base/40-portero` | verde |
| `ADR-0302` | El permiso se pregunta por capacidad, nunca por nombre de rol | `codigo/30-portero`, `base/40-portero` | verde |
| `ADR-0303` | Todo rol asignable tiene al menos una pantalla | `codigo/30-portero` | **inerte, ver abajo** |
| `ADR-0304` | Las operaciones de una misma pantalla piden el mismo conjunto | `codigo/30-portero` | parcial |
| `ADR-0305` | Un rechazo por permiso no se muestra como "no hay datos" | `codigo/30-portero` | verde |
| `ADR-0306` | Toda petición que modifica verifica el origen | `codigo/30-portero`, `base/40-portero` | verde |

### `ADR-0303` está implementada e **inerte**, y hay que decirlo

**Ninguna de las diez pantallas del prototipo corresponde a ninguna de las trece capacidades
del catálogo.** Las trece son de identidad y administración (`usuarios.*`, `roles.*`,
`credenciales.*`, `configuracion.editar`, `auditoria.ver`, `organizaciones.*`); las diez
pantallas son de producto —Executive, Leads Portal, ICP, Acquisition, Creative, Conversion,
Conversation, Sales, Setter, Closer— y **no tienen ni una operación de servidor**.

Una pantalla sin operaciones no puede filtrar nada. Así que `SECCIONES` tiene **una** entrada
—`usuarios`, la que sirve `GET /api/usuarios`— y las diez del prototipo están en
`SIN_OPERACIONES_TODAVIA`, una lista escrita a mano y no derivada, **a propósito**: es la
lista que alguien tiene que editar el día que una de esas pantallas reciba su primera
operación. Una lista derivada se actualizaría sola y nadie decidiría nada. Hay una prueba que
falla ese día.

**La trampa que este archivo podría ser, nombrada para que no vuelva:** el defecto natural
acá es *la lista paralela* — declarar `SECCIONES` y dejar el menú renderizándose de otra
lista. Las dos pruebas quedan verdes para siempre verificando un arreglo que ningún píxel usa,
mientras el menú muestra las diez secciones a todo el mundo. Es *"un éxito reportado que no
ocurrió"* (`07` § 0).

Hoy la clave de cada pantalla está repetida **en cuatro lugares**: `components/Nav.jsx` (JSX
literal con `data-view`), el mapa `GROUP` de `lib/aios/shell.js`, los `id="v-…"` de
`components/views/*View.jsx`, y `const VISTAS` de `scripts/paridad.mjs`. Unificarlos exige
reescribir `Nav.jsx` como un `.map()` que produzca un DOM **idéntico** al del prototipo, o
`npm run paridad` —la única compuerta que compara el port con el original— empieza a fallar y
se termina desactivando. **Eso es trabajo de la etapa que le dé interfaz a la primera pantalla
administrada, no de ésta.** Queda como deuda, con su riesgo nombrado.

## Las tres desviaciones de la especificación, y por qué

### 1 · `exigir(` cambió de firma

El `03` § 5 escribe `exigir(peticion, respuesta, capacidades)` con el contrato *"devuelve nulo
y ya respondió"*. **No es implementable en el App Router:** un manejador de ruta no recibe un
objeto `respuesta`, devuelve una `Response`.

Se cambia la firma y **se conserva la propiedad que el documento defiende**:

```ts
const ctx = await exigir(peticion, ['usuarios.ver']);
if (ctx instanceof Response) return ctx;
```

Olvidarse de esa línea no abre la operación: `ctx.permisos` sobre un `Contexto | Response` es
**error de compilación**. Es más fuerte que la versión del documento —ahí olvidarse rompe en
tiempo de ejecución, acá no compila—. Detalle en `docs/LEXICO.md`.

### 2 · Las rutas llevan el prefijo `/api`

El `03` y el `09` escriben `GET /auth/sesion`. El camino real es `/api/auth/sesion`.
Escribirlas sin el prefijo haría que ninguna coincidiera nunca — y como el resultado de no
coincidir es *rechazar*, el síntoma sería que **nadie puede salir de un estado restringido**:
falla cerrado, pero bloquea a todo el mundo.

### 3 · Una contradicción del `03` § 5 consigo mismo

El paso 0 dice que el portero **lanza** si la ruta está en `SIN_SESION_REQUERIDA` —o sea que
esas dos rutas nunca llegan a los pasos 2 y 3—, pero el comentario del mismo paso 0 afirma que
*"cuando SÍ hay sesión las dos siguen pasando por el resto del portero"*, y el paso 3 lleva una
guarda que **solo tiene sentido si sí llegan**. Es la misma sección del mismo documento, así
que la regla de precedencia no aplica y `EJECUCION` no lo resuelve.

**Las dos lecturas dan el mismo comportamiento observable**, y por eso no bloqueé: esas rutas
están en las cuatro listas de `ESTADOS` (así que el paso 2 nunca las rechazaría) y están exentas
del paso 3 por la guarda literal. Implementadas por `sesionOpcional(`, el resultado es idéntico.
Vale corregir el documento de origen.

## Decisiones que la especificación **no toma**

1. **`esRolDePlataforma` se calcula por la bandera `solo_principal`**, no por el nombre del rol
   ni por la capacidad `organizaciones.listar`. Ningún documento lo define. Se elige
   `solo_principal` porque el `03` § 3 la llama *"la barrera contra la escalada entre
   inquilinos"* y **un disparador de la base ya la hace cumplir**, así que el dato es tan
   confiable como la barrera. Lo prohibido es la tercera vía, la que aparece sola: comparar
   `clave === 'superadministrador'`, que funciona hoy y miente el día que exista un segundo rol
   de plataforma.

2. **El hash del token de sesión es SHA-256 en hexadecimal**, y vive en su propio módulo, lejos
   de `lib/datos/hash.ts`. El `02` § 2 fija SHA-256 y explica que no es una inconsistencia
   —*"el token ya son 32 bytes aleatorios, así que no hay diccionario que probar; el costo del
   algoritmo lento no compraría nada y se pagaría en cada petición"*—, pero **ninguno de los
   catorce documentos dice hex o base64**. Elegirlo distinto en la Etapa 4 (que escribe) que en
   la 3 (que lee) hace que nadie pueda entrar: falla ruidoso y desperdicia una tarde. Por eso
   hay **una** función y las dos etapas la comparten.

3. **`resolverSesion` verifica `usuarios.activo`.** Defensa en profundidad: el `05` § 6 dice que
   al desactivar un usuario se cierran sus sesiones, o sea que la única defensa es una
   **escritura en otra operación**. Si esa escritura falla o se olvida, el usuario desactivado
   sigue trabajando hasta que la sesión venza y nada avisa. Una condición más en el `where`
   cuesta cero.

4. **`PATCH /api/auth/sesion` está exenta del paso 3.** El `04` § 8 solo cubre la organización
   *borrada*. Con la organización que existe pero está **inactiva**, un usuario de plataforma
   que desactive la que está mirando **queda encerrado**: toda ruta le contesta 403
   `organizacion_inactiva`, incluida la única con la que podría volver a la propia. El `03` § 5
   ya estableció que un estado sin salida es un defecto.

5. **El 403 de origen recibe código de cuerpo (`origen_no_permitido`).** Es el único 403 de toda
   la especificación **sin** código —el `08` § 5.3 responde una cadena— y justo el que el
   cliente no podría distinguir de los otros cinco.

6. **Hay un 503 `base_no_disponible`, que no está en ningún documento.** Si la base falla, la
   respuesta **no puede** ser 401 `sin_sesion`: eso expulsaría a todos los usuarios a la vez y
   en los registros parecería que a nadie le andaba la sesión (`07` § 4). Es la regla 2 del
   `07` § 0: un valor significa una sola cosa. `resolverSesion` **no** se traga errores.

7. **La cookie se serializa a mano, y no con la API del framework.** No es ceremonia: está
   verificado en `node_modules/next/dist/compiled/@edge-runtime/cookies/index.js` que
   `normalizeCookie()` solo rellena `path` y que `ResponseCookies.delete()` hace
   `set({ value: "", expires: new Date(0) })` **sin `Secure`**. Como el navegador rechaza
   cualquier `Set-Cookie` de nombre `__Host-` sin `Secure`, un `cookieStore.delete()` haría que
   `DELETE /api/auth/sesion` **responda 200 con la cookie intacta** — la falla exacta que el
   `02` § 5 existe para impedir, y que una prueba de "responde 200" no ve. La misma trampa del
   otro lado en el login: sin `secure: true` el navegador descarta la cookie en silencio, el
   login responde 200, y como los navegadores tratan `http://localhost` como origen seguro,
   **puede funcionar en desarrollo y fallar en producción**.

8. **`npm run tipos` ahora corre `next typegen` antes de `tsc`.** El helper `RouteContext` es un
   global **generado**, y solo se emite si ya existe al menos un manejador de ruta. En un
   checkout limpio, `tsc --noEmit` a secas falla con *"Cannot find name 'RouteContext'"* y eso
   se lee como un error del código nuevo.

9. **`lib/http/cliente.ts` es el único archivo que hace peticiones HTTP**, y la regla no está en
   la especificación: el `07` § 4 describe el *defecto* de tener dos con manejo opuesto, no la
   regla. Se adopta por simetría con `ADR-0203`. Y `Respuesta<T>` **no tiene rama nula**, así que
   `await pedir(…) ?? []` —la línea que ya destruyó esta regla una vez— no se puede escribir.

10. **`RUTAS_PUBLICAS` tiene dos entradas posibles, no tres.** `PRUEBAS.md` dice *"login, salud,
    arranque"*, pero `EJECUCION` § 3 cerró que el arranque es un **script contra la base, no
    endpoint HTTP** — y el `03` § 6 coincide: *"(login, salud)"*. Hoy solo está la salud; el login
    es de la Etapa 4.

11. **`RUTAS_CON_SESION_OPCIONAL` es una lista aparte de `RUTAS_PUBLICAS`.** Una ruta pública **no
    mira** la sesión; éstas la miran y **toleran que no haya**. Colapsar las dos listas convertiría
    "tolera que no haya sesión" en "no mira la sesión", que es un permiso mucho más grande.

12. **Se agregaron cuatro búsquedas del `07` que `PRUEBAS.md` no tiene**, en
    `pruebas/codigo/20-errores-ya-pagados.test.ts`. `EJECUCION` § 4 clasifica el `07` como
    contexto —*"no se implementa nada de acá"*— y es correcto: no describe un sistema, describe
    cicatrices. Pero hay diferencia entre *no se implementa* y *no se vigila*. Las cuatro muerden,
    verificado inyectando la violación.

13. **`cobertura.mjs` lista las reglas locales.** Ya venía de la Etapa 2; ahora hay más.

## Lo que la verificación de Next 16 cambió

Cuatro cosas que no se podían saber sin leer el paquete instalado, y todas cambiaron código:

- **`revalidate = false` ACTIVA la generación estática.** Los documentos lo describen como
  *"(default)"*, así que alguien lo escribe **para ser explícito** — y con eso el manejador entra
  en generación estática. Verificado en `is-static-gen-enabled.js`. Lo mismo `dynamic = 'error'`,
  y `generateStaticParams` sola. Los tres están en la búsqueda prohibida, no solo
  `force-static`.
- **`experimental.useCache: true` habilita `'use cache'` sin `cacheComponents`.** La prueba que
  solo buscaba `cacheComponents: true` tenía ese hueco; ahora son ocho claves.
- **Las rutas de metadatos** (`sitemap`, `opengraph-image`, `icon`, `robots`, `manifest`) se
  compilan a manejadores de ruta que exportan `GET`, **pueden consultar la base**, no pasan por
  el portero y salen con `Cache-Control: public`. Ninguna prueba que busque `route.*` las ve.
  Hoy no hay ninguna, y eso ahora se **afirma**.
- **El `08` § 3 regla 1 contradice a `EJECUCION` § 2.** El `08` pide *"toda ruta autenticada se
  declara dinámica, explícitamente"*, y en esta versión la única forma es
  `export const dynamic = 'force-dynamic'` — una primitiva de caché, justo lo prohibido. Gana
  `EJECUCION`. La explicitud se consigue de dos formas que no son primitivas: la búsqueda (que no
  se puede olvidar, a diferencia de una declaración por archivo) y el `no-store` explícito del
  constructor de respuestas. Y en 16.3.1 el comportamiento por omisión **ya** es dinámico, así
  que la regla defiende contra un riesgo que en esta versión no existe.

## Lo que la Etapa 3 **no** hace

Ningún login, ninguna creación de sesión, ningún freno por intentos, ningún segundo factor,
ninguna pantalla nueva, ningún cambio en `Nav.jsx` ni en `lib/aios/*`, ningún `proxy.ts`
—el portero va en los manejadores, y los documentos de Next avisan dos veces que el proxy
*"no debería ser tu única línea de defensa"*—, ninguna alta de organizaciones ni de usuarios.

## Pendientes

1. **Proveedor de PostgreSQL administrado.** Sigue siendo el bloqueante para *desplegar*: el
   `08` § 13 lo pone *"antes del primer endpoint que lea datos de un inquilino"*, y ese endpoint
   ahora existe (`/api/control`, `/api/usuarios`). El desarrollo y las pruebas corren contra el
   contenedor local; lo que no se puede es desplegar esto a producción sin base. Debería pasar
   por la habilidad `vercel:marketplace`, y para eso hace falta autorizar el servidor MCP de
   Vercel desde una sesión interactiva.
2. **`DOMINIO_ESPERADO` en Vercel.** Sin esa variable el portero rechaza **toda** petición que
   modifica. Es la primera variable de entorno que este proyecto necesita en el despliegue.
3. **Protección de rama en `main`** con `verificar` requerido. Deja de ser contabilidad: ahora
   hay endpoints.
4. **La deuda de `SECCIONES`**: unificar las cuatro copias de las claves de pantalla, con el
   riesgo de `npm run paridad` nombrado arriba.
5. **`OPTIONS` sin exportar** responde 204 con `Allow: …` a cualquiera, sin sesión. Enumera la
   superficie del API. No es una fuga de datos y ningún documento lo prohíbe, pero es una
   respuesta que no pasa por el portero y **ninguna prueba de análisis estático la puede
   detectar**.
