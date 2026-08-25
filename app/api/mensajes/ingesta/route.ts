// Un ciclo de ingesta de mensajes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ENDPOINT PUEDE CONTESTAR, Y LOS TRES CASOS SON DISTINTOS
//
//   `corrio: true`  → hizo el ciclo, y dice cuánto costó.
//   `corrio: false` → **no le tocaba**, y también es 200. Otro ciclo está en curso o hubo uno
//                     hace menos de ocho segundos. No es un error: es el candado funcionando.
//   un rechazo      → falta la credencial, o el proveedor dijo que no.
//
// Que el segundo caso sea 200 y no un 4xx importa: lo pide un reloj, no una persona. Un 409 cada
// pocos segundos ensuciaría el registro con algo que es el comportamiento correcto —y el proyecto
// ya tiene ese defecto en otro lado, con `/api/fundaciones/estado` devolviendo 409 cuatro veces por
// carga de página.
//
// ── EL COSTE VIAJA EN LA RESPUESTA, Y NO ES UN ADORNO ───────────────────────
//
// Sin `llamadas`, «cuesta una llamada por ciclo» es una intención. Con él es una medición que se
// puede mirar en producción sin instrumentar nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../lib/credenciales/resolver.ts';
import { ingerirMensajes } from '../../../../lib/negocio/ingesta.ts';

// ── NO CRUZA LOS DOS DOMINIOS, Y ESO NO ES UN ACCIDENTE ────────────────────
//
// Acá se lee la credencial —dominio de identidad, **solo lectura**— y la escritura de mensajes
// vive entera en `lib/negocio/ingesta.ts`, que abre `conOrganizacion(` para cada una de sus
// transacciones cortas. Entre dominios no hay atomicidad, así que la pregunta obligatoria es qué
// queda a medias si la segunda mitad falla: **nada**, porque la primera no escribe.
//
// Y si falla la segunda a la mitad, tampoco queda nada raro: el alta de mensajes es idempotente
// y la marca de agua **solo avanza sobre conversaciones terminadas**, así que el ciclo siguiente
// retoma exactamente donde se cortó.

/** Un ciclo hace hasta trece llamadas contra un servicio ajeno. El valor por omisión corta antes. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  // ── `contactos.ver`, LA MISMA QUE LAS CINCO PESTAÑAS ──────────────────────
  //
  // No se inventa una capacidad nueva: el catálogo tiene `contactos.ver` para leer la ficha y
  // `conversaciones.responder` para escribir, y esto es lo que hace que la ficha tenga qué leer.
  // La tienen el closer y el setter, que son quienes miran el chat.
  //
  // Pedir `conversaciones.responder` sería más estricto y estaría MAL: quien solo puede mirar
  // vería un chat que no se actualiza nunca, sin ningún error — el modo de falla del `07` § 2.
  const contexto = await exigir(peticion, ['contactos.ver']);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, contexto.orgEfectiva));
  if (acceso.tipo === 'falta') {
    return rechazo('credenciales_incompletas', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  let r;
  try {
    r = await ingerirMensajes(contexto.orgEfectiva, {
      token: acceso.token,
      locationId: acceso.locationId,
    });
  } catch (e) {
    // `conElPulso` ya dejó anotado el fallo en la fila del pulso antes de relanzar. Acá solo se
    // traduce: quien pregunta no puede hacer nada con el detalle, y `ADR-0704` prohíbe devolverlo.
    console.error('ingesta de mensajes:', e);
    return rechazo(
      'servicio_externo_no_disponible',
      'No se pudo completar la ingesta de mensajes. Quedó anotado y se reintenta en el próximo ciclo.',
    );
  }

  if (!r.corrio) {
    // 200 con `corrio: false`. Ver arriba.
    return ok({ corrio: false, porque: r.porque });
  }

  return ok({
    corrio: true,
    llamadas: r.llamadas,
    // El resumen entero, incluido `atrasado`. Un `{ok:true}` acá sería un éxito reportado sin
    // verificar: un ciclo que agotó un tope y dejó trabajo sin hacer se ve igual que uno completo.
    ...r.resultado,
  });
}
