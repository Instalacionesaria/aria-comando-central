// ¿El identificador del usuario alcanza para saber si escribió el AGENTE? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA, Y POR QUÉ NO SE PUEDE CONTESTAR DESDE NUESTRA BASE
//
// `lib/ghl/conversaciones.ts` dice de `source`: *«es el ÚNICO campo que distingue un mensaje que
// escribió una persona de uno que disparó una automatización, y `userId` no sirve para eso:
// medido, un mensaje con `source: "workflow"` **también trae `userId`** —el dueño del flujo—»*.
//
// Ese campo se lee (`leerMensaje`), se usa una vez para decidir `persona` contra `agente`
// (`autorDe`, en `lib/negocio/ingesta.ts`) **y no se guarda en ninguna columna**. Así que
// `workflow`, `campaign`, `bulk_actions` y `api` quedan colapsados para siempre dentro de
// `autor = 'agente'`, y desde la base ya no hay forma de separarlos.
//
//   node --env-file=.env.supabase scripts/medir-mensaje.mjs
//
// ── Y UNA SEGUNDA PREGUNTA, DEL MISMO VIAJE ─────────────────────────────────
//
// **¿Qué trae un registro de llamada?** Medido antes: `TYPE_CUSTOM_CALL` llega en 128 de los
// mensajes de nuestros contactos y la ingesta lo descarta al escribir, porque no es un canal del
// chat. Es la única señal del agente de VOZ que hoy toca este sistema, y `negocio.llamadas` —que
// existe desde la 011 con `contestada`, `inicio_el`, `duracion_segundos` y `resumen`— no tiene un
// solo escritor.
//
// Antes de escribirla hay que saber si esos campos se pueden llenar. Como con `dateAdded` y con
// `source`: lo que decide no es que el registro EXISTA, sino que traiga con qué.
//
// ── LO QUE DECIDE, Y NO ES LO QUE PARECE ────────────────────────────────────
//
// La frontera `app` contra no-`app` **ya está guardada**: es exactamente la columna `autor`, porque
// `autorDe` hace `fuente === 'app' ? 'persona' : 'agente'`. O sea que encontrar un `source` distinto
// de `app` no prueba nada — es lo que se espera de todo lo que la base marcó `agente`.
//
// Lo único en disputa es **la composición interna de ese cubo**, en los mensajes sellados con el
// identificador del agente:
//
//   · `api`                                  → COMPATIBLE con «lo escribió el agente».
//   · `workflow`, `campaign`, `bulk_actions` → INCOMPATIBLES: son flujos de la cuenta sellados con
//                                              este usuario **como dueño**, no como remitente.
//
// Y el estadístico que decide es **la concentración de esa fila**: con un solo valor, el
// identificador y `source` dicen lo mismo y la columna sobra. Repartida entre `api` y `workflow`,
// filtrar por identificador mezcla al agente con las automatizaciones y la columna hace falta.
//
// ── DE DÓNDE SALE LA MUESTRA, QUE ES LO QUE LO VUELVE UNA AUDITORÍA ─────────
//
// **De nuestras propias filas, y no de la cuenta.** La subcuenta tiene 15.808 conversaciones y
// nuestros contactos son ~239 (`lib/ghl/conversaciones.ts:6-10`): muestrear la cuenta mediría a los
// closers de la plataforma anterior y a los flujos de la casa, que nunca entran a `negocio.mensajes`.
// La pregunta no es «quién sella mensajes en esta subcuenta» sino «el identificador de LAS FILAS QUE
// GUARDAMOS alcanza».
//
// Así que se leen nuestros salientes, se le piden al CRM esas conversaciones y se emparejan **por
// `ghl_mensaje_id`**. El resultado no necesita ningún argumento de representatividad: es el `source`
// de cada fila nuestra, una por una, y se puede confrontar con lo que ya se midió en la base.
//
// Las filas con `id_fabricado` quedan afuera: las escribe el webhook con un identificador que
// inventamos nosotros, no existen en el CRM y nunca emparejarían — contarlas como «no encontrada»
// taparía la única cifra que mide un problema de verdad.
//
// ── LO QUE ESTE GUION NO HACE, Y ES DELIBERADO ──────────────────────────────
//
// **No imprime ningún mensaje.** Ni un cuerpo, ni un teléfono, ni un identificador de contacto:
// sólo nombres de campo y los valores de `source` y `messageType`, que son vocabulario del
// proveedor. Tampoco imprime el `detalle` de un rechazo — `lib/http/cliente.ts` advierte que el
// mensaje de error de un CRM puede nombrar a un contacto.
//
// Los identificadores de usuario se imprimen etiquetados (`u1`, `u2`, …), nunca crudos.
//
// **Sólo hace `GET`**, por `pedirExterno`, y **frena ante un 401, un 403 o un 429** en vez de seguir
// golpeando la subcuenta que el cron está usando.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../lib/datos/contexto.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

