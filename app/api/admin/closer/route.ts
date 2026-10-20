// Quién es EL closer de la organización. Lo elige quien administra.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ `PANTALLA = 'credenciales'` Y NO `'closer'`
//
// El botón que abre esto vive en el cockpit del closer, no en Ajustes. Y el marcador de pantalla
// **no sigue al botón**: sigue a quién puede llamar la operación.
//
// El motivo está escrito completo en `app/api/admin/comisiones/route.ts`, que hizo esta misma
// mudanza: con `PANTALLA = 'closer'`, `ADR-0304` exigiría que este `GET` pidiera `closer.ver` —el
// mismo conjunto que las otras cinco operaciones de esa pantalla— y eso le mostraría a cualquiera
// con la pestaña **la lista de compañeros y sus porcentajes**. Mover un botón no puede ensanchar
// quién puede tocar algo.
//
// Así que las capacidades son las de la configuración de la empresa: `credenciales.ver` para leer y
// `credenciales.editar` para escribir. Y eso hace verdadera, por construcción, la regla que se
// pidió: *un administrador no puede ser closer* — porque `credenciales.editar` es a la vez lo que
// habilita designar y lo que excluye de la lista de designables. Ver `lib/negocio/closer.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ENDPOINT NO HACE, Y ES DELIBERADO
//
// **No toca el porcentaje.** Eso sigue en `PUT /api/admin/comisiones`, que ya existe, ya está
// probado y ya tiene resuelto el problema difícil de esa columna: distinguir `0` de `null`.
//
// Un endpoint que hiciera las dos cosas tendría que decidir qué hacer cuando le llega una
// designación sin porcentaje —¿lo borra? ¿lo deja?— y la respuesta más cómoda («lo deja») convierte
// un campo ausente en una operación silenciosa. Es el mismo razonamiento por el que el porcentaje y
// la meta se escriben desde endpoints distintos, escrito en el `PUT` de comisiones: *"un solo
// endpoint que escribiera las dos con `?? null` borraría la mitad ajena en cada guardado"*.
//
// La pantalla llama a los dos. Eso es correcto: son dos decisiones distintas del administrador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL VÍNCULO ES DE UN CLIENTE (el nivel 3, C5 · G2)
//
// Los usuarios de GoHighLevel son de cada subcuenta, así que el vínculo se guarda en un cliente: el
// `PUT` acepta `cuentaId` y, sin él, guarda en el principal (un navegador de antes sigue andando, y
// con un solo cliente es el único). El cliente se valida contra los de la empresa —uno de otra, o
// uno dado de baja, es 404 como en `usuarios-crm` (`ADR-0501`)— y se escribe explícito, nunca al
// puente. El `GET` suma los clientes activos y pausados, para el selector de la pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import {
  asignarCloser,
  candidatosAlCloser,
  TOPE_DE_CLOSERS,
  quitarCloser,
} from '../../../../lib/negocio/closer.ts';
import { closersDeLaEmpresa } from '../../../../lib/negocio/alcanceDelCloser.ts';
import { porcentajesDeLaEmpresa, TIPO_CLOSER } from '../../../../lib/negocio/comision.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { datos } from '../../../../lib/datos/contexto.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOTIVOS: Record<string, string> = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_usuario: 'Hay que decir a quién se designa.',
  no_es_candidato:
    'Esa persona no puede ser closer. Para poder serlo tiene que tener la pestaña Closer ' +
    'habilitada.',
  tope:
    `Ya hay ${TOPE_DE_CLOSERS} closers configurados, que es el máximo. Quita a uno antes de ` +
    'agregar otro.',
  cliente_ajeno: 'Ese cliente no es de esta empresa.',
  crm_ya_vinculado:
    'Ese usuario de GoHighLevel ya está vinculado a otra persona. Cada usuario del CRM ' +
    'corresponde a un solo closer: si los dos lo tuvieran, los dos verían los mismos leads.',
};

