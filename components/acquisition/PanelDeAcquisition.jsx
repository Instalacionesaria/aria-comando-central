'use client';

/* El tablero de Acquisition: los tres funnels del prototipo, con los datos reales.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LOS NÚMEROS LLEGAN HECHOS
 *
 * `aios-command-center_1.html` dibujaba esta pantalla con plantillas de texto (`renderKpis`,
 * `renderFunnels`, `renderTables`, líneas 5482-5594) sobre 58 cifras inventadas. Acá se dibuja el
 * MISMO marcado —`cre-head`, `acq-kpis`, `acq-note`, `acq-fgrid`, las tablas plegables—, con las
 * mismas clases y en el mismo orden, y las reglas siguen siendo las de `app/aios.css:1585-1725`, que
 * nadie toca (docs/acquisition/14, A14-01). Lo nuevo —el selector de funnel, los huecos, el teléfono—
 * vive en `app/acquisition.css`.
 *
 * Lo que cambia es de dónde salen los números: el navegador **no calcula nada**. Las tasas, los costos
 * y las variaciones con su lectura llegan de `embudosDeAcquisition` (A14-17). Lo único que se hace
 * acá es darles formato y elegir la frase de cada hueco, de la lista cerrada de A14-02.
 *
 * ── LO QUE EL PROTOTIPO TENÍA Y ESTA PANTALLA NO ──────────────────────────
 *
 *   · **«Personalizado» y el rango con «Comparar vs»**: el período es el del sistema (A14-10).
 *   · **«Tasa: Paso a paso / Acumulada»**: con los clics fuera y el formulario sin dato, las dos
 *     tasas dan el mismo número, y el usuario decidió no dibujar un control que no cambia nada (A14-09).
 *   · **`data-leads`**: abría un cajón con personas inventadas (A14-15).
 *
 * ── Y LO QUE ESTA PANTALLA TIENE Y EL PROTOTIPO NO ────────────────────────
 *
 * El selector de funnel en cada campaña, porque el funnel se asigna a mano (A14-03), y la tabla
 * «Sin funnel», donde empiezan todas (A14-14). El selector se dibuja sólo si el servidor dijo que esta
 * sesión puede asignar y no se está mirando otra empresa, como el link manual de Creative: ofrecer un
 * control que va a dar 403 es el `07` § 4.
 *
 * ── Y LO QUE VOLVIÓ CON LOS AGENTES (AG9) ─────────────────────────────────
 *
 * El botón «Plan de acción» y la tarjeta «Señales detectadas» del prototipo (A14-16), en
 * `components/senales/SenalesDelDepartamento.jsx`, con lo que guarda cada mañana la pasada del detector de Acquisition.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { guardarFunnelDeLaCampana, leerAcquisition, sacarFunnelDeLaCampana } from '@/lib/negocio/vistaDeAcquisition';
import { useSesion } from '../../app/sesion-contexto.tsx';
import { BotonDelPlan, TarjetaDeSenales } from '../senales/SenalesDelDepartamento.jsx';
import { usarPublicarComentario } from '../../lib/agentes/comentario-de-la-cabecera.ts';

/* Los tres funnels del prototipo (`FUNNELS`, línea 5344): nombre, rótulo de cada etapa y rótulo de su
   costo. Son texto de pantalla y no reglas: qué etapas tiene cada uno lo dice el servidor
   (`ETAPAS` de `embudosDeAcquisition.ts`), y esto sólo las nombra. */
