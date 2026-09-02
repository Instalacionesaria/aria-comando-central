'use client';

/* Una herramienta de formulario: ocho de las nueve.
   ==========================================================================
   Tu ficha, ICP, Categoría, Oferta, Tu precio, Mapa, el VSL y la Landing comparten
   forma: llenás campos, apretás un botón, sale un documento. La novena (Research)
   tiene su propio panel, porque son cinco pasos encadenados y eso no es la misma
   interacción.

   ── DOS CAMINOS HASTA LOS MISMOS CAMPOS ───────────────────────────────────

   El formulario y el agente conversacional, que hace LAS MISMAS preguntas —las
   etiquetas de este mismo catálogo, derivadas en el servidor— y cuando la persona
   confirma dispara esta misma generación, con este mismo cuerpo. Lo que cambia es
   cómo se llega a los valores; de ahí para abajo no cambia nada, y por eso el
   documento y lo que se hereda viven FUERA del selector.

   Y por eso también `guardar` y `generar` reciben los valores por argumento: el
   agente los trae en la RESPUESTA del turno que dice «generá», así que generar con
   los del estado sería leerlos un render antes de que existan. Es el mismo
   `setState` asíncrono que en ARIA-brain dejó al paso 5 del Research generando
   sobre una lista vacía — el documento salía, se veía bien, y estaba construido
   sobre nada. Pasarlos por argumento hace que eso no se pueda escribir.

   ── LO QUE ESTE COMPONENTE HACE Y NO SE VE ────────────────────────────────

   1. **Guarda lo escrito sin generar.** El botón secundario existe porque el trabajo
      de llenar ocho campos se pierde de la peor manera: escribís media ficha, cerrás
      la pestaña, y volvés a una pantalla en blanco.
   2. **Muestra qué falta ANTES de gastar la generación.** Las fuentes críticas que no
      están se marcan en coral y el aviso dice qué va a pasar (marcadores `[COMPLETAR]`
      en vez de cifras). No bloquea: hay alumnos que llegan con el posicionamiento
      hecho fuera del sistema, y bloquearlos sería peor que avisarles.
   3. **Distingue rechazo de vacío de "no pude preguntar"** (`ADR-0305`). Los tres
      llegan por ramas distintas del cliente HTTP y se muestran distinto. */

