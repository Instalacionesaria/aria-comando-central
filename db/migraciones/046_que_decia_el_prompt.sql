-- Qué decía el prompt. **Las versiones que se pisan y hoy desaparecen.**
-- ============================================================================
--
-- `negocio.prompts_del_agente` tiene `unique (org_id, agente)`: UNA fila por agente. Así que
-- `guardarPromptDelAgente` pisa el texto con `on conflict … do update`, y si el texto llega vacío un
-- `delete` se lleva la fila entera — texto, autor y fecha. **El texto anterior desaparece.**
--
-- Mientras tanto el auditor sella `prompt_hash` en CADA hallazgo y en CADA análisis, y la pantalla
-- del técnico compara ese hash contra el del prompt de hoy para avisar «el prompt cambió desde que
-- se diagnosticó esto».
--
-- O sea que el sistema **detecta el cambio y no puede mostrar cuál era**. El aviso manda a mirar un
-- texto que ya no existe en ninguna parte. Toda esa pantalla existe para que alguien ajuste prompts,
-- y la pregunta que la justifica —*«¿el ajuste del martes mejoró algo?»*— no tiene con qué
-- contestarse. Lo poco que sobrevive no alcanza: de la versión vieja queda
-- `hallazgos.fragmento_prompt`, que es una cita PARCIAL y que el carril amarillo deja nula siempre.
-- El hash son 16 hex de sha256 y no se invierte. Recuperable hoy: cero.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- SE ARCHIVA LA VERSIÓN QUE **SALE**, Y ESO DISUELVE EL PROBLEMA DEL RELLENO
--
-- La forma obvia —escribir una fila nueva cada vez que se guarda— choca de frente con la regla de la
-- `040`: una migración no puede rellenar datos de inquilino, porque `negocio.*` tiene `force row
-- level security` sin política para `migrador` y un `insert` desde acá vería CERO filas e informaría
-- éxito sin escribir nada. O sea que el prompt que hoy está cargado nunca entraría al historial, y
-- habría que inventar un guion aparte para sembrarlo.
--
-- Archivando la que sale, ese problema no existe: **el texto vigente sigue vivo e íntegro en
-- `prompts_del_agente`**, con su fecha y su autor, hasta el instante en que alguien lo pise — y ese
-- instante es justamente cuando esta tabla lo recibe. No hay nada que rellenar.
--
-- La consecuencia hay que decirla, porque invierte la lectura natural de una tabla vacía: **vacía NO
-- significa «nunca hubo prompt»**, significa «todavía nadie pisó nada».
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ UN DISPARADOR Y NO DOS LÍNEAS EN `guardarPromptDelAgente`
--
-- Hoy hay UN solo escritor, medido: `insertInto('prompts_del_agente'` y `deleteFrom(` aparecen en
-- `lib/auditor/prompts.ts` y en ningún otro lugar de `lib/`, `app/`, `scripts/` ni `db/sembrado/`.
-- Archivar ahí sería más corto, así que hay que decir qué compra el disparador. Compra dos cosas, y
-- la segunda es la que decide.
--
-- 1 · **La captura no depende de acordarse.** El día que aparezca un segundo camino de escritura
--     —una importación, un relleno, una corrección a mano un domingo— un historial escrito en
--     TypeScript se queda mudo y nada falla. Es la doctrina que la `011` ya dejó escrita para el
--     sello del setter: *«Va en un disparador y no en un condicional del código porque un `update`
--     que lo pise **no falla**, y quien pierde la comisión no se entera.»*
--
-- 2 · **Hacerlo en TypeScript reintroduce una carrera que pierde una versión entera.** Archivar
--     desde el código obliga a leer la fila antes de pisarla: `select` → `insert en el historial` →
--     `upsert`. En `READ COMMITTED`, dos ediciones simultáneas leen la misma V0, las dos archivan V0,
--     la primera escribe B, la segunda se desbloquea y pisa B con C. **B estuvo vigente, se pisó, y
--     no quedó archivado en ninguna parte** — que es letra por letra el defecto que esta migración
--     viene a arreglar, reaparecido un nivel más adentro. Un `for update` tapa el caso «había fila» y
--     no tapa el caso «no había fila»: dos primeros guardados a la vez insertan los dos, el `on
--     conflict` deja uno, y el texto del perdedor no queda en ningún lado.
--
--     El disparador no tiene nada de eso: ve `old` DENTRO del mismo enunciado, bajo el bloqueo de
--     fila que el `upsert` ya tomó. Es atómico y libre de carrera por construcción, no por acordarse
--     de poner un `for update`.
--
-- **Lo que el disparador cuesta, dicho en voz alta:** es un escritor que no aparece en ningún `grep`
-- del TypeScript. Se paga con un comentario en `guardarPromptDelAgente` que nombra esta migración, y
-- con una prueba que archiva desde un `update` CRUDO —sin pasar por la función— que es exactamente
-- lo que ninguna versión en TypeScript podría prometer.
-- ═════════════════════════════════════════════════════════════════════════════

