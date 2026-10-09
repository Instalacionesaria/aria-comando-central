'use client';

/* El tablero de Sales: el front del prototipo, con los datos reales (docs/sales/15, SA-3).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LOS NÚMEROS LLEGAN HECHOS
 *
 * `aios-command-center_1.html:2931-2995` dibujaba esta pantalla con cifras escritas a mano: cuatro tarjetas,
 * la tabla de closers y los motivos de no venta, 23 valores que cerraban entre sí y no salían de ninguna tabla
 * (`docs/sales/03-LOS-CUATRO-KPI.md`). Acá se dibuja el MISMO marcado —`cre-head`, `grid-4` con cuatro `card`
 * de `stat`, la tarjeta «Closers» con `col-head` y `row-i`, y la de «Motivos de no venta» con `mini-bar`—, con
 * las mismas clases y en el mismo orden. Las reglas siguen siendo las de `app/aios.css`, que nadie toca
 * (S15-01); lo nuevo vive en `app/sales.css`.
 *
 * El navegador **no calcula nada**: las cifras, las tasas y las porciones llegan de `lecturaDeSales`, de 0 a 1
 * (S15-13). Acá se les da formato —se multiplica por 100 en un solo lugar, `cien` de `comun.jsx`— y se elige la
 * frase de cada hueco de la lista cerrada de S15-02.
 *
 * ── LO QUE CAMBIA RESPECTO DEL PROTOTIPO, Y POR QUÉ ───────────────────────
 *
 *   · **Sin «Plan de acción» ni «Personalizado»** (S15-03): Sales no tiene detector, y el botón no abría
 *     nada; el rango libre daría ventanas que ninguna otra pantalla reproduce. El segmentado tiene los cuatro
 *     períodos del sistema, rodantes (S15-04).
 *   · **Una cifra sin dato dice «—» y por qué**, debajo, con su frase: nadie marca la asistencia, nadie
 *     registró en la ventana o hay pocos intentos para una tasa. Un cero es un cero medido (S15-05 a S15-08).
 *   · **La tabla no ordena a nadie** (S15-09): las filas son las de los closers configurados, en el orden en que
 *     se los designó, y la subfila dice cuántos contactos les asigna el CRM —la asignación por ICP del
 *     prototipo no existe—.
 *   · **Los motivos son los del catálogo de Avanzar** (S15-11), y lo que no casa va en su propia fila.
 *   · **Debajo, la cadena comercial** (S15-12): lo que la pantalla anterior medía y el prototipo no tenía, en
 *     una tarjeta más con el mismo vocabulario.
 *   · **Ningún dato de un contacto** (S15-15): ni nombres de prospectos ni el texto libre de un resultado.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerSales } from '@/lib/negocio/vistaDeSales';
import { FRASE, FRASE_DEL_MOTIVO, cien, miles, o, pf, plata } from './comun.jsx';

export default function PanelDeSales() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  // La caja del cerebro del pie pregunta con el período que se está mirando (`lib/agentes/periodos.ts`).
  useEffect(() => anunciarPeriodo('sales', periodo), [periodo]);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  /* Cuál es la última lectura pedida: sin esto, una respuesta que llega tarde pisa a la más nueva y deja el
     botón describiendo otra ventana. Es el arreglo de Acquisition (AQ-4) y de Conversion (CV-4). */
  const ultima = useRef(0);
  /* Si hay una carga primera en vuelo. Una recarga del reloj que entrara entonces la dejaría sin efecto —la primera
     se descarta por vieja— y quedaban «Cargando…» y el fallo a la vez, o las cifras de la ventana anterior. La
     recarga se salta: la primera ya trae lo nuevo. */
  const primeraEnVuelo = useRef(false);

  /**
   * Trae la pantalla. Una recarga del reloj que falla conserva lo que había; el cambio de período va como
   * carga PRIMERA porque las cifras dibujadas son de otra ventana, y si falla, la pantalla queda vacía con
   * el aviso.
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      if (esRecarga && primeraEnVuelo.current) return;
      const esta = ++ultima.current;
      if (!esRecarga) {
        primeraEnVuelo.current = true;
        setCargando(true);
      }
      const r = await leerSales(periodo);
      if (esta !== ultima.current) return;
      if (!esRecarga) primeraEnVuelo.current = false;
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

  /* Con `null` como clave el reloj no se registra: con Sales cerrada esto no cuesta una petición. La cadencia es
     la de Inteligencia porque las fuentes son el alta del contacto y el barrido del calendario, que entran por
     el colector y no en vivo. */
  const aLaVista = estaALaVista('sales');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'sales:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      <div className="cre-head">
        <div className="ch-l">
          <h2>Sales</h2>
          <span className="cre-desc">Cierre, closers y motivos de pérdida</span>
        </div>
        <div className="ch-r">
          <div className="ch-period">
            {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. Mientras no hay datos
                manda el local, que es lo único que hay. */}
            <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
          </div>
        </div>
      </div>

      {error ? (
        <p className="sl-falla" title={error}>
          {FRASE.fallo}
        </p>
      ) : null}

      {cargando && pantalla === null ? (
        <p className="sl-cargando">{FRASE.cargando}</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana, como en las otras pantallas del prototipo. */
        <Cuerpo key={pantalla.periodo} p={pantalla} />
      )}
    </>
  );
}