import { useMemo, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import { aValoresDeFormulario, camposDe, conValoresPorOmision } from '@/lib/fundaciones/campos';
import { tieneAgente } from '@/lib/fundaciones/herramientas';
import { faltantes, FUENTES_POR_HERRAMIENTA, fuentes } from '@/lib/fundaciones/herencia';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import BandaDeMomento from './BandaDeMomento';
import ChatDeHerramienta from './ChatDeHerramienta';
import Documento from './Documento';
import SelectorDeModo, { MODO_AGENTE, MODO_FORMULARIO } from './SelectorDeModo';

export default function PanelHerramienta({
  herramienta,
  estado,
  puedeEditar,
  organizacion,
  faltaPermiso,
  onIr,
  onSiguientePaso,
  onEstadoCambiado,
  /* Las dos rutas de SU pantalla. Llegan por props y no están escritas acá porque el mismo
     panel sirve a ICP & Oferta y a Tools, que tienen capacidades distintas: una ruta escrita
     adentro haría que Tools guardara y generara con la capacidad de Fundaciones. */
  rutaEstado,
  rutaGenerar,
  rutaConversar,
}) {
  const ids = useMemo(() => camposDe(herramienta).map((c) => c.id), [herramienta]);

  const [valores, setValores] = useState(() => {
    const guardados = aValoresDeFormulario(ids, estado.perfil[herramienta.id]);
    // Los valores por omisión NO pisan lo guardado: solo rellenan lo que nunca se escribió.
    for (const campo of camposDe(herramienta)) {
      if (guardados[campo.id] === undefined && campo.valorPorOmision) {
        guardados[campo.id] = campo.valorPorOmision;
      }
    }
    return guardados;
  });

  const versionesGuardadas = estado.historial[herramienta.id] || [];
  const [version, setVersion] = useState(0);
  /* `reciente` es el documento que acaba de salir de una generación. Existe aparte de las
     versiones guardadas porque la respuesta trae metadatos —tiempo, tokens, si quedó
     cortado— que el almacén no guarda, y perderlos al instante sería raro. */
  const [reciente, setReciente] = useState(null);

  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);

  const [detalleAbierto, setDetalleAbierto] = useState(false);

  /* Arranca en el formulario, y no en el último modo que se usó: es lo que esta pantalla ya
     mostraba, y una pantalla que cambia de forma según algo que uno no recuerda haber elegido se lee
     como un error. Elegir el chat es un clic, y el que quedó a medias sigue ahí.

     `rutaConversar` puede no venir —`ToolsView` la pasa en `null` para las herramientas sin agente—
     y `tieneAgente` es la misma función que usa el servidor para decidir si acepta la conversación:
     ofrecer el modo donde la ruta lo va a rechazar es mostrar un control que no puede cumplir. */
  const conAgente = !!rutaConversar && tieneAgente(herramienta);
  const [modo, setModo] = useState(MODO_FORMULARIO);

  const todas = useMemo(() => fuentes(estado), [estado]);
  const heredadas = FUENTES_POR_HERRAMIENTA[herramienta.id] || [];
  const criticasQueFaltan = useMemo(() => faltantes(estado, herramienta.id), [estado, herramienta.id]);

  const documento = reciente
    ? reciente.texto
    : versionesGuardadas[version]
      ? versionesGuardadas[version].output
      : '';

  const ponerCampo = (id, v) => {
    setValores((previo) => ({ ...previo, [id]: v }));
    setGuardado(false);
  };

  /** Traduce las tres ramas del cliente a un mensaje, o `null` si trajo datos. */
  const problema = (respuesta) => {
    if (respuesta.tipo === 'datos') return null;
    if (respuesta.tipo === 'rechazado') return mensajeDeRechazo(respuesta.codigo, respuesta.estado, respuesta.detalle);
    return SIN_RESPUESTA;
  };

  const guardar = async (v = valores) => {
    setError(null);
    setGuardando(true);
    const r = await pedir(rutaEstado, {
      metodo: 'POST',
      cuerpo: { herramienta: herramienta.id, valores: v },
      espera: ESPERA_DE_RUTA_LARGA_MS,
    });
    setGuardando(false);
    const mal = problema(r);
    if (mal) {
      setError(mal);
      return;
    }
    setGuardado(true);
    onEstadoCambiado();
  };

  const generar = async (ajuste, v = valores) => {
    setError(null);
    setGenerando(true);
    const cuerpo = { herramienta: herramienta.id, valores: v };
    if (ajuste) {
      cuerpo.ajuste = ajuste;
      cuerpo.previa = documento;
    }
    const r = await pedir(rutaGenerar, { metodo: 'POST', cuerpo, espera: ESPERA_DE_RUTA_LARGA_MS });
    setGenerando(false);
    const mal = problema(r);
    if (mal) {
      setError(mal);
      return;
    }
    setReciente(r.datos);
    setVersion(0);
    // Se recarga el estado para que las herramientas de aguas abajo vean el documento nuevo:
    // la Oferta que se acaba de generar es lo que el Mapa hereda, y sin esto su pestaña
    // seguiría diciendo que falta.
    onEstadoCambiado();
  };

  /* Lo que el agente devuelve en cada turno, puesto en el formulario. Son claves cortas y el
     formulario usa identificadores de campo, así que la traducción es la de siempre.

     No se guarda en el almacén acá: mientras la conversación está a medias, las respuestas viven en
     el documento del chat (ver `estado.ts`). Esto es para que cambiarse al formulario muestre lo que
     el agente entendió, y se pueda corregir a mano. */
  const anotarLoDelAgente = (respuestas) => {
    setValores(aValoresDeFormulario(ids, respuestas));
    setGuardado(false);
  };

  /* El agente terminó y la persona confirmó. Se guarda y se genera, que es exactamente lo que hacen
     los dos botones del formulario — el mismo camino, disparado por la conversación en vez de por un
     clic.

     `conValoresPorOmision` es lo que iguala los dos modos: el formulario muestra el valor de omisión
     desde que se abre, así que quien nunca tocó ese campo genera con ese valor. Sin esta línea, la
     misma conversación produciría un entregable con un dato menos. */
  const generarDesdeElAgente = async (respuestas) => {
    const v = conValoresPorOmision(herramienta, aValoresDeFormulario(ids, respuestas));
    setValores(v);
    await guardar(v);
    await generar(null, v);
  };

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

      {criticasQueFaltan.length > 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            Podés generar igual, pero el documento va a salir con marcadores{' '}
            <b>[COMPLETAR]</b> donde debería haber datos de{' '}
            <b>{criticasQueFaltan.map((c) => todas[c].etiqueta).join(', ')}</b>. No se inventan
            cifras: es a propósito.
          </span>
        </div>
      ) : null}

      {conAgente ? (
        <SelectorDeModo
          modo={modo}
          onElegir={setModo}
          bloqueado={generando}
          queHaceElAgente={`Te hace las mismas preguntas y genera tu ${herramienta.etiquetaSalida} cuando confirmes.`}
        />
      ) : null}

      {conAgente && modo === MODO_AGENTE ? (
        <ChatDeHerramienta
          herramienta={herramienta}
          inicial={estado.chats[herramienta.id]}
          puedeEditar={puedeEditar}
          corriendo={generando}
          onRespuestas={anotarLoDelAgente}
          onArrancar={generarDesdeElAgente}
          rutaConversar={rutaConversar}
        />
      ) : (
        <div className="card">
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
                    ) : campo.tipo === 'lista' ? (
                      /* El desplegable entró con el VSL, que tiene tres.
                         ── POR QUÉ NO ES UN `input` CON SUGERENCIAS ──────────────────────
                         Los valores de estas listas NO son etiquetas: son el texto que entra
                         al prompt, y el `SKILL.md` del VSL deriva de ellos tres booleanos que
                         encienden ramas enteras del framework (`_isB2C`, `_hasProof`,
                         `_isScreenShare`). La derivación mira el principio de la cadena, así
                         que un valor escrito a mano —"b2c", "si"— apaga la rama y el documento
                         sale igual, con el molde equivocado. Un desplegable hace que solo
                         existan los valores que el framework entiende. */
                      <select
                        id={campo.id}
                        value={valores[campo.id] ?? campo.valorPorOmision ?? ''}
                        onChange={(e) => ponerCampo(campo.id, e.target.value)}
                      >
                        {/* Sin opción vacía inyectada: cuando la lista necesita una, viene en
                            `opciones` con su propio texto (el `Selecciona…` de la prueba
                            social). Agregar una acá dejaría dos vacíos en esa lista. */}
                        {campo.opciones?.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={campo.id}
                        type={campo.tipo === 'numero' ? 'number' : 'text'}
                        value={valores[campo.id] || ''}
                        placeholder={campo.marcador}
                        onChange={(e) => ponerCampo(campo.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}

            {puedeEditar ? (
              <div className="fd-acciones">
                <button type="button" className="fd-btn" disabled={generando} onClick={() => generar(null)}>
                  {generando ? 'Generando…' : herramienta.etiquetaBoton}
                </button>
                {/* `() => guardar()` y no `guardar`: como manejador directo recibiría el evento de
                    React donde ahora van los valores, y el cuerpo saldría con un `SyntheticEvent`
                    en vez de con el formulario. */}
                <button type="button" className="fd-btn sec" disabled={guardando} onClick={() => guardar()}>
                  {guardando ? 'Guardando…' : 'Guardar sin generar'}
                </button>
                {guardado ? <span className="fd-guardado">Guardado</span> : null}
              </div>
            ) : faltaPermiso ? (
              /* El control no se renderiza en vez de mostrarse y dar 403. Es el `07` § 4:
                 "mostrar un control que no puede cumplir".

                 Y este cartel aparece SOLO cuando la causa es el permiso. Si la causa fuera que no
                 se pudo leer el estado, decir "tu rol" mandaría a pedirle un permiso a alguien que
                 no tiene nada que darle — el aviso de arriba ya dice qué pasó de verdad. */
              <div className="fd-aviso">
                <i>◍</i>
                <span>
                  Tu rol puede <b>ver</b> este trabajo pero no generarlo. Lo de abajo es lo último
                  que se generó.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* El progreso y el error viven FUERA del selector: la generación es la misma venga del botón
          o de la conversación, y quien arrancó desde el chat tiene que ver lo mismo que quien apretó
          el botón. Adentro de la tarjeta del formulario, el modo agente se quedaba sin ninguna
          señal de que su documento estaba en camino. */}
      {error ? (
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      {generando ? (
        <>
          <div className="fd-cargando">
            <span className="fd-punto" />
            Esto tarda entre uno y tres minutos. No cierres la pestaña.
          </div>
          <div className="fd-esqueleto">
            <span style={{ width: '62%' }} />
            <span style={{ width: '94%' }} />
            <span style={{ width: '88%' }} />
            <span style={{ width: '71%' }} />
          </div>
        </>
      ) : null}

      {/* La banda va DEBAJO del documento y no arriba: es lo que se lee después de mirar lo que
          salió, y arriba competiría con el entregable — que es a lo que se vino. Solo aparece con
          documento: sin él no hay nada terminado que desbloquee un paso siguiente. */}
      {documento && onSiguientePaso ? (
        <BandaDeMomento herramienta={herramienta} estado={estado} onIr={onSiguientePaso} />
      ) : null}

      {documento ? (
        <Documento
          titulo={herramienta.etiquetaSalida}
          texto={documento}
          versiones={versionesGuardadas}
          versionActiva={version}
          onElegirVersion={(i) => {
            setVersion(i);
            setReciente(null);
          }}
          cortado={reciente ? reciente.cortado : false}
          citas={reciente ? reciente.citas : []}
          meta={reciente}
          organizacion={organizacion}
          /* `sinAjuste` es el puerto de `hasEdit: false` del hub: hay herramientas que no
             ofrecen regenerar con un ajuste, y Prospección es una. `null` y no un botón
             deshabilitado — el `07` § 4 prohíbe mostrar un control que no puede cumplir. */
          onAjustar={puedeEditar && !herramienta.sinAjuste ? (nota) => generar(nota) : null}
          ajustando={generando}
        />
      ) : !generando ? (
        <div className="card">
          <div className="card-body empty">
            <div className="e-ic">◍</div>
            <div className="e-t">Todavía no generaste este documento</div>
            <div className="e-d">
              Llená lo que sepas y apretá el botón. Lo que no sepas se puede dejar vacío: sale
              marcado como pendiente, no inventado.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
