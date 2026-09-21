// La ruta de Sales, POR EL MANEJADOR DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTA RUTA NO DEVUELVE ES LA MITAD DE SU CONTRATO
//
// La mutación más probable de este archivo no es un número mal sumado: es `return ok({ cockpit })`.
// `cockpitDelMes` publica siete indicadores y Sales sólo puede sostener tres. Los otros cuatro
// entrarían sin que nada fallara, con la forma correcta y nombres creíbles:
//
//   · `conCitaAgendada`  **no es del mes** — sale de una etiqueta, y *«una etiqueta no trae fecha»*
//                        (`inicio.ts:44-48`). En una pantalla con selector de período, un número que
//                        no responde al período es la definición del defecto.
//   · `tasaDeAsistencia` está **cableada a `null`** allá. Sales publica la suya, de otra fuente.
//   · `noShows`          cuenta CONTACTOS con etiqueta; la cifra de Sales cuenta CITAS con
//                        `estado_ghl`. Dos poblaciones, un nombre.
//   · `tareasPendientes` no tiene valor honesto acá: Sales no llama a `colasDelDia`, así que sería
//                        un cero fabricado — y es el único campo del cockpit cuyo tipo no obliga a
//                        decidir.
//
// Por eso hay una prueba de forma NEGATIVA, que es rara y acá es la principal.
//
// ── Y LA OTRA MITAD: TRES VENTANAS QUE NO SE PUEDEN CONFUNDIR ──────────────
//
// El período gobierna la cadena, el ciclo, la cancelación y la tabla. **No gobierna el dinero**, que
// es del mes calendario. Y entre las que sí gobierna hay dos poblaciones distintas —quiénes entraron
// contra qué reuniones hubo— que dicen las dos «últimos 30 días».
//
// Si el mismo `dias` no llega a los cuatro bloques, la pantalla muestra cuatro ventanas mientras el
// botón dice una. Se afirma con los cuatro valores, no con la existencia de la clave.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, pedirComo, type Escenario } from '../apoyo/closer.ts';
import { GET as sales, PANTALLA, VENTANAS } from '../../app/api/sales/route.ts';
import { PERIODOS } from '../../lib/negocio/periodo.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

let esc: Escenario;

const CRM = 'crm-ruta-de-sales';

/** Designa a la persona del sembrado como closer, o quita la designación. */
async function conCloser(si: boolean): Promise<void> {
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
  if (si) {
    await esc.admin.query(
      `insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id, actualizado_por)
         values ($1, $2, $3, null)`,
      [esc.org, esc.quien, CRM],
    );
  }
}

before(async () => {
  esc = await montar('RutaDeSales');
  await conCloser(false);
});
after(async () => {
  await conCloser(false);
  await cerrarTodo();
  await cerrarClientes();
});

/** La respuesta cruda, sin tipar: lo que se afirma acá es qué claves hay y cuáles NO. */
async function pedir(periodo?: string): Promise<Record<string, unknown>> {
  const camino = periodo === undefined ? '/api/sales' : `/api/sales?periodo=${periodo}`;
  const r = await sales(pedirComo(camino, esc.token));
  assert.equal(r.status, 200, await r.clone().text());
  return (await r.clone().json()) as Record<string, unknown>;
}

const bloque = (c: Record<string, unknown>, k: string): Record<string, unknown> =>
  c[k] as Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL CABLE TRAMPA DE ADR-0304, EN LAS DOS DIRECCIONES
// ═══════════════════════════════════════════════════════════════════════════════

