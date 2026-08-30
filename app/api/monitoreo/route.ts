// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por CAPACIDAD, nunca por nombre de rol.
//
// El Panel de Monitoreo: cuántos scrapeos hizo cada empresa, y con qué scraper.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE ESTA PANTALLA
//
// Del «Panel de Control» de ARIA-brain (`app-next/app/admin/`), que se borró al escribir esto.
// Aquél cruzaba tres fuentes del hub —`aria_brain_clientes`, una llamada por cliente al backend
// de scraping, y las tablas del analizador— y su unidad era el ALUMNO. Acá la unidad es la
// **organización**, que es lo que la migración `006_aria_cc_scraper.sql` hizo posible al mover
// las tres tablas del scraper a esta base con `org_id` en vez de `cliente_id`.
//
// Tres cosas que cambian y conviene decir cuáles, porque los dos paneles no muestran lo mismo:
//
//   · **Ya no hay una llamada HTTP por cliente.** El de ARIA-brain preguntaba
//     `GET /user-leads?cliente_id=` al backend de EasyPanel, una vez por cuenta, y su propio
//     comentario decía que con cientos de usuarios eso no escalaba. Acá se lee la base.
//   · **Se cuentan SCRAPEOS, que aquél no contaba.** El de ARIA-brain mostraba leads y saldo;
//     los trabajos no eran visibles desde el hub. Es lo que se pidió: cuántos scrapeos y de qué
//     scraper.
//   · **No hay costo de IA.** Vivía en `aria_brain_analyzer_*`, seis tablas del analizador de
//     llamadas que este sistema no tiene. No se inventa una columna vacía para que la tabla se
//     parezca a la vieja.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA AUTORIZACIÓN SON DOS MITADES, Y NINGUNA ALCANZA SOLA
//
// 1 · **La capacidad `monitoreo.ver`.** No la da ningún rol de puesto: la tienen
//     `superadministrador` y un rol propio, `monitoreo`, que se asigna persona por persona. Se
//     pidió que el panel lo vean tres personas de ARIA, y eso no lo puede expresar un rol de
//     puesto — `administrador` es el mismo rol en ARIA y en cada empresa cliente, y el mismo
//     para todos los administradores de ARIA. El reparto le niega `monitoreo.%` a `usuario` y a
//     `administrador` con dos `not like` escritos a mano.
//
// 2 · **Ser de la organización principal.** Y esto NO es de coherencia como la regla de la
//     pestaña Empresas —que se sacó del servidor porque creaba un encierro—: acá **es la
//     barrera**, y es la red debajo del punto 1. Asignarle el rol `monitoreo` a una persona de
//     una empresa cliente es un error de UNA fila que nadie revisa; sin esta mitad, esa persona
//     vería los números de sus competidores con la pantalla funcionando perfectamente y sin un
//     solo error en ningún lado.
//
//     Se mide sobre la organización PROPIA y no sobre la efectiva. La diferencia importa: un
//     superadministrador conmutado a una empresa cliente sigue siendo de la casa, y medirlo
//     sobre la efectiva le apagaría el panel al conmutar — el encierro exacto que
//     `app/api/admin/organizaciones/route.ts` documenta como ya pagado. El razonamiento está en
//     `esDeLaPrincipal`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// Y POR QUÉ NO ES UN `group by org_id`
//
// Porque las tres tablas del scraper tienen RLS forzada y `app_inquilino` es el único rol con
// privilegios sobre ellas: un `group by` bajo `conOrganizacion(` devuelve UNA fila. Se recorren
// las organizaciones de a una, abriendo el contexto en cada vuelta como una petición normal.
// El razonamiento completo —y las dos alternativas que se descartaron— está en
// `lib/monitoreo/consumo.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../lib/autorizacion/secciones.ts';
import { listarOrganizaciones } from '../../../lib/administracion/organizaciones.ts';
import { consumoDeLaOrganizacion } from '../../../lib/monitoreo/consumo.ts';
import type { ConsumoDeUnaOrganizacion, FilaDelPanel } from '../../../lib/monitoreo/fuentes.ts';

export const PANTALLA = 'monitoreo';

