'use client';

/* El tablero de Sales: la cadena comercial, y el eslabón que no existe.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA NO ERA UN MÓDULO: ERA MARCADO ESTÁTICO
 *
 * Creative y Conversion tenían 450 y 655 líneas de JavaScript calculando en el navegador. **Sales no
 * tenía módulo**: `components/views/SalesView.jsx` eran 231 líneas de marcado con 23 literales, sin
 * un `fetch`, sin estado, sin una sola interpolación.
 *
 * Y era aritméticamente coherente: 31+43=74, 10+8=18, 18/74≈24 %, $31.000+$24.200=$55.200, 74−18=56,
 * y los cuatro anchos de barra eran cada conteo sobre 56. Pasaba cualquier lectura de plausibilidad,
 * **y por eso engañaba**. Una de esas cifras estaba al lado del nombre de una persona real.
 *
 * ── EL DINERO VA PRIMERO, ARRIBA DEL SEGMENTADO, Y ROMPE LA SIMETRÍA ───────
 *
 * Las otras cuatro pantallas de Inteligencia ponen el selector de período arriba de todo. Acá no,
 * porque el bloque de dinero **no lo gobierna ese selector**: es del mes calendario. Debajo del
 * segmentado, la primera cifra grande de la pantalla quedaría visualmente mandada por un control
 * encendido que dice «7 días», y no hay rótulo que arregle eso.
 *
 * ── TRES VENTANAS, Y LOS TEXTOS LLEGAN DEL SERVIDOR ───────────────────────
 *
 * El mes del dinero, la cohorte de la cadena y el ciclo, y las citas de la cancelación y la tabla.
 * Las dos últimas se dibujan bajo el mismo botón y describen poblaciones distintas, así que cada
 * bloque lleva la suya al lado — con el texto de `ventanasDeSales.ts`, no reescrito acá.
 *
 * ── LAS CIFRAS NO SE ESCRIBEN ACÁ ──────────────────────────────────────────
 *
 * Las de este comentario llevan su fecha porque explican por qué el maquetado es así. Todo lo que se
 * dibuja lo calcula el servidor, con su piso aplicado y su nulo donde no se puede decir.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerSales } from '@/lib/negocio/vistaDeSales';

export default function PanelDeSales() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerSales(periodo);
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

  /* Con `null` como clave el reloj no se registra: con Sales cerrada esto no cuesta una petición. Y
     la cadencia es la de Inteligencia porque las fuentes son el alta del contacto y el barrido del
     calendario, que entran por el colector y no en vivo. */
  const aLaVista = estaALaVista('sales');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'sales:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      {/* ARRIBA DEL SEGMENTADO a propósito: no lo gobierna. Ver el encabezado.
          Se dibuja aunque `pantalla` sea `null` sólo cuando ya hay datos; mientras carga no, porque
          una tarjeta de dinero vacía es indistinguible de una empresa sin ventas. */}
      {pantalla === null ? null : <ElDinero d={pantalla.dinero} v={pantalla.ventanas.mes} />}

      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="cs-barra">
        {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. */}
        <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
      </div>

      {error ? <p className="cs-grave">{error}</p> : null}

      {cargando && pantalla === null ? (
        <p className="cs-vacio">Leyendo la cadena comercial…</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana: sin ella, lo que esté desplegado
           sobrevive al cambio y queda describiendo otra ventana. */
        <Cuerpo key={pantalla.periodo} p={pantalla} />
      )}
    </>
  );
}

/* Copia deliberada de los otros tres paneles: el segmentado es el mismo control y `PERIODOS` la
   misma lista. Sacarlo a un archivo compartido sería más acople que las doce líneas que ahorra — la
   decisión vive en `periodo.ts`, que sí es único. */
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

function miles(v) {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString('es-PE');
}

/** Una proporción de 0 a 1 a porcentaje entero. */
function tasa(v) {
  return v === null || v === undefined ? null : `${Math.round(v * 100)}%`;
}

/** Un `Indicador` del cockpit: `{ valor, falta }`. El nulo trae su motivo. */
function Cifra({ i, prefijo = '' }) {
  if (!i || i.valor === null || i.valor === undefined) {
    return (
      <p className="csf-key falta">
        <b>—</b>
        <span>sin dato</span>
      </p>
    );
  }
  return (
    <p className="csf-key">
      <b>
        {prefijo}
        {miles(i.valor)}
      </b>
    </p>
  );
}

