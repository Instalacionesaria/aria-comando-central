'use client';

/* Leads Portal con leads reales: la cohorte del período, cinco tarjetas y una tarjeta por persona.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA
 *
 * `lib/aios/leads-portal.js`: 324 líneas que dibujaban quince personas inventadas con `innerHTML`,
 * calculaban los tramos y las tasas en el navegador, y abrían la ficha por posición —o, desde otra
 * pantalla, por NOMBRE, copiando la del primero cuando no lo encontraba—. Los números eran
 * coherentes entre sí y no describían a nadie.
 *
 * Acá el servidor manda la cohorte ya contada: cada fila con su tramo, su cita, su asistencia y su
 * venta decididos, y cada tarjeta con su piso aplicado y su nulo donde no se puede decir. La pantalla
 * pide, filtra lo que ya llegó y dibuja.
 *
 * ── SE CONSERVA LA FORMA ────────────────────────────────────────────────────
 *
 * Las clases son las de la maqueta (`icpc`, `lc`, `lc-prog`…), así que la pantalla se ve como se
 * veía. Lo que cambia es lo que dicen: «ICP alto» y no «Calificado alto», «monto reportado» y no
 * «Revenue», tres estados por paso y no dos, y un guion donde no hay de qué hablar, nunca un cero.
 *
 * ── LO QUE SE FUE Y NO VUELVE ───────────────────────────────────────────────
 *
 * El botón «Plan de acción» —cuatro frases escritas a mano, ninguna sostenible con los datos—, la
 * píldora «Personalizado» —un calendario que no filtraba nada— y el tercer botón del segmentado, que
 * mandaba una clave que no existe. Y ninguna cifra lleva `data-leads`: la lista de cada cifra ya está
 * en esta misma pantalla, y tocar la tarjeta la filtra.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { ROTULO_DE_TODOS, TRAMOS, rotuloDelTramo } from '@/lib/negocio/tramosDelIcp';
import { DE_A, ETAPAS, SIN_FILTROS, contador, filtrar, porQueVacia } from '@/lib/negocio/filtrosDelPortal';
import { leerLeadsPortal } from '@/lib/negocio/vistaDeLeadsPortal';
import FichaDelLead from './FichaDelLead.jsx';

export default function PanelDeLeadsPortal() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [mostradas, setMostradas] = useState(DE_A);
  const [abierta, setAbierta] = useState(null);
  /* A dónde vuelve el foco al cerrar la ficha: la tarjeta que la abrió. */
  const origen = useRef(null);

  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerLeadsPortal(periodo);
      if (r.tipo === 'datos') {
        setPantalla(r.pantalla);
        setError('');
      } else {
        setError(r.mensaje);
        /* Una recarga que falla NO vacía la pantalla: teniendo datos, se siguen mostrando y el
           error se dice arriba. Vaciarla borraría cifras correctas mientras alguien las lee. */
        if (!esRecarga) setPantalla(null);
      }
      if (!esRecarga) setCargando(false);
    },
    [periodo],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Con `null` como clave el reloj no se registra: con la pestaña cerrada esto no cuesta una
     petición. La cadencia es la de Inteligencia: las altas entran por el barrido, no en vivo. */
  const aLaVista = estaALaVista('contacts');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'contacts:tic' : null, recargar, CADENCIA.inteligencia);

  /* Cambiar de período conserva los filtros y vuelve a las primeras sesenta: lo mostrado era de otra
     cohorte. La recarga del reloj no pasa por acá, así que no toca nada de lo que se está leyendo. */
  const elegirPeriodo = (p) => {
    setPeriodo(p);
    setMostradas(DE_A);
  };
  const cambiarFiltros = (cambio) => {
    setFiltros((f) => ({ ...f, ...cambio }));
    setMostradas(DE_A);
  };
  const abrir = (id, boton) => {
    origen.current = boton;
    setAbierta(id);
  };
  const cerrar = useCallback(() => {
    setAbierta(null);
    origen.current?.focus();
  }, []);

  return (
    <>
      <div className="cre-head">
        <div className="ch-l">
          <h2>Leads Portal</h2>
          <span className="cre-desc">Cada contacto, de dónde vino y hasta dónde llegó</span>
        </div>
        <div className="ch-r">
          {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. */}
          <Periodos valor={pantalla?.periodo ?? periodo} alElegir={elegirPeriodo} />
        </div>
      </div>

      {error ? <p className="lp-error" role="alert">{error}</p> : null}

      {cargando && pantalla === null ? (
        <p className="lp-vacio">Leyendo los leads…</p>
      ) : pantalla === null ? null : (
        <Cuerpo
          p={pantalla}
          filtros={filtros}
          alFiltrar={cambiarFiltros}
          mostradas={mostradas}
          alMostrarMas={() => setMostradas((n) => n + DE_A)}
          alAbrir={abrir}
        />
      )}

      {abierta === null ? null : <FichaDelLead id={abierta} alCerrar={cerrar} />}
    </>
  );
}

