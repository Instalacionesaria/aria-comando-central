// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// `resolverSesion(` y el contexto de la petición.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTA PIEZA NO ESTÁ ESCRITA JUNTA EN NINGÚN DOCUMENTO
//
// El contrato sale de cruzar cinco: el 02 § 2 (la consulta, el SHA-256, la renovación
// deslizante), el 04 § 8 (`orgPropia` y `orgEfectiva`), el 03 § 4 y § 5 (los permisos
// efectivos y cómo los usa el portero), el 09 § 5 (los cuatro estados y su precedencia) y
// el 08 § 5.1 (el techo absoluto). Lo que sigue es ese cruce, con las decisiones que
// ninguno de los cinco toma marcadas como tales.
//
// El login —que CREA sesiones— es la Etapa 4. Esto solo las CONSUME.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { conIdentidad } from '../datos/capa.ts';

/** El nombre de la cookie. El prefijo es parte del nombre, no un adorno (08 § 5.2). */
// El nombre de la cookie se define en `cookie.ts`, que no importa nada, y se REEXPORTA acá.
//
// La dirección de la dependencia se invirtió el día que `proxy.ts` necesitó el nombre: este
// archivo importa `kysely` y `lib/datos/capa.ts`, así que importarlo desde acá arrastraba `pg` y
// el agrupador de conexiones a un archivo que puede correr en el borde. El motivo completo está
// en `cookie.ts`.
//
// Se reexporta en vez de mover y actualizar los diez importadores: una única definición, y ningún
// cambio en los archivos que ya la pedían de acá.
export { COOKIE_SESION } from './cookie.ts';

/** Los cuatro estados, tal como los declara el `check` de `identidad.sesiones`. */
export type EstadoSesion =
  | 'activa'
  | 'pendiente_2fo'
  | 'debe_cambiar_password'
  | 'debe_configurar_2fo';

/**
 * El contexto de la petición: lo que el portero devuelve y lo que toda operación usa.
 *
 * Los nombres `estado`, `permisos`, `orgEfectiva`, `orgPropia` y `esRolDePlataforma` NO
 * son elegibles: son los que usa el 03 § 5 y el 04 § 8, y `EJECUCION` § 6 dice que *"los
 * nombres son las cadenas que buscan las pruebas […] un sinónimo rompe la prueba sin
 * romper el código, que es la peor combinación"*.
 *
 * Nótese que NO hay un booleano `debeCambiarPassword`. El 09 § 5 lo marca explícitamente
 * como *"la regla REEMPLAZADA"*: con un booleano por estado, cada estado nuevo agrega un
 * campo y el frontend maneja dos vocabularios. El estado es UN valor.
 */
export interface Contexto {
  sesionId: string;
  /** Cuando se creo la sesion. Lo necesita el tope de codigos del segundo factor. */
  creadaEl: Date;
  usuarioId: string;
  /**
   * El nombre del usuario. Lo necesita el pie del menú, que hasta la Etapa 11 decía
   * *"Francisco · Gerencia"* escrito a mano — el mismo nombre para todos los inquilinos.
   *
   * No cuesta una consulta: la que resuelve la sesión ya une `usuarios` para comprobar que
   * esté activo.
   */
  usuarioNombre: string;
  estado: EstadoSesion;
  /** La organización a la que PERTENECE el usuario (04 § 8). */
  orgPropia: string;
  /**
   * La organización sobre la que está trabajando AHORA (04 § 8).
   *
   * Es el valor que recibe `conOrganizacion(`. Todo lo demás usa éste, nunca `orgPropia`.
   */
  orgEfectiva: string;
  /**
   * Nombre y estado de `orgEfectiva`. El nombre lo necesita el cartel permanente (03 § 3).
   *
   * `esPrincipal` se agregó en la Etapa 11 y no es decorativo: administrar empresas y usuarios
   * se hace **desde la principal**, y sin este dato la interfaz no puede saber si mostrar esas
   * pestañas. Deducirlo comparando el nombre con la cadena `'ARIA'` sería lo fácil y lo
   * frágil — el día que alguien renombre la organización, la pantalla cambia de comportamiento
   * sin que nadie toque una línea.
   */
  organizacion: {
    id: string;
    nombre: string;
    activa: boolean;
    zonaHoraria: string;
    esPrincipal: boolean;
  };
  /** Los permisos efectivos, calculados en esta petición. Nunca cacheados. */
  permisos: ReadonlySet<string>;
  /**
   * Si el usuario tiene algún rol de plataforma.
   *
   * NO habilita ningún atajo en el portero —`EJECUCION` § 3 cerró que el rol de plataforma
   * tiene todas las capacidades cargadas en la tabla—. Lo único que decide es si se
   * respeta `sesiones.org_activa`.
   */
  esRolDePlataforma: boolean;
  /** ¿Está mirando una organización que no es la suya? Lo necesita el cartel permanente. */
  mirandoOtraOrganizacion: boolean;
}

