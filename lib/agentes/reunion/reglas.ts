// Las reglas de la Reunión de hoy, en el catálogo de umbrales (AG15 de los agentes; `04`, AG-70). Aparte de
// `./temas.ts`, que lee las señales: el catálogo (`../senales/umbrales.ts`) importa estas reglas, y si importara
// `./temas.ts` cargaría la lectura de las señales, que carga el catálogo, en un ciclo.

import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

export const REU = {
  sinEntrega: 'REU-SIN-ENTREGA',
  caidaDeEntrada: 'REU-CAIDA-DE-ENTRADA',
  citasSinRegistrar: 'REU-CITAS-SIN-REGISTRAR',
  objecionFrecuente: 'REU-OBJECION-FRECUENTE',
  llamadasSinVinculo: 'REU-LLAMADAS-SIN-VINCULO',
} as const;

export const ETIQUETAS = ['CADENA', 'CONTRADICCIÓN', 'PATRÓN', 'SIN DATOS NUEVOS', 'SIN REGISTRAR', 'SIN LECTOR'] as const;
export type Etiqueta = (typeof ETIQUETAS)[number];

export const REGLAS_DE_LA_REUNION: readonly ReglaDelCatalogo[] = [
  {
    codigo: REU.sinEntrega,
    departamento: 'reunion',
    valor: 1,
    unidad: 'veces',
    denominador: null,
    gravedad: 'alta',
    porque: 'Lee la señal «sin entrega» de Acquisition: con una sola campaña activa que dejó de entregar, la dirección lo tiene que saber.',
  },
  {
    codigo: REU.caidaDeEntrada,
    departamento: 'reunion',
    valor: 0.4,
    unidad: 'proporcion',
    denominador: 'contactos de la semana anterior',
    gravedad: 'alta',
    porque: 'Cuatro de cada diez contactos menos que la semana anterior, con diez o más en ella, no es una semana floja: es la entrada que se cortó.',
  },
  {
    codigo: REU.citasSinRegistrar,
    departamento: 'reunion',
    valor: 1,
    unidad: 'veces',
    denominador: 'citas que ya ocurrieron',
    gravedad: 'media',
    porque: 'Una cita que ya ocurrió y nadie registró no existe para el sistema: ninguna cifra de cierre la puede contar.',
  },
  {
    codigo: REU.objecionFrecuente,
    departamento: 'reunion',
    valor: 1,
    unidad: 'veces',
    denominador: 'llamadas de venta analizadas',
    gravedad: 'media',
    porque: 'La objeción más repetida de las llamadas de 14 días, con diez o más analizadas: es lo que el equipo tiene que preparar.',
  },
  {
    codigo: REU.llamadasSinVinculo,
    departamento: 'reunion',
    valor: 0.2,
    unidad: 'proporcion',
    denominador: 'llamadas de venta analizadas',
    gravedad: 'media',
    porque: 'Si una de cada cinco llamadas analizadas no se puede vincular a un contacto, ese análisis no llega a la ficha ni al Brief: no se usa.',
  },
];
