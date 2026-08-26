'use client';

/* La Agenda del closer.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRES REGLAS DEL DOCUMENTO, Y LAS TRES SON DEFECTOS YA PAGADOS
 *
 * **1 · Sin reloj propio.** *"Antes tenía uno de 10 segundos; se eliminó."* La pantalla se actualiza
 * al montar, al recuperar el foco, y cuando alguien lo pide. Nada más: es una lista que casi nunca
 * cambia, y de dónde se venía es *"cientos de llamadas por hora"*.
 *
 * **2 · El conteo y la lista salen del MISMO dato.** «Próximos días» cuenta sobre las citas que
 * después se dibujan, no sobre una consulta aparte. El documento: *"hubo un caso en que la tarjeta
 * anunciaba seis llamadas que no existían: el conteo venía de un lado y la lista del otro"*.
 *
 * **3 · El botón de video se ATENÚA, no desaparece.** *"Atenuado con su explicación, el closer
 * entiende que esa cita no tiene sala. Desaparecido, cree que la interfaz se rompió — y va a buscar
 * el enlace a mano en otro lado."*
 *
 * Y una que no es del documento pero vale igual: **nunca se genera una sala nueva desde acá**. El
 * botón abre la de la cita que ya existe. Los tres enlaces del circuito —agendar, reunirse,
 * reagendar— son distintos y no son intercambiables.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { etiquetaCorta, etiquetaDeDia, horaEnZona, sumarDias } from '../../lib/negocio/tiempo.ts';
import Ficha from '../negocio/Ficha.jsx';

/** Cuántos días muestra la tira de «Próximos días». El documento pide hoy y los tres siguientes. */
const PROXIMOS = 4;

