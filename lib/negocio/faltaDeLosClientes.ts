// De QUÉ CLIENTE falta la conexión con GoHighLevel o el gasto, y qué hacer (el nivel 3, C6 · D1).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL AVISO QUE QUEDABA PRENDIDO PARA SIEMPRE
//
// Con varios clientes, la agenda de la empresa mira el PEOR cliente activo: uno activo sin credenciales del CRM nunca
// tiene pulso, y la agenda decía «Todavía no se leyó el calendario… Usá «Traer del calendario»» para siempre, con un
// botón que no lo arregla. Y Acquisition decía «Faltan días de gasto.» sin decir de quién ni por qué. Los dos hechos ya
// estaban escritos en la base: el barrido sella cada tarea de cada cliente, y una credencial que falta deja la tarea
// `saltada` con el CÓDIGO de la falta (`lib/negocio/barrido.ts:774`), y la pasada del gasto sin Meta vinculado en
// GoHighLevel deja su motivo en el sello de `anuncios` (`motivoDeLoIncompleto`).
//
// Este módulo los lee y los dice con el nombre del cliente y lo que hay que hacer: el texto de CADA código, que ya dice
// dónde se carga —la de la empresa, en Ajustes; la de otro cliente, en su Conexión; su subcuenta, la vincula la
// plataforma— y que con `token_ilegible` no dice «falta» (`lib/credenciales/resolver.ts:894`). Por eso el prefijo es
// neutro: «la conexión no está lista», nunca «le falta».
//
// ── LAS TRES FRESCURAS ──────────────────────────────────────────────────────
//
// «Sin conexión» se decide con el sello MÁS NUEVO de las tareas del CRM de ese cliente, que `contactos` renueva cada
// diez minutos, y con su pulso: un pulso de citas o de mensajes posterior a ese sello —alguien cargó la conexión y
// apretó el botón— lo saca de la lista enseguida, sin esperar al cron. Los sellos que no dicen nada del acceso
// (`sin_tiempo`, `frenada`) no cuentan: sin eso, una corrida sin presupuesto lo sacaba de la lista por un tic.
// «Meta no vinculado» sale del sello de `anuncios`, que corre UNA vez al día (`17 6 * * *`): quien vincula Meta en su
// GoHighLevel lo sigue leyendo hasta la pasada siguiente, que es también cuando su serie entra.
//
// ── QUIÉN SE NOMBRA ─────────────────────────────────────────────────────────
//
// Un cliente que no es el principal, siempre; el principal, sólo con más de un cliente ACTIVO a la vista. Con un solo
// cliente nada cambia: ni un texto ni una clave. Es el mismo criterio que el `cliente` de las campañas.
//
// ── UNA HOJA, A PROPÓSITO ───────────────────────────────────────────────────
//
// No importa `barrido.ts` en tiempo de ejecución, sólo su tipo: la importación cerraría el ciclo
// `embudosDeAcquisition → barrido → detectores/correr → detector de Acquisition → embudosDeAcquisition`, el mismo que
// `pasosDeConversion.ts` evita importando la frescura al usarla. Por eso el texto de Meta vive acá como constante, y
// una prueba exige que sea idéntico al que escribe el barrido, y que `TAREAS_DEL_CRM` sean justo las que su guardia
// deja `saltada` por la credencial.
//
// **Corre dentro de `conOrganizacion(`**: lo que ve lo acota la RLS (el foco, el cliente final).
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import { TEXTO_DE_FALTA_CUENTAS_DE_META, TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE, type FaltaParaGhl } from '../credenciales/resolver.ts';
import type { AlcanceDelCloser } from './alcanceDelCloser.ts';
import type { Tarea } from './barrido.ts';

/**
 * El motivo que el barrido sella en `anuncios` cuando Meta rechazó la conexión de una cuenta publicitaria del cliente
 * (Meta directo: el negocio quitó la integración, o venció). Lo leen la lista de chequeo y los avisos.
 */
export const MOTIVO_META_RECHAZADA = 'Meta rechazó la conexión: hay que volver a conectar Meta en Ajustes';

/** Las tareas de un cliente que pasan por el guardia de la credencial del CRM del barrido. */
// Desde Meta directo, `anuncios` y `anuncios_relleno` le hablan a Meta con la conexión del cliente, no al CRM.
export const TAREAS_DEL_CRM = ['contactos', 'mensajes', 'citas'] as const satisfies readonly Tarea[];

/** Los estados del sello que dicen algo del acceso. `sin_tiempo` y `frenada` no: la tarea ni lo intentó. */
const DICEN_DEL_ACCESO = ['saltada', 'corrio', 'fallo'];

/** Las claves de pulso que escribe una traída con la conexión lista: el calendario y los mensajes. */
const PULSOS_DEL_CRM = ['citas', 'mensajes'];

/** Un cliente activo cuya conexión con GoHighLevel no está lista, y por qué. */
export interface ClienteSinConexion {
  id: string;
  nombre: string;
  esPorOmision: boolean;
  que: FaltaParaGhl;
}

