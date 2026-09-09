'use client';

/* La fila de un contacto y sus seis íconos. UN SOLO archivo para las dos pestañas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTÁ ACÁ Y NO DENTRO DE CADA VISTA
 *
 * El `11` § 7 abre con esto: *"estos componentes se construyen una sola vez. Si se construyen
 * por pantalla, divergen"*. Y el § 9 regla 3 lo dice como regla: *"si dos pantallas muestran el
 * mismo número, comparten la función que lo calcula"*.
 *
 * El servidor ya cumple su mitad —`lib/negocio/fila.ts` es una sola consulta para los dos
 * territorios— y ésta es la del cliente. Sin ella, el closer y el setter dibujarían el mismo
 * contacto con dos gramáticas: uno mostraría un "0" donde el otro atenúa, y los dos se verían
 * plausibles.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA, Y POR QUÉ ERA GRAVE
 *
 * Hasta la Etapa 11 estas filas las dibujaba `lib/aios/closer.js` con datos ESCRITOS A MANO:
 * seis citas con nombres de personas inventados, un diagnóstico atribuido a la IA que nadie
 * generó, siete mensajes de buzón entre comillas, cinco meses de facturación
 * ($9.800 / $14.200 / $11.600 / $24.800) y un encabezado que decía "Closer · Jorge Veramendi".
 *
 * Dos detalles que muestran hasta dónde llegaba: el encabezado del buzón decía **25** con
 * **7** filas debajo —el conteo y la lista eran dos inventos distintos que no coincidían— y
 * una aclaración afirmaba *"julio es real · abril a junio son referencia"*, o sea que decía de
 * dónde venían datos que no venían de ninguna parte.
 *
 * Nada de eso fallaba. Estuvo en producción mostrando nombres de clientes y dinero que no
 * existen, que es peor que una pantalla vacía: una pantalla vacía se reporta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* Los seis íconos, en el orden del `11` § 7.2. **Siempre los seis, nunca un "0".**
 *
 * ── DEJARON DE SER GLIFOS, Y ESO ERA EL PROBLEMA ───────────────────────────
 *
 * Acá había un `glifo` por ícono —`▢ ▤ ✆ ◈ ◷ $`—, heredado del juego que usaba el prototipo en
 * `.md-acts`. Eran caracteres de texto, no dibujos: cada tipografía resuelve `✆` y `◷` a su manera,
 * el `$` es una letra con la altura de una letra, y ninguno se alinea con los otros. Se veían
 * pobres y desparejos, y se pidió el dibujo de verdad.
 *
 * Ahora es un `icono` que apunta al sprite (`components/IconSprite.jsx`), con el mismo mecanismo
 * que el menú lateral: `<use href="#i-f-…">` sobre un `<symbol>` que dibuja con `currentColor`. De
 * ahí sale gratis lo otro que se pidió —que el encendido resalte en el acento— porque el color lo
 * pone el CSS y no hace falta un color por ícono. */
const ICONOS = [
  { clave: 'reunionesTenidas', icono: '#i-f-reunion', titulo: 'Reuniones que ya tuvo', conteo: true },
  { clave: 'citaFutura', icono: '#i-f-cita', titulo: 'Tiene una cita agendada' },
  { clave: 'llamadasContestadas', icono: '#i-f-llamada', titulo: 'Llamadas del agente contestadas', conteo: true },
  { clave: 'estadoAgente', icono: '#i-f-agente', titulo: 'Estado del agente', agente: true },
  { clave: 'seguimientoAbierto', icono: '#i-f-seguimiento', titulo: 'Tiene un seguimiento corriendo' },
  { clave: 'montoVenta', icono: '#i-f-venta', titulo: 'Venta registrada' },
];

/* El color del ícono del agente, por estado.
 *
 * Cinco estados con tres colores, no uno. «Atendiendo» es cian —el bot trabaja— y «pausado por
 * fallo» es coral, porque significa que el auditor encontró algo. Entre medio quedan los dos
 * apagados normales: no hay nada mal, pero tampoco hay un bot trabajando.
 *
 * Sin esta distinción, «el bot está atendiendo» y «el bot falló y lo pausamos» se verían igual
 * — y son justo los dos casos que llevan a acciones opuestas. */
