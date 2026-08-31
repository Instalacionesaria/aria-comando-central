// La ATRIBUCIÓN: quién dijo cada línea. **El cimiento del auditor, y su regla innegociable.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA, Y POR QUÉ ES LO PRIMERO QUE SE CONSTRUYE
//
// > **Solo se le puede imputar al agente lo que dice una línea del agente.** Si el problema lo causó
// > una automatización, un asesor humano o una línea sin origen, **no es un hallazgo del agente**: se
// > puede mencionar para entender la conversación, pero no se reporta como falla suya ni se propone
// > corregir su prompt por eso.
//
// Todo el módulo se apoya en esto. Un veredicto construido sobre una atribución equivocada no falla:
// produce un hallazgo **convincente y falso** sobre un trabajo que el agente no hizo, y propone
// corregir un prompt que no escribió esa línea.
//
// ── EL DATO QUE HAY NO ALCANZA SOLO, Y ESO ESTÁ MEDIDO ──────────────────────
//
// `negocio.mensajes.autor` tiene tres valores y **`'agente'` es un cajón de sastre**: `autorDe()` en
// `lib/negocio/ingesta.ts` lo pone para **todo** saliente cuya fuente no sea `app`, así que ahí
// adentro caben el agente de IA, cualquier flujo automático del CRM y cualquier envío por un canal que
// no informe su origen. Y el webhook usa la misma regla asimétrica sin mirar la fuente.
//
// **Esa asimetría es correcta y no se toca.** Su motivo está escrito en la ingesta: *«atribuirle a
// alguien un mensaje que disparó una automatización es el error que vuelve inservible el historial; el
// error inverso —dar por automático algo que escribió una persona— no le pone el nombre de nadie a
// nada»*. Para el historial alcanza. Para el auditor, no.
//
// Lo que cierra la brecha es `autor_ghl_usuario_id` más **un dato de configuración**: cuál de esos
// identificadores es el agente. Ver la migración 026, donde está la medición que lo justifica.
//
// ── LAS CINCO ETIQUETAS, Y POR QUÉ SON CINCO ────────────────────────────────
//
// El transcript **etiqueta, no filtra**, y filtrar a los que no son el agente produce cinco defectos
// concretos que el diseño de origen enumera:
//
//   1 · La bronca del contacto suele responder a **una plantilla automática**. Sin verla, el auditor
//       le atribuye el enojo al agente.
//   2 · Un **asesor humano posterior** convierte «dejó de responder» en un traspaso.
//   3 · Si la promesa incorrecta la hizo una plantilla, **la corrección va al flujo, no al prompt**.
//   4 · «Insiste y no entiende» se juzga **contando turnos**; sacar mensajes cambia la cuenta.
//   5 · La evidencia que se guarda tiene que poder **recortarse del mismo transcript** que vio el
//       modelo.
//
// Así que las líneas ajenas viajan **con su etiqueta**, y la etiqueta lleva adentro la instrucción de
// no imputar nada de esa línea.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quién dijo una línea. **Cinco valores, y solo uno es imputable.**
 *
 * Los nombres viajan al modelo tal cual, en mayúsculas, como prefijo de cada línea del transcript.
 */
export type AutorDeLaLinea =
  /** La persona. Es a quien se atiende. */
  | 'CONTACTO'
  /** El agente automático **que se está auditando**. La única línea imputable. */
  | 'AGENTE IA'
  /** Una persona del equipo escribiendo a mano. */
  | 'ASESOR HUMANO'
  /** Una plantilla enviada por un flujo del CRM. **No la escribió el agente.** */
  | 'AUTOMATIZACIÓN'
  /** El sistema no pudo atribuir esa línea. **No es el contacto.** */
  | 'ORIGEN NO IDENTIFICADO';

/** La única etiqueta a la que se le puede imputar un hallazgo. */
export const IMPUTABLE: AutorDeLaLinea = 'AGENTE IA';

/**
 * Lo mínimo que hace falta de un mensaje para atribuirlo. **No es la fila entera** a propósito: esta
 * función es isomorfa y no tiene que conocer el esquema.
 */
export interface LineaAAtribuir {
  direccion: 'entrante' | 'saliente';
  autor: 'contacto' | 'agente' | 'persona';
  autor_ghl_usuario_id?: string | null;
}

