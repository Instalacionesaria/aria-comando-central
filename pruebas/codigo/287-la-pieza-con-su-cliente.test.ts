// LA PIEZA CON SU CLIENTE: EL IDENTIFICADOR, LA PANTALLA, EL DETECTOR Y EL CEREBRO, SIN BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5 · G1)
//
// La pieza de Creative es (cliente, nombre). Lo que no necesita base, con dos clientes que tienen una pieza con el
// mismo nombre; la base lo mira la 286. Cada afirmación dice la mutación que la pone en rojo:
//
//   · el identificador: el nombre para el principal —la huella de siempre—, `<cuentaId>:<nombre>` para otro, y la
//     llave interna, distinta de los dos — mutación: el cliente siempre adelante;
//   · `armarCreative` con un cliente: la clave es el nombre y la pieza no dice cliente; con dos, cada pieza con sus
//     cifras, su link, su miniatura y su cliente — mutación: los mapas por nombre;
//   · «Funciona» con dos clientes es contra su etapa EN SU CLIENTE, como la señal del ICP — mutación: contra la etapa
//     de todos; y el cliente sólo se dibuja con piezas de dos clientes en la lectura; un empate y las sin valor van
//     por (nombre, cliente) — mutación: ordenar por la clave;
//   · el detector: la concentración dentro de cada cliente y el ICP por (cliente, etapa), con la evidencia y la frase
//     que lo dicen — mutaciones: la concentración y el ICP sobre todos;
//   · el cerebro no lee ningún uuid — mutación: la clave de la pantalla tal cual;
//   · la fuente: la ruta valida el cliente con la sesión y nombra al cliente en el 404 sólo si ve más de uno, el
//     escritor y el borrado van por cliente, la `095` arma la clave nueva, el navegador manda el cliente y nombra la
//     pieza sin el uuid, con el módulo puro.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { idDeLaPieza, llaveInterna, nombreDeLaPieza, partirIdDeLaPieza, rotuloDeLaPieza } from '../../lib/negocio/idDeLaPieza.ts';
import { huellaDe } from '../../lib/agentes/senales/tipos.ts';
import { armarCreative, type EntregaDeLaPieza, type EntradaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';
import { pantallaParaElCerebro } from '../../lib/agentes/executive/adaptadores/creative.ts';
import { CRE, detectarEnCreative, type MedidaDeCreative } from '../../lib/agentes/detectores/creative.ts';
import { textoDeCreative } from '../../lib/agentes/plan/creative.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import type { CalidadDeLosCreativos, FilaDeCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import type { FilaDeRendimiento, RendimientoDeLosCreativos } from '../../lib/negocio/rendimientoDelCreativo.ts';
import type { FatigaDeLosCreativos, FatigaDeUnCreativo } from '../../lib/negocio/fatigaDelCreativo.ts';
import type { EnlaceDePieza } from '../../lib/negocio/enlaceDeLaPieza.ts';

const P = '11111111-1111-4111-8111-111111111111';
const Y = '22222222-2222-4222-8222-222222222222';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

// ─── El identificador ───────────────────────────────────────────────────────

test('el identificador: el nombre para el principal, con el cliente para otro, y la llave interna aparte', () => {
  assert.equal(idDeLaPieza(P, 'hook', P), 'hook', 'la pieza del principal cambió de identificador: las huellas guardadas morirían');
  assert.equal(idDeLaPieza(Y, 'hook', P), `${Y}:hook`);
  assert.equal(idDeLaPieza(P, 'hook', null), `${P}:hook`, 'sin el principal a la vista, todo lleva su cliente');
  assert.deepEqual(partirIdDeLaPieza(`${Y}:hook: v2`), { cuentaId: Y, nombre: 'hook: v2' });
  assert.deepEqual(partirIdDeLaPieza('hook: v2'), { cuentaId: null, nombre: 'hook: v2' }, 'un nombre con dos puntos no es un cliente');
  assert.equal(nombreDeLaPieza(`${Y}:hook`), 'hook');
  assert.equal(nombreDeLaPieza('hook'), 'hook');
  // La llave interna no es ninguno de los dos identificadores: un mapa armado con una no se lee con la otra.
  assert.notEqual(llaveInterna(P, 'hook'), idDeLaPieza(P, 'hook', P));
  assert.notEqual(llaveInterna(P, 'hook'), idDeLaPieza(P, 'hook', null));
  assert.notEqual(llaveInterna(P, 'hook'), llaveInterna(Y, 'hook'));
  assert.equal(rotuloDeLaPieza('hook', null), 'hook');
  assert.equal(rotuloDeLaPieza('hook', 'Cliente Y'), 'hook · Cliente Y');
  // La huella de la señal de una pieza del principal es la de antes del nivel 3, letra por letra.
  assert.equal(
    huellaDe('creative', { regla: CRE.caidaDeCtr, entidad: { tipo: 'pieza', id: idDeLaPieza(P, 'hook', P) } }, '30d'),
    'creative·CRE-CAIDA-DE-CTR·pieza·hook·30d',
  );
});

// ─── La pantalla ────────────────────────────────────────────────────────────

const calidad = (f: Partial<FilaDeCreativo> & { creativo: string; cuentaId: string }): FilaDeCreativo => ({
  etapa: 'TOFU', contactos: 5, conPuntaje: 0, icpPromedio: null, calificados: 1, agendaron: 2, tasaDeAgenda: null, anunciosDeMeta: 1, ...f,
});
const rend = (f: Partial<FilaDeRendimiento> & { creativo: string; cuentaId: string }): FilaDeRendimiento =>
  ({
    anuncios: 1, gasto: 100, impresiones: 0, clics: 0, cpm: null, cpc: null, ctr: null, diasConEntrega: 1,
    hookRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    linkCtr: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    landingPageViewRate: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    clickToLanding: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    interaccion: { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: 1 },
    anunciosDeLaPieza: [],
    ...f,
  }) as FilaDeRendimiento;
const entrega = (f: Partial<EntregaDeLaPieza> & { pieza: string; cuentaId: string }): EntregaDeLaPieza => ({
  impresiones: 0, clics: 0, vistas: null, clicsAlEnlace: null, landing: null, frecuencia: null, impresionesConFrecuencia: 0, etapa: 'TOFU',
  primerDia: '2026-10-01', ultimoDia: '2026-10-18', entregando: true, ...f,
});

/**
 * Dos clientes con una pieza «a» cada uno, y «b» sólo en P, todas TOFU. Por impresiones: P «a» 10.000 y «b» 8.000, Y «a»
 * 2.000. Contra la etapa de todos (6.666) la «a» de Y no funciona; contra la de su cliente es la única, y funciona.
 */
function entrada(o: Partial<EntradaDeCreative> = {}): EntradaDeCreative {
  return {
    calidad: {
      dias: 30, desde: null, hasta: null, congeladas: 0, puente: { con: 0, sobre: 0, sinNombre: 0 }, aviso: null, campoDeIcp: 'campo',
      filas: [calidad({ creativo: 'a', cuentaId: P, calificados: 7 }), calidad({ creativo: 'a', cuentaId: Y, calificados: 2 })],
    } as unknown as CalidadDeLosCreativos,
    rendimiento: {
      dias: 30, desde: null, hasta: null, desdeElDesglose: null, fueraDeAlcance: [], titulos: {}, aviso: null, gastoTotal: 330,
      filas: [rend({ creativo: 'a', cuentaId: P, gasto: 200 }), rend({ creativo: 'b', cuentaId: P, gasto: 100 }), rend({ creativo: 'a', cuentaId: Y, gasto: 30 })],
    } as unknown as RendimientoDeLosCreativos,
    fatiga: {
      dias: 30, aviso: null, conVeredicto: { con: 1, sobre: 1 },
      filas: [{ creativo: 'a', cuentaId: Y, fatigado: true }],
    } as unknown as FatigaDeLosCreativos,
    entrega: [
      entrega({ pieza: 'a', cuentaId: P, impresiones: 10000, clics: 100 }),
      entrega({ pieza: 'b', cuentaId: P, impresiones: 8000, clics: 80 }),
      entrega({ pieza: 'a', cuentaId: Y, impresiones: 2000, clics: 60, etapa: 'TOFU' }),
    ],
    miniaturas: new Map(),
    activos: new Map([[`${Y}:a`, { miniatura: 'https://scontent.xx.fbcdn.net/v/y.jpg', publicacion: null }]]),
    enlaces: [{ cuentaId: Y, pieza: 'a', url: 'https://www.instagram.com/p/y/', red: 'instagram', actualizadoEl: '2026-10-01' } as EnlaceDePieza],
    clientes: { principal: P, nombres: new Map([[P, 'Principal'], [Y, 'Cliente Y']]) },
    ...o,
  };
}

test('con un cliente, la clave es el nombre y la pieza no dice cliente', () => {
  const sinY = entrada({
    calidad: { ...entrada().calidad, filas: entrada().calidad.filas.filter((f) => f.cuentaId === P) } as CalidadDeLosCreativos,
    rendimiento: { ...entrada().rendimiento, filas: entrada().rendimiento.filas.filter((f) => f.cuentaId === P) } as RendimientoDeLosCreativos,
    entrega: entrada().entrega.filter((x) => x.cuentaId === P),
  });
  const p = armarCreative(sinY);
  assert.deepEqual(p.piezas.map((x) => [x.clave, x.nombre, x.cliente]), [['a', 'a', null], ['b', 'b', null]]);
  for (const g of Object.values(p.criterios)) assert.deepEqual(Object.keys(g).sort(), ['funciona', 'noFunciona', 'promedioPorEtapa', 'unicas']);
  // Y tiene historia pero nada en la ventana: la lectura trae piezas de un solo cliente, y no hay nada que distinguir.
  const yQuieta = armarCreative(
    entrada({
      calidad: sinY.calidad,
      rendimiento: sinY.rendimiento,
      entrega: [...sinY.entrega, entrega({ pieza: 'a', cuentaId: Y, impresiones: 0 })],
    }),
  );
  assert.deepEqual(yQuieta.piezas.map((x) => x.cliente), [null, null], 'el cliente se dibujó sin piezas de dos clientes en la lectura');
});

test('con dos clientes, dos piezas con el mismo nombre: cada una con lo suyo', () => {
  const p = armarCreative(entrada());
  // Por nombre, y entre homónimos por cliente.
  assert.deepEqual(p.piezas.map((x) => [x.clave, x.nombre, x.cuentaId, x.cliente]), [
    ['a', 'a', P, 'Principal'],
    [`${Y}:a`, 'a', Y, 'Cliente Y'],
    ['b', 'b', P, 'Principal'],
  ]);
  const de = (clave: string) => p.piezas.find((x) => x.clave === clave)!;
  assert.deepEqual([de('a').cifras.impresiones.valor, de(`${Y}:a`).cifras.impresiones.valor], [10000, 2000]);
  assert.deepEqual([de('a').cifras.calificados.valor, de(`${Y}:a`).cifras.calificados.valor], [7, 2]);
  assert.deepEqual([de('a').ficha.gasto.valor, de(`${Y}:a`).ficha.gasto.valor], [200, 30]);
  assert.deepEqual([de('a').perdiendoGancho, de(`${Y}:a`).perdiendoGancho], [null, true]);
  // El link manual y la miniatura de Meta son de Y.
  assert.deepEqual([de('a').enlace, de(`${Y}:a`).enlace?.url], [null, 'https://www.instagram.com/p/y/']);
  assert.deepEqual([de('a').miniatura, de(`${Y}:a`).miniatura], [null, 'https://scontent.xx.fbcdn.net/v/y.jpg']);
});

test('con dos clientes, «Funciona» es contra la etapa EN SU CLIENTE, como la señal del ICP', () => {
  const g = armarCreative(entrada()).criterios.impresiones;
  // P: (10.000 + 8.000) / 2 = 9.000, «a» funciona y «b» no. Y: «a» es la única de su etapa en Y.
  assert.deepEqual(g.funciona, ['a', `${Y}:a`]);
  assert.deepEqual(g.noFunciona, ['b']);
  assert.deepEqual(g.unicas, [`${Y}:a`]);
  // El de la etapa de todos queda dicho, y los de cada cliente son contra los que se comparó.
  assert.equal(g.promedioPorEtapa.TOFU, 20000 / 3);
  assert.deepEqual(
    g.promediosPorCliente?.map((c) => [c.cuentaId, c.cliente, c.promedioPorEtapa.TOFU]),
    [[P, 'Principal', 9000], [Y, 'Cliente Y', 2000]],
  );
});

test('en los dos grupos, un empate y las sin valor van por (nombre, cliente), no por la clave', () => {
  /* Las dos «a» tienen 2 agendas: empatan, y van por nombre y, entre homónimas, por cliente. Por la clave, la de Y —que
     empieza con los dígitos de su id— quedaba delante de la del principal, y con ella todas las de Y. */
  const g = armarCreative(entrada({ entrega: [...entrada().entrega, entrega({ pieza: 'c', cuentaId: Y, impresiones: 1000 })] })).criterios.agendas;
  assert.deepEqual(g.funciona, ['a', `${Y}:a`]);
  // Sin contactos, sin valor: la «b» de P y la «c» de Y, al final y por nombre.
  assert.deepEqual(g.noFunciona, ['b', `${Y}:c`]);
});

test('el cerebro nunca lee un uuid: la clave y los criterios van con el rótulo', () => {
  const c = pantallaParaElCerebro(armarCreative(entrada()));
  assert.doesNotMatch(JSON.stringify(c), UUID);
  assert.deepEqual(c.piezas.map((x) => [x.clave, x.nombre, x.cliente]), [
    ['a · Principal', 'a', 'Principal'],
    ['a · Cliente Y', 'a', 'Cliente Y'],
    ['b · Principal', 'b', 'Principal'],
  ]);
  assert.deepEqual(c.criterios.impresiones!.funciona, ['a · Principal', 'a · Cliente Y']);
  assert.deepEqual(c.criterios.impresiones!.promediosPorCliente?.map((x) => Object.keys(x).sort()), [['cliente', 'promedioPorEtapa'], ['cliente', 'promedioPorEtapa']]);
});

// ─── El detector ────────────────────────────────────────────────────────────

const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
const pieza = (cuentaId: string, creativo: string, gasto: number) => ({ cuentaId, creativo, gasto, impresiones: 5000 }) as FilaDeRendimiento;
const icp = (cuentaId: string, creativo: string, icpPromedio: number) =>
  ({ cuentaId, creativo, etapa: 'TOFU', icpPromedio, conPuntaje: 20, contactos: 20 }) as FilaDeCreativo;
const fatiga = (cuentaId: string, creativo: string, caida: number) =>
  ({ cuentaId, creativo, dias: 20, desde: '2026-09-10', hasta: '2026-10-04', ctrTemprano: 3, ctrTardio: 2, caida, fatigado: true, motivo: null, porque: null }) as FatigaDeUnCreativo;

function medida(e: { rendimiento?: FilaDeRendimiento[]; calidad?: FilaDeCreativo[]; fatiga?: FatigaDeUnCreativo[]; ventana?: '7d' | '30d'; frecuencias?: MedidaDeCreative['frecuencias'] }): MedidaDeCreative {
  return {
    ventana: e.ventana ?? '30d',
    periodo: { desde: '2026-09-21', hasta: '2026-10-20' },
    calidad: { filas: e.calidad ?? [], campoDeIcp: 'campo' },
    rendimiento: { filas: e.rendimiento ?? [] },
    fatiga: { filas: e.fatiga ?? [] },
    principal: P,
    frecuencias: e.frecuencias ?? null,
    anunciosAlDia: true,
    gastoCuadra: true,
  };
}

test('la concentración se mide dentro de cada cliente, y la frase lo dice', () => {
  /* P: 100 de 280 (35,7 %); Y: 20 de 30 (66,7 %). Juntas, la «a» de P se lleva 100 de 310 (32,3 %): ninguna llega. */
  const r = detectarEnCreative(
    medida({ rendimiento: [pieza(P, 'a', 100), pieza(P, 'b', 90), pieza(P, 'c', 90), pieza(Y, 'a', 20), pieza(Y, 'b', 5), pieza(Y, 'c', 5)] }),
    umbral,
  );
  const c = r.detecciones.filter((d) => d.regla === CRE.concentracion);
  assert.deepEqual(c.map((d) => [d.entidad.id, d.valorActual, (d.evidencia as { cliente?: string }).cliente]), [
    ['a', 0.3571, P],
    [`${Y}:a`, 0.6667, Y],
  ]);
  assert.equal(textoDeCreative(c[1]!), 'Se lleva el 67 % del gasto de su cliente en la ventana, entre 3 piezas con gasto.');
  assert.equal(((c[1]!.evidencia as { piezas: unknown[] }).piezas).length, 3, 'la evidencia trae las piezas de su cliente, no las de todos');
});

test('el ICP se compara con las piezas de su etapa EN SU CLIENTE', () => {
  /* P en TOFU: 70, 70 y 40 (promedio 60): la de 40 está 20 abajo. Y en TOFU: 50, 50 y 20 (promedio 40): la de 20 está
     20 abajo. Con el promedio de todas (50), la de P quedaría 10 abajo y no saldría. */
  const r = detectarEnCreative(
    medida({ calidad: [icp(P, 'x', 70), icp(P, 'y', 70), icp(P, 'z', 40), icp(Y, 'u', 50), icp(Y, 'v', 50), icp(Y, 'w', 20)] }),
    umbral,
  );
  const i = r.detecciones.filter((d) => d.regla === CRE.icpPorPieza);
  assert.deepEqual(i.map((d) => [d.entidad.id, d.lineaBase, d.valorActual, (d.evidencia as { cliente?: string }).cliente]), [
    ['z', 60, 40, P],
    [`${Y}:w`, 40, 20, Y],
  ]);
  assert.equal(
    textoDeCreative(i[0]!),
    'Su ICP promedio está 20 puntos por debajo del promedio de las piezas de su etapa en su cliente (TOFU): 40 contra 60, sobre 20 contactos con puntaje.',
  );
});

test('la caída y la frecuencia: la pieza de cada cliente con su identificador, y la evidencia nombra al cliente', () => {
  const r = detectarEnCreative(
    medida({
      ventana: '7d',
      rendimiento: [pieza(P, 'a', 10), { ...pieza(Y, 'a', 10), impresiones: 7000 }],
      fatiga: [fatiga(P, 'a', 0.3), fatiga(Y, 'a', 0.4)],
      frecuencias: new Map([['ad-y', { frecuencia: 4, impresiones: 2000, creativo: 'a', cuentaId: Y }]]),
    }),
    umbral,
  );
  const caidas = r.detecciones.filter((d) => d.regla === CRE.caidaDeCtr);
  // La muestra es la de la pieza de SU cliente.
  assert.deepEqual(caidas.map((d) => [d.entidad.id, (d.evidencia as { cliente?: string }).cliente, d.muestra]), [['a', P, 5000], [`${Y}:a`, Y, 7000]]);
  const frecuencia = r.detecciones.find((d) => d.regla === CRE.frecuenciaAlta)!;
  assert.deepEqual([frecuencia.entidad, (frecuencia.evidencia as { cliente?: string }).cliente], [{ tipo: 'anuncio', id: 'ad-y' }, Y]);
  // Con un solo cliente, la evidencia no nombra a nadie: la de siempre.
  const uno = detectarEnCreative(medida({ rendimiento: [pieza(P, 'a', 10)], fatiga: [fatiga(P, 'a', 0.3)] }), umbral);
  assert.deepEqual(Object.keys(uno.detecciones[0]!.evidencia as object).includes('cliente'), false);
});

// ─── La fuente ──────────────────────────────────────────────────────────────

test('la ruta del link: el cliente es uno de los que ve la sesión, y sin decirlo el principal', () => {
  const ruta = leer('app/api/creative/enlace/route.ts');
  assert.match(ruta, /return contexto\.cuentas\.visibles\.find\(\(c\) => c\.esPorOmision\)\?\.id \?\? null;/);
  assert.match(ruta, /contexto\.cuentas\.visibles\.some\(\(c\) => c\.id === pedido\) \? pedido : null/);
  assert.match(ruta, /guardarEnlace\(\{ cuentaId, pieza, url \}, autorDelCambio\(contexto\)\)/);
  assert.match(ruta, /borrarEnlace\(\{ cuentaId, pieza \}\)/);
  assert.equal(ruta.match(/detalle: \{ enlace: url, pieza, cuenta: cuentaId \}/g)?.length, 2, 'una de las dos auditorías no dice el cliente');
  /* El motivo de siempre, salvo que el pedido diga el cliente Y la sesión vea más de uno: el navegador lo manda siempre,
     y con un solo cliente la respuesta no cambia (la 178 lo mira en la base). */
  assert.match(ruta, /sin_pieza: 'Esa pieza no corresponde a ningún anuncio de la empresa\.',/);
  assert.match(ruta, /MOTIVOS\[dijoElCliente && contexto\.cuentas\.visibles\.length > 1 \? 'sin_pieza_del_cliente' : 'sin_pieza'\]/);
  assert.match(ruta, /const sinPieza = motivoSinPieza\(contexto, c\?\.cuentaId\);/);
});

test('el escritor del link y la 095: la clave es (org, cliente, pieza), y la pieza existe en SU cliente', () => {
  const escritor = leer('lib/negocio/enlaceDeLaPieza.ts');
  assert.match(escritor, /oc\.columns\(\['org_id', 'cuenta_id', 'pieza'\]\)/);
  assert.match(escritor, /\.values\(\{ cuenta_id: enlace\.cuentaId, pieza: enlace\.pieza,/);
  const existe = escritor.slice(escritor.indexOf('export async function existeLaPieza('), escritor.indexOf('export async function enlacesDeLasPiezas('));
  assert.match(existe, /\.where\('cuenta_id', '=', cuentaId\)/);
  const borrar = escritor.slice(escritor.indexOf('export async function borrarEnlace('));
  assert.match(borrar, /\.where\('cuenta_id', '=', enlace\.cuentaId\)\s*\.where\('pieza', '=', enlace\.pieza\)/);
  const migracion = readFileSync(join(RAIZ, 'db/migraciones/095_la_pieza_es_de_un_cliente.sql'), 'utf8');
  assert.match(migracion, /= 'PRIMARY KEY \(org_id, pieza\)' then/, 'la 095 no mira la clave antes de cambiarla: no es reaplicable');
  assert.match(migracion, /add constraint enlaces_de_pieza_pkey primary key \(org_id, cuenta_id, pieza\);/);
});

test('el navegador manda el cliente del link y nombra la pieza sin el uuid, con el módulo puro', () => {
  const vista = leer('lib/negocio/vistaDeCreative.ts');
  assert.match(vista, /escribirEnlace\('PUT', '\/api\/creative\/enlace', \{ cuentaId, pieza, url \}\)/);
  assert.match(vista, /\?pieza=\$\{encodeURIComponent\(pieza\)\}&cuentaId=\$\{encodeURIComponent\(cuentaId\)\}/);
  const panel = leer('components/creative/PanelDeCreative.jsx');
  assert.match(panel, /const esDe = \(pieza\) => \(e\) => e\.cuentaId === pieza\.cuentaId && e\.pieza === pieza\.nombre;/);
  assert.match(panel, /manual=\{enlaces\.find\(esDe\(pieza\)\) \?\? null\}/);
  assert.match(panel, /puedeEditar=\{puedeEditar && sesion\.cuentas\.visibles\.some\(\(c\) => c\.id === pieza\.cuentaId\)\}/, 'el editor del link se ofrece en un cliente que la sesión no ve');
  const senales = leer('components/senales/SenalesDelDepartamento.jsx');
  assert.match(senales, /return nombres\.get\(entidad\.id\) \?\? nombreDeLaPieza\(entidad\.id\);/);
  // El formato del identificador vive en un solo lugar: ningún componente copia el patrón del uuid.
  for (const jsx of ['components/senales/SenalesDelDepartamento.jsx', 'components/creative/PanelDeCreative.jsx', 'components/creative/FichaDelCreativo.jsx']) {
    assert.doesNotMatch(leer(jsx), /\[0-9a-f\]\{8\}/, `${jsx} copia el patrón del identificador`);
  }
  // Y el módulo es puro: el navegador lo importa, así que no puede traer la base.
  assert.doesNotMatch(readFileSync(join(RAIZ, 'lib/negocio/idDeLaPieza.ts'), 'utf8'), /^import /m);
  assert.match(leer('app/creative.css'), /#v-creative \.cr-cliente \{[^}]*text-overflow: ellipsis;/);
});
