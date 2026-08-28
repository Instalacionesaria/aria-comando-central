// Comisiones: se fue de Ajustes al cockpit, y la autorización NO se movió con ella. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// MOVER UN BOTÓN ES LA FORMA MÁS BARATA DE ENSANCHAR UN PERMISO SIN QUERER
//
// Los porcentajes de comisión eran la cuarta pestaña de Ajustes y ahora son una ventana en
// Closer → Inicio. El riesgo del cambió no es visual: es que la operación **cambie de dueño**.
//
// El camino tentador era poner `PANTALLA = 'closer'` en el endpoint, porque ahí vive el botón ahora.
// Eso obliga —por `ADR-0304`, que compara los GET de una misma pantalla— a que su `GET` pida
// `closer.ver` como los otros cinco. Y ese `GET` devuelve **cuánto cobra cada persona del equipo**:
// con `closer.ver` cualquier closer vería el porcentaje de todos sus compañeros.
//
// Así que la pantalla del endpoint sigue siendo `credenciales`, y estas pruebas son lo que impide
// que alguien «acomode» ese marcador para que la ruta combine con el lugar del botón.
//
// La otra mitad: un botón que se ve y da 403 es el `07` § 4. La visibilidad la decide el SERVIDOR con
// la condición exacta del endpoint, no un `if` por nombre de rol — que es lo que `ADR-0302` prohíbe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');
const hay = (r: string) => existsSync(new URL(r, RAIZ));