/** Si un cliente se nombra en un aviso. Pura. */
export function seNombra(c: { esPorOmision: boolean }, activosALaVista: number): boolean {
  return !c.esPorOmision || activosALaVista > 1;
}

/**
 * Si un aviso de lo que se ve habla de cada cliente: si alguno a la vista se nombra (`seNombra`). Con la empresa de un
 * cliente, o el foco en el principal solo, no, y el aviso es el de siempre. Uno de baja no cuenta: la sesión no lo ve
 * como cliente. Es una pregunta de la vista y no de una lista, así que contesta también sin nada que listar.
 */
export async function seNombranLosClientes(): Promise<boolean> {
  const clientes = await datos().selectFrom('cuentas').select(['es_por_omision', 'estado']).where('estado', '<>', 'baja').execute();
  const activos = clientes.filter((c) => c.estado === 'activa').length;
  return clientes.some((c) => seNombra({ esPorOmision: c.es_por_omision }, activos));
}

const esFaltaDeGhl = (motivo: string | null): motivo is FaltaParaGhl =>
  motivo !== null && Object.prototype.hasOwnProperty.call(TEXTO_DE_FALTA_GHL, motivo);

/**
 * Los clientes ACTIVOS a la vista cuya conexión con GoHighLevel no está lista, en el orden de la sesión (el principal
 * primero). Sólo los que se nombran (`seNombra`). Con `cuentaId`, sólo ése: la ficha de un contacto pregunta por su
 * cliente, y el conteo de activos sigue siendo el de la vista.
 */
export async function clientesSinConexion(cuentaId?: string): Promise<ClienteSinConexion[]> {
  const activos = await datos()
    .selectFrom('cuentas')
    .select(['id', 'nombre', 'es_por_omision'])
    .where('estado', '=', 'activa')
    .orderBy('es_por_omision', 'desc')
    .orderBy('nombre', 'asc')
    .execute();
  const aMirar = activos.filter((c) => (cuentaId === undefined || c.id === cuentaId) && seNombra({ esPorOmision: c.es_por_omision }, activos.length));
  if (aMirar.length === 0) return [];

  const sellos = await datos()
    .selectFrom('tareas_programadas')
    .select(['cuenta_id', 'ultimo_estado', 'ultimo_motivo', 'ultima_corrida_el'])
    .where('tarea', 'in', [...TAREAS_DEL_CRM])
    .where('ultimo_estado', 'in', DICEN_DEL_ACCESO)
    .execute();
  const pulsos = await datos()
    .selectFrom('ingesta_pulso')
    .select(['cuenta_id', 'ultima_corrida_el'])
    .where('clave', 'in', PULSOS_DEL_CRM)
    .where('ultima_corrida_el', 'is not', null)
    .execute();

  const lista: ClienteSinConexion[] = [];
  for (const c of aMirar) {
    /* Los sellos del cliente. El principal sin sellos propios toma los sin cuenta, como la frescura: los de antes del
       barrido por cliente eran del trabajo que entraba con las credenciales de la empresa. */
    let suyos = sellos.filter((s) => s.cuenta_id === c.id);
    if (suyos.length === 0 && c.es_por_omision) suyos = sellos.filter((s) => s.cuenta_id === null);
    const ultimo = suyos.reduce<(typeof suyos)[number] | null>(
      (a, s) => (a === null || s.ultima_corrida_el.getTime() > a.ultima_corrida_el.getTime() ? s : a),
      null,
    );
    if (ultimo === null || ultimo.ultimo_estado !== 'saltada' || !esFaltaDeGhl(ultimo.ultimo_motivo)) continue;
    // Un pulso posterior: la conexión ya se cargó y alguien trajo. Un pulso sin corrida no es posterior a nada.
    const despues = pulsos.some(
      (p) => p.cuenta_id === c.id && p.ultima_corrida_el !== null && p.ultima_corrida_el.getTime() > ultimo.ultima_corrida_el.getTime(),
    );
    if (despues) continue;
    lista.push({ id: c.id, nombre: c.nombre, esPorOmision: c.es_por_omision, que: ultimo.ultimo_motivo });
  }
  return lista;
}

/**
 * Los de esa lista que son del alcance de quien mira. Un closer vinculado sólo en un cliente no puede arreglar la
 * conexión de otro ni ve sus contactos: el aviso de ése sería ruido permanente en su agenda. Quien ve todo, todos.
 */
export function delAlcance<T extends { id: string }>(clientes: readonly T[], alcance: AlcanceDelCloser | undefined): T[] {
  if (alcance?.tipo !== 'mio') return [...clientes];
  const suyos = new Set(alcance.vinculos.map((v) => v.cuentaId));
  return clientes.filter((c) => suyos.has(c.id));
}

/** Qué no se está trayendo, según la pantalla que lo dice. */
const LO_QUE_NO_SE_TRAE = {
  calendario: 'su calendario no se está leyendo',
  mensajes: 'sus mensajes no se están trayendo',
  datos: 'sus contactos y sus citas no se están trayendo',
} as const;

