// La tercera pasada: ir a buscar el estado real de lo que mandamos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA UNA PASADA APARTE, Y NO ALCANZA CON NINGUNA OTRA
//
// El defecto que originó todo este bloque: un mensaje se mandó, la aplicación lo dio por enviado, y
// nunca llegó. **La llamada había devuelto éxito** — el CRM acepta el mensaje, le crea su fila, y
// recién después el canal lo rechaza.
//
// Ninguna de las otras dos vías lo descubre, y por un motivo concreto:
//
//   **Un mensaje que falla minutos después NO cambia la fecha de la conversación.** La ingesta
//   periódica camina por `last_message_date`, así que esa conversación queda por debajo de la marca
//   de agua y no se vuelve a mirar nunca. El aviso del CRM tampoco: avisa de mensajes, no de
//   cambios de estado.
//
// Entonces hay que ir a preguntar, mensaje por mensaje, por los que quedaron sin resolver.
//
// ── LOS TRES RECORTES, Y CADA UNO EVITA UN GASTO PARA SIEMPRE ───────────────
//
// **1 · Solo los `en_curso`.** Un `entregado` no cambia y un `fallido` tampoco. Y un `desconocido`
// —el CRM contestó algo que no sabemos clasificar— tampoco se vuelve a preguntar: repreguntar por un
// valor que no entendemos es gastar llamadas indefinidamente.
//
// **2 · Nunca los de identificador FABRICADO.** Cuando el envío no devuelve identificador se inventa
// uno y se marca. Preguntar por él da 400 —medido— para siempre: **dos llamadas por ciclo,
// indefinidamente, y la cola no se vacía nunca.** Es el gasto silencioso más caro que podía tener
// este diseño y la columna `id_fabricado` existe exactamente para cerrarlo.
//
// **3 · Una ventana de una hora.** Pasada esa hora, un mensaje que sigue sin resolverse casi seguro
// no se va a resolver, y seguir preguntando es pagar por nada. Queda en `en_curso`, que la pantalla
// lee como «enviado» — que es exactamente lo que se sabe de él.
//
// ── Y EL ORDEN, QUE NO ES UN DETALLE ────────────────────────────────────────
//
// `estado_entrega_revisado_el nulls first`: primero los que nunca se miraron, después el más viejo.
// Con cualquier otro orden —por fecha de envío, por ejemplo— los dos mismos mensajes se revisarían
// una y otra vez mientras el resto **no se mira nunca**. El índice
// `mensajes_entrega_sin_resolver` está declarado justo así.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { estadoDeMensaje } from '../ghl/conversaciones.ts';
import { familiaDeEntrega } from '../ghl/entrega.ts';

/**
 * Cuántos se revisan por ciclo. Dos, y es a propósito: cada uno cuesta una llamada, y el ciclo ya
 * tiene su propio presupuesto. Lo que no se revisa hoy se revisa en el ciclo siguiente — y el orden
 * `nulls first` garantiza que le toque a todos.
 */
const POR_CICLO = 2;

/** La ventana. Ver el recorte 3 del encabezado. */
const VENTANA_MS = 60 * 60 * 1000;

export interface ResultadoDeRevision {
  revisados: number;
  /** Cuántos cambiaron de familia. Es lo que hace que la pasada valga las llamadas que cuesta. */
  resueltos: number;
  /** Cuántos el CRM dice no conocer. Ver abajo: se sacan de la cola, no se reintentan. */
  desconocidos: number;
  llamadas: number;
}

/**
 * Revisa hasta `POR_CICLO` entregas sin resolver. **Corre dentro del ciclo de ingesta**, así que
 * comparte su alquiler y su contabilidad: no hay un segundo candado que mantener.
 */
export type PreguntarEstado = typeof estadoDeMensaje;

