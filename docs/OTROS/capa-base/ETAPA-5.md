# Etapa 5 — Administración

El script de arranque, el alta de organizaciones y usuarios, el restablecimiento, la
desactivación y la asignación de roles.

```bash
npm run db:reset && npm run tipos && npm test
```

**193 pruebas, 193 pasan. Las ocho filas de `PRUEBAS.md`, incluida la ⛔.**

## El criterio de cierre

> `EJECUCION` § 5: *"un administrador del cliente A que opere sobre un usuario del cliente B
> recibe **404** en las cinco operaciones. Y una organización nueva nace sin credenciales, no
> opera, y la respuesta lo dice."*

Las dos, verificadas. Y la prueba afirma **el código exacto**, no `notEqual(200)`: la fila ⛔ dice
*"404 y no 403, porque un 403 confirma que ese identificador existe"*, así que un 403 pasaría una
comprobación laxa y sería el defecto entero.

Más la mitad que se olvida: **nada cambió en la organización ajena**. Un 404 devuelto *después* de
escribir pasaría las cinco afirmaciones — la respuesta diría una cosa y la base otra.

## Lo que cambió mi premisa: hay DOS mecanismos de 404

Entré a esta etapa asumiendo que las cinco operaciones iban por `conIdentidad()`. El `09` § 2 —que
`EJECUCION` § 4 llama *"el más importante"*— dice lo contrario, y la Etapa 1 ya había puesto los
permisos para eso:

> *"Con los permisos y la política de arriba, **editar y desactivar recuperan la red de la base.**
> Quedan en el dominio de identidad solo las tres operaciones que tocan credenciales: el alta, el
> restablecimiento y la asignación de roles."*

| operación | dominio | de dónde sale el 404 |
| --- | --- | --- |
| editar | **inquilino** | la política: cero filas actualizadas |
| desactivar | **inquilino** | la política: cero filas actualizadas |
| alta | identidad | comparar el `orgId` del cuerpo con `orgEfectiva` |
| restablecer | identidad | `usuarioObjetivo()` |
| asignar roles | identidad | `usuarioObjetivo()` |

La consecuencia concreta: **la consulta de editar y desactivar no lleva `where org_id`**, y no es un
olvido. Lo pone la política `usuarios_edita_inquilino`, así que el filtro no depende de una línea
que alguien puede borrar. Hay una prueba que falla si aparece ese `where`.

Y en las tres de identidad la política es `using (true)`: ahí no hay red abajo, así que el filtro
vive en **una** función, `usuarioObjetivo()`, con una prueba que afirma que ninguna ruta de
`app/api/admin/**` consulta `usuarios` por su cuenta.

## Tres cosas que encontró correr las pruebas

1. **Mi barrera del rol de plataforma no frenaba a nadie.** Puse `roles.administrar`, que parecía
   la natural, y la prueba respondió `200 {"asignados":true,"roles":["superadministrador"]}`: el rol
   `administrador` **tiene** `roles.administrar`, porque la migración 003 le da todo lo que no
   empieza con `organizaciones.`. La barrera correcta es `organizaciones.listar`, cuya descripción en
   el catálogo es *"ver y cambiar entre todas las organizaciones"* — o sea lo que **es** el rol de
   plataforma. La regla queda legible: **no se puede otorgar el alcance que uno no tiene.** El único
   síntoma del error habría sido que funciona.

2. **`usuarios.creado_por` referencia `usuarios(id)`**, así que la limpieza de los fixtures tiene un
   orden obligatorio: anular la columna antes de borrar. La primera corrida murió exactamente ahí,
   con `violates foreign key constraint "usuarios_creado_por_fkey"`.

3. **Mi limpieza mutaba estado sembrado que otra prueba afirma.** Ponía
   `debe_cambiar_password = false` en todos los usuarios y rompía `11-sembrado`, que verifica que
   los tres nacen debiendo cambiarla. Es el **mismo error que ya cometí en la Etapa 2**. Una
   limpieza tiene que devolver la base a donde estaba, no a donde le conviene al archivo que la
   escribe.

