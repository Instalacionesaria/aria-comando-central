'use client';

/* De quién son los números del Closer: el selector de la cabecera (2026-10-29).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VOLVIÓ A LA CABECERA, Y CON LA PÍLDORA DEL SISTEMA
 *
 * Antes era un `<select>` «Ver los números de» dentro de Inicio, y sólo lo veía quien ve todo. El administrador que
 * además se designó closer no lo veía nunca: su alcance era «mío», y operaba el Closer mirando una décima parte de
 * la zona. Ahora lo ofrece el SERVIDOR (`puedeElegirCloser`) a quien ve todo o supervisa (`credenciales.editar`), y
 * vive en la cabecera, así que está en las cuatro sub-pestañas.
 *
 * Es la misma píldora que el selector de cliente (`components/SelectorDeCliente.jsx`): `acct` + `menu-pop` +
 * `mp-head` + `mp-item`. Las opciones: «Lo mío» (sólo si quien mira es closer vinculado), «Toda la empresa», un
 * closer por fila y «Sin asignar». Lo marcado es lo que el servidor aplicó (`eleccion`), no lo que se pidió: si
 * el pedido cayó en el alcance propio, la píldora lo dice.
 *
 * Elegir no hace una recarga entera, como sí cambiar de cliente: el valor viaja en `?verComo=` de cada lectura del
 * Closer (Mi Día, Pipeline, Agenda, el Brief), y quien cierra la puerta es `alcancePedido` en el servidor.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { usarCierreDeMenu } from '../../lib/menu.ts';

/** Lo que el selector eligió, para lo que lee el Closer por fuera de la vista (el Brief, dentro de la ficha). */
export const VerComoDelCloser = createContext(null);

/**
 * Lo que Avanzar necesita para registrar a nombre del closer elegido (la `107`): si quien mira supervisa, qué aplicó
 * el servidor (`eleccion`), los closers y «Lo mío». Sólo existe dentro del Closer: fuera, Avanzar no dice ni manda nada.
 */
export const RegistroDelCloser = createContext(null);

/**
 * A nombre de quién queda lo que se registra en Avanzar, y la frase que lo dice. `null` = no se dice ni se manda nada
 * (fuera del Closer, quien no supervisa, o un contacto del setter): el servidor acredita a quien registra.
 *
 *   · Mirando a UN closer: se manda ese closer (`aNombreDe`), y la frase lo nombra.
 *   · Mirando «Toda la empresa» o «Sin asignar»: no se manda nada, y el servidor acredita al closer que el CRM le
 *     asignó al contacto (`closerAsignado`, el mismo cálculo); sin ninguno, a quien registra.
 */
export function aNombreDelRegistro(registro, closerAsignado, territorio) {
  if (!registro?.supervisa || !SE_ACREDITA_A_UN_CLOSER[territorio]) return null;
  const { eleccion, closers, miCloserId } = registro;
  if (eleccion && eleccion !== 'todo' && eleccion !== 'sin_asignar') {
    if (eleccion === miCloserId) return { aNombreDe: eleccion, texto: 'Se registra a tu nombre.' };
    const k = (closers ?? []).find((c) => c.usuarioId === eleccion);
    if (k) return { aNombreDe: eleccion, texto: `Se registra a nombre de ${k.nombre}.` };
  }
  if (closerAsignado) {
    return {
      aNombreDe: null,
      texto: closerAsignado.usuarioId === miCloserId
        ? 'Se registra a tu nombre: eres el closer de este contacto.'
        : `Se registra a nombre de ${closerAsignado.nombre}, el closer de este contacto.`,
    };
  }
  return { aNombreDe: null, texto: 'Este contacto no tiene closer asignado: se registra a tu nombre.' };
}

/** Un camino con `verComo` agregado, si hay. Es la misma forma en las cuatro lecturas. */
export function conVerComo(camino, verComo) {
  if (!verComo) return camino;
  return `${camino}${camino.includes('?') ? '&' : '?'}verComo=${encodeURIComponent(verComo)}`;
}

