'use client';

/* El tablero de Creative: qué pieza funciona, y sobre cuántos datos se está diciendo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA
 *
 * Hasta acá la pestaña la dibujaba `lib/aios/creative.js`: 450 líneas que calculaban EN EL NAVEGADOR
 * el promedio que parte la biblioteca en dos, los siete puntos de una curva de retención, el umbral
 * de las «caídas de atención» y las doce frases de un plan de acción, todo sobre **201 literales
 * inventados**. `bootAios()` lo arrancaba en cada carga de página.
 *
 * ── POR QUÉ SON TRES BLOQUES Y NO UNA TABLA ───────────────────────────────
 *
 * Es la decisión de maquetado que más costó, y sale de las poblaciones:
 *
 *   · la calidad del lead se mide por **(pieza, etapa)** — la regla 3 prohíbe comparar TOFU con
 *     BOFU, así que la misma pieza en dos campañas de etapas distintas son dos filas
 *   · el rendimiento de entrega se mide por **pieza** — el anuncio no sabe en qué etapa del embudo
 *     cae el lead que trajo, así que no hay «hook rate del TOFU de esta pieza»
 *
 * Meterlos en una sola tabla obligaría a repetir el mismo hook rate en las dos filas de la pieza,
 * como si fueran dos mediciones. Serían el mismo número dicho dos veces sobre poblaciones que no lo
 * son — y nadie tendría cómo notarlo.
 *
 * ── Y LA COBERTURA VA ARRIBA DE TODO ──────────────────────────────────────
 *
 * El § 18.5 sólo deja publicar una conclusión por pieza **con su cobertura al lado**. Acá hay tres
 * coberturas distintas y ninguna es nota al pie: el puente nombre↔anuncio (94,5 % medido), los días
 * con cada clave del desglose (56-90 % según cuál) y las piezas con serie suficiente para un
 * veredicto de fatiga (5 de 26).
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerCreative } from '@/lib/negocio/vistaDeCreative';

/** Cuántas piezas se dibujan de entrada en cada tabla. Las demás, detrás de un botón que las cuenta. */
const PIEZAS_A_LA_VISTA = 10;

/** El orden en que se dibujan las etapas: es el del embudo, no el alfabético. */
const ORDEN_DE_ETAPAS = ['TOFU', 'MOFU', 'BOFU'];

export default function PanelDeCreative() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerCreative(periodo);
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

  /* Con `null` como clave el reloj no se registra: con Creative cerrada esto no cuesta una petición.
     Y el dato de entrega es DIARIO —el colector corre una vez por día— así que un tic frecuente
     pediría muchas veces lo mismo. */
  const aLaVista = estaALaVista('creative');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'creative:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="cs-barra">
        {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. */}
        <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
      </div>

      {error ? <p className="cs-grave">{error}</p> : null}

      {cargando && pantalla === null ? (
        <p className="cs-vacio">Leyendo el rendimiento de los creativos…</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana: sin ella, los «ver todas» desplegados
           sobreviven al cambio y quedan describiendo otra ventana con el botón ya consumido. */
        <Cuerpo key={pantalla.periodo} p={pantalla} />
      )}
    </>
  );
}

/* Copia deliberada de `PanelDeAcquisition`: el segmentado es el mismo control y `PERIODOS` la misma
   lista. Sacarlo a un tercer archivo del que dependan las dos pantallas sería más acople que las
   doce líneas que ahorra — la decisión vive en `periodo.ts`, que sí es único. */
function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg cs-periodos" role="group" aria-label="Período de las cifras">
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

/** El porqué de una cifra, detrás de un ícono. `grave` lo deja a la vista. */
function Nota({ texto, grave = false }) {
  if (!texto) return null;
  if (grave) return <p className="cs-grave">{texto}</p>;
  return (
    <span className="cs-nota" title={texto} aria-label={texto} role="note">
      i
    </span>
  );
}

// ─── Formateadores. El guion es «no se sabe», NUNCA un cero. ──────────────────

function plata(v) {
  if (v === null || v === undefined) return null;
  return `$${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function miles(v) {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString('es-PE');
}

function pct(v) {
  return v === null || v === undefined ? null : `${v}%`;
}

/** Una proporción de 0 a 1 a porcentaje entero. */
function tasa(v) {
  return v === null || v === undefined ? null : `${Math.round(v * 100)}%`;
}

function unDecimal(v) {
  return v === null || v === undefined ? null : v.toLocaleString('es-PE', { maximumFractionDigits: 1 });
}

function fechaCorta(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const esteAno = String(new Date().getFullYear());
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}${a === esteAno ? '' : ` ${a}`}`;
}

