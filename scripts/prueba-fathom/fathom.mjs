// LA PRUEBA DE FATHOM · ¿sirve para reemplazar a tl;dv? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS PREGUNTAS
//
// La documentación de Fathom deja tres cosas sin decir, y las tres deciden el cambio:
//
//   1. ¿La llave del ADMIN ve las llamadas de los demás? Las llaves son por usuario; la FAQ dice que un
//      admin con acceso de vista «all teams» lee todo lo compartido, y que lo privado sólo lo ve quien
//      lo grabó. → `quien` y `reuniones`.
//   2. ¿Un solo webhook del admin recibe las llamadas de todo el equipo? (`shared_team_recordings`).
//      Nada lo dice explícito. → `webhook-crear` + `receptor`.
//   3. ¿La transcripción en español es tan buena como la de tl;dv? → `comparar`, con la MISMA
//      llamada grabada por los dos.
//
// ── CÓMO SE CORRE ────────────────────────────────────────────────────────────
//
//   node --env-file=.env.fathom scripts/prueba-fathom/fathom.mjs <orden> [opciones]
//
//   quien                                   usuarios, permisos y equipos (sólo la llave admin)
//   reuniones [--llave admin|vendedor] [--dias 14] [--paginas 20]
//   webhook-crear --url https://… [--llave admin]
//   webhook-borrar [--llave admin]
//   receptor [--puerto 8787]                 recibe los webhooks en esta máquina
//   simular [--puerto 8787]                  manda al receptor un webhook falso firmado (sin Fathom)
//   simular --url http://localhost:3000/api/fathom/webhook [--secreto whsec_…] [--titulo "HT_Prueba - ARIA"]
//           [--correo lead@…] [--id 123]   manda a la ruta de Comando Central (secreto: --secreto o FATHOM_SECRETO_WEBHOOK)
//   comparar --fathom <recording_id> --tldv <meeting_id> [--llave admin]
//
// `.env.fathom` (ignorado por git, como todo `.env*`): FATHOM_LLAVE_ADMIN, FATHOM_LLAVE_VENDEDOR y,
// para `comparar`, TLDV_LLAVE.
//
// ── LO QUE NO HACE ───────────────────────────────────────────────────────────
//
// No toca la base ni despliega nada. **Lo que baja va FUERA del repositorio** —el repositorio es
// público y esto son llamadas con clientes—: a `%LOCALAPPDATA%/ComandoCentral/prueba-fathom/`. Ni las
// llaves ni el secreto del webhook se imprimen.
// ═══════════════════════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, randomInt } from 'node:crypto';
import {
  FathomError,
  fathomAReunion,
  fathomATranscripcion,
  firmarComoFathom,
  listarReunionesDeFathom,
  pedirAFathom,
  verificarFirmaDeFathom,
} from '../../lib/analizadores/nucleo/fathom.ts';
import { fetchTranscript } from '../../lib/analizadores/nucleo/tldv.ts';
import { pedirExterno } from '../../lib/http/cliente.ts';

const SALIDA = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'ComandoCentral', 'prueba-fathom');

// ── Utilidades ──

function opciones(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const sig = argv[i + 1];
      if (sig === undefined || sig.startsWith('--')) o[a.slice(2)] = true;
      else {
        o[a.slice(2)] = sig;
        i++;
      }
    } else o._.push(a);
  }
  return o;
}

function carpeta(...partes) {
  const d = join(SALIDA, ...partes);
  mkdirSync(d, { recursive: true });
  return d;
}

function guardar(ruta, contenido) {
  writeFileSync(ruta, typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2), 'utf8');
}

