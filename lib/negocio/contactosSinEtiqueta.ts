// La tarea `contactos` del cron: traer a los leads NUEVOS de la subcuenta, tengan zona o no.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA (decidida por el usuario el 2026-11-20)
//
// Hasta acá la tarea `contactos` buscaba por etiqueta de zona y releía a todos los que la tenían en cada corrida. Las
// pruebas que se están haciendo con los managed agents son leads nuevos SIN etiqueta de zona: nunca entraban a la
// base, y el Sales Assistant fallaba con «el lead todavía no está en la base» (564 corridas del 13 al 17/11).
//
// Lo pedido es el MISMO cron con la regla cambiada, más liviano: sólo lo nuevo, a lo sumo un mes atrás, sin llenar la
// base de contactos viejos que probablemente no se usen. Para todos los clientes, sin interruptor:
//
//   · **Trae los contactos creados en los últimos 30 días que cambiaron desde la marca de agua** (menos un margen),
//     por `dateUpdated` ascendente, de a 500, con el cursor `searchAfter`. La primera vez la marca no existe y se
//     arranca hace 30 días: ~4.300 contactos en ARIA (medido el 2026-11-20), unas 9 llamadas, repartidas entre
//     corridas si hiciera falta porque la marca sólo avanza sobre páginas guardadas. Después, ~200 cambios por día:
//     **una llamada por corrida**, contra las ~5 de releer por etiqueta.
//   · **El territorio sale de las etiquetas de cada contacto** (`territorioDeLasEtiquetas`). Sin zona entra con
//     `territorio = null`: está en la base y no en las colas. La zona se ignora, no se borra.
//   · **No congela, no relee congelados, no concilia bajas**: nada que recorra la subcuenta entera.
//   · **El cron no trae conversaciones**: el barrido saltea `mensajes` (lo decide `barrido.ts`).
//
// Lo que se deja de hacer, a sabiendas: un contacto creado hace más de 30 días ya no se refresca por el cron (sí al
// abrir su ficha, por un aviso del CRM o con el botón «Traer de GoHighLevel», que sigue buscando por etiqueta), y uno
// borrado en el CRM no se marca con baja.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion } from '../datos/contexto.ts';
import { aInstante } from '../ghl/conversaciones.ts';
import { contactosNuevosCambiados, POR_PAGINA_SIN_ETIQUETA, type ContactoDeGhl } from '../ghl/cliente.ts';
import {
  camposDelCuadrante,
  camposDelPuntaje,
  recalcularLosCuadrantes,
  refrescarCatalogoDeCampos,
  type ResumenDelCatalogo,
} from './camposDelCrm.ts';
import { conElPulso, type ResultadoDelPulso } from './pulso.ts';
import type { AmbitoDeUnCliente } from './ambitoDelCliente.ts';
import { guardarUnContacto, territorioDeLasEtiquetas } from './sincronizar.ts';

/** Hasta cuándo atrás: sólo los contactos creados en los últimos 30 días (decidido el 2026-11-20: «máximo un mes»). */
export const DIAS_HACIA_ATRAS = 30;

/**
 * Cuánto se vuelve atrás desde la marca en cada corrida. La búsqueda de GHL es un índice que se actualiza con algo de
 * demora: un contacto que cambió justo antes de la marca puede no haber estado en la página que la fijó. Releerlo
 * cuesta nada —el upsert es idempotente y a este ritmo cabe en la misma llamada—, perderlo sería para siempre.
 *
 * **Salvo tras una corrida cortada a mitad de camino.** Si la anterior avanzó y la cortó el tope o el tiempo, se sigue
 * exactamente desde la marca: con el margen, más de `TOPE_DE_PAGINAS_POR_CORRIDA` páginas cambiadas en esos cinco
 * minutos (una importación, un workflow que toca a todos) se releerían en cada corrida y la marca no avanzaría nunca.
 * Esa corrida, y sólo ésa, cierra con `atrasado` y sin fallo. Una que falló (con o sin páginas) o que no alcanzó a pedir
 * nada no avanzó lo suficiente para trabar nada: la siguiente vuelve a restar el margen, que es el que protege al lead
 * que el índice publicó tarde.
 */
