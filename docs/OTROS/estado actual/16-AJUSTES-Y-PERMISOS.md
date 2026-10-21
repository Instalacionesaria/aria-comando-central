# Ajustes y permisos
> Corte: **2026-10-18**, con el código de producción, `972972e` (migraciones hasta la `078`). Las cifras de producción
> son de dos fechas y cada una lo dice: las del **2026-10-18**, re-medidas para esta foto entre las 15:41 y las 15:50
> UTC con `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados, con el OK del usuario): de la base no
> salió un nombre, un correo, un id ni el valor de una credencial; y las del **2026-09-28**, de la foto anterior, que
> se conservan para comparar o porque no se volvieron a medir, y lo dicen. Ajustes no se miró en el navegador para
> esta foto. En local hay ocho commits más, `693a383..dc84cb2`, del modelo de datos multiempresa (Fase 0, migraciones
> `079` a `084`): construidos y **sin subir**, esperando la aprobación de un ingeniero; lo que agregan a identidad
> está en el § 9. Cada afirmación lleva su `archivo:línea` o la consulta que la produjo. Lo que no se pudo verificar
> está dicho como pendiente, no omitido. Para ubicar cualquier cosa nombrada acá, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior se lee con
> `git show 972972e:"docs/OTROS/estado actual/16-AJUSTES-Y-PERMISOS.md"`.

> **Desde el corte del 2026-09-28**
>
> - **2026-09-29 · `ecfbc26`** — CR-3: el token de Meta y la cuenta publicitaria (`act_…`) en Ajustes ›
>   Credenciales; las dos columnas son de la `064`, aplicada el 2026-09-30 (§ 5).
> - **2026-10-01 · `46c5556`** — el Panel de Incidentes: la sección `incidentes`, sólo desde la principal, y dos
>   capacidades, `incidentes.ver` e `incidentes.revisar`, que sólo tiene el superadministrador (`067`).
> - **2026-10-01 a 2026-10-02 · `4742d74` a `6b35169`** — la nueva estructura: Ajustes, Monitoreo e Incidentes van en
>   el engranaje del pie (E10), y **Ajustes › Usuarios ofrece las pestañas agrupadas por departamento**, con lo que
>   abre cada casilla (E12, `1b1799e`; § 3.3).
> - **2026-10-04 · `ce8ff6e`** — AG5: la capacidad `cerebro.usar`, para preguntarle al cerebro. Los tres roles.
> - **2026-10-05 · `5f15c01`** — AG7: **los topes del cerebro** en Ajustes › Credenciales (§ 5).
> - **2026-10-05 · `895a3b8`** — AG9: `senales.resolver` (los tres roles), `senales.validar` y `umbrales.firmar`
>   (administrador y superadministrador).
> - **2026-10-08 · `82ba9e7`** — Client OS: una sección sólo de la principal que no se recorta por pestañas
>   (`sinAlcance`), con la bandera `sinOperacionesTodavia`.
> - **2026-10-15 · `cce2d56`** — Meta M-1: **«Probar conexión»** debajo de las credenciales (§ 5).
> - **2026-10-16 · `693a383..dc84cb2`, construido en local, sin subir** — la Fase 0 del modelo de datos: las cuentas
>   (subcuentas) en identidad y tres roles nuevos sin login (§ 9).
> - **2026-10-18** — esta foto: las cifras re-medidas.

**Construido — la pantalla desde la Etapa 11; el modelo desde la Etapa 3.**

Ajustes es una entrada del engranaje del pie de la barra con tres pestañas —Credenciales, Empresas y Usuarios— y cada
una se decide por capacidad, nunca por nombre de rol. Detrás hay un modelo de cuatro ejes que se combinan en un solo
lugar, el portero: **38 capacidades** (eran 32), **3 roles** del sistema, un **alcance por persona** que recorta
pestañas sin tocar capacidades y una **bandera de organización principal** para las pantallas que miran a todas las
empresas, que ahora son dos: Monitoreo e Incidentes. Medido el 2026-10-18: **13 organizaciones** (11 activas, **9 de
ellas en `UTC`**, la zona por omisión), **15 personas** —9 administradores, 2 superadministradores, 4 de rol
restringido—, **31 concesiones de pestaña efectivas** y ninguna de Analizadores, **5 filas de credenciales** con
llave de IA en las cinco, token del CRM en una sola y **token de Meta en ninguna**, y **0 segundos factores**. Ninguna
de estas cifras cambió desde el 2026-09-28 salvo las capacidades: nadie cargó una credencial, creó una persona ni
concedió una pestaña en el tramo.

---

## 1 · Qué pide el documento

**El documento funcional no se revisó para este archivo.** `AIOS_Arquitectura_Funcional_v0.2.md` vive fuera del
repositorio, en las descargas del usuario (`docs/leads-portal/00-MAPA.md:58-59`), y no se verificó qué dice de roles
o de ajustes. Lo que el código implementa sale de tres fuentes que sí están escritas:

- **La especificación de la capa base**, del repositorio hermano. El código la cita por número de documento y sección
  (`03` § 5 es el portero, `09` § 5 los estados de sesión, `06` § 6 las credenciales) y su matriz generada está en
  `docs/OTROS/especificacion/TRAZABILIDAD.md:70-75` (ADR-0301 a 0306), `:100-107` (la administración) y `:113-116`
  (los secretos).
- **Decisiones del usuario, citadas literales en los comentarios.** Tres roles con la diferencia en las credenciales
  (`db/arranque/001_catalogo.sql:382-383`); que los administradores creen personas «solo para su empresa»
  (`db/arranque/001_catalogo.sql:442-443`); Credenciales para los administradores y Empresas y Usuarios para el
  superadministrador desde la principal (`components/views/AjustesView.jsx:8-10`); Monitoreo como «el rol de usuario
  con acceso a monitoreo» (`db/arranque/001_catalogo.sql:285-286`); el Panel de Incidentes sólo para los
  superadministradores (`db/arranque/001_catalogo.sql:129-131`); y el segundo factor opcional «a pedido explícito»
  (`db/migraciones/010_segundo_factor_opcional.sql:1-8`).
- **El plan de los agentes de IA** (`docs/OTROS/agentes/05-PERMISOS-Y-PRIVACIDAD.md`): `cerebro.usar` para los tres
  roles y la validación ejecutiva de las señales sólo para el Admin (`db/arranque/001_catalogo.sql:245-254`).

Dos de esas decisiones se aplicaron con una desviación declarada: Usuarios **no** se esconde fuera de la principal,
porque editar y desactivar operan sobre la organización activa de la sesión (`components/views/AjustesView.jsx:30-33`),
y la regla de la principal de Empresas es sólo de interfaz, porque en el servidor dejaba a alguien conmutado sin
pestaña y sin conmutador (`components/ajustes/Empresas.jsx:6-19`).

---

## 2 · Qué hay hoy en pantalla

**La entrada.** La sección `credenciales`, rotulada «Ajustes», tiene `menu` en el grupo `Pie`
(`lib/autorizacion/secciones.ts:228-231`). La vista es `components/views/AjustesView.jsx` y se monta sólo bajo la
clave `credenciales` (`components/CommandCenter.jsx:54`). Desde la nueva estructura (E10, 2026-10-02) Ajustes, el Panel
de Monitoreo e Incidentes van en el engranaje del pie de la barra lateral, que muestra todas las que la persona vea
(`docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`, `NE-14`); antes el pie dibujaba sólo la primera
(`components/Nav.jsx:128@b532a78`). En la segunda edición, el mismo día, las tres pantallas llevan la cabecera con la
ceja «MENÚ DE LA CUENTA» y el menú dice debajo de cada destino «TOKENS E INTEGRACIONES» o «SOLO {la organización
principal}» (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`, `NE-49`). Quien llega desde el «Ir a Ajustes» del
cerebro cae en Credenciales (`components/views/AjustesView.jsx:110`).

