'use client';

/* Los Analizadores: la lista de cada pestaña, sus acciones y el formulario manual.
   ==========================================================================

   Es lo MÍNIMO que hace funcionar el flujo, a propósito: la forma se decide después, sobre algo que
   ya anda. Lo que sí está decidido acá es el comportamiento, y cada pieza tiene su porqué:

   ── LA FICHA SE PIDE APARTE, ENSEGUIDA ────────────────────────────────────

   Cuando un análisis de HT vuelve DONE, la pantalla pide la ficha del prospecto en una segunda
   petición. En el origen iban juntas en la misma función: dos inferencias de minutos dentro de
   300 s. Si la ficha falla, la llamada ya está DONE y lo que falla es solo su pestaña Prospecto.

   ── SINCRONIZAR DESCUBRE; ANALIZAR ES DE A UNA ────────────────────────────

   Sincronizar trae las reuniones nuevas y las clasifica, y nada más. Después la pantalla analiza las
   pendientes UNA POR PETICIÓN, en orden: cada análisis tiene así su propia función de 300 s.

   Y cada pedido lleva el estado en que la pantalla VIO la llamada (`esperado`). La lista es una foto
   y el drenado tarda minutos: si mientras tanto la tarea de cada hora u otra pestaña terminó una,
   el servidor la rechaza con `llamada_cambio` y el drenado sigue con la siguiente, en vez de pagarla
   otra vez. La revisión del 2026-09-23 encontró que sin esto se pagaban dos análisis y dos fichas.

   ── VACÍO Y ERROR NO SON LO MISMO ─────────────────────────────────────────

   «No hay llamadas» y «no se pudo leer» se dibujan distinto. Es la lección que dejó el error del
   Research que se escribía en un cajón cerrado (`pruebas/codigo/148`): un fallo que se ve como una
   lista vacía es un fallo que nadie reporta.

   ── NO HAY RELOJ ──────────────────────────────────────────────────────────

   La lista se refresca después de cada acción y al volver a la pestaña. Las llamadas nuevas llegan
   con la tarea de cada hora, así que un reloj de segundos pediría la misma lista cientos de veces
   para no traer nada. */

import { useCallback, useEffect, useRef, useState } from 'react';

import { pedir } from '../../lib/http/cliente.ts';
import { estaALaVista } from '@/lib/vista';
import { fraseDelVeto, rotuloDelEstado } from '@/lib/analizadores/rotulos';
import DetalleHt from './DetalleHt.jsx';
import DetalleOb from './DetalleOb.jsx';

const PESTANAS = [
  { clave: 'HT', nombre: 'HT · Venta', icono: '#i-closer' },
  { clave: 'OB', nombre: 'OB · Onboarding', icono: '#i-analizadores' },
];

const FILTROS = [
  { clave: 'analizadas', nombre: 'Analizadas' },
  { clave: 'pendientes', nombre: 'Pendientes' },
  { clave: 'descartadas', nombre: 'Descartadas' },
];

/** Las rutas que analizan declaran `maxDuration = 300`. La pantalla espera al menos eso. */
const ESPERA_LARGA = 300_000;

/** Pasados estos minutos en ANALYZING, la llamada se colgó y se puede reintentar. La base usa el mismo. */
const MINUTOS_PARA_DARLA_POR_COLGADA = 15;

const CHIP_DEL_ESTADO = { PENDING: 'warn', ANALYZING: 'warn', DONE: 'ok', NOT_MATCH: 'warn', FAILED: 'crit' };

/* Los rechazos que la pantalla sabe nombrar. El `detalle` del servidor, si viene, gana: es más
   preciso que cualquier frase de acá. */
const MENSAJES = {
  sin_permiso: 'Tu usuario puede ver los Analizadores pero no analizar ni cambiar nada.',
  sin_llave_de_ia:
    'Falta la llave de IA de la empresa. Se carga en Ajustes › Credenciales; si no la ves, pedíselo a un administrador.',
  llave_de_ia_ilegible: 'La llave de IA está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  sin_llave_de_tldv:
    'Falta la llave de tl;dv. Se carga en Ajustes › Credenciales; sin ella igual podés pegar una transcripción a mano.',
  llave_de_tldv_ilegible: 'La llave de tl;dv está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  base_no_disponible: 'No se pudo leer la base. No es que no haya llamadas: no se pudo preguntar.',
};

/** Los rechazos que cortan un drenado: seguir solo repetiría el mismo rechazo en cada llamada. */
const CORTAN_EL_DRENADO = ['llave_de_ia_rechazada', 'servicio_externo_saturado', 'sin_llave_de_ia', 'llave_de_ia_ilegible'];

