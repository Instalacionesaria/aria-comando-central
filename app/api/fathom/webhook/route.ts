// `POST /api/fathom/webhook` — por donde Fathom avisa que una grabación terminó de procesarse.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE (la 116 y `lib/fathom/guardar.ts` tienen el porqué entero)
//
// Fathom manda UN envío por grabación, con la reunión completa y la transcripción. Esta ruta comprueba que lo mandó
// Fathom, y `guardarReunionDeFathom` decide: si el título empieza con «HT» es una llamada de venta, busca al lead en la
// subcuenta de ARIA y, si lo encuentra, guarda la llamada y su transcripción como datos de ese lead. Todo lo demás queda
// sólo en `negocio.recepciones_de_fathom`, con su estado y su motivo. Es independiente de tl;dv, que sigue igual.
//
// El webhook lo crea en Fathom un admin del plan Team con `triggered_for: shared_team_recordings` e
// `include_transcript: true`, hacia `https://app.ariaia.com/api/fathom/webhook`. Su secreto `whsec_…` va en
// `FATHOM_SECRETO_WEBHOOK` (varios, separados por coma, para rotarlo).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN, DE LO MÁS BARATO A LO MÁS CARO
//
//   1. Sin secreto configurado, sin las tres cabeceras o con el timestamp a más de 5 minutos → 403, sin leer el cuerpo.
//   2. El cuerpo, acotado a 4 MiB (el tope por omisión de 64 KiB rechazaría cualquier llamada de más de veinte
//      minutos; Vercel corta en 4,5 MB igual).
//   3. La firma, con `timingSafeEqual` y el largo comparado antes → 403 sin tocar la base. El agrupador de identidad es
//      de cinco conexiones y lo comparte el login de todos: nada sin firma llega a él.
//   4. Lo ilegible (JSON roto, sin `recording_id`) → 200 con `recibido: false`. Firmado por Fathom y roto se repetiría
//      igual en cada reintento.
//   5. Identidad (sólo lectura) y después negocio (la escritura).
//
// Fathom no deja agregar cabeceras propias, así que no hay «pimienta» como en el aviso del CRM: la firma es el portón.
// Todos los rechazos de autenticación son el mismo `sin_permiso`, y el motivo va sólo al registro.
//
// ═══════════════════════════════════════════════════════════════════════════════
// 200 SIEMPRE, SALVO QUE NUESTRA BASE NO ESTÉ
//
// Fathom reintenta todo lo que no sea 2xx y no dice cuántas veces; un endpoint que falla seguido puede quedar
// desactivado, y ahí se pierden todas las llamadas que vengan. Así que: `sin_lead`, `no_es_venta` y los demás estados
// son 200. Un error de los DATOS se registra como `error` en otra transacción y también es 200 (si Fathom reintenta, se
// reprocesa). Sólo una falla de conexión de nuestra base es 503, para que el reintento la traiga cuando vuelva.
// ═══════════════════════════════════════════════════════════════════════════════

import { timingSafeEqual } from 'node:crypto';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { leerCuerpoAcotado } from '../../../../lib/http/cuerpoAcotado.ts';
import type { FathomMeeting } from '../../../../lib/analizadores/nucleo/fathom.ts';
import {
  firmaEsperadaDeFathom,
  firmasDeLaCabecera,
  secretosDeFathom,
  timestampVigente,
} from '../../../../lib/fathom/firma.ts';
import {
  esFallaDeLaBase,
  guardarReunionDeFathom,
  idDeLaGrabacion,
  registrarErrorDeFathom,
  type EntradaDeFathom,
  type MiembroDelEquipo,
} from '../../../../lib/fathom/guardar.ts';
import { porOmisionDe } from '../../../../lib/negocio/ambitoDelCliente.ts';

/**
 * `maxDuration` declarado en la ruta (la 99 prohíbe `functions` en `vercel.json`) y bajo: es una ruta pública, y una
 * pública con 300 s multiplica el agotamiento. Treinta alcanzan para leer hasta 4 MiB, dos consultas a identidad y
 * una transacción de negocio con tres inserciones.
 */
export const maxDuration = 30;

/** El tope del cuerpo: una llamada de cuatro horas con transcripción ronda 1 MB. */
const TOPE_DEL_CUERPO_DE_FATHOM = 4 * 1024 * 1024;

/**
 * Comparación en tiempo constante, con el largo mirado antes porque `timingSafeEqual` LANZA con largos distintos (el
 * ejemplo oficial de Fathom no lo mira, y una cabecera basura tiraría la ruta). Se escribe acá y no se importa porque
 * `pruebas/codigo/30-portero.test.ts` exige la llamada literal en cada ruta con secreto propio.
 */
function coincide(dada: Buffer, esperada: Buffer): boolean {
  if (dada.length !== esperada.length) return false;
  return timingSafeEqual(dada, esperada);
}

