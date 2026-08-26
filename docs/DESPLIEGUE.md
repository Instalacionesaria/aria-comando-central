# Desplegar

Lo que se hizo, en orden, y cómo se comprueba cada paso. **Ya está hecho** contra el proyecto
`SOFIA` (`pajhjpzydkkpmjdofqqp`); queda como registro y como guion para el próximo entorno.

## El entorno real, medido

No supuesto — leído del proyecto por la Management API:

| | |
| --- | --- |
| PostgreSQL | **17.4** (por eso `docker-compose.yml` fija `postgres:17-alpine`) |
| Región | `sa-east-1` |
| Agrupador | `aws-0-sa-east-1.pooler.supabase.com:6543`, modo **transacción** |
| Conexión directa | `db.pajhjpzydkkpmjdofqqp.supabase.co:5432` |
| `public` | 59 tablas, 3 vistas, 14 RPC, ~19.400 filas de cinco sistemas |

## Lo que hace innecesaria la contraseña de Postgres

`SUPABASE_ACCESS_TOKEN` (un token personal, `sbp_…`) llama a
`POST /v1/projects/{ref}/database/query`. Con `read_only: false` **conecta como `postgres` con
permiso de crear roles**. Con eso se crean los tres roles del diseño y sus contraseñas las elige
quien despliega, así que las cadenas de conexión quedan completas sin ir a buscar la contraseña de
la base.

Consecuencia: **`DATABASE_URL_ADMIN` no existe** en este despliegue, y `db.mjs arranque` no se usa
contra Supabase. El arranque va por la API.

Las credenciales de despliegue viven en `.env.supabase`, ignorado por git. **No en `.env.local`**:
ese apunta al contenedor local, y la suite de pruebas —que borra usuarios y credenciales cifradas—
se niega a correr contra un proveedor administrado (`lib/datos/anfitrion.ts`). Dos bases, dos
archivos.

---

## 1 · La huella de `public`, antes y después

El criterio de éxito de toda la convivencia es que no cambie. Se captura antes y después y se
diffea: relaciones con dueño, RLS y ACL; columnas; políticas; funciones; ACL del esquema; permisos
por omisión; roles; esquemas.

**Resultado medido:** el diff tuvo exactamente cuatro clases de cambio y ninguna toca lo ajeno.

- las tres filas de los roles nuevos en `pg_roles`;
- los tres esquemas nuevos (`identidad`, `negocio`, `migraciones`), todos de `migrador`;
- las dos reglas de permisos por omisión de `migrador` en `negocio`;
- `USAGE` sobre el esquema `public` para los tres roles — que **no da acceso a ninguna tabla**.

Las 59 relaciones, sus columnas, sus políticas y sus funciones quedaron **byte por byte
idénticas**.

---

## 2 · Los tres roles

`db/arranque/000_cluster.sql` con los marcadores sustituidos igual que hace `scripts/db.mjs`
—`escapeLiteral` para las contraseñas, `escapeIdentifier` para el nombre de la base— enviado por la
Management API.

Dos cosas del archivo que existen por este entorno:

- **Verifica en vez de imponer.** Los `alter role … nosuperuser noreplication` no se pueden correr:
  PostgreSQL valida esas opciones **por presencia, no por cambio de valor**, y el `postgres` de
  Supabase no es superusuario real. Ahora un bloque `do` aborta el arranque si algún rol tiene
  atributos que no debería.
- **No instala `pgcrypto`.** Ya está, en el esquema `extensions`. Y ninguna migración usa una sola
  de sus funciones: `gen_random_uuid()` está en el núcleo desde PostgreSQL 13.

**Comprobado:** los tres existen, ninguno es superusuario, ninguno tiene `bypassrls`, ninguno
hereda, y las tres rutas de búsqueda quedaron puestas. Y `PUBLIC` sigue sin `CREATE` sobre
`public` — el `revoke` del arranque fue el no-op que su ACL previa anticipaba.

---

## 3 · Las migraciones

```bash
node --env-file=.env.supabase scripts/db.mjs migrar
```

Las ocho, como `migrador`, por la conexión directa al 5432.

Un dato que estaba mal documentado y se midió: **`current_user` es `migrador` también por el
agrupador.** Supavisor usa el sufijo `migrador.<proyecto>` solo para elegir el proyecto y la sesión
queda con el rol real, así que los tres caminos pasan la compuerta de `lib/datos/migrador.ts`. Se
usa la directa igual, porque el DDL no tiene por qué pasar por un agrupador en modo transacción.

