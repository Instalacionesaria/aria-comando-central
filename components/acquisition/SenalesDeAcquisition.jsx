'use client';

/* El Plan de acción y la tarjeta de Señales de Acquisition (AG9 de los agentes; `docs/OTROS/agentes/fichas/F03-ACQUISITION.md`,
 * «La pantalla»; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LO QUE DICE LLEGA HECHO
 *
 * El botón «Plan de acción» (`reco-btn`), el modal con sus grupos (`reco-group`) y la tarjeta «Señales
 * detectadas · sin recomendación automática» (`card` con `.sig`) son los de `aios-command-center_1.html`
 * (líneas 2688, 2728 y 5644), con las reglas de `app/aios.css`. Las frases las arma el servidor con la
 * plantilla de cada regla —métrica, valor y base juntas (A6-06)—; acá sólo se resuelve el nombre de la
 * entidad con lo que la pantalla ya tiene (las campañas de los embudos y los rótulos de los funnels) y se
 * eligen los rótulos cortos.
 *
 * ── LO QUE SE PUEDE HACER, Y QUIÉN ───────────────────────────────────────────
 *
 * «Ver evidencia» despliega lo que midió la regla y la marca vista (AG-24), si la sesión puede. Resolver y
 * descartar piden motivo; lo de validación ejecutiva sólo lo ofrece a quien puede validarlo; firmar el umbral,
 * a quien puede firmar. Lo decide el servidor (`puedeConSenales`) y lo vuelve a comprobar en cada ruta: un
 * botón que va a dar 403 no se dibuja (el `07` § 4).
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Ventana from '../Ventana.jsx';
import { Valor } from '../cerebro/Evidencia.jsx';
import { decidirSenal, firmarUmbralDeAcquisition } from '@/lib/negocio/vistaDeAcquisition';

/** El rótulo corto de cada regla, para el título de la señal. El texto largo lo trae el servidor. */
const TITULO = {
  'ACQ-SIN-ENTREGA': 'Sin entrega',
  'ACQ-CPL-SOSTENIDO': 'Sube el costo por contacto',
  'ACQ-GASTO-SIN-CRECIMIENTO': 'El gasto sube y los contactos no',
  'ACQ-CONCENTRACION': 'El gasto se concentra en una campaña',
  'ACQ-ICP-ENTRE-CAMPANAS': 'ICP bajo el de su funnel',
  'ACQ-ESCALA-POR-CALIFICADO': 'Calificados más baratos que los de la empresa',
  'ACQ-FUGA-ENTRE-ETAPAS': 'Fuga entre el contacto y la agenda',
  'ACQ-CPM-ABRUPTO': 'Sube el costo por mil impresiones',
  'ACQ-CAMBIO-BRUSCO-CONJUNTO': 'Cambio brusco en un conjunto',
  'ACQ-ATRIBUCION-CONTACTOS': 'Contactos sin anuncio',
  'ACQ-ATRIBUCION-CITAS': 'Citas sin anuncio',
  'ACQ-ATRIBUCION-VENTAS': 'Ventas sin anuncio',
  'ACQ-ATRIBUCION-UTM': 'UTM incompletas',
  'ACQ-ATRIBUCION-SIN-CAMPANA': 'Contactos sin campaña',
};

/** El ícono y el color de cada gravedad, como los del prototipo (`.sig .si`). */
const GRAVEDAD = {
  critica: { icono: '!', clase: 'g-critica', nombre: 'crítica' },
  alta: { icono: '↑', clase: 'g-alta', nombre: 'alta' },
  media: { icono: '↻', clase: 'g-media', nombre: 'media' },
  info: { icono: 'i', clase: 'g-info', nombre: 'informativa' },
};

/** Los grupos del plan, con la clase del prototipo: rojo lo que se ajusta, verde lo que se hace más. */
const CLASE_DEL_GRUPO = { data: '', ajusta: 'bad', haz_mas: 'good', otras_areas: 'idea', validacion: 'idea' };

const DIAS = { '7d': 7, '30d': 30 };

