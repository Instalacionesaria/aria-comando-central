# Ajustes y permisos
> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **22:02 y las 22:09
> UTC**, con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió un nombre, un correo,
> un id ni el valor de una credencial. Cada afirmación lleva su archivo:línea o la consulta que la
> produjo. Lo que no se pudo verificar está dicho como pendiente, no omitido. Una verificación
> adversarial volvió a medir las cifras de producción a las 22:25 UTC del mismo día: dieron igual.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15**
>
> - **La foto anterior no tenía este archivo.** Los permisos aparecían sólo de costado: la regla de
>   RLS forzada en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 7 y el alcance de las
>   credenciales en [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md). El modelo de permisos es de
>   la capa base —desde la Etapa 3, `433ca86`, 2026-08-21— y no se rediseñó en este tramo.
> - **Lo que sí se movió, en nueve commits.** Cinco banderas `sinOperacionesTodavia` bajadas, cada
>   una con la primera ruta de su pantalla: `be5ba97` Acquisition (09-16), `3287f74` Creative
>   (09-19), `0add4cc` Conversion (09-20), `c109ebd` Sales (09-21) y `3c361a1` Leads Portal (09-26).
>   Queda **una**, `executive` (`lib/autorizacion/secciones.ts:212-218`).
> - **`d8b542e` (09-17):** un superadministrador no podía cargar la credencial de una subcuenta —500
>   por una foránea compuesta— y el mismo defecto estaba en siete escrituras. Entra `autorDelCambio`
>   (`lib/autorizacion/sesion.ts:384-385`), § 5.
> - **`c109ebd` y `8dcb619` (09-21):** un cable nuevo de `ADR-0304` cruza la capacidad de cada `GET`
>   con la de su sección, y encontró la única que no cuadraba: Conversation pasa de `tablero.ver` a
>   `auditor.ver` (`lib/autorizacion/secciones.ts:296-315`).
> - **`05534de` y `35665f2` (09-23):** la sección 16, `analizadores`, con dos capacidades nuevas
>   (`db/arranque/001_catalogo.sql:209-217`), la llave de tl;dv como quinto secreto cifrado por
>   empresa y cuarta llave de la pantalla (migración `057`) y la clave en el `check` del alcance
>   (migración `059`).
> - **Lo que queda abierto:** cuatro comentarios que afirman lo contrario del código, tres
>   capacidades sin ninguna ruta que las pida, y un segundo factor que nadie tiene ni puede activar
>   desde la pantalla (§ 8).

**Construido — la pantalla desde la Etapa 11; el modelo desde la Etapa 3.**

Ajustes es una entrada del pie del menú con tres pestañas —Credenciales, Empresas y Usuarios— y
cada una se decide por capacidad, nunca por nombre de rol. Detrás hay un modelo de cuatro ejes que
se combinan en un solo lugar, el portero: **32 capacidades**, **3 roles** del sistema, un **alcance por
persona** que recorta pestañas sin tocar capacidades y una **bandera de organización principal**
para la única pantalla que mira a todas las empresas. Medido el 2026-09-28: **13 organizaciones**
(eran 15 el 2026-09-15), **15 personas** —9 administradores, 2 superadministradores, 4 de rol
restringido—, **31 concesiones de pestaña efectivas** y ninguna de Analizadores, **5 filas de
credenciales** con llave de IA en las cinco y token del CRM en una sola, y **0 segundos factores**
configurados.

---

## 1 · Qué pide el documento

**El documento funcional no se revisó para este archivo.** `AIOS_Arquitectura_Funcional_v0.2.md` vive
fuera del repositorio, en las descargas del usuario (`docs/leads-portal/00-MAPA.md:58-59`), y no
verifiqué qué dice de roles o de ajustes. Lo que el código implementa sale de dos fuentes que sí
están escritas:

- **La especificación de la capa base**, del repositorio hermano. El código la cita por número de
  documento y sección (`03` § 5 es el portero, `09` § 5 los estados de sesión, `06` § 6 las
  credenciales) y su matriz generada está en `docs/OTROS/especificacion/TRAZABILIDAD.md:70-75`
  (ADR-0301 a 0306), `:100-107` (la administración) y `:113-116` (los secretos).
- **Decisiones del usuario, citadas literales en los comentarios.** Tres roles con la diferencia en
  las credenciales (`db/arranque/001_catalogo.sql:345-346`); que los administradores creen personas
  «solo para su empresa» (`db/arranque/001_catalogo.sql:397-398`); Credenciales para los
  administradores y Empresas y Usuarios para el superadministrador desde la principal
  (`components/views/AjustesView.jsx:8-10`); Monitoreo como «el rol de usuario con acceso a
  monitoreo» (`db/arranque/001_catalogo.sql:247-248`); y el segundo factor opcional «a pedido
  explícito» (`db/migraciones/010_segundo_factor_opcional.sql:1-8`).

Dos de esas decisiones se aplicaron con una desviación declarada: Usuarios **no** se esconde fuera de
la principal, porque editar y desactivar operan sobre la organización activa de la sesión
(`components/views/AjustesView.jsx:30-33`), y la regla de la principal de Empresas es sólo de
interfaz, porque en el servidor dejaba a alguien conmutado sin pestaña y sin conmutador
(`components/ajustes/Empresas.jsx:6-19`).

