// La empresa `gamma` del nivel 3, sembrada para mirarla en las pantallas locales. SÓLO LOCAL.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES Y POR QUÉ ASÍ
//
// El plan del nivel 3 (P7) pide mirar en el navegador lo que las pruebas miran por partes: el superadministrador en
// Negocios y en Ajustes › Clientes, la empresa con su selector, el alta y el foco, y el cliente final con sólo Leads y
// Sales. Las pruebas de dos clientes arman cada una su `gamma-NNN` y la borran al terminar; ésta queda instalada:
//
//   · la empresa `gamma`, con tres clientes genéricos: el principal (el por omisión), un segundo con su Conexión de
//     prueba —una subcuenta y un token inventados, que GoHighLevel rechazaría— y uno marcado de prueba;
//   · una persona administradora de la empresa y un cliente final del segundo, con la contraseña de desarrollo del
//     sembrado (`CLAVE_DESARROLLO`) y debiendo cambiarla al entrar, como las personas del sembrado;
//   · contactos, citas y resultados sintéticos del principal y del segundo, y la administradora designada closer en
//     los dos con un usuario del CRM inventado: sin closers, Sales no tiene de quién mostrar las ventas.
//
// ── REAPLICABLE, Y NO EN `reset` ─────────────────────────────────────────────
//
// Lo que ya existe no se vuelve a crear: la empresa, sus clientes y las dos personas se buscan por su slug y su correo,
// y conservan sus ids y sus sesiones; lo que la siembra dice de ellos se vuelve a escribir, así que una segunda corrida
// deja el mismo estado. Los datos sintéticos se rehacen —se borran los contactos del principal y del segundo, con lo que
// cuelga de ellos, y se vuelven a escribir—, para que sus fechas sean de los últimos días cada vez que se siembra.
//
// No va en `reset`: la prueba `11-sembrado` exige exactamente las organizaciones y las personas del sembrado de
// desarrollo. Así que, como las empresas de los agentes, se quita antes de correr la suite (`quitar-nivel-3`).
//
// ── ESCRIBE COMO LA APLICACIÓN ───────────────────────────────────────────────
//
// Lo de identidad por `conIdentidad` y lo de negocio por `conOrganizacion`, con las funciones de la aplicación donde
// existen —el alta y la edición de un cliente (`crearCuenta`, `editarCuenta`), el vínculo de ARIA (`vincularCuenta`)—:
// si una regla nueva rompe el alta de un cliente, rompe también la siembra. Sólo quitar va por el administrador
// (`quitarEmpresas`), que es lo único que la aplicación no puede.
//
// Todo lo sembrado es inventado: dominios `.test`, nombres genéricos, identificadores con el slug de la empresa.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conIdentidad, type Trx } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { exigirAnfitrionLocal } from '../../lib/datos/anfitrion.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { crearCuenta, editarCuenta, vincularCuenta, type DatosDeUnCliente } from '../../lib/administracion/cuentas.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { CLAVE_DESARROLLO } from './organizaciones.ts';
import { quitarEmpresas } from './casos-de-los-agentes.ts';

/** El slug de la empresa sembrada. Las pruebas siembran con el suyo (`gamma-NNN`). */
export const SLUG_DEL_NIVEL_3 = 'gamma';

/** La zona de la empresa y de sus clientes: la de la mayoría de los clientes, y con un día que no es el de UTC. */
const ZONA = 'America/Lima';

/**
 * Los tres clientes. El `slug` es el que `crearCuenta` saca del nombre: por él se encuentran al volver a sembrar. El
 * principal no lo necesita: es el por omisión, que la empresa trae al nacer.
 */
export const CLIENTES_DEL_NIVEL_3 = {
  principal: { nombre: 'Cliente principal', nicho: 'odontologia' },
  segundo: { nombre: 'Cliente segundo', slug: 'cliente-segundo', nicho: 'medicina_estetica' },
  dePrueba: { nombre: 'Cliente de prueba', slug: 'cliente-de-prueba', nicho: null },
} as const;

/**
 * Lo que se siembra de los dos primeros: contactos de los últimos días, una cita pasada para cada uno de los primeros
 * y el resultado de las primeras citas, registrado por la administradora como closer. Las pruebas comparan contra esto.
 */
