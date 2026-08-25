'use client';

/* La pestaña Closer. Cuatro sub-pestañas: Inicio · Mi Día · Pipeline · Agenda.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ SE BORRÓ DE ACÁ, Y POR QUÉ NO ERA UN DETALLE
 *
 * `lib/aios/closer.js` llenaba estas cuatro sub-pestañas con datos escritos a mano, y estuvo en
 * producción: un cockpit con 20 llamadas y 95% de asistencia, cinco meses de facturación
 * inventada, seis citas con nombres de personas, un diagnóstico atribuido a la IA que ninguna IA
 * generó, y el encabezado «Closer · Jorge Veramendi».
 *
 * Dos detalles que muestran hasta dónde llegaba: el encabezado del buzón decía **25** con
 * **siete** filas debajo, y una aclaración afirmaba *"julio es real · abril a junio son
 * referencia"* — decía de dónde venían datos que no venían de ninguna parte.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * UNA SOLA LLAMADA PARA INICIO Y MI DÍA, Y NO ES POR AHORRAR UNA PETICIÓN
 *
 * El contador de tareas del cockpit se calcula con la regla de Mi Día —los seguimientos
 * automáticos **no** suman— así que con dos endpoints habría dos implementaciones del mismo
 * número. El `01` es terminante: *"si dos pantallas muestran el mismo número, comparten la
 * función que lo calcula"*.
 *
 * Con una llamada, el cockpit recibe el contador que Mi Día ya calculó. No puede discrepar.
 *
 * ── Y CERO LLAMADAS A GOHIGHLEVEL ───────────────────────────────────────────
 *
 * El `04` § 8: las cuatro pantallas que el closer mira todo el día cuestan **0**. Todo el
 * presupuesto se gasta en TRAER los datos —`/api/contactos/sincronizar`, por acción explícita de
 * una persona— y no en mirarlos.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Inicio from '../closer/Inicio.jsx';
import MiDia from '../closer/MiDia.jsx';
import ListaDeContactos from '../negocio/ListaDeContactos.jsx';

const SUB = [
  { clave: 'inicio', nombre: 'Inicio', icono: '#i-exec' },
  { clave: 'dia', nombre: 'Mi Día', icono: '#i-setter' },
  { clave: 'pipeline', nombre: 'Pipeline', icono: '#i-conv' },
  { clave: 'agenda', nombre: 'Agenda', icono: '#i-closer' },
];

const MOTIVOS = {
  sin_permiso: 'Tu usuario no tiene permiso para ver esta pestaña.',
  organizacion_inactiva: 'Esta organización está desactivada.',
};

/** El cartel de lo que todavía no está. Dice QUÉ falta, no «próximamente». */
function Falta({ titulo, detalle, puntos }) {
  return (
    <div className="empty">
      <div className="e-ic">◇</div>
      <div className="e-t">{titulo}</div>
      <div className="e-d">{detalle}</div>
      {puntos ? (
        <ul>
          {puntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function CloserView({ activa }) {
  /* Inicio arranca, como se pidió: el cockpit responde «¿cómo voy este mes?» y es lo primero
     que alguien quiere ver al abrir su pestaña. */
  const [sub, setSub] = useState('inicio');
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const yaPedido = useRef(false);

  /* ── UNA RECARGA NO ES UNA PRIMERA CARGA, Y CONFUNDIRLAS CIERRA LA FICHA ────
   *
   * **Medido en el navegador.** Con una ficha abierta, volver a la pestaña la cerraba: `cargar`
   * ponía `'cargando'`, eso reemplaza el cuerpo entero por el aviso de espera, y al desmontarse
   * `MiDia` se lleva puesta la ficha que colgaba de su estado.
   *
   * Es exactamente lo que el `02` § 1 prohíbe —*"quien la abre no pierde el contexto de dónde
   * estaba"*—, y se ve como si la aplicación se hubiera reiniciado sola.
   *
   * Con el reloj del chat esto pasa de ser molesto a ser constante, así que la regla queda escrita:
   * **la pantalla solo se vacía cuando no hay nada que mostrar.** Teniendo datos, una recarga los
   * reemplaza cuando llega la respuesta, y hasta entonces no se toca nada.
   */
  const cargar = useCallback(async () => {
    setSituacion((antes) => (antes === 'listo' ? antes : 'cargando'));
    const r = await pedir('/api/closer/mi-dia');
    /* Las tres ramas sin colapsar (`ADR-0305`). Un rechazo por permiso NO es «no hay datos»:
       con una sola rama, alguien sin `closer.ver` vería un cockpit en cero y creería que no
       vendió nada. */
    /* Y UN FALLO DE RECARGA TAMPOCO VACÍA LA PANTALLA. Es la misma regla mirada del otro lado:
       borrar el día de trabajo de alguien por un corte de red de dos segundos es peor que seguir
       mostrando datos de hace un momento. Lo que NO se hace es callarlo — queda el aviso de abajo,
       que dice que lo que se está viendo no se pudo actualizar. */
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor. No es que no tengas trabajo: no se pudo preguntar.');
      setSituacion((antes) => (antes === 'listo' ? antes : 'sin_respuesta'));
      return;
    }
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`);
      setSituacion((antes) => (antes === 'listo' ? antes : 'rechazado'));
      return;
    }
    setDatos(r.datos);
    // Y se limpia el aviso: un fallo viejo que no se borra es como se aprende a ignorar un cartel.
    setCausa(null);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /* ── SIN RELOJ, Y ES DELIBERADO ─────────────────────────────────────────────
   *
   * El `04` § 2 pone el reloj principal en 10 segundos, y también dice qué lo hace sostenible:
   * un candado del lado del servidor que hace que N pestañas cuesten lo mismo que una, y una
   * marca de agua para que el costo sea proporcional a la actividad y no al tamaño de la
   * cuenta. **Ninguna de las dos piezas existe todavía.**
   *
   * Poner el intervalo antes que el candado sería la parte fácil de un diseño cuya parte difícil
   * lo sostiene: cada pestaña abierta multiplicaría las consultas, y con tres vistas abiertas
   * son cientos de peticiones por hora. Es exactamente el estado del que el `04` § 1 dice que
   * se venía: *"ocho `setInterval` sueltos repartidos en cuatro archivos"*.
   *
   * Mientras tanto se recarga en los dos momentos que el `04` § 2 llama correctos para las
   * pantallas sin reloj: **al montar** y **al recuperar el foco**. Y al volver dispara de
   * inmediato, porque quien vuelve a la pestaña quiere ver fresco, no esperar un ciclo.
   */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  function cuerpo() {
    if (situacion === 'cargando') {
      return (
        <div className="fd-aviso">
          <i>◍</i>
          <span>Cargando tu día…</span>
        </div>
      );
    }
    if (situacion === 'sin_respuesta') {
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
    if (situacion === 'rechazado') {
      return (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>{causa}</span>
        </div>
      );
    }

    if (sub === 'inicio') {
      return <Inicio cockpit={datos.cockpit} alIrAMiDia={() => setSub('dia')} />;
    }
    if (sub === 'dia') {
      return <MiDia colas={datos.colas} zonaHoraria={datos.zonaHoraria} />;
    }
    if (sub === 'pipeline') {
      return (
        <Falta
          titulo="El pipeline necesita la etapa de cada contacto"
          detalle={
            'Las siete columnas se arman de la etapa, y la etapa vive en la base propia: la ' +
            'pone Avanzar, que todavía no existe. Para los contactos que nunca recibieron un ' +
            'Avanzar se deduce de las etiquetas de desenlace, y hoy solo dos de los 124 tienen ' +
            'alguna.'
          }
          puntos={[
            'Agendado · Seguimiento · Cierre en curso · Ganado · No-show · Nurture · Descalificado',
            'Cada columna con su conteo, aunque esté vacía',
            'Los congelados se ven, atenuados y con su explicación',
          ]}
        />
      );
    }
    return (
      <Falta
        titulo="La agenda necesita las citas de tu calendario"
        detalle={
          'Las citas se leen del calendario de tu subcuenta de GoHighLevel, y eso todavía no ' +
          'está conectado. La etiqueta `cita_agendada` dice quién tiene cita —74 contactos— ' +
          'pero no cuándo, así que no alcanza para dibujar un calendario.'
        }
        puntos={[
          'Mini-calendario del mes y Próximos Días',
          'La agenda del día, con el enlace de cada videollamada',
          'Un botón para traer del CRM: una llamada por clic, nunca un reloj',
        ]}
      />
    );
  }

  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-closer">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Closer
              </h2>
              <span className="cre-desc">
                {sub === 'inicio' ? 'Cómo voy este mes' : 'Qué tengo que hacer ahora'}
              </span>
            </div>
            <div className="cl-sub">
              {SUB.map((s) => (
                <button
                  key={s.clave}
                  type="button"
                  data-c={s.clave}
                  className={sub === s.clave ? 'on' : undefined}
                  onClick={() => setSub(s.clave)}
                >
                  <svg viewBox="0 0 16 16">
                    <use href={s.icono} />
                  </svg>
                  {s.nombre}
                  {/* El contador va en Mi Día y solo si hay algo. Un `0` en una píldora al lado
                      del nombre es ruido que se aprende a ignorar. */}
                  {s.clave === 'dia' && datos?.colas?.tareasPendientes ? (
                    <span className="cnt">{datos.colas.tareasPendientes}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* El aviso de una recarga que no salió. Aparece SOBRE los datos, no en lugar de ellos:
            lo que se está viendo sigue siendo cierto, solo que es de hace un momento. */}
        {situacion === 'listo' && causa ? (
          <div className="fd-aviso falta" style={{ marginBottom: 12 }}>
            <i>◍</i>
            <span>Esto es de hace un momento: la última actualización no salió. {causa}</span>
          </div>
        ) : null}

        <div className="cl-page">{cuerpo()}</div>

        {/* La lista completa del territorio queda accesible desde Mi Día: es donde se trae de
            GoHighLevel y donde se ven los 124, no solo los del día. */}
        {sub === 'dia' && situacion === 'listo' ? (
          <div style={{ marginTop: 18 }}>
            <ListaDeContactos camino="/api/closer/contactos" zona="zona closer" />
          </div>
        ) : null}
      </div>
    </section>
    </>
  );
}
