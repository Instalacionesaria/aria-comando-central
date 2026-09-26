import { Inter, IBM_Plex_Mono } from 'next/font/google';
/* Las del brandbook v2. Conviven con Inter/Plex a propósito: la aplicación NO se migró todavía
   —eso es pantalla por pantalla, y su inventario está en `brand/MIGRACION.md`—, así que Geist
   por ahora sólo alimenta `--font-sans`/`--font-mono` dentro de `[data-marca="v2"]`. */
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { GUION_DE_ARRANQUE, TEMA_POR_OMISION, temaCss } from './tema.ts';

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
    /* `data-tema` se sirve con el valor por omisión y el guion de abajo lo corrige ANTES del primer
       pintado. Servirlo vacío haría que el primer cuadro no tuviera tema y se viera la paleta cruda
       del prototipo por un instante. */
    <html
      lang="es"
      data-tema={TEMA_POR_OMISION}
      /* El mismo tema con el nombre del brandbook. El guion de arranque lo corrige junto con
         `data-tema`, así que nunca quedan en desacuerdo. Ver `temaCss` en `app/tema.ts`. */
      data-theme={temaCss(TEMA_POR_OMISION)}
      className={`${inter.variable} ${plexMono.variable} ${GeistSans.variable} ${GeistMono.variable}`}
      /* ── POR QUÉ SE CALLA EL AVISO DE HIDRATACIÓN, Y SÓLO ACÁ ──────────────
         El guión de arranque toca este mismo elemento antes de que React hidrate: le corrige
         `data-tema` y le escribe `style.color-scheme`. React compara lo que sirvió el servidor con
         lo que encuentra, ve un `style` que no puso, y avisa **«This won't be patched up»** — o sea
         que abandona la reconciliación de este nodo. Eso no es ruido: es React diciendo que dejó de
         manejar el `<html>`.
         Y el servidor no puede evitarlo sirviendo el valor correcto: no lo sabe. Sirve
         `TEMA_POR_OMISION` a propósito —la preferencia vive en la base, a un `fetch` de distancia—
         y el guión existe justamente para corregirlo antes del primer pintado.
         `suppressHydrationWarning` es la respuesta que React documenta para exactamente este caso.
         Va SOLO en este elemento, que tiene cuatro atributos y ninguno con datos de nadie. */
      suppressHydrationWarning
    >
      <head>
        {/* ── EL GUION QUE GANA EL PRIMER CUADRO ────────────────────────────
            La preferencia vive en la base, y la base está a un `fetch` de distancia: `app/guardia.tsx`
            recién la pregunta cuando el navegador ya pintó. Sin esto, quien eligió claro ve un
            cuadro oscuro en CADA carga y después el claro — el parpadeo clásico de los temas.

            Va acá, síncrono y en el `<head>`, porque es el único momento en que se puede ganar ese
            cuadro: cualquier código de React llega tarde. Lee la copia local, no la base; la base
            manda apenas contesta, y si contradice a la copia, gana la base.

            `dangerouslySetInnerHTML` es la forma que React tiene de emitir un script en línea, y el
            contenido es una constante de este repositorio: no hay ni un dato de nadie adentro. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_DE_ARRANQUE }} />
      </head>
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