---

## 4 · La organización principal, y el usuario

Quedaba un hueco entre "las migraciones corrieron" y "el arranque puede correr": `arranque.mjs`
**exige** la organización principal y no la crea a propósito, ninguna migración puede insertarla
—`migrador` no tiene política sobre `identidad.organizaciones`— y el sembrado, que sí sabe, se
niega a correr contra un anfitrión remoto.

```bash
node --env-file=.env.supabase scripts/organizacion-principal.mjs "ARIA" aria "America/Lima"
node --env-file=.env.supabase scripts/arranque.mjs "Tu Nombre" tu@correo
```

El segundo imprime una contraseña temporal de 14 caracteres **una sola vez** y crea además las dos
organizaciones de control de la sonda. Es idempotente para esas dos: se puede volver a correr para
reponerlas.

La contraseña que elijas necesita **9 caracteres o más** (`lib/autenticacion/politica.ts`). Ese
mínimo era 12 y se bajó a pedido explícito; el archivo escribe qué se acepta al bajarlo. En
resumen: no cambia nada frente a alguien probando contraseñas en el login —el freno corta a los
cinco intentos por cuenta y a los veinte por dirección— pero sí frente a un volcado de la tabla de
hashes, donde el largo es la única defensa que queda. **Elegí una larga de todas formas.**

---

## 4b · El catálogo de capacidades y el retiro de roles

**Es el único paso del despliegue que no se puede hacer con `scripts/db.mjs` a secas**, y hay que
decirlo porque el síntoma de saltearlo no es un error: la aplicación funciona con el catálogo viejo,
así que un rol nuevo simplemente no existe y nadie lo nota hasta que alguien intenta asignarlo.

```bash
node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/001_catalogo.sql
node --env-file=.env.supabase scripts/db.mjs retiro
```

**Son dos comandos y no uno porque son dos roles distintos de la base, y ninguno de los dos puede
hacer lo del otro:**

| Paso | Quién lo corre | Por qué no puede ser el otro |
| --- | --- | --- |
| El catálogo (`001`) | `postgres`, por la Management API | Hace falta omitir RLS **y** tener `INSERT`. `migrador` tiene lo segundo y no lo primero. |
| El retiro (`003`) | `app_identidad`, por TCP | Es un problema de POLÍTICA, no de privilegio: nadie más tiene política sobre `identidad.usuarios_roles`. |

Y el segundo es el peligroso. Medido: `migrador` ve **0 filas** en `identidad.usuarios_roles`, así
que corrido con el rol equivocado el retiro afecta cero filas, **reporta éxito**, y borra los roles
viejos dejando a su gente sin ninguno. Por eso `db.mjs retiro` existe como fase con nombre: el paso
vivía en la cabeza de quien despliega, y un paso que solo existe en producción es un paso que nadie
prueba. Ahora corre en los dos lados — `catalogo` lo llama en local, y acá se lo invoca solo.

`002_escritura_del_catalogo.sql` **no hace falta repetirlo**: otorga el `INSERT` a `postgres` una
vez y el privilegio queda. Comprobado antes de correr, en lectura:

```sql
select has_table_privilege('postgres','identidad.permisos','INSERT');   -- true
select rolbypassrls from pg_roles where rolname = 'postgres';           -- true
```

**Aplicado el 2026-08-26, y el antes y el después:**

| | antes | después |
| --- | --- | --- |
| roles | `administrador`, `closer`, `setter`, `superadministrador` | `administrador`, `superadministrador`, `usuario` |
| capacidades | 24 | 24 |
| asignaciones | 47 | 48 |
| usuarios sin rol | 0 | **0** |

`closer` y `setter` tenían **cero usuarios**, así que el retiro no movió a nadie. La diferencia
entre `administrador` (13 capacidades) y `usuario` (11) es exactamente `credenciales.ver` y
`credenciales.editar` — y eso lo verifica `pruebas/base/22-los-tres-roles.test.ts` por diferencia de
conjuntos, no por conteo.

**El orden importa y en un sentido solo:** el catálogo primero, porque `003` se niega a borrar nada
si el rol destino `usuario` todavía no existe. Preferir no hacer nada antes que dejar a alguien sin
acceso.

