-- Cuándo cambió de zona un contacto. **El único dato pendiente que no se puede recuperar.**
-- ============================================================================
--
-- `negocio.contactos.territorio` es un espejo del CRM y se pisa en cada pasada: el `do update` de
-- `sincronizar.ts` lo reescribe, y `congelarLosQueYaNoEstan` lo pone en NULL en masa cuando un
-- contacto pierde las dos etiquetas de zona. Nada guarda que el cambio ocurrió.
--
-- Y a diferencia de todo lo demás que este proyecto tiene pendiente, **esto no se puede volver a
-- pedir**: GoHighLevel tampoco guarda historia de etiquetas — medido y escrito en
-- `lib/ghl/cliente.ts`: *«las etiquetas del CRM nadie las quita»*. Las citas fuera de la ventana, el
-- `dateAdded` de los contactos, los campos del CRM: todo eso sigue allá y se trae cualquier día. Esto
-- no. Cada día sin guardarlo es un día que no vuelve.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ VALE LA PENA GUARDAR, Y QUÉ NO — porque no es todo
--
-- **1 · EL CONGELAMIENTO vale, y es lo único sin ningún otro testigo.**
-- `congelarLosQueYaNoEstan` escribe `territorio = null` y **a propósito no toca las etiquetas**. Así
-- que no hay cita que lo feche, no hay etiqueta que lo nombre, y el conteo de congelados vive sólo en
-- la respuesta HTTP del cron, que nadie guarda. De los 25 contactos sin territorio de hoy **no se
-- puede distinguir un ex-closer congelado —un lead que ya estaba en la agenda— de un ex-setter**, y
-- son dos hechos muy distintos. El destinatario ya está escrito en `sincronizar.ts`: *«El closer ve
-- bajar su cartera y no tiene dónde mirar por qué.»*
--
-- Y el derivado que parecía taparlo se destruye al mirarlo: `guardar()` escribe `sincronizado_el =
-- now()` SIEMPRE, y `refrescarUnContacto` corre en CADA apertura de ficha sin ninguna puerta de
-- frescura. O sea que **abrir la ficha de un congelado borra la evidencia de cuándo se congeló**, y
-- se rompe primero en los contactos que alguien miró — que son exactamente aquellos sobre los que
-- alguien iba a preguntar.
--
-- **2 · EL ALTA vale, porque es el único piso que la regla de la 040 permite tener.** Una migración
-- no puede rellenar `negocio.*`. Sin una fila por alta, «no hay fila» sería ambiguo entre «nació sin
-- zona» y «es anterior a esta migración». Con ella, la ausencia significa exactamente una cosa.
--
-- **3 · EL CRUCE setter→closer vale MENOS de lo que parece, y hay que decirlo.** El traspaso lo hace
-- un automatismo del CRM cuando la cita se crea, y `citas.reservada_el` (migración 043) **ES ese
-- instante**, con el reloj del CRM y sin los hasta diez minutos de desfase del cron. Lo único que
-- esta tabla agrega es independencia de la ventana móvil de citas y de las citas borradas. Se guarda
-- igual porque sale del mismo disparador —costo marginal cero— y porque si no se captura hoy no se
-- captura nunca. Pero el argumento honesto es «es irrecuperable», no «alguien lo va a mirar pronto».
--
-- ── LO QUE SE DEJA AFUERA, Y SON DECISIONES ─────────────────────────────────
--
-- **Las etiquetas crudas archivadas.** Parecen la simetría obvia y son una trampa medida. En el
-- camino del congelado, `congelarLosQueYaNoEstan` NO toca `etiquetas`, así que la fila más valiosa de
-- esta tabla tendría los dos conjuntos IDÉNTICOS y los dos diciendo `zona_closer`: una fila que
-- afirma «salió de la zona» cargando la prueba de que sigue adentro.
--
-- Y la promesa de poder rederivar el pasado es falsa donde importa: **en el cron el territorio NO
-- sale de `c.tags`** — sale de qué búsqueda por etiqueta devolvió el contacto (`guardar(c,
-- territorio)` dentro del bucle sobre `ETIQUETAS`), mientras `etiquetas` sí sale de `c.tags`.
-- Rederivar sobre el arreglo archivado y comparar contra el territorio archivado produciría
-- divergencias falsas por construcción.
--
-- **Una columna `paso_a_closer_el` en `contactos`.** Sería de escritura única, o sea que cuando se
-- llena mal se queda mal para siempre: un ida y vuelta `closer → setter → closer` la estampa con una
-- fecha que no es de ningún cruce. Y no es hipotético — la regla de derivación de este repositorio
-- YA estuvo mal una vez (su primera versión hacía que todo contacto del setter naciera congelado) y
-- hoy vive en DOS lugares que nada cruza. Un evento se corrige leyendo; una columna de escritura
-- única, no.
--
-- **Una métrica en pantalla.** La Etapa 2 ya contesta «cuántos agendaron en los últimos 7 días» con
-- `reservada_el`. Dos números para la misma pregunta en dos pantallas es un ticket de soporte.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- EL RUIDO, QUE ES DONDE ESTO SE ARRUINA SOLO
--
-- La sincronización corre **cada diez minutos sobre 584 contactos**, y su `do update` no tiene
-- guarda: `sincronizado_el` cambia siempre, así que las 584 filas se actualizan en cada pasada.
-- **~84.000 actualizaciones por día.** Un historial que escriba de más es un problema peor que el que
-- resuelve.
--
-- Por eso el `when` compara la columna DERIVADA y ESCALAR, y no el arreglo de etiquetas. Medido el
-- 2026-09-13: de 576 contactos con más de una etiqueta, sólo 129 tienen el arreglo ordenado —el 22 %,
-- o sea azar—. **El CRM devuelve las etiquetas en orden arbitrario**, así que un `when` sobre el
-- arreglo dispararía por reordenamientos y fabricaría transiciones que nunca ocurrieron.
--
-- `is distinct from` y no `<>`, y acá es decisivo: `territorio` es nulable, así que con `<>` ni
-- congelar ni descongelar dispararían nunca — que son justo los dos hechos que esta tabla existe para
-- registrar.

