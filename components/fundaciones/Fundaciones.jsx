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

import { useCallback, useEffect, useRef, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import { FUNDACIONES } from '@/lib/fundaciones/herramientas';
import { estadoVacio, pasoCompleto } from '@/lib/fundaciones/estado';
import { aValoresDeFormulario, conValoresPorOmision, idsDeCampos } from '@/lib/fundaciones/campos';
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
  /* Cuál de las dos pantallas es. La barra del pie la usa para saber si el paso siguiente se puede
     abrir con un `setActiva` —está acá— o vive del otro lado. */
  pantalla: 'icp',
  /* Las siete de esta pantalla se trabajan SOLO por chat: sin formulario, sin selector de opciones.
     Pedido de Kevin (2026-09-03): «ya no habrá formularios, solo los chats» — y aclaró que el alcance
     es esta pantalla, no Tools. Los inputs se siguen guardando igual en `profile[N]`; lo que cambia es
     cómo se cargan: se dicen al agente, que abre proponiendo lo que hereda.

     Una herramienta suelta puede declarar lo mismo por su cuenta (`Herramienta.soloChat`): así
     entraron el VSL y la Landing de Tools el 2026-09-05, sin arrastrar a Prospección. */
  soloChat: true,
  herramientas: FUNDACIONES,
  rutaEstado: '/api/fundaciones/estado',
  rutaGenerar: '/api/fundaciones/generar',
  /* La del agente conversacional del Research. Solo la usa el panel de la herramienta con
     `forma: 'research'`; las demás no la miran. */
  rutaConversar: '/api/fundaciones/conversar',
  /* La del relleno del formulario con el contexto heredado. */
  rutaRellenar: '/api/fundaciones/rellenar',
  capacidadEditar: 'fundaciones.editar',
};