/** Lo que la pantalla necesita para dibujar el panel completo. */
async function estado(orgId: string) {
  // Los candidatos salen de IDENTIDAD —capacidades y secciones concedidas— y los porcentajes de
  // NEGOCIO. Dos dominios, dos conexiones, y en ese orden: si la segunda falla no quedó nada a
  // medias, porque ninguna de las dos escribe. Es la forma que `ADR-0209` admite.
  const { candidatos, porqueNinguno } = await conIdentidad((db) => candidatosAlCloser(db, orgId));

  const { porcentajes, asignado, clientes } = await conOrganizacion(orgId, async () => ({
    // Se reusa la MISMA función que alimentaba el panel de porcentajes del equipo, y no una consulta
    // nueva: es el único lugar del sistema que sabe leer esa columna conservando el `null`, y un
    // segundo lector es un segundo lugar donde escribir `?? 0` por costumbre.
    // El tramo se dice EXPLÍCITO: esta pantalla es la del closer, y con tres tramos en la tabla,
    // omitirlo mostraría el porcentaje de otro negocio con los mismos nombres al lado.
    porcentajes: await porcentajesDeLaEmpresa(TIPO_CLOSER),
    asignado: await closersDeLaEmpresa(),
    /* Los clientes en los que se puede vincular (el nivel 3), el principal primero. Los de baja no —los clientes no se
       borran, se dan de baja—: no se vincula a nadie en un cliente que ya no está, y con uno activo y otro de baja la
       pantalla no tiene por qué ofrecer un selector. */
    clientes: await datos()
      .selectFrom('cuentas')
      .select(['id', 'nombre', 'es_por_omision', 'estado'])
      .where('estado', '!=', 'baja')
      .orderBy('es_por_omision', 'desc')
      .orderBy('nombre', 'asc')
      .execute(),
  }));

  const porUsuario = new Map(porcentajes.map((p) => [p.usuarioId, p.porcentaje]));

  return {
    candidatos: candidatos.map((c) => ({
      ...c,
      // `null` se conserva. Un `?? 0` acá haría que el desplegable mostrara «0 %» para todos los que
      // nadie configuró, y alguien lo leería como una decisión tomada.
      porcentaje: porUsuario.get(c.usuarioId) ?? null,
    })),
    /* POR QUÉ NO HAY NINGUNO, cuando no hay ninguno. Es el patrón `{ valor, falta }` de siempre: una
       lista vacía sola no dice si es una regla o un error, y acá la diferencia decide a qué pantalla
       va el administrador. Medido contra producción: los tres usuarios que hay son administradores y
       los tres YA tienen la pestaña Closer, así que el aviso anterior —«dale la pestaña a alguien»—
       mandaba a una pantalla donde no hay nada que cambiar. Ver `PorqueNingunCandidato`. */
    porqueNinguno,
    /* La LISTA de closers, con sus vínculos. Era uno solo hasta la migración 034, y con un solo
       vínculo hasta la `096`: ahora uno por cliente.

       `vinculos` viaja aunque esté vacío, y no es lo mismo que omitirlo: vacío significa «designado
       y sin vincular en ningún cliente», que es un estado que la pantalla dibuja distinto —esa
       persona ve todos los leads, como cualquiera que no sea closer— y hay que decírselo. Van los de
       la vista: con la organización entera, que es como se lee acá, son todos. */
    closers: asignado.map((a) => ({
      usuarioId: a.usuarioId,
      nombre: a.nombre,
      vinculos: a.vinculosALaVista,
    })),
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre, esPorOmision: c.es_por_omision, estado: c.estado })),
    tope: TOPE_DE_CLOSERS,
  };
}

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  return ok(await estado(contexto.orgEfectiva));
}

/**
 * Designa al closer.
 *
 * ── LA COMPROBACIÓN QUE NO SE PUEDE SALTEAR ─────────────────────────────────
 *
 * Que el identificador esté **en la lista de candidatos**, no que exista. Son dos comprobaciones
 * distintas y solo una cierra lo que se pidió: sin ésta, un administrador puede mandar su PROPIO
 * identificador en el cuerpo y quedar designado closer — el desplegable no lo ofrece, y el
 * desplegable es una pantalla. La regla vive acá.
 *
 * Y por eso no alcanza `usuarioObjetivo`, que responde «existe y es de esta empresa». Un
 * administrador de esta empresa pasa esa comprobación.
 */