create table if not exists negocio.cambios_de_territorio (
  -- Sin `on delete cascade` hacia la organización, a diferencia de la 046 — y las dos están bien.
  -- La 046 heredó la cascada de su tabla padre (`prompts_del_agente`, de la 028); ésta sigue a la
  -- suya: las ocho tablas de la 011, `contactos` incluida, referencian la organización SIN cascada.
  -- Borrar una empresa se frena antes en `contactos`, con el mensaje que `lib/administracion/borrado`
  -- ya tiene escrito para eso.
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  -- Y hacia el contacto SÍ cascada: si el contacto se va, su historia de zonas no le sobrevive a
  -- nadie. Es la clave compuesta, como todo en este esquema.
  contacto_id  uuid not null,

  -- Los dos lados del cambio. Nulables los dos: `territorio` lo es, y el nulo significa cosas
  -- distintas de cada lado — antes nulo es «no había contacto» o «estaba congelado», después nulo es
  -- «se congeló». Lo que los desambigua es `que_paso`.
  territorio_anterior  text,
  territorio_nuevo     text,

  -- Qué clase de hecho fue. Es lo que hace legible la tabla sin tener que interpretar dos nulos.
  --
  -- **SIN `check` de vocabulario sobre los dos territorios**, a propósito: sería una copia del
  -- vocabulario de `contactos.territorio` y, el día que diverjan, abortaría la transacción del cron
  -- en vez de ensuciar una fila. Un historial no puede ser el que frena la ingesta.
  que_paso  text not null,

  -- Cuándo se detectó. Es el instante de ARRANQUE de la pasada entera, no de la fila: `releerContactos`
  -- envuelve las llamadas al CRM, los 584 upserts y el congelado en UNA transacción, y `now()` es la
  -- hora de inicio de la transacción. O sea que todas las filas de una misma pasada comparten sello, y
  -- eso es correcto: lo que se sabe es «entre esta pasada y la anterior», no el segundo exacto.
  detectado_el  timestamptz not null default now(),

  primary key (org_id, id),

  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,

  constraint cambios_de_territorio_que_paso_check
    check (que_paso in ('alta', 'traspaso', 'congelado', 'descongelado'))
);

-- Un solo índice: la pregunta es siempre «la historia de ESTE contacto», y de lo más nuevo a lo más
-- viejo. Un segundo índice sobre `que_paso` esperaría una consulta que todavía no existe.
create index if not exists cambios_de_territorio_por_contacto
  on negocio.cambios_de_territorio (org_id, contacto_id, detectado_el desc);

create or replace function negocio.archivar_cambio_de_territorio() returns trigger as $territorio$
declare
  v_anterior text;
  v_que_paso text;
