// Las herramientas de Creative del cerebro: calidad, rendimiento y fatiga de las piezas, con las mismas
// funciones y la misma ventana que `app/api/creative/route.ts`. Todo es de las piezas, no de personas: el
// nombre de una pieza es el del creativo, y los enlaces manuales de la pantalla no viajan.

import { calidadDelCreativo } from '../../../negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo, type TasaDeAccion } from '../../../negocio/rendimientoDelCreativo.ts';
import { CAIDA_QUE_PREOCUPA, fatigaDelCreativo } from '../../../negocio/fatigaDelCreativo.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

const CLAVES_DE_LA_TASA = ['cantidad', 'tasa', 'anuncioDiasConLaClave', 'anuncioDiasConEntrega'] as const;
const tasa = (t: TasaDeAccion) => tomar(t, CLAVES_DE_LA_TASA);

export const HERRAMIENTAS_DE_CREATIVE: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'calidad_de_piezas',
    descripcion:
      'Creative: por pieza, contactos, cuántos traen puntaje de ICP, el ICP promedio, cuántos agendaron y la tasa ' +
      'de agenda (nula bajo el piso). Dice cuántos contactos no se pudieron cruzar con una pieza, y si falta el ' +
      'campo del ICP.',
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const c = await calidadDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(c.filas);
      return {
        ...tomar(c, ['dias', 'desde', 'hasta', 'congeladas', 'puente', 'campoDeIcp', 'aviso'] as const),
        piezas: {
          filas: filas.filas.map((f) =>
            tomar(f, ['creativo', 'etapa', 'contactos', 'conPuntaje', 'icpPromedio', 'agendaron', 'tasaDeAgenda', 'anunciosDeMeta'] as const),
          ),
          total: filas.total,
        },
      };
    },
  },
  {
    nombre: 'rendimiento_de_piezas',
    descripcion:
      'Creative: por pieza, gasto, impresiones, clics, CPM, CPC, CTR, días con entrega, hook rate, link CTR y las ' +
      'demás tasas del desglose de Meta, cada una con los anuncio-día que la respaldan. Dice lo que esta vía no ' +
      'puede dar y desde cuándo hay desglose.',
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await rendimientoDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(r.filas);
      return {
        ...tomar(r, ['dias', 'desde', 'hasta', 'desdeElDesglose', 'gastoTotal', 'fueraDeAlcance', 'aviso'] as const),
        piezas: {
          filas: filas.filas.map((f) => ({
            ...tomar(f, ['creativo', 'anuncios', 'gasto', 'impresiones', 'clics', 'cpm', 'cpc', 'ctr', 'diasConEntrega'] as const),
            hookRate: tasa(f.hookRate),
            linkCtr: tasa(f.linkCtr),
            landingPageViewRate: tasa(f.landingPageViewRate),
            clickToLanding: tasa(f.clickToLanding),
            interaccion: tasa(f.interaccion),
          })),
          total: filas.total,
        },
      };
    },
  },
  {
    nombre: 'fatiga_de_piezas',
    descripcion:
      'Creative: por pieza, el CTR de la primera y de la segunda mitad de su entrega y la caída. «fatigado» nulo es ' +
      '«no se puede decir», con el motivo. El umbral de la caída es provisional, no calibrado.',
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const f = await fatigaDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(f.filas);
      return {
        ...tomar(f, ['dias', 'conVeredicto', 'aviso'] as const),
        umbralDeCaida: CAIDA_QUE_PREOCUPA,
        nota: 'El umbral de la caída es provisional: no está calibrado contra resultados.',
        piezas: {
          filas: filas.filas.map((p) =>
            tomar(p, ['creativo', 'dias', 'desde', 'hasta', 'ctrTemprano', 'ctrTardio', 'caida', 'fatigado', 'motivo', 'porque'] as const),
          ),
          total: filas.total,
        },
      };
    },
  },
];
