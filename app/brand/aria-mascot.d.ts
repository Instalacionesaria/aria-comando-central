/* El tipo de `<aria-mascot>` para TSX.
 *
 * Sin esto, TypeScript trata cualquier etiqueta con guion como un error: no está en
 * `JSX.IntrinsicElements` y no hay forma de que lo deduzca solo. El componente vive en
 * `public/brand/mascota/aria-mascot.js` y se registra desde el layout.
 *
 * En React 19 el espacio de nombres `JSX` dejó de ser global y se declara DENTRO del módulo
 * `react`: la forma vieja (`declare global { namespace JSX }`) ya no lo alcanza.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/** Los ocho del brandbook. Se elige por lo que pasa, no por decoración. */
export type EstadoMascota =
  | 'neutral'
  | 'pensando'
  | 'escuchando'
  | 'hallazgo'
  | 'celebra'
  | 'alerta'
  | 'cargando'
  | 'sin-conexion';

interface AtributosMascota extends HTMLAttributes<HTMLElement> {
  /** Diámetro visible en px. Por debajo de 48 el componente aplica solo la versión mínima. */
  size?: number | string;
  state?: EstadoMascota;
  /** Presente: los ojos siguen el cursor. Sólo portada, asistente y login. */
  follow?: boolean | '';
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'aria-mascot': DetailedHTMLProps<AtributosMascota, HTMLElement>;
    }
  }
}
