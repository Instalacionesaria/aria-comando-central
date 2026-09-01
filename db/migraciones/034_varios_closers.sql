-- Varios closers por empresa, cada uno vinculado a un usuario de GoHighLevel.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA MIGRACIÓN 020 ELIGIÓ «UNO SOLO» Y LO HIZO IMPOSIBLE DE VIOLAR. ESTO LO CAMBIA.
--
-- Su encabezado es explícito sobre por qué la clave primaria era `org_id` sola:
--
--   *«Con la clave primaria en `org_id` solo, una organización NO PUEDE tener dos closers
--   asignados: no es una convención que el código respete, es una fila que la base no acepta.»*
--
-- Era la decisión correcta para lo que se pedía entonces —un closer, y sus números en el cockpit—
-- y es la que hoy hay que deshacer. Se pidió hasta tres, cada uno con sus propios leads.
--
-- Lo que se conserva de aquel diseño es lo que sigue siendo cierto: designar sigue siendo un acto
-- deliberado, no hay valor por omisión, y sin fila no hay closer.
--
-- ── POR QUÉ ESTO ES POSIBLE HOY Y NO LO ERA EN LA 020 ───────────────────────
--
-- Porque cambió un hecho medido, no una preferencia. `lib/negocio/fila.ts` tiene escrito el motivo
-- por el que un closer ve TODO el territorio:
--
--   *«La respuesta que se eligió: por territorio. NO por responsable asignado, porque GHL no da
--   asignación — da zona.»*
--
-- Y la migración 011 lo dice con las mismas palabras, anticipando incluso este día: *«Con más de
-- uno hará falta otra señal (owner de la oportunidad)»*.
--
-- **Esa premisa es falsa.** Medido el 2026-09-01 contra la subcuenta real, con el mismo
-- `POST /contacts/search` que la aplicación ya llama: `assignedTo` viene en la respuesta, y de los
-- **152 contactos de `zona_closer`, 135 lo traen poblado** — el 89 %. En `zona_setter`, 3 de 100 —
-- o sea que la señal es del closer, que es exactamente donde se pidió usarla.
--
-- ── Y LA PRIMERA MEDICIÓN DE ESTO ESTUVO MAL DICHA ─────────────────────────
--
-- La sonda pidió UNA página de 100 sobre un total de 152 y dio «87 con asignado». La TASA era
-- correcta —87 %, contra el 89 % real— pero el número absoluto se escribió después como si fuera
-- el total, y no lo era: es la cuenta de una muestra. La corrección la trajo quien mira el CRM
-- todos los días: *«en GHL me salen 135 asignados a Quiroz y 152 en total»*.
--
-- Queda escrito porque el error no fue de medición sino de REDACCIÓN, y es el que más fácil se
-- repite: una muestra citada como si fuera un censo. Cuando la cifra va a un comentario que
-- alguien va a creer, hay que paginar hasta el final — que es lo que hace
-- `todosLosContactosPorEtiqueta`, la función que la aplicación ya usaba.
--
-- No hace falta ninguna llamada nueva: el campo llega en la misma respuesta que hoy se descarta.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · LA DESIGNACIÓN: DE UNA FILA POR EMPRESA A HASTA TRES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `alter table … drop constraint` conserva las filas. La designación que exista hoy queda como el
-- primer closer, sin vínculo con el CRM todavía — que es un estado que la pantalla sabe decir.
--
-- La tabla NO se renombra a `closers` aunque el nombre en singular ya no describa lo que guarda.
-- Renombrarla arrastra `lib/datos/esquema.ts`, `lib/administracion/borrado.ts`, la prueba de
-- migraciones y las tres consultas que la nombran, todo para ganar una `s`. El nombre queda, y este
-- comentario es lo que impide que alguien lea «asignado» y suponga que hay uno.
alter table negocio.closer_asignado drop constraint closer_asignado_pkey;
alter table negocio.closer_asignado add primary key (org_id, usuario_id);

