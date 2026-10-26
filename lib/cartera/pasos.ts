// La lista de chequeo: qué le falta a un cliente, o a una empresa, para estar «configurado».
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ QUIERE DECIR «CONFIGURADO»
//
// El tablero de Negocios pregunta, por cada empresa y cada cliente, si está configurado. La pregunta no tenía
// respuesta en ningún lado: había señales sueltas (un token cargado, un nicho confirmado, una zona que no es UTC).
// Esta lista las junta, con un estado por paso:
//
//   · `ok`: está;
//   · `falta`: no está, y se dice cuál;
//   · `sin_medir`: no se pudo saber (la medición de la empresa falló, o todavía no hay con qué). No es un «falta»: no
//     se acusa de algo que no se midió.
//
// Configurado = todos los pasos REQUERIDOS en `ok`, y el cliente activo (`clienteConfigurado`). Los recomendados se
// dicen, y no cuentan. La misma lista la usan la foto diaria (el contrato del agente), el tablero de Negocios y Ajustes
// › Clientes (`listaDeChequeoDelCliente`, en vivo).
//
// ── LOS DOS PASOS DE META (Meta directo, M4, 2026-10-26) ────────────────────
//
// Desde Meta directo los costos, las campañas y los anuncios de cada cliente salen de SU conexión con Meta («Conectar
// con Meta»), no del Ad Manager de su GoHighLevel (contrato 3, `103`):
//
//   · `meta`, «Meta conectado», REQUERIDO: al menos una cuenta publicitaria asignada al cliente y leída por una
//     conexión activa. Se lee de la configuración en vivo, sin ningún token (`lib/cartera/configuracion.ts`);
//   · `meta_leido`, «Campañas leídas de Meta», recomendado y MEDIDO con el sello de su pasada de anuncios o su gasto
//     en la ventana (`metaLeidoDe`, `lib/cartera/medicion.ts`): dice si la lectura anda, no si se conectó.
//
// Hasta el contrato 2 el requerido era «Meta vinculado en su GoHighLevel» (`meta_en_el_crm`, la 099) y `meta` era la
// conexión directa sólo para las miniaturas. Cambiar esta lista cambia el significado de `configurada` y de `faltan`
// en la foto: sube `CONTRATO_DE_LA_FOTO` (la 271 lo vigila).
//
// Pura y sin base: la prueban la 271 y la 299.
// ═══════════════════════════════════════════════════════════════════════════════

export type EstadoDelPaso = 'ok' | 'falta' | 'sin_medir';

export const PASOS_DEL_CLIENTE = [
  { clave: 'crm', nombre: 'CRM conectado', requerido: true },
  { clave: 'calendario', nombre: 'Calendario elegido', requerido: true },
  { clave: 'zona', nombre: 'Zona horaria', requerido: true },
  { clave: 'nicho', nombre: 'Nicho confirmado', requerido: true },
  { clave: 'datos', nombre: 'Datos de las últimas 24 horas', requerido: true },
  { clave: 'meta', nombre: 'Meta conectado', requerido: true },
  { clave: 'meta_leido', nombre: 'Campañas leídas de Meta', requerido: false },
  { clave: 'aviso', nombre: 'Avisos del CRM', requerido: false },
] as const;

export const PASOS_DE_LA_EMPRESA = [
  { clave: 'llave_de_ia', nombre: 'Llave de IA', requerido: true },
  { clave: 'zona', nombre: 'Zona horaria', requerido: true },
  { clave: 'un_cliente', nombre: 'Al menos un cliente configurado', requerido: true },
] as const;

export type PasoDelCliente = (typeof PASOS_DEL_CLIENTE)[number]['clave'];
export type PasoDeLaEmpresa = (typeof PASOS_DE_LA_EMPRESA)[number]['clave'];

/** Cuánto pueden tener los datos de un cliente para contar como al día. */
export const DATOS_AL_DIA_MS = 24 * 3600_000;

/** `UTC` es el valor por omisión de la columna: quiere decir «nadie lo dijo», no «está en UTC». */
const zonaElegida = (zona: string): boolean => zona !== '' && zona !== 'UTC';

/** Lo que se sabe de un cliente por su configuración: presencias de su conexión, su zona y su nicho. */
export interface LoQueSeSabeDeUnCliente {
  crmConectado: boolean;
  calendario: boolean;
  /** Meta conectado: una cuenta publicitaria asignada y leída por una conexión activa. De ahí salen sus costos. */
  meta: boolean;
  aviso: boolean;
  zonaHoraria: string;
  nichoConfirmado: boolean;
}

