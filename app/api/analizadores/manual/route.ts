// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Analizar una transcripción pegada a mano: se guarda como una llamada y se analiza por el MISMO
// camino que las de tl;dv (`analizarLlamada`), así que el candado, el veto y la guardia de reloj son
// los mismos.
//
// ── LOS TRES CAMPOS SON OBLIGATORIOS, COMO EN EL ORIGEN ──────────────────────
//
// El correo es lo que identifica al prospecto entre llamadas —de ahí sale «reunión N de M»— y el
// nombre da título a la llamada. Sin correo, cada manual crearía un prospecto suelto.
//
// ── Y UNA TRANSCRIPCIÓN DEMASIADO LARGA SE RECHAZA, NO SE CORTA ──────────────
//
// El origen la recortaba en silencio a 200.000 caracteres. El final de una llamada de venta es donde
// está el cierre: recortarlo produce un informe que juzga una llamada que no terminó, y nada lo dice.
//
// Mismo patrón que `llamadas/[id]/analizar/`: `conIdentidad(` solo para la llave, el trabajo en `lib/`.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverLlaveDeIa } from '../../../../lib/credenciales/resolver.ts';
import {
  TIPOS_QUE_SE_ANALIZAN,
  TOPE_DE_LA_TRANSCRIPCION,
  analizarLlamada,
  crearManual,
  relojDe,
} from '../../../../lib/analizadores/pipeline.ts';
import {
  CORREO,
  TIEMPO_DE_LA_RUTA_MS,
  TOPES_DE_LA_MANUAL,
  pestanaDe,
  respuestaDelRechazo,
} from '../../../../lib/analizadores/rutas.ts';

export const PANTALLA = 'analizadores';

export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const reloj = relojDe(TIEMPO_DE_LA_RUTA_MS);
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: { tipo?: unknown; nombre?: unknown; email?: unknown; transcripcion?: unknown };
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const tipo = pestanaDe(typeof cuerpo?.tipo === 'string' ? cuerpo.tipo : null);
  const nombre = typeof cuerpo?.nombre === 'string' ? cuerpo.nombre.trim() : '';
  const email = typeof cuerpo?.email === 'string' ? cuerpo.email.trim() : '';
  const transcripcion = typeof cuerpo?.transcripcion === 'string' ? cuerpo.transcripcion : '';

  if (tipo === null) return rechazo('peticion_invalida', 'El tipo tiene que ser HT u OB.');
  /* Antes de pedir la llave y antes de guardar nada: un tipo con el análisis apagado no se guarda a
     medias para quedar esperando. Se rechaza entera y el texto dice por qué. Fue OB durante la fase HT. */
  if (!TIPOS_QUE_SE_ANALIZAN.includes(tipo)) return respuestaDelRechazo('analizador_no_disponible');
  if (!nombre) return rechazo('peticion_invalida', 'Falta el nombre del contacto.');
  if (nombre.length > TOPES_DE_LA_MANUAL.nombre) {
    return rechazo('peticion_invalida', `El nombre no puede pasar de ${TOPES_DE_LA_MANUAL.nombre} caracteres.`);
  }
  if (email.length > TOPES_DE_LA_MANUAL.email || !CORREO.test(email)) {
    return rechazo('peticion_invalida', 'Falta un correo válido del contacto.');
  }
  if (!transcripcion.trim()) return rechazo('peticion_invalida', 'La transcripción está vacía.');
  if (transcripcion.length > TOPE_DE_LA_TRANSCRIPCION) {
    return rechazo(
      'peticion_invalida',
      `La transcripción tiene ${transcripcion.length} caracteres y el tope es ${TOPE_DE_LA_TRANSCRIPCION}.`,
    );
  }

  // La llave ANTES de guardar: sin ella no queda una llamada PENDING que nadie puede analizar.
  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  const id = await crearManual(contexto.orgEfectiva, { tipo, nombre, email, transcripcion });
  const r = await analizarLlamada(contexto.orgEfectiva, id, llave.claveIa, reloj);
  if (r.tipo === 'rechazo') return respuestaDelRechazo(r.que);
  return ok({ id, ...r });
}
