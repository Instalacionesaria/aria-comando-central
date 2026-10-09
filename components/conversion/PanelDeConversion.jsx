'use client';

/* El tablero de Conversion: el front del prototipo, con los datos reales (docs/conversion/15, CV-4).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LOS NÚMEROS LLEGAN HECHOS
 *
 * `aios-command-center_1.html` dibujaba esta pantalla con plantillas de texto (`cvRenderStats`,
 * `cvRenderJourney`, `cvRenderLists`, líneas 4096-4264) sobre seis cifras inventadas multiplicadas por un
 * factor de período. Acá se dibuja el MISMO marcado —`cre-head`, `cs-panels cv-panels`, la nota, `ghead` y
 * `journey` con sus cinco `jstep`, y la alarma—, con las mismas clases y en el mismo orden. Las reglas siguen
 * siendo las de `app/aios.css`, que nadie toca (CV15-01); lo nuevo vive en `app/conversion.css`.
 *
 * El navegador **no calcula nada**: las tasas, las caídas y las variaciones con su lectura llegan de
 * `lecturaDeConversion` (CV15-22). Acá se les da formato —se multiplica por 100 en un solo lugar, `cien` de
 * `comun.jsx`— y se elige la frase de cada hueco de la lista cerrada de CV15-02, que vive en el mismo archivo.
 *
 * ── LO QUE CAMBIA RESPECTO DEL PROTOTIPO, Y POR QUÉ ───────────────────────
 *
 *   · **La unidad es la persona, no la visita**: no hay sesiones (CV15-05). Cada porcentaje es sobre los
 *     contactos de la ventana, y los rótulos que decían visitas o citas lo dicen en personas (los desvíos
 *     declarados de CV15-02).
 *   · **La caída «−N» se mide contra la cohorte**, no contra la tarjeta anterior: el camino no está anidado, y
 *     el 44 % agenda por el widget sin pasar por el formulario (CV15-16). Las flechas `.jarrow` quedan como
 *     decoración.
 *   · **Sin bandas, sin `#cvWorst`, sin dispositivo ni «Personalizado»** (CV15-03, CV15-11): sin un umbral
 *     medido, el contador diría «todos los pasos en rango» sobre pasos que no se midieron.
 *   · **VSL y Gracias son huecos**, en su lugar y sin cajón (CV15-13).
 *   · **Un solo chip, «GoHighLevel»**, con el punto encendido sólo si la lectura de contactos está al día.
 *   · **La alarma, sólo con señales críticas** (CV15-19). Hoy ninguna regla de Conversion lo es.
 *   · **Ningún dato de una persona** (CV15-24): ni la dirección de entrada ni el `referrer`, tampoco en un
 *     `title`, y sin los `data-leads` que abrían un cajón con personas inventadas.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerConversion } from '@/lib/negocio/vistaDeConversion';
import { useSesion } from '../../app/sesion-contexto.tsx';
import { BotonDelPlan, TarjetaDeSenales } from '../senales/SenalesDelDepartamento.jsx';
import { usarPublicarComentario } from '../../lib/agentes/comentario-de-la-cabecera.ts';
import CajonDelPaso from './CajonDelPaso.jsx';
import { CON_CAJON, CON_REGLAS, Delta, FRASE, METRICAS, PASOS, fechaCorta, miles, nf, o, pf, poner, rangoDe, senalesDelPaso } from './comun.jsx';

/* Por qué las vistas de Meta no se publican o no comparan, en la frase de la nota (CV15-07). */
const FRASE_DE_LAS_VISTAS = {
  colector_atrasado: FRASE.faltanDias,
  dias_sin_leer: FRASE.faltanDias,
  no_cuadra: FRASE.faltaGasto,
  sin_desglose: FRASE.sinDesglose,
};