const FUNNELS = {
  leadform: {
    nombre: 'Lead form ads',
    rotulos: { contactos: 'Leads', clics: 'Clics a landing VSL', agendados: 'Agendados' },
    costos: { contactos: 'CPL', clics: 'C/clic', agendados: 'C/agendado' },
  },
  profile: {
    nombre: 'Profile funnel',
    rotulos: { contactos: 'DMs', clics: 'Clics a landing VSL', agendados: 'Agendados' },
    costos: { contactos: 'C/DM', clics: 'C/clic', agendados: 'C/agendado' },
  },
  booking: {
    nombre: 'Booking directo',
    rotulos: { contactos: 'Contactos', forms: 'Completaron form', clics: 'Clics a landing VSL', agendados: 'Agendas' },
    costos: { contactos: 'C/contacto', forms: 'C/form', clics: 'C/clic', agendados: 'C/agenda' },
  },
};
/* «Sin funnel» no está en el prototipo: usa la cadena corta, con los rótulos genéricos. */
const SIN_FUNNEL = {
  nombre: 'Sin funnel',
  rotulos: { contactos: 'Contactos', clics: 'Clics a landing VSL', agendados: 'Agendados' },
  costos: { contactos: 'C/contacto', clics: 'C/clic', agendados: 'C/agendado' },
};
const CLAVES = ['leadform', 'profile', 'booking'];

/* ── LA LISTA CERRADA DE FRASES (A14-02) ───────────────────────────────────
   Una frase nueva entra primero en el documento. */
const FRASE = {
  guion: '—',
  sinDato: 'Sin dato desde el 31 ago.',
  deMeta: 'según Meta',
  sinComparacion: 'sin comparación',
  sinCampanas: 'Sin campañas asignadas',
  asigna: 'Asigna cada campaña a su funnel',
  sinGasto: 'Sin gasto en este período',
  fallo: 'No se pudo leer. Reintenta.',
  noGuardo: 'No se pudo guardar. Reintenta.',
  cargando: 'Cargando…',
  faltanDias: 'Faltan días de gasto.',
  faltaGasto: 'Falta gasto de algunas campañas.',
  sinContactos: 'Sin contactos atribuidos',
  inversionSinContactos: 'sin contactos atribuidos',
  sinHistoria: 'Sin historia para comparar.',
  hoySinCostos: 'Hoy, sin costos.',
  noFigura: 'No figura en Meta',
};

/* ── LOS FORMATOS DEL PROTOTIPO (líneas 5380-5382) ─────────────────────────
   Con una excepción: el costo por clic real anda en centavos, y `Math.round` lo dibujaba «$0», que
   se lee como «gratis». Debajo de diez dólares se dibujan dos decimales. */
const nf = (n) => Math.round(n).toLocaleString('es-MX');
const cf = (n) =>
  n < 10
    ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString('es-MX')}`;
const pf = (n) => `${Math.round(n * 100)}%`;
/** El guion es «no se sabe» o «bajo el piso», nunca un cero. */
const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));

/** `2026-09-16` → «16 sep». El año sólo si no es el corriente. */
function fechaCorta(iso) {
  const [a, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}${a === String(new Date().getFullYear()) ? '' : ` ${a}`}`;
}

