// EL TABLERO DE NEGOCIOS: QUÉ SUMA, QUÉ NO, Y QUÉ DICE DE LA FOTO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 9)
//
// `armarElTablero` (`lib/cartera/tablero.ts`) junta la foto del día con la configuración en vivo. Lo que dibuja la
// pestaña Negocios —y lo que va a leer el agente— sale de acá:
//
//   · las cifras de arriba no cuentan a ARIA ni a los clientes de prueba — mutación: sumar todas las empresas;
//   · nulo no es cero: una empresa sin medir no suma, y sin ninguna medida la cifra es nula — mutación: `?? 0`;
//   · una tasa con menos de 10 en el denominador no se calcula — mutación: sin el piso;
//   · nunca se suman monedas distintas — mutación: un solo total;
//   · la configuración es la de ahora y las cifras las de la foto: un cliente nuevo aparece sin cifras y sin que se
//     le acuse lo que no se midió — mutación: la configuración de la foto;
//   · sin la configuración (el modo del agente), ningún nombre;
//   · la foto vieja o ausente se dice, con el umbral del cron.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConfiguracionDeLosNegocios, ConfiguracionDeUnCliente, ConfiguracionDeUnaEmpresa } from '../../lib/cartera/configuracion.ts';
import { filasDeUnaEmpresa } from '../../lib/cartera/foto.ts';
import type { FilaDeLaFotoDeUnCliente, FilaDeLaFotoDeUnaEmpresa, FotoDeLosNegocios } from '../../lib/cartera/lectura.ts';
import { MEDIDA_SIN_FILAS, type MedidaDeUnCliente, type MedidaDeUnaEmpresa } from '../../lib/cartera/medicion.ts';
import { FOTO_VIEJA_MS, armarElTablero } from '../../lib/cartera/tablero.ts';
import { HORARIOS } from '../../lib/negocio/barrido.ts';

const AHORA = Date.parse('2026-10-18T12:00:00Z');
const DIA = '2026-10-18';
const HACE_UNA_HORA = new Date(AHORA - 3600_000);

function cliente(id: string, extra: Partial<ConfiguracionDeUnCliente> = {}): ConfiguracionDeUnCliente {
  return {
    id,
    nombre: `Cliente ${id}`,
    estado: 'activa',
    esPrueba: false,
    esPorOmision: false,
    nicho: 'salud',
    nichoConfirmado: true,
    modeloDeNegocio: null,
    pais: 'PE',
    moneda: 'PEN',
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    crmVinculado: true,
    crmConectado: true,
    calendario: true,
    meta: false,
    aviso: false,
    ...extra,
  };
}

function empresa(id: string, clientes: ConfiguracionDeUnCliente[], extra: Partial<ConfiguracionDeUnaEmpresa> = {}): ConfiguracionDeUnaEmpresa {
  return {
    id,
    slug: id,
    nombre: `Empresa ${id}`,
    activa: true,
    esPrincipal: false,
    pais: 'PE',
    nichoPrincipal: null,
    precioMensual: null,
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    llaveDeIa: true,
    usuarios: 2,
    usuariosLimitados: 0,
    clientes,
    ...extra,
  };
}

/** La medida de cada cliente: al día y con Meta vinculado en su GoHighLevel, salvo lo que diga `porCliente`. */
function medida(porCliente: Record<string, Partial<MedidaDeUnCliente>>): MedidaDeUnaEmpresa {
  return {
    porCliente: new Map(
      Object.entries(porCliente).map(([id, m]) => [id, { ...MEDIDA_SIN_FILAS, ultimaIngestaEl: HACE_UNA_HORA, metaEnElCrm: true, ...m }]),
    ),
    iaLlamadas30d: 0,
    incidentes30d: 0,
    senalesAbiertas: 0,
  };
}

