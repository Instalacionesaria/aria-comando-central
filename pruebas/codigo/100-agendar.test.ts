// El enlace de agendamiento, y el atajo que no se puede tomar. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA QUE IMPORTA ES LA ÚLTIMA
//
// Ahora existe una columna con **un** identificador de calendario, y el barrido de citas cuesta diez
// llamadas porque lee **los nueve** calendarios de la subcuenta. La conclusión que salta a la vista
// es: «tenemos el calendario configurado, usémoslo y bajemos diez llamadas a dos».
//
// Está medido lo que eso costaría, sobre los últimos 90 días de la subcuenta real:
//
//     349 citas en el calendario configurado
//      27 citas en otros dos
//     ────
//     376 en total
//
// O sea que el atajo **perdería 27 citas de 376 sin ningún error**: la agenda se vería completa y le
// faltaría el 7 %. Y el 7 % de hoy no es el de mañana — un calendario personal que alguien empiece a
// usar aparece con cero citas y crece solo.
//
// Por eso la última prueba de este archivo mira el código del barrido y exige que NO nombre esa
// columna. Es un cable trampa, y está puesto en el único lugar donde se puede poner: el atajo se toma
// en un archivo, no en una configuración.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enlaceDeAgendamiento } from '../../lib/ghl/agendar.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (ruta: string) => readFileSync(new URL(ruta, RAIZ), 'utf8');

// ─── 1 · El enlace ─────────────────────────────────────────────────────────

test('con un calendario cargado, la URL es la medida', () => {
  // La forma está comprobada contra el proveedor: `…/widget/booking/<id>` responde 200 con HTML.
  assert.equal(
    enlaceDeAgendamiento('mi9tLbbAy5iUfvwCz6DH'),
    'https://api.leadconnectorhq.com/widget/booking/mi9tLbbAy5iUfvwCz6DH',
  );
});

test('sin calendario es NULO, no la portada del proveedor', () => {
  // El defecto que el prototipo tenía con «Ver en GHL»: abrir la portada y dejar a alguien buscando
  // a mano. Un botón atenuado dice qué falta; un botón que lleva a un lugar inútil no.
  assert.equal(enlaceDeAgendamiento(null), null);
  assert.equal(enlaceDeAgendamiento(undefined), null);
  assert.equal(enlaceDeAgendamiento(''), null);
  assert.equal(enlaceDeAgendamiento('   '), null, 'un campo guardado sin tocar llega así');
  assert.equal(enlaceDeAgendamiento(42 as unknown as string), null);
});

test('el identificador se escapa', () => {
  // No es paranoia de tipos: el valor lo escribe una persona en un campo de texto, y de ahí sale una
  // URL que un navegador abre.
  const url = enlaceDeAgendamiento('a b/../otro?x=1');
  assert.ok(url);
  assert.doesNotMatch(url.replace('https://api.leadconnectorhq.com/widget/booking/', ''), /[/?]/);
});

test('la base es del proveedor, no un dominio blanco', () => {
  // Medido: `https://link.<dominio del cliente>/widget/booking/<id>` responde **404**. Poner el
  // dominio blanco daría un botón que no abre nada, y la falla se vería recién al apretarlo.
  const url = enlaceDeAgendamiento('x');
  assert.ok(url?.startsWith('https://api.leadconnectorhq.com/'));
});

// ─── 2 · La columna existe donde se administra ──────────────────────────────

test('el campo se puede cargar: está en el endpoint y en la pantalla', () => {
  // La comprobación de entrada muerta. Una columna que ningún formulario escribe es una columna que
  // nadie va a llenar, y el botón quedaría atenuado para siempre sin que nada lo explique.
  assert.match(
    leer('app/api/admin/credenciales/route.ts'),
    /crm_calendario_id/,
    'el endpoint de credenciales no acepta el calendario',
  );
  assert.match(
    leer('components/ajustes/Credenciales.jsx'),
    /crmCalendarioId/,
    'la pantalla de credenciales no ofrece el campo',
  );
  assert.match(
    leer('lib/credenciales/resolver.ts'),
    /crm_calendario_id/,
    'el resolvedor no lee la columna, así que el endpoint nunca la devuelve',
  );
});

test('NO es un secreto, y se declara así', () => {
  // Es el identificador de un calendario ajeno, igual que el Location ID. Marcarlo como secreto lo
  // cifraría y ya no se podría mostrar entero — y entonces nadie podría comprobar que está bien
  // cargado, que es justo lo que pasó una vez con `DOMINIO_ESPERADO`.
  const fuente = leer('app/api/admin/credenciales/route.ts');
  const renglon = fuente.split('\n').find((l) => l.includes("columna: 'crm_calendario_id'"));
  assert.ok(renglon, 'no se encontró la declaración del campo');
  assert.match(renglon, /secreto:\s*false/);
});

// ─── 3 · EL CABLE TRAMPA ───────────────────────────────────────────────────

test('EL ATAJO: el barrido de citas NO usa el calendario configurado', () => {
  // Ver el encabezado. Acotar el barrido a un calendario baja diez llamadas a dos **y pierde 27 de
  // 376 citas medidas**, sin error y sin que la pantalla lo note.
  //
  // Se comprueba sobre los dos archivos del camino del barrido, no sobre uno: el atajo se puede tomar
  // en el cliente del proveedor —pasándole el calendario a la lista— o en el barrido.
  for (const ruta of ['lib/negocio/citas.ts', 'lib/negocio/barrido.ts', 'lib/ghl/calendarios.ts']) {
    assert.doesNotMatch(
      leer(ruta),
      /crmCalendarioId|crm_calendario_id/,
      `${ruta} nombra el calendario configurado. Si es para acotar el barrido: perdería las citas ` +
        'de los otros calendarios (medido: 27 de 376, y creciendo). El barrido lee TODOS.',
    );
  }
});

test('y el barrido sigue leyendo la LISTA de calendarios', () => {
  // La otra mitad, y hace falta: sin ella, la prueba de arriba pasaría con un barrido que no lee
  // ningún calendario.
  const citas = leer('lib/negocio/citas.ts');
  assert.match(citas, /listarCalendarios/, 'el barrido dejó de listar los calendarios');
  assert.match(citas, /lectores\.citas\(/, 'el barrido dejó de recorrerlos uno por uno');
});
