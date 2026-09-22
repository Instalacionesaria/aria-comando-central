// Refrescar la pestaña deja de borrar lo que la empresa conversó con el agente.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTAS PRUEBAS CUSTODIAN
//
// Kevin, el 2026-09-22, con el reporte de las empresas: *«me indican que cuando ellos actualizan la
// pestaña se pierde la conversación, o no les aparece en su chat lo que conversaron anteriormente»*.
// Y el pedido de fondo: *«cada empresa en cada sesión debería entrar y no se debería perder esa
// conversación anterior»*.
//
// No era que no se guardara. Se guardaba —una fila por organización en `aria_cc_foundations`, la
// columna `tool_chats`— y se pisaba en el acto:
//
//   1. la pantalla montaba el chat con `reiniciarAlAbrir` en verdadero siempre que la herramienta
//      no tuviera entregable;
//   2. el navegador mandaba `{ reiniciar: true }`;
//   3. el servidor rehacía la conversación con `chatVacio()`, o sea `messages: []`;
//   4. y ESE documento vacío se guardaba encima del anterior.
//
// Refrescar con F5, volver de Research o entrar al día siguiente pasaban por los cuatro pasos. La
// huella quedó medida en producción el 2026-09-22: de las cinco organizaciones con chats guardados,
// ARIA tenía NUEVE conversaciones de UN mensaje cada una. Lo único que sobrevivía era el saludo.
//
// ── POR QUÉ NO SE BORRA EL REINICIO, QUE ES LO QUE PARECE ───────────────────
//
// Porque hace dos cosas que hacen falta: el saludo propone sobre lo que las herramientas anteriores
// tienen HOY, y «Continuar al paso N» arma el paso sin esperar un «sí». Las dos valen **mientras
// nadie escribió**. Un turno de la persona es trabajo, y el trabajo gana sobre un saludo más fresco.
//
// Por eso la pregunta es por `role === 'user'` y no por `messages.length`: una conversación de un
// mensaje es el saludo que armó el código del servidor, no lo escribió nadie.
//
// ── LO QUE ESTO **NO** ES ───────────────────────────────────────────────────
//
// No es el histórico. Un reinicio explícito —«Empezar de nuevo», «Traer del onboarding», o una
// subida de `VERSION_DEL_AGENTE`— **sigue pisando** el documento, porque la conversación vive en un
// casillero por herramienta y no hay dónde archivar la anterior. Eso es la entrega 2: una tabla que
// solo se agrega. Acá se cierra el borrado por rutina, que es el que reportaron las empresas.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { hayTurnosDeLaPersona } from '../../lib/fundaciones/estado.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

test('un saludo solo no es una conversación; un turno de la persona sí', () => {
  // Sin nada: no hay nada que conservar.
  assert.equal(hayTurnosDeLaPersona(undefined), false, 'sin conversación guardada no hay turnos');
  assert.equal(hayTurnosDeLaPersona({ messages: [], answers: {} }), false);

  /* EL CASO QUE DECIDE TODO: el saludo lo arma el servidor (`mensajeDeApertura`), no lo escribió
     nadie. Refrescarlo con las propuestas de hoy no le cuesta trabajo a ninguna persona, así que
     tiene que seguir reabriendo — es lo que resolvió «¿dónde veo que se está procesando el paso 3?». */
  assert.equal(
    hayTurnosDeLaPersona({ messages: [{ role: 'assistant', content: 'Hola. Vamos con…' }], answers: {} }),
    false,
    'un saludo del agente contaba como conversación: entonces el chat dejaría de refrescarse para todos',
  );

  // Y en cuanto alguien escribe, eso es trabajo y manda sobre un saludo más fresco.
  assert.equal(
    hayTurnosDeLaPersona({
      messages: [
        { role: 'assistant', content: 'Hola. Vamos con…' },
        { role: 'user', content: 'conektia' },
      ],
      answers: {},
    }),
    true,
  );

  /* Y no alcanza con que haya DOS mensajes: una conversación puede arrastrar dos turnos del agente
     seguidos. Lo que se busca es el `role`, no el largo. */
  assert.equal(
    hayTurnosDeLaPersona({
      messages: [
        { role: 'assistant', content: 'Hola.' },
        { role: 'assistant', content: 'Tu Perfil de Cliente ya está generado.' },
      ],
      answers: {},
    }),
    false,
  );
});

