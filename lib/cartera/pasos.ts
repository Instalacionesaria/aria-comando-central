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
//   · `sin_medir`: no se pudo saber (la medición de la empresa falló). No es un «falta»: no se acusa de algo que no se
//     midió.
//
// Configurado = todos los pasos REQUERIDOS en `ok`. Los recomendados se dicen, y no cuentan.
// Pura y sin base: la prueba la 271.
// ═══════════════════════════════════════════════════════════════════════════════

export type EstadoDelPaso = 'ok' | 'falta' | 'sin_medir';

export const PASOS_DEL_CLIENTE = [
  { clave: 'crm', nombre: 'CRM conectado', requerido: true },
  { clave: 'calendario', nombre: 'Calendario elegido', requerido: true },
  { clave: 'zona', nombre: 'Zona horaria', requerido: true },
  { clave: 'nicho', nombre: 'Nicho confirmado', requerido: true },
  { clave: 'datos', nombre: 'Datos de las últimas 24 horas', requerido: true },
  { clave: 'meta', nombre: 'Meta conectado', requerido: false },
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

export interface LoQueSeSabeDeUnCliente {
  crmConectado: boolean;
  calendario: boolean;
  meta: boolean;
  aviso: boolean;
  zonaHoraria: string;
  nichoConfirmado: boolean;
}

/**
 * Los pasos de un cliente.
 *
 * @param ultimaIngestaEl la marca de agua de su ingesta: `null` = nunca entró nada; `undefined` = no se pudo medir.
 */
export function pasosDelCliente(
  c: LoQueSeSabeDeUnCliente,
  ultimaIngestaEl: Date | null | undefined,
  ahora: number,
): Record<PasoDelCliente, EstadoDelPaso> {
  const si = (b: boolean): EstadoDelPaso => (b ? 'ok' : 'falta');
  return {
    crm: si(c.crmConectado),
    calendario: si(c.calendario),
    zona: si(zonaElegida(c.zonaHoraria)),
    nicho: si(c.nichoConfirmado),
    datos: ultimaIngestaEl === undefined ? 'sin_medir' : si(ultimaIngestaEl !== null && ahora - ultimaIngestaEl.getTime() <= DATOS_AL_DIA_MS),
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

/** Lo que falta, por clave, en el orden de la lista: requeridos y recomendados. Lo no medido no se acusa. */
export function faltan(pasos: Readonly<Record<string, EstadoDelPaso>>, lista: readonly { clave: string }[]): string[] {
  return lista.filter((p) => pasos[p.clave] === 'falta').map((p) => p.clave);
}
