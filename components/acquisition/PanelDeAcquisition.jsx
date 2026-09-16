/* El tablero de Acquisition: lo que costó cada anuncio, y cuánto vale esa cifra.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA, Y POR QUÉ NO ES UN REDISEÑO
 *
 * Hasta acá la pestaña la dibujaba `lib/aios/acquisition.js`: 302 líneas que calculaban EN EL
 * NAVEGADOR las tasas de paso de tres embudos, el costo por calificado y los umbrales de dos
 * alertas escritas a mano, todo sobre **58 literales inventados**. `bootAios()` lo arrancaba en
 * cada carga de página, así que mientras existiera alguien podía estar leyéndolo como si fuera
 * medición.
 *
 * Lo que hay ahora son dos cifras reales —el costo por anuncio y el monitor de atribución— y nada
 * más. Es mucho menos pantalla, y es la pantalla entera que se puede sostener.
 *
 * ── EL VOCABULARIO ES EL DE CONVERSATION, A PROPÓSITO ─────────────────────
 *
 * `.csf` la tarjeta de flujo, `.csr` el eslabón con barra, `.pn` el panel de cifras, el segmentado
 * de período y la `Nota` escondida detrás de un ícono. No es reuso por ahorro: **son la misma clase
 * de pantalla** —un departamento que publica cifras con su ventana y sus avisos— y dos dialectos
 * distintos obligarían a quien mira las dos a aprender dos veces lo mismo.
 *
 * ── LA REGLA QUE GOBIERNA EL ORDEN DE LOS BLOQUES ─────────────────────────
 *
 * El § 18.5 sólo deja publicar una conclusión por anuncio **con su cobertura al lado**. Por eso la
 * cobertura no es una nota al pie ni un bloque al final: va arriba de la tabla, antes de que nadie
 * lea una sola fila. El § 18.14 lo dice como requisito y acá es una decisión de maquetado.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerAcquisition } from '@/lib/negocio/vistaDeAcquisition';

/** Cuántos anuncios se dibujan. Los demás se juntan en una fila con su conteo. Ver `Tabla`. */
const ANUNCIOS_A_LA_VISTA = 12;

export default function PanelDeAcquisition() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  /**
   * Trae la pantalla. Mismo contrato que `PanelDeConversation`, y por los mismos motivos:
   * teniendo datos no se vacía nunca, y el cambio de período va como carga PRIMERA porque las
   * cifras dibujadas son de otra ventana.
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerAcquisition(periodo);
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

  /* Con `null` como clave el reloj no se registra, así que con Acquisition cerrada esto no cuesta
     una sola petición. Y acá pesa más que en Conversation: el dato es DIARIO —el colector corre una
     vez por día— así que un tic frecuente pediría muchas veces lo mismo. */
  const aLaVista = estaALaVista('acquisition');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'acquisition:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="cs-barra">
        <Periodos valor={periodo} alElegir={setPeriodo} />
      </div>

      {error ? <p className="cs-grave">{error}</p> : null}

      {cargando && pantalla === null ? (
        <p className="cs-vacio">Leyendo el costo de los anuncios…</p>
      ) : pantalla === null ? null : (
        <Cuerpo p={pantalla} />
      )}
    </>
  );
}

/* Copia deliberada de `PanelDeConversation`: el segmentado es el mismo control y `PERIODOS` es la
   misma lista. Compartir el COMPONENTE obligaría a sacarlo a un tercer archivo del que dependan las
   dos pantallas, y son doce líneas sin ninguna decisión adentro — la decisión está en `periodo.ts`,
   que sí es único. */
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

/**
 * El porqué de una cifra, escondido detrás de un ícono. `grave` lo deja a la vista.
 *
 * El argumento completo está en `PanelDeConversation`: un párrafo debajo de cada número da 5.596
 * caracteres de prosa contra 318 de cifra, y con siete avisos encendidos a la vez ninguno se lee.
 * Lo que no se esconde es el hueco —«nadie registró esto todavía»—, porque esconderlo convierte un
 * dato inexistente en un dato con asterisco.
 */