---

## 2 · Qué hay hoy en pantalla

**La entrada.** La sección `credenciales`, rotulada «Ajustes», es la única del grupo `Pie`
(`lib/autorizacion/secciones.ts:192-209`); el pie junta sus secciones y dibuja sólo la primera
(`components/Nav.jsx:128`, `:215`), así que una segunda ahí no se vería. La vista es
`components/views/AjustesView.jsx` y se monta sólo bajo la clave `credenciales`
(`components/CommandCenter.jsx:49`).

**Las tres pestañas** (`components/views/AjustesView.jsx:80-83`), cada una visible si la sesión trae
su sección, que el servidor ya filtró con la misma función que decide el menú
(`components/views/AjustesView.jsx:63-65`):

| Pestaña | Sección · capacidad | Qué hace | Rutas |
|---|---|---|---|
| Credenciales | `credenciales` · `credenciales.ver` | Carga por campo los secretos y los identificadores de la empresa; muestra el estado y los últimos cuatro caracteres, nunca el valor | `app/api/admin/credenciales/route.ts:123`, `:133`, `:281` |
| Empresas | `empresas` · `organizaciones.listar` | Alta, edición y baja de organizaciones; un alta no crea personas ni credenciales (`components/ajustes/Empresas.jsx:24-28`) | `app/api/admin/organizaciones/route.ts:80`, `:129`; `app/api/admin/organizaciones/[id]/route.ts:71`, `:197` |
| Usuarios | `usuarios` · `usuarios.ver` | Alta con selector de empresa, rol, pestañas concedidas, contraseña temporal, desactivar, reactivar y borrar | `app/api/usuarios/route.ts:51`, `app/api/admin/roles/route.ts:44` y las seis de `app/api/admin/usuarios/`, que declaran `SIN_SECCION` |

La configuración de comisiones fue una cuarta pestaña y se mudó a Closer → Inicio sin cambiar su
autorización: sigue declarando `PANTALLA = 'credenciales'`
(`components/views/AjustesView.jsx:84-100`, `app/api/admin/comisiones/route.ts:45`). Lo mismo quién
es el closer, la lista de usuarios del CRM para elegirlo, el tramo del setter y los enlaces
rápidos: `app/api/admin/closer/route.ts:50`, `app/api/admin/closer/usuarios-crm/route.ts:33`,
`app/api/admin/setter/route.ts:51`, `app/api/admin/enlaces-rapidos/route.ts:44`. Con la de
credenciales, la sección `credenciales` tiene **seis** rutas (medido sobre el árbol del 2026-09-28).

**Quién ve Ajustes, medido el 2026-09-28.** Las 11 personas con rol de administrador o de
superadministrador; ninguna de las 4 de rol `usuario`, a las que el reparto les niega
`credenciales.%` entero para no mostrarles un panel que no pueden tocar
(`db/arranque/001_catalogo.sql:357-360`). Los superadministradores ven las tres pestañas; los
administradores, Credenciales y Usuarios.

**Una dependencia latente.** Usuarios y Empresas cuelgan de la vista que monta la sección
`credenciales`. Un rol con `usuarios.ver` y sin `credenciales.ver` tendría la capacidad y ningún
camino en pantalla. Hoy no muerde: los dos roles que llevan `usuarios.ver` llevan también
`credenciales.ver` (consulta sobre `identidad.roles_permisos`, 2026-09-28).

---

## 3 · El modelo de permisos

### 3.1 · El catálogo: 32 capacidades, en dos lugares que tienen que coincidir

La tabla es `identidad.permisos`; la copia en código es `CAPACIDADES`
(`lib/autorizacion/capacidades.ts:33-171`), que existe para que el portero se llame con una clave que
el compilador conoce: una errata no falla como errata, rechaza a todo el mundo con 403
(`lib/autorizacion/capacidades.ts:12-16`). Medido el 2026-09-28: **32 claves en la tabla y 32 en el
código, las mismas** (comparadas clave por clave).

Las capacidades **no se cargan por migración**. `identidad.permisos` tiene RLS forzada sin política
para el migrador, así que un `insert` desde una migración escribe cero filas
(`db/arranque/001_catalogo.sql:4-11`). Las carga `db/arranque/001_catalogo.sql:75-219` con la
credencial de nivel clúster, y en producción eso es un paso a mano en tres comandos
(`scripts/db.mjs:273-275`). Se corrió después del 2026-09-23: las dos de Analizadores están en la
tabla.

Por familia, con la decisión que separó cada par:

- **Identidad y administración** (15: trece de la migración 003 y los dos `.borrar` de la Etapa
  12): `organizaciones.*` (4), `usuarios.*` (5), `roles.asignar`, `roles.administrar`,
  `credenciales.ver`/`.editar`, `configuracion.editar` y `auditoria.ver`. Borrar va aparte de
  desactivar porque uno se deshace y el otro no (`db/arranque/001_catalogo.sql:195-207`).
- **Producto** (17): `fundaciones.*` y `tools.*` separadas para que dar Tools no dé ICP & Oferta
  (`db/arranque/001_catalogo.sql:85-99`); `monitoreo.ver`; `tablero.ver`, `closer.ver` y
  `setter.ver` —una de lectura por pestaña operativa para que un closer no vea la del setter
  (`db/arranque/001_catalogo.sql:127-153`)—; `contactos.ver`, `.avanzar`, `.comentar`, `.resolver` y
  `conversaciones.responder` para la ficha; `auditor.*`, que no reusa `auditoria.ver`
  (`db/arranque/001_catalogo.sql:180-193`); y `analizadores.*`
  (`db/arranque/001_catalogo.sql:209-217`).

