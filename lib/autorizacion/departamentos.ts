// Los departamentos: la capa de navegación de la estructura nueva (`NE-11` a `NE-16`,
// `docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`), con los grupos de la segunda edición (`NE-45`,
// `docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`).
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
// ── LOS GRUPOS ──────────────────────────────────────────────────────────────
//
// Radar, Funnel y Leads son UNA entrada de la barra con varias sub-pestañas (`NE-45`). En la tabla
// siguen siendo entradas planas, cada una con su sección y su pestaña, y las de un grupo llevan su
// nombre en `grupo`: así cada sub-pestaña se ve o no por SU sección, como cualquier entrada. Leads lo
// necesita, porque cruza dos pantallas con permisos distintos —«De GHL» es el Leads Portal y «De Radar»
// una pestaña de Tools (`NE-46`)—: si se viera por la sección del grupo, ofrecería una puerta que el
// servidor cierra. `menuPorDepartamentos` pliega cada grupo en una entrada que abre su primera
// sub-pestaña que abre algo, y la barra la abre con la misma llamada que a las demás.
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
  /** La ceja de la cabecera: el nombre del departamento en mayúsculas (`NE-48`). Hasta la segunda
   *  edición decía también dónde se instala en el programa («· SE INSTALA EN FOUNDATIONS»). */
  ceja: string;
}

/** Los cinco, en el orden de la barra (`NE-11`). */
export const DEPARTAMENTOS: readonly Departamento[] = [
  { clave: 'research', nombre: 'Research', ceja: 'RESEARCH' },
  { clave: 'systems', nombre: 'Systems', ceja: 'SYSTEMS' },
  { clave: 'marketing', nombre: 'Marketing', ceja: 'MARKETING' },
  { clave: 'sales', nombre: 'Sales', ceja: 'SALES' },
  { clave: 'client-success', nombre: 'Client Success', ceja: 'CLIENT SUCCESS' },
];

/**
 * Una entrada de un departamento.
 *
 * · **Sin pestaña ni grupo**: abre la sección entera, y se llama como la sección (el nombre sale del
 *   menú, que es la única fuente; escribirlo dos veces es cómo «Executive» siguió diciéndose en un lugar).
 * · **Con pestaña**: abre la sección pidiéndole esa pestaña (`NE-19`), y lleva nombre propio, porque
 *   «Tools» no dice cuál de seis.
 * · **En un grupo** (`grupo`): es una sub-pestaña de esa entrada de la barra (`NE-45`), y lleva nombre
 *   propio aunque abra una sección entera: «De GHL» no se llama como el Leads Portal.
 * · **Próximamente** (`NE-13`): no abre nada, no lleva sección y nunca hace aparecer un departamento
 *   ni un grupo.
 */
export type Entrada =
  | { departamento: ClaveDeDepartamento; seccion: string; pestana?: undefined; nombre?: undefined; grupo?: undefined }
  | { departamento: ClaveDeDepartamento; seccion: string; pestana?: string; nombre: string; grupo?: string }
  | { departamento: ClaveDeDepartamento; proximamente: true; nombre: string; grupo?: string };

/**
 * Las entradas, en el orden de la tabla de `NE-45` (`09-LA-SEGUNDA-EDICION.md`). Las de un grupo van
 * juntas: la barra las dibuja donde está la primera.
 *
 * Las pestañas se nombran con la clave de donde se definen: la `clave` de cada herramienta de `TOOLS`
 * (`lib/fundaciones/herramientas.ts`), la de las vistas de `components/views/ToolsView.jsx` y la de
 * `components/analizadores/PanelDeAnalizadores.jsx`. La `191` comprueba que cada una exista ahí.
 * `Fundaciones.jsx` elige sus herramientas por `id` y no por `clave`: la traducción la hace
 * `activaDeLaPestana` (`lib/fundaciones/herramientas.ts`).
 */
