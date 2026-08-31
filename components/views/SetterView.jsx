'use client';

/* La pestaña Setter. Portada de aios-command-center_1.html líneas 3075-3147, y REESCRITA en la
 * Etapa 11 para que no invente nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ SE BORRÓ
 *
 * Esta vista era **JSX estático**: 222 líneas de datos escritos a mano, sin una sola llamada al
 * servidor. Cuatro números de resumen, tres "escalados por el agente" con nombres de personas y
 * su motivo, y tres seguimientos. Todo inventado, y en producción.
 *
 * Y algo peor que los datos: los botones de Pipeline y Agenda **no tenían ningún listener** en
 * todo el repositorio. Se podían apretar y no pasaba nada — ni un error, ni un cambio. Un
 * control que parece funcionar y no hace nada es la forma más rápida de que alguien deje de
 * confiar en la pantalla entera.
 *
 * ── LO QUE HAY AHORA ────────────────────────────────────────────────────────
 *
 * **Mi Día** trae los contactos de verdad, de `/api/setter/contactos` — los de `zona_setter`, y
 * ninguno del closer. La fila y los seis íconos son los MISMOS componentes que usa el Closer
 * (`components/negocio/`), por el `11` § 7: *"si se construyen por pantalla, divergen"*.
 *
 * Las otras dos sub-pestañas dicen qué falta, y sus botones ahora sí responden.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { CADENCIA, usarReloj } from '../../lib/reloj.ts';
import { estaALaVista } from '../../lib/vista.ts';
import ListaDeContactos from '../negocio/ListaDeContactos.jsx';
/* El MISMO componente que el Closer, con otro camino. El dibujo de una columna con su nombre, su
   conteo y su tinte es idéntico; lo que cambia son las etapas, que las trae el servidor. */
import Pipeline from '../closer/Pipeline.jsx';
/* Y el MISMO Mi Día, con OTRAS secciones. El dibujo de una sección —su título, su conteo aunque sea
   cero, su frase de vacío— es idéntico; lo que cambia son las colas, que las trae el servidor. */
import MiDia from '../closer/MiDia.jsx';
import Inicio from '../setter/Inicio.jsx';

/**
 * Las SEIS colas del setter, en el orden en que se trabajan.
 *
 * Dos son propias —estancadas y oportunidades chicas— y la agenda del closer **no está**: el setter
 * trabaja por definición antes de que haya cita, así que una sección de citas sería una sección
 * permanentemente vacía.
 *
 * ── Y URGENTES VA A ESTAR VACÍA, SIN DECIR POR QUÉ ─────────────────────────
 *
 * El auditor del setter todavía no existe, así que nadie aplica una etiqueta de fallo sobre un
 * contacto de pre-agenda. La sección **no se atenúa ni se oculta**: vacía porque su auditor no
 * existe es un hecho distinto de vacía porque hoy no hay urgencias, y esconderla haría que nadie
 * note cuál de los dos es.
 *
 * Y su frase de vacío **no explica que falta el auditor**. Eso es jerga interna: quien la lee no
 * puede hacer nada con ella, y el día que el auditor exista el texto queda mintiendo — que es
 * exactamente el defecto que este proyecto ya pagó con los avisos de «fuente sin conectar».
 */
