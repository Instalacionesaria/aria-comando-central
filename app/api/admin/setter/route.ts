// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Los DOS porcentajes del setter, de toda la gente de la empresa. **Solo lectura.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA RUTA EXISTE, Y POR QUÉ SOLO LEE
//
// La migración 025 abrió dos tramos —`setter_directo` y `setter_diferido`— y hasta ahora **no había
// dónde cargarlos**: `/api/admin/comisiones` escribía `tipo: 'closer'` clavado. Así que los dos
// anillos del Inicio del Setter estaban condenados a decir *«nadie cargó tu porcentaje»* para
// siempre, que es exactamente el defecto que la migración 015 dejó documentado: un texto que manda a
// cargar algo que no se puede cargar.
//
// La ESCRITURA no vive acá: sigue siendo `PUT /api/admin/comisiones`, que ahora recibe el tramo. Es
// la misma forma que el closer — `components/closer/QuienEsElCloser.jsx` lee de `/api/admin/closer` y
// escribe por `/api/admin/comisiones` — y el motivo es que ahí ya está resuelta la parte difícil: la
// distinción entre `0` y `null`, el 404 de `ADR-0501` para una persona de otra empresa, y la fila de
// auditoría en la misma transacción que el porcentaje. Un segundo escritor sería un segundo lugar
// donde equivocarse en las tres.
//
// ── LA MISMA CAPACIDAD Y LA MISMA PANTALLA QUE `/api/admin/comisiones` ──────
//
// `PANTALLA = 'credenciales'` y `credenciales.ver`, igual que la ruta con la que se usa. No es la
// capacidad del Setter, y eso es deliberado: **el panel se dibuja dentro del Setter pero es una
// operación de administración**. Con `setter.ver`, cualquier setter podría leer el porcentaje de sus
// compañeros — que es información de sueldos.
//
// Es el mismo arreglo que `/api/admin/closer`, que se dibuja en el Closer y pide `credenciales`.
//
// ── POR QUÉ DOS CONSULTAS Y NO UNA ──────────────────────────────────────────
//
// `porcentajesDeLaEmpresa` devuelve **una fila por persona**, y eso no se toca: `/api/admin/closer`
// aplana su resultado con `new Map(…)`, que se queda con la última de las filas repetidas. Si esta
// función devolviera una fila por (persona, tramo), el desplegable del closer empezaría a mostrar el
// porcentaje del setter. Silencioso.
//
// Así que se llama dos veces, una por tramo, y se juntan acá por identificador. Es una consulta más
// y ningún modo de falla nuevo.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { porcentajesDeLaEmpresa } from '../../../../lib/negocio/comision.ts';
import {
  TIPO_SETTER_DIFERIDO,
  TIPO_SETTER_DIRECTO,
} from '../../../../lib/negocio/comisionDelSetter.ts';

export const PANTALLA = 'credenciales';

/** Una persona con sus DOS porcentajes. `null` en cualquiera = **nadie lo cargó**, no cero. */
interface PersonaConSusDosTramos {
  usuarioId: string;
  nombre: string;
  email: string | null;
  directo: number | null;
  diferido: number | null;
}

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const personas = await conOrganizacion(contexto.orgEfectiva, async () => {
    const directo = await porcentajesDeLaEmpresa(TIPO_SETTER_DIRECTO);
    const diferido = await porcentajesDeLaEmpresa(TIPO_SETTER_DIFERIDO);

    /* Las dos listas traen a **toda la gente activa de la empresa**, no a quien tiene fila: al revés
       el panel arrancaría vacío y no habría forma de cargarle el porcentaje a nadie, porque la fila
       se crea al guardar. Eso ya lo decide `porcentajesDeLaEmpresa`; acá solo se juntan.

       Y no se filtra por rol: `closer` y `setter` dejaron de ser roles del sistema —lo dice la
       migración 020—, así que filtrar por rol devolvería una tabla vacía sin ningún error. El tramo
       es un dato de la fila de comisión, no una deducción del rol. */
    const porId = new Map(diferido.map((p) => [p.usuarioId, p.porcentaje]));

    return directo.map(
      (p): PersonaConSusDosTramos => ({
        usuarioId: p.usuarioId,
        nombre: p.nombre,
        email: p.email,
        /* Los dos `null` se conservan. Un `?? 0` en cualquiera de los dos haría que el panel muestre
           «0 %» para todo el mundo, y quien administra lo leería como una decisión ya tomada. */
        directo: p.porcentaje,
        diferido: porId.get(p.usuarioId) ?? null,
      }),
    );
  });

  return ok({
    personas,
    /* Los dos nombres de tramo viajan desde el SERVIDOR y no se escriben a mano en la pantalla: son
       los mismos valores que el `PUT` valida contra su lista cerrada, así que una pantalla que los
       tipee mal recibiría un 400 en el momento de guardar y no antes. */
    tramos: { directo: TIPO_SETTER_DIRECTO, diferido: TIPO_SETTER_DIFERIDO },
  });
}