function llaveDe(nombre) {
  const variable = nombre === 'vendedor' ? 'FATHOM_LLAVE_VENDEDOR' : 'FATHOM_LLAVE_ADMIN';
  const v = (process.env[variable] || '').trim();
  if (!v) {
    console.error(`Falta ${variable} en .env.fathom.`);
    process.exit(2);
  }
  return v;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reintenta un 429 hasta tres veces, esperando lo que pida Fathom (o un minuto). */
async function conReintento(fn) {
  for (let intento = 1; ; intento++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof FathomError && e.kind === 'limite' && intento < 4) {
        const s = e.retryAfterSec ?? 60;
        console.log(`  · Fathom pidió esperar: ${s} s (intento ${intento}).`);
        await esperar(s * 1000);
        continue;
      }
      throw e;
    }
  }
}

/** Todas las páginas de un listado con cursor (`/users`, `/teams`, `/team_members`). */
async function todas(ruta, llave) {
  const items = [];
  let cursor = null;
  do {
    const sep = ruta.includes('?') ? '&' : '?';
    const body = await conReintento(() => pedirAFathom(`${ruta}${cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ''}`, llave));
    items.push(...(body.items ?? []));
    cursor = body.next_cursor || null;
  } while (cursor);
  return items;
}

function fallo(e) {
  if (e instanceof FathomError) {
    const ayuda = {
      llave: 'la llave no sirve o no tiene permiso (¿es de un Account Admin?)',
      limite: 'Fathom pidió esperar más de tres veces',
      sin_respuesta: 'no hubo respuesta',
    }[e.kind];
    console.error(`✖ ${e.message}${ayuda ? ` — ${ayuda}` : ''}`);
  } else console.error('✖', e instanceof Error ? e.message : e);
  process.exit(1);
}

// ── quien ──

async function quien() {
  const llave = llaveDe('admin');
  let usuarios;
  try {
    usuarios = await todas('/users', llave);
  } catch (e) {
    if (e instanceof FathomError && e.kind === 'llave' && e.status === 403) {
      console.log('✖ /users contestó 403: esta llave no es de un Account Admin. En una cuenta sin plan Team es lo esperado (no hay organización).');
      console.log('  Lo de equipo (P1 y P2) queda para cuando haya plan Team; el resto de la prueba sí corre.');
      return;
    }
    throw e;
  }
  const [equipos, miembros] = [await todas('/teams', llave), await todas('/team_members', llave)];
  const d = carpeta();
  guardar(join(d, 'usuarios.json'), { usuarios, equipos, miembros });

  console.log(`\nUsuarios de la cuenta (${usuarios.length}):`);
  for (const u of usuarios) {
    const p = u.permissions;
    console.log(
      `  ${u.email.padEnd(36)} ${String(u.status).padEnd(11)} ajustes=${(p?.settings_access?.level ?? '—').padEnd(13)} ve=${p?.view_access?.level ?? '—'}${p?.view_access?.teams?.length ? ` (${p.view_access.teams.join(', ')})` : ''}`,
    );
  }
  console.log(`\nEquipos (${equipos.length}): ${equipos.map((e) => e.name).join(', ') || '—'}`);
  console.log(`Miembros visibles para esta llave: ${miembros.length}`);

  const admins = usuarios.filter((u) => u.permissions?.settings_access?.level === 'account_admin');
  const venTodo = admins.filter((u) => u.permissions?.view_access?.level === 'all_teams');
  console.log('\nVeredicto:');
  console.log(`  · Account Admins: ${admins.map((u) => u.email).join(', ') || 'ninguno'}`);
  console.log(
    venTodo.length
      ? `  ✔ Con vista «all_teams»: ${venTodo.map((u) => u.email).join(', ')}. Su llave puede leer todo lo compartido.`
      : '  ✖ Ningún admin tiene vista «all_teams»: la llave admin sólo verá su equipo. Cambiarlo en Organization Settings → Access Controls.',
  );
  console.log(`\nGuardado en ${join(d, 'usuarios.json')}`);
}

// ── reuniones ──

