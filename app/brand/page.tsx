/* /brand — la página de verificación del sistema de marca v2.
 *
 * Existe para poder MIRAR los tokens aplicados sin haber migrado la aplicación. Todo lo que
 * dibuja sale de `brand/tokens.json`, que es la fuente que `BRAND.md` nombra para herramientas:
 * no hay un solo hex escrito acá, así que la página no puede desincronizarse del brandbook.
 *
 * El envoltorio lleva `data-marca="v2"`, y ese atributo es lo único que hace que los tokens del
 * brandbook ganen. Fuera de esta página la aplicación sigue exactamente como estaba.
 */
import type { Metadata } from 'next';
import tokens from '@/brand/tokens.json';
import './pagina.css';
import type { EstadoMascota } from './aria-mascot.d.ts';

export const metadata: Metadata = {
  title: 'Marca · ARIA Brandbook v2.0',
  description: 'Verificación de los tokens, la tipografía, los componentes base y la mascota.',
};

/* Los cinco `lesson-*` traen una cadena suelta en vez de `{dark, light}`: valen lo mismo en los
   dos temas. Sin esto, mostrar `.dark` daría `undefined` en la ficha. */
function valorOscuro(valor: string | { dark: string; light: string }): string {
  return typeof valor === 'string' ? valor : valor.dark;
}

const ESTADOS: EstadoMascota[] = [
  'neutral',
  'pensando',
  'escuchando',
  'hallazgo',
  'celebra',
  'alerta',
  'cargando',
  'sin-conexion',
];

export default function PaginaMarca() {
  return (
    <div data-marca="v2">
      <div className="m-ancho">
        <h1 className="m-titulo">
          <span className="l1">El sistema</span>
          <span className="l2">de marca.</span>
        </h1>
        <p className="m-nota">
          Brandbook v{tokens.version}. Esta página lee <code>brand/tokens.json</code> directamente:
          si el brandbook cambia y se vuelve a exportar, lo que se ve acá cambia con él. La
          aplicación todavía no está migrada — el inventario está en <code>brand/MIGRACION.md</code>.
        </p>

        {/* ── Color ─────────────────────────────────────────────────────── */}
        <section className="m-seccion">
          <p className="m-etiqueta">Color · {tokens.color.tokens.length} tokens</p>
          <p className="m-nota">
            Proporción del brandbook: ~90% grises, ~8% <code>--ink</code>, ~2% acento. El rojo
            señala, nunca identifica.
          </p>
          <div className="m-paleta">
            {tokens.color.tokens.map((t) => (
              <div className="m-ficha" key={t.name}>
                <div className="m-muestra" style={{ background: `var(--${t.name})` }} />
                <div className="m-ficha-cuerpo">
                  <div className="m-ficha-nombre">--{t.name}</div>
                  <div className="m-ficha-valor">{valorOscuro(t.value)}</div>
                  <p className="m-ficha-uso">{t.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tipografía ────────────────────────────────────────────────── */}
        <section className="m-seccion">
          <p className="m-etiqueta">Tipografía · Geist y Geist Mono</p>
          <p className="m-nota">
            Titulares en dos líneas: la primera en peso 200, la segunda en 500. Cuerpo en 300 sobre
            oscuro. La mono es para etiquetas, cifras y muestras de datos; nunca para párrafos.
          </p>
          {tokens.type.groups.map((g) => (
            <div key={g.name}>
              <p className="m-etiqueta" style={{ marginTop: 'var(--space-8)' }}>{g.name}</p>
              {g.styles.map((e) => (
                <div className="m-tipo" key={e.name}>
                  <div className="m-tipo-meta">
                    {e.name} · {e.fontSize} · {e.fontWeight} · ls {e.letterSpacing} — {e.usage}
                  </div>
                  <div
                    style={{
                      fontFamily: g.family === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
                      fontSize: e.fontSize,
                      lineHeight: e.lineHeight,
                      fontWeight: e.fontWeight,
                      letterSpacing: e.letterSpacing,
                    }}
                  >
                    {e.sample}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* ── Componentes base ──────────────────────────────────────────── */}
        <section className="m-seccion">
          <p className="m-etiqueta">Componentes base</p>
          <p className="m-nota">
            Un botón primario por vista. Sin sombras ni degradados: la estructura se dibuja con
            bordes de 1px. Foco visible con anillo de 2px en <code>--accent</code>.
          </p>
          <div className="m-fila" style={{ marginBottom: 'var(--space-8)' }}>
            <button className="m-btn" type="button">Solicitar acceso <span aria-hidden="true">→</span></button>
            <button className="m-btn m-btn-2" type="button">Ver el método</button>
            <span className="m-chip">muestra: 84 llamadas</span>
            <span className="m-chip">Closer</span>
          </div>
          <div className="m-tarjeta">
            <h3>Tengo un dato.</h3>
            <p>
              El 62,7% de cancelación que publicamos sumaba dos hechos opuestos. La mitad era
              descarte propio, no ausencia del cliente.
            </p>
            <div className="m-muestra-dato">muestra: 135 de 152 citas</div>
          </div>
        </section>

        {/* ── Mascota ───────────────────────────────────────────────────── */}
        <section className="m-seccion">
          <p className="m-etiqueta">Mascota · con la mirada siguiendo el cursor</p>
          <p className="m-nota">
            Una por pantalla. No se estira, no cambia de color, no lleva accesorios. Los ojos
            siguen el cursor y vuelven al centro a los 3 segundos; respeta{' '}
            <code>prefers-reduced-motion</code>.
          </p>
          <div className="m-orb-grande">
            <aria-mascot size={210} follow="" />
          </div>
        </section>

        <section className="m-seccion">
          <p className="m-etiqueta">Los ocho estados</p>
          <p className="m-nota">Se elige por lo que pasa, no por decoración.</p>
          <div className="m-estados">
            {ESTADOS.map((e) => (
              <div className="m-estado" key={e}>
                <aria-mascot size={72} state={e} />
                <span>{e}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
