// Cómo pedir el borrado de los datos (las instrucciones que Meta exige si la app no usa sólo la URL de borrado; Meta
// directo, M6). Pública: `CAMINOS_PUBLICOS`. BORRADOR para que lo valide el área legal.
import { Contacto, HojaLegal } from '../legal/hoja-legal.tsx';

export const metadata = { title: 'Borrado de datos — ARIA IA' };

export default function BorradoDeDatos() {
  return (
    <HojaLegal titulo="Borrado de datos" version="26 de octubre de 2026">
      <p>
        Puedes pedir que borremos lo que Comando Central leyó de tus cuentas publicitarias de Meta: campañas, conjuntos,
        anuncios, sus cifras y su gasto, junto con la conexión y su token.
      </p>

      <h2>Desde Meta</h2>
      <ul>
        <li>
          Si conectaste tu negocio: en tu Business Manager, entra a <b>Configuración del negocio › Integraciones › Integraciones
          de negocios</b>, elige la app de ARIA IA y quítala. Así dejamos de leer de inmediato.
        </li>
        <li>
          Para que además se borre lo leído: en Facebook, entra a <b>Configuración y privacidad › Configuración › Apps y sitios
          web</b>, elige la app de ARIA IA y pide que se eliminen tus datos. Meta nos reenvía el pedido, lo borramos y te da un
          código con el que puedes ver aquí en qué quedó.
        </li>
      </ul>

      <h2>Por correo</h2>
      <p>
        Escribe a <Contacto />, desde el correo con el que entras a Comando Central, indicando la empresa y las cuentas
        publicitarias. Te confirmamos por el mismo medio cuando esté hecho.
      </p>
    </HojaLegal>
  );
}
