// ADR-0704 — Ningún cuerpo de error revela la estructura de la base.
//
// Editar y borrar una empresa. **Dominio de IDENTIDAD**, y acá eso no es una comodidad.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO PUEDE IR POR EL DOMINIO DEL INQUILINO
//
// Editar y borrar usuarios sí van por el inquilino, porque su política filtra por organización y
// eso convierte «no tocar a alguien de otra empresa» en algo que la base garantiza.
//
// Con las organizaciones, esa misma política es lo que lo impide: `org_propia_edita` es
// `id = app.org_id`, o sea que desde el inquilino solo se puede tocar **la organización propia**.
// Y esto es exactamente la operación contraria: el rol de plataforma administrando una empresa
// que NO es la suya, sin conmutarse a ella.
//
// Así que va por identidad, con `where id`, y el filtro es el identificador mismo — no hay un
// «filtro por organización» que olvidar, porque la organización ES el objetivo. La barrera es la
// capacidad: `organizaciones.editar` y `organizaciones.borrar` las tiene solo el rol de
// plataforma, porque el reparto le niega al administrador la familia `organizaciones.%` completa.
//
// Es la misma razón por la que `listarOrganizaciones()` no lleva `where org_id` y lo dice de
// frente: hay operaciones que cruzan empresas a propósito, y esconderlo detrás de un filtro
// decorativo daría la impresión falsa de que el filtro es el que protege.
//
// ── LA ORGANIZACIÓN PRINCIPAL NO SE COMPRUEBA ACÁ ───────────────────────────
//
// No hay ningún `if (es_principal)` en este archivo, y es deliberado. El disparador
// `organizaciones_protegida` de la migración 007 ya rechaza borrarla, desmarcarla y desactivarla,
// con el criterio escrito ahí: *"un condicional se saltea con un script, una consola de
// administración, un endpoint nuevo o una sentencia a mano un domingo. Un disparador no."*
//
// Repetirlo acá daría dos definiciones de la misma regla, y la que se olvidaría de actualizar es
// justo ésta. Lo que sí hace la interfaz es **no ofrecer** los botones, que es distinto: ahorra el
// viaje sin ser la barrera.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { auditarAdministracion } from '../../../../../lib/autenticacion/auditoria.ts';
import { loQueImpideBorrar } from '../../../../../lib/administracion/borrado.ts';
import { esZonaValida } from '../../../../../lib/negocio/zonas.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  sin_cambios: 'No se mandó ningún campo para cambiar.',
  falta_nombre: 'La empresa necesita un nombre.',
  activa_invalida: 'El campo «activa» tiene que ser verdadero o falso.',
  zona_invalida:
    'Esa no es una zona horaria de la lista. Se elige del selector; escribirla a mano no sirve ' +
    'porque el motor de fechas solo conoce los nombres del catálogo.',
} as const;

/**
 * Editar una empresa: su nombre y si opera o no.
 *
 * `activa` es la mitad reversible de «eliminar»: una empresa desactivada no opera —el portero
 * rechaza sus peticiones con `organizacion_inactiva`— y conserva todos sus datos.
 */
