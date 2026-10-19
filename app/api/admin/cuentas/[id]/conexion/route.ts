// ADR-0301 — Toda operación llama al portero.
//
// La conexión de UN cliente (el nivel 3): su token y su calendario del CRM, su dominio de reservas, el usuario de su
// agente, su Meta y el secreto de su aviso.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES DEL CLIENTE Y QUÉ NO
//
// Un cliente con su propia subcuenta trae SUS datos con SUS credenciales (`identidad.cuentas_credenciales`). Las del
// cliente por omisión son las de la empresa y se cargan en Ajustes › Credenciales: acá responden 409, para que no
// existan dos lugares donde escribir lo mismo. La subcuenta (la location) tampoco se carga acá: la vincula ARIA
// (`/vinculo`), porque es única en toda la plataforma. La llave de IA, tl;dv y los pagos son de la empresa.
//
// La capacidad es la de las credenciales de la empresa —`credenciales.ver` y `credenciales.editar`—, con su misma
// pantalla: quien puede cargar el token de la empresa puede cargar el de sus clientes, y nadie más. Sólo clientes de la
// organización efectiva (un id de otra empresa es 404), y todo auditado, sin que ningún valor llegue al registro.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'node:crypto';
import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { autorDelCambio } from '../../../../../../lib/autorizacion/sesion.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { cifrar } from '../../../../../../lib/credenciales/cifrado.ts';
import { resolverCredencialesDelCliente } from '../../../../../../lib/credenciales/resolver.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPE = 4096;
const DEL_PRINCIPAL =
  'Las credenciales del cliente principal son las de la empresa: se cargan en Ajustes › Credenciales.';

/** Lo que se carga de un cliente, y a qué columna va. `secreto` = se cifra y nunca sale. */
const CAMPOS = [
  { entrada: 'crmToken', columna: 'crm_token_cifrado', secreto: true },
  { entrada: 'crmRefresco', columna: 'crm_refresh_cifrado', secreto: true },
  { entrada: 'crmCalendarioId', columna: 'crm_calendario_id', secreto: false },
  { entrada: 'crmDominioReservas', columna: 'crm_dominio_reservas', secreto: false },
  { entrada: 'crmAgenteUsuarioId', columna: 'crm_agente_usuario_id', secreto: false },
  { entrada: 'metaToken', columna: 'meta_token_cifrado', secreto: true },
  { entrada: 'metaCuentaId', columna: 'meta_cuenta_id', secreto: false },
] as const;

type Contexto = Exclude<Awaited<ReturnType<typeof exigir>>, Response>;

/** El cliente pedido, de la organización efectiva, o el rechazo. */
async function elCliente(contexto: Contexto, id: string) {
  if (!UUID.test(id)) return rechazo('no_encontrado');
  const vista = await conIdentidad((db) => resolverCredencialesDelCliente(db, contexto.orgEfectiva, id));
  if (!vista) return rechazo('no_encontrado');
  return vista;
}

export async function GET(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/conexion'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const vista = await elCliente(contexto, (await ctx.params).id);
  return vista instanceof Response ? vista : ok(vista);
}

export async function PUT(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/conexion'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  const vista = await elCliente(contexto, id);
  if (vista instanceof Response) return vista;
  if (vista.esPorOmision) return rechazo('cliente_principal', DEL_PRINCIPAL);

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  if (cuerpo === null || typeof cuerpo !== 'object') return rechazo('peticion_invalida', 'Faltan los campos.');
  const c = cuerpo as Record<string, unknown>;

  const cambios: Record<string, string | null> = {};
  for (const campo of CAMPOS) {
    if (!Object.hasOwn(c, campo.entrada)) continue;
    const valor = c[campo.entrada];
    if (valor === null) {
      cambios[campo.columna] = null;
      continue;
    }
    if (typeof valor !== 'string') return rechazo('peticion_invalida', `El campo ${campo.entrada} va como texto o null.`);
    const limpio = valor.trim();
    // La cadena vacía NO es un borrado, igual que en las de la empresa: quien quiera borrar manda `null`.
    if (limpio.length === 0) return rechazo('peticion_invalida', `El campo ${campo.entrada} llegó vacío. Para quitarlo, null.`);
    if (limpio.length > TOPE) return rechazo('peticion_invalida', `El campo ${campo.entrada} supera los ${TOPE} caracteres.`);
    cambios[campo.columna] = campo.secreto ? cifrar(limpio) : limpio;
  }
  if (Object.keys(cambios).length === 0) return rechazo('peticion_invalida', 'No vino ningún campo conocido. Nada se guardó.');
  // Un token nuevo deja la conexión activa; uno borrado, ausente. Lo demás no toca el estado.
  if (Object.hasOwn(cambios, 'crm_token_cifrado')) {
    cambios['crm_estado'] = cambios['crm_token_cifrado'] === null ? 'ausente' : 'activa';
    cambios['crm_expira_el'] = null;
  }

  return conIdentidad(async (db) => {
    await db
      .insertInto('cuentas_credenciales')
      .values({
        org_id: contexto.orgEfectiva,
        cuenta_id: id,
        actualizado_por: autorDelCambio(contexto),
        actualizado_el: new Date(),
        ...cambios,
      } as never)
      .onConflict((oc) =>
        oc.column('cuenta_id').doUpdateSet({ actualizado_por: autorDelCambio(contexto), actualizado_el: new Date(), ...cambios } as never),
      )
      .execute();
    await auditarAdministracion(db, { accion: 'credenciales_cargadas', actor: contexto.usuarioId, objetivo: id, orgId: contexto.orgEfectiva });
    return ok(await resolverCredencialesDelCliente(db, contexto.orgEfectiva, id));
  });
}

/** Genera (o rota) el secreto del aviso del CRM de este cliente. El valor completo sale UNA sola vez, acá. */
export async function POST(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/conexion'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  const vista = await elCliente(contexto, id);
  if (vista instanceof Response) return vista;
  if (vista.esPorOmision) return rechazo('cliente_principal', DEL_PRINCIPAL);

  const secreto = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(secreto).digest('hex');

  return conIdentidad(async (db) => {
    await db
      .insertInto('cuentas_credenciales')
      .values({ org_id: contexto.orgEfectiva, cuenta_id: id, aviso_secreto_hash: hash } as never)
      .onConflict((oc) => oc.column('cuenta_id').doUpdateSet({ aviso_secreto_hash: hash } as never))
      .execute();
    await auditarAdministracion(db, { accion: 'aviso_secreto_generado', actor: contexto.usuarioId, objetivo: id, orgId: contexto.orgEfectiva });
    // La cabecera completa, una sola vez, como la de la empresa: el workflow del CRM de este cliente la manda en
    // `x-webhook-secret`. Sin pimienta, la marca visible.
    const pimienta = process.env.AVISO_PIMIENTA ?? 'FALTA_LA_PIMIENTA';
    return ok({
      ...(await resolverCredencialesDelCliente(db, contexto.orgEfectiva, id)),
      avisoCabecera: `${pimienta}.${secreto}`,
      avisoPimientaConfigurada: process.env.AVISO_PIMIENTA !== undefined,
    });
  });
}
