// ADR-0508 — Una organización nueva no hereda credenciales.
// ADR-0301 — Toda operación llama al portero.
//
// Alta de organización. Es una de las pocas operaciones que corre **sin contexto de
// organización**: la está creando.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO IMPORTANTE ES LO QUE NO HACE: HEREDAR
//
// El `05` § 2 lo cuenta como una lección pagada, y es la más caras del documento:
//
//   "En el sistema del que salen estas notas hubo un momento en que una organización nueva
//    HEREDABA el token del proveedor externo de la organización principal, por un valor por
//    defecto que parecía inofensivo. El resultado: LA ORGANIZACIÓN NUEVA ESCRIBÍA EN LA CUENTA
//    EXTERNA DE OTRA EMPRESA. Nada falló — el token era válido, la API respondía 200."
//
// La regla que salió de ahí: *"si falta una credencial, la organización no opera y la interfaz
// explica qué falta. NUNCA un valor por defecto que la haga funcionar con las credenciales de
// otro."*
//
// Por eso esta operación **no escribe ni una fila** en `organizaciones_credenciales`, y la
// respuesta dice explícitamente que no opera. El criterio de cierre de `EJECUCION` § 5 es
// exactamente eso: *"una organización nueva nace sin credenciales, no opera, y la respuesta lo
// dice."*
//
// ── Y NADA MÁS ───────────────────────────────────────────────────────────────
//
// El `05` § 2: *"¿Qué crear junto con la organización? **Nada más.** Ni usuarios, ni datos de
// ejemplo, ni configuración inventada. La tentación de 'sembrar' una organización nueva con datos
// de demostración termina en clientes que ven información que no es suya y no saben si es real."*
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { listarOrganizaciones } from '../../../../lib/administracion/organizaciones.ts';

/**
 * A qué pantalla pertenece el `GET`. Es un `export`, no un comentario.
 *
 * ── SOLO EL `GET` LO DECLARA, Y EL `POST` SIGUE EN `SIN_PANTALLA` ───────────
 *
 * `ADR-0304` exige que las operaciones de una misma pantalla pidan el MISMO conjunto de
 * capacidades, y estas dos piden distinto: `organizaciones.listar` para ver,
 * `organizaciones.crear` para dar de alta. Igualarlas sería una escalada silenciosa — el
 * portero usa `contieneAlguna`, así que alguien con solo `listar` podría crear.
 *
 * La salida no la invento acá: está escrita desde la Etapa 5 en `SIN_PANTALLA`, donde el
 * comentario de las seis operaciones de administración dice *"la pantalla de administración,
 * cuando exista, va a tener su GET propio, y ÉSE sí entra a `SECCIONES`"*. Esto es ese día.
 *
 * Y el defecto que `ADR-0304` previene es de LECTURAS —*"veía una sección con datos y cuatro
 * en blanco"*— no de mutaciones: el `POST` no llena ningún panel, así que no puede dejar uno
 * a medias.
 */
export const PANTALLA = 'empresas';

/**
 * Las organizaciones que existen. **Solo desde la principal.**
 *
 * ── LA REGLA DE LA EMPRESA PRINCIPAL, Y QUÉ CLASE DE REGLA ES ───────────────
 *
 * Se pidió así: administrar empresas y usuarios se hace desde ARIA. Y conviene decir qué
 * protege y qué no: **no es una barrera de seguridad**, es una de coherencia. La barrera es
 * `organizaciones.listar`, que solo tiene el rol de plataforma; quien no la tiene no llega acá
 * esté donde esté.
 *
 * Lo que evita es otra cosa, y es real: que alguien administre la plataforma **creyendo que
 * está en una empresa cliente**. Con la sesión conmutada a otra organización, el cartel
 * permanente dice "estás mirando otra organización" y a la vez esta pantalla mostraría las
 * veinte — dos afirmaciones que se contradicen en la misma vista.
 *
 * Se comprueba en el SERVIDOR además de en la interfaz para que las dos mitades digan lo
 * mismo. Una regla que solo vive en la pantalla se salta con una petición a mano, y entonces
 * la regla no era una regla.
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['organizaciones.listar']);
  if (contexto instanceof Response) return contexto;

  if (!contexto.organizacion.esPrincipal) {
    return rechazo(
      'fuera_de_la_principal',
      'Las empresas se administran desde la organización principal. Volvé a la tuya para verlas.',
    );
  }

  const organizaciones = await conIdentidad(async (db) => listarOrganizaciones(db));
  return ok({ organizaciones });
}

/**
 * El texto de cada rechazo de validación, uno por motivo.
 *
 * ── POR QUÉ ESTO REEMPLAZÓ A `ok({ creada: false, motivo }, 400)` ───────────
 *
 * La forma anterior **no llegaba a la pantalla**. `lib/http/cliente.ts` clasifica cualquier
 * respuesta no-ok como `{ tipo: 'rechazado' }` y solo conserva `codigo` y `detalle` del cuerpo:
 * el `motivo` se perdía en el camino, así que los tres se veían todos como «Rechazado (400)».
 *
 * Se descubrió construyendo la pantalla de Empresas: crear una sin tocar el identificador
 * respondía «Rechazado (400)» y no había forma de saber que el problema era el slug.
 */