**Las tres pestañas** (`components/views/AjustesView.jsx:83-86`), cada una visible si la sesión trae su sección, que
el servidor ya filtró con la misma función que decide el menú (`components/views/AjustesView.jsx:66-68`):

| Pestaña | Sección · capacidad | Qué hace | Rutas |
|---|---|---|---|
| Credenciales | `credenciales` · `credenciales.ver` | Carga por campo los secretos y los identificadores de la empresa; muestra el estado y los últimos cuatro caracteres, nunca el valor. Debajo, «Probar conexión» con Meta y los topes del cerebro | `app/api/admin/credenciales/route.ts:128`, `:136`, `:284`; `app/api/admin/credenciales/meta/route.ts:22`; `app/api/admin/cerebro/route.ts:25`, `:44` |
| Empresas | `empresas` · `organizaciones.listar` | Alta, edición (nombre, zona horaria, activa) y baja de organizaciones; un alta no crea personas ni credenciales (`components/ajustes/Empresas.jsx:24-28`) | `app/api/admin/organizaciones/route.ts:80`, `:129`; `app/api/admin/organizaciones/[id]/route.ts:71`, `:197` |
| Usuarios | `usuarios` · `usuarios.ver` | Alta con selector de empresa, rol, pestañas concedidas por departamento, contraseña temporal, desactivar, reactivar y borrar | `app/api/usuarios/route.ts:51`, `app/api/admin/roles/route.ts:45` y las seis de `app/api/admin/usuarios/`, que declaran `SIN_SECCION` |

La configuración de comisiones fue una cuarta pestaña y se mudó a Closer → Inicio sin cambiar su autorización: sigue
declarando `PANTALLA = 'credenciales'` (`components/views/AjustesView.jsx:89-105`, `app/api/admin/comisiones/route.ts:45`).
Lo mismo quién es el closer, la lista de usuarios del CRM para elegirlo, el tramo del setter y los enlaces rápidos:
`app/api/admin/closer/route.ts:59`, `app/api/admin/closer/usuarios-crm/route.ts:33`, `app/api/admin/setter/route.ts:51`,
`app/api/admin/enlaces-rapidos/route.ts:44`. Con la de credenciales, la de Meta y la de los topes, la sección
`credenciales` tiene **ocho** rutas (eran seis; medido sobre el árbol del 2026-10-18).

**Quién ve Ajustes, medido el 2026-10-18.** Las 11 personas con rol de administrador o de superadministrador; ninguna
de las 4 de rol `usuario`, a las que el reparto les niega `credenciales.%` entero para no mostrarles un panel que no
pueden tocar (`db/arranque/001_catalogo.sql:394-397`). Los superadministradores ven las tres pestañas; los
administradores, Credenciales y Usuarios.

**Una dependencia latente.** Usuarios y Empresas cuelgan de la vista que monta la sección `credenciales`. Un rol con
`usuarios.ver` y sin `credenciales.ver` tendría la capacidad y ningún camino en pantalla. Hoy no muerde: los dos roles
que llevan `usuarios.ver` llevan también `credenciales.ver` (consulta sobre `identidad.roles_permisos`, 2026-09-28; el
reparto no cambió en esas familias).

---

## 3 · El modelo de permisos

### 3.1 · El catálogo: 38 capacidades, en dos lugares que tienen que coincidir

La tabla es `identidad.permisos`; la copia en código es `CAPACIDADES` (`lib/autorizacion/capacidades.ts:33-201`), que
existe para que el portero se llame con una clave que el compilador conoce: una errata no falla como errata, rechaza a
todo el mundo con 403 (`lib/autorizacion/capacidades.ts:12-16`). Medido el 2026-10-18: **38 claves en la tabla y 38
en el código, las mismas** (comparadas como lista ordenada).

Las capacidades **no se cargan por migración**. `identidad.permisos` tiene RLS forzada sin política para el migrador,
así que un `insert` desde una migración escribe cero filas (`db/arranque/001_catalogo.sql:4-11`). Las carga
`db/arranque/001_catalogo.sql:75-256` con la credencial de nivel clúster, y en producción eso es un paso a mano
(`scripts/db.mjs:273-278`). Las seis nuevas llegaron así: las de Incidentes con su etapa, `cerebro.usar` con el hito
H2 y las de señales con el H3 (`docs/OTROS/agentes/08-LAS-ETAPAS.md`).

Por familia:

- **Identidad y administración** (15): `organizaciones.*` (4), `usuarios.*` (5), `roles.asignar`,
  `roles.administrar`, `credenciales.ver`/`.editar`, `configuracion.editar` y `auditoria.ver`. Borrar va aparte de
  desactivar porque uno se deshace y el otro no (`db/arranque/001_catalogo.sql:226-229`).
- **Producto** (17): `fundaciones.*` y `tools.*` separadas para que dar Tools no dé ICP & Oferta
  (`db/arranque/001_catalogo.sql:85-99`); `monitoreo.ver`; `tablero.ver`, `closer.ver` y `setter.ver` —una de lectura
  por pestaña operativa para que un closer no vea la del setter (`db/arranque/001_catalogo.sql:154-180`)—;
  `contactos.ver`, `.avanzar`, `.comentar`, `.resolver` y `conversaciones.responder` para la ficha; `auditor.*`, que
  no reusa `auditoria.ver` (`db/arranque/001_catalogo.sql:207-220`); y `analizadores.*`
  (`db/arranque/001_catalogo.sql:236-244`).
- **Nuevas desde el 2026-10-01** (6): `incidentes.ver` e `incidentes.revisar` (`db/arranque/001_catalogo.sql:127-135`);
  `cerebro.usar`, aparte de `tablero.ver` porque gasta la llave de IA de la empresa; `senales.resolver`,
  `senales.validar` y `umbrales.firmar` (`db/arranque/001_catalogo.sql:245-254`). Las de señales las piden las rutas de
  señales y umbrales de Acquisition, Creative, Conversion y Conversation (doce archivos, por `grep` del 2026-10-18).

