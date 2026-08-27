'use client';

/* El extractor de leads de Prospección: tres fuentes, cada una con su formulario.
   ==========================================================================
   Puerto de `ARIA-brain/app-next/components/ProspeccionScraper.tsx`.

   ── LAS VALIDACIONES DE ACÁ NO SON COSMÉTICAS ─────────────────────────────

   En el resto del proyecto, validar en el cliente es comodidad: el servidor valida igual y una
   petición mal formada se rechaza sin consecuencias. Acá no. Un scraping arrancado **gasta
   leads de un monedero con saldo real**, y el backend cobra la corrida aunque devuelva cero
   resultados.

   Por eso el mínimo de 72, las tres partes de la localización y el rango de LinkedIn se
   comprueban ANTES de llamar. El backend los valida también —es él quien decide—, pero para
   entonces ya se pagó.

   ── EL SONDEO ────────────────────────────────────────────────────────────

   Un scraping tarda minutos, así que arrancar y consultar son dos operaciones. El sondeo va cada
   cinco segundos, el número del hub. El temporizador se limpia al desmontar: sin eso, cambiar de
   pestaña deja una consulta corriendo contra un trabajo que ya nadie mira. */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ETIQUETAS_DE_COLUMNA,
  COLUMNAS_ENLACE,
  MINIMO_LEADS_MAPS,
  consultarTrabajo,
  iniciarScraping,
} from '@/lib/tools/scrapers';

/* Las cuatro fases de un trabajo. `error` incluye tanto los fallos del motor como las
   validaciones de acá: para quien mira, las dos son "esto no arrancó y acá está el motivo". */
