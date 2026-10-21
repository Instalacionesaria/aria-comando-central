// La configuración de todas las empresas y sus clientes, leída de identidad: qué tienen cargado, no qué valor tiene.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA SEGUNDA CONSULTA QUE CRUZA ORGANIZACIONES, Y CON QUÉ LÍMITES
//
// `listarOrganizaciones` (`lib/administracion/organizaciones.ts`) se declaraba la única consulta que cruza
// organizaciones a propósito. Ésta es la segunda: el tablero de Negocios y la foto diaria necesitan saber, de cada
// empresa y cada cliente, si están configurados. Corre con la `Trx` de identidad que le pasa quien llama (el cron o
// la ruta del tablero, que están en `pruebas/apoyo/autorizados.ts`), y tiene tres límites que no se negocian:
//
//   · sólo PRESENCIAS (`is not null`) y el estado del token: nunca un valor cifrado, nunca `resolverCredenciales`,
//     que descifra. Un tablero no necesita el token para saber que está;
//   · sólo columnas con nombre, nunca `select *` (en `usuarios` vive `password_raw`, escrita por otro servicio);
//   · sin las organizaciones de control de la sonda (`SLUGS_DE_CONTROL`), con la misma constante que
//     `listarOrganizaciones`: dos listas que tienen que coincidir se desincronizan.
//
// Las credenciales de la cuenta por omisión salen de `organizaciones_credenciales`, que es donde las escribe Ajustes ›
// Credenciales; las de los demás clientes, de `cuentas_credenciales`. Es la regla de los resolvedores
// (`lib/credenciales/resolver.ts`): el principal usa las de la empresa, y los demás las suyas.
//
// La lista de chequeo en vivo de Ajustes › Clientes lee lo mismo de UNA empresa (`leerLosClientesDe`): la misma
// consulta, con la empresa en el `where`, porque corre con la `Trx` de identidad y sin la política que la acote.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import type { Trx } from '../datos/capa.ts';
import { SLUGS_DE_CONTROL } from '../deteccion/sonda.ts';

export interface ConfiguracionDeUnCliente {
  id: string;
  nombre: string;
  estado: 'activa' | 'pausada' | 'baja';
  esPrueba: boolean;
  esPorOmision: boolean;
  nicho: string | null;
  nichoConfirmado: boolean;
  modeloDeNegocio: string | null;
  pais: string | null;
  moneda: string | null;
  zonaHoraria: string;
  altaEl: Date;
  crmVinculado: boolean;
  crmConectado: boolean;
  calendario: boolean;
  meta: boolean;
  aviso: boolean;
}

export interface ConfiguracionDeUnaEmpresa {
  id: string;
  slug: string;
  nombre: string;
  activa: boolean;
  esPrincipal: boolean;
  pais: string | null;
  nichoPrincipal: string | null;
  precioMensual: string | null;
  zonaHoraria: string;
  altaEl: Date;
  llaveDeIa: boolean;
  usuarios: number;
  usuariosLimitados: number;
  clientes: ConfiguracionDeUnCliente[];
}

export interface ConfiguracionDeLosNegocios {
  /** La organización principal: la dueña de la foto. */
  principal: { id: string; zonaHoraria: string };
  empresas: ConfiguracionDeUnaEmpresa[];
}

/** Lee la configuración de todas las empresas y sus clientes. **Con la `Trx` de identidad.** */
export async function leerLaConfiguracion(db: Trx): Promise<ConfiguracionDeLosNegocios> {
  const empresas = (
    await sql<{
      id: string;
      slug: string;
      nombre: string;
      activa: boolean;
      es_principal: boolean;
      pais: string | null;
      nicho_principal: string | null;
      precio_mensual: string | null;
      zona_horaria: string;
      creada_el: Date;
      llave_de_ia: boolean;
      usuarios: number;
      usuarios_limitados: number;
    }>`
      select o.id, o.slug, o.nombre, o.activa, o.es_principal, o.pais, o.nicho_principal, o.precio_mensual::text,
             o.zona_horaria, o.creada_el,
             (oc.ia_clave_cifrada is not null) as llave_de_ia,
             (select count(*)::int from identidad.usuarios u where u.org_id = o.id and u.activo) as usuarios,
             (select count(*)::int from identidad.usuarios u where u.org_id = o.id and u.activo and u.limitado_a_cuentas)
               as usuarios_limitados
        from identidad.organizaciones o
        left join identidad.organizaciones_credenciales oc on oc.org_id = o.id
       where o.slug <> all (${[...SLUGS_DE_CONTROL]}::text[])
       order by o.es_principal desc, o.nombre, o.id`.execute(db)
  ).rows;

  const clientes = await leerLosClientes(db);

  const principal = empresas.find((e) => e.es_principal);
  if (!principal) throw new Error('leerLaConfiguracion: no hay organización principal a la vista');
  return {
    principal: { id: principal.id, zonaHoraria: principal.zona_horaria },
    empresas: empresas.map((e) => ({
      id: e.id,
      slug: e.slug,
      nombre: e.nombre,
      activa: e.activa,
      esPrincipal: e.es_principal,
      pais: e.pais,
      nichoPrincipal: e.nicho_principal,
      precioMensual: e.precio_mensual,
      zonaHoraria: e.zona_horaria,
      altaEl: e.creada_el,
      llaveDeIa: e.llave_de_ia,
      usuarios: e.usuarios,
      usuariosLimitados: e.usuarios_limitados,
      clientes: clientes.filter((c) => c.orgId === e.id).map(({ orgId: _empresa, ...c }) => c),
    })),
  };
}