/**
 * Cuántas organizaciones se consultan a la vez.
 *
 * Es DELIBERADAMENTE menor que el tamaño del agrupador (`max: 5` en `lib/datos/capa.ts`). Con
 * cinco en vuelo, esta pantalla se queda con todas las conexiones del inquilino y **cualquier
 * otra petición que llegue mientras tanto se cuelga esperando una** — un panel de administración
 * que frena la aplicación entera para todos los clientes. Con cuatro siempre queda una libre.
 *
 * Y no es uno, que sería lo más simple: con diez clientes, secuencial son diez transacciones en
 * fila —cada una con su `BEGIN`, su lectura de reposo, su `set_config` y su `COMMIT`— y eso se
 * siente al abrir la pantalla.
 */
const A_LA_VEZ = 4;

/**
 * El consumo de una empresa que no se pudo leer. **Ceros que la fila marca como ilegibles.**
 *
 * Se escribe una vez acá y no en línea para que no haya dos formas de decir «no se pudo leer»
 * — la segunda es la que algún día se olvida de poner `ilegible`.
 */
const SIN_LEER: ConsumoDeUnaOrganizacion = {
  scrapeos: 0,
  completados: 0,
  porFuente: {},
  leads: 0,
  saldo: null,
};

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['monitoreo.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* La segunda mitad de la autorización. Ver el encabezado: sin esto, la capacidad sola le da el
     panel al administrador de cada empresa cliente.

     Se responde `sin_permiso` y no un código propio, a diferencia de `seccion_no_concedida`. El
     criterio de ese código es *"colapsarlos manda a buscar al lugar equivocado"*, y acá no hay
     lugar donde buscar: no existe ninguna operación —ni pantalla, ni fila, ni bandera— que le dé
     este panel a alguien de una empresa cliente. Un código propio nombraría un arreglo que no
     existe. */
  if (!esDeLaPrincipal(contexto)) {
    return rechazo(
      'sin_permiso',
      'El Panel de Monitoreo es de la organización principal: mide el consumo de todas las empresas.',
    );
  }

  // La lista de empresas sale de identidad, que es el ÚNICO dominio que se puede leer sin filtro
  // de organización. `listarOrganizaciones` ya deja afuera `control-a` y `control-b` —las dos de
  // la sonda de aislamiento, que son infraestructura y no clientes— así que el panel no las
  // cuenta ni las muestra vacías.
  const organizaciones = await conIdentidad(async (db) => listarOrganizaciones(db));

  /* ── EL BUCLE, EN TANDAS ────────────────────────────────────────────────────
   *
   * Cada vuelta abre el contexto de UNA organización, o sea que cada lectura pasa por la misma
   * política de RLS que pasaría una petición de esa empresa. La parte que cruza organizaciones
   * es este bucle, no una consulta — y lo que lo autoriza es el portero, doce líneas más arriba.
   *
   * Si la lectura de UNA empresa falla, **no se cae el panel entero**: esa fila queda con su
   * consumo en cero y las demás se muestran. Un panel que desaparece porque una sola empresa
   * tiene un problema es un panel que no sirve justo el día que hace falta. Lo que NO se hace es
   * disimularlo: la fila lleva `ilegible: true` y la pantalla la marca, porque un cero silencioso
   * en un tablero de consumo se lee como "esta empresa no scrapeó", que es lo contrario de lo
   * que pasó. */
  const filas: FilaDelPanel[] = [];
  for (let i = 0; i < organizaciones.length; i += A_LA_VEZ) {
    const tanda = await Promise.all(
      organizaciones.slice(i, i + A_LA_VEZ).map(async (o) => {
        const identidad = {
          orgId: o.id,
          nombre: o.nombre,
          slug: o.slug,
          activa: o.activa,
          esPrincipal: o.esPrincipal,
        };
        try {
          const consumo = await conOrganizacion(o.id, () => consumoDeLaOrganizacion());
          return { ...identidad, ...consumo, ilegible: false } satisfies FilaDelPanel;
        } catch {
          return { ...identidad, ...SIN_LEER, ilegible: true } satisfies FilaDelPanel;
        }
      }),
    );
    filas.push(...tanda);
  }

  /* Ordenadas por scrapeos, de más a menos. La lista de empresas viene con la principal primero
     y después por nombre —que es lo que sirve para administrar—, y acá lo que sirve es ver quién
     está consumiendo. El desempate por nombre existe para que dos empresas en cero no cambien de
     lugar entre dos recargas. */
  filas.sort((a, b) => b.scrapeos - a.scrapeos || a.nombre.localeCompare(b.nombre, 'es'));

  return ok({ empresas: filas });
}
