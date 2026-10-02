// Un grupo es una entrada con sub-pestañas, y cada una se ve por su propia sección. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md, NE-45 y NE-46)
//
// La segunda edición junta entradas que ya existían en una sola de la barra: Radar (el Espía y el
// Scraper), Funnel (Tu landing y Tu VSL) y Leads (Todos, De GHL, De Radar y el Plan de prospección).
// En la tabla siguen planas, cada una con su sección, y `menuPorDepartamentos` las pliega. Cinco formas
// de romperlo no fallan:
//
//   · que una sub-pestaña se vea por la sección de otra: Leads cruza el Leads Portal y Tools, y quien
//     tiene uno solo tocaría una puerta que el servidor le cierra;
//   · que un grupo aparezca sólo por su «Próximamente», o que abra una: Leads con sólo «Todos», que
//     no abre nada (`NE-13`);
//   · que el grupo se parta o se mude de departamento porque sus filas no van juntas en la tabla, o
//     que dos entradas se llamen igual: la barra y la cabecera marcan por el nombre;
//   · que la entrada abierta no encuentre la sub-pestaña —la barra no marcaría nada y la cabecera no
//     se dibujaría en Sales › Leads › De Radar—, o que el lugar que dicen los textos no lleve el grupo;
//   · que lo que la barra mira para el punto «scrapeando» sea la entrada del grupo y no lo que abre.
//
// Lo que se EJECUTA: `menuPorDepartamentos` sobre `menuVisible`, `entradaAbierta`, `queAbre` y
// `lugarDe`, con todas las capacidades y con pedazos.
//
// Y desde la etapa F2, el contador (`NE-48`) y el engranaje (`NE-49`): cuántas entradas tiene cada
// departamento con todo a la vista, como el diseño, y lo que viaja con cada destino del engranaje —su
// ceja, su subtítulo y si sólo se ve desde la principal, que sale del menú y no de la clave—.
//
// Las mutaciones que la ponen en rojo: mover el Scraper detrás de Conversation, o una sub-pestaña de
// Funnel a Sales; nombrar un grupo como una de sus sub-pestañas; dar nombre propio a una sección entera
// fuera de un grupo; no plegar los grupos; dejar pasar un grupo sin nada que abrir; abrir la primera
// sub-pestaña aunque sea «Próximamente»; mostrar las sub-pestañas de un grupo por la sección de la
// primera; que `entradaAbierta` mire la sección del grupo y no las de sus sub-pestañas, o devuelva la
// sub-pestaña como entrada; que `queAbre` dé la entrada del grupo o las «Próximamente»; y un `lugarDe`
// sin el grupo. De F2: plegar distinto (otro número por departamento), otra ceja del engranaje y
// `soloDeLaPrincipal` sacado de la clave en vez del menú.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTAMENTOS,
  ENTRADAS,
  entradaAbierta,
  lugarDe,
  menuPorDepartamentos,
  queAbre,
  type EntradaVisible,
} from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES, menuVisible, type Alcance } from '../../lib/autorizacion/secciones.ts';

const TODAS = new Set(SECCIONES.map((s) => s.capacidadRequerida));
const navegacion = (alcance: Alcance = { restringido: false }, permisos: ReadonlySet<string> = TODAS) =>
  menuPorDepartamentos(menuVisible(permisos, alcance, true));
/** Alguien con el alcance restringido a estas secciones (el rol `usuario`). */
const soloCon = (...secciones: string[]) => navegacion({ restringido: true, concedidas: new Set(secciones) });
const entradasDe = (n: ReturnType<typeof navegacion>, clave: string): EntradaVisible[] =>
  n.departamentos.find((d) => d.clave === clave)?.entradas ?? [];
const grupo = (n: ReturnType<typeof navegacion>, departamento: string, nombre: string) => {
  const e = entradasDe(n, departamento).find((x) => x.nombre === nombre);
  return e && 'subs' in e ? e : undefined;
};
const nombresDe = (e: { subs?: { nombre: string; proximamente?: true }[] } | undefined) =>
  (e?.subs ?? []).map((s) => (s.proximamente ? `${s.nombre} (próximamente)` : s.nombre));