async function reuniones(o) {
  const nombre = o.llave === 'vendedor' ? 'vendedor' : 'admin';
  const llave = llaveDe(nombre);
  const dias = Number(o.dias ?? 14);
  const topePaginas = Number(o.paginas ?? 20);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const d = carpeta('reuniones', nombre);

  const todasLasReuniones = [];
  let cursor = null;
  let paginas = 0;
  do {
    const r = await conReintento(() => listarReunionesDeFathom(llave, { desde, cursor, conTranscripcion: true }));
    todasLasReuniones.push(...r.reuniones);
    cursor = r.siguiente;
    paginas++;
  } while (cursor && paginas < topePaginas);

  console.log(`\nLlave ${nombre} · últimos ${dias} días · ${todasLasReuniones.length} reuniones en ${paginas} página(s)${cursor ? ' (HAY MÁS: subir --paginas)' : ''}\n`);
  console.log('  recording_id  fecha             grabó                               compartida      idioma  líneas  oradores≈email  prospecto');

  const porQuien = new Map();
  let privadas = 0;
  for (const m of todasLasReuniones) {
    const id = String(m.recording_id);
    guardar(join(d, `${id}.json`), m);
    const r = fathomAReunion(m);
    let lineas = 0;
    let conEmail = 0;
    try {
      const t = fathomATranscripcion(m);
      guardar(join(d, `${id}.txt`), `${r.title ?? ''}\n${r.happenedAt ?? ''} · grabó ${r.organizerEmail ?? '?'} · prospecto ${r.prospectEmail ?? '?'}\n\n${t.fullText}\n`);
      lineas = t.segments.length;
      conEmail = (m.transcript ?? []).filter((x) => x.speaker?.matched_calendar_invitee_email).length;
    } catch (e) {
      if (!(e instanceof FathomError && e.kind === 'no_lista')) throw e;
    }
    const grabo = m.recorded_by?.email ?? '?';
    porQuien.set(grabo, (porQuien.get(grabo) ?? 0) + 1);
    if (m.shared_with === 'no_teams') privadas++;
    console.log(
      `  ${id.padEnd(13)} ${(r.happenedAt ?? '').slice(0, 16).padEnd(17)} ${grabo.padEnd(35)} ${String(m.shared_with ?? '?').padEnd(15)} ${String(m.transcript_language ?? '?').padEnd(7)} ${String(lineas).padStart(6)}  ${lineas ? `${Math.round((conEmail / lineas) * 100)}%`.padStart(14) : '             —'}  ${r.prospectEmail ?? '—'}`,
    );
  }

  console.log('\nQuién grabó lo que esta llave ve:');
  for (const [email, n] of porQuien) console.log(`  ${email.padEnd(36)} ${n}`);
  console.log(`\nPrivadas (shared_with = no_teams) que esta llave ve: ${privadas}`);
  if (nombre === 'admin') {
    console.log(
      porQuien.size > 1
        ? '✔ La llave admin ve reuniones de más de una persona: la pregunta 1 queda contestada que SÍ (para lo compartido).'
        : '✖ La llave admin ve reuniones de una sola persona. Si el vendedor grabó en estos días, lo suyo no le llega: revisar visibilidad y vista del admin.',
    );
  }
  console.log(`\nGuardado en ${d} (un .json crudo y un .txt legible por reunión)`);
}

// ── webhooks ──

const DISPARADORES = ['my_recordings', 'shared_external_recordings', 'my_shared_with_team_recordings', 'shared_team_recordings'];