export const DATOS_DEL_NIVEL_3 = {
  principal: { contactos: 12, citas: 6, resultados: ['venta', 'seguimiento', 'no_interesa'], monto: '1500.00' },
  segundo: { contactos: 8, citas: 4, resultados: ['venta', 'no_show'], monto: '900.00' },
} as const;

type ClienteConDatos = keyof typeof DATOS_DEL_NIVEL_3;

export interface NivelTresSembrado {
  org: string;
  clientes: { principal: string; segundo: string; dePrueba: string };
  personas: { admin: string; cliente: string };
  /** Lo que se creó en esta corrida, para el informe de la fase. Vacío al volver a sembrar. */
  creadas: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// LA GUARDA
// ═══════════════════════════════════════════════════════════════════════════════

/** Se niega fuera de la base local: escribe personas con la contraseña de desarrollo. */
function exigirBaseLocalParaElNivel3(): void {
  for (const variable of ['DATABASE_URL_IDENTIDAD', 'DATABASE_URL_INQUILINO'] as const) {
    const url = process.env[variable];
    if (!url) throw new Error(`${variable} no está definida.`);
    exigirAnfitrionLocal(url, {
      quien: 'la siembra del nivel 3',
      porque: 'escribe una empresa sintética y personas con la contraseña de desarrollo.',
      escotilla: 'ARIA_SEMBRADO_FORZADO',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAS PERSONAS
// ═══════════════════════════════════════════════════════════════════════════════

interface PersonaSembrada {
  nombre: string;
  email: string;
  rol: 'administrador' | 'usuario';
  limitado: boolean;
  secciones: string[];
}

/** Una persona de la empresa: la busca por su correo y, si no está, la crea. Su rol y sus pestañas, si faltan. */
async function persona(db: Trx, org: string, p: PersonaSembrada, creadas: string[]): Promise<string> {
  let fila = await db.selectFrom('usuarios').select(['id', 'org_id']).where('email', '=', p.email).executeTakeFirst();
  if (fila && fila.org_id !== org) throw new Error(`la siembra del nivel 3: ${p.email} ya es de otra empresa`);
  if (!fila) {
    fila = await db
      .insertInto('usuarios')
      .values({
        org_id: org,
        nombre: p.nombre,
        email: p.email,
        password_hash: hashear(CLAVE_DESARROLLO),
        es_admin_principal: false,
        // Nace debiendo cambiarla, como las del sembrado: es lo que hace un alta real.
        debe_cambiar_password: true,
        limitado_a_cuentas: p.limitado,
      } as never)
      .returning(['id', 'org_id'])
      .executeTakeFirstOrThrow();
    creadas.push(`usuario:${p.email}`);
  }
  const rol = await db.selectFrom('roles').select('id').where('clave', '=', p.rol).where('org_id', 'is', null).executeTakeFirstOrThrow();
  const tiene = await db.selectFrom('usuarios_roles').select('rol_id').where('usuario_id', '=', fila.id).where('rol_id', '=', rol.id).executeTakeFirst();
  if (!tiene) await db.insertInto('usuarios_roles').values({ usuario_id: fila.id, rol_id: rol.id } as never).execute();
  for (const seccion of p.secciones) {
    await db
      .insertInto('usuarios_secciones')
      .values({ usuario_id: fila.id, seccion } as never)
      .onConflict((oc) => oc.columns(['usuario_id', 'seccion']).doNothing())
      .execute();
  }
  return fila.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS DATOS SINTÉTICOS DE UN CLIENTE
// ═══════════════════════════════════════════════════════════════════════════════

/** Ese día local, `hace` días antes de hoy, a una hora local, como instante. */
const momentoHace = (hace: number, hora: string) =>
  sql<Date>`((((now() at time zone ${ZONA})::date - ${hace}::int) + ${hora}::time) at time zone ${ZONA})`;

/**
 * Rehace los contactos, las citas y los resultados de UN cliente, y designa closer en él a la administradora. **Corre
 * dentro del ámbito de ese cliente**: el puente pone su cuenta en cada fila, y el borrado sólo alcanza las suyas.
 */
async function rehacerLosDatos(slug: string, cual: ClienteConDatos, admin: string): Promise<void> {
  const d = DATOS_DEL_NIVEL_3[cual];
  const id = (tipo: string, n: number) => `${slug}-${cual}-${tipo}-${String(n).padStart(2, '0')}`;
  const closer = `${slug}-closer-del-${cual}`;

  // Lo de la corrida anterior: borrar los contactos se lleva lo que cuelga de ellos (las citas, los resultados).
  await datos().deleteFrom('contactos').execute();

  await datos()
    .insertInto('closer_asignado')
    .values({ usuario_id: admin, crm_usuario_id: closer, actualizado_el: new Date(), actualizado_por: admin } as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'cuenta_id', 'usuario_id']).doUpdateSet({ crm_usuario_id: closer, actualizado_por: admin } as never),
    )
    .execute();

  for (let n = 1; n <= d.contactos; n += 1) {
    // De hace 3 días a hace unas semanas, de a dos: los que tienen cita la tienen dos días después del alta, ya pasada.
    const hace = 3 + 2 * (n - 1);
    const conCita = n <= d.citas;
    const contacto = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: id('contacto', n),
        nombre: `Contacto ${n} de ${CLIENTES_DEL_NIVEL_3[cual].nombre}`,
        email: `${id('contacto', n)}@contactos.test`,
        territorio: conCita ? 'closer' : 'setter',
        crm_asignado_a: conCita ? closer : null,
        // A la medianoche local: el alta de hace N días queda fuera de toda ventana corrida de N días (ver los casos de
        // los agentes, `casos-de-los-agentes.ts`).
        alta_en_el_crm: momentoHace(hace, '00:00'),
        atribucion_primera: JSON.stringify({}),
        atribucion_ultima: JSON.stringify({}),
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    if (!conCita) continue;

    const salida = d.resultados[n - 1];
    const cita = await datos()
      .insertInto('citas')
      .values({
        contacto_id: (contacto as { id: string }).id,
        ghl_evento_id: id('cita', n),
        ghl_calendario_id: `${slug}-calendario`,
        titulo: 'Cita de prueba',
        inicio_el: momentoHace(hace - 2, '15:00'),
        fin_el: momentoHace(hace - 2, '15:45'),
        estado_ghl: 'confirmed',
        reservada_el: momentoHace(hace, '11:00'),
        crm_asignado_a: closer,
        // La asistencia, sólo donde hay resultado: un plantón no se presentó; los demás, sí.
        asistio: salida === undefined ? null : salida !== 'no_show',
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    if (salida === undefined) continue;

    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: (contacto as { id: string }).id,
        cita_id: (cita as { id: string }).id,
        salida,
        rol: 'closer',
        monto: salida === 'venta' ? d.monto : null,
        registrado_por: admin,
        creado_el: momentoHace(hace - 2, '17:00'),
      } as never)
      .execute();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMBRAR Y QUITAR
// ═══════════════════════════════════════════════════════════════════════════════

/** Siembra la empresa del nivel 3, o la vuelve a dejar como la siembra la deja. Ver el encabezado. */
export async function sembrarElNivel3({ slug = SLUG_DEL_NIVEL_3 }: { slug?: string } = {}): Promise<NivelTresSembrado> {
  exigirBaseLocalParaElNivel3();
  const creadas: string[] = [];
  const correo = (quien: string) => `${quien}@${slug}.test`;

  // 1 · La empresa y su administradora, por identidad. La empresa nace con su cliente por omisión (el puente de la `085`).
  const { org, admin } = await conIdentidad(async (db) => {
    let o = await db.selectFrom('organizaciones').select('id').where('slug', '=', slug).executeTakeFirst();
    if (!o) {
      o = await db
        .insertInto('organizaciones')
        .values({ slug, nombre: 'Gamma (nivel 3)', zona_horaria: ZONA, es_principal: false })
        .returning('id')
        .executeTakeFirstOrThrow();
      creadas.push(`organizacion:${slug}`);
    }
    const admin = await persona(
      db,
      o.id,
      { nombre: 'Administradora de Gamma', email: correo('admin'), rol: 'administrador', limitado: false, secciones: [] },
      creadas,
    );
    return { org: o.id, admin };
  });

  // 2 · Los clientes, por el inquilino y con las funciones de Ajustes › Clientes. Cada corrida les vuelve a escribir lo
  //     sembrado —también si alguien los pausó—, y la confirmación del nicho no se vuelve a sellar si no cambió.
  const quien = { desde: 'organizacion', por: admin } as const;
  const comun: DatosDeUnCliente = { confirmarNicho: true, modeloDeNegocio: 'servicio_local', pais: 'PE', moneda: 'PEN', zonaHoraria: ZONA };
  const clientes = await conOrganizacion(org, async () => {
    const principal = (await datos().selectFrom('cuentas').select('id').where('es_por_omision', '=', true).executeTakeFirstOrThrow()).id;
    const buscarOCrear = async (c: { nombre: string; slug: string; nicho: string | null }): Promise<string> => {
      const ya = await datos().selectFrom('cuentas').select('id').where('slug', '=', c.slug).executeTakeFirst();
      if (ya) return ya.id;
      const nuevo = await crearCuenta({ nombre: c.nombre }, quien);
      creadas.push(`cliente:${c.slug}`);
      return nuevo;
    };
    const segundo = await buscarOCrear(CLIENTES_DEL_NIVEL_3.segundo);
    const dePrueba = await buscarOCrear(CLIENTES_DEL_NIVEL_3.dePrueba);
    for (const [idDelCliente, c] of [
      [principal, CLIENTES_DEL_NIVEL_3.principal],
      [segundo, CLIENTES_DEL_NIVEL_3.segundo],
      [dePrueba, CLIENTES_DEL_NIVEL_3.dePrueba],
    ] as const) {
      const datosDelCliente: DatosDeUnCliente =
        c.nicho === null ? { nombre: c.nombre, zonaHoraria: ZONA } : { ...comun, nombre: c.nombre, nicho: c.nicho };
      await editarCuenta(idDelCliente, { ...datosDelCliente, estado: 'activa' }, quien);
    }
    return { principal, segundo, dePrueba };
  });
  if (!clientes.segundo || !clientes.dePrueba) throw new Error('la siembra del nivel 3: no se encontró un cliente recién creado');

  // 3 · Lo de ARIA y la Conexión de prueba del segundo, por identidad; y el cliente final del segundo.
  const cliente = await conIdentidad(async (db) => {
    const vinculo = await vincularCuenta(db, org, clientes.segundo, { crmCuentaId: `${slug}-subcuenta-de-prueba` });
    const marca = await vincularCuenta(db, org, clientes.dePrueba, { esPrueba: true });
    if (vinculo !== 'listo' || marca !== 'listo') throw new Error(`la siembra del nivel 3: el vínculo de ARIA dio ${vinculo} y ${marca}`);
    // Un token inventado, como el que se carga en la Conexión: GoHighLevel lo rechazaría.
    const conexion = {
      crm_token_cifrado: cifrar(`token-de-prueba-de-${slug}`),
      crm_estado: 'activa',
      crm_expira_el: null,
      crm_calendario_id: `${slug}-calendario`,
      actualizado_por: admin,
      actualizado_el: new Date(),
    };
    await db
      .insertInto('cuentas_credenciales')
      .values({ org_id: org, cuenta_id: clientes.segundo, ...conexion } as never)
      .onConflict((oc) => oc.column('cuenta_id').doUpdateSet(conexion as never))
      .execute();

    const id = await persona(
      db,
      org,
      { nombre: 'Cliente final de Gamma', email: correo('cliente'), rol: 'usuario', limitado: true, secciones: ['contacts', 'sales'] },
      creadas,
    );
    // Sólo el segundo: si alguien le sumó otro cliente en Ajustes, la siembra lo vuelve a dejar en el suyo.
    await db.deleteFrom('usuarios_cuentas').where('usuario_id', '=', id).where('cuenta_id', '!=', clientes.segundo).execute();
    await db
      .insertInto('usuarios_cuentas')
      .values({ org_id: org, usuario_id: id, cuenta_id: clientes.segundo, concedida_por: admin } as never)
      .onConflict((oc) => oc.doNothing())
      .execute();
    return id;
  });

  // 4 · Los datos sintéticos de los dos primeros, cada uno en SU ámbito. El de prueba queda sin datos.
  await conOrganizacion(ambitoDeUnCliente(org, clientes.principal), () => rehacerLosDatos(slug, 'principal', admin));
  await conOrganizacion(ambitoDeUnCliente(org, clientes.segundo), () => rehacerLosDatos(slug, 'segundo', admin));

  return { org, clientes, personas: { admin, cliente }, creadas };
}

/** Quita la empresa del nivel 3 y todo lo suyo. Por su slug EXACTO: las `gamma-NNN` de las pruebas no se tocan. */
export async function quitarElNivel3({ slug = SLUG_DEL_NIVEL_3 }: { slug?: string } = {}): Promise<number> {
  exigirBaseLocalParaElNivel3();
  return quitarEmpresas({ slug });
}