/** Las opciones, en su orden. «Lo mío» primero: es lo que un closer busca. Él mismo no se repite en la lista. */
export function opcionesDelSelector(closers, miCloserId) {
  const opciones = [];
  if (miCloserId) opciones.push({ valor: miCloserId, nombre: 'Lo mío' });
  opciones.push({ valor: 'todo', nombre: 'Toda la empresa' });
  for (const k of closers ?? []) {
    if (k.elegible && k.usuarioId !== miCloserId) opciones.push({ valor: k.usuarioId, nombre: k.nombre });
  }
  opciones.push({ valor: 'sin_asignar', nombre: 'Sin asignar' });
  return opciones;
}

export default function SelectorDeCloser({ closers, eleccion, miCloserId, alElegir }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const disparador = useRef(null);

  const opciones = opcionesDelSelector(closers, miCloserId);
  const actual = opciones.find((o) => o.valor === eleccion) ?? opciones.find((o) => o.valor === 'todo');

  const cerrar = useCallback(() => {
    setAbierto(false);
    if (caja.current?.querySelector('.menu-pop')?.contains(document.activeElement)) disparador.current?.focus();
  }, []);
  usarCierreDeMenu(abierto, caja, cerrar);

  /* Al abrir, el foco va a la opción marcada: con el teclado se sigue con las flechas desde ahí. */
  useEffect(() => {
    if (!abierto) return;
    caja.current?.querySelector('.mp-item[aria-checked="true"]')?.focus();
  }, [abierto]);

  const moverFoco = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = [...(caja.current?.querySelectorAll('.mp-item') ?? [])];
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement);
    const destino =
      e.key === 'Home' ? 0
        : e.key === 'End' ? items.length - 1
          : e.key === 'ArrowDown' ? (i + 1) % items.length
            : (i - 1 + items.length) % items.length;
    items[destino].focus();
  };

  const elegir = (valor) => {
    setAbierto(false);
    disparador.current?.focus();
    if (valor !== eleccion) alElegir?.(valor);
  };

  return (
    <div className="sc-closer">
      <div className={`menu-wrap acct-wrap${abierto ? ' open' : ''}`} ref={caja}>
        <button
          className="acct"
          title={`De quién son los números: ${actual.nombre}`}
          type="button"
          ref={disparador}
          aria-haspopup="menu"
          aria-expanded={abierto}
          onClick={(e) => {
            e.stopPropagation();
            setAbierto((v) => !v);
          }}
        >
          <span className="acct-name">
            <span className="sc-ceja">Closer · </span>
            {actual.nombre}
          </span>
          <span className="acct-chev" aria-hidden="true">
            ⇅
          </span>
        </button>

        <div className="menu-pop" role="menu" aria-label="De quién ver los números" onKeyDown={moverFoco}>
          <div className="mp-head">
            <span>
              <b>De quién ver los números</b>
              <em>Vale para Inicio, Mi Día, Pipeline y Agenda</em>
            </span>
          </div>
          <div className="mp-sep" />
          {opciones.map((o) => {
            const aqui = o.valor === actual.valor;
            return (
              <button
                key={o.valor}
                type="button"
                className={aqui ? 'mp-item sc-aqui' : 'mp-item'}
                role="menuitemradio"
                aria-checked={aqui}
                tabIndex={abierto ? 0 : -1}
                onClick={() => elegir(o.valor)}
              >
                {o.nombre}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Qué territorio acredita a un closer (la `107`): un registro y no un `territorio === …`, por `ADR-0302` (prohíbe comparar
   contra un nombre que fue rol) y porque un territorio nuevo cae en «no» en vez de en la rama de otro. */
const SE_ACREDITA_A_UN_CLOSER = { closer: true, setter: false };
