// LAS RUTAS MANUALES SON POR CLIENTE: A QUIÉN TRAEN, QUÉ CONTESTAN Y QUÉ MIDE EL GUION. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, G4)
//
// «Traer del calendario», el tic de la ingesta y «Traer de GoHighLevel» traen a cada cliente activo que su pantalla
// lee, cada uno con su token y en su ámbito (la 282 lo mide por las rutas, con la base). Acá, lo que no necesita base:
//
//   · a quién traen: los ACTIVOS que la pantalla lee, con el foco sólo en las pantallas del cliente, y el foco en uno en
//     pausa no lanza — mutaciones: el foco sin `ambitoDe`; sacar el filtro de estado;
//   · qué contestan: con UN cliente, lo de siempre (sin `clientes`, sin nombre delante); con varios, las cifras sumadas
//     campo por campo y el informe por cliente — mutaciones: el nombre o `clientes` con uno; el fallo antes que lo que
//     corrió; `congelados` del primero;
//   · el bucle abre cada cliente con su ámbito y nunca la empresa — mutación: leer el pulso con `conOrganizacion(orgId`;
//   · los presupuestos caben en la ruta, con los 120 s del último — mutación: subir el de la traída a 240 s;
//   · el calendario y la ingesta pasan su pulso, y sólo la sincronización relanza con uno — mutaciones: una ruta sin su
//     `pulso`; la sincronización sin `relanzarSiEsElUnico`, u otra con él;
//   · el front nombra a los clientes que quedaron sin traer, y al que no tiene credenciales aparte, sin pintarlo como
//     fallo — mutaciones: borrar cualquiera de las lecturas; el filtro de antes en la Agenda; no nombrar al saltado;
//   · medir-mensaje mide a cada cliente con lo suyo, sin cortar su bucle de conversaciones — mutaciones: la versión de
//     antes; un `continue` de adentro vuelto `return`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { clientesQueTrae } from '../../lib/autorizacion/ambito.ts';
import { SIN_SECCION } from '../../lib/autorizacion/secciones.ts';
import type { Contexto, CuentaDeLaSesion } from '../../lib/autorizacion/sesion.ts';
import { CADENCIA } from '../../lib/cadencia.ts';
import {
  desenlaceDeLaTraida,
  juntarResumenes,
  NINGUN_CLIENTE_ACTIVO,
  PRESUPUESTO_DE_LA_TRAIDA_MS,
  PRESUPUESTO_DEL_TIC_MS,
  sumarBarridos,
  sumarIngestas,
  type TraidaDeUnCliente,
} from '../../lib/negocio/traerDeLosClientes.ts';
import type { Resumen } from '../../lib/negocio/sincronizar.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

const cuenta = (id: string, estado: 'activa' | 'pausada', esPorOmision = false): CuentaDeLaSesion => ({
  id,
  nombre: `Cliente ${id}`,
  zonaHoraria: 'America/Lima',
  esPorOmision,
  estado,
  esPrueba: false,
});
const P = cuenta('P', 'activa', true);
const Y = cuenta('Y', 'activa');
const Z = cuenta('Z', 'pausada');

/** Una sesión de mentira: `clientesQueTrae` sólo mira la organización y las cuentas. */
function sesion(cuentas: { limitado?: boolean; visibles?: CuentaDeLaSesion[]; activa?: string | null }): Contexto {
  return {
    orgEfectiva: 'org-283',
    cuentas: { limitado: cuentas.limitado ?? false, visibles: cuentas.visibles ?? [P, Y, Z], activa: cuentas.activa ?? null },
  } as unknown as Contexto;
}
const ids = (c: Contexto, pantalla: string) => clientesQueTrae(c, pantalla).map((x) => x.id);

