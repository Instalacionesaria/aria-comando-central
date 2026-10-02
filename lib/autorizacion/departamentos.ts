// Los departamentos: la capa de navegación de la estructura nueva (`NE-11` a `NE-16`,
// `docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO NO DECIDE: QUIÉN VE QUÉ
//
// Eso sigue saliendo de `menuVisible()` (`lib/autorizacion/secciones.ts`): la capacidad, el alcance
// por pestañas y la regla de la organización principal. Este archivo **reparte** lo que el menú ya
// dejó pasar (`NE-16`), y por eso `menuPorDepartamentos` recibe el menú y nada más: sin permisos, sin
// alcance, sin organización. No tiene con qué mostrar de más. Una sección que está en la tabla y no
// está en el menú no aparece; una que está en el menú y no en la tabla, tampoco, y eso SÍ sería un
// defecto —una pantalla que la persona puede ver y no puede abrir—, así que lo vigila
// `pruebas/codigo/191-los-departamentos.test.ts`: toda sección del menú está ubicada, y una sola vez.
//
// ── POR QUÉ UNA TABLA APARTE Y NO UN CAMPO EN `SECCIONES` ────────────────────
//
// Porque una sección ya no vive en un solo lugar: Tools reparte sus pestañas en tres departamentos y
// Analizadores en dos (`NE-19`). Un campo `departamento` en la sección no lo puede decir; una tabla
// de entradas sí. Y `secciones.ts` no se toca: cerca de cien citas `archivo:línea` de los documentos
// dependen de sus líneas.
//
// ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────
//
// No es autorización, igual que el menú: el `03` § 7, *"el menú solo evita que la gente vea puertas
// que no puede abrir"*. Cada operación sigue pasando por el portero.
// ═══════════════════════════════════════════════════════════════════════════════

export type ClaveDeDepartamento = 'research' | 'systems' | 'marketing' | 'sales' | 'client-success';

export interface Departamento {
  clave: ClaveDeDepartamento;
  nombre: string;
  /** La ceja de la cabecera (`NE-12`): dónde se instala el departamento en el programa. */
  ceja: string;
}

/** Los cinco, en el orden de la barra (`NE-11`). */
export const DEPARTAMENTOS: readonly Departamento[] = [
  { clave: 'research', nombre: 'Research', ceja: 'RESEARCH · SE INSTALA EN FOUNDATIONS' },
  { clave: 'systems', nombre: 'Systems', ceja: 'SYSTEMS · SE INSTALA EN SYSTEMS' },
  { clave: 'marketing', nombre: 'Marketing', ceja: 'MARKETING · SE INSTALA EN GROWTH' },
  { clave: 'sales', nombre: 'Sales', ceja: 'SALES · SE INSTALA EN SALES' },
  { clave: 'client-success', nombre: 'Client Success', ceja: 'CLIENT SUCCESS · SE INSTALA EN SCALE' },
];

/**
 * Una entrada de un departamento.
 *
 * · **Sin pestaña**: abre la sección entera, y se llama como la sección (el nombre sale del menú,
 *   que es la única fuente; escribirlo dos veces es cómo «Executive» siguió diciéndose en un lugar).
 * · **Con pestaña**: abre la sección pidiéndole esa pestaña (`NE-19`), y lleva nombre propio, porque
 *   «Tools» no dice cuál de seis.
 * · **Próximamente** (`NE-13`): no abre nada, no lleva sección y nunca hace aparecer un departamento.
 */
export type Entrada =
  | { departamento: ClaveDeDepartamento; seccion: string; pestana?: undefined; nombre?: undefined }
  | { departamento: ClaveDeDepartamento; seccion: string; pestana: string; nombre: string }
  | { departamento: ClaveDeDepartamento; proximamente: true; nombre: string };

/**
 * Las entradas, en el orden de la tabla de `NE-12`.
 *
 * Las pestañas se nombran con la clave de donde se definen: la `clave` de cada herramienta de `TOOLS`
 * (`lib/fundaciones/herramientas.ts`), la de las vistas de `components/views/ToolsView.jsx` y la de
 * `components/analizadores/PanelDeAnalizadores.jsx`. La `191` comprueba que cada una exista ahí. Hoy
 * `Fundaciones.jsx` elige sus herramientas por `id` y no por `clave`: la traducción la hace la etapa
 * E9, que es la que le pasa la pestaña.
 *
 * El Scraper (`NE-20`) no está todavía: su pestaña nace en la etapa E9, y una entrada que pide una
 * pestaña inexistente abriría Tools en otra.
 */
