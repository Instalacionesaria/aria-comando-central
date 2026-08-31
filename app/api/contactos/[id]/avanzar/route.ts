// Avanzar: registrar cómo terminó una conversación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// PRIMERO LA BASE, DESPUÉS EL CRM. EL ORDEN ES LA DECISIÓN.
//
// Son dos sistemas y entre ellos **no hay atomicidad**. Así que hay que elegir cuál va primero, y
// las dos mitades fallan distinto:
//
//   · **base y después CRM** (lo que se hace): si el CRM falla, el resultado está registrado, los
//     números de Inicio ya lo cuentan, el contacto ya se movió de columna, y lo único que falta es
//     que el CRM dispare sus automatismos. **Se puede reintentar** y la respuesta lo dice.
//
//   · **CRM y después base**: si la base falla, el CRM ya disparó sus flujos por un resultado que
//     acá no existe. Nadie sabe que pasó, no hay fila que reintentar, y **no se repara solo**.
//
// El segundo modo es irreversible con la información que queda. Por eso el orden no es preferencia.
//
// ── Y LA ETIQUETA SE PREGUNTA ANTES DE MANDARLA ─────────────────────────────
//
// `sePuedeMandar()` es obligatorio. El defecto que previene está en el encabezado de
// `lib/ghl/contrato.ts` y es el más caro de esa lista porque es invisible: **una etiqueta que no
// existe en la subcuenta se acepta con un 200 y no hace nada**. Preguntando antes, lo que no existe
// se queda en nuestra base —donde sí sirve— en vez de perderse creyendo que salió.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import type { Territorio } from '../../../../../lib/datos/esquema.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import {
  etiquetasDelResultado,
  etiquetasDelResultadoDelSetter,
  noAvisaAPropositoDelSetter,
} from '../../../../../lib/ghl/contrato.ts';
import { ponerEtiquetas } from '../../../../../lib/ghl/cliente.ts';
import { registrarResultado } from '../../../../../lib/negocio/avanzar.ts';
import {
  definicionDe,
  esAlgunaSalida,
  modoDe,
  modosDe,
  parDeSalida,
} from '../../../../../lib/negocio/salidas.ts';
import type { ParDeResultado } from '../../../../../lib/negocio/salidas.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El tope de la nota. Igual que el de la pestaña Notas: es la misma tabla. */
const TOPE_NOTA = 4000;

