// Qué parámetros de publicidad de una persona se pueden mostrar. Por LISTA BLANCA, y en la lectura.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ATRIBUCIÓN SE GUARDA CRUDA, ASÍ QUE LA LISTA TIENE QUE ESTAR ACÁ
//
// `atribucion_primera` se guarda tal como la manda el CRM, sin lista blanca, porque las claves las
// decide GoHighLevel y ya manda cuatro que su documentación no menciona (`esquema.ts`). Eso está bien
// para guardar y es un peligro para mostrar: medido el 2026-09-27 sobre los 593 contactos, la misma
// columna trae `ip` en 331, `userAgent` en 331, `fbclid` en 286, y **286 direcciones con un token
// adentro** —un JWT, un `fbclid`, un `token=`—.
//
// Por eso la decisión de qué viaja se toma acá, clave por clave, y lo que no está en la lista no
// viaja. **Lista blanca y no negra**: una clave nueva que el CRM empiece a mandar mañana no aparece
// en la ficha hasta que alguien la mire y la agregue. Con una lista negra, aparecería sola.
//
// ── DE LAS DIRECCIONES, SÓLO EL SITIO ───────────────────────────────────────
//
// `url` y `referrer` son direcciones completas, y es ahí donde vive el token. Lo que dicen de útil
// —por qué página entró, desde qué sitio llegó— está en el host. El host lo saca la BASE con
// `hostDe` de `recorrido.ts`, la misma expresión que Conversion usa para clasificar el recorrido: si
// este archivo lo sacara por su cuenta, el sistema tendría dos ideas de qué es un host. Acá llega ya
// sacado, y la dirección entera no se lee nunca.
//
// ── ESTE ARCHIVO NO IMPORTA NADA ────────────────────────────────────────────
//
// Es una función pura sobre un objeto, para que la prueba de código la ejercite con un JWT de
// ejemplo sin montar una base.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un parámetro que la ficha puede mostrar, con su rótulo. */
export interface ParametroVisible {
  clave: string;
  rotulo: string;
  valor: string;
  /** Una aclaración que el valor solo no dice. `null` casi siempre. */
  nota: string | null;
}

/**
 * Las claves del primer toque que se muestran, en el orden en que se dibujan.
 *
 * Los rótulos dicen lo que la clave ES en esta subcuenta, no lo que su nombre sugiere: `utmMedium`
 * trae el NOMBRE del conjunto de anuncios —y un renombre en Meta parte la serie—, `utmTerm` trae su
 * identificador, y `utmContent` el nombre del anuncio, que es la llave de pieza que usa Creative.
 *
 * **Lo que no está, a propósito:** `ip`, `userAgent`, `fbclid`, `fbp`, `fbc` y `gaClientId`
 * identifican a la persona o a su navegador. `medium`, `mediumId`, `campaignId` y `adSource` no
 * identifican a nadie, pero tampoco se decidió mostrarlos (`docs/leads-portal/05-LA-FICHA-DEL-LEAD.md`,
 * LP05-P02): la lista es blanca, y entrar a ella es una decisión.
 */
export const CLAVES_VISIBLES: readonly { clave: string; rotulo: string }[] = [
  { clave: 'sessionSource', rotulo: 'Origen de la sesión' },
  { clave: 'utmSource', rotulo: 'Fuente' },
  { clave: 'campaign', rotulo: 'Campaña' },
  { clave: 'utmMedium', rotulo: 'Conjunto, por nombre' },
  { clave: 'utmTerm', rotulo: 'Conjunto, identificador' },
  { clave: 'utmContent', rotulo: 'Creativo' },
  { clave: 'adId', rotulo: 'Anuncio' },
  { clave: 'utmKeyword', rotulo: 'Palabra clave' },
];

/** Lo que la base ya resolvió y la función no puede sacar del objeto crudo. */
export interface AtribucionResuelta {
  /** El host de `url`, en minúsculas y sin puerto, sacado con `hostDe`. */
  hostDeLaUrl: string | null;
  /** El host de `referrer`, igual. */
  hostDelReferrer: string | null;
  /** El nombre del anuncio de `adId`, si cruza con `negocio.anuncios`. */
  nombreDelAnuncio: string | null;
}

/** Texto mostrable, o `null`: un vacío no es un valor, y un «Fuente: —» afirmaría algo. */
function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/**
 * Los parámetros del primer toque que se pueden mostrar, en orden.
 *
 * Recorre la LISTA, no el objeto: así una clave que no está en la lista no tiene cómo colarse,
 * aunque venga en el objeto. `url` y `referrer` no se leen del objeto nunca; sólo sus hosts, que
 * llegan en `resuelta`.
 */
export function atribucionVisible(
  cruda: Readonly<Record<string, unknown>> | null | undefined,
  resuelta: AtribucionResuelta,
): ParametroVisible[] {
  const salida: ParametroVisible[] = [];
  const origen = cruda ?? {};

  for (const { clave, rotulo } of CLAVES_VISIBLES) {
    const valor = texto(origen[clave]);
    if (valor === null) continue;
    if (clave === 'adId') {
      /* El id solo no le dice nada a nadie. Si cruza con los anuncios sincronizados, se muestra el
         nombre; si no, el id con la aclaración. Medido el 2026-09-27: 213 de 213 cruzan. */
      const nombre = texto(resuelta.nombreDelAnuncio);
      salida.push(
        nombre === null
          ? { clave, rotulo, valor, nota: 'No está entre los anuncios sincronizados de Meta.' }
          : { clave, rotulo, valor: nombre, nota: null },
      );
      continue;
    }
    salida.push({ clave, rotulo, valor, nota: null });
  }

  const hostUrl = texto(resuelta.hostDeLaUrl);
  if (hostUrl !== null) {
    salida.push({
      clave: 'url',
      rotulo: 'Página de entrada',
      valor: hostUrl,
      nota: 'Sólo el sitio: la dirección completa puede llevar un identificador de la persona.',
    });
  }
  const hostReferrer = texto(resuelta.hostDelReferrer);
  if (hostReferrer !== null) {
    salida.push({
      clave: 'referrer',
      rotulo: 'Llegó desde',
      valor: hostReferrer,
      nota: 'Sólo el sitio, por lo mismo que la página de entrada.',
    });
  }
  return salida;
}