El portero pide **alguna** de las capacidades de la lista, no todas
(`lib/autorizacion/capacidades.ts:205-210`), y «ninguna» es un valor con nombre, `NINGUNA`, para que
una lista vacía que llegó indefinida no abra la operación (`lib/autorizacion/capacidades.ts:186`).

### 3.2 · Los roles: tres, y el reparto se DERIVA

`closer` y `setter` se reemplazaron por un único `usuario` cuando nadie los tenía asignados
(`db/arranque/001_catalogo.sql:227-234`), y después se retiró un rol `monitoreo` que se asignaba
persona por persona (`db/arranque/001_catalogo.sql:245-250`); `db/arranque/003_retiro_de_roles.sql`
pasa a `usuario` a quien tuviera uno retirado. El reparto declara el conjunto completo de cada
rol —borra lo que sobra e inserta lo que falta— y los tres se derivan: el superadministrador por
«todas», los otros dos por exclusión de prefijos, así que una capacidad nueva cae sola en los tres
salvo que su familia esté negada (`db/arranque/001_catalogo.sql:341`, `:383-387`, `:462-466`):

| Rol | Regla | Capacidades · medido el 2026-09-28 | Personas · 2026-09-28 |
|---|---|---|---|
| `superadministrador` | todas | **32** | **2**, las dos en la principal |
| `administrador` | todas menos `organizaciones.%`, `monitoreo.%`, `usuarios.borrar`, `roles.administrar` | **25** | **9** (8 el 2026-09-21, `8dcb619`) |
| `usuario` | todas menos `organizaciones.%`, `usuarios.%`, `roles.%`, `credenciales.%` | **19** | **4** (2 en la principal) |

Consulta: `identidad.roles` con `count(*)` de `roles_permisos` y de `usuarios_roles` por rol. Cero
roles propios de una organización (`org_id is not null`), cero personas sin rol y cero con más de
uno. La foto anterior no contó personas por rol; la cifra más vieja escrita es la de `8dcb619`.

**Qué hace distinto a cada uno, además de la lista.** `superadministrador` es el único con
`solo_principal`, que un disparador de la base ata a la organización principal
(`lib/autorizacion/secciones.ts:739-744`), y es el único que puede conmutar la sesión a otra empresa
(`lib/autorizacion/sesion.ts:292-293`). `administrador` administra las personas **de su empresa**
desde el 2026-09-08 (`6cae3eb`): el servidor filtra por organización y
`lib/autorizacion/delegacion.ts` le impide fabricar otro administrador
(`db/arranque/001_catalogo.sql:406-418`). `usuario` es el único con `secciones_restringidas`
(`db/arranque/001_catalogo.sql:291-293`).

**La regla de delegación.** Un rol que confiere alguna capacidad de escritura sobre personas
(`lib/autorizacion/delegacion.ts:68-75`) sólo lo otorga quien tiene `organizaciones.listar`: el
superadministrador otorga los tres roles, el administrador sólo `usuario`
(`lib/autorizacion/delegacion.ts:21-27`).

### 3.3 · El alcance por sección: un recorte, nunca una concesión

`identidad.usuarios_secciones` (migración 017, `db/migraciones/017_alcance_de_secciones.sql:64`)
guarda qué pestañas se le concedieron a cada persona. Parece violar la regla de la 003 —«solo suma,
nunca resta» (`db/migraciones/003_roles_y_permisos.sql:114-118`)— y el código dice por qué no: no
toca ninguna capacidad, es una intersección, y es la única forma de separar seis pantallas que
comparten `tablero.ver` (`lib/autorizacion/secciones.ts:672-690`).

- **Qué decide si se aplica** es una bandera del rol, no la presencia de filas: rol no restringido,
  las filas se ignoran; rol restringido, sólo las concedidas, y **cero filas son cero pestañas**
  (`lib/autorizacion/secciones.ts:692-707`). Con dos roles basta uno no restringido para no estar
  restringido: `bool_and` (`lib/autorizacion/sesion.ts:246`).
- **El `check` de la base** acepta exactamente las 16 claves de `SECCIONES`
  (`db/migraciones/059_seccion_analizadores.sql:12-19`). En producción, el 2026-09-28, la restricción
  tiene 16 claves, incluye `analizadores` y ya no acepta `auditoria` (consulta sobre
  `pg_constraint`).
- **La pantalla que lo concede** es la de Usuarios, y las casillas salen de `alcanceOfrecible`, que
  deriva de `SECCIONES` y ofrece sólo lo que la capacidad del rol habilita
  (`lib/autorizacion/secciones.ts:638-653`); para una empresa que no es la principal no ofrece
  Monitoreo (`lib/autorizacion/secciones.ts:426-428`).

### 3.4 · El cuarto eje: la organización principal

