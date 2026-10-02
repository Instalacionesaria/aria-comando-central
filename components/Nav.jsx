'use client';

/* La barra lateral de la estructura nueva (`docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`, `NE-11` a
 * `NE-18`), sobre el lienzo «Departamentos por dentro»: el logotipo y la empresa, «Nueva conversación»,
 * la Reunión de hoy, los cinco departamentos como acordeones y el pie con el engranaje.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LEE DE LA SESIÓN `navegacion` Y `arranque`, Y NADA MÁS
 *
 * Quién ve qué ya lo decidió el servidor con `menuVisible()`, y `menuPorDepartamentos()` lo repartió
 * (`lib/autorizacion/departamentos.ts`). Esta barra no vuelve a mirar permisos ni el menú agrupado: si
 * lo hiciera, habría dos definiciones de quién ve qué, que es el defecto que la Etapa 11 pagó cuando
 * este archivo eran diez entradas de JSX escritas a mano que cualquiera con sesión veía.
 * `pruebas/codigo/193-la-barra-lateral.test.ts` lo vigila.
 *
 * ── LA ENTRADA ABIERTA ──────────────────────────────────────────────────────
 *
 * La pantalla a la vista (`usarUbicacion`) y la pestaña que esa pantalla DIBUJA
 * (`usarPestanaDibujada`): Tools tiene seis entradas en tres departamentos, y cambia de pestaña por
 * dentro sin pasar por la navegación. Con las dos se marca la entrada (`entradaAbierta`) y se abre su
 * departamento. Sólo queda abierto el que está en uso, y en el Inicio ninguno, como en el lienzo; un
 * clic en la cabecera abre otro a mano.
 *
 * ── LO QUE NO SE DIBUJA, Y POR QUÉ ──────────────────────────────────────────
 *
 *   · CONVERSACIONES: es el historial del cerebro, que todavía no existe (`NE-11`.5);
 *   · el contador de la Reunión de hoy: sus temas tienen que salir de reglas sobre datos reales
 *     (`NE-05`). La fila dice «Próximamente», no navega, y sólo la ve quien ve el Inicio: un closer ve
 *     Sales › Closer y nada más (`NE-16`);
 *   · el ícono y el galón de cada sección, del menú viejo: la barra nueva dibuja el ícono de cada
 *     DEPARTAMENTO, del lienzo, en línea y sin el sprite (el sprite no tiene esos dibujos y no se le
 *     da a un símbolo un segundo significado).
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../app/sesion-contexto.tsx';
import { irALaVista } from '../lib/aios/shell.js';
import { usarPestanaDibujada, usarUbicacion } from '../lib/vista.ts';
import { entradaAbierta } from '../lib/autorizacion/departamentos.ts';
import MenuDeUsuario from './MenuDeUsuario.jsx';
import SelectorDeEmpresa from './SelectorDeEmpresa.jsx';
import { leerTrabajosEnVuelo, pestanaQueLoRetoma } from '../lib/tools/scrapers.ts';
import { CADENCIA, usarReloj } from '../lib/reloj.ts';

const SIN_NAVEGACION = { inicio: null, departamentos: [], engranaje: [] };

/** El ícono de cada departamento, del lienzo: 24 de caja, trazo de 1.6 y extremos redondeados. */
function IconoDelDepartamento({ clave }) {
  return (
    <svg className="nb-ico" viewBox="0 0 24 24" aria-hidden="true">
      {clave === 'research' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : null}
      {clave === 'systems' ? <path d="M3 12h4l3-7 4 14 3-7h4" /> : null}
      {clave === 'marketing' ? <path d="M14 6l4 4-8 8H6v-4z" /> : null}
      {clave === 'sales' ? <path d="M4 5h16v11H9l-5 4z" /> : null}
      {clave === 'client-success' ? <path d="M5 12l4 4 10-10" /> : null}
    </svg>
  );
}