const MOTIVOS = {
  falta_modo:
    'Hay que decir cómo se persigue este seguimiento: lo retomás vos, o lo persigue la secuencia ' +
    'del CRM. Son dos cosas distintas y ninguna es el valor por omisión de la otra.',
  modo_invalido: 'Ese modo no existe para esta salida.',
  modo_sin_fecha: 'Un seguimiento que retomás vos necesita el día en que hay que volver.',
  modo_con_fecha:
    'La secuencia del CRM no usa una fecha nuestra: la pone su propio flujo. Si querés elegir el ' +
    'día, el seguimiento lo tenés que retomar vos.',
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  salida_invalida: 'Esa no es una salida de Avanzar.',
  /* Los dos motivos de la fase B. Van SEPARADOS de `salida_invalida` a propósito: «eso no existe» y
     «eso existe pero no es de este contacto» mandan a mirar dos cosas distintas, y colapsarlos haría
     que quien lo lea revise el nombre de la salida cuando el problema es el territorio. */
  salida_de_otro_territorio:
    'Esa salida no es de este contacto: cada territorio tiene las suyas, y registrar la del otro ' +
    'pisaría el resultado que ya tiene.',
  sin_territorio:
    'Este contacto no está en ningún territorio, así que no se sabe con qué vocabulario registrar ' +
    'el resultado. Vuelve a tenerlo cuando el CRM le devuelva su etiqueta de zona.',
  falta_monto: 'Esta salida necesita el monto: sin él no hay número que sumar en Inicio.',
  monto_invalido: 'El monto tiene que ser un número mayor o igual a cero.',
  nota_larga: `La nota no puede pasar de ${TOPE_NOTA} caracteres.`,
  fecha_invalida: 'La fecha para volver no se pudo leer.',
  fecha_pasada: 'La fecha para volver ya pasó.',
} as const;

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/avanzar'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.avanzar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }

  /* ══ FASE A · LO QUE SE PUEDE DECIDIR SIN LEER LA BASE ═══════════════════
   *
   * Solo se reconoce que la salida **existe en algún catálogo**. Quién puede registrarla se decide
   * en la fase B, con el territorio del contacto en la mano.
   *
   * ── POR QUÉ ESTÁ PARTIDA EN DOS, Y NO ES PROLIJIDAD ──────────────────────
   *
   * Hasta la Etapa 12 la validación era una sola —`esSalidaDelCloser`— y corría antes de leer el
   * contacto. Eso alcanzaba mientras las salidas del setter estuvieran rechazadas para todos: eran
   * un 400 y nadie podía tocarlas.
   *
   * El día que el setter puede registrar las suyas, esa única validación **deja de proteger**. La
   * ruta pide `contactos.avanzar` sin pantalla, las dos pestañas tienen esa capacidad, y la ficha se
   * abre desde cualquier territorio a propósito. Sin la fase B, cualquiera abre la ficha de un
   * contacto vendido, registra `agendo`, y la etapa pasa de `ganado` a `agendado`: la píldora deja
   * de decir la venta, el contacto vuelve al buzón, y **no se puede deshacer** — `contactos.etapa`
   * no guarda historial.
   *
   * La prueba `97-closer-avanzar` ya lo tenía escrito como advertencia: *«`agendo` mandaría al
   * contacto a `agendado` y borraría el desenlace que ya tenía»*.
   *
   * Lo que sí se conserva de la fase A es el 400 **sin consulta** para basura —`42`, `null`,
   * `'constructor'`, la cadena vacía—, que es lo que evita que un cuerpo inventado abra una
   * transacción. */
  const salida = cuerpo?.salida;
  if (!esAlgunaSalida(salida)) return rechazo('peticion_invalida', MOTIVOS.salida_invalida);

  // ── LA NOTA ───────────────────────────────────────────────────────────────
  const notaCruda = typeof cuerpo?.nota === 'string' ? cuerpo.nota.trim() : '';
  if (notaCruda.length > TOPE_NOTA) return rechazo('peticion_invalida', MOTIVOS.nota_larga);
  const nota = notaCruda === '' ? null : notaCruda;

  // ── EL SEGUIMIENTO ────────────────────────────────────────────────────────
  //
  // Se maneja como un DÍA de punta a punta: `tareas.vence_el` es una columna `date`, y meter un
  // instante en el medio agrega una zona horaria que puede corrernos el día. Ver `volverEl` en
  // `lib/negocio/avanzar.ts`, donde está medido.
  let volverEl: string | null = null;
  if (typeof cuerpo?.volverEl === 'string' && cuerpo.volverEl.trim() !== '') {
    const dia = cuerpo.volverEl.trim().slice(0, 10);
    // La forma se valida con una expresión y no con `new Date(...)`: `new Date('2026-13-45')` no
    // lanza en todos los motores, y una fecha absurda que el controlador acepte se convierte en una
    // tarea que vence en un día que no existe.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      return rechazo('peticion_invalida', MOTIVOS.fecha_invalida);
    }
    // Y que sea un día REAL. `2026-02-31` pasa la expresión de arriba.
    const comprobar = new Date(`${dia}T12:00:00Z`);
    if (Number.isNaN(comprobar.getTime()) || comprobar.toISOString().slice(0, 10) !== dia) {
      return rechazo('peticion_invalida', MOTIVOS.fecha_invalida);
    }
    // Se compara DÍA contra DÍA, en texto: elegir «hoy» es legítimo, y comparar instantes haría
    // que «hoy» fuera pasado desde el mediodía.
    if (dia < new Date().toISOString().slice(0, 10)) {
      return rechazo('peticion_invalida', MOTIVOS.fecha_pasada);
    }
    volverEl = dia;
  }

  /* ── EL MODO, Y LAS TRES COSAS QUE HAY QUE RECHAZAR ────────────────────────
   *
   * El catálogo declara qué salidas tienen modos y cuáles son —hoy solo `seguimiento`—, así que la
   * validación no es una lista de casos escrita acá: se pregunta a la misma tabla que dibuja la
   * pantalla. Con dos listas, la que quede vieja ofrece un control que da 400.
   *
   *   1 · una salida CON modos que no manda ninguno. No hay valor por omisión posible: los dos
   *       modos hacen cosas disjuntas —uno escribe una tarea nuestra, el otro dispara una secuencia
   *       ajena— y elegir por quien registra sería decidir si a esa persona la persigue un robot.
   *   2 · un modo que esa salida no admite.
   *   3 · la combinación imposible, en sus dos direcciones. `manual` sin fecha no tiene día que
   *       poner en Mi Día; `automatico` CON fecha pide una fecha que nadie va a usar — y aceptarla
   *       en silencio sería exactamente la clase de «se guardó y no hizo nada» que este archivo
   *       persigue en las etiquetas.
   *
   * Y una salida SIN modos que mande uno también se rechaza, por el punto 2: `modosDe` devuelve
   * vacío y `modoDe` no encuentra nada. */
  // Todo esto vive ahora en `loQueDependeDelRol`, abajo: el catálogo de modos es del rol, y los dos
  // tienen una salida `seguimiento` con modos distintos.

  // ── PASO 1 · LA BASE, en una transacción ──────────────────────────────────
  const registrado = await conOrganizacion(contexto.orgEfectiva, async () => {
    // Que el contacto exista EN ESTA ORGANIZACIÓN. La clave foránea compuesta ya lo garantiza,
    // y se comprueba igual: sin esto el fallo llegaría como un error estructural que hay que
    // traducir, y `ADR-0704` prohíbe devolver el mensaje de la base. Un 404 dicho a tiempo es
    // más barato.
    const contacto = await datos()
      .selectFrom('contactos')
      .select(['id', 'ghl_contact_id', 'territorio'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!contacto) return { tipo: 'no_encontrado' as const };

    /* ══ FASE B · EL TERRITORIO DEL CONTACTO DECIDE EL VOCABULARIO ═══════════
     *
     * El rol con el que se registra es el TERRITORIO DEL CONTACTO, no el rol de quien registra: de
     * esa columna dependen las dos comisiones, que se calculan distinto, y quien administra puede
     * registrar sobre un contacto de cualquiera de los dos territorios.
     *
     * ── Y MURIÓ EL `?? 'closer'` QUE HABÍA ACÁ ──────────────────────────────
     *
     * Sobre un contacto congelado —sin ningún territorio— ese respaldo elegía un rol. Con un solo
     * catálogo eso era una etiqueta en una columna; con dos vocabularios **elige un negocio en
     * silencio**, y el síntoma sería el formulario del closer sobre un lead del setter, aceptado por
     * el servidor. Un contacto sin territorio no tiene con qué vocabulario registrarse, y eso se
     * dice. */
    const rol = contacto.territorio;
    if (rol === null) return { tipo: 'rechazo' as const, motivo: MOTIVOS.sin_territorio };

    /* LA GUARDA, y devuelve el par YA ESTRECHADO en vez de un booleano. Es lo que permite que
       `registrarResultado` reciba `{ rol, salida }` sin un casteo: el tipo del par es la unión
       discriminada, así que un `agendo` con rol `closer` no compila ni acá ni allá. */
    /* LA GUARDA, y vive en el catálogo porque es donde están las dos listas. Devuelve el par ya
       formado en vez de un booleano: así la única forma de llegar a la escritura es habiendo pasado
       por acá, y el par no se puede armar mal. */
    const par = parDeSalida(rol, salida);
    if (!par) return { tipo: 'rechazo' as const, motivo: MOTIVOS.salida_de_otro_territorio };

    const lo = loQueDependeDelRol(par, cuerpo, volverEl);
    if ('motivo' in lo) return { tipo: 'rechazo' as const, motivo: lo.motivo };

    const r = await registrarResultado(id, {
      // Anidado y no esparcido: ver el comentario de `LoQueSeRegistra`.
      que: par,
      detalle: lo.detalle,
      formaPago: lo.formaPago,
      monto: lo.monto,
      nota,
      volverEl,
      modo: lo.modo,
      quien: contexto.usuarioId,
    });
    return {
      tipo: 'listo' as const,
      ...r,
      ghlContactId: contacto.ghl_contact_id,
      rol,
      modo: lo.modo,
    };
  });

  if (registrado.tipo === 'no_encontrado') return rechazo('no_encontrado');
  if (registrado.tipo === 'rechazo') return rechazo('peticion_invalida', registrado.motivo);

  // ── PASO 2 · EL CRM, y su fallo NO invalida el paso 1 ─────────────────────
  const aviso = await avisarAlCrm(
    contexto.orgEfectiva,
    registrado.ghlContactId,
    registrado.rol,
    salida,
    registrado.modo,
  );

  return ok(
    {
      registrado: true,
      salida,
      etapa: registrado.etapa,
      nota: registrado.nota,
      tarea: registrado.tarea,
      // ── LO QUE PASÓ CON EL CRM, dicho aparte ──────────────────────────────
      //
      // No es un detalle de implementación: mientras el aviso no llegue, el CRM **no disparó sus
      // automatismos** —el flujo de recuperación de un no-show, por ejemplo— y quien registró
      // tiene que poder saberlo. Colapsarlo en el éxito general sería reportar un éxito a medias
      // como completo.
      crm: aviso,
    },
    201,
  );
}

