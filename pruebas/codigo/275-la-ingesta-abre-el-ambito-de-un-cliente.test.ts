// LA INGESTA ABRE EL ÁMBITO DE UN CLIENTE, NUNCA EL DE LA EMPRESA ENTERA. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C1)
//
// Con dos clientes activos, un `conOrganizacion(orgId, …)` olvidado adentro de la ingesta de Y no da ningún error: el
// puente pone la cuenta POR OMISIÓN en lo que no tiene contacto, y el gasto, las campañas o el pulso de Y se escriben
// en X, pisando los de X. El tipo `AmbitoDeUnCliente` lo marca en las firmas; esta prueba lo marca adentro de los
// cuerpos, donde el tipo no llega:
//
//   · en los módulos de la ingesta, el primer argumento de `conOrganizacion(` y de `conElPulso(` no es nunca una
//     organización (`orgId`, `org.id`, `e.orgId`, `contexto.orgEfectiva`) — mutación: volver a abrir con `orgId`;
//   · el barrido despacha cada tarea de cliente con el cliente (`delCliente()`), y las rutas manuales con cada
//     cliente que su pantalla lee (`clientesQueTrae`, G4) — mutación: volver a `porOmisionDe`;
//   · la sincronización exige un solo cliente antes de buscar nada.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

/** Los módulos cuyo trabajo es de UN cliente: todo lo que abren, lo abren con el cliente. */
const DE_UN_CLIENTE = [
  'lib/negocio/pulso.ts',
  'lib/negocio/ingesta.ts',
  'lib/negocio/entregas.ts',
  'lib/negocio/citas.ts',
  'lib/negocio/miniaturaDelContacto.ts',
  'lib/negocio/recolectarAnuncios.ts',
  'lib/negocio/rellenarAnuncios.ts',
  'lib/negocio/recolectarActivos.ts',
  'lib/auditor/analisis.ts',
  'lib/auditor/buscarMejora.ts',
  // El bucle de las rutas manuales: no abre nada, y si algún día abre algo con `orgId`, esto lo marca.
  'lib/negocio/traerDeLosClientes.ts',
];

/** Una organización, sea cual sea la variable: `orgId`, `e.orgId`, `ambito.orgId`, `org.id`, `contexto.orgEfectiva`. */
const DE_LA_EMPRESA = /(^|\.)orgId$|^(org|o)\.id$|orgEfectiva$/;

function primerosArgumentos(fuente: string, funcion: string): string[] {
  return [...fuente.matchAll(new RegExp(`\\b${funcion}\\(\\s*([^,()]+(?:\\([^()]*\\))?)\\s*,`, 'g'))].map((m) => m[1]!.trim());
}

test('en los módulos de la ingesta, ningún contexto se abre con la organización', () => {
  const mal: string[] = [];
  let vistos = 0;
  for (const ruta of DE_UN_CLIENTE) {
    const fuente = leer(ruta);
    for (const funcion of ['conOrganizacion', 'conElPulso']) {
      for (const arg of primerosArgumentos(fuente, funcion)) {
        vistos += 1;
        if (DE_LA_EMPRESA.test(arg)) mal.push(`${ruta}: ${funcion}(${arg}, …)`);
      }
    }
  }
  assert.ok(vistos >= 20, `encontré ${vistos} aperturas: la búsqueda no está mirando nada`);
  assert.deepEqual(mal, [], 'un contexto de la ingesta se abre con la empresa entera: con dos clientes escribe en el por omisión');
});

test('releer los contactos abre el ámbito del cliente, y el barrido despacha cada tarea de cliente con su cliente', () => {
  const barrido = leer('lib/negocio/barrido.ts');
  const i = barrido.indexOf('async function releerContactos(');
  const releer = barrido.slice(i, barrido.indexOf('\n}\n', i));
  assert.match(releer, /conOrganizacion\(ambito,/);
  assert.match(releer, /completarMiniaturas\(ambito, acceso,/);
  for (const llamada of [
    /releerContactos\(elAmbito\(\)/,
    /ingerirMensajes\(elAmbito\(\)/,
    /recolectarAnuncios\(elAmbito\(\)/,
    /rellenarAnuncios\(elAmbito\(\)/,
    /recolectarActivos\(elAmbito\(\)/,
    /barrerCitas\(elAmbito\(\)/,
    /auditar\(org, elAmbito\(\)/,
    /mejorar\(org, elAmbito\(\)/,
  ]) {
    assert.match(barrido, llamada, `el barrido no despacha con el cliente: ${llamada}`);
  }
});

test('las rutas manuales traen a cada cliente que su pantalla lee, y la sincronización exige un solo cliente', () => {
  for (const ruta of ['app/api/mensajes/ingesta/route.ts', 'app/api/closer/agenda/refrescar/route.ts', 'app/api/contactos/sincronizar/route.ts']) {
    const fuente = leer(ruta);
    assert.doesNotMatch(fuente, /porOmisionDe\(|'la_de_la_empresa'/, `${ruta} trae sólo al principal, con las credenciales de la empresa`);
    assert.match(fuente, /clientesQueTrae\(contexto, (PANTALLA|SIN_SECCION)\)/, `${ruta} no trae a los clientes que su pantalla lee`);
    assert.match(fuente, /resolverAccesoAGhl\(db, contexto\.orgEfectiva, c\)/, `${ruta} no resuelve las credenciales de cada cliente`);
    assert.match(fuente, /traerDeCadaCliente\(\s*contexto\.orgEfectiva,/, `${ruta} no trae a cada cliente en su ámbito`);
  }
  assert.match(
    leer('app/api/contactos/sincronizar/route.ts'),
    /conOrganizacion\(ambito, \(\) => sincronizarContactos\(/,
    'la sincronización no abre el ámbito de SU cliente: la resta congelaría a los contactos de los demás',
  );
  const sincronizar = leer('lib/negocio/sincronizar.ts');
  const i = sincronizar.indexOf('export async function sincronizarContactos(');
  const cuerpo = sincronizar.slice(i, sincronizar.indexOf('\n}\n', i));
  assert.ok(
    cuerpo.indexOf('await exigirUnSoloCliente()') >= 0 && cuerpo.indexOf('await exigirUnSoloCliente()') < cuerpo.indexOf('todosLosContactosPorEtiqueta('),
    'la sincronización busca antes de comprobar que es de un solo cliente',
  );
});
