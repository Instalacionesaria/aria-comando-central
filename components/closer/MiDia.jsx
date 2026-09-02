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
 * ── UN VACÍO SE DIBUJA DE UNA SOLA MANERA: COMO UN VACÍO ────────────────────
 *
 * Acá hubo dos clases de vacío. La cola vacía de verdad, en gris con su frase neutra, y un
 * segundo camino en ámbar que explicaba que la fuente no estaba conectada. Ese segundo camino
 * se eliminó, y este encabezado lo describía como si todavía existiera — o sea que la
 * documentación afirmaba lo contrario que el código de más abajo.
 *
 * El motivo de sacarlo, que es el que importa conservar: **esos textos los lee un cliente.**
 * Nombraban etiquetas y piezas internas de un CRM que no es suyo, no le decían nada que pudiera
 * hacer, y envejecían sin que nada fallara — el de los seguimientos afirmaba que Avanzar no
 * existía cuando ya estaba completo, así que la pantalla mentía sobre su propio sistema.
 *
 * Lo que sí sigue siendo verdad, y es la razón de que cada cola tenga su propia frase: decir
 * "no tenés citas hoy" cuando hay 74 contactos con cita sería **falso**. La frase de cada cola
 * afirma exactamente lo que esa cola sabe —"no hay citas PARA HOY", "nadie está en seguimiento
 * HOY"— y nunca algo más grande que eso.
 *
 * El diagnóstico de una fuente sin conectar vive en Ajustes, que lo mira quien puede arreglarlo.
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
import { queDecir, resolverIntervencion } from '../../lib/auditor/resolverDesdeLaCola.ts';

/**
 * Las cinco colas, en el orden fijo del `01`.
 *
 * ══ UNA FRASE DE VACÍO NOMBRA LA CONDICIÓN DE ENTRADA, Y CUATRO AFIRMAN EL HECHO ══
 *
 * La división es **de quién es el dato**, y es la misma que rige en el Setter.
 *
 * `agenda`, `buzon`, `seguimientos` y `completadas` salen de NUESTRAS tablas —`citas`, `mensajes`,
 * `tareas`, `resultados`—, que las escribe código de esta aplicación. Un cero ahí es un cero MEDIDO,
 * así que la frase puede afirmar el hecho: *«Nadie escribió sin respuesta»* es cierto.
 *
 * `urgentes` sale de **dos etiquetas** —`bot_desactivado_appflow` y `bot_pausado_fallo`, ver
 * `FALLOS_DEL_AUDITOR`— y hasta la Etapa 13 **ninguna línea de esta aplicación las escribía**, así
 * que su cero era «nadie nos dijo nada» y no un cero medido.
 *
 * **Eso cambió y hay que decirlo:** el auditor de IA ahora escribe la específica del territorio
 * cuando pide una intervención (`lib/auditor/intervencion.ts`). Su cero sigue sin ser del todo
 * medido —el CRM también las pone, y la plataforma anterior también— pero ya no es cierto que
 * nadie de acá las escriba. Un encabezado que afirma lo contrario de lo que hace el código es la
 * clase de documentación que envejece sin que nada falle.
 *
 * La frase decía *«El agente de IA no falló en ningún contacto»*, y eso este sistema **no tiene con
 * qué saberlo**: si el CRM deja de aplicar la etiqueta, o si el barrido quedó atrasado, la pantalla
 * afirma que el agente no falló mientras fallaba. Se veía exactamente igual que si fuera verdad.
 *
 * Medido el 2026-08-31 en producción: de 155 contactos del closer, **1** lleva una de esas dos
 * etiquetas. O sea que la cola puede tener algo — y aun así la frase no podía afirmar lo contrario.
 *
 * Ahora nombra **cuándo aparece algo acá**: es cierto siempre, y encima dice qué tiene que pasar para
 * que la sección se llene.
 */