/** La foto, armada con el mismo escritor que la toma de verdad. */
function fotoDe(medidas: [ConfiguracionDeUnaEmpresa, MedidaDeUnaEmpresa | null][], tomadaEl = HACE_UNA_HORA): FotoDeLosNegocios {
  const filas = medidas.map(([e, m]) => filasDeUnaEmpresa(e, m, m ? null : 'no se pudo medir', 'aria', DIA, AHORA));
  return {
    dia: DIA,
    tomadaEl,
    contrato: 1,
    empresas: filas.map((f) => ({ ...f.empresa, tomada_el: tomadaEl }) as FilaDeLaFotoDeUnaEmpresa),
    cuentas: filas.flatMap((f) => f.clientes.map((c) => ({ ...c, tomada_el: tomadaEl }) as FilaDeLaFotoDeUnCliente)),
  };
}

const ARIA = empresa('aria', [cliente('aria-1')], { esPrincipal: true });
const UNO = empresa('uno', [cliente('uno-1'), cliente('uno-2', { esPrueba: true })]);
const DOS = empresa('dos', [cliente('dos-1', { moneda: 'USD', nicho: 'legal' })]);
const config = (...empresas: ConfiguracionDeUnaEmpresa[]): ConfiguracionDeLosNegocios => ({
  principal: { id: 'aria', zonaHoraria: 'America/Lima' },
  empresas,
});

test('las cifras de arriba no cuentan a ARIA ni a los clientes de prueba', () => {
  const foto = fotoDe([
    [ARIA, medida({ 'aria-1': { contactosNuevos30d: 100, ventas30d: 50 } })],
    [UNO, medida({ 'uno-1': { contactosNuevos30d: 7, ventas30d: 2 }, 'uno-2': { contactosNuevos30d: 1000, ventas30d: 900 } })],
    [DOS, medida({ 'dos-1': { contactosNuevos30d: 3, ventas30d: 1 } })],
  ]);
  const t = armarElTablero(foto, config(ARIA, UNO, DOS), AHORA);
  assert.deepEqual(
    [t.indicadores.empresas, t.indicadores.clientes, t.indicadores.contactosNuevos30d, t.indicadores.ventas30d],
    [2, 2, 10, 3],
  );
  // La empresa sí los muestra, separados.
  const uno = t.empresas.find((e) => e.id === 'uno')!;
  assert.deepEqual(uno.clientes, { activos: 1, pausados: 0, deBaja: 0, dePrueba: 1, configurados: 1 });
});

test('nulo no es cero: una empresa sin medir no suma, y sin ninguna medida la cifra es nula', () => {
  const unaSinMedir = armarElTablero(
    fotoDe([[UNO, medida({ 'uno-1': { contactosNuevos30d: 7 } })], [DOS, null]]),
    config(ARIA, UNO, DOS),
    AHORA,
  );
  assert.equal(unaSinMedir.indicadores.contactosNuevos30d, 7);
  assert.equal(unaSinMedir.indicadores.sinMedir, 1);
  const dos = unaSinMedir.empresas.find((e) => e.id === 'dos')!;
  assert.deepEqual([dos.cifras?.medida, dos.cifras?.motivo, dos.cifras?.contactosNuevos30d], [false, 'no se pudo medir', null]);

  const ninguna = armarElTablero(fotoDe([[UNO, null], [DOS, null]]), config(UNO, DOS), AHORA);
  assert.equal(ninguna.indicadores.contactosNuevos30d, null, 'sin ninguna medida, la cifra salió en cero');
  assert.equal(ninguna.indicadores.ventas30d, null);
});

test('una tasa con menos de 10 en el denominador no se calcula', () => {
  const de = (nuevos: number) =>
    armarElTablero(fotoDe([[UNO, medida({ 'uno-1': { contactosNuevos30d: nuevos, agendaron30d: 4 } })]]), config(UNO), AHORA).empresas[0]!
      .detalle[0]!.cifras!.tasaDeAgenda;
  assert.equal(de(9), null, 'con 9 contactos nuevos se calculó una tasa');
  assert.equal(de(10), 0.4);
});

test('nunca se suman monedas distintas, y los de prueba no venden', () => {
  const mixta = empresa('mixta', [
    cliente('m-1', { moneda: 'PEN' }),
    cliente('m-2', { moneda: 'USD' }),
    cliente('m-3', { moneda: 'PEN' }),
    cliente('m-4', { moneda: 'PEN', esPrueba: true }),
  ]);
  const t = armarElTablero(
    fotoDe([[mixta, medida({ 'm-1': { monto30d: '100' }, 'm-2': { monto30d: '30' }, 'm-3': { monto30d: '50.5' }, 'm-4': { monto30d: '999' } })]]),
    config(mixta),
    AHORA,
  );
  assert.deepEqual(t.empresas[0]!.montos, [
    { moneda: 'PEN', monto30d: '150.50' },
    { moneda: 'USD', monto30d: '30.00' },
  ]);
});

