// Las herramientas de los Analizadores del cerebro (AG11 de los agentes; `fichas/F14-LLAMADAS-DE-VENTA.md` y
// `fichas/F15-LLAMADAS-DE-ONBOARDING.md`): lo que dicen las llamadas de venta y de onboarding, contado. Se
// ofrecen con la sección Analizadores, que pide `analizadores.ver`: por eso viajan las frases citables (`D-20`).
//
// Ninguna transcripción viaja (AG-F14-2, AG-F15-2). Las frases y las metas son texto que escribió un modelo
// sobre una llamada y pueden traer un dato de contacto copiado: pasan por `sinDatosDeContacto`. Ningún correo
// viaja: el closer va por su nombre y el cliente de onboarding por su empresa.

import { llamadasDeVenta } from '../../../negocio/llamadasDeVenta.ts';
import { llamadasDeOnboarding } from '../../../negocio/llamadasDeOnboarding.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, sinDatosDeContacto, tomar } from './comun.ts';

/** Cuánto de una frase o una meta viaja. */
const LARGO_DE_UN_TEXTO = 240;
const texto = (t: string | null) => (t === null ? null : sinDatosDeContacto(t, LARGO_DE_UN_TEXTO).texto);

export const HERRAMIENTAS_DE_LOS_ANALIZADORES: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'llamadas_de_venta',
    descripcion:
      'Analizadores: las llamadas de venta analizadas de la ventana. Cuántas se vincularon a un contacto (por correo ' +
      'o por cita) y cuántas no; las objeciones por categoría (precio, momento, decisor, confianza, encaje, otra) ' +
      'en la ventana y en la anterior, con cuántas están clasificadas sobre el total; si una categoría «crece» ' +
      '(nulo sin piso); el puntaje promedio por closer (nulo bajo 10 llamadas), y algunas frases citables con su ' +
      'minuto y el enlace a la grabación.',
    secciones: ['analizadores'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const v = await llamadasDeVenta(periodoPedido(argumentos)!, { conFrases: true });
      return {
        ...tomar(v, ['dias', 'llamadas', 'llamadasAntes', 'objeciones'] as const),
        closers: primeras(v.closers.map((c) => tomar(c, ['closer', 'llamadas', 'puntajePromedio'] as const))),
        frases: (v.frases ?? []).map((f) => ({ ...tomar(f, ['categoria', 'minuto', 'enlace', 'ganada'] as const), frase: texto(f.frase) })),
      };
    },
  },
  {
    nombre: 'llamadas_de_onboarding',
    descripcion:
      'Analizadores: las llamadas de onboarding analizadas de la ventana. Cuántos clientes hay EN RIESGO, en ATENCIÓN ' +
      'y AL DÍA (por su última llamada), cuántos traen señales de riesgo, están bloqueados o con compromiso bajo, ' +
      'cuántas llamadas no se vincularon a un contacto, y la lista de clientes con su estado y su meta. Las metas ' +
      'no se cuentan: son texto libre.',
    secciones: ['analizadores'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const o = await llamadasDeOnboarding(periodoPedido(argumentos)!);
      return {
        ...tomar(o, ['dias', 'llamadas', 'clientes', 'estados', 'riesgos', 'avisoDeLasMetas'] as const),
        lista: o.lista.map((c) => ({ ...tomar(c, ['empresa', 'estado', 'arranque', 'compromiso', 'senalesDeRiesgo'] as const), meta: texto(c.meta) })),
      };
    },
  },
];
