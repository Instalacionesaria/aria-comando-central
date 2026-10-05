// La herramienta de ICP & Oferta del cerebro: en qué paso del método está la empresa y extractos acotados
// de su ICP y de su oferta. Lee el mismo estado que `app/api/fundaciones/estado/route.ts` (`leerEstado`) y
// decide «completo» con la misma regla que la pantalla (`pasoCompleto`).
//
// Lo que no viaja: la ficha del negocio (sus respuestas y el onboarding traen el teléfono y los datos de
// quien la llenó), las conversaciones con el entrevistador y los documentos enteros. De ICP y Oferta viaja
// el principio de la última versión, sin datos de contacto.

import { leerEstado } from '../../../fundaciones/almacen.ts';
import { pasoCompleto, ultimaVersion } from '../../../fundaciones/estado.ts';
import { FUNDACIONES } from '../../../fundaciones/herramientas.ts';
import { organizacionActual } from '../../../datos/contexto.ts';
import { SIN_ARGUMENTOS, type DefinicionDeHerramienta, sinDatosDeContacto } from './comun.ts';

/** Cuánto de cada documento viaja: el principio, donde está el resumen. */
export const LARGO_DEL_EXTRACTO = 1500;

/** De qué pasos viaja un extracto: los que contestan «a quién le vendo y qué». */
const CON_EXTRACTO: Readonly<Record<number, string>> = { 3: 'icp', 4: 'oferta' };

export const HERRAMIENTAS_DE_FUNDACIONES: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'fundaciones',
    descripcion:
      'ICP & Oferta: los pasos del método en orden (ficha, research, ICP, categoría, oferta, precio, mapa), cuáles ' +
      'están completos, cuántas versiones tiene cada uno y cuál sigue; y el principio de la última versión del ICP ' +
      'y de la oferta. No depende del período.',
    secciones: ['icp'],
    esquema: SIN_ARGUMENTOS,
    async ejecutar() {
      const r = await leerEstado(organizacionActual());
      if (r.tipo !== 'datos') throw new Error(`fundaciones: el almacén no respondió (${r.tipo})`);
      const estado = r.datos;
      const pasos = FUNDACIONES.map((h) => ({
        id: h.id,
        clave: h.clave,
        paso: h.pestania,
        completo: pasoCompleto(estado, h.id),
        versiones: estado.historial[h.id]?.length ?? 0,
        ultimaEl: estado.historial[h.id]?.[0]?.date ?? null,
      }));
      const siguiente = pasos.find((p) => !p.completo);
      const extractos = Object.fromEntries(
        Object.entries(CON_EXTRACTO).map(([id, clave]) => {
          const texto = ultimaVersion(estado, Number(id));
          return [clave, texto === null ? null : sinDatosDeContacto(texto, LARGO_DEL_EXTRACTO)];
        }),
      );
      return {
        pasos,
        siguiente: siguiente ? { clave: siguiente.clave, paso: siguiente.paso } : null,
        researchHechos: estado.researchSalidas.filter((s) => !!s).length,
        extractos,
      };
    },
  },
];
