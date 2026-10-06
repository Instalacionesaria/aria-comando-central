'use client';

/* El Plan de acción y la tarjeta de Señales de un departamento con detector: Acquisition desde AG9 de los agentes
 * (`docs/OTROS/agentes/fichas/F03-ACQUISITION.md`, «La pantalla»; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`) y
 * Creative Insights desde AG10 (`fichas/F06-CREATIVE-INSIGHTS.md`; `docs/creative/06-EL-PLAN-DE-ACCION.md`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL MARCADO ES EL DEL PROTOTIPO, Y LO QUE DICE LLEGA HECHO
 *
 * El botón «Plan de acción» (`reco-btn`), el modal con sus grupos (`reco-group`) y la tarjeta «Señales
 * detectadas · sin recomendación automática» (`card` con `.sig`) son los de `aios-command-center_1.html`
 * (líneas 2688, 2728 y 5644), con las reglas de `app/aios.css` y las propias en `app/senales.css`, acotadas a las
 * dos vistas. Las frases las arma el servidor con la plantilla de cada regla
 * —métrica, valor y base juntas (A6-06)—; acá sólo se resuelve el nombre de la entidad con lo que la pantalla ya
 * tiene (en Acquisition, las campañas de los embudos y los rótulos de los funnels) y se eligen los rótulos cortos.
 *
 * Lo que cambia entre departamentos está en `DEPARTAMENTOS`: el nombre del subtítulo, si sus ventanas son de días
 * cerrados (las de Acquisition) o llegan hasta hoy (las de Creative, que son las de su pantalla), y si sus
 * señales calculan gente perdida. Creative no la calcula: decir «sin pérdida calculable» en cada señal suya
 * sería ruido.
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
import { decidirSenal, firmarUmbral } from '@/lib/negocio/vistaDeSenales';

const DEPARTAMENTOS = {
  acquisition: { nombre: 'Acquisition', cerrados: true, conPerdida: true },
  creative: { nombre: 'Creative Insights', cerrados: false, conPerdida: false },
};

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
  'CRE-CAIDA-DE-CTR': 'Su CTR va en baja',
  'CRE-CONCENTRACION': 'El gasto se concentra en una pieza',
  'CRE-FRECUENCIA-ALTA': 'La misma gente lo ve muchas veces',
  'CRE-ICP-POR-PIEZA': 'ICP bajo el de su etapa',
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
/** «últimos 7 días cerrados» o «últimos 7 días», según el departamento. */
const ultimos = (d, ventana) => `últimos ${DIAS[ventana]} días${d.cerrados ? ' cerrados' : ''}`;
const sobreQue = (d) => `7 y 30 días${d.cerrados ? ' cerrados' : ''}`;