`soloDesdeLaPrincipal` la lleva sólo Monitoreo (`lib/autorizacion/secciones.ts:436-440`), porque mira
el consumo de todas las empresas y ningún rol global sabe de qué empresa es quien lo tiene
(`lib/autorizacion/secciones.ts:95-109`). Se pregunta sobre la organización **propia**, no sobre la
que se está mirando (`lib/autorizacion/secciones.ts:755-760`), y la vuelve a preguntar la ruta
(`app/api/monitoreo/route.ts:125`). Medido el 2026-09-28: la única fila de alcance con `monitoreo`
es de una persona de la principal, así que la red no está atajando a nadie.

### 3.5 · El portero: el origen y seis pasos, en orden fijo

`exigir(peticion, capacidades, pantalla)` devuelve el contexto o la respuesta de rechazo
(`lib/autorizacion/portero.ts:167-298`). Olvidarse de la línea de salida no compila
(`lib/autorizacion/portero.ts:26-32`). Antes de todo, llamarlo con una de las rutas sin sesión
lanza, porque ésas van por `sesionOpcional` (`lib/autorizacion/portero.ts:174-179`). Después, con
la numeración del código:

- **Origen**, antes de tocar la base, para todo lo que modifica
  (`lib/autorizacion/portero.ts:182-184`).
1. **Sesión**; «no pude preguntar» es 503, no 401 (`lib/autorizacion/portero.ts:186-195`).
2. **Estado de la sesión** contra la lista blanca de rutas por estado
   (`lib/autorizacion/portero.ts:197-209`, `lib/autorizacion/estados.ts:61-72`).
3. **Organización activa** (`lib/autorizacion/portero.ts:211-214`).
4. **`NINGUNA` sale acá** con el contexto: ni capacidad ni sección
   (`lib/autorizacion/portero.ts:216-217`).
5. **Capacidad**, con la auditoría `permiso_denegado` y la capacidad en el detalle
   (`lib/autorizacion/portero.ts:219-246`).
6. **Sección**, después de la capacidad y nunca en su lugar, con su propia acción
   `seccion_denegada` (`lib/autorizacion/portero.ts:248-295`).

No hay atajo para el rol de plataforma: el superadministrador pasa porque tiene las 32 cargadas en la
tabla (`lib/autorizacion/portero.ts:158-165`). `proxy.ts`, en la raíz, sólo redirige a `/entrar` a
quien no trae la cookie de sesión; no decide ningún permiso.

**Qué rutas llaman al portero, medido sobre el árbol del 2026-09-28.** De 82 archivos `route.ts`
bajo `app/api/`, 53 declaran `PANTALLA` y 29 están en `SIN_PANTALLA`
(`lib/autorizacion/secciones.ts:465-594`): son exactamente, archivo por archivo, los que no la
declaran. No llaman a `exigir(` ni a `sesionOpcional(` en código —sin contar comentarios— **cinco**:
`salud` y `login`, que son las públicas (`pruebas/apoyo/autorizados.ts:634-642`), y la sonda, el
cron y el aviso del CRM, que van con secreto propio (`pruebas/apoyo/autorizados.ts:784-827`).

**Rechazos registrados.** Desde el 2026-09-15, **0** `permiso_denegado` y **0** `seccion_denegada` en
`identidad.auditoria_accesos`; en toda la historia, 3 y 0 (consulta del 2026-09-28 agrupada por
`accion`).

### 3.6 · Qué sección pide qué capacidad

Medido sobre el árbol del 2026-09-28 (`lib/autorizacion/secciones.ts:171-442`; «rutas» son los
archivos que declaran `export const PANTALLA` con esa clave) y contra producción el mismo día
(«concedidas» son las filas de `identidad.usuarios_secciones` de las cuatro personas de rol
`usuario`, las únicas para las que cuentan):

| Sección | Rótulo · grupo | Capacidad | Rutas | La habilita el rol | Concedidas |
|---|---|---|---|---|---|
| `usuarios` | pestaña de Ajustes | `usuarios.ver` | 2 | super · admin | — |
| `empresas` | pestaña de Ajustes | `organizaciones.listar` | 1 | super | — |
| `credenciales` | Ajustes · Pie | `credenciales.ver` | 6 | super · admin | — |
| `executive` | Executive · AIOS | `tablero.ver` | 0 (bandera) | los tres | 3 |
| `contacts` | Leads Portal · AIOS | `tablero.ver` | 2 | los tres | 3 |
| `icp` | ICP & Oferta · AIOS | `fundaciones.ver` | 7 | los tres | 3 |
| `acquisition` | Inteligencia | `tablero.ver` | 1 | los tres | 2 |
| `creative` | Inteligencia | `tablero.ver` | 1 | los tres | 2 |
| `conversion` | Inteligencia | `tablero.ver` | 1 | los tres | 2 |
| `conversation` | Inteligencia | `auditor.ver` | 2 | los tres | 3 |
| `sales` | Inteligencia | `tablero.ver` | 1 | los tres | 2 |
| `setter` | Operación | `setter.ver` | 4 | los tres | 3 |
| `closer` | Operación | `closer.ver` | 6 | los tres | 4 |
| `analizadores` | Operación | `analizadores.ver` | 7 | los tres | **0** |
| `tools` | Operación | `tools.ver` | 10 | los tres | 3 |
| `monitoreo` | Panel de Monitoreo · Operación | `monitoreo.ver` + principal | 2 | super · `usuario` | 1 |