El portero pide **alguna** de las capacidades de la lista, no todas (`lib/autorizacion/capacidades.ts:223-235`), y
«ninguna» es un valor con nombre, `NINGUNA`, para que una lista vacía que llegó indefinida no abra la operación
(`lib/autorizacion/capacidades.ts:216`).

### 3.2 · Los roles: tres, y el reparto se DERIVA

`closer` y `setter` se reemplazaron por un único `usuario` cuando nadie los tenía asignados
(`db/arranque/001_catalogo.sql:264-271`), y después se retiró un rol `monitoreo` que se asignaba persona por persona
(`db/arranque/001_catalogo.sql:282-287`); `db/arranque/003_retiro_de_roles.sql` pasa a `usuario` a quien tuviera uno
retirado. El reparto declara el conjunto completo de cada rol —borra lo que sobra e inserta lo que falta— y los tres
se derivan: el superadministrador por «todas» (`db/arranque/001_catalogo.sql:378`), los otros dos por exclusión
(`db/arranque/001_catalogo.sql:420-432` y `db/arranque/001_catalogo.sql:507-515`), así que una capacidad nueva cae
sola en los tres salvo que su familia esté negada. Desde el 2026-10-01 las exclusiones crecieron: `incidentes.%` a
`usuario` y a `administrador`, y `senales.validar` y `umbrales.%` a `usuario`.

| Rol | Regla | Capacidades · 2026-10-18 | Personas · 2026-10-18 |
|---|---|---|---|
| `superadministrador` | todas | **38** (32 el 2026-09-28) | **2**, las dos en la principal |
| `administrador` | todas menos `organizaciones.%`, `monitoreo.%`, `incidentes.%`, `usuarios.borrar`, `roles.administrar` | **29** (25) | **9** |
| `usuario` | todas menos `organizaciones.%`, `usuarios.%`, `roles.%`, `credenciales.%`, `incidentes.%`, `senales.validar`, `umbrales.%` | **21** (19) | **4** (2 en la principal) |

Consulta: `identidad.roles` con `count(*)` de `roles_permisos` y de `usuarios_roles` por rol. El 2026-09-28 también
se midieron cero roles propios de una organización, cero personas sin rol y cero con más de uno; no se volvió a medir.

**Qué hace distinto a cada uno, además de la lista.** `superadministrador` es el único con `solo_principal`, que un
disparador de la base ata a la organización principal (`lib/autorizacion/secciones.ts:805-808`), y es el único que
puede conmutar la sesión a otra empresa (`lib/autorizacion/sesion.ts:320-321`). `administrador` administra las
personas **de su empresa** desde el 2026-09-08 (`6cae3eb`): el servidor filtra por organización y
`lib/autorizacion/delegacion.ts` le impide fabricar otro administrador (`db/arranque/001_catalogo.sql:451-463`).
`usuario` es el único con `secciones_restringidas` (`db/arranque/001_catalogo.sql:328-330`).

**La regla de delegación.** Un rol que confiere alguna capacidad de escritura sobre personas
(`lib/autorizacion/delegacion.ts:68-75`) sólo lo otorga quien tiene `organizaciones.listar`: el superadministrador
otorga los tres roles, el administrador sólo `usuario` (`lib/autorizacion/delegacion.ts:21-27`).

### 3.3 · El alcance por sección: un recorte, nunca una concesión

`identidad.usuarios_secciones` (migración 017, `db/migraciones/017_alcance_de_secciones.sql:64`) guarda qué pestañas se
le concedieron a cada persona. Parece violar la regla de la 003 —«solo suma, nunca resta»
(`db/migraciones/003_roles_y_permisos.sql:114-118`)— y el código dice por qué no: no toca ninguna capacidad, es una
intersección, y es la única forma de separar las pantallas que comparten `tablero.ver`
(`lib/autorizacion/secciones.ts:725-752`).

- **Qué decide si se aplica** es una bandera del rol, no la presencia de filas: rol no restringido, las filas se
  ignoran; rol restringido, sólo las concedidas, y **cero filas son cero pestañas** (`lib/autorizacion/secciones.ts:758-773`).
  Con dos roles basta uno no restringido para no estar restringido: `bool_and` (`lib/autorizacion/sesion.ts:274`).
- **El `check` de la base** acepta las 17 claves concedibles; la `067` sumó `incidentes`
  (`db/migraciones/067_los_incidentes.sql:61-70`). En producción, el 2026-10-18, la restricción tiene esas 17 claves.
  `clientos` no está y no hace falta: es `sinAlcance`, no se concede ni se recorta
  (`lib/autorizacion/secciones.ts:718-723`).
- **La pantalla que lo concede** es la de Usuarios. Las casillas salen de `alcanceOfrecible`, que deriva de
  `SECCIONES` y ofrece sólo lo que la capacidad del rol habilita (`lib/autorizacion/secciones.ts:700-716`); para una
  empresa que no es la principal no ofrece Monitoreo (`lib/autorizacion/secciones.ts:449-451`). **Desde E12
  (2026-10-02)** las agrupa por departamento con `alcancePorDepartamento` (`lib/autorizacion/departamentos.ts:330`,
  llamado en `app/api/admin/roles/route.ts:119`), sin una sección de más ni de menos, y cada casilla que abre más de
  una entrada —o una que la barra llama de otra forma— lo dice debajo con «abre …» (`components/ajustes/Usuarios.jsx:77-81`,
  `lib/autorizacion/departamentos.ts:375`).

### 3.4 · El cuarto eje: la organización principal

`soloDesdeLaPrincipal` lo llevan Monitoreo, Incidentes y Client OS (`lib/autorizacion/secciones.ts:462`,
`lib/autorizacion/secciones.ts:472` y `lib/autorizacion/secciones.ts:495`): las dos primeras miran a todas las empresas
y ningún rol global sabe de qué empresa es quien lo tiene (`lib/autorizacion/secciones.ts:96-110`). Se pregunta sobre
la organización **propia**, no sobre la que se está mirando (`lib/autorizacion/secciones.ts:808-813`), y la vuelve a
preguntar la ruta (`app/api/monitoreo/route.ts:125`). Medido el 2026-10-18: la única fila de alcance con `monitoreo`
sigue siendo de una persona de la principal, y ninguna fila tiene `incidentes`.

### 3.5 · El portero: el origen y seis pasos, en orden fijo

`exigir(peticion, capacidades, pantalla)` devuelve el contexto o la respuesta de rechazo
(`lib/autorizacion/portero.ts:168-327`). Olvidarse de la línea de salida no compila (`lib/autorizacion/portero.ts:26-32`).
Antes de todo, llamarlo con una de las rutas sin sesión lanza, porque ésas van por `sesionOpcional`
(`lib/autorizacion/portero.ts:175-180`). Después, con la numeración del código:

