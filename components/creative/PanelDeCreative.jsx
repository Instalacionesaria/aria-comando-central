'use client';

/* El tablero de Creative: el front del prototipo, con los datos reales (docs/creative/16, CF-3).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LOS NÚMEROS LLEGAN HECHOS
 *
 * `aios-command-center_1.html:2746-2804` dibujaba esta pantalla con ocho piezas inventadas, y su JS (`:3487-3934`)
 * calculaba en el navegador el promedio que parte la biblioteca en dos. Acá se dibuja el MISMO marcado —`cre-head`,
 * la tira `cre-stats`, la `filterbar` con «Ordenar por», los dos `ghead` con su rejilla `cg` de tarjetas `cc`, y la
 * ficha `aside.drawer`—, con las mismas clases y en el mismo orden (CF1-01). Las reglas que siguen en `app/aios.css`
 * no se tocan; las que se habían retirado de ahí y lo nuevo viven en `app/creative.css`.
 *
 * El navegador **no calcula nada**: las cifras, las tasas, los grupos y su orden llegan de `lecturaDeCreative`, de 0
 * a 1 (CF1-15). Acá se les da formato —se multiplica por 100 en un solo lugar, `cien` de `comun.jsx`—, se elige qué
 * criterio dibujar y la frase de cada hueco de la lista cerrada de CF1-02.
 *
 * ── LO QUE CAMBIA RESPECTO DEL PROTOTIPO, Y POR QUÉ ───────────────────────
 *
 *   · **«Funciona» es contra la etapa** (CF1-08): cada pieza contra el promedio de las piezas de SU etapa, y la
 *     tarjeta lleva la etapa donde el prototipo ponía formato y ángulo, que no tienen fuente.
 *   · **Los rótulos que cambian están declarados** en CF1-02: «Impresiones» por «Alcance», «Entregando» por
 *     «Activo», el nombre de la pieza por «07 — Owner Hook».
 *   · **El «Plan de acción» abre el plan real** de la pasada de la mañana (CF1-14). Sin «Personalizado» ni la clave
 *     `mes` (CF1-03).
 *   · **Una cifra sin dato dice «—» y por qué**, debajo, con su frase; en la tarjeta, que no tiene lugar, en el
 *     `title`. Un cero es un cero medido.
 *   · **Lo que la pantalla de antes medía** y el prototipo no tenía va abajo, en «Lo demás, en cifras» (CF1-13); la
 *     fatiga, además, como marca en la tarjeta.
 *   · **Sin párrafos** (CF1-05): es un tablero. La cobertura, los avisos y lo que falta para medir siguen viajando,
 *     y los da el agente de Creative cuando se le pregunta.
 *   · **Ningún dato de una persona** (CF1-17): los nombres son de piezas, que son nombres de anuncios.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { anunciarPeriodo } from '@/lib/agentes/periodos';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerCreative } from '@/lib/negocio/vistaDeCreative';
import { useSesion } from '../../app/sesion-contexto.tsx';
import FichaDelCreativo from './FichaDelCreativo';
import Miniatura from './Miniatura.jsx';
import { BotonDelPlan, TarjetaDeSenales } from '../senales/SenalesDelDepartamento.jsx';
import { usarPublicarComentario } from '../../lib/agentes/comentario-de-la-cabecera.ts';
import { CRITERIO, ESTADO, ETAPA, FRASE, PERIODO_EN_LA_BARRA, corto, miles, motivo, o, pf, plata, veces } from './comun.jsx';

/** El criterio con el que abre la pantalla: el del prototipo (`let criterion = 'agendas'`). */
const CRITERIO_POR_OMISION = 'agendas';