test('la configuración es la de ahora y las cifras las de la foto', () => {
  // La foto la tomó sin calendario; hoy ya lo tiene. Y un cliente nuevo, dado de alta después de la foto.
  const enLaFoto = empresa('uno', [cliente('uno-1', { calendario: false })]);
  const hoy = empresa('uno', [cliente('uno-1'), cliente('uno-nuevo')]);
  const t = armarElTablero(fotoDe([[enLaFoto, medida({ 'uno-1': { contactosNuevos30d: 5 } })]]), config(hoy), AHORA);
  const [viejo, nuevo] = t.empresas[0]!.detalle;
  assert.deepEqual([viejo!.configurado, viejo!.faltan, viejo!.cifras?.contactosNuevos30d], [true, ['meta', 'aviso'], 5]);
  assert.equal(nuevo!.cifras, null, 'un cliente que no está en la foto salió con cifras');
  assert.ok(!nuevo!.faltan.includes('datos'), 'se acusó de datos viejos a un cliente que no se midió');
  assert.equal(nuevo!.configurado, false, 'lo no medido se dio por bueno');
  assert.equal(nuevo!.nombre, 'Cliente uno-nuevo');
});

test('sin la configuración (el modo del agente), las mismas cifras y ningún nombre', () => {
  const foto = fotoDe([[UNO, medida({ 'uno-1': { contactosNuevos30d: 7 } })], [DOS, medida({ 'dos-1': { contactosNuevos30d: 3 } })]]);
  const t = armarElTablero(foto, null, AHORA);
  assert.equal(t.indicadores.contactosNuevos30d, 10);
  assert.ok(t.empresas.every((e) => e.nombre === null && e.detalle.every((c) => c.nombre === null)), 'el modo del agente trajo nombres');
  assert.ok(!JSON.stringify(t).includes('Empresa uno') && !JSON.stringify(t).includes('Cliente uno'));
});

test('los nichos: sólo los confirmados de los clientes reales, con cuántas empresas los tienen', () => {
  const tres = empresa('tres', [
    cliente('t-1', { nicho: 'salud' }),
    cliente('t-2', { nicho: 'salud', nichoConfirmado: false }),
    cliente('t-3', { nicho: 'salud', estado: 'baja' }),
    cliente('t-4', { nicho: 'legal', esPrueba: true }),
  ]);
  const t = armarElTablero(fotoDe([]), config(ARIA, UNO, DOS, tres), AHORA);
  assert.deepEqual(t.nichos, [
    { nicho: 'salud', clientes: 2, empresas: 2 },
    { nicho: 'legal', clientes: 1, empresas: 1 },
  ]);
  assert.equal(t.sinNicho, 1);
});

test('la foto vieja o ausente se dice, con el umbral del cron que la toma', () => {
  assert.equal(FOTO_VIEJA_MS, HORARIOS['29 11 * * *'].umbralMinutos * 60_000);
  const reciente = armarElTablero(fotoDe([[UNO, medida({})]]), config(UNO), AHORA);
  assert.deepEqual([reciente.foto.vieja, reciente.aviso], [false, null]);
  const vieja = armarElTablero(fotoDe([[UNO, medida({})]], new Date(AHORA - FOTO_VIEJA_MS - 60_000)), config(UNO), AHORA);
  assert.equal(vieja.foto.vieja, true);
  assert.match(String(vieja.aviso), /no la tomó/);
  const ninguna = armarElTablero({ dia: null, tomadaEl: null, contrato: null, empresas: [], cuentas: [] }, config(UNO), AHORA);
  assert.match(String(ninguna.aviso), /Todavía no hay ninguna foto/);
  // Sin foto, la configuración se ve igual: la empresa está, sin cifras.
  assert.deepEqual([ninguna.empresas.length, ninguna.empresas[0]!.cifras], [1, null]);
});
