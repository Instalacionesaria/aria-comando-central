'use client';

/* Avanzar: el único lugar donde se registra cómo terminó una conversación.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DOS PASOS, Y EL SEGUNDO ES LA MITAD QUE SE OLVIDA
 *
 * **Paso 1 · ¿cómo terminó?** Las seis tarjetas. Un clic y listo — es el 90 % de los usos y tiene
 * que costar un clic.
 *
 * **Paso 2 · el detalle.** La subcategoría, el monto si corresponde, la nota, y cuándo volver.
 * Existe porque sin él la píldora diría `VENTA` y nada más: sin forma de pago, sin monto, y los
 * números de Inicio sumarían una venta de cero pesos.
 *
 * Los dos pasos son el MISMO modal y no dos ventanas: cerrar y volver a abrir entre uno y otro
 * pierde lo que se eligió, y el `02` § 1 es explícito en que registrar no puede hacer perder el
 * contexto.
 *
 * ── SE REUSA `Ventana.jsx`, Y ES DELIBERADO ─────────────────────────────────
 *
 * Las cuatro propiedades que hacen que un modal no esté roto —foco que entra y vuelve, trampa del
 * tabulador, Escape, y «montado = visible» sin depender de una animación— ya viven ahí con sus
 * motivos escritos y su prueba. `Ficha.jsx` las copió porque es un panel lateral con tres zonas;
 * esto **sí es** un modal centrado, así que no hay nada que copiar.
 *
 * Lo que sí se toma del prototipo son las clases de las tarjetas —`.res-g`, `.res-o`, `.ic`— para
 * que el aspecto sea el que ya estaba diseñado.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { SALIDAS, modosDe } from '../../lib/negocio/salidas.ts';
import Ventana from '../Ventana.jsx';

/** El día de hoy en `YYYY-MM-DD`, para el mínimo del campo de fecha. */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Avanzar({ contactoId, nombre, alCerrar, alRegistrar }) {
  /** La salida elegida. `null` = paso 1. */
  const [elegida, setElegida] = useState(null);
  const [detalle, setDetalle] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [volverEl, setVolverEl] = useState('');
  /** El modo, para las salidas que los tienen. `''` = todavía no eligió, y el botón lo exige. */
  const [modo, setModo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const def = useMemo(() => SALIDAS.find((s) => s.salida === elegida) ?? null, [elegida]);
  /** Los modos que admite. Vacío en cinco de las seis salidas. */
  const modos = useMemo(() => (elegida !== null ? modosDe(elegida) : []), [elegida]);
  const elModo = useMemo(() => modos.find((m) => m.modo === modo) ?? null, [modos, modo]);

  /* ── LA FECHA APARECE SEGÚN EL MODO, Y ES LA MITAD VISIBLE DE LA REGLA ─────
   *
   * Con `manual` hace falta —es el día en que el contacto aparece en Mi Día— y con `automatico`
   * estorba: la persecución la hace la secuencia del CRM con su propio calendario, así que un día
   * nuestro no lo usaría nadie. El servidor rechaza esa combinación; esto es para que no haya que
   * descubrirlo con un rechazo.
   *
   * Y para las cinco salidas sin modos la fecha sigue estando: un recordatorio después de un no-show
   * es útil, y ahí nadie del CRM persigue a nadie. */
  const pideFecha = modos.length === 0 || elModo?.exigeFecha === true;

  /* El monto es obligatorio cuando la salida lo pide, y el botón lo respeta. NO es la defensa: el
     servidor valida lo mismo, porque cualquiera puede llamar al endpoint con una herramienta de
     línea de comandos. Esto es para que no haya que descubrirlo con un rechazo. */
  const puedeRegistrar =
    def !== null &&
    !enviando &&
    (!def.pideMonto || (monto.trim() !== '' && Number(monto) >= 0)) &&
    // Un modo sin elegir no tiene valor por omisión posible: los dos hacen cosas disjuntas.
    (modos.length === 0 || elModo !== null) &&
    // Y `manual` sin fecha no tiene día que poner en Mi Día.
    (!pideFecha || modos.length === 0 || volverEl !== '');

  const registrar = useCallback(async () => {
    if (!def) return;
    setEnviando(true);
    setAviso(null);

    const r = await pedir(`/api/contactos/${contactoId}/avanzar`, {
      metodo: 'POST',
      cuerpo: {
        salida: def.salida,
        ...(detalle !== '' ? { detalle } : {}),
        ...(def.pideMonto ? { monto: monto.trim() } : {}),
        ...(nota.trim() !== '' ? { nota: nota.trim() } : {}),
        ...(modos.length > 0 ? { modo } : {}),
        /* La fecha se manda SOLO si el modo la usa. Mandándola con `automatico` el servidor
           rechaza —y tiene razón—, y eso pasaría si alguien elige un día, cambia a automático y
           registra: el campo está oculto pero su estado sigue teniendo el valor viejo. */
        ...(pideFecha && volverEl !== '' ? { volverEl } : {}),
      },
    });
    setEnviando(false);

    if (r.tipo !== 'datos') {
      setAviso({
        mal: true,
        texto:
          r.tipo === 'rechazado'
            ? (r.detalle ?? `No se pudo registrar (${r.estado}).`)
            : 'No se pudo contactar al servidor. No se registró nada.',
      });
      return;
    }

    /* ── LO QUE PASÓ CON EL CRM SE DICE, NO SE ESCONDE ──────────────────────
     *
     * El resultado quedó registrado —los números y la columna ya se movieron— pero mientras el
     * aviso no llegue **el CRM no disparó sus automatismos**: la secuencia de recuperación de un
     * no-show, por ejemplo. Colapsarlo en «listo» sería reportar un éxito a medias como completo.
     */
    alRegistrar?.({
      salida: def.salida,
      etapa: r.datos.etapa,
      crm: r.datos.crm,
      nota: r.datos.nota,
      tarea: r.datos.tarea,
      modo,
    });
    alCerrar?.();
  }, [def, contactoId, detalle, monto, nota, volverEl, alRegistrar, alCerrar]);

  // ─── Paso 1 · las seis tarjetas ───────────────────────────────────────────

  if (def === null) {
    return (
      <Ventana
        titulo="¿Cómo terminó?"
        subtitulo={
          nombre
            ? `Resultado de ${nombre}. Sirve igual tras una llamada o tras el chat.`
            : 'Sirve igual tras una llamada o tras el chat.'
        }
        alCerrar={alCerrar}
      >
        <div className="res-g">
          {SALIDAS.map((s) => (
            <button
              key={s.salida}
              type="button"
              className={`res-o ${s.clase}`}
              onClick={() => {
                setElegida(s.salida);
                setDetalle('');
                setAviso(null);
              }}
            >
              <span className={`ic ${s.clase}`}>{s.icono}</span>
              <span>
                <b>{s.nombre}</b>
                <span>{s.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      </Ventana>
    );
  }

  // ─── Paso 2 · el detalle ──────────────────────────────────────────────────

  return (
    <Ventana
      titulo={def.nombre}
      subtitulo={def.detalle}
      alCerrar={alCerrar}
    >
      {/* VOLVER, y no cerrar. Elegir mal la tarjeta es el error más probable de los dos pasos, y
          la salida no puede ser perder el modal y volver a abrirlo. */}
      <button
        type="button"
        className="fd-btn sec"
        style={{ marginBottom: 14 }}
        onClick={() => {
          setElegida(null);
          setAviso(null);
        }}
      >
        ← Elegir otro resultado
      </button>

      {def.pideMonto ? (
        <div className="fd-campo">
          <label htmlFor="av-monto">Monto</label>
          <input
            id="av-monto"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={monto}
            placeholder="0.00"
            onChange={(e) => setMonto(e.target.value)}
          />
          {/* Se dice POR QUÉ es obligatorio. Un campo requerido sin motivo se lee como un trámite;
              con el motivo se entiende que el número va a algún lado. */}
          <div className="aj-ayuda">
            De acá sale el «cobrado» de Inicio. Sin monto, esta venta sumaría cero.
          </div>
        </div>
      ) : null}

      {def.etiquetaDelCampo ? (
        <div className="fd-campo">
          <label htmlFor="av-detalle">{def.etiquetaDelCampo}</label>
          <select id="av-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)}>
            {/* Vacío SÍ es una opción legítima acá, al contrario del rol de una persona: la
                subcategoría afina la píldora y no habilita nada. Obligarla haría inventar una. */}
            <option value="">Sin especificar</option>
            {def.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="fd-campo">
        <label htmlFor="av-nota">Nota</label>
        <textarea
          id="av-nota"
          rows={3}
          value={nota}
          placeholder="Qué se dijo, en una línea."
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="aj-ayuda">
          Va al historial del contacto, en la pestaña Notas. Opcional.
        </div>
      </div>

      {/* ── EL MODO, Y SOLO PARA LA SALIDA QUE LO TIENE ─────────────────────
          Se dibuja desde el catálogo, no desde una lista escrita acá: es la misma tabla que valida
          el servidor, así que esta pantalla no puede ofrecer un modo que dé 400.

          Son botones y no un desplegable a propósito: las dos opciones hacen cosas disjuntas y cada
          una necesita su renglon de explicación. Un `select` esconde el detalle justo cuando hay que
          leerlo, y la diferencia —quién persigue a esta persona— no es obvia por el nombre. */}
      {modos.length > 0 ? (
        <div className="fd-campo">
          <label>¿Quién lo persigue?</label>
          <div className="av-modos">
            {modos.map((m) => (
              <button
                key={m.modo}
                type="button"
                className={`av-modo${modo === m.modo ? ' on' : ''}`}
                aria-pressed={modo === m.modo}
                onClick={() => setModo(m.modo)}
              >
                <b>{m.nombre}</b>
                <span>{m.detalle}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {pideFecha ? (
      <div className="fd-campo">
        <label htmlFor="av-volver">Volver el</label>
        <input
          id="av-volver"
          type="date"
          value={volverEl}
          min={hoy()}
          onChange={(e) => setVolverEl(e.target.value)}
        />
        <div className="aj-ayuda">
          {modos.length > 0
            ? 'El día que este contacto te aparece en Mi Día.'
            : 'Crea una tarea para ese día en Mi Día. Opcional — dejalo vacío si no hay que volver.'}
        </div>
      </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      <div className="aj-fila">
        <button type="button" className="fd-btn" disabled={!puedeRegistrar} onClick={() => void registrar()}>
          {enviando ? 'Registrando…' : `Registrar ${def.nombre.toLowerCase()}`}
        </button>
        <button type="button" className="fd-btn sec" disabled={enviando} onClick={() => alCerrar?.()}>
          Cancelar
        </button>
      </div>
    </Ventana>
  );
}
