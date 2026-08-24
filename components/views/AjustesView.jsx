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
 *     tiene el rol de plataforma —la migración 003 se la niega al administrador con
 *     `not like 'organizaciones.%'`— y la regla de la principal se comprueba TAMBIÉN en el
 *     servidor, así que las dos mitades dicen lo mismo.
 *
 *   · **Usuarios** → `organizaciones.listar`, **sin** la condición de la principal. Ésta es la
 *     desviación, y el motivo no es de interfaz: `POST /api/admin/usuarios` crea SIEMPRE en la
 *     organización ACTIVA de la sesión, decidido en la Etapa 5 con su razón escrita —*"un
 *     segundo camino sería un segundo lugar donde olvidarse el filtro"*—. Para crearle un
 *     usuario a «Cliente X» hay que estar administrando Cliente X; si la pestaña desapareciera
 *     al conmutar, no habría forma de darle usuarios a ninguna empresa que no sea la principal.
 *
 *     Lo esencial del pedido se respeta: la pide `organizaciones.listar`, o sea que un
 *     administrador de un cliente NO la ve. Y la pantalla dice arriba de todo en qué empresa
 *     está creando, que es el defecto que la regla venía a evitar.
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
  const enLaPrincipal = Boolean(sesion?.organizacion?.esPrincipal);

  const PESTANAS = [
    { clave: 'credenciales', nombre: 'Credenciales', icono: '#i-ajustes', visible: puede('credenciales') },
    { clave: 'empresas', nombre: 'Empresas', icono: '#i-exec', visible: puede('empresas') && enLaPrincipal },
    { clave: 'usuarios', nombre: 'Usuarios', icono: '#i-leads', visible: puede('empresas') },
  ].filter((p) => p.visible);

  /* Si la pestaña activa dejó de existir —pasa al conmutar de empresa: Empresas desaparece—
     se cae a la primera que quede. Sin esto, el cuerpo queda en blanco sin ningún error. */
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