-- El hash, en la base. Es la misma receta que `hashDelPrompt` en TypeScript: sha256 del texto
-- recortado, en hexadecimal, cortado a 16. Existe para que el disparador pueda calcularlo de
-- `old.texto` en vez de copiar `old.prompt_hash`.
--
-- La diferencia importa: copiar la columna propagaría al archivo un hash que ya podía estar torcido,
-- y el lector —que verifica— convertiría una versión que SÍ está guardada en un «no se encontró».
-- Calculándolo del texto, el hash del archivo es siempre función del texto del archivo, y esa
-- mentira es inexpresable.
create or replace function negocio.hash_del_prompt(p_texto text) returns text as $hash$
  select substr(encode(sha256(convert_to(btrim(p_texto), 'UTF8')), 'hex'), 1, 16);
$hash$ language sql immutable strict;

revoke all on function negocio.hash_del_prompt(text) from public;

-- Y SE OTORGA AL ROL DEL INQUILINO, que es lo que los otros disparadores de este repositorio no
-- necesitan y éste sí. La 013 dejó escrito por qué a ellos les alcanza: *«ninguna de las dos necesita
-- `security definer`: `aplicar_aislamiento` otorga las cuatro operaciones sobre las tablas de
-- negocio»*. Pero eso habla de TABLAS. Ésta es la primera función disparadora del proyecto que llama
-- a otra función, y el permiso de ejecución de esa otra se comprueba contra quien corre la sentencia
-- —`app_inquilino`—, no contra el dueño del disparador.
--
-- Medido: sin este `grant`, guardar un prompt falla con `permission denied for function
-- hash_del_prompt`. Y falla en la cara de una persona editando, porque el disparador corre dentro de
-- su transacción.
--
-- Otorgar es seguro, y es la opción correcta frente a `security definer`: esta función es PURA
-- —recibe texto, devuelve texto, no toca ni una tabla— así que no hay privilegio que escalar.
-- `security definer` sobre algo que no lee datos sería pagar una superficie de ataque por nada.
grant execute on function negocio.hash_del_prompt(text) to app_inquilino;

