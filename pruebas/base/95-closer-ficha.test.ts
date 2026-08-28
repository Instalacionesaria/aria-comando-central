// La ficha del contacto, POR SUS CUATRO RUTAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE HABIENDO YA UN `24-ficha.test.ts`
//
// El `24` mide las funciones de `lib/negocio/` llamándolas directo. Eso deja fuera todo lo que la
// RUTA agrega encima, y es justo donde vivían los dos defectos que este archivo persigue:
//
//   · la guarda de forma del identificador —que está en la ruta y NO en la consulta—, y sin la
//     cual `invalid input syntax for type uuid` sale como 500;
//   · el mapeo de «cero filas» a 404 en vez de 403, que también está en la ruta.
//
// Los dos guardias de arquitectura leen estos archivos y no los ejecutan: un `exigir` con la
// capacidad correcta y una consulta que devuelve la organización equivocada los pasan a los dos sin
// una queja. Acá se invocan los manejadores de verdad, con una sesión de verdad, contra la base.
//
// ── LO QUE SE MIDE, Y POR QUÉ CADA COSA ────────────────────────────────────
//
// 1 · `ADR-0501`. Un contacto de otra organización **no existe**. 403 sería una confirmación de que
//     ese identificador es real en algún lado, y el identificador de la ficha es adivinable.
//
// 2 · Un identificador con forma inválida también es 404 y no un 500. Fue un defecto real.
//
// 3 · La ficha se abre **sin filtro de territorio, a propósito**: un contacto que acaba de pasar de
//     zona tiene que poder abrirse aunque ya no esté en ninguna lista del closer.
//
// 4 · El historial junta cuatro orígenes y a cada fila le pone SU autor —`Sistema` cuando lo hizo un
//     automatismo—. Atribuirle a una persona una decisión que no tomó es el defecto que el `04` § 3
//     dice que rompe el historial entero.
//
// 5 · Las pestañas sin fuente devuelven `falta` con un motivo. Una lista vacía muda afirma «este
//     contacto nunca llamó»; con `falta` dice «todavía no se conectó la plataforma de voz».
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { filasDeTerritorio } from '../../lib/negocio/fila.ts';
import { notasDeLaFicha } from '../../lib/negocio/ficha.ts';
import { definicionDe, modoDe } from '../../lib/negocio/salidas.ts';
import {
  leerRespuesta,
  limpiar,
  montar,
  pedirComo,
  unaCita,
  unaNota,
  unaTarea,
  unContacto,
  unResultado,
  type Escenario,
} from '../apoyo/closer.ts';
import { GET as verFicha } from '../../app/api/contactos/[id]/route.ts';
import { GET as verPerfil } from '../../app/api/contactos/[id]/perfil/route.ts';
import { GET as verHistorial } from '../../app/api/contactos/[id]/historial/route.ts';
import { GET as verLlamadas } from '../../app/api/contactos/[id]/llamadas/route.ts';
import { GET as verNotas } from '../../app/api/contactos/[id]/notas/route.ts';

let esc: Escenario;
/** El nombre de `ana@alfa.ejemplo`, que es lo que el historial tiene que poner como autor. */
let nombreDeAna: string;

before(async () => {
  esc = await montar('Ficha');
  const u = await unaFila<{ nombre: string }>(
    esc.admin,
    'select nombre from identidad.usuarios where id = $1',
    [esc.quien],
  );
  assert.ok(u, 'falta el sembrado: `ana@alfa.ejemplo` tiene que existir');
  nombreDeAna = u.nombre;
});

