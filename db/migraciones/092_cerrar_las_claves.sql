-- Cerrar las claves del nivel 3: las claves por organización dejan su lugar a las del cliente.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Bloque C, 2026-10-18)
--
-- La `090` EXPANDIÓ: agregó, junto a cada clave por organización, la misma clave con el cliente (`cuenta_id`), y el
-- código pasó a escribir con la nueva: el pulso, el gasto y los sellos en C1, y el aviso del CRM recién en C3. Mientras
-- convivieron, la vieja seguía siendo única: dos clientes de una empresa no podían tener el mismo pulso, el mismo día
-- de gasto, el mismo sello ni el mismo aviso. Esta migración CIERRA: la clave vieja deja de existir y la del cliente
-- pasa a ser la clave.
--
-- **Va después de C3 desplegado, no de C1**: el aviso de C1 escribe todavía con `on conflict (org_id, huella)`, y sin
-- ese único cada aviso sería un 42P10 y un 503. Por lo mismo, una vez aplicada no se vuelve a un despliegue anterior a
-- C3, ni con un rollback de Vercel.
--
--   · `ingesta_pulso`      — la clave primaria pasa de (org_id, clave) a (org_id, cuenta_id, clave);
--   · `gasto_de_la_cuenta` — de (org_id, fecha) a (org_id, cuenta_id, fecha);
--   · `avisos_del_crm`     — se borra el único (org_id, huella): queda (org_id, cuenta_id, huella);
--   · `tareas_programadas` — la clave primaria pasa a (org_id, id); el sello es único por (org_id, cuenta_id, tarea)
--     con NULLS NOT DISTINCT (la `090`), porque las tareas de la empresa no tienen cliente y `cuenta_id` es nula.
--
-- La clave primaria nueva se arma CON el índice de la `090` (`using index`), que pasa a llamarse como la clave: no se
-- construye un índice dos veces. Reaplicable: cada paso mira primero cómo está la clave, y uno ya hecho no se repite.
-- Ninguna clave foránea apunta a estas claves (comprobado en `pg_constraint` el 2026-10-18).
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.ingesta_pulso'::regclass and conname = 'ingesta_pulso_pkey'))
     = 'PRIMARY KEY (org_id, clave)' then
    alter table negocio.ingesta_pulso drop constraint ingesta_pulso_pkey;
    alter table negocio.ingesta_pulso add constraint ingesta_pulso_pkey primary key using index ingesta_pulso_clave_por_cuenta;
  end if;

  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.gasto_de_la_cuenta'::regclass and conname = 'gasto_de_la_cuenta_pkey'))
     = 'PRIMARY KEY (org_id, fecha)' then
    alter table negocio.gasto_de_la_cuenta drop constraint gasto_de_la_cuenta_pkey;
    alter table negocio.gasto_de_la_cuenta
      add constraint gasto_de_la_cuenta_pkey primary key using index gasto_de_la_cuenta_dia_por_cuenta;
  end if;

  if pg_get_constraintdef((select oid from pg_constraint
                            where conrelid = 'negocio.tareas_programadas'::regclass and conname = 'tareas_programadas_pkey'))
     = 'PRIMARY KEY (org_id, tarea)' then
    alter table negocio.tareas_programadas drop constraint tareas_programadas_pkey;
    alter table negocio.tareas_programadas add constraint tareas_programadas_pkey primary key (org_id, id);
  end if;
end $$;

alter table negocio.avisos_del_crm drop constraint if exists avisos_del_crm_huella_por_org;

comment on constraint ingesta_pulso_pkey on negocio.ingesta_pulso is
  'Un pulso por cliente y clave (el nivel 3): el candado de la ingesta de un cliente no frena la de otro.';
comment on constraint gasto_de_la_cuenta_pkey on negocio.gasto_de_la_cuenta is
  'Un día de gasto por cliente: dos clientes de una empresa tienen su propia cuenta publicitaria.';
comment on constraint tareas_programadas_pkey on negocio.tareas_programadas is
  'El identificador del sello. El sello es único por (org_id, cuenta_id, tarea) con NULLS NOT DISTINCT: las tareas de la empresa llevan cuenta_id nula.';