- **Origen**, antes de tocar la base, para todo lo que modifica (`lib/autorizacion/portero.ts:183-185`).
1. **Sesión**; «no pude preguntar» es 503, no 401 (`lib/autorizacion/portero.ts:187-196`).
2. **Estado de la sesión** contra la lista blanca de rutas por estado (`lib/autorizacion/portero.ts:198-210`,
   `lib/autorizacion/estados.ts:61-72`).
3. **Organización activa** (`lib/autorizacion/portero.ts:212-215`).
4. **`NINGUNA` sale acá** con el contexto: ni capacidad ni sección (`lib/autorizacion/portero.ts:245-246`).
5. **Capacidad**, con la auditoría `permiso_denegado` y la capacidad en el detalle (`lib/autorizacion/portero.ts:248-275`).
6. **Sección**, después de la capacidad y nunca en su lugar, con su propia acción `seccion_denegada`
   (`lib/autorizacion/portero.ts:277-324`).

No hay atajo para el rol de plataforma: el superadministrador pasa porque tiene las 38 cargadas en la tabla
(`lib/autorizacion/portero.ts:159-166`). `proxy.ts`, en la raíz, sólo redirige a `/entrar` a quien no trae la cookie de
sesión; no decide ningún permiso.

**Qué rutas llaman al portero, medido sobre el árbol del 2026-10-18.** De **111** archivos `route.ts` bajo `app/api/`
(82 el 2026-09-28), **82** declaran `PANTALLA` y **29** están en `SIN_PANTALLA` (`lib/autorizacion/secciones.ts:522-656`):
son exactamente, archivo por archivo, los que no la declaran (comparadas las dos listas con `diff`). No llaman a
`exigir(` ni a `sesionOpcional(` en código —sin contar comentarios— **cinco**, las mismas: `salud` y `login`, que son
las públicas (`pruebas/apoyo/autorizados.ts:761-769`), y la sonda, el cron y el aviso del CRM, que van con secreto
propio (`pruebas/apoyo/autorizados.ts:911-955`).

**Rechazos registrados.** En toda la historia de `identidad.auditoria_accesos`, 3 `permiso_denegado` y 0
`seccion_denegada`; **ninguno** desde el 2026-09-28 (consulta del 2026-10-18 agrupada por `accion`).

### 3.6 · Qué sección pide qué capacidad

Medido sobre el árbol del 2026-10-18 (`lib/autorizacion/secciones.ts:185-499`; «rutas» son los archivos que declaran
`export const PANTALLA` con esa clave) y contra producción el mismo día («concedidas» son las filas de
`identidad.usuarios_secciones` de las cuatro personas de rol `usuario`, las únicas para las que cuentan). Los nombres
son los de `SECCIONES`; en la barra, cada una cuelga de su departamento.

| Sección | Nombre | Capacidad | Rutas | La habilita el rol | Concedidas |
|---|---|---|---|---|---|
| `usuarios` | pestaña de Ajustes | `usuarios.ver` | 2 | super · admin | — |
| `empresas` | pestaña de Ajustes | `organizaciones.listar` | 1 | super | — |
| `credenciales` | Ajustes | `credenciales.ver` | 8 | super · admin | — |
| `executive` | Inicio | `tablero.ver` | 2 | los tres | 3 |
| `contacts` | Leads Portal | `tablero.ver` | 3 | los tres | 3 |
| `icp` | ICP & Oferta | `fundaciones.ver` | 8 | los tres | 3 |
| `acquisition` | Acquisition | `tablero.ver` | 5 | los tres | 2 |
| `creative` | Creative Insights | `tablero.ver` | 5 | los tres | 2 |
| `conversion` | Conversion | `tablero.ver` | 4 | los tres | 2 |
| `conversation` | Conversation | `auditor.ver` | 5 | los tres | 3 |
| `sales` | Closing | `tablero.ver` | 2 | los tres | 2 |
| `setter` | Setter | `setter.ver` | 5 | los tres | 3 |
| `closer` | Closer | `closer.ver` | 8 | los tres | 4 |
| `analizadores` | Analizadores | `analizadores.ver` | 8 | los tres | **0** |
| `tools` | Tools | `tools.ver` | 12 | los tres | 3 |
| `monitoreo` | Panel de Monitoreo | `monitoreo.ver` + principal | 2 | super · `usuario` | 1 |
| `incidentes` | Incidentes | `incidentes.ver` + principal | 2 | super | 0 |
| `clientos` | Client OS | `tablero.ver` + principal | 0 (bandera) | los tres | no se concede |

`executive` perdió su bandera el 2026-10-04 con la ruta del cerebro (`lib/autorizacion/secciones.ts:239`); la única que
la lleva hoy es `clientos` (`lib/autorizacion/secciones.ts:494`), y el cable trampa que fija la lista la exige así
(`pruebas/codigo/90-fundaciones.test.ts:1266`). Las tres de administración no se le pueden conceder a nadie de rol
`usuario` porque su rol no las habilita. Monitoreo no la ve ningún administrador: su rol no la tiene, y como no
restringe por sección, dársela sería dársela a todos los administradores (`db/arranque/001_catalogo.sql:487-506`).

---

## 4 · Entrar: contraseña, freno y el segundo factor

**El login** es `app/api/auth/login/route.ts`, fuera del portero pero con verificación de origen
(`pruebas/apoyo/autorizados.ts:763-768`). El freno por cuenta corta a los 5 intentos y bloquea 15 minutos; el de
origen, a los 20 (`lib/autenticacion/freno.ts:37-42`); la contraseña es `scrypt` con N=16384, r=8, p=1
(`lib/datos/hash.ts:17-19`). `ultimo_acceso_el` se sella sólo en un login exitoso (`lib/autenticacion/freno.ts:85-96`).

**El segundo factor es opcional desde la migración 010.** Opcional de activar, no de cumplir: quien tenga un factor
confirmado recibe `pendiente_2fo` en cada login (`lib/autenticacion/estado.ts:111-112`); la rama que obligaba a
configurarlo se quitó a pedido (`lib/autenticacion/estado.ts:117-153`), y con ella la invariante de que el rol de
plataforma lo exige (`db/migraciones/010_segundo_factor_opcional.sql:22-46`). La columna `exige_segundo_factor` queda
como perilla reservada, y la fila del superadministrador sigue en verdadero sin efecto, porque una migración no puede
cambiarla (`db/migraciones/010_segundo_factor_opcional.sql:61-73`).

Medido el 2026-10-18:

- **0 de 15 personas tienen un segundo factor**: `identidad.usuarios_segundo_factor` tiene 0 filas. Las dos cuentas
  que pueden mirar todas las organizaciones entran sólo con contraseña, que es exactamente el riesgo que la 010 dejó
  escrito.
- Desde el 2026-09-28: **24** `login`, **3** `login_fallido` y **11** `organizacion_cambiada` (el superadministrador
  conmutando de empresa); ningún `password_cambiada`. Por `ultimo_acceso_el`, **1 de 15** personas entró en los
  últimos siete días y **2 nunca entraron**, igual que el 2026-09-28.

