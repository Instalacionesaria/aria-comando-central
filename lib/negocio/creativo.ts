// La llave de agrupación de Creative, en UN solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO EXISTE PORQUE LA MISMA LLAVE ESTABA ESCRITA CINCO VECES, CON DOS DEFINICIONES
//
// El departamento entero se apoya en una idea: la unidad es la PIEZA, y la pieza se identifica por
// su nombre normalizado. Medido, los 79 anuncios de `negocio.anuncios` son 32 piezas y 21 corren en
// más de un `adId`.
//
// Esa normalización terminó escrita en cinco lugares —`calidadDelCreativo` tres veces,
// `rendimientoDelCreativo` dos y `fatigaDelCreativo` una— y **dos de ellas no eran la misma
// función**: cuatro hacían `lower(btrim(...))` en SQL y una hacía `.trim().toLowerCase()` en
// JavaScript, al agrupar las filas que devuelve `costoDelAnuncio`.
//
// ── POR QUÉ ESAS DOS NO SON LA MISMA COSA ───────────────────────────────────
//
// `btrim(x)` de PostgreSQL, con un solo argumento, recorta **sólo espacios**. `String.trim()` de
// JavaScript recorta todo el espacio en blanco de Unicode: tabulaciones, saltos de línea, espacio
// duro. Y `lower()` usa la intercalación de la base mientras `toLowerCase()` usa el mapeo por
// omisión de Unicode.
//
// O sea que el día que alguien nombre un anuncio con una tabulación al final —cosa que un copiar y
// pegar hace solo—, el lado del gasto lo agruparía bajo una llave y el lado del desglose bajo otra.
// La pieza aparecería con su gasto y con un guion en el hook rate, el link CTR y la landing: **se
// vería exactamente igual que una pieza que no es video**, y no hay forma de distinguirlas mirando.
//
// Medido el 2026-09-19 sobre los 79 anuncios: cero con tabulaciones, cero con espacio duro, cero con
// espacios al borde. **No muerde hoy**, y por eso se arregla hoy: el defecto que todavía no ocurrió
// es el único que se puede arreglar sin datos que corregir.
//
// ── LA PIEZA ES (CLIENTE, NOMBRE) (el nivel 3) ──────────────────────────────
//
// Esta llave es la del NOMBRE. La pieza es además de un cliente: dos clientes de una empresa comparten la convención
// de nombres, y su «hook 1» son dos piezas. El identificador que suma el cliente vive en `./idDeLaPieza.ts`, que es
// puro para que el navegador lo lea; acá queda lo que lee la base para armarlo, `clientesDeCreative`.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import type { ClientesDeCreative } from './idDeLaPieza.ts';

/**
 * El nombre de una pieza, normalizado. **La única definición del departamento.**
 *
 * `columna` es una referencia SQL (`a.nombre`, `contactos.atribucion_primera ->> 'utmContent'`), no
 * un valor: va por `sql.raw` porque tiene que interpolarse como identificador y no como parámetro.
 *
 * No devuelve `null` para el vacío: eso lo decide quien llama. `calidadDelCreativo` lo quiere nulo
 * —«sin creativo» es un grupo, regla 8— y los otros dos filtran los anuncios sin nombre, que es otra
 * cosa. Meter el `nullif` acá obligaría a los tres a compartir una decisión que no comparten.
 */
export function llaveDelCreativo(columna: string) {
  return sql<string>`lower(btrim(${sql.raw(columna)}))`;
}

/** La misma llave, con el vacío como `null`. Para quien trata «sin creativo» como un grupo. */
export function llaveOSinCreativo(columna: string) {
  return sql<string | null>`nullif(${llaveDelCreativo(columna)}, '')`;
}

/**
 * La etapa del embudo, leída del NOMBRE de campaña.
 *
 * Se parte por `|` y se busca el segmento que, en mayúsculas y sin espacios, sea una de las tres.
 * Tres decisiones, y las tres están medidas:
 *
 *   · **Por segmento y no por el nombre entero.** `NUEVA ERA | BOFU | AGENDAS | LATAM+USA` y
 *     `… | LATAM USA` son la misma campaña y partían 45 contactos en 43 + 2.
 *   · **Exacto y no por contenido.** Un `like '%BOFU%'` clasificaría «BOFU RETARGETING» por
 *     casualidad y elegiría una de dos al azar en «TOFU-BOFU HIBRIDO», que son nombres plausibles en
 *     esta convención.
 *   · **Lo que no coincide devuelve `null`**, y eso es un grupo, no un descarte: medido, hay
 *     `{{CAMPAIGN.NAME}}` sin expandir, `IG-DM` y un nombre propio.
 */
export const ETAPAS = ['TOFU', 'MOFU', 'BOFU'] as const;
export type Etapa = (typeof ETAPAS)[number];

export function etapaDelNombre(columna: string) {
  /* ── LA LISTA SALE DE `ETAPAS`, Y TIENE QUE IR POR `sql.raw` ───────────────
   *
   * Acá había un `in ('TOFU', 'MOFU', 'BOFU')` escrito a mano: el mismo vocabulario dos veces, en
   * el archivo que existe para ser el único lugar donde está. Agregar una cuarta etapa a la
   * constante no habría hecho nada —el SQL seguiría reconociendo tres— y el síntoma sería que esa
   * etapa cae en «sin etapa», que es un grupo legítimo y ya existe: nada se vería raro.
   *
   * **Pero no puede ir como parámetro**, y eso costó un intento. Un `= any(${'${[...ETAPAS]}'})` se
   * compila a `= any($n)`, y esta expresión se usa en el `select` Y en el `group by` de
   * `calidadDelCreativo`: con parámetros, los dos sitios reciben números distintos (`$3` y `$7`),
   * PostgreSQL deja de reconocerlos como la misma expresión y la consulta muere con
   * `42803 · subquery uses ungrouped column`. El mismo error que ese módulo ya pagó una vez.
   *
   * `sql.raw` mantiene la identidad TEXTUAL, que es lo que el `group by` compara. Y es seguro
   * porque `ETAPAS` es una constante de este archivo —tres palabras en mayúsculas, sin entrada de
   * nadie—: si algún día saliera de un dato del usuario, esto sería una inyección y habría que
   * resolver el `group by` de otra forma. */
  const lista = sql.raw(ETAPAS.map((e) => `'${e}'`).join(', '));
  return sql<Etapa | null>`(
    select btrim(e)
      from unnest(string_to_array(upper(coalesce(${sql.raw(columna)}, '')), '|')) e
     where btrim(e) in (${lista})
     limit 1)`;
}

/**
 * Los clientes de la empresa y cuál es el principal, para el identificador de las piezas (`./idDeLaPieza.ts`). Corre
 * dentro de `conOrganizacion`, como `frescura.ts`: con la empresa entera ve a todos, también a los de baja, cuyas
 * piezas siguen en la historia. Con el foco en un cliente que no es el principal (el cerebro desde la caja de Sales),
 * la base no deja ver al principal: `principal` sale nulo, todo identificador lleva su cliente, y lo que se dice va con
 * el rótulo, que no lo lleva.
 */
export async function clientesDeCreative(): Promise<ClientesDeCreative> {
  const filas = await datos().selectFrom('cuentas').select(['id', 'nombre', 'es_por_omision']).execute();
  return { principal: filas.find((f) => f.es_por_omision)?.id ?? null, nombres: new Map(filas.map((f) => [f.id, f.nombre])) };
}