async function webhookCrear(o) {
  const nombre = o.llave === 'vendedor' ? 'vendedor' : 'admin';
  const llave = llaveDe(nombre);
  const url = typeof o.url === 'string' ? o.url : '';
  if (!/^https:\/\//.test(url)) {
    console.error('Falta --url https://… (la del túnel que apunta al receptor).');
    process.exit(2);
  }
  const archivo = join(carpeta(), `webhook-${nombre}.json`);
  if (existsSync(archivo)) {
    console.error(`Ya hay un webhook creado para la llave ${nombre} (${archivo}). Bórralo primero con webhook-borrar.`);
    process.exit(2);
  }
  const crear = (disparadores) =>
    conReintento(() =>
      pedirAFathom('/webhooks', llave, {
        metodo: 'POST',
        cuerpo: {
          destination_url: url,
          triggered_for: disparadores,
          include_transcript: true,
          include_summary: true,
          include_action_items: true,
          include_crm_matches: true,
        },
      }),
    );
  /* Los dos disparadores de equipo son «Team Plans only». En una cuenta Free o Premium Fathom puede
     rechazar el pedido entero: se reintenta con los personales, y el rechazo mismo queda como dato. */
  let w;
  try {
    w = await crear(DISPARADORES);
  } catch (e) {
    if (!(e instanceof FathomError && e.kind === 'rechazado' && e.status === 400)) throw e;
    console.log(`  · Fathom rechazó los disparadores de equipo (${e.message}). Sin plan Team es lo esperado.`);
    w = await crear(['my_recordings', 'shared_external_recordings']);
  }
  guardar(archivo, { llave: nombre, ...w });
  console.log(`✔ Webhook creado para la llave ${nombre}: id ${w.id}`);
  console.log(`  dispara para: ${(w.triggered_for ?? []).join(', ')}`);
  const faltan = DISPARADORES.filter((t) => !(w.triggered_for ?? []).includes(t));
  if (faltan.length) console.log(`  ⚠ Fathom NO aceptó: ${faltan.join(', ')} (¿el plan no es Team?)`);
  console.log(`  El secreto quedó en ${archivo} (no se imprime). El receptor lo lee de ahí.`);
}

async function webhookBorrar(o) {
  const nombre = o.llave === 'vendedor' ? 'vendedor' : 'admin';
  const llave = llaveDe(nombre);
  const archivo = join(SALIDA, `webhook-${nombre}.json`);
  if (!existsSync(archivo)) {
    console.error(`No hay webhook guardado para la llave ${nombre}. Si lo creaste a mano, bórralo en Fathom → Settings → API Access.`);
    process.exit(2);
  }
  const w = JSON.parse(readFileSync(archivo, 'utf8'));
  await conReintento(() => pedirAFathom(`/webhooks/${encodeURIComponent(w.id)}`, llave, { metodo: 'DELETE', lectura: 'texto' }));
  rmSync(archivo);
  console.log(`✔ Webhook ${w.id} borrado.`);
}

/**
 * Los secretos contra los que se prueba cada envío. Los de `webhook-crear` quedan en archivos; uno creado
 * A MANO en Fathom (Settings → API Access → Manage → Add Webhook) se pega en `FATHOM_SECRETO_WEBHOOK`.
 * Cada webhook tiene su propio secreto, así que el que valida dice de cuál vino el envío: el cuerpo no lo
 * dice (FAQ: «The payload doesn't identify which user's API key the webhook is tied to»).
 */
function secretosGuardados() {
  const aMano = (process.env.FATHOM_SECRETO_WEBHOOK || '').trim();
  const delEntorno = aMano ? [{ nombre: 'creado a mano', secreto: aMano }] : [];
  if (!existsSync(SALIDA)) return delEntorno;
  return delEntorno.concat(readdirSync(SALIDA)
    .filter((f) => /^webhook-.*\.json$/.test(f))
    .map((f) => {
      try {
        const w = JSON.parse(readFileSync(join(SALIDA, f), 'utf8'));
        return { nombre: w.llave ?? f, secreto: w.secret };
      } catch {
        return null;
      }
    })
    .filter((w) => w && typeof w.secreto === 'string'));
}

