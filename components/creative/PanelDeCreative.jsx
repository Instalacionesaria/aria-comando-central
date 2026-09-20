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
 * coberturas distintas y ninguna es nota al pie: el puente nombre↔anuncio, los días con cada clave
 * del desglose y las piezas con VEREDICTO de fatiga —que no son las que tienen serie suficiente:
 * medido el 2026-09-20, de las 21 sin veredicto hay 6 que tienen los ocho días y les falta volumen—.
 *
 * **Las cifras no se escriben acá, y eso es deliberado.** Este bloque decía «94,5 %», «56-90 %» y
 * «5 de 26», y las tres estaban vencidas al mismo tiempo: la primera era de la ventana «completo»
 * y no de la que abre la pantalla —y además de un denominador que desde el 2026-09-19 ya no es el
 * que se usa—, y la tercera daba 11 y no 5. Un comentario con una cifra medida envejece cada vez
 * que entra un dato, y no hay nada que lo avise. Las tres las publica la pantalla, calculadas.
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
      {/* Y lo último: qué NO muestra esta pantalla, y por qué. Ver `Huecos`. */}
      <Huecos lista={p.rendimiento.fueraDeAlcance} />
    </>
  );
}

/**
 * Lo que esta pantalla NO puede mostrar, dicho en la pantalla.
 *
 * ── VA ACÁ Y NO EN UN DOCUMENTO, POR DOS MOTIVOS ────────────────────────────
 *
 * El primero es el del patrón: `calidadDeLaAtribucion.ts:69` dice que los huecos *«viajan para que
 * nadie los rehaga»*, y medir éstos costó un día de sondas contra la API del proveedor.
 *
 * El segundo es de esta pantalla en particular. **La maqueta que había acá dibujaba estas cuatro
 * cosas con números inventados**: una curva de retención, un desglose por placement, la miniatura
 * de cada pieza. Quien conocía esa pantalla va a buscarlas, y si no están ni se dice por qué, la
 * lectura razonable es que algo se rompió. La diferencia entre un hueco declarado y una regresión
 * es exactamente este párrafo.
 *
 * Si la lista llega vacía —el día que alguien conecte Meta directo— **no se dibuja nada**: es la
 * regla del silencio, y un bloque que dice «no falta nada» es ruido permanente.
 */