test('a quién traen: los activos que la pantalla lee, el principal primero, y el foco sólo en las del cliente', () => {
  const conFocoEnY = sesion({ activa: 'Y' });
  // El Closer y las rutas sin pantalla leen la empresa entera aunque haya foco; Z, en pausa, no se trae.
  assert.deepEqual(ids(conFocoEnY, 'closer'), ['P', 'Y'], 'el foco o un cliente en pausa cambió a quién trae el Closer');
  assert.deepEqual(ids(conFocoEnY, SIN_SECCION), ['P', 'Y']);
  // Una pantalla del cliente, con foco: sólo el enfocado. Sin foco: todos los activos.
  assert.deepEqual(ids(conFocoEnY, 'contacts'), ['Y']);
  assert.deepEqual(ids(conFocoEnY, 'sales'), ['Y']);
  assert.deepEqual(ids(sesion({}), 'contacts'), ['P', 'Y']);
  // Lo que se devuelve es lo que la ruta necesita para resolver la credencial y para nombrar.
  assert.deepEqual(clientesQueTrae(conFocoEnY, 'closer')[1], { id: 'Y', nombre: 'Cliente Y', esPorOmision: false });
  // El cliente final: sólo sus cuentas, y sólo en sus pantallas.
  assert.deepEqual(ids(sesion({ limitado: true, visibles: [Y] }), 'contacts'), ['Y']);
  assert.throws(() => clientesQueTrae(sesion({ limitado: true, visibles: [Y] }), 'closer'), /cliente final/);
  // El foco en uno en pausa no lanza: no hay nada que traer, y lo responde la ruta.
  assert.deepEqual(ids(sesion({ activa: 'Z' }), 'contacts'), [], 'el foco en un cliente en pausa trajo algo, o lanzó');
  // Sin el principal activo a la vista, con la empresa entera, es un invariante roto (la 085).
  assert.throws(() => clientesQueTrae(sesion({ visibles: [Y] }), 'closer'), /principal/);
});

const quien = (cuentaId: string, estado: TraidaDeUnCliente<number>['estado'], extra: Partial<TraidaDeUnCliente<number>> = {}) =>
  ({ cuentaId, nombre: cuentaId, esPorOmision: cuentaId === 'P', estado, ...extra }) as TraidaDeUnCliente<number>;
const forma = {
  deUno: (r: number, llamadas: number) => ({ corrio: true, r, llamadas }),
  deVarios: (rs: readonly { resultado: number; llamadas: number }[]) => ({ corrio: true, r: rs.reduce((n, x) => n + x.resultado, 0) }),
};

test('qué contestan: con un cliente, lo de siempre; con varios, la suma y el informe con el nombre delante', () => {
  // Con UNO: el cuerpo de siempre, sin `clientes` y sin nombre.
  assert.deepEqual(desenlaceDeLaTraida([quien('P', 'corrio', { resultado: 7, llamadas: 2 })], forma), {
    tipo: 'ok',
    cuerpo: { corrio: true, r: 7, llamadas: 2 },
  });
  assert.deepEqual(desenlaceDeLaTraida([quien('P', 'frenada', { porque: 'reciente' })], forma), {
    tipo: 'ok',
    cuerpo: { corrio: false, porque: 'reciente' },
  });
  assert.deepEqual(desenlaceDeLaTraida([quien('P', 'saltada', { codigo: 'credenciales_incompletas', porque: 'sin token' })], forma), {
    tipo: 'rechazo',
    codigo: 'credenciales_incompletas',
    detalle: 'sin token',
  });
  assert.deepEqual(desenlaceDeLaTraida([quien('P', 'fallo', { codigo: 'servicio_externo_saturado', porque: 'espera' })], forma), {
    tipo: 'rechazo',
    codigo: 'servicio_externo_saturado',
    detalle: 'espera',
  });

  // Con VARIOS: lo que corrió manda, sumado, y `clientes` dice qué pasó con cada uno.
  const corrioYSaltada = [quien('P', 'corrio', { resultado: 7, llamadas: 2 }), quien('Y', 'saltada', { codigo: 'credenciales_incompletas', porque: 'sin token' })];
  assert.deepEqual(desenlaceDeLaTraida(corrioYSaltada, forma), { tipo: 'ok', cuerpo: { corrio: true, r: 7, clientes: corrioYSaltada } });
  // Uno que falla no tapa lo que otro trajo: 200, y el fallo queda en `clientes`.
  const falloYCorrio = [quien('P', 'fallo', { codigo: 'servicio_externo_saturado', porque: 'espera' }), quien('Y', 'corrio', { resultado: 3, llamadas: 1 })];
  assert.deepEqual(desenlaceDeLaTraida(falloYCorrio, forma), { tipo: 'ok', cuerpo: { corrio: true, r: 3, clientes: falloYCorrio } }, 'un fallo tapó lo que otro cliente trajo');
  // Ninguno corrió: el fallo gana sobre el frenado, con el nombre de su cliente.
  assert.deepEqual(
    desenlaceDeLaTraida([quien('P', 'frenada', { porque: 'reciente' }), quien('Y', 'fallo', { codigo: 'servicio_externo_no_disponible', porque: 'cayó' })], forma),
    { tipo: 'rechazo', codigo: 'servicio_externo_no_disponible', detalle: 'Y: cayó' },
  );
  // Sólo frenados: 200, con el nombre del primero.
  const frenadas = [quien('P', 'frenada', { porque: 'reciente' }), quien('Y', 'frenada', { porque: 'ocupado' })];
  assert.deepEqual(desenlaceDeLaTraida(frenadas, forma), { tipo: 'ok', cuerpo: { corrio: false, porque: 'P: reciente', clientes: frenadas } });
  // Sólo saltadas: 409 con el nombre del primero.
  assert.deepEqual(
    desenlaceDeLaTraida([quien('P', 'saltada', { codigo: 'credenciales_incompletas', porque: 'a' }), quien('Y', 'saltada', { codigo: 'credenciales_incompletas', porque: 'b' })], forma),
    { tipo: 'rechazo', codigo: 'credenciales_incompletas', detalle: 'P: a' },
  );
  // Ninguno: el foco en un cliente en pausa.
  assert.deepEqual(desenlaceDeLaTraida([], forma), { tipo: 'ok', cuerpo: { corrio: false, porque: NINGUN_CLIENTE_ACTIVO } });
});