export default function PanelDeCreative() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  // La caja del cerebro del pie pregunta con el período que se está mirando (`lib/agentes/periodos.ts`).
  useEffect(() => anunciarPeriodo('creative', periodo), [periodo]);
  const [pantalla, setPantalla] = useState(null);
  // El comentario de la cabecera llega con la pantalla, y se le entrega a la cabecera (AG15, `04`, AG-78).
  usarPublicarComentario('creative', pantalla ? (pantalla.comentario ?? null) : undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* El criterio vive acá y no en el tablero: cambiar de ventana no lo olvida, como en el prototipo. */
  const [criterio, setCriterio] = useState(CRITERIO_POR_OMISION);

  /* Cuál es la última lectura pedida: sin esto, una respuesta que llega tarde pisa a la más nueva y deja el
     botón describiendo otra ventana. Es el arreglo de Acquisition (AQ-4), Conversion (CV-4) y Conversation (CN-4). */
  const ultima = useRef(0);
  /* Si hay una carga primera en vuelo. Una recarga del reloj que entrara entonces la dejaría sin efecto —la primera
     se descarta por vieja— y quedaban «Cargando…» y el fallo a la vez, o las cifras de la ventana anterior. La
     recarga se salta: la primera ya trae lo nuevo. */
  const primeraEnVuelo = useRef(false);
  /* El período vigente, leído al pedir y no al crear la función: un «Guardar» del link o una señal resuelta llaman a la
     recarga que tenían a mano, y si en el medio se eligió otro período, pedirían el viejo —y ganarían, por ser la
     última—. */
  const periodoVigente = useRef(periodo);
  periodoVigente.current = periodo;

  /**
   * Trae la pantalla. Teniendo datos, una recarga del reloj no la vacía nunca —ni las cifras ni la ficha abierta— y
   * si falla, conserva lo que había. El cambio de período va como carga PRIMERA porque las cifras dibujadas son de
   * otra ventana, y si falla, la pantalla queda vacía con el aviso.
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      if (esRecarga && primeraEnVuelo.current) return;
      const esta = ++ultima.current;
      if (!esRecarga) {
        primeraEnVuelo.current = true;
        setCargando(true);
      }
      const r = await leerCreative(periodoVigente.current);
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

  /* Con `null` como clave el reloj no se registra: con Creative cerrada esto no cuesta una petición. Y el dato de
     entrega es DIARIO —el colector corre una vez por día— así que un tic frecuente pediría muchas veces lo mismo. */
  const aLaVista = estaALaVista('creative');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'creative:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <div className="cre-wrap">
      {/* El encabezado, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="cre-head">
        <div className="ch-l">
          <h2>Creative</h2>
          <span className="cre-desc">Qué funciona, qué no, y por qué</span>
        </div>
        <div className="ch-r">
          {/* El plan de la pasada de la mañana (CF1-14): el de 7 días con «7 días» y el de 30 con «30 días». Con «Hoy» y
              «Completo» la ruta no trae plan, y el botón lo dice. */}
          {pantalla ? <BotonDelPlan departamento="creative" senales={pantalla.senales} /> : null}
          <div className="ch-period">
            {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. Mientras no hay datos manda el
                local, que es lo único que hay. */}
            <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
          </div>
        </div>
      </div>

      {error ? (
        <p className="cr-falla" title={error}>
          {FRASE.fallo}
        </p>
      ) : null}
      {cargando && pantalla === null ? (
        <p className="cr-cargando">{FRASE.cargando}</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana: la ficha abierta era de otra ventana. */
        <Tablero key={pantalla.periodo} p={pantalla} criterio={criterio} alOrdenar={setCriterio} alCambiar={recargar} />
      )}
    </div>
  );
}

/* El segmentado del prototipo (`dateSeg`), con los cuatro períodos del sistema, sin la clave `mes` y sin
   «Personalizado» (CF1-03). */
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

