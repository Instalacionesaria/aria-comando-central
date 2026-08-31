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

const SUB = [
  { clave: 'dia', nombre: 'Mi Día', icono: '#i-setter' },
  { clave: 'pipeline', nombre: 'Pipeline', icono: '#i-conv' },
  { clave: 'inicio', nombre: 'Inicio', icono: '#i-exec' },
];

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

  const tic = useCallback(async () => {
    // Un fallo de la ingesta NO impide recargar: son dos cosas, y que el CRM esté caído no es
    // motivo para dejar de mostrar el trabajo que ya está en la base. Mismo criterio que el Closer.
    await pedir('/api/mensajes/ingesta', { metodo: 'POST' });
    setPulso((n) => n + 1);
  }, []);

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
            <ListaDeContactos camino="/api/setter/contactos" zona="zona setter" pulso={pulso} />
          ) : null}

          {sub === 'pipeline' ? (
            <Falta
              titulo="El pipeline del setter necesita la etapa de cada contacto"
              detalle={
                'GoHighLevel no expone un campo de etapa: la mueve un workflow disparado por ' +
                'una etiqueta. Hasta que eso se lea, las columnas estarían todas vacías.'
              }
              puntos={[
                'Nuevo · Contactado · Calificando · Agendado · Descalificado',
                'Cada columna con su conteo, aunque esté vacía',
                'Antigüedad por contacto',
              ]}
            />
          ) : null}

          {sub === 'inicio' ? (
            <Falta
              titulo="El tablero del mes todavía no tiene de dónde sacar los números"
              detalle={
                'Los agendamientos, las ventas chicas y la tasa de calificación se calculan de ' +
                'los resultados que se registran con Avanzar. Todavía no hay ninguno, así que ' +
                'acá iría un “—” y no un “0”: son dos cosas distintas y sólo una es cierta.'
              }
              puntos={[
                'Agendamientos del mes y tasa de calificación',
                'Ventas chicas cerradas por el setter',
                'La atribución: qué agendamientos terminaron en venta del closer',
              ]}
            />
          ) : null}
        </div>
      </div>
    </section>
    </>
  );
}
