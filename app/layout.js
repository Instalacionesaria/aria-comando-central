import { Inter, IBM_Plex_Mono } from 'next/font/google';
/* Las del brandbook v2. Conviven con Inter/Plex a propósito: la aplicación NO se migró todavía
   —eso es pantalla por pantalla, y su inventario está en `brand/MIGRACION.md`—, así que Geist
   por ahora sólo alimenta `--font-sans`/`--font-mono` dentro de `[data-marca="v2"]`. */
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { TEMA, temaCss } from './tema.ts';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
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
      className={`${inter.variable} ${plexMono.variable} ${GeistSans.variable} ${GeistMono.variable}`}
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