/** Lo que se MIDE de un cliente en la base, y no se lee de su configuración (`medirLosPasos`). */
export interface LoMedidoDeUnCliente {
  /** La marca de agua de su ingesta: `null` = nunca entró nada. */
  ultimaIngestaEl: Date | null;
  /** Si sus campañas se están leyendo de Meta (`metaLeidoDe`): `null` = todavía no se sabe. */
  metaLeido: boolean | null;
}

/**
 * Los pasos de un cliente.
 *
 * @param medido lo medido en la base; `undefined` = no se pudo medir (la medición de su empresa falló, o la foto no lo
 *   tiene): lo medido queda `sin_medir`, nunca `falta`.
 */
export function pasosDelCliente(
  c: LoQueSeSabeDeUnCliente,
  medido: LoMedidoDeUnCliente | undefined,
  ahora: number,
): Record<PasoDelCliente, EstadoDelPaso> {
  const si = (b: boolean): EstadoDelPaso => (b ? 'ok' : 'falta');
  const ingesta = medido?.ultimaIngestaEl;
  return {
    crm: si(c.crmConectado),
    calendario: si(c.calendario),
    zona: si(zonaElegida(c.zonaHoraria)),
    nicho: si(c.nichoConfirmado),
    datos: medido === undefined ? 'sin_medir' : si(ingesta != null && ahora - ingesta.getTime() <= DATOS_AL_DIA_MS),
    meta_leido: medido === undefined || medido.metaLeido === null ? 'sin_medir' : si(medido.metaLeido),
    meta: si(c.meta),
    aviso: si(c.aviso),
  };
}

export function pasosDeLaEmpresa(
  e: { llaveDeIa: boolean; zonaHoraria: string },
  clientesConfigurados: number,
): Record<PasoDeLaEmpresa, EstadoDelPaso> {
  const si = (b: boolean): EstadoDelPaso => (b ? 'ok' : 'falta');
  return { llave_de_ia: si(e.llaveDeIa), zona: si(zonaElegida(e.zonaHoraria)), un_cliente: si(clientesConfigurados > 0) };
}

/** Configurado: todos los requeridos en `ok`. */
export function configurado(
  pasos: Readonly<Record<string, EstadoDelPaso>>,
  lista: readonly { clave: string; requerido: boolean }[],
): boolean {
  return lista.every((p) => !p.requerido || pasos[p.clave] === 'ok');
}

/**
 * Un cliente configurado: activo y con todos sus requeridos en `ok`. Uno en pausa o de baja no se barre ni se mira, así
 * que no cuenta como configurado aunque tenga todo. La regla es una: la usan la foto, el tablero y Ajustes › Clientes.
 */
export function clienteConfigurado(estado: string, pasos: Readonly<Record<PasoDelCliente, EstadoDelPaso>>): boolean {
  return estado === 'activa' && configurado(pasos, PASOS_DEL_CLIENTE);
}

/** Lo que falta, por clave, en el orden de la lista: requeridos y recomendados. Lo no medido no se acusa. */
export function faltan(pasos: Readonly<Record<string, EstadoDelPaso>>, lista: readonly { clave: string }[]): string[] {
  return lista.filter((p) => pasos[p.clave] === 'falta').map((p) => p.clave);
}

/** Un paso de la lista como lo dibuja Ajustes › Clientes: nada más que esto viaja (ningún valor de la conexión). */
export interface PasoDeLaLista {
  clave: PasoDelCliente;
  nombre: string;
  requerido: boolean;
  estado: EstadoDelPaso;
}

export interface ListaDeChequeo {
  configurado: boolean;
  pasos: PasoDeLaLista[];
}

/** La lista de chequeo de un cliente, en el orden de `PASOS_DEL_CLIENTE`, con su estado y si está configurado. */
export function listaDeChequeoDelCliente(
  c: LoQueSeSabeDeUnCliente & { estado: string },
  medido: LoMedidoDeUnCliente | undefined,
  ahora: number,
): ListaDeChequeo {
  const pasos = pasosDelCliente(c, medido, ahora);
  return {
    configurado: clienteConfigurado(c.estado, pasos),
    pasos: PASOS_DEL_CLIENTE.map((p) => ({ clave: p.clave, nombre: p.nombre, requerido: p.requerido, estado: pasos[p.clave] })),
  };
}