/* El segmentado del prototipo (`slPeriod`), con los cuatro períodos del sistema, sin la clave `mes` y sin
   «Personalizado». Con el `title` de `PERIODOS`: acá «Hoy» son las últimas 24 horas, que es lo que dice (S15-04). */
function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg" role="group" aria-label="Período">
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

function Cuerpo({ p }) {
  const { cifras, closers, motivos, comercial } = p.pantalla;
  return (
    <>
      <div className="grid-4">
        <Cifra rotulo="Asistencias" c={cifras.asistencias} formato={miles} />
        <Cifra rotulo="Tasa de cierre" c={cifras.tasaDeCierre} formato={pf} />
        <Cifra rotulo="Ventas" c={cifras.ventas} formato={miles} />
        <Cifra rotulo="Revenue reportado" c={cifras.revenue} formato={plata} esRevenue />
      </div>
      <Closers t={closers} />
      <Motivos m={motivos} />
      <LaCadenaComercial c={comercial} cadena={p.cadena} dinero={p.dinero} ventanas={p.ventanas} />
    </>
  );
}

/**
 * Una de las cuatro cifras de arriba (S15-05 a S15-08). Sin valor, «—» y debajo su motivo; el revenue lleva
 * debajo «reportado por el closer», porque no es un pago verificado. El color del revenue es el del prototipo,
 * por una clase y no en línea.
 */
function Cifra({ rotulo, c, formato, esRevenue = false }) {
  const debajo = c.valor === null ? (FRASE_DEL_MOTIVO[c.motivo] ?? null) : esRevenue ? FRASE.reportado : null;
  return (
    <div className="card">
      <div className="card-body stat">
        <div className="s-l">{rotulo}</div>
        <div className={esRevenue && c.valor !== null ? 's-v sl-rev' : 's-v'}>{o(c.valor, formato)}</div>
        {debajo ? <div className="sl-motivo">{debajo}</div> : null}
      </div>
    </div>
  );
}

/** Una celda numérica de la tabla. Sin valor, «—», y el motivo en el `title`: la celda no tiene lugar para la frase. */
function Celda({ c, formato, clase = 'num' }) {
  const motivo = c.valor === null ? (FRASE_DEL_MOTIVO[c.motivo] ?? undefined) : undefined;
  return (
    <div className={clase} title={motivo} aria-label={motivo === undefined ? undefined : `${FRASE.guion} ${motivo}`}>
      {o(c.valor, formato)}
    </div>
  );
}