/** La ventana de verdad, no la pedida: «7 días» termina en el último día cerrado (A14-10). */
function rangoDe(v) {
  return v.desde === v.hasta ? fechaCorta(v.desde) : `${fechaCorta(v.desde)} – ${fechaCorta(v.hasta)}`;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Los estados que manda GoHighLevel, en castellano. Uno desconocido se muestra tal cual. */
const ESTADOS = { ACTIVE: 'Activa', PAUSED: 'Pausada', ARCHIVED: 'Archivada', DELETED: 'Borrada' };

export default function PanelDeAcquisition() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  // La caja del cerebro del pie pregunta con el período que se está mirando (`lib/agentes/periodos.ts`).
  useEffect(() => anunciarPeriodo('acquisition', periodo), [periodo]);
  const [pantalla, setPantalla] = useState(null);
  // El comentario de la cabecera llega con la pantalla, y se le entrega a la cabecera (AG15, `04`, AG-78).
  usarPublicarComentario('acquisition', pantalla ? (pantalla.comentario ?? null) : undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  /* Cuál es la última lectura pedida. Sin esto, una respuesta que llega tarde pisa a la más nueva:
     la primera carga de 30 días que contesta después de la de 7 deja el botón en «30 días» y la
     pantalla en treinta, y volver a tocar «7 días» no pide nada (lo encontró la revisión de AQ-4). */
  const ultima = useRef(0);

  /**
   * Trae la pantalla. Mismo contrato que `PanelDeConversation`: una recarga del reloj que falla
   * conserva lo que había; el cambio de período va como carga PRIMERA porque las cifras dibujadas
   * son de otra ventana, y si falla, la pantalla queda vacía con el aviso. Devuelve la promesa: el
   * selector de funnel la espera para no habilitarse con el valor viejo.
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      const esta = ++ultima.current;
      if (!esRecarga) setCargando(true);
      const r = await leerAcquisition(periodo);
      if (esta !== ultima.current) return;
      if (r.tipo === 'datos') {
        setPantalla(r.pantalla);
        setError('');
      } else {
        // El motivo del servidor va en el `title`: la pantalla dice sólo la frase corta.
        setError(r.mensaje);
        if (!esRecarga) setPantalla(null);
      }
      if (!esRecarga) setCargando(false);
    },
    [periodo],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Con `null` como clave el reloj no se registra: con Acquisition cerrada esto no cuesta una sola
     petición. El dato es diario —el colector corre una vez por día—, y el tic es el de Inteligencia. */
  const aLaVista = estaALaVista('acquisition');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'acquisition:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      <div className="cre-head">
        <div className="ch-l">
          <h2>Acquisition</h2>
          <span className="cre-desc">Tres funnels con su propia cadena · la calidad se mide con calificados e ICP</span>
        </div>
        <div className="ch-r">
          {pantalla ? <BotonDelPlan departamento="acquisition" senales={pantalla.senales} nombres={nombresDeCampanas(pantalla)} funnels={FUNNELS} /> : null}
          <div className="ch-period">
            {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió: con el estado
                local, una respuesta que se cruza con otra deja el botón describiendo cifras que no
                son las de abajo. Mientras no hay datos manda el local, que es lo único que hay. */}
            <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
          </div>
        </div>
      </div>

      {error ? (
        <p className="acq-falla" title={error}>
          {FRASE.fallo}
        </p>
      ) : null}

      {cargando && pantalla === null ? (
        <p className="acq-cargando">{FRASE.cargando}</p>
      ) : pantalla === null ? null : (
        <Cuerpo p={pantalla} alCambiar={recargar} />
      )}
    </>
  );
}

/* El segmentado del prototipo (`acqPeriodSeg`), con los cuatro períodos del sistema. Sin el `title`
   de `PERIODOS`: el matiz de «Hoy» —«las últimas 24 horas»— es el de las otras pantallas, y acá «Hoy»
   es el día de calendario (A14-10). La ventana real se lee debajo de la Inversión. */
function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg" role="group" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p.clave}
          type="button"
          className={valor === p.clave ? 'on' : undefined}
          aria-pressed={valor === p.clave}
          onClick={() => alElegir(p.clave)}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

function Cuerpo({ p, alCambiar }) {
  const e = p.embudos;
  const sesion = useSesion();
  /* Como el link manual de Creative: sólo quien puede, y nunca mirando otra empresa. El servidor
     valida igual (`PUT /api/acquisition/funnel`). */
  const puedeAsignar = Boolean(p.puedeAsignar && !sesion?.mirandoOtraOrganizacion);

  return (
    <>
      <Cifras e={e} />
      <Nota e={e} />
      <div className="acq-fgrid">
        {CLAVES.map((k) => (
          <Tarjeta key={k} cfg={FUNNELS[k]} g={e.funnels[k]} />
        ))}
      </div>
      <Tablas e={e} puedeAsignar={puedeAsignar} alCambiar={alCambiar} />
      <TarjetaDeSenales
        departamento="acquisition"
        senales={p.senales}
        // Lo decide el servidor; mirando otra empresa, nada (AG-82), como el selector de funnel.
        puede={sesion?.mirandoOtraOrganizacion ? { resolver: false, validar: false, firmar: false } : p.puedeConSenales}
        nombres={nombresDeCampanas(p)}
        funnels={FUNNELS}
        alCambiar={alCambiar}
      />
    </>
  );
}

