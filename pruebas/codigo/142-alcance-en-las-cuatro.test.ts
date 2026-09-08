// Ninguna pantalla del Closer se olvida del alcance. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE GUARDIA EXISTE PORQUE EL DEFECTO YA OCURRIÓ, Y ESTABA ANUNCIADO
//
// `lib/negocio/alcanceDelCloser.ts` escribió el modo de falla antes de que pasara:
//
//   *«Repetir los tres pasos en cada ruta es cómo se llega a que una de las tres se olvide de
//   aplicar el alcance: las otras dos filtran, ésa no, y el closer ve en Contactos los leads que Mi
//   Día le esconde. **No falla nada.**»*
//
// Y pasó: la Agenda —la cuarta pantalla— no lo aplicaba, así que con tres closers vinculados los
// tres veían las citas de los tres. El comportamiento lo cuida `141-agenda-de-quien-mira`; lo que
// ese archivo **no puede** cuidar es la QUINTA pantalla, la que todavía no existe.
//
// ── POR QUÉ UN GUARDIA DE CÓDIGO Y NO UNA PRUEBA MÁS DE COMPORTAMIENTO ─────
//
// Porque una prueba de comportamiento hay que acordarse de escribirla, y el defecto es justamente
// olvidarse. Este archivo falla el día que alguien agregue un `GET` bajo `app/api/closer/` sin
// decidir de quién son los datos que devuelve — y lo obliga a decidir, no a acertar.
//
// Es el mismo argumento que `pruebas/apoyo/autorizados.ts` hace para su lista: una lista explícita
// con su motivo al lado, y todo lo que no está en ella falla hasta que alguien lo mire.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/**
 * El archivo sin sus comentarios.
 *
 * Obligatorio en este repositorio, y van ocho veces: los comentarios CITAN lo que hay que hacer, así
 * que una prueba que lea código fuente y no los saque encuentra su propia explicación y queda verde
 * sobre código roto. El caso más reciente está contado en `140-boton-de-mi-password`.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Los `route.ts` de una carpeta y sus subcarpetas, con la ruta relativa al repositorio. */
function rutasBajo(dir: string): string[] {
  const salida: string[] = [];
  const caminar = (rel: string): void => {
    for (const e of readdirSync(join(RAIZ, rel))) {
      const rutaRel = `${rel}/${e}`;
      if (statSync(join(RAIZ, rutaRel)).isDirectory()) caminar(rutaRel);
      else if (e === 'route.ts') salida.push(rutaRel);
    }
  };
  caminar(dir);
  return salida.sort();
}

/**
 * Las rutas del Closer que devuelven LEADS o CITAS, y por eso tienen que decir de quién son.
 *
 * Se nombran una por una en vez de deducirse, por lo mismo que `agendaDelCloser` recibe el
 * territorio por parámetro: una lista escrita a mano se ve en el diff cuando cambia.
 */
const CON_ALCANCE = [
  'app/api/closer/mi-dia/route.ts',
  'app/api/closer/pipeline/route.ts',
  'app/api/closer/contactos/route.ts',
  'app/api/closer/agenda/route.ts',
];

/**
 * Las que NO llevan alcance, cada una con su motivo. **Ninguna es un `GET` de lista.**
 *
 *   · `agenda/refrescar` — un `POST` que trae el calendario de GoHighLevel y ESCRIBE en
 *     `negocio.citas`. Recorta lo que se guarda por territorio, no por closer: si cada uno trajera
 *     solo sus citas, la caché de la empresa dependería de quién apretó el botón último.
 *   · `meta` — un `PATCH` sobre la meta de comisión de quien la fija. No devuelve leads.
 */
const SIN_ALCANCE: Record<string, string> = {
  'app/api/closer/agenda/refrescar/route.ts': 'POST que escribe la caché de citas de la empresa',
  'app/api/closer/meta/route.ts': 'PATCH de la meta propia; no devuelve leads',
};