const COLOR_DEL_AGENTE = {
  atendiendo_pre_agenda: 'var(--accent)',
  atendiendo_post_agenda: 'var(--accent)',
  atendiendo: 'var(--accent)',
  pausado_por_fallo: 'var(--crit)',
  apagado_a_mano: 'var(--txt-dim)',
  ya_paso_la_llamada: 'var(--txt-dim)',
  sin_agente: null,
};

/* El texto del título, por estado. Es lo que se lee al pasar el puntero, y es donde vive la
 * diferencia entre los cinco: el DIBUJO es el mismo para los cinco, y lo único que los separa a
 * simple vista son los tres colores de la tabla de arriba. */
const TITULO_DEL_AGENTE = {
  atendiendo_pre_agenda: 'El agente pre-agenda está atendiendo',
  atendiendo_post_agenda: 'El agente post-agenda está atendiendo',
  atendiendo: 'El chatbot está atendiendo',
  apagado_a_mano: 'Un humano apagó el bot',
  ya_paso_la_llamada: 'Ya tuvo la llamada de cierre: el bot se apagó',
  pausado_por_fallo: 'El bot se pausó porque el auditor encontró un fallo',
  sin_agente: 'Sin agente',
};

/* EL DICCIONARIO DE SITUACIONES SE FUE, Y ESO ES EL ARREGLO.
 *
 * Acá vivía un `SITUACION` con el texto y el color de cada salida. La ficha necesita **la misma**
 * píldora —el `02` la llama «espejo obligatorio»— y con un diccionario por pantalla habría dos
 * lugares que formatean lo mismo. La implementación de referencia tenía seis, y el resultado
 * medido fue `Seguimiento · Dudando` en un lado y `SEGUIMIENTO · DUDANDO` en el otro **para el
 * mismo estado**.
 *
 * Ahora la píldora la arma el SERVIDOR y viaja dentro de `fila.pildora`, igual que los seis
 * íconos. La fila y la ficha reciben el mismo objeto, así que el espejo es cierto por construcción
 * y no por coincidencia. Ver `lib/negocio/pildora.ts`.
 */

/* ── EL MICROTEXTO SE FUE, Y CON ÉL EL RELOJ DEL CLIENTE ────────────────────
 *
 * Acá vivían `microtexto(fila)` —que armaba `respondió hace 2 d: “…”`— y el reexport de
 * `haceCuanto` que le daba el «hace 2 d». Se pidió que la fila no muestre lo último que dijo el
 * contacto, así que la función quedó sin llamador y se fue entera: una función que nadie usa es la
 * que vuelve mal cuando alguien la encuentra y la cree vigente.
 *
 * Se conserva por escrito lo que esa función había aprendido, porque el dato sigue existiendo y
 * alguien lo va a querer dibujar en otra parte: **un mensaje sin texto no se calla, se marca.** Esa
 * rama devolvía solo «respondió hace 1 h» y la fila quedaba indistinguible de una en la que nadie
 * escribió nada; se vio en el navegador con un contacto cuyo último entrante era un audio, y se
 * arregló con un `[mensaje sin texto]` explícito. Es la misma regla que el chat aplica burbuja por
 * burbuja.
 *
 * `haceCuanto` sigue en `lib/negocio/tiempo.ts` y la ficha lo usa; lo que se fue de acá es el
 * reexport local, que existía solo para los usos de esta función.
 */