**Y activarlo no tiene pantalla** (§ 8.3).

---

## 5 · Credenciales por organización

**Una función, sin respaldo al entorno.** `resolverCredenciales` es la única entrada
(`lib/credenciales/resolver.ts:241`), y la decisión está en el encabezado: no hay ninguna variable de entorno de
respaldo, «ni siquiera explícito», porque ese `??` ya costó una fuga entre clientes (`lib/credenciales/resolver.ts:6-36`).
El origen es siempre `'organizacion'` (`lib/credenciales/resolver.ts:128`). En `lib/credenciales/` la única lectura de
`process.env` es la clave maestra (`lib/credenciales/cifrado.ts:35-36`).

**Cuatro estados, no dos:** `ausente`, `activa`, `vencida`, `revocada`, cada uno con su texto
(`lib/credenciales/resolver.ts:94-99`). Una empresa sin fila es `ausente`, que es el caso más común.

**Qué se guarda.** **Seis** secretos —token y refresco del CRM, llave de IA, clave de pagos, llave de tl;dv y, desde
el 2026-09-29, **token de Meta**— que se cifran con AES-256-GCM al guardar y nunca salen
(`app/api/admin/credenciales/route.ts:90-97`, `lib/credenciales/cifrado.ts:62`); **seis** identificadores que no son
secretos y viajan completos —la cuenta publicitaria de Meta, y cuenta, calendario, dominio de reservas y usuario del
agente en el CRM, y comercio de pagos— (`app/api/admin/credenciales/route.ts:99-122`); y el secreto del aviso del CRM,
que no se carga sino que se genera con el `POST` (`app/api/admin/credenciales/route.ts:330`), se guarda como hash,
sale una sola vez al generarse, y del que el `GET` sólo dice si existe (`lib/credenciales/resolver.ts:316`). Cada campo
se guarda solo y un `null` explícito lo borra (`app/api/admin/credenciales/route.ts:173`). Las dos columnas de Meta son
de la `064` (`db/migraciones/064_la_llave_de_meta.sql:28` y `:31`), aplicada el 2026-09-30 a las 16:15 UTC.

