// ADR-0301 — Toda operación llama al portero.
//
// Los clientes de un cliente final: reemplaza el conjunto entero (el nivel 3).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE Y QUÉ NO
//
// Un cliente final es una persona limitada a sus cuentas (`usuarios.limitado_a_cuentas`, `087`). Esta operación
// reemplaza sus cuentas. Reemplaza y no suma, igual que las pestañas: lo que se manda es lo que queda.
//
//   · sólo a una persona limitada: a otra, una fila acá no significa nada, y la base la rechaza (`087`);
//   · nunca deja a nadie en cero: un cliente final sin cuentas no ve nada y no tiene cómo arreglarlo. Para sacarle
//     el acceso está desactivarlo;
//   · sólo cuentas de la empresa que mira la sesión: la clave foránea de `usuarios_cuentas` exige la misma
//     organización, y una cuenta ajena sale como 404;
//   · por identidad, porque sólo ese rol tiene permiso sobre `usuarios_cuentas`, y con `usuarioObjetivo(`, que es la
//     línea que acota la persona a la empresa (la política de identidad es `using (true)`).
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../../lib/autorizacion/secciones.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { autorDelCambio } from '../../../../../../lib/autorizacion/sesion.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { usuarioObjetivo } from '../../../../../../lib/administracion/objetivo.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { MAXIMO_DE_CUENTAS } from '../../../../../../lib/datos/contexto.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(peticion: Request, ctx: RouteContext<'/api/admin/usuarios/[id]/cuentas'>): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.editar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const cuentas = (cuerpo as { cuentas?: unknown } | null)?.cuentas;
  if (!Array.isArray(cuentas) || cuentas.some((c) => typeof c !== 'string' || !UUID.test(c))) {
    return rechazo('peticion_invalida', 'Las cuentas van como una lista de identificadores.');
  }
  const pedidas = [...new Set(cuentas as string[])];
  if (pedidas.length === 0) {
    return rechazo(
      'peticion_invalida',
      'Un cliente final sin ningún cliente no ve nada y no tiene cómo arreglarlo. Para sacarle el acceso, desactívalo.',
    );
  }
  if (pedidas.length > MAXIMO_DE_CUENTAS) return rechazo('peticion_invalida', `Como mucho ${MAXIMO_DE_CUENTAS} clientes.`);

  return conIdentidad(async (db) => {
    const objetivo = await usuarioObjetivo(db, id, contexto.orgEfectiva);
    if (!objetivo) return rechazo('no_encontrado');
    if (!objetivo.limitado_a_cuentas) {
      return rechazo('peticion_invalida', 'Esta persona no es un cliente final: ve todos los clientes de su empresa.');
    }
    // Las cuentas tienen que ser de la empresa y no estar de baja. Preguntarlo antes es lo que separa «no existe» (404)
    // de un `23503` que subiría nombrando una tabla.
    const validas = await db
      .selectFrom('cuentas')
      .select('id')
      .where('org_id', '=', contexto.orgEfectiva)
      .where('estado', '<>', 'baja')
      .where('id', 'in', pedidas)
      .execute();
    if (validas.length !== pedidas.length) return rechazo('no_encontrado');

    try {
      await db.deleteFrom('usuarios_cuentas').where('usuario_id', '=', objetivo.id).execute();
      await db
        .insertInto('usuarios_cuentas')
        .values(
          pedidas.map((cuenta_id) => ({
            org_id: contexto.orgEfectiva,
            usuario_id: objetivo.id,
            cuenta_id,
            // QUIÉN LO HIZO, o nulo si la plataforma opera sobre otra empresa (la clave foránea exige la misma
            // organización; quién fue queda en la auditoría).
            concedida_por: autorDelCambio(contexto),
          })),
        )
        .execute();
    } catch (e) {
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador ? rechazo('rechazo_de_la_base', deDisparador) : rechazo('rechazo_de_la_base');
    }
    await auditarAdministracion(db, {
      accion: 'cuentas_asignadas',
      actor: contexto.usuarioId,
      objetivo: objetivo.id,
      orgId: contexto.orgEfectiva,
    });
    return ok({ cuentas: pedidas });
  });
}
