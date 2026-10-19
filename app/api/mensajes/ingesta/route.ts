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
//
// ── CON VARIOS CLIENTES (el nivel 3, G4) ─────────────────────────────────────
//
// El ciclo es POR CLIENTE activo, cada uno con su subcuenta. `corrio: true` significa «corrió al menos
// uno», con las cifras sumadas, y `clientes` dice qué pasó con cada uno. Un tic de diez segundos no
// empieza un cliente después de su cadencia (`PRESUPUESTO_DEL_TIC_MS`): el siguiente tic sigue por el
// que lleva más sin traerse, y el cron de diez minutos los cubre a todos.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { clientesQueTrae } from '../../../../lib/autorizacion/ambito.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../../../../lib/credenciales/resolver.ts';
import { ingerirMensajes } from '../../../../lib/negocio/ingesta.ts';
import {
  desenlaceDeLaTraida,
  PRESUPUESTO_DEL_TIC_MS,
  sumarIngestas,
  traerDeCadaCliente,
  type ClienteConAcceso,
} from '../../../../lib/negocio/traerDeLosClientes.ts';

// ── NO CRUZA LOS DOS DOMINIOS, Y ESO NO ES UN ACCIDENTE ────────────────────
//
// Acá se leen las credenciales de cada cliente —dominio de identidad, **solo lectura**— y la
// escritura de mensajes vive entera en `lib/negocio/ingesta.ts`, que abre `conOrganizacion(` para
// cada una de sus transacciones cortas, en el ámbito de SU cliente. Entre dominios no hay atomicidad,
// así que la pregunta obligatoria es qué queda a medias si la segunda mitad falla: **nada**, porque
// la primera no escribe.
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
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  /* Los clientes activos de la empresa —el chat del Closer y del Setter es de la empresa entera, aunque haya foco—,
     cada uno con las credenciales de SU subcuenta (el principal, las de la empresa). Por identidad y SOLO LECTURA. */
  const clientes = await conIdentidad(async (db) => {
    const salida: ClienteConAcceso[] = [];
    for (const c of clientesQueTrae(contexto, SIN_SECCION)) {
      salida.push({ ...c, acceso: await resolverAccesoAGhl(db, contexto.orgEfectiva, c) });
    }
    return salida;
  });

  const renglones = await traerDeCadaCliente(
    contexto.orgEfectiva,
    clientes,
    async (ambito, acceso) => {
      const r = await ingerirMensajes(ambito, acceso);
      // `corrio: false` es 200 y no un error. Ver arriba.
      return r.corrio ? { estado: 'corrio', resultado: r.resultado, llamadas: r.llamadas } : { estado: 'frenada', porque: r.porque };
    },
    {
      presupuestoMs: PRESUPUESTO_DEL_TIC_MS,
      pulso: 'mensajes',
      /* `conElPulso` ya dejó anotado el fallo en la fila del pulso antes de relanzar. Acá solo se traduce: quien
         pregunta no puede hacer nada con el detalle, y `ADR-0704` prohíbe devolverlo. */
      siLanza: {
        codigo: 'servicio_externo_no_disponible',
        porque: 'No se pudo completar la ingesta de mensajes. Quedó anotado y se reintenta en el próximo ciclo.',
      },
    },
  );

  // El resumen entero, incluido `atrasado`. Un `{ok:true}` acá sería un éxito reportado sin
  // verificar: un ciclo que agotó un tope y dejó trabajo sin hacer se ve igual que uno completo.
  const d = desenlaceDeLaTraida(renglones, {
    deUno: (r, llamadas) => ({ corrio: true, llamadas, ...r }),
    deVarios: (rs) => ({
      corrio: true,
      llamadas: rs.reduce((n, x) => n + x.llamadas, 0),
      ...sumarIngestas(rs.map((x) => x.resultado)),
    }),
  });
  return d.tipo === 'ok' ? ok(d.cuerpo) : rechazo(d.codigo, d.detalle);
}
