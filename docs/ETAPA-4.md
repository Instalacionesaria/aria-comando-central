# Etapa 4 — Contraseñas y sesiones

El login completo, los dos frenos, el cambio de contraseña, y los estados de sesión de punta
a punta.

```bash
npm run db:reset && npm run tipos && npm test
```

**165 pruebas, 165 pasan. Las catorce filas de `PRUEBAS.md` tienen prueba; las cuatro ⛔
también.**

## El criterio de cierre

> `EJECUCION` § 5: *"el login con correo inexistente y con contraseña incorrecta tardan lo
> mismo; una cabecera de origen falsificada no evade el freno; una sesión en estado
> restringido no alcanza ninguna ruta fuera de su lista."*

Las tres, verificadas. Y las dos primeras con **mutación**, que es lo único que demuestra que
una prueba sirve:

- quitar el señuelo —poner el `if (!usuario) return 401` que parece obviamente correcto— hace
  fallar `ADR-0401`;
- invertir las ramas 2 y 3 del estado inicial hace fallar `ADR-0413`, y **solo** ésa.

## Lo que el orden de las líneas compra, línea por línea

El login es la ruta donde reordenar no rompe nada visible. Lo que se pierde en cada caso:

| Si se mueve | Qué se pierde |
| --- | --- |
| `if (!usuario) return 401` antes de derivar | El canal de tiempo entero. *"Con un cronómetro se enumeran cuentas igual"* |
| `!usuario.activo` fuera del `if` de las tres causas | Lo mismo: el camino de la cuenta inactiva termina antes |
| Consultar roles o segundo factor antes de la contraseña | Canal de existencia: solo hay viajes extra cuando el usuario existe |
| `where email = $1` en vez de `lower(email)` | Quien tenga una mayúscula guardada **no puede entrar nunca**, y el mensaje dice "credenciales inválidas" |
| `email.toLowerCase()` en JavaScript | Peor que lo anterior y más difícil de reproducir: `lower()` de Postgres depende de la colación, `toLowerCase()` es Unicode puro |
| Omitir `estado` en el `insert` | El valor por omisión es `'activa'`: una contraseña temporal obtiene una sesión habilitada para todo |
| Omitir `expira_absoluto` en una sesión pendiente | Hereda **30 días** del valor por omisión: una sesión sin identidad probada, viva un mes |
| Ramas 2 y 3 invertidas | Quien creó la cuenta —y conoce la contraseña temporal— puede **inscribir su dispositivo en la cuenta de otro** |

## Tres cosas que descubrió correr las pruebas, no leerlas

1. **El registro de accesos es inmutable de verdad, y hasta para el superusuario.** Primero
   un `42501` desde `app_identidad` —la migración 005 otorga solo `insert, select`—, y después
   *"La tabla auditoria_accesos es de solo inserción"* desde `postgres`: hay un disparador,
   `identidad.evitar_mutacion()`, además del permiso. Consecuencia práctica: **no hay limpieza
   posible**, así que el freno por origen se prueba con una dirección nueva en cada corrida.
   Con una dirección fija, la segunda corrida de la suite arrancaría ya frenada y habría que
   esperar quince minutos para volver a correrla.

2. **`app_identidad` no puede borrar usuarios.** Tiene `insert`, `select` y `update`, y no
   `delete`. No es un olvido: un usuario se **desactiva**, no se borra (`05` § 6), así que el
   rol de la aplicación no tiene por qué poder borrarlo.

3. **Una invariante de la Etapa 1 atrapó un error de mis pruebas.** El primer fixture asignaba
   `superadministrador` a un usuario de `alfa` y la base contestó *"Ese rol solo existe en la
   organización principal"*. Es exactamente la barrera contra la escalada entre inquilinos que
   la Etapa 1 escribió, funcionando sobre código que no era de producción.

Y una que descubrió el diagnóstico: la primera corrida falló a mitad de camino y dejó usuarios
sembrados, así que **la segunda falló por el residuo y no por el defecto**. Los fixtures ahora
borran antes de crear. Una prueba que envenena la corrida siguiente hace que el diagnóstico
deje de ser el problema.

## Decisiones que la especificación **no toma**

1. **El contador de intentos NO vuelve a cero al bloquear.** El `07` § 3 lo plantea como una
   decisión con dos salidas: *"si el contador vuelve a cero, cuando el bloqueo vence el atacante
   tiene otra tanda limpia. Si no vuelve a cero, hay que decidir cuándo se limpia o el bloqueo
   se vuelve permanente."* Se limpia **solo con un login exitoso**, y no se vuelve permanente
   porque `bloqueado_hasta` es una fecha.

2. **Los topes: 5 intentos / 15 minutos por cuenta, 20 fallos / 15 minutos por origen.** Los
   documentos no dan números. El de origen es cuatro veces el de cuenta a propósito: si fueran
   iguales, el freno por cuenta saltaría siempre primero y el de origen no frenaría nada.