function Cuerpo({ p }) {
  return (
    <>
      {/* Cuánto vale lo que dice la pantalla, ANTES de cualquier cifra repartida. Es el § 18.5. */}
      <Cobertura p={p} />
      <LaCadena c={p.cadena} v={p.ventanas.cohorte} />
      <LaCancelacion c={p.cancelacion} v={p.ventanas.citas} />
      <ElCiclo c={p.ciclo} v={p.ventanas.cohorte} />
      <PorCloser t={p.closers} v={p.ventanas.citas} />
      {/* Y lo último: qué NO muestra esta pantalla, y por qué. */}
      <Huecos h={p.huecos} />
    </>
  );
}

/**
 * El dinero del mes. **Es el único bloque que no obedece al selector de arriba.**
 *
 * Se CONSUME de `dineroDelMes`, que es su dueño: la pantalla del Closer publica las mismas tres
 * cifras y el `01` es terminante — *«si dos pantallas muestran el mismo número, comparten la función
 * que lo calcula»*. Recalcularlas acá daría dos revenues el día que una sume los acuerdos.
 *
 * El rótulo es el nombre del mes que el servidor ya publica, nunca «este mes»: «este mes» no dice en
 * qué zona horaria se cortó, y el corte es el de la organización.
 */
function ElDinero({ d, v }) {
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Dinero de {d.mes}</p>
          <p className="csf-m">
            {v.que}
          </p>
        </div>
      </div>

      <div className="csr">
        <span className="csr-n">
          Cobrado
          {/* El rótulo del § 5.4 va PEGADO a la cifra y no en un pie de página: es lo único que
              separa «vendimos esto» de «un closer dice que vendimos esto», y no hay ninguna
              integración de pagos en este sistema que pueda confirmarlo. */}
          <Nota
            texto={
              'Es la venta REPORTADA POR EL CLOSER, no un pago verificado: este sistema no tiene ' +
              'ninguna integración de pagos. Sale de los resultados con salida «venta» y monto ' +
              'cargado; un acuerdo sin pagar no suma acá porque es plata comprometida, no cobrada.'
            }
          />
        </span>
        <Cifra i={d.cobrado} prefijo="$" />
      </div>

      <div className="csr">
        <span className="csr-n">Ventas registradas</span>
        <Cifra i={d.ventas} />
      </div>

      <div className="csr">
        <span className="csr-n">
          Acuerdos sin pagar
          <Nota texto="Plata comprometida y todavía no cobrada. No suma al cobrado de arriba." />
        </span>
        <Cifra i={d.acuerdos} />
      </div>

      {/* El motivo del nulo, una sola vez y abajo: los tres indicadores comparten el mismo, así que
          repetirlo en cada fila diría tres veces lo mismo en la tarjeta más chica. */}
      {d.cobrado?.falta ? <p className="csf-foot">{d.cobrado.falta}</p> : null}
    </div>
  );
}

/**
 * Cuánto vale lo que dice esta pantalla.
 *
 * Las dos coberturas son de POBLACIONES DISTINTAS y por eso van juntas y explicadas: una cuenta
 * personas de la cohorte, la otra citas de la ventana. Un lector que las tome como el mismo grupo
 * saca una conclusión falsa sobre la tabla de abajo.
 */
function Cobertura({ p }) {
  const { cadena, closers } = p;
  const propCohorte =
    cadena.coberturaDeLaCohorte.sobre > 0
      ? cadena.coberturaDeLaCohorte.con / cadena.coberturaDeLaCohorte.sobre
      : null;
  const propTabla =
    closers.coberturaDeLaTabla.sobre > 0
      ? closers.coberturaDeLaTabla.con / closers.coberturaDeLaTabla.sobre
      : null;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cuánto vale lo que dice esta pantalla</p>
          <p className="csf-m">
            Las dos filas cuentan cosas distintas —personas una, citas la otra— y no se comparan
            entre sí.
          </p>
        </div>
      </div>

      <div className="csr">
        <span className="csr-n">
          Contactos con fecha de alta
          <Nota
            texto={
              'Sin fecha de alta no hay cohorte: esos contactos no entran en la cadena ni en el ' +
              'ciclo de abajo, y ampliar el período no los trae. No es un descarte, es un dato que ' +
              'el CRM no trajo.'
            }
          />
        </span>
        <span className="csr-v">{tasa(propCohorte) ?? '—'}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round((propCohorte ?? 0) * 100)}%` }} />
        </span>
        <span className="csr-p">
          {miles(cadena.coberturaDeLaCohorte.con)} de {miles(cadena.coberturaDeLaCohorte.sobre)}
        </span>
      </div>

      <div className="csr">
        <span className="csr-n">
          Citas que caen en alguna fila de closer
          <Nota
            texto={
              'Las que no caen son de personas que el CRM no le asignó a nadie, o asignadas a ' +
              'alguien que no está designado como closer acá. Se cuentan aparte: las filas de la ' +
              'tabla NO suman el total de la empresa, y no deberían.'
            }
          />
        </span>
        <span className="csr-v">{tasa(propTabla) ?? '—'}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round((propTabla ?? 0) * 100)}%` }} />
        </span>
        <span className="csr-p">
          {miles(closers.coberturaDeLaTabla.con)} de {miles(closers.coberturaDeLaTabla.sobre)}
        </span>
      </div>
    </div>
  );
}

