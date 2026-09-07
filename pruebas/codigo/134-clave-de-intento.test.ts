// Reintentar un registro no puede escribir dos. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CUBRE, Y LO QUE NO
//
// Que dos llamadas con la misma clave escriban UNA sola fila se mide contra la base, en
// `pruebas/base/26-avanzar.test.ts`: lo que protege es un ÍNDICE ÚNICO, y un `onConflict` perfecto
// contra un índice que no existe se ve igual desde la fuente.
//
// Acá va lo que la base no puede ver:
//
//   1. Que la RUTA exija la clave. Sin eso el índice no protege nada — en PostgreSQL varios `null`
//      no chocan entre sí, así que una petición sin clave vuelve a poder duplicar.
//   2. Que la PANTALLA genere una por apertura, y no una por clic ni una por sesión.
//   3. Que el reintento siga avisándole al CRM, que es la mitad que un corte pudo dejar sin hacer.
//
// ── EL DEFECTO DE FONDO, PARA QUIEN LLEGUE DE NUEVO ────────────────────────
//
// `POST /api/contactos/[id]/avanzar` confirma la transacción y DESPUÉS le avisa a GoHighLevel. Si la
// respuesta no llega, quien registró no sabe si quedó. Hasta la migración `037`, reintentar escribía
// otra fila — y las comisiones no están guardadas: se calculan leyendo `resultados`, así que una
// venta duplicada duplica la comisión. Nadie lo reporta, porque el número que sale es plausible.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110`, `120`, `123`, `127`, `128`, `129`, `130`, `131` y `132`. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const RUTA = 'app/api/contactos/[id]/avanzar/route.ts';
const PANTALLA = 'components/negocio/Avanzar.jsx';
const NUCLEO = 'lib/negocio/avanzar.ts';
const MIGRACION = 'db/migraciones/037_clave_de_intento.sql';

test('la migración crea el índice ÚNICO, y por organización', () => {
  /* Las dos mitades importan.

     Sin `unique`, el `onConflict` del núcleo no tiene contra qué chocar y cada reintento escribe una
     fila: la función entera queda decorativa y nada falla.

     Y sin `org_id` en el índice, la clave de una empresa podría bloquear el registro de otra. Lo que
     se vería en pantalla es «esto ya estaba registrado» sobre un contacto que nadie tocó — un
     síntoma imposible de diagnosticar desde ahí. */
  const sql = leer(MIGRACION);
  assert.match(sql, /add column if not exists clave_de_intento uuid;/, 'no se agrega la columna');
  assert.match(
    sql,
    /create unique index if not exists resultados_clave_de_intento\s*\n\s*on negocio\.resultados \(org_id, clave_de_intento\);/,
    'el índice dejó de ser único, o perdió el `org_id`: sin lo primero no protege nada, y sin lo ' +
      'segundo la clave de una empresa bloquea el registro de otra',
  );
});

