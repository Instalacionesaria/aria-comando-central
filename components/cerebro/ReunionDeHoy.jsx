'use client';

/* La Reunión de hoy en el Inicio (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-73, AG-74 y AG-76;
 * `fichas/F17-LA-REUNION-DE-HOY.md`): la cinta con la hora de la pasada y hasta tres tarjetas, cada una con
 * su etiqueta, su texto y su origen.
 *
 * Todo lo que se dibuja lo trae el servidor (`app/api/executive/route.ts`), ya filtrado por las secciones de
 * la persona y recortado a tres: acá no hay una sola cifra ni un tema. Sin pasada no se dibuja nada; si la
 * pasada corrió y no hay nada para esta persona, la cinta lo dice con su hora.
 *
 * Tocar una tarjeta abre el tema como conversación (`alAbrir`). Sin `cerebro.usar` o bajo delegación las
 * tarjetas se leen pero no se abren: abrir escribe un hilo a nombre de quien toca, y el servidor lo rechaza. */

// Con un lugar vacío adelante: el mes `10` es `MESES[10]`.
const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `2026-10-05` → «5 de octubre». */
function fecha(dia) {
  const [, m, d] = dia.split('-').map(Number);
  return `${d} de ${MESES[m]}`;
}

export default function ReunionDeHoy({ reunion, puedeAbrir, alAbrir }) {
  if (!reunion) return null;
  // Antes de la pasada de la mañana, la última que corrió, con su fecha: no se hace pasar por la de hoy.
  const cinta = reunion.deHoy ? `De la Reunión de hoy · ${reunion.hora}` : `De la última Reunión · ${fecha(reunion.dia)}, ${reunion.hora}`;
  return (
    <section className="inicio-reunion" aria-label="Reunión de hoy">
      <p className="ir-cinta">
        {cinta}
      </p>
      {reunion.temas.length === 0 ? (
        <p className="ir-vacia">La pasada no encontró temas en las secciones que ves.</p>
      ) : (
        <ul className="ir-temas">
          {reunion.temas.map((t) => {
            const contenido = (
              <>
                <span className="ir-etiqueta">{t.etiqueta}</span>
                <span className="ir-texto">{t.texto}</span>
                <span className="ir-origen">{t.origen}</span>
              </>
            );
            return (
              <li key={t.clave}>
                {puedeAbrir ? (
                  <button type="button" className="ir-tema" onClick={() => alAbrir(t.clave)}>
                    {contenido}
                  </button>
                ) : (
                  <div className="ir-tema">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
