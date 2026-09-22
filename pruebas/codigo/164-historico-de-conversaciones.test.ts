// El histórico de conversaciones: nada de lo que una empresa conversó se pierde.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ CUSTODIAN ESTAS PRUEBAS
//
// La 163 cerró el borrado por RUTINA —refrescar la pestaña ya no reabre el chat—. Pero un reinicio
// explícito («Empezar de nuevo», «Traer del onboarding», o una subida de `VERSION_DEL_AGENTE`)
// seguía pisando el único casillero que hay por herramienta en `tool_chats`. Kevin, 2026-09-22:
// *«no te olvides de no perder las conversaciones que ya tienen las empresas, porque son clientes
// reales»*.
//
// Ahora cada mensaje se archiva en `public.aria_cc_fundaciones_mensajes` (migración 019), una fila
// por mensaje y solo se agrega. Lo que hace que eso funcione son cuatro piezas, y las cuatro se
// rompen en silencio:
//
//   1. **El identificador de la conversación** viaja DENTRO del documento. Si el lector lo pierde,
//      cada turno archiva la misma charla bajo otro identificador y el histórico la muestra
//      repetida una vez por turno.
//   2. **`orden` es el índice del arreglo**, así que el mismo mensaje cae siempre en la misma fila
//      y empujar la lista completa es idempotente.
//   3. **Se archiva la conversación que SE VA, no solo la que queda.** Sin eso, «Empezar de nuevo»
//      seguiría borrando de verdad.
//   4. **Archivar no puede costar un turno.** Hay clientes conversando; el histórico es lo
//      secundario.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import {
  TOPE_DE_MENSAJES_POR_ARCHIVO,
  filasDe,
  idDeConversacion,
  idDeConversacionDerivado,
} from '../../lib/fundaciones/historico.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/* ── ACÁ NO SE LEE LA MIGRACIÓN, Y ES UNA DECISIÓN YA PAGADA ───────────────────
 *
 * `/migraciones` vive en la RAÍZ DEL PROYECTO, fuera de este repositorio, porque el esquema
 * `public` se comparte con la plataforma anterior. La 132 ya tuvo dos pruebas que leían
 * `<raíz>/../migraciones/0NN.sql` y venían rojas desde el día que se escribieron, en local y en la
 * integración continua — y un rojo permanente no se arregla: se ignora, y con él se ignoran los
 * demás.
 *
 * Así que el contrato con la base se comprueba DESDE EL CÓDIGO: los nombres de columna contra
 * `lib/datos/esquema.ts` —que es lo que la consulta usa de verdad— y la semilla del identificador
 * contra `historico.ts`. Lo que la migración hace del otro lado se verifica al correrla: su propio
 * bloque `do $verificar$` lanza si el aislamiento no quedó puesto o si la semilla no rescató todos
 * los mensajes que hay en las conversaciones vivas.
 */

const CHARLA = {
  messages: [
    { role: 'assistant' as const, content: 'Hola. Vamos con «Tu ficha de negocio».' },
    { role: 'user' as const, content: 'conektia' },
    { role: 'assistant' as const, content: '¿En qué nicho estás?' },
  ],
  answers: { biz: 'CONEKTIA' },
  agent_version: 2,
  conversation_id: '11111111-2222-3333-4444-555555555555',
};

test('cada mensaje es una fila, y `orden` es su posición en la conversación', () => {
  const filas = filasDe(CHARLA, { orgId: 'org-1', herramienta: 0, usuarioId: 'u-1' });
  assert.equal(filas.length, 3);
  assert.deepEqual(
    filas.map((f) => f.orden),
    [0, 1, 2],
    '`orden` dejó de ser el índice del arreglo: el mismo mensaje caería en filas distintas según ' +
      'cuándo se archive, y empujar la lista completa duplicaría en vez de deduplicar',
  );
  assert.deepEqual(filas.map((f) => f.rol), ['assistant', 'user', 'assistant']);
  assert.equal(filas[0]?.contenido, 'Hola. Vamos con «Tu ficha de negocio».');
  assert.ok(filas.every((f) => f.conversacion_id === CHARLA.conversation_id));
  assert.ok(filas.every((f) => f.agent_version === 2 && f.herramienta === 0 && f.org_id === 'org-1'));
});