export default function Fundaciones({ catalogo = CATALOGO_ICP }) {
  const { pantalla, herramientas, rutaEstado, rutaGenerar, rutaConversar, rutaRellenar, capacidadEditar } =
    catalogo;
  const soloChatDePantalla = catalogo.soloChat === true;

  /* ── LAS VISTAS: pestañas que NO generan nada ────────────────────────────────
     Una herramienta es un formulario que produce un documento y que se puede dar por
     «completa». «Mis Leads» no es eso: es el historial de lo que trajo el scraper, no se
     completa nunca y no gasta nada.

     Se listan aparte y no como una `Herramienta` con los campos vacíos porque el tipo exige
     `filas`, `etiquetaBoton` y `etiquetaSalida` —o sea, promete un botón que genera— y además
     la barra de avance cuenta `hechos/herramientas.length`. Una vista ahí adentro haría que
     el contador dijera «0/2» para siempre, con el segundo paso imposible de completar.

     Opcional: la pantalla ICP & Oferta no manda ninguna y se comporta igual que antes.

     ── QUÉ RECIBE `render` ─────────────────────────────────────────────────
     Un objeto con `puedeEditar`, que es lo mismo que reciben los paneles y sale del mismo lugar
     (los permisos de la sesión, no un nombre de rol). Entró con el Espía de Anuncios, que tiene
     botones que GASTAN —una corrida de Apify, tokens de la llave de IA— y por lo tanto tiene que
     poder no dibujarlos: el `07` § 4 prohíbe mostrar un control que no puede cumplir.

     Va como objeto y no como argumento suelto para que la próxima vista que necesite otra cosa no
     obligue a tocar todas las que ya existen. */
  const vistas = catalogo.vistas ?? [];
  const [estado, setEstado] = useState(null);
  const [permisos, setPermisos] = useState(null);
  /* El nombre de la organización va al encabezado del Word y del PDF. Sale de la MISMA petición de
     sesión que ya se hacía por los permisos: pedirlo aparte sería una segunda llamada por un dato
     que ya viajó. Cadena vacía y no `null` — `exportar.ts` omite el renglón si no hay nombre, y no
     escribe «undefined» en un archivo que alguien manda a su coach. */
  const [organizacion, setOrganizacion] = useState('');
  const [problema, setProblema] = useState(null);
  const [activa, setActiva] = useState(catalogo.herramientas[0].id);

  /* ── LLEGAR CON EL FORMULARIO YA COMPLETO ─────────────────────────────────
     Reportado por Kevin, tres veces: «Continuar al paso 3 no me completa el formulario del ICP».
     En ARIA-brain ese botón solo navega y el research se ve como chips arriba del formulario, con
     los campos vacíos. Acá se decidió que llegar por el botón del método signifique llegar con los
     campos completos: quien navega a un paso desde el anterior está construyendo la cadena, y el
     paso siguiente tiene todo lo que necesita para proponerse solo.

     Se guarda A QUÉ herramienta se le pidió, y ella lo consume al montarse. Es un pedido, no un
     estado permanente: si quedara puesto, la próxima visita manual a esa pestaña dispararía una
     inferencia que nadie pidió. */
  const [rellenarAlLlegar, setRellenarAlLlegar] = useState(null);

  /* Navegar a una herramienta. `opciones.rellenar` es lo que la barra del método pide al continuar:
     que la herramienta siguiente se llene con lo que hereda, antes de que nadie tenga que escribir. */
  const irA = useCallback((id, opciones) => {
    setActiva(id);
    setRellenarAlLlegar(opciones && opciones.rellenar ? id : null);
  }, []);

  const cargar = useCallback(async () => {
    const [sesion, respuesta] = await Promise.all([
      pedir('/api/auth/sesion'),
      /* La lectura del estado son NUEVE documentos del almacén del hub y su ruta declara
         `maxDuration = 300`: con la espera por omisión, un alumno con Fundaciones ya trabajadas
         veía «no se pudo llegar al servidor» sobre un almacén que estaba contestando. */
      pedir(rutaEstado, { espera: ESPERA_DE_RUTA_LARGA_MS }),
    ]);

    /* La sesión se pide para saber si mostrar los botones que generan. Es comodidad, no
       seguridad: cada operación valida igual del lado del servidor. Lo que compra es no
       mostrarle a un rol de consulta un botón que le va a dar 403 — el `07` § 4. */
    if (sesion.tipo === 'datos' && Array.isArray(sesion.datos.permisos)) {
      setPermisos(sesion.datos.permisos);
    } else {
      setPermisos([]);
    }

    if (sesion.tipo === 'datos' && sesion.datos.organizacion) {
      setOrganizacion(sesion.datos.organizacion.nombre || '');
    }

    if (respuesta.tipo === 'datos') {
      setEstado(respuesta.datos.estado);
      setProblema(null);
      return;
    }
    setEstado(null);
    setProblema(
      respuesta.tipo === 'rechazado'
        ? { texto: mensajeDeRechazo(respuesta.codigo, respuesta.estado, respuesta.detalle), codigo: respuesta.codigo }
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
  /**
   * Volver a leer el estado. **DEVUELVE la promesa, y eso no es un detalle de estilo.**
   *
   * Decía `() => { cargar(); }`: tragaba la promesa, así que `await onEstadoCambiado()` resolvía al
   * instante y quien esperaba seguía con el estado viejo en la mano.
   *
   * El defecto que eso produjo, reportado en vivo: el puente del Research al ICP guardaba el
   * segmento ganador, «esperaba» la recarga, y navegaba al paso 3 — que se montaba leyendo el
   * estado ANTERIOR y dibujaba su formulario vacío. Y no se arreglaba solo cuando la recarga
   * terminaba: `PanelHerramienta` lee sus valores en un inicializador de `useState` y su `key` no
   * cambia, así que el dato recién guardado aparecía recién a la próxima visita.
   *
   * Con la promesa devuelta, `setEstado` ya ocurrió cuando el que esperaba continúa, y su
   * `setActiva` entra en el mismo lote: la herramienta siguiente se monta leyendo lo nuevo.
   *
   * Los llamadores que no la esperan siguen funcionando igual — devolver una promesa que nadie mira
   * no cambia nada para ellos.
   */
  const recargar = useCallback(() => cargar(), [cargar]);

  /* ── CONSTRUIR EL MÉTODO EN CADENA ────────────────────────────────────────
   *
   * Pedido de Kevin: «un botón en el Research que me permita ejecutar el 3, 4, 5, 6 y 7 en
   * secuencia». Con los cinco pasos del research listos, las herramientas que siguen en ESTA
   * pantalla se construyen una tras otra, cada una con lo que la anterior acaba de producir.
   *
   * Vive acá y no en el panel del Research a propósito: el panel se desmonta al cambiar de
   * subpestaña, y una cadena de cinco generaciones —diez minutos— no puede depender de que nadie
   * toque nada. El armazón de la pantalla sigue montado aunque se cambie de vista.
   *
   * Cada eslabón es lo mismo que hace «Continuar al paso N» a una herramienta sin entregable, y por
   * los mismos caminos: el agente abre proponiendo con `generar`, y si con lo heredado alcanza, se
   * genera. La diferencia es que acá se REGENERA aunque ya exista entregable —«ejecutar todos» es
   * eso— y las versiones se apilan, no se pisan. Si a una herramienta le falta un obligatorio que
   * lo heredado no cubre, la cadena se detiene ahí y abre esa herramienta: el agente ya tiene la
   * pregunta hecha.
   *
   * El orden es el del catálogo de la pantalla, DESPUÉS del Research: hoy ICP, Categoría, Oferta,
   * Tu precio, Mapa. No está escrito acá; sale de `herramientas`. */
  const [cadena, setCadena] = useState(null);
  const cadenaViva = useRef(false);

  const eslabonesDelMetodo = useCallback(() => {
    const i = herramientas.findIndex((h) => h.forma === 'research');
    return i < 0 ? [] : herramientas.slice(i + 1).filter((h) => h.forma === 'generica');
  }, [herramientas]);

  const construirElMetodo = useCallback(async () => {
    const eslabones = eslabonesDelMetodo();
    if (eslabones.length === 0 || cadenaViva.current) return;
    cadenaViva.current = true;
    const hechos = [];

    for (const [indice, h] of eslabones.entries()) {
      setCadena({ indice, total: eslabones.length, actual: h, hechos: [...hechos], detenida: null });
      setActiva(h.id);

      const apertura = await pedir(rutaConversar, {
        metodo: 'POST',
        cuerpo: { herramienta: h.id, reiniciar: true, generar: true },
        espera: ESPERA_DE_RUTA_LARGA_MS,
      });
      if (apertura.tipo !== 'datos' || !apertura.datos.listo) {
        /* Se detiene y se queda en esa herramienta: si fue por un obligatorio que faltaba, el agente
           ya la dejó preguntada; si fue por un fallo, el chat muestra el error. Seguir con la
           siguiente sería construirla sobre un hueco. */
        setCadena({ indice, total: eslabones.length, actual: h, hechos, detenida: h });
        cadenaViva.current = false;
        return;
      }

      /* Los valores van por argumento, con el mismo cuidado de siempre: son los que el agente acaba de
         proponer, no los de ningún estado de React. */
      const ids = idsDeCampos(h.id);
      const valores = conValoresPorOmision(h, aValoresDeFormulario(ids, apertura.datos.respuestas));
      const generacion = await pedir(rutaGenerar, {
        metodo: 'POST',
        cuerpo: { herramienta: h.id, valores },
        espera: ESPERA_DE_RUTA_LARGA_MS,
      });
      if (generacion.tipo !== 'datos') {
        setCadena({ indice, total: eslabones.length, actual: h, hechos, detenida: h });
        cadenaViva.current = false;
        return;
      }
      hechos.push(h.id);
      /* Se recarga antes del siguiente eslabón para que la pantalla muestre el documento nuevo. El
         servidor no lo necesita —lee el almacén en cada llamada—; es para quien mira. */
      await cargar();
    }

    setCadena(null);
    cadenaViva.current = false;
  }, [eslabonesDelMetodo, rutaConversar, rutaGenerar, cargar]);

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
  /* `activa` guarda un id de herramienta (número) o la clave de una vista (texto). No chocan
     entre sí, así que una sola variable alcanza y no hay dos estados que puedan contradecirse. */
  const vistaActiva = vistas.find((v) => v.clave === activa) ?? null;
  const herramienta = herramientas.find((h) => h.id === activa) || herramientas[0];
  /* Solo chat si lo dice la pantalla entera (ICP & Oferta) o esta herramienta en particular (el VSL
     y la Landing en Tools). Se calcula acá y no arriba porque depende de cuál está activa. */
  const soloChat = soloChatDePantalla || herramienta.soloChat === true;
  const esConfiguracion =
    problema !== null &&
    (problema.codigo === 'sin_llave_de_ia' ||
      problema.codigo === 'sin_alumno_vinculado' ||
      problema.codigo === 'llave_de_ia_ilegible');

  return (
    <>
      {/* La banda de la cadena, arriba de TODO: sigue visible aunque se cambie de subpestaña, que es
          justo cuando alguien quiere saber si aquello sigue andando. Cinco generaciones son unos diez
          minutos, y un proceso de diez minutos sin señal es un proceso que parece muerto. */}
      {cadena ? (
        <div className={`fd-cadena${cadena.detenida ? ' detenida' : ''}`} role="status" aria-live="polite">
          {cadena.detenida ? null : <span className="fd-punto" />}
          <span className="fd-cadena-texto">
            {cadena.detenida ? (
              <>
                <b>La cadena se detuvo en {cadena.detenida.titulo}.</b> Mirá el chat de esa
                herramienta: o le falta un dato que no pude deducir, o la generación falló.
              </>
            ) : (
              <>
                <b>Construyendo el método</b> · {cadena.indice + 1} de {cadena.total} ·{' '}
                {cadena.actual.titulo}
              </>
            )}
          </span>
          <span className="fd-cadena-eslabones">
            {eslabonesDelMetodo().map((h) => (
              <span
                key={h.id}
                className={`fd-eslabon${cadena.hechos.includes(h.id) ? ' hecho' : ''}${cadena.actual.id === h.id && !cadena.detenida ? ' aqui' : ''}`}
                title={h.titulo}
              >
                {h.pestania}
              </span>
            ))}
          </span>
          {cadena.detenida ? (
            <button type="button" className="fd-btn sec" onClick={() => setCadena(null)}>
              Entendido
            </button>
          ) : null}
        </div>
      ) : null}

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
        {/* La raya separa dos cosas que NO son lo mismo: a la izquierda el recorrido numerado de
            herramientas, a la derecha las vistas. Sin ella, «Mis Leads» se leía como la etiqueta
            de la barra de progreso que viene justo después, y no como algo que se pueda tocar. */}
        {vistas.length > 0 ? <span className="fd-sep" aria-hidden="true" /> : null}

        {vistas.map((v) => (
          <button
            key={v.clave}
            type="button"
            role="tab"
            aria-selected={v.clave === activa}
            /* `.fd-vista` le da borde y fondo INCLUSO apagada. Las pestañas de herramienta
               apagadas son sólo texto tenue, y eso funciona cuando hay varias juntas: el grupo
               se lee como grupo. Una sola vista suelta al lado del medidor no tenía ninguna
               señal de ser un botón. */
            className={`fd-vista${v.clave === activa ? ' on' : ''}`}
            onClick={() => setActiva(v.clave)}
          >
            {/* Sin `.fd-n`: la numeración es del recorrido de herramientas, y esto no es un paso
                del recorrido. Numerarla diría que hay algo que completar. El icono ocupa ese
                lugar y dice lo contrario: es una lista, no un paso. */}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" />
            </svg>
            {v.pestania}
          </button>
        ))}
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
      {/* Una vista gana sobre las herramientas: si la pestaña activa es «Mis Leads», no se pinta
          ningún panel de herramienta. */}
      {vistaActiva ? (
        vistaActiva.render({ puedeEditar })
      ) : herramienta.forma === 'prospeccion' ? (
        <PanelProspeccion
          key={herramienta.id}
          herramienta={herramienta}
          estado={estadoUsable}
          puedeEditar={puedeEditar}
          organizacion={organizacion}
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
          organizacion={organizacion}
          faltaPermiso={faltaPermiso}
          pantalla={pantalla}
          soloChat={soloChat}
          rellenarAlLlegar={rellenarAlLlegar === herramienta.id}
          onIr={irA}
          onConstruirElMetodo={cadena ? null : construirElMetodo}
          eslabonesDelMetodo={eslabonesDelMetodo()}
          onEstadoCambiado={recargar}
          rutaEstado={rutaEstado}
          rutaGenerar={rutaGenerar}
          rutaConversar={rutaConversar}
        />
      ) : (
        <PanelHerramienta
          key={herramienta.id}
          herramienta={herramienta}
          estado={estadoUsable}
          puedeEditar={puedeEditar}
          organizacion={organizacion}
          faltaPermiso={faltaPermiso}
          pantalla={pantalla}
          soloChat={soloChat}
          onIr={irA}
          rellenarAlLlegar={rellenarAlLlegar === herramienta.id}
          onRellenadoAlLlegar={() => setRellenarAlLlegar(null)}
          onEstadoCambiado={recargar}
          rutaEstado={rutaEstado}
          rutaGenerar={rutaGenerar}
          rutaConversar={rutaConversar}
          rutaRellenar={rutaRellenar}
        />
      )}
    </>
  );
}
