// CONVERSATION EN LA TABLA COMÚN: LA TRADUCCIÓN A `issue_source`, UNA SEÑAL POR AGENTE Y PATRÓN, Y SU PLAN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/detectores/conversation.ts` y `lib/agentes/plan/conversation.ts` (AG13 de los agentes; `02`, AG-37;
// `fichas/F05-CONVERSATION.md`):
//
//   · la traducción cubre toda combinación de categoría del auditor y fragmento del prompt;
//   · una señal por agente y patrón, con los casos de la ventana; rojo da `alta`; el más reciente manda;
//   · la evidencia lleva ids, nunca citas de las conversaciones;
//   · sin la tarea del auditor al día, «sin medición»;
//   · el plan: un grupo por agente con su nombre de pantalla, lo más grave primero y, a igual gravedad, el que
//     toca más conversaciones;
//   · el auditor sigue siendo el único escritor de `negocio.hallazgos`: nada en `lib/agentes` lo escribe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIAS_DEL_AUDITOR, CONV, detectarEnConversation, issueSourceDe, type MedidaDeConversation } from '../../lib/agentes/detectores/conversation.ts';
import { armarPlanDeConversation } from '../../lib/agentes/plan/conversation.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import { ISSUE_SOURCES } from '../../lib/agentes/senales/tipos.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const AHORA = new Date('2026-10-06T15:00:00Z');
const haceDias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);

type Caso = MedidaDeConversation['casos'][number];
let n = 0;
const caso = (cambios: Partial<Caso> = {}): Caso => ({
  hallazgoId: `h${(n += 1)}`,
  patron: 'promete_descuento',
  agente: 'chat_post_agenda',
  contactoId: `k${n}`,
  titulo: 'Promete descuentos',
  severidad: 'amarillo',
  categoria: 'comportamiento',
  detectadoEl: haceDias(1),
  fragmentoPrompt: null,
  promptSeccion: null,
  ...cambios,
});

const medida = (casos: Caso[], extra: Partial<MedidaDeConversation> = {}): MedidaDeConversation => ({
  ventana: '7d',
  periodo: { desde: '2026-09-30', hasta: '2026-10-06' },
  casos,
  auditorAlDia: true,
  ahora: AHORA,
  ...extra,
});
const detectar = (m: MedidaDeConversation, firmados: [string, number][] = []) =>
  detectarEnConversation(m, (c) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === c)!, new Map(firmados)));

test('la traducción cubre toda combinación de categoría del auditor y fragmento del prompt (AG-37)', () => {
  const esperado: Record<string, [string | null, string | null]> = {
    comportamiento: ['prompt_design', 'agent_execution'],
    base_conocimiento: ['missing_data', 'missing_data'],
    informacion_adicional: ['missing_data', 'missing_data'],
  };
  assert.deepEqual(Object.keys(esperado).sort(), [...CATEGORIAS_DEL_AUDITOR].sort(), 'el auditor tiene una categoría que la traducción no conoce');
  for (const categoria of CATEGORIAS_DEL_AUDITOR) {
    const [con, sin] = esperado[categoria]!;
    assert.equal(issueSourceDe(categoria, 'Ofrece un descuento si duda.'), con, `${categoria} con fragmento`);
    assert.equal(issueSourceDe(categoria, null), sin, `${categoria} sin fragmento`);
    assert.equal(issueSourceDe(categoria, '   '), sin, `${categoria} con un fragmento vacío`);
    for (const f of [con, sin]) assert.ok(f === null || (ISSUE_SOURCES as readonly string[]).includes(f));
  }
  // Sin categoría no se inventa una fuente.
  assert.equal(issueSourceDe(null, 'algo'), null);
});

