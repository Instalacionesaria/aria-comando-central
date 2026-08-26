'use client';

/* Una herramienta de formulario: seis de las siete.
   ==========================================================================
   Tu ficha, ICP, Categoría, Oferta, Tu precio y Mapa comparten forma: llenás campos,
   apretás un botón, sale un documento. La séptima (Research) tiene su propio panel,
   porque son cinco pasos encadenados y eso no es la misma interacción.

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

import { pedir } from '@/lib/http/cliente';
import { aValoresDeFormulario, camposDe } from '@/lib/fundaciones/campos';
import { faltantes, FUENTES_POR_HERRAMIENTA, fuentes } from '@/lib/fundaciones/herencia';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import Documento from './Documento';

export default function PanelHerramienta({
  herramienta,
  estado,
  puedeEditar,
  faltaPermiso,
  onIr,
  onEstadoCambiado,
  /* Las dos rutas de SU pantalla. Llegan por props y no están escritas acá porque el mismo
     panel sirve a ICP & Oferta y a Tools, que tienen capacidades distintas: una ruta escrita
     adentro haría que Tools guardara y generara con la capacidad de Fundaciones. */
  rutaEstado,
  rutaGenerar,
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
    if (respuesta.tipo === 'rechazado') return mensajeDeRechazo(respuesta.codigo, respuesta.estado);
    return SIN_RESPUESTA;
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    const r = await pedir(rutaEstado, {
      metodo: 'POST',
      cuerpo: { herramienta: herramienta.id, valores },
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

  const generar = async (ajuste) => {
    setError(null);
    setGenerando(true);
    const cuerpo = { herramienta: herramienta.id, valores };
    if (ajuste) {
      cuerpo.ajuste = ajuste;
      cuerpo.previa = documento;
    }
    const r = await pedir(rutaGenerar, { metodo: 'POST', cuerpo });
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
              <button type="button" className="fd-btn sec" disabled={guardando} onClick={guardar}>
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
        </div>
      </div>

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
          onAjustar={puedeEditar ? (nota) => generar(nota) : null}
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
