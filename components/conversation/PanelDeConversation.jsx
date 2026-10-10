'use client';

/* El tablero de Conversation: el front del prototipo, con los datos reales (docs/conversation/01, CN-3).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LOS NÚMEROS LLEGAN HECHOS
 *
 * `aios-command-center_1.html:2865-2929` dibujaba esta pantalla con cifras escritas a mano y cuatro agentes con
 * nombre de persona. Acá se dibuja el MISMO marcado —`cre-head` con el selector de modos bajo el título, los tres
 * `.pn` de `cs-panels`, las dos `.csf` del modo Estado y las cuatro `.csa` del modo Agentes—, con las mismas clases
 * y en el mismo orden. Las reglas siguen siendo las de `app/aios.css`, que nadie toca (CN1-01); lo nuevo vive en
 * `app/conversation.css`.
 *
 * El navegador **no calcula nada**: las cifras, las tasas y las porciones llegan de `lecturaDeConversation`, de 0
 * a 1 (CN1-15). Acá se les da formato —se multiplica por 100 en un solo lugar, `cien` de `comun.jsx`— y se elige
 * la frase de cada hueco de la lista cerrada de CN1-02.
 *
 * ── LO QUE CAMBIA RESPECTO DEL PROTOTIPO, Y POR QUÉ ───────────────────────
 *
 *   · **Cuatro modos y no dos** (CN1-03, CN1-13): Estado y Agentes son el prototipo; Auditoría y Prompts son el
 *     supervisor de siempre, `Cuerpo` de `components/auditoria/PanelDeAuditoria.jsx`, dentro de un contenedor con
 *     la estética de operación, que es la que los viste. No cambian.
 *   · **El «Plan de acción» abre el plan real** de la pasada de la mañana (CN1-14). Sin «Personalizado», sin la
 *     clave `mes` y sin «vs los 7 días previos»: no hay flechas (CN1-04).
 *   · **Una cifra sin dato dice «—» y por qué**, debajo, con su frase. Un cero es un cero medido.
 *   · **Los rótulos que cambian están declarados** en CN1-02: «Contactos», «el grupo que agendó», «Conversaron
 *     antes», y la cifra grande de cada agente de texto, que es del flujo y no del agente.
 *   · **Sin cajones ni lista de correcciones** (CN1-11): «Qué corregir · {N} por resolver» lleva al modo Auditoría,
 *     donde vive el detalle por agente.
 *   · **Sin párrafos** (CN1-05): es un tablero. Los avisos, las notas de cada cifra y lo que falta para medir lo
 *     demás siguen viajando, y los da el agente de Conversation cuando se le pregunta.
 *   · **Ningún dato de una persona** (CN1-17): ni nombres, ni chats, ni frases.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { Cuerpo as Supervisor } from '../auditoria/PanelDeAuditoria.jsx';
import { BotonDelPlan } from '../senales/SenalesDelDepartamento.jsx';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { agruparPorPatron, leerLaPantalla } from '@/lib/auditor/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { usarPublicarComentario } from '../../lib/agentes/comentario-de-la-cabecera.ts';
import { AGENTE, FRASE, FRASE_DEL_MOTIVO, PASO, TRAMO, fechaCorta, miles, minutos, o, pf } from './comun.jsx';

/**
 * Los cuatro modos. Los dos primeros, con los iconos del prototipo (`#i-chat` y `#i-setter`); los del supervisor,
 * con los que tenían como pestañas.
 */
const MODOS = [
  { clave: 'estado', nombre: 'Estado', icono: '#i-chat' },
  { clave: 'agentes', nombre: 'Agentes', icono: '#i-setter' },
  { clave: 'auditoria', nombre: 'Auditoría', icono: '#i-auditor' },
  { clave: 'prompts', nombre: 'Prompts', icono: '#i-tools' },
];

/** Los dos modos del tablero: los que miden sobre una ventana y llevan el segmentado. */
const DEL_TABLERO = new Set(['estado', 'agentes']);