export default function PanelDeConversion() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  // La caja del cerebro del pie pregunta con el período que se está mirando (`lib/agentes/periodos.ts`).
  useEffect(() => anunciarPeriodo('conversion', periodo), [periodo]);
  const [pantalla, setPantalla] = useState(null);
  // El comentario de la cabecera llega con la pantalla, y se le entrega a la cabecera (AG15, `04`, AG-78).
  usarPublicarComentario('conversion', pantalla ? (pantalla.comentario ?? null) : undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  /* Cuál es la última lectura pedida: sin esto, una respuesta que llega tarde pisa a la más nueva y deja el
     botón describiendo otra ventana. Es el arreglo de Acquisition (AQ-4). */
  const ultima = useRef(0);
  /* Si hay una carga primera en vuelo. Una recarga del reloj que entrara entonces la dejaría sin efecto —la primera
     se descarta por vieja— y, como la recarga no baja `cargando` ni vacía la pantalla, quedaban «Cargando…» y el
     fallo a la vez, o las cifras de la ventana anterior. La recarga se salta: la primera ya trae lo nuevo. */
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
      const r = await leerConversion(periodo);
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

  /* Con `null` como clave el reloj no se registra: con Conversion cerrada esto no cuesta una petición. La
     cadencia es la de Inteligencia porque la fuente es el alta del contacto en el CRM, que entra por el
     colector y no en vivo. */
  const aLaVista = estaALaVista('conversion');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'conversion:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      <div className="cre-head">
        <div className="ch-l">
          <h2>Conversion</h2>
          <span className="cre-desc">Dónde se pierde la gente entre el click y la cita</span>
          <span className="srcs">
            <Fuente f={pantalla?.frescura?.contactos ?? null} />
          </span>
        </div>
        <div className="ch-r">
          {/* El plan de la pasada de la mañana (AG14 de los agentes). Con «Hoy» y «Completo» dice que el plan
              es de 7 y 30 días, como en Acquisition. */}
          {pantalla ? <BotonDelPlan departamento="conversion" senales={pantalla.senales} /> : null}
          <div className="ch-period">
            {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. Mientras no hay datos
                manda el local, que es lo único que hay. */}
            <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
          </div>
        </div>
      </div>

      {error ? (
        <p className="cv-falla" title={error}>
          {FRASE.fallo}
        </p>
      ) : null}

      {cargando && pantalla === null ? (
        <p className="cv-cargando">{FRASE.cargando}</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana: sin ella, un cajón abierto sobrevive al cambio y
           queda describiendo otra ventana. */
        <Cuerpo key={pantalla.periodo} p={pantalla} alCambiar={recargar} />
      )}
    </>
  );
}

/**
 * El chip de la fuente (CV15-03). El punto `.dotx` es verde sólo con la lectura de contactos al día: un punto
 * verde fijo afirmaba una fuente viva sin comprobarlo. Si no, va apagado, y en el `title` va la frase que arma
 * el servidor, la misma de la cabecera del departamento.
 */
function Fuente({ f }) {
  const vivo = f?.estado === 'al_dia';
  return (
    <span className="src" title={vivo ? undefined : (f?.aviso ?? undefined)}>
      <span className={vivo ? 'dotx' : 'dotx apagado'} /> GoHighLevel
    </span>
  );
}

/* El segmentado del prototipo (`cvDateSeg`), con los cuatro períodos del sistema y sin «Personalizado».
   Sin el `title` de `PERIODOS`: el matiz de «Hoy» —«las últimas 24 horas»— es el de las otras pantallas, y
   acá «Hoy» es el día de calendario (CV15-04). */
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
  const sesion = useSesion();
  const [abierto, setAbierto] = useState(null);
  // Lo decide el servidor; mirando otra empresa, nada (AG-82).
  const puede = sesion?.mirandoOtraOrganizacion ? { resolver: false, validar: false, firmar: false } : p.puedeConSenales;
  const abrir = (clave) => (CON_CAJON.has(clave) ? setAbierto(clave) : undefined);

  return (
    <>
      <Tira c={p.pasos.cifras} conAnterior={p.pasos.anterior !== null} />
      <Nota p={p} />
      <div className="ghead">
        <span className="gdot cv-gdot" />
        <span className="gt">Recorrido</span>
        <span className="gsub">porcentajes sobre los contactos de la ventana · abre un paso para ver su evidencia</span>
      </div>
      <div className="journey">
        {PASOS.map((s, i) => (
          <Tarjeta
            key={s.k}
            s={s}
            primera={i === 0}
            paso={p.pasos.pasos.find((x) => x.clave === s.k)}
            senales={senalesDelPaso(p.senales, s.k)}
            conVentana={p.senales.ventana !== null}
            conAnterior={p.pasos.anterior !== null}
            alAbrir={() => abrir(s.k)}
          />
        ))}
      </div>
      <Alarma senales={p.senales} alAbrir={abrir} />
      <TarjetaDeSenales departamento="conversion" senales={p.senales} puede={puede} alCambiar={alCambiar} />
      {abierto ? <CajonDelPaso clave={abierto} p={p} alCerrar={() => setAbierto(null)} /> : null}
    </>
  );
}

