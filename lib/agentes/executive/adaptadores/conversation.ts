// Las herramientas de Conversation del cerebro, con las mismas funciones y la misma ventana que
// `app/api/auditoria/route.ts`. Se ofrecen sólo a quien ve Conversation, que es tener `auditor.ver` (`D-17`).
//
// De la pantalla del técnico viajan las tarjetas de cada agente y cuántos casos hay por patrón. **No viajan
// los casos ni las conversaciones**: llevan el nombre del contacto, su identificador y frases textuales de la
// conversación (la evidencia del hallazgo). Por qué el auditor no audita lo resuelve la ruta en identidad
// (`resolverAccesoAlAuditor`, que puede dejar un registro de auditoría) y llega como dato.
//
// La cancelación de citas también es de Conversation, y vive con las de Sales (`./sales.ts`).

import { laPantallaDelTecnico, TOPE_DE_CASOS } from '../../../auditor/pantalla.ts';
import { sentimientoPorFlujo } from '../../../auditor/sentimiento.ts';
import { indicadoresDelLead } from '../../../negocio/indicadoresDelLead.ts';
import { atribucionDelLead, type FilaDeAtribucion } from '../../../negocio/atribucionDelLead.ts';
import { consumoDelPrecall } from '../../../negocio/consumoDelPrecall.ts';
import { ARGUMENTO_PERIODO, SIN_ARGUMENTOS, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

const fila = (f: FilaDeAtribucion) => tomar(f, ['etiqueta', 'cohorte', 'agendaron', 'tasa', 'esElResto'] as const);

export const HERRAMIENTAS_DE_CONVERSATION: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'auditoria_de_agentes',
    descripcion:
      'Conversation: por agente de IA del CRM, cuántas conversaciones analizó el auditor, cuántas eran auditables, ' +
      'cuántas en verde, amarillo y rojo, las intervenciones y los hallazgos abiertos; y cuántos casos hay por ' +
      'patrón (con casosTruncados, de los primeros que trae la pantalla, no del total). Si el auditor no audita, ' +
      'por qué. No trae las conversaciones ni sus frases. No depende del período.',
    secciones: ['conversation'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const p = await laPantallaDelTecnico(contexto.deLaRuta.noAudita);
      const porPatron = new Map<string, { patron: string; agente: string; casos: number }>();
      for (const c of p.casos) {
        const clave = `${c.agente}·${c.patron}`;
        const g = porPatron.get(clave) ?? { patron: c.patron, agente: c.agente, casos: 0 };
        g.casos += 1;
        porPatron.set(clave, g);
      }
      const patrones = primeras([...porPatron.values()].sort((a, b) => b.casos - a.casos));
      return {
        noAudita: p.noAudita,
        tarjetas: p.tarjetas.map((t) =>
          tomar(t, [
            'agente', 'analizadas', 'auditables', 'verdes', 'amarillos', 'rojos', 'intervencionesAbiertas', 'hallazgosAbiertos',
            'ultimoEl', 'tienePrompt',
          ] as const),
        ),
        casosPorPatron: patrones,
        /* La pantalla trae hasta `TOPE_DE_CASOS` casos, sin decir si había más: en el tope, los conteos por
           patrón son de los que alcanzó y no del total. `hayMas` es otra cosa: el tope de la lista de
           conversaciones (lo confundía un comentario de la primera versión, lo encontró la revisión). */
        casosTruncados: p.casos.length >= TOPE_DE_CASOS,
        hayMas: p.hayMas,
      };
    },
  },
  {
    nombre: 'lead_flow',
    descripcion:
      'Conversation › Lead Flow: de los contactos de la ventana, cuántos agendaron (booking rate), a cuántos se les ' +
      'escribió y cuántos contestaron, la latencia hasta el primer intento y hasta la primera respuesta (p50 y p90), ' +
      'y los que no recibieron ningún mensaje. Con sus avisos.',
    secciones: ['conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await indicadoresDelLead(periodoPedido(argumentos)!.dias);
      return tomar(r, [
        'dias', 'desde', 'mitad', 'avisoDeLaVentana', 'cohorte', 'agendaron', 'bookingRate', 'agendaronSoloCongeladas',
        'avisoDelBooking', 'agendaronTrasResponder', 'agendaronSinResponder', 'escritos', 'respondieron', 'tasa',
        'hastaElPrimerIntento', 'hastaLaPrimeraRespuesta', 'sinNingunMensaje', 'escritosSinContestar', 'aviso', 'avisoDeLatencias',
      ] as const);
    },
  },
  {
    nombre: 'atribucion_del_lead',
    descripcion:
      'Conversation: de dónde vinieron los contactos de la ventana y cuántos agendaron, por fuente y por campaña ' +
      '(tasas nulas bajo el piso), y cuántos entraron fuera de horario.',
    secciones: ['conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await atribucionDelLead(periodoPedido(argumentos)!.dias);
      const campanas = primeras(r.porCampana);
      return {
        ...tomar(r, ['dias', 'fueraDeHorario', 'aviso'] as const),
        porFuente: r.porFuente.map(fila),
        porCampana: { filas: campanas.filas.map(fila), total: campanas.total },
      };
    },
  },
  {
    nombre: 'consumo_del_precall',
    descripcion:
      'Conversation: de los contactos con cita, cuántos registraron cuánto vieron del precall, y cuántos lo vieron ' +
      'parcial o completo. Con su aviso.',
    secciones: ['conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await consumoDelPrecall(periodoPedido(argumentos)!.dias);
      return tomar(r, ['dias', 'sobre', 'conCampo', 'registraron', 'tasa', 'parcial', 'completo', 'sinRama', 'detalleSePublica', 'aviso'] as const);
    },
  },
  {
    nombre: 'sentimiento_por_flujo',
    descripcion:
      'Conversation: por flujo (cada agente del CRM), cuántas conversaciones juzgó el auditor y cuántas fueron ' +
      'positivas, neutrales y molestas. «molestos» es un porcentaje, nulo bajo el piso de 10 juzgadas.',
    secciones: ['conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await sentimientoPorFlujo(periodoPedido(argumentos)!.dias);
      return Object.fromEntries(
        Object.entries(r).map(([flujo, s]) => [
          flujo,
          { ...tomar(s, ['dias', 'juzgadas', 'molestos', 'aviso'] as const), porValor: tomar(s.porValor, ['positivo', 'neutral', 'molesto'] as const) },
        ]),
      );
    },
  },
];
