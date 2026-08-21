// El almacén del contexto por petición.
//
// Existe como módulo aparte para ROMPER UN CICLO, no por gusto de dividir: `capa.ts`
// necesita leer la organización activa para el plugin que la inyecta en las escrituras,
// y `contexto.ts` necesita el cliente que construye `capa.ts`. Con el almacén acá el
// grafo queda `almacen ← capa ← contexto` y `almacen ← contexto`, sin ciclo.
//
// La alternativa —un registro que `contexto.ts` rellena al cargarse— haría que el
// comportamiento dependiera del ORDEN DE IMPORTACIÓN, que es la clase de dependencia
// que no se ve en ninguna revisión y falla en un entorno distinto al de desarrollo.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Transaction } from 'kysely';
import type { BaseDeDatos } from './esquema.ts';

export interface Contexto {
  /** La organización sobre la que se está trabajando. */
  readonly orgId: string;
  /** La transacción donde la variable `app.org_id` está puesta. */
  readonly trx: Transaction<BaseDeDatos>;
}

// `AsyncLocalStorage` y NO una variable de módulo.
//
// Una global o un singleton por proceso funciona perfecto en pruebas locales —una
// petición a la vez— y en producción dos peticiones de organizaciones distintas se
// pisan el contexto. El defecto es intermitente, depende de la carga, y es
// prácticamente imposible de reproducir en desarrollo (04 § 3).
export const almacen = new AsyncLocalStorage<Contexto>();

/**
 * La organización activa. LANZA si no hay ninguna.
 *
 * Lanzar es la decisión, no un descuido: es lo que la usa el plugin que inyecta la
 * organización en las escrituras, y un INSERT sin organización no tiene ningún valor
 * razonable por defecto. La única respuesta correcta es no dejar que la consulta salga.
 */
export function organizacionActual(): string {
  const ctx = almacen.getStore();
  if (!ctx) {
    throw new Error(
      'Ninguna consulta corre sin organización activa. ' +
        'Envolvé la operación en conOrganizacion(orgId, async () => { … }).',
    );
  }
  return ctx.orgId;
}

/**
 * ¿Hay contexto? Para código que legítimamente puede correr con o sin él.
 *
 * Deliberadamente NO devuelve el contexto: quien necesite la organización usa
 * `organizacionActual()` y acepta que lance. Devolver "el contexto o nulo" es la forma
 * que el 03 § 5 señala como fuente de defectos silenciosos — en un lenguaje donde un
 * objeto siempre es verdadero, quien escriba `si no contexto: devolver` NUNCA corta.
 */
export function hayOrganizacion(): boolean {
  return almacen.getStore() !== undefined;
}