function receptor(o) {
  const puerto = Number(o.puerto ?? 8787);
  const d = carpeta('webhooks');
  const vistos = new Set();
  const servidor = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('receptor de la prueba de Fathom: vivo\n');
      return;
    }
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const crudo = Buffer.concat(trozos).toString('utf8');
      const cab = {
        id: req.headers['webhook-id'] ?? null,
        timestamp: req.headers['webhook-timestamp'] ?? null,
        firma: req.headers['webhook-signature'] ?? null,
      };
      // Cada secreto guardado se prueba: así se sabe CUÁL webhook (admin o vendedor) lo mandó.
      const secretos = secretosGuardados();
      const coincide = secretos.find((s) => verificarFirmaDeFathom(s.secreto, cab, crudo).ok);
      const motivo = coincide ? null : secretos.length ? verificarFirmaDeFathom(secretos[0].secreto, cab, crudo).motivo : 'sin_secretos_guardados';
      const repetido = cab.id ? vistos.has(cab.id) : false;
      if (cab.id) vistos.add(cab.id);

      let resumen = '';
      let cuerpo = null;
      try {
        cuerpo = JSON.parse(crudo);
        const r = fathomAReunion(cuerpo);
        let lineas = 0;
        try {
          lineas = fathomATranscripcion(cuerpo).segments.length;
        } catch {
          /* sin transcripción */
        }
        resumen = `${r.externalMeetingId} · grabó ${r.organizerEmail ?? '?'} · ${cuerpo.shared_with ?? '?'} · ${lineas} líneas · prospecto ${r.prospectEmail ?? '—'}`;
      } catch {
        resumen = `cuerpo que no es JSON (${crudo.length} bytes)`;
      }
      const marca = new Date().toISOString().replace(/[:.]/g, '-');
      guardar(join(d, `${marca}-${String(cab.id ?? 'sin-id').replace(/[^\w-]/g, '_')}.json`), {
        recibido: new Date().toISOString(),
        firma: coincide ? `válida (webhook ${coincide.nombre})` : `NO válida: ${motivo}`,
        repetido,
        cabeceras: req.headers,
        cuerpo: cuerpo ?? crudo,
      });
      console.log(`${coincide ? '✔' : '✖'} ${new Date().toLocaleTimeString()} ${coincide ? `[${coincide.nombre}]` : `[firma: ${motivo}]`}${repetido ? ' [REPETIDO]' : ''} ${resumen}`);
      // Se contesta 200 aunque la firma falle: en la prueba importa no perder el envío. Ya quedó guardado y marcado.
      res.writeHead(200).end('ok');
    });
  });
  servidor.listen(puerto, () => {
    console.log(`Receptor escuchando en http://localhost:${puerto}`);
    console.log(`Secretos cargados: ${secretosGuardados().map((s) => s.nombre).join(', ') || 'ninguno todavía (se leen en cada envío)'}`);
    console.log(`Cada envío se guarda en ${d}\n`);
  });
}