test('una señal por agente y patrón, con los casos de la ventana; rojo da alta; el más reciente manda', () => {
  const r = detectar(
    medida([
      caso({ detectadoEl: haceDias(2), titulo: 'Título viejo' }),
      caso({ detectadoEl: haceDias(1), severidad: 'rojo', titulo: 'Promete descuentos', categoria: 'comportamiento', fragmentoPrompt: 'Si duda, ofrece 10 %.' }),
      // Fuera de la ventana de 7 días: no cuenta.
      caso({ detectadoEl: haceDias(9) }),
      // El mismo patrón en el otro agente: otra señal.
      caso({ agente: 'chat_pre_agenda', categoria: 'base_conocimiento' }),
      // Un agente que no es del catálogo: no se publica.
      caso({ agente: 'voz_inbound' as Caso['agente'] }),
    ]),
  );
  const por = Object.fromEntries(r.detecciones.map((d) => [d.entidad.id, d]));
  assert.deepEqual(Object.keys(por).sort(), ['chat_post_agenda:promete_descuento', 'chat_pre_agenda:promete_descuento']);
  const post = por['chat_post_agenda:promete_descuento']!;
  assert.deepEqual([post.entidad.tipo, post.valorActual, post.gravedad, post.issueSource, post.muestra], ['patron', 2, 'alta', 'prompt_design', null]);
  assert.equal((post.evidencia as { titulo: string }).titulo, 'Promete descuentos');
  assert.deepEqual([por['chat_pre_agenda:promete_descuento']!.gravedad, por['chat_pre_agenda:promete_descuento']!.issueSource], ['media', 'missing_data']);
  // En 30 días, el de hace 9 entra.
  assert.equal(detectar(medida([caso({ detectadoEl: haceDias(2) }), caso({ detectadoEl: haceDias(9) })], { ventana: '30d' })).detecciones[0]!.valorActual, 2);
  // Con el umbral firmado en 2, un patrón de un solo caso no se publica.
  assert.equal(detectar(medida([caso()]), [[CONV.patronAbierto, 2]]).detecciones.length, 0);
});

test('la evidencia lleva ids, nunca citas de las conversaciones', () => {
  const [d] = detectar(medida([caso({ contactoId: 'k-uno' }), caso({ contactoId: 'k-uno' })])).detecciones;
  const ev = d!.evidencia as Record<string, unknown>;
  assert.deepEqual(Object.keys(ev).sort(), ['agente', 'amarillos', 'contactos', 'hallazgos', 'patron', 'rojos', 'titulo', 'ventana']);
  assert.deepEqual(ev.contactos, ['k-uno']);
});

test('sin la tarea del auditor al día, «sin medición» y ninguna señal', () => {
  const r = detectar(medida([caso()], { auditorAlDia: false }));
  assert.deepEqual([r.detecciones, r.sinMedicion], [[], [CONV.patronAbierto]]);
});

test('el plan: un grupo por agente, lo más grave primero y, a igual gravedad, el que toca más conversaciones', () => {
  const r = detectar(
    medida([
      // Por orden alfabético, «alfa» iría antes que «zeta»: el que toca más conversaciones tiene que ganarle.
      caso({ patron: 'alfa' }),
      caso({ patron: 'zeta' }),
      caso({ patron: 'zeta' }),
      caso({ patron: 'zeta' }),
      caso({ patron: 'rojo', severidad: 'rojo' }),
      caso({ patron: 'pre', agente: 'chat_pre_agenda' }),
    ]),
  );
  const p = armarPlanDeConversation({ ventana: '7d', dia: '2026-10-06', periodo: { desde: '2026-09-30', hasta: '2026-10-06' }, detecciones: r.detecciones, vigentes: r.detecciones, sinMedicion: [], debajoDelPiso: [] });
  assert.deepEqual(p.grupos.map((g) => [g.clave, g.titulo]), [['chat_post_agenda', 'AppFlow'], ['chat_pre_agenda', 'LeadFlow']]);
  assert.deepEqual(p.grupos[0]!.renglones.map((x) => x.entidad.id), ['chat_post_agenda:rojo', 'chat_post_agenda:zeta', 'chat_post_agenda:alfa']);
  assert.equal(p.grupos[0]!.renglones[1]!.texto, '«Promete descuentos»: 3 conversaciones abiertas; parece venir de cómo el agente sigue su prompt.');
  assert.equal(p.grupos[0]!.renglones[0]!.texto, '«Promete descuentos»: 1 conversación abierta, 1 en rojo; parece venir de cómo el agente sigue su prompt.');
});

test('el auditor sigue siendo el único escritor de `negocio.hallazgos`: nada en `lib/agentes` lo escribe', () => {
  const archivos: string[] = [];
  const caminar = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel))) {
      const r = `${rel}/${e}`;
      if (statSync(join(RAIZ, r)).isDirectory()) caminar(r);
      else if (e.endsWith('.ts')) archivos.push(r);
    }
  };
  caminar('lib/agentes');
  assert.ok(archivos.length > 20, 'no se leyó `lib/agentes`');
  for (const a of archivos) {
    const src = readFileSync(join(RAIZ, a), 'utf8');
    assert.doesNotMatch(src, /(insertInto|updateTable|deleteFrom)\(\s*'hallazgos'/, `${a} escribe en hallazgos`);
    assert.doesNotMatch(src, /(insert into|update|delete from)\s+negocio\.hallazgos/i, `${a} escribe en hallazgos`);
  }
});
