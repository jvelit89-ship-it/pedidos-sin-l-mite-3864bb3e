
# Modulo "Carga Extra del Camion"

## Problema
El repartidor carga productos adicionales en el camion para ventas al paso. Al finalizar la ruta, los productos no vendidos deben regresar al inventario del almacen.

## Solucion Propuesta

Crear un flujo de **"Carga Extra"** que permita:
1. Registrar productos extras que sube el repartidor al camion (se descuenta del almacen)
2. Registrar ventas al paso durante la ruta
3. Al cerrar la ruta, devolver automaticamente lo no vendido al inventario

---

## Flujo del Usuario

```text
+---------------------------+
|  1. CARGAR EXTRAS         |
|  (Antes de salir a ruta)  |
|  - Seleccionar productos  |
|  - Indicar cantidades     |
|  -> Descuenta del stock   |
+---------------------------+
           |
           v
+---------------------------+
|  2. VENTAS AL PASO        |
|  (Durante la ruta)        |
|  - Registrar venta rapida |
|  - Cliente + productos    |
|  -> Genera pedido normal  |
+---------------------------+
           |
           v
+---------------------------+
|  3. CIERRE / DEVOLUCION   |
|  (Al regresar)            |
|  - Ver extras restantes   |
|  - Confirmar devolucion   |
|  -> Reingresa al stock    |
+---------------------------+
```

---

## Cambios en Base de Datos

### Nueva tabla: `truck_extra_loads`
| Columna | Tipo | Descripcion |
|---|---|---|
| id | uuid | PK |
| repartidor_id | uuid | Quien carga |
| company_id | uuid | Empresa |
| status | text | 'active' / 'closed' |
| created_at | timestamp | Fecha de carga |
| closed_at | timestamp | Cuando se cierra |
| notes | text | Observaciones |

### Nueva tabla: `truck_extra_load_items`
| Columna | Tipo | Descripcion |
|---|---|---|
| id | uuid | PK |
| load_id | uuid | FK a truck_extra_loads |
| product_id | uuid | Producto cargado |
| quantity_loaded | integer | Cantidad subida al camion |
| quantity_sold | integer | Cantidad vendida al paso (default 0) |
| quantity_returned | integer | Cantidad devuelta (default 0) |
| company_id | uuid | Empresa |

### Triggers automaticos
- **Al crear items de carga extra**: Descontar del stock del almacen + registrar stock_movement tipo 'truck_load'
- **Al cerrar carga**: Reingresar `quantity_loaded - quantity_sold` al stock + registrar stock_movement tipo 'truck_return'

### RLS
- Admin/Superadmin: acceso completo
- Repartidor: puede ver/crear sus propias cargas y registrar ventas

---

## Cambios en Frontend

### 1. Nuevo hook: `useTruckExtraLoad.ts`
- Crear carga extra
- Agregar/quitar productos
- Registrar venta al paso (crea un pedido normal vinculado)
- Cerrar carga y devolver stock

### 2. Seccion en DeliveriesPage.tsx
Agregar un panel colapsable en la parte superior de la pagina de entregas del repartidor:

- **Boton "Cargar Extras"**: Abre dialog para seleccionar productos y cantidades del inventario
- **Panel "Extras en Camion"**: Muestra productos cargados con cantidad restante
- **Boton "Venta al Paso"**: Formulario rapido para registrar venta a cliente (nuevo o existente)
- **Boton "Cerrar Carga"**: Devuelve todo lo no vendido al inventario

### 3. Integracion con inventario
- Los movimientos de stock se registran automaticamente via triggers
- El stock se refleja en tiempo real en la pagina de Inventario
- Se usa el tipo de movimiento 'truck_load' y 'truck_return' para trazabilidad

### 4. Navegacion
No se necesita nueva pagina; se integra directamente en la vista de entregas del repartidor y es visible tambien para admins.

---

## Seccion Tecnica

### Migracion SQL
- Crear tablas `truck_extra_loads` y `truck_extra_load_items`
- Crear trigger `deduct_stock_on_truck_load` (INSERT en items -> descuenta stock)
- Crear funcion `close_truck_extra_load` que calcula devolucion y reingresa stock
- Agregar RLS policies para repartidor y admin
- Agregar tipos de movimiento 'truck_load' y 'truck_return' en stock_movements

### Archivos a crear/modificar
- **Crear**: `src/hooks/useTruckExtraLoad.ts`
- **Modificar**: `src/pages/DeliveriesPage.tsx` (agregar panel de carga extra)
- **Modificar**: `src/types/index.ts` (agregar interfaces)

### Validaciones
- No permitir cargar mas de lo disponible en stock
- No permitir vender mas de lo cargado
- No permitir cerrar una carga ya cerrada
- Cantidades siempre positivas
