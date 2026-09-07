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
import { enlaceDeAgendamiento, enlaceDeReagendamiento } from '../../lib/ghl/agendar.ts';

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
  /* Medido: `https://link.<dominio del cliente>/widget/booking/<id>` responde **404**, así que
     esta función no acepta dominio y usa el del proveedor.

     OJO CON GENERALIZARLO, que es lo que decía este comentario: lo que 404 es el host `link.`, no
     el dominio propio en general. Medido el 2026-09-07, el dominio de RESERVAS propio
     —`calls.ariaia.com`— responde 200, y por eso `enlaceDeReagendamiento` sí lo usa. Las dos cosas
     son ciertas a la vez porque son dos hosts distintos. */
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

// ─── 4 · EL ENLACE DE REAGENDAR ───────────────────────────────────

test('la URL de reagendar lleva el calendario Y el evento, que es lo que la hace reagendar', () => {
  /* ────────────────────────── POR QUÉ `event_id` NO ES OPCIONAL ──────────────────────────
   *
   * Medido contra la subcuenta real el 2026-09-07: con `?event_id=<evento>` el widget devuelve la
   * cita de verdad en los datos de la página —el id del evento y su fecha, junto a `event_address`
   * y `selected_timezone`— y las menciones de «reschedule» pasan de 1 a 3. Sin el parámetro esos
   * datos no están.
   *
   * O sea que sin él no es un reagendado sino una reserva NUEVA, y eso **deja la cita vieja en
   * pie**: el closer termina con dos y una que nadie va a atender. */
  assert.equal(
    enlaceDeReagendamiento(null, 'cal-1', 'ev-1'),
    'https://api.leadconnectorhq.com/widget/booking/cal-1?event_id=ev-1',
  );
});

test('sin calendario o sin evento es NULO, y las dos faltas duelen distinto', () => {
  /* No es simetría por prolijidad. Sin el EVENTO, la URL abriría una reserva nueva — crea una
     segunda cita. Sin el CALENDARIO, un 404. La primera es peor porque parece que funcionó.

     El calendario falta en las citas guardadas antes de la migración `038`, así que este caso no
     es hipotético: es toda cita vieja. */
  assert.equal(enlaceDeReagendamiento(null, null, 'ev-1'), null, 'sin calendario dio una URL');
  assert.equal(enlaceDeReagendamiento(null, 'cal-1', null), null, 'sin evento dio una URL');
  // Y la cadena vacía cuenta como ausencia: un campo guardado sin tocar llega como `''`.
  assert.equal(enlaceDeReagendamiento(null, '  ', 'ev-1'), null);
  assert.equal(enlaceDeReagendamiento(null, 'cal-1', '  '), null);
});

test('con dominio propio se usa ese, y la barra final no rompe la URL', () => {
  /* El dominio propio es lo que evita mandarle a un prospecto un link que dice
     `leadconnectorhq.com`, o sea contarle con qué CRM trabaja la empresa.

     La barra final se saca acá y no se le pide a quien configura: un dominio pegado de la barra
     del navegador la trae, y `https://x.com//widget/booking/...` no es la misma URL. */
  assert.equal(
    enlaceDeReagendamiento('https://calls.ariaia.com', 'cal-1', 'ev-1'),
    'https://calls.ariaia.com/widget/booking/cal-1?event_id=ev-1',
  );
  assert.equal(
    enlaceDeReagendamiento('https://calls.ariaia.com/', 'cal-1', 'ev-1'),
    'https://calls.ariaia.com/widget/booking/cal-1?event_id=ev-1',
    'la barra final dejó una doble barra en la URL',
  );
  // Vacío cae al del proveedor, que está medido y funciona para toda empresa.
  assert.ok(
    enlaceDeReagendamiento('   ', 'cal-1', 'ev-1')?.startsWith('https://api.leadconnectorhq.com/'),
  );
});

test('los dos identificadores se escapan', () => {
  // Vienen del CRM. Uno con `/` o `?` adentro cambiaría la ruta o agregaría parámetros.
  const url = enlaceDeReagendamiento(null, 'a b/../otro', 'ev?x=1&y=2');
  assert.equal(
    url,
    'https://api.leadconnectorhq.com/widget/booking/a%20b%2F..%2Fotro?event_id=ev%3Fx%3D1%26y%3D2',
  );
});