create table if not exists negocio.versiones_del_prompt (
  org_id uuid not null references identidad.organizaciones(id) on delete cascade,
  id     uuid not null default gen_random_uuid(),

  -- La misma lista cerrada que `prompts_del_agente`, por el motivo que la 027 dejó escrito: encender
  -- un auditor que gasta plata tiene que aparecer en un diff que alguien mire. Se repite como columna
  -- plana —no se lee del padre— porque el padre se borra.
  agente text not null,

  -- EL TEXTO. No un diff, no una huella: el texto. `hallazgos.fragmento_prompt` ya demostró que una
  -- cita parcial no reconstruye nada.
  --
  -- Se guarda tal cual estaba en la fila viva, sin normalizar, por la misma razón que la 028 guarda
  -- el prompt literal: el auditor cita fragmentos EXACTOS de ese texto para que el reemplazo que
  -- propone se pueda pegar donde va, y tocar los espacios acá haría que la cita de un hallazgo viejo
  -- no se encuentre en la versión que se le muestra.
  texto text not null,

  -- El hash que esta versión tenía cuando regía. **Es un índice de búsqueda, no una afirmación.**
  -- El lector no le cree: recalcula el hash del texto y descarta la fila si no reproduce el hash por
  -- el que buscó. El defecto que esa verificación previene es el peor de todos —mostrarle a un
  -- hallazgo el texto de OTRA versión— y la degradación es la segura: una columna pisada a mano hace
  -- que una versión no se encuentre, nunca que se atribuya un texto ajeno.
  prompt_hash text not null,

  -- ── EL TRAMO: DESDE CUÁNDO Y HASTA CUÁNDO CORRIÓ ESTE TEXTO ───────────────
  --
  -- `vigente_desde` es el `actualizado_el` de la fila que se está yendo — el dato REAL de cuándo ese
  -- texto empezó a correr, que sigue entero en la fila viva hasta el instante en que se la pisa.
  --
  -- Son DOS fechas y no una por un defecto concreto: con una sola habría que derivar el comienzo de
  -- cada versión de la fila anterior, y esa derivación **miente exactamente cruzando un borrado**. Si
  -- el prompt se borró el 3 y se volvió a cargar el 10, derivar diría que el texto nuevo corría desde
  -- el 3 — tapando la semana en que el agente trabajó SIN prompt, que es justo la semana en la que
  -- los análisis salieron con `prompt_hash` nulo.
  --
  -- ── Y LAS DOS SALEN DEL MISMO RELOJ, QUE ES LA MITAD DEL ASUNTO ──────────
  --
  -- `reemplazada_el` lo pone `now()` de la base, y `guardarPromptDelAgente` escribe `actualizado_el`
  -- también con `now()`. Como el disparador corre dentro de la misma transacción que el `upsert`,
  -- `now()` —que es la hora de INICIO de la transacción— es el MISMO instante en los dos: el momento
  -- en que una versión deja de regir y el momento en que empieza la siguiente coinciden, y la línea
  -- de tiempo queda contigua y medio abierta **por construcción**.
  --
  -- Con dos relojes —la aplicación en Vercel, la base en Supabase— cada costura tendría un desfase de
  -- signo desconocido: o tramos SOLAPADOS, y entonces «¿qué corría el martes a las 15?» devuelve dos
  -- filas, o huecos falsos. No es un borde raro: es la única pregunta que esta tabla existe para
  -- contestar.
  --
  -- Y NO hay `check (reemplazada_el >= vigente_desde)`, que parece gratis y no lo es: este `insert`
  -- vive DENTRO de la transacción que guarda el prompt, así que un `check` que salte **aborta la
  -- edición de una persona**. Y puede saltar sin que nadie haya hecho nada malo — una prueba de este
  -- repositorio retrocede `actualizado_el` a 2020 a mano, que es la clase de fila que produce un
  -- mantenimiento. El lector ordena y no supone monotonía.
  vigente_desde  timestamptz not null,
  reemplazada_el timestamptz not null default now(),

  -- ── LOS DOS ACTORES ───────────────────────────────────────────────────────
  --
  -- `puesta_por` = quién había dejado esta versión (el autor del TEXTO). `sacada_por` = quién la
  -- reemplazó o la borró.
  --
  -- **Sin clave foránea a `identidad.usuarios`, a diferencia de la tabla viva**, y es a propósito: un
  -- historial cuya fila se puede volver inescribible porque se dio de baja a una persona deja de ser
  -- un historial. La tabla viva puede permitírselo porque su fila se puede corregir; ésta no se
  -- corrige nunca. Quien lea estos identificadores tiene que tolerar que no resuelvan.
  puesta_por uuid,
  sacada_por uuid,

  -- Qué pasó con esta versión: la reemplazó otra, o el prompt quedó vacío. Es la única forma de
  -- distinguir «se editó» de «se apagó el prompt de referencia», y son dos hechos muy distintos para
  -- quien lea la línea de tiempo.
  que_siguio text not null,

  primary key (org_id, id),

  constraint versiones_del_prompt_agente_check
    check (agente in ('chat_post_agenda', 'chat_pre_agenda')),

  -- El mismo `check` que la tabla viva: una versión archivada en blanco no es una versión, es una
  -- fila que alguien escribió mal.
  constraint versiones_del_prompt_texto_no_vacio
    check (btrim(texto) <> ''),

  constraint versiones_del_prompt_que_siguio_check
    check (que_siguio in ('otra_version', 'nada'))
);

-- Por hash: es como el lector resuelve el `prompt_hash` de un hallazgo viejo a su texto.
create index if not exists versiones_del_prompt_por_hash
  on negocio.versiones_del_prompt (org_id, agente, prompt_hash);

-- Por fecha: es como se dibuja la línea de tiempo de un agente.
create index if not exists versiones_del_prompt_por_fecha
  on negocio.versiones_del_prompt (org_id, agente, reemplazada_el desc);

-- ── EL ARCHIVADOR ───────────────────────────────────────────────────────────
create or replace function negocio.archivar_version_del_prompt() returns trigger as $archivar$
declare
  v_sacada_por uuid;
