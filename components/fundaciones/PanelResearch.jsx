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

   ── UNA PETICIÓN POR PASO, NO UNA POR LOS CINCO ───────────────────────────

   Son cinco llamadas al modelo con búsqueda web. Encadenarlas en una sola petición
   HTTP significa que un fallo en el paso 4 tira también los tres que ya salieron
   bien. Así, el botón "ejecutar todo" recorre los cinco de a uno y cada uno que sale
   queda guardado. */

import { useMemo, useState } from 'react';

import { pedir } from '@/lib/http/cliente';
import { aValoresDeFormulario, camposDe } from '@/lib/fundaciones/campos';
import { PASOS_RESEARCH } from '@/lib/fundaciones/herramientas';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

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
  faltaPermiso,
  onEstadoCambiado,
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
  const guardar = async () => {
    setErrorAlGuardar(null);
    setGuardando(true);
    const r = await pedir('/api/fundaciones/estado', {
      metodo: 'POST',
      cuerpo: { herramienta: 1, valores },
    });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setErrorAlGuardar(
        r.tipo === 'rechazado' ? mensajeDeRechazo(r.codigo, r.estado) : SIN_RESPUESTA,
      );
      return;
    }
    setGuardado(true);
    onEstadoCambiado();
  };

  /** Corre UN paso. Devuelve si salió bien, para que el recorrido de los cinco pueda cortar. */
  const correrPaso = async (paso) => {
    setCorriendo(paso);
    setError((previo) => ({ ...previo, [paso]: null }));

    const r = await pedir('/api/fundaciones/generar', {
      metodo: 'POST',
      cuerpo: { herramienta: 1, valores, paso },
    });

    if (r.tipo !== 'datos') {
      const mal =
        r.tipo === 'rechazado' ? mensajeDeRechazo(r.codigo, r.estado) : SIN_RESPUESTA;
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
  const correrTodo = async () => {
    for (let paso = 0; paso < PASOS_RESEARCH; paso += 1) {
      const bien = await correrPaso(paso);
      if (!bien) return;
    }
  };

  const faltaNicho = !valores['mr-niche'] || valores['mr-niche'].trim() === '';
  const faltaExperiencia = !valores['mr-experience'] || valores['mr-experience'].trim() === '';

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

          {/* El nicho y el trasfondo no son opcionales, y se dice ANTES de gastar cinco
              generaciones: el paso 1 busca dentro del nicho y el paso 5 elige el segmento
              contra la experiencia real de quien va a venderlo. Sin ellos, los cinco pasos
              salen genéricos y el alumno no tiene forma de saber por qué. */}
          {faltaNicho || faltaExperiencia ? (
            <div className="fd-aviso falta">
              <i>◍</i>
              <span>
                Falta {faltaNicho ? <b>tu nicho</b> : null}
                {faltaNicho && faltaExperiencia ? ' y ' : null}
                {faltaExperiencia ? <b>tu experiencia</b> : null}. Sin eso el research sale
                genérico: el paso 1 busca dentro del nicho y el paso 5 elige el segmento contra
                tu trasfondo.
              </span>
            </div>
          ) : null}

          {puedeEditar ? (
            <div className="fd-acciones">
              <button
                type="button"
                className="fd-btn"
                disabled={corriendo !== null || faltaNicho || faltaExperiencia}
                onClick={correrTodo}
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
                onClick={guardar}
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

          {corriendo !== null ? (
            <div className="fd-cargando">
              <span className="fd-punto" />
              Paso {corriendo + 1}: {TITULOS[corriendo]}. Busca en la web, así que tarda.
            </div>
          ) : null}
        </div>
      </div>

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