function textoDelRechazo(r) {
  if (r.tipo === 'sin_respuesta') return 'No se pudo contactar al servidor.';
  return r.detalle ?? MENSAJES[r.codigo] ?? `El servidor respondió ${r.estado}.`;
}

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

const colgada = (l) =>
  l.estado === 'ANALYZING' &&
  l.tomadaEl !== null &&
  Date.now() - new Date(l.tomadaEl).getTime() > MINUTOS_PARA_DARLA_POR_COLGADA * 60_000;

export default function PanelDeAnalizadores() {
  const [pestana, setPestana] = useState('HT');
  const [filtro, setFiltro] = useState('analizadas');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState(null);
  const [errorDeEstado, setErrorDeEstado] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(false);
  const [trabajando, setTrabajando] = useState('');
  const [aviso, setAviso] = useState('');
  /* Cada acción larga termina pidiendo una recarga con este contador, y no llamando al `cargarLista`
     que existía cuando se hizo clic: ese tenía fijos la pestaña y el filtro de ese momento, y si en los
     minutos del análisis alguien cambió de pestaña, la lista vieja aparecía bajo la pestaña nueva. */
  const [recarga, setRecarga] = useState(0);
  const recargar = () => setRecarga((n) => n + 1);
  /* Y cada pedido lleva su número: una respuesta que llega después de otra más nueva se descarta. */
  const ultimoPedido = useRef(0);

  const aLaVista = estaALaVista('analizadores');

  const cargarLista = useCallback(async () => {
    const mio = ++ultimoPedido.current;
    const r = await pedir(`/api/analizadores/llamadas?tipo=${pestana}&filtro=${filtro}`);
    if (mio !== ultimoPedido.current) return;
    if (r.tipo === 'datos') {
      setLista(r.datos);
      setError('');
    } else {
      setError(textoDelRechazo(r));
    }
  }, [pestana, filtro]);

  useEffect(() => {
    if (!aLaVista) return;
    cargarLista();
  }, [aLaVista, cargarLista, recarga]);

  /* El estado de las llaves, CADA VEZ que la pestaña se abre y no una sola: la vista queda montada
     siempre, así que quien cargaba la llave de tl;dv en Ajustes › Credenciales y volvía seguía viendo
     Sincronizar deshabilitado hasta recargar la página. */
  const cargarEstado = useCallback(async () => {
    const r = await pedir('/api/analizadores/estado');
    if (r.tipo === 'datos') {
      setEstado(r.datos);
      setErrorDeEstado('');
    } else {
      setErrorDeEstado(textoDelRechazo(r));
    }
  }, []);
  useEffect(() => {
    if (aLaVista) cargarEstado();
  }, [aLaVista, cargarEstado]);

  const seAnaliza = (tipo) => (estado?.tiposQueSeAnalizan ?? []).includes(tipo);
  /* Por qué un botón de analizar está deshabilitado. Sin el estado cargado no se sabe qué se
     analiza, y decir que un tipo está apagado sin saberlo sería falso. */
  const porQueNoSeAnaliza = (tipo) =>
    estado === null
      ? 'No se pudo saber todavía qué se analiza: recargá el estado.'
      : seAnaliza(tipo)
        ? undefined
        : 'El análisis de este tipo está apagado por ahora.';

  /** Analiza una llamada y, si es una HT que quedó DONE, pide su ficha enseguida. */
  const analizarUna = useCallback(async (id, tipo, esperado) => {
    const r = await pedir(`/api/analizadores/llamadas/${id}/analizar`, {
      metodo: 'POST',
      cuerpo: { esperado },
      espera: ESPERA_LARGA,
    });
    if (r.tipo !== 'datos') {
      return { ok: false, codigo: r.tipo === 'rechazado' ? r.codigo : null, mensaje: textoDelRechazo(r) };
    }
    if (r.datos.estado === 'DONE' && tipo === 'HT') {
      await pedir(`/api/analizadores/llamadas/${id}/ficha`, { metodo: 'POST', espera: ESPERA_LARGA });
    }
    return { ok: true, estado: r.datos.estado, error: r.datos.error, motivo: r.datos.motivo };
  }, []);

  const alAnalizar = async (l) => {
    setTrabajando(`Analizando «${l.titulo ?? 'la llamada'}»…`);
    const r = await analizarUna(l.id, l.tipo, l.estado);
    setTrabajando('');
    if (!r.ok) setAviso(r.mensaje);
    else if (r.estado === 'FAILED') setAviso(`El análisis falló: ${r.error}`);
    else if (r.estado === 'NOT_MATCH') setAviso(`El análisis dice que ${fraseDelVeto(l.tipo)}: ${r.motivo}`);
    else setAviso('');
    recargar();
  };

  const alSincronizar = async () => {
    setAviso('');
    setTrabajando('Buscando reuniones nuevas en tl;dv…');
    const r = await pedir('/api/analizadores/sincronizar', { metodo: 'POST', espera: ESPERA_LARGA });
    if (r.tipo !== 'datos') {
      setTrabajando('');
      setAviso(textoDelRechazo(r));
      return;
    }
    const d = r.datos;
    const partes = [`${d.descubiertas} nueva(s)`, `${d.internas} descartada(s)`];
    if (d.pendientesDeTranscripcion > 0) partes.push(`${d.pendientesDeTranscripcion} sin transcripción todavía`);
    if (d.sinClasificar > 0) partes.push(`${d.sinClasificar} sin clasificar (se reintenta)`);
    if (d.sinExaminar > 0) partes.push(`${d.sinExaminar} para la próxima corrida`);

    /* El drenado: las PENDING de los tipos que se analizan, de a una. Las FAILED no: reintentarlas es
       una decisión de alguien que lee el error, no algo que se repite solo. Cada resultado se cuenta
       por lo que fue —un FAILED no es una analizada— y los rechazos que valen para todas cortan. */
    const cuenta = { DONE: 0, NOT_MATCH: 0, FAILED: 0, salteadas: 0 };
    const vetadasPorTipo = {};
    let corte = '';
    for (const tipo of estado?.tiposQueSeAnalizan ?? []) {
      if (corte) break;
      const p = await pedir(`/api/analizadores/llamadas?tipo=${tipo}&filtro=pendientes`);
      if (p.tipo !== 'datos') {
        corte = `no se pudo leer la lista de pendientes: ${textoDelRechazo(p)}`;
        break;
      }
      const pendientes = p.datos.llamadas.filter((l) => l.estado === 'PENDING').reverse();
      for (const [i, l] of pendientes.entries()) {
        setTrabajando(`Analizando ${i + 1} de ${pendientes.length} (${tipo})…`);
        const a = await analizarUna(l.id, l.tipo, 'PENDING');
        if (a.ok) {
          cuenta[a.estado] = (cuenta[a.estado] ?? 0) + 1;
          if (a.estado === 'NOT_MATCH') vetadasPorTipo[tipo] = (vetadasPorTipo[tipo] ?? 0) + 1;
        }
        else if (CORTAN_EL_DRENADO.includes(a.codigo)) {
          corte = a.mensaje;
          break;
        } else cuenta.salteadas++;
      }
    }
    setTrabajando('');
    const resultado = [`analizadas ${cuenta.DONE}`];
    for (const [tipo, n] of Object.entries(vetadasPorTipo)) resultado.push(`no son ${tipo} ${n}`);
    if (cuenta.FAILED > 0) resultado.push(`fallaron ${cuenta.FAILED} (están en Pendientes)`);
    if (cuenta.salteadas > 0) resultado.push(`${cuenta.salteadas} ya las había tomado otra corrida`);
    setAviso(`tl;dv: ${partes.join(' · ')}. Ahora: ${resultado.join(' · ')}.${corte ? ` Se cortó: ${corte}` : ''}`);
    recargar();
  };

  const alMover = async (l, tipo) => {
    const r = await pedir(`/api/analizadores/llamadas/${l.id}`, { metodo: 'PATCH', cuerpo: { tipo } });
    setAviso(r.tipo === 'datos' ? '' : textoDelRechazo(r));
    recargar();
  };

  const alBorrar = async (l) => {
    // Borrar deja lápida: la reunión no vuelve a entrar desde tl;dv. Se pregunta antes.
    if (!window.confirm('¿Borrar esta llamada? No vuelve a entrar desde tl;dv.')) return;
    const r = await pedir(`/api/analizadores/llamadas/${l.id}`, { metodo: 'DELETE' });
    setAviso(r.tipo === 'datos' ? '' : textoDelRechazo(r));
    recargar();
  };

  if (detalle !== null) {
    /* `detalle` guarda el tipo además del id: una OB no tiene vista Prospecto ni ficha, y abrirla con el
       detalle de HT mostraría una evaluación de closer vacía. */
    const Detalle = detalle.tipo === 'OB' ? DetalleOb : DetalleHt;
    return (
      <Detalle
        id={detalle.id}
        alVolver={() => {
          setDetalle(null);
          recargar();
        }}
      />
    );
  }

  const cuenta = lista?.cuenta;
  const otros = (tipo) => ['HT', 'OB', 'OTRO'].filter((t) => t !== tipo);

  return (
    <div className="az-detalle">
      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="az-barra">
        <div className="cl-sub">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              className={pestana === p.clave ? 'on' : undefined}
              onClick={() => {
                setPestana(p.clave);
                setLista(null);
              }}
            >
              <svg viewBox="0 0 16 16">
                <use href={p.icono} />
              </svg>
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="az-acciones">
          <button
            type="button"
            className="az-boton"
            disabled={trabajando !== '' || !estado?.llaveDeTldv.cargada}
            title={estado && !estado.llaveDeTldv.cargada ? MENSAJES.sin_llave_de_tldv : undefined}
            onClick={alSincronizar}
          >
            Sincronizar con tl;dv
          </button>
          <button type="button" className="az-boton az-primario" onClick={() => setFormulario(!formulario)}>
            {formulario ? 'Cerrar' : 'Analizar transcripción'}
          </button>
        </div>
      </div>

      {errorDeEstado ? (
        <div className="az-error">
          No se pudo leer qué llaves tiene la empresa: {errorDeEstado}{' '}
          <button type="button" className="az-boton" onClick={cargarEstado}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!seAnaliza(pestana) && estado ? (
        <div className="az-aviso">
          El análisis de esta pestaña está apagado por ahora: las reuniones se clasifican y se guardan, y
          esperan en Pendientes.
        </div>
      ) : null}

      {formulario ? (
        <Manual
          pestana={pestana}
          seAnaliza={seAnaliza}
          trabajando={trabajando !== ''}
          alTerminar={(id, tipo, estadoFinal, mensaje) => {
            /* El formulario se cierra, así que el resultado lo dice el PANEL: con el mensaje adentro del
               formulario, un «no es HT» o un «falló» se desmontaba antes de verse. */
            setFormulario(false);
            setAviso(mensaje);
            if (estadoFinal === 'DONE') setDetalle({ id, tipo });
            recargar();
          }}
          setTrabajando={setTrabajando}
        />
      ) : null}

      {trabajando ? <div className="az-aviso">{trabajando}</div> : null}
      {aviso ? <div className="az-aviso">{aviso}</div> : null}

      <div className="az-filtros">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            className={filtro === f.clave ? 'az-boton on' : 'az-boton'}
            onClick={() => setFiltro(f.clave)}
          >
            {f.nombre}
            {cuenta && cuenta[f.clave] > 0 ? ` (${cuenta[f.clave]})` : ''}
          </button>
        ))}
      </div>

      {error ? (
        <div className="az-error">
          {error}{' '}
          <button type="button" className="az-boton" onClick={cargarLista}>
            Reintentar
          </button>
        </div>
      ) : null}

      {lista === null && !error ? <div className="az-aviso">Cargando…</div> : null}
      {lista && lista.llamadas.length === 0 ? <div className="az-aviso">No hay llamadas en este filtro.</div> : null}

      <div className="az-lista">
        {(lista?.llamadas ?? []).map((l) => (
          <div key={l.id} className="az-fila">
            <div>
              <div className="az-fila-t">{l.titulo ?? 'Llamada sin título'}</div>
              <div className="az-fila-m">
                {fecha(l.fechaDeLaReunion ?? l.creadoEl)}
                {l.prospectoNombre ? ` · ${l.prospectoNombre}` : ''}
                {l.proveedor === 'MANUAL' ? ' · pegada a mano' : ''}
              </div>
              {/* El motivo de un descarte y el error de un fallo, cada uno con su nombre. La
                  transcripción NO se muestra nunca: una OTRO suele ser una reunión interna. */}
              {l.motivo ? (
                <div className="az-fila-m">
                  Por qué {fraseDelVeto(l.tipo)}: {l.motivo}
                </div>
              ) : null}
              {l.estado === 'FAILED' && l.error ? <div className="az-error">{l.error}</div> : null}
              {l.estado === 'DONE' && l.tipo === 'OB' && l.resumen ? <div className="az-fila-m">{l.resumen}</div> : null}
            </div>
            <div className="az-acciones">
              {l.estado === 'DONE' && l.puntaje !== null ? (
                <span className={`az-puntaje az-${(l.colorDelPuntaje ?? '').toLowerCase()}`}>{l.puntaje}</span>
              ) : null}
              <span className={`chip ${CHIP_DEL_ESTADO[l.estado]}`}>{rotuloDelEstado(l.estado, l.tipo)}</span>
              {l.estado === 'DONE' && l.tipo !== 'OTRO' ? (
                <button type="button" className="az-boton" onClick={() => setDetalle({ id: l.id, tipo: l.tipo })}>
                  Ver
                </button>
              ) : null}
              {l.tipo !== 'OTRO' && (l.estado === 'PENDING' || l.estado === 'FAILED' || colgada(l)) ? (
                <button
                  type="button"
                  className="az-boton"
                  disabled={trabajando !== '' || !seAnaliza(l.tipo)}
                  title={porQueNoSeAnaliza(l.tipo)}
                  onClick={() => alAnalizar(l)}
                >
                  {l.estado === 'PENDING' ? 'Analizar' : 'Reintentar'}
                </button>
              ) : null}
              {l.estado !== 'DONE' && l.estado !== 'ANALYZING'
                ? otros(l.tipo).map((t) => (
                    <button key={t} type="button" className="az-boton" onClick={() => alMover(l, t)}>
                      {t === 'OTRO' ? 'No es HT ni OB' : `Mover a ${t}`}
                    </button>
                  ))
                : null}
              {l.estado !== 'ANALYZING' ? (
                <button type="button" className="az-boton az-peligro" onClick={() => alBorrar(l)}>
                  Borrar
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** El formulario de la transcripción pegada a mano. Los tres campos son obligatorios. */
function Manual({ pestana, seAnaliza, trabajando, alTerminar, setTrabajando }) {
  const [tipo, setTipo] = useState(pestana);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [transcripcion, setTranscripcion] = useState('');
  const [error, setError] = useState('');
  /* Una guarda que no espera al re-render: dos clics seguidos —o un Enter y un clic— entraban los dos
     antes de que el botón se apagara, y se creaban y pagaban dos análisis de la misma transcripción. */
  const enviando = useRef(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    try {
      await enviarUnaVez();
    } finally {
      enviando.current = false;
    }
  };

  const enviarUnaVez = async () => {
    setError('');
    setTrabajando('Analizando la transcripción… puede tardar un par de minutos.');
    const r = await pedir('/api/analizadores/manual', {
      metodo: 'POST',
      cuerpo: { tipo, nombre, email, transcripcion },
      espera: ESPERA_LARGA,
    });
    if (r.tipo !== 'datos') {
      setTrabajando('');
      setError(textoDelRechazo(r));
      return;
    }
    if (r.datos.estado === 'DONE' && tipo === 'HT') {
      setTrabajando('Armando la ficha del prospecto…');
      await pedir(`/api/analizadores/llamadas/${r.datos.id}/ficha`, { metodo: 'POST', espera: ESPERA_LARGA });
    }
    setTrabajando('');
    const mensaje =
      r.datos.estado === 'NOT_MATCH'
        ? `El análisis dice que ${fraseDelVeto(tipo)}: ${r.datos.motivo}`
        : r.datos.estado === 'FAILED'
          ? `El análisis falló: ${r.datos.error}`
          : '';
    alTerminar(r.datos.id, tipo, r.datos.estado, mensaje);
  };

  return (
    <form className="az-form az-bloque" onSubmit={enviar}>
      <h3>Analizar una transcripción pegada a mano</h3>
      <div className="az-filtros">
        {['HT', 'OB'].map((t) => (
          <button
            key={t}
            type="button"
            className={tipo === t ? 'az-boton on' : 'az-boton'}
            disabled={!seAnaliza(t)}
            onClick={() => setTipo(t)}
          >
            {t === 'HT' ? 'Venta (HT)' : 'Onboarding (OB)'}
          </button>
        ))}
      </div>
      <input className="az-campo" placeholder="Nombre del contacto" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <input className="az-campo" type="email" placeholder="Correo del contacto" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} required />
      <textarea
        className="az-campo"
        rows={10}
        placeholder="[00:05] Closer: Hola…  —con marcas de tiempo si las tenés: sin ellas, los tiempos de la evidencia no son reales"
        value={transcripcion}
        onChange={(e) => setTranscripcion(e.target.value)}
        required
      />
      {error ? <div className="az-error">{error}</div> : null}
      <div className="az-acciones">
        <button type="submit" className="az-boton az-primario" disabled={trabajando || !seAnaliza(tipo)}>
          Analizar
        </button>
      </div>
    </form>
  );
}
