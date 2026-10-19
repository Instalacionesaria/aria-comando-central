// Los clientes de una empresa (el nivel 3): listarlos, darlos de alta, editarlos, vincularlos con su subcuenta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN ESCRIBE QUÉ (el nivel 3, 2026-10-18)
//
// Un cliente es una cuenta (`identidad.cuentas`): una subcuenta del CRM dentro de una empresa. Lo que la empresa
// decide de sus clientes —el nombre, el nicho, el país, la zona, si está activo— lo escribe la empresa por el
// INQUILINO, dentro de `conOrganizacion` con la organización entera: la política de la `086` lo acota a su
// organización, y un `orgId` mal puesto no llega a otra.
//
// Lo que es de la plataforma —la subcuenta del CRM, la marca de prueba— lo escribe sólo ARIA, por identidad
// (`vincularCuenta`). Una empresa que pudiera escribir `crm_cuenta_id` podría ocupar la location de otra (es única en
// toda la plataforma), y una que marcara `es_prueba` sacaría sus clientes de los benchmarks.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos, organizacionActual } from '../datos/contexto.ts';
import type { Trx } from '../datos/capa.ts';
import { mensajeDeDisparador, rechazo } from '../autorizacion/respuesta.ts';

/** Un cliente, como lo ve Ajustes › Clientes. Sin la subcuenta del CRM: sólo si está vinculada. */
export interface ClienteListado {
  id: string;
  nombre: string;
  slug: string;
  estado: 'activa' | 'pausada' | 'baja';
  esPorOmision: boolean;
  esPrueba: boolean;
  nicho: string | null;
  nichoConfirmado: boolean;
  /** Quién confirmó el nicho: la empresa o ARIA. `null` = sin confirmar. */
  nichoConfirmadoDesde: 'organizacion' | 'plataforma' | null;
  modeloDeNegocio: string | null;
  pais: string | null;
  moneda: string | null;
  zonaHoraria: string;
  crmVinculado: boolean;
  altaEl: string;
}

/** Los clientes de la organización del contexto, el por omisión primero. Corre dentro de `conOrganizacion`. */
export async function listarCuentas(): Promise<ClienteListado[]> {
  const filas = await datos()
    .selectFrom('cuentas')
    .select([
      'id', 'nombre', 'slug', 'estado', 'es_por_omision', 'es_prueba', 'nicho', 'nicho_confirmado_el',
      'nicho_confirmado_desde', 'modelo_de_negocio', 'pais', 'moneda', 'zona_horaria', 'crm_cuenta_id', 'alta_el',
    ])
    .orderBy('es_por_omision', 'desc')
    .orderBy('alta_el')
    .orderBy('id')
    .execute();
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    estado: f.estado,
    esPorOmision: f.es_por_omision,
    esPrueba: f.es_prueba,
    nicho: f.nicho,
    nichoConfirmado: f.nicho_confirmado_el !== null,
    nichoConfirmadoDesde: f.nicho_confirmado_desde,
    modeloDeNegocio: f.modelo_de_negocio,
    pais: f.pais,
    moneda: f.moneda,
    zonaHoraria: f.zona_horaria,
    crmVinculado: f.crm_cuenta_id !== null,
    altaEl: f.alta_el.toISOString(),
  }));
}

/** Lo que la empresa puede decir de un cliente. Ausente = no se toca; `null` = se borra. */
export interface DatosDeUnCliente {
  nombre?: string;
  nicho?: string | null;
  /** Confirmar el nicho: lo pide una persona, mirando el nicho elegido. */
  confirmarNicho?: boolean;
  modeloDeNegocio?: string | null;
  pais?: string | null;
  moneda?: string | null;
  zonaHoraria?: string;
}

/**
 * Quién confirma un nicho: una persona de la empresa (`organizacion`, con su id) o ARIA (`plataforma`, sin persona:
 * una persona de ARIA no es de esta organización, y la clave foránea de `nicho_confirmado_por` no la admite). En el
 * segundo caso, quién fue queda en la auditoría.
 */
