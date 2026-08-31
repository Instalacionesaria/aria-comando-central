// El SELLO DE ATRIBUCIÓN del setter. **Un solo escritor en todo el sistema.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DECIDE, Y POR QUÉ IMPORTA TANTO PARA UNA COLUMNA
//
// El setter cobra por dos cosas: sus ventas chicas, y una **comisión diferida** sobre las ventas
// grandes que cierra el closer **sobre leads que él originó**. El segundo tramo no se puede calcular
// sin saber qué contactos trabajó a mano cada setter, y eso es exactamente lo que dice esta columna.
//
// Sin sello, la comisión diferida no existe: no hay de dónde sacarla. Es el motivo por el que el
// tablero se construye DESPUÉS y no antes — depende de un dato que las otras pantallas tienen que
// haber estado escribiendo desde el principio.
//
// ── LA COLUMNA YA EXISTÍA Y NO TENÍA ESCRITOR ───────────────────────────────
//
// `contactos.sello_setter_id` y `sello_setter_el` están en la base desde la migración 011, con un
// disparador que las protege y una prueba que lo verifica. Lo que faltaba era esto: **ninguna línea
// de la aplicación las escribía**, y así lo dejó anotado `015_comisiones.sql`.
//
// En la plataforma anterior el defecto era otro y peor: el sello vivía en el navegador —*«se
// escribía en seis lugares y no se leía en ninguno»*— así que moría al refrescar. La comisión
// diferida no se podía calcular y el tablero mostraba una base fija.
//
// ── TRES DECISIONES QUE NO SON OBVIAS ──────────────────────────────────────
//
// **1 · El criterio es el TERRITORIO del contacto, no el rol de quien actúa.** `closer` y `setter`
// dejaron de ser roles del sistema —lo dice la migración 020: *«closer no es un rol: es una pestaña
// y una fila»*— así que no hay identidad a la que preguntarle. Es el mismo criterio que la ruta de
// Avanzar ya usa para decidir con qué vocabulario registrar.
//
// **2 · `sello_setter_el` NO se pasa nunca.** La pone el disparador. Mandarla desde acá sería tener
// dos relojes para el mismo hecho, y así se llega a un sello con fecha del futuro.
//
// **3 · El `and sello_setter_id is null` es redundante con el disparador, y va igual.** El
// disparador es el tirante y esto el cinturón. Además evita un `update` inútil por cada acción sobre
// un contacto ya sellado, que con un reloj de diez segundos no es gratis.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';

/**
 * Enciende el sello si el contacto es del setter y todavía no tenía uno.
 *
 * **Corre dentro de `conOrganizacion(`.** Devuelve `true` solo si lo encendió ahora — y que devuelva
 * `false` **no es un error**: es el caso normal, o sea un contacto ya sellado o uno que no es del
 * setter.
 *
 * **Puede lanzar, y qué hacer con eso lo decide cada llamador.** No se traga el error acá a
 * propósito: los dos llamadores necesitan lo contrario del otro. Dentro de `registrarResultado` el
 * fallo tiene que revertir la transacción —un resultado sin atribución es comisión que nadie puede
 * reclamar— y en la ruta de mensajes tiene que tragarse, porque el mensaje ya salió y un 500 lo hace
 * mandar de nuevo. Un `try` acá dentro le impondría a `registrarResultado` la política del otro.
 */
export async function sellarSiEsDelSetter(contactoId: string, usuarioId: string): Promise<boolean> {
  const r = await datos()
    .updateTable('contactos')
    .set({ sello_setter_id: usuarioId } as never)
    .where('id', '=', contactoId)
    /* El territorio decide, no el rol de quien actúa. Un closer que responde un mensaje de un
       contacto del setter NO se lleva la atribución: la columna paga la comisión diferida DEL
       SETTER, y esto es lo único que impide que se la lleve alguien de la otra mitad. */
    .where('territorio', '=', 'setter')
    // El cinturón. Ver la decisión 3 del encabezado.
    .where('sello_setter_id', 'is', null)
    .executeTakeFirst();

  return Number(r.numUpdatedRows ?? 0) > 0;
}
