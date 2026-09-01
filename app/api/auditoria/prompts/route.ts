// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Guardar el prompt de referencia de un agente. **Vaciarlo lo BORRA.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// PIDE `auditor.editar` Y NO `auditor.ver`, Y ESO NO CONTRADICE `ADR-0304`
//
// Esa regla compara los conjuntos de capacidades de los **`GET`** de una misma pantalla, porque el
// defecto que previene es de LECTURAS: quien abría una pantalla de cinco secciones autorizado en una
// *«veía una sección con datos y cuatro en blanco, sin ningún error»*.
//
// Un botón deshabilitado no es un panel vacío — se ve que está y se ve que no se puede. Por eso esta
// ruta no tiene `GET`: el prompt viaja con la pantalla, y lo único que vive acá es la escritura.
//
// Y la separación compra algo real: editar este texto cambia **cómo se juzga a todos los agentes de
// esa empresa**, y existe un puesto plausible que necesite ver los hallazgos sin poder tocarlo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// VACIAR ES BORRAR, Y ES AL REVÉS QUE EN UNA CREDENCIAL
//
// En `app/api/credenciales` un campo que llega vacío **no toca** el secreto guardado: un formulario
// mandado con el token en blanco no debe desconectarle la cuenta a nadie.
//
// Acá es al contrario y tiene que serlo: vaciar el cuadro es **el único gesto disponible** para decir
// «este agente vuelve a no tener prompt de referencia». Sin él no habría forma de deshacer una carga.
//
// La respuesta dice **cuál de las tres cosas pasó** —guardado, borrado, o no había nada— y la tercera
// no es un error: quien vacía un campo que ya estaba vacío consiguió lo que quería.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { guardarPromptDelAgente } from '../../../../lib/auditor/prompts.ts';
import { AGENTES, type Agente } from '../../../../lib/auditor/veredicto.ts';

export const PANTALLA = 'auditoria';

/**
 * El tope del prompt.
 *
 * ── EL NÚMERO SALE DEL TECHO DE TOKENS, NO DE UN GUSTO ─────────────────────
 *
 * El prompt entra al bloque estable de `system` en cada análisis. Un prompt gigante no rompe nada de
 * forma visible: **encarece cada inferencia** y empuja la respuesta contra `TECHO_DE_TOKENS`, y ahí el
 * final es un truncado — que pierde el análisis entero con el dinero ya gastado.
 *
 * Treinta mil caracteres son unos 8.000 tokens, la mitad del techo. Es holgado para un prompt de
 * agente real y deja lugar para el transcript y la respuesta.
 */
const TOPE_DEL_PROMPT = 30_000;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  agente_invalido: 'Ese agente no existe. Los que hay son los dos de chat.',
  texto_invalido: 'El prompt tiene que ser un texto.',
  texto_largo: `El prompt no puede pasar de ${TOPE_DEL_PROMPT.toLocaleString('es')} caracteres.`,
} as const;

export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['auditor.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }

  /* El agente se valida contra `AGENTES` y no contra una lista escrita acá: son la misma lista que el
     `check` de la base y que el enumerado del esquema del modelo, y una cuarta copia divergiría. */
  const agente = cuerpo.agente;
  if (typeof agente !== 'string' || !(AGENTES as readonly string[]).includes(agente)) {
    return rechazo('peticion_invalida', MOTIVOS.agente_invalido);
  }

  /* `typeof !== 'string'` y no `!texto`: la cadena vacía es un valor VÁLIDO y significa borrar. Con la
     comprobación de veracidad, vaciar el cuadro devolvería «el prompt tiene que ser un texto» — el
     rechazo de la única operación que no se puede hacer de otra forma. */
  const texto = cuerpo.texto;
  if (typeof texto !== 'string') return rechazo('peticion_invalida', MOTIVOS.texto_invalido);
  if (texto.length > TOPE_DEL_PROMPT) return rechazo('peticion_invalida', MOTIVOS.texto_largo);

  const que = await conOrganizacion(contexto.orgEfectiva, () =>
    guardarPromptDelAgente(agente as Agente, texto, contexto.usuarioId),
  );

  return ok({ que });
}
