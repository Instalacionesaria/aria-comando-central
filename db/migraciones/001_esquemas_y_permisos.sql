-- Los dos esquemas y la regla de permisos por omisión.
--
-- Fuente: 09-ESCOTILLA-Y-ESTADOS § 2. Corre como `migrador`.
--
-- SON DOS ESQUEMAS, NO TRES. EJECUCION § 2 y § 3 cierran la decisión: el esquema
-- `comun` NO se crea, y con él desaparece "su agujero por exclusión". PRUEBAS
-- § Etapa 0 dice "tres esquemas" — es prosa vieja, y por la regla de precedencia
-- del § 4 gana EJECUCION.
--
-- POR QUÉ DOS Y NO UNO, que es la parte que no es organizativa: toda migración
-- necesita que las tablas nuevas queden accesibles para la aplicación, y las dos
-- formas de conseguirlo son GLOBALES POR ESQUEMA (`alter default privileges` y
-- `grant … on all tables in schema …`). Con las tablas de identidad en el mismo
-- esquema que las de negocio, esas dos líneas le darían al rol del inquilino
-- MODIFICACIÓN Y BORRADO sobre las sesiones, los roles y la auditoría: el hash de
-- las contraseñas a su alcance y la auditoría "inmutable" borrable. Y
-- `revoke … from public` no lo compensa: revoca del pseudo-rol público, no del rol
-- al que se acaba de otorgar.

create schema if not exists identidad;
create schema if not exists negocio;

-- `usage` NO da acceso a las tablas: solo permite nombrarlas.
grant usage on schema negocio   to app_inquilino;
grant usage on schema identidad to app_identidad;
-- El inquilino necesita NOMBRAR unas pocas tablas de identidad —organizaciones y
-- usuarios, para mostrar autores y listas— y solo ésas. El acceso real lo dan los
-- permisos por tabla y por columna de la migración siguiente.
grant usage on schema identidad to app_inquilino;

-- ─────────────────────────────────────────────────────────────────────────────
-- La regla por omisión, SOLO sobre `negocio`, y NOMBRANDO el rol que crea las
-- tablas.
--
-- `for role migrador` no es decorativo: la regla es por rol efectivo al crear el
-- objeto y NO SE HEREDA. Si el rol que migra fuese miembro de otro y la regla
-- estuviera escrita para ese otro, las tablas nuevas no recibirían nada — y el
-- síntoma sería "permiso denegado" en la primera consulta a la primera tabla
-- nueva, ya desplegada.
-- ─────────────────────────────────────────────────────────────────────────────

alter default privileges for role migrador in schema negocio
  grant select, insert, update, delete on tables to app_inquilino;
alter default privileges for role migrador in schema negocio
  grant usage, select on sequences to app_inquilino;

-- Y sobre `identidad`, NINGUNA regla por omisión. A propósito: cada tabla de ese
-- esquema se otorga a mano, y una tabla nueva ahí nace SIN ACCESO PARA NADIE hasta
-- que alguien escriba el grant. Es el comportamiento que se quiere — el fallo
-- aparece en la primera prueba, no en producción.

-- ─────────────────────────────────────────────────────────────────────────────
-- El cinturón además del tirante (09 § 2): permisos explícitos e idempotentes al
-- final de toda migración, acotados al esquema de negocio.
--
-- NUNCA `in schema identidad`, y nunca sobre un esquema donde vivan las dos cosas
-- juntas. Hoy no hay ninguna tabla en `negocio`, así que estas dos líneas no hacen
-- nada — y están igual, porque el hábito es lo que sobrevive.
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on all tables    in schema negocio to app_inquilino;
grant usage, select                  on all sequences in schema negocio to app_inquilino;
