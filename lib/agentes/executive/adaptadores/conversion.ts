// Las herramientas de Conversion del cerebro: los pasos del prototipo, el recorrido de los leads y el embudo del
// formulario de la landing, de la MISMA lectura que `app/api/conversion/route.ts` —`lecturaDeConversion`, con los
// días cerrados de Acquisition y la zona de la empresa—: lo que el cerebro dice de una cifra es lo que la pantalla
// dibuja (CV15-23 de `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Son conteos y proporciones de la
// cohorte: ninguna fila es de una persona.

import { lecturaDeConversion } from '../../../negocio/pasosDeConversion.ts';
import { ARGUMENTO_PERIODO, type ContextoDeHerramienta, type DefinicionDeHerramienta, periodoPedido, tomar } from './comun.ts';

/** La lectura de la pantalla, con el período pedido y la zona de la empresa. */
const leer = (argumentos: Record<string, unknown>, contexto: ContextoDeHerramienta) =>
  lecturaDeConversion(periodoPedido(argumentos)!, contexto.zona);

/** En Conversion, «hoy» es el día de calendario en curso, no las últimas 24 horas que dice el argumento común. */
const LOS_DIAS = 'En Conversion, 7d y 30d son días cerrados y «hoy» es el día en curso, a medias.';

export const HERRAMIENTAS_DE_CONVERSION: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'pasos_de_conversion',
    descripcion:
      'Conversion: la tira y los cinco pasos de la pantalla (Landing, VSL, Formulario, Agenda, Gracias): contactos de ' +
      'la ventana, vistas de landing contadas por Meta (no son personas), los que empezaron el formulario (sólo hasta ' +
      'su corte), agendados, calificados, confirmados y los que cancelaron, con sus tasas como fracción de 0 a 1. ' +
      'Cada tasa tiene su base: la de los agendados y la porción que entró por la landing, sobre los contactos de la ' +
      'ventana; la del formulario, sobre los contactos hasta su corte; calificados y no calificados, sobre los ' +
      'agendados (`deLaCohorte`, sobre los contactos); confirmados y los que cancelaron, sobre los calificados, no ' +
      'sobre los que respondieron ni sobre los agendados. Los que cancelaron son los calificados con todas sus citas ' +
      'canceladas, no todas las cancelaciones. ' +
      'Comparan contra la ventana anterior sólo los contactos, las vistas, los agendados y la porción que entró por la ' +
      'landing; el formulario, los calificados, los confirmados y los que cancelaron no comparan nunca. Las variaciones ' +
      'también llegan como fracción y siempre sin signo: `porcentaje` 0,25 es un 25 % y `puntos` 0,05 son cinco ' +
      'puntos; si sube o baja lo dice `tipo`. VSL y Gracias no tienen fuente. ' +
      LOS_DIAS,
    secciones: ['conversion'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos, contexto) {
      const { pasos } = await leer(argumentos, contexto);
      return {
        ...tomar(pasos, ['ventana', 'anterior', 'sinComparacion', 'cifras', 'cobertura', 'sinAlta'] as const),
        pasos: pasos.pasos.map((p) => tomar(p, ['clave', 'estado', 'valor', 'tasa', 'variacion', 'caida', 'metricas', 'hastaElCorte'] as const)),
      };
    },
  },
  {
    nombre: 'recorrido_de_los_leads',
    descripcion:
      'Conversion: por familia de recorrido (por dónde entró el lead), cuántos contactos, qué porción de la cohorte, ' +
      'cuántos agendaron y a cuántos se les capturó el recorrido al reservar. Son conteos, no tasas de conversión. ' +
      'Dice si la ventana cruza el corte de época del formulario. ' +
      LOS_DIAS,
    secciones: ['conversion'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos, contexto) {
      const { recorrido: r } = await leer(argumentos, contexto);
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
      'la tasa de finalización en porcentaje de 0 a 100, los valores fuera del vocabulario y cuántos agendaron según el campo y según las citas. ' +
      LOS_DIAS,
    secciones: ['conversion'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos, contexto) {
      const { formulario: f } = await leer(argumentos, contexto);
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
