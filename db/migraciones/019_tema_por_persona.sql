-- La preferencia de tema, por persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EN LA BASE Y NO EN EL NAVEGADOR
--
-- Porque lo que se pidió es que la preferencia **sobreviva a cerrar sesión y volver a entrar**, y
-- `localStorage` no lo hace: vive en un navegador y en un perfil. La misma persona en la máquina de
-- la oficina y en la de su casa vería dos temas distintos, y quien limpia los datos del navegador
-- —o entra en una ventana privada— pierde la preferencia sin haber pedido nada.
--
-- El navegador SÍ guarda una copia, y eso está en `app/tema.ts`: es una CACHÉ para que el primer
-- pintado no destelle, no la verdad. La verdad es esta columna.
--
-- ── VA EN `usuarios` Y NO EN UNA TABLA PROPIA ────────────────────────────────
--
-- Una tabla `preferencias(usuario_id, clave, valor)` es la salida «flexible» y acá sería peor: son
-- dos valores posibles de una sola pregunta, la escribe la misma persona que la lee, y no tiene
-- historia. Una tabla aparte agrega una consulta a CADA resolución de sesión —que corre en cada
-- petición— para traer una palabra. El día que haya una segunda preferencia se discute de nuevo;
-- con una, esto es una columna.
--
-- ── EL `default` NO ES NEUTRAL, Y HAY QUE DECIRLO ────────────────────────────
--
-- `'oscuro'` porque es **lo que la aplicación es hoy**: no existe el tema claro hasta esta etapa, así
-- que cualquier otro valor por omisión le cambiaría el aspecto, sin avisar, a toda la gente que ya
-- está trabajando. Quien quiera claro lo elige una vez y queda.
--
-- ── LOS PERMISOS YA ESTÁN, Y ESO SE COMPRUEBA, NO SE SUPONE ──────────────────
--
-- `002_organizaciones_y_usuarios.sql:182` otorga `select, insert, update` sobre la TABLA a
-- `app_identidad`, y un privilegio de tabla alcanza a las columnas que se agreguen después. Medido
-- contra `information_schema.column_privileges` antes de escribir esto.
--
-- El rol del inquilino es otra historia: sus privilegios son POR COLUMNA (`grant select (id, org_id,
-- nombre, email, activo)`), así que esta columna le queda invisible. Es lo correcto y es deliberado:
-- el tema se lee y se escribe por el camino de identidad, que es el único que sabe quién sos.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios
  add column if not exists tema text not null default 'oscuro';

-- `check` y no un tipo enumerado, con el mismo criterio que la 017: un `enum` de PostgreSQL no se
-- puede reducir nunca y su ampliación no es transaccional en todas las versiones. Un `check` se
-- reemplaza con dos sentencias de DDL en cualquier entorno.
--
-- Y la lista cerrada acá SÍ contiene: si alguien escribe 'sepia', la escritura falla en vez de
-- guardarse y dejar a esa persona con un atributo que ninguna hoja de estilo conoce — o sea, con la
-- paleta del prototipo y sin forma de entender por qué.
alter table identidad.usuarios
  drop constraint if exists usuarios_tema_check;

alter table identidad.usuarios
  add constraint usuarios_tema_check check (tema in ('oscuro', 'claro'));

comment on column identidad.usuarios.tema is
  'Preferencia de tema de esta persona. Sobrevive a cerrar sesión porque vive acá y no en el '
  'navegador. `oscuro` por omisión, que es lo que la aplicación era antes de que el claro existiera.';
