'use client';

/* El extractor de leads de Prospección y de la pestaña Scraper: tres fuentes, cada una con su formulario.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ETIQUETAS_DE_COLUMNA,
  COLUMNAS_ENLACE,
  MINIMO_LEADS_MAPS,
  PREFIJO_DE_BUSQUEDA,
  PREFIJO_LINKEDIN,
  anunciantesDe,
  consultarTrabajo,
  iniciarScraping,
  leerBusquedasDelEspia,
  leerTrabajosEnVuelo,
} from '@/lib/tools/scrapers';
import { irALaVista } from '@/lib/aios/shell.js';
import { alPedirScraper, hayPedido, tomarPedido } from '@/lib/tools/del-espia-al-scraper';

import { TarjetaDeAnuncio } from './anuncios';

/**
 * Cuántas tarjetas de anuncio se dibujan bajo la pestaña Facebook.
 *
 * La búsqueda de prospección pide mil anuncios —ver `ANUNCIOS_PARA_PROSPECTAR`— y mil tarjetas con
 * su miniatura es una pantalla que no termina de cargar nunca. Acá las tarjetas son para RECONOCER
 * a quién se está por procesar, no para leer el nicho entero: para eso está el Espía de Tools, que
 * trae sesenta y las muestra todas.
 *
 * Los anunciantes de la lista de arriba NO se recortan: ésos son la decisión, y esconder uno sería
 * esconder a quién se le va a sacar el contacto.
 */
const TARJETAS_A_LA_VISTA = 60;

/**
 * La lista vacía, UNA sola para todo el módulo.
 *
 * No es una micro-optimización: es lo que impide que un `[]` escrito dentro del render entre como
 * dependencia de un efecto que fija estado. Ver la nota de `vigentes` — ese literal tiró la pantalla
 * entera, y sin dejar rastro en ningún registro.
 */
const SIN_LEADS = [];

/* Las cuatro fases de un trabajo. `error` incluye tanto los fallos del motor como las
   validaciones de acá: para quien mira, las dos son "esto no arrancó y acá está el motivo". */