async function simular(o) {
  if (typeof o.url === 'string') return simularHaciaLaRuta(o);
  const puerto = Number(o.puerto ?? 8787);
  const archivo = join(carpeta(), 'webhook-simulado.json');
  const secreto = `whsec_${randomBytes(24).toString('base64')}`;
  guardar(archivo, { llave: 'simulado', id: 'simulado', secret: secreto });
  const reunion = {
    title: 'Llamada de venta · simulada',
    recording_id: 999000111,
    url: 'https://fathom.video/calls/999000111',
    share_url: 'https://fathom.video/share/simulada',
    created_at: new Date().toISOString(),
    recording_start_time: new Date(Date.now() - 1800_000).toISOString(),
    recording_end_time: new Date().toISOString(),
    calendar_invitees_domains_type: 'one_or_more_external',
    shared_with: 'all_teams',
    transcript_language: 'es',
    transcript: [
      { speaker: { display_name: 'Closer', matched_calendar_invitee_email: 'closer@ejemplo-interno.com' }, text: 'Hola, ¿cómo estás? Cuéntame de tu negocio.', timestamp: '00:00:05' },
      { speaker: { display_name: 'Prospecto', matched_calendar_invitee_email: 'prospecto@ejemplo-externo.com' }, text: 'Tenemos una clínica y nos faltan pacientes.', timestamp: '00:00:12' },
    ],
    calendar_invitees: [
      { name: 'Closer', email: 'closer@ejemplo-interno.com', email_domain: 'ejemplo-interno.com', is_external: false },
      { name: 'Prospecto', email: 'prospecto@ejemplo-externo.com', email_domain: 'ejemplo-externo.com', is_external: true },
    ],
    recorded_by: { name: 'Closer', email: 'closer@ejemplo-interno.com', email_domain: 'ejemplo-interno.com', team: 'Ventas' },
  };
  // `pedirExterno` manda `JSON.stringify(cuerpo)`: con el mismo objeto es el mismo texto que `crudo`,
  // así que la firma se calcula sobre exactamente lo que viaja.
  const crudo = JSON.stringify(reunion);
  try {
    const ts = String(Math.floor(Date.now() / 1000));
    const bueno = await pedirExterno(`http://localhost:${puerto}/`, {
      metodo: 'POST',
      cabeceras: { 'webhook-id': 'msg_simulado_1', 'webhook-timestamp': ts, 'webhook-signature': firmarComoFathom(secreto, 'msg_simulado_1', ts, crudo) },
      cuerpo: reunion,
      lectura: 'texto',
    });
    const malo = await pedirExterno(`http://localhost:${puerto}/`, {
      metodo: 'POST',
      cabeceras: { 'webhook-id': 'msg_simulado_2', 'webhook-timestamp': ts, 'webhook-signature': firmarComoFathom(secreto, 'msg_simulado_2', ts, crudo) },
      cuerpo: { ...reunion, title: 'tocado en el camino' },
      lectura: 'texto',
    });
    console.log(`Envío firmado:  ${bueno.tipo === 'datos' ? 'entregado' : `falló (${bueno.causa ?? bueno.estado})`} → el receptor debe marcarlo ✔ [simulado]`);
    console.log(`Envío tocado:   ${malo.tipo === 'datos' ? 'entregado' : `falló (${malo.causa ?? malo.estado})`} → el receptor debe marcarlo ✖ [firma: firma_distinta]`);
  } finally {
    rmSync(archivo, { force: true });
  }
}

/**
 * `simular --url …`: un envío firmado hacia la ruta de Comando Central (`/api/fathom/webhook`), con el secreto que ella
 * conoce, el título y el correo del lead elegidos. Imprime lo que respondió la ruta.
 */
async function simularHaciaLaRuta(o) {
  const secretoDeLaVariable = (process.env.FATHOM_SECRETO_WEBHOOK || '').split(',')[0].trim();
  const secreto = typeof o.secreto === 'string' ? o.secreto : secretoDeLaVariable;
  if (!secreto.startsWith('whsec_')) {
    console.error('Falta el secreto: --secreto whsec_… o FATHOM_SECRETO_WEBHOOK (el mismo que tiene la ruta).');
    process.exitCode = 1;
    return;
  }
  const titulo = typeof o.titulo === 'string' ? o.titulo : 'HT_Prueba - ARIA';
  const correo = typeof o.correo === 'string' ? o.correo : 'prospecto@ejemplo-externo.com';
  const recordingId = o.id ? Number(o.id) : 900_000_000 + randomInt(1_000_000);
  const interno = typeof o.interno === 'string' ? o.interno : 'closer@ejemplo-interno.com';
  const reunion = {
    title: titulo,
    meeting_title: titulo,
    recording_id: recordingId,
    url: `https://fathom.video/calls/${recordingId}`,
    share_url: 'https://fathom.video/share/simulada',
    created_at: new Date().toISOString(),
    scheduled_start_time: new Date(Date.now() - 1800_000).toISOString(),
    scheduled_end_time: new Date().toISOString(),
    recording_start_time: new Date(Date.now() - 1800_000).toISOString(),
    recording_end_time: new Date().toISOString(),
    calendar_invitees_domains_type: 'one_or_more_external',
    shared_with: 'all_teams',
    transcript_language: 'es',
    transcript: [
      { speaker: { display_name: 'Closer', matched_calendar_invitee_email: interno }, text: 'Hola, ¿cómo estás? Cuéntame de tu negocio.', timestamp: '00:00:05' },
      { speaker: { display_name: 'Prospecto', matched_calendar_invitee_email: correo }, text: 'Tenemos una clínica y nos faltan pacientes.', timestamp: '00:00:12' },
    ],
    calendar_invitees: [
      { name: 'Closer', email: interno, email_domain: interno.split('@')[1] ?? null, is_external: false },
      { name: 'Prospecto', email: correo, email_domain: correo.split('@')[1] ?? null, is_external: true },
    ],
    recorded_by: { name: 'Closer', email: interno, email_domain: interno.split('@')[1] ?? '', team: 'Ventas' },
  };
  const crudo = JSON.stringify(reunion);
  const ts = String(Math.floor(Date.now() / 1000));
  const id = `msg_simulado_${recordingId}`;
  const r = await pedirExterno(o.url, {
    metodo: 'POST',
    cabeceras: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': firmarComoFathom(secreto, id, ts, crudo) },
    cuerpo: reunion,
    lectura: 'texto',
  });
  console.log(`recording_id ${recordingId} · «${titulo}» · lead ${correo}`);
  console.log(r.tipo === 'datos' ? `La ruta respondió: ${r.datos}` : `Falló: ${r.causa ?? `${r.estado} ${r.detalle ?? r.codigo ?? ''}`}`);
}