/**
 * Los cinco eslabones, con el CONTACTO como unidad en los cinco.
 *
 * Mezclar unidades esconde la caída: medido, 226 citas son 201 contactos. El servidor garantiza la
 * monotonía en la consulta, no acá — restar en el navegador daría un número el día que uno de los
 * dos cambie y dejaría de significar lo que dice.
 */
function LaCadena({ c, v }) {
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">La cadena comercial</p>
          <p className="csf-m">{v.que}</p>
        </div>
      </div>

      {c.eslabones.map((e) => (
        <div className="csr" key={e.clave}>
          <span className="csr-n">
            {e.titulo}
            <Nota texto={e.que} />
          </span>
          <span className="csr-v">{miles(e.contactos)}</span>
          <span className="csr-b">
            <i style={{ width: `${Math.round((e.porcionDeLaCohorte ?? 0) * 100)}%` }} />
          </span>
          <span className="csr-p">
            {tasa(e.porcionDeLaCohorte) ?? '—'}
            {e.citas === null ? '' : ` · ${miles(e.citas)} citas`}
          </span>
        </div>
      ))}

      {c.aviso ? <p className="cs-fuera">{c.aviso}</p> : null}
    </div>
  );
}

/**
 * La tasa de cancelación: la única cifra del embudo comercial medible de punta a punta.
 *
 * Se CONSUME de `tasaDeCancelacion`, que ya existía para la pantalla del Closer. Recalcularla acá
 * republicaría el 62,7 % que el commit `9931f4d` corrigió mezclando el descarte propio con la
 * pérdida: son dos hechos opuestos y sumarlos daba una cifra a mitad de camino entre dos verdades.
 */
function LaCancelacion({ c, v }) {
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cancelación</p>
          <p className="csf-m">{v.que}</p>
        </div>
        <p className={c.tasa === null ? 'csf-key falta' : 'csf-key'}>
          <b>{c.tasa === null ? '—' : `${c.tasa}%`}</b>
          <span>{c.tasa === null ? 'no alcanza para una tasa' : 'de las citas se cayeron'}</span>
        </p>
      </div>

      <div className="csr">
        <span className="csr-n">
          Citas de la ventana
          <Nota
            texto={
              'Alcanzables y de personas no descartadas. Las de contactos que rechazamos nosotros ' +
              'van aparte: cancelan casi siempre, y eso es la automatización de la casa, no una ' +
              'pérdida del negocio.'
            }
          />
        </span>
        <span className="csr-v">{miles(c.citas)}</span>
        <span className="csr-b">
          <i style={{ width: `${c.citas > 0 ? Math.round((c.canceladas / c.citas) * 100) : 0}%` }} />
        </span>
        <span className="csr-p">{miles(c.canceladas)} canceladas</span>
      </div>

      {c.aviso ? <p className="cs-fuera">{c.aviso}</p> : null}
    </div>
  );
}

/**
 * Del alta a la PRIMERA CITA, no a la venta.
 *
 * Los dos percentiles van juntos porque sólo los dos juntos dicen la verdad: medido, el p90 es 3,7
 * veces el p50. Y el promedio no existe en el tipo que llega —es más alto que el p90, arrastrado por
 * catorce contactos de más de un mes— así que no se puede dibujar por descuido.
 */