function Cuerpo({ p }) {
  return (
    <>
      {/* La cobertura ANTES de cualquier ranking. Ver el encabezado. */}
      <Cobertura p={p} />
      <PorEtapa c={p.calidad} />
      <Subasta r={p.rendimiento} />
      <Fatiga f={p.fatiga} />
    </>
  );
}

/**
 * Cuánto vale lo que dice esta pantalla: las tres coberturas y las dos ventanas.
 *
 * No es un bloque de cortesía. Las tres cifras de abajo hablan de tres poblaciones distintas del
 * mismo nombre de pieza, y sin esto una tabla de veinte filas se lee como si todas estuvieran
 * medidas sobre lo mismo.
 */
function Cobertura({ p }) {
  const { puente } = p.calidad;
  const prop = puente.sobre > 0 ? puente.con / puente.sobre : null;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cuánto vale lo que dice esta pantalla</p>
          <p className="csf-m">
            Cada bloque habla de una población distinta, y no se comparan entre sí.
          </p>
        </div>
      </div>

      <div className="csr">
        <span className="csr-n">
          Contactos que se pudieron asociar a una pieza
          <Nota texto="El cruce es por el NOMBRE del creativo, que es lo que el CRM guarda. Los que no cruzan no son un defecto: son tráfico que no viene de un anuncio de Meta, como el enlace del perfil." />
        </span>
        <span className="csr-v">{tasa(prop) ?? '—'}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round((prop ?? 0) * 100)}%` }} />
        </span>
        <span className="csr-p">
          {miles(puente.con)} de {miles(puente.sobre)}
        </span>
      </div>

      {/* Las DOS ventanas, dichas. El gasto arranca cuando arrancó el colector; el desglose de
          acciones, cuando se agregó su columna. Decir «30 días» sobre las dos es falso. */}
      <p className="cs-fuera">
        {p.calidad.desde
          ? `Los contactos van del ${fechaCorta(p.calidad.desde)} al ${fechaCorta(p.calidad.hasta)}. `
          : 'Todavía no hay contactos en esta ventana. '}
        {p.rendimiento.desde
          ? `El gasto, del ${fechaCorta(p.rendimiento.desde)} al ${fechaCorta(p.rendimiento.hasta)}. `
          : 'No hay ningún día de gasto guardado. '}
        {p.rendimiento.desdeElDesglose
          ? `El desglose de acciones —que es de donde salen el hook rate y las tasas de enlace— sólo desde el ${fechaCorta(p.rendimiento.desdeElDesglose)}.`
          : 'El desglose de acciones todavía no tiene ningún día guardado.'}
      </p>

      {p.calidad.aviso ? <Nota texto={p.calidad.aviso} grave /> : null}
    </div>
  );
}

/**
 * Qué gente trae cada pieza, partido por etapa del embudo.
 *
 * Una tabla por etapa y no una columna: la regla 3 no dice «distinguir TOFU de BOFU», dice **no
 * compararlos**. En una sola lista ordenada quedan uno al lado del otro y se comparan solos.
 */
function PorEtapa({ c }) {
  if (c.filas.length === 0) return null;

  const etapas = [...new Set(c.filas.map((f) => f.etapa))].sort((a, b) => {
    const ia = ORDEN_DE_ETAPAS.indexOf(a);
    const ib = ORDEN_DE_ETAPAS.indexOf(b);
    // Lo que no tiene etapa va último: es un grupo, no una etapa del embudo.
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Qué gente trae cada pieza</p>
          <p className="csf-m">
            Separado por etapa del embudo, que se lee del nombre de la campaña. Una pieza de BOFU le
            habla a quien ya conoce la oferta: su tasa no se compara con la de una de TOFU.
          </p>
        </div>
      </div>

      {etapas.map((etapa) => (
        <TablaDeGente
          key={etapa ?? 'sin-etapa'}
          etapa={etapa}
          filas={c.filas.filter((f) => f.etapa === etapa)}
          conIcp={c.campoDeIcp !== null}
        />
      ))}

      {/* Las congeladas NO se repiten acá. El servidor ya manda esa misma frase en `calidad.aviso`
          y el bloque de cobertura la publica: escribirla también en este sitio la mostraba dos veces
          y dejaba el literal copiado en dos lugares que se corrigen por separado. Es la misma
          decisión que `PanelDeAcquisition` tomó con el vacío de su tabla. */}
    </div>
  );
}

function TablaDeGente({ etapa, filas, conIcp }) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? filas : filas.slice(0, PIEZAS_A_LA_VISTA);
  const ocultas = filas.length - visibles.length;

  return (
    <div className="crv-grupo">
      <p className="crv-etapa">
        {etapa ?? 'Sin etapa'}
        {etapa === null ? (
          <Nota texto="El nombre de su campaña no trae un segmento TOFU, MOFU ni BOFU. No se les asigna una: se cuentan aparte." />
        ) : null}
      </p>

      <div className="crv-tabla crv-gente" role="table">
        <div className="crv-fila crv-cab" role="row">
          <span role="columnheader">Pieza</span>
          <span role="columnheader">Contactos</span>
          <span role="columnheader">Agenda</span>
          <span role="columnheader">ICP</span>
          <span role="columnheader">Anuncios</span>
        </div>

        {visibles.map((f) => (
          <div className="crv-fila" role="row" key={`${f.creativo ?? 'sin'}-${f.etapa ?? 'na'}`}>
            <span className="crv-n" role="cell" title={f.creativo ?? undefined}>
              {f.creativo ?? 'Sin creativo'}
              {f.creativo === null ? (
                <Nota texto="Contactos que llegaron sin nombre de pieza. Se cuentan aparte para que la tabla sume la cohorte entera." />
              ) : null}
              {f.anunciosDeMeta === 0 && f.creativo !== null ? (
                <Nota texto="Este nombre no corresponde a ningún anuncio de Meta guardado. Puede ser tráfico orgánico, una prueba, o una pieza que se renombró." />
              ) : null}
            </span>
            <span role="cell">{miles(f.contactos)}</span>
            {/* La tasa y su denominador juntos: «100 %» sobre un contacto se lee igual que sobre cien. */}
            <span role="cell">
              {tasa(f.tasaDeAgenda) ?? '—'}
              <em className="crv-de"> {f.agendaron}/{f.contactos}</em>
            </span>
            <span role="cell">
              {conIcp ? (unDecimal(f.icpPromedio) ?? '—') : '—'}
              {conIcp && f.conPuntaje > 0 ? <em className="crv-de"> n={f.conPuntaje}</em> : null}
            </span>
            <span role="cell">{f.anunciosDeMeta > 0 ? miles(f.anunciosDeMeta) : '—'}</span>
          </div>
        ))}
      </div>

      {ocultas > 0 ? (
        <button type="button" className="crv-mas" onClick={() => setTodas(true)}>
          Ver las {ocultas} piezas que faltan
        </button>
      ) : null}
    </div>
  );
}

/**
 * Cómo se comportó cada pieza en la subasta.
 *
 * Por pieza y no por (pieza, etapa): el anuncio no sabe en qué etapa cae el lead que trajo.
 */
function Subasta({ r }) {
  const [todas, setTodas] = useState(false);
  if (r.filas.length === 0) return null;

  const visibles = todas ? r.filas : r.filas.slice(0, PIEZAS_A_LA_VISTA);
  const ocultas = r.filas.length - visibles.length;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cómo se comportó cada pieza en la subasta</p>
          <p className="csf-m">
            Ordenadas por gasto, que es un hecho. Ése no es el orden del negocio: para eso hacen
            falta las ventas, y ésas son de Business.
          </p>
        </div>
        <div className="csf-key">{plata(r.gastoTotal) ?? '—'}</div>
      </div>

      <div className="crv-tabla crv-subasta" role="table">
        <div className="crv-fila crv-cab" role="row">
          <span role="columnheader">Pieza</span>
          <span role="columnheader">Gasto</span>
          <span role="columnheader">CTR</span>
          <span role="columnheader">Hook</span>
          <span role="columnheader">Link CTR</span>
          <span role="columnheader">Landing</span>
        </div>

        {visibles.map((f) => (
          <div className="crv-fila" role="row" key={f.creativo}>
            <span className="crv-n" role="cell" title={f.creativo}>
              {f.creativo}
              {/* Lo que no cabe en una columna va acá, y la interacción es el caso: tiene la mejor
                  cobertura de las cuatro tasas (90 %) y es la menos accionable de las cuatro, así
                  que gastar una columna en ella empujaría fuera al link CTR en el ancho de un
                  teléfono. Lo que NO se hace es calcularla y no mostrarla en ninguna parte: un campo
                  que viaja en la respuesta y nadie dibuja se pudre sin que nada falle. */}
              <Nota
                texto={[
                  f.diasConEntrega === 0
                    ? 'No entregó ni un día de esta ventana. No es que gastara cero: no se mostró.'
                    : `Corre en ${f.anuncios} anuncio(s) y entregó ${f.diasConEntrega} día(s) de la ventana.`,
                  f.interaccion.tasa !== null
                    ? `Interacción con la publicación: ${f.interaccion.tasa}% de las impresiones, sobre ${f.interaccion.diasConLaClave} de ${f.interaccion.diasConEntrega} día(s).`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </span>
            <span role="cell">{plata(f.gasto) ?? '—'}</span>
            <span role="cell">{pct(f.ctr) ?? '—'}</span>
            <CeldaDeAccion t={f.hookRate} />
            <CeldaDeAccion t={f.linkCtr} />
            <CeldaDeAccion t={f.landingPageViewRate} />
          </div>
        ))}
      </div>

      {ocultas > 0 ? (
        <button type="button" className="crv-mas" onClick={() => setTodas(true)}>
          Ver las {ocultas} piezas que faltan
        </button>
      ) : null}

      {r.aviso ? <p className="cs-fuera">{r.aviso}</p> : null}
    </div>
  );
}

/**
 * Una tasa del desglose, con la cobertura de su propio numerador.
 *
 * El denominador de estas tasas son los días que TRAEN la clave, no todos los de la ventana. Sin
 * decir cuántos son, una tasa calculada sobre tres días de veinte se lee igual que una de veinte.
 */
function CeldaDeAccion({ t }) {
  if (t.diasConLaClave === 0) {
    return (
      <span role="cell">
        —
        <Nota texto="El proveedor no reportó esta acción ningún día de la ventana. No es cero: una pieza que no es video nunca tiene reproducciones." />
      </span>
    );
  }
  return (
    <span role="cell">
      {pct(t.tasa) ?? '—'}
      {t.diasConLaClave < t.diasConEntrega ? (
        <em className="crv-de"> {t.diasConLaClave}/{t.diasConEntrega}d</em>
      ) : null}
    </span>
  );
}

/** Qué piezas están perdiendo gancho. La mitad del indicador del § 18.12 que sí se puede construir. */
function Fatiga({ f }) {
  const conVeredicto = f.filas.filter((x) => x.fatigado !== null);
  if (conVeredicto.length === 0 && f.filas.length === 0) return null;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Qué piezas están perdiendo gancho</p>
          <p className="csf-m">
            La serie se parte en dos mitades y se comparan sus CTR. No se mide la frecuencia: no se
            puede agregar a lo largo de días ni de anuncios.
          </p>
        </div>
        <div className="csf-key">
          {f.conSerie.con}/{f.conSerie.sobre}
        </div>
      </div>

      {conVeredicto.length === 0 ? (
        <p className="cs-fuera">
          Ninguna pieza tiene serie suficiente para un veredicto todavía. Se muestra cuántos días
          lleva cada una en la tabla de arriba.
        </p>
      ) : (
        <div className="crv-tabla crv-fatiga" role="table">
          <div className="crv-fila crv-cab" role="row">
            <span role="columnheader">Pieza</span>
            <span role="columnheader">Días</span>
            <span role="columnheader">CTR al empezar</span>
            <span role="columnheader">CTR al final</span>
            <span role="columnheader">Cambio</span>
          </div>

          {conVeredicto.map((x) => (
            <div className={x.fatigado ? 'crv-fila crv-cansada' : 'crv-fila'} role="row" key={x.creativo}>
              <span className="crv-n" role="cell" title={x.creativo}>
                {x.creativo}
              </span>
              <span role="cell">{x.dias}</span>
              <span role="cell">{pct(x.ctrTemprano) ?? '—'}</span>
              <span role="cell">{pct(x.ctrTardio) ?? '—'}</span>
              {/* El signo dice la dirección: una caída es negativa en pantalla aunque el campo la
                  guarde positiva, porque lo que la persona lee es «cuánto cambió el CTR». */}
              <span role="cell">{x.caida === null ? '—' : `${x.caida > 0 ? '−' : '+'}${Math.abs(Math.round(x.caida * 100))}%`}</span>
            </div>
          ))}
        </div>
      )}

      {f.aviso ? <p className="cs-fuera">{f.aviso}</p> : null}
    </div>
  );
}