Las tres de administración no se le pueden conceder a nadie de rol `usuario` porque su rol no las
habilita. Monitoreo no la ve ningún administrador: su rol no la tiene, y como no restringe por
sección, dársela sería dársela a todos los administradores (`db/arranque/001_catalogo.sql:442-457`).

---

## 4 · Entrar: contraseña, freno y el segundo factor

**El login** es `app/api/auth/login/route.ts`, fuera del portero pero con verificación de origen
(`pruebas/apoyo/autorizados.ts:636-641`). El freno por cuenta corta a los 5 intentos y bloquea 15
minutos; el de origen, a los 20 (`lib/autenticacion/freno.ts:37-42`); la contraseña es `scrypt` con
N=16384, r=8, p=1 (`lib/datos/hash.ts:17-19`). `ultimo_acceso_el` se sella sólo en un login
exitoso (`lib/autenticacion/freno.ts:85-96`).

**El segundo factor es opcional desde la migración 010.** Opcional de activar, no de cumplir: quien
tenga un factor confirmado recibe `pendiente_2fo` en cada login
(`lib/autenticacion/estado.ts:111-112`); la rama que obligaba a configurarlo se quitó a pedido
(`lib/autenticacion/estado.ts:117-153`), y con ella la invariante de que el rol de plataforma lo
exige (`db/migraciones/010_segundo_factor_opcional.sql:22-46`). La columna `exige_segundo_factor`
queda como perilla reservada, y la fila del superadministrador sigue en verdadero sin efecto, porque una
migración no puede cambiarla (`db/migraciones/010_segundo_factor_opcional.sql:61-73`).

Medido el 2026-09-28:

- **0 de 15 personas tienen un segundo factor**: `identidad.usuarios_segundo_factor` tiene 0 filas,
  confirmadas o no. Las dos cuentas que pueden mirar todas las organizaciones entran sólo con
  contraseña, que es exactamente el riesgo que la 010 dejó escrito.
- `exige_segundo_factor` es verdadero en `superadministrador` y falso en los otros dos.
- Desde el 2026-09-15: **29** `login`, **4** `login_fallido`, **31** `organizacion_cambiada` (el
  superadministrador conmutando de empresa) y **2** `password_cambiada`. Por `ultimo_acceso_el`,
  **1 de 15** personas entró en los últimos siete días y **2 nunca entraron**.

**Y activarlo no tiene pantalla** (§ 8.3).

---

## 5 · Credenciales por organización

**Una función, sin respaldo al entorno.** `resolverCredenciales` es la única entrada
(`lib/credenciales/resolver.ts:191`), y la decisión está en el encabezado: no hay ninguna variable de
entorno de respaldo, «ni siquiera explícito», porque ese `??` ya costó una fuga entre clientes
(`lib/credenciales/resolver.ts:6-36`). El origen es siempre `'organizacion'` y el tipo tiene un solo
valor a propósito (`lib/credenciales/resolver.ts:85`). Verificado por `grep` el 2026-09-28: bajo
`lib/`, `app/` y `components/` no hay ninguna lectura de `process.env` de una clave de proveedor; en
`lib/credenciales/` la única es la clave maestra (`lib/credenciales/cifrado.ts:35-36`).

**Cuatro estados, no dos:** `ausente`, `activa`, `vencida`, `revocada`, cada uno con su texto
(`lib/credenciales/resolver.ts:51-56`). Una empresa sin fila es `ausente`, que es el caso más común.

**Qué se guarda.** Cinco secretos —token y refresco del CRM, llave de IA, clave de pagos y llave de
tl;dv— que se cifran con AES-256-GCM al guardar y nunca salen
(`app/api/admin/credenciales/route.ts:88-93`, `lib/credenciales/cifrado.ts:62`); cinco identificadores
que no son secretos y viajan completos —cuenta, calendario, dominio de reservas y usuario del agente
en el CRM, comercio de pagos— (`app/api/admin/credenciales/route.ts:94-116`); y el secreto del aviso
del CRM, que no se carga sino que se genera con el `POST` (`app/api/admin/credenciales/route.ts:281`),
se guarda como hash, sale una sola vez al generarse, y del que el `GET` sólo dice si existe
(`lib/credenciales/resolver.ts:260`). Cada campo se guarda solo y un `null` explícito lo borra
(`app/api/admin/credenciales/route.ts:163-170`).

**Quién firma el cambio.** `actualizado_por` tiene una foránea compuesta que exige un usuario de la
misma organización, así que bajo delegación va nulo (`lib/autorizacion/sesion.ts:384-385`,
`app/api/admin/credenciales/route.ts:226`); el actor real queda en `identidad.auditoria_accesos`
como `credenciales_cargadas` (`app/api/admin/credenciales/route.ts:242`). Es el arreglo de
`d8b542e`, que cubrió siete escrituras de configuración y dejó a propósito sin cubrir la autoría
de contenido (notas, mensajes, resultados, tareas), que sigue fallando bajo delegación.

**Cargadas por proveedor, medido el 2026-09-28** (`count(*) filter (where … is not null)` sobre
`identidad.organizaciones_credenciales`; la columna del 2026-09-15 sale de
[06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) y de la versión de esa fecha de
[04-CONVERSATION.md](04-CONVERSATION.md), no re-medida):