/** La tira, el orden, los dos grupos, lo demás en cifras, las señales y la ficha abierta. */
function Tablero({ p, criterio, alOrdenar, alCambiar }) {
  const { cifras, piezas, criterios, loDemas } = p.pantalla;
  const grupos = criterios[criterio];
  const porClave = new Map(piezas.map((x) => [x.clave, x]));
  const unicas = new Set(grupos.unicas);
  const sesion = useSesion();
  // Lo decide el servidor; mirando otra empresa, nada (AG-82).
  const puede = sesion?.mirandoOtraOrganizacion ? { resolver: false, validar: false, firmar: false } : p.puedeConSenales;
  const puedeEditar = Boolean(sesion?.puedeConfigurarComisiones && !sesion?.mirandoOtraOrganizacion);
  /* Los links manuales, aparte: el editor de la ficha los cambia sin esperar a la próxima lectura. */
  const [enlaces, setEnlaces] = useState(p.enlaces);
  useEffect(() => setEnlaces(p.enlaces), [p.enlaces]);
  const [abierta, setAbierta] = useState(null);
  const pieza = abierta === null ? null : (porClave.get(abierta) ?? null);
  /* Si una recarga ya no trae la pieza abierta, la ficha se cierra Y se olvida: sin esto, una recarga posterior que la
     volviera a traer la reabriría sola, robándole el foco a quien está leyendo otra cosa. */
  useEffect(() => {
    if (abierta !== null && !piezas.some((x) => x.clave === abierta)) setAbierta(null);
  }, [abierta, piezas]);
  /* Sin ninguna pieza con valor en ninguna etapa no hay promedio contra el que estar «sobre»: lo dice como el prototipo. */
  const sinPromedio = Object.values(grupos.promedioPorEtapa).every((v) => v === null);

  return (
    <>
      <Tira c={cifras} criterio={criterio} />
      <div className="filterbar">
        <Orden valor={criterio} alElegir={alOrdenar} />
        <span className="db-info">
          <b>{miles(piezas.length)}</b> piezas · {PERIODO_EN_LA_BARRA[p.periodo]}
        </span>
      </div>

      <div className="ghead good">
        <span className="gdot" />
        <span className="gt">Funciona</span>
        <span className="gsub">{sinPromedio ? 'sin datos en este periodo' : 'sobre el promedio de su etapa'}</span>
        <span className="gn">{`${miles(grupos.funciona.length)} piezas`}</span>
      </div>
      <Grupo claves={grupos.funciona} gana porClave={porClave} unicas={unicas} alAbrir={setAbierta} />

      <div className="ghead bad">
        <span className="gdot" />
        <span className="gt">No funciona</span>
        <span className="gsub">bajo el promedio — pausar o iterar</span>
        <span className="gn">{`${miles(grupos.noFunciona.length)} piezas`}</span>
      </div>
      <Grupo claves={grupos.noFunciona} gana={false} porClave={porClave} unicas={unicas} alAbrir={setAbierta} />

      <LoDemas c={loDemas} />
      <TarjetaDeSenales departamento="creative" senales={p.senales} puede={puede} alCambiar={alCambiar} />
      {pieza ? (
        <FichaDelCreativo
          pieza={pieza}
          criterio={criterio}
          gana={grupos.funciona.includes(pieza.clave)}
          unica={unicas.has(pieza.clave)}
          manual={enlaces.find((e) => e.pieza === pieza.clave) ?? null}
          manualDelServidor={p.enlaces.some((e) => e.pieza === pieza.clave)}
          puedeEditar={puedeEditar}
          alCambiarEnlaces={(lista) => {
            setEnlaces(lista);
            alCambiar();
          }}
          alCerrar={() => setAbierta(null)}
        />
      ) : null}
    </>
  );
}

/**
 * La tira del prototipo (CF1-06): seis celdas, en su orden. Las dos primeras son sumas; Hook rate y Frecuencia, el
 * promedio pesado que manda el servidor; Retención, «—». La del criterio elegido lleva `.hi`. Donde el prototipo
 * decía «total» o «promedio», un «—» dice su frase.
 */