/** Una celda de la tira (`pair`, línea 4103): rótulo, cifra con su tasa, y debajo la flecha o la frase. */
function Celda({ k, v, r = null, d = null }) {
  return (
    <div className="pn-c">
      <div className="pn-k">{k}</div>
      <div className="pn-r">
        <span className="pn-v">{v}</span>
        {r ? <span className="pn-rt">{r}</span> : null}
      </div>
      <div className="pn-d">{d}</div>
    </div>
  );
}

/** Lo que dice la celda y la tarjeta del formulario, según cómo cae la ventana contra el corte (CV15-14). */
function delFormulario(f) {
  if (f.corte === null) return { valor: FRASE.guion, tasa: null, frase: FRASE.sinDato };
  const corte = fechaCorta(f.corte);
  if (f.valor === null) return { valor: FRASE.guion, tasa: null, frase: poner(FRASE.sinDatoDesde, { corte }) };
  return { valor: nf(f.valor), tasa: o(f.tasa, pf), frase: poner(FRASE.hastaElCorte, { corte }) };
}

/**
 * Las tres tiras (`cvRenderStats`, línea 4096), con las celdas de CV15-06, CV15-08 y CV15-09. `conAnterior`: la
 * ventana compara, y la cifra que no lo hace lo dice (CV15-20).
 */
function Tira({ c, conAnterior }) {
  const form = delFormulario(c.formulario);
  return (
    <section className="cs-panels cv-panels">
      <div className="pn">
        <div className="pn-h">
          Landing y VSL <em>llegan y consumen</em>
        </div>
        <div className="pn-b q3">
          <Celda k="Contactos" v={nf(c.contactos.valor)} d={<Delta v={c.contactos.variacion} conAnterior={conAnterior} />} />
          <Celda
            k="Vistas de landing"
            v={o(c.vistas.valor, nf)}
            d={
              <>
                {/* Sin «sin comparación»: no entra junto a «según Meta», y el porqué lo dice la nota (CV15-07). */}
                <Delta v={c.vistas.variacion} /> <span className="cv-meta">{FRASE.deMeta}</span>
              </>
            }
          />
          <Celda k="Dan play al VSL" v={FRASE.guion} d={<span className="cv-meta">{FRASE.sinDato}</span>} />
        </div>
      </div>

      <div className="pn hi">
        <div className="pn-h">
          Formulario y cita <em>de contacto a agenda</em>
        </div>
        <div className="pn-b">
          {/* El formulario nunca lleva flecha: el campo murió el 2026-08-31 (CV15-14). */}
          <Celda k="Empiezan el form" v={form.valor} r={form.tasa} d={<span className="cv-meta">{form.frase}</span>} />
          <Celda
            k="Agendan"
            v={nf(c.agendados.valor)}
            r={o(c.agendados.tasa, pf)}
            d={<Delta v={c.agendados.variacionDeLaTasa} conAnterior={conAnterior} />}
          />
        </div>
      </div>

      <div className="pn">
        <div className="pn-h">
          Calidad de lo agendado <em>{o(c.calificados.deLaCohorte, pf)} de contacto a cita útil</em>
        </div>
        <div className="pn-b q3">
          <Celda k="Agendados" v={nf(c.agendados.valor)} d={<Delta v={c.agendados.variacion} conAnterior={conAnterior} />} />
          {/* Sin flecha: el descarte es una etiqueta sin fecha (CV15-09). */}
          <Celda k="Calificados" v={nf(c.calificados.valor)} r={o(c.calificados.tasa, pf)} />
          <Celda k="No calificados" v={nf(c.noCalificados.valor)} r={o(c.noCalificados.tasa, pf)} />
        </div>
      </div>
    </section>
  );
}

/**
 * La nota de cobertura, en una línea (CV15-10): cuántos traen por dónde entraron, la ventana de verdad, contra
 * qué compara, y por qué falta una flecha cuando falta. Ocupa el lugar del `#cvInfo` del prototipo.
 */
