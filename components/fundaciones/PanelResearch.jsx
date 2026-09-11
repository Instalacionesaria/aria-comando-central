'use client';

/* Market Research: cinco pasos, y el orden no es decorativo.
   ==========================================================================
   Cada paso interpola la salida del anterior. El paso 5 —el que elige el segmento
   ganador, que es lo que hereda el ICP— lee los pasos 2 y 4.

   ── EL DEFECTO QUE ESTA FORMA EVITA, Y QUE EL HUB YA PAGÓ ─────────────────

   En ARIA-brain el encadenamiento leía las salidas del estado de React. `setState` es
   asíncrono, así que al armar el prompt del paso N+1 el estado todavía no tenía la
   salida del paso N: el paso 5 recibía la lista vacía y su plantilla interpolaba
   `undefined` donde iban los pasos 1 a 4. El documento salía, se veía bien, y estaba
   construido sobre nada.

   Acá el encadenamiento no vive en el navegador: cada paso es una petición, y el
   servidor lee las salidas anteriores DEL ALMACÉN (ver `generar/route.ts`). El
   navegador no puede mandar un encadenamiento equivocado porque no lo manda.

   ── DOS CAMINOS HASTA LOS MISMOS CINCO CRITERIOS ──────────────────────────

   El formulario y el agente conversacional. Lo que cambia es cómo se llega a los cinco
   valores; de ahí para abajo —los cinco pasos, sus documentos, lo que hereda el ICP— es
   exactamente el mismo código, y por eso la lista de pasos vive FUERA del selector: si
   cada modo dibujara la suya, arreglar una sería arreglar la mitad.

   ── Y POR ESO `correrPaso` RECIBE LOS VALORES ─────────────────────────────

   Antes los leía del estado del componente, que alcanzaba: los escribía el formulario y
   estaban ahí desde antes de apretar. El agente los trae en la RESPUESTA del turno que
   dice «arrancá», así que arrancar con los del estado sería leerlos un render antes de
   que existan — el mismo `setState` asíncrono que en el hub dejó al paso 5 generando
   sobre una lista vacía, entrando esta vez por la puerta de al lado.

   Pasarlos por argumento es lo que hace que ese defecto no se pueda escribir.

   ── UNA PETICIÓN POR PASO, NO UNA POR LOS CINCO ───────────────────────────

   Son cinco llamadas al modelo con búsqueda web. Encadenarlas en una sola petición
   HTTP significa que un fallo en el paso 4 tira también los tres que ya salieron
   bien. Así, el botón "ejecutar todo" recorre los cinco de a uno y cada uno que sale
   queda guardado. */

