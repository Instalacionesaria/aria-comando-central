// LOS CANDIDATOS y la CORRIDA EN SECO, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO SE PRUEBA CONTRA POSTGRESQL Y NO CON UN DOBLE
//
// Porque lo que hay que afirmar es de la CONSULTA, no de la decisión: la decisión ya está cubierta
// entera en `pruebas/codigo/118-portones-del-auditor.test.ts`, sin base y sin costuras.
//
// Lo que solo se puede medir acá son los cuatro defectos de la consulta, y ninguno da error:
//
//   · **El filtro grueso descartando a alguien que sí debía entrar.** Un contacto que no llega a los
//     portones no aparece en ninguna parte: no hay renglón, no hay motivo, no hay nada. Se lee como
//     «no había candidatos».
//   · **La línea base leyendo el análisis EQUIVOCADO** —el más viejo en vez del más nuevo—. La resta
//     da de más y el contacto se re-audita cada corrida.
//   · **El conteo de mensajes llegando como TEXTO.** `count(*)` es un `bigint` y viaja como cadena;
//     sin convertirlo, la resta funciona por coerción en algunos casos y da cualquier cosa en otros.
//   · **La subconsulta del último análisis sin correlacionar por contacto**, que le daría a todos la
//     línea base de un contacto ajeno.
//
// Y la corrida en seco se prueba acá porque su valor entero es que **corre contra datos reales**: una
// corrida en seco sobre un doble no dice nada sobre lo que va a gastar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, unMensaje, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  ETIQUETAS_QUE_ATIENDEN,
  TOPE_DE_CANDIDATOS,
  candidatosDecididos,
  corridaEnSeco,
} from '../../lib/auditor/candidatos.ts';
import { UMBRAL_DEL_DEBOUNCE } from '../../lib/auditor/portones.ts';

let esc: Escenario;

/** El instante de referencia de todas las pruebas. Nada mira el reloj real. */
const AHORA = new Date('2026-08-31T15:00:00.000Z');
const hace = (min: number): Date => new Date(AHORA.getTime() - min * 60_000);

/** Una empresa que pasa el portón 0. */
const EMPRESA = { auditorActivo: true, tieneClaveIa: true, idDelAgente: 'usuarioDelAgente' };

