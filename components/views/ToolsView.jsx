/* La vista `tools` — las herramientas de la operación.
   ==========================================================================
   Es la primera pantalla creada de cero en el proyecto: no viene de
   `aios-command-center_1.html`, así que no está en `scripts/paridad.mjs` — no hay contra
   qué compararla, y compararla contra un HTML donde no existe daría un rojo permanente.

   Nació como marcador de posición y duró poco: la primera herramienta —Prospección en
   Frío, traída de la fase Growth de ARIA-brain— le dio sus dos operaciones y con eso salió
   de `SIN_OPERACIONES_TODAVIA`. Es el mismo camino que hizo `icp` en la Etapa 9.

   ── POR QUÉ REUSA EL COMPONENTE DE FUNDACIONES ────────────────────────────

   Porque es literalmente lo mismo: subpestañas, un formulario, un botón que gasta tokens,
   un documento con su historial de versiones y el cartel de las tres ramas de fallo.
   Copiarlo para cambiarle dos rutas habría duplicado doscientas líneas que divergen en la
   primera corrección — y con ellas el cartel de error y el indicador de avance.

   Lo que SÍ cambia viaja en el catálogo, explícito y sin valores por omisión: sus
   herramientas, sus dos rutas y su capacidad de edición. Esa última no es un detalle:
   `tools.editar` y `fundaciones.editar` son distintas a propósito, y un panel que hubiera
   heredado la de Fundaciones dejaría generar aquí a quien solo puede generar allá.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— se conserva porque es
   el que hace que la vista se comporte como las otras: el mismo scroll, el mismo
   encabezado, el mismo lugar. */

import Fundaciones from '../fundaciones/Fundaciones';
import EspiaDeAnuncios from '../tools/EspiaDeAnuncios';
import MisLeads from '../tools/MisLeads';
import { TOOLS } from '@/lib/fundaciones/herramientas';

const CATALOGO_TOOLS = {
  herramientas: TOOLS,
  rutaEstado: '/api/tools/estado',
  rutaGenerar: '/api/tools/generar',
  /* La del agente conversacional. Se declara explícita, como las otras dos: heredar la de ICP &
     Oferta sería llamar a una ruta que pide `fundaciones.editar` desde una pantalla cuya capacidad
     es `tools.editar` — exactamente el defecto que separó las rutas de las dos pantallas.

     La usa el VSL, que es una herramienta genérica como las ocho de al lado. Prospección no: no
     tiene agente (ver `tieneAgente`), y su panel es otro. */
  rutaConversar: '/api/tools/conversar',
  capacidadEditar: 'tools.editar',
  /* «Mis Leads» es una pestaña más de Tools, al lado de Prospección, y no una sección enterrada
     debajo del scraper: el historial se consulta en momentos distintos de cuando se scrapea
     —para exportarlo, para ver si un negocio ya salió antes— y no tiene por qué obligar a pasar
     por un panel de extracción para llegar.

     Va como `vista` y no como herramienta porque no genera nada ni se completa. Ver el bloque de
     `vistas` en `Fundaciones.jsx`. */
  vistas: [
    {
      clave: 'espia',
      pestania: 'Espía de Anuncios',
      /* La quinta fuente del motor de scraping, y la única que no gasta saldo de leads. Va como
         vista y no como herramienta por lo mismo que «Mis Leads»: no llena un formulario ni produce
         un entregable que se pueda dar por completo. */
      render: ({ puedeEditar }) => <EspiaDeAnuncios puedeEditar={puedeEditar} />,
    },
    { clave: 'mis-leads', pestania: 'Mis Leads', render: () => <MisLeads /> },
  ],
};

export default function ToolsView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-tools">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>Tools</h2>
            <span className="cre-desc">
              Las herramientas de la operación, que heredan de tu ICP y tu oferta
            </span>
          </div>
        </div>
        <Fundaciones catalogo={CATALOGO_TOOLS} />
      </div>
    </section>
  );
}
