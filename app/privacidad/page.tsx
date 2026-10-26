// La política de privacidad que Meta exige para aprobar la app (Meta directo, M6). Pública: `CAMINOS_PUBLICOS`.
// BORRADOR para que lo valide el área legal: dice lo que hace el código hoy, y nada que no haga.
import { Contacto, HojaLegal } from '../legal/hoja-legal.tsx';

export const metadata = { title: 'Privacidad — ARIA IA' };

export default function Privacidad() {
  return (
    <HojaLegal titulo="Política de privacidad" version="26 de octubre de 2026">
      <p>
        Comando Central es la plataforma de ARIA IA con la que las empresas que contratan nuestros servicios —y su equipo— ven
        en un solo lugar su publicidad, sus contactos y sus ventas. Esta política explica qué datos recibimos de Meta cuando un
        negocio conecta su cuenta, para qué los usamos y cómo pedir que se borren.
      </p>

      <h2>Qué datos recibimos de Meta</h2>
      <p>
        Sólo los de las cuentas publicitarias que el negocio elige al conectar Meta con «Conectar con Meta», con el permiso de
        lectura de anuncios (<code>ads_read</code>). De esas cuentas:
      </p>
      <ul>
        <li>el nombre, la moneda, la zona horaria y el estado de cada cuenta publicitaria;</li>
        <li>sus campañas, conjuntos de anuncios y anuncios: nombre, estado, objetivo y presupuesto;</li>
        <li>
          las cifras agregadas de su entrega: gasto, impresiones, clics, alcance, frecuencia, resultados, reproducciones de
          video, y su reparto por ubicación, plataforma, edad y género, dispositivo y país;
        </li>
        <li>la miniatura y el enlace de cada anuncio.</li>
      </ul>
      <p>
        No recibimos datos de las personas que vieron los anuncios ni de perfiles de Facebook o Instagram: las cifras son
        totales que da Meta. La conexión usa un token del negocio (no de una persona), que guardamos cifrado.
      </p>

      <h2>Para qué los usamos</h2>
      <p>
        Para mostrarle al negocio y a su equipo, dentro de Comando Central, cuánto gastó, qué rindió cada campaña y cada
        anuncio, y cómo se relaciona con sus contactos y ventas. No vendemos estos datos, no los usamos para publicidad propia
        ni los compartimos con otros clientes.
      </p>
      <p>
        Los procesan por nuestra cuenta los proveedores de la infraestructura en la que corre Comando Central (alojamiento y
        base de datos) y, para redactar recomendaciones sobre la publicidad, un proveedor de inteligencia artificial que recibe
        cifras agregadas.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la conexión esté activa leemos los últimos 12 meses y cada día los nuevos. Si el negocio desconecta Meta o
        quita la app, dejamos de leer. Lo ya leído se borra cuando el negocio lo pide (abajo) o cuando termina su contrato.
      </p>

      <h2>Cómo pedir que se borren</h2>
      <p>
        Mira <a href="/borrado-de-datos">Borrado de datos</a>. También puedes escribirnos a <Contacto />.
      </p>
    </HojaLegal>
  );
}