import { useMemo, useRef, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import { consultarTrabajo, iniciarScraping } from '@/lib/tools/scrapers';
import {
  aValoresDeFormulario,
  camposDe,
  conValoresPorOmision,
  obligatoriosQueFaltan,
} from '@/lib/fundaciones/campos';
import { faltantes, FUENTES_POR_HERRAMIENTA, fuentes } from '@/lib/fundaciones/herencia';
import { PASOS_RESEARCH } from '@/lib/fundaciones/herramientas';
import { TOPE_DE_NEGOCIOS as TOPE_MAPS } from '@/lib/fundaciones/mercado';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import BarraDePasos from './BarraDePasos';
import ChatDeHerramienta from './ChatDeHerramienta';
import Documento from './Documento';
import SelectorDeModo, { MODO_AGENTE, MODO_FORMULARIO } from './SelectorDeModo';

const TITULOS = [
  'Encontrar los segmentos',
  'Sus dolores y el dolor crítico',
  'Quién ya escaló resolviéndolo',
  'El modelo de precios',
  'El segmento ganador',
];

export default function PanelResearch({
  herramienta,
  estado,
  puedeEditar,
  organizacion,
  faltaPermiso,
  pantalla,
  /* Sin formulario: ver la misma prop en `PanelHerramienta`. */
  soloChat,
  /* Se llegó por «Continuar al paso 2». Ver `PanelHerramienta`. */
  rellenarAlLlegar,
  onIr,
  /* Construir en cadena los pasos que siguen. `null` mientras una cadena corre. Ver `Fundaciones`. */
  onConstruirElMetodo,
  eslabonesDelMetodo,
  onEstadoCambiado,
  /* Ver la nota de `PanelHerramienta`. El Research hoy solo existe en ICP & Oferta, y recibe
     sus rutas igual: que una pantalla tenga una sola herramienta de este tipo no es motivo
     para que ESTE archivo sepa a cuál pertenece. */
  rutaEstado,
  rutaGenerar,
  rutaConversar,
  /* La mirada al mercado real: qué buscar y qué se vio. Solo las pasa ICP & Oferta. Sin ellas el
     Research corre como siempre, sin scrapers. */
  rutaMercadoPreparar = null,
  rutaMercado = null,
}) {
  const ids = useMemo(() => camposDe(herramienta).map((c) => c.id), [herramienta]);

  const [valores, setValores] = useState(() => {
    const guardados = aValoresDeFormulario(ids, estado.researchInputs);
    for (const campo of camposDe(herramienta)) {
      if (guardados[campo.id] === undefined && campo.valorPorOmision) {
        guardados[campo.id] = campo.valorPorOmision;
      }
    }
    return guardados;
  });

  /* Arranca en el formulario, y no en el último modo que se usó: es lo que esta pantalla ya
     mostraba, y una pantalla que cambia de forma según algo que uno no recuerda haber elegido se
     lee como un error. Elegir el chat es un clic, y el chat que quedó a medias sigue ahí. */
  const [modo, setModo] = useState(soloChat ? MODO_AGENTE : MODO_FORMULARIO);

  const [salidas, setSalidas] = useState(() => [...estado.researchSalidas]);
  const [corriendo, setCorriendo] = useState(null);
  const [error, setError] = useState({});
  const [abierto, setAbierto] = useState(() => {
    // Se abre el último paso que ya salió; si no salió ninguno, ninguno.
    const hechos = estado.researchSalidas.filter((s) => !!s).length;
    return hechos > 0 ? hechos - 1 : null;
  });
  const [meta, setMeta] = useState({});
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorAlGuardar, setErrorAlGuardar] = useState(null);

  const hechos = salidas.filter((s) => !!s).length;

  /* Lo que el Research hereda —la ficha del negocio—, con la misma fila de chips que las genéricas
     (`PanelHerramienta`). Este panel no la tenía porque el Research no heredaba de nada; desde el
     2026-09-09 hereda de «Tu ficha» y tiene que verse igual que en las demás herramientas. */
  const todas = useMemo(() => fuentes(estado), [estado]);
  const heredadas = FUENTES_POR_HERRAMIENTA[herramienta.id] || [];
  const criticasQueFaltan = useMemo(() => faltantes(estado, herramienta.id), [estado, herramienta.id]);

  const ponerCampo = (id, v) => {
    setValores((previo) => ({ ...previo, [id]: v }));
    setGuardado(false);
  };

  /* Guardar los cinco criterios sin ejecutar nada. Mismo motivo que en las otras seis: son
     cinco campos, y perderlos por cerrar la pestaña es la peor forma de perder trabajo. Acá
     pesa más todavía, porque el research son cinco generaciones y nadie las arranca sin
     haber pensado los criterios primero. */
  const guardar = async (v = valores) => {
    setErrorAlGuardar(null);
    setGuardando(true);
    const r = await pedir(rutaEstado, {
      metodo: 'POST',
      cuerpo: { herramienta: 1, valores: v },
      espera: ESPERA_DE_RUTA_LARGA_MS,
    });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setErrorAlGuardar(
        r.tipo === 'rechazado' ? mensajeDeRechazo(r.codigo, r.estado, r.detalle) : SIN_RESPUESTA,
      );
      return;
    }
    setGuardado(true);
    onEstadoCambiado();
  };

  /**
   * Corre UN paso. Devuelve si salió bien, para que el recorrido de los cinco pueda cortar.
   *
   * Los valores llegan por argumento y el estado es solo el valor por omisión. Ver el encabezado:
   * el agente los trae en la respuesta del turno, un render antes de que el estado los tenga.
   */
  const correrPaso = async (paso, v = valores) => {
    setCorriendo(paso);
    setError((previo) => ({ ...previo, [paso]: null }));

    const r = await pedir(rutaGenerar, {
      metodo: 'POST',
      cuerpo: { herramienta: 1, valores: v, paso },
      espera: ESPERA_DE_RUTA_LARGA_MS,
    });

    if (r.tipo !== 'datos') {
      const mal =
        r.tipo === 'rechazado' ? mensajeDeRechazo(r.codigo, r.estado, r.detalle) : SIN_RESPUESTA;
      setError((previo) => ({ ...previo, [paso]: mal }));
      setCorriendo(null);
      return false;
    }

    // `salidas` viene del SERVIDOR, que las leyó del almacén y agregó la nueva. No se arma
    // acá: si se armara acá, volvería a existir el defecto de encadenamiento del hub.
    setSalidas(r.datos.salidas);
    setMeta((previo) => ({ ...previo, [paso]: r.datos }));
    setAbierto(paso);
    setCorriendo(null);
    onEstadoCambiado();
    return true;
  };

  /* ── LA MIRADA AL MERCADO REAL ─────────────────────────────────────────────
   *
   * Pedido de Jorge (2026-09-10): que el Research «también por dentro ejecute los scrapers de Google
   * Maps y Meta, pocos leads», y que lo visto sea contexto del agente y se vea en Mis Leads. Aprobado
   * sobre mockup con cuatro decisiones: DESPUÉS del paso 1 (ya hay segmentos), una confirmación porque
   * gasta saldo, Facebook páginas después, y sin saldo o sin ubicación el Research sigue y lo dice.
   *
   * El scraping lo arranca y lo sondea ESTE componente con las funciones de la pantalla Tools —mismo
   * proxy, misma capacidad `tools.editar`—; el servidor da las dos puntas: el rubro (preparar) y el
   * resumen contado desde la base (resumir). Los pasos 2 al 5 leen ese resumen del almacén.
   *
   * `mirada` es la única fuente de la interfaz de este tramo. Sus fases: `confirmar`, `buscando`,
   * `lista`, `omitida`. Con una mirada ya guardada, el panel abre en `lista`. */
  const [mirada, setMirada] = useState(() =>
    estado.researchMercado ? { fase: 'lista', mercado: estado.researchMercado } : null,
  );
  /* La confirmación es una promesa que resuelve el botón. Así la cadena de los cinco pasos se queda
     esperando en un `await`, sin desarmarse en estados. */
  const decision = useRef(null);
  const esperarDecision = () =>
    new Promise((resolver) => {
      decision.current = resolver;
    });
  const decidir = (si) => {
    const r = decision.current;
    decision.current = null;
    if (r) r(si);
  };

  const TERMINADOS = ['COMPLETED', 'FAILED', 'CANCELLED'];
  const esperarTrabajo = async (id) => {
    // Cada cinco segundos, hasta diez minutos. Un trabajo que no termina en ese tiempo se da por
    // caído y la mirada sigue con lo que haya: nunca se cuelga la cadena entera por un actor.
    for (let intento = 0; intento < 120; intento += 1) {
      await new Promise((r) => setTimeout(r, 5000));
      const t = await consultarTrabajo(id);
      if (t && TERMINADOS.includes(String(t.status))) return String(t.status);
    }
    return 'TIMEOUT';
  };

  const mirarElMercado = async (v) => {
    const ubicacion = (v['mr-location'] || '').trim();
    if (!rutaMercado || !rutaMercadoPreparar || ubicacion === '') return;

    // 1 · Qué buscar. Cuesta una inferencia corta: el rubro es el primer segmento del paso 1.
    const prep = await pedir(rutaMercadoPreparar, { metodo: 'POST', espera: ESPERA_DE_RUTA_LARGA_MS });
    if (prep.tipo !== 'datos' || !prep.datos.preparado) {
      setMirada({ fase: 'omitida', motivo: prep.tipo === 'datos' ? 'sin_ubicacion' : 'sin_preparar' });
      return;
    }
    const { rubro, topeDeNegocios, anuncios } = prep.datos;

    // 2 · La confirmación, una sola vez.
    setMirada({ fase: 'confirmar', rubro, ubicacion, tope: topeDeNegocios });
    const si = await esperarDecision();
    if (!si) {
      setMirada({ fase: 'omitida', motivo: 'no_quiso', rubro, ubicacion });
      return;
    }

    // 3 · Los dos scrapers, en paralelo. Maps descuenta saldo; el Espía no.
    setMirada({ fase: 'buscando', rubro, ubicacion, maps: { estado: 'arrancando' }, espia: { estado: 'arrancando' } });
    const [maps, espia] = await Promise.all([
      iniciarScraping('maps', { businessType: rubro, location: ubicacion, maxLeads: topeDeNegocios, getEmails: true }),
      iniciarScraping('ad-spy', { query: rubro, country: 'ALL', count: anuncios }),
    ]);
    if (maps.tipo !== 'trabajo' && espia.tipo !== 'trabajo') {
      // Sin saldo, o sin permiso de Tools: el Research sigue con lo que el modelo sabe.
      setMirada({ fase: 'omitida', motivo: 'sin_saldo', detalle: maps.mensaje, rubro, ubicacion });
      return;
    }
    const pinta = (r) => (r.tipo === 'trabajo' ? { id: r.id, estado: 'corriendo' } : { estado: 'fallo', mensaje: r.mensaje });
    setMirada({ fase: 'buscando', rubro, ubicacion, maps: pinta(maps), espia: pinta(espia) });

    // 4 · Esperar a los dos. Cada uno actualiza su renglón al terminar.
    const esperas = [];
    if (maps.tipo === 'trabajo') {
      esperas.push(
        esperarTrabajo(maps.id).then((st) =>
          setMirada((m) => (m && m.fase === 'buscando' ? { ...m, maps: { ...m.maps, estado: st === 'COMPLETED' ? 'listo' : 'fallo' } } : m)),
        ),
      );
    }
    if (espia.tipo === 'trabajo') {
      esperas.push(
        esperarTrabajo(espia.id).then((st) =>
          setMirada((m) => (m && m.fase === 'buscando' ? { ...m, espia: { ...m.espia, estado: st === 'COMPLETED' ? 'listo' : 'fallo' } } : m)),
        ),
      );
    }
    await Promise.all(esperas);

    // 5 · Qué se vio, contado en el servidor desde la base, y guardado en el Research.
    const r = await pedir(rutaMercado, {
      metodo: 'POST',
      cuerpo: {
        rubro,
        ubicacion,
        trabajoMaps: maps.tipo === 'trabajo' ? maps.id : null,
        trabajoEspia: espia.tipo === 'trabajo' ? espia.id : null,
      },
    });
    if (r.tipo !== 'datos') {
      setMirada({ fase: 'omitida', motivo: 'sin_resumen', rubro, ubicacion });
      return;
    }
    setMirada({ fase: 'lista', mercado: r.datos });
    onEstadoCambiado();
  };

  /** Los cinco, de a uno. Corta en el primero que falle: el siguiente lo necesitaba. */
  const correrTodo = async (v = valores) => {
    for (let paso = 0; paso < PASOS_RESEARCH; paso += 1) {
      const bien = await correrPaso(paso, v);
      if (!bien) return;
      // Entre el paso 1 y el 2: mirar el mercado real, si hay dónde. Los pasos 2 al 5 lo leen.
      if (paso === 0) await mirarElMercado(v);
    }
  };

  /* Lo que el agente devuelve en cada turno, puesto en el formulario. Son claves cortas y el
     formulario usa identificadores de campo, así que la traducción es la de siempre.

     No se guarda en el almacén acá: mientras la conversación está a medias, los criterios viven en
     el documento del chat (ver `estado.ts`). Esto es para que cambiarse al formulario muestre lo
     que el agente entendió, y se pueda corregir a mano. */
  const anotarLoDelAgente = (respuestas) => {
    setValores(aValoresDeFormulario(ids, respuestas));
    setGuardado(false);
  };

  /* El agente terminó y la persona confirmó. Se guardan los criterios y arrancan los cinco pasos,
     que es exactamente lo que hace el botón del formulario — el mismo camino, disparado por la
     conversación en vez de por un clic.

     `conValoresPorOmision` es lo que iguala los dos modos: el formulario muestra `50,000+` desde
     que se abre, así que quien nunca tocó ese campo genera con ese valor. Sin esta línea, la misma
     conversación produciría un research con un criterio menos. */
  const arrancarDesdeElAgente = async (respuestas) => {
    const v = conValoresPorOmision(herramienta, aValoresDeFormulario(ids, respuestas));
    setValores(v);
    await guardar(v);
    await correrTodo(v);
  };

  /* La regla de qué es obligatorio sale del catálogo y la comparten el formulario, el agente y el
     servidor. Ver `obligatoriosQueFaltan`: antes eran dos constantes con los identificadores
     escritos a mano, acá y solo acá. */
  const faltan = obligatoriosQueFaltan(herramienta, valores);

  return (
    <div className="cl-page">
      <div className="fd-cab">
        <h3>{herramienta.titulo}</h3>
        <span className="fd-bajada">{herramienta.bajada}</span>
        {herramienta.detalle ? (
          <>
            <button type="button" className="fd-mas" onClick={() => setDetalleAbierto((v) => !v)}>
              ¿Cómo funciona? {detalleAbierto ? '▴' : '▾'}
            </button>
            {detalleAbierto ? <div className="fd-detalle">{herramienta.detalle}</div> : null}
          </>
        ) : null}
      </div>

      {heredadas.length > 0 ? (
        <div className="fd-herencia">
          <span className="fd-etq">Hereda de</span>
          {heredadas.map((clave) => {
            const f = todas[clave];
            const critica = criticasQueFaltan.includes(clave);
            return (
              <button
                key={clave}
                type="button"
                className={`fd-fuente${f.presente ? ' ok' : critica ? ' falta' : ''}`}
                onClick={() => onIr(f.herramienta)}
                title={f.presente ? 'Ir a la herramienta que lo produjo' : 'Ir a completarlo'}
              >
                <b>{f.etiqueta}</b>
                {f.presente ? (f.resumen ? f.resumen : 'listo') : 'sin hacer'}
              </button>
            );
          })}
        </div>
      ) : null}

      {!soloChat ? (
        <SelectorDeModo
          modo={modo}
          onElegir={setModo}
          bloqueado={corriendo !== null}
          queHaceElAgente="Te hace las mismas cinco preguntas y arranca los cinco pasos cuando confirmes."
        />
      ) : null}

      {corriendo !== null ? (
        <div className="fd-construyendo" role="status" aria-live="polite">
          <span className="fd-punto" />
          <span>
            <b>Construyendo tu Market Research</b> — paso {corriendo + 1} de {PASOS_RESEARCH}:{' '}
            {TITULOS[corriendo]}. Busca en la web, así que tarda.
          </span>
        </div>
      ) : null}

      {soloChat || modo === MODO_AGENTE ? (
        <ChatDeHerramienta
          herramienta={herramienta}
          inicial={estado.chats[herramienta.id]}
          puedeEditar={puedeEditar}
          corriendo={corriendo !== null}
          onRespuestas={anotarLoDelAgente}
          onArrancar={arrancarDesdeElAgente}
          rutaConversar={rutaConversar}
          reiniciarAlAbrir={!!soloChat && hechos === 0}
          generarAlAbrir={!!rellenarAlLlegar && !!soloChat && hechos === 0}
        />
      ) : (
        <div className="card">
          <div className="card-head">
            <span>Criterios de búsqueda</span>
            <span className="hint">{hechos} de {PASOS_RESEARCH} pasos</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {herramienta.filas.map((fila, i) => (
              <div key={i} className={`fd-rejilla${fila.columnas === 2 ? ' dos' : ''}`}>
                {fila.campos.map((campo) => (
                  <div className="fd-campo" key={campo.id}>
                    <label htmlFor={campo.id}>{campo.etiqueta}</label>
                    {campo.tipo === 'area' ? (
                      <textarea
                        id={campo.id}
                        value={valores[campo.id] || ''}
                        placeholder={campo.marcador}
                        onChange={(e) => ponerCampo(campo.id, e.target.value)}
                      />
                    ) : (
                      <input
                        id={campo.id}
                        type="text"
                        value={valores[campo.id] || ''}
                        placeholder={campo.marcador}
                        onChange={(e) => ponerCampo(campo.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Lo obligatorio se dice ANTES de gastar cinco generaciones: el paso 1 busca dentro
                del nicho y el paso 5 elige el segmento contra la experiencia real de quien va a
                venderlo. Sin eso, los cinco pasos salen genéricos y el alumno no tiene forma de
                saber por qué.

                La lista sale del catálogo y las etiquetas también: antes estaban acá escritas a
                mano —«tu nicho», «tu experiencia»— y un sexto criterio obligatorio habría dejado
                este aviso mintiendo, con el botón habilitado igual. */}
            {faltan.length > 0 ? (
              <div className="fd-aviso falta">
                <i>◍</i>
                <span>
                  Falta{' '}
                  {faltan.map((campo, i) => (
                    <span key={campo.id}>
                      {i > 0 ? (i === faltan.length - 1 ? ' y ' : ', ') : null}
                      <b>{campo.etiqueta}</b>
                    </span>
                  ))}
                  . Sin eso el research sale genérico: el paso 1 busca dentro del nicho y el paso 5
                  elige el segmento contra tu trasfondo.
                </span>
              </div>
            ) : null}

            {puedeEditar ? (
              <div className="fd-acciones">
                <button
                  type="button"
                  className="fd-btn"
                  disabled={corriendo !== null || faltan.length > 0}
                  /* `() => correrTodo()` y no `correrTodo`: como manejador directo recibiría el
                     evento de React donde ahora van los valores, y el paso 1 se generaría con un
                     `SyntheticEvent` en vez de con los criterios. */
                  onClick={() => correrTodo()}
                >
                  {corriendo !== null
                    ? `Paso ${corriendo + 1} de ${PASOS_RESEARCH}…`
                    : hechos > 0
                      ? 'Volver a ejecutar todo'
                      : herramienta.etiquetaBoton}
                </button>
                {hechos > 0 && hechos < PASOS_RESEARCH ? (
                  <button
                    type="button"
                    className="fd-btn sec"
                    disabled={corriendo !== null}
                    onClick={() => correrPaso(hechos)}
                  >
                    Seguir desde el paso {hechos + 1}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="fd-btn sec"
                  disabled={corriendo !== null || guardando}
                  onClick={() => guardar()}
                >
                  {guardando ? 'Guardando…' : 'Guardar criterios'}
                </button>
                {guardado ? <span className="fd-guardado">Guardado</span> : null}
              </div>
            ) : faltaPermiso ? (
              <div className="fd-aviso">
                <i>◍</i>
                <span>
                  Tu rol puede <b>ver</b> este research pero no ejecutarlo.
                </span>
              </div>
            ) : null}

            {errorAlGuardar ? (
              <div className="fd-aviso mal">
                <i>◍</i>
                <span>{errorAlGuardar}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* El progreso vive FUERA del selector, y por eso se dibuja acá y no adentro de la tarjeta
          del formulario: los cinco pasos son los mismos vengan de donde vengan, y quien arrancó
          desde el chat tiene que ver lo mismo que quien apretó el botón. */}
      {corriendo !== null ? (
        <div className="fd-cargando">
          <span className="fd-punto" />
          Paso {corriendo + 1}: {TITULOS[corriendo]}. Busca en la web, así que tarda.
        </div>
      ) : null}

      {/* La barra del método va ACÁ y no al pie, y la diferencia la reportó Kevin: «no lo veo».
          Estaba al final del panel, que es donde el hub la pone — pero allá los cinco pasos son
          chips y el panel entra en una pantalla. Acá cada paso es una tarjeta con su documento
          adentro, así que el pie queda a varios scrolls de distancia y el botón no existe para quien
          no baja hasta el fondo. Pegada a los controles se ve al llegar, que es cuando hace falta. */}
      {onIr ? (
        <BarraDePasos
          herramienta={herramienta}
          estado={estado}
          pantalla={pantalla}
          onIr={onIr}
        />
      ) : null}

      <div className="fd-pasos">
        {TITULOS.map((titulo, paso) => {
          const salida = salidas[paso];
          const estaHecho = !!salida;
          const estaCorriendo = corriendo === paso;
          const abiertoEste = abierto === paso;
          return (
            <div key={paso} className="fd-paso-y-mirada">
            {paso === 1 && mirada ? <Mirada mirada={mirada} onDecidir={decidir} /> : null}
            <div
              className={`fd-paso${estaHecho ? ' hecho' : ''}${estaCorriendo ? ' corriendo' : ''}`}
            >
              <div
                className="fd-paso-cab"
                onClick={() => setAbierto(abiertoEste ? null : paso)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setAbierto(abiertoEste ? null : paso);
                }}
              >
                <span className="fd-paso-n">{estaHecho ? '✓' : paso + 1}</span>
                <span className="fd-paso-t">{titulo}</span>
                <span className="fd-paso-e">
                  {estaCorriendo ? 'corriendo…' : estaHecho ? 'listo' : 'pendiente'}
                </span>
              </div>

              {abiertoEste ? (
                <div className="fd-paso-cuerpo">
                  {error[paso] ? (
                    <div className="fd-aviso mal">
                      <i>◍</i>
                      <span>{error[paso]}</span>
                    </div>
                  ) : null}

                  {estaHecho ? (
                    <Documento
                      titulo={`Paso ${paso + 1} — ${titulo}`}
                      texto={salida}
                      versiones={[]}
                      versionActiva={0}
                      onElegirVersion={() => {}}
                      cortado={meta[paso] ? meta[paso].cortado : false}
                      citas={meta[paso] ? meta[paso].citas : []}
                      meta={meta[paso]}
                      organizacion={organizacion}
                      onAjustar={null}
                      ajustando={false}
                    />
                  ) : (
                    <div className="fd-aviso">
                      <i>◍</i>
                      <span>
                        {paso === 0
                          ? 'Este es el primer paso: no necesita nada previo.'
                          : `Este paso lee la salida del paso ${paso}. Se ejecuta en orden.`}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            </div>
          );
        })}
      </div>

      {hechos >= PASOS_RESEARCH ? (
        <div className="fd-aviso">
          <i>◍</i>
          <span>
            Los cinco pasos están. <b>El paso 5 es lo que hereda tu ICP</b>: si volvés a
            ejecutar el research, conviene regenerar el ICP después.
          </span>
        </div>
      ) : null}

      {/* Con los cinco pasos, el botón que construye lo que sigue, en cadena. Solo con permiso de
          editar —son cinco generaciones de la llave de la organización— y solo si hay eslabones:
          cuántos y cuáles sale del catálogo, no de este archivo. */}
      {hechos >= PASOS_RESEARCH && puedeEditar && onConstruirElMetodo && eslabonesDelMetodo && eslabonesDelMetodo.length > 0 ? (
        <div className="fd-construir">
          <div className="fd-construir-texto">
            <b>⚡ Construir el método completo (pasos 3 → {2 + eslabonesDelMetodo.length})</b>
            <span>
              {eslabonesDelMetodo.map((h) => h.pestania).join(' → ')}, uno tras otro, cada uno con lo
              que el anterior acaba de producir. Son {eslabonesDelMetodo.length} generaciones, unos{' '}
              {eslabonesDelMetodo.length * 2} minutos. Las versiones anteriores se conservan.
            </span>
          </div>
          <button type="button" className="fd-btn" onClick={onConstruirElMetodo}>
            Construir
          </button>
        </div>
      ) : null}

    </div>
  );
}

/* ── LA MIRADA AL MERCADO REAL, DIBUJADA ─────────────────────────────────────
   Vive entre el paso 1 y el 2, con borde punteado y sangría: NO es un paso del método —los cinco
   siguen siendo cinco— sino algo que el Research hace entre dos de ellos. Cuatro fases, cuatro
   formas. Aprobado sobre mockup (2026-09-10). */
function Mirada({ mirada, onDecidir }) {
  const titulo = (
    <div className="fd-mirada-titulo">
      <span>Mirada al mercado real{mirada.rubro ? ` · ${mirada.rubro}` : ''}{mirada.ubicacion ? ` · ${mirada.ubicacion}` : ''}</span>
    </div>
  );

  if (mirada.fase === 'confirmar') {
    return (
      <div className="fd-mirada gasto" role="status">
        <div className="fd-mirada-t">
          <i>◍</i>
          <div>
            <b>¿Buscamos negocios reales de «{mirada.rubro}» en {mirada.ubicacion}?</b>
            <small>
              Google Maps trae hasta {mirada.tope} negocios con web y correo cuando los tienen, y el Espía de Anuncios mira
              qué publicidad corre ese segmento. Los pasos 2 al 5 se construyen sobre eso.{' '}
              <b>Descuenta hasta {mirada.tope} leads de tu saldo.</b> El Espía no descuenta.
            </small>
          </div>
        </div>
        <div className="fd-mirada-acciones">
          <button type="button" className="fd-btn" onClick={() => onDecidir(true)}>
            Sí, buscar {mirada.tope} negocios
          </button>
          <button type="button" className="fd-btn sec" onClick={() => onDecidir(false)}>
            Seguir sin datos reales
          </button>
        </div>
      </div>
    );
  }

  if (mirada.fase === 'buscando') {
    const renglon = (nombre, que, f) => (
      <div className={`fd-mirada-fuente ${f.estado === 'listo' ? 'ok' : f.estado === 'fallo' ? 'mal' : 'corriendo'}`}>
        <span className="fd-mirada-pt" />
        <span>
          {nombre} · {que}
        </span>
        <span className="fd-mirada-e">
          {f.estado === 'listo' ? 'listo' : f.estado === 'fallo' ? (f.mensaje || 'no se pudo') : f.estado === 'arrancando' ? 'arrancando…' : 'corriendo…'}
        </span>
      </div>
    );
    return (
      <div className="fd-mirada" role="status" aria-live="polite">
        {titulo}
        {renglon('Google Maps', `hasta ${TOPE_MAPS} negocios`, mirada.maps)}
        {renglon('Espía de Anuncios', 'qué publicidad corre el segmento', mirada.espia)}
        <small className="fd-mirada-nota">Tarda unos minutos. El paso 2 arranca cuando terminen los dos.</small>
      </div>
    );
  }

  if (mirada.fase === 'lista') {
    const m = mirada.mercado;
    const x = m.maps;
    const a = m.anuncios;
    return (
      <div className="fd-mirada lista">
        <div className="fd-mirada-titulo">
          <span>Lo que vimos en el mercado real · {m.rubro} · {m.ubicacion}</span>
          {x ? <span className="fd-mirada-link">Los {x.total} negocios están en Tools → Mis Leads</span> : null}
        </div>
        <div className="fd-cifras">
          {x ? <div className="fd-cifra"><b>{x.total}</b><span>negocios en Google Maps</span></div> : null}
          {x ? <div className="fd-cifra"><b>{x.conWeb}</b><span>con sitio web</span></div> : null}
          {x ? <div className="fd-cifra"><b>{x.conEmail}</b><span>con correo visible</span></div> : null}
          {a ? <div className="fd-cifra"><b>{a.total}</b><span>anuncios activos del segmento</span></div> : null}
        </div>
        {x && (x.ciudades.length > 0 || x.calificacionPromedio !== null) ? (
          <p>
            {x.ciudades.length > 0 ? `Concentrados en ${x.ciudades.join(', ')}. ` : ''}
            {x.calificacionPromedio !== null ? `Calificación promedio ${x.calificacionPromedio}. ` : ''}
            {x.total > 0 ? `${x.total - x.conWeb} de ${x.total} no tienen sitio web propio.` : ''}
          </p>
        ) : null}
        {a && a.muestras.length > 0 ? (
          <p>
            <b>Qué prometen los anuncios:</b> {a.muestras.slice(0, 3).join(' · ')}
          </p>
        ) : null}
      </div>
    );
  }

  // omitida
  const textos = {
    no_quiso: 'El Research sigue sin datos reales, como pediste.',
    sin_saldo: `No se pudo buscar en Google Maps${mirada.detalle ? `: ${mirada.detalle}` : ''}. El Research sigue con lo que el modelo sabe del mercado.`,
    sin_ubicacion: 'Sin una ubicación en los criterios no hay dónde buscar negocios reales. El Research sigue igual.',
    sin_preparar: 'No se pudo preparar la búsqueda. El Research sigue con lo que el modelo sabe.',
    sin_resumen: 'Los scrapers corrieron pero no se pudo guardar el resumen. Los negocios están en Tools → Mis Leads.',
  };
  return (
    <div className="fd-mirada omitida" role="status">
      <i>◍</i>
      <span>{textos[mirada.motivo] || textos.sin_preparar}</span>
    </div>
  );
}
