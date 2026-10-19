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
// Y eso POR CLIENTE activo (el nivel 3, G4): cada uno tiene su subcuenta y sus calendarios.
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
import { clientesQueTrae } from '../../../../../lib/autorizacion/ambito.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../../../../../lib/credenciales/resolver.ts';
import { barrerCitas } from '../../../../../lib/negocio/citas.ts';
import {
  desenlaceDeLaTraida,
  PRESUPUESTO_DE_LA_TRAIDA_MS,
  sumarBarridos,
  traerDeCadaCliente,
  type ClienteConAcceso,
} from '../../../../../lib/negocio/traerDeLosClientes.ts';

// ── NO CRUZA LOS DOS DOMINIOS ──────────────────────────────────────────────
//
// Acá se leen las credenciales de cada cliente —identidad, **solo lectura**— y la escritura de citas
// vive entera en `lib/negocio/citas.ts`, que abre `conOrganizacion(` para cada alta, en el ámbito de
// SU cliente. La pregunta obligatoria es qué queda a medias si la segunda mitad falla: **nada**,
// porque la primera no escribe.
//
// Y si falla la segunda a la mitad, tampoco: el alta es `on conflict` idempotente y el barrido no
// lleva marca de agua —trae la ventana entera cada vez—, así que el intento siguiente no depende de
// dónde se cortó el anterior. Con varios clientes, lo del que ya se barrió queda: la respuesta lo dice
// cliente por cliente.

/** A qué pantalla pertenece. Misma pantalla y mismo conjunto que el `GET` de al lado. */
export const PANTALLA = 'closer';

/**
 * Diez llamadas contra un servicio ajeno, por cliente. El valor por omisión de la plataforma corta antes, y con varios
 * clientes no se empieza otro pasado `PRESUPUESTO_DE_LA_TRAIDA_MS`.
 */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* Los clientes que la Agenda lee —la empresa entera: el Closer no se enfoca—, cada uno con las credenciales de SU
     subcuenta (el principal, las de la empresa). Por identidad y SOLO LECTURA, como antes. Traer sólo al principal
     dejaba a los demás sin leer, y el aviso de la agenda, que mira el peor cliente activo, prendido para siempre. */
  const clientes = await conIdentidad(async (db) => {
    const salida: ClienteConAcceso[] = [];
    for (const c of clientesQueTrae(contexto, PANTALLA)) {
      salida.push({ ...c, acceso: await resolverAccesoAGhl(db, contexto.orgEfectiva, c) });
    }
    return salida;
  });

  const renglones = await traerDeCadaCliente(
    contexto.orgEfectiva,
    clientes,
    async (ambito, acceso) => {
      const r = await barrerCitas(ambito, acceso);
      /* `corrio: false` es que alguien barrió ese cliente hace segundos y el candado lo dice: no es un error, y un 4xx
         acá mandaría a revisar algo que está funcionando. */
      return r.corrio ? { estado: 'corrio', resultado: r.resultado, llamadas: r.llamadas } : { estado: 'frenada', porque: r.porque };
    },
    {
      presupuestoMs: PRESUPUESTO_DE_LA_TRAIDA_MS,
      pulso: 'citas',
      /* `conElPulso` ya dejó anotado el fallo antes de relanzar. Acá solo se traduce: `ADR-0704` prohíbe devolver el
         mensaje de la base, y quien aprieta el botón no puede hacer nada con él. */
      siLanza: {
        codigo: 'servicio_externo_no_disponible',
        porque: 'No se pudo leer el calendario de GoHighLevel. Quedó anotado y se puede reintentar.',
      },
    },
  );

  // El resumen COMPLETO, incluido lo que NO se guardó. Un `{ok:true}` acá sería un éxito reportado
  // sin verificar: un barrido que vio 132 citas y guardó 3 porque las otras 129 son de contactos que
  // no tenemos se vería igual que uno completo. Con varios clientes, sumado, y `clientes` dice cuál.
  const d = desenlaceDeLaTraida(renglones, {
    deUno: (r) => ({ corrio: true, ...r }),
    deVarios: (rs) => ({ corrio: true, ...sumarBarridos(rs.map((x) => x.resultado)) }),
  });
  return d.tipo === 'ok' ? ok(d.cuerpo) : rechazo(d.codigo, d.detalle);
}
