'use client';

/* Mi Día — el mini-pipeline del día. Las cinco colas, en orden fijo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL ORDEN ES FIJO, Y ES LA PRIORIDAD
 *
 * El `01` lo pone como tabla y el orden de esa tabla **es** la prioridad: un contacto está en
 * UNA sola cola, y Urgentes gana sobre Buzón. *"Dos colas para la misma persona hacen que
 * atender una no cierre la otra, y el closer termina trabajando el mismo caso dos veces sin
 * saberlo."*
 *
 * El reparto lo hace el servidor; esta pantalla solo dibuja. Repartir acá sería una segunda
 * implementación de la prioridad, y dos implementaciones divergen en silencio.
 *
 * ── LAS DOS CLASES DE VACÍO, QUE NO SE DIBUJAN IGUAL ────────────────────────
 *
 *   · **No hay trabajo**: la cola está vacía de verdad. Se dice así, en gris.
 *   · **Falta una fuente**: no se puede saber si hay trabajo. Se dice QUÉ falta, en ámbar.
 *
 * Colapsarlas es el defecto que el `11` § 4 persigue: con 74 contactos etiquetados
 * `cita_agendada`, decir "no tenés citas hoy" sería **falso** — la etiqueta dice quién tiene
 * cita, no cuándo.
 *
 * ── Y «COMPLETADAS HOY» SIEMPRE SE DIBUJA ───────────────────────────────────
 *
 * Vacía o no. Es el ancla de la pantalla y lo único que le dice al closer "esto ya lo hiciste".
 * Y como filtra por fecha, se vacía sola a medianoche.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Fila, { SeisIconos } from '../negocio/Fila.jsx';
import { horaEnZona } from '../../lib/negocio/tiempo.ts';
import Ficha from '../negocio/Ficha.jsx';

/** Las cinco colas, en el orden fijo del `01`. */
const COLAS = [
  {
    clave: 'urgentes',
    titulo: 'Intervenciones urgentes',
    tono: 'crit',
    vacio: 'Ninguna. El agente de IA no falló en ningún contacto.',
  },
  { clave: 'agenda', titulo: 'Agenda de hoy', vacio: 'No hay citas para hoy.' },
  {
    clave: 'buzon',
    titulo: 'Respondieron · buzón general',
    vacio: 'Nadie escribió sin respuesta.',
  },
  {
    clave: 'seguimientos',
    titulo: 'Seguimientos de hoy',
    tono: 'warn',
    vacio: 'Nadie está en seguimiento hoy.',
  },
  {
    clave: 'completadas',
    titulo: 'Completadas hoy',
    tono: 'done',
    vacio: 'Todavía no cerraste nada hoy.',
  },
];

/** El texto de cada uno de los cuatro sabores de seguimiento. */
const CASO = {
  manual_de_hoy: { texto: 'Le toca hoy', clase: 'seg' },
  manual_vencido: { texto: 'Vencido', clase: 'venc' },
  serie_agotada: { texto: 'Serie agotada', clase: 'no' },
  automatico_en_curso: { texto: 'Serie automática corriendo', clase: 'nu' },
};

/* La hora ya no se calcula acá: `horaEnZona` de `lib/negocio/tiempo.ts` es la ÚNICA definición de
   toda la aplicación. El documento de la Agenda nombra el defecto que eso cierra — *"cuando cada
   pantalla la calculaba por su cuenta, dos vitrinas mostraban horas distintas para la misma
   cita"*—, y este archivo era una de las dos. */

/** Una fila de la Agenda: la hora, el estado, la sala y los seis íconos. */
function FilaDeAgenda({ item, zona }) {
  const c = item.cita;
  return (
    <div className="md-r">
      <span className="md-time" style={c.vencida ? { color: 'var(--crit)' } : undefined}>
        {horaEnZona(c.inicioEl, zona)}
      </span>
      <div>
        <div className="md-nm">
          {item.fila.nombre}
          {/* Las VENCIDAS no desaparecen: bajan y se marcan. Si desaparecieran, el closer
              perdería de vista justo la cita que tiene pendiente de registrar. */}
          {c.vencida ? <span className="tagx venc">Vencida</span> : null}
          {c.estado ? <span className="tagx nu">{c.estado}</span> : null}
        </div>
      </div>
      <div className="md-acts">
        {/* El botón de video NO desaparece cuando la cita no tiene sala: se atenúa con su
            explicación. Desaparecido, el closer cree que la interfaz se rompió y va a buscar
            el enlace a mano. (`03` § 2.) */}
        {c.salaUrl ? (
          <a className="md-join" href={c.salaUrl} target="_blank" rel="noreferrer">
            Unirse
          </a>
        ) : (
          <i title="Esta cita no tiene sala de videollamada" style={{ opacity: 0.35 }}>
            ▢
          </i>
        )}
        <SeisIconos iconos={item.fila.iconos} />
      </div>
    </div>
  );
}