export default function PanelDeConversation() {
  const [modo, setModo] = useState(MODOS[0].clave);
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  // La caja del cerebro del pie pregunta con el período que se está mirando (`lib/agentes/periodos.ts`).
  useEffect(() => anunciarPeriodo('conversation', periodo), [periodo]);
  const [pantalla, setPantalla] = useState(null);
  // El comentario de la cabecera llega con la pantalla, y se le entrega a la cabecera (AG15, `04`, AG-78).
  usarPublicarComentario('conversation', pantalla ? (pantalla.comentario ?? null) : undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* Qué patrón está abierto en Auditoría. Se guarda el CÓDIGO y no un índice: la lista se reordena al recargar
     —el orden es por cantidad de casos— y con un índice quedaría abierto otro patrón. */
  const [abierto, setAbierto] = useState(null);

  /* Cuál es la última lectura pedida: sin esto, una respuesta que llega tarde pisa a la más nueva y deja el
     botón describiendo otra ventana. Es el arreglo de Acquisition (AQ-4), Conversion (CV-4) y Sales (SA-3). */
  const ultima = useRef(0);
  /* Si hay una carga primera en vuelo. Una recarga del reloj que entrara entonces la dejaría sin efecto —la primera
     se descarta por vieja— y quedaban «Cargando…» y el fallo a la vez, o las cifras de la ventana anterior. La
     recarga se salta: la primera ya trae lo nuevo. */
  const primeraEnVuelo = useRef(false);

  /**
   * Trae la pantalla. Teniendo datos, una recarga del reloj no la vacía nunca —ni las cifras ni el patrón abierto
   * de Auditoría— y si falla, conserva lo que había. El cambio de período va como carga PRIMERA porque las cifras
   * dibujadas son de otra ventana, y si falla, la pantalla queda vacía con el aviso.
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      if (esRecarga && primeraEnVuelo.current) return;
      const esta = ++ultima.current;
      if (!esRecarga) {
        primeraEnVuelo.current = true;
        setCargando(true);
      }
      const r = await leerLaPantalla(periodo);
      if (esta !== ultima.current) return;
      if (!esRecarga) primeraEnVuelo.current = false;
      if (r.tipo === 'datos') {
        setPantalla(r.pantalla);
        setError('');
      } else {
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

  /* Con `null` como clave el reloj no se registra: con Conversation cerrada esto no cuesta una petición. La
     cadencia es la de Inteligencia porque las fuentes —el alta del contacto, el barrido del calendario y la pasada
     del auditor— entran por el colector y no en vivo. */
  const aLaVista = estaALaVista('conversation');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'conversation:tic' : null, recargar, CADENCIA.inteligencia);

  /* Los patrones agrupados UNA vez, acá: los dibuja Auditoría. */
  const patrones = pantalla ? agruparPorPatron(pantalla.casos) : [];
  const tablero = DEL_TABLERO.has(modo);

  return (
    <>
      {/* El encabezado, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar, y con un error de red no
          quedaría ningún modo que apretar. */}
      <div className="cre-head">
        <div className="ch-l stack">
          <div className="ch-title">
            <h2>Conversation</h2>
            <span className="cre-desc">Dos misiones, cuatro agentes · agendar y hacer que asistan</span>
          </div>
          <Modos valor={modo} alElegir={setModo} />
        </div>
        <div className="ch-r">
          {/* El plan de la pasada de la mañana (CN1-14). Con «Hoy» y «Completo» dice que el plan es de 7 y 30 días. */}
          {pantalla ? <BotonDelPlan departamento="conversation" senales={pantalla.senales} /> : null}
          {/* El segmentado sólo en los dos modos que miden: las listas de Auditoría y Prompts no se acotan por
              ventana, y un control que no cambia nada enseña a no usarlo (CN1-03). */}
          {tablero ? (
            <div className="ch-period">
              {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. Mientras no hay datos manda
                  el local, que es lo único que hay. */}
              <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
            </div>
          ) : null}
        </div>
      </div>

      {tablero ? (
        <>
          {error ? (
            <p className="cs-falla" title={error}>
              {FRASE.fallo}
            </p>
          ) : null}
          {cargando && pantalla === null ? (
            <p className="cs-cargando">{FRASE.cargando}</p>
          ) : pantalla === null ? null : (
            /* La clave reinicia el cuerpo al cambiar de ventana, como en las otras pantallas del prototipo. */
            <Tablero key={pantalla.periodo} p={pantalla} modo={modo} alCorregir={() => setModo('auditoria')} />
          )}
        </>
      ) : (
        /* Auditoría y Prompts, como eran (CN1-13): la estética de operación los viste, y el contenedor la trae. */
        <div className="estetica-op cs-supervisor">
          <div className="cl-page">
            <Supervisor
              cargando={cargando}
              error={error}
              pantalla={pantalla}
              patrones={patrones}
              /* El panel entiende dos caras, `inicio` y `prompts`. «Auditoría» es su `inicio`. */
              sub={modo === 'prompts' ? 'prompts' : 'inicio'}
              abierto={abierto}
              alAbrir={(p) => setAbierto(abierto === p ? null : p)}
              alRecargar={cargar}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* El selector de modos del prototipo (`csMode`), con los dos del supervisor al final. */
function Modos({ valor, alElegir }) {
  return (
    <div className="mode-seg" role="group" aria-label="Modo">
      {MODOS.map((m) => (
        <button key={m.clave} type="button" className={valor === m.clave ? 'on' : undefined} aria-pressed={valor === m.clave} onClick={() => alElegir(m.clave)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <use href={m.icono} />
          </svg>
          {m.nombre}
        </button>
      ))}
    </div>
  );
}

/* El segmentado del prototipo (`csPeriod`), con los cuatro períodos del sistema, sin la clave `mes` y sin
   «Personalizado». Con el `title` de `PERIODOS`: acá «Hoy» son las últimas 24 horas, que es lo que dice (CN1-04). */
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

/** Los dos modos del tablero: los tres paneles arriba, el modo debajo y, al final, lo demás en cifras. */
function Tablero({ p, modo, alCorregir }) {
  const { paneles, leadFlow, appointmentFlow, agentes, porCorregir, cifras } = p.pantalla;
  return (
    <>
      <section className="cs-panels">
        <PanelDeLeadFlow c={paneles.leadFlow} desde={fechaCorta(p.respuesta.desde)} />
        <PanelDeAppointmentFlow c={paneles.appointmentFlow} kpi={appointmentFlow.kpi} desde={fechaCorta(p.cancelacion.desde)} />
        <PanelDelIcp icp={paneles.icp} />
      </section>
      {modo === 'estado' ? (
        <div className="cs-view">
          <div className="ghead">
            <span className="gdot cs-gdot-flujos" />
            <span className="gt">Los dos flujos</span>
            <span className="gsub">cada uno con su propia misión y su cadena</span>
          </div>
          <div className="cs-flows">
            <TarjetaDeLeadFlow f={leadFlow} />
            <TarjetaDeAppointmentFlow f={appointmentFlow} />
          </div>
        </div>
      ) : (
        <div className="cs-view">
          <QueCorregir n={porCorregir} noAudita={p.noAudita} alCorregir={alCorregir} />
          <div className="ghead">
            <span className="gdot cs-gdot-agentes" />
            <span className="gt">Los cuatro agentes</span>
            <span className="gsub">no todos convierten · cada uno se mide por su rol</span>
          </div>
          <div className="cs-agents">
            {agentes.map((a) => (
              <TarjetaDeAgente key={a.clave} a={a} />
            ))}
          </div>
        </div>
      )}
      <LoDemas c={cifras} />
    </>
  );
}

/** La frase de una cifra sin valor, o nada. */
const motivo = (c) => (c.valor === null ? (FRASE_DEL_MOTIVO[c.motivo] ?? null) : null);

/**
 * Una celda de un panel, como el `pair` del prototipo: el rótulo, la cifra con su tasa al lado y, donde el
 * prototipo ponía la flecha, una sola línea: la frase del «—» (CN1-05).
 */
function Par({ rotulo, valor, tasa = null, debajo = null }) {
  return (
    <div className="pn-c">
      <div className="pn-k">{rotulo}</div>
      <div className="pn-r">
        <span className="pn-v">{valor}</span>
        {tasa ? <span className="pn-rt">{tasa}</span> : null}
      </div>
      <div className="pn-d">{debajo ? <span className="cs-motivo">{debajo}</span> : null}</div>
    </div>
  );
}

/**
 * «Contactos» y «Agendó» (CN1-06): la cohorte de la ventana y quienes agendaron, con el booking rate. Debajo de los
 * contactos, desde cuándo hay datos: el primero de la ventana, no el comienzo pedido.
 */
function PanelDeLeadFlow({ c, desde }) {
  return (
    <div className="pn">
      <div className="pn-h">
        Lead Flow <em>que agende quien no lo hizo solo</em>
      </div>
      <div className="pn-b">
        <Par rotulo="Contactos" valor={miles(c.contactos.valor)} debajo={c.contactos.valor === 0 ? FRASE.sinContactos : desde ? `desde el ${desde}` : null} />
        <Par
          rotulo="Agendó"
          valor={o(c.agendaron.valor, miles)}
          tasa={c.bookingRate.valor === null ? null : pf(c.bookingRate.valor)}
          debajo={motivo(c.agendaron) ?? motivo(c.bookingRate)}
        />
      </div>
    </div>
  );
}

/** «Citas totales» y «Asistieron» (CN1-07), con la tasa de asistencia al lado y, debajo de las citas, desde cuándo. */
function PanelDeAppointmentFlow({ c, kpi, desde }) {
  return (
    <div className="pn hi">
      <div className="pn-h">
        Appointment Flow <em>sostiene todas las citas</em>
      </div>
      <div className="pn-b">
        <Par rotulo="Citas totales" valor={miles(c.citas.valor)} debajo={c.citas.valor === 0 ? FRASE.sinCitas : desde ? `desde el ${desde}` : null} />
        <Par
          rotulo="Asistieron"
          valor={o(c.asistieron.valor, miles)}
          tasa={kpi.valor === null ? null : pf(kpi.valor)}
          debajo={motivo(c.asistieron) ?? motivo(kpi)}
        />
      </div>
    </div>
  );
}

/**
 * «De qué está hecho el grupo que agendó» (CN1-08): quienes agendaron y los tres tramos del prototipo, cada uno con
 * su porción. Los sin calificar van en el rótulo del panel, donde el prototipo decía cuánto era calificado.
 */
function PanelDelIcp({ icp }) {
  const tramo = Object.fromEntries(icp.tramos.map((t) => [t.clave, t]));
  const sinCalificar = tramo.sin_calificar.n;
  return (
    <div className="pn">
      <div className="pn-h">
        De qué está hecho el grupo que agendó {sinCalificar > 0 ? <em>{`${miles(sinCalificar)} sin calificar`}</em> : null}
      </div>
      <div className="pn-b q4">
        <Par rotulo="Agendaron" valor={miles(icp.agendaron)} debajo={icp.agendaron === 0 ? FRASE.sinContactos : null} />
        {['alto', 'medio', 'bajo'].map((clave) => (
          <Par key={clave} rotulo={TRAMO[clave]} valor={miles(tramo[clave].n)} tasa={tramo[clave].porcion === null ? null : pf(tramo[clave].porcion)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Un paso de una cadena, como el `csr` del prototipo: el rótulo, el conteo, la barra y la porción. Sin conteo —el
 * paso de la landing, la asistencia que nadie marca— la frase ocupa el lugar de la barra; sin porción, «—» y la
 * frase en el `title`.
 */
function Eslabon({ paso }) {
  const sinValor = motivo(paso.valor);
  const sinPorcion = motivo(paso.porcion);
  return (
    <div className="csr">
      <span className="csr-n">{PASO[paso.clave]}</span>
      <span className="csr-v">{o(paso.valor.valor, miles)}</span>
      {sinValor ? (
        <span className="cs-motivo">{sinValor}</span>
      ) : (
        <span className="csr-b">
          <i style={{ width: paso.porcion.valor === null ? 0 : pf(paso.porcion.valor) }} />
        </span>
      )}
      <span className="csr-p" title={sinPorcion ?? undefined}>
        {o(paso.porcion.valor, pf)}
      </span>
    </div>
  );
}

/** Una fila de un bloque menor de la tarjeta (`org-r`): el rótulo, el conteo, la barra y la porción. */
function Fila({ rotulo, paso, clase }) {
  const sinPorcion = motivo(paso.porcion);
  return (
    <div className="org-r">
      <span className="org-n">{rotulo}</span>
      <span className="org-v">{o(paso.valor.valor, miles)}</span>
      <span className="org-b">
        <i className={clase} style={{ width: paso.porcion.valor === null ? 0 : pf(paso.porcion.valor) }} />
      </span>
      <span className="org-p" title={sinPorcion ?? undefined}>
        {o(paso.porcion.valor, pf)}
      </span>
    </div>
  );
}

/** La cifra clave de una tarjeta de flujo, con su rótulo y, sin valor, su frase debajo. */
function Clave({ c, rotulo }) {
  return (
    <div className="csf-key">
      <b>{o(c.valor, pf)}</b>
      <span>{rotulo}</span>
      {motivo(c) ? <span className="cs-motivo">{motivo(c)}</span> : null}
    </div>
  );
}

/** La tarjeta de Lead Flow (CN1-09): el booking rate y la cadena, con el paso de la landing en «—». */
function TarjetaDeLeadFlow({ f }) {
  return (
    <div className="csf">
      <div className="csf-h cs-cabeza">
        <div>
          <div className="csf-t">Lead Flow</div>
          <div className="csf-m">Que agende quien no lo hizo solo</div>
        </div>
        <Clave c={f.kpi} rotulo="contacto a agenda" />
      </div>
      <div className="csf-chain">
        {f.cadena.map((paso) => (
          <Eslabon key={paso.clave} paso={paso} />
        ))}
      </div>
    </div>
  );
}

/**
 * La tarjeta de Appointment Flow (CN1-10): la asistencia, la cadena y los tres bloques del prototipo —las salidas
 * antes de la llamada, la asistencia por calidad y de dónde viene la cita—.
 */
function TarjetaDeAppointmentFlow({ f }) {
  return (
    <div className="csf">
      <div className="csf-h cs-cabeza">
        <div>
          <div className="csf-t">Appointment Flow</div>
          <div className="csf-m">Que asista · todas las citas, vengan de donde vengan</div>
        </div>
        <Clave c={f.kpi} rotulo="agenda a asistencia" />
      </div>
      <div className="csf-chain">
        {f.cadena.map((paso) => (
          <Eslabon key={paso.clave} paso={paso} />
        ))}
        <div className="org-split">
          <div className="org-h">Salidas antes de la llamada</div>
          <Fila rotulo={PASO.reprogramaron} paso={f.salidas.reprogramaron} clase="cs-reprogramaron" />
          <Fila rotulo={PASO.cancelaron} paso={f.salidas.cancelaron} clase="cs-cancelaron" />
        </div>
        <Calidad filas={f.calidad} />
        <div className="org-split">
          <div className="org-h">De dónde viene la cita</div>
          <Fila rotulo="Conversaron antes" paso={f.origen.conversaronAntes} />
          <Fila rotulo="Se agendaron solos" paso={f.origen.solos} />
        </div>
      </div>
    </div>
  );
}

/**
 * La asistencia por calidad: la tasa de cada tramo. Mientras ningún tramo tiene valor y por el mismo motivo —nadie
 * marca la asistencia—, una sola línea con la frase y no cuatro iguales.
 */
function Calidad({ filas }) {
  const motivos = new Set(filas.map((t) => (t.asistencia.valor === null ? t.asistencia.motivo : 'con_valor')));
  const comun = motivos.size === 1 && !motivos.has('con_valor') ? (FRASE_DEL_MOTIVO[filas[0].asistencia.motivo] ?? null) : null;
  return (
    <div className="org-split">
      <div className="org-h">
        Tasa de asistencia por calidad <em>· de cada nivel agendado</em>
      </div>
      {comun ? (
        <p className="cs-motivo cs-motivo-solo">{comun}</p>
      ) : (
        filas.map((t) => (
          <div className="org-r" key={t.clave}>
            <span className="org-n">{TRAMO[t.clave]}</span>
            <span className="org-v" title={motivo(t.asistencia) ?? undefined}>
              {o(t.asistencia.valor, pf)}
            </span>
            <span className="org-b">
              <i style={{ width: t.asistencia.valor === null ? 0 : pf(t.asistencia.valor) }} />
            </span>
            <span className="org-p" />
          </div>
        ))
      )}
    </div>
  );
}

/**
 * «Qué corregir · {N} por resolver» (CN1-11): los hallazgos abiertos del auditor, sobre las tarjetas, y el número
 * lleva al modo Auditoría. Sin auditoría no hay hallazgos que contar: lo dice con su frase.
 */
function QueCorregir({ n, noAudita, alCorregir }) {
  return (
    <div className="ghead bad">
      <span className="gdot" />
      <span className="gt">Qué corregir</span>
      <span className="gsub">prompts y conversaciones marcadas</span>
      {noAudita ? (
        <span className="gn">{FRASE.noAudita}</span>
      ) : (
        <button type="button" className="gn cs-ir" onClick={alCorregir}>
          {`${miles(n)} por resolver`}
        </button>
      )}
    </div>
  );
}

/**
 * Una tarjeta de agente (CN1-11), como la `csa` del prototipo: el canal, el flujo, el rol, la cifra grande, los
 * conteos del flujo y el sentimiento. Las de voz, en «—» con su frase. No abren cajón: el detalle vive en Auditoría.
 */
function TarjetaDeAgente({ a }) {
  const d = AGENTE[a.clave];
  return (
    <div className="csa">
      <div className="csa-h">
        <span className={`csa-ch ${d.canal}`}>{d.canal === 'voz' ? 'Voz' : 'Texto'}</span>
        <span className="csa-n">{d.flujo}</span>
      </div>
      <div className="csa-role">{d.rol}</div>
      <div className="csa-v">
        <b>{o(a.cifra.valor, pf)}</b>
        <span>{a.cifra.valor === null ? motivo(a.cifra) : d.cifra}</span>
      </div>
      <div className="csa-mx">
        {a.desglose.map((x, i) => (
          <div className={i === 0 ? 'csa-r good' : 'csa-r'} key={x.clave}>
            <span>{PASO[x.clave]}</span>
            <b>{miles(x.n)}</b>
          </div>
        ))}
      </div>
      <div className="csa-sent">
        <div className="csa-sl">
          <span>Sentimiento</span>
          <b>{a.sentimiento === null ? FRASE.guion : `${pf(a.sentimiento.molesto)} molesto`}</b>
        </div>
        {/* Sin sentimiento, su frase; la de un agente de voz ya está arriba, en la cifra grande. */}
        {a.sentimiento === null ? (
          a.motivoDelSentimiento === 'sin_llamadas' ? null : (
            <span className="cs-motivo">{FRASE_DEL_MOTIVO[a.motivoDelSentimiento] ?? null}</span>
          )
        ) : (
          <div className="sent-bar">
            <i className="p" style={{ width: pf(a.sentimiento.positivo) }} />
            <i className="n" style={{ width: pf(a.sentimiento.neutral) }} />
            <i className="g" style={{ width: pf(a.sentimiento.molesto) }} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Lo demás, en cifras (CN1-12): lo que la pantalla de antes medía y el prototipo no tenía, con el vocabulario de
 * los paneles. La respuesta es una mediana: bajo el piso dice que hay pocos casos para una mediana.
 */
function LoDemas({ c }) {
  const respuesta = c.respuesta.valor === null && c.respuesta.motivo === 'bajo_el_piso' ? FRASE.pocosParaMediana : motivo(c.respuesta);
  return (
    <div className="pn">
      <div className="pn-h">Lo demás, en cifras</div>
      <div className="pn-b cs-cuatro">
        <Par rotulo="Primera respuesta" valor={o(c.respuesta.valor, minutos)} debajo={respuesta} />
        <Par rotulo="Entraron fuera de horario" valor={o(c.fueraDeHorario.valor, pf)} debajo={motivo(c.fueraDeHorario)} />
        <Par rotulo="Precall registrado" valor={o(c.precall.valor, pf)} debajo={motivo(c.precall)} />
        <Par rotulo="Molestos" valor={o(c.molestos.valor, pf)} debajo={motivo(c.molestos)} />
      </div>
    </div>
  );
}
