// Las herramientas de Sales del cerebro, con las mismas funciones y los mismos argumentos que la lectura de la
// pantalla, `lecturaDeSales` (la de `app/api/sales/route.ts`): el dinero del mes, la cadena de cierre, el ciclo hasta la cita, el cierre por
// closer, los motivos de no venta y la cancelación de citas (que también es de Conversation). Y la economía del
// mes, que cruza las ventas con la inversión de Acquisition y por eso pide ver las dos secciones.
//
// Las dos que publican lo que la pantalla ARMA —las cuatro cifras de arriba con la tabla, y los motivos— leen la
// mitad del cierre de esa lectura, `lecturaDelCierre`, la misma que la ruta usa: lo que el cerebro dice de una
// cifra es lo que la pantalla dibuja (S15-14 de `docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), sin la
// cadena, el ciclo ni el dinero. Las demás llaman a la misma función con los mismos argumentos que la lectura.
//
// Lo que no viaja: los textos de rótulo de cada eslabón (son de la pantalla), el identificador del CRM de cada
// closer y el texto libre de un motivo. Los nombres de los closers sí: son el equipo de la empresa, y la tabla se
// lee por ellos.

import { closersDeLaEmpresa } from '../../../negocio/alcanceDelCloser.ts';
import { dineroDelMes } from '../../../negocio/dineroDelMes.ts';
import { cadenaDeCierre } from '../../../negocio/cadenaDeCierre.ts';
import { cicloHastaLaCita } from '../../../negocio/cicloHastaLaCita.ts';
import { tasaDeCancelacion } from '../../../negocio/indicadoresDeCitas.ts';
import { economiaDelNegocio } from '../../../negocio/economiaDelNegocio.ts';
import { lecturaDelCierre, sujetoDelDinero } from '../../../negocio/lecturaDeSales.ts';
import {
  ARGUMENTO_PERIODO, SIN_ARGUMENTOS, type DefinicionDeHerramienta, periodoPedido, primeras, tomar,
} from './comun.ts';

/** La mitad del cierre de la lectura de la pantalla, con el período pedido. */
const leer = (argumentos: Record<string, unknown>) => lecturaDelCierre(periodoPedido(argumentos)!.dias);

export const HERRAMIENTAS_DE_SALES: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'dinero_del_mes',
    descripcion:
      'Sales: lo cobrado, las ventas y los acuerdos del MES CALENDARIO en curso, no del período elegido. Es venta ' +
      'reportada por el closer al cerrar la cita, no un pago verificado.',
    secciones: ['sales'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      // El mismo sujeto que arma la lectura de la pantalla: los closers de la empresa, o nadie.
      const d = await dineroDelMes(contexto.zona, sujetoDelDinero(await closersDeLaEmpresa()));
      return {
        ...tomar(d, ['mes', 'cobrado', 'ventas', 'acuerdos'] as const),
        nota: 'Mes calendario en curso. Venta reportada por el closer, no un pago verificado.',
      };
    },
  },
  {
    nombre: 'economia_del_negocio',
    descripcion:
      'Sales y Acquisition: lo cobrado y las ventas del MES CALENDARIO contra la inversión en anuncios del mismo ' +
      'mes, con el retorno (cobrado / inversión) y el costo por venta. Sin ventas, con una venta sin monto o con el ' +
      'gasto del mes incompleto no hay retorno, y el aviso dice por qué. Venta reportada, no un pago verificado.',
    // Cruza las dos: se ofrece sólo a quien ve las dos (AG-41).
    secciones: ['sales', 'acquisition'],
    todas: true,
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const e = await economiaDelNegocio(contexto.zona);
      return tomar(e, [
        'mes', 'desde', 'hasta', 'cobrado', 'ventas', 'inversion', 'gastoHasta', 'ventasSinMonto', 'gastoEntero', 'retorno', 'costoPorVenta', 'aviso',
        'nota',
      ] as const);
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
      'Sales: las cuatro cifras de arriba de la pantalla (`cifras`: asistencias, tasa de cierre, ventas y revenue ' +
      'reportado, la tasa como fracción de 0 a 1) y, por closer, citas, cancelaciones, asistencia, intentos ' +
      'registrados, ventas, el monto reportado de esas ventas y la tasa de cierre. Una cifra sin valor trae su ' +
      'motivo: `sin_closers` (no hay closers configurados), `sin_vinculo` (el closer no está vinculado al CRM), ' +
      '`sin_citas` (no hubo citas), `sin_asistencia` (nadie ' +
      'marca la asistencia), `sin_registros` (ningún resultado en la ventana), `bajo_el_piso` (menos de 10 ' +
      'intentos) o `venta_sin_monto` (alguna venta no trae monto; `ventasSinMonto` dice cuántas). Ventas, revenue y ' +
      'tasa son lo que registraron los closers; el revenue ' +
      'es reportado por el closer, no un pago verificado. Las tasas de las filas son nulas bajo el piso de 10.',
    secciones: ['sales'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const l = await leer(argumentos);
      const c = l.closers;
      const filas = primeras(c.filas);
      return {
        cifras: l.cierre.cifras,
        ...tomar(c, ['dias', 'fueraDeLasFilas', 'coberturaDeLaTabla', 'concentracion', 'bajoElPiso', 'piso', 'aviso'] as const),
        closers: {
          filas: filas.filas.map((f) =>
            tomar(f, [
              'usuarioId', 'nombre', 'contactos', 'citas', 'canceladas', 'tasaDeCancelacion', 'conAsistencia', 'sePresentaron',
              'tasaDeAsistencia', 'intentos', 'porSalida', 'ventas', 'montoDeVentas', 'ventasSinMonto', 'tasaDeCierre', 'aviso',
            ] as const),
          ),
          total: filas.total,
        },
      };
    },
  },
  {
    nombre: 'motivos_de_no_venta',
    descripcion:
      'Sales: los motivos de no venta de la pantalla —las llamadas de venta HT analizadas en la ventana que terminaron ' +
      'sin cierre (`sinCierre`), y por categoría de objeción (precio, momento, decisor, confianza, encaje, otra) ' +
      'cuántas tuvieron al menos una, con su porción como fracción de 0 a 1; una llamada con dos categorías cuenta en ' +
      'las dos, y `sinObjecion` son las que no tienen ninguna clasificada—. El resultado y las categorías los lee un ' +
      'modelo en la transcripción: no es lo que reportó el closer. Aparte, `registradosPorLosClosers`: los «No le ' +
      'interesa» que los closers registraron en Avanzar, por motivo del catálogo (Precio, No es el momento, ' +
      'Competencia, No califica, Otro), los de fuera del catálogo contados aparte, y `sinVenta`, los resultados ' +
      'registrados que no fueron venta.',
    secciones: ['sales'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const { motivos, registrados } = (await leer(argumentos)).cierre;
      return {
        ...tomar(motivos, ['dias', 'sinCierre', 'filas', 'sinObjecion', 'porcionSinObjecion'] as const),
        registradosPorLosClosers: tomar(registrados, ['total', 'filas', 'fueraDelCatalogo', 'porcionFueraDelCatalogo', 'sinVenta'] as const),
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
