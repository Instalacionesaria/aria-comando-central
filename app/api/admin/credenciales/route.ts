// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0606 — Un estado ausente y uno vencido no se muestran igual.
//
// Las credenciales de la organización efectiva: leerlas enmascaradas y cargarlas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CAMINO Y EL MÉTODO SON UNA DECISIÓN, NO UNA LECTURA
//
// **Ningún documento de los catorce da una ruta de credenciales.** Un grep de `/credenciales` sobre
// la especificación devuelve cero: el `03` § 6 lista rutas literales de autenticación y el `09` § 5
// también, y ninguna es de credenciales.
//
// Así que `GET`/`PUT /api/admin/credenciales` sigue la forma de las rutas de administración que ya
// existen, y queda declarado en `docs/ETAPA-6.md`. Lo que **sí** es del documento es todo lo demás:
// el enmascarado, los cuatro estados con su texto, y que el valor no sale nunca.
//
// ── EL ENMASCARADO SE CALCULA EN EL SERVIDOR ─────────────────────────────────
//
// `resolverCredenciales()` devuelve `vistaPrevia`, nunca el valor. Si el valor completo viajara para
// enmascararlo en el navegador, el secreto ya salió y el asterisco sería decoración sobre un dato
// que está en las herramientas de desarrollo.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { cifrar } from '../../../../lib/credenciales/cifrado.ts';
import { resolverCredenciales } from '../../../../lib/credenciales/resolver.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

export const PANTALLA = 'credenciales';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver']);
  if (contexto instanceof Response) return contexto;

  const credenciales = await conIdentidad(async (db) =>
    resolverCredenciales(db, contexto.orgEfectiva),
  );
  return ok(credenciales);
}

export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar']);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ guardada: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const token = (cuerpo as { crmToken?: unknown } | null)?.crmToken;
  const refresco = (cuerpo as { crmRefresco?: unknown } | null)?.crmRefresco;
  if (typeof token !== 'string' || token.length === 0) {
    return ok({ guardada: false, motivo: 'falta_crm_token' }, 400);
  }

  return conIdentidad(async (db) => {
    // La fila puede no existir: una organización nueva nace sin ninguna (05 § 2). `on conflict` es
    // lo que hace que cargar la primera credencial y rotar una existente sean el mismo camino.
    await db
      .insertInto('organizaciones_credenciales')
      .values({
        org_id: contexto.orgEfectiva,
        crm_token_cifrado: cifrar(token),
        crm_refresh_cifrado: typeof refresco === 'string' && refresco ? cifrar(refresco) : null,
        crm_estado: 'activa',
        actualizado_por: contexto.usuarioId,
      })
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({
          crm_token_cifrado: cifrar(token),
          crm_refresh_cifrado: typeof refresco === 'string' && refresco ? cifrar(refresco) : null,
          crm_estado: 'activa',
          actualizado_por: contexto.usuarioId,
        }),
      )
      .execute();

    // El tipo `Detalle` de la auditoría no tiene campo donde quepa un token, así que esto no
    // depende de que nadie se olvide: la credencial no puede quedar registrada aunque se quiera.
    await auditarAdministracion(db, {
      accion: 'credenciales_cargadas',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
    });

    // Se devuelve el estado resuelto, no un `{ ok: true }`: quien la cargó tiene que ver que quedó
    // activa y con qué vista previa, o el "se guardó" es un éxito reportado sin verificar.
    return ok(await resolverCredenciales(db, contexto.orgEfectiva));
  });
}
