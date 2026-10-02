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
// de entradas sí. Y a `secciones.ts` no se le agregan ni se le quitan líneas: cerca de cien citas
// `archivo:línea` de los documentos dependen de ellas (`NE-33`).
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
 * `components/analizadores/PanelDeAnalizadores.jsx`. La `191` comprueba que cada una exista ahí.
 * `Fundaciones.jsx` elige sus herramientas por `id` y no por `clave`: la traducción la hace
 * `activaDeLaPestana` (`lib/fundaciones/herramientas.ts`).
 */
export const ENTRADAS: readonly Entrada[] = [
  { departamento: 'research', seccion: 'icp' },
  { departamento: 'research', seccion: 'tools', pestana: 'espia', nombre: 'Espía de anuncios' },
  { departamento: 'research', seccion: 'tools', pestana: 'scraper', nombre: 'Scraper' },
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

/**
 * La entrada abierta, para marcarla en la barra y abrir su departamento (`NE-11`), o `null`.
 *
 * `seccion` es la pantalla a la vista y `pestana`, la que esa pantalla dibuja: no la última que se
 * pidió, porque Tools cambia de pestaña por dentro (el «Continuar» del VSL). Una sección repartida en varios
 * departamentos EXIGE la pestaña —sin ella no se sabe cuál de sus entradas es— y da `null` en vez
 * de adivinar. El Inicio y el engranaje no son de ningún departamento: `null`.
 */
export function entradaAbierta(
  navegacion: Navegacion,
  seccion: string | null,
  pestana: string | null,
): { departamento: ClaveDeDepartamento; nombre: string } | null {
  if (seccion === null) return null;
  for (const d of navegacion.departamentos) {
    for (const e of d.entradas) {
      if ('proximamente' in e || e.seccion !== seccion) continue;
      if (e.pestana === null || e.pestana === pestana) return { departamento: d.clave, nombre: e.nombre };
    }
  }
  return null;
}

/**
 * Dónde vive una pestaña de una sección repartida, dicho como la barra lateral: «Marketing › Tu video
 * de ventas». La usa la barra de pasos de ICP & Oferta para nombrar el paso que vive en Tools
 * (`components/fundaciones/BarraDePasos.jsx`), en vez de escribir el lugar a mano. Es la tabla de
 * `ENTRADAS`, sin la visibilidad de nadie: dice dónde está, no quién lo ve. `null` si no es de ningún
 * departamento.
 */
export function lugarDe(seccion: string, pestana: string): string | null {
  const entrada = ENTRADAS.find((e) => !('proximamente' in e) && e.seccion === seccion && e.pestana === pestana);
  if (!entrada || entrada.nombre === undefined) return null;
  const departamento = DEPARTAMENTOS.find((d) => d.clave === entrada.departamento);
  return departamento ? `${departamento.nombre} › ${entrada.nombre}` : null;
}

/**
 * El alcance que ofrece Ajustes › Usuarios, agrupado por departamento (`NE-21`).
 *
 * Recibe lo que ya devuelve `alcanceOfrecible` (`lib/autorizacion/secciones.ts`) —las secciones que el
 * rol alcanza, en los grupos del menú viejo— y lo reparte: cada sección en UN solo grupo, el
 * departamento de su primera entrada, con la lista de lo que abre. Así, antes de tildarla, se ve que
 * una sola casilla («Tools») abre seis entradas en tres departamentos. Repetirla en los tres sería
 * peor: tres casillas que se tildan y se destildan juntas, sin que se vea por qué —destildarla en un
 * departamento la saca de los tres—, con su descripción repetida para el lector de pantalla
 * (`docs/OTROS/nueva-estructura/07-LO-QUE-SE-ROMPE-EN-SILENCIO.md`). Y cada sección sale con todos sus
 * campos, `abre` aparte: la pantalla lee `soloDesdeLaPrincipal` para no ofrecer Monitoreo e Incidentes
 * fuera de la organización principal.
 *
 * No decide qué se ofrece: eso ya lo hizo `alcanceOfrecible`, y acá no entra ni sale ninguna sección.
 * El Inicio va primero y sin título, como en la barra; lo del engranaje, en «Menú de la cuenta», en su
 * orden; y lo que no es de ninguno de los dos —las pestañas de Ajustes, Usuarios y Empresas— conserva
 * el grupo con que vino. Sin grupos vacíos, por lo mismo que `menuVisible`.
 */
export function alcancePorDepartamento<S extends { clave: string; nombre: string }>(
  grupos: readonly { grupo: { clave: string; etiqueta: string | null }; secciones: readonly S[] }[],
): { grupo: { clave: string; etiqueta: string | null }; secciones: (S & { abre: string[] })[] }[] {
  const primera = (clave: string) => ENTRADAS.findIndex((e) => !('proximamente' in e) && e.seccion === clave);
  const abre = (s: S): string[] =>
    ENTRADAS.flatMap((e) => {
      if ('proximamente' in e || e.seccion !== s.clave) return [];
      const d = DEPARTAMENTOS.find((x) => x.clave === e.departamento);
      return d ? [`${d.nombre} › ${e.nombre ?? s.nombre}`] : [];
    });
  const inicio: (S & { abre: string[] })[] = [];
  const porDepartamento = new Map<ClaveDeDepartamento, (S & { abre: string[] })[]>(DEPARTAMENTOS.map((d) => [d.clave, []]));
  const engranaje: (S & { abre: string[] })[] = [];
  const otros: { grupo: { clave: string; etiqueta: string | null }; secciones: (S & { abre: string[] })[] }[] = [];

  for (const g of grupos) {
    const quedan: (S & { abre: string[] })[] = [];
    for (const s of g.secciones) {
      const conLugares = { ...s, abre: abre(s) };
      const i = primera(s.clave);
      if (s.clave === FUERA.inicio) inicio.push(conLugares);
      else if ((FUERA.engranaje as readonly string[]).includes(s.clave)) engranaje.push(conLugares);
      else if (i >= 0) porDepartamento.get(ENTRADAS[i]!.departamento)!.push(conLugares);
      else quedan.push(conLugares);
    }
    if (quedan.length > 0) otros.push({ grupo: g.grupo, secciones: quedan });
  }
  for (const lista of porDepartamento.values()) lista.sort((a, b) => primera(a.clave) - primera(b.clave));
  const enOrden = (FUERA.engranaje as readonly string[]);
  engranaje.sort((a, b) => enOrden.indexOf(a.clave) - enOrden.indexOf(b.clave));

  return [
    { grupo: { clave: 'inicio', etiqueta: null }, secciones: inicio },
    ...DEPARTAMENTOS.map((d) => ({ grupo: { clave: d.clave, etiqueta: d.nombre }, secciones: porDepartamento.get(d.clave)! })),
    { grupo: { clave: 'engranaje', etiqueta: 'Menú de la cuenta' }, secciones: engranaje },
    ...otros,
  ].filter((g) => g.secciones.length > 0);
}
