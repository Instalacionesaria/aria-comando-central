// ADR-0301 — Toda operación llama al portero.
//
// Las tres operaciones de la propia sesión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// GET Y DELETE NO PASAN POR EL PORTERO, Y NO ES UNA EXCEPCIÓN CÓMODA
//
// El paso 0 del 03 § 5 las saca a propósito, con un motivo que vale releer:
//
//   "Mezclarlas en esta función obliga a devolver dos formas distintas —el contexto, o un
//    objeto con un campo que hay que recordar mirar— y en un lenguaje sin tipos eso es una
//    fuente de defectos silenciosos: quien escriba `si no contexto: devolver` sobre la forma
//    nueva NUNCA corta, porque un objeto siempre es verdadero."
//
// Y cada una tiene su razón:
//
//   · `GET` — *"'¿hay alguien?' es una pregunta legítima sin sesión, y responde 200
//     `{ autenticado: false }`. Si respondiera 401, el arranque del frontend entraría en
//     bucle con el manejador que escucha ese código."*
//   · `DELETE` — *"tiene que borrar la cookie SIEMPRE, también cuando la sesión ya venció: es
//     la única forma de que el navegador deje de mandarla."*
//
// Las dos usan `sesionOpcional(`, que tiene su propio contrato: devuelve la sesión o nulo, y
// nunca responde por su cuenta.
//
// UNA CONTRADICCIÓN DE LA ESPECIFICACIÓN, RESUELTA Y REPORTADA: el paso 0 dice que el
// portero LANZA si la ruta está en `SIN_SESION_REQUERIDA` —o sea que estas rutas nunca
// llegan a los pasos 2 y 3—, pero el comentario del mismo paso 0 afirma que "cuando SÍ hay
// sesión las dos siguen pasando por el resto del portero", y el paso 3 lleva una guarda que
// solo tiene sentido si SÍ llegan. Es la misma sección del mismo documento, así que la regla
// de precedencia no aplica. La lectura que hace consistente todo el texto —y que da el mismo
// comportamiento observable por las dos vías— es: estas rutas están en las cuatro listas de
// `ESTADOS`, así que el paso 2 nunca las rechazaría, y están exentas del paso 3 por la guarda
// literal. Implementadas por `sesionOpcional(`, el resultado es idéntico.
// ═══════════════════════════════════════════════════════════════════════════════

import { cookieSesionBorrada } from '../../../../lib/autorizacion/cookie.ts';
import { exigir, NINGUNA, sesionOpcional } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { hashear, verificar } from '../../../../lib/datos/hash.ts';
import { auditar } from '../../../../lib/autenticacion/auditoria.ts';
import { estadoQueCorresponde } from '../../../../lib/autenticacion/estado.ts';
import { MINIMO_PASSWORD } from '../../../../lib/autenticacion/politica.ts';
import {
  menuVisible,
  seccionDeArranque,
  seccionesConAlcance,
} from '../../../../lib/autorizacion/secciones.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';

