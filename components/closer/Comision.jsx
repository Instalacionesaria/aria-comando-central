'use client';

/* El anillo de comisión del cockpit, y el botón que despliega la meta.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * OCHO ESTADOS, Y NINGUNO AFIRMA UN CERO QUE NADIE MIDIÓ
 *
 * Es la esquina de la aplicación donde es más fácil mentir, porque una comisión tiene dos mitades
 * —un porcentaje y una base— y **cualquiera de las dos puede faltar por separado**. Un `?? 0` en un
 * solo lugar convierte «nadie lo configuró» en «no cobrás comisión», y las dos frases se ven igual
 * en la pantalla: un `$0`.
 *
 *   1 · sin porcentaje        → `—`  ·  «nadie cargó tu porcentaje». Lo fija quien administra.
 *   2 · porcentaje en 0       → `$0` ·  un cero MEDIDO: alguien decidió que es cero.
 *   3 · sin resultados tuyos  → `—`  ·  la base no está medida.
 *   4 · con resultados, sin ventas → `$0` · otro cero medido, y distinto del anterior.
 *   5 · sin meta              → el monto, sin arco, con el botón para fijarla.
 *   6 · con meta, sin alcanzar → el monto y el arco.
 *   7 · meta superada         → el monto REAL, el arco topado al 100 %.
 *   8 · mirando otra empresa  → `—`, y **sin ningún llamado a la acción**: mandarlo a configurar
 *       algo imposible es mentirle.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS DOS OPCIONES SON VENTANAS, Y ESTO REVIERTE UNA DECISIÓN ESCRITA ACÁ
 *
 * El comentario del botón decía, hasta este cambio: *"en línea y no un modal: el cockpit es lo que la
 * persona está mirando, y taparlo para cargar un número lo obliga a cerrar para comprobar el
 * efecto"*. **Se pidió al revés y se hace al revés**, así que la decisión vieja no queda escrita como
 * si siguiera en pie.
 *
 * Y el argumento de entonces no era malo: sigue siendo cierto que hay que cerrar para ver el efecto.
 * Lo que lo desequilibró es que ahora son DOS opciones y no una —la meta propia y los porcentajes
 * del equipo—, y dos formularios que se despliegan en línea dentro de la columna del anillo la
 * empujan hacia abajo y descuadran el hero. Con ventanas, el anillo no se mueve y cada formulario
 * tiene su propio espacio.
 *
 * Lo que se conserva del argumento viejo: al guardar, la ventana **se cierra sola** y el número
 * queda a la vista. Nadie tiene que cerrar nada para comprobar.
 *
 * ── EL SEGUNDO BOTÓN NO LO VE TODO EL MUNDO ────────────────────────────────
 *
 * «Porcentajes del equipo» sólo se dibuja cuando el SERVIDOR dice que esta persona puede editarlos,
 * con la condición exacta del endpoint. Un closer no lo ve — y no es una cortesía: el `GET` de esa
 * ruta pide `credenciales.ver`, así que si se dibujara para todos, sería un botón que devuelve 403.
 *
 * ── Y EL RÓTULO ────────────────────────────────────────────────────────────
 *
 * Dice **«sobre las ventas que registraste»**, no «cobrado» ni «ganado». Las dos razones están
 * medidas: el formulario ofrece cuatro formas de pago y la tabla guarda un solo monto sin columna de
 * cuota ni de fecha de cobro —así que para tres de las cuatro ese número es el valor del acuerdo, no
 * la plata— y la atribución es «quien apretó Avanzar», porque no hay otra: la asignación de
 * responsable viene nula del CRM. El rótulo es la única defensa honesta mientras eso sea así.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Ventana from '../Ventana.jsx';
/* Ya no se importa `PorcentajesDelEquipo`: ese panel listaba a TODA la empresa con un campo de
   porcentaje cada una, y con un único closer designado esa lista invita a cargarle un porcentaje a
   alguien que no aparece en ninguna pantalla. Lo reemplaza `QuienEsElCloser.jsx`, que vive en
   `Inicio.jsx` y decide las dos cosas juntas: quién es el closer, y cuánto cobra. */