test('las cifras de varios clientes se juntan campo por campo', () => {
  const barrido = (n: number, atrasado: boolean) => ({
    calendarios: n, vistas: n * 2, nuestras: n * 3, guardadas: n * 4, borradas: n * 5, dadasDeBaja: n * 9, sinHora: n * 6, canceladas: n * 7, llamadas: n * 8, atrasado,
  });
  assert.deepEqual(sumarBarridos([barrido(1, false), barrido(10, true)]), { ...barrido(11, true) });
  assert.equal(sumarBarridos([barrido(1, false), barrido(10, false)]).atrasado, false);
  const ingesta = (n: number, atrasado: boolean) => ({
    miradas: n, nuestras: n * 2, mensajesNuevos: n * 3, sinFecha: n * 4, atrasado, entregasRevisadas: n * 5, entregasResueltas: n * 6,
  });
  assert.deepEqual(sumarIngestas([ingesta(1, true), ingesta(10, false)]), ingesta(11, true));
  assert.equal(sumarIngestas([ingesta(1, false), ingesta(10, false)]).atrasado, false);

  const resumen = (r: Partial<Resumen>): Resumen => ({
    traidos: {}, guardados: { closer: 0, setter: 0 }, salteados: [], truncado: false, congelados: null, llamadas: 0,
    etiquetasDeLaCuenta: null, catalogoDeCampos: null, ...r,
  });
  const juntos = juntarResumenes([
    resumen({ traidos: { zona_closer: 2 }, guardados: { closer: 2, setter: 1 }, salteados: [{ id: 'a', porque: 'x' }], congelados: null, llamadas: 3, etiquetasDeLaCuenta: ['e'] }),
    resumen({ traidos: { zona_closer: 1, zona_setter: 4 }, guardados: { closer: 1, setter: 4 }, salteados: [{ id: 'b', porque: 'y' }], truncado: true, congelados: 3, llamadas: 5 }),
  ]);
  assert.deepEqual(juntos, {
    traidos: { zona_closer: 3, zona_setter: 4 },
    guardados: { closer: 3, setter: 5 },
    salteados: [{ id: 'a', porque: 'x' }, { id: 'b', porque: 'y' }],
    truncado: true,
    // `null` es «no se pudo conciliar», no un cero: se suma lo que sí concilió.
    congelados: 3,
    llamadas: 8,
  });
  assert.equal(juntarResumenes([resumen({ congelados: null }), resumen({ congelados: null })]).congelados, null);
  assert.equal(juntarResumenes([resumen({ congelados: 2 }), resumen({ congelados: 0 })]).congelados, 2);
});

