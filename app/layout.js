import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TEMA, temaCss } from './tema.ts';

/* Las letras del brandbook v2, para toda la aplicación (`NE-24`). Reemplazan a Inter e IBM Plex Mono.

   Por el cargador de Next y NO por el paquete `geist` que trajo el PR #2: el paquete declara sus
   variables por su cuenta, y `pruebas/codigo/121-tokens-de-css.test.ts` sólo puede saber que un
   `var(--font-…)` existe si lo lee de un `variable:` de este archivo. Los nombres son los mismos que
   usaba el paquete, así que `/brand` (`app/brand/pagina.css`) no cambió.

   Sin `weight`: las dos son fuentes variables, y un solo archivo trae del 100 al 900. */
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata = {
  title: 'AIOS — Command Center',
  description: 'Centro de mando de ARIA IA',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    /* El tema lo sirve el servidor, fijo, y nadie lo cambia después: la aplicación es sólo oscura
       (`NE-23`, ver `app/tema.ts`). Antes este elemento salía con el valor por omisión y un guion en
       el `<head>` lo corregía con la copia del navegador antes del primer pintado; sin nada que
       corregir, el guion se fue, y con él el `suppressHydrationWarning` que su escritura obligaba. */
    <html
      lang="es"
      data-tema={TEMA}
      /* El mismo tema con el nombre del brandbook. Ver `temaCss`. */
      data-theme={temaCss(TEMA)}
      /* Y el lienzo del navegador, para que los controles nativos —barras de desplazamiento,
         campos, el fondo del sobredesplazamiento— acompañen. */
      style={{ colorScheme: temaCss(TEMA) }}
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <body>
        {children}
        {/* `<aria-mascot>` del brandbook: se registra UNA sola vez en toda la aplicación. El guion
            se auto-protege con `customElements.get('aria-mascot')`, que es lo que evita que el
            doble montaje de React en desarrollo intente definir el elemento dos veces y lance. */}
        <script defer src="/brand/mascota/aria-mascot.js" />
      </body>
    </html>
  );
}