Verificación, contra la base y no contra el código:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select (select count(*) from identidad.permisos) as permisos, (select count(*) from identidad.roles_permisos) as rp, (select string_agg(clave,', ' order by clave) from identidad.roles) as roles, (select count(*) from identidad.usuarios u where not exists (select 1 from identidad.usuarios_roles ur where ur.usuario_id=u.id)) as sin_rol"
```

Lo último es lo que hay que mirar: **`sin_rol` tiene que ser 0.** Un número mayor significa que el
retiro corrió con el rol equivocado, y esa persona no puede entrar a ninguna pantalla.

---

## 5 · Las variables en Vercel

**Siete**, alcance **production**, creadas por la API con un token personal:

| Variable | Tipo | Qué es |
| --- | --- | --- |
| `DATABASE_URL_INQUILINO` | sensitive | datos de negocio, siempre filtrados por política |
| `DATABASE_URL_IDENTIDAD` | sensitive | usuarios y sesiones; no llega a datos de negocio |
| `CLAVE_MAESTRA` | sensitive | cifra el secreto del segundo factor |
| `SONDA_TOKEN` | sensitive | el secreto del punto de entrada de la sonda |
| `CRON_SECRET` | sensitive | el secreto de las tareas programadas (`/api/cron`) |
| `DOMINIO_ESPERADO` | plain | el host desde el que se aceptan peticiones que modifican |
| `CABECERA_DIRECCION_REAL` | plain | `x-real-ip`; qué cabecera trae la IP del visitante |

Los cuatro secretos van como `sensitive`: **no se pueden volver a leer**, ni por la API ni por el
panel. Se verifican por comportamiento, que es la única verificación que importa. Los dos que no son
secretos van como `plain` para poder confirmarlos — `DOMINIO_ESPERADO` existía como `sensitive` con
un valor que nadie podía leer, y si estaba mal **todo** login habría fallado con un 403 que no
explica nada.

**Lo que NO se creó, y por qué:**

- `DATABASE_URL_MIGRADOR` y `DATABASE_URL_ADMIN` — su contraseña no vive en el entorno de la
  aplicación (`09` § 2, `10` § 4). Si estuvieran, el rol dueño de las tablas quedaría alcanzable
  desde cualquier función desplegada.
- `AVISO_URL` y `AVISO_DESTINO` — sin definir. Crearlas vacías es peor que no crearlas: `avisar()`
  lanza sin canal a propósito, y una cadena vacía haría creer que está configurado. **El login
  funciona sin ellas; la sonda no.**

**Dos consecuencias del alcance solo-producción:** las vistas previas no tienen variables de base y
por lo tanto no funcionan —deliberado, una vista previa no debería escribir en datos de
producción— y de todas formas no podrían loguear, porque cada una tiene un dominio distinto del
esperado.

---

## 5b · Las tareas programadas

`vercel.json` declara **un** cron: `GET /api/cron`, todos los días a las **12:00 UTC** (07:00 en
`America/Lima`). Ahí corren las tres tareas: la sonda de aislamiento, la ingesta de mensajes y el
barrido de citas, para todas las empresas activas.

**Hasta esto, las dos últimas solo corrían mientras alguien tenía la pestaña del Closer abierta.**

### Por qué un solo cron, y diario

Es el único horario que funciona en los **dos** planes de Vercel, y la decisión tiene costo:

- **En Hobby, un horario más frecuente que un día no se ignora ni se ajusta: hace fallar el
  despliegue entero**, con un mensaje sobre cuentas Hobby.
- En Pro andaría `*/10 * * * *` para los mensajes y `3 * * * *` para las citas y la sonda.

El plan de este proyecto **no se pudo medir**: el token disponible lee los proyectos (`/v9/projects`
responde) pero no la facturación del equipo (403 en `/v2/teams/{id}`), y el plan no aparece en el
objeto del proyecto. Así que se eligió el horario correcto en los dos, porque los dos errores no
cuestan lo mismo: con el diario en Pro la agenda se refresca menos seguido; con `*/10` en Hobby **no
se puede desplegar**.

**Para pasar a Pro** hay que mover dos renglones juntos —`vercel.json` y `HORARIOS` de
`lib/negocio/barrido.ts`— y `pruebas/codigo/99-cron.test.ts` verifica que no se mueva uno solo. Los
valores para Pro están escritos como comentario en ese archivo.

### El coste, medido

| Tarea | Llamadas a GoHighLevel |
| --- | --- |
| `citas` | **1 + un por calendario**. Con los 9 medidos en la subcuenta de ARIA: **10**. `GET /calendars/events` responde 422 sin `calendarId`, así que no baja. |
| `mensajes` | **1** en régimen, **15** en el peor caso (topes de 7 páginas y 6 conversaciones, más 2 entregas) |
| `sonda` | **0** |

Medido el 2026-08-26: de las tres empresas activas, **solo `aria` tiene token cargado**. `aivora` y
`prueba` se saltean con `sin_token` y cuestan **cero**. O sea que hoy una corrida cuesta **11 en
régimen y 25 en el peor caso** — no un rango.

### ⚠ LA PROTECCIÓN DE DESPLIEGUE, Y LO PRIMERO QUE HAY QUE COMPROBAR

Esto se midió **después** de desplegar, y corrige lo que este documento decía antes. Es el único
punto abierto del cron y conviene entenderlo entero, porque su modo de fallar es el silencio.

Lo que Vercel registró al desplegar, leído por la API del proyecto:

```json
{ "host": "aria-comando-central-q6jetb2ep.vercel.app", "path": "/api/cron", "schedule": "0 12 * * *" }
```

O sea que el planificador quedó apuntando a la **URL generada del despliegue**, no al dominio de
producción. Y las dos no responden igual:

```
GET https://aria-comando-central.vercel.app/api/cron              → 403   ← nuestro rechazo: la ruta CORRIÓ
GET https://aria-comando-central-q6jetb2ep.vercel.app/api/cron    → 302   ← el muro de SSO: la ruta NO corrió
```

La protección está en **Standard**, que deja público el dominio de producción y protege las URL
generadas. **La documentación de Vercel no dice en ninguna parte que los cron salteen la protección**
—los cuatro métodos de excepción que documenta son todos explícitos, y ninguno se aplica solo— así
que hay dos posibilidades y desde afuera no se distinguen:

1. El disparador de Vercel es interno y pasa la protección. Entonces todo anda.
2. El disparador recibe el 302. Entonces **la corrida se da por terminada, no hace ningún trabajo y
   no aparece en los registros**. Es el peor caso posible: no hay error que ver.

**Cómo se resuelve, en un minuto y sin esperar al horario:** en el panel de Vercel, Settings → Cron
Jobs, apretar **Run** en `/api/cron`. Después, mirar el sello — que es lo único que sobrevive:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select o.slug, t.tarea, t.ultimo_estado, t.ultima_corrida_el from negocio.tareas_programadas t join identidad.organizaciones o on o.id = t.org_id order by t.ultima_corrida_el desc"
```

