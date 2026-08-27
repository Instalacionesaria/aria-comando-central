// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// Mi Día y el cockpit de Inicio, en UNA llamada. **Cero llamadas al CRM.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ LAS CINCO COLAS Y EL COCKPIT VIENEN JUNTOS
//
// El `04` § 3 lo explica con el número que lo justificó: antes eran dos relojes y dos
// peticiones, y estaban EN FASE —los dos se registraban en el mismo montaje— así que *"las
// colas leían la tabla microsegundos antes de que la ingesta escribiera"*. Un mensaje entrante
// tardaba un ciclo entero en aparecer en el Buzón.
//
// Acá el motivo es más simple y del mismo tipo: el contador de tareas del cockpit **se calcula
// con la regla de Mi Día** —los seguimientos automáticos no suman— así que si fueran dos
// endpoints habría dos implementaciones de ese contador. El `01` es terminante sobre eso:
// *"si dos pantallas muestran el mismo número, comparten la función que lo calcula"*.
//
// Con una llamada, el cockpit recibe el contador que Mi Día ya calculó. No puede discrepar.
//
// ── LA REGLA DE ADMISIÓN, QUE HAY QUE DEFENDER ──────────────────────────────
//
// El `04` § 3 la deja escrita: *"un endpoint que corre «todo lo del reloj de 10 segundos» ATRAE
// cada agregado futuro, y cada agregado hereda la latencia máxima y el radio de explosión
// completo. Como mucho UNA mitad que toque el CRM. Todo lo demás tiene que ser más barato que
// un viaje de ida y vuelta."*
//
// Este endpoint no toca el CRM ni una vez, así que hoy cumple con margen. Lo que NO puede
// entrar acá es la ingesta: traer de GoHighLevel es `/api/contactos/sincronizar`, y es una
// acción explícita de una persona.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { cockpitDelMes } from '../../../../lib/negocio/inicio.ts';
import { closerAsignado } from '../../../../lib/negocio/closer.ts';
import { comisionDelMes } from '../../../../lib/negocio/comision.ts';
import { colasDelDia } from '../../../../lib/negocio/miDia.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'closer';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  // La zona horaria de la ORGANIZACIÓN, no la del navegador. Es lo que decide qué es "hoy" y
  // qué es "este mes": un closer que viaja no ve su agenda corrida ni su mes cortado en otro
  // día. Viene resuelta en el contexto de la sesión.
  const zona = contexto.organizacion.zonaHoraria;

  const { colas, cockpit, comision, closer } = await conOrganizacion(contexto.orgEfectiva, async () => {
    const colas = await colasDelDia(zona);

    /* ── DE QUIÉN SON LOS NÚMEROS DE ESTA PANTALLA ───────────────────────────
     *
     * Del closer DESIGNADO, no de quien mira. «Closer» dejó de ser un rol y pasó a ser una
     * designación que hace quien administra —ver `lib/negocio/closer.ts` y la migración 020—, así que
     * el cockpit tiene un sujeto y es el mismo para todos los que abren la pantalla.
     *
     * Antes el número grande era de TODA la empresa y el anillo de al lado de quien miraba: dos
     * bases distintas en la misma pantalla. Ahora las dos salen de acá.
     */
    const closer = await closerAsignado();

    // El contador se le PASA al cockpit, no se recalcula. Ver el encabezado.
    const cockpit = await cockpitDelMes(zona, colas.tareasPendientes, closer?.usuarioId ?? null);
    /* ── LA COMISIÓN VIAJA ACÁ Y NO EN UN GET PROPIO ────────────────────────
     *
     * Si tuviera endpoint propio con `PANTALLA = 'closer'` tendría que pedir el mismo conjunto de
     * capacidades que los otros cinco —eso lo exige `ADR-0304`— y no ganaría nada; y con otra
     * capacidad, alguien vería el cockpit con la columna derecha en blanco y sin ningún error, que es
     * justo el defecto que esa regla existe para prevenir.
     *
     * Y cabe en la regla de admisión de este endpoint: leer una fila es más barato que un viaje de
     * ida y vuelta al CRM. Cero llamadas externas, igual que todo lo demás de esta pantalla.
     */
    /* Y sin closer designado no hay comisión que calcular: `null`, no una comisión en cero. Un cero
       afirmaría que el closer no cobra nada este mes; lo que pasa es que nadie eligió quién es. */
    const comision = closer === null ? null : await comisionDelMes(closer.usuarioId, zona);
    return { colas, cockpit, comision, closer };
  });

  return ok({
    cockpit,
    colas,
    comision,
    /* Quién es el closer, para que la pantalla pueda decir de quién son los números en vez de
       mostrarlos como si fueran de quien mira. `null` = nadie designado. */
    closer: closer === null ? null : { usuarioId: closer.usuarioId, nombre: closer.nombre },
    /* Y si quien mira ES el closer designado. Lo decide el SERVIDOR y no la pantalla comparando
       identificadores, por lo mismo que todo lo demás: es lo que habilita el formulario de la META,
       que es del closer y no de quien administra. Un administrador ve los números y el porcentaje
       —lo fija él— pero no le pone la meta a otra persona. */
    soyElCloser: closer !== null && closer.usuarioId === contexto.usuarioId,
    zonaHoraria: zona,
    /* La pantalla necesita saberlo para NO ofrecerle a un superadministrador que configure una meta
       en la empresa de otro: su `usuarioId` no pertenece a esa empresa, así que la fila es imposible
       por la clave foránea compuesta. Mandarlo a configurar algo imposible es mentirle. */
    mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
  });
}
