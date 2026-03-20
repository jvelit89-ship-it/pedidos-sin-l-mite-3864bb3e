

## Plan: Comisiones para Repartidores

### Resumen
Agregar un sistema de comisiones para repartidores que funcione igual que el de vendedores, pero basado en los pedidos que **entregan** (no los que venden). Cada producto tendrá un campo adicional `repartidor_commission_amount` para definir cuánto gana el repartidor por unidad entregada.

---

### Cambios necesarios

#### 1. Base de datos
- Agregar columna `repartidor_commission_amount` (numeric, default 0) a la tabla `products`
- Agregar `'repartidor'` a la ruta `/commissions` en permisos de acceso

#### 2. Hook de comisiones (`src/hooks/useCommissions.ts`)
- Agregar `useRepartidorCommissions(year, month)` — calcula comisiones de todos los repartidores activos, basado en pedidos con `status = 'delivered'` agrupados por `repartidor_id`, usando `delivered_at` para los períodos quincenales
- Agregar `useMyRepartidorCommissions(repartidorId, year, month)` — vista personal del repartidor
- Extender `useProductCommissions` para soportar el tipo `'repartidor'` al editar montos

#### 3. Página de Comisiones (`src/pages/CommissionsPage.tsx`)
- **Admin**: Agregar pestaña "Repartidores" junto a "Vendedores" y "Operarios"
- **Admin**: Mostrar tabla de comisiones por repartidor con desglose quincenal
- **Admin**: En configuración de productos, agregar columna para editar `repartidor_commission_amount`
- **Repartidor**: Mostrar su resumen personal de comisiones (igual que vendedor ve las suyas)
- Exportación PDF para comisiones de repartidores

#### 4. Permisos de acceso (`src/contexts/AuthContext.tsx`)
- Agregar `'repartidor'` al array de roles permitidos en `/commissions`

### Lógica de cálculo
La comisión del repartidor se calcula igual que la del vendedor:
- Filtra pedidos `delivered` del mes, agrupados por `repartidor_id`
- Multiplica `quantity × repartidor_commission_amount` por cada item
- Divide en quincenas (1-15 y 16-fin de mes) usando `delivered_at`

### Archivos a modificar
1. **Migración SQL** — nueva columna en `products`
2. `src/hooks/useCommissions.ts` — nuevos hooks
3. `src/pages/CommissionsPage.tsx` — UI para admin y repartidor
4. `src/contexts/AuthContext.tsx` — permiso de ruta