- **Si hay filas** → el disparador pasa la protección. Anda, y esta sección se puede acortar.
- **Si no hay ninguna** → es el caso 2. La salida es una de estas tres, en este orden de preferencia:
  1. **Deployment Protection Exceptions**: agregar el dominio de producción como excepción.
  2. Cambiar el alcance de la protección a **None** para producción. Es la más simple y la que más
     afloja: deja pública la URL generada de todos los despliegues.
  3. **Protection Bypass for Automation** con el secreto en la cadena de consulta del `path`. Es la
     peor de las tres y hay que decir por qué: pondría un secreto en `vercel.json`, o sea **en el
     repositorio**, que es lo que `ADR-0601` prohíbe.

Ninguna de las tres se hizo: las tres cambian la configuración de seguridad del proyecto, y esa
decisión no es de quien escribe el código.

### Cómo saber si corre

**No mires los registros de Vercel.** En Hobby duran una hora, y **no existe ninguna alerta por
ausencia** de invocaciones: las dos alertas de Vercel son por exceso, con una línea base de ~1.000
peticiones por intervalo — un 403 diario *es* la línea base, nunca una anomalía.

Lo que sobrevive es el sello:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "select o.slug, t.tarea, t.ultimo_estado, t.ultimo_motivo, t.ultima_corrida_el from negocio.tareas_programadas t join identidad.organizaciones o on o.id = t.org_id order by t.ultima_corrida_el desc"
```

Hay fila por cada par (empresa, tarea) **incluidas las que no corrieron**: `saltada` (no hay
credencial), `frenada` (el antirrebote), `sin_tiempo` (se agotó el presupuesto de la corrida) y
`fallo`. Los tres primeros son estados **normales**. Sin esas filas, «esta empresa no tiene token» y
«el cron no pasó nunca» se verían igual.

### Ponerse al día

La ingesta camina **700 conversaciones por corrida** (7 páginas × 100) contra las ~15.800 de la
cuenta: son **≈23 corridas** para caminarla entera, o sea ≈23 días con el cron diario. Se acelera a
mano, sin tocar código, dejando más de 8 segundos entre corridas (el antirrebote del pulso):

```bash
vercel crons run /api/cron
```

Ese comando lee las definiciones del proyecto **desplegado**, no del `vercel.json` local: sin
desplegar antes dice que no lo encuentra, y eso se confunde con «el cron está roto».

---

## 6 · Comprobar

```bash
node --env-file=.env.supabase scripts/compatibilidad.mjs
```

23 comprobaciones contra el proveedor administrado: la versión mayor, que ningún rol nuestro puede
evadir las políticas, que la variable de transacción **sobrevive por el agrupador** —lo único que el
contenedor local no puede verificar—, que cada organización de control ve sus filas y ninguna ajena,
que las fronteras entre dominios lanzan, que el propietario ve cero filas, y que ninguna tabla
nuestra vive en `public` ni ninguna de `public` recibió permisos nuestros.

Las lecturas de negocio van por `conOrganizacion()` y `datos()`, no con un `set_config` a mano: esa
función ya hace una lectura de vuelta y lanza si la variable no quedó puesta, así que probar el
camino real prueba más que comparar dos cadenas.

Y en local, siempre: `npm run db:reset && npm run build && npm run tipos && npm test`.

---

## 7 · Desplegar

```bash
git push origin main
```

**Vercel despliega por push, no por chequeo.** Un commit con las pruebas en rojo se publica igual.
La protección de rama en `main` con `verificar` requerido sigue pendiente y es lo primero que
conviene hacer después del primer despliegue.

Después, en este orden, porque cada uno descarta una causa distinta:

1. **`GET /api/salud`** — sin sesión. Si falla, es la base o las cadenas de conexión.
2. **Abrir la raíz** — tiene que redirigir a `/entrar`. Si muestra el centro de mando, el proxy no
   corre: el build tiene que decir `ƒ Proxy (Middleware)`, y el archivo tiene que llamarse
   `proxy.ts` — en Next 16 `middleware.ts` **no corre**, y no da error.
3. **Entrar con la temporal.** Si da 403 «el servidor rechazó el origen», es `DOMINIO_ESPERADO`.
4. **Las tres pantallas del primer ingreso** — contraseña, segundo factor, códigos de respaldo.
   **Guardá los ocho códigos**: no se vuelven a mostrar y no se pueden regenerar.
5. **La sonda** (`POST /api/sonda` con la cabecera del token). Cuidado con el renglón que decía
   antes acá: **el 403 sale solo por el token**, no por el canal de avisos. Sin `AVISO_URL` lo que
   pasa es otra cosa —`avisar()` LANZA a propósito y la ruta se cae con 500— así que los dos
   síntomas mandan a buscar en lugares distintos y conviene no confundirlos.
6. **El cron** (`GET /api/cron` con `Authorization: Bearer $CRON_SECRET`). Ver § 5b: con `curl -i` y
   **sin seguir redirecciones**, porque el navegador las sigue y el cron no — una prueba en el
   navegador puede dar un falso verde.

---

## Un hallazgo sobre la base, ajeno a este trabajo

Medido al inventariar, y no lo causó nada de acá: **seis tablas de `public` no tienen RLS, y `anon`
tiene permisos completos de lectura y escritura sobre ellas.** La clave publicable viaja en el
navegador por diseño, así que hoy cualquiera que la tenga puede leer y modificar:

| Tabla | Filas | Qué contiene |
| --- | --- | --- |
| `message_buffer` | 1.888 | mensajes de conversaciones |
| `conversations` | 752 | conversaciones |
| `aria_brain_clientes` | 16 | clientes, **con una columna `password`** |
| `documents`, `documents_crm`, `documents_sofia` | — | contenido RAG |

Más `aria_brain_prekickoff_responses`, con tres políticas que dan a `anon` permiso de leer, insertar
y actualizar, y que guarda `nombre_completo`, `email`, `telefono` y `password`.

Rotar la clave no lo arregla: la publicable es pública por diseño. El arreglo es una línea por tabla
—`alter table … enable row level security`— y **no rompe a quien entra por `service_role`**, que
tiene `bypassrls`. Solo corta a `anon` y `authenticated`. Son tablas de otros sistemas, así que la
decisión y la prueba de regresión son de quien los mantiene.

---

## Lo que queda pendiente

- **Protección de rama en `main`** con `verificar` requerido.
- **El canal de avisos** (`AVISO_URL`, `AVISO_DESTINO`) y la tarea horaria de la sonda.
- **El código QR del segundo factor.** Hoy la pantalla muestra el secreto para carga manual y un
  enlace `otpauth://`. Generarlo exige una dependencia nueva —decisión de cadena de suministro, con
  `ignore-scripts=true` y versiones fijas por `ADR-7101`— o escribir el codificador.
