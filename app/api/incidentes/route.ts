// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por CAPACIDAD, nunca por nombre de rol.
//
// El Panel de Incidentes: los fallos del modelo de IA de todas las empresas.
//
// La autorización es la del Panel de Monitoreo (`app/api/monitoreo/route.ts`), con otra
// capacidad: `incidentes.ver`, que en el catálogo solo tiene el superadministrador, y además ser de
// la organización principal. El cruce de organizaciones es un bucle que abre el contexto de cada
// una, no una consulta: cada lectura pasa por la misma RLS que una petición de esa empresa.

import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../lib/autorizacion/secciones.ts';
import { listarOrganizaciones } from '../../../lib/administracion/organizaciones.ts';
import { type IncidenteListado, incidentesDeLaOrganizacion } from '../../../lib/incidentes/registro.ts';

export const PANTALLA = 'incidentes';

export const maxDuration = 60;

/** Cuántas organizaciones se leen a la vez. El mismo número que el Panel de Monitoreo. */
const A_LA_VEZ = 4;

/** Las ventanas que la pantalla ofrece. Otra cualquiera cae en 7. */
const VENTANAS: readonly number[] = Object.freeze([1, 7, 30]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los nombres de quienes vieron los incidentes. De identidad, que es donde viven. */
async function nombresDeUsuarios(ids: readonly string[]): Promise<Record<string, string>> {
  const validos = [...new Set(ids)].filter((x) => UUID.test(x));
  if (validos.length === 0) return {};
  const filas = await conIdentidad((db) =>
    db.selectFrom('usuarios').select(['id', 'nombre']).where('id', 'in', validos).execute(),
  );
  return Object.fromEntries(filas.map((f) => [f.id, f.nombre]));
}

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['incidentes.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (!esDeLaPrincipal(contexto)) {
    return rechazo('sin_permiso', 'El Panel de Incidentes es de la organización principal: mira a todas las empresas.');
  }

  const pedidos = Number(new URL(peticion.url).searchParams.get('dias'));
  const dias = VENTANAS.includes(pedidos) ? pedidos : 7;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const organizaciones = await conIdentidad(async (db) => listarOrganizaciones(db));

  /* Una empresa que no se puede leer NO tira el panel, pero tampoco se calla: va en `ilegibles` y
     la pantalla lo dice. «Sin incidentes» y «no se pudo mirar» piden cosas opuestas. */
  const incidentes: (IncidenteListado & { empresa: string })[] = [];
  const ilegibles: string[] = [];
  for (let i = 0; i < organizaciones.length; i += A_LA_VEZ) {
    await Promise.all(
      organizaciones.slice(i, i + A_LA_VEZ).map(async (o) => {
        try {
          const filas = await conOrganizacion(o.id, () => incidentesDeLaOrganizacion(desde));
          for (const f of filas) incidentes.push({ ...f, empresa: o.nombre });
        } catch {
          ilegibles.push(o.nombre);
        }
      }),
    );
  }
  incidentes.sort((a, b) => b.creadoEl.localeCompare(a.creadoEl));

  const nombres = await nombresDeUsuarios(incidentes.flatMap((x) => (x.usuarioId ? [x.usuarioId] : [])));
  return ok({
    dias,
    incidentes: incidentes.map((x) => ({ ...x, usuario: x.usuarioId ? (nombres[x.usuarioId] ?? null) : null })),
    ilegibles: ilegibles.sort((a, b) => a.localeCompare(b, 'es')),
  });
}
