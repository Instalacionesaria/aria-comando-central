// ¿GoHighLevel entrega la miniatura y el video de cada anuncio? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA, Y POR QUÉ SE VUELVE A HACER
//
// El 2026-09-18 se midió que no (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`, C14-07 y
// C14-08): `/entity?entityType=AD` trae cuatro claves y `/creatives`, `/ads` y `/campaigns` dan 404.
// Pero esa medición dejó afuera una ruta que la especificación pública de GoHighLevel SÍ documenta
// —`GET /ad-publishing/facebook/campaign/{campaignId}`, «Get campaign with linked entities», con
// `fields` y `source`— y el valor `type=AD_MANAGER` de `/entity`, que es donde viven las campañas
// creadas DESDE el Ad Manager del CRM. El esquema de `PUT /ads-v2` dice qué guarda GoHighLevel de
// esos anuncios: `imageUrl`, `mediaType`, `primaryText`, `headline` y `media[]` con `src` y
// `thumbnailUrl`. Si alguna lectura lo devuelve, la miniatura y el video salen del CRM y no hace
// falta conectar Meta por segunda vez (docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md).
//
//   node --env-file=.env.supabase scripts/medir-activos-en-ghl.mjs
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// **Sólo lee**: todo pasa por `leer()`, que llama a `pedirExterno` sin `metodo` —o sea `GET`— y no
// hay otra salida. No escribe en la base ni en disco. No imprime valores: de cada respuesta salen el
// estado, la UNIÓN DE CLAVES (con su camino, `ads[].media[].src`) y, de cada texto con forma de URL,
// sólo el HOST y si trae la firma `oe=` del CDN de Meta. Una URL firmada es una llave del archivo y
// el repositorio fue público. Tampoco se imprimen ids: las campañas y anuncios se nombran por su
// número de orden. El texto de un 422 sí se imprime, porque es la validación de la PETICIÓN
// («listType must be a valid enum value»), no un dato.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

const BASE = 'https://services.leadconnectorhq.com/ad-publishing/facebook';
const VERSION = '2021-07-28';
const DESDE = '2026-07-01';
const HASTA = '2026-09-29';
/** Cuántas campañas se prueban en la ruta que nunca se probó. */
const CAMPANAS = 3;

/** Una clave con forma de secreto se nombra, pero se marca y nunca se sigue. */
const SECRETO = /token|secret|access|password|cookie/i;

async function leer(camino, token) {
  const r = await pedirExterno(`${BASE}${camino}`, {
    cabeceras: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' },
  });
  return r;
}

/** La unión de claves de un valor, con camino, hasta cinco niveles. Los arreglos se funden en `[]`. */
function claves(valor, prefijo = '', salida = new Map(), nivel = 0) {
  if (nivel > 5 || valor === null || typeof valor !== 'object') return salida;
  if (Array.isArray(valor)) {
    for (const v of valor.slice(0, 50)) claves(v, `${prefijo}[]`, salida, nivel + 1);
    return salida;
  }
  for (const [k, v] of Object.entries(valor)) {
    const camino = prefijo ? `${prefijo}.${k}` : k;
    if (SECRETO.test(k)) {
      salida.set(`${camino} (forma de secreto: no se sigue)`, (salida.get(camino) ?? 0) + 1);
      continue;
    }
    const tipo = v === null ? 'null' : Array.isArray(v) ? 'arreglo' : typeof v;
    const ya = salida.get(camino);
    salida.set(camino, ya ? `${ya}` : tipo);
    claves(v, camino, salida, nivel + 1);
  }
  return salida;
}

/** Los hosts de todos los textos con forma de URL, y cuántos traen la firma `oe=`. */
function hosts(valor, salida = new Map(), nivel = 0) {
  if (nivel > 7 || valor === null) return salida;
  if (typeof valor === 'string') {
    if (/^https?:\/\//.test(valor)) {
      try {
        const u = new URL(valor);
        const k = `${u.host}${u.searchParams.has('oe') ? ' (firmada: oe=)' : ''}`;
        salida.set(k, (salida.get(k) ?? 0) + 1);
      } catch {
        salida.set('(url ilegible)', (salida.get('(url ilegible)') ?? 0) + 1);
      }
    }
    return salida;
  }
  if (typeof valor !== 'object') return salida;
  for (const [k, v] of Object.entries(valor)) {
    if (SECRETO.test(k)) continue;
    hosts(v, salida, nivel + 1);
  }
  return salida;
}

