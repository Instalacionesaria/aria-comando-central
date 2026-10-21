// CADA CREDENCIAL DEL CRM O DE META DICE DE QUÉ CLIENTE ES. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C3)
//
// Con dos clientes, el token de la empresa no ve la subcuenta del otro: un contacto de Y pedido con el token de X
// «no existe», y un enlace de reservas armado con el dominio de X le llega al lead de Y. Por eso el cliente es
// OBLIGATORIO en los cinco resolvedores, y quien de verdad quiere la de la empresa lo escribe (`'la_de_la_empresa'`).
// tsc lo exige en los `.ts`; esta prueba lo exige donde tsc no mira —los `.mjs` de `scripts/`— y en las rutas, donde
// la de la empresa sería un error que compila:
//
//   · las firmas tienen el cliente sin `?` ni valor por omisión — mutación: `cliente?: ClienteDeLaCredencial`;
//   · toda llamada pasa tres argumentos, también en los `.mjs` — mutación: sacar el tercero de un script;
//   · las rutas de UN contacto piden la credencial del cliente del contacto (`clienteDelContacto`), nunca la de la
//     empresa a secas — mutación: `'la_de_la_empresa'` en `app/api/contactos/[id]/mensajes/route.ts`;
//   · el aviso del CRM busca el secreto de un cliente sólo entre los activos que no son el principal, y todo lo que
//     sigue corre en el ámbito de ese cliente;
//   · la Conexión de Ajustes › Clientes no vuelve a «Leyendo…» al recargar con datos ya dibujados: desmontaría
//     `AvisoDelCrm` y perdería la cabecera recién generada (el mismo defecto que la 108 cuida en Credenciales).
//   · quien pide la de la empresa a propósito está escrito, uno por uno (C6 · D2) — mutación: Tools o un guion de
//     medición con `'la_de_la_empresa'` de vuelta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente, sinComentarios } from '../apoyo/fuente.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

const RESOLVEDORES = ['resolverAccesoAGhl', 'resolverAccesoAMeta', 'resolverAccesoAlAuditor', 'dominioDeReservasDe', 'agenteDelCrmDe'];

/** Los argumentos de cada llamada a `funcion(` en la fuente, partidos por las comas de primer nivel. */
function llamadas(fuente: string, funcion: string): string[][] {
  const salida: string[][] = [];
  const patron = new RegExp(`(?<!function\\s)\\b${funcion}\\(`, 'g');
  for (const m of fuente.matchAll(patron)) {
    let i = m.index! + m[0].length;
    let nivel = 0;
    let actual = '';
    const args: string[] = [];
    for (; i < fuente.length; i += 1) {
      const c = fuente[i]!;
      if (c === ')' && nivel === 0) break;
      if (c === '(' || c === '[' || c === '{') nivel += 1;
      if (c === ')' || c === ']' || c === '}') nivel -= 1;
      if (c === ',' && nivel === 0) {
        args.push(actual.trim());
        actual = '';
        continue;
      }
      actual += c;
    }
    if (actual.trim() !== '') args.push(actual.trim());
    salida.push(args);
  }
  return salida;
}

test('los cinco resolvedores piden el cliente, sin opcional ni valor por omisión', () => {
  const fuente = leer('lib/credenciales/resolver.ts');
  for (const r of RESOLVEDORES) {
    const firma = new RegExp(`export async function ${r}\\(([^)]*)\\)`).exec(fuente);
    assert.ok(firma, `no encontré la firma de ${r}`);
    assert.match(firma[1]!, /\bcliente: ClienteDeLaCredencial\s*,?\s*$/, `${r} no pide el cliente, o lo deja opcional`);
  }
  // La conexión de un cliente se busca siempre con su organización: el id solo cruzaría empresas.
  const delCliente = /async function credencialesDelCliente[\s\S]*?executeTakeFirst\(\)/.exec(fuente)?.[0] ?? '';
  assert.match(delCliente, /\.where\('c\.org_id', '=', orgId\)/, 'la conexión de un cliente se lee sin su organización');
  assert.match(delCliente, /\.where\('c\.id', '=', cuentaId\)/);
});

test('toda llamada a un resolvedor pasa el cliente, también en los scripts que tsc no mira', () => {
  const cortas: string[] = [];
  let vistas = 0;
  for (const a of archivosFuente(['app', 'lib', 'scripts', 'components'])) {
    if (a.ruta === 'lib/credenciales/resolver.ts') continue;
    for (const r of RESOLVEDORES) {
      for (const args of llamadas(a.limpio, r)) {
        vistas += 1;
        if (args.length < 3) cortas.push(`${a.ruta}: ${r}(${args.join(', ')})`);
      }
    }
  }
  assert.ok(vistas >= 20, `encontré ${vistas} llamadas: la búsqueda no está mirando nada`);
  assert.deepEqual(cortas, [], 'una llamada no dice de qué cliente es la credencial');
});