- **Las pantallas de administración.** La API de alta de usuarios y organizaciones está completa y
  probada; la interfaz no. Mientras tanto se da de alta por guion.
- **Los 5 usuarios de `closer_usuarios`.** Su `password_hash` usa `scrypt$16384$8$1$…`, **el mismo
  formato y los mismos parámetros** que `lib/datos/hash.ts`, así que se pueden copiar a
  `identidad.usuarios` y entrarían con sus contraseñas actuales. Falta escribir y probar ese guion.


## Anexo · Probarlo en tu máquina

El puerto de desarrollo está fijado en `3100` (`package.json`), y no es una preferencia: tiene que
coincidir con `DOMINIO_ESPERADO=localhost:3100` de `.env.local`. Si no coinciden, **el login falla y
el mensaje dice "problema de configuración del servidor"** — que es correcto y aun así manda a buscar
en el lugar equivocado. Atarlos en el guión es lo que impide que divergan.

```bash
docker desktop start           # o abrir Docker Desktop
npm run db:reset               # base local desde cero, con el sembrado
npm run dev                    # http://localhost:3100
```

El sembrado crea `fundadora@principal.ejemplo` con la contraseña `desarrollo-no-usar` y la marca de
"debe cambiar la contraseña", más el rol `superadministrador` — que exige segundo factor. O sea que
el flujo local es **el mismo** que en producción: las tres pantallas del primer ingreso.

