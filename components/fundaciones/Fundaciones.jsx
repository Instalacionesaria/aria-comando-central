'use client';

/* Las siete subpestañas de ICP & Oferta.
   ==========================================================================
   Este componente es la primera vista del proyecto con estado en React. El resto de
   las diez pantallas las sigue pintando la capa imperativa de `lib/aios/`, que viene
   del prototipo; el README lo describe como el camino para reactificar una vista:
   "reescribís su módulo como componente con estado y lo quitás de la lista de
   `lib/aios/index.js`". `icp` no tenía módulo — era un placeholder—, así que no hay
   nada que quitar.

   ── EL ORDEN DE LAS PESTAÑAS ES EL DEL MÉTODO ─────────────────────────────

   Y no es el de los identificadores: Tu ficha(0) → Research(1) → ICP(3) →
   Categoría(2) → Oferta(4) → Tu precio(10) → Mapa(26). Los identificadores son los
   del hub y son la llave del almacén compartido; el orden es la secuencia en la que
   cada herramienta hereda de las anteriores. Ver `lib/fundaciones/herramientas.ts`.

   ── LAS TRES RAMAS, OTRA VEZ ──────────────────────────────────────────────

   Al cargar puede pasar: llegó el estado (aunque esté vacío, que es un alumno que no
   empezó), lo rechazaron (falta un permiso, falta la llave, falta el vínculo), o no se
   pudo preguntar. Las tres se muestran distinto, y esa es la mitad de `ADR-0305` que
   vive en la interfaz. Pintar siete formularios en blanco en los tres casos sería el
   defecto del `07` § 2 con un disfraz nuevo. */

import { useCallback, useEffect, useState } from 'react';

import { pedir } from '@/lib/http/cliente';
import { FUNDACIONES } from '@/lib/fundaciones/herramientas';
import { estadoVacio, pasoCompleto } from '@/lib/fundaciones/estado';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import PanelHerramienta from './PanelHerramienta';
import PanelResearch from './PanelResearch';
import PanelProspeccion from '../tools/PanelProspeccion';

/* Lo que este componente necesita saber de SU pantalla.

   Nació sirviendo a una sola —ICP & Oferta— con todo escrito adentro. Cuando apareció `tools`,
   la alternativa era copiar el archivo: doscientas líneas duplicadas que divergen en la primera
   corrección, y con ellas el cartel de error, las tres ramas de carga y el indicador de avance.
   Es la lista paralela otra vez, con forma de componente.

   Los valores por omisión son los de ICP & Oferta y existen para que `IcpView` no cambiara. Lo
   que NO hacen es adivinar: `ToolsView` los pasa todos, explícitos. */
const CATALOGO_ICP = {
  herramientas: FUNDACIONES,
  rutaEstado: '/api/fundaciones/estado',
  rutaGenerar: '/api/fundaciones/generar',
  capacidadEditar: 'fundaciones.editar',
};

