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
// En AG4 hay una sola, `modelo`: la comprobación de `06`, AG-92, antes de la primera llamada real. Dos
// pedidos que no generan: `GET /v1/models/claude-sonnet-5-5` (la llave alcanza el modelo) y
// `POST /v1/messages/count_tokens` con la herramienta forzada (esta cuenta la rechaza con ese modelo, como
// dice la referencia de la API). El cerebro (AG7), la redacción del plan (AG9), el Brief (AG12) y la
// Reunión (AG15) suman las suyas, sobre la base sembrada (`db/sembrado/casos-de-los-agentes.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { exigirAnfitrionLocal } from '../lib/datos/anfitrion.ts';
import { resolverLlaveDeIa } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';
import { DIRECCION_DE_LA_API, VERSION_DE_LA_API } from '../lib/agentes/proveedor.ts';
import { MODELO_DEL_EXECUTIVE } from '../lib/agentes/modelos.ts';

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
  console.log(`Va a hacer ${tanda.pedidos} pedido(s) a Anthropic con la llave de la organización principal.`);

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
