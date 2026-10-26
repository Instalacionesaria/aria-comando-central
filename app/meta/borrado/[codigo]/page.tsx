// En qué quedó un pedido de borrado que reenvió Meta (Meta directo, M6): la URL que la ruta de borrado le da a Meta, y
// que Meta le muestra a quien lo pidió junto con el código. Pública: `CAMINOS_PUBLICOS`.
//
// No dice nada de nadie: sólo si hay un pedido con ese código, cuándo se pidió y si ya se borró. El código son 128 bits
// al azar y se busca por su sha256 (`estadoDelBorrado`), así que no se pueden recorrer los pedidos.
import { HojaLegal } from '../../../legal/hoja-legal.tsx';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { estadoDelBorrado } from '../../../../lib/meta/borrado.ts';

export const metadata = { title: 'Estado del borrado — ARIA IA' };

const fecha = (d: Date) => d.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' });

export default async function EstadoDelBorrado(props: PageProps<'/meta/borrado/[codigo]'>) {
  const { codigo } = await props.params;
  const estado = await conIdentidad((db) => estadoDelBorrado(db, codigo));
  return (
    <HojaLegal titulo="Estado del borrado">
      {estado === null ? (
        <p>No encontramos un pedido de borrado con ese código. Revisa que esté completo, tal como te lo mostró Meta.</p>
      ) : estado.borradoEl ? (
        <p>
          Tu pedido de borrado del {fecha(estado.pedidoEl)} está <b>completo</b>: el {fecha(estado.borradoEl)} borramos la
          conexión con Meta y lo que habíamos leído de sus cuentas publicitarias.
        </p>
      ) : (
        <p>
          Recibimos tu pedido de borrado el {fecha(estado.pedidoEl)} y está <b>en curso</b>. Vuelve a esta página en unos
          minutos.
        </p>
      )}
    </HojaLegal>
  );
}