function useTrabajo() {
  const [fase, setFase] = useState('quieto');
  const [mensaje, setMensaje] = useState('');
  const [leads, setLeads] = useState([]);
  const temporizador = useRef(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const sondear = useCallback((id) => {
    setFase('sondeando');
    setMensaje('Scrapeando leads… esto puede tomar unos minutos.');
    const tic = async () => {
      const d = await consultarTrabajo(id);
      if (!d) {
        setFase('error');
        setMensaje('No se pudo consultar el estado del scraping.');
        return;
      }
      if (d.status === 'COMPLETED') {
        const ls = (d.results && d.results.data) || [];
        setLeads(ls);
        setFase('listo');
        setMensaje(`Listo. ${ls.length} ${ls.length === 1 ? 'resultado' : 'resultados'} encontrados.`);
        return;
      }
      if (d.status === 'FAILED' || d.status === 'CANCELLED') {
        setFase('error');
        setMensaje(d.status === 'FAILED' ? 'El scraping falló. Intentá de nuevo.' : 'El scraping fue cancelado.');
        return;
      }
      temporizador.current = setTimeout(tic, 5000);
    };
    tic();
  }, []);

  const arrancar = useCallback(async (fuente, parametros) => {
    setFase('arrancando');
    setMensaje('');
    setLeads([]);
    const r = await iniciarScraping(fuente, parametros);
    if (r.tipo !== 'trabajo') {
      setFase('error');
      setMensaje(r.mensaje);
      return;
    }
    sondear(r.id);
  }, [sondear]);

  const ocupado = fase === 'arrancando' || fase === 'sondeando';
  return { fase, mensaje, leads, ocupado, arrancar, setFase, setMensaje };
}

function Aviso({ fase, mensaje }) {
  if (!mensaje || fase === 'quieto') return null;
  const clase = fase === 'listo' ? 'ok' : fase === 'error' ? 'err' : 'sondeando';
  return (
    <div className={`sc-aviso ${clase}`}>
      {(fase === 'sondeando' || fase === 'arrancando') ? <span className="sc-giro" aria-hidden="true" /> : null}
      <span>{mensaje}</span>
    </div>
  );
}

/* La tabla de resultados. Las columnas se DERIVAN de los datos y no de una lista fija: cada
   fuente devuelve campos distintos, y una lista fija mostraría columnas vacías para unas y
   escondería datos de otras. Se descartan las que vienen vacías en todas las filas. */
export function TablaDeLeads({ leads }) {
  if (!leads.length) return null;
  const columnas = Object.keys(leads[0] || {}).filter((k) =>
    leads.some((l) => l[k] !== null && l[k] !== undefined && l[k] !== ''),
  );

  const celda = (valor, clave) => {
    if (valor === null || valor === undefined || valor === '') return <span className="lead-vacio">—</span>;
    const texto = Array.isArray(valor) ? valor.join(', ') : String(valor);
    if (COLUMNAS_ENLACE.includes(clave)) {
      return (
        <a href={texto} target="_blank" rel="noopener noreferrer" className="lead-enlace">
          {texto.replace(/^https?:\/\//, '')}
        </a>
      );
    }
    if (clave === 'email' || clave === 'emails') return <span className="lead-email">{texto}</span>;
    return <span>{texto}</span>;
  };

  return (
    <div className="leads-bloque">
      <div className="leads-cabeza">Resultados ({leads.length})</div>
      <div className="leads-scroll">
        <table className="leads-tabla">
          <thead>
            <tr>
              <th className="lead-num">#</th>
              {columnas.map((c) => <th key={c}>{ETIQUETAS_DE_COLUMNA[c] || c}</th>)}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => (
              <tr key={i}>
                <td className="lead-num">{i + 1}</td>
                {columnas.map((c) => <td key={c}>{celda(lead[c], c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Google Maps ─────────────────────────────────────────────────────────────

function FormularioMaps({ nicho, onLeads }) {
  const t = useTrabajo();
  const [tipoDeNegocio, setTipoDeNegocio] = useState(nicho);
  const [localizacion, setLocalizacion] = useState('');
  const [maximo, setMaximo] = useState(MINIMO_LEADS_MAPS);

  useEffect(() => { onLeads(t.leads); }, [t.leads, onLeads]);

  const correr = () => {
    if (!tipoDeNegocio.trim() || !localizacion.trim()) {
      t.setFase('error'); t.setMensaje('Completá el tipo de negocio y la localización.');
      return;
    }
    /* Las tres partes de la localización son la validación que más plata ahorra: "Perú" a secas
       devuelve resultados de todo el país, se cobran los 72 leads igual, y ninguno sirve. */
    const partes = localizacion.split(',').map((x) => x.trim()).filter(Boolean);
    if (partes.length < 3) {
      t.setFase('error');
      t.setMensaje('La localización debe tener al menos 3 partes separadas por coma. Ej: "Cayma, Arequipa, Perú".');
      return;
    }
    if (maximo < MINIMO_LEADS_MAPS) {
      t.setFase('error'); t.setMensaje(`El mínimo a scrapear es ${MINIMO_LEADS_MAPS} leads.`);
      return;
    }
    t.arrancar('maps', {
      businessType: tipoDeNegocio.trim(),
      location: localizacion.trim(),
      maxLeads: maximo,
      getEmails: true,
    });
  };

  return (
    <div className="sc-form">
      <div className="sc-rejilla dos">
        <div className="fd-campo">
          <label htmlFor="sc-negocio">
            Tipo de negocio {nicho ? <span className="sc-heredado">↩ desde Nicho</span> : null}
          </label>
          <input id="sc-negocio" value={tipoDeNegocio} placeholder="Ej: Peluquería"
                 onChange={(e) => setTipoDeNegocio(e.target.value)} />
        </div>
        <div className="fd-campo">
          <label htmlFor="sc-loc">Localización</label>
          <input id="sc-loc" value={localizacion} placeholder="Ej: Cayma, Arequipa, Perú"
                 onChange={(e) => setLocalizacion(e.target.value)} />
          <p className="sc-pista">⚠ Mínimo 3 partes separadas por coma (distrito, ciudad, país). Evitá zonas demasiado amplias.</p>
        </div>
      </div>
      <div className="sc-rejilla">
        <div className="fd-campo" style={{ maxWidth: 240 }}>
          <label htmlFor="sc-max">Máx. leads a scrapear</label>
          <input id="sc-max" type="number" min={MINIMO_LEADS_MAPS} value={maximo}
                 onChange={(e) => setMaximo(Number(e.target.value))} />
          <p className="sc-subpista">Mínimo {MINIMO_LEADS_MAPS} leads</p>
        </div>
      </div>
      <Aviso fase={t.fase} mensaje={t.mensaje} />
      <button type="button" className="sc-btn" disabled={t.ocupado} onClick={correr}>
        {t.ocupado ? 'Scrapeando…' : '🚀 Iniciar Scraping'}
      </button>
    </div>
  );
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

function FormularioLinkedIn({ nicho, onLeads }) {
  const t = useTrabajo();
  const [cargo, setCargo] = useState(nicho);
  const [pais, setPais] = useState('');
  const [region, setRegion] = useState('');
  const [cantidad, setCantidad] = useState(100);

  useEffect(() => { onLeads(t.leads); }, [t.leads, onLeads]);

  const correr = () => {
    if (!cargo.trim() || !pais.trim()) {
      t.setFase('error'); t.setMensaje('El cargo y el país son obligatorios.');
      return;
    }
    if (cantidad < 100 || cantidad > 30000) {
      t.setFase('error'); t.setMensaje('La cantidad de leads debe estar entre 100 y 30000.');
      return;
    }
    t.arrancar('linkedin', {
      jobTitle: cargo.trim(),
      country: pais.trim(),
      state: region.trim(),
      numberOfLeads: cantidad,
    });
  };

  return (
    <div className="sc-form">
      <div className="sc-rejilla dos">
        <div className="fd-campo">
          <label htmlFor="sc-cargo">
            Cargo / Job title {nicho ? <span className="sc-heredado">↩ desde Nicho</span> : null}
          </label>
          <input id="sc-cargo" value={cargo} placeholder="Ej: Real Estate Agent, CEO, Marketing Manager"
                 onChange={(e) => setCargo(e.target.value)} />
        </div>
        <div className="fd-campo">
          <label htmlFor="sc-pais">País</label>
          <input id="sc-pais" value={pais} placeholder="Ej: United States, Peru, Mexico"
                 onChange={(e) => setPais(e.target.value)} />
          <p className="sc-pista">⚠ Es preferible el nombre del país en inglés para evitar errores.</p>
        </div>
        <div className="fd-campo">
          <label htmlFor="sc-region">Estado / Región (opcional)</label>
          <input id="sc-region" value={region} placeholder="Ej: California, Lima, Madre de Dios"
                 onChange={(e) => setRegion(e.target.value)} />
        </div>
        <div className="fd-campo">
          <label htmlFor="sc-cant">Cantidad de leads (100 – 30000)</label>
          <input id="sc-cant" type="number" min={100} max={30000} step={100} value={cantidad}
                 onChange={(e) => setCantidad(Number(e.target.value))} />
        </div>
      </div>
      <Aviso fase={t.fase} mensaje={t.mensaje} />
      <button type="button" className="sc-btn" disabled={t.ocupado} onClick={correr}>
        {t.ocupado ? 'Scrapeando…' : '💼 Extraer leads de LinkedIn'}
      </button>
    </div>
  );
}

// ── Facebook: dos pasos encadenados ─────────────────────────────────────────

function FormularioFacebook({ onLeads }) {
  /* DOS trabajos y no uno, porque son dos corridas del backend: la biblioteca de anuncios
     descubre quién anuncia, y recién el segundo paso saca sus datos de contacto. Cada uno se
     cobra por separado, así que el segundo se deshabilita hasta que el primero devolvió páginas
     — arrancarlo en vacío gastaría una corrida para procesar cero. */
  const anuncios = useTrabajo();
  const paginas = useTrabajo();
  const [url, setUrl] = useState('');

  const vigentes = paginas.leads.length > 0 ? paginas.leads : anuncios.leads;
  useEffect(() => { onLeads(vigentes); }, [vigentes, onLeads]);

  const correrAnuncios = () => {
    if (!url.trim()) {
      anuncios.setFase('error'); anuncios.setMensaje('Ingresá la URL de la biblioteca de anuncios de Facebook.');
      return;
    }
    anuncios.arrancar('facebook-ads', { url: url.trim() });
  };

  const correrPaginas = () => {
    if (anuncios.leads.length === 0) {
      paginas.setFase('error'); paginas.setMensaje('Primero completá el scraping de la biblioteca de anuncios.');
      return;
    }
    paginas.arrancar('facebook-pages', {
      pages: anuncios.leads.map((a) => ({
        page_name: a.page_name || '',
        page_profile_uri: a.page_profile_uri || '',
        page_id: a.page_id || '',
      })),
    });
  };

  return (
    <div className="sc-form">
      <div className="sc-pasos">
        <div className="sc-paso">
          <div className="sc-paso-titulo">1 · Biblioteca de anuncios</div>
          <div className="fd-campo">
            <label htmlFor="sc-fb">URL de la biblioteca de anuncios de Facebook</label>
            <input id="sc-fb" value={url} placeholder="https://www.facebook.com/ads/library/..."
                   onChange={(e) => setUrl(e.target.value)} />
          </div>
          <Aviso fase={anuncios.fase} mensaje={anuncios.mensaje} />
          <button type="button" className="sc-btn sec" disabled={anuncios.ocupado} onClick={correrAnuncios}>
            {anuncios.ocupado ? 'Scrapeando…' : '🔍 Buscar anunciantes'}
          </button>
        </div>

        <div className="sc-paso">
          <div className="sc-paso-titulo">2 · Sacar contactos</div>
          <div className={`sc-puente${anuncios.leads.length ? ' listo' : ''}`}>
            {anuncios.leads.length > 0
              ? `${anuncios.leads.length} páginas listas para obtener sus datos de contacto.`
              : 'Primero buscá anunciantes en el paso 1 para obtener las páginas a procesar.'}
          </div>
          <Aviso fase={paginas.fase} mensaje={paginas.mensaje} />
          <button type="button" className="sc-btn"
                  disabled={paginas.ocupado || anuncios.leads.length === 0} onClick={correrPaginas}>
            {paginas.ocupado ? 'Scrapeando…' : '📘 Extraer contactos'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PESTANIAS = [
  { clave: 'maps', etiqueta: 'Google Maps', emoji: '🗺️' },
  { clave: 'facebook', etiqueta: 'Facebook', emoji: '📘' },
  { clave: 'linkedin', etiqueta: 'LinkedIn', emoji: '💼' },
];

export default function Scraper({ nicho, onLeads }) {
  const [pestania, setPestania] = useState('maps');
  return (
    <div className="pr-tarjeta">
      <div className="pr-tarjeta-titulo">🎯 Extraer Leads</div>
      <div className="sc-pestanias" role="tablist">
        {PESTANIAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestania === p.clave}
            className={`sc-pestania${pestania === p.clave ? ' on' : ''}`}
            onClick={() => setPestania(p.clave)}
          >
            <span className="sc-emoji">{p.emoji}</span> {p.etiqueta}
          </button>
        ))}
      </div>
      {/* `key` por pestaña: cambiar de fuente TIRA el formulario y su trabajo. Sin eso, un sondeo
          de Maps seguiría corriendo mientras se llena el de LinkedIn, y sus resultados
          aparecerían debajo del formulario equivocado. */}
      {pestania === 'maps' ? <FormularioMaps key="maps" nicho={nicho} onLeads={onLeads} /> : null}
      {pestania === 'linkedin' ? <FormularioLinkedIn key="linkedin" nicho={nicho} onLeads={onLeads} /> : null}
      {pestania === 'facebook' ? <FormularioFacebook key="facebook" onLeads={onLeads} /> : null}
    </div>
  );
}