/** `2026-09-16` → «16 sep». */
function fechaCorta(iso) {
  const [, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`;
}

/**
 * El nombre de la entidad: el de la campaña si GoHighLevel lo mandó, el rótulo del funnel, o nada (la
 * empresa entera). Un conjunto no tiene nombre guardado: se dibuja su identificador.
 */
function nombreDe(entidad, nombres, funnels) {
  if (entidad.tipo === 'empresa') return null;
  if (entidad.tipo === 'campana') return nombres.get(entidad.id) ?? `Campaña ${entidad.id}`;
  if (entidad.tipo === 'par_de_etapas') return funnels[entidad.id.split(':')[0]]?.nombre ?? entidad.id;
  if (entidad.tipo === 'conjunto') return `Conjunto ${entidad.id}`;
  return entidad.id;
}

// ─── El Plan de acción ──────────────────────────────────────────────────────

export function BotonDelPlan({ senales, nombres, funnels }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="reco-btn" onClick={() => setAbierto(true)}>
        <span className="rb-ic" aria-hidden="true">
          ◈
        </span>
        Plan de acción
      </button>
      {abierto ? (
        <Ventana titulo="Plan de acción" subtitulo={subtituloDelPlan(senales)} alCerrar={() => setAbierto(false)}>
          <CuerpoDelPlan senales={senales} nombres={nombres} funnels={funnels} />
        </Ventana>
      ) : null}
    </>
  );
}

function subtituloDelPlan(senales) {
  const p = senales?.plan?.plan;
  if (!senales?.ventana) return 'Acquisition · el plan se calcula sobre 7 y 30 días cerrados';
  const dias = `últimos ${DIAS[senales.ventana]} días cerrados`;
  return p?.periodo ? `Acquisition · ${dias} · ${fechaCorta(p.periodo.desde)} – ${fechaCorta(p.periodo.hasta)}` : `Acquisition · ${dias}`;
}

function CuerpoDelPlan({ senales, nombres, funnels }) {
  if (!senales?.ventana) {
    return <p className="acq-plan-nota">Elige 7 o 30 días: el plan y las señales se calculan sobre días cerrados, y «hoy» y «completo» no comparan contra nada.</p>;
  }
  const guardado = senales.plan;
  if (!guardado) {
    return <p className="acq-plan-nota">Todavía no hay plan para esta ventana: la pasada de los detectores corre cada mañana, después de las 6:00.</p>;
  }
  const p = guardado.plan;
  const conRenglones = p.grupos.filter((g) => g.renglones.length > 0);
  return (
    <>
      {conRenglones.length === 0 ? <p className="acq-plan-nota">Se miró y no hay nada que recomendar en esta ventana.</p> : null}
      {conRenglones.map((g) => (
        <div key={g.clave} className={`reco-group ${CLASE_DEL_GRUPO[g.clave] ?? ''}`.trim()}>
          <h4>{g.titulo}</h4>
          {g.renglones.map((r) => {
            const nombre = nombreDe(r.entidad, nombres, funnels);
            return (
              <div key={`${r.regla}:${r.entidad.tipo}:${r.entidad.id}`} className={`reco-item ${CLASE_DEL_GRUPO[g.clave] ?? ''}`.trim()}>
                <span>
                  {nombre ? <b>{nombre}: </b> : null}
                  {r.texto} {r.revision}
                  {r.perdidaContactos === null ? null : <span className="acq-perdida"> Pierde unos {r.perdidaContactos} contactos.</span>}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <p className="acq-plan-pie">
        {guardado.bajoElPiso > 0 ? `${guardado.bajoElPiso} ${guardado.bajoElPiso === 1 ? 'detección quedó' : 'detecciones quedaron'} por debajo del piso de muestra y no se publican. ` : ''}
        {p.sinMedicion.length > 0 ? `No se pudo medir: ${p.sinMedicion.join('; ')}. ` : ''}
        Calculado el {fechaCorta(guardado.dia)}. Lo que alguien ya resolvió o descartó no vuelve a recomendarse.
      </p>
    </>
  );
}

// ─── La tarjeta de Señales ──────────────────────────────────────────────────

export function TarjetaDeSenales({ senales, puede, nombres, funnels, alCambiar }) {
  return (
    <div className="card acq-senales">
      <div className="card-head">
        Señales detectadas <span className="hint">sin recomendación automática</span>
      </div>
      {!senales?.ventana ? (
        <p className="acq-sig-nota">Las señales se calculan sobre 7 y 30 días cerrados: elige uno de los dos para verlas.</p>
      ) : senales.lista.length === 0 ? (
        <p className="acq-sig-nota">Ninguna señal abierta en los últimos {DIAS[senales.ventana]} días cerrados.</p>
      ) : (
        senales.lista.map((s) => (
          <Senal key={s.id} s={s} puede={puede} nombre={nombreDe(s.entidad, nombres, funnels)} regla={senales.reglas.find((r) => r.codigo === s.regla)} alCambiar={alCambiar} />
        ))
      )}
    </div>
  );
}

function Senal({ s, puede, nombre, regla, alCambiar }) {
  const [abierta, setAbierta] = useState(false);
  const [decidiendo, setDecidiendo] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const g = GRAVEDAD[s.gravedad] ?? GRAVEDAD.media;
  // Resolver o descartar lo de validación ejecutiva sólo lo ofrece a quien puede validarlo.
  const puedeDecidir = puede.resolver && (!s.requiereValidacionEjecutiva || puede.validar);

  async function verEvidencia() {
    const abrir = !abierta;
    setAbierta(abrir);
    // «Vista» la marca quien la abre, y sólo la primera vez (AG-24). Si falla, no se dice: no cambia nada.
    if (abrir && s.estado === 'abierta' && puede.resolver) {
      const r = await decidirSenal(s.id, 'vista');
      if (r.tipo === 'listo') alCambiar();
    }
  }

  async function confirmar() {
    if (motivo.trim() === '') return;
    setEnviando(true);
    setFallo('');
    const r = await decidirSenal(s.id, decidiendo, motivo.trim());
    setEnviando(false);
    if (r.tipo === 'fallo') {
      setFallo(r.mensaje);
      return;
    }
    setDecidiendo(null);
    setMotivo('');
    alCambiar();
  }

  return (
    <div className="sig">
      <span className={`si ${g.clase}`} title={`Gravedad ${g.nombre}`} aria-label={`Gravedad ${g.nombre}`}>
        {g.icono}
      </span>
      <div className="acq-sig-cuerpo">
        <div className="st-t">
          {nombre ? `${nombre} · ` : ''}
          {TITULO[s.regla] ?? s.regla}
        </div>
        <div className="st-d">{s.texto}</div>
        <div className="acq-sig-meta">
          <span>{s.perdidaContactos === null ? 'sin pérdida calculable' : `pierde unos ${s.perdidaContactos} contactos`}</span>
          {s.estado === 'sin_medicion' ? <span className="acq-chip">sin medición hoy</span> : null}
          {s.estado === 'vista' ? <span className="acq-chip">vista</span> : null}
          {s.umbral?.provisional ? <span className="acq-chip">umbral provisional</span> : null}
          {s.requiereValidacionEjecutiva ? <span className="acq-chip acq-chip-ejecutiva">requiere validación ejecutiva</span> : null}
        </div>
        {abierta ? (
          <div className="acq-sig-evidencia">
            <p className="acq-sig-revision">{s.revision}</p>
            {s.causasPosibles.length > 0 ? <p className="acq-sig-causas">Hipótesis: {s.causasPosibles.join('; ')}.</p> : null}
            <Valor v={s.evidencia} />
            {puede.firmar && regla ? <Firma regla={regla} alCambiar={alCambiar} /> : null}
          </div>
        ) : null}
        {decidiendo ? (
          <div className="acq-sig-decision">
            <label>
              Motivo para {decidiendo === 'resolver' ? 'resolverla' : 'descartarla'}
              <input type="text" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} disabled={enviando} autoFocus />
            </label>
            <button type="button" onClick={confirmar} disabled={enviando || motivo.trim() === ''}>
              {enviando ? 'Guardando…' : 'Confirmar'}
            </button>
            <button type="button" className="acq-sig-secundario" onClick={() => setDecidiendo(null)} disabled={enviando}>
              Cancelar
            </button>
            {fallo ? <span className="acq-falla-chica">{fallo}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="acq-sig-acciones">
        <button type="button" className="ev" onClick={verEvidencia} aria-expanded={abierta}>
          {abierta ? 'Ocultar evidencia' : 'Ver evidencia'}
        </button>
        {puedeDecidir && !decidiendo ? (
          <>
            <button type="button" className="ev" onClick={() => setDecidiendo('resolver')}>
              Resolver
            </button>
            <button type="button" className="ev" onClick={() => setDecidiendo('descartar')}>
              Descartar
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Firmar el umbral de la regla: el valor que se firma pasa a regir desde la próxima pasada. */
function Firma({ regla, alCambiar }) {
  const [valor, setValor] = useState(String(regla.valor));
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const numero = Number(valor.replace(',', '.'));

  async function firmar() {
    setEnviando(true);
    setFallo('');
    const r = await firmarUmbralDeAcquisition(regla.codigo, numero);
    setEnviando(false);
    if (r.tipo === 'fallo') setFallo(r.mensaje);
    else alCambiar();
  }

  return (
    <div className="acq-sig-firma">
      <p>
        Umbral {regla.provisional ? 'provisional' : 'firmado'}: {regla.valor}
        {regla.provisional ? '' : ` (el provisional era ${regla.valorProvisional})`}. {regla.porque}
      </p>
      <label>
        Valor
        <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={enviando} />
      </label>
      <button type="button" onClick={firmar} disabled={enviando || !Number.isFinite(numero) || numero <= 0}>
        {enviando ? 'Firmando…' : 'Firmar umbral'}
      </button>
      {fallo ? <span className="acq-falla-chica">{fallo}</span> : null}
    </div>
  );
}
