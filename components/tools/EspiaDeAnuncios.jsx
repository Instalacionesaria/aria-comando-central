'use client';

/* Espía de Anuncios: la Meta Ad Library de la competencia, por nicho, marca o página.
   ==========================================================================
   Puerto de `ARIA-brain/app-next/components/AdSpyPanel.tsx`.

   ── QUÉ ES Y QUÉ NO ES ────────────────────────────────────────────────────

   Es la quinta fuente del motor de scraping, y la única que **no gasta saldo de leads**: el backend
   lo dice con todas las letras —*"es investigación de competencia, no generación de leads"*—, abre
   el monedero de la organización para provisionarla y no valida saldo. Sí lanza una corrida de
   Apify, que se cobra en la factura y queda contada en el Panel de Monitoreo como cualquier otro
   scrapeo.

   Y sus resultados **no son leads**: son anuncios y viven en el trabajo, no en `Mis Leads`.

   ── LOS DOS GASTOS ESTÁN SUELTOS, A PROPÓSITO ─────────────────────────────

   Espiar cuesta una corrida de Apify; extraer los patrones cuesta tokens de la llave de IA de la
   organización. Son dos botones y dos rutas: se puede espiar veinte veces y analizar una, o volver
   a analizar sin volver a espiar. Encadenarlos habría hecho que cada búsqueda pagara las dos cosas
   sin que nadie lo pidiera. Es la misma separación que Prospección hace entre el scraper y el plan.

   ── EL SONDEO SE RETOMA, Y ESO YA SE PAGÓ UNA VEZ ─────────────────────────

   Una búsqueda tarda minutos y en esos minutos uno se va a otra pestaña. Si el identificador del
   trabajo viviera sólo en `useState`, desmontar este componente dejaría la corrida andando en Apify
   sin nadie mirándola — el síntoma que Kevin reportó para el scraper: *"si yo me muevo a otra
   pestaña se pierde el avance"*. No se perdía la corrida: se perdía la referencia para preguntar
   por ella. Al montar se le pregunta a la BASE qué hay en vuelo de esta fuente y se retoma. */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PREFIJO_DE_BUSQUEDA,
  analizarAnuncios,
  consultarTrabajo,
  espiarAnuncios,
  leerAnalisisDelEspia,
  leerBusquedasDelEspia,
  leerTrabajosEnVuelo,
} from '@/lib/tools/scrapers';

import { BuscadorDeAnuncios, TarjetaDeAnuncio } from './anuncios';

/** Cada cuánto se le pregunta al motor si ya terminó. Cinco segundos, el número del hub. */
const CADA_MS = 5000;

/** Cuántas búsquedas anteriores se ven sin desplegar la lista. */
const A_LA_VISTA = 3;

const NOMBRE_DE_PAIS = { ALL: 'Todos los países' };

