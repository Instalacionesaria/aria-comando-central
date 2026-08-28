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
 * `glifo` sale del mismo juego que usaba el prototipo en `.md-acts`, para que la fila se vea
 * igual que antes. Lo que cambia es que ahora los valores son medidos. */
const ICONOS = [
  { clave: 'reunionesTenidas', glifo: '▢', titulo: 'Reuniones que ya tuvo', conteo: true },
  { clave: 'citaFutura', glifo: '▤', titulo: 'Tiene una cita agendada' },
  { clave: 'llamadasContestadas', glifo: '✆', titulo: 'Llamadas del agente contestadas', conteo: true },
  { clave: 'estadoAgente', glifo: '◈', titulo: 'Estado del agente', agente: true },
  { clave: 'seguimientoAbierto', glifo: '◷', titulo: 'Tiene un seguimiento corriendo' },
  { clave: 'montoVenta', glifo: '$', titulo: 'Venta registrada' },
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
 * diferencia entre los cinco: el glifo es el mismo. */
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

/** El microtexto de actividad: un evento REAL, nunca una frase genérica (§ 7.1). */
function microtexto(fila) {
  if (!fila.ultimoEntranteEl) return null;
  const cuando = hace(fila.ultimoEntranteEl);
  /* El texto de lo que escribió viaja junto a la fecha a propósito: el disparador de la base
     los mueve juntos, así que no puede pasar que la fecha sea de un mensaje y el texto de
     otro. */
  /* Y UN MENSAJE SIN TEXTO NO SE CALLA: se marca.

     Antes esta rama devolvía solo «respondió hace 1 h» y la fila quedaba sin cita, indistinguible
     de una en la que nadie escribió nada. Se vio en el navegador con un contacto cuyo último
     entrante era un audio.

     Es la misma regla que el chat ya aplica burbuja por burbuja —un audio o una imagen existieron,
     y descartarlos hace que para el auditor ese turno no haya ocurrido—, aplicada acá también para
     que las dos pantallas no cuenten historias distintas del mismo mensaje. */
  const texto = fila.ultimoEntranteTexto ?? '[mensaje sin texto]';
  return `respondió ${cuando}: “${texto}”`;
}

/** «hace 2 h». Del lado del cliente porque depende del reloj de quien mira. */
import { haceCuanto } from '../../lib/negocio/tiempo.ts';

/* `hace()` vivía acá y en `Ficha.jsx`, con DOS comportamientos distintos para un instante futuro.
   Ahora hay uno: `haceCuanto` en `lib/negocio/tiempo.ts`, que es el archivo que existe por esta
   clase de duplicación —su encabezado cuenta la vez anterior—. Se reexporta con el nombre local
   para no tocar los seis usos de abajo. */
const hace = haceCuanto;

/** Los seis íconos de una fila. */
export function SeisIconos({ iconos }) {
  return (
    <div className="md-acts">
      {ICONOS.map((ic) => {
        const v = iconos?.[ic.clave];

        /* El agente no es un contador ni un sí/no: son cinco estados, y cada uno tiene su
           color y su texto. `sin_agente` se dibuja como el resto de los ceros medidos —
           atenuado, sin número— porque eso es lo que es: se miraron las etiquetas y no hay
           ninguna del agente. */
        if (ic.agente) {
          const hay = v && v !== 'sin_agente';
          return (
            <i
              key={ic.clave}
              title={TITULO_DEL_AGENTE[v] ?? ic.titulo}
              style={{ opacity: hay ? 1 : 0.45, color: COLOR_DEL_AGENTE[v] ?? undefined }}
            >
              {ic.glifo}
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
            /* Y el `title` LO DICE, porque una opacidad no se lee. Un ícono al 28 % y otro al 45 %
               son dos hechos distintos —«no hay datos» y «es cero»— y a simple vista se ven casi
               igual: sin esta línea, la distinción que el servidor calcula no le llega a nadie. */
            title={sinMedir ? `${ic.titulo} — sin datos` : ic.titulo}
            style={{
              opacity: sinMedir ? 0.28 : activo ? 1 : 0.45,
              color: activo ? 'var(--txt)' : undefined,
            }}
          >
            {ic.glifo}
            {/* El número solo cuando hay más de uno. Un "+1" al lado de un ícono que ya dice
                "tiene una" es ruido, y un "0" es una afirmación falsa. */}
            {ic.conteo && activo && v > 1 ? <span style={{ fontSize: '10px' }}> +{v}</span> : null}
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
  const sit = fila.pildora ?? null;
  const micro = microtexto(fila);
  const completada = fila.situacion === 'venta' || fila.situacion === 'no_interesa';

  /* «Estancado» va en el COLOR de la fila y en el microtexto, NUNCA en la píldora. El § 7.1 es
     explícito: la píldora dice la situación REAL, no una condición temporal. Mezclarlas haría
     que «estancado» tapara «venta» o «seguimiento», que es el hecho que importa. */
  /* ── EL CONGELADO SE VE, Y ESO ES LA MITAD DE LA REGLA ─────────────────────
   *
   * Un congelado es el que no está en ningún territorio: perdió su etiqueta de zona. Se atenúa y se
   * marca, y **conserva todos sus datos** —sus seis íconos, su fuente, su píldora—, por lo mismo que
   * una fila completada: resumirla ahorra píxeles y pierde justo lo que permite decidir si hay que
   * volver sobre ese contacto.
   *
   * Antes no se veía: desaparecía de la aplicación sin rastro, y el closer veía bajar su cartera sin
   * ninguna explicación disponible. */
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
        <div className="md-nm">
          {fila.nombre}
          {/* El chip de fuente. NUNCA falta: la base tiene un valor de reserva, así que no hay
              camino por el que llegue vacío. */}
          <span className="tagx nu">{fila.fuente}</span>
          {sit ? <span className={`tagx ${sit.clase}`}>{sit.texto}</span> : null}
          {/* Y la marca de fuera de zona, con su explicación en el `title`. Va como chip y no como
              tinte de fila porque el tinte ya lo usa «estancado», y las dos condiciones pueden
              coincidir: un contacto puede estar estancado Y haber perdido su zona. */}
          {fila.congelado ? (
            <span
              className="tagx no"
              title="Perdió su etiqueta de zona en el CRM, así que ya no es trabajo de esta pestaña. Se sigue viendo, y vuelve solo si la etiqueta reaparece."
            >
              fuera de zona
            </span>
          ) : null}
        </div>
        {micro || fila.estancado ? (
          <div className="md-sub">
            {fila.estancado ? <span style={{ color: 'var(--warn)' }}>estancado</span> : null}
            {fila.estancado && micro ? ' · ' : null}
            {micro}
          </div>
        ) : null}
      </div>
      <SeisIconos iconos={fila.iconos} />
    </div>
  );
}