export default function Fundaciones({ catalogo = CATALOGO_ICP }) {
  const { herramientas, rutaEstado, rutaGenerar, capacidadEditar } = catalogo;
  const [estado, setEstado] = useState(null);
  const [permisos, setPermisos] = useState(null);
  const [problema, setProblema] = useState(null);
  const [activa, setActiva] = useState(catalogo.herramientas[0].id);

  const cargar = useCallback(async () => {
    const [sesion, respuesta] = await Promise.all([
      pedir('/api/auth/sesion'),
      pedir(rutaEstado),
    ]);

    /* La sesión se pide para saber si mostrar los botones que generan. Es comodidad, no
       seguridad: cada operación valida igual del lado del servidor. Lo que compra es no
       mostrarle a un rol de consulta un botón que le va a dar 403 — el `07` § 4. */
    if (sesion.tipo === 'datos' && Array.isArray(sesion.datos.permisos)) {
      setPermisos(sesion.datos.permisos);
    } else {
      setPermisos([]);
    }

    if (respuesta.tipo === 'datos') {
      setEstado(respuesta.datos.estado);
      setProblema(null);
      return;
    }
    setEstado(null);
    setProblema(
      respuesta.tipo === 'rechazado'
        ? { texto: mensajeDeRechazo(respuesta.codigo, respuesta.estado), codigo: respuesta.codigo }
        : { texto: SIN_RESPUESTA, codigo: 'sin_respuesta' },
    );
  }, [rutaEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Al generar o guardar, el estado se relee entero. Podría actualizarse en el lugar y sería
     más rápido, pero la herencia depende de siete documentos que se cruzan: una actualización
     parcial mal hecha deja al Mapa creyendo que la Oferta no existe. Releer es una petición
     que ya se sabe barata contra un fallo que es muy difícil de ver. */
  const recargar = useCallback(() => {
    cargar();
  }, [cargar]);

  /* Mientras no llegó nada todavía, no se pinta la estructura a medias: un formulario que
     aparece vacío y medio segundo después se rellena solo hace que alguien empiece a escribir
     sobre lo que estaba por cargar. */
  if (!estado && !problema) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="fd-cargando">
            <span className="fd-punto" />
            Leyendo tu trabajo de Fundaciones…
          </div>
        </div>
      </div>
    );
  }

  /* Un fallo de DATOS no se lleva la NAVEGACIÓN.
     ------------------------------------------------------------------------
     La primera versión de este componente devolvía el cartel de error en lugar de todo, y
     estaba mal por dos motivos:

       · las siete pestañas son estructura, no un dato leído. Esconderlas cuando el almacén no
         contesta le quita a la persona la única cosa que le explica DE QUÉ le están hablando;
       · y sobre todo: deja imposible distinguir "esta pantalla no existe todavía" de "esta
         pantalla existe y ahora mismo no puede leer". Que es exactamente la confusión que
         `ADR-0305` existe para impedir, cometida un nivel más arriba.

     Así que con problema se pinta TODO —pestañas, formularios, lo que hereda cada herramienta—
     sobre un estado vacío, con el aviso arriba diciendo qué pasó y con qué código. Los campos
     salen sin rellenar porque no se pudo leer lo guardado, y el aviso lo dice con esas
     palabras: nada de esto significa que el trabajo se haya perdido. */
  const estadoUsable = estado ? estado : estadoVacio();

  /* Con problema no se puede generar, y el control no se renderiza en vez de dar un error al
     apretarlo: sin haber podido leer el estado, una generación saldría sin el contexto que
     hereda y produciría un documento peor, no un error.

     Pero los dos motivos para NO poder generar son distintos y el panel tiene que saber cuál
     es. "Tu rol puede ver y no generar" sobre una sesión vencida es un cartel que MIENTE, y
     manda a pedirle un permiso a alguien que no tiene nada que darle. Así que viaja el motivo,
     no el booleano: cuando la causa es el problema, el aviso de arriba ya lo explicó y el panel
     no agrega nada. */
  const tienePermisoDeEditar = permisos ? permisos.includes(capacidadEditar) : false;
  const puedeEditar = !problema && tienePermisoDeEditar;
  const faltaPermiso = !problema && !tienePermisoDeEditar;
  const hechos = herramientas.filter((h) => pasoCompleto(estadoUsable, h.id)).length;
  const herramienta = herramientas.find((h) => h.id === activa) || herramientas[0];
  const esConfiguracion =
    problema !== null &&
    (problema.codigo === 'sin_llave_de_ia' ||
      problema.codigo === 'sin_alumno_vinculado' ||
      problema.codigo === 'llave_de_ia_ilegible');

  return (
    <>
      <div className="cl-sub fd-sub" role="tablist">
        {herramientas.map((h, i) => {
          const completo = pasoCompleto(estadoUsable, h.id);
          return (
            <button
              key={h.id}
              type="button"
              role="tab"
              aria-selected={h.id === activa}
              className={h.id === activa ? 'on' : ''}
              onClick={() => setActiva(h.id)}
            >
              <span className="fd-n">{i + 1}</span>
              {h.pestania}
              {completo ? <span className="fd-hecho" /> : null}
            </button>
          );
        })}
        <div className="fd-avance">
          <span className="fd-barra">
            <i style={{ width: `${(hechos / herramientas.length) * 100}%` }} />
          </span>
          <b>
            {hechos}/{herramientas.length}
          </b>
        </div>
      </div>

      {problema ? (
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>
            <b>
              {esConfiguracion
                ? 'Falta configurar esta organización. '
                : 'No se pudo leer tu trabajo. '}
            </b>
            {problema.texto} Los campos de abajo salen vacíos porque no se pudo leer lo
            guardado, no porque no haya nada. Código: <b>{problema.codigo}</b>.
          </span>
        </div>
      ) : null}

      {/* key={herramienta.id}: al cambiar de pestaña el panel se REMONTA en vez de
          reutilizarse. Así cada panel inicializa su formulario desde el estado con un
          inicializador diferido, sin un efecto que sincronice — que es de donde salen los
          renders en cascada y los formularios que se pisan al navegar. */}
      {/* Tres formas, no dos. `prospeccion` tiene panel propio porque no es un formulario con un
          botón: lleva un extractor de leads que habla con otro sistema. Ver `PanelProspeccion`. */}
      {herramienta.forma === 'prospeccion' ? (
        <PanelProspeccion
          key={herramienta.id}
          herramienta={herramienta}
          estado={estadoUsable}
          puedeEditar={puedeEditar}
          faltaPermiso={faltaPermiso}
          onIr={setActiva}
          onEstadoCambiado={recargar}
          rutaEstado={rutaEstado}
          rutaGenerar={rutaGenerar}
        />
      ) : herramienta.forma === 'research' ? (
        <PanelResearch
          key={herramienta.id}
          herramienta={herramienta}
          estado={estadoUsable}
          puedeEditar={puedeEditar}
          faltaPermiso={faltaPermiso}
          onEstadoCambiado={recargar}
          rutaEstado={rutaEstado}
          rutaGenerar={rutaGenerar}
        />
      ) : (
        <PanelHerramienta
          key={herramienta.id}
          herramienta={herramienta}
          estado={estadoUsable}
          puedeEditar={puedeEditar}
          faltaPermiso={faltaPermiso}
          onIr={setActiva}
          onEstadoCambiado={recargar}
          rutaEstado={rutaEstado}
          rutaGenerar={rutaGenerar}
        />
      )}
    </>
  );
}