// ── comparar ──

async function comparar(o) {
  const idFathom = String(o.fathom ?? '');
  const idTldv = String(o.tldv ?? '');
  if (!/^\d+$/.test(idFathom) || !idTldv) {
    console.error('Uso: comparar --fathom <recording_id> --tldv <meeting_id>');
    process.exit(2);
  }
  const llaveTldv = (process.env.TLDV_LLAVE || '').trim();
  if (!llaveTldv) {
    console.error('Falta TLDV_LLAVE en .env.fathom.');
    process.exit(2);
  }
  const llave = llaveDe(o.llave === 'vendedor' ? 'vendedor' : 'admin');

  const f = await conReintento(() => pedirAFathom(`/recordings/${idFathom}/transcript`, llave));
  const tf = fathomATranscripcion({ recording_id: Number(idFathom), transcript: f.transcript, transcript_language: undefined });
  const tt = await fetchTranscript(llaveTldv, idTldv);

  const d = carpeta('comparar', `${idFathom}-vs-${idTldv}`);
  guardar(join(d, 'fathom.txt'), tf.fullText);
  guardar(join(d, 'tldv.txt'), tt.fullText);

  const medir = (t) => ({
    lineas: t.segments.length,
    palabras: t.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0),
    oradores: [...new Set(t.segments.map((s) => s.speaker))],
    ultimaMarcaMin: Math.round((t.segments.at(-1)?.startSec ?? 0) / 60),
  });
  const mf = medir(tf);
  const mt = medir(tt);
  console.log('\n                 Fathom          tl;dv');
  console.log(`  líneas         ${String(mf.lineas).padEnd(15)} ${mt.lineas}`);
  console.log(`  palabras       ${String(mf.palabras).padEnd(15)} ${mt.palabras}`);
  console.log(`  última marca   ${`${mf.ultimaMarcaMin} min`.padEnd(15)} ${mt.ultimaMarcaMin} min`);
  console.log(`  oradores       ${mf.oradores.join(', ')}`);
  console.log(`                 ${mt.oradores.join(', ')}`);
  console.log(`\nLos dos textos quedaron en ${d}. La calidad se juzga leyéndolos: nombres propios, cifras y la jerga del nicho.`);
}

// ── Entrada ──

const o = opciones(process.argv.slice(2));
const orden = o._[0];
const ordenes = {
  quien,
  reuniones,
  'webhook-crear': webhookCrear,
  'webhook-borrar': webhookBorrar,
  receptor,
  simular,
  comparar,
};
if (!ordenes[orden]) {
  console.log('Órdenes: quien · reuniones · webhook-crear · webhook-borrar · receptor · simular · comparar');
  console.log('Uso: node --env-file=.env.fathom scripts/prueba-fathom/fathom.mjs <orden> [opciones]');
  process.exit(orden ? 2 : 0);
}
try {
  await ordenes[orden](o);
} catch (e) {
  fallo(e);
}
