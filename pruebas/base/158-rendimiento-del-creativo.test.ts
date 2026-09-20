// El hook rate y las tasas de enlace por pieza, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO CENTRAL DE ESTE MÓDULO DA UNA CIFRA BAJA, PLAUSIBLE Y FALSA
//
// El desglose de acciones **no viene en todas las filas**. Remedido el 2026-09-19 sobre los 28 días
// con desglose y sus **240 filas anuncio-día con entrega**: `videoView` en 224 (93 %), `linkClick`
// en 171 (71 %), `landingPageView` en 150 (63 %). El denominador son las filas que tienen desglose
// Y entrega: decir «de 266» metía las de los tres días anteriores a la `053`, que no tienen la
// columna — o sea cometer al medir el mismo error de denominador que este archivo defiende.
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
  assert.equal(f?.hookRate.anuncioDiasConLaClave, 2, 'la cobertura del numerador no viaja');
  assert.equal(f?.hookRate.anuncioDiasConEntrega, 3);
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
  assert.equal(f?.hookRate.anuncioDiasConLaClave, 0);
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

test('un nombre con TABULACIÓN agrupa igual de los dos lados', async () => {
  /* El defecto que esto cierra no llegó a ocurrir, y por eso se pudo arreglar sin datos que
     corregir. La llave de la pieza se calculaba en DOS lugares con DOS funciones: el gasto venía de
     `costoDelAnuncio` y se agrupaba en JavaScript con `.trim().toLowerCase()`, y el desglose se
     agrupaba en la base con `lower(btrim(...))`.
     *
     * No son equivalentes: `btrim` de PostgreSQL recorta **sólo espacios** y `String.trim()` recorta
     * todo el espacio en blanco de Unicode. Un nombre con una tabulación al final —cosa que un
     * copiar y pegar hace solo— daba dos llaves distintas, el desglose no encontraba su fila, y la
     * pieza salía con su gasto y un guion en el hook rate, el link CTR y la landing.
     *
     * **Se vería exactamente igual que una pieza que no es video.** Ésa es toda la gravedad: no hay
     * forma de distinguirlas mirando la pantalla. */
  await limpiar();
  await unAnuncio(`${MARCA}15`, 'pieza con tabulacion	');
  await unDia(`${MARCA}15`, 1, { gasto: 20, impresiones: 4000, clics: 80 }, { videoView: 800 });

  const r = await leer();
  const f = r.filas.find((x) => x.creativo.startsWith('pieza con tabulacion'));

  assert.ok(f, 'la pieza desapareció de la tabla');
  assert.equal(f?.gasto, 20, 'el gasto tenía que llegar igual');
  assert.equal(
    f?.hookRate.tasa,
    20,
    'el gasto llegó y el desglose no: las dos mitades se agruparon con llaves distintas',
  );
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
  assert.equal(f?.clickToLanding.anuncioDiasConLaClave, 1);
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

test('el desglose tiene su PROPIA fecha de inicio, y viaja como campo para que la pantalla la diga UNA vez', async () => {
  /* ── ESTA PRUEBA CAMBIÓ DE CONTRATO, Y CONVIENE DECIR POR QUÉ ──────────────
   *
   * La columna `acciones` nació con la `053`, así que hay gasto de días que no tienen desglose. Una
   * pantalla que diga «30 días» mientras el hook rate habla de dos afirma algo falso.
   *
   * Antes esto exigía que **el aviso** trajera la fecha. Y la pantalla ya la trae: el bloque de
   * cobertura de `PanelDeCreative.jsx` arma la frase de las tres ventanas con `fechaCorta`. O sea
   * que el mismo hecho se dibujaba dos veces en la misma pantalla, una en `21 ago` y otra en
   * `2026-08-21` — dos formas del mismo dato se leen como dos datos. La prueba vieja **exigía el
   * defecto**, que es el modo de fallo más caro de una prueba.
   *
   * El contrato correcto es el de abajo: el CAMPO viaja —que es lo que la pantalla lee— y el aviso
   * NO lo repite. Y se comprueban las dos mitades: sin la segunda, volver a meter la frase en el
   * aviso dejaría esto en verde. */
  await limpiar();
  await unAnuncio(`${MARCA}11`, 'pieza con dos ventanas');
  await unDia(`${MARCA}11`, 20, { gasto: 10, impresiones: 3000 }, null);
  await unDia(`${MARCA}11`, 2, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  assert.notEqual(r.desde, r.desdeElDesglose, 'las dos ventanas salieron iguales');
  assert.ok(r.desdeElDesglose, 'el campo con el que la pantalla arma la frase no llegó');
  assert.doesNotMatch(
    String(r.aviso ?? ''),
    new RegExp(String(r.desdeElDesglose)),
    'el aviso volvió a traer la fecha: la pantalla la dibujaría dos veces, en dos formatos',
  );
});

test('sin ningún desglose guardado, el campo dice null y la pantalla tiene con qué contarlo', async () => {
  /* Mismo cambio de contrato que la prueba de arriba: el caso «no hay ningún día» lo dibuja el
     bloque de cobertura del panel, que tiene su propia rama para el nulo. Lo que se exige acá es
     que el campo sea `null` y no `0` ni una cadena vacía —los dos ceros— porque de esa distinción
     depende cuál de las dos frases dibuja la pantalla. */
  await limpiar();
  await unAnuncio(`${MARCA}12`, 'pieza sin desglose');
  await unDia(`${MARCA}12`, 1, { gasto: 10, impresiones: 3000 }, null);

  const r = await leer();

  assert.equal(r.desdeElDesglose, null, 'sin ningún día con desglose el campo tiene que ser nulo');
  /* Y el gasto SÍ está: «no hay desglose» no es «no hay nada», y si las dos salieran nulas la
     pantalla no podría decir que una ventana es más corta que la otra. */
  assert.ok(r.desde, 'el gasto de ese día tendría que estar igual');
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

test('los huecos viajan con su motivo, para que la pantalla los pueda dibujar', async () => {
  /* ── POR QUÉ ESTO ES UNA PRUEBA Y NO UNA CONSTANTE QUE NADIE MIRA ──────────
   *
   * La decisión del usuario del 2026-09-18 fue «sólo GHL, **y el hueco se declara**». La maqueta
   * que había en esta pantalla dibujaba la curva de retención, el placement y la miniatura de cada
   * pieza con números inventados; quien conocía esa pantalla los va a buscar.
   *
   * Un hueco que se omite no se distingue de una regresión: en los dos casos la pantalla no lo
   * muestra y nada lo dice. Esta prueba muere si la lista se vacía, si algún motivo queda en blanco
   * —un «no se puede» sin el porqué manda a alguien a intentarlo igual— y si el punto más caro de
   * medir, el enum cerrado de `fields`, desaparece de la lista. */
  await limpiar();
  await unAnuncio(`${MARCA}14`, 'pieza cualquiera');
  await unDia(`${MARCA}14`, 1, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  assert.ok(r.fueraDeAlcance.length >= 4, `llegaron ${r.fueraDeAlcance.length} huecos, se esperaban 4`);

  for (const f of r.fueraDeAlcance) {
    assert.ok(f.punto?.trim(), 'un hueco sin nombre');
    assert.ok(
      f.porque?.trim().length > 40,
      `«${f.punto}» no dice por qué no se puede: un hueco sin motivo manda a alguien a rehacer la medición`,
    );
  }

  /* El enum cerrado de `fields` es el que cuesta un día de sondas volver a medir, y es el que tumba
     la mitad del § 18.12. Si se cae de la lista, la pantalla deja de explicar su hueco más grande. */
  assert.ok(
    r.fueraDeAlcance.some((f) => /cuartiles|retención/i.test(f.punto) && /422|enum/i.test(f.porque)),
    'se perdió el hueco de los cuartiles de video, que es el más caro de volver a medir',
  );
});

test('los días de la pieza son DÍAS, no anuncio-día: dos anuncios el mismo día son un día', async () => {
  /* ── EL DEFECTO SUMABA A LO LARGO DE LOS ANUNCIOS Y DABA UN NÚMERO MÁS GRANDE ──
   *
   * Medido en producción el 2026-09-19: **11 de 26 piezas** daban un conteo inflado, hasta en 7
   * días. No pasaba de los 30 de la ventana por casualidad del borde. Acá el escenario es exacto:
   * dos anuncios de la MISMA pieza entregando el MISMO día son un día de calendario y dos
   * anuncio-día. Un `sum` en vez de un `count(distinct fecha)` devuelve 2 y nadie puede notarlo
   * mirando la pantalla. */
  await limpiar();
  await unAnuncio(`${MARCA}15`, 'pieza de dos anuncios');
  await unAnuncio(`${MARCA}16`, 'pieza de dos anuncios');
  await unDia(`${MARCA}15`, 1, { gasto: 10, impresiones: 2000 }, { videoView: 400 });
  await unDia(`${MARCA}16`, 1, { gasto: 12, impresiones: 3000 }, { videoView: 600 });

  const f = (await leer()).filas.find((x) => x.creativo === 'pieza de dos anuncios');

  assert.equal(f?.anuncios, 2, 'la pieza tiene que correr en dos anuncios');
  assert.equal(f?.diasConEntrega, 1, 'dos anuncios el mismo día son UN día de calendario');
  /* Y la cobertura sigue siendo anuncio-día, que es su grano correcto: el denominador de la tasa
     son las impresiones sumadas sobre los dos. Si los dos campos dieran lo mismo, uno de los dos
     estaría midiendo lo que no es. */
  assert.equal(f?.hookRate.anuncioDiasConEntrega, 2, 'la cobertura es anuncio-día');
});

test('los días de la pieza cuentan IMPRESIONES y no gasto: un día que costó y no se mostró no entregó', async () => {
  /* Medido: 35 de 275 filas anuncio-día de producción tienen gasto y no tienen impresiones. El
     predicado viejo venía de `costoDelAnuncio`, que cuenta `gasto is not null`, y la propia frase
     de la pantalla decía lo contrario: «no es que gastara cero: no se mostró». */
  await limpiar();
  await unAnuncio(`${MARCA}17`, 'pieza que costo sin mostrarse');
  await unDia(`${MARCA}17`, 1, { gasto: 9, impresiones: null }, null);
  await unDia(`${MARCA}17`, 2, { gasto: 11, impresiones: 4000 }, { videoView: 800 });

  const f = (await leer()).filas.find((x) => x.creativo === 'pieza que costo sin mostrarse');

  assert.equal(f?.diasConEntrega, 1, 'el día con gasto y sin impresiones NO entregó');
});

test('el click-to-landing no publica una tasa por debajo del piso, y con el piso justo sí', async () => {
  /* Medido el 2026-09-19: de las 24 piezas con cruce, **8 tienen menos de diez clics al enlace y la
     más chica tiene UNO**. Sin piso, la pantalla publicaba «100 %» sobre un clic al lado de un 64 %
     construido sobre mil, y las dos celdas se ven igual. El comentario del módulo ya afirmaba que
     el piso existía. Las dos mitades van juntas: sin la de abajo, subir el piso a mil dejaría la
     prueba en verde. */
  await limpiar();
  await unAnuncio(`${MARCA}18`, 'pieza de nueve clics');
  await unDia(`${MARCA}18`, 1, { gasto: 10, impresiones: 3000 }, { linkClick: 9, landingPageView: 9 });
  await unAnuncio(`${MARCA}19`, 'pieza de diez clics');
  await unDia(`${MARCA}19`, 1, { gasto: 10, impresiones: 3000 }, { linkClick: 10, landingPageView: 5 });

  const r = await leer();
  const nueve = r.filas.find((x) => x.creativo === 'pieza de nueve clics');
  const diez = r.filas.find((x) => x.creativo === 'pieza de diez clics');

  assert.equal(nueve?.clickToLanding.tasa, null, 'nueve clics no alcanzan para una tasa');
  /* Y la CANTIDAD sí viaja: «no alcanza para una tasa» no es «no hay dato». Son los dos ceros. */
  assert.equal(nueve?.clickToLanding.cantidad, 9);
  assert.equal(diez?.clickToLanding.tasa, 50, 'con el piso justo la tasa se publica');
});

test('el CTR de la pieza obedece el piso de impresiones, y los conteos siguen viajando', async () => {
  /* Medido el 2026-09-19 sobre los 30 días: **12 de 26 piezas** quedan por debajo del piso, y la de
     mayor CTR entre ellas da 5,816 % sobre 122 impresiones — o sea que se dibujaba arriba de todo
     como la mejor pieza del departamento. `PISO_DE_IMPRESIONES` se declara en el mismo archivo como
     obligatorio para «una tasa cuyo denominador son impresiones», y el CTR era el único que no lo
     respetaba. */
  await limpiar();
  await unAnuncio(`${MARCA}20`, 'pieza de pocas impresiones');
  await unDia(`${MARCA}20`, 1, { gasto: 3, impresiones: PISO_DE_IMPRESIONES - 1, clics: 58 }, null);
  await unAnuncio(`${MARCA}21`, 'pieza con el piso justo');
  await unDia(`${MARCA}21`, 1, { gasto: 3, impresiones: PISO_DE_IMPRESIONES, clics: 20 }, null);

  const r = await leer();
  const poca = r.filas.find((x) => x.creativo === 'pieza de pocas impresiones');
  const justa = r.filas.find((x) => x.creativo === 'pieza con el piso justo');

  assert.equal(poca?.ctr, null, 'una impresión menos que el piso no publica CTR');
  /* Y los dos conteos siguen: «no alcanza para una tasa» no es «no hay dato». Quien mire la fila
     tiene que poder ver sobre qué base se decidió callar. */
  assert.equal(poca?.impresiones, PISO_DE_IMPRESIONES - 1);
  assert.equal(poca?.clics, 58);
  assert.equal(justa?.ctr, 2, 'con el piso justo el CTR se publica');
});

test('ningún aviso lleva Markdown: la pantalla los dibuja crudos', async () => {
  /* ── UN ASTERISCO NO SE VE COMO ÉNFASIS, SE VE COMO UN ERROR ───────────────
   *
   * Los avisos viajan como cadena y la pantalla los mete en un `<p>` y en un `title=`. Ninguno de
   * los dos interpreta Markdown, así que un `**provisional**` se lee con los asteriscos puestos —y
   * la frase que existe para dar confianza en la cifra termina pareciendo una falla de la
   * aplicación. Pasó en el aviso de fatiga.
   *
   * Se comprueba acá y sobre los tres módulos porque el error es de escritura, no de un módulo: el
   * próximo que redacte un aviso va a querer poner en negrita la palabra importante. */
  await limpiar();
  await unAnuncio(`${MARCA}22`, 'pieza cualquiera para el aviso');
  await unDia(`${MARCA}22`, 1, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  for (const [donde, texto] of [['rendimiento', r.aviso]] as const) {
    if (texto === null) continue;
    assert.doesNotMatch(texto, /\*\*|__|\[.+\]\(/, `el aviso de ${donde} lleva Markdown crudo`);
  }
});

test('los títulos de las columnas viajan en la respuesta, no se importan', async () => {
  /* ── POR QUÉ ES UNA PRUEBA Y NO «ya lo vería el build» ─────────────────────
   *
   * La pantalla es `'use client'` y este módulo abre la base. Importar `ACCIONES_QUE_LEEMOS` desde
   * el navegador arrastra `pg` —y con él `fs`, `dns` y `net`— al paquete: el build falla con
   * «Can't resolve 'dns'». O sea que esa mitad ya la vigila el build, y ruidosamente.
   *
   * Lo que el build NO vigila es lo contrario: que alguien borre `titulos` de la respuesta y
   * reescriba los tres rótulos a mano en el JSX. Eso compila, se ve idéntico, y deja la definición
   * de `videoView` escrita en dos lugares — justo la que el proveedor no documenta y por la que
   * alguien podría reescribir un gancho creyendo que cuenta tres segundos. */
  await limpiar();
  await unAnuncio(`${MARCA}23`, 'pieza para los titulos');
  await unDia(`${MARCA}23`, 1, { gasto: 10, impresiones: 3000 }, { videoView: 600 });

  const r = await leer();

  for (const k of ['videoView', 'linkClick', 'landingPageView', 'postEngagement'] as const) {
    assert.ok(r.titulos[k]?.trim(), `falta el título de ${k}`);
  }
  /* Y el de `videoView` NO puede afirmar una definición que la fuente no da: nada de «tres
     segundos» ni «ThruPlay» en el rótulo. Eso se dice en el aviso, con su matiz. */
  assert.doesNotMatch(r.titulos.videoView, /thruplay|tres segundos|3 ?s/i);
});
