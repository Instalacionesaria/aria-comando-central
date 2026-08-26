// `vercel.json`, el mapa de horarios y la ruta del cron: que digan lo mismo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS TRES FORMAS DE APAGAR EL CRON SIN QUE NADA SE PONGA ROJO
//
// Un cron mal configurado no falla: **no corre**. No hay excepción, no hay error de compilación, no
// hay línea en ningún registro, y el síntoma aparece días después como «el chat tiene atraso». De
// las tres maneras de llegar ahí, ésta es la única prueba que existe:
//
//   1 · **Renombrar el manejador a POST.** Vercel dispara con GET y no se puede elegir; un POST
//       recibe 405 y el cron queda apagado para siempre. Nada más en el repositorio lo detecta.
//   2 · **Cambiar el horario en `vercel.json` y no tocar `HORARIOS`.** El cron dispara, la ruta
//       responde 200 y no hace ninguna tarea — indistinguible de una corrida sin trabajo pendiente.
//   3 · **Mover el camino de la ruta.** `vercel.json` apuntaría a un 404, y un 404 en una tarea
//       programada tampoco se lo cuenta a nadie.
//
// Y una cuarta que sí tiene dueño en otra prueba: comparar el secreto con `!==`. Eso lo ata
// `ADR-0301` en `30-portero.test.ts`, que exige `timingSafeEqual` en toda ruta con secreto propio.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { HORARIOS, tareasDelHorario, type Tarea } from '../../lib/negocio/barrido.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (ruta: string) => readFileSync(new URL(ruta, RAIZ), 'utf8');

interface Cron {
  path: string;
  schedule: string;
}

function configuracion(): { crons?: Cron[]; functions?: unknown } {
  return JSON.parse(leer('vercel.json')) as { crons?: Cron[]; functions?: unknown };
}

// ─── 1 · El camino existe y responde al método que Vercel usa ───────────────

test('cada `path` de los crons es una ruta que existe y exporta GET', () => {
  const crons = configuracion().crons ?? [];
  assert.ok(crons.length > 0, 'no hay ningún cron declarado: el bucle pasaría en vacío');

  for (const c of crons) {
    const archivo = `app${c.path}/route.ts`;
    assert.ok(existsSync(new URL(archivo, RAIZ)), `${c.path} no tiene manejador: ${archivo}`);

    const fuente = leer(archivo);
    assert.match(
      fuente,
      /export\s+async\s+function\s+GET\s*\(/,
      `${archivo} no exporta GET. Vercel dispara los cron con GET y NO se puede elegir: un POST ` +
        'recibe 405 y el cron no corre nunca, sin ningún error en ninguna parte.',
    );
  }
});

test('la ruta del cron NO exporta ningún método que modifique', () => {
  // Un POST/PATCH acá sería una segunda puerta al mismo trabajo, y la que Vercel no usa. Peor: el
  // día que alguien renombre el GET a POST «para respetar que escribe», el cron se apaga y esta
  // prueba es lo único que lo dice.
  const fuente = leer('app/api/cron/route.ts');
  for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.doesNotMatch(
      fuente,
      new RegExp(`export\\s+async\\s+function\\s+${metodo}\\s*\\(`),
      `app/api/cron/route.ts exporta ${metodo}: el cron solo usa GET`,
    );
  }
});

// ─── 2 · Los dos lados del horario, en las DOS direcciones ──────────────────

test('cada horario de `vercel.json` tiene entrada en `HORARIOS`', () => {
  const crons = configuracion().crons ?? [];
  const declarados = Object.keys(HORARIOS);
  for (const c of crons) {
    assert.ok(
      declarados.includes(c.schedule),
      `el horario «${c.schedule}» de vercel.json no está en HORARIOS. El cron dispararía y no ` +
        'haría ninguna tarea: 200, sin trabajo, sin error.',
    );
  }
});

test('cada entrada de `HORARIOS` está en `vercel.json`', () => {
  // La dirección inversa, y hace falta: una entrada huérfana en el mapa es una tarea que alguien
  // creyó programada y que nadie dispara nunca.
  const horarios = (configuracion().crons ?? []).map((c) => c.schedule);
  for (const clave of Object.keys(HORARIOS)) {
    assert.ok(
      horarios.includes(clave),
      `HORARIOS tiene «${clave}» y vercel.json no lo declara: esas tareas no las dispara nadie`,
    );
  }
});