**Meta, y «Probar conexión» (2026-10-15).** El token es el de un usuario del sistema del Business Manager, sólo de
lectura (`components/ajustes/Credenciales.jsx:118-129`). Cargarlo no dice si sirve, así que debajo de las credenciales
hay un botón que lo prueba en tres pasos —el token, la cuenta publicitaria y la lectura de los anuncios— sin escribir
nada (`components/ajustes/ConexionConMeta.jsx:3-10`, `lib/meta/conexion.ts:37`). La ruta es un `POST` aunque no
escribe, pide `credenciales.editar` y llama a Meta fuera de la transacción de identidad
(`app/api/admin/credenciales/meta/route.ts:1-9`, `app/api/admin/credenciales/meta/route.ts:22-31`). Sin token o sin
cuenta responde qué falta, con los textos de `TEXTO_DE_FALTA_META` (`lib/credenciales/resolver.ts:718-727`). Lo usa la
tarea horaria `activos` (ver [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 2) y su guía es
`docs/creative/17-CONECTAR-META-PASO-A-PASO.md`. **Nadie lo cargó**: el 2026-10-18, 0 de 5 filas tienen token de Meta
y 0 tienen la cuenta, y la tarea `activos` está `saltada` en las 11 empresas activas.

**Los topes del cerebro (2026-10-05).** Debajo de Credenciales, cuántas preguntas por día admite el cerebro, por
persona y por empresa, y lo usado hoy (`components/ajustes/TopesDelCerebro.jsx:3-8`, montado en
`components/views/AjustesView.jsx:168`). La ruta pide `credenciales.ver` para leer y `credenciales.editar` para
fijarlos; los dos topes van siempre juntos, entre 1 y 5 000, y el de una persona no puede pasar al de la empresa
(`app/api/admin/cerebro/route.ts:20-22`, `app/api/admin/cerebro/route.ts:54-57`). Por omisión, 50 y 300
(`lib/agentes/executive/topes.ts:33`). El «día» es el de la zona de la empresa (`app/api/admin/cerebro/route.ts:30`).
Medido el 2026-10-18: `negocio.topes_del_executive` tiene **1 fila**, con 50 y 300: los valores por omisión.

**La zona horaria de las empresas.** Se elige al dar de alta o en Editar de Ajustes › Empresas
(`app/api/admin/organizaciones/[id]/route.ts:114-115`), y la lista marca «Sin zona horaria» a toda empresa en `UTC`,
el valor por omisión de la columna (`components/ajustes/Empresas.jsx:332-344`). Desde los agentes pesa más: el día de
los topes, el de la pasada de los detectores, que corre a cada empresa después de las 6:00 de su zona
(`lib/negocio/barrido.ts:357-366`), y el de la Reunión. Medido el 2026-10-18: de las 11 activas, **9 en `UTC`**, 1 en
`America/Lima` y 1 en `America/Santo_Domingo`; las 2 inactivas, en `UTC`. Desde el 2026-09-28 no hubo ningún
`organizacion_editada`. Las 9 en `UTC` no tienen datos de negocio; el plan para llevar las ventanas al día de la
empresa está diagnosticado y dejado para después (`docs/OTROS/futuro/el-dia-de-la-empresa.md`).

**Quién firma el cambio.** `actualizado_por` tiene una foránea compuesta que exige un usuario de la misma
organización, así que bajo delegación va nulo (`lib/autorizacion/sesion.ts:453-454`,
`app/api/admin/credenciales/route.ts:259`); el actor real queda en `identidad.auditoria_accesos` como
`credenciales_cargadas` (`app/api/admin/credenciales/route.ts:287`). Los topes del cerebro siguen la misma regla
(`app/api/admin/cerebro/route.ts:59`).

**Cargadas por proveedor** (`count(*) filter (where … is not null)` sobre `identidad.organizaciones_credenciales`):

| Qué | 2026-09-28 | 2026-10-18 |
|---|---|---|
| Organizaciones | 13 (11 activas) | **13** (11 activas) |
| Con fila de credenciales | 5 (las 5 activas) | **5** |
| Llave de IA (Anthropic) | 5 | **5** |
| Token del CRM | 1, la principal | **1** |
| Refresco del CRM | 0 | **0** |
| Llave de tl;dv | 1, la principal | **1** |
| Token y cuenta de Meta | no existían | **0** y **0** |
| Clave o comercio de pagos | 0 y 0 | **0** y **0** |
| Secreto del aviso del CRM | 1 | **1** |
| `auditor_activo` en verdadero | 5 de 5 | **5 de 5** |
| Filas tocadas desde el 2026-09-28 | — | **0** |

O sea que **una sola organización puede operar contra el CRM**, la principal, y las otras cuatro con fila tienen la
llave de IA y nada más; ocho no tienen fila. Desde el 2026-09-28 no hay ningún `credenciales_cargadas` en la auditoría.

---

## 6 · Datos que ya tenemos

Todo medido el 2026-10-18 entre las 15:41 y las 15:50 UTC, sólo agregados, salvo lo que dice otra fecha.

**Organizaciones: 13**, 11 activas, igual que el 2026-09-28. El reparto por empresa medido ese día —1 principal con 4
personas, 10 empresas cliente activas (7 con una persona, 2 con dos y 1 sin ninguna) y 2 inactivas sin personas, que
son las de control de la sonda (`lib/deteccion/sonda.ts:70`)— **no se volvió a medir**; desde entonces no hay altas,
bajas ni personas creadas en la auditoría.

**El cron barre las activas, y los sellos lo confirman.** Toma la lista entera y se queda con las activas
(`app/api/cron/route.ts:185`); los sellos sólo se van con su organización (`on delete cascade`,
`db/migraciones/014_tareas_programadas.sql:46`). Medido el 2026-10-18: `negocio.tareas_programadas` tiene **121**
filas, 11 tareas × las **11** activas.

**Las dos altas de septiembre no dejaron `organizacion_creada`.** La ruta la escribe
(`app/api/admin/organizaciones/route.ts:187-194`) y en toda la historia hay 2, las dos del 2026-08-25. Existe un camino
de alta que no audita: `scripts/altas-high-ticket.mjs` crea empresa, persona, rol y fila de credenciales y no llama a
ninguna función de auditoría (`grep` de `audit` sin resultados). La ruta audita dentro de la misma transacción del alta
(`conIdentidad`, `lib/datos/capa.ts:126`). **Por qué camino entraron esas dos empresas no está verificado.**

**Personas: 15, las 15 activas**, ninguna creada desde el 2026-09-28 (0 `usuario_creado`); 0 con la contraseña
temporal pendiente; 1 marcada como administrador principal, que un disparador protege de baja, desactivación, cambio
de rol y de correo (`components/ajustes/Usuarios.jsx:34-36`).

**Alcance: 42 filas de 5 personas**, la última concedida el 2026-09-11. 31 son de las 4 de rol `usuario` y 11 de un
administrador, que el portero ignora porque su rol no restringe. Si esa persona pasara a `usuario`, esas 11 volverían a
mandar sin que nadie las elija de nuevo: asignar un rol reemplaza los roles y no toca nada más
(`lib/autorizacion/secciones.ts:760-764`). **Analizadores, Incidentes y las secciones nuevas no están concedidas a nadie
de rol restringido** (§ 3.6).

**RLS forzada: 11 de 11 tablas de `identidad` y 49 de 49 de `negocio`** (eran 29), con `relforcerowsecurity`
(consulta sobre `pg_class`, 2026-10-18). La regla y sus dos accidentes están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 7. **Pendientes de seguridad de la base**: una revisión del
2026-10-12 encontró permisos de producción a corregir, sobre todo fuera de nuestros esquemas; su plan vive fuera del
repositorio a propósito, y el plan de subida de la Fase 0 la pone como condición previa.

---

## 7 · Las reglas, y las pruebas que las vigilan

Las pruebas no se corrieron para este archivo; se leyó lo que afirman.

| Regla | Qué vigila | Dónde |
|---|---|---|
| `ADR-0301` | Todo método de todo manejador llama al portero | `pruebas/codigo/30-portero.test.ts:83` |
| `ADR-0302` | Ninguna comparación con un nombre de rol; sin atajo para la plataforma; toda capacidad usada está en el catálogo | `pruebas/codigo/30-portero.test.ts:193`, `:231`, `:248` |
| `ADR-0303` | Toda sección declara una capacidad del catálogo; ninguna sección con la bandera tiene rutas | `pruebas/codigo/30-portero.test.ts:270`, `:325` |
| `ADR-0304` | El `GET` pide la capacidad de su sección; las operaciones de una pantalla piden el mismo conjunto; lo que modifica no se conforma con una de lectura | `pruebas/codigo/30-portero.test.ts:280`, `:354`, `:465` |
| `ADR-0305` · `ADR-0306` | Un solo cliente HTTP que distingue rechazo de vacío; el origen se verifica en todo lo que modifica | `pruebas/codigo/30-portero.test.ts:546`, `:598`, `:626` |
| Listas sin entradas muertas | Rutas públicas, excepciones de capacidad y `SIN_PANTALLA` | `pruebas/codigo/30-portero.test.ts:648`, `:679`, `:717` |
| El cable trampa literal | `SIN_OPERACIONES_TODAVIA` es exactamente `['clientos']` | `pruebas/codigo/90-fundaciones.test.ts:1266` |
| Closer y Setter separados | Con `closer.ver` a secas se ve sólo Closer, y al revés | `pruebas/codigo/91-closer-y-setter.test.ts:249` |
| El catálogo se carga | Cada capacidad del menú la carga `db/arranque/001_catalogo.sql` | `pruebas/codigo/91-closer-y-setter.test.ts:298`, `pruebas/codigo/90-fundaciones.test.ts:1306` |
| La delegación | Sólo la plataforma otorga roles que administran personas | `pruebas/codigo/144-delegacion-de-roles.test.ts:64` |
| Los tres roles, contra la base | El superadministrador tiene todas las de `CAPACIDADES`; Monitoreo nunca por `administrador`; el administrador administra sólo las personas de su empresa | `pruebas/base/22-los-tres-roles.test.ts:368`, `:299`, `:94` |
| El alcance, contra la base | Los dos ceros; el rechazo es del portero, no cosmético; el anti-encierro; el `check` acepta toda clave de `SECCIONES` | `pruebas/base/31-alcance.test.ts:127`, `:229`, `:287`, `:337` |
| Aislamiento | Con la organización A no se ve una fila de la B; el migrador informa cero filas sin error | `pruebas/base/30-aislamiento.test.ts:114`, `:262` |
| Credenciales | Sin credencial no opera y no cae a la de nadie | `pruebas/base/60-credenciales.test.ts:258` |
| Segundo factor | La invariante del rol de plataforma, retirada; el alta voluntaria por la API | `pruebas/base/41-catalogo-de-autenticacion.test.ts:69`, `pruebas/base/43-segundo-factor.test.ts:214` |
| Los topes y Meta | Los topes del cerebro en Ajustes; la prueba de conexión con Meta | `pruebas/base/218-los-topes-del-cerebro-en-ajustes.test.ts`, `pruebas/codigo/255-la-conexion-con-meta.test.ts` |

`GET_CON_CAPACIDAD_DISTINTA_DE_SU_SECCION` sigue vacía: no hay ninguna excepción viva
(`pruebas/apoyo/autorizados.ts:871-878`).

**Un cruce que el código anuncia y no se encontró.** `lib/autorizacion/capacidades.ts:18-21` y
`db/arranque/001_catalogo.sql:69-72` dicen que una prueba de base cruza el catálogo con la tabla «en las dos
direcciones». La de código → tabla está (`pruebas/base/22-los-tres-roles.test.ts:368-375`), y la de sección → archivo
que la carga (`pruebas/codigo/91-closer-y-setter.test.ts:298`); una que lea `identidad.permisos` y busque filas
ausentes de `CAPACIDADES`, no, con `grep` de `CAPACIDADES` y de `identidad.permisos` sobre `pruebas/` (2026-09-28, no
repetido). La que más se acerca, `pruebas/base/21-permisos-por-rol.test.ts:365-372`, cruza la tabla con el rol de
plataforma. Y `pruebas/codigo/110-monitoreo.test.ts:6-7` se apoya en ese cruce como si existiera. Hoy no muerde: las
dos listas coinciden en producción.

---

## 8 · Riesgos y deuda

### 8.1 · Comentarios que afirman lo contrario del código

- **«El administrador perdió `usuarios.%`».** `components/views/AjustesView.jsx:35-38` y
  `components/ajustes/Usuarios.jsx:13-15` dicen que un administrador no ve Usuarios y recibe 403 en sus rutas. Es falso
  desde `6cae3eb` (2026-09-08): el rol tiene `usuarios.ver`, `.crear`, `.editar`, `.desactivar` y `roles.asignar`,
  como manda `db/arranque/001_catalogo.sql:434-463`.
- **«Siete secciones comparten `tablero.ver`».** `lib/autorizacion/secciones.ts:748-752` cuenta siete, con
  `conversation` entre ellas, que pide `auditor.ver` desde el 2026-09-21 (`lib/autorizacion/secciones.ts:319-338`).
  Entre las que se recortan por pestañas son seis. El comentario de Conversation que la foto anterior señalaba como
  falso ya se corrigió.
- **«Usuarios y credenciales no tienen menú».** `lib/autorizacion/secciones.ts:135-138` y el rótulo «Las dos de
  administración. Sin `menu`» (`lib/autorizacion/secciones.ts:186-187`) encabezan tres secciones, y `credenciales`
  tiene `menu` en `:222`. `components/ajustes/Credenciales.jsx:3` hablaba de «las tres claves y los tres
  identificadores»: en pantalla son cinco claves —desde las de tl;dv y Meta— y seis identificadores
  (`components/ajustes/Credenciales.jsx:40-153`). Ese comentario se **cerró el 2026-10-18 (`65669f4`)**: hoy dice
  «las cinco claves y los seis identificadores». Lo de `secciones.ts` sigue.
- **«Sólo alcanzable desde `debe_configurar_2fo`».** `app/api/auth/2fo/configurar/route.ts:6-8` y `:36-39`. Una
  sesión `activa` sí llega, porque `ESTADOS.activa` es `null` y habilita toda ruta (`lib/autorizacion/estados.ts:71`),
  y es lo que la 010 promete para el alta voluntaria.
- En las pruebas, dos comentarios viejos: «hoy una» excepción (`pruebas/codigo/30-portero.test.ts:290-291`, y la
  lista está vacía) y «diez pantallas… trece capacidades» (`pruebas/codigo/30-portero.test.ts:328-330`).

### 8.2 · Tres capacidades sin puerta

`roles.administrar`, `configuracion.editar` y `auditoria.ver` están en el catálogo y en los roles, y **ninguna ruta las
pide** (`grep` de cada clave sobre `app/`, `lib/` y `components/`, 2026-10-18: sólo comentarios y la lista de
`lib/autorizacion/delegacion.ts:74`). `roles.administrar` está declarada así a propósito y se le niega al
administrador (`db/arranque/001_catalogo.sql:471-474`). Las otras dos no tienen nota: el registro de accesos que
`auditoria.ver` describe no lo muestra ninguna ruta —sus dos lectores son el freno del login y la verificación del
segundo factor, `lib/autenticacion/freno.ts:115` y `app/api/auth/2fo/verificar/route.ts:83`—, y
`configuracion.editar` la esquivó a propósito la ruta de comisiones porque cae en `usuario` por derivación
(`app/api/admin/comisiones/route.ts:6-9`). Las seis nuevas sí tienen puerta.

### 8.3 · El segundo factor: nadie lo tiene, y la pantalla no ofrece activarlo

La API del alta voluntaria existe y tiene prueba (`pruebas/base/43-segundo-factor.test.ts:214`). La interfaz no: la
única llamada a `/api/auth/2fo/configurar` fuera de `app/api/` es `app/entrar/page.tsx:406-407`, en la fase
`configurar_2fo`, a la que sólo se entra desde el estado `debe_configurar_2fo` (`app/entrar/page.tsx:80-93`), que el
login ya no produce (`lib/autenticacion/estado.ts:117`). Resultado medido el 2026-10-18: 0 factores en 15 personas,
dos de ellas con acceso a todas las organizaciones.

Y la matriz generada de la especificación sigue listando `ADR-0412` y `ADR-0413` como innegociables
(`docs/OTROS/especificacion/TRAZABILIDAD.md:92-93`), mientras las pruebas llaman a la primera «RETIRADA»
(`pruebas/base/41-catalogo-de-autenticacion.test.ts:69`).

### 8.4 · Lo demás

- **Agregar una capacidad no es una migración**: hay que correr `db/arranque/001_catalogo.sql` contra producción a
  mano (`scripts/db.mjs:273-278`), y como una migración, antes del push
  ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 8). Olvidarlo deja la pantalla en 403 para todos
  (`lib/autorizacion/capacidades.ts:12-16`). Desde el 2026-10-01 se hizo tres veces (Incidentes, H2 y H3), y el
  2026-10-18 las 38 claves de la tabla y del código coinciden.