## Un conflicto de la especificación, resuelto sin elegir un lado

El `05` § 6 dice que al desactivar un usuario *"sus sesiones abiertas se cierran"*. El `09` § 7.16
manda que desactivar corra **por el dominio del inquilino**, que no puede tocar
`identidad.sesiones`. Y hacerlo desde identidad sería una escritura que cruza los dos dominios, que
`EJECUCION` § 2 prohíbe.

La propiedad se cumple **por otro camino, y más fuerte**: `resolverSesion()` filtra con
`u.activo = true` —la defensa en profundidad que agregué en la Etapa 3— así que la sesión deja de
valer en la petición siguiente **sin depender de una escritura que puede fallar**. La fila
sobrevive y vence sola.

Hay una prueba que lo demuestra por el camino real del portero, y que además afirma que **la fila
sigue ahí**: si alguien "arreglara" esto borrando sesiones, la prueba diría que la defensa no es la
que se cree.

## El disparador que NO se escribió, y por qué

`PRUEBAS.md` tipifica *"no se puede dejar una organización sin administrador activo"* como **Código**,
y el `05` § 4 lo confirma: *"verificación **en el endpoint**: contar los administradores activos
antes de desactivar"*. El documento explica el criterio general:

> *"Las de la base son las que **nunca** deben ocurrir, por ninguna vía: son invariantes del
> sistema. Las del endpoint son reglas de operación que dependen del contexto (quién está pidiendo
> qué), y esa información la base no la tiene."*

Y además, escrito como disparador **no funcionaría**: contar administradores exige leer
`usuarios_roles`, a la que `app_inquilino` no tiene ningún acceso. Un disparador `security invoker`
fallaría con *permission denied*; uno `security definer` propiedad de `migrador` devolvería **cero
filas** —`force row level security` sujeta también al propietario y ninguna política nombra a
`migrador`— y **rechazaría todas las desactivaciones**. Es la trampa del `09` § 2 reapareciendo
dentro de un disparador.

## Decisiones que la especificación **no toma**

1. **Cuatro de los cinco caminos.** El único literal en los catorce documentos es
   `POST /admin/usuarios/{id}/restablecer-password requiere: usuarios.editar` (`05` § 5). Los otros
   cuatro siguen su forma: `POST /api/admin/usuarios`, `PATCH /api/admin/usuarios/[id]`,
   `POST /api/admin/usuarios/[id]/desactivar`, `POST /api/admin/usuarios/[id]/roles`, más
   `POST /api/admin/organizaciones`. El nombre de carpeta `admin/usuarios` sí es del `04` § 4.

2. **Restablecer comparte capacidad con editar** (`usuarios.editar`), y eso es del documento.
   Inventar `usuarios.restablecer` rompería la prueba que cruza `CAPACIDADES` contra
   `identidad.permisos` en las dos direcciones.

3. **El 404 del alta** sale de comparar el `orgId` del cuerpo con `orgEfectiva`. En un alta no hay
   usuario objetivo, y ningún documento dice cuál es el identificador ajeno de esa operación. El rol
   de plataforma no necesita ese campo para crear en otra organización: cambia su organización activa
   y `orgEfectiva` lo sigue — un segundo camino sería un segundo lugar donde olvidarse el filtro.

4. **Cinco códigos de rechazo nuevos**, ninguno en la especificación con código de cuerpo:
   `no_encontrado` (404), `sobre_si_mismo` (409), `ultimo_administrador` (409), `email_duplicado`
   (409, el número y el nombre sí son del `05` § 3) y `rechazo_de_la_base` (409). Los dos 409 de
   protección son **conflictos, no faltas de permiso**: con 403 el mensaje diría "no tenés permiso"
   a quien sí lo tiene, y buscaría el permiso que le falta.

5. **"Administrador activo" se define por CAPACIDAD, no por nombre de rol.** Ningún documento lo
   define. Se usa *"tiene `usuarios.crear`"*, porque comparar `clave === 'administrador'` es lo que
   `ADR-0302` prohíbe y porque el día que exista un rol "supervisor" con esa capacidad la regla lo
   cuenta solo.