function Huecos({ lista }) {
  if (!lista?.length) return null;
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Lo que esta pantalla no puede medir</p>
          <p className="csf-m">
            Medido contra la API de GoHighLevel el 18 de septiembre de 2026. No son cosas pendientes
            de programar: son datos que esta vía no entrega.
          </p>
        </div>
      </div>
      {lista.map((f) => (
        <p className="cs-fuera" key={f.punto}>
          <b>{f.punto}</b>: {f.porque}.
        </p>
      ))}
    </div>
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
          <Nota
            texto={
              `El cruce es por el NOMBRE del creativo, que es lo que el CRM guarda. De los ` +
              `${puente.sobre - puente.con} que no cruzan, ${puente.sinNombre} no traen ningún ` +
              `nombre de pieza —tráfico que no vino de un anuncio, como el enlace del perfil— y ` +
              `${puente.sobre - puente.con - puente.sinNombre} traen uno que no existe en la tabla ` +
              `de anuncios: ahí sí puede haber un renombre en Meta o una etiqueta sin expandir.`
            }
          />
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
          {/* Los tres rótulos cortos con su DEFINICIÓN detrás, que VIAJA en la respuesta y no es
              una copia escrita acá: la definición es del dato, no de la columna. «Hook» no dice
              nada solo, y el de `videoView` importa más que los otros dos porque el proveedor no
              documenta si cuenta tres segundos o un ThruPlay.

              No se importa `ACCIONES_QUE_LEEMOS` directamente: este archivo es `'use client'` y ese
              módulo abre la base, así que importarlo arrastra `pg` —y con él `fs`, `dns` y `net`—
              al paquete del navegador. El build falla con «Can't resolve 'dns'», que es la forma
              ruidosa de un error que conviene que sea ruidosa. */}
          <span role="columnheader" title={r.titulos.videoView}>
            Hook
          </span>
          <span role="columnheader" title={r.titulos.linkClick}>
            Link CTR
          </span>
          <span role="columnheader" title={r.titulos.landingPageView}>
            Landing
          </span>
        </div>

        {visibles.map((f) => (
          <div className="crv-fila" role="row" key={f.creativo}>
            <span className="crv-n" role="cell" title={f.creativo}>
              {f.creativo}
              {/* Lo que no cabe en una columna va acá. Son DOS: la interacción —la mejor cobertura
                  de las cuatro tasas (90 %) y la menos accionable— y el click-to-landing, que
                  gastarles una columna a cada una empujaría fuera al link CTR en el ancho de un
                  teléfono.

                  La última frase de este comentario decía: *«Lo que NO se hace es calcularla y no
                  mostrarla en ninguna parte: un campo que viaja en la respuesta y nadie dibuja se
                  pudre sin que nada falle»*. **Y eso era exactamente lo que pasaba con el
                  click-to-landing**: tres agregados SQL propios, su prueba, su viaje hasta acá, y
                  cero píxeles. El comentario describía el defecto del archivo que lo contenía. */}
              <Nota
                texto={[
                  f.diasConEntrega === 0
                    ? 'No entregó ni un día de esta ventana. No es que gastara cero: no se mostró.'
                    : `Corre en ${f.anuncios} anuncio(s) y entregó ${f.diasConEntrega} día(s) de la ventana.`,
                  f.interaccion.tasa !== null
                    ? `Interacción con la publicación: ${f.interaccion.tasa}% de las impresiones, sobre ${f.interaccion.anuncioDiasConLaClave} de ${f.interaccion.anuncioDiasConEntrega} anuncio-día.`
                    : null,
                  /* El click-to-landing SE DIBUJA acá, que es lo que el comentario de arriba decía
                     y el archivo no hacía: se calculaba con tres agregados propios, se probaba,
                     viajaba en la respuesta y no aparecía en ninguna parte. */
                  f.clickToLanding.tasa !== null
                    ? `Del clic al enlace a la landing cargada: ${f.clickToLanding.tasa}%.` +
                      (f.clickToLanding.tasa > 100
                        ? ' Pasa de 100 % porque Meta puede contar la carga de un clic de otro día, y no se topa: el desajuste es el dato.'
                        : '')
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
/**
 * Una celda de tasa. **Hay TRES estados y los tres se ven distinto**, que es toda la función.
 *
 * ── EL TERCERO ERA UN GUION PELADO, Y ERA EL MÁS CALLADO DE LOS TRES ───────
 *
 *   1 · **El proveedor no reportó la acción ni un día.** No es cero: una pieza que no es video
 *       nunca tiene reproducciones. Guion con su nota.
 *   2 · **Hay tasa.** El número, con la fracción de cobertura al lado.
 *   3 · **Hay dato pero no alcanza el piso.** Salía como un guion pelado, sin nota — o sea que la
 *       pieza con 900 impresiones y la pieza que no es video se veían EXACTAMENTE igual, y la del
 *       medio era la que más tenía para decir. Ahora dice cuánto le falta.
 *
 * El tercero pesa más desde el 2026-09-19, cuando el CTR y el click-to-landing ganaron el piso que
 * les faltaba: son más celdas las que caen ahí.
 */
function CeldaDeAccion({ t }) {
  /* `anuncioDiasConLaClave` y no `diasConLaClave`, que es como se llamaba hasta el 2026-09-19.
     Este archivo es `.jsx` y **`tsc --noEmit` no lo mira**: con el nombre viejo esto quedaba en
     `undefined === 0`, la rama no entraba nunca, y la pieza que no es video pasaba a dibujarse
     como una pieza sin tasa. No falla, no avisa, y sólo se ve mirando la pantalla. */
  if (t.anuncioDiasConLaClave === 0) {
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
      {t.tasa === null ? (
        <Nota
          texto={
            `El proveedor sí reportó esta acción —${t.cantidad ?? 0} en ` +
            `${t.anuncioDiasConLaClave} anuncio-día— pero la base no alcanza el piso para publicar ` +
            `una tasa. No es cero ni es «no hay dato»: es una muestra demasiado chica para que el ` +
            `porcentaje signifique algo.`
          }
        />
      ) : null}
      {/* La fracción es anuncio-día sobre anuncio-día: mismo grano arriba y abajo, que es lo que la
          hace legible. Llevaba una «d» de «días» y no eran días — una pieza que corre en tres
          anuncios tiene tres anuncio-día por cada día de calendario. */}
      {t.anuncioDiasConLaClave < t.anuncioDiasConEntrega ? (
        <em className="crv-de" title="anuncio-día con el dato, sobre anuncio-día con entrega">
          {' '}
          {t.anuncioDiasConLaClave}/{t.anuncioDiasConEntrega}
        </em>
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
          {f.conVeredicto.con}/{f.conVeredicto.sobre}
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
