'use client';

import { useEffect } from 'react';

import { bootAios } from '@/lib/aios';
import { useSesion } from '../app/sesion-contexto.tsx';

import IconSprite from './IconSprite';
import TopBar from './TopBar';
import Nav from './Nav';
import SidePanel from './SidePanel';
import AskBar from './AskBar';
import Overlays from './Overlays';

import ExecutiveView from './views/ExecutiveView';
import AcquisitionView from './views/AcquisitionView';
import CreativeView from './views/CreativeView';
import ConversionView from './views/ConversionView';
import ConversationView from './views/ConversationView';
import SalesView from './views/SalesView';
import IcpView from './views/IcpView';
import ContactsView from './views/ContactsView';
import SetterView from './views/SetterView';
import CloserView from './views/CloserView';
import ToolsView from './views/ToolsView';
import AjustesView from './views/AjustesView';

/* La vista de cada pantalla, por su clave.
 *
 * Es la CUARTA de las cuatro copias que `lib/autorizacion/secciones.ts` nombraba —los
 * `id="v-…"` de `components/views/*View.jsx`— y acá pasa a estar atada a la clave de la
 * sección, en vez de repetida en un archivo aparte. Una clave sin entrada en este mapa no se
 * dibuja, y eso es rojo en la prueba que cruza las dos listas. */
const VISTAS = {
  executive: ExecutiveView,
  contacts: ContactsView,
  icp: IcpView,
  acquisition: AcquisitionView,
  creative: CreativeView,
  conversion: ConversionView,
  conversation: ConversationView,
  sales: SalesView,
  setter: SetterView,
  closer: CloserView,
  tools: ToolsView,
  credenciales: AjustesView,
};

export default function CommandCenter() {
  const sesion = useSesion();

  /* React sólo pinta el esqueleto; el contenido de cada vista lo sigue
     rellenando la capa imperativa portada del HTML, igual que antes. */
  useEffect(() => {
    bootAios();
  }, []);

  // Las pantallas visibles, en el orden del menú. Se dibujan SOLO ésas.
  //
  // Antes se dibujaban las diez siempre. Con el menú filtrado eso dejaría nueve `<section
  // class="view">` en el DOM que ninguna entrada del menú puede alcanzar — inalcanzables pero
  // presentes, que es la clase de cosa que después alguien encuentra y no entiende. No hay dato
  // de inquilino en ellas (son maquetado del prototipo), así que esto no cierra una fuga: cierra
  // una confusión.
  const visibles = (sesion?.menu ?? []).flatMap((g) => g.secciones.map((s) => s.clave));
  const arranque = sesion?.arranque?.seccion.clave;

  return (
    <>
      <IconSprite />

      <div className="app">
        <TopBar arranque={sesion?.arranque ?? null} />
        <Nav />

        <main className="main">
          {visibles.map((clave, i) => {
            const Vista = VISTAS[clave];
            if (!Vista) return null;
            // La de arranque arranca activa, no `executive` fijo: para un closer esa pantalla no
            // existe, y el `on` escrito a mano en `ExecutiveView` dejaba el área principal en
            // blanco sin que nada falle.
            //
            // Se compara por CLAVE y no por `i === 0`. Con el índice, esto y `Nav.jsx` coincidían
            // solo mientras las dos listas se recorrieran igual — y son dos listas distintas: acá
            // se aplanan los grupos y allá no, así que la regla «cuerpo antes que pie» no se podía
            // ni expresar. Ahora las dos preguntan lo mismo.
            return <Vista key={clave} activa={clave === arranque} />;
          })}
        </main>

        <SidePanel />
        <AskBar arranque={sesion?.arranque ?? null} />
      </div>

      <Overlays />
    </>
  );
}