| Qué | 2026-09-15 | 2026-09-28 |
|---|---|---|
| Organizaciones | 15 (12 activas) | **13** (11 activas) |
| Con fila de credenciales | 4 | **5** (las 5 activas) |
| Llave de IA (Anthropic) | 4 | **5** |
| Token del CRM | 1 | **1**, la principal; `crm_estado`: 1 `activa`, 4 `ausente` |
| Refresco del CRM | no medido | **0** |
| Llave de tl;dv | no existía | **1**, la principal |
| Clave o comercio de pagos | no medido | **0** y **0** |
| Cuenta, calendario, dominio y usuario del agente en el CRM | 1 con usuario del agente | **1** cada uno |
| Secreto del aviso del CRM | no medido | **1** |
| `auditor_activo` en verdadero | no medido | **5 de 5** |
| Con `actualizado_por` nulo | no medido | **0 de 5** |

O sea que **una sola organización puede operar contra el CRM**, la principal, y las otras cuatro con
fila tienen la llave de IA y nada más; ocho no tienen fila (seis empresas cliente activas y las dos
de control). Tres de las cinco filas se tocaron
después del 2026-09-15 (`actualizado_el`), y desde entonces hay **6** `credenciales_cargadas` en la
auditoría.

---

## 6 · Datos que ya tenemos

Todo medido el 2026-09-28 entre las 22:02 y las 22:09 UTC, sólo agregados.

**Organizaciones: 13.** 1 principal con 4 personas y fila de credenciales; 10 empresas cliente
activas, de las cuales 7 tienen una persona, 2 tienen dos y 1 ninguna; y 2 inactivas sin personas ni
credenciales, que son las organizaciones de control de la sonda: su clave es una de
`SLUGS_DE_CONTROL` (`lib/deteccion/sonda.ts:70`), y nacieron el 2026-08-23. El 2026-09-15 eran 15 y
12 activas: desde entonces la auditoría tiene **4** `organizacion_borrada` y `creada_el` muestra **2**
altas, el 17 y el 24, las dos empresas cliente activas (una con dos personas y fila de
credenciales, otra con una persona y sin fila).

**El cron barre las activas, y los sellos lo confirman.** Toma la lista entera y se queda con las
activas (`app/api/cron/route.ts:147`, desde `f17a464`, 2026-08-26); los sellos de
`negocio.tareas_programadas` sólo se van con su organización (`on delete cascade`,
`db/migraciones/014_tareas_programadas.sql:46`; ningún `delete` sobre esa tabla en `lib/`, `app/`,
`scripts/` ni `db/`). Medido el 2026-09-28 a las 23:56 UTC: **11** organizaciones con sello, las
11 activas, las 11 con un sello de la última hora, y ninguna inactiva con sello (las dos de control
no tienen ninguno). La versión del 2026-09-15 de [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md)
contó **13** «que el cron barre» con `count(distinct org_id)` sobre esa tabla, el mismo día en que
[04-CONVERSATION.md](04-CONVERSATION.md) medía 12 activas: 13 no caben en 12, así que ese 13 contaba
sellos de por lo menos una organización que ya no estaba activa, no empresas barridas. Cuál era no
se puede reconstruir con lo que queda en la base (no verificado); y las dos cifras son del mismo
día, no se sabe si del mismo instante.

**Las dos altas no dejaron `organizacion_creada`.** La ruta la escribe
(`app/api/admin/organizaciones/route.ts:187-194`) y en toda la historia hay 2, las dos del
2026-08-25. Existe un camino de alta que no audita: `scripts/altas-high-ticket.mjs` crea empresa,
persona, rol y fila de credenciales y no llama a ninguna función de auditoría (`grep` de `audit`
sin resultados). La ruta audita dentro de la misma transacción del alta (`conIdentidad`,
`lib/datos/capa.ts:126`), así que un alta por la pantalla sin su fila no es posible. Lo que sí se
midió (2026-09-28): las 3 personas de esas dos empresas tienen su `usuario_creado`, que el script no
escribe, así que las personas entraron por Usuarios. **Por qué camino entraron las dos empresas no
está verificado**: la ruta queda descartada; el script sólo para la empresa, u otra inserción a mano,
no.

**Personas: 15, las 15 activas**, 4 creadas desde el 2026-09-15 (por `creado_el`, y la auditoría
tiene 4 `usuario_creado` en el mismo tramo). 0 con la contraseña temporal pendiente; 1 marcada como
administrador principal, que un disparador protege de baja, desactivación, cambio de rol y de
correo (`components/ajustes/Usuarios.jsx:34-36`).

**Alcance: 42 filas de 5 personas.** 31 son de las 4 de rol `usuario` —con 1, 7, 11 y 12
pestañas— y 11 de un administrador, que el portero ignora porque su rol no restringe. Si esa
persona pasara a `usuario`, esas 11 volverían a mandar sin que nadie las elija de nuevo: asignar un
rol reemplaza los roles y no toca nada más (`lib/autorizacion/secciones.ts:694-698`). Ninguna fila
es posterior al 2026-09-15 (`concedida_el`).

**Por sección**, las 31 efectivas están en la tabla del § 3.6. La consecuencia más clara:
**Analizadores, que existe desde el 2026-09-23, no está concedida a nadie de rol restringido**; la
ven sólo los 11 administradores y superadministradores. Lo mismo mide
[14-ANALIZADORES.md](14-ANALIZADORES.md).