begin
  /* ── LA GUARDA, Y POR QUÉ NO ES `current_user` ────────────────────────────
   *
   * Lo único que hay que dejar pasar sin archivar es el borrado EN CASCADA de la organización: ahí
   * las filas no se están «reemplazando», se está yendo la empresa entera, y archivar produciría
   * filas huérfanas que la propia cascada va a borrar a continuación.
   *
   * `pg_trigger_depth()` expresa exactamente eso: un `delete` directo —de quien sea— corre a
   * profundidad 1; el que llega por la cascada de integridad referencial corre dentro del disparador
   * de esa cascada, o sea a profundidad 2 o más.
   *
   * La alternativa tentadora —`current_user <> 'app_inquilino'`— invierte la doctrina de la casa, que
   * este repositorio tiene escrita: los disparadores *«no existen para detener a la aplicación;
   * existen para detener lo que NO pasa por la aplicación … una sentencia a mano un domingo»*. Con
   * `current_user`, el domingo pasa mudo, un guion corrido como `migrador` pasa mudo, y el día que el
   * rol se renombre habría una cuarta copia de ese nombre —en SQL— sin nada que la cruce con las
   * otras. */
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  /* Quién la sacó. En un `update` es el autor de la versión nueva, que está en la fila entrante. En
     un `delete` no hay fila entrante y el enunciado no lleva autor, así que viaja por una variable de
     transacción que pone el llamador — ver `guardarPromptDelAgente`. Ausente ⇒ nulo, que es la
     degradación segura: «no se sabe quién» en vez del nombre equivocado. */
  if tg_op = 'DELETE' then
    v_sacada_por := nullif(btrim(coalesce(current_setting('app.quien_toca_el_prompt', true), '')), '')::uuid;
  else
    v_sacada_por := new.actualizado_por;
  end if;

  insert into negocio.versiones_del_prompt (
    org_id, agente, texto, prompt_hash,
    vigente_desde, puesta_por, sacada_por, que_siguio
  ) values (
    old.org_id, old.agente, old.texto, negocio.hash_del_prompt(old.texto),
    old.actualizado_el, old.actualizado_por, v_sacada_por,
    case tg_op when 'DELETE' then 'nada' else 'otra_version' end
  );

  return null;
end $archivar$ language plpgsql;

revoke all on function negocio.archivar_version_del_prompt() from public;

drop trigger if exists prompts_del_agente_archiva_al_pisar  on negocio.prompts_del_agente;
drop trigger if exists prompts_del_agente_archiva_al_borrar on negocio.prompts_del_agente;

/* El `when` es el tirante del `where` que lleva el `on conflict` en TypeScript: si el texto no
   cambió, no hay versión que archivar. Los dos a la vez y a propósito — es el mismo idiom que la 013
   ya usa: uno es el cinturón y el otro el tirante. */
create trigger prompts_del_agente_archiva_al_pisar
  after update on negocio.prompts_del_agente
  for each row
  when (old.texto is distinct from new.texto)
  execute function negocio.archivar_version_del_prompt();

create trigger prompts_del_agente_archiva_al_borrar
  after delete on negocio.prompts_del_agente
  for each row
  execute function negocio.archivar_version_del_prompt();

drop policy if exists aislamiento on negocio.versiones_del_prompt;
select negocio.aplicar_aislamiento('negocio.versiones_del_prompt');

comment on table negocio.versiones_del_prompt is
  'Las versiones SUPERADAS del prompt de cada agente: el texto que se pisó o se borró, con desde '
  'cuándo regía, quién la puso y quién la sacó. La escribe un disparador sobre '
  'negocio.prompts_del_agente, no el código. La versión VIGENTE no está acá: vive en '
  'prompts_del_agente hasta que alguien la cambie, y por eso TABLA VACÍA NO SIGNIFICA «nunca hubo '
  'prompt» — significa que todavía nadie pisó nada. Un hash que no resuelva ni acá ni en la fila viva '
  'significa «esa versión es anterior a esta tabla», nunca «no había prompt».';

comment on column negocio.versiones_del_prompt.prompt_hash is
  'Índice de BÚSQUEDA, no una afirmación. Lo calcula el disparador con negocio.hash_del_prompt(texto), '
  'y el lector igual lo verifica recalculándolo: una columna torcida hace que una versión no se '
  'encuentre, nunca que se le atribuya a un hallazgo el texto de otra versión.';
