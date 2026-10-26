// Las condiciones de uso que Meta exige para aprobar la app (Meta directo, M6). Pública: `CAMINOS_PUBLICOS`.
// BORRADOR para que lo valide el área legal.
import { Contacto, HojaLegal } from '../legal/hoja-legal.tsx';

export const metadata = { title: 'Condiciones — ARIA IA' };

export default function Terminos() {
  return (
    <HojaLegal titulo="Condiciones de uso" version="26 de octubre de 2026">
      <p>
        Comando Central es una plataforma privada de ARIA IA. Sólo entran las personas que una empresa cliente de ARIA IA da
        de alta, con su usuario y contraseña, y su uso se rige por el contrato de servicios entre esa empresa y ARIA IA.
      </p>

      <h2>La conexión con Meta</h2>
      <p>
        Al conectar Meta, el negocio autoriza a ARIA IA a leer las cuentas publicitarias que elige, sólo para mostrarle su
        rendimiento dentro de Comando Central. La conexión es de lectura: Comando Central no crea, pausa ni modifica campañas
        ni gasta presupuesto. El negocio puede quitarla cuando quiera desde la configuración de su Business Manager, o
        desconectarla en Ajustes.
      </p>

      <h2>Los datos</h2>
      <p>
        Qué datos se reciben, para qué se usan y cómo se borran está en la <a href="/privacidad">política de privacidad</a>.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre estas condiciones, escribe a <Contacto />.
      </p>
    </HojaLegal>
  );
}
