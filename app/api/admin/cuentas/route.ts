// ADR-0301 — Toda operación llama al portero.
//
// Los clientes de una empresa (el nivel 3): la lista y el alta. Ajustes › Clientes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR DÓNDE ESCRIBE, Y POR QUÉ
//
// Un cliente es una cuenta (`identidad.cuentas`): una subcuenta del CRM dentro de una empresa. La empresa los da de
// alta por el INQUILINO, dentro de `conOrganizacion` con la organización entera, y no por identidad: así la política
// de la `086` es la que la acota a su organización, y un `orgId` mal puesto no llega a otra. Es la misma decisión que
// el borrado de personas (`012`): una superficie más ancha a cambio de un límite duro.
//
// La plataforma puede operar sobre otra empresa con `orgId` —el tablero de Negocios agrega clientes sin conmutar la
// sesión—, con la misma condición que el alta de personas (`empresaDestino`). Lo que no se puede desde acá: escribir
// la subcuenta del CRM o la marca de prueba. Eso es `[id]/vinculo`, sólo la plataforma.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { autorDelCambio } from '../../../../lib/autorizacion/sesion.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { esZonaValida } from '../../../../lib/negocio/zonas.ts';
import { closersDeLaEmpresa, closersSinVinculoEn } from '../../../../lib/negocio/alcanceDelCloser.ts';
import {
  catalogoDelCliente,
  crearCuenta,
  diceLosClosersSinVincular,
  empresaDestino,
  leerDatosDeUnCliente,
  listarCuentas,
  quienConfirma,
  rechazoDeLaBase,
} from '../../../../lib/administracion/cuentas.ts';

export const PANTALLA = 'clientes';

/** La empresa entera, con todos sus clientes: lo único desde lo que se da de alta y se lista. */
const entera = (orgId: string) => ({ orgId, todaLaOrganizacion: true, cuentas: '*' as const });

/** Los clientes de la empresa, y el catálogo que necesita su formulario. */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cuentas.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const destino = empresaDestino(contexto, new URL(peticion.url).searchParams.get('orgId'));
  if (destino === null) return rechazo('no_encontrado');

  const cuerpo = await conOrganizacion(entera(destino), async () => {
    const clientes = await listarCuentas();
    /* Por cliente ACTIVO, los closers vinculados en otro y no en éste: no ven sus contactos (C6). Uno en pausa no se
       barre ni se trabaja, y lo dice su activación. Con un solo cliente nunca hay nadie. */
    const closers = diceLosClosersSinVincular(contexto, destino) ? await closersDeLaEmpresa() : null;
    return {
      clientes: clientes.map((c) => {
        const sin = closers === null || c.estado !== 'activa' ? [] : closersSinVinculoEn(c.id, closers);
        return sin.length > 0 ? { ...c, closersSinVincular: sin.map((k) => k.nombre) } : c;
      }),
      catalogo: await catalogoDelCliente(),
    };
  });
  return ok(cuerpo);
}

/** El alta de un cliente. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cuentas.crear'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  if (cuerpo === null || typeof cuerpo !== 'object') return rechazo('peticion_invalida', 'Falta el cliente.');
  const c = cuerpo as Record<string, unknown>;
  if (c.nombre === undefined) return rechazo('peticion_invalida', 'El cliente necesita un nombre.');
  if (c.estado !== undefined) return rechazo('peticion_invalida', 'Un cliente nace activo.');
  const leidos = leerDatosDeUnCliente(c, esZonaValida);
  if (typeof leidos === 'string') return rechazo('peticion_invalida', leidos);

  const destino = empresaDestino(contexto, c.orgId);
  if (destino === null) return rechazo('no_encontrado');
  // Una persona de la empresa confirma con su nombre; ARIA operando sobre otra empresa, sin persona.
  const quien = quienConfirma(destino === contexto.orgEfectiva ? autorDelCambio(contexto) : null);

  try {
    const { id, sinVincular } = await conOrganizacion(entera(destino), async () => {
      const nuevo = await crearCuenta({ ...leidos, nombre: leidos.nombre ?? '' }, quien);
      await auditarAdministracion(datos(), {
        accion: 'cuenta_creada',
        actor: contexto.usuarioId,
        objetivo: nuevo,
        orgId: destino,
      });
      /* Los closers vinculados en otro cliente no ven al nuevo hasta que alguien los vincule en él (C6): la respuesta los
         nombra, para que el alta lo diga en vez de dejarlo para cuando alguien note que faltan contactos. */
      const sin = diceLosClosersSinVincular(contexto, destino) ? closersSinVinculoEn(nuevo, await closersDeLaEmpresa()) : [];
      return { id: nuevo, sinVincular: sin.map((k) => k.nombre) };
    });
    return ok({ creado: true, id, ...(sinVincular.length > 0 ? { closersSinVincular: sinVincular } : {}) }, 201);
  } catch (e) {
    return rechazoDeLaBase(e);
  }
}

