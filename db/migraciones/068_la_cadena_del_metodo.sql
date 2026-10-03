-- La cadena del método: en qué paso quedó «Construir el método» de cada organización.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- «Construir el método» encadena los pasos 3 a 7 de ICP & Oferta, se pausa después del ICP y de la
-- Oferta, y se detiene donde el agente necesita una respuesta (el diagnóstico de Categoría). Hasta el
-- 2026-10-03 ese estado vivía solo en la pantalla: si alguien salía de ICP & Oferta con la cadena en
-- pausa, al volver no había nada que retomar, y la única salida era recargar la página.
--
-- Una fila por organización con el último estado de su cadena (`registro`): en qué paso, si estaba
-- generando, en pausa o detenida, y desde dónde se retoma. La escribe y la lee
-- `lib/fundaciones/cadena.ts`; la pantalla la reconcilia al volver con lo que de verdad pasó (si el
-- documento que se estaba generando terminó o no).
--
-- ── ACÁ Y NO EN `public.aria_cc_foundations` ──────────────────────────────────
--
-- Esa tabla es de otro dueño y este repositorio no la migra (ver la prueba 130). Esto es un dato de
-- la pantalla de ESTE proyecto, de una organización, y va donde van los demás: en `negocio`, con
-- `org_id` y aislado.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.cadena_del_metodo (
  org_id uuid not null references identidad.organizaciones(id),
  -- El estado de la cadena, tal como lo arma `lib/fundaciones/cadena.ts`. Lo valida el servidor
  -- antes de escribirlo; el lector es tolerante igual.
  registro jsonb not null,
  -- Cuándo se escribió por última vez. Es lo que dice cuánto lleva «generando» una cadena cuyo
  -- navegador se cerró: pasado el tope de una generación, se da por fallida.
  actualizado_el timestamptz not null default now(),
  primary key (org_id)
);

comment on table negocio.cadena_del_metodo is
  'El último estado de «Construir el método» de cada organización (en qué paso quedó y desde dónde se retoma). La escribe y la lee lib/fundaciones/cadena.ts.';

drop policy if exists aislamiento on negocio.cadena_del_metodo;
select negocio.aplicar_aislamiento('negocio.cadena_del_metodo');