/**
 * El hash del token de sesión. **SHA-256, no el hash lento de las contraseñas.**
 *
 * El 02 § 2 lo dice y explica por qué no es una inconsistencia: *"el token ya son 32 bytes
 * aleatorios, así que no hay diccionario que probar. El costo del algoritmo lento no
 * compraría nada y se pagaría en CADA PETICIÓN"*.
 *
 * Vive acá y no en `lib/datos/hash.ts` a propósito: si estuvieran juntas, la de las
 * contraseñas es la que alguien va a reusar por analogía, y eso son ~100 ms de CPU por
 * petición para cero beneficio.
 *
 * DECISIÓN QUE LA ESPECIFICACIÓN NO TOMA: la codificación es **hexadecimal**. Ningún
 * documento dice hex o base64 — y el que lo elija distinto en la Etapa 4 (que escribe) que
 * en la Etapa 3 (que lee) hace que NADIE pueda entrar. Falla ruidoso, pero desperdicia una
 * tarde. Por eso hay una sola función y las dos etapas la comparten.
 */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Resuelve la sesión de una petición. Devuelve el contexto, o **nulo** si no hay sesión.
 *
 * "No hay sesión" agrupa tres cosas a propósito —no hay cookie, la fila no existe, venció
 * alguno de los dos plazos— porque hacia afuera son lo mismo. La distinción no la hace esta
 * función: la hace la RUTA (las dos de `SIN_SESION_REQUERIDA` responden 200; el resto, 401).
 *
 * **LO QUE NO HACE: tragarse errores.** Un `try { … } catch { return null }` alrededor de
 * esto convierte un parpadeo de la base en un 401 masivo —todos los usuarios expulsados a
 * la vez, y en los registros parece que a nadie le andaba la sesión—. Viola la regla 2 del
 * `07` § 0 (*"un valor nulo significa una sola cosa"*) y el `07` § 4 lo describe ya
 * ocurrido: *"sin internet la aplicación muestra el login en vez de decir que no pudo
 * preguntar"*. Si la base falla, esto LANZA, y el portero responde 503.
 */
export async function resolverSesion(token: string | undefined): Promise<Contexto | null> {
  if (!token) return null;

  const hash = hashDeToken(token);

  return conIdentidad(async (db) => {
    // Los DOS vencimientos van DENTRO de la consulta, no comparados en TypeScript.
    //
    // El 02 § 2 explica por qué, y es una trampa de las que solo aparecen en producción:
    // *"Filtrarla después, en el lenguaje, haría que el reloj del proceso decidiera si una
    // sesión vencida sigue valiendo. Con varios procesos —o con contenedores cuyos relojes
    // derivan— eso es un problema intermitente. En la consulta decide el reloj de la base,
    // que es uno solo."*
    //
    // Y el segundo vencimiento es el que se olvida: sin `expira_absoluto > now()` una
    // sesión usada a diario NUNCA VENCE, así que *"un token robado vive para siempre
    // mientras el ladrón lo siga usando"* (08 § 5.1). Todas las pruebas de login pasan
    // igual.
    //
    // `u.activo` es DEFENSA EN PROFUNDIDAD y una decisión que la especificación no toma:
    // el 05 § 6 dice que al desactivar un usuario se cierran sus sesiones, o sea que la
    // defensa es una ESCRITURA en otra operación. Si esa escritura falla o se olvida, el
    // usuario desactivado sigue trabajando hasta que la sesión venza, y nada avisa. Una
    // condición más acá cuesta cero y no depende de que otra operación haya salido bien.
    const fila = await db
      .selectFrom('sesiones as s')
      .innerJoin('usuarios as u', 'u.id', 's.usuario_id')
      .where('s.token_hash', '=', hash)
      .where('s.expira_el', '>', sql<Date>`now()`)
      .where('s.expira_absoluto', '>', sql<Date>`now()`)
      .where('u.activo', '=', true)
      .select([
        's.id as sesion_id',
        's.usuario_id',
        's.estado',
        's.org_activa',
        's.expira_el',
        's.creada_el',
        'u.org_id as org_propia',
        'u.nombre as usuario_nombre',
      ])
      .executeTakeFirst();

    if (!fila) return null;

    // Los permisos efectivos, calculados EN ESTA PETICIÓN.
    //
    // El 03 § 4 es explícito sobre por qué no van en el token ni en la cookie: *"si a
    // alguien le quitan un permiso, seguiría teniéndolo hasta que su sesión venza"*. Con
    // sesiones de siete días, eso es una semana — y como el permiso quitado ya no se usa,
    // nadie reporta nada.
    //
    // La vista `usuarios_permisos` tiene `security_invoker = true`, así que las políticas
    // de las dos tablas que lee siguen aplicando. Sin eso correría con los permisos de su
    // dueño y devolvería TODO.
    const permisos = new Set(
      (
        await db
          .selectFrom('usuarios_permisos')
          .select('permiso')
          .where('usuario_id', '=', fila.usuario_id)
          .execute()
      ).map((p) => p.permiso),
    );

    // ¿Tiene algún rol de plataforma?
    //
    // DECISIÓN QUE LA ESPECIFICACIÓN NO TOMA. Ningún documento define cómo se calcula
    // `esRolDePlataforma`. Se usa la bandera `solo_principal`, que el 03 § 3 llama *"LA
    // BARRERA contra la escalada entre inquilinos"* y que un disparador de la base ya hace
    // cumplir — así que el dato es tan confiable como la barrera misma.
    //
    // Lo que está PROHIBIDO es la tercera vía, la que aparece sola: comparar
    // `clave === 'superadministrador'`. Funciona hoy y miente el día que exista un segundo
    // rol de plataforma, y es exactamente lo que `ADR-0302` busca en el código.
    const plataforma = await db
      .selectFrom('usuarios_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.rol_id')
      .where('ur.usuario_id', '=', fila.usuario_id)
      .where('r.solo_principal', '=', true)
      .select('r.id')
      .executeTakeFirst();
    const esRolDePlataforma = plataforma !== undefined;

    // LA FÓRMULA DEL 04 § 8, y el `?:` es la barrera entera:
    //
    //   orgEfectiva = (esRolDePlataforma y sesion.orgActiva) ? sesion.orgActiva : orgPropia
    //
    // Calcularla sin exigir `esRolDePlataforma` ES LA FUGA ENTRE INQUILINOS, y no lanza: la
    // consulta anda, devuelve filas, y son de otro cliente. El 04 § 8 lo dice al revés a
    // propósito: *"si alguien escribiera esa columna por otra vía —un script, un bug, una
    // migración— un usuario común seguiría trabajando en su propia organización: el valor
    // está ahí y el código no lo mira"*.
    const orgEfectiva =
      esRolDePlataforma && fila.org_activa ? fila.org_activa : fila.org_propia;

    const org = await db
      .selectFrom('organizaciones')
      .where('id', '=', orgEfectiva)
      .select(['id', 'nombre', 'activa', 'zona_horaria', 'es_principal'])
      .executeTakeFirst();

    // Que `orgEfectiva` no exista es imposible por clave foránea, pero si pasara, devolver
    // "no hay sesión" escondería un defecto de integridad detrás de un login.
    if (!org) {
      throw new Error(
        `resolverSesion: la organización ${orgEfectiva} no existe. ` +
          'Es una violación de integridad referencial, no una sesión inválida.',
      );
    }

    await renovar(db, fila.sesion_id, fila.estado, fila.expira_el);

    return {
      sesionId: fila.sesion_id,
      creadaEl: fila.creada_el,
      usuarioId: fila.usuario_id,
      usuarioNombre: fila.usuario_nombre,
      estado: fila.estado,
      orgPropia: fila.org_propia,
      orgEfectiva,
      organizacion: {
        id: org.id,
        nombre: org.nombre,
        activa: org.activa,
        zonaHoraria: org.zona_horaria,
        esPrincipal: org.es_principal,
      },
      permisos,
      esRolDePlataforma,
      mirandoOtraOrganizacion: orgEfectiva !== fila.org_propia,
    };
  });
}