/** El nombre de cada campaña, de los embudos: el plan y las señales traen identificadores (A6-05). */
function nombresDeCampanas(p) {
  return new Map(p.embudos.campanas.filter((c) => c.nombre).map((c) => [c.campana, c.nombre]));
}

/** La variación, como el `delta()` del prototipo (línea 5463). El color lo trae el servidor. */
function Delta({ v }) {
  if (!v || v.tipo === 'sin_comparacion') return null;
  if (v.tipo === 'igual') return <span className="dlt flat">=</span>;
  /* La Inversión lleva flecha sin color: subir no es bueno ni malo (A14-11). */
  const clase = v.lectura === 'buena' ? 'dlt up' : v.lectura === 'mala' ? 'dlt down' : 'dlt';
  return (
    <span className={clase}>
      {v.tipo === 'sube' ? '▲' : '▼'} {Math.round(v.porcentaje * 100)}%
    </span>
  );
}

/** La barra del ICP: alto, medio y bajo. Los «sin calificar» no entran (A14-08). */
function BarraIcp({ icp }) {
  const t = icp.alto + icp.medio + icp.bajo;
  const ancho = (n) => `${t ? (n / t) * 100 : 0}%`;
  return (
    <div className="acq-icp">
      <i className="a" style={{ width: ancho(icp.alto) }} />
      <i className="m" style={{ width: ancho(icp.medio) }} />
      <i className="b" style={{ width: ancho(icp.bajo) }} />
    </div>
  );
}

const etapa = (g, clave) => g.etapas.find((x) => x.etapa === clave);

