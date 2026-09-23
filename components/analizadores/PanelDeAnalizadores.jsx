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
   pendientes UNA POR PETICIÓN, en orden: cada análisis tiene así su propia función de 300 s. Si dos
   pestañas lo hacen a la vez, el candado de la base deja ganar a una por llamada, y la otra recibe
   `llamada_en_curso` y sigue con la siguiente.

   ── VACÍO Y ERROR NO SON LO MISMO ─────────────────────────────────────────

   «No hay llamadas» y «no se pudo leer» se dibujan distinto. Es la lección que dejó el error del
   Research que se escribía en un cajón cerrado (`pruebas/codigo/148`): un fallo que se ve como una
   lista vacía es un fallo que nadie reporta.

   ── NO HAY RELOJ ──────────────────────────────────────────────────────────

   La lista se refresca después de cada acción y al volver a la pestaña. Las llamadas nuevas llegan
   con la tarea de cada hora, así que un reloj de segundos pediría la misma lista cientos de veces
   para no traer nada. */

import { useCallback, useEffect, useState } from 'react';

import { pedir } from '../../lib/http/cliente.ts';
import { estaALaVista } from '@/lib/vista';
import DetalleHt from './DetalleHt.jsx';

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

const TEXTO_DEL_ESTADO = {
  PENDING: 'Pendiente',
  ANALYZING: 'Analizando',
  DONE: 'Analizada',
  NOT_MATCH: 'No corresponde',
  FAILED: 'Falló',
};
const CHIP_DEL_ESTADO = { PENDING: 'warn', ANALYZING: 'warn', DONE: 'ok', NOT_MATCH: 'warn', FAILED: 'crit' };

/* Los rechazos que la pantalla sabe nombrar. El `detalle` del servidor, si viene, gana: es más
   preciso que cualquier frase de acá. */