function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg" role="group" aria-label="Período de la cohorte">
      {PERIODOS.map((p) => (
        <button
          key={p.clave}
          type="button"
          className={valor === p.clave ? 'on' : undefined}
          aria-pressed={valor === p.clave}
          title={p.matiz ?? undefined}
          onClick={() => alElegir(p.clave)}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

// ─── Formato. El guion es «no se sabe», NUNCA un cero. ────────────────────────

const miles = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-PE'));
const porcentaje = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
/* En la zona de quien mira: la fecha la dibuja el navegador, y ahí sí hay alguien mirando. */
const fechaCorta = (iso) =>
  iso ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

/** El porqué de un nulo, en palabras. Viaja como clave; el texto es de la pantalla. */
const POR_QUE = {
  sin_ventas_registradas: 'No hay ninguna venta registrada en la empresa: un 0 % diría que nadie compró.',
  bajo_el_piso: 'Menos de diez personas en el tramo: una venta movería la tasa más de diez puntos.',
  ventas_sin_monto: 'Hay ventas y ninguna tiene el monto cargado: un $0 diría que se vendió gratis.',
};

function Cuerpo({ p, filtros, alFiltrar, mostradas, alMostrarMas, alAbrir }) {
  const vistas = useMemo(() => filtrar(p.leads, filtros), [p.leads, filtros]);
  const asistenciasRegistradas = p.leads.filter((l) => l.asistencia === 'asistio' || l.asistencia === 'no_asistio').length;

  return (
    <>
      <Avisos p={p} />

      <section className="icp-cards" aria-label="Contactos por tramo de ICP">
        {p.tramos.map((t) => (
          <Tarjeta
            key={t.clave}
            t={t}
            encendida={filtros.tramo === t.clave}
            alTocar={() => alFiltrar({ tramo: filtros.tramo === t.clave ? null : t.clave })}
            parte={t.clave === 'sin_calificar' ? p.sinCalificar : null}
          />
        ))}
        <Tarjeta t={p.todos} encendida={filtros.tramo === null} alTocar={() => alFiltrar({ tramo: null })} />
      </section>

      <div className="lp-bar">
        <label className="lp-search">
          <span className="si" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={filtros.consulta}
            onChange={(e) => alFiltrar({ consulta: e.target.value })}
            placeholder="Buscar por nombre, campaña o creativo…"
            aria-label="Buscar por nombre, campaña o creativo"
          />
        </label>
        <span className="tb-lab">ICP</span>
        <div className="db-seg" role="group" aria-label="Tramo de ICP">
          <button
            type="button"
            className={filtros.tramo === null ? 'on' : undefined}
            aria-pressed={filtros.tramo === null}
            onClick={() => alFiltrar({ tramo: null })}
          >
            {ROTULO_DE_TODOS}
          </button>
          {TRAMOS.map((t) => (
            <button
              key={t.clave}
              type="button"
              className={filtros.tramo === t.clave ? 'on' : undefined}
              aria-pressed={filtros.tramo === t.clave}
              onClick={() => alFiltrar({ tramo: t.clave })}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <span className="fb-div" />
        <span className="tb-lab">Etapa</span>
        <div className="db-seg" role="group" aria-label="Etapa">
          {ETAPAS.map((e) => (
            <button
              key={e.clave}
              type="button"
              className={filtros.etapa === e.clave ? 'on' : undefined}
              aria-pressed={filtros.etapa === e.clave}
              onClick={() => alFiltrar({ etapa: e.clave })}
            >
              {e.rotulo}
            </button>
          ))}
        </div>
        <span className="lp-count" aria-live="polite">
          {contador({
            vistas: vistas.length,
            mostradas: Math.min(mostradas, vistas.length),
            cohorte: p.cohorte.total,
            filtros,
            truncado: p.truncado,
          })}
        </span>
      </div>

      <section className="lp-grid" aria-label="Contactos">
        {vistas.length === 0 ? (
          <p className="lp-vacio lp-vacio-rejilla">
            {porQueVacia({
              filtros,
              asistenciasRegistradas,
              sinRegistrar: p.todos.sinRegistrar,
              hayVentasRegistradas: p.hayVentasRegistradas,
              truncado: p.truncado,
            })}
          </p>
        ) : (
          vistas.slice(0, mostradas).map((l) => <Persona key={l.id} l={l} alAbrir={alAbrir} />)
        )}
      </section>

      {vistas.length > mostradas ? (
        <button type="button" className="lp-mas" onClick={alMostrarMas}>
          Mostrar {Math.min(DE_A, vistas.length - mostradas)} más
        </button>
      ) : null}

      <Huecos h={p.huecos} />
    </>
  );
}

/** Lo que la pantalla dice de sí misma, ANTES de las cifras: la frescura y el aviso de la cohorte. */
function Avisos({ p }) {
  const frescura = [p.frescura?.contactos?.aviso, p.frescura?.citas?.aviso].filter(Boolean);
  const avisos = [...frescura, p.cohorte.avisoDeLaVentana, p.aviso].filter(Boolean);
  const ultima = p.cohorte.total === 0 && p.cohorte.ultimaAlta ? `El último contacto entró el ${fechaCorta(p.cohorte.ultimaAlta)}.` : null;
  if (avisos.length === 0 && !ultima) return null;
  return (
    <div className="lp-avisos" role="note">
      {avisos.map((a) => (
        <p key={a} className="lp-aviso">{a}</p>
      ))}
      {ultima ? <p className="lp-aviso">{ultima}</p> : null}
    </div>
  );
}

/** Una tarjeta de tramo, o «Todos». Es un botón de verdad: se alcanza con el teclado y dice si está apretado. */
function Tarjeta({ t, encendida, alTocar, parte = null }) {
  const esTodos = t.clave === 'todos';
  return (
    <button
      type="button"
      className={encendida ? 'icpc on' : 'icpc'}
      aria-pressed={encendida}
      data-tramo={t.clave}
      onClick={alTocar}
    >
      <span className="ih">
        <span className="idot" data-tramo={t.clave} />
        {t.rotulo}
      </span>
      <span className="iv">{miles(t.contactos)}</span>
      <span className="is">
        {esTodos
          ? `${miles(t.vendidos)} vendidos · ${miles(t.agendados)} agendados`
          : `${porcentaje(t.porcion)} del total · ${miles(t.agendados)} agendados`}
      </span>
      {parte ? (
        <span className="lp-parte">
          sin puntaje {miles(parte.sinPuntaje)} · en 0 {miles(parte.enCero)}
        </span>
      ) : null}
      <span className="ib">
        <i data-tramo={t.clave} style={{ width: `${Math.round((esTodos ? (t.contactos > 0 ? 1 : 0) : t.porcion ?? 0) * 100)}%` }} />
      </span>
      <span className="im">
        <span title={t.porQueSinCierre ? POR_QUE[t.porQueSinCierre] : undefined}>
          Cierre <b>{porcentaje(t.cierre)}</b>
        </span>
        <span title={t.porQueSinMonto ? POR_QUE[t.porQueSinMonto] : undefined}>
          Monto reportado <b>{t.montoReportado === null ? '—' : `$${miles(t.montoReportado)}`}</b>
        </span>
      </span>
    </button>
  );
}

/** La clase de color de la maqueta para cada tramo. `nc` era «Sin calificar» allá. */
const CLASE = { alto: 'seg-alto', medio: 'seg-medio', bajo: 'seg-bajo', sin_calificar: 'seg-nc' };

const CITA = { agendo: 'agendó', solo_congeladas: 'sólo citas congeladas', sin_cita: 'sin cita' };

/**
 * Una persona. Tres estados por paso, no dos: con dos, 77 personas con una cita que ya ocurrió y sin
 * registro se leerían «no asistió», y lo cierto es que nadie lo cargó (medido el 2026-09-27).
 */
function Persona({ l, alAbrir }) {
  const agendo =
    l.cita === 'agendo' ? ['on', 'agendó'] : l.cita === 'solo_congeladas' ? ['duda', 'tuvo cita, ya no se refresca'] : ['', 'sin cita'];
  const asistio =
    l.asistencia === 'asistio'
      ? ['on', 'asistió']
      : l.asistencia === 'no_asistio'
        ? ['no', 'no asistió']
        : l.asistencia === 'sin_registrar'
          ? ['duda', 'nadie registró si asistió']
          : ['', 'no aplica: no hubo una cita que ya debiera haber ocurrido'];
  const vendio = l.vendio ? ['on', 'vendió'] : ['', 'sin venta registrada'];

  return (
    <button type="button" className={`lc ${CLASE[l.tramo] ?? 'seg-nc'}`} onClick={(e) => alAbrir(l.id, e.currentTarget)}>
      <span className="lc-top">
        <span className="lc-id">
          <span className="lc-name">{l.nombre}</span>
          <span className="lc-src">
            {l.campana ?? '—'} · {l.creativo ?? '—'}
          </span>
          <span className="lp-alta">Entró el {fechaCorta(l.altaEl)}</span>
        </span>
        <span className="lc-score">
          <span className="sc-v">{l.puntaje === null ? '—' : l.puntaje}</span>
          <span className="sc-l">{rotuloDelTramo(l.tramo)}</span>
        </span>
      </span>
      {l.descartado || l.territorio === 'congelado' || l.planton ? (
        <span className="lp-marcas">
          {l.descartado ? <span className="lp-marca lp-marca-descarte">descartado</span> : null}
          {l.territorio === 'congelado' ? <span className="lp-marca">congelado</span> : null}
          {l.planton ? <span className="lp-marca">plantón según el calendario</span> : null}
        </span>
      ) : null}
      <span className="lc-money">
        {l.vendio ? (
          <>
            <span className={l.monto === null ? 'lc-mv zero' : 'lc-mv'}>{l.monto === null ? '—' : `$${miles(l.monto)}`}</span>
            <span className="lc-ml">{l.monto === null ? 'venta sin monto' : 'reportado'}</span>
          </>
        ) : (
          <>
            <span className="lc-mv zero">—</span>
            <span className="lc-ml">{CITA[l.cita]}</span>
          </>
        )}
      </span>
      <span className="lc-foot">
        <span className="lc-prog">
          <i className={agendo[0] || undefined} title={agendo[1]}>Agendó</i>
          <b>›</b>
          <i className={asistio[0] || undefined} title={asistio[1]}>Asistió</i>
          <b>›</b>
          <i className={vendio[0] || undefined} title={vendio[1]}>Vendió</i>
        </span>
      </span>
    </button>
  );
}

/** Lo que la pantalla no puede decir, con su medición y su fecha. Lista vacía ⟹ no se dibuja. */
function Huecos({ h }) {
  if (!h || h.lista.length === 0) return null;
  return (
    <section className="lp-huecos" aria-label="Lo que esta pantalla no puede medir">
      <p className="lp-huecos-t">Lo que esta pantalla no puede medir, al {h.medidoEl}</p>
      {h.lista.map((x) => (
        <p key={x.punto} className="lp-hueco">
          <b>{x.punto}.</b> {x.porque}.
        </p>
      ))}
    </section>
  );
}
