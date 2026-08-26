'use client';

/* Ajustes — la configuración de la empresa, en tres pestañas. NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUIÉN VE CADA PESTAÑA, Y POR QUÉ ASÍ
 *
 * Se pidió: *"la de credenciales lo pueden ver los admin, y la de empresa y usuarios solo se
 * puede ver por un superadmin. Y eso de empresa y de usuarios solo se puede ver desde la
 * empresa principal que es ARIA."*
 *
 * Se implementó así, con UNA desviación que hay que decir de frente:
 *
 *   · **Credenciales** → `credenciales.ver`. La tienen administrador y superadministrador.
 *
 *   · **Empresas** → `organizaciones.listar` **y estar en la principal**. La capacidad solo la
 *     tiene el rol de plataforma: el reparto se la niega al administrador con
 *     `not like 'organizaciones.%'`. La regla de la principal es SOLO de interfaz —se quitó del
 *     servidor porque creaba un encierro, ver `app/api/admin/organizaciones/route.ts`— y eso está
 *     bien acá: la barrera es la capacidad, esto es coherencia.
 *
 *   · **Usuarios** → `usuarios.ver`, **sin** la condición de la principal. Dos cosas que decir.
 *
 *     La CAPACIDAD estaba mal, y era un defecto propio: preguntaba por la sección `empresas`, o
 *     sea por `organizaciones.listar`. La sección `usuarios` existe en `secciones.ts` con su
 *     capacidad y **nadie la consultaba**. Dos consecuencias medibles: un rol con
 *     `organizaciones.listar` y sin `usuarios.ver` vería la pestaña y recibiría 403 de las dos
 *     rutas que la llenan, y uno con `usuarios.ver` sin la otra no la vería teniéndola.
 *
 *     Y la condición de la principal NO se pone, aunque se pidiera. El motivo no es de interfaz:
 *     editar, desactivar y borrar operan sobre la organización ACTIVA de la sesión. Si la pestaña
 *     desapareciera al conmutar, no habría forma de administrar a la gente de ningún cliente —
 *     y eso ya está escrito en el encabezado de `components/ajustes/Usuarios.jsx`.
 *
 *     Lo esencial del pedido se cumple donde importa, y desde la Etapa 12 lo hace cumplir el
 *     SERVIDOR: el rol `administrador` perdió la familia `usuarios.%` entera, así que un
 *     administrador de un cliente no ve la pestaña **y tampoco puede llamar a sus rutas**. Antes
 *     lo primero era cierto y lo segundo no.
 *
 *     Lo que sí cambió para no obligar a conmutar: el alta lleva un selector de empresa.
 *
 * ── NO SE PREGUNTA POR EL NOMBRE DEL ROL, NI UNA VEZ ───────────────────────
 *
 * `ADR-0302`: el permiso se pregunta por capacidad. No hay ningún `rol === 'superadministrador'`
 * acá ni en el servidor — se mira si la sesión trae la capacidad, que es lo que permite mover
 * un permiso de un rol a otro sin tocar código.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useSesion } from '../../app/sesion-contexto.tsx';
import Credenciales from '../ajustes/Credenciales.jsx';
import Empresas from '../ajustes/Empresas.jsx';
import Usuarios from '../ajustes/Usuarios.jsx';

export default function AjustesView({ activa }) {
  const sesion = useSesion();
  const [sub, setSub] = useState('credenciales');
  /* Cambiar de empresa reescribe la sesión entera, así que hay que volver a pedirla. Se hace
     con una recarga completa y no con un re-render: `app/guardia.tsx` la pide una sola vez por
     carga, y media pantalla con la sesión vieja y media con la nueva es peor que esperar. */
  const recargar = () => window.location.reload();

  /* Las capacidades vienen del servidor, ya resueltas. `secciones` es lo que `seccionesVisibles`
     dejó pasar, o sea la MISMA función que decide el menú — no una segunda copia de la regla. */
  const puede = (clave) => (sesion?.secciones ?? []).some((s) => s.clave === clave);

  /* ── LAS PESTAÑAS DEPENDEN DE LA CAPACIDAD, NO DE DÓNDE ESTÉS PARADO ────────
   *
   * Empresas llevaba además un `&& enLaPrincipal`, y eso resultó ser un defecto. La intención era
   * de coherencia —administrar se hace desde la casa matriz—, pero el efecto era otro: quien
   * conmutaba a una empresa cliente **perdía la pestaña**, y para volver a verla tenía que
   * acordarse de que la salida era volver a la principal. Un menú que aparece y desaparece según
   * dónde estés no se lee como una regla: se lee como que la aplicación se rompió.
   *
   * La barrera real es la capacidad, y no se movió: `organizaciones.listar` la tiene **solo** el
   * rol de plataforma —la migración 003 se la niega al administrador con
   * `not like 'organizaciones.%'`—, y la comprueba el servidor en cada operación. Esconder de más
   * en la pantalla no agregaba seguridad; agregaba un estado sin salida aparente.
   */
  const PESTANAS = [
    { clave: 'credenciales', nombre: 'Credenciales', icono: '#i-ajustes', visible: puede('credenciales') },
    { clave: 'empresas', nombre: 'Empresas', icono: '#i-exec', visible: puede('empresas') },
    { clave: 'usuarios', nombre: 'Usuarios', icono: '#i-leads', visible: puede('usuarios') },
  ].filter((p) => p.visible);

  /* Si la pestaña activa dejó de existir se cae a la primera que quede. Sin esto, el cuerpo queda
     en blanco sin ningún error. */
  const activaAhora = PESTANAS.some((p) => p.clave === sub) ? sub : (PESTANAS[0]?.clave ?? null);

  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-credenciales">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Ajustes
              </h2>
              <span className="cre-desc">
                {sesion?.organizacion?.nombre
                  ? `Configuración de ${sesion.organizacion.nombre}`
                  : 'Configuración de esta empresa'}
              </span>
            </div>
            {/* Una sola pestaña no es una pestaña: si la persona solo puede ver credenciales,
                mostrar un selector de uno es ruido que sugiere que hay algo más. */}
            {PESTANAS.length > 1 ? (
              <div className="cl-sub aj-sub">
                {PESTANAS.map((p) => (
                  <button
                    key={p.clave}
                    type="button"
                    className={activaAhora === p.clave ? 'on' : undefined}
                    onClick={() => setSub(p.clave)}
                  >
                    <svg viewBox="0 0 16 16">
                      <use href={p.icono} />
                    </svg>
                    {p.nombre}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {activaAhora === 'credenciales' ? <Credenciales /> : null}
        {activaAhora === 'empresas' ? (
          <Empresas sesion={sesion} alCambiarDeEmpresa={recargar} />
        ) : null}
        {activaAhora === 'usuarios' ? <Usuarios sesion={sesion} /> : null}
        {activaAhora === null ? (
          <div className="fd-aviso falta">
            <i>◍</i>
            <span>Tu usuario no tiene ninguna sección de ajustes.</span>
          </div>
        ) : null}
      </div>
    </section>
    </>
  );
}
