// La evaluación real de los agentes de IA: pedidos de verdad a Anthropic, con la llave de la organización
// principal, sobre la base LOCAL.
//
//   node --env-file-if-exists=.env.local scripts/evaluar-agentes.mjs <tanda>
//   node --env-file-if-exists=.env.local scripts/evaluar-agentes.mjs <tanda> --confirmo <N>
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ PIDE UN NÚMERO
//
// `docs/OTROS/agentes/07-LA-EVALUACION.md`, AG-104, y `D-31`: cada tanda gasta la llave de ARIA, y se hace
// con el OK del usuario en el chat, con el número de pedidos. Sin `--confirmo`, el guion sólo dice cuántos
// pedidos va a hacer y sale. Con `--confirmo` y otro número, se niega: el número que se aprobó tiene que
// ser el que se va a gastar, no uno cualquiera que destrabe la corrida.
//
// ── LO QUE NUNCA HACE ────────────────────────────────────────────────────────
//
//   · Usar la llave de un cliente: lee la de la organización principal, que el usuario carga a mano en
//     Ajustes local. Nunca va a un `.env` y no la escribe nadie más.
//   · Hablar con una base que no sea local: la llave se lee descifrada.
//   · Un `fetch(`: sale por `pedirExterno`, como toda la aplicación (ADR-0305).
//   · Imprimir la llave ni lo que diga el modelo más allá de lo que la tanda mide.
//
// ── LAS TANDAS ───────────────────────────────────────────────────────────────
//
// `modelo` (AG4): la comprobación de `06`, AG-92, antes de la primera llamada real. Dos pedidos que no
// generan: `GET /v1/models/claude-sonnet-5-5` (la llave alcanza el modelo) y `POST /v1/messages/count_tokens`
// con la herramienta forzada (esta cuenta la rechaza con ese modelo, como dice la referencia de la API).
//
// `cerebro` (AG7): las preguntas de `07`, AG-102, que llaman al modelo, sobre la base sembrada
// (`db/sembrado/casos-de-los-agentes.ts`), que siembra al empezar y quita al terminar. Pide confirmar el
// TECHO de pedidos —seis rondas por pregunta—, e imprime lo gastado de verdad, leído de `uso_de_ia`.
//
// La redacción del plan (AG9), el Brief (AG12) y la Reunión (AG15) suman las suyas.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { exigirAnfitrionLocal } from '../lib/datos/anfitrion.ts';
import { resolverLlaveDeIa } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';
import { DIRECCION_DE_LA_API, VERSION_DE_LA_API } from '../lib/agentes/proveedor.ts';
import { MODELO_DEL_EXECUTIVE } from '../lib/agentes/modelos.ts';
import { RONDAS } from '../lib/agentes/executive/preguntar.ts';

/**
 * Las preguntas de `07`, AG-102, que llaman al modelo: de la 1 a la 16. La 17 (sin llave), la 18 (bajo
 * delegación), la 19 (el tope) y la 20 (la cifra inventada, con el modelo falso) no llegan al modelo y ya
 * las miran las pruebas 206, 209 y 208. La 15 pregunta desde la caja del Setter y no desde el Inicio: la
 * persona sin Conversation de la base sembrada es el setter, que no ve el Inicio; lo que se mira es igual,
 * que no reciba las herramientas de Conversation.
 */