const MENSAJES = {
  sin_permiso: 'Tu usuario puede ver los Analizadores pero no analizar ni cambiar nada.',
  sin_llave_de_ia:
    'Falta la llave de IA de la empresa. Se carga en Integraciones; si no la ves, pedíselo a un administrador.',
  llave_de_ia_ilegible: 'La llave de IA está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  sin_llave_de_tldv:
    'Falta la llave de tl;dv. Se carga en Integraciones; sin ella igual podés pegar una transcripción a mano.',
  llave_de_tldv_ilegible: 'La llave de tl;dv está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  base_no_disponible: 'No se pudo leer la base. No es que no haya llamadas: no se pudo preguntar.',
};

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
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(false);
  const [trabajando, setTrabajando] = useState('');
  const [aviso, setAviso] = useState('');

  const aLaVista = estaALaVista('analizadores');

  const cargarLista = useCallback(async () => {
    const r = await pedir(`/api/analizadores/llamadas?tipo=${pestana}&filtro=${filtro}`);
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
  }, [aLaVista, cargarLista]);

  useEffect(() => {
    if (!aLaVista || estado !== null) return;
    (async () => {
      const r = await pedir('/api/analizadores/estado');
      if (r.tipo === 'datos') setEstado(r.datos);
    })();
  }, [aLaVista, estado]);

  const seAnaliza = (tipo) => (estado?.tiposQueSeAnalizan ?? []).includes(tipo);

  /** Analiza una llamada y, si es una HT que quedó DONE, pide su ficha enseguida. */
  const analizarUna = useCallback(async (id, tipo) => {
    const r = await pedir(`/api/analizadores/llamadas/${id}/analizar`, { metodo: 'POST', espera: ESPERA_LARGA });
    if (r.tipo !== 'datos') return { ok: false, mensaje: textoDelRechazo(r) };
    if (r.datos.estado === 'DONE' && tipo === 'HT') {
      await pedir(`/api/analizadores/llamadas/${id}/ficha`, { metodo: 'POST', espera: ESPERA_LARGA });
    }
    return { ok: true, estado: r.datos.estado, error: r.datos.error };
  }, []);

  const alAnalizar = async (l) => {
    setTrabajando(`Analizando «${l.titulo ?? 'la llamada'}»…`);
    const r = await analizarUna(l.id, l.tipo);
    setTrabajando('');
    setAviso(r.ok ? (r.estado === 'FAILED' ? `El análisis falló: ${r.error}` : '') : r.mensaje);
    await cargarLista();
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
       una decisión de alguien que lee el error, no algo que se repite solo. */
    let analizadas = 0;
    for (const tipo of estado?.tiposQueSeAnalizan ?? []) {
      const p = await pedir(`/api/analizadores/llamadas?tipo=${tipo}&filtro=pendientes`);
      if (p.tipo !== 'datos') break;
      const pendientes = p.datos.llamadas.filter((l) => l.estado === 'PENDING').reverse();
      for (const [i, l] of pendientes.entries()) {
        setTrabajando(`Analizando ${i + 1} de ${pendientes.length} (${tipo})…`);
        const a = await analizarUna(l.id, l.tipo);
        if (a.ok) analizadas++;
      }
    }
    setTrabajando('');
    setAviso(`tl;dv: ${partes.join(' · ')}. Analizadas ahora: ${analizadas}.`);
    await cargarLista();
  };

  const alMover = async (l, tipo) => {
    const r = await pedir(`/api/analizadores/llamadas/${l.id}`, { metodo: 'PATCH', cuerpo: { tipo } });
    setAviso(r.tipo === 'datos' ? '' : textoDelRechazo(r));
    await cargarLista();
  };

  const alBorrar = async (l) => {
    // Borrar deja lápida: la reunión no vuelve a entrar desde tl;dv. Se pregunta antes.
    if (!window.confirm('¿Borrar esta llamada? No vuelve a entrar desde tl;dv.')) return;
    const r = await pedir(`/api/analizadores/llamadas/${l.id}`, { metodo: 'DELETE' });
    setAviso(r.tipo === 'datos' ? '' : textoDelRechazo(r));
    await cargarLista();
  };

  if (detalle !== null) {
    return (
      <DetalleHt
        id={detalle}
        alVolver={() => {
          setDetalle(null);
          cargarLista();
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

      {!seAnaliza(pestana) && estado ? (
        <div className="az-aviso">
          Las reuniones de onboarding se clasifican y se guardan desde ya, y se analizan cuando llegue la
          fase OB. Mientras tanto, si una venta quedó acá por error, se puede mover a HT.
        </div>
      ) : null}

      {formulario ? (
        <Manual
          pestana={pestana}
          seAnaliza={seAnaliza}
          alTerminar={async (id, tipo, estadoFinal) => {
            setFormulario(false);
            if (estadoFinal === 'DONE') setDetalle(tipo === 'HT' ? id : null);
            await cargarLista();
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
                {l.tipo === 'OTRO' ? ' · no es HT ni OB' : ''}
              </div>
              {/* El motivo de un descarte y el error de un fallo, cada uno con su nombre. La
                  transcripción NO se muestra nunca: una OTRO suele ser una reunión interna. */}
              {l.motivo ? <div className="az-fila-m">Por qué no corresponde: {l.motivo}</div> : null}
              {l.estado === 'FAILED' && l.error ? <div className="az-error">{l.error}</div> : null}
              {l.estado === 'DONE' && l.tipo === 'OB' && l.resumen ? <div className="az-fila-m">{l.resumen}</div> : null}
            </div>
            <div className="az-acciones">
              {l.estado === 'DONE' && l.puntaje !== null ? (
                <span className={`az-puntaje az-${(l.colorDelPuntaje ?? '').toLowerCase()}`}>{l.puntaje}</span>
              ) : null}
              <span className={`chip ${CHIP_DEL_ESTADO[l.estado]}`}>{TEXTO_DEL_ESTADO[l.estado]}</span>
              {l.estado === 'DONE' && l.tipo === 'HT' ? (
                <button type="button" className="az-boton" onClick={() => setDetalle(l.id)}>
                  Ver
                </button>
              ) : null}
              {l.estado === 'DONE' && l.tipo === 'OB' ? (
                <span className="az-fila-m">El detalle de OB llega en la fase OB</span>
              ) : null}
              {l.tipo !== 'OTRO' && (l.estado === 'PENDING' || l.estado === 'FAILED' || colgada(l)) ? (
                <button
                  type="button"
                  className="az-boton"
                  disabled={trabajando !== '' || !seAnaliza(l.tipo)}
                  title={seAnaliza(l.tipo) ? undefined : 'Se analiza en la fase OB.'}
                  onClick={() => alAnalizar(l)}
                >
                  {l.estado === 'PENDING' ? 'Analizar' : 'Reintentar'}
                </button>
              ) : null}
              {l.estado !== 'DONE' && l.estado !== 'ANALYZING'
                ? otros(l.tipo).map((t) => (
                    <button key={t} type="button" className="az-boton" onClick={() => alMover(l, t)}>
                      {t === 'OTRO' ? 'No corresponde' : `Mover a ${t}`}
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
function Manual({ pestana, seAnaliza, alTerminar, setTrabajando }) {
  const [tipo, setTipo] = useState(pestana);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [transcripcion, setTranscripcion] = useState('');
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
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
    if (r.datos.estado === 'NOT_MATCH') setError(`El análisis dice que no corresponde: ${r.datos.motivo}`);
    if (r.datos.estado === 'FAILED') setError(`El análisis falló: ${r.datos.error}`);
    await alTerminar(r.datos.id, tipo, r.datos.estado);
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
        <button type="submit" className="az-boton az-primario" disabled={!seAnaliza(tipo)}>
          Analizar
        </button>
      </div>
    </form>
  );
}