function Nota({ texto, grave = false }) {
  const [abierta, setAbierta] = useState(false);
  if (!texto) return null; // La regla del silencio: sin nada que decir, no se dibuja nada.
  if (grave) return <p className="cs-grave">{texto}</p>;

  return (
    <span className="cs-nota">
      <button
        type="button"
        className={abierta ? 'cs-nota-b on' : 'cs-nota-b'}
        title={texto}
        aria-expanded={abierta}
        aria-label="Por qué"
        onClick={() => setAbierta(!abierta)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {abierta ? <span className="cs-nota-p">{texto}</span> : null}
    </span>
  );
}

/** Dinero. El guion es «no se sabe», nunca un cero. */
function plata(v) {
  if (v === null || v === undefined) return null;
  return `$${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Un entero grande, con separador de miles. */
function miles(v) {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString('es-PE');
}

/** Un porcentaje ya calculado del lado del servidor. */
function pct(v) {
  return v === null || v === undefined ? null : `${v}%`;
}

/** `2026-09-16` a algo que se lee. Sin año: las ventanas de esta pantalla no lo cruzan. */
function fechaCorta(iso) {
  if (!iso) return null;
  const [, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`;
}

function Cuerpo({ p }) {
  return (
    <>
      <Gasto c={p.costo} />
      {/* El monitor va ANTES de la tabla. Ver el encabezado: el § 18.5 no deja publicar una
          conclusión por anuncio sin su cobertura, y «antes» es la única forma de maquetarlo que no
          depende de que alguien baje la vista. */}
      <Atribucion a={p.calidad} />
      <Tabla c={p.costo} />
    </>
  );
}

/** El encabezado: cuánto se gastó, sobre qué ventana, y qué le falta a esa ventana. */
function Gasto({ c }) {
  const desde = fechaCorta(c.desde);
  const hasta = fechaCorta(c.hasta);

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Lo que costó la pauta</p>
          {/* ── LA VENTANA REAL, NO LA PEDIDA ──────────────────────────────
              `desde` y `hasta` son los extremos de lo que hay GUARDADO, que puede ser mucho menos
              que los días que el botón dice. Es la misma advertencia que Conversation publica con
              su cola desproporcionada, y acá tiene una versión peor: durante el relleno inicial la
              tabla arrancaba el día 1 y terminaba el 13, y ordenada por gasto quedaba al revés. */}
          <p className="csf-m">
            {desde && hasta
              ? `Del ${desde} al ${hasta}, que es lo que hay guardado`
              : 'Todavía no hay ningún día guardado'}
          </p>
        </div>
        <p className="csf-key">
          <b>{plata(c.gastoTotal) ?? '—'}</b>
          <span>en {c.filas.length} anuncios</span>
        </p>
      </div>
      <Nota texto={c.aviso} grave />
    </div>
  );
}

/**
 * El Attribution Monitor del § 18.14.
 *
 * ── LAS BARRAS SON TODAS SOBRE SU PROPIO DENOMINADOR, Y POR ESO VIAJA ─────
 *
 * Cada punto tiene el suyo —contactos, citas, ventas, sesiones con UTM— y son cuatro poblaciones
 * distintas. Dibujar las cuatro barras sobre el mismo total diría que se pueden comparar entre sí,
 * y no se puede: el 52 % de contactos y el 29 % de citas hablan de cosas distintas.
 *
 * Por eso el pie de cada eslabón lleva `cuantos de sobre` escrito, y no sólo el porcentaje.
 */