export async function revisarEntregas(
  orgId: string,
  acceso: { token: string },
  /**
   * Cómo se pregunta. Se inyecta **para poder probar el bucle sin red**, y lo que hay que probar es
   * caro: que el sello de revisión se estampe SIEMPRE —incluso cuando nada cambió— es lo único que
   * hace avanzar la cola, y equivocarse ahí no da error: los mismos dos mensajes se revisan por
   * siempre y el resto no se mira nunca.
   */
  preguntar: PreguntarEstado = estadoDeMensaje,
): Promise<ResultadoDeRevision> {
  const pendientes = await pendientesDeRevision(orgId);

  let llamadas = 0;
  let resueltos = 0;
  let desconocidos = 0;

  for (const m of pendientes) {
    const r = await preguntar(acceso, m.ghl_mensaje_id);
    llamadas++;

    if (r.tipo === 'fallo') {
      // No se pudo preguntar. **No se marca revisado**: quedaría al final de la cola por un
      // problema que no es suyo. Se corta el ciclo — insistir contra algo que acaba de decir que no
      // es gastar el resto del presupuesto en el mismo error.
      break;
    }

    if (r.datos === null) {
      // El CRM no conoce ese identificador. Es un HECHO, no un fallo, y no se puede resolver
      // preguntando de nuevo: se saca de la cola marcándolo `desconocido`. Dejarlo `en_curso` lo
      // haría volver en cada ciclo, para siempre, por una respuesta que no va a cambiar.
      await marcar(orgId, m.id, {
        estado_entrega: null,
        estado_entrega_familia: 'desconocido',
        fallo_del_canal: 'GoHighLevel no reconoce este mensaje.',
      });
      desconocidos++;
      continue;
    }

    const familia = familiaDeEntrega(r.datos.estado);
    await marcar(orgId, m.id, {
      estado_entrega: r.datos.estado,
      estado_entrega_familia: familia,
      // El texto del canal cuando rechazó. Es lo ÚNICO que explica por qué no llegó, y sin él la
      // burbuja en rojo solo dice que algo salió mal.
      fallo_del_canal: familia === 'fallido' ? (r.datos.estado ?? 'El canal lo rechazó.') : null,
    });
    if (familia !== 'en_curso') resueltos++;
  }

  return { revisados: llamadas, resueltos, desconocidos, llamadas };
}

/**
 * La cola: qué mensajes hay que ir a preguntar, en qué orden, y cuántos.
 *
 * **Está separada y exportada para poder probarla sin red**, y es lo que más lo necesita de todo el
 * archivo: los tres recortes del encabezado viven acá, y equivocarse en cualquiera de ellos no da
 * error — da una cola que no se vacía nunca y una factura que crece sola.
 */
export async function pendientesDeRevision(orgId: string, ahora: Date = new Date()) {
  return conOrganizacion(orgId, async () =>
    datos()
      .selectFrom('mensajes')
      .select(['id', 'ghl_mensaje_id', 'estado_entrega_familia'])
      .where('direccion', '=', 'saliente')
      .where('estado_entrega_familia', '=', 'en_curso')
      .where('id_fabricado', '=', false)
      .where('enviado_el', '>', new Date(ahora.getTime() - VENTANA_MS))
      .orderBy(sql`estado_entrega_revisado_el nulls first`)
      // Desempate estable: sin esto, dos mensajes nunca revisados salen en orden distinto en cada
      // pedido y la cola avanza de a saltos.
      .orderBy('enviado_el', 'asc')
      .limit(POR_CICLO)
      .execute(),
  );
}

/**
 * Escribe el estado. El `update` de `estado_entrega_familia` dispara
 * `mensajes_reabren_por_entrega`, que recalcula `ultimo_saliente_el` sin contar los rechazados.
 *
 * Sin ese disparador, enterarse de que un mensaje falló sería un dato guardado en una columna que no
 * cambia ninguna cola: el contacto seguiría contando como «respondido» con un mensaje que nunca
 * llegó, y eso es la mitad del defecto original todavía en pie.
 */
async function marcar(
  orgId: string,
  id: string,
  campos: {
    estado_entrega: string | null;
    estado_entrega_familia: 'en_curso' | 'entregado' | 'fallido' | 'desconocido';
    fallo_del_canal: string | null;
  },
): Promise<void> {
  await conOrganizacion(orgId, async () => {
    await datos()
      .updateTable('mensajes')
      .set({
        ...campos,
        estado_entrega_el: new Date(),
        // SIEMPRE, aunque no haya cambiado nada. Es lo que hace que la cola avance: sin esto, los
        // dos primeros de la lista se revisarían en cada ciclo y el resto no se miraría nunca.
        estado_entrega_revisado_el: new Date(),
      } as never)
      .where('id', '=', id)
      .execute();
  });
}
