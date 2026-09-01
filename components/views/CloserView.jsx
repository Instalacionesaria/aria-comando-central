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

import { useCallback, useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { CADENCIA, usarReloj } from '../../lib/reloj.ts';
import { estaALaVista } from '../../lib/vista.ts';
import { useSesion } from '../../app/sesion-contexto.tsx';
import Pipeline from '../closer/Pipeline.jsx';
import Agenda from '../closer/Agenda.jsx';
import Inicio from '../closer/Inicio.jsx';
import { horaEnZona } from '../../lib/negocio/tiempo.ts';
import MiDia from '../closer/MiDia.jsx';

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


export default function CloserView({ activa }) {
  /* Inicio arranca, como se pidió: el cockpit responde «¿cómo voy este mes?» y es lo primero
     que alguien quiere ver al abrir su pestaña. */
  const [sub, setSub] = useState('inicio');
  /* ── DE QUIEN SE ESTAN MIRANDO LOS NUMEROS ────────────────────────────────
   *
   * `null` = de toda la empresa, que es lo que ve quien administra por omision. Viaja en la URL de
   * la peticion y no en el cuerpo porque este `GET` lo repite un reloj cada diez segundos: en el
   * parametro, la recarga lo arrastra sola.
   *
   * Quien es closer NO puede cambiarlo, y no porque la pantalla lo esconda: el servidor ignora el
   * parametro cuando el alcance propio no es `todo`. Esconder el selector es comodidad; lo que
   * cierra la puerta esta en `alcancePedido`. */
  const [verComo, setVerComo] = useState(null);
  /* De la sesión sale una sola cosa acá: si esta persona puede configurar los porcentajes del
     equipo. Lo responde el SERVIDOR con la condición exacta del endpoint, no se deduce del rol. */
  const sesion = useSesion();
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);

  /* ¿Es ÉSTA la pantalla que se está mostrando? De esto cuelga todo el gasto de la sección — ver el
     efecto de la primera carga. `activa` NO sirve: se calcula una sola vez al arrancar y el cambio
     de pantalla es puro DOM, así que quien empieza en Ajustes tendría `activa: false` para siempre
     y quien empieza en el Closer, `true` para siempre. */
  const aLaVista = estaALaVista('closer');

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
    const r = await pedir(
      verComo ? `/api/closer/mi-dia?verComo=${encodeURIComponent(verComo)}` : '/api/closer/mi-dia',
    );
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
  }, [verComo, ]);


  /* ── EL RELOJ DE 10 SEGUNDOS, QUE ESTUVO BLOQUEADO A PROPÓSITO ──────────────
   *
   * Hasta ahora este archivo decía que el intervalo no se ponía porque *"poner el intervalo antes
   * que el candado sería la parte fácil de un diseño cuya parte difícil lo sostiene"*, y nombraba
   * las dos piezas que faltaban: **un candado del lado del servidor** que hace que N pestañas
   * cuesten lo mismo que una, y **una marca de agua** para que el costo sea proporcional a la
   * actividad y no al tamaño de la cuenta.
   *
   * Las dos existen: `lib/negocio/pulso.ts` y la columna `marca_el`. Medido contra la cuenta real,
   * **un ciclo en régimen cuesta exactamente 1 llamada** — la búsqueda, que devuelve cero
   * conversaciones nuevas.
   *
   * ── SON DOS PEDIDOS Y NO UNO, Y CONVIENE DECIR POR QUÉ ────────────────────
   *
   * El tic dispara la INGESTA —que es la que habla con el CRM— y después recarga las colas. Podrían
   * ser uno solo, y no lo son porque hacen cosas distintas: la ingesta la puede pedir también una
   * tarea programada sin que haya nadie mirando, y las colas no sirven de nada sin una pantalla.
   * Los dos pedidos son contra NUESTRO servidor; el presupuesto del proveedor lo gobierna el
   * candado, no esta perilla.
   *
   * Y el orden importa: primero traer, después leer. Al revés, cada tic mostraría lo de hace diez
   * segundos.
   */
  const tic = useCallback(async () => {
    // Un fallo de la ingesta NO impide recargar las colas: son dos cosas, y que el CRM esté caído
    // no es motivo para dejar de mostrar el trabajo que ya está en la base.
    await pedir('/api/mensajes/ingesta', { metodo: 'POST' });
    await cargar();
  }, [cargar]);

  /* Una sola clave para toda la aplicación: si mañana el Setter tiene su propio tic, registrarlo
     con esta misma clave lo REEMPLAZA en vez de duplicar el tráfico.

     Y `null` cuando el Closer no está a la vista, que es la palanca más grande y la más barata de
     todo el consumo: `usarReloj` con clave nula **no registra nada**, así que no hay intervalo, no
     hay pedido a la ingesta y no hay llamada al CRM. Ver el efecto de arriba. */
  usarReloj(aLaVista ? 'operacion:tic' : null, tic, CADENCIA.operacion);

  /* ── ESTE EFECTO VA DESPUÉS DE `const tic`, Y NO ES ORDEN LIBRE ──────────────
   *
   * Estuvo arriba, donde vivía la carga inicial, y **la pantalla no abría**:
   * `ReferenceError: Cannot access 'tic' before initialization`. Un `const` no está inicializado
   * hasta su línea, así que leerlo antes revienta en tiempo de ejecución — y no en tiempo de
   * compilación: `next build` compiló, `tsc` pasó y las 885 pruebas quedaron verdes. Lo encontró
   * abrir la aplicación en el navegador.
   *
   * Y el síntoma fue el peor posible: la vista entera en blanco con «esta página no se pudo cargar»,
   * porque el error ocurre durante el render del componente. */
  /* ════════════════════════════════════════════════════════════════════════
     NADA DE ESTA PANTALLA CUESTA SI NADIE LA ESTÁ MIRANDO

     `CommandCenter` monta las diez vistas de una sola vez, y el cambio de pantalla es puro DOM. Así
     que este componente está montado desde que la aplicación arranca, para todo el mundo que tenga
     la sección Closer en su menú — incluidos los administradores, que entran a Ajustes.

     Lo que eso costaba, medido: la primera carga MÁS **360 llamadas al CRM por hora y por empresa**,
     con el Closer sin abrir ni una vez. Ocho horas son 2.880 llamadas por empresa por día que no
     mira nadie, y con M empresas se multiplica.

     Ahora la primera carga y el reloj cuelgan los dos de `estaALaVista`. Para quien no abre el
     Closer el gasto es **cero**: ni la llamada inicial.

     ── Y AL ENTRAR SE TRAE UNA VEZ, QUE NO ES LO MISMO QUE ANTES ────────────

     El reloj **no dispara al registrarse** —está documentado en `lib/reloj.ts`— así que sin este
     efecto, abrir el Closer mostraría lo de hace diez segundos en el mejor caso y lo de hace una
     hora en el peor, hasta el próximo tic. Con él, entrar cuesta un ciclo, que es lo que costaba
     antes de todos modos.

     Y se dispara CADA VEZ que se vuelve a entrar, no solo la primera: quien sale a Ajustes y vuelve
     a los veinte minutos tiene que ver su día de ahora, no el de cuando se fue. */
  useEffect(() => {
    if (!aLaVista) return;
    void tic();
  }, [aLaVista, tic]);

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
      return (
        <Inicio
          cockpit={datos.cockpit}
          comision={datos.comision}
          mirandoOtraOrganizacion={datos.mirandoOtraOrganizacion}
          /* Al guardar la meta se pisa SOLO la comisión, con lo que devolvió el servidor. Recargar
             todo serviría igual y tardaría: el resto del tablero no cambió porque alguien fijó su
             meta, y una recarga completa acá es la que se lleva puesto lo que otro componente
             tenga abierto. */
          alGuardarLaMeta={(nueva) => setDatos((d) => (d ? { ...d, comision: nueva } : d))}
          /* Quién puede configurar los porcentajes del equipo lo dice el SERVIDOR, con la condición
             exacta del endpoint. Ver `app/api/auth/sesion/route.ts`. */
          puedeConfigurarComisiones={sesion?.puedeConfigurarComisiones ?? false}
          closers={datos?.closers ?? []}
          mirando={datos?.mirando ?? null}
          puedeVerTodo={datos?.puedeVerTodo ?? false}
          verComo={verComo}
          alVerComo={setVerComo}
          soyElCloser={datos?.soyElCloser ?? false}
          /* Y la recarga completa, para cuando se cierra la ventana de los porcentajes: ahí sí puede
             haber cambiado el número de quien mira. */
          alRecargar={() => void cargar()}
          alIrAMiDia={() => setSub('dia')}
        />
      );
    }
    if (sub === 'dia') {
      return <MiDia
          colas={datos.colas}
          zonaHoraria={datos.zonaHoraria}
          /* Resolver saca al contacto de la cola en el servidor. Sin la recarga, la pantalla lo
             seguiría mostrando y el vendedor apretaría el botón otra vez sobre algo ya hecho. */
          alResolver={() => void cargar()}
          segundaTarjeta={
            /* Las citas de hoy. Es la tarjeta que el Setter NO tiene: trabaja antes de que exista
               una cita, así que dibujarle este número sería un cero permanente. */
            <div className="md-c">
              <div>
                <div className="md-k">Citas de hoy</div>
                <div
                  className="md-v"
                  style={{ color: datos.colas.agenda.length ? 'var(--accent)' : 'var(--txt-faint)' }}
                >
                  {datos.colas.agenda.length}
                </div>
              </div>
              <div className="md-s">
                {datos.colas.agenda[0]?.cita
                  ? `próxima a las ${horaEnZona(datos.colas.agenda[0].cita.inicioEl, datos.zonaHoraria)}`
                  : 'sin citas leídas'}
              </div>
            </div>
          }
        />;
    }
    if (sub === 'pipeline') return <Pipeline camino="/api/closer/pipeline" />;

    return <Agenda zonaHoraria={datos.zonaHoraria} />;
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

        {/* ── MI DÍA MUESTRA SUS COLAS Y NADA MÁS ──────────────────────────
            Acá se dibujaba, debajo de las cinco colas, la lista COMPLETA del territorio con su
            botón «Traer de GoHighLevel». Se quitó por pedido explícito: Mi Día responde «qué
            tengo que hacer ahora», y una lista de 124 contactos más un botón que habla con el
            CRM del proveedor no contestan esa pregunta — la diluyen, y encima ponen el nombre
            de una herramienta ajena delante de un cliente.

            LO QUE ESTO SE LLEVA, dicho para que no sorprenda: era el único punto del Closer
            desde el que se podían traer contactos. El cron solo hace `mensajes`, `citas` y
            `sonda` —ver `lib/negocio/barrido.ts`— así que NO hay sincronización automática de
            contactos. Hoy el único botón que queda vive en la pestaña Setter, y llama al mismo
            `/api/contactos/sincronizar`, que trae los dos territorios de una vez.

            O sea: quien solo tenga la sección Closer no puede traer contactos. La solución
            durable es agregar `contactos` a las tareas del cron, y está anotada como pendiente
            en `docs/DESPLIEGUE.md`. */}
      </div>
    </section>
    </>
  );
}
