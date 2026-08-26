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
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import {
  BOT_DESACTIVADO_POSTCALL,
  RESULTADOS,
  sePuedeMandar,
} from '../../../../../lib/ghl/contrato.ts';
import { ponerEtiquetas } from '../../../../../lib/ghl/cliente.ts';
import { registrarResultado } from '../../../../../lib/negocio/avanzar.ts';
import { definicionDe, esSalidaDelCloser } from '../../../../../lib/negocio/salidas.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El tope de la nota. Igual que el de la pestaña Notas: es la misma tabla. */
const TOPE_NOTA = 4000;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  salida_invalida: 'Esa no es una de las seis salidas de Avanzar.',
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

  // ── LA SALIDA ─────────────────────────────────────────────────────────────
  const salida = cuerpo?.salida;
  if (!esSalidaDelCloser(salida)) return rechazo('peticion_invalida', MOTIVOS.salida_invalida);
  const def = definicionDe(salida);
  if (!def) return rechazo('peticion_invalida', MOTIVOS.salida_invalida);

  // ── EL MONTO, y su validación es del SERVIDOR ─────────────────────────────
  //
  // La pantalla ya deshabilita el botón sin monto, y eso no alcanza: cualquiera puede llamar a
  // esto con una herramienta de línea de comandos. Una venta sin monto pasa como venta y después
  // el «cobrado» de Inicio suma uno menos de lo que debería, sin que nada falle.
  let monto: string | null = null;
  if (def.pideMonto) {
    const crudo = cuerpo?.monto;
    if (crudo === undefined || crudo === null || crudo === '') {
      return rechazo('peticion_invalida', MOTIVOS.falta_monto);
    }
    const n = Number(crudo);
    if (!Number.isFinite(n) || n < 0) return rechazo('peticion_invalida', MOTIVOS.monto_invalido);
    // Se guarda como TEXTO porque la columna es `numeric(12,2)`: pasarlo por un `double` es
    // exactamente cómo se pierden centavos.
    monto = n.toFixed(2);
  }

  // ── LA SUBCATEGORÍA ───────────────────────────────────────────────────────
  //
  // Se acepta solo si está en las opciones de ESTA salida. Un valor libre entraría a la píldora
  // de un contacto real, y `pildora.ts` la muestra tal cual viene.
  const detalleCrudo = typeof cuerpo?.detalle === 'string' ? cuerpo.detalle.trim() : '';
  const opciones: readonly string[] = def.opciones;
  const detalle = detalleCrudo !== '' && opciones.includes(detalleCrudo) ? detalleCrudo : null;

  // La forma de pago es la subcategoría de la venta y tiene columna propia. Ver `pildora.ts`.
  const formaPago = salida === 'venta' ? detalle : null;

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
    if (!contacto) return null;

    const r = await registrarResultado(id, {
      salida,
      // El rol con el que se registra es el TERRITORIO del contacto, no el rol de quien lo
      // registra. De esta columna dependen las dos comisiones, que se calculan distinto, y quien
      // administra puede registrar sobre un contacto de cualquiera de los dos territorios.
      rol: contacto.territorio ?? 'closer',
      detalle,
      formaPago,
      monto,
      nota,
      volverEl,
      quien: contexto.usuarioId,
    });
    return { ...r, ghlContactId: contacto.ghl_contact_id };
  });

  if (!registrado) return rechazo('no_encontrado');

  // ── PASO 2 · EL CRM, y su fallo NO invalida el paso 1 ─────────────────────
  const aviso = await avisarAlCrm(contexto.orgEfectiva, registrado.ghlContactId, salida);

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
  salida: string,
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

  const def = RESULTADOS.find((r) => r.salida === salida);
  if (!def) {
    return { avisado: false, etiquetas: [], porque: 'Esa salida no tiene etiqueta en el contrato.' };
  }

  // ── QUÉ ETIQUETAS SE MANDAN ───────────────────────────────────────────────
  //
  // La del resultado, y la que apaga el bot. **El No-show es la única salida que deja el bot
  // vivo**, porque dispara un flujo de recuperación que necesita al agente trabajando — y
  // apagárselo ahí sería romper justo el caso que más lo necesita.
  const candidatas = def.apagaElBot ? [def.etiqueta, BOT_DESACTIVADO_POSTCALL] : [def.etiqueta];

  // EL GUARDIÁN. Ver el encabezado: una etiqueta que no existe se acepta con un 200 y no hace
  // nada, así que se filtra ANTES de mandarla.
  const mandables = candidatas.filter((e) => sePuedeMandar(e));
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

  const r = await ponerEtiquetas({ token: acceso.token }, ghlContactId, mandables);
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

  return { avisado: true, etiquetas: mandables, porque: null };
}
