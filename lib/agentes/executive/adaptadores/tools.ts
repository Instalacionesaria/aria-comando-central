// Las herramientas de Tools del cerebro: los leads del scraper, contados, y el historial del Espía.
//
// Los leads no se leen de la ruta de la pantalla (`app/api/tools/leads/route.ts`), que devuelve filas con
// nombre, correo y teléfono, sino de `leadsDelScraper`, que las cuenta. El Espía usa las mismas funciones que
// `app/api/tools/busquedas-del-espia/route.ts`; del análisis viaja el texto recortado y sin datos de
// contacto: lo escribió un modelo sobre anuncios ajenos, que pueden traer un teléfono o un correo.

import { lugarDe } from '../../../autorizacion/departamentos.ts';
import { leadsDelScraper } from '../../../negocio/leadsDelScraper.ts';
import { analisisDe, busquedasDelEspia } from '../../../tools/historial-del-espia.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, sinDatosDeContacto, tomar } from './comun.ts';

/** Cuánto del análisis del Espía viaja. Un análisis entero son varias páginas. */
export const LARGO_DEL_ANALISIS = 4000;

/* Dónde vive cada pestaña, de la tabla de departamentos y no a mano: escrito a mano, el día que una se mudó
   los textos quedaron mandando al lugar viejo (`NE-52`, prueba 194). */
const LOS_LEADS = lugarDe('tools', 'mis-leads') ?? 'Los leads del scraper';
const EL_ESPIA = lugarDe('tools', 'espia') ?? 'El Espía a tus competidores';

export const HERRAMIENTAS_DE_TOOLS: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'leads_del_scraper',
    descripcion:
      `${LOS_LEADS}: cuántos leads trajo el scraper en la ventana, por fuente (Maps, LinkedIn, ` +
      'Facebook…), cuántos con correo, con teléfono, con sitio y sin forma de contacto, y de cuántas búsquedas. ' +
      'Sólo conteos. Cuántos se enviaron al CRM no se registra.',
    secciones: ['tools'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await leadsDelScraper(periodoPedido(argumentos)!.dias);
      return {
        ...tomar(r, ['dias', 'desde', 'hasta', 'total', 'enviadosAlCrm', 'porQueNoHayEnviados'] as const),
        porFuente: r.porFuente.map((f) => tomar(f, ['fuente', 'leads', 'conCorreo', 'conTelefono', 'conSitio', 'sinContacto', 'busquedas'] as const)),
      };
    },
  },
  {
    nombre: 'espia',
    descripcion:
      `${EL_ESPIA}: sin «trabajo», las búsquedas que se hicieron (qué se buscó, el país, el ` +
      'estado, cuántos anuncios trajo y si tiene análisis). Con el «trabajo» de una de ellas, su análisis con IA, ' +
      'recortado. No depende del período.',
    secciones: ['tools'],
    esquema: {
      type: 'object',
      additionalProperties: false,
      required: ['trabajo'],
      properties: {
        trabajo: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
          description: 'El id de una búsqueda de la lista, para leer su análisis; null para la lista.',
        },
      },
    },
    async ejecutar(argumentos) {
      if (typeof argumentos.trabajo === 'string' && argumentos.trabajo !== '') {
        const a = await analisisDe(argumentos.trabajo);
        if (a === null) return { analisis: null, porQue: 'Esa búsqueda no tiene análisis guardado, o no existe.' };
        const t = sinDatosDeContacto(a.texto, LARGO_DEL_ANALISIS);
        return { analisis: { texto: t.texto, recortado: t.recortado || a.cortado, creadoEl: a.creadoEl } };
      }
      const b = primeras(await busquedasDelEspia());
      return {
        busquedas: {
          filas: b.filas.map((x) => tomar(x, ['id', 'consulta', 'pais', 'status', 'creadoEl', 'anuncios', 'tieneAnalisis'] as const)),
          total: b.total,
        },
      };
    },
  },
];
