'use client';

/* El interruptor de tema, al costado del nombre de la persona.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DÓNDE VIVE, Y POR QUÉ AHÍ
 *
 * En el pie del menú lateral, pegado a `MenuDeUsuario`, que es donde ya está todo lo que es **tuyo**
 * y no de la empresa: tus datos, cerrar sesión. El tema es una preferencia personal —se guarda por
 * persona, no por organización— así que pertenece a ese rincón y no a la barra superior, que habla
 * de dónde estás parado.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SE PINTA ANTES DE QUE EL SERVIDOR CONFIRME, Y ESO ES UNA DECISIÓN
 *
 * Al pulsarlo, el atributo del `<html>` cambia **en el acto** y recién después sale el `PUT`. Es lo
 * contrario de lo que este repositorio hace con casi todo lo demás, así que hay que justificarlo:
 *
 *   · El efecto es **inmediatamente visible y reversible por quien lo hizo**: si algo saliera mal,
 *     la pantalla ya cambió delante de sus ojos y volver es otro clic. No hay ningún estado en el
 *     que alguien crea que pasó algo que no pasó — que es el defecto que la regla persigue.
 *   · Esperar la ida y vuelta significa medio segundo de nada tras apretar un interruptor. Un
 *     interruptor que no responde se aprieta de nuevo.
 *
 * Lo que **sí** se hace, y es la mitad que no se puede saltear: si el `PUT` falla, se dice. No se
 * revierte el color —quien lo pidió lo está viendo y revertírselo sería más confuso— sino que se
 * avisa que **no va a durar**, que es exactamente lo que se rompió.
 */

import { useCallback, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';
import { aplicar, recordar } from '../app/tema.ts';

/** El glifo dice A DÓNDE lleva el botón, no dónde estás: es lo que un interruptor promete. */
const SIGUIENTE = {
  oscuro: { tema: 'claro', glifo: '☀', titulo: 'Cambiar a modo claro' },
  claro: { tema: 'oscuro', glifo: '☾', titulo: 'Cambiar a modo oscuro' },
};

export default function BotonDeTema({ tema, alCambiar }) {
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState(false);
  const destino = SIGUIENTE[tema] ?? SIGUIENTE.oscuro;

  const cambiar = useCallback(async () => {
    const nuevo = destino.tema;
    setGuardando(true);
    setFalla(false);

    /* Primero la pantalla y la copia local, después el servidor. La copia local se escribe ACÁ y no
       al recibir la respuesta: si la petición se pierde, al recargar se ve lo último que la persona
       eligió y no lo anterior — el navegador ya no puede contradecir a sus propios ojos. */
    aplicar(nuevo);
    recordar(nuevo);
    alCambiar?.(nuevo);

    const r = await pedir('/api/auth/tema', { metodo: 'PUT', cuerpo: { tema: nuevo } });
    setGuardando(false);
    /* El color NO se revierte: quien lo pidió lo está viendo. Lo que se dice es que no va a durar,
       que es lo que efectivamente falló. */
    if (r.tipo !== 'datos' || r.datos?.guardado === false) setFalla(true);
  }, [alCambiar, destino.tema]);

  return (
    <button
      type="button"
      className="tema-btn"
      disabled={guardando}
      onClick={() => void cambiar()}
      /* El nombre accesible dice la ACCIÓN, no el estado, y `aria-pressed` dice el estado. Con un
         solo `aria-label` que dijera «Tema oscuro» nadie sabría si es lo que hay o lo que va a
         pasar. */
      aria-label={destino.titulo}
      aria-pressed={tema === 'oscuro'}
      title={falla ? 'El tema cambió, pero no se pudo guardar: al volver a entrar vuelve el anterior.' : destino.titulo}
    >
      <span aria-hidden="true">{falla ? '⚠' : destino.glifo}</span>
    </button>
  );
}
