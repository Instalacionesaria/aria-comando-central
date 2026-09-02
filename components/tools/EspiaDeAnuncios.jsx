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
  PAISES,
  PREFIJO_DE_BUSQUEDA,
  TIPO_DE_ANUNCIO,
  analizarAnuncios,
  consultarTrabajo,
  espiarAnuncios,
  leerTrabajosEnVuelo,
} from '@/lib/tools/scrapers';

/** Cada cuánto se le pregunta al motor si ya terminó. Cinco segundos, el número del hub. */
const CADA_MS = 5000;

function Anuncio({ anuncio }) {
  const [imagenOk, setImagenOk] = useState(true);
  const dias = anuncio.days_active ?? 0;
  const copy = anuncio.body_text || anuncio.title || '';

  return (
    <div className="es-tarjeta">
      <div className="es-media">
        {anuncio.thumbnail_url && imagenOk ? (
          /* eslint-disable-next-line @next/next/no-img-element -- la miniatura la sirve el CDN de
             Meta con una URL firmada y de vida corta: `next/image` la optimizaría contra un dominio
             que no podemos declarar de antemano y que además cambia. */
          <img src={anuncio.thumbnail_url} alt="" onError={() => setImagenOk(false)} />
        ) : (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke="currentColor" strokeWidth="1.5" d="M4 5h16v14H4zM4 9h16M9 5v4" />
          </svg>
        )}
      </div>
      <div className="es-cuerpo">
        <div className="es-meta">
          {/* La longevidad es LA señal de esta herramienta: un anuncio que lleva meses corriendo es
              uno que le está funcionando a alguien. Por eso va primero y resaltada. */}
          <span className={`es-pastilla${anuncio.is_active ? ' vivo' : ''}`}>
            Activo {dias} día{dias === 1 ? '' : 's'}
          </span>
          <span className="es-pastilla">
            {TIPO_DE_ANUNCIO[anuncio.media_type || ''] || 'Anuncio'}
          </span>
        </div>
        {anuncio.page_name ? <div className="es-pagina">{anuncio.page_name}</div> : null}
        {copy ? <div className="es-copy">{copy}</div> : null}
        {anuncio.ad_library_url ? (
          <a
            className="es-enlace"
            href={anuncio.ad_library_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en Ad Library ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

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
      if (!mio) return;
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
  };

  const analizar = async () => {
    if (!trabajo) return;
    setAnalizando(true);
    setErrorDelAnalisis('');
    setAnalisis('');
    const r = await analizarAnuncios(trabajo);
    setAnalizando(false);
    if (r.tipo === 'datos') setAnalisis(r.texto);
    else setErrorDelAnalisis(r.mensaje);
  };

  return (
    <div className="cl-page">
      <div className="fd-cab">
        <h3>Espía de Anuncios</h3>
        <span className="fd-bajada">
          Espiá la Meta Ad Library de tu competencia por nicho, marca o página. Detectá qué hooks,
          ofertas y ángulos llevan más tiempo corriendo — señal de que convierten — y extraé los
          patrones con IA.
        </span>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="es-barra">
            <select
              className="es-select"
              value="meta"
              onChange={() => {}}
              aria-label="Dónde espiar"
            >
              <option value="meta">Meta Ad Library</option>
              {/* Deshabilitada y a la vista, como en el hub: dice qué falta sin prometer que anda. */}
              <option value="tiktok" disabled>
                TikTok Creative Center (pronto)
              </option>
            </select>
            <select
              className="es-select"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              aria-label="País donde espiar los anuncios"
            >
              {PAISES.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
            <input
              className="es-consulta"
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !ocupado && puedeEditar) espiar();
              }}
              placeholder="Buscá por nicho, marca o página… (ej: agencias de marketing IA)"
            />
            {puedeEditar ? (
              <button type="button" className="fd-btn" disabled={ocupado} onClick={espiar}>
                {ocupado ? 'Espiando…' : 'Espiar'}
              </button>
            ) : null}
          </div>

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
              <Anuncio key={a.ad_archive_id || i} anuncio={a} />
            ))}
          </div>
        </>
      ) : null}

      {/* El pie explicativo. Es el diseño de Jorge y se conserva: dice para qué sirve la pantalla
          cuando todavía no hay resultados, que es la primera vez que alguien la abre. Las dos
          últimas dicen «próximamente» y no se maquillan — prometer una función que no existe es
          peor que decir que falta. */}
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
          <h4>Alimenta tus Creadores de Ads</h4>
          <p>
            Próximamente: envía los patrones detectados directo a Ads Fríos y Remarketing como
            contexto heredado.
          </p>
        </div>
        <div className="es-rasgo">
          <h4>Guarda tu Dream 100</h4>
          <p>
            Próximamente: sigue a los competidores clave de tu nicho y revisa qué campañas nuevas
            lanzan.
          </p>
        </div>
      </div>
    </div>
  );
}