test('el bucle abre cada cliente con su ámbito, y nunca la empresa', () => {
  const bucle = leer('lib/negocio/traerDeLosClientes.ts');
  assert.match(bucle, /traer\(ambitoDeUnCliente\(orgId, c\.id\)/, 'la traída de un cliente no recibe su ámbito');
  assert.match(bucle, /leerPulso\(ambitoDeUnCliente\(orgId, c\.id\)/, 'el turno no lee el pulso de cada cliente');
  assert.doesNotMatch(bucle, /conOrganizacion\(|conIdentidad\(/, 'el bucle abre un contexto propio');
  // El turno no mira `atrasado`: un cliente lento atrasado ganaría siempre (la 282 lo mide de punta a punta).
  const turno = bucle.slice(bucle.indexOf('async function porTurno('), bucle.indexOf('\n}\n', bucle.indexOf('async function porTurno(')));
  assert.ok(turno.length > 100, 'no encontré el turno');
  assert.doesNotMatch(turno, /atrasado/, 'el turno le da prioridad a un cliente atrasado');
});

test('los presupuestos caben en la ruta', () => {
  for (const ruta of ['app/api/closer/agenda/refrescar/route.ts', 'app/api/contactos/sincronizar/route.ts']) {
    const fuente = leer(ruta);
    const segundos = Number(/maxDuration\s*=\s*(\d+)/.exec(fuente)?.[1]);
    assert.ok(segundos > 0, `${ruta} dejó de declarar \`maxDuration\``);
    // Los 120 s que el encabezado de `PRESUPUESTO_DE_LA_TRAIDA_MS` le promete al último cliente que empieza.
    assert.ok(PRESUPUESTO_DE_LA_TRAIDA_MS + 120_000 <= segundos * 1000, `${ruta}: el último cliente que empieza no cabe en la función`);
    assert.match(fuente, /presupuestoMs: PRESUPUESTO_DE_LA_TRAIDA_MS/);
  }
  assert.equal(PRESUPUESTO_DEL_TIC_MS, CADENCIA.operacion);
  assert.match(leer('app/api/mensajes/ingesta/route.ts'), /presupuestoMs: PRESUPUESTO_DEL_TIC_MS/, 'la ingesta del tic no se acota a su cadencia');
});

test('cada ruta dice qué pulso decide el turno, y sólo la sincronización relanza con un cliente', () => {
  const refrescar = leer('app/api/closer/agenda/refrescar/route.ts');
  const ingesta = leer('app/api/mensajes/ingesta/route.ts');
  const sincronizar = leer('app/api/contactos/sincronizar/route.ts');
  // El tic y el botón del calendario rotan por el sello (la 282 lo mide por las rutas): sin su pulso, el principal iría
  // primero siempre. La sincronización no tiene pulso: el orden de la sesión, el principal primero.
  assert.match(ingesta, /pulso: 'mensajes'/, 'la ingesta no le pasa su pulso al bucle');
  assert.match(refrescar, /pulso: 'citas'/, 'el calendario no le pasa su pulso al bucle');
  assert.doesNotMatch(sincronizar, /pulso:/, 'la sincronización no tiene pulso propio');
  // Con UN cliente, una excepción es lo de siempre: el 500 en la sincronización, su 503 en las otras dos.
  assert.match(sincronizar, /relanzarSiEsElUnico: true/, 'con un cliente, la sincronización dejó de dar el 500 de siempre');
  for (const [ruta, fuente] of [['refrescar', refrescar], ['ingesta', ingesta]] as const) {
    assert.doesNotMatch(fuente, /relanzarSiEsElUnico/, `con un cliente, ${ruta} dejó de dar su 503 de siempre`);
  }
});

test('el front nombra a los clientes que quedaron sin traer', () => {
  const agenda = leer('components/closer/Agenda.jsx');
  const inicio = agenda.indexOf('const traer = useCallback(');
  const traer = agenda.slice(inicio, agenda.indexOf('}, [refrescar]);', inicio));
  assert.ok(traer.length > 500, 'no encontré `traer` en la Agenda');
  assert.match(traer, /r\.datos\.clientes/, 'la Agenda no lee el informe por cliente');
  // Los dos avisos de lo que llegó —frenado y corrido— dicen quién quedó sin leer.
  const avisos = [...traer.matchAll(/setAviso\(\{\s*mal: sinLeer\.length > 0,[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.equal(avisos.length, 2, 'un aviso de la traída no mira a los clientes sin leer');
  for (const aviso of avisos) assert.match(aviso, /yLosQueFaltan/, 'un aviso de la traída no nombra a los clientes sin leer');

  const lista = leer('components/negocio/ListaDeContactos.jsx');
  assert.match(lista, /d\.clientes/, 'la lista no lee el informe por cliente');
  // El que falló o no alcanzó deja la lista corta; al que le falta una credencial no lo arregla reintentar.
  assert.match(lista, /const corta = Boolean\(d\.salteados\?\.length \|\| d\.truncado \|\| faltan\.length\)/);
  assert.match(lista, /const faltan = clientes\.filter\(\(c\) => c\.estado === 'fallo' \|\| c\.estado === 'sin_tiempo'\)/);
  assert.equal((lista.match(/\$\{yQuienFalta\}/g) ?? []).length, 3, 'un texto de la traída no nombra a los clientes sin traer');
  // En la Agenda, lo mismo: el aviso de fallo es por el que falló o no alcanzó, no por el que no tiene credenciales.
  assert.match(
    traer,
    /const sinLeer = clientes\.filter\(\(c\) => c\.estado === 'fallo' \|\| c\.estado === 'sin_tiempo'\)/,
    'la Agenda pinta como fallo a un cliente sin credenciales',
  );

  // Al que le falta una credencial (`saltada`) se lo nombra aparte, con su `porque`: dónde se configura la suya.
  for (const [pantalla, fuente, frase] of [['la Agenda', traer, 'yLosQueFaltan'], ['la lista', lista, 'yQuienFalta']] as const) {
    assert.match(fuente, /const sinConexion = clientes\.filter\(\(c\) => c\.estado === 'saltada'\)/, `${pantalla} no separa a los clientes sin credenciales`);
    const desde = fuente.slice(fuente.indexOf(`const ${frase} =`));
    const declaracion = desde.slice(0, desde.search(/;\r?\n/));
    assert.ok(declaracion.length > 50, `no encontré \`${frase}\` en ${pantalla}`);
    assert.match(declaracion, /sinConexion\.map\(\(c\) => ` \$\{c\.nombre\}: \$\{c\.porque\}`\)/, `${pantalla} no nombra al cliente sin credenciales`);
  }
});

test('medir-mensaje mide a cada cliente con su token, su agente y su ámbito, sin cortar su bucle', () => {
  const guion = leer('scripts/medir-mensaje.mjs');
  for (const debe of [
    'clientesParaBarrer(db, org.id)',
    'resolverAccesoAGhl(db, org.id, cuenta)',
    'agenteDelCrmDe(db, org.id, cuenta)',
    'conOrganizacion(ambitoDeUnCliente(org.id, cuenta.id)',
  ]) {
    assert.ok(guion.includes(debe), `medir-mensaje no tiene ${debe}`);
  }
  for (const no of ["'la_de_la_empresa'", 'conOrganizacion(org.id', 'organizaciones_credenciales']) {
    assert.ok(!guion.includes(no), `medir-mensaje volvió a ${no}`);
  }
  // Los cortes de UN cliente son `return`; los cuatro `continue` de adentro saltean una conversación, un campo vacío de
  // un registro de llamada o un mensaje que no es nuestro, y si cortaran al cliente el veredicto saldría recortado.
  const i = guion.indexOf('async function medirUnCliente(');
  const cuerpo = guion.slice(i, guion.indexOf('\n}\n', i));
  assert.ok(cuerpo.length > 2000, 'no encontré `medirUnCliente`');
  assert.equal((cuerpo.match(/\bcontinue;/g) ?? []).length, 4, 'se tocó el bucle de conversaciones');
  assert.match(cuerpo, /if \(!fila\) continue;/);
  // Sin token, sin agente, sin salientes y sin filas del agente: cada uno corta a este cliente y no a la empresa.
  assert.equal((cuerpo.match(/\breturn;/g) ?? []).length, 4, 'un corte de un cliente no es `return`');
});
