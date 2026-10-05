// Las herramientas de Sales del cerebro, con las mismas funciones y los mismos argumentos que
// `app/api/sales/route.ts`: el dinero del mes, la cadena de cierre, el ciclo hasta la cita, el cierre por
// closer y la cancelación de citas (que también es de Conversation).
//
// Lo que no viaja: los textos de rótulo de cada eslabón (son de la pantalla) y el identificador del CRM
// de cada closer. Los nombres de los closers sí: son el equipo de la empresa, y la tabla se lee por ellos.

import { closersDeLaEmpresa } from '../../../negocio/alcanceDelCloser.ts';
import { dineroDelMes } from '../../../negocio/dineroDelMes.ts';
import { cadenaDeCierre } from '../../../negocio/cadenaDeCierre.ts';
import { cicloHastaLaCita } from '../../../negocio/cicloHastaLaCita.ts';
import { cierrePorCloser } from '../../../negocio/cierrePorCloser.ts';
import { tasaDeCancelacion } from '../../../negocio/indicadoresDeCitas.ts';
import { ARGUMENTO_PERIODO, SIN_ARGUMENTOS, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

export const HERRAMIENTAS_DE_SALES: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'dinero_del_mes',
    descripcion:
      'Sales: lo cobrado, las ventas y los acuerdos del MES CALENDARIO en curso, no del período elegido. Es venta ' +
      'reportada por el closer al cerrar la cita, no un pago verificado.',
    secciones: ['sales'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      // El mismo sujeto que arma la ruta: los closers de la empresa, o nadie.
      const catalogo = await closersDeLaEmpresa();
      const sujeto =
        catalogo.length === 0 ? ({ tipo: 'nadie' } as const) : ({ tipo: 'empresa', usuarioIds: catalogo.map((k) => k.usuarioId) } as const);
      const d = await dineroDelMes(contexto.zona, sujeto);
      return {
        ...tomar(d, ['mes', 'cobrado', 'ventas', 'acuerdos'] as const),
        nota: 'Mes calendario en curso. Venta reportada por el closer, no un pago verificado.',
      };
    },
  },
  {
    nombre: 'cadena_de_cierre',
    descripcion:
      'Sales: de los contactos que entraron en la ventana, cuántos agendaron, cuántas citas ya ocurrieron, en ' +
      'cuántas alguien registró qué pasó y cuántas terminaron en venta. Avisa las citas que nadie registró.',
    secciones: ['sales'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const c = await cadenaDeCierre(periodoPedido(argumentos)!.dias);
      return {
        ...tomar(c, ['dias', 'desde', 'hasta', 'cohorte', 'coberturaDeLaCohorte', 'congeladas', 'descartadas', 'intentosSinCita', 'piso', 'aviso'] as const),
        eslabones: c.eslabones.map((e) => tomar(e, ['clave', 'titulo', 'contactos', 'porcionDeLaCohorte', 'porcionDelAnterior', 'citas'] as const)),
      };
    },
  },
  {
    nombre: 'ciclo_hasta_la_cita',
    descripcion: 'Sales: cuántos días pasan desde que un contacto entra hasta su primera cita (mediana y p90).',
    secciones: ['sales'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const c = await cicloHastaLaCita(periodoPedido(argumentos)!.dias);
      return tomar(c, ['dias', 'cohorte', 'p50', 'p90', 'cobertura', 'sinCitaTodavia', 'techoDeLaVentana', 'avisoDelTecho', 'piso', 'aviso'] as const);
    },
  },
  {
    nombre: 'cierre_por_closer',
    descripcion:
      'Sales: por closer, citas, cancelaciones, asistencia, intentos registrados, ventas y tasa de cierre. Las ' +
      'tasas son nulas bajo el piso de 10.',
    secciones: ['sales'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const catalogo = await closersDeLaEmpresa();
      const c = await cierrePorCloser(periodoPedido(argumentos)!.dias, catalogo);
      const filas = primeras(c.filas);
      return {
        ...tomar(c, ['dias', 'fueraDeLasFilas', 'coberturaDeLaTabla', 'concentracion', 'bajoElPiso', 'piso', 'aviso'] as const),
        closers: {
          filas: filas.filas.map((f) =>
            tomar(f, [
              'usuarioId', 'nombre', 'contactos', 'citas', 'canceladas', 'tasaDeCancelacion', 'conAsistencia', 'sePresentaron',
              'tasaDeAsistencia', 'intentos', 'porSalida', 'ventas', 'tasaDeCierre', 'aviso',
            ] as const),
          ),
          total: filas.total,
        },
      };
    },
  },
  {
    nombre: 'cancelacion_de_citas',
    descripcion: 'Citas de la ventana: canceladas, reagendadas, asistencia, confirmación y no-shows, con sus avisos.',
    // Está en Sales y en Conversation: se ofrece con cualquiera de las dos (AG-41).
    secciones: ['sales', 'conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const c = await tasaDeCancelacion(periodoPedido(argumentos)!.dias);
      return tomar(c, [
        'dias', 'citas', 'canceladas', 'tasa', 'congeladas', 'aviso', 'avisoDeLaVentana', 'reagendadas', 'tasaDeReagendamiento',
        'horasHastaLaCita', 'noShowReportado', 'conAsistencia', 'sePresentaron', 'tasaDeAsistencia', 'avisoDeAsistencia',
        'conConfirmacion', 'confirmaron', 'tasaDeConfirmacion', 'avisoDeConfirmacion', 'descartados',
      ] as const);
    },
  },
];