/** Cuántas conversaciones nuestras se piden. Se imprime siempre cuántas quedaron afuera. */
/* Alto a propósito: cubre las 518 conversaciones nuestras de la subcuenta real, o sea que la
   corrida es un CENSO y no una muestra. El proyecto ya pagó lo contrario —«una muestra no es un
   censo», con un 87 escrito en catorce comentarios como si fuera el total— y acá el costo de
   evitarlo es una corrida de sólo lectura que tarda unos minutos. Si algún día no alcanza, la línea
   de «RECORTADO» lo dice sola. */
const TOPE_DE_CONVERSACIONES = 600;
const POR_PAGINA = 100;

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-04-15';

/** Los `source` que NO pueden ser el agente escribiendo: son flujos de la cuenta. */
const AUTOMATICOS = new Set(['workflow', 'campaign', 'bulk_actions']);

function cabeceras(token) {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

/** El sobre doble, igual que en `conversaciones.ts`: medido `{ messages: { messages: [...] } }`. */
function sobreDeLaLista(raiz) {
  const o = raiz ?? {};
  return o.messages !== null && typeof o.messages === 'object' && !Array.isArray(o.messages)
    ? o.messages
    : o;
}

function etiquetar(v) {
  return v === null || v === undefined ? '(ausente)' : v === '' ? '(vacío)' : String(v);
}

function sumar(mapa, clave) {
  const k = etiquetar(clave);
  mapa.set(k, (mapa.get(k) ?? 0) + 1);
}

function totalDe(mapa) {
  let n = 0;
  for (const v of mapa.values()) n += v;
  return n;
}

function imprimirCenso(titulo, mapa, total, sangria = '    ') {
  if (titulo) console.log(`\n  ${titulo}`);
  const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  if (filas.length === 0) {
    console.log(`${sangria}(ninguno)`);
    return;
  }
  for (const [k, n] of filas) {
    const pct = total > 0 ? ((n / total) * 100).toFixed(1).padStart(5) : '  0.0';
    console.log(`${sangria}${String(k).padEnd(24)} ${String(n).padStart(5)}  ${pct} %`);
  }
}

/** Un rechazo, reducido a lo imprimible. **Nunca el `detalle`**: puede nombrar a alguien. */
function porQueFallo(r) {
  return r.tipo === 'rechazado' ? `rechazado ${r.estado} ${r.codigo ?? ''}`.trim() : 'sin_respuesta';
}

/** Los rechazos ante los que se frena en vez de insistir. */
function hayQueFrenar(r) {
  return r.tipo === 'rechazado' && (r.estado === 401 || r.estado === 403 || r.estado === 429);
}

async function main() {
  const orgs = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).orderBy('nombre').execute(),
  );

  for (const org of orgs) {
    const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, org.id));
    if (acceso.tipo !== 'listo') continue;

    const cred = await conIdentidad(async (db) =>
      db
        .selectFrom('organizaciones_credenciales')
        .select(['crm_agente_usuario_id'])
        .where('org_id', '=', org.id)
        .executeTakeFirst(),
    );
    const idDelAgente = (cred?.crm_agente_usuario_id ?? '').trim() || null;

    console.log(`\n═══ ${org.nombre} ═══`);
    if (!idDelAgente) {
      console.log('  SIN VEREDICTO — no hay identificador de agente configurado: el freno está puesto');
      continue;
    }

    const nuestros = await conOrganizacion(org.id, async () =>
      datos()
        .selectFrom('mensajes')
        .select(['ghl_mensaje_id', 'ghl_conversacion_id', 'autor', 'autor_ghl_usuario_id', 'enviado_el'])
        .where('direccion', '=', 'saliente')
        .where('id_fabricado', '=', false)
        .where('ghl_conversacion_id', 'is not', null)
        .execute(),
    );

    if (nuestros.length === 0) {
      console.log('  SIN VEREDICTO — no hay salientes nuestros con conversación conocida');
      continue;
    }

    const porId = new Map(nuestros.map((m) => [String(m.ghl_mensaje_id), m]));
    const conversaciones = [...new Set(nuestros.map((m) => m.ghl_conversacion_id))];
    const instantes = nuestros
      .map((m) => m.enviado_el)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    const rango = instantes.length
      ? `${new Date(Math.min(...instantes)).toISOString().slice(0, 10)} → ${new Date(Math.max(...instantes)).toISOString().slice(0, 10)}`
      : '(sin fechas)';

    const conIdEnLaBase = nuestros.filter((m) => m.autor_ghl_usuario_id === idDelAgente).length;
    console.log(`  salientes nuestros:            ${nuestros.length}  (enviados entre ${rango})`);
    console.log(`  de ésos, con el ID DEL AGENTE: ${conIdEnLaBase}`);
    console.log(
      `  conversaciones a pedir:        ${conversaciones.length}` +
        (conversaciones.length > TOPE_DE_CONVERSACIONES
          ? `  → RECORTADO a ${TOPE_DE_CONVERSACIONES} por el tope`
          : ''),
    );

    const aPedir = conversaciones.slice(0, TOPE_DE_CONVERSACIONES);

    const claves = new Set();
    const fuentesCrudas = new Map();
    const tiposCrudos = new Map();
    const fallosPorTipo = new Map();
    /** Las claves de los registros de llamada, y de cuántos vienen. */
    const clavesDeLlamada = new Map();
    const valoresDeLlamada = new Map();
    let llamadas = 0;
    const usuarios = new Map();
    /** El `source` del CRM para NUESTRAS filas, agrupado por de quién es el identificador guardado. */
    const porDuenio = new Map([
      ['ID DEL AGENTE', new Map()],
      ['otro usuario', new Map()],
      ['sin identificador', new Map()],
    ]);
    let emparejados = 0;
    let recortadas = 0;
    let frenado = null;

    for (const convId of aPedir) {
      const r = await pedirExterno(
        `${BASE}/conversations/${encodeURIComponent(convId)}/messages?limit=${POR_PAGINA}`,
        { cabeceras: cabeceras(acceso.token) },
      );
      if (r.tipo !== 'datos') {
        sumar(fallosPorTipo, porQueFallo(r));
        if (hayQueFrenar(r)) {
          frenado = porQueFallo(r);
          break;
        }
        continue;
      }
      const interno = sobreDeLaLista(r.datos);
      const lista = Array.isArray(interno.messages) ? interno.messages : [];
      /* Una conversación con más de cien mensajes vuelve recortada, y hay que decirlo: si la página
         fuera la de los más VIEJOS, la medición hablaría de antes del agente sin avisar. */
      if (interno.nextPage === true) recortadas++;

      for (const m of lista) {
        const o = m ?? {};
        for (const k of Object.keys(o)) claves.add(k);
        sumar(fuentesCrudas, o.source);
        sumar(tiposCrudos, o.messageType);
        const uid = typeof o.userId === 'string' && o.userId !== '' ? o.userId : null;
        if (uid) sumar(usuarios, uid);

        /* El registro de llamada, aparte. Se cuentan sus claves presentes —no ausentes— y se miran
           los valores SÓLO de los campos que no pueden ser de nadie: números, booleanos y los tres
           campos de clasificación. Un registro de llamada puede traer una URL de grabación, y eso no
           se imprime ni reducido. */
        if (o.messageType === 'TYPE_CUSTOM_CALL') {
          llamadas++;
          for (const [k, v] of Object.entries(o)) {
            if (v === null || v === undefined || v === '') continue;
            sumar(clavesDeLlamada, k);
            if (typeof v === 'number' || typeof v === 'boolean') sumar(valoresDeLlamada, `${k} = ${v}`);
            else if (k === 'status' || k === 'direction' || k === 'source') sumar(valoresDeLlamada, `${k} = ${v}`);
            else if (typeof v === 'object') {
              sumar(valoresDeLlamada, `${k} = {${Object.keys(v).sort().join(',')}}`);
              /* Un nivel MÁS adentro, que es donde estos proveedores esconden la duración. Sólo
                 nombres de campo y valores numéricos o booleanos: una URL de grabación no se
                 imprime ni reducida. */
              for (const [k2, v2] of Object.entries(v)) {
                if (v2 === null || v2 === undefined || v2 === '') continue;
                const tipo = Array.isArray(v2) ? 'array' : typeof v2;
                if (tipo === 'object') sumar(valoresDeLlamada, `  ${k}.${k2} = {${Object.keys(v2).sort().join(',')}}`);
                else if (tipo === 'number' || tipo === 'boolean') sumar(valoresDeLlamada, `  ${k}.${k2} = ${v2}`);
                else sumar(valoresDeLlamada, `  ${k}.${k2} : ${tipo}`);
              }
            }
          }
        }

        /* El emparejamiento, que es el punto entero: el `source` que manda el CRM, puesto contra la
           fila que NOSOTROS guardamos con ese mismo identificador. */
        const fila = porId.get(String(o.id ?? ''));
        if (!fila) continue;
        emparejados++;
        const duenio =
          fila.autor_ghl_usuario_id === null || fila.autor_ghl_usuario_id === ''
            ? 'sin identificador'
            : fila.autor_ghl_usuario_id === idDelAgente
              ? 'ID DEL AGENTE'
              : 'otro usuario';
        sumar(porDuenio.get(duenio), o.source);
      }
    }

    if (frenado) console.log(`\n  FRENADO por «${frenado}»: la corrida quedó incompleta.`);
    console.log(
      `\n  conversaciones pedidas: ${aPedir.length}` +
        (recortadas > 0 ? `  ·  ${recortadas} con más de ${POR_PAGINA} mensajes (recortadas)` : ''),
    );
    console.log(`  filas nuestras emparejadas con el CRM: ${emparejados} de ${nuestros.length}`);

    console.log(`\n  TODAS las claves que trae un mensaje (${claves.size}):`);
    console.log('    ' + [...claves].sort().join(', '));
    imprimirCenso('`source`, censo crudo de todo lo que devolvió el CRM:', fuentesCrudas, totalDe(fuentesCrudas));
    imprimirCenso('`messageType` (para ver si llegan registros de llamada):', tiposCrudos, totalDe(tiposCrudos));
    if (fallosPorTipo.size > 0) imprimirCenso('conversaciones que fallaron:', fallosPorTipo, aPedir.length);

    // ── LA SEGUNDA PREGUNTA: ¿SE PUEDE LLENAR `negocio.llamadas`? ──────────
    console.log(`\n  ┌─ REGISTROS DE LLAMADA (\`TYPE_CUSTOM_CALL\`): ${llamadas} ─────────────`);
    if (llamadas === 0) {
      console.log('  │  ninguno en esta muestra — la pregunta queda SIN CONTESTAR.');
    } else {
      imprimirCenso('claves presentes (sobre los registros de llamada):', clavesDeLlamada, llamadas, '  │    ');
      imprimirCenso('valores, sólo los que no pueden ser de nadie:', valoresDeLlamada, llamadas, '  │    ');
      console.log('  │');
      console.log('  │  `negocio.llamadas` necesita: externa_id, contacto_id, contestada, inicio_el,');
      console.log('  │  duracion_segundos, resumen. Lo que no aparezca arriba, no se puede llenar.');
    }
    console.log('  └──────────────────────────────────────────────────────────────────');

    console.log(`\n  usuarios distintos que sellan mensajes: ${usuarios.size}`);
    let i = 0;
    for (const [uid, n] of [...usuarios.entries()].sort((a, b) => b[1] - a[1])) {
      i++;
      console.log(`    ${(uid === idDelAgente ? `u${i} <AGENTE>` : `u${i}`).padEnd(16)} ${String(n).padStart(5)}`);
    }

    // ── LA TABLA QUE DECIDE ────────────────────────────────────────────────
    console.log('\n  ┌─ EL `source` DE NUESTRAS PROPIAS FILAS ───────────────────────────');
    for (const [duenio, mapa] of porDuenio) {
      const sub = totalDe(mapa);
      console.log(`  │\n  │  ${duenio} — ${sub} fila(s)`);
      imprimirCenso('', mapa, sub, '  │    ');
    }
    console.log('  └──────────────────────────────────────────────────────────────────');

    // ── EL VEREDICTO, CON SU DENOMINADOR A LA VISTA ────────────────────────
    const delAgente = porDuenio.get('ID DEL AGENTE');
    const nAgente = totalDe(delAgente);
    console.log('\n  VEREDICTO');
    if (nAgente === 0) {
      console.log('    SIN VEREDICTO — no se emparejó ni una fila sellada con el identificador del');
      console.log('    agente. La tabla de arriba NO contesta la pregunta: revisar el tope y los fallos.');
      continue;
    }
    const automaticos = [...delAgente.entries()].filter(([k]) => AUTOMATICOS.has(k));
    const nAuto = automaticos.reduce((a, [, n]) => a + n, 0);
    console.log(`    sobre ${nAgente} fila(s) con el identificador del agente, ${delAgente.size} valor(es) de \`source\`.`);
    if (nAuto > 0) {
      console.log(`    **HACE FALTA LA COLUMNA.** ${nAuto} (${((nAuto / nAgente) * 100).toFixed(1)} %) salieron de un`);
      console.log(`    flujo de la cuenta —${automaticos.map(([k, n]) => `${k}: ${n}`).join(', ')}—, sellados con`);
      console.log('    este usuario como DUEÑO y no como remitente. Filtrar por identificador mezcla al');
      console.log('    agente con las automatizaciones, y ninguna cifra por agente se sostiene sin `source`.');
    } else if (delAgente.size === 1) {
      console.log('    El identificador DISCRIMINA: un solo valor, y ninguno es de un flujo de la cuenta.');
      console.log('    Guardar `source` no agregaría nada que el identificador no diga ya.');
    } else {
      console.log('    Ningún flujo de la cuenta, pero más de un valor. La mezcla no está probada y la');
      console.log('    columna no es urgente: hay que mirar la tabla de arriba antes de decidir.');
    }

    /* La otra fila que también manda. Se declara de antemano qué significa cada resultado, para que
       el número no se interprete después de verlo. */
    const sinId = porDuenio.get('sin identificador');
    const nSinId = totalDe(sinId);
    if (nSinId > 0) {
      const nAutoSinId = [...sinId.entries()]
        .filter(([k]) => AUTOMATICOS.has(k))
        .reduce((a, [, n]) => a + n, 0);
      console.log(`\n    Y las ${nSinId} sin identificador, que hoy \`atribuir()\` manda a AUTOMATIZACIÓN:`);
      console.log(
        nAutoSinId / nSinId >= 0.5
          ? '    predominan los flujos de la cuenta — esa regla está bien y no hay nada que hacer.'
          : '    NO predominan los flujos: hay salientes sin sellar que la regla descarta mal.',
      );
    }
  }
}

try {
  await main();
} finally {
  await cerrarClientes();
}