test('la RUTA exige la clave, y la rechaza si no es un uuid', () => {
  /* Es la mitad que hace que el índice sirva. Aceptando una petición sin clave «por
     compatibilidad», la fila se escribe con `null`, varios `null` no chocan entre sí, y duplicar
     vuelve a ser posible — con la garantía colgada de que el navegador se acuerde de mandarla. */
  const fuente = codigo(RUTA);
  assert.match(
    fuente,
    /const claveDeIntento = cuerpo\?\.claveDeIntento;/,
    'la ruta dejó de leer la clave del cuerpo',
  );
  assert.match(
    fuente,
    /if \(typeof claveDeIntento !== 'string' \|\| !UUID\.test\(claveDeIntento\)\) \{\s*\n\s*return rechazo\('peticion_invalida', MOTIVOS\.falta_clave\);/,
    'la ruta dejó de rechazar una petición sin clave: entonces el índice único no protege nada',
  );
  assert.match(fuente, /claveDeIntento,/, 'la clave no llega a `registrarResultado`');
});

test('el rechazo por falta de clave le habla a una PERSONA, y dice qué hacer', () => {
  /* El único caso real es una pestaña abierta desde antes del despliegue. Quien la tenga abierta no
     sabe qué es una clave de intento, y lo único que puede hacer es recargar: el mensaje se lo dice.

     Y afirma «no se registró nada», que acá SÍ es cierto y es la única rama donde lo es — el rechazo
     sale antes de abrir la transacción. */
  const motivo = codigo(RUTA).match(/falta_clave:\s*\n?\s*'([^']*)'\s*\+?\s*\n?\s*'?([^']*)'?/);
  assert.ok(motivo, 'se fue el motivo `falta_clave`');
  const texto = `${motivo[1] ?? ''}${motivo[2] ?? ''}`;
  assert.match(texto, /[Rr]ecarg/, 'el mensaje no dice que hay que recargar, que es lo único que se puede hacer');
});

test('la PANTALLA genera una clave por APERTURA: ni por clic, ni por sesión', () => {
  /* Las tres opciones se ven casi iguales en el código y significan cosas muy distintas:

       · por CLIC —regenerarla en cada `registrar()`— no arregla nada: el reintento trae otra clave
         y escribe otra fila;
       · por SESIÓN —una constante del módulo— la comparten TODAS las fichas, así que registrar
         sobre el segundo contacto choca con el primero y no escribe nada;
       · por APERTURA es la que se pidió, y sale de que `Ficha.jsx` monte este componente con
         `{avanzando ? <Avanzar/> : null}`: el inicializador de `useState` corre una vez por
         apertura.

     Por eso se afirma la forma exacta, y que la llamada la mande. */
  const fuente = codigo(PANTALLA);
  assert.match(
    fuente,
    /const \[claveDeIntento\] = useState\(\(\) => crypto\.randomUUID\(\)\);/,
    'la clave dejó de generarse una vez por apertura del panel',
  );
  assert.match(fuente, /cuerpo: \{\s*\n\s*claveDeIntento,/, 'la clave no se manda en el cuerpo');

  /* Y NO hay un segundo generador: uno dentro de `registrar()` volvería a hacer que cada reintento
     traiga una clave nueva, con el `useState` de arriba intacto y todo verde. */
  const generadores = fuente.match(/crypto\.randomUUID\(\)/g) ?? [];
  assert.equal(
    generadores.length,
    1,
    `hay ${generadores.length} generadores de clave en la pantalla: el que corra por clic hace que ` +
      'cada reintento escriba una fila nueva',
  );
});

test('la ficha se entera de que YA ESTABA, para no decir que registró dos veces', () => {
  /* Sin esto, quien reintentó después de un corte ve el mismo «listo» que la primera vez y cree que
     registró dos veces — y entonces va a «corregir» algo que está bien. */
  assert.match(
    codigo(PANTALLA),
    /yaEstaba: Boolean\(r\.datos\.yaEstaba\)/,
    'la pantalla dejó de pasar `yaEstaba` a la ficha',
  );
  assert.match(codigo(RUTA), /yaEstaba: registrado\.yaEstaba,/, 'la ruta dejó de decirlo');
});

test('el reintento SIGUE avisándole al CRM, que es la mitad que el corte pudo dejar sin hacer', () => {
  /* Es el detalle que convierte el reintento en una reparación en vez de un no-op.

     El corte puede caer entre el paso 1 y el paso 2, o sea con el resultado escrito y GoHighLevel
     sin enterarse — y sin el aviso, el CRM no dispara sus automatismos: la secuencia de
     recuperación de un no-show, por ejemplo. Si el reintento saliera temprano «porque ya estaba»,
     esa mitad no se completaría nunca.

     Se comprueba por POSICIÓN: el aviso al CRM tiene que estar DESPUÉS de leer `registrado` y sin
     ningún retorno anticipado que dependa de `yaEstaba` en el medio. */
  const fuente = codigo(RUTA);
  const trasLaBase = fuente.slice(fuente.indexOf('const registrado = await conOrganizacion('));
  const crm = trasLaBase.indexOf('await avisarAlCrm(');
  assert.ok(crm > 0, 'no está el aviso al CRM después de la transacción');

  const antesDelCrm = trasLaBase.slice(0, crm);
  assert.doesNotMatch(
    antesDelCrm,
    /registrado\.yaEstaba[\s\S]*?return /,
    'la ruta sale antes de avisarle al CRM cuando ya estaba: entonces un corte entre el paso 1 y el ' +
      'paso 2 deja al CRM sin enterarse para siempre, y reintentar no lo arregla',
  );
});

test('el núcleo se corta ANTES de las otras tres escrituras, no solo antes del insert', () => {
  /* Un resultado, una etapa, una nota y una tarea: son cuatro escrituras. Cortando solo el insert
     del resultado, el reintento igual escribiría una SEGUNDA NOTA en el hilo del contacto y una
     segunda tarea en Mi Día — más silencioso que el duplicado original y más difícil de explicar.

     Se comprueba por posición: el retorno por `yaEstaba` va antes de que se escriba la etapa. */
  const fuente = codigo(NUCLEO);
  const corte = fuente.indexOf('yaEstaba: true,');
  const etapa = fuente.indexOf(".updateTable('contactos')");
  const nota = fuente.indexOf(".insertInto('notas')");

  assert.ok(corte > 0, 'se fue el retorno por reintento');
  assert.ok(etapa > 0 && nota > 0, 'cambiaron las escrituras del núcleo: revisar esta prueba');
  assert.ok(
    corte < etapa && corte < nota,
    'el corte por reintento quedó DESPUÉS de alguna de las otras escrituras: el reintento va a ' +
      'dejar una segunda nota o una segunda tarea',
  );
});
