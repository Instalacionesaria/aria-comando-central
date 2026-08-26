'use client';

// La guarda de la aplicación: sin sesión ACTIVA, no se dibuja el centro de mando.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA ADEMÁS DEL PROXY
//
// `proxy.ts` ya redirige a quien no trae la cookie. Esto cubre los tres casos que el proxy
// no puede, porque puede correr en el borde y no tiene acceso a la base:
//
//   1. **La cookie existe y la sesión no.** Vencida, revocada, o de otro despliegue. El
//      proxy la ve y la deja pasar; solo la base sabe que no vale.
//   2. **La sesión existe y está RESTRINGIDA.** Contraseña temporal o segundo factor
//      pendiente. Sin esto, alguien a medio autenticar ve el armazón del centro de mando y
//      cada llamada le responde 403 con un código que la pantalla no espera.
//   3. **La organización quedó inactiva** mientras la sesión estaba abierta.
//
// ── Y LO QUE ESTO NO ES ──────────────────────────────────────────────────────
//
// No es autorización. La autorización es el portero, en cada ruta de API. Esto decide qué se
// DIBUJA, no a qué se accede: alguien que borre este componente con las herramientas del
// navegador ve el armazón y ni una fila de datos, porque los datos los sirve el API.
//
// De ahí la regla que hay que mantener: **ninguna página puede traer datos de inquilino en su
// HTML**. Se piden por API, donde el portero decide. Una página que los dibuje en el servidor
// sin pasar por el portero se saltearía el diseño entero, y ni esta guarda ni el proxy la
// salvarían.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';
import {
  ProveedorDeSesion,
  type DatosDeSesion,
  type GrupoDelMenu,
} from './sesion-contexto.tsx';

interface Sesion {
  autenticado: boolean;
  estado?: string;
  // Lo que el armazón necesita para dibujarse. Llega en la MISMA respuesta que ya se pide
  // para saber si hay sesión, así que no cuesta un viaje más — y no puede quedar viejo
  // respecto del estado, que es lo que pasaría con dos peticiones.
  menu?: GrupoDelMenu[];
  arranque?: DatosDeSesion['arranque'];
  usuarioNombre?: string;
  usuarioId?: string;
  puedeCambiarDeEmpresa?: boolean;
  secciones?: DatosDeSesion['secciones'];
  organizacion?: DatosDeSesion['organizacion'];
  mirandoOtraOrganizacion?: boolean;
}

type Situacion = 'preguntando' | 'adentro' | 'sin_respuesta';

export default function Guardia({ children }: { children: React.ReactNode }) {
  const [situacion, setSituacion] = useState<Situacion>('preguntando');
  const [causa, setCausa] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosDeSesion | null>(null);
  const yaPreguntado = useRef(false);

  const preguntar = useCallback(async () => {
    setSituacion('preguntando');
    const r = await pedir<Sesion>('/api/auth/sesion');

    // "No pude preguntar" NO es "no estás autenticado", y confundirlos es el defecto que el
    // `07` § 2 llama el peor de su lista. Mandar al login ante un parpadeo de red expulsa a
    // alguien que sí tenía sesión, y en los registros parece que a nadie le andaba la sesión.
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
      setSituacion('sin_respuesta');
      return;
    }
    // Esta ruta responde 200 siempre por diseño. Si rechaza, es estructural —un proxy, la
    // plataforma— y tampoco significa "entrá de nuevo".
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? `El servidor respondió ${r.estado}.`);
      setSituacion('sin_respuesta');
      return;
    }

    if (r.datos.autenticado && r.datos.estado === 'activa') {
      // El menú y la organización vienen en esta misma respuesta. Si faltaran —una versión
      // vieja del servidor detrás de un despliegue a medias— el armazón se dibuja SIN ninguna
      // entrada, no con las diez: el `03` § 5 llevado a la interfaz, *"una operación nueva
      // nace cerrada"*.
      setDatos({
        menu: r.datos.menu ?? [],
        // `null` y NO deducido del menú: deducirlo acá volvería a poner la regla en el cliente,
        // que es justo lo que `seccionDeArranque` vino a juntar. Sin el campo no se marca ninguna
        // pantalla —el menú sigue andando, un clic abre lo que sea— y es el mismo lado del que
        // fallan las demás de esta lista.
        arranque: r.datos.arranque ?? null,
        usuarioNombre: r.datos.usuarioNombre ?? '',
        usuarioId: r.datos.usuarioId ?? '',
        // `false` ante la duda: sin saberlo, NO se ofrece el conmutador.
        puedeCambiarDeEmpresa: r.datos.puedeCambiarDeEmpresa ?? false,
        // `[]` y no `undefined`: sin secciones no se dibuja NINGUNA pestaña, que es el lado
        // correcto del que fallar. Ver el `03` § 5, "una operación nueva nace cerrada".
        secciones: r.datos.secciones ?? [],
        organizacion:
          r.datos.organizacion ?? {
            id: '',
            nombre: '',
            activa: true,
            zonaHoraria: 'UTC',
            // `false` y no `true`: ante la duda, NO se muestran las pestañas de administración.
            esPrincipal: false,
          },
        mirandoOtraOrganizacion: r.datos.mirandoOtraOrganizacion ?? false,
      });
      setSituacion('adentro');
      return;
    }

    // A la entrada, con el camino actual para volver acá después. Solo el camino, nunca la URL
    // completa: `app/entrar/page.tsx` lo valida igual, y mandar menos es mejor que confiar en
    // que el otro lado valide.
    const aqui = window.location.pathname;
    const volver = aqui === '/' ? '' : `?volver=${encodeURIComponent(aqui)}`;
    // Navegación completa y no enrutado del cliente: el proxy tiene que ver la petición.
    window.location.replace(`/entrar${volver}`);
  }, []);

  useEffect(() => {
    if (yaPreguntado.current) return;
    yaPreguntado.current = true;
    void preguntar();
  }, [preguntar]);

  if (situacion === 'adentro') {
    return <ProveedorDeSesion value={datos}>{children}</ProveedorDeSesion>;
  }

  if (situacion === 'sin_respuesta') {
    return (
      <main className="guardia">
        <div className="guardia-caja">
          <h1 className="guardia-titulo">No pudimos preguntar</h1>
          <p className="guardia-sub">
            {causa} No es tu sesión: no se pudo llegar al servidor para preguntar por ella.
          </p>
          <button type="button" onClick={() => void preguntar()}>
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  // Mientras se pregunta no se dibuja nada del centro de mando.
  //
  // Un armazón a medias sería peor que un vacío: quien esté a medio autenticar lo vería un
  // instante antes del redirect, y eso es exactamente lo que esta guarda viene a impedir. El
  // caso común —sin cookie— ni llega acá, porque el proxy redirigió antes.
  return (
    <main className="guardia">
      <div className="guardia-caja">
        <p className="guardia-sub">Verificando la sesión…</p>
      </div>
    </main>
  );
}
