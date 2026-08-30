// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el MISMO conjunto de capacidades.
//
// El detalle de UNA empresa del Panel de Monitoreo: qué scrapeó, y qué leads le quedaron.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS MISMAS DOS MITADES QUE LA TABLA, Y NO PUEDEN SER OTRAS
//
// `['monitoreo.ver']` y `PANTALLA = 'monitoreo'`, exactamente iguales a `../route.ts`. No es
// repetición: `ADR-0304` compara los CONJUNTOS de todas las operaciones de una pantalla, y pedir
// aquí algo distinto produce el defecto que esa regla existe para evitar — *"una sección con
// datos y cuatro en blanco, sin ningún error"* (07 § 2). En esta pantalla sería peor todavía: la
// tabla cargaría, y hacer clic en una empresa daría 403 sin que nada explique por qué.
//
// Y la segunda mitad —ser de la organización principal— se vuelve a comprobar acá. Copiarla es
// deliberado: una ruta que confía en que "la otra ya validó" es una ruta sin validación, porque
// nadie está obligado a pasar por la tabla antes de pedir este `GET`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTA RUTA *NO* HACE, Y ES LO QUE LA MANTIENE SEGURA
//
// No lee ni una fila de negocio con un `where org_id = …`. Abre `conOrganizacion(orgId, …)` y
// consulta adentro, así que las dos lecturas pasan por la política de RLS de esa empresa — la
// misma que pasaría una petición hecha por ella. Si mañana alguien escribe mal una consulta en
// `lib/monitoreo/detalle.ts`, la base sigue devolviendo sólo lo de esa organización.
//
// Lo que cruza organizaciones es UNA decisión, arriba y a la vista: qué `orgId` se abre. Y esa
// decisión está detrás del portero y de la regla de la principal.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../../lib/autorizacion/secciones.ts';
import { listarOrganizaciones } from '../../../../lib/administracion/organizaciones.ts';
import { FUENTES } from '../../../../lib/monitoreo/fuentes.ts';
import {
  leadsDeLaOrganizacion,
  trabajosDeLaOrganizacion,
} from '../../../../lib/monitoreo/detalle.ts';

export const PANTALLA = 'monitoreo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las fuentes que el filtro acepta.
 *
 * Son las cinco del `check` de `aria_cc_scraper_trabajos.fuente` **más `facebook`**, que no está
 * en ese `check` y sí es un valor real de `aria_cc_scraper_leads.source`: el backend guarda las
 * dos variantes de Facebook con esa etiqueta corta, y los leads copiados de la base vieja también
 * la traen. Es la misma lista que acepta `app/api/tools/leads/route.ts`, y por el mismo motivo.
 *
 * Se valida contra la lista en vez de pasarla tal cual porque un valor inventado devolvería cero
 * filas — que en pantalla se lee como *"esta empresa no tiene leads"*, no como *"el filtro está
 * mal"*.
 */
const FUENTES_DEL_FILTRO: readonly string[] = [...FUENTES, 'facebook'];

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/monitoreo/[orgId]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['monitoreo.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  if (!esDeLaPrincipal(contexto)) {
    return rechazo(
      'sin_permiso',
      'El Panel de Monitoreo es de la organización principal: mide el consumo de todas las empresas.',
    );
  }

  const { orgId } = await ctx.params;
  // Se valida ANTES de abrir el contexto. `conOrganizacion` lanza sobre un identificador que no es
  // un uuid, y ese error saldría como 500 desde el fondo de la capa de datos en vez de como el
  // rechazo que es.
  if (!UUID.test(orgId)) return rechazo('no_encontrado');

  const parametros = new URL(peticion.url).searchParams;
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);

  const fuente = parametros.get('fuente') ?? '';
  if (fuente && !FUENTES_DEL_FILTRO.includes(fuente)) {
    return rechazo('peticion_invalida', 'Fuente desconocida.');
  }

  /* ── LA EMPRESA SE RESUELVE CON LA MISMA LISTA QUE DIBUJA LA TABLA ─────────
   *
   * `listarOrganizaciones` y no una consulta propia por `id`, y la diferencia importa: esa función
   * ya deja afuera `control-a` y `control-b`, las dos organizaciones de la sonda de aislamiento
   * que son INFRAESTRUCTURA y no clientes. Con una consulta propia, un identificador escrito a
   * mano abriría el detalle de una de ellas — no filtraría datos de nadie (nacen vacías), pero
   * expondría la existencia de un mecanismo interno en una pantalla de negocio.
   *
   * Que la exclusión sea LA MISMA es el punto: dos listas que tienen que coincidir son dos listas
   * que se desincronizan, y acá la que se desincronizara sería la que nadie mira.
   *
   * Cuesta una consulta sobre una tabla de diez filas. */
  const empresa = (await conIdentidad(async (db) => listarOrganizaciones(db))).find(
    (o) => o.id === orgId,
  );
  // `no_encontrado` y no `sin_permiso`: quien llega hasta acá ya tiene el panel entero, así que no
  // hay nada que ocultarle. Lo que hay es un identificador que no corresponde a ninguna empresa.
  if (!empresa) return rechazo('no_encontrado');

  const { trabajos, leads } = await conOrganizacion(orgId, async () => ({
    // Las dos en la MISMA transacción, así que las dos ven el mismo estado. Con dos transacciones
    // sueltas, un trabajo que termina en el medio dejaría el conteo de trabajos y la lista de
    // leads describiendo instantes distintos.
    trabajos: await trabajosDeLaOrganizacion(),
    leads: await leadsDeLaOrganizacion(pagina, fuente),
  }));

  return ok({
    empresa: {
      orgId: empresa.id,
      nombre: empresa.nombre,
      slug: empresa.slug,
      esPrincipal: empresa.esPrincipal,
    },
    trabajos: trabajos.trabajos,
    hayMasTrabajos: trabajos.hayMas,
    leads: leads.leads,
    pagina,
    hayMasLeads: leads.hayMas,
  });
}