test('el calendario DE LA CITA se guarda, y se pisa al reagendar', () => {
  /* Es la pieza sin la que todo lo de arriba no sirve: `crm_calendario_id` es UNO y la subcuenta
     tiene nueve. Con el de la empresa, el link abriría el calendario de otro closer — la persona
     vería horarios que no son y reservaría ahí, y se vería como que funcionó.

     Y se PISA en el `do update` por el mismo motivo que la sala: reagendar en el CRM puede mover
     la cita de calendario, y el enlace tiene que seguirla. */
  const fuente = leer('lib/negocio/citas.ts');
  assert.match(
    fuente,
    /ghl_calendario_id: cita\.calendarioId,/,
    'el calendario de la cita se vuelve a tirar al guardar',
  );
  assert.match(
    fuente,
    /ghl_calendario_id: valores\.ghl_calendario_id,/,
    'el calendario no se pisa al actualizar: una cita movida de calendario deja el enlace viejo',
  );
});

test('el dominio se puede cargar: está en el endpoint, en la pantalla y en el resolvedor', () => {
  // La misma comprobación de entrada muerta que el calendario. Una columna que ningún formulario
  // escribe es una columna que nadie va a llenar.
  assert.match(
    leer('app/api/admin/credenciales/route.ts'),
    /crm_dominio_reservas/,
    'el endpoint de credenciales no acepta el dominio',
  );
  assert.match(
    leer('components/ajustes/Credenciales.jsx'),
    /crmDominioReservas/,
    'la pantalla de credenciales no ofrece el campo',
  );
  assert.match(
    leer('lib/credenciales/resolver.ts'),
    /crm_dominio_reservas/,
    'el resolvedor no lee la columna',
  );

  // Y NO es un secreto: es un dominio público, y cifrarlo haría que nadie pueda comprobarlo.
  const renglon = leer('app/api/admin/credenciales/route.ts')
    .split('\n')
    .find((l) => l.includes("columna: 'crm_dominio_reservas'"));
  assert.ok(renglon, 'no se encontró la declaración del campo');
  assert.match(renglon, /secreto:\s*false/);
});

test('el menú del chat ofrece los dos, y solo cuando el servidor mandó su URL', () => {
  /* Una opción que no lleva a ninguna parte es peor que no tenerla: la sala falta en 23 de 1052
     citas medidas, y el reagendar falta en toda cita guardada antes de la `038`. */
  /* Y el ENDPOINT los manda. Sin esto, el hueco es de los que quedan verdes: la ficha sabe
     dibujarlos, la consulta sabe armarlos, y en el medio nadie los pasa — el menú se ve igual que
     antes de todo este trabajo. */
  const ruta = leer('app/api/contactos/[id]/route.ts');
  assert.match(ruta, /enlacesDeCita,/, 'el endpoint del contacto no manda los enlaces de la cita');
  assert.match(
    ruta,
    /await conOrganizacion\(orgId, \(\) => enlacesDeLaCita\(id, dominio\)\)/,
    'el endpoint dejó de pedirlos',
  );

  const ficha = leer('components/negocio/Ficha.jsx');

  /* Cada uno tiene que aparecer DOS veces: en su condición y en su `url`. Lo encontró una
     mutación — rompió la condición dejando la línea del `url` intacta, y una aserción que solo
     buscaba el nombre seguía pasando. Con la condición en `false`, la opción desaparece del menú
     para siempre y el archivo se ve igual. */
  for (const cual of ['meet', 'reagendar']) {
    const veces = (ficha.match(new RegExp(`enlacesDeCita\.${cual}`, 'g')) ?? []).length;
    assert.equal(
      veces,
      2,
      `\`enlacesDeCita.${cual}\` aparece ${veces} veces y tienen que ser 2 —la condición que ` +
        'decide si la opción se ofrece, y la URL que se manda. Con una sola, la condición se ' +
        'rompió y esa opción ya no aparece en el menú.',
    );
    assert.match(
      ficha,
      new RegExp(`url: enlacesDeCita\.${cual},`),
      `la entrada de ${cual} dejó de mandar su propia URL`,
    );
  }
  assert.match(
    ficha,
    /if \(enlacesDeCita === null\) return configuradosConGrupo;/,
    'sin cita, la ficha dejaría de caer en los configurados a secas',
  );

  /* Y el menú agrupa por `grupo` y no por `territorio`. Los de la cita no son de una zona, así
     que con el agrupado viejo caerían en el grupo del closer o en ninguno. */
  assert.match(ficha, /const grupos = new Set\(enlaces\.map\(\(e\) => e\.grupo\)\);/);
  assert.doesNotMatch(
    ficha,
    /const conZonas/,
    'volvió el agrupado por zona: los enlaces de la cita no tienen zona',
  );
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
