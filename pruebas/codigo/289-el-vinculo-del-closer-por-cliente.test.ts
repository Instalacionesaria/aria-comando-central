// EL VÍNCULO DEL CLOSER POR CLIENTE: EL CORTE, LA TABLA DE SALES Y LA PANTALLA, SIN BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5 · G2)
//
// El vínculo de un closer con el CRM es de un cliente: el usuario de GoHighLevel es de la subcuenta de cada uno. Lo
// que no necesita base; la base lo mira la 288. Cada afirmación dice la mutación que la pone en rojo:
//
//   · ningún corte del closer compara `crm_asignado_a` solo: los cinco sitios usan `contactoDelCloser`, el corte por
//     par (cliente, usuario del CRM) — mutación: uno de los sitios vuelve a `.where('k.crm_asignado_a', '=', …)`;
//   · la tabla de Sales agrupa por par — mutación: `groupBy('co.crm_asignado_a')`;
//   · la pantalla pide los usuarios del cliente elegido, por un solo camino con turno (la primera carga también), y el
//     selector sólo aparece con más de uno — mutaciones: pedir siempre sin `?cuenta=`, la primera carga por fuera del
//     turno, el selector sin la condición;
//   · el cliente llega a `guardar` como argumento y cambiar de cliente cierra el alta — mutaciones: guardar sin el
//     cliente, `elegirCliente` sin vaciar el alta;
//   · la ruta no ofrece ni acepta clientes de baja, y nadie le dice «quitá» a quien administra — mutaciones: sin el
//     filtro de baja, el voseo de vuelta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente, sinComentarios } from '../apoyo/fuente.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
const cuantas = (texto: string, patron: RegExp) => [...texto.matchAll(patron)].length;

test('ningún corte del closer compara `crm_asignado_a` solo: los cinco sitios usan el corte por par', () => {
  /* Las dos formas de comparar la columna: con Kysely (`'k.crm_asignado_a', '='` o sin alias, como era en `inicio.ts`)
     y en SQL crudo. La única que puede nombrarla es la definición del corte. */
  const kysely = /['"`](\w+\.)?crm_asignado_a['"`]\s*,\s*['"`](=|in|is)['"`]/;
  const crudo = /crm_asignado_a\s*(=|<>|!=|\bin\s*\(|\bis\b)/i;
  const comparan = archivosFuente(['lib', 'app'])
    .filter((a) => a.ruta !== 'lib/negocio/alcanceDelCloser.ts')
    .filter((a) => kysely.test(a.limpio) || crudo.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(comparan, [], 'un corte compara el usuario del CRM sin su cliente: el mismo id en otra subcuenta es otra persona');

  const sitios: [string, number][] = [
    ['lib/negocio/agenda.ts', 3],
    ['lib/negocio/fila.ts', 1],
    ['lib/negocio/inicio.ts', 1],
    ['lib/agentes/brief/entrada.ts', 1],
    ['lib/agentes/cabecera.ts', 1],
  ];
  for (const [ruta, n] of sitios) {
    assert.equal(cuantas(leer(ruta), /contactoDelCloser\(/g), n, `${ruta} dejó de cortar con \`contactoDelCloser\``);
  }
  // Y el corte es por PAR: la tupla (cuenta_id, crm_asignado_a) contra la lista de vínculos.
  const corte = leer('lib/negocio/alcanceDelCloser.ts');
  assert.match(corte, /\$\{alias\}\.cuenta_id`\)\}, \$\{sql\.ref\(`\$\{alias\}\.crm_asignado_a`\)\}\) in \(/);
  assert.match(corte, /\$\{v\.cuentaId\}::uuid, \$\{v\.crmUsuarioId\}::text/);
});

test('la tabla de Sales agrupa por par, y cuenta cada cita en la fila de su par', () => {
  const src = leer('lib/negocio/cierrePorCloser.ts');
  assert.match(src, /groupBy\(\[\s*'co\.cuenta_id'\s*,\s*'co\.crm_asignado_a'\s*\]\)/, 'la tabla agrupa por el usuario del CRM solo');
  assert.match(src, /porPar\.get\(k\)/);
  assert.match(src, /conCloser\.has\(par\(f\.cuenta, f\.quien\)\)/, 'los baldes de afuera no miran el par');
});

test('la pantalla pide los usuarios del cliente elegido, y el selector sólo aparece con más de uno', () => {
  const panel = leer('components/closer/QuienEsElCloser.jsx');
  assert.match(panel, /usuarios-crm\?cuenta=\$\{/, 'la pantalla pide siempre los usuarios de la empresa: los de otro cliente son de otra subcuenta');
  // Un solo camino a la lista del CRM, con su turno; la primera carga también pasa por él.
  assert.equal(cuantas(panel, /\/api\/admin\/closer\/usuarios-crm/g), 2, 'hay un pedido de usuarios del CRM por fuera de `cargarUsuariosCrm`');
  assert.match(panel, /void cargarUsuariosCrm\(null\)/, 'la primera carga no pasa por el turno: si llega tarde, pisa la lista del cliente elegido');
  assert.match(panel, /if \(turno !== turnoDelCrm\.current\) return;/);
  assert.match(panel, /(varios|clientes\.length\s*>\s*1)\s*\?\s*\([\s\S]{0,600}?ck-cliente/, 'el selector de cliente se dibuja también con uno solo');
  assert.match(panel, /cuerpo: cuentaId\s*\?\s*\{ usuarioId, crmUsuarioId: crmUsuarioId \?\? '', cuentaId \}/, 'el PUT no manda el cliente');
});

test('el cliente llega a `guardar` como argumento, y cambiar de cliente cierra el alta', () => {
  const panel = leer('components/closer/QuienEsElCloser.jsx');
  assert.match(panel, /guardar\(k\.usuarioId, crm, varios \? cliente : null\)/, 'la fila guarda sin decir en qué cliente');
  assert.match(panel, /guardar\(nuevo\.usuarioId, nuevo\.crmUsuarioId, varios \? cliente : null\)/, 'el alta guarda sin decir en qué cliente');
  const elegir = panel.slice(panel.indexOf('const elegirCliente = useCallback('), panel.indexOf('[cargarUsuariosCrm],'));
  assert.match(elegir, /setNuevo\(null\)/, 'cambiar de cliente deja abierta un alta con un usuario de la subcuenta anterior');
  assert.match(elegir, /cargarUsuariosCrm\(id\)/);
});

test('la ruta no ofrece ni acepta clientes de baja, y nadie le dice «quitá» a quien administra', () => {
  const ruta = leer('app/api/admin/closer/route.ts');
  assert.equal(cuantas(ruta, /\.where\('estado', '!=', 'baja'\)/g), 2, 'el GET ofrece, o el PUT acepta, un cliente dado de baja');
  assert.match(ruta, /detalle: \{ cuenta: cliente\.id \}/, 'la auditoría no dice en qué cliente se vinculó');
  const quita = /(?<!\p{L})quitá(?!\p{L})/iu;
  assert.doesNotMatch(ruta, quita);
  assert.doesNotMatch(leer('components/closer/QuienEsElCloser.jsx'), quita);
});