const COLAS_DEL_SETTER = [
  {
    clave: 'urgentes',
    titulo: 'Intervenciones urgentes',
    tono: 'crit',
    vacio: 'Ninguna. El agente de IA no falló en ningún contacto.',
  },
  {
    clave: 'buzon',
    titulo: 'Respondieron · buzón general',
    vacio: 'Nadie escribió sin respuesta.',
  },
  {
    clave: 'oportunidades',
    titulo: 'Oportunidades chicas',
    vacio: 'El agente no derivó a nadie al producto chico.',
  },
  {
    clave: 'estancadas',
    titulo: 'Conversaciones estancadas',
    tono: 'warn',
    vacio: 'Ninguna conversación se apagó.',
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

/* ── LA LISTA COMPLETA SALIÓ DE «MI DÍA» Y GANÓ SU PROPIA PESTAÑA ────────────
 *
 * Es el mismo movimiento que el Closer ya hizo, con el mismo argumento: Mi Día contesta «¿qué tengo
 * que hacer ahora?», y la lista de todo el territorio contesta otra pregunta. Mezclarlas hace que la
 * pantalla del trabajo del día arranque con doscientas filas que no piden nada.
 *
 * Pero la lista **no se borra**, y eso es deliberado: trae con ella el botón de traer contactos del
 * CRM, que hoy es **el único de toda la aplicación**. Sacarla sin darle lugar habría quitado la
 * única forma manual de sincronizar, y el síntoma sería «los contactos nuevos tardan diez minutos»
 * sin que nadie sepa que antes había un botón. */
const SUB = [
  { clave: 'dia', nombre: 'Mi Día', icono: '#i-setter' },
  { clave: 'contactos', nombre: 'Contactos', icono: '#i-leads' },
  { clave: 'pipeline', nombre: 'Pipeline', icono: '#i-conv' },
  { clave: 'inicio', nombre: 'Inicio', icono: '#i-exec' },
];

export default function SetterView({ activa }) {
  const [sub, setSub] = useState('dia');

  /* ══ EL SETTER ALIMENTA SU PROPIO CHAT, Y ANTES NO LO HACÍA ════════════════
   *
   * `CloserView` era el **único** lugar de toda la aplicación que disparaba la ingesta de mensajes.
   * Consecuencia medida en el código: un setter que abría una conversación veía el chat repintarse
   * cada cinco segundos con lo que ya estaba en la base, y **nada traía mensajes nuevos del CRM**
   * salvo que pasara el ciclo de diez minutos o que otra persona tuviera el Closer abierto.
   *
   * El chat es donde el setter trabaja — es la pantalla que MÁS necesita estar al día, y era la
   * única sin nadie que la alimentara.
   *
   * ── LA MISMA CLAVE QUE EL CLOSER, Y ESO NO ES UN DESCUIDO ───────────────
   *
   * `registrarReloj` reemplaza por clave, así que con `'operacion:tic'` en las dos vistas **nunca
   * corren las dos**: la que está a la vista registra y la otra pasa `null`. Lo dejó anticipado el
   * comentario del Closer — *«si mañana el Setter tiene su propio tic, registrarlo con esta misma
   * clave lo REEMPLAZA en vez de duplicar el tráfico»*.
   *
   * Y el gasto hacia el CRM no sube igual: el candado de `lib/negocio/pulso.ts` garantiza una
   * ingesta por ciclo sin importar cuántas pestañas ni cuántas personas pregunten. */
  const aLaVista = estaALaVista('setter');
  const [pulso, setPulso] = useState(0);
  const [colas, setColas] = useState(null);
  const [zonaHoraria, setZonaHoraria] = useState('UTC');
  const [causa, setCausa] = useState(null);
  /* El cockpit y las dos comisiones vienen en LA MISMA respuesta que las colas, y por eso viven acá
     y no en el componente de Inicio. El motivo está en la ruta: el contador de tareas lo calcula Mi
     Día y el cockpit lo muestra, así que con dos peticiones habría dos implementaciones del mismo
     número. Acá el cockpit RECIBE el que ya se calculó. */
  const [cockpit, setCockpit] = useState(null);
  const [comision, setComision] = useState(null);
  const [otraOrg, setOtraOrg] = useState(false);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/setter/mi-dia');
    if (r.tipo !== 'datos') {
      /* Las tres ramas sin colapsar (`ADR-0305`). Un rechazo por permiso NO es «no hay datos»: con
         una sola rama, alguien sin `setter.ver` vería seis colas en cero y creería que no tiene
         trabajo. Y una recarga que falla **no vacía** lo que ya está en pantalla. */
      setCausa(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
          : 'No se pudo contactar al servidor. No es que no tengas tareas: no se pudo preguntar.',
      );
      return;
    }
    setCausa(null);
    setColas(r.datos.colas);
    setZonaHoraria(r.datos.zonaHoraria);
    setCockpit(r.datos.cockpit);
    setComision(r.datos.comision);
    setOtraOrg(r.datos.mirandoOtraOrganizacion);
  }, []);

  const tic = useCallback(async () => {
    // Un fallo de la ingesta NO impide recargar: son dos cosas, y que el CRM esté caído no es
    // motivo para dejar de mostrar el trabajo que ya está en la base. Mismo criterio que el Closer.
    await pedir('/api/mensajes/ingesta', { metodo: 'POST' });
    await cargar();
    setPulso((n) => n + 1);
  }, [cargar]);

  usarReloj(aLaVista ? 'operacion:tic' : null, tic, CADENCIA.operacion);

  /* Y una vez AL ENTRAR, sin esperar los diez segundos. Quien abre la pestaña quiere ver lo de
     ahora, no lo de hace un ciclo. */
  useEffect(() => {
    if (!aLaVista) return;
    void tic();
  }, [aLaVista, tic]);

  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-setter">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Setter
              </h2>
              <span className="cre-desc">
                Qué tengo que hacer ahora con mis contactos
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
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cl-page">
          {sub === 'dia' ? (
            <>
              {causa ? (
                <div className="fd-aviso mal" role="alert">
                  <i>⚠</i>
                  <span>{causa}</span>
                </div>
              ) : null}
              <MiDia colas={colas} zonaHoraria={zonaHoraria} secciones={COLAS_DEL_SETTER} />
            </>
          ) : null}

          {sub === 'contactos' ? (
            <ListaDeContactos camino="/api/setter/contactos" zona="zona setter" pulso={pulso} />
          ) : null}

          {sub === 'pipeline' ? (
            <Pipeline camino="/api/setter/pipeline" pulso={pulso} />
          ) : null}

          {/* ── EL TABLERO, Y EL CARTEL QUE ESTABA ACÁ ─────────────────────
              Hasta ahora esta sub-pestaña era un `Falta` que decía *«todavía no tiene de dónde sacar los
              números»*, y era **cierto**: sin las salidas del setter no existía un solo resultado de
              setter, y sin sello no había atribución. Los tres puntos que ese cartel enumeraba son
              exactamente lo que este tablero muestra ahora, menos uno —la tasa de calificación— que
              sigue faltando y por eso no se dibuja.

              El cartel se va entero. Un texto que sobrevive a lo que describe enseña a no creerle a
              los demás. */}
          {sub === 'inicio' ? (
            <>
              {/* El mismo aviso que en Mi Día, y por lo mismo (`ADR-0305`): un rechazo por permiso no
                  puede parecerse a un tablero en cero. Sin esto, alguien sin `setter.ver` vería
                  «Cargando el tablero…» para siempre y no sabría por qué. */}
              {causa ? (
                <div className="fd-aviso mal" role="alert">
                  <i>⚠</i>
                  <span>{causa}</span>
                </div>
              ) : null}
              <Inicio
                cockpit={cockpit}
                comision={comision}
                mirandoOtraOrganizacion={otraOrg}
                /* Lo que vuelve del `PATCH` son LOS DOS tramos recalculados, así que se reemplaza el
                   objeto entero. Fusionar solo el tramo tocado dejaría el otro anillo con un número
                   viejo, y un número viejo en un tablero de sueldos no se distingue de uno actual. */
                alGuardarLaMeta={(nueva) => setComision(nueva)}
                alIrAMiDia={() => setSub('dia')}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
    </>
  );
}