/** Lo que se le dice al cliente final: la conexión la carga la empresa, y él no ve Ajustes. */
export const LO_RESUELVE_LA_EMPRESA = 'Lo resuelve la empresa que te da acceso.';

/** El texto de la falta de un cliente: el de la empresa para el principal, el suyo para los demás. */
export function textoDeLaFalta(c: Pick<ClienteSinConexion, 'esPorOmision' | 'que'>): string {
  return (c.esPorOmision ? TEXTO_DE_FALTA_GHL : TEXTO_DE_FALTA_GHL_DEL_CLIENTE)[c.que];
}

/**
 * El aviso, una frase por cliente, o `null` sin ninguno. Pura. El prefijo es neutro y el resto es el texto del código,
 * que dice qué hacer y dónde; para el cliente final, sin la ruta de Ajustes, que no ve.
 */
export function avisoSinConexion(
  clientes: readonly Pick<ClienteSinConexion, 'nombre' | 'esPorOmision' | 'que'>[],
  que: keyof typeof LO_QUE_NO_SE_TRAE,
  paraElClienteFinal = false,
): string | null {
  if (clientes.length === 0) return null;
  return clientes
    .map(
      (c) =>
        `La conexión de «${c.nombre}» con GoHighLevel no está lista, así que ${LO_QUE_NO_SE_TRAE[que]}. ` +
        (paraElClienteFinal ? LO_RESUELVE_LA_EMPRESA : textoDeLaFalta(c)),
    )
    .join(' ');
}

/**
 * Por qué falta el gasto de un cliente (Acquisition y Conversion). Desde Meta directo el gasto sale de su conexión con
 * Meta, no de su GoHighLevel:
 *
 *   · `meta_sin_conectar`: el cliente no tiene ninguna cuenta publicitaria de Meta asignada (la pasada quedó `saltada`);
 *   · `meta_caida`: la tiene, pero Meta rechazó la conexión (se quitó la integración o venció): hay que volver a
 *     conectar;
 *   · `no_activo`: el cliente está en pausa o de baja, y el barrido no lo lee.
 */
export type FaltaDelGasto = 'meta_sin_conectar' | 'meta_caida' | 'no_activo';

export interface FaltaDelGastoDeUnCliente {
  /** El nombre del cliente. */
  cliente: string;
  falta: FaltaDelGasto;
}

/**
 * De esos clientes —los que dejan el gasto incompleto—, los que se sabe por qué, ordenados por nombre. El que no se
 * sabe no se lista: la nota sigue con «Faltan días de gasto.», que es lo único cierto. Sólo nombra a los que se nombran
 * (`seNombra`), así que con un solo cliente devuelve vacío.
 */
export async function faltaDelGastoDe(cuentas: readonly string[]): Promise<FaltaDelGastoDeUnCliente[]> {
  const ids = new Set(cuentas.filter((c) => typeof c === 'string' && c !== ''));
  if (ids.size === 0) return [];
  const clientes = await datos().selectFrom('cuentas').select(['id', 'nombre', 'es_por_omision', 'estado']).execute();
  const activos = clientes.filter((c) => c.estado === 'activa').length;
  const nombrados = clientes.filter((c) => ids.has(c.id) && seNombra({ esPorOmision: c.es_por_omision }, activos));
  if (nombrados.length === 0) return [];

  const anuncios = await datos()
    .selectFrom('tareas_programadas')
    .select(['cuenta_id', 'ultimo_estado', 'ultimo_motivo'])
    .where('tarea', '=', 'anuncios')
    .execute();

  const lista: FaltaDelGastoDeUnCliente[] = [];
  for (const c of nombrados) {
    if (c.estado !== 'activa') {
      lista.push({ cliente: c.nombre, falta: 'no_activo' });
      continue;
    }
    /* El sello de su pasada de anuncios dice por qué. El principal sin sello propio toma el sin cuenta, como la
       frescura: los de antes del barrido por cliente eran del trabajo con las credenciales de la empresa. */
    const sello = anuncios.find((a) => a.cuenta_id === c.id) ?? (c.es_por_omision ? anuncios.find((a) => a.cuenta_id === null) : undefined);
    const motivo = sello?.ultimo_motivo ?? '';
    if (sello?.ultimo_estado === 'saltada' && motivo === TEXTO_DE_FALTA_CUENTAS_DE_META.sin_cuentas_de_meta) {
      lista.push({ cliente: c.nombre, falta: 'meta_sin_conectar' });
    } else if (
      (sello?.ultimo_estado === 'saltada' &&
        (motivo === TEXTO_DE_FALTA_CUENTAS_DE_META.conexion_de_meta_caida || motivo === TEXTO_DE_FALTA_CUENTAS_DE_META.token_de_meta_ilegible)) ||
      motivo.includes(MOTIVO_META_RECHAZADA)
    ) {
      lista.push({ cliente: c.nombre, falta: 'meta_caida' });
    }
  }
  return lista.sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'));
}