export default function MiDia({ colas, zonaHoraria }) {
  /* LA FICHA. `onAbrir` de `Fila.jsx` existia desde la Etapa 11, documentado, **y sin un solo
     llamador**: su comentario decia *"todavia no hay ficha -es el paso siguiente- asi que cuando no
     se pasa, la fila no es clicable"*. Este es ese paso.

     Se guarda el IDENTIFICADOR y no la fila entera: la ficha vuelve a pedir el contacto al abrirse
     -con eso refresca sus etiquetas contra el CRM- y quedarse con una copia de la fila haria que el
     encabezado mostrara el estado viejo al lado de los datos nuevos. */
  const [abierta, setAbierta] = useState(null);
  if (!colas) {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando tu día…</span>
      </div>
    );
  }

  return (
    <>
      {/* ── El resumen de arriba ── */}
      <div className="md-top">
        <div className="md-c">
          <div>
            <div className="md-k">Tareas de hoy</div>
            <div className="md-v" style={{ color: colas.tareasPendientes ? 'var(--warn)' : 'var(--txt-faint)' }}>
              {colas.tareasPendientes}
            </div>
          </div>
          <div className="md-s">
            {/* Se dice qué NO cuenta. Sin esto, un closer que ve la lista más larga que el
                contador cree que el contador está roto. */}
            <span className="md-chip o">las series automáticas no cuentan</span>
          </div>
        </div>
        <div className="md-c">
          <div>
            <div className="md-k">Citas de hoy</div>
            <div className="md-v" style={{ color: colas.agenda.length ? 'var(--accent)' : 'var(--txt-faint)' }}>
              {colas.agenda.length}
            </div>
          </div>
          <div className="md-s">
            {colas.agenda[0]?.cita
              ? `próxima a las ${horaEnZona(colas.agenda[0].cita.inicioEl, zonaHoraria)}`
              : 'sin citas leídas'}
          </div>
        </div>
      </div>

      {/* ── Las cinco colas ── */}
      {COLAS.map((cola) => {
        const items = colas[cola.clave] ?? [];

        return (
          <div className={`md-sec${cola.tono ? ` ${cola.tono}` : ''}`} key={cola.clave}>
            <div className="md-h">
              {cola.titulo}{' '}
              {/* El conteo va SIEMPRE, incluso en cero. El `02` regla 6 lo pide para las
                  columnas del Pipeline y vale igual acá: una sección sin número no dice si
                  está vacía o si no se pudo contar. */}
              <span className="b">{items.length}</span>
            </div>

            {/* UN CERO SE MUESTRA COMO UN CERO.
                Acá había dos clases de vacío: la frase neutra de la cola, y —cuando el servidor
                mandaba un `faltantes`— un aviso ámbar explicando que la fuente no estaba
                conectada. Ese segundo camino se eliminó, y no por estética:

                  · **lo leía un cliente.** Nombraba endpoints, etiquetas y permisos de un CRM que
                    no es suyo, y no le decía nada que pudiera hacer;
                  · **envejecía sin que nada fallara.** El de los seguimientos afirmaba que Avanzar
                    no existía cuando ya existía completo, así que la pantalla mentía sobre su
                    propio sistema.

                El diagnóstico de una fuente sin conectar vive en la pantalla de estado de las
                conexiones, que la mira quien puede arreglarlo. */}
            {items.length === 0 ? <div className="dw-empty">{cola.vacio}</div> : null}

            {items.map((item, i) => {
              if (cola.clave === 'agenda') {
                return <FilaDeAgenda key={item.fila.id + i} item={item} zona={zonaHoraria} />;
              }
              return (
                <div key={item.fila.id + i}>
                  <Fila fila={item.fila} onAbrir={(fila) => setAbierta(fila.id)} />
                  {/* Lo propio de cada cola va DEBAJO de la fila compartida, no dentro: la
                      fila es el mismo componente en las cinco colas y en el Pipeline, y
                      meterle casos por cola sería el camino a cinco variantes que divergen. */}
                  {item.motivo ? (
                    <div className="md-sub" style={{ padding: '0 16px 10px 56px', color: 'var(--crit)' }}>
                      {item.motivo}
                    </div>
                  ) : null}
                  {item.fragmento ? (
                    <div className="md-quote" style={{ padding: '0 16px 10px 56px' }}>
                      “{item.fragmento}”
                    </div>
                  ) : null}
                  {item.caso ? (
                    <div className="md-sub" style={{ padding: '0 16px 10px 56px' }}>
                      <span className={`tagx ${CASO[item.caso]?.clase ?? 'nu'}`}>
                        {CASO[item.caso]?.texto ?? item.caso}
                      </span>
                      {/* Los automáticos se MUESTRAN y no SUMAN. Decirlo en la fila es lo que
                          hace que el contador y la lista no se contradigan a los ojos. */}
                      {item.pideManos === false ? (
                        <span style={{ color: 'var(--txt-faint)', marginLeft: 8 }}>
                          no necesita que hagas nada
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {item.completadaPor ? (
                    <div className="md-sub" style={{ padding: '0 16px 10px 56px' }}>
                      registrado como <b>{item.completadaPor}</b>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}

      {colas.truncado ? (
        <div className="fd-aviso falta">
          <i>⚠</i>
          <span>
            Hay más contactos de los que caben en una pasada, así que estas colas pueden estar
            incompletas.
          </span>
        </div>
      ) : null}
      {/* La ficha se abre DONDE se la invoco y nunca navega: es un panel superpuesto, asi que la
          lista de atras conserva su posicion de scroll y al cerrar se vuelve exactamente a donde
          se estaba. Ver `components/negocio/Ficha.jsx`. */}
      {abierta ? <Ficha contactoId={abierta} alCerrar={() => setAbierta(null)} /> : null}
    </>
  );
}
