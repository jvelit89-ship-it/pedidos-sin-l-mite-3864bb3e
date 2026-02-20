
# Dos Nuevas Funcionalidades: Pre-pedidos y Créditos Prepagados

## Problema 1: Vendedores sin poder vender cuando no hay stock

Los vendedores no pueden crear pedidos cuando el stock es 0, bloqueando las ventas mientras se fabrica. La solución es un sistema de **Pre-pedidos** (backorders) que se activan automáticamente cuando hay stock disponible.

## Problema 2: Clientes que pagan por adelantado en volumen

Clientes pagan, por ejemplo, 500 unidades con precio promocional y van retirando en partes semana a semana. Necesitan un sistema de **Saldo de Crédito por Producto** que descargue el balance con cada despacho.

---

## SOLUCIÓN 1: Pre-pedidos (Backorders)

### Flujo del Usuario

```text
VENDEDOR crea pedido sin stock
         |
         v
 Aparece badge "PENDIENTE DE STOCK"
 en listado de pedidos
         |
         v
OPERARIO/ADMIN registra nueva producción
         |
         v
TRIGGER automatico detecta
pre-pedidos pendientes vs stock disponible
         |
         v
Pre-pedidos se activan en orden cronológico
(FIFO - primero en entrar, primero en salir)
         |
         v
Estado cambia: "Sin Stock" -> "Pendiente"
Notificacion interna en dashboard
```

### Cambios en Base de Datos

#### Nuevo campo en `orders`: `is_backorder`
- `is_backorder BOOLEAN DEFAULT false`: marca si el pedido fue creado sin stock
- `backorder_fulfilled_at TIMESTAMP`: cuando el backorder se convirtió en pedido real
- El status inicial será `'backorder'` (nuevo estado virtual)

#### Nueva función SQL: `fulfill_backorders(product_id, quantity_added)`
- Se ejecuta automáticamente después de cada producción vía trigger
- Busca backorders pendientes de ese producto, ordenados por `created_at` (FIFO)
- Activa los que puede cubrir con el stock disponible, cambiando status a `'pending'`

#### Nuevo estado de orden: `backorder`
- Se agrega al tipo `order_status` en la base de datos
- El stock NO se descuenta cuando es backorder
- Cuando se activa, el stock se descuenta normalmente via el trigger existente

### Cambios en Frontend

#### `NewOrderPage.tsx`
- Eliminar el filtro `p.stock > 0` que bloquea productos sin stock
- Mostrar todos los productos con badge "Sin Stock" en rojo para los que no tienen inventario
- Al crear pedido con producto sin stock: confirmar con modal "Este pedido quedará en lista de espera hasta que haya stock disponible"
- Generar nota de venta igualmente (para que el cliente tenga registro)

#### `OrdersPage.tsx`
- Nueva tab "Pre-pedidos" visible para Admin y Vendedor
- Badge con contador de pre-pedidos pendientes
- Columna especial con indicador de qué productos faltan y cuántas unidades

#### `InventoryPage.tsx`
- Al registrar producción, el sistema muestra cuántos pre-pedidos se activaron automáticamente
- Badge "X pre-pedidos activados" en el toast de confirmación

#### `useOrders.ts`
- `createOrder` acepta pedidos con status `'backorder'`
- No descuenta stock si es backorder

---

## SOLUCIÓN 2: Créditos Prepagados por Cliente-Producto

### Flujo del Usuario

```text
ADMIN crea "Paquete Prepagado"
Cliente: Juan Perez
Producto: Agua 20L
Cantidad: 500 unidades
Precio pactado: S/ 8.50 c/u
Monto total pagado: S/ 4,250
         |
         v
Sistema registra saldo: 500 unidades disponibles
         |
         v
VENDEDOR crea pedido para Juan Perez
Al seleccionar "Agua 20L" aparece badge:
"Saldo Prepagado: 450 unid. disponibles"
Precio se aplica automaticamente: S/ 8.50
         |
         v
VENDEDOR confirma pedido (150 unidades)
         |
         v
Sistema descuenta: 500 - 150 = 350 restantes
         |
         v
Al llegar a 0, cliente ya no tiene saldo
```

### Cambios en Base de Datos

#### Nueva tabla: `customer_prepaid_packages`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| customer_id | uuid | Cliente |
| product_id | uuid | Producto específico |
| company_id | uuid | Empresa |
| total_units | integer | Unidades totales compradas |
| remaining_units | integer | Unidades restantes |
| unit_price | numeric | Precio pactado por unidad |
| amount_paid | numeric | Monto total pagado |
| is_active | boolean | Si está activo |
| notes | text | Observaciones |
| created_at | timestamp | Fecha de registro |
| expires_at | date | Fecha de vencimiento (opcional) |

#### Nueva tabla: `prepaid_package_usages`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| package_id | uuid | FK al paquete |
| order_id | uuid | Pedido que consumió |
| company_id | uuid | Empresa |
| quantity_used | integer | Unidades descontadas |
| created_at | timestamp | Fecha del consumo |

#### RLS Policies
- Admin: gestión completa de paquetes y usos
- Vendedor: solo lectura para ver saldos al crear pedidos

### Cambios en Frontend

#### Nueva sección en `CustomersPage.tsx` (o pestaña separada)
- Tab "Créditos Prepagados" dentro del detalle de cliente
- Tabla de paquetes: Producto | Precio | Total | Usado | Restante | Vencimiento | Estado
- Botón "+ Nuevo Paquete Prepagado" (solo Admin)

#### `NewOrderPage.tsx`
- Al seleccionar cliente + producto, consulta si tiene saldo prepagado activo
- Si tiene: badge verde "Saldo: X unidades | S/ Y.YY c/u"
- El precio se aplica automáticamente al agregar el producto
- Al confirmar el pedido: descuenta las unidades del paquete correspondiente

#### Nuevo hook: `usePrepaidPackages.ts`
- `getPrepaidBalance(customerId, productId)`: retorna saldo y precio del paquete activo
- `createPackage(data)`: crea un nuevo paquete prepagado
- `usePackageForOrder(packageId, orderId, quantity)`: descuenta del saldo al confirmar pedido
- `getCustomerPackages(customerId)`: lista todos los paquetes de un cliente

---

## Sección Técnica

### Archivos a crear
- `supabase/migrations/..._backorders_and_prepaid.sql` — Schema y triggers
- `src/hooks/usePrepaidPackages.ts` — Hook para paquetes prepagados
- `src/components/PrepaidPackagesManager.tsx` — UI para gestión de paquetes

### Archivos a modificar
- `src/pages/NewOrderPage.tsx` — Mostrar productos sin stock + saldos prepagados
- `src/pages/OrdersPage.tsx` — Tab de pre-pedidos + badge contador
- `src/hooks/useOrders.ts` — Soporte para status `backorder`
- `src/types/index.ts` — Agregar `backorder` a `OrderStatus` y config de display

### Trigger SQL clave: `auto_fulfill_backorders`
```sql
-- Se ejecuta DESPUÉS de cada INSERT en production_history
-- Busca backorders del producto producido, en orden cronológico (FIFO)
-- Activa los que puede cubrir con el nuevo stock
-- Registra en audit_log los backorders activados
```

### Validaciones importantes
- No descuenta stock al crear backorder
- Si hay paquete prepagado Y el cliente tiene stock: prioriza precio del paquete
- Si un backorder se cancela: no afecta inventario
- Los paquetes prepagados NO mezclan su saldo entre distintos productos
- Al activar un backorder automáticamente: se registra `backorder_fulfilled_at`
