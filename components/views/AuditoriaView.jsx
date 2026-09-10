/* La vista `auditoria` — la pantalla del técnico.
   ==========================================================================
   No viene de `aios-command-center_1.html`, así que **no está en `scripts/paridad.mjs`**: no hay
   contra qué compararla, y compararla contra un HTML donde no existe daría un rojo permanente —
   que no se arregla, se ignora, y con él se ignoran los demás. Es el mismo caso que `tools` y
   `monitoreo`.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— se conserva porque es el que
   hace que la vista se comporte como las otras: el mismo scroll, el mismo encabezado, el mismo
   lugar. El `id="v-auditoria"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
   `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la
   sección deja la entrada del menú sin responder, en silencio.

   ── QUIÉN LLEGA HASTA ACÁ ─────────────────────────────────────────────────

   Quien tenga `auditor.ver`. La entrada del menú la filtra `menuVisible`, y la barrera de verdad
   está en el servidor, en `app/api/auditoria/route.ts`. Esto es lo que el 03 § 7 llama comodidad y
   no seguridad: el menú sólo evita que la gente vea puertas que no puede abrir.

   Y a diferencia de `monitoreo`, **no lleva `soloDesdeLaPrincipal`**: esta pantalla muestra los
   agentes de la PROPIA empresa, no los de todas. Marcarla sería impedirle a un cliente ver los
   suyos. */

import PanelDeAuditoria from '../auditoria/PanelDeAuditoria';

export default function AuditoriaView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-auditoria">
      <div className="view-scroll cre-scroll">
        {/* ── EL ENCABEZADO ES EL MISMO QUE EL DE CLOSER Y SETTER ────────────
         *
         * Le faltaban `.stack` y `.ch-title`, y no era un detalle: la estética de operación
         * INVIERTE el peso del encabezado —el `<h2>` pasa a rótulo de 9,5 px en mayúsculas y la
         * descripción pasa a titular de 24 px— y esas dos clases son las que la sostienen. Sin
         * ellas, esta pantalla quedaba con el `align-items: baseline` del prototipo mientras las
         * otras dos se apilaban.
         *
         * Y la descripción se acortó. La vieja —«Qué patrones fallan en los agentes de IA, y con
         * qué corregir su prompt»— era una explicación, y como explicación estaba bien debajo de
         * un título grande. De titular de 24 px es una frase larga que no se lee de un vistazo, que
         * es justo lo que el titular tiene que hacer. Las otras dos son «Cómo voy este mes» y «Qué
         * tengo que hacer ahora con mis contactos»: una pregunta corta en primera persona. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Auditoría de agentes</h2>
              <span className="cre-desc">Qué está fallando en los agentes</span>
            </div>
          </div>
        </div>
        {/* ── Y EL CUERPO VA EN `.cl-page`, COMO EN LAS OTRAS DOS ────────────
         *
         * Sin este envoltorio, los hijos directos del scroller eran la cabecera, la barra de
         * pestañas y cada bloque de agente sueltos — y el `gap: 24px` que la estética le pone a
         * `.view-scroll` se aplicaba entre TODOS ellos, sumándose a los márgenes que esos bloques
         * ya traen. Con el envoltorio, ese gap separa la cabecera del cuerpo una sola vez, que es
         * para lo que está, y adentro manda el `gap: 18px` de `.cl-page`.
         *
         * De paso hereda la animación de entrada que las otras dos ya tenían. */}
        <div className="cl-page">
          <PanelDeAuditoria />
        </div>
      </div>
    </section>
  );
}