/**
 * ¿Quién soy? Responde 200 **siempre**, con o sin sesión.
 *
 * Devuelve el estado además del usuario, y eso no es adorno: sin él el frontend no sabe qué
 * pantalla mostrar y no puede salir de un estado restringido (02 § 5, 09 § 5).
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await sesionOpcional(peticion);
  if (!contexto) return ok({ autenticado: false });

  /* Una sola vez: el menú y la pantalla de arranque tienen que salir de la MISMA lista. Llamar a
     `menuVisible` dos veces daría el mismo resultado hoy y es exactamente la forma de que mañana
     no lo dé. */
  const menu = menuVisible(contexto.permisos, contexto.alcance);

  return ok({
    autenticado: true,
    estado: contexto.estado,
    usuarioId: contexto.usuarioId,
    organizacion: contexto.organizacion,
    // Se devuelven los permisos para que el menú se arme, y las secciones ya filtradas para
    // que las dos mitades usen la MISMA función (03 § 7). Es comodidad, no seguridad: cada
    // operación valida igual.
    permisos: [...contexto.permisos].sort(),
    // Las dos mitades cortadas por el MISMO alcance. Si se filtrara solo una, la otra quedaría
    // entera: `secciones` la lee `AjustesView` para decidir sus pestañas y `menu` lo lee `Nav`, así
    // que cortar una sola deja media interfaz sin restringir.
    secciones: seccionesConAlcance(contexto.permisos, contexto.alcance),
    // El menú YA AGRUPADO y en orden, no una lista para que el cliente ordene. Es el § 9
    // regla 3 aplicado a la interfaz: si el componente supiera el orden de los grupos,
    // tendríamos otra vez dos listas que se pueden desordenar una respecto de la otra — que
    // es el defecto que la Etapa 11 pagó, descrito en `lib/autorizacion/secciones.ts`.
    menu,
    /**
     * Con qué pantalla se abre, decidido ACÁ por el mismo motivo que el menú viene agrupado: si
     * cada mitad de la interfaz lo dedujera, serían tres deducciones que se pueden desincronizar
     * — y ya se desincronizaron. Ver `seccionDeArranque`.
     */
    arranque: seccionDeArranque(menu),
    // El nombre del usuario, para el pie del menú. Hasta la Etapa 11 decía "Francisco ·
    // Gerencia" escrito a mano en el JSX: el mismo nombre para todos los inquilinos.
    usuarioNombre: contexto.usuarioNombre,
    /**
     * ¿Puede moverse entre empresas?
     *
     * Se responde ACÁ y no se deduce en el navegador, y es la diferencia entre un botón que
     * funciona y uno que da 409. La condición es **exactamente la que comprueba
     * `PATCH /api/auth/sesion`**: la capacidad `organizaciones.listar` y tener un rol de
     * plataforma. Reimplementarla en el cliente sería tener dos definiciones de lo mismo, y la
     * que se quede vieja ofrece un control que va a ser rechazado.
     */
    puedeCambiarDeEmpresa:
      contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar'),
    // El cartel permanente del 03 § 3: "cuando mira otra organización, la interfaz lo
    // muestra de forma permanente. No es decoración: sin eso, alguien puede mirar la
    // pantalla, sacar una conclusión sobre 'los números' y estar viendo los de otro
    // cliente."
    mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
  });
}

/**
 * Cerrar sesión. Borra la cookie **siempre**, haya sesión o no.
 *
 * El orden importa: primero se borra la fila si existe, y la cabecera de la cookie va en la
 * respuesta en los dos casos. Si la fila no existe —sesión ya vencida— igual hay que
 * mandarla, porque es la única forma de que el navegador deje de enviar la cookie.
 */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await sesionOpcional(peticion);

  if (contexto) {
    await conIdentidad(async (db) => {
      await db.deleteFrom('sesiones').where('id', '=', contexto.sesionId).execute();
    });
  }

  const respuesta = ok({ cerrada: true });
  // La cabecera se escribe a mano con los cuatro atributos. `cookies().delete()` emitiría un
  // `Set-Cookie` sin `Secure`, el navegador lo rechazaría por el prefijo `__Host-`, y esto
  // respondería 200 con la cookie intacta. Ver `lib/autorizacion/cookie.ts`.
  respuesta.headers.append('set-cookie', cookieSesionBorrada());
  return respuesta;
}

/**
 * Cambiar la organización activa. Solo el rol de plataforma.
 *
 * Exige `organizaciones.listar`, que existe en el catálogo justamente para esto — el
 * comentario de la migración 003 lo dice: *"necesaria para el cambio de organización activa
 * del rol de plataforma: ese endpoint tiene que exigir una capacidad explícita, no
 * 'ninguna'"*.
 *
 * `esRolDePlataforma` se comprueba **además** de la capacidad, y no es redundante: la
 * capacidad dice "puede cambiar de organización", y `resolverSesion` solo respeta
 * `org_activa` si el rol es de plataforma. Sin las dos, alguien podría escribir la columna y
 * quedarse sin efecto — un cambio que reporta éxito y no ocurre (07 § 0).
 */
