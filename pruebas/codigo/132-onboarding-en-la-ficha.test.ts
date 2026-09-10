// Lo que el cliente llenó en el formulario de Walter llega a «Tu ficha».
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTAS PRUEBAS CUSTODIAN
//
// Walter reportó el 2026-09-10 que un cliente nuevo —«Innat8 Technologies»— entraba a «Tu ficha» y
// el agente lo saludaba con *«¿Cómo se llama tu negocio?»*. El nombre estaba en la base desde que se
// registró: la captura del formulario vive en `aria_cc_icp_oferta`, con el HTML de la síntesis en
// cinco secciones, y NADA de Comando Central la leía.
//
// Kevin: *«los datos que llegaron a las tablas correspondientes deben servir para la pestaña Tu
// ficha; cuando el usuario vaya a chatear con el agente, ya debería estar allí precargada esa
// información, y el usuario podría consultar al chat sobre sus datos»*.
//
// El camino completo son cuatro tramos, y cada uno se rompe en silencio: el disparador de la base
// copia la captura a `intake`, el almacén la lee, el lector la convierte en secciones, y el
// constructor la mete en el prompt y en el contexto del agente. Un tramo cortado no falla — deja al
// agente preguntando lo que ya sabe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { CARACTERES_DE_ONBOARDING, contextoDeOnboarding, leerOnboarding } from '../../lib/fundaciones/onboarding.ts';
import { LLAVES, estadoVacio } from '../../lib/fundaciones/estado.ts';
import { armarPrompt, datosDe } from '../../lib/fundaciones/prompts.ts';
import { contextoHeredado } from '../../lib/fundaciones/relleno.ts';
import { FUNDACIONES } from '../../lib/fundaciones/herramientas.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const migracion = (nombre: string): string => readFileSync(join(RAIZ, '..', 'migraciones', nombre), 'utf8');

/* Un recorte FIEL de la captura real de «Innat8 Technologies» (2026-09-10): el encabezado con el
   nombre, dos tarjetas del formulario con contenido, y una de la llamada que dice «Sin dato» porque
   todavía no hubo llamada de onboarding. Los acentos faltantes están como en el original. */
const HTML = `<div class="header"><div class="brandrow"><span class="wordmark">ARIA</span>
<span class="doctag">Perfil de Cliente · Uso interno</span></div>
<div class="clientname">Innat8 Technologies</div>
<span class="chip">✉ <b>miguel@innat8.com</b></span>
<span class="chip">País · <b>sin dato</b></span></div>
<div class="section form"><div class="sechead"><h2>Formulario Pre-Kickoff</h2></div>
<div class="grid"><div class="card"><h3><span class="ico">🏢</span> El negocio</h3><p>El cliente es consultor o implementador de IA, con 1 a 3 años operando bajo este modelo. Actualmente tiene entre 3 y 10 clientes activos.</p></div>
<div class="card"><h3><span class="ico">🎯</span> Oferta y posicionamiento</h3><p>Aun no tiene un nicho definido; promete un agente de inteligencia artificial conectado a un CRM con capacidad de responder, dar seguimiento y agendar.</p></div>
<div class="card full"><h3><span class="ico">📝</span> Resumen de la llamada</h3><p>Sin dato en la llamada.</p></div></div></div>`;

const CAPTURA = {
  version: 1,
  origen: 'aria_cc_icp_oferta',
  telefono: '7873670451',
  website: 'www.innat8.com',
  html: HTML,
};

function conOnboarding() {
  const estado = estadoVacio();
  estado.onboarding = leerOnboarding(CAPTURA);
  return estado;
}

test('la captura de Walter se lee: nombre del negocio, secciones con contenido, y datos sueltos', () => {
  const o = leerOnboarding(CAPTURA);
  assert.ok(o, 'no se pudo leer la captura');

  // El nombre del negocio es la respuesta a `t1-biz`, que es justo lo que el agente preguntaba.
  assert.equal(o.nombreDelNegocio, 'Innat8 Technologies');
  assert.equal(o.website, 'www.innat8.com');
  assert.equal(o.telefono, '7873670451');
  // El país llegó como «sin dato» en la captura, y eso NO es un valor.
  assert.equal(o.paisCiudad, null);

  // Las dos tarjetas con contenido, con su título sin el emoji del icono.
  assert.deepEqual(
    o.secciones.map((s) => s.titulo),
    ['El negocio', 'Oferta y posicionamiento'],
    'los títulos no salieron limpios, o entró una sección vacía',
  );
  const [negocio, oferta] = o.secciones;
  assert.ok(negocio && oferta);
  assert.match(negocio.texto, /consultor o implementador de IA/);
  assert.ok(!/<[a-z]/i.test(oferta.texto), 'quedaron etiquetas HTML dentro del texto');

  /* Y la de la llamada NO entra: «Sin dato en la llamada» es ausencia, no contenido. Meterla haría
     que el agente le contara a la persona que su llamada no tiene datos, que es ruido. */
  assert.ok(
    !o.secciones.some((s) => /Resumen de la llamada/.test(s.titulo)),
    'entró una sección que solo dice «sin dato»',
  );
});

