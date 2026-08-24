'use client';

/* La pestaña Closer. Portada de aios-command-center_1.html líneas 3150-3172, y REESCRITA en la
 * Etapa 11 para que no invente nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ SE BORRÓ, Y POR QUÉ NO ERA UN DETALLE
 *
 * `lib/aios/closer.js` llenaba estas cuatro sub-pestañas con datos escritos a mano, y estuvo
 * en producción. Lo que mostraba:
 *
 *   · un cockpit con 20 llamadas, 24 agendadas y 95% de asistencia;
 *   · cinco meses de facturación inventada — $9.800, $14.200, $11.600, $24.800;
 *   · seis citas con nombres de personas: Luzma Carbajal, Marcos Gabriel Juarez, Rodrigo
 *     Wayar Cruz, Andres Rendon, Richie Brizuela, Irma Perez;
 *   · un diagnóstico atribuido a la IA que ninguna IA generó: *"Falla detectada por IA: el
 *     contacto pidió tres veces el precio y la garantía sin respuesta clara"*;
 *   · siete mensajes de buzón entre comillas, y "27 tareas pendientes";
 *   · el encabezado "Closer · Jorge Veramendi" y la fecha fija "jueves, 13 de agosto".
 *
 * Dos detalles que muestran hasta dónde llegaba. El encabezado del buzón decía **25** con
 * **siete** filas debajo: el conteo y la lista eran dos inventos distintos que no coincidían. Y
 * una aclaración afirmaba *"julio es real · abril a junio son referencia"* — decía de dónde
 * venían datos que no venían de ninguna parte.
 *
 * Nada de eso fallaba, y es el defecto que este sistema entero existe para impedir. Una
 * pantalla con nombres de clientes y dinero falsos es peor que una vacía: la vacía se reporta.
 *
 * ── LO QUE HAY AHORA ────────────────────────────────────────────────────────
 *
 * **Mi Día** trae los contactos de verdad, de `/api/closer/contactos`, con la fila y los seis
 * íconos compartidos (`components/negocio/`).
 *
 * **Inicio, Pipeline y Agenda** dicen que faltan, con lo que falta. No muestran `$0` ni un
 * `95%`: el `11` § 4 lo pide así —*"no hay datos cargados → `—`, con una línea que diga qué
 * falta"*— porque *"un `$0` donde nadie cargó montos afirma «no vendiste nada». Es falso"*.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import ListaDeContactos from '../negocio/ListaDeContactos.jsx';

const SUB = [
  { clave: 'dia', nombre: 'Mi Día', icono: '#i-setter' },
  { clave: 'inicio', nombre: 'Inicio', icono: '#i-exec' },
  { clave: 'pipeline', nombre: 'Pipeline', icono: '#i-conv' },
  { clave: 'agenda', nombre: 'Agenda', icono: '#i-closer' },
];

/* Mi Día va PRIMERO, y es un cambio respecto del prototipo.
 *
 * El `11` § 5.2 la llama *"la pantalla donde se trabaja"*, y el Inicio *"responde una sola
 * pregunta: ¿cómo voy este mes?"*. Abrir en el tablero tenía sentido cuando el tablero mostraba
 * números; hoy no tiene ninguno, y abrir en un cartel de "falta configurar" haría que la
 * pestaña pareciera no funcionar. */
const ARRANQUE = 'dia';

/** El cartel de lo que todavía no está. Dice QUÉ falta, no "próximamente". */
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
  const [sub, setSub] = useState(ARRANQUE);

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
              {/* El subtítulo dice qué hace la pestaña. Antes decía "Closer · Jorge
                  Veramendi" — un nombre de persona inventado, igual para todos los
                  inquilinos. */}
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

        {/* Se dibuja SOLO la sub-pestaña activa. El prototipo tenía las cuatro en el DOM con
            `hidden`, y con datos reales eso significaría pedir cuatro veces al servidor para
            mostrar una. */}
        <div className="cl-page">
          {sub === 'dia' ? (
            <ListaDeContactos camino="/api/closer/contactos" zona="zona closer" />
          ) : null}

          {sub === 'inicio' ? (
            <Falta
              titulo="El tablero del mes todavía no tiene de dónde sacar los números"
              detalle={
                'Lo cobrado, la comisión contra la meta y la tasa de asistencia se calculan de ' +
                'los resultados que se registran con Avanzar. Todavía no hay ninguno, así que ' +
                'acá iría un “—” y no un “$0”: son dos cosas distintas y sólo una es cierta.'
              }
              puntos={[
                'Cobrado del mes, y el anillo de comisión contra la meta',
                'Ventas, acuerdos sin pagar, llamadas del mes y tasa de asistencia',
                'El puente a Mi Día con las tareas pendientes',
              ]}
            />
          ) : null}

          {sub === 'pipeline' ? (
            <Falta
              titulo="El pipeline necesita la etapa de cada contacto"
              detalle={
                'GoHighLevel no expone un campo de etapa: la mueve un workflow disparado por ' +
                'una etiqueta. Hasta que eso se lea, las siete columnas estarían todas vacías ' +
                'y no dirían nada que la lista de Mi Día no diga mejor.'
              }
              puntos={[
                'Agendado · Seguimiento · Cierre en curso · Ganado · No-show · Nurture · Descalificado',
                'Cada columna con su conteo, aunque esté vacía',
                'Monto y antigüedad por contacto',
              ]}
            />
          ) : null}

          {sub === 'agenda' ? (
            <Falta
              titulo="La agenda necesita las citas de tu calendario"
              detalle={
                'Las citas se leen del calendario de tu subcuenta de GoHighLevel. Sin el token ' +
                'y el Location ID cargados en Ajustes, no hay de dónde traerlas.'
              }
              puntos={['Semana y mes', 'Bloques de disponibilidad', 'Reprogramar desde la misma vista']}
            />
          ) : null}
        </div>
      </div>
    </section>
    </>
  );
}