function mostrar(titulo, r) {
  if (r.tipo === 'datos') {
    const c = claves(r.datos);
    const h = hosts(r.datos);
    console.log(`  ${titulo} → 200 · ${c.size} claves`);
    for (const [k, t] of c) console.log(`      ${k}: ${t}`);
    if (h.size) console.log(`    hosts: ${[...h].map(([k, n]) => `${k} ×${n}`).join(' · ')}`);
    return r.datos;
  }
  if (r.tipo === 'rechazado') {
    console.log(`  ${titulo} → ${r.estado}${r.detalle ? ` · «${String(r.detalle).slice(0, 220)}»` : ''}`);
  } else {
    console.log(`  ${titulo} → sin respuesta (${r.causa})`);
  }
  return null;
}

/** Lista de objetos de una respuesta que puede venir como arreglo o envuelta. */
function lista(datos) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === 'object') {
    for (const k of ['data', 'items', 'results', 'entities', 'campaigns', 'list', 'grouped']) {
      if (Array.isArray(datos[k])) return datos[k];
    }
  }
  return [];
}

function idDe(o, ...nombres) {
  for (const n of nombres) if (o && typeof o[n] === 'string' && o[n]) return o[n];
  return null;
}

async function main() {
  const orgs = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).orderBy('nombre').execute(),
  );

  for (const org of orgs) {
    const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, org.id));
    if (acceso.tipo !== 'listo') continue;
    const loc = `locationId=${encodeURIComponent(acceso.locationId)}`;
    const t = acceso.token;
    console.log(`\n═══ ${org.nombre} ═══`);

    // ── 0 · Qué hay: campañas por origen ───────────────────────────────────
    console.log('\n[0] Campañas por origen');
    const porOrigen = {};
    for (const tipo of ['INTEGRATION', 'AD_MANAGER']) {
      for (const nivel of ['CAMPAIGN', 'AD']) {
        const r = await leer(`/entity?${loc}&type=${tipo}&entityType=${nivel}`, t);
        const n = r.tipo === 'datos' ? lista(r.datos).length : null;
        console.log(`  /entity type=${tipo} entityType=${nivel} → ${r.tipo === 'datos' ? `200 · ${n} entidades (1ª página)` : r.estado ?? r.causa}`);
        if (r.tipo === 'datos') porOrigen[`${tipo}/${nivel}`] = lista(r.datos);
      }
    }
    const listado = await leer(
      `/reporting/list?${loc}&listType=campaigns&type=INTEGRATION&startDate=${DESDE}&endDate=${HASTA}`,
      t,
    );
    const campanasInt = listado.tipo === 'datos' ? lista(listado.datos) : [];
    console.log(`  /reporting/list campaigns INTEGRATION → ${listado.tipo === 'datos' ? `${campanasInt.length} campañas` : listado.estado}`);

    const candidatas = [
      ...(porOrigen['AD_MANAGER/CAMPAIGN'] ?? []).map((c) => ({ origen: 'AD_MANAGER', id: idDe(c, 'campaignId', 'id') })),
      ...campanasInt.map((c) => ({ origen: 'INTEGRATION', id: idDe(c, 'campaignId', 'id') })),
    ].filter((c) => c.id);
    const aProbar = [
      ...candidatas.filter((c) => c.origen === 'AD_MANAGER').slice(0, CAMPANAS),
      ...candidatas.filter((c) => c.origen === 'INTEGRATION').slice(0, CAMPANAS),
    ];

    // ── A · La ruta que nunca se probó ─────────────────────────────────────
    console.log('\n[A] GET /campaign/{campaignId}');
    const variantes = [
      '',
      '&fields=adsets,ads',
      '&fields=adsets,ads&source=facebook',
      '&fields=ads&source=INTEGRATION',
      '&fields=ads&source=AD_MANAGER',
      '&fields=ads{creative}',
      '&fields=ads{creative{thumbnail_url,video_id,effective_object_story_id}}',
      '&fields=creative',
      '&fields=zz_campo_inventado',
    ];
    let unAnuncio = null;
    for (const [i, c] of aProbar.entries()) {
      console.log(`\n  · campaña ${i + 1} (${c.origen})`);
      for (const v of variantes) {
        const r = await leer(`/campaign/${encodeURIComponent(c.id)}?${loc}${v}`, t);
        const d = mostrar(`campaign${v || ' (sin fields)'}`, r);
        if (!unAnuncio && d) {
          const ads = lista(d.ads ?? d.data?.ads ?? []);
          const a = ads.find((x) => idDe(x, 'adId', 'id'));
          if (a) unAnuncio = idDe(a, 'adId', 'id');
        }
      }
    }

    // ── B · El reporte por campaña ─────────────────────────────────────────
    console.log('\n[B] GET /reporting/campaign/{campaignId}');
    for (const [i, c] of aProbar.slice(0, 2).entries()) {
      const r = await leer(`/reporting/campaign/${encodeURIComponent(c.id)}?${loc}&startDate=${DESDE}&endDate=${HASTA}`, t);
      mostrar(`campaña ${i + 1} (${c.origen})`, r);
    }

    // ── C · /entity con lo que no se probó ─────────────────────────────────
    console.log('\n[C] /entity con parámetros no probados');
    const primera = aProbar.find((c) => c.origen === 'INTEGRATION') ?? aProbar[0];
    for (const extra of [
      '&type=INTEGRATION&entityType=AD&fetchAll=true',
      primera ? `&type=INTEGRATION&entityType=AD&campaignId=${encodeURIComponent(primera.id)}` : null,
      '&type=AD_MANAGER&entityType=AD&fetchAll=true',
      '&type=AD_MANAGER&entityType=ADSET',
    ].filter(Boolean)) {
      const r = await leer(`/entity?${loc}${extra}`, t);
      mostrar(`entity${extra.replace(/campaignId=[^&]+/, 'campaignId=…')}`, r);
    }
    if (!unAnuncio) {
      const ads = porOrigen['INTEGRATION/AD'] ?? [];
      unAnuncio = ads.map((a) => idDe(a, 'adId', 'id')).find(Boolean) ?? null;
    }

    // ── D · Los enums que dicen los 422 ────────────────────────────────────
    console.log('\n[D] Enums (el texto del 422 los nombra)');
    for (const extra of ['&type=INTEGRATION&entityType=CREATIVE', '&type=ZZ&entityType=AD', '&type=INTEGRATION&entityType=POST']) {
      mostrar(`entity${extra}`, await leer(`/entity?${loc}${extra}`, t));
    }

    // ── E · Detalle por entidad ────────────────────────────────────────────
    console.log('\n[E] Detalle por anuncio');
    if (unAnuncio) {
      const a = encodeURIComponent(unAnuncio);
      for (const camino of [
        `/entity/${a}?${loc}`,
        `/entity/${a}?${loc}&type=INTEGRATION&entityType=AD`,
        `/ads/${a}?${loc}`,
        `/ad/${a}?${loc}`,
        `/ads-v2/${a}?${loc}`,
        `/ads/${a}/preview?${loc}`,
        `/ad/${a}/preview?${loc}`,
      ]) {
        mostrar(camino.replace(a, '{adId}').replace(/locationId=[^&]+/, 'locationId=…'), await leer(camino, t));
      }
    } else {
      console.log('  sin anuncio para probar');
    }

    // ── F · Página, Instagram, usuario, cuenta ────────────────────────────
    console.log('\n[F] Página, Instagram, usuario y cuenta');
    const integ = await leer(`/integration?${loc}`, t);
    const integD = mostrar('integration', integ);
    const paginas = await leer(`/pages?${loc}`, t);
    const pagD = mostrar('pages', paginas);
    const pagina = lista(pagD)[0] ?? (Array.isArray(integD?.pages) ? integD.pages[0] : null);
    const pageId = idDe(pagina, 'pageId', 'id');
    if (pageId) mostrar('page/{pageId}/instagram', await leer(`/page/${encodeURIComponent(pageId)}/instagram?${loc}`, t));
    mostrar('me', await leer(`/me?${loc}`, t));
    const cuenta = idDe(integD, 'fbAdAccountId');
    if (cuenta) mostrar('ad-accounts/{id}', await leer(`/ad-accounts/${encodeURIComponent(cuenta)}?${loc}`, t));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarClientes());