Ese usuario existe **solo en local**: el sembrado se niega a correr contra un anfitrión remoto.

---

## Anexo · Hallazgos de la revisión adversarial que quedan abiertos

Cinco lentes revisaron la interfaz de login, con un escéptico refutando cada hallazgo: **42
crudos, 20 confirmados, 22 descartados**. Ocho se arreglaron en el mismo cambio. Los que quedan
están acá con su mecanismo, porque un hallazgo confirmado que nadie escribe se pierde.

### Arreglados

| Qué | Dónde |
| --- | --- |
| Redirección abierta por tab, LF y CR: cuatro variantes pasaban las guardas por prefijo | `lib/autorizacion/destino.ts` |
| Cambiar la contraseña temporal ponía la sesión en `activa` y salteaba el segundo factor obligatorio | `app/api/auth/sesion/route.ts` |
| El campo "contraseña actual" se desmontaba al primer carácter: `debe_cambiar_password` sin salida | `app/entrar/page.tsx` |
| `detalle` reemplazaba el texto del código: `cuenta_bloqueada` perdía el "está bloqueada" | `app/entrar/page.tsx` |
| Los 409 del segundo factor eran código muerto: la pantalla quedaba clavada | `app/entrar/page.tsx` |
| `salir()` informaba éxito con el `DELETE` fallado | `app/entrar/page.tsx` |
| Los códigos de respaldo se perdían con un parpadeo de red | `app/entrar/page.tsx` |
| El matcher del proxy excluía `api` por prefijo: `/apis` salteaba la compuerta | `proxy.ts` |
| `SONDA_TOKEN` viajaba por nombre en un `detalle` que ahora se dibuja | `app/api/sonda/route.ts` |
| `proxy.ts` era invisible para TODOS los barridos del proyecto | `pruebas/apoyo/fuente.ts` |

### Abiertos, en orden de gravedad

**Una pestaña vieja puede borrar el segundo factor recién confirmado.** Una sesión `activa`
puede volver a llamar `POST /api/auth/2fo/configurar`, que sobrescribe el secreto y deja
`confirmado_el` en nulo. Escenario: dos pestañas en el alta, se confirma en una, y la otra
—todavía en la fase de configurar— genera un secreto nuevo. El factor confirmado desaparece y el
login siguiente pide configurarlo otra vez. Es del backend y es previo a este trabajo.

