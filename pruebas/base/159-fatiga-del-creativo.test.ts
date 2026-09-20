// La caída del CTR por pieza, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE ES UN VEREDICTO, QUE ES PEOR QUE UNA CIFRA MAL
//
// Una cifra equivocada se discute. **«FATIGADO» manda a apagar una pieza**, y si se dice sobre
// cuatro días de serie o sobre doscientas impresiones, manda a apagar por ruido.
//
// Por eso lo que más se prueba acá no es el cálculo —dividir clics por impresiones es difícil de
// hacer mal— sino los tres silencios:
//
//   · serie corta            ⟹ `fatigado: null` **y no `false`**
//   · mitades sin volumen    ⟹ ídem
//   · el motivo viaja        ⟹ la pantalla puede decir por qué no hay veredicto
//
// `false` ahí sería una afirmación —«esta pieza no está cansando»— hecha sobre cuatro días, y desde
// la pantalla no habría forma de distinguirla de una medida sobre veintiséis.
//
// ── Y EL GRANO, QUE ES EL DEFECTO SILENCIOSO ──────────────────────────────
//
// Una pieza corre en hasta seis anuncios. Si la serie se arma sin agrupar por día primero, una pieza
// de cuatro días en seis anuncios parece tener veinticuatro días de serie y supera cualquier piso.
// No falla: da un veredicto sobre una base que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  CAIDA_QUE_PREOCUPA,
  DIAS_MINIMOS_DE_SERIE,
  fatigaDelCreativo,
} from '../../lib/negocio/fatigaDelCreativo.ts';
import { PISO_DE_IMPRESIONES } from '../../lib/negocio/rendimientoDelCreativo.ts';

let esc: Escenario;
const MARCA = '55555500';

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
}