function Nota({ p }) {
  const ps = p.pasos;
  const c = ps.cifras;
  const comparacion =
    p.periodo === 'hoy' ? FRASE.diaEnCurso : ps.anterior === null ? FRASE.sinComparacion : p.periodo === '7d' ? FRASE.vs7 : FRASE.vs30;

  const motivos = [];
  if (ps.sinComparacion === 'sin_historia') motivos.push(FRASE.sinHistoria);
  if (ps.sinComparacion === 'faltan_contactos') motivos.push(FRASE.faltanContactos);
  if (c.agendados.congeladasEnLaAnterior) motivos.push(FRASE.congeladas);
  if (c.vistas.motivo !== null) motivos.push(FRASE_DE_LAS_VISTAS[c.vistas.motivo]);
  // Si cruza el corte lo dice el servidor (`laVentanaLoCruza`), el mismo dato que leen la tarjeta y los avisos.
  if (c.formulario.corte !== null && c.formulario.laVentanaLoCruza) {
    motivos.push(poner(FRASE.cruzaElCorte, { corte: fechaCorta(c.formulario.corte) }));
  }
  if (ps.sinAlta) motivos.push(poner(FRASE.sinAlta, { N: miles(ps.sinAlta) }));

  return (
    <p className="cv-note">
      {/* Sin contactos, la nota EMPIEZA con la frase y sigue igual: la ventana y contra qué compara (CV15-10). */}
      {ps.cobertura.sobre === 0 ? (
        FRASE.sinContactos
      ) : (
        <>
          <b>
            {miles(ps.cobertura.con)} de {miles(ps.cobertura.sobre)}
          </b>{' '}
          contactos traen por dónde entraron
        </>
      )}{' '}
      · {rangoDe(ps.ventana)} ·{' '}
      {/* La ventana anterior, en el `title`: la nota dice sólo la frase cerrada. */}
      <span title={ps.anterior ? rangoDe(ps.anterior) : undefined}>{comparacion}</span>
      {motivos.map((m) => ` ${m}`).join('')}
    </p>
  );
}

/** Una métrica de la tarjeta (`jm`): el rótulo, la flecha si compara, y la cifra. */
function Metrica({ m, conAnterior }) {
  const rotulo = m.deMeta ? `${METRICAS[m.clave]}, ${FRASE.deMeta}` : METRICAS[m.clave];
  const valor = m.valor === null ? FRASE.guion : m.unidad === 'conteo' ? nf(m.valor) : pf(m.valor);
  return (
    <div className="jm">
      <span>{rotulo}</span>
      <Delta v={m.variacion} conAnterior={conAnterior} />
      <b>{valor}</b>
    </div>
  );
}

/**
 * Una tarjeta del recorrido (`cvRenderJourney`, línea 4176). Sin banda (`jband empty`) y con el estado
 * `st-na`, que sólo apaga el punto; una señal crítica la pasa a `st-crit` (CV15-11).
 */