const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_nombre: 'La empresa necesita un nombre.',
  slug_invalido:
    'El identificador corto no sirve: minúsculas, números y guiones, entre 3 y 40 caracteres.',
  slug_duplicado: 'Ya existe una empresa con ese identificador corto.',
} as const;

/** Un slug: minúsculas, números y guiones. Es parte de una URL, así que se acota. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export async function POST(peticion: Request): Promise<Response> {
  // `organizaciones.crear` es literal del `05` § 2, que agrega: *"que en la práctica solo tiene el
  // rol de plataforma"*. En la práctica, no por construcción: la capacidad se puede otorgar a
  // otro rol sin tocar código, que es exactamente lo que el modelo de capacidades compra.
  const contexto = await exigir(peticion, ['organizaciones.crear']);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const nombre = (cuerpo as { nombre?: unknown } | null)?.nombre;
  const slug = (cuerpo as { slug?: unknown } | null)?.slug;
  const zonaHoraria = (cuerpo as { zonaHoraria?: unknown } | null)?.zonaHoraria;

  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return rechazo('peticion_invalida', MOTIVOS['falta_nombre']);
  }
  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    return rechazo('peticion_invalida', MOTIVOS['slug_invalido']);
  }

  return conIdentidad(async (db) => {
    let creada: { id: string };
    try {
      creada = await db
        .insertInto('organizaciones')
        .values({
          nombre: nombre.trim(),
          slug,
          // Los valores por defecto que el `05` § 2 dice que SÍ conviene poner. `es_principal`
          // NO se pasa: su valor por omisión es falso y el índice parcial
          // `organizaciones_una_principal` no dejaría una segunda.
          ...(typeof zonaHoraria === 'string' ? { zona_horaria: zonaHoraria } : {}),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    } catch (e) {
      // El `05` § 3 lo dice para el alta de usuario y vale igual acá: los mensajes de UNICIDAD
      // **no se devuelven nunca**, porque *"las verificaciones de unicidad no pasan por la
      // seguridad a nivel de fila… un mensaje de 'ya existe una fila con ese valor' es un canal
      // que confirma la existencia de un registro de otra organización"*. Acá el slug es global
      // por diseño, pero la forma se respeta igual: código propio, sin el detalle de la base.
      const mensaje = String((e as Error).message);
      if (/duplicate key|unique constraint/i.test(mensaje)) {
        return rechazo('slug_duplicado', MOTIVOS['slug_duplicado']);
      }
      // Los mensajes de los DISPARADORES sí se devuelven tal cual (05 § 3) — y **solo** ésos.
      // `ADR-0704` exige que ningún cuerpo de error revele estructura, y un error estructural
      // nombra la tabla: `column "x" of relation "usuarios" does not exist`. El discriminante es el
      // SQLSTATE, no el texto. Ver `mensajeDeDisparador()`.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    await auditarAdministracion(db, {
      accion: 'organizacion_creada',
      actor: contexto.usuarioId,
      // El "objetivo" de un alta de organización es la organización misma. No hay usuario
      // objetivo, y dejar el campo vacío haría que la fila no dijera qué se creó.
      objetivo: creada.id,
      orgId: creada.id,
      detalle: { slug },
    });

    // LA RESPUESTA LO DICE. No es un adorno: es la mitad del criterio de cierre. Sin estos dos
    // campos, quien crea la organización asume que ya puede operar, y el sistema que la usa
    // asume lo mismo — que es exactamente cómo el token de otra empresa terminó en uso.
    return ok(
      {
        creada: true,
        id: creada.id,
        slug,
        opera: false,
        credenciales: [],
        motivo: 'sin_credenciales',
        // El texto es para la interfaz, y dice QUÉ FALTA, no solo que falta.
        detalle:
          'La organización se creó y NO opera todavía: no tiene ninguna credencial de servicios ' +
          'externos. No hereda las de ninguna otra organización. Hay que cargarlas.',
      },
      201,
    );
  });
}