const cuando = (iso) =>
  new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function EspiaDeAnuncios({ puedeEditar }) {
  const [consulta, setConsulta] = useState('');
  const [pais, setPais] = useState('ALL');
  const [fase, setFase] = useState('quieto');
  const [mensaje, setMensaje] = useState('');
  const [anuncios, setAnuncios] = useState([]);
  const [trabajo, setTrabajo] = useState(null);

  const [analizando, setAnalizando] = useState(false);
  const [analisis, setAnalisis] = useState('');
  const [errorDelAnalisis, setErrorDelAnalisis] = useState('');

  /* ── EL HISTORIAL ────────────────────────────────────────────────────────
     Jorge, 2026-10-03: después de espiar cambiaba de pestaña y los resultados desaparecían. Estaban
     guardados en el trabajo del scraper, pero la pantalla sólo retomaba lo que seguía corriendo. Ahora
     lista las búsquedas, abre la última al volver, y cada una trae su análisis guardado. `null` es
     «no se pudo leer», distinto de una lista vacía. */
  const [busquedas, setBusquedas] = useState([]);
  const [verTodas, setVerTodas] = useState(false);

  const cargarHistorial = useCallback(async () => {
    const lista = await leerBusquedasDelEspia();
    setBusquedas(lista);
    return lista;
  }, []);
  /* El sondeo vive en un `useCallback` sin dependencias; para que al terminar refresque la lista sin
     volver a crearse, la llama por una referencia. */
  const alTerminar = useRef(null);
  alTerminar.current = cargarHistorial;

  const temporizador = useRef(null);
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const sondear = useCallback((id) => {
    setTrabajo(id);
    setFase('sondeando');
    setMensaje('Espiando anuncios… esto puede tomar unos minutos.');
    const tic = async () => {
      const d = await consultarTrabajo(id);
      if (!d) {
        setFase('error');
        setMensaje('No se pudo consultar el estado de la búsqueda.');
        return;
      }
      if (d.status === 'COMPLETED') {
        const lista = (d.results && d.results.data) || [];
        setAnuncios(lista);
        setFase('listo');
        setMensaje(
          `Listo. ${lista.length} ${lista.length === 1 ? 'anuncio encontrado' : 'anuncios encontrados'}.`,
        );
        alTerminar.current?.();
        return;
      }
      if (d.status === 'FAILED' || d.status === 'CANCELLED') {
        setFase('error');
        setMensaje(
          d.status === 'FAILED' ? 'La búsqueda falló. Intentá de nuevo.' : 'La búsqueda fue cancelada.',
        );
        return;
      }
      temporizador.current = setTimeout(tic, CADA_MS);
    };
    tic();
  }, []);

  /* Retomar lo que ya estaba corriendo. Se filtra por fuente: un scraping de Maps en vuelo no tiene
     por qué aparecer acá — mostraría un progreso que no es el suyo y un resultado que no se pidió.
     `vivo` evita fijar estado si la pestaña se cerró mientras la consulta viajaba. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const enVuelo = await leerTrabajosEnVuelo();
      if (!vivo) return;
      const mio = enVuelo.find((t) => t.fuente === 'ad-spy');
      const historial = await alTerminar.current?.();
      if (!vivo) return;
      if (!mio) {
        // Nada corriendo: se abre la última búsqueda que terminó con anuncios, con su análisis.
        const ultima = (historial ?? []).find((b) => b.status === 'COMPLETED' && (b.anuncios ?? 0) > 0);
        if (ultima) abrirRef.current?.(ultima);
        return;
      }
      // El backend guarda la búsqueda como `AdSpy: <lo que se buscó>`, así que se puede recuperar.
      const buscado = (mio.business_type || '').startsWith(PREFIJO_DE_BUSQUEDA)
        ? mio.business_type.slice(PREFIJO_DE_BUSQUEDA.length)
        : '';
      if (buscado) setConsulta(buscado);
      if (mio.location) setPais(mio.location);
      sondear(mio.id);
    })();
    return () => { vivo = false; };
  }, [sondear]);

  const ocupado = fase === 'arrancando' || fase === 'sondeando';

  /* Reabrir una búsqueda: los anuncios por el mismo sondeo (si ya terminó, vuelve en la primera
     consulta, sin pagar Apify otra vez) y el análisis guardado, si lo hay. */
  const abrir = useCallback(
    async (b) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      setConsulta(b.consulta);
      setPais(b.pais || 'ALL');
      setAnuncios([]);
      setAnalisis('');
      setErrorDelAnalisis('');
      sondear(b.id);
      if (b.tieneAnalisis) {
        const guardado = await leerAnalisisDelEspia(b.id);
        if (guardado) setAnalisis(guardado.texto);
      }
    },
    [sondear],
  );
  const abrirRef = useRef(null);
  abrirRef.current = abrir;

  const espiar = async () => {
    const texto = consulta.trim();
    if (!texto) {
      setFase('error');
      setMensaje('Escribí un nicho, marca o página a espiar.');
      return;
    }
    setFase('arrancando');
    setMensaje('');
    setAnuncios([]);
    setTrabajo(null);
    setAnalisis('');
    setErrorDelAnalisis('');

    const r = await espiarAnuncios(texto, pais || 'ALL');
    if (r.tipo !== 'trabajo') {
      setFase('error');
      setMensaje(r.mensaje);
      return;
    }
    sondear(r.id);
    cargarHistorial();
  };

  const analizar = async () => {
    if (!trabajo) return;
    setAnalizando(true);
    setErrorDelAnalisis('');
    setAnalisis('');
    const r = await analizarAnuncios(trabajo);
    setAnalizando(false);
    if (r.tipo === 'datos') {
      setAnalisis(r.texto);
      // Quedó guardado del lado del servidor: la lista lo marca sin volver a pedirla.
      setBusquedas((xs) => (xs ? xs.map((b) => (b.id === trabajo ? { ...b, tieneAnalisis: true } : b)) : xs));
    } else setErrorDelAnalisis(r.mensaje);
  };

  return (
    <div className="cl-page">
      <div className="fd-cab">
        <h3>Espía a tus competidores</h3>
        <span className="fd-bajada">
          Espiá la Meta Ad Library de tu competencia por nicho, marca o página. Detectá qué hooks,
          ofertas y ángulos llevan más tiempo corriendo — señal de que convierten — y extraé los
          patrones con IA.
        </span>
      </div>

      <div className="card">
        <div className="card-body">
          {puedeEditar ? (
            <BuscadorDeAnuncios
              consulta={consulta}
              onConsulta={setConsulta}
              pais={pais}
              onPais={setPais}
              onBuscar={espiar}
              ocupado={ocupado}
              etiqueta="Espiar"
            />
          ) : null}

          {!puedeEditar ? (
            <div className="fd-aviso">
              <i>◍</i>
              <span>
                Tu rol puede <b>ver</b> esta pantalla pero no lanzar búsquedas.
              </span>
            </div>
          ) : null}

          {mensaje && fase !== 'quieto' ? (
            <div
              className={`sc-aviso ${fase === 'listo' ? 'ok' : fase === 'error' ? 'err' : 'sondeando'}`}
            >
              {ocupado ? <span className="sc-giro" aria-hidden="true" /> : null}
              <span>{mensaje}</span>
            </div>
          ) : null}
        </div>
      </div>

      {busquedas === null ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>No se pudieron leer tus búsquedas anteriores. No es que no tengas: no se pudo mirar.</span>
        </div>
      ) : null}

      {busquedas && busquedas.length > 0 ? (
        <div className="card es-historial">
          <div className="card-head">
            <span>Búsquedas anteriores</span>
            {busquedas.length > A_LA_VISTA ? (
              <button type="button" className="fd-btn-menor" onClick={() => setVerTodas((v) => !v)}>
                {verTodas ? 'Ver menos' : `Ver todas (${busquedas.length})`}
              </button>
            ) : null}
          </div>
          <div className="es-historial-lista">
            {(verTodas ? busquedas : busquedas.slice(0, A_LA_VISTA)).map((b) => {
              const actual = b.id === trabajo;
              return (
                <button
                  type="button"
                  key={b.id}
                  className={`es-busqueda${actual ? ' actual' : ''}`}
                  disabled={actual || ocupado}
                  onClick={() => abrir(b)}
                  aria-current={actual ? 'true' : undefined}
                >
                  <span className="es-busqueda-punto" aria-hidden="true">{actual ? '●' : '○'}</span>
                  <b>{b.consulta || 'Sin texto'}</b>
                  <span className="es-busqueda-dato">
                    {NOMBRE_DE_PAIS[b.pais] ?? b.pais}
                    {' · '}
                    {b.status === 'COMPLETED'
                      ? `${b.anuncios ?? 0} ${b.anuncios === 1 ? 'anuncio' : 'anuncios'}`
                      : b.status === 'FAILED' || b.status === 'CANCELLED'
                        ? 'falló'
                        : 'en curso'}
                    {b.tieneAnalisis ? ' · con análisis' : ''}
                    {' · '}
                    {cuando(b.creadoEl)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {anuncios.length > 0 ? (
        <>
          <div className="es-herramientas">
            <span className="es-cuenta">
              {anuncios.length} {anuncios.length === 1 ? 'anuncio' : 'anuncios'} · ordenados por
              longevidad
            </span>
            {puedeEditar ? (
              <button
                type="button"
                className="fd-btn sec"
                disabled={analizando || !trabajo}
                onClick={analizar}
              >
                {analizando ? 'Analizando…' : 'Extraer hooks y ángulos con IA'}
              </button>
            ) : null}
          </div>

          {errorDelAnalisis ? (
            <div className="fd-aviso mal">
              <i>◍</i>
              <span>{errorDelAnalisis}</span>
            </div>
          ) : null}

          {analizando ? (
            <div className="fd-cargando">
              <span className="fd-punto" />
              Leyendo los anuncios y buscando los patrones que se repiten.
            </div>
          ) : null}

          {analisis ? (
            <div className="card es-analisis">
              <div className="card-head">
                <span>Patrones detectados</span>
              </div>
              {/* El texto viene en markdown y se muestra tal cual, con los saltos de línea
                  conservados. No se pasa por el visor de documentos de Fundaciones a propósito: ése
                  trae versiones, descargas y regeneración con ajuste, que acá no existen — un
                  análisis no es un entregable del método. */}
              <div className="card-body es-analisis-cuerpo">{analisis}</div>
            </div>
          ) : null}

          <div className="es-rejilla">
            {anuncios.map((a, i) => (
              <TarjetaDeAnuncio key={a.ad_archive_id || i} anuncio={a} />
            ))}
          </div>
        </>
      ) : null}

      {/* El pie explicativo: dice para qué sirve la pantalla cuando todavía no hay resultados, que es
          la primera vez que alguien la abre. Las dos primeras notas son el diseño de Jorge; las dos
          últimas, «Próximamente», toman el nombre y el texto del diseño de la segunda edición
          (`NE-51`) y no se maquillan — prometer una función que no existe es peor que decir que falta. */}
      <div className="es-rasgos">
        <div className="es-rasgo">
          <h4>Ordena por longevidad</h4>
          <p>
            Los anuncios que llevan más tiempo corriendo son los que convierten. Los detectamos al
            instante.
          </p>
        </div>
        <div className="es-rasgo">
          <h4>Extrae hooks y ángulos con IA</h4>
          <p>
            La IA analiza los anuncios y resume los ganchos, ofertas y estructuras que se repiten en
            tu nicho.
          </p>
        </div>
        <div className="es-rasgo">
          <h4>Enviar hallazgos a Copywriter</h4>
          <p>Próximamente: los hooks que encontraste pasan directo a tus guiones.</p>
        </div>
        <div className="es-rasgo">
          <h4>Dream 100</h4>
          <p>Próximamente: guarda las cuentas que quieres seguir de cerca.</p>
        </div>
      </div>
    </div>
  );
}