const PREGUNTAS_DEL_CEREBRO = [
  { n: 1, quien: 'admin', seccion: null, pregunta: '¿Cómo va la semana?' },
  { n: 2, quien: 'admin', seccion: null, pregunta: '¿Cuántas ventas hicimos este mes?' },
  { n: 3, quien: 'admin', seccion: null, pregunta: '¿Cuál es nuestra tasa de cierre?' },
  { n: 4, quien: 'admin', seccion: null, pregunta: '¿Qué campaña escalo?' },
  { n: 5, quien: 'admin', seccion: null, pregunta: '¿Qué objeción aparece más en las llamadas?' },
  { n: 6, quien: 'admin', seccion: null, pregunta: '¿Qué dicen los agentes del CRM?' },
  { n: 7, quien: 'admin', seccion: null, pregunta: '¿Por qué bajaron los contactos?' },
  { n: 8, quien: 'admin', seccion: null, pregunta: '¿Cuánto gastamos en Meta y cuánto nos costó cada venta?' },
  { n: 9, quien: 'admin', seccion: null, pregunta: '¿Y la semana anterior?', enElHiloDe: 1 },
  { n: 10, quien: 'admin', seccion: null, pregunta: 'Escríbeme un guion para Instagram' },
  { n: 11, quien: 'admin', seccion: null, pregunta: '¿Qué pasa en el mercado de clínicas en Lima?' },
  { n: 12, quien: 'closerUno', seccion: 'closer', pregunta: '¿Cuánto gastamos en Meta?' },
  { n: 13, quien: 'closerUno', seccion: 'closer', pregunta: '¿Qué citas tengo hoy?' },
  { n: 14, quien: 'closerUno', seccion: 'closer', pregunta: '¿Cuánto llevo de comisión?' },
  { n: 15, quien: 'setter', seccion: 'setter', pregunta: '¿Qué dicen los agentes del CRM?' },
  { n: 16, quien: 'admin', seccion: 'acquisition', periodo: '7d', pregunta: '¿Hay fatiga en algún anuncio?' },
];

/**
 * El techo de pedidos de la tanda del cerebro: cada pregunta puede usar hasta `RONDAS` llamadas. Lo que se
 * aprueba es el techo, porque cuántas rondas usa cada una lo decide el modelo; lo gastado de verdad se lee
 * después de `uso_de_ia` y se imprime.
 */
const TECHO_DEL_CEREBRO = PREGUNTAS_DEL_CEREBRO.length * RONDAS;

/**
 * Las preguntas del cerebro, por el mismo camino que la ruta y no por la ruta: la ruta lee la llave de la
 * empresa que pregunta, y la empresa sembrada no tiene ni debe tener una (copiar la de ARIA a otra empresa
 * sería copiar el valor de una llave). Así que cada pregunta pasa por el portero de verdad (`exigir`, con
 * la sesión de la persona sembrada y la pantalla desde la que pregunta), por `identidadDelCerebro` y por
 * `laPregunta`, como en `lib/agentes/executive/caja.ts`, y sólo la llave se cambia por la de ARIA, en memoria.
 */
