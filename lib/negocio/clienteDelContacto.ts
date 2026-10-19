// De qué cliente es un contacto (el nivel 3): para pedir las credenciales de SU subcuenta.
//
// Una acción sobre un contacto —escribirle, etiquetarlo, refrescarlo, armarle el enlace de la cita— le habla al CRM del
// cliente del contacto. Con las de la empresa, un contacto de otro cliente no existe en esa subcuenta, y un enlace de
// reservas saldría con el dominio de otro negocio. El contacto siempre tiene cliente (`083`: `cuenta_id` obligatoria).

import { datos } from '../datos/contexto.ts';
import type { ClienteDeLaCredencial } from '../credenciales/resolver.ts';

/** El cliente del contacto, o `null` si no está a la vista. **Corre dentro de `conOrganizacion`.** */
export async function clienteDelContacto(contactoId: string): Promise<ClienteDeLaCredencial | null> {
  const f = await datos()
    .selectFrom('contactos as k')
    .innerJoin('cuentas as c', 'c.id', 'k.cuenta_id')
    .select(['c.id as id', 'c.es_por_omision as porOmision'])
    .where('k.id', '=', contactoId)
    .executeTakeFirst();
  return f ? { id: f.id, esPorOmision: f.porOmision } : null;
}