export type QuienConfirma = { desde: 'organizacion'; por: string } | { desde: 'plataforma'; por: null };

/** El slug de un nombre: minúsculas, sin tildes, guiones. Nunca vacío. */
export function slugDe(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return base.length > 0 ? base : 'cliente';
}

/** El sello de una confirmación del nicho: ahora, desde dónde y quién. */
function sello(quien: QuienConfirma) {
  return { nicho_confirmado_el: sql<Date>`now()`, nicho_confirmado_desde: quien.desde, nicho_confirmado_por: quien.por };
}

const SIN_CONFIRMAR = { nicho_confirmado_el: null, nicho_confirmado_desde: null, nicho_confirmado_por: null };

/**
 * La confirmación del nicho al editar, comparada con lo que había.
 *
 * Confirmar lo ya confirmado NO vuelve a sellar. El formulario manda la casilla en cada guardado, y sellar de nuevo
 * cambiaba la fecha y quién confirmó por quien sólo renombró el cliente: justo el dato que la `086` guarda. Cambiar el
 * nicho sin confirmarlo, o desmarcar la casilla, deja de estar confirmado: la confirmación era del nicho anterior.
 */
function confirmacionAlEditar(
  cambios: DatosDeUnCliente,
  actual: { nicho: string | null; nicho_confirmado_el: Date | null },
  quien: QuienConfirma,
) {
  const cambiaElNicho = cambios.nicho !== undefined && cambios.nicho !== actual.nicho;
  const confirmado = actual.nicho_confirmado_el !== null;
  if (cambios.confirmarNicho === true) return confirmado && !cambiaElNicho ? {} : sello(quien);
  if (cambios.confirmarNicho === false || cambiaElNicho) return confirmado ? SIN_CONFIRMAR : {};
  return {};
}

/**
 * Da de alta un cliente en la organización del contexto. **Corre dentro de `conOrganizacion` con la organización
 * entera y todas sus cuentas**: la política de la `086` rechaza el alta con un cliente enfocado o desde un cliente
 * final. Devuelve el id.
 */
