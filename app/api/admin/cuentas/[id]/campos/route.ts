// ADR-0301 — Toda operación llama al portero.
//
// El Perfil de UN cliente (el nivel 3, C6 · D4): qué carpetas de campos se muestran en el Perfil y en qué grupo, y el
// campo del cuadrante del ICP de su CRM, que se muestra y no se elige (la `105`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO SON CREDENCIALES, Y POR ESO TAMBIÉN EL PRINCIPAL
//
// Hasta la `098` se reconocían solos —por el id de la subcuenta de ARIA o por el nombre del snapshot—, y un cliente con
// otros nombres se quedaba sin Perfil. Lo elegido vive en el catálogo de campos de ese cliente
// (`carpetas_del_crm.grupo_elegido_el`), así que esta ruta corre como inquilino con el
// foco en él (`ambitoDeUnCliente`): la política por cuenta de la `083` acota lo que lee y lo que escribe, y nunca abre
// una transacción de identidad. A diferencia de la Conexión, el principal se acepta: su catálogo es de su subcuenta
// como el de cualquiera, aunque sus credenciales sean las de la empresa.
//
// La capacidad es la de la Conexión —`credenciales.ver` para leer, `credenciales.editar` para elegir—, con su misma
// pantalla. Sólo clientes que la sesión ve (de la empresa efectiva y no de baja): otro id es 404. Todo auditado, sin el
// cuerpo (ADR-0407).
//
// ── EL PUNTAJE YA NO SE ELIGE (la `105`, 2026-10-26) ─────────────────────────
//
// Desde la `098` hasta acá esta ruta elegía también qué campo del CRM era el puntaje de cada cliente. El ICP pasó a ser
// el cuadrante que manda el CRM en `contact.cuadrante_de_clasificacion`, el mismo campo en todos los clientes, y se
// reconoce solo por su clave: no hay nada que elegir. Un cuerpo con «puntaje» se rechaza diciéndolo, en vez de ignorarse
// en silencio. Lo que la `098` dejó elegido sigue en la base y la sincronización lo usa para `score`, que nadie lee.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../../lib/datos/contexto.ts';
import { auditarAdministracion, type Detalle } from '../../../../../../lib/autenticacion/auditoria.ts';
import { ambitoDeUnCliente } from '../../../../../../lib/negocio/ambitoDelCliente.ts';
import {
  GRUPOS_DEL_PERFIL,
  catalogoDelCliente,
  elegirLosGrupos,
  porQueNoSePuedeElegir,
  type EleccionDelCatalogo,
} from '../../../../../../lib/negocio/camposDelCrm.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** El largo de un id de GoHighLevel razonable: los de hoy tienen veinte caracteres. */
const LARGO_DE_UN_ID = 100;
/** Cuántas carpetas en una sola petición. La subcuenta de ARIA tiene 24. */
const TOPE_DE_CARPETAS = 200;
const SIN_PUNTAJE =
  'El puntaje ya no se elige: el ICP es el cuadrante que manda el CRM (contact.cuadrante_de_clasificacion), y se ' +
  'reconoce solo en cada cliente. Nada se guardó.';

type Contexto = Exclude<Awaited<ReturnType<typeof exigir>>, Response>;

/** El cliente pedido, entre los que la sesión ve, o el 404: de otra empresa, de baja o inexistente es lo mismo. */
function elCliente(contexto: Contexto, id: string) {
  if (!UUID.test(id)) return rechazo('no_encontrado');
  return contexto.cuentas.visibles.find((c) => c.id === id) ?? rechazo('no_encontrado');
}

const esUnId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= LARGO_DE_UN_ID;

/** La elección del cuerpo, o por qué no se puede leer. Nada de esto mira la base. */
function eleccionDe(cuerpo: unknown): EleccionDelCatalogo | string {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return 'Faltan los campos.';
  const c = cuerpo as Record<string, unknown>;
  if (Object.hasOwn(c, 'puntaje')) return SIN_PUNTAJE;
  const eleccion: EleccionDelCatalogo = { carpetas: [] };
  if (Object.hasOwn(c, 'carpetas')) {
    if (!Array.isArray(c.carpetas) || c.carpetas.length === 0) return '«carpetas» va como una lista con al menos una carpeta.';
    if (c.carpetas.length > TOPE_DE_CARPETAS) return `Son más de ${TOPE_DE_CARPETAS} carpetas en una sola petición.`;
    const carpetas: { carpetaId: string; grupo: (typeof GRUPOS_DEL_PERFIL)[number]['clave'] | null }[] = [];
    for (const x of c.carpetas as unknown[]) {
      const f = (x ?? {}) as { carpetaId?: unknown; grupo?: unknown };
      if (!esUnId(f.carpetaId)) return 'Cada carpeta va con su «carpetaId», el id de la carpeta en el CRM.';
      const grupo = GRUPOS_DEL_PERFIL.find((g) => g.clave === f.grupo)?.clave ?? null;
      if (f.grupo !== null && grupo === null) {
        return `El grupo de una carpeta es uno de ${GRUPOS_DEL_PERFIL.map((g) => g.clave).join(', ')}, o null para no mostrarla.`;
      }
      if (carpetas.some((y) => y.carpetaId === f.carpetaId)) return `La carpeta «${f.carpetaId}» vino dos veces.`;
      carpetas.push({ carpetaId: f.carpetaId, grupo });
    }
    eleccion.carpetas = carpetas;
  }
  if (eleccion.carpetas.length === 0) return 'No vino «carpetas». Nada se guardó.';
  return eleccion;
}

export async function GET(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/campos'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const cliente = elCliente(contexto, (await ctx.params).id);
  if (cliente instanceof Response) return cliente;
  const catalogo = await conOrganizacion(ambitoDeUnCliente(contexto.orgEfectiva, cliente.id), () => catalogoDelCliente(cliente.id));
  // Quien sólo ve no recibe botones que van a dar 403 (`Clientes.jsx`): la pantalla se dibuja de sólo lectura.
  return ok({ ...catalogo, puedeEditar: contexto.permisos.has('credenciales.editar') });
}

export async function PUT(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/campos'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const cliente = elCliente(contexto, (await ctx.params).id);
  if (cliente instanceof Response) return cliente;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const eleccion = eleccionDe(cuerpo);
  if (typeof eleccion === 'string') return rechazo('peticion_invalida', eleccion);

  const auditar = (accion: 'carpeta_del_perfil_elegida', detalle: Pick<Detalle, 'carpeta' | 'grupo'>) =>
    auditarAdministracion(datos(), {
      accion,
      actor: contexto.usuarioId,
      objetivo: cliente.id,
      orgId: contexto.orgEfectiva,
      detalle: { cuenta: cliente.id, ...detalle },
    });

  return conOrganizacion(ambitoDeUnCliente(contexto.orgEfectiva, cliente.id), async () => {
    // Todo se valida antes de escribir nada: una carpeta ajena no deja a medias las demás.
    const porque = await porQueNoSePuedeElegir(cliente.id, eleccion);
    if (porque !== null) return rechazo('peticion_invalida', porque);
    for (const c of await elegirLosGrupos(cliente.id, eleccion.carpetas)) {
      await auditar('carpeta_del_perfil_elegida', { carpeta: c.carpetaId, grupo: c.grupo });
    }
    // El estado RESUELTO, no un «ok»: lo que quedó, no lo que se mandó.
    return ok({ ...(await catalogoDelCliente(cliente.id)), puedeEditar: true });
  });
}
