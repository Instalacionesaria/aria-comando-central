// ADR-0201 — Ninguna consulta corre sin organización activa. INNEGOCIABLE.
// ADR-0202 — Toda operación abre el contexto de su organización. INNEGOCIABLE.
// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// La sonda del aislamiento, por el camino REAL de la aplicación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA RUTA EXISTE
//
// Es la primera operación del proyecto que recorre la cadena entera:
//
//     cliente → manejador de ruta → portero → contexto de organización → capa → base
//
// Sin ella, la Etapa 2 demostró el aislamiento desde un script y la Etapa 3 demostró el
// portero con peticiones armadas a mano, pero **nadie demostró que las dos piezas encajan**.
// Y encajan de una forma concreta que es fácil de arruinar: la organización que recibe
// `conOrganizacion(` sale de `contexto.orgEfectiva`, no de `orgPropia` ni de `org_activa`
// crudo. Pasarle la equivocada hace que un usuario de plataforma crea estar mirando al
// cliente Alfa y vea los números de la principal. Ninguna excepción, ninguna prueba anterior
// lo agarra.
//
// Además es la sonda que la Etapa 8 necesita: el 10 § 1 describe una comprobación horaria con
// *"dos organizaciones de control, con una fila marcada cada una"*.
//
// Pide `NINGUNA` capacidad, y eso es un VALOR ESCRITO A PROPÓSITO, no una lista vacía
// (03 § 5): cualquiera con sesión activa puede preguntar por su propia organización.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir, NINGUNA } from '../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../lib/autorizacion/secciones.ts';
import { ok } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../lib/datos/contexto.ts';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  // `orgEfectiva`, no `orgPropia`. Es la línea que decide si el rol de plataforma ve lo que
  // cree estar viendo.
  const filas = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .selectFrom('control_aislamiento')
      .orderBy('creado_el', 'desc')
      .select(['id', 'org_id', 'marca'])
      .execute(),
  );

  return ok({ organizacion: contexto.organizacion, filas });
}
