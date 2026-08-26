-- El calendario de GoHighLevel donde se agendan las llamadas del closer.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- PARA QUÉ SIRVE ESTA COLUMNA, Y SOBRE TODO PARA QUÉ NO
--
-- La pregunta que la trajo fue si hace falta configurar un calendario «para los agendamientos del
-- closer». Se midió contra la subcuenta real antes de decidir, y la respuesta tiene dos mitades
-- opuestas:
--
-- ── PARA LEER LA AGENDA NO HACE FALTA, Y USARLA AHÍ SERÍA UN DEFECTO ────────
--
-- Medido el 2026-08-26 sobre los últimos 90 días de la subcuenta de ARIA:
--
--     349 citas   round_robin   ARIA IA Accelerator | Consultoría de Diagnóstico   ← el configurado
--      26 citas   round_robin   Llamada de Diagnostico - Agencia AI Native
--       1 cita    round_robin   test de icp alto
--       0          (seis calendarios más, cuatro de ellos personales)
--     ─────────
--     376 en total
--
-- O sea que **si el barrido usara esta columna como filtro, perdería 27 citas de 376 en silencio**.
-- El barrido lista los nueve calendarios y los recorre: cuesta 1 + N llamadas y no se le escapa
-- ninguna. Eso NO se cambia, y hay una prueba que lo afirma —`pruebas/base/28-cron.test.ts` y el
-- encabezado de `lib/negocio/citas.ts`— porque es exactamente el atajo que alguien va a querer tomar
-- para bajar diez llamadas a dos.
--
-- ── PARA AGENDAR SÍ HACE FALTA, Y NO SE PUEDE DEDUCIR ──────────────────────
--
-- La subcuenta tiene **nueve** calendarios y **cinco** son `round_robin`. Nada en la API dice cuál es
-- «el de la empresa»: elegir el que tiene más citas es una heurística que cambia sola con el uso, y
-- elegir el primero es elegir al azar. Es una decisión de negocio, así que se configura.
--
-- Con el identificador, el enlace para agendar sale solo —medido: `GET
-- https://api.leadconnectorhq.com/widget/booking/<id>` responde 200— y el día que se quiera crear
-- citas desde la aplicación, `POST /calendars/events/appointments` existe (contestó 400 pidiendo
-- `locationId`, o sea que la ruta está viva) y también necesita saber cuál.
--
-- ── POR QUÉ ACÁ Y NO EN `negocio` ──────────────────────────────────────────
--
-- Porque es parte de la conexión con el CRM, igual que `crm_cuenta_id`, y se administra en la misma
-- pantalla. **No es un secreto**: es el identificador de un calendario ajeno, viaja completo y se
-- muestra entero — la misma clase que el Location ID.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.organizaciones_credenciales
  add column if not exists crm_calendario_id text;

comment on column identidad.organizaciones_credenciales.crm_calendario_id is
  'El calendario de GoHighLevel donde se agendan las llamadas. NO es un filtro del barrido: el '
  'barrido lee TODOS los calendarios, y usar este como filtro perdería las citas de los demás '
  '(medido: 27 de 376). Sirve para el enlace de agendamiento y, el día que exista, para crear citas.';