function useTrabajo(fuente, textos = {}) {
  const [fase, setFase] = useState('quieto');
  const [mensaje, setMensaje] = useState('');
  const [leads, setLeads] = useState([]);
  const temporizador = useRef(null);

  /* Los dos textos que cambian según qué se está trayendo. El Espía no está «scrapeando leads»:
     está buscando anuncios, y de ahí no sale un lead sino un anunciante. Decirlo mal es decirle a
     alguien que ya gastó saldo cuando esa corrida no cobra ninguno. */
  const trabajando = textos.trabajando ?? 'Scrapeando leads… esto puede tomar unos minutos.';
  const contar = textos.contar ?? ((n) => `Listo. ${n} ${n === 1 ? 'resultado' : 'resultados'} encontrados.`);
  /* Qué hacer con el trabajo que se retomó. Lo usa cada formulario para volver a llenar SUS campos
     con lo que la base dice que se estaba buscando: el hook no sabe qué campos tiene cada fuente, y
     escribirlo acá sería un `switch` por fuente en el único lugar que hoy no lo necesita. */
  const alRetomar = textos.alRetomar;

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const sondear = useCallback((id) => {
    setFase('sondeando');
    setMensaje(trabajando);
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
        setMensaje(contar(ls.length));
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
    // `trabajando` y `contar` se leen al vuelo y no se listan: son literales del render, así que
    // listarlas rearmaría el sondeo en cada dibujo y el reloj se reiniciaría solo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── RETOMAR UN TRABAJO QUE YA ESTABA CORRIENDO ──────────────────────────
     Esto es lo que arregla «me muevo a otra pestaña y se pierde el avance». El sondeo vivía en
     este componente, así que desmontarlo —cambiar a Mis Leads, al VSL— mataba el reloj y el
     trabajo seguía corriendo en Apify sin nadie mirándolo. No se perdía el scraping: se perdía
     la referencia para preguntar por él.

     Al montar se le pregunta a la BASE qué hay en vuelo para esta fuente y se retoma. Corre una
     sola vez, no en cada render, y `vivo` evita fijar estado si la pestaña se cerró mientras la
     consulta viajaba.

     Se filtra POR FUENTE: si hay un scraping de Maps corriendo, la pestaña de LinkedIn no tiene
     por qué mostrarlo — mostraría un progreso que no es el suyo y un resultado que no pidió. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const enVuelo = await leerTrabajosEnVuelo();
      if (!vivo) return;
      const mio = enVuelo.find((t) => t.fuente === fuente);
      if (!mio) return;
      // Primero los campos y después el sondeo: así el formulario ya se ve completo cuando aparece
      // el aviso de «scrapeando», y no un instante después.
      if (alRetomar) alRetomar(mio);
      sondear(mio.id);
    })();
    return () => { vivo = false; };
    // `alRetomar` no se lista por lo mismo que los textos: se redefine en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, sondear]);

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
  /* `seguir` abre un trabajo que ya existe —una búsqueda del Espía terminada vuelve en la primera
     consulta, sin pagar Apify otra vez—. Lo usa el Scraper de Facebook para elegir una búsqueda. */
  return { fase, mensaje, leads, ocupado, arrancar, seguir: sondear, setFase, setMensaje };
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
  const [tipoDeNegocio, setTipoDeNegocio] = useState(nicho);
  const [localizacion, setLocalizacion] = useState('');
  const [maximo, setMaximo] = useState(MINIMO_LEADS_MAPS);

  /* Al volver a la pestaña con un scraping en vuelo, los campos se reponen con lo que la base dice
     que se estaba buscando. Maps los guarda tal cual: `business_type` y `location` son lo que se
     escribió, y el tope viaja aparte porque el backend lo mete dentro de `results_data`. */
  const t = useTrabajo('maps', {
    alRetomar: (trabajo) => {
      if (trabajo.business_type) setTipoDeNegocio(trabajo.business_type);
      if (trabajo.location) setLocalizacion(trabajo.location);
      if (trabajo.max_leads) setMaximo(trabajo.max_leads);
    },
  });

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
  const [cargo, setCargo] = useState(nicho);
  const [pais, setPais] = useState('');
  const [region, setRegion] = useState('');
  const [cantidad, setCantidad] = useState(100);

  /* LinkedIn guarda el cargo con el prefijo `LinkedIn: ` y junta región y país en una sola cadena
     —`f"{state}, {country}"`— así que reponerlos es deshacer eso. La cantidad NO se puede reponer:
     el backend no la guarda en ningún lado, ni en columna ni en el JSON. Queda en su valor por
     omisión, y eso es mejor que inventarlo: el número afecta lo que se cobra. */
  const t = useTrabajo('linkedin', {
    alRetomar: (trabajo) => {
      const titulo = trabajo.business_type ?? '';
      if (titulo) setCargo(titulo.startsWith(PREFIJO_LINKEDIN) ? titulo.slice(PREFIJO_LINKEDIN.length) : titulo);
      const donde = trabajo.location ?? '';
      if (donde) {
        const coma = donde.indexOf(',');
        // Con coma es `región, país`; sin coma, el país solo. Es el formato que arma el backend.
        if (coma >= 0) {
          setRegion(donde.slice(0, coma).trim());
          setPais(donde.slice(coma + 1).trim());
        } else {
          setPais(donde.trim());
        }
      }
    },
  });

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

// ── Facebook: elegir una búsqueda del Espía, y sacarles los contactos ────────
//
// Desde el 2026-10-03 el paso 1 no busca: ELIGE entre las búsquedas del Espía a tus competidores
// (Kevin y Jorge: «así ya no se repiten los dos Espías»). Las dos pantallas lanzaban el mismo trabajo
// `ad-spy`, así que eran la misma búsqueda con dos puertas. Ahora se espía en un solo lugar —con 60
// anuncios para mirar o 1.000 para sacar contactos— y acá sólo se sacan contactos.
//
// Hasta el 2026-10-03 había una «Opción 1 · Pegando la URL» de la Ad Library al lado de esta. Se
// quitó por pedido de Kevin y Jorge: la persona no tiene que ir a otro lugar a buscar un link. Las
// dos usaban el mismo actor, el mismo tope de 1.000 anuncios y el mismo paso 2, así que no se pierde
// nada de lo que se gasta ni de lo que se encuentra. Lo único que la URL permitía y ésta no son los
// filtros finos de la Ad Library (sólo activos, frase exacta, una página concreta…), porque el
// backend arma la búsqueda con filtros fijos (`build_meta_ad_library_url`).
//
// La fuente `facebook-ads` sigue existiendo en el servidor, en Monitoreo y en Mis Leads: hay
// corridas viejas guardadas con ese nombre.

function FormularioFacebook({ onLeads }) {
  /* DOS trabajos: abrir una búsqueda del Espía (sus anuncios) y sacarles los contactos a sus
     anunciantes (`apify/facebook-pages-scraper`). La búsqueda trae el copy y los días que lleva
     corriendo cada anuncio, que es lo que permite elegir a quién procesar. */
  const [busquedas, setBusquedas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [elegida, setElegida] = useState(null);
  /* La lista también en una referencia: el oyente del pedido la necesita y vive fuera del render. */
  const listaRef = useRef([]);
  listaRef.current = busquedas;

  /* Si había una búsqueda del Espía corriendo, se retoma acá también: es la misma fuente. */
  const porNicho = useTrabajo('ad-spy', {
    trabajando: 'Abriendo la búsqueda… si todavía está corriendo, puede tomar unos minutos.',
    contar: (n) => `Listo. ${n} ${n === 1 ? 'anuncio' : 'anuncios'} en esta búsqueda.`,
    alRetomar: (trabajo) => {
      // El backend guarda la búsqueda como `AdSpy: <lo buscado>` y el país en `location`.
      setElegida({
        id: trabajo.id,
        consulta: (trabajo.business_type || '').startsWith(PREFIJO_DE_BUSQUEDA)
          ? trabajo.business_type.slice(PREFIJO_DE_BUSQUEDA.length)
          : trabajo.business_type || '',
        pais: trabajo.location || 'ALL',
      });
    },
  });
  const { seguir } = porNicho;

  const elegir = useCallback(
    (b) => {
      setElegida(b);
      seguir(b.id);
    },
    [seguir],
  );

  /* La lista de búsquedas, y el pedido que dejó el Espía con «Sacar contactos de estos
     anunciantes →». Sólo las terminadas con anuncios se pueden elegir; las demás no tienen a quién
     sacarle contactos. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const lista = await leerBusquedasDelEspia();
      if (!vivo) return;
      setBusquedas(lista);
      const pedido = tomarPedido();
      const deseada = pedido && (lista ?? []).find((b) => b.id === pedido);
      if (deseada) elegir(deseada);
    })();
    const baja = alPedirScraper(async (id) => {
      let b = (listaRef.current ?? []).find((x) => x.id === id);
      if (!b) {
        // Una búsqueda recién hecha en el Espía todavía no está en la lista que se leyó al montar.
        const lista = await leerBusquedasDelEspia();
        if (!vivo) return;
        setBusquedas(lista);
        b = (lista ?? []).find((x) => x.id === id);
      }
      if (!b) return;
      tomarPedido();
      elegir(b);
    });
    return () => {
      vivo = false;
      baja();
    };
  }, [elegir]);

  const visibles = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (busquedas ?? []).filter(
      (b) => b.status === 'COMPLETED' && (b.anuncios ?? 0) > 0 && (f === '' || b.consulta.toLowerCase().includes(f)),
    );
  }, [busquedas, filtro]);
  const paginas = useTrabajo('facebook-pages');

  const anunciantes = useMemo(() => anunciantesDe(porNicho.leads), [porNicho.leads]);

  /* Los que se pueden procesar son los que tienen URL de página: es lo ÚNICO que acepta el actor
     del paso 2. Los otros se muestran apagados en vez de esconderse — «este anunciante no se puede
     procesar» es información, y esconderlos haría que la cuenta no cuadre sin decir por qué. */
  const procesables = useMemo(
    () => anunciantes.filter((a) => a.page_profile_uri !== ''),
    [anunciantes],
  );

  const [elegidos, setElegidos] = useState(() => new Set());
  /* Al llegar una lista nueva se marcan todos los procesables. Es lo que hacía el paso 2 de antes
     —procesaba todo— así que quien no quiera elegir aprieta y listo; quien quiera, desmarca. */
  useEffect(() => {
    setElegidos(new Set(procesables.map((a) => a.page_profile_uri)));
  }, [procesables]);

  const marcados = procesables.filter((a) => elegidos.has(a.page_profile_uri));

  const alternar = (uri) => {
    setElegidos((previo) => {
      const proximo = new Set(previo);
      if (proximo.has(uri)) proximo.delete(uri);
      else proximo.add(uri);
      return proximo;
    });
  };

  const todosMarcados = procesables.length > 0 && marcados.length === procesables.length;
  const alternarTodos = () => {
    setElegidos(todosMarcados ? new Set() : new Set(procesables.map((a) => a.page_profile_uri)));
  };

  /* La tabla de abajo muestra los CONTACTOS cuando ya se sacaron. Antes de eso no muestra nada: los
     resultados de la búsqueda son anuncios y se ven como tarjetas, no como columnas.

     ── EL VACÍO ES UNA CONSTANTE, Y ESTO TIRÓ LA PANTALLA ENTERA ─────────────

     Acá decía `: []`. Un literal se construye NUEVO en cada render, así que la dependencia del
     efecto cambiaba siempre: `onLeads` —que es el `setLeads` del panel de arriba— fijaba estado,
     eso volvía a renderizar, el literal nacía otra vez, y el ciclo no paraba. React no lo atrapa
     con «Maximum update depth» porque cada vuelta es un commit aparte: no hay error, hay un bucle
     que consume el proceso hasta que el navegador mata la pestaña. Lo que se ve es
     «This page couldn't load», sin una sola línea en ningún registro.

     Con una constante del módulo la identidad no cambia, el efecto corre una vez, y se acabó. */
  const vigentes = paginas.leads.length > 0 ? paginas.leads : SIN_LEADS;
  useEffect(() => { onLeads(vigentes); }, [vigentes, onLeads]);

  const sacarContactos = () => {
    if (marcados.length === 0) {
      paginas.setFase('error');
      paginas.setMensaje('Elegí al menos un anunciante con página para sacarle los contactos.');
      return;
    }
    paginas.arrancar('facebook-pages', {
      pages: marcados.map((a) => ({
        page_name: a.page_name,
        page_profile_uri: a.page_profile_uri,
        page_id: a.page_id,
      })),
    });
  };

  return (
    <div className="sc-form">
      <div className="sc-paso-titulo">1 · Elegí una búsqueda del Espía</div>
      <div className="sc-paso">
        {busquedas === null ? (
          <div className="sc-puente">No se pudieron leer las búsquedas del Espía. Probá de nuevo en un momento.</div>
        ) : (busquedas ?? []).some((b) => b.status === 'COMPLETED' && (b.anuncios ?? 0) > 0) ? (
          <>
            <input
              className="es-consulta sc-filtro"
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar búsquedas…"
              aria-label="Filtrar las búsquedas del Espía"
            />
            <div className="es-historial-lista sc-busquedas">
              {visibles.map((b) => {
                const actual = elegida?.id === b.id;
                return (
                  <button
                    type="button"
                    key={b.id}
                    className={`es-busqueda${actual ? ' actual' : ''}`}
                    disabled={actual || porNicho.ocupado || paginas.ocupado}
                    onClick={() => elegir(b)}
                    aria-current={actual ? 'true' : undefined}
                  >
                    <span className="es-busqueda-punto" aria-hidden="true">{actual ? '●' : '○'}</span>
                    <b>{b.consulta || 'Sin texto'}</b>
                    <span className="es-busqueda-dato">
                      {b.pais === 'ALL' ? 'Todos los países' : b.pais} · {b.anuncios} anuncios ·{' '}
                      {new Date(b.creadoEl).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                );
              })}
              {visibles.length === 0 ? <div className="sc-puente">Ninguna búsqueda coincide con «{filtro}».</div> : null}
            </div>
          </>
        ) : (
          <div className="sc-puente">Todavía no hay búsquedas del Espía con anuncios.</div>
        )}
        <Aviso fase={porNicho.fase} mensaje={porNicho.mensaje} />
        <div className="sc-subpista">
          ¿No está la que buscás?{' '}
          <button type="button" className="sc-enlace" onClick={() => irALaVista('tools', { pestana: 'espia' })}>
            Espiá una nueva en «Espía a tus competidores» →
          </button>{' '}
          Para sacar contactos conviene la de 1.000 anuncios: trae más anunciantes.
        </div>
      </div>

      <div className="sc-paso-titulo">2 · Sacar contactos</div>
      <div className="sc-paso">
        {anunciantes.length === 0 ? (
          <div className="sc-puente">
            Primero elegí una búsqueda arriba.
          </div>
        ) : (
          <>
            <div className="sc-cuenta">
              <label className="sc-todos">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
                <span>Todos</span>
              </label>
              <span>
                {anunciantes.length} anunciante{anunciantes.length === 1 ? '' : 's'} ·{' '}
                {procesables.length} con página
                {anunciantes.length > procesables.length
                  ? ` · ${anunciantes.length - procesables.length} sin página, no se pueden procesar`
                  : ''}
              </span>
            </div>

            <div className="sc-lista">
              {anunciantes.map((a, i) => {
                const puede = a.page_profile_uri !== '';
                return (
                  <label
                    key={a.page_profile_uri || `sin-url-${i}`}
                    className={`sc-fila${puede ? '' : ' sin-pagina'}`}
                  >
                    <input
                      type="checkbox"
                      checked={puede && elegidos.has(a.page_profile_uri)}
                      disabled={!puede || paginas.ocupado}
                      onChange={() => alternar(a.page_profile_uri)}
                    />
                    <span className="sc-fila-nombre">{a.page_name || 'Anunciante sin nombre'}</span>
                    <span className="sc-fila-dato">
                      {a.anuncios} anuncio{a.anuncios === 1 ? '' : 's'}
                      {a.diasMax >= 0
                        ? ` · el más viejo lleva ${a.diasMax} día${a.diasMax === 1 ? '' : 's'}`
                        : ''}
                      {puede ? '' : ' · sin página, no se puede procesar'}
                    </span>
                  </label>
                );
              })}
            </div>

            <Aviso fase={paginas.fase} mensaje={paginas.mensaje} />
            <button
              type="button"
              className="sc-btn"
              disabled={paginas.ocupado || marcados.length === 0}
              onClick={sacarContactos}
            >
              {paginas.ocupado
                ? 'Scrapeando…'
                : `📘 Extraer contactos de ${marcados.length} ${marcados.length === 1 ? 'anunciante' : 'anunciantes'}`}
            </button>
          </>
        )}
      </div>

      {/* Las tarjetas de los anuncios de la búsqueda elegida: son lo que hace que elegir tenga sentido. */}
      {porNicho.leads.length > 0 ? (
        <div className="es-rejilla sc-anuncios">
          {porNicho.leads.slice(0, TARJETAS_A_LA_VISTA).map((a, i) => (
            <TarjetaDeAnuncio key={a.ad_archive_id || i} anuncio={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const PESTANIAS = [
  { clave: 'maps', etiqueta: 'Google Maps', emoji: '🗺️' },
  { clave: 'facebook', etiqueta: 'Facebook', emoji: '📘' },
  { clave: 'linkedin', etiqueta: 'LinkedIn', emoji: '💼' },
];

export default function Scraper({ nicho, onLeads }) {
  /* Si el Espía dejó un pedido («Sacar contactos de estos anunciantes →»), se arranca en Facebook. El
     pedido lo toma el formulario de Facebook, no éste: acá sólo se mira si hay uno. */
  const [pestania, setPestania] = useState(() => (hayPedido() ? 'facebook' : 'maps'));
  useEffect(() => alPedirScraper(() => setPestania('facebook')), []);
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
