'use client';

/* La Agenda del closer: un calendario del mes, los próximos días, y el día abierto.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRES REGLAS DEL DOCUMENTO, Y LAS TRES SON DEFECTOS YA PAGADOS
 *
 * **1 · Sin reloj propio.** *"Antes tenía uno de 10 segundos; se eliminó."* La pantalla se actualiza
 * al montar, al recuperar el foco, y cuando alguien lo pide. Nada más: es una lista que casi nunca
 * cambia, y de dónde se venía es *"cientos de llamadas por hora"*.
 *
 * **2 · El conteo y la lista salen del MISMO dato.** El número de cada día se cuenta sobre las citas
 * que después se dibujan, no sobre una consulta aparte. El documento: *"hubo un caso en que la
 * tarjeta anunciaba seis llamadas que no existían: el conteo venía de un lado y la lista del otro"*.
 *
 * **3 · El botón de video se ATENÚA, no desaparece.** *"Atenuado con su explicación, el closer
 * entiende que esa cita no tiene sala. Desaparecido, cree que la interfaz se rompió — y va a buscar
 * el enlace a mano en otro lado."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL CALENDARIO DEL MES, Y LA ÚNICA FORMA DE QUE NO MIENTA
 *
 * Un mes tiene 31 casillas y esta pantalla **no sabe nada de la mayoría**: el barrido le pide al CRM
 * 45 días hacia adelante y 14 hacia atrás, así que fuera de esa ventana no hay dato — no hay «cero
 * citas», hay «nadie preguntó».
 *
 * Dibujar esas casillas iguales a las vacías sería el defecto más caro que puede tener una agenda:
 * alguien mira el 12 del mes que viene, lo ve limpio, y **se compromete a otra cosa**. Por eso el
 * servidor manda `hasta` —el último día que su respuesta cubre— y las casillas de afuera se dibujan
 * con su propio aspecto, no se pueden abrir, y lo dicen al pasar el cursor.
 *
 * Es el `11` § 9 aplicado a una grilla: **un cero medido no se ve igual que un cero sin medir.**
 *
 * ── Y POR ESO SE PIDEN 45 DÍAS Y NO 15 ─────────────────────────────────────
 *
 * La pantalla pedía quince, que es lo que el documento pedía cuando era una lista. Un calendario del
 * mes con quince días conocidos deja media grilla en gris. Los 45 **no cuestan una llamada más**: es
 * lo que el barrido ya guardó en la base, y `DIAS_ADELANTE` está exportado justamente para que las
 * dos mitades no puedan desalinearse.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { usarLectura } from '../../lib/usarLectura.ts';
import { etiquetaCorta, fechaDelDia, horaEnZona, sumarDias } from '../../lib/negocio/tiempo.ts';
import Ficha from '../negocio/Ficha.jsx';

/** Cuántos días muestra la lista de «Próximos días». */
const PROXIMOS = 5;

/**
 * Cuántos días se le piden al servidor.
 *
 * Es el tope que la ruta acepta, y no es un número elegido: es `DIAS_ADELANTE`, lo que el barrido le
 * pide al CRM y guarda en la base. Pedir más devolvería días vacíos que nadie miró.
 */
const DIAS_QUE_SE_PIDEN = 45;

/**
 * Cuánto se espera el barrido manual antes de darlo por perdido.
 *
 * **Diez llamadas secuenciales a GoHighLevel**, y su ruta declara `maxDuration = 300`. Con el tope
 * por omisión del cliente —quince segundos— el navegador abortaba y decía «No se pudo contactar al
 * servidor» mientras el servidor terminaba bien: se reportaba un fallo sobre una operación exitosa.
 * Medido contra producción después de una de esas «fallas»: 118 citas escritas.
 */
const ESPERA_DEL_BARRIDO_MS = 300_000;

const DIAS_DE_LA_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Las piezas de un día `YYYY-MM-DD`, sin construir un `Date`.
 *
 * Un `new Date('2026-08-26')` se interpreta como medianoche UTC y después se muestra en la zona del
 * NAVEGADOR: en Lima eso es el 25 a las 19:00, así que la casilla del calendario caería un día
 * antes. Todo lo de acá abajo trabaja con las tres piezas y con aritmética propia, que no tiene zona.
 */
function piezas(dia) {
  const [a, m, d] = String(dia).split('-').map(Number);
  return { a, m, d };
}