- **Meta, listo y sin cargar.** La pantalla, la prueba de conexión y la tarea están en producción desde el 2026-10-15
  y ninguna empresa cargó el token (§ 5). Hasta entonces, Creative toma las miniaturas sólo de GoHighLevel.
- **Nueve de once empresas activas en `UTC`.** Para los topes, la pasada de los detectores y la Reunión, su «día»
  empieza a las 19:00 de Lima (§ 5). No tienen datos de negocio; el día que los tengan, cada cifra diaria va a estar
  corrida si nadie elige la zona antes.
- **Analizadores sin conceder** a ninguna de las cuatro personas de rol restringido. No es un defecto del modelo; es
  una casilla que nadie marcó.
- **Una empresa cliente activa sin personas** (2026-09-28) y seis sin fila de credenciales: existen y no operan, que es
  lo que el alta promete (`components/ajustes/Empresas.jsx:24-28`).
- **Un camino de alta sin auditoría** (§ 6), con dos altas de septiembre sin rastro en `identidad.auditoria_accesos`.
- **No verificado:** el comportamiento en pantalla de Ajustes con sesión iniciada y qué dice el documento funcional
  de roles y ajustes (§ 1).

---

## 9 · Construido en local, sin subir: las cuentas (Fase 0 del modelo de datos)