function Tarjeta({ s, primera, paso, senales, conVentana, conAnterior, alAbrir }) {
  const critica = senales.some((x) => x.gravedad === 'critica');
  const aRevisar = senales.filter((x) => x.estado !== 'sin_medicion').length;
  const abre = CON_CAJON.has(s.k);

  let valor = FRASE.guion;
  let sub = FRASE.sinDato;
  if (paso.estado !== 'hueco' && s.k === 'sesiones') {
    valor = nf(paso.valor);
    sub = s.a;
  } else if (s.k === 'form' && paso.estado !== 'hueco') {
    const corte = fechaCorta(paso.hastaElCorte);
    if (paso.valor === null) {
      sub = poner(FRASE.sinDatoDesde, { corte });
    } else {
      valor = o(paso.tasa, pf);
      sub = (
        <>
          <b>{nf(paso.valor)}</b> {s.aCorta} · {poner(FRASE.hastaElCorte, { corte })}
        </>
      );
    }
  } else if (paso.estado !== 'hueco') {
    valor = o(paso.tasa, pf);
    sub = (
      <>
        <b>{nf(paso.valor)}</b> {s.aCorta ?? s.a}
      </>
    );
  }

  /* El pie (CV15-16): «N a revisar», o «sin observaciones» sólo donde hay de dónde decirlo —con 7 o 30 días, en
     un paso con reglas y sin ninguna señal—; con «Hoy» o «Completo», vacío. Un paso cuyas señales están todas sin
     medición tampoco lo dice: no se pudo mirar, y su cajón las lista. */
  const pie =
    aRevisar > 0 ? (
      <>
        {critica ? <span className="jdot" /> : null}
        {aRevisar} a revisar
      </>
    ) : senales.length === 0 && conVentana && CON_REGLAS.has(s.k) ? (
      FRASE.sinObservaciones
    ) : null;

  const teclado = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      alAbrir();
    }
  };

  return (
    <div
      className={critica ? 'jstep st-crit crit' : abre ? 'jstep st-na' : 'jstep st-na cv-sin-cajon'}
      data-step={s.k}
      role={abre ? 'button' : undefined}
      tabIndex={abre ? 0 : undefined}
      onClick={abre ? alAbrir : undefined}
      onKeyDown={abre ? teclado : undefined}
    >
      {primera ? null : <span className="jarrow" />}

      <div className="j-head">
        <span className="jsdot" />
        {s.t}
        {abre ? <span className="jgo">›</span> : null}
      </div>

      <div className="j-num">
        <span className="jv">{valor}</span>
        {/* Sin «sin comparación»: al lado de la cifra grande no entra, y la tira y la nota ya lo dicen. */}
        <Delta v={paso.variacion} />
      </div>

      {/* Sin bandas: no hay un umbral medido contra el cual compararse (CV15-11). */}
      <div className="j-band">
        <div className="jband empty" />
      </div>

      <div className="j-sub">{sub}</div>

      <div className="jmx">
        {paso.metricas.map((m) => (
          <Metrica key={m.clave} m={m} conAnterior={conAnterior} />
        ))}
      </div>

      <div className="jx">
        <span>{pie}</span>
        {/* La caída contra la cohorte, en personas (CV15-16). En Landing no hay: es la base. */}
        {paso.caida === null ? null : <em>−{miles(paso.caida)}</em>}
      </div>
    </div>
  );
}

/**
 * «Requiere acción ahora» (`cvRenderLists`, línea 4253): sólo con señales `critica`, y sólo con 7 o 30 días
 * (CV15-19). Hoy ninguna regla de Conversion lo es, así que no aparece. «Ver evidencia →» abre el cajón del
 * paso; una señal sin paso no tiene cajón, y lo suyo está en la tarjeta de señales del final.
 */
function Alarma({ senales, alAbrir }) {
  if (senales.ventana === null) return null;
  const criticas = senales.lista.filter((s) => s.gravedad === 'critica');
  if (criticas.length === 0) return null;
  const pasoDe = (id) => PASOS.find((s) => (senales.porPaso?.[s.k] ?? []).includes(id)) ?? null;

  return (
    <div id="cvAlarmWrap">
      <div className="ghead bad">
        <span className="gdot" />
        <span className="gt">Requiere acción ahora</span>
        <span className="gsub">{FRASE.pasadaDeLaManana}</span>
        <span className="gn">{criticas.length === 1 ? '1 incidencia' : `${criticas.length} incidencias`}</span>
      </div>
      <div id="cvAlarm">
        {criticas.map((x) => {
          const paso = pasoDe(x.id);
          const abre = paso !== null && CON_CAJON.has(paso.k);
          return (
            <div
              className={abre ? 'alarm' : 'alarm cv-sin-cajon'}
              key={x.id}
              data-step={paso?.k}
              role={abre ? 'button' : undefined}
              tabIndex={abre ? 0 : undefined}
              onClick={abre ? () => alAbrir(paso.k) : undefined}
              onKeyDown={
                abre
                  ? (ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        alAbrir(paso.k);
                      }
                    }
                  : undefined
              }
            >
              <span className="al-ic">⛔</span>
              <div>
                <div className="al-t">{x.texto}</div>
                <div className="al-d">
                  {x.revision}{' '}
                  <span className="al-m">
                    {paso ? `${paso.t} · ` : ''}
                    {fechaCorta(x.ultimaDeteccion)}
                  </span>
                </div>
              </div>
              {abre ? <span className="al-go">{FRASE.verEvidencia}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