/** Cuántos trabajos hay en vuelo, dicho para quien no ve el punto. */
function textoDelPunto(enVuelo) {
  const partes = [];
  if (enVuelo.scraper > 0) {
    partes.push(enVuelo.scraper === 1 ? 'un scraping corriendo en el Scraper' : `${enVuelo.scraper} scrapings corriendo en el Scraper`);
  }
  if (enVuelo.espia > 0) {
    partes.push(enVuelo.espia === 1 ? 'una búsqueda corriendo en el Espía de anuncios' : `${enVuelo.espia} búsquedas corriendo en el Espía de anuncios`);
  }
  const texto = partes.join(' y ');
  return texto ? texto[0].toUpperCase() + texto.slice(1) : '';
}

export default function Nav() {
  const sesion = useSesion();
  // Sin sesión, ninguna entrada: el `03` § 5, «una operación nueva nace cerrada», llevado al menú.
  const navegacion = sesion?.navegacion ?? SIN_NAVEGACION;
  const { inicio, departamentos, engranaje } = navegacion;

  /* ── EL PUNTO DE «HAY UN SCRAPING CORRIENDO» ──────────────────────────────
     Vive en la barra y no en Tools porque el punto es justamente verlo DESDE OTRA PANTALLA: un
     scraping tarda minutos y lo normal es irse a Setter o a Closer mientras corre. Va en la entrada
     donde el trabajo se vuelve a ver (`pestanaQueLoRetoma`, con el detalle de quién retoma qué), y en
     la cabecera de Research cuando está cerrado: si no, desde Sales no se vería.

     Sólo consulta quien ve Tools. El reloj compartido frena con la pestaña oculta y dispara al volver
     (`lib/reloj.ts`), y la PRIMERA lectura la hace este componente: el reloj repite, quien abre pide. */
  const puedeVerTools = departamentos.some((d) => d.entradas.some((e) => e.seccion === 'tools'));
  const [enVuelo, setEnVuelo] = useState({ espia: 0, scraper: 0 });
  const mirar = useCallback(async () => {
    const cuenta = { espia: 0, scraper: 0 };
    for (const t of await leerTrabajosEnVuelo()) cuenta[pestanaQueLoRetoma(t.fuente)] += 1;
    // El mismo objeto si nada cambió: si no, cada vuelta del reloj redibujaría la barra entera.
    setEnVuelo((antes) => (antes.espia === cuenta.espia && antes.scraper === cuenta.scraper ? antes : cuenta));
  }, []);
  useEffect(() => {
    if (!puedeVerTools) return;
    void mirar();
  }, [puedeVerTools, mirar]);
  usarReloj(puedeVerTools ? 'tools:enVuelo' : null, mirar, CADENCIA.puntitoDeTools);
  const textoEnVuelo = textoDelPunto(enVuelo);

  /* ── DÓNDE ESTÁS ──────────────────────────────────────────────────────────
     En el primer dibujo, antes de leer el DOM, vale la pantalla de arranque. Al abrir una entrada de
     Tools desde otra pantalla, el primer dibujo lleva la pestaña que Tools dibujó la vez anterior:
     Tools anuncia la nueva en su efecto de diseño y la barra se corrige en el mismo tic, antes de
     pintar. */
  const vista = usarUbicacion() ?? sesion?.arranque?.seccion.clave ?? null;
  const pestana = usarPestanaDibujada(vista);
  const abierta = entradaAbierta(navegacion, vista, pestana);
  const enUso = abierta?.departamento ?? null;

  /* El departamento desplegado SIGUE al que está en uso cada vez que éste cambia —se ajusta en el
     dibujo, como el pedido en las pantallas—, y entre un cambio y otro lo mueve la cabecera. */
  const [desplegado, setDesplegado] = useState(enUso);
  const [enUsoVisto, setEnUsoVisto] = useState(enUso);
  if (enUso !== enUsoVisto) {
    setEnUsoVisto(enUso);
    setDesplegado(enUso);
  }

  return (
    <>
      {/* El `id` es el ancla del `aria-controls` del conmutador de `TopBar.jsx`. */}
      <nav className="nav" id="navPrincipal" aria-label="Principal">
        <div className="nb-cabeza">
          {/* El archivo de la marca, nunca escrito con una fuente (`NE-11`). */}
          <img className="nb-logo" src="/brand/assets/logos/aria-wordmark-dark.svg" alt="ARIA" />
          <SelectorDeEmpresa sesion={sesion} />
        </div>

        {inicio ? (
          <button
            type="button"
            className={vista === inicio.seccion ? 'nb-nueva on' : 'nb-nueva'}
            aria-current={vista === inicio.seccion ? 'page' : undefined}
            onClick={() => irALaVista(inicio.seccion)}
          >
            <svg className="nb-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva conversación
          </button>
        ) : null}

        {inicio ? (
          <div className="nb-reunion">
            <svg className="nb-ico" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2" />
            </svg>
            <span className="n">Reunión de hoy</span>
            <span className="nb-proximamente">Próximamente</span>
          </div>
        ) : null}

        {departamentos.length > 0 ? (
          <div className="nb-departamentos">
            <span className="nb-rotulo">DEPARTAMENTOS</span>
            {departamentos.map((d) => {
              const desplegadoEste = desplegado === d.clave;
              const puntoEnLaCabecera =
                !desplegadoEste &&
                d.entradas.some((e) => e.seccion === 'tools' && e.pestana !== null && enVuelo[e.pestana] > 0);
              return (
                <div className="nb-departamento" key={d.clave}>
                  <button
                    type="button"
                    className={desplegadoEste ? 'nb-cabecera abierta' : 'nb-cabecera'}
                    aria-expanded={desplegadoEste}
                    aria-controls={`nbDepartamento-${d.clave}`}
                    aria-describedby={puntoEnLaCabecera ? 'navScrapeando' : undefined}
                    onClick={() => setDesplegado(desplegadoEste ? null : d.clave)}
                  >
                    <IconoDelDepartamento clave={d.clave} />
                    <span className="n">{d.nombre}</span>
                    {puntoEnLaCabecera ? <span className="nav-scrapeando" aria-hidden="true" /> : null}
                    <svg className="nb-galon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                  {/* Cerrado se esconde con `hidden` y no se deja de dibujar: así el `aria-controls`
                      siempre apunta a algo, y lo escondido sale del orden del tabulador. */}
                  <div className="nb-entradas" id={`nbDepartamento-${d.clave}`} hidden={!desplegadoEste}>
                    {d.entradas.map((e) => {
                      if (e.proximamente) {
                        /* «Próximamente» (`NE-13`): no es un botón, no navega y no lleva el atributo
                           que la navegación busca. Dice la palabra: el tono no alcanza, porque una
                           entrada en reposo ya es el piso del texto de la marca. */
                        return (
                          <div className="nb-proxima" key={e.nombre}>
                            <span className="n">{e.nombre}</span>
                            <span className="nb-proximamente">Próximamente</span>
                          </div>
                        );
                      }
                      const marcada = abierta?.departamento === d.clave && abierta.nombre === e.nombre;
                      const punto = e.seccion === 'tools' && e.pestana !== null && enVuelo[e.pestana] > 0;
                      return (
                        <button
                          type="button"
                          className={marcada ? 'nav-item on' : 'nav-item'}
                          key={e.nombre}
                          data-view={e.seccion}
                          aria-current={marcada ? 'page' : undefined}
                          aria-describedby={punto ? 'navScrapeando' : undefined}
                          onClick={() => irALaVista(e.seccion, { pestana: e.pestana })}
                        >
                          <span className="n">{e.nombre}</span>
                          {punto ? <span className="nav-scrapeando" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* El pie: la persona, ADMIN o USUARIO, y el engranaje con el único menú de la cuenta
            (`NE-14`). Vive entero en `MenuDeUsuario.jsx`, con su cierre de sesión. */}
        <div className="nav-foot">
          <MenuDeUsuario sesion={sesion} engranaje={engranaje} alIrALaSeccion={irALaVista} />
        </div>
      </nav>

      {/* Lo que el punto dice, para un lector de pantalla. Una región viva SIEMPRE montada y FUERA de
          la barra: en el teléfono el cajón cerrado lleva `visibility: hidden`, que saca todo lo de
          adentro del árbol de accesibilidad, y una región que aparece de golpe no se anuncia. */}
      <span className="para-lectores" id="navScrapeando" role="status">
        {textoEnVuelo}
      </span>
    </>
  );
}