test('las rutas de un contacto piden la credencial del cliente del contacto', () => {
  const RUTAS = [
    'app/api/contactos/[id]/route.ts',
    'app/api/contactos/[id]/mensajes/route.ts',
    'app/api/contactos/[id]/resolver/route.ts',
    'app/api/contactos/[id]/avanzar/route.ts',
  ];
  for (const ruta of RUTAS) {
    const fuente = leer(ruta);
    assert.match(fuente, /\bclienteDelContacto\(/, `${ruta} no averigua de qué cliente es el contacto`);
    for (const r of RESOLVEDORES) {
      for (const args of llamadas(fuente, r)) {
        assert.notEqual(args[2], "'la_de_la_empresa'", `${ruta}: ${r} pide la de la empresa para un contacto de cualquier cliente`);
        assert.match(args[2] ?? '', /\bcliente\b/, `${ruta}: ${r} no usa el cliente del contacto`);
      }
    }
  }
});

test('el aviso del CRM entra en el cliente de su secreto, y sólo en uno activo', () => {
  const fuente = leer('app/api/avisos/crm/route.ts');
  const delCliente = /selectFrom\('cuentas_credenciales as c'\)[\s\S]*?executeTakeFirst\(\)/.exec(fuente)?.[0] ?? '';
  assert.match(delCliente, /\.where\('k\.es_por_omision', '=', false\)/, 'el secreto viejo del principal en cuentas_credenciales entraría');
  assert.match(delCliente, /\.where\('k\.estado', '=', 'activa'\)/, 'un cliente en pausa o de baja recibe avisos');
  assert.match(fuente, /ambitoDeUnCliente\(orgId, fila\.cuenta_id\)/);
  const aperturas = [...fuente.matchAll(/\bconOrganizacion\(\s*([^,]+),/g)].map((m) => m[1]!.trim());
  assert.ok(aperturas.length >= 3, `encontré ${aperturas.length} aperturas`);
  assert.deepEqual(aperturas.filter((a) => a !== 'ambito'), [], 'el aviso escribe con la empresa entera: con dos clientes cae en el principal');
  assert.match(fuente, /resolverAccesoAGhl\(db, orgId, cliente\)/, 'la atribución compara con la subcuenta de la empresa');
});

test('la Conexión de un cliente no desmonta el aviso al recargar', () => {
  const fuente = leer('components/ajustes/ConexionDelCliente.jsx');
  // «Leyendo…» sólo mientras no hay datos; y cargar nunca los vacía.
  assert.match(fuente, /if \(!datos\)/);
  const cargar = /const cargar = useCallback\([\s\S]*?\}, \[ruta\]\);/.exec(fuente)?.[0] ?? '';
  assert.ok(cargar, 'no encontré `cargar`');
  assert.doesNotMatch(cargar, /setDatos\(null\)/, 'recargar vacía los datos y desmonta `AvisoDelCrm`');
  assert.match(fuente, /<AvisoDelCrm\s+ruta=\{ruta\}/, 'el secreto del aviso no se genera en la ruta del cliente');
  // Un componente por cliente: sin `key`, cambiar de cliente mostraría la conexión del anterior.
  assert.match(leer('components/ajustes/Clientes.jsx'), /<ConexionDelCliente\s+key=\{editando\.id\}/);
  // Y mientras la cabecera del aviso está a la vista, la ventana no se cierra con Escape ni con el fondo.
  assert.match(leer('components/ajustes/Clientes.jsx'), /cerrablePorFuera=\{!cabeceraVisible\}/);
  assert.match(fuente, /alMostrarCabecera=\{alMostrarCabecera\}/);
});

/**
 * Quien pide la de la empresa A PROPÓSITO, uno por uno y con su porqué (el nivel 3, C6). Una ruta o un guion que pasa
 * `'la_de_la_empresa'` como tercer argumento compila y pasa la prueba de los tres argumentos: con dos clientes leería la
 * subcuenta de la empresa para lo de otro negocio. Cada uso nuevo, o uno que se va, se escribe acá en el mismo commit.
 */
const PIDEN_LA_DE_LA_EMPRESA: readonly string[] = [
  // El barrido del principal y las tareas que son de la empresa entera; cada otro cliente lleva su credencial aparte.
  'app/api/cron/route.ts',
  // «Probar conexión» de Ajustes › Credenciales: prueba la de la empresa, que es la que esa pantalla carga.
  'app/api/admin/credenciales/meta/route.ts',
  // Las cuatro rutas de un contacto: `cliente ?? …`, la caída cuando el contacto no está a la vista (antes, un 404).
  'app/api/contactos/[id]/route.ts',
  'app/api/contactos/[id]/resolver/route.ts',
  'app/api/contactos/[id]/mensajes/route.ts',
  'app/api/contactos/[id]/avanzar/route.ts',
];

test('quien pide la de la empresa está escrito, y la lista no tiene entradas muertas', () => {
  const piden = archivosFuente(['app', 'lib', 'scripts', 'components'])
    .filter((a) => a.ruta !== 'lib/credenciales/resolver.ts' && a.limpio.includes("'la_de_la_empresa'"))
    .map((a) => a.ruta);
  assert.deepEqual(
    piden.filter((r) => !PIDEN_LA_DE_LA_EMPRESA.includes(r)),
    [],
    'piden la credencial de la empresa sin decirlo: con dos clientes, leen la subcuenta de la empresa para otro negocio',
  );
  assert.deepEqual(PIDEN_LA_DE_LA_EMPRESA.filter((r) => !piden.includes(r)), [], 'ya no piden la de la empresa: sácalos de PIDEN_LA_DE_LA_EMPRESA');
});
