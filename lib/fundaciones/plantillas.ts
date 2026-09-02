// El motor de plantillas de las metodologías, y la lectura de los archivos `SKILL.md`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ LA METODOLOGÍA VIVE EN ARCHIVOS Y NO EN CADENAS DE TypeScript
//
// Es el mismo mecanismo que ARIA-brain: cada herramienta tiene un `SKILL.md` con la metodología, y
// el código solo le pasa datos. Los archivos de `./skills/` son COPIAS BYTE A BYTE de
// `ARIA-brain/app-next/public/skills/`, y esa fidelidad es el punto: cuando Jorge corrige un
// framework, el diff entre los dos árboles tiene que ser legible. Reescribirlos "más prolijos" acá
// convertiría cada corrección futura en una traducción a mano.
//
// La sintaxis es la del hub y no se extiende:
//   {{clave}}              interpola (rutas con punto: {{_sop.etapa}})
//   {{#clave}}…{{/clave}}  incluye el bloque si el valor es verdadero
//   {{^clave}}…{{/clave}}  incluye el bloque si el valor es falso
//
// ── EL SUPLENTE NO ES UN RESPALDO SILENCIOSO ─────────────────────────────────
//
// Si el archivo no se puede leer, se usa el prompt embebido en `prompts.ts` — igual que el hub. La
// diferencia con el hub es que acá la generación DEVUELVE cuál de los dos usó (`origen`), y la
// interfaz lo muestra. Un suplente invisible es la forma exacta del defecto que este repositorio
// más persigue: el documento sale, se ve bien, y nadie sabe que se generó con la metodología
// vieja. Este archivo no decide el suplente; solo informa que no pudo leer el archivo.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** De dónde salió el prompt que se usó. Viaja hasta la interfaz. */
export type OrigenDePrompt = 'skill' | 'suplente';

/** Los datos que se interpolan. Los prompts del hub usan claves con prefijo `_` para derivados. */
export type DatosDePlantilla = Record<string, unknown>;

/**
 * La raíz de los archivos de metodología.
 *
 * `process.cwd()` y no `import.meta.url`: en el paquete construido los módulos quedan agrupados y
 * la ruta relativa al módulo no existe, mientras que el directorio de trabajo de una función SÍ es
 * la raíz de la aplicación. Los archivos entran al paquete por `outputFileTracingIncludes` en
 * `next.config.mjs` — sin esa entrada, la lectura falla en producción y funciona en desarrollo, que
 * es la peor combinación posible.
 */
function rutaDeSkill(id: string): string {
  return join(process.cwd(), 'lib', 'fundaciones', 'skills', id, 'SKILL.md');
}

/**
 * Quita el frontmatter YAML: es metadata, no plantilla.
 *
 * ── EL `\r?` NO ES DEFENSA POR COSTUMBRE: SIN ÉL, ESTA FUNCIÓN NO HACE NADA ──
 *
 * El patrón pedía `---\n` exacto. Los `SKILL.md` son copias byte a byte de las del hub, y el
 * desarrollo es en Windows con `core.autocrlf = true`, así que en el disco local dicen `---\r\n`:
 * el patrón no coincide, la función devuelve el texto intacto, y el bloque YAML entero —`name`,
 * `description`, `version`— entra al prompt como si fuera metodología.
 *
 * Y el modo de fallo es el peor de los dos posibles: **en producción funcionaba**. Vercel construye
 * sobre Linux, donde el mismo archivo está en LF. O sea que el defecto vivía solo en la máquina
 * donde se mide — cualquier medición local del prompt traía doscientos caracteres que allá no
 * estaban, y una diferencia así es exactamente lo que descarrila un diagnóstico.
 *
 * Con el `\r?` la función da lo mismo en las dos plataformas y deja de depender de una
 * configuración de git para ser correcta. El `.gitattributes` fija además el final de línea de
 * estos archivos, que es el otro cinturón: así lo que se mide acá es lo que corre allá.
 */
function sinFrontmatter(texto: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(texto);
  return m && m[0] ? texto.slice(m[0].length).replace(/^\r?\n/, '') : texto;
}

/**
 * La plantilla de una metodología, o `null` si no se pudo leer.
 *
 * **No cachea, a propósito.** Un `Map` en el nivel superior de un módulo de servidor es lo que
 * `ADR-0703` prohíbe, y acá no haría falta ni siquiera si estuviera permitido: son dos kilobytes
 * de disco contra una generación que tarda segundos.
 */
