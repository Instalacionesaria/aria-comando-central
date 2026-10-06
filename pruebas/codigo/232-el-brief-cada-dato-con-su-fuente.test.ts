// EL BRIEF DEL CLOSER: CADA DATO CON SU FUENTE, Y LO DE LA EMPRESA MARCADO COMO TAL. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `validarBrief` (`lib/agentes/brief/brief.ts`, AG12 de los agentes; `fichas/F13-CLOSER-Y-BRIEF.md`, AG-F13-1):
//
//   · un dato «detectado» sin fuente, con una fuente que no se le dio, o con una cita que no está en esa fuente,
//     se degrada a AMBIGUO —inventar cuesta una cita verificable—; una cita con otro espaciado sigue valiendo;
//   · la objeción es «de la empresa» si y sólo si su fuente son las objeciones frecuentes, diga lo que diga el
//     modelo, y esa fuente sólo existe si la empresa tiene objeciones;
//   · lo que no consta no lleva valor, y cada sección tiene su techo;
//   · lo que viaja al modelo no lleva teléfono ni correo.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { DATOS_POR_SECCION, FUENTE_DE_LA_EMPRESA, fuentesDe, pedidoDelBrief, validarBrief } from '../../lib/agentes/brief/brief.ts';
import type { EntradaDelBrief } from '../../lib/agentes/brief/entrada.ts';

const ENTRADA: EntradaDelBrief = {
  cita: { id: 'c1', inicioEl: '2026-10-06T15:00:00.000Z', contactoId: 'k1' },
  nombre: 'Persona sintética',
  formulario: [
    { fuente: 'formulario:1', etiqueta: 'Facturación mensual', valor: 'Entre 10 y 20 mil dólares' },
    { fuente: 'formulario:2', etiqueta: 'Su mayor problema', valor: 'No consigo   clientes nuevos' },
  ],
  ficha: [{ fuente: 'ficha:campana', etiqueta: 'Campaña por la que entró', valor: 'Webinar' }],
  llamada: [{ fuente: 'llamada:objecion', etiqueta: 'Su objeción principal', valor: 'El precio', cita: 'Me parece caro', minuto: 12 }],
  objecionesFrecuentes: [{ categoria: 'precio', veces: 12 }],
  sinFormulario: false,
  huella: 'x'.repeat(64),
};
const FUENTES = fuentesDe(ENTRADA);

const dato = (cambios: Record<string, unknown>) => ({ etiqueta: 'X', estado: 'DETECTADO', valor: 'algo', fuente: 'formulario:1', cita: '10 y 20 mil', confianza: 'ALTA', ...cambios });
const respuesta = (quienEs: unknown[], objecion: Record<string, unknown> = dato({}), extra: Record<string, unknown> = {}) => ({
  quienEs,
  queDijo: [],
  objecionProbable: { ...objecion, sugerencia: 'Pregunta qué compara.' },
  preguntaParaAbrir: '¿Qué te llevó a agendar?',
  ...extra,
});

test('lo detectado con su fuente y su cita se acepta; una cita con otro espaciado o mayúsculas, también', () => {
  const b = validarBrief(respuesta([dato({}), dato({ fuente: 'formulario:2', cita: 'no consigo clientes NUEVOS' })]), FUENTES);
  assert.deepEqual(b.quienEs.map((d) => d.estado), ['DETECTADO', 'DETECTADO']);
  assert.equal(b.degradados, 0);
});

test('lo detectado sin fuente, con una fuente que no se le dio o con una cita que no está, se degrada a AMBIGUO', () => {
  const b = validarBrief(
    respuesta([
      dato({ fuente: null }),
      dato({ fuente: 'formulario:9' }),
      dato({ cita: 'factura un millón' }),
      dato({ cita: null }),
      // La cita de una llamada vale contra su cita guardada.
      dato({ fuente: 'llamada:objecion', cita: 'me parece caro' }),
    ]),
    FUENTES,
  );
  assert.deepEqual(b.quienEs.map((d) => [d.estado, d.confianza]), [
    ['AMBIGUO', 'BAJA'],
    ['AMBIGUO', 'BAJA'],
    ['AMBIGUO', 'BAJA'],
    ['AMBIGUO', 'BAJA'],
    ['DETECTADO', 'ALTA'],
  ]);
  assert.equal(b.degradados, 4);
});

test('la objeción es «de la empresa» sólo por su fuente, diga lo que diga el modelo', () => {
  const dela = validarBrief(respuesta([], dato({ fuente: FUENTE_DE_LA_EMPRESA, cita: null, valor: 'precio', deLaEmpresa: false })), FUENTES);
  assert.deepEqual([dela.objecionProbable.estado, dela.objecionProbable.deLaEmpresa], ['DETECTADO', true]);
  // Dicha por la persona y con el modelo diciendo que es de la empresa: no lo es.
  const suya = validarBrief(respuesta([], dato({ fuente: 'llamada:objecion', cita: 'Me parece caro', deLaEmpresa: true })), FUENTES);
  assert.equal(suya.objecionProbable.deLaEmpresa, false);
  // Sin objeciones en la empresa, esa fuente no existe: se degrada.
  const sinEmpresa = validarBrief(
    respuesta([], dato({ fuente: FUENTE_DE_LA_EMPRESA, cita: null })),
    fuentesDe({ ...ENTRADA, objecionesFrecuentes: [] }),
  );
  assert.deepEqual([sinEmpresa.objecionProbable.estado, sinEmpresa.objecionProbable.deLaEmpresa], ['AMBIGUO', false]);
});

test('lo que no consta no lleva valor, y cada sección tiene su techo', () => {
  const b = validarBrief(respuesta(Array.from({ length: DATOS_POR_SECCION + 3 }, () => dato({ estado: 'NO_CONSTA', valor: 'algo' }))), FUENTES);
  assert.equal(b.quienEs.length, DATOS_POR_SECCION);
  assert.ok(b.quienEs.every((d) => d.valor === null));
  // Lo que no es de la forma pedida no rompe: queda vacío.
  const vacio = validarBrief('no es un objeto', FUENTES);
  assert.deepEqual([vacio.quienEs, vacio.queDijo, vacio.preguntaParaAbrir, vacio.objecionProbable.estado], [[], [], '', 'NO_CONSTA']);
});

test('lo que viaja al modelo son las fuentes con sus claves, sin teléfono ni correo', () => {
  const p = pedidoDelBrief(ENTRADA);
  assert.deepEqual(p.fuentes.map((f) => f.fuente), ['formulario:1', 'formulario:2', 'ficha:campana', 'llamada:objecion']);
  assert.doesNotMatch(JSON.stringify(p), /"(telefono|email|correo|phone)"/);
});
