// A nombre de qué closer queda un resultado de Avanzar (la `107`, la fase 2 del selector de closer, 2026-10-29).
//
// ═══════════════════════════════════════════════════════════════════════════════
// DOS PERSONAS EN UN RESULTADO, Y CADA UNA CON SU COLUMNA
//
//   · `registrado_por` — quien apretó «Registrar». Es la autoría: la nota, la tarea y el sello del setter cuelgan de
//     ella, y no cambia nunca.
//   · `closer_id` — el closer al que se le ACREDITA: su comisión, su cobrado en Inicio, su fila en la tabla de Sales.
//
// Hasta la `107` eran la misma, y eso fallaba sin ningún error: el administrador que opera el Closer registraba las
// ventas de los otros dos closers (que no entran a la plataforma) y quedaban a su nombre. Las métricas leen
// `coalesce(closer_id, registrado_por)` —`closerDelResultado`—, así que una fila vieja (o del setter) se sigue
// acreditando a quien la registró, como siempre.
//
// ── QUIÉN DECIDE A NOMBRE DE QUIÉN ─────────────────────────────────────────
//
// El SERVIDOR, con la sesión (`aNombreDeQuien`). El navegador sólo puede PEDIR un closer (`aNombreDe`), y el pedido se
// atiende con la misma regla que el selector de la etapa 8a: sólo de quien supervisa (`puedeSupervisarClosers`), y sólo
// si es un closer vinculado de ESTA empresa. Un closer que no supervisa registra a su nombre; si pide otro, 403.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql, type RawBuilder } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { closersDeLaEmpresa, type CloserConfigurado } from './alcanceDelCloser.ts';

/**
 * El closer al que se le acredita un resultado: `closer_id`, o quien lo registró en las filas de antes de la `107` y
 * en las del setter. **Es el único eje de persona de las métricas del closer**: comisión, cobrado, tabla de Sales,
 * motivos de no venta. Un `registrado_por` suelto en una de ellas le devolvía la venta a quien la cargó.
 */
export function closerDelResultado(alias?: string): RawBuilder<string> {
  const columna = (c: string) => sql.ref(alias ? `${alias}.${c}` : c);
  return sql<string>`coalesce(${columna('closer_id')}, ${columna('registrado_por')})`;
}

/**
 * El closer que tiene asignado un contacto en el CRM: el que está vinculado con el par (cliente, usuario del CRM) del
 * contacto. Con TODOS sus vínculos y no sólo los de la vista, como `alcanceDe`: el contacto ya es de la vista.
 * `null` = el CRM no lo asignó, o lo asignó a alguien que no es closer.
 */
export function closerDeLaAsignacion(
  cuentaId: string,
  crmAsignadoA: string | null,
  closers: readonly CloserConfigurado[],
): CloserConfigurado | null {
  if (crmAsignadoA === null) return null;
  return closers.find((c) => c.vinculos.some((v) => v.cuentaId === cuentaId && v.crmUsuarioId === crmAsignadoA)) ?? null;
}

/** El closer de un contacto, para que Avanzar diga a nombre de quién va a quedar. **Corre dentro de `conOrganizacion(`.** */
export async function closerDelContacto(contactoId: string): Promise<{ usuarioId: string; nombre: string } | null> {
  const contacto = await datos()
    .selectFrom('contactos')
    .select(['cuenta_id', 'crm_asignado_a'])
    .where('id', '=', contactoId)
    .executeTakeFirst();
  if (!contacto) return null;
  const k = closerDeLaAsignacion(contacto.cuenta_id, contacto.crm_asignado_a, await closersDeLaEmpresa());
  return k ? { usuarioId: k.usuarioId, nombre: k.nombre } : null;
}

/** Lo que decide `aNombreDeQuien`: el closer acreditado (`null` = cuenta quien registra), o por qué no se puede. */
export type ANombreDe =
  | { tipo: 'listo'; closerId: string | null }
  /** Pidió otro closer sin supervisar: un 403, y no se escribe nada. */
  | { tipo: 'sin_permiso' }
  /** Pidió a alguien que no es un closer vinculado de esta empresa: un 400. Mismo texto para «no existe» y «es de otra». */
  | { tipo: 'closer_ajeno' };

/**
 * A nombre de qué closer queda el resultado. Pura: la ruta le pasa la sesión, el pedido y los closers de la empresa.
 *
 *   · **A su propio nombre** vale siempre (es lo que pasaba antes de la `107`).
 *   · **Sin supervisar**: a su nombre. Pedir otro es `sin_permiso`.
 *   · **Supervisando, con pedido**: el pedido, si es un closer con algún vínculo a la vista (los mismos que ofrece el
 *     selector). La lista sale por la conexión del inquilino, así que un closer de otra empresa no está.
 *   · **Supervisando, sin pedido** (mirando «Toda la empresa» o «Sin asignar»): el closer asignado al contacto, si se
 *     sabe; si no, `null`, y la venta cuenta para quien la registra, como antes de la `107`.
 */
export function aNombreDeQuien(p: {
  registrador: string;
  supervisa: boolean;
  pedido: string | null;
  closers: readonly CloserConfigurado[];
  delContacto: CloserConfigurado | null;
}): ANombreDe {
  /* A su propio nombre vale siempre, también para quien supervisa: es lo que pasaba antes de la `107`. Sin esto, un
     supervisor-closer vinculado sólo en otro cliente que eligió «Lo mío» recibía un 400 por registrar lo suyo. */
  if (p.pedido === p.registrador) return { tipo: 'listo', closerId: p.registrador };
  if (!p.supervisa) {
    if (p.pedido !== null) return { tipo: 'sin_permiso' };
    return { tipo: 'listo', closerId: p.registrador };
  }
  if (p.pedido === null) return { tipo: 'listo', closerId: p.delContacto?.usuarioId ?? null };
  const elegido = p.closers.find((c) => c.usuarioId === p.pedido);
  if (!elegido || elegido.vinculosALaVista.length === 0) return { tipo: 'closer_ajeno' };
  return { tipo: 'listo', closerId: elegido.usuarioId };
}