/**
 * A quién se le atribuye una línea.
 *
 * @param linea Los tres campos que deciden.
 * @param idDelAgente El identificador del agente en el CRM de **esta** empresa, o `null` si nadie lo
 *   configuró. **Sin valor por omisión**: un valor por omisión acá haría que una empresa sin
 *   configurar atribuyera al agente todo lo que no es del contacto — exactamente el defecto que esta
 *   función existe para cerrar.
 *
 * ── EL ORDEN DE LAS RAMAS ES EL DE LA CERTEZA, DE MÁS A MENOS ──────────────
 *
 * Y la última rama es la que importa: **un origen desconocido NO es el contacto y NO es el agente.**
 * Cuando todo lo que no era del agente se le presentaba al modelo como dicho por la persona, los
 * turnos de herramienta entraban *como si el contacto los hubiera pronunciado* — y sobre esa base el
 * auditor le imputa a una persona real algo que escribió una función.
 */
export function atribuir(linea: LineaAAtribuir, idDelAgente: string | null): AutorDeLaLinea {
  /* 1 · Lo que entra es del contacto, y de nadie más. Es el único hecho que la base garantiza con un
     `check`: `direccion` no admite un tercer valor. */
  if (linea.direccion === 'entrante') return 'CONTACTO';

  /* 2 · Una persona de esta plataforma. `autor = 'persona'` solo lo escribe la ingesta cuando el CRM
     dice `fuente === 'app'`, o sea que alguien lo tipeó ahí. Es el dato más confiable que hay sobre
     los salientes, y va ANTES del identificador: si las dos cosas se contradijeran —una persona con
     el identificador del agente— gana «persona», porque el error de dar por humano algo automático no
     le pone el nombre de nadie a nada, y el inverso sí. */
  if (linea.autor === 'persona') return 'ASESOR HUMANO';

  /* 3 · El agente, y es la ÚNICA rama imputable. Exige las dos cosas: que la empresa haya configurado
     quién es su agente, y que el identificador coincida.

     `idDelAgente` nulo cae abajo a propósito. La alternativa —tratar «no configurado» como «es el
     agente»— convertiría cada saliente automático en un hallazgo imputable, que es el defecto entero. */
  if (idDelAgente !== null && linea.autor_ghl_usuario_id === idDelAgente) return 'AGENTE IA';

  /* 4 · Sin identificador y sin ser persona: un flujo del CRM. Medido en producción el 2026-08-31:
     919 de 2.737 salientes no traen identificador, y son los flujos automáticos. Se etiqueta como lo
     que es, para que el modelo pueda leer la plantilla que provocó el enojo sin imputársela al
     agente. */
  if (linea.autor_ghl_usuario_id === null || linea.autor_ghl_usuario_id === undefined) {
    return 'AUTOMATIZACIÓN';
  }

  /* 5 · Trae un identificador que no es el del agente. Puede ser un asesor que escribió desde el CRM
     —y no desde acá, así que la ingesta no lo marcó como persona— o una integración que no conocemos.
     **No se adivina cuál.** La etiqueta dice que no se sabe, que es más útil que elegir mal: con
     «asesor humano» el auditor daría por traspasada una conversación que nadie tomó. */
  return 'ORIGEN NO IDENTIFICADO';
}

/**
 * El texto que se le manda al modelo explicando cada etiqueta. **Va adentro del prompt**, no en un
 * comentario.
 *
 * Que la instrucción viaje pegada a la etiqueta y no en una sección aparte es deliberado: es la
 * diferencia entre una regla que el modelo tiene que recordar mientras lee cincuenta líneas y una que
 * está escrita al lado de cada una.
 */
export const COMO_LEER_LOS_AUTORES: Readonly<Record<AutorDeLaLinea, string>> = {
  CONTACTO: 'La persona a la que se atiende.',
  'AGENTE IA':
    'El agente automático que estás auditando. **Es la única línea a la que le podés imputar un ' +
    'hallazgo.**',
  'ASESOR HUMANO':
    'Una persona del equipo escribiendo a mano. Lo que dice NO es del agente: si resolvió algo que ' +
    'el agente no pudo, eso es un traspaso y no un abandono.',
  'AUTOMATIZACIÓN':
    'Una plantilla que mandó un flujo del CRM. **No la escribió el agente.** Si provocó el enojo del ' +
    'contacto o hizo una promesa incorrecta, la corrección va al flujo y no al prompt del agente.',
  'ORIGEN NO IDENTIFICADO':
    'No se pudo saber quién mandó esta línea. **Ni el agente ni el contacto: no imputes nada de esta ' +
    'línea.** Sirve para entender la conversación y nada más.',
};