-- ── EL VÍNCULO CON GOHIGHLEVEL, Y POR QUÉ ADMITE NULOS ──────────────────────
--
-- Es el identificador del usuario del CRM con el que se vincula esta persona. Lo que decide de
-- quién es cada lead: un contacto es de este closer si su `crm_asignado_a` coincide con esto.
--
-- Anulable, y **no por comodidad**: la fila que ya existe en producción no tiene con qué
-- rellenarse, y cualquier valor inventado ahí le daría a esa persona los leads de otro. Un `not
-- null` obligaría a elegir uno al migrar, que es exactamente la clase de decisión que una migración
-- no puede tomar.
--
-- Qué significa nulo: **designado pero sin vincular**. Esa persona no tiene leads propios que
-- reclamar, así que ve todo — como cualquiera que no sea closer. Nunca una lista vacía sin
-- explicación, que es el otro lado por el que esto se podía romper.
alter table negocio.closer_asignado add column crm_usuario_id text;

-- ── UN USUARIO DEL CRM, UN CLOSER ───────────────────────────────────────────
--
-- Con dos de nuestros usuarios vinculados al MISMO usuario de GoHighLevel, los dos reclamarían los
-- mismos leads: cada uno vería la lista completa del otro y los dos llamarían al mismo contacto.
-- Nada fallaría — las dos filas son válidas, las dos consultas devuelven resultados.
--
-- Parcial porque los nulos no compiten: «sin vincular» es un estado normal y puede haber varios.
-- `unique` a secas trata los nulos como distintos en PostgreSQL, así que funcionaría igual; se
-- escribe el `where` de todos modos porque dice la intención y no depende de recordar esa regla.
create unique index closer_por_usuario_del_crm
  on negocio.closer_asignado (org_id, crm_usuario_id)
  where crm_usuario_id is not null;

-- El TOPE DE TRES no está acá, y es deliberado. Se pidió *«por ahora pongamos hasta un máximo de
-- 3»*, y «por ahora» es la palabra que decide dónde vive: como constante con nombre en
-- `app/api/admin/closer/route.ts`, subirlo es una línea. Como `check` en la base, es otra migración
-- contra producción para un número que se sabe provisorio.


-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · A QUIÉN ESTÁ ASIGNADO EL CONTACTO, SEGÚN EL CRM
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El identificador del usuario de GoHighLevel, **crudo, tal como viene**. Nulo = el CRM no lo trae
-- (17 de los 152 medidos) o el contacto todavía no se sincronizó desde este cambio.
--
-- ── POR QUÉ CRUDO Y NO RESUELTO A `responsable_id` ─────────────────────────
--
-- La columna `responsable_id` existe desde la migración 011 —el `11` § 2 la pedía— y **nunca se
-- escribió**, justamente porque «GHL no da asignación». Ahora la da, y llenar esa columna es la
-- salida que parece obvia y está mal.
--
-- El vínculo GHL↔nuestro usuario **cambia**: se corrige un desplegable mal elegido, se reemplaza a
-- un closer, alguien se va. Con el valor ya resuelto en cada contacto, cada corrección obligaría a
-- re-sincronizar los 152 contactos para que la pantalla diga la verdad — y mientras tanto la
-- pantalla afirma algo que la configuración ya desmintió.
--
-- Guardando el identificador del CRM, cambiar el vínculo es **una fila** en `closer_asignado` y
-- surte efecto en la consulta siguiente. Es la regla que este esquema ya aplica en todas partes:
-- lo calculado no se guarda, y la única excepción —el sello del setter— tiene su justificación
-- escrita en la 011 precisamente porque es una excepción.
--
-- `responsable_id` y `responsable_rol` quedan como están: nulas y sin escritor. Borrarlas es otra
-- conversación, y borrar una columna es la clase de cambio que no se hace de paso.
alter table negocio.contactos add column crm_asignado_a text;

-- El índice para el filtro de cada closer. Las tres columnas en el orden en que se preguntan:
-- la organización la pone la política de fila, el territorio lo pone la pantalla, y el asignado es
-- lo que se compara. `contactos_por_territorio` no sirve para esto: no tiene la última columna, así
-- que cada carga de Mi Día recorrería el territorio entero para descartar los ajenos.
create index contactos_por_asignado
  on negocio.contactos (org_id, territorio, crm_asignado_a);