function Tira({ c, criterio }) {
  const celdas = [
    ['calificados', 'Calificados', o(c.calificados.valor, miles), 'total'],
    ['agendas', 'Agendas', o(c.agendas.valor, miles), 'total'],
    ['hookRate', 'Hook rate', o(c.hookRate.valor, pf), 'promedio'],
    ['retencion', 'Retención', o(c.retencion.valor, pf), 'promedio'],
    ['impresiones', 'Impresiones', o(c.impresiones.valor, corto), 'total'],
    ['frecuencia', 'Frecuencia', o(c.frecuencia.valor, veces), 'promedio'],
  ];
  return (
    <section className="cre-stats">
      {celdas.map(([clave, rotulo, valor, sub]) => (
        <div className={clave === criterio ? 'cre-stat hi' : 'cre-stat'} key={clave}>
          <div className="l">{rotulo}</div>
          <div className="v">{valor}</div>
          <div className={motivo(c[clave]) ? 's cr-motivo' : 's'} title={motivo(c[clave]) ?? undefined}>
            {motivo(c[clave]) ?? sub}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * «Ordenar por» (CF1-07): la píldora del prototipo con su menú. Elegir un criterio no reordena nada acá: el servidor
 * ya mandó los grupos y el orden de cada uno. El menú se cierra al elegir, al tocar afuera y con Escape.
 */
function Orden({ valor, alElegir }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const pildora = useRef(null);
  /* Cerrar con Escape o al elegir devuelve el foco a la píldora: si no, queda en un ítem que ya no se dibuja. */
  const cerrar = () => {
    setAbierto(false);
    pildora.current?.focus();
  };
  useEffect(() => {
    if (!abierto) return undefined;
    const afuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('click', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  return (
    <div className={abierto ? 'pill-wrap open' : 'pill-wrap'} ref={caja}>
      <button type="button" className="pill" ref={pildora} aria-haspopup="true" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span className="pk">Ordenar por</span>
        <span className="pv">{CRITERIO[valor].rotulo}</span>
        <span className="pc">⌄</span>
      </button>
      {/* Los ítems se dibujan sólo con el menú abierto: el prototipo lo esconde con opacidad, y así sus botones seguían
          en el orden del tabulador y en lo que lee un lector de pantalla. */}
      <div className="pill-menu cr-orden" role="menu">
        {abierto ? (
          <div className="pm-list">
            {Object.entries(CRITERIO).map(([clave, c]) => (
              <button
                key={clave}
                type="button"
                role="menuitemradio"
                aria-checked={clave === valor}
                className={clave === valor ? 'on' : undefined}
                onClick={() => {
                  alElegir(clave);
                  cerrar();
                }}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Una rejilla `cg`, con las piezas en el orden del servidor. Vacía, la frase del prototipo. */
function Grupo({ claves, gana, porClave, unicas, alAbrir }) {
  return (
    <section className="cg">
      {claves.length === 0 ? (
        <div className="dw-empty cr-vacio">{FRASE.grupoVacio}</div>
      ) : (
        claves.map((clave) => <Tarjeta key={clave} pieza={porClave.get(clave)} gana={gana} unica={unicas.has(clave)} alAbrir={alAbrir} />)
      )}
    </section>
  );
}

/**
 * La tarjeta `cc` del prototipo (CF1-09): la miniatura con su estado, el nombre de la pieza, la etiqueta de la etapa
 * y las seis métricas de la tira. La marca «Perdiendo gancho», cuando la fatiga tiene veredicto y lo dice. Al tocarla
 * se abre la ficha. Una cifra en «—» lleva su frase en el `title`: en 50 px no entra una línea.
 */
function Tarjeta({ pieza, gana, unica, alAbrir }) {
  const c = pieza.cifras;
  const metricas = [
    ['Calificados', c.calificados, miles],
    ['Agendas', c.agendas, miles],
    ['Hook rate', c.hookRate, pf],
    ['Retención', c.retencion, pf],
    ['Impresiones', c.impresiones, corto],
    ['Frecuencia', c.frecuencia, veces],
  ];
  const abrir = () => alAbrir(pieza.clave);
  return (
    <div
      className={gana ? 'cc win' : 'cc lose'}
      tabIndex={0}
      role="button"
      aria-label={`Pieza ${pieza.clave}`}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrir();
        }
      }}
    >
      <Miniatura url={pieza.miniatura} clase="cc-media">
        {pieza.perdiendoGancho === true ? <span className="cr-gancho">Perdiendo gancho</span> : null}
        <span className={pieza.estado === 'entregando' ? 'cc-status act' : 'cc-status pau'}>{ESTADO[pieza.estado]}</span>
      </Miniatura>
      <div className="cc-body">
        <div className="cc-name" title={pieza.clave}>
          {pieza.clave}
        </div>
        <div className="cc-qual">
          <span className="tag fmt">{ETAPA[pieza.etapa]}</span>
          {unica ? <span className="tag ang">{FRASE.unica}</span> : null}
        </div>
        <div className="cc-mx">
          {metricas.map(([rotulo, cifra, formato], i) => (
            <div className={i < 2 ? 'pm' : undefined} key={rotulo}>
              <div className="k">{rotulo}</div>
              <div className="v" title={motivo(cifra) ?? undefined}>
                {o(cifra.valor, formato)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Lo demás, en cifras (CF1-13): lo que la pantalla de antes medía y el prototipo no tenía, con las celdas de la tira.
 * Las piezas perdiendo gancho, sobre las que tienen veredicto: sin ninguna con veredicto, la frase de la fatiga.
 */
function LoDemas({ c }) {
  const gancho = c.perdiendoGancho;
  const celdas = [
    ['Gasto', o(c.gasto.valor, plata), motivo(c.gasto)],
    ['CTR', o(c.ctr.valor, pf), motivo(c.ctr)],
    ['Link CTR', o(c.linkCtr.valor, pf), motivo(c.linkCtr)],
    ['Landing', o(c.landing.valor, pf), motivo(c.landing)],
    ['Perdiendo gancho', gancho.sobre === 0 ? FRASE.guion : `${miles(gancho.con)} de ${miles(gancho.sobre)}`, gancho.sobre === 0 ? FRASE.sinGancho : null],
  ];
  return (
    <>
      <div className="ghead">
        <span className="gdot cr-gdot-demas" />
        <span className="gt">Lo demás, en cifras</span>
      </div>
      <section className="cre-stats cr-cinco">
        {celdas.map(([rotulo, valor, porque]) => (
          <div className="cre-stat" key={rotulo}>
            <div className="l">{rotulo}</div>
            <div className="v">{valor}</div>
            <div className={porque ? 's cr-motivo' : 's'} title={porque ?? undefined}>
              {porque ?? ''}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
