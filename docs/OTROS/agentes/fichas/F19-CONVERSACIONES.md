# F19 · CONVERSACIONES

> El historial de lo que cada persona le preguntó al cerebro, en la barra lateral. De quien las escribió, con
> la memoria del hilo, y las borra su autor (`D-14`).

| campo | valor |
|---|---|
| Tipo | EL CEREBRO |
| Lugar en el front | El bloque CONVERSACIONES de la barra (hoy «Próximamente», `components/Nav.jsx`); el panel que sube en la caja del pie, para quien no ve el Inicio |
| Estado | **Se construye** en AG7 |
| Permisos | Leer la lista: la del Inicio (`tablero.ver`) o la de la sección, en el panel del pie. Borrar: `cerebro.usar` |
| Tablas | `conversaciones_del_executive`, `mensajes_del_executive` (`070`) |

## Requisitos

- **AG-F19-1 · Sólo las propias**: la lista y la lectura filtran por autor; un hilo ajeno da 404.
- **AG-F19-2 · El título es la primera pregunta**, recortada.
- **AG-F19-3 · Tocar un hilo lo reabre** en el Inicio, con su evidencia guardada (los nombres se resuelven al
  mostrar).
- **AG-F19-4 · El autor borra**; no vencen.
- **AG-F19-5 · «Nueva conversación»**, la fila que ya existe en la barra, abre un hilo nuevo en el Inicio.
- **AG-F19-6 · Quien no ve el Inicio** no ve este bloque (como hoy) y gestiona sus hilos desde el panel de la
  caja del pie de cada sección.
- **AG-F19-7 · Sin URL para compartir** y sin «＋» para adjuntar en la v1.

## Pruebas

La 197 cambia (la lista viene del servidor y sólo aparece con el Inicio); la 208 cubre el autor y el borrado.