/**
 * Los seis íconos de una fila.
 *
 * ── LOS TRES ESTADOS PASARON DE `style` EN LÍNEA A CLASE, Y NO ES ESTILO ────
 *
 * La opacidad y el color iban en un `style={{…}}`, y eso tenía una consecuencia que se pagó en
 * otra parte: una hoja de estilos **no puede pisar un estilo en línea**, así que para que los
 * íconos usaran su gris propio en vez del color de texto del tema,
 * `app/operacion-estetica.css` tuvo que secuestrar el token que el componente leía
 * (`--txt: var(--icono)` dentro de `.md-acts`). Un token con dos significados según dónde se
 * mire, para poder ganarle a esta función.
 *
 * Con clases, el CSS decide y el secuestro se pudo retirar. El `<i>` se conserva como envoltorio
 * —ahora envuelve un `<svg>` en vez de un carácter— porque de él cuelgan las reglas que apagan el
 * cursor y el hover, y porque le da al número un lugar donde ir al lado del dibujo.
 */
export function SeisIconos({ iconos }) {
  return (
    <div className="md-acts">
      {ICONOS.map((ic) => {
        const v = iconos?.[ic.clave];

        /* El agente no es un contador ni un sí/no: son cinco estados, y cada uno tiene su
           color y su texto. `sin_agente` se dibuja como el resto de los ceros medidos —
           atenuado, sin número— porque eso es lo que es: se miraron las etiquetas y no hay
           ninguna del agente.

           Es el único que conserva un color en línea, y con motivo: son TRES colores según el
           estado —el acento cuando trabaja, coral cuando el auditor lo pausó, gris cuando está
           apagado— y una clase por estado serían cinco clases para decir lo que `COLOR_DEL_AGENTE`
           ya dice en una tabla. */
        if (ic.agente) {
          const hay = v && v !== 'sin_agente';
          return (
            <i
              key={ic.clave}
              className={hay ? 'on' : 'apagado'}
              title={TITULO_DEL_AGENTE[v] ?? ic.titulo}
              style={{ color: COLOR_DEL_AGENTE[v] ?? undefined }}
            >
              <svg viewBox="0 0 16 16">
                <use href={ic.icono} />
              </svg>
            </i>
          );
        }
        /* Las TRES situaciones, y son tres porque el § 9 regla 1 lo exige: *"un cero medido y
           un cero no medido no son el mismo hecho"*.
             · null      → no hay de dónde medirlo. Se dibuja al 30%, sin número.
             · 0 / false → se midió y es cero. Atenuado, y NUNCA con un "0" al lado.
             · con valor → encendido, con su número si es un conteo. */
        const sinMedir = v === null || v === undefined;
        const activo = !sinMedir && v !== 0 && v !== false;
        return (
          <i
            key={ic.clave}
            className={sinMedir ? 'sin-medir' : activo ? 'on' : 'apagado'}
            /* Y el `title` LO DICE, porque una opacidad no se lee. Un ícono al 28 % y otro al 50 %
               son dos hechos distintos —«no hay datos» y «es cero»— y a simple vista se ven casi
               igual: sin esta línea, la distinción que el servidor calcula no le llega a nadie. */
            title={sinMedir ? `${ic.titulo} — sin datos` : ic.titulo}
          >
            <svg viewBox="0 0 16 16">
              <use href={ic.icono} />
            </svg>
            {/* El número, al lado del dibujo y SIN el `+`.
                Decía `+2`, y se pidió que diga `2`. El `+` prometía algo que no era: no es «dos
                más», es «dos». Y con él la condición tenía que ser `v > 1`, porque `+1` se lee
                como «uno más» y era falso — así que un contacto con UNA reunión no mostraba
                ningún número y se veía igual que uno con cero medido.
                Ahora el uno se dibuja: `v > 0`. El cero sigue sin número, que es lo que la regla
                de arriba pide — un «0» es una afirmación falsa sobre algo que no ocurrió. */}
            {ic.conteo && activo && v > 0 ? <span className="md-cnt">{v}</span> : null}
          </i>
        );
      })}
    </div>
  );
}

/**
 * Una fila de contacto.
 *
 * `onAbrir` recibe la fila. Todavía no hay ficha —es el paso siguiente del § 10— así que
 * cuando no se pasa, la fila no es clicable. **No se deja un `onClick` que no haga nada**: un
 * elemento que parece clicable y no responde es la forma más rápida de que alguien deje de
 * confiar en la pantalla.
 */
