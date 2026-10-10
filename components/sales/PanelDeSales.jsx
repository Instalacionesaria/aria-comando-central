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
 *   · **Los motivos salen de las llamadas HT sin cierre** (S15-19), por la categoría de sus objeciones, con el
 *     `hint` del prototipo: «{N} llamadas sin cierre».
 *   · **Debajo, la cadena comercial en cifras** (S15-20): lo que la pantalla anterior medía y el prototipo no
 *     tenía, con el vocabulario de las cuatro de arriba.
 *   · **Sin párrafos** (S15-18): es un tablero. Las notas de la tabla, los avisos y qué población cuenta cada
 *     ventana siguen viajando, y los da el agente de Sales cuando se le pregunta.
 *   · **Ningún dato de un contacto** (S15-15): ni nombres de prospectos ni el texto libre de un resultado.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerSales } from '@/lib/negocio/vistaDeSales';
import { ESLABON, FRASE, FRASE_DEL_MOTIVO, MOTIVO_DE_LA_CATEGORIA, cien, dias, miles, o, pf, pf1, plata } from './comun.jsx';

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
      <LaCadenaComercial c={comercial} cadena={p.cadena} dinero={p.dinero} sinClosers={closers.filas.length === 0} />
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
      <Stat rotulo={rotulo} valor={o(c.valor, formato)} debajo={debajo} rev={esRevenue && c.valor !== null} />
    </div>
  );
}

/** Una cifra del vocabulario del prototipo —`stat`, `s-l`, `s-v`— con, debajo, una sola línea corta (S15-18). */
function Stat({ rotulo, valor, debajo = null, rev = false }) {
  return (
    <div className="card-body stat">
      <div className="s-l">{rotulo}</div>
      <div className={rev ? 's-v sl-rev' : 's-v'}>{valor}</div>
      {debajo ? <div className="sl-motivo">{debajo}</div> : null}
    </div>
  );
}

/**
 * Una celda numérica de la tabla. Sin valor, «—», y el motivo en el `title` y en la etiqueta de la celda: no tiene
 * lugar para la frase, y la fila de cifras de arriba ya la dice. El color del revenue, sólo con un monto: un «—» va
 * como los demás.
 */
function Celda({ c, formato, rev = false }) {
  const motivo = c.valor === null ? (FRASE_DEL_MOTIVO[c.motivo] ?? undefined) : undefined;
  return (
    <div
      className={rev && c.valor !== null ? 'num rev' : 'num'}
      role="cell"
      title={motivo}
      aria-label={motivo === undefined ? undefined : `${FRASE.guion} ${motivo}`}
    >
      {o(c.valor, formato)}
    </div>
  );
}

/**
 * La tarjeta «Closers» (S15-09): las seis columnas del prototipo, una fila por closer configurado, sin ranking.
 * Agendadas y Asistieron son citas del CRM; Ventas, Cierre y Revenue, lo que la persona registró. La nota de la
 * tabla y la de cada fila no se dibujan (S15-18): las da el agente de Sales, que las recibe en `cierre_por_closer`.
 */
function Closers({ t }) {
  return (
    <div className="card">
      <div className="card-head">Closers</div>
      {t.filas.length === 0 ? (
        <p className="sl-vacio">{FRASE.sinClosers}</p>
      ) : (
        <div className="sl-desliza" role="table" aria-label="Closers">
          <div className="col-head sl-closers" role="row">
            <span role="columnheader">Closer</span>
            <span role="columnheader">Agendadas</span>
            <span role="columnheader">Asistieron</span>
            <span role="columnheader">Ventas</span>
            <span role="columnheader">Cierre</span>
            <span role="columnheader">Revenue</span>
          </div>
          <div className="rows" role="rowgroup">
            {t.filas.map((f) => (
              <div className="row-i sl-closers" role="row" key={f.usuarioId}>
                <div role="cell">
                  <div className="rn">{f.nombre}</div>
                  <div className="rs">{f.contactos === null ? FRASE.sinDato : `${miles(f.contactos)} contactos asignados`}</div>
                </div>
                <div className="num" role="cell">
                  {o(f.agendadas, miles)}
                </div>
                <Celda c={f.asistieron} formato={miles} />
                <Celda c={f.ventas} formato={miles} />
                <Celda c={f.cierre} formato={pf} />
                <Celda c={f.revenue} formato={plata} rev />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La tarjeta «Motivos de no venta» (S15-19): las llamadas HT sin cierre de la ventana, por la categoría de sus
 * objeciones, de más a menos, con la barra de cada una sobre las llamadas sin cierre. Una llamada con dos categorías
 * cuenta en las dos. Las que no tienen ninguna clasificada van en su propia fila, con el otro color.
 */
function Motivos({ m }) {
  const hint = `${miles(m.sinCierre)} ${m.sinCierre === 1 ? 'llamada' : 'llamadas'} sin cierre`;
  return (
    <div className="card">
      <div className="card-head">
        Motivos de no venta <span className="hint">{hint}</span>
      </div>
      {m.sinCierre === 0 ? (
        <p className="sl-vacio">{FRASE.sinLlamadas}</p>
      ) : (
        <div className="rows">
          {m.filas.map((f) => (
            <FilaDeMotivo key={f.categoria} nombre={MOTIVO_DE_LA_CATEGORIA[f.categoria]} n={f.llamadas} porcion={f.porcion} clase="sl-catalogo" />
          ))}
          {m.sinObjecion > 0 ? (
            <FilaDeMotivo nombre={FRASE.sinObjecion} n={m.sinObjecion} porcion={m.porcionSinObjecion} clase="sl-fuera" />
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
 * La cadena comercial, en cifras (S15-20): los cinco eslabones, en contactos, con el porcentaje de la cohorte
 * debajo, y el cierre del período —la cancelación, los días hasta la cita y el cobrado del mes—. Sin descripciones
 * ni avisos: qué población cuenta cada una lo dice el agente de Sales (S15-18).
 */
function LaCadenaComercial({ c, cadena, dinero, sinClosers }) {
  const cobradoFalta = sinClosers ? FRASE.sinClosers : FRASE.sinRegistrosDelMes;
  return (
    <div className="card">
      <div className="card-head">La cadena comercial</div>
      <div className="sl-cifras sl-cinco">
        {cadena.eslabones.map((e, i) => (
          <Stat
            key={e.clave}
            rotulo={ESLABON[e.clave]}
            valor={miles(e.contactos)}
            debajo={e.porcionDeLaCohorte === null ? (i === 0 ? FRASE.sinContactos : null) : pf(e.porcionDeLaCohorte)}
          />
        ))}
      </div>
      <div className="sl-cifras sl-tres">
        <Stat rotulo="Cancelación" valor={o(c.cancelacion.tasa, pf1)} debajo={c.cancelacion.tasa === null ? FRASE.sinCitas : null} />
        <Stat rotulo="Días hasta la cita" valor={o(c.ciclo.p50, dias)} debajo={c.ciclo.p50 === null ? FRASE.pocosContactos : null} />
        <Stat
          rotulo={`Cobrado de ${dinero.mes}`}
          valor={o(dinero.cobrado.valor, plata)}
          debajo={dinero.cobrado.valor === null ? cobradoFalta : FRASE.reportado}
          rev={dinero.cobrado.valor !== null}
        />
      </div>
    </div>
  );
}