async function correrElCerebro(llave) {
  const { randomBytes, createHash } = await import('node:crypto');
  const { sql } = await import('kysely');
  const { exigir } = await import('../lib/autorizacion/portero.ts');
  const { COOKIE_SESION } = await import('../lib/autorizacion/cookie.ts');
  const { conOrganizacion, datos } = await import('../lib/datos/contexto.ts');
  const { identidadDelCerebro, laPregunta } = await import('../lib/agentes/executive/caja.ts');
  const { preguntar } = await import('../lib/agentes/executive/preguntar.ts');
  const { RUTA_DE_LA_CAJA, RUTA_DEL_INICIO } = await import('../lib/agentes/pantalla.ts');
  const { PREFIJO_DE_LA_EVALUACION, quitarEmpresasDeLosAgentes, sembrarCasosDeLosAgentes } = await import('../db/sembrado/casos-de-los-agentes.ts');

  const DOMINIO = 'evaluacion.localhost';
  process.env.DOMINIO_ESPERADO = DOMINIO;
  const e = await sembrarCasosDeLosAgentes(PREFIJO_DE_LA_EVALUACION);
  console.log(`  Sembrada la empresa con datos (${PREFIJO_DE_LA_EVALUACION}…).`);

  const tokens = {};
  for (const quien of ['admin', 'closerUno', 'setter']) {
    const token = randomBytes(32).toString('base64url');
    await conIdentidad((db) =>
      db
        .insertInto('sesiones')
        .values({
          usuario_id: e.personas[quien],
          token_hash: createHash('sha256').update(token, 'utf8').digest('hex'),
          estado: 'activa',
          org_activa: e.conDatos,
          expira_el: sql`now() + interval '1 day'`,
          expira_absoluto: sql`now() + interval '1 day'`,
        })
        .execute(),
    );
    tokens[quien] = token;
  }

  const usadas = () =>
    conOrganizacion(e.conDatos, async () =>
      datos()
        .selectFrom('uso_de_ia')
        .where('agente', '=', 'executive')
        .select([
          sql`count(*)`.as('llamadas'),
          sql`coalesce(sum(tokens_entrada), 0)`.as('entrada'),
          sql`coalesce(sum(tokens_salida), 0)`.as('salida'),
          sql`coalesce(sum(tokens_lectura_cache), 0)`.as('cache'),
        ])
        .executeTakeFirstOrThrow(),
    );

  const hilos = {};
  try {
    for (const p of PREGUNTAS_DEL_CEREBRO) {
      const camino = p.seccion === null ? RUTA_DEL_INICIO : RUTA_DE_LA_CAJA[p.seccion];
      const peticion = new Request(`https://${DOMINIO}${camino}`, {
        method: 'POST',
        headers: { origin: `https://${DOMINIO}`, cookie: `${COOKIE_SESION}=${tokens[p.quien]}` },
      });
      const antes = await usadas();
      console.log(`\n── ${p.n} · ${p.quien}, ${p.seccion === null ? 'Inicio' : `caja de ${p.seccion}`}${p.periodo ? ` (${p.periodo})` : ''}: «${p.pregunta}»`);
      const contexto = await exigir(peticion, ['cerebro.usar'], p.seccion ?? 'executive');
      if (contexto instanceof Response) {
        console.log(`  el portero la rechaza: ${contexto.status} ${await contexto.text()}`);
        continue;
      }
      const identidad = await conIdentidad((db) => identidadDelCerebro(db, contexto, true));
      const conLaLlave = { ...identidad, llave: { tipo: 'listo', claveIa: llave } };
      const pregunta = laPregunta(contexto, conLaLlave, { texto: p.pregunta, hiloId: p.enElHiloDe ? (hilos[p.enElHiloDe] ?? null) : null, periodo: p.periodo ?? null }, p.seccion);
      if (pregunta instanceof Response) {
        console.log(`  rechazada antes del modelo: ${pregunta.status} ${await pregunta.text()}`);
        continue;
      }
      const r = await preguntar(pregunta);
      const despues = await usadas();
      console.log(`  ${r.tipo} · ${Number(despues.llamadas) - Number(antes.llamadas)} llamada(s)`);
      if (r.tipo === 'respondida') {
        hilos[p.n] = r.hiloId;
        const x = r.respuesta;
        console.log(`  herramientas: ${r.evidencia.map((ev) => `${ev.herramienta}${ev.argumentos?.periodo ? `(${ev.argumentos.periodo})` : ''}`).join(', ') || 'ninguna'}`);
        console.log(`  conclusión: ${x.conclusion}`);
        console.log(`  confianza: ${x.confianza.nivel} · ${x.confianza.porque}`);
        for (const c of x.cifras) console.log(`  cifra: ${c.valor} ${c.que_es} · ${c.muestra} · ${c.periodo} · ${c.fuente} · ${c.ev} ${c.campo}`);
        for (const c of x.recomendaciones) console.log(`  recomendación${c.requiere_validacion_ejecutiva ? ' (requiere validación ejecutiva)' : ''}: ${c.texto}`);
        for (const c of x.no_hay_dato) console.log(`  no hay dato: ${c.falta} · se carga en ${c.donde_se_carga}`);
        for (const c of x.siguientes) console.log(`  siguiente: abrir ${c.seccion}${c.pestana ? ` › ${c.pestana}` : ''}`);
        for (const a of x.avisos) console.log(`  aviso: ${a}`);
        console.log(`  mascota: ${r.mascota}`);
      } else if (r.tipo === 'fallo') {
        console.log(`  ${r.situacion} · ref ${r.ref} · ${r.detalle}`);
      }
    }
    const total = await usadas();
    console.log(
      `\nTotal: ${total.llamadas} llamada(s), ${total.entrada} tokens de entrada (${total.cache} leídos de la caché) y ${total.salida} de salida.`,
    );
  } finally {
    // Quien siembra, quita (`db/sembrado/casos-de-los-agentes.ts`): la base de la suite no queda con estas empresas.
    await quitarEmpresasDeLosAgentes(PREFIJO_DE_LA_EVALUACION);
    console.log('  Quitada la empresa sembrada, con sus sesiones y sus hilos.');
  }
}

