'use client';

/* Los DOS porcentajes del setter, por persona. El panel de quien administra.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ESTO ES UNA LISTA POR PERSONA, Y EL CLOSER DEJÓ DE TENER UNA A PROPÓSITO
 *
 * Hubo un `PorcentajesDelEquipo.jsx` y **se eliminó**, con este motivo escrito: con un único closer
 * designado por empresa, *«cargarle un porcentaje a alguien que no es el closer produce una fila que
 * no se usa en ninguna pantalla, y que el día que esa persona sea designada aparece de golpe como si
 * se hubiera decidido hoy»*.
 *
 * Ese motivo **no se traslada al setter**, y es la razón por la que este panel sí es una lista:
 *
 *   · El closer es un **puesto designado**: `negocio.closer_asignado` tiene `org_id` como clave
 *     primaria entera, así que hay uno por empresa y su porcentaje se carga en su propia fila.
 *   · El setter es **multi-persona por construcción** — el disparador del sello existe justamente
 *     porque *«el segundo setter no le roba la atribución al primero»*. El sujeto de su Inicio es
 *     **quien mira**, así que un porcentaje cargado a cualquiera **sí se usa**: aparece en los anillos
 *     de esa persona la próxima vez que abre la pestaña.
 *
 * O sea que la fila huérfana que hundió al panel del equipo acá no existe. Si el porcentaje está
 * cargado, se ve.
 *
 * ── LO QUE SE COPIA DEL PANEL DEL CLOSER, Y ES LA MITAD IMPORTANTE ──────────
 *
 * La forma de pedir y de mostrar es la misma, y no por parecido: es donde está resuelto lo difícil.
 *
 *   · **El borrador arranca en `null`**, no copiando el valor guardado. Si arrancara copiándolo, una
 *     recarga pisaría lo que se está tipeando.
 *   · **`??` y nunca `|| ''`** al mostrar: un porcentaje de `0` es falsy y con `||` se vería vacío —
 *     que es exactamente la distinción que este panel existe para no perder.
 *   · **Se guarda `null` para dejar sin configurar**, y tiene su propio botón. Sin él, el único camino
 *     de vuelta desde «0 % a propósito» sería no tenerlo, y las dos cosas se ven igual: un campo
 *     vacío.
 *   · **Lo que se muestra sale de la RESPUESTA**, no de lo que se mandó. Decir «guardado» sin leer lo
 *     que quedó es reportar un éxito sin verificarlo.
 *
 * ── Y EL RIESGO QUE ESTE PANEL TIENE Y EL DEL CLOSER NO ─────────────────────
 *
 * El del closer excluye a quien administra: *«quien configura no puede ser el configurado»*. Acá
 * **no se puede copiar esa exclusión**, y está medido: las cuatro personas activas de producción
 * están en roles no restringidos y tres tienen la capacidad de configurar comisiones. Excluirlas
 * dejaría la lista vacía y condenaría los anillos, que es el defecto que este panel viene a arreglar.
 *
 * Así que quien administra **puede fijarse su propio porcentaje**. El rastro es la fila de
 * `auditoria_accesos` con la acción `comision_configurada`, donde el actor y el objetivo son la misma
 * persona — y esa fila la escribe el endpoint en la misma transacción que el porcentaje, así que no
 * existe el estado «se cambió y no quedó registrado quién».
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/** El motivo de un rechazo, sin colapsar las tres ramas (`ADR-0305`). */
function porQue(r) {
  if (r.tipo === 'rechazado') return r.detalle ?? `El servidor respondió ${r.estado}.`;
  return 'No se pudo contactar al servidor. No es que no haya nadie: no se pudo preguntar.';
}