test('la regla vive en UN lugar y la usan los dos paneles', () => {
  /* Dos copias divergirían en la primera corrección, y el síntoma sería «en Research se conserva y
     en Tu ficha no» — la clase de defecto que se reporta como «a veces se pierde». */
  const estado = codigo('lib/fundaciones/estado.ts');
  assert.match(estado, /export function hayTurnosDeLaPersona/);
  assert.match(
    estado,
    /\.some\(\(m\) => m\.role === 'user'\)/,
    'la pregunta dejó de ser por el rol: con `messages.length` un saludo suelto bloquearía el refresco',
  );

  for (const panel of ['components/fundaciones/PanelHerramienta.jsx', 'components/fundaciones/PanelResearch.jsx']) {
    const fuente = codigo(panel);
    assert.match(fuente, /hayTurnosDeLaPersona/, `${panel} no usa la regla compartida`);
    assert.match(
      fuente,
      /const abrirDeCero =[\s\S]{0,200}?!hayTurnosDeLaPersona\(estado\.chats\[herramienta\.id\]\)/,
      `${panel} no decide la reapertura con lo conversado`,
    );
    assert.match(
      fuente,
      /reiniciarAlAbrir=\{[^}]*&& abrirDeCero\}/,
      `${panel} vuelve a reabrir siempre: eso borra la conversación en cada F5`,
    );
  }
});

test('los gestos explícitos SIGUEN abriendo de cero', () => {
  /* Conservar lo conversado no puede volverse una trampa: quien pide arrancar limpio tiene que
     arrancar limpio. Son tres caminos y los tres siguen vivos. */
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  // 1 · «Empezar de nuevo», el botón del pie del chat.
  assert.match(chat, /const reiniciar = async \(\) => \{[\s\S]*?hablar\(\{ reiniciar: true \}\)/);
  assert.match(chat, /Empezar de nuevo/);

  const generica = codigo('components/fundaciones/PanelHerramienta.jsx');
  // 2 · «Continuar al paso N»: ese botón pide ARMAR el paso, no retomarlo.
  // 3 · «Traer del onboarding»: la franja promete que «el agente vuelve a abrir con tus datos».
  assert.match(generica, /\|\| !!rellenarAlLlegar \|\| reinicios > 0/);
  assert.match(generica, /setReinicios\(\(n\) => n \+ 1\)/);

  const research = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(research, /\|\| !!rellenarAlLlegar/);
});

test('sin reapertura, el chat se pinta con lo guardado y NO llama al servidor', () => {
  /* La otra mitad de que no se pierda: con una conversación guardada y `reiniciarAlAbrir` en falso,
     el efecto de apertura corta antes del `POST`. Si igual llamara, el servidor la reabriría —su
     `recienAbierta` mira `reiniciar || messages.length === 0 || anticuada`— y volveríamos al
     borrado, además de pagar una inferencia por cada vistazo. */
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /if \(mensajes\.length > 0 && !reiniciarAlAbrir && !anticuada\) return;/);
  assert.match(
    chat,
    /const \[mensajes, setMensajes\] = useState\(\(\) => \[\.\.\.inicial\.messages\]\)/,
    'el chat dejó de nacer con lo guardado: entonces no hay qué mostrar al volver',
  );

  /* Y el servidor sigue conservando lo que la conversación anterior anotó cuando SÍ se reabre: sin
     esto, abrir de cero también tiraría las respuestas ya juntadas. */
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /await abrir\(h, estado\.datos, acceso\.claveIa, chat\.answers\)/);
});