/**
 * La tarjeta «Closers» (S15-09): las seis columnas del prototipo, una fila por closer configurado, sin ranking.
 * Agendadas y Asistieron son citas del CRM; Ventas, Cierre y Revenue, lo que la persona registró. La nota de la
 * tabla, que escribe el servidor, lo dice; la de cada fila va en el `title` del nombre.
 */
function Closers({ t }) {
  return (
    <div className="card">
      <div className="card-head">Closers</div>
      {t.filas.length === 0 ? (
        <p className="sl-vacio">{FRASE.sinClosers}</p>
      ) : (
        <div className="sl-desliza">
          <div className="col-head sl-closers">
            <span>Closer</span>
            <span>Agendadas</span>
            <span>Asistieron</span>
            <span>Ventas</span>
            <span>Cierre</span>
            <span>Revenue</span>
          </div>
          <div className="rows">
            {t.filas.map((f) => (
              <div className="row-i sl-closers" key={f.usuarioId}>
                <div title={f.aviso ?? undefined}>
                  <div className="rn">{f.nombre}</div>
                  <div className="rs">{f.contactos === null ? FRASE.sinDato : `${miles(f.contactos)} contactos asignados`}</div>
                </div>
                <div className="num">{o(f.agendadas, miles)}</div>
                <Celda c={f.asistieron} formato={miles} />
                <Celda c={f.ventas} formato={miles} />
                <Celda c={f.cierre} formato={pf} />
                <Celda c={f.revenue} formato={plata} clase="num rev" />
              </div>
            ))}
          </div>
        </div>
      )}
      {t.aviso ? <p className="sl-aviso">{t.aviso}</p> : null}
    </div>
  );
}

/**
 * La tarjeta «Motivos de no venta» (S15-10 y S15-11): los «No le interesa» de los closers, por el catálogo de
 * Avanzar y en su orden, con la barra de cada uno sobre el total. Lo que no casa con el catálogo va en su propia
 * fila, con el otro color, y su texto no viaja.
 */
