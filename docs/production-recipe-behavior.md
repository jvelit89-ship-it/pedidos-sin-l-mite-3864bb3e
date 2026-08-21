# Producción con Receta

La producción por receta usa `production_recipes` como fuente de verdad para determinar las materias primas que consume cada Producto Final.

## Regla general

Por cada materia prima activa asociada al Producto Final:

`cantidad a descontar = cantidad producida × quantity_ratio`

Ejemplo: si un producto tiene tres materias primas con ratio 1:1 y se producen 100 unidades, el sistema descuenta 100 unidades de cada una.

## Comportamiento

1. El usuario selecciona el Producto Final y la cantidad a producir.
2. La interfaz muestra las materias primas activas asociadas a la receta y calcula la cantidad requerida.
3. Antes de registrar/aprobar la producción, se valida que todas las materias primas tengan stock suficiente.
4. Al insertarse el registro en `production_history`, el trigger `auto_update_stock_on_production()`:
   - aumenta el stock del Producto Final;
   - descuenta todas las materias primas activas de su receta;
   - registra un movimiento de stock por cada materia prima consumida.
5. Si falta cualquier materia prima, la operación completa falla y no se registra una producción parcial.

## Ejemplos configurados en esta rama

### Agua Santa María 8L

- Botellas PET 8L Vacías: receta existente.
- Etiquetas 8L: relación 1:1 agregada.
- Termocontraíble 8L: relación 1:1 agregada.

### Agua Santa María 20L en bidón

- Termocontraíble 20L (caño y tapa): relación inicial 1:1 agregada.
- Cualquier otra materia prima que se configure en `production_recipes` se descontará automáticamente usando su propio ratio.

Las migraciones no inventan existencias: cualquier materia prima creada automáticamente inicia con stock 0 y debe recibir el stock físico real antes de producir.
