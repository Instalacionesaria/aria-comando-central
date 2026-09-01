'use client';

/* Portado de aios-command-center_1.html — navegación lateral, líneas 2514-2550.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ESTE ARCHIVO ERA DIEZ ENTRADAS DE JSX LITERAL, Y ESO ERA EL DEFECTO
 *
 * `lib/autorizacion/secciones.ts` declaraba qué pantallas correspondían a cada capacidad, y
 * este archivo dibujaba las diez a cualquiera con sesión. Las dos pruebas que miraban esa
 * lista quedaban verdes verificando un arreglo que ningún píxel usaba — la forma exacta del
 * `07` § 0: *"un éxito reportado que no ocurrió"*.
 *
 * La deuda estaba escrita y fechada: *"unificarlos exige reescribir `Nav.jsx` como un `.map()`
 * que produzca un DOM idéntico al del prototipo, o `npm run paridad` empieza a fallar y se
 * termina desactivando. Eso es trabajo de la etapa que le dé interfaz a la primera pantalla
 * administrada, no de ésta."*
 *
 * Esa etapa es la 11, porque es la primera en que la pantalla que gana operaciones **no la ve
 * todo el mundo**: un closer no puede ver la pestaña del setter. Con el menú escrito a mano,
 * *"solo ve su pestaña"* habría sido falso — vería las diez entradas y ocho le responderían
 * 403 al abrirlas.
 *
 * ── EL DOM ES IDÉNTICO, Y ES UN REQUISITO ──────────────────────────────────
 *
 * Con todas las capacidades el `.map()` produce exactamente el mismo árbol que el JSX literal:
 * mismas clases, mismo orden, mismos `data-view`, el galón `›` en las mismas cinco. Es lo que
 * permite que `npm run paridad` siga comparando el port con el original. Si esto divergiera, la
 * única compuerta que valida el port empezaría a dar rojo y terminaría desactivada.
 *
 * ── Y LO QUE DEJÓ DE ESTAR ESCRITO A MANO ──────────────────────────────────
 *
 * El nombre de la organización y el de la persona estaban FIJOS en el JSX —el de la primera
 * organización y el de su fundador, escritos a mano—. El de la organización es justo el dato
 * que el `03` § 3 exige mostrar bien: *"sin eso, alguien puede mirar la pantalla, sacar una
 * conclusión sobre 'los números' y estar viendo los de otro cliente"*. Y estaba fijo, o sea
 * que todos los inquilinos veían el del primero.
 *
 * Las dos cadenas no se repiten acá ni en un comentario, a propósito: la prueba que impide que
 * vuelvan busca el TEXTO en este archivo, y nombrarlas en la explicación la haría fallar. Están
 * en `pruebas/codigo/91-closer-y-setter.test.ts`, que es donde corresponde.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../app/sesion-contexto.tsx';
import { aplicar, recordar, TEMA_POR_OMISION } from '../app/tema.ts';
import BotonDeTema from './BotonDeTema.jsx';
import { irALaVista } from '../lib/aios/shell.js';
import MenuDeUsuario from './MenuDeUsuario.jsx';
import SelectorDeEmpresa from './SelectorDeEmpresa.jsx';
import { leerTrabajosEnVuelo } from '../lib/tools/scrapers.ts';
import { CADENCIA, usarReloj } from '../lib/reloj.ts';

/**
 * Cada cuánto se pregunta si hay un scraping corriendo.
 *
 * La cadencia se mudó a `lib/cadencia.ts` con el resto, y no es un traslado cosmético: mientras
 * vivió acá, este reloj tuvo su propio bucle de `setTimeout` y **no respetaba la pestaña oculta**.
 * El motivo largo está allá.
 */

