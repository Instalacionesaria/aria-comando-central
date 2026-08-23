-- El segundo factor pasa de OBLIGATORIO a OPCIONAL.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ CAMBIA, Y QUÉ NO
--
-- Cambia una cosa: **nadie queda encerrado teniendo que configurar un segundo factor
-- para poder entrar.** El estado `debe_configurar_2fo` deja de ser alcanzable desde el
-- login (ver `lib/autenticacion/estado.ts`).
--
-- NO cambia nada más, y eso es deliberado:
--
--   · Las tres rutas del segundo factor siguen existiendo y funcionando. Quien QUIERA
--     activarlo puede.
--   · Y si alguien lo activa, **se le sigue exigiendo en cada login**: la rama 1 de
--     `estadoQueCorresponde` no se toca. Un factor confirmado y sin verificar en esta
--     sesión sigue dando `pendiente_2fo`. O sea que opcional significa opcional de
--     activar, no opcional de cumplir.
--   · La columna `identidad.roles.exige_segundo_factor` se queda. Es la perilla para
--     volver a exigirlo por rol el día que se quiera, y borrarla sería una puerta de
--     una sola dirección.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ SE CAE UNA INVARIANTE, DICHO SIN ADORNOS
--
-- La restricción que se quita abajo decía esto, y sigue siendo cierto:
--
--   "Todo rol de plataforma exige segundo factor. Es una INVARIANTE, no una
--    convención: ese rol ve los datos de TODAS las organizaciones, y una contraseña
--    filtrada sin segundo factor es una brecha de todos los clientes a la vez."
--
-- Se quita a pedido explícito de quien decide el producto, y lo que se acepta es
-- exactamente lo que ese párrafo describe: el `superadministrador` —la cuenta que puede
-- mirar cualquier organización— queda protegida solo por su contraseña.
--
-- Lo que SIGUE en pie del otro lado, para que el riesgo quede medido y no vago:
--
--   · el freno por cuenta corta a los cinco intentos fallidos y bloquea quince minutos;
--   · el freno por origen corta a los veinte;
--   · la contraseña se guarda con `scrypt` (N=16384), así que un volcado no se lee
--     directo;
--   · el cambio de organización del rol de plataforma queda registrado en la auditoría,
--     con la organización visitada, y la señal 5 de la vigilancia lo cuenta.
--
-- O sea: adivinar la contraseña por la puerta de entrada sigue siendo impracticable. Lo
-- que se pierde es la defensa contra una contraseña YA filtrada — correo, reuso,
-- teclado capturado. Ahí el segundo factor era lo único que quedaba.
--
-- Para volver atrás: reponer esta restricción y devolver la rama 3 de
-- `lib/autenticacion/estado.ts`. Las dos cosas están escritas para que el camino de
-- vuelta sea corto.
-- ═════════════════════════════════════════════════════════════════════════════

-- `if exists` porque una base que nunca tuvo la 003 —imposible hoy, pero el corredor
-- no lo garantiza— no tendría la restricción, y una migración que falla por algo que ya
-- está como se quiere es una migración que hay que ir a arreglar a mano.
alter table identidad.roles
  drop constraint if exists roles_plataforma_exige_2fo;

-- El comentario de la columna, actualizado. No es adorno: es lo que va a leer quien
-- consulte el catálogo dentro de un año y quiera saber si esto se aplica.
-- Y hay que decir la verdad incómoda: **la fila del superadministrador sigue diciendo
-- `true`**, porque una migración NO puede cambiarla. `identidad.roles` tiene el forzado
-- de RLS encendido desde la 003 y `migrador` no tiene política, así que un `update` acá
-- afectaría cero filas SIN ERROR — el defecto que `ADR-0210` existe para atrapar.
--
-- Así que el dato queda como está y **el código deja de leerlo**. La columna pasa a ser
-- reservada: no miente sobre lo que pasa, porque este comentario dice qué la lee (nada).
comment on column identidad.roles.exige_segundo_factor is
  'RESERVADA desde la migración 010. El login NO la lee: `estadoQueCorresponde` dejó de '
  'forzar la configuración del segundo factor. La fila del rol de plataforma sigue en '
  'verdadero por historia —una migración no puede cambiarla, RLS forzada sin política '
  'para migrador— y eso no tiene efecto. Para volver a exigirlo hay que reponer la rama 3 '
  'de lib/autenticacion/estado.ts y la restricción roles_plataforma_exige_2fo.';