export const ENTRADAS: readonly Entrada[] = [
  { departamento: 'research', seccion: 'icp' },
  { departamento: 'research', seccion: 'tools', pestana: 'espia', nombre: 'Espía a tus competidores', grupo: 'Radar' },
  { departamento: 'research', seccion: 'tools', pestana: 'scraper', nombre: 'Scraper', grupo: 'Radar' },

  { departamento: 'systems', seccion: 'acquisition' },
  { departamento: 'systems', seccion: 'conversion' },
  { departamento: 'systems', seccion: 'conversation' },

  { departamento: 'marketing', seccion: 'creative' },
  // Bio de Instagram y los dos creadores de guiones, en un solo agente (`NE-47`).
  { departamento: 'marketing', proximamente: true, nombre: 'Copywriter' },
  { departamento: 'marketing', seccion: 'tools', pestana: 'landing', nombre: 'Tu landing', grupo: 'Funnel' },
  { departamento: 'marketing', seccion: 'tools', pestana: 'vsl', nombre: 'Tu VSL', grupo: 'Funnel' },
  // Social Media Posting y el Clon de IA (`NE-47`).
  { departamento: 'marketing', proximamente: true, nombre: 'Content Studio' },

  { departamento: 'sales', seccion: 'sales' },
  // La lista junta de las dos fuentes no existe todavía (`NE-38`).
  { departamento: 'sales', proximamente: true, nombre: 'Todos', grupo: 'Leads' },
  { departamento: 'sales', seccion: 'contacts', nombre: 'De GHL', grupo: 'Leads' },
  { departamento: 'sales', seccion: 'tools', pestana: 'mis-leads', nombre: 'De Radar', grupo: 'Leads' },
  { departamento: 'sales', seccion: 'tools', pestana: 'prospeccion', nombre: 'Plan de prospección', grupo: 'Leads' },
  { departamento: 'sales', seccion: 'setter' },
  { departamento: 'sales', seccion: 'closer' },
  { departamento: 'sales', seccion: 'analizadores', pestana: 'HT', nombre: 'Llamadas de venta' },

  { departamento: 'client-success', seccion: 'analizadores', pestana: 'OB', nombre: 'Llamadas de onboarding' },
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

/**
 * Lo que el engranaje dice de sus destinos (`NE-49`).
 *
 * · `ceja`: la de la cabecera de sus tres pantallas. Es la frase del menú —el engranaje se llama «Menú
 *   de la cuenta»— y no la del diseño, «MENÚ DEL ADMIN»: un `usuario` restringido también puede ver el
 *   Panel de Monitoreo.
 * · `subtitulos`: lo que va debajo del nombre en el menú. Monitoreo e Incidentes no tienen uno escrito:
 *   el suyo dice que sólo se ven desde la organización principal, y lo arma el menú, que tiene la sesión
 *   y sabe si la organización que se está mirando es la principal. Este archivo no mira la organización.
 */
export const CUENTA = {
  ceja: 'MENÚ DE LA CUENTA',
  subtitulos: { credenciales: 'Tokens e integraciones' } as Readonly<Record<string, string>>,
} as const;

/** Un destino del engranaje, listo para el menú y para la cabecera de su pantalla. */
export interface DestinoDelEngranaje {
  seccion: string;
  nombre: string;
  ceja: string;
  subtitulo: string | null;
  /** Si la sección sólo se ve desde la organización principal (`soloDesdeLaPrincipal`, del menú). */
  soloDeLaPrincipal: boolean;
}

/** Lo que una entrada abre: una sección, con su pestaña si la sección se reparte. */
export interface Destino {
  seccion: string;
  pestana: string | null;
}

/** Una sub-pestaña de un grupo, lista para dibujar. */
export type SubVisible = (Destino & { nombre: string }) | { nombre: string; proximamente: true };

/**
 * Una entrada lista para dibujar. La de un grupo lleva sus sub-pestañas en `subs`, y su `seccion` y su
 * `pestana` son las de la primera que abre algo: es lo que abre al tocarla.
 */
export type EntradaVisible =
  | (Destino & { nombre: string; subs?: undefined })
  | (Destino & { nombre: string; subs: SubVisible[] })
  | { nombre: string; proximamente: true };

/** Lo que la barra lateral dibuja (`NE-11`). */
export interface Navegacion {
  /** «Nueva conversación»: el Inicio, o `null` si la persona no lo ve. */
  inicio: { seccion: string; nombre: string } | null;
  departamentos: (Departamento & { entradas: EntradaVisible[] })[];
  engranaje: DestinoDelEngranaje[];
}

/**
 * El menú de `menuVisible()`, repartido en departamentos.
 *
 * Un departamento aparece si tiene al menos una entrada que abre algo; sus «Próximamente» van con
 * él, y nunca solas (`NE-13`). Lo mismo un grupo: aparece si alguna de sus sub-pestañas abre algo, y
 * abre la primera de ésas, nunca una «Próximamente» (`NE-45`). Las entradas conservan el orden de
 * `ENTRADAS`, y los departamentos el de `DEPARTAMENTOS`.
 *
 * @param menu lo que devuelve `menuVisible`, con el alcance ya aplicado. Es la ÚNICA entrada: la
 *   visibilidad no se vuelve a decidir acá.
 */
export function menuPorDepartamentos(
  menu: readonly { secciones: readonly { clave: string; nombre: string; soloDesdeLaPrincipal?: boolean }[] }[],
): Navegacion {
  const visibles = new Map(menu.flatMap((g) => g.secciones.map((s) => [s.clave, s.nombre] as const)));
  const deLaPrincipal = new Set(menu.flatMap((g) => g.secciones.filter((s) => s.soloDesdeLaPrincipal === true).map((s) => s.clave)));
  const ref = (clave: string) => {
    const nombre = visibles.get(clave);
    return nombre === undefined ? null : { seccion: clave, nombre };
  };
  // Una entrada como se dibuja, o `null` si su sección no está en el menú de esta persona.
  const aDibujar = (e: Entrada): SubVisible | null => {
    if ('proximamente' in e) return { nombre: e.nombre, proximamente: true };
    const nombreDeLaSeccion = visibles.get(e.seccion);
    if (nombreDeLaSeccion === undefined) return null;
    return { nombre: e.nombre ?? nombreDeLaSeccion, seccion: e.seccion, pestana: e.pestana ?? null };
  };

  const departamentos = DEPARTAMENTOS.map((d) => {
    // Las sueltas, y cada grupo en el lugar de su primera sub-pestaña.
    const piezas: ({ suelta: SubVisible } | { grupo: string; subs: SubVisible[] })[] = [];
    const grupos = new Map<string, SubVisible[]>();
    for (const e of ENTRADAS) {
      if (e.departamento !== d.clave) continue;
      const visible = aDibujar(e);
      if (visible === null) continue;
      if (e.grupo === undefined) {
        piezas.push({ suelta: visible });
        continue;
      }
      let subs = grupos.get(e.grupo);
      if (!subs) {
        subs = [];
        grupos.set(e.grupo, subs);
        piezas.push({ grupo: e.grupo, subs });
      }
      subs.push(visible);
    }
    const entradas: EntradaVisible[] = piezas.flatMap((p): EntradaVisible[] => {
      if ('suelta' in p) return [p.suelta];
      const abre = p.subs.find((s): s is Destino & { nombre: string } => !('proximamente' in s));
      return abre ? [{ nombre: p.grupo, seccion: abre.seccion, pestana: abre.pestana, subs: p.subs }] : [];
    });
    return { ...d, entradas };
  }).filter((d) => d.entradas.some((e) => !('proximamente' in e)));

  return {
    inicio: ref(FUERA.inicio),
    departamentos,
    engranaje: FUERA.engranaje.flatMap((clave): DestinoDelEngranaje[] => {
      const r = ref(clave);
      if (r === null) return [];
      return [{ ...r, ceja: CUENTA.ceja, subtitulo: CUENTA.subtitulos[clave] ?? null, soloDeLaPrincipal: deLaPrincipal.has(clave) }];
    }),
  };
}

/**
 * Lo que una entrada visible abre: ella misma, o las sub-pestañas de su grupo que abren algo. Lo usa
 * la barra para saber si alguna lleva a Tools, y dónde va el punto de «hay un scraping corriendo»:
 * con la del grupo sola, el punto del Scraper no se vería, porque Radar abre el Espía.
 */
export function queAbre(entrada: EntradaVisible): Destino[] {
  if ('proximamente' in entrada) return [];
  if (!entrada.subs) return [{ seccion: entrada.seccion, pestana: entrada.pestana }];
  return entrada.subs.flatMap((s) => ('proximamente' in s ? [] : [{ seccion: s.seccion, pestana: s.pestana }]));
}

/**
 * La entrada abierta, para marcarla en la barra y abrir su departamento (`NE-11`), o `null`. En un
 * grupo, `nombre` es el del grupo —la entrada de la barra— y `sub`, el de la sub-pestaña abierta; fuera
 * de un grupo, `sub` es `null`.
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
): { departamento: ClaveDeDepartamento; nombre: string; sub: string | null } | null {
  if (seccion === null) return null;
  const esta = (d: Destino) => d.seccion === seccion && (d.pestana === null || d.pestana === pestana);
  for (const d of navegacion.departamentos) {
    for (const e of d.entradas) {
      if ('proximamente' in e) continue;
      if (!e.subs) {
        if (esta(e)) return { departamento: d.clave, nombre: e.nombre, sub: null };
        continue;
      }
      const sub = e.subs.find((s) => !('proximamente' in s) && esta(s));
      if (sub) return { departamento: d.clave, nombre: e.nombre, sub: sub.nombre };
    }
  }
  return null;
}

/** «Sales › Leads › De Radar»: el departamento, el grupo si lo hay, y la entrada. */
const lugar = (e: Entrada, nombreDeLaSeccion: string): string | null => {
  const departamento = DEPARTAMENTOS.find((d) => d.clave === e.departamento);
  return departamento ? [departamento.nombre, e.grupo, e.nombre ?? nombreDeLaSeccion].filter(Boolean).join(' › ') : null;
};

/**
 * Dónde vive una pestaña de una sección repartida, dicho como la navegación —la barra lleva hasta el
 * grupo, y la cabecera, hasta la sub-pestaña—: «Marketing › Funnel › Tu VSL». La usa la barra de pasos
 * de ICP & Oferta para nombrar el paso que vive en Tools
 * (`components/fundaciones/BarraDePasos.jsx`), y lo usan los textos que mandan a los leads del
 * scraper, en vez de escribir el lugar a mano. Es la tabla de `ENTRADAS`, sin la visibilidad de nadie:
 * dice dónde está, no quién lo ve. `null` si no es de ningún departamento.
 */
export function lugarDe(seccion: string, pestana: string): string | null {
  const entrada = ENTRADAS.find((e) => !('proximamente' in e) && e.seccion === seccion && e.pestana === pestana);
  if (!entrada || entrada.nombre === undefined) return null;
  return lugar(entrada, entrada.nombre);
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
      const donde = lugar(e, s.nombre);
      return donde ? [donde] : [];
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

/**
 * Si la casilla de una sección en Ajustes › Usuarios tiene que decir lo que abre: cuando abre más de
 * una entrada («Tools» abre seis), o una sola que en la barra se llama de otra forma —el Leads Portal
 * es Sales › Leads › De GHL, y sin eso la casilla nombraría un lugar que la barra no muestra—. Cuando
 * la barra la llama como a la sección (Sales › Closing), el nombre de la casilla ya lo dice.
 */
export function diceLoQueAbre(seccion: { nombre: string; abre?: readonly string[] }): boolean {
  const abre = seccion.abre ?? [];
  if (abre.length > 1) return true;
  const [unico] = abre;
  return unico !== undefined && !unico.endsWith(` › ${seccion.nombre}`);
}
