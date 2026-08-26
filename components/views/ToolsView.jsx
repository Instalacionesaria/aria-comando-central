/* Tools — nace vacía, y lo dice.
   ==========================================================================
   Esta vista NO viene del prototipo `aios-command-center_1.html`: es la primera pantalla
   creada de cero en el proyecto. Por eso no está en `scripts/paridad.mjs` — no hay contra
   qué compararla.

   ── POR QUÉ NO TIENE TARJETAS DE MAQUETA ──────────────────────────────────

   Lo natural sería copiar la forma de `SalesView` —cuatro estadísticas, una tabla, unas
   barras— para que "se vea como el resto". Eso es exactamente lo que este repositorio no
   hace: las cifras de las otras nueve vistas son maquetado del prototipo, y alguien que
   las mira ya sabe que lo son. De ésta nadie lo sabría, y un `$55,200` inventado en una
   pantalla nueva se lee como un dato.

   Es la misma regla que `ADR-0305` aplica a los rechazos y que la migración 011 aplica a
   las columnas: un cero medido y un cero no medido no son el mismo hecho. Acá no hay
   ninguna medición todavía, así que la pantalla dice eso y nada más. */
export default function ToolsView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-tools">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>
              Tools
            </h2>
            <span className="cre-desc">
              Las herramientas de la operación
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '34px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Pendiente de construir
            </div>
            <div style={{ color: 'var(--txt-dim)', fontSize: 12.5, lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
              La pestaña existe y está en su lugar; todavía no tiene nada adentro. No es que
              no haya datos — es que no hay ninguna operación detrás de esta pantalla.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
