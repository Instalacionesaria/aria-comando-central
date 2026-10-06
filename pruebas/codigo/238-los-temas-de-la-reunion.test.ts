// LOS TEMAS DE LA REUNIÓN DE HOY: CADA REGLA CON SU PISO, EL ORDEN, Y EL FILTRO POR PERSONA ANTES DE TOMAR TRES.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/reunion/temas.ts` y `guardar.ts` (AG15 de los agentes; `04`, AG-70 a AG-73):
//
//   · cada regla medible con su umbral y su piso; debajo, no hay tema;
//   · «crece» sólo cuando la llamada lo dice; si no, el conteo;
//   · las señales de validación ejecutiva entran como CADENA, con su sección;
//   · sin llave, el orden es el de las reglas: gravedad y después pérdida;
//   · se filtra por las secciones de la persona y recién después se toman tres;
//   · con la redacción, el orden del modelo, y lo que no nombró no se pierde.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { ETIQUETAS, REU, temasDeLaReunion, temasParaUnaPersona, type MedidaDeLaReunion } from '../../lib/agentes/reunion/temas.ts';
import { temasEnSuOrden } from '../../lib/agentes/reunion/guardar.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';

const NADA: MedidaDeLaReunion = {
  validacion: [],
  sinEntrega: [],
  entrada: { semana: 0, anterior: 0 },
  citas: { cerrables: 0, citasCerrables: 0, sinRegistrar: 0 },
  objeciones: { analizadas: 0, antes: null, top: null },
  vinculo: { analizadas: 0, sinVinculo: 0 },
};
const temas = (m: Partial<MedidaDeLaReunion>) => temasDeLaReunion({ ...NADA, ...m }, (c) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === c)!, new Map()));
const reglas = (m: Partial<MedidaDeLaReunion>) => temas(m).map((t) => t.regla);

test('las reglas de la Reunión están en el catálogo, y las etiquetas son un juego cerrado', () => {
  for (const codigo of Object.values(REU)) assert.ok(CATALOGO_DE_REGLAS.some((r) => r.codigo === codigo && r.departamento === 'reunion'), codigo);
  assert.deepEqual([...ETIQUETAS], ['CADENA', 'CONTRADICCIÓN', 'PATRÓN', 'SIN DATOS NUEVOS', 'SIN REGISTRAR', 'SIN LECTOR']);
});

test('sin nada medido, ningún tema', () => {
  assert.deepEqual(temas({}), []);
});

test('la caída de la entrada: 40 % o más, con 10 o más en la semana anterior', () => {
  assert.deepEqual(reglas({ entrada: { semana: 6, anterior: 10 } }), [REU.caidaDeEntrada]);
  assert.deepEqual(reglas({ entrada: { semana: 7, anterior: 10 } }), [], 'cae un 30 %');
  assert.deepEqual(reglas({ entrada: { semana: 0, anterior: 9 } }), [], 'bajo el piso');
  assert.equal(temas({ entrada: { semana: 6, anterior: 10 } })[0]!.perdida, 4);
});

test('las citas sin registrar, con 10 o más citas que ya ocurrieron', () => {
  assert.deepEqual(reglas({ citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 3 } }), [REU.citasSinRegistrar]);
  assert.deepEqual(reglas({ citas: { cerrables: 9, citasCerrables: 9, sinRegistrar: 9 } }), []);
  assert.deepEqual(reglas({ citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 0 } }), []);
});

test('la objeción frecuente: con 10 o más analizadas, y «crece» sólo cuando lo dice la llamada', () => {
  const top = { categoria: 'precio', ahora: 9, antes: 3 };
  const crece = temas({ objeciones: { analizadas: 24, antes: 14, top: { ...top, crece: true } } })[0]!;
  assert.equal(crece.texto, 'La objeción «precio» crece: 9 en 14 días, contra 3 antes.');
  const conteo = temas({ objeciones: { analizadas: 24, antes: 8, top: { ...top, crece: null } } })[0]!;
  assert.equal(conteo.texto, 'La objeción más frecuente es «precio»: 9 en 14 días, contra 3 antes.');
  assert.deepEqual(reglas({ objeciones: { analizadas: 9, antes: 14, top: { ...top, crece: true } } }), []);
});

test('las llamadas sin vínculo: una de cada cinco o más, con 10 o más analizadas', () => {
  assert.deepEqual(reglas({ vinculo: { analizadas: 10, sinVinculo: 2 } }), [REU.llamadasSinVinculo]);
  assert.deepEqual(reglas({ vinculo: { analizadas: 10, sinVinculo: 1 } }), []);
  assert.deepEqual(reglas({ vinculo: { analizadas: 9, sinVinculo: 9 } }), []);
});

