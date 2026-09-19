// El hook rate y las tasas de enlace por pieza, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO CENTRAL DE ESTE MÓDULO DA UNA CIFRA BAJA, PLAUSIBLE Y FALSA
//
// El desglose de acciones **no viene en todas las filas**. Medido sobre 24 días de producción:
// `videoView` en 224 de 266 filas anuncio-día con entrega, `linkClick` en 171, `landingPageView` en
// 150.
//
// Si el numerador se suma sobre los días que traen la clave y el denominador sobre todos, la tasa
// sale sistemáticamente baja. No lanza, no avisa, y **un hook rate del 12 % es tan creíble como uno
// del 21 %** — nadie puede mirar el número y darse cuenta de que le falta la mitad del denominador.
//
// Es el mismo error que `indicadoresDeCitas` evita poniendo `asistio is not null` en el DENOMINADOR,
// y por eso la primera prueba de este archivo siembra tres días de los cuales uno no trae la clave:
// el valor correcto y el incorrecto son dos números exactos y distintos.
//
// ── Y EL SEGUNDO: UN TIPO AUSENTE NO ES CERO ──────────────────────────────
//
// Una pieza estática no tiene `videoView` **nunca**. Publicarle hook rate cero la mete en el
// promedio de las piezas de video arrastrándolo hacia abajo, y encima la hace parecer un video que
// nadie reprodujo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  PISO_DE_IMPRESIONES,
  rendimientoDelCreativo,
} from '../../lib/negocio/rendimientoDelCreativo.ts';

let esc: Escenario;
const MARCA = '66666600';

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
}