export default function Fila({ fila, onAbrir }) {
  const completada = fila.situacion === 'venta' || fila.situacion === 'no_interesa';

  /* «Estancado» va en el COLOR de la fila, NUNCA en la píldora. El § 7.1 es explícito: la píldora
     dice la situación REAL, no una condición temporal. Mezclarlas haría que «estancado» tapara
     «venta» o «seguimiento», que es el hecho que importa.
     Y ahora el color es lo ÚNICO que lo dice: el microtexto que además lo escribía se fue con la
     simplificación de la fila. */
  /* ── EL CONGELADO SE VE, Y ESO ES LA MITAD DE LA REGLA ─────────────────────
   *
   * Un congelado es el que no está en ningún territorio: perdió su etiqueta de zona. Se atenúa, y
   * **conserva sus seis íconos** por lo mismo que una fila completada: resumirla ahorra píxeles y
   * pierde justo lo que permite decidir si hay que volver sobre ese contacto.
   *
   * Antes no se veía: desaparecía de la aplicación sin rastro, y el closer veía bajar su cartera sin
   * ninguna explicación disponible. El chip que lo nombraba se fue con la simplificación, así que
   * ahora la atenuación es la única señal en la lista — el motivo está en la ficha. */
  return (
    <div
      className={`md-r${completada ? ' md-done' : ''}${fila.congelado ? ' md-fuera' : ''}`}
      style={
        fila.estancado && !completada
          ? { borderLeft: '2px solid var(--warn)', paddingLeft: 10, ...(onAbrir ? { cursor: 'pointer' } : {}) }
          : onAbrir
            ? { cursor: 'pointer' }
            : undefined
      }
      onClick={onAbrir ? () => onAbrir(fila) : undefined}
    >
      {/* El score. Sin dato va `—`, no un número inventado ni un espacio en blanco: el § 7.1
          pide el guión, porque un hueco se lee como "todavía cargando". */}
      <span className="md-time">{fila.score ?? '—'}</span>
      <div>
        {/* ── SOLO EL NOMBRE ──────────────────────────────────────────────────
         *
         * Acá había, al lado del nombre, hasta tres chips y debajo una línea con lo último que
         * dijo el contacto. Se pidió que quede el nombre: *«que solo aparezca el nombre… tampoco
         * que abajo salga lo último que respondió»*.
         *
         * Lo que se fue, y dónde sigue estando cada cosa — porque ninguna se perdió:
         *
         *   · **La fuente** (`EXTERNAL_FORM`, `FACEBOOK`, y las largas como
         *     `LLAMADA DE DIAGNOSTICO · AGENCIA AI NATIVE`, que son todas el mismo campo: el
         *     `source` crudo del CRM). Ya estaba en la ficha, pestaña Perfil, grupo «Origen», con
         *     la etiqueta «Fuente». O sea que «que salga dentro del contacto» ya estaba cumplido
         *     y esto era la copia de más.
         *   · **La píldora de situación** (`SEGUIMIENTO`, `SEGUIMIENTO · PRÓXIMO A PAGAR`). Sigue
         *     en el ENCABEZADO de la ficha, que es mejor que el Perfil: se ve desde las cuatro
         *     pestañas.
         *   · **«fuera de zona»**. La fila conserva la clase `md-fuera`, que la atenúa. Se ve que
         *     algo pasa; el detalle está en la ficha.
         *   · **«estancado»**. Sigue marcado con el borde izquierdo ámbar de acá arriba, que es de
         *     donde salía el color de esa palabra.
         *
         * El dato sigue viajando en `fila.fuente` y `fila.pildora`: la ficha los usa. Lo que se
         * quitó es el dibujo, no la medición. */}
        <div className="md-nm">{fila.nombre}</div>
      </div>
      <SeisIconos iconos={fila.iconos} />
    </div>
  );
}