function ElCiclo({ c, v }) {
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Del alta a la primera cita</p>
          <p className="csf-m">{v.que}</p>
        </div>
        <p className={c.p50 === null ? 'csf-key falta' : 'csf-key'}>
          <b>{c.p50 === null ? '—' : `${c.p50} d`}</b>
          <span>{c.p50 === null ? 'no alcanza para una mediana' : 'la mitad agenda antes'}</span>
        </p>
      </div>

      <div className="csr">
        <span className="csr-n">
          Uno de cada diez tarda más de
          <Nota
            texto={
              'Es el percentil 90, y va al lado de la mediana a propósito: publicar sólo la mediana ' +
              'diría «agendan en tres días» de un negocio donde uno de cada diez tarda mucho más.'
            }
          />
        </span>
        <span className="csr-v">{c.p90 === null ? '—' : `${c.p90} d`}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round(((c.cobertura.sobre > 0 ? c.cobertura.con / c.cobertura.sobre : 0)) * 100)}%` }} />
        </span>
        <span className="csr-p">
          medido sobre {miles(c.cobertura.con)} de {miles(c.cobertura.sobre)}
        </span>
      </div>

      {/* El techo va como aviso GRAVE y no escondido: con «7 días» la mediana no puede pasar de 7, o
          sea que ese botón produce siempre un ciclo excelente y nada falla. */}
      {c.avisoDelTecho ? <Nota texto={c.avisoDelTecho} grave /> : null}
      {c.aviso ? <p className="cs-fuera">{c.aviso}</p> : null}
    </div>
  );
}

/**
 * La tabla por closer. **Es una evaluación de desempeño de personas con nombre.**
 *
 * Las filas salen del catálogo de closers configurados y no de un `group by`: el closer sin
 * actividad desaparecería, y su ausencia se lee como «no está configurado», que es el hecho
 * opuesto. No se ordenan por tasa ni por tamaño, y no se filtra ninguna: borrar la fila de una
 * persona afirma que no trabaja acá.
 *
 * Las dos últimas columnas son de OTRO EJE que las tres primeras —lo que la persona registró, no lo
 * que el CRM le asignó— y el aviso del servidor lo dice.
 */
function PorCloser({ t, v }) {
  if (t.filas.length === 0) {
    return (
      <div className="csf">
        <div className="csf-h">
          <div className="csf-hl">
            <p className="csf-t">Por closer</p>
            <p className="csf-m">{v.que}</p>
          </div>
        </div>
        {t.aviso ? <p className="cs-fuera">{t.aviso}</p> : null}
      </div>
    );
  }

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Por closer</p>
          <p className="csf-m">{v.que}</p>
        </div>
      </div>

      <div className="csf-chain">
        <div className="crv-tabla crv-sales" role="table">
          <div className="crv-fila crv-cab" role="row">
            <span role="columnheader">Closer</span>
            <span role="columnheader" title={t.rotulos.citas.que}>
              {t.rotulos.citas.titulo}
            </span>
            <span role="columnheader" title={t.rotulos.cancelacion.que}>
              {t.rotulos.cancelacion.titulo}
            </span>
            <span role="columnheader" title={t.rotulos.planton.que}>
              {t.rotulos.planton.titulo}
            </span>
            <span role="columnheader" title={t.rotulos.intentos.que}>
              {t.rotulos.intentos.titulo}
            </span>
          </div>

          {t.filas.map((f) => (
            <div className="crv-fila" role="row" key={f.usuarioId}>
              <span className="crv-n" role="cell">
                {f.nombre}
                {f.aviso ? <Nota texto={f.aviso} /> : null}
              </span>
              <span role="cell">
                {f.citas === null ? '—' : miles(f.citas)}
                {f.contactos === null || f.citas === null ? '' : ` · ${miles(f.contactos)} p.`}
              </span>
              {/* El conteo se muestra SIEMPRE y la tasa sólo si el piso la deja: la fila bajo el
                  piso conserva sus números, que es lo que impide que se lea como una fila vacía. */}
              <span role="cell" className={f.tasaDeCancelacion === null ? 'cs-falta' : undefined}>
                {f.tasaDeCancelacion === null
                  ? f.canceladas === null
                    ? '—'
                    : `${miles(f.canceladas)} de ${miles(f.citas)}`
                  : tasa(f.tasaDeCancelacion)}
              </span>
              <span role="cell">{f.noShowDelCalendario === null ? '—' : miles(f.noShowDelCalendario)}</span>
              <span role="cell">{miles(f.intentos)}</span>
            </div>
          ))}
        </div>
      </div>

      {t.aviso ? <p className="cs-fuera">{t.aviso}</p> : null}
    </div>
  );
}

/**
 * Lo que esta pantalla NO puede mostrar, dicho en la pantalla.
 *
 * Acá pesa más que en Creative y Conversion: **la maqueta que se va dibujaba exactamente estas
 * cosas con números inventados** —«Revenue reportado $55.200», «Tasa de cierre 24 %», «Ventas 18» y
 * cuatro motivos de pérdida—. Quien conozca esa pantalla los va a buscar, y si no están ni se dice
 * por qué, la lectura razonable es que se rompió.
 *
 * Si la lista llega vacía **no se dibuja nada**: es la regla del silencio.
 */
function Huecos({ h }) {
  if (!h?.lista?.length) return null;
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Lo que esta pantalla no puede medir</p>
          <p className="csf-m">
            Medido contra la base el {h.medidoEl}. No son cosas pendientes de programar: la
            maquinaria está construida y nadie la usó todavía.
          </p>
        </div>
      </div>
      {h.lista.map((x) => (
        <p className="cs-fuera" key={x.punto}>
          <b>{x.punto}</b>: {x.porque}.
        </p>
      ))}
    </div>
  );
}