Los commits `693a383..dc84cb2` (2026-10-16) están en `main` local y **no en producción**: esperan la aprobación de un
ingeniero. Lo que tocan de identidad y permisos, y su orden de subida, en [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md)
§ 11:

- **`identidad.cuentas`**, la subcuenta del CRM dentro de su organización, con `cuentas_credenciales` —las credenciales
  **copiadas**, sin mover las de `organizaciones_credenciales`, que el código sigue leyendo—, `usuarios_cuentas` y
  `acuerdos` (`db/migraciones/080_las_cuentas.sql:41`, `db/migraciones/080_las_cuentas.sql:118`,
  `db/migraciones/080_las_cuentas.sql:150` y `db/migraciones/080_las_cuentas.sql:173`). Las cuentas de las
  organizaciones que ya existen las crea una fase aparte, `cuentas` (`db/arranque/004_las_cuentas_iniciales.sql`).
- **`conOrganizacion` pone `app.cuentas = '*'`** junto a `app.org_id` (`d424d8b`); sin la variable, la política nueva
  de `negocio` no deja ver nada.
- **Tres roles nuevos sin login ni contraseña**: `ingestor`, `app_ingesta` y `app_analista`
  (`db/arranque/000_cluster.sql`). En la Fase 0 ningún servicio se conecta con ellos.
- Ninguna capacidad nueva, ninguna sección nueva y ningún cambio en Ajustes.

---

## 10 · Construido en local, sin subir: el nivel 3 (los clientes de cada empresa)

Encima de la Fase 0 y, como ella, en `main` local y **no en producción**. Commits y orden de subida en
[17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 12. Lo que toca de identidad y permisos:

- **Cinco capacidades nuevas** (`db/arranque/001_catalogo.sql`): `cuentas.ver`, `cuentas.crear` y `cuentas.editar`
  son del administrador de la empresa, no del `usuario`; `cuentas.vincular` —la subcuenta del CRM y la marca de
  prueba— es sólo de la plataforma; y `negocios.ver`, sólo del superadministrador, como Incidentes.
- **Dos secciones nuevas**: `clientes` (Ajustes › Clientes, sin entrada en el menú, como `empresas`) y `negocios`
  (la primera entrada de Client Success, `soloDesdeLaPrincipal`). La `088` las suma al `check` de las pestañas.
- **El cliente final**: una persona limitada a algunos clientes de su empresa (`usuarios.limitado_a_cuentas`, `087`).
  Ve sólo Leads y Sales de esos clientes, con `tablero.ver` y nada más; sin clientes asignados, no ve ninguno. Se da de
  alta en Ajustes › Usuarios con la casilla «Es un cliente final», y su rol sólo puede ser uno restringido por
  pestañas: el alta y el cambio de rol lo rechazan con el mismo motivo, y la base lo exige en cada fila.
- **El foco**: la empresa elige un cliente con el selector junto al de la empresa (`PATCH /api/auth/cliente`), y Leads
  y Sales se filtran a ese cliente; las demás pantallas dicen «Toda la empresa». Cambiar de empresa vacía el foco.
- **La conexión de un cliente** (Bloque C): Ajustes › Clientes › Editar › «Conexión» carga el token y el calendario
  del CRM, el dominio de reservas, el usuario del agente, Meta y el secreto del aviso de un cliente que no es el
  principal (`app/api/admin/cuentas/[id]/conexion/route.ts:28`), con las mismas capacidades que las credenciales de la
  empresa. La del principal es la de la empresa: ahí es 409 (`app/api/admin/cuentas/[id]/conexion/route.ts:69`). La
  subcuenta la vincula ARIA, nunca la del principal ni una que ya sea de una empresa
  (`lib/administracion/cuentas.ts:212`); y Ajustes › Credenciales copia la de la empresa a su principal
  (`app/api/admin/credenciales/route.ts:277`), así que dos empresas no pueden tener la misma y cambiarla libera la
  vieja. Los closers son de la empresa: cualquier ámbito los lee (`db/migraciones/093_los_closers_de_la_empresa.sql`).
- **El puntaje y el Perfil de un cliente** (C6 · D4, `098`): debajo de la Conexión, «Puntaje y Perfil» elige cuál campo
  numérico de su GoHighLevel es el puntaje de sus leads y qué carpetas se muestran en el Perfil y en qué grupo
  (`components/ajustes/CamposDelCliente.jsx:40`). También para el principal: no son credenciales, son el catálogo de su
  subcuenta. Lee con `credenciales.ver` y elige con `credenciales.editar`, con la pantalla `credenciales`; quien sólo ve
  lo ve de sólo lectura (`puedeEditar`), y un cliente de otra empresa o de baja es 404
  (`app/api/admin/cuentas/[id]/campos/route.ts:94`, `app/api/admin/cuentas/[id]/campos/route.ts:104`). Corre como
  inquilino con el foco en ese cliente, sin abrir identidad, y queda auditado.
- **La lista de chequeo de cada cliente** (C6 · D5, `099`): Ajustes › Clientes dice, por cliente, si está
  configurado y, abierta, qué le falta y qué hacer (`components/ajustes/Clientes.jsx:225`, `components/ajustes/ListaDeChequeo.jsx:69`). Es
  la misma lista que la foto y Negocios, con «Meta vinculado en su GoHighLevel» requerido y las miniaturas de Meta
  recomendadas, y llega en vivo con `GET /api/admin/cuentas` (`cuentas.ver`): la ruta lee de identidad la presencia de la
  conexión de cada cliente —sólo `is not null`, con la empresa destino en el `where`— y por eso entró a la lista de la
  escotilla y a la de los dos dominios, sin escribir en identidad (`app/api/admin/cuentas/route.ts:69`,
  `lib/cartera/configuracion.ts:132`). Ningún valor viaja: de cada paso, su clave, su nombre, si es requerido y su estado. En
  Negocios, «Agregar cliente» da de alta en cualquier empresa con `cuentas.crear` y el `orgId`, que sólo la plataforma
  puede mandar (`components/cartera/PanelDeNegocios.jsx:344`).
- **Los closers que no ven a un cliente** (C6 · D1): el alta, la activación y la lista de Ajustes › Clientes dicen
  qué closers están vinculados en otro cliente y no en ése —no ven sus contactos— (`app/api/admin/cuentas/route.ts:139`,
  `components/ajustes/Clientes.jsx:48`), sólo a quien tiene `credenciales.ver` (la capacidad de la pantalla del
  vínculo) y sobre su propia empresa: la plataforma operando sobre otra no recibe los nombres
  (`lib/administracion/cuentas.ts:404`). El alta desde Negocios en la empresa de la sesión los dice con el mismo texto
  (`components/cartera/PanelDeNegocios.jsx:177`).