before(async () => {
  esc = await montar('RendCreativo');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function unAnuncio(id: string, nombre: string | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [esc.org, id, nombre ?? ''],
  );
}

/** Un día. `acciones: null` = el proveedor no mandó `results` (el anuncio no entregó, o no hubo). */
async function unDia(
  id: string,
  hace: number,
  m: { gasto?: number | null; impresiones?: number | null; clics?: number | null },
  acciones: Record<string, number> | null,
): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio
       (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia, acciones)
     values ($1, $2, current_date - $3::int, $4, $5, $6, null, null, null, null, $7::jsonb)`,
    [
      esc.org,
      id,
      hace,
      m.gasto ?? null,
      m.impresiones ?? null,
      m.clics ?? null,
      acciones === null ? null : JSON.stringify(acciones),
    ],
  );
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => rendimientoDelCreativo(dias));
const fila = async (creativo: string) => (await leer()).filas.find((f) => f.creativo === creativo);

// ─── EL DENOMINADOR ─────────────────────────────────────────────────────────

test('el denominador de una tasa excluye los días que NO traen su clave', async () => {
  /* Tres días de mil impresiones cada uno; dos traen `videoView` y uno no. El hook rate correcto es
     400/2000 = 20 %. Sumando las tres mil impresiones daría 13,33 % — un número perfectamente
     creíble, y la diferencia entre «este gancho funciona» y «este gancho no funciona». */
  await limpiar();
  await unAnuncio(`${MARCA}01`, 'pieza del denominador');
  await unDia(`${MARCA}01`, 1, { gasto: 10, impresiones: 1000 }, { videoView: 200 });
  await unDia(`${MARCA}01`, 2, { gasto: 10, impresiones: 1000 }, { videoView: 200 });
  await unDia(`${MARCA}01`, 3, { gasto: 10, impresiones: 1000 }, { linkClick: 5 });

  const f = await fila('pieza del denominador');

  assert.equal(f?.impresiones, 3000, 'el total de impresiones de la pieza son las tres mil');
  assert.equal(f?.hookRate.tasa, 20, 'el hook rate se calculó sobre impresiones de días sin la clave');
  assert.equal(f?.hookRate.cantidad, 400);
  assert.equal(f?.hookRate.diasConLaClave, 2, 'la cobertura del numerador no viaja');
  assert.equal(f?.hookRate.diasConEntrega, 3);
});

test('sin ningún día con la clave, la tasa es NULA y no cero', async () => {
  /* Una pieza estática. Cero la mete en el promedio de las de video arrastrándolo, y encima la hace
     parecer un video que nadie reprodujo. */
  await limpiar();
  await unAnuncio(`${MARCA}02`, 'pieza estatica');
  await unDia(`${MARCA}02`, 1, { gasto: 10, impresiones: 5000 }, { linkClick: 100 });

  const f = await fila('pieza estatica');

  assert.equal(f?.hookRate.tasa, null, 'una pieza sin video publicó hook rate cero');
  assert.equal(f?.hookRate.cantidad, null, 'se inventó un conteo de reproducciones');
  assert.equal(f?.hookRate.diasConLaClave, 0);
  assert.equal(f?.linkCtr.tasa, 2, 'la clave que SÍ vino tenía que publicarse');
});

test('el piso de estas tasas NO es el de los eventos contables', async () => {
  /* `PISO_DE_UNA_TASA` son diez eventos. Acá el denominador son impresiones: con cien, una sola
     reproducción mueve la cifra un punto entero. Con 999 impresiones no se publica; con 1000 sí. */
  await limpiar();
  await unAnuncio(`${MARCA}03`, 'pieza corta');
  await unAnuncio(`${MARCA}04`, 'pieza justa');
  await unDia(`${MARCA}03`, 1, { gasto: 1, impresiones: PISO_DE_IMPRESIONES - 1 }, { videoView: 500 });
  await unDia(`${MARCA}04`, 1, { gasto: 1, impresiones: PISO_DE_IMPRESIONES }, { videoView: 500 });

  const corta = await fila('pieza corta');
  const justa = await fila('pieza justa');

  assert.equal(corta?.hookRate.tasa, null, `se publicó una tasa con ${PISO_DE_IMPRESIONES - 1} impresiones`);
  assert.equal(corta?.hookRate.cantidad, 500, 'bajo el piso se pierde la tasa, no el conteo');
  assert.equal(justa?.hookRate.tasa, 50);
});

// ─── LA PIEZA, QUE SON VARIOS ANUNCIOS ──────────────────────────────────────

test('varios anuncios de la misma pieza son UNA fila, y las derivadas se recalculan', async () => {
  /* Dos anuncios con pesos muy distintos. El CTR de la pieza es (10+100)/(1000+10000) = 1 %.
     Promediar los dos CTR daría (1 % + 1 %)/2 = 1 % y no se notaría, así que los clics se eligen
     desparejos: 10/1000 = 1 % y 500/10000 = 5 %. El CTR de la pieza es 510/11000 = 4,64 %; el
     promedio de los dos sería 3 %. */
  await limpiar();
  await unAnuncio(`${MARCA}05`, 'la misma pieza');
  await unAnuncio(`${MARCA}06`, 'La Misma Pieza');
  await unDia(`${MARCA}05`, 1, { gasto: 10, impresiones: 1000, clics: 10 }, { videoView: 100 });
  await unDia(`${MARCA}06`, 1, { gasto: 90, impresiones: 10000, clics: 500 }, { videoView: 2000 });

  const f = await fila('la misma pieza');

  assert.equal(f?.anuncios, 2, 'la caja del nombre partió la pieza');
  assert.equal(f?.gasto, 100);
  assert.equal(f?.impresiones, 11000);
  assert.equal(f?.ctr, 4.636, 'el CTR se promedió en vez de recalcularse sobre las sumas');
  assert.equal(f?.cpm, 9.09);
  assert.equal(f?.hookRate.tasa, 19.09, 'el hook rate se promedió en vez de sumarse');
});

test('una pieza que no entregó ningún día publica NULO, no cero', async () => {
  // La suma conserva el nulo: `null + null` es `null`. Un `?? 0` diría «gastó cero», que es otra cosa.
  await limpiar();
  await unAnuncio(`${MARCA}07`, 'pieza sin entrega');
  await unDia(`${MARCA}07`, 1, {}, null);
  await unDia(`${MARCA}07`, 2, {}, null);

  const f = await fila('pieza sin entrega');

  assert.equal(f?.gasto, null, 'una pieza que no se mostró publicó que gastó cero');
  assert.equal(f?.impresiones, null);
  assert.equal(f?.ctr, null);
  assert.equal(f?.hookRate.tasa, null);
});

test('un anuncio SIN nombre cae en su propia fila, y su gasto sigue sumando', async () => {
  // Descartarlo en silencio haría que el total de la pantalla no sume el gasto real.
  await limpiar();
  await unAnuncio(`${MARCA}08`, null);
  await unDia(`${MARCA}08`, 1, { gasto: 42, impresiones: 2000 }, { videoView: 100 });

  const r = await leer();
  const f = r.filas.find((x) => x.creativo === '(anuncio sin nombre)');

  assert.ok(f, 'el anuncio sin nombre se descartó');
  assert.equal(f?.gasto, 42);
  assert.equal(r.gastoTotal, 42, 'el total de la pantalla perdió el gasto del anuncio sin nombre');
});

// ─── EL CRUCE, QUE TIENE OTRO DENOMINADOR ───────────────────────────────────

test('el click-to-landing sólo cuenta los días que traen las DOS claves', async () => {
  /* Dividir la suma de una clave por la suma de la otra sobre días distintos da una proporción
     entre dos poblaciones. Acá: un día con las dos (50/100 = 50 %) y otro con `linkClick` solo.
     Contando los dos daría 50/150 = 33 %. */
  await limpiar();
  await unAnuncio(`${MARCA}09`, 'pieza del cruce');
  await unDia(`${MARCA}09`, 1, { gasto: 10, impresiones: 5000 }, { linkClick: 100, landingPageView: 50 });
  await unDia(`${MARCA}09`, 2, { gasto: 10, impresiones: 5000 }, { linkClick: 50 });

  const f = await fila('pieza del cruce');

  assert.equal(f?.clickToLanding.tasa, 50, 'se mezclaron días con una sola de las dos claves');
  assert.equal(f?.clickToLanding.diasConLaClave, 1);
  assert.equal(f?.linkCtr.cantidad, 150, 'el link CTR sí cuenta los dos días');
});

test('el click-to-landing puede pasar de 100 % y NO se topa', async () => {
  /* Meta puede contar una vista de landing de un clic de otro día. Toparlo en 100 esconde el
     desajuste de atribución, que es justo lo que esta cifra sirve para ver. Es la lección del
     `cap = 0.94` que el prototipo de Acquisition tenía escrito. */
  await limpiar();
  await unAnuncio(`${MARCA}10`, 'pieza desajustada');
  await unDia(`${MARCA}10`, 1, { gasto: 10, impresiones: 5000 }, { linkClick: 20, landingPageView: 30 });

  const f = await fila('pieza desajustada');

  assert.equal(f?.clickToLanding.tasa, 150, 'la tasa se recortó a 100 y escondió el desajuste');
});

// ─── LAS DOS VENTANAS ───────────────────────────────────────────────────────

test('el desglose tiene su PROPIA fecha de inicio, y el aviso la dice', async () => {
  /* La columna `acciones` nació con la `053`, así que hay gasto de días que no tienen desglose. Una
     pantalla que diga «30 días» mientras el hook rate habla de dos afirma algo falso sobre el
     alcance de la cifra. */
  await limpiar();
  await unAnuncio(`${MARCA}11`, 'pieza con dos ventanas');
  await unDia(`${MARCA}11`, 20, { gasto: 10, impresiones: 3000 }, null);
  await unDia(`${MARCA}11`, 2, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  assert.notEqual(r.desde, r.desdeElDesglose, 'las dos ventanas salieron iguales');
  assert.match(String(r.aviso), /desglose/, 'el aviso no dice que las dos ventanas son distintas');
  assert.match(String(r.aviso), new RegExp(String(r.desdeElDesglose)), 'el aviso no trae la fecha');
});

test('sin ningún desglose guardado, el aviso lo dice y no calla', async () => {
  await limpiar();
  await unAnuncio(`${MARCA}12`, 'pieza sin desglose');
  await unDia(`${MARCA}12`, 1, { gasto: 10, impresiones: 3000 }, null);

  const r = await leer();

  assert.equal(r.desdeElDesglose, null);
  assert.match(String(r.aviso), /no hay ningún día con el desglose/i);
});

test('cuando las dos ventanas coinciden, el aviso NO habla de ellas', async () => {
  /* La otra mitad: un aviso que aparece siempre es uno que nadie lee. Lo que sí queda es la nota de
     definición del hook rate, que es de la fuente y no de la ventana. */
  await limpiar();
  await unAnuncio(`${MARCA}13`, 'pieza pareja');
  await unDia(`${MARCA}13`, 1, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  assert.equal(r.desde, r.desdeElDesglose);
  assert.doesNotMatch(String(r.aviso ?? ''), /habla[n]? de menos días/, 'avisó de dos ventanas iguales');
  assert.match(String(r.aviso), /tres segundos/, 'se perdió la nota de definición del hook rate');
});