/** Un monto. `null` → `—`. Nunca `$0` sin dato medido. */
function plata(v) {
  if (v === null || v === undefined) return '—';
  return `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/* El arco. Cero `conic-gradient` y cero `stroke-dasharray` en el CSS del proyecto —`.ring` es un aro
   estático— así que el progreso se dibuja con un SVG dentro del aro que ya existe.

   `Math.min(1, …)` topa el arco al 100 % y **el número del centro no se topa**: quien superó la meta
   tiene que ver cuánto de verdad, y un arco que sigue creciendo más allá del círculo no se puede
   dibujar. Son dos decisiones distintas y las dos son a propósito. */
function Arco({ fraccion }) {
  const r = 66;
  const largo = 2 * Math.PI * r;
  const avance = Math.max(0, Math.min(1, fraccion)) * largo;
  return (
    <svg
      width="150"
      height="150"
      viewBox="0 0 150 150"
      aria-hidden="true"
      style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
    >
      {/* El carril del arco. Iba con el color escrito a mano —`rgba(148,197,255,.08)`— y eso es un
          celeste al 8 %: sobre el blanco del tema claro **no se ve**, así que el anillo perdía su
          carril y el arco quedaba flotando. El token lo sigue en los dos temas. */}
      <circle cx="75" cy="75" r={r} fill="none" stroke="var(--carril-del-arco)" strokeWidth="6" />
      <circle
        cx="75"
        cy="75"
        r={r}
        fill="none"
        stroke="var(--exec)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${avance} ${largo}`}
      />
    </svg>
  );
}

