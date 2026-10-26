// El marco de las páginas públicas que pide Meta (Meta directo, M6): la marca, el título, la fecha de la versión, el
// texto y un pie con las otras tres. Sin sesión, sin datos de nadie.
//
// Los textos son un BORRADOR que valida el área legal antes de publicarse (ver el kit de la revisión de la app). El
// correo de contacto sale de `CONTACTO_DE_PRIVACIDAD`: no se escribe acá un correo que nadie confirmó.
import type { ReactNode } from 'react';
import './legal.css';

/** El correo al que se escribe por privacidad o borrado, o `null` si todavía no se configuró. */
export function contactoDePrivacidad(): string | null {
  const v = process.env.CONTACTO_DE_PRIVACIDAD?.trim();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/** El contacto, como enlace, o la frase que lo reemplaza mientras no esté configurado. Va siempre después de «a». */
export function Contacto() {
  const correo = contactoDePrivacidad();
  return correo ? <a href={`mailto:${correo}`}>{correo}</a> : <>ARIA IA, al correo de contacto que figura en tu contrato</>;
}

export function HojaLegal({ titulo, version, children }: { titulo: string; version?: string; children: ReactNode }) {
  return (
    <main className="legal">
      <article className="legal-hoja">
        <span className="legal-marca">ARIA IA · COMANDO CENTRAL</span>
        <h1>{titulo}</h1>
        {version ? <p className="legal-fecha">Versión del {version}</p> : null}
        {children}
        <footer className="legal-pie">
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Condiciones</a>
          <a href="/borrado-de-datos">Borrado de datos</a>
        </footer>
      </article>
    </main>
  );
}