/**
 * Todo lo que depende del CATÁLOGO del rol, validado de una vez.
 *
 * Vive acá y no arriba porque **el rol sale del contacto**, y el contacto se lee dentro de la
 * transacción. Es la fase B de la que habla el comentario de la fase A.
 *
 * Devuelve `{ motivo }` cuando algo no va — nunca lanza, y nunca escribe: quien la llama decide qué
 * hacer con el rechazo, y lo hace ANTES de tocar una sola fila.
 */
function loQueDependeDelRol(
  par: ParDeResultado,
  cuerpo: Record<string, unknown>,
  volverEl: string | null,
):
  | { detalle: string | null; formaPago: string | null; monto: string | null; modo: string | null }
  | { motivo: string } {
  const { rol, salida } = par;
  /* `definicionDe` no puede fallar acá —`parDelTerritorio` ya lo garantizó— y se comprueba igual:
     el día que alguien llame a esta función sin pasar por la guarda, la respuesta es un rechazo y no
     una excepción. */
  const def = definicionDe(rol, salida);
  if (!def) return { motivo: MOTIVOS.salida_de_otro_territorio };

  // ── EL MONTO, y su validación es del SERVIDOR ───────────────────────────
  //
  // La pantalla ya deshabilita el botón sin monto, y eso no alcanza: cualquiera puede llamar a esto
  // con una herramienta de línea de comandos. Una venta sin monto pasa como venta y después el
  // «cobrado» de Inicio suma uno menos de lo que debería, sin que nada falle.
  let monto: string | null = null;
  if (def.pideMonto) {
    const crudo = cuerpo?.monto;
    if (crudo === undefined || crudo === null || crudo === '') return { motivo: MOTIVOS.falta_monto };
    const n = Number(crudo);
    if (!Number.isFinite(n) || n < 0) return { motivo: MOTIVOS.monto_invalido };
    // Se guarda como TEXTO porque la columna es `numeric(12,2)`: pasarlo por un `double` es
    // exactamente cómo se pierden centavos.
    monto = n.toFixed(2);
  }

  // ── LA SUBCATEGORÍA ─────────────────────────────────────────────────────
  //
  // Se acepta solo si está en las opciones de ESTA salida DE ESTE ROL. Los dos catálogos tienen una
  // salida `seguimiento` con opciones distintas, así que validar contra el catálogo equivocado
  // aceptaría un valor que la pantalla del otro rol nunca ofreció.
  const detalleCrudo = typeof cuerpo?.detalle === 'string' ? cuerpo.detalle.trim() : '';
  const detalle = detalleCrudo !== '' && def.opciones.includes(detalleCrudo) ? detalleCrudo : null;

  /* La forma de pago es la subcategoría de una venta y tiene columna propia. Las DOS ventas la
     llevan —la del closer y la chica del setter—, y son la misma pregunta con otro vocabulario. */
  const formaPago = salida === 'venta' || salida === 'venta_chica' ? detalle : null;

  /* ── EL MODO, Y LAS TRES COSAS QUE HAY QUE RECHAZAR ──────────────────────
   *
   * El catálogo declara qué salidas tienen modos y cuáles son, así que la validación no es una lista
   * de casos escrita acá: se pregunta a la misma tabla que dibuja la pantalla. Con dos listas, la
   * que quede vieja ofrece un control que da 400.
   *
   *   1 · una salida CON modos que no manda ninguno. No hay valor por omisión posible: los modos
   *       hacen cosas disjuntas —uno escribe una tarea nuestra, los otros disparan una secuencia
   *       ajena— y elegir por quien registra sería decidir si a esa persona la persigue un robot.
   *   2 · un modo que esa salida no admite.
   *   3 · la combinación imposible, en sus dos direcciones. Un modo manual sin fecha no tiene día
   *       que poner en Mi Día; uno de serie CON fecha pide una fecha que nadie va a usar — y
   *       aceptarla en silencio sería la clase de «se guardó y no hizo nada» que este archivo
   *       persigue en las etiquetas.
   *
   * Y una salida SIN modos que mande uno también se rechaza, por el punto 2. */
  const modos = modosDe(rol, salida);
  let modo: string | null = null;
  if (modos.length > 0) {
    if (typeof cuerpo?.modo !== 'string' || cuerpo.modo.trim() === '') {
      return { motivo: MOTIVOS.falta_modo };
    }
    const elegido = modoDe(rol, salida, cuerpo.modo.trim());
    if (!elegido) return { motivo: MOTIVOS.modo_invalido };
    if (elegido.exigeFecha && volverEl === null) return { motivo: MOTIVOS.modo_sin_fecha };
    if (!elegido.exigeFecha && volverEl !== null) return { motivo: MOTIVOS.modo_con_fecha };
    modo = elegido.modo;
  } else if (typeof cuerpo?.modo === 'string' && cuerpo.modo.trim() !== '') {
    return { motivo: MOTIVOS.modo_invalido };
  }

  return { detalle, formaPago, monto, modo };
}