after(async () => {
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

/** El contexto de una ruta con parámetro de camino. Lo que Next le pasa como segundo argumento. */
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/**
 * Las cinco rutas de la ficha —el panel y sus cuatro pestañas de lectura— para las pruebas que
 * valen igual en todas.
 *
 * ── ERAN CUATRO, Y LAS NOTAS FALTABAN ───────────────────────────────────
 *
 * El `GET` de las notas no estaba en esta lista, así que las tres pruebas que la recorren —404 sobre
 * datos ajenos, `no-store`, 401 sin sesión— nunca lo miraron. Y tenía el mismo defecto que los otros
 * tres: `200` con la lista vacía sobre un contacto de otra organización, mientras su propio `POST`,
 * en el mismo archivo, sí comprobaba la existencia y respondía 404.
 *
 * Una ruta que no está en la lista compartida no aparece como hueco en ninguna parte: la suite se ve
 * completa. Por eso la lista se amplía en vez de escribir sus pruebas aparte.
 */
const LAS_CINCO = [
  ['la ficha', verFicha, (id: string) => `/api/contactos/${id}`],
  ['el perfil', verPerfil, (id: string) => `/api/contactos/${id}/perfil`],
  ['el historial', verHistorial, (id: string) => `/api/contactos/${id}/historial`],
  ['las llamadas', verLlamadas, (id: string) => `/api/contactos/${id}/llamadas`],
  ['las notas', verNotas, (id: string) => `/api/contactos/${id}/notas`],
] as const;

interface CuerpoDeFicha {
  contacto: { id: string; nombre: string; ghlContactId: string | null };
  /* `refresco` ya NO trae `enlaceCrm`, y el cuerpo ya no trae `enlaceAgendar`: los dos botones que
     los consumían —«Ver en GHL» y «Agendar»— se quitaron a pedido, y los campos se fueron con
     ellos. La prueba de más abajo exige que **no vuelvan**, que es lo que impide que un campo sin
     lector se quede a vivir en la respuesta. */
  refresco: { actualizado: boolean; porque: string | null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · ADR-0501 · UN CONTACTO DE OTRA ORGANIZACIÓN NO EXISTE
// ═══════════════════════════════════════════════════════════════════════════════

test('ADR-0501 · la ficha de un contacto de OTRA organización es 404, nunca 403', async () => {
  // El identificador de la ficha viaja en la URL y es adivinable. Con 403 la respuesta diría «eso
  // existe pero no es tuyo», que es un oráculo de existencia gratis: alguien con un identificador
  // de otra empresa sabría que su cliente está cargado acá. Con 404 no hay nada que aprender.
  //
  // Y el defecto que atrapa no es hipotético: la ruta obtiene la fila con `filaDeContacto`, que
  // depende de la política de fila para no ver la otra organización. Si el `conOrganizacion` se
  // cayera —o si la consulta se escribiera sin él— acá saldría 200 con el contacto de `beta`.
  const ajeno = await unContacto(esc, { org: esc.otraOrg, nombre: 'Ficha ajeno' });

  const r = await leerRespuesta(await verFicha(pedirComo(`/api/contactos/${ajeno.id}`, esc.token), ctx(ajeno.id)));
  assert.equal(r.estado, 404, 'un contacto de otra organización tiene que NO EXISTIR, no estar prohibido');
  assert.equal(
    (r.cuerpo as { codigo?: string }).codigo,
    'no_encontrado',
    'el código del cuerpo también: `sin_permiso` acá confirmaría la existencia igual que un 403',
  );
});

test('el mismo contacto ajeno SÍ se abre con una sesión de SU organización', async () => {
  // El control de la prueba anterior, y no es adorno: un 404 se puede conseguir por el motivo
  // equivocado —un identificador mal armado, una consulta rota, una tabla vacía— y entonces la
  // prueba de arriba pasaría con el aislamiento completamente desactivado. Esto afirma que la fila
  // existe y es legible, así que el 404 de arriba lo produjo el aislamiento y nada más.
  const ajeno = await unContacto(esc, { org: esc.otraOrg, nombre: 'Ficha ajeno visible' });

  const fila = await conOrganizacion(esc.otraOrg, async () => {
    const { filas } = await filasDeTerritorio('closer', { todas: true });
    return filas.find((f) => f.id === ajeno.id);
  });
  assert.ok(fila, 'el contacto de `beta` tiene que existir y ser legible DESDE `beta`');
  assert.equal(fila.nombre, 'Ficha ajeno visible');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · UN IDENTIFICADOR MAL FORMADO ES 404, NO UN 500
// ═══════════════════════════════════════════════════════════════════════════════

for (const [nombre, manejador, camino] of LAS_CINCO) {
  test(`${nombre} · un identificador con forma inválida es 404 y no un 500`, async () => {
    // Éste fue un defecto real: sin la guarda de forma, PostgreSQL lanza
    // `invalid input syntax for type uuid` y el manejador lo devuelve como 500. Dos daños: un 500
    // dice «nuestro servidor está roto» y manda a alguien a mirar los registros del servidor por
    // una URL mal tipeada, y además el mensaje del error nombra el tipo de la columna.
    //
    // Si la guarda se quitara, esto sale 500 (o 503 por `base_no_disponible`), nunca 404.
    const r = await leerRespuesta(
      await manejador(pedirComo(camino('no-es-un-uuid'), esc.token), ctx('no-es-un-uuid')),
    );
    assert.equal(r.estado, 404, `${nombre} tiene que tratar un identificador ilegible como no encontrado`);
    assert.equal((r.cuerpo as { codigo?: string }).codigo, 'no_encontrado');
  });
}

test('la guarda de forma rechaza la INYECCIÓN por el parámetro de camino sin llegar a la consulta', async () => {
  // El parámetro de camino es texto arbitrario y entra a una consulta. El constructor de consultas
  // ya parametriza, así que esto no es la única defensa — pero es la que hace que el intento
  // termine en 404 en vez de en un error de la base con su mensaje. Si la guarda desapareciera,
  // esto daría 503/500 y el cuerpo llevaría el texto que PostgreSQL escribió.
  const feo = "' or 1=1 --";
  const r = await leerRespuesta(await verFicha(pedirComo(`/api/contactos/${feo}`, esc.token), ctx(feo)));
  assert.equal(r.estado, 404);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA FICHA SE ABRE SIN FILTRO DE TERRITORIO, A PROPÓSITO
// ═══════════════════════════════════════════════════════════════════════════════

test('un contacto que pasó a `setter` SIGUE abriéndose por su ficha aunque ya no esté en las listas del closer', async () => {
  // Las dos mitades importan y son opuestas, así que van juntas o una tapa a la otra:
  //
  //   · la LISTA filtra por territorio, porque es el filtro de negocio del `11` § 8;
  //   · la FICHA no filtra, porque un contacto que acaba de cambiar de zona —o que se está
  //     mirando desde la auditoría, o desde la pantalla del setter— tiene que poder abrirse.
  //
  // Si alguien «arreglara» la ficha agregándole el filtro por simetría con la lista, el síntoma
  // sería un 404 al abrir un contacto que la pantalla anterior acaba de mostrar. Y como la interfaz
  // se traga el 404, se vería como «este contacto no tiene nada» — el defecto que `ADR-0305`
  // persigue, con el agravante de que nadie sabría que el contacto existe.
  const delSetter = await unContacto(esc, { territorio: 'setter', nombre: 'Ficha del setter' });

  const r = await leerRespuesta<CuerpoDeFicha>(
    await verFicha(pedirComo(`/api/contactos/${delSetter.id}`, esc.token), ctx(delSetter.id)),
  );
  assert.equal(r.estado, 200, 'la ficha NO filtra por territorio: un contacto del setter se abre igual');
  assert.equal(r.cuerpo.contacto.id, delSetter.id);
  assert.equal(r.cuerpo.contacto.nombre, 'Ficha del setter');

  // Y la otra mitad: ese mismo contacto no aparece en la lista del closer. Sin esto, la aserción de
  // arriba pasaría igual con el filtro de la LISTA roto, que es el defecto contrario.
  const enLaListaDelCloser = await conOrganizacion(esc.org, async () => {
    const { filas } = await filasDeTerritorio('closer', { todas: true });
    return filas.some((f) => f.id === delSetter.id);
  });
  assert.equal(
    enLaListaDelCloser,
    false,
    'un contacto con `territorio = setter` no tiene que aparecer en ninguna lista del closer',
  );
});

test('un contacto SIN territorio también se abre por su ficha', async () => {
  // El nulo es el caso que más se olvida: `where territorio = 'closer'` lo descarta y
  // `where territorio <> 'setter'` también, porque en SQL una comparación con nulo no es cierta.
  // La ficha no compara nada, así que tiene que abrirlo — y es el estado real de un contacto recién
  // importado al que todavía no le llegó la etiqueta de zona.
  const sinZona = await unContacto(esc, { territorio: null, nombre: 'Ficha sin zona' });

  const r = await leerRespuesta<CuerpoDeFicha>(
    await verFicha(pedirComo(`/api/contactos/${sinZona.id}`, esc.token), ctx(sinZona.id)),
  );
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.contacto.id, sinZona.id);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL HISTORIAL: CUATRO ORÍGENES, Y EL AUTOR DE CADA UNO
// ═══════════════════════════════════════════════════════════════════════════════

interface CuerpoDeHistorial {
  eventos: { id: string; cuando: string; titulo: string; detalle: string | null; autor: string }[];
  falta: string | null;
}

test('el historial junta la nota, el resultado, la cita y la TAREA, cada uno con SU autor', async () => {
  const k = await unContacto(esc, { nombre: 'Ficha historial' });
  /* LOS CUATRO orígenes, y son cuatro. `historialDeLaFicha` hace cuatro consultas en paralelo
     —`resultados`, `tareas`, `citas`, `notas`— y hasta que esta prueba sembró la tarea, el origen
     `tarea:` no lo ejercitaba NADIE en el repositorio: se comprobó mutándolo —cambiando el
     `where t.contacto_id` de `ficha.ts` por un identificador inventado— y tanto este archivo como
     el `24` seguían en verde con la cuarta consulta devolviendo cero filas siempre. Un seguimiento
     que se creó y que el historial no muestra es exactamente el hueco que el `04` § 3 describe:
     la línea de tiempo se ve coherente y le falta la mitad de lo que alguien decidió.

     Los instantes van separados a propósito: la cita se ubica por `inicio_el` y no por cuándo se
     copió, así que darle una hora propia es lo que hace que el orden signifique algo. */
  /* Se siembra lo que UN Avanzar escribe de verdad: la misma cadena en las tres tablas que la
     copian —`notas.cuerpo`, `resultados.nota` y `tareas.nota`—. Antes el resultado y la nota se
     sembraban con textos distintos y el resultado sin `nota`, así que la repetición del historial
     era invisible para esta prueba: se comprobó por mutación —devolver el `?? r.nota` de reserva
     dejaba la suite entera en verde—.
     Y `detalle` va aparte, porque es el dato que la fila del resultado SÍ tiene que mostrar: es lo
     que se eligió en el campo de Avanzar, no la nota. */
  await unaNota(esc, k.id, { cuerpo: 'Ficha nota de Ana' });
  await unResultado(esc, k.id, {
    salida: 'venta',
    monto: 1500,
    nota: 'Ficha nota de Ana',
    detalle: 'Contado',
  });
  await unaCita(esc, k.id, { inicioEl: new Date(Date.now() + 3 * 24 * 3600 * 1000) });
  await unaTarea(esc, k.id, { venceEl: '2027-03-15', nota: 'Ficha nota de Ana' });

  const r = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);

  // Los tres orígenes, y NO uno menos. El historial son cuatro consultas unidas en memoria: si una
  // se cayera —un `contacto_id` mal comparado, un `leftJoin` convertido en `innerJoin`— el resto
  // seguiría respondiendo y la pestaña se vería normal, solo con una parte de la historia menos.
  // Ése es el modo de falla que esta aserción existe para atrapar, y por eso se cuentan por prefijo.
  const porOrigen = (prefijo: string) => r.cuerpo.eventos.filter((e) => e.id.startsWith(`${prefijo}:`));
  assert.equal(porOrigen('nota').length, 1, 'la nota tiene que estar en el historial');
  assert.equal(porOrigen('resultado').length, 1, 'el resultado tiene que estar en el historial');
  assert.equal(porOrigen('cita').length, 1, 'la cita tiene que estar en el historial');
  assert.equal(porOrigen('tarea').length, 1, 'el seguimiento tiene que estar en el historial');
  assert.equal(r.cuerpo.eventos.length, 4, 'cuatro orígenes sembrados, cuatro eventos: ni uno de más');

  // El AUTOR de cada uno, que es lo que el `04` § 3 dice que sostiene el historial entero. La nota y
  // el resultado los registró una persona y llevan SU nombre; una implementación que perdiera el
  // `leftJoin` con `usuarios` los devolvería como `Sistema` y el historial afirmaría que un
  // automatismo cerró una venta de 1500.
  assert.equal(porOrigen('nota')[0]?.autor, nombreDeAna, 'la nota la escribió Ana, no el sistema');
  assert.equal(porOrigen('resultado')[0]?.autor, nombreDeAna, 'el resultado lo registró Ana');
  // La cita la agenda un automatismo del CRM, no una persona de esta aplicación. Ponerle el nombre
  // de quien está mirando —el error fácil: usar la sesión como reserva— le atribuiría a Ana una cita
  // que no agendó.
  assert.equal(porOrigen('cita')[0]?.autor, 'Sistema', 'una cita del CRM no la agendó ninguna persona');
  // La tarea tiene su propio `leftJoin` con `usuarios`, distinto del de la nota y del del resultado.
  // Es la tercera copia de la misma unión, así que es la tercera que se puede convertir en `inner`
  // —y ahí el seguimiento del sistema desaparece— o quedarse sin el `onRef` de `org_id`.
  assert.equal(porOrigen('tarea')[0]?.autor, nombreDeAna, 'el seguimiento lo creó Ana');
  /* ── EL DETALLE DE LA TAREA ES SU MODO, Y ANTES ERA LA NOTA OTRA VEZ ─────
   *
   * Esta línea pedía `'Ficha volver en marzo'`, o sea el texto de la nota — y la misma prueba, ocho
   * líneas más abajo, pedía ese mismo texto como detalle de la fila `nota:`. Las dos pasaban, y eso
   * era el defecto: el historial repetía el texto en cada fila que tenía una copia de esa columna.
   *
   * Ahora cada fila muestra lo suyo, y el modo es lo único que esta aporta: «Lo retomo yo» y «Que lo
   * persiga la secuencia» llevan a acciones opuestas. Sale del catálogo y no de una cadena escrita
   * acá, así que renombrarlo en `salidas.ts` no deja esta prueba fijando un texto que ya nadie usa. */
  assert.equal(
    porOrigen('tarea')[0]?.detalle,
    modoDe('seguimiento', 'manual')?.nombre,
    'el seguimiento no dice su modo: es el único dato que esa fila aporta',
  );

  /* El texto del resultado lleva el NOMBRE HUMANO de la salida y no su clave. Antes decía
     «Se registró «venta»», que con `venta` se lee bien y con `acuerdo_sin_pago` es jerga de la base
     en la cara de quien mira —y es el mismo defecto que ya se arregló en las Completadas de Mi
     Día—. Sale de `definicionDe`, el catálogo que usa la pantalla. */
  assert.equal(
    porOrigen('resultado')[0]?.titulo,
    `Se registró «${definicionDe('venta')?.nombre}»`,
  );
  assert.equal(porOrigen('nota')[0]?.detalle, 'Ficha nota de Ana');

  /* ── Y LA GUARDA DE LA REPETICIÓN, QUE ES EL PUNTO DEL ARREGLO ───────────
   *
   * Un solo Avanzar con nota escribe ese texto en TRES tablas —`resultados.nota`, `notas.cuerpo` y
   * `tareas.nota`— y cada una tiene su motivo, documentado en `lib/negocio/avanzar.ts`. El historial
   * las leía todas, así que la misma frase salía hasta tres veces seguidas en la pantalla cuyo punto
   * es entender qué pasó.
   *
   * Esta aserción cuenta apariciones, no formas: no le importa qué fila la muestra, sino que sea
   * UNA. Es lo que va a ponerse roja si alguien vuelve a poner un `?? r.nota` de reserva. */
  const veces = (texto: string) =>
    r.cuerpo.eventos.filter((e) => e.detalle === texto).length;
  assert.equal(
    veces('Ficha nota de Ana'),
    1,
    'la nota aparece más de una vez en el historial: está sembrada en las tres tablas que un Avanzar ' +
      'escribe, y tres líneas seguidas con el mismo texto hacen dudar de si pasaron tres cosas o una',
  );
  /* Y la fila del resultado muestra SU dato —el detalle— y no un hueco. Sin esta línea, la de arriba
     se podría cumplir dejando el resultado sin detalle de ninguna clase, que sería perder información
     en vez de dejar de repetirla. */
  assert.equal(
    porOrigen('resultado')[0]?.detalle,
    'Contado',
    'la fila del resultado no muestra lo que se eligió en su campo',
  );

  /* ── EL DEFECTO QUE ESTA PRUEBA ENCONTRÓ, Y QUE YA ESTÁ ARREGLADO ──────────
   *
   * La primera versión de esta prueba fijaba el defecto en vez de arreglarlo, a propósito: el
   * título decía **«Seguimiento para el Mon Mar 15»**. `ficha.ts` lo armaba con
   * `String(t.vence_el).slice(0, 10)`, y el controlador devuelve una columna `date` como un `Date`
   * puesto en la medianoche LOCAL, así que `String(...)` daba la forma larga en inglés y el recorte
   * a diez caracteres se quedaba con el nombre del día. En inglés, en una interfaz toda en español,
   * y **sin el año**.
   *
   * No se veía leyendo el código —diez es justo el largo de una fecha ISO— y no lo veía nadie porque
   * este origen del historial no se ejercitaba en ninguna prueba. O sea que el hueco de cobertura y
   * el defecto eran el mismo hecho.
   *
   * Ahora el título sale de `fechaDelDia`, en español y con el año. Y se afirma el AÑO y no la
   * cadena completa: el formato largo lo decide `Intl` y puede cambiar entre versiones del motor —
   * lo que no puede faltar es el dato. Ver `diaDeLaColumna` en `ficha.ts` para las DOS formas de
   * equivocarse extrayendo el día de esa columna. */
  const tituloDeLaTarea = porOrigen('tarea')[0]?.titulo ?? '';
  assert.match(tituloDeLaTarea, /^Seguimiento para el /);
  assert.match(
    tituloDeLaTarea,
    /2027/,
    'el título de un seguimiento volvió a no decir el año: «Mon Mar 15» sirve igual para 2027 y 2032',
  );
  assert.match(
    tituloDeLaTarea,
    /marzo/,
    'el título volvió al inglés, en una interfaz que es toda en español',
  );
  assert.doesNotMatch(
    tituloDeLaTarea,
    /Mar|Mon/,
    'quedó el nombre corto en inglés del formato largo de `Date`',
  );

  // Con eventos, `falta` es nulo: el cero no es un cero, hay historia de verdad.
  assert.equal(r.cuerpo.falta, null, 'con tres eventos no falta nada que explicar');

  // Y el orden: del más reciente al más viejo. Sin esto la línea de tiempo se lee al revés, y como
  // cada fila trae su fecha nadie lo llamaría un error — lo llamaría «raro».
  const instantes = r.cuerpo.eventos.map((e) => new Date(e.cuando).getTime());
  for (let i = 1; i < instantes.length; i += 1) {
    assert.ok(
      (instantes[i - 1] as number) >= (instantes[i] as number),
      'el historial va del evento más reciente al más viejo',
    );
  }
});

test('una nota sin autor registrado es de `Sistema`, no de quien está mirando', async () => {
  // `autor_id` nulo significa «la importó un automatismo». La reserva TIENE que ser `Sistema` y no
  // el nombre de la sesión: con el nombre de quien mira, cada persona vería el historial atribuido
  // a sí misma y las dos versiones parecerían correctas. El `04` § 3 lo dice literal.
  const k = await unContacto(esc, { nombre: 'Ficha nota importada' });
  await unaNota(esc, k.id, { cuerpo: 'Ficha nota importada del CRM', autorId: null, origen: 'importada' });

  const r = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.eventos.length, 1);
  assert.equal(r.cuerpo.eventos[0]?.autor, 'Sistema');
  assert.notEqual(
    r.cuerpo.eventos[0]?.autor,
    nombreDeAna,
    'una fila sin autor NO puede quedar atribuida a la persona que abrió la ficha',
  );
});

test('un resultado SIN detalle no recicla la nota como detalle', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA EXISTE PORQUE UN MUTANTE SOBREVIVIÓ DOS VECES
  //
  // El defecto era `detalle: r.detalle ?? r.nota` en `historialDeLaFicha`: con eso, la nota de un
  // Avanzar aparecía como detalle de la fila del resultado **y** como la fila `nota:`, el mismo texto
  // dos veces seguidas.
  //
  // La prueba grande de más arriba no lo atrapaba, y las dos razones valen la pena:
  //
  //   1. su resultado se sembraba SIN `nota`, así que el `?? r.nota` daba nulo igual;
  //   2. al arreglar eso —sembrando la misma cadena en las tres tablas, como hace Avanzar— tampoco:
  //      ese resultado tiene `detalle: 'Contado'`, y el `??` de reserva **nunca se evalúa** cuando el
  //      lado izquierdo tiene valor.
  //
  // O sea que el mutante solo se manifiesta con un resultado que tenga nota y NO tenga detalle — y
  // ese caso es de los comunes, no un borde: de las seis salidas, la mitad no tiene campo de opciones,
  // así que un no-show con nota llega exactamente así.
  // ══════════════════════════════════════════════════════════════════════
  const k = await unContacto(esc, { nombre: 'Ficha resultado sin detalle' });
  const TEXTO = 'Ficha no contestó tres veces';
  // Las dos filas que un Avanzar con nota escribe cuando la salida no tiene campo de opciones.
  await unResultado(esc, k.id, { salida: 'no_show', nota: TEXTO, detalle: null });
  await unaNota(esc, k.id, { cuerpo: TEXTO });

  const r = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);

  assert.equal(
    r.cuerpo.eventos.filter((e) => e.detalle === TEXTO).length,
    1,
    'la nota aparece dos veces: como detalle del resultado y como su propia fila. `resultados.nota` ' +
      'existe para que el resultado se lleve consigo lo que se dijo al registrarlo, no para ' +
      'reimprimirlo en la línea de tiempo al lado de la fila que ya lo muestra',
  );
  // Y la que la muestra es la fila de la NOTA, no la del resultado.
  const delResultado = r.cuerpo.eventos.find((e) => e.id.startsWith('resultado:'));
  const deLaNota = r.cuerpo.eventos.find((e) => e.id.startsWith('nota:'));
  assert.equal(delResultado?.detalle, null, 'el resultado no tenía detalle y aun así muestra uno');
  assert.equal(deLaNota?.detalle, TEXTO, 'la nota dejó de mostrar su propio texto');
});

test('cerrar un seguimiento agrega su propio evento, con la hora del cierre', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // EL HUECO QUE ESTO CIERRA
  //
  // `tareas.completada_el` tuvo durante mucho tiempo dos lectores y **cero escritores**: un
  // seguimiento no se podía cerrar nunca. Ahora se cierra —al responderle al contacto, y al
  // registrar un Avanzar nuevo— así que hay un instante que contar.
  //
  // Sin este evento el historial muestra «Seguimiento para el 15 de marzo de 2027» y nada más: no
  // hay forma de saber si se atendió, ni cuándo. Y la fila de creación no cambia al cerrarse, así
  // que la pantalla se ve exactamente igual antes y después — el tipo de hueco que no se reporta.
  // ══════════════════════════════════════════════════════════════════════
  const k = await unContacto(esc, { nombre: 'Ficha seguimiento cerrado' });
  await unaTarea(esc, k.id, { venceEl: '2027-03-15' });

  const antes = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  assert.equal(
    antes.cuerpo.eventos.filter((e) => e.id.startsWith('tarea-cerrada:')).length,
    0,
    'un seguimiento sin cerrar ya trae el evento de cierre: entonces el evento no mide el cierre',
  );

  await esc.admin.query(
    'update negocio.tareas set completada_el = now() where contacto_id = $1',
    [k.id],
  );

  const despues = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  const cierre = despues.cuerpo.eventos.filter((e) => e.id.startsWith('tarea-cerrada:'));
  assert.equal(cierre.length, 1, 'cerrar el seguimiento no dejó rastro en el historial');
  assert.equal(cierre[0]?.titulo, 'Se cerró el seguimiento');

  /* El autor es `Sistema`, y no es una omisión: la tabla no tiene columna de quién cerró. Puede
     haber sido una respuesta o un Avanzar de una persona, y ponerle `creada_por` —quien lo CREÓ—
     sería atribuirle a alguien una decisión que quizás no tomó, que es lo que el encabezado de
     `historialDeLaFicha` prohíbe explícitamente. */
  assert.equal(
    cierre[0]?.autor,
    'Sistema',
    'el cierre no tiene autor registrado en la base: inventarlo es lo que vuelve el historial inutilizable',
  );

  /* Y la fila de creación sigue estando, con SU hora. Son dos hechos del mismo seguimiento y el
     evento de cierre no reemplaza al de creación: si lo hiciera, se perdería cuándo se decidió. */
  assert.equal(
    despues.cuerpo.eventos.filter((e) => e.id.startsWith('tarea:')).length,
    1,
    'el evento de cierre se comíó el de creación',
  );
  const creado = despues.cuerpo.eventos.find((e) => e.id.startsWith('tarea:'));
  assert.notEqual(cierre[0]?.cuando, creado?.cuando, 'los dos eventos comparten el instante');
});

test('un contacto sin nada en el historial dice QUÉ falta, no «sin datos»', async () => {
  // `ADR-0305` aplicado a un cuerpo de 200: la lista vacía sola afirma «a este contacto no le pasó
  // nunca nada», y lo cierto es que los eventos de sistema todavía no se registran.
  // La diferencia decide si alguien llama al cliente creyendo que nadie lo atendió.
  //
  // ── Y EL TEXTO TENÍA QUE DECIR LA VERDAD, QUE ES LO QUE CAMBIÓ ──────────
  //
  // Decía *«hoy solo hay notas: el resto todavía no tiene de dónde venir»*, y era falso desde varias
  // etapas atrás: los resultados, los seguimientos y las citas tienen escritor y aparecen. Esta
  // prueba lo dejaba pasar porque solo pedía que el texto dijera «historial» — una aserción que un
  // párrafo equivocado cumple igual. Ahora exige que nombre lo que de verdad falta.
  const k = await unContacto(esc, { nombre: 'Ficha historial vacío' });

  const r = await leerRespuesta<CuerpoDeHistorial>(
    await verHistorial(pedirComo(`/api/contactos/${k.id}/historial`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.eventos, []);
  assert.notEqual(r.cuerpo.falta, null, 'un historial vacío tiene que venir con el motivo al lado');
  assert.match(
    r.cuerpo.falta ?? '',
    /sistema/i,
    'el motivo tiene que nombrar lo que de verdad falta —los eventos de sistema— y no ser un «no ' +
      'hay datos» genérico ni una lista de orígenes que SÍ existen',
  );
  /* Y que NO diga que faltan los que ya están. Es la mitad que atrapa el texto viejo: sin esto, un
     párrafo que afirma «hoy solo hay notas» cumple la aserción de arriba y sigue mintiendo. */
  assert.doesNotMatch(
    r.cuerpo.falta ?? '',
    /solo hay notas|no tiene de dónde venir/i,
    'el motivo dice que los resultados, los seguimientos o las citas no tienen de dónde venir, y ' +
      'los tres tienen escritor y aparecen en el historial',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LAS DOS PESTAÑAS SIN FUENTE: `falta` CON UN MOTIVO
// ═══════════════════════════════════════════════════════════════════════════════

test('las llamadas sin la plataforma de voz conectada traen `falta`, no una lista vacía muda', async () => {
  // `negocio.llamadas` está vacía en producción porque la plataforma de voz no está conectada: las
  // llamadas llegan por aviso de Assistable, no se consultan. Una lista vacía sin `falta` afirma
  // «nunca se lo llamó», y con eso alguien lo llama de nuevo o lo descarta por frío.
  //
  // Y por eso se comprueba que `falta` NOMBRA la pieza: si el texto fuera «no hay llamadas», quien
  // lo lee no sabría si es un problema suyo o una parte del sistema que no está construida.
  const k = await unContacto(esc, { nombre: 'Ficha sin llamadas' });

  const r = await leerRespuesta<{ llamadas: unknown[]; falta: string | null }>(
    await verLlamadas(pedirComo(`/api/contactos/${k.id}/llamadas`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.llamadas, []);
  assert.notEqual(r.cuerpo.falta, null, 'cero llamadas SIN medir no puede viajar igual que cero medido');
  assert.match(r.cuerpo.falta ?? '', /voz|Assistable/i, 'el motivo tiene que nombrar la pieza que falta');
});

interface CuerpoDePerfil {
  campos: { etiqueta: string; valor: string; grupo: string }[];
  falta: string | null;
}

test('el perfil trae `falta` INCLUSO con campos, porque los 160 del CRM no se leen todavía', async () => {
  // Es el caso que se rompe si alguien condiciona `falta` a que la lista esté vacía, «por simetría»
  // con las llamadas y el historial. No es simétrico y no puede serlo: el perfil devuelve seis
  // columnas sincronizadas y la calificación entera —los 160 campos personalizados— sigue en
  // GoHighLevel sin leerse. Un perfil con seis campos y `falta: null` afirma «esto es todo lo que
  // hay de esta persona», y eso es falso hoy.
  const k = await unContacto(esc, {
    nombre: 'Ficha perfil',
    telefono: '+5491100000000',
    etiquetas: ['zona_closer'],
  });

  const r = await leerRespuesta<CuerpoDePerfil>(
    await verPerfil(pedirComo(`/api/contactos/${k.id}/perfil`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200);
  assert.ok(r.cuerpo.campos.length > 0, 'el nombre y el teléfono sembrados tienen que venir');
  assert.notEqual(r.cuerpo.falta, null, 'el perfil declara SIEMPRE que la calificación no se lee');
  assert.match(r.cuerpo.falta ?? '', /GoHighLevel/i);

  const etiquetas = r.cuerpo.campos.map((c) => c.etiqueta);
  assert.ok(etiquetas.includes('Nombre'));
  assert.ok(etiquetas.includes('Teléfono'));
  // Un campo sin valor NO viaja. «Correo: —» se lee como «no tiene correo» cuando lo cierto es que
  // no lo trajimos, y ese es el defecto del `04` § 2: un campo vacío afirma algo falso.
  assert.equal(etiquetas.includes('Correo'), false, 'el contacto se sembró sin correo: el campo no va');
  assert.equal(
    etiquetas.includes('Calificación'),
    false,
    'el `score` es nulo y nada lo calcula: la etiqueta no se dibuja vacía',
  );
  // Y el grupo es por SIGNIFICADO, no por el formulario del que salió el dato.
  assert.equal(r.cuerpo.campos.find((c) => c.etiqueta === 'Teléfono')?.grupo, 'detalles');
  assert.equal(r.cuerpo.campos.find((c) => c.etiqueta === 'Etiquetas')?.grupo, 'origen');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · EL ENCABEZADO DICE QUÉ PASÓ CON EL REFRESCO, HAYA PASADO LO QUE SEA
// ═══════════════════════════════════════════════════════════════════════════════

test('la ficha se abre igual sin credencial del CRM, y el `refresco` dice por qué no se actualizó', async () => {
  // Las dos mitades de la regla del `05` § 8, en la ruta que más cuesta:
  //
  //   · abrir la ficha NO depende de que el CRM contteste. Una ficha que se niega a abrir porque el
  //     CRM está caído es una ficha inútil justo cuando hay que trabajar sin él.
  //   · y el cuerpo dice qué pasó. Sin `refresco.porque`, «datos de hace un momento» y «no se pudo
  //     actualizar» se ven idénticos, y quien mira el estado del agente antes de escribir estaría
  //     leyendo algo viejo creyendo que es de ahora.
  //
  const k = await unContacto(esc, { nombre: 'Ficha refresco' });

  const r = await leerRespuesta<CuerpoDeFicha>(
    await verFicha(pedirComo(`/api/contactos/${k.id}`, esc.token), ctx(k.id)),
  );
  assert.equal(r.estado, 200, 'un refresco que no se puede hacer NO impide abrir la ficha');
  assert.equal(r.cuerpo.contacto.id, k.id);

  // El contacto sembrado SÍ tiene identificador en el CRM, así que la rama que se toma es la de la
  // credencial y no la de `sin_id`. Sin credencial cargada no hay llamada de red: el motivo lo pone
  // el resolvedor. Si en esta base hubiera una credencial, el motivo sería el del fallo de la
  // llamada — en los dos casos NO es nulo, que es la propiedad que importa.
  assert.ok(r.cuerpo.contacto.ghlContactId, 'el contacto sembrado tiene identificador del CRM');
  assert.equal(r.cuerpo.refresco.actualizado, false);
  assert.notEqual(
    r.cuerpo.refresco.porque,
    null,
    'un refresco que no se hizo tiene que decirlo: sin esto se ve igual que uno que sí se hizo',
  );
  /* ── Y LOS DOS CAMPOS DE LOS BOTONES QUITADOS NO VUELVEN ───────────────
   *
   * Antes acá se afirmaba `refresco.enlaceCrm === null`. Los botones «↗ Ver en GHL» y «◷ Agendar»
   * se quitaron a pedido, y con ellos los dos campos que **solo** ellos leían.
   *
   * La aserción se da vuelta —de «viene en nulo» a «no viene»— y no es lo mismo: un campo que se
   * sigue calculando y ya nadie dibuja **cuesta**. `enlaceAgendar` en particular era una consulta a
   * `identidad.organizaciones_credenciales` por cada apertura de ficha. Fijar la ausencia es lo que
   * impide que vuelva sin que nadie lo note, junto con la pantalla que dejó de pedirlo. */
  const crudo = r.cuerpo as unknown as Record<string, unknown>;
  assert.equal(
    'enlaceAgendar' in crudo,
    false,
    'volvió `enlaceAgendar`: es una consulta a las credenciales por cada apertura de ficha, para un ' +
      'enlace que ninguna pantalla dibuja',
  );
  assert.equal(
    'enlaceCrm' in (crudo.refresco as Record<string, unknown>),
    false,
    'volvió `refresco.enlaceCrm`: el botón que lo leía ya no existe',
  );
});

test('las cinco rutas de la ficha no dejan la respuesta en ningún caché intermedio', async () => {
  // `Cache-Control: no-store`, y no es cosmético: la cabecera que Next pone por omisión en una
  // respuesta dinámica no es `no-store`, así que una respuesta con la ficha de un contacto de un
  // inquilino podría quedar guardada en un intermediario. Es la fuga del `08` § 3, y se pierde por
  // omisión — nada falla el día que un manejador construye su `Response` a mano.
  const k = await unContacto(esc, { nombre: 'Ficha cabeceras' });

  for (const [nombre, manejador, camino] of LAS_CINCO) {
    const respuesta = await manejador(pedirComo(camino(k.id), esc.token), ctx(k.id));
    assert.equal(respuesta.status, 200, `${nombre} tenía que responder 200`);
    assert.equal(
      respuesta.headers.get('cache-control'),
      'no-store',
      `${nombre} tiene que responder \`no-store\`, no \`no-cache\`: uno prohíbe guardar, el otro no`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LO QUE HOY HACEN LAS TRES PESTAÑAS DE SÓLO LECTURA, Y NO ES LO MISMO QUE LA FICHA
//
// ⚠ COMPORTAMIENTO REAL, DOCUMENTADO SIN ARREGLAR.
//
// `perfil`, `historial` y `llamadas` NO comprueban que el contacto exista: consultan por
// `contacto_id`, no encuentran nada y responden **200 con la lista vacía y su `falta`**. Sólo
// `/api/contactos/[id]` devuelve 404.
//
// No es una fuga —y por eso esta prueba lo afirma en vez de asumirlo—: la respuesta de un contacto
// de otra organización es IDÉNTICA a la de un identificador inventado, así que no hay nada que
// aprender preguntando, y la letra de `ADR-0501` se cumple. Pero el resultado que ve una persona es
// un `falta` que dice «todavía no se trajeron los mensajes de este contacto» sobre un contacto que
// no existe, y eso es engañoso: la pestaña afirma que el contacto está y que lo que falta es la
// ingesta.
//
// Se deja escrito acá y se reporta. Si algún día las tres adoptan el 404 de la ficha, esta prueba
// falla — y eso es correcto: el cambio hay que verlo.
// ═══════════════════════════════════════════════════════════════════════════════

test('las cuatro pestañas de un contacto AJENO responden 404, igual que un identificador inventado', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA ERA UN DEFECTO DOCUMENTADO, Y SE ARREGLÓ
  //
  // Su versión anterior se llamaba *«responden 200 vacío, indistinguible de un identificador
  // inventado»* y afirmaba `estado === 200` con este comentario al lado: *«esta es la aserción que
  // hay que conservar si algún día las tres pasan a devolver 404: la que tiene que cambiar es la de
  // arriba, y las dos juntas»*. Es exactamente lo que se hizo.
  //
  // Lo que estaba mal del `200` vacío no era una fuga —no había ninguna, el aislamiento por fila
  // funcionaba— sino que es una TERCERA respuesta: dice «existe y no tiene nada». `ADR-0501` pide
  // que un dato de otra organización sea indistinguible de uno que no existe, y «no existe» es 404.
  // Y para quien mira la pantalla, «este contacto no tiene notas» y «este contacto no es tuyo» se
  // veían igual: cuatro pestañas en blanco, cada una con un `falta` que inventaba el motivo.
  //
  // La aserción que NO cambia es la de la igualdad byte por byte: es la que impide que estas rutas
  // se vuelvan un oráculo de existencia, y sigue siendo la más importante de las tres.
  // ══════════════════════════════════════════════════════════════════════
  const ajeno = await unContacto(esc, { org: esc.otraOrg, nombre: 'Ficha ajeno pestañas' });
  // Sembrado con historia, para que la única razón de que el cuerpo salga vacío sea el aislamiento.
  await unaNota(esc, ajeno.id, { org: esc.otraOrg, cuerpo: 'Ficha nota ajena', autorId: null });
  const inventado = randomUUID();

  for (const [nombre, manejador, camino] of LAS_CINCO.filter(([n]) => n !== 'la ficha')) {
    const deAjeno = await leerRespuesta<Record<string, unknown>>(
      await manejador(pedirComo(camino(ajeno.id), esc.token), ctx(ajeno.id)),
    );
    const deInventado = await leerRespuesta<Record<string, unknown>>(
      await manejador(pedirComo(camino(inventado), esc.token), ctx(inventado)),
    );

    assert.equal(
      deAjeno.estado,
      404,
      `${nombre} responde ${deAjeno.estado} para un contacto de otra organización: un 200 vacío ` +
        'dice «existe y no tiene nada», que es una tercera respuesta',
    );

    // Y 404 y no 403, que es la otra mitad de `ADR-0501`: un 403 confirma que el contacto existe.
    assert.notEqual(deAjeno.estado, 403, `${nombre} respondió 403 y confirmó que el contacto existe`);

    /* La aserción que se conserva intacta: las dos respuestas son la misma, byte por byte. En cuanto
       se diferencien —un 404 para el inventado y un 200 para el ajeno, o dos cuerpos distintos— la
       ruta se vuelve un oráculo de existencia y `ADR-0501` se rompe de verdad. */
    assert.deepEqual(
      { estado: deAjeno.estado, cuerpo: deAjeno.cuerpo },
      { estado: deInventado.estado, cuerpo: deInventado.cuerpo },
      `${nombre}: un contacto de otra organización tiene que responder EXACTAMENTE lo mismo que uno que no existe`,
    );

    // Y nada de la otra organización se filtró en el cuerpo.
    assert.equal(
      JSON.stringify(deAjeno.cuerpo).includes('Ficha nota ajena'),
      false,
      `${nombre} no puede devolver la historia de un contacto de otra organización`,
    );
  }

  /* Y el contraste que hace que el 404 signifique algo: el MISMO contacto, leído desde SU
     propia organización, SÍ tiene su nota. Sin esta mitad, las cuatro pestañas podrían
     responder 404 a todo el mundo —un `rechazo('no_encontrado')` al principio, o una consulta
     rota— y la prueba de arriba seguiría verde.
     Es el mismo control que la prueba de la ficha ya tiene, aplicado a las notas. Se invoca la
     función en el contexto de `otraOrg` y no por HTTP porque el escenario no tiene un token de
     esa organización. */
  const desdeSuOrg = await conOrganizacion(esc.otraOrg, () => notasDeLaFicha(ajeno.id));
  assert.equal(
    desdeSuOrg.filas.some((n) => n.cuerpo === 'Ficha nota ajena'),
    true,
    'la nota no aparece ni para su propia organización: el 404 de arriba podría ser un 404 para todos',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8 · LAS CUATRO RUTAS PASAN POR EL PORTERO DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════════

test('sin sesión válida las cinco rutas responden 401 `sin_sesion` y ninguna trae la ficha', async () => {
  /* Las diecisiete pruebas de arriba mandan la sesión de la administradora de `alfa`: ninguna llega a
   * la rama de RECHAZO del portero. Se comprobó mutándolo —cambiando el código de `sin_sesion` en
   * `portero.ts`— y las diecisiete seguían verdes, igual que en el `93`, el `94`, el `96` y el `97`.
   * O sea que una de estas cinco rutas podría perder su `exigir` y este archivo no lo notaría:
   * el guardia de `pruebas/codigo/` ve la línea escrita y no la ejecuta, que es la premisa entera
   * del encabezado.
   *
   * La ficha es la más grave de las cinco rutas para dejar sin puerta: el identificador viaja en
   * la URL y es adivinable, así que una ruta sin portero es el teléfono y el nombre de cualquier
   * contacto cargado, para cualquiera que sepa un uuid. */
  const k = await unContacto(esc, { nombre: 'Ficha sin sesion' });

  for (const [nombre, manejador, camino] of LAS_CINCO) {
    const { estado, cuerpo } = await leerRespuesta<Record<string, unknown>>(
      await manejador(pedirComo(camino(k.id), 'esta-sesion-no-existe'), ctx(k.id)),
    );
    assert.equal(estado, 401, `${nombre} contestó ${estado} sin sesión`);
    assert.equal(cuerpo['codigo'], 'sin_sesion', `${nombre}: el código es lo que manda al login`);
    // Y el rechazo no se disfraza de pestaña vacía: `ADR-0305` otra vez, y acá con datos de una
    // persona real del otro lado.
    for (const clave of ['contacto', 'campos', 'eventos', 'llamadas', 'falta']) {
      assert.equal(cuerpo[clave], undefined, `${nombre} devolvió \`${clave}\` en un rechazo`);
    }
  }
});
