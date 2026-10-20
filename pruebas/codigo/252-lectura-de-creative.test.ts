// La mitad pura de la lectura de Creative: la tira, las piezas, los grupos por criterio y la fila de abajo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF-1)
//
// `armarCreative` decide qué número va en cada lugar del prototipo y, cuando no hay número, por qué. Los datos son
// asimétricos a propósito: cruzar dos cifras, dos bases o dos piezas cambia el resultado. Cada prueba dice qué mira y
// la mutación que la pone en rojo:
//
//   · la tira suma las piezas y pesa las tasas —mutación: promediar los promedios—;
//   · cada tasa lleva el piso de 1000 impresiones, y una acción que nunca se reportó no es un cero —mutación: sacar
//     el piso, o publicar cero—;
//   · «Calificados» es el ICP alto, y sin el campo del ICP dice por qué —mutación: contar todos los contactos—;
//   · la etapa de la pieza es la de sus anuncios, y la de sus contactos sólo de respaldo —mutación: al revés—;
//   · «Funciona» es contra el promedio de SU etapa, pesado en las tasas —mutación: contra el promedio de todas—;
//   · la única de su etapa va a «Funciona» y se marca —mutación: mandarla a «No funciona»—;
//   · la tarjeta: estado, miniatura, enlace manual primero, fatiga —mutación: preferir la miniatura al enlace—;
//   · la miniatura y el post de Meta antes que los de los contactos (M-3 del 2026-10-15) —mutación: al revés—;
//   · la fila de abajo —mutación: el CTR sobre otra base, o las piezas perdiendo gancho sobre todas—;
//   · sólo entran las piezas que hicieron algo en la ventana —mutación: listar todas las de la historia— (CF-4);
//   · la ficha de la pieza, cifra por cifra —mutación: cruzar dos—.
//
// La revisión de CF-4 encontró que casi todas las cifras de la ficha y los respaldos podían cambiar sin que nada se
// pusiera en rojo: las pruebas de abajo del todo los fijan.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { pantallaParaElCerebro } from '../../lib/agentes/executive/adaptadores/creative.ts';
import type { CalidadDeLosCreativos, FilaDeCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import type { FatigaDeLosCreativos } from '../../lib/negocio/fatigaDelCreativo.ts';
import type { FilaDeRendimiento, RendimientoDeLosCreativos } from '../../lib/negocio/rendimientoDelCreativo.ts';
import type { EnlaceDePieza } from '../../lib/negocio/enlaceDeLaPieza.ts';
import { armarCreative, type EntregaDeLaPieza, type EntradaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';

const TOFU = 'TOFU' as const;
const MOFU = 'MOFU' as const;
const BOFU = 'BOFU' as const;

/** El cliente de todas las filas: una empresa con un solo cliente, su principal (el nivel 3). */
const P = 'P';

const calidad = (f: Partial<FilaDeCreativo> & { creativo: string | null }): FilaDeCreativo => ({
  cuentaId: P, etapa: null, contactos: 0, conPuntaje: 0, icpPromedio: null, calificados: 0, agendaron: 0, tasaDeAgenda: null, anunciosDeMeta: 0, ...f,
});

const rend = (f: Partial<FilaDeRendimiento> & { creativo: string }): FilaDeRendimiento =>
  ({
    cuentaId: P, anuncios: 1, gasto: 100, impresiones: 0, clics: 0, cpm: null, cpc: null, ctr: null, diasConEntrega: 1,
    hookRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    linkCtr: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    landingPageViewRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    clickToLanding: { cantidad: 30, tasa: 75, anuncioDiasConLaClave: 2, anuncioDiasConEntrega: 2 },
    interaccion: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    anunciosDeLaPieza: [{ anuncioId: '111', campanaId: '9', impresiones: 10, gasto: 1 }],
    ...f,
  }) as FilaDeRendimiento;

/** Sin decirlo, las impresiones con frecuencia son todas las de la pieza si trae frecuencia, y ninguna si no. */
const entrega = (f: Partial<EntregaDeLaPieza> & { pieza: string }): EntregaDeLaPieza => ({
  cuentaId: P, impresiones: 0, clics: 0, vistas: null, clicsAlEnlace: null, landing: null, frecuencia: null, etapa: null,
  primerDia: '2026-09-01', ultimoDia: '2026-10-05', entregando: false,
  impresionesConFrecuencia: f.frecuencia === null || f.frecuencia === undefined ? 0 : (f.impresiones ?? 0),
  ...f,
});

/**
 * Cuatro piezas: dos TOFU (a, b) y una BOFU (c) con anuncios, y una (d) sólo con contactos.
 * a: 4000 impresiones, 800 vistas → 20 %; b: 2000 impresiones, 200 vistas → 10 %; c: 10000 impresiones, 3000 vistas
 * → 30 %. El promedio pesado de TOFU es 1000/6000 = 16,7 %: a funciona, b no. Con un solo promedio de todas
 * (4000/16000 = 25 %) a no llegaría.
 */
function entrada(o: Partial<EntradaDeCreative> & { campoDeIcp?: string | null } = {}): EntradaDeCreative {
  return {
    calidad: {
      dias: 30, desde: null, hasta: null, congeladas: 0, puente: { con: 0, sobre: 0, sinNombre: 0 }, aviso: null,
      campoDeIcp: o.campoDeIcp === undefined ? 'campo' : o.campoDeIcp,
      filas: [
        // «a» trajo más contactos de BOFU, pero sus anuncios son TOFU: la etapa es la de los anuncios.
        calidad({ creativo: 'a', etapa: TOFU, contactos: 5, calificados: 1, agendaron: 2 }),
        calidad({ creativo: 'a', etapa: BOFU, contactos: 20, calificados: 7, agendaron: 9 }),
        calidad({ creativo: 'b', etapa: TOFU, contactos: 12, calificados: 2, agendaron: 3 }),
        calidad({ creativo: 'c', etapa: BOFU, contactos: 6, calificados: 5, agendaron: 4 }),
        calidad({ creativo: 'd', etapa: BOFU, contactos: 3, calificados: 0, agendaron: 1 }),
        calidad({ creativo: null, contactos: 40, calificados: 10, agendaron: 20 }),
      ],
    } as unknown as CalidadDeLosCreativos,
    rendimiento: {
      dias: 30, desde: null, hasta: null, desdeElDesglose: null, fueraDeAlcance: [], titulos: {}, aviso: null,
      gastoTotal: 1234.5,
      filas: [
        rend({ creativo: 'a', anuncios: 2, gasto: 400, impresiones: 4000, clics: 80 }),
        rend({ creativo: 'b', anuncios: 1, gasto: 300, impresiones: 2000, clics: 10, clickToLanding: { cantidad: 2, tasa: null, anuncioDiasConLaClave: 1, anuncioDiasConEntrega: 1 } }),
        rend({ creativo: 'c', anuncios: 3, gasto: 534.5, impresiones: 10000, clics: 300 }),
      ],
    } as unknown as RendimientoDeLosCreativos,
    fatiga: {
      dias: 30, aviso: null, conVeredicto: { con: 2, sobre: 3 },
      filas: [
        { creativo: 'a', cuentaId: P, fatigado: true },
        { creativo: 'c', cuentaId: P, fatigado: false },
        { creativo: 'b', cuentaId: P, fatigado: null },
      ],
    } as unknown as FatigaDeLosCreativos,
    entrega: [
      // «a» trae frecuencia sólo en 1000 de sus 4000 impresiones: ése es su peso en la frecuencia de la tira.
      entrega({ pieza: 'a', impresiones: 4000, clics: 80, vistas: { cantidad: 800, impresiones: 4000 }, clicsAlEnlace: { cantidad: 40, impresiones: 4000 }, frecuencia: 1.5, impresionesConFrecuencia: 1000, etapa: TOFU, entregando: true }),
      entrega({ pieza: 'b', impresiones: 2000, clics: 10, vistas: { cantidad: 200, impresiones: 2000 }, frecuencia: null, etapa: TOFU }),
      entrega({ pieza: 'c', impresiones: 10000, clics: 300, vistas: { cantidad: 3000, impresiones: 10000 }, clicsAlEnlace: { cantidad: 100, impresiones: 9000 }, landing: { cantidad: 60, impresiones: 9000 }, frecuencia: 2, etapa: BOFU, entregando: true }),
    ],
    miniaturas: new Map([['a', 'https://www.facebook.com/ads/image/?d=uno'], ['c', 'https://www.facebook.com/ads/image/?d=dos']]),
    activos: new Map(),
    enlaces: [{ cuentaId: P, pieza: 'c', url: 'https://www.instagram.com/p/xyz/', red: 'instagram', actualizadoEl: '2026-10-01' } as unknown as EnlaceDePieza],
    clientes: { principal: P, nombres: new Map([[P, 'Principal']]) },
    ...o,
  };
}

const pieza = (p: ReturnType<typeof armarCreative>, clave: string) => {
  const x = p.piezas.find((y) => y.clave === clave);
  assert.ok(x, `falta la pieza ${clave}`);
  return x;
};

test('la tira suma las piezas y pesa las tasas', () => {
  const p = armarCreative(entrada());
  // «Sin creativo» no es una pieza: no entra a la suma.
  assert.deepEqual(p.cifras.calificados, { valor: 15, motivo: null }, 'calificados: 7 + 1 + 2 + 5 + 0');
  assert.deepEqual(p.cifras.agendas, { valor: 19, motivo: null });
  assert.deepEqual(p.cifras.impresiones, { valor: 16000, motivo: null });
  assert.deepEqual(p.cifras.hookRate, { valor: 4000 / 16000, motivo: null }, 'el hook rate es pesado: no el promedio de 20, 10 y 30');
  // La frecuencia pesada sobre las impresiones de los días que la reportan: «b» no la trae, y «a» sólo en 1000.
  assert.deepEqual(p.cifras.frecuencia, { valor: (1.5 * 1000 + 2 * 10000) / 11000, motivo: null });
  assert.deepEqual(pieza(p, 'b').cifras.frecuencia, { valor: null, motivo: 'sin_reporte' }, 'con impresiones, no es «sin entrega»');
  assert.deepEqual(p.cifras.retencion, { valor: null, motivo: 'sin_fuente' });
});

test('cada tasa lleva el piso de 1000 impresiones, y una acción que nunca se reportó no es un cero', () => {
  const p = armarCreative(entrada({
    entrega: [entrega({ pieza: 'a', impresiones: 999, vistas: { cantidad: 300, impresiones: 999 }, etapa: TOFU })],
  }));
  assert.deepEqual(pieza(p, 'a').cifras.hookRate, { valor: null, motivo: 'pocas_impresiones' });
  assert.deepEqual(pieza(p, 'a').ficha.ctr, { valor: null, motivo: 'pocas_impresiones' });
  const q = armarCreative(entrada());
  assert.deepEqual(pieza(q, 'b').ficha.linkCtr, { valor: null, motivo: 'sin_reporte' }, 'sin linkClick no es un cero');
  assert.deepEqual(pieza(q, 'c').ficha.linkCtr, { valor: 100 / 9000, motivo: null }, 'la base es la de los días con la clave');
  assert.deepEqual(pieza(q, 'd').cifras.hookRate, { valor: null, motivo: 'sin_entrega' }, 'sin anuncios no hay entrega');
  assert.deepEqual(pieza(q, 'b').ficha.clickToLanding, { valor: null, motivo: 'bajo_el_piso' });
  assert.deepEqual(pieza(q, 'a').ficha.clickToLanding, { valor: 0.75, motivo: null }, 'el módulo lo publica en porcentaje');
});

test('«Calificados» es el ICP alto, y sin el campo del ICP dice por qué', () => {
  const p = armarCreative(entrada());
  assert.deepEqual(pieza(p, 'a').cifras.calificados, { valor: 8, motivo: null }, 'suma las dos etapas de sus contactos');
  assert.deepEqual(pieza(p, 'c').cifras.agendas, { valor: 4, motivo: null });
  const sin = armarCreative(entrada({ campoDeIcp: null }));
  assert.deepEqual(sin.cifras.calificados, { valor: null, motivo: 'sin_puntaje' });
  assert.deepEqual(pieza(sin, 'a').cifras.calificados, { valor: null, motivo: 'sin_puntaje' });
  assert.deepEqual(pieza(sin, 'a').cifras.agendas, { valor: 11, motivo: null }, 'las agendas no dependen del puntaje');
});

test('la etapa de la pieza es la de sus anuncios, y la de sus contactos sólo de respaldo', () => {
  const p = armarCreative(entrada());
  // «a» trajo más contactos de BOFU; sus anuncios son TOFU.
  assert.equal(pieza(p, 'a').etapa, 'TOFU');
  // «d» no tiene anuncios: la etapa con más contactos.
  assert.equal(pieza(p, 'd').etapa, 'BOFU');
  const sinEtapa = armarCreative(entrada({ entrega: [entrega({ pieza: 'z', impresiones: 5000 })] }));
  assert.equal(pieza(sinEtapa, 'z').etapa, 'sin_etapa');
});

test('«Funciona» es contra el promedio de SU etapa, pesado en las tasas', () => {
  const g = armarCreative(entrada()).criterios.hookRate;
  assert.deepEqual(g.promedioPorEtapa, { TOFU: 1000 / 6000, MOFU: null, BOFU: 3000 / 10000, sin_etapa: null });
  // a (20 %) llega al promedio TOFU (16,7 %); b (10 %) no. c es la única BOFU con valor. d no tiene valor.
  assert.deepEqual(g.funciona, ['c', 'a'], 'de mayor a menor');
  assert.deepEqual(g.noFunciona, ['b', 'd'], 'las sin valor, al final');
  assert.deepEqual(g.unicas, ['c']);
  // Los conteos, contra el promedio simple: TOFU calificados (8 + 2) / 2 = 5; BOFU (5 + 0) / 2 = 2,5.
  const c = armarCreative(entrada()).criterios.calificados;
  assert.deepEqual(c.promedioPorEtapa, { TOFU: 5, MOFU: null, BOFU: 2.5, sin_etapa: null });
  assert.deepEqual(c.funciona, ['a', 'c']);
  assert.deepEqual(c.noFunciona, ['b', 'd']);
  assert.deepEqual(c.unicas, []);
});

test('la tarjeta: el estado, la miniatura, el enlace manual primero y la fatiga', () => {
  const p = armarCreative(entrada());
  assert.equal(pieza(p, 'a').estado, 'entregando');
  assert.equal(pieza(p, 'b').estado, 'sin_entrega');
  assert.equal(pieza(p, 'a').miniatura, 'https://www.facebook.com/ads/image/?d=uno');
  assert.deepEqual(pieza(p, 'a').enlace, { url: 'https://www.facebook.com/ads/image/?d=uno', red: 'facebook' });
  assert.deepEqual(pieza(p, 'c').enlace, { url: 'https://www.instagram.com/p/xyz/', red: 'instagram' }, 'el enlace manual gana');
  assert.equal(pieza(p, 'b').miniatura, null);
  assert.deepEqual([pieza(p, 'a').perdiendoGancho, pieza(p, 'c').perdiendoGancho, pieza(p, 'b').perdiendoGancho], [true, false, null]);
  assert.deepEqual(pieza(p, 'c').ficha.anuncios, 3);
  assert.deepEqual(pieza(p, 'a').ficha.gasto, { valor: 400, motivo: null });
});

test('la miniatura y el post de Meta van antes que los de los contactos; el enlace manual, antes que todo', () => {
  /* La miniatura de los contactos llega con 3 de 526 contactos; Meta tiene la de todo anuncio. Mutaciones: preferir la de
     los contactos, tomar el post de Meta antes que el enlace manual, perder el enlace de los contactos cuando Meta da
     una imagen y no un post. */
  const CDN = 'https://scontent.xx.fbcdn.net/v/t45/a.jpg';
  const p = armarCreative(entrada({
    activos: new Map([
      ['a', { miniatura: CDN, publicacion: null }],
      ['b', { miniatura: null, publicacion: 'https://www.facebook.com/111/posts/222' }],
      ['c', { miniatura: CDN, publicacion: 'https://www.facebook.com/111/posts/333' }],
    ]),
  }));
  assert.equal(pieza(p, 'a').miniatura, CDN, 'la miniatura de los contactos ganó a la de Meta');
  // Meta dio la imagen y no el post: el enlace sigue siendo el de la miniatura de los contactos.
  assert.deepEqual(pieza(p, 'a').enlace, { url: 'https://www.facebook.com/ads/image/?d=uno', red: 'facebook' });
  assert.equal(pieza(p, 'b').miniatura, null);
  assert.deepEqual(pieza(p, 'b').enlace, { url: 'https://www.facebook.com/111/posts/222', red: 'facebook' });
  assert.deepEqual(pieza(p, 'c').enlace, { url: 'https://www.instagram.com/p/xyz/', red: 'instagram' }, 'el post de Meta ganó al enlace manual');
});

test('la fila de abajo: el gasto, el CTR, el link CTR, la landing y las que perdieron gancho', () => {
  const d = armarCreative(entrada()).loDemas;
  assert.deepEqual(d.gasto, { valor: 1234.5, motivo: null });
  assert.deepEqual(d.ctr, { valor: 390 / 16000, motivo: null });
  assert.deepEqual(d.linkCtr, { valor: 140 / 13000, motivo: null }, 'sobre las impresiones de los días con linkClick');
  assert.deepEqual(d.landing, { valor: 60 / 9000, motivo: null });
  // Sobre las que TIENEN veredicto: «b» no tiene, así que son 2 y no 3.
  assert.deepEqual(d.perdiendoGancho, { con: 1, sobre: 2 });
  const sinVeredicto = armarCreative(entrada({
    fatiga: { dias: 30, aviso: null, conVeredicto: { con: 0, sobre: 2 }, filas: [{ creativo: 'a', cuentaId: P, fatigado: null }, { creativo: 'c', cuentaId: P, fatigado: null }] } as unknown as FatigaDeLosCreativos,
  }));
  assert.deepEqual(sinVeredicto.loDemas.perdiendoGancho, { con: 0, sobre: 0 }, 'sin veredictos, «0 de 2» en lugar de la frase de la fatiga');
  const vacia = armarCreative(entrada({ entrega: [], rendimiento: { filas: [], gastoTotal: null } as unknown as RendimientoDeLosCreativos }));
  assert.deepEqual([vacia.loDemas.gasto.motivo, vacia.loDemas.ctr.motivo, vacia.cifras.impresiones.motivo], ['sin_entrega', 'sin_entrega', 'sin_entrega']);
});

test('la ventana del período llega a la lectura, y la lectura la pasa a todo lo que tiene ventana', () => {
  /* Con una lectura sin la ventana, esa cifra se queda en la de por omisión mientras las otras cambian con el botón:
     una tarjeta con dos períodos y nada que lo diga. */
  // Sin comentarios: una llamada comentada no cuenta.
  const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.match(leer('app/api/creative/route.ts'), /await lecturaDeCreative\(periodo\.dias\)/);
  const lectura = leer('lib/negocio/lecturaDeCreative.ts');
  const cuerpo = lectura.slice(lectura.indexOf('export async function lecturaDeCreative('));
  for (const fn of ['calidadDelCreativo', 'rendimientoDelCreativo', 'fatigaDelCreativo', 'entregaDeLasPiezas']) {
    assert.match(cuerpo, new RegExp(`${fn}\\(dias\\)`), `${fn} no recibe la ventana de la lectura`);
  }
  assert.match(leer('lib/agentes/executive/adaptadores/creative.ts'), /lecturaDeCreative\(periodoPedido\(argumentos\)!\.dias\)/);
});

test('sólo entran las piezas que hicieron algo en la ventana', () => {
  /* La entrega trae todas las piezas de la historia: sin el filtro, «7 días» listaba las de siempre, la mayoría en «No
     funciona» con todo en «—». Entra la que trajo contactos, tuvo impresiones o gastó. */
  const p = armarCreative(entrada({
    entrega: [
      ...entrada().entrega,
      entrega({ pieza: 'vieja', impresiones: 0, etapa: TOFU }),
      entrega({ pieza: 'solo-gasto', impresiones: 0, etapa: TOFU }),
    ],
    rendimiento: {
      ...entrada().rendimiento,
      filas: [...entrada().rendimiento.filas, rend({ creativo: 'solo-gasto', gasto: 12 }), rend({ creativo: 'sin-gasto', gasto: 0 })],
    } as RendimientoDeLosCreativos,
  }));
  const claves = p.piezas.map((x) => x.clave);
  assert.ok(!claves.includes('vieja'), 'entró una pieza sin nada en la ventana');
  assert.ok(!claves.includes('sin-gasto'), 'entró una pieza del rendimiento que no gastó ni entregó');
  assert.ok(claves.includes('solo-gasto'), 'quedó afuera una pieza que gastó');
  assert.ok(claves.includes('d'), 'quedó afuera una pieza que sólo trajo contactos');
  for (const g of Object.values(p.criterios)) assert.ok(![...g.funciona, ...g.noFunciona].includes('vieja'));
  // Una pieza sin contactos dice por qué, en la tarjeta y en la tira.
  assert.deepEqual(pieza(p, 'solo-gasto').cifras.calificados, { valor: null, motivo: 'sin_contactos' });
  assert.deepEqual(pieza(p, 'solo-gasto').cifras.agendas, { valor: null, motivo: 'sin_contactos' });
  const sinCalidad = armarCreative(entrada({ calidad: { ...entrada().calidad, filas: [] } as CalidadDeLosCreativos }));
  assert.deepEqual([sinCalidad.cifras.calificados, sinCalidad.cifras.agendas], [{ valor: null, motivo: 'sin_contactos' }, { valor: null, motivo: 'sin_contactos' }]);
});

test('la ficha, cifra por cifra', () => {
  const p = armarCreative(entrada());
  const a = pieza(p, 'a').ficha;
  assert.deepEqual([a.primerDia, a.ultimoDia], ['2026-09-01', '2026-10-05']);
  assert.deepEqual(a.ctr, { valor: 80 / 4000, motivo: null }, 'el CTR de la pieza es clics sobre impresiones, de 0 a 1');
  assert.deepEqual(a.anunciosDeLaPieza, [{ anuncioId: '111', impresiones: 10, gasto: 1 }]);
  assert.deepEqual(pieza(p, 'c').ficha.landing, { valor: 60 / 9000, motivo: null }, 'la landing es la suya, no la del link CTR');
  assert.deepEqual(pieza(p, 'c').cifras.frecuencia, { valor: 2, motivo: null });
  // Sin gasto pero con impresiones, GoHighLevel no reportó lo que costó: no es «sin entrega».
  const sinGasto = armarCreative(entrada({
    rendimiento: { ...entrada().rendimiento, filas: [rend({ creativo: 'a', gasto: null as unknown as number })] } as RendimientoDeLosCreativos,
  }));
  assert.deepEqual(pieza(sinGasto, 'a').ficha.gasto, { valor: null, motivo: 'sin_reporte' });
  assert.deepEqual(pieza(sinGasto, 'd').ficha.gasto, { valor: null, motivo: 'sin_entrega' });
  // El click-to-landing: sin la clave en ningún anuncio-día, «no lo reportó»; con la pieza sin entrega, «sin entrega».
  const sinClave = armarCreative(entrada({
    rendimiento: { ...entrada().rendimiento, filas: [rend({ creativo: 'a', clickToLanding: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 2 } })] } as unknown as RendimientoDeLosCreativos,
  }));
  assert.deepEqual(pieza(sinClave, 'a').ficha.clickToLanding, { valor: null, motivo: 'sin_reporte' });
  const sinEntrega = armarCreative(entrada({ entrega: entrada().entrega.filter((x) => x.pieza !== 'a') }));
  assert.deepEqual(pieza(sinEntrega, 'a').ficha.clickToLanding, { valor: null, motivo: 'sin_entrega' }, 'con fila de rendimiento pero sin impresiones');
});

test('el piso es «menos de 1000»: con 1000 justas hay tasa; sin frecuencia en ninguna pieza, la tira lo dice', () => {
  const p = armarCreative(entrada({ entrega: [entrega({ pieza: 'a', impresiones: 1000, clics: 10, vistas: { cantidad: 100, impresiones: 1000 }, etapa: TOFU })] }));
  assert.deepEqual(pieza(p, 'a').cifras.hookRate, { valor: 0.1, motivo: null });
  assert.deepEqual(pieza(p, 'a').ficha.ctr, { valor: 0.01, motivo: null });
  assert.deepEqual(p.loDemas.ctr, { valor: 0.01, motivo: null });
  assert.deepEqual(p.cifras.frecuencia, { valor: null, motivo: 'sin_reporte' }, 'hay entrega y ninguna pieza trae frecuencia');
});

test('la etapa de respaldo: la de más contactos; empate, la que va antes en el embudo; y la única de un conteo', () => {
  const p = armarCreative(entrada({
    calidad: {
      ...entrada().calidad,
      filas: [
        // «e»: MOFU primero y TOFU después, con los mismos contactos: gana TOFU, que va antes.
        calidad({ creativo: 'e', etapa: MOFU, contactos: 4, calificados: 1 }),
        calidad({ creativo: 'e', etapa: TOFU, contactos: 4, calificados: 1 }),
        // «f»: la de más contactos viene segunda.
        calidad({ creativo: 'f', etapa: TOFU, contactos: 2, calificados: 0 }),
        calidad({ creativo: 'f', etapa: MOFU, contactos: 5, calificados: 3 }),
      ],
    } as CalidadDeLosCreativos,
    entrega: [],
    rendimiento: { ...entrada().rendimiento, filas: [] } as RendimientoDeLosCreativos,
  }));
  assert.equal(pieza(p, 'e').etapa, 'TOFU', 'el empate depende del orden de las filas');
  assert.equal(pieza(p, 'f').etapa, 'MOFU', 'ganó la primera fila y no la de más contactos');
  // «f» es la única MOFU con calificados: va a «Funciona» como única, también en un criterio de conteo.
  assert.deepEqual(p.criterios.calificados.unicas, ['e', 'f']);
});

test('el cerebro recibe la pantalla sin URLs, campo por campo', () => {
  const p = armarCreative(entrada());
  const c = pantallaParaElCerebro(p);
  const de = (k: string) => c.piezas.find((x) => x.clave === k)!;
  assert.deepEqual([de('a').conMiniatura, de('a').conEnlace], [true, true]);
  assert.deepEqual([de('b').conMiniatura, de('b').conEnlace], [false, false], 'una pieza sin miniatura ni enlace dice que no los tiene');
  assert.deepEqual([de('c').conMiniatura, de('c').conEnlace], [true, true]);
  assert.doesNotMatch(JSON.stringify(c), /https?:/);
  assert.deepEqual(Object.keys(de('a')).sort(), ['cifras', 'clave', 'conEnlace', 'conMiniatura', 'estado', 'etapa', 'ficha', 'perdiendoGancho']);
  assert.deepEqual(Object.keys(de('a').ficha).sort(), ['anuncios', 'anunciosDeLaPieza', 'clickToLanding', 'ctr', 'gasto', 'landing', 'linkCtr', 'primerDia', 'ultimoDia']);
  assert.deepEqual(Object.keys(c).sort(), ['cifras', 'criterios', 'loDemas', 'piezas']);
});

test('la tarea `contactos` pide las miniaturas después de sincronizar, y suma sus llamadas y su corte', () => {
  const barrido = readFileSync(join(RAIZ, 'lib/negocio/barrido.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const i = barrido.indexOf('async function releerContactos(');
  const cuerpo = barrido.slice(i, barrido.indexOf('\n}\n', i));
  // Con el ámbito y el acceso del cliente, y desde el nivel 3 también con el fin de la corrida.
  const miniaturas = cuerpo.indexOf('await completarMiniaturas(ambito, acceso,');
  assert.ok(miniaturas > 0 && cuerpo.indexOf('sincronizarContactos(') < miniaturas, 'las miniaturas no van después de sincronizar');
  assert.match(cuerpo, /resultado: \{ \.\.\.r\.resumen, miniaturas \}/, 'el sello no lleva el resumen de las miniaturas');
  assert.match(cuerpo, /llamadas: r\.resumen\.llamadas \+ miniaturas\.pedidos/, 'las llamadas de las miniaturas no se cuentan');
});
