// La foto de los negocios: el ÚNICO escritor de `negocio.foto_de_las_empresas` y `negocio.foto_de_las_cuentas` (089).
//
// ═══════════════════════════════════════════════════════════════════════════════
// CÓMO SE TOMA
//
// Una vez por día, en la tarea `foto` del cron (`lib/negocio/barrido.ts`):
//
//   1. la configuración llega leída de identidad por quien llama (`leerLaConfiguracion`), sólo presencias;
//   2. cada empresa se mide en SU contexto (`conOrganizacion`), de a cuatro a la vez —el agrupador tiene cinco
//      conexiones, y el Panel de Monitoreo usa el mismo tope—. Una empresa que falla no frena a las demás: queda con
//      `medida = false` y su motivo, y sus cifras nulas;
//   3. todo se escribe en UNA transacción de la principal, con `on conflict`: dos corridas el mismo día dejan la
//      foto de la última, nunca dos filas.
//
// Lo que no guarda: nombres. Ni de las empresas ni de sus clientes —un consultorio se llama como su dueño—. El
// tablero los lee en vivo al dibujar.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos } from '../datos/contexto.ts';
import type { ConfiguracionDeLosNegocios, ConfiguracionDeUnaEmpresa } from './configuracion.ts';
import { CONTRATO_DE_LA_FOTO } from './contrato.ts';
import { medirLaEmpresa, MEDIDA_SIN_FILAS, type MedidaDeUnaEmpresa } from './medicion.ts';
import {
  PASOS_DE_LA_EMPRESA,
  PASOS_DEL_CLIENTE,
  clienteConfigurado,
  configurado,
  faltan,
  pasosDeLaEmpresa,
  pasosDelCliente,
} from './pasos.ts';

/** La fila sin `org_id`: es la llave de aislamiento y no se actualiza (la inyecta la capa de datos). */
function sinLaOrganizacion<T extends { org_id: string }>(fila: T): Omit<T, 'org_id'> {
  const { org_id: _organizacion, ...resto } = fila;
  return resto;
}

/** Cuántas empresas se miden a la vez. El agrupador del inquilino tiene cinco conexiones (`lib/datos/capa.ts`). */
export const A_LA_VEZ = 4;

export interface ResumenDeLaFoto {
  dia: string;
  empresas: number;
  clientes: number;
  sinMedir: number;
}

/** El día de la foto: el de hoy en la zona de la principal, en `AAAA-MM-DD`. */
export function diaDeLaFoto(zona: string, ahora: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date(ahora));
}