test('las sub-pestañas de un grupo van juntas, en un solo departamento, y ningún nombre se repite', () => {
  const grupos = new Map<string, number[]>();
  ENTRADAS.forEach((e, i) => {
    if (e.grupo !== undefined) grupos.set(e.grupo, [...(grupos.get(e.grupo) ?? []), i]);
  });
  assert.deepEqual([...grupos.keys()], ['Radar', 'Funnel', 'Leads'], 'los grupos no son los de `NE-45`');
  for (const [nombre, indices] of grupos) {
    // Juntas: la barra dibuja el grupo donde está la primera, y una suelta en el medio cambiaría el orden.
    assert.deepEqual(indices, indices.map((_, k) => indices[0]! + k), `las sub-pestañas de ${nombre} no van juntas en la tabla`);
    const departamentos = new Set(indices.map((i) => ENTRADAS[i]!.departamento));
    assert.equal(departamentos.size, 1, `${nombre} está repartido en ${[...departamentos].join(' y ')}`);
    // Un grupo con una sola sub-pestaña no es un grupo.
    assert.ok(indices.length > 1, `${nombre} tiene una sola sub-pestaña`);
  }
  /* La barra y la cabecera marcan por el nombre: en cada departamento, los nombres de lo que la barra
     dibuja —entradas sueltas y grupos— no se repiten, y en cada grupo, tampoco los de sus sub-pestañas. */
  const nombreDeLaSeccion = new Map(SECCIONES.map((s) => [s.clave, s.nombre]));
  for (const d of DEPARTAMENTOS) {
    const visibles: string[] = [];
    const vistos = new Set<string>();
    for (const e of ENTRADAS) {
      if (e.departamento !== d.clave) continue;
      if (e.grupo !== undefined) {
        // Un grupo, una vez: sus sub-pestañas son una sola entrada de la barra.
        if (!vistos.has(e.grupo)) visibles.push(e.grupo);
        vistos.add(e.grupo);
      } else visibles.push(e.nombre ?? ('seccion' in e ? nombreDeLaSeccion.get(e.seccion)! : ''));
    }
    assert.equal(new Set(visibles).size, visibles.length, `${d.nombre} tiene dos entradas con el mismo nombre: ${visibles.join(', ')}`);
  }
  for (const [nombre, indices] of grupos) {
    const subs = indices.map((i) => ENTRADAS[i]!.nombre);
    assert.equal(new Set(subs).size, subs.length, `${nombre} repite una sub-pestaña`);
    assert.ok(!subs.includes(nombre), `${nombre} se llama como una de sus sub-pestañas: la cabecera no sabría cuál marcar`);
  }
  // Una sección entera lleva nombre propio sólo dentro de un grupo: fuera, el nombre sale del menú.
  for (const e of ENTRADAS) {
    if ('proximamente' in e || e.pestana !== undefined || e.grupo !== undefined) continue;
    assert.equal(e.nombre, undefined, `\`${e.seccion}\` lleva nombre propio fuera de un grupo: se separaría del menú`);
  }
});

test('la barra recibe una entrada por grupo, con sus sub-pestañas en orden', () => {
  const n = navegacion();
  assert.deepEqual(entradasDe(n, 'research').map((e) => e.nombre), ['ICP & Oferta', 'Radar']);
  assert.deepEqual(nombresDe(grupo(n, 'research', 'Radar')), ['Espía a tus competidores', 'Scraper']);
  assert.deepEqual(nombresDe(grupo(n, 'marketing', 'Funnel')), ['Tu landing', 'Tu VSL']);
  assert.deepEqual(nombresDe(grupo(n, 'sales', 'Leads')), ['Todos (próximamente)', 'De GHL', 'De Radar', 'Plan de prospección']);
  // Lo que NO es un grupo no lleva sub-pestañas.
  for (const d of n.departamentos) {
    for (const e of d.entradas) {
      if (!['Radar', 'Funnel', 'Leads'].includes(e.nombre)) assert.ok(!('subs' in e) || e.subs === undefined, `«${e.nombre}» lleva sub-pestañas sin ser un grupo`);
    }
  }
});

test('un grupo abre su primera sub-pestaña que abre algo, y sin ninguna no aparece', () => {
  const leads = (n: ReturnType<typeof navegacion>) => {
    const g = grupo(n, 'sales', 'Leads');
    return g ? { seccion: g.seccion, pestana: g.pestana, subs: nombresDe(g) } : null;
  };
  // Con las dos secciones abre «De GHL», no «Todos»: una «Próximamente» no abre nada (`NE-38`).
  assert.deepEqual(leads(navegacion()), { seccion: 'contacts', pestana: null, subs: ['Todos (próximamente)', 'De GHL', 'De Radar', 'Plan de prospección'] });
  /* Cada sub-pestaña se ve por SU sección (`NE-46`): con Tools y sin el Leads Portal, Leads abre «De
     Radar» y no ofrece «De GHL»; con el Leads Portal y sin Tools, al revés. */
  assert.deepEqual(leads(soloCon('tools')), { seccion: 'tools', pestana: 'mis-leads', subs: ['Todos (próximamente)', 'De Radar', 'Plan de prospección'] });
  assert.deepEqual(leads(soloCon('contacts')), { seccion: 'contacts', pestana: null, subs: ['Todos (próximamente)', 'De GHL'] });
  // Sin ninguna de las dos, Leads no aparece por su «Todos», aunque Sales sí aparezca.
  const closer = soloCon('closer', 'setter');
  assert.deepEqual(entradasDe(closer, 'sales').map((e) => e.nombre), ['Setter', 'Closer'], 'un grupo aparece sólo por su «Próximamente»');
  // Radar y Funnel abren su primera.
  const n = navegacion();
  assert.deepEqual([grupo(n, 'research', 'Radar')?.seccion, grupo(n, 'research', 'Radar')?.pestana], ['tools', 'espia']);
  assert.deepEqual([grupo(n, 'marketing', 'Funnel')?.seccion, grupo(n, 'marketing', 'Funnel')?.pestana], ['tools', 'landing']);
});