/** Un archivo sin comentarios: los comentarios CUENTAN la historia y nombran lo que ya no existe. */
function codigo(fuente: string): string {
  return fuente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('Ajustes tiene EXACTAMENTE tres pestañas, y ninguna es Comisiones', () => {
  // Lo que se pidió, y el criterio que lo sostiene: Ajustes configura la EMPRESA —sus credenciales,
  // sus empresas, su gente—. Los porcentajes configuran a las personas de un equipo, así que se
  // fueron con el equipo.
  const vista = leer('components/views/AjustesView.jsx');
  const claves = [...codigo(vista).matchAll(/\{\s*clave:\s*'([a-z]+)'/g)].map((m) => m[1]!);
  assert.deepEqual(claves, ['credenciales', 'empresas', 'usuarios'], 'las pestañas de Ajustes cambiaron');
  assert.ok(!codigo(vista).includes('Comisiones'), 'Ajustes volvió a dibujar Comisiones');
});

test('la configuración del closer vive en el Closer, y el panel de EQUIPO ya no existe', () => {
  // Dos archivos con el mismo formulario es la forma de que uno quede viejo y nadie sepa cual manda.
  assert.ok(
    !hay('components/ajustes/Comisiones.jsx'),
    'quedó el componente viejo en `components/ajustes/`: se movió, no se copió',
  );

  // ── Y EL PANEL DE EQUIPO SE FUE, QUE ES EL CAMBIO ─────────────────────────
  //
  // `PorcentajesDelEquipo.jsx` listaba a TODA la empresa con un campo de porcentaje cada una. Tenia
  // sentido con un equipo de closers; con la regla nueva —una organizacion tiene UN closer
  // designado— esa lista invita al defecto que la migración 015 describe: cargarle un porcentaje a
  // alguien que no es el closer produce una fila que no se usa en ninguna pantalla, y que el día que
  // esa persona sea designada aparece de golpe como si se hubiera decidido hoy.
  assert.ok(
    !hay('components/closer/PorcentajesDelEquipo.jsx'),
    'volvió el panel de porcentajes del equipo: con un único closer designado, esa lista deja ' +
      'cargar porcentajes que no se ven en ninguna parte',
  );
  assert.ok(hay('components/closer/QuienEsElCloser.jsx'), 'falta el panel que designa al closer');

  // Nadie lo importa, ni desde la ruta vieja ni desde la nueva.
  for (const archivo of [
    'components/views/AjustesView.jsx',
    'components/closer/Comision.jsx',
    'components/closer/Inicio.jsx',
  ]) {
    const c = codigo(leer(archivo));
    assert.ok(!c.includes('ajustes/Comisiones'), `${archivo} importa el componente desde su ruta vieja`);
    assert.ok(
      !c.includes('PorcentajesDelEquipo'),
      `${archivo} sigue importando el panel de equipo, que ya no existe: el build se rompe`,
    );
  }
});

test('queda UNA ventana —la meta— y la configuración del closer va en línea', () => {
  const comision = leer('components/closer/Comision.jsx');
  const c = codigo(comision);
  assert.match(c, /import Ventana from '\.\.\/Ventana\.jsx'/, 'no usa el modal del proyecto');

  // ── DE DOS VENTANAS A UNA, Y POR QUE ──────────────────────────────────────
  //
  // Eran dos: la meta propia y los porcentajes del equipo. La segunda se fue con el panel de equipo.
  //
  // Y lo que la reemplaza NO es una ventana: el panel que designa al closer va EN LINEA en Inicio.
  // El argumento a favor de la ventana era «quien cambia un porcentaje quiere ver el número que
  // produce», y una ventana lo tapaba menos que una pestaña. Con el panel en línea no hay nada que
  // tapar: el cockpit queda arriba y la configuración abajo, las dos a la vista.
  assert.equal(
    [...c.matchAll(/<Ventana\b/g)].length,
    1,
    'tendría que quedar UNA sola ventana: la meta propia',
  );

  const inicio = codigo(leer('components/closer/Inicio.jsx'));
  assert.match(inicio, /<QuienEsElCloser\b/, 'Inicio no dibuja el panel que designa al closer');
  assert.ok(
    !codigo(leer('components/closer/QuienEsElCloser.jsx')).includes('<Ventana'),
    'el panel del closer se volvió una ventana: va en línea, para que el cockpit quede a la vista',
  );

  // Y EL COMENTARIO VIEJO NO PUEDE SEGUIR AHI. Decía «en línea y no un modal», o sea lo contrario de
  // lo que el archivo hace ahora. Un comentario que afirma lo opuesto al codigo es peor que ninguno:
  // se lee con confianza.
  assert.ok(
    !/En línea y no un modal: el cockpit/.test(comision),
    'quedó el comentario que defiende lo contrario de lo que el archivo hace',
  );
});

test('mover el botón NO movió la autorización', () => {
  // El corazón del asunto. Ver el encabezado: con `PANTALLA = 'closer'`, `ADR-0304` obligaría a que
  // el GET pida `closer.ver`, y ese GET trae lo que cobra cada persona del equipo.
  const ruta = leer('app/api/admin/comisiones/route.ts');
  assert.match(ruta, /export const PANTALLA = 'credenciales';/, 'el endpoint cambió de pantalla');
  assert.match(ruta, /exigir\(peticion, \['credenciales\.ver'\], PANTALLA\)/, 'el GET cambió de capacidad');
  assert.match(ruta, /exigir\(peticion, \['credenciales\.editar'\], PANTALLA\)/, 'el PUT cambió de capacidad');
});

test('la visibilidad la decide el SERVIDOR, y son DOS permisos distintos', () => {
  // `ADR-0302`: nunca un `if` por nombre de rol. Y `07` § 4: no mostrar un control que no puede
  // cumplir. Las dos cosas se resuelven igual — el servidor responde el booleano con la condición
  // EXACTA del endpoint.
  const sesion = leer('app/api/auth/sesion/route.ts');
  assert.match(
    sesion,
    /puedeConfigurarComisiones: contexto\.permisos\.has\('credenciales\.editar'\)/,
    'la sesion no responde quien puede configurar, o lo responde con otra condición que el endpoint',
  );

  // ── Y AHORA SON DOS, QUE ANTES ESTABAN COLAPSADOS EN UNO ──────────────────
  //
  //   · `puedeConfigurarComisiones` → designar al closer y fijar SU PORCENTAJE. Es de quien
  //     administra, y es una condición de trabajo.
  //   · `soyElCloser` → fijar LA META. Es de la persona: dice cuanto QUIERE cobrar este mes.
  //
  // Separarlos no es prolijidad. El anillo ahora muestra siempre al closer designado —el cockpit
  // tiene un sujeto— así que con un solo permiso un administrador que abriera la pantalla veria
  // «Fijar mi meta» y estaria escribiendo la meta de otra persona. El «mi» del rótulo era verdad
  // cuando el anillo era de quien miraba.
  const inicio = codigo(leer('components/closer/Inicio.jsx'));
  assert.match(
    inicio,
    /puedeConfigurarComisiones \? <QuienEsElCloser/,
    'el panel de configuración no depende de lo que dice el servidor',
  );

  const comision = codigo(leer('components/closer/Comision.jsx'));
  assert.match(comision, /soyElCloser \?/, 'el boton de la meta no depende de quien es el closer');
  assert.ok(
    !comision.includes('puedeConfigurarPorcentajes'),
    'el boton de la meta sigue atado al permiso de administrar: eso deja que un administrador ' +
      'escriba la meta de otra persona',
  );
  // Y que el servidor lo responda, en vez de que la pantalla compare identificadores.
  const ruta = leer('app/api/closer/mi-dia/route.ts');
  assert.match(
    ruta,
    /soyElCloser: closer !== null && closer\.usuarioId === contexto\.usuarioId/,
    'el servidor dejo de responder si quien mira es el closer',
  );

  // NO por nombre de rol, en ninguna de sus formas, y ahora también en el panel nuevo.
  for (const archivo of ['components/closer/Comision.jsx', 'components/closer/QuienEsElCloser.jsx']) {
    const c = codigo(leer(archivo));
    for (const rol of ['administrador', 'superadministrador', 'usuario']) {
      for (const patron of [
        new RegExp(`===\\s*['\"\`]${rol}['\"\`]`),
        new RegExp(`\\[\\s*['\"\`]${rol}['\"\`]`),
        new RegExp(`includes\\(\\s*['\"\`]${rol}['\"\`]`),
      ]) {
        assert.doesNotMatch(c, patron, `${archivo} decide por el nombre del rol «${rol}»`);
      }
    }
  }
});

test('el aviso de «nadie puede ser closer» tiene un texto POR MOTIVO, y el motivo lo trae el servidor', () => {
  // ══════════════════════════════════════════════════════════════════════
  // UN AVISO QUE NOMBRA LA ACCIÓN EQUIVOCADA ES PEOR QUE NINGUNO
  //
  // Había UN texto para los cuatro motivos: *«hay que darle a alguien la pestaña Closer desde Ajustes
  // → Usuarios»*. Medido en producción el 2026-08-28: los tres usuarios que existen son
  // administradores y **los tres ya tienen la pestaña Closer**. El aviso mandaba a una pantalla donde
  // no había nada que cambiar, sin dar ningún error.
  //
  // Esta prueba es de FORMA porque el defecto es de forma: el comportamiento —que el servidor mida
  // bien el motivo— lo cubre `pruebas/base/31-closer-asignado.test.ts`. Lo que se fija acá es que la
  // pantalla ELIJA por ese motivo en vez de tener una cadena sola, que es a lo que se vuelve por
  // descuido cuando alguien «simplifica» el componente.
  // ══════════════════════════════════════════════════════════════════════
  const panel = codigo(leer('components/closer/QuienEsElCloser.jsx'));

  // 1 · Los CUATRO motivos tienen su texto. Los cuatro, y no tres: el que falte es el que sale como
  //     reserva el día que ocurra, y ahí vuelve el defecto en silencio.
  for (const motivo of ['sin_gente', 'todos_admin', 'sin_capacidad', 'sin_seccion']) {
    assert.match(
      panel,
      new RegExp(`\\b${motivo}\\b`),
      `el panel no tiene texto para el motivo «${motivo}»: va a caer al de reserva, que nombra otra acción`,
    );
  }

  // 2 · Y el aviso ELIGE por el motivo. Sin esta línea, los cuatro textos podrían estar declarados y
  //     el aviso seguir dibujando uno fijo — que es exactamente el estado anterior, con más código.
  assert.match(
    panel,
    /SIN_CANDIDATOS\[porqueNinguno\]/,
    'el aviso no elige el texto por el motivo: cuatro textos declarados y uno dibujado es el mismo ' +
      'defecto con más líneas',
  );

  // 3 · El motivo lo TRAE el servidor y no se deduce en la pantalla. Deducirlo acá exigiría que el
  //     navegador supiera quién tiene `credenciales.editar`, que es una tabla de identidad que no ve.
  assert.match(panel, /datos\.porqueNinguno/, 'la pantalla dejó de leer el motivo de la respuesta');
  assert.match(
    codigo(leer('app/api/admin/closer/route.ts')),
    /porqueNinguno/,
    'el endpoint dejó de responder por qué la lista está vacía',
  );

  // 4 · Y el motivo se DECIDE en un solo lugar: el módulo de negocio. Dos lugares que cuenten
  //     descartes son dos criterios que se van a separar.
  assert.match(
    codigo(leer('lib/negocio/closer.ts')),
    /export type PorqueNingunCandidato/,
    'el catálogo de motivos dejó de estar declarado en el módulo que los mide',
  );
});

test('designar a otro closer RECARGA el cockpit, y no borra la comisión', () => {
  // ── EL MISMO DEFECTO QUE ANTES, EN SU FORMA NUEVA Y MAS GRAVE ─────────────
  //
  // Antes: cerrar la ventana de porcentajes tenia que recargar, porque si alguien cambiaba SU propio
  // porcentaje el anillo mostraría el número viejo.
  //
  // Ahora es peor si falta: al designar a otra persona, TODO el cockpit pasa a ser de otra gente
  // —cobrado, ventas, acuerdos, comisión—. Sin recargar, la pantalla sigue mostrando los números
  // del closer ANTERIOR bajo el nombre del nuevo. No falla, y es una atribución equivocada de plata.
  const panel = codigo(leer('components/closer/QuienEsElCloser.jsx'));

  /* ── SE MIRA EL CUERPO DE `designar`, NO EL ARCHIVO ENTERO ─────────────────
   *
   * La primera versión buscaba `alCambiar?.()` en cualquier parte del archivo, y una mutación la
   * sobrevivió: al sacar la llamada de `designar` la prueba seguía verde, porque `guardarPorcentaje`
   * tiene la suya y el archivo la contenía igual.
   *
   * O sea que la aserción comprobaba «alguien avisa» cuando lo que importa es «avisa el que cambia de
   * persona» — que es el caso grave: al designar a otro, TODO el cockpit pasa a ser de otra gente. */
  const cuerpoDeDesignar = (() => {
    const i = panel.indexOf('const designar = useCallback(');
    assert.ok(i >= 0, 'el panel dejó de tener la función que designa');
    return panel.slice(i, panel.indexOf('[absorber, alCambiar],', i));
  })();
  assert.match(
    cuerpoDeDesignar,
    /alCambiar\?\.\(\)/,
    'designar no avisa hacia arriba: el cockpit sigue mostrando los números del closer ANTERIOR ' +
      'bajo el nombre del nuevo',
  );
  // Y el otro camino también: cambiar el PORCENTAJE cambia la comisión que el anillo dibuja.
  assert.equal(
    [...panel.matchAll(/alCambiar\?\.\(\)/g)].length,
    2,
    'tendrían que ser DOS avisos: uno al designar y uno al guardar el porcentaje',
  );

  const inicio = codigo(leer('components/closer/Inicio.jsx'));
  assert.match(
    inicio,
    /<QuienEsElCloser alCambiar=\{alRecargar\}/,
    'Inicio no conecta el aviso del panel con la recarga del cockpit',
  );

  // Y sigue siendo una RECARGA, no `alGuardar(null)`: esa devolución PISA la comisión con lo que
  // recibe, así que un `null` la borraría de la pantalla en vez de refrescarla.
  const c = codigo(leer('components/closer/Comision.jsx'));
  assert.ok(
    !/alGuardar\?\.\(null\)/.test(c),
    'se recarga llamando `alGuardar(null)`: esa devolución PISA la comisión, así que la borraría',
  );

  const vista = codigo(leer('components/views/CloserView.jsx'));
  assert.match(vista, /alRecargar=\{\(\) => void cargar\(\)\}/, 'CloserView no pasa la recarga');
  assert.match(
    vista,
    /puedeConfigurarComisiones=\{sesion\?\.puedeConfigurarComisiones \?\? false\}/,
    'CloserView no pasa el permiso que responde el servidor',
  );
});

test('la designación NO ensancha la autorización, y un administrador no puede ser closer', () => {
  // ── LA MITAD DE SEGURIDAD DE TODO ESTO ────────────────────────────────────
  //
  // El endpoint que designa vive detras de un boton del cockpit del closer, igual que el de los
  // porcentajes. Y por el mismo motivo su pantalla NO es `closer`: con `PANTALLA = 'closer'`,
  // `ADR-0304` obligaría a que su GET pidiera `closer.ver`, y ese GET devuelve la lista de
  // compañeros con lo que cobra cada uno.
  const ruta = leer('app/api/admin/closer/route.ts');
  assert.match(ruta, /export const PANTALLA = 'credenciales';/, 'el endpoint del closer cambio de pantalla');
  assert.match(ruta, /exigir\(peticion, \['credenciales\.ver'\], PANTALLA\)/, 'el GET cambio de capacidad');
  assert.equal(
    [...ruta.matchAll(/exigir\(peticion, \['credenciales\.editar'\], PANTALLA\)/g)].length,
    2,
    'las dos escrituras —designar y quitar— tienen que pedir `credenciales.editar`',
  );

  // ── Y LA COMPROBACION QUE NO SE PUEDE SALTEAR ─────────────────────────────
  //
  // Que el identificador este EN LA LISTA de candidatos, no que exista. Sin esto, un administrador
  // manda su PROPIO identificador en el cuerpo y queda designado closer: el desplegable no lo
  // ofrece, y el desplegable es una pantalla.
  assert.match(
    codigo(ruta),
    /candidatosAlCloser[\s\S]{0,400}?some\(\(k\) => k\.usuarioId === objetivo\)/,
    'el PUT no comprueba que la persona pueda SER closer: comprobar que existe no alcanza, porque ' +
      'un administrador existe',
  );

  // La regla se escribe con una CAPACIDAD y no con un nombre de rol —`ADR-0302`—, y la capacidad
  // elegida es la misma que habilita designar: quien puede designar no puede ser designado.
  const modulo = leer('lib/negocio/closer.ts');
  assert.match(modulo, /CAPACIDAD_QUE_EXCLUYE = 'credenciales\.editar'/, 'cambio la regla de exclusion');
  const cod = codigo(modulo);
  for (const rol of ['administrador', 'superadministrador']) {
    assert.ok(
      !new RegExp(`['\"\`]${rol}['\"\`]`).test(cod),
      `\`lib/negocio/closer.ts\` compara el nombre del rol «${rol}»: funciona hoy y miente el día ` +
        'que exista un segundo rol que administre la empresa',
    );
  }
});

test('el anillo NO revienta cuando no hay closer asignado, que es el estado de TODAS hoy', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTE DEFECTO ESTUVO A PUNTO DE SALIR, Y HABRÍA CAÍDO LA PESTAÑA ENTERA
  //
  // Cuando «closer» pasó a ser una designación, `/api/closer/mi-dia` empezó a devolver
  // `comision: null` si nadie está designado — y eso es correcto: una comisión en cero afirmaría que
  // esa persona no cobra nada, cuando lo que pasa es que no hay a quién calculársela.
  //
  // Pero `Comision.jsx` hacía `const k = comision` y tres líneas después `k.valor`. Con `null` eso es
  // un `TypeError` que se lleva la pantalla, y **ninguna organización tiene closer asignado hasta que
  // alguien lo elija**: la pestaña se habría caído para todo el mundo en el primer despliegue.
  //
  // Se comprueba el ORDEN, que es lo que importa: el corte tiene que estar ANTES de la primera
  // desreferencia. Comprobar solo que el `if` existe pasaría igual si estuviera debajo.
  // ═══════════════════════════════════════════════════════════════════════════
  const c = codigo(leer('components/closer/Comision.jsx'));

  const corte = c.indexOf('if (!comision)');
  assert.ok(
    corte >= 0,
    'el anillo dejó de cortar cuando no hay comisión: con `comision: null` —el estado de una empresa ' +
      'sin closer asignado— la pantalla revienta con un TypeError',
  );

  const primeraDesreferencia = c.indexOf('const k = comision');
  assert.ok(primeraDesreferencia >= 0, 'cambió la forma en que el anillo lee la comisión');
  assert.ok(
    corte < primeraDesreferencia,
    'el corte por comisión ausente quedó DESPUÉS de la desreferencia: no protege nada',
  );

  // Y el estado dice qué falta y quién lo resuelve, que es la regla de todos los vacíos del cockpit.
  const cuerpo = c.slice(corte, c.indexOf('const k = comision'));
  assert.match(cuerpo, /SIN CLOSER/, 'el estado vacío no dice que lo que falta es el closer');
  assert.ok(
    !/\$0|>0</.test(cuerpo),
    'el estado sin closer dibuja un cero: eso afirma que no cobró nada, y lo que pasa es que nadie ' +
      'eligió de quién son los números',
  );
});
