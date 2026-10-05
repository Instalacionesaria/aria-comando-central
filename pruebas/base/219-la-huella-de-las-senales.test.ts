// LA HUELLA DE LAS SEÑALES: UNA DESCARTADA NO RENACE, Y LO QUE NO SE PUDO MEDIR NO SE CIERRA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/senales/escritura.ts` y la migración 072 (AG8 de los agentes;
// `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-22 y AG-23). La reconciliación diaria, contra la base:
//
//   · lo detectado nace una vez y después se actualiza; debajo del piso no nace, se cuenta;
//   · una descartada no renace mientras la condición siga, y sí cuando vuelve más grave o cuando la condición
//     se apagó y volvió;
//   · lo que deja de detectarse se cierra solo si la regla se midió, y queda `sin_medicion` si su fuente no
//     llegó —y vuelve a `abierta` cuando llega—;
//   · la base lo sostiene sola: dos vivas con la misma huella son un `23505`, y `issue_source` es sólo de
//     Conversation.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cerrarSenal, marcarVista, reconciliarSenales, type PasadaDeUnDepartamento } from '../../lib/agentes/senales/escritura.ts';
import type { Deteccion, Gravedad } from '../../lib/agentes/senales/tipos.ts';

let admin: Client;
let alfa: string;
let ana: string;

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  const u = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'ana@alfa.ejemplo'`);
  assert.ok(a && u, 'falta el sembrado: corré `npm run db:reset`');
  alfa = a.id;
  ana = u.id;
});
beforeEach(async () => {
  await admin.query('delete from negocio.senales where org_id = $1', [alfa]);
});
after(async () => {
  await admin.query('delete from negocio.senales where org_id = $1', [alfa]);
  await cerrarTodo();
  await cerrarClientes();
});

/** Una detección de la regla de prueba sobre una campaña, con lo que haga falta cambiar. */
function deteccion(entidad: string, cambios: Partial<Deteccion> = {}): Deteccion {
  return {
    regla: 'ACQ-PRUEBA-219',
    entidad: { tipo: 'campana', id: entidad },
    metrica: 'costo_por_contacto',
    lineaBase: 50,
    valorActual: 70,
    cambioPct: 0.4,
    muestra: 14,
    periodo: { desde: '2026-09-04', hasta: '2026-10-03' },
    datosDesde: '2026-08-05',
    gravedad: 'media',
    causasPosibles: ['puede deberse a la fatiga del creativo'],
    revisionRecomendada: 'Revisa la campaña antes de subirle el presupuesto.',
    perdidaContactos: 4,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 0.3, provisional: true },
    evidencia: { filas: [{ campana: entidad, contactos: 14 }] },
    ...cambios,
  };
}

const pasar = (detecciones: Deteccion[], sinMedicion: string[] = []) =>
  conOrganizacion(alfa, () =>
    reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '30d', detecciones, sinMedicion } satisfies PasadaDeUnDepartamento),
  );

const senales = () =>
  filas<{ entidad_id: string; estado: string; gravedad: string; confianza: string; condicion_apagada_el: Date | null; muestra: number }>(
    admin,
    'select entidad_id, estado, gravedad, confianza, condicion_apagada_el, muestra from negocio.senales where org_id = $1 order by creada_el, entidad_id',
    [alfa],
  );

const decidir = (entidad: string, estado: 'descartada' | 'resuelta') =>
  admin.query(
    `update negocio.senales set estado = $3, cerrada_el = now(), cerrada_por = $4, motivo_cierre = 'ya se sabe'
      where org_id = $1 and entidad_id = $2 and estado = 'abierta'`,
    [alfa, entidad, estado, ana],
  );

test('lo detectado nace una vez y después se actualiza; debajo del piso no nace, se cuenta', async () => {
  const primera = await pasar([deteccion('c1'), deteccion('c2', { muestra: 9 })]);
  assert.equal(primera.nuevas, 1);
  assert.deepEqual(primera.debajoDelPiso, [{ regla: 'ACQ-PRUEBA-219', entidad: { tipo: 'campana', id: 'c2' }, muestra: 9 }]);
  const segunda = await pasar([deteccion('c1', { muestra: 31, valorActual: 75 })]);
  assert.deepEqual([segunda.nuevas, segunda.actualizadas], [0, 1]);
  const s = await senales();
  assert.equal(s.length, 1, 'la misma huella nació dos veces');
  // La confianza sale de la muestra: 14 era media, 31 es alta.
  assert.deepEqual([s[0]!.estado, s[0]!.muestra, s[0]!.confianza], ['abierta', 31, 'alta']);
});

test('una descartada no renace mientras la condición siga; más grave, sí', async () => {
  await pasar([deteccion('c1')]);
  await decidir('c1', 'descartada');
  const igual = await pasar([deteccion('c1')]);
  assert.deepEqual([igual.nuevas, igual.vistasDeNuevo], [0, 1]);
  assert.deepEqual((await senales()).map((x) => x.estado), ['descartada']);

  // Menos grave tampoco: la decisión se tomó sobre algo más grave.
  const menos = await pasar([deteccion('c1', { gravedad: 'info' })]);
  assert.equal(menos.vistasDeNuevo, 1);

  const peor = await pasar([deteccion('c1', { gravedad: 'critica' as Gravedad })]);
  assert.equal(peor.renacidas, 1);
  const s = await senales();
  assert.deepEqual(s.map((x) => [x.estado, x.gravedad]), [['descartada', 'media'], ['abierta', 'critica']]);
  assert.ok(s[0]!.condicion_apagada_el, 'la descartada sigue bloqueando la huella');
});

test('lo que deja de detectarse se cierra solo si se midió; sin fuente queda sin medición, y vuelve', async () => {
  await pasar([deteccion('c1'), deteccion('c2')]);

  // La fuente no llegó: ninguna de las dos se puede afirmar ni negar.
  const sinFuente = await pasar([], ['ACQ-PRUEBA-219']);
  assert.equal(sinFuente.sinMedicion, 2);
  assert.deepEqual((await senales()).map((x) => x.estado), ['sin_medicion', 'sin_medicion']);

  // Llegó: c1 sigue y vuelve a abierta en la misma fila; c2 ya no está y se cierra sola.
  const vuelve = await pasar([deteccion('c1')]);
  assert.deepEqual([vuelve.nuevas, vuelve.actualizadas, vuelve.cerradasSolas], [0, 1, 1]);
  assert.deepEqual((await senales()).map((x) => [x.entidad_id, x.estado]), [['c1', 'abierta'], ['c2', 'cerrada_sola']]);
});

test('una descartada cuya condición se apagó deja de bloquear: si vuelve, es un hecho nuevo', async () => {
  await pasar([deteccion('c1')]);
  await decidir('c1', 'resuelta');
  // Sin fuente, la decisión sigue bloqueando: no se puede afirmar que la condición se fue.
  await pasar([], ['ACQ-PRUEBA-219']);
  assert.equal((await senales())[0]!.condicion_apagada_el, null);
  // Medida y ausente: la condición se apagó.
  const apagada = await pasar([]);
  assert.equal(apagada.condicionesApagadas, 1);
  // Y vuelve: nace otra.
  const otraVez = await pasar([deteccion('c1')]);
  assert.equal(otraVez.nuevas, 1);
  assert.deepEqual((await senales()).map((x) => x.estado), ['resuelta', 'abierta']);
});

test('la base lo sostiene sola: una viva por huella, y `issue_source` sólo en Conversation', async () => {
  await pasar([deteccion('c1')]);
  // Una segunda viva con la misma huella, escrita a mano: el índice parcial la rechaza.
  await assert.rejects(
    admin.query(
      `insert into negocio.senales (org_id, departamento, detector, regla, entidad_tipo, entidad_id, metrica, ventana,
         periodo_hasta, gravedad, confianza, revision_recomendada, umbral, evidencia, huella)
       select org_id, departamento, detector, regla, entidad_tipo, entidad_id, metrica, ventana,
         periodo_hasta, gravedad, confianza, revision_recomendada, umbral, evidencia, huella
         from negocio.senales where org_id = $1`,
      [alfa],
    ),
    (e: { code?: string }) => e.code === '23505',
  );
  await assert.rejects(
    admin.query(`update negocio.senales set issue_source = 'prompt_design' where org_id = $1`, [alfa]),
    (e: { code?: string }) => e.code === '23514',
  );
  // Debajo del piso tampoco entra a mano.
  await assert.rejects(
    admin.query(`update negocio.senales set muestra = 9 where org_id = $1`, [alfa]),
    (e: { code?: string }) => e.code === '23514',
  );
});

test('una persona sólo marca o cierra señales del departamento que nombra, y una cerrada no se reabre', async () => {
  await pasar([deteccion('c1')]);
  const id = (await admin.query<{ id: string }>('select id from negocio.senales where org_id = $1', [alfa])).rows[0]!.id;
  // Desde otro departamento, la señal no existe: ni se marca ni se cierra.
  assert.equal(await conOrganizacion(alfa, () => marcarVista('creative', id, ana)), 'no_encontrada');
  assert.equal(await conOrganizacion(alfa, () => cerrarSenal('creative', id, 'descartada', 'x', ana)), 'no_encontrada');
  assert.deepEqual((await senales()).map((x) => x.estado), ['abierta']);
  assert.equal(await conOrganizacion(alfa, () => cerrarSenal('acquisition', id, 'resuelta', 'Hecho.', ana)), 'hecho');
  assert.equal(await conOrganizacion(alfa, () => cerrarSenal('acquisition', id, 'descartada', 'Otra vez.', ana)), 'cerrada');
  assert.equal(await conOrganizacion(alfa, () => marcarVista('acquisition', id, ana)), 'hecho', 'marcar vista una cerrada no es un error');
  assert.deepEqual((await senales()).map((x) => x.estado), ['resuelta']);
});
