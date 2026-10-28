// Las herramientas de Creative del cerebro: calidad, rendimiento y fatiga de las piezas, con las mismas
// funciones y la misma ventana que `app/api/creative/route.ts`. Todo es de las piezas, no de personas: el
// nombre de una pieza es el del creativo, y los enlaces manuales de la pantalla no viajan.
//
// `creative_en_cifras` publica lo que la pantalla ARMA: lee la misma lectura que la ruta, `lecturaDeCreative`, y
// devuelve su `pantalla` —lo que el cerebro dice de una cifra es lo que se dibuja (CF1-16 de
// `docs/2-departamentos/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`)— SIN las URLs: ni la miniatura ni el enlace de cada pieza
// viajan, sólo si la pieza tiene una.
//
// La pieza es (cliente, nombre) (el nivel 3), y el cerebro NUNCA lee un uuid: con piezas de dos clientes o más, cada
// una dice su cliente por su nombre, y la clave de la pantalla —que lleva el id del cliente en las que no son del
// principal— viaja como su rótulo, «nombre · cliente». Con un cliente, todo como siempre.

import { calidadDelCreativo } from '../../../negocio/calidadDelCreativo.ts';
import { clientesDeCreative } from '../../../negocio/creativo.ts';
import { nombreDeLaPieza, rotuloDeLaPieza } from '../../../negocio/idDeLaPieza.ts';
import { rendimientoDelCreativo, type TasaDeAccion } from '../../../negocio/rendimientoDelCreativo.ts';
import { CAIDA_QUE_PREOCUPA, fatigaDelCreativo } from '../../../negocio/fatigaDelCreativo.ts';
import { lecturaDeCreative, type PantallaDeCreativeArmada } from '../../../negocio/lecturaDeCreative.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

/**
 * La pantalla sin las URLs de cada pieza: el cerebro sabe si hay miniatura o enlace, no cuál es. Campo por campo, por
 * lista blanca (AG-45): un campo nuevo de la pieza o de su ficha no viaja hasta que alguien lo agregue acá.
 *
 * Y sin uuids (el nivel 3): la `clave` y las listas de cada criterio van con el rótulo de la pieza; su `nombre` y su
 * `cliente`, sólo cuando la pieza tiene cliente que decir —con piezas de dos clientes o más—. `cuentaId` no viaja.
 */
export function pantallaParaElCerebro(p: PantallaDeCreativeArmada) {
  const rotulo = new Map(p.piezas.map((x) => [x.clave, rotuloDeLaPieza(x.nombre, x.cliente)]));
  const decir = (claves: readonly string[]) => claves.map((k) => rotulo.get(k) ?? nombreDeLaPieza(k));
  const criterios = Object.fromEntries(
    Object.entries(p.criterios).map(([criterio, g]) => [
      criterio,
      {
        funciona: decir(g.funciona),
        noFunciona: decir(g.noFunciona),
        promedioPorEtapa: g.promedioPorEtapa,
        unicas: decir(g.unicas),
        ...(g.promediosPorCliente
          ? { promediosPorCliente: g.promediosPorCliente.map((c) => ({ cliente: c.cliente, promedioPorEtapa: c.promedioPorEtapa })) }
          : {}),
      },
    ]),
  );
  return {
    cifras: p.cifras,
    criterios,
    loDemas: p.loDemas,
    piezas: p.piezas.map((x) => ({
      clave: rotulo.get(x.clave)!,
      ...(x.cliente === null ? {} : { nombre: x.nombre, cliente: x.cliente }),
      etapa: x.etapa,
      estado: x.estado,
      cifras: x.cifras,
      perdiendoGancho: x.perdiendoGancho,
      conMiniatura: x.miniatura !== null,
      conEnlace: x.enlace !== null,
      ficha: tomar(x.ficha, ['anuncios', 'primerDia', 'ultimoDia', 'gasto', 'ctr', 'linkCtr', 'landing', 'clickToLanding', 'anunciosDeLaPieza'] as const),
    })),
  };
}

const CLAVES_DE_LA_TASA = ['cantidad', 'tasa', 'anuncioDiasConLaClave', 'anuncioDiasConEntrega'] as const;
const tasa = (t: TasaDeAccion) => tomar(t, CLAVES_DE_LA_TASA);

/**
 * El cliente de cada fila, por su nombre, cuando las filas son de dos clientes o más (el nivel 3): dos piezas con el
 * mismo nombre en dos clientes son dos filas con el mismo `creativo`, y sin él no se distinguen. Con un cliente, nada:
 * la fila es la de siempre. Nunca el uuid.
 */
async function suCliente(filas: readonly { cuentaId: string }[]): Promise<(f: { cuentaId: string }) => { cliente?: string | null }> {
  if (new Set(filas.map((f) => f.cuentaId)).size < 2) return () => ({});
  const { nombres } = await clientesDeCreative();
  return (f) => ({ cliente: nombres.get(f.cuentaId) ?? null });
}