test('una señal de validación ejecutiva entra como CADENA, con su sección y su nombre', () => {
  const [t] = temas({
    validacion: [{ departamento: 'creative', senal: { id: 's1', regla: 'CRE-CONCENTRACION', entidad: { tipo: 'pieza', id: 'p' }, nombre: 'p', texto: 'Se lleva el 60 % del gasto.', gravedad: 'media', perdidaContactos: null } }],
  });
  assert.deepEqual([t!.etiqueta, t!.seccion, t!.origen, t!.texto], ['CADENA', 'creative', 'Marketing · Creative Insights', 'p: Se lleva el 60 % del gasto. Sobre los últimos 30 días; requiere validación ejecutiva.']);
});

test('«sin entrega» de campañas sueltas, mientras otras siguen: alta, con sus nombres', () => {
  const campana = (id: string, nombre: string | null) => ({ id, entidad: { tipo: 'campana' as const, id }, nombre, texto: 'x', gravedad: 'media' as const });
  const [t] = temas({ sinEntrega: [campana('c1', 'Webinar'), campana('c2', null)] });
  assert.deepEqual([t!.gravedad, t!.texto], ['alta', '2 campañas activas dejaron de entregar mientras otras siguen: Webinar, c2.']);
  assert.equal(temas({ sinEntrega: [campana('c1', 'Webinar')] })[0]!.texto, 'Una campaña activa dejó de entregar mientras otras siguen: Webinar.');
});

test('sin llave, el orden es el de las reglas: gravedad y después pérdida', () => {
  const t = temas({
    entrada: { semana: 0, anterior: 20 }, // alta, pierde 20
    citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 3 }, // media
    sinEntrega: [{ id: 'x', entidad: { tipo: 'empresa', id: 'empresa' }, nombre: null, texto: 'Ninguna campaña entrega.', gravedad: 'critica' }],
  });
  assert.deepEqual(t.map((x) => x.regla), [REU.sinEntrega, REU.caidaDeEntrada, REU.citasSinRegistrar]);
});

test('a igual gravedad, primero la que más contactos pierde; sin pérdida, al final', () => {
  const senal = (id: string, perdida: number) => ({
    departamento: 'conversion' as const,
    senal: { id, regla: 'CNV-X', entidad: { tipo: 'familia_de_entrada' as const, id }, nombre: id, texto: 'x', gravedad: 'media' as const, perdidaContactos: perdida },
  });
  const t = temas({ validacion: [senal('a', 5), senal('b', 20)], citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 3 } });
  assert.deepEqual(t.map((x) => x.clave), ['CNV-X:familia_de_entrada:b', 'CNV-X:familia_de_entrada:a', REU.citasSinRegistrar]);
});

test('se filtra por las secciones de la persona y recién después se toman tres', () => {
  const t = temas({
    sinEntrega: [{ id: 'x', entidad: { tipo: 'empresa', id: 'empresa' }, nombre: null, texto: 'Ninguna campaña entrega.', gravedad: 'critica' }],
    entrada: { semana: 0, anterior: 20 },
    citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 3 },
    objeciones: { analizadas: 24, antes: 14, top: { categoria: 'precio', ahora: 9, antes: 3, crece: true } },
    vinculo: { analizadas: 10, sinVinculo: 5 },
  });
  assert.equal(t.length, 5);
  // Un closer que sólo ve su sección y las llamadas: los dos de Acquisition no son suyos, y aun así le quedan tres.
  assert.deepEqual(temasParaUnaPersona(t, ['closer', 'analizadores']).map((x) => x.seccion), ['closer', 'analizadores', 'analizadores']);
  assert.deepEqual(temasParaUnaPersona(t, ['acquisition']).map((x) => x.regla), [REU.sinEntrega, REU.caidaDeEntrada]);
  assert.deepEqual(temasParaUnaPersona(t, []), []);
});

test('con la redacción, el orden del modelo y su texto; lo que no nombró no se pierde', () => {
  const t = temas({ entrada: { semana: 0, anterior: 20 }, citas: { cerrables: 12, citasCerrables: 12, sinRegistrar: 3 } });
  const r = temasEnSuOrden({ temas: t, redaccion: { orden: [REU.citasSinRegistrar], textos: { [REU.citasSinRegistrar]: 'Tres citas esperan registro.' }, modelo: 'm' } });
  assert.deepEqual(r.map((x) => [x.regla, x.texto]), [
    [REU.citasSinRegistrar, 'Tres citas esperan registro.'],
    [REU.caidaDeEntrada, 'Entraron 0 contactos en los últimos 7 días cerrados, contra 20 en los 7 anteriores.'],
  ]);
  assert.deepEqual(temasEnSuOrden({ temas: t, redaccion: null }), t);
});
