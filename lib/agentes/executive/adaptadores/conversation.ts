// Las herramientas de Conversation del cerebro, con las mismas funciones y la misma ventana que
// `app/api/auditoria/route.ts`. Se ofrecen sólo a quien ve Conversation, que es tener `auditor.ver` (`D-17`).
//
// De la pantalla del técnico viajan las tarjetas de cada agente y cuántos casos hay por patrón. **No viajan
// los casos ni las conversaciones**: llevan el nombre del contacto, su identificador y frases textuales de la
// conversación (la evidencia del hallazgo). Por qué el auditor no audita lo resuelve la ruta en identidad
// (`resolverAccesoAlAuditor`, que puede dejar un registro de auditoría) y llega como dato.
//
// La cancelación de citas también es de Conversation, y vive con las de Sales (`./sales.ts`).
//
// `conversation_en_cifras` publica lo que la pantalla ARMA con esas cifras: lee la misma lectura que la ruta,
// `lecturaDeConversation`, con la misma ventana y el mismo «audita», y devuelve su `pantalla` entera —lo que el
// cerebro dice de una cifra es lo que se dibuja (CN1-16 de `docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`)—.
// No lleva nada de una persona: son conteos, tasas y claves.

import { laPantallaDelTecnico, TOPE_DE_CASOS } from '../../../auditor/pantalla.ts';
import { sentimientoPorFlujo } from '../../../auditor/sentimiento.ts';
import { indicadoresDelLead } from '../../../negocio/indicadoresDelLead.ts';
import { atribucionDelLead, type FilaDeAtribucion } from '../../../negocio/atribucionDelLead.ts';
import { consumoDelPrecall } from '../../../negocio/consumoDelPrecall.ts';
import { lecturaDeConversation } from '../../../negocio/lecturaDeConversation.ts';
import { ARGUMENTO_PERIODO, SIN_ARGUMENTOS, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

/* El cliente viaja sólo cuando la campaña es de uno entre varios (el nivel 3): con un cliente, las cinco claves de siempre
   (la 213 las mira con `Object.keys`, que ve también una clave con `undefined`). */
const fila = (f: FilaDeAtribucion) => ({
  ...tomar(f, ['etiqueta', 'cohorte', 'agendaron', 'tasa', 'esElResto'] as const),
  ...(f.cliente === undefined ? {} : { cliente: f.cliente }),
});

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
      'y los que no recibieron ningún mensaje. Con sus avisos. «respondieron» cuenta si el CONTACTO contestó: el ' +
      'sistema no distingue un mensaje del agente de uno de un flujo del CRM, así que no es el rendimiento del agente.',
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
      '(tasas nulas bajo el piso), y cuántos entraron fuera de horario. Con campañas de más de un cliente, cada fila ' +
      'de campaña dice de qué cliente es (cliente).',
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
  {
    nombre: 'conversation_en_cifras',
    descripcion:
      'Conversation: las cifras que la pantalla dibuja, como las dibuja. `paneles`: los contactos de la ventana y ' +
      'cuántos agendaron, las citas y cuántas asistieron, y de qué ICP es el grupo que agendó (alto, medio, bajo, sin ' +
      'calificar; porciones sobre todos los que agendaron). `leadFlow` y `appointmentFlow`: el KPI de cada flujo y su ' +
      'cadena paso a paso; en Appointment Flow, además, las salidas antes de la llamada (reprogramaron, cancelaron), ' +
      'la asistencia por tramo de ICP y si los que agendaron conversaron antes. «Confirmaron» cuenta CONTACTOS con ' +
      'cita en la ventana, descartados incluidos, y su porción es sobre los que respondieron el campo del CRM: puede ' +
      'no cuadrar con las citas. `agentes`: las cuatro tarjetas (Lead Flow y Appointment Flow, texto y voz), con ' +
      'cifras del flujo y no del agente, y su sentimiento. `porCorregir`: los patrones abiertos del auditor. ' +
      '`cifras`: la primera respuesta del contacto (p50 en minutos) y, como porciones, los primeros mensajes que ' +
      'salieron fuera del horario del contacto (8 a 21 en su zona, sobre los escritos con zona), los contactos con ' +
      'cita que registraron haber visto el precall (sobre los que tienen el campo clasificado) y las conversaciones ' +
      'molestas de los dos flujos juntos. Las tasas y porciones son fracciones de 0 a 1. Una cifra sin valor trae su ' +
      'motivo: `sin_contactos`, `sin_citas`, `sin_asistencia` (nadie marca la asistencia), `bajo_el_piso` (menos de ' +
      '10 casos), `sin_enlace` (la landing no tiene enlace de seguimiento), `sin_llamadas` (los agentes de voz no ' +
      'registran llamadas), `sin_analisis` (el auditor no juzgó conversaciones en la ventana), `no_audita` (la ' +
      'empresa no audita sus agentes), `sin_campo` (el CRM no registra ese dato: la confirmación, el precall o la zona ' +
      'horaria), `sin_agendados` (nadie agendó), `sin_escritos` (a nadie se le escribió) o `sin_respuestas` (nadie ' +
      'contestó).',
    secciones: ['conversation'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos, contexto) {
      const l = await lecturaDeConversation(periodoPedido(argumentos)!.dias, contexto.deLaRuta.noAudita === null);
      return l.pantalla;
    },
  },
];