/** Lo que dicen las tres herramientas de filas cuando hay más de un cliente. */
const CON_VARIOS_CLIENTES =
  ' Con piezas de más de un cliente, cada fila dice de cuál es (`cliente`): dos piezas con el mismo nombre en dos clientes son dos piezas.';

export const HERRAMIENTAS_DE_CREATIVE: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'calidad_de_piezas',
    descripcion:
      'Creative: por pieza, contactos, cuántos tienen cuadrante del ICP (clasificados), cuántos son calificados ' +
      '(Prioriza, Valida o Financia), cuántos están en Descarta y su porción sobre los clasificados (nula bajo el ' +
      'piso), cuántos agendaron y la tasa de agenda (nula bajo el piso). El ICP no es un número: no hay promedio. ' +
      'Dice cuántos contactos no se pudieron cruzar con una pieza, y si falta el campo del cuadrante.' +
      CON_VARIOS_CLIENTES,
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const c = await calidadDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(c.filas);
      const cliente = await suCliente(c.filas);
      return {
        ...tomar(c, ['dias', 'desde', 'hasta', 'congeladas', 'puente', 'campoDelCuadrante', 'aviso'] as const),
        piezas: {
          filas: filas.filas.map((f) => ({
            ...tomar(f, ['creativo', 'etapa', 'contactos', 'clasificados', 'calificados', 'descarta', 'porcionDeDescarta', 'agendaron', 'tasaDeAgenda', 'anunciosDeMeta'] as const),
            ...cliente(f),
          })),
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
      'puede dar y desde cuándo hay desglose.' +
      CON_VARIOS_CLIENTES,
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await rendimientoDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(r.filas);
      const cliente = await suCliente(r.filas);
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
            ...cliente(f),
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
      '«no se puede decir», con el motivo. El umbral de la caída es provisional, no calibrado.' +
      CON_VARIOS_CLIENTES,
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const f = await fatigaDelCreativo(periodoPedido(argumentos)!.dias);
      const filas = primeras(f.filas);
      const cliente = await suCliente(f.filas);
      return {
        ...tomar(f, ['dias', 'conVeredicto', 'aviso'] as const),
        umbralDeCaida: CAIDA_QUE_PREOCUPA,
        nota: 'El umbral de la caída es provisional: no está calibrado contra resultados.',
        piezas: {
          filas: filas.filas.map((p) => ({
            ...tomar(p, ['creativo', 'dias', 'desde', 'hasta', 'ctrTemprano', 'ctrTardio', 'caida', 'fatigado', 'motivo', 'porque'] as const),
            ...cliente(p),
          })),
          total: filas.total,
        },
      };
    },
  },
  {
    nombre: 'creative_en_cifras',
    descripcion:
      'Creative: las cifras que la pantalla dibuja, como las dibuja. `cifras`: Calificados (contactos en Prioriza, ' +
      'Valida o Financia, el cuadrante del ICP que manda el CRM), Agendas, Hook rate (vistas de video sobre impresiones de los anuncio-día que las reportan), Retención (sin fuente), ' +
      'Impresiones y Frecuencia, de toda la ventana. `piezas`: cada pieza con su etapa (la de la campaña con más ' +
      'impresiones; si esa campaña no la dice, la de sus contactos; si no, sin etapa), si entregó en los últimos 3 días, las mismas seis cifras, si perdió gancho (fatiga), si tiene ' +
      'miniatura o enlace, y su ficha: anuncios, primer y último día con entrega, gasto, CTR, link CTR, landing y ' +
      'click-to-landing. `criterios`: para Calificados, Agendas, Hook rate e Impresiones, qué piezas «funcionan» —llegan ' +
      'al promedio de SU etapa— y cuáles no, el promedio de cada etapa y las piezas únicas de su etapa. `loDemas`: gasto, ' +
      'CTR, link CTR, landing y piezas perdiendo gancho. Las tasas son fracciones de 0 a 1. Una cifra sin valor trae su ' +
      'motivo: `sin_contactos`, `sin_clasificacion` (el CRM no tiene el campo del cuadrante del ICP), `sin_entrega` (sin impresiones en la ' +
      'ventana), `bajo_el_piso` (menos de 10 clics al enlace), `pocas_impresiones` (menos de 1000), `sin_reporte` ' +
      '(GoHighLevel no reportó esa acción para la pieza en ningún día de la ventana, o el gasto de días con impresiones) o ' +
      '`sin_fuente` (la retención, que GoHighLevel no entrega). Entran sólo las piezas que en la ventana trajeron contactos, ' +
      'tuvieron impresiones o gastaron; «si entregó» son los últimos 3 días del calendario, hoy incluido. Con piezas de más ' +
      'de un cliente, cada pieza trae su `nombre` y su `cliente`, su `clave` es «nombre · cliente» (así la nombran los ' +
      'criterios), y cada una se compara con las de su etapa EN SU CLIENTE: `promediosPorCliente` trae esos promedios y ' +
      '`promedioPorEtapa` queda como el de todas.',
    secciones: ['creative'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const l = await lecturaDeCreative(periodoPedido(argumentos)!.dias);
      return pantallaParaElCerebro(l.pantalla);
    },
  },
];