export async function PATCH(
  peticion: Request,
  ctx: RouteContext<'/api/admin/organizaciones/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['organizaciones.editar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { nombre?: unknown; activa?: unknown; zonaHoraria?: unknown } | null;
  const nombre = c?.nombre;
  const activa = c?.activa;

  // Semántica de PRESENCIA, igual que `PUT /api/admin/credenciales`: ausente es «no lo toques».
  // Con la otra semántica, un formulario que solo cambia el nombre desactivaría la empresa.
  if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length === 0)) {
    return rechazo('peticion_invalida', MOTIVOS['falta_nombre']);
  }
  if (activa !== undefined && typeof activa !== 'boolean') {
    return rechazo('peticion_invalida', MOTIVOS['activa_invalida']);
  }
  // Un cuerpo sin ningún campo conocido se RECHAZA en vez de responder «editado». Es la misma
  // regla que las credenciales: un 200 sobre un cuerpo que no se entendió es un éxito reportado
  // que no ocurrió, y la pantalla diría «guardado» sin que nada cambiara.
  /* ── LA ZONA HORARIA, y este endpoint es el único lugar donde se puede arreglar ──
   *
   * Antes solo aceptaba el nombre y el estado, así que una empresa que nació sin zona **no tenía
   * arreglo posible desde la aplicación**. Medido en producción: dos de tres empresas reales
   * estaban en `UTC` por omisión, y con las citas del calendario en `-05:00` eso significa que toda
   * cita de la tarde se dibujaba un día corrida. Sin ningún error.
   *
   * Se valida contra el catálogo y contra el motor de fechas: un nombre que `Intl` no conoce hace
   * lanzar a cada pantalla que muestre una hora, y guardarlo convertiría un campo mal elegido en
   * una pantalla caída.
   */
  const zonaHoraria = c?.zonaHoraria;
  if (zonaHoraria !== undefined && !esZonaValida(zonaHoraria)) {
    return rechazo('peticion_invalida', MOTIVOS['zona_invalida']);
  }

  if (nombre === undefined && activa === undefined && zonaHoraria === undefined) {
    return rechazo('peticion_invalida', MOTIVOS['sin_cambios']);
  }

  return conIdentidad(async (db) => {
    let tocadas: bigint;
    try {
      const r = await db
        .updateTable('organizaciones')
        .set({
          ...(typeof nombre === 'string' ? { nombre: nombre.trim() } : {}),
          ...(typeof activa === 'boolean' ? { activa } : {}),
          ...(typeof zonaHoraria === 'string' ? { zona_horaria: zonaHoraria.trim() } : {}),
        })
        .where('id', '=', id)
        .executeTakeFirst();
      tocadas = r.numUpdatedRows;
    } catch (e) {
      // El disparador de la organización principal: *"no se puede desactivar"*, *"no se puede
      // desmarcar"*. Su mensaje sube tal cual, discriminado por SQLSTATE y no por texto.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    if (tocadas === 0n) return rechazo('no_encontrado');

    await auditarAdministracion(db, {
      accion: 'organizacion_editada',
      actor: contexto.usuarioId,
      // El objetivo de esta operación ES la organización. Igual que en el alta.
      objetivo: id,
      orgId: id,
    });

    return ok({ editado: true });
  });
}

/**
 * Borrar una empresa. Irreversible, y la base solo lo permite si no tiene NADA.
 *
 * Todas las claves foráneas del negocio hacia `identidad.organizaciones` son `no action`, y
 * `identidad.usuarios` también: una empresa con un contacto o con una persona no se puede borrar.
 * Lo que cae con ella son sus credenciales y sus roles privados, las dos en cascada.
 */
export async function DELETE(
  peticion: Request,
  ctx: RouteContext<'/api/admin/organizaciones/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['organizaciones.borrar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  // La empresa donde estás parado no se borra. Es el `ADR-0502` trasladado de la persona a la
  // empresa, y por el mismo motivo: quien lo hiciera se quedaría con una sesión apuntando a una
  // organización que ya no existe, o sea afuera y sin forma de volver. La base no lo impide —el
  // `set null` de `sesiones.org_activa` lo deja pasar— así que tiene que impedirlo esto.
  if (id === contexto.orgEfectiva) {
    return rechazo(
      'sobre_si_mismo',
      'No se puede eliminar la empresa que estás administrando. Volvé a la tuya primero.',
    );
  }

  return conIdentidad(async (db) => {
    let tocadas: bigint;
    try {
      // La auditoría, ANTES y en la misma transacción. Si el borrado falla, se deshace con él y no
      // queda el registro de algo que no ocurrió; si sale bien, queda el rastro de lo único
      // irreversible que el sistema permite hacer.
      await auditarAdministracion(db, {
        accion: 'organizacion_borrada',
        actor: contexto.usuarioId,
        objetivo: id,
        // `orgId` es la organización del ACTOR, no la borrada: la fila de auditoría tiene una
        // clave foránea hacia organizaciones, y apuntarla a la que se está borrando la haría
        // desaparecer con ella. El identificador de la borrada queda en `objetivo`.
        orgId: contexto.orgEfectiva,
      });

      const r = await db.deleteFrom('organizaciones').where('id', '=', id).executeTakeFirst();
      tocadas = r.numDeletedRows;
    } catch (e) {
      const porque = loQueImpideBorrar(e, 'empresa');
      if (porque) return rechazo('rechazo_de_la_base', porque);
      // El disparador: *"La organización principal no se puede eliminar"*.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    if (tocadas === 0n) return rechazo('no_encontrado');

    return ok({ borrado: true });
  });
}
