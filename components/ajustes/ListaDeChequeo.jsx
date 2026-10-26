'use client';

/* La lista de chequeo de un cliente (el nivel 3, C6 · D5): qué le falta para estar configurado, y qué hacer.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DE DÓNDE SALE, Y QUÉ NO SE DICE
 *
 * El dato llega EN VIVO con la lista de clientes (`GET /api/admin/cuentas`, `listaDeChequeo`), armado con la misma
 * lista que la foto diaria y el tablero de Negocios (`lib/cartera/pasos.ts`): la conexión de cada cliente se lee como
 * presencias, nunca un valor, y lo que se mide —sus datos de las últimas 24 horas y si su GoHighLevel tiene Meta
 * vinculado— sale de la base en el momento. Acá sólo se dibuja; los nombres de los pasos vienen del servidor.
 *
 * Configurado = activo y con todos los pasos requeridos en verde. Lo recomendado se dice y no cuenta, y lo que todavía
 * no se pudo medir no se acusa: se dice cuándo se va a saber.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Dónde se carga la conexión: la del principal es la de la empresa; la de los demás, la suya. */
const dondeSeCarga = (c) => (c.esPorOmision ? 'Ajustes › Credenciales' : 'Editar › Conexión');

/** Qué hacer con cada paso que falta, por clave. Una clave sin su frase la delata la 299. */
export const QUE_HACER = {
  crm: (c) =>
    c.esPorOmision || c.crmVinculado
      ? `Carga su token de GoHighLevel en ${dondeSeCarga(c)}.`
      : 'ARIA tiene que vincular su subcuenta de GoHighLevel; después carga su token en Editar › Conexión.',
  calendario: (c) => `Elige el calendario de sus citas en ${dondeSeCarga(c)}.`,
  zona: () => 'Elige su zona horaria en Editar: decide qué es «hoy» para sus números.',
  nicho: () => 'Elige su nicho y confírmalo en Editar.',
  datos: () => 'No entró nada de su GoHighLevel en las últimas 24 horas: revisa su conexión.',
  meta: (c) =>
    `Conecta Meta en ${dondeSeCarga(c)} y asígnale su cuenta publicitaria: de ahí salen sus costos, sus campañas y sus anuncios.`,
  meta_leido: () => 'Sus campañas no se están leyendo de Meta: revisa su conexión con Meta en Ajustes.',
  aviso: (c) =>
    c.esPorOmision
      ? 'Opcional: configura el aviso del CRM en Ajustes › Credenciales para recibir sus mensajes al instante.'
      : 'Opcional: genera el secreto de su aviso en Editar › Conexión para recibir sus mensajes al instante.',
};

/** Lo que se dice de un paso que todavía no se pudo medir. */
export const SIN_MEDIR = {
  datos: 'Todavía no se pudo medir.',
  meta_leido: 'Todavía no se sabe: se ve con la próxima lectura de sus campañas, una vez al día.',
};

const MARCA = { ok: '✓', falta: '✗', sin_medir: '…' };

/** Los requeridos que faltan, los que no se midieron y los recomendados que faltan. */
function enCifras(lista) {
  const pasos = lista?.pasos ?? [];
  return {
    faltan: pasos.filter((p) => p.requerido && p.estado === 'falta'),
    sinMedir: pasos.filter((p) => p.requerido && p.estado === 'sin_medir'),
    recomendados: pasos.filter((p) => !p.requerido && p.estado === 'falta'),
  };
}

/** La píldora de la fila: configurado, cuánto le falta, o por qué todavía no. */
export function ResumenDeLaLista({ cliente }) {
  const lista = cliente.listaDeChequeo;
  if (!lista) return null;
  const { faltan, sinMedir } = enCifras(lista);
  if (lista.configurado) return <span className="chip ok">Configurado</span>;
  if (faltan.length > 0) return <span className="chip warn">{faltan.length === 1 ? 'Le falta 1 paso' : `Le faltan ${faltan.length} pasos`}</span>;
  if (sinMedir.length > 0) return <span className="chip warn">Sin medir todavía</span>;
  return <span className="chip warn">No está activo</span>;
}

/** La lista entera, paso por paso, con qué hacer en cada uno que falta. */
export default function ListaDeChequeo({ cliente }) {
  const lista = cliente.listaDeChequeo;
  if (!lista) return null;
  const { recomendados } = enCifras(lista);
  return (
    <div className="aj-chequeo">
      <ul>
        {lista.pasos.map((p) => (
          <li key={p.clave} className={`aj-paso ${p.estado}`}>
            <span className="aj-marca" aria-hidden="true">
              {MARCA[p.estado]}
            </span>
            <span>
              <b>{p.nombre}</b>
              {p.requerido ? null : <span className="aj-ayuda"> · recomendado</span>}
              {p.estado === 'falta' && QUE_HACER[p.clave] ? <span className="aj-ayuda"> {QUE_HACER[p.clave](cliente)}</span> : null}
              {p.estado === 'sin_medir' ? <span className="aj-ayuda"> {SIN_MEDIR[p.clave] ?? 'Todavía no se pudo medir.'}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {cliente.estado !== 'activa' ? (
        <p className="aj-ayuda">Mientras no esté activo no se leen sus datos, así que no cuenta como configurado.</p>
      ) : null}
      {lista.configurado && recomendados.length > 0 ? (
        <p className="aj-ayuda">Lo requerido está completo; lo recomendado suma, y no es obligatorio.</p>
      ) : null}
    </div>
  );
}