before(async () => {
  esc = await montar('Candidatos');
});
after(async () => {
  await borrarAnalisis();
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

async function borrarAnalisis(): Promise<void> {
  const marca = `${esc.marca.toLowerCase()}-%`;
  await esc.admin.query(
    `delete from negocio.analisis_del_agente where contacto_id in
      (select id from negocio.contactos where ghl_contact_id like $1)`,
    [marca],
  );
}

/** Deja el escenario sin contactos ni análisis, para que cada prueba empiece igual. */
async function limpio(): Promise<void> {
  await borrarAnalisis();
  await limpiar(esc);
}

/** Un contacto que PASA los cuatro portones: etiqueta de agente activo y mensajes de sobra. */
async function unCandidato(campos: {
  territorio?: string | null;
  etiquetas?: string[];
  mensajesDelAgente?: number;
  nombre?: string;
  ultimoEntranteEl?: Date | null;
  ultimoEntranteTexto?: string | null;
  org?: string;
} = {}): Promise<string> {
  const k = await unContacto(esc, {
    org: campos.org,
    territorio: campos.territorio === undefined ? 'closer' : campos.territorio,
    etiquetas: campos.etiquetas ?? ['bot_activado_appflow'],
    nombre: campos.nombre ?? `${esc.marca} candidato`,
    ultimoEntranteEl: campos.ultimoEntranteEl ?? null,
    ultimoEntranteTexto: campos.ultimoEntranteTexto ?? null,
  });
  const cuantos = campos.mensajesDelAgente ?? UMBRAL_DEL_DEBOUNCE + 2;
  for (let i = 0; i < cuantos; i++) {
    await unMensaje(esc, k.id, {
      org: campos.org,
      direccion: 'saliente',
      autor: 'agente',
      enviadoEl: hace(60 - i),
    });
  }
  return k.id;
}

/** Un análisis previo de ese contacto, con su línea base. */
async function unAnalisis(
  contactoId: string,
  mensajesDelAgente: number,
  analizadoEl: Date,
): Promise<void> {
  await conOrganizacion(esc.org, async () => {
    await datos()
      .insertInto('analisis_del_agente')
      .values({
        contacto_id: contactoId,
        agente: 'chat_post_agenda',
        auditable: true,
        intervencion: false,
        nivel: 'verde',
        resumen: 'Un análisis sembrado.',
        disparo: 'debounce',
        mensajes_del_agente: mensajesDelAgente,
        analizado_el: analizadoEl,
      } as never)
      .execute();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL FILTRO GRUESO
// ═══════════════════════════════════════════════════════════════════════════════

test('las etiquetas del filtro salen DEL CONTRATO, no de una lista a mano', () => {
  /* Es la que más importa de todo el archivo, y no toca la base: si esta lista divergiera del
     contrato, los contactos de la etiqueta que falte **dejarían de auditarse en silencio** — el filtro
     de SQL los descarta antes de que ningún portón los vea, así que no hay renglón, no hay motivo, y
     la corrida en seco dice «no había candidatos». */
  assert.deepEqual(
    [...ETIQUETAS_QUE_ATIENDEN].sort(),
    ['bot_activado', 'bot_activado_appflow', 'bot_activado_leadflow'],
  );
});

test('el filtro grueso deja fuera a quien no tiene etiqueta de agente activo', async () => {
  await limpio();
  await unCandidato({ etiquetas: ['bot_activado_appflow'], nombre: `${esc.marca} con` });
  await unCandidato({ etiquetas: ['seguimiento'], nombre: `${esc.marca} sin` });
  await unCandidato({ etiquetas: [], nombre: `${esc.marca} pelado` });

  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos.length, 1);
  assert.equal(decididos[0]?.nombre, `${esc.marca} con`);
});

test('el filtro grueso deja fuera a quien no tiene territorio', async () => {
  await limpio();
  await unCandidato({ territorio: null });
  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos.length, 0);
});

test('la etiqueta LEGADA entra al filtro grueso', async () => {
  await limpio();
  await unCandidato({ etiquetas: ['bot_activado'] });
  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos.length, 1);
  assert.equal(decididos[0]?.decision.audita, true);
});

test('ADR-0206 · los candidatos de una empresa no se ven desde la otra', async () => {
  await limpio();
  await unCandidato({ nombre: `${esc.marca} de alfa` });
  const desdeLaOtra = await conOrganizacion(esc.otraOrg, () => candidatosDecididos(AHORA));
  assert.equal(desdeLaOtra.decididos.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LAS DOS CUENTAS DE LA RESTA
// ═══════════════════════════════════════════════════════════════════════════════

test('los mensajes del agente se cuentan por AUTOR, no por dirección', async () => {
  await limpio();
  /* `direccion = 'saliente'` incluye lo que escribió una PERSONA a mano. Contar por dirección haría
     que el trabajo de un asesor humano empujara el antirrebote del agente: el agente no dijo nada
     nuevo y se auditaría igual, imputándole una conversación que atendió otro. */
  const id = await unCandidato({ mensajesDelAgente: 3 });
  await unMensaje(esc, id, { direccion: 'saliente', autor: 'persona' });
  await unMensaje(esc, id, { direccion: 'saliente', autor: 'persona' });
  await unMensaje(esc, id, { direccion: 'entrante', autor: 'contacto' });

  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos[0]?.candidato.mensajesDelAgente, 3);
});

test('el conteo llega como NÚMERO, y la resta es aritmética', async () => {
  await limpio();
  /* `count(*)` es un `bigint` y `pg` lo entrega como TEXTO. Sin convertirlo, `'7' - 5` da 2 por
     coerción —parece funcionar— pero `'7' - null` da 7 y cualquier suma futura concatenaría. El tipo
     de TypeScript dice `number` y no lo comprueba en tiempo de ejecución: esto sí. */
  const id = await unCandidato({ mensajesDelAgente: 7 });
  await unAnalisis(id, 5, hace(120));

  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const c = decididos[0];
  assert.equal(typeof c?.candidato.mensajesDelAgente, 'number');
  assert.equal(c?.candidato.mensajesDelAgente, 7);
  assert.equal(c?.candidato.mensajesDelAgenteEnElUltimoAnalisis, 5);
  // 7 − 5 = 2, por debajo del umbral: el antirrebote lo frena.
  assert.equal(c?.decision.audita === false && c.decision.porton, 'antirrebote');
});

test('la línea base es la del análisis MÁS NUEVO', async () => {
  await limpio();
  /* Con el más viejo, la resta da de más y el contacto se re-audita en cada corrida: exactamente el
     gasto sin techo que el antirrebote existe para evitar. Y el `order by` es lo único que lo impide,
     así que se siembra al revés —el viejo con el número chico— para que el defecto se vea. */
  const id = await unCandidato({ mensajesDelAgente: 10 });
  await unAnalisis(id, 1, hace(500)); // el viejo: dejaría delta 9 → auditaría
  await unAnalisis(id, 9, hace(10)); // el nuevo: deja delta 1 → no audita

  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos[0]?.candidato.mensajesDelAgenteEnElUltimoAnalisis, 9);
  assert.equal(decididos[0]?.decision.audita, false);
});

test('la línea base es DE ESE contacto, no de cualquiera', async () => {
  await limpio();
  /* Sin correlacionar la subconsulta por contacto, todos heredarían la línea base del primero que
     devuelva el planificador — y el síntoma sería que un contacto recién creado no se audita nunca
     porque «ya tenía» diez mensajes analizados. */
  const conAnalisis = await unCandidato({ mensajesDelAgente: 20, nombre: `${esc.marca} viejo` });
  await unAnalisis(conAnalisis, 20, hace(10));
  const sinAnalisis = await unCandidato({ mensajesDelAgente: 6, nombre: `${esc.marca} nuevo` });

  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const nuevo = decididos.find((d) => d.candidato.contactoId === sinAnalisis);
  assert.equal(nuevo?.candidato.mensajesDelAgenteEnElUltimoAnalisis, null);
  assert.equal(nuevo?.decision.audita, true);
});

test('nunca analizado llega como `null`, no como cero', async () => {
  await limpio();
  /* La resta lo trata como cero, y guardarlo como `null` es lo que permite preguntar un día cuántos
     contactos nunca pasaron por el auditor. Son dos hechos distintos con el mismo efecto aritmético. */
  await unCandidato({ mensajesDelAgente: 6 });
  const { decididos } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos[0]?.candidato.mensajesDelAgenteEnElUltimoAnalisis, null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PORTÓN 3 CONTRA LA BASE
// ═══════════════════════════════════════════════════════════════════════════════

test('un hallazgo ABIERTO frena, y uno resuelto no', async () => {
  await limpio();
  const id = await unCandidato({ mensajesDelAgente: 30 });

  const analisisId = await conOrganizacion(esc.org, async () => {
    const f = await datos()
      .insertInto('analisis_del_agente')
      .values({
        contacto_id: id,
        agente: 'chat_post_agenda',
        auditable: true,
        intervencion: false,
        nivel: 'amarillo',
        resumen: 'Con hallazgo.',
        disparo: 'debounce',
        mensajes_del_agente: 1,
        analizado_el: hace(400),
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });

  const hallazgo = async (resueltoEl: Date | null): Promise<string> =>
    conOrganizacion(esc.org, async () => {
      const f = await datos()
        .insertInto('hallazgos')
        .values({
          contacto_id: id,
          analisis_id: analisisId,
          agente: 'chat_post_agenda',
          titulo: 'Algo que corregir',
          patron: 'algo_que_corregir',
          correccion: 'Agregar la sección de precios.',
          evidencia_agente: 'El precio es lo que quieras.',
          severidad: 'amarillo',
          categoria: 'base_conocimiento',
          resuelto_el: resueltoEl,
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      return f.id;
    });

  const abierto = await hallazgo(null);
  const conAbierto = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(conAbierto.decididos[0]?.candidato.tieneAvisoAbierto, true);
  assert.equal(conAbierto.decididos[0]?.decision.audita === false &&
    conAbierto.decididos[0]?.decision.porton, 'ya_marcado');

  /* ── Y EL AVISO ES DE ESE CONTACTO, NO DE LA EMPRESA ──────────────────────
   *
   * Sin correlacionar el `exists` por contacto, **un solo** aviso abierto en cualquier parte de la
   * empresa frenaría el análisis de TODOS. Y es el defecto más caro de este archivo por el lado
   * contrario al resto: no gasta de más, **deja de auditar en silencio** — la corrida en seco diría
   * «ya marcado» de veinte contactos que no tienen nada, y se leería como que el portón funciona.
   *
   * Con un contacto solo, la consulta correlacionada y la que no dan lo mismo. Hacen falta dos. */
  const otro = await unCandidato({ mensajesDelAgente: 30, nombre: `${esc.marca} sin aviso` });
  const conDos = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const elOtro = conDos.decididos.find((d) => d.candidato.contactoId === otro);
  assert.equal(elOtro?.candidato.tieneAvisoAbierto, false, 'el aviso de otro contacto lo frenó');
  assert.equal(elOtro?.decision.audita, true);

  // Resuelto deja de frenar: «abierto» es la ausencia de una fecha, no una bandera.
  await esc.admin.query('update negocio.hallazgos set resuelto_el = now() where id = $1', [abierto]);
  const conResuelto = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const elMarcado = conResuelto.decididos.find((d) => d.candidato.contactoId === id);
  assert.equal(elMarcado?.candidato.tieneAvisoAbierto, false);
  assert.equal(elMarcado?.decision.audita, true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL TOPE
// ═══════════════════════════════════════════════════════════════════════════════

test('el tope corta, LO DICE, y los que nunca se analizaron van primero', async () => {
  await limpio();
  /* ── POR QUÉ EL TOPE Y POR QUÉ EL ORDEN ────────────────────────────────────
   *
   * La primera corrida de una empresa nueva tiene la línea base en `null` para todos, así que pasan
   * todos los que tengan cinco mensajes del agente: medido en producción, 65 contactos. Sin tope son
   * 65 inferencias de golpe.
   *
   * Y sin orden, el corte no se recupera: la misma empresa auditaría siempre a los mismos veinte. Con
   * `nulls first`, los que nunca pasaron por el auditor van antes que cualquiera que ya tenga un
   * análisis — que es lo que hace que la cola se drene.
   *
   * Se siembran dos más que el tope para que el corte ocurra de verdad. */
  const yaAnalizado = await unCandidato({ mensajesDelAgente: 30, nombre: `${esc.marca} ya visto` });
  await unAnalisis(yaAnalizado, 1, hace(5));
  for (let i = 0; i < TOPE_DE_CANDIDATOS + 1; i++) {
    await unCandidato({ mensajesDelAgente: 6, nombre: `${esc.marca} nuevo ${i}` });
  }

  const { decididos, hayMas } = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  assert.equal(decididos.length, TOPE_DE_CANDIDATOS);
  assert.equal(hayMas, true, 'el tope cortó y no lo dijo');
  // El ya analizado —el más reciente— tiene que haber quedado FUERA del corte.
  assert.ok(!decididos.some((d) => d.candidato.contactoId === yaAnalizado));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA CORRIDA EN SECO
// ═══════════════════════════════════════════════════════════════════════════════

test('la empresa frenada NO consulta candidatos, y solo reporta el freno', async () => {
  await limpio();
  await unCandidato({ mensajesDelAgente: 30 });

  for (const [empresa, esperado] of [
    [{ ...EMPRESA, auditorActivo: false }, 'auditor_apagado'],
    [{ ...EMPRESA, tieneClaveIa: false }, 'sin_clave_ia'],
    [{ ...EMPRESA, idDelAgente: null }, 'sin_id_del_agente'],
  ] as const) {
    const r = await conOrganizacion(esc.org, () => corridaEnSeco(empresa, AHORA));
    assert.equal(r.frenoDeLaEmpresa, esperado);
    /* Y CERO renglones, aunque haya un candidato perfecto sembrado. Consultar y después descartar
       produciría un reporte con renglones y un freno arriba, y quien lo lea va a discutir los
       renglones. Cuando la empresa no se audita, el único hecho es el freno. */
    assert.equal(r.renglones.length, 0);
    assert.equal(r.candidatos, 0);
    assert.equal(r.seAuditarian, 0);
  }
});

test('la corrida en seco dice a quién auditaría, por qué, y con qué agente', async () => {
  await limpio();
  await unCandidato({ mensajesDelAgente: 8, nombre: `${esc.marca} se audita` });

  const r = await conOrganizacion(esc.org, () => corridaEnSeco(EMPRESA, AHORA));
  assert.equal(r.frenoDeLaEmpresa, null);
  assert.equal(r.candidatos, 1);
  assert.equal(r.seAuditarian, 1);
  assert.equal(r.renglones[0]?.agente, 'chat_post_agenda');
  assert.equal(r.renglones[0]?.disparo, 'debounce');
  assert.match(String(r.renglones[0]?.porque), /8 mensajes nuevos del agente/);
});

test('cada renglón frenado dice UNA FRASE, nunca solo el código del portón', async () => {
  await limpio();
  /* Una corrida en seco que nadie entiende no se lee, y una que no se lee no verifica nada — que es lo
     único que esta herramienta tiene que lograr. */
  await unCandidato({ mensajesDelAgente: 1, nombre: `${esc.marca} frenado` });

  const r = await conOrganizacion(esc.org, () => corridaEnSeco(EMPRESA, AHORA));
  assert.equal(r.seAuditarian, 0);
  const renglon = r.renglones[0];
  assert.equal(renglon?.agente, null);
  assert.match(String(renglon?.porque), /suficientes mensajes nuevos/);
  // Y el detalle del delta va entre paréntesis: es lo que permite ver si falta uno o faltan cuatro.
  assert.match(String(renglon?.porque), /\(delta 1\)/);
});

test('el conteo POR PORTÓN es lo que delata un portón apagado', async () => {
  await limpio();
  /* Un portón que frena cero contactos puede ser correcto —nadie está en ese estado— o puede estar
     apagado por un error, y las dos cosas se ven idénticas mirando solo el resultado. Con el conteo al
     lado, la diferencia se nota. */
  await unCandidato({ mensajesDelAgente: 1, nombre: `${esc.marca} antirrebote` });
  await unCandidato({
    territorio: 'setter',
    etiquetas: ['bot_activado_appflow'],
    mensajesDelAgente: 30,
    nombre: `${esc.marca} cruzado`,
  });

  const r = await conOrganizacion(esc.org, () => corridaEnSeco(EMPRESA, AHORA));
  assert.equal(r.porPorton['antirrebote'], 1);
  assert.equal(r.porPorton['agente_no_atiende'], 1);
  assert.equal(r.seAuditarian, 0);
});

test('el nivel 0 aparece en la corrida en seco con su señal nombrada', async () => {
  await limpio();
  /* El caso que el nivel 0 existe para atrapar: pocos mensajes, y el contacto pidiendo una persona. Y
     la corrida en seco tiene que **nombrar la señal**, porque de eso depende poder decidir después si
     esa señal vale lo que gasta. */
  await unCandidato({
    mensajesDelAgente: 2,
    nombre: `${esc.marca} alarma`,
    ultimoEntranteEl: hace(2),
    ultimoEntranteTexto: 'quiero hablar con una persona',
  });

  const r = await conOrganizacion(esc.org, () => corridaEnSeco(EMPRESA, AHORA));
  assert.equal(r.seAuditarian, 1);
  assert.equal(r.renglones[0]?.disparo, 'alarma');
  assert.deepEqual(r.renglones[0]?.alarmas, ['pidio_una_persona']);
  /* Y la FRASE tiene que nombrarla, no solo el campo estructurado: quien lee una corrida en seco lee
     `porque`, y un «una señal» sin decir cuál no permite decidir si esa señal vale lo que gasta — que
     es la única pregunta para la que existe la columna `alarmas`. */
  assert.match(String(r.renglones[0]?.porque), /pidio_una_persona/);
});

test('sin candidatos la corrida en seco lo dice, y no se confunde con un freno', async () => {
  await limpio();
  /* «La empresa no se audita» y «la empresa se audita y no hay a quién» son dos hechos distintos, y
     colapsarlos mandaría a revisar la configuración de una cuenta que está bien. */
  const r = await conOrganizacion(esc.org, () => corridaEnSeco(EMPRESA, AHORA));
  assert.equal(r.frenoDeLaEmpresa, null);
  assert.equal(r.candidatos, 0);
  assert.equal(r.seAuditarian, 0);
  assert.deepEqual(r.porPorton, {});
});