export const COLAS_DEL_CLOSER = [
  {
    clave: 'urgentes',
    titulo: 'Intervenciones urgentes',
    tono: 'crit',
    /* NOMBRA LA CONDICIÓN DE ENTRADA, no el estado del mundo. Ver el bloque de arriba. */
    vacio: 'Ninguna. Acá aparece un contacto cuando el CRM marca que su agente falló.',
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
/* Los DOS sabores que el servidor produce, y ahora son exactamente los que dibuja.
   Eran cuatro: `serie_agotada` nunca se produjo y `automatico_en_curso` salio por pedido —los
   automaticos los corre el CRM, no son trabajo de esta pantalla—. Una rama de interfaz para un
   caso que nada produce se lee como si funcionara. */
const CASO = {
  manual_de_hoy: { texto: 'Le toca hoy', clase: 'seg' },
  manual_vencido: { texto: 'Vencido', clase: 'venc' },
};

/* La hora ya no se calcula acá: `horaEnZona` de `lib/negocio/tiempo.ts` es la ÚNICA definición de
   toda la aplicación. El documento de la Agenda nombra el defecto que eso cierra — *"cuando cada
   pantalla la calculaba por su cuenta, dos vitrinas mostraban horas distintas para la misma
   cita"*—, y este archivo era una de las dos. */

/** Una fila de la Agenda: la hora, el estado, la sala y los seis íconos. */
/**
 * Una fila de la Agenda de hoy.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL DEFECTO QUE TUVO: LA ÚNICA FILA DE LA PANTALLA QUE NO SE PODÍA ABRIR
 *
 * Las otras cuatro colas dibujan `Fila`, que recibe `onAbrir` y abre la ficha. Esta cola dibuja
 * su propio componente —necesita la HORA en la primera columna y el botón de la sala, que `Fila`
 * no tiene— y al escribirlo se le olvidó la mitad clicable.
 *
 * Y no fallaba: **`.md-r:hover` ilumina TODA fila con esa clase**, así que la de agenda se
 * encendía al pasar el ratón igual que las demás y no hacía nada al hacer clic. Es literalmente
 * lo que el comentario de `Fila` describe como *«la forma más rápida de que alguien deje de
 * confiar en la pantalla»* — y le pasaba justo en la cola que un closer abre primero cada
 * mañana, donde está la gente a la que va a llamar en un rato.
 *
 * ── `onAbrir` ES OBLIGATORIO, AL REVÉS QUE EN `Fila` ──────────────────
 *
 * `Fila` lo tiene opcional y no es clicable sin él: es un componente compartido, y su comentario
 * viene de la Etapa 11, cuando la ficha todavía no existía. Acá hay UN llamador y siempre lo pasa,
 * así que una condición sería una rama que no corre nunca — y una rama que no corre es dónde se
 * esconde el próximo defecto de éstos.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function FilaDeAgenda({ item, zona, onAbrir }) {
  const c = item.cita;
  return (
    <div
      className="md-r"
      style={{ cursor: 'pointer' }}
      onClick={() => onAbrir(item.fila)}
    >
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
          <a
            className="md-join"
            href={c.salaUrl}
            target="_blank"
            rel="noreferrer"
            /* Se corta la propagación, y sin esto el arreglo de arriba estrena un defecto: un clic
               en «Unirse» abriría la videollamada en otra pestaña **y** la ficha acá detrás. Quien
               vuelve de la llamada se encuentra un panel abierto que no pidió, encima de la lista. */
            onClick={(e) => e.stopPropagation()}
          >
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

/**
 * ── UN SOLO COMPONENTE PARA LOS DOS MI DÍA ─────────────────────────────────
 *
 * El Closer tiene cinco colas y el Setter seis, y aun así **el dibujo de una sección es idéntico**:
 * su título, su conteo —aunque sea cero—, su frase de vacío, y debajo de cada fila lo propio de esa
 * cola. Lo que cambia son los datos y la lista, no la acción.
 *
 * `secciones` llega como propiedad para que la pantalla no la deduzca de en qué pestaña está, y
 * `segundaTarjeta` porque el resumen de arriba SÍ difiere: el closer muestra sus citas de hoy y el
 * setter no tiene agenda — dibujarle una tarjeta de citas sería una tarjeta permanentemente vacía.
 */
export default function MiDia({
  colas,
  zonaHoraria,
  secciones = COLAS_DEL_CLOSER,
  segundaTarjeta = null,
  /**
   * Qué hacer después de resolver. **Sin esto, el botón no se dibuja.**
   *
   * No es una comodidad: resolver saca al contacto de la cola en el servidor, y sin recargar la
   * pantalla sigue mostrándolo. El vendedor apretaría el botón otra vez sobre algo ya hecho.
   *
   * Y que sea obligatorio para dibujarlo es deliberado: una pantalla que monte `MiDia` sin poder
   * recargar **no tiene que ofrecer el botón**, en vez de ofrecer uno que deja la vista mintiendo.
   */
  alResolver = null,
}) {
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
            {/* El chip decia «las series automaticas no cuentan», y era necesario cuando la
                cola las MOSTRABA sin sumarlas: sin esa aclaracion, quien veia la lista mas larga
                que el contador creia que el contador estaba roto. Ahora no se muestran, asi que la
                lista y el contador coinciden y la aclaracion sobra. */}
            <span className="md-chip o">solo lo que necesita tus manos</span>
          </div>
        </div>
        {segundaTarjeta}
      </div>

      {/* ── Las colas de este módulo ── */}
      {secciones.map((cola) => {
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
                return (
                  <FilaDeAgenda
                    key={item.fila.id + i}
                    item={item}
                    zona={zonaHoraria}
                    /* El MISMO manejador que las otras cuatro colas: `item.fila` es una `Fila`
                       completa —la arma `lib/negocio/miDia.ts` desde la caché de contactos— así
                       que su `id` es el del contacto, no el de la cita. */
                    onAbrir={(fila) => setAbierta(fila.id)}
                  />
                );
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
                  {/* ── RESOLVER, Y SOLO EN URGENTES ──────────────────────────────
                      La ruta existía desde la Etapa 13 y **no la llamaba nadie**: el vendedor podía
                      ver el motivo de la urgencia y no tenía cómo cerrarla, así que el contacto se
                      quedaba en la cola para siempre.

                      Va acá y no dentro de `Fila`: la fila es el mismo componente en las cinco
                      colas y en el Pipeline, y meterle un botón que solo tiene sentido en una es el
                      camino a cinco variantes que divergen. */}
                  {cola.clave === 'urgentes' ? (
                    <BotonDeResolver contactoId={item.fila.id} alResolver={alResolver} />
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
                      {/* Acá se dibujaba «no necesita que hagas nada» para las series automáticas.
                          Ya no hay ninguna fila así: todo lo que entra a esta cola pide manos, así
                          que la aclaración describiría un caso que no puede ocurrir. El campo
                          `pideManos` sigue viajando, y por eso el contador lo sigue filtrando en vez
                          de sumar el largo de la lista. */}
                    </div>
                  ) : null}
                  {/* DOS ORÍGENES, DOS FRASES. «Completadas hoy» junta dos cosas: un resultado
                      registrado con Avanzar, y una respuesta a alguien que estaba en el buzón.
                      «Registrado como Respondido» no es castellano y además confunde las dos: nadie
                      registró nada, se contestó un mensaje. */}
                  {item.completadaPor ? (
                    <div className="md-sub" style={{ padding: '0 16px 10px 56px' }}>
                      {item.completadaPor === 'Respondido' ? (
                        <>le respondiste hoy</>
                      ) : (
                        <>registrado como <b>{item.completadaPor}</b></>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ESTE AVISO NO SE BORRA, Y VALE DECIR POR QUÉ.
          Solo aparece cuando el territorio no entró completo en una consulta, o sea cuando estas
          listas de verdad pueden estar cortas. Sacarlo haría que una lista incompleta se viera
          igual que una completa — que es el defecto que esta pantalla persigue en todas sus colas:
          un cero medido y un cero no medido no son lo mismo.
          Lo que sí se cambió es CÓMO lo dice. Antes hablaba de «los que caben en una pasada», que
          es vocabulario del servidor y no le dice nada a quien lo lee. */}
      {colas.truncado ? (
        <div className="fd-aviso falta">
          <i>⚠</i>
          <span>
            Tenés muchos contactos asignados y estas listas muestran una parte. Si buscás a alguien
            y no aparece acá, todavía puede estar en tu cartera.
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

/**
 * El botón de resolver una intervención.
 *
 * ── LAS TRES RESPUESTAS, Y LA DEL MEDIO ES LA QUE IMPORTA ─────────────────
 *
 * «Resuelto», «resuelto pero el CRM no aceptó» y «no se pudo». La del medio **no es un error**: la
 * resolución ya ocurrió y el contacto ya salió de la cola. Pero el agente sigue pausado en el CRM,
 * y si eso se dibuja como un éxito nadie lo va a reactivar.
 *
 * Y se recarga en los dos casos que escribieron algo, no solo en el limpio: si no se recargara tras
 * el del medio, la pantalla seguiría mostrando una urgencia que ya está cerrada.
 */
function BotonDeResolver({ contactoId, alResolver }) {
  const [resolviendo, setResolviendo] = useState(false);
  const [dice, setDice] = useState('');

  // Sin forma de recargar, no se ofrece. Ver el comentario de `alResolver`.
  if (!alResolver) return null;

  const resolver = async () => {
    setResolviendo(true);
    setDice('');
    const r = await resolverIntervencion(contactoId);
    setDice(queDecir(r));
    setResolviendo(false);
    if (r.tipo === 'ok') alResolver();
  };

  return (
    <div className="md-sub" style={{ padding: '0 16px 10px 56px' }}>
      <button type="button" className="fd-btn sec" onClick={resolver} disabled={resolviendo}>
        {resolviendo ? 'Resolviendo…' : 'Ya lo atendí'}
      </button>
      {dice ? <span style={{ marginLeft: 10 }}>{dice}</span> : null}
    </div>
  );
}
