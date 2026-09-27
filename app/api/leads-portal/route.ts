// La lista de Leads Portal: la cohorte del período, una fila por persona, y sus cinco tarjetas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIMERA OPERACIÓN DE `contacts`, Y POR ESO LA BANDERA SE BAJÓ EN EL MISMO COMMIT
//
// Hasta esta ruta la pestaña era una maqueta con quince personas inventadas, y la sección tenía
// `sinOperacionesTodavia`. `30-portero` exige que ninguna sección con esa bandera tenga manejadores
// (`ADR-0304`), así que la ruta y la bandera se movieron juntas, con el conteo de `90-fundaciones`.
//
// ── `tablero.ver`, COMO LA SECCIÓN ──────────────────────────────────────────
//
// La decisión del 2026-09-26 es que la pestaña la ve quien la tiene: `tablero.ver` y, para el rol
// restringido, la sección concedida. La ruta pide exactamente la capacidad de la sección —si pidiera
// otra, el menú abriría la puerta que los datos niegan, el defecto que `ADR-0304` vigila—. Medido el
// 2026-09-27: las tres personas que hoy ven la pestaña ya leían cualquier ficha por `closer.ver`,
// `setter.ver` o `contactos.ver`, así que la lista no le abre datos personales a nadie nuevo.
//
// ── LO QUE VIAJA ────────────────────────────────────────────────────────────
//
// La lista no trae teléfono, ni correo, ni la atribución cruda, ni los campos del CRM: cada fila son
// las catorce claves de `CLAVES_DE_LA_FILA`. El teléfono y el correo van sólo en la ficha
// (`[id]/route.ts`). Y `ok()` responde con `no-store`, como toda respuesta con datos de un inquilino.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { cadenaDeCierre } from '../../../lib/negocio/cadenaDeCierre.ts';
import { frescuraDe } from '../../../lib/negocio/frescura.ts';
import { HUECOS, MEDIDO_EL } from '../../../lib/negocio/huecosDeSales.ts';
import { coherenciaConSales, leadsDelPortal } from '../../../lib/negocio/leadsDelPortal.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'contacts';

/**
 * Los huecos de Sales que esta pantalla también tiene. **Se consumen, no se reescriben.**
 *
 * La venta, el revenue y el pago verificado son el mismo hecho en las dos pestañas —cero ventas
 * registradas en toda la base— y dos textos del mismo hecho se corrigen por separado. Los motivos de
 * pérdida y la atribución de la cita al resultado son de la tabla de Sales y acá no se dibujan.
 */
const HUECOS_QUE_COMPARTE = ['La venta', 'El revenue y la tasa de cierre', 'El pago verificado'];

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El período que no está en la lista se RECHAZA, no se corrige. El segmentado de la maqueta
     mandaba una clave que no existe y encendía otro botón; con el valor por omisión, esa petición
     habría recibido treinta días sin enterarse. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  const { portal, cadena, frescura } = await conOrganizacion(contexto.orgEfectiva, async () => ({
    portal: await leadsDelPortal(periodo.dias),
    /* La cadena de Sales, con el MISMO `dias`. No se dibuja: está para comparar. Cohorte y «agendó»
       son la misma expresión y el mismo predicado en las dos pestañas, y si no dan lo mismo ninguna
       de las dos falla — el defecto sólo se ve poniéndolas una al lado de la otra, que es esto. */
    cadena: await cadenaDeCierre(periodo.dias),
    frescura: {
      contactos: await frescuraDe('contactos'),
      citas: await frescuraDe('citas'),
    },
  }));

  /* Si no coinciden, lo dice el aviso en vez de elegir una de las dos cifras. Ver `coherenciaConSales`. */
  const { coherencia, aviso } = coherenciaConSales(portal, cadena);

  return ok({
    /* La clave vuelve y no se da por supuesta: la pantalla enciende el botón con lo que el servidor
       contestó, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    ...portal,
    aviso,
    coherenciaConSales: coherencia,
    frescura,
    huecos: { medidoEl: MEDIDO_EL, lista: HUECOS.filter((h) => HUECOS_QUE_COMPARTE.includes(h.punto)) },
  });
}
