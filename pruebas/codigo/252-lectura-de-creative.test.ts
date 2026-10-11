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
//   · la fila de abajo —mutación: el CTR sobre otra base—.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import type { CalidadDeLosCreativos, FilaDeCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import type { FatigaDeLosCreativos } from '../../lib/negocio/fatigaDelCreativo.ts';
import type { FilaDeRendimiento, RendimientoDeLosCreativos } from '../../lib/negocio/rendimientoDelCreativo.ts';
import type { EnlaceDePieza } from '../../lib/negocio/enlaceDeLaPieza.ts';
import { armarCreative, type EntregaDeLaPieza, type EntradaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';

const TOFU = 'TOFU' as const;
const BOFU = 'BOFU' as const;

const calidad = (f: Partial<FilaDeCreativo> & { creativo: string | null }): FilaDeCreativo => ({
  etapa: null, contactos: 0, conPuntaje: 0, icpPromedio: null, calificados: 0, agendaron: 0, tasaDeAgenda: null, anunciosDeMeta: 0, ...f,
});

const rend = (f: Partial<FilaDeRendimiento> & { creativo: string }): FilaDeRendimiento =>
  ({
    anuncios: 1, gasto: 100, impresiones: 0, clics: 0, cpm: null, cpc: null, ctr: null, diasConEntrega: 1,
    hookRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    linkCtr: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    landingPageViewRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    clickToLanding: { cantidad: 30, tasa: 75, anuncioDiasConLaClave: 2, anuncioDiasConEntrega: 2 },
    interaccion: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    anunciosDeLaPieza: [{ anuncioId: '111', campanaId: '9', impresiones: 10, gasto: 1 }],
    ...f,
  }) as FilaDeRendimiento;

const entrega = (f: Partial<EntregaDeLaPieza> & { pieza: string }): EntregaDeLaPieza => ({
  impresiones: 0, clics: 0, vistas: null, clicsAlEnlace: null, landing: null, frecuencia: null, etapa: null,
  primerDia: '2026-09-01', ultimoDia: '2026-10-05', entregando: false, ...f,
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
        { creativo: 'a', fatigado: true },
        { creativo: 'c', fatigado: false },
        { creativo: 'b', fatigado: null },
      ],
    } as unknown as FatigaDeLosCreativos,
    entrega: [
      entrega({ pieza: 'a', impresiones: 4000, clics: 80, vistas: { cantidad: 800, impresiones: 4000 }, clicsAlEnlace: { cantidad: 40, impresiones: 4000 }, frecuencia: 1.5, etapa: TOFU, entregando: true }),
      entrega({ pieza: 'b', impresiones: 2000, clics: 10, vistas: { cantidad: 200, impresiones: 2000 }, frecuencia: null, etapa: TOFU }),
      entrega({ pieza: 'c', impresiones: 10000, clics: 300, vistas: { cantidad: 3000, impresiones: 10000 }, clicsAlEnlace: { cantidad: 100, impresiones: 9000 }, landing: { cantidad: 60, impresiones: 9000 }, frecuencia: 2, etapa: BOFU, entregando: true }),
    ],
    miniaturas: new Map([['a', 'https://www.facebook.com/ads/image/?d=uno'], ['c', 'https://www.facebook.com/ads/image/?d=dos']]),
    enlaces: [{ pieza: 'c', url: 'https://www.instagram.com/p/xyz/', red: 'instagram', actualizadoEl: '2026-10-01' } as unknown as EnlaceDePieza],
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
  // La frecuencia pesada sobre las impresiones de las piezas que la reportan: «b» no la trae.
  assert.deepEqual(p.cifras.frecuencia, { valor: (1.5 * 4000 + 2 * 10000) / 14000, motivo: null });
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

test('la fila de abajo: el gasto, el CTR, el link CTR, la landing y las que perdieron gancho', () => {
  const d = armarCreative(entrada()).loDemas;
  assert.deepEqual(d.gasto, { valor: 1234.5, motivo: null });
  assert.deepEqual(d.ctr, { valor: 390 / 16000, motivo: null });
  assert.deepEqual(d.linkCtr, { valor: 140 / 13000, motivo: null }, 'sobre las impresiones de los días con linkClick');
  assert.deepEqual(d.landing, { valor: 60 / 9000, motivo: null });
  assert.deepEqual(d.perdiendoGancho, { con: 1, sobre: 3 });
  const vacia = armarCreative(entrada({ entrega: [], rendimiento: { filas: [], gastoTotal: null } as unknown as RendimientoDeLosCreativos }));
  assert.deepEqual([vacia.loDemas.gasto.motivo, vacia.loDemas.ctr.motivo, vacia.cifras.impresiones.motivo], ['sin_entrega', 'sin_entrega', 'sin_entrega']);
});

test('la ventana del período llega a la lectura, y la lectura la pasa a todo lo que tiene ventana', () => {
  /* Con una lectura sin la ventana, esa cifra se queda en la de por omisión mientras las otras cambian con el botón:
     una tarjeta con dos períodos y nada que lo diga. */
  const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
  assert.match(leer('app/api/creative/route.ts'), /await lecturaDeCreative\(periodo\.dias\)/);
  const lectura = leer('lib/negocio/lecturaDeCreative.ts');
  const cuerpo = lectura.slice(lectura.indexOf('export async function lecturaDeCreative('));
  for (const fn of ['calidadDelCreativo', 'rendimientoDelCreativo', 'fatigaDelCreativo', 'entregaDeLasPiezas']) {
    assert.match(cuerpo, new RegExp(`${fn}\\(dias\\)`), `${fn} no recibe la ventana de la lectura`);
  }
  assert.match(leer('lib/agentes/executive/adaptadores/creative.ts'), /lecturaDeCreative\(periodoPedido\(argumentos\)!\.dias\)/);
});
