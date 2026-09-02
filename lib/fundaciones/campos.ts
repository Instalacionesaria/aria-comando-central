// Los campos de una herramienta, y la traducción entre el formulario y el almacén.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CLAVE CORTA ES UN CONTRATO CON ARIA-BRAIN, NO UN DETALLE
//
// El hub guarda los inputs de cada herramienta con la clave del campo SIN su prefijo:
// `t4-niche` se persiste como `niche`, `t2cat-current` como `current`. La regla exacta es
// `id.split('-').slice(1).join('-')`, y de esas claves cortas leen todas las herramientas de
// aguas abajo cuando heredan contexto.
//
// Entonces: acá NO hay una lista de claves. Se DERIVAN de los identificadores de campo del
// registro de herramientas, que a su vez son los del hub. Una lista aparte sería la *lista
// paralela* que este repositorio ya nombró como su defecto natural (`lib/autorizacion/secciones.ts`):
// dos fuentes de verdad que divergen sin que nada falle, porque los dos lados siguen siendo listas
// válidas de cadenas.
//
// Lo que sí hay es una PRUEBA que congela el resultado esperado —`pruebas/codigo/90-fundaciones`—,
// porque una derivación correcta sobre identificadores mal copiados también deriva bien.
// ═══════════════════════════════════════════════════════════════════════════════

import { FUNDACIONES, type Campo, type Herramienta } from './herramientas.ts';

/** El valor que el hub escribe cuando un campo quedó vacío. Se conserva literal. */
export const SIN_ESPECIFICAR = '(no especificado)';

/**
 * La clave con la que se persiste un campo: su identificador sin el prefijo `tN-`.
 *
 * `t1-biz` → `biz` · `t2cat-current` → `current` · `mr-niche` → `niche`
 */
export function claveCorta(idCampo: string): string {
  const partes = idCampo.split('-');
  return partes.length > 1 ? partes.slice(1).join('-') : idCampo;
}

/** Todos los campos de una herramienta, planos y en orden de aparición. */
export function camposDe(h: Herramienta): readonly Campo[] {
  return h.filas.flatMap((f) => f.campos);
}

/** Los identificadores de campo de una herramienta, por su id del hub. */
export function idsDeCampos(id: number): readonly string[] {
  const h = FUNDACIONES.find((x) => x.id === id);
  return h ? camposDe(h).map((c) => c.id) : [];
}

/**
 * Almacén → formulario. Las claves del resultado son identificadores de campo.
 *
 * Un `(no especificado)` guardado NO se devuelve: si lo hiciera, el marcador del campo quedaría
 * tapado por un texto que el alumno nunca escribió, y el formulario mentiría sobre lo que tiene.
 */
export function aValoresDeFormulario(
  ids: readonly string[],
  guardado: Record<string, string> | undefined,
): Record<string, string> {
  const salida: Record<string, string> = {};
  if (!guardado) return salida;
  for (const id of ids) {
    const valor = guardado[claveCorta(id)];
    if (valor !== undefined && valor !== null && valor !== SIN_ESPECIFICAR) salida[id] = valor;
  }
  return salida;
}

/**
 * Formulario → almacén, con claves cortas y con `(no especificado)` en los vacíos.
 *
 * El relleno explícito es lo que hace que el prompt sea legible del otro lado: los prompts del hub
 * interpolan el valor tal cual, y una cadena vacía produciría `NICHO: ` — una línea que el modelo
 * lee como un dato en blanco en vez de como un dato ausente.
 */
export function aValoresDeAlmacen(
  ids: readonly string[],
  valores: Record<string, string>,
): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const id of ids) {
    const valor = valores[id];
    salida[claveCorta(id)] = valor && valor.trim() !== '' ? valor : SIN_ESPECIFICAR;
  }
  return salida;
}

/**
 * El valor de un campo tal como lo interpolan los prompts: el texto, o `(no especificado)`.
 *
 * Es el `v(id)` del hub, con una diferencia que importa: allá leía del DOM, acá recibe el mapa de
 * valores. La construcción del prompt corre en el SERVIDOR, y en el servidor no hay DOM.
 */
export function valor(valores: Record<string, string>, id: string): string {
  const v = valores[id];
  return v && v.trim() !== '' ? v : SIN_ESPECIFICAR;
}

/** ¿Este campo tiene algo que el alumno haya escrito? */
export function presente(valores: Record<string, string>, id: string): boolean {
  const v = valor(valores, id);
  return v !== SIN_ESPECIFICAR;
}

/**
 * Los campos que hay que tener SÍ O SÍ y todavía están vacíos.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ESTA REGLA LA COMPARTEN EL FORMULARIO Y EL AGENTE, Y POR ESO VIVE ACÁ
 *
 * «Obligatorio» es lo que queda después de sacar dos cosas, y ninguna de las dos es una lista:
 *
 *   · los `opcional` — la etiqueta ya se lo dice a la persona (`Contrato inicial mínimo
 *     (opcional)`), y la bandera se lo dice al código;
 *   · los que tienen `valorPorOmision` — nunca están vacíos: si nadie escribe nada, vale el
 *     valor de omisión, que es lo que el formulario ya muestra al abrirse.
 *
 * El Research tenía esta regla escrita a mano y DOS VECES en `PanelResearch`: `faltaNicho` y
 * `faltaExperiencia`, dos constantes con los identificadores adentro. Funcionaba, y era la lista
 * paralela de siempre esperando el día en que alguien agregara un sexto criterio obligatorio y se
 * olvidara de la constante: el botón se habilitaría igual, el paso 1 buscaría sin ese dato y el
 * documento saldría genérico sin que nada fallara.
 *
 * Con el agente conversacional la misma regla necesitaba un TERCER lugar —el servidor, que decide
 * si ya se puede arrancar— y tres copias de una regla es donde este repositorio ya sabe cómo
 * termina. Es una sola, derivada del catálogo, y las tres la llaman.
 */
export function obligatoriosQueFaltan(
  h: Herramienta,
  valores: Record<string, string>,
): readonly Campo[] {
  return camposDe(h).filter((campo) => {
    if (campo.opcional) return false;
    if (campo.valorPorOmision) return false;
    return !presente(valores, campo.id);
  });
}

/**
 * Los valores con el `valorPorOmision` puesto donde el campo quedó vacío.
 *
 * El formulario hace esto al abrirse —por eso «Compradores potenciales mínimos» ya dice `50,000+`
 * sin que nadie lo escriba—, y el agente conversacional necesita exactamente lo mismo del otro
 * lado: si la persona no dijo un número de compradores, el criterio no queda vacío, queda en el
 * valor de omisión. Sin esto, los dos modos generarían el research con criterios distintos a partir
 * de la misma conversación.
 */
export function conValoresPorOmision(
  h: Herramienta,
  valores: Record<string, string>,
): Record<string, string> {
  const salida: Record<string, string> = { ...valores };
  for (const campo of camposDe(h)) {
    const v = salida[campo.id];
    if ((v === undefined || v.trim() === '') && campo.valorPorOmision) {
      salida[campo.id] = campo.valorPorOmision;
    }
  }
  return salida;
}