export default function Comision({
  comision,
  mirandoOtraOrganizacion,
  /** Lo responde el servidor con la condición exacta del endpoint. Ver el encabezado. */
  /* `soyElCloser` —y no `puedeConfigurarPorcentajes`— es lo que habilita la META.
     Son dos permisos distintos y antes estaban colapsados en uno. La meta es de la persona: dice
     cuánto QUIERE cobrar este mes. Un administrador fija el porcentaje, que es una condición de
     trabajo, pero ponerle a otro su meta personal no tiene sentido — y con el cockpit mostrando
     siempre al designado, un administrador que abriera esta pantalla habría podido escribirla. */
  soyElCloser,
  alGuardar,
  /** Recargar el cockpit entero. Se usa al cerrar la ventana de los porcentajes: si alguien cambió
   *  el suyo, su anillo tiene que reflejarlo. */
  alRecargar,
}) {
  /* El borrador y el «abierto» viven ACÁ y sobreviven a las recargas.
     `CloserView` se refresca cada 10 s, y ese archivo documenta un defecto medido de esta familia:
     poner 'cargando' en una recarga desmontaba el componente y se llevaba puesta la ficha abierta.
     Mientras el estado viva en este componente y la recarga no reemplace el árbol, lo que alguien
     está tipeando no se pierde. */
  const [abierto, setAbierto] = useState(false);
  /** La ventana de los porcentajes del equipo. Aparte de la de la meta: son dos cosas distintas. */
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // ── ESTADO 8 · mirando otra empresa ──────────────────────────────────────
  if (mirandoOtraOrganizacion) {
    return (
      <div className="ck-ring">
        <div className="ring">
          <div>
            <b>—</b>
            <span>OTRA EMPRESA</span>
          </div>
        </div>
        {/* Sin botón y sin consejo: su comisión no vive acá, y no hay nada que pueda hacer desde
            esta pantalla. */}
        <div className="ck-cta">
          Estás mirando otra empresa. Tu comisión es de la tuya: acá no hay ninguna comisión tuya.
        </div>
      </div>
    );
  }

  /* ── SIN COMISIÓN QUE MOSTRAR, Y AHORA ESO SIGNIFICA ALGO CONCRETO ────────
   *
   * Este corte ya existía y devolvía «— / SIN DATO», a secas. Alcanzaba cuando `comision` solo podía
   * faltar por una falla de lectura: no había nada útil que decir.
   *
   * Ahora tiene una causa nombrable y frecuente: `/api/closer/mi-dia` devuelve `comision: null`
   * cuando **nadie está designado closer**, que es el estado de toda organización hasta que alguien
   * lo elija. «SIN DATO» ahí es cierto y no sirve — no dice qué falta ni quién lo resuelve, que es la
   * regla de todos los vacíos de este cockpit.
   *
   * Lo que NO se hace es dibujar un cero. Un `$0` afirmaría que esa persona no cobró nada; lo que
   * pasa es que no hay de quién hablar. */
  if (!comision) {
    return (
      <div className="ck-ring">
        <div className="ring">
          <div>
            <b>—</b>
            <span>SIN CLOSER</span>
          </div>
        </div>
        <p className="ck-nota">
          Todavía no hay un closer asignado. Lo elige quien administra la empresa, acá mismo en esta
          pantalla, y a partir de ahí los números son suyos.
        </p>
      </div>
    );
  }

  const k = comision;
  const guardar = async (valor) => {
    setGuardando(true);
    setAviso(null);
    const r = await pedir('/api/closer/meta', { metodo: 'PATCH', cuerpo: { meta: valor } });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setAviso({
        mal: true,
        texto:
          r.tipo === 'rechazado'
            ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
            : 'No se pudo contactar al servidor.',
      });
      return;
    }
    // Lo que se muestra sale de la RESPUESTA, no de lo que se mandó: decir «guardado» sin leer lo
    // que quedó es reportar un éxito sin verificarlo.
    setAbierto(false);
    setBorrador('');
    alGuardar?.(r.datos.comision);
  };

  /* La fracción del arco. Solo existe con las DOS mitades: sin meta no hay arco, y sin comisión
     tampoco — un arco al 0 % sobre una base que nadie midió afirma un progreso medido. */
  const hayArco = k.valor !== null && k.meta !== null && k.meta > 0;
  const fraccion = hayArco ? k.valor / k.meta : 0;

  return (
    <div className="ck-ring">
      <div className="ring" style={{ position: 'relative' }}>
        {hayArco ? <Arco fraccion={fraccion} /> : null}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          {/* El monto REAL, sin topar. Ver el comentario del arco. */}
          <b style={k.valor === null ? undefined : { color: 'var(--exec)' }}>{plata(k.valor)}</b>
          <span>
            {k.valor === null
              ? 'SIN COMISIÓN'
              : k.porcentaje === 0
                ? '0 % DE COMISIÓN'
                : `${k.porcentaje} % DE COMISIÓN`}
          </span>
        </div>
      </div>

      {/* ── EL TEXTO, UNO POR ESTADO ── */}
      <div className="ck-cta">
        {k.valor === null ? (
          /* Estados 1 y 3: el motivo viene del servidor y son DOS motivos distintos. El de «sin
             porcentaje» no dice «cargá el tuyo», porque no lo carga la persona. */
          <span>{k.falta}</span>
        ) : k.meta === null ? (
          /* Estado 5 · sin meta. Acá sí hay algo que la persona puede hacer. */
          <span>
            Comisión estimada sobre las ventas que registraste este mes.{' '}
            <b>Sin meta del mes.</b>
          </span>
        ) : k.metaSuperada ? (
          /* Estado 7 · meta superada. Las tres condiciones las decide el servidor, no esta línea. */
          <span>
            Comisión estimada sobre las ventas que registraste este mes.{' '}
            <b>Meta superada por {plata(Math.abs(k.faltaParaLaMeta))}.</b>
          </span>
        ) : (
          /* Estado 6 · con meta, sin alcanzar. La estimación de cuántas ventas faltan **no se
             dibuja sin promedio**: sin ventas no hay promedio, y `falta / 0` es infinito. */
          <span>
            Comisión estimada sobre las ventas que registraste este mes. Faltan{' '}
            <b>{plata(k.faltaParaLaMeta)}</b>
            {k.ventas !== null && k.ventas > 0 && k.valor > 0
              ? ` — unas ${Math.ceil(k.faltaParaLaMeta / (k.valor / k.ventas))} venta(s) más.`
              : '.'}
          </span>
        )}
      </div>

      {/* ── EL BOTÓN DE LA META, Y AHORA SOLO PARA SU DUEÑA ──────────────────
          Sí aparece cuando falta el porcentaje: la meta es suya y la puede fijar igual, aunque el
          número todavía no se pueda calcular. Esconderlo ahí haría que la única acción disponible
          dependa de algo que otra persona tiene que hacer primero.

          Y NO aparece para quien no es el closer designado, que es lo que cambió. Este anillo ahora
          muestra siempre a esa persona —el cockpit tiene un sujeto— así que sin esta condición un
          administrador que abriera la pantalla vería «Fijar mi meta» y estaría fijando la de otro.
          El «mi» del rótulo era verdad cuando el anillo era de quien miraba; ya no lo es.

          Lo decide el SERVIDOR (`soyElCloser`), comparando identificadores del lado donde están: la
          pantalla no recibe el identificador del designado para compararlo, justamente para que no
          haya dos lugares que respondan la misma pregunta. */}
      {soyElCloser ? (
        <div className="ck-acciones">
          <button
            type="button"
            className="fd-btn sec"
            onClick={() => {
              setBorrador(k.meta === null ? '' : String(k.meta));
              setAviso(null);
              setAbierto(true);
            }}
          >
            {k.meta === null ? 'Fijar mi meta' : 'Cambiar mi meta'}
          </button>
        </div>
      ) : null}

      {/* ── LA VENTANA DE LA META ───────────────────────────────────────────
          Al guardar se cierra sola, así que el número nuevo queda a la vista sin que nadie tenga que
          cerrar nada — es lo que se conserva del argumento contra el modal, escrito en el
          encabezado. */}
      {abierto ? (
        <Ventana
          titulo="Mi meta de comisión del mes"
          subtitulo="Es tu meta de comisión, no de ventas."
          alCerrar={() => setAbierto(false)}
        >
          <div className="fd-campo">
            <label htmlFor="ck-meta">Cuánto quiero cobrar de comisión este mes</label>
            <input
              id="ck-meta"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="por ejemplo 3000"
            />
            {/* Se dice QUÉ es y qué NO es. Sin esto, alguien carga acá el objetivo de ventas de la
                empresa y el anillo queda midiendo otra cosa. */}
            <div className="aj-ayuda ck-nota">
              Es tu meta de <b>comisión</b>, no de ventas. Cero no se acepta: una meta de cero no
              significa nada.
            </div>
          </div>

          {aviso ? (
            <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="alert">
              <i>{aviso.mal ? '⚠' : '✓'}</i>
              <span>{aviso.texto}</span>
            </div>
          ) : null}

          <div className="aj-fila">
            <button
              type="button"
              className="fd-btn"
              disabled={guardando || Number(borrador) <= 0 || borrador.trim() === ''}
              onClick={() => void guardar(Number(borrador))}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {/* Quitar la meta es una operación de verdad y tiene su botón. Sin él, el único camino
                para volver a «sin meta» sería cargar un 1 — y eso dibujaría una meta superada. */}
            {k.meta !== null ? (
              <button
                type="button"
                className="fd-btn sec"
                disabled={guardando}
                onClick={() => void guardar(null)}
              >
                Quitar la meta
              </button>
            ) : null}
            <button
              type="button"
              className="fd-btn sec"
              disabled={guardando}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </button>
          </div>
        </Ventana>
      ) : null}

    </div>
  );
}
