// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Resolver una intervención del auditor: cerrarla acá y reactivar el agente en el CRM.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «SE HIZO» Y «SALIÓ BIEN» SON DOS HECHOS, Y VIAJAN SEPARADOS
//
// Son dos sistemas y entre ellos no hay atomicidad, así que se sigue el mismo orden que
// `avanzar`: **primero la base, después el CRM**. Y la parte que hace falta decir es la del final.
//
// Una resolución que cerró el aviso y **no pudo quitar la etiqueta no devuelve un error**. La
// resolución ya ocurrió: el contacto salió de la cola, quedó el rastro de quién lo tomó, y el aviso
// está cerrado. Devolver un 502 haría que el vendedor apretara el botón otra vez sobre algo que ya
// está hecho, y a la tercera dejaría de leerlo.
//
// Lo que sí tiene una consecuencia real es esto: **mientras la etiqueta siga puesta, el CRM mantiene
// el agente pausado.** Eso viaja en `crm`, aparte del éxito, exactamente como el aviso de `avanzar`.
//
// ── POR QUÉ `SIN_SECCION` Y NO LA PANTALLA DEL CLOSER ──────────────────────
//
// La cola roja está en las DOS pestañas, y `ADR-0304` exige que las operaciones de una pantalla pidan
// el mismo conjunto de capacidades. Con `PANTALLA = 'closer'`, un setter resolviendo desde su propia
// cola recibiría un 403 sobre un contacto suyo. Es el mismo caso que la ficha del contacto, que se
// abre desde las dos y por eso está en `SIN_PANTALLA`.
//
// ── Y LA CAPACIDAD NO ES `contactos.avanzar` ───────────────────────────────
//
// Avanzar registra un RESULTADO: cambia la etapa, alimenta la comisión, mueve al contacto de columna.
// Esto cierra un aviso y le quita etiquetas al CRM. Con una sola capacidad para las dos, conceder la
// primera concedería la segunda **en silencio** — que es la lección que la Etapa 12 dejó escrita para
// borrar y desactivar.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import { resolverLaIntervencion } from '../../../../../lib/auditor/intervencion.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/resolver'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.resolver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  /* El contacto se lee para dos cosas: comprobar que existe **en esta organización** —el aislamiento
     lo hace la política de la base, así que un contacto de otra empresa sale como no encontrado, que
     es lo que `ADR-0501` pide— y sacar su identificador del CRM, sin el cual no hay a quién quitarle
     etiquetas. */
  const contacto = await conOrganizacion(contexto.orgEfectiva, () =>
    datos()
      .selectFrom('contactos')
      .select(['ghl_contact_id'])
      .where('id', '=', id)
      .executeTakeFirst(),
  );
  if (!contacto) return rechazo('no_encontrado');

  const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, contexto.orgEfectiva));
  if (acceso.tipo !== 'listo') {
    /* ── SIN TOKEN NO SE RESUELVE, Y ES DELIBERADO ─────────────────────────
     *
     * Tienta cerrar el aviso igual y decir que el CRM no se pudo tocar. Sería peor que no hacer nada:
     * el contacto sale de la cola —nadie lo vuelve a mirar— y **el agente se queda pausado para
     * siempre**, porque la etiqueta que lo pausa nadie la va a quitar. Un estado sin salida.
     *
     * Con el rechazo, el aviso sigue abierto y visible, que es el estado de antes. */
    return rechazo('servicio_externo_no_disponible', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  const r = await resolverLaIntervencion({
    orgId: contexto.orgEfectiva,
    contactoId: id,
    ghlContactId: contacto.ghl_contact_id,
    quien: contexto.usuarioId,
    acceso,
  });

  return ok({
    resuelto: r.resuelto,
    intervenciones: r.intervenciones,
    hallazgos: r.hallazgos,
    /* ── LO QUE PASÓ CON EL CRM, DICHO APARTE ──────────────────────────────
     *
     * Mismo criterio que `avanzar`: no es un detalle de implementación. Mientras la etiqueta siga
     * puesta el agente sigue pausado, y quien resolvió tiene que poder saberlo. Colapsarlo en el
     * éxito general sería reportar como completo un éxito a medias. */
    crm: r.etiquetasQuitadas
      ? { etiquetasQuitadas: true }
      : { etiquetasQuitadas: false, porque: r.porque ?? 'desconocido' },
  });
}