export const MARGEN_MS = 5 * 60_000;

/** Cuánto tiempo de la corrida se puede llevar la traída: lo demás del horario también tiene que correr. */
export const PRESUPUESTO_MS = 60_000;

/** Tope de páginas por corrida (5.000 contactos): un segundo freno, por si el reloj no cortara. */
export const TOPE_DE_PAGINAS_POR_CORRIDA = 10;

/** Cuántos salteados se informan uno por uno. El resto va contado. */
export const SALTEADOS_INFORMADOS = 20;

/** Lo que dejó una traída. */
export interface ResumenDeLosNuevos {
  /** Creados desde esta fecha (hace 30 días). */
  creadosDesde: string;
  /** Cambiados desde esta fecha (la marca menos el margen, o hace 30 días la primera vez). */
  cambiadosDesde: string;
  /** Páginas guardadas. */
  paginas: number;
  traidos: number;
  /** Las filas escritas, por territorio. `sinZona` = entraron con `territorio = null`. */
  guardados: { closer: number; setter: number; sinZona: number };
  /** Los primeros `SALTEADOS_INFORMADOS` que no se guardaron, con el motivo. */
  salteados: { id: string; porque: string }[];
  salteadosEnTotal: number;
  /** La marca nueva: el `dateUpdated` más nuevo que se guardó. `null` = no avanzó. */
  marca: string | null;
  /** `true` = quedaron cambios por traer (el tiempo, el tope o un fallo a mitad): siguen en la próxima corrida. */
  pendientes: boolean;
  /** El tipo de fallo del CRM que cortó la traída a mitad, o `null`. */
  fallo: string | null;
  /** Igual que en la traída por etiqueta: `null` = no se pudo leer, o no quedó tiempo para leerlo. */
  catalogoDeCampos: ResumenDelCatalogo | null;
}

/**
 * Trae y guarda los contactos nuevos que cambiaron desde la marca de agua. Corre por el pulso `contactos` (el candado,
 * el antirrebote y la marca de `negocio.ingesta_pulso`, los mismos de la ingesta de mensajes).
 *
 * Un fallo del CRM en la PRIMERA página se lanza: no se guardó nada, la marca no se mueve y el barrido sella `fallo`.
 * Uno a mitad no: lo guardado queda, la marca avanza hasta ahí y el resto sigue en la próxima corrida.
 */