function Motivos({ m }) {
  return (
    <div className="card">
      <div className="card-head">
        Motivos de no venta <span className="hint">{`${miles(m.sinVenta)} sin venta`}</span>
      </div>
      {m.total === 0 ? (
        <p className="sl-vacio">{FRASE.sinMotivos}</p>
      ) : (
        <div className="rows">
          {m.filas.map((f) => (
            <FilaDeMotivo key={f.motivo} nombre={f.motivo} n={f.resultados} porcion={f.porcion} clase="sl-catalogo" />
          ))}
          {m.fueraDelCatalogo > 0 ? (
            <FilaDeMotivo nombre={FRASE.fueraDelCatalogo} n={m.fueraDelCatalogo} porcion={m.porcionFueraDelCatalogo} clase="sl-fuera" />
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilaDeMotivo({ nombre, n, porcion, clase }) {
  return (
    <div className="row-i sl-motivos">
      <div className="rn">{nombre}</div>
      <div className="num">{miles(n)}</div>
      <div className="mini-bar">
        <i className={clase} style={{ width: `${cien(porcion)}%` }} />
      </div>
    </div>
  );
}

/**
 * Lo que la pantalla anterior medía y el prototipo no tenía, en una tarjeta más con el mismo vocabulario
 * (S15-12): la cadena de cierre, la cancelación, el ciclo hasta la cita, el dinero del mes y la cobertura. Cada
 * sección dice qué población cuenta, con el texto de `ventanasDeSales.ts`, y lleva su aviso del servidor como
 * viene.
 */
function LaCadenaComercial({ c, cadena, dinero, ventanas }) {
  return (
    <div className="card">
      <div className="card-head">La cadena comercial</div>

      <Seccion titulo="Del contacto a la venta" que={ventanas.cohorte.que} />
      {cadena.cohorte === 0 ? (
        <p className="sl-vacio">{FRASE.sinContactos}</p>
      ) : (
        <div className="rows">
          {cadena.eslabones.map((e) => (
            <div className="row-i sl-eslabon" key={e.clave} title={e.que}>
              <div className="rn">{e.titulo}</div>
              <div className="num">{miles(e.contactos)}</div>
              <div className="mini-bar">
                <i className="sl-barra" style={{ width: `${cien(e.porcionDeLaCohorte ?? 0)}%` }} />
              </div>
              <div className="num">{o(e.porcionDeLaCohorte, pf)}</div>
            </div>
          ))}
        </div>
      )}
      {cadena.aviso ? <p className="sl-aviso">{cadena.aviso}</p> : null}

      <Seccion titulo="Cancelación" que={ventanas.citas.que} />
      <div className="rows">
        <Par nombre="Citas de la ventana" valor={miles(c.cancelacion.citas)} />
        <Par nombre="Canceladas" valor={miles(c.cancelacion.canceladas)} />
        <Par nombre="Tasa de cancelación" valor={o(c.cancelacion.tasa, pf)} />
      </div>
      {c.cancelacion.aviso ? <p className="sl-aviso">{c.cancelacion.aviso}</p> : null}

      <Seccion titulo="Del alta a la primera cita" que={ventanas.cohorte.que} />
      <div className="rows">
        <Par nombre="La mitad agenda antes de" valor={o(c.ciclo.p50, (d) => `${d} d`)} />
        <Par nombre="Uno de cada diez tarda más de" valor={o(c.ciclo.p90, (d) => `${d} d`)} />
        <Par nombre="Medido sobre" valor={`${miles(c.ciclo.cobertura.con)} de ${miles(c.ciclo.cobertura.sobre)}`} />
      </div>
      {c.ciclo.avisoDelTecho ? <p className="sl-aviso sl-grave">{c.ciclo.avisoDelTecho}</p> : null}
      {c.ciclo.aviso ? <p className="sl-aviso">{c.ciclo.aviso}</p> : null}

      {/* El único bloque que no obedece al segmentado: es del mes calendario, con su nombre (S15-12). */}
      <Seccion titulo={`Dinero de ${dinero.mes}`} que={ventanas.mes.que} />
      <div className="rows">
        <Par nombre="Cobrado" sub={FRASE.reportado} valor={o(dinero.cobrado.valor, plata)} />
        <Par nombre="Ventas registradas" valor={o(dinero.ventas.valor, miles)} />
        <Par nombre="Acuerdos sin pagar" valor={o(dinero.acuerdos.valor, miles)} />
      </div>
      {dinero.cobrado.falta ? <p className="sl-aviso">{dinero.cobrado.falta}</p> : null}

      <Seccion titulo="Cobertura" que="Cuánto cubren las cifras: una fila cuenta personas y la otra, citas." />
      <div className="rows">
        <Proporcion nombre="Contactos con fecha de alta" p={c.cobertura.cohorte} />
        <Proporcion nombre="Citas que caen en una fila de closer" p={c.cobertura.tabla} />
      </div>
    </div>
  );
}

function Seccion({ titulo, que }) {
  return (
    <div className="sl-sec">
      <span className="sl-sec-t">{titulo}</span>
      <span className="sl-sec-m">{que}</span>
    </div>
  );
}

function Par({ nombre, sub, valor }) {
  return (
    <div className="row-i sl-par">
      <div>
        <div className="rn">{nombre}</div>
        {sub ? <div className="rs">{sub}</div> : null}
      </div>
      <div className="num">{valor}</div>
    </div>
  );
}

function Proporcion({ nombre, p }) {
  return (
    <div className="row-i sl-eslabon">
      <div className="rn">{nombre}</div>
      <div className="num">{`${miles(p.con)} de ${miles(p.sobre)}`}</div>
      <div className="mini-bar">
        <i className="sl-barra" style={{ width: `${cien(p.porcion ?? 0)}%` }} />
      </div>
      <div className="num">{o(p.porcion, pf)}</div>
    </div>
  );
}
