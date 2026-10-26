// TOOLS, LA LISTA DE USUARIOS DEL CRM Y LOS GUIONES DE MEDICIÓN, POR CLIENTE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D2)
//
// La 292 mide las rutas con la base. Acá, lo que no la necesita:
//
//   · los tres guiones de medición miden a cada cliente activo con SU token, y ninguno lee la credencial de la
//     empresa ni el negocio; sus cortes de un cliente son `return` y sus `continue` siguen dentro de un bucle — un
//     `continue` fuera de un bucle es un error de sintaxis que nada más atrapa: los guiones no corren en la suite y
//     tsc no mira los `.mjs`, así que cada uno pasa por `node --check` — mutaciones: `'la_de_la_empresa'` de vuelta;
//     un `continue` de adentro vuelto `return`; un `return` de un cliente vuelto `continue`;
//   · siguen midiendo lo que medían con un cliente: medir-cita termina en el primer cliente con citas — mutación: no
//     cortar en medir-cita (medir-gasto, el cuarto, se fue con la lectura del gasto por GoHighLevel: Meta directo, M5);
//   · Tools elige el cliente entre los activos y nombra al cliente sólo con más de uno; la pantalla manda el cliente
//     sólo entonces, y el cliente final sigue sin llegar — mutaciones: el selector o el envío sin `varios`; los
//     visibles en vez de los activos; la ruta en `RUTAS_DEL_CLIENTE`;
//   · la lista de usuarios del CRM no lee a uno de baja, y lee el agente con el resolvedor.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { RUTAS_DEL_CLIENTE, SECCIONES_DEL_CLIENTE } from '../../lib/autorizacion/cliente.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

/** El cuerpo de `medirUnCliente`: hasta la primera llave de cierre en la columna 0. */
function cuerpoDeMedir(guion: string): string {
  const i = guion.indexOf('async function medirUnCliente(');
  assert.ok(i >= 0, 'no encontré `medirUnCliente`');
  return guion.slice(i, guion.indexOf('\n}\n', i));
}

const cuantas = (texto: string, patron: RegExp) => (texto.match(patron) ?? []).length;

/** Cuántos `continue;`, `return;`, `return false;` y `return true;` tiene cada guion en `medirUnCliente`. */
const CORTES: Readonly<Record<string, { continuar: number; volver: number; falso: number; verdadero: number }>> = {
  // Los dos `continue` saltean un calendario que falló o sin citas; `true` es «respondió la pregunta».
  'scripts/medir-cita.mjs': { continuar: 2, volver: 0, falso: 3, verdadero: 1 },
  // Sin acceso, búsqueda fallida, sin contactos; los dos `continue` saltean una clave vacía o una que no es de atribución.
  'scripts/medir-contacto.mjs': { continuar: 2, volver: 3, falso: 0, verdadero: 0 },
  'scripts/medir-activos-en-ghl.mjs': { continuar: 0, volver: 1, falso: 0, verdadero: 0 },
  // `medir-gasto-de-la-cuenta.mjs` se fue con la lectura del gasto por GoHighLevel (Meta directo, M5).
};
const GUIONES = Object.keys(CORTES);

test('los tres guiones miden a cada cliente activo con su token, sin la credencial de la empresa ni el negocio', () => {
  for (const ruta of GUIONES) {
    const guion = leer(ruta);
    assert.ok(guion.includes('clientesParaBarrer(db, org.id)'), `${ruta} no lee los clientes activos`);
    assert.match(guion, /resolverAccesoAGhl\(db, org\.id, (?:c\.)?cuenta\)/, `${ruta} no pide la credencial de cada cliente`);
    assert.ok(guion.includes('async function medirUnCliente('), `${ruta} no mide de a un cliente`);
    assert.ok(guion.includes('await medirUnCliente(org, c, varios'), `${ruta} no recorre los clientes`);
    // Sin la de la empresa, y sin leer negocio: así quedan fuera de `CRUZAN_LOS_DOS_DOMINIOS`.
    for (const no of ["'la_de_la_empresa'", 'organizaciones_credenciales', 'conOrganizacion(']) {
      assert.ok(!guion.includes(no), `${ruta} volvió a ${no}`);
    }
  }
});

