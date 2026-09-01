// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0506 — La contraseña temporal nunca queda registrada.
//
// Alta de usuario. Dominio de IDENTIDAD: genera el hash de la contraseña temporal.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL 404 DE UN ALTA, QUE ES EL CASO QUE LA ESPECIFICACIÓN NO CONTEMPLA
//
// La fila ⛔ pide 404 en las cinco operaciones *"con el identificador de un usuario ajeno"* — y en
// un alta **no hay usuario objetivo**. Ningún documento dice cuál es el identificador ajeno del
// alta.
//
// DECISIÓN: el alta acepta un `orgId` opcional, y responde 404 cuando no es una organización sobre
// la que quien pide tenga alcance. Con eso el 404 del alta sale del mismo lugar que los otros
// cuatro —la organización efectiva— y no hace falta un condicional propio. La alternativa que se
// descartó era leer el 404 del `rol_id` ajeno, que choca con el `05` § 3: ahí el rechazo del
// disparador `usuarios_roles_no_cruzan` es un 409 con el mensaje de la base, no un 404.
//
// ── EL ROL DE PLATAFORMA SÍ PUEDE ELEGIR LA EMPRESA, Y ESO CAMBIÓ ────────────
//
// Hasta la Etapa 12 este archivo decía: *"El rol de plataforma no necesita `orgId` para crear en
// otra organización: cambia su organización activa y `orgEfectiva` lo sigue. Un segundo camino
// sería un segundo lugar donde olvidarse el filtro."*
//
// El razonamiento sigue siendo el correcto y **la conclusión se revisó a pedido**: dar de alta a
// alguien de otra empresa obligaba a conmutar la sesión entera —o sea a dejar de mirar la propia—
// para una operación de un minuto. Se pidió elegir la empresa en el formulario.
//
// Lo que se conserva es la parte que importaba: **sigue habiendo un solo lugar que decide**. No es
// un camino paralelo, es un parámetro de éste, y su alcance lo autoriza la MISMA condición que ya
// gobierna el conmutador (`PATCH /api/auth/sesion`) y `puedeCambiarDeEmpresa`:
//
//     contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar')
//
// Para todos los demás, un `orgId` distinto del propio sigue siendo 404, exactamente como antes.
// Quien no puede ver otras empresas tampoco puede nombrarlas.
//
// ── Y EL ROL VIAJA EN LA MISMA LLAMADA ──────────────────────────────────────
//
// Antes eran dos peticiones: crear y después asignar. Entre las dos, la persona existía con cero
// capacidades, y si la segunda fallaba quedaba así —la interfaz tenía que avisarlo con un texto
// que empezaba con «PERO NO». Ahora las dos escrituras van en la misma transacción: o queda con su
// rol o no queda.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import {
  clavesDeSeccion,
  seccionesConAlcance,
} from '../../../../lib/autorizacion/secciones.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { hashear } from '../../../../lib/datos/hash.ts';
import { contrasenaTemporal } from '../../../../lib/autenticacion/temporal.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

/** No valida direcciones de correo del mundo real: valida que tenga forma de correo (05 § 3). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * El texto de cada rechazo de validación, uno por motivo. Ver el mismo comentario en
 * `app/api/admin/organizaciones/route.ts`: `ok({ creado: false, motivo }, 400)` no llegaba a la
 * pantalla, porque el cliente HTTP solo conserva `codigo` y `detalle` de una respuesta no-ok.
 */
const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_nombre: 'La persona necesita un nombre.',
  email_invalido: 'Ese correo no tiene forma de correo.',
  rol_invalido: 'Ese rol no existe.',
  sin_secciones:
    'Este rol se restringe por pestañas, así que hay que elegir al menos una. Una persona que ' +
    'entra y no ve ninguna pantalla queda sin nada que hacer y sin forma de arreglarlo sola.',
  seccion_invalida: 'Alguna de las pestañas elegidas no existe.',
  alcance_vacio:
    'Ninguna de las pestañas elegidas la habilita el rol de esta persona, así que no vería ' +
    'ninguna. Hay que elegir entre las que ese rol alcanza.',
} as const;