export async function sincronizarLosNuevos(
  ambito: AmbitoDeUnCliente,
  acceso: { token: string; locationId: string },
  plazo: { fin: number; ahora: () => number },
): Promise<ResultadoDelPulso<ResumenDeLosNuevos>> {
  return conElPulso(ambito, 'contactos', async (pulso) => {
    const inicio = plazo.ahora();
    const corte = Math.min(plazo.fin, inicio + PRESUPUESTO_MS);
    const creadosDesde = new Date(inicio - DIAS_HACIA_ATRAS * 24 * 3600_000);
    // La marca, con su margen sólo si la anterior terminó, y nunca antes del mes: más atrás no hay nada que traer.
    const margen = pulso.atrasado && !pulso.ultimoFallo ? 0 : MARGEN_MS;
    const cambiadosDesde =
      pulso.marcaEl && pulso.marcaEl.getTime() - margen > creadosDesde.getTime()
        ? new Date(pulso.marcaEl.getTime() - margen)
        : creadosDesde;
    const resumen: ResumenDeLosNuevos = {
      creadosDesde: creadosDesde.toISOString(),
      cambiadosDesde: cambiadosDesde.toISOString(),
      paginas: 0,
      traidos: 0,
      guardados: { closer: 0, setter: 0, sinZona: 0 },
      salteados: [],
      salteadosEnTotal: 0,
      marca: null,
      pendientes: false,
      fallo: null,
      catalogoDeCampos: null,
    };

    // Los ids del campo del puntaje y del cuadrante de la subcuenta, una vez por pasada (como la traída por etiqueta).
    const { puntaje, cuadrante } = await conOrganizacion(ambito, async () => ({
      puntaje: await camposDelPuntaje(),
      cuadrante: await camposDelCuadrante(),
    }));

    let llamadas = 0;
    let marca: Date | null = null;
    let cursor: unknown[] | null = null;
    for (;;) {
      if (resumen.paginas >= TOPE_DE_PAGINAS_POR_CORRIDA || plazo.ahora() >= corte) {
        resumen.pendientes = true;
        break;
      }
      const r = await contactosNuevosCambiados(acceso, { creadosDesde, cambiadosDesde, despuesDe: cursor });
      llamadas++;
      if (r.tipo === 'fallo') {
        if (resumen.paginas === 0) throw new Error(`el CRM respondió ${r.fallo.tipo}`);
        resumen.pendientes = true;
        resumen.fallo = r.fallo.tipo;
        break;
      }
      const lote = r.datos.contactos;
      if (lote.length > 0) {
        // Una transacción por página: lo guardado queda aunque la corrida se corte después.
        await conOrganizacion(ambito, () => guardarElLote(lote, puntaje, cuadrante, resumen));
        resumen.paginas++;
        resumen.traidos += lote.length;
        for (const c of lote) {
          const cuando = aInstante(c.dateUpdated);
          if (cuando && (marca === null || cuando > marca)) marca = cuando;
        }
      }
      if (lote.length < POR_PAGINA_SIN_ETIQUETA || !r.datos.siguiente) break;
      cursor = r.datos.siguiente;
    }

    /* El catálogo de campos y el recálculo de los cuadrantes, igual que la traída por etiqueta y por lo mismo: después
       de los contactos, y su fallo no rompe nada. El catálogo se relee sólo cuando está viejo (casi siempre 0 llamadas).
       Sin tiempo se deja para la próxima corrida: pasado el corte, una llamada más puede llevar la función a sus 300 s. */
    if (plazo.ahora() < corte) {
      resumen.catalogoDeCampos = await conOrganizacion(ambito, () => refrescarCatalogoDeCampos(acceso));
      llamadas += resumen.catalogoDeCampos?.llamadas ?? 1;
      if (resumen.catalogoDeCampos !== null && !resumen.catalogoDeCampos.saltado) {
        await conOrganizacion(ambito, () => recalcularLosCuadrantes());
      }
    }

    resumen.marca = marca?.toISOString() ?? null;
    return {
      cierre: {
        marcaEl: marca,
        // El piso de la cobertura, una sola vez (`coalesce`): desde dónde arrancó la primera traída.
        marcaDesdeEl: cambiadosDesde,
        llamadas,
        // `atrasado` sólo para la cortada por el tope o el tiempo después de avanzar: es lo que lee el margen de arriba.
        // Las demás pendientes (sin tiempo para pedir nada, un fallo a mitad) las dice el resumen y el motivo del sello.
        atrasado: resumen.pendientes && resumen.paginas > 0 && resumen.fallo === null,
        fallo: resumen.fallo,
      },
      resultado: resumen,
    };
  });
}

/** Guarda una página. Corre dentro de `conOrganizacion(` con el ámbito del cliente. */
async function guardarElLote(
  lote: readonly ContactoDeGhl[],
  puntaje: readonly string[],
  cuadrante: readonly string[],
  resumen: ResumenDeLosNuevos,
): Promise<void> {
  for (const c of lote) {
    const territorio = territorioDeLasEtiquetas(c.tags);
    const guardado = await guardarUnContacto(c, territorio, puntaje, cuadrante);
    if (guardado === true) {
      resumen.guardados[territorio ?? 'sinZona'] += 1;
      continue;
    }
    resumen.salteadosEnTotal++;
    if (resumen.salteados.length < SALTEADOS_INFORMADOS) resumen.salteados.push({ id: c.id, porque: guardado });
  }
}