test('el lector NUNCA lanza, y sin nada aprovechable devuelve `null`', () => {
  /* Es la propiedad que importa: el HTML lo genera un pipeline ajeno que puede cambiar de plantilla
     sin avisarnos. Un cambio allá no puede dejar a nadie sin poder abrir su ficha. */
  for (const basura of [null, undefined, 0, '', 'texto suelto', [], {}, { html: 12 }, { html: '<p>hola</p>' }]) {
    assert.equal(leerOnboarding(basura), null, `${JSON.stringify(basura)} debería dar null`);
  }
  // Con una sección reconocible alcanza, aunque falte todo lo demás.
  const minimo = leerOnboarding({ html: '<div class="card"><h3>El negocio</h3><p>Vende software.</p></div>' });
  assert.equal(minimo?.secciones.length, 1);
  assert.equal(minimo?.nombreDelNegocio, null);

  /* Pero los datos SUELTOS no alcanzan, y es un caso real: de las nueve capturas de producción una
     tiene solo el teléfono, de una conversación que se cortó antes de la síntesis. Con eso el agente
     abriría prometiendo datos precargados y sin ninguno de los siete campos. */
  assert.equal(leerOnboarding({ telefono: '7873670451' }), null);
  assert.equal(leerOnboarding({ website: 'x.com', pais_ciudad: 'Lima' }), null);
});

test('el contexto dice QUÉ es y DE DÓNDE viene, para que el agente lo pueda citar', () => {
  const texto = contextoDeOnboarding(leerOnboarding(CAPTURA));
  assert.ok(texto);
  // La procedencia es la mitad del pedido: el usuario le pregunta al chat por «sus datos».
  assert.match(texto, /FORMULARIO DE ONBOARDING/);
  assert.match(texto, /lo escribió ella misma/);
  assert.match(texto, /Innat8 Technologies/);
  assert.match(texto, /El negocio: /);
  assert.match(texto, /Oferta y posicionamiento: /);
  assert.ok(texto.length <= CARACTERES_DE_ONBOARDING, 'el contexto se pasó de su tope');

  // Sin onboarding no hay texto — y `null` es lo que hace que el bloque del SKILL se omita entero.
  assert.equal(contextoDeOnboarding(null), null);
});

test('«Tu ficha» lo recibe en su prompt Y en el contexto del agente, que son el mismo dato', () => {
  const ficha = FUNDACIONES[0];
  assert.ok(ficha && ficha.id === 0, 'la primera herramienta del método dejó de ser Tu ficha');

  // 1 · El constructor de datos de la ficha lo produce.
  const datos = datosDe(0, {}, conOnboarding());
  assert.match(String(datos['_onboardingContext']), /Innat8 Technologies/);

  // 2 · El prompt lo interpola, y el SKILL trae el bloque condicional que lo envuelve.
  const prompt = armarPrompt(0, {}, conOnboarding());
  assert.match(prompt, /FORMULARIO DE ONBOARDING/);
  assert.match(prompt, /consultor o implementador de IA/);
  assert.doesNotMatch(prompt, /\{\{[\w.#^/]+\}\}/, 'el prompt de la ficha dejó una variable sin resolver');

  // 3 · Y el AGENTE lee exactamente lo mismo: `contextoHeredado` sale del mismo constructor, así que
  //     lo que el chat propone y lo que la generación usa no pueden divergir.
  assert.match(contextoHeredado(ficha, conOnboarding()), /Innat8 Technologies/);

  /* Sin onboarding —una cuenta creada a mano desde Ajustes— no queda ni el rótulo ni un hueco: el
     bloque desaparece y la ficha se trabaja conversando, como antes. */
  const sin = armarPrompt(0, {}, estadoVacio());
  assert.doesNotMatch(sin, /FORMULARIO DE ONBOARDING/);
  assert.doesNotMatch(sin, /\{\{[\w.#^/]+\}\}/);
  assert.equal(contextoHeredado(ficha, estadoVacio()), '');
});

test('el almacén lee la columna `intake` con el lector tolerante', () => {
  assert.equal(LLAVES.onboarding, 'intake', 'cambió el nombre de la columna del onboarding');
  assert.equal(estadoVacio().onboarding, null, 'el estado vacío ya no nace sin onboarding');

  const almacen = sinComentarios(codigo('lib/fundaciones/almacen.ts'));
  assert.match(almacen, /LLAVES\.onboarding,/, 'el select del estado dejó de pedir la columna');
  assert.match(almacen, /estado\.onboarding = leerOnboarding\(fila\[LLAVES\.onboarding\]\)/);
});

test('la migración 014 copia la captura a la ficha, y no puede romper el alta de Walter', () => {
  const sql = migracion('014_onboarding_a_la_ficha.sql');

  // El disparador, sobre las dos operaciones: Walter reintenta y actualiza su captura.
  assert.match(sql, /create trigger aria_cc_icp_oferta_alimenta_la_ficha/);
  assert.match(sql, /after insert or update on public\.aria_cc_icp_oferta/);

  // La copia va a la columna que la 004 creó para esto.
  assert.match(sql, /insert into public\.aria_cc_foundations \(org_id, intake\)/);
  assert.match(sql, /on conflict \(org_id\) do update/);

  /* LO QUE NO SE PUEDE PERDER: si la copia falla, la captura entra igual. Es la lección de la 013 —
     un disparador que falla se lleva el `insert` entero— y acá el `insert` es el dato más caro del
     pipeline. */
  assert.match(sql, /exception\s*\n\s*when others then/);
  assert.match(sql, /raise warning/);

  // Y el respaldo de las que ya estaban, más la comprobación que convierte «no copió» en un error.
  assert.match(sql, /from public\.aria_cc_icp_oferta c\s*\n\s*where c\.org_id is not null/);
  assert.match(sql, /quedaron sin copiar a la ficha/);
});
