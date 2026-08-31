-- El prompt de cada agente, por empresa. **Una fila por (empresa, agente).**
--
-- ═════════════════════════════════════════════════════════════════════════════
-- UNA FILA POR AGENTE, Y NO OCHO COLUMNAS. ES EL DEFECTO 4.1 DEL ORIGEN.
--
-- La plataforma anterior guardaba esto en OCHO COLUMNAS de la fila de la organización
-- —`prompt_appointment_texto`, `prompt_lead_voz`, y así— y de ahí sale su propio defecto `4.1`, que
-- su documentación describe sin rodeos: *«la causa es una lista escrita a mano»*. Con las columnas
-- clavadas, la pregunta «qué agentes tienen auditor» no se podía consultar, así que alguien escribió
-- la lista aparte; quedó desfasada, y **declaraba a los dos auditores de voz como «sin auditor»
-- cuando ya lo tenían**.
--
-- Con una fila por `(org_id, agente)` esa pregunta es un `select`, y el defecto es inexpresable.
-- Agregar un auditor deja de ser una migración de esquema con ocho columnas que crecen a diez.
--
-- ── LO QUE MIDE ESTA DECISIÓN, EN LOS DATOS REALES DEL ORIGEN ───────────────
--
-- Sus cuatro espacios de prompt estaban **VACÍOS**: `length(prompt_*) = 0` en las dos
-- organizaciones. O sea que sus 59 análisis salieron **sin prompt de referencia**, y la rama del
-- código que cita un fragmento y propone un reemplazo **nunca corrió en producción**.
--
-- Por eso acá **la ausencia es un estado normal y no un error**: no hay fila, se audita igual, el
-- fragmento queda nulo y la corrección sale como instrucción autónoma. La rúbrica tiene las dos ramas
-- escritas y una prueba las cubre — ver `lib/auditor/rubrica.ts`.
--
-- ── «VACÍO SIGNIFICA BORRAR», Y EL `check` LO HACE CUMPLIR ──────────────────
--
-- Al revés que en una credencial, donde vaciar el campo tiene que dejar la credencial intacta —ahí un
-- formulario que se manda con el campo en blanco no debe desconectar la cuenta—, acá **vaciar el
-- texto ES borrar el prompt**: es el único gesto disponible para decir «este agente vuelve a no tener
-- prompt de referencia».
--
-- El `check` de abajo hace que una fila con el texto en blanco **no se pueda escribir**. Así el estado
-- «hay fila y no hay prompt» no existe, y el escritor no puede dejarlo por descuido: o borra la fila o
-- guarda algo. Sin el `check`, una fila vacía se leería como un prompt cargado de cero caracteres, y
-- el auditor entraría a la rama «con prompt» buscando fragmentos en la nada.
--
-- ── EL HASH SE GUARDA Y NO SE LEE PARA COMPARAR ─────────────────────────────
--
-- El hash del prompt **se recalcula del texto en cada lectura**. Esta columna es el hash que TENÍA
-- cuando se guardó, y sirve para una sola cosa: que la pantalla del técnico pueda avisar que el prompt
-- cambió desde que se escribió un hallazgo.
--
-- Leerla como si fuera el hash actual sería el defecto silencioso obvio: cualquier escritura que
-- olvidara actualizarla dejaría hallazgos viejos pasando por vigentes para siempre.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.prompts_del_agente (
  org_id  uuid not null references identidad.organizaciones(id) on delete cascade,
  id      uuid not null default gen_random_uuid(),

  -- La misma lista cerrada que `analisis_del_agente` y que `hallazgos`, por el mismo motivo que la
  -- 027 dejó escrito: encender un auditor que gasta plata tiene que aparecer en un diff que alguien
  -- mire. Y una sola derivación en el código (`AGENTES`) para que no haya dos listas del mismo hecho.
  agente  text not null,

  -- El prompt tal cual lo cargó la empresa. **Se guarda literal**: el auditor tiene que citar
  -- fragmentos EXACTOS de este texto para que el reemplazo que propone se pueda pegar donde va, así
  -- que normalizar los espacios acá haría que la cita no coincida con el prompt real y el técnico no
  -- la encuentre. Es la misma razón por la que la rúbrica no lo reescribe al meterlo en el prompt.
  texto  text not null,

  -- El hash que tenía al guardarse. Ver el encabezado: **no es el hash actual**.
  prompt_hash  text not null,

  actualizado_el   timestamptz not null default now(),
  actualizado_por  uuid,

  primary key (org_id, id),

  -- ── UNA SOLA FILA POR AGENTE ──────────────────────────────────────────────
  --
  -- Es lo que convierte «el prompt de este agente» en una lectura sin ambigüedad. Sin esto, dos
  -- escrituras concurrentes dejarían dos filas y la lectura se quedaría con la que el planificador
  -- devuelva primero — o sea que el auditor juzgaría contra un prompt distinto en cada corrida, sin
  -- que nada fallara nunca.
  --
  -- Y además es la clave sobre la que el escritor hace `on conflict`: guardar es un solo enunciado.
  constraint prompts_del_agente_unico unique (org_id, agente),

  constraint prompts_del_agente_agente_check
    check (agente in ('chat_post_agenda', 'chat_pre_agenda')),

  -- «Vacío significa borrar»: ver el encabezado. Una fila en blanco es inescribible.
  constraint prompts_del_agente_texto_no_vacio
    check (btrim(texto) <> ''),

  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);

-- El aislamiento por empresa, igual que el resto de `negocio`. Un prompt es la voz de la empresa
-- delante de sus clientes: verlo desde otra cuenta es ver su estrategia comercial completa.
select negocio.aplicar_aislamiento('negocio.prompts_del_agente');