export async function crearCuenta(nuevo: DatosDeUnCliente & { nombre: string }, quien: QuienConfirma): Promise<string> {
  const base = slugDe(nuevo.nombre);
  const usados = new Set(
    (await datos().selectFrom('cuentas').select('slug').where('slug', 'like', `${base}%`).execute()).map((f) => f.slug),
  );
  let slug = base;
  for (let n = 2; usados.has(slug); n += 1) slug = `${base}-${n}`;
  // El id lo pone la base: el inquilino no tiene permiso sobre esa columna. `returning` funciona porque la política de
  // lectura deja ver la fila nueva a quien ve la organización entera, que es el único que puede darla de alta.
  const { id } = await datos()
    .insertInto('cuentas')
    .values({
      // La inyección del cliente de negocio la pisa con la del contexto igual: va escrita para el compilador.
      org_id: organizacionActual(),
      nombre: nuevo.nombre.trim(),
      slug,
      ...(nuevo.nicho !== undefined ? { nicho: nuevo.nicho } : {}),
      ...(nuevo.modeloDeNegocio !== undefined ? { modelo_de_negocio: nuevo.modeloDeNegocio } : {}),
      ...(nuevo.pais !== undefined ? { pais: nuevo.pais } : {}),
      ...(nuevo.moneda !== undefined ? { moneda: nuevo.moneda } : {}),
      ...(nuevo.zonaHoraria !== undefined ? { zona_horaria: nuevo.zonaHoraria } : {}),
      ...(nuevo.confirmarNicho === true ? sello(quien) : {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

/**
 * Edita un cliente de la organización del contexto. **Corre dentro de `conOrganizacion` con la organización entera.**
 * La baja pone su fecha; volver a activar la borra. La cuenta por omisión no se pausa ni se da de baja: la base lo
 * rechaza (`cuentas_la_por_omision_esta_activa`). Devuelve si encontró el cliente.
 */
export async function editarCuenta(
  id: string,
  cambios: DatosDeUnCliente & { estado?: 'activa' | 'pausada' | 'baja' },
  quien: QuienConfirma,
): Promise<boolean> {
  // Lo que había, bajo candado: la confirmación se decide contra eso (`confirmacionAlEditar`).
  const actual = await datos()
    .selectFrom('cuentas')
    .select(['nicho', 'nicho_confirmado_el'])
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
  if (!actual) return false;
  const confirmacion = confirmacionAlEditar(cambios, actual, quien);
  // Nada que escribir (desmarcar lo que no estaba confirmado): no es un error, y un `update` sin columnas no es SQL.
  const algo = Object.keys(confirmacion).length > 0 || Object.entries(cambios).some(([k, v]) => k !== 'confirmarNicho' && v !== undefined);
  if (!algo) return true;
  const r = await datos()
    .updateTable('cuentas')
    .set({
      ...(cambios.nombre !== undefined ? { nombre: cambios.nombre.trim() } : {}),
      ...(cambios.nicho !== undefined ? { nicho: cambios.nicho } : {}),
      ...(cambios.modeloDeNegocio !== undefined ? { modelo_de_negocio: cambios.modeloDeNegocio } : {}),
      ...(cambios.pais !== undefined ? { pais: cambios.pais } : {}),
      ...(cambios.moneda !== undefined ? { moneda: cambios.moneda } : {}),
      ...(cambios.zonaHoraria !== undefined ? { zona_horaria: cambios.zonaHoraria } : {}),
      ...(cambios.estado !== undefined
        ? { estado: cambios.estado, baja_el: cambios.estado === 'baja' ? sql<Date>`now()` : null }
        : {}),
      ...confirmacion,
    })
    .where('id', '=', id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

/**
 * Vincula un cliente con su subcuenta del CRM, o lo marca de prueba. **Sólo la plataforma, por identidad.**
 *
 * La subcuenta de un cliente que no es el principal no puede ser la de ninguna empresa: la del cliente principal es
 * la de su empresa (`organizaciones_credenciales.crm_cuenta_id`, que se carga en Ajustes › Credenciales), y una
 * location en los dos lados metería los datos de un negocio en otro. El cliente principal no se vincula acá. Una
 * subcuenta que ya es de otro cliente sale de la base como `23505`, que quien llama traduce.
 */
export async function vincularCuenta(
  db: Trx,
  orgId: string,
  id: string,
  cambios: { crmCuentaId?: string | null; esPrueba?: boolean },
): Promise<'listo' | 'no_encontrado' | 'cliente_principal' | 'subcuenta_en_uso'> {
  const cliente = await db
    .selectFrom('cuentas')
    .select('es_por_omision')
    .where('org_id', '=', orgId)
    .where('id', '=', id)
    .executeTakeFirst();
  if (!cliente) return 'no_encontrado';
  if (cambios.crmCuentaId !== undefined && cliente.es_por_omision) return 'cliente_principal';
  if (typeof cambios.crmCuentaId === 'string') {
    const deUnaEmpresa = await db
      .selectFrom('organizaciones_credenciales')
      .select('org_id')
      .where('crm_cuenta_id', '=', cambios.crmCuentaId)
      .executeTakeFirst();
    if (deUnaEmpresa) return 'subcuenta_en_uso';
  }
  await db
    .updateTable('cuentas')
    .set({
      ...(cambios.crmCuentaId !== undefined ? { crm_cuenta_id: cambios.crmCuentaId } : {}),
      ...(cambios.esPrueba !== undefined ? { es_prueba: cambios.esPrueba } : {}),
    })
    .where('org_id', '=', orgId)
    .where('id', '=', id)
    .executeTakeFirst();
  return 'listo';
}

/**
 * Los clientes ACTIVOS de una empresa, para el barrido (el nivel 3). **Por identidad**, con la organización en el
 * `where`: el cron los lee junto con sus credenciales. El principal primero. Uno en pausa o de baja no se barre: nadie
 * lo mira, y su subcuenta puede ya no ser nuestra.
 */
export async function clientesParaBarrer(db: Trx, orgId: string): Promise<{ id: string; esPorOmision: boolean }[]> {
  const filas = await db
    .selectFrom('cuentas')
    .select(['id', 'es_por_omision'])
    .where('org_id', '=', orgId)
    .where('estado', '=', 'activa')
    .orderBy('es_por_omision', 'desc')
    .orderBy('alta_el')
    .orderBy('id')
    .execute();
  return filas.map((f) => ({ id: f.id, esPorOmision: f.es_por_omision }));
}

/** El catálogo que necesita el formulario de un cliente: nichos, modelos de negocio, países y monedas vigentes. */
export async function catalogoDelCliente() {
  // En serie: es una sola transacción, y una conexión no corre dos consultas a la vez.
  const nichos = await datos()
    .selectFrom('catalogo.nichos')
    .select(['clave', 'nombre', 'padre', 'nivel'])
    .where('vigente', '=', true)
    .orderBy('nivel')
    .orderBy('nombre')
    .execute();
  const modelos = await datos()
    .selectFrom('catalogo.modelos_de_negocio')
    .select(['clave', 'nombre'])
    .where('vigente', '=', true)
    .orderBy('nombre')
    .execute();
  const paises = await datos()
    .selectFrom('catalogo.paises')
    .select(['codigo', 'nombre', 'moneda', 'zona_horaria'])
    .where('vigente', '=', true)
    .orderBy('nombre')
    .execute();
  const monedas = await datos()
    .selectFrom('catalogo.monedas')
    .select(['codigo', 'nombre'])
    .where('vigente', '=', true)
    .orderBy('codigo')
    .execute();
  return {
    nichos,
    modelos,
    paises: paises.map((p) => ({ codigo: p.codigo, nombre: p.nombre, moneda: p.moneda, zonaHoraria: p.zona_horaria })),
    monedas,
  };
}

/** La forma de un uuid. Se comprueba antes de que el motor la rechace con un 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La empresa sobre la que opera la petición: la que está mirando la sesión, o —sólo para la plataforma— la que pide
 * con `orgId` (el tablero de Negocios da de alta clientes de cualquier empresa sin conmutar la sesión). `null` = no
 * puede, y la ruta responde 404: «no existe» y «no es tuya» no se distinguen.
 *
 * Es la misma condición que `POST /api/admin/usuarios` usa para elegir empresa: rol de plataforma y
 * `organizaciones.listar`.
 */
export function empresaDestino(
  contexto: { orgEfectiva: string; esRolDePlataforma: boolean; permisos: ReadonlySet<string> },
  pedido: unknown,
): string | null {
  if (pedido === undefined || pedido === null || pedido === '' || pedido === contexto.orgEfectiva) return contexto.orgEfectiva;
  if (typeof pedido !== 'string' || !UUID.test(pedido)) return null;
  return contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar') ? pedido : null;
}

/**
 * Quién confirma un nicho en esta petición: una persona de la empresa destino, o ARIA. `autor` es lo que devuelve
 * `autorDelCambio(contexto)` cuando la empresa destino es la que mira la sesión, y `null` si no.
 */
export function quienConfirma(autor: string | null): QuienConfirma {
  return autor !== null ? { desde: 'organizacion', por: autor } : { desde: 'plataforma', por: null };
}

const PAIS = /^[A-Z]{2}$/;
const MONEDA = /^[A-Z]{3}$/;
const CLAVE = /^[a-z][a-z0-9_]{1,59}$/;

/**
 * Lee lo que se puede decir de un cliente en un cuerpo JSON. Devuelve los datos, o el texto del rechazo. Valida la
 * FORMA; que el nicho, el país o la moneda existan lo dice el catálogo, en la base (una clave que no existe es un
 * `23503`).
 */
export function leerDatosDeUnCliente(
  c: Record<string, unknown>,
  esZonaValida: (z: unknown) => z is string,
): (DatosDeUnCliente & { estado?: 'activa' | 'pausada' | 'baja' }) | string {
  const salida: DatosDeUnCliente & { estado?: 'activa' | 'pausada' | 'baja' } = {};
  if (c.nombre !== undefined) {
    if (typeof c.nombre !== 'string' || c.nombre.trim().length === 0 || c.nombre.trim().length > 120) {
      return 'El cliente necesita un nombre de 1 a 120 caracteres.';
    }
    salida.nombre = c.nombre;
  }
  const opcional = (v: unknown, patron: RegExp): string | null | undefined | false =>
    v === undefined ? undefined : v === null ? null : typeof v === 'string' && patron.test(v) ? v : false;
  const nicho = opcional(c.nicho, CLAVE);
  if (nicho === false) return 'Ese nicho no tiene forma de clave del catálogo.';
  if (nicho !== undefined) salida.nicho = nicho;
  const modelo = opcional(c.modeloDeNegocio, CLAVE);
  if (modelo === false) return 'Ese modelo de negocio no tiene forma de clave del catálogo.';
  if (modelo !== undefined) salida.modeloDeNegocio = modelo;
  const pais = opcional(c.pais, PAIS);
  if (pais === false) return 'El país va con su código de dos letras, como PE.';
  if (pais !== undefined) salida.pais = pais;
  const moneda = opcional(c.moneda, MONEDA);
  if (moneda === false) return 'La moneda va con su código de tres letras, como PEN.';
  if (moneda !== undefined) salida.moneda = moneda;
  if (c.zonaHoraria !== undefined) {
    if (!esZonaValida(c.zonaHoraria)) return 'Esa zona horaria no existe.';
    salida.zonaHoraria = c.zonaHoraria;
  }
  if (c.confirmarNicho !== undefined) {
    if (typeof c.confirmarNicho !== 'boolean') return '«Confirmar el nicho» va como verdadero o falso.';
    // Confirmar con el nicho borrado en la misma petición no tiene sentido. Confirmar sin mandar el nicho confirma el
    // que ya tenía, y si no tenía ninguno lo rechaza la base (`cuentas` no admite un nicho confirmado y nulo).
    if (c.confirmarNicho && salida.nicho === null) return 'No se puede confirmar un nicho vacío.';
    salida.confirmarNicho = c.confirmarNicho;
  }
  if (c.estado !== undefined) {
    if (c.estado !== 'activa' && c.estado !== 'pausada' && c.estado !== 'baja') return 'El estado es activa, pausada o baja.';
    salida.estado = c.estado;
  }
  return salida;
}

/** Lo que la base rechaza al escribir un cliente, dicho para la pantalla. Lo que no reconoce, lo relanza. */
export function rechazoDeLaBase(e: unknown): Response {
  const codigo = (e as { code?: string }).code;
  // Una clave del catálogo que no existe (el nicho, el país, la moneda), o una empresa que no existe.
  if (codigo === '23503') return rechazo('peticion_invalida', 'El nicho, el modelo, el país o la moneda no están en el catálogo.');
  // Un nicho confirmado sin nicho, o la cuenta por omisión pausada.
  if (codigo === '23514') {
    return rechazo(
      'peticion_invalida',
      'No se puede: un nicho confirmado tiene que existir, y el cliente principal de la empresa no se pausa ni se da de ' +
        'baja (es el que recibe lo que entra con sus credenciales).',
    );
  }
  const deDisparador = mensajeDeDisparador(e);
  if (deDisparador) return rechazo('rechazo_de_la_base', deDisparador);
  throw e;
}
