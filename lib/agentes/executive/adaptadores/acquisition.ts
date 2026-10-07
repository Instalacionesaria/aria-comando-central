// La herramienta de Acquisition del cerebro: los tres funnels, con la misma función y la misma ventana que
// `app/api/acquisition/route.ts`. Todo lo que viaja son cifras agregadas: campañas, inversión, etapas.

import { embudosDeAcquisition, type Grupo } from '../../../negocio/embudosDeAcquisition.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

/** Un grupo de cifras (el total, un funnel o una campaña), con sus claves exactas. */
function grupo(g: Grupo) {
  return {
    ...tomar(g, ['clave', 'campanas', 'conGasto', 'inversion', 'inversionSinContactos', 'variacionDeInversion'] as const),
    etapas: g.etapas.map((e) => tomar(e, ['etapa', 'valor', 'deMeta', 'tasa', 'costo', 'variacion'] as const)),
    calificados: tomar(g.calificados, ['valor', 'variacion', 'tasa', 'costo', 'icp'] as const),
  };
}

export const HERRAMIENTAS_DE_ACQUISITION: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'embudos_de_acquisition',
    descripcion:
      'Acquisition: inversión, contactos, clics, agendados y calificados por funnel y por campaña, con su ' +
      'variación contra la ventana anterior. La inversión del total es la de toda la cuenta de Meta (gasto.deLaCuenta, ' +
      'igual al Administrador de anuncios); conGasto dice cuántas campañas gastaron, e inversionSinContactos cuánto ' +
      'gastaron las campañas sin contactos atribuidos, que no pagan el costo por contacto. Una campaña con ' +
      'conContactos falso no dice cuánta gente trajo: sus contactos en 0 no son un dato. Dice si la comparación o ' +
      'los costos no se pueden dar, y por qué (gasto.motivo: colector_atrasado, dias_sin_leer, no_cuadra).',
    secciones: ['acquisition'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos, contexto) {
      const periodo = periodoPedido(argumentos)!;
      const r = await embudosDeAcquisition(periodo, contexto.zona);
      const campanas = primeras(r.campanas);
      return {
        periodo: periodo.clave,
        ventana: r.ventana,
        anterior: r.anterior,
        sinComparacion: r.sinComparacion,
        sinCostos: r.sinCostos,
        gasto: r.gasto,
        total: grupo(r.total),
        funnels: Object.fromEntries(Object.entries(r.funnels).map(([f, g]) => [f, grupo(g)])),
        sinFunnel: grupo(r.sinFunnel),
        campanas: {
          filas: campanas.filas.map((c) => ({
            ...tomar(c, ['campana', 'nombre', 'estado', 'funnel', 'conContactos'] as const),
            cifras: grupo(c.cifras),
          })),
          total: campanas.total,
        },
        cobertura: r.cobertura,
      };
    },
  },
];