test('cambiar de pestaña tampoco la pierde: los turnos suben al estado de la pantalla', () => {
  /* ═══ LA SEGUNDA PUERTA, Y LA ENCONTRÓ UNA REVISIÓN ADVERSARIAL ══════════════
     Arreglar el F5 no alcanzaba. `estado` se lee al montar y después de generar o guardar;
     conversar no lo tocaba. Y los paneles llevan `key={herramienta.id}`, así que ir a otra pestaña
     y volver los REMONTA con la foto de cuando se cargó la pantalla — donde todavía está el saludo
     solo. `abrirDeCero` miraba esa foto, concluía que nadie había hablado, y reabría: o sea,
     borraba lo conversado por una puerta distinta de la que se cerró primero.

     La respuesta del turno ya trae los mensajes, así que se anotan en el estado en vez de volver a
     pedirlo entero: una petición por mensaje para traer siete documentos de los que cambió uno. */
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /if \(onMensajes\) onMensajes\(datos\.mensajes\);/, 'el chat no avisa los turnos hacia arriba');

  const fundaciones = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(fundaciones, /const anotarConversacion = useCallback\(\(id, mensajes\) => \{/);
  assert.match(
    fundaciones,
    /chats: \{ \.\.\.previo\.chats, \[id\]: \{ \.\.\.anterior, messages: mensajes \} \}/,
    'al anotar los turnos se pierde el resto del chat (respuestas, sello, identificador)',
  );

  /* Y le llega a los DOS paneles: si solo lo recibiera uno, en esa herramienta se conservaría y en
     la otra no — que es justo la forma de defecto que se reporta como «a veces se pierde». */
  const veces = fundaciones.match(/onConversacion=\{anotarConversacion\}/g) ?? [];
  assert.equal(veces.length, 2, 'uno de los dos paneles no sube los turnos al estado');
  for (const panel of ['components/fundaciones/PanelHerramienta.jsx', 'components/fundaciones/PanelResearch.jsx']) {
    assert.match(
      codigo(panel),
      /onMensajes=\{onConversacion \? \(m\) => onConversacion\(herramienta\.id, m\) : undefined\}/,
      `${panel} no le pasa los turnos al estado de la pantalla`,
    );
  }
});

test('el pedido de «Continuar al paso N» se consume en los DOS paneles', () => {
  /* `rellenarAlLlegar` fuerza la reapertura a propósito: ese botón pide armar el paso. Pero es un
     pedido de UNA vez, y `PanelResearch` no lo consumía —solo `PanelHerramienta` recibía
     `onRellenadoAlLlegar`—, así que quedaba puesto toda la sesión: la barra de pestañas cambia de
     herramienta con un `setActiva` que no lo limpia. Resultado: llegabas por el método,
     conversabas, cambiabas de pestaña, volvías, y el Research reabría borrando lo hablado. */
  const fundaciones = codigo('components/fundaciones/Fundaciones.jsx');
  const veces = fundaciones.match(/onRellenadoAlLlegar=\{\(\) => setRellenarAlLlegar\(null\)\}/g) ?? [];
  assert.equal(veces.length, 2, 'un panel recibe el pedido de llegada y no tiene cómo consumirlo');

  assert.match(
    codigo('components/fundaciones/PanelHerramienta.jsx'),
    /if \(onRellenadoAlLlegar\) onRellenadoAlLlegar\(\);/,
  );
  assert.match(
    codigo('components/fundaciones/PanelResearch.jsx'),
    /yaConsumioLaLlegada\.current = true;\s*\n\s*if \(onRellenadoAlLlegar\) onRellenadoAlLlegar\(\);/,
    'el Research no consume el pedido de llegada: queda puesto para toda la sesión',
  );
});
