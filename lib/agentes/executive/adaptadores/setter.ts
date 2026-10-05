// Las herramientas del Setter del cerebro, con las mismas funciones y los mismos argumentos que
// `app/api/setter/mi-dia/route.ts` y `app/api/setter/pipeline/route.ts`.
//
// Las filas de las colas y del pipeline son contactos con su nombre, su teléfono, su correo y sus mensajes:
// **viajan sólo los conteos**. El inicio y la comisión son de quien pregunta, como en la pantalla: el setter
// es multi-persona y nadie ve los números de otro.

import { colasDelSetter } from '../../../negocio/miDiaDelSetter.ts';
import { cockpitDelSetter } from '../../../negocio/inicioDelSetter.ts';
import { comisionDelSetter } from '../../../negocio/comisionDelSetter.ts';
import type { ComisionDelMes } from '../../../negocio/comision.ts';
import { pipelineDe, type Pipeline } from '../../../negocio/pipeline.ts';
import { SIN_ARGUMENTOS, type DefinicionDeHerramienta, cuantos, tomar } from './comun.ts';

/** Las claves de una comisión: lo mismo para el setter (dos tramos) y para el closer (uno). */
export const CLAVES_DE_LA_COMISION = ['porcentaje', 'meta', 'valor', 'falta', 'ventas', 'base', 'faltaParaLaMeta', 'metaSuperada'] as const;
export const comision = (c: ComisionDelMes) => tomar(c, CLAVES_DE_LA_COMISION);

/** Un pipeline sin sus filas: cuántos hay en cada etapa. */
export function columnas(p: Pipeline) {
  return {
    ...tomar(p, ['total', 'hayMas', 'clasificados', 'cartera'] as const),
    columnas: p.columnas.map((c) => tomar(c, ['clave', 'nombre', 'cuantos'] as const)),
  };
}

const COLAS_DEL_SETTER = ['urgentes', 'estancadas', 'oportunidades', 'buzon', 'seguimientos', 'completadas'] as const;

export const HERRAMIENTAS_DEL_SETTER: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'colas_del_setter',
    descripcion:
      'Setter › Mi día: cuántos contactos hay hoy en cada cola (urgentes, estancadas, oportunidades, buzón, ' +
      'seguimientos, completadas) y las tareas pendientes. Es el territorio entero del setter, como la pantalla. ' +
      'Sólo conteos: no trae los contactos.',
    secciones: ['setter'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const c = await colasDelSetter(contexto.zona);
      return { colas: cuantos(c, COLAS_DEL_SETTER), ...tomar(c, ['tareasPendientes', 'truncado'] as const) };
    },
  },
  {
    nombre: 'inicio_del_setter',
    descripcion:
      'Setter › Inicio: los números del MES CALENDARIO de quien pregunta (vendido chico, ventas chicas, agendas, ' +
      'agendas del agente, descalificados, a nurture, asistencia, tareas pendientes) y su comisión directa y ' +
      'diferida. Sólo lo propio: no trae los de otro setter.',
    secciones: ['setter'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      // Como la ruta: el contador se le pasa al cockpit, no se recalcula.
      const colas = await colasDelSetter(contexto.zona);
      const cockpit = await cockpitDelSetter(contexto.zona, colas.tareasPendientes, contexto.usuarioId);
      const c = await comisionDelSetter(contexto.usuarioId, contexto.zona);
      return {
        ...tomar(cockpit, [
          'mes', 'vendidoChico', 'ventasChicas', 'agendas', 'agendasDelAgente', 'descalificados', 'aNurture', 'tasaDeAsistencia',
          'tareasPendientes',
        ] as const),
        comision: { directo: comision(c.directo), diferido: comision(c.diferido), leadsAtribuidos: c.leadsAtribuidos },
      };
    },
  },
  {
    nombre: 'pipeline_del_setter',
    descripcion: 'Setter › Pipeline: cuántos contactos hay en cada etapa del embudo del setter, sin los congelados.',
    secciones: ['setter'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar() {
      return columnas(await pipelineDe('setter', { conCongelados: false }));
    },
  },
];