test('los cortes de un cliente son `return`, los `continue` siguen en su bucle, y los tres compilan', () => {
  for (const ruta of GUIONES) {
    const cuerpo = cuerpoDeMedir(leer(ruta));
    const esperado = CORTES[ruta]!;
    assert.deepEqual(
      {
        continuar: cuantas(cuerpo, /\bcontinue;/g),
        volver: cuantas(cuerpo, /\breturn;/g),
        falso: cuantas(cuerpo, /\breturn false;/g),
        verdadero: cuantas(cuerpo, /\breturn true;/g),
      },
      esperado,
      `${ruta}: un corte de un cliente cambió de forma`,
    );
    // Un `continue` sin bucle es un SyntaxError que la suite no vería de otro modo.
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', join(RAIZ, ruta)], { stdio: 'pipe' }),
      `${ruta} no compila`,
    );
  }
});

test('con un cliente miden lo que medían: medir-cita corta en el primero con citas', () => {
  const cita = leer('scripts/medir-cita.mjs');
  assert.match(cita, /for \(const c of clientes\) if \(await medirUnCliente\(org, c, varios\)\) return;/, 'medir-cita ya no corta en el primero que respondió');
});

test('Tools elige entre los activos, nombra al cliente sólo con más de uno, y el cliente final no llega', () => {
  const ruta = leer('app/api/tools/leads/enviar/route.ts');
  assert.ok(!ruta.includes("'la_de_la_empresa'"), 'Tools volvió a la credencial de la empresa');
  assert.ok(ruta.includes('clientesQueTrae(contexto, PANTALLA)'));
  assert.ok(ruta.includes('resolverAccesoAGhl(db, contexto.orgEfectiva, cliente)'));
  assert.ok(ruta.includes('TEXTO_DE_FALTA_GHL_DEL_CLIENTE'), 'la falta de un cliente se dice con el texto de la empresa');
  assert.match(ruta, /const varios = activos\.length > 1;/, 'el nombre del cliente depende de otra cuenta que la de los activos');

  assert.ok(leer('lib/tools/leads.ts').includes('cuentaId ? { ids, etiqueta, cuentaId } : { ids, etiqueta }'), 'con un cliente, el pedido cambió');

  const pantalla = leer('components/tools/MisLeads.jsx');
  assert.match(pantalla, /\.filter\(\(c\) => c\.estado === 'activa'\)/, 'el selector cuenta clientes en pausa');
  assert.match(pantalla, /const varios = activos\.length > 1;/);
  assert.match(pantalla, /\{varios \? \(\s*<label className="lp-campo">\s*Cliente\s*<select/, 'el selector se dibuja con un solo cliente');
  assert.ok(pantalla.includes('enviarLeadsAlCrm([...marcados], etiqueta, varios ? cliente : null)'), 'con un cliente se manda el cliente');
  assert.ok(pantalla.includes('su subcuenta la vincula la '), 'la nota manda a cargar la subcuenta de un cliente en Ajustes');
  // El selector, con el trazo del campo y no con el del navegador.
  assert.match(readFileSync(join(RAIZ, 'app/fundaciones.css'), 'utf8'), /\.lp-campo input,\r?\n\.lp-campo select \{/);

  // Tools no es del cliente final: el portero lo rechaza antes de la ruta.
  assert.ok(!RUTAS_DEL_CLIENTE.includes('POST /api/tools/leads/enviar' as never));
  assert.ok(!SECCIONES_DEL_CLIENTE.has('tools'));
});

test('la lista de usuarios del CRM no lee a uno de baja, y el agente sale del resolvedor', () => {
  const ruta = leer('app/api/admin/closer/usuarios-crm/route.ts');
  assert.match(ruta, /\.where\('estado', '<>', 'baja'\)/, 'un cliente de baja da sus usuarios');
  assert.ok(ruta.includes('agenteDelCrmDe(db, contexto.orgEfectiva, cliente)'));
  for (const no of ["'la_de_la_empresa'", 'organizaciones_credenciales', 'cuentas_credenciales']) {
    assert.ok(!ruta.includes(no), `la ruta volvió a ${no}`);
  }
});
