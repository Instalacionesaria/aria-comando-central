// Las ventanas emergentes de los formularios de alta. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE, Y POR QUÉ NO ES UNA PRUEBA DE ESTÉTICA
//
// Se pidió que los formularios de crear empresa y agregar usuario aparecieran al apretar el
// botón, en vez de estar siempre en pantalla. Mover un formulario a una ventana es cosmético.
// **Lo que no es cosmético es lo que la ventana puede destruir.**
//
// `POST /api/admin/usuarios` devuelve la contraseña temporal **una sola vez**: el servidor no la
// guarda en claro y no existe forma de volver a verla — solo de restablecerla. Mientras el
// formulario era una tarjeta fija, la contraseña se quedaba en pantalla hasta que alguien
// navegara. Adentro de una ventana, el gesto más natural del mundo —un Escape, un clic afuera—
// la borra para siempre, sin preguntar y sin que nada falle.
//
// Así que las aserciones que importan acá son dos:
//
//   · La ventana **respeta** `cerrablePorFuera`, en las DOS vías de cierre accidental (Escape y
//     el clic en el fondo). Una sola de las dos alcanza para perder la contraseña.
//   · Usuarios **la usa** mientras la temporal está en pantalla.
//
// Y una tercera, más humilde: que las cuatro cosas que hacen que una ventana no esté rota
// —foco que entra y vuelve, trampa del tabulador, Escape, fondo que no se desplaza— sigan ahí.
// Es una comprobación de presencia, no de comportamiento: no hay DOM en esta suite. Lo que
// detecta es la eliminación, que es el modo de falla real —«esto no hace falta»— no un error
// sutil de implementación. Eso se verificó en el navegador.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';