/** Cada tanda dice cuántos pedidos hace ANTES de hacerlos, y cómo los hace. */
const TANDAS = {
  modelo: {
    que: `la llave de la organización principal alcanza ${MODELO_DEL_EXECUTIVE}, y la herramienta forzada se rechaza (AG-92)`,
    pedidos: 2,
    async correr(llave) {
      const cabeceras = { 'x-api-key': llave, 'anthropic-version': VERSION_DE_LA_API };
      const modelo = await pedirExterno(new URL(`/v1/models/${MODELO_DEL_EXECUTIVE}`, DIRECCION_DE_LA_API).href, { cabeceras });
      console.log(`  GET /v1/models/${MODELO_DEL_EXECUTIVE}: ${describir(modelo)}`);
      const cuenta = await pedirExterno(new URL('/v1/messages/count_tokens', DIRECCION_DE_LA_API).href, {
        metodo: 'POST',
        cabeceras: { ...cabeceras, 'content-type': 'application/json' },
        cuerpo: {
          model: MODELO_DEL_EXECUTIVE,
          messages: [{ role: 'user', content: 'Hola.' }],
          tools: [{ name: 'responder', description: 'La respuesta.', input_schema: { type: 'object', properties: {} } }],
          tool_choice: { type: 'tool', name: 'responder' },
        },
      });
      console.log(`  POST /v1/messages/count_tokens con la herramienta forzada: ${describir(cuenta)}`);
    },
  },
  cerebro: {
    que: `las ${PREGUNTAS_DEL_CEREBRO.length} preguntas del cerebro que llaman al modelo (AG-102, de la 1 a la 16), sobre la base sembrada`,
    // Un techo y no un número fijo: cuántas rondas usa cada pregunta lo decide el modelo.
    pedidos: TECHO_DEL_CEREBRO,
    techo: true,
    correr: correrElCerebro,
  },
};

/** Lo que vale la pena decir de una respuesta: el estado y el motivo, nunca un cuerpo entero. */
function describir(r) {
  if (r.tipo === 'datos') return 'aceptado';
  if (r.tipo === 'rechazado') return `rechazado ${r.estado} (${r.codigo})${r.detalle ? `: ${r.detalle.slice(0, 200)}` : ''}`;
  return `sin respuesta: ${r.causa}`;
}

/** El número que viene después de `--confirmo`, o `null` si no vino. */
function numeroConfirmado(argumentos) {
  const i = argumentos.indexOf('--confirmo');
  if (i === -1) return null;
  const n = Number(argumentos[i + 1]);
  return Number.isInteger(n) ? n : NaN;
}

async function principal(argumentos) {
  const nombre = argumentos[0];
  const tanda = TANDAS[nombre];
  if (!tanda) {
    console.error(`Uso: scripts/evaluar-agentes.mjs <tanda> [--confirmo N]. Tandas: ${Object.keys(TANDAS).join(', ')}.`);
    return 2;
  }
  console.log(`Tanda «${nombre}»: ${tanda.que}.`);
  console.log(`Va a hacer ${tanda.techo ? 'hasta ' : ''}${tanda.pedidos} pedido(s) a Anthropic con la llave de la organización principal.`);

  const confirmado = numeroConfirmado(argumentos);
  if (confirmado === null) {
    console.log(`No corre sin el OK. Para correrla: --confirmo ${tanda.pedidos}`);
    return 1;
  }
  if (confirmado !== tanda.pedidos) {
    console.error(`--confirmo ${argumentos[argumentos.indexOf('--confirmo') + 1]} no es ${tanda.pedidos}: no corre.`);
    return 1;
  }

  const url = process.env.DATABASE_URL_IDENTIDAD;
  if (!url) throw new Error('DATABASE_URL_IDENTIDAD no está definida.');
  exigirAnfitrionLocal(url, {
    quien: 'la evaluación de los agentes',
    porque: 'lee descifrada la llave de IA de la organización principal.',
    escotilla: 'ARIA_SEMBRADO_FORZADO',
  });

  const llave = await conIdentidad(async (db) => {
    const principalOrg = await db.selectFrom('organizaciones').select('id').where('es_principal', '=', true).executeTakeFirst();
    if (!principalOrg) return { tipo: 'falta', que: 'sin_organizacion_principal' };
    return resolverLlaveDeIa(db, principalOrg.id);
  });
  if (llave.tipo !== 'listo') {
    console.error(`No hay llave de IA usable en la organización principal (${llave.que}). Cárgala a mano en Ajustes local.`);
    return 1;
  }
  await tanda.correr(llave.claveIa);
  return 0;
}

let salida = 1;
try {
  salida = await principal(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
} finally {
  await cerrarClientes();
}
process.exit(salida);
