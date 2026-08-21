-- ADR-0803, ADR-0804, ADR-0805, ADR-0806 — Las consultas de vigilancia.
--
-- Las seis señales del `10` § 1, tal como el documento las escribe. Se aplican con el rol
-- `app_identidad`, que es el único que ve `identidad.auditoria_accesos` completa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTE ARCHIVO EXISTE, SIENDO QUE ESTAS FILAS SON DE TIPO "PRODUCCIÓN"
--
-- `PRUEBAS.md` § Etapa 8 lo dice en su encabezado: *"estas no son pruebas del proyecto: son
-- pruebas del sistema andando. Son las únicas que detectan un fallo mientras está pasando."*
-- Y `EJECUCION` § 4 y § 5 dejan el `10` fuera de alcance salvo dos cosas: el aviso de la
-- excepción de aislamiento y la sonda.
--
-- Así que estas cuatro señales **no** se implementan como pruebas. Pero la consulta es la
-- mitad barata del trabajo, y dejarla sin escribir convierte "es de producción" en "no está".
-- Acá están, listas para correr, con una prueba que verifica que **son SQL válido y que la
-- forma de la respuesta es la que la señal necesita**.
--
-- Lo que falta para que cada una sea la fila de `PRUEBAS`: la CADENCIA (una tarea programada)
-- y la PERSONA que la lee. Las dos son decisiones de operación y están en `docs/ETAPA-8.md`.
--
-- ── Y LA PRECONDICIÓN QUE YA ESTÁ CUBIERTA ─────────────────────────────────
--
-- Tres de estas señales dependen de que alguien EMITA la fila. `ADR-0809` lo verifica
-- provocando cada acción y comprobando que aparece — porque *"un cero en la vigilancia es
-- indistinguible de 'nadie cableó el punto de emisión'"*. Sin esa prueba, estas consultas
-- devolverían cero para siempre y ese cero se leería como "no está pasando nada".
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── Señal 1 · Excepciones de la capa de aislamiento ───────────────────────
--
-- NO tiene consulta, y es a propósito: el `10` § 1 la llama *"la más barata de todas"* porque
-- no se consulta, **avisa**. Va por `avisar()` desde `datos()`, con un medio que interrumpe.
-- Está implementada como código (`ADR-0802`), no como consulta.


-- ─── Señal 2 · Credenciales que dejaron de poder leerse ────────────────────
-- Cadencia: DIARIA. Significaría: clave maestra cambiada, o un valor alterado.
select org_id, count(*) as veces
  from identidad.auditoria_accesos
 where accion = 'credencial_ilegible' and creado_el > now() - interval '24 hours'
 group by org_id;


-- ─── Señal 3 · Rechazos por permiso, por organización y capacidad ──────────
-- Cadencia: SEMANAL. Umbral: más de 20.
--
-- El `10` § 1 la llama **la más subestimada**: *"un pico de rechazos por permiso en una
-- organización casi nunca es un ataque: es un rol al que le falta una capacidad, y NADIE LO VA
-- A REPORTAR porque la pantalla se ve."*
select org_id, detalle->>'capacidad' as capacidad, count(*) as veces
  from identidad.auditoria_accesos
 where accion = 'permiso_denegado' and creado_el > now() - interval '24 hours'
 group by 1, 2
having count(*) > 20
 order by 3 desc;


-- ─── Señal 4 · Intentos fallidos por dirección de origen ───────────────────
-- Cadencia: HORARIA. Umbral: más de 20.
--
-- `count(distinct detalle->>'email')` es la mitad que importa: veinte intentos contra UNA
-- cuenta es alguien que se olvidó la contraseña; veinte contra veinte cuentas es un barrido.
-- Sin el campo `email` en el detalle esta columna devuelve cero, y un cero por falta de datos
-- se lee como "no hay ataque" (07 § 0, regla 3).
select ip, count(*) as intentos, count(distinct detalle->>'email') as emails_probados
  from identidad.auditoria_accesos
 where accion = 'login_fallido' and creado_el > now() - interval '1 hour'
 group by ip
having count(*) > 20;


-- ─── Señal 5 · El rol de plataforma mirando organizaciones de clientes ─────
-- Cadencia: SEMANAL. Significaría: uso indebido de una cuenta con acceso a todo.
--
-- Es la fila `ADR-0806` (*"el acceso de soporte queda registrado"*). Depende enteramente de
-- que `organizacion_cambiada` se emita — y esa acción estaba en el tipo desde la Etapa 3 SIN
-- emitirse en ningún lado hasta la 8.
select usuario_id,
       count(*) as cambios,
       count(distinct detalle->>'org_destino') as organizaciones
  from identidad.auditoria_accesos
 where accion = 'organizacion_cambiada' and creado_el > now() - interval '7 days'
 group by usuario_id;


-- ─── Señal 6 · La sonda de aislamiento ─────────────────────────────────────
--
-- Tampoco tiene consulta: es un punto de entrada (`POST /api/sonda`) que corre por el camino
-- real de la aplicación y avisa por el mismo canal que la señal 1. Está implementada como
-- código (`ADR-0801`).
--
-- El `10` § 1: *"es lo único de esta lista que puede detectar **la fuga misma** en vez de sus
-- alrededores."*