/** Las iniciales para el avatar. Dos letras, de las dos primeras palabras. */
function iniciales(nombre) {
  const partes = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '··';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function Nav() {
  const sesion = useSesion();

  /* ── EL PUNTITO DE «HAY UN SCRAPING CORRIENDO» ────────────────────────────
     Vive acá y no en la pantalla Tools porque el punto es justamente verlo DESDE OTRA PANTALLA:
     un scraping tarda minutos y lo normal es irse a Setter o a Closer mientras corre. El menú
     está montado siempre, así que es el único lugar desde donde se ve estando en cualquier
     parte.

     Sólo consulta si la persona puede ver Tools. Un closer que nunca va a scrapear no tiene por
     qué hacer una petición cada veinte segundos por un indicador que no le sirve. */
  const puedeVerTools = (sesion?.menu ?? [])
    .flatMap((g) => g.secciones)
    .some((x) => x.clave === 'tools');
  const [scrapeando, setScrapeando] = useState(0);

  /* ── ESTE RELOJ ERA EL ÚNICO QUE NO MIRABA SI LA PESTAÑA ESTABA A LA VISTA ──
   *
   * Acá había un bucle de `setTimeout` propio que se reprogramaba solo. Hacía bien una cosa —no
   * apilar peticiones cuando la respuesta tarda— y por hacerla a mano se perdía la otra:
   * `lib/reloj.ts` **frena todos sus relojes con la pestaña oculta**, y éste no estaba entre
   * ellos. Resultado medido: 180 peticiones por hora y por persona conectada, corrieran o no
   * scrapings, mirara o no alguien la aplicación.
   *
   * `usarReloj` da las dos cosas y una tercera: al volver de una pestaña oculta dispara enseguida,
   * así que el punto está al día apenas se vuelve, en vez de hasta veinte segundos después.
   *
   * ── LA PRIMERA LECTURA LA HACE ESTE COMPONENTE, NO EL RELOJ ───────────────
   *
   * Es la división que `registrarReloj` documenta y que aprendió fallando: el reloj REPITE, y
   * quien abre pide sus datos. Si la primera lectura dependiera del reloj, montar con la pestaña
   * oculta dejaría el punto apagado hasta volver — y un punto apagado no se distingue de «no hay
   * ningún scraping». */
  const mirar = useCallback(async () => {
    const enVuelo = await leerTrabajosEnVuelo();
    setScrapeando(enVuelo.length);
  }, []);

  useEffect(() => {
    if (!puedeVerTools) return;
    void mirar();
  }, [puedeVerTools, mirar]);

  /* Con `null` no se registra nada: quien no tiene Tools no paga ni una petición por un punto que
     su menú ni siquiera dibuja. */
  usarReloj(puedeVerTools ? 'tools:enVuelo' : null, mirar, CADENCIA.puntitoDeTools);

  // Sin datos de sesión no se dibuja NINGUNA entrada. Es el `03` § 5 —*"una operación nueva
  // nace cerrada"*— llevado al menú: ante la duda, ninguna puerta, no todas.
  //
  // En la práctica no pasa: `app/guardia.tsx` no monta el armazón hasta tener la respuesta. El
  // caso que esto cubre es el montaje de este componente fuera de la guarda.
  const todos = sesion?.menu ?? [];
  // El cuerpo del menú y el pie salen de la MISMA lista, separados por la bandera `pie` del
  // grupo. Si el pie tuviera su propia lista, volveríamos a tener dos que se pueden
  // desordenar una respecto de la otra — el defecto que esta etapa pagó.
  const grupos = todos.filter((g) => !g.grupo.pie);
  const enElPie = todos.filter((g) => g.grupo.pie).flatMap((g) => g.secciones);

  // La primera sección visible arranca activa. NO `executive` fijo: para un closer esa pantalla
  // no existe, y el `on` escrito a mano dejaba el área principal en blanco sin que nada falle.
  //
  // LA REGLA YA NO ESTÁ ACÁ, y sacarla no fue prolijidad: estaba escrita en este archivo, otra vez
  // en `CommandCenter.jsx`, y **faltaba** en la miga de pan — que por eso le decía «Executive» a
  // alguien que no ve Executive. Ahora la decide el servidor, una vez, y las tres partes leen el
  // mismo campo. El motivo completo está en `seccionDeArranque`.
  const primera = sesion?.arranque?.seccion.clave;

  /* El tema que se está mostrando. Arranca con el de la sesión —la verdad, que viene de la base— y
     el botón lo mueve en el acto sin esperar al servidor: ver `BotonDeTema.jsx`. Es estado local
     porque el contexto de sesión no se vuelve a pedir al cambiarlo, y volver a pedirlo por un
     interruptor sería una consulta entera para una palabra. */
  const [tema, setTema] = useState(sesion?.tema ?? TEMA_POR_OMISION);

  /* Y la verdad manda cuando llega. Esto es lo que hace que cambiar el tema en OTRA máquina se vea
     acá al entrar, en vez de quedar pegado a lo que este navegador recuerda en su copia local. */
  useEffect(() => {
    if (!sesion?.tema) return;
    setTema(sesion.tema);
    aplicar(sesion.tema);
    recordar(sesion.tema);
  }, [sesion?.tema]);

  return (
    <>
    <aside className="nav">
      {/* El botón de la empresa ES el conmutador. Antes solo mostraba el nombre y no hacía
          nada, y eso creó un encierro: la única forma de cambiar de empresa era la pestaña
          Empresas, que solo se ve desde la principal — así que conmutarse quitaba de la
          pantalla el único control con el que se podía volver. Ver `SelectorDeEmpresa.jsx`. */}
      <SelectorDeEmpresa sesion={sesion} />
      {grupos.map(({ grupo, secciones }) => (
        <div className="nav-group" key={grupo.clave}>
          {/* El primer grupo no lleva etiqueta en el prototipo, y el `null` lo dice desde
              `GRUPOS_DEL_MENU` en vez de dejarlo a que alguien se acuerde acá. */}
          {grupo.etiqueta ? <div className="nav-label">{grupo.etiqueta}</div> : null}
          {secciones.map((s) => (
            <div
              className={s.clave === primera ? 'nav-item on' : 'nav-item'}
              data-view={s.clave}
              key={s.clave}
            >
              <svg className="ni" viewBox="0 0 16 16">
                <use href={s.menu.icono} />
              </svg>
              <span className="n">
                {s.nombre}
              </span>
              {/* El puntito late sólo en la fila de Tools y sólo si hay algo corriendo. Lleva
                  `title` y texto para lectores de pantalla porque un punto de color no dice
                  nada por sí solo — y esto es información, no decoración. */}
              {s.clave === 'tools' && scrapeando > 0 ? (
                <span
                  className="nav-scrapeando"
                  /* `role="status"` y `aria-label`, no un `<i>` mudo: un punto de color no dice
                     nada por sí solo, y esto es información —hay plata corriendo— no adorno.
                     El `title` da lo mismo al pasar el cursor. */
                  role="status"
                  title={scrapeando === 1 ? 'Un scraping corriendo' : `${scrapeando} scrapings corriendo`}
                  aria-label={scrapeando === 1 ? 'Un scraping corriendo' : `${scrapeando} scrapings corriendo`}
                />
              ) : null}
              {s.menu.galon ? <span className="chev">›</span> : null}
            </div>
          ))}
        </div>
      ))}
      <div className="nav-foot">
        {/* AJUSTES NO TIENE FILA PROPIA: se llega desde el desplegable de la cuenta, que es
            justo el que está acá. Tenerlo en los dos lugares eran dos controles para lo mismo a
            unos píxeles de distancia.

            Y sacar la fila obligó a arreglar el enrutado de verdad. El desplegable no enrutaba:
            simulaba el clic de esta fila, así que sin fila el botón se apretaba y no pasaba
            nada, en silencio. Ahora las dos cosas llaman a `irALaVista`, que es el único lugar
            que decide qué significa abrir una pantalla. Ver `lib/aios/shell.js`.

            La fila del nombre ES el disparador, y su menú abre hacia arriba: es lo último de la
            barra, así que hacia abajo se saldría de la pantalla. El modificador está en
            `app/armazon.css`.

            La sección se le pasa como DATO. Con la clave escrita a mano acá volvería la lista
            paralela por la puerta de atrás: un `data-view` literal en este archivo es
            exactamente lo que la prueba de la Etapa 11 prohíbe, y con razón — el día que la
            clave cambie, el menú seguiría funcionando y este atajo no. */}
        <MenuDeUsuario
          sesion={sesion}
          seccion={enElPie[0] ?? null}
          alIrALaSeccion={(clave, nombre) => {
            irALaVista(clave, nombre);
          }}
        />
        {/* El interruptor de tema, AL COSTADO de la persona: es una preferencia personal —se guarda
            por persona, no por empresa— así que va en el rincón donde ya está lo que es tuyo.
            `tema` sale de la sesión, o sea de la base. Ver `app/tema.ts`. */}
        <BotonDeTema tema={tema} alCambiar={setTema} />
      </div>
    </aside>
    </>
  );
}