**RLS forzada: 11 de 11 tablas de `identidad` y 29 de 29 de `negocio`**, con `relforcerowsecurity`
(consulta sobre `pg_class`). Es lo que hace que una migración pueda cambiar la forma y nunca el
contenido, y que el migrador vea cero filas sin error; la regla y sus dos accidentes están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 7.

---

## 7 · Las reglas, y las pruebas que las vigilan

Las pruebas no se corrieron para este archivo (prohibido mientras otros agentes usan la base local);
se leyó lo que afirman.

| Regla | Qué vigila | Dónde |
|---|---|---|
| `ADR-0301` | Todo método de todo manejador llama al portero | `pruebas/codigo/30-portero.test.ts:83` |
| `ADR-0302` | Ninguna comparación con un nombre de rol, ni con los dos retirados; sin atajo para la plataforma; toda capacidad usada está en el catálogo | `pruebas/codigo/30-portero.test.ts:193`, `:231`, `:248` |
| `ADR-0303` | Toda sección declara una capacidad del catálogo; ninguna sección con la bandera tiene rutas | `pruebas/codigo/30-portero.test.ts:270`, `:325` |
| `ADR-0304` | El `GET` pide la capacidad de su sección (desde `c109ebd`); las operaciones de una pantalla piden el mismo conjunto; lo que modifica no se conforma con una de lectura | `pruebas/codigo/30-portero.test.ts:280`, `:350`, `:461` |
| `ADR-0305` · `ADR-0306` | Un solo cliente HTTP que distingue rechazo de vacío; el origen se verifica en todo lo que modifica | `pruebas/codigo/30-portero.test.ts:542`, `:594`, `:622` |
| Listas sin entradas muertas | Rutas públicas, excepciones de capacidad y `SIN_PANTALLA` | `pruebas/codigo/30-portero.test.ts:644`, `:675`, `:713` |
| El cable trampa literal | `SIN_OPERACIONES_TODAVIA` tiene largo **1**: el día que Executive tenga una ruta, `ADR-0303` falla hasta bajarle la bandera, y bajarla rompe este número | `pruebas/codigo/90-fundaciones.test.ts:1191`, `pruebas/codigo/30-portero.test.ts:325` |
| Closer y Setter separados | Con `closer.ver` a secas se ve sólo Closer, y al revés | `pruebas/codigo/90-fundaciones.test.ts:1194` |
| El catálogo se carga | Cada capacidad de sección la carga `db/arranque/001_catalogo.sql` o la 003 | `pruebas/codigo/91-closer-y-setter.test.ts:295`, `pruebas/codigo/90-fundaciones.test.ts:1231` |
| La delegación | Sólo la plataforma otorga roles que administran personas | `pruebas/codigo/144-delegacion-de-roles.test.ts:64` |
| Los tres roles, contra la base | El superadministrador tiene todas las de `CAPACIDADES`; Monitoreo nunca por `administrador`; el administrador administra sólo las personas de su empresa | `pruebas/base/22-los-tres-roles.test.ts:346`, `:283`, `:94` |
| El alcance, contra la base | Los dos ceros; el rechazo es del portero, no cosmético; el anti-encierro; el `check` acepta toda clave de `SECCIONES` | `pruebas/base/31-alcance.test.ts:127`, `:229`, `:287`, `:337` |
| Aislamiento | Con la organización A no se ve una fila de la B; el migrador informa cero filas sin error | `pruebas/base/30-aislamiento.test.ts:114`, `:262` |
| Credenciales | Sin credencial no opera y no cae a la de nadie | `pruebas/base/60-credenciales.test.ts:258` |
| Segundo factor | La invariante del rol de plataforma, retirada; el alta voluntaria por la API | `pruebas/base/41-catalogo-de-autenticacion.test.ts:69`, `pruebas/base/43-segundo-factor.test.ts:214` |

`GET_CON_CAPACIDAD_DISTINTA_DE_SU_SECCION` está vacía desde el 2026-09-21: no hay ninguna excepción
viva (`pruebas/apoyo/autorizados.ts:744-750`).

**Un cruce que el código anuncia y no encontré.** `lib/autorizacion/capacidades.ts:18-21` y
`db/arranque/001_catalogo.sql:69-72` dicen que una prueba de base cruza el catálogo con la tabla «en
las dos direcciones». Encontré la de código → tabla
(`pruebas/base/22-los-tres-roles.test.ts:346-353`) y la de sección → archivo que la carga
(`pruebas/codigo/91-closer-y-setter.test.ts:295`); una que lea `identidad.permisos` y busque filas
ausentes de `CAPACIDADES`, no, con `grep` de `CAPACIDADES` y de `identidad.permisos` sobre
`pruebas/`; la que más se acerca, `pruebas/base/21-permisos-por-rol.test.ts:345`, cruza la tabla con
el rol de plataforma, no con el código. Y `pruebas/codigo/110-monitoreo.test.ts:6-7` se apoya en ese
cruce como si existiera. **No verificado de forma exhaustiva.** Hoy no muerde: las dos listas
coinciden en producción.

---

## 8 · Riesgos y deuda

### 8.1 · Comentarios que afirman lo contrario del código