/** La forma de un uuid. Se comprueba antes de que el motor la rechace con un 500. */
const UUID_ORG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.crear'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as {
    nombre?: unknown;
    email?: unknown;
    orgId?: unknown;
    rol?: unknown;
    secciones?: unknown;
  } | null;
  const nombre = c?.nombre;
  const email = c?.email;
  const orgId = c?.orgId;
  const rol = c?.rol;
  /* Las pestañas que esta persona va a ver. **Ausente ≠ vacío**, y la diferencia decide:
   *
   *   · ausente → no se pidió ninguna. Es un error solo si el rol se restringe por sección.
   *   · `[]`    → se pidió explícitamente ninguna, y eso se RECHAZA: una persona que entra y no ve
   *     nada queda sin nada que hacer y sin forma de arreglarlo sola.
   *
   * Las dos ramas están abajo, y son dos porque los dos ceros no son el mismo hecho. */
  const secciones = c?.secciones;

  // El orden de las validaciones es el de la tabla del `05` § 3.
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return rechazo('peticion_invalida', MOTIVOS['falta_nombre']);
  }
  if (typeof email !== 'string' || !EMAIL.test(email)) {
    return rechazo('peticion_invalida', MOTIVOS['email_invalido']);
  }
  if (rol !== undefined && rol !== null && (typeof rol !== 'string' || rol.length === 0)) {
    return rechazo('peticion_invalida', MOTIVOS['rol_invalido']);
  }
  // La FORMA de las secciones. Que sean las correctas se decide más abajo, contra el rol, y no acá:
  // una clave válida puede seguir dando cero pestañas.
  if (secciones !== undefined) {
    if (!Array.isArray(secciones) || secciones.some((x) => typeof x !== 'string')) {
      return rechazo('peticion_invalida', MOTIVOS['seccion_invalida']);
    }
    const conocidas = clavesDeSeccion();
    if (secciones.some((x) => !conocidas.includes(x as string))) {
      return rechazo('peticion_invalida', MOTIVOS['seccion_invalida']);
    }
  }

  // EL 404 DEL ALTA, y la elección de empresa. Ver el encabezado.
  //
  // `puedeElegirEmpresa` es la misma condición que comprueba `PATCH /api/auth/sesion` y la misma
  // que el servidor le contesta al conmutador en `puedeCambiarDeEmpresa`. Se escribe otra vez y no
  // se extrae: son tres usos y el día que dejen de coincidir, la prueba que los cruza lo dice.
  const puedeElegirEmpresa =
    contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar');
  const orgDestino = typeof orgId === 'string' && orgId.length > 0 ? orgId : contexto.orgEfectiva;

  if (orgDestino !== contexto.orgEfectiva && !puedeElegirEmpresa) {
    return rechazo('no_encontrado');
  }

  // La genera EL SERVIDOR. El `05` § 3: *"nunca la elige quien crea la cuenta, y nunca la manda el
  // cliente."* Si viniera del cuerpo, el alta sería un canal para poner una contraseña conocida.
  const temporal = contrasenaTemporal();

  return conIdentidad(async (db) => {
    // ¿EXISTE la empresa destino? Solo hace falta preguntarlo cuando no es la propia; para la
    // propia lo garantiza la sesión.
    //
    // Se pregunta en vez de dejar que falle la clave foránea, porque los dos errores no son el
    // mismo hecho: un identificador de empresa que no existe es «no lo encontré» (404), y lo que
    // subiría de la base es un `23503` que acaba en `rechazo_de_la_base` (409) nombrando una
    // tabla. `ADR-0501` pide 404, nunca 403 ni un error estructural.
    /* ── SI LA EMPRESA DESTINO ES LA PRINCIPAL, Y PARA QUÉ SE USA ────────────
     *
     * Lo decide la comprobación del alcance de más abajo. `usuario` ahora alcanza la sección
     * `monitoreo`, que es `soloDesdeLaPrincipal`, así que `{rol:'usuario', secciones:['monitoreo']}`
     * para alguien de una empresa cliente pasa toda validación de lista y produce **cero
     * pestañas** — la persona entra y el menú está vacío. Es el mismo defecto que `alcance_vacio`
     * existe para impedir, por un eje que antes no podía ocurrir: hasta el retiro del rol
     * `monitoreo`, ningún rol restringido tenía esa capacidad.
     *
     * Es de la empresa DESTINO y no de quien da de alta. Esa distinción es la que salva el motivo
     * escrito abajo —*«el mismo alcance no puede aceptarse o rechazarse según quién esté dando de
     * alta»*—: esto no depende de quién pide, sino de quién va a mirar. */
    let destinoEsPrincipal = contexto.organizacion.esPrincipal;

    if (orgDestino !== contexto.orgEfectiva) {
      /* Y que TENGA FORMA de uuid, antes de preguntar.
       *
       * Sin esto, un `orgId` mal formado no llega a la consulta como «no encontrado»: PostgreSQL
       * lanza `invalid input syntax for type uuid` y sale un **500**. Encontrado manejando el
       * formulario en el navegador, con un valor equivocado que mandó una sonda mía.
       *
       * Se responde 404 y no 400, que es lo mismo que hace `usuarioObjetivo(` con el identificador
       * de una persona: *"distinguirlos también es un oráculo, más débil pero gratis de cerrar"*. */
      if (!UUID_ORG.test(orgDestino)) return rechazo('no_encontrado');
      const existe = await db
        .selectFrom('organizaciones')
        // `es_principal` viaja en la MISMA consulta que ya había: preguntarlo aparte sería una
        // segunda ida a la base por un dato que esta fila ya trae.
        .select(['id', 'es_principal'])
        .where('id', '=', orgDestino)
        .executeTakeFirst();
      if (!existe) return rechazo('no_encontrado');
      destinoEsPrincipal = existe.es_principal;
    }

    // El rol pedido, si hay. Un rol inexistente es 400 y no 404 — el 404 es de la empresa y de la
    // persona, y `05` § 3 lo pone en la tabla de validaciones.
    let rolDestino: { id: string; solo_principal: boolean; secciones_restringidas: boolean } | undefined;
    if (typeof rol === 'string' && rol.length > 0) {
      rolDestino = await db
        .selectFrom('roles')
        .select(['id', 'solo_principal', 'secciones_restringidas'])
        .where('clave', '=', rol)
        .where('org_id', 'is', null)
        .executeTakeFirst();
      if (!rolDestino) return rechazo('peticion_invalida', MOTIVOS['rol_invalido']);

      // ADR-0504 · el mismo rechazo que `POST /api/admin/usuarios/[id]/roles`, y por el mismo
      // motivo: **no se puede otorgar el alcance que uno no tiene.** Hoy nadie llega acá sin la
      // capacidad —solo el rol de plataforma tiene `usuarios.crear`— y va igual: la regla no puede
      // depender de que el reparto no cambie nunca. La base también lo impide fuera de la
      // organización principal, con el disparador `rol_de_plataforma_acotado`.
      if (rolDestino.solo_principal && !contexto.permisos.has('organizaciones.listar')) {
        return rechazo(
          'sin_permiso',
          'Otorgar un rol de plataforma requiere la capacidad organizaciones.listar: ' +
            'no se puede otorgar el alcance que uno no tiene.',
        );
      }
    }

    /* ── LA VALIDACIÓN VA SOBRE EL RESULTADO, NO SOBRE LA LISTA ──────────────
     *
     * Validar que las claves existan **no alcanza**, y el caso lo demuestra:
     * `{ rol: 'usuario', secciones: ['credenciales'] }` pasa cualquier validación de lista
     * —`credenciales` es una sección real— y produce **cero pestañas**, porque el rol `usuario` no
     * tiene `credenciales.ver`. La persona entraría y no vería nada.
     *
     * Así que se resuelven las capacidades del rol que se está asignando y se comprueba que la
     * intersección no sea vacía. Es la misma función que decide el menú, así que no hay dos reglas.
     */
    let alcanceAGuardar: string[] = [];
    if (rolDestino?.secciones_restringidas) {
      if (secciones === undefined) {
        return rechazo('peticion_invalida', MOTIVOS['sin_secciones']);
      }
      const pedidas = secciones as string[];
      if (pedidas.length === 0) {
        return rechazo('peticion_invalida', MOTIVOS['sin_secciones']);
      }

      const capacidades = new Set(
        (
          await db
            .selectFrom('roles_permisos')
            .select('permiso')
            .where('rol_id', '=', rolDestino.id)
            .execute()
        ).map((x) => x.permiso),
      );
      /* ── EL TERCER ARGUMENTO ERA `true` FIJO, Y ESO SE VOLVIÓ FALSO ────────
       *
       * Decía, con razón para entonces: *«acá no se está decidiendo qué ve NADIE… aplicar la regla
       * de la organización principal haría que el mismo alcance se acepte o se rechace según quién
       * esté dando de alta»*. Lo segundo sigue siendo cierto y por eso NO se usa la organización
       * de quien pide: se usa la del DESTINATARIO, que es de quien habla la pregunta.
       *
       * Lo que cambió es que ya existe un alcance que un rol habilita y el destinatario no puede
       * ver: `monitoreo` para alguien de una empresa cliente. Con `true` fijo, eso se aceptaba y
       * dejaba a la persona con cero pestañas — que es literalmente lo que `alcance_vacio` mide. */
      const efectivas = seccionesConAlcance(
        capacidades,
        { restringido: true, concedidas: new Set(pedidas) },
        destinoEsPrincipal,
      );
      if (efectivas.length === 0) {
        return rechazo('peticion_invalida', MOTIVOS['alcance_vacio']);
      }
      // Se guardan las PEDIDAS, no las efectivas. Si mañana el rol gana una capacidad, la pestaña
      // que ya estaba concedida aparece sola — y guardar solo las efectivas la habría perdido.
      alcanceAGuardar = pedidas;
    }
    // Un rol NO restringido ignora las secciones que vengan, y **no las guarda**: filas que nadie
    // mira son filas que resucitan el día que alguien marque ese rol.

    let creado: { id: string };
    try {
      creado = await db
        .insertInto('usuarios')
        .values({
          org_id: orgDestino,
          nombre: nombre.trim(),
          email,
          password_hash: hashear(temporal),
          // Nace con la marca. El `05` § 3: *"se guarda hasheada y el usuario nace con la marca de
          // 'debe cambiar la contraseña'"*, que es lo que hace que la temporal sea temporal.
          debe_cambiar_password: true,
          // QUIÉN LO HIZO, obligatorio y sin valor por defecto. El `07` § 1: *"si mañana aparece un
          // llamador nuevo, que no compile hasta que diga quién es."* El caso real que documenta
          // ocurrió con un parámetro que tenía valor por defecto —el id de una persona real— y
          // **todo** lo registrado, de cualquier organización, quedó firmado por esa persona.
          creado_por: contexto.usuarioId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    } catch (e) {
      const mensaje = String((e as Error).message);
      // UNICIDAD: código propio, sin el detalle de la base. El `05` § 3 lo nombra literal
      // (`409`, `email_duplicado`) y explica por qué: el mensaje de la base *"es un canal que
      // confirma la existencia de un registro de otra organización, aunque quien pregunta no
      // pueda verlo"*. Acá eso es exacto — el índice de correo es global.
      if (/duplicate key|unique constraint/i.test(mensaje)) {
        return rechazo('email_duplicado');
      }
      // Los DISPARADORES sí devuelven su mensaje: *"están escritos para leerse"* (05 § 3). Y
      // **solo** ésos: el discriminante es el SQLSTATE (`P0001`), no el texto, porque un error
      // estructural nombra la tabla y `ADR-0704` lo prohíbe.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    // EL ALCANCE, TAMBIÉN EN LA MISMA TRANSACCIÓN, y por el mismo motivo que el rol: partido en dos
    // llamadas, un fallo de la segunda dejaría a la persona con su rol restringido y **sin ninguna
    // pestaña** — o sea creada y sin poder trabajar. Acá un fallo deshace también el alta.
    //
    // EL ROL, EN LA MISMA TRANSACCIÓN. Ver el encabezado: partido en dos llamadas, entre ellas la
    // persona existía sin ninguna capacidad, y un fallo de la segunda la dejaba así. Acá un fallo
    // deshace también el alta.
    if (rolDestino) {
      try {
        await db
          .insertInto('usuarios_roles')
          .values({
            usuario_id: creado.id,
            rol_id: rolDestino.id,
            // QUIÉN LO HIZO. Obligatorio, sin valor por defecto (07 § 1).
            asignado_por: contexto.usuarioId,
          })
          .execute();
      } catch (e) {
        // Los tres disparadores de la migración 007 que miran esta tabla dicen exactamente qué
        // pasó, así que su mensaje se devuelve tal cual. El discriminante es el SQLSTATE, no el
        // texto: un error estructural nombra la tabla y `ADR-0704` lo prohíbe.
        const deDisparador = mensajeDeDisparador(e);
        return deDisparador
          ? rechazo('rechazo_de_la_base', deDisparador)
          : rechazo('rechazo_de_la_base');
      }
    }

    // Y LAS PESTAÑAS. Mismo argumento que el rol: en la misma transacción o no van.
    if (alcanceAGuardar.length > 0) {
      await db
        .insertInto('usuarios_secciones')
        .values(
          alcanceAGuardar.map((seccion) => ({
            usuario_id: creado.id,
            seccion,
            // QUIÉN LO HIZO, obligatorio y sin valor por defecto, como en el rol.
            concedida_por: contexto.usuarioId,
          })),
        )
        .execute();
    }

    // El correo SÍ va a la auditoría; la contraseña temporal NUNCA, *"ni ahí"*. El tipo `Detalle`
    // no tiene campo para ella, así que esto no depende de que nadie se olvide.
    //
    // `orgId` es la de DESTINO, no la de la sesión: la auditoría tiene que decir en qué empresa
    // apareció la persona. Con la de la sesión, un alta hecha desde ARIA sobre un cliente quedaría
    // registrada en ARIA y el registro del cliente no la mencionaría.
    await auditarAdministracion(db, {
      accion: 'usuario_creado',
      actor: contexto.usuarioId,
      objetivo: creado.id,
      orgId: orgDestino,
      detalle: { email },
    });

    // La temporal, UNA sola vez. El `05` § 3: *"no se puede volver a consultar: para eso está el
    // restablecimiento, que genera otra."*
    return ok(
      {
        creado: true,
        id: creado.id,
        temporal,
        seMuestraUnaVez: true,
        rol: rolDestino ? rol : null,
        // Las pestañas que quedaron, para que la pantalla muestre lo que se guardó y no lo que se
        // mandó. Vacío significa «este rol no se restringe», no «no ve ninguna».
        secciones: alcanceAGuardar,
      },
      201,
    );
  });
}
