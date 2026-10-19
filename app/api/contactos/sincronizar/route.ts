// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Traer los contactos de GoHighLevel. Lo llaman las DOS pestañas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UNA SOLA RUTA Y NO UNA POR PESTAÑA, AL REVÉS QUE LA LISTA
//
// Las listas son dos rutas —`/api/closer/contactos` y `/api/setter/contactos`— porque el
// territorio tiene que escribirse en el SERVIDOR: con una sola ruta parametrizada, un setter
// pediría la zona del closer y la recibiría.
//
// Acá no aplica, y la diferencia es real: **traer no elige territorio**. Trae las dos
// etiquetas y las reparte según lo que diga GoHighLevel. No hay nada que un cliente pueda
// pedir de más, así que dos rutas serían dos copias del mismo código sin ninguna propiedad a
// cambio.
//
// ── LA PANTALLA: `SIN_PANTALLA`, Y ES UNA DECISIÓN ──────────────────────────
//
// `ADR-0304` exige que las operaciones de una misma pantalla pidan el MISMO conjunto de
// capacidades. Ésta la llaman las dos, así que no puede declarar ni `closer` ni `setter` sin
// mentir sobre una de las dos.
//
// Y pide `contactos.ver`, que es la capacidad de la FICHA — la que tienen los dos roles. No
// pide `contactos.avanzar` ni ninguna de mutación aunque escriba en la base, y eso merece
// decirse: lo que escribe **no es trabajo de una persona**, es una copia de lo que ya está en
// GoHighLevel. Pedir una capacidad de mutación haría que alguien con permiso de LEER la
// pestaña no pudiera cargarla.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { clientesQueTrae } from '../../../../lib/autorizacion/ambito.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { resolverAccesoAGhl } from '../../../../lib/credenciales/resolver.ts';
import type { FalloDeGhl } from '../../../../lib/ghl/cliente.ts';
import { sincronizarContactos } from '../../../../lib/negocio/sincronizar.ts';
import {
  desenlaceDeLaTraida,
  juntarResumenes,
  PRESUPUESTO_DE_LA_TRAIDA_MS,
  traerDeCadaCliente,
  type ClienteConAcceso,
  type CodigoDeLaTraida,
} from '../../../../lib/negocio/traerDeLosClientes.ts';

/**
 * Traer cientos de contactos son varias páginas contra un servicio externo. El valor por
 * omisión de la plataforma corta antes, y el síntoma sería *"a veces trae la mitad"* — un
 * fallo intermitente que se diagnostica muy mal.
 */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  // El acceso se resuelve por IDENTIDAD: la tabla de credenciales es de ese dominio y el rol
  // del inquilino no tiene ni `select` sobre ella. El filtro por organización lo pone esta
  // llamada a mano, con `orgEfectiva`. Uno por cliente activo (el nivel 3, G4): cada uno con las
  // credenciales de SU subcuenta (el principal, las de la empresa). La lista de contactos es de la
  // empresa entera aunque haya foco, así que se traen todos.
  //
  // CADA faltante con su código y su texto, sin colapsar. `ADR-0604`: la organización no opera
  // **y lo dice**. Un "no se pudo conectar" genérico mandaría a cinco personas con cinco problemas
  // distintos al mismo lugar equivocado. Con varios clientes, el que no tiene se saltea y se dice.
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
      /* En el ámbito de SU cliente: la resta congela a quien la búsqueda de SU subcuenta no trajo, y con la empresa
         entera congelaría a los contactos de los demás clientes. */
      const r = await conOrganizacion(ambito, () => sincronizarContactos(acceso));
      return r.tipo === 'listo'
        ? { estado: 'corrio', resultado: r.resumen, llamadas: r.resumen.llamadas }
        : { estado: 'fallo', ...rechazoDelFallo(r.fallo) };
    },
    {
      // Sin pulso: el principal primero.
      presupuestoMs: PRESUPUESTO_DE_LA_TRAIDA_MS,
      siLanza: {
        codigo: 'servicio_externo_no_disponible',
        porque: 'No se pudo completar la traída de contactos. Se puede reintentar.',
        relanzarSiEsElUnico: true,
      },
    },
  );

  // Se devuelve el resumen COMPLETO, con los salteados y el aviso de truncado. Un `{ok:true}`
  // acá sería un éxito reportado sin verificar: la lista puede haber quedado corta por un
  // contacto sin nombre o por el tope de páginas, y las dos cosas se ven igual que un éxito.
  // Con varios clientes, juntado, y `clientes` dice qué pasó con cada uno.
  const d = desenlaceDeLaTraida(renglones, {
    deUno: (r) => ({ sincronizado: true, ...r }),
    deVarios: (rs) => ({ sincronizado: true, ...juntarResumenes(rs.map((x) => x.resultado)) }),
  });
  return d.tipo === 'ok' ? ok(d.cuerpo) : rechazo(d.codigo, d.detalle);
}

/** Un fallo de GoHighLevel, con su código y su texto. */
function rechazoDelFallo(f: FalloDeGhl): { codigo: CodigoDeLaTraida; porque: string } {
  if (f.tipo === 'no_autorizado') {
    return {
      codigo: 'credencial_rechazada',
      porque:
        'GoHighLevel rechazó el token. Puede estar vencido, revocado, o ser de agencia en vez ' +
        'de subcuenta: esta operación necesita un token de subcuenta con el permiso ' +
        '`contacts.readonly`.',
    };
  }
  if (f.tipo === 'demasiadas_peticiones') {
    return {
      codigo: 'servicio_externo_saturado',
      porque: 'GoHighLevel está limitando las peticiones. Esperá un minuto y probá de nuevo.',
    };
  }
  if (f.tipo === 'sin_respuesta') {
    // NO se dice "no hay contactos". No se pudo preguntar, que es otra cosa.
    return {
      codigo: 'servicio_externo_no_disponible',
      porque: 'No se pudo contactar a GoHighLevel. No es que no tengas contactos: no llegó la pregunta.',
    };
  }
  return { codigo: 'servicio_externo_no_disponible', porque: `GoHighLevel respondió ${f.estado}. No se guardó nada.` };
}