test('las CUATRO pantallas del Closer resuelven el alcance con la misma función', () => {
  for (const ruta of CON_ALCANCE) {
    const src = sinComentarios(leer(ruta));
    assert.match(
      src,
      /alcanceDeQuienMira\s*\(/,
      `\`${ruta}\` no resuelve el alcance: las otras filtran, ésta no, y el closer ve en una ` +
        'pantalla los leads que la otra le esconde. No falla nada.',
    );
    /* Y lo RESUELVE no alcanza: hay que pasárselo a la consulta. Una llamada cuyo resultado se
       descarta compila, pasa el guardia anterior, y devuelve exactamente lo que devolvía antes. */
    assert.match(
      src,
      /\balcance\b/,
      `\`${ruta}\` resuelve el alcance y no lo usa: la consulta sigue trayendo el territorio entero`,
    );
    // Y atiende «ver como», que es lo que hace que el selector de Inicio no mienta en una pestaña.
    assert.match(
      src,
      /verComoDeLaUrl\s*\(/,
      `\`${ruta}\` ignora «ver como»: quien administra elige un closer y esta pantalla le sigue ` +
        'mostrando la empresa entera, sin decir que dejó de obedecer al selector',
    );
  }
});

test('no hay una QUINTA pantalla del Closer sin decidir de quién son sus datos', () => {
  /* La mitad que mira al futuro. Sin esto, el archivo entero es una foto de hoy: cuida las cuatro
     que ya existen y no dice nada de la que se agregue mañana — que es el defecto que ya ocurrió,
     con la Agenda, cuando había tres. */
  const todas = rutasBajo('app/api/closer');
  assert.ok(todas.length >= CON_ALCANCE.length, 'no se encontraron las rutas del Closer');

  for (const ruta of todas) {
    if (CON_ALCANCE.includes(ruta)) continue;
    const motivo = SIN_ALCANCE[ruta];
    assert.ok(
      motivo,
      `\`${ruta}\` es una ruta nueva del Closer y nadie decidió de quién son sus datos. Si devuelve ` +
        'leads o citas, agregala a `CON_ALCANCE` y resolvé el alcance en la ruta. Si no, agregala a ' +
        '`SIN_ALCANCE` con el motivo escrito.',
    );

    /* Y la exención tiene que seguir siendo cierta: si una de esas dos gana un `GET`, pasa a ser
       una vitrina y el motivo escrito deja de aplicar. */
    const src = sinComentarios(leer(ruta));
    assert.ok(
      !/export\s+async\s+function\s+GET\b/.test(src),
      `\`${ruta}\` está exento del alcance por «${motivo}», y ahora exporta un GET: una lectura ` +
        'del Closer sin alcance devuelve los leads de todos',
    );
  }
});

test('la Agenda corta por asignación en SUS TRES consultas, no solo en la lista', () => {
  /* Son tres: la lista, y los dos conteos que explican un cero —«quedaron 12 citas de días
     anteriores» y «hay 3 citas más adelante»—. Los dos conteos ya tenían este cuidado por
     territorio, con el motivo escrito ahí: *«explicar un cero con un número de otra pantalla»*.

     Un conteo sin cortar no rompe ninguna lista: deja un mensaje correcto con un número ajeno, que
     manda a esa persona a buscar citas que su Agenda no le va a mostrar nunca. */
  const src = sinComentarios(leer('lib/negocio/agenda.ts'));
  const cortes = (src.match(/crm_asignado_a/g) ?? []).length;
  assert.equal(
    cortes,
    3,
    `\`agenda.ts\` corta por asignación en ${cortes} consultas y tiene TRES que lo necesitan: la ` +
      'lista y los dos conteos que explican un cero',
  );
});

test('el selector «ver como» viaja a las sub-pestañas que lo obedecen', () => {
  /* Antes lo mandaba solo Mi Día. Las cuatro rutas lo atendían, así que quien administra elegía a
     un closer, veía su día, cambiaba de sub-pestaña y el Pipeline y la Agenda volvían a la empresa
     entera — con el nombre elegido todavía anunciado arriba. */
  const vista = sinComentarios(leer('components/views/CloserView.jsx'));

  assert.match(
    vista,
    /<Agenda[^>]*verComo=/,
    'la Agenda no recibe «ver como»: el selector la deja mostrando la empresa entera',
  );
  assert.match(
    vista,
    /<Pipeline[\s\S]{0,200}?conVerComo\(/,
    'el Pipeline no recibe «ver como»: mismo defecto, otra sub-pestaña',
  );

  /* Y la Agenda lo mete DENTRO del camino que lee, porque el camino es la clave de `usarLectura`:
     afuera, cambiar de closer devolvería en el primer dibujo la agenda guardada del anterior. */
  const agenda = sinComentarios(leer('components/closer/Agenda.jsx'));
  assert.match(
    agenda,
    /usarLectura\(\s*[\s\S]{0,300}?verComo/,
    'la Agenda recibe «ver como» y no lo manda en el camino que lee, o lo manda fuera de la clave',
  );
});