**`POST /api/auth/2fo/verificar` es alcanzable con la sesión ya `activa`.** Tres códigos
incorrectos borran la sesión, así que alguien con acceso a una pestaña abierta puede tirar una
sesión buena sin saber ninguna credencial. `ESTADOS.activa` es `null`, o sea que habilita toda
ruta — que es correcto en general y de más en este caso.

**`proxy.ts` no tiene ni una prueba.** Ya es visible para los barridos estáticos, pero su
comportamiento —a quién redirige, a quién deja pasar— no está verificado por nada. Y hay una
razón estructural: no se puede importar desde la suite sin el entorno de Next. Lo que sí se puede
probar y falta: que el matcher deje pasar y bloquee lo que dice, y que el grafo de imports no
arrastre la capa de datos (el arreglo de `COOKIE_SESION` no tiene nada que lo sostenga).

**`npm run paridad` necesita una sesión.** La guarda de `app/guardia.tsx` hace que un navegador
sin sesión reciba la redirección a `/entrar`, así que todos los selectores fallan con un error que
no dice "falta la sesión". No se debilita la guarda: hay que entrar primero con el usuario del
sembrado. El puerto ya está corregido a 3100.

**La promesa de `rechazo()` sobre `detalle` no la hace cumplir nada.** Dice que *"nunca lleva
nada que el cliente no deba saber"*, y ahora ese campo se dibuja en pantalla. Dos lugares la
tensan: `rechazo_de_la_base` pasa el texto crudo de cualquier `raise exception` de una migración,
y el `sin_permiso` de la asignación de roles publica el nombre de una capacidad interna. Una
prueba que recorra todas las llamadas a `rechazo()` con detalle cerraría la clase.

**El encabezado de `lib/http/cliente.ts` quedó un poco desactualizado.** Afirma que
`Respuesta<T>` no admite un `??` sobre el resultado; con el campo `detalle` opcional eso es menos
absoluto de lo que dice. Y el barrido que verifica la unicidad de `pedir()` es más angosto que la
afirmación del encabezado.

**El `console.error` nuevo del portero no está cubierto por `ADR-0407`.** Esa fila prohíbe
registrar cuerpos en rutas de autenticación, y el portero no estaba en su alcance. El registro que
se agregó no toca ningún cuerpo, pero el alcance de la regla debería incluirlo antes de que
alguien agregue el segundo. Y la rama "sin variable de dominio" que se cambió no tiene prueba de
comportamiento.

**`/entrar` es una página pública y ninguna lista blanca la nombra.** Las listas de
`pruebas/apoyo/autorizados.ts` cubren rutas de API. Una página nueva nace sin guarda y sin que
nada falle — que es la forma que tiene este proyecto de perder invariantes.

---

## El cifrado en tránsito — medido el 2026-08-24, y estaba mal

**Las tres cadenas de conexión a producción viajaban SIN CIFRAR.** No es una sospecha:
se midió del lado del cliente con `socket.encrypted`, que es el único lugar donde se
puede medir una conexión agrupada — `pg_stat_ssl` describe la pata Supavisor↔Postgres,
no la del cliente, así que preguntándole a la base se obtiene la respuesta de otra
conexión.

| conexión | antes | con el parámetro |
| --- | --- | --- |
| `DATABASE_URL_INQUILINO` (6543) | **sin cifrar** | TLSv1.3 |
| `DATABASE_URL_IDENTIDAD` (6543) | **sin cifrar** | TLSv1.3 |
| `DATABASE_URL_MIGRADOR` (5432) | **sin cifrar** | TLSv1.3 |

La causa: **`node-postgres` no negocia TLS por omisión** y ninguna de las tres cadenas lo
pedía. Así que las tres contraseñas de base y todo el tráfico —nombres, teléfonos,
correos, tokens de sesión, los blobs cifrados de credenciales— cruzaban internet abierto
en claro entre Vercel y `sa-east-1`. **Nada fallaba.**

El arreglo es un parámetro por cadena:

```
?uselibpqcompat=true&sslmode=require
```

`uselibpqcompat=true` hace falta porque `node-postgres` 8.16+ cambió el significado de
`sslmode=require` a *verificar el certificado*; su propio aviso lo dice. Sin eso,
`require` se comporta como `verify-full` y la conexión falla.