/**
 * Los clientes de UNA empresa, con las presencias de su conexión: lo que la lista de chequeo en vivo de Ajustes ›
 * Clientes necesita de identidad. **Con la `Trx` de identidad**, y la empresa la elige quien llama, ya autorizada
 * (`empresaDestino`).
 */
export async function leerLosClientesDe(db: Trx, orgId: string): Promise<ConfiguracionDeUnCliente[]> {
  return (await leerLosClientes(db, orgId)).map(({ orgId: _empresa, ...c }) => c);
}

/** Los clientes de todas las empresas, o de una, con su empresa al lado. Sólo presencias. */
async function leerLosClientes(db: Trx, orgId?: string): Promise<(ConfiguracionDeUnCliente & { orgId: string })[]> {
  const deLaEmpresa = orgId === undefined ? sql`` : sql`where c.org_id = ${orgId}`;
  const clientes = (
    await sql<{
      id: string;
      org_id: string;
      nombre: string;
      estado: 'activa' | 'pausada' | 'baja';
      es_prueba: boolean;
      es_por_omision: boolean;
      nicho: string | null;
      nicho_confirmado: boolean;
      modelo_de_negocio: string | null;
      pais: string | null;
      moneda: string | null;
      zona_horaria: string;
      alta_el: Date;
      crm_vinculado: boolean;
      crm_conectado: boolean;
      calendario: boolean;
      meta: boolean;
      aviso: boolean;
    }>`
      select c.id, c.org_id, c.nombre, c.estado, c.es_prueba, c.es_por_omision, c.nicho,
             (c.nicho_confirmado_el is not null) as nicho_confirmado, c.modelo_de_negocio, c.pais, c.moneda,
             c.zona_horaria, c.alta_el,
             -- La por omisión, con lo de la empresa (donde lo escribe Ajustes hoy); las demás, con lo suyo.
             case when c.es_por_omision then coalesce(oc.crm_cuenta_id, c.crm_cuenta_id) is not null
                  else c.crm_cuenta_id is not null end as crm_vinculado,
             case when c.es_por_omision then oc.crm_token_cifrado is not null and oc.crm_estado = 'activa'
                  else cc.crm_token_cifrado is not null and cc.crm_estado = 'activa' end as crm_conectado,
             case when c.es_por_omision then oc.crm_calendario_id is not null
                  else cc.crm_calendario_id is not null end as calendario,
             case when c.es_por_omision then oc.meta_token_cifrado is not null and oc.meta_cuenta_id is not null
                  else cc.meta_token_cifrado is not null and cc.meta_cuenta_id is not null end as meta,
             case when c.es_por_omision then oc.aviso_secreto_hash is not null
                  else cc.aviso_secreto_hash is not null end as aviso
        from identidad.cuentas c
        left join identidad.cuentas_credenciales cc on cc.cuenta_id = c.id
        left join identidad.organizaciones_credenciales oc on oc.org_id = c.org_id
       ${deLaEmpresa}
       order by c.es_por_omision desc, c.alta_el, c.id`.execute(db)
  ).rows;
  return clientes.map((c) => ({
    orgId: c.org_id,
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    esPrueba: c.es_prueba,
    esPorOmision: c.es_por_omision,
    nicho: c.nicho,
    nichoConfirmado: c.nicho_confirmado,
    modeloDeNegocio: c.modelo_de_negocio,
    pais: c.pais,
    moneda: c.moneda,
    zonaHoraria: c.zona_horaria,
    altaEl: c.alta_el,
    crmVinculado: c.crm_vinculado,
    crmConectado: c.crm_conectado,
    calendario: c.calendario,
    meta: c.meta,
    aviso: c.aviso,
  }));
}