begin
  /* ── EL `if` EN plpgsql Y NO UN `case` DENTRO DEL `insert` ────────────────
   *
   * En un disparador de INSERT, `old` es un registro **sin asignar**: tocarlo lanza `record "old" is
   * not assigned yet`. Un `case tg_op when 'INSERT' then … else old.territorio end` escrito adentro
   * de la lista de valores parece protegerlo y no lo garantiza — la evaluación perezosa de las ramas
   * de un `case` de SQL no está prometida. Acá se decide en plpgsql, donde el `if` SÍ es control de
   * flujo y `old` sólo se menciona en la rama que existe. */
  if tg_op = 'INSERT' then
    /* El alta. `territorio_anterior` queda nulo y significa «no había contacto», que es un hecho
       distinto de «estaba congelado». Los separa `que_paso`. */
    v_anterior := null;
    v_que_paso := 'alta';
  else
    v_anterior := old.territorio;
    /* El orden de estas tres ramas ES la definición. `congelado` primero porque es el hecho sin otro
       testigo; `descongelado` después, porque a esa altura ya se sabe que el nuevo no es nulo; y
       `traspaso` al final, donde el `when` ya garantizó que los dos difieren y ninguno es nulo.
       SI SE AGREGA UNA CUARTA RAMA hay que agregar su valor al `check` de arriba, EN ESTE MISMO
       ARCHIVO: si no, la primera fila que la use aborta la transacción del cron. */
    if new.territorio is null then
      v_que_paso := 'congelado';
    elsif old.territorio is null then
      v_que_paso := 'descongelado';
    else
      v_que_paso := 'traspaso';
    end if;
  end if;

  insert into negocio.cambios_de_territorio (
    org_id, contacto_id, territorio_anterior, territorio_nuevo, que_paso
  ) values (
    new.org_id, new.id, v_anterior, new.territorio, v_que_paso
  );

  -- `after … for each row` ignora el valor de retorno. Se devuelve `null`, como en la 046.
  return null;
end $territorio$ language plpgsql;

revoke all on function negocio.archivar_cambio_de_territorio() from public;

drop trigger if exists contactos_archiva_el_alta   on negocio.contactos;
drop trigger if exists contactos_archiva_el_cambio on negocio.contactos;

/* ── 1 · EL ALTA, QUE ES EL ANCLA ────────────────────────────────────────────
 *
 * Hace falta un disparador aparte porque **uno de UPDATE no ve el alta**: la rama `do update` de un
 * upsert ejecuta los disparadores de UPDATE y no los de INSERT, y cuando el insert ocurre de verdad
 * pasa lo contrario. Sin esto, la primera zona de un contacto no quedaría archivada nunca y la tabla
 * daría el «hasta cuándo» del primer tramo sin el «desde cuándo».
 *
 * **Sin `when`, a propósito.** Un alta con territorio nulo también se archiva: es la que dice «lo
 * vimos por primera vez, sin zona», y es lo que fija el piso de ese contacto. Filtrarla dejaría a un
 * contacto nacido congelado sin ancla, y su primera zona se leería como un `descongelado` de algo que
 * nunca tuvo. Es lo que hace verdadera la lectura «sin fila de alta ⇒ el contacto es anterior a la
 * 047».
 *
 * Volumen: una fila por contacto que entra a la base. Los 584 que ya están no la tienen y no la van a
 * tener nunca — la regla de la 040 lo impide. */
create trigger contactos_archiva_el_alta
  after insert on negocio.contactos
  for each row
  execute function negocio.archivar_cambio_de_territorio();

/* ── 2 · EL CAMBIO ───────────────────────────────────────────────────────────
 *
 * `is distinct from` sobre la columna DERIVADA y ESCALAR, por los tres motivos del encabezado:
 * nulo-seguro —sin eso, congelar y descongelar no dispararían nunca—, inmune al desorden del arreglo
 * de etiquetas (22 % ordenadas, medido), y sensible a 2 de las 62 etiquetas en vez de a las 62.
 *
 * Este comentario existe para que nadie «mejore» la cláusula agregándole el arreglo. */
create trigger contactos_archiva_el_cambio
  after update on negocio.contactos
  for each row
  when (old.territorio is distinct from new.territorio)
  execute function negocio.archivar_cambio_de_territorio();

drop policy if exists aislamiento on negocio.cambios_de_territorio;
select negocio.aplicar_aislamiento('negocio.cambios_de_territorio');

comment on table negocio.cambios_de_territorio is
  'Cuándo un contacto cambió de zona, y de cuál a cuál. La escriben dos disparadores sobre '
  'negocio.contactos, nunca el código. Es el único dato de este proyecto que NO se puede volver a '
  'pedir al CRM: GoHighLevel tampoco guarda historia de etiquetas. Sin fila `alta` para un contacto '
  'significa que ese contacto es anterior a esta migración, nunca que nació sin zona.';

comment on column negocio.cambios_de_territorio.detectado_el is
  'El arranque de la pasada del cron que lo detectó, no el segundo exacto del cambio: lo que se sabe '
  'es «entre esta pasada y la anterior». Todas las filas de una misma pasada comparten sello porque '
  'la pasada entera corre en una transacción.';
