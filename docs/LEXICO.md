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
| `exigir(req, res, roles)` | `exigir(` | `exigir(peticion, capacidades)` | `lib/portero.ts` — **Etapa 3** |
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
