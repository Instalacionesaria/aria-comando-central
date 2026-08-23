import CommandCenter from '@/components/CommandCenter';
import Guardia from './guardia.tsx';

export default function Page() {
  // `Guardia` envuelve el centro de mando y no está adentro de él a propósito: así el
  // armazón no se monta hasta que el servidor confirmó que la sesión está ACTIVA. Ver
  // `app/guardia.tsx` para qué cubre esto que `proxy.ts` no puede.
  return (
    <Guardia>
      <CommandCenter />
    </Guardia>
  );
}
