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
import {
  alcanceDeQuienMira,
  verComoDeLaUrl,
} from '../../../../lib/negocio/alcanceDelCloser.ts';
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

  /* ── EL SELECTOR «VER COMO», Y POR QUÉ VIAJA EN LA URL ────────────────────
   *
   * Quien administra y no es closer puede mirar los números de UNO de ellos. Va como parámetro
   * de consulta y no en el cuerpo porque esto es un `GET` que el navegador repite cada diez
   * segundos: en la URL, el reloj lo arrastra solo y la pantalla no tiene que recordarlo.
   *
   * Lo que impide que sea una escalada está en `alcancePedido`: solo se atiende cuando el
   * alcance propio es `todo`, y el identificador tiene que estar en la lista de SU empresa.
   * Un closer vinculado que lo mande a mano recibe su propio alcance igual. */
  const verComo = verComoDeLaUrl(peticion);

  const { colas, cockpit, comision, closers, alcance, propio } = await conOrganizacion(
    contexto.orgEfectiva,
    async () => {
      /* ── DE QUIÉN SON LOS LEADS DE ESTA PANTALLA ─────────────────────────
       *
       * Antes había UN closer designado y el cockpit tenía un sujeto para todos: *«el mismo para
       * todos los que abren la pantalla»*. Con varios, la pregunta cambió de forma — ya no es
       * «quién es el closer» sino «de quién son los leads de QUIEN MIRA» — y la contesta
       * `lib/negocio/alcanceDelCloser.ts`, que es el único lugar donde se decide.
       *
       * Se resuelve ANTES de las colas porque las colas lo necesitan: sin el alcance,
       * `colasDelDia` trae el territorio entero y el filtro tendría que hacerse después, sobre
       * filas ya traídas — trabajo de más y, peor, un segundo lugar donde filtrar. */
      const { closers, alcance, propio } = await alcanceDeQuienMira(contexto.usuarioId, verComo);

      const colas = await colasDelDia(zona, alcance);

      /* ── EL SUJETO DEL COCKPIT, QUE SALE DEL ALCANCE Y NO AL REVÉS ───────
       *
       * Tres formas, y las tres se ven distinto: sin closers configurados no hay de quién mostrar
       * números; con alcance `todo` se suman los closers; con `mio` es una persona.
       *
       * El identificador de NUESTRO usuario se busca por el vínculo del CRM y no se arrastra en el
       * alcance, porque el alcance habla del CRM y el cockpit de quién registró el resultado acá:
       * son dos ejes, y meterlos en un solo valor es cómo se llega a contar los resultados de una
       * persona sobre los contactos de otra. */
      const sujeto =
        closers.length === 0
          ? ({ tipo: 'nadie' } as const)
          : alcance.tipo === 'todo'
            ? ({ tipo: 'empresa', usuarioIds: closers.map((k) => k.usuarioId) } as const)
            : ({
                tipo: 'persona',
                usuarioId:
                  closers.find((k) => k.crmUsuarioId === alcance.crmUsuarioId)?.usuarioId ?? '',
                crmUsuarioId: alcance.crmUsuarioId,
              } as const);

      // El contador se le PASA al cockpit, no se recalcula. Ver el encabezado.
      const cockpit = await cockpitDelMes(zona, colas.tareasPendientes, sujeto);

      /* ── LA COMISIÓN VIAJA ACÁ Y NO EN UN GET PROPIO ────────────────────────
       *
       * Si tuviera endpoint propio con `PANTALLA = 'closer'` tendría que pedir el mismo conjunto
       * de capacidades que los otros cinco —eso lo exige `ADR-0304`— y no ganaría nada; y con otra
       * capacidad, alguien vería el cockpit con la columna derecha en blanco y sin ningún error,
       * que es justo el defecto que esa regla existe para prevenir.
       *
       * Y es de UNA persona o de NADIE, nunca una suma. Quien mira «toda la empresa» no tiene
       * comisión que mostrar: sumar las de tres closers daría un número que no es de nadie y que
       * nadie cobra. `null`, que la pantalla ya sabe dibujar. */
      const comision =
        sujeto.tipo === 'persona' && sujeto.usuarioId !== ''
          ? await comisionDelMes(sujeto.usuarioId, zona)
          : null;
      return { colas, cockpit, comision, closers, alcance, propio };
    },
  );
  /* De quién son los números que se están mostrando. `null` = de toda la empresa, que no es lo
     mismo que «no hay nadie»: eso lo dice `closers` vacío. */
  const mirando =
    alcance.tipo === 'mio'
      ? (closers.find((k) => k.crmUsuarioId === alcance.crmUsuarioId) ?? null)
      : null;

  return ok({
    cockpit,
    colas,
    comision,
    /**
     * Los closers configurados. Antes era `closer`, uno solo.
     *
     * Va la lista completa —con quién está vinculado y quién no— porque la pantalla la necesita
     * para dos cosas: el selector «ver como» y el nombre del asignado en cada fila de contacto.
     * Vacía = nadie configurado, y el cockpit lo dice con su propio texto.
     */
    closers: closers.map((k) => ({
      usuarioId: k.usuarioId,
      nombre: k.nombre,
      vinculado: k.crmUsuarioId !== null,
    })),
    /* De quién son los números en pantalla, o `null` si son de toda la empresa. */
    mirando: mirando === null ? null : { usuarioId: mirando.usuarioId, nombre: mirando.nombre },
    /**
     * `true` = esta persona ve TODO, así que se le puede ofrecer el selector «ver como».
     *
     * Lo decide el SERVIDOR y no la pantalla comparando identificadores, por lo mismo que
     * `soyElCloser`: es lo único que impide que el selector aparezca para un closer, que lo
     * apretaría y no pasaría nada —`alcancePedido` lo ignora— y desconfiaría de la pantalla.
     */
    puedeVerTodo: propio.tipo === 'todo',
    /* Y si quien mira ES el closer cuyos números se muestran. Lo decide el SERVIDOR, por lo mismo
       que todo lo demás: es lo que habilita el formulario de la META, que es del closer y no de
       quien administra. Un administrador ve los números y el porcentaje —lo fija él— pero no le
       pone la meta a otra persona. */
    soyElCloser: mirando !== null && mirando.usuarioId === contexto.usuarioId,
    zonaHoraria: zona,
    /* La pantalla necesita saberlo para NO ofrecerle a un superadministrador que configure una
       meta en la empresa de otro: su `usuarioId` no pertenece a esa empresa, así que la fila es
       imposible por la clave foránea compuesta. Mandarlo a configurar algo imposible es
       mentirle. */
    mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
  });
}