export function leerPlantilla(id: string): string | null {
  try {
    return sinFrontmatter(readFileSync(rutaDeSkill(id), 'utf8'));
  } catch {
    return null;
  }
}

/** Resuelve una ruta con puntos (`_sop.etapa`) sobre los datos. */
function porRuta(datos: DatosDePlantilla, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => {
    if (o === null || o === undefined || typeof o !== 'object') return undefined;
    return (o as Record<string, unknown>)[k];
  }, datos);
}

/**
 * Interpola una plantilla. Puerto del `renderSkillTemplate` del hub.
 *
 * Los bloques condicionales se procesan con pasadas repetidas hasta que el texto deja de cambiar,
 * que es lo que permite anidarlos. El bucle termina siempre: cada pasada solo puede QUITAR texto
 * (un bloque se reemplaza por su cuerpo o por nada), nunca agregarlo.
 */
export function interpolar(plantilla: string, datos: DatosDePlantilla): string {
  return conFaltantes(plantilla, datos).texto;
}

/**
 * Lo mismo, y ADEMÁS qué claves de la plantilla el constructor de datos no produjo.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * POR QUÉ HACE FALTA SABER ESO, SI LA INTERPOLACIÓN NO FALLA NUNCA
 *
 * Justamente por eso. Una `{{clave}}` que nadie produce se reemplaza por **cadena vacía**: el prompt
 * sale con un hueco, el modelo lo rellena inventando, y el documento se ve perfecto. Es el defecto
 * que `pruebas/codigo/90-fundaciones.test.ts` dice perseguir en su comentario más largo.
 *
 * Y no lo perseguía. Esa prueba busca `{{…}}` en la SALIDA, y en la salida no queda nada: la clave
 * desaparecida no deja marca. O sea que comprobaba lo único que este motor no puede producir —una
 * llave sin resolver— y daba verde sobre el defecto real. Un bloque sin cerrar sí lo atrapa, que es
 * bastante menos de lo que su comentario prometía.
 *
 * Acá la ausencia se puede ver, porque se mira mientras se reemplaza y no después.
 *
 * ── `undefined` ES LA FALTA; `null` ES UN DATO ───────────────────────────────
 *
 * Los constructores ponen `null` a propósito cuando algo no existe todavía —`_crossContext: null`
 * cuando el alumno no generó nada, `_vslCommitments: null` cuando no hay VSL— y los `SKILL.md`
 * tienen una rama entera para ese caso (`{{^_crossContext}}`). Eso NO es una falta: es la respuesta
 * correcta. La falta es que la clave no exista, que es lo que pasa cuando alguien agrega una
 * variable a un `SKILL.md` y se olvida del constructor, o le cambia el nombre a una.
 */
export function conFaltantes(
  plantilla: string,
  datos: DatosDePlantilla,
): { texto: string; faltantes: readonly string[] } {
  const faltantes = new Set<string>();
  const anotar = (clave: string): unknown => {
    const v = porRuta(datos, clave);
    if (v === undefined) faltantes.add(clave);
    return v;
  };

  const bloque = /\{\{([#^])([\w.]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g;
  let anterior: string | null = null;
  let salida = plantilla;
  while (anterior !== salida) {
    anterior = salida;
    salida = salida.replace(bloque, (_m, tipo: string, clave: string, cuerpo: string) => {
      const verdadero = !!anotar(clave);
      return (tipo === '#' ? verdadero : !verdadero) ? cuerpo : '';
    });
  }

  const texto = salida.replace(/\{\{([\w.]+)\}\}/g, (_m, clave: string) => {
    const v = anotar(clave);
    return v === undefined || v === null ? '' : String(v);
  });

  return { texto, faltantes: [...faltantes] };
}

/** El prompt final: el archivo de metodología si se pudo leer, y si no el suplente embebido. */
export function promptDe(
  id: string,
  datos: DatosDePlantilla,
  suplente: (d: DatosDePlantilla) => string,
): { texto: string; origen: OrigenDePrompt } {
  const plantilla = leerPlantilla(id);
  if (plantilla === null) return { texto: suplente(datos), origen: 'suplente' };
  return { texto: interpolar(plantilla, datos), origen: 'skill' };
}