export default function Agenda({ zonaHoraria }) {
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [diaElegido, setDiaElegido] = useState(null);
  const [trayendo, setTrayendo] = useState(false);
  const [aviso, setAviso] = useState(null);
  const yaPedido = useRef(false);

  /* La zona la manda el SERVIDOR en la respuesta, y la propiedad queda como respaldo para el primer
     dibujo. Es la misma zona con la que el servidor agrupó los días: si acá se usara otra, las horas
     de las filas y las cabeceras de los días saldrían de dos cálculos distintos — que es exactamente
     el defecto que `lib/negocio/tiempo.ts` vino a cerrar, un piso más arriba. */
  const zona = datos?.zonaHoraria ?? zonaHoraria ?? 'UTC';

  const cargar = useCallback(async () => {
    const r = await pedir('/api/closer/agenda');
    if (r.tipo !== 'datos') {
      /* Las tres ramas sin colapsar (`ADR-0305`): un rechazo por permiso NO es «no hay citas». Con
         una sola rama, alguien sin `closer.ver` vería una agenda vacía y creería que no tiene nada. */
      setCausa(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
          : 'No se pudo contactar al servidor. No es que no tengas citas: no se pudo preguntar.',
      );
      setSituacion(r.tipo);
      return;
    }
    setDatos(r.datos);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /* Al recuperar el foco, un disparo. Es lo que el documento pide en vez de un reloj: quien vuelve a
     la pestaña quiere ver fresco, y esto NO llama al CRM — lee la caché. */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  /** El botón. **Cuesta diez llamadas al CRM** — ver el encabezado del endpoint. */
  const traer = useCallback(async () => {
    setTrayendo(true);
    setAviso(null);
    const r = await pedir('/api/closer/agenda/refrescar', { metodo: 'POST', cuerpo: {} });
    setTrayendo(false);

    if (r.tipo !== 'datos') {
      setAviso({
        mal: true,
        texto:
          r.tipo === 'rechazado'
            ? (r.detalle ?? `No se pudo traer (${r.estado}).`)
            : 'No se pudo contactar al servidor.',
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
    await cargar();
  }, [cargar]);

  /* ── «PRÓXIMOS DÍAS», CONTADO SOBRE LA MISMA LISTA ─────────────────────────
   *
   * Hoy y los tres siguientes, cada uno con su conteo REAL. Los días sin citas se dibujan igual con
   * su cero: un día que desaparece cuando está vacío hace que nadie note que está vacío — la misma
   * regla que las columnas del Pipeline. */
  const proximos = useMemo(() => {
    if (!datos) return [];
    const porDia = new Map(datos.dias.map((d) => [d.dia, d.citas.length]));
    return Array.from({ length: PROXIMOS }, (_, i) => {
      const dia = sumarDias(datos.hoy, i);
      return { dia, cuantas: porDia.get(dia) ?? 0 };
    });
  }, [datos]);

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
        <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  /* El día que se está mirando. Por omisión el primero que tiene citas y no «hoy» a secas: abrir la
     agenda en un día vacío cuando el siguiente tiene seis citas es esconder el trabajo. */
  const dias = datos.dias;
  const actual = dias.find((d) => d.dia === diaElegido) ?? dias[0] ?? null;

  return (
    <>
      <div className="aj-fila" style={{ marginBottom: 12 }}>
        <button type="button" className="fd-btn sec" disabled={trayendo} onClick={() => void traer()}>
          {trayendo ? 'Leyendo el calendario…' : 'Traer del calendario'}
        </button>
        {/* EL COSTE, a la vista. No es un adorno: es la diferencia entre un botón que alguien aprieta
            a conciencia y uno que se aprieta por si acaso. */}
        <span className="aj-ayuda" style={{ margin: 0 }}>
          Lee los calendarios de GoHighLevel — una llamada por calendario. El resto del tiempo esta
          pantalla no lo consulta.
        </span>
      </div>

      {/* ── EL AVISO DE ZONA, Y ESTO FALTABA ─────────────────────────────────
          El servidor lo mandaba en la respuesta desde el primer día y la pantalla no lo dibujaba: el
          aviso existía en el JSON y era invisible, o sea que no existía. Se encontró mirando el
          navegador, no leyendo el código.

          Va ARRIBA y SIEMPRE, no solo cuando la agenda está vacía: cuando hay citas es peor —las
          horas que se muestran pueden estar corridas y se ven perfectamente plausibles—. Y no se
          puede cerrar: no es una notificación, es el estado de la empresa. */}
      {datos.avisoDeZona ? (
        <div className="fd-aviso falta" role="status">
          <i>⚠</i>
          <span>{datos.avisoDeZona}</span>
        </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      {/* ── PRÓXIMOS DÍAS ── */}
      <div className="ag-proximos">
        {proximos.map((p) => (
          <button
            type="button"
            key={p.dia}
            className={`ag-dia ${actual?.dia === p.dia ? 'on' : ''}`}
            disabled={p.cuantas === 0}
            onClick={() => setDiaElegido(p.dia)}
          >
            {/* CORTA, y solo acá: son cuatro botones con un número abajo, y la etiqueta larga los
                llenaba con «VIERNES, 28 DE AGOSTO DE 2026». La cabecera del día de abajo sigue usando
                la larga, que es donde el dato completo se lee de una vez. */}
            <span className="ag-dia-n">{etiquetaCorta(p.dia, datos.hoy)}</span>
            <span className="ag-dia-c">{p.cuantas}</span>
          </button>
        ))}
      </div>

      {/* ── EL DÍA ── */}
      {datos.total === 0 ? (
        /* Vacía CON SU MOTIVO. `falta` distingue los tres estados —nunca se barrió, se barrió a
           medias, se barrió completo— y en los dos primeros dice qué hacer. Una agenda vacía sin
           motivo afirma «no tenés citas», y eso hace que alguien no se prepare para una llamada que
           sí existe. */
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>{datos.falta}</span>
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            {actual ? etiquetaDeDia(actual.dia, datos.hoy) : '—'}
            <span className="hint">{actual ? `${actual.citas.length} cita(s)` : ''}</span>
          </div>
          <div className="rows">
            {(actual?.citas ?? []).map((c) => (
              <div className="md-r" key={c.id}>
                <span
                  className="md-time"
                  style={c.vencida ? { color: 'var(--crit)' } : undefined}
                >
                  {horaEnZona(c.inicioEl, zona)}
                </span>
                <div>
                  <div className="md-nm">
                    {c.nombre}
                    {c.vencida ? <span className="tagx venc">Ya pasó</span> : null}
                    {c.cancelada ? <span className="tagx no">Cancelada</span> : null}
                    {c.estado && !c.cancelada ? <span className="tagx nu">{c.estado}</span> : null}
                  </div>
                  <div className="rs">{c.telefono ?? 'sin teléfono'}</div>
                </div>
                <div className="md-acts">
                  {/* EL BOTÓN DE VIDEO SE ATENÚA, NO DESAPARECE. Ver el encabezado: desaparecido,
                      quien lo busca cree que la interfaz se rompió. Y nunca genera una sala nueva:
                      abre la de esta cita. */}
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
                    ▢ Sala
                  </button>
                  <button type="button" className="fd-btn sec" onClick={() => setAbierta(c.contactoId)}>
                    Abrir ficha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* La ficha se abre DONDE se la invoca y nunca navega. Al cerrarla se vuelve acá, y se recarga
          porque registrar un resultado adentro puede cambiar lo que esta lista muestra. */}
      {abierta ? (
        <Ficha
          contactoId={abierta}
          alCerrar={() => {
            setAbierta(null);
            void cargar();
          }}
        />
      ) : null}
    </>
  );
}