/** El nicho de una empresa: el fijado a mano, o el más común entre sus clientes confirmados (empate: el menor). */
export function nichoDeLaEmpresa(e: ConfiguracionDeUnaEmpresa): { nicho: string | null; origen: 'fijado' | 'calculado' | null } {
  if (e.nichoPrincipal) return { nicho: e.nichoPrincipal, origen: 'fijado' };
  const cuenta = new Map<string, number>();
  for (const c of e.clientes) {
    if (c.nicho && c.nichoConfirmado && !c.esPrueba && c.estado !== 'baja') cuenta.set(c.nicho, (cuenta.get(c.nicho) ?? 0) + 1);
  }
  const [mejor] = [...cuenta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return mejor ? { nicho: mejor[0], origen: 'calculado' } : { nicho: null, origen: null };
}

/** Las filas de una empresa y de sus clientes. Pura: lo prueba la 270 sin base. */
export function filasDeUnaEmpresa(
  e: ConfiguracionDeUnaEmpresa,
  medida: MedidaDeUnaEmpresa | null,
  motivo: string | null,
  principal: string,
  dia: string,
  ahora: number,
) {
  const base = { org_id: principal, dia, organizacion_ref: e.id, contrato: CONTRATO_DE_LA_FOTO };
  const clientes = e.clientes.map((c) => {
    const m = medida ? (medida.porCliente.get(c.id) ?? MEDIDA_SIN_FILAS) : null;
    const pasos = pasosDelCliente(c, m ?? undefined, ahora);
    return {
      ...base,
      cuenta_ref: c.id,
      estado: c.estado,
      es_prueba: c.esPrueba,
      es_por_omision: c.esPorOmision,
      nicho: c.nicho,
      nicho_confirmado: c.nichoConfirmado,
      modelo_de_negocio: c.modeloDeNegocio,
      pais: c.pais,
      moneda: c.moneda,
      zona_horaria: c.zonaHoraria,
      alta_el: c.altaEl,
      crm_vinculado: c.crmVinculado,
      crm_conectado: c.crmConectado,
      calendario: c.calendario,
      meta: c.meta,
      aviso_del_crm: c.aviso,
      configurada: clienteConfigurado(c.estado, pasos),
      faltan: faltan(pasos, PASOS_DEL_CLIENTE),
      medida: m !== null,
      motivo_sin_medir: m === null ? motivo : null,
      contactos: m?.contactos ?? null,
      contactos_nuevos_30d: m?.contactosNuevos30d ?? null,
      contactos_nuevos_30d_previos: m?.contactosNuevos30dPrevios ?? null,
      agendaron_30d: m?.agendaron30d ?? null,
      calificados_30d: m?.calificados30d ?? null,
      ventas_30d: m?.ventas30d ?? null,
      ventas_30d_previas: m?.ventas30dPrevias ?? null,
      monto_30d: m?.monto30d ?? null,
      compradores: m?.compradores ?? null,
      gasto_30d: m?.gasto30d ?? null,
      ultima_ingesta_el: m?.ultimaIngestaEl ?? null,
      ultima_alta_el: m?.ultimaAltaEl ?? null,
      // Desde el contrato 2 (la `099`): requerido para `configurada`. Nulo = no se sabe, o la empresa no se midió.
      meta_en_el_crm: m?.metaEnElCrm ?? null,
    };
  });

  // Los agregados de la empresa, sólo de sus clientes reales: los de prueba no entran a ninguna cifra agregada.
  const reales = clientes.filter((c) => !c.es_prueba);
  const suma = (k: 'contactos' | 'contactos_nuevos_30d' | 'ventas_30d') =>
    medida ? reales.reduce((s, c) => s + (c[k] ?? 0), 0) : null;
  const configurados = reales.filter((c) => c.configurada).length;
  const pasos = pasosDeLaEmpresa(e, configurados);
  const { nicho, origen } = nichoDeLaEmpresa(e);
  const empresa = {
    ...base,
    es_principal: e.esPrincipal,
    activa: e.activa,
    pais: e.pais,
    nicho,
    nicho_origen: origen,
    precio_mensual: e.precioMensual,
    zona_horaria: e.zonaHoraria,
    alta_el: e.altaEl,
    usuarios: e.usuarios,
    usuarios_limitados: e.usuariosLimitados,
    cuentas_activas: e.clientes.filter((c) => c.estado === 'activa' && !c.esPrueba).length,
    cuentas_pausadas: e.clientes.filter((c) => c.estado === 'pausada' && !c.esPrueba).length,
    cuentas_de_baja: e.clientes.filter((c) => c.estado === 'baja' && !c.esPrueba).length,
    cuentas_de_prueba: e.clientes.filter((c) => c.esPrueba).length,
    cuentas_configuradas: configurados,
    llave_de_ia: e.llaveDeIa,
    configurada: configurado(pasos, PASOS_DE_LA_EMPRESA),
    faltan: faltan(pasos, PASOS_DE_LA_EMPRESA),
    medida: medida !== null,
    motivo_sin_medir: medida === null ? motivo : null,
    contactos: suma('contactos'),
    contactos_nuevos_30d: suma('contactos_nuevos_30d'),
    ventas_30d: suma('ventas_30d'),
    ia_llamadas_30d: medida?.iaLlamadas30d ?? null,
    incidentes_30d: medida?.incidentes30d ?? null,
    senales_abiertas: medida?.senalesAbiertas ?? null,
  };
  return { empresa, clientes };
}

/**
 * Toma la foto de hoy y la guarda. **Corre FUERA de todo contexto**: abre uno por empresa para medir, y uno de la
 * principal para escribir.
 *
 * @param medir inyectable para las pruebas (una empresa que falla).
 */
export async function tomarLaFoto(
  config: ConfiguracionDeLosNegocios,
  ahora: number = Date.now(),
  medir: (orgId: string) => Promise<MedidaDeUnaEmpresa> = (orgId) => conOrganizacion(orgId, medirLaEmpresa),
): Promise<ResumenDeLaFoto> {
  const dia = diaDeLaFoto(config.principal.zonaHoraria, ahora);
  const filas: ReturnType<typeof filasDeUnaEmpresa>[] = [];
  let sinMedir = 0;
  for (let i = 0; i < config.empresas.length; i += A_LA_VEZ) {
    const tanda = config.empresas.slice(i, i + A_LA_VEZ);
    const medidas = await Promise.all(
      tanda.map(async (e) => {
        if (!e.activa) return { e, medida: null, motivo: 'la empresa está desactivada' };
        try {
          return { e, medida: await medir(e.id), motivo: null };
        } catch (err) {
          console.error(`foto: no se pudo medir la empresa ${e.id}`, err);
          return { e, medida: null, motivo: 'no se pudo medir' };
        }
      }),
    );
    for (const { e, medida, motivo } of medidas) {
      if (medida === null) sinMedir += 1;
      filas.push(filasDeUnaEmpresa(e, medida, motivo, config.principal.id, dia, ahora));
    }
  }

  await conOrganizacion(config.principal.id, async () => {
    for (const { empresa, clientes } of filas) {
      await datos()
        .insertInto('foto_de_las_empresas')
        .values(empresa)
        .onConflict((oc) => oc.columns(['org_id', 'dia', 'organizacion_ref']).doUpdateSet(sinLaOrganizacion(empresa)))
        .execute();
      for (const c of clientes) {
        await datos()
          .insertInto('foto_de_las_cuentas')
          .values(c)
          .onConflict((oc) => oc.columns(['org_id', 'dia', 'cuenta_ref']).doUpdateSet(sinLaOrganizacion(c)))
          .execute();
      }
    }
  });
  return { dia, empresas: filas.length, clientes: filas.reduce((s, f) => s + f.clientes.length, 0), sinMedir };
}