6. **La carrera del conteo de administradores está aceptada a la vista.** Entre contar y escribir,
   otro administrador podría desactivarse. A la escala del `EJECUCION` § 1 —hasta tres usuarios por
   organización— eso exige dos administradores desactivándose en el mismo instante. Cerrarla pediría
   un bloqueo sobre la organización, que es la clase de solución que `EJECUCION` § 1 dice que no se
   implementa.

7. **La edición y la desactivación auditan en la MISMA transacción**, por el rol del inquilino, que
   tiene `insert` sobre `auditoria_accesos`. Con una segunda llamada por identidad existiría el caso
   *"la edición ocurrió y no quedó registrada"*.

8. **`auditarAdministracion()` tiene `actor` y `objetivo` obligatorios**, sin valor por defecto. El
   `07` § 1: *"si mañana aparece un llamador nuevo, que no compile hasta que diga quién es"*. El caso
   real que documenta ocurrió con un parámetro con valor por defecto —el id de una persona real— y
   **todo** lo registrado quedó firmado por esa persona.

9. **Las seis rutas van a `SIN_PANTALLA`.** `ADR-0304` exige que las operaciones de una misma
   pantalla pidan el mismo conjunto de capacidades, y estas seis piden cinco conjuntos distintos.
   Igualarlos sería una **escalada silenciosa introducida para que una prueba pase**: el portero usa
   `contieneAlguna`, así que alguien con solo `usuarios.desactivar` podría crear usuarios. Y el
   defecto que `ADR-0304` previene es de lecturas, no de mutaciones.

10. **La contraseña temporal sigue el `05` § 3 al pie de la letra**: catorce caracteres, alfabeto sin
    `l`, `I`, `O`, `0` ni `1`, y el descarte de los bytes del resto incompleto escrito a mano. Se
    consideró usar `randomInt` de `node:crypto`, que hace lo mismo internamente y es tres líneas
    menos, y **se descartó**: el `05` es normativo y escribe el algoritmo, así que un revisor puede
    diffear esas líneas contra el documento. También se consideró excluir `5`/`S` y `2`/`Z`, y se
    descartó por lo mismo — el documento ya nombró cinco.

11. **El script de arranque se niega a correr dos veces.** No es idempotente y no debería serlo:
    correrlo dos veces significa que alguien no sabe en qué estado está la base, y la respuesta
    correcta a eso es parar. Es el único lugar del sistema donde `creado_por` queda nulo
    legítimamente: no hay nadie antes.

12. **`scripts/arranque.mjs` está exceptuado de `ADR-0506`**, con la excepción escrita en una lista
    con comprobación de entradas muertas. Es un script interactivo cuya única forma de entregar la
    contraseña es imprimirla; su salida estándar no se persiste y el script no corre nunca en
    integración continua, que es el único lugar donde sí se conservaría.

## Lo que la Etapa 5 **no** hace

Ninguna pantalla de administración, ningún cliente en la interfaz, ninguna edición de
organizaciones (solo el alta), ninguna desactivación de organizaciones, y ninguna recuperación de
contraseña por correo (fuera de alcance por `EJECUCION` § 7).

## Pendientes

1. **Tres variables de entorno en Vercel**: `DOMINIO_ESPERADO`, `CABECERA_DIRECCION_REAL` y
   `CLAVE_MAESTRA`.
2. **El proveedor de PostgreSQL administrado.** Bloqueante para desplegar desde la Etapa 3.
3. **Protección de rama en `main`** con `verificar` requerido.
4. **La deuda de `SECCIONES`**: unificar las cuatro copias de las claves de pantalla. Ahora tiene un
   consumidor más — la pantalla de administración, cuando exista, va a necesitar su `GET`.
5. **El campo `ip` no se registra en las operaciones de administración.** `auditarAdministracion` no
   lo pide, y las señales del `10` § 2 que cruzan dirección con acción no lo van a encontrar. Se
   decide en la Etapa 8, que es la que las escribe.