test('el autor firma SOLO los mensajes de la persona', () => {
  /* En los del agente sería mentira —los escribió el modelo— y en pantalla se leería como que
     alguien dijo algo que no dijo. */
  const filas = filasDe(CHARLA, { orgId: 'org-1', herramienta: 0, usuarioId: 'u-1' });
  assert.deepEqual(filas.map((f) => f.usuario_id), [null, 'u-1', null]);

  // Y sin sesión conocida, el mensaje se guarda igual: un autor que falta es un dato menos.
  const anonimas = filasDe(CHARLA, { orgId: 'org-1', herramienta: 0 });
  assert.equal(anonimas.length, 3);
  assert.ok(anonimas.every((f) => f.usuario_id === null));
});

test('una conversación sin identificador recibe uno DERIVADO, no sorteado', () => {
  /* Sortearlo haría que la misma conversación se archivara bajo otro identificador en cada turno:
     el `on conflict` no reconocería nada y el histórico mostraría la charla repetida por turno.
     Las conversaciones de los clientes son justamente las que no lo traen. */
  const sinId = { messages: CHARLA.messages, answers: {} };
  const a = idDeConversacion(sinId, 'ORG-1', 0);
  const b = idDeConversacion(sinId, 'org-1', 0);
  assert.equal(a, b, 'el identificador cambia con las mayúsculas del org_id: la migración lo deriva en minúsculas');
  assert.notEqual(a, idDeConversacion(sinId, 'org-1', 1), 'dos herramientas comparten identificador');
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  // Y el que trae el documento siempre gana sobre el derivado.
  assert.equal(idDeConversacion(CHARLA, 'org-1', 0), CHARLA.conversation_id);
  assert.equal(idDeConversacion(undefined, 'org-1', 0), idDeConversacionDerivado('org-1', 0));
});

test('la semilla del identificador está congelada, porque del otro lado hay una copia', () => {
  /* La migración 019 deriva los identificadores de las conversaciones que ya existían con
     `md5(org_id::text || ':' || herramienta || ':fundaciones-019')`. Son dos implementaciones de la
     misma semilla —una en SQL y otra acá— y si divergen, la misma conversación queda archivada dos
     veces: una por la semilla de la migración y otra por la aplicación.
     No se puede leer el .sql desde acá (ver el comentario de arriba), así que lo que se custodia es
     que ESTE lado no se mueva sin que alguien lo note. */
  const ts = codigo('lib/fundaciones/historico.ts');
  assert.match(
    ts,
    /\$\{orgId\.trim\(\)\.toLowerCase\(\)\}:\$\{herramienta\}:fundaciones-019/,
    'cambió la semilla de este lado: hay que cambiarla también en la migración 019, o el histórico duplica',
  );
  // Y el valor, clavado: es lo que ya quedó escrito en la base el día que se corrió la migración.
  assert.equal(
    idDeConversacionDerivado('8b4ee988-79fd-4c68-9aed-d2b09011e5c3', 1),
    '64934069-95d4-0ea7-bc7f-c687d1e690e8',
    'la derivación dejó de coincidir con lo que la migración 019 escribió para la conversación real ' +
      'de CONEKTIA en el Research: esos 13 mensajes quedarían archivados dos veces',
  );
});

test('lo que no es un mensaje no entra, y una conversación vacía no escribe nada', () => {
  assert.deepEqual(filasDe(undefined, { orgId: 'org-1', herramienta: 0 }), []);
  assert.deepEqual(filasDe({ messages: [], answers: {} }, { orgId: 'org-1', herramienta: 0 }), []);

  const sucia = {
    messages: [
      { role: 'assistant' as const, content: '' },
      { role: 'user' as const, content: 'esto sí' },
    ],
    answers: {},
  };
  const filas = filasDe(sucia, { orgId: 'org-1', herramienta: 3 });
  assert.equal(filas.length, 1, 'un mensaje sin texto entró al histórico');
  assert.equal(filas[0]?.contenido, 'esto sí');
  /* Y conserva su posición REAL: renumerar al saltear rompería la idempotencia contra lo ya
     archivado, que se guardó con el índice del arreglo. */
  assert.equal(filas[0]?.orden, 1);
});

