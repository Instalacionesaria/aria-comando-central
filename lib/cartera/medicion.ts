// Las cifras de una empresa, por cliente: lo que la foto de los negocios guarda cada día.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CÓMO SE MIDE, Y CON QUÉ REGLAS
//
// Corre DENTRO de `conOrganizacion` de la empresa, con la organización entera y todas sus cuentas: la base filtra a
// la empresa, y cada consulta agrupa por `cuenta_id`. Son pocas consultas agrupadas y no las funciones de cada
// pantalla por cliente: la foto recorre todas las empresas en una corrida del cron, y diez lecturas de pantalla por
// cliente no entrarían en su tiempo.
//
// Las mismas reglas que las pantallas, con las mismas piezas:
//   · la cohorte es por `alta_en_el_crm` (regla 5), nunca por `creado_el`;
//   · «agendó» y «calificado» son los predicados compartidos de `lib/negocio/citasAlcanzables.ts` (regla 12): una
//     copia acá diría «35 calificados» de gente distinta que la pantalla;
//   · nulo no es cero: un cliente sin serie de gasto tiene gasto nulo, no cero; un cliente sin filas no aparece y
//     la foto lo dice con su configuración.
//
// Lo que la lista de chequeo MIDE —la marca de la ingesta y Meta en su GoHighLevel— sale de `medirLosPasos`, que usan
// también Ajustes › Clientes en vivo: la foto y la pantalla lo miden igual.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { esCalificado, tieneCitaAlcanzable } from '../negocio/citasAlcanzables.ts';
import { MOTIVO_META_RECHAZADA } from '../negocio/faltaDeLosClientes.ts';
import { VENTANA_DIAS } from './contrato.ts';
import type { LoMedidoDeUnCliente } from './pasos.ts';

export interface MedidaDeUnCliente {
  contactos: number;
  contactosNuevos30d: number;
  contactosNuevos30dPrevios: number;
  agendaron30d: number;
  calificados30d: number;
  ventas30d: number;
  ventas30dPrevias: number;
  /** En la moneda del cliente, como texto (numeric). Nulo si ninguna venta trae monto. */
  monto30d: string | null;
  compradores: number;
  /** Nulo = no hay serie de gasto. */
  gasto30d: string | null;
  ultimaIngestaEl: Date | null;
  ultimaAltaEl: Date | null;
  /** Si su GoHighLevel tiene Meta vinculado (`metaLeidoDe`). Nulo = todavía no se sabe. */
  metaLeido: boolean | null;
}

export interface MedidaDeUnaEmpresa {
  porCliente: Map<string, MedidaDeUnCliente>;
  iaLlamadas30d: number;
  incidentes30d: number;
  senalesAbiertas: number;
}

const VACIA: MedidaDeUnCliente = {
  contactos: 0,
  contactosNuevos30d: 0,
  contactosNuevos30dPrevios: 0,
  agendaron30d: 0,
  calificados30d: 0,
  ventas30d: 0,
  ventas30dPrevias: 0,
  monto30d: null,
  compradores: 0,
  gasto30d: null,
  ultimaIngestaEl: null,
  ultimaAltaEl: null,
  metaLeido: null,
};

/**
 * Si las campañas de un cliente se están leyendo de Meta (Meta directo), con lo que ya está escrito. Pura.
 *
 *   · el sello de su pasada de anuncios (`anuncios`, una vez al día) es la respuesta: `corrio` sin que Meta rechazara
 *     la conexión (`MOTIVO_META_RECHAZADA`, que el barrido deja en el motivo) = sí; `saltada` (sin Meta conectado, o con
 *     la conexión caída) o `fallo` (Meta no devolvió nada) = no;
 *   · sin sello —nunca corrió, o quedó `sin_tiempo` o `frenada`, que no dicen nada—, su gasto en la ventana: el gasto
 *     sólo entra por su conexión con Meta, así que tenerlo es que se lee;
 *   · sin ninguna de las dos, no se sabe (`null`): la lista lo deja `sin_medir`, no lo acusa.
 *
 * El sello gana sobre el gasto: un cliente que desconectó Meta conserva días viejos en la ventana.
 */
export function metaLeidoDe(
  sello: { estado: string; motivo: string | null } | undefined,
  conSerieDeGasto: boolean,
): boolean | null {
  if (sello?.estado === 'corrio') return !(sello.motivo ?? '').includes(MOTIVO_META_RECHAZADA);
  if (sello?.estado === 'saltada' || sello?.estado === 'fallo') return false;
  return conSerieDeGasto ? true : null;
}

/**
 * Lo que la lista de chequeo mide en la base, por cliente: la marca de agua de su ingesta y si sus campañas se están
 * leyendo de Meta. Un cliente sin ninguna fila sale con la marca nula y Meta sin saber. **Corre dentro de
 * `conOrganizacion` con la organización entera.** La usan la foto (`medirLaEmpresa`) y la lista en vivo de Ajustes ›
 * Clientes (`app/api/admin/cuentas/route.ts`).
 */