test('la entrada abierta dice el grupo y la sub-pestaña, también la que no tiene pestaña', () => {
  const n = navegacion();
  for (const d of n.departamentos) {
    for (const e of d.entradas) {
      if (!('subs' in e) || !e.subs) continue;
      for (const s of e.subs) {
        if ('proximamente' in s) continue;
        assert.deepEqual(entradaAbierta(n, s.seccion, s.pestana), { departamento: d.clave, nombre: e.nombre, sub: s.nombre }, `«${e.nombre} › ${s.nombre}» abierta no se marca`);
      }
    }
  }
  // El Leads Portal no anuncia pestaña: con cualquiera, o ninguna, es «De GHL».
  assert.deepEqual(entradaAbierta(n, 'contacts', null), { departamento: 'sales', nombre: 'Leads', sub: 'De GHL' });
  assert.deepEqual(entradaAbierta(n, 'contacts', 'algo'), { departamento: 'sales', nombre: 'Leads', sub: 'De GHL' });
  // Sin la sub-pestaña en la navegación de esa persona, no se adivina.
  assert.equal(entradaAbierta(soloCon('contacts'), 'tools', 'mis-leads'), null);
});

test('lo que una entrada abre son sus sub-pestañas, y el lugar lleva el grupo', () => {
  const n = navegacion();
  assert.deepEqual(queAbre(grupo(n, 'sales', 'Leads')!), [
    { seccion: 'contacts', pestana: null },
    { seccion: 'tools', pestana: 'mis-leads' },
    { seccion: 'tools', pestana: 'prospeccion' },
  ]);
  assert.deepEqual(queAbre(entradasDe(n, 'systems')[0]!), [{ seccion: 'acquisition', pestana: null }]);
  assert.deepEqual(queAbre({ nombre: 'Copywriter', proximamente: true }), []);
  // El lugar, como la barra: el departamento, el grupo y la sub-pestaña.
  for (const e of ENTRADAS) {
    if ('proximamente' in e || e.grupo === undefined || e.pestana === undefined) continue;
    const d = DEPARTAMENTOS.find((x) => x.clave === e.departamento)!;
    assert.equal(lugarDe(e.seccion, e.pestana), `${d.nombre} › ${e.grupo} › ${e.nombre}`);
  }
  assert.equal(lugarDe('analizadores', 'HT'), 'Sales › Llamadas de venta', 'una entrada suelta lleva un grupo que no tiene');
});

test('el contador del diseño, y lo que el engranaje dice de cada destino', () => {
  // Las entradas de cada departamento, como las cuenta la barra: un grupo una vez, con las «Próximamente».
  assert.deepEqual(
    navegacion().departamentos.map((d) => [d.nombre, d.entradas.length]),
    [['Research', 2], ['Systems', 3], ['Marketing', 4], ['Sales', 5], ['Client Success', 2]],
  );
  /* El engranaje: la ceja de su cabecera, el subtítulo de Ajustes, y si el destino sólo se ve desde la
     principal, que sale del menú (`soloDesdeLaPrincipal`) y no de la clave. */
  assert.deepEqual(navegacion().engranaje, [
    { seccion: 'credenciales', nombre: 'Ajustes', ceja: 'MENÚ DE LA CUENTA', subtitulo: 'Tokens e integraciones', soloDeLaPrincipal: false },
    { seccion: 'monitoreo', nombre: 'Panel de Monitoreo', ceja: 'MENÚ DE LA CUENTA', subtitulo: null, soloDeLaPrincipal: true },
    { seccion: 'incidentes', nombre: 'Incidentes', ceja: 'MENÚ DE LA CUENTA', subtitulo: null, soloDeLaPrincipal: true },
  ]);
  const sinLaRegla = menuPorDepartamentos([{ secciones: [{ clave: 'monitoreo', nombre: 'Panel de Monitoreo' }] }]);
  assert.equal(sinLaRegla.engranaje[0]!.soloDeLaPrincipal, false, '«sólo desde la principal» no sale del menú');
});