/**
 * Qué etiquetas manda cada territorio. **Dos funciones, no una con un parámetro.**
 *
 * La diferencia es de negocio y no de valor: la del closer agrega `bot_desactivado_postcall` en seis
 * de sus siete salidas, y la del setter **no lo nombra nunca**, porque ninguna de sus cinco prueba
 * que hubo una llamada. Un `if` por rol adentro de una sola función dejaría dos reglas trenzadas
 * donde ninguna se lee.
 */
const ETIQUETAS_POR_ROL: Readonly<
  Record<Territorio, (salida: string, etiquetaDelModo?: string) => readonly string[]>
> = {
  closer: etiquetasDelResultado,
  setter: etiquetasDelResultadoDelSetter,
};

/**
 * ¿Esta salida no avisa a nadie **a propósito**?
 *
 * El closer no tiene ninguna así —sus siete declaran etiqueta— y por eso su entrada es la constante
 * `false`. Escribirla igual es lo que hace que el registro sea exhaustivo por tipo: el día que una
 * salida del closer deje de avisar, hay que decidirlo acá y no descubrirlo en la pantalla.
 */
const NO_AVISA_A_PROPOSITO: Readonly<Record<Territorio, (salida: string) => boolean>> = {
  closer: () => false,
  setter: noAvisaAPropositoDelSetter,
};