/** Las cinco cifras (`renderKpis`, línea 5482): suman TODAS las campañas, con o sin funnel (A14-14). */
function Cifras({ e }) {
  const t = e.total;
  const contactos = etapa(t, 'contactos');
  const clics = etapa(t, 'clics');
  const agendados = etapa(t, 'agendados');
  const cifras = [
    // La ventana siempre, también sin gasto: los contactos de abajo siguen siendo de esos días (A14-10).
    [
      'Inversión',
      cf(t.inversion),
      t.variacionDeInversion,
      t.inversion > 0
        ? /* Lo que la cuenta gastó en campañas sin contactos atribuidos no paga ningún costo de personas (A14-19). */
          `${rangoDe(e.ventana)}${t.inversionSinContactos > 0 ? ` · ${cf(t.inversionSinContactos)} ${FRASE.inversionSinContactos}` : ''}`
        : `${FRASE.sinGasto} · ${rangoDe(e.ventana)}`,
    ],
    ['Contactos', o(contactos?.valor, nf), contactos?.variacion, 'todas las campañas'],
    ['Clics a landing VSL', o(clics?.valor, nf), clics?.variacion, FRASE.deMeta],
    ['Agendados', o(agendados?.valor, nf), agendados?.variacion, 'volumen total'],
    ['Calificados', nf(t.calificados.valor), t.calificados.variacion, `${o(t.calificados.costo, cf)} por calificado`],
  ];
  return (
    <section className="acq-kpis">
      {cifras.map(([rotulo, valor, variacion, pie]) => (
        <div className="kpi" key={rotulo}>
          <div className="k-label">{rotulo}</div>
          <div className="k-val">
            <span>{valor}</span>
          </div>
          <div className="k-delta">
            <Delta v={variacion} /> <span style={{ color: 'var(--txt-faint)' }}>{pie}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * La nota bajo las cifras (A14-12): cuántos leads traen campaña, y por qué faltan flechas o costos
 * cuando faltan. Una línea.
 */
function Nota({ e }) {
  const motivos = [];
  /* `no_cuadra`: todos los días tienen el total de la cuenta y el detalle por campaña todavía no lo explica; el
     relleno de cada hora lo está buscando (A14-19). Es otro hecho que «faltan días», y otra frase. */
  if (e.gasto?.motivo === 'no_cuadra') motivos.push(FRASE.faltaGasto);
  else if (e.sinComparacion === 'faltan_dias' || e.sinCostos === 'gasto_incompleto') motivos.push(FRASE.faltanDias);
  else if (e.sinComparacion === 'sin_historia') motivos.push(FRASE.sinHistoria);
  if (e.sinCostos === 'hoy') motivos.push(FRASE.hoySinCostos);
  return (
    <p className="acq-note">
      <b>
        {nf(e.cobertura.conCampana)} de {nf(e.cobertura.sobre)}
      </b>{' '}
      leads traen campaña.
      {motivos.map((m) => ` ${m}`).join('')}
    </p>
  );
}

/** Una tarjeta de funnel (`renderFunnels`, línea 5500). */
function Tarjeta({ cfg, g }) {
  const entrada = g.etapas[0];
  const base = entrada?.valor ?? 0;
  const q = g.calificados;
  return (
    <div className="card">
      <div className="acq-fhead">
        <div className="acq-ftitle">
          <div className="acq-fname">{cfg.nombre}</div>
          <div className="acq-fentry">
            {g.campanas === 0
              ? FRASE.sinCampanas
              : `entra en ${cfg.rotulos.contactos.toLowerCase()} · ${plural(g.campanas, 'campaña', 'campañas')}`}
          </div>
        </div>
        <div className="acq-fstats">
          <div className="acq-fs">
            <span>Inversión</span>
            <b>{cf(g.inversion)}</b>
          </div>
          <div className="acq-fs key">
            <span>Calificados</span>
            <b>{nf(q.valor)}</b>
          </div>
          <div className="acq-fs key">
            <span>Costo / calif.</span>
            <b>{o(q.costo, cf)}</b>
          </div>
        </div>
      </div>
      <div className="acq-fbody">
        {g.etapas.map((s, i) => {
          const ancho = s.valor === null || !base ? 0 : Math.min(100, (s.valor / base) * 100);
          return (
            <div className="acq-stg" key={s.etapa}>
              <div className="acq-stg-top">
                <span className="acq-stg-n">{cfg.rotulos[s.etapa]}</span>
                <span className="acq-stg-v">{o(s.valor, nf)}</span>
                <span className="acq-stg-d">
                  <Delta v={s.variacion} />
                </span>
              </div>
              <div className="acq-bar">
                <i style={{ width: `${ancho}%` }} />
              </div>
              <div className="acq-stg-m">
                {s.etapa === 'forms'
                  ? FRASE.sinDato
                  : `${
                      i === 0
                        ? 'punto de entrada'
                        : s.deMeta
                          ? FRASE.deMeta
                          : s.tasa === null
                            ? FRASE.guion
                            : `${pf(s.tasa)} desde ${cfg.rotulos.contactos.toLowerCase()}`
                    } · ${cfg.costos[s.etapa]} ${o(s.costo, cf)}`}
              </div>
              {s.etapa === 'agendados' ? (
                <div className="acq-qual">
                  <div className="acq-qual-top">
                    <span className="acq-qual-k">Calificados</span>
                    <span className="acq-qual-v">
                      {nf(q.valor)}
                      <span className="acq-stg-d">
                        <Delta v={q.variacion} />
                      </span>
                    </span>
                  </div>
                  <div className="acq-qual-m">
                    {o(q.tasa, pf)} de {cfg.rotulos.agendados.toLowerCase()} · {o(q.costo, cf)} c/u · ICP{' '}
                    {o(q.icp.promedio, (v) => `${Math.round(v)}%`)}
                  </div>
                  <BarraIcp icp={q.icp} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Las tablas por funnel, que se pliegan (`renderTables`, línea 5546), y al final «Sin funnel».
 *
 * Abren como el prototipo —Lead form ads desplegada, las otras dos plegadas— y «Sin funnel» abierta
 * mientras tenga campañas, porque ahí está el selector para asignarlas (decidido por el usuario el
 * 2026-09-30). Lo que alguien plegó o desplegó a mano se respeta en las recargas.
 */
function Tablas({ e, puedeAsignar, alCambiar }) {
  const [abiertas, setAbiertas] = useState({ leadform: true, profile: false, booking: false, sin_funnel: null });
  const abierta = (k) => (k === 'sin_funnel' && abiertas.sin_funnel === null ? e.sinFunnel.campanas > 0 : abiertas[k]);
  const alternar = (k) => setAbiertas((a) => ({ ...a, [k]: !abierta(k) }));

  const grupos = [
    ...CLAVES.map((k) => ({ k, cfg: FUNNELS[k], g: e.funnels[k], campanas: e.campanas.filter((c) => c.funnel === k) })),
    { k: 'sin_funnel', cfg: SIN_FUNNEL, g: e.sinFunnel, campanas: e.campanas.filter((c) => c.funnel === null) },
  ];

  return (
    <div>
      {grupos.map(({ k, cfg, g, campanas }) => (
        <Tabla
          key={k}
          clave={k}
          cfg={cfg}
          g={g}
          campanas={campanas}
          abierta={abierta(k)}
          alAlternar={() => alternar(k)}
          puedeAsignar={puedeAsignar}
          alCambiar={alCambiar}
        />
      ))}
    </div>
  );
}

function Tabla({ clave, cfg, g, campanas, abierta, alAlternar, puedeAsignar, alCambiar }) {
  // Las etapas hasta los agendados, como el prototipo: los calificados van en sus columnas propias.
  const etapas = g.etapas.map((s) => s.etapa);
  const grilla = { gridTemplateColumns: `1.7fr .7fr${' .85fr'.repeat(etapas.length)} .8fr .7fr .8fr .9fr` };
  const sinFunnel = clave === 'sin_funnel';

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div
        className="card-head"
        data-acq-toggle={clave}
        role="button"
        tabIndex={0}
        aria-expanded={abierta}
        style={{ cursor: 'pointer' }}
        onClick={alAlternar}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            alAlternar();
          }
        }}
      >
        <span
          style={{ color: 'var(--txt-faint)', display: 'inline-block', transform: `rotate(${abierta ? 90 : 0}deg)` }}
          aria-hidden="true"
        >
          ›
        </span>{' '}
        {cfg.nombre}{' '}
        <span className="hint">
          {sinFunnel && g.campanas > 0 ? `${FRASE.asigna} · ` : ''}
          {plural(g.campanas, 'campaña', 'campañas')} · hasta calificado · {cf(g.inversion)}
          <em className="acq-toggle-l">{abierta ? 'ocultar campañas' : 'ver campañas'}</em>
        </span>
      </div>
      {/* El envoltorio desliza la tabla a lo ancho en un teléfono (`app/acquisition.css`): son hasta
          diez columnas, y apretarlas en 375 px las volvería ilegibles. */}
      <div className="acq-desliza">
        {abierta ? (
          <div className="col-head" style={grilla}>
            <span>Campaña</span>
            <span>Inversión</span>
            {etapas.map((s) => (
              <span key={s}>{cfg.rotulos[s]}</span>
            ))}
            <span>Calificados</span>
            <span>% calif.</span>
            <span>Costo/calif.</span>
            <span>Afinidad ICP</span>
          </div>
        ) : null}
        <div className="rows">
          {abierta
            ? campanas.map((c) => (
                <Fila
                  key={c.campana}
                  cfg={cfg}
                  grilla={grilla}
                  r={c.cifras}
                  sinContactos={!c.conContactos}
                  nombre={c.nombre ?? c.campana}
                  pie={
                    <Pie c={c} puedeAsignar={puedeAsignar} alCambiar={alCambiar} />
                  }
                />
              ))
            : null}
          <Fila
            cfg={cfg}
            grilla={grilla}
            r={g}
            total
            nombre={sinFunnel ? 'Total' : 'Total del funnel'}
            pie={plural(g.campanas, 'campaña', 'campañas')}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Una fila: una campaña o el total del grupo.
 *
 * `sinContactos`: la campaña nunca trajo un contacto con su campaña en la atribución —una de mensajes, cuyos
 * contactos llegan sin `campaignId`—. Sus etapas de personas no son cero: no se sabe cuánta gente trajo, y se
 * dibujan con el guion (A14-19). Los clics sí: los cuenta Meta.
 */
function Fila({ cfg, grilla, r, nombre, pie, total = false, sinContactos = false }) {
  const q = r.calificados;
  const personas = (v) => (sinContactos ? FRASE.guion : nf(v));
  return (
    <div className={total ? 'row-i acq-tot' : 'row-i'} style={grilla}>
      <div>
        <div className="rn">{nombre}</div>
        <div className="rs">{pie}</div>
      </div>
      <div className="num">{cf(r.inversion)}</div>
      {r.etapas.map((s, i) => (
        <div className="num" key={s.etapa}>
          <span>{s.deMeta ? o(s.valor, nf) : o(s.valor, personas)}</span>
          <div className="acq-sub">
            {s.etapa === 'forms'
              ? FRASE.sinDato
              : `${i === 0 ? 'entrada' : s.deMeta ? FRASE.deMeta : o(s.tasa, pf)} · ${o(s.costo, cf)}`}
          </div>
        </div>
      ))}
      <div className="num acq-q">
        <span>{personas(q.valor)}</span>
        <div className="acq-sub">
          {q.variacion.tipo === 'sin_comparacion' ? FRASE.sinComparacion : <Delta v={q.variacion} />}
        </div>
      </div>
      <div className="num">{o(q.tasa, pf)}</div>
      <div className="num">{o(q.costo, cf)}</div>
      <div className="num">
        <div className="acq-icp-cell">
          <span style={{ fontWeight: 600 }}>{o(q.icp.promedio, (v) => `${Math.round(v)}%`)}</span>
          <BarraIcp icp={q.icp} />
        </div>
      </div>
    </div>
  );
}

/**
 * El pie de una campaña: su estado en Meta y, para quien puede, el selector de funnel (A14-03).
 *
 * Una campaña que GoHighLevel no listó no se puede asignar —la foránea de la `066`—, así que no lleva
 * selector: lleva la frase que dice por qué (A14-18).
 */
function Pie({ c, puedeAsignar, alCambiar }) {
  /* Mientras se guarda, el selector muestra lo ELEGIDO: controlado por `c.funnel`, React lo devolvía
     al valor viejo durante el guardado y la recarga. */
  const [guardando, setGuardando] = useState(null);
  const [fallo, setFallo] = useState('');

  const enMeta = c.conocida ? `${c.estado ? `${ESTADOS[c.estado] ?? c.estado} · ` : ''}Meta` : FRASE.noFigura;
  const estado = c.conContactos ? enMeta : `${enMeta} · ${FRASE.sinContactos}`;
  if (!puedeAsignar || !c.conocida) return estado;

  async function elegir(valor) {
    setGuardando(valor);
    setFallo('');
    const r = valor === '' ? await sacarFunnelDeLaCampana(c.campana) : await guardarFunnelDeLaCampana(c.campana, valor);
    // Se espera la recarga: habilitarlo antes lo dejaba diciendo el funnel viejo hasta que llegara.
    if (r.tipo === 'datos') await alCambiar();
    else setFallo(r.mensaje);
    setGuardando(null);
  }

  return (
    <>
      {estado}
      <select
        className="acq-funnel"
        value={guardando ?? c.funnel ?? ''}
        disabled={guardando !== null}
        aria-label={`Funnel de ${c.nombre ?? c.campana}`}
        onChange={(ev) => elegir(ev.target.value)}
      >
        {CLAVES.map((k) => (
          <option key={k} value={k}>
            {FUNNELS[k].nombre}
          </option>
        ))}
        <option value="">{SIN_FUNNEL.nombre}</option>
      </select>
      {fallo ? (
        <span className="acq-falla" title={fallo}>
          {FRASE.noGuardo}
        </span>
      ) : null}
    </>
  );
}