3. **El freno por origen falla ABIERTO.** Es la única excepción a "fallar cerrado" de todo el
   sistema, y es deliberada: un error al contar dejaría afuera a todo el mundo a la vez. Un
   freno que se rompe y no frena es mejor que uno que se rompe y bloquea a todos.

4. **La dirección de origen sale de una cabecera nombrada en el entorno
   (`CABECERA_DIRECCION_REAL`), y no hay respaldo.** El `08` § 5.4 dice *"el valor que tu
   plataforma garantiza"* y deja la plataforma abierta. Sin la variable, el freno por origen
   queda desactivado **ruidosamente** en vez de contar sobre `x-forwarded-for`, que el cliente
   controla — y ahí las dos consecuencias del `08` § 5.4 son evasión total **y** poder bloquear
   a un tercero a voluntad.

5. **Tres códigos de rechazo nuevos, ninguno en la especificación:**
   `credenciales_invalidas` (401), `cuenta_bloqueada` (429) y `demasiados_intentos` (429). Y
   `hayQueVolverAEntrar()` del cliente HTTP pasó a mirar el **código** y no el estado: si mirara
   `estado === 401`, una contraseña mal tipeada sería indistinguible de "se te venció la sesión"
   para todo el frontend.

6. **La acción de auditoría del freno por origen es propia (`freno_por_origen`).** El `07` § 3
   prohíbe reusar `login_fallido` —el contador cuenta exactamente esa acción, así que el rechazo
   alimentaría su propio contador— pero no da nombre alternativo.

7. **El tipo `Detalle` de la auditoría es CERRADO.** Tres campos nombrados, sin índice abierto.
   La fila ⛔ dice *"ningún archivo pasa el cuerpo a la función de registro"*; acá pasarle el
   cuerpo **no compila**. Y `console.*` está prohibido en toda `app/api/auth/**`, no solo con el
   cuerpo: un `console.log(cuerpo)` está a un carácter de un `console.log(algo)`.

8. **El cambio de contraseña cierra las demás sesiones del usuario.** No está escrito. Cambiar
   la contraseña es lo que hace alguien que sospecha que le entraron; dejar las otras sesiones
   vivas lo volvería inútil.

9. **El señuelo es una constante del código, no una variable de entorno.** El `02` § 4 escribe
   *"salt fijo"*, y no es un secreto: es el hash de una contraseña que nadie conoce. Derivarlo en
   el arranque costaría ~100 ms por arranque en frío, para nada.

## Lo que la Etapa 4 **no** hace, y por qué

**Los tres endpoints del segundo factor no están.** No es un olvido: `identidad.usuarios_
segundo_factor.secreto_cifrado` es `text not null`, y tanto el `08` § 10 como el comentario de
la migración 006 exigen cifrarlo **con la clave maestra** — que es la Etapa 6.

Lo que sí está, y es la parte que las filas ⛔ piden: el login **calcula el estado** mirando si
el segundo factor está confirmado y si algún rol lo exige, y el portero corta. `ADR-0413` está
verde y probada por mutación.

Consecuencia que hay que decir de frente: **el rol de plataforma no puede usar la aplicación
todavía.** El fundador entra, recibe `debe_configurar_2fo`, y desde ahí solo puede consultar y
cerrar su sesión. Eso es *exactamente* lo que `EJECUCION` § 3 manda —*"segundo factor
obligatorio para el rol de plataforma"*— así que es comportamiento correcto, no un defecto. Pero
significa que la etapa que le dé salida a ese estado necesita **dos funciones de la Etapa 6**:
`claveMaestra()` y `cifrar`/`descifrar`. `EJECUCION` § 6 dice que eso se pregunta, no se decide
solo.

Tampoco hay: pantallas, cliente de login en la interfaz, ni sesiones visibles y revocables por
el usuario (fuera de alcance por `EJECUCION` § 7).

## Pendientes

1. **La decisión del segundo factor**, arriba. Es la única cosa que le falta a esta etapa.
2. **`DOMINIO_ESPERADO` y `CABECERA_DIRECCION_REAL` en Vercel.** Sin la primera, el portero
   rechaza toda petición que modifica —incluido el login—. Sin la segunda, el freno por origen no
   frena.
3. **El proveedor de PostgreSQL administrado.** Bloqueante para desplegar desde la Etapa 3.
4. **Protección de rama en `main`** con `verificar` requerido.
5. **`ultimo_acceso_el` tiene un solo autor y ya se sella**, pero nadie lo lee todavía. El
   `07` § 6 avisa que una marca que nadie actualiza *"se lee como un hecho"*; el caso inverso
   —una marca que nadie lee— es solo trabajo sin cobrar, y se cobra en la Etapa 5.