export async function POST(peticion: Request): Promise<Response> {
  // ── 1 · El secreto y las cabeceras, sin leer el cuerpo ──
  const secretos = secretosDeFathom();
  if (secretos.length === 0) {
    console.error('fathom/webhook: FATHOM_SECRETO_WEBHOOK no está definido (o ninguno empieza con whsec_): se rechaza todo.');
    return rechazo('sin_permiso');
  }
  const id = peticion.headers.get('webhook-id') ?? '';
  const timestamp = peticion.headers.get('webhook-timestamp') ?? '';
  const firma = peticion.headers.get('webhook-signature') ?? '';
  if (!id || !timestamp || !firma) {
    console.warn('fathom/webhook: faltan cabeceras de la firma.');
    return rechazo('sin_permiso');
  }
  if (!timestampVigente(timestamp)) {
    console.warn('fathom/webhook: el timestamp de la firma está fuera de los 5 minutos.');
    return rechazo('sin_permiso');
  }

  // ── 2 · El cuerpo, acotado ──
  const leido = await leerCuerpoAcotado(peticion, TOPE_DEL_CUERPO_DE_FATHOM);
  if (!leido.ok) {
    if (leido.porque === 'demasiado_grande') {
      console.warn('fathom/webhook: cuerpo sobre el tope.');
      return rechazo('cuerpo_demasiado_grande');
    }
    console.warn('fathom/webhook: llegó sin cuerpo.');
    return rechazo('sin_permiso');
  }
  const cuerpo = leido.texto;

  // ── 3 · La firma, antes de tocar la base ──
  const dadas = firmasDeLaCabecera(firma);
  const valida = secretos.some((s) => {
    const esperada = firmaEsperadaDeFathom(s, id, timestamp, cuerpo);
    return dadas.some((d) => coincide(d, esperada));
  });
  if (!valida) {
    console.warn('fathom/webhook: firma inválida.');
    return rechazo('sin_permiso');
  }

  // ── 4 · Lo ilegible no se reintenta ──
  let reunion: FathomMeeting;
  try {
    const dato: unknown = JSON.parse(cuerpo);
    if (typeof dato !== 'object' || dato === null || Array.isArray(dato)) throw new Error('no es un objeto');
    reunion = dato as FathomMeeting;
  } catch {
    console.warn('fathom/webhook: firmado pero no es JSON de una reunión.');
    return ok({ recibido: false, porque: 'ilegible' });
  }
  if (!idDeLaGrabacion(reunion)) {
    console.warn('fathom/webhook: firmado pero sin recording_id válido.');
    return ok({ recibido: false, porque: 'ilegible' });
  }

  // ── 5 · Identidad (sólo lectura) y negocio (la escritura) ──
  //
  // Dos dominios, dos transacciones. La primera sólo LEE (la organización principal y los correos del equipo), así que
  // si la segunda falla no queda nada a medias: identidad no se tocó, y la recepción, la llamada y la transcripción van
  // juntas en la segunda o no va ninguna. Si la segunda falla por los datos, una TERCERA transacción deja la recepción
  // en `error` para que se vea.
  let entrada: EntradaDeFathom;
  try {
    const { orgId, equipo } = await conIdentidad(async (db) => {
      const principal = await db
        .selectFrom('organizaciones')
        .select('id')
        .where('es_principal', '=', true)
        .executeTakeFirst();
      if (!principal) throw new Error('fathom/webhook: no hay organización principal');
      const usuarios = await db
        .selectFrom('usuarios')
        .select(['id', 'email'])
        .where('org_id', '=', principal.id)
        .where('email', 'is not', null)
        .execute();
      const miembros: MiembroDelEquipo[] = usuarios.flatMap((u) => (u.email ? [{ id: u.id, email: u.email }] : []));
      return { orgId: principal.id, equipo: miembros };
    });
    const ambito = await porOmisionDe(orgId);
    entrada = { cuentaId: ambito.cuentas[0], reunion, webhookId: id, equipo };

    try {
      const r = await conOrganizacion(ambito, () => guardarReunionDeFathom(entrada));
      return ok({ recibido: true, estado: r.estado, ya_estaba: r.yaEstaba });
    } catch (e) {
      if (esFallaDeLaBase(e)) throw e;
      const mensaje = e instanceof Error ? e.message : String(e);
      console.error(`fathom/webhook: la grabación ${String(reunion.recording_id)} falló al guardarse: ${mensaje}`);
      await conOrganizacion(ambito, () => registrarErrorDeFathom(entrada, mensaje));
      return ok({ recibido: true, estado: 'error' });
    }
  } catch (e) {
    if (esFallaDeLaBase(e)) {
      console.error('fathom/webhook: la base no responde; Fathom va a reintentar.');
      return rechazo('base_no_disponible');
    }
    // Sin organización principal o sin su cuenta por omisión: es configuración nuestra, y reintentar no la arregla.
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error(`fathom/webhook: no se pudo procesar la grabación ${String(reunion.recording_id)}: ${mensaje}`);
    return ok({ recibido: false, porque: 'configuracion' });
  }
}
