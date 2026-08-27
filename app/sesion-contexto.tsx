'use client';

// Lo que el armazón necesita saber de la sesión: qué pantallas ve y quién es.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN ARCHIVO APARTE Y NO DENTRO DE `guardia.tsx`
//
// Porque lo consumen `Nav.jsx` y `CommandCenter.jsx`, que son componentes de cliente en
// `components/`. Si el contexto viviera en `app/guardia.tsx`, esos dos importarían la guarda
// entera —con su `pedir()`, su máquina de estados y su redirección— para leer una lista.
//
// ── Y LO QUE ESTO NO ES ─────────────────────────────────────────────────────
//
// No es autorización, y conviene repetirlo acá porque este archivo es justo donde da la
// tentación de creer lo contrario. El `03` § 7 lo dice: *"eso es comodidad, NO SEGURIDAD.
// Cualquiera puede llamar a la API con su sesión y una herramienta de línea de comandos; el
// menú solo evita que la gente vea puertas que no puede abrir."*
//
// Alguien que borre este contexto con las herramientas del navegador ve las diez entradas del
// menú y ni una fila de datos, porque los datos los sirve el API y ahí decide el portero.
// ═══════════════════════════════════════════════════════════════════════════════

import { createContext, useContext } from 'react';

/** Una entrada del menú, tal como la manda el servidor. */
export interface SeccionDelMenu {
  clave: string;
  nombre: string;
  menu?: { grupo: string; icono: string; galon?: true };
}

/** Un grupo del menú con sus secciones visibles, ya en orden. */
export interface GrupoDelMenu {
  grupo: { clave: string; etiqueta: string | null; pie?: true };
  secciones: SeccionDelMenu[];
}

export interface DatosDeSesion {
  /**
   * El menú **ya agrupado y en orden**, como lo armó el servidor con `menuVisible()`.
   *
   * El cliente no ordena ni agrupa nada: si lo hiciera, habría dos listas que se pueden
   * desordenar una respecto de la otra, que es el defecto que la Etapa 11 pagó.
   */
  menu: GrupoDelMenu[];
  /**
   * Con qué pantalla se abre, decidido por el servidor con `seccionDeArranque()`.
   *
   * `null` es un estado real y hay que poder distinguirlo: un rol restringido sin ninguna sección
   * concedida no tiene pantalla que abrir. Los tres consumidores —la fila marcada, la vista
   * dibujada y la miga de pan— leen ESTE campo en vez de deducirlo cada uno del menú, que es como
   * la miga terminó diciendo «Executive» a alguien que no ve Executive.
   */
  arranque: { seccion: SeccionDelMenu; grupo: string } | null;
  /**
   * El tema elegido por esta persona, tal como está guardado en la base.
   *
   * Es la VERDAD. `app/tema.ts` guarda además una copia en el navegador, pero sólo para que el
   * primer pintado no destelle: cuando llega esta respuesta, manda ésta.
   */
  tema: 'oscuro' | 'claro';
  usuarioNombre: string;
  /** Quién es. Lo necesita la pantalla de usuarios para no ofrecerse a sí misma un cambio de
   *  rol: `ADR-0502` dice que nadie se degrada a sí mismo, y el servidor responde 409. Ofrecer
   *  el botón para recibir ese 409 sería un control que no funciona. */
  usuarioId: string;
  /** ¿Puede moverse entre empresas? Lo responde el SERVIDOR con la misma condición que el
   *  endpoint que conmuta, para que el botón no ofrezca algo que va a ser rechazado. */
  puedeCambiarDeEmpresa: boolean;
  /** ¿Puede configurar los porcentajes de comisión? Lo responde el servidor con la MISMA condición
   *  que comprueba el endpoint, para que el botón no ofrezca algo que va a ser rechazado. */
  puedeConfigurarComisiones: boolean;
  /**
   * Las secciones que esta persona puede ver, ya filtradas por el SERVIDOR con
   * `seccionesVisibles()`.
   *
   * Es la misma función que arma el menú, no una segunda copia de la regla: las pestañas de
   * Ajustes se deciden con esto, así que no hay forma de que el menú y las pestañas discrepen.
   */
  secciones: { clave: string; nombre: string }[];
  organizacion: {
    id: string;
    nombre: string;
    activa: boolean;
    zonaHoraria: string;
    /** Administrar empresas y usuarios se hace DESDE la principal. Ver `sesion.ts`. */
    esPrincipal: boolean;
  };
  /** El cartel permanente del `03` § 3. */
  mirandoOtraOrganizacion: boolean;
}

const SesionContexto = createContext<DatosDeSesion | null>(null);

export const ProveedorDeSesion = SesionContexto.Provider;

/**
 * Los datos de la sesión, o `null` si el componente se montó fuera del proveedor.
 *
 * Devuelve `null` en vez de lanzar, y es una decisión: `components/*` se renderizan también
 * en las pruebas de paridad y en cualquier montaje que no pase por la guarda. Lanzar ahí
 * convertiría "este componente no sabe quién sos" en una pantalla en blanco.
 *
 * Cada consumidor decide qué hacer con el nulo, y los dos que hay eligen lo mismo: **no
 * dibujar nada**. Es lo correcto por el `03` § 5 —*"una operación nueva nace cerrada"*—
 * llevado a la interfaz: sin saber qué pantallas corresponden, ninguna.
 */
export function useSesion(): DatosDeSesion | null {
  return useContext(SesionContexto);
}