test('el tope recorta la COLA, que es lo último dicho', () => {
  const larga = {
    messages: Array.from({ length: TOPE_DE_MENSAJES_POR_ARCHIVO + 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'assistant' : 'user') as 'assistant' | 'user',
      content: `mensaje ${i}`,
    })),
    answers: {},
  };
  const filas = filasDe(larga, { orgId: 'org-1', herramienta: 0 });
  assert.equal(filas.length, TOPE_DE_MENSAJES_POR_ARCHIVO);
  assert.equal(
    filas[filas.length - 1]?.contenido,
    `mensaje ${TOPE_DE_MENSAJES_POR_ARCHIVO + 9}`,
    'el recorte se quedó con el principio: se pierde lo que se acaba de decir',
  );
});

test('guardar archiva la conversación que QUEDA y también la que SE VA', () => {
  /* La segunda es la que hace que «Empezar de nuevo» y las reaperturas dejen de borrar: al reabrir,
     `estado.chats[id]` todavía tiene la charla anterior, y es lo último que queda de ella antes de
     que el documento vivo la reemplace. */
  const almacen = codigo('lib/fundaciones/almacen.ts');
  assert.match(almacen, /await archivar\(/);
  assert.match(
    almacen,
    /\{ herramienta: id, chat: estado\.chats\[id\] \}/,
    'ya no se archiva la conversación que se va: un reinicio vuelve a borrarla de verdad',
  );
  assert.match(almacen, /\{ herramienta: id, chat: sellado \}/);
});

test('el histórico va DESPUÉS de guardar y no puede tumbar un turno', () => {
  const almacen = codigo('lib/fundaciones/almacen.ts');
  const guardado = almacen.indexOf('const guardado = await escribir(orgId, LLAVES.chats, proximo)');
  const archivo = almacen.indexOf('await archivar(');
  assert.ok(guardado > 0 && archivo > guardado, 'se archiva antes de guardar la conversación viva');
  assert.match(
    almacen,
    /if \(guardado\.tipo !== 'datos'\) return guardado;/,
    'se archiva aunque el guardado haya fallado: se estaría archivando algo que nadie confirmó',
  );

  /* Y el archivador traga TODO lo suyo. Sin esto, una tabla que todavía no existe —la migración se
     corre a mano— convertiría cada turno en un error para la persona. */
  const historico = codigo('lib/fundaciones/historico.ts');
  assert.match(historico, /\} catch \(e\) \{/);
  assert.match(historico, /console\.error\(\s*`historico: no se pudo archivar/);
  assert.match(
    historico,
    /export async function archivar\([\s\S]*?\): Promise<void>/,
    'archivar devuelve algo: quien lo llame va a empezar a ramificar sobre un fallo que no importa',
  );
});

test('el identificador sobrevive al viaje por la base', () => {
  /* El lector del almacén reconstruye el documento campo por campo, así que lo que no nombre se
     PIERDE en el próximo guardado — y perderlo acá no se vería como un error. */
  const almacen = codigo('lib/fundaciones/almacen.ts');
  assert.match(almacen, /leido\.conversation_id = o\['conversation_id'\]/);
  assert.match(
    almacen,
    /conversation_id: idDeConversacion\(chatDeHerramienta, orgId, id\)/,
    'el documento que se guarda dejó de llevar el identificador: las conversaciones viejas nunca lo aprenden',
  );
  const conversacion = codigo('lib/fundaciones/conversacion.ts');
  assert.match(
    conversacion,
    /conversation_id: randomUUID\(\)/,
    'una conversación nueva nace sin identificador propio: se mezclaría con la anterior en el histórico',
  );
});

test('la tabla está declarada en el esquema, con la forma que escribe el archivador', () => {
  const esquema = codigo('lib/datos/esquema.ts');
  assert.match(esquema, /'public\.aria_cc_fundaciones_mensajes': TablaFundacionesMensajes;/);
  for (const columna of ['conversacion_id', 'orden', 'herramienta', 'rol', 'contenido', 'agent_version', 'usuario_id']) {
    assert.match(esquema, new RegExp(`${columna}:`), `la tabla del esquema no declara \`${columna}\``);
  }
});