test('la sección `sales` ya no dice que no tiene operaciones', () => {
  /* `30-portero` lo verifica en las dos direcciones sobre TODAS las secciones, así que esto es
     redundante con él a propósito: dice acá, en el archivo de esta pantalla, cuál es el par que se
     movió junto — la ruta y la bandera. Quien borre esta ruta encuentra la explicación al lado. */
  const seccion = SECCIONES.find((s) => s.clave === PANTALLA);
  assert.ok(seccion, 'la sección `sales` no existe');
  assert.equal(
    seccion.sinOperacionesTodavia,
    undefined,
    'la bandera sigue puesta y esta ruta existe: `ADR-0304` la da por roja en `30-portero`',
  );
  assert.equal(seccion.capacidadRequerida, 'tablero.ver');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA FORMA NEGATIVA: LO QUE NO PUEDE VIAJAR
// ═══════════════════════════════════════════════════════════════════════════════

test('la respuesta NO trae los cuatro indicadores del cockpit que Sales no puede sostener', async () => {
  const cuerpo = await pedir('30d');
  const plano = JSON.stringify(cuerpo);
  for (const prohibido of ['conCitaAgendada', 'tareasPendientes', 'noShows']) {
    assert.equal(
      plano.includes(prohibido),
      false,
      `\`${prohibido}\` viajó en la respuesta: alguien devolvió el cockpit entero en vez de \`dineroDelMes\``,
    );
  }
  /* `tasaDeAsistencia` sí puede aparecer —las filas de closers tienen la suya— pero **nunca dentro
     del bloque de dinero**, que es donde la traería el cockpit. Es la única de las cuatro que
     necesita mirar dónde está y no si está. */
  assert.equal(
    'tasaDeAsistencia' in bloque(cuerpo, 'dinero'),
    false,
    'el bloque de dinero trae la tasa de asistencia cableada a `null` de `cockpitDelMes`',
  );
});

test('el bloque de dinero trae exactamente las cuatro claves de `dineroDelMes`', async () => {
  const cuerpo = await pedir('30d');
  assert.deepEqual(
    Object.keys(bloque(cuerpo, 'dinero')).sort(),
    ['acuerdos', 'cobrado', 'mes', 'ventas'],
    'el bloque de dinero cambió de forma: cualquier campo de más viene del cockpit',
  );
  /* Y el `mes` es un nombre de mes, no «este mes». Sin esto, la pantalla no puede decir en qué zona
     horaria se cortó la ventana — que es lo que la distingue del selector de período de arriba. */
  assert.match(String(bloque(cuerpo, 'dinero')['mes']), /\p{L}/u);
});

test('el sujeto del dinero es la EMPRESA cuando hay closers, y `nadie` sólo cuando no hay', async () => {
  /* Los dos estados salen `—` y se ven idénticos en pantalla, así que lo único que los distingue es
     el TEXTO del `falta` — y los dos mandan a hacer cosas opuestas: uno a configurar un closer, el
     otro a cargar un resultado en Avanzar. `dineroDelMes:164-173` los separa a propósito.
     *
     Lo encontró la mutación: con `catalogo.length >= 0` el sujeto era `nadie` siempre, y la prueba
     pasaba porque nunca sembraba un closer. Un panel que le dice «configurá un closer» a una empresa
     que ya los tiene manda a media docena de personas a mirar una pantalla que ya está bien. */
  await conCloser(false);
  const sin = bloque(bloque(await pedir('30d'), 'dinero'), 'cobrado');
  assert.equal(sin['valor'], null);
  assert.match(String(sin['falta']), /closer configurado/i, 'sin closers no se dice que faltan closers');

  await conCloser(true);
  const con = bloque(bloque(await pedir('30d'), 'dinero'), 'cobrado');
  assert.equal(con['valor'], null, 'sin resultados en el mes, el cobrado no puede ser un número');
  assert.match(
    String(con['falta']),
    /Avanzar/,
    'con closers configurados sigue diciendo que no hay closers: el sujeto quedó en `nadie`',
  );
  await conCloser(false);
});

test('ningún módulo de Sales lee los campos personalizados del CRM', () => {
  /* Es el único hueco donde el dato existe y TIENTA. El CRM tiene «Ticket promedio mensual por
     cliente» lleno en 209 contactos y «Meta de facturación 6 meses» en 216: cualquiera de los dos da
     un revenue plausible y completamente falso, porque son campos de CUALIFICACIÓN del prospecto y
     no del trato. Los tres campos del trato están en 0 de 590.
     *
     Se barre el texto y no las importaciones: un `datos().selectFrom('campos_del_crm')` no aparece
     en ningún `import` y haría exactamente lo mismo. */
  const raiz = join(import.meta.dirname, '..', '..');
  const archivos = [
    'app/api/sales/route.ts',
    'lib/negocio/cadenaDeCierre.ts',
    'lib/negocio/cicloHastaLaCita.ts',
    'lib/negocio/cierrePorCloser.ts',
  ];
  for (const rel of archivos) {
    const texto = readFileSync(join(raiz, rel), 'utf8');
    for (const prohibido of ['campos_del_crm', 'camposDelCrm', 'valores_del_crm']) {
      assert.equal(
        texto.includes(prohibido),
        false,
        `${rel} menciona \`${prohibido}\`: los campos del CRM son del prospecto, no del trato`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PERÍODO
// ═══════════════════════════════════════════════════════════════════════════════

test('un período que no existe se RECHAZA, no se corrige al valor por omisión', async () => {
  /* Incluido `mes`, que es la clave que mandaba el tercer botón del segmentado de la maqueta que
     esta pantalla reemplaza. Recibir 30 días sin enterarse es el defecto: la cifra sale bien
     calculada sobre una ventana que nadie pidió. */
  for (const clave of ['mes', 'ayer', '90d', '30D', 'null']) {
    const r = await sales(pedirComo(`/api/sales?periodo=${clave}`, esc.token));
    assert.equal(r.status, 400, `el período "${clave}" no se rechazó`);
  }
});

test('`?periodo=` VACÍO no es un período inválido: es no haberlo pedido', async () => {
  /* Lo escribí al revés la primera vez y la prueba lo encontró. `periodoDe` trata la cadena vacía
     como ausencia (`periodo.ts:189`), y es deliberado: `?periodo=` es lo que manda un formulario o
     un enlace al que le quitaron el valor, y rechazarlo daría un 400 donde la lectura correcta es
     «no eligió nada».
     *
     Queda fijado para que nadie lo «arregle» en la dirección contraria: lo que se rechaza son claves
     que EXISTEN y no están en la lista, no la ausencia. */
  const r = await sales(pedirComo('/api/sales?periodo=', esc.token));
  assert.equal(r.status, 200);
  const cuerpo = (await r.clone().json()) as Record<string, unknown>;
  const sinParametro = await pedir();
  assert.equal(cuerpo['periodo'], sinParametro['periodo'], 'vacío y ausente dan períodos distintos');
});

test('el MISMO período llega a los cuatro bloques que gobierna, y no al dinero', async () => {
  for (const p of PERIODOS) {
    const cuerpo = await pedir(p.clave);
    assert.equal(cuerpo['periodo'], p.clave, 'la clave no vuelve: el botón podría encenderse solo');
    for (const k of ['cancelacion', 'cadena', 'ciclo', 'closers']) {
      assert.equal(
        bloque(cuerpo, k)['dias'],
        p.dias,
        `el bloque "${k}" quedó en otra ventana con el botón de "${p.clave}" encendido`,
      );
    }
    /* Y el dinero NO tiene `dias`: no lo gobierna el selector, y si algún día lo tuviera sería
       porque alguien lo recalculó acá en vez de consumirlo. */
    assert.equal('dias' in bloque(cuerpo, 'dinero'), false, 'el dinero quedó atado al selector');
  }
});

test('sin período se usa el de omisión, y vuelve dicho cuál fue', async () => {
  const cuerpo = await pedir();
  const porOmision = PERIODOS.find((p) => p.clave === cuerpo['periodo']);
  assert.ok(porOmision, 'volvió una clave de período que no está en `PERIODOS`');
  assert.equal(bloque(cuerpo, 'cadena')['dias'], porOmision.dias);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LAS TRES VENTANAS, QUE VIAJAN DESCRITAS
// ═══════════════════════════════════════════════════════════════════════════════

test('las tres ventanas viajan con su texto: el panel no puede importarlas', async () => {
  /* El panel es `'use client'` y no puede importar nada del servidor. Sin estos textos, la pantalla
     tendría que reescribir a mano la diferencia entre «quiénes entraron» y «qué reuniones hubo» —y
     ahí es donde las dos se vuelven «últimos 30 días» y la tabla deja de cuadrar contra la cadena. */
  const ventanas = bloque(await pedir('30d'), 'ventanas');
  assert.deepEqual(Object.keys(ventanas).sort(), ['citas', 'cohorte', 'mes']);
  for (const [clave, v] of Object.entries(ventanas as Record<string, { titulo: string; que: string }>)) {
    assert.ok(v.titulo.length > 0, `la ventana "${clave}" no tiene título`);
    assert.ok(v.que.length > 30, `la ventana "${clave}" no explica qué población mide`);
  }
});

test('ningún texto que viaja lleva Markdown: la pantalla los dibuja crudos', async () => {
  const cuerpo = await pedir('30d');
  const textos: string[] = [];
  const recoger = (v: unknown): void => {
    if (typeof v === 'string') textos.push(v);
    else if (Array.isArray(v)) v.forEach(recoger);
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(recoger);
  };
  recoger(cuerpo);
  assert.ok(textos.length > 10, 'no se recogió casi ningún texto: el barrido dejó de recorrer');
  for (const t of textos) {
    assert.equal(/\*\*|`|^#|\[.+\]\(/.test(t), false, `este texto lleva Markdown y saldría crudo: ${t}`);
  }
});

test('`VENTANAS` describe poblaciones y no repite los días', () => {
  /* Los días ya viajan en cada bloque. Repetirlos en el texto sería un segundo lugar donde pueden
     dejar de coincidir, y el que se lee es el texto. */
  for (const [clave, v] of Object.entries(VENTANAS)) {
    assert.equal(
      /\b\d+\s*(días|dias)\b/.test(v.que),
      false,
      `la ventana "${clave}" escribe los días a mano: ya viajan en el bloque`,
    );
  }
});
