
# Plan: Reportes de Ventas por Producto + Tipos de Producto (Final vs Materia Prima)

## Contexto Actual

El sistema ya tiene:
- Tabla `production_recipes` y componente `ProductionRecipesManager` para definir recetas (materia prima → producto final)
- Triggers automáticos que descuentan materias primas al registrar producción
- Exportación básica de inventario (CSV/PDF) y pedidos (XLS/PDF)
- Los productos no tienen clasificación de tipo (final vs materia prima)

---

## SOLUCIÓN 1: Reportes de Ventas por Producto (Diario, Semanal, Mensual)

Los reportes actuales muestran movimientos de stock (producción vs ventas). El usuario quiere reportes **centrados en ventas por producto**, con datos monetarios, desglosados por período, exportables en PDF y Excel.

### Fuente de datos
Se consultará la tabla `order_items` (unida a `orders`) filtrando por `orders.status = 'delivered'` y `orders.created_at` por período. Esto muestra **ventas reales entregadas**.

### Períodos disponibles
- Diario (hoy)
- Semanal (semana actual, lunes a domingo)
- Mensual (mes actual)
- Rango personalizado (fecha inicio / fecha fin)

### Columnas del reporte por producto
| Producto | SKU | Unidades Vendidas | Precio Unit. | Total Vendido |
|---|---|---|---|---|
| Agua 8L | SM8L | 45 | S/ 12.00 | S/ 540.00 |
| Hielo 3kg | HI3K | 30 | S/ 5.00 | S/ 150.00 |

### Nueva función/hook: `useSalesReports`
- `getSalesByProduct(period, startDate?, endDate?)`: consulta `order_items` + `orders` para devolver ventas por producto
- Datos: nombre, SKU, total unidades, precio promedio, ingresos totales

### Nueva UI: Pestaña "Ventas" en InventoryPage
Se agrega una nueva pestaña junto a las existentes (Inventario, Producción, Movimientos, Recetas):
- Selector de período: Hoy | Esta Semana | Este Mes | Rango Personalizado
- Tabla de resultados con totales al pie
- Botón "Exportar PDF" → genera HTML imprimible con tabla y resumen
- Botón "Exportar Excel" → genera XLS estructurado (mismo formato que el exportador de pedidos)

---

## SOLUCIÓN 2: Tipos de Producto (Producto Final vs Materia Prima)

### Cambio en base de datos
Se agrega columna `product_type` a la tabla `products`:
```sql
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'final' CHECK (product_type IN ('final', 'raw_material'));
```

Los valores son:
- `'final'` → Producto listo para vender (Agua 8L, Hielo 3kg, etc.)
- `'raw_material'` → Material que se consume en producción (Bolsas Vacías, Botellas, etc.)

### Impacto en el sistema

#### Inventario (InventoryPage)
- **Pestañas separadas** en la lista de productos: "Producto Final" | "Materia Prima"
- Badges de color diferente: azul para final, naranja para materia prima
- Al crear/editar producto: selector obligatorio de tipo
- Filtro visual en la barra de búsqueda

#### Producción (ProductionRecipesManager)
- En las recetas, el selector de **Material de Entrada** solo muestra `raw_material`
- El selector de **Producto de Salida** solo muestra `final`
- En "Registrar Producción directa", solo se muestran productos `final`

#### Pre-pedidos / Ventas
- Solo los productos `final` aparecen disponibles para crear pedidos
- Las materias primas no son vendibles

#### Recetas ya configuradas (tus casos de uso)
Las recetas existentes en el sistema seguirán funcionando. El administrador simplemente marcará los productos existentes con el tipo correcto:

| Producto | Tipo |
|---|---|
| Bolsas de 3kg Vacías | Materia Prima |
| Bolsas de 1.5kg Vacías | Materia Prima |
| Botellas 1L Vacías | Materia Prima |
| Botellas 625ML Vacías | Materia Prima |
| Botellas PET 8L Vacías | Materia Prima |
| Hielo en cubos Ecohielo 3kg | Producto Final |
| Hielo en cubos Ecohielo 1.5kg | Producto Final |
| Agua Santa María Pqte 1L x8 | Producto Final |
| Agua Santa María Pqte 625ml x15 | Producto Final |
| Agua Santa María 8L | Producto Final |

---

## Flujo Completo de Producción con Tipos

```text
Admin registra: "Producir 10 Hielo 3kg"
        |
        v
Sistema verifica receta:
  Hielo 3kg (Producto Final) 
  requiere: 1 Bolsa 3kg Vacía (Materia Prima) por unidad
        |
        v
Trigger automático descuenta:
  Stock Bolsas 3kg Vacías: -10
  Stock Hielo 3kg: +10
        |
        v
Inventario actualizado en tiempo real
```

---

## Archivos a Crear / Modificar

### Base de datos (migración SQL)
1. `ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'final'`
2. Actualizar función `recalculate_company_stock` si es necesario (sin cambios críticos)

### Nuevos archivos
- `src/hooks/useSalesReports.ts` — Hook para reportes de ventas por producto con filtros de período

### Archivos a modificar
- `src/pages/InventoryPage.tsx`:
  - Agregar campo `product_type` al formulario de crear/editar producto
  - Separar la lista de productos en tabs: "Productos Finales" / "Materias Primas"
  - Agregar pestaña "Reporte de Ventas" con selector de período + tabla + botones de exportación
  - Filtrar productos de producción directa: solo `product_type = 'final'`

- `src/components/ProductionRecipesManager.tsx`:
  - Filtrar selector de "Material de Entrada" para mostrar solo `raw_material`
  - Filtrar selector de "Producto de Salida" para mostrar solo `final`

- `src/pages/NewOrderPage.tsx`:
  - Filtrar productos disponibles para venta: solo `product_type = 'final'`

- `src/hooks/useProducts.ts`:
  - Agregar `product_type` a la interfaz `Product`

---

## Sección Técnica

### Migración SQL
```sql
-- Agregar tipo de producto
ALTER TABLE public.products 
ADD COLUMN product_type TEXT NOT NULL DEFAULT 'final';

-- Constraint de validación
ALTER TABLE public.products 
ADD CONSTRAINT products_type_check 
CHECK (product_type IN ('final', 'raw_material'));
```

### Hook de Reportes de Ventas
```typescript
// Consulta base para reporte
const { data } = await supabase
  .from('order_items')
  .select(`
    product_id, product_name, quantity, unit_price, total,
    orders!inner(status, created_at, company_id)
  `)
  .eq('orders.company_id', companyId)
  .eq('orders.status', 'delivered')  // Solo ventas reales
  .gte('orders.created_at', startDate)
  .lte('orders.created_at', endDate);
```

### Exportación XLS de Ventas
Mismo patrón que `src/lib/orderExport.ts`, con columnas:
- Producto | SKU | Unidades | Precio Promedio | Total Ingresos

### Validaciones
- Un producto marcado como materia prima no puede aparecer en NewOrderPage
- Las recetas deben respetar la clasificación (input = raw_material, output = final)
- El tipo de producto puede cambiarse siempre que no haya recetas activas que lo contradigan (advertencia)
- Si un producto no tiene tipo asignado (existentes), se mostrará como "Final" por defecto