test('el umbral de atraso es al menos dos cadencias más una hora', () => {
  // El `2 ×` es porque **no hay reintentos**: perder una corrida es normal y no tiene que gritar;
  // perder dos seguidas sí. El `+60` es la imprecisión de ±59 minutos del plan Hobby.
  //
  // Con el umbral igual a la cadencia, la pantalla avisaría de un atraso todos los días — y un aviso
  // que aparece siempre es un aviso que se aprende a ignorar.
  const entradas = Object.entries(HORARIOS);
  assert.ok(entradas.length > 0);
  for (const [clave, v] of entradas) {
    assert.ok(
      v.umbralMinutos >= 2 * v.cadenciaMinutos + 60,
      `«${clave}»: umbral ${v.umbralMinutos} < 2 × ${v.cadenciaMinutos} + 60`,
    );
  }
});

test('toda tarea nombrada en `HORARIOS` es una de las tres que el barrido sabe hacer', () => {
  const conocidas: Tarea[] = ['sonda', 'mensajes', 'citas'];
  for (const [clave, v] of Object.entries(HORARIOS)) {
    for (const t of v.tareas) {
      assert.ok(conocidas.includes(t), `«${clave}» nombra la tarea «${t}», que no existe`);
    }
  }
});

// ─── 3 · Un horario desconocido corre TODO, nunca nada ──────────────────────

test('un horario ausente o desconocido corre TODAS las tareas y lo dice', () => {
  // Es lo contrario de lo que parece prudente, y es a propósito. Un horario que no está en el mapa
  // es un error de configuración; no hacer nada lo convertiría en un cron que dispara, responde 200
  // y no trabaja — o sea indistinguible de uno que funciona. `ADR-0305`: rechazo no es vacío.
  for (const raro of [null, '', '0 4 * * *', 'cualquier cosa']) {
    const r = tareasDelHorario(raro);
    assert.equal(r.desconocido, true, `«${raro}» tendría que ser desconocido`);
    assert.deepEqual([...r.tareas].sort(), ['citas', 'mensajes', 'sonda']);
  }

  // Y un horario conocido corre exactamente lo suyo.
  const clave = Object.keys(HORARIOS)[0]!;
  const conocido = tareasDelHorario(clave);
  assert.equal(conocido.desconocido, false);
  assert.deepEqual(
    [...conocido.tareas],
    [...(HORARIOS as Record<string, { tareas: readonly Tarea[] }>)[clave]!.tareas],
  );
});

// ─── 4 · Una sola fuente para el límite de duración ─────────────────────────

test('`maxDuration` vive en la ruta y NO en `vercel.json`', () => {
  // Dos fuentes para el mismo límite es la clase de divergencia que nadie encuentra: el archivo dice
  // 300, la configuración dice 60, y la corrida se corta a los 60 sin que ninguna de las dos mienta.
  assert.equal(
    configuracion().functions,
    undefined,
    'vercel.json declara `functions`: el límite de duración se declara en la ruta, y en un solo lado',
  );
  assert.match(
    leer('app/api/cron/route.ts'),
    /export\s+const\s+maxDuration\s*=\s*\d+/,
    'la ruta del cron no declara maxDuration',
  );
});

// ─── 5 · La ruta va bajo /api/, y no es prolijidad ─────────────────────────

test('el camino del cron empieza con `/api/`, que es lo único que el proxy no redirige', () => {
  // `proxy.ts` excluye `api(?:/|$)` y nada más: cualquier otro camino recibe un 307 a `/entrar`. Y
  // una respuesta 3xx hace que Vercel dé la corrida por terminada **y que no aparezca en los
  // registros**. O sea: cron apagado, sin trabajo y sin rastro.
  for (const c of configuracion().crons ?? []) {
    assert.match(c.path, /^\/api\//, `el camino «${c.path}» no está bajo /api/`);
  }
});