/** `2026-09-16` → «16 sep». */
function fechaCorta(iso) {
  const [, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`;
}

/**
 * El nombre de la entidad: el de la campaña o el anuncio si el proveedor lo mandó, el rótulo del funnel, el de
 * la pieza, o nada (la empresa entera). Un conjunto no tiene nombre guardado: se dibuja su identificador.
 */
function nombreDe(entidad, nombres, funnels, delServidor = null) {
  if (entidad.tipo === 'empresa') return null;
  // El que resolvió el servidor con `negocio.campanas` y `negocio.anuncios`, que conocen también lo que no tiene datos en la ventana.
  if (delServidor) return delServidor;
  if (entidad.tipo === 'campana') return nombres.get(entidad.id) ?? `Campaña ${entidad.id}`;
  if (entidad.tipo === 'anuncio') return nombres.get(entidad.id) ?? `Anuncio ${entidad.id}`;
  if (entidad.tipo === 'par_de_etapas') return funnels[entidad.id.split(':')[0]]?.nombre ?? entidad.id;
  if (entidad.tipo === 'conjunto') return `Conjunto ${entidad.id}`;
  // Una pieza no tiene otro identificador que su nombre normalizado.
  return entidad.id;
}

// ─── El Plan de acción ──────────────────────────────────────────────────────

/** Sin nombres ni funnels que aportar (Creative): el servidor ya resolvió los de sus señales. */
const SIN_NOMBRES = new Map();
const SIN_FUNNELS = {};

export function BotonDelPlan({ departamento, senales, nombres: deLaPantalla = SIN_NOMBRES, funnels = SIN_FUNNELS }) {
  const [abierto, setAbierto] = useState(false);
  const d = DEPARTAMENTOS[departamento];
  // Los nombres que resolvió el servidor para las señales vivas, sobre los que ya tiene la pantalla.
  const nombres = new Map([...deLaPantalla, ...(senales?.lista ?? []).filter((s) => s.nombre).map((s) => [s.entidad.id, s.nombre])]);
  return (
    <>
      <button type="button" className="reco-btn" onClick={() => setAbierto(true)}>
        <span className="rb-ic" aria-hidden="true">
          ◈
        </span>
        Plan de acción
      </button>
      {abierto ? (
        <Ventana titulo="Plan de acción" subtitulo={subtituloDelPlan(d, senales)} alCerrar={() => setAbierto(false)}>
          <CuerpoDelPlan d={d} senales={senales} nombres={nombres} funnels={funnels} />
        </Ventana>
      ) : null}
    </>
  );
}

function subtituloDelPlan(d, senales) {
  const p = senales?.plan?.plan;
  if (!senales?.ventana) return `${d.nombre} · el plan se calcula sobre ${sobreQue(d)}`;
  const dias = ultimos(d, senales.ventana);
  return p?.periodo ? `${d.nombre} · ${dias} · ${fechaCorta(p.periodo.desde)} – ${fechaCorta(p.periodo.hasta)}` : `${d.nombre} · ${dias}`;
}

function CuerpoDelPlan({ d, senales, nombres, funnels }) {
  if (!senales?.ventana) {
    return <p className="sen-plan-nota">Elige 7 o 30 días: el plan y las señales se calculan sobre {sobreQue(d)}, y «hoy» y «completo» no tienen plan.</p>;
  }
  const guardado = senales.plan;
  if (!guardado) {
    return <p className="sen-plan-nota">Todavía no hay plan para esta ventana: la pasada de los detectores corre cada mañana, después de las 6:00.</p>;
  }
  const p = guardado.plan;
  // La frase que redactó el modelo para cada renglón, si la hay; si no, la de la plantilla con su revisión.
  const redactadas = guardado.redaccion?.renglones ?? {};
  const conRenglones = p.grupos.filter((g) => g.renglones.length > 0);
  return (
    <>
      {conRenglones.length === 0 ? <p className="sen-plan-nota">Se miró y no hay nada que recomendar en esta ventana.</p> : null}
      {conRenglones.map((g) => (
        <div key={g.clave} className={`reco-group ${CLASE_DEL_GRUPO[g.clave] ?? ''}`.trim()}>
          <h4>{g.titulo}</h4>
          {g.renglones.map((r, i) => {
            const nombre = nombreDe(r.entidad, nombres, funnels);
            const redactada = redactadas[`${g.clave}:${i}`];
            return (
              <div key={`${r.regla}:${r.entidad.tipo}:${r.entidad.id}`} className={`reco-item ${CLASE_DEL_GRUPO[g.clave] ?? ''}`.trim()}>
                <span>
                  {nombre ? <b>{nombre}: </b> : null}
                  {redactada ?? `${r.texto} ${r.revision}`}
                  {!d.conPerdida || r.perdidaContactos === null ? null : <span className="sen-perdida"> Pierde unos {r.perdidaContactos} contactos.</span>}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <p className="sen-plan-pie">
        {guardado.bajoElPiso > 0 ? `${guardado.bajoElPiso} ${guardado.bajoElPiso === 1 ? 'detección quedó' : 'detecciones quedaron'} por debajo del piso de muestra y no se publican. ` : ''}
        {p.sinMedicion.length > 0 ? `No se pudo medir: ${p.sinMedicion.join('; ')}. ` : ''}
        Calculado el {fechaCorta(guardado.dia)}.{' '}
        {guardado.redaccion ? 'Las frases las redactó el modelo con las cifras del cálculo; la que traía otra cifra o un superlativo quedó como estaba. ' : ''}
        Lo que alguien ya resolvió o descartó no vuelve a recomendarse.
      </p>
    </>
  );
}

// ─── La tarjeta de Señales ──────────────────────────────────────────────────

export function TarjetaDeSenales({ departamento, senales, puede, nombres = SIN_NOMBRES, funnels = SIN_FUNNELS, alCambiar }) {
  const d = DEPARTAMENTOS[departamento];
  return (
    <div className="card sen-tarjeta">
      <div className="card-head">
        Señales detectadas <span className="hint">sin recomendación automática</span>
      </div>
      {!senales?.ventana ? (
        <p className="sen-nota">Las señales se calculan sobre {sobreQue(d)}: elige uno de los dos para verlas.</p>
      ) : senales.lista.length === 0 ? (
        <p className="sen-nota">Ninguna señal abierta en los {ultimos(d, senales.ventana)}.</p>
      ) : (
        senales.lista.map((s) => (
          <Senal key={s.id} departamento={departamento} s={s} puede={puede} nombre={nombreDe(s.entidad, nombres, funnels, s.nombre)} regla={senales.reglas.find((r) => r.codigo === s.regla)} alCambiar={alCambiar} />
        ))
      )}
    </div>
  );
}

function Senal({ departamento, s, puede, nombre, regla, alCambiar }) {
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
      const r = await decidirSenal(departamento, s.id, 'vista');
      if (r.tipo === 'listo') alCambiar();
    }
  }

  async function confirmar() {
    if (motivo.trim() === '') return;
    setEnviando(true);
    setFallo('');
    const r = await decidirSenal(departamento, s.id, decidiendo, motivo.trim());
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
      <div className="sen-cuerpo">
        <div className="st-t">
          {nombre ? `${nombre} · ` : ''}
          {TITULO[s.regla] ?? s.regla}
        </div>
        <div className="st-d">{s.texto}</div>
        <div className="sen-meta">
          {DEPARTAMENTOS[departamento].conPerdida ? <span>{s.perdidaContactos === null ? 'sin pérdida calculable' : `pierde unos ${s.perdidaContactos} contactos`}</span> : null}
          {s.estado === 'sin_medicion' ? <span className="sen-chip">sin medición hoy</span> : null}
          {s.estado === 'vista' ? <span className="sen-chip">vista</span> : null}
          {s.umbral?.provisional ? <span className="sen-chip">umbral provisional</span> : null}
          {s.requiereValidacionEjecutiva ? <span className="sen-chip sen-chip-ejecutiva">requiere validación ejecutiva</span> : null}
        </div>
        {abierta ? (
          <div className="sen-evidencia">
            <p className="sen-revision">{s.revision}</p>
            {s.causasPosibles.length > 0 ? <p className="sen-causas">Hipótesis: {s.causasPosibles.join('; ')}.</p> : null}
            <Valor v={s.evidencia} />
            {puede.firmar && regla ? <Firma departamento={departamento} regla={regla} alCambiar={alCambiar} /> : null}
          </div>
        ) : null}
        {decidiendo ? (
          <div className="sen-decision">
            <label>
              Motivo para {decidiendo === 'resolver' ? 'resolverla' : 'descartarla'}
              <input type="text" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} disabled={enviando} autoFocus />
            </label>
            <button type="button" className="fd-btn" onClick={confirmar} disabled={enviando || motivo.trim() === ''}>
              {enviando ? 'Guardando…' : 'Confirmar'}
            </button>
            <button type="button" className="fd-btn sec" onClick={() => setDecidiendo(null)} disabled={enviando}>
              Cancelar
            </button>
            {fallo ? <span className="sen-falla-chica">{fallo}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="sen-acciones">
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

/**
 * Cómo se muestra y se escribe el valor de cada unidad. El catálogo guarda una proporción como 0,3; quien firma
 * piensa en «30 %», así que se multiplica para mostrar y se divide para guardar.
 */
const UNIDAD = {
  proporcion: { escala: 100, sufijo: '%' },
  puntos_porcentuales: { escala: 100, sufijo: 'puntos' },
  puntos: { escala: 1, sufijo: 'puntos' },
  dias: { escala: 1, sufijo: 'días' },
  veces: { escala: 1, sufijo: 'veces' },
};
const NUMERO = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });

/** Firmar el umbral de la regla: el valor que se firma pasa a regir desde la próxima pasada. */
function Firma({ departamento, regla, alCambiar }) {
  const u = UNIDAD[regla.unidad] ?? UNIDAD.puntos;
  const enSuUnidad = (x) => `${NUMERO.format(x * u.escala)} ${u.sufijo}`;
  const [valor, setValor] = useState(NUMERO.format(regla.valor * u.escala));
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const numero = Number(valor.replace(/\./g, '').replace(',', '.'));

  async function firmar() {
    setEnviando(true);
    setFallo('');
    const r = await firmarUmbral(departamento, regla.codigo, numero / u.escala);
    setEnviando(false);
    if (r.tipo === 'fallo') setFallo(r.mensaje);
    else alCambiar();
  }

  return (
    <div className="sen-firma">
      <p>
        Umbral {regla.provisional ? 'provisional' : 'firmado'}: {enSuUnidad(regla.valor)}
        {regla.provisional ? '' : ` (el provisional era ${enSuUnidad(regla.valorProvisional)})`}. {regla.porque}
      </p>
      <label>
        Nuevo valor
        <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={enviando} />
        {u.sufijo}
      </label>
      <button type="button" className="fd-btn" onClick={firmar} disabled={enviando || !Number.isFinite(numero) || numero <= 0}>
        {enviando ? 'Firmando…' : 'Firmar umbral'}
      </button>
      {fallo ? <span className="sen-falla-chica">{fallo}</span> : null}
    </div>
  );
}