/** Cuánto dura la ventana deslizante, y a partir de cuándo vale moverla. */
const VENTANA_DIAS = 7;
const RENOVAR_SI_QUEDA_MENOS_DE_DIAS = 1;

/**
 * La renovación deslizante. **Es una escritura, y hay que decirlo.**
 *
 * Tres condiciones, y cada una tapa un agujero concreto del 02 § 2 y del 08 § 5.1:
 *
 * 1. **Solo si el estado es `activa`.** Sin esto, la primera petición a
 *    `POST /auth/2fo/verificar` extiende a siete días una sesión cuya identidad TODAVÍA NO
 *    SE PROBÓ. Nada falla.
 * 2. **Solo si queda menos de un día.** Renovar en cada petición no rompe nada: solo agrega
 *    una escritura por petición *"contra la tabla más consultada del sistema, para mover una
 *    fecha que casi siempre ya está lejos"*, y convierte la ventana deslizante en
 *    decoración. Se nota como lentitud, no como error.
 * 3. **Nunca toca `expira_absoluto`.** El techo duro es lo único que hace que un token
 *    robado no viva para siempre. Un `.set({ expira_el, expira_absoluto })` copiado del
 *    insert del login es exactamente cómo desaparece, en silencio.
 *
 * Y no hay cookie que reemitir: el 08 § 5.2 escribe la cookie SIN `Expires` —
 * `__Host-sesion=<token>; Path=/; HttpOnly; Secure; SameSite=Lax`— así que el único reloj
 * es el de la base y no hay dos plazos que puedan desincronizarse.
 */
async function renovar(
  db: Parameters<Parameters<typeof conIdentidad>[0]>[0],
  sesionId: string,
  estado: EstadoSesion,
  expiraEl: Date,
): Promise<void> {
  if (estado !== 'activa') return;

  const umbral = new Date(Date.now() + RENOVAR_SI_QUEDA_MENOS_DE_DIAS * 24 * 3600 * 1000);
  if (expiraEl > umbral) return;

  await db
    .updateTable('sesiones')
    .set({ expira_el: sql<Date>`now() + interval '${sql.lit(VENTANA_DIAS)} days'` })
    .where('id', '=', sesionId)
    .execute();
}
