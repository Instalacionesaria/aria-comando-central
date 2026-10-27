// Traducir un valor del CRM al idioma común: la etapa de un pipeline o la Salida de una oportunidad.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES ESCALONES, Y DESPUÉS «SIN MAPEAR»
//
// El SOP fija que las etapas del Pipeline Maestro y las Salidas «son las mismas en todas las cuentas» y no se renombran.
// Así que el día 1 no hace falta sembrar ningún mapeo:
//
//   1. **Coincidencia directa.** El valor normalizado (`claveDelIdiomaComun`: minúsculas, sin tildes, espacios y guiones
//      a `_`) es una clave de `catalogo.etapas` o `catalogo.salidas`. «Asistió» → `asistio`, «No-show» → `no_show`.
//      Sólo vale para el Pipeline Maestro: quien llama dice si el valor viene de él (`directo`).
//   2. **El mapeo de la cuenta** (`negocio.mapeos_de_cuenta`): la agencia que agregó una etapa propia. Gana sobre el
//      del snapshot.
//   3. **El mapeo del snapshot** (`catalogo.mapeos_de_snapshot`, por `identidad.cuentas.snapshot_version_id`).
//
// Si ninguno traduce, el valor se cuenta en `negocio.valores_sin_mapear` (`apariciones + 1`) y la respuesta es nula. Un
// mapeo a `ignorar` es «reconocido y descartado a propósito»: no se cuenta como sin mapear.
//
// En los mapeos, `campo` es el pipeline de la etapa (o vacío = no depende del campo); se busca primero el del campo y
// después el vacío. El valor se busca TAL CUAL llegó (recortado), que es como lo guarda `valores_sin_mapear` y como se
// escribe el mapeo que lo resuelve.
//
// Lo que escribe —sólo `valores_sin_mapear`— va con `insertInto` (un `sql` crudo no recibe el org_id inyectado).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { claveDelIdiomaComun } from '../ghl/avisos.ts';
import { cuentaDe, type AmbitoDeUnCliente } from './ambitoDelCliente.ts';

/** Qué se traduce, de dónde y a qué catálogo. */
export interface PedidoDeTraduccion {
  /** La clave de `catalogo.tipos_de_mapeo`. */
  readonly tipo: 'etapa_del_pipeline' | 'salida_de_oportunidad';
  /** A qué campo pertenece el valor (el pipeline de la etapa). `''` = no depende del campo. */
  readonly campo: string;
  /** El valor tal cual llegó. */
  readonly valor: string;
  /** El catálogo de destino. */
  readonly catalogo: 'etapas' | 'salidas';
  /** ¿Se acepta la coincidencia directa con el catálogo? Sólo para el Pipeline Maestro. */
  readonly directo: boolean;
}

/** El resultado, con el motivo. */
export type Traduccion =
  | { readonly tipo: 'traducido'; readonly clave: string; readonly via: 'directo' | 'cuenta' | 'snapshot' }
  | { readonly tipo: 'ignorado' }
  | { readonly tipo: 'sin_mapear' };

const TOPE_DEL_VALOR = 300;
const TOPE_DEL_CAMPO = 200;

/** Un mapeo encontrado: a qué catálogo y clave apunta. */
interface Mapeo {
  destino_catalogo: string;
  destino_clave: string | null;
}

/** Lo que dice un mapeo para este pedido: traducido, ignorado, o nada (apunta a otro catálogo). */
function delMapeo(m: Mapeo | undefined, catalogo: string, via: 'cuenta' | 'snapshot'): Traduccion | null {
  if (!m) return null;
  if (m.destino_catalogo === 'ignorar') return { tipo: 'ignorado' };
  if (m.destino_catalogo === catalogo && m.destino_clave) return { tipo: 'traducido', clave: m.destino_clave, via };
  return null;
}

/**
 * Traduce, con el motivo. Abre su propia transacción en el ámbito del cliente: el conteo de `valores_sin_mapear` queda
 * aunque quien llama falle después, que es justo cuando más sirve.
 */
export async function traducirConMotivo(ambito: AmbitoDeUnCliente, p: PedidoDeTraduccion): Promise<Traduccion> {
  const valor = p.valor.trim().slice(0, TOPE_DEL_VALOR);
  const campo = p.campo.trim().slice(0, TOPE_DEL_CAMPO);
  if (valor === '') return { tipo: 'sin_mapear' };
  const clave = claveDelIdiomaComun(valor);

  return conOrganizacion(ambito, async () => {
    // 1 · La coincidencia directa. La tabla sale de una lista cerrada, nunca del pedido.
    if (p.directo && clave !== null) {
      const existe =
        p.catalogo === 'etapas'
          ? await sql<{ n: number }>`select count(*)::int as n from catalogo.etapas where clave = ${clave}`.execute(datos())
          : await sql<{ n: number }>`select count(*)::int as n from catalogo.salidas where clave = ${clave}`.execute(datos());
      if ((existe.rows[0]?.n ?? 0) > 0) return { tipo: 'traducido', clave, via: 'directo' } as const;
    }

    // 2 · El mapeo de la cuenta: el del campo antes que el vacío.
    const deLaCuenta = await datos()
      .selectFrom('mapeos_de_cuenta')
      .select(['destino_catalogo', 'destino_clave'])
      .where('tipo', '=', p.tipo)
      .where('valor_origen', '=', valor)
      .where('campo', 'in', campo === '' ? [''] : [campo, ''])
      .orderBy('campo', 'desc')
      .executeTakeFirst();
    const porCuenta = delMapeo(deLaCuenta, p.catalogo, 'cuenta');
    if (porCuenta) return porCuenta;

    // 3 · El mapeo del snapshot de este cliente.
    const delSnapshot = await sql<Mapeo>`
      select m.destino_catalogo, m.destino_clave
        from catalogo.mapeos_de_snapshot m
        join identidad.cuentas k on k.snapshot_version_id = m.snapshot_version_id
       where k.id = ${cuentaDe(ambito)}::uuid
         and m.tipo = ${p.tipo} and m.valor_origen = ${valor} and m.campo in (${campo}, '')
       order by m.campo desc
       limit 1`.execute(datos());
    const porSnapshot = delMapeo(delSnapshot.rows[0], p.catalogo, 'snapshot');
    if (porSnapshot) return porSnapshot;

    // 4 · Sin traducción: se cuenta. `+ 1` en SQL, para que dos avisos simultáneos sumen dos.
    await datos()
      .insertInto('valores_sin_mapear')
      .values({ tipo: p.tipo, campo, valor_origen: valor } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'cuenta_id', 'tipo', 'campo', 'valor_origen']).doUpdateSet({
          apariciones: sql`valores_sin_mapear.apariciones + 1`,
          ultima_vez_el: sql`now()`,
        } as never),
      )
      .execute();
    return { tipo: 'sin_mapear' } as const;
  });
}

/**
 * La clave del idioma común, o `null` si no se traduce (sin mapear, que queda contado, o ignorado a propósito).
 */
export async function traducir(ambito: AmbitoDeUnCliente, p: PedidoDeTraduccion): Promise<string | null> {
  const t = await traducirConMotivo(ambito, p);
  return t.tipo === 'traducido' ? t.clave : null;
}