export const ENTRADAS: readonly Entrada[] = [
  { departamento: 'research', seccion: 'icp' },
  { departamento: 'research', seccion: 'tools', pestana: 'espia', nombre: 'Espía de anuncios' },
  { departamento: 'research', seccion: 'tools', pestana: 'mis-leads', nombre: 'Mis Leads' },

  { departamento: 'systems', seccion: 'acquisition' },
  { departamento: 'systems', seccion: 'conversion' },
  { departamento: 'systems', seccion: 'conversation' },

  { departamento: 'marketing', seccion: 'creative' },
  { departamento: 'marketing', proximamente: true, nombre: 'Bio de Instagram' },
  { departamento: 'marketing', proximamente: true, nombre: 'Guiones TOFU · MOFU · BOFU' },
  { departamento: 'marketing', proximamente: true, nombre: 'Guiones de venta directa' },
  { departamento: 'marketing', proximamente: true, nombre: 'Social Media Posting' },
  { departamento: 'marketing', proximamente: true, nombre: 'Clon de IA' },
  { departamento: 'marketing', seccion: 'tools', pestana: 'landing', nombre: 'Tu página' },
  { departamento: 'marketing', seccion: 'tools', pestana: 'vsl', nombre: 'Tu video de ventas' },

  { departamento: 'sales', seccion: 'sales' },
  { departamento: 'sales', seccion: 'contacts' },
  { departamento: 'sales', seccion: 'setter' },
  { departamento: 'sales', seccion: 'closer' },
  { departamento: 'sales', seccion: 'analizadores', pestana: 'HT', nombre: 'Analizador HT' },
  { departamento: 'sales', seccion: 'tools', pestana: 'prospeccion', nombre: 'Prospección en frío' },

  { departamento: 'client-success', seccion: 'analizadores', pestana: 'OB', nombre: 'Analizador OB' },
  { departamento: 'client-success', proximamente: true, nombre: 'Seguimiento de clientes' },
];

/**
 * Las secciones del menú que no son de ningún departamento.
 *
 * · `inicio`: «Nueva conversación» abre el Inicio (`NE-11`, punto 2).
 * · `engranaje`: el menú del pie (`NE-14`), en su orden. Cambiar contraseña y Cerrar sesión no son
 *   secciones y no están acá: los dibuja el menú de la cuenta para todos.
 */
export const FUERA = {
  inicio: 'executive',
  engranaje: ['credenciales', 'monitoreo', 'incidentes'],
} as const;

/** Una entrada lista para dibujar. */
export type EntradaVisible =
  | { nombre: string; seccion: string; pestana: string | null }
  | { nombre: string; proximamente: true };

/** Lo que la barra lateral dibuja (`NE-11`). */
export interface Navegacion {
  /** «Nueva conversación»: el Inicio, o `null` si la persona no lo ve. */
  inicio: { seccion: string; nombre: string } | null;
  departamentos: (Departamento & { entradas: EntradaVisible[] })[];
  engranaje: { seccion: string; nombre: string }[];
}

/**
 * El menú de `menuVisible()`, repartido en departamentos.
 *
 * Un departamento aparece si tiene al menos una entrada que abre algo; sus «Próximamente» van con
 * él, y nunca solas (`NE-13`). Las entradas conservan el orden de `ENTRADAS`, y los departamentos el
 * de `DEPARTAMENTOS`.
 *
 * @param menu lo que devuelve `menuVisible`, con el alcance ya aplicado. Es la ÚNICA entrada: la
 *   visibilidad no se vuelve a decidir acá.
 */
export function menuPorDepartamentos(
  menu: readonly { secciones: readonly { clave: string; nombre: string }[] }[],
): Navegacion {
  const visibles = new Map(menu.flatMap((g) => g.secciones.map((s) => [s.clave, s.nombre] as const)));
  const ref = (clave: string) => {
    const nombre = visibles.get(clave);
    return nombre === undefined ? null : { seccion: clave, nombre };
  };

  const departamentos = DEPARTAMENTOS.map((d) => {
    const entradas: EntradaVisible[] = [];
    for (const e of ENTRADAS) {
      if (e.departamento !== d.clave) continue;
      if ('proximamente' in e) {
        entradas.push({ nombre: e.nombre, proximamente: true });
        continue;
      }
      const nombreDeLaSeccion = visibles.get(e.seccion);
      if (nombreDeLaSeccion === undefined) continue;
      entradas.push({ nombre: e.nombre ?? nombreDeLaSeccion, seccion: e.seccion, pestana: e.pestana ?? null });
    }
    return { ...d, entradas };
  }).filter((d) => d.entradas.some((e) => !('proximamente' in e)));

  return {
    inicio: ref(FUERA.inicio),
    departamentos,
    engranaje: FUERA.engranaje.map(ref).filter((r) => r !== null),
  };
}