### Lo que NO está resuelto, dicho de frente

`require` **cifra y no verifica el certificado**: protege de que alguien escuche el
tráfico, no de que alguien se ponga en el medio. `verify-full` sí verifica, y contra este
proyecto falla con *"self-signed certificate in certificate chain"* — Supabase firma con
su propia autoridad, así que hace falta desplegar su paquete de CA junto con la
aplicación y apuntar `sslrootcert` ahí.

Eso queda **pendiente**. `require` es una mejora estricta sobre texto en claro; decir que
el problema está cerrado sería falso.

### El guardia, para que no vuelva a pasar

`exigirCifradoSiEsRemoto()` en `lib/datos/anfitrion.ts`, llamado desde `lib/datos/capa.ts`
en cada creación de cliente. Si el anfitrión es un proveedor administrado y la cadena no
pide cifrado, **lanza**.

Tres decisiones de ese guardia, cada una por un modo de falla:

- **El criterio es el ANFITRIÓN, no `NODE_ENV`.** Con el entorno, el caso más frecuente
  quedaría descubierto: alguien que abre una copia de producción desde su máquina para
  depurar. Eso no es desarrollo.
- **No está condicionado a `enPruebas()`**, al revés que el guardia de anfitrión. Ése
  distingue local de remoto porque el mismo hecho es correcto o catastrófico según quién
  pregunte; éste no tiene esa ambigüedad y ya no hace nada contra un anfitrión local.
- **No tiene escotilla.** No existe la razón "necesito que los datos de mis clientes
  viajen en claro". Si un certificado da problemas, se arregla el certificado.

### Cómo se verifica que Vercel quedó bien

**No se puede leer el valor.** Las dos variables son `type: sensitive`, y Vercel devuelve
`value: ""` incluso con `decrypt=true` — así que una comprobación que busque `sslmode` en
la respuesta de la API **pasa siempre, sin comprobar nada**. Es un falso verde y hay que
nombrarlo, porque es el primer lugar donde uno mira.

Lo que sí es evidencia:

1. `updatedAt` de la variable se mueve tras el `PATCH` — prueba que hubo una escritura,
   no que el valor sea el correcto.
2. **La definitiva: el guardia.** Con él desplegado, una cadena sin `sslmode` hace que
   *cualquier* acceso a base lance. Así que si tras el despliegue una ruta que toca la
   base responde bien, la cadena tiene el parámetro. El guardia convierte una propiedad
   invisible en una observable.

---

## Los datos inventados que quedan, y dónde

La Etapa 11 sacó los de las pestañas **Closer** y **Setter**, que estuvieron desplegados
mostrando nombres de personas y montos que no existen. Lo que se borró está detallado en el
encabezado de `components/views/CloserView.jsx`.

**Las otras siete pantallas del prototipo siguen igual.** Son las de
`SIN_OPERACIONES_TODAVIA`, no tienen ninguna operación de servidor, y su contenido es el
maquetado del HTML original:

| archivo | qué inventa |
| --- | --- |
| `components/views/SalesView.jsx` | un nombre de persona |
| `components/Overlays.jsx` | un nombre de persona en la ficha lateral |
| `lib/aios/leads-portal.js` | nombres en el portal de contactos |
| `lib/aios/leads-group.js` | nombres en el agrupador |
| `components/views/ExecutiveView.jsx` | métricas del tablero |
| `components/views/AcquisitionView.jsx` | métricas de adquisición |
| `lib/aios/creative.js`, `conversion.js`, `conversation.js`, `executive*.js`, `acquisition*.js` | las métricas de sus paneles |

**Por qué no se vaciaron en esta etapa, dicho de frente.** Vaciarlas sin tener de dónde traer
datos las deja en siete carteles de "falta conectar". Cuáles se conectan y en qué orden es una
decisión de producto, no una consecuencia de esta etapa. Quedan visibles **solo para quien
tenga `tablero.ver`** —o sea administradores, no closers ni setters—, y eso acota a quién le
pueden mentir.

La prueba `pruebas/codigo/91-closer-y-setter.test.ts` verifica que los nombres inventados no
vuelvan a las dos pestañas conectadas. Su comentario explica por qué no amplía el alcance:
corrida sobre todo el árbol, encuentra los de la tabla de arriba — y una prueba que se pone en
rojo por una decisión que nadie tomó se termina desactivando.