export async function PATCH(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['organizaciones.listar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  if (!contexto.esRolDePlataforma) {
    return ok({ cambiada: false, motivo: 'sin_rol_de_plataforma' }, 409);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ cambiada: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const pedida = (cuerpo as { orgId?: unknown } | null)?.orgId;
  // `null` es un valor legítimo: significa "volver a mi propia organización".
  if (pedida !== null && typeof pedida !== 'string') {
    return ok({ cambiada: false, motivo: 'org_id_invalido' }, 400);
  }

  await conIdentidad(async (db) => {
    await db
      .updateTable('sesiones')
      .set({ org_activa: pedida })
      .where('id', '=', contexto.sesionId)
      .execute();

    // ADR-0809 · Se EMITE `organizacion_cambiada`, con el destino en el detalle.
    //
    // Esta acción estaba en el tipo `Accion` desde la Etapa 3 y **no se emitía en ningún lado**. Es
    // exactamente el defecto que `ADR-0809` describe: *"un cero en la vigilancia es indistinguible
    // de 'nadie cableó el punto de emisión', y tres de las seis señales quedan apagadas sin que nada
    // falle"*.
    //
    // El `org_destino` va en el detalle porque la señal 5 cuenta
    // `count(distinct detalle->>'org_destino')` para detectar *"uso indebido de una cuenta con
    // acceso a todo"*. Y va en la MISMA transacción que el cambio: el `08` § 12 pide que el acceso
    // de soporte quede registrado, y un cambio sin su fila es un acceso sin registrar.
    //
    // La fila se guarda con la organización VISITADA —`org_destino` cuando hay una, la propia
    // cuando se vuelve— porque el `08` § 12 lo pide así: *"la fila se guarda con la organización
    // VISITADA, y la de origen va en el detalle. Al revés, el administrador de un cliente no ve en
    // su propia auditoría que alguien entró."*
    await auditar(db, {
      accion: 'organizacion_cambiada',
      usuarioId: contexto.usuarioId,
      orgId: pedida ?? contexto.orgPropia,
      detalle: { org_destino: pedida },
    });
  });

  return ok({ cambiada: true, orgActiva: pedida });
}

/**
 * Cambiar la propia contraseña. **NO exige ninguna capacidad**, y ésa es la fila `ADR-0406`.
 *
 * Es la ÚNICA salida del estado `debe_cambiar_password`. Si exigiera una capacidad, alguien
 * con contraseña temporal y sin esa capacidad quedaría encerrado sin salida — y el `03` § 5
 * ya estableció que *"un estado sin salida es una cuenta bloqueada que necesita a un
 * administrador"*.
 *
 * `NINGUNA` es un valor escrito a propósito, no una lista vacía: *"una lista vacía se puede
 * pasar por accidente y abriría la operación"* (03 § 5).
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ cambiada: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const actual = (cuerpo as { actual?: unknown } | null)?.actual;
  const nueva = (cuerpo as { nueva?: unknown } | null)?.nueva;
  if (typeof actual !== 'string' || typeof nueva !== 'string') {
    return ok({ cambiada: false, motivo: 'cuerpo_invalido' }, 400);
  }
  // El largo mínimo es lo único que se valida acá. La política de contraseñas completa no
  // está en la especificación y no se inventa.
  //
  // El número vive en `lib/autenticacion/politica.ts` y no acá: estaba duplicado con la
  // pantalla de entrada, y dos copias del mismo límite en los dos lados de la red divergen. El
  // por qué del valor —y qué se acepta al elegirlo— está escrito en ese archivo.
  if (nueva.length < MINIMO_PASSWORD) {
    return ok({ cambiada: false, motivo: 'demasiado_corta' }, 400);
  }

  return conIdentidad(async (db) => {
    const u = await db
      .selectFrom('usuarios')
      .select(['id', 'org_id', 'password_hash'])
      .where('id', '=', contexto.usuarioId)
      .executeTakeFirstOrThrow();

    // La contraseña ACTUAL se verifica aunque la sesión ya esté abierta: sin eso, una sesión
    // robada permite cambiar la contraseña y quedarse con la cuenta.
    if (!u.password_hash || !verificar(actual, u.password_hash)) {
      return rechazo('credenciales_invalidas');
    }

    await db
      .updateTable('usuarios')
      .set({ password_hash: hashear(nueva), debe_cambiar_password: false })
      .where('id', '=', u.id)
      .execute();

    // ── EL ESTADO SE RECALCULA. NO SE ASUME `activa`. ────────────────────────
    //
    // Acá había `.set({ estado: 'activa' })` con la constante, y era un agujero en
    // `ADR-0413` —*"un usuario con un rol que exige segundo factor no obtiene sesión
    // habilitada. INNEGOCIABLE"*—. El escenario completo, que es el camino NORMAL de un alta
    // hecha por un administrador:
    //
    //   1. Alta: `debe_cambiar_password = true` y un rol con `exige_segundo_factor`.
    //      `app/api/admin/usuarios/route.ts` pone esa marca en TODA alta.
    //   2. Login → `estadoQueCorresponde` rama 2 → `debe_cambiar_password`.
    //   3. Cambia la contraseña → esta línea la ponía en `activa`.
    //   4. `ESTADOS.activa` es `null`, o sea que el paso 2 del portero habilita TODA ruta.
    //
    // Resultado: entraba al sistema y trabajaba siete días **sin haber configurado nunca el
    // segundo factor que su rol exige**. Recién el login siguiente lo mandaba a
    // `debe_configurar_2fo`. Nada fallaba, y es exactamente lo que el encabezado de
    // `lib/autenticacion/estado.ts` viene advirtiendo: *"cada transición recalcula el estado
    // con las mismas cuatro ramas del login, EN VEZ DE ASUMIR QUE YA NO QUEDA NADA
    // PENDIENTE"*. Ese archivo incluso se declara usado por *"el login, el cambio de
    // contraseña y la verificación del segundo factor"* — y el cambio de contraseña no lo
    // llamaba.
    //
    // ── POR QUÉ `yaProboElFactor: true` ─────────────────────────────────────
    //
    // Sin esa opción, la rama 1 devuelve `pendiente_2fo` cuando el factor está confirmado, y
    // acá eso sería un bucle: una sesión SOLO puede estar en `debe_cambiar_password` de dos
    // maneras, y en las dos la rama 1 ya no corresponde.
    //
    //   · sin factor confirmado — el login llegó a la rama 2 directo;
    //   · con factor confirmado — el login dio `pendiente_2fo`, y para llegar a
    //     `debe_cambiar_password` hubo que pasar por `verificar`, o sea que **el factor ya se
    //     probó en esta sesión**.
    //
    // Con la opción puesta, los cuatro casos salen bien: rol que exige y factor sin
    // configurar → `debe_configurar_2fo` (el defecto, cerrado); rol que exige y factor ya
    // probado → `activa`; sin rol que exija → `activa`.
    //
    // Y sigue dentro del `if`: una sesión que YA estaba `activa` y cambia su contraseña no se
    // toca. Recalcular ahí la mandaría a `pendiente_2fo` por la rama 1 y le pediría el código
    // de nuevo a alguien que no cambió de estado — un cambio de comportamiento que este
    // arreglo no necesita.
    if (contexto.estado === 'debe_cambiar_password') {
      const siguiente = await estadoQueCorresponde(db, u.id, { yaProboElFactor: true });
      await db
        .updateTable('sesiones')
        .set({ estado: siguiente })
        .where('id', '=', contexto.sesionId)
        .execute();
    }

    // Y TODAS las demás sesiones del usuario se cierran. Cambiar la contraseña es lo que hace
    // alguien que sospecha que le entraron; dejar las otras sesiones vivas lo volvería inútil.
    await db
      .deleteFrom('sesiones')
      .where('usuario_id', '=', u.id)
      .where('id', '!=', contexto.sesionId)
      .execute();

    await auditar(db, {
      accion: 'password_cambiada',
      usuarioId: u.id,
      orgId: u.org_id,
    });

    return ok({ cambiada: true });
  });
}