before(async () => {
  esc = await montar('FatigaCreativo');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function unAnuncio(id: string, nombre: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [esc.org, id, nombre],
  );
}

async function unDia(id: string, hace: number, impresiones: number | null, clics: number | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio
       (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia)
     values ($1, $2, current_date - $3::int, 1, $4, $5, null, null, null, null)`,
    [esc.org, id, hace, impresiones, clics],
  );
}

/**
 * Una serie de `n` días: los primeros con `ctr1` y los últimos con `ctr2`, en porcentaje.
 *
 * `hace` arranca alto y baja, así que los días más VIEJOS son los primeros de la serie.
 */
async function unaSerie(id: string, n: number, ctr1: number, ctr2: number, impPorDia = 2000): Promise<void> {
  const mitad = Math.ceil(n / 2);
  for (let i = 0; i < n; i += 1) {
    const ctr = i < mitad ? ctr1 : ctr2;
    await unDia(id, n - i, impPorDia, Math.round((impPorDia * ctr) / 100));
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => fatigaDelCreativo(dias));
const fila = async (creativo: string) => (await leer()).filas.find((f) => f.creativo === creativo);

// ─── LOS TRES SILENCIOS ─────────────────────────────────────────────────────

test('una serie corta NO da veredicto, y dice por qué', async () => {
  /* `false` acá sería «esta pieza no está cansando» dicho sobre cuatro días. Desde la pantalla no
     habría forma de distinguirlo de un `false` medido sobre veintiséis. */
  await limpiar();
  await unAnuncio(`${MARCA}01`, 'serie corta');
  await unaSerie(`${MARCA}01`, DIAS_MINIMOS_DE_SERIE - 1, 5, 1);

  const f = await fila('serie corta');

  assert.equal(f?.dias, DIAS_MINIMOS_DE_SERIE - 1);
  assert.equal(f?.fatigado, null, 'se dio un veredicto sobre una serie que no alcanza');
  assert.equal(f?.caida, null, 'se publicó una caída sin base');
  assert.match(String(f?.porque), /día/, 'no dice por qué no hay veredicto');
});

test('una serie larga pero SIN volumen tampoco da veredicto', async () => {
  /* Un CTR sobre doscientas impresiones se mueve medio punto con un clic: comparar dos mitades así
     es comparar ruido contra ruido, y el veredicto saldría por azar. */
  await limpiar();
  await unAnuncio(`${MARCA}02`, 'serie flaca');
  await unaSerie(`${MARCA}02`, DIAS_MINIMOS_DE_SERIE + 2, 5, 1, 100);

  const f = await fila('serie flaca');

  assert.ok((f?.dias ?? 0) >= DIAS_MINIMOS_DE_SERIE, 'la serie tenía días de sobra');
  assert.equal(f?.fatigado, null, 'se dio un veredicto sobre mitades sin volumen');
  assert.match(String(f?.porque), new RegExp(String(PISO_DE_IMPRESIONES)), 'no dice cuál es el piso');
});

test('con serie y volumen, el veredicto SÍ se da', async () => {
  // La otra mitad de las dos anteriores: sin esto, un `fatigado: null` fijo las pasaría a las tres.
  await limpiar();
  await unAnuncio(`${MARCA}03`, 'serie buena');
  await unaSerie(`${MARCA}03`, 10, 4, 2);

  const f = await fila('serie buena');

  assert.equal(f?.fatigado, true);
  assert.equal(f?.porque, null, 'se dio un motivo cuando sí hubo veredicto');
  assert.equal(f?.ctrTemprano, 4);
  assert.equal(f?.ctrTardio, 2);
  assert.equal(f?.caida, 0.5);
});

// ─── LA CAÍDA ───────────────────────────────────────────────────────────────

test('la caída es RELATIVA y no en puntos', async () => {
  /* Dos piezas con el mismo deterioro proporcional —la mitad— y CTR muy distintos. En puntos, la
     primera cae 2,0 y la segunda 0,5, así que un umbral en puntos marcaría una y no la otra aunque
     las dos perdieron la mitad de su gancho. */
  await limpiar();
  await unAnuncio(`${MARCA}04`, 'ctr alto');
  await unAnuncio(`${MARCA}05`, 'ctr bajo');
  await unaSerie(`${MARCA}04`, 10, 4, 2);
  await unaSerie(`${MARCA}05`, 10, 1, 0.5);

  assert.equal((await fila('ctr alto'))?.caida, 0.5);
  assert.equal((await fila('ctr bajo'))?.caida, 0.5, 'la caída se midió en puntos y no en proporción');
});

test('un CTR que SUBE da caída negativa, y no se marca como fatiga', async () => {
  await limpiar();
  await unAnuncio(`${MARCA}06`, 'pieza que mejora');
  await unaSerie(`${MARCA}06`, 10, 2, 4);

  const f = await fila('pieza que mejora');

  assert.equal(f?.caida, -1, 'una pieza que mejoró publicó una caída positiva');
  assert.equal(f?.fatigado, false);
});

test('una caída justo bajo el umbral NO se marca, y justo encima sí', async () => {
  await limpiar();
  await unAnuncio(`${MARCA}07`, 'apenas debajo');
  await unAnuncio(`${MARCA}08`, 'apenas encima');
  // 4 → 3,24 es una caída del 19 %; 4 → 3,2 es exactamente el 20 %.
  await unaSerie(`${MARCA}07`, 10, 4, 4 * (1 - CAIDA_QUE_PREOCUPA + 0.01));
  await unaSerie(`${MARCA}08`, 10, 4, 4 * (1 - CAIDA_QUE_PREOCUPA));

  assert.equal((await fila('apenas debajo'))?.fatigado, false);
  assert.equal((await fila('apenas encima'))?.fatigado, true, 'el umbral es inclusivo y no se cumplió');
});

// ─── EL GRANO ───────────────────────────────────────────────────────────────

test('varios anuncios de la misma pieza el mismo día son UN día de serie', async () => {
  /* El defecto silencioso del encabezado. Cuatro días en tres anuncios darían doce «días» y
     superarían el piso de ocho: un veredicto sobre una serie que no existe. */
  await limpiar();
  for (const n of ['09', '10', '11']) {
    await unAnuncio(`${MARCA}${n}`, 'pieza en tres anuncios');
    await unaSerie(`${MARCA}${n}`, 4, 4, 2);
  }

  const f = await fila('pieza en tres anuncios');

  assert.equal(f?.dias, 4, 'los anuncios de la pieza se contaron como días distintos');
  assert.equal(f?.fatigado, null, 'se dio un veredicto sobre una serie inflada por el grano');
});

test('un día SIN entrega no cuenta como día de la serie', async () => {
  // Una pieza que no se mostró no dice nada sobre si cansó a alguien.
  await limpiar();
  await unAnuncio(`${MARCA}12`, 'pieza con huecos');
  await unaSerie(`${MARCA}12`, 4, 4, 2);
  for (let i = 10; i < 20; i += 1) await unDia(`${MARCA}12`, i, null, null);

  const f = await fila('pieza con huecos');

  assert.equal(f?.dias, 4, 'los días sin entrega entraron en la serie');
});

// ─── EL AVISO ───────────────────────────────────────────────────────────────

test('el aviso declara que el umbral es PROVISIONAL, y nombra la mitad que falta', async () => {
  /* El § 18.19 declara pendiente definir los umbrales. Publicar «fatigado» sin decirlo es lo que se
     le critica al prototipo; y sin nombrar la frecuencia, «fatiga» se lee como el indicador completo
     del § 18.12 en vez de como la mitad que se puede construir. */
  await limpiar();
  await unAnuncio(`${MARCA}13`, 'con veredicto');
  await unaSerie(`${MARCA}13`, 10, 4, 2);

  const r = await leer();

  assert.match(String(r.aviso), /provisional/i, 'el aviso no declara que el umbral no está calibrado');
  assert.match(String(r.aviso), /frecuencia/i, 'el aviso no dice que la otra mitad no se puede medir');
});

test('sin ningún veredicto, el aviso NO habla del umbral', async () => {
  // Un aviso que aparece siempre es uno que nadie lee, incluido el que importa.
  await limpiar();
  await unAnuncio(`${MARCA}14`, 'sin veredicto');
  await unaSerie(`${MARCA}14`, 3, 4, 2);

  const r = await leer();

  assert.doesNotMatch(String(r.aviso ?? ''), /provisional/i, 'declaró un umbral que no está usando');
  assert.match(String(r.aviso), /1 de 1 pieza/, 'no dice cuántas piezas quedaron sin veredicto');
  /* ── Y DICE QUE NO SE LISTAN, PORQUE NO SE LISTAN ──────────────────────────
   *
   * El aviso decía *«se muestra su conteo de días y no su tendencia»*. `PanelDeCreative` dibuja
   * sólo las filas con `fatigado !== null`, así que esas piezas no aparecen en ninguna parte:
   * medido el 2026-09-19, eran 21 de 26 que el lector iba a buscar y no iba a encontrar. */
  assert.match(String(r.aviso), /no se listan/, 'promete un listado que la pantalla no dibuja');
  /* Y el MOTIVO es el que corresponde al escenario —tres días contra los ocho que hacen falta—, no
     un «serie insuficiente» genérico: de los tres motivos posibles el aviso agrupaba los tres bajo
     el primero, o sea acusaba de serie corta a piezas con serie larga. */
  assert.match(String(r.aviso), /días de serie/, 'no dice POR QUÉ no hay veredicto');
  assert.equal(r.conSerie.con, 0);
  assert.equal(r.conSerie.sobre, 1);
  assert.equal(r.filas[0]?.motivo, 'pocos-dias', 'el motivo en clave no viaja');
});

test('el aviso del umbral provisional no lleva Markdown: la pantalla lo dibuja crudo', async () => {
  /* ── UN ASTERISCO NO SE VE COMO ÉNFASIS, SE VE COMO UN ERROR ───────────────
   *
   * El aviso viaja como cadena y la pantalla lo mete en un `<p className="cs-fuera">`. Un `<p>` no
   * interpreta Markdown, así que el `**provisional**` que había acá se leía con los asteriscos
   * puestos — y la frase que existe para decir que el umbral NO está calibrado, que es la que
   * separa esta pantalla del prototipo que se le criticó, terminaba pareciendo una falla de la
   * aplicación.
   *
   * Las dos mitades van juntas: sin la primera aserción, borrar la palabra «provisional» entera
   * dejaría esto en verde, y el aviso más importante del módulo se iría sin que nada falle. */
  await limpiar();
  await unAnuncio(`${MARCA}90`, 'pieza con serie larga');
  await unaSerie(`${MARCA}90`, 12, 3, 1);

  const f = await leer();

  assert.match(String(f.aviso), /provisional/i, 'se perdió el aviso de que el umbral no está calibrado');
  assert.doesNotMatch(String(f.aviso), /\*\*|__|\[.+\]\(/, 'el aviso lleva Markdown y la pantalla lo dibuja crudo');
});