interface AvisoAlCrm {
  /** `true` = las etiquetas se escribieron. */
  avisado: boolean;
  /** Qué etiquetas se mandaron de verdad. */
  etiquetas: string[];
  /** Por qué no, cuando no. `null` cuando salió bien. */
  porque: string | null;
}

/**
 * Le avisa al CRM. **Nunca lanza**: su fallo no puede tirar abajo un resultado ya registrado.
 */
async function avisarAlCrm(
  orgId: string,
  ghlContactId: string | null,
  rol: Territorio,
  salida: string,
  modo: string | null,
): Promise<AvisoAlCrm> {
  if (!ghlContactId) {
    return {
      avisado: false,
      etiquetas: [],
      porque:
        'Este contacto no tiene identificador de GoHighLevel, así que no hay a quién avisarle. ' +
        'El resultado quedó registrado acá.',
    };
  }

  /* Las etiquetas las decide `etiquetasDelResultado`, que es pura y vive en el contrato. Estaba
     acá dentro, y acá no se puede probar: esta función resuelve credenciales primero, así que en una
     base sin token devuelve la lista vacía antes de llegar a decidir nada. */
  /* Un REGISTRO y no un `rol === 'closer' ? … : …`, por dos motivos que van juntos: `ADR-0302`
     prohíbe comparar contra un nombre de rol en esta carpeta, y un `Record<Territorio, …>` **no
     compila** si mañana aparece un tercer territorio sin su función. La exhaustividad la da el tipo
     en vez de que alguien se acuerde de agregar una rama. */
  const etiquetaDelModo = modo !== null ? modoDe(rol, salida, modo)?.etiqueta : undefined;
  const mandables = ETIQUETAS_POR_ROL[rol](salida, etiquetaDelModo);

  /* ── EL TERCER ESTADO: «no avisa a propósito» ────────────────────────────
   *
   * Dos salidas del setter no mandan nada porque **no existe ninguna etiqueta que signifique eso**
   * —agendar lo resuelve el CRM con la cita real, y «vendió el producto chico» no tiene etiqueta—.
   * Sin este caso, las dos se reportaban con el texto de abajo, que dice que las etiquetas están
   * *sin confirmar*: eso es falso, y manda a alguien a buscar en la subcuenta una etiqueta que nadie
   * tiene que crear. */
  if (mandables.length === 0 && NO_AVISA_A_PROPOSITO[rol](salida)) {
    return {
      avisado: false,
      etiquetas: [],
      porque:
        'Esta salida no le avisa nada al CRM, y es deliberado: no hay ninguna etiqueta que ' +
        'signifique esto. El resultado quedó registrado acá, que es donde sirve.',
    };
  }

  if (mandables.length === 0) {
    return {
      avisado: false,
      etiquetas: [],
      porque:
        'Ninguna de las etiquetas de esta salida está confirmada en la subcuenta, así que no se ' +
        'mandó nada: escribir una etiqueta que no existe se responde con éxito y no hace nada. ' +
        'El resultado quedó registrado acá.',
    };
  }

  const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, orgId));
  if (acceso.tipo === 'falta') {
    return { avisado: false, etiquetas: [], porque: TEXTO_DE_FALTA_GHL[acceso.que] };
  }

  /* Se copia porque `ponerEtiquetas` pide un arreglo mutable y `etiquetasDelResultado` devuelve
     uno de solo lectura — que es lo correcto: nadie debería poder agregarle una etiqueta después
     de que pasó por el filtro de lo que se puede mandar. */
  const r = await ponerEtiquetas({ token: acceso.token }, ghlContactId, [...mandables]);
  if (r.tipo === 'fallo') {
    const f = r.fallo;
    const porque =
      f.tipo === 'no_autorizado'
        ? 'GoHighLevel rechazó el token, así que no se pudo avisar.'
        : f.tipo === 'demasiadas_peticiones'
          ? 'GoHighLevel está limitando las peticiones. El resultado quedó registrado acá.'
          : f.tipo === 'sin_respuesta'
            ? 'No se pudo contactar a GoHighLevel. El resultado quedó registrado acá.'
            : `GoHighLevel respondió ${f.estado}. El resultado quedó registrado acá.`;
    return { avisado: false, etiquetas: [], porque };
  }

  // Copia, por lo mismo que arriba: la lista que sale del filtro es de solo lectura, y esta
  // respuesta viaja al cliente como JSON mutable.
  return { avisado: true, etiquetas: [...mandables], porque: null };
}
