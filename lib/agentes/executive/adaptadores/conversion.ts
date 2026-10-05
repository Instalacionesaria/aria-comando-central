// Las herramientas de Conversion del cerebro: el recorrido de los leads y el embudo del formulario de la
// landing, con las mismas funciones y la misma ventana que `app/api/conversion/route.ts`. Son conteos por
// familia y por estado del formulario: ninguna fila es de una persona.

import { recorridoDelLead } from '../../../negocio/recorridoDelLead.ts';
import { embudoDelFormulario } from '../../../negocio/embudoDelFormulario.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, tomar } from './comun.ts';

export const HERRAMIENTAS_DE_CONVERSION: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'recorrido_de_los_leads',
    descripcion:
      'Conversion: por familia de recorrido (por dónde entró el lead), cuántos contactos, qué porción de la cohorte, ' +
      'cuántos agendaron y a cuántos se les capturó el recorrido al reservar. Son conteos, no tasas de conversión. ' +
      'Dice si la ventana cruza el corte de época del formulario.',
    secciones: ['conversion'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await recorridoDelLead(periodoPedido(argumentos)!.dias);
      return {
        ...tomar(r, ['dias', 'desde', 'hasta', 'cohorte', 'cobertura', 'corte', 'aviso'] as const),
        familias: r.filas.map((f) => tomar(f, ['familia', 'titulo', 'contactos', 'porcion', 'agendaron', 'capturadaAlReservar'] as const)),
      };
    },
  },
  {
    nombre: 'formulario_de_la_landing',
    descripcion:
      'Conversion: por estado del formulario de la landing (agendado, completo sin agendar, incompleto sin agendar), ' +
      'cuántos contactos y qué porción; ' +
      'la tasa de finalización, los valores fuera del vocabulario y cuántos agendaron según el campo y según las citas.',
    secciones: ['conversion'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const f = await embudoDelFormulario(periodoPedido(argumentos)!.dias);
      return {
        ...tomar(f, [
          'dias', 'desde', 'hasta', 'cobertura', 'finalizacion', 'fueraDelVocabulario', 'agendadoSegunLasCitas', 'corte',
          'campoDelFormulario', 'fueraDeAlcance', 'aviso',
        ] as const),
        estados: f.filas.map((e) => tomar(e, ['estado', 'contactos', 'porcion'] as const)),
      };
    },
  },
];