/** Sin comentarios: lo que se afirma tiene que estar en el CÓDIGO, no en su explicación. */
function fuente(ruta: string): string {
  const a = archivosFuente(['components']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

test('la ventana respeta `cerrablePorFuera` en las DOS vías de cierre accidental', () => {
  const v = fuente('components/Ventana.jsx');

  /* Escape. Se busca que la rama del Escape mencione la bandera: sin el guardia, la tecla cierra
     siempre y la contraseña temporal se va con ella. */
  const escape = v.slice(v.indexOf("'Escape'"), v.indexOf("'Tab'"));
  assert.ok(escape.length > 0, 'no se encontró el manejo de Escape');
  assert.ok(
    /cerrablePorFuera/.test(escape),
    'Escape cierra la ventana SIN mirar `cerrablePorFuera`: se pierde la contraseña temporal',
  );

  /* El clic en el fondo. Misma consecuencia, otra vía. */
  const scrim = v.slice(v.indexOf('scrim'), v.indexOf('className="vt"'));
  assert.ok(scrim.length > 0, 'no se encontró el fondo de la ventana');
  assert.ok(
    /cerrablePorFuera/.test(scrim),
    'el clic en el fondo cierra SIN mirar `cerrablePorFuera`: se pierde la contraseña temporal',
  );
});

test('la contraseña temporal no se puede cerrar de un descuido', () => {
  const u = fuente('components/ajustes/Usuarios.jsx');

  /* La bandera atada al estado `temporal`, no a un valor fijo. `cerrablePorFuera={false}` a
     secas también pasaría un `!/cerrablePorFuera/` pero dejaría la ventana del formulario sin
     Escape, que es peor interfaz sin ningún beneficio. */
  assert.match(
    u,
    /cerrablePorFuera=\{!temporal\}/,
    'Usuarios dejó de proteger la contraseña temporal del cierre accidental',
  );

  /* Y CADA vista de la contraseña tiene su salida explícita. Sin eso es un estado sin salida, que
     es lo que el `03` § 5 llama defecto — y acá es peor, porque el Escape está deshabilitado a
     propósito.

     Se cuenta el PANEL (`{laTemporal}`) y no `temporal ? (`, y la diferencia la enseñó un fallo:
     `temporal ? (` también casa con el ternario del título de la ventana, así que la cuenta daba
     tres donde hay dos vistas. Una prueba que cuenta mal es una prueba que va a fallar sobre
     código correcto, y ésas se terminan borrando. */
  const paneles = (u.match(/\{laTemporal\}/g) ?? []).length;
  assert.ok(paneles > 0, 'no se dibuja el panel de la contraseña temporal en ningún lado');
  assert.equal(
    (u.match(/Listo, ya la copié/g) ?? []).length,
    paneles,
    `se dibuja la contraseña en ${paneles} lugar(es) y no hay un botón de salida en cada uno`,
  );

  /* Y TODA ventana de este archivo protege la contraseña, no solo la que la muestra hoy.
     El restablecimiento desde la ficha apareció después del alta, y devuelve una temporal igual:
     si esa segunda ventana no llevara el guardia, la contraseña se perdería con un Escape. Atar la
     cuenta al número de ventanas hace que la próxima tampoco pueda olvidarlo. */
  assert.equal(
    (u.match(/cerrablePorFuera=\{!temporal\}/g) ?? []).length,
    (u.match(/<Ventana/g) ?? []).length,
    'hay una ventana en Usuarios que no protege la contraseña temporal del cierre accidental',
  );
});

test('los formularios de alta viven DENTRO de la ventana, no en la página', () => {
  /* Es el pedido, y es comprobable: los campos tienen que aparecer después de `<Ventana`. Si
     alguien devuelve el formulario a una tarjeta fija, esto da rojo. */
  for (const [ruta, campo] of [
    ['components/ajustes/Empresas.jsx', 'id="emp-nombre"'],
    ['components/ajustes/Usuarios.jsx', 'id="us-nombre"'],
  ] as const) {
    const t = fuente(ruta);
    const ventana = t.indexOf('<Ventana');
    const elCampo = t.indexOf(campo);
    assert.ok(ventana > 0, `${ruta} no usa Ventana`);
    assert.ok(elCampo > 0, `${ruta} no tiene el campo ${campo}`);
    assert.ok(
      elCampo > ventana,
      `${ruta} dibuja ${campo} FUERA de la ventana: el formulario volvió a estar siempre visible`,
    );
    /* Y se dibuja solo cuando está abierta. Una `<Ventana>` sin condición es una ventana que
       aparece sola al entrar a la pestaña. */
    assert.match(
      t,
      /[Aa]bierta \? \(\s*<Ventana/,
      `${ruta} dibuja la ventana sin mirar si está abierta`,
    );
  }
});

test('la ventana hace las cuatro cosas que la hacen no estar rota', () => {
  const v = fuente('components/Ventana.jsx');

  // 1 · El foco entra, y VUELVE al control que la abrió.
  //
  //     La primera versión de esto era vacua y lo encontró una mutación: pedía
  //     `previo.current` seguido de un `focus()` a menos de 120 caracteres, y eso lo cumplía el
  //     `previo.current = document.activeElement` seguido del focus de ENTRADA. Borrar la vuelta
  //     del foco dejaba la prueba en verde. Ahora se piden las dos mitades por separado.
  assert.match(
    v,
    /previo\.current = document\.activeElement/,
    'la ventana no recuerda quién la abrió: no hay a dónde devolver el foco',
  );
  assert.match(
    v,
    /previo\.current\.focus\(\)/,
    'el foco no vuelve al cerrarse: quien navega con teclado queda en la nada',
  );
  /*   Y cae en el primer control del CUERPO. El primer enfocable de la ventana entera es la ✕
       del encabezado: medido en el navegador, abrir y pulsar Enter la cerraba en el acto. */
  assert.match(
    v,
    /querySelector\('\.vt-cuerpo'\)/,
    'el foco vuelve a caer en el primer enfocable de la ventana, que es el botón de cerrar',
  );
  // 2 · El tabulador no se escapa por detrás del fondo.
  assert.match(v, /preventDefault\(\)/, 'desapareció la trampa del foco: el tabulador se escapa');
  // 3 · Escape.
  assert.match(v, /'Escape'/, 'la ventana ya no cierra con Escape');
  // 4 · El fondo no se desplaza, y se RESTAURA lo que había en vez de asumir un valor.
  assert.match(
    v,
    /body\.style\.overflow = 'hidden'/,
    'el fondo volvió a desplazarse detrás de la ventana',
  );
  assert.ok(
    !/body\.style\.overflow = 'visible'|body\.style\.overflow = 'auto'/.test(v),
    'la ventana restaura el desplazamiento con un valor fijo: si otra cosa lo bloquea a la vez, ' +
      'lo desbloquea de más',
  );
});

test('la ventana es visible sin depender de que corra una animacion', () => {
  // ESTE DEFECTO OCURRIO, y se encontro verificando en el navegador — no en la suite.
  //
  // La primera version dejaba la caja en `opacity: 0` y la encendia desde JavaScript en el cuadro
  // siguiente, con `requestAnimationFrame`, para que el fundido tuviera de donde arrancar. Pero
  // `requestAnimationFrame` NO CORRE cuando la pagina no esta componiendo cuadros. Medido: la
  // ventana montada, con `opacity: 0`, el fondo sin su clase `on` —o sea sin recibir clics— y la
  // pagina bloqueada en un estado modal que no se ve. Se aprieta el boton y no pasa nada.
  //
  // La leccion no es «faltaba un cuadro»: es que **ser visible no puede depender de que una
  // animacion corra**. Lo que sigue afirma esa propiedad, no la implementacion.
  /* SIN COMENTARIOS. La primera version miraba el CSS crudo, y entonces esta prueba dependia
     de que el comentario de al lado no escribiera `opacity: 0` con punto y coma. Una
     asercion que un comentario puede satisfacer o romper no afirma nada del codigo. */
  const css = readFileSync(join(RAIZ, 'app/armazon.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ' ',
  );
  const caja = css.slice(css.indexOf('.vt-caja {'), css.indexOf('}', css.indexOf('.vt-caja {')));
  assert.ok(caja.length > 0, 'no se encontro la regla `.vt-caja`');

  assert.ok(
    !/opacity:\s*0\s*;/.test(caja),
    '`.vt-caja` vuelve a nacer transparente: si la animacion no corre, queda una ventana ' +
      'invisible que igual bloquea la pagina',
  );
  /* Sin `fill-mode`, los estilos de antes y despues de la animacion son los normales. Con
     `both` o `backwards`, el fotograma inicial se mantiene mientras la animacion no avanza — que
     es exactamente el estado invisible del que se viene. */
  assert.ok(
    !/animation[^;]*(both|backwards|forwards)[\s;]/.test(caja),
    '`.vt-caja` anima con `fill-mode`: el fotograma inicial puede quedarse pegado',
  );

  /* Y el componente no vuelve a encender la visibilidad desde JavaScript. */
  const v = fuente('components/Ventana.jsx');
  assert.ok(
    !/requestAnimationFrame/.test(v),
    'la ventana volvio a depender de `requestAnimationFrame` para verse',
  );
  /* El fondo se dibuja SIEMPRE con `on`. Sin esa clase no tiene opacidad ni recibe clics, asi
     que calcularla es la otra mitad del mismo defecto. */
  assert.match(
    v,
    /className="scrim on/,
    'el fondo de la ventana ya no nace encendido: no recibiria los clics que lo cierran',
  );
});
