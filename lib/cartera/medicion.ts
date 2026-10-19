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
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { esCalificado, tieneCitaAlcanzable } from '../negocio/citasAlcanzables.ts';
import { VENTANA_DIAS } from './contrato.ts';

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
};

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

  const pulso = await sql<{ cuenta_id: string; marca: Date | null }>`
    select p.cuenta_id, max(p.marca_el) as marca from negocio.ingesta_pulso p group by p.cuenta_id`.execute(datos());

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
  for (const f of pulso.rows) de(f.cuenta_id).ultimaIngestaEl = f.marca;
  const e = empresa.rows[0]!;
  return { porCliente, iaLlamadas30d: e.ia, incidentes30d: e.incidentes, senalesAbiertas: e.senales };
}

/** La medida de un cliente sin ninguna fila: ceros medidos y lo demás nulo. */
export const MEDIDA_SIN_FILAS: Readonly<MedidaDeUnCliente> = VACIA;