function Atribucion({ a }) {
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cuánto vale lo que dice esta pantalla</p>
          <p className="csf-m">
            Cada barra es sobre su propia población, y las cuatro son distintas
          </p>
        </div>
      </div>

      {a.puntos.map((punto) => (
        <div className="csr" key={punto.clave}>
          <span className="csr-n">
            {punto.titulo}
            <Nota texto={punto.consecuencia} />
          </span>
          {/* El guion cuando la proporción viaja nula, que es «no se puede decir» y no «cero». */}
          <b className="csr-v">{pct(punto.proporcion) ?? '—'}</b>
          <span className="csr-b">
            {punto.proporcion === null ? null : <i style={{ width: `${punto.proporcion}%` }} />}
          </span>
          <span className="csr-p">
            {punto.cuantos} de {punto.sobre}
          </span>
        </div>
      ))}

      <Nota texto={a.aviso} grave />

      {/* ── LOS DOS QUE NO SE PUEDEN MEDIR, DIBUJADOS ──────────────────────
          No son un pendiente ni un hueco de implementación: son dos puntos del § 18.14 que esta vía
          NO puede dar, cada uno con su motivo medido. Se dibujan para que nadie los vuelva a
          investigar, y en tono menor para que no compitan con los cinco que sí son cifras. */}
      <div className="org-split">
        {a.fueraDeAlcance.map((f) => (
          <p className="cs-fuera" key={f.punto}>
            <b>{f.punto}</b> no se puede medir: {f.porque}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * La tabla por anuncio.
 *
 * ── ORDENADA POR GASTO, Y ESO NO ES EL ORDEN DEL NEGOCIO ─────────────────
 *
 * El § 18.10 pone «escalar únicamente por CPL» entre las acciones que requieren validación
 * ejecutiva, y el § 18.1 dice por qué: *«no decide por sí solo qué anuncio genera más dinero para el
 * negocio, porque esa conclusión requiere cruzar adquisición, ICP, agendamientos, ventas y
 * revenue»*.
 *
 * El orden elegido es el GASTO y no el CPL a propósito: el gasto es un hecho sin interpretación
 * —cuánto salió— y el CPL es la cifra que el documento prohíbe usar sola. Ordenar por CPL habría
 * sido dibujar la recomendación prohibida.
 */
function Tabla({ c }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? c.filas : c.filas.slice(0, ANUNCIOS_A_LA_VISTA);
  const ocultos = c.filas.length - visibles.length;

  if (c.filas.length === 0) {
    return (
      <div className="csf">
        <p className="cs-grave">
          Todavía no hay costo de anuncios guardado. La primera lectura corre con el barrido diario.
        </p>
      </div>
    );
  }

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Por anuncio</p>
          <p className="csf-m">
            Ordenados por gasto, que es un hecho. Ése no es el orden del negocio: para eso hacen
            falta las ventas, y ésas son de Business.
          </p>
        </div>
      </div>

      <div className="acq-tabla" role="table">
        <div className="acq-fila acq-cab" role="row">
          <span role="columnheader">Anuncio</span>
          <span role="columnheader">Gasto</span>
          <span role="columnheader">CPM</span>
          <span role="columnheader">CTR</span>
          <span role="columnheader">Leads</span>
          <span role="columnheader">CPL</span>
          <span role="columnheader">Agenda</span>
        </div>

        {visibles.map((f) => (
          <div className="acq-fila" role="row" key={f.anuncioId}>
            <span className="acq-n" role="cell">
              {f.nombre}
              {/* Los días con entrega van en la nota y no en una columna: es el denominador honesto
                  de cualquier promedio diario, y una columna más volvería ilegible la fila en el
                  ancho de un teléfono. */}
              <Nota
                texto={
                  f.diasConEntrega === 0
                    ? 'No entregó ni un día de esta ventana. No es que gastara cero: no se mostró.'
                    : `Entregó ${f.diasConEntrega} ${f.diasConEntrega === 1 ? 'día' : 'días'} de la ventana.`
                }
              />
            </span>
            <span role="cell">{plata(f.gasto) ?? '—'}</span>
            <span role="cell">{plata(f.cpm) ?? '—'}</span>
            <span role="cell">{pct(f.ctr) ?? '—'}</span>
            <span role="cell">{miles(f.leads)}</span>
            <span role="cell">{plata(f.cpl) ?? '—'}</span>
            {/* La tasa y su denominador juntos. Sin el denominador, «100 %» sobre un lead se lee
                igual que sobre cien — y el piso ya deja la tasa en nulo justo para eso. */}
            <span role="cell">
              {pct(f.tasaDeAgenda) ?? '—'}
              {f.leads > 0 ? <em className="acq-de"> {f.agendaron}/{f.leads}</em> : null}
            </span>
          </div>
        ))}
      </div>

      {ocultos > 0 ? (
        <button type="button" className="acq-mas" onClick={() => setTodos(true)}>
          Ver los {ocultos} anuncios que faltan
        </button>
      ) : null}
    </div>
  );
}
