// MIENTRAS EL CEREBRO ESPERA AL MODELO, NINGUNA TRANSACCIÓN QUEDA ABIERTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-05. El agrupador tiene cinco conexiones, y una pregunta
// espera al modelo hasta dos minutos por ronda. Una transacción abierta durante esa espera retiene una
// conexión de cinco: tres personas preguntando a la vez dejan a la empresa entera esperando, y nada falla
// en una prueba de un solo usuario. La prueba 207 lo mira en el código; ésta lo mide en la base: con el
// modelo falso detenido a mitad de la respuesta, ninguna sesión de la aplicación está
// `idle in transaction`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { montar, pedirComo, type Escenario } from '../apoyo/closer.ts';
import { instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima, type ModeloFalso } from '../apoyo/cerebro.ts';
import { POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';

let esc: Escenario;
let modelo: ModeloFalso | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  // El registro del tope no cae con los hilos (a propósito): se limpia aparte.
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
}

before(async () => {
  esc = await montar('Cerebro210');
  await limpiar();
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-210')]);
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Las sesiones de los roles de la aplicación que tienen una transacción abierta y no hacen nada. */
async function abiertasSinHacerNada(): Promise<number> {
  const r = await esc.admin.query<{ n: number }>(
    `select count(*)::int as n from pg_stat_activity
      where usename in ('app_inquilino', 'app_identidad') and state like 'idle in transaction%'`,
  );
  return r.rows[0]?.n ?? 0;
}

test('con el modelo detenido en cada ronda, ninguna conexión de la aplicación queda con una transacción abierta', async () => {
  const medidas: number[] = [];
  /** Una ronda que, antes de contestar, mide la base: el cerebro está esperando al modelo. */
  const midiendo = (respuesta: () => Response) => async () => {
    // Un respiro para que cualquier transacción que el código hubiera abierto llegue a esperar.
    await new Promise((listo) => setTimeout(listo, 150));
    medidas.push(await abiertasSinHacerNada());
    return respuesta();
  };
  modelo = instalarModeloFalso([
    midiendo(() => respuestaDelModelo([pideHerramienta('cadena_de_cierre', { periodo: '7d' })])),
    midiendo(() => respuestaDelModelo([pideHerramienta('responder', respuestaMinima())])),
  ]);
  const r = await preguntarAlCerebro(pedirComo('/api/executive', esc.token, { metodo: 'POST', cuerpo: { pregunta: '¿Cómo va el cierre?' } }));
  assert.equal(r.status, 200);
  assert.deepEqual(medidas, [0, 0], 'una transacción quedó abierta mientras se esperaba al modelo');
});