export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { usuarioId?: unknown; crmUsuarioId?: unknown; cuentaId?: unknown } | null;
  if (typeof c?.usuarioId !== 'string' || c.usuarioId.trim() === '') {
    return rechazo('peticion_invalida', MOTIVOS['falta_usuario']);
  }
  const objetivo = c.usuarioId;

  /* El vínculo con GoHighLevel. **Ausente y vacío significan lo mismo: sin vincular**, y por eso
     los dos caen en `null` — el desplegable manda `''` cuando se elige «sin vincular», y tratar esa
     cadena como un identificador dejaría filas con un vínculo de cero caracteres que no coincide
     con ningún contacto: esa persona vería cero leads y la pantalla diría que está vinculada.

     No se comprueba que el identificador exista en el CRM. Podría —la lista está a una llamada— y
     sería una llamada externa dentro de un `PUT` de configuración para rechazar algo que ya es
     visible: un vínculo a un usuario inexistente da cero leads, y la pantalla muestra el nombre
     desconocido al lado. Falla a la vista. */
  const crmUsuarioId =
    typeof c.crmUsuarioId === 'string' && c.crmUsuarioId.trim() !== '' ? c.crmUsuarioId.trim() : null;

  /* El cliente del vínculo (el nivel 3). Ausente o vacío = el principal, como antes de que hubiera
     varios. Uno mal formado no llega a la base: es el mismo 404 que uno ajeno. */
  const pedido = typeof c.cuentaId === 'string' && c.cuentaId.trim() !== '' ? c.cuentaId.trim() : null;
  if (pedido !== null && !UUID.test(pedido)) return rechazo('no_encontrado', MOTIVOS['cliente_ajeno']);

  const { candidatos } = await conIdentidad((db) => candidatosAlCloser(db, contexto.orgEfectiva));
  if (!candidatos.some((k) => k.usuarioId === objetivo)) {
    /* 404 y no 403, por `ADR-0501`: un identificador de otra empresa no se confirma ni se niega. Y el
       mismo 404 cubre los tres casos —no existe, es de otra empresa, o no puede ser closer— con un
       detalle que explica el tercero sin revelar cuál de los tres fue. */
    return rechazo('no_encontrado', MOTIVOS['no_es_candidato']);
  }

  const porque = await conOrganizacion(contexto.orgEfectiva, async () => {
    /* Contra los clientes de ESTA empresa, en la misma transacción. Uno de otra no está a la vista
       (`cuentas_propias_lee`) y es 404, como en `usuarios-crm`: sin esto, la clave foránea lo
       rechazaría con un 500. Y se escribe explícito: dejarlo al puente lo pondría en el principal. */
    const cliente = await datos()
      .selectFrom('cuentas')
      .select('id')
      .where('estado', '!=', 'baja')
      .where((eb) => (pedido === null ? eb('es_por_omision', '=', true) : eb('id', '=', pedido)))
      .executeTakeFirst();
    if (!cliente) return 'cliente_ajeno' as const;
    const porque = await asignarCloser(objetivo, crmUsuarioId, contexto.usuarioId, cliente.id);
    /* Si no se designó, no se audita: el registro se lee para reconstruir cambios, y una fila que
       describe algo que no pasó es ruido que hace desconfiar del resto. */
    if (porque !== null) return porque;
    /* La auditoría en la MISMA transacción, y por la conexión del inquilino. Decide de quién son los
       números y el sueldo que muestra una pantalla, así que quién lo cambió tiene que ser
       reconstruible — y con la misma conexión no existe el estado «se designó y no quedó registrado
       quién». El motivo largo está en el `PUT` de comisiones. */
    await auditarAdministracion(datos(), {
      accion: 'closer_designado',
      actor: contexto.usuarioId,
      objetivo,
      orgId: contexto.orgEfectiva,
      detalle: { cuenta: cliente.id },
    });
    return null;
  });

  if (porque === 'cliente_ajeno') return rechazo('no_encontrado', MOTIVOS['cliente_ajeno']);
  /* Los dos rechazos salen con 409 y no con 400: la petición está bien formada y el estado del
     servidor es el que no la admite — ya hay tres closers, o ese usuario del CRM ya es de otro.
     Un 400 mandaría a revisar el cuerpo, que está impecable. */
  if (porque !== null) return rechazo('rechazo_de_la_base', MOTIVOS[porque]);

  // Se devuelve el estado completo, no un `{ ok: true }`: quien guardó tiene que ver lo que quedó.
  return ok(await estado(contexto.orgEfectiva));
}

/**
 * Quita la designación de UNA persona, en todos los clientes (`quitarCloser`).
 *
 * Existe por lo mismo que «Dejar sin configurar» existe para el porcentaje: hay que poder volver de
 * «es Ana» a «todavía nadie». Sin esta operación el único camino sería designar a otra persona, que
 * es un hecho distinto.
 */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* A QUIÉN se quita, por parámetro. Antes no hacía falta —había uno— y ahora es obligatorio: sin
     él, `quitarCloser()` borraría a los tres, y la política de aislamiento no lo impediría porque
     acota por organización, que es justo lo que ese borrado ya hace. */
  const objetivo = new URL(peticion.url).searchParams.get('usuarioId');
  if (!objetivo) return rechazo('peticion_invalida', MOTIVOS['falta_usuario']);

  await conOrganizacion(contexto.orgEfectiva, async () => {
    const antes = await closersDeLaEmpresa();
    if (!antes.some((a) => a.usuarioId === objetivo)) return;
    await quitarCloser(objetivo);
    // Solo se audita si HABÍA alguien. Auditar un borrado que no borró nada llena el registro de
    // filas que no describen ningún cambio, y el registro se lee para reconstruir cambios.
    await auditarAdministracion(datos(), {
      accion: 'closer_quitado',
      actor: contexto.usuarioId,
      objetivo,
      orgId: contexto.orgEfectiva,
    });
  });

  return ok(await estado(contexto.orgEfectiva));
}