export async function medirLosPasos(): Promise<Map<string, LoMedidoDeUnCliente>> {
  const clientes = await datos().selectFrom('cuentas').select(['id', 'es_por_omision']).execute();
  const pulso = await sql<{ cuenta_id: string; marca: Date | null }>`
    select p.cuenta_id, max(p.marca_el) as marca from negocio.ingesta_pulso p group by p.cuenta_id`.execute(datos());
  const conSerie = await sql<{ cuenta_id: string }>`
    select distinct g.cuenta_id from negocio.gasto_de_la_cuenta g where g.fecha >= current_date - ${VENTANA_DIAS}::int`.execute(
    datos(),
  );
  const sellos = await datos()
    .selectFrom('tareas_programadas')
    .select(['cuenta_id', 'ultimo_estado', 'ultimo_motivo'])
    .where('tarea', '=', 'anuncios')
    .execute();

  const marcas = new Map(pulso.rows.map((f) => [f.cuenta_id, f.marca]));
  const serie = new Set(conSerie.rows.map((f) => f.cuenta_id));
  const medidos = new Map<string, LoMedidoDeUnCliente>();
  for (const c of clientes) {
    /* El sello del cliente. El principal sin sello propio toma el sin cuenta, como la frescura y los avisos
       (`faltaDelGastoDe`): los de antes del barrido por cliente eran del trabajo con las credenciales de la empresa. */
    const sello =
      sellos.find((s) => s.cuenta_id === c.id) ?? (c.es_por_omision ? sellos.find((s) => s.cuenta_id === null) : undefined);
    medidos.set(c.id, {
      ultimaIngestaEl: marcas.get(c.id) ?? null,
      metaLeido: metaLeidoDe(sello && { estado: sello.ultimo_estado, motivo: sello.ultimo_motivo }, serie.has(c.id)),
    });
  }
  return medidos;
}

/** Mide la empresa del contexto. **Corre dentro de `conOrganizacion` con la organización entera.** */
export async function medirLaEmpresa(): Promise<MedidaDeUnaEmpresa> {
  const dias = VENTANA_DIAS;
  const enVentana = sql`c.alta_en_el_crm >= now() - make_interval(days => ${dias})`;
  const contactos = await sql<{
    cuenta_id: string;
    contactos: number;
    nuevos: number;
    previos: number;
    agendaron: number;
    calificados: number;
    ultima_alta: Date | null;
  }>`
    select c.cuenta_id,
           count(*)::int as contactos,
           count(*) filter (where ${enVentana})::int as nuevos,
           count(*) filter (where c.alta_en_el_crm >= now() - make_interval(days => ${dias * 2})
                              and c.alta_en_el_crm < now() - make_interval(days => ${dias}))::int as previos,
           count(*) filter (where ${enVentana} and ${tieneCitaAlcanzable('c')})::int as agendaron,
           count(*) filter (where ${enVentana} and ${esCalificado('c')})::int as calificados,
           max(c.alta_en_el_crm) as ultima_alta
      from negocio.contactos c
     group by c.cuenta_id`.execute(datos());

  const ventas = await sql<{ cuenta_id: string; ventas: number; previas: number; monto: string | null; compradores: number }>`
    select r.cuenta_id,
           count(*) filter (where r.salida = 'venta' and r.creado_el >= now() - make_interval(days => ${dias}))::int as ventas,
           count(*) filter (where r.salida = 'venta' and r.creado_el >= now() - make_interval(days => ${dias * 2})
                              and r.creado_el < now() - make_interval(days => ${dias}))::int as previas,
           (sum(r.monto::numeric) filter (where r.salida = 'venta' and r.creado_el >= now() - make_interval(days => ${dias})))::text
             as monto,
           count(distinct r.contacto_id) filter (where r.salida = 'venta')::int as compradores
      from negocio.resultados r
     group by r.cuenta_id`.execute(datos());

  const gasto = await sql<{ cuenta_id: string; gasto: string | null }>`
    select g.cuenta_id, (sum(g.gasto::numeric))::text as gasto
      from negocio.gasto_de_la_cuenta g
     where g.fecha >= current_date - ${dias}::int
     group by g.cuenta_id`.execute(datos());

  const pasos = await medirLosPasos();

  const empresa = await sql<{ ia: number; incidentes: number; senales: number }>`
    select (select count(*)::int from negocio.uso_de_ia u where u.creado_el >= now() - make_interval(days => ${dias})) as ia,
           (select count(*)::int from negocio.incidentes i where i.creado_el >= now() - make_interval(days => ${dias})) as incidentes,
           (select count(*)::int from negocio.senales s where s.estado in ('abierta', 'vista')) as senales`.execute(datos());

  const porCliente = new Map<string, MedidaDeUnCliente>();
  const de = (id: string): MedidaDeUnCliente => {
    let m = porCliente.get(id);
    if (!m) {
      m = { ...VACIA };
      porCliente.set(id, m);
    }
    return m;
  };
  for (const f of contactos.rows) {
    Object.assign(de(f.cuenta_id), {
      contactos: f.contactos,
      contactosNuevos30d: f.nuevos,
      contactosNuevos30dPrevios: f.previos,
      agendaron30d: f.agendaron,
      calificados30d: f.calificados,
      ultimaAltaEl: f.ultima_alta,
    });
  }
  for (const f of ventas.rows) {
    Object.assign(de(f.cuenta_id), { ventas30d: f.ventas, ventas30dPrevias: f.previas, monto30d: f.monto, compradores: f.compradores });
  }
  for (const f of gasto.rows) de(f.cuenta_id).gasto30d = f.gasto;
  for (const [id, m] of pasos) Object.assign(de(id), { ultimaIngestaEl: m.ultimaIngestaEl, metaLeido: m.metaLeido });
  const e = empresa.rows[0]!;
  return { porCliente, iaLlamadas30d: e.ia, incidentes30d: e.incidentes, senalesAbiertas: e.senales };
}

/** La medida de un cliente sin ninguna fila: ceros medidos y lo demás nulo. */
export const MEDIDA_SIN_FILAS: Readonly<MedidaDeUnCliente> = VACIA;
