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

import { useMemo, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import {
  aValoresDeFormulario,
  camposDe,
  conValoresPorOmision,
  obligatoriosQueFaltan,
} from '@/lib/fundaciones/campos';
import { PASOS_RESEARCH } from '@/lib/fundaciones/herramientas';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import ChatDeResearch from './ChatDeResearch';
import Documento from './Documento';

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
  onEstadoCambiado,
  /* Ver la nota de `PanelHerramienta`. El Research hoy solo existe en ICP & Oferta, y recibe
     sus rutas igual: que una pantalla tenga una sola herramienta de este tipo no es motivo
     para que ESTE archivo sepa a cuál pertenece. */
  rutaEstado,
  rutaGenerar,
  rutaConversar,
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
  const [modo, setModo] = useState('formulario');

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

  /** Los cinco, de a uno. Corta en el primero que falle: el siguiente lo necesitaba. */
  const correrTodo = async (v = valores) => {
    for (let paso = 0; paso < PASOS_RESEARCH; paso += 1) {
      const bien = await correrPaso(paso, v);
      if (!bien) return;
    }
  };

  /* Lo que el agente devuelve en cada turno, puesto en el formulario. Son claves cortas y el
     formulario usa identificadores de campo, así que la traducción es la de siempre.

     No se guarda en el almacén acá: mientras la conversación está a medias, los criterios viven en
     el documento del chat (ver `estado.ts`). Esto es para que cambiarse al formulario muestre lo
     que el agente entendió, y se pueda corregir a mano. */
  const anotarLoDelAgente = (criterios) => {
    setValores(aValoresDeFormulario(ids, criterios));
    setGuardado(false);
  };

  /* El agente terminó y la persona confirmó. Se guardan los criterios y arrancan los cinco pasos,
     que es exactamente lo que hace el botón del formulario — el mismo camino, disparado por la
     conversación en vez de por un clic.

     `conValoresPorOmision` es lo que iguala los dos modos: el formulario muestra `50,000+` desde
     que se abre, así que quien nunca tocó ese campo genera con ese valor. Sin esta línea, la misma
     conversación produciría un research con un criterio menos. */
  const arrancarDesdeElAgente = async (criterios) => {
    const v = conValoresPorOmision(herramienta, aValoresDeFormulario(ids, criterios));
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

      {/* Los dos caminos. Es un `tablist` de verdad y no dos botones sueltos: son dos vistas
          excluyentes de lo mismo, y quien navega con teclado o con lector de pantalla tiene que
          escuchar «pestaña 1 de 2», no dos botones sin relación entre sí. */}
      <div className="fd-modos" role="tablist" aria-label="Cómo llenar los criterios">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'formulario'}
          className={modo === 'formulario' ? 'on' : ''}
          disabled={corriendo !== null}
          onClick={() => setModo('formulario')}
        >
          <b>Opción 1</b> Formulario
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'agente'}
          className={modo === 'agente' ? 'on' : ''}
          disabled={corriendo !== null}
          onClick={() => setModo('agente')}
        >
          <b>Opción 2</b> Agente conversacional
        </button>
        <span className="fd-modos-nota">
          {modo === 'formulario'
            ? 'Llenás los cinco criterios y apretás ejecutar.'
            : 'Te hace las mismas cinco preguntas y arranca solo cuando confirmes.'}
        </span>
      </div>

      {modo === 'agente' ? (
        <ChatDeResearch
          herramienta={herramienta}
          inicial={estado.researchChat}
          puedeEditar={puedeEditar}
          corriendo={corriendo}
          onCriterios={anotarLoDelAgente}
          onArrancar={arrancarDesdeElAgente}
          rutaConversar={rutaConversar}
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

      <div className="fd-pasos">
        {TITULOS.map((titulo, paso) => {
          const salida = salidas[paso];
          const estaHecho = !!salida;
          const estaCorriendo = corriendo === paso;
          const abiertoEste = abierto === paso;
          return (
            <div
              key={paso}
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
    </div>
  );
}