- **«El administrador perdió `usuarios.%`».** `components/views/AjustesView.jsx:35-38` y
  `components/ajustes/Usuarios.jsx:13-15` dicen que un administrador no ve Usuarios y recibe 403 en
  sus rutas. Es falso desde `6cae3eb` (2026-09-08): en producción el rol tiene `usuarios.ver`,
  `.crear`, `.editar`, `.desactivar` y `roles.asignar` (consulta del 2026-09-28), como manda
  `db/arranque/001_catalogo.sql:389-418`.
- **Conversation «sigue siendo `tablero.ver`».** `lib/autorizacion/secciones.ts:291-293`, veinticuatro
  líneas arriba de `capacidadRequerida: 'auditor.ver'` en `:315`, que es lo cierto desde `8dcb619`. Y
  `lib/autorizacion/secciones.ts:682-686` sigue contando **siete** secciones que comparten
  `tablero.ver`, con `conversation` entre ellas: son seis.
- **«Usuarios y credenciales no tienen menú».** `lib/autorizacion/secciones.ts:124-127` y el rótulo
  «Las dos de administración. Sin `menu`» (`lib/autorizacion/secciones.ts:172-173`) encabezan tres
  secciones, y `credenciales` tiene `menu` en `:208`. `components/ajustes/Credenciales.jsx:3` habla
  de «las tres claves y los tres identificadores»: en pantalla son cuatro claves —desde la de
  tl;dv— y cinco identificadores (`components/ajustes/Credenciales.jsx:39-131`).
- **«Sólo alcanzable desde `debe_configurar_2fo`».** `app/api/auth/2fo/configurar/route.ts:6-8` y
  `:36-39`. Una sesión `activa` sí llega, porque `ESTADOS.activa` es `null` y habilita toda ruta
  (`lib/autorizacion/estados.ts:71`), y es lo que la 010 promete para el alta voluntaria.
- En las pruebas, dos comentarios viejos: «hoy una» excepción
  (`pruebas/codigo/30-portero.test.ts:290-291`, y la lista está vacía) y «diez pantallas… trece
  capacidades» (`pruebas/codigo/30-portero.test.ts:328-330`).

### 8.2 · Tres capacidades sin puerta

`roles.administrar`, `configuracion.editar` y `auditoria.ver` están en el catálogo y en los roles, y
**ninguna ruta las pide** (`grep` de cada clave sobre `app/`, `lib/` y `components/`, 2026-09-28).
`roles.administrar` está declarada así a propósito y se le niega al administrador
(`db/arranque/001_catalogo.sql:426-429`). Las otras dos no tienen nota: el registro de accesos que
`auditoria.ver` describe no lo muestra ninguna ruta —sus dos lectores son el freno del login y la
verificación del segundo factor, `lib/autenticacion/freno.ts:115` y
`app/api/auth/2fo/verificar/route.ts:83`, por `grep` de `auditoria_accesos` sobre `lib/`, `app/` y
`components/`—, y `configuracion.editar` la esquivó a propósito la ruta de
comisiones porque cae en `usuario` por derivación (`app/api/admin/comisiones/route.ts:6-9`).

### 8.3 · El segundo factor: nadie lo tiene, y la pantalla no ofrece activarlo

La API del alta voluntaria existe y tiene prueba (`pruebas/base/43-segundo-factor.test.ts:214`). La
interfaz no: la única llamada a `/api/auth/2fo/configurar` fuera de `app/api/` es
`app/entrar/page.tsx:406-407`, en la fase `configurar_2fo`, a la que sólo se entra desde el estado
`debe_configurar_2fo` (`app/entrar/page.tsx:80-93`), que el login ya no produce
(`lib/autenticacion/estado.ts:117`). No encontré en `components/` ninguna otra entrada. Resultado
medido: 0 factores en 15 personas, dos de ellas con acceso a todas las organizaciones.

Y la matriz generada de la especificación sigue listando `ADR-0412` y `ADR-0413` como innegociables
(`docs/OTROS/especificacion/TRAZABILIDAD.md:92-93`), mientras las pruebas llaman a la primera
«RETIRADA» (`pruebas/base/41-catalogo-de-autenticacion.test.ts:69`). El desajuste es de la
especificación, que vive en el repositorio hermano; acá sólo se ve.

### 8.4 · Lo demás

- **Agregar una capacidad no es una migración**: hay que correr `db/arranque/001_catalogo.sql` contra
  producción a mano (`scripts/db.mjs:273-275`), y como una migración, antes del push
  ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 8). Olvidarlo deja la
  pantalla en 403 para todos (`lib/autorizacion/capacidades.ts:12-16`).
- **Analizadores sin conceder** a ninguna de las cuatro personas de rol restringido (§ 6). No es un
  defecto del modelo; es una casilla que nadie marcó.
- **Una empresa cliente activa sin personas** y seis sin fila de credenciales: existen y no operan,
  que es lo que el alta promete (`components/ajustes/Empresas.jsx:24-28`), pero la lista no se revisó
  para saber si alguna debería borrarse.
- **Un camino de alta sin auditoría** (§ 6), con dos altas del tramo sin rastro en
  `identidad.auditoria_accesos`.
- **No verificado:** el comportamiento en pantalla de Ajustes con sesión iniciada (no se levantó
  ningún servidor) y qué dice el documento funcional de roles y ajustes (§ 1).
