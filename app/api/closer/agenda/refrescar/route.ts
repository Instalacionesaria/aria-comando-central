// Traer las citas del calendario de GoHighLevel.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ÚNICO CAMINO MANUAL, Y CUESTA DIEZ LLAMADAS — NO UNA
//
// El documento de la Agenda dice que el botón *"cuesta exactamente una llamada"*. **Medido contra la
// subcuenta real, cuesta diez**, y la diferencia no es un descuido: es que
// `GET /calendars/events` **exige** `calendarId`. Sin él responde 422 —*"Either of userId, calendarId
// or groupId is required"*— así que no hay forma de pedir «los eventos de la subcuenta».
//
//   1 llamada para listar los calendarios  +  1 por cada uno  =  10 con los nueve de hoy
//
// Se escribe acá y no se esconde porque el número es la mitad del argumento: lo que hace sostenible
// esta pantalla no es que el barrido sea barato, es que **ocurre por acción explícita de una persona
// y no en cada carga**. El documento cuenta de dónde se venía: *"cientos de llamadas por hora para
// mostrar una lista que casi nunca cambia"*.
//
// Y la cota tiene la forma correcta: **no crece con la cantidad de citas.** Diez llamadas traen las
// 132 de la ventana o las diez mil que haya. Crece con la cantidad de calendarios, y eso se puede ver
// en la respuesta.
//
// ── POR QUÉ ES `POST` Y NO UN PARÁMETRO DEL `GET` ──────────────────────────
//
// El documento lo modela como el mismo endpoint «forzando lectura al CRM». Acá se separa: esto
// ESCRIBE en `negocio.citas`, y una lectura que escribe es lo que hace que abrir tres pestañas
// dispare tres barridos. La forma de la respuesta de la Agenda no cambia por eso — sigue siendo la
// misma para los tres consumidores.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import { barrerCitas } from '../../../../../lib/negocio/citas.ts';

// ── NO CRUZA LOS DOS DOMINIOS ──────────────────────────────────────────────
//
// Acá se lee la credencial —identidad, **solo lectura**— y la escritura de citas vive entera en
// `lib/negocio/citas.ts`, que abre `conOrganizacion(` para cada alta. La pregunta obligatoria es qué
// queda a medias si la segunda mitad falla: **nada**, porque la primera no escribe.
//
// Y si falla la segunda a la mitad, tampoco: el alta es `on conflict` idempotente y el barrido no
// lleva marca de agua —trae la ventana entera cada vez—, así que el intento siguiente no depende de
// dónde se cortó el anterior.

/** A qué pantalla pertenece. Misma pantalla y mismo conjunto que el `GET` de al lado. */
export const PANTALLA = 'closer';

/** Diez llamadas contra un servicio ajeno. El valor por omisión de la plataforma corta antes. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver']);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, contexto.orgEfectiva));
  if (acceso.tipo === 'falta') {
    return rechazo('credenciales_incompletas', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  let r;
  try {
    r = await barrerCitas(contexto.orgEfectiva, {
      token: acceso.token,
      locationId: acceso.locationId,
    });
  } catch (e) {
    // `conElPulso` ya dejó anotado el fallo antes de relanzar. Acá solo se traduce: `ADR-0704`
    // prohíbe devolver el mensaje de la base, y quien aprieta el botón no puede hacer nada con él.
    console.error('barrido de citas:', e);
    return rechazo(
      'servicio_externo_no_disponible',
      'No se pudo leer el calendario de GoHighLevel. Quedó anotado y se puede reintentar.',
    );
  }

  if (!r.corrio) {
    // 200 con `corrio: false`. Alguien barrió hace segundos y el candado lo dice: no es un error, y
    // un 4xx acá mandaría a revisar algo que está funcionando.
    return ok({ corrio: false, porque: r.porque });
  }

  // El resumen COMPLETO, incluido lo que NO se guardó. Un `{ok:true}` acá sería un éxito reportado
  // sin verificar: un barrido que vio 132 citas y guardó 3 porque las otras 129 son de contactos que
  // no tenemos se vería igual que uno completo.
  return ok({ corrio: true, ...r.resultado });
}
