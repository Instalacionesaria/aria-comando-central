// Las herramientas del Closer del cerebro, con las mismas funciones y los mismos argumentos que
// `app/api/closer/mi-dia/route.ts`, `app/api/closer/agenda/route.ts` y `app/api/closer/pipeline/route.ts`,
// sin el selector «ver como»: el cerebro mira lo que ve quien pregunta al abrir la pantalla.
//
// El alcance sale de `alcanceDeQuienMira`, el único lugar donde se decide: un closer vinculado al CRM ve lo
// suyo, y cualquier otra persona —quien administra, o un closer todavía sin vincular— ve la empresa. De las colas y del pipeline viajan **sólo los conteos**; de la
// agenda, las horas y el estado de cada cita, sin el contacto, su teléfono, el título ni la sala.

import { agendaDelCloser, DIAS_DE_LA_AGENDA } from '../../../negocio/agenda.ts';
import { alcanceDeQuienMira } from '../../../negocio/alcanceDelCloser.ts';
import { comisionDelMes } from '../../../negocio/comision.ts';
import { cockpitDelMes } from '../../../negocio/inicio.ts';
import { colasDelDia } from '../../../negocio/miDia.ts';
import { pipelineDe } from '../../../negocio/pipeline.ts';
import { SIN_ARGUMENTOS, type DefinicionDeHerramienta, cuantos, primeras, tomar } from './comun.ts';
import { columnas, comision } from './setter.ts';

const COLAS_DEL_CLOSER = ['urgentes', 'agenda', 'buzon', 'seguimientos', 'completadas'] as const;

/** De quién son los números: «empresa» o «propio». Los nombres de los closers no hacen falta acá. */
const deQuien = (tipo: 'todo' | 'mio') => (tipo === 'todo' ? 'empresa' : 'propio');

export const HERRAMIENTAS_DEL_CLOSER: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'mi_dia_del_closer',
    descripcion:
      'Closer › Mi día: cuántos contactos hay hoy en cada cola (urgentes, agenda, buzón, seguimientos, completadas) ' +
      'y las tareas pendientes. Lo propio si quien pregunta es un closer vinculado al CRM; si no, la empresa. ' +
      'Sólo conteos: no trae los contactos.',
    secciones: ['closer'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const { alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
      const c = await colasDelDia(contexto.zona, alcance);
      return { de: deQuien(alcance.tipo), colas: cuantos(c, COLAS_DEL_CLOSER), ...tomar(c, ['tareasPendientes', 'truncado'] as const) };
    },
  },
  {
    nombre: 'inicio_del_closer',
    descripcion:
      'Closer › Inicio: los números del MES CALENDARIO (cobrado, ventas, acuerdos, citas agendadas, asistencia, ' +
      'no-shows, tareas pendientes) y la comisión. De quien pregunta si es un closer vinculado; si no, de todos los ' +
      'closers juntos, y entonces sin comisión, que es de una persona. Venta reportada, no un pago verificado.',
    secciones: ['closer'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const { closers, alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
      const colas = await colasDelDia(contexto.zona, alcance);
      // El mismo sujeto que arma la ruta, de las mismas dos piezas.
      const sujeto =
        closers.length === 0
          ? ({ tipo: 'nadie' } as const)
          : alcance.tipo === 'todo'
            ? ({ tipo: 'empresa', usuarioIds: closers.map((k) => k.usuarioId) } as const)
            : ({
                tipo: 'persona',
                usuarioId: closers.find((k) => k.crmUsuarioId === alcance.crmUsuarioId)?.usuarioId ?? '',
                crmUsuarioId: alcance.crmUsuarioId,
              } as const);
      const cockpit = await cockpitDelMes(contexto.zona, colas.tareasPendientes, sujeto);
      const c = sujeto.tipo === 'persona' && sujeto.usuarioId !== '' ? await comisionDelMes(sujeto.usuarioId, contexto.zona) : null;
      return {
        de: sujeto.tipo === 'nadie' ? 'nadie' : deQuien(alcance.tipo),
        ...tomar(cockpit, ['mes', 'cobrado', 'ventas', 'acuerdos', 'conCitaAgendada', 'tasaDeAsistencia', 'noShows', 'tareasPendientes'] as const),
        comision: c === null ? null : comision(c),
        nota: 'Mes calendario en curso. Venta reportada por el closer, no un pago verificado.',
      };
    },
  },
  {
    nombre: 'agenda_del_closer',
    descripcion:
      `Closer › Agenda: las citas de hoy y de los próximos días (${DIAS_DE_LA_AGENDA} días, como la pantalla), sin las ` +
      'canceladas: por día, cuántas hay y la hora y el estado de cada una. No trae el contacto ni la sala. Dice si ' +
      'la lectura del calendario está atrasada.',
    secciones: ['closer'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const { alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
      const a = await agendaDelCloser('closer', contexto.zona, { dias: DIAS_DE_LA_AGENDA, alcance });
      return {
        de: deQuien(alcance.tipo),
        ...tomar(a, ['hoy', 'hasta', 'total', 'zonaHoraria', 'avisoDeZona'] as const),
        frescura: tomar(a.frescura, ['estado', 'minutos', 'umbralMinutos', 'aviso'] as const),
        dias: a.dias.map((d) => {
          const citas = primeras(d.citas);
          return {
            dia: d.dia,
            citas: {
              filas: citas.filas.map((c) => tomar(c, ['inicioEl', 'finEl', 'termino', 'estado', 'vencida', 'cancelada'] as const)),
              total: citas.total,
            },
          };
        }),
      };
    },
  },
  {
    nombre: 'pipeline_del_closer',
    descripcion:
      'Closer › Pipeline: cuántos contactos hay en cada etapa del embudo del closer, con los congelados. Lo propio ' +
      'si quien pregunta es un closer vinculado; si no, la empresa.',
    secciones: ['closer'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const { alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
      return { de: deQuien(alcance.tipo), ...columnas(await pipelineDe('closer', { conCongelados: true, alcance })) };
    },
  },
];
