// El estado del cerebro para quien mira: una unión, nunca un booleano (`T-13`;
// `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-52). La pantalla dibuja la caja según esto, y el servidor
// rechaza el POST con lo mismo: lo que la caja promete es lo que la ruta cumple.

import type { LlaveDeIa } from '../../credenciales/resolver.ts';
import { quedaLugar, type LoUsadoHoy } from './topes.ts';

export type EstadoDelCerebro =
  | { tipo: 'listo' }
  /** No tiene `cerebro.usar`: la caja no se dibuja. */
  | { tipo: 'sin_permiso' }
  /** Está mirando otra empresa: el cerebro no responde bajo delegación (`D-17`). */
  | { tipo: 'delegacion' }
  /** Ninguna pestaña que ve tiene herramientas: no hay qué leer (AG-43). */
  | { tipo: 'sin_datos' }
  /** Sin llave de IA, o ilegible. `puedeCargarla` decide si la pantalla ofrece ir a Ajustes. */
  | { tipo: 'sin_llave'; puedeCargarla: boolean }
  | { tipo: 'llave_ilegible'; puedeCargarla: boolean }
  /** Llegó al tope del día, suyo o de la empresa: cuál, y cuándo se renueva. */
  | { tipo: 'tope'; tope: number; de: 'persona' | 'empresa'; renuevaEl: string };

export function estadoDelCerebro(p: {
  permisos: ReadonlySet<string>;
  mirandoOtraOrganizacion: boolean;
  llave: LlaveDeIa;
  /** Lo usado hoy. Sin él (todavía no se contó) no se dice `tope`. */
  usado?: LoUsadoHoy;
  /** Si alguna pestaña que ve tiene herramientas. Sin el dato, se supone que sí. */
  conHerramientas?: boolean;
}): EstadoDelCerebro {
  if (!p.permisos.has('cerebro.usar')) return { tipo: 'sin_permiso' };
  if (p.mirandoOtraOrganizacion) return { tipo: 'delegacion' };
  if (p.conHerramientas === false) return { tipo: 'sin_datos' };
  const puedeCargarla = p.permisos.has('credenciales.ver');
  if (p.llave.tipo === 'falta') {
    return p.llave.que === 'llave_de_ia_ilegible' ? { tipo: 'llave_ilegible', puedeCargarla } : { tipo: 'sin_llave', puedeCargarla };
  }
  if (p.usado && !quedaLugar(p.usado)) return estadoDeTope(p.usado);
  return { tipo: 'listo' };
}

/** El estado `tope` de lo usado: el de la persona si llegó al suyo, si no el de la empresa. */
export function estadoDeTope(u: LoUsadoHoy): Extract<EstadoDelCerebro, { tipo: 'tope' }> {
  const dePersona = u.usadasPorPersona >= u.porPersona;
  return { tipo: 'tope', tope: dePersona ? u.porPersona : u.porEmpresa, de: dePersona ? 'persona' : 'empresa', renuevaEl: u.renuevaEl.toISOString() };
}