/** Cuántos días tiene un mes. Con el año, porque febrero. */
function diasDelMes(a, m) {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Qué día de la semana cae el 1 del mes: 0 domingo … 6 sábado. En UTC, que no tiene zona. */
function primerDiaSemana(a, m) {
  return new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
}

const dosDigitos = (n) => String(n).padStart(2, '0');
const armarDia = (a, m, d) => `${a}-${dosDigitos(m)}-${dosDigitos(d)}`;

export default function Agenda({ zonaHoraria }) {
  const [abierta, setAbierta] = useState(null);
  const [diaElegido, setDiaElegido] = useState(null);
  /** El mes que muestra la grilla, `{a, m}`. `null` = el de hoy, que todavía no se sabe. */
  const [mes, setMes] = useState(null);
  /** Qué cita está desplegada. Una sola a la vez. */
  const [desplegada, setDesplegada] = useState(null);
  const [trayendo, setTrayendo] = useState(false);
  const [aviso, setAviso] = useState(null);

  /* ── VOLVER A ESTA PESTAÑA NO CUESTA UN «CARGANDO» ─────────────────────────
   *
   * Igual que en el Pipeline: `CloserView` desmonta esta pantalla al cambiar de sub-pestaña, así
   * que el que volvía nacía sin datos y pedía de nuevo. `usarLectura` guarda lo traído con la
   * empresa en la clave —`ADR-0703`— y lo devuelve en el primer render.
   *
   * El camino lleva los días adentro, así que forma parte de la clave: cambiar `DIAS_QUE_SE_PIDEN`
   * no puede devolver lo guardado con el valor viejo. */
  const { datos, situacion, causa, refrescar } = usarLectura(
    `/api/closer/agenda?dias=${DIAS_QUE_SE_PIDEN}`,
    {
      sinRespuesta:
        'No se pudo contactar al servidor. No es que no tengas citas: no se pudo preguntar.',
    },
  );

  /* La zona la manda el SERVIDOR en la respuesta, y la propiedad queda como respaldo para el primer
     dibujo. Es la misma zona con la que el servidor agrupó los días: si acá se usara otra, las horas
     de las filas y las cabeceras de los días saldrían de dos cálculos distintos — que es exactamente
     el defecto que `lib/negocio/tiempo.ts` vino a cerrar, un piso más arriba. */
  const zona = datos?.zonaHoraria ?? zonaHoraria ?? 'UTC';

  /* Al recuperar el foco, un disparo. Es lo que el documento pide en vez de un reloj: quien vuelve
     a la pestaña quiere ver fresco, y esto NO llama al CRM — lee la caché de nuestra base.

     Va por `refrescar` y no por una lectura normal: volver a la pestaña del navegador después de un
     rato es justo cuando la ventana de frescura sobra. */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void refrescar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescar]);

  /* El mes que se muestra arranca en el de hoy, y sólo la primera vez: si se recalculara en cada
     carga, el disparo por foco devolvería la grilla al mes actual mientras alguien mira el siguiente. */
  useEffect(() => {
    if (mes || !datos?.hoy) return;
    const { a, m } = piezas(datos.hoy);
    setMes({ a, m });
  }, [datos?.hoy, mes]);

  /** El botón. **Cuesta diez llamadas al CRM** — ver el encabezado del endpoint. */
  const traer = useCallback(async () => {
    setTrayendo(true);
    setAviso(null);
    const r = await pedir('/api/closer/agenda/refrescar', {
      metodo: 'POST',
      cuerpo: {},
      /* El tope por omisión son quince segundos y esto tarda más. Ver `ESPERA_DEL_BARRIDO_MS`: sin
         esta línea el navegador abortaba y anunciaba un fallo sobre un barrido que salía bien. */
      espera: ESPERA_DEL_BARRIDO_MS,
    });
    setTrayendo(false);

    if (r.tipo !== 'datos') {
      setAviso({
        mal: true,
        texto:
          r.tipo === 'rechazado'
            ? (r.detalle ?? `No se pudo traer (${r.estado}).`)
            : /* Y se dice lo que de verdad se sabe: que la respuesta no llegó **no** significa que el
                 barrido no haya corrido. Puede estar terminando ahora mismo. */
              'No llegó la respuesta del servidor. El barrido puede haber corrido igual: volvé a ' +
              'entrar en un minuto antes de reintentar, para no gastar diez llamadas de más.',
      });
      return;
    }
    if (r.datos.corrio === false) {
      setAviso({ mal: false, texto: r.datos.porque });
      return;
    }
    /* El resumen COMPLETO, con lo que NO se guardó. Un «listo» esconde el caso que importa: se
       vieron 132 citas y se guardaron 43 porque las otras 89 son de contactos que no tenemos. */
    const d = r.datos;
    setAviso({
      mal: false,
      texto:
        `Se leyeron ${d.calendarios} calendario(s) en ${d.llamadas} llamadas: ${d.vistas} cita(s), ` +
        `${d.nuestras} de contactos nuestros, ${d.guardadas} guardada(s)` +
        (d.canceladas > 0 ? `, ${d.canceladas} cancelada(s)` : '') +
        (d.vistas > d.nuestras
          ? `. Las otras ${d.vistas - d.nuestras} son de contactos que no están traídos de GoHighLevel.`
          : '.') +
        (d.atrasado ? ' Algún calendario falló: la lista puede estar incompleta.' : ''),
    });
    /* Y se invalida lo guardado: el barrido acaba de escribir citas en nuestra base, así que
       respetar la ventana de frescura mostraría la agenda de antes de haberlas traído. */
    await refrescar();
  }, [refrescar]);

  /* ── EL CONTEO POR DÍA, SOBRE LA MISMA LISTA QUE SE DIBUJA ─────────────────
   * Regla 2 del encabezado. El mapa se arma una vez y lo usan la grilla y los próximos días, así que
   * no hay forma de que el número de una casilla difiera del largo de su lista. */
  const porDia = useMemo(
    () => new Map((datos?.dias ?? []).map((d) => [d.dia, d.citas.length])),
    [datos],
  );

  /* Hoy y los cuatro siguientes, cada uno con su conteo REAL. Los días sin citas se muestran igual
     con su «Sin citas»: un día que desaparece cuando está vacío hace que nadie note que está vacío. */
  const proximos = useMemo(() => {
    if (!datos) return [];
    return Array.from({ length: PROXIMOS }, (_, i) => {
      const dia = sumarDias(datos.hoy, i);
      return { dia, cuantas: porDia.get(dia) ?? 0 };
    });
  }, [datos, porDia]);

  /** Las casillas del mes que se muestra, con los huecos del principio para alinear la semana. */
  const casillas = useMemo(() => {
    if (!mes || !datos) return [];
    const huecos = primerDiaSemana(mes.a, mes.m);
    const total = diasDelMes(mes.a, mes.m);
    const fuera = [];
    for (let i = 0; i < huecos; i += 1) fuera.push(null);
    for (let d = 1; d <= total; d += 1) {
      const dia = armarDia(mes.a, mes.m, d);
      fuera.push({
        dia,
        numero: d,
        /* LEÍDO o NO LEÍDO, y es la distinción central de esta pantalla. La respuesta cubre desde
           hoy hasta `hasta`; todo lo demás —el pasado y lo que viene después— no se miró. */
        leido: dia >= datos.hoy && dia <= datos.hasta,
        cuantas: porDia.get(dia) ?? 0,
        esHoy: dia === datos.hoy,
      });
    }
    return fuera;
  }, [mes, datos, porDia]);

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando la agenda…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="aj-fila">
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{causa}</span>
        </div>
        <button type="button" className="fd-btn sec" onClick={() => void refrescar()}>
          Reintentar
        </button>
      </div>
    );
  }

  /* El día que se está mirando. Por omisión el primero que TIENE citas y no «hoy» a secas: abrir la
     agenda en un día vacío cuando el siguiente tiene seis citas es esconder el trabajo. */
  const dias = datos.dias;
  const actual = dias.find((d) => d.dia === diaElegido) ?? dias[0] ?? null;
  const mesConDiasSinLeer = casillas.some((c) => c && !c.leido);

  const elegirDia = (dia) => {
    setDiaElegido(dia);
    setDesplegada(null);
  };

  const moverMes = (paso) => {
    setMes((antes) => {
      if (!antes) return antes;
      const m = antes.m + paso;
      if (m < 1) return { a: antes.a - 1, m: 12 };
      if (m > 12) return { a: antes.a + 1, m: 1 };
      return { a: antes.a, m };
    });
  };

  return (
    <>
      <div className="aj-fila ag-barra">
        <button type="button" className="fd-btn sec" disabled={trayendo} onClick={() => void traer()}>
          {trayendo ? 'Leyendo el calendario…' : 'Traer del calendario'}
        </button>
        {/* EL COSTE, a la vista. No es un adorno: es la diferencia entre un botón que alguien aprieta
            a conciencia y uno que se aprieta por si acaso. Y ahora también el TIEMPO, porque tarda:
            sin decirlo, un minuto de espera se lee como que se colgó. */}
        <span className="aj-ayuda ag-coste">
          Lee los calendarios de GoHighLevel — una llamada por calendario, y puede tardar un minuto.
          El resto del tiempo esta pantalla no lo consulta.
        </span>
      </div>

      {/* ── EL AVISO DE ZONA ─────────────────────────────────────────────────
          Va ARRIBA y SIEMPRE, no solo cuando la agenda está vacía: cuando hay citas es peor —las
          horas que se muestran pueden estar corridas y se ven perfectamente plausibles—. Y no se
          puede cerrar: no es una notificación, es el estado de la empresa. */}
      {datos.avisoDeZona ? (
        <div className="fd-aviso falta" role="status">
          <i>⚠</i>
          <span>{datos.avisoDeZona}</span>
        </div>
      ) : null}

      {/* El atraso del barrido automático, siempre que exista. Con citas a la vista es el caso que
          más importa: la pantalla se ve completa y puede faltarle lo último. */}
      {datos.frescura?.aviso ? (
        <div className="fd-aviso falta" role="status">
          <i>◍</i>
          <span>{datos.frescura.aviso}</span>
        </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      <div className="ag">
        {/* ── COLUMNA IZQUIERDA: el mes y los próximos días ── */}
        <div className="ag-lado">
          <div className="card ag-mes">
            <div className="ag-mes-h">
              <span className="ag-mes-t">
                {mes ? `${MESES[mes.m - 1]} de ${mes.a}` : '—'}
              </span>
              <div className="ag-mes-nav">
                <button type="button" onClick={() => moverMes(-1)} aria-label="Mes anterior">‹</button>
                <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
              </div>
            </div>

            <div className="ag-grilla" role="grid" aria-label="Días del mes">
              {DIAS_DE_LA_SEMANA.map((d, i) => (
                // La inicial se repite (M de martes y de miércoles no, pero D/S sí en otros idiomas),
                // así que el nombre accesible lo da el `title` y el glifo queda decorativo.
                <span className="ag-sem" key={`${d}-${i}`} aria-hidden="true">{d}</span>
              ))}
              {casillas.map((c, i) =>
                c === null ? (
                  <span className="ag-hueco" key={`h${i}`} />
                ) : (
                  <button
                    type="button"
                    key={c.dia}
                    className={
                      'ag-celda' +
                      (c.esHoy ? ' hoy' : '') +
                      (actual?.dia === c.dia ? ' abierta' : '') +
                      (c.leido ? '' : ' sin-leer')
                    }
                    /* Un día que no se leyó NO se puede abrir: abrirlo mostraría una lista vacía, y
                       una lista vacía se lee como «no hay nada». */
                    disabled={!c.leido || c.cuantas === 0}
                    onClick={() => elegirDia(c.dia)}
                    title={
                      c.leido
                        ? `${c.cuantas} cita(s)`
                        : 'Fuera de lo que se leyó del calendario: no se sabe si hay citas'
                    }
                    aria-label={`${c.numero} · ${c.leido ? `${c.cuantas} citas` : 'sin leer'}`}
                  >
                    <span className="ag-celda-n">{c.numero}</span>
                    {/* El punto sólo si HAY citas. Su ausencia en un día leído significa cero; en uno
                        sin leer no significa nada, y por eso la casilla entera se ve distinta. */}
                    {c.leido && c.cuantas > 0 ? <span className="ag-punto" /> : null}
                  </button>
                ),
              )}
            </div>

            {/* Y se DICE, no se deja adivinar por el color. La leyenda aparece sólo cuando el mes que
                se está mirando tiene casillas sin leer — en el mes de hoy y con 45 días de ventana,
                casi siempre son las de antes de hoy. */}
            {mesConDiasSinLeer ? (
              <p className="ag-leyenda">
                Los días apagados están fuera de lo que se leyó del calendario: no se sabe si tienen
                citas. La agenda cubre desde hoy hasta el {fechaDelDia(datos.hasta)}.
              </p>
            ) : null}
          </div>

          <div className="card ag-proximos">
            <div className="ag-proximos-t">Próximos días</div>
            {proximos.map((p) => (
              <button
                type="button"
                key={p.dia}
                className={`ag-prox${actual?.dia === p.dia ? ' on' : ''}`}
                disabled={p.cuantas === 0}
                onClick={() => elegirDia(p.dia)}
              >
                <span className="ag-prox-n">{etiquetaCorta(p.dia, datos.hoy)}</span>
                {/* El conteo va SIEMPRE, incluido el cero, y como PALABRAS: «Sin citas» es una
                    afirmación —se miró y no hay— y un cero suelto se lee como un dato faltante. */}
                <span className={`ag-prox-c${p.cuantas > 0 ? ' hay' : ''}`}>
                  {p.cuantas === 0 ? 'Sin citas' : `${p.cuantas} cita${p.cuantas === 1 ? '' : 's'}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: el día abierto ── */}
        <div className="card ag-dia">
          {datos.total === 0 ? (
            /* Vacía CON SU MOTIVO. `falta` distingue los tres estados —nunca se barrió, se barrió a
               medias, se barrió completo— y en los dos primeros dice qué hacer. Una agenda vacía sin
               motivo afirma «no tenés citas», y eso hace que alguien no se prepare para una llamada
               que sí existe. */
            <div className="fd-aviso falta ag-vacia">
              <i>◍</i>
              <span>{datos.falta}</span>
            </div>
          ) : (
            <>
              <div className="ag-dia-h">
                <span className="ag-dia-t">{actual ? etiquetaCorta(actual.dia, datos.hoy) : '—'}</span>
                {/* La FECHA, no la etiqueta relativa: con `etiquetaDeDia` acá el encabezado decía
                    «HOY · HOY» y el dato —qué día es— no aparecía en ningún lado. */}
                <span className="ag-dia-s">{actual ? fechaDelDia(actual.dia) : ''}</span>
              </div>

              <div className="ag-linea">
                {(actual?.citas ?? []).map((c) => {
                  const abiertaAca = desplegada === c.id;
                  return (
                    <div className="ag-tramo" key={c.id}>
                      <span className={`ag-hora${c.vencida ? ' pasada' : ''}`}>
                        {horaEnZona(c.inicioEl, zona)}
                      </span>

                      {/* EL BOTÓN DE VIDEO SE ATENÚA, NO DESAPARECE. Ver el encabezado: desaparecido,
                          quien lo busca cree que la interfaz se rompió. Y nunca genera una sala
                          nueva: abre la de ESTA cita. */}
                      <button
                        type="button"
                        className="ag-sala"
                        disabled={!c.salaUrl}
                        title={
                          c.salaUrl
                            ? 'Abre la sala de videollamada de esta cita'
                            : 'Esta cita no tiene sala de videollamada en GoHighLevel'
                        }
                        onClick={() => c.salaUrl && window.open(c.salaUrl, '_blank', 'noopener')}
                        aria-label={c.salaUrl ? 'Abrir la sala' : 'Sin sala de videollamada'}
                      >
                        ▢
                      </button>

                      <div className={`ag-cita${abiertaAca ? ' abierta' : ''}`}>
                        <div className="ag-cita-h">
                          <span className="ag-cita-av">{(c.nombre ?? '·').trim().slice(0, 1).toUpperCase()}</span>
                          <div className="ag-cita-quien">
                            <div className="ag-cita-n">{c.nombre}</div>
                            <div className="ag-cita-m">{c.telefono ?? 'sin teléfono'}</div>
                          </div>
                          {/* El estado sale del CRM y de la fila, nunca se inventa uno. «Ya pasó» es
                              una condición temporal y va aparte del estado, que es un hecho. */}
                          {c.vencida ? <span className="tagx venc">Ya pasó</span> : null}
                          {c.cancelada ? <span className="tagx no">Cancelada</span> : null}
                          {c.estado && !c.cancelada ? <span className="tagx nu">{c.estado}</span> : null}
                          <button
                            type="button"
                            className="ag-mas"
                            onClick={() => setDesplegada(abiertaAca ? null : c.id)}
                            aria-expanded={abiertaAca}
                            aria-label={abiertaAca ? 'Cerrar el detalle' : 'Ver el detalle'}
                          >
                            ⌄
                          </button>
                        </div>

                        {abiertaAca ? (
                          <div className="ag-cita-cuerpo">
                            <button
                              type="button"
                              className="fd-btn sec"
                              onClick={() => setAbierta(c.contactoId)}
                            >
                              Abrir la ficha
                            </button>
                            <button
                              type="button"
                              className="fd-btn sec"
                              disabled={!c.salaUrl}
                              title={
                                c.salaUrl
                                  ? 'Abre la sala de esta cita'
                                  : 'Esta cita no tiene sala de videollamada en GoHighLevel'
                              }
                              onClick={() => c.salaUrl && window.open(c.salaUrl, '_blank', 'noopener')}
                            >
                              ▢ Entrar a la sala
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* La ficha se abre DONDE se la invoca y nunca navega. Al cerrarla se vuelve acá, y se recarga
          porque registrar un resultado adentro puede cambiar lo que esta lista muestra. */}
      {abierta ? (
        <Ficha
          contactoId={abierta}
          alCerrar={() => {
            setAbierta(null);
            void refrescar();
          }}
        />
      ) : null}
    </>
  );
}