export default function PorcentajesDelSetter({ alCambiar }) {
  const [personas, setPersonas] = useState([]);
  const [tramos, setTramos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  /* Los borradores, por `${usuarioId}:${tramo}`. Arrancan sin entrada —«nadie tocó ese campo»— y no
     copiando lo guardado: con dos campos por persona y una lista de varias, copiar al montar haría
     que cualquier recarga pise lo que se está tipeando en cualquiera de ellos. */
  const [borradores, setBorradores] = useState({});
  const [ocupado, setOcupado] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/setter');
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      setSituacion(r.tipo);
      return;
    }
    setPersonas(r.datos.personas ?? []);
    setTramos(r.datos.tramos ?? null);
    // Los borradores se limpian al recargar: lo que quedó guardado ya se ve en el campo.
    setBorradores({});
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (usuarioId, tramo, porcentaje) => {
      const llave = `${usuarioId}:${tramo}`;
      setOcupado(llave);
      setAviso(null);
      const r = await pedir('/api/admin/comisiones', {
        metodo: 'PUT',
        /* El TRAMO va explícito, y el endpoint lo exige. Sin valor por omisión del lado del servidor:
           un olvido acá escribiría el sueldo de CLOSER de esa persona, en una fila que esta pantalla
           no muestra — el porcentaje que se quería cargar no aparecería, y aparecería uno que nadie
           decidió. */
        cuerpo: { usuarioId, tramo, porcentaje },
      });
      setOcupado(null);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      // Se relee del servidor. Ver el encabezado: lo que se muestra sale de la respuesta.
      await cargar();
      setAviso({
        mal: false,
        texto:
          porcentaje === null
            ? 'Quedó sin configurar. Del otro lado se ve «nadie cargó tu porcentaje», no «0 %».'
            : `Quedó en ${porcentaje} %.`,
      });
      alCambiar?.();
    },
    [cargar, alCambiar],
  );

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando los porcentajes del setter…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="fd-aviso falta">
        <i>◍</i>
        <span>{causa}</span>
      </div>
    );
  }

  /** El valor del campo: el borrador si alguien lo tocó, y si no el guardado. */
  const valorDe = (persona, tramo, guardado) => {
    const b = borradores[`${persona.usuarioId}:${tramo}`];
    if (b !== undefined) return b;
    /* `??` y NUNCA `|| ''`: un porcentaje de `0` es falsy, y con `||` un cero decidido a propósito se
       vería como un campo vacío — o sea como «nadie lo cargó». Es la distinción entera. */
    return guardado === null ? '' : String(guardado);
  };

  const Campo = ({ persona, tramo, guardado, etiqueta }) => {
    const llave = `${persona.usuarioId}:${tramo}`;
    const valor = valorDe(persona, tramo, guardado);
    const vacio = valor.trim() === '';
    const numero = Number(valor);
    const valido = !vacio && Number.isFinite(numero) && numero >= 0 && numero <= 100;
    return (
      <div className="pds-campo">
        <label htmlFor={`pds-${llave}`}>{etiqueta}</label>
        <div className="pds-fila">
          <input
            id={`pds-${llave}`}
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputMode="decimal"
            value={valor}
            disabled={ocupado !== null}
            placeholder="sin configurar"
            onChange={(e) =>
              setBorradores((antes) => ({ ...antes, [llave]: e.target.value }))
            }
          />
          <span className="pds-pct">%</span>
          <button
            type="button"
            className="fd-btn"
            disabled={ocupado === llave || !valido}
            onClick={() => void guardar(persona.usuarioId, tramo, numero)}
          >
            {ocupado === llave ? 'Guardando…' : 'Guardar'}
          </button>
          {/* Dejar SIN CONFIGURAR es una operación de verdad y tiene su botón. Sin él, el único camino
              de vuelta desde «0 % a propósito» sería no tenerlo — y un campo vacío y un cero decidido
              se verían igual. */}
          {guardado !== null ? (
            <button
              type="button"
              className="fd-btn sec"
              disabled={ocupado === llave}
              onClick={() => void guardar(persona.usuarioId, tramo, null)}
            >
              Dejar sin configurar
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="aj-tarjeta ck-admin">
      <div className="fd-cab">
        <h3>Los porcentajes del setter</h3>
        <span className="fd-bajada">
          Son dos y se cobran por cosas distintas: el <b>directo</b> sobre las ventas chicas que cierra
          cada persona, y el <b>diferido</b> sobre las ventas del closer en los leads que esa persona
          originó. Cada uno se carga por separado.
        </span>
      </div>

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="alert">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      {/* POR QUÉ NO HAY NADIE, cuando no hay nadie. Una lista vacía sola no dice si es una regla o un
          error, y acá la diferencia decide a qué pantalla ir. */}
      {personas.length === 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            No hay ninguna persona activa en esta empresa. Se dan de alta en Ajustes → Usuarios.
          </span>
        </div>
      ) : (
        <div className="pds-gente">
          {personas.map((p) => (
            <div className="pds-persona" key={p.usuarioId}>
              <div className="pds-quien">
                <b>{p.nombre}</b>
                {p.email ? <span>{p.email}</span> : null}
              </div>
              {tramos ? (
                <>
                  <Campo
                    persona={p}
                    tramo={tramos.directo}
                    guardado={p.directo}
                    etiqueta="Directo · sus ventas chicas"
                  />
                  <Campo
                    persona={p}
                    tramo={tramos.diferido}
                    guardado={p.diferido}
                    etiqueta="Diferido · ventas del closer en sus leads"
                  />
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Se dice QUIÉNES aparecen y quiénes no. Sin esto, quien no encuentra a alguien en la lista no
          tiene forma de saber si es un error o una regla. Y se dice la asimetría con el panel del
          closer, porque alguien que conoce los dos va a notarla. */}
      <span className="aj-ayuda">
        Aparecen todas las personas activas de la empresa, y no solo las que ya tienen un porcentaje:
        la fila se crea al guardar. A diferencia del panel del closer, acá <b>sí aparece quien
        administra</b> — el Inicio del Setter muestra los números de quien lo abre, así que cualquiera
        puede ser setter. Cada cambio queda registrado con quién lo hizo.
      </span>
    </div>
  );
}
